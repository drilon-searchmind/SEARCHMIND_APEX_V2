"use client";

import React, { useState } from "react";
import PlannerV2CalendarSection from "./PlannerV2CalendarSection";
import PlannerV2Gantt from "./PlannerV2Gantt";

export default function PlannerV2ScheduleSection({
	parents = [],
	lineItemsWithContext = [],
	onSelectParent,
	onSelectLineItem,
}) {
	const [tab, setTab] = useState("calendar");
	const [ganttYear, setGanttYear] = useState(() => new Date().getFullYear());

	return (
		<div>
			<div className="flex flex-wrap gap-2 mb-4">
				<div className="apex-cp-tab-group">
					<button
						type="button"
						onClick={() => setTab("calendar")}
						className={`apex-cp-tab ${tab === "calendar" ? "is-active" : ""}`}
					>
						Calendar
					</button>
					<button
						type="button"
						onClick={() => setTab("gantt")}
						className={`apex-cp-tab ${tab === "gantt" ? "is-active" : ""}`}
					>
						Gantt
					</button>
				</div>
			</div>

			{tab === "calendar" && (
				<PlannerV2CalendarSection
					embedded
					parents={parents}
					lineItemsWithContext={lineItemsWithContext}
					onSelectParent={onSelectParent}
					onSelectLineItem={onSelectLineItem}
				/>
			)}
			{tab === "gantt" && (
				<PlannerV2Gantt
					embedded
					parents={parents}
					lineItemsWithContext={lineItemsWithContext}
					year={ganttYear}
					onYearChange={setGanttYear}
					onSelectParent={onSelectParent}
					onSelectLineItem={onSelectLineItem}
				/>
			)}
		</div>
	);
}
