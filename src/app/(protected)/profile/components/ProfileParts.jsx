"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiCheck, FiEye, FiEyeOff, FiLogOut, FiStar, FiUsers } from "react-icons/fi";
import { SiClickup, SiSlack } from "react-icons/si";

export function initialsOf(name, email) {
    const source = String(name || "").trim() || String(email || "").split("@")[0] || "?";
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Profile picture from a URL, falling back to initials when there is no picture or it fails to load. */
export function UserAvatar({ image, name, email, size = 96, className = "" }) {
    const [failedSrc, setFailedSrc] = useState("");
    const src = String(image || "").trim();
    const showImage = src && failedSrc !== src;
    return (
        <span className={`apex-pf__avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- user supplied URL, any host
                <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
            ) : (
                <span aria-hidden>{initialsOf(name, email)}</span>
            )}
        </span>
    );
}

function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** The one dark card: who you are, your role and a few real numbers. */
export function ProfileHero({ user, form, pinnedCount, propertyCount, propertyLabel, onLogout }) {
    const roles = [];
    if (user?.isAdmin) roles.push("Admin");
    if (user?.isExternal) roles.push("External access");
    if (roles.length === 0) roles.push("Team member");
    const since = formatDate(user?.createdAt);

    return (
        <section className="apex-pf__hero" aria-label="Your profile">
            <UserAvatar image={form.image} name={form.name} email={form.email} size={96} className="apex-pf__avatar--hero" />
            <div className="apex-pf__hero-text">
                <h2 className="apex-pf__hero-name">{form.name || "Your profile"}</h2>
                <p className="apex-pf__hero-email">{form.email}</p>
                <ul className="apex-pf__roles" aria-label="Your role">
                    {roles.map((r) => (
                        <li key={r}>{r}</li>
                    ))}
                </ul>
            </div>

            <dl className="apex-pf__stats">
                <div>
                    <dt>
                        <FiStar aria-hidden /> Pinned
                    </dt>
                    <dd>{pinnedCount}</dd>
                </div>
                <div>
                    <dt>
                        <FiUsers aria-hidden /> {propertyLabel}
                    </dt>
                    <dd>{propertyCount}</dd>
                </div>
            </dl>

            <div className="apex-pf__hero-foot">
                {since ? <span>Member since {since}</span> : <span />}
                <button type="button" className="apex-pf__logout" onClick={onLogout}>
                    <FiLogOut aria-hidden /> Log out
                </button>
            </div>
        </section>
    );
}

export function Card({ id, title, description, children, footer }) {
    return (
        <section className="apex-pf__card" aria-labelledby={`${id}-title`}>
            <header className="apex-pf__card-head">
                <h2 id={`${id}-title`} className="apex-pf__card-title">
                    {title}
                </h2>
                {description ? <p className="apex-pf__card-desc">{description}</p> : null}
            </header>
            {children}
            {footer}
        </section>
    );
}

/** Save and discard, only active while the section has changes. */
export function SaveRow({ dirty, saving, onDiscard, label = "Save changes", disabled = false }) {
    return (
        <div className="apex-pf__save">
            <span className={`apex-pf__dirty${dirty ? " is-on" : ""}`} aria-live="polite">
                {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <div className="apex-pf__save-actions">
                <button type="button" className="apex-pf__btn" onClick={onDiscard} disabled={!dirty || saving}>
                    Discard
                </button>
                <button type="submit" className="apex-pf__btn apex-pf__btn--primary" disabled={!dirty || saving || disabled}>
                    {saving ? "Saving" : label}
                </button>
            </div>
        </div>
    );
}

export function Field({ id, label, hint, error, children, required = false }) {
    return (
        <div className="apex-pf__field">
            <label htmlFor={id} className="apex-pf__label">
                {label}
                {required ? <span aria-hidden> *</span> : null}
            </label>
            {children}
            {error ? (
                <p className="apex-pf__error" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p className="apex-pf__hint">{hint}</p>
            ) : null}
        </div>
    );
}

export function PasswordInput({ id, name, value, onChange, placeholder, autoComplete, invalid }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="apex-pf__password">
            <input id={id} name={name} type={visible ? "text" : "password"} className="apex-pf__input" value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={invalid ? "true" : undefined} />
            <button type="button" className="apex-pf__eye" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
                {visible ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
            </button>
        </div>
    );
}

const BRANDS = {
    slack: { Icon: SiSlack, bg: "#4A154B", label: "Slack" },
    clickup: { Icon: SiClickup, bg: "#7B68EE", label: "ClickUp" },
};

export function BrandTile({ brand }) {
    const { Icon, bg, label } = BRANDS[brand];
    return (
        <span className="apex-pf__brand" style={{ background: bg }} title={label} aria-hidden>
            <Icon />
        </span>
    );
}

export function ConnectionStatus({ connected }) {
    return connected ? (
        <span className="apex-pf__status is-on">
            <FiCheck aria-hidden /> Connected
        </span>
    ) : (
        <span className="apex-pf__status">Not connected</span>
    );
}

export function PropertyList({ title, items, empty }) {
    return (
        <div className="apex-pf__plist">
            <h3 className="apex-pf__plist-title">
                {title} <span>{items.length}</span>
            </h3>
            {items.length === 0 ? (
                <p className="apex-pf__plist-empty">{empty}</p>
            ) : (
                <ul>
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link href={`/dashboard/${item.id}/performance-dashboard`} className="apex-pf__plink">
                                <span>{item.label}</span>
                                <FiArrowUpRight aria-hidden />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
