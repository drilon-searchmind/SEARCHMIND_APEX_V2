"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import { SiSlack, SiClickup } from "react-icons/si";

export default function ProfileIntegrations({ form, onChange, onSubmit, saving }) {
    return (
        <form className="bg-white rounded-xl border border-gray-200 p-6" onSubmit={onSubmit}>
            <h3 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-4">Integrations</h3>
            <p className="text-sm text-gray-500 mb-6">Connect your external accounts for better workflow integration.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <FormLabel htmlFor="slackId">
                        <div className="flex items-center gap-2">
                            <SiSlack className="text-[#4A154B]" />
                            Slack ID
                        </div>
                    </FormLabel>
                    <FormInputText 
                        id="slackId" 
                        name="slackId" 
                        value={form.slackId || ''} 
                        onChange={onChange} 
                        placeholder="U01234ABCD" 
                    />
                    <p className="text-xs text-gray-400 mt-1">Your Slack member ID for notifications.</p>
                </div>
                <div>
                    <FormLabel htmlFor="clickupId">
                        <div className="flex items-center gap-2">
                            <SiClickup className="text-[#7B68EE]" />
                            ClickUp ID
                        </div>
                    </FormLabel>
                    <FormInputText 
                        id="clickupId" 
                        name="clickupId" 
                        value={form.clickupId || ''} 
                        onChange={onChange} 
                        placeholder="12345678" 
                    />
                    <p className="text-xs text-gray-400 mt-1">Your ClickUp user ID for task management.</p>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="w-full md:w-auto md:min-w-40">
                    <FormButton>{saving ? "Saving..." : "Save Changes"}</FormButton>
                </div>
            </div>
        </form>
    );
}
