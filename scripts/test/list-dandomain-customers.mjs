import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const schema = new mongoose.Schema(
    { customerName: String, customerType: String, CustomerSettings: mongoose.Schema.Types.Mixed },
    { strict: false }
);
const Customer = mongoose.model("Customer", schema);

await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });

for (const t of ["DanDomain", "DanDomainOriginal"]) {
    const rows = await Customer.find({ customerType: t })
        .select(
            "customerName customerType CustomerSettings.danDomain CustomerSettings.danDomainOriginal CustomerSettings.shopifyUrl"
        )
        .sort({ customerName: 1 })
        .lean();

    console.log(`\n=== ${t} (${rows.length}) ===`);
    for (const r of rows) {
        console.log(
            JSON.stringify({
                name: r.customerName,
                shopHost: r.CustomerSettings?.danDomain?.shopHost || null,
                shopAdminUrl: r.CustomerSettings?.danDomainOriginal?.shopAdminUrl || null,
                shopifyUrl: r.CustomerSettings?.shopifyUrl || null,
            })
        );
    }
}

await mongoose.disconnect();
