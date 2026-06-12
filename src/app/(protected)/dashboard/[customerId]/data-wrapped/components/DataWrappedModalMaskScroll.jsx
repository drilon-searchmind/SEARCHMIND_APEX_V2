"use client";

/**
 * Data Wrapped: scroll-scrubbed SVG mask reveals (random grid),
 * inspired by Codrops — SVG Mask Transitions on Scroll with GSAP and ScrollTrigger
 * https://tympanus.net/codrops/2026/03/11/svg-mask-transitions-on-scroll-with-gsap-and-scrolltrigger/
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TeamSlideContent } from "./DataWrappedTeamSlide";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** Matches DataWrappedModal slide count (intro → outro) */
const PANEL_COUNT = 12;
/** More vh = more scrolling per “slide” */
const SCROLL_VH_PER_PANEL = 135;
const SCROLL_MIN_VH = PANEL_COUNT * SCROLL_VH_PER_PANEL;

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

function AnimatedNumber({ value, duration = 1200, format = "integer", className = "" }) {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
        const target = Number(value);
        if (Number.isNaN(target)) return;
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
                ? `${Math.round(displayValue).toLocaleString("da-DK")}%`
                : Math.round(displayValue).toLocaleString("da-DK");

    return <span className={className}>{formatted}</span>;
}

function buildRandomGridMask(groupEl, vbWidth, vbHeight, cols, rows) {
    while (groupEl.firstChild) {
        groupEl.removeChild(groupEl.firstChild);
    }
    const cellW = vbWidth / cols;
    const cellH = vbHeight / rows;
    const cells = [];
    const NS = "http://www.w3.org/2000/svg";
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const rect = document.createElementNS(NS, "rect");
            rect.setAttribute("x", String(x * cellW));
            rect.setAttribute("y", String(y * cellH));
            rect.setAttribute("width", String(cellW + 0.06));
            rect.setAttribute("height", String(cellH + 0.06));
            rect.setAttribute("fill", "white");
            rect.setAttribute("opacity", "0");
            rect.setAttribute("shape-rendering", "crispEdges");
            groupEl.appendChild(rect);
            cells.push(rect);
        }
    }
    return cells;
}

function getGridCols(widthPx) {
    if (widthPx >= 1280) return 16;
    if (widthPx >= 1024) return 14;
    if (widthPx >= 640) return 10;
    return 6;
}

function panelIndexFromProgress(p) {
    const idx = Math.floor(p * PANEL_COUNT);
    return Math.min(PANEL_COUNT - 1, Math.max(0, idx));
}

function currentPanelFromScroll(scrollTop, maxScroll) {
    if (maxScroll <= 0) return 0;
    const p = scrollTop / maxScroll;
    return Math.min(PANEL_COUNT - 1, Math.max(0, Math.round(p * (PANEL_COUNT - 1))));
}

const WHEEL_COOLDOWN_MS = 700;
const STEP_SCROLL_DURATION = 1.25;

export default function DataWrappedModalMaskScroll({
    onClose,
    customerId,
    customerName,
    period,
    data: initialData,
}) {
    const reactId = useId().replace(/:/g, "");
    const scrollRootRef = useRef(null);
    const spacerRef = useRef(null);
    const stageRef = useRef(null);
    const maskGroup2Ref = useRef(null);
    const maskGroup3Ref = useRef(null);

    const [data, setData] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(null);
    const [panelIndex, setPanelIndex] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const [viewBoxW, setViewBoxW] = useState(100);

    const scrollTweenRef = useRef(null);
    const isSteppingRef = useRef(false);
    const wheelCooldownUntilRef = useRef(0);

    const goToPanel = useCallback((targetIndex) => {
        const clamped = Math.max(0, Math.min(PANEL_COUNT - 1, targetIndex));
        const el = scrollRootRef.current;
        if (!el) return;

        scrollTweenRef.current?.kill();
        isSteppingRef.current = false;

        const maxS = Math.max(0, el.scrollHeight - el.clientHeight);
        const targetScroll = PANEL_COUNT <= 1 ? 0 : (clamped / (PANEL_COUNT - 1)) * maxS;

        if (Math.abs(el.scrollTop - targetScroll) < 4) {
            return;
        }

        isSteppingRef.current = true;
        setIsNavigating(true);
        scrollTweenRef.current = gsap.to(el, {
            scrollTop: targetScroll,
            duration: STEP_SCROLL_DURATION,
            ease: "power2.inOut",
            onComplete: () => {
                isSteppingRef.current = false;
                scrollTweenRef.current = null;
                setIsNavigating(false);
            },
            overwrite: true,
        });
    }, []);

    const effectivePeriod =
        period ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

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

    const wrappedData = {
        ...DEFAULT_WRAPPED_DATA,
        customerName: customerName || DEFAULT_WRAPPED_DATA.customerName,
        period: effectivePeriod,
        periodLabel: getPeriodLabel(effectivePeriod),
        ...data,
    };

    const gid1 = `dwg1-${reactId}`;
    const gid2 = `dwg2-${reactId}`;
    const gid3 = `dwg3-${reactId}`;
    const mid2 = `dwm2-${reactId}`;
    const mid3 = `dwm3-${reactId}`;

    useLayoutEffect(() => {
        if (loading || error) return undefined;
        const stage = stageRef.current;
        if (!stage) return undefined;

        const syncViewBox = () => {
            const w = stage.clientWidth || 1;
            const h = stage.clientHeight || 1;
            setViewBoxW((w / h) * 100);
        };
        syncViewBox();
        const ro = new ResizeObserver(syncViewBox);
        ro.observe(stage);
        return () => ro.disconnect();
    }, [loading, error]);

    useLayoutEffect(() => {
        if (loading || error || !maskGroup2Ref.current || !maskGroup3Ref.current || !spacerRef.current) {
            return undefined;
        }

        gsap.registerPlugin(ScrollTrigger);

        const scrollEl = scrollRootRef.current;
        const stage = stageRef.current;
        const g2 = maskGroup2Ref.current;
        const g3 = maskGroup3Ref.current;
        if (!scrollEl || !stage || !g2 || !g3) return undefined;

        const vbW = viewBoxW;
        const vbH = 100;
        const cols = getGridCols(stage.clientWidth || 1000);
        const rows = Math.max(6, Math.round(cols * (vbH / vbW)));

        const ctx = gsap.context(() => {
            const cells2 = buildRandomGridMask(g2, vbW, vbH, cols, rows);
            const cells3 = buildRandomGridMask(g3, vbW, vbH, cols, rows);

            gsap.set(cells2, { opacity: 0 });
            gsap.set(cells3, { opacity: 0 });

            const sh2 = gsap.utils.shuffle([...cells2]);
            const sh3 = gsap.utils.shuffle([...cells3]);

            // Long virtual timeline so each mask reveal uses more scroll distance (scrub maps full spacer to this duration)
            const revealDuration = 5.2;
            const pauseBetween = 3.2;
            const staggerEach = 0.028;

            const tl = gsap.timeline({ paused: true });
            tl.to(sh2, {
                opacity: 1,
                duration: revealDuration,
                ease: "power3.out",
                stagger: { each: staggerEach, from: "start" },
            });
            tl.to(
                sh3,
                {
                    opacity: 1,
                    duration: revealDuration,
                    ease: "power3.out",
                    stagger: { each: staggerEach, from: "start" },
                },
                `+=${pauseBetween}`
            );

            ScrollTrigger.create({
                trigger: spacerRef.current,
                scroller: scrollEl,
                start: "top top",
                end: "bottom bottom",
                scrub: 2.8,
                animation: tl,
                onUpdate: (self) => {
                    const idx = panelIndexFromProgress(self.progress);
                    setPanelIndex((prev) => (prev !== idx ? idx : prev));
                },
            });
        }, scrollRootRef);

        requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => {
            ctx.revert();
        };
    }, [loading, error, viewBoxW]);

    useEffect(() => {
        if (loading || error) return undefined;
        const el = scrollRootRef.current;
        if (!el) return undefined;

        const onWheel = (e) => {
            const inner =
                e.target instanceof Element ? e.target.closest("[data-mask-scroll-inner]") : null;
            if (inner instanceof HTMLElement && inner.scrollHeight > inner.clientHeight + 6) {
                const { scrollTop, scrollHeight, clientHeight } = inner;
                const atTop = scrollTop <= 2;
                const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
                if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
                    return;
                }
            }

            e.preventDefault();

            if (isSteppingRef.current) return;
            const now = Date.now();
            if (now < wheelCooldownUntilRef.current) return;
            if (Math.abs(e.deltaY) < 28) return;

            const maxS = Math.max(0, el.scrollHeight - el.clientHeight);
            if (maxS <= 0) return;

            const current = currentPanelFromScroll(el.scrollTop, maxS);
            const dir = e.deltaY > 0 ? 1 : -1;
            const next = current + dir;
            if (next < 0 || next > PANEL_COUNT - 1) return;

            wheelCooldownUntilRef.current = now + WHEEL_COOLDOWN_MS;
            goToPanel(next);
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [loading, error, goToPanel]);

    const handlePrev = useCallback(() => {
        if (isSteppingRef.current) return;
        const el = scrollRootRef.current;
        if (!el) return;
        const maxS = Math.max(0, el.scrollHeight - el.clientHeight);
        const cur = currentPanelFromScroll(el.scrollTop, maxS);
        goToPanel(cur - 1);
    }, [goToPanel]);

    const handleNext = useCallback(() => {
        if (isSteppingRef.current) return;
        const el = scrollRootRef.current;
        if (!el) return;
        const maxS = Math.max(0, el.scrollHeight - el.clientHeight);
        const cur = currentPanelFromScroll(el.scrollTop, maxS);
        goToPanel(cur + 1);
    }, [goToPanel]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrev();
                return;
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                handleNext();
            }
        },
        [onClose, handlePrev, handleNext]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const periodLabelForIntro =
        wrappedData.periodLabel || getPeriodLabel(wrappedData.period) || `${wrappedData.year} in review`;

    const renderPanel = () => {
        const d = wrappedData;
        const metricWrap = "flex flex-col items-center justify-center text-center px-4 md:px-8 max-w-4xl mx-auto";
        const label = "text-[var(--color-lime)] text-xs md:text-sm font-medium tracking-[0.2em] uppercase mb-4 md:mb-6";
        const sub = "text-[var(--color-primary-searchmind-lighter)] text-sm md:text-lg";

        switch (panelIndex) {
            case 0:
                return (
                    <div className={`${metricWrap}`}>
                        <p className={`${label} tracking-[0.3em]`}>{periodLabelForIntro}</p>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
                            {d.customerName}
                        </h2>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-lime)] mb-6">
                            Data Wrapped
                        </h2>
                        <p className={`${sub} max-w-md mx-auto`}>Your monthly ecommerce performance, wrapped.</p>
                    </div>
                );
            case 1:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Net Revenue</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiDollarSign className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.netRevenue}
                                format="integer"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>DKK in total sales this month</p>
                    </div>
                );
            case 2:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Orders</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiShoppingCart className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.orders}
                                format="integer"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>orders placed this month</p>
                    </div>
                );
            case 3:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Blended ROAS</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiBarChart2 className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.roas}
                                format="decimal2"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>Return on ad spend</p>
                    </div>
                );
            case 4:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Blended POAS</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiPieChart className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.poas}
                                format="decimal2"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>Gross profit / ad spend (break-even 1.0)</p>
                    </div>
                );
            case 5:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Total Ad Spend</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiCreditCard className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.totalSpend}
                                format="integer"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>DKK invested in marketing</p>
                    </div>
                );
            case 6:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Net AOV</p>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <FiShoppingBag className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <AnimatedNumber
                                value={d.netAov}
                                format="currency"
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tabular-nums"
                            />
                        </div>
                        <p className={sub}>average order value</p>
                    </div>
                );
            case 7:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Top Channel</p>
                        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                            <FiTrendingUp className="text-3xl md:text-5xl text-[var(--color-lime)] shrink-0" />
                            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center">
                                {d.topChannel}
                            </span>
                        </div>
                        <p className={sub}>
                            <AnimatedNumber
                                value={d.topChannelShare}
                                format="percent"
                                className="font-semibold text-white"
                            />{" "}
                            of your ad spend
                        </p>
                    </div>
                );
            case 8:
                return (
                    <div className={metricWrap}>
                        <p className={label}>Active Services</p>
                        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-4 max-w-3xl">
                            {(d.services || []).map((s, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-[var(--color-primary-searchmind-lighter)]/30 text-[var(--color-lime)] font-semibold text-sm md:text-lg border border-[var(--color-primary-searchmind-lighter)]/50"
                                >
                                    {s}
                                </span>
                            ))}
                        </div>
                        <p className={sub}>Powered by Searchmind</p>
                    </div>
                );
            case 9:
                return (
                    <div
                        data-mask-scroll-inner
                        className="w-full max-w-5xl mx-auto max-h-[min(62dvh,560px)] overflow-y-auto pointer-events-auto"
                    >
                        <TeamSlideContent customerId={customerId} compact />
                    </div>
                );
            case 10: {
                const sumLabel = d.periodLabel || getPeriodLabel(d.period) || d.year;
                return (
                    <div className="flex flex-col items-center justify-center text-center px-4 md:px-8 max-w-3xl mx-auto w-full">
                        <p className={label}>{sumLabel} Highlights</p>
                        <h2 className="text-xl md:text-3xl font-bold text-white mb-4 md:mb-6">Your year in numbers</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 md:gap-y-4 text-left w-full text-sm md:text-base">
                            <div className="flex justify-between items-baseline gap-3 py-2 border-b border-white/10">
                                <span className="text-[var(--color-primary-searchmind-lighter)]">Net Revenue</span>
                                <AnimatedNumber
                                    value={d.netRevenue}
                                    format="integer"
                                    className="font-bold text-white tabular-nums"
                                />
                            </div>
                            <div className="flex justify-between items-baseline gap-3 py-2 border-b border-white/10">
                                <span className="text-[var(--color-primary-searchmind-lighter)]">Orders</span>
                                <AnimatedNumber
                                    value={d.orders}
                                    format="integer"
                                    className="font-bold text-white tabular-nums"
                                />
                            </div>
                            <div className="flex justify-between items-baseline gap-3 py-2 border-b border-white/10">
                                <span className="text-[var(--color-primary-searchmind-lighter)]">ROAS</span>
                                <AnimatedNumber
                                    value={d.roas}
                                    format="decimal2"
                                    className="font-bold text-[var(--color-lime)] tabular-nums"
                                />
                            </div>
                            <div className="flex justify-between items-baseline gap-3 py-2 border-b border-white/10">
                                <span className="text-[var(--color-primary-searchmind-lighter)]">POAS</span>
                                <AnimatedNumber
                                    value={d.poas}
                                    format="decimal2"
                                    className="font-bold text-[var(--color-lime)] tabular-nums"
                                />
                            </div>
                            <div className="flex justify-between items-baseline gap-3 py-2 border-b border-white/10 sm:col-span-2">
                                <span className="text-[var(--color-primary-searchmind-lighter)]">Top Channel</span>
                                <span className="font-bold text-white">{d.topChannel}</span>
                            </div>
                        </div>
                    </div>
                );
            }
            case 11: {
                const outLabel = d.periodLabel || getPeriodLabel(d.period) || `${d.year}`;
                return (
                    <div className={metricWrap}>
                        <p className={`${label} tracking-[0.3em]`}>Thanks for a great month</p>
                        <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">See you next month</h2>
                        <p className={`${sub} max-w-md mx-auto`}>
                            Your Data Wrapped {outLabel}. Share your results and keep growing.
                        </p>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div
            className="fixed inset-0 z-[101] flex flex-col bg-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Data Wrapped"
        >
            <div className="flex items-center justify-end px-4 py-3 border-b border-white/10 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>
            </div>

            <div
                ref={scrollRootRef}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                        <div className="w-12 h-12 border-2 border-[var(--color-lime)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--color-primary-searchmind-lighter)]">Loading…</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
                        <p className="text-red-300">{error}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <div
                        ref={spacerRef}
                        className="relative w-full"
                        style={{ minHeight: `${SCROLL_MIN_VH}vh` }}
                    >
                        <div className="sticky top-0 min-h-[min(90dvh,940px)] flex flex-col items-center justify-start pt-3 md:pt-5 px-2 sm:px-4 md:px-6 pb-6 box-border">
                            <div className="flex items-stretch gap-2 sm:gap-3 w-full max-w-[min(96rem,calc(100vw-1rem))] flex-1 min-h-[300px]">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    disabled={panelIndex <= 0 || isNavigating}
                                    className="hidden sm:flex shrink-0 w-11 md:w-12 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white items-center justify-center self-center min-h-[120px] transition-colors pointer-events-auto"
                                    aria-label="Previous section"
                                >
                                    <FiChevronLeft className="text-2xl" />
                                </button>
                                <div
                                    ref={stageRef}
                                    className="relative flex-1 min-w-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                                    style={{
                                        maxHeight: "min(80dvh, 860px)",
                                    }}
                                >
                                <svg
                                    className="absolute inset-0 w-full h-full block"
                                    viewBox={`0 0 ${viewBoxW} 100`}
                                    preserveAspectRatio="none"
                                    aria-hidden
                                >
                                    <defs>
                                        <linearGradient id={gid1} x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="var(--color-dark-green)" />
                                            <stop offset="55%" stopColor="var(--color-primary-searchmind)" />
                                            <stop offset="100%" stopColor="var(--color-green)" />
                                        </linearGradient>
                                    </defs>
                                    <rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid1})`} />
                                </svg>

                                <svg
                                    className="absolute inset-0 w-full h-full block z-[1]"
                                    viewBox={`0 0 ${viewBoxW} 100`}
                                    preserveAspectRatio="none"
                                    aria-hidden
                                >
                                    <defs>
                                        <linearGradient id={gid2} x1="100%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#1a3d3d" />
                                            <stop offset="50%" stopColor="#2d5a5a" />
                                            <stop offset="100%" stopColor="#406969" />
                                        </linearGradient>
                                        <mask id={mid2} maskUnits="userSpaceOnUse">
                                            <rect x="0" y="0" width={viewBoxW} height="100" fill="black" />
                                            <g ref={maskGroup2Ref} />
                                        </mask>
                                    </defs>
                                    <rect
                                        x="0"
                                        y="0"
                                        width="100%"
                                        height="100%"
                                        fill={`url(#${gid2})`}
                                        mask={`url(#${mid2})`}
                                    />
                                </svg>

                                <svg
                                    className="absolute inset-0 w-full h-full block z-[2]"
                                    viewBox={`0 0 ${viewBoxW} 100`}
                                    preserveAspectRatio="none"
                                    aria-hidden
                                >
                                    <defs>
                                        <linearGradient id={gid3} x1="0%" y1="100%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#0f2424" />
                                            <stop offset="45%" stopColor="#355" />
                                            <stop offset="100%" stopColor="#5a7a6a" />
                                        </linearGradient>
                                        <mask id={mid3} maskUnits="userSpaceOnUse">
                                            <rect x="0" y="0" width={viewBoxW} height="100" fill="black" />
                                            <g ref={maskGroup3Ref} />
                                        </mask>
                                    </defs>
                                    <rect
                                        x="0"
                                        y="0"
                                        width="100%"
                                        height="100%"
                                        fill={`url(#${gid3})`}
                                        mask={`url(#${mid3})`}
                                    />
                                </svg>

                                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-3 md:px-6 overflow-hidden">
                                    <div
                                        key={panelIndex}
                                        className="data-wrapped-panel-fade-up w-full flex items-center justify-center min-h-0 py-4"
                                    >
                                        {renderPanel()}
                                    </div>
                                </div>

                                <div className="absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-wrap gap-1 md:gap-1.5 justify-center max-w-[95%] pointer-events-none">
                                    {Array.from({ length: PANEL_COUNT }, (_, i) => (
                                        <div
                                            key={i}
                                            className="h-1 w-5 sm:w-6 md:w-8 rounded-full bg-black/30 overflow-hidden"
                                        >
                                            <div
                                                className="h-full bg-[var(--color-lime)] transition-all duration-300 rounded-full"
                                                style={{
                                                    width:
                                                        panelIndex > i ? "100%" : panelIndex === i ? "55%" : "0%",
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={panelIndex >= PANEL_COUNT - 1 || isNavigating}
                                    className="hidden sm:flex shrink-0 w-11 md:w-12 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white items-center justify-center self-center min-h-[120px] transition-colors pointer-events-auto"
                                    aria-label="Next section"
                                >
                                    <FiChevronRight className="text-2xl" />
                                </button>
                            </div>

                            <div className="flex sm:hidden items-center justify-center gap-3 mt-3 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    disabled={panelIndex <= 0 || isNavigating}
                                    className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium disabled:opacity-40"
                                    aria-label="Previous section"
                                >
                                    <FiChevronLeft className="text-lg inline mr-1" />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={panelIndex >= PANEL_COUNT - 1 || isNavigating}
                                    className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium disabled:opacity-40"
                                    aria-label="Next section"
                                >
                                    Next
                                    <FiChevronRight className="text-lg inline ml-1" />
                                </button>
                            </div>

                            <div
                                className="mt-4 flex flex-col items-center gap-1 text-white/50 pointer-events-none select-none"
                                aria-hidden
                            >
                                <div className="data-wrapped-scroll-mouse-hint flex flex-col items-center gap-1.5">
                                    <svg
                                        width="26"
                                        height="38"
                                        viewBox="0 0 26 38"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="text-white/70"
                                        aria-hidden
                                    >
                                        <rect
                                            x="1"
                                            y="1"
                                            width="24"
                                            height="36"
                                            rx="9"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <circle cx="13" cy="12" r="2" fill="currentColor" />
                                        <path
                                            d="M13 18v6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
