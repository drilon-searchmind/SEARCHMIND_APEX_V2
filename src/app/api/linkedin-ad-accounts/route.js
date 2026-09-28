import { listLinkedInAdAccounts, resolveLinkedInAccessToken } from "@/lib/linkedinApi";

/**
 * GET /api/linkedin-ad-accounts
 * Lists ad accounts the server LinkedIn token can access.
 */
export async function GET() {
    try {
        await resolveLinkedInAccessToken();
        const accounts = await listLinkedInAdAccounts();
        return new Response(JSON.stringify({ accounts }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        const msg = err?.message || String(err);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
