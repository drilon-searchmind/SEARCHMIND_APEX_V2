"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useSetUser } from "@/contexts/UserContext";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import DataWrappedCobaltModal from "./components/DataWrappedCobaltModal";
import { FiGift, FiCalendar, FiChevronRight } from "react-icons/fi";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import "./data-wrapped.css";

function getCurrentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isLastDayOfMonth() {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return d.getDate() === lastDay;
}

function getLastMonthPeriod() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const getLatestAvailablePeriod = () =>
    isLastDayOfMonth() ? getCurrentPeriod() : getLastMonthPeriod();

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function getPeriodLabel(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return "";
    const [y, m] = period.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

const WRAPPED_TOPICS = ["Revenue", "Orders", "ROAS & POAS", "Ad spend", "Team"];

export default function DataWrappedPage() {
    const params = useParams();
    const setUser = useSetUser();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const [showWrapped, setShowWrapped] = useState(false);
    const [modalPeriod, setModalPeriod] = useState(null);
    const [reports, setReports] = useState({ monthly: [], quarterly: [], yearly: [] });
    const [reportsLoading, setReportsLoading] = useState(true);

    const latestReportType = reports.monthly?.length > 0 ? "monthly" : "monthly";

    const copyByType = {
        monthly: {
            title: "Your monthly ecommerce wrapped",
            description:
                "A personalized summary of your store's performance — revenue, orders, ROAS, team, and more.",
        },
        quarterly: {
            title: "Your quarterly ecommerce wrapped",
            description:
                "A personalized summary of your store's performance this quarter — revenue, orders, ROAS, and more.",
        },
        yearly: {
            title: "Your annual ecommerce wrapped",
            description:
                "A personalized summary of your store's performance this year — revenue, orders, ROAS, and more.",
        },
    };

    const copy = copyByType[latestReportType] || copyByType.monthly;
    const latestPeriod = getLatestAvailablePeriod();
    const latestReport =
        reports.monthly?.find((r) => r.period === latestPeriod) || reports.monthly?.[0];
    const latestPeriodLabel =
        latestReport?.periodLabel || getPeriodLabel(latestPeriod) || "Latest month";
    const savedReportCount = reports.monthly?.length ?? 0;

    const fetchReports = () => {
        if (!params.customerId) return;
        setReportsLoading(true);
        fetch(`/api/data-wrapped/${params.customerId}/reports`)
            .then((res) => (res.ok ? res.json() : { monthly: [], quarterly: [], yearly: [] }))
            .then((data) => {
                setReports(data);
                const allPeriods = [
                    ...(data.monthly || []).map((r) => r.period),
                    ...(data.quarterly || []).map((r) => r.period),
                    ...(data.yearly || []).map((r) => r.period),
                ].filter(Boolean);
                if (allPeriods.length > 0 && params.customerId) {
                    fetch("/api/data-wrapped/mark-opened", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ customerId: params.customerId, periods: allPeriods }),
                    })
                        .then(() => {
                            setUser((prev) => {
                                const prevObj =
                                    prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods)
                                        ? prev.openedWrappedPeriods
                                        : {};
                                const customerPeriods = [
                                    ...new Set([...(prevObj[params.customerId] || []), ...allPeriods]),
                                ];
                                return {
                                    ...prev,
                                    openedWrappedPeriods: { ...prevObj, [params.customerId]: customerPeriods },
                                };
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

    const openLatest = () => {
        const period = getLatestAvailablePeriod();
        pushGTMEvent(GTM_EVENTS.DATA_WRAPPED_MODAL_OPENED, {
            eventData: {
                customerId: params.customerId ? String(params.customerId) : "",
                period,
            },
        });
        setModalPeriod(period);
        setShowWrapped(true);
    };

    const openPeriod = (period) => {
        pushGTMEvent(GTM_EVENTS.DATA_WRAPPED_MODAL_OPENED, {
            eventData: {
                customerId: params.customerId ? String(params.customerId) : "",
                period: period != null ? String(period) : "",
            },
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
        <div id="DataWrappedPage" className="cobalt-perf w-full apex-dw-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Data Wrapped"
                label={customer?.customerName || ""}
                subtitle="Monthly performance stories for your store — swipe through full-screen chapters."
                showAnalyzeWithAi={false}
                showPdfExport={false}
            />

            <section className="apex-dw-spotlight" aria-labelledby="dw-spotlight-title">
                <div className="apex-dw-spotlight__body">
                    <p className="apex-dw-spotlight__eyebrow">Monthly wrapped</p>
                    <h2 id="dw-spotlight-title" className="apex-dw-spotlight__title">
                        {copy.title}
                    </h2>
                    <p className="apex-dw-spotlight__desc">{copy.description}</p>
                    <ul className="apex-dw-spotlight__topics" aria-label="Included in each report">
                        {WRAPPED_TOPICS.map((topic) => (
                            <li key={topic} className="apex-dw-spotlight__topic">
                                {topic}
                            </li>
                        ))}
                    </ul>
                </div>

                <aside className="apex-dw-spotlight__aside">
                    <div className="apex-dw-spotlight__card">
                        <div className="apex-dw-spotlight__card-head">
                            <span className="apex-dw-spotlight__card-label">Latest period</span>
                            {reportsLoading ? (
                                <span className="apex-dw-spotlight__card-period is-loading">Loading…</span>
                            ) : (
                                <span className="apex-dw-spotlight__card-period">{latestPeriodLabel}</span>
                            )}
                        </div>

                        {!reportsLoading && savedReportCount > 0 ? (
                            <p className="apex-dw-spotlight__card-meta">
                                <strong>{savedReportCount}</strong> saved report
                                {savedReportCount === 1 ? "" : "s"}
                            </p>
                        ) : null}

                        <button
                            type="button"
                            onClick={openLatest}
                            className="apex-perf-btn apex-perf-btn--primary apex-dw-spotlight__cta"
                            disabled={reportsLoading}
                        >
                            <FiGift aria-hidden />
                            View latest wrapped
                        </button>

                        <p className="apex-dw-spotlight__hint">
                            Opens full-screen · swipe through 12 chapters
                        </p>
                    </div>
                </aside>
            </section>

            <div className="apex-dw-history">
                <div className="apex-dw-history__head">
                    <h3 className="apex-dw-history__title">Historical overview</h3>
                    <p className="apex-dw-history__subtitle">Open previous wrapped reports</p>
                </div>

                {reportsLoading ? (
                    <div className="apex-dw-loader-panel">
                        <CobaltLoader variant="block" title="Loading reports" />
                    </div>
                ) : (
                    <div className="apex-dw-history__grid">
                        <div className="apex-dw-history__col">
                            <div className="apex-dw-history__col-head">
                                <FiCalendar aria-hidden />
                                <h4 className="apex-dw-history__col-title">Monthly</h4>
                            </div>
                            {reports.monthly?.length > 0 ? (
                                <div className="apex-dw-period-list">
                                    {reports.monthly.map((r) => (
                                        <button
                                            key={r.period}
                                            type="button"
                                            onClick={() => openPeriod(r.period)}
                                            className="apex-dw-period-btn"
                                        >
                                            <span>{r.periodLabel}</span>
                                            <FiChevronRight aria-hidden />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="apex-dw-empty-note">
                                    No monthly reports yet. View your latest wrapped to create one.
                                </p>
                            )}
                        </div>

                        <div className="apex-dw-history__col">
                            <div className="apex-dw-history__col-head">
                                <FiCalendar aria-hidden className="opacity-40" />
                                <h4 className="apex-dw-history__col-title is-muted">Quarterly</h4>
                                <span className="apex-dw-badge">Coming later</span>
                            </div>
                            <p className="apex-dw-empty-note">Quarterly reports will be available soon.</p>
                        </div>

                        <div className="apex-dw-history__col">
                            <div className="apex-dw-history__col-head">
                                <FiCalendar aria-hidden className="opacity-40" />
                                <h4 className="apex-dw-history__col-title is-muted">Yearly</h4>
                                <span className="apex-dw-badge">Coming later</span>
                            </div>
                            <p className="apex-dw-empty-note">Yearly reports will be available soon.</p>
                        </div>
                    </div>
                )}
            </div>

            {showWrapped ? (
                <DataWrappedCobaltModal
                    onClose={closeWrapped}
                    customerId={params.customerId}
                    customerName={customer?.customerName}
                    period={modalPeriod ?? getLatestAvailablePeriod()}
                />
            ) : null}
        </div>
    );
}
