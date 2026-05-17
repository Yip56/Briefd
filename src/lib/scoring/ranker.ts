import { SCORING_WEIGHTS } from "@/lib/constants";
import type { RawArticle, ScoredArticle, UserPreferences, ImpactLevel, VoteValue, UserTopic, UserAlgorithmSettings } from "@/lib/types";

const HIGH_IMPACT_WORDS = [
  "subsidy", "price hike", "interest rate", "opr", "epf", "tax",
  "layoff", "ban", "mandatory", "emergency",
];

const TOP_N = 50;

function recencyScore(publishedAt: string, recencyWeight: number): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const h = ageMs / 3_600_000;
  const scale = recencyWeight / SCORING_WEIGHTS.recency; // relative to default 40
  if (h <= 6)  return Math.round(recencyWeight * scale);
  if (h <= 24) return Math.round(30 * scale);
  if (h <= 72) return Math.round(15 * scale);
  return Math.round(5 * scale);
}

function topicMatchScore(articleTopic: string, userTopics: UserTopic[], topicWeight: number): number {
  const at = articleTopic.toLowerCase();
  for (const ut of userTopics) {
    const tl = ut.topic.toLowerCase();
    let base = 0;
    if (tl === at) {
      base = topicWeight;
    } else {
      const utWords = tl.split(/\s+/);
      if (utWords.some((w) => w.length > 3 && at.includes(w))) base = Math.round(topicWeight * 0.5);
    }
    if (base > 0) {
      const weight = ut.weight ?? 1.0;
      return base * weight;
    }
  }
  return 0;
}

function profileMatchScore(
  article: RawArticle,
  profile: UserPreferences["profile"],
  impactWeight: number
): number {
  const topic = article.topic.toLowerCase();
  const text  = `${article.title} ${article.summary}`.toLowerCase();
  const w     = Math.round(SCORING_WEIGHTS.profileMatch * (impactWeight / 50));

  if (
    (profile.vehicle === "Car owner" || profile.vehicle === "Both") &&
    (topic.includes("fuel") || topic.includes("transport") || text.includes("petrol") || text.includes("ron95"))
  ) return w;

  if (
    (profile.occupation === "Student" || profile.occupation === "Fresh Graduate") &&
    (topic.includes("job") || topic.includes("career") || text.includes("graduate") || text.includes("internship"))
  ) return w;

  if (
    (profile.occupation === "Business Owner" || profile.occupation === "Investor") &&
    (topic.includes("finance") || topic.includes("economy") || topic.includes("investing") || text.includes("ringgit"))
  ) return w;

  if (
    (profile.life_stage === "Renting" || profile.life_stage === "Looking to buy property") &&
    (topic.includes("property") || text.includes("rent") || text.includes("house price") || text.includes("mortgage"))
  ) return w;

  return 0;
}

function keywordMatchScore(article: RawArticle, userTopics: UserTopic[], keywordWeight: number): number {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  let pts = 0;
  for (const ut of userTopics) {
    if (text.includes(ut.topic.toLowerCase())) {
      pts += keywordWeight;
    }
  }
  return pts;
}

function voteFeedbackScore(
  externalId: string,
  feedbackMap: Record<string, VoteValue>,
  upWeight: number,
  downPenalty: number
): number {
  const vote = feedbackMap[externalId];
  if (!vote) return 0;
  return vote === "up" ? upWeight : -downPenalty;
}

function customKeywordScore(
  article: RawArticle,
  customKeywords: Array<{ keyword: string; points: number }>,
  avoidanceKeywords: Array<{ keyword: string; points: number }>
): number {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  let pts = 0;
  for (const kw of customKeywords) {
    if (text.includes(kw.keyword.toLowerCase())) pts += kw.points;
  }
  for (const kw of avoidanceKeywords) {
    if (text.includes(kw.keyword.toLowerCase())) pts -= kw.points;
  }
  return pts;
}

function deriveImpactLevel(score: number, title: string): ImpactLevel {
  const lower = title.toLowerCase();
  if (score > 75 || HIGH_IMPACT_WORDS.some((w) => lower.includes(w))) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function scoreArticles(
  articles: RawArticle[],
  preferences: UserPreferences,
  feedbackMap: Record<string, VoteValue>,
  algorithmSettings?: UserAlgorithmSettings | null,
  clickedArticleUrls?: Set<string>
): ScoredArticle[] {
  const userTopics = preferences.topics;
  const now = new Date().toISOString();

  const impactWeight   = algorithmSettings?.impact_weight   ?? 50;
  const topicWeight    = algorithmSettings?.topic_weight    ?? SCORING_WEIGHTS.topicMatch;
  const recencyWeight  = algorithmSettings?.recency_weight  ?? SCORING_WEIGHTS.recency;
  const keywordWeight  = algorithmSettings?.keyword_weight  ?? SCORING_WEIGHTS.keywordMatch;
  const feedbackUp     = algorithmSettings?.feedback_weight ?? SCORING_WEIGHTS.voteFeedback.up;
  const feedbackDown   = algorithmSettings?.feedback_penalty ?? Math.abs(SCORING_WEIGHTS.voteFeedback.down);
  const clickBonus     = algorithmSettings?.click_read_bonus ?? 8;
  const customKeywords = algorithmSettings?.custom_keywords  ?? [];
  const avoidanceKeywords = algorithmSettings?.avoidance_keywords ?? [];

  const selectedTopicNames = userTopics.map((t) => t.topic.toLowerCase());

  const scored = articles.map((raw): ScoredArticle & { _score: number } => {
    const clickBonusPoints = clickedArticleUrls?.has(raw.articleUrl) ? clickBonus : 0;
    const artTopic = (raw.topic ?? "").toLowerCase();
    const isSelectedTopic =
      selectedTopicNames.length === 0 ||
      selectedTopicNames.some((t) => t === artTopic || artTopic.includes(t) || t.includes(artTopic));
    const offTopicPenalty = isSelectedTopic ? 0 : -50;

    const impactScoreBonus = ((raw.impactScore ?? 0) / 100) * 20;

    const profileTagBonus = raw.profileTags
      ? [preferences.profile.vehicle, preferences.profile.occupation, preferences.profile.location, preferences.profile.life_stage]
          .filter(Boolean)
          .filter((tag) => raw.profileTags!.some((pt) => pt.toLowerCase() === tag!.toLowerCase()))
          .length * 25
      : 0;

    const score =
      recencyScore(raw.publishedAt, recencyWeight) +
      (isSelectedTopic ? topicMatchScore(raw.topic, userTopics, topicWeight) : 0) +
      profileMatchScore(raw, preferences.profile, impactWeight) +
      keywordMatchScore(raw, userTopics, keywordWeight) +
      voteFeedbackScore(raw.externalId, feedbackMap, feedbackUp, feedbackDown) +
      customKeywordScore(raw, customKeywords, avoidanceKeywords) +
      clickBonusPoints +
      offTopicPenalty +
      impactScoreBonus +
      profileTagBonus;

    const impactLevel = deriveImpactLevel(score, raw.title);

    return {
      id: raw.externalId,
      external_id: raw.externalId,
      title: raw.title,
      summary: raw.summary,
      source_name: raw.sourceName,
      source_url: raw.sourceUrl,
      article_url: raw.articleUrl,
      topic: raw.topic,
      published_at: raw.publishedAt,
      fetched_at: now,
      relevanceScore: Math.max(0, score),
      impactLevel,
      combined: raw.summary.slice(0, 200),
      userVote: feedbackMap[raw.externalId] ?? null,
      _score: score,
    };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, TOP_N).map(({ _score: _, ...article }) => article);
}
