"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FiX } from "react-icons/fi";
import { SiFacebook, SiGoogleads } from "react-icons/si";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    apexRadarOverviewHref,
} from "@/lib/apexRadarChannels";

export default function ApexRadarPlatformModal({ onClose }) {
    const router = useRouter();

    const choose = (channel) => {
        router.push(apexRadarOverviewHref(channel));
        onClose?.();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-radar-platform-title"
        >
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 id="apex-radar-platform-title" className="text-lg font-semibold text-gray-900">
                            Choose platform
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Apex Radar is split by ad platform. You can switch anytime in the sidebar.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    <button
                        type="button"
                        onClick={() => choose(APEX_RADAR_CHANNEL_FACEBOOK)}
                        className="w-full flex items-center gap-4 rounded-xl border border-gray-200 px-4 py-4 text-left transition-colors hover:border-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)]/20"
                    >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                            <SiFacebook className="h-7 w-7" aria-hidden />
                        </span>
                        <span>
                            <span className="block font-semibold text-gray-900">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].description}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => choose(APEX_RADAR_CHANNEL_GOOGLE_ADS)}
                        className="w-full flex items-center gap-4 rounded-xl border border-gray-200 px-4 py-4 text-left transition-colors hover:border-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)]/20"
                    >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#4285F4]/10 text-[#4285F4]">
                            <SiGoogleads className="h-7 w-7" aria-hidden />
                        </span>
                        <span>
                            <span className="block font-semibold text-gray-900">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].description}
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
