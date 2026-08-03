import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const identity = readFileSync(
  resolve(root, "supabase/migrations/202608030001_phase4_identity_tenancy.sql"),
  "utf8",
);
const audit = readFileSync(
  resolve(root, "supabase/migrations/202608030002_phase4_identity_audit.sql"),
  "utf8",
);
const security = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608030003_phase4_security_functions_rls.sql",
  ),
  "utf8",
);

describe("Phase 4 migration security contract", () => {
  it("creates audit storage before functions reference it", () => {
    expect(audit).toContain("create table public.audit_events");
    expect(security).toContain("insert into public.audit_events");
    expect(identity).not.toContain("audit_events");
  });

  it("hardens every security definer with an empty search path", () => {
    const functions = security.split("create function ").slice(1);
    const definers = functions.filter((definition) =>
      definition.includes("security definer"),
    );
    expect(definers.length).toBeGreaterThan(0);
    for (const definition of definers)
      expect(definition).toContain("set search_path = ''");
  });

  it("removes direct tenant and system-column mutation privileges", () => {
    expect(security).toContain(
      "grant update (display_name) on table public.profiles",
    );
    expect(security).toContain(
      "grant update (name) on table public.organizations",
    );
    expect(security).not.toMatch(
      /grant insert on table public\.organizations/i,
    );
    expect(security).not.toMatch(
      /grant (insert|update|delete) on table public\.organization_memberships/i,
    );
    expect(security).not.toMatch(
      /grant (insert|update|delete) on table public\.audit_events/i,
    );
  });

  it("uses verified auth identity rather than client identity parameters", () => {
    expect(security).toContain("caller_id uuid := auth.uid()");
    expect(security).not.toMatch(
      /create_organization\s*\([^)]*(user_id|created_by|role)/i,
    );
  });
});
