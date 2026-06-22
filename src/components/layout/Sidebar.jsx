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
    FiGift,
    FiImage,
    FiLayers,
    FiAlertTriangle,
    FiGlobe,
    FiPieChart,
    FiZap,
    FiMessageCircle,
} from "react-icons/fi";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useCustomers } from "@/hooks/useCustomers";
import { getServiceDashboardConfigWarnings } from "@/lib/customerServiceIntegrations";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";
import { isB2BCustomer } from "@/lib/customerBusinessCategory";

function serviceDashboardWarningKeyForHref(href) {
    if (href.includes("service-dashboard/seo")) return "seo";
    if (href.includes("service-dashboard/ppc")) return "ppc";
    if (href.includes("service-dashboard/ps")) return "ps";
    if (href.includes("service-dashboard/pinterest")) return "pinterest";
    if (href.includes("service-dashboard/snapchat")) return "snapchat";
    if (href.includes("service-dashboard/reddit")) return "reddit";
    if (href.includes("service-dashboard/bing-webmaster")) return null;
    if (href.includes("service-dashboard/bing")) return "bing";
    if (href.includes("service-dashboard/em")) return "em";
    return null;
}

// Map of route patterns to their respective icons
const getIconForRoute = (href) => {
    if (href.includes("performance-dashboard")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("daily-overview")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("markets-overview")) return <FiGlobe className="w-4 h-4" />;
    if (href.includes("pace-report")) return <FiActivity className="w-4 h-4" />;
    if (href.includes("pnl")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("ecommerce")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("data-wrapped")) return <FiGift className="w-4 h-4" />;
    if (href.includes("analytics")) return <FiBarChart className="w-4 h-4" />;
    if (href.includes("service-dashboard/seo")) return <FiTrendingUp className="w-4 h-4" />;
    if (href.includes("service-dashboard/ppc")) return <FiDollarSign className="w-4 h-4" />;
    if (href.includes("service-dashboard/ps")) return <FiShoppingCart className="w-4 h-4" />;
    if (href.includes("service-dashboard/pinterest")) return <FiImage className="w-4 h-4" />;
    if (href.includes("service-dashboard/snapchat")) return <FiZap className="w-4 h-4" />;
    if (href.includes("service-dashboard/reddit")) return <FiMessageCircle className="w-4 h-4" />;
    if (href.includes("service-dashboard/bing-webmaster")) return <FiGlobe className="w-4 h-4" />;
    if (href.includes("service-dashboard/bing")) return <FiLayers className="w-4 h-4" />;
    if (href.includes("campaign-planner")) return <FiCalendar className="w-4 h-4" />;
    if (href.includes("share-of-search")) return <FiPieChart className="w-4 h-4" />;
    if (href.includes("config")) return <FiSettings className="w-4 h-4" />;
    if (href.includes("test-page")) return <FiFolder className="w-4 h-4" />;
    return <FiFolder className="w-4 h-4" />;
};

const CONFIG_WARNING_TITLE =
    "Integration not configured for this customer (check Config or set a valid ID — not empty, 0, or 1)";

const NavItem = ({ href, label, pathname, subLabel, isSmallScreen, configWarning }) => {
    const isActive = pathname === href;
    const icon = getIconForRoute(href);

    return (
        <li className={`apex-dash-nav__item${isActive ? " is-active" : ""}${isSmallScreen ? " is-collapsed" : ""}`}>
            <Link href={href} className="apex-dash-nav__link">
                {isSmallScreen ? (
                    <>
                        <span className="apex-dash-nav__link-main" title={configWarning ? CONFIG_WARNING_TITLE : label}>
                            {icon}
                            {configWarning ? (
                                <FiAlertTriangle className="apex-dash-nav__warn" aria-hidden />
                            ) : null}
                        </span>
                        <span className="apex-dash-nav__tooltip">
                            {label}
                            {configWarning ? " — not configured" : ""}
                        </span>
                    </>
                ) : (
                    <>
                        <span className="apex-dash-nav__link-main">
                            {icon}
                            <span>{label}</span>
                        </span>
                        <span className="apex-dash-nav__link-meta">
                            {configWarning ? (
                                <FiAlertTriangle
                                    className="apex-dash-nav__warn"
                                    aria-label="Integration not configured"
                                    title={CONFIG_WARNING_TITLE}
                                />
                            ) : null}
                            {subLabel ? <span className="apex-dash-nav__badge">{subLabel}</span> : null}
                        </span>
                    </>
                )}
            </Link>
        </li>
    );
};

const Sidebar = ({ showLinks = true }) => {
    const [dashboardOpen, setDashboardOpen] = useState(true);
    const [serviceOpen, setServiceOpen] = useState(true);
    const [miscOpen, setMiscOpen] = useState(true);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const params = useParams();
    const user = useUser();
    const { customers } = useCustomers();
    const pathname = usePathname();
    const activeCustomerId = params?.customerId;

    const activeCustomer = useMemo(() => {
        if (!activeCustomerId) return null;
        return customers.find((c) => String(c._id) === String(activeCustomerId)) || null;
    }, [customers, activeCustomerId]);

    const shopifyMarketsMenuEnabled = isShopifyMarketsCustomer(activeCustomer);
    const b2bCustomer = isB2BCustomer(activeCustomer);

    const serviceDashboardWarnings = useMemo(() => {
        if (!activeCustomer) return null;
        return getServiceDashboardConfigWarnings(activeCustomer?.CustomerSettings);
    }, [activeCustomer]);

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
        <aside
            id="mainSidebar"
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

            {showLinks && (
                <>
                    <div className="apex-dash-sidebar__scroll no-scrollbar">
                        <nav>
                            <ul className="apex-dash-nav">
                                <li>
                                    <button
                                        type="button"
                                        className="apex-dash-nav__section-btn"
                                        onClick={() => setDashboardOpen(!dashboardOpen)}
                                    >
                                        <span className="apex-dash-nav__section-label">
                                            <FiBarChart className="apex-dash-nav__section-icon" aria-hidden />
                                            Dashboard
                                        </span>
                                        {dashboardOpen ? <FiChevronUp /> : <FiChevronDown />}
                                    </button>
                                    {dashboardOpen && (
                                        <ul className="apex-dash-nav__sub">
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/performance-dashboard`}
                                                label="Overview"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/daily-overview`}
                                                label="Daily"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            {shopifyMarketsMenuEnabled && !b2bCustomer ? (
                                                <NavItem
                                                    href={`/dashboard/${activeCustomerId}/markets-overview`}
                                                    label="Markets"
                                                    subLabel="NEW"
                                                    pathname={pathname}
                                                    isSmallScreen={isSmallScreen}
                                                />
                                            ) : null}
                                            {!b2bCustomer ? (
                                                <>
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/tools/pace-report`}
                                                label="Pace Report"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/tools/pnl`}
                                                label="P&L"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/ecommerce`}
                                                label="Ecommerce"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                                </>
                                            ) : (
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/analytics`}
                                                label="Analytics"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            )}
                                        </ul>
                                    )}
                                </li>

                                <li>
                                    <button
                                        type="button"
                                        className="apex-dash-nav__section-btn"
                                        onClick={() => setServiceOpen(!serviceOpen)}
                                    >
                                        <span className="apex-dash-nav__section-label">
                                            <FiTool className="apex-dash-nav__section-icon" aria-hidden />
                                            Service Dashboard
                                        </span>
                                        {serviceOpen ? <FiChevronUp /> : <FiChevronDown />}
                                    </button>
                                    {serviceOpen && (
                                        <ul className="apex-dash-nav__sub">
                                            <NavItem
                                                href={serviceDashboardHref("seo")}
                                                label="SEO"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("seo"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("ppc")}
                                                label="PPC"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("ppc"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("ps")}
                                                label="PS"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("ps"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("pinterest")}
                                                label="Pinterest"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("pinterest"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("snapchat")}
                                                label="Snapchat"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("snapchat"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("reddit")}
                                                label="Reddit"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("reddit"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("bing")}
                                                label="Bing Ads"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("bing"))}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("em")}
                                                label="EM"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"BETA"}
                                                configWarning={configWarningForHref(serviceDashboardHref("em"))}
                                            />
                                        </ul>
                                    )}
                                </li>

                                <li>
                                    <button
                                        type="button"
                                        className="apex-dash-nav__section-btn"
                                        onClick={() => setMiscOpen(!miscOpen)}
                                    >
                                        <span className="apex-dash-nav__section-label">
                                            <FiSettings className="apex-dash-nav__section-icon" aria-hidden />
                                            Misc
                                        </span>
                                        {miscOpen ? <FiChevronUp /> : <FiChevronDown />}
                                    </button>
                                    {miscOpen && (
                                        <ul className="apex-dash-nav__sub">
                                            {/* <NavItem
                                                href={`/dashboard/${activeCustomerId}/campaign-planner`}
                                                label="Campaign Planner"
                                                pathname={pathname}
                                                subLabel={"BETA"}
                                                isSmallScreen={isSmallScreen}
                                            /> */}
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/campaign-planner-v2`}
                                                label="Campaign Planner"
                                                pathname={pathname}
                                                subLabel={"WIP"}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/share-of-search`}
                                                label="SoS"
                                                pathname={pathname}
                                                subLabel={"NEW"}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            <NavItem
                                                href={serviceDashboardHref("bing-webmaster")}
                                                label="Bing Webmaster"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                                subLabel={"WIP"}
                                                configWarning={false}
                                            />
                                            <NavItem
                                                href={`/dashboard/${activeCustomerId}/config`}
                                                label="Config"
                                                pathname={pathname}
                                                isSmallScreen={isSmallScreen}
                                            />
                                            {user?.isAdmin && (
                                                <NavItem
                                                    href={`/dashboard/${activeCustomerId}/test-page`}
                                                    label="Test Page"
                                                    pathname={pathname}
                                                    isSmallScreen={isSmallScreen}
                                                />
                                            )}
                                        </ul>
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