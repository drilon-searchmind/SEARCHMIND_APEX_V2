import React, { useState } from "react";
import Link from "next/link";
import {
    FiChevronDown,
    FiChevronUp,
    FiSettings,
    FiBarChart,
    FiFolder,
    FiTool,
    FiTrendingUp,
    FiCalendar,
    FiDollarSign,
    FiShoppingCart,
    FiActivity,
    FiChevronsLeft,
    FiChevronsRight,
    FiGift,
    FiImage,
} from "react-icons/fi";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import SmallLabel from "../ui/SmallLabel";
import { useUser } from "@/contexts/UserContext";

function getLastMonthPeriod() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getOpenedPeriodsForCustomer(openedWrappedPeriods, customerId) {
    if (!openedWrappedPeriods || typeof openedWrappedPeriods !== "object" || Array.isArray(openedWrappedPeriods))
        return [];
    const key = String(customerId || "").trim();
    if (!key) return [];
    const raw = openedWrappedPeriods[key] ?? openedWrappedPeriods[customerId];
    return Array.isArray(raw) ? raw.map((p) => String(p).trim()).filter((p) => /^\d{4}-\d{2}$/.test(p)) : [];
}

// Map of route patterns to their respective icons
const getIconForRoute = (href) => {
    if (href.includes("performance-dashboard")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("daily-overview")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("pace-report")) return <FiActivity className="w-4 h-4" />;
    if (href.includes("pnl")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("ecommerce")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("data-wrapped")) return <FiGift className="w-4 h-4" />;
    if (href.includes("analytics")) return <FiBarChart className="w-4 h-4" />;
    if (href.includes("service-dashboard/seo")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("service-dashboard/ppc")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("service-dashboard/ps")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("service-dashboard/pinterest")) return <FiImage className="w-4 h-4" />;
    if (href.includes("campaign-planner")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("config")) return <FiSettings className="w-4 h-4" />;
    if (href.includes("test-page")) return <FiFolder className="w-4 h-4" />;
    return <FiFolder className="w-4 h-4" />;
};

const DataWrappedNavItem = ({ href, activeCustomerId, pathname, isSmallScreen }) => {
    const user = useUser();
    if (!activeCustomerId) return null;
    const lastMonthPeriod = getLastMonthPeriod();
    const opened = getOpenedPeriodsForCustomer(user?.openedWrappedPeriods, activeCustomerId);
    const hasOpenedLastMonth = opened.includes(lastMonthPeriod);
    const showPulse = !hasOpenedLastMonth;
    const isActive = pathname === href;

    return (
        <li
            className={`py-2 rounded-lg w-full group relative ` +
                (isSmallScreen ? "px-2" : "px-6") +
                (isActive ? " bg-[var(--color-primary-searchmind-lighter)]" : "")
            }
        >
            <Link href={href} className="w-full">
                <span className={`flex items-center justify-between text-[0.85rem] font-medium ${isActive ? "text-white" : "text-slate-600"}`}>
                    {isSmallScreen ? (
                        <>
                            <div className="relative flex items-center justify-center">
                                {showPulse && (
                                    <span
                                        className="absolute inset-0 rounded-full bg-[var(--color-lime)]/90 wrapped-pulse-ring pointer-events-none scale-150"
                                        aria-hidden="true"
                                    />
                                )}
                                <FiGift className={`relative z-10 w-4 h-4 ${showPulse ? "text-[var(--color-primary-searchmind)] data-wrapped-shake-icon" : ""}`} />
                            </div>
                            <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                Data Wrapped
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="flex items-center gap-2 relative">
                                {showPulse && (
                                    <span
                                        className="w-2 h-2 rounded-full bg-[var(--color-lime)] wrapped-pulse-ring flex-shrink-0"
                                        aria-hidden="true"
                                    />
                                )}
                                <span>Data Wrapped</span>
                            </span>
                        </>
                    )}
                </span>
            </Link>
        </li>
    );
};

const NavItem = ({ href, label, activeCustomerId, pathname, subLabel, isSmallScreen }) => {
    const isActive = pathname === href;
    const icon = getIconForRoute(href);

    return (
        <li
            className={`py-2 rounded-lg w-full group relative ` +
                (isSmallScreen ? 'px-2' : 'px-6') +
                (isActive ? " bg-[var(--color-primary-searchmind-lighter)]" : "")
            }
        >
            <Link href={href} className="w-full">
                <span className={`flex items-center justify-between text-[0.85rem] font-medium ${isActive ? "text-white" : "text-slate-600"}`}>
                    {isSmallScreen ? (
                        <>
                            {icon}
                            {/* Small screen tooltip */}
                            <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                {label}
                            </div>
                        </>
                    ) : (
                        <>
                            {label}
                            {subLabel && <SmallLabel>{subLabel}</SmallLabel>}
                        </>
                    )}
                </span>
            </Link>
        </li>
    );
};

const Sidebar = ({ showLinks = true }) => {
    const [dashboardOpen, setDashboardOpen] = useState(true);
    const [serviceOpen, setServiceOpen] = useState(true);
    const [isActiveMenu, setIsActiveMenu] = useState(true);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const params = useParams();
    const user = useUser();
    const pathname = usePathname();
    const activeCustomerId = params?.customerId;

    // Handle responsive sidebar
    React.useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth < 1500);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <aside id="mainSidebar" className={`flex flex-col xl:mt-0 top-0 left-0 bg-[var(--color-primary-searchmind)] text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${isSmallScreen ? 'w-[50px] px-2' : 'w-[300px] px-8'
            }`}>
            <div className={`py-8 flex justify-start ${isSmallScreen ? 'mb-0' : 'mb-0'}`}>
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

            {showLinks && (
                <>
                    {!isSmallScreen && (
                        <div className="">
                            <p className="text-gray-400 mb-4 uppercase text-xs">Menu</p>
                        </div>
                    )}

                    <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                        <nav className="mb-6">
                            <ul className="space-y-4">
                                {/* Dashboard */}
                                <li>
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
                                        <ul className={`mt-2 space-y-2 flex flex-col w-full ${isSmallScreen ? 'ml-0' : ''}`}>
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/performance-dashboard`}
                                                label="Overview"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/daily-overview`}
                                                label="Daily"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/tools/pace-report`}
                                                label="Pace Report"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/tools/pnl`}
                                                label="P&L"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/ecommerce`}
                                                label="Ecommerce"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            {/* <NavItem
                                                href={`/dashboard/${activeCustomerId}/analytics`}
                                                label="Analytics"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            /> */}
                                        </ul>
                                    )}
                                    {isSmallScreen && (
                                        <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                            Dashboard
                                        </div>
                                    )}
                                </li>

                                {/* Service Dashboard */}
                                <li>
                                    <button
                                        className={`mb-3 flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}`}
                                        onClick={() => setServiceOpen(!serviceOpen)}
                                        title={isSmallScreen ? "Service Dashboard" : ""}
                                    >
                                        <span className="flex items-center text-slate-800 font-medium rounded-lg">
                                            <FiTool className={isSmallScreen ? "" : "mr-2"} />
                                            {!isSmallScreen && "Service Dashboard"}
                                        </span>
                                        {!isSmallScreen && (serviceOpen ? <FiChevronUp /> : <FiChevronDown />)}
                                    </button>
                                    {serviceOpen && (
                                        <ul className="mt-2 space-y-2 flex flex-col w-full">
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/seo`}
                                                label="SEO"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/ppc`}
                                                label="PPC"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/ps`}
                                                label="PS"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/pinterest`}
                                                label="Pinterest"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/em`}
                                                label="EM"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                            />
                                        </ul>
                                    )}
                                    {isSmallScreen && (
                                        <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                            Service Dashboard
                                        </div>
                                    )}
                                </li>

                                {/* Misc */}
                                <li>
                                    <button
                                        className={`mb-3 flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}`}
                                        onClick={() => setServiceOpen(!serviceOpen)}
                                        title={isSmallScreen ? "Misc" : ""}
                                    >
                                        <span className="flex items-center text-slate-800 font-medium rounded-lg">
                                            <FiSettings className={isSmallScreen ? "" : "mr-2"} />
                                            {!isSmallScreen && "Misc"}
                                        </span>
                                        {!isSmallScreen && (serviceOpen ? <FiChevronUp /> : <FiChevronDown />)}
                                    </button>
                                    {serviceOpen && (
                                        <ul className="mt-2 space-y-2 flex flex-col w-full">
                                            {/* <NavItem
                                                href={`/dashboard/${activeCustomerId}/campaign-planner`}
                                                label="Campaign Planner"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                subLabel={"BETA"}
                                                isSmallScreen={isSmallScreen}
                                            /> */}
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/campaign-planner-v2`}
                                                label="Campaign Planner (v2)"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                subLabel={"WIP"}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/config`}
                                                label="Config"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            {user?.isAdmin && (
                                                <NavItem
                                                    href={`/dashboard/${activeCustomerId}/test-page`}
                                                    label="Test Page"
                                                    activeCustomerId={activeCustomerId}
                                                    pathname={pathname}
                                                    isSmallScreen={isSmallScreen}
                                                />
                                            )}
                                        </ul>
                                    )}
                                    {isSmallScreen && (
                                        <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                            Misc
                                        </div>
                                    )}
                                </li>
                            </ul>
                        </nav>
                    </div>
                </>
            )}
        </aside>
    );
};

export default Sidebar;