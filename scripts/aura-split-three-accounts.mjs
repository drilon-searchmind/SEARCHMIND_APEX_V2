/**
 * Split Aura DK into Aura - EMOB / Aura - EL / Aura - Fiber.
 *
 *   node scripts/aura-split-three-accounts.mjs           # apply
 *   node scripts/aura-split-three-accounts.mjs --dry-run # preview only
 */
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../src/models/Customer.js";
import CustomDashboardInput from "../src/models/CustomDashboardInput.js";

const SOURCE_ID = "6a2beefcbe106fcd31646dcb";
const dryRun = process.argv.includes("--dry-run");

const FIBER_GOOGLE_ADS_ID = "1098959466";

const EMob_FILTER = {
    enabled: true,
    google: {
        include: "ladeboks, SM - V: Branding",
        exclude: "",
        excludeExact: ["SM - V: Branding"],
    },
    meta: {
        include: "Emob, Permission, Ladebok",
        exclude: "",
        excludeExact: [
            "Permission | Brabrand IF - AGF 2. dec",
            "Permission | Olivia 14. Okt - 30. nov",
        ],
    },
};

const EL_FILTER = {
    enabled: true,
    google: { include: "EL", exclude: "Emob, Fiber, ladeboks, Ladebok", excludeExact: [] },
    meta: { include: "EL", exclude: "Emob, Fiber", excludeExact: [] },
};

const FIBER_FILTER = {
    enabled: true,
    google: { include: "", exclude: "", excludeExact: [] },
    meta: { include: "Fiber", exclude: "Emob, EL", excludeExact: [] },
};

function cloneDoc(doc) {
    const o = doc.toObject ? doc.toObject() : { ...doc };
    delete o._id;
    delete o.__v;
    o.createdAt = new Date();
    o.updatedAt = new Date();
    return o;
}

async function copyAuraInputs(fromId, toId, filterOverride) {
    const docs = await CustomDashboardInput.find({ customer: fromId, dashboard: "aura" }).lean();
    for (const d of docs) {
        const data = d.key === "filter" && filterOverride ? filterOverride : d.data;
        if (dryRun) {
            console.log(`  [dry] copy input ${d.key} → new customer`);
            continue;
        }
        await CustomDashboardInput.findOneAndUpdate(
            { customer: toId, dashboard: "aura", key: d.key },
            { $set: { data, updatedBy: "aura-split-three-accounts" } },
            { upsert: true }
        );
    }
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });

const source = await Customer.findById(SOURCE_ID);
if (!source) {
    console.error("Source customer not found:", SOURCE_ID);
    process.exit(1);
}

console.log("Source:", source.customerName, SOURCE_ID);

if (!dryRun) {
    source.customerName = "Aura - EMOB";
    source.updatedAt = new Date();
    await source.save();
    console.log("Renamed → Aura - EMOB");
} else {
    console.log("[dry] Would rename → Aura - EMOB");
}

async function createClone(name, settingsPatch, filter) {
    const base = cloneDoc(source);
    base.customerName = name;
    base.CustomerSettings = {
        ...base.CustomerSettings,
        customDashboardsEnabled: true,
        ...settingsPatch,
    };
    if (dryRun) {
        console.log(`[dry] Would create customer "${name}"`, settingsPatch);
        await copyAuraInputs(SOURCE_ID, "(new)", filter);
        return null;
    }
    const created = await Customer.create(base);
    await copyAuraInputs(SOURCE_ID, created._id, filter);
    console.log("Created:", name, String(created._id));
    return created;
}

const existingEl = await Customer.findOne({ customerName: "Aura - EL", isArchived: { $ne: true } }).lean();
const existingFiber = await Customer.findOne({ customerName: "Aura - Fiber", isArchived: { $ne: true } }).lean();

if (!existingEl) {
    await createClone("Aura - EL", {}, EL_FILTER);
} else {
    console.log("Aura - EL already exists:", existingEl._id);
}

if (!existingFiber) {
    await createClone(
        "Aura - Fiber",
        { googleAdsCustomerId: FIBER_GOOGLE_ADS_ID },
        FIBER_FILTER
    );
} else {
    console.log("Aura - Fiber already exists:", existingFiber._id);
    if (!dryRun && existingFiber.CustomerSettings?.googleAdsCustomerId !== FIBER_GOOGLE_ADS_ID) {
        await Customer.updateOne(
            { _id: existingFiber._id },
            { $set: { "CustomerSettings.googleAdsCustomerId": FIBER_GOOGLE_ADS_ID } }
        );
        console.log("Updated Fiber Google Ads ID →", FIBER_GOOGLE_ADS_ID);
    }
}

if (!dryRun) {
    await CustomDashboardInput.findOneAndUpdate(
        { customer: SOURCE_ID, dashboard: "aura", key: "filter" },
        { $set: { data: EMob_FILTER, updatedBy: "aura-split-three-accounts" } },
        { upsert: true }
    );
}

console.log("\nDone.", dryRun ? "(dry run — no writes)" : "");
console.log("EMOB:", `/dashboard/${SOURCE_ID}/custom/performance`);

await mongoose.disconnect();