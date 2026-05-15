# ggantt

A hand-rolled SVG Gantt chart over your Linear issues. Read issues, filter/group them, and drag a bar's right edge to set/extend its due date — written back to Linear live.

## Stack

- Vite + React 19 + TypeScript, Tailwind v4
- TanStack Query for fetch/cache/optimistic mutations
- Cloudflare Pages + Pages Functions (OAuth + Linear GraphQL proxy)
- No Gantt library — the chart is plain SVG

## Local dev

```bash
pnpm install
pnpm dev             # vite + wrangler together, http://localhost:7373
pnpm check           # typecheck + biome/ultracite lint
```

`pnpm dev` runs vite (internal port 7374) behind `wrangler pages dev` (browser
port 7373) via `concurrently -k`, so Ctrl-C kills both — no orphaned port.
Requires Node ≥22 and pnpm ≥10.

Secrets live in `.dev.vars` (gitignored): `LINEAR_CLIENT_ID`,
`LINEAR_CLIENT_SECRET`, `OAUTH_REDIRECT_URI=http://localhost:7373/oauth/callback`,
`ALLOWED_EMAILS`, and `COOKIE_SECRET` (`openssl rand -base64 32` — encrypts the
token cookie; if unset the OAuth/proxy endpoints return 500). The Linear OAuth
app's Callback URL list must include that exact callback URL.

## Access control (single-user / private deployment)

This deployment is private. Two independent gates restrict it to you:

1. **App-level allowlist (in this repo).** After Linear OAuth, the callback
   queries the Linear `viewer` and only sets a session cookie if that account's
   email is on the comma-separated `ALLOWED_EMAILS` env var. It **fails closed**:
   if `ALLOWED_EMAILS` is unset, *no one* can sign in. A stranger's OAuth grant
   is discarded, so they cannot use this deployment even against their own
   workspace. Set it locally in `.dev.vars` and in production as a Pages env var:

   ```
   ALLOWED_EMAILS=you@example.com
   ```

2. **Cloudflare Access (edge, set up in the Cloudflare dashboard).** Gate the
   whole Pages app before any code runs:

   - Zero Trust → Access → Applications → **Add an application** → *Self-hosted*
   - Application domain: your Pages domain (e.g. `ggantt.example.com`)
   - Add a policy: Action **Allow**, Include → **Emails** → your email
   - Identity / login method: **One-time PIN** (email) is enough for one user
   - Free tier covers a single user.

   With Access on, you authenticate to Cloudflare first; Linear OAuth then runs
   behind that gate. The app allowlist remains as defence-in-depth.

## Known limitation: start dates are read-only

**This is intentional and a Linear constraint, not a bug.**

A Linear issue has no user-settable start date. `startedAt` is a system
timestamp Linear sets automatically the first time an issue moves into a
"started" (In Progress) workflow state; the API will not let you write it. The
only editable date on an issue is `dueDate`.

Consequently:

- A bar's **left edge** = `startedAt ?? createdAt` (informational; not editable).
- A bar's **right edge** = `dueDate` — drag it to change it; persists to Linear.
- Issues with no `dueDate` render as dashed translucent stubs; drag the right
  edge to give them their first due date.

The Gantt therefore shows *reality* ("started 3 days ago, due in 2") rather than
a freely-editable plan. If per-issue editable start dates are ever needed, the
options are: a `start: YYYY-MM-DD` token parsed from the issue description, or an
external store (e.g. Supabase) keyed by issue id. Both were deliberately punted.

## Deploy (Cloudflare Pages)

```bash
pnpm deploy          # build + wrangler pages deploy dist
```

Set `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`,
`OAUTH_REDIRECT_URI=https://<domain>/oauth/callback`, `ALLOWED_EMAILS`, and
`COOKIE_SECRET` as Pages production env vars, and add that callback URL to the
Linear OAuth app. **If `ALLOWED_EMAILS` is missing in production, sign-in is
disabled for everyone** (fail closed); **if `COOKIE_SECRET` is missing, the
OAuth callback and the `/api/linear` proxy return 500** — set both before/with
your first deploy.

## Security & operations

- **Token at rest:** the Linear token is AES-256-GCM encrypted with
  `COOKIE_SECRET` before it is written to an HttpOnly/Secure/`SameSite=Strict`
  cookie, capped to a 7-day max age. Rotate `COOKIE_SECRET` to invalidate every
  live session (users just log in again).
- **Sign out:** `/oauth/logout` clears the cookie and best-effort revokes the
  token at Linear. Linked from the app header.
- **HTTP hardening:** `public/_headers` ships a strict CSP (with a
  `report-to`/`report-uri` → `/csp-report`), HSTS, `frame-ancestors 'none'`,
  `Permissions-Policy`, and `X-Robots-Tag: noindex`.
- **Proxy scope:** `/api/linear` only forwards ggantt's six named GraphQL
  operations; anything else is rejected with 403.
- **Observability:** Functions emit one-line JSON logs (`{level,event,ts,…}`).
  Tail them with `wrangler pages deployment tail` or ship them off-platform by
  enabling **Cloudflare Logpush** (Pages → Settings → Logpush) — no app change
  needed. A spike of `csp.violation` / `proxy.operation.rejected` events is the
  early signal that something got past the client-side defenses.
- **CI:** `.github/workflows/deploy.yml` runs `pnpm run check` (typecheck +
  lint + tests) and only deploys if it passes.

## Feature requests & bug reports

Found a bug or want a feature? [File a GitHub issue](../../issues/new).

Need something like this built for you? I'm available for hire — email
<george@panmoni.com>.
