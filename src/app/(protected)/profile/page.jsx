"use client";

import React, { useMemo, useState, useEffect } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { useUser, useSetUser } from "@/contexts/UserContext";
import { showToast } from "@/components/ui/ToastProvider";
import ProfileForm from "./components/ProfileForm";
import ProfileIntegrations from "./components/ProfileIntegrations";
import SharedCustomersCard from "./components/SharedCustomersCard";
import { useSession } from "next-auth/react";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";

export default function ProfilePage() {
    // TODO: Test Cursor
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

    const initialIntegrations = useMemo(() => ({
        slackId: sessionUser?.slackId || "",
        clickupId: sessionUser?.clickupId || "",
    }), [sessionUser]);

    const [form, setForm] = useState(initialForm);
    const [integrations, setIntegrations] = useState(initialIntegrations);
    const [saving, setSaving] = useState(false);
    const [savingIntegrations, setSavingIntegrations] = useState(false);

    useEffect(() => {
        setForm(initialForm);
    }, [initialForm]);

    useEffect(() => {
        setIntegrations(initialIntegrations);
    }, [initialIntegrations]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const handleIntegrationsChange = (e) => {
        const { name, value } = e.target;
        setIntegrations((prev) => ({ ...prev, [name]: value }));
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
                pushGTMEvent(GTM_EVENTS.PROFILE_UPDATE, {
                    eventData: {
                        userId: userId,
                    },
                })

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

    const handleIntegrationsSubmit = async (e) => {
        e.preventDefault();

        if (!userId) {
            showToast({ type: "error", message: "Missing user id" });
            return;
        }
        setSavingIntegrations(true);

        try {
            const payload = {
                slackId: integrations.slackId?.trim() || "",
                clickupId: integrations.clickupId?.trim() || "",
            };
            const res = await fetch(`/api/user/${userId}/integrations`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error || "Failed to save integrations";
                showToast({ type: "error", message: msg });
            } else {
                showToast({ type: "success", message: "Integrations updated" });
                pushGTMEvent(GTM_EVENTS.PROFILE_UPDATE, {
                    eventData: {
                        userId: userId,
                    },
                })

                setIntegrations({
                    slackId: data?.slackId ?? integrations.slackId,
                    clickupId: data?.clickupId ?? integrations.clickupId,
                });
                // Update local UserContext
                try {
                    setUser?.({
                        ...(sessionUser || {}),
                        slackId: data?.slackId ?? integrations.slackId,
                        clickupId: data?.clickupId ?? integrations.clickupId,
                    });
                } catch { }
            }
        } catch (err) {
            showToast({ type: "error", message: err?.message || "Unexpected error" });
        } finally {
            setSavingIntegrations(false);
        }
    };

    const sharedCustomers = Array.isArray(sessionUser?.sharedCustomers) ? sessionUser.sharedCustomers : [];

    return (
        <div className="w-full">
            <DashboardHeading title="Profile" label={form.name || "My Profile"} right={null} />

            {/* Editable profile form (User schema fields only) */}
            <ProfileForm form={form} onChange={handleChange} onSubmit={handleSubmit} saving={saving} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Integrations form */}
                <ProfileIntegrations
                    form={integrations}
                    onChange={handleIntegrationsChange}
                    onSubmit={handleIntegrationsSubmit}
                    saving={savingIntegrations}
                />

                {/* Read-only shared customers */}
                <SharedCustomersCard sharedCustomers={sharedCustomers} />
            </div>
        </div>
    );
}