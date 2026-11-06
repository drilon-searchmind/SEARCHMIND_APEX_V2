"use client";

import React, { useState } from "react";
import { FiFilter } from "react-icons/fi";

/**
 * Reusable campaign name filter for custom dashboards (off by default).
 *
 * `value` / `onApply` use this shape (the same one the dashboard passes on to the API helpers):
 *   { enabled: boolean, google: { include, exclude }, meta: { include, exclude } }
 * Terms are comma separated and matched as "campaign name contains term" (case-insensitive).
 *
 * `channels`: which channels get inputs, for example [{ key: "google", label: "Google Ads" }].
 * `presets`: optional shortcuts, [{ id, label, google: {...}, meta: {...} }].
 */
export default function CampaignFilterBar({ value, onApply, channels, presets = [] }) {
    // Draft edits stay local until Apply, so typing does not trigger a refetch.
    const [draft, setDraft] = useState(value);
    const [open, setOpen] = useState(Boolean(value.enabled));

    const dirty = JSON.stringify(draft) !== JSON.stringify(value);

    const setField = (channel, field, text) =>
        setDraft((d) => ({ ...d, [channel]: { ...d[channel], [field]: text } }));

    const toggle = () => {
        const next = { ...draft, enabled: !draft.enabled };
        setDraft(next);
        setOpen(next.enabled);
        // Switching off applies immediately; switching on waits for the terms and Apply.
        if (!next.enabled) onApply(next);
    };

    const applyPreset = (id) => {
        const preset = presets.find((p) => p.id === id);
        if (!preset) return;
        setDraft((d) => ({ ...d, google: { ...preset.google }, meta: { ...preset.meta } }));
    };

    return (
        <section className="cd-filter" aria-label="Campaign filter">
            <div className="cd-filter__bar">
                <button
                    type="button"
                    role="switch"
                    aria-checked={draft.enabled}
                    className={`cd-filter__switch${draft.enabled ? " is-on" : ""}`}
                    onClick={toggle}
                >
                    <span className="cd-filter__knob" />
                    <span className="sr-only">Campaign filter</span>
                </button>
                <span className="cd-filter__title">
                    <FiFilter aria-hidden="true" /> Campaign filter
                </span>
                <span className={`cd-filter__state${value.enabled ? " is-active" : ""}`}>
                    {value.enabled ? "Active" : "Off, all campaigns"}
                </span>
            </div>

            {open && draft.enabled ? (
                <div className="cd-filter__panel">
                    {presets.length > 0 ? (
                        <label className="cd-filter__preset">
                            <span>Preset</span>
                            <select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                                <option value="">Choose a preset</option>
                                {presets.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}

                    <div className="cd-filter__grid">
                        {channels.map((c) => (
                            <fieldset key={c.key} className="cd-filter__channel">
                                <legend>{c.label}</legend>
                                <label>
                                    <span>Only campaigns containing</span>
                                    <input
                                        type="text"
                                        value={draft[c.key]?.include || ""}
                                        onChange={(e) => setField(c.key, "include", e.target.value)}
                                        placeholder="e.g. ladeboks, emob"
                                    />
                                </label>
                                <label>
                                    <span>Exclude campaigns containing</span>
                                    <input
                                        type="text"
                                        value={draft[c.key]?.exclude || ""}
                                        onChange={(e) => setField(c.key, "exclude", e.target.value)}
                                        placeholder="e.g. brand"
                                    />
                                </label>
                            </fieldset>
                        ))}
                    </div>

                    <div className="cd-filter__actions">
                        <p className="cd-filter__hint">Separate several terms with commas. A campaign matches if its name contains any of them.</p>
                        <button type="button" className="apex-perf-btn apex-perf-btn--primary" disabled={!dirty} onClick={() => onApply(draft)}>
                            Apply filter
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
