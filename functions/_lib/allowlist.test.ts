import { describe, expect, it } from "vitest";
import { isAllowed } from "./allowlist.ts";

describe("isAllowed", () => {
  it("fails closed when the allowlist is unset or empty", () => {
    expect(isAllowed(undefined, "me@example.com")).toBe(false);
    expect(isAllowed("", "me@example.com")).toBe(false);
    expect(isAllowed("   ", "me@example.com")).toBe(false);
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(isAllowed("Me@Example.com", "me@example.com")).toBe(true);
    expect(isAllowed(" a@x.io , b@y.io ", "B@Y.IO")).toBe(true);
  });

  it("does not match a non-listed email", () => {
    expect(isAllowed("a@x.io,b@y.io", "c@z.io")).toBe(false);
  });

  it("does not treat an empty entry as a wildcard", () => {
    expect(isAllowed("a@x.io,,", "")).toBe(false);
    expect(isAllowed(",", "")).toBe(false);
  });
});
