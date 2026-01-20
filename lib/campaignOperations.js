// lib/campaignOperations.js
import Campaign from "../models/Campaign";

export async function getCampaignsByCustomer(customerId) {
    return Campaign.find({ customerId });
}

export async function createCampaigns(customerId, campaigns) {
    const campaignsToCreate = Array.isArray(campaigns) ? campaigns : [campaigns];
    return Campaign.insertMany(campaignsToCreate.map((c) => ({ ...c, customerId })));
}

export async function updateCampaign(customerId, id, updateData) {
    return Campaign.findOneAndUpdate({ _id: id, customerId }, updateData, { new: true });
}

export async function deleteCampaign(customerId, id) {
    return Campaign.findOneAndDelete({ _id: id, customerId });
}

export async function getCampaignsByAssignedUser(userId) {
    return Campaign.find({ assignedUsers: userId });
}