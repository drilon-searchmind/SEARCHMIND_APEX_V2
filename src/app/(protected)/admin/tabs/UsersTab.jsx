"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import { FiSlack } from "react-icons/fi";
import { SiClickup } from "react-icons/si";
import FormInputText from "@/components/form/FormInputText";
import { showToast } from "@/components/ui/ToastProvider";

export default function UsersTab() {
    const [search, setSearch] = React.useState("");
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [updatingUserId, setUpdatingUserId] = React.useState(null);

    React.useEffect(() => {
        setLoading(true);
        fetch('/api/users')
            .then(res => res.ok ? res.json() : [])
            .then(data => setItems(Array.isArray(data) ? data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = items.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase()));

    const handleUpdateUser = async (userId) => {
        const user = items.find(u => u._id === userId);
        if (!user) return;

        setUpdatingUserId(userId);

        try {
            const updateData = {
                userId,
                name: user.name,
                email: user.email,
                slackId: user.slackId,
                clickupId: user.clickupId,
                isAdmin: user.isAdmin,
                isExternal: user.isExternal,
                isArchived: user.isArchived
            };

            const response = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Update the local state with the updated user data
                setItems(items.map(u => u._id === userId ? result.user : u));
                showToast({
                    type: "success",
                    message: `User ${user.name} updated successfully`
                });
            } else {
                throw new Error(result.error || 'Failed to update user');
            }
        } catch (error) {
            console.error('Update user error:', error);
            showToast({
                type: "error",
                message: `Failed to update user: ${error.message}`
            });
        } finally {
            setUpdatingUserId(null);
        }
    };
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
                            <th className="px-4 py-2 text-left">
                                <span className="flex items-center gap-2">
                                    <FiSlack /> Slack ID
                                </span>
                            </th>
                            <th className="px-4 py-2 text-left">
                                <span className="flex items-center gap-2">
                                    <SiClickup />
                                    <span>Clickup ID</span>
                                </span>
                            </th>
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
                                <td className="px-4 py-2">
                                    <FormInputText
                                        value={u.name}
                                        onChange={(e) => setItems(items.map(i => i._id === u._id ? { ...i, name: e.target.value } : i))}
                                        className="w-full"
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <FormInputText
                                        value={u.email}
                                        onChange={(e) => setItems(items.map(i => i._id === u._id ? { ...i, email: e.target.value } : i))}
                                        className="w-full"
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <FormInputText
                                        value={u.slackId}
                                        onChange={(e) => setItems(items.map(i => i._id === u._id ? { ...i, slackId: e.target.value } : i))}
                                        className="w-full"
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <FormInputText
                                        value={u.clickupId}
                                        onChange={(e) => setItems(items.map(i => i._id === u._id ? { ...i, clickupId: e.target.value } : i))}
                                        className="w-full"
                                    />
                                </td>
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
                                    <span onClick={() => handleUpdateUser(u._id)}>
                                        <FormButton
                                            borderType=""
                                            buttonSize="small"
                                            disabled={updatingUserId === u._id}
                                        >
                                            {updatingUserId === u._id ? 'Updating...' : 'Update'}
                                        </FormButton>
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
