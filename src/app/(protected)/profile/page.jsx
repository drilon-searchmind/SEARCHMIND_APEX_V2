"use client";

import React, { useMemo, useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import ToastProvider, { showToast } from "@/components/ui/ToastProvider";
import { useUser, useSetUser } from "@/contexts/UserContext";
import { useCustomers } from "@/hooks/useCustomers";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import { BrandTile, Card, ConnectionStatus, Field, PasswordInput, ProfileHero, PropertyList, SaveRow, UserAvatar } from "./components/ProfileParts";
import "./profile.css";

const idOf = (v) => (v && typeof v === "object" ? String(v.$oid || v._id || v.id || "") : String(v || ""));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilePage() {
    const sessionUser = useUser();
    const setUser = useSetUser();
    const { update: updateSession } = useSession();
    const { customers } = useCustomers();
    const userId = sessionUser?._id || sessionUser?.id || sessionUser?.userId || null;

    const initial = useMemo(
        () => ({ name: sessionUser?.name || "", email: sessionUser?.email || "", image: sessionUser?.image || "" }),
        [sessionUser]
    );
    const initialIntegrations = useMemo(
        () => ({ slackId: sessionUser?.slackId || "", clickupId: sessionUser?.clickupId || "" }),
        [sessionUser]
    );

    const [form, setForm] = useState(initial);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [integrations, setIntegrations] = useState(initialIntegrations);
    const [saving, setSaving] = useState({ personal: false, password: false, integrations: false });

    useEffect(() => {
        setForm(initial);
    }, [initial]);

    useEffect(() => {
        setIntegrations(initialIntegrations);
    }, [initialIntegrations]);

    const setBusy = (key, value) => setSaving((prev) => ({ ...prev, [key]: value }));

    const personalDirty = form.name !== initial.name || form.email !== initial.email || form.image !== initial.image;
    const integrationsDirty = integrations.slackId !== initialIntegrations.slackId || integrations.clickupId !== initialIntegrations.clickupId;
    const passwordDirty = password.length > 0 || confirm.length > 0;

    const nameError = !form.name.trim() ? "Add your name." : "";
    const emailError = !form.email.trim() ? "Add your email." : !EMAIL_PATTERN.test(form.email.trim()) ? "That email does not look right." : "";
    const confirmError = confirm.length > 0 && password !== confirm ? "The passwords do not match." : "";
    const passwordReady = password.trim().length > 0 && password === confirm;

    const syncSession = async (patch) => {
        try {
            await updateSession({ user: { ...(sessionUser || {}), ...patch } });
        } catch { }
        try {
            setUser?.({ ...(sessionUser || {}), ...patch });
        } catch { }
    };

    const putProfile = async (payload) => {
        const res = await fetch(`/api/user/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to save profile");
        return data;
    };

    const savePersonal = async (e) => {
        e.preventDefault();
        if (!userId) return showToast({ type: "error", message: "Missing user id" });
        if (nameError || emailError) return;
        setBusy("personal", true);
        try {
            const data = await putProfile({ name: form.name.trim(), email: form.email.trim(), image: form.image.trim() });
            pushGTMEvent(GTM_EVENTS.PROFILE_UPDATE, { eventData: { userId } });
            showToast({ type: "success", message: "Profile updated" });
            const next = { name: data?.name ?? form.name, email: data?.email ?? form.email, image: data?.image ?? form.image };
            setForm(next);
            await syncSession(next);
        } catch (err) {
            showToast({ type: "error", message: err?.message || "Unexpected error" });
        } finally {
            setBusy("personal", false);
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        if (!userId) return showToast({ type: "error", message: "Missing user id" });
        if (!passwordReady) return;
        setBusy("password", true);
        try {
            await putProfile({ password: password.trim() });
            pushGTMEvent(GTM_EVENTS.PROFILE_UPDATE, { eventData: { userId } });
            showToast({ type: "success", message: "Password updated" });
            setPassword("");
            setConfirm("");
        } catch (err) {
            showToast({ type: "error", message: err?.message || "Unexpected error" });
        } finally {
            setBusy("password", false);
        }
    };

    const saveIntegrations = async (e) => {
        e.preventDefault();
        if (!userId) return showToast({ type: "error", message: "Missing user id" });
        setBusy("integrations", true);
        try {
            const res = await fetch(`/api/user/${userId}/integrations`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slackId: integrations.slackId.trim(), clickupId: integrations.clickupId.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to save integrations");
            showToast({ type: "success", message: "Connections updated" });
            pushGTMEvent(GTM_EVENTS.PROFILE_UPDATE, { eventData: { userId } });
            const next = { slackId: data?.slackId ?? integrations.slackId, clickupId: data?.clickupId ?? integrations.clickupId };
            setIntegrations(next);
            try {
                setUser?.({ ...(sessionUser || {}), ...next });
            } catch { }
        } catch (err) {
            showToast({ type: "error", message: err?.message || "Unexpected error" });
        } finally {
            setBusy("integrations", false);
        }
    };

    const nameOf = (id) => customers.find((c) => String(c._id) === String(id))?.customerName || "";
    const pinned = useMemo(
        () =>
            (Array.isArray(sessionUser?.favoritedCustomers) ? sessionUser.favoritedCustomers : [])
                .map((v) => idOf(v))
                .filter(Boolean)
                .map((id) => ({ id, label: customers.find((c) => String(c._id) === id)?.customerName || "" }))
                .filter((p) => p.label),
        [sessionUser, customers]
    );
    const shared = useMemo(
        () =>
            (Array.isArray(sessionUser?.sharedCustomers) ? sessionUser.sharedCustomers : [])
                .map((v) => ({ id: idOf(v), inline: v && typeof v === "object" ? v.customerName : "" }))
                .filter((s) => s.id)
                .map((s) => ({ id: s.id, label: s.inline || nameOf(s.id) || s.id })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sessionUser, customers]
    );

    const isExternal = Boolean(sessionUser?.isExternal);

    return (
        <div id="ProfilePage" className="apex-perf w-full apex-pf">
            <ToastProvider />
            <DashboardHeading variant="cobalt" showRunAudit={false} title="Profile" label={form.name || "My profile"} />

            <div className="apex-pf__layout">
                <aside className="apex-pf__rail">
                    <ProfileHero
                        user={sessionUser}
                        form={form}
                        pinnedCount={pinned.length}
                        propertyCount={isExternal ? shared.length : customers.length}
                        propertyLabel={isExternal ? "Shared with you" : "Properties"}
                        onLogout={() => signOut({ callbackUrl: "/login" })}
                    />
                </aside>

                <div className="apex-pf__main">
                    <form onSubmit={savePersonal} noValidate>
                        <Card id="pf-personal" title="Personal details" description="Your name and email appear across Apex, and your picture next to your name.">
                            <div className="apex-pf__identity">
                                <UserAvatar image={form.image} name={form.name} email={form.email} size={64} />
                                <Field id="image" label="Picture URL" hint="Paste a link to an image. Without one, your initials are shown.">
                                    <input id="image" name="image" className="apex-pf__input" value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} placeholder="https://" autoComplete="off" />
                                </Field>
                            </div>
                            <div className="apex-pf__grid">
                                <Field id="name" label="Name" required error={personalDirty ? nameError : ""}>
                                    <input id="name" name="name" className="apex-pf__input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoComplete="name" aria-invalid={personalDirty && nameError ? "true" : undefined} />
                                </Field>
                                <Field id="email" label="Email" required error={personalDirty ? emailError : ""}>
                                    <input id="email" name="email" type="email" className="apex-pf__input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} autoComplete="email" aria-invalid={personalDirty && emailError ? "true" : undefined} />
                                </Field>
                            </div>
                            <SaveRow dirty={personalDirty} saving={saving.personal} disabled={Boolean(nameError || emailError)} onDiscard={() => setForm(initial)} />
                        </Card>
                    </form>

                    <form onSubmit={savePassword} noValidate>
                        <Card id="pf-security" title="Password" description="Choose a new password. Leave both fields empty to keep the one you have.">
                            <div className="apex-pf__grid">
                                <Field id="password" label="New password" hint="Use a long, unique password.">
                                    <PasswordInput id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" />
                                </Field>
                                <Field id="confirm" label="Confirm new password" error={confirmError}>
                                    <PasswordInput id="confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat it" autoComplete="new-password" invalid={Boolean(confirmError)} />
                                </Field>
                            </div>
                            <SaveRow dirty={passwordDirty} saving={saving.password} disabled={!passwordReady} label="Update password" onDiscard={() => { setPassword(""); setConfirm(""); }} />
                        </Card>
                    </form>

                    <form onSubmit={saveIntegrations} noValidate>
                        <Card id="pf-connections" title="Connections" description="Link your Slack and ClickUp accounts so Apex can reach you where you work.">
                            <div className="apex-pf__connections">
                                <div className="apex-pf__connection">
                                    <BrandTile brand="slack" />
                                    <Field id="slackId" label="Slack member ID" hint="Used for notifications.">
                                        <input id="slackId" name="slackId" className="apex-pf__input" value={integrations.slackId} onChange={(e) => setIntegrations((p) => ({ ...p, slackId: e.target.value }))} placeholder="U01234ABCD" autoComplete="off" />
                                    </Field>
                                    <ConnectionStatus connected={Boolean(initialIntegrations.slackId)} />
                                </div>
                                <div className="apex-pf__connection">
                                    <BrandTile brand="clickup" />
                                    <Field id="clickupId" label="ClickUp user ID" hint="Used to match you to tasks.">
                                        <input id="clickupId" name="clickupId" className="apex-pf__input" value={integrations.clickupId} onChange={(e) => setIntegrations((p) => ({ ...p, clickupId: e.target.value }))} placeholder="12345678" autoComplete="off" />
                                    </Field>
                                    <ConnectionStatus connected={Boolean(initialIntegrations.clickupId)} />
                                </div>
                            </div>
                            <SaveRow dirty={integrationsDirty} saving={saving.integrations} onDiscard={() => setIntegrations(initialIntegrations)} />
                        </Card>
                    </form>

                    <Card id="pf-properties" title="Your properties" description="Open the properties you pinned, or the ones shared with you. Pin more from the home page.">
                        <div className="apex-pf__plists">
                            <PropertyList title="Pinned" items={pinned} empty="Nothing pinned yet. Use the star on the home page." />
                            {isExternal || shared.length > 0 ? <PropertyList title="Shared with you" items={shared} empty="No properties are shared with you yet." /> : null}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
