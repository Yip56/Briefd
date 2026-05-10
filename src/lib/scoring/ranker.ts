import { SCORING_WEIGHTS } from "@/lib/constants";
import type { RawArticle, ScoredArticle, UserPreferences, ImpactLevel, VoteValue } from "@/lib/types";

const HIGH_IMPACT_WORDS = [
  "subsidy", "price hike", "interest rate", "opr", "epf", "tax",
  "layoff", "ban", "mandatory", "emergency",
];

const TOP_N = 15;

// ─── Recency ─────────────────────────────────────────────────────────────────

function recencyScore(publishedAt: string): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const h = ageMs / 3_600_000;
  if (h <= 6)  return SCORING_WEIGHTS.recency;       // 40
  if (h <= 24) return 30;
  if (h <= 72) return 15;
  return 5;
}

// ─── Topic match ─────────────────────────────────────────────────────────────

function topicMatchScore(articleTopic: string, userTopics: string[]): number {
  const at = articleTopic.toLowerCase();
  for (const ut of userTopics) {
    if (ut.toLowerCase() === at) return SCORING_WEIGHTS.topicMatch; // 30
    // partial: at least one word in common
    const utWords = ut.toLowerCase().split(/\s+/);
    if (utWords.some((w) => w.length > 3 && at.includes(w))) return 15;
  }
  return 0;
}

// ─── Profile match ────────────────────────────────────────────────────────────

function profileMatchScore(article: RawArticle, profile: UserPreferences["profile"]): number {
  const topic = article.topic.toLowerCase();
  const text  = `${article.title} ${article.summary}`.toLowerCase();
  const w     = SCORING_WEIGHTS.profileMatch; // 25

  // Vehicle → fuel/transport
  if (
    (profile.vehicle === "Car owner" || profile.vehicle === "Both") &&
    (topic.includes("fuel") || topic.includes("transport") || text.includes("petrol") || text.includes("ron95"))
  ) return w;

  // Student / fresh grad → jobs
  if (
    (profile.occupation === "Student" || profile.occupation === "Fresh Graduate") &&
    (topic.includes("job") || topic.includes("career") || text.includes("graduate") || text.includes("internship"))
  ) return w;

  // Business owner / investor → finance/economy
  if (
    (profile.occupation === "Business Owner" || profile.occupation === "Investor") &&
    (topic.includes("finance") || topic.includes("economy") || topic.includes("investing") || text.includes("ringgit"))
  ) return w;

  // Renting / looking to buy → property
  if (
    (profile.life_stage === "Renting" || profile.life_stage === "Looking to buy property") &&
    (topic.includes("property") || text.includes("rent") || text.includes("house price") || text.includes("mortgage"))
  ) return w;

  return 0;
}

// ─── Keyword match ────────────────────────────────────────────────────────────

function keywordMatchScore(article: RawArticle, userTopics: string[]): number {
  // Custom / non-preset topics act as keyword searches
  const text = `${article.title} ${article.summary}`.toLowerCase();
  let pts = 0;
  for (const keyword of userTopics) {
    if (text.includes(keyword.toLowerCase())) {
      pts += SCORING_WEIGHTS.keywordMatch; // 15 per match
    }
  }
  return pts;
}

// ─── Vote feedback ────────────────────────────────────────────────────────────

function voteFeedbackScore(externalId: string, feedbackMap: Record<string, VoteValue>): number {
  const vote = feedbackMap[externalId];
  if (!vote) return 0;
  return vote === "up" ? SCORING_WEIGHTS.voteFeedback.up : SCORING_WEIGHTS.voteFeedback.down;
}

// ─── Impact level ─────────────────────────────────────────────────────────────

function deriveImpactLevel(score: number, title: string): ImpactLevel {
  const lower = title.toLowerCase();
  if (score > 75 || HIGH_IMPACT_WORDS.some((w) => lower.includes(w))) return "high";
  if (score >= 45) return "medium";
  return "low";
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function scoreArticles(
  articles: RawArticle[],
  preferences: UserPreferences,
  feedbackMap: Record<string, VoteValue>
): ScoredArticle[] {
  const userTopicNames = preferences.topics.map((t) => t.topic);
  const now = new Date().toISOString();

  const scored = articles.map((raw): ScoredArticle & { _score: number } => {
    const score =
      recencyScore(raw.publishedAt) +
      topicMatchScore(raw.topic, userTopicNames) +
      profileMatchScore(raw, preferences.profile) +
      keywordMatchScore(raw, userTopicNames) +
      voteFeedbackScore(raw.externalId, feedbackMap);

    const impactLevel = deriveImpactLevel(score, raw.title);

    return {
      // Article (DB shape) fields
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
      // ScoredArticle extras
      relevanceScore: Math.max(0, score),
      impactLevel,
      aiSummary: raw.summary.slice(0, 200),
      userVote: feedbackMap[raw.externalId] ?? null,
      // Temporary sort key (stripped before return)
      _score: score,
    };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, TOP_N).map(({ _score: _, ...article }) => article);
}
