"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FiArrowUpRight, FiBell, FiCheck } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { CategoryBadge, NotificationLink } from "@/components/notifications/NotificationParts";
import { CATEGORY_LABELS, NOTIFICATIONS_READ_EVENT, categoryOf, formatRelativeTime, groupNotifications } from "@/components/notifications/notificationUtils";
import "./notifications.css";

const FILTERS = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "alert", label: "Alerts" },
    { id: "feature", label: "New features" },
    { id: "system", label: "System" },
];

function matches(n, filter) {
    if (filter === "all") return true;
    if (filter === "unread") return !n.readAt;
    return categoryOf(n) === filter;
}

function NotificationRow({ n }) {
    const hasLink = Boolean(String(n.linkUrl || "").trim());
    const unread = !n.readAt;
    return (
        <NotificationLink n={n} className={`apex-npage__row${unread ? " is-unread" : ""}${hasLink ? " has-link" : ""}`}>
            <CategoryBadge category={n.category} />
            <div className="apex-npage__text">
                <p className="apex-npage__title">
                    {n.title}
                    {unread ? <span className="apex-npage__new">New</span> : null}
                </p>
                <p className="apex-npage__body">{n.body}</p>
                <p className="apex-npage__meta">
                    <span>{formatRelativeTime(n.createdAt, { withYear: true })}</span>
                    <span aria-hidden>·</span>
                    <span>{CATEGORY_LABELS[categoryOf(n)]}</span>
                    {n.authorName ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="apex-npage__author">
                                {n.authorImage ? <Image src={n.authorImage} alt="" width={16} height={16} unoptimized /> : null}
                                {n.authorName}
                            </span>
                        </>
                    ) : null}
                </p>
            </div>
            {n.imageUrl ? (
                <div className="apex-npage__thumb">
                    <Image src={n.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
            ) : null}
            {hasLink ? <FiArrowUpRight className="apex-npage__go" aria-hidden /> : null}
        </NotificationLink>
    );
}

function Section({ title, items }) {
    if (!items.length) return null;
    return (
        <section className="apex-npage__section" aria-label={title}>
            <h2 className="apex-npage__section-title">
                {title} <span>{items.length}</span>
            </h2>
            <div className="apex-npage__card">
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
    const [filter, setFilter] = useState("all");
    const [marking, setMarking] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
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
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Opening the bell in the topbar marks everything read, so mirror that here
    useEffect(() => {
        const onRead = () => setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
        window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
        return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    }, []);

    const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
    const counts = useMemo(() => {
        const c = { all: items.length, unread: unreadCount, alert: 0, feature: 0, system: 0 };
        for (const n of items) c[categoryOf(n)] += 1;
        return c;
    }, [items, unreadCount]);

    const visible = useMemo(() => items.filter((n) => matches(n, filter)), [items, filter]);
    const groups = useMemo(() => groupNotifications(visible), [visible]);

    const markAllRead = async () => {
        if (marking || unreadCount === 0) return;
        setMarking(true);
        try {
            const res = await fetch("/api/notifications/mark-read", { method: "POST" });
            if (!res.ok) throw new Error("Could not mark as read");
            const now = new Date().toISOString();
            setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
            window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
        } catch (e) {
            setError(e.message);
        } finally {
            setMarking(false);
        }
    };

    return (
        <div id="NotificationsPage" className="apex-perf w-full apex-npage">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Notifications"
                label={loading ? "Loading" : unreadCount > 0 ? `${unreadCount} unread` : "You are up to date"}
            />

            <div className="apex-npage__layout">
                <aside className="apex-npage__rail" aria-label="Summary and filters">
                    <div className="apex-npage__kpis">
                        <div className="apex-npage__kpi apex-npage__kpi--hero">
                            <span className="apex-npage__kpi-icon" aria-hidden>
                                <FiBell />
                            </span>
                            <div>
                                <p className="apex-npage__kpi-label">Unread</p>
                                <p className="apex-npage__kpi-value">{loading ? "-" : unreadCount}</p>
                            </div>
                        </div>
                        <div className="apex-npage__kpi">
                            <div>
                                <p className="apex-npage__kpi-label">In your history</p>
                                <p className="apex-npage__kpi-value">{loading ? "-" : items.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="apex-npage__filters" role="group" aria-label="Filter notifications">
                        {FILTERS.map((f) => (
                            <button key={f.id} type="button" className={`apex-npage__filter${filter === f.id ? " is-active" : ""}`} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} disabled={loading}>
                                <span>{f.label}</span>
                                <span className="apex-npage__filter-count">{counts[f.id]}</span>
                            </button>
                        ))}
                    </div>

                    <button type="button" className="apex-npage__mark" onClick={markAllRead} disabled={loading || marking || unreadCount === 0}>
                        <FiCheck aria-hidden />
                        {marking ? "Marking" : "Mark all as read"}
                    </button>
                </aside>

                <div className="apex-npage__main">
                    {loading ? (
                        <div className="apex-npage__card" aria-hidden>
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="apex-npage__skeleton">
                                    <i />
                                    <div>
                                        <i />
                                        <i />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="apex-npage__state apex-npage__state--error" role="alert">
                            <p>{error}</p>
                            <button type="button" className="apex-npage__retry" onClick={load}>
                                Try again
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="apex-npage__state">
                            <CategoryBadge category="system" />
                            <p>No notifications yet</p>
                            <small>Updates and alerts from Searchmind will appear here.</small>
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="apex-npage__state">
                            <CategoryBadge category="system" />
                            <p>Nothing matches this filter</p>
                            <button type="button" className="apex-npage__retry" onClick={() => setFilter("all")}>
                                Show all
                            </button>
                        </div>
                    ) : (
                        <>
                            <Section title="Today" items={groups.today} />
                            <Section title="This week" items={groups.thisWeek} />
                            <Section title="Earlier" items={groups.older} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
