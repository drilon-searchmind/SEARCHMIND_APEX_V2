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
            <div className={`apex-cmp-pop${openUpward ? " is-up" : ""}`}>
                {hasComparisonBlock && (
                    <div className="apex-cmp-pop__block">
                        <div className="apex-cmp-pop__label">{comparisonMethod} value</div>
                        <div className="apex-cmp-pop__value">{hasPrev ? changePrevValue : "-"}</div>
                        {hasDiff && (
                            <>
                                <div className="apex-cmp-pop__label">Difference</div>
                                <div className="apex-cmp-pop__value is-strong">{changeAbsolute}</div>
                            </>
                        )}
                    </div>
                )}
                {extraContent && (
                    <div className={`apex-cmp-pop__extra${hasComparisonBlock ? " has-divider" : ""}`}>
                        {extraContent}
                    </div>
                )}
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
