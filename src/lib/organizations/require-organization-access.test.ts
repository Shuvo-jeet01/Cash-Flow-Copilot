import { describe, expect, it } from "vitest";
import { UUID_PATTERN } from "@/lib/organizations/require-organization-access";

describe("organization route identifiers", () => {
  it("accepts valid UUID organization identifiers", () => {
    expect(UUID_PATTERN.test("10000000-0000-4000-8000-000000000001")).toBe(
      true,
    );
  });

  it("rejects malformed or injected organization context", () => {
    expect(UUID_PATTERN.test("../another-organization")).toBe(false);
    expect(
      UUID_PATTERN.test("10000000-0000-4000-8000-000000000001?role=treasurer"),
    ).toBe(false);
  });
});
