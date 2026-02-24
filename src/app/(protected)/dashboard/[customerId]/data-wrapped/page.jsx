"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DataWrappedModal from "./components/DataWrappedModal";
import { FiGift } from "react-icons/fi";

export default function DataWrappedPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const [showModal, setShowModal] = useState(false);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Data Wrapped"
                label={customer?.customerName || ""}
                showAnalyzeWithAi={false}
            />

            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white border border-gray-200 rounded-xl p-8">
                <div className="text-center max-w-lg">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary-searchmind)]/10 mb-6">
                        <FiGift className="text-4xl text-[var(--color-primary-searchmind)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Your Annual Ecommerce Wrapped
                    </h2>
                    <p className="text-gray-500 mb-8">
                        A personalized summary of your store&apos;s performance
                        this year — revenue, orders, ROAS, and more.
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 rounded-xl font-semibold text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] transition-colors flex items-center gap-2 mx-auto"
                    >
                        <FiGift className="text-lg" />
                        View Your Wrapped
                    </button>
                </div>
            </div>

            {showModal && (
                <DataWrappedModal
                    onClose={() => setShowModal(false)}
                    customerId={params.customerId}
                    customerName={customer?.customerName}
                />
            )}
        </div>
    );
}
