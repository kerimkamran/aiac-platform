import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inviteRedirectUrl, siteUrl } from "./site-url";

const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com//";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    expect(siteUrl()).toBe("https://example.com");
  });

  it("falls back to the production domain, then the deployment URL", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "https://prod.vercel.app";
    process.env.VERCEL_URL = "preview-123.vercel.app";
    expect(siteUrl()).toBe("https://prod.vercel.app");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("https://preview-123.vercel.app");
  });

  it("uses localhost when nothing is configured", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("builds the invite callback path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(inviteRedirectUrl()).toBe("https://example.com/invite/callback");
  });
});
