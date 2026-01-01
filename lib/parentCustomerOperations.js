import ParentCustomer from "@/models/ParentCustomer";
import connectToDatabase from './mongodb.js';

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
    return await ParentCustomer.findById(id).populate("customers");
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
