export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole =
  "treasurer" | "president" | "executive" | "member";
export type MembershipStatus = "active" | "revoked";
export type FinancialAccountType =
  "checking" | "savings" | "cash" | "payment_platform" | "other";
export type FinancialRecordStatus = "active" | "archived";
export type TransactionDirection = "income" | "expense";
export type FinancialTransactionStatus = "posted" | "voided";
export type TransactionSource = "manual" | "csv_import";
export type ImportBatchStatus = "review" | "ready" | "committed" | "cancelled";
export type ImportRowStatus =
  | "valid"
  | "invalid"
  | "possible_duplicate"
  | "accepted_distinct"
  | "skipped_duplicate";
export type OrganizationBudgetStatus = "draft" | "active" | "closed";
export type BudgetRevisionStatus =
  "draft" | "effective" | "superseded" | "closed";
export type ObligationStatus = "expected" | "committed" | "paid" | "voided";

type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; display_name: string };
        Update: { display_name?: string };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: { name?: string };
        Relationships: [];
      };
      organization_memberships: ReadOnlyTable<{
        id: string;
        organization_id: string;
        user_id: string;
        role: OrganizationRole;
        status: MembershipStatus;
        created_at: string;
        updated_at: string;
      }>;
      organization_financial_settings: ReadOnlyTable<{
        organization_id: string;
        timezone: string;
        base_currency: string;
        configured_by: string;
        configured_at: string;
        updated_at: string;
        minimum_reserve_minor: number;
        reserve_version: number;
      }>;
      audit_events: ReadOnlyTable<{
        id: string;
        organization_id: string;
        actor_user_id: string | null;
        action: string;
        target_type: string;
        target_id: string;
        metadata: Json;
        occurred_at: string;
        request_id: string;
      }>;
      financial_accounts: ReadOnlyTable<{
        id: string;
        organization_id: string;
        name: string;
        account_type: FinancialAccountType;
        currency_code: string;
        status: FinancialRecordStatus;
        created_by: string;
        archived_by: string | null;
        archived_at: string | null;
        created_at: string;
        updated_at: string;
        version: number;
      }>;
      account_opening_balance_entries: ReadOnlyTable<{
        id: string;
        organization_id: string;
        account_id: string;
        amount_minor: number;
        effective_on: string;
        supersedes_entry_id: string | null;
        reason: string | null;
        created_by: string;
        created_at: string;
      }>;
      transaction_categories: ReadOnlyTable<{
        id: string;
        organization_id: string;
        name: string;
        direction: TransactionDirection;
        status: FinancialRecordStatus;
        created_by: string;
        archived_by: string | null;
        archived_at: string | null;
        created_at: string;
        updated_at: string;
        version: number;
      }>;
      financial_transactions: ReadOnlyTable<{
        id: string;
        organization_id: string;
        account_id: string;
        category_id: string;
        direction: TransactionDirection;
        amount_minor: number;
        currency_code: string;
        transaction_date: string;
        description: string;
        reference: string | null;
        note: string | null;
        status: FinancialTransactionStatus;
        source: TransactionSource;
        external_id: string | null;
        import_batch_id: string | null;
        import_row_number: number | null;
        idempotency_key: string;
        duplicate_fingerprint: string;
        replaces_transaction_id: string | null;
        created_by: string;
        created_at: string;
        voided_by: string | null;
        voided_at: string | null;
        void_reason: string | null;
        version: number;
      }>;
      transaction_import_batches: ReadOnlyTable<{
        id: string;
        organization_id: string;
        file_name: string;
        file_sha256: string;
        template_version: string;
        status: ImportBatchStatus;
        row_count: number;
        valid_count: number;
        invalid_count: number;
        duplicate_count: number;
        income_total_minor: number;
        expense_total_minor: number;
        created_by: string;
        created_at: string;
        committed_at: string | null;
        cancelled_at: string | null;
        version: number;
      }>;
      transaction_import_rows: ReadOnlyTable<{
        id: string;
        organization_id: string;
        batch_id: string;
        row_number: number;
        account_id: string | null;
        category_id: string | null;
        direction: TransactionDirection | null;
        amount_minor: number | null;
        currency_code: string | null;
        transaction_date: string | null;
        description: string | null;
        reference: string | null;
        note: string | null;
        external_id: string | null;
        row_hash: string | null;
        duplicate_fingerprint: string | null;
        status: ImportRowStatus;
        validation_errors: Json;
        duplicate_transaction_ids: string[];
        resolution_reason: string | null;
        created_at: string;
      }>;
      organization_budgets: ReadOnlyTable<{
        id: string;
        organization_id: string;
        status: OrganizationBudgetStatus;
        created_by: string;
        created_at: string;
        updated_at: string;
        closed_by: string | null;
        closed_at: string | null;
        close_reason: string | null;
        idempotency_key: string;
        version: number;
      }>;
      budget_revisions: ReadOnlyTable<{
        id: string;
        organization_id: string;
        budget_id: string;
        revision_number: number;
        name: string;
        start_on: string;
        end_on: string;
        currency_code: string;
        status: BudgetRevisionStatus;
        change_reason: string;
        created_by: string;
        created_at: string;
        approved_by: string | null;
        approved_at: string | null;
        superseded_at: string | null;
        idempotency_key: string;
      }>;
      budget_allocations: ReadOnlyTable<{
        id: string;
        organization_id: string;
        revision_id: string;
        category_id: string;
        direction: TransactionDirection;
        amount_minor: number;
        created_by: string;
        created_at: string;
      }>;
      financial_obligations: ReadOnlyTable<{
        id: string;
        organization_id: string;
        description: string;
        amount_minor: number;
        currency_code: string;
        due_on: string;
        category_id: string;
        category_direction: TransactionDirection;
        intended_account_id: string | null;
        reference: string | null;
        note: string | null;
        status: ObligationStatus;
        linked_transaction_id: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
        idempotency_key: string;
        version: number;
      }>;
      obligation_status_history: ReadOnlyTable<{
        id: string;
        organization_id: string;
        obligation_id: string;
        from_status: ObligationStatus | null;
        to_status: ObligationStatus;
        reason: string;
        linked_transaction_id: string | null;
        changed_by: string;
        changed_at: string;
        idempotency_key: string;
      }>;
      minimum_reserve_history: ReadOnlyTable<{
        id: string;
        organization_id: string;
        previous_amount_minor: number;
        new_amount_minor: number;
        currency_code: string;
        reason: string;
        changed_by: string;
        changed_at: string;
        idempotency_key: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      ensure_profile: {
        Args: { profile_display_name: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      create_organization: {
        Args: { organization_name: string };
        Returns: string;
      };
      configure_financial_context: {
        Args: { requested_organization_id: string; requested_timezone: string };
        Returns: undefined;
      };
      create_financial_account: {
        Args: {
          requested_organization_id: string;
          requested_name: string;
          requested_account_type: FinancialAccountType;
          requested_currency_code: string;
          requested_opening_amount_minor?: number | null;
          requested_opening_effective_on?: string | null;
        };
        Returns: string;
      };
      set_financial_account_status: {
        Args: {
          requested_organization_id: string;
          requested_account_id: string;
          requested_status: FinancialRecordStatus;
        };
        Returns: undefined;
      };
      replace_account_opening_balance: {
        Args: {
          requested_organization_id: string;
          requested_account_id: string;
          requested_current_entry_id: string;
          requested_amount_minor: number;
          requested_effective_on: string;
          requested_reason: string;
        };
        Returns: string;
      };
      create_transaction_category: {
        Args: {
          requested_organization_id: string;
          requested_name: string;
          requested_direction: TransactionDirection;
        };
        Returns: string;
      };
      set_transaction_category_status: {
        Args: {
          requested_organization_id: string;
          requested_category_id: string;
          requested_status: FinancialRecordStatus;
        };
        Returns: undefined;
      };
      create_manual_transaction: {
        Args: {
          requested_organization_id: string;
          requested_account_id: string;
          requested_category_id: string;
          requested_direction: TransactionDirection;
          requested_amount_minor: number;
          requested_transaction_date: string;
          requested_description: string;
          requested_reference: string | null;
          requested_note: string | null;
          requested_idempotency_key: string;
        };
        Returns: string;
      };
      void_financial_transaction: {
        Args: {
          requested_organization_id: string;
          requested_transaction_id: string;
          requested_reason: string;
        };
        Returns: undefined;
      };
      correct_financial_transaction: {
        Args: {
          requested_organization_id: string;
          requested_original_transaction_id: string;
          requested_account_id: string;
          requested_category_id: string;
          requested_direction: TransactionDirection;
          requested_amount_minor: number;
          requested_transaction_date: string;
          requested_description: string;
          requested_reference: string | null;
          requested_note: string | null;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: string;
      };
      create_transaction_import_preview: {
        Args: {
          requested_organization_id: string;
          requested_file_name: string;
          requested_file_sha256: string;
          requested_rows: Json;
        };
        Returns: string;
      };
      resolve_transaction_import_duplicate: {
        Args: {
          requested_organization_id: string;
          requested_batch_id: string;
          requested_row_id: string;
          requested_resolution: string;
          requested_reason: string;
        };
        Returns: undefined;
      };
      commit_transaction_import: {
        Args: { requested_organization_id: string; requested_batch_id: string };
        Returns: number;
      };
      cancel_transaction_import: {
        Args: { requested_organization_id: string; requested_batch_id: string };
        Returns: undefined;
      };
      set_minimum_cash_reserve: {
        Args: {
          requested_organization_id: string;
          requested_amount_minor: number;
          requested_expected_version: number;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
      create_organization_budget: {
        Args: {
          requested_organization_id: string;
          requested_name: string;
          requested_start_on: string;
          requested_end_on: string;
          requested_currency_code: string;
          requested_allocations: Json;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: string;
      };
      update_draft_budget: {
        Args: {
          requested_organization_id: string;
          requested_budget_id: string;
          requested_expected_version: number;
          requested_name: string;
          requested_start_on: string;
          requested_end_on: string;
          requested_currency_code: string;
          requested_allocations: Json;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
      activate_budget: {
        Args: {
          requested_organization_id: string;
          requested_budget_id: string;
          requested_expected_version: number;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
      revise_active_budget: {
        Args: {
          requested_organization_id: string;
          requested_budget_id: string;
          requested_expected_version: number;
          requested_name: string;
          requested_start_on: string;
          requested_end_on: string;
          requested_currency_code: string;
          requested_allocations: Json;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: string;
      };
      close_budget: {
        Args: {
          requested_organization_id: string;
          requested_budget_id: string;
          requested_expected_version: number;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
      create_financial_obligation: {
        Args: {
          requested_organization_id: string;
          requested_description: string;
          requested_amount_minor: number;
          requested_currency_code: string;
          requested_due_on: string;
          requested_category_id: string;
          requested_intended_account_id: string | null;
          requested_reference: string | null;
          requested_note: string | null;
          requested_initial_status: ObligationStatus;
          requested_idempotency_key: string;
        };
        Returns: string;
      };
      update_financial_obligation: {
        Args: {
          requested_organization_id: string;
          requested_obligation_id: string;
          requested_expected_version: number;
          requested_description: string;
          requested_amount_minor: number;
          requested_currency_code: string;
          requested_due_on: string;
          requested_category_id: string;
          requested_intended_account_id: string | null;
          requested_reference: string | null;
          requested_note: string | null;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
      transition_financial_obligation: {
        Args: {
          requested_organization_id: string;
          requested_obligation_id: string;
          requested_expected_version: number;
          requested_to_status: ObligationStatus;
          requested_transaction_id: string | null;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      membership_status: MembershipStatus;
      financial_account_type: FinancialAccountType;
      financial_record_status: FinancialRecordStatus;
      transaction_direction: TransactionDirection;
      financial_transaction_status: FinancialTransactionStatus;
      transaction_source: TransactionSource;
      import_batch_status: ImportBatchStatus;
      import_row_status: ImportRowStatus;
      organization_budget_status: OrganizationBudgetStatus;
      budget_revision_status: BudgetRevisionStatus;
      obligation_status: ObligationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
