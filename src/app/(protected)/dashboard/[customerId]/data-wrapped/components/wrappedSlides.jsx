"use client";

import React from "react";
import { FiRotateCcw, FiX } from "react-icons/fi";
import ChannelLogo from "@/components/ui/ChannelLogo";
import { nextPeriodLabel, previousPeriod, getPeriodLabel } from "@/lib/dataWrapped";
import { ChannelRace, Confetti, CountUp, DeltaRow, Gauge, LineDraw, Marquee, Reveal, WeekdayBars, fmt2, fmtInt } from "./wrappedMotion";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TEAM_SERVICE_LABELS = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO",
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "PPC",
    "2df85265-d5eb-4e86-a111-5d55623851fa": "PS",
    "55b3e92d-5972-4246-8160-73d7ba04401a": "EM",
    "28b06356-6f19-4633-bfa4-416c150a562c": "Client Lead",
};

function dayLabel(ymd) {
    const [y, m, d] = String(ymd).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function pct(now, before) {
    if (!Number.isFinite(before) || before <= 0) return null;
    return ((now - before) / before) * 100;
}

function ChangeChip({ change, label }) {
    if (change == null) return null;
    const up = change >= 0;
    return (
        <span className={`w-chip ${up ? "is-good" : "is-bad"} w-in`} style={{ "--i": 6 }}>
            {up ? "+" : "-"}
            {Math.abs(change).toLocaleString("da-DK", { maximumFractionDigits: 1 })}% vs {label}
        </span>
    );
}

function minutesText(minutes) {
    if (!minutes || !Number.isFinite(minutes)) return "";
    if (minutes < 1) return "less than a minute";
    if (minutes < 10) return `${minutes.toLocaleString("da-DK", { maximumFractionDigits: 1 })} minutes`;
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
}

function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * Builds the ordered slides from the snapshot. Slides that need data the snapshot does not hold
 * (older reports, no ad spend, no previous month) are left out.
 */
export function buildSlides({ d, periodLabel, members = [], onReplay, onClose }) {
    const prevLabel = d.prev?.period ? getPeriodLabel(d.prev.period).split(" ")[0] : getPeriodLabel(previousPeriod(d.period)).split(" ")[0];
    const monthName = periodLabel.split(" ")[0];
    const nextMonth = nextPeriodLabel(d.period);
    const hasDaily = Array.isArray(d.daily) && d.daily.length >= 3;
    const hasWeekdays = Array.isArray(d.weekdays) && d.bestWeekday != null && d.daily?.length >= 14;
    const channels = Array.isArray(d.spendByChannel) ? d.spendByChannel : [];
    const hasSpend = d.totalSpend > 0;
    const revenueChange = d.prev ? pct(d.netRevenue, d.prev.netRevenue) : null;
    const aovChange = d.prev ? pct(d.netAov, d.prev.netAov) : null;

    const slides = [];

    slides.push({
        id: "intro",
        label: "Intro",
        theme: "dark",
        duration: 6500,
        render: () => (
            <>
                <Marquee text={`${monthName} wrapped`} />
                <span className="w-shape w-shape--ring w-shape--ring-1" aria-hidden />
                <span className="w-shape w-shape--ring w-shape--ring-2" aria-hidden />
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        {d.customerName}
                    </p>
                    <h2 className="w-headline w-headline--xl">
                        <Reveal text={`Your ${monthName} wrapped`} start={1} />
                    </h2>
                    <p className="w-sub w-in" style={{ "--i": 6 }}>
                        {periodLabel}, in numbers. Tap to move on.
                    </p>
                </div>
            </>
        ),
    });

    slides.push({
        id: "revenue",
        label: "Revenue",
        theme: "mint",
        duration: 7000,
        render: () => (
            <>
                <span className="w-shape w-shape--blob" aria-hidden />
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        {monthName} brought in
                    </p>
                    <p className="w-big w-in" style={{ "--i": 1 }}>
                        <CountUp value={d.netRevenue} />
                        <small>kr.</small>
                    </p>
                    <p className="w-sub w-in" style={{ "--i": 2 }}>
                        in net revenue
                    </p>
                    <ChangeChip change={revenueChange} label={prevLabel} />
                </div>
            </>
        ),
    });

    if (hasDaily) {
        const values = d.daily.map((r) => r.netSales);
        const bestIndex = d.bestDay ? d.daily.findIndex((r) => r.date === d.bestDay.date) : null;
        slides.push({
            id: "daily",
            label: "Day by day",
            theme: "dark",
            duration: 8500,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Day by day
                    </p>
                    {d.bestDay ? (
                        <h2 className="w-headline">
                            <Reveal text={`Your best day was ${dayLabel(d.bestDay.date)}`} start={1} />
                        </h2>
                    ) : null}
                    <LineDraw values={values} bestIndex={bestIndex >= 0 ? bestIndex : null} labelTop={d.bestDay ? `${fmtInt(d.bestDay.netSales)} kr.` : ""} />
                    {d.bestDay ? (
                        <p className="w-sub w-in" style={{ "--i": 8 }}>
                            {fmtInt(d.bestDay.orders)} orders on the day.
                        </p>
                    ) : null}
                </div>
            ),
        });
    }

    slides.push({
        id: "orders",
        label: "Orders",
        theme: "green",
        duration: 7000,
        render: () => (
            <>
                <span className="w-shape w-shape--plus w-shape--plus-1" aria-hidden />
                <span className="w-shape w-shape--plus w-shape--plus-2" aria-hidden />
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Orders
                    </p>
                    <p className="w-big w-in" style={{ "--i": 1 }}>
                        <CountUp value={d.orders} />
                    </p>
                    <p className="w-sub w-in" style={{ "--i": 2 }}>
                        {d.minutesPerOrder
                            ? `That is an order every ${minutesText(d.minutesPerOrder)}, all month long.`
                            : "orders placed this month"}
                    </p>
                </div>
            </>
        ),
    });

    if (hasWeekdays) {
        slides.push({
            id: "weekdays",
            label: "Your week",
            theme: "sage",
            duration: 8000,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Your week
                    </p>
                    <h2 className="w-headline">
                        <Reveal text={`${WEEKDAY_NAMES[d.bestWeekday]}s were your strongest day`} start={1} />
                    </h2>
                    <WeekdayBars values={d.weekdays} bestIndex={d.bestWeekday} />
                    <p className="w-sub w-in" style={{ "--i": 9 }}>
                        Average net revenue per weekday.
                    </p>
                </div>
            ),
        });
    }

    if (d.netAov > 0) {
        slides.push({
            id: "aov",
            label: "Order value",
            theme: "mint",
            duration: 6500,
            render: () => (
                <>
                    <span className="w-shape w-shape--coins" aria-hidden>
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                    <div className="w-content">
                        <p className="w-kicker w-in" style={{ "--i": 0 }}>
                            Average order
                        </p>
                        <p className="w-big w-in" style={{ "--i": 1 }}>
                            <CountUp value={d.netAov} />
                            <small>kr.</small>
                        </p>
                        <p className="w-sub w-in" style={{ "--i": 2 }}>
                            net value per order
                        </p>
                        <ChangeChip change={aovChange} label={prevLabel} />
                    </div>
                </>
            ),
        });
    }

    if (hasSpend) {
        slides.push({
            id: "spend",
            label: "Ad spend",
            theme: "dark",
            duration: 6500,
            render: () => (
                <>
                    <span className="w-shape w-shape--ring w-shape--ring-1" aria-hidden />
                    <div className="w-content">
                        <p className="w-kicker w-in" style={{ "--i": 0 }}>
                            You invested
                        </p>
                        <p className="w-big w-in" style={{ "--i": 1 }}>
                            <CountUp value={d.totalSpend} />
                            <small>kr.</small>
                        </p>
                        <p className="w-sub w-in" style={{ "--i": 2 }}>
                            {channels.length > 1 ? `in paid media across ${channels.length} channels` : "in paid media"}
                        </p>
                    </div>
                </>
            ),
        });
    }

    if (channels.length > 0) {
        const top = channels[0];
        slides.push({
            id: "channels",
            label: "Where it went",
            theme: "sage",
            duration: 8000,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Where it went
                    </p>
                    <h2 className="w-headline">
                        <Reveal text={`${top.label} took ${Math.round(top.share * 100)}% of the budget`} start={1} />
                    </h2>
                    <ChannelRace rows={channels.slice(0, 6)} />
                </div>
            ),
        });
    } else if (d.topChannel) {
        // Older reports only know the top channel by name
        slides.push({
            id: "channels",
            label: "Top channel",
            theme: "sage",
            duration: 6500,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Top channel
                    </p>
                    <p className="w-big w-big--text w-in" style={{ "--i": 1 }}>
                        {d.topChannel}
                    </p>
                    <p className="w-sub w-in" style={{ "--i": 2 }}>
                        <CountUp value={d.topChannelShare} format="pct" /> of your ad spend
                    </p>
                </div>
            ),
        });
    }

    if (hasSpend && d.roas > 0) {
        slides.push({
            id: "roas",
            label: "Return on ad spend",
            theme: "green",
            duration: 7000,
            render: () => (
                <>
                    <span className="w-shape w-shape--ring w-shape--ring-2" aria-hidden />
                    <div className="w-content">
                        <p className="w-kicker w-in" style={{ "--i": 0 }}>
                            Return on ad spend
                        </p>
                        <p className="w-big w-in" style={{ "--i": 1 }}>
                            <CountUp value={d.roas} format="x" />
                            <small>x</small>
                        </p>
                        <p className="w-sub w-in" style={{ "--i": 2 }}>
                            Every 1 kr. in ads brought back {fmt2(d.roas)} kr. in sales.
                        </p>
                    </div>
                </>
            ),
        });
    }

    if (hasSpend) {
        const above = d.poas >= 1;
        slides.push({
            id: "poas",
            label: "Profit on ad spend",
            theme: "dark",
            duration: 8000,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Profit on ad spend
                    </p>
                    <Gauge value={d.poas} />
                    <p className="w-big w-big--md w-in" style={{ "--i": 3 }}>
                        <CountUp value={d.poas} format="x" delay={500} />
                    </p>
                    <p className="w-sub w-in" style={{ "--i": 4 }}>
                        {above
                            ? `Above break-even: every 1 kr. in ads returned ${fmt2(d.poas)} kr. in gross profit.`
                            : `Below break-even this month: every 1 kr. in ads returned ${fmt2(d.poas)} kr. in gross profit.`}
                    </p>
                </div>
            ),
        });
    }

    if (d.prev) {
        slides.push({
            id: "compare",
            label: `Versus ${prevLabel}`,
            theme: "sage",
            duration: 9000,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Compared with {prevLabel}
                    </p>
                    <ul className="w-deltas">
                        <DeltaRow index={0} label="Net revenue" now={d.netRevenue} before={d.prev.netRevenue} unit=" kr." />
                        <DeltaRow index={1} label="Orders" now={d.orders} before={d.prev.orders} />
                        <DeltaRow index={2} label="Order value" now={d.netAov} before={d.prev.netAov} unit=" kr." />
                        {hasSpend ? <DeltaRow index={3} label="ROAS" now={d.roas} before={d.prev.roas} format="x" unit="x" /> : null}
                        {hasSpend ? <DeltaRow index={4} label="POAS" now={d.poas} before={d.prev.poas} format="x" unit="x" /> : null}
                        {hasSpend ? <DeltaRow index={5} label="Ad spend" now={d.totalSpend} before={d.prev.totalSpend} unit=" kr." direction="neutral" /> : null}
                    </ul>
                </div>
            ),
        });
    }

    if (members.length > 0) {
        slides.push({
            id: "team",
            label: "Your team",
            theme: "dark",
            duration: 7500,
            render: () => (
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        Your team
                    </p>
                    <h2 className="w-headline">
                        <Reveal text="The people behind your month" start={1} />
                    </h2>
                    <ul className="w-team">
                        {members.slice(0, 6).map((m, i) => (
                            <li key={m.id || i} className="w-team__member" style={{ "--i": i }}>
                                {m.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- external profile picture
                                    <img className="w-team__avatar" src={m.avatar} alt="" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="w-team__avatar w-team__avatar--initials" aria-hidden>
                                        {initials(m.username)}
                                    </span>
                                )}
                                <span className="w-team__name">{m.username || "Team member"}</span>
                                <span className="w-team__role">{TEAM_SERVICE_LABELS[m.service] || m.service || "Team"}</span>
                            </li>
                        ))}
                    </ul>
                    {d.services?.length ? (
                        <ul className="w-services w-in" style={{ "--i": 8 }} aria-label="Active services">
                            {d.services.map((s) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ),
        });
    }

    const tiles = [
        { label: "Net revenue", value: <CountUp value={d.netRevenue} duration={1100} delay={400} />, unit: "kr." },
        { label: "Orders", value: <CountUp value={d.orders} duration={1100} delay={450} /> },
        { label: "Order value", value: <CountUp value={d.netAov} duration={1100} delay={500} />, unit: "kr." },
    ];
    if (hasSpend) {
        tiles.push({ label: "Ad spend", value: <CountUp value={d.totalSpend} duration={1100} delay={550} />, unit: "kr." });
        tiles.push({ label: "ROAS", value: <CountUp value={d.roas} format="x" duration={1100} delay={600} />, unit: "x" });
        tiles.push({ label: "POAS", value: <CountUp value={d.poas} format="x" duration={1100} delay={650} />, unit: "x" });
    }

    slides.push({
        id: "recap",
        label: "Recap",
        theme: "mint",
        duration: null,
        render: () => (
            <div className="w-content">
                <p className="w-kicker w-in" style={{ "--i": 0 }}>
                    {periodLabel}
                </p>
                <h2 className="w-headline">
                    <Reveal text={`${d.customerName}, in numbers`} start={1} />
                </h2>
                <ul className="w-tiles">
                    {tiles.map((t, i) => (
                        <li key={t.label} className="w-tile" style={{ "--i": i }}>
                            <span className="w-tile__label">{t.label}</span>
                            <span className="w-tile__value">
                                {t.value}
                                {t.unit ? <small>{t.unit}</small> : null}
                            </span>
                        </li>
                    ))}
                </ul>
                {channels.length > 0 ? (
                    <ul className="w-logos w-in" style={{ "--i": 8 }} aria-label="Channels used">
                        {channels.map((c) => (
                            <li key={c.id}>
                                <ChannelLogo channel={c.id} size={26} />
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        ),
    });

    slides.push({
        id: "outro",
        label: "See you next month",
        theme: "dark",
        duration: null,
        render: () => (
            <>
                <Confetti />
                <div className="w-content">
                    <p className="w-kicker w-in" style={{ "--i": 0 }}>
                        That was {monthName}
                    </p>
                    <h2 className="w-headline w-headline--xl">
                        <Reveal text={`See you in ${nextMonth}`} start={1} />
                    </h2>
                    <div className="w-actions w-in" style={{ "--i": 6 }}>
                        <button type="button" className="w-btn w-btn--primary" onClick={onReplay}>
                            <FiRotateCcw aria-hidden /> Watch again
                        </button>
                        <button type="button" className="w-btn" onClick={onClose}>
                            <FiX aria-hidden /> Close
                        </button>
                    </div>
                </div>
            </>
        ),
    });

    return slides;
}

