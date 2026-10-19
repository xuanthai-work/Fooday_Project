# Task Archive: CS:GO-Style Case Opening Roulette for Random Food View

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Nâng cấp toàn diện màn hình "Ngẫu nhiên" (`RandomView.tsx`) từ hiệu ứng chuyển hình đơn điệu thành **Vòng quay mở hòm phong cách CS:GO / CS2 (CS:GO Case Opening Roulette / Horizontal Reel Spinner)**:
- Băng chuyền ngang trượt mượt mà với dải thẻ món ăn đa dạng (~40 món) được phân cấp độ hiếm (Rarity Tiers).
- Kim chỉ trung tâm (Center Pointer / Indicator) màu vàng kim neon phát sáng ở chính giữa khung nhìn.
- Vật lý quay chuẩn CS:GO: tăng tốc cực nhanh ban đầu, sau đó phanh giảm tốc mượt mà theo đường cong easing `cubic-bezier(0.12, 0.8, 0.15, 1)` kéo dài 5.2 giây.
- Hiệu ứng âm thanh Ticker Click chân thực bằng Web Audio API thuần, âm thanh thưa dần theo quán tính trượt.
- Độ lệch ngẫu nhiên nhẹ (`±randomShift`) quanh tâm thẻ tạo cảm giác mở hòm hồi hộp chân thực.
- Thẻ trúng giải bừng sáng hào quang vàng (`Glow gold`), hiển thị kết quả chi tiết kèm nút **"Xem chi tiết quán"** (mở `DishDetailModal`), nút **"Hỏi Foodie AI"**, nút **"Lưu yêu thích"** và nút **"Mở hòm khác"**.

---

## 2. Thay đổi chi tiết

### Giao diện & Trải nghiệm Roulette (`fooday_frontend/src/components/RandomView.tsx`)
- **Băng chuyền Roulette (`.roulette-box`, `.roulette-track`)**:
  - Khung nhìn ngang bo cong kim loại dark-tech, có 2 dải gradient fade mờ ở 2 mép trái/phải tạo hiệu ứng ống kính chiều sâu.
  - Vạch trung tâm `.center-ticker`: kim chỉ tam giác neon màu vàng kim ở trên/dưới kèm đường ánh sáng dọc ở giữa.
- **Thẻ món ăn & Độ hiếm (Rarity Tiers)**:
  - Phân loại 4 cấp bậc màu sắc lấy cảm hứng từ skin CS:GO: Blue (Mil-Spec), Purple (Restricted), Pink (Classified), Gold (Covert).
  - Thẻ hiển thị ảnh món ăn, tên món, quán ăn và tag thể loại.
- **Vật lý chuyển động & Âm thanh**:
  - Sử dụng CSS `transition: transform 5200ms cubic-bezier(0.12, 0.8, 0.15, 1)` cho trải nghiệm phanh giảm tốc mượt mà nhất.
  - Tích hợp hàm `playTicks()` dùng Web Audio API để phát ra âm thanh click nhịp độ thưa dần theo bước giảm tốc của vòng quay (không phụ thuộc file mp3 ngoài).
- **Thẻ kết quả & Tích hợp Modal Chi tiết**:
  - Khi dải dừng lại, hiển thị `.winner-card` với viền vàng kim phát sáng `box-shadow: 0 0 30px rgba(234, 179, 8, 0.5)`.
  - Tích hợp [`DishDetailModal`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx) qua nút "Xem chi tiết quán", cho phép người dùng xem menu, địa chỉ Google Maps, đọc và viết review ngay sau khi quay trúng.

### Đa ngôn ngữ (`fooday_frontend/src/i18n/translations.ts`)
- Bổ sung các chuỗi mới cho cả tiếng Việt và tiếng Anh: `spinCase`, `spinningCase`, `viewDetail`, `congrats`, `spinAgain`.

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo an toàn tiến trình dev |
