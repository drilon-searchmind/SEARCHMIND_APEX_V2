"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";

export default function NotificationsTab() {
    const [title, setTitle] = React.useState("");
    const [body, setBody] = React.useState("");
    const [linkUrl, setLinkUrl] = React.useState("");
    const [imageUrl, setImageUrl] = React.useState("");
    const [category, setCategory] = React.useState("system");
    const [audience, setAudience] = React.useState("allInternal");
    const [users, setUsers] = React.useState([]);
    const [selectedIds, setSelectedIds] = React.useState({});
    const [sending, setSending] = React.useState(false);
    const [search, setSearch] = React.useState("");

    React.useEffect(() => {
        fetch("/api/users")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setUsers(Array.isArray(data) ? data : []))
            .catch(() => setUsers([]));
    }, []);

    const toggleUser = (id) => {
        setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const recipientUserIds = Object.entries(selectedIds)
        .filter(([, v]) => v)
        .map(([k]) => k);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) {
            showToast({ type: "error", message: "Title and body are required" });
            return;
        }
        if (audience === "selected" && recipientUserIds.length === 0) {
            showToast({ type: "error", message: "Select at least one user" });
            return;
        }
        setSending(true);
        try {
            const payload =
                audience === "selected"
                    ? { title, body: body.trim(), linkUrl, imageUrl, category, recipientUserIds }
                    : { title, body: body.trim(), linkUrl, imageUrl, category, audience };
            const res = await fetch("/api/admin/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to send");
            showToast({ type: "success", message: `Sent to ${data.count} user(s)` });
            setTitle("");
            setBody("");
            setLinkUrl("");
            setImageUrl("");
            setSelectedIds({});
        } catch (err) {
            showToast({ type: "error", message: err.message || "Failed" });
        } finally {
            setSending(false);
        }
    };

    const filteredUsers = users.filter(
        (u) =>
            (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)]">Push notifications</h5>
            <p className="text-sm text-gray-600">
                Creates in-app notifications for selected users. Recipients see them in the bell on the top bar.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div>
                    <FormLabel htmlFor="notif-title">Title</FormLabel>
                    <FormInputText
                        id="notif-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Short headline"
                    />
                </div>
                <div>
                    <FormLabel htmlFor="notif-body">Message</FormLabel>
                    <textarea
                        id="notif-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:ring-brand-500/20"
                        placeholder="Notification body text"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <FormLabel htmlFor="notif-link">Link (optional)</FormLabel>
                        <FormInputText
                            id="notif-link"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="/news or absolute URL"
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="notif-img">Image URL (optional)</FormLabel>
                        <FormInputText
                            id="notif-img"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                </div>
                <div>
                    <FormLabel htmlFor="notif-cat">Category</FormLabel>
                    <select
                        id="notif-cat"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
                    >
                        <option value="system">System</option>
                        <option value="feature">Feature</option>
                        <option value="alert">Alert</option>
                    </select>
                </div>

                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Audience</p>
                    <div className="space-y-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="aud"
                                checked={audience === "allInternal"}
                                onChange={() => setAudience("allInternal")}
                            />
                            All internal users (not external)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="aud"
                                checked={audience === "allUsers"}
                                onChange={() => setAudience("allUsers")}
                            />
                            All users (including external)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="aud"
                                checked={audience === "selected"}
                                onChange={() => setAudience("selected")}
                            />
                            Selected users
                        </label>
                    </div>
                </div>

                {audience === "selected" && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-56 overflow-y-auto">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="mb-3 h-9 w-full rounded-lg border px-3 text-sm border-gray-300"
                        />
                        <ul className="space-y-1 text-sm">
                            {filteredUsers.map((u) => (
                                <li key={u._id}>
                                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedIds[u._id]}
                                            onChange={() => toggleUser(u._id)}
                                        />
                                        <span className="font-medium text-gray-800">{u.name}</span>
                                        <span className="text-gray-500 text-xs">{u.email}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <FormButton type="submit" disabled={sending} borderType="primary">
                    {sending ? "Sending…" : "Send notifications"}
                </FormButton>
            </form>
        </div>
    );
}
