import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI, departmentAPI, teamAPI } from '../services/api';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import RepLoginModal from '../components/RepLoginModal';
import useModal from '../hooks/useModal';
import './AdminPage.css';

const AdminPage = ({ embedded = false }) => {
  const [reps, setReps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [formName, setFormName] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [verifyingRepIds, setVerifyingRepIds] = useState({});
  const [verificationResults, setVerificationResults] = useState({});
  const [loginRep, setLoginRep] = useState(null);
  const {
    isAlertOpen, alertConfig, showAlert, closeAlert,
    isConfirmOpen, confirmConfig, showConfirm, closeConfirm,
  } = useModal();

  const loadReps = useCallback(async () => {
    try {
      setIsLoading(true);
      setReps(await adminAPI.getReps() || []);
    } catch (err) {
      showAlert(err.message || '팀 대표 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [showAlert]);

  const loadTeams = useCallback(async () => {
    try {
      const departments = await departmentAPI.getAll();
      const teamOptions = [];
      for (const dept of departments || []) {
        const deptTeams = await teamAPI.getAll(dept.id);
        for (const team of deptTeams || []) {
          teamOptions.push({ id: team.id, name: team.name, label: `${dept.name} / ${team.name}` });
        }
      }
      setTeams(teamOptions);
    } catch (err) {
      showAlert('팀원 목록을 불러오지 못했습니다.');
    }
  }, [showAlert]);

  useEffect(() => {
    loadReps();
    loadTeams();
  }, [loadReps, loadTeams]);

  const resetForm = () => {
    setEditingRep(null);
    setFormName('');
    setFormTeamId('');
  };

  const handleFormSubmit = async () => {
    if (!formName.trim() || !formTeamId) {
      showAlert('이름과 팀원을 모두 입력해주세요.');
      return;
    }
    try {
      const data = { name: formName.trim(), teamId: parseInt(formTeamId, 10) };
      if (editingRep) {
        await adminAPI.updateRep(editingRep.id, data);
      } else {
        await adminAPI.createRep(data);
      }
      resetForm();
      await loadReps();
      showAlert('팀 대표 정보를 저장했습니다.');
    } catch (err) {
      showAlert(err.message || '저장에 실패했습니다.');
    }
  };

  const handleDelete = (rep) => {
    showConfirm(`'${rep.name}' 대표를 삭제하시겠습니까? PIN과 연동 세션도 관리 대상에서 제외됩니다.`, async () => {
      try {
        await adminAPI.deleteRep(rep.id);
        if (editingRep?.id === rep.id) resetForm();
        await loadReps();
        showAlert('팀 대표가 삭제되었습니다.');
      } catch (err) {
        showAlert(err.message || '삭제에 실패했습니다.');
      }
    });
  };

  const handleVerifyTwosome = async (rep) => {
    setVerifyingRepIds((current) => ({ ...current, [rep.id]: true }));
    try {
      const response = await adminAPI.verifyRepTwosome(rep.id);
      setReps((current) => current.map((item) => item.id === rep.id ? response.rep : item));
      setVerificationResults((current) => ({ ...current, [rep.id]: response }));
    } catch (err) {
      setVerificationResults((current) => ({
        ...current,
        [rep.id]: {
          result: 'TEMPORARY_ERROR',
          message: err.message || '일시적 오류로 확인하지 못했습니다. 기존 세션은 유지됩니다.',
        },
      }));
    } finally {
      setVerifyingRepIds((current) => ({ ...current, [rep.id]: false }));
    }
  };

  const handleLoginSuccess = (rep) => {
    setLoginRep(null);
    setVerificationResults((current) => ({
      ...current,
      [rep.id]: {
        result: 'RELOGINED',
        message: '투썸 로그인에 성공했습니다. 지금 확인으로 검증할 수 있습니다.',
      },
    }));
    loadReps();
  };

  const getTwosomeStatus = (rep) => {
    if (verifyingRepIds[rep.id]) return { label: '확인 중...', className: 'checking' };
    if (verificationResults[rep.id]?.result === 'TEMPORARY_ERROR') {
      return { label: '확인 불가', className: 'unknown' };
    }
    if (rep.autoReloginBlocked) return { label: '자동 로그인 중단', className: 'blocked' };
    if (rep.twosomeStatus === 'ACTIVE') return { label: '정상', className: 'active' };
    if (rep.twosomeStatus === 'EXPIRED') return { label: '만료', className: 'expired' };
    return { label: '로그인 없음', className: 'none' };
  };

  const formatDateTime = (value) => value ? new Date(value).toLocaleString('ko-KR') : '-';

  return (
    <div className={`admin-page ${embedded ? 'embedded' : ''}`}>
      <div className="admin-header">
        <h2>팀 대표 관리</h2>
      </div>
      <p className="admin-principle">누구나 대표를 조회하고 관리할 수 있습니다. 주문자는 주문할 때 대표를 선택하며, 본인의 PIN은 본인만 관리할 수 있습니다.</p>
      <p className="twosome-session-guide">투썸 세션은 10분마다 자동 확인합니다. 버튼을 클릭하면 저장된 상태가 아니라 실제 투썸 서버로 즉시 검증합니다.</p>
      <div className="admin-form-card">
        <h3>{editingRep ? '대표 소속·이름 수정' : '대표 직접 등록'}</h3>
        <div className="admin-form-row">
          <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="이름" />
          <select value={formTeamId} onChange={(e) => setFormTeamId(e.target.value)}>
            <option value="">팀원 선택</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}
          </select>
          <button className="admin-btn primary" onClick={handleFormSubmit}>{editingRep ? '수정' : '등록'}</button>
          {editingRep && <button className="admin-btn" onClick={resetForm}>취소</button>}
        </div>
      </div>
      <div className="admin-list-card">
        <h3>대표 목록 ({reps.length}명)</h3>
        {isLoading ? <div className="loading">로딩 중...</div> : reps.length === 0 ? (
          <div className="no-data">등록된 팀 대표가 없습니다.</div>
        ) : (
          <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>이름</th><th>소속</th><th>PIN 설정</th><th>PIN 최종 로그인</th><th>투썸 상태</th><th>관리</th></tr></thead>
            <tbody>{reps.map((rep) => {
              const status = getTwosomeStatus(rep);
              const verification = verificationResults[rep.id];
              return (
                <tr key={rep.id}>
                  <td>{rep.name}</td>
                  <td>{rep.departmentName}</td>
                  <td>{rep.pinSet ? '설정됨' : '미설정'}</td>
                  <td>{formatDateTime(rep.lastLoginAt)}</td>
                  <td className="twosome-status-cell">
                    <div className={`twosome-status-badge ${status.className}`}>{status.label}</div>
                    <div className="twosome-meta">
                      {rep.twosomeStoreNm && <span>{rep.twosomeStoreNm} · </span>}
                      {rep.twosomeLastVerifiedAt
                        ? `마지막 확인 ${formatDateTime(rep.twosomeLastVerifiedAt)}`
                        : '실제 확인 기록 없음'}
                      {rep.twosomeSource === 'RESTORED' && ' · Redis 복구'}
                    </div>
                    {rep.autoReloginBlocked && rep.autoReloginMessage && (
                      <div className="twosome-meta">{rep.autoReloginMessage}</div>
                    )}
                    {verification?.message && (
                      <div className={`twosome-verify-result ${verification.result.toLowerCase()}`}>
                        {verification.message}
                      </div>
                    )}
                  </td>
                  <td className="admin-table-actions">
                    <button className="admin-btn small" onClick={() => setLoginRep(rep)}>로그인</button>
                    <button className="admin-btn small" disabled={verifyingRepIds[rep.id]} onClick={() => handleVerifyTwosome(rep)}>
                      {verifyingRepIds[rep.id] ? '확인 중...' : '지금 확인'}
                    </button>
                    <button className="admin-btn small" onClick={() => { setEditingRep(rep); setFormName(rep.name); setFormTeamId(String(rep.teamId)); }}>수정</button>
                    <button className="admin-btn small danger" onClick={() => handleDelete(rep)}>삭제</button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      {loginRep && (
        <RepLoginModal
          rep={loginRep}
          onClose={() => setLoginRep(null)}
          onSuccess={() => handleLoginSuccess(loginRep)}
        />
      )}
      <AlertModal isOpen={isAlertOpen} onClose={closeAlert} message={alertConfig.message} title={alertConfig.title} />
      <ConfirmModal isOpen={isConfirmOpen} onClose={closeConfirm} onConfirm={confirmConfig.onConfirm} message={confirmConfig.message} title={confirmConfig.title} />
    </div>
  );
};

export default AdminPage;
