export const GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS = [
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

export const SYSTEM_PROMPT =
  "You are Hailey, a sharp, concise AI assistant. Respond directly and helpfully. Use markdown for code, tables, and math (LaTeX). No filler greetings.";

export const MAX_TOKENS = 4096;
