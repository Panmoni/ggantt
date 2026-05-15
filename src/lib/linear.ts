export class UnauthenticatedError extends Error {
  constructor() {
    super("401");
    this.name = "UnauthenticatedError";
  }
}

interface GraphQLError {
  extensions?: { code?: string };
  message: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

export async function linearRequest<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const res = await fetch("/api/linear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    credentials: "same-origin",
  });

  if (res.status === 401) {
    throw new UnauthenticatedError();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const json = (await res.json()) as GraphQLResponse<TData>;
  if (json.errors && json.errors.length > 0) {
    const first = json.errors[0];
    if (first?.extensions?.code === "AUTHENTICATION_ERROR") {
      throw new UnauthenticatedError();
    }
    throw new Error(first?.message ?? "GraphQL error");
  }
  if (!json.data) {
    throw new Error("Empty GraphQL response");
  }
  return json.data;
}
