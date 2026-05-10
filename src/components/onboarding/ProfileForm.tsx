"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopicPicker } from "./TopicPicker";
import { KeywordInput } from "./KeywordInput";
import { SchedulePicker } from "./SchedulePicker";
import {
  OCCUPATION_OPTIONS,
  LOCATION_OPTIONS,
  LIFE_STAGE_OPTIONS,
  VEHICLE_OPTIONS,
} from "@/lib/constants";

const STEPS = ["About you", "What you follow", "Your schedule"] as const;

function Select({
  label, value, onChange, options, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
      >
        <option value="">{placeholder ?? `Select ${label.toLowerCase()}…`}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function ProfileForm() {
  const router = useRouter();

  // Step 1 — profile
  const [occupation, setOccupation] = useState("");
  const [location,   setLocation]   = useState("");
  const [lifeStage,  setLifeStage]  = useState("");
  const [vehicle,    setVehicle]    = useState("");

  // Step 2 — topics
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [keywords,       setKeywords]       = useState<string[]>([]);

  // Step 3 — schedule
  const [digestTime,      setDigestTime]      = useState("08:00");
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily");
  const [emailEnabled,    setEmailEnabled]    = useState(true);

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  function canAdvance() {
    if (step === 1) return Boolean(occupation);
    if (step === 2) return selectedTopics.length > 0;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation,
          location,
          life_stage:            lifeStage,
          vehicle,
          topics:                [...selectedTopics, ...keywords],
          digest_time:           digestTime,
          digest_frequency:      digestFrequency,
          email_digest_enabled:  emailEnabled,
        }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl card-border p-6 sm:p-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  i + 1 < step
                    ? "bg-brand text-white"
                    : i + 1 === step
                    ? "bg-brand text-white ring-4 ring-brand-light"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1 < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i + 1 === step ? "text-brand font-medium" : "text-gray-400"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 sm:w-16 mx-1 ${i + 1 < step ? "bg-brand" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl text-gray-900 mb-4">Who are you?</h2>
            <Select label="Occupation" value={occupation} onChange={setOccupation} options={OCCUPATION_OPTIONS} />
            <Select label="Location"   value={location}   onChange={setLocation}   options={LOCATION_OPTIONS} />
            <Select label="Life stage" value={lifeStage}  onChange={setLifeStage}  options={LIFE_STAGE_OPTIONS} />
            <Select label="Vehicle"    value={vehicle}    onChange={setVehicle}    options={VEHICLE_OPTIONS} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-serif text-xl text-gray-900 mb-4">What do you follow?</h2>
            <TopicPicker selected={selectedTopics} onToggle={toggleTopic} />
            <KeywordInput
              keywords={keywords}
              onAdd={(kw) => setKeywords((p) => [...p, kw])}
              onRemove={(kw) => setKeywords((p) => p.filter((k) => k !== kw))}
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-serif text-xl text-gray-900 mb-4">Your schedule</h2>
            <SchedulePicker
              digestTime={digestTime}
              digestFrequency={digestFrequency}
              emailEnabled={emailEnabled}
              onTimeChange={setDigestTime}
              onFrequencyChange={setDigestFrequency}
              onEmailToggle={setEmailEnabled}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="text-sm text-gray-400 hover:text-gray-600 disabled:invisible transition-colors"
        >
          ← Back
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Setting up…" : "Build my digest →"}
          </button>
        )}
      </div>
    </div>
  );
}
