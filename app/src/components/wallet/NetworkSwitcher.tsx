"use client";

import { useState, useRef, useEffect } from "react";
import { useChain } from "@/chains/ChainContext";
import type { ChainId } from "@/chains/types";

const chains: { id: ChainId; name: string; icon: JSX.Element }[] = [
  {
    id: "solana",
    name: "Solana",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 11.5h9l-2-2H3l0 2z" fill="#9945FF" />
        <path d="M3 4.5h9l-2 2H3l0-2z" fill="#14F195" />
        <path d="M3 8h9l-2 2H3V8z" fill="#00C2FF" />
      </svg>
    ),
  },
  {
    id: "ethereum",
    name: "Ethereum",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L3 8l5 3 5-3L8 1z" fill="#627EEA" />
        <path d="M8 12l-5-3 5 4 5-4-5 3z" fill="#627EEA" opacity="0.6" />
      </svg>
    ),
  },
];

export function NetworkSwitcher() {
  const { activeChain, setActiveChain } = useChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const active = chains.find((c) => c.id === activeChain)!;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800/50 border border-gray-800 hover:bg-gray-800 transition-colors"
      >
        {active.icon}
        <span className="text-gray-300">{active.name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 min-w-[160px]">
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                setActiveChain(chain.id);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-gray-800 transition-colors ${
                chain.id === activeChain
                  ? "text-white bg-gray-800/50"
                  : "text-gray-400"
              }`}
            >
              {chain.icon}
              <span>{chain.name}</span>
              {chain.id === activeChain && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className="ml-auto text-brand-400"
                >
                  <path
                    d="M3 7l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
