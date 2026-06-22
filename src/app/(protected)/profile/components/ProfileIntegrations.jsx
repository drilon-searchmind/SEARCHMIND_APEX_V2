"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import { SiSlack, SiClickup } from "react-icons/si";

export default function ProfileIntegrations({ form, onChange, onSubmit, saving }) {
    return (
        <form className="apex-profile-card apex-profile-form h-full" onSubmit={onSubmit}>
            <h2 className="apex-profile-card__title">Integrations</h2>
            <p className="apex-profile-card__subtitle">
                Connect your external accounts for better workflow integration.
            </p>

            <div className="apex-profile-grid">
                <div>
                    <FormLabel htmlFor="slackId">
                        <span className="apex-profile-label-row">
                            <SiSlack aria-hidden="true" />
                            Slack ID
                        </span>
                    </FormLabel>
                    <FormInputText
                        id="slackId"
                        name="slackId"
                        value={form.slackId || ""}
                        onChange={onChange}
                        placeholder="U01234ABCD"
                    />
                    <p className="apex-profile-field-hint">Your Slack member ID for notifications.</p>
                </div>
                <div>
                    <FormLabel htmlFor="clickupId">
                        <span className="apex-profile-label-row">
                            <SiClickup aria-hidden="true" />
                            ClickUp ID
                        </span>
                    </FormLabel>
                    <FormInputText
                        id="clickupId"
                        name="clickupId"
                        value={form.clickupId || ""}
                        onChange={onChange}
                        placeholder="12345678"
                    />
                    <p className="apex-profile-field-hint">Your ClickUp user ID for task management.</p>
                </div>
            </div>

            <div className="apex-profile-actions">
                <button
                    type="submit"
                    className="apex-perf-btn apex-perf-btn--primary"
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    );
}
