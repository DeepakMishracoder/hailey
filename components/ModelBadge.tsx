"use client";
import { ActiveModel } from "@/lib/types";

interface ModelBadgeProps {
  model: ActiveModel;
}

const MODEL_INFO: Record<ActiveModel, { label: string; cls: string }> = {
  groq: { label: "Groq · llama-3.1-8b", cls: "model-badge--groq" },
  openrouter: { label: "OpenRouter · gemma-3-27b", cls: "model-badge--openrouter" },
};

export default function ModelBadge({ model }: ModelBadgeProps) {
  const { label, cls } = MODEL_INFO[model];
  return (
    <div className={`model-badge ${cls}`} role="status" aria-live="polite">
      <span className="model-badge-dot" />
      <span>{label}</span>
    </div>
  );
}
