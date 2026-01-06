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
} from "react-icons/fi";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import SmallLabel from "../ui/SmallLabel";

// Map of route patterns to their respective icons
const getIconForRoute = (href) => {
    if (href.includes("performance-dashboard")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("daily-overview")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("pace-report")) return <FiActivity className="w-4 h-4" />;
    if (href.includes("pnl")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("ecommerce")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("analytics")) return <FiBarChart className="w-4 h-4" />;
    if (href.includes("service-dashboard/seo")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("service-dashboard/ppc")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("service-dashboard/ps")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("campaign-planner")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("config")) return <FiSettings className="w-4 h-4" />;
    if (href.includes("test-page")) return <FiFolder className="w-4 h-4" />;
    return <FiFolder className="w-4 h-4" />;
};

const NavItem = ({ href, label, activeCustomerId, pathname, subLabel, isSmallScreen }) => {
    const isActive = pathname === href;
    const icon = getIconForRoute(href);
    
    return (
        <li
            className={`py-2 rounded-lg w-full group relative ` +
                (isSmallScreen ? 'px-2' : 'px-6') +
                (isActive ? " bg-[var(--color-primary-searchmind-lighter-opacity)]" : "")
            }
        >
            <Link href={href} className="w-full">
                <span className={`flex items-center justify-between text-[0.8rem] font-semibold ${isActive ? "text-[var(--color-primary-searchmind)]" : "text-slate-600"}`}>
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
        <aside className={`flex flex-col xl:mt-0 top-0 left-0 bg-white text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${
            isSmallScreen ? 'w-[50px] px-2' : 'w-[300px] px-8'
        }`}>
            <div className={`py-8 flex justify-start ${isSmallScreen ? 'mb-2' : 'mb-5'}`}>
                <Link href="/" className="flex flex-col gap-0">
                    <Image
                        src="/images/icons/apexlogo-new1.png"
                        alt="Apex Icon"
                        width={isSmallScreen ? 32 : 100}
                        height={isSmallScreen ? 32 : 100}
                        className="mb-0"
                        id="logoApex"
                    />
                    {!isSmallScreen && <p className="text-gray-400 text-xs">by Searchmind</p>}
                </Link>
            </div>

            {showLinks && (
                <>
                    {!isSmallScreen && (
                        <div className="">
                            <p className="text-gray-400 mb-6 uppercase text-xs">Menu</p>
                        </div>
                    )}

                    <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                        <nav className="mb-6">
                            <ul className="space-y-4">
                                {/* Dashboard */}
                                <li>
                                    <button
                                        className={`flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}` }
                                        onClick={() => setDashboardOpen(!dashboardOpen)}
                                        title={isSmallScreen ? "Dashboard" : ""}
                                    >
                                        <span className="flex items-center text-slate-800 font-bold rounded-lg w-full">
                                            <FiBarChart className={isSmallScreen ? "" : "mr-2"} /> 
                                            {!isSmallScreen && "Dashboard"}
                                        </span>
                                        {!isSmallScreen && (dashboardOpen ? <FiChevronUp /> : <FiChevronDown />)}
                                    </button>
                                    {dashboardOpen && (
                                        <ul className={`mt-2 space-y-2 flex flex-col w-full ${isSmallScreen ? 'ml-0' : ''}`}>
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/performance-dashboard`}
                                                label="Performance Dashboard"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/daily-overview`}
                                                label="Daily Overview"
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
                                                subLabel={"WIP"}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/analytics`}
                                                label="Analytics"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                subLabel={"WIP"}
                                                isSmallScreen={isSmallScreen}
                                            />
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
                                        className={`flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}` }
                                        onClick={() => setServiceOpen(!serviceOpen)}
                                        title={isSmallScreen ? "Service Dashboard" : ""}
                                    >
                                        <span className="flex items-center text-slate-800 font-bold rounded-lg">
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
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/ppc`}
                                                label="PPC"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/service-dashboard/ps`}
                                                label="PS"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
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
                                        className={`flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800 group ${isSmallScreen ? "hidden" : ""}` }
                                        onClick={() => setServiceOpen(!serviceOpen)}
                                        title={isSmallScreen ? "Misc" : ""}
                                    >
                                        <span className="flex items-center text-slate-800 font-bold rounded-lg">
                                            <FiSettings className={isSmallScreen ? "" : "mr-2"} />
                                            {!isSmallScreen && "Misc"}
                                        </span>
                                        {!isSmallScreen && (serviceOpen ? <FiChevronUp /> : <FiChevronDown />)}
                                    </button>
                                    {serviceOpen && (
                                        <ul className="mt-2 space-y-2 flex flex-col w-full">
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/tools/campaign-planner`}
                                                label="Campaign Planner"
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
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/test-page`}
                                                label="Test Page"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
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