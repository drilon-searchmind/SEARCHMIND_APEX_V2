"use client";

import React from "react";
import {
    FiBarChart2,
    FiChevronDown,
    FiDollarSign,
    FiMousePointer,
    FiPercent,
    FiTarget,
    FiTrendingUp,
} from "react-icons/fi";
import MetricCard from "@/components/dashboard/MetricCard";
import { MOCK_PI_FUNNEL as F } from "../lib/mockPerformanceInvestigatorData";

const iconClass = "text-[var(--color-primary-searchmind-lighter)] font-bold text-lg";

function funnelChange(changePct) {
    if (changePct == null || Number.isNaN(changePct)) {
        return { change: undefined, changeType: undefined };
    }
    if (changePct === 0) return { change: undefined, changeType: undefined };
    const changeType = changePct > 0 ? "up" : "down";
    const change = Math.abs(changePct).toFixed(Number.isInteger(changePct) ? 0 : 1);
    return { change, changeType };
}

function FunnelMetric({ label, value, changePct, icon }) {
    const { change, changeType } = funnelChange(changePct);
    return (
        <MetricCard
            label={<span className="text-xs sm:text-sm leading-snug">{label}</span>}
            value={value}
            change={change}
            changeType={changeType}
            icon={icon}
            popOverContent={null}
        />
    );
}

function StepDivider() {
    return (
        <div className="relative flex w-full items-center justify-center py-3" aria-hidden>
            <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gray-200" />
            <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm ring-4 ring-white">
                <FiChevronDown className="h-7 w-7" strokeWidth={2.25} />
            </span>
        </div>
    );
}

/**
 * Full-width waterfall: outcome at top, inputs below in clear grid rows (no cramped tree).
 */
export default function PerformanceInvestigatorFunnel() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-5 text-lg font-semibold text-gray-900">Performance funnel</h3>
            <p className="mb-6 text-sm text-gray-500">
                Top-line outcome first, then supporting metrics in reading order (static demo data).
            </p>

            <div className="flex w-full flex-col gap-1">
                <FunnelMetric
                    label={F.convValue.label}
                    value={F.convValue.value}
                    changePct={F.convValue.changePct}
                    icon={<FiTrendingUp className={iconClass} />}
                />
                <StepDivider />

                <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                    <FunnelMetric
                        label={F.conversions.label}
                        value={F.conversions.value}
                        changePct={F.conversions.changePct}
                        icon={<FiTarget className={iconClass} />}
                    />
                    <FunnelMetric
                        label={F.aov.label}
                        value={F.aov.value}
                        changePct={F.aov.changePct}
                        icon={<FiDollarSign className={iconClass} />}
                    />
                </div>
                <StepDivider />

                <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                    <FunnelMetric
                        label={F.convRate.label}
                        value={F.convRate.value}
                        changePct={F.convRate.changePct}
                        icon={<FiPercent className={iconClass} />}
                    />
                    <FunnelMetric
                        label={F.clicks.label}
                        value={F.clicks.value}
                        changePct={F.clicks.changePct}
                        icon={<FiMousePointer className={iconClass} />}
                    />
                </div>
                <StepDivider />

                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                    <FunnelMetric
                        label={F.ctr.label}
                        value={F.ctr.value}
                        changePct={F.ctr.changePct}
                        icon={<FiBarChart2 className={iconClass} />}
                    />
                    <FunnelMetric
                        label={F.cpc.label}
                        value={F.cpc.value}
                        changePct={F.cpc.changePct}
                        icon={<FiDollarSign className={iconClass} />}
                    />
                    <FunnelMetric
                        label={F.impr.label}
                        value={F.impr.value}
                        changePct={F.impr.changePct}
                        icon={<FiBarChart2 className={iconClass} />}
                    />
                </div>
                <StepDivider />

                <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                    <FunnelMetric
                        label={F.cost.label}
                        value={F.cost.value}
                        changePct={F.cost.changePct}
                        icon={<FiDollarSign className={iconClass} />}
                    />
                    <FunnelMetric
                        label={F.freq.label}
                        value={F.freq.value}
                        changePct={F.freq.changePct}
                        icon={<FiBarChart2 className={iconClass} />}
                    />
                </div>
            </div>
        </div>
    );
}
