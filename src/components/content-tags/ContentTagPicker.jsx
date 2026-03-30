"use client";

import React, { useCallback, useEffect, useState } from "react";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
import { TAG_COLOR_PRESETS, inlineTagStyle } from "./tagPresets";

/**
 * @param {"tools"|"news"} scope
 * @param {string[]} value — selected slugs
 * @param {(slugs: string[]) => void} onChange
 * @param {boolean} canCreate — admins can POST new tags
 */
export default function ContentTagPicker({ scope, value, onChange, canCreate = false, disabled = false }) {
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newLabel, setNewLabel] = useState("");
    const [newColor, setNewColor] = useState(TAG_COLOR_PRESETS[0]);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/content-tags?scope=${encodeURIComponent(scope)}`);
            const d = await r.json();
            if (r.ok) setAllTags(Array.isArray(d.tags) ? d.tags : []);
            else setAllTags([]);
        } catch {
            setAllTags([]);
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = (slug) => {
        if (disabled) return;
        const set = new Set(value || []);
        if (set.has(slug)) set.delete(slug);
        else set.add(slug);
        onChange([...set]);
    };

    const handleCreate = async () => {
        if (!newLabel.trim() || !canCreate) return;
        setCreating(true);
        try {
            const r = await fetch("/api/admin/content-tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: newLabel.trim(),
                    color: newColor,
                    scopes: [scope],
                }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                showToast({ type: "error", message: d.error || "Could not create tag" });
                return;
            }
            showToast({ type: "success", message: "Tag created" });
            const slug = d.tag?.slug;
            setNewLabel("");
            await load();
            if (slug) onChange([...new Set([...(value || []), slug])]);
        } catch {
            showToast({ type: "error", message: "Could not create tag" });
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-3">
            <FormLabel>Tags</FormLabel>
            {loading ? (
                <p className="text-sm text-gray-500">Loading tags…</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {allTags.map((t) => {
                        const sel = (value || []).includes(t.slug);
                        return (
                            <button
                                key={t.slug}
                                type="button"
                                disabled={disabled}
                                onClick={() => toggle(t.slug)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity ${
                                    sel ? "ring-2 ring-offset-1 ring-[var(--color-primary-searchmind)]" : "opacity-90 hover:opacity-100"
                                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                                style={inlineTagStyle(t.color)}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {canCreate && (
                <div className="mt-3 p-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Create tag (admin)</p>
                    <p className="text-[0.7rem] text-gray-500">
                        New names are normalized to one canonical tag (no duplicate &quot;Shopify&quot; / &quot;shopify&quot;).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            disabled={disabled || creating}
                            placeholder="Tag name"
                            className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
                        />
                        <select
                            value={newColor}
                            onChange={(e) => setNewColor(e.target.value)}
                            disabled={disabled || creating}
                            className="h-10 rounded-lg border border-gray-300 px-2 text-sm"
                        >
                            {TAG_COLOR_PRESETS.map((c) => (
                                <option key={c} value={c} style={{ backgroundColor: c, color: "#fff" }}>
                                    {c}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={disabled || creating || !newLabel.trim()}
                            onClick={handleCreate}
                            className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 shrink-0"
                        >
                            {creating ? "Adding…" : "Add tag"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
