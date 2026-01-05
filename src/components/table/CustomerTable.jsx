"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import SearchInput from "@/components/search/SearchInput";
import FormButton from "../form/FormButton";
import { FiArrowRight, FiLogOut, FiUsers, FiUser } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreateForm from "../form/CustomerCreateForm";

export default function CustomerTable() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [parentNames, setParentNames] = useState({});
    const user = useUser();
    const { customers, loading, error } = useCustomers(refreshKey);

    // Group customers by parentCustomer
    const filteredCustomers = customers.filter((customer) =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping logic
    const groups = {};
    filteredCustomers.forEach((customer) => {
        const parent = customer.parentCustomer || "none";
        if (!groups[parent]) groups[parent] = [];
        groups[parent].push(customer);
    });

    // Fetch parent names for all parent IDs
    useEffect(() => {
        const parentIds = Object.keys(groups).filter((id) => id !== "none");
        if (parentIds.length === 0) return;
        let isMounted = true;
        Promise.all(
            parentIds.map((parentId) =>
                fetch(`/api/parent-customers/${parentId}`)
                    .then((res) => res.ok ? res.json() : null)
                    .then((data) => ({ parentId, name: data?.name || parentId }))
                    .catch(() => ({ parentId, name: parentId }))
            )
        ).then((results) => {
            if (isMounted) {
                const names = {};
                results.forEach(({ parentId, name }) => {
                    names[parentId] = name;
                });
                setParentNames(names);
            }
        });
        return () => { isMounted = false; };
    }, [customers, searchTerm]);

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
            <div className="w-full max-w-4xl p-10 bg-white rounded-[1rem] shadow-xl">
                <div className="overflow-x-auto max-h-[70vh]">
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
                                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Property Name</th>
                                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Platform</th>
                                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups[parentId].map((customer) => (
                                                    <tr key={customer._id} className="hover:bg-gray-50">
                                                        <td className="border-b border-gray-50 px-5 py-3 text-black text-sm">{customer.customerName}</td>
                                                        <td className="border-b border-gray-50 px-5 py-3 text-gray-500 text-sm">
                                                            {customer.customerType}
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
            </div>
        </div>
    );
}