import Groq from "groq-sdk";
import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const GROQ_MODEL = "llama-3.1-8b-instant";

// Lazy singleton — only instantiated on first server-side call, never at module load
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

export async function callGroq(
  prompt: string,
  systemPrompt: string,
  maxTokens = 200
): Promise<string> {
  const completion = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function analyseArticleGroq(
  article: RawArticle,
  userProfile: Profile,
  aiProfile: string
): Promise<{ summary: string; impactAnalysis: string; impactLevel: ImpactLevel }> {
  const fallback = {
    summary: article.summary.slice(0, 120),
    impactAnalysis: "Analysis unavailable.",
    impactLevel: "medium" as ImpactLevel,
  };

  if (!process.env.GROQ_API_KEY) return fallback;

  const occupation = userProfile.occupation ?? "professional";
  const location   = userProfile.location   ?? "Malaysia";
  const life_stage = userProfile.life_stage ?? "working adult";
  const vehicle    = userProfile.vehicle    ?? "commuter";

  const systemPrompt =
    "You are a personal news analyst for a Malaysian news digest app. Always address the reader as 'you' or 'your'. " +
    "Only mention their profile details if DIRECTLY relevant to the article topic. " +
    "Be specific — include actual numbers, prices, percentages, dates from the article. " +
    "Never be generic. Never start with 'This article'.";

  const userPrompt =
    `Analyse this news article for a reader who is: ${occupation} in ${location}, ${life_stage}, owns ${vehicle}.\n` +
    (aiProfile ? `Reader preferences: ${aiProfile}\n\n` : "\n") +
    `Article: ${article.title}\n` +
    `Content: ${article.summary.slice(0, 400)}\n\n` +
    `Reply with JSON only, no markdown:\n` +
    `{"summary":"One clear sentence max 25 words summarising the key fact","impactAnalysis":"1-2 sentences starting with You or Your explaining direct personal impact with specific figures","impactLevel":"high or medium or low"}`;

  try {
    const text = await callGroq(userPrompt, systemPrompt, 300);
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    const level = (["high", "medium", "low"].includes(parsed.impactLevel)
      ? parsed.impactLevel : "medium") as ImpactLevel;
    return {
      summary:        parsed.summary        ?? fallback.summary,
      impactAnalysis: parsed.impactAnalysis ?? fallback.impactAnalysis,
      impactLevel:    level,
    };
  } catch {
    return fallback;
  }
}

export async function groqSummariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
  const systemPrompt =
    "You are a news summariser for a Malaysian news digest app. Write one clear, factual sentence (max 35 words) summarising the article's key point and its direct impact on everyday Malaysians. Be specific — include numbers, prices, or dates if present. Never start with 'The article says'.";

  const prompt =
    `Article title: ${article.title}\n` +
    `Source excerpt: ${article.summary.slice(0, 400)}\n` +
    `User profile: ${userProfile.occupation ?? "unknown occupation"} in ` +
    `${userProfile.location ?? "Malaysia"}, ${userProfile.life_stage ?? "general public"}\n\n` +
    `Write the summary sentence now:`;

  try {
    const text = await callGroq(prompt, systemPrompt, 150);
    return text || article.summary.slice(0, 200);
  } catch {
    return article.summary.slice(0, 200);
  }
}

export async function groqGetImpactAnalysis(
  article: RawArticle,
  userProfile: Profile,
  aiProfile?: string
): Promise<string> {
  const occupation = userProfile.occupation ?? "professional";
  const location   = userProfile.location   ?? "Malaysia";
  const lifeStage  = userProfile.life_stage ?? "working adult";
  const vehicle    = userProfile.vehicle    ?? "commuter";

  const systemPrompt =
    "You are a personal news impact analyst. Explain in 1-2 sentences how a news article directly affects the reader. " +
    "Always address the reader as 'you' or 'your'. Be specific — include actual numbers, prices, dates, or percentages from the article. " +
    "Never start with 'This article'. Never be generic.";

  const profileContext = aiProfile ? `AI profile context: ${aiProfile}\n\n` : "";
  const prompt =
    `${profileContext}` +
    `Article title: ${article.title}\n` +
    `Article summary: ${article.summary.slice(0, 300)}\n` +
    `Reader profile (use ONLY if directly relevant): ${occupation} in ${location}, ${lifeStage}, ${vehicle}\n\n` +
    `In 1-2 sentences, explain how this affects you (the reader):`;

  try {
    const text = await callGroq(prompt, systemPrompt, 150);
    return text || "";
  } catch {
    return "";
  }
}

export async function groqGetAiImpactScore(
  article: RawArticle,
  profile: Profile
): Promise<{ impactLevel: ImpactLevel; reason: string }> {
  const FALLBACK = { impactLevel: "medium" as ImpactLevel, reason: "general news" };

  const systemPrompt = "You are a news impact classifier. Reply with JSON only.";
  const prompt =
    `Article: "${article.title}"\n` +
    `Topic: ${article.topic}\n` +
    `User: ${profile.occupation ?? "general public"} in ${profile.location ?? "Malaysia"}, ` +
    `${profile.life_stage ?? ""}, vehicle: ${profile.vehicle ?? "none"}\n\n` +
    `Classify the personal impact as 'high', 'medium', or 'low'.\n` +
    `{"impactLevel": "high|medium|low", "reason": "one short phrase"}`;

  try {
    const raw    = await callGroq(prompt, systemPrompt, 80);
    const match  = raw.match(/\{[\s\S]*?\}/);
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
  const systemPrompt = "You extract keywords from user feedback. Reply with a JSON array of strings only.";
  const prompt =
    `A user disliked a news article. Extract 2-4 specific keywords or phrases representing what they want to avoid. ` +
    `Article title: ${title}. Topic: ${topic}. Reason selected: ${reason}. User comment: ${freeText}`;

  try {
    const raw   = await callGroq(prompt, systemPrompt, 100);
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

  const systemPrompt = "You generate user preference profiles for a news app. Return plain text only, 3 sentences.";
  const prompt =
    `Based on this user's feedback history, write a 3-sentence profile describing their news ` +
    `preferences, what topics they care about, what they want to avoid, and their likely occupation context. ` +
    `Be specific. Feedback data: ${JSON.stringify(summary)}`;

  try {
    const profile = await callGroq(prompt, systemPrompt, 300);
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
