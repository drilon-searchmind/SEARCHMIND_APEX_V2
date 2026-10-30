"use client";

import React from "react";
import Select from "react-select";
import { FiCheck, FiInfo, FiLayers, FiPlus, FiRefreshCw, FiX } from "react-icons/fi";

const COUNTRY_SELECT_STYLES = {
    control: (base, state) => ({
        ...base,
        minHeight: 46,
        borderRadius: 14,
        borderColor: state.isFocused ? "#3A9B3F" : "#D2DBD0",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(58, 155, 63, 0.18)" : "none",
        fontSize: "0.92rem",
        fontWeight: 500,
        backgroundColor: state.isFocused ? "#ffffff" : "#F3F8F1",
        "&:hover": { borderColor: state.isFocused ? "#3A9B3F" : "#4C564D" },
    }),
    menu: (base) => ({ ...base, zIndex: 50, backgroundColor: "#F6FAF4", border: "1px solid #E0E7DE", borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 40px -20px rgba(17,26,18,0.35)" }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.9rem",
        fontWeight: state.isSelected ? 700 : 500,
        backgroundColor: state.isSelected ? "#DFF3DB" : state.isFocused ? "#EAF0E8" : "transparent",
        color: "#121A13",
        "&:active": { backgroundColor: "#DFF3DB" },
    }),
    singleValue: (base) => ({ ...base, color: "#121A13" }),
    input: (base) => ({ ...base, color: "#121A13" }),
    placeholder: (base) => ({ ...base, color: "#859085" }),
    indicatorSeparator: () => ({ display: "none" }),
};

function KeywordChip({ label, selected, onToggle, onRemove, nested = false }) {
    return (
        <span className={`apex-sos-chip${selected ? " is-selected" : ""}${nested ? " is-nested" : ""}`}>
            {onToggle ? (
                <button type="button" className="apex-sos-chip__main" onClick={onToggle} aria-pressed={selected} title="Select to group with other keywords">
                    <span className="apex-sos-chip__tick" aria-hidden>
                        {selected ? <FiCheck /> : null}
                    </span>
                    {label}
                </button>
            ) : (
                <span className="apex-sos-chip__main">{label}</span>
            )}
            <button type="button" className="apex-sos-chip__remove" onClick={onRemove} aria-label={`Remove ${label}`}>
                <FiX aria-hidden />
            </button>
        </span>
    );
}

/** Keywords, grouping, country and the fetch button: everything needed to run a search. */
export default function SosSetup({
    brands,
    groups,
    ungroupedBrands,
    selectedForGroup,
    draft,
    setDraft,
    addBrand,
    removeBrand,
    toggleSelected,
    addSelectionToGroup,
    createGroupFromSelection,
    dissolveGroup,
    groupNameDraft,
    setGroupNameDraft,
    clearSelection,
    groupsSaving,
    countryOptions,
    countryValue,
    onCountryChange,
    loading,
    onFetch,
    onClear,
    error,
}) {
    const selectedCount = selectedForGroup.size;
    const hasSelection = selectedCount > 0;

    return (
        <section className="apex-sos-card apex-sos-setup" aria-labelledby="sos-setup-title">
            <div className="apex-sos-setup__keywords">
                <div className="apex-sos-card__head">
                    <h2 id="sos-setup-title" className="apex-sos-card__title">
                        Keywords
                    </h2>
                    <span className="apex-sos-count">{brands.length}</span>
                    {groupsSaving ? <span className="apex-sos-saving">Saving</span> : null}
                </div>

                <div className="apex-sos-add">
                    <input
                        type="text"
                        className="apex-sos-input"
                        placeholder="Add a brand or keyword, then press Enter"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addBrand();
                            }
                        }}
                        aria-label="Add a keyword"
                    />
                    <button type="button" className="apex-sos-btn apex-sos-btn--primary apex-sos-btn--icon" onClick={addBrand} aria-label="Add keyword" disabled={!draft.trim()}>
                        <FiPlus aria-hidden />
                    </button>
                </div>

                {brands.length === 0 ? (
                    <p className="apex-sos-empty">Add the brands you want to compare, for example your own and two competitors. Each one is fetched separately.</p>
                ) : (
                    <div className="apex-sos-keywords">
                        {groups.map((g) => (
                            <div key={g.id} className="apex-sos-group">
                                <div className="apex-sos-group__head">
                                    <span className="apex-sos-group__name">
                                        <FiLayers aria-hidden />
                                        {g.name}
                                        <span className="apex-sos-group__count">{g.brands.length}</span>
                                    </span>
                                    {hasSelection ? (
                                        <button type="button" className="apex-sos-link" onClick={() => addSelectionToGroup(g.id)}>
                                            <FiPlus aria-hidden /> Add {selectedCount} selected
                                        </button>
                                    ) : (
                                        <button type="button" className="apex-sos-link" onClick={() => dissolveGroup(g.id)}>
                                            Ungroup
                                        </button>
                                    )}
                                </div>
                                <div className="apex-sos-group__members">
                                    {g.brands.map((b) => (
                                        <KeywordChip key={b} label={b} nested onRemove={() => removeBrand(b)} />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {ungroupedBrands.length > 0 ? (
                            <div className="apex-sos-chips">
                                {ungroupedBrands.map((b) => (
                                    <KeywordChip key={b} label={b} selected={selectedForGroup.has(b)} onToggle={() => toggleSelected(b)} onRemove={() => removeBrand(b)} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}

                {hasSelection ? (
                    <div className="apex-sos-groupbar" role="group" aria-label="Group the selected keywords">
                        <span className="apex-sos-groupbar__count">{selectedCount} selected</span>
                        {selectedCount >= 2 ? (
                            <>
                                <input
                                    type="text"
                                    className="apex-sos-input apex-sos-input--sm"
                                    placeholder="Group name (optional)"
                                    value={groupNameDraft}
                                    onChange={(e) => setGroupNameDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            createGroupFromSelection();
                                        }
                                    }}
                                    aria-label="Group name"
                                />
                                <button type="button" className="apex-sos-btn apex-sos-btn--primary apex-sos-btn--sm" onClick={createGroupFromSelection}>
                                    <FiLayers aria-hidden /> Group them
                                </button>
                            </>
                        ) : (
                            <span className="apex-sos-groupbar__hint">Select one more to make a group, or add it to an existing group above.</span>
                        )}
                        <button type="button" className="apex-sos-btn apex-sos-btn--sm" onClick={clearSelection}>
                            Cancel
                        </button>
                    </div>
                ) : brands.length > 1 ? (
                    <p className="apex-sos-hint">Tip: tick two or more keywords to combine them into one group, for example a brand and its misspellings.</p>
                ) : null}
            </div>

            <div className="apex-sos-setup__run">
                <div className="apex-sos-card__head">
                    <h2 className="apex-sos-card__title">Market</h2>
                </div>
                <label className="apex-sos-label" htmlFor="sos-country">
                    Country
                </label>
                <Select
                    inputId="sos-country"
                    instanceId="sos-country"
                    options={countryOptions}
                    value={countryValue}
                    onChange={onCountryChange}
                    isSearchable
                    isClearable={false}
                    placeholder="Search country"
                    styles={COUNTRY_SELECT_STYLES}
                />
                <p className="apex-sos-hint">The date range is set at the top of the page.</p>

                <div className="apex-sos-run">
                    <button type="button" className="apex-sos-btn apex-sos-btn--primary apex-sos-btn--lg" disabled={loading || brands.length === 0} onClick={onFetch}>
                        <FiRefreshCw className={loading ? "is-spinning" : ""} aria-hidden />
                        {loading ? "Fetching" : "Fetch data"}
                    </button>
                    <button type="button" className="apex-sos-btn" disabled={loading || (brands.length === 0 && !draft.trim())} onClick={onClear}>
                        Clear
                    </button>
                </div>

                {error ? (
                    <p className="apex-sos-alert" role="alert">
                        {error}
                    </p>
                ) : null}

                <details className="apex-sos-how">
                    <summary>
                        <FiInfo aria-hidden /> How this is calculated
                    </summary>
                    <p>
                        Data comes from <strong>Google Ads Keyword Planner</strong> (Google Search). Each brand is sent as a keyword and we use the matched idea&apos;s monthly search volumes for your country and dates. Share of Search is each brand&apos;s percentage of the{" "}
                        <em>sum of the brands you listed</em>, not of the whole market.
                    </p>
                </details>
            </div>
        </section>
    );
}
