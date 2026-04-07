import React, { useState, useMemo } from "react";
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
    FiLayers,
    FiAlertTriangle,
    FiGlobe,
} from "react-icons/fi";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import SmallLabel from "../ui/SmallLabel";
import { useUser } from "@/contexts/UserContext";
import { useCustomers } from "@/hooks/useCustomers";

/** Treats empty, "0", and "1" as missing/placeholder (per Customer settings). */
function isValidIntegrationId(value) {
    const s = String(value ?? "").trim();
    if (!s) return false;
    if (s === "0" || s === "1") return false;
    return true;
}

function getServiceDashboardConfigWarnings(settings) {
    const s = settings || {};
    return {
        seo: !isValidIntegrationId(s.googleSearchConsoleProperty),
        ppc: !isValidIntegrationId(s.googleAdsCustomerId),
        ps: !isValidIntegrationId(s.facebookAdAccountId),
        pinterest: !isValidIntegrationId(s.pinterestAdAccountId),
        bing: !(
            isValidIntegrationId(s.bingAdsAccountId) && isValidIntegrationId(s.bingAdsCustomerId)
        ),
        em: !isValidIntegrationId(s.klaviyoPrivateApiKey),
    };
}

function serviceDashboardWarningKeyForHref(href) {
    if (href.includes("service-dashboard/seo")) return "seo";
    if (href.includes("service-dashboard/ppc")) return "ppc";
    if (href.includes("service-dashboard/ps")) return "ps";
    if (href.includes("service-dashboard/pinterest")) return "pinterest";
    if (href.includes("service-dashboard/bing-webmaster")) return null;
    if (href.includes("service-dashboard/bing")) return "bing";
    if (href.includes("service-dashboard/em")) return "em";
    return null;
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
    if (href.includes("service-dashboard/bing")) return <FiLayers className="w-4 h-4" />;
    if (href.includes("campaign-planner")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("config")) return <FiSettings className="w-4 h-4" />;
    if (href.includes("test-page")) return <FiFolder className="w-4 h-4" />;
    return <FiFolder className="w-4 h-4" />;
};

const CONFIG_WARNING_TITLE =
    "Integration not configured for this customer (check Config or set a valid ID — not empty, 0, or 1)";

const NavItem = ({ href, label, activeCustomerId, pathname, subLabel, isSmallScreen, configWarning }) => {
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
                            <span className="flex items-center gap-0.5" title={configWarning ? CONFIG_WARNING_TITLE : undefined}>
                                {icon}
                                {configWarning ? (
                                    <FiAlertTriangle className="w-3 h-3 text-amber-400 shrink-0" aria-hidden />
                                ) : null}
                            </span>
                            {/* Small screen tooltip */}
                            <div className="absolute left-[70px] bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                {label}
                                {configWarning ? " — not configured" : ""}
                            </div>
                        </>
                    ) : (
                        <span className="flex items-center justify-between gap-1.5 flex-wrap w-full">
                            <span>{label}</span>
                            <span className="flex items-center gap-2">
                            {configWarning ? (
                                <FiAlertTriangle
                                    className="w-3.5 h-3.5 text-amber-500 shrink-0"
                                    aria-label="Integration not configured"
                                    title={CONFIG_WARNING_TITLE}
                                />
                            ) : null}
                            {subLabel && <SmallLabel>{subLabel}</SmallLabel>}
                            </span>
                        </span>
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
    const showBingWebmasterNav = user?.email?.toLowerCase() === "dbr@searchmind.dk";
    const { customers } = useCustomers();
    const pathname = usePathname();
    const activeCustomerId = params?.customerId;

    const serviceDashboardWarnings = useMemo(() => {
        if (!activeCustomerId) return null;
        const cur = customers.find((c) => String(c._id) === String(activeCustomerId));
        return getServiceDashboardConfigWarnings(cur?.CustomerSettings);
    }, [customers, activeCustomerId]);

    const configWarningForHref = (href) => {
        const key = serviceDashboardWarningKeyForHref(href);
        if (!key || !serviceDashboardWarnings) return false;
        return !!serviceDashboardWarnings[key];
    };

    const serviceDashboardHref = (segment) =>
        `/dashboard/${activeCustomerId}/service-dashboard/${segment}`;

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
                                                href={serviceDashboardHref("seo")}
                                                label="SEO"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("seo"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("ppc")}
                                                label="PPC"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("ppc"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("ps")}
                                                label="PS"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("ps"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("pinterest")}
                                                label="Pinterest"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("pinterest"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("bing")}
                                                label="Bing Ads"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("bing"))}
                                            />
                                            {showBingWebmasterNav ? (
                                                <NavItem
                                                    href={serviceDashboardHref("bing-webmaster")}
                                                    label="Bing Webmaster"
                                                    activeCustomerId={activeCustomerId}
                                                    pathname={pathname}
                                                    isSmallScreen={isSmallScreen}
                                                    subLabel={"BETA"}
                                                    configWarning={false}
                                                />
                                            ) : null}
                                            <NavItem
                                                href={serviceDashboardHref("em")}
                                                label="EM"
                                                activeCustomerId={activeCustomerId}
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("em"))}
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