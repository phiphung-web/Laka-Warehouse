# Danh mục và phân tích luồng hàng

Thêm mặt hàng mặc định tự cấp mã theo khu sử dụng và loại quản lý, ví dụ BP-TH-0001. Có thể chuyển sang nhập mã thủ công. Mã đã có luôn giữ nguyên khi sửa phân loại để bảo toàn lịch sử. Đơn vị mặc định Cái, nhóm mặc định Chung; quy đổi và ghi chú nằm trong phần nâng cao.

Số lượng ban đầu là tùy chọn ngay khi tạo mã. Bỏ trống không ghi tồn; nhập 0 tạo mốc xác nhận hết hàng. Tạo mã và phiếu số dư được lưu nguyên tử, gửi lại cùng yêu cầu không tạo trùng. Với mã đã có, điều chỉnh bằng phiếu kiểm kê có lý do.

Khu sử dụng mô tả nơi dự kiến dùng hàng. Khu thực tế mô tả nơi đang giữ hàng; hai trường được lọc độc lập trong tồn kho và báo cáo.

Phân tích luồng hàng đọc toàn bộ ledger, gồm tồn đầu, nhập mua, chuyển/trả giữa khu, tiêu hao, hỏng, mất/hủy, trả NCC, kiểm kê và đảo phiếu. Tồn đầu cộng biến động thuần bằng tồn cuối. Chuyển nội bộ không được tính là nhập mua. Số liệu tách theo đơn vị, mặt hàng, khu và tình trạng; không cộng cái với kg hoặc suy diễn giá trị hàng tồn.

CSV xuất toàn bộ báo cáo theo bộ lọc máy chủ, không bị giới hạn bởi trang hiển thị. Báo cáo có luồng chuyển khu và thống kê từng ngày. Hàng nhập rồi xuất hết vẫn có mặt dù tồn cuối bằng 0. Danh sách lịch sử gần đây vẫn giới hạn 500 phiếu; báo cáo và số phiếu hôm nay không chịu giới hạn này.

Hướng dẫn nhập mốc từ file nằm ở IMPORTER.md. Google Sheets dùng CSV; chưa có đồng bộ hai chiều. Giữ nguyên lịch sử nghiệp vụ và provenance khi xoay vòng log kỹ thuật.
