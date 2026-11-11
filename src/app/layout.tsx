import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash-Flow Copilot",
  description:
    "Explainable cash-flow decision support for student organizations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {process.env.DEMO_MODE === "true" && (
          <div
            role="note"
            className="relative z-50 border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-950"
          >
            <strong>Demo — synthetic data.</strong> Records and balances are
            fictional. Please use sample data only; do not enter real financial
            or personal information.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
