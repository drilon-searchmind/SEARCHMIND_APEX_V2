"use client";

import { useCallback, useMemo, useState } from "react";

/** Default filter window: full calendar year (local). */
export function getFullYearDateRange(year = new Date().getFullYear()) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function defaultDateRange() {
  return getFullYearDateRange();
}

export function getDefaultOverviewFilters() {
  return {
    search: "",
    dateRange: defaultDateRange(),
    service: "",
    responsible: "",
    countryQuery: "",
    hasMaterialLink: "all",
    hasLandingPage: "all",
  };
}

export function parentOverlapsDateRange(parent, rangeStartStr, rangeEndStr) {
  const campaignStart = parent.startDate ? new Date(parent.startDate) : null;
  if (!campaignStart) return true;
  const rangeStart = new Date(rangeStartStr);
  const rangeEnd = new Date(rangeEndStr);
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  const campaignEnd =
    parent.alwaysOn || !parent.endDate ? null : new Date(parent.endDate);
  const effectiveEnd = campaignEnd || new Date("2099-12-31");
  effectiveEnd.setHours(23, 59, 59, 999);
  campaignStart.setHours(0, 0, 0, 0);
  return campaignStart <= rangeEnd && effectiveEnd >= rangeStart;
}

/** @returns {string} */
export function formatParentScheduleLabel(parent) {
  if (parent.alwaysOn) return "Always on";
  const start = parent.startDate ? String(parent.startDate).slice(0, 10) : "—";
  const end = parent.endDate ? String(parent.endDate).slice(0, 10) : "—";
  return `${start} → ${end}`;
}

/** Smallest date range that includes every campaign schedule (always-on extends to year end). */
export function getDateRangeCoveringCampaigns(parentList, year = new Date().getFullYear()) {
  if (!parentList?.length) return getFullYearDateRange(year);

  let minStart = null;
  let maxEnd = null;

  for (const p of parentList) {
    if (p.startDate) {
      const s = String(p.startDate).slice(0, 10);
      if (!minStart || s < minStart) minStart = s;
    }
    if (p.alwaysOn) {
      const yEnd = `${year}-12-31`;
      if (!maxEnd || yEnd > maxEnd) maxEnd = yEnd;
    } else if (p.endDate) {
      const e = String(p.endDate).slice(0, 10);
      if (!maxEnd || e > maxEnd) maxEnd = e;
    }
  }

  return {
    startDate: minStart || `${year}-01-01`,
    endDate: maxEnd || `${year}-12-31`,
  };
}

function passesNonDateFilters(parent, filters) {
  const q = filters.search.trim().toLowerCase();
  const countryQ = filters.countryQuery.trim().toLowerCase();

  if (q) {
    const hay = [
      parent.campaignName,
      parent.brief,
      parent.furtherBrief,
      parent.materialLink,
      parent.landingPageLink,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (filters.service) {
    if (!(parent.services || []).includes(filters.service)) return false;
  }

  if (filters.responsible && parent.responsible !== filters.responsible) {
    return false;
  }

  if (countryQ) {
    if (!(parent.countryCode || "").toLowerCase().includes(countryQ)) {
      return false;
    }
  }

  if (filters.hasMaterialLink === "yes" && !(parent.materialLink || "").trim()) {
    return false;
  }
  if (filters.hasMaterialLink === "no" && (parent.materialLink || "").trim()) {
    return false;
  }

  if (filters.hasLandingPage === "yes" && !(parent.landingPageLink || "").trim()) {
    return false;
  }
  if (filters.hasLandingPage === "no" && (parent.landingPageLink || "").trim()) {
    return false;
  }

  return true;
}

/** Stable ordering: dated campaigns by start date (newest first), then name. */
function sortParentsDefault(list) {
  return [...list].sort((a, b) => {
    const ae = a.alwaysOn ? 1 : 0;
    const be = b.alwaysOn ? 1 : 0;
    if (ae !== be) return ae - be;
    const as = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bs = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (as !== bs) return bs - as;
    return String(a.campaignName || "").localeCompare(
      String(b.campaignName || ""),
      "en",
      { sensitivity: "base" }
    );
  });
}

function countActiveFilters(filters) {
  const def = getDefaultOverviewFilters();
  let n = 0;
  if (filters.search.trim()) n++;
  if (
    filters.dateRange.startDate !== def.dateRange.startDate ||
    filters.dateRange.endDate !== def.dateRange.endDate
  ) {
    n++;
  }
  if (filters.service) n++;
  if (filters.responsible) n++;
  if (filters.countryQuery.trim()) n++;
  if (filters.hasMaterialLink !== def.hasMaterialLink) n++;
  if (filters.hasLandingPage !== def.hasLandingPage) n++;
  return n;
}

export default function usePlannerOverviewFilters(parents) {
  const [filters, setFilters] = useState(getDefaultOverviewFilters);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(getDefaultOverviewFilters());
  }, []);

  const setFullYearPeriod = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: getFullYearDateRange(),
    }));
  }, []);

  const expandPeriodToIncludeAllCampaigns = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: getDateRangeCoveringCampaigns(parents),
    }));
  }, [parents]);

  const filteredParents = useMemo(() => {
    let list = parents.filter((p) => {
      if (!passesNonDateFilters(p, filters)) return false;
      if (
        !parentOverlapsDateRange(
          p,
          filters.dateRange.startDate,
          filters.dateRange.endDate
        )
      ) {
        return false;
      }
      return true;
    });

    list = sortParentsDefault(list);
    return list;
  }, [parents, filters]);

  const filterVisibility = useMemo(() => {
    const { startDate, endDate } = filters.dateRange;
    const matchingExceptDate = parents.filter((p) => passesNonDateFilters(p, filters));
    const hiddenByDateRange = matchingExceptDate.filter(
      (p) => !parentOverlapsDateRange(p, startDate, endDate)
    );
    const hiddenByOtherFilters = parents.length - matchingExceptDate.length;

    return {
      hiddenByDateRangeCount: hiddenByDateRange.length,
      hiddenByOtherFiltersCount: hiddenByOtherFilters,
      hiddenByDateRangeCampaigns: hiddenByDateRange.map((p) => ({
        id: p.id,
        name: p.campaignName || "Untitled campaign",
        schedule: formatParentScheduleLabel(p),
      })),
    };
  }, [parents, filters]);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    setFullYearPeriod,
    expandPeriodToIncludeAllCampaigns,
    filteredParents,
    activeFilterCount,
    filterVisibility,
  };
}
