"use client";

import { useCallback, useMemo, useState } from "react";

/** Default filter window: first through last day of the current month (local calendar). */
function defaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const startDate = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endDate = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { startDate, endDate };
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

function parentOverlapsDateRange(parent, rangeStartStr, rangeEndStr) {
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

  const filteredParents = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const countryQ = filters.countryQuery.trim().toLowerCase();

    let list = parents.filter((p) => {
      if (q) {
        const hay = [
          p.campaignName,
          p.brief,
          p.furtherBrief,
          p.materialLink,
          p.landingPageLink,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (
        !parentOverlapsDateRange(
          p,
          filters.dateRange.startDate,
          filters.dateRange.endDate
        )
      ) {
        return false;
      }

      if (filters.service) {
        if (!(p.services || []).includes(filters.service)) return false;
      }

      if (filters.responsible && p.responsible !== filters.responsible) {
        return false;
      }

      if (countryQ) {
        if (!(p.countryCode || "").toLowerCase().includes(countryQ)) {
          return false;
        }
      }

      if (filters.hasMaterialLink === "yes" && !(p.materialLink || "").trim()) {
        return false;
      }
      if (filters.hasMaterialLink === "no" && (p.materialLink || "").trim()) {
        return false;
      }

      if (filters.hasLandingPage === "yes" && !(p.landingPageLink || "").trim()) {
        return false;
      }
      if (filters.hasLandingPage === "no" && (p.landingPageLink || "").trim()) {
        return false;
      }

      return true;
    });

    list = sortParentsDefault(list);
    return list;
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
    filteredParents,
    activeFilterCount,
  };
}
