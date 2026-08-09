"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  FileUp,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type {
  OrganizationChoice,
  OrganizationContext,
} from "@/lib/organizations/organization-context";
import { cn } from "@/lib/utils";

const navigation = [
  { segment: "dashboard", label: "Overview", icon: LayoutDashboard },
  {
    segment: "transactions",
    label: "Transactions",
    icon: ListChecks,
    financial: true,
  },
  {
    segment: "accounts",
    label: "Accounts",
    icon: WalletCards,
    financial: true,
  },
  { segment: "categories", label: "Categories", icon: Tags, financial: true },
  { segment: "budgets", label: "Budgets", icon: BarChart3, financial: true },
  { segment: "cash-flow", label: "Cash flow", icon: BarChart3 },
  {
    segment: "obligations",
    label: "Obligations",
    icon: CalendarRange,
    financial: true,
  },
  { segment: "reimbursements", label: "Reimbursements", icon: ReceiptText },
  { segment: "scenarios", label: "Event scenarios", icon: HandCoins },
  {
    segment: "imports",
    label: "Imports",
    icon: FileUp,
    financial: true,
    treasurerOnly: true,
  },
];

function Sidebar({
  organization,
  profileName,
  onNavigate,
}: {
  organization: OrganizationContext;
  profileName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const base = `/organizations/${organization.id}`;
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
          <Landmark className="size-5" />
        </div>
        <div>
          <p className="font-semibold tracking-tight">Cash-Flow Copilot</p>
          <p className="text-xs text-slate-400">Decision support</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 p-4">
        {navigation
          .filter(
            (item) =>
              (!item.financial || organization.role !== "member") &&
              (!item.treasurerOnly || organization.role === "treasurer"),
          )
          .map(({ segment, label, icon: Icon }) => {
            const href = `${base}/${segment}`;
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <Link
          href={`${base}/settings`}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-semibold text-emerald-300">
            {profileName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profileName}</p>
            <p className="text-xs capitalize text-slate-400">
              {organization.role}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <button
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            type="submit"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  organization,
  organizations,
  profileName,
}: {
  children: React.ReactNode;
  organization: OrganizationContext;
  organizations: OrganizationChoice[];
  profileName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  function switchOrganization(nextOrganizationId: string) {
    window.location.assign(
      pathname.replace(
        `/organizations/${organization.id}`,
        `/organizations/${nextOrganizationId}`,
      ),
    );
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <Sidebar organization={organization} profileName={profileName} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-72">
            <Sidebar
              organization={organization}
              profileName={profileName}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Open navigation"
            >
              {open ? <X /> : <Menu />}
            </Button>
            <div className="relative">
              <select
                aria-label="Organization"
                value={organization.id}
                onChange={(event) => switchOrganization(event.target.value)}
                className="appearance-none bg-transparent pr-6 text-sm font-semibold text-slate-900 outline-none"
              >
                {organizations.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-0.5 size-4 text-slate-500" />
              <p className="text-xs capitalize text-slate-500">
                {organization.role} access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
            <ShieldCheck className="size-4" />
            Protected workspace
          </div>
        </header>
        <main className="p-5 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
