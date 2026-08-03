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
      <body>{children}</body>
    </html>
  );
}
