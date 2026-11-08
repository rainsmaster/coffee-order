import React, { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

const emptyForm = {
  version: '',
  title: '',
  summary: '',
  content: '',
  published: false,
};

const ReleaseNotesAdmin = ({ onError, onSaved }) => {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await adminAPI.getReleaseNotes() || []);
    } catch (err) {
      if (err.message?.includes('ADMIN')) {
        localStorage.removeItem('adminToken');
        setAdminToken(null);
      }
      onError(err.message || '릴리즈 노트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (adminToken) loadNotes();
  }, [loadNotes, adminToken]);

  const handleLogin = async () => {
    if (!password) {
      onError('관리자 비밀번호를 입력해주세요.');
      return;
    }
    setLoginLoading(true);
    try {
      const result = await adminAPI.login(password);
      localStorage.setItem('adminToken', result.token);
      setAdminToken(result.token);
      setPassword('');
    } catch (err) {
      onError(err.message || '관리자 로그인에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const handleEdit = (note) => {
    setEditingId(note.id);
    setForm({
      version: note.version,
      title: note.title,
      summary: note.summary,
      content: note.content,
      published: Boolean(note.published),
    });
  };

  const handleSave = async () => {
    if (!form.version.trim() || !form.title.trim() || !form.summary.trim() || !form.content.trim()) {
      onError('버전, 제목, 요약, 내용을 모두 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await adminAPI.updateReleaseNote(editingId, form);
      } else {
        await adminAPI.createReleaseNote(form);
      }
      setEditingId(null);
      setForm(emptyForm);
      await loadNotes();
      onSaved('릴리즈 노트를 저장했습니다.');
    } catch (err) {
      onError(err.message || '릴리즈 노트 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="admin-login-card">
        <h2>관리자 로그인</h2>
        <p className="admin-login-desc">릴리즈 노트 작성과 공개는 관리자만 가능합니다.</p>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleLogin()} placeholder="관리자 비밀번호" />
        <button className="admin-btn primary" onClick={handleLogin} disabled={loginLoading}>{loginLoading ? '로그인 중...' : '로그인'}</button>
      </div>
    );
  }

  return (
    <div className="release-notes-admin">
      <div className="admin-form-card">
        <h2>{editingId ? '릴리즈 노트 수정' : '릴리즈 노트 작성'}</h2>
        <div className="release-note-form-grid">
          <label>버전<input value={form.version} onChange={(e) => change('version', e.target.value)} placeholder="예: 2026.11.1" maxLength={50} /></label>
          <label>제목<input value={form.title} onChange={(e) => change('title', e.target.value)} maxLength={200} /></label>
        </div>
        <label>팝업 요약<textarea value={form.summary} onChange={(e) => change('summary', e.target.value)} rows={3} maxLength={1000} /></label>
        <label>상세 내용<textarea value={form.content} onChange={(e) => change('content', e.target.value)} rows={10} maxLength={10000} placeholder="새 기능, 개선 사항, 제거된 기능을 구분해 입력하세요." /></label>
        <label className="release-note-publish"><input type="checkbox" checked={form.published} onChange={(e) => change('published', e.target.checked)} /> 공개하고 최신 공개 버전으로 안내</label>
        <div className="admin-header-actions">
          <button className="admin-btn primary" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          {editingId && <button className="admin-btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>수정 취소</button>}
        </div>
      </div>
      <div className="admin-list-card">
        <h2>릴리즈 노트 목록 ({notes.length}건)</h2>
        {loading ? <div className="loading">로딩 중...</div> : notes.length === 0 ? (
          <div className="no-data">등록된 릴리즈 노트가 없습니다.</div>
        ) : notes.map((note) => (
          <div className="release-note-admin-item" key={note.id}>
            <div>
              <strong>{note.version} · {note.title}</strong>
              <p>{note.published ? '공개' : '비공개'} · {note.publishedAt ? new Date(note.publishedAt).toLocaleString('ko-KR') : '공개 시 날짜 자동 지정'}</p>
            </div>
            <button className="admin-btn small" onClick={() => handleEdit(note)}>수정</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReleaseNotesAdmin;
