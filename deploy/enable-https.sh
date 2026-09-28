#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 1
config_dir=$(cd -- "$(dirname -- "$0")" && pwd)
install -m 644 "$config_dir/nginx-http.conf" /etc/nginx/sites-available/laka-warehouse
if [[ -L /etc/nginx/sites-enabled/default && $(readlink -f /etc/nginx/sites-enabled/default) == /etc/nginx/sites-available/default ]]; then unlink /etc/nginx/sites-enabled/default; fi
ln -sfn /etc/nginx/sites-available/laka-warehouse /etc/nginx/sites-enabled/laka-warehouse
nginx -t
systemctl enable --now nginx
systemctl reload nginx
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then ufw allow 80/tcp; ufw allow 443/tcp; fi
/opt/laka-certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email --preferred-profile shortlived --webroot --webroot-path /var/www/laka-acme --ip-address 139.180.223.190 --cert-name 139.180.223.190
install -m 644 "$config_dir/nginx-https.conf" /etc/nginx/sites-available/laka-warehouse
nginx -t
systemctl reload nginx
install -m 644 "$config_dir/laka-cert-renew.service" /etc/systemd/system/laka-cert-renew.service
install -m 644 "$config_dir/laka-cert-renew.timer" /etc/systemd/system/laka-cert-renew.timer
systemctl daemon-reload
systemctl enable --now laka-cert-renew.timer
echo 'HTTPS and certificate renewal are active.'
