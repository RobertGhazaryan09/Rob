import React, { useState } from 'react';
import { User } from '../types.ts';
import { Search, Users, RefreshCw, Calendar, Mail, Hash, Sparkles, ArrowUpDown, UserCheck, Trash2, AlertTriangle, X } from 'lucide-react';

interface UserDirectoryProps {
  users: User[];
  currentUser: User;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onDeleteProfile: () => Promise<void>;
  isLoading: boolean;
}

export const UserDirectory: React.FC<UserDirectoryProps> = ({
  users,
  currentUser,
  searchQuery,
  onSearchChange,
  onRefresh,
  onDeleteProfile,
  isLoading,
}) => {
  const [sortField, setSortField] = useState<'id' | 'username' | 'created_at'>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sorting
  const sortedUsers = [...users].sort((a, b) => {
    if (sortField === 'id') {
      return sortAsc ? a.id - b.id : b.id - a.id;
    }
    if (sortField === 'username') {
      return sortAsc ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
    }
    if (sortField === 'created_at') {
      return sortAsc
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });

  const toggleSort = (field: 'id' | 'username' | 'created_at') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-rose-500 to-pink-500',
      'from-purple-500 to-indigo-600',
      'from-cyan-500 to-blue-600',
      'from-amber-500 to-orange-500',
      'from-emerald-500 to-teal-600',
      'from-fuchsia-500 to-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteProfile();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Социальная сеть</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Привет, <span className="bg-gradient-to-r from-rose-400 via-pink-300 to-indigo-300 bg-clip-text text-transparent">@{currentUser.username}</span>!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
              Добро пожаловать в SocialNet. Ниже представлен список всех зарегистрированных пользователей системы.
            </p>
          </div>

          {/* User Profile Card with Delete Profile Button */}
          <div className="flex flex-col items-start sm:items-end justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 gap-3">
            <div>
              <span className="text-xs text-slate-400 block sm:text-right">Ваш аккаунт:</span>
              <div className="text-xl sm:text-2xl font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span>@{currentUser.username}</span>
                <UserCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-[11px] text-indigo-300 font-mono mt-0.5 block sm:text-right">ID: #{currentUser.id}</span>
            </div>

            {/* Delete Own Profile Button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
              title="Удалить свой профиль"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Удалить мой профиль</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск пользователей по имени или email..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Очистить
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-2xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Обновить список</span>
          </button>
        </div>
      </div>

      {/* Users Directory Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Пользователи сети</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              {users.length}
            </span>
          </div>

          {searchQuery && (
            <div className="text-xs text-slate-500">
              Результаты поиска: <span className="font-semibold text-slate-800">«{searchQuery}»</span>
            </div>
          )}
        </div>

        {/* Empty State */}
        {users.length === 0 ? (
          <div className="py-16 text-center text-slate-500 px-4">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700 text-base">
              {searchQuery ? 'По вашему запросу ничего не найдено' : 'Пока нет зарегистрированных пользователей'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `Пользователи с именем или email, содержащим "${searchQuery}", не найдены.`
                : 'Зарегистрируйте первого пользователя в системе!'}
            </p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              >
                Показать всех пользователей
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                    <th
                      onClick={() => toggleSort('id')}
                      className="px-6 py-3.5 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>ID</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('username')}
                      className="px-6 py-3.5 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Имя пользователя</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>Электронная почта</span>
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('created_at')}
                      className="px-6 py-3.5 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Дата регистрации</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-3.5 text-right">
                      <span>Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {sortedUsers.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-indigo-50/40 transition-colors ${
                          isSelf ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        {/* ID Column */}
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">
                          #{user.id}
                        </td>

                        {/* Username Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(user.username)} text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase`}>
                              {user.username.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>@{user.username}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                    Это вы
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="px-6 py-4 font-medium text-slate-600">
                          {user.email}
                        </td>

                        {/* Registration Date Column */}
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {formatDate(user.created_at)}
                        </td>

                        {/* Actions Column (Only visible and operable for current user's profile!) */}
                        <td className="px-6 py-4 text-right">
                          {isSelf ? (
                            <button
                              onClick={() => setShowDeleteModal(true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Удалить свой профиль"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Удалить</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Optimized for Android Phone) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {sortedUsers.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    className={`p-4 space-y-2.5 transition-colors ${
                      isSelf ? 'bg-indigo-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(user.username)} text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase`}>
                          {user.username.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-sm">
                            <span>@{user.username}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                Вы
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">{user.email}</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        #{user.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Регистрация:</span>
                        <span className="text-slate-600 font-medium ml-1">{formatDate(user.created_at)}</span>
                      </div>

                      {/* Delete button only on self card */}
                      {isSelf && (
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg active:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Удалить профиль</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal for Deleting Own Profile */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Удалить свой профиль?</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Вы действительно хотите удалить свой аккаунт <b className="text-slate-900">@{currentUser.username}</b>? 
                Ваши данные будут безвозвратно удалены из базы данных MySQL. Вы не можете удалять чужие профили — только свой собственный.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] rounded-xl transition-all shadow-sm shadow-rose-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Да, удалить мой профиль</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
