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
    FiGrid,
    FiFolder,
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
    if (type === "Shopify") return <SiShopify aria-hidden />;
    if (type === "WooCommerce") return <SiWordpress aria-hidden />;
    if (type === "Magento") return <SiMagento aria-hidden />;
    if (type === "DanDomain" || type === "DanDomainOriginal") return <FiGlobe aria-hidden />;
    return <FiServer aria-hidden />;
}

function HomeBar({ children }) {
    return (
        <header className="apex-hm__bar">
            <Link href="/home" className="apex-hm__brand">
                <Image src="/images/icons/apex-icon-svg.svg" alt="" width={32} height={32} aria-hidden />
                <span className="apex-hm__brand-text">Searchmind Apex</span>
            </Link>
            {children}
        </header>
    );
}

function Kpi({ icon: Icon, label, value, caption, hero = false }) {
    return (
        <div className={`apex-hm__kpi${hero ? " apex-hm__kpi--hero" : ""}`}>
            <span className="apex-hm__kpi-icon" aria-hidden>
                <Icon />
            </span>
            <div>
                <p className="apex-hm__kpi-label">{label}</p>
                <p className="apex-hm__kpi-value">{value}</p>
                {caption ? <p className="apex-hm__kpi-caption">{caption}</p> : null}
            </div>
        </div>
    );
}

function PropertyCard({ customer, favorited, favoriteLoading, isAdmin, onToggleFavorite, onCopy }) {
    const label = getCustomerPlatformLabel(customer);
    const href = `/dashboard/${customer._id}/performance-dashboard`;
    return (
        <li className="apex-hm__prop">
            <Link href={href} className="apex-hm__prop-main">
                <span className="apex-hm__prop-icon" aria-hidden>
                    <PlatformIcon type={customer.customerType} />
                </span>
                <span className="apex-hm__prop-text">
                    <span className="apex-hm__prop-name" title={customer.customerName}>
                        {customer.customerName}
                    </span>
                    <span className="apex-hm__prop-platform">{label}</span>
                </span>
            </Link>
            <div className="apex-hm__prop-actions">
                <button
                    type="button"
                    onClick={() => onToggleFavorite(customer._id)}
                    disabled={favoriteLoading}
                    title={favorited ? "Remove from pinned" : "Pin property"}
                    className={`apex-hm__icon-btn${favorited ? " is-on" : ""}`}
                    aria-label={favorited ? `Unpin ${customer.customerName}` : `Pin ${customer.customerName}`}
                    aria-pressed={favorited}
                >
                    <FiStar aria-hidden />
                </button>
                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => onCopy(customer)}
                        title="Copy settings to a new property"
                        className="apex-hm__icon-btn apex-hm__icon-btn--reveal"
                        aria-label={`Copy settings from ${customer.customerName}`}
                    >
                        <FiCopy aria-hidden />
                    </button>
                )}
                <Link href={href} className="apex-hm__open" aria-label={`Open ${customer.customerName}`} title="Open dashboard">
                    <FiArrowRight aria-hidden />
                </Link>
            </div>
        </li>
    );
}

function PropertyRow({ customer, groupLabel, groupHref, showGroup, favorited, favoriteLoading, isAdmin, onToggleFavorite, onCopy }) {
    const label = getCustomerPlatformLabel(customer);
    const href = `/dashboard/${customer._id}/performance-dashboard`;
    return (
        <tr className="apex-hm__row">
            <td className="apex-hm__col-name">
                <Link href={href} className="apex-hm__row-main">
                    <span className="apex-hm__prop-icon" aria-hidden>
                        <PlatformIcon type={customer.customerType} />
                    </span>
                    <span className="apex-hm__row-text">
                        <span className="apex-hm__prop-name" title={customer.customerName}>
                            {customer.customerName}
                        </span>
                        <span className="apex-hm__row-sub">{label}</span>
                    </span>
                </Link>
            </td>
            {showGroup && (
                <td className="apex-hm__col-group">
                    {groupHref ? (
                        <Link href={groupHref} className="apex-hm__row-group">
                            {groupLabel}
                        </Link>
                    ) : (
                        <span className="apex-hm__row-group apex-hm__row-group--plain">{groupLabel}</span>
                    )}
                </td>
            )}
            <td className="apex-hm__col-platform">
                <span className="apex-hm__pill">{label}</span>
            </td>
            <td className="apex-hm__col-actions">
                <div className="apex-hm__row-actions">
                    <button
                        type="button"
                        onClick={() => onToggleFavorite(customer._id)}
                        disabled={favoriteLoading}
                        title={favorited ? "Remove from pinned" : "Pin property"}
                        className={`apex-hm__icon-btn${favorited ? " is-on" : ""}`}
                        aria-label={favorited ? `Unpin ${customer.customerName}` : `Pin ${customer.customerName}`}
                        aria-pressed={favorited}
                    >
                        <FiStar aria-hidden />
                    </button>
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => onCopy(customer)}
                            title="Copy settings to a new property"
                            className="apex-hm__icon-btn"
                            aria-label={`Copy settings from ${customer.customerName}`}
                        >
                            <FiCopy aria-hidden />
                        </button>
                    )}
                    <Link href={href} className="apex-hm__open-link" aria-label={`Open ${customer.customerName}`}>
                        <span className="apex-hm__open-text">Open</span> <FiArrowRight aria-hidden />
                    </Link>
                </div>
            </td>
        </tr>
    );
}

function NavLinkItem({ href, icon: Icon, children, badge }) {
    return (
        <li>
            <Link href={href} className="apex-hm__nav-link">
                <span className="apex-hm__nav-icon" aria-hidden>
                    <Icon />
                </span>
                <span className="apex-hm__nav-text">
                    {children}
                    {badge && <span className="apex-hm__tag">{badge}</span>}
                </span>
                <FiArrowRight className="apex-hm__nav-arrow" aria-hidden />
            </Link>
        </li>
    );
}

function JumpCard({ user, onLogout }) {
    return (
        <section className="apex-hm__card" aria-labelledby="jump-heading">
            <h2 id="jump-heading" className="apex-hm__card-title">
                Jump to
            </h2>
            <ul className="apex-hm__nav-list">
                <NavLinkItem href="/profile" icon={FiUser}>
                    My account
                </NavLinkItem>
                <NavLinkItem href="/lib/guides" icon={FiBookOpen}>
                    Guides
                </NavLinkItem>
                <NavLinkItem href="/news" icon={FiFileText}>
                    News
                </NavLinkItem>
                <NavLinkItem href="/notifications" icon={FiBell}>
                    Notifications
                </NavLinkItem>
                <NavLinkItem href="/our-tools" icon={RiToolsFill}>
                    Our tools
                </NavLinkItem>
                {canAccessApexRadar(user) && (
                    <NavLinkItem href="/apex-radar" icon={LuRadar} badge="WIP">
                        Apex Radar
                    </NavLinkItem>
                )}
            </ul>
            <button type="button" onClick={onLogout} className="apex-hm__logout">
                <FiLogOut aria-hidden />
                Log out
            </button>
        </section>
    );
}

function NewsCard({ post, loading }) {
    if (loading) {
        return (
            <div className="apex-hm__card apex-hm__card--flush" aria-hidden>
                <div className="apex-hm__news-media apex-hm__skeleton" />
                <div className="apex-hm__news-body">
                    <div className="apex-hm__skeleton apex-hm__skeleton--line" />
                    <div className="apex-hm__skeleton apex-hm__skeleton--line apex-hm__skeleton--short" />
                </div>
            </div>
        );
    }
    if (!post) return null;

    return (
        <Link href={`/news/${post.slug}`} className="apex-hm__card apex-hm__card--flush apex-hm__news">
            <div className="apex-hm__news-media">
                {post.coverImageUrl ? (
                    <Image
                        src={post.coverImageUrl}
                        alt=""
                        fill
                        className="apex-hm__news-image"
                        sizes="(min-width: 1280px) 340px, 40vw"
                        unoptimized
                    />
                ) : (
                    <span className="apex-hm__news-placeholder" aria-hidden>
                        <FiFileText />
                    </span>
                )}
            </div>
            <div className="apex-hm__news-body">
                <p className="apex-hm__news-meta">
                    <span className="apex-hm__tag apex-hm__tag--green">New</span>
                    {post.publishedAt ? (
                        <time dateTime={post.publishedAt}>
                            {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                            })}
                        </time>
                    ) : null}
                </p>
                <h3 className="apex-hm__news-title">{post.title}</h3>
                {post.excerpt ? <p className="apex-hm__news-excerpt">{post.excerpt}</p> : null}
                <span className="apex-hm__news-more">
                    Read more <FiArrowRight aria-hidden />
                </span>
            </div>
        </Link>
    );
}

function HomeLoading() {
    return (
        <>
            <HomeBar />
            <div className="apex-hm__page" role="status" aria-live="polite" aria-label="Loading properties">
                <div className="apex-hm__head">
                    <div>
                        <h1 className="apex-hm__title">Loading properties</h1>
                        <p className="apex-hm__lede">Fetching your workspace…</p>
                    </div>
                </div>
                <div className="apex-hm__kpis" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="apex-hm__skeleton apex-hm__skeleton--kpi" />
                    ))}
                </div>
                <div className="apex-hm__layout" aria-hidden>
                    <div className="apex-hm__main">
                        <div className="apex-hm__grid">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="apex-hm__skeleton apex-hm__skeleton--card" />
                            ))}
                        </div>
                    </div>
                    <div className="apex-hm__rail">
                        <div className="apex-hm__skeleton apex-hm__skeleton--rail" />
                    </div>
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
    const [sortKey, setSortKey] = useState("name");
    const [sortDir, setSortDir] = useState("asc");
    const [query, setQuery] = useState("");
    const [platformFilter, setPlatformFilter] = useState("all");
    const [collapsed, setCollapsed] = useState({});
    const [groupBy, setGroupBy] = useState(true);
    const searchRef = useRef(null);
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
                if (!cancelled) setNewsPosts(posts.slice(0, 1));
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
        return sortDir === "asc" ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />;
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
                const byId = Object.fromEntries(all.map((p) => [String(p._id), p.name || String(p._id)]));
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

    // Ctrl+K or "/" jumps to the search field
    useEffect(() => {
        const onKeyDown = (e) => {
            const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName) || e.target?.isContentEditable;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

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

    const platformOptions = useMemo(() => {
        const counts = new Map();
        accessibleCustomers.forEach((c) => {
            const label = getCustomerPlatformLabel(c);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([label, count]) => ({ label, count }));
    }, [accessibleCustomers]);

    const filterActive = query.trim() !== "" || platformFilter !== "all";

    const visibleGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const match = (c) =>
            (platformFilter === "all" || getCustomerPlatformLabel(c) === platformFilter) &&
            (!q || (c.customerName || "").toLowerCase().includes(q));
        return groupKeys
            .map((parentId) => ({ parentId, items: groups[parentId].filter(match) }))
            .filter((g) => g.items.length > 0);
    }, [groups, groupKeys, query, platformFilter]);

    const visibleCount = visibleGroups.reduce((n, g) => n + g.items.length, 0);

    const groupLabelOf = (parentId) => (parentId !== "none" ? parentNames[parentId] || parentId : "Unassigned");
    const groupHrefOf = (parentId) => (parentId !== "none" ? `/parent-property/${parentId}/home` : null);

    const flatRows = useMemo(() => {
        if (groupBy) return [];
        const rows = visibleGroups.flatMap(({ parentId, items }) => items.map((customer) => ({ customer, parentId })));
        const label = (parentId) => (parentId !== "none" ? parentNames[parentId] || parentId : "Unassigned");
        const value = ({ customer, parentId }) =>
            sortKey === "platform"
                ? getCustomerPlatformLabel(customer).toLowerCase()
                : sortKey === "group"
                  ? label(parentId).toLowerCase()
                  : (customer.customerName || "").toLowerCase();
        rows.sort((a, b) => {
            const cmp = value(a).localeCompare(value(b), undefined, { sensitivity: "base" });
            return sortDir === "asc" ? cmp : -cmp;
        });
        return rows;
    }, [groupBy, visibleGroups, parentNames, sortKey, sortDir]);

    const ariaSort = (key) => (sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none");

    const clearFilters = () => {
        setQuery("");
        setPlatformFilter("all");
    };

    const onSearchKeyDown = (e) => {
        if (e.key === "Enter") {
            const first = visibleGroups[0]?.items[0];
            if (first) router.push(`/dashboard/${first._id}/performance-dashboard`);
        } else if (e.key === "Escape") {
            setQuery("");
            e.currentTarget.blur();
        }
    };

    if (loading) {
        return <HomeLoading />;
    }

    if (error) {
        return (
            <>
                <HomeBar />
                <div className="apex-hm__page">
                    <div className="apex-hm__error-card" role="alert">
                        <h1 className="apex-hm__error-title">Could not load properties</h1>
                        <p className="apex-hm__error-text">{error}</p>
                        <button type="button" onClick={() => window.location.reload()} className="apex-hm__btn apex-hm__btn--primary">
                            Retry
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <HomeBar>
                <div className="apex-hm__bar-actions">
                    {!user?.isExternal && (
                        <Link href="/profile" className="apex-hm__bar-link">
                            Account
                        </Link>
                    )}
                    {user?.isAdmin && !showCreate && (
                        <button type="button" onClick={() => setShowCreate(true)} className="apex-hm__btn apex-hm__btn--primary">
                            New property
                        </button>
                    )}
                    {showCreate && (
                        <button type="button" onClick={() => setShowCreate(false)} className="apex-hm__btn">
                            ← Back
                        </button>
                    )}
                </div>
            </HomeBar>

            <div className="apex-hm__page">
                {showCreate ? (
                    <>
                        <div className="apex-hm__head">
                            <div>
                                <h1 className="apex-hm__title">Create new property</h1>
                                <p className="apex-hm__lede">
                                    Add a customer and connect their platforms. Ad account IDs can be filled in now or later in config.
                                </p>
                            </div>
                        </div>
                        <div className="apex-home__create">
                            <div className="apex-home__panel apex-home__panel--create">
                                <CustomerCreateForm variant="apex-home" hideHeading onSuccess={handleCreated} />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="apex-hm__head">
                            <div>
                                <h1 className="apex-hm__title">Select a property</h1>
                                <p className="apex-hm__lede">Search by name, or open one from your pinned list.</p>
                            </div>
                            <label className="apex-hm__search">
                                <FiSearch aria-hidden />
                                <input
                                    ref={searchRef}
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={onSearchKeyDown}
                                    placeholder="Search properties"
                                    aria-label="Search properties. Press Enter to open the first match."
                                    autoComplete="off"
                                />
                                <span className="apex-hm__kbd" aria-hidden>
                                    <kbd>Ctrl</kbd>
                                    <kbd>K</kbd>
                                </span>
                            </label>
                        </div>

                        <div className="apex-hm__kpis">
                            <Kpi hero icon={FiGrid} label="Properties" value={accessibleCustomers.length} caption="You can open" />
                            <Kpi icon={FiFolder} label="Groups" value={groupKeys.length} caption={groupKeys.length === 1 ? "Parent group" : "Parent groups"} />
                            <Kpi icon={FiStar} label="Pinned" value={favoriteCustomers.length} caption="Quick access" />
                        </div>

                        <div className="apex-hm__layout">
                            <main className="apex-hm__main">
                                <section className="apex-hm__card" aria-labelledby="pinned-heading">
                                    <div className="apex-hm__card-head">
                                        <h2 id="pinned-heading" className="apex-hm__card-title">
                                            Pinned
                                        </h2>
                                        {favoriteCustomers.length > 0 && <span className="apex-hm__count">{favoriteCustomers.length}</span>}
                                    </div>
                                    {favoriteCustomers.length === 0 ? (
                                        <p className="apex-hm__empty">
                                            <FiStar aria-hidden /> Nothing pinned yet. Tap the star on a property to keep it here.
                                        </p>
                                    ) : (
                                        <ul className="apex-hm__grid">
                                            {favoriteCustomers.map((customer) => (
                                                <PropertyCard
                                                    key={customer._id}
                                                    customer={customer}
                                                    favorited
                                                    favoriteLoading={!!loadingFavorites[customer._id]}
                                                    isAdmin={!!user?.isAdmin}
                                                    onToggleFavorite={handleToggleFavorite}
                                                    onCopy={setCustomerToCopy}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="apex-hm__card" aria-labelledby="all-heading">
                                    <div className="apex-hm__card-head">
                                        <h2 id="all-heading" className="apex-hm__card-title">
                                            All properties
                                        </h2>
                                        <span className="apex-hm__count">{filterActive ? `${visibleCount} of ${accessibleCustomers.length}` : accessibleCustomers.length}</span>
                                        {filterActive && (
                                            <button type="button" className="apex-hm__link-btn" onClick={clearFilters}>
                                                Clear filters
                                            </button>
                                        )}
                                    </div>

                                    <div className="apex-hm__toolbar">
                                        <div className="apex-hm__chips" role="group" aria-label="Filter by platform">
                                            <button type="button" className={`apex-hm__chip${platformFilter === "all" ? " is-active" : ""}`} onClick={() => setPlatformFilter("all")} aria-pressed={platformFilter === "all"}>
                                                All
                                            </button>
                                            {platformOptions.map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    className={`apex-hm__chip${platformFilter === opt.label ? " is-active" : ""}`}
                                                    onClick={() => setPlatformFilter(platformFilter === opt.label ? "all" : opt.label)}
                                                    aria-pressed={platformFilter === opt.label}
                                                >
                                                    {opt.label}
                                                    <span>{opt.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <button type="button" className={`apex-hm__switch${groupBy ? " is-on" : ""}`} onClick={() => setGroupBy((v) => !v)} aria-pressed={groupBy}>
                                            <span className="apex-hm__switch-track" aria-hidden>
                                                <span className="apex-hm__switch-thumb" />
                                            </span>
                                            Group by parent
                                        </button>
                                    </div>

                                    {accessibleCustomers.length === 0 ? (
                                        <p className="apex-hm__empty">No properties available.</p>
                                    ) : visibleGroups.length === 0 ? (
                                        <p className="apex-hm__empty">
                                            No property matches this search.
                                            <button type="button" className="apex-hm__link-btn" onClick={clearFilters}>
                                                Clear filters
                                            </button>
                                        </p>
                                    ) : (
                                        <div className="apex-hm__table-wrap">
                                            <table className={`apex-hm__table${groupBy ? " is-grouped" : ""}`}>
                                                <thead>
                                                    <tr>
                                                        <th scope="col" aria-sort={ariaSort("name")}>
                                                            <button type="button" className="apex-hm__th-btn" onClick={() => handleSort("name")}>
                                                                Property
                                                                <SortIcon column="name" />
                                                            </button>
                                                        </th>
                                                        {!groupBy && (
                                                            <th scope="col" className="apex-hm__col-group" aria-sort={ariaSort("group")}>
                                                                <button type="button" className="apex-hm__th-btn" onClick={() => handleSort("group")}>
                                                                    Group
                                                                    <SortIcon column="group" />
                                                                </button>
                                                            </th>
                                                        )}
                                                        <th scope="col" className="apex-hm__col-platform" aria-sort={ariaSort("platform")}>
                                                            <button type="button" className="apex-hm__th-btn" onClick={() => handleSort("platform")}>
                                                                Platform
                                                                <SortIcon column="platform" />
                                                            </button>
                                                        </th>
                                                        <th scope="col" className="apex-hm__col-actions">
                                                            <span className="apex-hm__sr">Actions</span>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                {groupBy ? (
                                                    visibleGroups.map(({ parentId, items }) => {
                                                        const isCollapsed = !filterActive && !!collapsed[parentId];
                                                        const label = groupLabelOf(parentId);
                                                        const href = groupHrefOf(parentId);
                                                        return (
                                                            <tbody key={parentId}>
                                                                <tr className="apex-hm__group-row">
                                                                    <td colSpan={3}>
                                                                        <div className="apex-hm__group-head">
                                                                            <button
                                                                                type="button"
                                                                                className="apex-hm__group-toggle"
                                                                                aria-expanded={!isCollapsed}
                                                                                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${label}`}
                                                                                onClick={() => setCollapsed((prev) => ({ ...prev, [parentId]: !prev[parentId] }))}
                                                                                disabled={filterActive}
                                                                            >
                                                                                {isCollapsed ? <FiChevronDown aria-hidden /> : <FiChevronUp aria-hidden />}
                                                                            </button>
                                                                            {href ? (
                                                                                <Link href={href} className="apex-hm__group-name">
                                                                                    {label} <FiArrowRight aria-hidden />
                                                                                </Link>
                                                                            ) : (
                                                                                <span className="apex-hm__group-name apex-hm__group-name--plain">{label}</span>
                                                                            )}
                                                                            <span className="apex-hm__group-count">
                                                                                {items.length} {items.length === 1 ? "property" : "properties"}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {!isCollapsed &&
                                                                    items.map((customer) => (
                                                                        <PropertyRow
                                                                            key={customer._id}
                                                                            customer={customer}
                                                                            showGroup={false}
                                                                            favorited={isFavorited(customer._id)}
                                                                            favoriteLoading={!!loadingFavorites[customer._id]}
                                                                            isAdmin={!!user?.isAdmin}
                                                                            onToggleFavorite={handleToggleFavorite}
                                                                            onCopy={setCustomerToCopy}
                                                                        />
                                                                    ))}
                                                            </tbody>
                                                        );
                                                    })
                                                ) : (
                                                    <tbody>
                                                        {flatRows.map(({ customer, parentId }) => (
                                                            <PropertyRow
                                                                key={customer._id}
                                                                customer={customer}
                                                                groupLabel={groupLabelOf(parentId)}
                                                                groupHref={groupHrefOf(parentId)}
                                                                showGroup
                                                                favorited={isFavorited(customer._id)}
                                                                favoriteLoading={!!loadingFavorites[customer._id]}
                                                                isAdmin={!!user?.isAdmin}
                                                                onToggleFavorite={handleToggleFavorite}
                                                                onCopy={setCustomerToCopy}
                                                            />
                                                        ))}
                                                    </tbody>
                                                )}
                                            </table>
                                        </div>
                                    )}
                                </section>
                            </main>

                            <aside className="apex-hm__rail" aria-label="Shortcuts and news">
                                {!user?.isExternal && <JumpCard user={user} onLogout={handleLogout} />}
                                {showLatestNews && <NewsCard post={newsPosts[0] ?? null} loading={newsLoading} />}
                            </aside>
                        </div>
                    </>
                )}
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
