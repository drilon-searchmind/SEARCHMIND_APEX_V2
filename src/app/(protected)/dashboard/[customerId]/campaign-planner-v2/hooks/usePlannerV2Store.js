"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PLANNER_V2_DEFAULT_CURRENCY } from "../constants";
import { createId } from "../lib/ids";

const storageKey = (customerId) =>
  `campaign-planner-v2:${customerId || "default"}`;

function emptyState() {
  return { parents: [], services: [], lineItems: [] };
}

function normalizeLineItem(li) {
  const { comments: _ignored, ...rest } = li;
  const formats = Array.isArray(rest.formats)
    ? rest.formats
    : rest.format
      ? [rest.format]
      : [];
  return {
    ...rest,
    formats,
    format: formats[0] || rest.format || "",
    budget:
      rest.budget === "" || rest.budget == null || Number.isNaN(Number(rest.budget))
        ? null
        : Number(rest.budget),
  };
}

function loadState(customerId) {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(customerId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const lineItems = Array.isArray(parsed.lineItems)
      ? parsed.lineItems.map(normalizeLineItem)
      : [];
    return {
      parents: Array.isArray(parsed.parents) ? parsed.parents : [],
      services: Array.isArray(parsed.services) ? parsed.services : [],
      lineItems,
    };
  } catch {
    return emptyState();
  }
}

function saveState(customerId, state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(customerId), JSON.stringify(state));
  } catch (e) {
    console.error("campaign-planner-v2: failed to save", e);
  }
}

function buildServiceRowsFromParent(parent) {
  const services = parent.services || [];
  return services.map((serviceName) => ({
    id: createId(),
    parentId: parent.id,
    serviceName,
    startDate: parent.startDate || "",
    endDate: parent.alwaysOn ? "" : parent.endDate || "",
    alwaysOn: !!parent.alwaysOn,
    budget: null,
  }));
}

/**
 * Keep service rows in sync when parent.services changes.
 */
function reconcileServices(prevServices, prevLineItems, parent) {
  const parentId = parent.id;
  const wanted = new Set(parent.services || []);
  const droppedServiceIds = new Set(
    prevServices
      .filter(
        (s) => s.parentId === parentId && !wanted.has(s.serviceName)
      )
      .map((s) => s.id)
  );
  const keptServices = prevServices.filter(
    (s) => s.parentId !== parentId || wanted.has(s.serviceName)
  );
  const lineItems = prevLineItems.filter(
    (li) => !droppedServiceIds.has(li.serviceId)
  );

  const existingNames = new Set(
    keptServices.filter((s) => s.parentId === parentId).map((s) => s.serviceName)
  );
  const toAdd = [...wanted].filter((name) => !existingNames.has(name));
  const newRows = toAdd.map((serviceName) => ({
    id: createId(),
    parentId,
    serviceName,
    startDate: parent.startDate || "",
    endDate: parent.alwaysOn ? "" : parent.endDate || "",
    alwaysOn: !!parent.alwaysOn,
    budget: null,
  }));

  return {
    services: [...keptServices, ...newRows],
    lineItems,
  };
}

export default function usePlannerV2Store(customerId) {
  const [state, setState] = useState(emptyState);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage after mount */
  useEffect(() => {
    setState(loadState(customerId));
    setHydrated(true);
  }, [customerId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    saveState(customerId, state);
  }, [customerId, state, hydrated]);

  const createParent = useCallback((payload) => {
    const parent = {
      id: createId(),
      customerId,
      campaignName: payload.campaignName,
      services: payload.services,
      responsible: payload.responsible || "",
      startDate: payload.startDate || "",
      endDate: payload.alwaysOn ? "" : payload.endDate || "",
      alwaysOn: !!payload.alwaysOn,
      materialLink: payload.materialLink || "",
      brief: payload.brief || "",
      furtherBrief: payload.furtherBrief || "",
      countryCode: payload.countryCode || "",
      totalBudget:
        payload.totalBudget === "" || payload.totalBudget == null
          ? null
          : Number(payload.totalBudget),
      landingPageLink: payload.landingPageLink || "",
      audience: payload.audience || "",
      budgetCurrency: payload.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const serviceRows = buildServiceRowsFromParent(parent);

    setState((prev) => ({
      parents: [...prev.parents, parent],
      services: [...prev.services, ...serviceRows],
      lineItems: prev.lineItems,
    }));

    return parent.id;
  }, [customerId]);

  const updateParent = useCallback((parentId, payload) => {
    setState((prev) => {
      const parent = prev.parents.find((p) => p.id === parentId);
      if (!parent) return prev;

      const nextParent = {
        ...parent,
        ...payload,
        endDate: payload.alwaysOn
          ? ""
          : payload.endDate !== undefined
            ? payload.endDate
            : parent.endDate,
        updatedAt: new Date().toISOString(),
      };
      if (payload.totalBudget !== undefined) {
        nextParent.totalBudget =
          payload.totalBudget === "" || payload.totalBudget == null
            ? null
            : Number(payload.totalBudget);
      }
      if (payload.budgetCurrency !== undefined) {
        nextParent.budgetCurrency =
          payload.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY;
      }

      const { services, lineItems } = reconcileServices(
        prev.services,
        prev.lineItems,
        nextParent
      );

      const parents = prev.parents.map((p) =>
        p.id === parentId ? nextParent : p
      );

      return { parents, services, lineItems };
    });
  }, []);

  const deleteParent = useCallback((parentId) => {
    setState((prev) => {
      const serviceIds = new Set(
        prev.services.filter((s) => s.parentId === parentId).map((s) => s.id)
      );
      return {
        parents: prev.parents.filter((p) => p.id !== parentId),
        services: prev.services.filter((s) => s.parentId !== parentId),
        lineItems: prev.lineItems.filter((li) => !serviceIds.has(li.serviceId)),
      };
    });
  }, []);

  const updateService = useCallback((serviceId, patch) => {
    setState((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === serviceId ? { ...s, ...patch } : s
      ),
    }));
  }, []);

  const createLineItem = useCallback((serviceId, payload) => {
    const formats = Array.isArray(payload.formats)
      ? payload.formats
      : payload.format
        ? [payload.format]
        : [];
    const item = normalizeLineItem({
      id: createId(),
      serviceId,
      name: payload.name,
      media: payload.media || "",
      format: formats[0] || "",
      formats,
      startDate: payload.startDate || "",
      endDate: payload.alwaysOn ? "" : payload.endDate || "",
      alwaysOn: !!payload.alwaysOn,
      status: payload.status || "Pending",
      approvalLink: payload.approvalLink || "",
      budget:
        payload.budget === "" || payload.budget == null
          ? null
          : Number(payload.budget),
    });
    setState((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, item],
    }));
    return item.id;
  }, []);

  const updateLineItem = useCallback((lineItemId, patch) => {
    setState((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li) => {
        if (li.id !== lineItemId) return li;
        const next = { ...li, ...patch };
        if (patch.alwaysOn === true) next.endDate = "";
        if (Array.isArray(patch.formats)) {
          next.formats = patch.formats;
          next.format = patch.formats[0] || "";
        }
        if (patch.budget !== undefined) {
          next.budget =
            patch.budget === "" || patch.budget == null
              ? null
              : Number(patch.budget);
        }
        return normalizeLineItem(next);
      }),
    }));
  }, []);

  const deleteLineItem = useCallback((lineItemId) => {
    setState((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((li) => li.id !== lineItemId),
    }));
  }, []);

  const setLineItemStatus = useCallback((lineItemId, status) => {
    updateLineItem(lineItemId, { status });
  }, [updateLineItem]);

  const lineItemsWithContext = useMemo(() => {
    return state.lineItems.map((li) => {
      const svc = state.services.find((s) => s.id === li.serviceId);
      const parent = svc
        ? state.parents.find((p) => p.id === svc.parentId)
        : null;
      return {
        ...li,
        _serviceName: svc?.serviceName,
        _parentName: parent?.campaignName,
        _parentId: parent?.id,
      };
    });
  }, [state.lineItems, state.services, state.parents]);

  return {
    ...state,
    hydrated,
    lineItemsWithContext,
    createParent,
    updateParent,
    deleteParent,
    updateService,
    createLineItem,
    updateLineItem,
    deleteLineItem,
    setLineItemStatus,
  };
}
