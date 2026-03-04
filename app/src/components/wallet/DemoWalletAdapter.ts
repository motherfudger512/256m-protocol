"use client";

import {
  BaseSignerWalletAdapter,
  WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

export const DemoWalletName = "Demo Wallet" as WalletName<"Demo Wallet">;

export class DemoWalletAdapter extends BaseSignerWalletAdapter {
  name = DemoWalletName;
  url = "https://256m.demo";
  icon =
    "data:image/svg+xml;base64," +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#6366f1"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif" font-weight="bold">D</text></svg>',
    );
  readyState = WalletReadyState.Installed;
  supportedTransactionVersions = undefined;

  private _keypair = Keypair.generate();
  private _connected = false;
  private _connecting = false;

  get publicKey() {
    return this._connected ? this._keypair.publicKey : null;
  }

  get connecting() {
    return this._connecting;
  }

  async connect(): Promise<void> {
    this._connecting = true;
    this._connected = true;
    this._connecting = false;
    this.emit("connect", this._keypair.publicKey);
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    if (transaction instanceof Transaction) {
      transaction.partialSign(this._keypair);
    }
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]> {
    for (const tx of transactions) {
      if (tx instanceof Transaction) {
        tx.partialSign(this._keypair);
      }
    }
    return transactions;
  }
}
