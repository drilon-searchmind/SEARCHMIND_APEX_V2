"use client";

import React, { useMemo, useState } from "react";
import {
	FiAlertTriangle,
	FiChevronDown,
	FiChevronRight,
	FiEdit2,
	FiExternalLink,
	FiPlus,
	FiTrash2,
} from "react-icons/fi";
import { PLANNER_V2_DEFAULT_CURRENCY, SERVICE_COLORS } from "../constants";
import { formatBudgetAmount } from "../lib/formatBudget";

function startOfToday() {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

function isParentCampaignPast(parent) {
	if (parent.alwaysOn) return false;
	if (!parent.endDate) return false;
	const end = new Date(parent.endDate);
	end.setHours(0, 0, 0, 0);
	return end < startOfToday();
}

function formatDate(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function responsibleLabel(value) {
	if (value === "searchmind") return "Searchmind";
	if (value === "kunde") return "Internal";
	return value?.trim() ? value : "—";
}

function Detail({ label, children }) {
	return (
		<div>
			<div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
				{label}
			</div>
			<div className="mt-0.5 text-sm text-gray-900">{children}</div>
		</div>
	);
}

export default function CampaignOverview({
	parents = [],
	/** Total parents in store (before filters); used for empty-state copy */
	storedParentCount,
	services = [],
	lineItems = [],
	onEditParent,
	onDeleteParent,
	onUpdateService,
	onAddLineItem,
	onEditLineItem,
	onDeleteLineItem,
}) {
	const [expanded, setExpanded] = useState({});

	const byParent = useMemo(() => {
		const map = {};
		parents.forEach((p) => {
			map[p.id] = {
				services: services.filter((s) => s.parentId === p.id),
			};
		});
		return map;
	}, [parents, services]);

	const lineByService = useMemo(() => {
		const m = {};
		lineItems.forEach((li) => {
			if (!m[li.serviceId]) m[li.serviceId] = [];
			m[li.serviceId].push(li);
		});
		return m;
	}, [lineItems]);

	const toggle = (id) => {
		setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	if (parents.length === 0) {
		const filteredOut =
			typeof storedParentCount === "number" && storedParentCount > 0;
		return (
			<div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
				{filteredOut ? (
					<>
						<p className="text-gray-700 font-medium">
							No campaigns match your filters.
						</p>
						<p className="mt-2 text-sm">
							Reset filters or broaden your criteria to see campaigns again.
						</p>
					</>
				) : (
					"No campaigns yet. Create one using the button above."
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4 bg-gray-100 rounded-xl p-4">
			{parents.map((parent) => {
				const past = isParentCampaignPast(parent);
				const isOpen = expanded[parent.id];
				const row = byParent[parent.id] || { services: [] };
				const currency =
					parent.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY;
				const allocated = row.services.reduce(
					(sum, s) => sum + (Number(s.budget) || 0),
					0
				);
				const cap =
					parent.totalBudget != null && !Number.isNaN(Number(parent.totalBudget))
						? Number(parent.totalBudget)
						: null;
				const hasCap = cap != null && cap > 0;
				const overBudget = hasCap && allocated > cap;
				const barPct = hasCap
					? Math.min(100, (allocated / cap) * 100)
					: allocated > 0
						? 100
						: 0;

				return (
					<div
						key={parent.id}
						className={`rounded-xl border overflow-hidden transition-colors ${past
								? "border-gray-300 bg-gray-50/80 opacity-95"
								: "border-gray-200 bg-white"
							}`}
					>
						<div
							className={`flex flex-wrap items-center gap-3 p-4 border-b ${past ? "border-gray-200 bg-gray-100/60" : "border-gray-100"
								}`}
						>
							<button
								type="button"
								onClick={() => toggle(parent.id)}
								className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
								aria-expanded={!!isOpen}
							>
								{isOpen ? (
									<FiChevronDown className="w-5 h-5" />
								) : (
									<FiChevronRight className="w-5 h-5" />
								)}
								<span className="font-semibold text-gray-900 text-left">
									{parent.campaignName}
								</span>
							</button>
							{past && (
								<span className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-gray-200 text-gray-700">
									Ended
								</span>
							)}
							{overBudget && (
								<span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
									<FiAlertTriangle className="w-3.5 h-3.5" />
									Over budget
								</span>
							)}
							<span className="text-sm text-gray-500">
								{parent.alwaysOn
									? "Always on"
									: `${formatDate(parent.startDate)} – ${formatDate(parent.endDate)}`}
							</span>
							{hasCap && (
								<span
									className={`text-xs sm:text-sm ${overBudget ? "text-amber-800 font-medium" : "text-gray-500"
										}`}
								>
									Allocated {formatBudgetAmount(allocated, currency)}
									{" · "}
									Cap {formatBudgetAmount(cap, currency)}
								</span>
							)}
							{parent.materialLink && (
								<a
									href={parent.materialLink}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-sm text-[var(--color-primary-searchmind)] hover:underline"
								>
									<FiExternalLink className="w-4 h-4" />
									Material
								</a>
							)}
							<div className="ml-auto flex items-center gap-2">
								<button
									type="button"
									onClick={() => onEditParent(parent)}
									className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
									title="Edit campaign"
								>
									<FiEdit2 className="w-4 h-4" />
								</button>
								<button
									type="button"
									onClick={() => onDeleteParent(parent.id)}
									className="p-2 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50"
									title="Delete campaign"
								>
									<FiTrash2 className="w-4 h-4" />
								</button>
							</div>
						</div>

						{isOpen && (
							<div className="p-4 overflow-x-auto">
								<div className="rounded-lg border border-gray-200 bg-gray-50/90 p-4 mb-4">
									<h4 className="text-sm font-semibold text-gray-900 mb-3">
										Campaign details
									</h4>
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
										<Detail label="Responsible">
											{responsibleLabel(parent.responsible)}
										</Detail>
										<Detail label="Country code">
											{parent.countryCode?.trim() || "—"}
										</Detail>
										<Detail label="Audience">
											{parent.audience?.trim() || "—"}
										</Detail>
										<Detail label="Total budget">
											{cap != null && cap > 0
												? formatBudgetAmount(cap, currency)
												: "—"}
										</Detail>
										<Detail label="Currency">{currency}</Detail>
										<Detail label="Landing page">
											{parent.landingPageLink?.trim() ? (
												<a
													href={parent.landingPageLink}
													target="_blank"
													rel="noopener noreferrer"
													className="text-[var(--color-primary-searchmind)] hover:underline inline-flex items-center gap-1 break-all"
												>
													{parent.landingPageLink}
													<FiExternalLink className="w-3.5 h-3.5 shrink-0" />
												</a>
											) : (
												"—"
											)}
										</Detail>
									</div>

									<div className="mt-4 pt-4 border-t border-gray-200">
										<h5 className="text-sm font-semibold text-gray-900 mb-2">
											Service budget allocation
										</h5>
										<p className="text-xs text-gray-500 mb-3">
											Sum of per-service budgets below. Compare to the campaign
											total above.
										</p>
										<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
											<span>
												<span className="text-gray-600">Allocated: </span>
												<span className="font-semibold text-gray-900">
													{formatBudgetAmount(allocated, currency)}
												</span>
											</span>
											{hasCap ? (
												<span>
													<span className="text-gray-600">Campaign cap: </span>
													<span className="font-semibold text-gray-900">
														{formatBudgetAmount(cap, currency)}
													</span>
												</span>
											) : (
												<span className="text-gray-500 text-xs">
													Set a total budget under Advanced when editing to track
													against a cap.
												</span>
											)}
										</div>
										{hasCap && (
											<div className="mt-2">
												<div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
													<div
														className={`h-full rounded-full transition-all ${overBudget
																? "bg-amber-500"
																: "bg-[var(--color-primary-searchmind)]"
															}`}
														style={{ width: `${barPct}%` }}
													/>
												</div>
												{overBudget && (
													<div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 text-amber-950 text-sm px-3 py-2">
														<FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
														<span>
															Service budgets exceed the campaign total by{" "}
															<strong>
																{formatBudgetAmount(allocated - cap, currency)}
															</strong>
															. Reduce per-service amounts or raise the campaign
															total.
														</span>
													</div>
												)}
											</div>
										)}
									</div>
								</div>

								<p className="text-xs text-gray-500 mb-3">
									Services are created from the campaign and grouped in columns
									(Paid Social, PPC, email, etc.).
								</p>
								<div className="flex gap-4 min-w-min pb-2">
									{row.services.map((svc) => (
										<div
											key={svc.id}
											className="w-[280px] flex-shrink-0 border border-gray-200 rounded-lg flex flex-col bg-gray-50/50"
										>
											<div
												className="px-3 py-2 rounded-t-lg font-semibold text-sm text-gray-800"
												style={{
													backgroundColor:
														SERVICE_COLORS[svc.serviceName] || "#e5e7eb",
												}}
											>
												{svc.serviceName}
											</div>
											<div className="p-3 space-y-2 border-b border-gray-100 bg-white">
												<label className="block text-xs text-gray-500">
													Start date
												</label>
												<input
													type="date"
													value={svc.startDate || ""}
													onChange={(e) =>
														onUpdateService(svc.id, {
															startDate: e.target.value,
														})
													}
													className="w-full h-9 rounded border border-gray-300 px-2 text-sm"
												/>
												<label className="flex items-center gap-2 text-xs text-gray-600">
													<input
														type="checkbox"
														checked={!!svc.alwaysOn}
														onChange={(e) =>
															onUpdateService(svc.id, {
																alwaysOn: e.target.checked,
																endDate: e.target.checked ? "" : svc.endDate,
															})
														}
														className="rounded border-gray-300"
													/>
													Always on
												</label>
												{!svc.alwaysOn && (
													<>
														<label className="block text-xs text-gray-500">
															End date
														</label>
														<input
															type="date"
															value={svc.endDate || ""}
															onChange={(e) =>
																onUpdateService(svc.id, {
																	endDate: e.target.value,
																})
															}
															className="w-full h-9 rounded border border-gray-300 px-2 text-sm"
														/>
													</>
												)}
												<label className="block text-xs text-gray-500">
													Budget ({currency})
												</label>
												<input
													type="number"
													min="0"
													step="1"
													placeholder="0"
													value={svc.budget ?? ""}
													onChange={(e) => {
														const v = e.target.value;
														onUpdateService(svc.id, {
															budget: v === "" ? null : Number(v),
														});
													}}
													className="w-full h-9 rounded border border-gray-300 px-2 text-sm"
												/>
											</div>
											<div className="p-2 flex-1 flex flex-col gap-2 min-h-[120px]">
												{(lineByService[svc.id] || []).map((li) => (
													<div
														key={li.id}
														className="rounded-lg border border-gray-200 bg-white p-2 flex gap-2 items-start hover:border-[var(--color-primary-searchmind)] transition-colors"
													>
														<button
															type="button"
															onClick={() => onEditLineItem(li, svc)}
															className="text-left flex-1 min-w-0"
														>
															<div className="font-medium text-sm text-gray-900">
																{li.name}
															</div>
															<div className="text-xs text-gray-500 mt-0.5">
																{[li.media, li.format].filter(Boolean).join(" · ") ||
																	"—"}
															</div>
															<div className="text-xs text-[var(--color-primary-searchmind)] mt-1">
																{li.status}
															</div>
														</button>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																onDeleteLineItem(li.id);
															}}
															className="p-1.5 rounded text-red-500 hover:bg-red-50 shrink-0"
															title="Delete campaign type"
														>
															<FiTrash2 className="w-4 h-4" />
														</button>
													</div>
												))}
												<button
													type="button"
													onClick={() => onAddLineItem(svc)}
													className="mt-auto flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
												>
													<FiPlus className="w-4 h-4" />
													Campaign type
												</button>
											</div>
										</div>
									))}
								</div>

								{(parent.brief || parent.furtherBrief) && (
									<div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
										{parent.brief && (
											<div className="rounded-lg bg-white border border-gray-100 p-3">
												<div className="text-xs font-semibold text-gray-500 mb-1">
													Brief
												</div>
												<p className="text-gray-800 whitespace-pre-wrap">
													{parent.brief}
												</p>
											</div>
										)}
										{parent.furtherBrief && (
											<div className="rounded-lg bg-white border border-gray-100 p-3">
												<div className="text-xs font-semibold text-gray-500 mb-1">
													Further brief
												</div>
												<p className="text-gray-800 whitespace-pre-wrap">
													{parent.furtherBrief}
												</p>
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
