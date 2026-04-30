import User from "@root/models/User";

/**
 * Reads PS exclusion list from a lean assignment doc: prefers User ObjectIds, migrates legacy ClickUp string ids.
 * @param {{ paidSocialExcludedUserIds?: unknown[], clickUpExcludedMemberIds?: unknown[] } | null | undefined} docLean
 * @returns {Promise<string[]>}
 */
export async function resolvePaidSocialExcludedUserIdsFromDoc(docLean) {
    const fromNew = (docLean?.paidSocialExcludedUserIds || []).map((id) => String(id));
    const legacy = docLean?.clickUpExcludedMemberIds || [];
    if (fromNew.length || !Array.isArray(legacy) || legacy.length === 0) {
        return [...new Set(fromNew.filter(Boolean))];
    }
    const keys = [...new Set(legacy.map((x) => String(x).trim()).filter(Boolean))];
    if (!keys.length) return [];
    const users = await User.find({
        clickupId: { $in: keys },
        isExternal: { $ne: true },
        isArchived: { $ne: true },
    })
        .select("_id")
        .lean();
    return [...new Set(users.map((u) => String(u._id)))];
}
