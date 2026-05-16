import type { RawArticle, Profile, ImpactLevel } from "@/lib/types";
import { groqGetAiImpactScore } from "./groq";

export async function getAiImpactScore(
  article: RawArticle,
  profile: Profile
): Promise<{ impactLevel: ImpactLevel; reason: string }> {
  return groqGetAiImpactScore(article, profile);
}
