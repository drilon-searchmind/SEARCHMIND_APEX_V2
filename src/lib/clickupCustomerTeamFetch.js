/**
 * Fetch ClickUp team payload for a customer task (same source as GET /api/clickup-team-members/[customerId]).
 * Used by the API route and by batch sync scripts (e.g. Apex Radar pre-warm).
 */
import {
    buildCustomerServicesStatus,
    CLICKUP_CUSTOMER_SERVICES_FIELD_ID,
} from "./clickupCustomerServices.js";

/** Fixed ClickUp list whose /member endpoint includes profile pictures for Searchmind team. */
export const CLICKUP_TEAM_LIST_ID = "210313781";

function normalizeEmail(email) {
    if (email == null || email === "") return null;
    return String(email).toLowerCase().trim();
}

function normalizeDisplayName(name) {
    if (name == null || name === "") return null;
    return String(name).toLowerCase().trim().replace(/\s+/g, " ");
}

function memberDedupeKey(rawId) {
    if (rawId == null || rawId === "") return null;
    return String(rawId);
}

function mergeMemberTaskPayload(prev, next) {
    const nextEmail = normalizeEmail(next.email);
    const prevEmail = normalizeEmail(prev.email);
    return {
        id: prev.id ?? next.id,
        service: prev.service,
        username: nextEmail
            ? next.username || prev.username
            : prevEmail
              ? prev.username
              : next.username || prev.username,
        email: prevEmail || nextEmail || null,
        avatar: prev.avatar || next.avatar || null,
    };
}

async function fetchListMemberProfileLookup() {
    const token = process.env.CLICKUP_API_TOKEN;
    const empty = { byId: new Map(), byEmail: new Map(), byUsername: new Map() };
    if (!token) {
        return empty;
    }
    try {
        const url = `https://api.clickup.com/api/v2/list/${CLICKUP_TEAM_LIST_ID}/member`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: token,
            },
        });
        if (!res.ok) {
            console.warn(
                `ClickUp list ${CLICKUP_TEAM_LIST_ID} members error:`,
                res.status
            );
            return empty;
        }
        const data = await res.json();
        const byId = new Map();
        const byEmail = new Map();
        const byUsername = new Map();
        for (const m of data.members || []) {
            const pic = m.profilePicture || null;
            if (!pic) continue;
            if (m.id != null) {
                byId.set(String(m.id), pic);
            }
            const em = normalizeEmail(m.email);
            if (em) {
                byEmail.set(em, pic);
            }
            const un = normalizeDisplayName(m.username);
            if (un && !byUsername.has(un)) {
                byUsername.set(un, pic);
            }
        }
        return { byId, byEmail, byUsername };
    } catch (e) {
        console.warn("ClickUp list members fetch failed:", e);
        return empty;
    }
}

function applyListProfilePictures(members, { byId, byEmail, byUsername }) {
    return members.map((m) => {
        const idStr = m.id != null ? String(m.id) : null;
        const emailNorm = normalizeEmail(m.email);
        const nameNorm = normalizeDisplayName(m.username);

        let avatar = m.avatar || null;

        if (!avatar && idStr) {
            avatar = byId.get(idStr) || null;
        }
        if (!avatar && emailNorm) {
            avatar = byEmail.get(emailNorm) || null;
        }
        if (!avatar && nameNorm) {
            avatar = byUsername.get(nameNorm) || null;
        }

        return { ...m, avatar };
    });
}

/**
 * @param {string} clickupTaskId - CustomerSettings.customerClickupID (ClickUp task id)
 * @returns {Promise<{ members: object[], customerServices: object[] }>}
 */
export async function fetchClickupTeamPayloadForCustomer(clickupTaskId) {
    const emptyServices = buildCustomerServicesStatus([]);

    if (!clickupTaskId || String(clickupTaskId).trim() === "") {
        return { members: [], customerServices: emptyServices };
    }

    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) {
        console.warn("fetchClickupTeamPayloadForCustomer: CLICKUP_API_TOKEN missing");
        return { members: [], customerServices: emptyServices };
    }

    const clickupUrl = `https://api.clickup.com/api/v2/task/${clickupTaskId}`;
    const headers = {
        Accept: "application/json",
        Authorization: token,
    };

    const [clickupResponse, listProfileLookup] = await Promise.all([
        fetch(clickupUrl, { method: "GET", headers }),
        fetchListMemberProfileLookup(),
    ]);

    if (!clickupResponse.ok) {
        console.warn(
            `ClickUp API error for task ${clickupTaskId}:`,
            clickupResponse.status
        );
        return { members: [], customerServices: emptyServices };
    }

    const clickupData = await clickupResponse.json();

    const servicesField = clickupData.custom_fields?.find(
        (f) => f.id === CLICKUP_CUSTOMER_SERVICES_FIELD_ID
    );
    const selectedServiceIds = Array.isArray(servicesField?.value)
        ? servicesField.value
        : [];
    const customerServices = buildCustomerServicesStatus(selectedServiceIds);

    const userFields = [
        "51ed563e-4a2c-489b-9506-be385c49a354",
        "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e",
        "2df85265-d5eb-4e86-a111-5d55623851fa",
        "55b3e92d-5972-4246-8160-73d7ba04401a",
        "28b06356-6f19-4633-bfa4-416c150a562c",
    ];

    const membersMap = new Map();

    function upsertFromTask(userId, entry) {
        const key = memberDedupeKey(userId);
        if (!key) return;
        const normalizedEntry = {
            ...entry,
            email: normalizeEmail(entry.email),
        };
        if (!membersMap.has(key)) {
            membersMap.set(key, normalizedEntry);
            return;
        }
        const prev = membersMap.get(key);
        const merged = mergeMemberTaskPayload(prev, normalizedEntry);
        membersMap.set(key, merged);
    }

    if (clickupData.custom_fields) {
        clickupData.custom_fields.forEach((field) => {
            if (userFields.includes(field.id) && field.value) {
                if (field.id === "28b06356-6f19-4633-bfa4-416c150a562c") {
                    const matchedOption = field.type_config?.options?.find(
                        (option) => option.orderindex === field.value
                    );
                    if (matchedOption) {
                        upsertFromTask(matchedOption.id, {
                            id: matchedOption.id,
                            username: matchedOption.name,
                            email: matchedOption.email || null,
                            service: field.id,
                            avatar: null,
                        });
                    }
                } else if (Array.isArray(field.value)) {
                    field.value.forEach((user) => {
                        upsertFromTask(user.id, {
                            id: user.id,
                            username: user.username,
                            email: user.email || null,
                            service: field.id,
                            avatar: user.profilePicture || user.avatar || null,
                        });
                    });
                } else {
                    const userId = field.value;
                    upsertFromTask(userId, {
                        id: userId,
                        username: field.name,
                        email: null,
                        service: field.id,
                        avatar: null,
                    });
                }
            }
        });
    }

    const membersRaw = Array.from(membersMap.values());

    const members = applyListProfilePictures(membersRaw, listProfileLookup);

    const membersSerialized = members.map((m) => ({
        ...m,
        id: m.id != null ? String(m.id) : m.id,
    }));

    return { members: membersSerialized, customerServices };
}
