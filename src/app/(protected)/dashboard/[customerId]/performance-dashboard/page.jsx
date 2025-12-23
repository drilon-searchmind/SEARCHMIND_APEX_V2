
"use client"


import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiDollarSign, FiTrendingUp, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck } from "react-icons/fi";

export default function PerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);

    // Dummy data for now
    const metrics = [
        { label: "Revenue (inc vat)", value: "$20,000", change: 10, changeType: "up", icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Gross Profit", value: "$8,000", change: 5, changeType: "up", icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Orders", value: "1,200", change: -2, changeType: "down", icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Cost (Adspend)", value: "$5,000", change: 3, changeType: "up", icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "ROAS (inc vat)", value: "4.0", change: 1, changeType: "up", icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "POAS (inc vat)", value: "1.6", change: 0, changeType: undefined, icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "AOV", value: "$16.67", change: 0, changeType: undefined, icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "CAC", value: "$4.17", change: -1, changeType: "down", icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
    ];

    return (
        <div className="w-full">
            {/* Top Card */}
            <DashboardHeading
                title="Performance Dashboard"
                label={customer ? customer.customerName : ""}
                right={<DateRangePicker />}
            />

            {/* Metrics Cards Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full">
                {metrics.map((metric, idx) => (
                    <MetricCard key={idx} {...metric} />
                ))}
            </div>
        </div>
    );
}