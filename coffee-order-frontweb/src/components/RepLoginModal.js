import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import Modal from './Modal';
import { repAPI } from '../services/api';
import './RepLoginModal.css';

const RepLoginModal = ({ rep, onClose, onSuccess }) => {
  const [step, setStep] = useState('pin');
  const [pin, setPin] = useState('');
  const [account, setAccount] = useState(null);
  const [loginId, setLoginId] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCaptcha = async () => {
    setCaptchaLoading(true);
    setError('');
    try {
      const response = await repAPI.twosomeCaptcha();
      setCaptcha(response);
      setCaptchaAnswer('');
    } catch (err) {
      setError(err.message || '캡차를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handlePinSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN은 숫자 6자리여야 합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await repAPI.login(rep.id, pin);
      localStorage.setItem('repToken', result.token);
      const me = await repAPI.me();
      setAccount(me);
      setLoginId(me.twosomeId || '');
      setStep('twosome');
      await requestCaptcha();
    } catch (err) {
      setError(err.message || 'PIN 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwosomeSubmit = async (event) => {
    event.preventDefault();
    if (!loginId.trim() || !loginPwd) {
      setError('투썸 아이디와 패스워드를 입력해주세요.');
      return;
    }
    if (!captcha || !/^\d{6}$/.test(captchaAnswer)) {
      setError('캡차 숫자 6자리를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await repAPI.twosomeLogin(captcha.contextId, captchaAnswer, loginId.trim(), loginPwd);
      if (result.status !== 'SUCCESS') {
        setError(result.message || '투썸 로그인에 실패했습니다.');
        await requestCaptcha();
        return;
      }
      onSuccess(result);
    } catch (err) {
      setError(err.message || '투썸 로그인에 실패했습니다.');
      await requestCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`대표 투썸 로그인 · ${rep.name}`}>
      {step === 'pin' ? (
        <VStack as="form" gap={3} onSubmit={handlePinSubmit}>
          <Text type="supporting">{rep.name} 대표 본인 확인을 위해 PIN을 입력해주세요.</Text>
          <TextInput
            label="PIN (숫자 6자리)"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(value) => setPin(value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="PIN 입력"
            hasAutoFocus
            autoComplete="off"
            width="100%"
          />
          {error && <Text as="p" className="rep-login-error" role="alert">{error}</Text>}
          <HStack gap={2} width="100%">
            <Button type="submit" label="다음" variant="primary" isLoading={loading} isDisabled={loading} width="100%" />
            <Button label="취소" variant="secondary" onClick={onClose} isDisabled={loading} width="100%" />
          </HStack>
        </VStack>
      ) : (
        <VStack as="form" gap={3} onSubmit={handleTwosomeSubmit}>
          <Text type="supporting">
            {account?.name || rep.name} 대표의 투썸 계정으로 로그인합니다. 새 로그인으로 인해 투썸하트 앱이 로그아웃될 수 있습니다.
          </Text>
          <TextInput
            label="투썸 아이디"
            value={loginId}
            onChange={setLoginId}
            placeholder="투썸하트 아이디"
            autoComplete="username"
            hasAutoCorrect={false}
            hasSpellCheck={false}
            width="100%"
          />
          <TextInput
            label="패스워드"
            type="password"
            value={loginPwd}
            onChange={setLoginPwd}
            placeholder="패스워드"
            autoComplete="current-password"
            width="100%"
          />
          <HStack gap={2} align="center" className="rep-login-captcha" width="100%">
            {captcha ? <img src={captcha.imageBase64} alt="자동 입력 방지 문자" /> : <Text type="supporting">{captchaLoading ? '캡차 로딩 중...' : '캡차를 불러오지 못했습니다.'}</Text>}
            <Button label="캡차 새로고침" variant="secondary" onClick={requestCaptcha} isDisabled={captchaLoading || loading} isLoading={captchaLoading} />
          </HStack>
          <TextInput
            label="캡차 입력 (6자리 숫자)"
            inputMode="numeric"
            value={captchaAnswer}
            onChange={(value) => setCaptchaAnswer(value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="이미지의 숫자 6자리 입력"
            autoComplete="off"
            width="100%"
          />
          {error && <Text as="p" className="rep-login-error" role="alert">{error}</Text>}
          <HStack gap={2} width="100%">
            <Button
              type="submit"
              label="로그인"
              variant="primary"
              isLoading={loading}
              isDisabled={loading || !captcha || !loginId.trim() || !loginPwd}
              width="100%"
            />
            <Button label="취소" variant="secondary" onClick={onClose} isDisabled={loading} width="100%" />
          </HStack>
        </VStack>
      )}
    </Modal>
  );
};

export default RepLoginModal;
