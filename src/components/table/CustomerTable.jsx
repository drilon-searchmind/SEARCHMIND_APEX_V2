"use client";

import Link from "next/link";
import React from "react";
import SearchInput from "@/components/search/SearchInput";
import { useState } from "react";
import dummyCustomers from "@/app/api/dummyCustomers.json";
import FormButton from "../form/FormButton";
import { FiArrowRight } from "react-icons/fi";
import { FiLogOut } from "react-icons/fi";

export default function CustomerTable({ customers }) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredCustomers = dummyCustomers.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 flex items-center justify-center glassmorphism3">
            <div className="w-full max-w-4xl p-10 bg-white rounded-[1rem] shadow-xl">
                <div className="overflow-x-auto max-h-[70vh]">
                    <span className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold mb-4 text-black">Select a Property</h1>
                            <p class="text-gray-400 mb-6">Welcome back, <span className="text-gray-600">USER!</span> A list of properties available to you</p>
                        </div>
                        <div>
                            <FormButton buttonSize="small">
                                Logout <FiLogOut />
                            </FormButton>
                        </div>
                    </span>

                    <SearchInput onSearch={setSearchTerm} />

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
                                {filteredCustomers.map((customer, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="border-b border-gray-50 px-5 py-3 text-black">{customer.name}</td>
                                        <td className="border-b border-gray-50 px-5 py-3 text-gray-500 text-sm">
                                            {customer.platform}
                                        </td>
                                        <td className="border-b border-gray-50 px-5 py-3 text-gray-500 ">
                                            <Link href={`/dashboard/:CUSTOMER_ID`} className="hover:underline text-sm">
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
                </div>
            </div>
        </div>
    );
}