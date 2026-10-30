"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay, FiX } from "react-icons/fi";
import { useSetUser } from "@/contexts/UserContext";
import { getPeriodLabel } from "@/lib/dataWrapped";
import { usePrefersReducedMotion } from "./wrappedMotion";
import { buildSlides } from "./wrappedSlides";
import "../wrapped.css";

const DEFAULT_DATA = {
    customerName: "Your Store",
    netRevenue: 0,
    orders: 0,
    roas: 0,
    poas: 0,
    totalSpend: 0,
    netAov: 0,
    topChannel: "",
    topChannelShare: 0,
    services: [],
};

/**
 * Full-screen Data Wrapped story: flat colour slides, auto-advance with progress segments, tap left or
 * right, swipe, keyboard, hold to pause. `data` can be passed in (demo preview); otherwise it is loaded
 * from the Data Wrapped API for the customer and period.
 */
export default function WrappedStory({ onClose, customerId, customerName, period, data: initialData, skipTeam = false }) {
    const setUser = useSetUser();
    const reduced = usePrefersReducedMotion();
    const stageRef = useRef(null);
    const pointerRef = useRef(null);

    const [data, setData] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData && Boolean(customerId));
    const [error, setError] = useState(null);
    const [members, setMembers] = useState([]);
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState("next");
    const [prevTheme, setPrevTheme] = useState("dark");
    const [paused, setPaused] = useState(false);
    const [holding, setHolding] = useState(false);
    const [runKey, setRunKey] = useState(0);

    const effectivePeriod = period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const periodLabel = getPeriodLabel(effectivePeriod);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        stageRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        if (initialData || !customerId || !effectivePeriod) return undefined;
        let cancelled = false;
        fetch(`/api/data-wrapped/${customerId}?period=${encodeURIComponent(effectivePeriod)}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || "Failed to load");
                return json;
            })
            .then((json) => {
                if (!cancelled) setData(json.data || json);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [customerId, effectivePeriod, initialData]);

    // The team slide is optional: it is simply left out when the team cannot be loaded
    useEffect(() => {
        if (skipTeam || !customerId) return undefined;
        let cancelled = false;
        fetch(`/api/clickup-team-members/${customerId}`)
            .then((res) => (res.ok ? res.json() : { members: [] }))
            .then((json) => {
                if (!cancelled) setMembers(Array.isArray(json.members) ? json.members : []);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [customerId, skipTeam]);

    useEffect(() => {
        if (initialData || !effectivePeriod || loading || error || !customerId) return undefined;
        fetch("/api/data-wrapped/mark-opened", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, period: effectivePeriod }),
        })
            .then((res) => {
                if (!res.ok) return;
                setUser((prev) => {
                    const prevObj = prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods) ? prev.openedWrappedPeriods : {};
                    const customerPeriods = [...new Set([...(prevObj[customerId] || []), effectivePeriod])];
                    return { ...prev, openedWrappedPeriods: { ...prevObj, [customerId]: customerPeriods } };
                });
            })
            .catch(() => {});
        return undefined;
    }, [effectivePeriod, loading, error, customerId, setUser, initialData]);

    const wrapped = useMemo(
        () => ({ ...DEFAULT_DATA, customerName: customerName || DEFAULT_DATA.customerName, period: effectivePeriod, ...data }),
        [data, customerName, effectivePeriod]
    );

    const replay = useCallback(() => {
        setDirection("prev");
        setIndex(0);
        setRunKey((k) => k + 1);
    }, []);

    const slides = useMemo(
        () => buildSlides({ d: wrapped, periodLabel, members, onReplay: replay, onClose }),
        [wrapped, periodLabel, members, replay, onClose]
    );

    const last = slides.length - 1;
    const safeIndex = Math.min(index, last);
    const slide = slides[safeIndex];

    const go = useCallback(
        (to) => {
            const clamped = Math.max(0, Math.min(last, to));
            if (clamped === safeIndex) return;
            setDirection(clamped > safeIndex ? "next" : "prev");
            setPrevTheme(slides[safeIndex]?.theme || "dark");
            setIndex(clamped);
        },
        [last, safeIndex, slides]
    );

    const next = useCallback(() => go(safeIndex + 1), [go, safeIndex]);
    const prev = useCallback(() => go(safeIndex - 1), [go, safeIndex]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                next();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prev();
            } else if (e.key.toLowerCase() === "p") setPaused((v) => !v);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [next, prev, onClose]);

    // Also pause when the tab is hidden so the story does not run on without anyone watching
    useEffect(() => {
        const onVis = () => {
            if (document.hidden) setPaused(true);
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, []);

    const onPointerDown = (e) => {
        if (e.target.closest("button, a")) return;
        pointerRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), timer: setTimeout(() => setHolding(true), 220) };
    };

    const onPointerUp = (e) => {
        const p = pointerRef.current;
        if (!p) return;
        clearTimeout(p.timer);
        pointerRef.current = null;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (holding) {
            setHolding(false);
            return;
        }
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next();
            else prev();
            return;
        }
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width * 0.33) prev();
            else next();
        }
    };

    const onPointerCancel = () => {
        const p = pointerRef.current;
        if (p) clearTimeout(p.timer);
        pointerRef.current = null;
        setHolding(false);
    };

    const running = !paused && !holding && !reduced;

    return (
        <div
            className="w-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Data Wrapped, ${periodLabel}`}
            ref={stageRef}
            tabIndex={-1}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <button type="button" className="w-nav w-nav--prev" onClick={prev} disabled={safeIndex === 0} aria-label="Previous slide">
                <FiChevronLeft />
            </button>

            <div className={`w-card w-theme-${slide?.theme || prevTheme}`}>
                {loading ? (
                    <div className="w-state" role="status">
                        <span className="w-state__spinner" aria-hidden />
                        <p>Loading your wrapped</p>
                    </div>
                ) : error ? (
                    <div className="w-state" role="alert">
                        <p>{error}</p>
                        <button type="button" className="w-btn" onClick={onClose}>
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-progress" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={safeIndex + 1} aria-label={`Slide ${safeIndex + 1} of ${slides.length}: ${slide.label}`}>
                            {slides.map((s, i) => (
                                <span key={s.id} className={`w-progress__seg${i < safeIndex ? " is-done" : ""}${i === safeIndex ? " is-active" : ""}`}>
                                    {i === safeIndex ? (
                                        <span
                                            key={`${runKey}-${safeIndex}`}
                                            className="w-progress__fill"
                                            style={{
                                                animationDuration: slide.duration ? `${slide.duration}ms` : "0ms",
                                                animationPlayState: running ? "running" : "paused",
                                                width: slide.duration ? undefined : "100%",
                                            }}
                                            onAnimationEnd={() => {
                                                if (slide.duration) next();
                                            }}
                                        />
                                    ) : null}
                                </span>
                            ))}
                        </div>

                        <div className="w-top">
                            <span className="w-top__label">{slide.label}</span>
                            <div className="w-top__actions">
                                <button type="button" className="w-icon-btn" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Play" : "Pause"} aria-pressed={paused}>
                                    {paused ? <FiPlay /> : <FiPause />}
                                </button>
                                <button type="button" className="w-icon-btn" onClick={onClose} aria-label="Close">
                                    <FiX />
                                </button>
                            </div>
                        </div>

                        <div className="w-stage" style={{ "--w-prev": `var(--w-bg-${prevTheme})` }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerCancel}>
                            <section key={`${slide.id}-${runKey}`} className={`w-slide w-theme-${slide.theme} w-dir-${direction}`} aria-live="polite">
                                {slide.render()}
                            </section>
                        </div>
                    </>
                )}
            </div>

            <button type="button" className="w-nav w-nav--next" onClick={next} disabled={safeIndex >= last} aria-label="Next slide">
                <FiChevronRight />
            </button>
        </div>
    );
}
