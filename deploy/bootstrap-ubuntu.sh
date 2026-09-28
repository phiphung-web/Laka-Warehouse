#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx curl ca-certificates xz-utils git python3-venv logrotate
id laka >/dev/null 2>&1 || useradd --system --home /var/lib/laka-warehouse --shell /usr/sbin/nologin laka
install -d -m 755 /opt/laka-warehouse /opt/laka-warehouse/releases /var/www/laka-acme
install -d -o laka -g laka -m 700 /var/lib/laka-warehouse /var/backups/laka-warehouse
install -d -o laka -g laka -m 750 /var/log/laka-warehouse
for file in application.log error.log; do touch "/var/log/laka-warehouse/$file"; chown laka:laka "/var/log/laka-warehouse/$file"; chmod 640 "/var/log/laka-warehouse/$file"; done
if [[ ! -x /opt/laka-node/bin/node ]]; then
    temp=$(mktemp -d /tmp/laka-node.XXXXXX)
    curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temp/SHASUMS256.txt"
    node_file=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ {print $2}' "$temp/SHASUMS256.txt")
    [[ "$node_file" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$ ]] || exit 1
    curl -fsSL "https://nodejs.org/dist/latest-v24.x/$node_file" -o "$temp/$node_file"
    (cd "$temp"; grep "  $node_file\$" SHASUMS256.txt | sha256sum -c -)
    install -d -m 755 /opt/laka-node
    tar -xJf "$temp/$node_file" -C /opt/laka-node --strip-components=1 --no-same-owner
fi
if [[ ! -x /opt/laka-certbot/bin/certbot ]]; then python3 -m venv /opt/laka-certbot; /opt/laka-certbot/bin/pip -q install 'certbot>=5.4,<6'; fi
if [[ ! -f /etc/laka-warehouse.env ]]; then
    cat > /etc/laka-warehouse.env <<'ENV'
LAKA_DATA_DIR=/var/lib/laka-warehouse
LAKA_BACKUP_DIR=/var/backups/laka-warehouse
LAKA_PUBLIC_ORIGIN=https://139.180.223.190
LAKA_RELEASE=bootstrap
ENV
    chown root:laka /etc/laka-warehouse.env
    chmod 640 /etc/laka-warehouse.env
fi
echo 'Prerequisites ready. Application and TLS activation are separate verified steps.'
