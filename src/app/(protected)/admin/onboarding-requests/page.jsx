"use client";

import React from "react";
import Link from "next/link";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { formatOnboardingLeadName } from "@/lib/onboardingLead";
import "../admin.css";

const STATUS_FILTERS = [
	{ key: "submitted", label: "Submitted" },
	{ key: "in_review", label: "In review" },
	{ key: "completed", label: "Completed" },
	{ key: "cancelled", label: "Cancelled" },
	{ key: "", label: "All" },
];

const STATUS_ACTIONS = [
	{ key: "in_review", label: "Mark in review" },
	{ key: "completed", label: "Mark completed" },
	{ key: "cancelled", label: "Cancel" },
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
		case "completed":
			return "apex-admin-badge--ok";
		case "cancelled":
			return "apex-admin-badge--error";
		case "in_review":
			return "apex-admin-badge--info";
		default:
			return "apex-admin-badge--warn";
	}
}

function channelStatusBadgeClass(status) {
	switch (status) {
		case "verified":
			return "apex-admin-badge--ok";
		case "failed":
			return "apex-admin-badge--error";
		case "verifying":
		case "claimed":
			return "apex-admin-badge--warn";
		default:
			return "";
	}
}

function RequestDetail({ row }) {
	const name = formatOnboardingLeadName(row);

	return (
		<div className="apex-admin-detail-grid">
			<div>
				<h3 className="apex-admin-detail__title">Lead (HubSpot form)</h3>
				<dl className="apex-admin-dl">
					<div>
						<dt>Name</dt>
						<dd>{name || "—"}</dd>
					</div>
					<div>
						<dt>Email</dt>
						<dd>{row.email || "—"}</dd>
					</div>
					<div>
						<dt>Phone</dt>
						<dd>{row.tlf || "—"}</dd>
					</div>
					<div>
						<dt>Company</dt>
						<dd>{row.virksomhed || "—"}</dd>
					</div>
				</dl>
			</div>

			<div>
				<h3 className="apex-admin-detail__title">Channels</h3>
				{row.channels?.length ? (
					<div className="apex-admin-channel-list">
						{row.channels.map((channel) => (
							<div key={channel.channelId} className="apex-admin-channel-card">
								<div className="apex-admin-channel-card__head">
									<strong>{channel.channelName}</strong>
									<span
										className={`apex-admin-badge ${channelStatusBadgeClass(channel.status)}`}
									>
										{channel.status}
									</span>
								</div>
								{channel.verifiedAt ? (
									<p className="apex-admin-field-hint">
										Verified {formatDate(channel.verifiedAt)}
									</p>
								) : null}
								{channel.fields && Object.keys(channel.fields).length ? (
									<dl className="apex-admin-dl apex-admin-dl--compact">
										{Object.entries(channel.fields).map(([key, value]) => (
											<div key={key}>
												<dt>{key}</dt>
												<dd>{String(value)}</dd>
											</div>
										))}
									</dl>
								) : (
									<p className="apex-admin-field-hint">No channel fields submitted.</p>
								)}
							</div>
						))}
					</div>
				) : (
					<p className="apex-admin-empty">No channel data.</p>
				)}
			</div>

			{row.adminNotes ? (
				<div className="apex-admin-detail__notes">
					<h3 className="apex-admin-detail__title">Admin notes</h3>
					<p className="whitespace-pre-wrap">{row.adminNotes}</p>
				</div>
			) : null}
		</div>
	);
}

export default function OnboardingRequestsAdminPage() {
	const [statusFilter, setStatusFilter] = React.useState("submitted");
	const [requests, setRequests] = React.useState([]);
	const [loading, setLoading] = React.useState(true);
	const [updatingId, setUpdatingId] = React.useState(null);
	const [expandedId, setExpandedId] = React.useState(null);
	const [notesDraft, setNotesDraft] = React.useState({});

	const loadRequests = React.useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (statusFilter) params.set("status", statusFilter);
			const res = await fetch(`/api/admin/onboarding-requests?${params.toString()}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Failed to load onboarding requests");
			setRequests(Array.isArray(data.requests) ? data.requests : []);
		} catch (err) {
			showToast({ type: "error", message: err.message || "Failed to load onboarding requests" });
			setRequests([]);
		} finally {
			setLoading(false);
		}
	}, [statusFilter]);

	React.useEffect(() => {
		loadRequests();
	}, [loadRequests]);

	const handleUpdate = async (id, patch) => {
		setUpdatingId(id);
		try {
			const res = await fetch(`/api/admin/onboarding-requests/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(patch),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Update failed");
			showToast({ type: "success", message: data.message || "Updated" });
			await loadRequests();
		} catch (err) {
			showToast({ type: "error", message: err.message || "Update failed" });
		} finally {
			setUpdatingId(null);
		}
	};

	const toggleExpanded = (id) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	return (
		<div id="OnboardingRequestsAdminPage" className="apex-perf w-full apex-admin-stack">
			<div className="apex-admin-page-head">
				<DashboardHeading
					variant="cobalt"
					showRunAudit={false}
					title="Onboarding Requests"
					label="Review Apex account onboarding submissions"
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
						Submissions from the public onboarding flow after users complete channel verification
						and click &quot;Opret Apex-konto&quot;. Lead data comes from the HubSpot signup form.
					</p>

					{loading ? (
						<CobaltLoader variant="block" title="Loading onboarding requests" />
					) : requests.length === 0 ? (
						<p className="apex-admin-empty">No onboarding requests found.</p>
					) : (
						<div className="apex-admin-table-wrap">
							<table className="apex-admin-table">
								<thead>
									<tr>
										<th>Contact</th>
										<th>Company</th>
										<th>Verified</th>
										<th>Submitted</th>
										<th>Status</th>
										<th className="is-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{requests.map((row) => {
										const name = formatOnboardingLeadName(row);
										const expanded = expandedId === row.id;
										return (
											<React.Fragment key={row.id}>
												<tr>
													<td>
														<div>{name || "—"}</div>
														<div className="apex-admin-cell-mono">{row.email}</div>
														{row.tlf ? (
															<div className="apex-admin-field-hint">{row.tlf}</div>
														) : null}
													</td>
													<td>{row.virksomhed || "—"}</td>
													<td>
														{row.verifiedChannelCount ?? 0}
														<span className="apex-admin-field-hint">
															{" "}
															/ {row.channels?.length ?? 0}
														</span>
													</td>
													<td className="whitespace-nowrap">
														{formatDate(row.submittedAt)}
													</td>
													<td>
														<span
															className={`apex-admin-badge ${statusBadgeClass(row.status)}`}
														>
															{row.status}
														</span>
													</td>
													<td className="is-right">
														<div className="apex-admin-table-actions">
															<button
																type="button"
																className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm"
																onClick={() => toggleExpanded(row.id)}
															>
																{expanded ? "Hide" : "Details"}
															</button>
														</div>
													</td>
												</tr>
												{expanded ? (
													<tr className="apex-admin-table-detail-row">
														<td colSpan={6}>
															<RequestDetail row={row} />
															<div className="apex-admin-detail-actions">
																<label className="apex-admin-notes-field">
																	<span>Admin notes</span>
																	<textarea
																		rows={3}
																		value={
																			notesDraft[row.id] ?? row.adminNotes ?? ""
																		}
																		onChange={(e) =>
																			setNotesDraft((prev) => ({
																				...prev,
																				[row.id]: e.target.value,
																			}))
																		}
																		placeholder="Internal notes for this request…"
																	/>
																</label>
																<div className="apex-admin-table-actions">
																	<button
																		type="button"
																		className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm"
																		disabled={updatingId === row.id}
																		onClick={() =>
																			handleUpdate(row.id, {
																				adminNotes:
																					notesDraft[row.id] ?? row.adminNotes ?? "",
																			})
																		}
																	>
																		Save notes
																	</button>
																	{STATUS_ACTIONS.map((action) => (
																		<button
																			key={action.key}
																			type="button"
																			className={`apex-perf-btn apex-admin-btn-sm${
																				action.key === "completed"
																					? " apex-perf-btn--primary"
																					: " apex-perf-btn--secondary"
																			}`}
																			disabled={
																				updatingId === row.id
																				|| row.status === action.key
																			}
																			onClick={() =>
																				handleUpdate(row.id, {
																					status: action.key,
																				})
																			}
																		>
																			{action.label}
																		</button>
																	))}
																</div>
															</div>
														</td>
													</tr>
												) : null}
											</React.Fragment>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
