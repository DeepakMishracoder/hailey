import { NextRequest, NextResponse } from "next/server";
import {
  GROQ_API_URL,
  GROQ_MODEL,
  OPENROUTER_API_URL,
  OPENROUTER_MODELS,
  SYSTEM_PROMPT,
  MAX_TOKENS,
} from "@/lib/config";
import { Message } from "@/lib/types";

export const runtime = "edge";

interface RequestBody {
  messages: Message[];
}

// ── Live date/time injection ─────────────────────────────────────────────────
// NOTE: new Date() runs on the server at request time — always the real
// current date no matter when or who is making the request.
function buildDateContext(): string {
  const now = new Date();
  const timezones = [
    { name: "US/Eastern — Miami/New York (ET)", offset: -4 },
    { name: "US/Pacific — LA/Seattle (PT)",     offset: -7 },
    { name: "US/Central — Chicago (CT)",         offset: -5 },
    { name: "London (BST/GMT)",                  offset: +1 },
    { name: "India (IST)",                       offset: +5.5 },
    { name: "Dubai (GST)",                       offset: +4 },
    { name: "Singapore/HK (SGT)",                offset: +8 },
    { name: "Tokyo (JST)",                       offset: +9 },
    { name: "Sydney (AEST)",                     offset: +10 },
  ];
  const tzLines = timezones
    .map(({ name, offset }) => {
      const local = new Date(now.getTime() + offset * 3_600_000);
      return `  • ${name}: ${local.toUTCString().replace(" GMT", "")}`;
    })
    .join("\n");

  return `CURRENT DATE & TIME (live — computed at server request time for this specific user request):
  UTC: ${now.toUTCString()}
  ISO: ${now.toISOString()}

LOCAL TIMES RIGHT NOW:
${tzLines}`;
}

// ── Resolve relative dates in search results ─────────────────────────────────
function resolveRelativeDates(text: string, now: Date): string {
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const fmt = (d: Date) =>
    `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const today     = new Date(now); today.setHours(12,0,0,0);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const nextWeek  = new Date(today); nextWeek.setDate(today.getDate() + 7);

  return text
    .replace(/\btomorrow\b/gi,   `tomorrow [= ${fmt(tomorrow)}]`)
    .replace(/\btoday\b/gi,      `today [= ${fmt(today)}]`)
    .replace(/\byesterday\b/gi,  `yesterday [= ${fmt(yesterday)}]`)
    .replace(/\bnext week\b/gi,  `next week [= week of ${fmt(nextWeek)}]`);
}

// ── Serper web search ────────────────────────────────────────────────────────
interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}
interface SerperResponse {
  organic?: SerperResult[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
  knowledgeGraph?: { description?: string; title?: string };
  topStories?: Array<{ title: string; snippet?: string; date?: string; link: string }>;
}

async function searchSerper(
  query: string,
  apiKey: string,
  type: "search" | "news" = "search"
): Promise<SerperResponse> {
  const endpoint = type === "news"
    ? "https://google.serper.dev/news"
    : "https://google.serper.dev/search";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8, gl: "in", hl: "en" }),
  });
  if (!res.ok) return {};
  return res.json();
}

function formatResults(data: SerperResponse): string {
  const parts: string[] = [];

  if (data.answerBox?.answer) {
    parts.push(`[DIRECT ANSWER] ${data.answerBox.answer}`);
  } else if (data.answerBox?.snippet) {
    parts.push(`[FEATURED SNIPPET] ${data.answerBox.snippet}`);
  }

  if (data.knowledgeGraph?.description) {
    parts.push(`[KNOWLEDGE GRAPH] ${data.knowledgeGraph.description}`);
  }

  if (data.topStories?.length) {
    const stories = data.topStories
      .slice(0, 4)
      .map((s) => `  • ${s.title}${s.date ? ` (${s.date})` : ""}${s.snippet ? `: ${s.snippet}` : ""}`)
      .join("\n");
    parts.push(`[TOP NEWS]\n${stories}`);
  }

  if (data.organic?.length) {
    const organics = data.organic
      .slice(0, 5)
      .map((r) => `  • ${r.title}${r.date ? ` (${r.date})` : ""}: ${r.snippet}`)
      .join("\n");
    parts.push(`[WEB RESULTS]\n${organics}`);
  }

  return parts.join("\n\n");
}

async function webSearch(query: string, apiKey: string, now: Date): Promise<string> {
  // Run organic search + news search in parallel for maximum coverage
  const [organic, news] = await Promise.all([
    searchSerper(query, apiKey, "search").catch(() => ({})),
    searchSerper(query, apiKey, "news").catch(() => ({})),
  ]);

  const combined = [
    formatResults(organic as SerperResponse),
    formatResults(news as SerperResponse),
  ]
    .filter(Boolean)
    .join("\n\n--- NEWS ---\n\n");

  return resolveRelativeDates(combined, now);
}

// ── Smart query builder ──────────────────────────────────────────────────────
// Builds a better search query than just the raw user text.
function buildSearchQuery(userText: string, now: Date): string {
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const dateStr = `${MONTHS[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
  const year    = now.getFullYear();

  let q = userText
    .replace(/\b(please|can you|could you|tell me|hey|hi|hello)\b/gi, "")
    .trim();

  // For sports schedule queries, always append current date for freshness
  if (/\b(ipl|cricket|match|schedule|fixture|next game|upcoming)\b/i.test(q)) {
    q = `IPL ${year} next match schedule ${dateStr}`;
  } else if (/\b(nba|basketball)\b/i.test(q) && /\b(next|schedule|fixture)\b/i.test(q)) {
    q = `NBA ${year} next game schedule ${dateStr}`;
  } else if (/\b(weather|forecast)\b/i.test(q)) {
    // keep as is — location + weather is good enough
  } else {
    // append year for freshness on news/current events
    if (!/\d{4}/.test(q)) q = `${q} ${year}`;
  }

  return q;
}

// ── Real-time query detection ────────────────────────────────────────────────
const REALTIME_PATTERNS = [
  /\b(schedule|fixture|match|game|next|upcoming|when is|when does|when will)\b/i,
  /\b(ipl|nba|nfl|cricket|football|soccer|tennis|f1|formula.?1|world cup|champions league)\b/i,
  /\b(price|stock|crypto|bitcoin|eth|rate|exchange)\b/i,
  /\b(weather|temperature|forecast|rain|sunny)\b/i,
  /\b(news|latest|breaking|current|today|right now|live)\b/i,
  /\b(who (is|was|won|leads)|who (is|are) currently)\b/i,
  /\b(standings|ranking|table|result|score)\b/i,
  /\b(election|poll|vote|government|president|prime minister)\b/i,
];

function needsWebSearch(messages: Message[]): boolean {
  const last = messages[messages.length - 1];
  if (last?.role !== "user") return false;
  return REALTIME_PATTERNS.some((p) => p.test(last.content));
}

// ── Build system prompt ──────────────────────────────────────────────────────
function buildSystemPrompt(dateCtx: string, searchResults?: string): string {
  const searchCtx = searchResults
    ? `\n=== LIVE WEB SEARCH RESULTS (fetched right now) ===\n${searchResults}\n=== END SEARCH RESULTS ===\n\nINSTRUCTION: Use the above search results to answer. If results mention "today [= DATE]", "tomorrow [= DATE]" etc., those bracket values are the EXACT calendar dates — always use them in your answer.`
    : "";

  return `${SYSTEM_PROMPT}

[INTERNAL REFERENCE — DO NOT OUTPUT THIS TO THE USER]
${dateCtx}
[END INTERNAL REFERENCE]
${searchCtx}

ABSOLUTE RULES (never break these):
1. The date/time block above is for your INTERNAL USE ONLY. NEVER recite or display the timezone table to the user. Only use it to answer specific date/time questions.
2. If a user asks "what time is it in Miami?" — answer with just that one city's time in plain conversational language. Do NOT list all timezones.
3. If a user greets you (hi, hello, hey) — respond naturally and briefly. Never mention the date/time unless they ask.
4. When answering time questions, read the exact time from the LOCAL TIMES block above and state it directly and concisely.
5. When search results contain "tomorrow [= 29 April 2026]" — use that exact date in your answer.
6. Never say "I couldn't find" if search results are present — extract and report what's available.
7. Prioritize search results over your training data for any real-time facts.`;
}

// ── Groq streaming ────────────────────────────────────────────────────────────
async function streamFromGroq(messages: Message[], systemPrompt: string): Promise<Response> {
  return fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
      max_tokens: MAX_TOKENS,
      stream: true,
    }),
  });
}

// ── OpenRouter fallback ───────────────────────────────────────────────────────
async function streamFromOpenRouter(messages: Message[], systemPrompt: string): Promise<Response> {
  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://hailey-chat.app",
      "X-Title": "Hailey",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODELS[0],
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
      max_tokens: MAX_TOKENS,
      stream: true,
    }),
  });
}

// ── SSE transform ─────────────────────────────────────────────────────────────
// Uses a manual ReadableStream pump — pipeThrough is unreliable on Vercel Edge
// and causes truncated / garbled responses after the first chunk.
function createStreamingResponse(upstream: Response, modelUsed: "groq" | "openrouter"): Response {
  const body = upstream.body;
  if (!body) return new Response("No response body", { status: 500 });

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let headerSent = false;
  let buffer = "";

  const readable = new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta != null) {
                if (!headerSent) {
                  controller.enqueue(encoder.encode(`__MODEL__:${modelUsed}\n`));
                  headerSent = true;
                }
                controller.enqueue(encoder.encode(delta));
              }
            } catch { /* skip malformed chunk */ }
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Model-Used": modelUsed,
      "Cache-Control": "no-cache",
    },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { messages } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const now = new Date(); // single source of truth for this request
    const dateCtx = buildDateContext(); // uses now internally

    // Step 1: Web search if needed
    let searchResults: string | undefined;
    const serperKey = process.env.SERPER_API_KEY;
    const shouldSearch = needsWebSearch(messages);

    if (shouldSearch && serperKey && serperKey !== "your_serper_api_key_here") {
      try {
        const lastUserMsg = messages[messages.length - 1].content;
        const searchQuery = buildSearchQuery(lastUserMsg, now);
        searchResults = await webSearch(searchQuery, serperKey, now);
      } catch {
        // Search failed — proceed without results
      }
    }

    // Step 2: Build the system prompt
    const systemPrompt = buildSystemPrompt(dateCtx, searchResults);

    // Step 3: Try Groq first
    let response = await streamFromGroq(messages, systemPrompt);

    if (response.status === 429) {
      response = await streamFromOpenRouter(messages, systemPrompt);
      if (!response.ok) {
        return NextResponse.json(
          { error: "All AI providers are rate-limited. Please try again in a moment." },
          { status: 503 }
        );
      }
      return createStreamingResponse(response, "openrouter");
    }

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed?.error?.message ?? parsed?.error ?? errText;
      } catch { /* keep raw */ }
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    return createStreamingResponse(response, "groq");
  } catch (error) {
    console.error("[/api/chat]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
