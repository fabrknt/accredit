import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "accredit — Compliance Console",
  description: "On-chain compliance enforcement + AI-AML screening on HashKey Chain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
