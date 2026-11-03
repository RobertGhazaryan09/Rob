import React from 'react';
import { User } from '../types.ts';
import { LogOut, RefreshCw, Users, Sparkles, UserPlus, LogIn } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  onRefreshUsers: () => void;
  isRefreshing: boolean;
  authView: 'login' | 'register';
  onSetAuthView: (view: 'login' | 'register') => void;
  isDbConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onRefreshUsers,
  isRefreshing,
  authView,
  onSetAuthView,
  isDbConnected,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo inspired by Instagram & Facebook */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Social<span className="text-indigo-600">Net</span>
                </span>
                {isDbConnected && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                    MySQL Онлайн
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Социальная сеть на базе данных MySQL
              </p>
            </div>
          </div>

          {/* Action buttons & User profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser ? (
              <>
                {/* Refresh list button */}
                <button
                  onClick={onRefreshUsers}
                  disabled={isRefreshing}
                  className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  title="Обновить список пользователей"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                  <span className="hidden sm:inline">Обновить</span>
                </button>

                {/* User Greeting with Avatar */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-xs uppercase">
                    {currentUser.username.substring(0, 2)}
                  </div>
                  <div className="text-left text-xs hidden sm:block">
                    <div className="font-semibold text-slate-900">
                      @{currentUser.username}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                      {currentUser.email}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                  title="Выйти из аккаунта"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            ) : (
              /* Buttons when NOT logged in: Войти и Зарегистрироваться */
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSetAuthView('login')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    authView === 'login'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Войти</span>
                </button>

                <button
                  onClick={() => onSetAuthView('register')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    authView === 'register'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Зарегистрироваться</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
