import ParentCustomer from "@/models/ParentCustomer";
import Customer from "@/models/Customer";
import connectToDatabase from './mongodb.js';

/** Merge ParentCustomer.customers with Customer.parentCustomer links (home page uses the latter). */
async function mergeParentChildCustomers(parent) {
    if (!parent) return [];

    const populated = (parent.customers || []).filter((c) => c && c.isArchived !== true);
    const linkedByField = await Customer.find({
        parentCustomer: parent._id,
        isArchived: { $ne: true },
    });

    const byId = new Map();
    for (const c of populated) {
        byId.set(String(c._id), c);
    }
    for (const c of linkedByField) {
        const key = String(c._id);
        if (!byId.has(key)) byId.set(key, c);
    }

    const merged = Array.from(byId.values());

    const listedIds = new Set(populated.map((c) => String(c._id)));
    const missingOnParent = merged.filter((c) => !listedIds.has(String(c._id)));
    if (missingOnParent.length > 0) {
        await ParentCustomer.findByIdAndUpdate(parent._id, {
            $addToSet: { customers: { $each: missingOnParent.map((c) => c._id) } },
        });
    }

    return merged;
}

// CREATE
export async function createParentCustomer(data) {
    await connectToDatabase();
    const parent = new ParentCustomer(data);
    return await parent.save();
}

// READ (all or by id)
export async function getParentCustomers(filter = {}) {
    await connectToDatabase();
    return await ParentCustomer.find(filter).populate("customers");
}

export async function getParentCustomerById(id) {
    await connectToDatabase();
    const parent = await ParentCustomer.findById(id).populate("customers");
    if (!parent) return null;
    parent.customers = await mergeParentChildCustomers(parent);
    return parent;
}

// UPDATE
export async function updateParentCustomer(id, update) {
    await connectToDatabase();
    return await ParentCustomer.findByIdAndUpdate(id, update, { new: true });
}

// DELETE
export async function deleteParentCustomer(id) {
    await connectToDatabase();
    return await ParentCustomer.findByIdAndDelete(id);
}
