# Kravspec: APEX `get_weekly_audit` route + server-side rapport

**Til:** Drilon (APEX MCP) · **Fra:** Christian · **Formål:** Flytte hele weekly-audit ind i APEX, så
de ~140 kunder kan køres uden at brænde tokens på en personlig Claude-bruger.

## Baggrund / hvorfor

Den nuværende Claude-skill får APEX til at returnere **flere MB rå JSON pr. kunde** (fx `get_shopify_products`
= 3,8 MB / 7.003 produkter, `get_google_ads` ~300 KB ×2, `get_seo_insights` ~200 KB), hvor vi reelt bruger
~30-40 tal. Det er datamængden — ikke Claudes tænkning — der koster. Løsningen er at lægge **fetch +
aggregering + udregning server-side** og kun returnere et lille, færdigt JSON.

## Arkitektur (v1)

```
APEX cron (ugentligt, over list_customers)
  └─ get_weekly_audit(customerId, periodStart, periodEnd)   ← al fetch + udregning server-side, returnerer kompakt JSON
       └─ narrativ-lag: APEX kalder Claude (RESIDENT API-nøgle i APEX) med JSON'et → narrativ-felter
            └─ render HTML fra fast skabelon (deterministisk)
                 └─ push til Rapport (create_report/begin_upload) + notifér ansvarlig (ClickUp-team)
```

- **Ingen personlig Claude-bruger** i loopet. Narrativ-kaldet kører på APEX' egen Claude-nøgle.
- Claude ser **kun det kompakte JSON** (få KB), aldrig de rå payloads. Det er det der gør det billigt ×140.

---

## 1) Route: `get_weekly_audit`

**Input**
| Felt | Type | Note |
|---|---|---|
| `customerId` | string | APEX id |
| `periodStart` | date `YYYY-MM-DD` | aktuel periode start (inkl.) |
| `periodEnd` | date `YYYY-MM-DD` | aktuel periode slut (inkl.) |
| `compare` | enum `prev_period` (default) \| `yoy` | forrige = samme antal dage umiddelbart forud |

APEX beregner selv forrige periode. Alt nedenfor returneres for **både** aktuel og forrige.

**Server-side logik (det skill'en i dag instruerer Claude i — flyt det ind i routen):**
1. **Service-detektion:** `integrations` er primær render-trigger. `customerServices` (+ parent-fallback hvis
   child har alle `active:false`/tomt team) afgør kontraktstatus + ansvarlige. Se status-enum nedenfor.
2. Hent merged sources (begge perioder), top-5 produkter efter `totalRevenue`, og pr. aktiv kanal: Google,
   Meta, SEO (GSC), Email (Klaviyo).
3. Udregn alt (POAS/ROAS, deltas, branded-split, SEO-værdi-estimat, returns-rate) og returnér **kun summer**.
4. **Drop alle store arrays** (7.000 produkter, 1.500 søgetermer, dag-for-dag-kampagner) — kun det der står
   i output-skemaet.

---

## 2) Output-skema (kompakt JSON)

Hvert måltal returneres helst som `{ "current": x, "previous": y, "deltaPct": z }` så HTML-render bliver triviel.

```jsonc
{
  "meta": {
    "customerId": "…", "customerName": "Kære Børn DK",
    "currency": "DKK", "vatBasis": "excl", "revenueType": "net_sales|total_sales",
    "periodStart": "2026-06-22", "periodEnd": "2026-06-28",
    "prevStart": "2026-06-15", "prevEnd": "2026-06-21",
    "metricPreference": "ROAS/POAS", "cogsConfigured": true,   // fetchCogsFromStore && COGS>0 → POAS pålidelig
    "parentCustomerId": null,
    "generatedAt": "2026-06-30T12:00:00Z"
  },

  "services": {
    // status: "active" | "contracted_not_connected" | "access_error" | "empty" | "not_contracted"
    "ppc":   { "status": "active", "responsible": ["Navn …"] },
    "ps":    { "status": "active", "responsible": [] },
    "seo":   { "status": "active", "responsible": [], "note": null },         // fx access_error → "GSC permission" i note
    "em":    { "status": "active", "responsible": [], "note": null }          // fx contracted_not_connected → "Klaviyo ikke koblet"
  },
  "integrations": { "store": true, "meta": true, "googleAds": true, "googleSearchConsole": true, "klaviyo": true, "ga4": false },

  "blended": {
    "totalSpend":   { "current": 36975, "previous": 32309, "deltaPct": 14.4 },
    "googleSpend":  { "current": 23882, "previous": 20449, "deltaPct": 16.8 },
    "metaSpend":    { "current": 13093, "previous": 11861, "deltaPct": 10.4 },
    "otherSpend":   { "current": 0, "previous": 0, "deltaPct": 0 },           // pinterest/snap/bing/reddit summeret
    "netSales":     { "current": 350011, "previous": 176093, "deltaPct": 98.8 },
    "orders":       { "current": 734, "previous": 354, "deltaPct": 107.3 },
    "returns":      { "current": 27426, "previous": 21234, "deltaPct": 29.2 },// absolut (positivt tal)
    "returnsRatePct": { "current": 7.8, "previous": 12.1 },                   // returns / netSales
    "grossProfitNet": { "current": 148554, "previous": 68522 },
    "poas":         { "current": 4.02, "previous": 2.12, "deltaPct": 89.6 },  // grossProfitNet / totalSpend
    "blendedRoas":  { "current": 9.47, "previous": 5.45, "deltaPct": 73.8 },  // netSales / totalSpend
    "cpa":          { "current": 50, "previous": 91, "deltaPct": -45.1 },
    "cvrProxyDeltaPct": 107.3                                                 // = orders deltaPct (sessions ikke tilgængelige)
  },

  "topSellers": [
    { "title": "Emmaljunga Big Star SENTO – Outdoor Black 2026", "revenue": 67992, "units": 8 }
    // … max 5
  ],

  "ppc": {                       // udelad hvis status != active
    "spend":  { "current": 23882, "previous": 20449, "deltaPct": 16.8 },
    "roas":   { "current": 14.99, "previous": 8.90, "deltaPct": 68.4 },
    "poas":   { "current": null, "previous": null },                          // hvis beregnet på kanal; ellers null
    "conversions": { "current": 523, "previous": 236 },
    "conversionValue": { "current": 357965, "previous": 182094 },
    "cpa":    { "current": 46, "previous": 87, "deltaPct": -47.1 },
    "ctr":    { "current": 3.54, "previous": 2.59 },                          // procent
    "cpc":    { "current": 1.53, "previous": 1.66 },
    "impressionShare": { "current": 19.3, "previous": 63.5 },                 // procent
    "isLostBudgetPct": 1.6, "isLostRankPct": 29.7,
    "zeroSpendLastDay": false
  },

  "ps": {                        // Meta
    "spend":  { "current": 13093, "previous": 11861, "deltaPct": 10.4 },
    "roas":   { "current": 9.95, "previous": 3.60, "deltaPct": 176.4 },
    "conversions": { "current": 130, "previous": 57 },                        // kan være leads pr. kunde
    "conversionValue": { "current": 130286, "previous": 42737 },
    "cpa":    { "current": 101, "previous": 208, "deltaPct": -51.6 },         // kan være CPL pr. kunde
    "frequency": { "current": 3.41, "previous": 3.02 },
    "linkCtr": { "current": 1.69, "previous": 1.67 },                         // link_clicks/impressions, procent
    "conversionType": "purchase",                                            // purchase|lead|traffic (afled af kundens mål)
    "zeroSpendLastDay": false,
    "funnelAvailable": false, "newVsReturningAvailable": false,               // forbehold (CAPI-afhængigt)
    "topCampaigns": [ { "name": "SM | AO_CBO-testing | Conversion", "roas": 47.2, "spend": 1762 } ]  // max 3
  },

  "seo": {                       // GSC
    "clicks":      { "current": 4558, "previous": 4471, "deltaPct": 1.9 },
    "impressions": { "current": 235450, "previous": 249263, "deltaPct": -5.5 },
    "ctr":         { "current": 1.94, "previous": 1.79 },                     // procent
    "avgPosition": { "current": 8.78, "previous": 8.75 },                     // GSC vægtet snit (note: 2-3 dages delay)
    "brandClassified": false,                                                 // hvis false → spring branded-split over
    "brandedSharePct": null, "nonBrandedSharePct": null,
    "seoValueEstimate": 7000, "seoValueMethod": "clicks × avgCpc",           // ESTIMAT — altid markeres
    "gscDelayWarning": true,                                                  // hvis periodeEnd inden for 3 dage
    "topNonBrandKeywords": ["barnevogn", "klapvogn", "ventilator til barnevogn"]  // max ~5
  },

  "em": {                        // Klaviyo
    "attributedRevenue": { "current": 75683, "previous": 18197, "deltaPct": 315.9 },
    "shareOfTotalPct": 21.6,                                                  // attributedRevenue / netSales
    "orders":     { "current": 94, "previous": 25, "deltaPct": 276.0 },
    "openRate":   { "current": 56.2, "previous": 60.7 },                      // procent
    "clickRate":  { "current": 0.79, "previous": 0.46 },
    "recipients": { "current": 168160, "previous": 83735, "deltaPct": 100.8 },
    "unsubscribes": { "current": 330, "previous": 179 },
    "listGrowthAvailable": false,                                            // listestørrelse ikke i payload
    "empty": false                                                           // true hvis 0 modtagere → render som datahul
  },

  "flags": {
    "returnsAlarm": true,        // returns deltaPct > 50 ELLER stort enkeltdags-spike
    "zeroSpendAlarm": false,     // 0 kr seneste dag på aktiv betalt kanal
    "dataGaps": [ ]              // fx [{ "service":"seo", "reason":"access_error", "message":"GSC permission" }]
  }
}
```

### Status-enum pr. service (vigtigt — verificeret på tests)
| `status` | Hvornår | Render |
|---|---|---|
| `active` | integration ON + data findes | fuld sektion |
| `contracted_not_connected` | kontrakteret (ClickUp) men integration OFF | header + datahul-note |
| `access_error` | integration ON men API fejler (fx GSC "insufficient permission") | header + datahul-note m. årsag |
| `empty` | integration ON men 0 volumen (fx Klaviyo flows-only/ingen udsendelser) | header + "ingen aktivitet"-note |
| `not_contracted` | hverken kontrakteret eller koblet | **udelad sektionen** |

### Beregningsnoter (så APEX og rapport er enige)
- **POAS** = `grossProfitNetSales / totalSpend` (APEX giver allerede `grossProfitNetSales` + `poasCalculation`). POAS primært når `cogsConfigured`; ellers kun ROAS + note.
- Alle revenue-tal følger `revenueDisplayVat`. Rapport viser net sales for konsistens med POAS, også når `revenueType=total_sales`.
- **Attribution:** kanal-conversionValue summer typisk > netSales (overlap + organisk). Medsend tal råt; rapporten noterer forbeholdet.
- SEO branded-split kun hvis `brandClassified` (brandMetrics ikke-null). Ellers udelad — opfind aldrig 0 %.

---

## 3) Narrativ-lag (APEX → Claude på resident nøgle)

Efter routen: APEX sender **kun JSON'et ovenfor** til Claude med en fast prompt og får disse felter retur
(lille input, kort output → billigt ×140):

```jsonc
{
  "notes": { "spend": "…", "revenue": "…", "poas": "…", "cpa": "…",
             "ppc": "…", "ps": "…", "seo": "…", "em": "…" },        // 1 sætning hver, kun for aktive
  "optimizations": [
    { "service": "ppc", "title": "Fang uforløst impression share",
      "what": "…", "expectedEffect": "…", "priority": "Høj" }       // ×3, på tværs af kanaler
  ],
  "critical": { "hasCritical": false, "items": ["…"], "actionNow": "… + ansvarlig" },
  "businessCases": [ /* valgfrit v1.1: hero-metric, 3 scenarier, formel, kilde, antagelser pr. optimering */ ]
}
```

**Regler til prompten:** aldrig opfind tal (kun fortolk de leverede), markér estimater, hold tonen direkte/
forretningskritisk, dansk. Business-case-laget kan komme i v1.1.

---

## 4) Render + levering (server-side, ingen tokens)

- HTML bygges fra en **fast skabelon** (findes: `weekly-audit/references/report-html.md` — Searchmind-brand,
  lyst tema, AcidGrotesk via `tokens.css`, logo, POAS som dark-hero, KPI-kort, top-seller-tabel, footer-tagline).
  Tal/tabeller/kort er ren string-substitution — **ingen LLM**.
- Push til **Rapport** via eksisterende API (`begin_upload`/`create_report`). Pr. kunde: unlisted link,
  evt. password, permanent hvis ønsket.
- Notifér **ansvarlig** (ClickUp-team fra routen) med linket — Slack/mail.

## 5) Åbne punkter til Drilon
1. Kan narrativ-kaldet køre på APEX' resident Claude-nøgle i cron-konteksten? (Christian: ja, det var ønsket.)
2. ClickUp `member.service`-UUID kan i dag ikke dekodes til rolle (PPC/PS/SEO/EM) — `responsible` bliver derfor
   en liste af navne, ikke "X er PPC-ansvarlig". Skal vi tilføje en rolle-mapping i APEX?
3. Kadence + hvilke kunder (alle aktive? pr. ansvarlig?) + leveringskanal (Rapport-link i Slack vs. mail).
```
