"use client";

import React, { useState } from "react";

export function getInitials(name, email) {
    const source = (name || "").trim() || (email || "").split("@")[0] || "";
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMemberSince(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Avatar that previews the typed image URL live and falls back to initials when missing or broken. */
export function ProfileAvatar({ image, name, email, size = "lg" }) {
    const [brokenSrc, setBrokenSrc] = useState(null);
    const showImage = Boolean(image) && brokenSrc !== image;
    return (
        <div className={`apex-profile-avatar apex-profile-avatar--${size}`}>
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={name ? `${name} profile picture` : "Profile picture"} onError={() => setBrokenSrc(image)} />
            ) : (
                <span aria-hidden="true">{getInitials(name, email)}</span>
            )}
        </div>
    );
}

export default function ProfileSummary({ form, integrations, sharedCount, loading }) {
    if (loading) {
        return (
            <aside className="apex-profile-card apex-profile-summary" aria-busy="true">
                <div className="apex-profile-skeleton apex-profile-skeleton--avatar" />
                <div className="apex-profile-skeleton apex-profile-skeleton--line" />
                <div className="apex-profile-skeleton apex-profile-skeleton--line apex-profile-skeleton--short" />
            </aside>
        );
    }

    const since = formatMemberSince(form.createdAt);
    const connections = [
        { label: "Slack", on: Boolean(integrations.slackId) },
        { label: "ClickUp", on: Boolean(integrations.clickupId) },
    ];

    return (
        <aside className="apex-profile-card apex-profile-summary" aria-label="Account summary">
            <ProfileAvatar image={form.image} name={form.name} email={form.email} />
            <div className="apex-profile-summary__id">
                <h2 className="apex-profile-summary__name">{form.name || "Unnamed user"}</h2>
                <p className="apex-profile-summary__email">{form.email}</p>
            </div>

            <dl className="apex-profile-facts">
                {since ? (
                    <div>
                        <dt>Member since</dt>
                        <dd>{since}</dd>
                    </div>
                ) : null}
                <div>
                    <dt>Shared customers</dt>
                    <dd>{sharedCount}</dd>
                </div>
            </dl>

            <ul className="apex-profile-status" aria-label="Connected accounts">
                {connections.map((c) => (
                    <li key={c.label} className={c.on ? "is-on" : ""}>
                        <span className="apex-profile-status__dot" aria-hidden="true" />
                        {c.label}
                        <span className="apex-profile-status__state">{c.on ? "Connected" : "Not set"}</span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
