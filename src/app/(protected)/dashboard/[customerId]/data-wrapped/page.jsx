"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useSetUser } from "@/contexts/UserContext";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import WrappedStory from "./components/WrappedStory";
import { FiPlay, FiLock } from "react-icons/fi";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import { getPeriodLabel } from "@/lib/dataWrapped";
import "./data-wrapped.css";

function getCurrentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isLastDayOfMonth() {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === lastDay;
}

function getLastMonthPeriod() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const getLatestAvailablePeriod = () => (isLastDayOfMonth() ? getCurrentPeriod() : getLastMonthPeriod());

const TILE_TONES = ["mint", "green", "sage", "dark"];

export default function DataWrappedPage() {
    const params = useParams();
    const setUser = useSetUser();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const [showWrapped, setShowWrapped] = useState(false);
    const [modalPeriod, setModalPeriod] = useState(null);
    const [reports, setReports] = useState({ monthly: [], quarterly: [], yearly: [] });
    const [reportsLoading, setReportsLoading] = useState(true);

    const latestPeriod = getLatestAvailablePeriod();
    const latestReport = reports.monthly?.find((r) => r.period === latestPeriod) || reports.monthly?.[0];
    const latestLabel = latestReport?.periodLabel || getPeriodLabel(latestPeriod) || "Latest month";
    const latestMonthName = latestLabel.split(" ")[0];
    const savedReportCount = reports.monthly?.length ?? 0;

    const fetchReports = () => {
        if (!params.customerId) return;
        setReportsLoading(true);
        fetch(`/api/data-wrapped/${params.customerId}/reports`)
            .then((res) => (res.ok ? res.json() : { monthly: [], quarterly: [], yearly: [] }))
            .then((data) => {
                setReports(data);
                const allPeriods = [...(data.monthly || []), ...(data.quarterly || []), ...(data.yearly || [])].map((r) => r.period).filter(Boolean);
                if (allPeriods.length > 0 && params.customerId) {
                    fetch("/api/data-wrapped/mark-opened", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ customerId: params.customerId, periods: allPeriods }),
                    })
                        .then(() => {
                            setUser((prev) => {
                                const prevObj = prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods) ? prev.openedWrappedPeriods : {};
                                const customerPeriods = [...new Set([...(prevObj[params.customerId] || []), ...allPeriods])];
                                return { ...prev, openedWrappedPeriods: { ...prevObj, [params.customerId]: customerPeriods } };
                            });
                        })
                        .catch(() => {});
                }
            })
            .catch(() => setReports({ monthly: [], quarterly: [], yearly: [] }))
            .finally(() => setReportsLoading(false));
    };

    useEffect(() => {
        fetchReports();
    }, [params.customerId]);

    const openPeriod = (period) => {
        pushGTMEvent(GTM_EVENTS.DATA_WRAPPED_MODAL_OPENED, {
            eventData: { customerId: params.customerId ? String(params.customerId) : "", period: period != null ? String(period) : "" },
        });
        setModalPeriod(period);
        setShowWrapped(true);
    };

    const closeWrapped = () => {
        setShowWrapped(false);
        setModalPeriod(null);
        fetchReports();
    };

    return (
        <div id="DataWrappedPage" className="apex-perf w-full apex-dwp">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Data Wrapped"
                label={customer?.customerName || ""}
                subtitle="Your month as a story. Tap through revenue, orders, ad spend and what it all returned."
                showAnalyzeWithAi={false}
                showPdfExport={false}
            />

            <section className="apex-dwp__hero" aria-labelledby="dwp-hero-title">
                <div className="apex-dwp__hero-copy">
                    <p className="apex-dwp__eyebrow">{reportsLoading ? "Loading" : latestLabel}</p>
                    <h2 id="dwp-hero-title" className="apex-dwp__title">
                        Your {latestMonthName} wrapped is ready
                    </h2>
                    <p className="apex-dwp__lede">A full-screen story with your numbers, your best days and how every channel did. About a minute.</p>
                    <div className="apex-dwp__cta-row">
                        <button type="button" className="apex-dwp__play" onClick={() => openPeriod(latestPeriod)} disabled={reportsLoading}>
                            <FiPlay aria-hidden /> Play wrapped
                        </button>
                        {!reportsLoading && savedReportCount > 0 ? (
                            <span className="apex-dwp__meta">
                                {savedReportCount} saved {savedReportCount === 1 ? "month" : "months"}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="apex-dwp__deck" aria-hidden>
                    <span className="apex-dwp__card apex-dwp__card--1">
                        <b>{latestMonthName}</b>
                        <i>Revenue</i>
                    </span>
                    <span className="apex-dwp__card apex-dwp__card--2">
                        <b>Orders</b>
                        <i>Every minute counts</i>
                    </span>
                    <span className="apex-dwp__card apex-dwp__card--3">
                        <b>ROAS</b>
                        <i>What ads returned</i>
                    </span>
                </div>
            </section>

            <section className="apex-dwp__history" aria-labelledby="dwp-history-title">
                <div className="apex-dwp__history-head">
                    <h3 id="dwp-history-title">Previous months</h3>
                    <p>Replay any saved wrapped.</p>
                </div>

                {reportsLoading ? (
                    <div className="apex-dwp__loader">
                        <CobaltLoader variant="block" title="Loading reports" />
                    </div>
                ) : (
                    <ul className="apex-dwp__tiles">
                        {reports.monthly?.length > 0 ? (
                            reports.monthly.map((r, i) => {
                                const [name, year] = String(r.periodLabel || "").split(" ");
                                return (
                                    <li key={r.period}>
                                        <button type="button" className={`apex-dwp__tile apex-dwp__tile--${TILE_TONES[i % TILE_TONES.length]}`} onClick={() => openPeriod(r.period)} aria-label={`Play ${r.periodLabel}`}>
                                            <span className="apex-dwp__tile-year">{year}</span>
                                            <span className="apex-dwp__tile-month">{name}</span>
                                            <span className="apex-dwp__tile-play" aria-hidden>
                                                <FiPlay />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="apex-dwp__empty">No saved months yet. Play your latest wrapped to create the first one.</li>
                        )}
                        <li className="apex-dwp__soon">
                            <FiLock aria-hidden />
                            <span>Quarterly</span>
                            <small>Coming later</small>
                        </li>
                        <li className="apex-dwp__soon">
                            <FiLock aria-hidden />
                            <span>Yearly</span>
                            <small>Coming later</small>
                        </li>
                    </ul>
                )}
            </section>

            {showWrapped ? (
                <WrappedStory onClose={closeWrapped} customerId={params.customerId} customerName={customer?.customerName} period={modalPeriod ?? latestPeriod} />
            ) : null}
        </div>
    );
}
