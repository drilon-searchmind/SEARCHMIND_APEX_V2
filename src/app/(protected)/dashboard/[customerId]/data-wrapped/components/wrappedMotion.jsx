"use client";

import React, { useEffect, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight } from "react-icons/fi";
import ChannelLogo from "@/components/ui/ChannelLogo";

/* Motion pieces for the Data Wrapped story. Everything is flat colour and driven by CSS variables set by
   the slide theme (--w-big, --w-fg, --w-muted, --w-shape, --w-shape-2, --w-line). */

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);
    return reduced;
}

export const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString("da-DK");
export const fmt2 = (n) =>
    (Number(n) || 0).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FORMATTERS = {
    int: fmtInt,
    x: fmt2,
    pct: (n) => `${fmtInt(n)}%`,
    pct1: (n) => `${(Number(n) || 0).toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
};

/** Counts from 0 to `value` once the slide mounts. Jumps straight to the value for reduced motion. */
export function CountUp({ value, format = "int", duration = 1400, delay = 250, className = "" }) {
    const reduced = usePrefersReducedMotion();
    const [shown, setShown] = useState(0);
    const target = Number(value) || 0;

    useEffect(() => {
        if (reduced) return undefined;
        let raf;
        let start;
        const timer = setTimeout(() => {
            const tick = (now) => {
                if (start == null) start = now;
                const p = Math.min((now - start) / duration, 1);
                const eased = p === 1 ? 1 : 1 - 2 ** (-10 * p);
                setShown(target * eased);
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        }, delay);
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(raf);
        };
    }, [target, duration, delay, reduced]);

    const fn = FORMATTERS[format] || FORMATTERS.int;
    return <span className={className}>{fn(reduced ? target : shown)}</span>;
}

/** Headline where each word slides up out of a mask. */
export function Reveal({ text, className = "", start = 0 }) {
    return (
        <span className={`w-reveal ${className}`} aria-label={text}>
            {String(text)
                .split(" ")
                .map((word, i) => (
                    <span key={`${word}-${i}`} className="w-reveal__mask" aria-hidden>
                        <span className="w-reveal__word" style={{ "--i": start + i }}>
                            {word}&nbsp;
                        </span>
                    </span>
                ))}
        </span>
    );
}

/** Revenue line that draws itself, with a pulsing marker on the best day. */
export function LineDraw({ values, bestIndex, labelTop }) {
    const W = 360;
    const H = 230;
    const pad = 10;
    const max = Math.max(...values, 1);
    const stepX = (W - pad * 2) / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [pad + i * stepX, H - pad - (v / max) * (H - pad * 2)]);
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - pad} L${pts[0][0].toFixed(1)} ${H - pad} Z`;
    const best = bestIndex != null ? pts[bestIndex] : null;

    return (
        <div className="w-line">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net revenue per day" preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map((f) => (
                    <line key={f} className="w-line__grid" x1={pad} x2={W - pad} y1={pad + (H - pad * 2) * f} y2={pad + (H - pad * 2) * f} />
                ))}
                <path className="w-line__area" d={area} />
                <path className="w-line__stroke" d={line} pathLength="1" />
            </svg>
            {best ? (
                <span className="w-line__marker" style={{ left: `${(best[0] / W) * 100}%`, top: `${(best[1] / H) * 100}%` }} aria-hidden>
                    <span className="w-line__pulse" />
                    <span className="w-line__dot" />
                    {labelTop ? <span className="w-line__tag">{labelTop}</span> : null}
                </span>
            ) : null}
        </div>
    );
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Seven bars that rise one after another, the strongest weekday highlighted. */
export function WeekdayBars({ values, bestIndex }) {
    const max = Math.max(...values, 1);
    return (
        <div className="w-bars" role="img" aria-label="Average net revenue per weekday">
            {values.map((v, i) => (
                <div key={i} className={`w-bars__col${i === bestIndex ? " is-best" : ""}`}>
                    <div className="w-bars__track">
                        <div className="w-bars__fill" style={{ height: `${Math.max((v / max) * 100, 3)}%`, "--i": i }} />
                    </div>
                    <span className="w-bars__label">{DAY_LABELS[i]}</span>
                </div>
            ))}
        </div>
    );
}

/** Channels racing to their share of the budget, with brand logos. */
export function ChannelRace({ rows }) {
    const maxShare = Math.max(...rows.map((r) => r.share), 0.01);
    return (
        <ul className="w-race">
            {rows.map((r, i) => (
                <li key={r.id} className={`w-race__row${i === 0 ? " is-top" : ""}`} style={{ "--i": i }}>
                    <ChannelLogo channel={r.id} size={30} />
                    <div className="w-race__main">
                        <div className="w-race__head">
                            <span className="w-race__name">{r.label}</span>
                            <span className="w-race__value">
                                <CountUp value={r.share * 100} format="pct" delay={350 + i * 120} duration={1100} />
                            </span>
                        </div>
                        <div className="w-race__track">
                            <div className="w-race__fill" style={{ transform: `scaleX(${r.share / maxShare})`, "--i": i }} />
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Half dial with a needle that sweeps to the value. Break-even (1,0) is marked. */
export function Gauge({ value }) {
    const max = Math.max(3, Math.ceil(value + 0.5));
    const ratio = Math.min(Math.max(value / max, 0), 1);
    const angle = -90 + 180 * ratio;
    const breakEven = 1 / max;
    const be = (-90 + 180 * breakEven) * (Math.PI / 180);
    const cx = 100;
    const cy = 100;
    const r = 80;
    const tick = (rad, inner, outer) => ({
        x1: cx + inner * Math.sin(rad),
        y1: cy - inner * Math.cos(rad),
        x2: cx + outer * Math.sin(rad),
        y2: cy - outer * Math.cos(rad),
    });
    const t = tick(be, r - 12, r + 12);

    return (
        <div className="w-gauge">
            <svg viewBox="0 0 200 118" role="img" aria-label={`POAS ${fmt2(value)}`}>
                <path className="w-gauge__track" d="M 20 100 A 80 80 0 0 1 180 100" pathLength="1" />
                <path className="w-gauge__value" d="M 20 100 A 80 80 0 0 1 180 100" pathLength="1" style={{ "--to": 1 - ratio }} />
                <line className="w-gauge__tick" {...t} />
                <g className="w-gauge__needle" style={{ "--angle": `${angle}deg` }}>
                    <line x1={cx} y1={cy} x2={cx} y2={cy - 66} />
                    <circle cx={cx} cy={cy} r="6" />
                </g>
            </svg>
            <span className="w-gauge__be" style={{ left: `${50 + 50 * Math.sin(be) * 0.8}%` }}>
                Break-even
            </span>
        </div>
    );
}

/** One comparison row: old value, new value, and a change chip. */
export function DeltaRow({ label, now, before, format = "int", unit = "", direction = "up-good", index = 0 }) {
    const hasBefore = Number.isFinite(before) && before > 0;
    const change = hasBefore ? ((now - before) / before) * 100 : null;
    const up = change != null && change >= 0;
    const neutral = direction === "neutral";
    const good = neutral ? null : direction === "up-good" ? up : !up;
    const tone = change == null || neutral ? "is-neutral" : good ? "is-good" : "is-bad";
    return (
        <li className="w-delta" style={{ "--i": index }}>
            <div className="w-delta__main">
                <span className="w-delta__label">{label}</span>
                <span className="w-delta__value">
                    <CountUp value={now} format={format} delay={300 + index * 110} duration={1000} />
                    {unit ? <small>{unit}</small> : null}
                </span>
            </div>
            {change != null ? (
                <span className={`w-delta__chip ${tone}`}>
                    {up ? <FiArrowUpRight aria-hidden /> : <FiArrowDownRight aria-hidden />}
                    {Math.abs(change).toLocaleString("da-DK", { maximumFractionDigits: 1 })}%
                </span>
            ) : (
                <span className="w-delta__chip is-neutral">New</span>
            )}
        </li>
    );
}

/** Slow scrolling outline text behind the intro. */
export function Marquee({ text, repeat = 6 }) {
    const items = Array.from({ length: repeat }, (_, i) => <span key={i}>{text}</span>);
    return (
        <div className="w-marquee" aria-hidden>
            <div className="w-marquee__track">
                {items}
                {items}
            </div>
        </div>
    );
}

// Fixed offsets so the confetti is the same on every render (no randomness during render)
const CONFETTI = [
    [6, 0.0, 6, 0], [14, 0.4, 9, 1], [22, 0.15, 7, 2], [31, 0.7, 10, 3], [39, 0.3, 6, 0], [47, 0.95, 8, 1],
    [55, 0.2, 9, 2], [63, 0.6, 7, 3], [71, 0.1, 10, 0], [79, 0.85, 6, 1], [87, 0.45, 8, 2], [94, 0.25, 9, 3],
];

export function Confetti() {
    return (
        <div className="w-confetti" aria-hidden>
            {CONFETTI.map(([x, delay, size, tone], i) => (
                <span key={i} className={`w-confetti__piece is-${tone}`} style={{ left: `${x}%`, width: size, height: size * 1.6, animationDelay: `${delay}s` }} />
            ))}
        </div>
    );
}
