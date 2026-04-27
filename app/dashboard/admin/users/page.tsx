'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  email?: string | null;
  nickname?: string | null;
  name?: string | null;
  role_level?: number | null;
  tokens?: number | null;
  is_admin?: boolean | null;
  created_at?: string | null;
};

type FeatureKey =
  | 'review_generator'
  | 'keyword_helper'
  | 'extra_order'
  | 'api_generate'
  | 'auto_save';

type UserFeatureRow = {
  user_id: string;
  feature_key: FeatureKey | string;
  enabled: boolean;
};

const FEATURES: { key: FeatureKey; label: string; desc: string }[] = [
  { key: 'review_generator', label: '후기 생성', desc: '후기생성준비기/후기 생성 기능 사용' },
  { key: 'keyword_helper', label: '키워드 추천', desc: '추후 키워드/문장 추천 기능' },
  { key: 'extra_order', label: '추가오더', desc: '추가오더 프롬프트 관리 기능' },
  { key: 'api_generate', label: 'API 생성', desc: 'GPT API 연동 생성 기능' },
  { key: 'auto_save', label: '자동 저장', desc: '생성 결과 자동 저장 기능' },
];

const ROLE_PRESETS = [
  { value: 1, label: '1등급 - 최고관리자' },
  { value: 2, label: '2등급 - 관리자' },
  { value: 3, label: '3등급 - VIP' },
  { value: 4, label: '4등급 - 유료회원' },
  { value: 5, label: '5등급 - 기본회원' },
];

function getDisplayName(profile: Profile) {
  return profile.nickname || profile.name || profile.email || profile.id;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.slice(0, 10);
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const [selectedRoleLevel, setSelectedRoleLevel] = useState(5);
  const [selectedTokens, setSelectedTokens] = useState(0);
  const [selectedIsAdmin, setSelectedIsAdmin] = useState(false);
  const [featureState, setFeatureState] = useState<Record<string, boolean>>({});

  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenMemo, setTokenMemo] = useState('관리자 수동 충전/차감');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initializeAdminPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAdminPage = async () => {
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
      await loadProfiles();
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');

    if (error) {
      alert('회원 목록을 불러오지 못했습니다. Supabase RLS 정책 또는 profiles 컬럼을 확인해주세요.');
      console.error(error);
      return;
    }

    const rows = ((data || []) as Profile[]).sort((a, b) => {
      const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bd - ad;
    });

    setProfiles(rows);

    if (!selectedUser && rows.length > 0) {
      await selectUser(rows[0]);
    }
  };

  const selectUser = async (profile: Profile) => {
    setSelectedUser(profile);
    setSelectedRoleLevel(Number(profile.role_level ?? 5));
    setSelectedTokens(Number(profile.tokens ?? 0));
    setSelectedIsAdmin(Boolean(profile.is_admin));
    setTokenAmount('');
    setTokenMemo('관리자 수동 충전/차감');

    const baseFeatures = FEATURES.reduce<Record<string, boolean>>((acc, feature) => {
      acc[feature.key] = false;
      return acc;
    }, {});

    const { data, error } = await supabase
      .from('user_features')
      .select('user_id, feature_key, enabled')
      .eq('user_id', profile.id);

    if (error) {
      console.error(error);
      setFeatureState(baseFeatures);
      return;
    }

    ((data || []) as UserFeatureRow[]).forEach((row) => {
      baseFeatures[row.feature_key] = row.enabled;
    });

    setFeatureState(baseFeatures);
  };

  const filteredProfiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return profiles;

    return profiles.filter((profile) => {
      const target = `${profile.email || ''} ${profile.nickname || ''} ${profile.name || ''} ${profile.id}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [profiles, search]);

  const saveUserSettings = async () => {
    if (!selectedUser) return;

    setSaving(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role_level: selectedRoleLevel,
          tokens: selectedTokens,
          is_admin: selectedIsAdmin,
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      const featureRows = FEATURES.map((feature) => ({
        user_id: selectedUser.id,
        feature_key: feature.key,
        enabled: Boolean(featureState[feature.key]),
      }));

      const { error: featureError } = await supabase
        .from('user_features')
        .upsert(featureRows, { onConflict: 'user_id,feature_key' });

      if (featureError) throw featureError;

      alert('회원 권한이 저장되었습니다.');
      await loadProfiles();

      const refreshedUser = {
        ...selectedUser,
        role_level: selectedRoleLevel,
        tokens: selectedTokens,
        is_admin: selectedIsAdmin,
      };
      setSelectedUser(refreshedUser);
    } catch (error) {
      console.error(error);
      alert('저장 중 오류가 발생했습니다. Supabase 정책 또는 테이블 구조를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const applyTokenChange = async () => {
    if (!selectedUser) return;

    const amount = Number(tokenAmount);

    if (!Number.isFinite(amount) || amount === 0) {
      alert('충전/차감할 토큰 수를 입력해주세요. 예: 1000 또는 -500');
      return;
    }

    const nextTokens = selectedTokens + amount;

    if (nextTokens < 0) {
      alert('보유 토큰보다 많이 차감할 수 없습니다.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens: nextTokens })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      const logType = amount > 0 ? 'charge' : 'adjust';
      const { error: logError } = await supabase.from('token_logs').insert({
        user_id: selectedUser.id,
        amount,
        type: logType,
        memo: tokenMemo || '관리자 수동 충전/차감',
      });

      if (logError) throw logError;

      setSelectedTokens(nextTokens);
      setTokenAmount('');
      alert('토큰이 반영되었습니다.');
      await loadProfiles();
    } catch (error) {
      console.error(error);
      alert('토큰 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fff5fa] p-6 text-[#3b2230]">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">관리자 권한 확인 중...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-[#fff5fa] p-6 text-[#3b2230]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#e4348a]">접근 권한이 없습니다</h1>
          <p className="mt-3 text-sm text-gray-600">관리자 전용 회원관리 페이지입니다.</p>
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
            <h1 className="text-2xl font-black text-[#e4348a]">핑크존 관리자 회원관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              회원 등급, 기능 권한, 토큰 충전/차감을 관리합니다.
            </p>
            {adminProfile && (
              <p className="mt-1 text-xs text-gray-400">관리자: {getDisplayName(adminProfile)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border border-[#f3b2d0] bg-white px-4 py-2 text-sm font-bold text-[#e4348a] hover:bg-[#fff0f7]"
          >
            대시보드
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">회원 목록</h2>
              <span className="rounded-full bg-[#fff0f7] px-3 py-1 text-xs font-bold text-[#e4348a]">
                {filteredProfiles.length}명
              </span>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이메일, 닉네임, 회원 ID 검색"
              className="mb-3 w-full rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
            />

            <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
              {filteredProfiles.map((profile) => {
                const active = selectedUser?.id === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => selectUser(profile)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-[#e4348a] bg-[#fff0f7]'
                        : 'border-gray-100 bg-white hover:border-[#f3b2d0] hover:bg-[#fff8fb]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-black">{getDisplayName(profile)}</div>
                      <div className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600">
                        {Number(profile.role_level ?? 5)}등급
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-500">{profile.email || profile.id}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>토큰 {Number(profile.tokens ?? 0).toLocaleString()}</span>
                      <span>{profile.is_admin ? '관리자' : formatDate(profile.created_at)}</span>
                    </div>
                  </button>
                );
              })}

              {filteredProfiles.length === 0 && (
                <div className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">검색된 회원이 없습니다.</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            {!selectedUser ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">회원을 선택해주세요.</div>
            ) : (
              <div>
                <div className="mb-5 border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-black text-[#e4348a]">{getDisplayName(selectedUser)}</h2>
                  <p className="mt-1 text-sm text-gray-500">{selectedUser.email || selectedUser.id}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold">회원 등급</span>
                    <select
                      value={selectedRoleLevel}
                      onChange={(event) => setSelectedRoleLevel(Number(event.target.value))}
                      className="w-full rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
                    >
                      {ROLE_PRESETS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold">보유 토큰</span>
                    <input
                      type="number"
                      value={selectedTokens}
                      onChange={(event) => setSelectedTokens(Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
                    />
                  </label>

                  <label className="flex items-end gap-3 rounded-xl border border-[#f3c4d9] p-3">
                    <input
                      type="checkbox"
                      checked={selectedIsAdmin}
                      onChange={(event) => setSelectedIsAdmin(event.target.checked)}
                      className="h-5 w-5 accent-[#e4348a]"
                    />
                    <span className="text-sm font-bold">관리자 권한 부여</span>
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-[#f3c4d9] bg-[#fff8fb] p-4">
                  <h3 className="mb-3 text-base font-black">토큰 충전 / 차감</h3>
                  <div className="grid gap-3 md:grid-cols-[180px_1fr_120px]">
                    <input
                      type="number"
                      value={tokenAmount}
                      onChange={(event) => setTokenAmount(event.target.value)}
                      placeholder="예: 1000 / -500"
                      className="rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
                    />
                    <input
                      value={tokenMemo}
                      onChange={(event) => setTokenMemo(event.target.value)}
                      placeholder="메모"
                      className="rounded-xl border border-[#f3c4d9] px-3 py-3 text-sm outline-none focus:border-[#e4348a]"
                    />
                    <button
                      type="button"
                      onClick={applyTokenChange}
                      disabled={saving}
                      className="rounded-xl bg-[#e4348a] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      반영
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">양수는 충전, 음수는 차감입니다. 차감 예시는 -500입니다.</p>
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-base font-black">사용 가능 기능</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {FEATURES.map((feature) => (
                      <label
                        key={feature.key}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                          featureState[feature.key]
                            ? 'border-[#e4348a] bg-[#fff0f7]'
                            : 'border-gray-100 bg-white hover:border-[#f3b2d0]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(featureState[feature.key])}
                          onChange={(event) =>
                            setFeatureState((prev) => ({ ...prev, [feature.key]: event.target.checked }))
                          }
                          className="mt-1 h-5 w-5 accent-[#e4348a]"
                        />
                        <span>
                          <span className="block text-sm font-black">{feature.label}</span>
                          <span className="mt-1 block text-xs text-gray-500">{feature.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => selectUser(selectedUser)}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600"
                  >
                    되돌리기
                  </button>
                  <button
                    type="button"
                    onClick={saveUserSettings}
                    disabled={saving}
                    className="rounded-xl bg-[#e4348a] px-6 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    권한 저장
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
