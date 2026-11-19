import React, { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminAPI } from '../services/api';
import Modal from './Modal';

const emptyForm = { version: '', title: '', summary: '', content: '', published: false };

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
      version: note.version || '', title: note.title || '', summary: note.summary || '',
      content: note.content || '', published: Boolean(note.published),
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

  const actions = (
    <HStack gap={2} justify="end" width="100%">
      <Button label="취소" variant="secondary" onClick={onClose} />
      <Button
        label={adminToken ? '저장' : '로그인'}
        variant="primary"
        onClick={adminToken ? handleSave : handleLogin}
        isLoading={adminToken ? saving : loginLoading}
        isDisabled={adminToken ? saving : loginLoading}
      />
    </HStack>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={note ? '업데이트 수정' : '업데이트 작성'}>
      {!adminToken ? (
        <VStack gap={3} width="100%">
          <Text type="supporting">업데이트 작성과 수정은 관리자만 할 수 있습니다.</Text>
          <TextInput
            label="관리자 비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            onEnter={handleLogin}
            placeholder="관리자 비밀번호"
            autoComplete="current-password"
            hasAutoFocus
            width="100%"
          />
          {error && <Banner status="error" title="로그인 실패" description={error} />}
          {actions}
        </VStack>
      ) : (
        <VStack gap={3} width="100%">
          <HStack gap={2} wrap="wrap" width="100%">
            <TextInput label="버전" value={form.version} onChange={(value) => change('version', value)} placeholder="예: 2026.11.1" />
            <TextInput label="제목" value={form.title} onChange={(value) => change('title', value)} />
          </HStack>
          <TextArea label="팝업 요약" value={form.summary} onChange={(value) => change('summary', value)} rows={3} htmlMaxLength={1000} width="100%" />
          <TextArea
            label="상세 내용"
            value={form.content}
            onChange={(value) => change('content', value)}
            rows={10}
            htmlMaxLength={10000}
            placeholder="새 기능, 개선 사항, 제거된 기능을 구분해 입력하세요."
            width="100%"
          />
          <CheckboxInput
            label="게시판에 고정하고 최신 공개 버전으로 안내"
            value={form.published}
            onChange={(checked) => change('published', checked)}
          />
          <Text type="supporting">공개된 업데이트는 건의 게시판에 항상 보관되며, 가장 최신 공개 글이 팝업에 표시됩니다.</Text>
          {error && <Banner status="error" title="저장 실패" description={error} />}
          {actions}
        </VStack>
      )}
    </Modal>
  );
};

export default ReleaseNoteEditorModal;
