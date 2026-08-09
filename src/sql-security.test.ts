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
const financialSchema = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608040001_phase5a_financial_schema.sql",
  ),
  "utf8",
);
const financialSecurity = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608040002_phase5a_financial_security.sql",
  ),
  "utf8",
);
const imports = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608040003_phase5a_transaction_imports.sql",
  ),
  "utf8",
);
const importStatusFix = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608040004_phase5a_import_status_enum_fix.sql",
  ),
  "utf8",
);
const budgetSchema = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608050001_phase5b_budget_obligation_schema.sql",
  ),
  "utf8",
);
const budgetSecurity = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608050002_phase5b_security_and_reserve.sql",
  ),
  "utf8",
);
const budgetWorkflows = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608050003_phase5b_budget_workflows.sql",
  ),
  "utf8",
);
const obligationWorkflows = readFileSync(
  resolve(
    root,
    "supabase/migrations/202608050004_phase5b_obligation_workflows.sql",
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

describe("Phase 5A financial security contract", () => {
  it("uses integer cents and tenant-safe composite foreign keys", () => {
    expect(financialSchema).toContain(
      "create table public.organization_financial_settings",
    );
    expect(financialSchema).toContain("amount_minor bigint");
    expect(financialSchema).toContain(
      "foreign key (organization_id, account_id)",
    );
    expect(financialSchema).toContain(
      "foreign key (organization_id, category_id)",
    );
    expect(financialSchema).not.toMatch(/double precision|real\b/i);
  });

  it("denies direct financial writes and permanent deletion", () => {
    expect(financialSecurity).toContain(
      "revoke all on table public.organization_financial_settings",
    );
    expect(financialSecurity).toContain(
      "create policy organization_financial_settings_select_officers",
    );
    expect(financialSecurity).toContain(
      "revoke all on table public.financial_transactions",
    );
    expect(financialSecurity).toContain(
      "grant select on table public.financial_transactions",
    );
    expect(financialSecurity).not.toMatch(
      /grant (insert|update|delete) on table public\.financial_transactions/i,
    );
    expect(financialSecurity).not.toMatch(
      /delete from public\.financial_transactions/i,
    );
  });

  it("hardens every new security definer", () => {
    for (const migration of [financialSecurity, imports, importStatusFix]) {
      const functions = migration
        .split(/create(?: or replace)? function /)
        .slice(1);
      const definers = functions.filter((definition) =>
        definition.includes("security definer"),
      );
      expect(definers.length).toBeGreaterThan(0);
      for (const definition of definers)
        expect(definition).toContain("set search_path = ''");
    }
  });

  it("derives financial actors from auth uid and rejects client actor parameters", () => {
    expect(financialSecurity).toContain("caller_id uuid := auth.uid()");
    expect(financialSecurity).not.toMatch(
      /create function public\.[^(]+\([^)]*(created_by|voided_by|imported_by)/i,
    );
    for (const migration of [imports, importStatusFix])
      expect(migration).not.toMatch(
        /create(?: or replace)? function public\.[^(]+\([^)]*(created_by|voided_by|imported_by)/i,
      );
  });

  it("keeps imports atomic and race protected", () => {
    expect(imports).toContain("pg_advisory_xact_lock");
    expect(imports).toContain("status = 'committed'");
    expect(imports).toContain("batch_row.status = 'committed'");
    expect(financialSchema).toContain("transaction_import_committed_file_idx");
  });

  it("uses valid unqualified SQL conditional expressions in atomic migrations", () => {
    for (const migration of [
      financialSchema,
      financialSecurity,
      imports,
      importStatusFix,
    ]) {
      expect(migration.trimStart()).toMatch(/^begin;/i);
      expect(migration.trimEnd()).toMatch(/commit;$/i);
      expect(migration).not.toMatch(
        /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/i,
      );
    }
  });

  it("keeps import batch status assignments strongly typed", () => {
    expect(
      importStatusFix.match(/::public\.import_batch_status/g),
    ).toHaveLength(4);
    expect(importStatusFix).toContain(
      "create or replace function public.create_transaction_import_preview",
    );
    expect(importStatusFix).toContain(
      "create or replace function public.resolve_transaction_import_duplicate",
    );
    expect(importStatusFix).toContain(
      "revoke all on function public.create_transaction_import_preview",
    );
  });
});

describe("Phase 5B budget and dashboard security contract", () => {
  it("uses integer cents, organization composite keys, and immutable histories", () => {
    expect(budgetSchema).toContain("create table public.organization_budgets");
    expect(budgetSchema).toContain("create table public.budget_revisions");
    expect(budgetSchema).toContain("create table public.financial_obligations");
    expect(budgetSchema).toContain(
      "create table public.minimum_reserve_history",
    );
    expect(budgetSchema).toContain("amount_minor bigint");
    expect(budgetSchema).toContain(
      "foreign key (organization_id, category_id, category_direction)",
    );
    expect(budgetSchema).not.toMatch(/double precision|real\b/i);
  });

  it("denies direct writes to every Phase 5B record", () => {
    for (const table of [
      "organization_budgets",
      "budget_revisions",
      "budget_allocations",
      "financial_obligations",
      "obligation_status_history",
      "minimum_reserve_history",
    ]) {
      expect(budgetSecurity).toContain(`revoke all on table public.${table}`);
      expect(budgetSecurity).toContain(`grant select on table public.${table}`);
      expect(budgetSecurity).not.toMatch(
        new RegExp(
          `grant (insert|update|delete) on table public\\.${table}`,
          "i",
        ),
      );
    }
  });

  it("hardens all public workflows and keeps private helpers unavailable", () => {
    for (const migration of [
      budgetSecurity,
      budgetWorkflows,
      obligationWorkflows,
    ]) {
      const functions = migration
        .split(/create(?: or replace)? function /)
        .slice(1);
      const definers = functions.filter((definition) =>
        definition.includes("security definer"),
      );
      expect(definers.length).toBeGreaterThan(0);
      for (const definition of definers)
        expect(definition).toContain("set search_path = ''");
    }
    expect(budgetWorkflows).toContain(
      "revoke all on function private.replace_draft_budget_allocations",
    );
    expect(budgetWorkflows).not.toMatch(
      /requested_(?:user|actor|created_by|role)/i,
    );
    expect(obligationWorkflows).not.toMatch(
      /requested_(?:user|actor|created_by|role)/i,
    );
  });

  it("keeps migration order atomic and valid from an empty database", () => {
    for (const migration of [
      budgetSchema,
      budgetSecurity,
      budgetWorkflows,
      obligationWorkflows,
    ]) {
      expect(migration.trimStart()).toMatch(/^begin;/i);
      expect(migration.trimEnd()).toMatch(/commit;$/i);
      expect(migration).not.toMatch(
        /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/i,
      );
    }
    expect(budgetSchema).toContain(
      "create table public.minimum_reserve_history",
    );
    expect(budgetSecurity).toContain(
      "create function public.set_minimum_cash_reserve",
    );
  });

  it("enforces versioning, effective-period exclusion, payment matching, and audit writes", () => {
    expect(budgetSchema).toContain("exclude using gist");
    expect(budgetSchema).toContain("budget_revisions_current_idx");
    expect(budgetWorkflows).toContain("requested_expected_version");
    expect(budgetWorkflows).toContain("status = 'superseded'");
    expect(obligationWorkflows).toContain(
      "transaction.amount_minor = obligation_row.amount_minor",
    );
    expect(obligationWorkflows).toContain("transaction.direction = 'expense'");
    expect(obligationWorkflows).toContain("transaction.status = 'posted'");
    for (const migration of [
      budgetSecurity,
      budgetWorkflows,
      obligationWorkflows,
    ])
      expect(migration).toContain("insert into public.audit_events");
  });
});
