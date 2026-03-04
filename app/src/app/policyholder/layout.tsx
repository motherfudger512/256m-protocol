"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

const navItems = [
  { href: "/policyholder", label: "Dashboard" },
  { href: "/policyholder/register", label: "Register" },
  { href: "/policyholder/policies", label: "Policies" },
  { href: "/policyholder/policies/new", label: "Get a Quote" },
  { href: "/policyholder/claims", label: "Claims" },
  { href: "/policyholder/claims/new", label: "File Claim" },
];

export default function PolicyholderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const wallet = useAnchorWallet();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-gray-800 p-4 flex flex-col gap-1">
        <Link href="/" className="mb-4 block">
          <Image src="/logo.svg" alt="256M" width={100} height={21} />
        </Link>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded text-sm ${
              pathname === item.href
                ? "bg-brand-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
          <span className="text-sm text-gray-400">Policyholder</span>
          <WalletButton />
        </header>
        <main className="flex-1 p-6">
          {!wallet ? (
            <div className="text-center text-gray-500 mt-20">
              Connect your wallet to continue
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
