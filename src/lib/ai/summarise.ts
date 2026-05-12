import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groqSummariseArticle, groqGetImpactAnalysis } from "./groq";
import { canMakeCall, recordGeminiCall } from "./budget";

export const GEMINI_QUOTA_EXCEEDED = "__GEMINI_QUOTA_EXCEEDED__";
export let geminiQuotaRetryAfter: string | null = null;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const doRequest = () =>
    fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

  let res = await doRequest();

  if (res.status === 429) {
    console.warn("[Gemini] Rate limited, retrying in 10s…");
    await sleep(10_000);
    res = await doRequest();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Gemini] HTTP ${res.status}:`, body.slice(0, 200));
    if (res.status === 429 || body.toLowerCase().includes("quota") || body.toLowerCase().includes("billing")) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) {
        const secs = Number(retryAfter);
        geminiQuotaRetryAfter = !isNaN(secs)
          ? new Date(Date.now() + secs * 1000).toISOString()
          : new Date(retryAfter).toISOString();
      } else {
        const now = new Date();
        geminiQuotaRetryAfter = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      }
      return GEMINI_QUOTA_EXCEEDED;
    }
    return "";
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (!text && finishReason && finishReason !== "STOP") {
    console.error("[Gemini] No text, finishReason:", finishReason);
  }
  return (text ?? "").trim();
}

// ── Combined single-call analysis (CHANGE 6) ──────────────────────────────────

export async function analyseArticle(
  article: RawArticle,
  userProfile: Profile,
  geminiProfile: string,
  userId?: string,
  sessionId?: string,
  supabase?: SupabaseClient
): Promise<{ summary: string; impactAnalysis: string; impactLevel: ImpactLevel }> {
  const fallback = {
    summary:       article.summary.slice(0, 150),
    impactAnalysis: "Impact analysis unavailable — daily AI limit reached. Refresh tomorrow for full analysis.",
    impactLevel:   "medium" as ImpactLevel,
  };

  if (!process.env.GEMINI_API_KEY) {
    return {
      summary:       article.summary.slice(0, 150),
      impactAnalysis: "Impact analysis unavailable for this article.",
      impactLevel:   "medium",
    };
  }

  if (userId && sessionId && supabase) {
    const allowed = await canMakeCall(userId, sessionId, supabase);
    if (!allowed) {
      console.log("[Budget] Exceeded — skipping Gemini for", article.title.slice(0, 50));
      return fallback;
    }
  }

  const occupation = userProfile.occupation ?? "professional";
  const location   = userProfile.location   ?? "Malaysia";
  const lifeStage  = userProfile.life_stage ?? "working adult";
  const vehicle    = userProfile.vehicle    ?? "commuter";

  const prompt =
    `You are a personal news analyst for a Malaysian news digest app. Always address the reader as 'you'. ` +
    `Only mention their profile details if directly relevant to the article. Be specific with numbers, dates, prices.\n\n` +
    `Analyse this article for a reader who is: ${occupation} in ${location}, ${lifeStage}, ${vehicle}.\n` +
    (geminiProfile ? `Reader preference profile: ${geminiProfile}\n\n` : "\n") +
    `Article title: ${article.title}\n` +
    `Article content: ${article.summary.slice(0, 400)}\n\n` +
    `Respond in JSON only, no markdown, no explanation:\n` +
    `{"summary":"One sentence (max 30 words) summarising the key fact of this article","impactAnalysis":"One to two sentences starting with you/your explaining direct personal impact with specific numbers if available","impactLevel":"high or medium or low"}`;

  try {
    const text = await callGemini(prompt);
    if (text && text !== GEMINI_QUOTA_EXCEEDED) {
      if (userId && sessionId && supabase) {
        await recordGeminiCall(userId, "article_analysis", sessionId, supabase);
      }
      try {
        const clean  = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(clean);
        const level  = (["high", "medium", "low"].includes(parsed.impactLevel)
          ? parsed.impactLevel : "medium") as ImpactLevel;
        return {
          summary:       parsed.summary       ?? article.summary.slice(0, 150),
          impactAnalysis: parsed.impactAnalysis ?? "No impact analysis available.",
          impactLevel:   level,
        };
      } catch {
        console.error("[Gemini] JSON parse failed for analyseArticle");
      }
    }
    if (text === GEMINI_QUOTA_EXCEEDED) return fallback;
  } catch { /* fall through */ }

  console.log("[AI] Falling back to Groq for analyseArticle");
  const [summary, impactAnalysis] = await Promise.all([
    groqSummariseArticle(article, userProfile),
    groqGetImpactAnalysis(article, userProfile, geminiProfile || undefined),
  ]);
  return { summary, impactAnalysis, impactLevel: "medium" };
}

// ── Legacy individual functions (kept for backward compatibility) ──────────────

export async function summariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return article.summary.slice(0, 200);

  const prompt =
    `You are a news summariser for a Malaysian news digest app. ` +
    `Write one clear, factual sentence (max 35 words) summarising the article's key point ` +
    `and its direct impact on everyday Malaysians. Be specific — include numbers, prices, or ` +
    `dates if present. Never start with 'The article says'.\n\n` +
    `Article title: ${article.title}\n` +
    `Source excerpt: ${article.summary.slice(0, 400)}\n` +
    `User profile: ${userProfile.occupation ?? "unknown occupation"} in ` +
    `${userProfile.location ?? "Malaysia"}, ${userProfile.life_stage ?? "general public"}\n\n` +
    `Write the summary sentence now:`;

  try {
    const text = await callGemini(prompt);
    if (text && text !== GEMINI_QUOTA_EXCEEDED) {
      console.log("[AI] Summary via Gemini");
      return text;
    }
  } catch { /* fall through */ }

  console.log("[AI] Gemini unavailable for summary, falling back to Groq");
  return groqSummariseArticle(article, userProfile);
}

export async function getImpactAnalysis(
  article: RawArticle,
  userProfile: Profile,
  geminiProfile?: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return "Impact analysis unavailable for this article.";

  const occupation = userProfile.occupation ?? "professional";
  const location   = userProfile.location   ?? "Malaysia";
  const lifeStage  = userProfile.life_stage ?? "working adult";
  const vehicle    = userProfile.vehicle    ?? "commuter";

  const profileContext = geminiProfile ? `Gemini profile context: ${geminiProfile}\n\n` : "";
  const prompt =
    `You are a personal news impact analyst. Explain in 1-2 sentences how this article directly affects the reader. ` +
    `Always address the reader as 'you' or 'your'. Be specific with numbers, prices, dates from the article.\n\n` +
    `${profileContext}` +
    `Article title: ${article.title}\n` +
    `Article summary: ${article.summary.slice(0, 300)}\n` +
    `Reader profile: ${occupation} in ${location}, ${lifeStage}, ${vehicle}\n\n` +
    `In 1-2 sentences, explain how this affects you (the reader):`;

  try {
    const text = await callGemini(prompt);
    if (text && text !== GEMINI_QUOTA_EXCEEDED) {
      console.log("[AI] Impact analysis via Gemini");
      return text;
    }
  } catch { /* fall through */ }

  console.log("[AI] Gemini unavailable for impact analysis, falling back to Groq");
  const groqText = await groqGetImpactAnalysis(article, userProfile, geminiProfile);
  if (groqText) return groqText;
  return GEMINI_QUOTA_EXCEEDED;
}
