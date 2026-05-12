"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { LoadingDots } from "@/components/ui/LoadingDots";

interface Keyword {
  keyword: string;
  points: number;
}

interface Settings {
  impact_weight:      number;
  topic_weight:       number;
  recency_weight:     number;
  keyword_weight:     number;
  feedback_weight:    number;
  feedback_penalty:   number;
  click_read_bonus:   number;
  custom_keywords:    Keyword[];
  avoidance_keywords: Keyword[];
  gemini_profile:     string;
  topic_composition:  Record<string, number>;
}

const DEFAULTS: Settings = {
  impact_weight:      50,
  topic_weight:       30,
  recency_weight:     40,
  keyword_weight:     15,
  feedback_weight:    10,
  feedback_penalty:   20,
  click_read_bonus:   8,
  custom_keywords:    [],
  avoidance_keywords: [],
  gemini_profile:     "",
  topic_composition:  {},
};

const WEIGHT_META: Array<{
  key: keyof Pick<Settings, "impact_weight"|"topic_weight"|"recency_weight"|"keyword_weight"|"feedback_weight"|"feedback_penalty"|"click_read_bonus">;
  label: string;
  description: string;
}> = [
  { key: "impact_weight",    label: "Impact",           description: "How much your profile (job, location, life stage) boosts relevant articles." },
  { key: "topic_weight",     label: "Topic match",      description: "How much your selected topics boost matching articles." },
  { key: "recency_weight",   label: "Recency",          description: "Boost for very fresh articles published in the last 6 hours." },
  { key: "keyword_weight",   label: "Keywords",         description: "Points added when article text matches your topic keywords." },
  { key: "feedback_weight",  label: "Feedback bonus",   description: "Points added for articles from topics you previously upvoted." },
  { key: "feedback_penalty", label: "Feedback penalty", description: "Points removed for articles from topics you downvoted." },
  { key: "click_read_bonus", label: "Click/Read bonus", description: "Bonus for articles from sources you've clicked before." },
];

// Topic colours
const TOPIC_COLORS: Record<string, string> = {
  "Economy":            "#1D5C3A",
  "Tech & AI":          "#2563EB",
  "Health":             "#DC2626",
  "Malaysian Politics": "#7C3AED",
  "Property":           "#D97706",
};
const COLOR_CYCLE = ["#1D5C3A", "#2563EB", "#DC2626", "#7C3AED", "#D97706"];

function getTopicColor(topic: string, index: number): string {
  return TOPIC_COLORS[topic] ?? COLOR_CYCLE[index % COLOR_CYCLE.length];
}

function initComposition(topics: string[], saved: Record<string, number>): Record<string, number> {
  if (!topics.length) return {};
  const hasValues = topics.some((t) => saved[t] !== undefined && saved[t] > 0);
  if (hasValues) {
    const result: Record<string, number> = {};
    for (const t of topics) result[t] = saved[t] ?? 0;
    return result;
  }
  const per = Math.floor(100 / topics.length);
  const rem = 100 % topics.length;
  const result: Record<string, number> = {};
  topics.forEach((t, i) => { result[t] = per + (i === 0 ? rem : 0); });
  return result;
}

// ─── Slider components ────────────────────────────────────────────────────────

function WeightSlider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range" min={min} max={max} step={1} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-brand h-2"
    />
  );
}

// ─── Keyword list ─────────────────────────────────────────────────────────────

function KeywordList({ keywords, label, hint, onChange }: {
  keywords: Keyword[]; label: string; hint: string; onChange: (kw: Keyword[]) => void;
}) {
  const [input, setInput] = useState("");

  function addKeyword() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...keywords, { keyword: trimmed, points: 15 }]);
    setInput("");
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      <div className="space-y-2 mb-3">
        {keywords.map((kw, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{kw.keyword}</span>
            <WeightSlider value={kw.points} min={0} max={30} onChange={(v) => onChange(keywords.map((k, j) => j === i ? { ...k, points: v } : k))} />
            <span className="text-xs text-gray-500 w-6 text-right shrink-0">{kw.points}</span>
            <button type="button" onClick={() => onChange(keywords.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xs ml-1" title="Remove">✕</button>
          </div>
        ))}
        {keywords.length === 0 && <p className="text-sm text-gray-300 italic">No {label.toLowerCase()} yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addKeyword(); }}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button type="button" onClick={addKeyword} className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors">Add</button>
      </div>
    </div>
  );
}

// ─── Topic Composition section ────────────────────────────────────────────────

function TopicComposition({
  topics,
  composition,
  onChange,
}: {
  topics: string[];
  composition: Record<string, number>;
  onChange: (c: Record<string, number>) => void;
}) {
  const total = topics.reduce((s, t) => s + (composition[t] ?? 0), 0);
  const isValid = total === 100;

  function autoBalance() {
    if (!topics.length) return;
    const per = Math.floor(100 / topics.length);
    const rem = 100 % topics.length;
    const next: Record<string, number> = {};
    topics.forEach((t, i) => { next[t] = per + (i === 0 ? rem : 0); });
    onChange(next);
  }

  function setTopicValue(topic: string, value: number) {
    onChange({ ...composition, [topic]: value });
  }

  return (
    <div>
      {/* Stacked bar */}
      <div style={{ display: "flex", height: "10px", borderRadius: "4px", overflow: "hidden", marginBottom: "20px", background: "#E5E7EB" }}>
        {topics.map((topic, i) => {
          const pct = composition[topic] ?? 0;
          if (pct <= 0) return null;
          return (
            <div
              key={topic}
              title={`${topic}: ${pct}%`}
              style={{
                width: `${pct}%`,
                background: getTopicColor(topic, i),
                transition: "width 0.2s ease",
              }}
            />
          );
        })}
      </div>

      {/* Sliders */}
      <div className="space-y-4 mb-4">
        {topics.map((topic, i) => (
          <div key={topic}>
            <div className="flex items-center gap-3 mb-1">
              <span
                style={{ background: getTopicColor(topic, i) }}
                className="w-2.5 h-2.5 rounded-full shrink-0"
              />
              <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{topic}</span>
              <input
                type="range" min={0} max={100} step={5}
                value={composition[topic] ?? 0}
                onChange={(e) => setTopicValue(topic, Number(e.target.value))}
                className="flex-1 accent-brand h-2"
                style={{ accentColor: getTopicColor(topic, i) }}
              />
              <span className="text-sm font-mono text-gray-600 w-10 text-right shrink-0">
                {composition[topic] ?? 0}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total counter + auto-balance */}
      <div className="flex items-center justify-between mt-2">
        <span
          className="text-sm font-mono font-semibold"
          style={{ color: isValid ? "#1D5C3A" : "#DC2626" }}
        >
          Total: {total}%{isValid ? " ✓" : ""}
        </span>
        <button
          type="button"
          onClick={autoBalance}
          className="text-xs text-gray-500 hover:text-brand underline transition-colors"
        >
          Auto-balance
        </button>
      </div>
      {!isValid && (
        <p className="text-xs text-red-500 mt-1">
          {total < 100 ? `${100 - total}% unallocated` : `${total - 100}% over budget`} — must total exactly 100%.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlgorithmPage() {
  const { showToast }       = useToast();
  const [settings,  setSettings]  = useState<Settings>(DEFAULTS);
  const [topics,    setTopics]    = useState<string[]>([]);
  const [composition, setComposition] = useState<Record<string, number>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [regen,     setRegen]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [settingsRes, profileRes] = await Promise.all([
        fetch("/api/algorithm/settings"),
        fetch("/api/profile"),
      ]);
      const data        = await settingsRes.json();
      const profileData = await profileRes.json();

      const presetTopics: string[] = (profileData.topics ?? [])
        .filter((t: { is_preset: boolean }) => t.is_preset)
        .map((t: { topic: string }) => t.topic);

      const savedComposition: Record<string, number> =
        data.topic_composition && typeof data.topic_composition === "object"
          ? data.topic_composition
          : {};

      setTopics(presetTopics);
      setComposition(initComposition(presetTopics, savedComposition));
      setSettings({
        ...DEFAULTS,
        ...data,
        custom_keywords:    Array.isArray(data.custom_keywords)    ? data.custom_keywords    : [],
        avoidance_keywords: Array.isArray(data.avoidance_keywords) ? data.avoidance_keywords : [],
        topic_composition:  savedComposition,
      });
    } catch {
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const compositionTotal = topics.reduce((s, t) => s + (composition[t] ?? 0), 0);
  const canSave          = compositionTotal === 100 || topics.length === 0;

  async function handleSave() {
    if (!canSave) {
      showToast("Topic composition must total 100%", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...settings, topic_composition: composition };
      const res = await fetch("/api/algorithm/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Algorithm settings saved", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenProfile() {
    setRegen(true);
    try {
      const res  = await fetch("/api/algorithm/regenerate-profile", { method: "POST" });
      const data = await res.json();
      setSettings((s) => ({ ...s, gemini_profile: data.gemini_profile ?? s.gemini_profile }));
      showToast("Profile regenerated", "success");
    } catch {
      showToast("Failed to regenerate profile", "error");
    } finally {
      setRegen(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><LoadingDots /></div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-brand mb-1">My Algorithm</h1>
        <p className="text-sm text-gray-500">Tune how Briefd ranks and filters your digest.</p>
      </div>

      {/* Section 1 — Scoring weights */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-gray-800">Scoring weights</h2>
          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, ...DEFAULTS, custom_keywords: s.custom_keywords, avoidance_keywords: s.avoidance_keywords, gemini_profile: s.gemini_profile, topic_composition: s.topic_composition }))}
            className="text-xs text-gray-400 hover:text-brand transition-colors"
          >
            Reset to defaults
          </button>
        </div>
        <div className="space-y-4">
          {WEIGHT_META.map(({ key, label, description }) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-medium text-gray-700 w-36 shrink-0">{label}</span>
                <WeightSlider
                  value={settings[key] as number}
                  min={0} max={100}
                  onChange={(v) => setSettings((s) => ({ ...s, [key]: v }))}
                />
                <span className="text-sm text-gray-600 font-mono w-8 text-right shrink-0">
                  {settings[key] as number}
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-[9.5rem]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Topic Composition */}
      {topics.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Topic Composition</h2>
          <p className="text-xs text-gray-400 mb-4">
            Adjust how much of your digest covers each topic. Must add up to 100%.
          </p>
          <TopicComposition
            topics={topics}
            composition={composition}
            onChange={setComposition}
          />
        </section>
      )}

      {/* Section 3 — Boost keywords */}
      <section className="mb-10">
        <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Boost keywords</h2>
        <KeywordList
          keywords={settings.custom_keywords}
          label="Boost keyword"
          hint="Articles containing these keywords will score higher in your digest."
          onChange={(kw) => setSettings((s) => ({ ...s, custom_keywords: kw }))}
        />
      </section>

      {/* Section 4 — Avoidance keywords */}
      <section className="mb-10">
        <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Avoidance keywords</h2>
        <KeywordList
          keywords={settings.avoidance_keywords}
          label="Avoidance keyword"
          hint="These topics will be filtered down in your digest. Auto-populated from your dislikes."
          onChange={(kw) => setSettings((s) => ({ ...s, avoidance_keywords: kw }))}
        />
      </section>

      {/* Section 5 — Gemini profile */}
      <section className="mb-10">
        <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Your Gemini profile</h2>
        <p className="text-xs text-gray-400 mb-2">
          Gemini uses this to personalise your impact analysis. It updates automatically as you give feedback.
        </p>
        <textarea
          readOnly
          value={settings.gemini_profile || "No profile yet — give some feedback to generate one."}
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none text-gray-600 bg-gray-50 focus:outline-none"
        />
        <button
          type="button" onClick={handleRegenProfile} disabled={regen}
          className="mt-2 text-sm text-brand hover:underline disabled:opacity-50"
        >
          {regen ? "Regenerating…" : "Regenerate profile"}
        </button>
      </section>

      {/* Save */}
      <div className="pb-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          title={!canSave ? "Topic composition must total 100%" : undefined}
          className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {!canSave && topics.length > 0 && (
          <p className="text-xs text-red-500 mt-2">Topic composition must total exactly 100% to save.</p>
        )}
      </div>
    </div>
  );
}
