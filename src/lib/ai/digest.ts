import type { RawArticle, UserPreferences, DigestResult, ScoredArticle, VoteValue, UserAlgorithmSettings } from "@/lib/types";

export type EnrichmentCache = Map<string, { combined?: string | null }>;
import { scoreArticles } from "@/lib/scoring/ranker";

const TOTAL_ARTICLES = 15;
const CONCURRENCY = 3;

const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

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
  feedbackMap: Record<string, VoteValue>,
  algorithmSettings?: UserAlgorithmSettings | null,
  clickedArticleUrls?: Set<string>,
  enrichmentCache?: EnrichmentCache
): Promise<DigestResult> {
  const scored = scoreArticles(rawArticles, preferences, feedbackMap, algorithmSettings, clickedArticleUrls);
  const totalScored = scored.length;

  if (scored.length === 0 || preferences.topics.length === 0) {
    return { articles: [], generatedAt: new Date().toISOString(), totalScored: 0 };
  }

  const sortedTopics = [...preferences.topics].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  const topicNames = sortedTopics.map((t) => t.topic.toLowerCase());

  const buckets = new Map<string, (typeof scored)[number][]>();
  for (const name of topicNames) buckets.set(name, []);
  const overflow: (typeof scored)[number][] = [];

  for (const article of scored) {
    const artTopic = (article.topic ?? "").toLowerCase();
    const match = topicNames.find(
      (t) => t === artTopic || artTopic.includes(t) || t.includes(artTopic)
    );
    if (match !== undefined) {
      buckets.get(match)!.push(article);
    } else {
      overflow.push(article);
    }
  }

  for (const [, articles] of buckets) {
    articles.sort((a, b) => {
      const impactDiff = (IMPACT_ORDER[a.impactLevel] ?? 2) - (IMPACT_ORDER[b.impactLevel] ?? 2);
      if (impactDiff !== 0) return impactDiff;
      return (
        new Date(b.published_at ?? 0).getTime() -
        new Date(a.published_at ?? 0).getTime()
      );
    });
  }

  const numTopics = topicNames.length;
  const slotsPerTopic = Math.floor(TOTAL_ARTICLES / numTopics);
  const remainder = TOTAL_ARTICLES % numTopics;

  const orderedBuckets = sortedTopics.map((t, i) => {
    const name = t.topic.toLowerCase();
    const slots = slotsPerTopic + (i === 0 ? remainder : 0);
    return { articles: (buckets.get(name) ?? []).slice(0, slots) };
  });

  const interleaved: (typeof scored)[number][] = [];
  const indices = orderedBuckets.map(() => 0);
  while (interleaved.length < TOTAL_ARTICLES) {
    let added = false;
    for (let i = 0; i < orderedBuckets.length; i++) {
      const { articles } = orderedBuckets[i];
      if (indices[i] < articles.length) {
        interleaved.push(articles[indices[i]++]);
        added = true;
        if (interleaved.length >= TOTAL_ARTICLES) break;
      }
    }
    if (!added) break;
  }

  if (interleaved.length < TOTAL_ARTICLES && overflow.length > 0) {
    interleaved.push(...overflow.slice(0, TOTAL_ARTICLES - interleaved.length));
  }

  const tasks = interleaved.map(
    (article): (() => Promise<ScoredArticle>) =>
      async () => {
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
        const cached  = enrichmentCache?.get(raw.externalId);
        const combined = cached?.combined ?? raw.summary.slice(0, 200);
        return { ...article, combined };
      }
  );

  const enriched = await batchedAsync(tasks, CONCURRENCY);

  return {
    articles: enriched,
    generatedAt: new Date().toISOString(),
    totalScored,
  };
}
