"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
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
        <FiCheck className="text-green-600 mx-auto" size={18} />
    ) : (
        <FiX className="text-red-600 mx-auto" size={18} />
    );
}

function CellValue({ value }) {
    const text = value == null || value === "" ? "—" : String(value);
    return (
        <span
            className="font-mono text-xs text-gray-800 break-all max-w-[220px] inline-block"
            title={text}
        >
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
                ? "bg-green-50 text-green-700"
                : status === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-600";
        return (
            <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${cls}`}>
                {text}
            </span>
        );
    }

    if (column.cellType === "url" && text !== "—") {
        return (
            <a
                href={text}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--color-primary-searchmind)] hover:underline break-all max-w-[220px] inline-block"
                title={text}
            >
                {text}
            </a>
        );
    }

    if (column.cellType === "long") {
        return (
            <span
                className="text-xs text-gray-800 line-clamp-2 max-w-[280px] inline-block"
                title={text}
            >
                {text}
            </span>
        );
    }

    return (
        <span
            className="font-mono text-xs text-gray-800 break-all max-w-[220px] inline-block"
            title={text}
        >
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
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">
                Customers
            </h5>

            <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex gap-8 px-6">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSearch("");
                            }}
                            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? "border-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                    type="text"
                    placeholder={`Search ${activeTab === "existing" ? "existing" : "missing"} customers...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-0 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                />
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
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Name</th>
                                <th className="px-4 py-2 text-left">Type</th>
                                <th className="px-4 py-2 text-left">Archived</th>
                                {visibleDataColumns.map((col) => {
                                    const Icon = CHECK_COLUMN_ICONS[col.id];
                                    return (
                                        <th
                                            key={col.id}
                                            className={`px-4 py-2 ${col.kind === "value" ? "text-left min-w-[140px]" : "text-center"}`}
                                        >
                                            {Icon ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <Icon className="text-gray-600" size={16} />
                                                    <span>{col.label}</span>
                                                </div>
                                            ) : (
                                                col.label
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td className="px-4 py-4 text-gray-400" colSpan={tableColSpan}>
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredExisting.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-4 text-gray-400" colSpan={tableColSpan}>
                                        No customers
                                    </td>
                                </tr>
                            ) : (
                                filteredExisting.map((c) => (
                                    <tr key={c._id} className="border-b last:border-b-0">
                                        <td className="px-4 py-2">{c.customerName}</td>
                                        <td className="px-4 py-2">{c.customerType}</td>
                                        <td className="px-4 py-2">
                                            <span
                                                className={`inline-flex rounded-lg px-5 py-0.5 text-xs font-medium ${
                                                    c.isArchived
                                                        ? "bg-gray-100 text-gray-700"
                                                        : "bg-orange-50 text-orange-700"
                                                }`}
                                            >
                                                {c.isArchived ? "Yes" : "No"}
                                            </span>
                                        </td>
                                        {visibleDataColumns.map((col) => (
                                            <td
                                                key={col.id}
                                                className={`px-4 py-2 ${col.kind === "value" ? "text-left align-top" : "text-center"}`}
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
                                        <td className="px-4 py-2 text-right">
                                            <Link href={`/dashboard/${c._id}/config`}>
                                                <FormButton borderType="outline" buttonSize="small">
                                                    Config
                                                </FormButton>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === "missing" && missingHydrated && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {visibleMissingColumns.map((col) => (
                                    <th
                                        key={col.id}
                                        className={`px-4 py-2 text-left whitespace-nowrap ${
                                            col.cellType === "long" ? "min-w-[200px]" : "min-w-[120px]"
                                        }`}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        className="px-4 py-4 text-gray-400"
                                        colSpan={missingTableColSpan}
                                    >
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredMissing.length === 0 ? (
                                <tr>
                                    <td
                                        className="px-4 py-4 text-gray-400"
                                        colSpan={missingTableColSpan}
                                    >
                                        No missing customers
                                    </td>
                                </tr>
                            ) : (
                                filteredMissing.map((c, idx) => (
                                    <tr
                                        key={c.clickup_id || idx}
                                        className="border-b last:border-b-0 align-top"
                                    >
                                        {visibleMissingColumns.map((col) => (
                                            <td key={col.id} className="px-4 py-2">
                                                <MissingCellValue column={col} row={c} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
