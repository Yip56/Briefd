import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyseArticleGroq,
  groqSummariseArticle,
  groqGetImpactAnalysis,
} from "./groq";
import { canMakeCall, recordGeminiCall } from "./budget";

// Kept as a sentinel value for backward compatibility — no longer returned in practice
export const GEMINI_QUOTA_EXCEEDED = "__GEMINI_QUOTA_EXCEEDED__";
export let geminiQuotaRetryAfter: string | null = null;

export async function analyseArticle(
  article: RawArticle,
  userProfile: Profile,
  aiProfile: string,
  userId?: string,
  sessionId?: string,
  supabase?: SupabaseClient
): Promise<{ summary: string; impactAnalysis: string; impactLevel: ImpactLevel }> {
  const fallback = {
    summary:        article.summary.slice(0, 150),
    impactAnalysis: "Impact analysis unavailable — daily AI limit reached. Refresh tomorrow for full analysis.",
    impactLevel:    "medium" as ImpactLevel,
  };

  if (!process.env.GROQ_API_KEY) {
    return {
      summary:        article.summary.slice(0, 150),
      impactAnalysis: "Impact analysis unavailable for this article.",
      impactLevel:    "medium",
    };
  }

  if (userId && sessionId && supabase) {
    const allowed = await canMakeCall(userId, sessionId, supabase);
    if (!allowed) {
      console.log("[Budget] Exceeded — skipping AI for", article.title.slice(0, 50));
      return fallback;
    }
  }

  try {
    const result = await analyseArticleGroq(article, userProfile, aiProfile);
    if (userId && sessionId && supabase) {
      await recordGeminiCall(userId, "article_analysis", sessionId, supabase);
    }
    return result;
  } catch (err) {
    console.error("[AI] analyseArticleGroq failed:", err);
    return fallback;
  }
}

// Legacy individual functions kept for backward compatibility

export async function summariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
  try {
    return await groqSummariseArticle(article, userProfile);
  } catch {
    return article.summary.slice(0, 200);
  }
}

export async function getImpactAnalysis(
  article: RawArticle,
  userProfile: Profile,
  aiProfile?: string
): Promise<string> {
  try {
    const text = await groqGetImpactAnalysis(article, userProfile, aiProfile);
    return text || "Impact analysis unavailable for this article.";
  } catch {
    return "Impact analysis unavailable for this article.";
  }
}
