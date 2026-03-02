"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useSetUser } from "@/contexts/UserContext";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DataWrappedModal from "./components/DataWrappedModal";
import { FiGift, FiCalendar, FiChevronRight } from "react-icons/fi";

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

export default function DataWrappedPage() {
    const params = useParams();
    const setUser = useSetUser();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const [showModal, setShowModal] = useState(false);
    const [modalPeriod, setModalPeriod] = useState(null);
    const [reports, setReports] = useState({ monthly: [], quarterly: [], yearly: [] });
    const [reportsLoading, setReportsLoading] = useState(true);

    const latestReportType = reports.monthly?.length > 0 ? "monthly" : "monthly";

    const copyByType = {
        monthly: {
            title: "Your Monthly Ecommerce Wrapped",
            description: "A personalized summary of your store's performance this month — revenue, orders, ROAS, and more.",
        },
        quarterly: {
            title: "Your Quarterly Ecommerce Wrapped",
            description: "A personalized summary of your store's performance this quarter — revenue, orders, ROAS, and more.",
        },
        yearly: {
            title: "Your Annual Ecommerce Wrapped",
            description: "A personalized summary of your store's performance this year — revenue, orders, ROAS, and more.",
        },
    };

    const copy = copyByType[latestReportType] || copyByType.monthly;

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
                                const prevObj = prev?.openedWrappedPeriods && !Array.isArray(prev.openedWrappedPeriods)
                                    ? prev.openedWrappedPeriods
                                    : {};
                                const customerPeriods = [...new Set([...(prevObj[params.customerId] || []), ...allPeriods])];
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
        setModalPeriod(getLatestAvailablePeriod());
        setShowModal(true);
    };

    const openPeriod = (period) => {
        setModalPeriod(period);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalPeriod(null);
        fetchReports();
    };

    return (
        <div className="w-full">
            <DashboardHeading
                title="Data Wrapped"
                label={customer?.customerName || ""}
                showAnalyzeWithAi={false}
            />

            <div className="flex flex-col gap-8">
                {/* Hero - View latest */}
                <div className="flex flex-col items-center justify-center min-h-[280px] bg-white border border-gray-200 rounded-xl p-8">
                    <div className="text-center max-w-lg">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary-searchmind)]/10 mb-6">
                            <FiGift className="text-4xl text-[var(--color-primary-searchmind)]" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {copy.title}
                        </h2>
                        <p className="text-gray-500 mb-8">
                            {copy.description}
                        </p>
                        <button
                            type="button"
                            onClick={openLatest}
                            className="px-6 py-3 rounded-xl font-semibold text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] transition-colors flex items-center gap-2 mx-auto"
                        >
                            <FiGift className="text-lg" />
                            View Latest Wrapped
                        </button>
                    </div>
                </div>

                {/* Historical overview */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Historical overview</h3>
                        <p className="text-sm text-gray-500 mt-1">Open previous wrapped reports</p>
                    </div>

                    {reportsLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {/* Monthly */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiCalendar className="text-[var(--color-primary-searchmind)]" />
                                    <h4 className="font-medium text-gray-900">Monthly</h4>
                                </div>
                                {reports.monthly?.length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {reports.monthly.map((r) => (
                                            <button
                                                key={r.period}
                                                type="button"
                                                onClick={() => openPeriod(r.period)}
                                                className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind)]/5 transition-colors text-left group"
                                            >
                                                <span className="font-medium text-gray-900">{r.periodLabel}</span>
                                                <FiChevronRight className="text-gray-400 group-hover:text-[var(--color-primary-searchmind)] transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No monthly reports yet. View your latest wrapped to create one.</p>
                                )}
                            </div>

                            {/* Quarterly - coming later */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiCalendar className="text-gray-300" />
                                    <h4 className="font-medium text-gray-500">Quarterly</h4>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Coming later</span>
                                </div>
                                <p className="text-sm text-gray-400">Quarterly reports will be available soon.</p>
                            </div>

                            {/* Yearly - coming later */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiCalendar className="text-gray-300" />
                                    <h4 className="font-medium text-gray-500">Yearly</h4>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Coming later</span>
                                </div>
                                <p className="text-sm text-gray-400">Yearly reports will be available soon.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <DataWrappedModal
                    onClose={closeModal}
                    customerId={params.customerId}
                    customerName={customer?.customerName}
                    period={modalPeriod ?? getLatestAvailablePeriod()}
                />
            )}
        </div>
    );
}
