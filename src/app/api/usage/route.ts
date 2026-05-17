import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyBudget } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";

function getTodayMYT(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

const CALL_TYPE_META: Record<string, { label: string; tokens: number }> = {
  article_analysis:  { label: "Article analysis",    tokens: 350 },
  summarise:         { label: "Article summary",      tokens: 200 },
  impact_analysis:   { label: "Impact analysis",      tokens: 200 },
  feedback_keywords: { label: "Feedback processing",  tokens: 100 },
  profile_update:    { label: "Profile regeneration", tokens: 300 },
};

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = getTodayMYT();

  const [dailyBudget, usageRows, weekRows] = await Promise.all([
    getDailyBudget(user.id, supabase),

    supabase
      .from("gemini_usage")
      .select("call_type, provider, called_at")
      .eq("user_id", user.id)
      .gte("called_at", new Date(Date.now() - 24 * 3600_000).toISOString()),

    supabase
      .from("gemini_usage")
      .select("call_type, provider, called_at")
      .eq("user_id", user.id)
      .gte("called_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString()),
  ]);

  // Today's breakdown grouped by call_type + provider
  const todayRows = (usageRows.data ?? []).filter((r) => {
    const myt = new Date(new Date(r.called_at).getTime() + 8 * 3600_000);
    return myt.toISOString().slice(0, 10) === today;
  });

  const groupMap: Record<string, { call_type: string; provider: string; count: number }> = {};
  for (const row of todayRows) {
    const provider = (row.provider as string | null) ?? "groq";
    const key = `${row.call_type}::${provider}`;
    if (!groupMap[key]) groupMap[key] = { call_type: row.call_type, provider, count: 0 };
    groupMap[key].count++;
  }

  const todayBreakdown = Object.values(groupMap).map(({ call_type, provider, count }) => ({
    call_type:  CALL_TYPE_META[call_type]?.label ?? call_type,
    provider,
    count,
    tokens_est: count * (CALL_TYPE_META[call_type]?.tokens ?? 200),
  }));

  // 7-day history grouped by MYT date
  const dayMap: Record<string, { total_calls: number; groq_calls: number; gemini_calls: number }> = {};
  for (const row of weekRows.data ?? []) {
    const d = new Date(new Date(row.called_at).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { total_calls: 0, groq_calls: 0, gemini_calls: 0 };
    dayMap[d].total_calls++;
    const provider = (row.provider as string | null) ?? "groq";
    if (provider === "groq")   dayMap[d].groq_calls++;
    if (provider === "gemini") dayMap[d].gemini_calls++;
  }

  const weekHistory = Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, stats]) => ({ date, ...stats }));

  return NextResponse.json({
    dailyBudget,
    todayBreakdown,
    weekHistory,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    groqConfigured:   !!process.env.GROQ_API_KEY,
  });
}
