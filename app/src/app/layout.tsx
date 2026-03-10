import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/wallet/ClientProviders";

export const metadata: Metadata = {
  title: "256M Protocol",
  description: "Decentralized watch insurance on Solana and Ethereum",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
