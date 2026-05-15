import { describe, expect, it } from "vitest";
import { safeHref } from "@/lib/safeHref";

describe("safeHref", () => {
  it("passes through http(s) URLs", () => {
    expect(safeHref("https://linear.app/x/issue/ENG-1")).toBe(
      "https://linear.app/x/issue/ENG-1"
    );
    expect(safeHref("http://example.com")).toBe("http://example.com");
  });

  it("rejects javascript: and data: schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(
      safeHref("data:text/html,<script>alert(1)</script>")
    ).toBeUndefined();
  });

  it("returns undefined for empty or unparseable input", () => {
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});
