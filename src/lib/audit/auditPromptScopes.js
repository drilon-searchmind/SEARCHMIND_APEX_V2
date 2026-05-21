/**
 * Audit prompt library scopes — aligned with Run Audit channel tabs.
 */

/** @typedef {'system'|'cross'|'seo'|'ppc'|'ps'|'em'} AuditPromptScope */

export const AUDIT_CHANNEL_SCOPES = /** @type {const} */ (["cross", "seo", "ppc", "ps", "em"]);

export const AUDIT_PROMPT_SCOPES = /** @type {const} */ (["system", ...AUDIT_CHANNEL_SCOPES]);

/** @type {Record<AuditPromptScope, { label: string, description: string }>} */
export const AUDIT_SCOPE_META = {
    system: {
        label: "System prompt",
        description:
            "Shared instructions for every Claude audit call. Exactly one system prompt is active.",
    },
    cross: {
        label: "Cross-channel",
        description:
            "Task prompt for all analyses in the Cross-channel tab. Card titles still identify the theme.",
    },
    seo: {
        label: "SEO",
        description: "Task prompt for all analyses in the SEO tab (Search Console + Ahrefs when configured).",
    },
    ppc: {
        label: "PPC · Google Ads",
        description: "Task prompt for all analyses in the PPC tab.",
    },
    ps: {
        label: "PS · Meta",
        description: "Task prompt for all analyses in the Paid Social (Meta) tab.",
    },
    em: {
        label: "EM · Klaviyo",
        description: "Task prompt for all analyses in the Email (Klaviyo) tab.",
    },
};

/**
 * @param {string} groupId — Run Audit tab id (cross, seo, ppc, ps, em)
 * @returns {groupId is AuditPromptScope}
 */
export function isAuditChannelScope(groupId) {
    return AUDIT_CHANNEL_SCOPES.includes(/** @type {AuditPromptScope} */ (groupId));
}
