# Git, VPS và dữ liệu

Repository: https://github.com/phiphung-web/Laka-Warehouse. Repo công khai chỉ lưu mã nguồn, kiểm thử và cấu hình. Remote cũ `previous-laka-kho` được giữ nguyên.

## Kiến trúc

Ubuntu 24.04, Node.js 24, Next.js standalone, SQLite WAL và Nginx. Truy cập https://139.180.223.190 bằng tài khoản quản lý riêng; mật khẩu băm scrypt, cookie ký có hạn 12 giờ, kiểm tra Origin và giới hạn đăng nhập. Ứng dụng chạy bằng tài khoản Linux `laka`, chỉ nghe 127.0.0.1:3000. Heap giới hạn 384 MB, service tối đa 700 MB, VPS có swap. Build trên GitHub Actions để giảm tải VPS 1 GB.

## Phát hành

- Push `main`: GitHub Actions kiểm thử nghiệp vụ, build, chạy API với dữ liệu giả, thử khôi phục, đóng gói và phát hành `vps-<commit>` kèm SHA-256. Gói có kiểm tra loại trừ dữ liệu/bí mật.
- VPS cập nhật khi chạy `bash /root/update-server.sh <40 ký tự commit>`. Không tự cập nhật ngay sau push.
- Chương trình: `/opt/laka-warehouse/releases/<commit>`; symlink `current` chọn bản đang chạy; giữ ba bản gần nhất.
- Cập nhật bật bảo trì, dừng ghi, backup, migration, chuyển bản mới và kiểm health đúng commit. Nếu lỗi, khôi phục DB trước cập nhật và chương trình cũ. Chỉ bỏ bảo trì khi phục hồi thành công.
- Không đặt SSH private key hoặc mật khẩu GitHub trên VPS/GitHub. Server tải gói công khai đã qua kiểm thử.

Lần đầu chạy `deploy/bootstrap-ubuntu.sh` bằng root. Chạy update để chuẩn bị DB; script dừng nếu chưa có owner. Tạo tài khoản bằng:

```bash
LAKA_DATA_DIR=/var/lib/laka-warehouse /opt/laka-node/bin/node /opt/laka-warehouse/releases/<commit>/scripts/manage-owner.mjs init --username quanlykho --credentials-file /root/laka-credentials.txt
```

Chép snapshot riêng vào `/var/lib/laka-warehouse/source-data.json` trước lần mở kho đầu tiên. Đặt owner `laka:laka`, quyền 600 cho owner.json/source-data.json, rồi chạy update lại. `deploy/enable-https.sh` cài HTTPS IP và timer gia hạn hai lần/ngày, mở cổng 80/443 nếu UFW đang bật. Chứng chỉ IP có hạn sáu ngày: [tài liệu Let's Encrypt](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).

## Dữ liệu riêng và lưu trữ

- `/var/lib/laka-warehouse/warehouse.sqlite`: toàn bộ nghiệp vụ.
- `owner.json`: tài khoản; `source-data.json`: lịch sử tham chiếu, không tự tạo tồn đầu/nợ cũ.
- `/etc/laka-warehouse.env`: origin, đường dẫn và commit đang chạy.
- Không commit dữ liệu, .env, SSH key, log hoặc backup. Không lưu dữ liệu trong thư mục release.
- Log ứng dụng xoay hàng ngày, giữ 14 bản, nén; ngưỡng 10 MB được áp dụng ở lần chạy logrotate, không phải trần tức thời. Nginx dùng logrotate Ubuntu.
- Backup mỗi ngày khoảng 02:15–02:25 giờ Việt Nam, giữ 28 snapshot hoàn tất gần nhất; có thêm snapshot trước cập nhật, nên không nhất thiết bằng 28 ngày.
- Phiếu, sổ kho, chứng từ, thanh toán và audit nghiệp vụ được giữ. Dọn log không làm mất tổng/tóm tắt hoặc chi tiết đối soát. Chưa bật xóa chi tiết nghiệp vụ theo năm.

Backup dùng SQLite online backup, kiểm integrity trước khi nén và dọn bản cũ. Snapshot gồm SQLite, owner.json và nguồn tham chiếu. Backup cùng VPS không bảo vệ khi mất VPS; bản đầu được tải về máy quản lý khi triển khai. Chưa cấu hình đích sao lưu tự động ngoài VPS; cần tiếp tục tải snapshot/xuất JSON ra nơi riêng.

```bash
systemctl start laka-warehouse-backup.service
systemctl list-timers 'laka-*'
systemctl status laka-warehouse.service --no-pager
```

Khôi phục: bật `/run/laka-warehouse-maintenance`, dừng service, giữ dữ liệu hiện tại riêng, giải nén backup vào file tạm, kiểm integrity và phiên bản migration. Thay DB khi đã dừng, dọn WAL/SHM cũ, phục hồi owner/nguồn nếu cần, quyền 600 và owner laka:laka. Chạy release ghi trong manifest; kiểm health, đối chiếu số dư rồi mở lại. Không giải nén đè DB đang mở. Bộ kiểm thử giải nén ra DB khác, kiểm khóa ngoại và so sánh bảng kho/chứng từ/công nợ.

Đổi mật khẩu: cùng lệnh manage-owner nhưng dùng `reset --credentials-file <file riêng mới>`. Giữ ID chủ kho, đổi khóa phiên để đăng xuất các phiên cũ. Mật khẩu ngẫu nhiên chỉ ghi vào file riêng, không in trong log.
