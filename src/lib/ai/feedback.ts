import type { SupabaseClient } from "@supabase/supabase-js";
import { callGroq, groqExtractAvoidanceKeywords, groqUpdateProfile } from "./groq";
import { canMakeCall, recordGeminiCall } from "./budget";

export async function extractAvoidanceKeywords(
  title: string,
  reason: string,
  freeText: string,
  topic: string,
  userId?: string,
  supabase?: SupabaseClient
): Promise<string[]> {
  const sessionId = `fb_${Date.now()}`;

  if (userId && supabase) {
    const allowed = await canMakeCall(userId, sessionId, supabase).catch(() => true);
    if (!allowed) {
      console.log("[Budget] Exceeded — skipping AI for keyword extraction");
      return [topic.toLowerCase()];
    }
  }

  try {
    const keywords = await groqExtractAvoidanceKeywords(title, reason, freeText, topic);
    if (keywords.length > 0 && userId && supabase) {
      await recordGeminiCall(userId, "feedback_keywords", sessionId, supabase).catch(() => {});
    }
    console.log("[AI] Avoidance keywords via Groq");
    return keywords;
  } catch {
    return [topic.toLowerCase()];
  }
}

export async function updateGeminiProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: feedbackRows } = await supabase
    .from("article_feedback")
    .select("vote, reason, free_text, articles(title, topic)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!feedbackRows || feedbackRows.length === 0) return;

  const sessionId = `profile_${Date.now()}`;
  const allowed = await canMakeCall(userId, sessionId, supabase).catch(() => true);
  if (!allowed) {
    console.log("[Budget] Exceeded — skipping AI for profile update");
    return;
  }

  const summary = feedbackRows.map((r) => {
    const art = r.articles as unknown as { title: string; topic: string } | null;
    return { vote: r.vote, reason: r.reason, comment: r.free_text, title: art?.title, topic: art?.topic };
  });

  const systemPrompt =
    "You generate user preference profiles for a news app. Return plain text only, 3 sentences.";
  const prompt =
    `Based on this user's feedback history, write a 3-sentence profile describing their news ` +
    `preferences, what topics they care about, what they want to avoid, and their likely ` +
    `occupation context. Be specific. Feedback data: ${JSON.stringify(summary)}`;

  try {
    const aiProfile = await callGroq(prompt, systemPrompt, 300);
    if (!aiProfile) return;

    console.log("[AI] User profile via Groq");
    await recordGeminiCall(userId, "profile_update", sessionId, supabase).catch(() => {});
    await supabase
      .from("user_algorithm_settings")
      .upsert(
        { user_id: userId, gemini_profile: aiProfile, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  } catch {
    await groqUpdateProfile(userId, supabase);
  }
}
