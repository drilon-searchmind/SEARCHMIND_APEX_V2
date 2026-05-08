import { useState, useEffect, useCallback } from "react";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";

export default function useCampaigns(customerId) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Create campaigns
  const createCampaigns = async (newCampaigns) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaigns),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create campaign(s)");
      }
      const created = await res.json();
      await fetchCampaigns();
      const count = Array.isArray(created) ? created.length : created ? 1 : 0;
      pushGTMEvent(GTM_EVENTS.CAMPAIGN_PLANNER_V1_CAMPAIGN_CREATED, {
        eventData: { customerId: String(customerId), count },
      });
      return created; // Return created campaigns
    } catch (err) {
      setError(err.message);
      throw err; // Re-throw so caller can handle
    } finally {
      setLoading(false);
    }
  };

  // Update campaign
  const updateCampaign = async (id, updateData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updateData }),
      });
      if (!res.ok) throw new Error("Failed to update campaign");
      await fetchCampaigns();
      pushGTMEvent(GTM_EVENTS.CAMPAIGN_PLANNER_V1_CAMPAIGN_UPDATED, {
        eventData: { customerId: String(customerId), campaignId: String(id) },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete campaign
  const deleteCampaign = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${customerId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
      await fetchCampaigns();
      pushGTMEvent(GTM_EVENTS.CAMPAIGN_PLANNER_V1_CAMPAIGN_DELETED, {
        eventData: { customerId: String(customerId), campaignId: String(id) },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) fetchCampaigns();
  }, [customerId, fetchCampaigns]);

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaigns,
    updateCampaign,
    deleteCampaign,
    setCampaigns,
  };
}
