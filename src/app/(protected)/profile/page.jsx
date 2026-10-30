"use client";

import React, { useMemo, useState, useEffect } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import ToastProvider, { showToast } from "@/components/ui/ToastProvider";
import { useUser, useSetUser } from "@/contexts/UserContext";
import ProfileForm from "./components/ProfileForm";
import ProfileIntegrations from "./components/ProfileIntegrations";
import SharedCustomersCard from "./components/SharedCustomersCard";
import ProfileSummary from "./components/ProfileSummary";
import { useSession } from "next-auth/react";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import "./profile.css";

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
        createdAt: sessionUser?.createdAt ? new Date(sessionUser.createdAt).toISOString() : "",
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

    const formDirty =
        form.name !== initialForm.name ||
        form.email !== initialForm.email ||
        form.image !== initialForm.image ||
        Boolean(form.password);
    const integrationsDirty =
        (integrations.slackId || "") !== (initialIntegrations.slackId || "") ||
        (integrations.clickupId || "") !== (initialIntegrations.clickupId || "");

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
                });

                showToast({ type: "success", message: "Profile updated" });
                setForm((prev) => ({
                    ...prev,
                    password: "",
                    name: data?.name ?? prev.name,
                    email: data?.email ?? prev.email,
                    image: data?.image ?? prev.image,
                    createdAt: data?.createdAt ? new Date(data.createdAt).toISOString() : prev.createdAt,
                }));
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
                });

                setIntegrations({
                    slackId: data?.slackId ?? integrations.slackId,
                    clickupId: data?.clickupId ?? integrations.clickupId,
                });
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

    const resetForm = () => setForm(initialForm);
    const resetIntegrations = () => setIntegrations(initialIntegrations);

    const sharedCustomers = Array.isArray(sessionUser?.sharedCustomers) ? sessionUser.sharedCustomers : [];

    return (
        <div id="ProfilePage" className="apex-perf w-full apex-profile-stack">
            <ToastProvider />
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Profile"
                label={form.name || "My Profile"}
            />

            <div className="apex-profile-layout">
                <ProfileSummary
                    form={form}
                    integrations={initialIntegrations}
                    sharedCount={sharedCustomers.length}
                    loading={!sessionUser}
                />
                <div className="apex-profile-main">
                    <ProfileForm
                        form={form}
                        onChange={handleChange}
                        onSubmit={handleSubmit}
                        onReset={resetForm}
                        saving={saving}
                        dirty={formDirty}
                    />
                    <ProfileIntegrations
                        form={integrations}
                        savedForm={initialIntegrations}
                        onChange={handleIntegrationsChange}
                        onSubmit={handleIntegrationsSubmit}
                        onReset={resetIntegrations}
                        saving={savingIntegrations}
                        dirty={integrationsDirty}
                    />
                    <SharedCustomersCard sharedCustomers={sharedCustomers} />
                </div>
            </div>
        </div>
    );
}
