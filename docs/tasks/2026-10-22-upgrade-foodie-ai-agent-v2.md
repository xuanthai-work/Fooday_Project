# Task Archive: Upgrade Foodie AI 2.0 (Tools, Multi-Turn Memory, GPS Awareness & Rich Chat Cards)

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Nâng cấp toàn diện trợ lý ẩm thực **Foodie AI 2.0** với nhà cung cấp hiện tại (OpenCode - `minimax-m3.1-flash-free`), khắc phục hoàn toàn hiện tượng AI bị mất ngữ cảnh hoặc lỗi fallback "câu được câu không".

**Các đột phá được triển khai**:
1. **Đột phá 1 (Tool / Smart Search Catalog)**: Tìm kiếm và xếp hạng toàn diện danh mục Supabase theo từ khóa, hashtag, khoảng cách GPS và rating, thay vì bị giới hạn cứng trong top 30 món.
2. **Đột phá 2 (Multi-turn Context Memory)**: Frontend gửi 6 tin nhắn gần nhất (`conversation_history`). AI hiểu ngữ cảnh liên tục (khi người dùng nói "nay không thích ăn xôi", AI hiểu ngay ngữ cảnh trước đó để đổi sang bún, phở, cơm).
3. **Đột phá 3 (Location-Aware AI)**: Frontend truyền GPS `{ lat, lng }`. Backend tính khoảng cách Haversine và đưa vào prompt để AI chủ động nhắc tên các quán gần kèm khoảng cách thực tế (ví dụ: "cách bạn khoảng 6.1 km").
4. **Đột phá 5 (Rich Interactive Food Cards trong Chat)**: AI trả về danh sách thẻ món ăn trực quan (`suggested_cards`) có ảnh món, tên quán, rating, khoảng cách. Người dùng click trực tiếp vào thẻ trong bong bóng chat để mở ngay `DishDetailModal`.
5. **Gia cố Ổn định**: Bổ sung cơ chế Auto-Retry (thử lại 1 lần khi timeout/429) và Bộ bóc tách Regex JSON Resilient chống lỗi cú pháp.

---

### 2. Implementation Summary

#### Backend (`fooday_backend`)
- **Models** ([`app/models.py`](file:///D:/work/Stuff/Fooday_Project/fooday_backend/app/models.py)):
  - Thêm `ChatMessage`, `UserCoords`, `DishCardInfo`.
  - Cập nhật `ChatRequest` (hỗ trợ `conversation_history`, `user_coords`) và `ChatResponse` (hỗ trợ `suggested_cards: list[DishCardInfo]`).
- **Engine Agent** ([`app/api.py`](file:///D:/work/Stuff/Fooday_Project/fooday_backend/app/api.py)):
  - `_rank_catalog`: Xếp hạng danh mục thông minh theo độ khớp từ khóa, khoảng cách GPS (`_calc_distance`) và rating.
  - `_attach_link_coords`: Sử dụng `ThreadPoolExecutor` để resolve ngầm các link Maps rút gọn và cache tọa độ.
  - `chat_endpoint`: Ghép lịch sử hội thoại nhiều lượt vào OpenCode `messages`, tự động retry 1 lần khi gặp sự cố, trích xuất JSON bằng regex an toàn và sinh `suggested_cards` cho các món ăn được AI gợi ý.

#### Frontend (`fooday_frontend`)
- **API Services & Proxy** ([`src/services/api.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/services/api.ts), [`src/app/api/chat/route.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/app/api/chat/route.ts)):
  - Hỗ trợ truyền `conversation_history` và `user_coords`. BFF proxy forward nguyên vẹn payload tới backend.
- **Chat View UI** ([`src/components/ChatView.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/ChatView.tsx)):
  - Tự động lấy tọa độ qua `useUserLocation()` và lấy 6 tin nhắn gần nhất qua `buildHistory`.
  - Render hàng ngang thẻ món ăn trực quan `.chat-cards-carousel` bên trong bong bóng chat:
    - Hiển thị ảnh món ăn, tên món, tên quán, rating và badge khoảng cách.
    - Click vào thẻ mở trực tiếp `DishDetailModal`.

---

### 3. Verification & QA Results
- **Multi-turn Context Verification**: Đã test prompt "nay không thích ăn xôi" sau khi được gợi ý xôi ➔ AI hiểu ngữ cảnh, đổi sang Bún cá chấm, Phở gà, Buffet.
- **Location-Aware Verification**: AI nhắc chính xác khoảng cách đến quán gần nhất ("cách bạn khoảng 6,1 km").
- **Rich Cards Output**: Trả về 3 thẻ món ăn trực quan kèm link và modal mount thành công.
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
