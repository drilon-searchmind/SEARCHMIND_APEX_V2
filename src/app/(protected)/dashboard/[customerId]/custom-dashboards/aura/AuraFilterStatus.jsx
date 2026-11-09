"use client";

import React from "react";
import Link from "next/link";
import { FiFilter } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";

const countTerms = (c) => [c?.include, c?.exclude].filter((t) => String(t || "").trim()).length + (c?.excludeExact?.length || 0);

/**
 * One line that tells which campaign filter the Aura dashboards use. The filter is an account setting,
 * edited once under Data inputs, Campaign filter (internal users).
 */
export default function AuraFilterStatus({ customerId, filter }) {
    const canEdit = useUser()?.isExternal !== true;
    const rules = countTerms(filter.google) + countTerms(filter.meta);
    return (
        <section className="cd-filter cd-filter--status" aria-label="Campaign filter">
            <div className="cd-filter__bar">
                <span className="cd-filter__title">
                    <FiFilter aria-hidden="true" /> Campaign filter
                </span>
                <span className={`cd-filter__state${filter.enabled ? " is-active" : ""}`}>
                    {filter.enabled ? `On for the account, ${rules} rule${rules === 1 ? "" : "s"}` : "Off, all campaigns"}
                </span>
                {canEdit ? (
                    <Link className="cd-filter__edit" href={`/dashboard/${customerId}/custom/inputs`}>
                        Edit in Data inputs
                    </Link>
                ) : null}
            </div>
        </section>
    );
}
