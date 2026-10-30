"use client";

import React from "react";
import Link from "next/link";
import { FiAlertTriangle, FiInfo, FiZap } from "react-icons/fi";
import { normalizeInternalNotificationHref } from "@/lib/notificationLink";
import { categoryOf, CATEGORY_LABELS } from "./notificationUtils";
import "./notifications-ui.css";

const ICONS = { alert: FiAlertTriangle, feature: FiZap, system: FiInfo };

/** Round icon bubble that tells the category apart at a glance (alert, new feature, system). */
export function CategoryBadge({ category = "system", size = "md" }) {
    const key = category === "alert" || category === "feature" ? category : "system";
    const Icon = ICONS[key];
    return (
        <span className={`apex-nbadge apex-nbadge--${key} apex-nbadge--${size}`} title={CATEGORY_LABELS[key]} aria-hidden>
            <Icon />
        </span>
    );
}

export { categoryOf };

/**
 * Wraps a notification in the right element: an external link, an internal link, or a plain block when
 * it has no link. Keeps one place for the href rules so the bell and the page behave the same.
 */
export function NotificationLink({ n, className = "", onNavigate, children }) {
    const raw = String(n?.linkUrl || "").trim();
    if (!raw) return <div className={className}>{children}</div>;
    const href = normalizeInternalNotificationHref(raw);
    if (/^https?:\/\//i.test(href)) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onNavigate}>
                {children}
            </a>
        );
    }
    return (
        <Link href={href} className={className} onClick={onNavigate}>
            {children}
        </Link>
    );
}
