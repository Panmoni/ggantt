import { describe, expect, it } from "vitest";
import { allowedOperation } from "./graphql.ts";

const wrap = (query: string) => JSON.stringify({ query });

describe("allowedOperation", () => {
  it("accepts each allow-listed named operation", () => {
    for (const op of [
      "query Viewer { viewer { id } }",
      "query Issues($first: Int!) { issues { nodes { id } } }",
      "mutation IssueSetDue($id: String!) { issueUpdate { success } }",
      "mutation IssueSetTitle($id: String!) { issueUpdate { success } }",
      "query Projects($first: Int!) { projects { nodes { id } } }",
      "mutation ProjectSetDates($id: String!) { projectUpdate { success } }",
    ]) {
      expect(allowedOperation(wrap(op))).toBe(true);
    }
  });

  it("rejects an unknown named operation", () => {
    expect(
      allowedOperation(
        wrap("mutation IssueDelete($id: String!) { issueDelete }")
      )
    ).toBe(false);
  });

  it("rejects anonymous operations and subscriptions", () => {
    expect(allowedOperation(wrap("{ viewer { id } }"))).toBe(false);
    expect(allowedOperation(wrap("query { viewer { id } }"))).toBe(false);
    expect(
      allowedOperation(wrap("subscription Viewer { viewer { id } }"))
    ).toBe(false);
  });

  it("rejects non-JSON or query-less bodies", () => {
    expect(allowedOperation("not json")).toBe(false);
    expect(allowedOperation(JSON.stringify({ notQuery: 1 }))).toBe(false);
    expect(allowedOperation(JSON.stringify({ query: 42 }))).toBe(false);
  });

  it("does not let an allowed name as a field smuggle a real op", () => {
    expect(
      allowedOperation(wrap("mutation Evil { Viewer little bobby tables }"))
    ).toBe(false);
  });

  it("rejects a second operation hidden behind an allowed first one", () => {
    expect(
      allowedOperation(
        wrap(
          'query Issues { issues { nodes { id } } } mutation Evil { issueDelete(id: "x") }'
        )
      )
    ).toBe(false);
  });

  it("rejects an operationName that points past the allowed op", () => {
    expect(
      allowedOperation(
        JSON.stringify({
          query: "query Issues { issues { nodes { id } } } mutation Wipe { x }",
          operationName: "Wipe",
        })
      )
    ).toBe(false);
    // Even a single allowed op is rejected if operationName disagrees.
    expect(
      allowedOperation(
        JSON.stringify({
          query: "query Issues { issues { nodes { id } } }",
          operationName: "Evil",
        })
      )
    ).toBe(false);
  });

  it("rejects batched (array) request bodies", () => {
    expect(
      allowedOperation(
        JSON.stringify([
          { query: "query Viewer { viewer { id } }" },
          { query: 'mutation Evil { issueDelete(id: "x") }' },
        ])
      )
    ).toBe(false);
  });
});
