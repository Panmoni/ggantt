// Returns true only when the allowlist is configured AND the email is on it.
// An unconfigured allowlist denies everyone (fail closed) so that forgetting
// to set ALLOWED_EMAILS can never silently open the app to the world.
export function isAllowed(
  allowList: string | undefined,
  email: string
): boolean {
  if (!allowList) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return allowList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
