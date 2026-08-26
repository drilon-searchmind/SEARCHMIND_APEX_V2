import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { listMerchantAccounts, normalizeMerchantAccountId } from "@/lib/merchantCenter/merchantCenterAccounts";
import { hasMerchantCredentials, normalizeMerchantAccountSlot } from "@/lib/merchantCenter/merchantCenterAuth";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.isAdmin !== true) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const slotParam = new URL(request.url).searchParams.get("slot");
    const slot = normalizeMerchantAccountSlot(slotParam);
    const merchantAccountId = new URL(request.url).searchParams.get("merchantAccountId");

    if (!hasMerchantCredentials(slot)) {
        return Response.json(
            {
                error: `Merchant Center OAuth credentials are not configured for slot ${slot}`,
                code: "NO_CREDENTIALS",
            },
            { status: 400 }
        );
    }

    try {
        const accounts = await listMerchantAccounts(slot);
        const targetId = merchantAccountId
            ? normalizeMerchantAccountId(merchantAccountId)
            : null;

        return Response.json({
            slot,
            accounts: accounts.map((account) => ({
                id: account.id,
                accountName: account.accountName,
                matchesTarget: targetId ? account.id === targetId : false,
            })),
            targetId,
            targetFound: targetId
                ? accounts.some((account) => account.id === targetId)
                : null,
        });
    } catch (error) {
        console.error("merchant-center accounts GET:", error);
        return Response.json(
            { error: error.message || "Failed to list Merchant Center accounts" },
            { status: 500 }
        );
    }
}
