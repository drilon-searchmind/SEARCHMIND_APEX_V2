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

            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <h1 className="text-xl font-bold text-gray-900">Apex Radar</h1>
                <p className="text-sm text-gray-500 mt-2">
                    Pick an ad platform to open the overview, or use the switcher at the bottom of the sidebar.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK)}
                        className="inline-flex justify-center rounded-lg bg-[var(--color-primary-searchmind)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-searchmind-hover)] transition-colors"
                    >
                        {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                    </Link>
                    <Link
                        href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS)}
                        className="inline-flex justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                        {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                    </Link>
                </div>
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-6 text-xs font-semibold text-[var(--color-primary-searchmind)] hover:underline"
                >
                    Open platform picker again
                </button>
            </div>
        </div>
    );
}
