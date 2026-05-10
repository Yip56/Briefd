"use client";

import { clsx } from "clsx";

interface FilterBarProps {
  topics:      string[];
  activeTopic: string | null;
  onSelect:    (topic: string | null) => void;
}

export function FilterBar({ topics, activeTopic, onSelect }: FilterBarProps) {
  if (topics.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <Pill label="All" active={activeTopic === null} onClick={() => onSelect(null)} />
      {topics.map((topic) => (
        <Pill
          key={topic}
          label={topic}
          active={activeTopic === topic}
          onClick={() => onSelect(activeTopic === topic ? null : topic)}
        />
      ))}
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-brand text-white border-brand"
          : "bg-white text-gray-600 border-gray-200 hover:border-brand/40 hover:text-brand"
      )}
    >
      {label}
    </button>
  );
}
