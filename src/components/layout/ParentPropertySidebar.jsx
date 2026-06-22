"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiBarChart, FiChevronDown, FiChevronUp, FiHome, FiCalendar } from "react-icons/fi";
import { useParentPropertyView, PARENT_VIEWS } from "@/contexts/ParentPropertyViewContext";

const VIEW_ITEMS = [
    { id: PARENT_VIEWS.START, label: "Home", icon: FiHome },
    { id: PARENT_VIEWS.OVERVIEW, label: "Overview", icon: FiBarChart },
    { id: PARENT_VIEWS.DAILY, label: "Daily", icon: FiCalendar },
];

function ViewNavItem({ viewId, label, Icon, activeView, onSelect, isSmallScreen }) {
    const isActive = activeView === viewId;

    return (
        <li className={`apex-dash-nav__item${isActive ? " is-active" : ""}${isSmallScreen ? " is-collapsed" : ""}`}>
            <button
                type="button"
                className="apex-dash-nav__link w-full text-left border-none bg-transparent cursor-pointer"
                onClick={() => onSelect(viewId)}
            >
                {isSmallScreen ? (
                    <>
                        <span className="apex-dash-nav__link-main" title={label}>
                            <Icon className="w-4 h-4" aria-hidden />
                        </span>
                        <span className="apex-dash-nav__tooltip">{label}</span>
                    </>
                ) : (
                    <span className="apex-dash-nav__link-main">
                        <Icon className="w-4 h-4" aria-hidden />
                        <span>{label}</span>
                    </span>
                )}
            </button>
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
            className={`apex-dash-sidebar ${isSmallScreen ? "is-collapsed" : "is-expanded"}`}
        >
            <Link href="/home" className="apex-dash-sidebar__brand">
                <span className="apex-dash-sidebar__brand-mark">
                    <Image
                        src="/images/icons/apex-icon-svg.svg"
                        alt="Apex Icon"
                        width={20}
                        height={20}
                        id="logoApex"
                    />
                    {!isSmallScreen ? (
                        <span className="apex-dash-sidebar__brand-name">Apex</span>
                    ) : null}
                </span>
            </Link>

            <div className="apex-dash-sidebar__scroll no-scrollbar">
                {!isSmallScreen ? (
                    <p className="apex-dash-sidebar__menu-label">Group menu</p>
                ) : null}

                <nav>
                    <ul className="apex-dash-nav">
                        <li>
                            <button
                                type="button"
                                className={`apex-dash-nav__section-btn${isSmallScreen ? " hidden" : ""}`}
                                onClick={() => setDashboardOpen(!dashboardOpen)}
                            >
                                <span className="apex-dash-nav__section-label">
                                    <FiBarChart className="apex-dash-nav__section-icon" aria-hidden />
                                    Dashboard
                                </span>
                                {dashboardOpen ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />}
                            </button>

                            {dashboardOpen ? (
                                <ul className="apex-dash-nav__sub">
                                    {VIEW_ITEMS.map((item) => (
                                        <ViewNavItem
                                            key={item.id}
                                            viewId={item.id}
                                            label={item.label}
                                            Icon={item.icon}
                                            activeView={activeView}
                                            onSelect={setActiveView}
                                            isSmallScreen={isSmallScreen}
                                        />
                                    ))}
                                </ul>
                            ) : null}
                        </li>
                    </ul>
                </nav>
            </div>
        </aside>
    );
}
