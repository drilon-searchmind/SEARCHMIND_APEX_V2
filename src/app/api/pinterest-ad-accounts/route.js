import { listPinterestAdAccounts } from "@/lib/pinterestApi";

/**
 * GET /api/pinterest-ad-accounts
 * Returns ad accounts the token can access (ids + names) so you can copy an id into customer settings.
 */
export async function GET() {
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
    if (!accessToken) {
        return new Response(JSON.stringify({ error: "Missing PINTEREST_ACCESS_TOKEN on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
    try {
        const items = await listPinterestAdAccounts(accessToken);
        return new Response(JSON.stringify({ items }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message || String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
