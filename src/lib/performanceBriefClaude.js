import { buildClaudePayload } from "@/lib/performanceBriefIntent";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function getApiKey() {
    const keys = [
        process.env.CLAUDE_API_KEY,
        process.env.CLAUDE_CODE_API_KEY,
        process.env.ANTHROPIC_API_KEY,
    ];
    for (const key of keys) {
        if (typeof key === "string" && key.trim()) return key.trim();
    }
    return "";
}

export function isPerformanceBriefClaudeConfigured() {
    return Boolean(getApiKey());
}

function getModel() {
    return (
        (typeof process.env.CLAUDE_PERFORMANCE_BRIEF_MODEL === "string" &&
            process.env.CLAUDE_PERFORMANCE_BRIEF_MODEL.trim()) ||
        (typeof process.env.CLAUDE_AUDIT_MODEL === "string" &&
            process.env.CLAUDE_AUDIT_MODEL.trim()) ||
        "claude-sonnet-5"
    );
}

function supportsSamplingParams(model) {
    return !/claude-sonnet-5|claude-opus-5|claude-fable-5|sonnet-4-6/i.test(String(model || ""));
}

function extractJson(text) {
    const raw = String(text || "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(candidate.slice(start, end + 1));
    } catch {
        return null;
    }
}

function normalizeNarrative(parsed, compact, fallbackOptimizations = []) {
    const metaOk = compact.meta?.configured && !compact.meta?.error;
    const googleOk = compact.google?.configured && !compact.google?.error;
    const light = (value, fallback) => {
        const v = String(value || "").toLowerCase();
        if (v === "green" || v === "yellow" || v === "red") return v;
        return fallback;
    };
    const recs = (value) =>
        (Array.isArray(value) ? value : [])
            .map((row) => String(row || "").trim())
            .filter(Boolean)
            .slice(0, 3);

    const claudeOpts = recs(parsed?.topOptimizations);
    const topOptimizations =
        claudeOpts.length >= 2 ? claudeOpts : fallbackOptimizations.slice(0, 3);

    return {
        configured: true,
        headlineSentence: String(parsed?.headlineSentence || "").trim(),
        topOptimizations,
        meta: metaOk
            ? {
                  light: light(parsed?.meta?.light, "yellow"),
                  summary: String(parsed?.meta?.summary || "").trim(),
              }
            : null,
        google: googleOk
            ? {
                  light: light(parsed?.google?.light, "yellow"),
                  summary: String(parsed?.google?.summary || "").trim(),
              }
            : null,
    };
}

const SYSTEM_PROMPT = `Du er Searchminds interne Performance Brief-analytiker. Du skriver KUN narrativ til en ugentlig Slack-brief for Meta og Google Ads.

Du får et kompakt JSON med tal der allerede er aggregeret (seneste 7 dage vs. forrige 7 dage). Du må ALDRIG opfinde tal, kampagner, annoncer eller procenter. Brug kun de tal der står i JSON'et.

────────────────────────────────────────
TRIN 0 — KONTOENS HENSIGT ER ALLEREDE AFGJORT
────────────────────────────────────────
JSON'et indeholder feltet "accountIntent" med én klassifikation pr. kanal (type, primaryKpi, basis).
Den er udledt af kontoens faktiske konverteringsopsætning og er BINDENDE. Du må ikke omklassificere.

customer.businessCategory er "ecommerce" (Shopify/WooCommerce m.fl.) eller "b2b" (GA4 m.fl.):
- ecommerce: omsætning/ROAS er standard KPI på kanalniveau medmindre rækken har kpi "CPA".
- b2b: leads/CPA er standard KPI på kanalniveau medmindre rækken har kpi "ROAS".

Hver række i adTypes / campaignTypes / campaigns har feltet "kpi" udledt af rækkens egne konverteringshandlinger:
- "ROAS" = køb/salg-handling
- "CPA" = lead-/kontakthandling
- null = ingen målbar handling

Brug ALTID rækkens eget kpi — en konto kan have både ROAS- og CPA-rækker samtidig.

- kpi "ROAS": rapportér ROAS, omsætning og spend for den række.
- kpi "CPA": rapportér pris per lead og leadvolumen. Ordet ROAS må ikke forekomme for den række — heller ikke som "ROAS 0".
- kpi null: du ved kun hvad rækken koster. Skriv "ingen målt konvertering", aldrig "ROAS 0".
- valueMissing true på en række: kampagnen registrerer køb uden omsætningsværdi. Nævn det som tracking-fejl — ikke som dårlig ROAS.
- Læg aldrig leads og køb sammen til ét tal.

accountIntent.primaryKpi er kanalens overordnede retning; rækkens kpi har forrang når du omtaler en specifik kampagne/annonce/type.
- primaryKpi null ("uklar"): rapportér kun på spend, klik, CPC, impression share og retning, og gør det eksplicit at effektmålingen ikke kan bekræftes. Mindst én af de 3 optimeringer skal handle om at få konverteringsmålingen på plads.
- Kanalerne kan have hver sin primaryKpi. Følg dem hver for sig.

På CPA-konti: vurdér altid CPA sammen med volumen. Under ca. 10 leads i perioden er datagrundlaget for tyndt til en konklusion — skriv det i stedet for at kalde udsvinget en trend.

────────────────────────────────────────
OUTPUT
────────────────────────────────────────
Svar KUN med JSON i denne form:
{
  "headlineSentence": "Én sætning om de to kanalers retning (eller den ene kanal hvis kun én er aktiv), formuleret i kontoens egen KPI.",
  "topOptimizations": [
    "Tværgående optimering #1 med kanal, navn/type og tal (spend + kontoens primære KPI)",
    "...",
    "..."
  ],
  "meta": {
    "light": "green" | "yellow" | "red",
    "summary": "Én kort sætning om Meta."
  },
  "google": {
    "light": "green" | "yellow" | "red",
    "summary": "Én kort sætning om Google."
  }
}

────────────────────────────────────────
REGLER
────────────────────────────────────────
- Dansk, direkte, intern tone.
- Al KPI-omtale skal matche rækkens kpi (fallback: accountIntent pr. kanal). Skriv ROAS på en række med kpi "CPA" = fejl. Skriv CPA på en række med kpi "ROAS" uden at nævne ROAS = også fejl.
- POAS ≠ ROAS. Skriv kun POAS hvis JSON'et faktisk indeholder margin-/profitdata. Ellers ROAS.
- Præcis 3 topOptimizations på tværs af kanaler — prioritér hvor der brænder mest budget med dårlig effektivitet målt i kontoens egen KPI, eller hvor der er størst skaleringspotentiale.
- Hver topOptimization skal nævne kanal (Meta/Google), konkret kampagne/annonce/type fra JSON, plus spend og den relevante effektmetrik (ROAS/POAS for salg, CPA + leadvolumen for leads).
- På leadgen: vurdér ALTID volumen sammen med CPA. Lav CPA med 2 leads er ikke en succes — det er for tyndt datagrundlag til en konklusion, og det skal siges.
- Meta og Google måler konverteringer forskelligt — læg dem aldrig sammen, hverken omsætning eller leads.
- Hvis en kanal mangler, sæt den kanal til null og fokusér topOptimizations på den aktive kanal.
- Impression share: budgetLostIs vs rankLostIs — mere budget hjælper ikke hvis tabet er rang.
- Annoncetype "Ukendt" må du ikke overfortolke.
- Ved lave tal (få konverteringer/leads i perioden) skal lyset og sproget afspejle usikkerheden — brug "for tidligt at konkludere" frem for at kalde en tilfældig uge en trend.
- Lys-logik følger kontotypen: e-commerce på ROAS-udvikling og spend-effektivitet, leadgen på CPA-udvikling og leadvolumen, uklar konto kan maks. få "yellow" (aldrig grøn på et umåleligt setup).`;

/**
 * @param {object} compact
 * @param {string[]} [fallbackOptimizations]
 * @returns {Promise<object>}
 */
export async function analyzePerformanceBriefWithClaude(compact, fallbackOptimizations = []) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return {
            configured: false,
            error: "CLAUDE_API_KEY is not configured",
            headlineSentence: "",
            topOptimizations: fallbackOptimizations.slice(0, 3),
            meta: compact.meta?.configured && !compact.meta?.error
                ? { light: "yellow", summary: "" }
                : null,
            google: compact.google?.configured && !compact.google?.error
                ? { light: "yellow", summary: "" }
                : null,
        };
    }

    const payload = buildClaudePayload(compact, fallbackOptimizations);

    const model = getModel();
    try {
        const res = await fetch(ANTHROPIC_URL, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model,
                max_tokens: 2500,
                ...(supportsSamplingParams(model) ? { temperature: 0.25 } : {}),
                system: SYSTEM_PROMPT,
                messages: [
                    {
                        role: "user",
                        content: `Skriv narrativet til Performance Brief ud fra dette JSON. Opfind ingenting.\n\n${JSON.stringify(payload)}`,
                    },
                ],
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = data?.error?.message || data?.message || `Anthropic API error (${res.status})`;
            throw new Error(err);
        }
        const text = (Array.isArray(data.content) ? data.content : [])
            .filter((b) => b && b.type === "text" && typeof b.text === "string")
            .map((b) => b.text)
            .join("\n")
            .trim();
        const parsed = extractJson(text);
        if (!parsed) throw new Error("Claude returned no JSON narrative");
        return {
            ...normalizeNarrative(parsed, compact, fallbackOptimizations),
            model,
        };
    } catch (e) {
        return {
            configured: true,
            error: e.message || "Claude analysis failed",
            headlineSentence: "",
            topOptimizations: fallbackOptimizations.slice(0, 3),
            meta:
                compact.meta?.configured && !compact.meta?.error
                    ? { light: "yellow", summary: "" }
                    : null,
            google:
                compact.google?.configured && !compact.google?.error
                    ? { light: "yellow", summary: "" }
                    : null,
        };
    }
}
