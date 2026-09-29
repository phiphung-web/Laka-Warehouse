# Chia sẻ và đối chiếu kho

Quản lý mở **Báo cáo chia sẻ** từ thanh trên cùng. Trang này có bốn bảng:

1. **Tồn theo khu**: số lượng ghi sổ hiện tại cho từng mặt hàng, khu, lô và tình trạng. Bộ lọc khu giúp người nhận tìm nhanh khu mình phụ trách. Số nhập ban đầu lấy từ file nguồn chỉ là mốc chuyển dữ liệu, không phải số kiểm kê.
2. **Kiểm kê so với sổ**: số ghi sổ trước lần đếm gần nhất, số thực đếm, chênh lệch và phát sinh sau đó. Nếu chưa có lần kiểm kê thực tế, bảng ghi rõ “Chưa kiểm kê thực tế”. Kiểm kê đã ghi vào sổ nên tồn hiện tại có thể bằng số thực đếm cộng phát sinh sau kiểm kê; chênh lệch ở lần đếm vẫn được giữ để điều tra.
3. **Hóa đơn ↔ phiếu nhập**: so sánh số lượng của chứng từ mua với tổng phiếu nhập được gắn vào nó theo mã hàng. Nếu hóa đơn dùng đơn vị gốc, hệ thống cộng số nhập quy về đơn vị gốc đã lưu trên phiếu. Nếu hóa đơn dùng đơn vị đóng gói, chỉ so khi các phiếu nhập lưu đúng cùng đơn vị đó. Bảng đánh dấu thiếu phiếu nhập, lệch số lượng, hàng ngoài hóa đơn, tên NCC cần kiểm tra, đơn vị không quy đổi chắc chắn được hoặc phiếu nhập đã đảo.
4. **Phiếu nhập chưa gắn hóa đơn**: hàng đã ghi nhập kho nhưng chưa liên kết chứng từ mua. Cần vào **Mua hàng & công nợ** để gắn đúng phiếu; không tự ghép theo tên NCC hoặc ngày vì dễ gắn nhầm.

Người xem có thể lọc, tải CSV bảng đang xem hoặc chọn **In / PDF** để tự lưu PDF trong trình duyệt. Dữ liệu được tải lại bằng nút **Cập nhật**. Báo cáo là ảnh chụp ở thời điểm tải; người xem cần cập nhật lại sau khi quản lý ghi phiếu mới.

## Cấp quyền

Ở cuối trang, quản lý nhập tên người xem và chọn **Tạo tài khoản xem**. Hệ thống tạo tên đăng nhập và mật khẩu mạnh, hiển thị một lần. Gửi riêng hai thông tin này cùng địa chỉ `/login` cho người được xem. Người đó đăng nhập và được chuyển thẳng đến báo cáo. Không dùng chung tài khoản quản lý.

Chọn **Thu hồi** để vô hiệu tài khoản ngay, kể cả phiên đang mở. Tài khoản chỉ xem không gọi được API ghi phiếu, quản lý tài khoản, tải sao lưu đầy đủ hoặc xem trang quản lý. Danh sách tài khoản nằm ở `viewers.json` trong thư mục dữ liệu riêng của server, không thuộc Git; bản sao lưu định kỳ cũng lưu file này. Giữ bản sao lưu ở nơi riêng tư vì chứa mã băm mật khẩu và khóa phiên.

## Giới hạn đối chiếu

- Hóa đơn và số tồn hiện tại không được so trực tiếp: hàng có thể đã chuyển khu, tiêu hao, hỏng hoặc trả NCC sau khi nhập. Hai phép so sánh đúng là **hóa đơn ↔ phiếu nhập** và **thực đếm ↔ sổ tại thời điểm kiểm kê**.
- Chứng từ mua có dòng chưa gắn mã hàng hoặc đơn vị không quy đổi được sẽ hiện “Chưa đủ dữ liệu”, không tự nhận là khớp. Chứng từ mua cũ chưa được tạo trong ứng dụng không có ở bảng đối chiếu.
- Báo cáo kiểm tra số đã nhập vào hệ thống, không đọc ảnh/PDF hóa đơn gốc hay xác minh chữ ký/dấu NCC. Người quản lý phải đối chiếu chứng từ gốc khi cần xác nhận số NCC xuất.
- Mã hàng chưa có dòng tồn được đếm riêng, không tự hiển thị là 0. Lần kiểm kê đầu tiên cần ghi cả những mặt hàng thực tế bằng 0 tại khu cần xác nhận.
