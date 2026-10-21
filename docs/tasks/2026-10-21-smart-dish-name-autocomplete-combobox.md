# Task Archive: Smart Dish Name Autocomplete Combobox ("Suggest-First, Create-Fallback")

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
To prevent messy, duplicated dish names in the catalog (such as "phở gà 1", "phở gà 2", or inconsistent lowercase/uppercase spellings), we designed and implemented a **"Suggest-First, Create-Fallback"** Autocomplete Combobox for the "Dish Name" (Tên món) field.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Created Component** ([`src/components/DishNameAutocomplete.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishNameAutocomplete.tsx)):
  - Built an accessible combobox matching popular Vietnamese dishes (Phở bò, Phở gà, Bún chả, Bún bò Huế, Cơm tấm, Bánh mì chảo,...) merged dynamically with all unique dish names already in the Supabase catalog (`useFoods()`).
  - Supports accent-insensitive, case-insensitive search (`normalize`).
  - Ranks suggestions with exact prefix matches first, followed by substring matches (capped at top 7 items).
  - Offers a dynamic creation action when query does not match any existing item:
    `➕ Dùng tên món mới: "[Tên Món Chuẩn Hóa]"`
  - Automatically capitalizes words using `toTitleCase()`.
  - Accessible keyboard navigation (ArrowUp, ArrowDown, Enter, Escape) and click-outside dismissal.
- **Integrated into Modals**:
  - [`src/components/AddDishModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AddDishModal.tsx): Replaced plain text input with `DishNameAutocomplete`.
  - [`src/components/EditDishModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/EditDishModal.tsx): Replaced plain text input with `DishNameAutocomplete`.
- **Translations** ([`src/i18n/translations.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/i18n/translations.ts)):
  - Added localized helper strings `useCustomName` and `suggestionsTitle` for both Vietnamese and English.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
