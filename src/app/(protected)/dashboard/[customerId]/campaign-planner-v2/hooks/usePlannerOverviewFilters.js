"use client";

import { useCallback, useMemo, useState } from "react";
import { PLANNER_V2_DEFAULT_CURRENCY } from "../constants";

function defaultDateRange() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const first = `${yyyy}-${mm}-01`;
  const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
  const last = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { startDate: first, endDate: last };
}

export function getDefaultOverviewFilters() {
  return {
    search: "",
    dateFilterEnabled: false,
    dateRange: defaultDateRange(),
    lifecycle: "all",
    service: "",
    lineItemStatus: "",
    responsible: "",
    audience: "",
    countryQuery: "",
    currency: "",
    hasBudgetCap: "all",
    allocation: "all",
    hasLineItems: "all",
    hasMaterialLink: "all",
    hasLandingPage: "all",
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isParentEndedByDate(parent) {
  if (parent.alwaysOn) return false;
  if (!parent.endDate) return false;
  const end = new Date(parent.endDate);
  end.setHours(0, 0, 0, 0);
  return end < startOfToday();
}

function parentOverlapsDateRange(parent, rangeStartStr, rangeEndStr) {
  const campaignStart = parent.startDate ? new Date(parent.startDate) : null;
  if (!campaignStart) return true;
  const rangeStart = new Date(rangeStartStr);
  const rangeEnd = new Date(rangeEndStr);
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  const campaignEnd =
    parent.alwaysOn || !parent.endDate
      ? null
      : new Date(parent.endDate);
  const effectiveEnd = campaignEnd || new Date("2099-12-31");
  effectiveEnd.setHours(23, 59, 59, 999);
  campaignStart.setHours(0, 0, 0, 0);
  return campaignStart <= rangeEnd && effectiveEnd >= rangeStart;
}

function servicesForParent(services, parentId) {
  return services.filter((s) => s.parentId === parentId);
}

function lineItemsForParent(services, lineItems, parentId) {
  const ids = new Set(servicesForParent(services, parentId).map((s) => s.id));
  return lineItems.filter((li) => ids.has(li.serviceId));
}

function allocatedForParent(services, parentId) {
  return servicesForParent(services, parentId).reduce(
    (sum, s) => sum + (Number(s.budget) || 0),
    0
  );
}

function budgetCap(parent) {
  const n = Number(parent.totalBudget);
  if (parent.totalBudget == null || Number.isNaN(n) || n <= 0) return null;
  return n;
}

function parentCurrency(parent) {
  return parent.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY;
}

function sortParents(list, sortBy, services, lineItems) {
  const withMeta = list.map((p) => ({
    parent: p,
    allocated: allocatedForParent(services, p.id),
    cap: budgetCap(p),
    created: p.createdAt ? new Date(p.createdAt).getTime() : 0,
    start: p.startDate ? new Date(p.startDate).getTime() : 0,
    endEff: p.alwaysOn
      ? Number.MAX_SAFE_INTEGER
      : p.endDate
        ? new Date(p.endDate).getTime()
        : Number.MAX_SAFE_INTEGER,
  }));

  const cmp = (a, b, key, dir) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av == null || av === "") return 1;
    if (bv == null || bv === "") return -1;
    const c = av < bv ? -1 : 1;
    return dir === "asc" ? c : -c;
  };

  withMeta.sort((a, b) => {
    switch (sortBy) {
      case "name_asc":
        return String(a.parent.campaignName || "").localeCompare(
          String(b.parent.campaignName || ""),
          "en",
          { sensitivity: "base" }
        );
      case "name_desc":
        return String(b.parent.campaignName || "").localeCompare(
          String(a.parent.campaignName || ""),
          "en",
          { sensitivity: "base" }
        );
      case "start_asc":
        return cmp(a, b, "start", "asc");
      case "start_desc":
        return cmp(a, b, "start", "desc");
      case "end_asc":
        return cmp(a, b, "endEff", "asc");
      case "end_desc":
        return cmp(a, b, "endEff", "desc");
      case "created_desc":
        return (b.created || 0) - (a.created || 0);
      case "created_asc":
        return (a.created || 0) - (b.created || 0);
      case "budget_desc": {
        const ac = a.cap ?? -1;
        const bc = b.cap ?? -1;
        return bc - ac;
      }
      case "budget_asc": {
        const ac = a.cap ?? Number.MAX_SAFE_INTEGER;
        const bc = b.cap ?? Number.MAX_SAFE_INTEGER;
        return ac - bc;
      }
      case "allocated_desc":
        return b.allocated - a.allocated;
      case "allocated_asc":
        return a.allocated - b.allocated;
      default:
        return 0;
    }
  });

  return withMeta.map((x) => x.parent);
}

function countActiveFilters(filters) {
  const def = getDefaultOverviewFilters();
  let n = 0;
  if (filters.search.trim()) n++;
  if (filters.dateFilterEnabled) n++;
  if (filters.lifecycle !== def.lifecycle) n++;
  if (filters.service) n++;
  if (filters.lineItemStatus) n++;
  if (filters.responsible) n++;
  if (filters.audience) n++;
  if (filters.countryQuery.trim()) n++;
  if (filters.currency) n++;
  if (filters.hasBudgetCap !== def.hasBudgetCap) n++;
  if (filters.allocation !== def.allocation) n++;
  if (filters.hasLineItems !== def.hasLineItems) n++;
  if (filters.hasMaterialLink !== def.hasMaterialLink) n++;
  if (filters.hasLandingPage !== def.hasLandingPage) n++;
  return n;
}

export default function usePlannerOverviewFilters(parents, services, lineItems) {
  const [filters, setFilters] = useState(getDefaultOverviewFilters);
  const [sortBy, setSortBy] = useState("name_asc");

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(getDefaultOverviewFilters());
    setSortBy("name_asc");
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

      if (filters.dateFilterEnabled) {
        if (
          !parentOverlapsDateRange(
            p,
            filters.dateRange.startDate,
            filters.dateRange.endDate
          )
        ) {
          return false;
        }
      }

      if (filters.lifecycle === "active") {
        if (p.alwaysOn) {
          /* keep */
        } else if (isParentEndedByDate(p)) return false;
      } else if (filters.lifecycle === "ended") {
        if (!isParentEndedByDate(p)) return false;
      } else if (filters.lifecycle === "always_on") {
        if (!p.alwaysOn) return false;
      }

      if (filters.service) {
        if (!(p.services || []).includes(filters.service)) return false;
      }

      const lineItemsForP = lineItemsForParent(services, lineItems, p.id);

      if (filters.lineItemStatus) {
        if (!lineItemsForP.some((li) => li.status === filters.lineItemStatus)) {
          return false;
        }
      }

      if (filters.responsible && p.responsible !== filters.responsible) {
        return false;
      }

      if (filters.audience === "__unset__") {
        if ((p.audience || "").trim()) return false;
      } else if (filters.audience && p.audience !== filters.audience) {
        return false;
      }

      if (countryQ) {
        if (!(p.countryCode || "").toLowerCase().includes(countryQ)) {
          return false;
        }
      }

      if (filters.currency) {
        if (parentCurrency(p) !== filters.currency) return false;
      }

      const cap = budgetCap(p);
      if (filters.hasBudgetCap === "yes" && cap == null) return false;
      if (filters.hasBudgetCap === "no" && cap != null) return false;

      const alloc = allocatedForParent(services, p.id);
      const over = cap != null && alloc > cap;
      if (filters.allocation === "ok" && (over || cap == null)) return false;
      if (filters.allocation === "over" && !over) return false;

      if (filters.hasLineItems === "yes" && lineItemsForP.length === 0) {
        return false;
      }
      if (filters.hasLineItems === "no" && lineItemsForP.length > 0) {
        return false;
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

    list = sortParents(list, sortBy, services, lineItems);
    return list;
  }, [parents, services, lineItems, filters, sortBy]);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );

  return {
    filters,
    setFilters,
    updateFilter,
    sortBy,
    setSortBy,
    resetFilters,
    filteredParents,
    activeFilterCount,
  };
}
