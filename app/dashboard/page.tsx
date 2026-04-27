'use client';

import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Sister = {
  id: string;
  name: string;
  category: string;
  spec: string;
  memo?: string;
};

type Review = {
  id: string;
  sisterId: string;
  sisterName: string;
  date: string;
  title: string;
  content: string;
};

type ExtraOrder = {
  id: string;
  title: string;
  prompt: string;
  memo?: string;
  date: string;
};

type BoardType = 'notice' | 'qna';

type BoardPost = {
  id: string;
  boardType: BoardType;
  title: string;
  content: string;
  userId?: string | null;
  userEmail?: string | null;
  isSecret: boolean;
  answer?: string | null;
  answerUserEmail?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

type UserProfile = {
  roleLevel: number;
  tokens: number;
  isAdmin: boolean;
  canGenerateReview: boolean;
};

const SISTER_CATEGORIES = ['안마', '건마', '오피', '술집', '휴게텔', '기타'];
const SISTER_CATEGORY_FILTERS = ['전체', ...SISTER_CATEGORIES];
const MERGE_PROMPT_TOKEN_COST = 50;

export default function PinkZone() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    roleLevel: 5,
    tokens: 0,
    isAdmin: false,
    canGenerateReview: false,
  });
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeMenu, setActiveMenu] = useState('HOME');
  const [reviewMenuOpen, setReviewMenuOpen] = useState(false);

  const mainMenus = [
    { id: 'HOME', label: 'HOME' },
    { id: '공지사항', label: '공지사항' },
    { id: 'Q&A', label: 'Q&A' },
  ];

  const reviewMenus = [
    { id: '후기생성준비기', label: '리뷰조합기' },
    { id: '언니정보 검색/저장', label: '언니 데이터' },
    { id: '언니후기 검색/저장', label: '언니후기 데이터' },
    { id: '추가오더 등록/수정', label: '프롬프트 오더' },
  ];

  const isReviewMenuActive = reviewMenus.some((m) => m.id === activeMenu);
  const REVIEW_COMBINE_TOKEN_COST = 1;
  const canUseReviewGenerator = userProfile.isAdmin || userProfile.canGenerateReview;

  const [sisters, setSisters] = useState<Sister[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [extraOrders, setExtraOrders] = useState<ExtraOrder[]>([]);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);

  // 게시판
  const [boardSearch, setBoardSearch] = useState('');
  const [boardForm, setBoardForm] = useState({ title: '', content: '', isSecret: false });
  const [editingBoardPost, setEditingBoardPost] = useState<BoardPost | null>(null);
  const [viewingBoardPost, setViewingBoardPost] = useState<BoardPost | null>(null);
  const [boardAnswerText, setBoardAnswerText] = useState('');

  // 언니정보 모달
  const [showSisterModal, setShowSisterModal] = useState(false);
  const [editingSister, setEditingSister] = useState<Sister | null>(null);
  const [sisterForm, setSisterForm] = useState({ name: '', category: '안마', spec: '', memo: '' });
  const [sisterSearch, setSisterSearch] = useState('');
  const [sisterCategoryFilter, setSisterCategoryFilter] = useState('전체');

  // 후기 모달
  const [selectedSisterId, setSelectedSisterId] = useState('');
  const [reviewForm, setReviewForm] = useState({ title: '', content: '' });
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSisterCategoryFilter, setReviewSisterCategoryFilter] = useState('전체');
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [viewingReview, setViewingReview] = useState<Review | null>(null);

  // 추가오더
  const [extraOrderForm, setExtraOrderForm] = useState({ title: '', prompt: '', memo: '' });
  const [editingExtraOrder, setEditingExtraOrder] = useState<ExtraOrder | null>(null);
  const [extraOrderSearch, setExtraOrderSearch] = useState('');

  // 후기생성준비기
  const [targetSisterName, setTargetSisterName] = useState('');
  const [prepSisterSearch, setPrepSisterSearch] = useState('');
  const [prepSisterCategoryFilter, setPrepSisterCategoryFilter] = useState('전체');
  const [prepExtraSearch, setPrepExtraSearch] = useState('');
  const [prepReviewSearch, setPrepReviewSearch] = useState('');
  const [prepReviewCategoryFilter, setPrepReviewCategoryFilter] = useState('전체');
  const [prepReviewSisterId, setPrepReviewSisterId] = useState('');
  const [isPrepReviewPickerOpen, setIsPrepReviewPickerOpen] = useState(true);
  const [prepSelectedSisterId, setPrepSelectedSisterId] = useState('');
  const [prepSelectedExtraOrderIds, setPrepSelectedExtraOrderIds] = useState<string[]>([]);
  const [prepSelectedReviewIds, setPrepSelectedReviewIds] = useState<string[]>([]);
  const [prepAdditionalNote, setPrepAdditionalNote] = useState('');
  const [mergedPrompt, setMergedPrompt] = useState('');
  const [viewingPrepReview, setViewingPrepReview] = useState<Review | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);
        await Promise.all([
          loadUserProfile(user.id),
          loadAllData(user.id),
        ]);
        setCheckingAuth(false);
      } catch (error) {
        // Refresh Token 오류가 개발 오버레이로 뜨지 않도록 조용히 세션을 정리합니다.

        // Supabase refresh token이 만료/초기화되었을 때 남아있는 로컬 세션 정리
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (signOutError) {
          void signOutError;
        }

        if (typeof window !== 'undefined') {
          Object.keys(window.localStorage)
            .filter((key) => key.startsWith('sb-') || key.includes('supabase'))
            .forEach((key) => window.localStorage.removeItem(key));
        }

        setCheckingAuth(false);
        router.push('/');
      }
    }

    checkUser();
  }, [router]);

  const loadUserProfile = async (currentUserId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (error) {
      console.warn('Profile load failed:', error);
      setUserProfile({ roleLevel: 5, tokens: 0, isAdmin: false, canGenerateReview: false });
      return;
    }

    const roleLevel = Number(data?.role_level ?? 5);
    setUserProfile({
      roleLevel,
      tokens: Number(data?.tokens ?? 0),
      isAdmin: Boolean(data?.is_admin) || roleLevel === 1 || roleLevel === 2,
      canGenerateReview: Boolean(data?.can_generate_review),
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getRoleLabel = (level: number) => {
    const labels: Record<number, string> = {
      1: '1등급 · 최고관리자',
      2: '2등급 · 관리자',
      3: '3등급 · VIP 회원',
      4: '4등급 · 유료회원',
      5: '5등급 · 기본회원',
    };

    return labels[level] || `${level}등급`;
  };

  const todayText = () => new Date().toISOString().split('T')[0];

  const getSupabaseErrorMessage = (error: any) => {
    if (!error) return '알 수 없는 오류';
    const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
    if (parts.length) return parts.join(' / ');
    try {
      const json = JSON.stringify(error);
      return json && json !== '{}' ? json : 'Supabase 권한 또는 테이블 구조를 확인해주세요.';
    } catch {
      return String(error);
    }
  };


  const loadAllData = async (currentUserId: string) => {
    const [sistersResult, reviewsResult, extraOrdersResult, boardsResult] = await Promise.all([
      supabase
        .from('sisters')
        .select('id, name, category, spec, memo, created_at')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, sister_id, sister_name, review_date, title, content, created_at')
        .eq('user_id', currentUserId)
        .order('review_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('extra_orders')
        .select('id, title, prompt, memo, order_date, created_at')
        .eq('user_id', currentUserId)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('boards')
        .select('id, board_type, title, content, user_id, user_email, is_secret, answer, answer_user_email, created_at, updated_at')
        .order('created_at', { ascending: false }),
    ]);

    if (sistersResult.error || reviewsResult.error || extraOrdersResult.error || boardsResult.error) {
      console.warn({
        sistersError: sistersResult.error,
        reviewsError: reviewsResult.error,
        extraOrdersError: extraOrdersResult.error,
        boardsError: boardsResult.error,
      });
      alert('DB 데이터를 불러오지 못했습니다. Supabase 테이블/RLS 정책을 확인해주세요.\n\n' + getSupabaseErrorMessage(sistersResult.error || reviewsResult.error || extraOrdersResult.error || boardsResult.error));
      return;
    }

    setSisters((sistersResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category || '기타',
      spec: row.spec,
      memo: row.memo || '',
    })));

    setReviews((reviewsResult.data || []).map((row) => ({
      id: row.id,
      sisterId: row.sister_id || '',
      sisterName: row.sister_name,
      date: row.review_date,
      title: row.title,
      content: row.content,
    })));

    setExtraOrders((extraOrdersResult.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      memo: row.memo || '',
      date: row.order_date,
    })));

    setBoardPosts((boardsResult.data || []).map((row) => ({
      id: row.id,
      boardType: (row.board_type === 'qna' ? 'qna' : 'notice') as BoardType,
      title: row.title,
      content: row.content,
      userId: row.user_id || null,
      userEmail: row.user_email || null,
      isSecret: Boolean(row.is_secret),
      answer: row.answer || '',
      answerUserEmail: row.answer_user_email || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at || null,
    })));
  };

  const requireUserId = () => {
    if (!userId) {
      alert('로그인이 필요합니다. 다시 로그인해주세요.');
      router.push('/');
      return null;
    }

    return userId;
  };

  const downloadBackup = () => {
    const backup = {
      app: 'pink-zone',
      userEmail,
      exportedAt: new Date().toISOString(),
      sisters,
      reviews,
      extraOrders,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `pink-zone-backup-${todayText()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const normalizeBackupArray = (value: unknown) => Array.isArray(value) ? value : [];

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const currentUserId = requireUserId();
    const file = event.target.files?.[0];

    if (!currentUserId || !file) {
      if (event.target) event.target.value = '';
      return;
    }

    const confirmRestore = window.confirm(
      '백업 파일을 현재 로그인 계정 데이터에 합치기 복구합니다.\n\n같은 ID의 데이터는 백업 내용으로 업데이트되고, 없는 데이터는 새로 추가됩니다. 진행할까요?'
    );

    if (!confirmRestore) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup || backup.app !== 'pink-zone') {
        alert('핑크존 백업 파일이 아닙니다.');
        return;
      }

      const backupSisters = normalizeBackupArray(backup.sisters);
      const backupReviews = normalizeBackupArray(backup.reviews);
      const backupExtraOrders = normalizeBackupArray(backup.extraOrders);

      const sisterRows = backupSisters
        .filter((item: any) => item?.id && item?.name && item?.spec)
        .map((item: any) => ({
          id: item.id,
          user_id: currentUserId,
          name: String(item.name),
          category: String(item.category || '기타'),
          spec: String(item.spec),
          memo: String(item.memo || ''),
          updated_at: new Date().toISOString(),
        }));

      const reviewRows = backupReviews
        .filter((item: any) => item?.id && item?.title && item?.content)
        .map((item: any) => ({
          id: item.id,
          user_id: currentUserId,
          sister_id: item.sisterId || item.sister_id || null,
          sister_name: String(item.sisterName || item.sister_name || ''),
          review_date: item.date || item.review_date || todayText(),
          title: String(item.title),
          content: String(item.content),
          updated_at: new Date().toISOString(),
        }));

      const extraOrderRows = backupExtraOrders
        .filter((item: any) => item?.id && item?.title && item?.prompt)
        .map((item: any) => ({
          id: item.id,
          user_id: currentUserId,
          title: String(item.title),
          prompt: String(item.prompt),
          memo: String(item.memo || ''),
          order_date: item.date || item.order_date || todayText(),
          updated_at: new Date().toISOString(),
        }));

      const errors: string[] = [];

      if (sisterRows.length > 0) {
        const { error } = await supabase
          .from('sisters')
          .upsert(sisterRows, { onConflict: 'id' });
        if (error) errors.push(error.message);
      }

      if (reviewRows.length > 0) {
        const { error } = await supabase
          .from('reviews')
          .upsert(reviewRows, { onConflict: 'id' });
        if (error) errors.push(error.message);
      }

      if (extraOrderRows.length > 0) {
        const { error } = await supabase
          .from('extra_orders')
          .upsert(extraOrderRows, { onConflict: 'id' });
        if (error) errors.push(error.message);
      }

      if (errors.length > 0) {
        console.warn(errors);
        alert(`백업 복구 중 오류가 발생했습니다.\n\n${errors.join('\n')}`);
        return;
      }

      await loadAllData(currentUserId);
      alert(`✅ 백업 복구 완료!\n\n언니정보 ${sisterRows.length}개\n후기 ${reviewRows.length}개\n추가오더 ${extraOrderRows.length}개`);
    } catch (error) {
      console.warn(error);
      alert('백업 파일을 읽지 못했습니다. JSON 파일 형식을 확인해주세요.');
    } finally {
      event.target.value = '';
    }
  };

  // ==================== 공통 필터 ====================
  const sisterCategoryMap = useMemo(() => {
    const nextMap = new Map<string, string>();

    sisters.forEach((sister) => {
      nextMap.set(sister.id, sister.category || '기타');
      nextMap.set(sister.name, sister.category || '기타');
    });

    return nextMap;
  }, [sisters]);

  const getSisterCategoryByIdOrName = (sisterId: string, sisterName: string) => {
    return sisterCategoryMap.get(sisterId) || sisterCategoryMap.get(sisterName) || '기타';
  };

  const selectedPrepSister = useMemo(
    () => sisters.find(s => s.id === prepSelectedSisterId),
    [sisters, prepSelectedSisterId]
  );

  const selectedPrepReviews = useMemo(
    () => reviews.filter(r => prepSelectedReviewIds.includes(r.id)),
    [reviews, prepSelectedReviewIds]
  );

  const selectedPrepReviewSister = useMemo(
    () => sisters.find(s => s.id === prepReviewSisterId),
    [sisters, prepReviewSisterId]
  );

  const filteredSisters = useMemo(() => {
    const keyword = sisterSearch.toLowerCase();

    return sisters
      .filter(s => sisterCategoryFilter === '전체' || s.category === sisterCategoryFilter)
      .filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        s.category.toLowerCase().includes(keyword) ||
        s.spec.toLowerCase().includes(keyword) ||
        (s.memo || '').toLowerCase().includes(keyword)
      );
  }, [sisters, sisterCategoryFilter, sisterSearch]);

  const filteredReviews = useMemo(() => {
    const keyword = reviewSearch.toLowerCase();

    return reviews
      .filter(r => reviewSisterCategoryFilter === '전체' || getSisterCategoryByIdOrName(r.sisterId, r.sisterName) === reviewSisterCategoryFilter)
      .filter(r => {
        const category = getSisterCategoryByIdOrName(r.sisterId, r.sisterName).toLowerCase();

        return (
          r.sisterName.toLowerCase().includes(keyword) ||
          category.includes(keyword) ||
          r.title.toLowerCase().includes(keyword) ||
          r.content.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reviews, reviewSisterCategoryFilter, reviewSearch, sisterCategoryMap]);

  const reviewFormSisters = useMemo(
    () => sisters.filter(s => reviewSisterCategoryFilter === '전체' || s.category === reviewSisterCategoryFilter),
    [sisters, reviewSisterCategoryFilter]
  );

  const reviewsPerPage = 10;
  const reviewTotalPages = Math.max(1, Math.ceil(filteredReviews.length / reviewsPerPage));
  const safeReviewPage = Math.min(reviewPage, reviewTotalPages);
  const pagedReviews = filteredReviews.slice((safeReviewPage - 1) * reviewsPerPage, safeReviewPage * reviewsPerPage);
  const pageReviewIds = pagedReviews.map(review => review.id);
  const isAllPageReviewsSelected = pageReviewIds.length > 0 && pageReviewIds.every(id => selectedReviewIds.includes(id));

  const filteredExtraOrders = extraOrders
    .filter(o =>
      o.title.toLowerCase().includes(extraOrderSearch.toLowerCase()) ||
      o.prompt.toLowerCase().includes(extraOrderSearch.toLowerCase()) ||
      (o.memo || '').toLowerCase().includes(extraOrderSearch.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => {
    setReviewPage(1);
    setSelectedReviewIds([]);
  }, [reviewSearch]);

  // ==================== 언니정보 ====================
  const openSisterModal = (sister?: Sister) => {
    if (sister) {
      setEditingSister(sister);
      setSisterForm({ name: sister.name, category: sister.category || '기타', spec: sister.spec, memo: sister.memo || '' });
    } else {
      setEditingSister(null);
      setSisterForm({ name: '', category: '안마', spec: '', memo: '' });
    }
    setShowSisterModal(true);
  };

  const saveSister = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!sisterForm.name || !sisterForm.spec) return alert('이름과 스펙은 필수입니다.');

    if (editingSister) {
      const { data, error } = await supabase
        .from('sisters')
        .update({
          name: sisterForm.name,
          category: sisterForm.category,
          spec: sisterForm.spec,
          memo: sisterForm.memo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingSister.id)
        .eq('user_id', currentUserId)
        .select('id, name, category, spec, memo')
        .single();

      if (error) {
        console.warn(error);
        alert('언니정보 수정 실패');
        return;
      }

      setSisters(sisters.map(s => s.id === editingSister.id ? {
        id: data.id,
        name: data.name,
        category: data.category || '기타',
        spec: data.spec,
        memo: data.memo || '',
      } : s));
    } else {
      const { data, error } = await supabase
        .from('sisters')
        .insert({
          user_id: currentUserId,
          name: sisterForm.name,
          category: sisterForm.category,
          spec: sisterForm.spec,
          memo: sisterForm.memo,
        })
        .select('id, name, category, spec, memo')
        .single();

      if (error) {
        console.warn(error);
        alert('언니정보 등록 실패');
        return;
      }

      setSisters([{
        id: data.id,
        name: data.name,
        category: data.category || '기타',
        spec: data.spec,
        memo: data.memo || '',
      }, ...sisters]);
    }

    setShowSisterModal(false);
    alert(editingSister ? '✅ 수정 완료!' : '✅ 등록 완료!');
  };

  const deleteSister = async (id: string) => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    const sister = sisters.find(s => s.id === id);
    if (!sister) return;

    if (!confirm(`정말 ${sister.name} 정보를 삭제하시겠습니까?\n※ 기존에 저장된 후기는 삭제되지 않습니다.`)) return;

    const { error } = await supabase
      .from('sisters')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUserId);

    if (error) {
      console.warn(error);
      alert('언니정보 삭제 실패');
      return;
    }

    setSisters(sisters.filter(s => s.id !== id));

    if (selectedSisterId === id) setSelectedSisterId('');
    if (prepSelectedSisterId === id) setPrepSelectedSisterId('');

    alert('✅ 삭제 완료!');
  };

  // ==================== 후기 ====================
  const saveReview = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!selectedSisterId || !reviewForm.title || !reviewForm.content) {
      return alert('언니, 제목, 내용을 모두 입력해주세요.');
    }

    const sister = sisters.find(s => s.id === selectedSisterId);
    if (!sister) return;

    if (editingReview) {
      const { data, error } = await supabase
        .from('reviews')
        .update({
          sister_id: selectedSisterId,
          sister_name: sister.name,
          review_date: todayText(),
          title: reviewForm.title,
          content: reviewForm.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingReview.id)
        .eq('user_id', currentUserId)
        .select('id, sister_id, sister_name, review_date, title, content')
        .single();

      if (error) {
        console.warn(error);
        alert('후기 수정 실패');
        return;
      }

      setReviews(reviews.map(r => r.id === editingReview.id
        ? {
            id: data.id,
            sisterId: data.sister_id || '',
            sisterName: data.sister_name,
            date: data.review_date,
            title: data.title,
            content: data.content,
          }
        : r
      ));
      alert('✅ 수정되었습니다!');
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: currentUserId,
          sister_id: selectedSisterId,
          sister_name: sister.name,
          review_date: todayText(),
          title: reviewForm.title,
          content: reviewForm.content,
        })
        .select('id, sister_id, sister_name, review_date, title, content')
        .single();

      if (error) {
        console.warn(error);
        alert('후기 저장 실패');
        return;
      }

      const review: Review = {
        id: data.id,
        sisterId: data.sister_id || '',
        sisterName: data.sister_name,
        date: data.review_date,
        title: data.title,
        content: data.content,
      };
      setReviews([review, ...reviews]);
      alert('✅ 저장되었습니다!');
    }

    setReviewForm({ title: '', content: '' });
    setEditingReview(null);
    setSelectedSisterId('');
  };

  const deleteReview = async (id: string) => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUserId);

    if (error) {
      console.warn(error);
      alert('후기 삭제 실패');
      return;
    }

    setReviews(reviews.filter(r => r.id !== id));
    setSelectedReviewIds(selectedReviewIds.filter(reviewId => reviewId !== id));
    setPrepSelectedReviewIds(prepSelectedReviewIds.filter(reviewId => reviewId !== id));
  };

  const toggleReviewSelection = (id: string) => {
    setSelectedReviewIds(prev =>
      prev.includes(id) ? prev.filter(reviewId => reviewId !== id) : [...prev, id]
    );
  };

  const toggleSelectPageReviews = () => {
    setSelectedReviewIds(prev => {
      if (isAllPageReviewsSelected) {
        return prev.filter(id => !pageReviewIds.includes(id));
      }

      return Array.from(new Set([...prev, ...pageReviewIds]));
    });
  };

  const deleteSelectedReviews = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (selectedReviewIds.length === 0) {
      alert('삭제할 후기를 체크해주세요.');
      return;
    }

    if (!confirm(`선택한 후기 ${selectedReviewIds.length}개를 삭제하시겠습니까?`)) return;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .in('id', selectedReviewIds)
      .eq('user_id', currentUserId);

    if (error) {
      console.warn(error);
      alert('선택 후기 삭제 실패');
      return;
    }

    setReviews(reviews.filter(r => !selectedReviewIds.includes(r.id)));
    setPrepSelectedReviewIds(prepSelectedReviewIds.filter(reviewId => !selectedReviewIds.includes(reviewId)));
    setSelectedReviewIds([]);
    alert('✅ 선택한 후기를 삭제했습니다.');
  };

  const startEditReview = (review: Review) => {
    setEditingReview(review);
    setSelectedSisterId(review.sisterId);
    setReviewForm({ title: review.title, content: review.content });
  };

  const extractReviewTextValue = (text: string, labels: string[]) => {
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      for (const label of labels) {
        const regex = new RegExp(`^\\s*(?:\\[?${label}\\]?|${label})\\s*[:：=\\-]\\s*(.+)$`, 'i');
        const match = cleanLine.match(regex);
        if (match?.[1]) return match[1].trim();
      }
    }

    return '';
  };

  const findSisterFromText = (text: string, fileTitle: string) => {
    const extractedName = extractReviewTextValue(text, [
      '언니',
      '언니이름',
      '언니 이름',
      '닉네임',
      '이름',
      'name',
      'sister',
    ]);

    const normalizedExtractedName = extractedName.replace(/\s+/g, '').toLowerCase();
    const normalizedFileTitle = fileTitle.replace(/\s+/g, '').toLowerCase();
    const normalizedText = text.replace(/\s+/g, '').toLowerCase();

    if (normalizedExtractedName) {
      const exactMatch = sisters.find(s => s.name.replace(/\s+/g, '').toLowerCase() === normalizedExtractedName);
      if (exactMatch) return exactMatch;

      const partialMatch = sisters.find(s => {
        const sisterName = s.name.replace(/\s+/g, '').toLowerCase();
        return normalizedExtractedName.includes(sisterName) || sisterName.includes(normalizedExtractedName);
      });
      if (partialMatch) return partialMatch;
    }

    const fileNameMatch = sisters.find(s => normalizedFileTitle.includes(s.name.replace(/\s+/g, '').toLowerCase()));
    if (fileNameMatch) return fileNameMatch;

    const contentMatch = sisters.find(s => normalizedText.includes(s.name.replace(/\s+/g, '').toLowerCase()));
    if (contentMatch) return contentMatch;

    return null;
  };

  const findReviewTitleFromText = (text: string, fileTitle: string) => {
    const extractedTitle = extractReviewTextValue(text, [
      '제목',
      '후기제목',
      '후기 제목',
      'title',
    ]);

    if (extractedTitle) return extractedTitle;

    const firstMeaningfulLine = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('=') && !line.startsWith('['));

    if (firstMeaningfulLine && firstMeaningfulLine.length <= 60) return firstMeaningfulLine;

    return fileTitle;
  };

  const loadReviewTextFile = (file: File) => {
    const isTxtFile = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';

    if (!isTxtFile) {
      alert('txt 메모장 파일만 불러올 수 있습니다.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || '');
      const fileTitle = file.name.replace(/\.txt$/i, '');
      const detectedSister = findSisterFromText(text, fileTitle);
      const detectedTitle = findReviewTitleFromText(text, fileTitle);

      if (detectedSister) {
        setSelectedSisterId(detectedSister.id);
      }

      setReviewForm(prev => ({
        ...prev,
        title: detectedTitle || prev.title || fileTitle,
        content: text,
      }));

      alert(`✅ 메모장 파일을 불러왔습니다.\n제목: ${detectedTitle || fileTitle}\n언니: ${detectedSister ? detectedSister.name : '자동 선택 안 됨'}`);
    };

    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file, 'UTF-8');
  };

  // ==================== 추가오더 ====================
  const saveExtraOrder = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!extraOrderForm.title || !extraOrderForm.prompt) {
      return alert('제목과 추가 프롬프트 내용은 필수입니다.');
    }

    if (editingExtraOrder) {
      const { data, error } = await supabase
        .from('extra_orders')
        .update({
          title: extraOrderForm.title,
          prompt: extraOrderForm.prompt,
          memo: extraOrderForm.memo,
          order_date: todayText(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingExtraOrder.id)
        .eq('user_id', currentUserId)
        .select('id, title, prompt, memo, order_date')
        .single();

      if (error) {
        console.warn(error);
        alert('추가오더 수정 실패');
        return;
      }

      setExtraOrders(extraOrders.map(o => o.id === editingExtraOrder.id
        ? {
            id: data.id,
            title: data.title,
            prompt: data.prompt,
            memo: data.memo || '',
            date: data.order_date,
          }
        : o
      ));
      alert('✅ 추가오더가 수정되었습니다!');
    } else {
      const { data, error } = await supabase
        .from('extra_orders')
        .insert({
          user_id: currentUserId,
          title: extraOrderForm.title,
          prompt: extraOrderForm.prompt,
          memo: extraOrderForm.memo,
          order_date: todayText(),
        })
        .select('id, title, prompt, memo, order_date')
        .single();

      if (error) {
        console.warn(error);
        alert('추가오더 저장 실패');
        return;
      }

      const newOrder: ExtraOrder = {
        id: data.id,
        title: data.title,
        prompt: data.prompt,
        memo: data.memo || '',
        date: data.order_date,
      };
      setExtraOrders([newOrder, ...extraOrders]);
      alert('✅ 추가오더가 저장되었습니다!');
    }

    setExtraOrderForm({ title: '', prompt: '', memo: '' });
    setEditingExtraOrder(null);
  };

  const startEditExtraOrder = (order: ExtraOrder) => {
    setEditingExtraOrder(order);
    setExtraOrderForm({
      title: order.title,
      prompt: order.prompt,
      memo: order.memo || '',
    });
  };

  const cancelEditExtraOrder = () => {
    setEditingExtraOrder(null);
    setExtraOrderForm({ title: '', prompt: '', memo: '' });
  };

  const deleteExtraOrder = async (id: string) => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('extra_orders')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUserId);

    if (error) {
      console.warn(error);
      alert('추가오더 삭제 실패');
      return;
    }

    setExtraOrders(extraOrders.filter(o => o.id !== id));
    setPrepSelectedExtraOrderIds(prepSelectedExtraOrderIds.filter(orderId => orderId !== id));
  };

  // ==================== 후기생성준비기 ====================
  const prepFilteredSisters = useMemo(() => {
    const keyword = prepSisterSearch.toLowerCase();

    return sisters
      .filter(s => prepSisterCategoryFilter === '전체' || s.category === prepSisterCategoryFilter)
      .filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        s.category.toLowerCase().includes(keyword) ||
        s.spec.toLowerCase().includes(keyword) ||
        (s.memo || '').toLowerCase().includes(keyword)
      );
  }, [sisters, prepSisterCategoryFilter, prepSisterSearch]);

  const prepReviewCategorySisters = useMemo(() => {
    const keyword = prepReviewSearch.toLowerCase();

    return sisters
      .filter(s => prepReviewCategoryFilter === '전체' || s.category === prepReviewCategoryFilter)
      .filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        s.category.toLowerCase().includes(keyword) ||
        s.spec.toLowerCase().includes(keyword) ||
        (s.memo || '').toLowerCase().includes(keyword)
      );
  }, [sisters, prepReviewCategoryFilter, prepReviewSearch]);

  const prepFilteredExtraOrders = useMemo(() => {
    const keyword = prepExtraSearch.toLowerCase();

    return extraOrders.filter(o =>
      o.title.toLowerCase().includes(keyword) ||
      o.prompt.toLowerCase().includes(keyword) ||
      (o.memo || '').toLowerCase().includes(keyword)
    );
  }, [extraOrders, prepExtraSearch]);

  const prepFilteredReviews = useMemo(() => {
    const keyword = prepReviewSearch.toLowerCase();

    return reviews
      .filter(r => !prepReviewSisterId || r.sisterId === prepReviewSisterId || r.sisterName === selectedPrepReviewSister?.name)
      .filter(r => prepReviewCategoryFilter === '전체' || getSisterCategoryByIdOrName(r.sisterId, r.sisterName) === prepReviewCategoryFilter)
      .filter(r => {
        const category = getSisterCategoryByIdOrName(r.sisterId, r.sisterName).toLowerCase();

        return (
          r.sisterName.toLowerCase().includes(keyword) ||
          category.includes(keyword) ||
          r.title.toLowerCase().includes(keyword) ||
          r.content.toLowerCase().includes(keyword)
        );
      });
  }, [reviews, prepReviewSisterId, selectedPrepReviewSister?.name, prepReviewCategoryFilter, prepReviewSearch, sisterCategoryMap]);

  const togglePrepExtraOrder = (id: string) => {
    if (prepSelectedExtraOrderIds.includes(id)) {
      setPrepSelectedExtraOrderIds(prepSelectedExtraOrderIds.filter(orderId => orderId !== id));
    } else {
      setPrepSelectedExtraOrderIds([...prepSelectedExtraOrderIds, id]);
    }
  };

  const togglePrepReview = (id: string) => {
    if (prepSelectedReviewIds.includes(id)) {
      const nextIds = prepSelectedReviewIds.filter(reviewId => reviewId !== id);
      setPrepSelectedReviewIds(nextIds);
      if (nextIds.length === 0) setIsPrepReviewPickerOpen(true);
      return;
    }

    const nextIds = [...prepSelectedReviewIds, id];
    setPrepSelectedReviewIds(nextIds);
  };

  const completePrepReviewSelection = () => {
    if (prepSelectedReviewIds.length === 0) {
      alert('불러올 후기를 1개 이상 선택해주세요.');
      return;
    }

    setIsPrepReviewPickerOpen(false);
  };

  const resetPrepSisterSelection = () => {
    setPrepSelectedSisterId('');
    setTargetSisterName('');
  };

  const resetPrepReviewSelection = () => {
    setPrepSelectedReviewIds([]);
    setPrepReviewSisterId('');
    setIsPrepReviewPickerOpen(true);
  };

  const buildMergedPrompt = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    const { data: latestProfile, error: latestProfileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', currentUserId)
      .single();

    if (latestProfileError) {
      alert(
        '토큰 정보를 확인하지 못했습니다.\n\n' +
        'message: ' + (latestProfileError.message || '-') + '\n' +
        'code: ' + (latestProfileError.code || '-')
      );
      return;
    }

    const currentTokens = Number(latestProfile?.tokens ?? 0);

    if (currentTokens < MERGE_PROMPT_TOKEN_COST) {
      alert(
        `토큰이 부족합니다.\n\n` +
        `합쳐서 저장에는 ${MERGE_PROMPT_TOKEN_COST} 토큰이 필요합니다.\n` +
        `현재 보유 토큰: ${currentTokens.toLocaleString()}`
      );
      return;
    }

    const confirmUseToken = window.confirm(
      `${MERGE_PROMPT_TOKEN_COST} 토큰이 소모됩니다.\n\n` +
      `현재 보유 토큰: ${currentTokens.toLocaleString()}\n` +
      `사용 후 보유 토큰: ${(currentTokens - MERGE_PROMPT_TOKEN_COST).toLocaleString()}\n\n` +
      '정말 진행하시겠습니까?'
    );

    if (!confirmUseToken) {
      return;
    }

    const selectedSister = sisters.find(s => s.id === prepSelectedSisterId);
    const selectedExtraOrders = extraOrders.filter(o => prepSelectedExtraOrderIds.includes(o.id));
    const selectedReviews = reviews.filter(r => prepSelectedReviewIds.includes(r.id));

    const targetName = targetSisterName.trim() || selectedSister?.name || '';

    const parts = [
      '==============================',
      '핑크 존 후기 생성 요청서',
      '==============================',
      '',
      '[0번 테이블] 후기를 생성할 언니 이름',
      targetName || '미입력',
      '',
      '[1번 테이블] 불러온 언니 정보',
      selectedSister
        ? `이름: ${selectedSister.name}\n카테고리: ${selectedSister.category}\n스펙/특징:\n${selectedSister.spec}\n${selectedSister.memo ? `\n메모:\n${selectedSister.memo}` : ''}`
        : '선택된 언니정보 없음',
      '',
      '[2번 테이블] 불러온 추가 오더',
      selectedExtraOrders.length
        ? selectedExtraOrders.map((o, index) =>
            `${index + 1}. ${o.title}\n${o.prompt}${o.memo ? `\n메모: ${o.memo}` : ''}`
          ).join('\n\n')
        : '선택된 추가오더 없음',
      '',
      '[3번 테이블] 불러온 기존 언니 후기',
      selectedReviews.length
        ? selectedReviews.map((r, index) =>
            `${index + 1}. ${r.date} / ${r.sisterName} / ${r.title}\n${r.content}`
          ).join('\n\n')
        : '선택된 기존 후기 없음',
      '',
      '[4번 테이블] 추가사항',
      prepAdditionalNote.trim() || '추가사항 없음',
      '',
      '[5번 테이블] 최종 요청',
      '위 내용을 참고해서 자연스러운 후기 글을 작성해주세요.',
      '문장 흐름은 실제 사람이 작성한 것처럼 만들고, 같은 표현이 반복되지 않게 해주세요.',
      '불필요하게 과장된 표현보다 자연스럽고 읽기 편한 느낌으로 작성해주세요.',
      '',
    ];

    const result = parts.join('\n');
    const nextTokens = currentTokens - MERGE_PROMPT_TOKEN_COST;

    const { error: tokenUpdateError } = await supabase
      .from('profiles')
      .update({ tokens: nextTokens })
      .eq('id', currentUserId);

    if (tokenUpdateError) {
      alert(
        '토큰 차감에 실패했습니다.\n\n' +
        'message: ' + (tokenUpdateError.message || '-') + '\n' +
        'code: ' + (tokenUpdateError.code || '-') + '\n' +
        'details: ' + (tokenUpdateError.details || '-') + '\n' +
        'hint: ' + (tokenUpdateError.hint || '-')
      );
      return;
    }

    setUserProfile((prev) => ({
      ...prev,
      tokens: nextTokens,
    }));

    const { error: logError } = await supabase
      .from('token_logs')
      .insert({
        user_id: currentUserId,
        admin_id: null,
        amount: -MERGE_PROMPT_TOKEN_COST,
        balance_after: nextTokens,
        type: 'use',
        memo: '리뷰조합기 합쳐서 저장',
      });

    setMergedPrompt(result);

    if (logError) {
      console.warn('token use log insert failed', logError);
      alert(
        `✅ 5번 테이블에 합쳐서 저장했습니다.\n` +
        `토큰 ${MERGE_PROMPT_TOKEN_COST}개가 차감되었습니다.\n` +
        `현재 보유 토큰: ${nextTokens.toLocaleString()}\n\n` +
        '단, token_logs 기록 저장은 실패했습니다. token_logs RLS 정책을 확인해주세요.'
      );
      return;
    }

    alert(
      `✅ 5번 테이블에 합쳐서 저장했습니다.\n` +
      `토큰 ${MERGE_PROMPT_TOKEN_COST}개가 차감되었습니다.\n` +
      `현재 보유 토큰: ${nextTokens.toLocaleString()}`
    );
  };

  const copyMergedPrompt = async () => {
    if (!canUseReviewGenerator) return alert('후기 생성 기능 권한이 없습니다.');
    if (!mergedPrompt.trim()) return alert('먼저 5번 테이블에 합쳐서 저장해주세요.');

    try {
      await navigator.clipboard.writeText(mergedPrompt);
      alert('✅ 복사 완료!');
    } catch {
      alert('복사에 실패했습니다. 내용을 직접 선택해서 복사해주세요.');
    }
  };

  const downloadMergedPrompt = () => {
    if (!canUseReviewGenerator) return alert('후기 생성 기능 권한이 없습니다.');
    if (!mergedPrompt.trim()) return alert('먼저 5번 테이블에 합쳐서 저장해주세요.');

    const fileNameBase = (targetSisterName.trim() || '후기생성요청서').replace(/[\\/:*?"<>|]/g, '_');
    const blob = new Blob([mergedPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `${fileNameBase}_${todayText()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };


  // ==================== 메뉴 이동 시 작업중 내용 초기화 ====================

  const formatBoardDate = (dateText: string) => {
    if (!dateText) return '-';
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return dateText.slice(0, 10);
    return date.toISOString().slice(0, 10);
  };

  const getBoardLabel = (boardType: BoardType) => boardType === 'notice' ? '공지사항' : 'Q&A';
  const currentBoardType = activeMenu === 'Q&A' ? 'qna' : 'notice';
  const latestNoticePosts = boardPosts.filter(post => post.boardType === 'notice').slice(0, 5);
  const latestQnaPosts = boardPosts.filter(post => post.boardType === 'qna').slice(0, 5);

  const canWriteCurrentBoard = (boardType: BoardType) => boardType === 'qna' || userProfile.isAdmin;
  const canManageBoardPost = (post: BoardPost) => userProfile.isAdmin || post.userId === userId;
  const canViewBoardPost = (post: BoardPost) => !post.isSecret || userProfile.isAdmin || post.userId === userId;

  const filteredBoardPosts = boardPosts
    .filter(post => post.boardType === currentBoardType)
    .filter(post => {
      const keyword = boardSearch.trim().toLowerCase();
      if (!keyword) return true;
      return (
        post.title.toLowerCase().includes(keyword) ||
        post.content.toLowerCase().includes(keyword) ||
        (post.userEmail || '').toLowerCase().includes(keyword)
      );
    });

  const resetBoardForm = () => {
    setBoardForm({ title: '', content: '', isSecret: false });
    setEditingBoardPost(null);
  };

  const openBoardPost = (post: BoardPost) => {
    if (!canViewBoardPost(post)) {
      alert('비밀글은 작성자와 관리자만 확인할 수 있습니다.');
      return;
    }
    setViewingBoardPost(post);
    setBoardAnswerText(post.answer || '');
  };

  const startEditBoardPost = (post: BoardPost) => {
    if (!canManageBoardPost(post)) {
      alert('본인 글 또는 관리자만 수정할 수 있습니다.');
      return;
    }
    setEditingBoardPost(post);
    setBoardForm({ title: post.title, content: post.content, isSecret: post.isSecret });
    setViewingBoardPost(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveBoardPost = async () => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    const boardType = currentBoardType;
    if (!canWriteCurrentBoard(boardType)) {
      alert('공지사항은 관리자만 작성할 수 있습니다.');
      return;
    }

    if (!boardForm.title.trim() || !boardForm.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (editingBoardPost) {
      const { data, error } = await supabase
        .from('boards')
        .update({
          title: boardForm.title.trim(),
          content: boardForm.content.trim(),
          is_secret: boardType === 'qna' ? boardForm.isSecret : false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingBoardPost.id)
        .select('id, board_type, title, content, user_id, user_email, is_secret, answer, answer_user_email, created_at, updated_at')
        .single();

      if (error) {
        console.warn(error);
        alert('게시글 수정 실패\n\n' + getSupabaseErrorMessage(error));
        return;
      }

      const updatedPost: BoardPost = {
        id: data.id,
        boardType: (data.board_type === 'qna' ? 'qna' : 'notice') as BoardType,
        title: data.title,
        content: data.content,
        userId: data.user_id || null,
        userEmail: data.user_email || null,
        isSecret: Boolean(data.is_secret),
        answer: data.answer || '',
        answerUserEmail: data.answer_user_email || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at || null,
      };

      setBoardPosts(prev => prev.map(post => post.id === updatedPost.id ? updatedPost : post));
      resetBoardForm();
      alert('✅ 게시글 수정 완료!');
      return;
    }

    const { data, error } = await supabase
      .from('boards')
      .insert({
        board_type: boardType,
        title: boardForm.title.trim(),
        content: boardForm.content.trim(),
        user_id: currentUserId,
        user_email: userEmail,
        is_secret: boardType === 'qna' ? boardForm.isSecret : false,
      })
      .select('id, board_type, title, content, user_id, user_email, is_secret, answer, answer_user_email, created_at, updated_at')
      .single();

    if (error) {
      console.warn(error);
      alert('게시글 등록 실패\n\n' + getSupabaseErrorMessage(error));
      return;
    }

    const newPost: BoardPost = {
      id: data.id,
      boardType: (data.board_type === 'qna' ? 'qna' : 'notice') as BoardType,
      title: data.title,
      content: data.content,
      userId: data.user_id || null,
      userEmail: data.user_email || null,
      isSecret: Boolean(data.is_secret),
      answer: data.answer || '',
      answerUserEmail: data.answer_user_email || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at || null,
    };

    setBoardPosts(prev => [newPost, ...prev]);
    resetBoardForm();
    alert('✅ 게시글 등록 완료!');
  };

  const deleteBoardPost = async (post: BoardPost) => {
    const currentUserId = requireUserId();
    if (!currentUserId) return;

    if (!canManageBoardPost(post)) {
      alert('본인 글 또는 관리자만 삭제할 수 있습니다.');
      return;
    }

    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', post.id);

    if (error) {
      console.warn(error);
      alert('게시글 삭제 실패\n\n' + getSupabaseErrorMessage(error));
      return;
    }

    setBoardPosts(prev => prev.filter(item => item.id !== post.id));
    if (viewingBoardPost?.id === post.id) setViewingBoardPost(null);
    resetBoardForm();
    alert('✅ 삭제 완료!');
  };

  const saveBoardAnswer = async (post: BoardPost) => {
    if (!userProfile.isAdmin) return;

    const { data, error } = await supabase
      .from('boards')
      .update({
        answer: boardAnswerText.trim(),
        answer_user_email: userEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
      .select('id, board_type, title, content, user_id, user_email, is_secret, answer, answer_user_email, created_at, updated_at')
      .single();

    if (error) {
      console.warn(error);
      alert('답변 저장 실패\n\n' + getSupabaseErrorMessage(error));
      return;
    }

    const updatedPost: BoardPost = {
      id: data.id,
      boardType: (data.board_type === 'qna' ? 'qna' : 'notice') as BoardType,
      title: data.title,
      content: data.content,
      userId: data.user_id || null,
      userEmail: data.user_email || null,
      isSecret: Boolean(data.is_secret),
      answer: data.answer || '',
      answerUserEmail: data.answer_user_email || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at || null,
    };

    setBoardPosts(prev => prev.map(item => item.id === updatedPost.id ? updatedPost : item));
    setViewingBoardPost(updatedPost);
    alert('✅ 답변 저장 완료!');
  };

  const resetWorkingState = () => {
    // 언니정보 작성/수정 중이던 임시값
    setShowSisterModal(false);
    setEditingSister(null);
    setSisterForm({ name: '', category: '안마', spec: '', memo: '' });
    setSisterSearch('');
    setSisterCategoryFilter('전체');

    // 언니후기 작성/수정 중이던 임시값
    setSelectedSisterId('');
    setReviewForm({ title: '', content: '' });
    setEditingReview(null);
    setReviewSearch('');
    setReviewSisterCategoryFilter('전체');
    setSelectedReviewIds([]);
    setReviewPage(1);
    setViewingReview(null);

    // 추가오더 작성/수정 중이던 임시값
    setExtraOrderForm({ title: '', prompt: '', memo: '' });
    setEditingExtraOrder(null);
    setExtraOrderSearch('');

    // 후기생성준비기 0번~5번 임시값
    setTargetSisterName('');
    setPrepSisterSearch('');
    setPrepSisterCategoryFilter('전체');
    setPrepExtraSearch('');
    setPrepReviewSearch('');
    setPrepReviewCategoryFilter('전체');
    setPrepReviewSisterId('');
    setIsPrepReviewPickerOpen(true);
    setPrepSelectedSisterId('');
    setPrepSelectedExtraOrderIds([]);
    setPrepSelectedReviewIds([]);
    setPrepAdditionalNote('');
    setMergedPrompt('');
    setViewingPrepReview(null);

    // 게시판 임시값
    setBoardSearch('');
    resetBoardForm();
    setViewingBoardPost(null);
    setBoardAnswerText('');
  };

  const changeMenu = (menuId: string) => {
    setReviewMenuOpen(false);
    if (menuId === activeMenu) return;
    resetWorkingState();
    setActiveMenu(menuId);
  };

if (checkingAuth) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-5 inline-flex rounded-full border border-pink-500/70 bg-black/80 px-4 py-2 text-xs font-bold tracking-widest text-pink-400 shadow-lg">
          최신패치 4/27
        </div>
        <div className="text-xl font-bold mb-2">PINK ZONE</div>
        <p className="text-sm text-gray-400">로그인 확인 중...</p>
      </div>
    </main>
  );
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 text-black">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 py-2 flex items-center gap-4 flex-nowrap">
          <button
            type="button"
            onClick={() => changeMenu('HOME')}
            className="flex items-center gap-3 shrink-0 rounded-2xl px-2 py-1 text-left transition-all hover:bg-pink-50"
            title="HOME으로 이동"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-sm">💖</div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">핑크 존</h1>
              <p className="text-[11px] text-gray-600 -mt-1">작가작성 템플릿</p>
            </div>
          </button>

          <nav className="flex gap-2 flex-nowrap flex-1 items-center overflow-visible">
            {mainMenus.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => changeMenu(m.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  activeMenu === m.id ? 'bg-pink-100 text-pink-700 shadow-sm' : 'bg-pink-50 border border-pink-100 hover:bg-pink-100'
                }`}
              >
                {m.label}
              </button>
            ))}

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setReviewMenuOpen((v) => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  isReviewMenuActive ? 'bg-pink-600 text-white shadow-sm' : 'bg-pink-50 border border-pink-100 hover:bg-pink-100'
                }`}
              >
                후기 메뉴 ▾
              </button>

              {reviewMenuOpen && (
                <div className="absolute left-0 top-[42px] z-[70] w-52 overflow-hidden rounded-2xl border border-pink-100 bg-white p-2 shadow-xl">
                  {reviewMenus.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => changeMenu(m.id)}
                      className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${
                        activeMenu === m.id ? 'bg-pink-600 text-white' : 'text-gray-800 hover:bg-pink-50 hover:text-pink-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="text-right hidden lg:block">
              <p className="text-[11px] text-gray-500 leading-tight">로그인 계정</p>
              <p className="text-xs font-semibold text-gray-800 leading-tight">{userEmail}</p>
              <p className="text-[11px] font-bold text-pink-600 leading-tight mt-1">
                {getRoleLabel(userProfile.roleLevel)} · 토큰 {userProfile.tokens.toLocaleString()}
              </p>
            </div>
            {userProfile.isAdmin && (
              <button
                type="button"
                onClick={() => router.push('/dashboard/admin/users')}
                className="px-4 py-2 rounded-xl bg-white border border-pink-300 text-pink-700 text-sm font-bold whitespace-nowrap hover:bg-pink-50"
              >
                관리자 페이지
              </button>
            )}
            <button
              type="button"
              onClick={downloadBackup}
              className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold whitespace-nowrap hover:bg-pink-700"
            >
              백업 다운로드
            </button>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={restoreBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-white border border-pink-300 text-pink-700 text-sm font-bold whitespace-nowrap hover:bg-pink-50"
            >
              백업 복구
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold whitespace-nowrap hover:bg-gray-800"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* HOME */}
        {activeMenu === 'HOME' && (
          <div className="mx-auto max-w-5xl space-y-6">
            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {[
                  { title: '리뷰조합기 이용방법', desc: '선택한 데이터를 조합합니다.', menu: '후기생성준비기' },
                  { title: '언니 데이터', desc: '언니의 개인 정보를 기입한다', menu: '언니정보 검색/저장' },
                  { title: '언니후기 데이터', desc: '언니개개인의 후기를 저장한다', menu: '언니후기 검색/저장' },
                  { title: '프롬프트 오더', desc: '후기를 뽑을 때 필요한 요소를 넣어준다', menu: '추가오더 등록/수정' },
                  { title: '리뷰 조합기', desc: '저장된 데이터를 불러와 조합한다', menu: '후기생성준비기' },
                ].map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => changeMenu(card.menu)}
                    className="min-h-[92px] rounded-none border border-gray-300 bg-white px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-pink-400 hover:bg-pink-50"
                  >
                    <div className="text-sm font-extrabold text-gray-900">{card.title}</div>
                    <div className="mt-2 text-xs font-semibold leading-5 text-gray-600">{card.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-gray-900">공지사항</div>
                    <button type="button" onClick={() => changeMenu('공지사항')} className="text-xs font-bold text-pink-600 hover:underline">더보기</button>
                  </div>
                  <div className="min-h-[118px] rounded-xl bg-gray-50 p-3">
                    {latestNoticePosts.length === 0 ? (
                      <div className="flex h-[92px] items-center justify-center text-sm font-bold text-gray-500">등록된 공지사항이 없습니다.</div>
                    ) : (
                      <div className="space-y-2">
                        {latestNoticePosts.map((post) => (
                          <button key={post.id} type="button" onClick={() => openBoardPost(post)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-pink-50">
                            <span className="truncate font-bold text-gray-800">{post.title}</span>
                            <span className="shrink-0 text-xs font-semibold text-gray-400">{formatBoardDate(post.createdAt)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-gray-900">Q&amp;A</div>
                    <button type="button" onClick={() => changeMenu('Q&A')} className="text-xs font-bold text-pink-600 hover:underline">더보기</button>
                  </div>
                  <div className="min-h-[118px] rounded-xl bg-gray-50 p-3">
                    {latestQnaPosts.length === 0 ? (
                      <div className="flex h-[92px] items-center justify-center text-sm font-bold text-gray-500">등록된 Q&amp;A가 없습니다.</div>
                    ) : (
                      <div className="space-y-2">
                        {latestQnaPosts.map((post) => (
                          <button key={post.id} type="button" onClick={() => openBoardPost(post)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-pink-50">
                            <span className="min-w-0 flex-1 truncate font-bold text-gray-800">{post.isSecret ? '🔒 ' : ''}{post.title}</span>
                            {post.answer ? <span className="shrink-0 rounded-full bg-pink-100 px-2 py-1 text-[11px] font-black text-pink-700">답변완료</span> : <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-500">대기</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900">핑크존 대시보드</h2>
                  <p className="mt-1 text-sm font-semibold text-gray-500">저장된 데이터와 주요 메뉴를 한눈에 확인합니다.</p>
                </div>
                <div className="rounded-full bg-pink-600 px-4 py-2 text-xs font-extrabold text-white">최신패치 4/27</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5 text-center">
                  <div className="text-xs font-bold text-gray-500">저장된 언니 데이터</div>
                  <div className="mt-2 text-3xl font-black text-pink-600">{sisters.length}</div>
                </div>
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5 text-center">
                  <div className="text-xs font-bold text-gray-500">저장된 후기 데이터</div>
                  <div className="mt-2 text-3xl font-black text-pink-600">{reviews.length}</div>
                </div>
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5 text-center">
                  <div className="text-xs font-bold text-gray-500">프롬프트 오더</div>
                  <div className="mt-2 text-3xl font-black text-pink-600">{extraOrders.length}</div>
                </div>
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5 text-center">
                  <div className="text-xs font-bold text-gray-500">내 등급</div>
                  <div className="mt-3 text-sm font-black text-pink-600">{getRoleLabel(userProfile.roleLevel)}</div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 p-5">
                  <div className="mb-3 text-sm font-extrabold">최근 저장된 후기</div>
                  {reviews.slice(0, 4).length === 0 ? (
                    <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm font-semibold text-gray-500">아직 저장된 후기가 없습니다.</div>
                  ) : (
                    <div className="space-y-2">
                      {reviews.slice(0, 4).map((review) => (
                        <div key={review.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                          <span className="font-extrabold text-pink-700">{review.sisterName}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="font-semibold text-gray-700">{review.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 p-5">
                  <div className="mb-3 text-sm font-extrabold">빠른 이동</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => changeMenu('후기생성준비기')} className="rounded-xl bg-pink-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-pink-700">리뷰조합기</button>
                    <button type="button" onClick={() => changeMenu('언니정보 검색/저장')} className="rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-extrabold text-pink-700 hover:bg-pink-50">언니 데이터</button>
                    <button type="button" onClick={() => changeMenu('언니후기 검색/저장')} className="rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-extrabold text-pink-700 hover:bg-pink-50">후기 데이터</button>
                    <button type="button" onClick={() => changeMenu('추가오더 등록/수정')} className="rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-extrabold text-pink-700 hover:bg-pink-50">오더 등록</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 게시판 */}
        {(activeMenu === '공지사항' || activeMenu === 'Q&A') && (
          <div className="mx-auto max-w-5xl space-y-6">
            <section className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">{getBoardLabel(currentBoardType)}</h2>
                  <p className="mt-2 text-sm font-semibold text-gray-500">
                    {currentBoardType === 'notice'
                      ? '운영자가 업데이트와 안내사항을 등록하는 공간입니다.'
                      : '사용자가 질문을 남기고 관리자가 답변하는 공간입니다.'}
                  </p>
                </div>
                <button type="button" onClick={() => changeMenu('HOME')} className="rounded-xl border border-pink-200 bg-white px-5 py-3 text-sm font-extrabold text-pink-700 hover:bg-pink-50">
                  HOME으로
                </button>
              </div>
            </section>

            {canWriteCurrentBoard(currentBoardType) ? (
              <section className="rounded-3xl bg-white p-8 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h3 className="text-xl font-black">{editingBoardPost ? '게시글 수정' : `${getBoardLabel(currentBoardType)} 글쓰기`}</h3>
                  {editingBoardPost && (
                    <button type="button" onClick={resetBoardForm} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-gray-50">수정 취소</button>
                  )}
                </div>
                <input
                  type="text"
                  value={boardForm.title}
                  onChange={e => setBoardForm({ ...boardForm, title: e.target.value })}
                  placeholder="제목을 입력하세요"
                  className="mb-4 w-full rounded-2xl border px-5 py-4 text-base font-semibold"
                />
                <textarea
                  value={boardForm.content}
                  onChange={e => setBoardForm({ ...boardForm, content: e.target.value })}
                  placeholder="내용을 입력하세요"
                  className="h-44 w-full rounded-2xl border px-5 py-4 leading-7"
                />
                {currentBoardType === 'qna' && (
                  <label className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-700">
                    <input type="checkbox" checked={boardForm.isSecret} onChange={e => setBoardForm({ ...boardForm, isSecret: e.target.checked })} className="h-4 w-4" />
                    비밀글로 등록
                  </label>
                )}
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={saveBoardPost} className="rounded-2xl bg-pink-600 px-7 py-3 text-sm font-black text-white hover:bg-pink-700">
                    {editingBoardPost ? '수정 저장' : '등록하기'}
                  </button>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-pink-100 bg-white p-5 text-center text-sm font-bold text-gray-500 shadow-sm">
                공지사항은 관리자만 작성할 수 있습니다.
              </section>
            )}

            <section className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h3 className="text-xl font-black">게시글 목록 ({filteredBoardPosts.length}개)</h3>
                <input
                  type="text"
                  value={boardSearch}
                  onChange={e => setBoardSearch(e.target.value)}
                  placeholder="제목/내용/작성자 검색"
                  className="w-full rounded-2xl border px-5 py-3 md:w-80"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-left">
                  <thead className="bg-pink-50">
                    <tr>
                      <th className="w-28 p-4">상태</th>
                      <th className="p-4">제목</th>
                      <th className="w-48 p-4">작성자</th>
                      <th className="w-32 p-4">날짜</th>
                      <th className="w-32 p-4 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoardPosts.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-sm font-semibold text-gray-500">게시글이 없습니다.</td></tr>
                    )}
                    {filteredBoardPosts.map(post => (
                      <tr key={post.id} className="border-t hover:bg-pink-50/40">
                        <td className="p-4">
                          {post.boardType === 'qna'
                            ? (post.answer ? <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-black text-pink-700">답변완료</span> : <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">대기</span>)
                            : <span className="rounded-full bg-pink-600 px-3 py-1 text-xs font-black text-white">공지</span>}
                        </td>
                        <td className="p-4">
                          <button type="button" onClick={() => openBoardPost(post)} className="max-w-[520px] truncate text-left font-extrabold text-gray-800 hover:text-pink-600 hover:underline">
                            {post.isSecret ? '🔒 ' : ''}{!canViewBoardPost(post) ? '비밀글입니다.' : post.title}
                          </button>
                        </td>
                        <td className="p-4 text-sm font-semibold text-gray-500">{post.userEmail || '-'}</td>
                        <td className="p-4 text-sm font-semibold text-gray-500">{formatBoardDate(post.createdAt)}</td>
                        <td className="p-4 text-center">
                          {canManageBoardPost(post) ? (
                            <div className="flex justify-center gap-3 text-sm font-bold">
                              <button type="button" onClick={() => startEditBoardPost(post)} className="text-blue-600 hover:underline">수정</button>
                              <button type="button" onClick={() => deleteBoardPost(post)} className="text-red-600 hover:underline">삭제</button>
                            </div>
                          ) : <span className="text-xs text-gray-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* 후기생성준비기 */}
        {activeMenu === '후기생성준비기' && (
          <div className="space-y-8">
            <div className="bg-white rounded-3xl shadow p-8">
              <h2 className="text-3xl font-bold mb-3">후기생성준비기</h2>
              <p className="text-gray-600">
                언니정보, 추가오더, 기존 후기를 필요한 만큼 선택하고 추가사항을 불러온 뒤 5번 테이블에서 하나의 프롬프트로 합쳐 저장하고 메모장 파일로 내려받는 화면입니다.
              </p>
              {!canUseReviewGenerator && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                  현재 계정은 후기 생성 기능 권한이 없습니다. 관리자 페이지에서 이 회원의 「후기 생성」을 체크하면 조합 기능을 이용할 수 있습니다.
                  <span className="mt-1 block text-xs font-semibold text-red-500">언니 데이터, 후기 데이터, 프롬프트 오더 저장 기능은 계속 이용할 수 있습니다.</span>
                </div>
              )}
              {canUseReviewGenerator && userProfile.tokens < REVIEW_COMBINE_TOKEN_COST && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
                  토큰이 부족합니다. 조합 기능을 이용하려면 최소 {REVIEW_COMBINE_TOKEN_COST}토큰이 필요합니다. 현재 보유 토큰은 {userProfile.tokens.toLocaleString()}개입니다.
                </div>
              )}
            </div>

            {/* 0번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl">0번 테이블</span>
                <h3 className="text-2xl font-bold">후기를 생성할 언니 이름</h3>
              </div>
              <input
                type="text"
                value={targetSisterName}
                onChange={e => setTargetSisterName(e.target.value)}
                placeholder="예: 핑크, 제니, 나나 등 실제 생성할 후기 대상 이름"
                className="w-full border rounded-2xl px-5 py-4 text-lg"
              />
            </section>

            {/* 1번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <span className="bg-pink-600 text-white font-bold px-4 py-2 rounded-xl">1번 테이블</span>
                  <h3 className="text-2xl font-bold">언니정보 불러오기</h3>
                </div>
                <input
                  type="text"
                  value={prepSisterSearch}
                  onChange={e => setPrepSisterSearch(e.target.value)}
                  placeholder="언니정보 검색"
                  className="border rounded-2xl px-5 py-3 w-80"
                />
              </div>

              {selectedPrepSister ? (
                <div className="rounded-2xl border border-pink-200 bg-white px-6 py-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-pink-700">{selectedPrepSister.name} 선택됨</p>
                    <p className="text-sm text-gray-600 mt-1">카테고리: {selectedPrepSister.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetPrepSisterSelection}
                    className="px-5 py-3 rounded-xl border bg-white hover:bg-pink-50 font-semibold"
                  >
                    다시 선택하기
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-pink-50 rounded-2xl p-5 mb-5">
                    <div className="flex flex-wrap justify-center gap-4">
                      {SISTER_CATEGORY_FILTERS.map(category => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setPrepSisterCategoryFilter(category)}
                          className={`min-w-[110px] px-6 py-3 rounded-xl border text-xl font-bold transition-all ${
                            prepSisterCategoryFilter === category
                              ? 'bg-pink-600 text-white border-pink-600 shadow'
                              : 'bg-white hover:bg-pink-100'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-3">
                      카테고리 선택 또는 검색으로 언니를 찾은 뒤 이름 버튼을 눌러주세요.
                    </p>
                  </div>

                  <div className="min-h-[190px] rounded-2xl border border-pink-100 bg-white p-5">
                    {prepFilteredSisters.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">조건에 맞는 언니정보가 없습니다.</div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {prepFilteredSisters.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setPrepSelectedSisterId(s.id);
                              setTargetSisterName(s.name);
                            }}
                            className="px-6 py-3 rounded-xl border bg-pink-50 hover:bg-pink-100 font-bold text-lg shadow-sm"
                            title={`${s.category} · ${s.spec}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <span className="bg-purple-600 text-white font-bold px-4 py-2 rounded-xl">2번 테이블</span>
                  <h3 className="text-2xl font-bold">추가오더 불러오기</h3>
                </div>
                <input
                  type="text"
                  value={prepExtraSearch}
                  onChange={e => setPrepExtraSearch(e.target.value)}
                  placeholder="추가오더 검색"
                  className="border rounded-2xl px-5 py-3 w-80"
                />
              </div>

              <div className="overflow-hidden border rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="p-4 w-20">선택</th>
                      <th className="p-4 w-52">제목</th>
                      <th className="p-4">프롬프트</th>
                      <th className="p-4 w-48">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepFilteredExtraOrders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">저장된 추가오더가 없습니다.</td>
                      </tr>
                    )}

                    {prepFilteredExtraOrders.map(o => (
                      <tr key={o.id} className="border-t align-top">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={prepSelectedExtraOrderIds.includes(o.id)}
                            onChange={() => togglePrepExtraOrder(o.id)}
                            className="w-5 h-5"
                          />
                        </td>
                        <td className="p-4 font-bold">{o.title}</td>
                        <td className="p-4 whitespace-pre-wrap">{o.prompt}</td>
                        <td className="p-4 text-sm text-gray-600 whitespace-pre-wrap">{o.memo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl">3번 테이블</span>
                  <h3 className="text-2xl font-bold">언니후기 불러오기</h3>
                </div>
                <input
                  type="text"
                  value={prepReviewSearch}
                  onChange={e => setPrepReviewSearch(e.target.value)}
                  placeholder="후기 검색"
                  className="border rounded-2xl px-5 py-3 w-80"
                />
              </div>

              {prepSelectedReviewIds.length > 0 && !isPrepReviewPickerOpen ? (
                <div className="rounded-2xl border border-blue-200 bg-white px-6 py-5">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div>
                      <p className="text-lg font-bold text-blue-700">선택된 후기 {selectedPrepReviews.length}개</p>
                      <p className="text-sm text-gray-600 mt-1">필요한 후기를 개수 제한 없이 선택할 수 있습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetPrepReviewSelection}
                      className="px-5 py-3 rounded-xl border bg-white hover:bg-blue-50 font-semibold"
                    >
                      다시 선택하기
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedPrepReviews.map(r => (
                      <div key={r.id} className="rounded-xl bg-blue-50 px-4 py-3 text-sm">
                        <strong>{r.sisterName}</strong> · {r.title}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-blue-50 rounded-2xl p-5 mb-5">
                    <div className="flex flex-wrap justify-center gap-4">
                      {SISTER_CATEGORY_FILTERS.map(category => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setPrepReviewCategoryFilter(category);
                            setPrepReviewSisterId('');
                            setPrepSelectedReviewIds([]);
                            setIsPrepReviewPickerOpen(true);
                          }}
                          className={`min-w-[110px] px-6 py-3 rounded-xl border text-xl font-bold transition-all ${
                            prepReviewCategoryFilter === category
                              ? 'bg-blue-600 text-white border-blue-600 shadow'
                              : 'bg-white hover:bg-blue-100'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-3">
                      카테고리 선택 후 언니 이름 버튼을 누르거나, 검색어로 후기를 찾아 선택하세요.
                    </p>
                  </div>

                  <div className="mb-5 min-h-[120px] rounded-2xl border border-blue-100 bg-white p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <p className="font-bold text-blue-700">
                        {selectedPrepReviewSister ? `${selectedPrepReviewSister.name} 후기 보기` : '언니 이름 선택'}
                      </p>
                      {selectedPrepReviewSister && (
                        <button
                          type="button"
                          onClick={() => {
                            setPrepReviewSisterId('');
                            setPrepSelectedReviewIds([]);
                          }}
                          className="px-4 py-2 rounded-xl border bg-white hover:bg-blue-50 text-sm font-semibold"
                        >
                          언니 선택 해제
                        </button>
                      )}
                    </div>

                    {prepReviewCategorySisters.length === 0 ? (
                      <div className="text-center text-gray-500 py-6">조건에 맞는 언니정보가 없습니다.</div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {prepReviewCategorySisters.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setPrepReviewSisterId(s.id);
                              setPrepSelectedReviewIds([]);
                              setIsPrepReviewPickerOpen(true);
                            }}
                            className={`px-5 py-3 rounded-xl border font-bold text-lg shadow-sm ${
                              prepReviewSisterId === s.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-blue-50 hover:bg-blue-100'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-4">
                    <p className="text-sm font-semibold text-blue-700">선택된 후기 {selectedPrepReviews.length}개</p>
                    <button
                      type="button"
                      onClick={completePrepReviewSelection}
                      className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                    >
                      선택 완료
                    </button>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto border rounded-2xl">
                    <table className="w-full text-left">
                      <thead className="bg-blue-50 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 w-16">선택</th>
                          <th className="p-3 w-28">날짜</th>
                          <th className="p-3 w-28">언니</th>
                          <th className="p-3 w-24">카테고리</th>
                          <th className="p-3 w-52">제목</th>
                          <th className="p-3">내용 미리보기</th>
                          <th className="p-3 w-24 text-center">보기</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prepFilteredReviews.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-gray-500">
                              {selectedPrepReviewSister ? '선택한 언니의 저장된 후기가 없습니다.' : '언니를 선택하거나 검색어를 입력해 후기를 찾아주세요.'}
                            </td>
                          </tr>
                        )}

                        {prepFilteredReviews.map(r => (
                          <tr key={r.id} className="border-t align-top hover:bg-blue-50/40">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={prepSelectedReviewIds.includes(r.id)}
                                onChange={() => togglePrepReview(r.id)}
                                className="w-5 h-5"
                              />
                            </td>
                            <td className="p-3 text-xs text-gray-500">{r.date}</td>
                            <td className="p-3 font-bold">{r.sisterName}</td>
                            <td className="p-3"><span className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{getSisterCategoryByIdOrName(r.sisterId, r.sisterName)}</span></td>
                            <td className="p-3 text-sm font-semibold">
                              <div
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {r.title}
                              </div>
                            </td>
                            <td className="p-3 text-sm text-gray-700">
                              <div
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {r.content}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setViewingPrepReview(r)}
                                className="px-3 py-2 border rounded-xl text-sm hover:bg-blue-50"
                              >
                                보기
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* 4번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="bg-green-600 text-white font-bold px-4 py-2 rounded-xl">4번 테이블</span>
                <h3 className="text-2xl font-bold">추가사항 직접 입력</h3>
              </div>

              <textarea
                value={prepAdditionalNote}
                onChange={e => setPrepAdditionalNote(e.target.value)}
                placeholder="AI 사이트에 같이 넘길 추가사항을 입력하세요. 예: 말투, 길이, 강조할 포인트, 피해야 할 표현 등"
                className="w-full h-44 border rounded-2xl px-5 py-4"
              />
            </section>

            {/* 5번 테이블 */}
            <section className="bg-white rounded-3xl shadow p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <span className="bg-black text-white font-bold px-4 py-2 rounded-xl">5번 테이블</span>
                  <h3 className="text-2xl font-bold">모든 내용을 하나로 합쳐 저장</h3>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={buildMergedPrompt}
                    disabled={!canUseReviewGenerator || userProfile.tokens < REVIEW_COMBINE_TOKEN_COST}
                    className={`px-6 py-3 rounded-2xl text-white ${!canUseReviewGenerator || userProfile.tokens < REVIEW_COMBINE_TOKEN_COST ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                  >
                    합쳐서 저장 (-50)
                  </button>
                  <button
                    onClick={copyMergedPrompt}
                    disabled={!canUseReviewGenerator}
                    className={`border px-6 py-3 rounded-2xl ${!canUseReviewGenerator ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    복사
                  </button>
                  <button
                    onClick={downloadMergedPrompt}
                    disabled={!canUseReviewGenerator}
                    className={`px-6 py-3 rounded-2xl text-white ${!canUseReviewGenerator ? 'bg-gray-300 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700'}`}
                  >
                    메모장 다운로드
                  </button>
                </div>
              </div>

              <textarea
                value={mergedPrompt}
                onChange={e => setMergedPrompt(e.target.value)}
                placeholder="합쳐서 저장 버튼을 누르면 이곳에 AI 사이트로 가져갈 최종 프롬프트가 생성됩니다."
                className="w-full h-96 border rounded-2xl px-5 py-4 font-mono text-sm leading-6"
              />
            </section>
          </div>
        )}

        {/* 언니정보 */}
        {activeMenu === '언니정보 검색/저장' && (
          <div className="bg-white rounded-3xl shadow p-8">
            <div className="flex justify-between gap-5 mb-8">
              <h2 className="text-3xl font-bold">언니정보 검색 / 저장</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={sisterSearch}
                  onChange={e => setSisterSearch(e.target.value)}
                  placeholder="언니정보 검색"
                  className="border rounded-2xl px-5 py-3 w-80"
                />
                <button onClick={() => openSisterModal()} className="bg-pink-600 text-white px-6 py-3 rounded-2xl">+ 새 언니 등록</button>
              </div>
            </div>

            <div className="bg-pink-50 rounded-2xl p-5 mb-6">
              <div className="flex flex-wrap justify-center gap-4">
                {SISTER_CATEGORY_FILTERS.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSisterCategoryFilter(category)}
                    className={`min-w-[110px] px-6 py-3 rounded-xl border text-xl font-bold transition-all ${
                      sisterCategoryFilter === category
                        ? 'bg-pink-600 text-white border-pink-600 shadow'
                        : 'bg-white hover:bg-pink-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSisters.map(s => (
                <div key={s.id} className="border rounded-2xl p-6">
                  <div className="flex justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-2xl">{s.name}</h3>
                      <span className="inline-flex px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold">{s.category}</span>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button onClick={() => openSisterModal(s)} className="text-pink-600 hover:underline">수정</button>
                      <button onClick={() => deleteSister(s.id)} className="text-red-600 hover:underline">삭제</button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-line break-keep leading-7">{s.spec}</p>
                  {s.memo && <p className="mt-3 text-sm text-gray-600 whitespace-pre-line break-keep leading-7">{s.memo}</p>}
                </div>
              ))}

              {filteredSisters.length === 0 && (
                <div className="col-span-full text-center text-gray-500 border rounded-2xl p-10">
                  저장된 언니정보가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 언니후기 */}
        {activeMenu === '언니후기 검색/저장' && (
          <div className="bg-white rounded-3xl shadow p-8">
            <h2 className="text-3xl font-bold mb-8">언니후기 검색 / 저장</h2>

            {/* 작성 폼 */}
            <div className="bg-gray-50 border rounded-2xl p-8 mb-10">
              <h3 className="font-semibold text-xl mb-6">{editingReview ? '후기 수정' : '✍️ 새 후기 작성'}</h3>

              <div className="bg-pink-50 rounded-2xl p-4 mb-4">
                <p className="font-semibold mb-3">언니 카테고리 선택</p>
                <div className="flex flex-wrap gap-3">
                  {SISTER_CATEGORY_FILTERS.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setReviewSisterCategoryFilter(category);
                        setSelectedSisterId('');
                        setReviewPage(1);
                      }}
                      className={`px-5 py-2 rounded-xl border font-bold transition-all ${
                        reviewSisterCategoryFilter === category
                          ? 'bg-pink-600 text-white border-pink-600 shadow'
                          : 'bg-white hover:bg-pink-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <select value={selectedSisterId} onChange={e => setSelectedSisterId(e.target.value)} className="w-full border rounded-2xl px-4 py-3 mb-4">
                <option value="">언니 선택</option>
                {reviewFormSisters.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
              </select>
              <input type="text" placeholder="후기 제목" value={reviewForm.title} onChange={e => setReviewForm({...reviewForm, title: e.target.value})} className="w-full border rounded-2xl px-4 py-3 mb-4" />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) loadReviewTextFile(file);
                }}
                className="border-2 border-dashed border-pink-300 rounded-2xl p-6 text-center mb-4 bg-white hover:bg-pink-50 transition-all"
              >
                <p className="font-semibold mb-2">메모장(.txt) 파일을 여기에 드래그해서 불러오기</p>
                <p className="text-sm text-gray-500 mb-4">또는 아래 버튼으로 파일을 선택하면 후기 내용에 자동 입력됩니다.</p>
                <label className="inline-flex items-center justify-center px-6 py-3 bg-pink-600 text-white rounded-2xl cursor-pointer hover:bg-pink-700">
                  txt 파일 선택
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) loadReviewTextFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              <textarea placeholder="후기 내용..." value={reviewForm.content} onChange={e => setReviewForm({...reviewForm, content: e.target.value})} className="w-full h-52 border rounded-2xl px-4 py-3 mb-6" />
              <div className="flex gap-3">
                <button onClick={saveReview} className="px-10 py-4 bg-pink-600 text-white rounded-2xl hover:bg-pink-700">
                  {editingReview ? '수정 완료' : '후기 저장하기'}
                </button>
                {editingReview && (
                  <button
                    onClick={() => {
                      setEditingReview(null);
                      setSelectedSisterId('');
                      setReviewForm({ title: '', content: '' });
                    }}
                    className="px-10 py-4 border rounded-2xl"
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </div>

            {/* 목록 */}
            <div>
              <div className="bg-pink-50 rounded-2xl p-4 mb-5">
                <p className="font-semibold mb-3">저장된 후기 카테고리 필터</p>
                <div className="flex flex-wrap gap-3">
                  {SISTER_CATEGORY_FILTERS.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setReviewSisterCategoryFilter(category);
                        setReviewSearch('');
                        setReviewPage(1);
                        setSelectedReviewIds([]);
                      }}
                      className={`px-5 py-2 rounded-xl border font-bold transition-all ${
                        reviewSisterCategoryFilter === category
                          ? 'bg-pink-600 text-white border-pink-600 shadow'
                          : 'bg-white hover:bg-pink-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {reviewSisterCategoryFilter !== '전체' && (
                  <div className="mt-4 border-t border-pink-200 pt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-semibold text-gray-700">
                        {reviewSisterCategoryFilter} 카테고리 언니 바로 선택
                      </p>
                      {reviewSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewSearch('');
                            setReviewPage(1);
                            setSelectedReviewIds([]);
                          }}
                          className="text-sm text-pink-600 font-semibold hover:underline"
                        >
                          이름 선택 해제
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sisters
                        .filter(s => s.category === reviewSisterCategoryFilter)
                        .map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setReviewSearch(s.name);
                              setReviewPage(1);
                              setSelectedReviewIds([]);
                            }}
                            className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                              reviewSearch === s.name
                                ? 'bg-black text-white border-black shadow'
                                : 'bg-white hover:bg-pink-100'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}

                      {sisters.filter(s => s.category === reviewSisterCategoryFilter).length === 0 && (
                        <span className="text-sm text-gray-500">
                          이 카테고리에 등록된 언니정보가 없습니다.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center gap-4 mb-6">
                <div>
                  <h3 className="font-semibold text-xl">저장된 후기 ({filteredReviews.length}개)</h3>
                  <p className="text-sm text-gray-500 mt-1">한 화면에 10개씩 표시됩니다.</p>
                </div>
                <input
                  type="text"
                  placeholder="검색"
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="border rounded-2xl px-5 py-3 w-80"
                />
              </div>

              {filteredReviews.length > 0 && (
                <div className="flex items-center justify-between gap-4 mb-4 bg-pink-50 border rounded-2xl px-5 py-4">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={isAllPageReviewsSelected}
                      onChange={toggleSelectPageReviews}
                      className="w-4 h-4"
                    />
                    현재 페이지 전체 선택
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">선택 {selectedReviewIds.length}개</span>
                    <button
                      type="button"
                      onClick={deleteSelectedReviews}
                      disabled={selectedReviewIds.length === 0}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      선택 삭제
                    </button>
                  </div>
                </div>
              )}

              {pagedReviews.map(review => (
                <div key={review.id} className="relative border rounded-2xl p-6 mb-4 bg-white">
                  <div className="absolute right-6 top-5 flex gap-3 text-sm">
                    <button onClick={() => setViewingReview(review)} className="text-gray-700 hover:underline">보기</button>
                    <button onClick={() => startEditReview(review)} className="text-blue-600 hover:underline">수정</button>
                    <button onClick={() => deleteReview(review.id)} className="text-red-600 hover:underline">삭제</button>
                  </div>

                  <div className="flex items-start gap-3 pr-32">
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.includes(review.id)}
                      onChange={() => toggleReviewSelection(review.id)}
                      className="w-5 h-5 mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-500 mb-2">{review.date} • {review.sisterName}</div>
                      <h4 className="font-semibold text-lg mb-2 truncate">{review.title}</h4>
                      <p
                        className="text-gray-700 text-sm leading-6 whitespace-pre-line break-keep overflow-hidden"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {review.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {filteredReviews.length > 0 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setReviewPage(page => Math.max(1, page - 1))}
                    disabled={safeReviewPage === 1}
                    className="px-4 py-2 border rounded-xl disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="text-sm font-semibold">{safeReviewPage} / {reviewTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setReviewPage(page => Math.min(reviewTotalPages, page + 1))}
                    disabled={safeReviewPage === reviewTotalPages}
                    className="px-4 py-2 border rounded-xl disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              )}

              {filteredReviews.length === 0 && (
                <div className="text-center text-gray-500 border rounded-2xl p-10">
                  저장된 후기가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 추가오더 */}
        {activeMenu === '추가오더 등록/수정' && (
          <div className="bg-white rounded-3xl shadow p-8">
            <h2 className="text-3xl font-bold mb-8">추가오더 등록 / 수정</h2>

            <div className="bg-gray-50 border rounded-2xl p-8 mb-10">
              <h3 className="font-semibold text-xl mb-6">
                {editingExtraOrder ? '추가오더 수정' : '추가오더 등록'}
              </h3>

              <input
                type="text"
                placeholder="추가오더 제목"
                value={extraOrderForm.title}
                onChange={e => setExtraOrderForm({ ...extraOrderForm, title: e.target.value })}
                className="w-full border rounded-2xl px-4 py-3 mb-4"
              />

              <textarea
                placeholder="추가 프롬프트 내용"
                value={extraOrderForm.prompt}
                onChange={e => setExtraOrderForm({ ...extraOrderForm, prompt: e.target.value })}
                className="w-full h-44 border rounded-2xl px-4 py-3 mb-4"
              />

              <textarea
                placeholder="메모"
                value={extraOrderForm.memo}
                onChange={e => setExtraOrderForm({ ...extraOrderForm, memo: e.target.value })}
                className="w-full h-24 border rounded-2xl px-4 py-3 mb-6"
              />

              <div className="flex gap-3">
                <button onClick={saveExtraOrder} className="px-10 py-4 bg-pink-600 text-white rounded-2xl hover:bg-pink-700">
                  {editingExtraOrder ? '수정 완료' : '추가오더 저장'}
                </button>

                {editingExtraOrder && (
                  <button onClick={cancelEditExtraOrder} className="px-10 py-4 border rounded-2xl">
                    수정 취소
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between mb-6">
              <h3 className="font-semibold text-xl">저장된 추가오더 ({filteredExtraOrders.length}개)</h3>
              <input
                type="text"
                placeholder="검색"
                value={extraOrderSearch}
                onChange={e => setExtraOrderSearch(e.target.value)}
                className="border rounded-2xl px-5 py-3 w-80"
              />
            </div>

            <div className="overflow-hidden border rounded-2xl">
              <table className="w-full text-left">
                <thead className="bg-pink-50">
                  <tr>
                    <th className="p-4 w-36">날짜</th>
                    <th className="p-4 w-56">제목</th>
                    <th className="p-4">프롬프트</th>
                    <th className="p-4 w-52">메모</th>
                    <th className="p-4 w-32">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExtraOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">저장된 추가오더가 없습니다.</td>
                    </tr>
                  )}

                  {filteredExtraOrders.map(order => (
                    <tr key={order.id} className="border-t align-top">
                      <td className="p-4 text-sm text-gray-500">{order.date}</td>
                      <td className="p-4 font-bold">{order.title}</td>
                      <td className="p-4 whitespace-pre-wrap">{order.prompt}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-pre-wrap">{order.memo || '-'}</td>
                      <td className="p-4">
                        <div className="flex gap-3">
                          <button onClick={() => startEditExtraOrder(order)} className="text-blue-600 hover:underline">수정</button>
                          <button onClick={() => deleteExtraOrder(order.id)} className="text-red-600 hover:underline">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 게시글 보기 */}
      {viewingBoardPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white text-black shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b bg-pink-50 px-6 py-5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-pink-600">{getBoardLabel(viewingBoardPost.boardType)} · {formatBoardDate(viewingBoardPost.createdAt)}</p>
                <h3 className="mt-1 break-words text-2xl font-black text-gray-900">{viewingBoardPost.isSecret ? '🔒 ' : ''}{viewingBoardPost.title}</h3>
                <p className="mt-1 text-xs font-semibold text-gray-500">작성자: {viewingBoardPost.userEmail || '-'}</p>
              </div>
              <button type="button" onClick={() => setViewingBoardPost(null)} className="shrink-0 rounded-xl border bg-white px-4 py-2 text-sm font-bold hover:bg-gray-50">닫기</button>
            </div>
            <div className="max-h-[66vh] overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{viewingBoardPost.content}</pre>

              {viewingBoardPost.boardType === 'qna' && (
                <div className="mt-7 rounded-2xl border border-pink-100 bg-pink-50 p-5">
                  <div className="mb-3 text-sm font-black text-pink-700">관리자 답변</div>
                  {userProfile.isAdmin ? (
                    <>
                      <textarea
                        value={boardAnswerText}
                        onChange={e => setBoardAnswerText(e.target.value)}
                        placeholder="답변을 입력하세요"
                        className="h-32 w-full rounded-2xl border bg-white px-4 py-3 text-sm leading-6"
                      />
                      <div className="mt-3 flex justify-end">
                        <button type="button" onClick={() => saveBoardAnswer(viewingBoardPost)} className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-black text-white hover:bg-pink-700">답변 저장</button>
                      </div>
                    </>
                  ) : viewingBoardPost.answer ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{viewingBoardPost.answer}</pre>
                  ) : (
                    <div className="rounded-xl bg-white px-4 py-5 text-center text-sm font-semibold text-gray-500">아직 답변이 등록되지 않았습니다.</div>
                  )}
                </div>
              )}

              {canManageBoardPost(viewingBoardPost) && (
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" onClick={() => startEditBoardPost(viewingBoardPost)} className="rounded-xl border px-5 py-3 text-sm font-bold hover:bg-gray-50">수정</button>
                  <button type="button" onClick={() => deleteBoardPost(viewingBoardPost)} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700">삭제</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 언니후기 목록 보기 작은 창 */}
      {viewingReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden text-black">
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b bg-pink-50">
              <div>
                <p className="text-sm text-gray-500">{viewingReview.date} · {viewingReview.sisterName}</p>
                <h3 className="text-xl font-bold mt-1">{viewingReview.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReview(null)}
                className="shrink-0 px-4 py-2 border rounded-xl bg-white hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{viewingReview.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 3번 테이블 후기 보기 작은 창 */}
      {viewingPrepReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden text-black">
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b bg-blue-50">
              <div>
                <p className="text-sm text-gray-500">{viewingPrepReview.date} · {viewingPrepReview.sisterName}</p>
                <h3 className="text-xl font-bold mt-1">{viewingPrepReview.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPrepReview(null)}
                className="shrink-0 px-4 py-2 border rounded-xl bg-white hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{viewingPrepReview.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 모달 */}
      {showSisterModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg text-black">
            <h2 className="text-2xl font-bold mb-6">{editingSister ? '언니 수정' : '새 언니 등록'}</h2>
            <input type="text" placeholder="닉네임" value={sisterForm.name} onChange={e => setSisterForm({...sisterForm, name: e.target.value})} className="w-full border rounded-2xl px-4 py-3 mb-4" />
            <select value={sisterForm.category} onChange={e => setSisterForm({...sisterForm, category: e.target.value})} className="w-full border rounded-2xl px-4 py-3 mb-4">
              {SISTER_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <textarea placeholder="스펙 및 특징" value={sisterForm.spec} onChange={e => setSisterForm({...sisterForm, spec: e.target.value})} className="w-full border rounded-2xl px-4 py-3 mb-4 h-40" />
            <textarea placeholder="추가 메모" value={sisterForm.memo} onChange={e => setSisterForm({...sisterForm, memo: e.target.value})} className="w-full border rounded-2xl px-4 py-3 h-28" />
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowSisterModal(false)} className="flex-1 py-4 border rounded-2xl">취소</button>
              <button onClick={saveSister} className="flex-1 py-4 bg-pink-600 text-white rounded-2xl">저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
