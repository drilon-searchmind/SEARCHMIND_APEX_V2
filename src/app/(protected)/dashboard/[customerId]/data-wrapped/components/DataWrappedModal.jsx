"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
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

const TEAM_SERVICE_CONFIG = {
    "51ed563e-4a2c-489b-9506-be385c49a354": { label: "SEO", color: "#1E2B2B" },
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": { label: "PPC", color: "#2b3d3d" },
    "2df85265-d5eb-4e86-a111-5d55623851fa": { label: "PS", color: "#3b5252" },
    "55b3e92d-5972-4246-8160-73d7ba04401a": { label: "EM", color: "#4c6b6b" },
    "28b06356-6f19-4633-bfa4-416c150a562c": { label: "Client Lead", color: "#5e8888" },
};


/** Team slide content - fetches team members and displays large avatars */
function TeamSlideContent({ customerId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customerId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        fetch(`/api/clickup-team-members/${customerId}`)
            .then((res) => res.ok ? res.json() : { members: [] })
            .then((data) => {
                if (!cancelled) setMembers(data.members || []);
            })
            .catch(() => {
                if (!cancelled) setMembers([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [customerId]);

    const displayMembers = members.length > 0
        ? members
        : [1, 2, 3, 4, 5].map((i) => ({ id: i, username: "Team member", service: "None" }));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    Your Team
                </p>
                <div className="flex gap-4 justify-center">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="w-24 h-24 rounded-full bg-white/10 animate-pulse"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center text-center px-6">
            <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                Your Team
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
                The people behind your success
            </h2>
            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                {displayMembers.map((member, idx) => {
                    const serviceInfo = TEAM_SERVICE_CONFIG[member.service] || { label: member.service || "Team", color: "#406969" };
                    const size = 180;
                    return (
                        <div
                            key={member.id || idx}
                            className="flex flex-col items-center gap-3"
                        >
                            <div
                                className="rounded-full border-4 flex items-center justify-center overflow-hidden shrink-0"
                                style={{
                                    width: size,
                                    height: size,
                                    borderColor: "rgba(255,255,255,0.3)",
                                    backgroundColor: serviceInfo.color,
                                }}
                            >
                                {member.avatar ? (
                                    <Image
                                        src={member.avatar}
                                        alt={member.username}
                                        width={size}
                                        height={size}
                                        className="object-cover w-full h-full"
                                    />
                                ) : (
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.username || "?")}&size=360&background=${serviceInfo.color.replace("#", "")}&color=fff`}
                                        alt={member.username}
                                        width={size}
                                        height={size}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <div className="text-center">
                                <p className="text-white font-semibold text-lg">
                                    {member.username || "Team member"}
                                </p>
                                <p className="text-[var(--color-primary-searchmind-lighter)] text-sm">
                                    {serviceInfo.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Pseudo-random 0-1 from seed (deterministic per slide) */
function pseudoRandom(seed) {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
}

/** Decorative shapes that randomize on each slide change */
function DecorativeShapes({ slideKey }) {
    const shapes = useMemo(() => {
        const types = ["circle", "square", "blob", "triangle", "diamond"];
        const colors = [
            "rgba(198, 237, 98, 0.08)",
            "rgba(255, 255, 255, 0.06)",
            "rgba(64, 105, 105, 0.1)",
            "rgba(214, 205, 182, 0.07)",
        ];
        return Array.from({ length: 6 }, (_, i) => {
            const seed = slideKey * 31 + i * 7;
            const type = types[Math.floor(pseudoRandom(seed) * types.length)];
            const edge = i % 4;
            let left, top;
            if (edge === 0) {
                left = pseudoRandom(seed + 1) * 80 + 10;
                top = pseudoRandom(seed + 2) * 20 - 5;
            } else if (edge === 1) {
                left = pseudoRandom(seed + 1) * 20 + 80;
                top = pseudoRandom(seed + 2) * 80 + 10;
            } else if (edge === 2) {
                left = pseudoRandom(seed + 1) * 80 + 10;
                top = pseudoRandom(seed + 2) * 20 + 80;
            } else {
                left = pseudoRandom(seed + 2) * 20 - 5;
                top = pseudoRandom(seed + 1) * 80 + 10;
            }
            const size = 180 + pseudoRandom(seed + 3) * 320;
            const color = colors[Math.floor(pseudoRandom(seed + 4) * colors.length)];
            const animDelay = pseudoRandom(seed + 5) * 8;
            const rotation = pseudoRandom(seed + 6) * 360;
            return { type, left, top, size, color, animDelay, rotation };
        });
    }, [slideKey]);

    return (
        <div
            className="absolute inset-0 overflow-visible z-0"
            aria-hidden="true"
        >
            {shapes.map((s, i) => (
                <div
                    key={i}
                    className="data-wrapped-shape absolute transition-all duration-700 ease-out"
                    style={{
                        left: `${s.left}%`,
                        top: `${s.top}%`,
                        width: s.size,
                        height: s.size,
                        background: s.color,
                        borderRadius:
                            s.type === "circle"
                                ? "50%"
                                : s.type === "blob"
                                  ? "60% 40% 50% 70% / 55% 60% 45% 50%"
                                  : s.type === "triangle"
                                    ? "0"
                                    : s.type === "diamond"
                                      ? "0"
                                      : "12%",
                        clipPath:
                            s.type === "triangle"
                                ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                                : s.type === "diamond"
                                  ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                                  : "none",
                        transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                        animationDelay: `${s.animDelay}s`,
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

// Mock data for frontend demo - replace with real API data later
const MOCK_WRAPPED_DATA = {
    customerName: "Your Store",
    year: new Date().getFullYear(),
    netRevenue: 2847500,
    orders: 12450,
    roas: 6.42,
    poas: 2.18,
    totalSpend: 443500,
    netAov: 229,
    topChannel: "Facebook",
    topChannelShare: 58,
    services: ["PPC", "SEO", "Product Sync"],
};

const SLIDES = [
    {
        id: "intro",
        render: (data) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.3em] uppercase mb-4">
                    {data.year} in review
                </p>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {data.customerName}
                </h2>
                <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-lime)] mb-6">
                    Data Wrapped
                </h2>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg max-w-md">
                    Your annual ecommerce performance, wrapped.
                </p>
            </div>
        ),
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
                    DKK in total sales this year
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
                    orders placed in {data.year}
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
                    Profit on ad spend
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
                    {data.services.map((s, i) => (
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
        render: (data, { AnimatedNumber }) => (
            <div className="flex flex-col items-center justify-center text-center px-6 max-w-xl">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.2em] uppercase mb-6">
                    {data.year} Highlights
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
        ),
    },
    {
        id: "outro",
        render: (data) => (
            <div className="flex flex-col items-center justify-center text-center px-6">
                <p className="text-[var(--color-lime)] text-sm font-medium tracking-[0.3em] uppercase mb-4">
                    Thanks for a great year
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                    See you in {data.year + 1}
                </h2>
                <p className="text-[var(--color-primary-searchmind-lighter)] text-lg max-w-md">
                    Your Data Wrapped {data.year}. Share your results and keep growing.
                </p>
            </div>
        ),
    },
];

export default function DataWrappedModal({ onClose, customerId, customerName, data }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState("next");
    const wrappedData = {
        ...MOCK_WRAPPED_DATA,
        customerName: customerName || MOCK_WRAPPED_DATA.customerName,
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
                </div>

                {/* Navigation */}
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

                {/* Slide counter */}
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-xs text-white/40 pointer-events-none">
                    {currentIndex + 1} / {totalSlides}
                </div>
            </div>
        </div>
    );
}
