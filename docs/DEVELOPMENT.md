# Kiến trúc và kiểm tra

## Cấu trúc

- app/application.tsx: điều hướng, tải trạng thái, phiếu đang soạn.
- app/voucher-form.tsx: nhập và xác nhận phiếu.
- app/stock-views.tsx: tồn, danh mục, khu và mức tối thiểu.
- app/history-views.tsx: lịch sử, đảo phiếu và xuất file.
- app/api/kho/route.ts: ranh giới xác thực, nguồn yêu cầu và JSON.
- lib/inventory.ts: quy tắc nghiệp vụ thuần, quy đổi và tạo các dòng ghi sổ.
- lib/server.ts: truy vấn SQLite có tham số, quyền người quản lý, ghi nguyên tử và chống trùng.
- db/schema.ts và drizzle/: cấu trúc và lịch sử thay đổi cơ sở dữ liệu.
- lib/source.ts: đọc nguồn riêng từ LAKA_DATA_DIR/source-data.json lúc chạy, không nhúng vào gói build.
- lib/commerce.ts: kiểm tra chứng từ, số tiền VND, trạng thái và báo cáo công nợ.
- lib/commerce-server.ts: lưu NCC, chứng từ, thanh toán, đảo/hủy, gắn phiếu nhập bằng batch nguyên tử.
- app/commerce-views.tsx: hồ sơ NCC, lập/in chứng từ, trả tiền và báo cáo.

Dữ liệu nguồn nằm ngoài Git và release. Chép source-data.json vào LAKA_DATA_DIR trước khi đăng nhập lần đầu. Không dùng Git để sao lưu dữ liệu vận hành.

## Tính toàn vẹn

Số lượng được lưu dưới dạng số nguyên nhân 1000. Ledger không sửa/xóa. Triggers cập nhật balances trong cùng giao dịch; ràng buộc ngăn số âm. Mỗi thao tác ghi có phiên bản dữ liệu dự kiến; trigger từ chối phiên bản cũ. SQLite batch bảo đảm phiếu, sổ và nhật ký thành công hoặc cùng hủy.

Idempotency của phiếu dùng UUID và nội dung yêu cầu đã lưu. Yêu cầu lặp cùng nội dung trả lại phiếu có sẵn; UUID giống nhưng nội dung khác bị từ chối.

Mã/tên/đơn vị/quy đổi/giá trong phiếu được chụp tại thời điểm ghi. Sửa danh mục không sửa nội dung phiếu đã xác nhận. Đơn vị gốc bị khóa khi mặt hàng đã phát sinh.

Mỗi dòng kiểm kê là một số đếm tuyệt đối của đúng tổ hợp hàng/khu/tình trạng/lô/hạn. Dòng không có trong phiếu không bị đưa về 0.

## Lệnh kiểm tra

Node 24:

    node tests/inventory.test.mjs
    node node_modules/typescript/bin/tsc --noEmit

Kiểm thử API cần server phát triển trên localhost:5173:

    node tests/api-smoke.mjs

Chỉ chạy api-smoke trên cơ sở dữ liệu thử nghiệm. Script tạo mã QA riêng và giữ lịch sử thử nghiệm, không chạy trên bản sản xuất.

## Kết quả đã kiểm tra

- 14 kiểm thử quy tắc và SQLite: chuyển khu, nhập thẳng, quy đổi, số dư chưa xác nhận, vượt tồn, kiểm kê 0, hàng hỏng, hàng tái sử dụng, trùng dòng, lô, ngày/số lượng, giá, ghi đồng thời, rollback và lịch sử không sửa/xóa.
- 18 kiểm tra qua API thực của bản cục bộ: tạo mã QA, kiểm kê, nhập thẳng theo thùng, cấp hàng, phát lại UUID, đổi nội dung cùng UUID, vượt tồn, hỏng, tiêu hao, đảo, đảo lần hai, định mức, phiên bản cũ, nháp, sao lưu, thiếu đăng nhập, nguồn yêu cầu sai.
- Kiểm tra TypeScript.
- Kiểm tra trình duyệt: bố cục desktop và điện thoại, tìm/chọn mặt hàng, xem lại phiếu, danh mục và tra cứu WebMCP với đầu vào đúng/sai.

Đây là kiểm tra trên dữ liệu cục bộ, không thay thế kiểm kê thực tế hoặc nghiệm thu với người quản lý.

## Bổ sung mua hàng và công nợ — 28/09/2026

- 15 kiểm thử của `node tests/commerce.test.mjs` chạy trực tiếp hàm nghiệp vụ/lưu dữ liệu với SQLite và toàn bộ migration: thông tin NCC tùy chọn, snapshot, giá/ngày, trạng thái, thanh toán nhiều lần, idempotency, revision, rollback, đảo/hủy, trùng chứng từ, gắn phiếu, ngừng NCC và tính bất biến.
- 12 kiểm tra `node tests/commerce-api-smoke.mjs` qua API và D1 local: NCC, chứng từ, trả một phần/đủ, retry, trả vượt, đảo/hủy, tồn không đổi và backup v2. Chứng từ QA được đảo thanh toán rồi hủy ở cuối; lịch sử vẫn giữ. Chỉ chạy trên localhost, không chạy dữ liệu thật.
- TypeScript kiểm tra thành công. Không kiểm tra giao diện hoặc chạy chụp màn hình theo yêu cầu của người dùng.

Migration 0001 thêm 6 bảng và các trigger bảo vệ. Không sửa migration đã áp dụng. Giữ nguyên số dư kho và sổ cũ. Tổng phải trả có thể phát sinh trước khi nhận hàng; liên kết receipt không tạo ledger.

Mã yêu cầu commerce có nội dung và kết quả lưu lại. Retry cùng mã/nội dung không tạo lần thanh toán mới; mã cũ với nội dung khác bị từ chối. Thanh toán và đảo/hủy là bản ghi mới, không sửa dòng gốc. Những bảng này không phải log kỹ thuật để dọn theo thời gian.

## VPS và kiểm thử hiện tại

Runtime: Next.js standalone, Node 24 và SQLite WAL; đăng nhập riêng tại /login. Không còn dùng Sites auth hoặc Cloudflare D1 trong luồng đang triển khai. File/script preview cũ được giữ làm lịch sử tham khảo.

33 kiểm thử nghiệp vụ/lưu trữ/auth đã đạt. Build và TypeScript đạt. Bộ tests/run-vps-api.mjs khởi chạy standalone trên localhost với DB/nguồn/tài khoản giả tách biệt; chạy 18 kiểm tra kho và 12 kiểm tra chứng từ, từ chối giả header đăng nhập/Origin sai, tạo backup rồi đối chiếu các bảng sau khôi phục. Không chạy script QA trên dữ liệu thật. Không kiểm tra giao diện theo yêu cầu người dùng.

Lệnh: node tests/inventory.test.mjs; node tests/commerce.test.mjs; node tests/auth.test.mjs; node tests/sqlite-adapter.test.mjs; npm run build; node tests/run-vps-api.mjs; npm run pack:vps.

Xem docs/GIT_SERVER_RETENTION.md cho triển khai. Migration có checksum, không sửa migration đã áp dụng. Release cũ được khôi phục cùng DB trước cập nhật nếu bản mới không khỏe.

API trạng thái trả tối đa 500 phiếu và 300 sự kiện gần nhất; API sao lưu xuất toàn bộ. Commerce hiện tải toàn bộ chứng từ/thanh toán. Khi dữ liệu tăng lớn cần phân trang server và xuất luồng. CSV có BOM UTF-8 và vô hiệu hóa công thức từ chuỗi bắt đầu bằng =, +, -, @.
