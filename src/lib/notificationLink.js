/**
 * Next.js <Link> treats hrefs without a leading / as relative to the current path.
 * Stored notification URLs like "news/my-slug" must become "/news/my-slug" for app routes.
 */
export function normalizeInternalNotificationHref(href) {
    if (!href || typeof href !== "string") return href;
    const s = href.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return s;
    if (s.startsWith("#") || s.startsWith("mailto:") || s.startsWith("tel:")) return s;
    return `/${s}`;
}
