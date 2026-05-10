import type { RawArticle } from "@/lib/types";

const NEWSAPI_BASE = "https://newsapi.org/v2/everything";

interface NewsApiArticle {
  title: string
  url: string
  source: { name: string; id: string | null }
  publishedAt: string
  description: string | null
  urlToImage: string | null
}

interface NewsApiResponse {
  status: string
  articles: NewsApiArticle[]
  message?: string
}

function buildUrl(q: string, apiKey: string): string {
  const params = new URLSearchParams({
    q,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "20",
    apiKey,
  });
  return `${NEWSAPI_BASE}?${params}`;
}

async function fetchQuery(q: string, topic: string, apiKey: string): Promise<RawArticle[]> {
  const res = await fetch(buildUrl(q, apiKey), { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data: NewsApiResponse = await res.json();
  if (data.status !== "ok" || !data.articles) return [];

  return data.articles
    .filter((a) => a.title && a.url && a.title !== "[Removed]")
    .map((a) => ({
      externalId: `newsapi-${Buffer.from(a.url).toString("base64").slice(0, 24)}`,
      title: a.title,
      summary: a.description ?? "",
      sourceName: a.source.name ?? "NewsAPI",
      sourceUrl: `https://${new URL(a.url).hostname}`,
      articleUrl: a.url,
      topic,
      publishedAt: a.publishedAt,
    }));
}

export async function fetchNewsApiArticles(
  topics: string[],
  apiKey: string
): Promise<RawArticle[]> {
  if (!apiKey || topics.length === 0) return [];

  // Topic query — joins all topics with OR so we get broad coverage
  const topicQuery = topics.map((t) => `"${t}"`).join(" OR ");

  // Malaysia-focused variant to anchor results geographically
  const malaysiaQuery = "Malaysia AND (" + topics.slice(0, 5).map((t) => `"${t}"`).join(" OR ") + ")";

  const [topicResults, malaysiaResults] = await Promise.allSettled([
    fetchQuery(topicQuery, topics[0] ?? "Global News", apiKey),
    fetchQuery(malaysiaQuery, "Malaysian Politics", apiKey),
  ]);

  const combined: RawArticle[] = [
    ...(topicResults.status === "fulfilled" ? topicResults.value : []),
    ...(malaysiaResults.status === "fulfilled" ? malaysiaResults.value : []),
  ];

  // Deduplicate by URL
  const seen = new Set<string>();
  return combined.filter((a) => {
    if (seen.has(a.articleUrl)) return false;
    seen.add(a.articleUrl);
    return true;
  });
}
