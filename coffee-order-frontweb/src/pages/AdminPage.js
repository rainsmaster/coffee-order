import React, { useState, useEffect } from 'react';
import { adminAPI, departmentAPI, teamAPI } from '../services/api';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './AdminPage.css';

const AdminPage = () => {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [reps, setReps] = useState([]);
  const [teams, setTeams] = useState([]); // {id, name, label}
  const [isLoading, setIsLoading] = useState(false);

  // 등록/수정 폼
  const [editingRep, setEditingRep] = useState(null); // null=등록 모드
  const [formName, setFormName] = useState('');
  const [formTeamId, setFormTeamId] = useState('');

  // 초대코드 발급 결과
  const [inviteResult, setInviteResult] = useState(null); // {repName, code}
  const [copied, setCopied] = useState(false);

  const {
    isAlertOpen,
    alertConfig,
    showAlert,
    closeAlert,
    isConfirmOpen,
    confirmConfig,
    showConfirm,
    closeConfirm,
  } = useModal();

  // 관리자 로그인 상태면 목록 로드
  useEffect(() => {
    if (adminToken) {
      loadReps();
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const handleLogin = async () => {
    if (!password) {
      showAlert('관리자 비밀번호를 입력해주세요.');
      return;
    }
    setIsLoginLoading(true);
    try {
      const result = await adminAPI.login(password);
      localStorage.setItem('adminToken', result.token);
      setAdminToken(result.token);
      setPassword('');
    } catch (err) {
      showAlert(err.message || '관리자 로그인에 실패했습니다.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setReps([]);
  };

  const loadReps = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getReps();
      setReps(data || []);
    } catch (err) {
      showAlert(err.message || '팀 대표 목록을 불러오지 못했습니다.');
      if (err.message && err.message.includes('만료')) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 부서 목록을 먼저 받고 부서별 팀을 펼쳐 드롭다운용 목록 구성
  const loadTeams = async () => {
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
      console.error('팀 목록 로드 실패:', err);
    }
  };

  const resetForm = () => {
    setEditingRep(null);
    setFormName('');
    setFormTeamId('');
  };

  const handleFormSubmit = async () => {
    if (!formName.trim()) {
      showAlert('이름을 입력해주세요.');
      return;
    }
    if (!formTeamId) {
      showAlert('팀을 선택해주세요.');
      return;
    }
    try {
      const data = { name: formName.trim(), teamId: parseInt(formTeamId) };
      if (editingRep) {
        await adminAPI.updateRep(editingRep.id, data);
        showAlert('팀 대표가 수정되었습니다.');
      } else {
        await adminAPI.createRep(data);
        showAlert('팀 대표가 등록되었습니다.');
      }
      resetForm();
      loadReps();
    } catch (err) {
      showAlert(err.message || '저장에 실패했습니다.');
    }
  };

  const handleEditClick = (rep) => {
    setEditingRep(rep);
    setFormName(rep.name);
    setFormTeamId(String(rep.teamId));
  };

  const handleDelete = (rep) => {
    showConfirm(`'${rep.name}' 대표를 삭제하시겠습니까?`, async () => {
      try {
        await adminAPI.deleteRep(rep.id);
        showAlert('팀 대표가 삭제되었습니다.');
        if (editingRep?.id === rep.id) resetForm();
        loadReps();
      } catch (err) {
        showAlert(err.message || '삭제에 실패했습니다.');
      }
    });
  };

  const handleIssueInvite = async (rep) => {
    try {
      const result = await adminAPI.issueInvite(rep.id);
      setInviteResult({ repName: rep.name, code: result.code });
      setCopied(false);
    } catch (err) {
      showAlert(err.message || '초대코드 발급에 실패했습니다.');
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.code);
      setCopied(true);
    } catch (err) {
      showAlert('복사에 실패했습니다. 코드를 직접 선택해 복사해주세요.');
    }
  };

  const formatDateTime = (isoDateTime) => {
    if (!isoDateTime) return '-';
    const d = new Date(isoDateTime);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 관리자 로그인 화면
  if (!adminToken) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <h1>관리자 로그인</h1>
          <p className="admin-login-desc">팀 대표 관리 페이지입니다. 관리자 비밀번호를 입력해주세요.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="관리자 비밀번호"
            autoFocus
          />
          <button className="admin-btn primary" onClick={handleLogin} disabled={isLoginLoading}>
            {isLoginLoading ? '로그인 중...' : '로그인'}
          </button>
        </div>

        <AlertModal
          isOpen={isAlertOpen}
          onClose={closeAlert}
          message={alertConfig.message}
          title={alertConfig.title}
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>팀 대표 관리</h1>
        <div className="admin-header-actions">
          <button className="admin-btn" onClick={() => { window.location.href = '/'; }}>주문 페이지로</button>
          <button className="admin-btn" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      <p className="admin-principle">
        PIN은 대표 본인이 직접 설정하며 해시로 저장되어 관리자도 조회할 수 없습니다.
        PIN 설정이 필요한 대표에게 초대코드를 발급해 전달하세요.
      </p>

      {/* 등록/수정 폼 */}
      <div className="admin-form-card">
        <h2>{editingRep ? '대표 수정' : '대표 등록'}</h2>
        <div className="admin-form-row">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="이름"
          />
          <select value={formTeamId} onChange={(e) => setFormTeamId(e.target.value)}>
            <option value="">팀 선택</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.label}</option>
            ))}
          </select>
          <button className="admin-btn primary" onClick={handleFormSubmit}>
            {editingRep ? '수정' : '등록'}
          </button>
          {editingRep && (
            <button className="admin-btn" onClick={resetForm}>취소</button>
          )}
        </div>
      </div>

      {/* 대표 목록 */}
      <div className="admin-list-card">
        <h2>대표 목록 ({reps.length}명)</h2>
        {isLoading ? (
          <div className="loading">로딩 중...</div>
        ) : reps.length === 0 ? (
          <div className="no-data">등록된 팀 대표가 없습니다.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>팀</th>
                <th>PIN 설정</th>
                <th>최종 로그인</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => (
                <tr key={rep.id}>
                  <td>{rep.name}</td>
                  <td>{rep.teamName}</td>
                  <td>{rep.pinSet ? '설정됨' : '미설정'}</td>
                  <td>{formatDateTime(rep.lastLoginAt)}</td>
                  <td className="admin-table-actions">
                    <button className="admin-btn small" onClick={() => handleEditClick(rep)}>수정</button>
                    <button className="admin-btn small" onClick={() => handleIssueInvite(rep)}>초대코드 발급</button>
                    <button className="admin-btn small danger" onClick={() => handleDelete(rep)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 초대코드 발급 결과 (한 번만 표시) */}
      {inviteResult && (
        <div className="invite-result-card">
          <h2>초대코드 발급 완료: {inviteResult.repName}</h2>
          <p className="invite-warning">
            대표에게 전달 후 이 화면을 벗어나면 다시 볼 수 없습니다. 유효기간은 7일이며 1회만 사용할 수 있습니다.
          </p>
          <div className="invite-code-row">
            <span className="invite-code">{inviteResult.code}</span>
            <button className="admin-btn primary" onClick={handleCopyInvite}>
              {copied ? '복사됨' : '복사'}
            </button>
            <button className="admin-btn" onClick={() => setInviteResult(null)}>닫기</button>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={isAlertOpen}
        onClose={closeAlert}
        message={alertConfig.message}
        title={alertConfig.title}
      />
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={closeConfirm}
        onConfirm={confirmConfig.onConfirm}
        message={confirmConfig.message}
        title={confirmConfig.title}
      />
    </div>
  );
};

export default AdminPage;
