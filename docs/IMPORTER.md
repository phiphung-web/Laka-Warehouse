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
- Bảo vệ dữ liệu vận hành: nếu mặt hàng tại khu đích đã có số dư phát sinh trước đó mà không phải từ đợt import này, script báo conflict và chặn ghi đè.
- Các dòng đã import chính xác trước đó sẽ tự động được bỏ qua (`skipped`), không tạo phiếu trùng lặp.
