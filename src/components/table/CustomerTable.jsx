"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import SearchInput from "@/components/search/SearchInput";
import { FiArrowRight, FiLogOut, FiUsers, FiUser, FiStar, FiServer, FiBookOpen, FiFileText, FiBell, FiCopy, FiX } from "react-icons/fi";
import { LuRadar } from "react-icons/lu";
import { RiToolsFill } from "react-icons/ri";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreateForm from "../form/CustomerCreateForm";
import { buildCustomerCreateFormStateFromCustomer } from "@/lib/customerCreateFormState";
import { getCustomerPlatformLabel } from "@/lib/customerPlatformDisplay";
import { SiShopify, SiWordpress, SiMagento } from "react-icons/si";

const FONT = "text-xs";
const AVATAR_COLORS = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-[var(--color-primary-searchmind)]",
    "bg-amber-500",
    "bg-rose-500",
];

function getAvatarColor(str) {
    const code = (str || " ").charCodeAt(0);
    return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function CustomerTable({ showLatestNews = true }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [customerToCopy, setCustomerToCopy] = useState(null);
    const [parentNames, setParentNames] = useState({});
    const [favoritedCustomers, setFavoritedCustomers] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState({});
    const [newsPosts, setNewsPosts] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const user = useUser();
    const { customers, loading, error } = useCustomers(refreshKey);

    useEffect(() => {
        if (user?.favoritedCustomers) {
            const favoriteIds = user.favoritedCustomers.map(id =>
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
                if (!cancelled) setNewsPosts(posts.slice(0, 5));
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
            const favoriteIds = data.favoritedCustomers.map(id =>
                typeof id === "object" && id.$oid ? id.$oid : String(id)
            );
            setFavoritedCustomers(favoriteIds);
        } catch (error) {
            console.error("Error toggling favorite:", error);
            alert("Failed to update favorite. Please try again.");
        } finally {
            setLoadingFavorites((prev) => ({ ...prev, [customerId]: false }));
        }
    };

    const isFavorited = (customerId) => favoritedCustomers.includes(String(customerId));

    let accessibleCustomers = customers;
    if (user?.isExternal) {
        const sharedCustomerIds = (user.sharedCustomers || []).map(
            (id) => (typeof id === "object" && id.$oid ? id.$oid : String(id))
        );
        accessibleCustomers = customers.filter((c) => sharedCustomerIds.includes(String(c._id)));
    }

    const filteredCustomers = accessibleCustomers.filter((customer) =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups = {};
    filteredCustomers.forEach((customer) => {
        const parent = customer.parentCustomer || "none";
        if (!groups[parent]) groups[parent] = [];
        groups[parent].push(customer);
    });

    useEffect(() => {
        const parentIds = Array.from(
            new Set(
                (accessibleCustomers || [])
                    .map((c) => c.parentCustomer)
                    .filter((id) => id && id !== "none")
                    .map((id) => String(id))
            )
        );
        if (parentIds.length === 0) {
            setParentNames({});
            return undefined;
        }
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
                if (!cancelled) setParentNames(Object.fromEntries(parentIds.map((id) => [id, id])));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessibleCustomers]);

    const handleLogout = () => signOut({ callbackUrl: "/login" });
    const handleCreated = () => {
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
    };

    const PlatformIcon = ({ type }) => {
        const iconClass = "w-4 h-4 shrink-0";
        if (type === "Shopify") return <SiShopify className={iconClass} />;
        if (type === "WooCommerce") return <SiWordpress className={iconClass} />;
        if (type === "Magento") return <SiMagento className={iconClass} />;
        return <FiServer className={iconClass} />;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center glassmorphism2">
                <div className={`w-full max-w-4xl p-8 bg-white border border-gray-200 rounded-xl ${FONT}`}>
                    <div className="text-center">
                        <h1 className="font-bold text-gray-900">Loading Properties...</h1>
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--color-primary-searchmind)] border-t-transparent mx-auto mt-4" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 flex items-center justify-center glassmorphism2">
                <div className={`w-full max-w-4xl p-8 bg-white border border-gray-200 rounded-xl ${FONT}`}>
                    <div className="text-center">
                        <h1 className="font-bold text-gray-900">Error Loading Properties</h1>
                        <p className="text-red-500 mt-2 mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[var(--color-primary-searchmind)] text-white rounded-lg hover:bg-[var(--color-primary-searchmind-hover)] transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center glassmorphism2 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 px-4 md:px-10 lg:px-20 xl:px-40 py-4 md:py-20">
            <div className={`col-span-10 w-full h-full flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden ${FONT}`}>
                <div className="flex flex-1 min-h-0 gap-4 p-4 md:p-6">
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        {showCreate ? (
                            <div className="flex-1 overflow-y-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <h1 className="font-bold text-[var(--color-primary-searchmind)]">Create New Property</h1>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(false)}
                                        className="text-gray-500 hover:text-[var(--color-primary-searchmind)] transition-colors"
                                    >
                                        ← Back to List
                                    </button>
                                </div>
                                <CustomerCreateForm onSuccess={handleCreated} />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
                                    <h1 className="font-bold text-[var(--color-primary-searchmind)] text-lg">Select a Property</h1>
                                    <div className="w-full sm:w-56 shrink-0">
                                        <SearchInput onSearch={setSearchTerm} placeholder="Search properties..." />
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                                    {Object.keys(groups).map((parentId) => (
                                        <div
                                            key={parentId}
                                            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                                        >
                                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center">
                                                {parentId !== "none" ? (
                                                    <Link
                                                        href={`/parent-property/${parentId}/home`}
                                                        className="inline-flex items-center gap-2 font-medium text-gray-700 hover:text-[var(--color-primary-searchmind)] transition-colors"
                                                    >
                                                        <FiUsers />
                                                        {parentNames[parentId] || parentId}
                                                    </Link>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 font-medium text-gray-700">
                                                        <FiUser /> Rest
                                                    </span>
                                                )}
                                                <span className="text-gray-500 ml-2">
                                                    — {groups[parentId].length} {groups[parentId].length === 1 ? "property" : "properties"}
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full table-fixed">
                                                    <colgroup>
                                                        <col className="w-[40%]" />
                                                        <col className="w-[25%]" />
                                                        <col className="w-[80px]" />
                                                        <col className="w-[160px]" />
                                                    </colgroup>
                                                    <thead>
                                                        <tr className="border-b border-gray-200">
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Property</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Platform</th>
                                                            <th className="px-4 py-3 text-center font-medium text-gray-500">Favorite</th>
                                                            <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groups[parentId].map((customer) => (
                                                            <tr
                                                                key={customer._id}
                                                                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <td className="px-4 py-3 align-middle text-left">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <span
                                                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-medium ${getAvatarColor(customer.customerName)}`}
                                                                        >
                                                                            {(customer.customerName || "?").charAt(0).toUpperCase()}
                                                                        </span>
                                                                        <span className="font-medium text-gray-900 truncate">
                                                                            {customer.customerName}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-left">
                                                                    <span className="inline-flex items-center gap-2 text-gray-600">
                                                                        <PlatformIcon type={customer.customerType} />
                                                                        {getCustomerPlatformLabel(customer)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle">
                                                                    <div className="flex justify-center items-center">
                                                                        <button
                                                                            onClick={() => handleToggleFavorite(customer._id)}
                                                                            disabled={loadingFavorites[customer._id]}
                                                                            title={isFavorited(customer._id) ? "Remove from favorites" : "Add to favorites"}
                                                                            className={`p-1.5 rounded-full hover:bg-gray-200 transition-colors ${loadingFavorites[customer._id] ? "opacity-50 cursor-not-allowed" : ""}`}
                                                                        >
                                                                            <FiStar
                                                                                className={`w-4 h-4 ${isFavorited(customer._id) ? "fill-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]" : "text-gray-400"}`}
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-right">
                                                                    <div className="flex justify-end items-center gap-2 flex-wrap">
                                                                        {user?.isAdmin && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setCustomerToCopy(customer)}
                                                                                title="Copy settings into new property"
                                                                                className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[var(--color-primary-searchmind)] transition-colors"
                                                                            >
                                                                                <FiCopy className="w-3.5 h-3.5" />
                                                                                Copy
                                                                            </button>
                                                                        )}
                                                                        <Link
                                                                            href={`/dashboard/${customer._id}/performance-dashboard`}
                                                                            className="inline-flex items-center gap-1 font-medium text-[var(--color-primary-searchmind)] hover:underline"
                                                                        >
                                                                            View <FiArrowRight className="w-4 h-4" />
                                                                        </Link>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredCustomers.length === 0 && (
                                        <div className="flex items-center justify-center py-16 text-gray-500">
                                            {searchTerm ? "No properties match your search." : "No properties available."}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {!showCreate && (
                        <div className="w-72 xl:w-80 shrink-0 flex flex-col gap-4 min-h-0">
                            <div className="flex flex-col gap-2 shrink-0 mt-2">
                                {user?.isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(true)}
                                        className="w-full py-2.5 px-3 rounded-lg bg-[var(--color-primary-searchmind)] text-white font-medium hover:bg-[var(--color-primary-searchmind-hover)] transition-colors flex items-center justify-center gap-2"
                                    >
                                        New Property
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 min-h-0 h-full flex flex-col border border-gray-200 rounded-xl bg-gray-50 p-3 overflow-hidden">
                                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 shrink-0">
                                    <FiStar className="text-[var(--color-primary-searchmind)]" />
                                    Your Favorites
                                </h3>
                                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                                    {favoritedCustomers.length === 0 ? (
                                        <p className="text-gray-400 italic">No favorites yet</p>
                                    ) : (
                                        favoritedCustomers.map((favoriteId) => {
                                            const customer = customers.find((c) => String(c._id) === String(favoriteId));
                                            if (!customer) return null;
                                            return (
                                                <Link
                                                    key={customer._id}
                                                    href={`/dashboard/${customer._id}/performance-dashboard`}
                                                    className="flex items-center gap-2 p-2.5 bg-white border border-gray-200  rounded-lg hover:border-[var(--color-primary-searchmind)] transition-all"
                                                >
                                                    <span
                                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white font-medium ${getAvatarColor(customer.customerName)}`}
                                                    >
                                                        {(customer.customerName || "?").charAt(0).toUpperCase()}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-gray-800 truncate">{customer.customerName}</p>
                                                        <p className="text-gray-500 truncate">{getCustomerPlatformLabel(customer)}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="col-span-2 w-full h-full flex flex-col gap-4 min-h-0">
                {!user?.isExternal && (
                    <section
                        className="shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl overflow-hidden shadow-none"
                        aria-labelledby="customer-table-quick-nav-heading"
                    >
                        <div className="p-4 border-b border-gray-100 shrink-0">
                            <h2
                                id="customer-table-quick-nav-heading"
                                className="text-sm font-semibold text-[var(--color-primary-searchmind)]"
                            >
                                Quick links
                            </h2>
                        </div>
                        <nav className="p-2" aria-label="App menu">
                            <ul className="flex flex-col gap-0.5">
                                <li>
                                    <Link
                                        href="/profile"
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                        <FiUser className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                        My Account
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/lib/guides"
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                        <FiBookOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                        Guides
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/news"
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                        <FiFileText className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                        News
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/notifications"
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                        <FiBell className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                        Notifications
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/our-tools"
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                        <RiToolsFill className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                        Our Tools
                                    </Link>
                                </li>
                                {canAccessApexRadar(user) && (
                                    <li>
                                        <Link
                                            href="/apex-radar"
                                            className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                        >
                                            <LuRadar className="h-3.5 w-3.5 text-[var(--color-primary-searchmind)] shrink-0" aria-hidden />
                                            <span className="flex items-center gap-1.5 flex-wrap">
                                                Apex Radar
                                                <span className="text-[0.6rem] font-semibold text-gray-600 bg-gray-200 rounded px-1.5 py-0.5">
                                                    WIP
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                )}
                            </ul>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full py-2.5 px-3 text-xs mt-5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <FiLogOut /> Logout
                            </button>
                        </nav>
                    </section>
                )}

                {showLatestNews && (
                    <section
                        className="flex-1 min-h-0 flex flex-col border border-gray-200 bg-gray-100 rounded-xl overflow-hidden min-h-[200px]"
                        aria-labelledby="customer-table-latest-news-heading"
                    >
                        <div className="p-4 border-b border-gray-200 shrink-0">
                            <h2
                                id="customer-table-latest-news-heading"
                                className="text-sm font-semibold text-[var(--color-primary-searchmind)]"
                            >
                                Latest news
                            </h2>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4">
                            {newsLoading ? (
                                <p className="text-xs text-gray-500 py-2">Loading…</p>
                            ) : newsPosts.length === 0 ? (
                                <p className="text-xs text-gray-500 py-2">No news yet.</p>
                            ) : (
                                <ul className="space-y-0 divide-y divide-gray-200">
                                    {newsPosts.map((post) => (
                                        <li key={post.slug || post._id} className="py-2.5 first:pt-0">
                                            <Link
                                                href={`/news/${post.slug}`}
                                                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] rounded-md -m-1 p-1"
                                            >
                                                <span className="text-xs font-semibold text-gray-900 group-hover:text-[var(--color-primary-searchmind)] line-clamp-2">
                                                    {post.title}
                                                </span>
                                                {post.excerpt ? (
                                                    <p className="text-[0.65rem] text-gray-600 mt-1 line-clamp-2">{post.excerpt}</p>
                                                ) : null}
                                                {post.publishedAt ? (
                                                    <time
                                                        dateTime={post.publishedAt}
                                                        className="text-[0.65rem] text-gray-400 mt-1 block"
                                                    >
                                                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        })}
                                                    </time>
                                                ) : null}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="px-3 py-2 border-t border-gray-100 shrink-0">
                            <Link
                                href="/news"
                                className="block w-full text-center text-xs font-semibold text-[var(--color-primary-searchmind)] py-1.5 rounded-lg hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors"
                            >
                                Show all
                            </Link>
                        </div>
                    </section>
                )}
            </div>

            {customerToCopy && user?.isAdmin ? (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="customer-copy-modal-title"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        aria-label="Close dialog"
                        onClick={() => setCustomerToCopy(null)}
                    />
                    <div
                        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h2
                                id="customer-copy-modal-title"
                                className="text-base md:text-lg font-bold text-[var(--color-primary-searchmind)] pr-2"
                            >
                                New property from copy
                            </h2>
                            <button
                                type="button"
                                onClick={() => setCustomerToCopy(null)}
                                className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                                aria-label="Close"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Settings match <span className="font-medium text-gray-700">{customerToCopy.customerName}</span>{" "}
                            (same fields as &quot;Create new customer&quot;). Change the name and details, then create.
                        </p>
                        <CustomerCreateForm
                            key={String(customerToCopy._id)}
                            initialValues={buildCustomerCreateFormStateFromCustomer(customerToCopy)}
                            heading="Create New Customer"
                            submitLabel="Create Customer"
                            submittingLabel="Creating..."
                            onSuccess={() => {
                                setCustomerToCopy(null);
                                setRefreshKey((k) => k + 1);
                            }}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
