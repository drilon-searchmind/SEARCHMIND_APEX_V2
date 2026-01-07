"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";

export default function CustomersTab() {
    const [search, setSearch] = React.useState("");
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        setLoading(true);
        fetch('/api/customers')
            .then(res => res.ok ? res.json() : [])
            .then(data => setItems(Array.isArray(data) ? data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = items.filter(c => (c.customerName || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Customers</h5>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Search customers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-0 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                />
                <div className="w-40">
                    <FormButton borderType="outline">Create</FormButton>
                </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2 text-left">Type</th>
                            <th className="px-4 py-2 text-left">Archived</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td className="px-4 py-4 text-gray-400" colSpan={4}>Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td className="px-4 py-4 text-gray-400" colSpan={4}>No customers</td></tr>
                        ) : filtered.map(c => (
                            <tr key={c._id} className="border-b last:border-b-0">
                                <td className="px-4 py-2">{c.customerName}</td>
                                <td className="px-4 py-2">{c.customerType}</td>
                                <td className="px-4 py-2">{c.isArchived ? 'Yes' : 'No'}</td>
                                <td className="px-4 py-2 text-right">
                                    <a href={`/dashboard/${c._id}/config`} className="text-[var(--color-primary-searchmind)] font-semibold">Config</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
