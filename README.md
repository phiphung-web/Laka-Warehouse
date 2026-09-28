# LAKA Kho

Ứng dụng quản lý kho dành cho một người quản lý, sử dụng trên web điện thoại và máy tính.

## Phạm vi đã triển khai

- Nhập mua tại kho tổng hoặc giao thẳng một khu.
- Phiếu nhiều mặt hàng; lưu nháp; xem lại trước khi ghi.
- Cấp/chuyển khu và nhận trả từ khu.
- Tiêu hao đối với hàng đã phân loại tiêu hao.
- Chuyển hàng dùng được sang hỏng/chờ xử lý; mất/hủy; trả nhà cung cấp.
- Kiểm kê tuyệt đối theo khu, mặt hàng, lô, hạn dùng và tình trạng.
- Đảo phiếu để sửa sai, giữ nguyên phiếu gốc.
- Danh mục, đơn vị gốc, một đơn vị đóng gói quy đổi trên mỗi mặt hàng.
- Quản lý khu; mức tối thiểu theo hàng/khu; cảnh báo lô trong 30 ngày hoặc quá hạn.
- Lịch sử mua nguồn riêng biệt; xuất CSV; sao lưu JSON toàn bộ dữ liệu.
- Hồ sơ NCC có thông tin liên hệ, ngân hàng, nhóm hàng và thời hạn thanh toán.
- Chứng từ mua nội bộ có nhiều dòng, giảm giá, phí thêm; in hoặc lưu PDF qua hộp thoại in.
- Ghi từng lần trả tiền, tính chưa trả/trả một phần/đã trả và khoản nợ quá hạn; đảo khoản trả, hủy chứng từ có lưu lịch sử.
- Báo cáo chứng từ, công nợ theo NCC và CSV lịch sử thanh toán. Xem hướng dẫn chi tiết tại `docs/PURCHASING.md`.

## Khởi tạo

1. Kiểm tra tên các khu tại Thiết lập. Bảy khu ban đầu được lấy theo phạm vi thể hiện trong file nguồn, có thể đổi tên hoặc thêm.
2. Tại Danh mục hàng, xác nhận tên, đơn vị gốc, quy cách và loại quản lý. 140 mã từ nguồn được giữ nguyên, chưa tự phân loại.
3. Kiểm tra hai mã VT022/VT023 đang cùng tên và đơn vị trong nguồn. Không tự gộp khi chưa xác định quy cách.
4. Kiểm kê từng khu. Số lượng nhập là số thực đếm, không phải số chênh lệch. Nhập 0 khi đã kiểm tra và không còn.
5. Nếu theo lô hoặc tình trạng, mỗi tổ hợp có một dòng riêng. Kiểm kê chỉ thay đổi các dòng đã đưa vào phiếu.
6. Sau khi xác nhận số dư, bắt đầu ghi phát sinh thực tế. Không nhập lại mua hàng cũ trước thời điểm kiểm kê như giao dịch mới.
7. Tạo NCC và chứng từ mua từ thời điểm bắt đầu đối soát công nợ. Lịch sử mua cũ không tự thành khoản nợ hiện tại; cần xác nhận với NCC trước khi ghi nợ.

## Các nguyên tắc số tồn

Hệ thống lưu số lượng theo đơn vị gốc, độ chính xác 0,001. Một giao dịch có thể tạo nhiều dòng sổ: chuyển khu có một dòng giảm và một dòng tăng. Hàng hỏng được giữ ở cùng khu với tình trạng riêng; không bị coi là đã mất.

Tồn ghi sổ = tổng các dòng sổ đã ghi cho đúng mặt hàng, khu, tình trạng, lô và hạn dùng. Kiểm kê tạo chênh lệch giữa số thực đếm và số ghi sổ hiện tại. Số âm bị từ chối ở cả nghiệp vụ và cơ sở dữ liệu.

Mặt hàng/lô chưa xác nhận số dư được đánh dấu “Chưa kiểm kê”. Nhập mua vẫn ghi được, nhưng xuất chỉ thực hiện sau khi đã xác nhận số dư ở nguồn xuất. Một mặt hàng được kiểm kê tại một khu không có nghĩa đã kiểm kê toàn homestay.

Lịch sử từ file cũ chỉ dùng tham chiếu; không tham gia tính tồn. Dữ liệu gồm 140 mã hàng và 331 dòng có tên hàng trong các tab nhập, nhập hằng ngày và phân bổ đã đọc. Đây là ảnh chụp dữ liệu ngày 27/09/2026, không phải kết nối đồng bộ.

## Giá nhập

Đơn giá tính trên đơn vị người dùng chọn trong dòng phiếu. Nếu chưa có giá, để trống; ứng dụng đánh dấu thiếu giá và hiển thị giá trị đã nhập. Số 0 là giá được nhập rõ ràng, ví dụ hàng tặng.

Ứng dụng chưa tính giá vốn bình quân/FIFO, kế toán, công nợ nhà cung cấp hoặc thanh toán. Giá trị phiếu mua không phải giá trị hàng còn tồn.

## Sửa sai

Phiếu đã ghi không được sửa hoặc xóa trực tiếp. Dùng Đảo phiếu rồi lập lại đúng. Đảo phiếu phải còn đủ hàng ở vị trí liên quan; mỗi phiếu chỉ đảo một lần. Phiếu kiểm kê không đảo: kiểm kê lại với lý do, tạo chênh lệch mới.

Nếu báo dữ liệu đã thay đổi ở cửa sổ khác, quay lại, tải lại dữ liệu, xem lại số lượng rồi xác nhận. Khi mạng lỗi sau khi gửi, thử lại cùng phiếu; mã yêu cầu được dùng để chống ghi trùng.

## Google Sheets và sao lưu

- CSV Danh mục: mã, tên, đơn vị, quy đổi và trạng thái.
- CSV Phiếu: mỗi dòng là một mặt hàng trong phiếu; đây không phải sổ để cộng tồn theo khu.
- CSV Sổ phát sinh: tăng/giảm theo khu, tình trạng và lô, phù hợp đối soát.
- CSV Tồn kho: bảng đang xem tại một khu, có trạng thái xác nhận.
- JSON: toàn bộ bảng vận hành, nhật ký, nguồn tham chiếu và thang số lượng 1000.

Nhập CSV vào Google Sheets qua Tệp → Nhập → Tải lên, dấu phân cách phẩy. Hiện không có đồng bộ tự động hai chiều, không có nhập ngược CSV hay nút khôi phục JSON. Khôi phục cần kiểm tra kỹ thuật và đối soát trước khi thay dữ liệu.

## Truy cập

Khi phát hành, site phải ở chế độ riêng tư cho chủ sở hữu. Backend kiểm tra tài khoản ở từng yêu cầu và chỉ cho người quản lý đã khởi tạo dùng kho. Không có chức năng mời nhân viên hoặc cấp quyền trong phiên bản này. Việc xây dựng và kiểm thử cục bộ không đồng nghĩa ứng dụng đã được phát hành trực tuyến.

Cần mạng để tải và lưu. Có cảnh báo khi rời trang với phiếu đang soạn; hãy lưu nháp. Trình duyệt không giữ số tồn chính thức.

## Mở rộng

Các bước có thể bổ sung theo nhu cầu thực: phân quyền nhân viên theo khu, xác nhận nhận hàng, nhập danh mục có bản xem trước, đồng bộ Sheets một chiều, định mức phòng/bộ setup, barcode, quản lý tài sản có mã riêng, mua hàng/công nợ, báo cáo giá vốn.

Các phần trên là hướng phát triển, chưa kích hoạt.
