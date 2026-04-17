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
		<div className="mt-10">
			<div className="flex flex-wrap gap-2 mb-4">
				<div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
					<button
						type="button"
						onClick={() => setTab("calendar")}
						className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
							tab === "calendar"
								? "bg-[var(--color-primary-searchmind)] text-white"
								: "text-gray-600 hover:bg-gray-50"
						}`}
					>
						Calendar
					</button>
					<button
						type="button"
						onClick={() => setTab("gantt")}
						className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
							tab === "gantt"
								? "bg-[var(--color-primary-searchmind)] text-white"
								: "text-gray-600 hover:bg-gray-50"
						}`}
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
