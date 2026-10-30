import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { FiBell } from "react-icons/fi";
import { FiChevronDown, FiHome, FiUser, FiSettings, FiBarChart2, FiLogOut, FiBookOpen, FiShare2, FiGift, FiFileText } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useParams, usePathname, useRouter } from "next/navigation";
import { parseApexRadarPath, APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CS_HREF, APEX_RADAR_PERFORMANCE_BRIEF_HREF, apexRadarCsHref, apexRadarPerformanceBriefHref, apexRadarOverviewHref } from "@/lib/apexRadarChannels";

/** Sentinel value for Apex Radar "All properties" in the customer Select. */
const APEX_RADAR_CUSTOMER_SELECT_ALL = "__apex_radar_all__";
import PropertySearchCmdk from './PropertySearchCmdk';
import TeamMembers, { ClickupTeamMembersProvider } from './TeamMembers';
import SharePropertyModal from '@/components/dashboard/SharePropertyModal';
import ParentPropertyFilterDropdown from './ParentPropertyFilterDropdown';
import ParentPropertyGroupSettingsTrigger from './ParentPropertyGroupSettingsTrigger';
import Link from "next/link";
import { LuRadar } from "react-icons/lu";
import { RiToolsFill } from "react-icons/ri";
import { getDemoCustomerIds } from "@/lib/demoCustomerId";
import { CategoryBadge, NotificationLink } from "@/components/notifications/NotificationParts";
import { NOTIFICATIONS_READ_EVENT, formatRelativeTime } from "@/components/notifications/notificationUtils";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { NAV_VISIBILITY } from "@/lib/navVisibility";
import { addRecentCustomerId } from "@/lib/recentCustomers";

/** Set true to restore the topbar dark/light mode switcher. */
const THEME_TOGGLE_ENABLED = false;

function getLastMonthPeriod() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getInitialTheme() {
    if (!THEME_TOGGLE_ENABLED) return "light";
    if (typeof window !== "undefined") {
        return localStorage.getItem("theme") || "light";
    }
    return "light";
}

function applyDocumentTheme(nextTheme) {
    if (typeof window === "undefined") return;
    const resolvedTheme = THEME_TOGGLE_ENABLED ? nextTheme : "light";
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    if (!THEME_TOGGLE_ENABLED) {
        localStorage.setItem("theme", "light");
    }
}

function getOpenedPeriodsForCustomer(openedWrappedPeriods, customerId) {
    if (!openedWrappedPeriods || typeof openedWrappedPeriods !== "object" || Array.isArray(openedWrappedPeriods))
        return [];
    const key = String(customerId || "").trim();
    if (!key) return [];
    const raw = openedWrappedPeriods[key] ?? openedWrappedPeriods[customerId];
    return Array.isArray(raw) ? raw.map((p) => String(p).trim()).filter((p) => /^\d{4}-\d{2}$/.test(p)) : [];
}

function parseUnreadCount(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), 99999);
}

function getParentCustomerId(customer) {
    const raw = customer?.parentCustomer;
    if (raw == null || raw === "") return null;
    if (typeof raw === "object") {
        const id = raw._id ?? raw.$oid;
        return id != null && String(id).trim() ? String(id).trim() : null;
    }
    const id = String(raw).trim();
    return id || null;
}

/** Market Overview is hidden for now. Flip to true to bring the link back (desktop and mobile). */
const SHOW_MARKET_OVERVIEW_LINK = false;

const Topbar = ({ showLinks = true, showLogo = false, showPropertySection = true, isParentProperty = false }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [bellMenuOpen, setBellMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const user = useUser();
    const [notifPreview, setNotifPreview] = useState([]);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);
    const [notifLoading, setNotifLoading] = useState(false);
    /** Ids that were unread when the bell opened, so they stay highlighted while the badge clears. */
    const [notifNewIds, setNotifNewIds] = useState([]);
    const bellButtonRef = useRef(null);
    const [theme, setTheme] = useState(getInitialTheme);
    const { customers } = useCustomers();
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const activeCustomerId = params?.customerId;
    const [activeCustomer, setActiveCustomer] = useState([]);

    useEffect(() => {
        const currentActiveCustomer = customers.find(c => c._id === activeCustomerId);

        setActiveCustomer(currentActiveCustomer || null)
    }, [activeCustomerId, customers])

    // Dynamic access control: if user is external, only show shared customers; else show all
    let accessibleCustomers = customers;
    if (user?.isExternal) {
        const sharedCustomerIds = (user.sharedCustomers || []).map(
            id => typeof id === 'object' && id.$oid ? id.$oid : String(id)
        );
        accessibleCustomers = customers.filter(c => sharedCustomerIds.includes(String(c._id)));
        const demoIds = getDemoCustomerIds();
        for (const demoId of demoIds) {
            const demoRow = customers.find((c) => String(c._id) === demoId);
            if (demoRow && !accessibleCustomers.some((c) => String(c._id) === demoId)) {
                accessibleCustomers = [...accessibleCustomers, demoRow];
            }
        }
    }
    // Share property modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState("");
    React.useEffect(() => {
        if (!user?.isExternal && showShareModal) {
            fetch('/api/users?externalOnly=true')
                .then(res => res.ok ? res.json() : [])
                .then(data => setAllUsers(data))
                .catch(() => setAllUsers([]));
        }
    }, [showShareModal, user]);

    // Share handler (supports add and remove)
    const handleShareProperty = async (toAdd = [], toRemove = []) => {
        setShareLoading(true);
        setShareError("");
        const customerId = activeCustomerId;
        try {
            // Add access
            await Promise.all((toAdd || []).map(async (userId) => {
                await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, customerId, action: 'add' })
                });
            }));
            // Remove access
            await Promise.all((toRemove || []).map(async (userId) => {
                await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, customerId, action: 'remove' })
                });
            }));
            setShowShareModal(false);
        } catch (err) {
            setShareError('Failed to update sharing.');
        } finally {
            setShareLoading(false);
        }
    };

    // accessibleCustomers used by property search

    const apexRadarPath = parseApexRadarPath(pathname);

    const customerSearchExtraItems = useMemo(() => {
        if (!apexRadarPath.isApexRadar) return [];
        if (apexRadarPath.isCs) {
            return [{ id: APEX_RADAR_CUSTOMER_SELECT_ALL, name: "Select customer", href: APEX_RADAR_CS_HREF }];
        }
        if (apexRadarPath.isPerformanceBrief) {
            return [
                {
                    id: APEX_RADAR_CUSTOMER_SELECT_ALL,
                    name: "Select customer",
                    href: APEX_RADAR_PERFORMANCE_BRIEF_HREF,
                },
            ];
        }
        const ch = apexRadarPath.channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
        return [{ id: APEX_RADAR_CUSTOMER_SELECT_ALL, name: "All", href: apexRadarOverviewHref(ch) }];
    }, [
        apexRadarPath.isApexRadar,
        apexRadarPath.isCs,
        apexRadarPath.isPerformanceBrief,
        apexRadarPath.channel,
    ]);

    const activeCustomerName = useMemo(() => {
        if ((apexRadarPath.isCs || apexRadarPath.isPerformanceBrief) && !apexRadarPath.customerId) {
            return "Select customer";
        }
        if (apexRadarPath.isApexRadar && !apexRadarPath.customerId) return "All";
        return activeCustomer?.customerName ?? null;
    }, [
        apexRadarPath.isApexRadar,
        apexRadarPath.isCs,
        apexRadarPath.isPerformanceBrief,
        apexRadarPath.customerId,
        activeCustomer?.customerName,
    ]);

    const parentCustomerId = useMemo(
        () => getParentCustomerId(activeCustomer),
        [activeCustomer]
    );

    const buildPropertyHref = useCallback(
        (customerId) => {
            if (apexRadarPath.isCs) {
                return apexRadarCsHref(customerId);
            }
            if (apexRadarPath.isPerformanceBrief) {
                return apexRadarPerformanceBriefHref(customerId);
            }
            if (apexRadarPath.isApexRadar) {
                const ch = apexRadarPath.channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
                return `/apex-radar/${ch}/${customerId}`;
            }
            return `/dashboard/${customerId}/performance-dashboard`;
        },
        [
            apexRadarPath.isApexRadar,
            apexRadarPath.isCs,
            apexRadarPath.isPerformanceBrief,
            apexRadarPath.channel,
        ]
    );

    // Check if activeCustomerId is accessible, if not redirect to first accessible customer
    const isActiveCustomerAccessible = accessibleCustomers.some((c) => c._id === activeCustomerId);
    React.useEffect(() => {
        if (!activeCustomerId || isActiveCustomerAccessible || accessibleCustomers.length === 0) return;
        const first = accessibleCustomers[0]._id;
        const { isApexRadar, channel, isCs, isPerformanceBrief } = parseApexRadarPath(pathname);
        if (isApexRadar) {
            if (isCs) {
                router.push(apexRadarCsHref(first));
                return;
            }
            if (isPerformanceBrief) {
                router.push(apexRadarPerformanceBriefHref(first));
                return;
            }
            const ch = channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
            router.push(`/apex-radar/${ch}/${first}`);
            return;
        }
        router.push(`/dashboard/${first}/performance-dashboard`);
    }, [activeCustomerId, isActiveCustomerAccessible, accessibleCustomers, router, pathname]);

    React.useEffect(() => {
        if (!activeCustomerId || activeCustomerId === APEX_RADAR_CUSTOMER_SELECT_ALL) return;
        if (!isActiveCustomerAccessible) return;
        addRecentCustomerId(activeCustomerId);
    }, [activeCustomerId, isActiveCustomerAccessible]);

    const handleToggleTheme = () => {
        if (!THEME_TOGGLE_ENABLED) return;
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        if (typeof window !== "undefined") {
            localStorage.setItem("theme", newTheme);
            applyDocumentTheme(newTheme);
        }
    };

    // On mount, sync theme from localStorage and set <html> class
    React.useEffect(() => {
        if (!THEME_TOGGLE_ENABLED) {
            setTheme("light");
            applyDocumentTheme("light");
            return;
        }
        const savedTheme = localStorage.getItem("theme") || "light";
        setTheme(savedTheme);
        applyDocumentTheme(savedTheme);
    }, []);

    // Update <html> class when theme changes
    React.useEffect(() => {
        applyDocumentTheme(theme);
    }, [theme]);

    // Close menu on outside click
    useEffect(() => {
        function handleDocumentClick(e) {
            if (!menuOpen) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [menuOpen]);

    useEffect(() => {
        function handleDocumentClick(e) {
            if (!bellMenuOpen) return;
            if (e.target.closest?.("[data-notifications-bell-root]")) return;
            setBellMenuOpen(false);
        }
        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [bellMenuOpen]);

    useEffect(() => {
        if (!user?.email) return undefined;
        fetch("/api/notifications?limit=8")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d) {
                    setNotifPreview(Array.isArray(d.notifications) ? d.notifications : []);
                    setNotifUnreadCount(parseUnreadCount(d.unreadCount));
                }
            })
            .catch(() => { });

        // Keep the badge fresh without polling hard: when the tab becomes visible again, and every two minutes
        const refreshBadge = () => {
            if (document.visibilityState !== "visible") return;
            fetch("/api/notifications?limit=1")
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                    if (d) setNotifUnreadCount(parseUnreadCount(d.unreadCount));
                })
                .catch(() => { });
        };
        const interval = setInterval(refreshBadge, 120000);
        document.addEventListener("visibilitychange", refreshBadge);
        // The notifications page can mark everything read itself
        const onRead = () => setNotifUnreadCount(0);
        window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", refreshBadge);
            window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
        };
    }, [user?.email]);

    useEffect(() => {
        if (!bellMenuOpen) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setBellMenuOpen(false);
                bellButtonRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [bellMenuOpen]);

    const toggleBellMenu = async () => {
        if (bellMenuOpen) {
            setBellMenuOpen(false);
            return;
        }
        // Open straight away with what is already loaded, then refresh once in the background
        setBellMenuOpen(true);
        if (!user) return;
        setNotifLoading(true);
        try {
            const r = await fetch("/api/notifications?limit=8");
            const d = await r.json();
            if (r.ok) {
                const list = Array.isArray(d.notifications) ? d.notifications : [];
                const unread = parseUnreadCount(d.unreadCount);
                setNotifPreview(list);
                setNotifNewIds(list.filter((n) => !n.readAt).map((n) => n.id));
                if (unread > 0) {
                    // Read state is saved after the list is shown, so the new items stay highlighted
                    fetch("/api/notifications/mark-read", { method: "POST" })
                        .then(() => {
                            setNotifUnreadCount(0);
                            window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
                        })
                        .catch(() => { });
                }
            }
        } catch (_) {
            /* keep what is already shown */
        } finally {
            setNotifLoading(false);
        }
    };

    // Close mobile menu on outside click
    useEffect(() => {
        function handleDocumentClick(e) {
            if (!mobileMenuOpen) return;
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
                // setMobileMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [mobileMenuOpen]);

    const teamMembersDataEnabled = Boolean(showLinks && activeCustomerId);

    const renderNotificationsBell = () => (
        <div className="relative shrink-0" data-notifications-bell-root>
            <button
                type="button"
                onClick={toggleBellMenu}
                aria-expanded={bellMenuOpen}
                aria-haspopup="dialog"
                ref={bellButtonRef}
                aria-label={
                    notifUnreadCount > 0
                        ? `Notifications, ${notifUnreadCount} unread`
                        : "Notifications"
                }
                className="apex-dash-topbar__icon-btn relative"
            >
                <FiBell className="size-[1.15rem]" aria-hidden />
                {notifUnreadCount > 0 && (
                    <span className="apex-dash-topbar__badge" aria-hidden>
                        {notifUnreadCount > 99 ? "99+" : notifUnreadCount}
                    </span>
                )}
            </button>

            {bellMenuOpen && (
                <div className="apex-notif" role="dialog" aria-label="Notifications">
                    <header className="apex-notif__head">
                        <div>
                            <h2 className="apex-notif__title">Notifications</h2>
                            <p className={`apex-notif__sub${notifNewIds.length > 0 ? " is-new" : ""}`}>
                                {notifLoading && notifPreview.length === 0
                                    ? "Loading"
                                    : notifNewIds.length > 0
                                      ? `${notifNewIds.length} new`
                                      : notifPreview.length > 0
                                        ? "You are up to date"
                                        : "Nothing yet"}
                            </p>
                        </div>
                        <Link href="/notifications" className="apex-notif__all" onClick={() => setBellMenuOpen(false)}>
                            View all
                        </Link>
                    </header>
                    <div className="apex-notif__body">
                        {notifLoading && notifPreview.length === 0 ? (
                            <div aria-hidden>
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="apex-notif__skeleton">
                                        <i />
                                        <div>
                                            <i />
                                            <i />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : notifPreview.length === 0 ? (
                            <div className="apex-notif__empty">
                                <CategoryBadge category="system" />
                                <p>You are all caught up</p>
                                <small>New updates from Searchmind show up here.</small>
                            </div>
                        ) : (
                            <ul className="apex-notif__list">
                                {notifPreview.map((n) => {
                                    const isNew = notifNewIds.includes(n.id);
                                    return (
                                        <li key={n.id}>
                                            <NotificationLink n={n} className={`apex-notif__item${isNew ? " is-new" : ""}`} onNavigate={() => setBellMenuOpen(false)}>
                                                <CategoryBadge category={n.category} size="sm" />
                                                <div className="apex-notif__text">
                                                    <p className="apex-notif__item-title">{n.title}</p>
                                                    <p className="apex-notif__item-body">{n.body}</p>
                                                    <span className="apex-notif__time">{formatRelativeTime(n.createdAt)}</span>
                                                </div>
                                                {isNew ? <span className="apex-notif__dot" aria-label="New" /> : null}
                                            </NotificationLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            <ClickupTeamMembersProvider
                customerId={activeCustomerId}
                enabled={teamMembersDataEnabled}
            >
                <div className="apex-dash-topbar">
                    {/* Left Section */}
                    <div className="apex-dash-topbar__left">
                        {/* Logo - Hidden on mobile */}
                        {showLogo && (
                            <div className="relative hidden">
                                <Link href="/dashboard">
                                    <Image
                                        src="/images/icons/apex-icon-svg.svg"
                                        alt="SearchMind Apex Logo"
                                        width={40}
                                        height={40}
                                        className="object-contain"
                                    />
                                </Link>
                            </div>
                        )}

                        <div className="relative hidden xl:flex items-center shrink-0">
                            <Link href="/home" className="apex-dash-topbar__home">
                                <FiHome className="h-4 w-4 shrink-0" aria-hidden />
                                <span>Home</span>
                            </Link>
                        </div>

                        <PropertySearchCmdk
                            customers={accessibleCustomers}
                            activeCustomerId={
                                apexRadarPath.isApexRadar && !apexRadarPath.customerId
                                    ? APEX_RADAR_CUSTOMER_SELECT_ALL
                                    : activeCustomerId
                            }
                            activeCustomerName={activeCustomerName}
                            buildHref={buildPropertyHref}
                            extraItems={customerSearchExtraItems}
                        />

                        {showLinks && (
                            <div id="teamMembers" className="hidden xl:flex items-center gap-6">
                                <TeamMembers />
                            </div>
                        )}
                    </div>

                    <div className="apex-dash-topbar__right apex-dash-topbar__right--desktop">
                        {showPropertySection && (
                            <>
                                <div className="apex-dash-topbar__actions">
                                    {SHOW_MARKET_OVERVIEW_LINK && (parentCustomerId ? (
                                        <Link
                                            href={`/parent-property/${parentCustomerId}/home`}
                                            className="apex-dash-topbar__btn"
                                        >
                                            Market Overview
                                        </Link>
                                    ) : (
                                        <span
                                            className="apex-dash-topbar__market-overview-wrap"
                                            tabIndex={0}
                                        >
                                            <span
                                                className="apex-dash-topbar__btn is-disabled"
                                                aria-disabled="true"
                                            >
                                                Market Overview
                                            </span>
                                            <span
                                                className="apex-dash-topbar__market-popover"
                                                role="tooltip"
                                            >
                                                No other markets added
                                            </span>
                                        </span>
                                    ))}

                                    {!user?.isExternal && (
                                        <button
                                            type="button"
                                            onClick={() => setShowShareModal(true)}
                                            className="apex-dash-topbar__btn"
                                        >
                                            <FiShare2 aria-hidden /> Share
                                        </button>
                                    )}

                                    {activeCustomerId && (() => {
                                        const lastMonthPeriod = getLastMonthPeriod();
                                        const raw = user?.openedWrappedPeriods?.[activeCustomerId];
                                        const opened = Array.isArray(raw)
                                            ? raw.map((p) => String(p).trim()).filter((p) => /^\d{4}-\d{2}$/.test(p))
                                            : [];
                                        const hasOpenedLastMonth = opened.includes(lastMonthPeriod);
                                        const hasUnreadWrapped = !hasOpenedLastMonth;
                                        return (
                                            <div className="relative flex items-center justify-center">
                                                <Link
                                                    href={`/dashboard/${activeCustomerId}/data-wrapped`}
                                                    className={`apex-dash-topbar__icon-btn${hasUnreadWrapped ? " apex-dash-topbar__icon-btn--highlight" : ""}`}
                                                    title="Data Wrapped"
                                                >
                                                    <FiGift aria-hidden />
                                                    {hasUnreadWrapped && (
                                                        <span className="apex-dash-topbar__badge" aria-hidden>1</span>
                                                    )}
                                                </Link>
                                            </div>
                                        );
                                    })()}

                                </div>
                            </>
                        )}

                        {isParentProperty && (
                            <div className="flex items-center gap-2">
                                <ParentPropertyFilterDropdown />
                                <ParentPropertyGroupSettingsTrigger />
                            </div>
                        )}
                        {THEME_TOGGLE_ENABLED && (
                            <button
                                type="button"
                                onClick={handleToggleTheme}
                                className="apex-dash-topbar__icon-btn"
                                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {theme === "dark" ? (
                                    <FaSun className="size-[1.15rem]" aria-hidden />
                                ) : (
                                    <FaMoon className="size-[1.15rem]" aria-hidden />
                                )}
                            </button>
                        )}

                        {renderNotificationsBell()}

                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                className="apex-dash-topbar__user"
                                onClick={() => setMenuOpen(!menuOpen)}
                                aria-expanded={menuOpen}
                                aria-haspopup="true"
                            >
                                <span className="apex-dash__icon-box apex-dash__icon-box--user">
                                    <Image
                                        src={user?.image || "/images/users/default-avatar-photo-placeholder-profile-icon-vector.jpg"}
                                        alt=""
                                        width={32}
                                        height={32}
                                        aria-hidden
                                    />
                                </span>
                                <span className="apex-dash-topbar__user-name">{user?.name || "User"}</span>
                                <FiChevronDown className="apex-dash-topbar__user-chevron" aria-hidden />
                            </button>
                            {menuOpen && (
                                <div className="apex-dash-topbar__menu">
                                    <div className="apex-dash-topbar__menu-head">
                                        <div className="apex-dash-topbar__menu-user">
                                            <span className="apex-dash__icon-box apex-dash__icon-box--user">
                                                <Image
                                                    src={user?.image || "/images/users/default-avatar-photo-placeholder-profile-icon-vector.jpg"}
                                                    alt=""
                                                    width={40}
                                                    height={40}
                                                    aria-hidden
                                                />
                                            </span>
                                            <div className="apex-dash-topbar__menu-user-meta">
                                                <div className="apex-dash-topbar__menu-user-row relative">
                                                    <p className="apex-dash-topbar__menu-user-name">{user?.name}</p>
                                                    {user?.isAdmin && (
                                                        <span className="apex-dash-nav__badge absolute top-0 right-0">Admin</span>
                                                    )}
                                                    {user?.isExternal && (
                                                        <span className="apex-dash-nav__badge absolute top-0 right-0">External</span>
                                                    )}
                                                </div>
                                                <p className="apex-dash-topbar__menu-user-email">{user?.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <ul className="apex-dash-topbar__menu-list">
                                        <li>
                                            <Link href="/profile" onClick={() => setMenuOpen(false)}>
                                                <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiUser aria-hidden /></span>
                                                My Account
                                            </Link>
                                        </li>
                                        <li className="hidden">
                                            <Link href="/my-campaigns"><FiBarChart2 aria-hidden /> My Campaigns</Link>
                                        </li>
                                        {NAV_VISIBILITY.guides && (
                                            <li>
                                                <Link href="/lib/guides" onClick={() => setMenuOpen(false)}>
                                                    <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiBookOpen aria-hidden /></span>
                                                    Guides
                                                </Link>
                                            </li>
                                        )}
                                        {NAV_VISIBILITY.news && (
                                            <li>
                                                <Link href="/news" onClick={() => setMenuOpen(false)}>
                                                    <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiFileText aria-hidden /></span>
                                                    News
                                                </Link>
                                            </li>
                                        )}
                                        <li>
                                            <Link href="/notifications" onClick={() => setMenuOpen(false)}>
                                                <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiBell aria-hidden /></span>
                                                Notifications
                                            </Link>
                                        </li>
                                        {!user?.isExternal && (
                                            <li>
                                                <Link href="/our-tools" onClick={() => setMenuOpen(false)}>
                                                    <span className="apex-dash__icon-box apex-dash__icon-box--menu"><RiToolsFill aria-hidden /></span>
                                                    Our Tools
                                                </Link>
                                            </li>
                                        )}
                                        {user?.isAdmin && (
                                            <li>
                                                <Link href="/admin" onClick={() => setMenuOpen(false)}>
                                                    <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiSettings aria-hidden /></span>
                                                    Admin
                                                </Link>
                                            </li>
                                        )}
                                        {NAV_VISIBILITY.apexRadar && canAccessApexRadar(user) && (
                                            <li>
                                                <Link href="/apex-radar" onClick={() => setMenuOpen(false)} className="apex-dash-topbar__menu-radar-link">
                                                    <span className="apex-dash__icon-box apex-dash__icon-box--menu"><LuRadar aria-hidden /></span>
                                                    <span className="flex-1">Apex Radar</span>
                                                    <span className="apex-dash-nav__badge">BETA</span>
                                                </Link>
                                            </li>
                                        )}
                                        <li><hr className="apex-dash-topbar__menu-divider" /></li>
                                        <li>
                                            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="apex-dash-topbar__menu-signout">
                                                <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiLogOut aria-hidden /></span>
                                                Sign Out
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="apex-dash-topbar__right apex-dash-topbar__right--mobile">
                        {THEME_TOGGLE_ENABLED && (
                            <button
                                type="button"
                                onClick={handleToggleTheme}
                                className="apex-dash-topbar__icon-btn"
                                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {theme === "dark" ? (
                                    <FaSun className="size-[1.15rem]" aria-hidden />
                                ) : (
                                    <FaMoon className="size-[1.15rem]" aria-hidden />
                                )}
                            </button>
                        )}
                        {renderNotificationsBell()}
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="apex-dash-topbar__icon-btn"
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu - Slides down on mobile */}
                {mobileMenuOpen && (
                    <div ref={mobileMenuRef} className="apex-dash-topbar__mobile-menu">
                        <Link
                            href="/home"
                            className="apex-dash-topbar__mobile-link"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <FiHome aria-hidden />
                            <span>Home</span>
                        </Link>

                        {showLinks && (
                            <div id="teamMembers-mobile" className="apex-dash-topbar__mobile-section">
                                <TeamMembers />
                            </div>
                        )}

                        {showPropertySection && (
                            <div className="apex-dash-topbar__mobile-section">
                                <p className="apex-dash-topbar__mobile-label">Property</p>
                                {SHOW_MARKET_OVERVIEW_LINK && (parentCustomerId ? (
                                    <Link
                                        href={`/parent-property/${parentCustomerId}/home`}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="apex-dash-topbar__mobile-link"
                                    >
                                        <FiHome aria-hidden />
                                        <span>Market Overview</span>
                                    </Link>
                                ) : (
                                    <div className="apex-dash-topbar__mobile-market-wrap">
                                        <span
                                            className="apex-dash-topbar__mobile-link is-disabled"
                                            aria-disabled="true"
                                        >
                                            <FiHome aria-hidden />
                                            <span>Market Overview</span>
                                        </span>
                                        <p className="apex-dash-topbar__mobile-market-hint">
                                            No other markets added
                                        </p>
                                    </div>
                                ))}
                                        {activeCustomerId && (() => {
                                            const lastMonthPeriod = getLastMonthPeriod();
                                            const opened = getOpenedPeriodsForCustomer(user?.openedWrappedPeriods, activeCustomerId);
                                            const hasOpenedLastMonth = opened.includes(lastMonthPeriod);
                                            const hasUnreadWrapped = !hasOpenedLastMonth;
                                            return (
                                        <Link
                                            href={`/dashboard/${activeCustomerId}/data-wrapped`}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="apex-dash-topbar__mobile-link"
                                        >
                                            <div className="relative flex items-center justify-center">
                                                <FiGift aria-hidden />
                                                {hasUnreadWrapped && (
                                                    <span className="apex-dash-topbar__badge" aria-hidden>1</span>
                                                )}
                                            </div>
                                            <span>Data Wrapped</span>
                                        </Link>
                                            );
                                        })()}
                                        {!user?.isExternal && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowShareModal(true);
                                            setMobileMenuOpen(false);
                                        }}
                                        className="apex-dash-topbar__mobile-btn"
                                    >
                                        <FiShare2 aria-hidden />
                                        <span>Share property</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="apex-dash-topbar__mobile-section">
                            <p className="apex-dash-topbar__mobile-label">Account</p>
                            <div className="apex-dash-topbar__mobile-user">
                                <span className="apex-dash__icon-box apex-dash__icon-box--user">
                                    <Image
                                        src={user?.image || "/images/users/default-avatar-photo-placeholder-profile-icon-vector.jpg"}
                                        alt=""
                                        width={32}
                                        height={32}
                                        aria-hidden
                                    />
                                </span>
                                <div>
                                    <p className="apex-dash-topbar__mobile-user-name">{user?.name || "User"}</p>
                                    <p className="apex-dash-topbar__mobile-user-email">{user?.email}</p>
                                </div>
                            </div>
                            {user?.isAdmin && (
                                <span className="apex-dash-nav__badge apex-dash-topbar__mobile-badge">Admin</span>
                            )}
                            {user?.isExternal && (
                                <span className="apex-dash-nav__badge apex-dash-topbar__mobile-badge">External</span>
                            )}

                            <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                <FiUser aria-hidden /> <span>User Profile</span>
                            </Link>
                            {NAV_VISIBILITY.guides && (
                                <Link href="/lib/guides" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                    <FiBookOpen aria-hidden /> <span>Guides</span>
                                </Link>
                            )}
                            {NAV_VISIBILITY.news && (
                                <Link href="/news" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                    <FiFileText aria-hidden /> <span>News</span>
                                </Link>
                            )}
                            <Link href="/notifications" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                <FiBell aria-hidden /> <span>Notifications</span>
                            </Link>
                            {!user?.isExternal && (
                                <Link href="/our-tools" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                    <RiToolsFill aria-hidden /> <span>Our Tools</span>
                                </Link>
                            )}
                            {user?.isAdmin && (
                                <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                    <FiSettings aria-hidden /> <span>Admin</span>
                                </Link>
                            )}
                            {NAV_VISIBILITY.apexRadar && canAccessApexRadar(user) && (
                                <Link href="/apex-radar" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                    <LuRadar aria-hidden /> <span>Apex Radar</span>
                                    <span className="apex-dash-nav__badge">BETA</span>
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    signOut({ callbackUrl: "/login" });
                                    setMobileMenuOpen(false);
                                }}
                                className="apex-dash-topbar__mobile-btn apex-dash-topbar__mobile-signout"
                            >
                                <FiLogOut aria-hidden /> <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                )}
            </ClickupTeamMembersProvider>
            {/* SharePropertyModal (only for non-external users) */}
            {showShareModal && !user?.isExternal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
                    <div className="z-50">
                        <SharePropertyModal
                            customer={accessibleCustomers.find(c => c._id === activeCustomerId)}
                            users={allUsers}
                            onShare={handleShareProperty}
                            onCancel={() => setShowShareModal(false)}
                            loading={shareLoading}
                        />
                        {shareError && <div className="text-red-500 text-sm mt-2">{shareError}</div>}
                    </div>
                </div>
            )}
        </>
    );
};

export default Topbar;