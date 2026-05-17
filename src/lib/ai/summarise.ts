import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyseArticleGroq,
  groqSummariseArticle,
  groqGetImpactAnalysis,
  type AiTracking,
} from "./groq";
import { canMakeCall } from "./budget";
import { GEMINI_QUOTA_EXCEEDED as _QUOTA_CONST } from "@/lib/constants";

// Re-export from constants so server-only callers can still import from here
export const GEMINI_QUOTA_EXCEEDED = _QUOTA_CONST;
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
    impactAnalysis: "",
    impactLevel:    "medium" as ImpactLevel,
  };

  if (!process.env.GROQ_API_KEY) return fallback;

  if (userId && sessionId && supabase) {
    const allowed = await canMakeCall(userId, sessionId, supabase);
    if (!allowed) {
      console.log("[Budget] Exceeded — skipping AI for", article.title.slice(0, 50));
      return fallback;
    }
  }

  try {
    const tracking: AiTracking | undefined =
      userId && sessionId && supabase ? { userId, sessionId, supabase } : undefined;
    return await analyseArticleGroq(article, userProfile, aiProfile, tracking);
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
