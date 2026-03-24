"use client";

import React, { useEffect, useState } from "react";
import { FiChevronDown, FiChevronUp, FiX } from "react-icons/fi";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={24} />
        </button>
        <h2 className="text-xl font-bold mb-6 text-gray-900">
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
            <p className="text-xs text-gray-500 mb-2">
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      on
                        ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
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
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
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
            <label htmlFor="v2-alwaysOn" className="text-sm text-gray-700">
              Always on
            </label>
          </div>

          <div>
            <FormLabel htmlFor="v2-startDate">Start date</FormLabel>
            <input
              id="v2-startDate"
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <FormLabel htmlFor="v2-endDate">End date</FormLabel>
            <input
              id="v2-endDate"
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              disabled={form.alwaysOn}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 disabled:bg-gray-100"
            />
          </div>

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
              className="mt-2 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
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
              className="mt-2 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
            />
          </div>

          <div className="md:col-span-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-950"
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
                      className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
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
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 px-5 rounded-lg text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] text-sm font-semibold"
            >
              {mode === "edit" ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
