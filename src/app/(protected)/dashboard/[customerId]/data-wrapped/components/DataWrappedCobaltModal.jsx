"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSetUser } from "@/contexts/UserContext";
import CobaltLoader from "@/components/ui/CobaltLoader";
import {
    FiX,
    FiChevronLeft,
    FiChevronRight,
    FiDollarSign,
    FiShoppingCart,
    FiBarChart2,
    FiCreditCard,
    FiTrendingUp,
    FiPieChart,
    FiShoppingBag,
    FiArrowRight,
} from "react-icons/fi";
import { TeamSlideContent } from "./DataWrappedTeamSlide";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const SLIDE_COUNT = 12;

function getPeriodLabel(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return "";
    const [y, m] = period.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

const DEFAULT_WRAPPED_DATA = {
    customerName: "Your Store",
    year: new Date().getFullYear(),
    netRevenue: 0,
    orders: 0,
    roas: 0,
    poas: 0,
    totalSpend: 0,
    netAov: 0,
    topChannel: "—",
    topChannelShare: 0,
    services: [],
};

function AnimatedNumber({ value, duration = 1200, format = "integer", className = "", active = true }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (!active) return undefined;
        const target = Number(value);
        if (Number.isNaN(target)) return undefined;

        let rafId;
        const startTime = performance.now();
        const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - (1 - progress) ** 3;
            setDisplayValue(target * eased);
            if (progress < 1) rafId = requestAnimationFrame(animate);
        };
        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    }, [value, duration, active]);

    const formatted =
        format === "currency"
            ? displayValue.toLocaleString("da-DK", {
                  style: "currency",
                  currency: "DKK",
                  maximumFractionDigits: 0,
              })
            : format === "decimal2"
              ? displayValue.toLocaleString("da-DK", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })
              : format === "percent"
                ? `${Math.round(displayValue).toLocaleString("da-DK")}%`
                : Math.round(displayValue).toLocaleString("da-DK");

    return <span className={className}>{formatted}</span>;
}

export default function DataWrappedCobaltModal({
    onClose,
    customerId,
    customerName,
    period,
    data: initialData,
}) {
    const setUser = useSetUser();
    const trackRef = useRef(null);
    const slideRefs = useRef([]);
    const activeIndexRef = useRef(0);
    const scrollLockRef = useRef(false);
    const scrollLockUntilRef = useRef(0);
    const wheelDeltaRef = useRef(0);
    const wheelResetTimerRef = useRef(null);

    const [data, setData] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const effectivePeriod =
        period ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        if (initialData) return undefined;
        if (!customerId || !effectivePeriod) {
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
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

    useEffect(() => {
        if (!effectivePeriod || loading || error || !customerId) return undefined;
        fetch("/api/data-wrapped/mark-opened", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, period: effectivePeriod }),
        })
            .then((res) => {
                if (res.ok) {
                    setUser((prev) => {
                        const prevObj =
                            prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods)
                                ? prev.openedWrappedPeriods
                                : {};
                        const customerPeriods = [
                            ...new Set([...(prevObj[customerId] || []), effectivePeriod]),
                        ];
                        return {
                            ...prev,
                            openedWrappedPeriods: { ...prevObj, [customerId]: customerPeriods },
                        };
                    });
                }
            })
            .catch(() => {});
        return undefined;
    }, [effectivePeriod, loading, error, customerId, setUser]);

    const wrappedData = {
        ...DEFAULT_WRAPPED_DATA,
        customerName: customerName || DEFAULT_WRAPPED_DATA.customerName,
        period: effectivePeriod,
        periodLabel: getPeriodLabel(effectivePeriod),
        ...data,
    };

    const syncIndexFromScroll = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        const slideWidth = track.clientWidth;
        if (!slideWidth) return;
        const idx = Math.round(track.scrollLeft / slideWidth);
        const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, idx));
        if (clamped !== activeIndexRef.current) {
            activeIndexRef.current = clamped;
            setActiveIndex(clamped);
        }
    }, []);

    const releaseScrollLock = useCallback(() => {
        if (Date.now() < scrollLockUntilRef.current) return;
        scrollLockRef.current = false;
        syncIndexFromScroll();
    }, [syncIndexFromScroll]);

    const scrollToIndex = useCallback(
        (index) => {
            if (scrollLockRef.current) return;

            const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, index));
            if (clamped === activeIndexRef.current) return;

            const el = slideRefs.current[clamped];
            if (!el) return;

            scrollLockRef.current = true;
            scrollLockUntilRef.current = Date.now() + 550;
            activeIndexRef.current = clamped;
            setActiveIndex(clamped);
            el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });

            window.setTimeout(releaseScrollLock, 700);
        },
        [releaseScrollLock]
    );

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track || loading || error) return undefined;

        const onScroll = () => {
            if (scrollLockRef.current) return;
            syncIndexFromScroll();
        };

        const onScrollEnd = () => {
            releaseScrollLock();
        };

        track.addEventListener("scroll", onScroll, { passive: true });
        track.addEventListener("scrollend", onScrollEnd);

        return () => {
            track.removeEventListener("scroll", onScroll);
            track.removeEventListener("scrollend", onScrollEnd);
        };
    }, [loading, error, syncIndexFromScroll, releaseScrollLock]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") scrollToIndex(activeIndex - 1);
            if (e.key === "ArrowRight") scrollToIndex(activeIndex + 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, activeIndex, scrollToIndex]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track || loading || error) return undefined;

        const WHEEL_THRESHOLD = 48;

        const onWheel = (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            if (scrollLockRef.current) return;

            wheelDeltaRef.current += e.deltaY;

            if (wheelResetTimerRef.current) {
                window.clearTimeout(wheelResetTimerRef.current);
            }
            wheelResetTimerRef.current = window.setTimeout(() => {
                wheelDeltaRef.current = 0;
            }, 180);

            if (Math.abs(wheelDeltaRef.current) < WHEEL_THRESHOLD) return;

            const direction = wheelDeltaRef.current > 0 ? 1 : -1;
            wheelDeltaRef.current = 0;
            scrollToIndex(activeIndexRef.current + direction);
        };

        track.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            track.removeEventListener("wheel", onWheel);
            if (wheelResetTimerRef.current) {
                window.clearTimeout(wheelResetTimerRef.current);
            }
        };
    }, [loading, error, scrollToIndex]);

    const d = wrappedData;
    const periodLabel = d.periodLabel || getPeriodLabel(d.period);
    const isActive = (i) => i === activeIndex;

    const slides = [
        {
            id: "intro",
            label: "Introduction",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">{periodLabel}</p>
                    <h2 className="apex-dw-slide__title">{d.customerName}</h2>
                    <h2 className="apex-dw-slide__title apex-dw-slide__title-accent">Data Wrapped</h2>
                    <p className="apex-dw-slide__sub">Your monthly ecommerce performance, wrapped.</p>
                </>
            ),
        },
        {
            id: "revenue",
            label: "Net revenue",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Net revenue</p>
                    <div className="apex-dw-slide__value-row">
                        <FiDollarSign size={40} />
                        <AnimatedNumber
                            active={isActive(1)}
                            value={d.netRevenue}
                            className="apex-dw-slide__value"
                        />
                    </div>
                    <p className="apex-dw-slide__sub">DKK in total sales this month</p>
                </>
            ),
        },
        {
            id: "orders",
            label: "Orders",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Orders</p>
                    <div className="apex-dw-slide__value-row">
                        <FiShoppingCart size={40} />
                        <AnimatedNumber active={isActive(2)} value={d.orders} className="apex-dw-slide__value" />
                    </div>
                    <p className="apex-dw-slide__sub">Orders placed this month</p>
                </>
            ),
        },
        {
            id: "roas",
            label: "Blended ROAS",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Blended ROAS</p>
                    <div className="apex-dw-slide__value-row">
                        <FiBarChart2 size={40} />
                        <AnimatedNumber
                            active={isActive(3)}
                            value={d.roas}
                            format="decimal2"
                            className="apex-dw-slide__value"
                        />
                    </div>
                    <p className="apex-dw-slide__sub">Return on ad spend</p>
                </>
            ),
        },
        {
            id: "poas",
            label: "Blended POAS",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Blended POAS</p>
                    <div className="apex-dw-slide__value-row">
                        <FiPieChart size={40} />
                        <AnimatedNumber
                            active={isActive(4)}
                            value={d.poas}
                            format="decimal2"
                            className="apex-dw-slide__value"
                        />
                    </div>
                    <p className="apex-dw-slide__sub">Gross profit / ad spend (break-even 1.0)</p>
                </>
            ),
        },
        {
            id: "spend",
            label: "Total ad spend",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Total ad spend</p>
                    <div className="apex-dw-slide__value-row">
                        <FiCreditCard size={40} />
                        <AnimatedNumber
                            active={isActive(5)}
                            value={d.totalSpend}
                            className="apex-dw-slide__value"
                        />
                    </div>
                    <p className="apex-dw-slide__sub">DKK invested in marketing</p>
                </>
            ),
        },
        {
            id: "aov",
            label: "Net AOV",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Net AOV</p>
                    <div className="apex-dw-slide__value-row">
                        <FiShoppingBag size={40} />
                        <AnimatedNumber
                            active={isActive(6)}
                            value={d.netAov}
                            format="currency"
                            className="apex-dw-slide__value"
                        />
                    </div>
                    <p className="apex-dw-slide__sub">Average order value</p>
                </>
            ),
        },
        {
            id: "channel",
            label: "Top channel",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Top channel</p>
                    <div className="apex-dw-slide__value-row">
                        <FiTrendingUp size={40} />
                        <span className="apex-dw-slide__value" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                            {d.topChannel}
                        </span>
                    </div>
                    <p className="apex-dw-slide__sub">
                        <AnimatedNumber
                            active={isActive(7)}
                            value={d.topChannelShare}
                            format="percent"
                            className="font-semibold"
                        />{" "}
                        of your ad spend
                    </p>
                </>
            ),
        },
        {
            id: "services",
            label: "Active services",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Active services</p>
                    <div className="apex-dw-slide__chips">
                        {(d.services || []).map((s, i) => (
                            <span key={i} className="apex-dw-slide__chip">
                                {s}
                            </span>
                        ))}
                    </div>
                    <p className="apex-dw-slide__sub">Powered by Searchmind</p>
                </>
            ),
        },
        {
            id: "team",
            label: "Your team",
            render: () => (
                <TeamSlideContent customerId={customerId} variant="cobalt" active={isActive(9)} />
            ),
        },
        {
            id: "summary",
            label: "Highlights",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">{periodLabel} highlights</p>
                    <h2 className="apex-dw-slide__title" style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)" }}>
                        Your month in numbers
                    </h2>
                    <div className="apex-dw-slide__summary-grid">
                        <div className="apex-dw-slide__summary-row">
                            <span>Net revenue</span>
                            <AnimatedNumber active={isActive(10)} value={d.netRevenue} />
                        </div>
                        <div className="apex-dw-slide__summary-row">
                            <span>Orders</span>
                            <AnimatedNumber active={isActive(10)} value={d.orders} />
                        </div>
                        <div className="apex-dw-slide__summary-row is-accent">
                            <span>ROAS</span>
                            <AnimatedNumber active={isActive(10)} value={d.roas} format="decimal2" />
                        </div>
                        <div className="apex-dw-slide__summary-row is-accent">
                            <span>POAS</span>
                            <AnimatedNumber active={isActive(10)} value={d.poas} format="decimal2" />
                        </div>
                        <div className="apex-dw-slide__summary-row" style={{ gridColumn: "1 / -1" }}>
                            <span>Top channel</span>
                            <span>{d.topChannel}</span>
                        </div>
                    </div>
                </>
            ),
        },
        {
            id: "outro",
            label: "See you next month",
            render: () => (
                <>
                    <p className="apex-dw-slide__eyebrow">Thanks for a great month</p>
                    <h2 className="apex-dw-slide__title">See you next month</h2>
                    <p className="apex-dw-slide__sub">
                        Your Data Wrapped {periodLabel}. Share your results and keep growing.
                    </p>
                </>
            ),
        },
    ];

    const activeSlide = slides[activeIndex];

    return (
        <div
            className="apex-dw-modal-backdrop cobalt-perf"
            data-theme="cobalt"
            role="dialog"
            aria-modal="true"
            aria-label="Data Wrapped"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="apex-dw-modal-shell" onMouseDown={(e) => e.stopPropagation()}>
                <div className="apex-dw-modal-top">
                    <div className="apex-dw-modal-top__meta">
                        <span className="apex-dw-modal-top__eyebrow">Data Wrapped · {periodLabel}</span>
                        <h2 className="apex-dw-modal-top__title">{d.customerName}</h2>
                    </div>
                    <div className="apex-dw-modal-top__actions">
                        <button type="button" onClick={onClose} className="apex-dw-modal-close" aria-label="Close">
                            <FiX size={20} />
                        </button>
                    </div>
                </div>

                {!loading && !error ? (
                    <div
                        className="apex-dw-modal-progress"
                        role="progressbar"
                        aria-valuemin={1}
                        aria-valuemax={SLIDE_COUNT}
                        aria-valuenow={activeIndex + 1}
                        aria-label={`Section ${activeIndex + 1} of ${SLIDE_COUNT}: ${activeSlide?.label ?? ""}`}
                    >
                        <div className="apex-dw-modal-progress__head">
                            <span key={activeIndex} className="apex-dw-modal-progress__label">
                                {activeSlide?.label}
                            </span>
                            <span className="apex-dw-modal-progress__count">
                                {activeIndex + 1} / {SLIDE_COUNT}
                            </span>
                        </div>
                        <div className="apex-dw-modal-progress__track">
                            <div
                                className="apex-dw-modal-progress__bar"
                                style={{ width: `${((activeIndex + 1) / SLIDE_COUNT) * 100}%` }}
                            />
                        </div>
                        <div className="apex-dw-modal-progress__segments">
                            {slides.map((slide, i) => (
                                <button
                                    key={slide.id}
                                    type="button"
                                    className={`apex-dw-modal-progress__seg${i <= activeIndex ? " is-reached" : ""}${i === activeIndex ? " is-active" : ""}`}
                                    aria-label={`Go to ${slide.label}`}
                                    aria-current={i === activeIndex ? "step" : undefined}
                                    onClick={() => scrollToIndex(i)}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}

                {loading ? (
                    <div className="apex-dw-modal-loading">
                        <CobaltLoader variant="block" title="Loading your wrapped" />
                    </div>
                ) : error ? (
                    <div className="apex-dw-modal-error">
                        <p>{error}</p>
                        <button type="button" onClick={onClose} className="apex-perf-btn apex-perf-btn--secondary">
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <div ref={trackRef} className="apex-dw-modal-track">
                            {slides.map((slide, i) => (
                                <section
                                    key={slide.id}
                                    ref={(el) => {
                                        slideRefs.current[i] = el;
                                    }}
                                    data-slide-index={i}
                                    className={`apex-dw-modal-slide${i === activeIndex ? " is-active" : ""}`}
                                    aria-label={`Slide ${i + 1} of ${SLIDE_COUNT}`}
                                >
                                    <div className="apex-dw-slide-content">{slide.render()}</div>
                                </section>
                            ))}
                        </div>

                        <div className="apex-dw-modal-foot">
                            <button
                                type="button"
                                className="apex-dw-modal-nav-btn"
                                disabled={activeIndex <= 0}
                                onClick={() => scrollToIndex(activeIndex - 1)}
                                aria-label="Previous section"
                            >
                                <FiChevronLeft />
                                Back
                            </button>

                            <span className="apex-dw-modal-counter">
                                {activeIndex + 1} / {SLIDE_COUNT}
                            </span>

                            <span className="apex-dw-modal-hint">
                                Scroll or swipe
                                <span className="apex-dw-modal-hint__arrows">
                                    <FiArrowRight />
                                </span>
                            </span>

                            <button
                                type="button"
                                className="apex-dw-modal-nav-btn"
                                disabled={activeIndex >= SLIDE_COUNT - 1}
                                onClick={() => scrollToIndex(activeIndex + 1)}
                                aria-label="Next section"
                            >
                                Next
                                <FiChevronRight />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
