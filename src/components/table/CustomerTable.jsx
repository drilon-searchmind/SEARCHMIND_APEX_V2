"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import SearchInput from "@/components/search/SearchInput";
import FormButton from "../form/FormButton";
import { FiArrowRight, FiLogOut, FiUsers, FiUser, FiStar } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreateForm from "../form/CustomerCreateForm";

export default function CustomerTable() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [parentNames, setParentNames] = useState({});
    const [favoritedCustomers, setFavoritedCustomers] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState({});
    const user = useUser();
    const { customers, loading, error } = useCustomers(refreshKey);

    // Load user's favorited customers
    useEffect(() => {
        if (user?.favoritedCustomers) {
            const favoriteIds = user.favoritedCustomers.map(id => 
                typeof id === 'object' && id.$oid ? id.$oid : String(id)
            );
            setFavoritedCustomers(favoriteIds);
        }
    }, [user]);

    // Toggle favorite status
    const handleToggleFavorite = async (customerId) => {
        if (!user?.id) return;
        
        setLoadingFavorites(prev => ({ ...prev, [customerId]: true }));
        
        try {
            const response = await fetch(`/api/user/${user.id}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });

            if (!response.ok) throw new Error('Failed to toggle favorite');

            const data = await response.json();
            const favoriteIds = data.favoritedCustomers.map(id => 
                typeof id === 'object' && id.$oid ? id.$oid : String(id)
            );
            setFavoritedCustomers(favoriteIds);
        } catch (error) {
            console.error('Error toggling favorite:', error);
            alert('Failed to update favorite. Please try again.');
        } finally {
            setLoadingFavorites(prev => ({ ...prev, [customerId]: false }));
        }
    };

    // Check if customer is favorited
    const isFavorited = (customerId) => {
        return favoritedCustomers.includes(String(customerId));
    };

    // Dynamic access control: if user is external, only show shared customers; else show all
    let accessibleCustomers = customers;
    if (user?.isExternal) {
        const sharedCustomerIds = (user.sharedCustomers || []).map(
            id => typeof id === 'object' && id.$oid ? id.$oid : String(id)
        );
        accessibleCustomers = customers.filter(c => sharedCustomerIds.includes(String(c._id)));
    }

    // Group customers by parentCustomer
    const filteredCustomers = accessibleCustomers.filter((customer) =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping logic
    const groups = {};
    filteredCustomers.forEach((customer) => {
        const parent = customer.parentCustomer || "none";
        if (!groups[parent]) groups[parent] = [];
        groups[parent].push(customer);
    });

    // Fetch parent names for all parent IDs (optimized: only on customers change, with retry and caching)
    useEffect(() => {
        const parentIds = Array.from(new Set((accessibleCustomers || []).map(c => c.parentCustomer).filter(id => id && id !== "none")));
        if (parentIds.length === 0) return;
        let isMounted = true;
        const cache = { ...parentNames };

        // Helper: fetch with retry
        const fetchWithRetry = async (url, retries = 3, delay = 300) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url);
                    if (res.ok) return await res.json();
                } catch {}
                if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
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
        return () => { isMounted = false; };
    }, [customers]);

    const handleLogout = () => {
        signOut({ callbackUrl: "/login" });
    };

    const handleCreated = () => {
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center glassmorphism3">
                <div className="w-full max-w-4xl p-10 bg-white rounded-[1rem] shadow-xl">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold mb-4 text-black">Loading Properties...</h1>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 flex items-center justify-center glassmorphism3">
                <div className="w-full max-w-4xl p-10 bg-white rounded-[1rem] shadow-xl">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold mb-4 text-black">Error Loading Properties</h1>
                        <p className="text-red-500 mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center glassmorphism3">
            <div className="w-full max-w-6xl p-10 bg-white rounded-[1rem] shadow-xl">
                <div className="flex gap-6">
                    {/* Main table section */}
                    <div className="flex-1 overflow-x-auto max-h-[70vh]">
                        <span className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-2xl font-bold mb-4 text-black">{showCreate ? 'Create New Property' : 'Select a Property'}</h1>
                                {!showCreate && <p className="text-gray-400 mb-6">Welcome back, <span className="text-gray-600">{user?.name || "User"}!</span> A list of properties available to you</p>}

                                {showCreate && <p className="text-gray-400 mb-6">Welcome back, <span className="text-gray-600">{user?.name || "User"}!</span> Fill out the form to create a new property</p>}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                                <div
                                    className="flex items-center justify-center text-center shadow-none border border-gray-200 text-gray-500 bg-white hover:bg-white hover:text-[var(--color-primary-searchmind)] rounded-lg cursor-pointer text-xs px-4 py-2"
                                    onClick={() => setShowCreate((v) => !v)}
                                >
                                    {showCreate ? 'Back to List' : 'New Property'}
                                </div>
                                <span onClick={handleLogout} className="w-full">
                                    <FormButton buttonSize="small">
                                        Logout <FiLogOut />
                                    </FormButton>
                                </span>
                            </div>
                        </span>

                        {showCreate ? (
                            <div className="max-h-[70vh] overflow-y-auto">
                                <CustomerCreateForm onSuccess={handleCreated} />
                            </div>
                        ) : (
                            <>
                                <SearchInput onSearch={setSearchTerm} placeholder="Search properties..." />
                                <div id="tableWrapper" className="border border-gray-200 mt-5 rounded-[0.5rem] overflow-hidden">
                                    {Object.keys(groups).map((parentId, idx) => (
                                        <div key={parentId} className="mb-8">
                                            {parentId !== "none" && (
                                                <div className="bg-gray-100 px-5 py-2 font-semibold text-gray-700 rounded-t-[0.5rem] underline">
                                                    <Link className="flex items-center gap-2" href={`/parent-property/${parentId}/home`}>
                                                        <FiUsers /> View group property {parentNames[parentId] || parentId}
                                                    </Link>
                                                </div>
                                            )} 
                                            
                                            {parentId === "none" && (
                                                <div className="flex items-center gap-2 bg-gray-100 px-5 py-2 font-semibold text-gray-700 rounded-t-[0.5rem] underline">
                                                    <FiUser />Rest
                                                </div>
                                            )}
                                            <table className="min-w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-200">
                                                        <th className="font-medium text-gray-500 text-start text-theme-xs text-xs px-5 py-3">Property Name</th>
                                                        <th className="font-medium text-gray-500 text-start text-theme-xs text-xs px-5 py-3">Platform</th>
                                                        <th className="font-medium text-gray-500 text-center text-theme-xs text-xs px-5 py-3">Favorite</th>
                                                        <th className="font-medium text-gray-500 text-start text-theme-xs text-xs px-5 py-3">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groups[parentId].map((customer) => (
                                                        <tr key={customer._id} className="hover:bg-gray-50">
                                                            <td className="border-b border-gray-50 px-5 py-3 text-black text-sm">{customer.customerName}</td>
                                                            <td className="border-b border-gray-50 px-5 py-3 text-gray-500 text-sm">
                                                                {customer.customerType}
                                                            </td>
                                                            <td className="border-b border-gray-50 px-5 py-3 text-center">
                                                                <button
                                                                    onClick={() => handleToggleFavorite(customer._id)}
                                                                    className={`hover:scale-110 transition-transform ${loadingFavorites[customer._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    disabled={loadingFavorites[customer._id]}
                                                                    title={isFavorited(customer._id) ? "Remove from favorites" : "Add to favorites"}
                                                                >
                                                                    <FiStar 
                                                                        className={`text-lg ${isFavorited(customer._id) ? 'fill-[#1E2B2B] text-[#1E2B2B]' : 'text-gray-400'}`}
                                                                    />
                                                                </button>
                                                            </td>
                                                            <td className="border-b border-gray-50 px-5 py-3 text-gray-500 text-sm">
                                                                <Link href={`/dashboard/${customer._id}/performance-dashboard`} className="hover:underline text-sm">
                                                                    <FormButton buttonSize="small" borderType="outline">
                                                                        View Dashboard <FiArrowRight />
                                                                    </FormButton>
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    {filteredCustomers.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            {searchTerm ? 'No customers found matching your search.' : 'No customers available.'}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Favorites sidebar */}
                    {!showCreate && (
                        <div className="w-64 flex-shrink-0">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sticky top-0">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FiStar className="text-[#1E2B2B]" />
                                    Your Favorites
                                </h3>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {favoritedCustomers.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">No favorites yet</p>
                                    ) : (
                                        favoritedCustomers.map(favoriteId => {
                                            const customer = customers.find(c => String(c._id) === String(favoriteId));
                                            if (!customer) return null;
                                            return (
                                                <Link 
                                                    key={customer._id} 
                                                    href={`/dashboard/${customer._id}/performance-dashboard`}
                                                    className="block p-2 bg-white border border-gray-200 rounded hover:border-[#1E2B2B] hover:shadow-sm transition-all"
                                                >
                                                    <p className="text-xs font-medium text-gray-800 truncate">{customer.customerName}</p>
                                                    <p className="text-xs text-gray-400">{customer.customerType}</p>
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