"use client";

import React, { useState } from "react";
import Link from "next/link";
import ApexRadarPlatformModal from "./components/ApexRadarPlatformModal";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    apexRadarOverviewHref,
} from "@/lib/apexRadarChannels";

export default function ApexRadarPlatformPickerPage() {
    const [modalOpen, setModalOpen] = useState(true);

    return (
        <div className="w-full max-w-xl mx-auto py-12 px-4">
            {modalOpen && <ApexRadarPlatformModal onClose={() => setModalOpen(false)} />}

            <div className="apex-radar-picker-card">
                <h1 className="apex-radar-section__title">Apex Radar</h1>
                <p className="apex-radar-section__subtitle mt-2">
                    Pick an ad platform to open the overview, or use the switcher at the bottom of the sidebar.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK)}
                        className="apex-perf-btn apex-perf-btn--primary justify-center"
                    >
                        {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                    </Link>
                    <Link
                        href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS)}
                        className="apex-perf-btn apex-perf-btn--secondary justify-center"
                    >
                        {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                    </Link>
                </div>
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-6 text-xs font-semibold text-[var(--color-accent-light)] hover:underline"
                >
                    Open platform picker again
                </button>
            </div>
        </div>
    );
}
