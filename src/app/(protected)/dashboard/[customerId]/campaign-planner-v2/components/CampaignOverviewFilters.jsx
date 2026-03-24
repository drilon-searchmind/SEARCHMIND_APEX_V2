"use client";

import React, { useState } from "react";
import { FiChevronDown, FiChevronUp, FiFilter, FiRotateCcw } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import {
	LINE_ITEM_STATUSES,
	PLANNER_V2_BUDGET_CURRENCIES,
	PLANNER_V2_SERVICES,
} from "../constants";

const SORT_OPTIONS = [
	{ value: "name_asc", label: "Name (A → Z)" },
	{ value: "name_desc", label: "Name (Z → A)" },
	{ value: "start_asc", label: "Start date (earliest first)" },
	{ value: "start_desc", label: "Start date (latest first)" },
	{ value: "end_asc", label: "End date (earliest first)" },
	{ value: "end_desc", label: "End date (latest first)" },
	{ value: "created_desc", label: "Created (newest first)" },
	{ value: "created_asc", label: "Created (oldest first)" },
	{ value: "budget_desc", label: "Total budget (high → low)" },
	{ value: "budget_asc", label: "Total budget (low → high)" },
	{ value: "allocated_desc", label: "Allocated (high → low)" },
	{ value: "allocated_asc", label: "Allocated (low → high)" },
];

const selectClass =
	"mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 bg-white focus:border-brand-300 focus:ring-brand-500/20";

const sortSelectClass =
	"mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 bg-white focus:border-brand-300 focus:ring-brand-500/20";

export default function CampaignOverviewFilters({
	filters,
	updateFilter,
	sortBy,
	setSortBy,
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
			<div className="flex flex-col lg:flex-row lg:items-end gap-4">
				<div className="flex-1 min-w-0">
					<FormLabel htmlFor="cpv2-filter-search">Search</FormLabel>
					<FormInputText
						id="cpv2-filter-search"
						name="search"
						value={filters.search}
						onChange={(e) => updateFilter("search", e.target.value)}
						placeholder="Campaign name, brief, links…"
					/>
				</div>
				<div className="w-full lg:w-64">
					<FormLabel htmlFor="cpv2-sort">Sort by</FormLabel>
					<select
						id="cpv2-sort"
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value)}
						className={sortSelectClass}
					>
						{SORT_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => setAdvancedOpen((o) => !o)}
						className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
					>
						<FiFilter className="w-4 h-4" />
						Advanced filters
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
						title="Reset filters and sort"
					>
						<FiRotateCcw className="w-4 h-4" />
						Reset
					</button>
				</div>
			</div>

			<p className="text-sm text-gray-500 mt-3">
				Showing{" "}
				<span className="font-semibold text-gray-800">{filteredCount}</span> of{" "}
				<span className="font-semibold text-gray-800">{totalCount}</span>{" "}
				campaigns
			</p>

			{advancedOpen && (
				<div className="mt-4 pt-4 border-t border-gray-100 space-y-6">
					<div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 space-y-3">
						<label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
							<input
								type="checkbox"
								checked={filters.dateFilterEnabled}
								onChange={(e) =>
									updateFilter("dateFilterEnabled", e.target.checked)
								}
								className="rounded border-gray-300"
							/>
							Filter by schedule overlap (campaign window intersects range)
						</label>
						{filters.dateFilterEnabled && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
								<div>
									<FormLabel htmlFor="cpv2-dr-start">Range start</FormLabel>
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
								<div>
									<FormLabel htmlFor="cpv2-dr-end">Range end</FormLabel>
									<input
										id="cpv2-dr-end"
										type="date"
										value={filters.dateRange.endDate}
										onChange={(e) => setDateRange({ endDate: e.target.value })}
										className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
									/>
								</div>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<div>
							<FormLabel htmlFor="cpv2-lifecycle">Lifecycle</FormLabel>
							<select
								id="cpv2-lifecycle"
								value={filters.lifecycle}
								onChange={(e) => updateFilter("lifecycle", e.target.value)}
								className={selectClass}
							>
								<option value="all">All</option>
								<option value="active">Active (not past end date)</option>
								<option value="ended">Ended (past end date)</option>
								<option value="always_on">Always on</option>
							</select>
						</div>
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
							<FormLabel htmlFor="cpv2-li-status">
								Has campaign type with status
							</FormLabel>
							<select
								id="cpv2-li-status"
								value={filters.lineItemStatus}
								onChange={(e) =>
									updateFilter("lineItemStatus", e.target.value)
								}
								className={selectClass}
							>
								<option value="">Any</option>
								{LINE_ITEM_STATUSES.map((s) => (
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
							<FormLabel htmlFor="cpv2-audience">Audience</FormLabel>
							<select
								id="cpv2-audience"
								value={filters.audience}
								onChange={(e) => updateFilter("audience", e.target.value)}
								className={selectClass}
							>
								<option value="">Any</option>
								<option value="B2B">B2B</option>
								<option value="B2C">B2C</option>
								<option value="__unset__">Not set</option>
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
							<FormLabel htmlFor="cpv2-currency">Budget currency</FormLabel>
							<select
								id="cpv2-currency"
								value={filters.currency}
								onChange={(e) => updateFilter("currency", e.target.value)}
								className={selectClass}
							>
								<option value="">Any</option>
								{PLANNER_V2_BUDGET_CURRENCIES.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-cap">Campaign budget cap</FormLabel>
							<select
								id="cpv2-cap"
								value={filters.hasBudgetCap}
								onChange={(e) => updateFilter("hasBudgetCap", e.target.value)}
								className={selectClass}
							>
								<option value="all">Any</option>
								<option value="yes">Has total budget set</option>
								<option value="no">No total budget</option>
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-alloc">Service allocation vs cap</FormLabel>
							<select
								id="cpv2-alloc"
								value={filters.allocation}
								onChange={(e) => updateFilter("allocation", e.target.value)}
								className={selectClass}
							>
								<option value="all">Any</option>
								<option value="ok">Within cap (has cap, not over)</option>
								<option value="over">Over budget</option>
							</select>
						</div>
						<div>
							<FormLabel htmlFor="cpv2-has-li">Campaign types (line items)</FormLabel>
							<select
								id="cpv2-has-li"
								value={filters.hasLineItems}
								onChange={(e) => updateFilter("hasLineItems", e.target.value)}
								className={selectClass}
							>
								<option value="all">Any</option>
								<option value="yes">Has at least one</option>
								<option value="no">None yet</option>
							</select>
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
