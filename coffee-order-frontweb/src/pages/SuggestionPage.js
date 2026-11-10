import React, { useState, useEffect, useCallback } from 'react';
import { suggestionAPI, releaseNoteAPI, adminAPI } from '../services/api';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import ReleaseNoteEditorModal from '../components/ReleaseNoteEditorModal';
import './SuggestionPage.css';
import './SuggestionLayout.css';

function SuggestionPage({ releaseNoteId, onReleaseNoteClosed }) {
  // 목록 상태
  const [pinnedSuggestions, setPinnedSuggestions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // 상세 보기 상태
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [comments, setComments] = useState([]);

  // 모달 상태
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  // 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
    password: ''
  });
  const [commentFormData, setCommentFormData] = useState({
    content: '',
    author: '',
    password: ''
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const [loading, setLoading] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [releaseListLoading, setReleaseListLoading] = useState(false);
  const [selectedReleaseNote, setSelectedReleaseNote] = useState(null);
  const [showReleaseDetailModal, setShowReleaseDetailModal] = useState(false);
  const [showReleaseEditor, setShowReleaseEditor] = useState(false);
  const [releaseEditorNote, setReleaseEditorNote] = useState(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));

  const fetchSuggestions = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const data = await suggestionAPI.getList(page);
      setPinnedSuggestions(data.pinnedSuggestions || []);
      setSuggestions(data.suggestions || []);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (error) {
      setAlertModal({ show: true, message: '목록을 불러오는데 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReleaseNotes = useCallback(async () => {
    setReleaseListLoading(true);
    try {
      const publicNotes = await releaseNoteAPI.getPublished() || [];
      if (!adminToken) {
        setReleaseNotes(publicNotes);
        return;
      }
      try {
        setReleaseNotes(await adminAPI.getReleaseNotes() || []);
      } catch (error) {
        setReleaseNotes(publicNotes);
        if (error.message?.startsWith('ADMIN')) {
          localStorage.removeItem('adminToken');
          setAdminToken(null);
        } else {
          setAlertModal({ show: true, message: '비공개 업데이트는 확인하지 못했습니다. 공개 목록만 표시합니다.' });
        }
      }
    } catch (error) {
      setReleaseNotes([]);
      setAlertModal({ show: true, message: '업데이트 목록을 불러오지 못했습니다.' });
    } finally {
      setReleaseListLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    fetchReleaseNotes();
  }, [fetchReleaseNotes]);

  useEffect(() => {
    let cancelled = false;
    if (!releaseNoteId) return undefined;
    const listedNote = releaseNotes.find((note) => String(note.id) === String(releaseNoteId));
    if (listedNote) {
      setSelectedReleaseNote(listedNote);
      setShowReleaseDetailModal(true);
      return undefined;
    }
    releaseNoteAPI.getById(releaseNoteId).then((note) => {
      if (!cancelled) {
        setSelectedReleaseNote(note);
        setShowReleaseDetailModal(true);
      }
    }).catch(() => {
      if (!cancelled) setAlertModal({ show: true, message: '업데이트를 찾을 수 없거나 아직 공개되지 않았습니다.' });
    });
    return () => { cancelled = true; };
  }, [releaseNoteId, releaseNotes]);

  // 상세 조회
  const handleViewDetail = async (suggestion) => {
    try {
      const detail = await suggestionAPI.getById(suggestion.id);
      const commentsData = await suggestionAPI.getComments(suggestion.id);
      setSelectedSuggestion(detail);
      setComments(commentsData || []);
      setShowDetailModal(true);
    } catch (error) {
      setAlertModal({ show: true, message: '상세 정보를 불러오는데 실패했습니다.' });
    }
  };

  const handleViewRelease = (note) => {
    setSelectedReleaseNote(note);
    setShowReleaseDetailModal(true);
  };

  const closeReleaseDetail = () => {
    setShowReleaseDetailModal(false);
    setSelectedReleaseNote(null);
    if (releaseNoteId) {
      onReleaseNoteClosed?.();
      window.history.replaceState(null, '', '/');
    }
  };

  const openReleaseEditor = (note = null) => {
    if (showReleaseDetailModal) closeReleaseDetail();
    setReleaseEditorNote(note);
    setShowReleaseEditor(true);
  };

  const handleReleaseSaved = (saved, token) => {
    setAdminToken(token);
    setReleaseNotes((current) => current.some((note) => note.id === saved.id)
      ? current.map((note) => note.id === saved.id ? saved : note)
      : [saved, ...current]);
    setShowReleaseEditor(false);
    setReleaseEditorNote(null);
    fetchReleaseNotes();
    setAlertModal({ show: true, message: '업데이트를 저장하고 게시판에 반영했습니다.' });
  };

  const handleReleaseOpinion = () => {
    const version = selectedReleaseNote?.version;
    closeReleaseDetail();
    resetForm();
    setFormData((previous) => ({ ...previous, title: `[${version}] ` }));
    setShowWriteModal(true);
  };

  // 글 작성
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setAlertModal({ show: true, message: '제목을 입력해주세요.' });
      return;
    }
    if (!formData.content.trim()) {
      setAlertModal({ show: true, message: '내용을 입력해주세요.' });
      return;
    }
    if (!formData.author.trim()) {
      setAlertModal({ show: true, message: '이름을 입력해주세요.' });
      return;
    }
    if (!formData.password || formData.password.length < 4) {
      setAlertModal({ show: true, message: '비밀번호는 4자 이상 입력해주세요.' });
      return;
    }

    try {
      if (isEditing && selectedSuggestion) {
        await suggestionAPI.update(selectedSuggestion.id, formData);
        setAlertModal({ show: true, message: '수정되었습니다.' });
      } else {
        await suggestionAPI.create(formData);
        setAlertModal({ show: true, message: '등록되었습니다.' });
      }
      resetForm();
      setShowWriteModal(false);
      fetchSuggestions(currentPage);
    } catch (error) {
      setAlertModal({ show: true, message: error.message || '처리에 실패했습니다.' });
    }
  };

  // 글 수정 시작
  const handleEdit = () => {
    setPendingAction({ type: 'edit' });
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  // 글 삭제
  const handleDelete = () => {
    setConfirmModal({
      show: true,
      message: '정말 삭제하시겠습니까?',
      onConfirm: () => {
        setPendingAction({ type: 'delete' });
        setPasswordInput('');
        setShowPasswordModal(true);
      }
    });
  };

  // 비밀번호 확인 후 처리
  const handlePasswordConfirm = async () => {
    if (!passwordInput) {
      setAlertModal({ show: true, message: '비밀번호를 입력해주세요.' });
      return;
    }

    try {
      if (pendingAction?.type === 'edit') {
        // 수정 모드로 전환
        setFormData({
          title: selectedSuggestion.title,
          content: selectedSuggestion.content,
          author: selectedSuggestion.author,
          password: passwordInput
        });
        setIsEditing(true);
        setShowPasswordModal(false);
        setShowDetailModal(false);
        setShowWriteModal(true);
      } else if (pendingAction?.type === 'delete') {
        await suggestionAPI.delete(selectedSuggestion.id, passwordInput);
        setAlertModal({ show: true, message: '삭제되었습니다.' });
        setShowPasswordModal(false);
        setShowDetailModal(false);
        fetchSuggestions(currentPage);
      } else if (pendingAction?.type === 'deleteComment') {
        await suggestionAPI.deleteComment(pendingAction.commentId, passwordInput);
        setAlertModal({ show: true, message: '댓글이 삭제되었습니다.' });
        setShowPasswordModal(false);
        const commentsData = await suggestionAPI.getComments(selectedSuggestion.id);
        setComments(commentsData || []);
      } else if (pendingAction?.type === 'editComment') {
        // 수정 폼 열기
        const comment = comments.find(c => c.id === pendingAction.commentId);
        if (comment) {
          setCommentFormData({
            content: comment.content,
            author: comment.author,
            password: passwordInput
          });
          setEditingCommentId(pendingAction.commentId);
          setShowPasswordModal(false);
        }
      }
    } catch (error) {
      setAlertModal({ show: true, message: error.message || '비밀번호가 일치하지 않습니다.' });
    }
    setPendingAction(null);
  };

  // 고정/해제
  const handleTogglePin = () => {
    setAdminPasswordInput('');
    setShowAdminModal(true);
  };

  const handleAdminConfirm = async () => {
    if (!adminPasswordInput) {
      setAlertModal({ show: true, message: '관리자 비밀번호를 입력해주세요.' });
      return;
    }

    try {
      const updated = await suggestionAPI.togglePin(selectedSuggestion.id, adminPasswordInput);
      setAlertModal({
        show: true,
        message: updated.pinned ? '고정되었습니다.' : '고정이 해제되었습니다.'
      });
      setShowAdminModal(false);
      setSelectedSuggestion(updated);
      fetchSuggestions(currentPage);
    } catch (error) {
      setAlertModal({ show: true, message: error.message || '관리자 비밀번호가 일치하지 않습니다.' });
    }
  };

  // 댓글 작성
  const handleCommentSubmit = async () => {
    if (!commentFormData.content.trim()) {
      setAlertModal({ show: true, message: '댓글 내용을 입력해주세요.' });
      return;
    }
    if (!commentFormData.author.trim()) {
      setAlertModal({ show: true, message: '이름을 입력해주세요.' });
      return;
    }
    if (!commentFormData.password || commentFormData.password.length < 4) {
      setAlertModal({ show: true, message: '비밀번호는 4자 이상 입력해주세요.' });
      return;
    }

    try {
      if (editingCommentId) {
        await suggestionAPI.updateComment(editingCommentId, commentFormData);
        setAlertModal({ show: true, message: '댓글이 수정되었습니다.' });
      } else {
        await suggestionAPI.createComment(selectedSuggestion.id, commentFormData);
        setAlertModal({ show: true, message: '댓글이 등록되었습니다.' });
      }
      setCommentFormData({ content: '', author: '', password: '' });
      setEditingCommentId(null);
      const commentsData = await suggestionAPI.getComments(selectedSuggestion.id);
      setComments(commentsData || []);
      fetchSuggestions(currentPage);
    } catch (error) {
      setAlertModal({ show: true, message: error.message || '처리에 실패했습니다.' });
    }
  };

  // 댓글 수정 시작
  const handleCommentEdit = (commentId) => {
    setPendingAction({ type: 'editComment', commentId });
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  // 댓글 삭제
  const handleCommentDelete = (commentId) => {
    setConfirmModal({
      show: true,
      message: '댓글을 삭제하시겠습니까?',
      onConfirm: () => {
        setPendingAction({ type: 'deleteComment', commentId });
        setPasswordInput('');
        setShowPasswordModal(true);
      }
    });
  };

  // 폼 리셋
  const resetForm = () => {
    setFormData({ title: '', content: '', author: '', password: '' });
    setIsEditing(false);
    setSelectedSuggestion(null);
  };

  // 날짜 포맷
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  };

  // 페이지 변경
  const handlePageChange = (page) => {
    if (page >= 0 && page < totalPages) {
      fetchSuggestions(page);
    }
  };

  // 페이지네이션 렌더링
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(
        <button
          key={i}
          className={`page-btn ${i === currentPage ? 'active' : ''}`}
          onClick={() => handlePageChange(i)}
        >
          {i + 1}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => handlePageChange(0)}
          disabled={currentPage === 0}
        >
          {'<<'}
        </button>
        <button
          className="page-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          {'<'}
        </button>
        {pages}
        <button
          className="page-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          {'>'}
        </button>
        <button
          className="page-btn"
          onClick={() => handlePageChange(totalPages - 1)}
          disabled={currentPage >= totalPages - 1}
        >
          {'>>'}
        </button>
      </div>
    );
  };

  return (
    <div className="suggestion-page">
      <div className="page-header">
        <PageHeader title="건의와 업데이트" description="팀의 의견과 허다방 개선 소식을 확인하세요." />
        <div className="page-header-actions">
          <button className="release-write-btn" onClick={() => openReleaseEditor()}>업데이트 작성</button>
          <button
            className="write-btn"
            onClick={() => {
              resetForm();
              setShowWriteModal(true);
            }}
          >
            글쓰기
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="suggestion-list">
            {releaseListLoading && releaseNotes.length === 0 && (
              <div className="release-list-status" role="status">업데이트를 불러오는 중...</div>
            )}
            {releaseNotes.map(note => (
              <button
                type="button"
                key={`release-${note.id}`}
                className={`suggestion-item release-item ${note.published ? 'pinned' : 'draft'}`}
                onClick={() => handleViewRelease(note)}
              >
                <span className="suggestion-header">
                  <span className="pin-badge">{note.published ? '[고정]' : '[비공개]'}</span>
                  <span className="update-badge">업데이트</span>
                  <span className="suggestion-title">{note.title}</span>
                </span>
                <span className="suggestion-meta">
                  <span className="author">버전 {note.version}</span>
                  <span className="date">{note.publishedAt ? formatDate(note.publishedAt) : '작성 중'}</span>
                </span>
              </button>
            ))}

            {/* 고정글 */}
            {pinnedSuggestions.map(suggestion => (
              <button
                type="button"
                key={`pinned-${suggestion.id}`}
                className={`suggestion-item pinned ${suggestion.deleted ? 'deleted' : ''}`}
                onClick={() => handleViewDetail(suggestion)}
              >
                <span className="suggestion-header">
                  <span className="pin-badge">[고정]</span>
                  <span className="suggestion-title">{suggestion.title}</span>
                  <span className="comment-count">[{suggestion.commentCount}]</span>
                </span>
                <span className="suggestion-meta">
                  <span className="author">{suggestion.author}</span>
                  <span className="date">{formatDate(suggestion.createdAt)}</span>
                </span>
              </button>
            ))}

            {/* 일반글 */}
            {suggestions.map(suggestion => (
              <button
                type="button"
                key={suggestion.id}
                className={`suggestion-item ${suggestion.deleted ? 'deleted' : ''}`}
                onClick={() => handleViewDetail(suggestion)}
              >
                <span className="suggestion-header">
                  <span className="suggestion-title">{suggestion.title}</span>
                  {suggestion.commentCount > 0 && (
                    <span className="comment-count">[{suggestion.commentCount}]</span>
                  )}
                </span>
                <span className="suggestion-meta">
                  <span className="author">{suggestion.author}</span>
                  <span className="date">{formatDate(suggestion.createdAt)}</span>
                </span>
              </button>
            ))}

            {!releaseListLoading && releaseNotes.length === 0 && pinnedSuggestions.length === 0 && suggestions.length === 0 && (
              <div className="empty-message">등록된 건의사항과 업데이트가 없습니다.</div>
            )}
          </div>

          <div className="list-footer">
            <span className="total-count">건의 {totalElements}개</span>
            {renderPagination()}
          </div>
        </>
      )}

      <Modal isOpen={showReleaseDetailModal} onClose={closeReleaseDetail} title="업데이트">
        {selectedReleaseNote && (
          <div className="detail-view release-detail-view">
            <div className="detail-header">
              <div className="release-detail-badges">
                <span className="pin-badge">{selectedReleaseNote.published ? '[고정]' : '[비공개]'}</span>
                <span className="update-badge">업데이트</span>
              </div>
              <h2>{selectedReleaseNote.title}</h2>
              <div className="detail-meta">
                <span>버전 {selectedReleaseNote.version}</span>
                <span>{selectedReleaseNote.publishedAt ? new Date(selectedReleaseNote.publishedAt).toLocaleString('ko-KR') : '아직 공개되지 않음'}</span>
              </div>
            </div>
            <p className="release-detail-summary">{selectedReleaseNote.summary}</p>
            <div className="detail-content">
              {selectedReleaseNote.content.split('\n').map((line, index) => (
                <p key={index}>{line || '\u00A0'}</p>
              ))}
            </div>
            <div className="detail-actions release-detail-actions">
              {selectedReleaseNote.published && (
                <button className="submit-btn" onClick={handleReleaseOpinion}>이 버전의 의견 남기기</button>
              )}
              <button className="action-btn admin" onClick={() => openReleaseEditor(selectedReleaseNote)}>관리자 수정</button>
            </div>
          </div>
        )}
      </Modal>

      <ReleaseNoteEditorModal
        isOpen={showReleaseEditor}
        note={releaseEditorNote}
        onClose={() => { setShowReleaseEditor(false); setReleaseEditorNote(null); }}
        onSaved={handleReleaseSaved}
        onAdminToken={setAdminToken}
      />

      {/* 글쓰기 모달 */}
      <Modal
        isOpen={showWriteModal}
        onClose={() => {
          setShowWriteModal(false);
          resetForm();
        }}
        title={isEditing ? '건의사항 수정' : '건의사항 작성'}
      >
        <div className="write-form">
          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="제목을 입력하세요"
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label>내용</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="내용을 입력하세요"
              maxLength={1000}
              rows={8}
            />
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>이름</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="이름"
                maxLength={50}
              />
            </div>
            <div className="form-group half">
              <label>{isEditing ? '현재 비밀번호' : '비밀번호'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditing ? '현재 비밀번호 입력' : '4자 이상'}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="cancel-btn" onClick={() => {
              setShowWriteModal(false);
              resetForm();
            }}>취소</button>
            <button className="submit-btn" onClick={handleSubmit}>
              {isEditing ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 상세 보기 모달 */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSuggestion(null);
          setComments([]);
          setCommentFormData({ content: '', author: '', password: '' });
          setEditingCommentId(null);
        }}
        title="건의사항"
      >
        {selectedSuggestion && (
          <div className="detail-view">
            <div className="detail-header">
              <h2 className={selectedSuggestion.pinned ? 'pinned-title' : ''}>
                {selectedSuggestion.pinned && <span className="pin-badge">[고정]</span>}
                {selectedSuggestion.title}
              </h2>
              <div className="detail-meta">
                <span>{selectedSuggestion.author}</span>
                <span>{new Date(selectedSuggestion.createdAt).toLocaleString('ko-KR')}</span>
              </div>
            </div>

            <div className="detail-content">
              {selectedSuggestion.content.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>

            {!selectedSuggestion.deleted && (
              <div className="detail-actions">
                <button className="action-btn" onClick={handleEdit}>수정</button>
                <button className="action-btn delete" onClick={handleDelete}>삭제</button>
                <button className="action-btn admin" onClick={handleTogglePin}>
                  {selectedSuggestion.pinned ? '고정해제' : '고정'}
                </button>
              </div>
            )}

            {/* 댓글 영역 */}
            <div className="comments-section">
              <h3>댓글 ({comments.filter(c => !c.deleted).length})</h3>

              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment.id} className={`comment-item ${comment.deleted ? 'deleted' : ''}`}>
                    {comment.deleted ? (
                      <p className="deleted-comment">삭제된 댓글입니다</p>
                    ) : editingCommentId === comment.id ? (
                      <div className="comment-edit-form">
                        <textarea
                          value={commentFormData.content}
                          onChange={(e) => setCommentFormData({ ...commentFormData, content: e.target.value })}
                          maxLength={500}
                          rows={3}
                        />
                        <div className="comment-edit-actions">
                          <button onClick={() => {
                            setEditingCommentId(null);
                            setCommentFormData({ content: '', author: '', password: '' });
                          }}>취소</button>
                          <button onClick={handleCommentSubmit}>수정</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="comment-header">
                          <span className="comment-author">{comment.author}</span>
                          <span className="comment-date">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="comment-content">{comment.content}</p>
                        <div className="comment-actions">
                          <button onClick={() => handleCommentEdit(comment.id)}>수정</button>
                          <button onClick={() => handleCommentDelete(comment.id)}>삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* 댓글 작성 폼 */}
              {!selectedSuggestion.deleted && !editingCommentId && (
                <div className="comment-form">
                  <textarea
                    value={commentFormData.content}
                    onChange={(e) => setCommentFormData({ ...commentFormData, content: e.target.value })}
                    placeholder="댓글을 입력하세요"
                    maxLength={500}
                    rows={3}
                  />
                  <div className="comment-form-row">
                    <input
                      type="text"
                      value={commentFormData.author}
                      onChange={(e) => setCommentFormData({ ...commentFormData, author: e.target.value })}
                      placeholder="이름"
                      maxLength={50}
                    />
                    <input
                      type="password"
                      value={commentFormData.password}
                      onChange={(e) => setCommentFormData({ ...commentFormData, password: e.target.value })}
                      placeholder="비밀번호 (4자 이상)"
                    />
                    <button onClick={handleCommentSubmit}>등록</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 비밀번호 확인 모달 */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordInput('');
          setPendingAction(null);
        }}
        title="비밀번호 확인"
      >
        <div className="password-form">
          <p>비밀번호를 입력해주세요.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="비밀번호"
            onKeyPress={(e) => e.key === 'Enter' && handlePasswordConfirm()}
            autoFocus
          />
          <div className="form-actions">
            <button className="cancel-btn" onClick={() => {
              setShowPasswordModal(false);
              setPasswordInput('');
              setPendingAction(null);
            }}>취소</button>
            <button className="submit-btn" onClick={handlePasswordConfirm}>확인</button>
          </div>
        </div>
      </Modal>

      {/* 관리자 비밀번호 모달 */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => {
          setShowAdminModal(false);
          setAdminPasswordInput('');
        }}
        title="관리자 인증"
      >
        <div className="password-form">
          <p>관리자 비밀번호를 입력해주세요.</p>
          <input
            type="password"
            value={adminPasswordInput}
            onChange={(e) => setAdminPasswordInput(e.target.value)}
            placeholder="관리자 비밀번호"
            onKeyPress={(e) => e.key === 'Enter' && handleAdminConfirm()}
            autoFocus
          />
          <div className="form-actions">
            <button className="cancel-btn" onClick={() => {
              setShowAdminModal(false);
              setAdminPasswordInput('');
            }}>취소</button>
            <button className="submit-btn" onClick={handleAdminConfirm}>확인</button>
          </div>
        </div>
      </Modal>

      {/* 알림 모달 */}
      <AlertModal
        isOpen={alertModal.show}
        message={alertModal.message}
        onClose={() => setAlertModal({ show: false, message: '' })}
      />

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.show}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm?.();
          setConfirmModal({ show: false, message: '', onConfirm: null });
        }}
        onClose={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
      />
    </div>
  );
}

export default SuggestionPage;
