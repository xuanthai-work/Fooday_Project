# Task Archive: Smart Search with Instant Tags & Multi-Field Accent-Insensitive Matching

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Nâng cấp thanh tìm kiếm tại Trang Chủ (`HomeView.tsx`) thành **Thanh Tìm Kiếm Thông Minh (Smart Search)**:
- **Tìm kiếm đa trường không dấu (Accent-Insensitive Multi-Field Search)**: Quét và khớp đồng thời trên `item.name` (loại món), `item.restaurant` (tên quán), `item.tag`, `item.address` (địa chỉ) và `item.review_note`. Hỗ trợ gõ tiếng Việt có dấu lẫn không dấu (ví dụ: `bun`, `chay`, `nuong`, `han` đều tìm ra kết quả chính xác).
- **Hàng Tag gợi ý 1-chạm (Instant Quick Tags)**: Bổ sung thanh tag cuộn ngang (`🍜 Bún & Phở`, `🍚 Cơm`, `🇰🇷 Đồ Hàn`, `🥗 Đồ Chay`, `🥩 Nướng & Lẩu`, `☕ Cà phê`, `🧋 Trà sữa`, `🍟 Ăn vặt`) ngay dưới ô tìm kiếm. Người dùng chạm 1 cái để lọc ngay, chạm lại để bỏ lọc.
- **Tối giản giao diện**: Giữ thanh search sạch sẽ (không có nút Hỏi AI), hiển thị số lượng kết quả tìm thấy (`Tìm thấy X quán`) và Empty state thân thiện khi không có quán nào khớp.

---

## 2. Thay đổi chi tiết

### Giao diện & Xử lý Tìm kiếm (`fooday_frontend/src/components/HomeView.tsx`)
- Thêm hàm chuẩn hóa tiếng Việt:
  ```ts
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  ```
- Nâng cấp điều kiện lọc `filteredFoods`:
  - Khớp khi bất kỳ trường nào trong `[item.name, item.restaurant, item.tag, item.address, item.review_note]` chứa chuỗi tìm kiếm đã normalize.
- Thêm dải `QUICK_TAGS` cuộn ngang:
  - Hiển thị các tag món phổ biến kèm emoji sinh động.
  - Chạm vào tag kích hoạt lọc ngay lập tức, nút tag chuyển viền gradient tím nổi bật `var(--grad-primary)`.
- Hiển thị dòng trạng thái kết quả tìm kiếm (`.search-status`).
- Tối ưu Empty state khi không có quán khớp từ khóa với icon tìm kiếm và thông báo rõ ràng.

### Đa ngôn ngữ (`fooday_frontend/src/i18n/translations.ts`)
- Bổ sung các chuỗi: `quickSearchHint`, `noResultsFound`, `foundResults` cho cả tiếng Việt và tiếng Anh.

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo an toàn tiến trình dev |
