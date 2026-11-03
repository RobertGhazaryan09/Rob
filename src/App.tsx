import React, { useState, useEffect, useCallback } from 'react';
import { User, DatabaseStatus } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { RegisterForm } from './components/RegisterForm.tsx';
import { LoginForm } from './components/LoginForm.tsx';
import { UserDirectory } from './components/UserDirectory.tsx';
import { Users, Shield, Sparkles, CheckCircle, AlertTriangle, ArrowRight, Heart, MessageSquare, Share2 } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('social_jwt_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Fetch Database Status
  const fetchDatabaseStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/database/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch DB status:', err);
    }
  }, []);

  // Fetch Users from MySQL
  const fetchUsers = useCallback(async (query = '') => {
    const currentToken = localStorage.getItem('social_jwt_token');
    if (!currentToken) return;

    setIsLoadingUsers(true);
    try {
      const url = query ? `/api/users?search=${encodeURIComponent(query)}` : '/api/users';
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        setIsLoadingUsers(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoadingUsers(false);
      fetchDatabaseStatus();
    }
  }, [fetchDatabaseStatus]);

  // Verify auth session on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('social_jwt_token');
      if (!savedToken) {
        setIsInitializing(false);
        fetchDatabaseStatus();
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            fetchUsers('');
          } else {
            handleLogout();
          }
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setIsInitializing(false);
        fetchDatabaseStatus();
      }
    };

    checkAuth();
  }, [fetchDatabaseStatus, fetchUsers]);

  // Debounce search query
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser, fetchUsers]);

  // Auth success
  const handleAuthSuccess = (newToken: string, user: User, message: string) => {
    localStorage.setItem('social_jwt_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    showToast(message, 'success');
    fetchUsers('');
    fetchDatabaseStatus();
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('social_jwt_token');
    setToken(null);
    setCurrentUser(null);
    setUsers([]);
    setSearchQuery('');
    showToast('Вы вышли из своего аккаунта.', 'info');
    fetchDatabaseStatus();
  };

  // Delete Own Profile
  const handleDeleteProfile = async () => {
    const currentToken = localStorage.getItem('social_jwt_token');
    if (!currentToken || !currentUser) return;

    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem('social_jwt_token');
        setToken(null);
        setCurrentUser(null);
        setUsers([]);
        setSearchQuery('');
        showToast('Ваш профиль был успешно удален из базы данных.', 'info');
        fetchDatabaseStatus();
      } else {
        showToast(data.error || 'Не удалось удалить профиль', 'error');
      }
    } catch (err: any) {
      showToast(`Ошибка соединения: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navigation */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onRefreshUsers={() => fetchUsers(searchQuery)}
        isRefreshing={isLoadingUsers}
        authView={authView}
        onSetAuthView={setAuthView}
        isDbConnected={dbStatus?.isConnected ?? true}
      />

      {/* Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-indigo-900 text-white border-indigo-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isInitializing ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Загрузка SocialNet...</p>
          </div>
        ) : currentUser ? (
          /* Logged In View: Main Social Directory */
          <UserDirectory
            users={users}
            currentUser={currentUser}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={() => fetchUsers(searchQuery)}
            onDeleteProfile={handleDeleteProfile}
            isLoading={isLoadingUsers}
          />
        ) : (
          /* Logged Out View: Inspired by Facebook & Instagram Landing Pages */
          <div className="py-4 sm:py-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Visual Showcase (Instagram/Facebook branding) */}
              <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-50 to-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  <span>Новое поколение социальных сетей</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Оставайтесь на связи с теми,{' '}
                  <span className="bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                    кто вам дорог
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  SocialNet объединяет людей по всему миру. Создайте профиль, находите друзей и знакомьтесь с новыми пользователями в реальном времени.
                </p>

                {/* Social Network Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">Каталог профилей</div>
                      <div className="text-[11px] text-slate-500">Удобный поиск участников</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">Защита аккаунтов</div>
                      <div className="text-[11px] text-slate-500">Безопасное хранение данных</div>
                    </div>
                  </div>
                </div>

                {/* Preview User Card Mockup */}
                <div className="hidden sm:flex items-center gap-3 p-3.5 bg-slate-100/80 rounded-2xl border border-slate-200/60 max-w-sm mx-auto lg:mx-0">
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white">
                      SN
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white">
                      DB
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white">
                      +
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-900">Присоединяйтесь!</span> Создайте учётную запись за минуту.
                  </div>
                </div>
              </div>

              {/* Right Column: Auth Card with clear "Войти" and "Зарегистрироваться" buttons */}
              <div className="lg:col-span-6 w-full max-w-md mx-auto">
                {/* Switcher Buttons: Войти / Зарегистрироваться */}
                <div className="mb-4 bg-slate-200/90 p-1.5 rounded-2xl flex">
                  <button
                    type="button"
                    onClick={() => setAuthView('login')}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      authView === 'login'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Войти в аккаунт</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthView('register')}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      authView === 'register'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Зарегистрироваться</span>
                  </button>
                </div>

                {/* Form Body */}
                {authView === 'login' ? (
                  <LoginForm
                    onSuccess={handleAuthSuccess}
                    onSwitchToRegister={() => setAuthView('register')}
                  />
                ) : (
                  <RegisterForm
                    onSuccess={handleAuthSuccess}
                    onSwitchToLogin={() => setAuthView('login')}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <span>SocialNet</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Социальная сеть нового поколения</span>
          </div>
          <div className="text-slate-400 text-xs">
            <span>Все права защищены © 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
