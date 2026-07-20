"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    FiArrowRight,
    FiLogOut,
    FiStar,
    FiServer,
    FiGlobe,
    FiBookOpen,
    FiFileText,
    FiBell,
    FiCopy,
    FiX,
    FiSearch,
    FiUser,
    FiChevronUp,
    FiChevronDown,
} from "react-icons/fi";
import { LuRadar } from "react-icons/lu";
import { RiToolsFill } from "react-icons/ri";
import { SiShopify, SiWordpress, SiMagento } from "react-icons/si";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreateForm from "../form/CustomerCreateForm";
import { buildCustomerCreateFormStateFromCustomer } from "@/lib/customerCreateFormState";
import { getCustomerPlatformLabel } from "@/lib/customerPlatformDisplay";

function PlatformIcon({ type }) {
    const iconClass = "w-3.5 h-3.5 shrink-0 opacity-70";
    if (type === "Shopify") return <SiShopify className={iconClass} aria-hidden />;
    if (type === "WooCommerce") return <SiWordpress className={iconClass} aria-hidden />;
    if (type === "Magento") return <SiMagento className={iconClass} aria-hidden />;
    if (type === "DanDomain") return <FiGlobe className={iconClass} aria-hidden />;
    if (type === "DanDomainOriginal") return <FiGlobe className={iconClass} aria-hidden />;
    return <FiServer className={iconClass} aria-hidden />;
}

function HomeAsideAccordionItem({ id, title, count, isOpen, onToggle, children, scrollable = false }) {
    const panelId = `apex-home-aside-${id}`;

    return (
        <div className={`apex-home__accordion-item${isOpen ? " is-open" : ""}`}>
            <button
                type="button"
                className="apex-home__accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={onToggle}
            >
                <span className="apex-home__accordion-title">{title}</span>
                {count != null && (
                    <span className="apex-home__accordion-count">{count}</span>
                )}
                <span className="apex-home__accordion-chevron" aria-hidden>
                    {isOpen ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                </span>
            </button>
            <div
                id={panelId}
                className={`apex-home__accordion-panel${scrollable ? " apex-home__accordion-panel--scroll" : ""}`}
                hidden={!isOpen}
            >
                {children}
            </div>
        </div>
    );
}

function HomeAsidePanel({
    user,
    showLatestNews,
    favoriteCustomers,
    newsPosts,
    newsLoading,
    onLogout,
}) {
    const [asideOpen, setAsideOpen] = useState({
        favorites: true,
        navigate: false,
        news: false,
    });

    const toggleAsideSection = (key) => {
        setAsideOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <aside className="apex-home__aside" aria-label="Shortcuts and updates">
            <div className="apex-home__aside-card">
                <div className="apex-home__aside-hero">
                    <p className="apex-home__panel-eyebrow">Apex · Marketing ops</p>
                    <p className="apex-home__panel-display">Shortcuts & updates</p>
                    <p className="apex-home__panel-copy">
                        Pinned properties, team links, and the latest from Searchmind.
                    </p>
                </div>

                <div className="apex-home__accordion">
                    <HomeAsideAccordionItem
                        id="favorites"
                        title="Favorites"
                        count={favoriteCustomers.length || null}
                        isOpen={asideOpen.favorites}
                        onToggle={() => toggleAsideSection("favorites")}
                        scrollable
                    >
                        {favoriteCustomers.length === 0 ? (
                            <p className="apex-home__aside-empty apex-home__aside-empty--compact">
                                Pin properties with the star in the list.
                            </p>
                        ) : (
                            <ul className="apex-home__rail apex-home__rail--compact">
                                {favoriteCustomers.map((customer) => (
                                    <li key={customer._id}>
                                        <Link
                                            href={`/dashboard/${customer._id}/performance-dashboard`}
                                            className="apex-home__rail-link"
                                        >
                                            <span
                                                className="apex-home__rail-icon apex-home__rail-icon--star apex-home__rail-icon--compact"
                                                aria-hidden
                                            >
                                                <FiStar className="w-3 h-3 apex-home__rail-star" />
                                            </span>
                                            <span className="apex-home__rail-text">
                                                {customer.customerName}
                                            </span>
                                            <FiArrowRight className="apex-home__rail-arrow" aria-hidden />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </HomeAsideAccordionItem>

                    {!user?.isExternal && (
                        <HomeAsideAccordionItem
                            id="navigate"
                            title="Navigate"
                            isOpen={asideOpen.navigate}
                            onToggle={() => toggleAsideSection("navigate")}
                        >
                            <ul className="apex-home__rail">
                                <RailLink href="/profile" icon={FiUser}>
                                    My account
                                </RailLink>
                                <RailLink href="/lib/guides" icon={FiBookOpen}>
                                    Guides
                                </RailLink>
                                <RailLink href="/news" icon={FiFileText}>
                                    News
                                </RailLink>
                                <RailLink href="/notifications" icon={FiBell}>
                                    Notifications
                                </RailLink>
                                <RailLink href="/our-tools" icon={RiToolsFill}>
                                    Our tools
                                </RailLink>
                                {canAccessApexRadar(user) && (
                                    <RailLink href="/apex-radar" icon={LuRadar} badge="WIP">
                                        Apex Radar
                                    </RailLink>
                                )}
                            </ul>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="apex-home__rail-logout"
                            >
                                <FiLogOut aria-hidden />
                                Log out
                            </button>
                        </HomeAsideAccordionItem>
                    )}

                    {showLatestNews && (
                        <HomeAsideAccordionItem
                            id="news"
                            title="Latest news"
                            count={newsLoading ? null : newsPosts.length || null}
                            isOpen={asideOpen.news}
                            onToggle={() => toggleAsideSection("news")}
                        >
                            {newsLoading ? (
                                <p className="apex-home__aside-empty">Loading…</p>
                            ) : newsPosts.length === 0 ? (
                                <p className="apex-home__aside-empty">No posts yet.</p>
                            ) : (
                                <ul className="apex-home__news-rail">
                                    {newsPosts.map((post) => (
                                        <li key={post.slug || post._id}>
                                            <Link href={`/news/${post.slug}`} className="apex-home__news-card">
                                                {post.publishedAt && (
                                                    <time
                                                        dateTime={post.publishedAt}
                                                        className="apex-home__news-card-date"
                                                    >
                                                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        })}
                                                    </time>
                                                )}
                                                <span className="apex-home__news-card-title">{post.title}</span>
                                                <FiArrowRight className="apex-home__news-card-arrow" aria-hidden />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Link href="/news" className="apex-home__aside-more">
                                All news →
                            </Link>
                        </HomeAsideAccordionItem>
                    )}
                </div>
            </div>
        </aside>
    );
}

function RailLink({ href, icon: Icon, children, badge }) {
    return (
        <li>
            <Link href={href} className="apex-home__rail-link">
                <span className="apex-home__rail-icon" aria-hidden>
                    <Icon className="w-4 h-4" />
                </span>
                <span className="apex-home__rail-text">
                    {children}
                    {badge && <span className="apex-home__badge">{badge}</span>}
                </span>
                <FiArrowRight className="apex-home__rail-arrow" aria-hidden />
            </Link>
        </li>
    );
}

const SKELETON_GROUPS = [
    { key: "a", rows: 5 },
    { key: "b", rows: 3 },
];

function HomeLoading() {
    return (
        <>
            <header className="apex-home__nav">
                <Link href="/home" className="apex-home__brand">
                    <Image
                        src="/images/icons/apex-icon-svg.svg"
                        alt=""
                        width={32}
                        height={32}
                        aria-hidden
                    />
                    <span className="apex-home__brand-text">Searchmind Apex</span>
                </Link>
                <div className="apex-home__search">
                    <div className="apex-home__search-btn apex-home__search-btn--skeleton" aria-hidden>
                        <FiSearch aria-hidden />
                        <span>Search properties…</span>
                    </div>
                </div>
            </header>

            <div className="apex-home__intro">
                <p className="apex-home__eyebrow">Workspace</p>
                <h1 className="apex-home__headline">Loading properties</h1>
                <p className="apex-home__lede">
                    Fetching your workspace
                    <span className="apex-home__load-dots" aria-hidden>
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                    </span>
                </p>
            </div>

            <div className="apex-home" role="status" aria-live="polite" aria-label="Loading properties">
                <div className="apex-home__layout">
                    <main className="apex-home__index">
                        {SKELETON_GROUPS.map((group, groupIndex) => (
                            <section
                                key={group.key}
                                className="apex-home__skeleton-group"
                                style={{ animationDelay: `${groupIndex * 120}ms` }}
                            >
                                <div className="apex-home__skeleton-line apex-home__skeleton-line--group" />
                                <div className="apex-home__skeleton-table">
                                    <div className="apex-home__skeleton-row apex-home__skeleton-row--head">
                                        <span className="apex-home__skeleton-line apex-home__skeleton-line--th" />
                                        <span className="apex-home__skeleton-line apex-home__skeleton-line--th apex-home__skeleton-line--short" />
                                        <span className="apex-home__skeleton-line apex-home__skeleton-line--th apex-home__skeleton-line--xs" />
                                    </div>
                                    {Array.from({ length: group.rows }).map((_, rowIndex) => (
                                        <div
                                            key={rowIndex}
                                            className="apex-home__skeleton-row"
                                            style={{
                                                animationDelay: `${groupIndex * 120 + rowIndex * 80}ms`,
                                            }}
                                        >
                                            <span className="apex-home__skeleton-line apex-home__skeleton-line--name" />
                                            <span className="apex-home__skeleton-line apex-home__skeleton-line--platform" />
                                            <span className="apex-home__skeleton-line apex-home__skeleton-line--action" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </main>

                    <aside className="apex-home__aside" aria-hidden>
                        <div className="apex-home__aside-card">
                            <div className="apex-home__aside-hero">
                                <p className="apex-home__panel-eyebrow">Apex · Marketing ops</p>
                                <p className="apex-home__panel-display">Shortcuts & updates</p>
                                <p className="apex-home__panel-copy">
                                    Pinned properties, team links, and the latest from Searchmind.
                                </p>
                            </div>
                            <div className="apex-home__accordion">
                                <div className="apex-home__accordion-item is-open">
                                    <div className="apex-home__accordion-trigger apex-home__accordion-trigger--skeleton" />
                                    <div className="apex-home__skeleton-rail">
                                        <div className="apex-home__skeleton-line apex-home__skeleton-line--rail" />
                                        <div className="apex-home__skeleton-line apex-home__skeleton-line--rail" />
                                        <div className="apex-home__skeleton-line apex-home__skeleton-line--rail" />
                                    </div>
                                </div>
                                <div className="apex-home__accordion-item">
                                    <div className="apex-home__accordion-trigger apex-home__accordion-trigger--skeleton" />
                                </div>
                                <div className="apex-home__accordion-item">
                                    <div className="apex-home__accordion-trigger apex-home__accordion-trigger--skeleton" />
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}

export default function CustomerTable({ showLatestNews = true }) {
    const router = useRouter();
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [customerToCopy, setCustomerToCopy] = useState(null);
    const [parentNames, setParentNames] = useState({});
    const [favoritedCustomers, setFavoritedCustomers] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState({});
    const [newsPosts, setNewsPosts] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [cmdkOpen, setCmdkOpen] = useState(false);
    const [cmdkQuery, setCmdkQuery] = useState("");
    const [cmdkActive, setCmdkActive] = useState(0);
    const [sortKey, setSortKey] = useState("name");
    const [sortDir, setSortDir] = useState("asc");
    const cmdkInputRef = useRef(null);
    const user = useUser();
    const { customers, loading, error } = useCustomers(refreshKey);

    useEffect(() => {
        if (user?.favoritedCustomers) {
            const favoriteIds = user.favoritedCustomers.map((id) =>
                typeof id === "object" && id.$oid ? id.$oid : String(id)
            );
            setFavoritedCustomers(favoriteIds);
        }
    }, [user]);

    useEffect(() => {
        if (!showLatestNews) {
            setNewsLoading(false);
            return;
        }
        let cancelled = false;
        setNewsLoading(true);
        (async () => {
            try {
                const res = await fetch("/api/news");
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to load news");
                const posts = Array.isArray(data.posts) ? data.posts : [];
                if (!cancelled) setNewsPosts(posts.slice(0, 4));
            } catch {
                if (!cancelled) setNewsPosts([]);
            } finally {
                if (!cancelled) setNewsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showLatestNews]);

    const sharedCustomerIdsKey = useMemo(() => {
        if (!user?.isExternal) return "";
        return (user.sharedCustomers || [])
            .map((id) => (typeof id === "object" && id.$oid ? id.$oid : String(id)))
            .sort()
            .join(",");
    }, [user?.isExternal, user?.sharedCustomers]);

    const accessibleCustomers = useMemo(() => {
        if (!user?.isExternal) return customers;
        const sharedCustomerIds = sharedCustomerIdsKey ? sharedCustomerIdsKey.split(",") : [];
        return customers.filter((c) => sharedCustomerIds.includes(String(c._id)));
    }, [customers, user?.isExternal, sharedCustomerIdsKey]);

    const groups = useMemo(() => {
        const result = {};
        accessibleCustomers.forEach((customer) => {
            const parent = customer.parentCustomer || "none";
            if (!result[parent]) result[parent] = [];
            result[parent].push(customer);
        });

        const compare = (a, b) => {
            const aVal =
                sortKey === "platform"
                    ? getCustomerPlatformLabel(a).toLowerCase()
                    : (a.customerName || "").toLowerCase();
            const bVal =
                sortKey === "platform"
                    ? getCustomerPlatformLabel(b).toLowerCase()
                    : (b.customerName || "").toLowerCase();
            const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
            return sortDir === "asc" ? cmp : -cmp;
        };

        Object.values(result).forEach((list) => list.sort(compare));
        return result;
    }, [accessibleCustomers, sortKey, sortDir]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ column }) => {
        if (sortKey !== column) return null;
        return sortDir === "asc" ? (
            <FiChevronUp className="apex-home__sort-icon" aria-hidden />
        ) : (
            <FiChevronDown className="apex-home__sort-icon" aria-hidden />
        );
    };

    const groupKeys = Object.keys(groups);

    const parentIdsKey = useMemo(() => {
        const parentIds = Array.from(
            new Set(
                (accessibleCustomers || [])
                    .map((c) => c.parentCustomer)
                    .filter((id) => id && id !== "none")
                    .map((id) => String(id))
            )
        );
        return parentIds.sort().join(",");
    }, [accessibleCustomers]);

    useEffect(() => {
        if (!parentIdsKey) {
            setParentNames((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return undefined;
        }
        const parentIds = parentIdsKey.split(",");
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/parent-customers?minimal=1");
                if (!res.ok) throw new Error("parents");
                const all = await res.json();
                if (cancelled || !Array.isArray(all)) return;
                const byId = Object.fromEntries(
                    all.map((p) => [String(p._id), p.name || String(p._id)])
                );
                const next = {};
                for (const id of parentIds) {
                    next[id] = byId[id] || id;
                }
                if (!cancelled) setParentNames(next);
            } catch {
                if (!cancelled) {
                    setParentNames(Object.fromEntries(parentIds.map((id) => [id, id])));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [parentIdsKey]);

    const cmdkItems = useMemo(() => {
        const q = cmdkQuery.trim().toLowerCase();
        return accessibleCustomers
            .filter((c) => !q || c.customerName.toLowerCase().includes(q))
            .map((c) => ({
                id: String(c._id),
                name: c.customerName,
                platform: getCustomerPlatformLabel(c),
                href: `/dashboard/${c._id}/performance-dashboard`,
            }));
    }, [accessibleCustomers, cmdkQuery]);

    const openCmdk = useCallback(() => {
        setCmdkOpen(true);
        setCmdkQuery("");
        setCmdkActive(0);
    }, []);

    const closeCmdk = useCallback(() => {
        setCmdkOpen(false);
        setCmdkQuery("");
        setCmdkActive(0);
    }, []);

    const selectCmdkItem = useCallback(
        (index) => {
            const item = cmdkItems[index];
            if (!item) return;
            closeCmdk();
            router.push(item.href);
        },
        [cmdkItems, closeCmdk, router]
    );

    useEffect(() => {
        if (!cmdkOpen) return undefined;
        const t = window.setTimeout(() => cmdkInputRef.current?.focus(), 50);
        document.body.style.overflow = "hidden";
        return () => {
            window.clearTimeout(t);
            document.body.style.overflow = "";
        };
    }, [cmdkOpen]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                if (cmdkOpen) closeCmdk();
                else openCmdk();
                return;
            }
            if (!cmdkOpen) return;
            if (e.key === "Escape") {
                e.preventDefault();
                closeCmdk();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCmdkActive((i) => Math.min(i + 1, Math.max(cmdkItems.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCmdkActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                selectCmdkItem(cmdkActive);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [cmdkOpen, cmdkItems.length, cmdkActive, closeCmdk, openCmdk, selectCmdkItem]);

    useEffect(() => {
        setCmdkActive(0);
    }, [cmdkQuery]);

    const handleToggleFavorite = async (customerId) => {
        if (!user?.id) return;
        setLoadingFavorites((prev) => ({ ...prev, [customerId]: true }));
        try {
            const response = await fetch(`/api/user/${user.id}/favorites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId }),
            });
            if (!response.ok) throw new Error("Failed to toggle favorite");
            const data = await response.json();
            const favoriteIds = data.favoritedCustomers.map((id) =>
                typeof id === "object" && id.$oid ? id.$oid : String(id)
            );
            setFavoritedCustomers(favoriteIds);
        } catch (err) {
            console.error("Error toggling favorite:", err);
            alert("Failed to update favorite. Please try again.");
        } finally {
            setLoadingFavorites((prev) => ({ ...prev, [customerId]: false }));
        }
    };

    const isFavorited = (customerId) => favoritedCustomers.includes(String(customerId));

    const handleLogout = () => signOut({ callbackUrl: "/login" });
    const handleCreated = () => {
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
    };

    const favoriteCustomers = useMemo(
        () =>
            favoritedCustomers
                .map((id) => customers.find((c) => String(c._id) === String(id)))
                .filter(Boolean),
        [favoritedCustomers, customers]
    );

    if (loading) {
        return <HomeLoading />;
    }

    if (error) {
        return (
            <div className="apex-home__center">
                <div className="apex-home__panel" style={{ textAlign: "center" }}>
                    <p className="apex-home__headline">Could not load properties</p>
                    <p className="apex-home__error">{error}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="apex-home__btn apex-home__btn--primary"
                        style={{ marginTop: "var(--space-md)" }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <header className="apex-home__nav">
                <Link href="/home" className="apex-home__brand">
                    <Image
                        src="/images/icons/apex-icon-svg.svg"
                        alt=""
                        width={32}
                        height={32}
                        aria-hidden
                    />
                    <span className="apex-home__brand-text">Searchmind Apex</span>
                </Link>

                {!showCreate && (
                    <div className="apex-home__search">
                        <button
                            type="button"
                            className="apex-home__search-btn"
                            onClick={openCmdk}
                            aria-label="Search properties (Ctrl+K)"
                        >
                            <FiSearch aria-hidden />
                            <span>Search properties…</span>
                            <span className="apex-home__search-kbd">
                                <kbd>Ctrl</kbd>
                                <kbd>K</kbd>
                            </span>
                        </button>
                    </div>
                )}

                <div className="apex-home__nav-actions">
                    {!user?.isExternal && (
                        <Link href="/profile" className="apex-home__nav-link">
                            Account
                        </Link>
                    )}
                    {user?.isAdmin && !showCreate && (
                        <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            className="apex-home__btn apex-home__btn--primary"
                        >
                            New property
                        </button>
                    )}
                    {showCreate && (
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="apex-home__btn"
                        >
                            ← Back
                        </button>
                    )}
                </div>
            </header>

            {!showCreate && (
                <div className="apex-home__intro">
                    <p className="apex-home__eyebrow">Workspace</p>
                    <h1 className="apex-home__headline">Select a property</h1>
                    <p className="apex-home__lede">
                        {accessibleCustomers.length}{" "}
                        {accessibleCustomers.length === 1 ? "property" : "properties"} loaded
                        {groupKeys.length > 1 ? ` · ${groupKeys.length} groups` : ""}.
                        Open a dashboard or pin favorites for quick access.
                    </p>
                </div>
            )}

            <div className="apex-home">
                {showCreate ? (
                    <>
                        <div className="apex-home__intro">
                            <p className="apex-home__eyebrow">Admin</p>
                            <h1 className="apex-home__headline">Create new property</h1>
                            <p className="apex-home__lede">
                                Add a customer and connect their platforms. Ad account IDs can be filled in now or later in config.
                            </p>
                        </div>
                        <div className="apex-home__create">
                            <div className="apex-home__panel apex-home__panel--create">
                                <CustomerCreateForm
                                    variant="apex-home"
                                    hideHeading
                                    onSuccess={handleCreated}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="apex-home__layout">
                        <main className="apex-home__index">
                            {accessibleCustomers.length === 0 ? (
                                <div className="apex-home__empty">No properties available.</div>
                            ) : (
                                groupKeys.map((parentId) => (
                                    <section key={parentId} className="apex-home__group">
                                        <div className="apex-home__group-head">
                                            <h2 className="apex-home__group-label">
                                                <span className="apex-home__group-prefix">Group:</span>
                                                {parentId !== "none" ? (
                                                    <Link
                                                        href={`/parent-property/${parentId}/home`}
                                                        className="apex-home__group-name"
                                                    >
                                                        {parentNames[parentId] || parentId}
                                                    </Link>
                                                ) : (
                                                    <span className="apex-home__group-name">Unassigned</span>
                                                )}
                                            </h2>
                                            <span className="apex-home__group-count">
                                                {groups[parentId].length}{" "}
                                                {groups[parentId].length === 1 ? "property" : "properties"}
                                            </span>
                                        </div>
                                        <table className="apex-home__spec">
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="apex-home__spec-col-name">
                                                        <button
                                                            type="button"
                                                            className="apex-home__sort-btn"
                                                            onClick={() => handleSort("name")}
                                                            aria-sort={
                                                                sortKey === "name"
                                                                    ? sortDir === "asc"
                                                                        ? "ascending"
                                                                        : "descending"
                                                                    : "none"
                                                            }
                                                        >
                                                            Property
                                                            <SortIcon column="name" />
                                                        </button>
                                                    </th>
                                                    <th scope="col" className="apex-home__spec-col-platform">
                                                        <button
                                                            type="button"
                                                            className="apex-home__sort-btn"
                                                            onClick={() => handleSort("platform")}
                                                            aria-sort={
                                                                sortKey === "platform"
                                                                    ? sortDir === "asc"
                                                                        ? "ascending"
                                                                        : "descending"
                                                                    : "none"
                                                            }
                                                        >
                                                            Platform
                                                            <SortIcon column="platform" />
                                                        </button>
                                                    </th>
                                                    <th scope="col" className="apex-home__spec-col-action">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups[parentId].map((customer) => (
                                                    <tr key={customer._id}>
                                                        <td>
                                                            <span className="apex-home__spec-name">
                                                                {customer.customerName}
                                                            </span>
                                                        </td>
                                                        <td className="apex-home__spec-col-platform">
                                                            <span className="apex-home__spec-platform">
                                                                <span className="apex-home__spec-platform-inner">
                                                                    <PlatformIcon type={customer.customerType} />
                                                                    {getCustomerPlatformLabel(customer)}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="apex-home__spec-col-action">
                                                            <div className="apex-home__spec-actions">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleToggleFavorite(customer._id)
                                                                    }
                                                                    disabled={loadingFavorites[customer._id]}
                                                                    title={
                                                                        isFavorited(customer._id)
                                                                            ? "Remove favorite"
                                                                            : "Add favorite"
                                                                    }
                                                                    className="apex-home__btn apex-home__btn--ghost"
                                                                    aria-label={
                                                                        isFavorited(customer._id)
                                                                            ? "Remove favorite"
                                                                            : "Add favorite"
                                                                    }
                                                                >
                                                                    <FiStar
                                                                        className={`w-4 h-4 ${
                                                                            isFavorited(customer._id)
                                                                                ? "apex-home__star--on"
                                                                                : "apex-home__star--off"
                                                                        }`}
                                                                    />
                                                                </button>
                                                                {user?.isAdmin && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setCustomerToCopy(customer)
                                                                        }
                                                                        title="Copy settings"
                                                                        className="apex-home__btn apex-home__btn--ghost"
                                                                        aria-label="Copy property settings"
                                                                    >
                                                                        <FiCopy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <Link
                                                                    href={`/dashboard/${customer._id}/performance-dashboard`}
                                                                    className="apex-home__row-link"
                                                                >
                                                                    Open <FiArrowRight className="w-3.5 h-3.5" />
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                ))
                            )}
                        </main>

                        <HomeAsidePanel
                            user={user}
                            showLatestNews={showLatestNews}
                            favoriteCustomers={favoriteCustomers}
                            newsPosts={newsPosts}
                            newsLoading={newsLoading}
                            onLogout={handleLogout}
                        />
                    </div>
                )}
            </div>

            <div
                className={`apex-home__cmdk${cmdkOpen ? " is-open" : ""}`}
                aria-hidden={!cmdkOpen}
            >
                <button
                    type="button"
                    className="apex-home__cmdk-backdrop"
                    aria-label="Close search"
                    onClick={closeCmdk}
                />
                <div
                    className="apex-home__cmdk-panel"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Search properties"
                >
                    <div className="apex-home__cmdk-field">
                        <FiSearch aria-hidden />
                        <input
                            ref={cmdkInputRef}
                            type="search"
                            placeholder="Search properties…"
                            value={cmdkQuery}
                            onChange={(e) => setCmdkQuery(e.target.value)}
                            aria-label="Filter properties"
                        />
                        <kbd>esc</kbd>
                    </div>
                    <div className="apex-home__cmdk-results" role="listbox">
                        {cmdkItems.length === 0 ? (
                            <p className="apex-home__cmdk-empty">No matching properties.</p>
                        ) : (
                            <>
                                <p className="apex-home__cmdk-group">Properties</p>
                                {cmdkItems.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="option"
                                        aria-selected={index === cmdkActive}
                                        className={`apex-home__cmdk-item${
                                            index === cmdkActive ? " is-active" : ""
                                        }`}
                                        onMouseEnter={() => setCmdkActive(index)}
                                        onClick={() => selectCmdkItem(index)}
                                    >
                                        <span>{item.name}</span>
                                        <span className="apex-home__cmdk-item-meta">{item.platform}</span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                    <div className="apex-home__cmdk-foot">
                        <span>
                            <kbd>↑</kbd>
                            <kbd>↓</kbd> navigate
                        </span>
                        <span>
                            <kbd>↵</kbd> open
                        </span>
                        <span>
                            <kbd>esc</kbd> close
                        </span>
                    </div>
                </div>
            </div>

            {customerToCopy && user?.isAdmin && (
                <div className="apex-home__modal" role="dialog" aria-modal="true" aria-labelledby="copy-modal-title">
                    <button
                        type="button"
                        className="apex-home__modal-scrim"
                        aria-label="Close dialog"
                        onClick={() => setCustomerToCopy(null)}
                    />
                    <div className="apex-home__modal-panel">
                        <div className="apex-home__modal-head">
                            <h2 id="copy-modal-title" className="apex-home__modal-title">
                                New property from copy
                            </h2>
                            <button
                                type="button"
                                onClick={() => setCustomerToCopy(null)}
                                className="apex-home__btn apex-home__btn--ghost"
                                aria-label="Close"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="apex-home__muted" style={{ marginBottom: "var(--space-md)" }}>
                            Settings match{" "}
                            <strong style={{ color: "var(--color-ink)", fontStyle: "normal" }}>
                                {customerToCopy.customerName}
                            </strong>
                            . Change the name and details, then create.
                        </p>
                        <CustomerCreateForm
                            key={String(customerToCopy._id)}
                            variant="apex-home"
                            hideHeading
                            initialValues={buildCustomerCreateFormStateFromCustomer(customerToCopy)}
                            submitLabel="Create Customer"
                            submittingLabel="Creating..."
                            onSuccess={() => {
                                setCustomerToCopy(null);
                                setRefreshKey((k) => k + 1);
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
