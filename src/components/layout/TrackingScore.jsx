"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiRefreshCw } from "react-icons/fi";
import Link from "next/link";
import { useCustomers } from "@/hooks/useCustomers";

const EMPTY_SCORES = {
    performance: 0,
    tracking: 0,
    compliance: 0,
};

function getOverallScore(scores, totalScoreFromApi) {
    if (totalScoreFromApi != null && totalScoreFromApi > 0) return totalScoreFromApi;
    const values = Object.values(scores).filter(v => typeof v === 'number');
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

const SCORE_LABELS = {
    performance: "Performance",
    tracking: "Tracking",
    compliance: "Compliance",
};

function getScoreColor(score) {
    if (score >= 80) return "bg-[var(--color-primary-searchmind)]";
    if (score >= 60) return "bg-[var(--color-primary-searchmind-lighter)]";
    return "bg-amber-500";
}

export default function TrackingScore({ customerId }) {
    const [scores, setScores] = useState(EMPTY_SCORES);
    const [totalScore, setTotalScore] = useState(0);
    const [hasScans, setHasScans] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showPopover, setShowPopover] = useState(false);
    const leaveTimeoutRef = useRef(null);
    const overall = getOverallScore(scores, totalScore);
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === customerId);
    const [customerSettings, setCustomerSettings] = useState(null);

    useEffect(() => {
        if (!customerId) {
            setScores(EMPTY_SCORES);
            setTotalScore(0);
            setHasScans(false);
            setLoading(false);
            return;
        }
        setLoading(true);
        fetch(`/api/customer-tracking-scores/${customerId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && data.createdAt != null) {
                    setScores({
                        performance: data.performanceScore ?? 0,
                        tracking: data.trackingScore ?? 0,
                        compliance: data.complianceScore ?? 0,
                    });
                    setTotalScore(data.totalScore ?? 0);
                    setHasScans(true);
                } else {
                    setScores(EMPTY_SCORES);
                    setTotalScore(0);
                    setHasScans(false);
                }
            })
            .catch(() => {
                setScores(EMPTY_SCORES);
                setTotalScore(0);
                setHasScans(false);
            })
            .finally(() => setLoading(false));
    }, [customerId]);

    const handleMouseEnter = () => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
        setShowPopover(true);
    };

    const handleMouseLeave = () => {
        leaveTimeoutRef.current = setTimeout(() => setShowPopover(false), 150);
    };

    const handleNewScan = () => {
        // Placeholder for future scan action
        setShowPopover(false);
    };

    useEffect(() => {
        if (customer) {
            setCustomerSettings(customer.CustomerSettings);
        }
    }, [customer]);

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="flex flex-col items-center cursor-pointer group">
                <div className="flex items-center gap-1.5">
                    <p className="text-gray-500 text-sm">Tracking Score</p>
                    <div
                        className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white font-semibold text-sm text-[var(--color-primary-searchmind)] transition-colors group-hover:border-[var(--color-primary-searchmind-lighter)]"
                        title="Tracking score"
                    >
                        {loading ? '—' : overall}
                    </div>
                </div>
                {showPopover && (
                    <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-3 px-4"
                        onMouseEnter={handleMouseEnter}
                    >
                        {/* Bar chart breakdown */}
                        <div className="space-y-2.5 mb-3">
                            {Object.entries(scores).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-xs text-gray-600 font-medium">
                                            {SCORE_LABELS[key]}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-900">
                                            {value}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getScoreColor(value)} transition-all duration-300`}
                                            style={{ width: `${value}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!hasScans && !loading && (
                            <p className="text-xs text-gray-500 mb-2">No scans found</p>
                        )}
                        <Link
                            href={`https://searchmind-omnipixel-v2-production.up.railway.app/?customerId=${customerId}&referrer=searcmind-apex-tracking-score&customerUrl=${customerSettings?.googleSearchConsoleProperty}`}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-[var(--color-primary-searchmind-lighter)] transition-colors"
                            target="_blank"
                        >
                            <FiRefreshCw className="h-3.5 w-3.5" />
                            New Scan
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
