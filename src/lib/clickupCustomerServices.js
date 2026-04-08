/**
 * ClickUp custom field "🤝 Service(s)" (labels) on the customer task.
 * Static field id — value is an array of selected option UUIDs.
 */
export const CLICKUP_CUSTOMER_SERVICES_FIELD_ID =
    "799ec7c6-e81e-4691-a5bd-7bf09475b815";

/**
 * Services shown in the topbar next to team avatars.
 * `optionId` matches ClickUp label option ids from that field's type_config.
 */
export const TOPBAR_CUSTOMER_SERVICES = [
    {
        key: "ppc",
        label: "PPC",
        optionId: "11ce14ac-2324-4f56-83c9-c480c86a3a39",
    },
    {
        key: "martech",
        label: "Martech",
        optionId: "6988af3e-9261-48df-bd44-e2bba60bddea",
    },
    {
        key: "seo",
        label: "SEO",
        optionId: "e1e6850e-3aec-42db-84d1-5e0d29df2ead",
    },
    {
        key: "ps",
        label: "PS",
        optionId: "5ba9c5f7-72ac-4538-ac09-af88da2950b5",
    },
    {
        key: "email",
        label: "Email",
        optionId: "0bdef233-9a4f-414a-8b35-b7c4bab0c13b",
    },
    {
        key: "web",
        label: "Web",
        optionId: "e6db202f-2b5a-42c2-aff6-b9993a34513f",
    },
    {
        key: "creative",
        label: "Creative",
        optionId: "760b9c31-350c-4560-9e9a-a30ba75fd32b",
    },
];

/**
 * @param {string[]|undefined|null} selectedOptionIds - from ClickUp field.value
 * @returns {Array<{ key: string, label: string, optionId: string, active: boolean }>}
 */
export function buildCustomerServicesStatus(selectedOptionIds) {
    const set = new Set(
        Array.isArray(selectedOptionIds)
            ? selectedOptionIds.map((id) => String(id))
            : []
    );
    return TOPBAR_CUSTOMER_SERVICES.map((s) => ({
        key: s.key,
        label: s.label,
        optionId: s.optionId,
        active: set.has(s.optionId),
    }));
}
