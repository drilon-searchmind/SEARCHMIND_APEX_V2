import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import ApexRadarAccountAssignment from "@/models/ApexRadarAccountAssignment";
import Customer from "@/models/Customer";
import User from "@root/models/User";
import { APEX_RADAR_CHANNELS } from "@/lib/apexRadarChannels";
import { isDemoCustomerId } from "@/lib/demoCustomer";

function isValidChannel(ch) {
    return APEX_RADAR_CHANNELS.includes(String(ch || ""));
}

/**
 * GET /api/apex-radar/assignments?channel=facebook|google-ads
 * Returns { assignments: Record<customerId, string[]> }
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    if (!isValidChannel(channel)) {
        return NextResponse.json({ error: "Invalid or missing channel" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const docs = await ApexRadarAccountAssignment.find({ channel }).lean();
        /** @type {Record<string, string[]>} */
        const assignments = {};
        for (const d of docs) {
            assignments[String(d.customerId)] = (d.assignedUserIds || []).map((id) => String(id));
        }
        return NextResponse.json({ assignments });
    } catch (e) {
        console.error("[apex-radar/assignments GET]", e);
        return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
    }
}

/**
 * PUT /api/apex-radar/assignments
 * Body: { channel, customerId, userIds: string[] }
 */
export async function PUT(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const channel = body.channel;
    const customerId = body.customerId;
    if (!isValidChannel(channel)) {
        return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
        return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }
    if (!Array.isArray(body.userIds)) {
        return NextResponse.json({ error: "userIds must be an array" }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json({ error: "Demo customers cannot be edited" }, { status: 403 });
    }

    const uniqueIds = [...new Set(body.userIds.map((x) => String(x)).filter(Boolean))];
    for (const id of uniqueIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
        }
    }

    try {
        await connectToDatabase();

        const customer = await Customer.findById(customerId).select("_id").lean();
        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        if (uniqueIds.length > 0) {
            const validCount = await User.countDocuments({
                _id: { $in: uniqueIds },
                isExternal: { $ne: true },
                isArchived: { $ne: true },
            });
            if (validCount !== uniqueIds.length) {
                return NextResponse.json(
                    { error: "One or more users are invalid or not assignable" },
                    { status: 400 }
                );
            }
        }

        const cid = new mongoose.Types.ObjectId(String(customerId));

        if (uniqueIds.length === 0) {
            await ApexRadarAccountAssignment.deleteOne({ channel, customerId: cid });
            return NextResponse.json({ customerId: String(cid), userIds: [] });
        }

        const updated = await ApexRadarAccountAssignment.findOneAndUpdate(
            { channel, customerId: cid },
            {
                $set: {
                    assignedUserIds: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true, runValidators: true }
        ).lean();

        return NextResponse.json({
            customerId: String(updated.customerId),
            userIds: (updated.assignedUserIds || []).map((id) => String(id)),
        });
    } catch (e) {
        console.error("[apex-radar/assignments PUT]", e);
        return NextResponse.json({ error: e.message || "Failed to save assignments" }, { status: 500 });
    }
}
