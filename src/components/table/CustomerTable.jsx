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

function HomeNewsSpotlight({ post, loading }) {
    if (loading) {
        return (
            <div className="apex-hm__news apex-hm__news--loading" aria-hidden>
                <div className="apex-hm__news-media">
                    <div className="apex-hm__skeleton apex-hm__skeleton--fill" />
                </div>
                <div className="apex-hm__news-body">
                    <div className="apex-hm__skeleton apex-hm__skeleton--xs" />
                    <div className="apex-hm__skeleton apex-hm__skeleton--title" />
                    <div className="apex-hm__skeleton apex-hm__skeleton--copy" />
                </div>
            </div>
        );
    }

    if (!post) return null;

    return (
        <Link href={`/news/${post.slug}`} className="apex-hm__news">
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
                    <div className="apex-hm__news-fallback" aria-hidden />
                )}
                <span className="apex-hm__news-badge">New</span>
            </div>
            <div className="apex-hm__news-body">
                {post.publishedAt ? (
                    <time dateTime={post.publishedAt} className="apex-hm__news-date">
                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                    </time>
                ) : null}
                <h3 className="apex-hm__news-title">{post.title}</h3>
                {post.excerpt ? <p className="apex-hm__news-excerpt">{post.excerpt}</p> : null}
            </div>
        </Link>
    );
}

function HomeNavCard({ user, onLogout }) {
    return (
        <div className="apex-hm__nav-card">
            <p className="apex-hm__nav-title">Jump to</p>
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
        </div>
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
                    {badge && <span className="apex-hm__chip-badge">{badge}</span>}
                </span>
                <FiArrowRight className="apex-hm__nav-arrow" aria-hidden />
            </Link>
        </li>
    );
}

function PropertyCard({ customer, pinned, favorited, favoriteLoading, isAdmin, onToggleFavorite, onCopy }) {
    const label = getCustomerPlatformLabel(customer);
    const href = `/dashboard/${customer._id}/performance-dashboard`;
    return (
        <li className={`apex-hm__prop${pinned ? " apex-hm__prop--pinned" : ""}`}>
            <Link href={href} className="apex-hm__prop-main">
                <span className="apex-hm__prop-icon" aria-hidden>
                    <PlatformIcon type={customer.customerType} />
                </span>
                <span className="apex-hm__prop-text">
                    <span className="apex-hm__prop-name">{customer.customerName}</span>
                    <span className="apex-hm__prop-platform">{label}</span>
                </span>
            </Link>
            <div className="apex-hm__prop-actions">
                <button
                    type="button"
                    onClick={() => onToggleFavorite(customer._id)}
                    disabled={favoriteLoading}
                    title={favorited ? "Remove favorite" : "Add favorite"}
                    className={`apex-hm__icon-btn${favorited ? " is-on" : ""}`}
                    aria-label={favorited ? `Remove ${customer.customerName} from favorites` : `Add ${customer.customerName} to favorites`}
                    aria-pressed={favorited}
                >
                    <FiStar aria-hidden />
                </button>
                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => onCopy(customer)}
                        title="Copy settings"
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

function HomeLoading() {
    return (
        <>
            <HomeBar />
            <div className="apex-hm__hero apex-hm__hero--loading" role="status" aria-live="polite" aria-label="Loading properties">
                <div className="apex-hm__hero-copy">
                    <p className="apex-hm__eyebrow">Workspace</p>
                    <h1 className="apex-hm__title">Loading properties</h1>
                    <p className="apex-hm__lede">Fetching your workspace…</p>
                </div>
            </div>
            <div className="apex-hm__page" aria-hidden>
                <div className="apex-hm__layout">
                    <div className="apex-hm__main">
                        {[0, 1].map((i) => (
                            <div key={i} className="apex-hm__group">
                                <div className="apex-hm__skeleton apex-hm__skeleton--title" />
                                <div className="apex-hm__grid">
                                    {Array.from({ length: i === 0 ? 6 : 3 }).map((_, j) => (
                                        <div key={j} className="apex-hm__skeleton apex-hm__skeleton--card" />
                                    ))}
                                </div>
                            </div>
                        ))}
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

    const [query, setQuery] = useState("");
    const [platformFilter, setPlatformFilter] = useState("all");

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
                        <button type="button" onClick={() => window.location.reload()} className="apex-hm__btn apex-hm__btn--dark">
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
                        <button type="button" onClick={() => setShowCreate(true)} className="apex-hm__btn apex-hm__btn--dark">
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

            {showCreate ? (
                <div className="apex-hm__page">
                    <div className="apex-hm__create-head">
                        <p className="apex-hm__eyebrow apex-hm__eyebrow--light">Admin</p>
                        <h1 className="apex-hm__title apex-hm__title--light">Create new property</h1>
                        <p className="apex-hm__lede apex-hm__lede--light">
                            Add a customer and connect their platforms. Ad account IDs can be filled in now or later in config.
                        </p>
                    </div>
                    <div className="apex-home__create">
                        <div className="apex-home__panel apex-home__panel--create">
                            <CustomerCreateForm variant="apex-home" hideHeading onSuccess={handleCreated} />
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <section className="apex-hm__hero" aria-labelledby="home-heading">
                        <div className="apex-hm__hero-copy">
                            <p className="apex-hm__eyebrow">Workspace</p>
                            <h1 id="home-heading" className="apex-hm__title">
                                Select a property
                            </h1>
                            <p className="apex-hm__lede">Open a dashboard, or pin the properties you use most.</p>
                        </div>
                        <div className="apex-hm__hero-side">
                            <button type="button" className="apex-hm__command" onClick={openCmdk} aria-label="Search properties (Ctrl+K)">
                                <FiSearch aria-hidden />
                                <span>Search properties</span>
                                <span className="apex-hm__kbd">
                                    <kbd>Ctrl</kbd>
                                    <kbd>K</kbd>
                                </span>
                            </button>
                            <dl className="apex-hm__stats">
                                <div>
                                    <dt>Properties</dt>
                                    <dd>{accessibleCustomers.length}</dd>
                                </div>
                                <div>
                                    <dt>Groups</dt>
                                    <dd>{groupKeys.length}</dd>
                                </div>
                                <div>
                                    <dt>Pinned</dt>
                                    <dd>{favoriteCustomers.length}</dd>
                                </div>
                            </dl>
                        </div>
                    </section>

                    <div className="apex-hm__page">
                        <div className="apex-hm__layout">
                            <main className="apex-hm__main">
                                <section className="apex-hm__section" aria-labelledby="pinned-heading">
                                    <div className="apex-hm__section-head">
                                        <h2 id="pinned-heading" className="apex-hm__h2">
                                            Pinned
                                        </h2>
                                        {favoriteCustomers.length > 0 && <span className="apex-hm__count">{favoriteCustomers.length}</span>}
                                    </div>
                                    {favoriteCustomers.length === 0 ? (
                                        <p className="apex-hm__empty">
                                            <FiStar aria-hidden /> Nothing pinned yet. Use the star on any property below to keep it here.
                                        </p>
                                    ) : (
                                        <ul className="apex-hm__grid apex-hm__grid--pinned">
                                            {favoriteCustomers.map((customer) => (
                                                <PropertyCard
                                                    key={customer._id}
                                                    customer={customer}
                                                    pinned
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

                                <section className="apex-hm__section" aria-labelledby="all-heading">
                                    <div className="apex-hm__section-head">
                                        <h2 id="all-heading" className="apex-hm__h2">
                                            All properties
                                        </h2>
                                        <span className="apex-hm__count">{filterActive ? `${visibleCount} of ${accessibleCustomers.length}` : accessibleCustomers.length}</span>
                                    </div>

                                    <div className="apex-hm__toolbar">
                                        <label className="apex-hm__filter">
                                            <FiSearch aria-hidden />
                                            <input
                                                type="search"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Filter by name"
                                                aria-label="Filter properties by name"
                                            />
                                        </label>
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
                                        <div className="apex-hm__sort" role="group" aria-label="Sort properties">
                                            <button type="button" className={`apex-hm__sort-btn${sortKey === "name" ? " is-active" : ""}`} onClick={() => handleSort("name")} aria-pressed={sortKey === "name"}>
                                                Name
                                                <SortIcon column="name" />
                                            </button>
                                            <button type="button" className={`apex-hm__sort-btn${sortKey === "platform" ? " is-active" : ""}`} onClick={() => handleSort("platform")} aria-pressed={sortKey === "platform"}>
                                                Platform
                                                <SortIcon column="platform" />
                                            </button>
                                        </div>
                                    </div>

                                    {accessibleCustomers.length === 0 ? (
                                        <p className="apex-hm__empty">No properties available.</p>
                                    ) : visibleGroups.length === 0 ? (
                                        <p className="apex-hm__empty">
                                            No property matches this filter.
                                            <button
                                                type="button"
                                                className="apex-hm__link-btn"
                                                onClick={() => {
                                                    setQuery("");
                                                    setPlatformFilter("all");
                                                }}
                                            >
                                                Clear filter
                                            </button>
                                        </p>
                                    ) : (
                                        visibleGroups.map(({ parentId, items }) => (
                                            <div key={parentId} className="apex-hm__group">
                                                <div className="apex-hm__group-head">
                                                    {parentId !== "none" ? (
                                                        <Link href={`/parent-property/${parentId}/home`} className="apex-hm__group-name">
                                                            {parentNames[parentId] || parentId} <FiArrowRight aria-hidden />
                                                        </Link>
                                                    ) : (
                                                        <span className="apex-hm__group-name apex-hm__group-name--plain">Unassigned</span>
                                                    )}
                                                    <span className="apex-hm__group-count">
                                                        {items.length} {items.length === 1 ? "property" : "properties"}
                                                    </span>
                                                </div>
                                                <ul className="apex-hm__grid">
                                                    {items.map((customer) => (
                                                        <PropertyCard
                                                            key={customer._id}
                                                            customer={customer}
                                                            favorited={isFavorited(customer._id)}
                                                            favoriteLoading={!!loadingFavorites[customer._id]}
                                                            isAdmin={!!user?.isAdmin}
                                                            onToggleFavorite={handleToggleFavorite}
                                                            onCopy={setCustomerToCopy}
                                                        />
                                                    ))}
                                                </ul>
                                            </div>
                                        ))
                                    )}
                                </section>
                            </main>

                            <aside className="apex-hm__rail" aria-label="Shortcuts and news">
                                {!user?.isExternal && <HomeNavCard user={user} onLogout={handleLogout} />}
                                {showLatestNews && (
                                    <div className="apex-hm__news-wrap">
                                        <HomeNewsSpotlight post={newsPosts[0] ?? null} loading={newsLoading} />
                                        {!newsLoading && newsPosts[0] ? (
                                            <Link href="/news" className="apex-hm__news-more">
                                                All news <FiArrowRight aria-hidden />
                                            </Link>
                                        ) : null}
                                    </div>
                                )}
                            </aside>
                        </div>
                    </div>
                </>
            )}

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
