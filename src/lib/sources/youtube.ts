import type { RawArticle } from "@/lib/types";

export async function fetchYouTubeVideos(topics: string[], apiKey: string): Promise<RawArticle[]> {
  if (!apiKey) return [];

  const results: RawArticle[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    topics.map(async (topic) => {
      const q = encodeURIComponent(`${topic} Malaysia 2025 news`);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&relevanceLanguage=en&regionCode=MY&key=${apiKey}&q=${q}`;
      try {
        const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
        if (!res.ok) return;
        const data = await res.json();
        for (const item of data.items ?? []) {
          const videoId = item.id?.videoId;
          if (!videoId || seen.has(videoId)) continue;
          const title: string = item.snippet?.title ?? "";
          if (/shorts/i.test(title) || /#shorts/i.test(title)) continue;
          seen.add(videoId);
          results.push({
            externalId:  `yt_${videoId}`,
            title,
            summary:     (item.snippet?.description ?? "").slice(0, 200),
            sourceName:  item.snippet?.channelTitle ?? "YouTube",
            sourceUrl:   `https://www.youtube.com/channel/${item.snippet?.channelId ?? ""}`,
            articleUrl:  `https://www.youtube.com/watch?v=${videoId}`,
            topic,
            publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
            isVideo:     true,
          });
        }
      } catch { /* skip */ }
    })
  );

  return results.slice(0, 15);
}
