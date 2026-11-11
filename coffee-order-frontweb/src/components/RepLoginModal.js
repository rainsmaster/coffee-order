import React, { useState } from 'react';
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
      const result = await repAPI.twosomeLogin(
        captcha.contextId, captchaAnswer, loginId.trim(), loginPwd);
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
        <form className="rep-login-form" onSubmit={handlePinSubmit}>
          <p className="rep-login-guide">{rep.name} 대표 본인 확인을 위해 PIN을 입력해주세요.</p>
          <label htmlFor="rep-pin">PIN (숫자 6자리)</label>
          <input
            id="rep-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="PIN 입력"
            maxLength={6}
            autoFocus
          />
          {error && <div className="rep-login-error" role="alert">{error}</div>}
          <div className="rep-login-actions">
            <button type="submit" className="admin-btn primary" disabled={loading}>
              {loading ? '확인 중...' : '다음'}
            </button>
            <button type="button" className="admin-btn" onClick={onClose} disabled={loading}>취소</button>
          </div>
        </form>
      ) : (
        <form className="rep-login-form" onSubmit={handleTwosomeSubmit}>
          <p className="rep-login-guide">
            {account?.name || rep.name} 대표의 투썸 계정으로 로그인합니다. 새 로그인으로 인해 투썸하트 앱이 로그아웃될 수 있습니다.
          </p>
          <label htmlFor="twosome-login-id">투썸 아이디</label>
          <input
            id="twosome-login-id"
            type="text"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="투썸하트 아이디"
            autoComplete="off"
          />
          <label htmlFor="twosome-login-pw">패스워드</label>
          <input
            id="twosome-login-pw"
            type="password"
            value={loginPwd}
            onChange={(event) => setLoginPwd(event.target.value)}
            placeholder="패스워드"
            autoComplete="off"
          />
          <div className="rep-login-captcha">
            {captcha ? (
              <img src={captcha.imageBase64} alt="자동 입력 방지 문자" />
            ) : (
              <span>{captchaLoading ? '캡차 로딩 중...' : '캡차를 불러오지 못했습니다.'}</span>
            )}
            <button type="button" className="admin-btn" onClick={requestCaptcha} disabled={captchaLoading || loading}>
              캡차 새로고침
            </button>
          </div>
          <label htmlFor="twosome-captcha-answer">캡차 입력 (6자리 숫자)</label>
          <input
            id="twosome-captcha-answer"
            type="text"
            inputMode="numeric"
            value={captchaAnswer}
            onChange={(event) => setCaptchaAnswer(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="이미지의 숫자 6자리 입력"
            maxLength={6}
          />
          {error && <div className="rep-login-error" role="alert">{error}</div>}
          <div className="rep-login-actions">
            <button type="submit" className="admin-btn primary" disabled={loading || !captcha || !loginId.trim() || !loginPwd}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <button type="button" className="admin-btn" onClick={onClose} disabled={loading}>취소</button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default RepLoginModal;
