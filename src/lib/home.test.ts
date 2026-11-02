import { describe, expect, it } from "vitest";
import { homeFor, safeNextPath } from "./home";

describe("homeFor", () => {
  it("routes each role to its home", () => {
    expect(homeFor("candidate")).toBe("/candidate");
    expect(homeFor("decision_maker")).toBe("/decision");
    expect(homeFor("system_admin")).toBe("/admin");
    for (const r of ["recruiter", "hiring_manager", "hr_admin", "org_admin"]) expect(homeFor(r)).toBe("/staff");
  });
  it("sends unknown roles to sign-in", () => {
    expect(homeFor(undefined)).toBe("/login");
    expect(homeFor("nobody")).toBe("/login");
  });
});

describe("safeNextPath", () => {
  it("accepts same-site paths, with query strings", () => {
    expect(safeNextPath("/candidate/assessments/abc")).toBe("/candidate/assessments/abc");
    expect(safeNextPath("/staff/reports?x=1#top")).toBe("/staff/reports?x=1#top");
  });
  it("rejects other sites and tricks", () => {
    for (const bad of [
      "https://evil.example/x",
      "//evil.example",
      "/\\evil.example",
      "/%2F%2Fevil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\nLocation: x",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad as string)).toBeNull();
    }
  });
  it("never returns to the sign-in pages", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
    expect(safeNextPath("/forgot-password")).toBeNull();
  });
});
