import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyBudget } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";

function getTodayMYT(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = getTodayMYT();

  const [dailyBudget, usageRows, weekRows] = await Promise.all([
    getDailyBudget(user.id, supabase),

    supabase
      .from("gemini_usage")
      .select("call_type, called_at")
      .eq("user_id", user.id)
      .gte("called_at", new Date(Date.now() - 24 * 3600_000).toISOString()),

    supabase
      .from("gemini_usage")
      .select("call_type, called_at")
      .eq("user_id", user.id)
      .gte("called_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString()),
  ]);

  // Today's breakdown
  const todayRows = (usageRows.data ?? []).filter((r) => {
    const myt = new Date(new Date(r.called_at).getTime() + 8 * 3600_000);
    return myt.toISOString().slice(0, 10) === today;
  });

  const callTypeCounts: Record<string, number> = {};
  for (const row of todayRows) {
    callTypeCounts[row.call_type] = (callTypeCounts[row.call_type] ?? 0) + 1;
  }

  const CALL_TYPE_LABELS: Record<string, { label: string; tokens: number }> = {
    article_analysis: { label: "Article analysis",    tokens: 350 },
    feedback_keywords: { label: "Feedback processing", tokens: 100 },
    profile_update:    { label: "Profile regeneration", tokens: 300 },
  };

  const todayBreakdown = Object.entries(callTypeCounts).map(([type, count]) => ({
    call_type:   CALL_TYPE_LABELS[type]?.label ?? type,
    count,
    tokens_est:  count * (CALL_TYPE_LABELS[type]?.tokens ?? 200),
  }));

  const totalTokens = todayBreakdown.reduce((s, r) => s + r.tokens_est, 0);
  const totalCalls  = todayBreakdown.reduce((s, r) => s + r.count, 0);
  todayBreakdown.push({ call_type: "Total", count: totalCalls, tokens_est: totalTokens });

  // 7-day history: group by MYT date
  const dayMap: Record<string, { calls_used: number; articles_analysed: number; feedback_calls: number }> = {};
  for (const row of weekRows.data ?? []) {
    const d = new Date(new Date(row.called_at).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { calls_used: 0, articles_analysed: 0, feedback_calls: 0 };
    dayMap[d].calls_used++;
    if (row.call_type === "article_analysis") dayMap[d].articles_analysed++;
    if (row.call_type.startsWith("feedback") || row.call_type.startsWith("profile")) dayMap[d].feedback_calls++;
  }

  const weekHistory = Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, stats]) => ({ date, ...stats }));

  return NextResponse.json({ dailyBudget, todayBreakdown, weekHistory });
}
