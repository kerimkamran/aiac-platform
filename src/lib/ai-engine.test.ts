import { afterEach, describe, expect, it, vi } from "vitest";
import { AiOutputError, callEngine, extractJson } from "./ai-engine";

afterEach(() => vi.unstubAllGlobals());

describe("extractJson", () => {
  it("reads JSON inside a markdown fence", () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("throws a typed error for a truncated object", () => {
    expect(() => extractJson('{"sections": [{"competencyCode": "X"')).toThrow(AiOutputError);
  });
});

describe("callEngine cut-off detection", () => {
  it("reports a Claude response that stopped at the output limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }), { status: 200 }))
    );
    await expect(callEngine("claude", "k", "sys", "user")).rejects.toMatchObject({ code: "cut_off" });
  });

  it("reports an OpenAI-compatible response with finish_reason length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{" } }] }), { status: 200 }))
    );
    await expect(callEngine("kimi", "k", "sys", "user")).rejects.toMatchObject({ code: "cut_off" });
  });

  it("returns the text and usage for a complete Claude response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 10, output_tokens: 20 } }),
          { status: 200 }
        )
      )
    );
    const r = await callEngine("claude", "k", "sys", "user");
    expect(r.text).toBe("{}");
    expect(r.usage).toMatchObject({ inputTokens: 10, outputTokens: 20 });
  });
});
