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
};

const WEIGHT_META: Array<{
  key: keyof Pick<Settings, "impact_weight"|"topic_weight"|"recency_weight"|"keyword_weight"|"feedback_weight"|"feedback_penalty"|"click_read_bonus">;
  label: string;
  description: string;
}> = [
  { key: "impact_weight",    label: "Impact",          description: "How much your profile (job, location, life stage) boosts relevant articles." },
  { key: "topic_weight",     label: "Topic match",     description: "How much your selected topics boost matching articles." },
  { key: "recency_weight",   label: "Recency",         description: "Boost for very fresh articles published in the last 6 hours." },
  { key: "keyword_weight",   label: "Keywords",        description: "Points added when article text matches your topic keywords." },
  { key: "feedback_weight",  label: "Feedback bonus",  description: "Points added for articles from topics you previously upvoted." },
  { key: "feedback_penalty", label: "Feedback penalty",description: "Points removed for articles from topics you downvoted." },
  { key: "click_read_bonus", label: "Click/Read bonus",description: "Bonus for articles from sources you've clicked before." },
];

// ─── Slider component ─────────────────────────────────────────────────────────

function WeightSlider({
  value, min, max, onChange,
}: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-brand h-2"
    />
  );
}

// ─── Keyword list section ─────────────────────────────────────────────────────

function KeywordList({
  keywords, label, hint, onChange,
}: {
  keywords: Keyword[];
  label: string;
  hint: string;
  onChange: (kw: Keyword[]) => void;
}) {
  const [input, setInput] = useState("");

  function addKeyword() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...keywords, { keyword: trimmed, points: 15 }]);
    setInput("");
  }

  function removeKeyword(idx: number) {
    onChange(keywords.filter((_, i) => i !== idx));
  }

  function updatePoints(idx: number, points: number) {
    onChange(keywords.map((k, i) => (i === idx ? { ...k, points } : k)));
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      <div className="space-y-2 mb-3">
        {keywords.map((kw, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{kw.keyword}</span>
            <WeightSlider value={kw.points} min={0} max={30} onChange={(v) => updatePoints(i, v)} />
            <span className="text-xs text-gray-500 w-6 text-right shrink-0">{kw.points}</span>
            <button
              type="button"
              onClick={() => removeKeyword(i)}
              className="text-gray-300 hover:text-red-400 text-xs ml-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        {keywords.length === 0 && (
          <p className="text-sm text-gray-300 italic">No {label.toLowerCase()} yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addKeyword(); }}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="button"
          onClick={addKeyword}
          className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlgorithmPage() {
  const { showToast }          = useToast();
  const [settings,  setSettings]  = useState<Settings>(DEFAULTS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [regen,     setRegen]     = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/algorithm/settings");
      const data = await res.json();
      setSettings({
        ...DEFAULTS,
        ...data,
        custom_keywords:    Array.isArray(data.custom_keywords)    ? data.custom_keywords    : [],
        avoidance_keywords: Array.isArray(data.avoidance_keywords) ? data.avoidance_keywords : [],
      });
    } catch {
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function setWeight(key: keyof Settings, value: number) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/algorithm/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
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
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-brand mb-1">My Algorithm</h1>
        <p className="text-sm text-gray-500">
          Tune how Briefd ranks and filters your digest.
        </p>
      </div>

      {/* Section 1 — Scoring weights */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-gray-800">Scoring weights</h2>
          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, ...DEFAULTS, custom_keywords: s.custom_keywords, avoidance_keywords: s.avoidance_keywords, gemini_profile: s.gemini_profile }))}
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
                  min={0}
                  max={100}
                  onChange={(v) => setWeight(key, v)}
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

      {/* Section 2 — Boost keywords */}
      <section className="mb-10">
        <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Boost keywords</h2>
        <KeywordList
          keywords={settings.custom_keywords}
          label="Boost keyword"
          hint="Articles containing these keywords will score higher in your digest."
          onChange={(kw) => setSettings((s) => ({ ...s, custom_keywords: kw }))}
        />
      </section>

      {/* Section 3 — Avoidance keywords */}
      <section className="mb-10">
        <h2 className="text-[15px] font-semibold text-gray-800 mb-1">Avoidance keywords</h2>
        <KeywordList
          keywords={settings.avoidance_keywords}
          label="Avoidance keyword"
          hint="These topics will be filtered down in your digest. Auto-populated from your dislikes."
          onChange={(kw) => setSettings((s) => ({ ...s, avoidance_keywords: kw }))}
        />
      </section>

      {/* Section 4 — Gemini profile */}
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
          type="button"
          onClick={handleRegenProfile}
          disabled={regen}
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
          disabled={saving}
          className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
