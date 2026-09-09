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
        "claude-sonnet-4-20250514"
    );
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

Svar KUN med JSON i denne form:
{
  "headlineSentence": "Én sætning om de to kanalers retning (eller den ene kanal hvis kun én er aktiv).",
  "topOptimizations": [
    "Tværgående optimering #1 med kanal, navn/type og tal (spend + ROAS/CPA)",
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

Regler:
- Dansk, direkte, intern tone.
- Præcis 3 topOptimizations på tværs af kanaler — prioriter hvor der brænder mest budget med dårlig effektivitet, eller størst skaleringspotentiale.
- Hver topOptimization skal nævne kanal (Meta/Google), konkret kampagne/annonce/type fra JSON, plus spend og ROAS/CPA.
- Meta og Google måler omsætning forskelligt — læg dem aldrig sammen.
- Hvis en kanal mangler, sæt den kanal til null og fokusér topOptimizations på den aktive kanal.
- Impression share: budgetLostIs vs rankLostIs — mere budget hjælper ikke hvis tabet er rang.
- Annoncetype "Ukendt" må du ikke overfortolke.`;

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

    const payload = {
        customer: compact.customer,
        windows: compact.windows,
        meta:
            compact.meta?.configured && !compact.meta?.error
                ? {
                      accountType: compact.meta.accountType,
                      dataSource: compact.meta.dataSource,
                      last7: compact.meta.last7,
                      adTypes: compact.meta.adTypes,
                      campaigns: compact.meta.campaigns,
                      adsForAnalysis: compact.meta.adsForAnalysis,
                  }
                : compact.meta,
        google:
            compact.google?.configured && !compact.google?.error
                ? {
                      dataSource: compact.google.dataSource,
                      last7: compact.google.last7,
                      campaignTypes: compact.google.campaignTypes,
                      campaigns: compact.google.campaigns,
                  }
                : compact.google,
        heuristicOptimizations: fallbackOptimizations,
    };

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
                temperature: 0.25,
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
