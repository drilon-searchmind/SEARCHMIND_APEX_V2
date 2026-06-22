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
            className="apex-radar-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-radar-platform-title"
        >
            <div className="apex-radar-modal apex-radar-modal--md">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-radar-platform-title" className="apex-radar-modal__title">
                            Choose platform
                        </h2>
                        <p className="apex-radar-modal__subtitle">
                            Apex Radar is split by ad platform. You can switch anytime in the sidebar.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="apex-radar-modal__close" aria-label="Close">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="apex-radar-modal__body space-y-3">
                    <button
                        type="button"
                        onClick={() => choose(APEX_RADAR_CHANNEL_FACEBOOK)}
                        className="apex-radar-platform-card"
                    >
                        <span className="apex-radar-platform-card__icon bg-[#1877F2]/10 text-[#1877F2]">
                            <SiFacebook className="h-7 w-7" aria-hidden />
                        </span>
                        <span>
                            <span className="apex-radar-platform-card__title">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                            </span>
                            <span className="apex-radar-platform-card__desc">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].description}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => choose(APEX_RADAR_CHANNEL_GOOGLE_ADS)}
                        className="apex-radar-platform-card"
                    >
                        <span className="apex-radar-platform-card__icon bg-[#4285F4]/10 text-[#4285F4]">
                            <SiGoogleads className="h-7 w-7" aria-hidden />
                        </span>
                        <span>
                            <span className="apex-radar-platform-card__title">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                            </span>
                            <span className="apex-radar-platform-card__desc">
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].description}
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
