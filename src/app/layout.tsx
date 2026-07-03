import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PraxDoc - Multi-Tenant Medical SaaS Portal",
  description: "Secure, compliant multi-tenant SaaS dashboard for clinics and hospitals featuring patient management, doctor schedule allocations, automated billing, and detailed audit logs.",
  keywords: ["Medical SaaS", "Healthcare Dashboard", "ABHA Verification", "DPDP Consent Management", "GST Billing", "PraxDoc"],
  authors: [{ name: "PraxDoc Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
