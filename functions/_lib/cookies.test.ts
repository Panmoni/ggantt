import { describe, expect, it } from "vitest";
import { parseCookie, serializeCookie } from "./cookies.ts";

describe("parseCookie", () => {
  it("returns the named value, URL-decoded", () => {
    expect(parseCookie("a=1; ggantt_token=ab%20cd; b=2", "ggantt_token")).toBe(
      "ab cd"
    );
  });

  it("returns undefined for missing name or header", () => {
    expect(parseCookie(null, "ggantt_token")).toBeUndefined();
    expect(parseCookie("a=1; b=2", "ggantt_token")).toBeUndefined();
  });

  it("does not match a name that is only a value substring", () => {
    expect(parseCookie("xggantt_token=oops", "ggantt_token")).toBeUndefined();
    expect(parseCookie("=novalue", "")).toBeUndefined();
  });
});

describe("serializeCookie", () => {
  it("encodes value and emits the fixed security attributes", () => {
    expect(
      serializeCookie("ggantt_token", "a b", {
        maxAge: 60,
        sameSite: "Strict",
        secure: true,
      })
    ).toBe(
      "ggantt_token=a%20b; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=60"
    );
  });

  it("omits Secure off https and round-trips through parseCookie", () => {
    const c = serializeCookie("ggantt_token", "tok/en+v", {
      maxAge: 0,
      sameSite: "Lax",
      secure: false,
    });
    expect(c).toContain("SameSite=Lax");
    expect(c).not.toContain("Secure");
    const value = c.slice(0, c.indexOf(";"));
    expect(parseCookie(value, "ggantt_token")).toBe("tok/en+v");
  });
});
