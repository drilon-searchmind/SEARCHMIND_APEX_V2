"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useSetUser } from "@/contexts/UserContext";
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
} from "react-icons/fi";
import { TeamSlideContent } from "./DataWrappedTeamSlide";

/** Pseudo-random 0-1 from seed (deterministic per slide) */
function pseudoRandom(seed) {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
}

/** Decorative vertical lines that randomize position on each slide change. Progressively thinner. */
function DecorativeShapes({ slideKey }) {
    const lineCount = 10;
    const colors = [
        "rgba(198, 237, 98, 0.1)",
        "rgba(255, 255, 255, 0.06)",
        "rgba(64, 105, 105, 0.08)",
        "rgba(214, 205, 182, 0.06)",
    ];

    const lines = useMemo(() => {
        const maxWidth = 20;
        const minWidth = 0.5;
        return Array.from({ length: lineCount }, (_, i) => {
            const seed = slideKey * 31 + i * 7;
            const left = pseudoRandom(seed + 1) * 100;
            const width = maxWidth - (i / (lineCount - 1)) * (maxWidth - minWidth);
            const color = colors[Math.floor(pseudoRandom(seed + 2) * colors.length)];
            const animDelay = pseudoRandom(seed + 3) * 8;
            return { left, width, color, animDelay };
        });
    }, [slideKey]);

    return (
        <div
            className="absolute inset-0 overflow-visible z-0"
            aria-hidden="true"
        >
            {lines.map((line, i) => (
                <div
                    key={i}
                    className="data-wrapped-line absolute top-0 bottom-0 w-px transition-all duration-700 ease-out"
                    style={{
                        left: `${line.left}%`,
                        width: `${Math.max(line.width, 0.5)}px`,
                        minWidth: `${Math.max(line.width, 0.5)}px`,
                        background: line.color,
                        animationDelay: `${line.animDelay}s`,
                    }}
                />
            ))}
        </div>
    );
}

/** Animates a number from 0 to target value over duration */
function AnimatedNumber({ value, duration = 1200, format = "integer", className = "" }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const target = Number(value);
        if (isNaN(target)) return;

        let rafId;
        const start = () => {
            const startTime = performance.now();
            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplayValue(target * eased);
                if (progress < 1) rafId = requestAnimationFrame(animate);
            };
            rafId = requestAnimationFrame(animate);
        };
        start();
        return () => cancelAnimationFrame(rafId);
    }, [value, duration]);

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
                ? Math.round(displayValue).toLocaleString("da-DK") + "%"
                : Math.round(displayValue).toLocaleString("da-DK");

    return <span className={className}>{formatted}</span>;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

const SLIDES = [
    {
        id: "intro",
        render: (data) => {
            const periodLabel = data.periodLabel || getPeriodLabel(data.period) || `${data.year} in review`;
            return (
                <div className="flex flex-col items-center justify-center text-center px-6">
                    <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.3em] uppercase mb-4">
                        {periodLabel}
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
                        {data.customerName}
                    </h2>
                    <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-lime)] mb-6">
                        Data Wrapped
                    </h2>
                    <p className="text-[var(--color-primary-searchmind-lighter)] text-lg max-w-md">
                        Your monthly ecommerce performance, wrapped.
                    </p>
                </div>
            );
        },
    },
    {
        id: "revenue",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Net Revenue
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiDollarSign className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.netRevenue}
                        format="integer"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    DKK in total sales this month
                </p>
            </div>
        ),
    },
    {
        id: "orders",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Orders
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiShoppingCart className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.orders}
                        format="integer"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    orders placed this month
                </p>
            </div>
        ),
    },
    {
        id: "roas",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Blended ROAS
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiBarChart2 className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.roas}
                        format="decimal2"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    Return on ad spend
                </p>
            </div>
        ),
    },
    {
        id: "poas",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Blended POAS
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiPieChart className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.poas}
                        format="decimal2"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    Gross profit / ad spend (break-even 1.0)
                </p>
            </div>
        ),
    },
    {
        id: "spend",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Total Ad Spend
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiCreditCard className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.totalSpend}
                        format="integer"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    DKK invested in marketing
                </p>
            </div>
        ),
    },
    {
        id: "aov",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Net AOV
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiShoppingBag className="text-4xl text-[var(--color-lime)]" />
                    <AnimatedNumber
                        value={data.netAov}
                        format="currency"
                        className="text-5xl md:text-6xl font-bold text-white tabular-nums"
                    />
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    average order value
                </p>
            </div>
        ),
    },
    {
        id: "channel",
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Top Channel
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FiTrendingUp className="text-4xl text-[var(--color-lime)]" />
                    <span className="text-4xl md:text-5xl font-bold text-white">
                        {data.topChannel}
                    </span>
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    <AnimatedNumber
                        value={data.topChannelShare}
                        format="percent"
                        className="font-semibold text-white"
                    />{" "}
                    of your ad spend
                </p>
            </div>
        ),
    },
    {
        id: "services",
        render: (data) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Active Services
                </p>
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                    {(data.services || []).map((s, i) => (
                        <span
                            key={i}
                            className="px-4 py-2 rounded-xl bg-[var(--color-primary-searchmind-lighter)]/30 text-[var(--color-lime)] font-semibold text-lg border border-[var(--color-primary-searchmind-lighter)]/50"
                        >
                            {s}
                        </span>
                    ))}
                </div>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg">
                    Powered by Searchmind
                </p>
            </div>
        ),
    },
    {
        id: "team",
        render: (data, { customerId }) => (
            <TeamSlideContent customerId={customerId} />
        ),
    },
    {
        id: "summary",
        render: (data, { AnimatedNumber }) => {
            const periodLabel = data.periodLabel || getPeriodLabel(data.period) || data.year;
            return (
            <div className="flex flex-col items-center justify-center text-center px-6 max-w-xl">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    {periodLabel} Highlights
                </p>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
                    Your year in numbers
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-left w-full">
                    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-white/10">
                        <span className="text-[var(--color-primary-searchmind-lighter)]">Net Revenue</span>
                        <AnimatedNumber value={data.netRevenue} format="integer" className="text-lg font-bold text-white tabular-nums" />
                    </div>
                    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-white/10">
                        <span className="text-[var(--color-primary-searchmind-lighter)]">Orders</span>
                        <AnimatedNumber value={data.orders} format="integer" className="text-lg font-bold text-white tabular-nums" />
                    </div>
                    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-white/10">
                        <span className="text-[var(--color-primary-searchmind-lighter)]">ROAS</span>
                        <AnimatedNumber value={data.roas} format="decimal2" className="text-lg font-bold text-[var(--color-lime)] tabular-nums" />
                    </div>
                    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-white/10">
                        <span className="text-[var(--color-primary-searchmind-lighter)]">POAS</span>
                        <AnimatedNumber value={data.poas} format="decimal2" className="text-lg font-bold text-[var(--color-lime)] tabular-nums" />
                    </div>
                    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-white/10 col-span-2">
                        <span className="text-[var(--color-primary-searchmind-lighter)]">Top Channel</span>
                        <span className="text-lg font-bold text-white">{data.topChannel}</span>
                    </div>
                </div>
            </div>
            );
        },
    },
    {
        id: "outro",
        render: (data) => {
            const periodLabel = data.periodLabel || getPeriodLabel(data.period) || `${data.year}`;
            return (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.3em] uppercase mb-4">
                    Thanks for a great month
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                    See you next month
                </h2>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg max-w-md">
                    Your Data Wrapped {periodLabel}. Share your results and keep growing.
                </p>
            </div>
            );
        },
    },
];

export default function DataWrappedModal({ onClose, customerId, customerName, period, data: initialData }) {
    const setUser = useSetUser();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState("next");
    const [data, setData] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(null);

    const effectivePeriod = period || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    useEffect(() => {
        if (initialData) return;
        if (!customerId || !effectivePeriod) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`/api/data-wrapped/${customerId}?period=${encodeURIComponent(effectivePeriod)}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(json.error || (res.status === 401 ? "Unauthorized" : "Failed to load"));
                }
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
        return () => { cancelled = true; };
    }, [customerId, effectivePeriod, initialData]);

    useEffect(() => {
        if (!effectivePeriod || loading || error || !customerId) return;
        fetch("/api/data-wrapped/mark-opened", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, period: effectivePeriod }),
        })
            .then((res) => {
                if (res.ok) {
                    setUser((prev) => {
                        const prevObj = prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods)
                            ? prev.openedWrappedPeriods
                            : {};
                        const customerPeriods = [...new Set([...(prevObj[customerId] || []), effectivePeriod])];
                        return {
                            ...prev,
                            openedWrappedPeriods: { ...prevObj, [customerId]: customerPeriods },
                        };
                    });
                }
            })
            .catch(() => {});
    }, [effectivePeriod, loading, error, customerId, setUser]);

    const wrappedData = {
        ...DEFAULT_WRAPPED_DATA,
        customerName: customerName || DEFAULT_WRAPPED_DATA.customerName,
        period: effectivePeriod,
        periodLabel: getPeriodLabel(effectivePeriod),
        ...data,
    };

    const totalSlides = SLIDES.length;
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < totalSlides - 1;

    const goPrev = useCallback(() => {
        setSlideDirection("prev");
        setCurrentIndex((i) => Math.max(0, i - 1));
    }, []);

    const goNext = useCallback(() => {
        setSlideDirection("next");
        setCurrentIndex((i) => Math.min(totalSlides - 1, i + 1));
    }, [totalSlides]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") canGoPrev && goPrev();
            if (e.key === "ArrowRight") canGoNext && goNext();
        },
        [onClose, canGoPrev, canGoNext, goPrev, goNext]
    );

    React.useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const CurrentSlide = SLIDES[currentIndex];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center glassmorphism2"
            role="dialog"
            aria-modal="true"
            aria-label="Data Wrapped"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="relative mx-4 rounded-2xl overflow-hidden flex flex-col"
                style={{
                    width: "80vw",
                    height: "90vh",
                    background: `linear-gradient(165deg, var(--color-dark-green) 0%, var(--color-primary-searchmind) 50%, var(--color-green) 100%)`,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative shapes - re-randomize on each slide */}
                <DecorativeShapes slideKey={currentIndex} />

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>

                {/* Slide content */}
                <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden relative z-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-2 border-[var(--color-lime)] border-t-transparent rounded-full animate-spin" />
                            <p className="text-[var(--color-primary-searchmind-lighter)]">Loading your wrapped...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center gap-4 text-center px-6">
                            <p className="text-red-300">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <div
                            key={currentIndex}
                            className={`w-full h-full flex items-center justify-center ${
                                slideDirection === "next"
                                    ? "data-wrapped-slide-next"
                                    : "data-wrapped-slide-prev"
                            }`}
                        >
                            {CurrentSlide.render(wrappedData, {
                                AnimatedNumber,
                                customerId,
                            })}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                {!loading && !error && (
                <div className="relative z-10 flex items-center justify-between px-6 py-4 border-t border-white/10">
                    <button
                        onClick={goPrev}
                        disabled={!canGoPrev}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            canGoPrev
                                ? "text-[var(--color-lime)] hover:bg-white/10"
                                : "text-gray-500 cursor-not-allowed"
                        }`}
                        aria-label="Previous slide"
                    >
                        <FiChevronLeft className="text-lg" />
                        <span>Back</span>
                    </button>

                    {/* Dots */}
                    <div className="flex items-center gap-1.5">
                        {SLIDES.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setSlideDirection(i > currentIndex ? "next" : "prev");
                                    setCurrentIndex(i);
                                }}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    i === currentIndex
                                        ? "bg-[var(--color-lime)] w-6"
                                        : "bg-white/30 hover:bg-white/50"
                                }`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={goNext}
                        disabled={!canGoNext}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            canGoNext
                                ? "text-[var(--color-lime)] hover:bg-white/10"
                                : "text-gray-500 cursor-not-allowed"
                        }`}
                        aria-label="Next slide"
                    >
                        <span>Next</span>
                        <FiChevronRight className="text-lg" />
                    </button>
                </div>
                )}

                {/* Slide counter */}
                {!loading && !error && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-xs text-white/40 pointer-events-none">
                    {currentIndex + 1} / {totalSlides}
                </div>
                )}
            </div>
        </div>
    );
}
