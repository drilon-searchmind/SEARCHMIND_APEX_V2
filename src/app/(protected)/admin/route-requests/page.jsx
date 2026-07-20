"use client";

import React from "react";
import Link from "next/link";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";
import "../admin.css";

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
            return "apex-admin-badge--ok";
        case "denied":
            return "apex-admin-badge--error";
        default:
            return "apex-admin-badge--warn";
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
        <div id="RouteRequestsAdminPage" className="apex-perf w-full apex-admin-stack">
            <div className="apex-admin-page-head">
                <DashboardHeading
                    variant="cobalt"
                    showRunAudit={false}
                    title="MCP Route Access Requests"
                    label="Review Claude MCP proxy access requests"
                />
                <Link href="/admin" className="apex-admin-back-link mt-2">
                    Back to Admin
                </Link>
            </div>

            <div className="apex-admin-panel">
                <div className="p-4 sm:p-6">
                    <div className="apex-admin-filters">
                        {STATUS_FILTERS.map((filter) => (
                            <button
                                key={filter.key || "all"}
                                type="button"
                                onClick={() => setStatusFilter(filter.key)}
                                className={`apex-admin-filter${statusFilter === filter.key ? " is-active" : ""}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <p className="apex-admin-section__subtitle">
                        Approving a request grants <code>call_apex_api</code> access to that route
                        for the specific customer only. Default allowlisted routes do not need
                        approval.
                    </p>

                    {loading ? (
                        <CobaltLoader variant="block" title="Loading route requests" />
                    ) : requests.length === 0 ? (
                        <p className="apex-admin-empty">No route access requests found.</p>
                    ) : (
                        <div className="apex-admin-table-wrap">
                            <table className="apex-admin-table">
                                <thead>
                                    <tr>
                                        <th>Route</th>
                                        <th>Customer</th>
                                        <th>Reason</th>
                                        <th>Requested</th>
                                        <th>By</th>
                                        <th>Status</th>
                                        <th className="is-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <span className="apex-admin-cell-mono">{row.route}</span>
                                            </td>
                                            <td>
                                                <div>{row.customerName || "Unknown customer"}</div>
                                                <div className="apex-admin-cell-mono is-empty">
                                                    {row.customerId}
                                                </div>
                                            </td>
                                            <td style={{ maxWidth: "18rem" }}>
                                                <span className="whitespace-pre-wrap">
                                                    {row.reason || "—"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap">
                                                {formatDate(row.requestedAt)}
                                            </td>
                                            <td>{row.requestedBy || "—"}</td>
                                            <td>
                                                <span
                                                    className={`apex-admin-badge ${statusBadgeClass(row.status)}`}
                                                >
                                                    {row.status}
                                                </span>
                                                {!row.canBeApproved &&
                                                row.status === "pending" &&
                                                !row.isDefaultAllowlisted ? (
                                                    <div className="apex-admin-field-hint text-[var(--color-error,oklch(50%_0.15_25))]">
                                                        Route not implemented in APEX yet
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="is-right">
                                                {row.status === "pending" ? (
                                                    <div className="apex-admin-table-actions">
                                                        <button
                                                            type="button"
                                                            className="apex-perf-btn apex-perf-btn--primary apex-admin-btn-sm"
                                                            disabled={
                                                                reviewingId === row.id ||
                                                                !row.canBeApproved
                                                            }
                                                            onClick={() =>
                                                                handleReview(row.id, "approve")
                                                            }
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm"
                                                            disabled={reviewingId === row.id}
                                                            onClick={() =>
                                                                handleReview(row.id, "deny")
                                                            }
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="is-empty">—</span>
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
        </div>
    );
}
