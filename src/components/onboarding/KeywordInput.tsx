"use client";

import { useState, KeyboardEvent } from "react";

interface KeywordInputProps {
  keywords: string[];
  onAdd:    (keyword: string) => void;
  onRemove: (keyword: string) => void;
}

export function KeywordInput({ keywords, onAdd, onRemove }: KeywordInputProps) {
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      onAdd(trimmed);
    }
    setValue("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Backspace" && value === "" && keywords.length > 0) {
      onRemove(keywords[keywords.length - 1]);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">
        Add custom keywords — press Enter or comma to add.
      </p>
      <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-gray-200 rounded-lg min-h-[44px] focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand-ring transition">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-brand-light text-brand text-xs font-medium rounded-full"
          >
            {kw}
            <button
              type="button"
              onClick={() => onRemove(kw)}
              className="text-brand/60 hover:text-brand leading-none"
              aria-label={`Remove ${kw}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={keywords.length === 0 ? "e.g. KLCI, GST, Budget 2025…" : ""}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder-gray-300"
        />
      </div>
    </div>
  );
}
