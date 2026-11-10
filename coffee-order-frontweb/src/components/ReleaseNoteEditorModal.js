import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';
import Modal from './Modal';
import './ReleaseNoteEditorModal.css';

const emptyForm = {
  version: '',
  title: '',
  summary: '',
  content: '',
  published: false,
};

const ReleaseNoteEditorModal = ({ isOpen, note, onClose, onSaved, onAdminToken }) => {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loginLoading, setLoginLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAdminToken(localStorage.getItem('adminToken'));
    setForm(note ? {
      version: note.version || '',
      title: note.title || '',
      summary: note.summary || '',
      content: note.content || '',
      published: Boolean(note.published),
    } : emptyForm);
    setPassword('');
    setError('');
  }, [isOpen, note]);

  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const handleLogin = async () => {
    if (!password) {
      setError('관리자 비밀번호를 입력해주세요.');
      return;
    }
    setLoginLoading(true);
    setError('');
    try {
      const result = await adminAPI.login(password);
      localStorage.setItem('adminToken', result.token);
      setAdminToken(result.token);
      onAdminToken(result.token);
      setPassword('');
    } catch (err) {
      setError(err.message || '관리자 로그인에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.version.trim() || !form.title.trim() || !form.summary.trim() || !form.content.trim()) {
      setError('버전, 제목, 요약, 내용을 모두 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = note?.id
        ? await adminAPI.updateReleaseNote(note.id, form)
        : await adminAPI.createReleaseNote(form);
      onSaved(saved, adminToken);
    } catch (err) {
      if (err.message?.startsWith('ADMIN')) {
        localStorage.removeItem('adminToken');
        setAdminToken(null);
        onAdminToken(null);
      }
      setError(err.message || '업데이트 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={note ? '업데이트 수정' : '업데이트 작성'}>
      {!adminToken ? (
        <div className="release-editor-login">
          <p>업데이트 작성과 수정은 관리자만 할 수 있습니다.</p>
          <label htmlFor="release-admin-password">관리자 비밀번호</label>
          <input
            id="release-admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
            placeholder="관리자 비밀번호"
            autoFocus
          />
          {error && <p className="release-editor-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="cancel-btn" onClick={onClose}>취소</button>
            <button className="submit-btn" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </div>
      ) : (
        <div className="release-editor-form">
          <div className="release-editor-grid">
            <label>버전<input value={form.version} onChange={(event) => change('version', event.target.value)} placeholder="예: 2026.11.1" maxLength={50} /></label>
            <label>제목<input value={form.title} onChange={(event) => change('title', event.target.value)} maxLength={200} /></label>
          </div>
          <label>팝업 요약<textarea value={form.summary} onChange={(event) => change('summary', event.target.value)} rows={3} maxLength={1000} /></label>
          <label>상세 내용<textarea value={form.content} onChange={(event) => change('content', event.target.value)} rows={10} maxLength={10000} placeholder="새 기능, 개선 사항, 제거된 기능을 구분해 입력하세요." /></label>
          <label className="release-editor-publish">
            <input type="checkbox" checked={form.published} onChange={(event) => change('published', event.target.checked)} />
            게시판에 고정하고 최신 공개 버전으로 안내
          </label>
          <p className="release-editor-guide">공개된 업데이트는 건의 게시판에 항상 보관되며, 가장 최신 공개 글이 팝업에 표시됩니다.</p>
          {error && <p className="release-editor-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="cancel-btn" onClick={onClose}>취소</button>
            <button className="submit-btn" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ReleaseNoteEditorModal;
