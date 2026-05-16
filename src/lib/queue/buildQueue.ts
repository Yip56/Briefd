import { after } from "next/server";
import type { UserPreferences, UserAlgorithmSettings, VoteValue, ScoredArticle } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSources } from "@/lib/sources";
import { scoreArticles } from "@/lib/scoring/ranker";
import { analyseArticle } from "@/lib/ai/summarise";
import type { EnrichmentCache } from "@/lib/ai/digest";
import { DEMO_ARTICLES } from "@/lib/demo/articles";

const DIGEST_SIZE = 5;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function runBatched(
  articles: ScoredArticle[],
  batchSize: number,
  pauseMs: number,
  fn: (article: ScoredArticle) => Promise<void>
): Promise<void> {
  for (let i = 0; i < articles.length; i += batchSize) {
    await Promise.all(articles.slice(i, i + batchSize).map(fn));
    if (i + batchSize < articles.length) await sleep(pauseMs);
  }
}

// ── Topic composition slot allocation ─────────────────────────────────────────

function allocateTopicSlots(
  topics: string[],
  composition: Record<string, number>,
  total: number
): Record<string, number> {
  if (!topics.length) return {};

  const sum = Object.values(composition).reduce((a, b) => a + b, 0);
  const hasComposition =
    sum >= 95 && sum <= 105 && Object.keys(composition).some((k) => topics.includes(k));

  if (!hasComposition) {
    // Equal allocation fallback
    const per = Math.floor(total / topics.length);
    const rem = total % topics.length;
    const result: Record<string, number> = {};
    topics.forEach((t, i) => { result[t] = per + (i === 0 ? rem : 0); });
    return result;
  }

  const slots: Record<string, number> = {};
  let allocated = 0;
  for (const topic of topics) {
    const pct   = composition[topic] ?? 0;
    const count = Math.round((pct / 100) * total);
    slots[topic] = count;
    allocated += count;
  }

  const diff = total - allocated;
  if (diff !== 0) {
    const topTopic = topics.reduce((a, b) =>
      (composition[a] ?? 0) >= (composition[b] ?? 0) ? a : b
    );
    slots[topTopic] = (slots[topTopic] ?? 0) + diff;
  }

  return slots;
}

function buildCompositionQueue(
  articles: ScoredArticle[],
  topicNames: string[],
  composition: Record<string, number>,
  total: number
): ScoredArticle[] {
  const lower = topicNames.map((t) => t.toLowerCase());
  const slots = allocateTopicSlots(topicNames, composition, total);

  const buckets = new Map<string, ScoredArticle[]>();
  for (const name of lower) buckets.set(name, []);
  const overflow: ScoredArticle[] = [];

  for (const article of articles) {
    const artTopic = (article.topic ?? "").toLowerCase();
    const match = lower.find(
      (t) => t === artTopic || artTopic.includes(t) || t.includes(artTopic)
    );
    if (match !== undefined) {
      buckets.get(match)!.push(article);
    } else {
      overflow.push(article);
    }
  }

  // Pick top articles per topic (already sorted by score from scoreArticles)
  const picked: ScoredArticle[] = [];
  for (const name of lower) {
    const originalTopic = topicNames[lower.indexOf(name)];
    const slotCount     = slots[originalTopic] ?? 0;
    picked.push(...(buckets.get(name) ?? []).slice(0, slotCount));
  }

  // Fill remaining slots from overflow if under total
  if (picked.length < total) {
    picked.push(...overflow.slice(0, total - picked.length));
  }

  return picked.slice(0, total);
}

export async function buildArticleQueue(
  userId: string,
  preferences: UserPreferences,
  algorithmSettings: UserAlgorithmSettings | null,
  feedbackMap: Record<string, VoteValue>,
  clickedUrls: Set<string>,
  supabase: SupabaseClient,
  isDemoMode = false
): Promise<void> {
  const topicNames    = preferences.topics.map((t) => t.topic);
  const composition   = algorithmSettings?.topic_composition ?? {};
  const geminiProfile = algorithmSettings?.gemini_profile ?? "";
  const sessionId     = crypto.randomUUID();

  let rawArticles;
  if (isDemoMode) {
    rawArticles = DEMO_ARTICLES;
    console.log("[Briefd] Data mode: demo");
  } else {
    rawArticles = await fetchAllSources(topicNames);
    console.log("[Briefd] Data mode: live");
  }
  console.log(`[Queue] sources → ${rawArticles.length} raw articles`);

  // Deduplicate by external_id — PostgreSQL refuses to update the same row twice in one upsert batch
  const seenExtIds = new Set<string>();
  const articleRows = rawArticles
    .map((a) => ({
      external_id:  a.externalId,
      title:        a.title,
      summary:      a.summary,
      source_name:  a.sourceName,
      source_url:   a.sourceUrl,
      article_url:  a.articleUrl,
      topic:        a.topic,
      published_at: a.publishedAt,
      is_video:     a.isVideo ?? false,
    }))
    .filter((row) => {
      if (!row.external_id || seenExtIds.has(row.external_id)) return false;
      seenExtIds.add(row.external_id);
      return true;
    });

  const { data: upsertedArticles, error: upsertError } = await supabase
    .from("articles")
    .upsert(articleRows, { onConflict: "external_id", ignoreDuplicates: false })
    .select("id, external_id");

  if (upsertError) {
    console.error("[Queue] Article upsert failed:", upsertError.message);
    return;
  }
  console.log(`[Queue] upsert → ${upsertedArticles?.length ?? 0} rows returned`);

  const idMap = new Map<string, string>();
  for (const row of upsertedArticles ?? []) {
    if (row.external_id) idMap.set(row.external_id, row.id);
  }
  console.log(`[Queue] idMap size: ${idMap.size}`);

  const externalIds = (upsertedArticles ?? []).map((a) => a.external_id).filter(Boolean) as string[];
  const { data: cachedRows } = externalIds.length > 0
    ? await supabase
        .from("articles")
        .select("external_id, ai_summary, impact_analysis")
        .in("external_id", externalIds)
        .not("ai_summary", "is", null)
    : { data: [] };

  const enrichmentCache: EnrichmentCache = new Map(
    (cachedRows ?? []).map((a) => [a.external_id, { aiSummary: a.ai_summary, impactAnalysis: a.impact_analysis }])
  );

  const scored = scoreArticles(rawArticles, preferences, feedbackMap, algorithmSettings, clickedUrls);
  console.log(`[Queue] scored: ${scored.length}`);

  // Only block articles already sitting in the unserved queue — served articles can be re-added
  const { data: existingQueue, error: existingQueueError } = await supabase
    .from("article_queue")
    .select("article_id")
    .eq("user_id", userId)
    .eq("served", false);

  if (existingQueueError) console.error("[Queue] existingQueue error:", existingQueueError.message);

  const existingArticleIds = new Set((existingQueue ?? []).map((r) => r.article_id));
  console.log(`[Queue] existingArticleIds (unserved): ${existingArticleIds.size}`);

  // When the queue is fully exhausted, purge served rows so the same articles can be re-queued
  // and the table doesn't grow unboundedly.
  if (existingArticleIds.size === 0) {
    const { error: deleteError } = await supabase
      .from("article_queue")
      .delete()
      .eq("user_id", userId)
      .eq("served", true);
    if (deleteError) console.error("[Queue] Delete served rows error:", deleteError.message);
    else console.log("[Queue] Purged served rows");
  }

  const seenNewExtIds = new Set<string>();
  const newArticles = scored.filter((a) => {
    const extId = a.external_id ?? a.id;
    if (seenNewExtIds.has(extId)) return false;
    seenNewExtIds.add(extId);
    const articleId = idMap.get(extId);
    return articleId && !existingArticleIds.has(articleId);
  });
  console.log(`[Queue] newArticles after filter: ${newArticles.length}`);

  if (newArticles.length === 0) {
    console.log("[Queue] No new articles to add — idMap empty or all blocked");
    return;
  }

  const { data: maxPosRow } = await supabase
    .from("article_queue")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startPosition = (maxPosRow?.position ?? 0) + 1;

  // Build queue using topic composition
  const queued = buildCompositionQueue(newArticles, topicNames, composition, newArticles.length);

  const queueRows = queued
    .map((article, i) => {
      const articleId = idMap.get(article.external_id ?? article.id);
      if (!articleId) return null;
      return {
        user_id:         userId,
        article_id:      articleId,
        relevance_score: article.relevanceScore,
        impact_level:    article.impactLevel,
        topic:           article.topic,
        position:        startPosition + i,
        served:          false,
      };
    })
    .filter(Boolean) as object[];

  const { data: insertedRows, error: insertError } = await supabase
    .from("article_queue")
    .insert(queueRows)
    .select("id, article_id, position");

  if (insertError) {
    console.error("[Queue] Insert failed:", insertError.message);
    return;
  }
  if (!insertedRows || insertedRows.length === 0) return;

  const articleIdToQueueId = new Map(
    (insertedRows as Array<{ id: string; article_id: string; position: number }>)
      .map((r) => [r.article_id, r.id])
  );

  async function enrichArticle(article: ScoredArticle) {
    const extId     = article.external_id ?? article.id;
    const articleId = idMap.get(extId);
    const queueId   = articleId ? articleIdToQueueId.get(articleId) : undefined;
    if (!queueId) return;

    const cached = enrichmentCache.get(extId);
    if (cached?.aiSummary && cached?.impactAnalysis) {
      await supabase
        .from("article_queue")
        .update({ ai_summary: cached.aiSummary, impact_analysis: cached.impactAnalysis })
        .eq("id", queueId);
      return;
    }

    const raw = {
      externalId:  extId,
      title:       article.title,
      summary:     article.summary ?? "",
      sourceName:  article.source_name ?? "",
      sourceUrl:   article.source_url ?? "",
      articleUrl:  article.article_url,
      topic:       article.topic ?? "",
      publishedAt: article.published_at ?? new Date().toISOString(),
    };

    // Single combined Gemini call per article
    const { summary, impactAnalysis, impactLevel } = await analyseArticle(
      raw,
      preferences.profile,
      geminiProfile,
      userId,
      sessionId,
      supabase
    );

    await supabase
      .from("article_queue")
      .update({
        ai_summary:      summary,
        impact_analysis: article.impactLevel === "low" ? null : impactAnalysis,
        impact_level:    impactLevel,
      })
      .eq("id", queueId);

    await supabase
      .from("articles")
      .update({ ai_summary: summary, impact_analysis: impactAnalysis })
      .eq("external_id", extId);
  }

  if (isDemoMode) {
    // Demo mode: set article summaries directly — no AI calls
    const demoEnrich = async (article: ScoredArticle) => {
      const extId   = article.external_id ?? article.id;
      const artId   = idMap.get(extId);
      const queueId = artId ? articleIdToQueueId.get(artId) : undefined;
      if (!queueId) return;
      await supabase
        .from("article_queue")
        .update({
          ai_summary:      article.summary?.slice(0, 200) ?? article.title,
          impact_analysis: article.impactLevel !== "low" ? `This ${article.topic} news may affect your finances and daily life.` : null,
          impact_level:    article.impactLevel,
        })
        .eq("id", queueId);
    };
    await runBatched(queued, 5, 0, demoEnrich);
  } else {
    // First DIGEST_SIZE articles: enrich immediately; next batch: enrich after response
    const immediate  = queued.slice(0, DIGEST_SIZE);
    const background = queued.slice(DIGEST_SIZE, DIGEST_SIZE * 3);
    await runBatched(immediate, 3, 4_000, enrichArticle);
    if (background.length > 0) {
      after(() => runBatched(background, 3, 4_000, enrichArticle));
    }
  }

  console.log(
    `[Queue] Built: ${queued.length} articles, positions ${startPosition}–${startPosition + queued.length - 1}`
  );
}
