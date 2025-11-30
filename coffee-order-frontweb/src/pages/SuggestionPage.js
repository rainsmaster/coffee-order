import React, { useState, useEffect, useCallback } from 'react';
import { suggestionAPI } from '../services/api';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import './SuggestionPage.css';

function SuggestionPage() {
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

  // 로딩 상태
  const [loading, setLoading] = useState(false);

  // 목록 조회
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

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

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
        <h1>건의사항</h1>
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

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="suggestion-list">
            {/* 고정글 */}
            {pinnedSuggestions.map(suggestion => (
              <div
                key={`pinned-${suggestion.id}`}
                className={`suggestion-item pinned ${suggestion.deleted ? 'deleted' : ''}`}
                onClick={() => handleViewDetail(suggestion)}
              >
                <div className="suggestion-header">
                  <span className="pin-badge">[고정]</span>
                  <span className="suggestion-title">{suggestion.title}</span>
                  <span className="comment-count">[{suggestion.commentCount}]</span>
                </div>
                <div className="suggestion-meta">
                  <span className="author">{suggestion.author}</span>
                  <span className="date">{formatDate(suggestion.createdAt)}</span>
                </div>
              </div>
            ))}

            {/* 일반글 */}
            {suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className={`suggestion-item ${suggestion.deleted ? 'deleted' : ''}`}
                onClick={() => handleViewDetail(suggestion)}
              >
                <div className="suggestion-header">
                  <span className="suggestion-title">{suggestion.title}</span>
                  {suggestion.commentCount > 0 && (
                    <span className="comment-count">[{suggestion.commentCount}]</span>
                  )}
                </div>
                <div className="suggestion-meta">
                  <span className="author">{suggestion.author}</span>
                  <span className="date">{formatDate(suggestion.createdAt)}</span>
                </div>
              </div>
            ))}

            {pinnedSuggestions.length === 0 && suggestions.length === 0 && (
              <div className="empty-message">등록된 건의사항이 없습니다.</div>
            )}
          </div>

          <div className="list-footer">
            <span className="total-count">전체 {totalElements}개</span>
            {renderPagination()}
          </div>
        </>
      )}

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
