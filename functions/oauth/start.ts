import { serializeCookie } from "../_lib/cookies.ts";

interface Env {
  LINEAR_CLIENT_ID: string;
  OAUTH_REDIRECT_URI: string;
}

const STATE_TTL = 600;

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const state = crypto.randomUUID();

  const url = new URL("https://linear.app/oauth/authorize");
  url.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read,write");
  url.searchParams.set("state", state);

  const secure = new URL(request.url).protocol === "https:";

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      // Lax (not Strict): this cookie must survive the cross-site top-level
      // redirect back from linear.app to /oauth/callback.
      "Set-Cookie": serializeCookie("ggantt_oauth_state", state, {
        maxAge: STATE_TTL,
        sameSite: "Lax",
        secure,
      }),
    },
  });
};
