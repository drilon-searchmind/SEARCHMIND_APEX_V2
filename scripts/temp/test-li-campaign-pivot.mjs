import "dotenv/config";
import { resolveLinkedInAccessToken, sponsoredAccountUrn, getLinkedInApiVersion } from "../../src/lib/linkedinApi.js";

const token = await resolveLinkedInAccessToken();
const version = getLinkedInApiVersion();
const id = "507014643";
const dr = "(start:(year:2026,month:9,day:1),end:(year:2026,month:9,day:27))";
const accounts = `List(${encodeURIComponent(sponsoredAccountUrn(id))})`;
const fields = "impressions,clicks,costInLocalCurrency,pivotValues";
const url = `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=ALL&dateRange=${dr}&accounts=${accounts}&fields=${fields}&start=0&count=10`;
const res = await fetch(url, {
    headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": version,
    },
});
console.log(res.status, (await res.text()).slice(0, 1500));
