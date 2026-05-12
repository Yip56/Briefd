import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL    = "llama-3.1-8b-instant";

async function callGroq(prompt: string, maxTokens = 150): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      GROQ_MODEL,
      messages:   [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Groq] HTTP ${res.status}:`, body.slice(0, 200));
    return "";
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

export async function groqSummariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
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

  const text = await callGroq(prompt);
  return text || article.summary.slice(0, 200);
}

export async function groqGetImpactAnalysis(
  article: RawArticle,
  userProfile: Profile,
  geminiProfile?: string
): Promise<string> {
  const occupation = userProfile.occupation ?? "professional";
  const location   = userProfile.location   ?? "Malaysia";
  const lifeStage  = userProfile.life_stage ?? "working adult";
  const vehicle    = userProfile.vehicle    ?? "commuter";

  const systemPrompt =
    `You are a personal news impact analyst. Your job is to explain in 1-2 sentences how a news ` +
    `article directly affects the reader. Always address the reader as 'you' or 'your' — never ` +
    `describe them in third person (never say 'a student' or 'someone in KL'). Only mention the ` +
    `reader's occupation, location, or lifestyle if it is DIRECTLY and specifically relevant to the ` +
    `article's topic — for example, mention 'motorcycle' only if the article is about fuel prices or ` +
    `road tax, mention 'student' only if the article is about education loans or university fees. ` +
    `If the profile details are not relevant, ignore them entirely and just explain the general impact ` +
    `on the reader as 'you'. Be specific — include actual numbers, prices, dates, or percentages from ` +
    `the article where available. Never start with 'This article'. Never be generic.`;

  const profileContext = geminiProfile ? `Gemini profile context: ${geminiProfile}\n\n` : "";

  const prompt =
    `${systemPrompt}\n\n` +
    `${profileContext}` +
    `Article title: ${article.title}\n` +
    `Article summary: ${article.summary.slice(0, 300)}\n` +
    `Reader profile (use ONLY if directly relevant): ${occupation} in ${location}, ${lifeStage}, ${vehicle}\n\n` +
    `In 1-2 sentences, explain how this affects you (the reader):`;

  const text = await callGroq(prompt);
  return text || "";
}

export async function groqGetAiImpactScore(
  article: RawArticle,
  profile: Profile
): Promise<{ impactLevel: ImpactLevel; reason: string }> {
  const FALLBACK = { impactLevel: "medium" as ImpactLevel, reason: "general news" };

  const prompt =
    `Article: "${article.title}"\n` +
    `Topic: ${article.topic}\n` +
    `User: ${profile.occupation ?? "general public"} in ${profile.location ?? "Malaysia"}, ` +
    `${profile.life_stage ?? ""}, vehicle: ${profile.vehicle ?? "none"}\n\n` +
    `Classify the personal impact of this article on this user as 'high', 'medium', or 'low'.\n` +
    `Reply with JSON only: {"impactLevel": "high|medium|low", "reason": "one short phrase"}`;

  try {
    const raw   = await callGroq(prompt);
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return FALLBACK;

    const parsed = JSON.parse(match[0]) as { impactLevel?: string; reason?: string };
    const level  = parsed.impactLevel;
    if (level !== "high" && level !== "medium" && level !== "low") return FALLBACK;

    return { impactLevel: level, reason: parsed.reason ?? "general news" };
  } catch {
    return FALLBACK;
  }
}

export async function groqExtractAvoidanceKeywords(
  title: string,
  reason: string,
  freeText: string,
  topic: string
): Promise<string[]> {
  const prompt =
    `A user disliked a news article. Extract 2-4 specific keywords or phrases that represent ` +
    `what they want to avoid in future articles. Return a JSON array of strings only, no explanation. ` +
    `Article title: ${title}. Topic: ${topic}. Reason selected: ${reason}. User comment: ${freeText}`;

  try {
    const raw   = await callGroq(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [topic.toLowerCase()];

    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) return parsed.filter((k) => typeof k === "string");
    return [topic.toLowerCase()];
  } catch {
    return [topic.toLowerCase()];
  }
}

export async function groqUpdateProfile(
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

  const prompt =
    `Based on this user's feedback history, write a 3-sentence profile describing their news ` +
    `preferences, what topics they care about, what they want to avoid, and their likely ` +
    `occupation context. Be specific. Return plain text only. ` +
    `Feedback data: ${JSON.stringify(summary)}`;

  try {
    const profile = await callGroq(prompt, 300);
    if (!profile) return;

    await supabase
      .from("user_algorithm_settings")
      .upsert(
        { user_id: userId, gemini_profile: profile, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  } catch {
    // fire-and-forget
  }
}
