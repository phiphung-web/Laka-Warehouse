# Danh mục và phân tích luồng hàng

Thêm mặt hàng mặc định tự cấp mã theo khu sử dụng và loại quản lý, ví dụ BP-TH-0001. Có thể chuyển sang nhập mã thủ công. Mã đã có luôn giữ nguyên khi sửa phân loại để bảo toàn lịch sử. Đơn vị mặc định Cái, nhóm mặc định Chung; quy đổi và ghi chú nằm trong phần nâng cao.

Số lượng ban đầu là tùy chọn ngay khi tạo mã. Bỏ trống không ghi tồn; nhập 0 tạo mốc xác nhận hết hàng. Tạo mã và phiếu số dư được lưu nguyên tử, gửi lại cùng yêu cầu không tạo trùng. Với mã đã có, điều chỉnh bằng phiếu kiểm kê có lý do.

Khu sử dụng mô tả nơi dự kiến dùng hàng. Khu thực tế mô tả nơi đang giữ hàng; hai trường được lọc độc lập trong tồn kho và báo cáo.

Phân tích luồng hàng lấy khu nhận/đang giữ làm trục chính. Mỗi thẻ khu đếm số mã đã nhập từ NCC, chuyển/trả đến, kiểm kê thay đổi và hiện còn tồn. Đây là **số mã**, không phải tổng số lượng. Bảng chi tiết sắp theo khu rồi tới mặt hàng; số lượng luôn kèm đơn vị của mặt hàng, không cộng cái với kg hoặc suy diễn giá trị hàng tồn.

Tab "Hàng từ đâu đến đâu" cho thấy NCC → khu nhận đối với phiếu nhập mua, khu xuất → khu nhận đối với phiếu chuyển/trả, và khu xuất → nơi xử lý đối với tiêu hao, mất/hủy, trả NCC. Mỗi tuyến hiển thị mặt hàng, tổng số lượng, số phiếu và ngày gần nhất; có CSV tuyến hàng riêng. Phiếu đã bị đảo không còn là tuyến hiệu lực. Số dư đầu từ file cũ là phiếu kiểm kê tại khu tương ứng, không được gán nhầm thành nhập từ NCC. Bộ lọc khu bao gồm các tuyến chuyển có khu đó ở đầu đi hoặc đầu nhận.

Báo cáo đọc toàn bộ ledger, gồm tồn đầu, nhập mua, chuyển/trả giữa khu, tiêu hao, hỏng, mất/hủy, trả NCC, kiểm kê và đảo phiếu. Tồn đầu cộng biến động thuần bằng tồn cuối. Chuyển nội bộ không được tính là nhập mua. Tab biến động theo ngày tách theo khu và mặt hàng; nguồn dữ liệu giữ riêng đơn vị, tình trạng và nhóm hàng.

CSV xuất toàn bộ báo cáo theo bộ lọc máy chủ, không bị giới hạn bởi trang hiển thị. Báo cáo có luồng chuyển khu và thống kê từng ngày. Hàng nhập rồi xuất hết vẫn có mặt dù tồn cuối bằng 0. Danh sách lịch sử gần đây vẫn giới hạn 500 phiếu; báo cáo và số phiếu hôm nay không chịu giới hạn này.

Hướng dẫn nhập mốc từ file nằm ở IMPORTER.md. Google Sheets dùng CSV; chưa có đồng bộ hai chiều. Giữ nguyên lịch sử nghiệp vụ và provenance khi xoay vòng log kỹ thuật.
