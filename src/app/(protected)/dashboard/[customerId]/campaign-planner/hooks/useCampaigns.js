import { useState, useEffect, useCallback } from "react";

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
