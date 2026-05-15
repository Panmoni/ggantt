// Authenticated encryption for the Linear token before it is written to the
// cookie, so the raw read/write token is never at rest in the browser cookie
// jar even though the cookie is already HttpOnly. AES-256-GCM via Web Crypto
// (available identically in Cloudflare Workers and Node 20+). The key is
// derived from the COOKIE_SECRET env var by SHA-256.
//
// Rotating COOKIE_SECRET invalidates every existing cookie: decrypt returns
// undefined, the proxy answers 401, the user simply logs in again.

import { log } from "./log.ts";

const IV_BYTES = 12;

const B64_PLUS = /\+/g;
const B64_SLASH = /\//g;
const B64_PAD = /=+$/;
const B64URL_DASH = /-/g;
const B64URL_UNDERSCORE = /_/g;

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s)
    .replace(B64_PLUS, "-")
    .replace(B64_SLASH, "_")
    .replace(B64_PAD, "");
}

function b64urlDecode(str: string): Uint8Array {
  const bin = atob(
    str.replace(B64URL_DASH, "+").replace(B64URL_UNDERSCORE, "/")
  );
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(
  plaintext: string,
  secret: string
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext)
    )
  );
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  return b64urlEncode(packed);
}

// Returns undefined on any failure (wrong/rotated secret, tampered or
// truncated blob, garbage cookie) — callers treat that as unauthenticated.
export async function decryptToken(
  blob: string,
  secret: string
): Promise<string | undefined> {
  try {
    const packed = b64urlDecode(blob);
    if (packed.length <= IV_BYTES) {
      return;
    }
    const key = await deriveKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.slice(0, IV_BYTES) },
      key,
      packed.slice(IV_BYTES)
    );
    return new TextDecoder().decode(plaintext);
  } catch (err) {
    // Expected and benign: atob throws InvalidCharacterError and GCM auth
    // failure throws OperationError — both DOMException, both meaning
    // "garbage/rotated cookie -> re-login". Anything else is a real bug and
    // must not be swallowed silently.
    if (!(err instanceof DOMException)) {
      log("error", "crypto.decrypt.unexpected", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
}
