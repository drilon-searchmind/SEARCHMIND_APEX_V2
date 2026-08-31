const SEARCHMIND_EMAIL_SUFFIX = "@searchmind.dk";

function isTruthyExternal(value) {
    return value === true || value === "true";
}

/**
 * Whether the user may configure Merchant Center / Price Index credentials.
 * Internal Searchmind staff only — not shared external report users.
 */
export function canConfigureMerchantCenter(user) {
    if (!user) return false;
    if (isTruthyExternal(user.isExternal)) return false;

    const email = String(user.email || "")
        .trim()
        .toLowerCase();
    if (email && !email.endsWith(SEARCHMIND_EMAIL_SUFFIX)) return false;

    return true;
}

export function assertCanConfigureMerchantCenter(sessionUser) {
    if (!canConfigureMerchantCenter(sessionUser)) {
        const err = new Error("Only Searchmind team members can configure Merchant Center");
        err.statusCode = 403;
        throw err;
    }
}
