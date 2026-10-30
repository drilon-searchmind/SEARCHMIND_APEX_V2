"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import { SiSlack, SiClickup } from "react-icons/si";
import { SaveBar } from "./ProfileForm";

export default function ProfileIntegrations({ form, savedForm, onChange, onSubmit, onReset, saving, dirty }) {
    const fields = [
        {
            id: "slackId",
            label: "Slack member ID",
            Icon: SiSlack,
            placeholder: "U01234ABCD",
            hint: "Used for notifications. In Slack: open your profile, choose More, then Copy member ID.",
        },
        {
            id: "clickupId",
            label: "ClickUp user ID",
            Icon: SiClickup,
            placeholder: "12345678",
            hint: "Used to link tasks to you. Found in your ClickUp profile URL or settings.",
        },
    ];

    return (
        <form className="apex-profile-card apex-profile-form apex-profile-reveal" onSubmit={onSubmit}>
            <header className="apex-profile-card__head">
                <h2 className="apex-profile-card__title">Integrations</h2>
                <p className="apex-profile-card__subtitle">Link your accounts so Apex can notify you and match your tasks.</p>
            </header>

            <div className="apex-profile-integrations">
                {fields.map(({ id, label, Icon, placeholder, hint }) => {
                    const connected = Boolean(savedForm?.[id]);
                    return (
                        <div key={id} className="apex-profile-integration">
                            <div className="apex-profile-integration__icon" aria-hidden="true">
                                <Icon />
                            </div>
                            <div className="apex-profile-integration__body">
                                <div className="apex-profile-integration__top">
                                    <FormLabel htmlFor={id}>{label}</FormLabel>
                                    <span className={`apex-profile-pill${connected ? " is-on" : ""}`}>
                                        {connected ? "Connected" : "Not set"}
                                    </span>
                                </div>
                                <FormInputText
                                    id={id}
                                    name={id}
                                    value={form[id] || ""}
                                    onChange={onChange}
                                    placeholder={placeholder}
                                />
                                <p className="apex-profile-field-hint">{hint}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <SaveBar dirty={dirty} saving={saving} onReset={onReset} />
        </form>
    );
}
