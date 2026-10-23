'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFoods } from '@/hooks/useFoods';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * Curated seed of popular Vietnamese dishes. Always offered as suggestions so
 * the field is useful even before the catalog has any user dish.
 */
const POPULAR_DISH_NAMES = [
  'Phở bò',
  'Phở gà',
  'Phở cuốn',
  'Phở trộn',
  'Bún chả',
  'Bún bò Huế',
  'Bún đậu mắm tôm',
  'Bún riêu cua',
  'Bún cá chấm',
  'Bún thịt nướng',
  'Mì Quảng',
  'Mì vằn thắn',
  'Hủ tiếu Nam Vang',
  'Cơm tấm sườn bì chả',
  'Cơm rang dưa bò',
  'Cơm gà xối mỡ',
  'Bánh mì pate',
  'Bánh mì chảo',
  'Bánh cuốn',
  'Bánh xèo',
  'Bánh tráng nướng',
  'Lẩu Thái tomyum',
  'Lẩu riêu cua bắp bò',
  'Nướng BBQ',
  'Bò bít tết',
  'Gà rán',
  'Pizza',
  'Sushi',
  'Cà phê sữa đá',
  'Cà phê muối',
  'Trà sữa trân châu',
  'Trà đào cam sả',
  'Chè bưởi',
  'Kem bơ',
];

/** Maximum amount of suggestions shown at once. */
const MAX_SUGGESTIONS = 7;

/** Lowercase + strip diacritics so "Phở Gà" matches "pho ga". */
const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

/** Capitalize the first letter of every word, keeping the rest untouched. */
const toTitleCase = (str: string) =>
  str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));

interface DishNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  'aria-label'?: string;
  /** Multi-dish mode: Enter / comma / click commit the name via this callback. */
  onCommit?: (value: string) => void;
}

/**
 * "Suggest-First, Create-Fallback" combobox for dish names.
 * Suggests curated + already existing dishes while typing so the catalog stays
 * tidy (no "phở gà 1" / "phở gà 2"), but still allows brand new dishes.
 */
export default function DishNameAutocomplete({
  value,
  onChange,
  placeholder,
  required,
  'aria-label': ariaLabel,
  onCommit,
}: DishNameAutocompleteProps) {
  const { t } = useTranslation();
  const { foods } = useFoods();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Curated list merged with every dish already stored in the database —
  // both the main `name` of a row and every item of its `dishes` menu.
  const catalog = useMemo(() => {
    const names = new Set<string>(POPULAR_DISH_NAMES);
    for (const food of foods) {
      const name = food.name?.trim();
      if (name) names.add(name);
      for (const dish of food.dishes ?? []) {
        const trimmed = dish?.trim();
        if (trimmed) names.add(trimmed);
      }
    }
    return Array.from(names);
  }, [foods]);

  const query = value.trim();

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of catalog) {
      const normalized = normalize(name);
      if (normalized.startsWith(q)) starts.push(name);
      else if (normalized.includes(q)) contains.push(name);
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [catalog, query]);

  // True when the typed name is not an existing dish yet — offer to create it.
  const canCreate = useMemo(() => {
    const q = normalize(query);
    if (!q) return false;
    return !catalog.some((name) => normalize(name) === q);
  }, [catalog, query]);

  const showDropdown = open && query.length > 0 && (suggestions.length > 0 || canCreate);

  // Click-outside detection.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keep the highlighted option inside the scroll area.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex, listId]);

  const select = (name: string) => {
    const titled = toTitleCase(name);
    if (onCommit) {
      // Multi-dish mode: picking a suggestion adds it straight to the list.
      setActiveIndex(-1);
      setOpen(false);
      onCommit(titled);
      return;
    }
    onChange(titled);
    setActiveIndex(-1);
    setOpen(false);
  };

  const applyCustomName = () => {
    if (onCommit) {
      setActiveIndex(-1);
      setOpen(false);
      onCommit(toTitleCase(query));
      return;
    }
    onChange(toTitleCase(query));
    setActiveIndex(-1);
    setOpen(false);
  };

  /** Commit the typed text (multi-dish mode), keeping the legacy fill mode. */
  const commit = (raw: string) => {
    if (!onCommit) {
      onChange(toTitleCase(raw));
      return;
    }
    const text = toTitleCase(raw.trim());
    if (!text) return;
    setActiveIndex(-1);
    setOpen(false);
    onCommit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Multi-dish mode: Enter commits the highlighted suggestion or the typed
    // text; a comma commits whatever is in front of it.
    if (onCommit && (e.key === 'Enter' || e.key === ',')) {
      if (e.key === 'Enter' && showDropdown && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        commit(suggestions[activeIndex]);
        return;
      }
      if (!query) return;
      e.preventDefault();
      commit(query);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!query) return;
      e.preventDefault();
      if (!showDropdown) {
        setOpen(true);
        setActiveIndex(e.key === 'ArrowDown' ? (suggestions.length > 0 ? 0 : -1) : suggestions.length - 1);
        return;
      }
      if (suggestions.length === 0) return;
      if (e.key === 'ArrowDown') {
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else {
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      if (!showDropdown) return;
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        select(suggestions[activeIndex]);
        return;
      }
      if (canCreate) {
        e.preventDefault();
        applyCustomName();
      }
      return;
    }

    if (e.key === 'Escape') {
      if (!showDropdown) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="root" ref={rootRef}>
      <input
        className="input"
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // A new query always starts without a highlighted option.
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-label={ariaLabel}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="dropdown">
          <div className="dropdown-title">{t.addDish.suggestionsTitle}</div>

          <div
            className="options"
            role="listbox"
            id={listId}
            aria-label={t.addDish.suggestionsTitle}
          >
            {suggestions.map((name, index) => (
              <button
                type="button"
                key={name}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`option ${index === activeIndex ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {canCreate && (
            <div className="create-row">
              <button
                type="button"
                className="create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyCustomName}
              >
                {t.addDish.useCustomName(toTitleCase(query))}
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .root {
          position: relative;
          width: 100%;
        }
        .input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14.5px;
          outline: none;
          transition: border-color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 60;
          padding: 6px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          animation: dropdownIn 0.18s var(--ease-out) both;
        }
        .dropdown-title {
          padding: 6px 10px 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .options {
          display: flex;
          flex-direction: column;
          max-height: 246px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }
        .option {
          display: block;
          width: 100%;
          padding: 9px 10px;
          border: none;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease);
        }
        .option:hover {
          background: var(--surface-2);
        }
        .option.active {
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-weight: 700;
        }
        .create-row {
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid var(--border);
        }
        .create {
          display: block;
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--primary-strong);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease);
        }
        .create:hover {
          background: var(--primary-soft);
        }
        @keyframes dropdownIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
