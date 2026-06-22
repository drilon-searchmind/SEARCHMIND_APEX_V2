"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronDown, FiPieChart } from "react-icons/fi";

const MENU_WIDTH_PX = 224;

function useAnchoredDropdownStyle(open, anchorRef, layoutVersion = 0) {
    const [style, setStyle] = useState(null);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current) {
            return undefined;
        }

        const update = () => {
            const el = anchorRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            let left = rect.right - MENU_WIDTH_PX;
            left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH_PX - 8));
            const top = rect.bottom + 4;
            const maxHeight = Math.min(300, Math.max(160, window.innerHeight - top - 8));
            setStyle({
                position: "fixed",
                top,
                left,
                width: MENU_WIDTH_PX,
                maxHeight,
                zIndex: 9999,
            });
        };

        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, anchorRef, layoutVersion]);

    return style;
}

/**
 * Per-row paid media filter for Shopify Markets children (group start view).
 * @param {{ id: string, label: string }[]} platforms
 * @param {Record<string, boolean>} excludedPlatforms — draft: `true` = excluded from spend aggregate
 */
export default function ParentChildAdSpendPlatformsActions({
    customerId,
    propertyLabel = "Property",
    platforms = [],
    excludedPlatforms = {},
    onTogglePlatform,
    onApplySpend,
    onMenuWillOpen,
    fetchDisabled = false,
}) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);
    const menuRef = useRef(null);

    const placementStyle = useAnchoredDropdownStyle(open, anchorRef, platforms.length);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            const t = e.target;
            if (anchorRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const includedCount = platforms.filter((p) => excludedPlatforms[p.id] !== true).length;

    const dropdown =
        open &&
        placementStyle &&
        typeof document !== "undefined" &&
        platforms.length > 0
            ? createPortal(
                  <div
                      ref={menuRef}
                      role="listbox"
                      aria-label="Adspend"
                      className="apex-parent-popover flex flex-col text-left overflow-hidden"
                      style={placementStyle}
                  >
                      <div className="overflow-y-auto py-2 flex-1 min-h-0">
                          <div className="px-3 pb-2 mb-1 border-b border-gray-100 text-[0.65rem] text-gray-500 tabular-nums">
                              {includedCount} of {platforms.length} included
                          </div>
                          {platforms.map((p) => {
                              const included = excludedPlatforms[p.id] !== true;
                              return (
                                  <label
                                      key={p.id}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                                  >
                                      <input
                                          type="checkbox"
                                          checked={included}
                                          onChange={(e) =>
                                              onTogglePlatform?.(customerId, p.id, e.target.checked)
                                          }
                                          disabled={fetchDisabled}
                                          className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                                      />
                                      <span className="text-xs text-gray-800 truncate">{p.label}</span>
                                  </label>
                              );
                          })}
                      </div>
                      <div className="border-t border-gray-100 p-2 bg-gray-50/80 shrink-0">
                          <button
                              type="button"
                              disabled={fetchDisabled}
                              onClick={() => {
                                  onApplySpend?.();
                                  setOpen(false);
                              }}
                              className="w-full rounded-lg bg-[var(--color-primary-searchmind)] text-white text-xs py-2 px-3 font-medium shadow-none hover:bg-[var(--color-primary-searchmind-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                              Apply
                          </button>
                      </div>
                  </div>,
                  document.body
              )
            : null;

    const title = `${propertyLabel}: include paid channels in totals`;

    return (
        <>
            <div className="relative inline-flex shrink-0" ref={anchorRef}>
                <button
                    type="button"
                    onClick={() =>
                        setOpen((v) => {
                            const next = !v;
                            if (next) onMenuWillOpen?.();
                            return next;
                        })
                    }
                    disabled={fetchDisabled || platforms.length === 0}
                    title={title}
                    className="apex-perf-btn !text-xs !min-h-0 !py-1.5 !px-3"
                >
                    <FiPieChart className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
                    Spend
                    <FiChevronDown
                        className={`w-3 h-3 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden
                    />
                </button>
            </div>
            {dropdown}
        </>
    );
}
