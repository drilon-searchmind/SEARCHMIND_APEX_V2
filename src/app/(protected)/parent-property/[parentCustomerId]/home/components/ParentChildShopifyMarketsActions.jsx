"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronDown, FiMapPin } from "react-icons/fi";
import { showToast } from "@/components/ui/ToastProvider";

const MENU_WIDTH_PX = 224; // Tailwind w-56

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
 * Inline markets picker for a child row (group / parent-property start view).
 * Mirrors dashboard “Filter market(s)” behavior; state is owned by the parent page.
 * Menu is portaled to document.body so table overflow-x-auto does not clip it.
 */
export default function ParentChildShopifyMarketsActions({
    customerId,
    propertyLabel = "Property",
    /** Draft exclusions (checkbox state until Apply) */
    excludedMarkets = {},
    onToggleMarket,
    onCatalogLoaded,
    onApplyMarkets,
    onMenuWillOpen,
    filterAdSpendByMarket = false,
    onFilterAdSpendByMarketChange,
    fetchDisabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [markets, setMarkets] = useState([]);
    const anchorRef = useRef(null);
    const menuRef = useRef(null);
    const catalogFetchInFlight = useRef(false);

    const placementStyle = useAnchoredDropdownStyle(open, anchorRef, markets.length + (loading ? 1 : 0));

    const loadCatalog = useCallback(async () => {
        if (!customerId || markets.length > 0 || catalogFetchInFlight.current) return;
        catalogFetchInFlight.current = true;
        setLoading(true);
        try {
            const res = await fetch(`/api/shopify-markets/${customerId}`, {
                credentials: "same-origin",
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Markets (${res.status})`);
            if (body.graphqlErrors?.length && !(Array.isArray(body.markets) && body.markets.length > 0)) {
                const msg = Array.isArray(body.graphqlErrors)
                    ? body.graphqlErrors[0]
                    : String(body.graphqlErrors);
                showToast({
                    message: `${propertyLabel}: ${msg}`,
                    type: "warning",
                    position: "top-center",
                });
            }
            const list = Array.isArray(body.markets) ? body.markets : [];
            setMarkets(list);
            onCatalogLoaded?.(customerId, list);
        } catch (e) {
            showToast({
                message: e?.message || "Could not load Shopify Markets",
                type: "error",
                position: "top-center",
            });
            setMarkets([]);
        } finally {
            setLoading(false);
            catalogFetchInFlight.current = false;
        }
    }, [customerId, markets.length, onCatalogLoaded, propertyLabel]);

    useEffect(() => {
        if (!open) return undefined;
        loadCatalog();
        return undefined;
    }, [open, loadCatalog]);

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

    const selectedCount = markets.filter((m) => excludedMarkets[m.shopifyqlMarketId] !== true).length;

    const dropdown =
        open &&
        placementStyle &&
        typeof document !== "undefined"
            ? createPortal(
                  <div
                      ref={menuRef}
                      role="listbox"
                      aria-label="Shopify markets"
                      className="apex-parent-popover flex flex-col text-left overflow-hidden"
                      style={placementStyle}
                  >
                      <div className="overflow-y-auto py-2 flex-1 min-h-0">
                      {loading ? (
                          <div className="px-3 py-2 text-xs text-gray-500">Loading markets…</div>
                      ) : markets.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No markets</div>
                      ) : (
                          <>
                              <div className="px-3 pb-2 mb-1 border-b border-gray-100 text-[0.65rem] text-gray-500 tabular-nums">
                                  {selectedCount} of {markets.length} included
                              </div>
                              {markets.map((m) => {
                                  const included = excludedMarkets[m.shopifyqlMarketId] !== true;
                                  return (
                                      <label
                                          key={m.shopifyqlMarketId}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                                      >
                                          <input
                                              type="checkbox"
                                              checked={included}
                                              onChange={(e) =>
                                                  onToggleMarket?.(
                                                      customerId,
                                                      m.shopifyqlMarketId,
                                                      e.target.checked
                                                  )
                                              }
                                              disabled={fetchDisabled || loading}
                                              className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                                          />
                                          <span className="text-xs text-gray-800 truncate">{m.name}</span>
                                      </label>
                                  );
                              })}
                          </>
                      )}
                      </div>
                      <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/50 shrink-0">
                          <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                  type="checkbox"
                                  checked={filterAdSpendByMarket === true}
                                  onChange={(e) =>
                                      onFilterAdSpendByMarketChange?.(e.target.checked)
                                  }
                                  disabled={fetchDisabled || loading}
                                  className="mt-0.5 rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                              />
                              <span className="text-xs text-gray-700 leading-snug">
                                  Filter marketing spend by markets
                              </span>
                          </label>
                      </div>
                      <div className="border-t border-gray-100 p-2 bg-gray-50/80 shrink-0">
                          <button
                              type="button"
                              disabled={fetchDisabled || loading}
                              onClick={() => {
                                  onApplyMarkets?.();
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
                    disabled={fetchDisabled || loading}
                    title="Filter Shopify Markets for this property"
                    className="apex-perf-btn !text-xs !min-h-0 !py-1.5 !px-3"
                >
                    <FiMapPin className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
                    Markets
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
