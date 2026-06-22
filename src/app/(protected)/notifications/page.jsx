"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { normalizeInternalNotificationHref } from "@/lib/notificationLink";
import "./notifications.css";

function formatRelative(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function startOfLocalDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfLocalWeek(d) {
    const x = startOfLocalDay(d);
    const day = x.getDay();
    x.setDate(x.getDate() - day);
    return x;
}

function groupNotifications(items) {
    const now = new Date();
    const sod = startOfLocalDay(now);
    const sow = startOfLocalWeek(now);
    const groups = { today: [], thisWeek: [], older: [] };
    for (const n of items) {
        const d = new Date(n.createdAt);
        if (d >= sod) groups.today.push(n);
        else if (d >= sow) groups.thisWeek.push(n);
        else groups.older.push(n);
    }
    return groups;
}

function NotificationRowContent({ n }) {
    return (
        <div className="apex-notifications-row">
            <div className="apex-notifications-row__avatar">
                {n.authorImage ? (
                    <Image
                        src={n.authorImage}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="apex-notifications-row__avatar-fallback">
                        {(n.authorName || "A")[0]}
                    </div>
                )}
                {!n.readAt ? <span className="apex-notifications-row__unread" aria-label="Unread" /> : null}
            </div>
            <div className="apex-notifications-row__content">
                <p className="apex-notifications-row__title">{n.title}</p>
                <p className="apex-notifications-row__body">{n.body}</p>
                <p className="apex-notifications-row__time">{formatRelative(n.createdAt)}</p>
            </div>
            {n.imageUrl ? (
                <div className="apex-notifications-row__thumb">
                    <Image src={n.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
            ) : null}
        </div>
    );
}

function NotificationRow({ n }) {
    const raw = (n.linkUrl || "").trim();
    const href = raw ? normalizeInternalNotificationHref(raw) : null;

    if (href) {
        if (href.startsWith("http")) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apex-notifications-row-wrap"
                >
                    <NotificationRowContent n={n} />
                </a>
            );
        }
        return (
            <Link href={href} className="apex-notifications-row-wrap">
                <NotificationRowContent n={n} />
            </Link>
        );
    }

    return <NotificationRowContent n={n} />;
}

function Section({ title, items }) {
    if (!items.length) return null;
    return (
        <section className="apex-notifications-section">
            <h2 className="apex-notifications-section__title">{title}</h2>
            <div className="apex-notifications-panel">
                {items.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                ))}
            </div>
        </section>
    );
}

export default function NotificationsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/notifications?limit=100");
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load");
                setItems(data.notifications || []);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const groups = useMemo(() => groupNotifications(items), [items]);
    const unreadCount = useMemo(
        () => items.filter((n) => !n.readAt).length,
        [items]
    );

    return (
        <div id="NotificationsPage" className="cobalt-perf w-full apex-notifications-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Notifications"
                label={
                    unreadCount > 0
                        ? `${unreadCount} unread · ${items.length} total`
                        : `${items.length} in your history`
                }
            />

            {!loading && !error && items.length > 0 ? (
                <p className="apex-notifications-summary">
                    You have <strong>{items.length}</strong> notification
                    {items.length !== 1 ? "s" : ""} in your history
                    {unreadCount > 0 ? (
                        <>
                            {" "}
                            — <strong>{unreadCount}</strong> unread
                        </>
                    ) : null}
                    .
                </p>
            ) : null}

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading notifications" request="GET /api/notifications" />
                </div>
            ) : null}

            {error ? <p className="apex-notifications-error">{error}</p> : null}

            {!loading && !error ? (
                <>
                    <Section title="Today" items={groups.today} />
                    <Section title="This week" items={groups.thisWeek} />
                    <Section title="Earlier" items={groups.older} />
                    {items.length === 0 ? (
                        <p className="apex-notifications-empty">No notifications yet.</p>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
