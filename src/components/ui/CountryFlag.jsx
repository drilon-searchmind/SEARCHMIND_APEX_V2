"use client";

import { useState } from "react";
import { FiGlobe } from "react-icons/fi";

const FLAG_BASE_PATH = "/images/flags";
const flagBoxShadow = "0 0 0 1px rgba(17, 26, 18, 0.14)";

/**
 * One country flag from the static files in `public/images/flags` (copied once, so loading a flag
 * never calls an API). Falls back to a globe when the code is missing or has no file.
 *
 * @param {{ code?: string | null, size?: number, title?: string }} props
 */
export default function CountryFlag({ code, size = 22, title }) {
    const [failed, setFailed] = useState(false);
    const valid = typeof code === "string" && /^[A-Za-z]{2}$/.test(code);
    const height = Math.round((size * 2) / 3);

    if (!valid || failed) {
        return (
            <span
                aria-hidden
                title={title}
                style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: size,
                    height,
                    borderRadius: 3,
                    background: "var(--cd-sunk, #EAF0E8)",
                    color: "var(--cd-muted, #859085)",
                    flexShrink: 0,
                }}
            >
                <FiGlobe size={Math.round(height * 0.75)} />
            </span>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs, no optimisation needed
        <img
            src={`${FLAG_BASE_PATH}/${code.toLowerCase()}.svg`}
            alt=""
            title={title}
            width={size}
            height={height}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            style={{ width: size, height, borderRadius: 3, boxShadow: flagBoxShadow, objectFit: "cover", flexShrink: 0 }}
        />
    );
}

/**
 * Flags for a market: one flag for a single country, a short overlapping stack plus "+N" for several,
 * and a globe when the market has no known country.
 *
 * @param {{ codes?: string[], max?: number, size?: number }} props
 */
export function MarketFlags({ codes, max = 3, size = 22 }) {
    const list = Array.isArray(codes) ? codes.filter((c) => /^[A-Za-z]{2}$/.test(String(c))) : [];
    if (list.length === 0) return <CountryFlag size={size} />;
    if (list.length === 1) return <CountryFlag code={list[0]} size={size} title={list[0].toUpperCase()} />;

    const shown = list.slice(0, max);
    const extra = list.length - shown.length;
    return (
        <span
            title={list.map((c) => c.toUpperCase()).join(", ")}
            style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
        >
            {shown.map((c, i) => (
                <span
                    key={c}
                    style={{
                        marginLeft: i === 0 ? 0 : -Math.round(size * 0.36),
                        borderRadius: 3,
                        boxShadow: "0 0 0 1.5px #fff",
                        display: "inline-flex",
                    }}
                >
                    <CountryFlag code={c} size={size} />
                </span>
            ))}
            {extra > 0 ? (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "var(--cd-muted, #859085)" }}>+{extra}</span>
            ) : null}
        </span>
    );
}
