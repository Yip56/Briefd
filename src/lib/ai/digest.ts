import type { RawArticle, UserPreferences, DigestResult, ScoredArticle, VoteValue } from "@/lib/types";
import { scoreArticles } from "@/lib/scoring/ranker";
import { summariseArticle } from "./summarise";

const TOP_FOR_DIGEST = 12;
const CONCURRENCY = 3;

// Runs an array of async tasks with a max concurrency limit
async function batchedAsync<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map((fn) => fn());
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

export async function buildDigest(
  rawArticles: RawArticle[],
  preferences: UserPreferences,
  feedbackMap: Record<string, VoteValue>
): Promise<DigestResult> {
  // 1. Score synchronously and take the top candidates
  const scored = scoreArticles(rawArticles, preferences, feedbackMap);
  const totalScored = scored.length;
  const candidates = scored.slice(0, TOP_FOR_DIGEST);

  // 2. Enrich each candidate with an AI-generated summary, batched to avoid
  //    bursting the Anthropic rate limit (3 in-flight requests at a time)
  const tasks = candidates.map(
    (article): (() => Promise<ScoredArticle>) =>
      async () => {
        // Reconstruct the RawArticle shape that summariseArticle expects
        const raw: RawArticle = {
          externalId: article.external_id ?? article.id,
          title: article.title,
          summary: article.summary ?? "",
          sourceName: article.source_name ?? "",
          sourceUrl: article.source_url ?? "",
          articleUrl: article.article_url,
          topic: article.topic ?? "",
          publishedAt: article.published_at ?? new Date().toISOString(),
        };

        const aiSummary = await summariseArticle(raw, preferences.profile);
        return { ...article, aiSummary };
      }
  );

  const enriched = await batchedAsync(tasks, CONCURRENCY);

  return {
    articles: enriched,
    generatedAt: new Date().toISOString(),
    totalScored,
  };
}
