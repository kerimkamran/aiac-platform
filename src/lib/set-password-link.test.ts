import { describe, expect, it } from "vitest";
import { confirmPath, EMAIL_LINK_MAX_AGE_SECONDS, isEmailLinkSession, isTokenHash, parseLinkType, readIncomingLink, readTokenClaims } from "./set-password-link";

// A JWT-shaped string with the given payload. The signature is never read.
function token(payload: object): string {
  const part = (v: object) =>
    Buffer.from(JSON.stringify(v), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.signature`;
}

describe("parseLinkType", () => {
  it("accepts the link types Vantage emails can carry", () => {
    for (const type of ["recovery", "invite", "magiclink", "email", "signup"]) expect(parseLinkType(type)).toBe(type);
  });
  it("rejects anything else, including email_change", () => {
    for (const raw of ["email_change", "", "RECOVERY", "recovery ", null, undefined]) expect(parseLinkType(raw)).toBeNull();
  });
});

describe("isTokenHash", () => {
  it("accepts hex hashes and the pkce_ prefixed form", () => {
    expect(isTokenHash("a3f1c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c")).toBe(true);
    expect(isTokenHash("pkce_a3f1c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718")).toBe(true);
  });
  it("rejects empty, short, long or unsafe values", () => {
    expect(isTokenHash("")).toBe(false);
    expect(isTokenHash(undefined)).toBe(false);
    expect(isTokenHash("abc")).toBe(false);
    expect(isTokenHash("a".repeat(257))).toBe(false);
    expect(isTokenHash("abcdef0123456789/../../etc")).toBe(false);
    expect(isTokenHash("abcdef0123456789&type=invite")).toBe(false);
  });
});

describe("confirmPath", () => {
  it("builds the server-verified link path", () => {
    expect(confirmPath("abcdef0123456789", "recovery")).toBe("/auth/confirm?token_hash=abcdef0123456789&type=recovery");
  });
});

describe("readIncomingLink", () => {
  it("reads session tokens from the address-bar fragment", () => {
    expect(readIncomingLink("#access_token=aaa&expires_in=3600&refresh_token=bbb&token_type=bearer&type=recovery", "")).toEqual({
      kind: "tokens",
      accessToken: "aaa",
      refreshToken: "bbb",
    });
  });
  it("needs both tokens", () => {
    expect(readIncomingLink("#access_token=aaa", "")).toEqual({ kind: "none" });
  });
  it("reports an expired or used link, from the fragment or the query", () => {
    expect(readIncomingLink("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid", "")).toEqual({ kind: "error" });
    expect(readIncomingLink("", "?error=access_denied&error_code=otp_expired")).toEqual({ kind: "error" });
  });
  it("reads a PKCE code from the query", () => {
    expect(readIncomingLink("", "?code=1234-abcd")).toEqual({ kind: "code", code: "1234-abcd" });
  });
  it("prefers an error over a code", () => {
    expect(readIncomingLink("", "?code=1234&error=access_denied")).toEqual({ kind: "error" });
  });
  it("finds nothing on a plain visit, or when only our own link=expired flag is present", () => {
    expect(readIncomingLink("", "")).toEqual({ kind: "none" });
    expect(readIncomingLink("#", "?link=expired")).toEqual({ kind: "none" });
  });
});

const NOW = 1_800_000_000;

describe("readTokenClaims", () => {
  it("reads the account and how the session started, including non-Latin email addresses", () => {
    expect(readTokenClaims(token({ sub: "u1", email: "ayşə@example.az", amr: [{ method: "otp", timestamp: NOW }] }))).toEqual({
      sub: "u1",
      email: "ayşə@example.az",
      amr: [{ method: "otp", timestamp: NOW }],
    });
  });
  it("returns null for something that is not a token", () => {
    expect(readTokenClaims("not-a-token")).toBeNull();
    expect(readTokenClaims("")).toBeNull();
  });
});

describe("isEmailLinkSession", () => {
  it("accepts a session just started from an email link", () => {
    for (const method of ["otp", "recovery", "invite", "magiclink", "email/signup"]) {
      expect(isEmailLinkSession(token({ sub: "u1", amr: [{ method, timestamp: NOW - 60 }] }), NOW)).toBe(true);
    }
  });
  it("accepts an email-link method beside a password", () => {
    expect(isEmailLinkSession(token({ amr: [{ method: "password", timestamp: NOW - 600 }, { method: "otp", timestamp: NOW - 60 }] }), NOW)).toBe(true);
  });
  it("refuses a password sign-in and other methods", () => {
    for (const method of ["password", "oauth", "totp", "anonymous", "sso/saml"]) {
      expect(isEmailLinkSession(token({ sub: "u1", amr: [{ method, timestamp: NOW - 60 }] }), NOW)).toBe(false);
    }
  });
  it("refuses an email-link session older than a day, or dated in the future", () => {
    expect(isEmailLinkSession(token({ amr: [{ method: "otp", timestamp: NOW - EMAIL_LINK_MAX_AGE_SECONDS - 1 }] }), NOW)).toBe(false);
    expect(isEmailLinkSession(token({ amr: [{ method: "otp", timestamp: NOW + 3600 }] }), NOW)).toBe(false);
  });
  it("refuses tokens without a dated amr claim, and things that are not tokens", () => {
    expect(isEmailLinkSession(token({ sub: "u1" }), NOW)).toBe(false);
    expect(isEmailLinkSession(token({ amr: [] }), NOW)).toBe(false);
    expect(isEmailLinkSession(token({ amr: ["otp"] }), NOW)).toBe(false);
    expect(isEmailLinkSession("not-a-token", NOW)).toBe(false);
    expect(isEmailLinkSession("", NOW)).toBe(false);
  });
});
