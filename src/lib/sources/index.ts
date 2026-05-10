import type { RawArticle } from "@/lib/types";
import { RSS_FEEDS } from "@/lib/constants";
import { fetchNewsApiArticles } from "./newsapi";
import { fetchRssFeeds } from "./rss";
import { fetchRedditPosts } from "./reddit";

const MAX_ARTICLES = 100;

export async function fetchAllSources(topics: string[]): Promise<RawArticle[]> {
  const newsApiKey = process.env.NEWSAPI_KEY ?? "";

  const [newsApiResult, rssResult, redditResult] = await Promise.allSettled([
    fetchNewsApiArticles(topics, newsApiKey),
    fetchRssFeeds([...RSS_FEEDS]),
    fetchRedditPosts(),
  ]);

  const combined: RawArticle[] = [
    ...(newsApiResult.status === "fulfilled" ? newsApiResult.value : []),
    ...(rssResult.status === "fulfilled" ? rssResult.value : []),
    ...(redditResult.status === "fulfilled" ? redditResult.value : []),
  ];

  // Global deduplication by URL across all sources
  const seen = new Set<string>();
  const deduped = combined.filter((a) => {
    if (seen.has(a.articleUrl)) return false;
    seen.add(a.articleUrl);
    return true;
  });

  // Sort newest-first before capping — ensures the 100 we keep are the freshest
  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return deduped.slice(0, MAX_ARTICLES);
}
