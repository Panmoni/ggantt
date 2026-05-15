import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto.ts";

const SECRET = "test-cookie-secret-please-rotate";

describe("encryptToken / decryptToken", () => {
  it("round-trips the token with the same secret", async () => {
    const token = `lin_oauth_${"x".repeat(64)}`;
    const sealed = await encryptToken(token, SECRET);
    expect(sealed).not.toContain(token);
    expect(await decryptToken(sealed, SECRET)).toBe(token);
  });

  it("produces a fresh IV each time (ciphertext is non-deterministic)", async () => {
    const a = await encryptToken("same", SECRET);
    const b = await encryptToken("same", SECRET);
    expect(a).not.toBe(b);
    expect(await decryptToken(b, SECRET)).toBe("same");
  });

  it("returns undefined for a wrong/rotated secret", async () => {
    const sealed = await encryptToken("secret-data", SECRET);
    expect(await decryptToken(sealed, "different-secret")).toBeUndefined();
  });

  it("returns undefined for tampered or garbage input", async () => {
    const sealed = await encryptToken("secret-data", SECRET);
    const tampered = `${sealed.slice(0, -2)}AA`;
    expect(await decryptToken(tampered, SECRET)).toBeUndefined();
    expect(await decryptToken("!!!not-base64!!!", SECRET)).toBeUndefined();
    expect(await decryptToken("", SECRET)).toBeUndefined();
  });
});
