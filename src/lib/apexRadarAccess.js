/**
 * Apex Radar: admins and internal (non-external) users only.
 * External users are redirected away unless they are admins (edge case).
 */
export function canAccessApexRadar(user) {
    if (!user) return false;
    return Boolean(user.isAdmin || !user.isExternal);
}
