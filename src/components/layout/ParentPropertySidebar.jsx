"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiBarChart, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useParentPropertyView, PARENT_VIEWS } from "@/contexts/ParentPropertyViewContext";

const VIEW_ITEMS = [
    { id: PARENT_VIEWS.START, label: "Home" },
    { id: PARENT_VIEWS.OVERVIEW, label: "Overview" },
    { id: PARENT_VIEWS.DAILY, label: "Daily" },
    // Pace Report, P&L, Ecommerce hidden for now
];

function ViewNavItem({ viewId, label, subLabel, activeView, onSelect, isSmallScreen }) {
    const isActive = activeView === viewId;

    return (
        <li
            className={`py-2 rounded-lg w-full group relative cursor-pointer ${
                isSmallScreen ? "px-2" : "px-6"
            } ${isActive ? " bg-[var(--color-primary-searchmind-lighter)]" : ""}`}
            onClick={() => onSelect(viewId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(viewId);
                }
            }}
        >
            <span
                className={`flex items-center justify-between text-[0.85rem] font-medium ${
                    isActive ? "text-white" : "text-slate-600"
                }`}
            >
                {isSmallScreen ? (
                    <>
                        <span className="w-2 h-2 rounded-full bg-current opacity-70" aria-hidden />
                        <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                            {label}
                        </div>
                    </>
                ) : (
                    <>
                        <span>{label}</span>
                        {subLabel && (
                            <span className="text-xs text-gray-400 font-normal">{subLabel}</span>
                        )}
                    </>
                )}
            </span>
        </li>
    );
}

export default function ParentPropertySidebar() {
    const { activeView, setActiveView } = useParentPropertyView();
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [dashboardOpen, setDashboardOpen] = useState(true);

    useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth < 1500);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <aside
            className={`flex flex-col xl:mt-0 top-0 left-0 bg-white text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${
                isSmallScreen ? "w-[50px] px-2" : "w-[300px] px-8"
            }`}
        >
            <div className={`py-8 flex justify-start ${isSmallScreen ? "mb-0" : "mb-0"}`}>
                <Link href="/" className="flex flex-col gap-0">
                    <span className="flex items-end gap-2">
                        <Image
                            src="/images/icons/apex-icon-svg.svg"
                            alt="Apex Icon"
                            width={20}
                            height={20}
                            className="mb-0 h-auto"
                            id="logoApex"
                        />
                        <h2 className="text-xl font-bold hidden xl:block">Apex</h2>
                    </span>
                    {!isSmallScreen && <p className="text-gray-400 text-xs">by Searchmind</p>}
                </Link>
            </div>

            <div className="">
                {!isSmallScreen && (
                    <div className="">
                        <p className="text-gray-400 mb-4 uppercase text-xs">Group Menu</p>
                    </div>
                )}

                <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                    <nav className="mb-6">
                        <ul className="space-y-4">
                            <li className="relative group">
                                <button
                                    className={`mb-3 flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}`}
                                    onClick={() => setDashboardOpen(!dashboardOpen)}
                                    title={isSmallScreen ? "Dashboard" : ""}
                                >
                                    <span className="flex items-center text-slate-800 font-medium rounded-lg w-full">
                                        <FiBarChart className={isSmallScreen ? "" : "mr-2"} />
                                        {!isSmallScreen && "Dashboard"}
                                    </span>
                                    {!isSmallScreen && (dashboardOpen ? <FiChevronUp /> : <FiChevronDown />)}
                                </button>
                                {dashboardOpen && (
                                    <ul className={`mt-2 space-y-2 flex flex-col w-full ${isSmallScreen ? "ml-0" : ""}`}>
                                        {VIEW_ITEMS.map((item) => (
                                            <ViewNavItem
                                                key={item.id}
                                                viewId={item.id}
                                                label={item.label}
                                                subLabel={item.subLabel}
                                                activeView={activeView}
                                                onSelect={setActiveView}
                                                isSmallScreen={isSmallScreen}
                                            />
                                        ))}
                                    </ul>
                                )}
                                {isSmallScreen && (
                                    <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                        Dashboard
                                    </div>
                                )}
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </aside>
    );
}
