import { describe, expect, it } from "vitest";
import { isDoneCancelledOrDuplicate } from "@/lib/status";

describe("isDoneCancelledOrDuplicate", () => {
  it("hides completed and canceled status types", () => {
    expect(
      isDoneCancelledOrDuplicate({ name: "Done", type: "completed" })
    ).toBe(true);
    expect(
      isDoneCancelledOrDuplicate({ name: "Cancelled", type: "canceled" })
    ).toBe(true);
    // Linear's "Duplicate" workflow state is of type "canceled".
    expect(
      isDoneCancelledOrDuplicate({ name: "Duplicate", type: "canceled" })
    ).toBe(true);
  });

  it("matches by name as a safety net regardless of type", () => {
    expect(
      isDoneCancelledOrDuplicate({ name: "Duplicate", type: "backlog" })
    ).toBe(true);
    expect(
      isDoneCancelledOrDuplicate({ name: " done ", type: "started" })
    ).toBe(true);
  });

  it("keeps active statuses visible", () => {
    expect(
      isDoneCancelledOrDuplicate({ name: "In Progress", type: "started" })
    ).toBe(false);
    expect(
      isDoneCancelledOrDuplicate({ name: "Backlog", type: "backlog" })
    ).toBe(false);
    expect(
      isDoneCancelledOrDuplicate({ name: "Planned", type: "planned" })
    ).toBe(false);
  });
});
