#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
commit=${1:?Usage: update-server.sh FULL_COMMIT_SHA}
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 1
exec 9>/run/laka-warehouse-deploy.lock
flock -n 9 || { echo 'Another update is running'; exit 1; }
base=/opt/laka-warehouse
release="$base/releases/$commit"
previous=$(readlink -f "$base/current" || true)
stage=''
backup_dir=''
maintenance=0
was_active=0
systemctl is-active --quiet laka-warehouse.service && was_active=1
finish() {
    result=$?
    trap - EXIT
    if [[ $result != 0 && $maintenance == 1 ]]; then
        systemctl stop laka-warehouse.service || true
        if [[ -n "$backup_dir" ]]; then
            # No application writes occur while the maintenance gate is present.
            gzip -dc "$backup_dir/warehouse.sqlite.gz" > "$LAKA_DATA_DIR/warehouse.sqlite.restore"
            chown laka:laka "$LAKA_DATA_DIR/warehouse.sqlite.restore"
            chmod 600 "$LAKA_DATA_DIR/warehouse.sqlite.restore"
            rm -f "$LAKA_DATA_DIR/warehouse.sqlite-wal" "$LAKA_DATA_DIR/warehouse.sqlite-shm"
            mv -f "$LAKA_DATA_DIR/warehouse.sqlite.restore" "$LAKA_DATA_DIR/warehouse.sqlite"
        fi
        if [[ "$previous" == "$base/releases/"* && -f "$previous/RELEASE" ]]; then
            ln -sfn "$previous" "$base/current.new"
            mv -Tf "$base/current.new" "$base/current"
            sed -i "s/^LAKA_RELEASE=.*/LAKA_RELEASE=$(cat "$previous/RELEASE")/" /etc/laka-warehouse.env
            install -m 644 "$previous/deploy/laka-warehouse.service" /etc/systemd/system/laka-warehouse.service
            systemctl daemon-reload
        fi
        if [[ $was_active == 1 ]]; then
            systemctl restart laka-warehouse.service
            for attempt in $(seq 1 20); do
                if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then rm -f /run/laka-warehouse-maintenance; break; fi
                sleep 1
            done
        fi
        echo 'Update failed. Previous database restored when backed up; maintenance remains if recovery is unhealthy.' >&2
    fi
    if [[ "$stage" == "$base/releases/.incoming-"* && -d "$stage" && ! -L "$stage" ]]; then rm -rf -- "$stage"; fi
    exit "$result"
}
trap finish EXIT
if [[ ! -d "$release" ]]; then
    stage=$(mktemp -d "$base/releases/.incoming-XXXXXX")
    url="https://github.com/phiphung-web/Laka-Warehouse/releases/download/vps-$commit"
    curl -fLsS --retry 2 "$url/laka-warehouse.tgz" -o "$stage/laka-warehouse.tgz"
    curl -fLsS --retry 2 "$url/laka-warehouse.tgz.sha256" -o "$stage/laka-warehouse.tgz.sha256"
    grep -Eq '^[a-f0-9]{64}  laka-warehouse.tgz$' "$stage/laka-warehouse.tgz.sha256"
    (cd "$stage"; sha256sum -c laka-warehouse.tgz.sha256)
    if tar -tzf "$stage/laka-warehouse.tgz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then echo 'Unsafe archive'; exit 1; fi
    install -d -m 755 "$stage/unpacked"
    tar -xzf "$stage/laka-warehouse.tgz" -C "$stage/unpacked" --no-same-owner --no-same-permissions
    [[ $(cat "$stage/unpacked/RELEASE") == "$commit" ]] || exit 1
    mv "$stage/unpacked" "$release"
fi
[[ $(cat "$release/RELEASE") == "$commit" ]] || exit 1
set -a
source /etc/laka-warehouse.env
set +a
touch /run/laka-warehouse-maintenance
maintenance=1
systemctl stop laka-warehouse.service 2>/dev/null || true
if [[ -f "$LAKA_DATA_DIR/warehouse.sqlite" ]]; then
    backup_result=$(runuser -u laka -- env LAKA_DATA_DIR="$LAKA_DATA_DIR" LAKA_BACKUP_DIR="$LAKA_BACKUP_DIR" LAKA_RELEASE="$LAKA_RELEASE" /opt/laka-node/bin/node "$release/scripts/backup-sqlite.mjs")
    backup_dir=$(printf '%s' "$backup_result" | /opt/laka-node/bin/node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).snapshot))')
    [[ "$backup_dir" == "$LAKA_BACKUP_DIR/snapshot-"* && -f "$backup_dir/manifest.json" ]] || exit 1
fi
(cd "$release"; runuser -u laka -- env LAKA_DATA_DIR="$LAKA_DATA_DIR" /opt/laka-node/bin/node scripts/migrate-sqlite.mjs)
[[ -f "$LAKA_DATA_DIR/owner.json" ]] || { echo 'Initialize owner.json before activating the service'; exit 2; }
sed -i "s/^LAKA_RELEASE=.*/LAKA_RELEASE=$commit/" /etc/laka-warehouse.env
ln -sfn "$release" "$base/current.new"
mv -Tf "$base/current.new" "$base/current"
install -m 644 "$release/deploy/laka-warehouse.service" /etc/systemd/system/laka-warehouse.service
install -m 644 "$release/deploy/laka-warehouse-backup.service" /etc/systemd/system/laka-warehouse-backup.service
install -m 644 "$release/deploy/laka-warehouse-backup.timer" /etc/systemd/system/laka-warehouse-backup.timer
sed 's@/var/log/laka-kho/@/var/log/laka-warehouse/@' "$release/deploy/laka-kho.logrotate" > /etc/logrotate.d/laka-warehouse
systemctl daemon-reload
systemctl enable laka-warehouse.service laka-warehouse-backup.timer >/dev/null
systemctl restart laka-warehouse.service
systemctl start laka-warehouse-backup.timer
for attempt in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/api/health | grep -q "\"release\":\"$commit\""; then
        echo "Release active: $commit"
        rm -f /run/laka-warehouse-maintenance
        maintenance=0
        # Retain this release and the two most recently installed older versions.
        kept=0
        while read -r old; do
            [[ "$old" =~ ^[a-f0-9]{40}$ ]] || continue
            [[ "$old" == "$commit" ]] && continue
            kept=$((kept+1))
            if [[ $kept -gt 2 && -d "$base/releases/$old" && ! -L "$base/releases/$old" ]]; then rm -rf -- "$base/releases/$old"; fi
        done < <(find "$base/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | cut -d ' ' -f 2)
        exit 0
    fi
    sleep 1
done
echo 'Health check failed; rollback will run before leaving maintenance.' >&2
exit 1
