"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import {
  CAMPAIGN_TYPE_FORMATS,
  SERVICE_MEDIA_OPTIONS,
} from "../constants";

const defaultForm = () => ({
  name: "",
  media: "",
  format: "",
  startDate: "",
  endDate: "",
  alwaysOn: false,
  status: "Pending",
  approvalLink: "",
});

export default function LineItemModal({
  open,
  onClose,
  onSave,
  serviceName,
  initialLineItem,
  mode = "create",
}) {
  const [form, setForm] = useState(defaultForm);

  const mediaOptions = useMemo(() => {
    return SERVICE_MEDIA_OPTIONS[serviceName] || [];
  }, [serviceName]);

  useEffect(() => {
    if (!open) return;
    if (initialLineItem && mode === "edit") {
      setForm({
        name: initialLineItem.name || "",
        media: initialLineItem.media || "",
        format: initialLineItem.format || "",
        startDate: initialLineItem.startDate || "",
        endDate: initialLineItem.endDate || "",
        alwaysOn: !!initialLineItem.alwaysOn,
        status: initialLineItem.status || "Pending",
        approvalLink: initialLineItem.approvalLink || "",
      });
    } else {
      setForm(defaultForm());
    }
  }, [open, initialLineItem, mode]);

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
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      media: form.media,
      format: form.format,
      startDate: form.startDate,
      endDate: form.alwaysOn ? "" : form.endDate,
      alwaysOn: form.alwaysOn,
      status: form.status,
      approvalLink: form.approvalLink.trim(),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center glassmorphism2">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={24} />
        </button>
        <h2 className="text-xl font-bold mb-1 text-gray-900">
          {mode === "edit" ? "Edit campaign type" : "New campaign type"}
        </h2>
        {serviceName && (
          <p className="text-sm text-gray-500 mb-6">Service: {serviceName}</p>
        )}

        <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
          <div>
            <FormLabel htmlFor="li-name" required>
              Campaign type name
            </FormLabel>
            <FormInputText
              id="li-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <FormLabel htmlFor="li-media">Media</FormLabel>
            <select
              id="li-media"
              name="media"
              value={form.media}
              onChange={handleChange}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
            >
              <option value="">— Select —</option>
              {mediaOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FormLabel htmlFor="li-format">Campaign format</FormLabel>
            <select
              id="li-format"
              name="format"
              value={form.format}
              onChange={handleChange}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
            >
              <option value="">— None —</option>
              {CAMPAIGN_TYPE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="li-alwaysOn"
              name="alwaysOn"
              type="checkbox"
              checked={form.alwaysOn}
              onChange={handleChange}
              className="rounded border-gray-300"
            />
            <label htmlFor="li-alwaysOn" className="text-sm text-gray-700">
              Always on
            </label>
          </div>

          <div>
            <FormLabel htmlFor="li-start">Start date</FormLabel>
            <input
              id="li-start"
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
            />
          </div>

          {!form.alwaysOn && (
            <div>
              <FormLabel htmlFor="li-end">End date</FormLabel>
              <input
                id="li-end"
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
              />
            </div>
          )}

          <div>
            <FormLabel htmlFor="li-status">Status</FormLabel>
            <select
              id="li-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
            >
              {[
                "Pending",
                "Pending Customer Approval",
                "Approved",
                "Live",
                "Ended",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FormLabel htmlFor="li-approval">Approval link</FormLabel>
            <FormInputText
              id="li-approval"
              name="approvalLink"
              value={form.approvalLink}
              onChange={handleChange}
              placeholder="https://"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
              {mode === "edit" ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
