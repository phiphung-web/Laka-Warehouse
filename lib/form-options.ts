// Suggestions never change existing records or imply a unit conversion.
export const CATEGORIES=["Chung","Đồ vải","Chăn ga gối","Khăn và thảm","Đồ dùng phòng khách","Đồ dùng cá nhân cho khách","Hóa chất vệ sinh","Dụng cụ vệ sinh","Giấy và vật tư tiêu hao","Túi và bao bì","Dụng cụ bếp","Dụng cụ bàn ăn","Ly tách và đồ uống","Dụng cụ pha chế","Nguyên liệu pha chế","Cà phê và trà","Đồ uống đóng chai","Thực phẩm khô","Thực phẩm tươi sống","Thực phẩm đông lạnh","Gia vị và dầu ăn","Bánh kẹo và đồ ăn nhẹ","Thiết bị điện","Thiết bị điện tử","Thiết bị bếp","Thiết bị vệ sinh","Nội thất","Đồ trang trí","Văn phòng phẩm","Vật tư sửa chữa","Dụng cụ kỹ thuật","Vật tư điện nước","Đồ làm vườn","Đồ bảo hộ","Đồ sơ cứu","Thiết bị an toàn","Đồng phục","Dịch vụ và chi phí"];
export const UNITS=["Cái","Chiếc","Bộ","Đôi","Cặp","Chai","Lọ","Bình","Can","Lít","ml","Kg","g","Tấn","Gói","Túi","Bao","Bịch","Hộp","Thùng","Kiện","Khay","Vỉ","Lon","Cốc","Tách","Bát","Đĩa","Cuộn","Tờ","Tập","Quyển","Ram","Tấm","Miếng","Mét","m²","m³","Sợi","Cây","Thanh","Ống","Viên","Bóng","Bó","Bông","Chậu","Suất","Phần","Lần","Ngày","Tháng","Giờ","Công"];
export const PACK_UNITS=["Thùng","Hộp","Lốc","Kiện","Bao","Túi","Gói","Bịch","Vỉ","Khay","Bộ","Cuộn","Ram","Can"];
export const BANKS=["Vietcombank","BIDV","VietinBank","Agribank","MB Bank","Techcombank","ACB","VPBank","TPBank","Sacombank","HDBank","VIB","SHB","SeABank","MSB","OCB","Eximbank","LPBank","Bac A Bank","Nam A Bank","ABBank","VietABank","BVBank","KienlongBank","NCB","Saigonbank","PGBank","BaoViet Bank","Shinhan Bank","Woori Bank","HSBC","UOB","Standard Chartered"];
export const TERMS=["0","1","3","7","10","14","15","21","30","45","60","90"];
export const REASONS:Record<string,string[]>={
 RECEIPT:["Nhập mua bổ sung định kỳ","Nhận hàng giao thẳng tại khu sử dụng","Nhận hàng theo đơn đặt mua","Nhận hàng đổi từ nhà cung cấp"],
 TRANSFER:["Cấp bổ sung theo nhu cầu khu","Điều chuyển hàng giữa các khu","Bàn giao phục vụ khách / sự kiện"],
 RETURN:["Trả hàng chưa sử dụng về kho","Trả hàng dư sau sự kiện","Thu hồi hàng để kiểm tra"],
 CONSUME:["Sử dụng phục vụ khách lưu trú","Sử dụng vệ sinh buồng phòng","Sử dụng cho bếp / nhà hàng","Sử dụng pha chế tại Cafe","Sử dụng bảo trì / sửa chữa"],
 DAMAGE:["Hư hỏng trong quá trình sử dụng","Vỡ / rách / biến dạng","Chờ kiểm tra hoặc sửa chữa","Hỏng do bảo quản"],
 LOSS:["Hết hạn sử dụng, đã hủy","Hư hỏng không thể sử dụng, đã hủy","Mất trong quá trình sử dụng","Thiếu sau đối chiếu, đã xác minh"],
 SUPPLIER_RETURN:["Trả hàng sai quy cách","Trả hàng lỗi chất lượng","Trả hàng giao thừa","Trả theo thỏa thuận với nhà cung cấp"],
 COUNT:["Xác nhận số dư ban đầu","Kiểm kê định kỳ","Kiểm kê bàn giao","Kiểm kê sau đối chiếu chênh lệch"],
 REVERSAL:["Ghi trùng phiếu","Ghi sai số lượng","Ghi sai mặt hàng / khu nhận","Ghi sai ngày nghiệp vụ"],
 payment:["Đặt cọc theo thỏa thuận","Thanh toán một phần","Thanh toán phần còn lại","Thanh toán đủ chứng từ"],
 reversePayment:["Ghi trùng khoản thanh toán","Ghi sai số tiền thanh toán","Đã thực nhận lại tiền từ nhà cung cấp"],
 voidInvoice:["Lập trùng chứng từ","Sai thông tin nhà cung cấp","Sai dòng hàng hoặc số tiền","Hủy mua hàng theo thỏa thuận"],
 supplier:["Giao hàng theo lịch đã thống nhất","Thanh toán khi nhận đủ hàng","Đối chiếu công nợ cuối tháng"],
 invoice:["Mua hàng bổ sung định kỳ","Mua hàng phục vụ khách / sự kiện","Đối chiếu theo phiếu giao hàng"]
};
export function optionKey(value:string){return value.normalize("NFC").trim().replace(/\s+/g," ").toLocaleLowerCase("vi");}
export function mergeOptions(...lists:(string|undefined|null)[][]):string[]{
 const values=new Map<string,string>();
 for(const list of lists)for(const value of list){if(typeof value!=="string")continue;const label=value.trim().replace(/\s+/g," ");if(label&&!values.has(optionKey(label)))values.set(optionKey(label),label);}
 return [...values.values()];
}
export function splitCategories(value:string){return mergeOptions(value.split(/[;,]/));}
