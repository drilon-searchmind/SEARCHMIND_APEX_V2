"use client";

import React from "react";
import Link from "next/link";
import {
    FiCheck,
    FiX,
    FiShoppingBag,
    FiUsers,
    FiTrendingUp,
    FiSearch,
    FiBarChart2,
} from "react-icons/fi";
import AdminCustomerColumnPicker, {
    useAdminCustomerOptionalColumns,
    useAdminMissingCustomerOptionalColumns,
} from "../components/AdminCustomerColumnPicker";
import { buildVisibleTableColumns } from "@root/lib/adminCustomerTableColumns";
import {
    buildVisibleMissingCustomerColumns,
    ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS,
    ADMIN_MISSING_CUSTOMER_SEARCH_FIELDS,
} from "@root/lib/adminMissingCustomerTableColumns";
import CobaltLoader from "@/components/ui/CobaltLoader";

const TABS = [
    { id: "existing", label: "Existing Customers" },
    { id: "missing", label: "Missing Customers" },
];

const CHECK_COLUMN_ICONS = {
    check_meta_id: FiUsers,
    check_shopify_woo: FiShoppingBag,
    check_facebook: FiUsers,
    check_google_ads: FiTrendingUp,
    check_search_console: FiSearch,
    check_ga4: FiBarChart2,
};

function CheckIcon({ hasValue }) {
    return hasValue ? (
        <FiCheck className="apex-admin-check-ok mx-auto" size={18} />
    ) : (
        <FiX className="apex-admin-check-no mx-auto" size={18} />
    );
}

function CellValue({ value }) {
    const text = value == null || value === "" ? "—" : String(value);
    return (
        <span className={`apex-admin-cell-mono${text === "—" ? " is-empty" : ""}`} title={text}>
            {text}
        </span>
    );
}

function MissingCellValue({ column, row }) {
    const value = row?.[column.id];
    const text = value == null || value === "" ? "—" : String(value);

    if (column.cellType === "status") {
        const status = text.toLowerCase();
        const cls =
            status === "ok"
                ? "apex-admin-badge--ok"
                : status === "error"
                  ? "apex-admin-badge--error"
                  : "apex-admin-badge--neutral";
        return <span className={`apex-admin-badge ${cls}`}>{text}</span>;
    }

    if (column.cellType === "url" && text !== "—") {
        return (
            <a
                href={text}
                target="_blank"
                rel="noopener noreferrer"
                className="apex-admin-cell-link"
                title={text}
            >
                {text}
            </a>
        );
    }

    if (column.cellType === "long") {
        return (
            <span className={`apex-admin-cell-clamp${text === "—" ? " is-empty" : ""}`} title={text}>
                {text}
            </span>
        );
    }

    return (
        <span className={`apex-admin-cell-mono${text === "—" ? " is-empty" : ""}`} title={text}>
            {text}
        </span>
    );
}

export default function CustomersTab() {
    const [activeTab, setActiveTab] = React.useState("existing");
    const [search, setSearch] = React.useState("");
    const [existingItems, setExistingItems] = React.useState([]);
    const [missingItems, setMissingItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const { optionalColumnIds, setOptionalColumnIds, hydrated } =
        useAdminCustomerOptionalColumns();
    const {
        optionalColumnIds: missingOptionalColumnIds,
        setOptionalColumnIds: setMissingOptionalColumnIds,
        hydrated: missingHydrated,
    } = useAdminMissingCustomerOptionalColumns();

    const visibleDataColumns = React.useMemo(
        () => buildVisibleTableColumns(optionalColumnIds),
        [optionalColumnIds]
    );

    const visibleMissingColumns = React.useMemo(
        () => buildVisibleMissingCustomerColumns(missingOptionalColumnIds),
        [missingOptionalColumnIds]
    );

    React.useEffect(() => {
        if (activeTab !== "existing" || !hydrated) return undefined;

        let cancelled = false;
        setLoading(true);

        const params = new URLSearchParams();
        if (optionalColumnIds.length > 0) {
            params.set("columns", optionalColumnIds.join(","));
        }

        fetch(`/api/admin/customers?${params.toString()}`)
            .then((res) => (res.ok ? res.json() : { customers: [] }))
            .then((data) => {
                if (!cancelled) {
                    setExistingItems(Array.isArray(data.customers) ? data.customers : []);
                }
            })
            .catch(() => {
                if (!cancelled) setExistingItems([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, optionalColumnIds, hydrated]);

    React.useEffect(() => {
        if (activeTab !== "missing") return undefined;

        setLoading(true);
        fetch("/api/admin/missing-customers")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setMissingItems(Array.isArray(data) ? data : []))
            .catch(() => setMissingItems([]))
            .finally(() => setLoading(false));
    }, [activeTab]);

    const filteredExisting = existingItems.filter((c) =>
        (c.customerName || "").toLowerCase().includes(search.toLowerCase())
    );
    const filteredMissing = missingItems.filter((c) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return ADMIN_MISSING_CUSTOMER_SEARCH_FIELDS.some((field) =>
            String(c[field] || "")
                .toLowerCase()
                .includes(q)
        );
    });

    const tableColSpan = 4 + visibleDataColumns.length;
    const missingTableColSpan = visibleMissingColumns.length;

    return (
        <div className="apex-admin-tab">
            <h2 className="apex-admin-section__title">Customers</h2>

            <div className="apex-admin-subtabs">
                <div className="apex-admin-subtabs__list">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSearch("");
                            }}
                            className={`apex-admin-subtab${activeTab === tab.id ? " is-active" : ""}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="apex-admin-search-row">
                <div className="apex-admin-search">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab === "existing" ? "existing" : "missing"} customers...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {activeTab === "existing" ? (
                    <AdminCustomerColumnPicker
                        selectedIds={optionalColumnIds}
                        onChange={setOptionalColumnIds}
                    />
                ) : (
                    <AdminCustomerColumnPicker
                        selectedIds={missingOptionalColumnIds}
                        onChange={setMissingOptionalColumnIds}
                        columns={ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS}
                        description="Default columns always shown. Add enrichment fields from Context.dev."
                        resetLabel="Clear extra columns"
                    />
                )}
            </div>

            {activeTab === "existing" && (
                <div className="apex-admin-table-wrap">
                    {loading ? (
                        <CobaltLoader variant="block" title="Loading customers" />
                    ) : (
                        <table className="apex-admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Archived</th>
                                    {visibleDataColumns.map((col) => {
                                        const Icon = CHECK_COLUMN_ICONS[col.id];
                                        return (
                                            <th
                                                key={col.id}
                                                className={col.kind === "value" ? "text-left" : "is-center"}
                                            >
                                                {Icon ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Icon size={14} />
                                                        <span>{col.label}</span>
                                                    </div>
                                                ) : (
                                                    col.label
                                                )}
                                            </th>
                                        );
                                    })}
                                    <th className="is-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExisting.length === 0 ? (
                                    <tr>
                                        <td className="is-empty" colSpan={tableColSpan}>
                                            No customers
                                        </td>
                                    </tr>
                                ) : (
                                    filteredExisting.map((c) => (
                                        <tr key={c._id}>
                                            <td>{c.customerName}</td>
                                            <td>{c.customerType}</td>
                                            <td>
                                                <span
                                                    className={`apex-admin-badge ${
                                                        c.isArchived
                                                            ? "apex-admin-badge--neutral"
                                                            : "apex-admin-badge--warn"
                                                    }`}
                                                >
                                                    {c.isArchived ? "Yes" : "No"}
                                                </span>
                                            </td>
                                            {visibleDataColumns.map((col) => (
                                                <td
                                                    key={col.id}
                                                    className={col.kind === "value" ? "" : "is-center"}
                                                >
                                                    {col.kind === "check" ? (
                                                        <CheckIcon
                                                            hasValue={Boolean(
                                                                c.checks?.[col.checkKey]
                                                            )}
                                                        />
                                                    ) : col.kind === "value" ? (
                                                        <CellValue value={c.columns?.[col.id]} />
                                                    ) : null}
                                                </td>
                                            ))}
                                            <td className="is-right">
                                                <Link
                                                    href={`/dashboard/${c._id}/config`}
                                                    className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm"
                                                >
                                                    Config
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === "missing" && missingHydrated && (
                <div className="apex-admin-table-wrap">
                    {loading ? (
                        <CobaltLoader variant="block" title="Loading missing customers" />
                    ) : (
                        <table className="apex-admin-table">
                            <thead>
                                <tr>
                                    {visibleMissingColumns.map((col) => (
                                        <th key={col.id}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMissing.length === 0 ? (
                                    <tr>
                                        <td className="is-empty" colSpan={missingTableColSpan}>
                                            No missing customers
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMissing.map((c, idx) => (
                                        <tr key={c.clickup_id || idx}>
                                            {visibleMissingColumns.map((col) => (
                                                <td key={col.id}>
                                                    <MissingCellValue column={col} row={c} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
