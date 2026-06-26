"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import usePlannerV2Store from "./hooks/usePlannerV2Store";
import usePlannerOverviewFilters from "./hooks/usePlannerOverviewFilters";
import ParentCampaignModal from "./components/ParentCampaignModal";
import LineItemModal from "./components/LineItemModal";
import CampaignOverview from "./components/CampaignOverview";
import CampaignOverviewFilters from "./components/CampaignOverviewFilters";
import LineItemsKanban from "./components/LineItemsKanban";
import PlannerV2ScheduleSection from "./components/PlannerV2ScheduleSection";
import { isLineItemEndedVisual } from "./lib/lineItemStatus";
import "./campaign-planner-v2.css";

function CampaignPlannerV2Page() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const customerId = params.customerId;
	const lineItemIdFromUrl = searchParams.get("lineItemId");

	const {
		parents,
		services,
		lineItems,
		lineItemsWithContext,
		hydrated,
		createParent,
		updateParent,
		deleteParent,
		updateService,
		createLineItem,
		updateLineItem,
		deleteLineItem,
		setLineItemStatus,
		duplicateLineItem,
		customFormats,
		extraMediaByService,
		addCustomFormat,
		addExtraMedia,
	} = usePlannerV2Store(customerId);

	const {
		filters,
		updateFilter,
		resetFilters,
		setFullYearPeriod,
		expandPeriodToIncludeAllCampaigns,
		filteredParents,
		activeFilterCount,
		filterVisibility,
	} = usePlannerOverviewFilters(parents);

	const filteredParentIds = useMemo(
		() => new Set(filteredParents.map((p) => p.id)),
		[filteredParents]
	);

	const boardParentIds = useMemo(() => {
		const ids = new Set(filteredParentIds);
		lineItemsWithContext.forEach((li) => {
			if (li.status === "Ended" || isLineItemEndedVisual(li)) {
				ids.add(li._parentId);
			}
		});
		return ids;
	}, [filteredParentIds, lineItemsWithContext]);

	const filteredLineItemsWithContext = useMemo(
		() =>
			lineItemsWithContext.filter((li) => boardParentIds.has(li._parentId)),
		[lineItemsWithContext, boardParentIds]
	);

	const scheduleParents = useMemo(() => {
		const fromLines = new Set(
			filteredLineItemsWithContext.map((li) => li._parentId)
		);
		return parents.filter(
			(p) => filteredParentIds.has(p.id) || fromLines.has(p.id)
		);
	}, [parents, filteredParentIds, filteredLineItemsWithContext]);

	const [parentModal, setParentModal] = useState(null);
	const [lineModal, setLineModal] = useState(null);

	const parentForLineModal = useMemo(() => {
		const sid = lineModal?.service?.id;
		const fromService = sid ? services.find((s) => s.id === sid) : null;
		const parentId =
			lineModal?.lineItem?._parentId || fromService?.parentId || null;
		return parentId ? parents.find((p) => p.id === parentId) : null;
	}, [lineModal, parents, services]);

	const handleSaveParent = (data) => {
		if (parentModal?.mode === "edit" && parentModal.parent) {
			updateParent(parentModal.parent.id, data);
		} else {
			createParent(data);
		}
	};

	const handleSaveLineItem = (data) => {
		if (lineModal?.mode === "edit" && lineModal.lineItem) {
			updateLineItem(lineModal.lineItem.id, data);
		} else if (lineModal?.service && Array.isArray(data.bulkPayloads)) {
			for (const payload of data.bulkPayloads) {
				createLineItem(lineModal.service.id, payload);
			}
		} else if (lineModal?.service) {
			createLineItem(lineModal.service.id, data);
		}
	};

	const handleDeleteParent = (parentId) => {
		if (
			!window.confirm(
				"Delete this campaign and all related services and campaign types?"
			)
		)
			return;
		deleteParent(parentId);
	};

	const handleDeleteLineItem = (lineItemId) => {
		if (!window.confirm("Delete this campaign type?")) return;
		deleteLineItem(lineItemId);
	};

	const openLineItemFromKanban = (item) => {
		const svc = services.find((s) => s.id === item.serviceId);
		setLineModal({
			mode: "edit",
			lineItem: item,
			service: svc || { serviceName: item._serviceName },
		});
	};

	useEffect(() => {
		if (!hydrated || !lineItemIdFromUrl || !customerId) return;
		const item = lineItemsWithContext.find(
			(li) => String(li.id) === String(lineItemIdFromUrl)
		);
		if (!item) return;
		const svc = services.find((s) => s.id === item.serviceId);
		setLineModal({
			mode: "edit",
			lineItem: item,
			service: svc || { serviceName: item._serviceName },
		});
		router.replace(`/dashboard/${customerId}/campaign-planner-v2`, { scroll: false });
	}, [
		hydrated,
		lineItemIdFromUrl,
		customerId,
		lineItemsWithContext,
		services,
		router,
	]);

	const lineModalServiceName =
		lineModal?.service?.serviceName || lineModal?.lineItem?._serviceName || "";

	return (
		<div id="CampaignPlannerV2Page" className="cobalt-perf w-full" data-theme="cobalt">
			<DashboardHeading
				variant="cobalt"
				showRunAudit={false}
				title="Campaign Planner"
				label="Overview of your campaigns"
				customerId={customerId}
				showAnalyzeWithAi={false}
				showPdfExport={false}
				right={
					<button
						type="button"
						className="apex-perf-btn apex-perf-btn--primary"
						onClick={() => setParentModal({ mode: "create" })}
					>
						+ Create campaign
					</button>
				}
			/>

			{!hydrated ? (
				<div className="apex-perf-loading">
					<CobaltLoader variant="block" title="Loading campaign planner" />
				</div>
			) : (
				<div className="apex-cp-stack apex-cp-panel">
					<CampaignOverviewFilters
						filters={filters}
						updateFilter={updateFilter}
						resetFilters={resetFilters}
						setFullYearPeriod={setFullYearPeriod}
						expandPeriodToIncludeAllCampaigns={expandPeriodToIncludeAllCampaigns}
						activeFilterCount={activeFilterCount}
						totalCount={parents.length}
						filteredCount={filteredParents.length}
						filterVisibility={filterVisibility}
					/>

					<section>
						<h3 className="apex-cp-section__label">Campaign overview</h3>
						<CampaignOverview
							parents={filteredParents}
							storedParentCount={parents.length}
							filterVisibility={filterVisibility}
							onExpandPeriod={expandPeriodToIncludeAllCampaigns}
							onResetPeriod={setFullYearPeriod}
							services={services}
							lineItems={lineItems}
							customerId={customerId}
							onEditParent={(p) => setParentModal({ mode: "edit", parent: p })}
							onDeleteParent={handleDeleteParent}
							onUpdateService={updateService}
							onAddLineItem={(svc) =>
								setLineModal({ mode: "create", service: svc })
							}
							onEditLineItem={(li, svc) =>
								setLineModal({ mode: "edit", lineItem: li, service: svc })
							}
							onDeleteLineItem={handleDeleteLineItem}
							onDuplicateLineItem={(li) => duplicateLineItem(li.id)}
							onLineItemStatusChange={setLineItemStatus}
						/>
					</section>

					<section>
						<h3 className="apex-cp-section__label">Workflow</h3>
						<LineItemsKanban
							lineItemsWithContext={filteredLineItemsWithContext}
							onStatusChange={setLineItemStatus}
							onOpenLineItem={openLineItemFromKanban}
							filterDateRange={filters.dateRange}
						/>
					</section>

					<section>
						<h3 className="apex-cp-section__label">Schedule</h3>
						<PlannerV2ScheduleSection
							parents={scheduleParents}
							lineItemsWithContext={filteredLineItemsWithContext}
							onSelectParent={(p) => setParentModal({ mode: "edit", parent: p })}
							onSelectLineItem={openLineItemFromKanban}
						/>
					</section>
				</div>
			)}

			<ParentCampaignModal
				open={!!parentModal}
				onClose={() => setParentModal(null)}
				onSave={handleSaveParent}
				mode={parentModal?.mode === "edit" ? "edit" : "create"}
				initialParent={parentModal?.parent}
			/>

			<LineItemModal
				open={!!lineModal}
				onClose={() => setLineModal(null)}
				onSave={handleSaveLineItem}
				onDuplicate={
					lineModal?.mode === "edit" && lineModal?.lineItem
						? () => {
								duplicateLineItem(lineModal.lineItem.id);
								setLineModal(null);
							}
						: undefined
				}
				customerId={customerId}
				mode={lineModal?.mode === "edit" ? "edit" : "create"}
				serviceName={lineModalServiceName}
				initialLineItem={lineModal?.lineItem}
				parentCampaign={parentForLineModal}
				customFormats={customFormats}
				extraMediaByService={extraMediaByService}
				onAddCustomFormat={addCustomFormat}
				onAddExtraMedia={addExtraMedia}
			/>
		</div>
	);
}

export default function CampaignPlannerV2PageWithSuspense() {
	return (
		<Suspense
			fallback={
				<div className="cobalt-perf w-full apex-perf-loading" data-theme="cobalt">
					<CobaltLoader variant="block" title="Loading campaign planner" />
				</div>
			}
		>
			<CampaignPlannerV2Page />
		</Suspense>
	);
}
