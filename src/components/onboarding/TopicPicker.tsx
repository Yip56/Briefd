"use client";

import { useState } from "react";
import { PRESET_TOPICS } from "@/lib/constants";
import { clsx } from "clsx";

interface TopicPickerProps {
  selected: string[];
  onToggle: (topic: string) => void;
  topicOrder: string[];
  onReorder: (ordered: string[]) => void;
}

export function TopicPicker({ selected, onToggle, topicOrder, onReorder }: TopicPickerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newOrder = [...topicOrder];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(index, 0, moved);
    onReorder(newOrder);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div>
      {/* Preset topic pills */}
      <p className="text-xs text-gray-500 mb-3">
        Pick the topics that matter to you — select as many as you like.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
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

      {/* Drag-to-rank section — shown when at least one topic is selected */}
      {topicOrder.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">
            Rank your topics — drag to reorder
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Topic #1 gets the most articles and a higher score multiplier.
          </p>
          <div className="space-y-1.5">
            {topicOrder.map((topic, i) => (
              <div
                key={topic}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white cursor-grab active:cursor-grabbing select-none transition-all",
                  dragOverIndex === i && dragIndex !== i
                    ? "border-brand bg-brand-light"
                    : "border-gray-200",
                  dragIndex === i && "opacity-40"
                )}
              >
                <span className="text-xs font-semibold text-brand/60 w-5 text-right tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1">{topic}</span>
                <span className="text-gray-300 text-sm">⠿</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-2">
            Weights: #1 = 3×, #2 = 2×, #3+ = 1×
          </p>
        </div>
      )}
    </div>
  );
}
