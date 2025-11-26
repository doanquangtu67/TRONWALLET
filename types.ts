// types.ts

export enum AppView {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
}

export type AuthMode = 'LOGIN' | 'REGISTER';

export interface WalletData {
  address: {
    base58: string;
    hex: string;
  };
  privateKey: string;
  publicKey: string;
}

export interface StoredWallet extends WalletData {
  id: string;
  name: string;
  balance: number;
  createdAt: number;
}

export interface User {
  username: string;
  passwordHash: string; // Simple hash/storage for demo
  twoFactorSecret?: string; // Base32 secret for TOTP
  isTwoFactorEnabled?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

export interface TronPrice {
  usd: number;
  vnd: number;
  change24h: number;
}

export interface TransactionResult {
  result: boolean;
  txid: string;
  transaction: any;
}

// Minimal definition for the global TronWeb object from CDN
export interface TronWebInstance {
  ready: boolean;
  fullNode: { host: string };
  solidityNode: { host: string };
  eventServer: { host: string };
  defaultAddress: {
    hex: string;
    base58: string;
  };
  trx: {
    getBalance(address: string): Promise<number>;
    sendTransaction(to: string, amount: number): Promise<any>;
    sign(transaction: any, privateKey: string): Promise<any>;
    sendRawTransaction(signedTransaction: any): Promise<any>;
  };
  transactionBuilder: {
    sendTrx(to: string, amount: number, from: string): Promise<any>;
  };
  utils: {
    accounts: {
      generateAccount(): Promise<WalletData>;
    };
  };
  setAddress(address: string): void;
  setPrivateKey(privateKey: string): void;
}

// Extend the window object to include TronWeb
declare global {
  interface Window {
    TronWeb: any; // Using any for constructor
    tronWeb: TronWebInstance;
  }
}