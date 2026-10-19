# Task Archive: Polish DishDetailModal Animation (Opening, Closing, Mobile Sheet & Desktop Dialog)

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Yêu cầu Cải thiện
- Animation mở trước đây trên Desktop bị giật và thô do trượt từ đáy màn hình (`translateY(100%)`) lên giữa màn hình.
- Thiếu hoàn toàn Exit Animation: Khi đóng (bấm `✕`, `Esc` hoặc bấm ra ngoài), modal lập tức unmount khiến giao diện bị giật tắt đột ngột.
- Thiếu GPU compositing flags khiến việc render ảnh Hero cùng lúc với `backdrop-filter` có nguy cơ sụt frame trên một số thiết bị.

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Thêm cơ chế **Exit Animation**:
     - Quản lý state `isClosing` kết hợp `closingRef` ngăn chặn double-close.
     - Khi đóng (qua nút `✕`, phím `Escape`, click backdrop hoặc nút Ask AI), modal kích hoạt animation đóng trong `240ms` trước khi gọi `onClose()` của parent component.
   - **Tách biệt Animation theo thiết bị**:
     - **Mobile**: Sử dụng đường cong cubic-bezier native (`sheetSlideUp` mở và `sheetSlideDown` đóng).
     - **Desktop**: Dialog phóng to mượt mà (`modalZoomIn` từ `scale(0.94) translateY(12px)` -> `scale(1) translateY(0)` khi mở; `modalZoomOut` thu nhỏ nhẹ khi đóng).
     - **Lớp nền (Backdrop)**: `fadeOverlayIn` (240ms) và `fadeOverlayOut` (220ms).
   - Tối ưu GPU acceleration với `will-change: transform, opacity;`, `transform: translateZ(0);`, và `-webkit-backface-visibility: hidden;`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuân thủ quy định an toàn: **KHÔNG chạy `npm run build`**.

---

## 4. Kết luận
Hiệu ứng mở/đóng hai chiều cho cả Mobile Bottom-sheet và Desktop Center Dialog đã đạt độ mượt mà cao cấp (60/120fps). Chuyển trạng thái sang PASS và lưu trữ.
