interface Env {
  LINEAR_CLIENT_ID: string;
  OAUTH_REDIRECT_URI: string;
}

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const state = crypto.randomUUID();

  const url = new URL("https://linear.app/oauth/authorize");
  url.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read,write");
  url.searchParams.set("state", state);

  const isHttps = new URL(request.url).protocol === "https:";
  const secure = isHttps ? "; Secure" : "";

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `ggantt_oauth_state=${state}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
};
