
export default async function TestSearchConsolePropertiesPage() {
    let data = null;
    let error = null;
    let metrics = null;
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        // Fetch accessible properties
        const res = await fetch(`${baseUrl}/api/seo-dashboard/list-properties`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch properties');
        data = json.sites;
        // If we have at least one property, fetch metrics for it
        if (data && data.length > 0) {
            const siteUrl = data[0].siteUrl;
            // Use last 28 days as example
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 27);
            const format = d => d.toISOString().slice(0, 10);
            const metricsRes = await fetch(`${baseUrl}/api/seo-dashboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteUrl,
                    startDate: format(startDate),
                    endDate: format(endDate),
                }),
                cache: 'no-store',
            });
            const metricsJson = await metricsRes.json();
            if (!metricsRes.ok) throw new Error(metricsJson.error?.message || 'Failed to fetch metrics');
            metrics = metricsJson.metrics;
        }
    } catch (err) {
        error = err.message;
    }
    return (
        <div style={{ fontSize: 14, color: 'black', background: '#eee', padding: 16 }}>
            <div><b>Accessible Properties:</b></div>
            <pre>{error ? `Error: ${error}` : JSON.stringify(data, null, 2)}</pre>
            <div style={{ marginTop: 24 }}><b>Sample Metrics (last 28 days):</b></div>
            <pre>{metrics ? JSON.stringify(metrics, null, 2) : 'No metrics or error.'}</pre>
        </div>
    );
}