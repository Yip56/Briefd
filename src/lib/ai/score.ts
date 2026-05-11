import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const FALLBACK = { impactLevel: "medium" as ImpactLevel, reason: "general news" };

export async function getAiImpactScore(
  article: RawArticle,
  profile: Profile
): Promise<{ impactLevel: ImpactLevel; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;

  const prompt =
    `Article: "${article.title}"\n` +
    `Topic: ${article.topic}\n` +
    `User: ${profile.occupation ?? "general public"} in ${profile.location ?? "Malaysia"}, ` +
    `${profile.life_stage ?? ""}, vehicle: ${profile.vehicle ?? "none"}\n\n` +
    `Classify the personal impact of this article on this user as 'high', 'medium', or 'low'.\n` +
    `Reply with JSON only: {"impactLevel": "high|medium|low", "reason": "one short phrase"}`;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) return FALLBACK;

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON even if the model adds prose around it
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return FALLBACK;

    const parsed = JSON.parse(match[0]) as { impactLevel?: string; reason?: string };
    const level = parsed.impactLevel;

    if (level !== "high" && level !== "medium" && level !== "low") return FALLBACK;

    return {
      impactLevel: level,
      reason: parsed.reason ?? "general news",
    };
  } catch {
    return FALLBACK;
  }
}
