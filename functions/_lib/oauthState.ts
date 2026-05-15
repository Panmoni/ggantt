// Length-independent, constant-time comparison for the OAuth state token.
// The comparison must not short-circuit on the first differing byte (which
// would leak the matched prefix length through timing) nor on differing
// lengths.
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length === bb.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff += (ab[i] ?? 0) === (bb[i] ?? 0) ? 0 : 1;
  }
  return diff === 0;
}
