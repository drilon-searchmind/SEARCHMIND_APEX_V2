import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { FiBell } from "react-icons/fi";
import { FiChevronDown, FiHome, FiUser, FiSettings, FiBarChart2, FiLogOut, FiSearch, FiUsers, FiBookOpen, FiShare2, FiGift, FiFileText } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useParams, useRouter } from "next/navigation";
import Select from 'react-select';
import TeamMembers, { ClickupTeamMembersProvider } from './TeamMembers';
import TrackingScore from './TrackingScore';
import SharePropertyModal from '@/components/dashboard/SharePropertyModal';
import ParentPropertyFilterDropdown from './ParentPropertyFilterDropdown';
import Link from "next/link";
import FormButton from "../form/FormButton";
import { LuRadar } from "react-icons/lu";
import { RiToolsFill } from "react-icons/ri";
import { getDemoCustomerIds } from "@/lib/demoCustomerId";

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
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });
    const { customers } = useCustomers();
    const params = useParams();
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

    // Prepare options for react-select
    const customerOptions = accessibleCustomers.map((customer) => ({
        value: customer._id,
        label: `${customer.customerName}`,
        customer: customer
    }));

    // Check if activeCustomerId is accessible, if not redirect to first accessible customer
    const isActiveCustomerAccessible = accessibleCustomers.some(c => c._id === activeCustomerId);
    React.useEffect(() => {
        if (activeCustomerId && !isActiveCustomerAccessible && accessibleCustomers.length > 0) {
            // Redirect to first accessible customer if current one is not accessible
            router.push(`/dashboard/${accessibleCustomers[0]._id}/performance-dashboard`);
        }
    }, [activeCustomerId, isActiveCustomerAccessible, accessibleCustomers, router]);

    const selectedOption = customerOptions.find(option => option.value === activeCustomerId);

    const handleToggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
    };

    // On mount, sync theme from localStorage and set <html> class
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        }
    }, []);

    // Update <html> class when theme changes
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            document.documentElement.classList.toggle('dark', theme === 'dark');
        }
    }, [theme]);

    const handleCustomerChange = (selectedOption) => {
        if (selectedOption) {
            router.push(`/dashboard/${selectedOption.value}/performance-dashboard`);
        }
    };

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
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:bg-gray-50"
            >
                <FiBell className="size-[1.15rem]" aria-hidden />
                {notifUnreadCount > 0 && (
                    <span
                        className="absolute -top-1 -right-1 text-[9px] font-semibold text-[var(--color-primary-searchmind)] bg-white rounded min-w-[16px] h-4 flex items-center justify-center px-1 border border-[var(--color-primary-searchmind)]"
                        aria-hidden
                    >
                        {notifUnreadCount > 99 ? "99+" : notifUnreadCount}
                    </span>
                )}
            </button>

            {bellMenuOpen && (
                <div className="absolute right-0 mt-[22px] w-[min(100vw-2rem,22rem)] bg-white rounded-[1rem] z-50 py-3 border border-gray-200 max-h-[min(70vh,24rem)] flex flex-col shadow-lg">
                    <div className="px-4 pb-2 border-b border-gray-100 shrink-0">
                        <p className="font-semibold text-gray-900 text-sm">Notifications</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {notifPreview.length ? `Latest ${notifPreview.length}` : "No recent items"}
                        </p>
                    </div>
                    <div className="overflow-y-auto flex-1 px-2 py-1">
                        {notifPreview.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-6 px-2">You&apos;re all caught up.</p>
                        ) : (
                            <ul className="space-y-0">
                                {notifPreview.map((n) => (
                                    <li key={n.id} className="border-b border-gray-50 last:border-0">
                                        {n.linkUrl?.startsWith("http") ? (
                                            <a
                                                href={n.linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left"
                                            >
                                                <p className="text-xs font-semibold text-gray-900 line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-gray-400 mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </a>
                                        ) : n.linkUrl ? (
                                            <Link
                                                href={n.linkUrl}
                                                className="block px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left"
                                                onClick={() => setBellMenuOpen(false)}
                                            >
                                                <p className="text-xs font-semibold text-gray-900 line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-gray-400 mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </Link>
                                        ) : (
                                            <div className="px-2 py-2.5">
                                                <p className="text-xs font-semibold text-gray-900 line-clamp-1">{n.title}</p>
                                                <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</p>
                                                <p className="text-[0.65rem] text-gray-400 mt-1">{formatNotificationTime(n.createdAt)}</p>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="px-3 pt-2 border-t border-gray-100 shrink-0">
                        <Link
                            href="/notifications"
                            className="block text-center text-xs font-semibold text-[var(--color-primary-searchmind)] py-2 rounded-lg hover:bg-[var(--color-primary-searchmind-lighter)]"
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
                <div className="sticky top-0 bg-white flex items-center justify-between px-4 xl:px-20 py-4 xl:py-5 border-b border-gray-200 transition-colors duration-200 z-40">
                    {/* Left Section */}
                    <div className="flex items-center space-x-4 xl:space-x-5 flex-1 xl:flex-none">
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

                        {/* Home Link - Hidden on mobile */}
                        <div className="relative hidden">
                            <Link href="/home" className="flex items-center space-x-0">
                                <FiHome className="text-gray-400 h-4 w-4" />
                            </Link>
                        </div>

                        {/* Customer Selector - Visible on mobile and desktop */}
                        <div className="flex items-center space-x-2 flex-1 xl:flex-none">
                            <FiUsers className="text-gray-400 h-4 w-4 hidden xl:block" />
                            <div className="w-32 xl:w-64">
                                <Select
                                    value={selectedOption}
                                    onChange={handleCustomerChange}
                                    options={customerOptions}
                                    placeholder="Select"
                                    isSearchable={true}
                                    isClearable={false}
                                    className="react-select-container text-xs xl:text-sm"
                                    classNamePrefix="react-select"
                                    styles={{
                                        control: (provided, state) => ({
                                            ...provided,
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            backgroundColor: 'white',
                                            minHeight: '36px',
                                            boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                                            '&:hover': {
                                                borderColor: '#9ca3af'
                                            }
                                        }),
                                        menu: (provided) => ({
                                            ...provided,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                            backgroundColor: 'white',
                                            zIndex: 50
                                        }),
                                        option: (provided, state) => ({
                                            ...provided,
                                            backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#f3f4f6' : 'white',
                                            color: state.isSelected ? 'white' : '#374151',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            '&:active': {
                                                backgroundColor: state.isSelected ? '#2563eb' : '#e5e7eb'
                                            }
                                        }),
                                        singleValue: (provided) => ({
                                            ...provided,
                                            color: '#374151'
                                        }),
                                        placeholder: (provided) => ({
                                            ...provided,
                                            color: '#9ca3af'
                                        }),
                                        input: (provided) => ({
                                            ...provided,
                                            color: '#374151'
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        {/* Team Members - desktop (xl+). Tracking score remains admin-only. */}
                        {showLinks && (
                            <div id="teamMembers" className="hidden xl:flex items-center gap-6">
                                {!user?.isExternal && (
                                    <TrackingScore customerId={activeCustomerId} />
                                )}
                                <TeamMembers />
                            </div>
                        )}
                    </div>

                    {/* Right Section - Desktop Layout */}
                    <div className="hidden xl:flex items-center space-x-4">
                        {showPropertySection && (
                            <>
                                <div className="flex items-center gap-4 mr-4">
                                    <Link href={`/parent-property/${activeCustomer?.parentCustomer || ""}/home`}>
                                        <FormButton buttonSize="small" type="button" borderType="">
                                            Group View
                                        </FormButton>
                                    </Link>

                                    <div>
                                        {!user?.isExternal && (
                                            <span
                                                onClick={() => setShowShareModal(true)}
                                            >
                                                <FormButton buttonSize="small" type="button" borderType="outline">
                                                    <FiShare2 className="mr-0" /> Share
                                                </FormButton>
                                            </span>
                                        )}
                                    </div>

                                    {activeCustomerId && (() => {
                                        const lastMonthPeriod = getLastMonthPeriod();
                                        const raw = user?.openedWrappedPeriods?.[activeCustomerId];
                                        const opened = Array.isArray(raw)
                                            ? raw.map((p) => String(p).trim()).filter((p) => /^\d{4}-\d{2}$/.test(p))
                                            : [];
                                        const hasOpenedLastMonth = opened.includes(lastMonthPeriod);
                                        const hasUnreadWrapped = !hasOpenedLastMonth;
                                        return (
                                            <div className="relative flex items-center justify-center w-10 h-10 overflow-visible mr-0">
                                                <Link
                                                    href={`/dashboard/${activeCustomerId}/data-wrapped`}
                                                    className={`relative z-10 flex items-center justify-center w-full h-full rounded-lg transition-colors ${hasUnreadWrapped
                                                        ? "bg-[var(--color-lime)]/100"
                                                        : "bg-gray-100 hover:bg-gray-200"
                                                        }`}
                                                    title="Data Wrapped"
                                                >
                                                    <FiGift className={hasUnreadWrapped ? "text-[var(--color-primary-searchmind)]" : "text-gray-700"} />
                                                    {hasUnreadWrapped && (
                                                        <span className="absolute -top-1 -right-1 text-[9px] font-semibold text-[var(--color-primary-searchmind)] bg-white rounded min-w-[16px] h-4 flex items-center justify-center px-1 border border-[var(--color-primary-searchmind)]">
                                                            1
                                                        </span>
                                                    )}
                                                </Link>
                                            </div>
                                        );
                                    })()}

                                </div>
                            </>
                        )}

                        {isParentProperty && (
                            <ParentPropertyFilterDropdown />
                        )}
                        <div>
                            <button
                                type="button"
                                onClick={handleToggleTheme}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {theme === "dark" ? (
                                    <FaSun className="size-[1.15rem]" aria-hidden />
                                ) : (
                                    <FaMoon className="size-[1.15rem]" aria-hidden />
                                )}
                            </button>
                        </div>

                        {renderNotificationsBell()}

                        <div className="relative" ref={menuRef}>
                            <button
                                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                                onClick={() => setMenuOpen(!menuOpen)}
                            >
                                <Image
                                    src={user?.image || "/images/users/66beeaec47a55.jpg"}
                                    alt="User"
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                                <span className="text-gray-900 text-sm">{user?.name || "User"}</span>
                                <FiChevronDown className="ml-2 text-gray-700" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 mt-[22px] w-75 bg-white shadow-xs rounded-[1rem] px-4 overflow-hidden z-50 py-4 border border-gray-200 transition-colors duration-200">
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-gray-900">{user?.name}</p>
                                            {user?.isAdmin && (
                                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                                                    Admin
                                                </span>
                                            )}

                                            {user?.isExternal && (
                                                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-1 ml-1">
                                                    External
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-xs">{user?.email}</p>
                                    </div>

                                    <ul className="flex flex-col gap-4 py-2">
                                        <li className="flex items-center gap-2">
                                            <FiUser />
                                            <Link href="/profile" className="text-sm text-slate-800 font-semibold">My Account</Link>
                                        </li>
                                        <li className="flex items-center gap-2 hidden">
                                            <FiBarChart2 />
                                            <Link href="/my-campaigns" className="text-sm text-slate-800 font-semibold">My Campaigns</Link>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <FiBookOpen />
                                            <Link href="/lib/guides" className="text-sm text-slate-800 font-semibold">Guides</Link>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <FiFileText />
                                            <Link href="/news" className="text-sm text-slate-800 font-semibold">News</Link>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <FiBell />
                                            <Link href="/notifications" className="text-sm text-slate-800 font-semibold">Notifications</Link>
                                        </li>
                                        {!user?.isExternal && (
                                            <li className="flex items-center gap-2">
                                                <RiToolsFill />
                                                <Link href="/our-tools" className="text-sm text-slate-800 font-semibold">Our Tools</Link>
                                                <span className="text-[0.5rem] text-black bg-gray-200 rounded px-3 py-1">BETA</span>
                                            </li>
                                        )}
                                        {user?.isAdmin && (
                                            <>
                                                <li className="flex items-center gap-2">
                                                    <FiSettings />
                                                    <Link href="/admin" className="text-sm text-slate-800 font-semibold">Admin</Link>
                                                </li>
                                                <li
                                                    id="apexRadar-link"
                                                    className="flex items-center gap-2 bg-[var(--color-primary-searchmind-lighter)] text-white rounded py-2 px-3">
                                                    <Link href="#" className="text-sm font-semibold">Apex Radar</Link>
                                                    <span className="text-[0.5rem] text-black bg-gray-200 rounded px-3 py-1">BETA</span>
                                                </li>
                                            </>
                                        )}
                                        <hr className="text-gray-200" />
                                        <li className="flex items-center gap-2">
                                            <FiLogOut />
                                            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-slate-800 font-semibold">Sign Out</button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Toggle + Theme */}
                    <div className="flex xl:hidden items-center space-x-3 ml-auto">
                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        >
                            {theme === "dark" ? (
                                <FaSun className="size-[1.15rem]" aria-hidden />
                            ) : (
                                <FaMoon className="size-[1.15rem]" aria-hidden />
                            )}
                        </button>
                        {renderNotificationsBell()}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:bg-gray-50"
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
                    <div
                        ref={mobileMenuRef}
                        className="fixed xl:hidden top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40 max-h-[calc(100vh-64px)] overflow-y-auto"
                    >
                        <div className="px-4 py-4 space-y-4 ml-[50px]">
                            {/* Home Link */}
                            <Link
                                href="/home"
                                className="flex items-center space-x-3 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <FiHome className="text-gray-400 h-5 w-5" />
                                <span className="text-gray-900 font-medium">Home</span>
                            </Link>

                            {/* Team Members - Mobile */}
                            {showLinks && (
                                <div id="teamMembers-mobile" className="py-2 border-b border-gray-200">
                                    <TeamMembers />
                                </div>
                            )}

                            {/* Property Actions - Mobile */}
                            {showPropertySection && (
                                <>
                                    <div className="py-2">
                                        <p className="text-xs font-semibold text-gray-500 px-3 mb-2">PROPERTY</p>
                                        <Link
                                            href={`/parent-property/${activeCustomer?.parentCustomer || ""}/home`}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <FiHome className="text-gray-400 h-5 w-5" />
                                            <span className="text-gray-900 font-medium text-sm">View Group Property</span>
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
                                                    className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors mt-2"
                                                >
                                                    <div className="relative flex items-center justify-center w-8 h-8">
                                                        <FiGift className={`h-5 w-5 ${hasUnreadWrapped ? "text-[var(--color-primary-searchmind)]" : "text-gray-400"}`} />
                                                        {hasUnreadWrapped && (
                                                            <span className="absolute -top-0.5 -right-0.5 text-[9px] font-semibold text-[var(--color-primary-searchmind)] bg-white rounded min-w-[14px] h-3.5 flex items-center justify-center px-0.5 border border-[var(--color-primary-searchmind)]">
                                                                (1)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-gray-900 font-medium text-sm">Data Wrapped</span>
                                                </Link>
                                            );
                                        })()}
                                        {!user?.isExternal && (
                                            <button
                                                onClick={() => {
                                                    setShowShareModal(true);
                                                    setMobileMenuOpen(false);
                                                }}
                                                className="w-full flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors mt-2"
                                            >
                                                <FiUsers className="text-gray-400 h-5 w-5" />
                                                <span className="text-gray-900 font-medium text-sm">Share property</span>
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* User Menu Items - Mobile */}
                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs font-semibold text-gray-500 px-3 mb-3">ACCOUNT</p>
                                <div className="mb-3">
                                    <div className="flex items-center space-x-3 px-3 py-2">
                                        <Image
                                            src={user?.image || "/images/users/66beeaec47a55.jpg"}
                                            alt="User"
                                            width={32}
                                            height={32}
                                            className="rounded-full"
                                        />
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{user?.name || "User"}</p>
                                            <p className="text-gray-400 text-xs">{user?.email}</p>
                                        </div>
                                    </div>
                                    {user?.isAdmin && (
                                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full ml-11">
                                            Admin
                                        </span>
                                    )}
                                    {user?.isExternal && (
                                        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full ml-11 ml-1">
                                            External
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Link
                                        href="/profile"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <FiUser className="text-gray-400 h-5 w-5" />
                                        <span className="text-gray-900 font-medium text-sm">User Profile</span>
                                    </Link>
                                    <Link
                                        href="/lib/guides"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <FiBookOpen className="text-gray-400 h-5 w-5" />
                                        <span className="text-gray-900 font-medium text-sm">Guides</span>
                                    </Link>
                                    <Link
                                        href="/news"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <FiFileText className="text-gray-400 h-5 w-5" />
                                        <span className="text-gray-900 font-medium text-sm">News</span>
                                    </Link>
                                    <Link
                                        href="/notifications"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <FiBell className="text-gray-400 h-5 w-5" />
                                        <span className="text-gray-900 font-medium text-sm">Notifications</span>
                                    </Link>
                                    {!user?.isExternal && (
                                        <Link
                                            href="/our-tools"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <RiToolsFill className="text-gray-400 h-5 w-5" />
                                            <span className="text-gray-900 font-medium text-sm">Our Tools</span>
                                        </Link>
                                    )}
                                    {user?.isAdmin && (
                                        <Link
                                            href="/admin"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <FiSettings className="text-gray-400 h-5 w-5" />
                                            <span className="text-gray-900 font-medium text-sm">Admin</span>
                                        </Link>
                                    )}
                                    <Link
                                        href="/profile"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <FiBarChart2 className="text-gray-400 h-5 w-5" />
                                        <span className="text-gray-900 font-medium text-sm">Campaigns</span>
                                    </Link>
                                    <button
                                        onClick={() => {
                                            signOut({ callbackUrl: "/login" });
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-red-600"
                                    >
                                        <FiLogOut className="h-5 w-5" />
                                        <span className="font-medium text-sm">Sign Out</span>
                                    </button>
                                </div>
                            </div>
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