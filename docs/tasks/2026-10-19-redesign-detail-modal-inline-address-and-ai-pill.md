# Task Archive: Redesign Detail Modal — Inline Address Link, AI Pill Button & Remove Bottom Bar

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Tối ưu hóa không gian hiển thị của `DishDetailModal.tsx` nhằm giải phóng hoàn toàn tầm nhìn ở đáy màn hình, giúp trải nghiệm cuộn xem đánh giá và viết bình luận (YouTube-style reviews) mượt mà, không bị che khuất:
- **Địa chỉ**: Hiển thị text địa chỉ rõ ràng, toàn bộ hàng địa chỉ trở thành liên kết mở Google Maps (`target="_blank"`) kèm icon liên kết ngoài tinh tế.
- **Loại bỏ thanh cố định đáy**: Xóa bỏ hoàn toàn thanh `.detail-actions` cố định ở đáy (chứa 2 nút to chắn tầm nhìn).
- **Nút Hỏi Foodie AI**: Chuyển thành nút Pill nhỏ gọn (`✨ Hỏi AI`) đặt ngay cạnh điểm số sao ở phần tiêu đề (`.detail-head`), đồng thời tích hợp icon mini `✨` trên thanh mini header sticky khi cuộn full màn hình.

---

## 2. Thay đổi chi tiết

### Giao diện & Tương tác (`fooday_frontend/src/components/DishDetailModal.tsx`)
- **Khối địa chỉ (`.info-list`)**:
  - Chuyển thành thẻ `<a className="info-row info-row-link" href={mapsUrl} target="_blank">`.
  - Hiển thị text địa chỉ quán, fallback tên quán + chỉ đường nếu chưa có địa chỉ chi tiết.
  - Thêm icon `<ExternalLink size={15} />` tinh tế, bỏ nút tròn mũi tên rườm rà.
  - Hover / focus đổi màu nền `var(--surface-3)` và viền `var(--primary-soft)`.
- **Khối tiêu đề (`.detail-head`)**:
  - Gom nút `✨ Hỏi AI` và điểm sao `⭐ 4.0` vào cụm `.detail-head-actions`.
  - Nút `.ask-ai-pill`: thiết kế dạng capsule bo tròn, màu tím `var(--primary)` trên nền `var(--primary-soft)`, hover chuyển gradient tím `var(--grad-primary)`.
- **Thanh sticky mini header (`.sheet-sticky-bar`)**:
  - Bổ sung nút icon mini `sticky-ask-btn` (`<Sparkles size={16} />`) bên cạnh nút đóng `sticky-close`. Khi người dùng cuộn sâu xuống đọc bình luận, vẫn có thể bấm Hỏi AI bất cứ lúc nào.
- **Thanh cố định đáy (`.detail-actions`)**:
  - Gỡ bỏ hoàn toàn thẻ `<div className="detail-actions">` và toàn bộ CSS liên quan (`.act-primary`, `.act-secondary`).
  - Tối ưu lại padding đáy của `.detail-sheet` và `.detail-body`, giải phóng 100% không gian đáy cho người dùng đọc và gõ bình luận mà không lo bị che bàn phím ảo.

### Đa ngôn ngữ (`fooday_frontend/src/i18n/translations.ts`)
- Bổ sung các chuỗi mới: `askAiPill` ('Hỏi AI' / 'Ask AI') và `tapToOpenMaps` ('Chạm để xem bản đồ' / 'Tap to view on Google Maps').

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo an toàn tiến trình dev |
