"use client";

import React from "react";
import { FiSlack } from "react-icons/fi";
import { SiClickup } from "react-icons/si";
import FormInputText from "@/components/form/FormInputText";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";

export default function UsersTab() {
    const [search, setSearch] = React.useState("");
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [updatingUserId, setUpdatingUserId] = React.useState(null);
    const [passwordByUserId, setPasswordByUserId] = React.useState({});

    React.useEffect(() => {
        setLoading(true);
        fetch("/api/users")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setItems(Array.isArray(data) ? data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = items.filter(
        (u) =>
            (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(search.toLowerCase())
    );

    const handleUpdateUser = async (userId) => {
        const user = items.find((u) => u._id === userId);
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
                isArchived: user.isArchived,
            };
            const newPassword = (passwordByUserId[userId] || "").trim();
            if (newPassword) updateData.password = newPassword;

            const response = await fetch("/api/admin/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setItems(items.map((u) => (u._id === userId ? result.user : u)));
                setPasswordByUserId((prev) => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
                showToast({
                    type: "success",
                    message: newPassword
                        ? `User ${user.name} updated (password changed)`
                        : `User ${user.name} updated successfully`,
                });
            } else {
                throw new Error(result.error || "Failed to update user");
            }
        } catch (error) {
            console.error("Update user error:", error);
            showToast({
                type: "error",
                message: `Failed to update user: ${error.message}`,
            });
        } finally {
            setUpdatingUserId(null);
        }
    };

    return (
        <div className="apex-admin-tab">
            <h2 className="apex-admin-section__title">Users</h2>

            <div className="apex-admin-search-row">
                <div className="apex-admin-search">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="apex-admin-table-wrap">
                {loading ? (
                    <CobaltLoader variant="block" title="Loading users" />
                ) : (
                    <table className="apex-admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>
                                    <span className="flex items-center gap-2">
                                        <FiSlack /> Slack ID
                                    </span>
                                </th>
                                <th>
                                    <span className="flex items-center gap-2">
                                        <SiClickup />
                                        Clickup ID
                                    </span>
                                </th>
                                <th>Role</th>
                                <th>External</th>
                                <th>New password</th>
                                <th className="is-right">Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td className="is-empty" colSpan={8}>
                                        No users
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((u) => (
                                    <tr key={u._id}>
                                        <td>
                                            <FormInputText
                                                value={u.name}
                                                onChange={(e) =>
                                                    setItems(
                                                        items.map((i) =>
                                                            i._id === u._id
                                                                ? { ...i, name: e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                className="w-full"
                                            />
                                        </td>
                                        <td>
                                            <FormInputText
                                                value={u.email}
                                                onChange={(e) =>
                                                    setItems(
                                                        items.map((i) =>
                                                            i._id === u._id
                                                                ? { ...i, email: e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                className="w-full"
                                            />
                                        </td>
                                        <td>
                                            <FormInputText
                                                value={u.slackId}
                                                onChange={(e) =>
                                                    setItems(
                                                        items.map((i) =>
                                                            i._id === u._id
                                                                ? { ...i, slackId: e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                className="w-full"
                                            />
                                        </td>
                                        <td>
                                            <FormInputText
                                                value={u.clickupId}
                                                onChange={(e) =>
                                                    setItems(
                                                        items.map((i) =>
                                                            i._id === u._id
                                                                ? { ...i, clickupId: e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                className="w-full"
                                            />
                                        </td>
                                        <td>
                                            <span
                                                className={`apex-admin-badge ${
                                                    u.isAdmin
                                                        ? "apex-admin-badge--ok"
                                                        : "apex-admin-badge--neutral"
                                                }`}
                                            >
                                                {u.isAdmin ? "Admin" : "User"}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`apex-admin-badge ${
                                                    u.isExternal
                                                        ? "apex-admin-badge--error"
                                                        : "apex-admin-badge--ok"
                                                }`}
                                            >
                                                {u.isExternal ? "Yes" : "No"}
                                            </span>
                                        </td>
                                        <td style={{ minWidth: "11rem" }}>
                                            <FormInputText
                                                type="password"
                                                autoComplete="new-password"
                                                placeholder="Leave blank to keep"
                                                value={passwordByUserId[u._id] || ""}
                                                onChange={(e) =>
                                                    setPasswordByUserId((prev) => ({
                                                        ...prev,
                                                        [u._id]: e.target.value,
                                                    }))
                                                }
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="is-right">
                                            <button
                                                type="button"
                                                className="apex-perf-btn apex-perf-btn--primary apex-admin-btn-sm"
                                                disabled={updatingUserId === u._id}
                                                onClick={() => handleUpdateUser(u._id)}
                                            >
                                                {updatingUserId === u._id ? "Updating..." : "Update"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
