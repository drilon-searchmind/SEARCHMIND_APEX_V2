"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import FormButton from "@/components/form/FormButton";
import Spinner from "@/components/ui/Spinner";
import usePlannerV2Store from "./hooks/usePlannerV2Store";
import usePlannerOverviewFilters from "./hooks/usePlannerOverviewFilters";
import ParentCampaignModal from "./components/ParentCampaignModal";
import LineItemModal from "./components/LineItemModal";
import CampaignOverview from "./components/CampaignOverview";
import CampaignOverviewFilters from "./components/CampaignOverviewFilters";
import LineItemsKanban from "./components/LineItemsKanban";
import PlannerV2ScheduleSection from "./components/PlannerV2ScheduleSection";
import { isLineItemEndedVisual } from "./lib/lineItemStatus";

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
		filteredParents,
		activeFilterCount,
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

	/** Open campaign type modal from ?lineItemId= (e.g. notification deep link) */
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

	if (!hydrated) {
		return (
			<div className="w-full flex justify-center py-24">
				<Spinner />
			</div>
		);
	}

	const lineModalServiceName =
		lineModal?.service?.serviceName || lineModal?.lineItem?._serviceName || "";

	return (
		<div className="w-full">
			<DashboardHeading
				title="Campaign Planner"
				label="Overview of your campaigns"
				right={
					<span onClick={() => setParentModal({ mode: "create" })}>
						<FormButton buttonSize="small">+ Create campaign</FormButton>
					</span>
				}
				showAnalyzeWithAi={false}
				showPdfExport={false}
			/>

			<div className="space-y-8 mt-2">
				<CampaignOverviewFilters
					filters={filters}
					updateFilter={updateFilter}
					resetFilters={resetFilters}
					activeFilterCount={activeFilterCount}
					totalCount={parents.length}
					filteredCount={filteredParents.length}
				/>
				<CampaignOverview
					parents={filteredParents}
					storedParentCount={parents.length}
					services={services}
					lineItems={lineItems}
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
				/>

				<LineItemsKanban
					lineItemsWithContext={filteredLineItemsWithContext}
					onStatusChange={setLineItemStatus}
					onOpenLineItem={openLineItemFromKanban}
					filterDateRange={filters.dateRange}
				/>
			</div>

			<PlannerV2ScheduleSection
				parents={scheduleParents}
				lineItemsWithContext={filteredLineItemsWithContext}
				onSelectParent={(p) => setParentModal({ mode: "edit", parent: p })}
				onSelectLineItem={openLineItemFromKanban}
			/>

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
				<div className="w-full flex justify-center py-24">
					<Spinner />
				</div>
			}
		>
			<CampaignPlannerV2Page />
		</Suspense>
	);
}
