"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import SearchInput from "@/components/search/SearchInput";
import { FiArrowRight, FiLogOut, FiUsers, FiUser, FiStar, FiServer } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreateForm from "../form/CustomerCreateForm";
import { SiShopify, SiWordpress } from "react-icons/si";

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

export default function CustomerTable() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [parentNames, setParentNames] = useState({});
    const [favoritedCustomers, setFavoritedCustomers] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState({});
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
            )
        );
        if (parentIds.length === 0) return;
        let isMounted = true;
        const cache = { ...parentNames };
        const fetchWithRetry = async (url, retries = 3, delay = 300) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url);
                    if (res.ok) return await res.json();
                } catch {}
                if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
            }
            return null;
        };
        (async () => {
            for (const parentId of parentIds) {
                if (!cache[parentId]) {
                    const data = await fetchWithRetry(`/api/parent-customers/${parentId}`);
                    cache[parentId] = data?.name || parentId;
                }
            }
            if (isMounted) setParentNames(cache);
        })();
        return () => {
            isMounted = false;
        };
    }, [customers]);

    const handleLogout = () => signOut({ callbackUrl: "/login" });
    const handleCreated = () => {
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
    };

    const PlatformIcon = ({ type }) => {
        const iconClass = "w-4 h-4 shrink-0";
        if (type === "Shopify") return <SiShopify className={iconClass} />;
        if (type === "WooCommerce") return <SiWordpress className={iconClass} />;
        return <FiServer className={iconClass} />;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center glassmorphism2">
                <div className={`w-full max-w-4xl p-8 bg-white border border-gray-200 rounded-xl ${FONT}`}>
                    <div className="text-center">
                        <h1 className="font-bold text-gray-900 dark:text-gray-100">Loading Properties...</h1>
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
                        <h1 className="font-bold text-gray-900 dark:text-gray-100">Error Loading Properties</h1>
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
        <div className="fixed inset-0 flex items-center justify-center glassmorphism2 p-4">
            <div className={`w-full max-w-7xl h-[90vh] flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden ${FONT}`}>
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
                                                        className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300 hover:text-[var(--color-primary-searchmind)] transition-colors"
                                                    >
                                                        <FiUsers />
                                                        {parentNames[parentId] || parentId}
                                                    </Link>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                                                        <FiUser /> Rest
                                                    </span>
                                                )}
                                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                                    — {groups[parentId].length} {groups[parentId].length === 1 ? "property" : "properties"}
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full">
                                                    <thead>
                                                        <tr className="border-b border-gray-200 dark:border-[#232a2f]">
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Property</th>
                                                            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Platform</th>
                                                            <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 w-14">Favorite</th>
                                                            <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groups[parentId].map((customer) => (
                                                            <tr
                                                                key={customer._id}
                                                                className="border-b border-gray-100 dark:border-[#232a2f] last:border-b-0 hover:bg-gray-50 dark:hover:bg-[#232a2f] transition-colors"
                                                            >
                                                                <td className="px-4 py-3 align-middle">
                                                                    <div className="flex items-center gap-3">
                                                                        <span
                                                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-medium ${getAvatarColor(customer.customerName)}`}
                                                                        >
                                                                            {(customer.customerName || "?").charAt(0).toUpperCase()}
                                                                        </span>
                                                                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                                            {customer.customerName}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle">
                                                                    <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                                        <PlatformIcon type={customer.customerType} />
                                                                        {customer.customerType}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-center">
                                                                    <button
                                                                        onClick={() => handleToggleFavorite(customer._id)}
                                                                        disabled={loadingFavorites[customer._id]}
                                                                        title={isFavorited(customer._id) ? "Remove from favorites" : "Add to favorites"}
                                                                        className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#2c353b] transition-colors ${loadingFavorites[customer._id] ? "opacity-50 cursor-not-allowed" : ""}`}
                                                                    >
                                                                        <FiStar
                                                                            className={`w-4 h-4 ${isFavorited(customer._id) ? "fill-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]" : "text-gray-400"}`}
                                                                        />
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-right">
                                                                    <Link
                                                                        href={`/dashboard/${customer._id}/performance-dashboard`}
                                                                        className="inline-flex items-center gap-1 font-medium text-[var(--color-primary-searchmind)] hover:underline"
                                                                    >
                                                                        View <FiArrowRight className="w-4 h-4" />
                                                                    </Link>
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
                        <div className="w-64 flex-shrink-0 flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(true)}
                                    className="w-full py-2.5 px-3 rounded-lg bg-[var(--color-primary-searchmind)] text-white font-medium hover:bg-[var(--color-primary-searchmind-hover)] transition-colors flex items-center justify-center gap-2"
                                >
                                    New Property
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-2.5 px-3 rounded-lg border border-gray-200 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiLogOut /> Logout
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-xl bg-gray-50 p-3 overflow-hidden">
                                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 shrink-0">
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
                                                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{customer.customerName}</p>
                                                        <p className="text-gray-500 dark:text-gray-400 truncate">{customer.customerType}</p>
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
        </div>
    );
}
