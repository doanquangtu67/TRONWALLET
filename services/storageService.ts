import { User, StoredWallet, Notification } from '../types';

const USERS_KEY = 'tron_app_users';
const CURRENT_USER_KEY = 'tron_app_current_user';
const WALLETS_KEY_PREFIX = 'tron_app_wallets_';
const NOTIFICATIONS_KEY_PREFIX = 'tron_app_notifs_';

// --- Auth Helpers ---

export const registerUser = (username: string, password: string): boolean => {
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  if (users.find((u: User) => u.username === username)) {
    return false; // User exists
  }
  // Initialize with 2FA disabled
  const newUser: User = { 
    username, 
    passwordHash: password,
    isTwoFactorEnabled: false
  };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
};

export const loginUser = (username: string, password: string): boolean => {
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const user = users.find((u: User) => u.username === username && u.passwordHash === password);
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, username);
    return true;
  }
  return false;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): string | null => {
  return localStorage.getItem(CURRENT_USER_KEY);
};

// --- 2FA Helpers ---

export const getUserProfile = (): User | null => {
  const username = getCurrentUser();
  if (!username) return null;
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  return users.find((u: User) => u.username === username) || null;
};

export const enableTwoFactor = (secret: string) => {
  const username = getCurrentUser();
  if (!username) return;
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const userIndex = users.findIndex((u: User) => u.username === username);
  
  if (userIndex !== -1) {
    users[userIndex].isTwoFactorEnabled = true;
    users[userIndex].twoFactorSecret = secret;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

export const disableTwoFactor = () => {
  const username = getCurrentUser();
  if (!username) return;
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const userIndex = users.findIndex((u: User) => u.username === username);
  
  if (userIndex !== -1) {
    users[userIndex].isTwoFactorEnabled = false;
    delete users[userIndex].twoFactorSecret;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

// --- Wallet Helpers ---

export const getStoredWallets = (): StoredWallet[] => {
  const user = getCurrentUser();
  if (!user) return [];
  const data = localStorage.getItem(WALLETS_KEY_PREFIX + user);
  return data ? JSON.parse(data) : [];
};

export const saveWallet = (wallet: StoredWallet) => {
  const user = getCurrentUser();
  if (!user) return;
  const wallets = getStoredWallets();
  wallets.push(wallet);
  localStorage.setItem(WALLETS_KEY_PREFIX + user, JSON.stringify(wallets));
};

export const updateWalletBalance = (address: string, newBalance: number) => {
  const user = getCurrentUser();
  if (!user) return;
  const wallets = getStoredWallets();
  const index = wallets.findIndex(w => w.address.base58 === address);
  if (index !== -1) {
    wallets[index].balance = newBalance;
    localStorage.setItem(WALLETS_KEY_PREFIX + user, JSON.stringify(wallets));
  }
};

export const deleteWallet = (id: string) => {
    const user = getCurrentUser();
    if (!user) return;
    let wallets = getStoredWallets();
    wallets = wallets.filter(w => w.id !== id);
    localStorage.setItem(WALLETS_KEY_PREFIX + user, JSON.stringify(wallets));
}

// --- Notification Helpers ---

export const getNotifications = (): Notification[] => {
  const user = getCurrentUser();
  if (!user) return [];
  const data = localStorage.getItem(NOTIFICATIONS_KEY_PREFIX + user);
  return data ? JSON.parse(data) : [];
};

export const addNotification = (notif: Notification) => {
  const user = getCurrentUser();
  if (!user) return;
  const notifs = getNotifications();
  // Add to beginning
  notifs.unshift(notif);
  // Limit to 50 notifications
  if (notifs.length > 50) notifs.pop();
  localStorage.setItem(NOTIFICATIONS_KEY_PREFIX + user, JSON.stringify(notifs));
};

export const markAllNotificationsRead = () => {
  const user = getCurrentUser();
  if (!user) return;
  const notifs = getNotifications();
  const updated = notifs.map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_KEY_PREFIX + user, JSON.stringify(updated));
};