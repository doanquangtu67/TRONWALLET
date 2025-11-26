import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoredWallet, AppView, TransactionResult, AuthMode, TronPrice, Notification, User } from './types';
import { createWallet, getBalance, sendTrx, validateAddress } from './services/tronService';
import { 
  registerUser, loginUser, logoutUser, getCurrentUser, getUserProfile, 
  enableTwoFactor, disableTwoFactor,
  getStoredWallets, saveWallet, updateWalletBalance, addNotification, getNotifications, deleteWallet 
} from './services/storageService';
import { fetchTronPrice } from './services/priceService';
import { generateSecret, generateOtpAuthUrl, verifyToken } from './services/twoFactorService';
import Button from './components/Button';
import Input from './components/Input';
import AiAssistant from './components/AiAssistant';
import NotificationBell from './components/NotificationBell';
import { 
  ShieldCheck, Copy, RefreshCw, Send, ArrowRight, Wallet, 
  AlertTriangle, CheckCircle, ExternalLink, LogOut, Plus, Trash2, TrendingUp, TrendingDown,
  Lock, X
} from 'lucide-react';

const App: React.FC = () => {
  // --- Global State ---
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [authMode, setAuthMode] = useState<AuthMode>('LOGIN');

  // --- Auth State ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- Dashboard State ---
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [price, setPrice] = useState<TronPrice | null>(null);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Transaction State ---
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [txResult, setTxResult] = useState<TransactionResult | null>(null);
  const [txError, setTxError] = useState('');
  const [sending, setSending] = useState(false);

  // --- 2FA State ---
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  
  // 2FA Setup
  const [tempSecret, setTempSecret] = useState('');
  const [tempQrUrl, setTempQrUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [setupError, setSetupError] = useState('');
  
  // 2FA Verify (Transaction)
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // --- Initialization ---
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      const profile = getUserProfile();
      setUserProfile(profile);
      setView(AppView.DASHBOARD);
      loadUserData();
    }
  }, []);

  const loadUserData = useCallback(() => {
    const stored = getStoredWallets();
    setWallets(stored);
    if (stored.length > 0 && !selectedWalletId) {
      setSelectedWalletId(stored[0].id);
    }
    checkUnread();
  }, [selectedWalletId]);

  const checkUnread = () => {
    const notifs = getNotifications();
    const hasUnread = notifs.some(n => !n.read);
    setHasUnreadNotifs(hasUnread);
  }

  // --- Background Polling (Price & Balance Notification) ---
  const previousBalances = useRef<{[key: string]: number}>({});

  const pollData = useCallback(async () => {
    // 1. Fetch Price
    const newPrice = await fetchTronPrice();
    setPrice(newPrice);

    // 2. Check Balances & Create Notifications
    if (!currentUser) return;
    
    // We fetch fresh wallet list from storage to ensure we have latest
    const currentWallets = getStoredWallets(); 
    let walletsUpdated = false;

    for (const w of currentWallets) {
       const newBal = await getBalance(w.address.base58);
       
       // CRITICAL: If newBal is -1, it means network error. Skip update to prevent setting balance to 0.
       if (newBal === -1) continue;

       const oldBal = previousBalances.current[w.id] ?? w.balance;

       // If balance changed significantly ( > 0.000001 TRX)
       if (Math.abs(newBal - oldBal) > 0.000001) {
          const diff = newBal - oldBal;
          const isReceive = diff > 0;
          
          // Add Notification
          const newNotif: Notification = {
              id: Date.now().toString() + Math.random(),
              title: isReceive ? 'Nhận được TRX' : 'Đã gửi TRX',
              message: `Ví ${w.name} vừa ${isReceive ? 'nhận' : 'chuyển'} ${Math.abs(diff).toLocaleString()} TRX. Số dư mới: ${newBal.toLocaleString()} TRX.`,
              type: isReceive ? 'success' : 'warning',
              timestamp: Date.now(),
              read: false
          };
          addNotification(newNotif);
          setHasUnreadNotifs(true);

          // Update Storage
          updateWalletBalance(w.address.base58, newBal);
          walletsUpdated = true;
       }
       
       // Update Ref
       previousBalances.current[w.id] = newBal;
    }

    if (walletsUpdated) {
        setWallets(getStoredWallets());
    }
  }, [currentUser]);

  // Run polling every 10 seconds
  useEffect(() => {
    if (view === AppView.DASHBOARD) {
        pollData(); // Initial run
        const interval = setInterval(pollData, 10000);
        return () => clearInterval(interval);
    }
  }, [view, pollData]);

  // --- Handlers: Auth ---
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (!username || !password) {
      setAuthError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (authMode === 'REGISTER') {
      const success = registerUser(username, password);
      if (success) {
        setAuthMode('LOGIN');
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
      } else {
        setAuthError('Tên tài khoản đã tồn tại.');
      }
    } else {
      const success = loginUser(username, password);
      if (success) {
        setCurrentUser(username);
        setUserProfile(getUserProfile());
        setView(AppView.DASHBOARD);
        loadUserData();
      } else {
        setAuthError('Sai tên tài khoản hoặc mật khẩu.');
      }
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setUserProfile(null);
    setView(AppView.AUTH);
    setWallets([]);
    setSelectedWalletId(null);
  };

  // --- Handlers: Wallet Actions ---
  const handleCreateWallet = async () => {
    setIsRefreshing(true);
    try {
      const rawWallet = await createWallet();
      const newWallet: StoredWallet = {
        ...rawWallet,
        id: Date.now().toString(),
        name: `Ví Tron ${wallets.length + 1}`,
        balance: 0,
        createdAt: Date.now()
      };
      
      saveWallet(newWallet);
      loadUserData();
      setSelectedWalletId(newWallet.id);
      
      // Initialize ref
      previousBalances.current[newWallet.id] = 0;
      
      alert(`Đã tạo ví mới: ${newWallet.name}`);
    } catch (e) {
      console.error(e);
      alert('Lỗi tạo ví');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteWallet = (id: string) => {
      if (window.confirm('Bạn có chắc chắn muốn xóa ví này khỏi danh sách? Hãy chắc chắn bạn đã lưu Private Key ở nơi khác!')) {
          deleteWallet(id);
          const remaining = getStoredWallets();
          setWallets(remaining);
          if (selectedWalletId === id) {
              setSelectedWalletId(remaining.length > 0 ? remaining[0].id : null);
          }
      }
  }

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await pollData();
      setIsRefreshing(false);
  }

  // --- Handlers: 2FA Setup ---
  const openSecurityModal = () => {
    if (!userProfile?.isTwoFactorEnabled) {
        // Generate new secret for setup
        const secret = generateSecret();
        const otpUrl = generateOtpAuthUrl(currentUser || 'User', secret);
        // Using qrserver API for QR code generation
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpUrl)}`;
        
        setTempSecret(secret);
        setTempQrUrl(qrUrl);
    }
    setSetupToken('');
    setSetupError('');
    setShowSecurityModal(true);
  }

  const handleEnable2FA = () => {
      if (verifyToken(setupToken, tempSecret)) {
          enableTwoFactor(tempSecret);
          setUserProfile(getUserProfile());
          setShowSecurityModal(false);
          alert('Bảo mật 2FA đã được kích hoạt thành công!');
      } else {
          setSetupError('Mã xác thực không đúng. Vui lòng thử lại.');
      }
  }

  const handleDisable2FA = () => {
      if (window.confirm('Bạn có chắc muốn tắt bảo mật 2FA? Tài khoản của bạn sẽ kém an toàn hơn.')) {
          disableTwoFactor();
          setUserProfile(getUserProfile());
          setShowSecurityModal(false);
      }
  }

  // --- Handlers: Send Transaction ---

  const handleSendClick = () => {
      setTxError('');
      setTxResult(null);

      // Validation
      const currentWallet = wallets.find(w => w.id === selectedWalletId);
      if (!currentWallet) return;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          setTxError('Số lượng không hợp lệ');
          return;
      }
      if (!validateAddress(recipient)) {
          setTxError('Địa chỉ ví nhận không hợp lệ');
          return;
      }
      if (Number(amount) > currentWallet.balance) {
          setTxError('Số dư không đủ');
          return;
      }

      // Check if 2FA is enabled
      if (userProfile?.isTwoFactorEnabled) {
          setVerifyTokenInput('');
          setVerifyError('');
          setShow2FAPrompt(true);
      } else {
          // Send directly if no 2FA
          executeTransaction();
      }
  }

  const handle2FAVerifyAndSend = () => {
      if (!userProfile?.twoFactorSecret) return;

      if (verifyToken(verifyTokenInput, userProfile.twoFactorSecret)) {
          setShow2FAPrompt(false);
          executeTransaction();
      } else {
          setVerifyError('Mã xác thực không đúng');
      }
  }

  const executeTransaction = async () => {
    const currentWallet = wallets.find(w => w.id === selectedWalletId);
    if (!currentWallet) return;

    setSending(true);
    try {
        const res = await sendTrx(
            currentWallet.address.base58, 
            recipient, 
            Number(amount), 
            currentWallet.privateKey
        );
        if (res.result) {
            setTxResult(res);
            setAmount('');
            setRecipient('');
            // Trigger poll immediately
            setTimeout(pollData, 4000); 
        } else {
            setTxError('Giao dịch thất bại.');
        }
    } catch (e: any) {
        setTxError(e.message || 'Lỗi gửi tiền');
    } finally {
        setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ---------------- Views ----------------

  if (view === AppView.AUTH) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-700 p-4 rounded-full">
              <Wallet className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-white mb-2">
            {authMode === 'LOGIN' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
          </h2>
          <p className="text-center text-slate-400 mb-6 text-sm">
            Quản lý tài sản Tron Shasta Testnet của bạn
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <Input 
              label="Tên đăng nhập" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nhập username..."
            />
            <Input 
              label="Mật khẩu" 
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
            />
            
            {authError && (
              <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
                {authError}
              </div>
            )}

            <Button type="submit" className="w-full mt-4">
              {authMode === 'LOGIN' ? 'Truy cập Ví' : 'Đăng Ký'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setAuthError(''); }}
              className="text-sm text-purple-400 hover:text-purple-300 hover:underline"
            >
              {authMode === 'LOGIN' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  const activeWallet = wallets.find(w => w.id === selectedWalletId);
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative">
      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="bg-gradient-to-tr from-purple-600 to-blue-600 p-2 rounded-lg">
                <Wallet className="text-white w-5 h-5" />
             </div>
             <span className="font-bold text-lg text-white hidden sm:block">Tron<span className="text-purple-400">Shasta</span> Manager</span>
          </div>

          <div className="flex items-center gap-4">
            {price && (
                <div className="hidden md:flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                    <img src="https://cryptologos.cc/logos/tron-trx-logo.png" className="w-5 h-5" alt="TRX" />
                    <div className="flex flex-col text-xs leading-none">
                        <span className="font-bold text-white">${price.usd.toFixed(4)}</span>
                        <span className={`flex items-center ${price.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                           {price.change24h >= 0 ? <TrendingUp size={10} className="mr-0.5"/> : <TrendingDown size={10} className="mr-0.5"/>}
                           {price.change24h.toFixed(2)}%
                        </span>
                    </div>
                </div>
            )}

            <NotificationBell hasUnread={hasUnreadNotifs} onRead={() => setHasUnreadNotifs(false)} />
            
            <div className="h-8 w-[1px] bg-slate-700 mx-1"></div>
            
            <div className="flex items-center gap-2">
               <button 
                onClick={openSecurityModal}
                className="flex items-center gap-2 p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                title="Cài đặt bảo mật"
               >
                 {userProfile?.isTwoFactorEnabled ? <ShieldCheck size={20} className="text-green-400"/> : <Lock size={20} />}
               </button>

               <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Xin chào,</p>
                  <p className="text-sm font-bold text-white">{currentUser}</p>
               </div>
               <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                  <LogOut size={20} />
               </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT SIDEBAR: Wallet List */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[600px]">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                      <h3 className="font-bold text-white">Danh sách Ví</h3>
                      <button 
                         onClick={handleCreateWallet}
                         disabled={isRefreshing}
                         className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                         title="Tạo ví mới"
                      >
                         <Plus size={18} />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                      {wallets.length === 0 ? (
                          <div className="text-center p-6 text-slate-500 text-sm">
                              Bạn chưa có ví nào. <br/> Hãy tạo ví mới ngay!
                          </div>
                      ) : (
                          wallets.map(w => (
                              <div 
                                key={w.id}
                                onClick={() => setSelectedWalletId(w.id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                    selectedWalletId === w.id 
                                    ? 'bg-purple-900/20 border-purple-500/50 shadow-lg shadow-purple-900/10' 
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                }`}
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <span className="font-medium text-sm text-white">{w.name}</span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteWallet(w.id); }}
                                        className="text-slate-600 hover:text-red-400"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                                  <div className="flex justify-between items-end">
                                      <div className="text-xs text-slate-500 font-mono truncate w-24">
                                          {w.address.base58.substring(0,6)}...{w.address.base58.substring(w.address.base58.length - 4)}
                                      </div>
                                      <div className="text-right">
                                          <div className="text-sm font-bold text-white">{w.balance.toLocaleString()} TRX</div>
                                          {price && <div className="text-[10px] text-slate-400">≈ ${(w.balance * price.usd).toFixed(2)}</div>}
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  
                  <div className="p-4 bg-slate-900 border-t border-slate-800">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Tổng tài sản:</span>
                          <span className="font-bold text-white">{totalBalance.toLocaleString()} TRX</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
              {activeWallet ? (
                  <>
                    {/* Wallet Details Card */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                        
                        <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 relative z-10">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-white mb-1">{activeWallet.name}</h2>
                                <div className="flex items-center gap-2 mb-4">
                                    <code className="bg-black/30 px-2 py-1 rounded text-purple-300 font-mono text-sm break-all">
                                        {activeWallet.address.base58}
                                    </code>
                                    <button onClick={() => copyToClipboard(activeWallet.address.base58)} className="text-slate-400 hover:text-white">
                                        <Copy size={16} />
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-slate-400 text-sm">Số dư hiện tại</p>
                                        <div className="text-3xl font-bold text-white flex items-end gap-2">
                                            {activeWallet.balance.toLocaleString()} <span className="text-base font-normal text-purple-400 mb-1">TRX</span>
                                        </div>
                                    </div>
                                    {price && (
                                        <div className="pl-4 border-l border-slate-700">
                                            <p className="text-slate-400 text-sm">Quy đổi (VND)</p>
                                            <p className="text-xl font-medium text-slate-200">
                                                ≈ {(activeWallet.balance * price.vnd).toLocaleString('vi-VN')} ₫
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 min-w-[140px]">
                                <Button onClick={handleManualRefresh} variant="secondary" isLoading={isRefreshing} className="w-full text-sm">
                                    <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Làm mới
                                </Button>
                                <a 
                                    href="https://shasta.tronscan.org/#/" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={16} /> Faucet
                                </a>
                            </div>
                        </div>

                        {/* Private Key Warning Section */}
                        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <p className="text-yellow-200 text-sm font-bold mb-1">Private Key (Bảo mật)</p>
                                    <div className="group relative">
                                        <p className="font-mono text-slate-400 text-xs blur-sm hover:blur-none transition-all cursor-text break-all bg-black/20 p-2 rounded border border-yellow-900/30">
                                            {activeWallet.privateKey}
                                        </p>
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-yellow-500/50 pointer-events-none group-hover:hidden">
                                            Rê chuột để xem
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* SEND FORM */}
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Send size={20} className="text-purple-500" />
                                Chuyển Tiền
                            </h3>
                            
                            <div className="space-y-4">
                                <Input 
                                    label="Địa chỉ ví nhận"
                                    placeholder="T..."
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                />
                                <div className="relative">
                                    <Input 
                                        label="Số lượng TRX"
                                        type="number"
                                        placeholder="0.0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                    <button 
                                        onClick={() => setAmount(Math.max(0, activeWallet.balance - 1).toString())}
                                        className="absolute right-2 top-8 text-xs text-purple-400 hover:text-purple-300 bg-slate-800 px-2 py-1 rounded"
                                    >
                                        Tối đa
                                    </button>
                                </div>

                                {txError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex gap-2">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        {txError}
                                    </div>
                                )}
                                {txResult && (
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs flex flex-col gap-1">
                                        <div className="flex items-center gap-2 font-bold">
                                            <CheckCircle size={14} /> Gửi thành công!
                                        </div>
                                        <a href={`https://shasta.tronscan.org/#/transaction/${txResult.txid}`} target="_blank" rel="noreferrer" className="underline hover:text-green-300">
                                            Xem transaction ID
                                        </a>
                                    </div>
                                )}

                                <Button 
                                    onClick={handleSendClick} 
                                    isLoading={sending} 
                                    className="w-full mt-2"
                                    disabled={!recipient || !amount}
                                >
                                    Xác nhận gửi {userProfile?.isTwoFactorEnabled && <ShieldCheck size={16} className="ml-2" />}
                                </Button>
                            </div>
                        </div>

                        {/* QR RECEIVE */}
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col items-center justify-center text-center">
                            <h3 className="text-lg font-bold text-white mb-4">Mã QR Nhận Tiền</h3>
                            <div className="bg-white p-3 rounded-xl mb-4">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeWallet.address.base58}`} 
                                    alt="Wallet QR" 
                                    className="w-40 h-40"
                                />
                            </div>
                            <p className="text-sm text-slate-400 max-w-xs">
                                Quét mã này để gửi TRX Shasta đến ví <strong>{activeWallet.name}</strong>
                            </p>
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center opacity-75">
                      <Wallet size={64} className="text-slate-700 mb-4" />
                      <h3 className="text-xl font-bold text-slate-400 mb-2">Chưa chọn ví</h3>
                      <p className="text-slate-500 max-w-md">Vui lòng chọn một ví từ danh sách bên trái hoặc tạo ví mới để bắt đầu giao dịch.</p>
                      <Button onClick={handleCreateWallet} className="mt-6">Tạo Ví Ngay</Button>
                  </div>
              )}
          </div>
      </main>

      <AiAssistant />

      {/* --- MODALS --- */}

      {/* Security Setup Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl relative">
                <button 
                  onClick={() => setShowSecurityModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-green-500" />
                    Cài đặt bảo mật 2FA
                </h3>

                {userProfile?.isTwoFactorEnabled ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                            <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
                            <p className="text-green-400 font-bold">Bảo mật 2FA đang bật</p>
                            <p className="text-slate-400 text-sm mt-1">Tài khoản của bạn được bảo vệ bởi Google Authenticator</p>
                        </div>
                        <Button variant="danger" onClick={handleDisable2FA} className="w-full">
                            Tắt bảo mật 2FA
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm">
                            1. Tải ứng dụng <strong>Google Authenticator</strong> trên điện thoại.<br/>
                            2. Quét mã QR bên dưới.<br/>
                            3. Nhập mã 6 số để kích hoạt.
                        </p>
                        
                        <div className="flex justify-center bg-white p-4 rounded-xl">
                            <img src={tempQrUrl} alt="2FA QR" className="w-40 h-40" />
                        </div>
                        
                        <div>
                            <Input 
                                placeholder="Nhập mã 6 số (VD: 123456)"
                                value={setupToken}
                                onChange={e => {
                                    if (e.target.value.length <= 6) setSetupToken(e.target.value);
                                }}
                                className="text-center tracking-widest text-lg font-mono"
                            />
                            {setupError && <p className="text-red-400 text-xs mt-1 text-center">{setupError}</p>}
                        </div>

                        <Button onClick={handleEnable2FA} className="w-full" disabled={setupToken.length !== 6}>
                            Kích hoạt 2FA
                        </Button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Transaction 2FA Prompt Modal */}
      {show2FAPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm p-6 shadow-2xl relative">
                <button 
                  onClick={() => setShow2FAPrompt(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <ShieldCheck size={48} className="text-purple-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white">Xác thực giao dịch</h3>
                    <p className="text-slate-400 text-sm">Nhập mã từ Google Authenticator để tiếp tục chuyển tiền.</p>
                </div>

                <div className="space-y-4">
                    <Input 
                        placeholder="000 000"
                        value={verifyTokenInput}
                        onChange={e => {
                             if (e.target.value.length <= 6) setVerifyTokenInput(e.target.value);
                        }}
                        className="text-center tracking-widest text-2xl font-mono py-3"
                        autoFocus
                    />
                    {verifyError && <p className="text-red-400 text-sm text-center font-medium bg-red-900/20 p-2 rounded">{verifyError}</p>}
                    
                    <Button onClick={handle2FAVerifyAndSend} className="w-full" disabled={verifyTokenInput.length !== 6}>
                        Xác nhận & Gửi tiền
                    </Button>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default App;