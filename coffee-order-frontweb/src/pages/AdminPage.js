import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI, departmentAPI, teamAPI } from '../services/api';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './AdminPage.css';

const AdminPage = ({ embedded = false }) => {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [reps, setReps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [formName, setFormName] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
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
      if (err.message?.includes('만료')) {
        localStorage.removeItem('adminToken');
        setAdminToken(null);
      }
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
    if (adminToken) {
      loadReps();
      loadTeams();
    }
  }, [adminToken, loadReps, loadTeams]);

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

  const formatDateTime = (value) => value ? new Date(value).toLocaleString('ko-KR') : '-';

  return (
    <div className={`admin-page ${embedded ? 'embedded' : ''}`}>
      {!embedded && <div className="admin-header"><h1>팀 대표 관리</h1></div>}
      {!adminToken ? (
        <div className="admin-login-card">
          <h2>관리자 로그인</h2>
          <p className="admin-login-desc">대표 관리는 관리자 비밀번호가 필요합니다.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="관리자 비밀번호" autoFocus />
          <button className="admin-btn primary" onClick={handleLogin} disabled={isLoginLoading}>{isLoginLoading ? '로그인 중...' : '로그인'}</button>
        </div>
      ) : (
        <>
          <div className="admin-header">
            <h2>팀 대표 관리</h2>
            <button className="admin-btn" onClick={handleLogout}>관리자 로그아웃</button>
          </div>
          <p className="admin-principle">누구나 주문 화면에서 본인 팀원을 선택하고 PIN을 만들어 대표가 될 수 있습니다. PIN은 해시로 저장되어 관리자도 조회할 수 없습니다.</p>
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
                <thead><tr><th>이름</th><th>소속</th><th>PIN 설정</th><th>최종 로그인</th><th>관리</th></tr></thead>
                <tbody>{reps.map((rep) => (
                  <tr key={rep.id}>
                    <td>{rep.name}</td><td>{rep.teamName}</td><td>{rep.pinSet ? '설정됨' : '미설정'}</td><td>{formatDateTime(rep.lastLoginAt)}</td>
                    <td className="admin-table-actions">
                      <button className="admin-btn small" onClick={() => { setEditingRep(rep); setFormName(rep.name); setFormTeamId(String(rep.teamId)); }}>수정</button>
                      <button className="admin-btn small danger" onClick={() => handleDelete(rep)}>삭제</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </>
      )}
      <AlertModal isOpen={isAlertOpen} onClose={closeAlert} message={alertConfig.message} title={alertConfig.title} />
      <ConfirmModal isOpen={isConfirmOpen} onClose={closeConfirm} onConfirm={confirmConfig.onConfirm} message={confirmConfig.message} title={confirmConfig.title} />
    </div>
  );
};

export default AdminPage;
