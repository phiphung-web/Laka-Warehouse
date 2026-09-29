# Hướng dẫn chạy Baseline Importer

Script `scripts/import-source-opening.mjs` nhập dữ liệu mốc tồn ban đầu từ file `source-data.json` vào kho dữ liệu SQLite.

## Chế độ Dry-run (Mặc định)

Mặc định chạy ở chế độ kiểm tra (dry-run), không ghi vào cơ sở dữ liệu:

```bash
node scripts/import-source-opening.mjs
```

Tùy chọn:
- `--dir <path>`: Thư mục chứa `source-data.json` và `warehouse.sqlite` (mặc định lấy `LAKA_DATA_DIR` hoặc `data`).
- `--source <path>`: Đường dẫn trực tiếp đến file JSON nguồn.
- `--db <path>`: Đường dẫn trực tiếp đến database SQLite.
- `--location-mode <by-sheet|central>`: Chế độ phân bổ khu (`by-sheet`: theo từng tab và nhãn khu hằng ngày; `central`: tập trung về `KHO_TONG`).
- `--purchase-tabs-only`: Chỉ lấy bốn tab NhapKho_Homestay, NhapKho_BuongPhong, NhapKho_Nhahang, NhapKho_Cafe. Báo cáo ghi rõ các dòng ngoài phạm vi; file nguồn giữ nguyên. Dùng phạm vi này cho mốc bốn khu đã thống nhất.
- `--date YYYY-MM-DD`: Ngày hiệu lực của mốc ban đầu, mặc định hôm nay theo giờ Việt Nam, không nhận ngày tương lai.

Kết quả trả về JSON báo cáo số dòng: `valid`, `unresolved`, `created`, `conflicts`, `skipped` cùng tổng hợp số lượng theo đơn vị và khu.

## Chế độ Ghi thật (--apply)

Bắt buộc phải kèm cờ `--apply` và `--location-mode by-sheet|central`:

```bash
# Nhập theo từng khu tương ứng với tab nguồn
node scripts/import-source-opening.mjs --apply --location-mode by-sheet

# Hoặc nhập toàn bộ về kho tổng
node scripts/import-source-opening.mjs --apply --location-mode central
```

Tùy chọn ngày ghi nhận mốc kiểm kê:
```bash
node scripts/import-source-opening.mjs --apply --location-mode by-sheet --date 2026-09-28
```

## Lưu ý an toàn
- Nếu phát hiện bất kỳ dòng lỗi nào (`unresolved > 0` hoặc `conflicts > 0`), script lập tức hủy toàn bộ thao tác, không ghi dở dang.
- Bảo vệ dữ liệu vận hành: mọi dòng mới nhắm vào mặt hàng/khu đã có ledger đều bị chặn, kể cả nơi từng nhập mốc trước đây. Chỉ đúng dòng đã nhập với nội dung không đổi mới được bỏ qua.
- Các dòng đã import chính xác trước đó sẽ tự động được bỏ qua (`skipped`), không tạo phiếu trùng lặp.
- Thay đổi nội dung, khu được kế thừa từ dòng trước, chế độ nhận hàng, dòng bị xóa hoặc lặp mã dòng đều được phát hiện. Dry-run mở database chỉ đọc; apply khóa ghi từ khi lập kế hoạch và ghi toàn bộ trong một transaction.
- Khu sử dụng được gán cho mã chưa phân khu khi nguồn chỉ ra duy nhất một khu. Nơi nhận thực tế vẫn độc lập; ở chế độ central hàng về kho tổng nhưng khu sử dụng vẫn theo nguồn.
- Mốc này là COUNT theo lượng nhập trong file, không phải chứng minh số thực đếm; không tạo hóa đơn mua hoặc công nợ lịch sử. Tab XuatKho_PhanBo không được cộng thành hàng nhập.

Ví dụ chạy xem trước rồi áp dụng mốc bốn khu (sau khi sao lưu):

```bash
node scripts/import-source-opening.mjs --location-mode by-sheet --purchase-tabs-only
node scripts/import-source-opening.mjs --apply --location-mode by-sheet --purchase-tabs-only
```
