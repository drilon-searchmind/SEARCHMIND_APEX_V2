"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";

export default function UsersTab() {
    const [search, setSearch] = React.useState("");
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        setLoading(true);
        fetch('/api/users')
            .then(res => res.ok ? res.json() : [])
            .then(data => setItems(Array.isArray(data) ? data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = items.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Users</h5>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-0 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                />
            </div>
            <div className="bg-white rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2 text-left">Email</th>
                            <th className="px-4 py-2 text-left">Role</th>
                            <th className="px-4 py-2 text-left">External</th>
                            <th className="px-4 py-2 text-left">Edit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td className="px-4 py-4 text-gray-400" colSpan={4}>Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td className="px-4 py-4 text-gray-400" colSpan={4}>No users</td></tr>
                        ) : filtered.map(u => (
                            <tr key={u._id} className="border-b last:border-b-0">
                                <td className="px-4 py-2">{u.name}</td>
                                <td className="px-4 py-2">{u.email}</td>
                                <td className="px-4 py-2">
                                    <span
                                        className={`
                                            inline-block text-xs px-2 py-1 rounded-full mt-1
                                            ${u.isAdmin ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}
                                        `}>
                                        {u.isAdmin ? 'Admin' : 'User'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <span
                                        className={`
                                            inline-block text-xs px-2 py-1 rounded-full mt-1
                                            ${u.isExternal ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}
                                        `}>
                                        {u.isExternal ? 'Yes' : 'No'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <FormButton borderType="outline" buttonSize="small">Edit</FormButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
