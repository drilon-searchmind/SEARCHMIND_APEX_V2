"use client";

import React, { useState, useRef } from "react";

/** Minimum space (px) below the trigger before flipping the popover upward */
const MIN_SPACE_BELOW = 220;

/**
 * Hover target that shows a popover with the comparison period value (Last Year / Last Period)
 * and optional absolute difference. Optionally appends extra content (e.g. calculation breakdown).
 * Flips above the trigger when there is not enough room below (avoids clipping at page bottom).
 * Aligned to the right of the trigger for a clearer read next to metric values.
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
    const wrapRef = useRef(null);

    const hasPrev =
        changePrevValue != null && String(changePrevValue).trim().length > 0;
    const hasDiff =
        changeAbsolute != null && String(changeAbsolute).trim().length > 0;
    const hasComparisonBlock =
        Boolean(comparisonMethod) && (hasPrev || hasDiff);
    const show = !disabled && (hasComparisonBlock || extraContent);

    const handleEnter = () => {
        const el = wrapRef.current;
        if (el) {
            const rect = el.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenUpward(spaceBelow < MIN_SPACE_BELOW);
        }
        setVisible(true);
    };

    const handleLeave = () => {
        setVisible(false);
    };

    if (!show) {
        return <>{children}</>;
    }

    return (
        <div
            ref={wrapRef}
            className={`relative ${className}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {children}
            {visible && (
                <div
                    className={`absolute z-[100] min-w-[200px] w-max max-w-[min(92vw,24rem)] right-0 ${
                        openUpward ? "bottom-full mb-2" : "top-full mt-2"
                    }`}
                    role="tooltip"
                    style={{ animation: "fadeIn 0.15s ease-in-out" }}
                >
                    <div className="relative rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
                        {/* Popover above trigger: arrow on bottom edge, tip points down */}
                        {openUpward && (
                            <>
                                <div className="pointer-events-none absolute -bottom-2 right-8 h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
                                <div className="pointer-events-none absolute -bottom-2.5 right-8 h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-200" />
                            </>
                        )}
                        {/* Popover below trigger: arrow on top edge, tip points up */}
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
            )}
        </div>
    );
}
