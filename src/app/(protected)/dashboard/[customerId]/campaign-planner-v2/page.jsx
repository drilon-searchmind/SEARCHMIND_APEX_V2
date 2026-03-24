"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
import PlannerV2CalendarSection from "./components/PlannerV2CalendarSection";

export default function CampaignPlannerV2Page() {
	const params = useParams();
	const customerId = params.customerId;

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
	} = usePlannerV2Store(customerId);

	const {
		filters,
		updateFilter,
		sortBy,
		setSortBy,
		resetFilters,
		filteredParents,
		activeFilterCount,
	} = usePlannerOverviewFilters(parents, services, lineItems);

	const filteredParentIds = useMemo(
		() => new Set(filteredParents.map((p) => p.id)),
		[filteredParents]
	);

	const filteredLineItemsWithContext = useMemo(
		() =>
			lineItemsWithContext.filter((li) =>
				filteredParentIds.has(li._parentId)
			),
		[lineItemsWithContext, filteredParentIds]
	);

	const [parentModal, setParentModal] = useState(null);
	const [lineModal, setLineModal] = useState(null);

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
					sortBy={sortBy}
					setSortBy={setSortBy}
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
				/>

				<LineItemsKanban
					lineItemsWithContext={filteredLineItemsWithContext}
					onStatusChange={setLineItemStatus}
					onOpenLineItem={openLineItemFromKanban}
				/>
			</div>

			<PlannerV2CalendarSection
				parents={filteredParents}
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
				mode={lineModal?.mode === "edit" ? "edit" : "create"}
				serviceName={lineModalServiceName}
				initialLineItem={lineModal?.lineItem}
			/>
		</div>
	);
}
