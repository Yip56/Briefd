import { DEMO_ARTICLES } from "./articles";
import { scoreArticles } from "@/lib/scoring/ranker";
import type { DigestResult, ScoredArticle, UserPreferences, UserAlgorithmSettings } from "@/lib/types";

function buildDemoSentence(text: string): string {
  if (text.length <= 180) return text;
  const truncated = text.slice(0, 180);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

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
    articles.map((a) => ({
      ...a,
      combined: a.combined || buildDemoSentence(a.summary || a.title),
    }));

  return {
    articles:          withText(scored.slice(0, 5)),
    remainingArticles: withText(scored.slice(5)),
    generatedAt:       new Date().toISOString(),
    totalScored:       topicFiltered.length,
    isDemo:            true,
  };
}
