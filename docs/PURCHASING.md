# Nhà cung cấp, chứng từ mua và thanh toán

Phiên bản này phục vụ chứng từ nội bộ tự in hoặc lưu PDF cho việc mua từ NCC nhỏ lẻ.

## Luồng sử dụng

1. Vào **Nhà cung cấp → Thêm NCC**. Bắt buộc mã và tên. Có thể bổ sung người liên hệ, điện thoại/Zalo, email, địa chỉ, nhóm hàng, ngân hàng, số tài khoản, chủ tài khoản, số ngày được nợ và ghi chú. MST là tùy chọn.
2. Khi hàng đến, ghi **Lập phiếu → Nhập mua**, chọn đúng nơi nhận thực tế. Có thể chọn tên NCC đã lưu. Phiếu này ghi số lượng tồn, chưa ghi nợ nhà cung cấp.
3. Vào **Mua hàng & công nợ → Lập chứng từ mua**. Chọn NCC, ngày, hạn trả, bên mua và các dòng hàng. Có thể lấy dòng từ phiếu nhập đã có; phải bổ sung đơn giá còn thiếu và kiểm tra đúng NCC. Có thể nhập hàng ngoài danh mục trên chứng từ; nếu muốn theo dõi tồn phải tạo mã hàng riêng và lập phiếu nhập.
4. Xem lại tổng tiền sau giảm giá và phí thêm, rồi xác nhận. Chứng từ ghi công nợ, không tăng tồn lần nữa.
5. Mở chứng từ → **Ghi trả tiền** cho từng lần trả: ngày, số tiền, tiền mặt/chuyển khoản/khác, mã chuyển khoản và ghi chú.
6. Chọn **In / Lưu PDF**, rồi chọn máy in hoặc “Lưu dưới dạng PDF” trong hộp thoại in của trình duyệt.

Nếu đặt cọc trước khi nhận hàng: lập chứng từ mua vào ngày đặt mua, ghi khoản cọc trong Ghi trả tiền. Khi hàng đến, lập phiếu nhập riêng rồi gắn phiếu nhập vào chứng từ mua. Liên kết chỉ phục vụ đối chiếu; hệ thống chưa tự tính mức đã nhận đủ/một phần theo từng dòng.

## Trạng thái và công nợ

- Chưa thanh toán: chưa trả đồng nào và tổng phải trả lớn hơn 0.
- Trả một phần: đã trả một phần, còn nợ.
- Đã thanh toán: số trả ròng bằng tổng phải trả; chứng từ có tổng 0 cũng được xem đã thanh toán.
- Quá hạn: còn nợ và hạn trả trước hôm nay, theo giờ Việt Nam. Không có hạn trả thì không tự kết luận quá hạn.
- Đã hủy: giữ nguyên chứng từ để tra cứu, không cộng vào tổng mua/công nợ.

Ví dụ tổng 2.000.000 đ, trả 500.000 đ rồi 1.500.000 đ: nợ giảm từ 2.000.000 → 1.500.000 → 0; trạng thái đổi tương ứng. Người dùng không sửa trạng thái bằng tay.

NCC ngừng giao dịch không tạo chứng từ mới, nhưng vẫn thanh toán và đối soát nợ cũ được.

## Sửa sai

Chứng từ đã xác nhận không sửa/xóa nội dung. Thông tin NCC và dòng hàng được chụp tại lúc lập; sửa danh mục NCC không đổi chứng từ cũ.

- Ghi nhầm khoản trả: chọn **Đảo lần trả**, ghi lý do, rồi ghi khoản đúng. Đảo toàn bộ lần trả và giữ dòng gốc. Chỉ ghi đảo nếu là lỗi ghi chép hoặc đã thực nhận lại tiền; nút này không chuyển tiền ngân hàng.
- Sai chứng từ: nếu còn thanh toán trên chứng từ, phải đối soát và đảo các khoản trả trước khi hủy. Nếu cần chuyển khoản trả sang chứng từ thay thế, ghi lại trên chứng từ đúng và nêu tham chiếu cũ, không coi là trả tiền lần hai.
- Hủy chứng từ mua không đảo hàng đã nhập. Sai số lượng kho phải xử lý ở phiếu kho. Phiếu nhập đã đảo được đánh dấu trong chứng từ mua liên quan để đối soát.
- Một phiếu nhập chỉ gắn vào một chứng từ mua còn hiệu lực. Số chứng từ của cùng NCC không được lặp ở hai chứng từ đang hiệu lực.

## Báo cáo và giới hạn

Lọc chứng từ theo ngày, NCC, trạng thái, khoản còn nợ hoặc quá hạn. Tổng tiền mua, đã trả, còn nợ và quá hạn tính theo tập chứng từ đang lọc, ở trạng thái thanh toán hiện tại. Đây chưa phải báo cáo số dư công nợ tại một ngày quá khứ.

Xuất CSV chứng từ/công nợ theo bộ lọc. CSV lịch sử trả tiền dùng khoảng ngày trả/đảo và NCC, độc lập với trạng thái chứng từ và ô tìm kiếm. File JSON sao lưu v2 bao gồm NCC, chứng từ, khoản trả, hủy và liên kết phiếu nhập.

Chưa có hóa đơn điện tử, lệnh chuyển tiền ngân hàng, phiếu giảm trừ cho hàng trả một phần, hoàn tiền một phần, nhập ngược CSV, thanh toán gộp nhiều chứng từ hoặc xử lý số tiền ứng dư ngoài giá trị chứng từ. Những trường hợp này cần bổ sung nghiệp vụ trước khi dùng, không tự giả lập bằng xóa chứng từ.

Giao diện chọn phiếu nhập sử dụng 500 phiếu kho gần nhất đang tải. Chưa có tìm kiếm phiếu cũ trực tiếp trên server. Chứng từ và các lần trả tiền hiện được tải đầy đủ; chưa có lưu trữ lạnh hoặc phân trang truy vấn phía server.
