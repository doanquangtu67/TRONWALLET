import { WalletData, TronWebInstance, TransactionResult } from '../types';

// Configuration for Shasta Testnet
const FULL_NODE = 'https://api.shasta.trongrid.io';
const SOLIDITY_NODE = 'https://api.shasta.trongrid.io';
const EVENT_SERVER = 'https://api.shasta.trongrid.io';

let tronWebInstance: TronWebInstance | null = null;

const getTronWeb = (): TronWebInstance => {
  if (tronWebInstance) return tronWebInstance;

  if (window.TronWeb) {
    // Initialize TronWeb with Shasta config
    // Removed API Key header as Shasta is a public testnet and often rejects dummy keys or causes CORS issues with them
    tronWebInstance = new window.TronWeb({
      fullHost: FULL_NODE,
    });
    return tronWebInstance!;
  }
  throw new Error("TronWeb SDK is not loaded.");
};

export const createWallet = async (): Promise<WalletData> => {
  const tw = getTronWeb();
  // Simulate a delay for better UX
  await new Promise(resolve => setTimeout(resolve, 800));
  const newAccount = await tw.utils.accounts.generateAccount();
  return newAccount;
};

export const getBalance = async (address: string): Promise<number> => {
  try {
    const tw = getTronWeb();
    const balance = await tw.trx.getBalance(address);
    // Convert Sun to TRX (1 TRX = 1,000,000 Sun)
    return balance / 1_000_000;
  } catch (error) {
    // Return -1 to indicate network error, so we don't accidentally set balance to 0 in UI
    console.warn("Failed to fetch balance for", address); 
    return -1;
  }
};

export const sendTrx = async (
  fromAddress: string,
  toAddress: string,
  amount: number,
  privateKey: string
): Promise<TransactionResult> => {
  const tw = getTronWeb();
  
  // Set private key for signing
  tw.setPrivateKey(privateKey);
  
  try {
    // Amount in Sun
    const amountInSun = Math.floor(amount * 1_000_000);
    
    // Create transaction
    const tradeObj = await tw.transactionBuilder.sendTrx(toAddress, amountInSun, fromAddress);
    
    // Sign
    const signedTxn = await tw.trx.sign(tradeObj, privateKey);
    
    // Broadcast
    const receipt = await tw.trx.sendRawTransaction(signedTxn);
    
    if (receipt.result) {
      return {
        result: true,
        txid: receipt.txid,
        transaction: receipt.transaction
      };
    } else {
        let message = 'Transaction failed.';
        if (receipt.message) {
             // Safe conversion if message is hex or byte array
             try {
                 message = window.TronWeb.toUtf8(receipt.message);
             } catch {
                 message = String(receipt.message);
             }
        }
        throw new Error(message);
    }
  } catch (error: any) {
    console.error("Send Error:", error);
    throw new Error(typeof error === 'string' ? error : error.message || "Transaction failed");
  }
};

export const validateAddress = (address: string): boolean => {
    if (!window.TronWeb) return false;
    return window.TronWeb.isAddress(address);
}