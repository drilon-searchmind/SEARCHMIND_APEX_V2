"use client";

import React from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiUsers, FiEye, FiPercent, FiClock } from "react-icons/fi";

const METRICS = [
  { key: "totalUsers", label: "Unique Visitors", icon: FiUsers },
  { key: "screenPageViews", label: "Total Pageviews", icon: FiEye },
  { key: "bounceRate", label: "Bounce Rate", icon: FiPercent },
  { key: "averageSessionDuration", label: "Visit Duration", icon: FiClock },
];

function formatValue(key, value) {
  if (value == null) return "-";
  if (key === "bounceRate") return `${Number(value).toFixed(2)}%`;
  if (key === "averageSessionDuration") {
    const sec = Number(value);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return Number(value).toLocaleString("da-DK");
}

export default function MetricCards({ totals = {}, selectedKey, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-6 mb-8">
      {METRICS.map((m) => {
        const Icon = m.icon;
        const isActive = selectedKey === m.key;
        return (
          <div key={m.key} className="cursor-pointer" onClick={() => onSelect?.(m.key)}>
            <MetricCard
              label={m.label}
              value={formatValue(m.key, totals[m.key])}
              icon={<Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
              isActive={isActive}
            />
          </div>
        );
      })}
    </div>
  );
}

export { METRICS };
