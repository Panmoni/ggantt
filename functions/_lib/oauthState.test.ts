import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "./oauthState.ts";

describe("timingSafeEqual", () => {
  it("is true only for identical strings", () => {
    const uuid = crypto.randomUUID();
    expect(timingSafeEqual(uuid, uuid)).toBe(true);
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("is false for any difference, including length and prefixes", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("", "x")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("compares by bytes, not normalized form", () => {
    expect(timingSafeEqual("café", "cafe")).toBe(false);
  });
});
