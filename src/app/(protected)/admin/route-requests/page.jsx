"use client";

import React from "react";
import Link from "next/link";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import FormButton from "@/components/form/FormButton";
import { showToast } from "@/components/ui/ToastProvider";

const STATUS_FILTERS = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "denied", label: "Denied" },
    { key: "", label: "All" },
];

function formatDate(value) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return "—";
    }
}

function statusBadgeClass(status) {
    switch (status) {
        case "approved":
            return "bg-green-100 text-green-800";
        case "denied":
            return "bg-red-100 text-red-800";
        default:
            return "bg-amber-100 text-amber-900";
    }
}

export default function RouteRequestsAdminPage() {
    const [statusFilter, setStatusFilter] = React.useState("pending");
    const [requests, setRequests] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [reviewingId, setReviewingId] = React.useState(null);

    const loadRequests = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set("status", statusFilter);
            const res = await fetch(`/api/admin/route-access-requests?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load requests");
            setRequests(Array.isArray(data.requests) ? data.requests : []);
        } catch (err) {
            showToast({ type: "error", message: err.message || "Failed to load requests" });
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    React.useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleReview = async (id, action) => {
        setReviewingId(id);
        try {
            const res = await fetch(`/api/admin/route-access-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Review failed");
            showToast({
                type: "success",
                message: data.message || (action === "approve" ? "Approved" : "Denied"),
            });
            await loadRequests();
        } catch (err) {
            showToast({ type: "error", message: err.message || "Review failed" });
        } finally {
            setReviewingId(null);
        }
    };

    return (
        <div id="RouteRequestsAdminPage" className="w-full">
            <div className="flex items-start justify-between gap-4 mb-4">
                <DashboardHeading
                    title="MCP Route Access Requests"
                    label="Review Claude MCP proxy access requests"
                />
                <Link
                    href="/admin"
                    className="text-sm text-blue-700 hover:underline whitespace-nowrap mt-2"
                >
                    Back to Admin
                </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                    {STATUS_FILTERS.map((filter) => (
                        <button
                            key={filter.key || "all"}
                            type="button"
                            onClick={() => setStatusFilter(filter.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm border ${
                                statusFilter === filter.key
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    Approving a request grants <code className="text-xs">call_apex_api</code> access
                    to that route for the specific customer only. Default allowlisted routes do not
                    need approval.
                </p>

                {loading ? (
                    <p className="text-sm text-gray-500">Loading requests…</p>
                ) : requests.length === 0 ? (
                    <p className="text-sm text-gray-500">No route access requests found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-gray-600">
                                    <th className="py-2 pr-4 font-medium">Route</th>
                                    <th className="py-2 pr-4 font-medium">Customer</th>
                                    <th className="py-2 pr-4 font-medium">Reason</th>
                                    <th className="py-2 pr-4 font-medium">Requested</th>
                                    <th className="py-2 pr-4 font-medium">By</th>
                                    <th className="py-2 pr-4 font-medium">Status</th>
                                    <th className="py-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((row) => (
                                    <tr key={row.id} className="border-b border-gray-100 align-top">
                                        <td className="py-3 pr-4 font-mono text-xs">{row.route}</td>
                                        <td className="py-3 pr-4">
                                            <div className="font-medium">
                                                {row.customerName || "Unknown customer"}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono">
                                                {row.customerId}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-4 max-w-xs whitespace-pre-wrap">
                                            {row.reason || "—"}
                                        </td>
                                        <td className="py-3 pr-4 whitespace-nowrap">
                                            {formatDate(row.requestedAt)}
                                        </td>
                                        <td className="py-3 pr-4">{row.requestedBy || "—"}</td>
                                        <td className="py-3 pr-4">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}
                                            >
                                                {row.status}
                                            </span>
                                            {!row.canBeApproved &&
                                            row.status === "pending" &&
                                            !row.isDefaultAllowlisted ? (
                                                <div className="text-xs text-red-600 mt-1">
                                                    Route not implemented in APEX yet
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3">
                                            {row.status === "pending" ? (
                                                <div className="flex flex-wrap gap-2">
                                                    <FormButton
                                                        type="button"
                                                        buttonSize="small"
                                                        className="w-auto px-4"
                                                        disabled={
                                                            reviewingId === row.id ||
                                                            !row.canBeApproved
                                                        }
                                                        onClick={() => handleReview(row.id, "approve")}
                                                    >
                                                        Approve
                                                    </FormButton>
                                                    <FormButton
                                                        type="button"
                                                        buttonSize="small"
                                                        borderType="outline"
                                                        className="w-auto px-4"
                                                        disabled={reviewingId === row.id}
                                                        onClick={() => handleReview(row.id, "deny")}
                                                    >
                                                        Deny
                                                    </FormButton>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
