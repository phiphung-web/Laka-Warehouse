# Git, server riêng và lưu trữ

## Trạng thái

Repository riêng tư: https://github.com/phiphung-web/laka-kho, nhánh `main`. Mã nguồn được quản lý bằng Git; snapshot Google Sheets, dữ liệu vận hành, log và bí mật không đưa vào repo. Chưa có máy chủ SSH, tên miền hoặc tài khoản triển khai được xác nhận. Không phát hành ứng dụng hoặc đưa dữ liệu kho lên Sites trong bước này.

Bản chạy hiện tại dùng Vinext/Cloudflare Worker, D1 và đăng nhập Sites. Đây chưa phải bản triển khai trực tiếp lên VPS Linux. Để chạy VPS cần chuyển adapter cơ sở dữ liệu, đăng nhập và tiến trình server; bổ sung HTTPS, backup/khôi phục và cấu hình dịch vụ. Không dùng chế độ đăng nhập giả lập của localhost để mở ra Internet.

## Mã nguồn và dữ liệu riêng

Git bỏ qua `lib/source-data.json`, cơ sở dữ liệu `.wrangler`, file SQLite, `.env`, log và backup. `npm ci` tạo file nguồn trống từ `lib/source-data.example.json` nếu chưa có. Script không ghi đè file riêng hiện có.

Để khởi tạo 140 mã và lịch sử nguồn, chép riêng snapshot đã giữ trên máy vào `lib/source-data.json` trước lần khởi tạo đầu. Snapshot này không chứa số tồn đã kiểm kê và không thay thế backup giao dịch. Không commit dữ liệu kho thật hoặc thông tin NCC/ngân hàng vào mã nguồn.

Sau khi có repository và server: dùng repo riêng tư; server có quyền đọc mã bằng deploy key riêng; build ở máy phát triển hoặc CI; nhận bản build theo commit; sao lưu DB trước migration; health check sau cập nhật. Cập nhật chương trình không xóa thư mục dữ liệu. Quay lại mã cũ không tự hạ phiên bản dữ liệu, nên migration cần tương thích hoặc có kế hoạch khôi phục.

## Chính sách dung lượng

1. Log kỹ thuật của ứng dụng/reverse proxy: xoay vòng, nén và giới hạn dung lượng. Mẫu `deploy/laka-kho.logrotate` giữ 14 bản, tách file khi đạt 10 MB trong lần chạy logrotate. Chưa cài hoặc kích hoạt trên server nào.
2. Sổ nhập/xuất, hóa đơn nội bộ, thanh toán, hủy/đảo và audit nghiệp vụ: giữ nguyên. Không chạy TTL hoặc DELETE theo ngày lên các bảng này.
3. Cache/file tạm: có thể hết hạn vì không phải số liệu gốc. Chưa triển khai lịch dọn file tạm trong ứng dụng này.
4. Dữ liệu lâu năm: chỉ chuyển sang kho lưu trữ sau khi có báo cáo chốt kỳ, bản sao chi tiết kiểm chứng được và thử khôi phục. Chưa bật tự động nén/xóa dữ liệu nghiệp vụ.
5. Sao lưu: cần bản ngoài VPS và kiểm thử khôi phục; lịch giữ phiên bản sẽ cấu hình khi biết nơi lưu trữ. Xuất JSON hiện là thao tác thủ công.

Giữ bản tóm tắt đơn thuần không đủ giải thích khoản nợ, lần trả tiền hoặc sai lệch hàng. Vì thế chưa xóa chi tiết nghiệp vụ để đổi lấy dung lượng. Mẫu dọn log chỉ tác động file `.log` ở thư mục chỉ định, không tác động database.
