import type { SupabaseClient } from "@supabase/supabase-js";
import { groqExtractAvoidanceKeywords, groqUpdateProfile } from "./groq";
import { canMakeCall, recordGeminiCall } from "./budget";

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
    console.warn("[Gemini/feedback] Rate limited, retrying in 10s…");
    await sleep(10_000);
    res = await doRequest();
  }

  if (!res.ok) return "";
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

export async function extractAvoidanceKeywords(
  title: string,
  reason: string,
  freeText: string,
  topic: string,
  userId?: string,
  supabase?: SupabaseClient
): Promise<string[]> {
  // Each feedback call uses a unique session so only daily budget applies
  const sessionId = `fb_${Date.now()}`;

  if (userId && supabase) {
    const allowed = await canMakeCall(userId, sessionId, supabase).catch(() => true);
    if (!allowed) {
      console.log("[Budget] Exceeded — skipping Gemini for keyword extraction");
      return [topic.toLowerCase()];
    }
  }

  const prompt =
    `A user disliked a news article. Extract 2-4 specific keywords or phrases that represent ` +
    `what they want to avoid in future articles. Return a JSON array of strings only, no explanation. ` +
    `Article title: ${title}. Topic: ${topic}. Reason selected: ${reason}. User comment: ${freeText}`;

  try {
    const raw = await callGemini(prompt);
    if (raw) {
      console.log("[AI] Avoidance keywords via Gemini");
      if (userId && supabase) {
        await recordGeminiCall(userId, "feedback_keywords", sessionId, supabase).catch(() => {});
      }
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.filter((k) => typeof k === "string");
      }
    }
  } catch { /* fall through */ }

  console.log("[AI] Gemini unavailable for keywords, falling back to Groq");
  return groqExtractAvoidanceKeywords(title, reason, freeText, topic);
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

  const summary = feedbackRows.map((r) => {
    const art = r.articles as unknown as { title: string; topic: string } | null;
    return { vote: r.vote, reason: r.reason, comment: r.free_text, title: art?.title, topic: art?.topic };
  });

  const sessionId = `profile_${Date.now()}`;
  const allowed = await canMakeCall(userId, sessionId, supabase).catch(() => true);
  if (!allowed) {
    console.log("[Budget] Exceeded — skipping Gemini for profile update");
    return;
  }

  const prompt =
    `Based on this user's feedback history, write a 3-sentence profile describing their news ` +
    `preferences, what topics they care about, what they want to avoid, and their likely ` +
    `occupation context. Be specific. Return plain text only. ` +
    `Feedback data: ${JSON.stringify(summary)}`;

  try {
    const profile = await callGemini(prompt);
    if (profile) {
      console.log("[AI] User profile via Gemini");
      await recordGeminiCall(userId, "profile_update", sessionId, supabase).catch(() => {});
      await supabase
        .from("user_algorithm_settings")
        .upsert(
          { user_id: userId, gemini_profile: profile, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      return;
    }
  } catch { /* fall through */ }

  console.log("[AI] Gemini unavailable for profile, falling back to Groq");
  await groqUpdateProfile(userId, supabase);
}
