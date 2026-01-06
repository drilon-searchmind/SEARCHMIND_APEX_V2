"use client";

import React, { useMemo, useState, useEffect } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { useUser, useSetUser } from "@/contexts/UserContext";
import { showToast } from "@/components/ui/ToastProvider";
import ProfileForm from "./components/ProfileForm";
import SharedCustomersCard from "./components/SharedCustomersCard";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
    const sessionUser = useUser();
    const setUser = useSetUser();
    const { update: updateSession } = useSession();
    const userId = sessionUser?._id || sessionUser?.id || sessionUser?.userId || null;

    const initialForm = useMemo(() => ({
        name: sessionUser?.name || "",
        email: sessionUser?.email || "",
        password: "",
        image: sessionUser?.image || "",
        createdAt: sessionUser?.createdAt ? new Date(sessionUser.createdAt).toLocaleString() : "",
    }), [sessionUser]);

    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(initialForm);
    }, [initialForm]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) {
            showToast({ type: "error", message: "Missing user id" });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: form.name?.trim(),
                email: form.email?.trim(),
                image: form.image?.trim(),
            };
            if (form.password && form.password.trim().length > 0) {
                payload.password = form.password.trim();
            }
            const res = await fetch(`/api/user/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error || "Failed to save profile";
                showToast({ type: "error", message: msg });
            } else {
                showToast({ type: "success", message: "Profile updated" });
                setForm((prev) => ({
                    ...prev,
                    password: "",
                    name: data?.name ?? prev.name,
                    email: data?.email ?? prev.email,
                    image: data?.image ?? prev.image,
                    createdAt: data?.createdAt ? new Date(data.createdAt).toLocaleString() : prev.createdAt,
                }));
                // Update NextAuth session so global UI reflects changes immediately
                try {
                    await updateSession({
                        user: {
                            ...(sessionUser || {}),
                            name: data?.name ?? form.name,
                            email: data?.email ?? form.email,
                            image: data?.image ?? form.image,
                        },
                    });
                } catch { }
                // Also update local UserContext right away
                try {
                    setUser?.({
                        ...(sessionUser || {}),
                        name: data?.name ?? form.name,
                        email: data?.email ?? form.email,
                        image: data?.image ?? form.image,
                    });
                } catch { }
            }
        } catch (err) {
            showToast({ type: "error", message: err?.message || "Unexpected error" });
        } finally {
            setSaving(false);
        }
    };

    const sharedCustomers = Array.isArray(sessionUser?.sharedCustomers) ? sessionUser.sharedCustomers : [];

    return (
        <div className="w-full">
            <DashboardHeading title="Profile" label={form.name || "My Profile"} right={null} />

            {/* Editable profile form (User schema fields only) */}
            <ProfileForm form={form} onChange={handleChange} onSubmit={handleSubmit} saving={saving} />

            {/* Read-only shared customers */}
            <SharedCustomersCard sharedCustomers={sharedCustomers} />
        </div>
    );
}