// Shared engine layer for every AI call in the app: assessment generation,
// case-library generation, document extraction and (via extractJson) scoring.
//
// This file is a leaf: it imports nothing from the rest of src/lib, so the
// generation, case-library and case-upload modules can all depend on it
// without depending on each other (previously case-library imported from
// generation and case-upload reached back into both through dynamic imports).

export type EngineKey = "claude" | "fugu" | "kimi";

// Enough room for a full assessment (up to ~20 questions with four options
// each) without being cut off. The old limit of 4096 tokens silently truncated
// larger generations; cut-offs are now detected and reported instead.
export const CLAUDE_MAX_TOKENS = 16000;

export class AiOutputError extends Error {
  readonly code: "cut_off" | "no_content" | "bad_json" | "timeout";
  constructor(message: string, code: AiOutputError["code"]) {
    super(message);
    this.name = "AiOutputError";
    this.code = code;
  }
}

export type EngineUsage = { inputTokens?: number; outputTokens?: number; model: string };

export type EngineResult = { text: string; usage: EngineUsage };

// Staff-facing message. Never includes provider response bodies.
const CUT_OFF_MESSAGE =
  "The AI response was cut off before it finished, so nothing was saved. Try fewer competencies, or a shorter request, and generate again.";

// Maps a provider failure to a message staff can act on. The provider's own
// response body can name keys, models or account details, so it is logged on
// the server and never shown.
export function friendlyProviderError(label: string, status: number, body: string): Error {
  console.error(`${label} API error (${status}): ${body.slice(0, 300)}`);
  if (status === 401 || status === 403) return new Error(`${label} rejected the AI key. Ask an admin to check it in AI & data.`);
  if (status === 429) return new Error(`${label} is busy or over its limit. Wait a minute and try again.`);
  if (status >= 500) return new Error(`${label} had a problem on its side. Try again in a minute.`);
  return new Error(`${label} could not complete the request (code ${status}). Try again, or tell an admin if it keeps happening.`);
}

// Stops a stuck call before the page's own time limit does, so staff see a
// clear message instead of a blank failure, and retries do not pile up.
const ENGINE_TIMEOUT_MS = 240_000;
const TIMEOUT_MESSAGE = "The AI took too long to answer, so nothing was saved. Try again, or use fewer competencies.";

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AiOutputError(TIMEOUT_MESSAGE, "timeout");
    throw e;
  }
}

export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AiOutputError("No JSON object found in the model's response.", "bad_json");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiOutputError("The model's response was not valid JSON.", "bad_json");
  }
}

// Calls one engine with a system + user message and returns the raw text.
// Throws AiOutputError with code "cut_off" when the provider stopped because
// the output limit was reached, so callers can give a clear message instead of
// parsing half a document.
export async function callEngine(
  engine: EngineKey,
  apiKey: string,
  system: string,
  user: string,
  options: { maxTokens?: number } = {}
): Promise<EngineResult> {
  if (engine === "claude") {
    const model = "claude-sonnet-5";
    const res = await timedFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? CLAUDE_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw friendlyProviderError("Claude", res.status, await res.text().catch(() => ""));
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (data.stop_reason === "max_tokens") throw new AiOutputError(CUT_OFF_MESSAGE, "cut_off");
    const text = (data.content || []).find((c) => c.type === "text")?.text;
    if (!text) throw new AiOutputError("Claude returned no text content.", "no_content");
    return {
      text,
      usage: { model, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
    };
  }

  const isKimi = engine === "kimi";
  const url = isKimi ? "https://api.moonshot.ai/v1/chat/completions" : "https://api.sakana.ai/v1/chat/completions";
  const model = isKimi ? "moonshot-v1-32k" : "fugu";
  const label = isKimi ? "Kimi" : "Sakana Fugu";
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (isKimi) body.temperature = 0.4;
  else body.reasoning_effort = "high";

  const res = await timedFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw friendlyProviderError(label, res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new AiOutputError(CUT_OFF_MESSAGE, "cut_off");
  const text = choice?.message?.content;
  if (!text) throw new AiOutputError(`${label} returned no message content.`, "no_content");
  return {
    text,
    usage: { model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
  };
}

// The master prompt for writing cases and questions lives in case-playbook.ts.
export { CASE_DESIGN_PLAYBOOK } from "@/lib/case-playbook";
