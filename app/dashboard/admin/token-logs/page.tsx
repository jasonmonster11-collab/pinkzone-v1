'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  email?: string | null;
  role_level?: number | null;
  is_admin?: boolean | null;
};

type TokenLog = {
  id: string;
  user_id: string;
  admin_id?: string | null;
  amount: number;
  balance_after?: number | null;
  type?: string | null;
  memo?: string | null;
  created_at?: string | null;
  user_profile?: Profile | null;
  admin_profile?: Profile | null;
};

function getDisplayName(profile?: Profile | null, fallback?: string | null) {
  if (!profile) return fallback || '-';
  return profile.email || fallback || '-';
}

function getSubLabel(profile?: Profile | null, fallback?: string | null) {
  if (!profile) return fallback || '-';
  return profile.email || profile.id || fallback || '-';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLogTypeLabel(type?: string | null, amount?: number) {
  if (type === 'charge') return '충전';
  if (type === 'adjust' && Number(amount) < 0) return '차감';
  if (type === 'adjust') return '조정';
  if (type === 'use') return '사용';
  if (Number(amount) > 0) return '충전';
  if (Number(amount) < 0) return '차감';
  return '기록';
}

export default function AdminTokenLogsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<TokenLog[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체');

  useEffect(() => {
    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializePage = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
        return;
      }

      if (!user) {
        router.push('/');
        return;
      }

      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !myProfile) {
        setAccessDenied(true);
        return;
      }

      const currentProfile = myProfile as Profile;
      const isAllowedAdmin = currentProfile.is_admin === true || Number(currentProfile.role_level) <= 2;

      if (!isAllowedAdmin) {
        setAccessDenied(true);
        return;
      }

      setAdminProfile(currentProfile);
      await loadTokenLogs();
    } finally {
      setLoading(false);
    }
  };

  const loadTokenLogs = async () => {
    const { data, error } = await supabase
      .from('token_logs')
      .select(`
        id,
        user_id,
        admin_id,
        amount,
        balance_after,
        type,
        memo,
        created_at,
        user_profile:profiles!token_logs_user_id_fkey (
          id,
          email
        ),
        admin_profile:profiles!token_logs_admin_id_fkey (
          id,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('loadTokenLogs error', error);
      alert(
        '토큰 지급 내역을 불러오지 못했습니다.\n\n' +
          'message: ' + (error.message || '-') + '\n' +
          'code: ' + (error.code || '-') + '\n' +
          'details: ' + (error.details || '-') + '\n' +
          'hint: ' + (error.hint || '-')
      );
      return;
    }

    // Supabase join 결과 타입 추론이 빌드에서 과하게 좁게 잡히는 경우가 있어서
    // 실제 select 구조 기준으로 TokenLog[]로 안전하게 변환합니다.
    setLogs((data || []) as unknown as TokenLog[]);
  };

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((log) => {
      const targetUser = log.user_profile;
      const adminUser = log.admin_profile;
      const label = getLogTypeLabel(log.type, log.amount);

      const matchesType = typeFilter === '전체' || label === typeFilter;
      if (!matchesType) return false;

      if (!keyword) return true;

      const text = [
        getDisplayName(targetUser, log.user_id),
        getSubLabel(targetUser, log.user_id),
        getDisplayName(adminUser, log.admin_id || '-'),
        getSubLabel(adminUser, log.admin_id || '-'),
        log.memo,
        log.type,
        label,
        String(log.amount),
        String(log.balance_after ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [logs, search, typeFilter]);

  const totalCharged = filteredLogs
    .filter((log) => Number(log.amount) > 0)
    .reduce((sum, log) => sum + Number(log.amount || 0), 0);

  const totalDeducted = filteredLogs
    .filter((log) => Number(log.amount) < 0)
    .reduce((sum, log) => sum + Math.abs(Number(log.amount || 0)), 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fff5fa] p-6 text-[#3b2230]">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">토큰 지급 내역 불러오는 중...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-[#fff5fa] p-6 text-[#3b2230]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#e4348a]">접근 권한이 없습니다</h1>
          <p className="mt-3 text-sm text-gray-600">관리자 전용 토큰 지급 내역 페이지입니다.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-6 rounded-xl bg-[#e4348a] px-5 py-3 text-sm font-bold text-white"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff5fa] p-4 text-[#3b2230] md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#e4348a]">토큰 지급 내역</h1>
            <p className="mt-1 text-sm text-gray-500">관리자가 지급/차감한 토큰 기록을 확인합니다.</p>
            {adminProfile && <p className="mt-1 text-xs text-gray-400">관리자: {getDisplayName(adminProfile)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadTokenLogs}
              className="rounded-xl border border-[#f3b2d0] bg-white px-4 py-2 text-sm font-bold text-[#e4348a] hover:bg-[#fff0f7]"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/admin/users')}
              className="rounded-xl bg-[#e4348a] px-4 py-2 text-sm font-bold text-white hover:bg-[#cc1f78]"
            >
              회원관리
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="rounded-xl border border-[#f3b2d0] bg-white px-4 py-2 text-sm font-bold text-[#e4348a] hover:bg-[#fff0f7]"
            >
              대시보드
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">조회 내역</div>
            <div className="mt-2 text-3xl font-black text-[#e4348a]">{filteredLogs.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">총 충전</div>
            <div className="mt-2 text-3xl font-black text-[#e4348a]">+{totalCharged.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">총 차감</div>
            <div className="mt-2 text-3xl font-black text-gray-700">-{totalDeducted.toLocaleString()}</div>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="회원 이메일, 관리자, 메모, 토큰 수 검색"
              className="w-full rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
            >
              <option value="전체">전체</option>
              <option value="충전">충전</option>
              <option value="차감">차감</option>
              <option value="조정">조정</option>
              <option value="사용">사용</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2">일시</th>
                  <th className="px-3 py-2">대상 회원</th>
                  <th className="px-3 py-2">처리 관리자</th>
                  <th className="px-3 py-2">구분</th>
                  <th className="px-3 py-2 text-right">토큰</th>
                  <th className="px-3 py-2 text-right">처리 후 잔액</th>
                  <th className="px-3 py-2">메모</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const targetUser = log.user_profile;
                  const adminUser = log.admin_profile;
                  const amount = Number(log.amount || 0);
                  const label = getLogTypeLabel(log.type, amount);
                  const isPlus = amount > 0;

                  return (
                    <tr key={log.id} className="rounded-xl bg-[#fff8fb] shadow-sm">
                      <td className="rounded-l-xl px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-black">{getDisplayName(targetUser, '알 수 없는 회원')}</div>
                        <div className="mt-1 text-xs text-gray-500">{getSubLabel(targetUser, log.user_id)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold">{getDisplayName(adminUser, log.admin_id ? '알 수 없는 관리자' : '-')}</div>
                        <div className="mt-1 text-xs text-gray-500">{getSubLabel(adminUser, log.admin_id || '-')}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            isPlus ? 'bg-[#fff0f7] text-[#e4348a]' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-right font-black ${isPlus ? 'text-[#e4348a]' : 'text-gray-700'}`}>
                        {isPlus ? '+' : ''}
                        {amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {Number(log.balance_after ?? 0).toLocaleString()}
                      </td>
                      <td className="rounded-r-xl px-3 py-3 text-gray-600">{log.memo || '-'}</td>
                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                      토큰 지급 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
