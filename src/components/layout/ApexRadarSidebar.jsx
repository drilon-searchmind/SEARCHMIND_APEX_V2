"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FiChevronDown, FiChevronUp, FiBarChart, FiSearch, FiDollarSign } from "react-icons/fi";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LuRadar } from "react-icons/lu";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    apexRadarOverviewHref,
    apexRadarPerformanceInvestigatorHref,
    parseApexRadarPath,
} from "@/lib/apexRadarChannels";
import ApexRadarPerformanceInvestigatorCustomerModal from "@/components/apex-radar/ApexRadarPerformanceInvestigatorCustomerModal";

const ApexNavLink = ({ href, label, icon: Icon, pathname, isSmallScreen, isActive }) => {
    return (
        <li
            className={
                `py-2 rounded-lg w-full group relative ` +
                (isSmallScreen ? "px-2" : "px-6") +
                (isActive ? " bg-[var(--color-primary-searchmind-lighter)]" : "")
            }
        >
            <Link href={href} className="w-full">
                <span
                    className={`flex items-center justify-between text-[0.85rem] font-medium ${
                        isActive ? "text-white" : "text-slate-600"
                    }`}
                >
                    {isSmallScreen ? (
                        <>
                            <span className="flex items-center gap-0.5">
                                <Icon className="w-4 h-4" />
                            </span>
                            <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                {label}
                            </div>
                        </>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                        </span>
                    )}
                </span>
            </Link>
        </li>
    );
};

const ApexNavPlaceholder = ({ label, icon: Icon, isSmallScreen }) => (
    <li
        className={`py-2 rounded-lg w-full group relative opacity-65 ${isSmallScreen ? "px-2" : "px-6"}`}
        title="Coming soon"
    >
        <span className="w-full cursor-default block">
            <span className="flex items-center justify-between text-[0.85rem] font-medium text-slate-500">
                {isSmallScreen ? (
                    <>
                        <span className="flex items-center gap-0.5">
                            <Icon className="w-4 h-4" />
                        </span>
                        <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                            {label}
                        </div>
                    </>
                ) : (
                    <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                    </span>
                )}
            </span>
        </span>
    </li>
);

function ApexRadarChannelSwitcher({ channel, customerId, isSmallScreen }) {
    if (isSmallScreen) {
        return (
            <div className="mt-auto pt-3 border-t border-gray-200/30 px-1 pb-3 space-y-2">
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK, customerId)}
                    title={APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].label}
                    className={`flex justify-center rounded-md py-2 text-[0.65rem] font-bold ${
                        channel === APEX_RADAR_CHANNEL_FACEBOOK
                            ? "bg-[var(--color-primary-searchmind-lighter)] text-white"
                            : "text-slate-600 hover:bg-white/10"
                    }`}
                >
                    PS
                </Link>
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS, customerId)}
                    title={APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].label}
                    className={`flex justify-center rounded-md py-2 text-[0.65rem] font-bold ${
                        channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
                            ? "bg-[var(--color-primary-searchmind-lighter)] text-white"
                            : "text-slate-600 hover:bg-white/10"
                    }`}
                >
                    Ads
                </Link>
            </div>
        );
    }

    return (
        <div className="mt-auto pt-4 border-t border-gray-200/30 pb-6 shrink-0">
            <p className="text-gray-400 mb-2 uppercase text-xs">Platform</p>
            <div className="flex rounded-lg border border-gray-300/80 bg-white/10 overflow-hidden p-0.5 gap-0.5">
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK, customerId)}
                    className={`flex-1 text-center rounded-md py-2 text-xs font-semibold transition-colors ${
                        channel === APEX_RADAR_CHANNEL_FACEBOOK
                            ? "bg-[var(--color-primary-searchmind-lighter)] text-white"
                            : "text-slate-700 hover:bg-white/20"
                    }`}
                >
                    {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].shortLabel}
                </Link>
                <Link
                    href={apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS, customerId)}
                    className={`flex-1 text-center rounded-md py-2 text-xs font-semibold transition-colors ${
                        channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
                            ? "bg-[var(--color-primary-searchmind-lighter)] text-white"
                            : "text-slate-700 hover:bg-white/20"
                    }`}
                >
                    {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].shortLabel}
                </Link>
            </div>
            {!channel && (
                <p className="text-[0.65rem] text-gray-500 mt-2 leading-snug">
                    Choose PS or GAds after opening a platform from the picker.
                </p>
            )}
        </div>
    );
}

/**
 * Dashboard-style sidebar for Apex Radar routes (same shell as {@link Sidebar}, different links).
 */
export default function ApexRadarSidebar() {
    const [radarOpen, setRadarOpen] = useState(true);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [performanceInvestigatorModalOpen, setPerformanceInvestigatorModalOpen] = useState(false);
    const pathname = usePathname();
    const { channel, customerId } = parseApexRadarPath(pathname);

    const overviewHref = channel ? apexRadarOverviewHref(channel, customerId) : "/apex-radar";
    const overviewActive = pathname === overviewHref;
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
            className={`flex flex-col min-h-0 h-full xl:mt-0 top-0 left-0 bg-[var(--color-primary-searchmind)] text-gray-900 transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${
                isSmallScreen ? "w-[50px] px-2" : "w-[300px] px-8"
            }`}
        >
            <div className={`py-8 flex justify-start shrink-0 ${isSmallScreen ? "mb-0" : "mb-0"}`}>
                <Link href="/" className="flex flex-col gap-0">
                    <span className="flex items-end gap-2">
                        <Image
                            id="logoApex"
                            src="/images/icons/apex-icon-svg.svg"
                            alt="Apex Icon"
                            width={20}
                            height={20}
                            className="mb-0 h-auto"
                        />
                        <h2 className="text-xl font-bold hidden xl:block">Apex</h2>
                    </span>
                    {!isSmallScreen && <p className="text-gray-400 text-xs">by Searchmind</p>}
                </Link>
            </div>

            {!isSmallScreen && (
                <div className="shrink-0">
                    <p className="text-gray-400 mb-4 uppercase text-xs">Menu</p>
                </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                <nav className="mb-6 shrink-0">
                    <ul className="space-y-4">
                        <li>
                            <button
                                type="button"
                                className={`mb-3 flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${
                                    isSmallScreen ? "hidden" : ""
                                }`}
                                onClick={() => setRadarOpen(!radarOpen)}
                            >
                                <span className="flex items-center text-slate-800 font-medium rounded-lg w-full">
                                    <LuRadar className={isSmallScreen ? "" : "mr-2"} />
                                    {!isSmallScreen && "Apex Radar"}
                                </span>
                                {!isSmallScreen && (radarOpen ? <FiChevronUp /> : <FiChevronDown />)}
                            </button>
                            {radarOpen && (
                                <ul className={`mt-2 space-y-2 flex flex-col w-full ${isSmallScreen ? "ml-0" : ""}`}>
                                    <ApexNavLink
                                        href={overviewHref}
                                        label="Overview"
                                        icon={FiBarChart}
                                        pathname={pathname}
                                        isSmallScreen={isSmallScreen}
                                        isActive={overviewActive}
                                    />
                                    {performanceInvestigatorHref ? (
                                        <ApexNavLink
                                            href={performanceInvestigatorHref}
                                            label="Performance Investigator"
                                            icon={FiSearch}
                                            pathname={pathname}
                                            isSmallScreen={isSmallScreen}
                                            isActive={performanceInvestigatorActive}
                                        />
                                    ) : (
                                        <li
                                            className={
                                                `py-2 rounded-lg w-full group relative ` +
                                                (isSmallScreen ? "px-2" : "px-6") +
                                                (performanceInvestigatorActive
                                                    ? " bg-[var(--color-primary-searchmind-lighter)]"
                                                    : "")
                                            }
                                        >
                                            <button
                                                type="button"
                                                className="w-full"
                                                onClick={() => setPerformanceInvestigatorModalOpen(true)}
                                            >
                                                <span
                                                    className={`flex items-center justify-between text-[0.85rem] font-medium ${
                                                        performanceInvestigatorActive ? "text-white" : "text-slate-600"
                                                    }`}
                                                >
                                                    {isSmallScreen ? (
                                                        <>
                                                            <span className="flex items-center gap-0.5">
                                                                <FiSearch className="w-4 h-4" />
                                                            </span>
                                                            <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                Performance Investigator
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="flex items-center gap-2">
                                                            <FiSearch className="w-4 h-4 shrink-0" />
                                                            Performance Investigator
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    )}
                                    <ApexNavPlaceholder
                                        label="Budget Report"
                                        icon={FiDollarSign}
                                        isSmallScreen={isSmallScreen}
                                    />
                                </ul>
                            )}
                        </li>
                    </ul>
                </nav>

                <ApexRadarChannelSwitcher channel={channel} customerId={customerId} isSmallScreen={isSmallScreen} />
            </div>

            <ApexRadarPerformanceInvestigatorCustomerModal
                open={performanceInvestigatorModalOpen}
                onClose={() => setPerformanceInvestigatorModalOpen(false)}
                channel={channel}
            />
        </aside>
    );
}
