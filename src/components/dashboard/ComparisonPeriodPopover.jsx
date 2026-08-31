"use client";

import React, { useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/** Minimum space (px) below the trigger before flipping the popover upward */
const MIN_SPACE_BELOW = 220;

/**
 * Hover target that shows a popover with the comparison period value (Last Year / Last Period)
 * and optional absolute difference. Optionally appends extra content (e.g. calculation breakdown).
 * Renders in a portal so parent overflow does not clip the tooltip.
 */
export default function ComparisonPeriodPopover({
    comparisonMethod,
    changePrevValue,
    changeAbsolute,
    extraContent = null,
    children,
    className = "",
    disabled = false,
}) {
    const [visible, setVisible] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [portalStyle, setPortalStyle] = useState({ top: 0, right: 0, bottom: null });
    const wrapRef = useRef(null);

    const hasPrev =
        changePrevValue != null && String(changePrevValue).trim().length > 0;
    const hasDiff =
        changeAbsolute != null && String(changeAbsolute).trim().length > 0;
    const hasComparisonBlock =
        Boolean(comparisonMethod) && (hasPrev || hasDiff);
    const show = !disabled && (hasComparisonBlock || extraContent);

    const updatePosition = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const flip = spaceBelow < MIN_SPACE_BELOW;
        setOpenUpward(flip);
        setPortalStyle({
            top: flip ? null : rect.bottom + 8,
            bottom: flip ? window.innerHeight - rect.top + 8 : null,
            right: window.innerWidth - rect.right,
        });
    }, []);

    useLayoutEffect(() => {
        if (!visible || !show) return;
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [visible, show, updatePosition]);

    const handleEnter = () => {
        updatePosition();
        setVisible(true);
    };

    const handleLeave = () => {
        setVisible(false);
    };

    if (!show) {
        return <>{children}</>;
    }

    const popoverPanel = (
        <div
            className={`fixed z-[10050] min-w-[200px] w-max max-w-[min(92vw,24rem)] ${
                openUpward ? "origin-bottom-right" : "origin-top-right"
            }`}
            role="tooltip"
            style={{
                top: portalStyle.top ?? undefined,
                bottom: portalStyle.bottom ?? undefined,
                right: portalStyle.right,
                animation: "fadeIn 0.15s ease-in-out",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <div className="relative rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
                {openUpward && (
                    <>
                        <div className="pointer-events-none absolute -bottom-2 right-8 h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
                        <div className="pointer-events-none absolute -bottom-2.5 right-8 h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-200" />
                    </>
                )}
                {!openUpward && (
                    <>
                        <div className="pointer-events-none absolute -top-2 right-8 h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" />
                        <div className="pointer-events-none absolute -top-2.5 right-8 h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-200" />
                    </>
                )}
                <div className="space-y-2 text-xs text-gray-700">
                    {hasComparisonBlock && (
                        <div className="space-y-1">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                {comparisonMethod} value
                            </div>
                            <div className="font-medium">
                                {hasPrev ? changePrevValue : "—"}
                            </div>
                            {hasDiff && (
                                <>
                                    <div className="pt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                        Difference
                                    </div>
                                    <div className="font-semibold">
                                        {changeAbsolute}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {extraContent && (
                        <div
                            className={`whitespace-pre-line ${
                                hasComparisonBlock
                                    ? "border-t border-gray-100 pt-2"
                                    : ""
                            }`}
                        >
                            {extraContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div
                ref={wrapRef}
                className={className}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                {children}
            </div>
            {visible &&
                typeof document !== "undefined" &&
                createPortal(popoverPanel, document.body)}
        </>
    );
}
