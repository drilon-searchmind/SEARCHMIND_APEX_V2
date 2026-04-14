"use client";

import React, { useState } from "react";
import { FiChevronDown, FiChevronUp, FiFilter, FiRotateCcw } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { PLANNER_V2_SERVICES } from "../constants";

const selectClass =
	"mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 bg-white focus:border-brand-300 focus:ring-brand-500/20";

export default function CampaignOverviewFilters({
	filters,
	updateFilter,
	resetFilters,
	activeFilterCount,
	totalCount,
	filteredCount,
}) {
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const setDateRange = (patch) => {
		updateFilter("dateRange", { ...filters.dateRange, ...patch });
	};

	return (
		<div className="bg-white border border-gray-200 rounded-xl p-4">
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
						<div className="min-w-[140px]">
							<FormLabel htmlFor="cpv2-dr-start">Period from</FormLabel>
							<input
								id="cpv2-dr-start"
								type="date"
								value={filters.dateRange.startDate}
								onChange={(e) =>
									setDateRange({ startDate: e.target.value })
								}
								className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
							/>
						</div>
						<div className="min-w-[140px]">
							<FormLabel htmlFor="cpv2-dr-end">Period to</FormLabel>
							<input
								id="cpv2-dr-end"
								type="date"
								value={filters.dateRange.endDate}
								onChange={(e) => setDateRange({ endDate: e.target.value })}
								className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
							/>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 shrink-0">
						<button
							type="button"
							onClick={() => setAdvancedOpen((o) => !o)}
							className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
						>
							<FiFilter className="w-4 h-4" />
							More filters
							{activeFilterCount > 0 && (
								<span className="rounded-full bg-[var(--color-primary-searchmind)] text-white text-xs font-semibold px-2 py-0.5 min-w-[1.25rem] text-center">
									{activeFilterCount}
								</span>
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
							className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
							title="Reset filters"
						>
							<FiRotateCcw className="w-4 h-4" />
							Reset
						</button>
					</div>
				</div>
			</div>

			<p className="text-sm text-gray-500 mt-3">
				Showing{" "}
				<span className="font-semibold text-gray-800">{filteredCount}</span> of{" "}
				<span className="font-semibold text-gray-800">{totalCount}</span>{" "}
				campaigns
			</p>

			{advancedOpen && (
				<div className="mt-4 pt-4 border-t border-gray-100">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<div>
							<FormLabel htmlFor="cpv2-service">Includes service</FormLabel>
							<select
								id="cpv2-service"
								value={filters.service}
								onChange={(e) => updateFilter("service", e.target.value)}
								className={selectClass}
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
								className={selectClass}
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
								className={selectClass}
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
								className={selectClass}
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
