import type { RawArticle, Profile } from "@/lib/types";

export const GEMINI_QUOTA_EXCEEDED = "__GEMINI_QUOTA_EXCEEDED__";
export let geminiQuotaRetryAfter: string | null = null;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT =
  "You are a news summariser for a Malaysian news digest app. " +
  "Write one clear, factual sentence (max 35 words) summarising the article's key point " +
  "and its direct impact on everyday Malaysians. Be specific — include numbers, prices, or " +
  "dates if present. Never start with 'The article says'.";

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Gemini] HTTP ${res.status}:`, body.slice(0, 200));
    if (res.status === 429 || body.toLowerCase().includes("quota") || body.toLowerCase().includes("billing")) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) {
        // Retry-After is either seconds or an HTTP date string
        const secs = Number(retryAfter);
        if (!isNaN(secs)) {
          geminiQuotaRetryAfter = new Date(Date.now() + secs * 1000).toISOString();
        } else {
          geminiQuotaRetryAfter = new Date(retryAfter).toISOString();
        }
      } else {
        // Billing quota: resets on 1st of next month
        const now = new Date();
        const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        geminiQuotaRetryAfter = reset.toISOString();
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

export async function summariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return article.summary.slice(0, 200);

  const prompt =
    `${SYSTEM_PROMPT}\n\n` +
    `Article title: ${article.title}\n` +
    `Source excerpt: ${article.summary.slice(0, 400)}\n` +
    `User profile: ${userProfile.occupation ?? "unknown occupation"} in ` +
    `${userProfile.location ?? "Malaysia"}, ${userProfile.life_stage ?? "general public"}\n\n` +
    `Write the summary sentence now:`;

  try {
    const text = await callGemini(prompt);
    if (text === GEMINI_QUOTA_EXCEEDED) return article.summary.slice(0, 200);
    return text || article.summary.slice(0, 200);
  } catch {
    return article.summary.slice(0, 200);
  }
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

  const profileContext = geminiProfile
    ? `User preference profile: ${geminiProfile}. Use this to personalise the impact analysis.\n\n`
    : "";

  const prompt =
    `${profileContext}` +
    `You are a personal impact analyst for a Malaysian news digest. ` +
    `In exactly 1-2 sentences, explain how this specific news directly affects someone who is a ` +
    `${occupation} in ${location} who is ${lifeStage} and ${vehicle}. ` +
    `Be specific — mention dates, amounts, percentages if present. ` +
    `Start your response with a direct impact statement, never with 'This article'. ` +
    `Article title: ${article.title}. Summary: ${article.summary.slice(0, 300)}`;

  try {
    const text = await callGemini(prompt);
    if (text === GEMINI_QUOTA_EXCEEDED) return GEMINI_QUOTA_EXCEEDED;
    return text || "Impact analysis unavailable for this article.";
  } catch {
    return "Impact analysis unavailable for this article.";
  }
}
