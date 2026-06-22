import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { FiBell } from "react-icons/fi";
import { FiChevronDown, FiHome, FiUser, FiSettings, FiBarChart2, FiLogOut, FiBookOpen, FiShare2, FiGift, FiFileText } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useParams, usePathname, useRouter } from "next/navigation";
import { parseApexRadarPath, APEX_RADAR_CHANNEL_FACEBOOK, apexRadarOverviewHref } from "@/lib/apexRadarChannels";

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
import { normalizeInternalNotificationHref } from "@/lib/notificationLink";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";

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

function formatNotificationTime(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function parseUnreadCount(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), 99999);
}

const Topbar = ({ showLinks = true, showLogo = false, showPropertySection = true, isParentProperty = false }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [bellMenuOpen, setBellMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const user = useUser();
    const [notifPreview, setNotifPreview] = useState([]);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);
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
        const ch = apexRadarPath.channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
        return [{ id: APEX_RADAR_CUSTOMER_SELECT_ALL, name: "All", href: apexRadarOverviewHref(ch) }];
    }, [apexRadarPath.isApexRadar, apexRadarPath.channel]);

    const activeCustomerName = useMemo(() => {
        if (apexRadarPath.isApexRadar && !apexRadarPath.customerId) return "All";
        return activeCustomer?.customerName ?? null;
    }, [apexRadarPath.isApexRadar, apexRadarPath.customerId, activeCustomer?.customerName]);

    const buildPropertyHref = useCallback(
        (customerId) => {
            if (apexRadarPath.isApexRadar) {
                const ch = apexRadarPath.channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
                return `/apex-radar/${ch}/${customerId}`;
            }
            return `/dashboard/${customerId}/performance-dashboard`;
        },
        [apexRadarPath.isApexRadar, apexRadarPath.channel]
    );

    // Check if activeCustomerId is accessible, if not redirect to first accessible customer
    const isActiveCustomerAccessible = accessibleCustomers.some((c) => c._id === activeCustomerId);
    React.useEffect(() => {
        if (!activeCustomerId || isActiveCustomerAccessible || accessibleCustomers.length === 0) return;
        const first = accessibleCustomers[0]._id;
        const { isApexRadar, channel } = parseApexRadarPath(pathname);
        if (isApexRadar) {
            const ch = channel ?? APEX_RADAR_CHANNEL_FACEBOOK;
            router.push(`/apex-radar/${ch}/${first}`);
            return;
        }
        router.push(`/dashboard/${first}/performance-dashboard`);
    }, [activeCustomerId, isActiveCustomerAccessible, accessibleCustomers, router, pathname]);

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
        if (!user?.email) return;
        fetch("/api/notifications?limit=5")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d) {
                    setNotifPreview(Array.isArray(d.notifications) ? d.notifications : []);
                    setNotifUnreadCount(parseUnreadCount(d.unreadCount));
                }
            })
            .catch(() => { });
    }, [user?.email]);

    const toggleBellMenu = async () => {
        const willOpen = !bellMenuOpen;
        if (willOpen && user) {
            try {
                await fetch("/api/notifications/mark-read", { method: "POST" });
                const r = await fetch("/api/notifications?limit=5");
                const d = await r.json();
                if (r.ok) {
                    setNotifPreview(Array.isArray(d.notifications) ? d.notifications : []);
                    setNotifUnreadCount(parseUnreadCount(d.unreadCount));
                }
            } catch (_) {
                /* ignore */
            }
        }
        setBellMenuOpen(willOpen);
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
                aria-haspopup="true"
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
                <div className="apex-dash-topbar__notif-panel">
                    <div className="px-4 pb-2 border-b border-[var(--color-rule)] shrink-0">
                        <p className="font-semibold text-[var(--color-ink)] text-sm">Notifications</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                            {notifPreview.length ? `Latest ${notifPreview.length}` : "No recent items"}
                        </p>
                    </div>
                    <div className="overflow-y-auto flex-1 px-2 py-1">
                        {notifPreview.length === 0 ? (
                            <p className="text-xs text-[var(--color-muted)] text-center py-6 px-2">You&apos;re all caught up.</p>
                        ) : (
                            <ul className="space-y-0">
                                {notifPreview.map((n) => (
                                    <li key={n.id} className="border-b border-[var(--color-rule)] last:border-0">
                                        {n.linkUrl?.startsWith("http") ? (
                                            <a
                                                href={n.linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block px-2 py-2.5 rounded-lg hover:bg-[var(--color-paper-2)] text-left"
                                            >
                                                <p className="text-xs font-semibold text-[var(--color-ink)] line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-[var(--color-ink-2)] line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-[var(--color-muted)] mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </a>
                                        ) : n.linkUrl ? (
                                            <Link
                                                href={normalizeInternalNotificationHref(n.linkUrl)}
                                                className="block px-2 py-2.5 rounded-lg hover:bg-[var(--color-paper-2)] text-left"
                                                onClick={() => setBellMenuOpen(false)}
                                            >
                                                <p className="text-xs font-semibold text-[var(--color-ink)] line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-[var(--color-ink-2)] line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-[var(--color-muted)] mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </Link>
                                        ) : (
                                            <div className="px-2 py-2.5">
                                                <p className="text-xs font-semibold text-[var(--color-ink)] line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-[var(--color-ink-2)] line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-[var(--color-muted)] mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="px-3 pt-2 border-t border-[var(--color-rule)] shrink-0">
                        <Link
                            href="/notifications"
                            className="block text-center text-xs font-semibold text-[var(--color-accent-light)] py-2 rounded-lg hover:bg-[var(--color-paper-2)]"
                            onClick={() => setBellMenuOpen(false)}
                        >
                            Show all
                        </Link>
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
                                    <Link href={`/parent-property/${activeCustomer?.parentCustomer || ""}/home`}>
                                        <span className="apex-dash-topbar__btn">Group View</span>
                                    </Link>

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
                                                <div className="apex-dash-topbar__menu-user-row">
                                                    <p className="apex-dash-topbar__menu-user-name">{user?.name}</p>
                                                    {user?.isAdmin && (
                                                        <span className="apex-dash-nav__badge">Admin</span>
                                                    )}
                                                    {user?.isExternal && (
                                                        <span className="apex-dash-nav__badge">External</span>
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
                                        <li>
                                            <Link href="/lib/guides" onClick={() => setMenuOpen(false)}>
                                                <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiBookOpen aria-hidden /></span>
                                                Guides
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/news" onClick={() => setMenuOpen(false)}>
                                                <span className="apex-dash__icon-box apex-dash__icon-box--menu"><FiFileText aria-hidden /></span>
                                                News
                                            </Link>
                                        </li>
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
                                        {canAccessApexRadar(user) && (
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
                                <Link
                                    href={`/parent-property/${activeCustomer?.parentCustomer || ""}/home`}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="apex-dash-topbar__mobile-link"
                                >
                                    <FiHome aria-hidden />
                                    <span>View Group Property</span>
                                </Link>
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
                            <Link href="/lib/guides" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                <FiBookOpen aria-hidden /> <span>Guides</span>
                            </Link>
                            <Link href="/news" onClick={() => setMobileMenuOpen(false)} className="apex-dash-topbar__mobile-link">
                                <FiFileText aria-hidden /> <span>News</span>
                            </Link>
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
                            {canAccessApexRadar(user) && (
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