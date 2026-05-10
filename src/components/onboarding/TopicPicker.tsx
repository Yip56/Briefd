"use client";

import { PRESET_TOPICS } from "@/lib/constants";
import { clsx } from "clsx";

interface TopicPickerProps {
  selected: string[];
  onToggle: (topic: string) => void;
}

export function TopicPicker({ selected, onToggle }: TopicPickerProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Pick the topics that matter to you — select as many as you like.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESET_TOPICS.map((topic) => {
          const active = selected.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              onClick={() => onToggle(topic)}
              className={clsx(
                "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                active
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand/50 hover:text-brand"
              )}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
