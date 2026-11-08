import React, { useState, useEffect } from 'react';
import { teamAPI, departmentAPI, twosomeStoreAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './ManagePage.css';

const ManagePage = ({ initialTab }) => {
  const { selectedDepartment, selectedDepartmentId, setSelectedDepartment, refreshDepartments } = useDepartment();
  // menu 탭은 더이상 없으므로 settings로 리다이렉트
  const getInitialTab = () => {
    if (initialTab === 'menu') return 'settings';
    return initialTab || 'team';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);

  // 투썸 연동 (PoC) 상태
  const [twosomeSession, setTwosomeSession] = useState(null); // {status, storeNm, lastUsedAt, remainingMinutes, source}
  const [twosomeHealth, setTwosomeHealth] = useState(null); // {session, indicators, recentEvents}
  const [menuRefreshDiff, setMenuRefreshDiff] = useState(null); // 최근 메뉴 새로고침 diff 리포트
  const [showTwosomeLogin, setShowTwosomeLogin] = useState(false);
  const [captcha, setCaptcha] = useState(null); // {contextId, imageBase64}
  const [twosomeForm, setTwosomeForm] = useState({ loginId: '', loginPwd: '', answerCd: '' });
  const [isTwosomeLoading, setIsTwosomeLoading] = useState(false);
  const [twosomeNotice, setTwosomeNotice] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalType, setModalType] = useState(''); // 'department', 'team'
  const [formData, setFormData] = useState({});

  // 커스텀 모달 훅
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

  // initialTab props가 변경되면 activeTab 업데이트
  useEffect(() => {
    if (initialTab) {
      // menu 탭은 더이상 없으므로 settings로 리다이렉트
      setActiveTab(initialTab === 'menu' ? 'settings' : initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // 부서/투썸 탭은 selectedDepartmentId 없이도 로드 가능
    if (activeTab === 'department' || activeTab === 'twosome') {
      loadData();
    } else if (selectedDepartmentId) {
      loadData();
    }
  }, [activeTab, selectedDepartmentId]);

  const loadData = async () => {
    try {
      if (activeTab === 'team') {
        const data = await teamAPI.getAll(selectedDepartmentId);
        setTeams(data);
      } else if (activeTab === 'department') {
        const data = await departmentAPI.getAll();
        setDepartments(data);
      } else if (activeTab === 'twosome') {
        await loadTwosomeSession();
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  };

  // 팀원 관리
  const handleCreateTeam = () => {
    setModalMode('create');
    setModalType('team');
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const handleEditTeam = (team) => {
    setModalMode('edit');
    setModalType('team');
    setFormData(team);
    setIsModalOpen(true);
  };

  const handleSaveTeam = async () => {
    try {
      if (modalMode === 'create') {
        await teamAPI.create({ ...formData, departmentId: selectedDepartmentId });
      } else {
        await teamAPI.update(formData.id, formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  const handleDeleteTeam = async (id) => {
    showConfirm('삭제하시겠습니까?', async () => {
      try {
        await teamAPI.delete(id);
        loadData();
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
  };

  // 부서 관리
  const handleCreateDepartment = () => {
    setModalMode('create');
    setModalType('department');
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const handleEditDepartment = (department) => {
    setModalMode('edit');
    setModalType('department');
    setFormData(department);
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async () => {
    try {
      if (modalMode === 'create') {
        await departmentAPI.create(formData);
      } else {
        await departmentAPI.update(formData.id, formData);
      }
      setIsModalOpen(false);
      loadData();
      refreshDepartments(); // 헤더의 부서 드롭다운도 업데이트
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (id === selectedDepartmentId) {
      showAlert('현재 선택된 부서는 삭제할 수 없습니다.');
      return;
    }
    showConfirm('부서를 삭제하면 해당 부서의 모든 데이터(팀원, 메뉴, 주문, 설정)가 삭제됩니다. 삭제하시겠습니까?', async () => {
      try {
        await departmentAPI.delete(id);
        loadData();
        refreshDepartments(); // 헤더의 부서 드롭다운도 업데이트
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
  };

  // ==================== 투썸 연동 (PoC) ====================

  const loadTwosomeSession = async () => {
    try {
      const session = await twosomeStoreAPI.getSession();
      setTwosomeSession(session);
    } catch (err) {
      console.error('투썸 세션 조회 실패:', err);
    }
  };

  // 연동 상태 패널 (헬스체크) 조회
  const loadTwosomeHealth = async () => {
    try {
      const health = await twosomeStoreAPI.getHealth();
      setTwosomeHealth(health);
    } catch (err) {
      console.error('투썸 연동 상태 조회 실패:', err);
    }
    try {
      const diff = await twosomeStoreAPI.getMenuRefreshDiff();
      setMenuRefreshDiff(diff && Object.keys(diff).length > 0 ? diff : null);
    } catch (err) {
      console.error('메뉴 새로고침 diff 조회 실패:', err);
    }
  };

  // 투썸 연동 탭이 열린 동안 60초 간격으로 상태 패널 갱신
  useEffect(() => {
    if (activeTab !== 'twosome') {
      return undefined;
    }
    loadTwosomeHealth();
    const intervalId = setInterval(loadTwosomeHealth, 60000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 마지막 성공 시각으로부터 경과 시간(분) 문자열
  const formatMinutesAgo = (isoDateTime) => {
    if (!isoDateTime) return '없음';
    const minutes = Math.floor((Date.now() - new Date(isoDateTime).getTime()) / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 전`;
  };

  const formatDateTime = (isoDateTime) => {
    if (!isoDateTime) return '없음';
    const d = new Date(isoDateTime);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 유형별 지표를 성공/실패 이벤트 쌍으로 병합 (자동 로그인/메뉴 배치/장바구니 표시용)
  // 성공 유형의 ok만 본다: "마지막 이벤트가 성공" 규칙이 이미 실패 이력까지 반영함
  const buildIndicatorSummary = (successType, failType) => {
    const indicators = twosomeHealth?.indicators || [];
    const success = indicators.find((i) => i.eventType === successType);
    const failure = indicators.find((i) => i.eventType === failType);
    const ok = success?.ok ?? true;
    const lastSuccessAt = success?.lastSuccessAt || null;
    return { ok, lastSuccessAt };
  };

  const requestCaptcha = async () => {
    setIsTwosomeLoading(true);
    try {
      const data = await twosomeStoreAPI.requestCaptcha();
      setCaptcha(data);
    } catch (err) {
      showAlert('캡차를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsTwosomeLoading(false);
    }
  };

  const handleTwosomeLoginClick = () => {
    setTwosomeNotice('');
    setTwosomeForm({ loginId: '', loginPwd: '', answerCd: '' });
    setShowTwosomeLogin(true);
    requestCaptcha();
  };

  const handleTwosomeLoginSubmit = async () => {
    if (!captcha) {
      showAlert('캡차를 먼저 불러와주세요.');
      return;
    }
    if (!twosomeForm.loginId || !twosomeForm.loginPwd || !twosomeForm.answerCd) {
      showAlert('아이디, 비밀번호, 캡차를 모두 입력해주세요.');
      return;
    }

    setIsTwosomeLoading(true);
    try {
      const result = await twosomeStoreAPI.login({
        contextId: captcha.contextId,
        loginId: twosomeForm.loginId,
        loginPwd: twosomeForm.loginPwd,
        answerCd: twosomeForm.answerCd,
      });

      if (result.status === 'SUCCESS') {
        setShowTwosomeLogin(false);
        setCaptcha(null);
        setTwosomeForm({ loginId: '', loginPwd: '', answerCd: '' });
        setTwosomeNotice(result.message || '로그인되었습니다.');
        await loadTwosomeSession();
        await loadTwosomeHealth();
      } else {
        showAlert(result.message || '로그인에 실패했습니다.');
        // 캡차는 1회용이므로 새로 발급
        requestCaptcha();
        setTwosomeForm({ ...twosomeForm, answerCd: '' });
      }
    } catch (err) {
      showAlert('로그인 요청 중 오류가 발생했습니다.');
      requestCaptcha();
    } finally {
      setIsTwosomeLoading(false);
    }
  };

  const handleTwosomeLogout = async () => {
    setIsTwosomeLoading(true);
    try {
      await twosomeStoreAPI.logout();
      setTwosomeNotice('로그아웃되었습니다.');
      await loadTwosomeSession();
      await loadTwosomeHealth();
    } catch (err) {
      showAlert('로그아웃에 실패했습니다.');
    } finally {
      setIsTwosomeLoading(false);
    }
  };

  const handleTwosomeMenuRefresh = async () => {
    setIsTwosomeLoading(true);
    try {
      const result = await twosomeStoreAPI.refreshMenu();
      setTwosomeNotice(result.message || `매장 메뉴 ${result.updatedCount}건으로 교체했습니다.`);
      await loadTwosomeSession();
      await loadTwosomeHealth();
    } catch (err) {
      showAlert(err.message || '메뉴 새로고침에 실패했습니다.');
      await loadTwosomeSession();
      await loadTwosomeHealth();
    } finally {
      setIsTwosomeLoading(false);
    }
  };

  // 자동 재로그인 (캡차 OCR + 관리자 자격증명, 수동 트리거)
  const handleTwosomeAutoLogin = async () => {
    setIsTwosomeLoading(true);
    setTwosomeNotice('자동 로그인 진행 중... (캡차 인식에는 10초 이상 걸릴 수 있습니다)');
    try {
      const result = await twosomeStoreAPI.autoLogin();
      setTwosomeNotice(
        result.success
          ? `자동 로그인 성공 (${result.attempts}회 시도)`
          : `자동 로그인 실패 (${result.attempts}회 시도): ${result.message}`
      );
      await loadTwosomeSession();
      await loadTwosomeHealth();
    } catch (err) {
      setTwosomeNotice(`자동 로그인 실패: ${err.message || '알 수 없는 오류'}`);
      await loadTwosomeSession();
      await loadTwosomeHealth();
    } finally {
      setIsTwosomeLoading(false);
    }
  };

  return (
    <div className="manage-page">
      <div className="manage-tabs">
        <button
          className={activeTab === 'department' ? 'active' : ''}
          onClick={() => setActiveTab('department')}
        >
          부서 관리
        </button>
        <button
          className={activeTab === 'team' ? 'active' : ''}
          onClick={() => setActiveTab('team')}
        >
          팀원 관리
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          주문 설정
        </button>
        <button
          className={activeTab === 'twosome' ? 'active' : ''}
          onClick={() => setActiveTab('twosome')}
        >
          투썸 연동
        </button>
        <button onClick={() => { window.location.href = '/admin'; }}>
          대표 관리
        </button>
      </div>

      <div className="manage-content">
        {/* 부서 관리 */}
        {activeTab === 'department' && (
          <div>
            <div className="section-header">
              <h2>부서 목록</h2>
              <button className="btn-add" onClick={handleCreateDepartment}>
                + 부서 추가
              </button>
            </div>
            <div className="list-grid">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className={`list-item clickable ${dept.id === selectedDepartmentId ? 'current' : ''}`}
                  onClick={() => {
                    const foundDept = departments.find(d => d.id === dept.id);
                    if (foundDept) {
                      setSelectedDepartment(foundDept);
                      refreshDepartments();
                    }
                  }}
                >
                  <span>
                    {dept.name}
                    {dept.id === selectedDepartmentId && <span className="current-badge">현재</span>}
                  </span>
                  <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEditDepartment(dept)}>수정</button>
                    <button
                      onClick={() => handleDeleteDepartment(dept.id)}
                      disabled={dept.id === selectedDepartmentId}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 팀원 관리 */}
        {activeTab === 'team' && (
          <div>
            <div className="section-header">
              <h2>팀원 목록 ({selectedDepartment?.name || ''})</h2>
              <button className="btn-add" onClick={handleCreateTeam}>
                + 팀원 추가
              </button>
            </div>
            <div className="list-grid">
              {teams.map((team) => (
                <div key={team.id} className="list-item">
                  <span>{team.name}</span>
                  <div className="item-actions">
                    <button onClick={() => handleEditTeam(team)}>수정</button>
                    <button onClick={() => handleDeleteTeam(team.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 주문 설정 */}
        {activeTab === 'settings' && (
          <div className="settings-form">
            <h2>주문 설정 <span className="department-badge">({selectedDepartment?.name})</span></h2>
            <p className="settings-fixed-notice">
              메뉴 모드는 투썸플레이스 메뉴로 고정되어 있습니다.
            </p>
          </div>
        )}

        {/* 투썸 연동 (PoC) */}
        {activeTab === 'twosome' && (
          <div className="twosome-section">
            <div className="section-header">
              <h2>투썸 연동</h2>
              <span className={`twosome-status-badge ${(twosomeSession?.status || 'NONE').toLowerCase()}`}>
                {(!twosomeSession || twosomeSession.status === 'NONE') && '로그인 없음'}
                {twosomeSession?.status === 'ACTIVE' &&
                  `활성 (${twosomeSession.remainingMinutes}분 남음${twosomeSession.storeNm ? ` · ${twosomeSession.storeNm}` : ''}${twosomeSession.source === 'RESTORED' ? ' · Redis 복구' : ''})`}
                {twosomeSession?.status === 'EXPIRED' && '만료됨'}
              </span>
            </div>

            {/* 연동 상태 패널 (헬스체크) */}
            {twosomeHealth && (
              <div className="twosome-health-panel">
                {menuRefreshDiff && (
                  <div className="health-row">
                    <span className="health-label">메뉴 새로고침</span>
                    <span className={menuRefreshDiff.success ? 'health-ok' : 'health-bad'}>
                      {menuRefreshDiff.success ? '[성공]' : '[실패]'}
                    </span>
                    <span className="health-detail">
                      {formatDateTime(menuRefreshDiff.executedAt)}
                      {` · 신규 ${menuRefreshDiff.addedCount}, 가격변동 ${menuRefreshDiff.priceChangedCount}, 정리 ${menuRefreshDiff.cleanedCount}, 시즌종료 ${menuRefreshDiff.seasonEndedCount}, 품절 ${menuRefreshDiff.soldOutCount}`}
                    </span>
                  </div>
                )}
                <div className="health-row">
                  <span className="health-label">세션</span>
                  <span className={`health-status ${(twosomeHealth.session?.status || 'NONE').toLowerCase()}`}>
                    {(!twosomeHealth.session || twosomeHealth.session.status === 'NONE') && '로그인 없음'}
                    {twosomeHealth.session?.status === 'ACTIVE' && '활성'}
                    {twosomeHealth.session?.status === 'EXPIRED' && '만료됨'}
                  </span>
                  <span className="health-detail">
                    마지막 확인 {formatMinutesAgo(twosomeHealth.session?.lastSuccessAt)}
                    {twosomeHealth.session?.source === 'RESTORED' && ' · Redis 복구'}
                  </span>
                </div>
                {[
                  { label: '자동 로그인', successType: 'AUTO_RELOGIN_SUCCESS', failType: 'AUTO_RELOGIN_FAIL' },
                  { label: '메뉴 배치', successType: 'MENU_SYNC_SUCCESS', failType: 'MENU_SYNC_FAIL' },
                  { label: '장바구니', successType: 'CART_ADD_SUCCESS', failType: 'CART_ADD_FAIL' },
                ].map((row) => {
                  const summary = buildIndicatorSummary(row.successType, row.failType);
                  return (
                    <div className="health-row" key={row.label}>
                      <span className="health-label">{row.label}</span>
                      <span className={summary.ok ? 'health-ok' : 'health-bad'}>
                        {summary.ok ? '[정상]' : '[확인필요]'}
                      </span>
                      <span className="health-detail">
                        마지막 성공: {formatDateTime(summary.lastSuccessAt)}
                      </span>
                    </div>
                  );
                })}

                <div className="health-events">
                  <div className="health-events-title">최근 이벤트</div>
                  {twosomeHealth.recentEvents && twosomeHealth.recentEvents.length > 0 ? (
                    <ul className="health-event-list">
                      {twosomeHealth.recentEvents.slice(0, 10).map((event) => (
                        <li key={event.id} className={event.success ? 'health-event-ok' : 'health-event-bad'}>
                          <span className="health-event-time">{formatDateTime(event.createdAt)}</span>
                          <span className="health-event-type">{event.eventType}</span>
                          <span className="health-event-result">{event.success ? '성공' : '실패'}</span>
                          <span className="health-event-msg">{event.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="health-events-empty">기록된 이벤트가 없습니다.</div>
                  )}
                </div>
              </div>
            )}

            <p className="sync-info">
              관리자의 투썸 계정으로 로그인하여 매장(CJENM커머스부문점) 메뉴로 메뉴 DB를 새로고치고,
              팀 주문을 투썸 장바구니에 담는 PoC 기능입니다. (세션 유휴 30분 만료)
            </p>

            <div className="twosome-actions">
              {(!twosomeSession || twosomeSession.status !== 'ACTIVE') && !showTwosomeLogin && (
                <>
                  <button className="btn-sync" onClick={handleTwosomeLoginClick} disabled={isTwosomeLoading}>
                    로그인
                  </button>
                  <button
                    className="btn-sync btn-secondary"
                    onClick={handleTwosomeAutoLogin}
                    disabled={isTwosomeLoading}
                  >
                    {isTwosomeLoading ? '처리 중...' : '자동 로그인'}
                  </button>
                </>
              )}
              {twosomeSession?.status === 'ACTIVE' && (
                <>
                  <button
                    className="btn-sync"
                    onClick={handleTwosomeMenuRefresh}
                    disabled={isTwosomeLoading}
                  >
                    {isTwosomeLoading ? '처리 중...' : '메뉴 새로고침'}
                  </button>
                  <button
                    className="btn-sync btn-secondary"
                    onClick={handleTwosomeLogout}
                    disabled={isTwosomeLoading}
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>

            {/* 로그인 폼 */}
            {showTwosomeLogin && (
              <div className="twosome-login-form">
                <div className="twosome-captcha-row">
                  {captcha ? (
                    <img className="twosome-captcha-img" src={captcha.imageBase64} alt="캡차" />
                  ) : (
                    <div className="twosome-captcha-loading">캡차 로딩 중...</div>
                  )}
                  <button
                    className="btn-sync btn-secondary"
                    onClick={requestCaptcha}
                    disabled={isTwosomeLoading}
                  >
                    캡차 새로고침
                  </button>
                </div>

                <label className="form-label">투썸 아이디</label>
                <input
                  type="text"
                  value={twosomeForm.loginId}
                  onChange={(e) => setTwosomeForm({ ...twosomeForm, loginId: e.target.value })}
                  placeholder="투썸하트 아이디"
                  autoComplete="off"
                />

                <label className="form-label">투썸 비밀번호</label>
                <input
                  type="password"
                  value={twosomeForm.loginPwd}
                  onChange={(e) => setTwosomeForm({ ...twosomeForm, loginPwd: e.target.value })}
                  placeholder="비밀번호"
                />

                <label className="form-label">캡차 입력 (6자리 숫자)</label>
                <input
                  type="text"
                  value={twosomeForm.answerCd}
                  onChange={(e) => setTwosomeForm({ ...twosomeForm, answerCd: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                  placeholder="이미지의 숫자 6자리 입력"
                  maxLength={6}
                />

                <div className="twosome-login-buttons">
                  <button
                    className="btn-sync"
                    onClick={handleTwosomeLoginSubmit}
                    disabled={isTwosomeLoading || !captcha}
                  >
                    {isTwosomeLoading ? '로그인 중...' : '로그인'}
                  </button>
                  <button
                    className="btn-sync btn-secondary"
                    onClick={() => {
                      setShowTwosomeLogin(false);
                      setCaptcha(null);
                    }}
                    disabled={isTwosomeLoading}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 안내 / 결과 메시지 */}
            {twosomeNotice && (
              <div className="twosome-notice">
                {twosomeNotice}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'department'
            ? modalMode === 'create'
              ? '부서 추가'
              : '부서 수정'
            : modalMode === 'create'
              ? '팀원 추가'
              : '팀원 수정'
        }
      >
        <div className="modal-form">
          {modalType === 'department' && (
            <>
              <label>부서명</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="부서명을 입력하세요"
              />
            </>
          )}

          {modalType === 'team' && (
            <>
              <label>이름</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="이름을 입력하세요"
              />
            </>
          )}

          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={
                modalType === 'department'
                  ? handleSaveDepartment
                  : handleSaveTeam
              }
            >
              저장
            </button>
            <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              취소
            </button>
          </div>
        </div>
      </Modal>

      {/* Alert 모달 */}
      <AlertModal
        isOpen={isAlertOpen}
        onClose={closeAlert}
        message={alertConfig.message}
        title={alertConfig.title}
      />

      {/* Confirm 모달 */}
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

export default ManagePage;
