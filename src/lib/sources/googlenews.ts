import type { RawArticle } from "@/lib/types";
import Parser from "rss-parser";

const TOPIC_QUERIES: Record<string, string> = {
  "Economy":              "Malaysia economy OR ringgit OR budget",
  "Fuel & Transport":     "Malaysia fuel price OR RON95 OR transport",
  "Property":             "Malaysia property price OR housing",
  "Jobs & Career":        "Malaysia jobs OR employment OR EPF",
  "Malaysian Politics":   "Malaysia politics OR government OR parliament",
  "Tech & AI":            "AI technology OR Malaysia tech",
  "Health":               "Malaysia health OR medical",
  "Finance & Investing":  "Malaysia investment OR stock market OR EPF",
  "Startups":             "Malaysia startup OR venture capital",
  "Global News":          "Malaysia global OR international",
};

export async function fetchGoogleNews(topics: string[]): Promise<RawArticle[]> {
  const parser = new Parser({ timeout: 10_000 });
  const results: RawArticle[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    topics.map(async (topic) => {
      const query = TOPIC_QUERIES[topic] ?? `${topic} Malaysia`;
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-MY&gl=MY&ceid=MY:en`;
      try {
        const feed = await parser.parseURL(url);
        for (const item of (feed.items ?? []).slice(0, 10)) {
          const articleUrl = item.link ?? "";
          if (!articleUrl || seen.has(articleUrl)) continue;
          seen.add(articleUrl);
          results.push({
            externalId:  `gn_${Buffer.from(articleUrl).toString("base64").slice(0, 36)}`,
            title:       item.title ?? "",
            summary:     item.contentSnippet ?? item.title ?? "",
            sourceName:  "Google News",
            sourceUrl:   "https://news.google.com",
            articleUrl,
            topic,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          });
        }
      } catch { /* skip failed topic */ }
    })
  );

  return results;
}
