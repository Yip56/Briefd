import type { SupabaseClient } from "@supabase/supabase-js";

export type AiProvider = "groq" | "gemini";

export interface ProviderUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface DailyBudgetExpanded {
  groq: ProviderUsage;
  gemini: ProviderUsage;
  total: ProviderUsage;
  resetAt: string;
  todayDate: string;
}

const GROQ_LIMIT   = 100;
const GEMINI_LIMIT = 25;
const TOTAL_LIMIT  = GROQ_LIMIT + GEMINI_LIMIT;
const DIGEST_CAP   = 20;

function getTodayMYT(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

function nextMidnightMYT(): string {
  const myt = new Date(Date.now() + 8 * 3600_000);
  myt.setUTCHours(24, 0, 0, 0);
  return new Date(myt.getTime() - 8 * 3600_000).toISOString();
}

export async function getDailyBudget(
  userId: string,
  supabase: SupabaseClient
): Promise<DailyBudgetExpanded> {
  const today   = getTodayMYT();
  const resetAt = nextMidnightMYT();

  const { data: row } = await supabase
    .from("gemini_daily_budget")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    await supabase.from("gemini_daily_budget").insert({
      user_id:           userId,
      date:              today,
      calls_used:        0,
      calls_limit:       TOTAL_LIMIT,
      groq_calls_used:   0,
      groq_calls_limit:  GROQ_LIMIT,
      gemini_calls_used: 0,
      gemini_calls_limit: GEMINI_LIMIT,
    });
    return {
      groq:   { used: 0, limit: GROQ_LIMIT,   remaining: GROQ_LIMIT },
      gemini: { used: 0, limit: GEMINI_LIMIT,  remaining: GEMINI_LIMIT },
      total:  { used: 0, limit: TOTAL_LIMIT,   remaining: TOTAL_LIMIT },
      resetAt,
      todayDate: today,
    };
  }

  if (row.date !== today) {
    await supabase
      .from("gemini_daily_budget")
      .update({
        date:              today,
        calls_used:        0,
        groq_calls_used:   0,
        gemini_calls_used: 0,
        last_reset:        new Date().toISOString(),
      })
      .eq("user_id", userId);

    const gl = row.groq_calls_limit   ?? GROQ_LIMIT;
    const ml = row.gemini_calls_limit  ?? GEMINI_LIMIT;
    return {
      groq:   { used: 0, limit: gl,      remaining: gl },
      gemini: { used: 0, limit: ml,      remaining: ml },
      total:  { used: 0, limit: gl + ml, remaining: gl + ml },
      resetAt,
      todayDate: today,
    };
  }

  const groqUsed    = row.groq_calls_used    ?? 0;
  const groqLimit   = row.groq_calls_limit   ?? GROQ_LIMIT;
  const geminiUsed  = row.gemini_calls_used  ?? 0;
  const geminiLimit = row.gemini_calls_limit ?? GEMINI_LIMIT;
  const totalUsed   = row.calls_used         ?? (groqUsed + geminiUsed);
  const totalLimit  = row.calls_limit        ?? (groqLimit + geminiLimit);

  return {
    groq:   { used: groqUsed,   limit: groqLimit,   remaining: Math.max(0, groqLimit   - groqUsed)   },
    gemini: { used: geminiUsed, limit: geminiLimit,  remaining: Math.max(0, geminiLimit - geminiUsed)  },
    total:  { used: totalUsed,  limit: totalLimit,   remaining: Math.max(0, totalLimit  - totalUsed)   },
    resetAt,
    todayDate: today,
  };
}

export async function getDigestBudget(
  userId: string,
  sessionId: string,
  supabase: SupabaseClient
): Promise<{ callsUsed: number; callsLimit: number; remaining: number }> {
  const { count } = await supabase
    .from("gemini_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("digest_session_id", sessionId);

  const callsUsed = count ?? 0;
  return { callsUsed, callsLimit: DIGEST_CAP, remaining: Math.max(0, DIGEST_CAP - callsUsed) };
}

export async function canMakeCall(
  userId: string,
  sessionId: string,
  supabase: SupabaseClient,
  provider: AiProvider = "groq"
): Promise<boolean> {
  const [budget, digest] = await Promise.all([
    getDailyBudget(userId, supabase),
    getDigestBudget(userId, sessionId, supabase),
  ]);
  const providerRemaining = provider === "groq" ? budget.groq.remaining : budget.gemini.remaining;
  return providerRemaining > 0 && digest.remaining > 0;
}

export async function recordAiCall(
  userId: string,
  callType: string,
  sessionId: string,
  provider: AiProvider,
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const model = provider === "groq" ? "llama-3.1-8b-instant" : "gemini-2.0-flash";

    const { error: insertError } = await supabase.from("gemini_usage").insert({
      user_id:           userId,
      call_type:         callType,
      digest_session_id: sessionId,
      provider,
      model,
      called_at:         new Date().toISOString(),
    });

    if (insertError) {
      console.error("[AI Budget] Insert failed:", insertError.message, insertError.code);
      return false;
    }

    const { error: rpcError } = await supabase.rpc("increment_ai_usage", {
      p_user_id: userId,
      p_provider: provider,
    });

    if (rpcError) {
      console.error("[AI Budget] Budget increment failed:", rpcError.message, rpcError.code);
    }

    console.log(`[AI Budget] Recorded: ${provider}/${callType} for user ${userId.slice(0, 8)}`);
    return true;
  } catch (err) {
    console.error("[AI Budget] Unexpected error:", err);
    return false;
  }
}

// Backward-compatible alias
export const recordGeminiCall = (
  userId: string,
  callType: string,
  sessionId: string,
  supabase: SupabaseClient
) => recordAiCall(userId, callType, sessionId, "groq", supabase);
