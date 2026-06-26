"use client";

import React, { useState } from "react";
import { FiAlertCircle, FiChevronDown, FiChevronUp, FiFilter, FiRotateCcw } from "react-icons/fi";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { PLANNER_V2_SERVICES } from "../constants";

export default function CampaignOverviewFilters({
	filters,
	updateFilter,
	resetFilters,
	setFullYearPeriod,
	expandPeriodToIncludeAllCampaigns,
	activeFilterCount,
	totalCount,
	filteredCount,
	filterVisibility,
}) {
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const setDateRange = (patch) => {
		updateFilter("dateRange", { ...filters.dateRange, ...patch });
	};

	const { startDate, endDate } = filters.dateRange;
	const hiddenByDate = filterVisibility?.hiddenByDateRangeCount ?? 0;
	const hiddenByOther = filterVisibility?.hiddenByOtherFiltersCount ?? 0;
	const hiddenCampaigns = filterVisibility?.hiddenByDateRangeCampaigns ?? [];
	const allHiddenByPeriod =
		totalCount > 0 && filteredCount === 0 && hiddenByDate > 0 && hiddenByOther === 0;

	return (
		<div className="apex-cp-filters">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col xl:flex-row xl:items-end gap-3 xl:gap-4">
					<div className="w-full max-w-[220px] shrink-0">
						<FormLabel htmlFor="cpv2-filter-search">Search</FormLabel>
						<FormInputText
							id="cpv2-filter-search"
							name="search"
							value={filters.search}
							onChange={(e) => updateFilter("search", e.target.value)}
							placeholder="Name, brief…"
							className="text-sm"
						/>
					</div>
					<div className="flex flex-wrap items-end gap-3 sm:gap-4 flex-1 min-w-0">
						<div className="min-w-0 flex-1 sm:max-w-md">
							<FormLabel>Period</FormLabel>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<DateRangePicker
									variant="cobalt"
									usePortal
									triggerClassName="h-11 px-4 py-0 text-sm inline-flex items-center justify-center"
									onApply={() => {}}
									startDate={startDate}
									endDate={endDate}
									onStartDateChange={(v) =>
										setDateRange({ startDate: v })
									}
									onEndDateChange={(v) =>
										setDateRange({ endDate: v })
									}
								/>
								<button
									type="button"
									className="apex-cp-btn apex-cp-btn--ghost"
									onClick={setFullYearPeriod}
									title="Set period to full calendar year"
								>
									Full year
								</button>
							</div>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 shrink-0">
						<button
							type="button"
							onClick={() => setAdvancedOpen((o) => !o)}
							className="apex-cp-btn"
						>
							<FiFilter className="w-4 h-4" />
							More filters
							{activeFilterCount > 0 && (
								<span className="apex-cp-btn-count">{activeFilterCount}</span>
							)}
							{advancedOpen ? (
								<FiChevronUp className="w-4 h-4" />
							) : (
								<FiChevronDown className="w-4 h-4" />
							)}
						</button>
						<button
							type="button"
							onClick={resetFilters}
							className="apex-cp-btn apex-cp-btn--ghost"
							title="Reset filters"
						>
							<FiRotateCcw className="w-4 h-4" />
							Reset
						</button>
					</div>
				</div>
			</div>

			<div className="apex-cp-filters__meta-wrap">
				<p className="apex-cp-filters__meta">
					Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong>{" "}
					campaign{totalCount === 1 ? "" : "s"}
					{startDate && endDate ? (
						<>
							{" "}
							· period <strong>{startDate}</strong> → <strong>{endDate}</strong>
						</>
					) : null}
				</p>
				{hiddenByOther > 0 ? (
					<p className="apex-cp-filters__meta apex-cp-filters__meta--sub">
						<strong>{hiddenByOther}</strong> hidden by search or advanced filters
					</p>
				) : null}
			</div>

			{hiddenByDate > 0 ? (
				<div
					className={`apex-cp-filters__hidden-banner${allHiddenByPeriod ? " is-emphasis" : ""}`}
					role="status"
				>
					<div className="apex-cp-filters__hidden-banner-icon" aria-hidden>
						<FiAlertCircle />
					</div>
					<div className="apex-cp-filters__hidden-banner-body">
						<p className="apex-cp-filters__hidden-banner-title">
							{hiddenByDate === 1
							 ? "1 campaign is outside the selected period"
							 : `${hiddenByDate} campaigns are outside the selected period`}
						</p>
						<p className="apex-cp-filters__hidden-banner-text">
							{allHiddenByPeriod
								? "Nothing matches your current dates — widen the period to see them again."
								: "These campaigns run on other dates and are hidden from the overview, workflow, and schedule below."}
						</p>
						{hiddenCampaigns.length > 0 ? (
							<ul className="apex-cp-filters__hidden-list">
								{hiddenCampaigns.slice(0, 4).map((c) => (
									<li key={c.id}>
										<span className="apex-cp-filters__hidden-name">{c.name}</span>
										<span className="apex-cp-filters__hidden-schedule">{c.schedule}</span>
									</li>
								))}
								{hiddenCampaigns.length > 4 ? (
									<li className="apex-cp-filters__hidden-more">
										+ {hiddenCampaigns.length - 4} more
									</li>
								) : null}
							</ul>
						) : null}
						<div className="apex-cp-filters__hidden-actions">
							<button
								type="button"
								className="apex-cp-btn apex-cp-btn--primary"
								onClick={expandPeriodToIncludeAllCampaigns}
							>
								Include all campaign dates
							</button>
							<button
								type="button"
								className="apex-cp-btn"
								onClick={setFullYearPeriod}
							>
								Reset to full year
							</button>
						</div>
					</div>
				</div>
			) : null}

			{advancedOpen && (
				<div className="apex-cp-filters__advanced">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<div>
							<FormLabel htmlFor="cpv2-service">Includes service</FormLabel>
							<select
								id="cpv2-service"
								value={filters.service}
								onChange={(e) => updateFilter("service", e.target.value)}
								className="apex-cp-select"
							>
								<option value="">Any</option>
								{PLANNER_V2_SERVICES.map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-responsible">Responsible</FormLabel>
							<select
								id="cpv2-responsible"
								value={filters.responsible}
								onChange={(e) => updateFilter("responsible", e.target.value)}
								className="apex-cp-select"
							>
								<option value="">Any</option>
								<option value="searchmind">Searchmind</option>
								<option value="kunde">Internal</option>
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-country">Country code contains</FormLabel>
							<FormInputText
								id="cpv2-country"
								value={filters.countryQuery}
								onChange={(e) => updateFilter("countryQuery", e.target.value)}
								placeholder="e.g. DK"
							/>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-mat">Material link</FormLabel>
							<select
								id="cpv2-mat"
								value={filters.hasMaterialLink}
								onChange={(e) =>
									updateFilter("hasMaterialLink", e.target.value)
								}
								className="apex-cp-select"
							>
								<option value="all">Any</option>
								<option value="yes">Has link</option>
								<option value="no">Missing</option>
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-land">Landing page</FormLabel>
							<select
								id="cpv2-land"
								value={filters.hasLandingPage}
								onChange={(e) =>
									updateFilter("hasLandingPage", e.target.value)
								}
								className="apex-cp-select"
							>
								<option value="all">Any</option>
								<option value="yes">Has URL</option>
								<option value="no">Missing</option>
							</select>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
