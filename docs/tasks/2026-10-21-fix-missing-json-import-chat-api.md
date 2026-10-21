# Task Archive: Fix Missing JSON Import in Chat API (Fix AI Fallback Error)

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Root Cause & Context
In `fooday_backend/app/api.py`, function `_parse_json_object(content: str)` called `json.loads(text.strip())`. However, `import json` was missing from the module imports. When the OpenCode AI model successfully returned completion JSON, Python raised a `NameError: name 'json' is not defined`. This was caught by the broad `except Exception` handler, causing every chat request to return the error fallback string:
*"Xin lỗi, mình chưa nghĩ ra gợi ý lúc này. Bạn thử lại sau một chút nhé."* (`fallback: "error"`).

---

### 2. Implementation Summary
- In `fooday_backend/app/api.py`:
  - Added `import json` at top of file.
  - Increased timeout for `httpx.post` from `25.0s` to `35.0s` to ensure reasoning generation on free-tier models does not trigger client timeouts under network latency.

---

### 3. Verification & QA Results
- **Smoke Test**: Direct invocation of `chat_endpoint` via Python venv:
  - Input: `"Hôm nay ăn gì ngon"`
  - Output:
    - `FALLBACK`: `None`
    - `REPLY`: *"Hôm nay ăn Bún cá chấm hoặc Phở gà nhé, cả hai đều ngon và khá hợp để kết thúc ngày làm việc. Nếu muốn đổi vị, hãy thử Bánh cuốn hoặc Bún bò Huế nhé!"*
    - `DISHES`: `['Bún cá chấm', 'Phở gà', 'Bánh cuốn', 'Bún bò Huế']`
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS**
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS**
