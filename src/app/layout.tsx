import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenith Core Alliance - Medical Portal",
  description: "Secure, compliant medical dashboard for clinics and hospitals featuring patient management, doctor schedule allocations, automated billing, and detailed audit logs.",
  keywords: ["Medical Dashboard", "Healthcare Dashboard", "ABHA Verification", "DPDP Consent Management", "GST Billing", "Zenith Core Alliance"],
  authors: [{ name: "Zenith Core Alliance" }],
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
