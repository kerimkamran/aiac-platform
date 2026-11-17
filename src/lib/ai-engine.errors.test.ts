import { describe, expect, it, vi } from "vitest";
import { friendlyProviderError } from "./ai-engine";

describe("friendlyProviderError", () => {
  it("never repeats the provider body and names the next step", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "org-1234 key sk-live-abc";
    for (const [status, hint] of [
      [401, "AI & data"],
      [403, "AI & data"],
      [429, "try again"],
      [503, "Try again"],
      [400, "code 400"],
    ] as const) {
      const err = friendlyProviderError("Claude", status, secret);
      expect(err.message).not.toContain(secret);
      expect(err.message.toLowerCase()).toContain(hint.toLowerCase());
    }
  });
});
