"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FiChevronDown, FiChevronUp, FiBarChart, FiSearch, FiDollarSign, FiTool, FiUsers } from "react-icons/fi";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LuRadar } from "react-icons/lu";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    APEX_RADAR_CS_HREF,
    apexRadarCsHref,
    apexRadarOverviewHref,
    apexRadarPerformanceInvestigatorHref,
    parseApexRadarPath,
} from "@/lib/apexRadarChannels";
import { APEX_RADAR_DEV_TOOLS_HREF } from "@/lib/apexRadarDevToolsAccess";
import { useApexRadarDevToolsAccess } from "@/app/(protected)/apex-radar/hooks/useApexRadarDevToolsAccess";
import ApexRadarPerformanceInvestigatorCustomerModal from "@/components/apex-radar/ApexRadarPerformanceInvestigatorCustomerModal";

const ApexNavLink = ({ href, label, icon: Icon, isSmallScreen, isActive }) => {
    return (
        <li className={`apex-dash-nav__item${isActive ? " is-active" : ""}${isSmallScreen ? " is-collapsed" : ""}`}>
            <Link href={href} className="apex-dash-nav__link">
                {isSmallScreen ? (
                    <>
                        <span className="apex-dash-nav__link-main">
                            <Icon className="w-4 h-4" aria-hidden />
                        </span>
                        <span className="apex-dash-nav__tooltip">{label}</span>
                    </>
                ) : (
                    <span className="apex-dash-nav__link-main">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{label}</span>
                    </span>
                )}
            </Link>
        </li>
    );
};

const ApexNavPlaceholder = ({ label, icon: Icon, isSmallScreen }) => (
    <li
        className={`apex-dash-nav__item opacity-65${isSmallScreen ? " is-collapsed" : ""}`}
        title="Coming soon"
    >
        <span className="apex-dash-nav__link cursor-default">
            {isSmallScreen ? (
                <>
                    <span className="apex-dash-nav__link-main">
                        <Icon className="w-4 h-4" aria-hidden />
                    </span>
                    <span className="apex-dash-nav__tooltip">{label}</span>
                </>
            ) : (
                <span className="apex-dash-nav__link-main">
                    <Icon className="w-4 h-4 shrink-0" aria-hidden />
                    <span>{label}</span>
                </span>
            )}
        </span>
    </li>
);

function ApexRadarChannelSwitcher({ channel, customerId, isSmallScreen }) {
    if (isSmallScreen) {
        return (
            <div className="apex-radar-sidebar__switch-compact">
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK, customerId)}
                    title={APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                    className={channel === APEX_RADAR_CHANNEL_FACEBOOK ? "is-active" : ""}
                >
                    PS
                </Link>
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS, customerId)}
                    title={APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                    className={channel === APEX_RADAR_CHANNEL_GOOGLE_ADS ? "is-active" : ""}
                >
                    Ads
                </Link>
            </div>
        );
    }

    return (
        <div className="apex-radar-sidebar__platform shrink-0">
            <p className="apex-dash-sidebar__menu-label">Platform</p>
            <div className="apex-radar-sidebar__switch">
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK, customerId)}
                    className={channel === APEX_RADAR_CHANNEL_FACEBOOK ? "is-active" : ""}
                >
                    {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].shortLabel}
                </Link>
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS, customerId)}
                    className={channel === APEX_RADAR_CHANNEL_GOOGLE_ADS ? "is-active" : ""}
                >
                    {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].shortLabel}
                </Link>
            </div>
            {!channel && (
                <p className="apex-radar-sidebar__platform-hint">
                    Choose PS or GAds after opening a platform from the picker.
                </p>
            )}
        </div>
    );
}

export default function ApexRadarSidebar() {
    const [radarOpen, setRadarOpen] = useState(true);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [performanceInvestigatorModalOpen, setPerformanceInvestigatorModalOpen] = useState(false);
    const pathname = usePathname();
    const { channel, customerId, isCs } = parseApexRadarPath(pathname);
    const { allowed: devToolsAllowed } = useApexRadarDevToolsAccess();

    const overviewHref = channel ? apexRadarOverviewHref(channel, customerId) : "/apex-radar";
    const overviewActive = pathname === overviewHref;
    const csActive = isCs || pathname === APEX_RADAR_CS_HREF || pathname.startsWith(`${APEX_RADAR_CS_HREF}/`);
    const devToolsActive = pathname === APEX_RADAR_DEV_TOOLS_HREF || pathname.startsWith(`${APEX_RADAR_DEV_TOOLS_HREF}/`);
    const performanceInvestigatorHref =
        channel && customerId ? apexRadarPerformanceInvestigatorHref(channel, customerId) : null;
    const performanceInvestigatorActive = pathname.includes("/performance-investigator");

    useEffect(() => {
        const handleResize = () => setIsSmallScreen(window.innerWidth < 1500);
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <aside
            id="apexRadarSidebar"
            className={`apex-dash-sidebar ${isSmallScreen ? "is-collapsed" : "is-expanded"}`}
        >
            <Link href="/home" className="apex-dash-sidebar__brand">
                <span className="apex-dash-sidebar__brand-mark">
                    <Image
                        src="/images/icons/apex-icon-svg.svg"
                        alt=""
                        width={20}
                        height={20}
                        aria-hidden
                    />
                    {!isSmallScreen && (
                        <span className="apex-dash-sidebar__brand-name">Apex</span>
                    )}
                </span>
            </Link>

            {!isSmallScreen && <p className="apex-dash-sidebar__menu-label">Menu</p>}

            <div className="apex-dash-sidebar__scroll no-scrollbar">
                <nav>
                    <ul className="apex-dash-nav">
                        <li>
                            {!isSmallScreen && (
                                <button
                                    type="button"
                                    className="apex-dash-nav__section-btn"
                                    onClick={() => setRadarOpen(!radarOpen)}
                                >
                                    <span className="apex-dash-nav__section-label">
                                        <LuRadar className="apex-dash-nav__section-icon" aria-hidden />
                                        Apex Radar
                                    </span>
                                    {radarOpen ? <FiChevronUp /> : <FiChevronDown />}
                                </button>
                            )}
                            {(radarOpen || isSmallScreen) && (
                                <ul className="apex-dash-nav__sub">
                                    <ApexNavLink
                                        href={overviewHref}
                                        label="Overview"
                                        icon={FiBarChart}
                                        isSmallScreen={isSmallScreen}
                                        isActive={overviewActive}
                                    />
                                    {performanceInvestigatorHref ? (
                                        <ApexNavLink
                                            href={performanceInvestigatorHref}
                                            label="Performance Investigator"
                                            icon={FiSearch}
                                            isSmallScreen={isSmallScreen}
                                            isActive={performanceInvestigatorActive}
                                        />
                                    ) : (
                                        <li
                                            className={`apex-dash-nav__item${
                                                performanceInvestigatorActive ? " is-active" : ""
                                            }${isSmallScreen ? " is-collapsed" : ""}`}
                                        >
                                            <button
                                                type="button"
                                                className="apex-dash-nav__link w-full"
                                                onClick={() => setPerformanceInvestigatorModalOpen(true)}
                                            >
                                                {isSmallScreen ? (
                                                    <>
                                                        <span className="apex-dash-nav__link-main">
                                                            <FiSearch className="w-4 h-4" aria-hidden />
                                                        </span>
                                                        <span className="apex-dash-nav__tooltip">
                                                            Performance Investigator
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="apex-dash-nav__link-main">
                                                        <FiSearch className="w-4 h-4 shrink-0" aria-hidden />
                                                        <span>Performance Investigator</span>
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    )}
                                    <ApexNavLink
                                        href={apexRadarCsHref(isCs ? null : customerId)}
                                        label="Alerts"
                                        icon={FiUsers}
                                        isSmallScreen={isSmallScreen}
                                        isActive={csActive}
                                    />
                                    <ApexNavPlaceholder
                                        label="Budget Report"
                                        icon={FiDollarSign}
                                        isSmallScreen={isSmallScreen}
                                    />
                                    {devToolsAllowed ? (
                                        <ApexNavLink
                                            href={APEX_RADAR_DEV_TOOLS_HREF}
                                            label="Dev Tools"
                                            icon={FiTool}
                                            isSmallScreen={isSmallScreen}
                                            isActive={devToolsActive}
                                        />
                                    ) : null}
                                </ul>
                            )}
                        </li>
                    </ul>
                </nav>
            </div>

            <ApexRadarChannelSwitcher
                channel={channel}
                customerId={customerId}
                isSmallScreen={isSmallScreen}
            />

            <ApexRadarPerformanceInvestigatorCustomerModal
                open={performanceInvestigatorModalOpen}
                onClose={() => setPerformanceInvestigatorModalOpen(false)}
                channel={channel}
            />
        </aside>
    );
}
