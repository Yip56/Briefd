import { DEMO_ARTICLES } from "./articles";
import { scoreArticles } from "@/lib/scoring/ranker";
import type { DigestResult, ScoredArticle, UserPreferences, UserAlgorithmSettings } from "@/lib/types";

const demoMap = new Map(DEMO_ARTICLES.map((a) => [a.externalId, a]));

export function buildDemoDigest(
  selectedTopics: string[],
  preferences: UserPreferences,
  algorithmSettings?: UserAlgorithmSettings | null
): DigestResult {
  const topicFiltered =
    selectedTopics.length > 0
      ? DEMO_ARTICLES.filter((a) => selectedTopics.includes(a.topic))
      : DEMO_ARTICLES;

  const scored = scoreArticles(topicFiltered, preferences, {}, algorithmSettings ?? undefined);

  const withText = (articles: ScoredArticle[]): ScoredArticle[] =>
    articles.map((a) => {
      const demo = demoMap.get(a.external_id ?? a.id);
      return {
        ...a,
        aiSummary:     demo?.demoSummary || (a.summary ?? "").slice(0, 150),
        impactAnalysis: demo?.demoImpact || "",
      };
    });

  return {
    articles:          withText(scored.slice(0, 5)),
    remainingArticles: withText(scored.slice(5)),
    generatedAt:       new Date().toISOString(),
    totalScored:       topicFiltered.length,
    isDemo:            true,
  };
}
