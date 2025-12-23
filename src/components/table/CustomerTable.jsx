"use client";

import Link from "next/link";
import React from "react";
import SearchInput from "@/components/search/SearchInput";
import { useState } from "react";
import FormButton from "../form/FormButton";
import { FiArrowRight } from "react-icons/fi";
import { FiLogOut } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";

export default function CustomerTable() {
    const [searchTerm, setSearchTerm] = useState("");
    const user = useUser();
    const { customers, loading, error } = useCustomers();

    const filteredCustomers = customers.filter((customer) =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleLogout = () => {
        console.log("Logging out...");
        signOut({ callbackUrl: "/login" });
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
                    <span className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold mb-4 text-black">Select a Property</h1>
                            <p className="text-gray-400 mb-6">Welcome back, <span className="text-gray-600">{user?.name || "User"}!</span> A list of properties available to you</p>
                        </div>
                        <div onClick={handleLogout}>
                            <FormButton buttonSize="small" >
                                Logout <FiLogOut />
                            </FormButton>
                        </div>
                    </span>

                    <SearchInput onSearch={setSearchTerm} placeholder="Search properties..." />

                    <div id="tableWrapper" className="border border-gray-200 mt-5 rounded-[0.5rem] overflow-hidden">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Property Name</th>
                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Platform</th>
                                    <th className="font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-xs px-5 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer._id} className="hover:bg-gray-50">
                                        <td className="border-b border-gray-50 px-5 py-3 text-black">{customer.customerName}</td>
                                        <td className="border-b border-gray-50 px-5 py-3 text-gray-500 text-sm">
                                            {customer.customerType}
                                        </td>
                                        <td className="border-b border-gray-50 px-5 py-3 text-gray-500 ">
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
                        {filteredCustomers.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                {searchTerm ? 'No customers found matching your search.' : 'No customers available.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}