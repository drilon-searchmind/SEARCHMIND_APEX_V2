"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDemoCustomerId } from "@/lib/demoCustomerId";
import { PLANNER_V2_DEFAULT_CURRENCY } from "../constants";
import { createId } from "../lib/ids";
import { normalizeLineItemStatus } from "../lib/lineItemStatus";

const storageKey = (customerId) =>
  `campaign-planner-v2:${customerId || "default"}`;

function emptyState() {
  return {
    parents: [],
    services: [],
    lineItems: [],
    customFormats: [],
    extraMediaByService: {},
  };
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
    status: normalizeLineItemStatus(rest.status),
    budget:
      rest.budget === "" || rest.budget == null || Number.isNaN(Number(rest.budget))
        ? null
        : Number(rest.budget),
  };
}

function normalizeExtraMedia(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) out[k] = v.map(String);
  }
  return out;
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
      customFormats: Array.isArray(parsed.customFormats) ? parsed.customFormats : [],
      extraMediaByService: normalizeExtraMedia(parsed.extraMediaByService),
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

function hasWorkspaceRows(s) {
  return (
    (s.parents?.length > 0) ||
    (s.services?.length > 0) ||
    (s.lineItems?.length > 0)
  );
}

export default function usePlannerV2Store(customerId) {
  const [state, setState] = useState(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const remoteSaveTimerRef = useRef(null);

  useEffect(() => {
    if (!customerId) {
      setState(emptyState());
      setHydrated(true);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    setState(emptyState());

    if (isDemoCustomerId(customerId)) {
      setState(loadState(customerId));
      setHydrated(true);
      return;
    }

    (async () => {
      const local = loadState(customerId);
      try {
        const res = await fetch(
          `/api/campaign-planner/${customerId}/workspace`
        );
        if (!res.ok) throw new Error("workspace fetch failed");
        const remote = await res.json();
        if (cancelled) return;

        if (hasWorkspaceRows(remote)) {
          setState({
            parents: remote.parents || [],
            services: remote.services || [],
            lineItems: (remote.lineItems || []).map(normalizeLineItem),
            customFormats: Array.isArray(remote.customFormats)
              ? remote.customFormats
              : [],
            extraMediaByService: normalizeExtraMedia(remote.extraMediaByService),
          });
        } else if (hasWorkspaceRows(local)) {
          const next = {
            parents: local.parents,
            services: local.services,
            lineItems: local.lineItems,
            customFormats: local.customFormats || [],
            extraMediaByService: local.extraMediaByService || {},
          };
          setState(next);
          await fetch(`/api/campaign-planner/${customerId}/workspace`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
        }
      } catch {
        if (!cancelled) setState(local);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!hydrated || !customerId) return;

    saveState(customerId, state);

    if (isDemoCustomerId(customerId)) return;

    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
    }
    remoteSaveTimerRef.current = setTimeout(() => {
      fetch(`/api/campaign-planner/${customerId}/workspace`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parents: state.parents,
          services: state.services,
          lineItems: state.lineItems,
        }),
      }).catch((e) =>
        console.error("campaign-planner-v2: failed to save workspace", e)
      );
    }, 600);

    return () => {
      if (remoteSaveTimerRef.current) {
        clearTimeout(remoteSaveTimerRef.current);
      }
    };
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
      ...prev,
      parents: [...prev.parents, parent],
      services: [...prev.services, ...serviceRows],
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

      return { ...prev, parents, services, lineItems };
    });
  }, []);

  const deleteParent = useCallback((parentId) => {
    setState((prev) => {
      const serviceIds = new Set(
        prev.services.filter((s) => s.parentId === parentId).map((s) => s.id)
      );
      return {
        ...prev,
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
      status: normalizeLineItemStatus(payload.status || "Pending Searchmind"),
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
        if (patch.status !== undefined) {
          next.status = normalizeLineItemStatus(patch.status);
        }
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
    updateLineItem(lineItemId, { status: normalizeLineItemStatus(status) });
  }, [updateLineItem]);

  const duplicateLineItem = useCallback((lineItemId) => {
    setState((prev) => {
      const li = prev.lineItems.find((x) => x.id === lineItemId);
      if (!li) return prev;
      const base = normalizeLineItem({
        ...li,
        id: createId(),
        name: li.name ? `${li.name} (copy)` : "Copy",
      });
      return { ...prev, lineItems: [...prev.lineItems, base] };
    });
  }, []);

  const addCustomFormat = useCallback((label) => {
    const t = String(label || "").trim();
    if (!t) return;
    setState((prev) => ({
      ...prev,
      customFormats: prev.customFormats.includes(t)
        ? prev.customFormats
        : [...prev.customFormats, t],
    }));
  }, []);

  const addExtraMedia = useCallback((serviceName, label) => {
    const t = String(label || "").trim();
    if (!t || !serviceName) return;
    setState((prev) => {
      const by = { ...normalizeExtraMedia(prev.extraMediaByService) };
      const list = [...(by[serviceName] || [])];
      if (!list.includes(t)) list.push(t);
      by[serviceName] = list;
      return { ...prev, extraMediaByService: by };
    });
  }, []);

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
    duplicateLineItem,
    addCustomFormat,
    addExtraMedia,
  };
}
