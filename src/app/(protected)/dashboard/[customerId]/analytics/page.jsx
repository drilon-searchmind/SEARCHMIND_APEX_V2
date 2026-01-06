"use client";

import React from 'react'

export default function AnalyticsPage() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    const fetchGa4 = React.useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            // Using default propertyId (460732795) configured in the API route
            const res = await fetch('/api/ga4');
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Failed to fetch GA4 data');
            setData(json);
        } catch (e) {
            setError(e?.message || 'Unexpected error');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchGa4(); }, [fetchGa4]);

    return (
        <div>
            <div style={{ fontSize: 14, color: 'black', background: '#eee', padding: 16 }}>
                <pre>
                    {loading ? 'Loading GA4 data...' : error ? `Error: ${error}` : JSON.stringify(data, null, 2)}
                </pre>
            </div>
        </div>
    );
}