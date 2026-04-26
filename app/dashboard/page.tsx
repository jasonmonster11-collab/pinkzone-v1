'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Sister = {
  id: string;
  name: string;
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

export default function PinkZone() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [activeMenu, setActiveMenu] = useState('후기생성준비기');

  const [sisters, setSisters] = useState<Sister[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [extraOrders, setExtraOrders] = useState<ExtraOrder[]>([]);

  // 언니정보 모달
  const [showSisterModal, setShowSisterModal] = useState(false);
  const [editingSister, setEditingSister] = useState<Sister | null>(null);
  const [sisterForm, setSisterForm] = useState({ name: '', spec: '', memo: '' });
  const [sisterSearch, setSisterSearch] = useState('');

  // 후기 모달
  const [selectedSisterId, setSelectedSisterId] = useState('');
  const [reviewForm, setReviewForm] = useState({ title: '', content: '' });
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
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
  const [prepExtraSearch, setPrepExtraSearch] = useState('');
  const [prepReviewSearch, setPrepReviewSearch] = useState('');
  const [prepSelectedSisterId, setPrepSelectedSisterId] = useState('');
  const [prepSelectedExtraOrderIds, setPrepSelectedExtraOrderIds] = useState<string[]>([]);
  const [prepSelectedReviewIds, setPrepSelectedReviewIds] = useState<string[]>([]);
  const [prepAdditionalNote, setPrepAdditionalNote] = useState('');
  const [mergedPrompt, setMergedPrompt] = useState('');
  const [viewingPrepReview, setViewingPrepReview] = useState<Review | null>(null);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      await loadAllData(user.id);
      setCheckingAuth(false);
    }

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const todayText = () => new Date().toISOString().split('T')[0];

  const loadAllData = async (currentUserId: string) => {
    const [sistersResult, reviewsResult, extraOrdersResult] = await Promise.all([
      supabase
        .from('sisters')
        .select('id, name, spec, memo, created_at')
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
    ]);

    if (sistersResult.error || reviewsResult.error || extraOrdersResult.error) {
      console.error({
        sistersError: sistersResult.error,
        reviewsError: reviewsResult.error,
        extraOrdersError: extraOrdersResult.error,
      });
      alert('DB 데이터를 불러오지 못했습니다. Supabase 테이블과 RLS 정책을 먼저 확인해주세요.');
      return;
    }

    setSisters((sistersResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
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

  // ==================== 공통 필터 ====================
  const filteredSisters = sisters
    .filter(s =>
      s.name.toLowerCase().includes(sisterSearch.toLowerCase()) ||
      s.spec.toLowerCase().includes(sisterSearch.toLowerCase()) ||
      (s.memo || '').toLowerCase().includes(sisterSearch.toLowerCase())
    );

  const filteredReviews = reviews
    .filter(r =>
      r.sisterName.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      r.title.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      r.content.toLowerCase().includes(reviewSearch.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
      setSisterForm({ name: sister.name, spec: sister.spec, memo: sister.memo || '' });
    } else {
      setEditingSister(null);
      setSisterForm({ name: '', spec: '', memo: '' });
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
          spec: sisterForm.spec,
          memo: sisterForm.memo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingSister.id)
        .eq('user_id', currentUserId)
        .select('id, name, spec, memo')
        .single();

      if (error) {
        console.error(error);
        alert('언니정보 수정 실패');
        return;
      }

      setSisters(sisters.map(s => s.id === editingSister.id ? {
        id: data.id,
        name: data.name,
        spec: data.spec,
        memo: data.memo || '',
      } : s));
    } else {
      const { data, error } = await supabase
        .from('sisters')
        .insert({
          user_id: currentUserId,
          name: sisterForm.name,
          spec: sisterForm.spec,
          memo: sisterForm.memo,
        })
        .select('id, name, spec, memo')
        .single();

      if (error) {
        console.error(error);
        alert('언니정보 등록 실패');
        return;
      }

      setSisters([{
        id: data.id,
        name: data.name,
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
      console.error(error);
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
        console.error(error);
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
        console.error(error);
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
      console.error(error);
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
      console.error(error);
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
        console.error(error);
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
        console.error(error);
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
      console.error(error);
      alert('추가오더 삭제 실패');
      return;
    }

    setExtraOrders(extraOrders.filter(o => o.id !== id));
    setPrepSelectedExtraOrderIds(prepSelectedExtraOrderIds.filter(orderId => orderId !== id));
  };

  // ==================== 후기생성준비기 ====================
  const prepFilteredSisters = sisters.filter(s =>
    s.name.toLowerCase().includes(prepSisterSearch.toLowerCase()) ||
    s.spec.toLowerCase().includes(prepSisterSearch.toLowerCase()) ||
    (s.memo || '').toLowerCase().includes(prepSisterSearch.toLowerCase())
  );

  const prepFilteredExtraOrders = extraOrders.filter(o =>
    o.title.toLowerCase().includes(prepExtraSearch.toLowerCase()) ||
    o.prompt.toLowerCase().includes(prepExtraSearch.toLowerCase()) ||
    (o.memo || '').toLowerCase().includes(prepExtraSearch.toLowerCase())
  );

  const prepFilteredReviews = reviews.filter(r =>
    r.sisterName.toLowerCase().includes(prepReviewSearch.toLowerCase()) ||
    r.title.toLowerCase().includes(prepReviewSearch.toLowerCase()) ||
    r.content.toLowerCase().includes(prepReviewSearch.toLowerCase())
  );

  const togglePrepExtraOrder = (id: string) => {
    if (prepSelectedExtraOrderIds.includes(id)) {
      setPrepSelectedExtraOrderIds(prepSelectedExtraOrderIds.filter(orderId => orderId !== id));
    } else {
      setPrepSelectedExtraOrderIds([...prepSelectedExtraOrderIds, id]);
    }
  };

  const togglePrepReview = (id: string) => {
    if (prepSelectedReviewIds.includes(id)) {
      setPrepSelectedReviewIds(prepSelectedReviewIds.filter(reviewId => reviewId !== id));
      return;
    }

    if (prepSelectedReviewIds.length >= 2) {
      alert('언니 후기는 최대 2개까지만 불러올 수 있습니다.');
      return;
    }

    setPrepSelectedReviewIds([...prepSelectedReviewIds, id]);
  };

  const buildMergedPrompt = () => {
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
        ? `이름: ${selectedSister.name}\n스펙/특징:\n${selectedSister.spec}\n${selectedSister.memo ? `\n메모:\n${selectedSister.memo}` : ''}`
        : '선택된 언니정보 없음',
      '',
      '[2번 테이블] 불러온 추가 오더',
      selectedExtraOrders.length
        ? selectedExtraOrders.map((o, index) =>
            `${index + 1}. ${o.title}\n${o.prompt}${o.memo ? `\n메모: ${o.memo}` : ''}`
          ).join('\n\n')
        : '선택된 추가오더 없음',
      '',
      '[3번 테이블] 불러온 기존 언니 후기 2개',
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
    setMergedPrompt(result);
    alert('✅ 5번 테이블에 합쳐서 저장했습니다.');
  };

  const copyMergedPrompt = async () => {
    if (!mergedPrompt.trim()) return alert('먼저 5번 테이블에 합쳐서 저장해주세요.');

    try {
      await navigator.clipboard.writeText(mergedPrompt);
      alert('✅ 복사 완료!');
    } catch {
      alert('복사에 실패했습니다. 내용을 직접 선택해서 복사해주세요.');
    }
  };

  const downloadMergedPrompt = () => {
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
  const resetWorkingState = () => {
    // 언니정보 작성/수정 중이던 임시값
    setShowSisterModal(false);
    setEditingSister(null);
    setSisterForm({ name: '', spec: '', memo: '' });
    setSisterSearch('');

    // 언니후기 작성/수정 중이던 임시값
    setSelectedSisterId('');
    setReviewForm({ title: '', content: '' });
    setEditingReview(null);
    setReviewSearch('');
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
    setPrepExtraSearch('');
    setPrepReviewSearch('');
    setPrepSelectedSisterId('');
    setPrepSelectedExtraOrderIds([]);
    setPrepSelectedReviewIds([]);
    setPrepAdditionalNote('');
    setMergedPrompt('');
    setViewingPrepReview(null);
  };

  const changeMenu = (menuId: string) => {
    if (menuId === activeMenu) return;
    resetWorkingState();
    setActiveMenu(menuId);
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
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
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">💖</div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">핑크 존</h1>
              <p className="text-[11px] text-gray-600 -mt-1">작가작성 템플릿</p>
            </div>
          </div>

          <div className="flex gap-2 flex-nowrap flex-1 items-center overflow-x-auto">
            {[
              { id: '후기생성준비기', label: '후기생성준비기' },
              { id: '언니정보 검색/저장', label: '언니정보 검색/저장' },
              { id: '언니후기 검색/저장', label: '언니후기 검색/저장' },
              { id: '추가오더 등록/수정', label: '추가오더 등록/수정' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => changeMenu(m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  activeMenu === m.id ? 'bg-orange-500 text-white shadow-md' : 'bg-white border hover:bg-orange-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="text-right hidden lg:block">
              <p className="text-[11px] text-gray-500 leading-tight">로그인 계정</p>
              <p className="text-xs font-semibold text-gray-800 leading-tight">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={downloadBackup}
              className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold whitespace-nowrap hover:bg-pink-700"
            >
              백업 다운로드
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

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* 후기생성준비기 */}
        {activeMenu === '후기생성준비기' && (
          <div className="space-y-8">
            <div className="bg-white rounded-3xl shadow p-8">
              <h2 className="text-3xl font-bold mb-3">후기생성준비기</h2>
              <p className="text-gray-600">
                언니정보, 추가오더, 기존 후기 2개, 추가사항을 불러온 뒤 5번 테이블에서 하나의 프롬프트로 합쳐 저장하고 메모장 파일로 내려받는 화면입니다.
              </p>
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

              <div className="max-h-[420px] overflow-y-auto border rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-pink-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 w-20">선택</th>
                      <th className="px-4 py-3 w-40">이름</th>
                      <th className="px-4 py-3">스펙/특징</th>
                      <th className="px-4 py-3 w-56">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepFilteredSisters.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">저장된 언니정보가 없습니다.</td>
                      </tr>
                    )}

                    {prepFilteredSisters.map(s => (
                      <tr key={s.id} className="border-t align-top hover:bg-pink-50">
                        <td className="px-4 py-3">
                          <input
                            type="radio"
                            name="prepSister"
                            checked={prepSelectedSisterId === s.id}
                            onChange={() => {
                              setPrepSelectedSisterId(s.id);
                              // 1번 테이블에서 언니정보를 선택하면 0번 테이블 이름도 항상 같이 변경
                              // 이전 입력값이 남아서 다른 이름으로 합쳐지는 문제 방지
                              setTargetSisterName(s.name);
                            }}
                            className="w-5 h-5"
                          />
                        </td>
                        <td className="px-4 py-3 font-bold">{s.name}</td>
                        <td className="px-4 py-3">
                          <div
                            className="text-sm leading-6"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {s.spec}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="text-sm text-gray-600 leading-6"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {s.memo || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  <h3 className="text-2xl font-bold">언니후기 2개 불러오기</h3>
                </div>
                <input
                  type="text"
                  value={prepReviewSearch}
                  onChange={e => setPrepReviewSearch(e.target.value)}
                  placeholder="후기 검색"
                  className="border rounded-2xl px-5 py-3 w-80"
                />
              </div>

              <p className="mb-4 text-sm text-gray-600">현재 선택된 후기: {prepSelectedReviewIds.length}/2개</p>

              <div className="max-h-[360px] overflow-y-auto border rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-16">선택</th>
                      <th className="p-3 w-28">날짜</th>
                      <th className="p-3 w-28">언니</th>
                      <th className="p-3 w-52">제목</th>
                      <th className="p-3">내용 미리보기</th>
                      <th className="p-3 w-24 text-center">보기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepFilteredReviews.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-gray-500">저장된 후기가 없습니다.</td>
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
                  <button onClick={buildMergedPrompt} className="bg-orange-500 text-white px-6 py-3 rounded-2xl hover:bg-orange-600">
                    합쳐서 저장
                  </button>
                  <button onClick={copyMergedPrompt} className="border px-6 py-3 rounded-2xl hover:bg-gray-50">
                    복사
                  </button>
                  <button onClick={downloadMergedPrompt} className="bg-pink-600 text-white px-6 py-3 rounded-2xl hover:bg-pink-700">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSisters.map(s => (
                <div key={s.id} className="border rounded-2xl p-6">
                  <div className="flex justify-between gap-3">
                    <h3 className="font-bold text-2xl">{s.name}</h3>
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
              <select value={selectedSisterId} onChange={e => setSelectedSisterId(e.target.value)} className="w-full border rounded-2xl px-4 py-3 mb-4">
                <option value="">언니 선택</option>
                {sisters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
