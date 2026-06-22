"use client";

import React, { useEffect, useState } from "react";
import { FiChevronDown, FiChevronUp, FiX } from "react-icons/fi";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import {
  PLANNER_V2_BUDGET_CURRENCIES,
  PLANNER_V2_DEFAULT_CURRENCY,
  PLANNER_V2_SERVICES,
} from "../constants";

const defaultForm = () => ({
  campaignName: "",
  services: [],
  responsible: "searchmind",
  startDate: "",
  endDate: "",
  alwaysOn: false,
  materialLink: "",
  brief: "",
  furtherBrief: "",
  countryCode: "",
  totalBudget: "",
  landingPageLink: "",
  audience: "",
  budgetCurrency: PLANNER_V2_DEFAULT_CURRENCY,
});

export default function ParentCampaignModal({
  open,
  onClose,
  onSave,
  initialParent,
  mode = "create",
}) {
  const [form, setForm] = useState(defaultForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialParent && mode === "edit") {
      setForm({
        campaignName: initialParent.campaignName || "",
        services: initialParent.services || [],
        responsible: initialParent.responsible || "searchmind",
        startDate: initialParent.startDate || "",
        endDate: initialParent.endDate || "",
        alwaysOn: !!initialParent.alwaysOn,
        materialLink: initialParent.materialLink || "",
        brief: initialParent.brief || "",
        furtherBrief: initialParent.furtherBrief || "",
        countryCode: initialParent.countryCode || "",
        totalBudget:
          initialParent.totalBudget != null ? String(initialParent.totalBudget) : "",
        landingPageLink: initialParent.landingPageLink || "",
        audience: initialParent.audience || "",
        budgetCurrency:
          initialParent.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY,
      });
    } else {
      setForm(defaultForm());
    }
    setAdvancedOpen(false);
  }, [open, initialParent, mode]);

  const toggleService = (name) => {
    setForm((prev) => {
      const has = prev.services.includes(name);
      return {
        ...prev,
        services: has
          ? prev.services.filter((s) => s !== name)
          : [...prev.services, name],
      };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "alwaysOn") {
      setForm((prev) => ({
        ...prev,
        alwaysOn: checked,
        endDate: checked ? "" : prev.endDate,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.campaignName.trim() || form.services.length === 0) return;
    onSave({
      campaignName: form.campaignName.trim(),
      services: form.services,
      responsible: form.responsible,
      startDate: form.startDate,
      endDate: form.alwaysOn ? "" : form.endDate,
      alwaysOn: form.alwaysOn,
      materialLink: form.materialLink.trim(),
      brief: form.brief.trim(),
      furtherBrief: form.furtherBrief.trim(),
      countryCode: form.countryCode.trim(),
      totalBudget: form.totalBudget === "" ? null : form.totalBudget,
      landingPageLink: form.landingPageLink.trim(),
      audience: form.audience,
      budgetCurrency: form.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="apex-cp-modal-backdrop" data-theme="cobalt">
      <div className="apex-cp-modal max-w-2xl">
        <button
          type="button"
          className="apex-cp-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={24} />
        </button>
        <h2 className="apex-cp-panel-card__title mb-6">
          {mode === "edit" ? "Edit campaign" : "Create campaign"}
        </h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <FormLabel htmlFor="v2-campaignName" required>
              Campaign name
            </FormLabel>
            <FormInputText
              id="v2-campaignName"
              name="campaignName"
              value={form.campaignName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="md:col-span-2">
            <FormLabel required>Services</FormLabel>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Select one or more — click to add or remove (no Ctrl/Cmd needed).
            </p>
            <div className="flex flex-wrap gap-2">
              {PLANNER_V2_SERVICES.map((s) => {
                const on = form.services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    className={`apex-cp-btn ${on ? "apex-cp-tab is-active" : ""}`}
                  >
                    {on ? "✓ " : ""}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FormLabel htmlFor="v2-responsible">Responsible</FormLabel>
            <select
              id="v2-responsible"
              name="responsible"
              value={form.responsible}
              onChange={handleChange}
              className="apex-cp-select mt-2"
            >
              <option value="searchmind">Searchmind</option>
              <option value="kunde">Internal</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-8">
            <input
              id="v2-alwaysOn"
              name="alwaysOn"
              type="checkbox"
              checked={form.alwaysOn}
              onChange={handleChange}
              className="rounded border-gray-300"
            />
            <label htmlFor="v2-alwaysOn" className="text-sm text-[var(--color-ink-2)]">
              Always on
            </label>
          </div>

          {form.alwaysOn ? (
            <div className="md:col-span-2">
              <FormLabel htmlFor="v2-startDate-ao">Start date (always on)</FormLabel>
              <input
                id="v2-startDate-ao"
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="apex-cp-select mt-2"
              />
            </div>
          ) : (
            <div className="md:col-span-2">
              <FormLabel>Schedule (same date range control as in Apex / Overview)</FormLabel>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DateRangePicker
                  variant="cobalt"
                  usePortal
                  onApply={() => {}}
                  startDate={form.startDate}
                  endDate={form.endDate}
                  onStartDateChange={(v) =>
                    setForm((p) => ({ ...p, startDate: v }))
                  }
                  onEndDateChange={(v) => setForm((p) => ({ ...p, endDate: v }))}
                />
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <FormLabel htmlFor="v2-materialLink">Link to material</FormLabel>
            <FormInputText
              id="v2-materialLink"
              name="materialLink"
              value={form.materialLink}
              onChange={handleChange}
              placeholder="https://"
            />
          </div>

          <div className="md:col-span-2">
            <FormLabel htmlFor="v2-brief">Campaign brief</FormLabel>
            <textarea
              id="v2-brief"
              name="brief"
              value={form.brief}
              onChange={handleChange}
              rows={3}
              className="apex-cp-select mt-2 w-full min-h-[5.5rem] py-2"
            />
          </div>

          <div className="md:col-span-2">
            <FormLabel htmlFor="v2-furtherBrief">Further brief</FormLabel>
            <textarea
              id="v2-furtherBrief"
              name="furtherBrief"
              value={form.furtherBrief}
              onChange={handleChange}
              rows={2}
              className="apex-cp-select mt-2 w-full min-h-[5.5rem] py-2"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--color-rule)] pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-ink-2)]"
            >
              Advanced
              {advancedOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <FormLabel htmlFor="v2-country">Country code</FormLabel>
                  <FormInputText
                    id="v2-country"
                    name="countryCode"
                    value={form.countryCode}
                    onChange={handleChange}
                    placeholder="DK"
                  />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <FormLabel htmlFor="v2-totalBudget">Total budget</FormLabel>
                    <FormInputText
                      id="v2-totalBudget"
                      name="totalBudget"
                      type="number"
                      min="0"
                      step="1"
                      value={form.totalBudget}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <FormLabel htmlFor="v2-budgetCurrency">Currency</FormLabel>
                    <select
                      id="v2-budgetCurrency"
                      name="budgetCurrency"
                      value={form.budgetCurrency}
                      onChange={handleChange}
                      className="apex-cp-select mt-2"
                    >
                      {PLANNER_V2_BUDGET_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <FormLabel htmlFor="v2-landing">Link to landing page</FormLabel>
                  <FormInputText
                    id="v2-landing"
                    name="landingPageLink"
                    value={form.landingPageLink}
                    onChange={handleChange}
                    placeholder="https://"
                  />
                </div>
                <div className="md:col-span-2">
                  <FormLabel htmlFor="v2-audience">B2B / B2C</FormLabel>
                  <select
                    id="v2-audience"
                    name="audience"
                    value={form.audience}
                    onChange={handleChange}
                    className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
                  >
                    <option value="">—</option>
                    <option value="B2B">B2B</option>
                    <option value="B2C">B2C</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="apex-cp-btn">
              Cancel
            </button>
            <button type="submit" className="apex-perf-btn apex-perf-btn--primary">
              {mode === "edit" ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
