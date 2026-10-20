# Task Archive: Switch AI Chat Provider to OpenCode (minimax-m3.1-flash-free)

- **Date**: 2026-10-20
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Chuyển đổi provider AI Chat trong backend FastAPI (`fooday_backend`) từ Google Gemini sang **OpenCode Provider** sử dụng model **`minimax-m3.1-flash-free`** (OpenAI-compatible Chat Completions API tại `https://opencode.ai/zen/go/v1`):
- Sử dụng client HTTP (`httpx`) để gọi endpoint `https://opencode.ai/zen/go/v1/chat/completions`.
- Đọc `OPENCODE_API_KEY`, `OPENCODE_BASE_URL` (mặc định: `https://opencode.ai/zen/go/v1`), và `OPENCODE_MODEL` (mặc định: `minimax-m3.1-flash-free`) từ biến môi trường.
- Giữ vững toàn bộ logic grounding với danh mục món ăn từ Supabase (`public.foods`), kiểm tra `valid_names` để không bị ảo giác tên món, và trả về đúng schema `ChatResponse`.

---

## 2. Target Files & Changes
1. `fooday_backend/app/config.py`:
   - Bỏ dependency `google.genai`.
   - Khai báo các cấu hình OpenCode (`OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `OPENCODE_MODEL`).
2. `fooday_backend/app/api.py`:
   - Bỏ dependency `google.genai.types` và schema `AiSuggestion`.
   - Bổ sung hàm parse an toàn `_parse_json_object` xử lý trường hợp output có markdown codeblock.
   - Thêm `x-opencode-session: str(uuid.uuid4())` và gửi payload tương thích OpenAI Chat Completions với `response_format: {"type": "json_object"}`.
   - Grounding với database Supabase và lọc `suggested_dishes` theo `valid_names`.
3. `fooday_backend/.env` & `fooday_backend/.env.example`:
   - Bổ sung cấu hình `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `OPENCODE_MODEL`.

---

## 3. Verification & QA Audit
- **Syntax Check**: `python -m compileall -q fooday_backend/app` -> **PASS (Exit 0)**
- **Smoke Test**: Gọi trực tiếp `chat_endpoint` qua Python venv với câu hỏi tiếng Việt:
  - Input: *"Hôm nay trời hơi se lạnh, có món gì nước ấm bụng dễ ăn không?"*
  - Output:
    - `STATUS`: SUCCESS
    - `REPLY`: *"Trời se lạnh thì nấu phở gà hoặc cháo sườn là lựa chọn ấm bụng, dễ ăn lắm nhé! Nếu thích ăn bún, bún sườn cũng vừa ăn lại ấm sườn nóng hổi."*
    - `SUGGESTED DISHES`: `['Phở gà', 'Cháo sườn', 'Bún sườn']` (khớp hoàn toàn với catalog Supabase).

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_backend/.env.example
 M fooday_backend/app/api.py
 M fooday_backend/app/config.py
```
