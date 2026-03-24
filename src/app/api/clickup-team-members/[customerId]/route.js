// src/app/api/clickup-team-members/[customerId]/route.js
import Customer from '@/models/Customer';
import connectToDatabase from '../../../../../lib/mongodb';

/** Fixed ClickUp list whose /member endpoint includes profile pictures for Searchmind team. */
const CLICKUP_TEAM_LIST_ID = '210313781';
const CLICKUP_TEAM_MEMBERS_DEBUG = false;
function debugTeamMembers(...args) {
    if (CLICKUP_TEAM_MEMBERS_DEBUG) {
        console.log('[clickup-team-members]', ...args);
    }
}

function normalizeEmail(email) {
    if (email == null || email === '') return null;
    return String(email).toLowerCase().trim();
}

/** Match list `username` to task display names (e.g. Client Lead dropdown option name). */
function normalizeDisplayName(name) {
    if (name == null || name === '') return null;
    return String(name).toLowerCase().trim().replace(/\s+/g, ' ');
}

/** ClickUp may return the same user id as number or string; Map keys must be consistent. */
function memberDedupeKey(rawId) {
    if (rawId == null || rawId === '') return null;
    return String(rawId);
}

/**
 * Merge a duplicate assignment (same user, another custom field). Prefer richer task payload:
 * keep email/avatar when present; prefer username from the entry that has an email.
 */
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
            method: 'GET',
            headers: {
                Accept: 'application/json',
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
        debugTeamMembers('list /member loaded', {
            withPictureCount: byId.size,
            emailKeysSample: [...byEmail.keys()].slice(0, 5),
            idKeysSample: [...byId.keys()].slice(0, 5),
            usernameKeysSample: [...byUsername.keys()].slice(0, 5),
        });
        return { byId, byEmail, byUsername };
    } catch (e) {
        console.warn('ClickUp list members fetch failed:', e);
        return empty;
    }
}

function applyListProfilePictures(members, { byId, byEmail, byUsername }) {
    return members.map((m) => {
        const idStr = m.id != null ? String(m.id) : null;
        const emailNorm = normalizeEmail(m.email);
        const nameNorm = normalizeDisplayName(m.username);

        let avatar = m.avatar || null;
        let matchVia = avatar ? 'task' : null;

        // Order: workspace user id → email → display name (Client Lead option id is a UUID, not list user id)
        if (!avatar && idStr) {
            avatar = byId.get(idStr) || null;
            if (avatar) matchVia = 'listById';
        }
        if (!avatar && emailNorm) {
            avatar = byEmail.get(emailNorm) || null;
            if (avatar) matchVia = 'listByEmail';
        }
        if (!avatar && nameNorm) {
            avatar = byUsername.get(nameNorm) || null;
            if (avatar) matchVia = 'listByUsername';
        }

        debugTeamMembers('merge avatar', {
            username: m.username,
            id: m.id,
            idStr,
            idType: m.id === null || m.id === undefined ? 'nil' : typeof m.id,
            emailRaw: m.email,
            emailNorm,
            nameNorm,
            hadTaskAvatar: Boolean(m.avatar),
            listHasId: idStr ? byId.has(idStr) : false,
            listHasEmail: emailNorm ? byEmail.has(emailNorm) : false,
            listHasUsername: nameNorm ? byUsername.has(nameNorm) : false,
            matchVia,
            avatarSet: Boolean(avatar),
        });

        return { ...m, avatar };
    });
}

export async function GET(request, { params }) {
    try {
        await connectToDatabase();
        const resolvedParams = await params;
        const customerId = resolvedParams.customerId;

        // Fetch the customer to get their ClickUp ID
        const customer = await Customer.findById(customerId);
        
        if (!customer) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }

        const clickupId = customer?.CustomerSettings?.customerClickupID;
        
        if (!clickupId) {
            return Response.json({ members: [] }, { status: 200 });
        }

        const clickupUrl = `https://api.clickup.com/api/v2/task/${clickupId}`;
        const headers = {
            Accept: 'application/json',
            Authorization: process.env.CLICKUP_API_TOKEN,
        };

        const [clickupResponse, listProfileLookup] = await Promise.all([
            fetch(clickupUrl, { method: 'GET', headers }),
            fetchListMemberProfileLookup(),
        ]);

        if (!clickupResponse.ok) {
            console.warn(`ClickUp API error for task ${clickupId}:`, clickupResponse.status);
            return Response.json({ members: [] }, { status: 200 });
        }

        const clickupData = await clickupResponse.json();

        // Service field IDs
        const userFields = [
            "51ed563e-4a2c-489b-9506-be385c49a354", // SEO
            "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e", // PPC
            "2df85265-d5eb-4e86-a111-5d55623851fa", // PS
            "55b3e92d-5972-4246-8160-73d7ba04401a", // EM
            "28b06356-6f19-4633-bfa4-416c150a562c", // Client Lead
        ];

        const serviceMap = {
            "51ed563e-4a2c-489b-9506-be385c49a354": "SEO",
            "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "PPC",
            "2df85265-d5eb-4e86-a111-5d55623851fa": "PS",
            "55b3e92d-5972-4246-8160-73d7ba04401a": "EM",
            "28b06356-6f19-4633-bfa4-416c150a562c": "Client Lead",
        };

        const membersMap = new Map(); // key = normalized String(userId)

        function upsertFromTask(userId, entry) {
            const key = memberDedupeKey(userId);
            if (!key) {
                debugTeamMembers('skip upsert: no user id', { entry });
                return;
            }
            const normalizedEntry = {
                ...entry,
                email: normalizeEmail(entry.email),
            };
            if (!membersMap.has(key)) {
                membersMap.set(key, normalizedEntry);
                debugTeamMembers('task member added', {
                    key,
                    fieldService: serviceMap[entry.service] || entry.service,
                    ...normalizedEntry,
                });
                return;
            }
            const prev = membersMap.get(key);
            const merged = mergeMemberTaskPayload(prev, normalizedEntry);
            membersMap.set(key, merged);
            debugTeamMembers('task member merged (duplicate id across fields)', {
                key,
                prev,
                incoming: normalizedEntry,
                merged,
            });
        }

        if (clickupData.custom_fields) {
            clickupData.custom_fields.forEach(field => {
                if (userFields.includes(field.id) && field.value) {
                    // Handle Client Lead special case
                    if (field.id === "28b06356-6f19-4633-bfa4-416c150a562c") {
                        const matchedOption = field.type_config?.options?.find(
                            option => option.orderindex === field.value
                        );
                        if (matchedOption) {
                            upsertFromTask(matchedOption.id, {
                                id: matchedOption.id,
                                username: matchedOption.name,
                                email: matchedOption.email || null,
                                service: field.id,
                                avatar: null
                            });
                        }
                    } else if (Array.isArray(field.value)) {
                        field.value.forEach(user => {
                            upsertFromTask(user.id, {
                                id: user.id,
                                username: user.username,
                                email: user.email || null,
                                service: field.id,
                                avatar: user.profilePicture || user.avatar || null
                            });
                        });
                    } else {
                        const userId = field.value;
                        upsertFromTask(userId, {
                            id: userId,
                            username: field.name,
                            email: null,
                            service: field.id,
                            avatar: null
                        });
                    }
                }
            });
        }

        debugTeamMembers('task members before list merge', {
            count: membersMap.size,
            keys: [...membersMap.keys()],
            snapshot: [...membersMap.values()].map((m) => ({
                id: m.id,
                idStr: m.id != null ? String(m.id) : null,
                email: m.email,
                username: m.username,
                hadTaskAvatar: Boolean(m.avatar),
            })),
        });

        const members = applyListProfilePictures(
            Array.from(membersMap.values()),
            listProfileLookup
        );

        return Response.json({ members }, { status: 200 });
    } catch (error) {
        console.error('Error fetching team members:', error);
        return Response.json({ error: error.message, members: [] }, { status: 500 });
    }
}