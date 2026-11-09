"use client";

import React, { useState } from "react";
import { FiFilter } from "react-icons/fi";
import { matchesCampaignFilter } from "@/lib/campaignNameFilter";
import { FILTER_CHANNELS, FILTER_PRESETS } from "./auraFilter";
import { buildAuraSources, fetchJson } from "./auraApi";
import { monthDates } from "./auraDailyLogic";
import AuraMonthPicker from "./AuraMonthPicker";
import { nf0 } from "./HeroKpi";

const norm = (name) => String(name || "").trim().toLowerCase();

/** Campaigns of one channel for a month, with what the filter does to each of them. */
function CampaignTest({ label, campaigns, channel, onChange }) {
    const exact = new Set((channel.excludeExact || []).map(norm));
    const rows = campaigns.map((c) => {
        const byTerms = matchesCampaignFilter(c.name, channel.include, channel.exclude);
        return { ...c, byTerms, picked: byTerms && !exact.has(norm(c.name)) };
    });
    const total = rows.reduce((s, r) => s + r.spend, 0);
    const imported = rows.filter((r) => r.picked).reduce((s, r) => s + r.spend, 0);

    const toggle = (row) => {
        const rest = (channel.excludeExact || []).filter((n) => norm(n) !== norm(row.name));
        onChange({ ...channel, excludeExact: row.picked ? [...rest, row.name] : rest });
    };

    return (
        <fieldset className="cd-filter__channel">
            <legend>{label}</legend>
            {rows.length === 0 ? (
                <p className="cd-filter__hint">No campaigns with spend in this month.</p>
            ) : (
                <>
                    <p className="cd-filter__hint">
                        Imports {nf0.format(imported)} of {nf0.format(total)} spend ({rows.filter((r) => r.picked).length} of {rows.length} campaigns).
                        Untick a campaign to exclude exactly that one.
                    </p>
                    <ul className="cd-campaigns">
                        {rows.map((r) => (
                            <li key={r.name} className={r.picked ? "is-picked" : "is-skipped"}>
                                <label>
                                    <input type="checkbox" checked={r.picked} disabled={!r.byTerms} onChange={() => toggle(r)} />
                                    <span className="cd-campaigns__name">{r.name}</span>
                                </label>
                                <span className="cd-campaigns__spend">{nf0.format(r.spend)}</span>
                                {!r.byTerms ? <span className="cd-campaigns__tag">Not matched by terms</span> : null}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </fieldset>
    );
}

/**
 * Editor for the account wide campaign filter (value / setValue are the draft in Data inputs, saved with its Save button).
 * Main filter = comma separated terms per channel. The test tool then lists the campaigns of a month, and single
 * campaigns can be excluded by their exact name on top of that.
 */
export default function AuraFilterEditor({ customerId, value, setValue }) {
    const now = new Date();
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
    const [test, setTest] = useState({ state: "idle", campaigns: null, errors: [] });

    const setChannel = (key, next) => setValue({ ...value, [key]: next });
    const setField = (key, field, text) => setChannel(key, { ...value[key], [field]: text });

    const loadCampaigns = async () => {
        setTest({ state: "loading", campaigns: null, errors: [] });
        const errors = [];
        try {
            const settings = (await fetchJson(`/api/customers/${customerId}`)).CustomerSettings || {};
            const sources = buildAuraSources(customerId, settings, null);
            const dates = monthDates(period.year, period.month);
            const range = { startDate: dates[0], endDate: dates[dates.length - 1] };
            const pull = async (build, label) => {
                if (!build) return [];
                try {
                    const json = await fetchJson(build(range));
                    return (json.campaigns_performance || [])
                        .map((c) => ({ name: c.campaign_name || "(no campaign)", spend: Number(c.ad_spend) || 0 }))
                        .filter((c) => c.spend > 0)
                        .sort((a, b) => b.spend - a.spend);
                } catch (e) {
                    errors.push(`${label}: ${e.message}`);
                    return [];
                }
            };
            const [google, meta] = await Promise.all([pull(sources.google, "Google Ads"), pull(sources.meta, "Meta")]);
            setTest({ state: "done", campaigns: { google, meta }, errors });
        } catch (e) {
            setTest({ state: "done", campaigns: { google: [], meta: [] }, errors: [e.message] });
        }
    };

    const applyPreset = (id) => {
        const preset = FILTER_PRESETS.find((p) => p.id === id);
        if (preset) setValue({ ...value, google: { ...preset.google }, meta: { ...preset.meta } });
    };

    return (
        <div className="cd-filter-editor">
            <div className="cd-editor__toolbar">
                <p className="cd-editor__hint">
                    One campaign filter for the whole account. It applies to every Aura dashboard (Performance, Pace report, Overview day), so it
                    is set up once here. Terms are matched as &quot;campaign name contains&quot;, case-insensitive.
                </p>
            </div>

            <div className="cd-filter cd-filter--editor">
                <div className="cd-filter__bar">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={value.enabled}
                        className={`cd-filter__switch${value.enabled ? " is-on" : ""}`}
                        onClick={() => setValue({ ...value, enabled: !value.enabled })}
                    >
                        <span className="cd-filter__knob" />
                        <span className="sr-only">Campaign filter</span>
                    </button>
                    <span className="cd-filter__title">
                        <FiFilter aria-hidden="true" /> Campaign filter
                    </span>
                    <span className={`cd-filter__state${value.enabled ? " is-active" : ""}`}>{value.enabled ? "On" : "Off, all campaigns"}</span>
                </div>

                <div className="cd-filter__panel">
                    <label className="cd-filter__preset">
                        <span>Preset</span>
                        <select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                            <option value="">Choose a preset</option>
                            {FILTER_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="cd-filter__grid">
                        {FILTER_CHANNELS.map((c) => (
                            <fieldset key={c.key} className="cd-filter__channel">
                                <legend>{c.label}</legend>
                                <label>
                                    <span>Only campaigns containing</span>
                                    <input
                                        type="text"
                                        value={value[c.key].include}
                                        onChange={(e) => setField(c.key, "include", e.target.value)}
                                        placeholder="e.g. ladeboks, emob"
                                    />
                                </label>
                                <label>
                                    <span>Exclude campaigns containing</span>
                                    <input
                                        type="text"
                                        value={value[c.key].exclude}
                                        onChange={(e) => setField(c.key, "exclude", e.target.value)}
                                        placeholder="e.g. brand"
                                    />
                                </label>
                                {value[c.key].excludeExact.length > 0 ? (
                                    <p className="cd-filter__hint">
                                        {value[c.key].excludeExact.length} campaign{value[c.key].excludeExact.length === 1 ? "" : "s"} excluded by exact name.{" "}
                                        <button type="button" className="apex-profile-btn-text" onClick={() => setChannel(c.key, { ...value[c.key], excludeExact: [] })}>
                                            Clear
                                        </button>
                                    </p>
                                ) : null}
                            </fieldset>
                        ))}
                    </div>
                    <p className="cd-filter__hint">Separate several terms with commas. A campaign matches if its name contains any of them.</p>
                </div>
            </div>

            <div className="cd-filter cd-filter--editor cd-filter--test">
                <div className="cd-filter__bar">
                    <span className="cd-filter__title">Test the filter</span>
                    <span className="cd-filter__state">See which campaigns a month imports</span>
                </div>
                <div className="cd-filter__panel">
                    <div className="cd-filter__test-controls">
                        <AuraMonthPicker year={period.year} month={period.month} onChange={setPeriod} />
                        <button type="button" className="apex-perf-btn" disabled={test.state === "loading"} onClick={loadCampaigns}>
                            {test.state === "loading" ? "Loading campaigns..." : "Show campaigns"}
                        </button>
                    </div>
                    {test.errors.length > 0 ? <p className="apex-ppc-error">{test.errors.join("; ")}</p> : null}
                    {test.campaigns ? (
                        <div className="cd-filter__grid">
                            {FILTER_CHANNELS.map((c) => (
                                <CampaignTest
                                    key={c.key}
                                    label={c.label}
                                    campaigns={test.campaigns[c.key]}
                                    channel={value[c.key]}
                                    onChange={(next) => setChannel(c.key, next)}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
