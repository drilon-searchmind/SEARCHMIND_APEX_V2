"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { normalizeInternalNotificationHref } from "@/lib/notificationLink";

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

function NotificationRow({ n }) {
    const raw = (n.linkUrl || "").trim();
    const href = raw ? normalizeInternalNotificationHref(raw) : null;
    const inner = (
        <div className="flex gap-3 py-4 border-b border-gray-100 last:border-0">
            <div className="relative shrink-0">
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
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary-searchmind-lighter)] flex items-center justify-center text-sm font-semibold text-gray-700">
                        {(n.authorName || "A")[0]}
                    </div>
                )}
                {!n.readAt && <span className="absolute -left-1 top-0 w-2 h-2 rounded-full bg-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
            </div>
            {n.imageUrl ? (
                <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={n.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
            ) : null}
        </div>
    );
    if (href) {
        if (href.startsWith("http")) {
            return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50/80 -mx-2 px-2 rounded-lg">
                    {inner}
                </a>
            );
        }
        return (
            <Link href={href} className="block hover:bg-gray-50/80 -mx-2 px-2 rounded-lg">
                {inner}
            </Link>
        );
    }
    return inner;
}

function Section({ title, items }) {
    if (!items.length) return null;
    return (
        <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{title}</h2>
            <div className="bg-white rounded-xl border border-gray-200 px-4">
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

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h1>
            <p className="text-sm text-gray-600 mb-8">
                You have{" "}
                <span className="font-semibold text-[var(--color-primary-searchmind)]">{items.length}</span>{" "}
                notification{items.length !== 1 ? "s" : ""} in your history.
            </p>

            {loading && <p className="text-gray-500">Loading…</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            {!loading && !error && (
                <>
                    <Section title="Today" items={groups.today} />
                    <Section title="This week" items={groups.thisWeek} />
                    <Section title="Earlier" items={groups.older} />
                    {items.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-12 bg-white rounded-xl border border-gray-200">
                            No notifications yet.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
