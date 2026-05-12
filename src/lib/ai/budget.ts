import type { SupabaseClient } from "@supabase/supabase-js";

function getTodayMYT(): string {
  const myt = new Date(Date.now() + 8 * 3600_000);
  return myt.toISOString().slice(0, 10);
}

function nextMidnightMYT(): string {
  const myt = new Date(Date.now() + 8 * 3600_000);
  myt.setUTCHours(24, 0, 0, 0);
  return new Date(myt.getTime() - 8 * 3600_000).toISOString();
}

export async function getDailyBudget(
  userId: string,
  supabase: SupabaseClient
): Promise<{ callsUsed: number; callsLimit: number; remaining: number; resetAt: string }> {
  const today   = getTodayMYT();
  const resetAt = nextMidnightMYT();

  const { data: row } = await supabase
    .from("gemini_daily_budget")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    await supabase.from("gemini_daily_budget").insert({
      user_id: userId, date: today, calls_used: 0, calls_limit: 25,
    });
    return { callsUsed: 0, callsLimit: 25, remaining: 25, resetAt };
  }

  if (row.date !== today) {
    await supabase
      .from("gemini_daily_budget")
      .update({ date: today, calls_used: 0, last_reset: new Date().toISOString() })
      .eq("user_id", userId);
    return { callsUsed: 0, callsLimit: row.calls_limit, remaining: row.calls_limit, resetAt };
  }

  return {
    callsUsed: row.calls_used,
    callsLimit: row.calls_limit,
    remaining: Math.max(0, row.calls_limit - row.calls_used),
    resetAt,
  };
}

export async function getDigestBudget(
  userId: string,
  sessionId: string,
  supabase: SupabaseClient
): Promise<{ callsUsed: number; callsLimit: number; remaining: number }> {
  const DIGEST_CAP = 10;
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
  supabase: SupabaseClient
): Promise<boolean> {
  const [daily, digest] = await Promise.all([
    getDailyBudget(userId, supabase),
    getDigestBudget(userId, sessionId, supabase),
  ]);
  return daily.remaining > 0 && digest.remaining > 0;
}

export async function recordGeminiCall(
  userId: string,
  callType: string,
  sessionId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const [daily, digest] = await Promise.all([
    getDailyBudget(userId, supabase),
    getDigestBudget(userId, sessionId, supabase),
  ]);

  if (daily.remaining <= 0 || digest.remaining <= 0) return false;

  await Promise.all([
    supabase.from("gemini_usage").insert({
      user_id: userId, call_type: callType, digest_session_id: sessionId,
    }),
    supabase
      .from("gemini_daily_budget")
      .update({ calls_used: daily.callsUsed + 1 })
      .eq("user_id", userId),
  ]);

  return true;
}
