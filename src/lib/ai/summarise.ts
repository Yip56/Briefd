import type { RawArticle, Profile } from "@/lib/types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT =
  "You are a news summariser for a Malaysian news digest app. " +
  "Write one clear, factual sentence (max 35 words) summarising the article's key point " +
  "and its direct impact on everyday Malaysians. Be specific — include numbers, prices, or " +
  "dates if present. Never start with 'The article says'.";

export async function summariseArticle(
  article: RawArticle,
  userProfile: Profile
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return article.summary.slice(0, 200);

  const userPrompt =
    `Article title: ${article.title}\n` +
    `Source excerpt: ${article.summary.slice(0, 400)}\n` +
    `User profile: ${userProfile.occupation ?? "unknown occupation"} in ` +
    `${userProfile.location ?? "Malaysia"}, ${userProfile.life_stage ?? "general public"}\n\n` +
    `Write the summary sentence now:`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) return article.summary.slice(0, 200);

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    return text.trim() || article.summary.slice(0, 200);
  } catch {
    return article.summary.slice(0, 200);
  }
}
