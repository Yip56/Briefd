"use client";

import { DIGEST_SCHEDULE_OPTIONS } from "@/lib/constants";

interface SchedulePickerProps {
  digestTime:      string;
  digestFrequency: "daily" | "weekly";
  emailEnabled:    boolean;
  onTimeChange:      (v: string) => void;
  onFrequencyChange: (v: "daily" | "weekly") => void;
  onEmailToggle:     (v: boolean) => void;
}

export function SchedulePicker({
  digestTime,
  digestFrequency,
  emailEnabled,
  onTimeChange,
  onFrequencyChange,
  onEmailToggle,
}: SchedulePickerProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Delivery time
        </label>
        <select
          value={digestTime}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring bg-white"
        >
          {DIGEST_SCHEDULE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Frequency
        </label>
        <div className="flex gap-2">
          {(["daily", "weekly"] as const).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => onFrequencyChange(freq)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all capitalize ${
                digestFrequency === freq
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand/50"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-3 px-4 bg-white border border-gray-200 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-800">Email digest</p>
          <p className="text-xs text-gray-400 mt-0.5">Receive your digest by email</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          onClick={() => onEmailToggle(!emailEnabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            emailEnabled ? "bg-brand" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              emailEnabled ? "translate-x-[18px]" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
