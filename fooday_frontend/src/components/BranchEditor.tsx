'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { mapService } from '@/services/api';
import { useTranslation } from '@/i18n/LanguageContext';
import { isGoogleMapsUrl } from '@/lib/maps';
import { extractCoordsFromUrl } from '@/lib/geo';

/** A branch being edited inside the Add/Edit dish forms. */
export interface BranchDraft {
  id: string;
  name: string;
  googleMapUrl: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}

interface BranchEditorProps {
  branches: BranchDraft[];
  onChange: React.Dispatch<React.SetStateAction<BranchDraft[]>>;
}

/** A blank branch row. */
export function createBranchDraft(): BranchDraft {
  return {
    id: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    googleMapUrl: '',
    address: '',
    lat: null,
    lng: null,
  };
}

/**
 * Editor for the extra outlets of a restaurant. Each row holds a name, a
 * Google Maps link (the address and the coordinates are parsed out of it
 * automatically) and the address itself.
 */
export default function BranchEditor({ branches, onChange }: BranchEditorProps) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seqRef = useRef<Record<string, number>>({});

  // Drop pending resolutions when the editor unmounts.
  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const update = (id: string, patch: Partial<BranchDraft>) => {
    onChange((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleMapUrlChange = (id: string, value: string) => {
    update(id, { googleMapUrl: value });

    seqRef.current[id] = (seqRef.current[id] ?? 0) + 1;
    const seq = seqRef.current[id];
    const pending = timersRef.current[id];
    if (pending) {
      clearTimeout(pending);
      delete timersRef.current[id];
    }

    const url = value.trim();
    if (!isGoogleMapsUrl(url)) {
      setResolving((prev) => ({ ...prev, [id]: false }));
      return;
    }

    setResolving((prev) => ({ ...prev, [id]: true }));
    timersRef.current[id] = setTimeout(async () => {
      delete timersRef.current[id];
      const info = await mapService.parseMapLink(url);
      if (seq !== seqRef.current[id]) return;
      setResolving((prev) => ({ ...prev, [id]: false }));
      if (!info) return;
      // The expanded link carries the coordinates of the outlet.
      const coords = extractCoordsFromUrl(info.resolved_url);
      onChange((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const patch: Partial<BranchDraft> = {};
          if (!b.address.trim() && info.address) {
            patch.address = info.address as string;
          }
          if (coords) {
            patch.lat = coords.lat;
            patch.lng = coords.lng;
          }
          return Object.keys(patch).length > 0 ? { ...b, ...patch } : b;
        }),
      );
    }, 500);
  };

  const addBranch = () => onChange((prev) => [...prev, createBranchDraft()]);

  const removeBranch = (id: string) => {
    const pending = timersRef.current[id];
    if (pending) {
      clearTimeout(pending);
      delete timersRef.current[id];
    }
    onChange((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="branch-editor">
      {branches.length > 0 && (
        <ul className="branch-rows">
          {branches.map((branch, index) => (
            <li key={branch.id} className="branch-row">
              <div className="branch-row-head">
                <span className="branch-row-title">
                  {branch.name || `${t.branches.branchNameLabel} ${index + 1}`}
                </span>
                <button
                  type="button"
                  className="branch-remove"
                  onClick={() => removeBranch(branch.id)}
                  aria-label={t.branches.removeBranch}
                  title={t.branches.removeBranch}
                >
                  <X size={14} />
                </button>
              </div>

              <label className="field">
                <span className="label">{t.branches.branchNameLabel}</span>
                <input
                  value={branch.name}
                  onChange={(e) => update(branch.id, { name: e.target.value })}
                  placeholder={t.branches.branchNamePlaceholder}
                  aria-label={t.branches.branchNameLabel}
                />
              </label>

              <label className="field">
                <span className="label">{t.map.googleMapLabel}</span>
                <input
                  value={branch.googleMapUrl}
                  onChange={(e) => handleMapUrlChange(branch.id, e.target.value)}
                  placeholder={t.branches.branchMapPlaceholder}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={t.map.googleMapLabel}
                />
              </label>

              <label className="field">
                <span className="label">{t.branches.branchAddressLabel}</span>
                <input
                  value={branch.address}
                  onChange={(e) => update(branch.id, { address: e.target.value })}
                  placeholder={t.map.addressPlaceholder}
                  disabled={Boolean(resolving[branch.id])}
                  aria-busy={Boolean(resolving[branch.id])}
                  aria-label={t.branches.branchAddressLabel}
                />
                {resolving[branch.id] && (
                  <span className="field-hint resolving-hint">
                    <Loader2 size={13} className="spin" />
                    {t.map.resolvingAddress}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="add-branch" onClick={addBranch}>
        <Plus size={15} />
        <span>{t.branches.addBranch}</span>
      </button>

      <style jsx>{`
        .branch-editor {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .branch-rows {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .branch-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
        }
        .branch-row-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .branch-row-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .branch-remove {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border: none;
          border-radius: var(--r-full);
          background: var(--surface-3);
          color: var(--text-soft);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease);
        }
        .branch-remove:hover {
          background: var(--heart);
          color: #fff;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-soft);
        }
        .field input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .field input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .field input:disabled {
          opacity: 0.5;
          cursor: progress;
        }
        .field-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
        }
        .resolving-hint {
          color: var(--primary-strong);
        }
        .add-branch {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 44px;
          padding: 0 14px;
          border-radius: var(--r-md);
          border: 1.5px dashed var(--border-strong);
          background: var(--surface-2);
          color: var(--primary-strong);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease);
        }
        .add-branch:hover {
          border-color: var(--primary);
          background: var(--primary-soft);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
