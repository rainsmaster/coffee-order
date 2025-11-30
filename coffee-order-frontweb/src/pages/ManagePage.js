import React, { useState, useEffect } from 'react';
import { teamAPI, menuAPI, settingsAPI, twosomeMenuAPI, orderAPI, departmentAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './ManagePage.css';

const ManagePage = ({ initialTab }) => {
  const { selectedDepartmentId, refreshDepartments } = useDepartment();
  const [activeTab, setActiveTab] = useState(initialTab || 'team');
  const [teams, setTeams] = useState([]);
  const [menus, setMenus] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
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
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // 부서 탭은 selectedDepartmentId 없이도 로드 가능
    if (activeTab === 'department') {
      loadData();
    } else if (selectedDepartmentId) {
      loadData();
    }
  }, [activeTab, selectedDepartmentId]);

  // 동기화 진행 상태 폴링
  useEffect(() => {
    let intervalId;

    const checkSyncStatus = async () => {
      try {
        const status = await twosomeMenuAPI.getSyncStatus();
        setSyncProgress(status);

        if (status.status === 'RUNNING') {
          setIsSyncing(true);
        } else if (status.status === 'COMPLETED') {
          // 완료 시 UI 리셋 및 알림
          setIsSyncing(false);
          setSyncProgress(null);
          if (intervalId) {
            clearInterval(intervalId);
          }
          showAlert('동기화가 완료되었습니다.');
        } else if (status.status === 'FAILED') {
          // 실패 시 UI 리셋 및 알림
          setIsSyncing(false);
          setSyncProgress(null);
          if (intervalId) {
            clearInterval(intervalId);
          }
          showAlert(status.errorMessage || '동기화에 실패했습니다.');
        } else if (status.status === 'IDLE') {
          // 대기 상태면 UI 리셋 (다른 사용자의 동기화가 완료된 경우)
          setIsSyncing(false);
          setSyncProgress(null);
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error('동기화 상태 조회 실패:', err);
        // API 오류 시에도 UI 리셋
        setIsSyncing(false);
        setSyncProgress(null);
      }
    };

    // 동기화 중일 때만 폴링
    if (isSyncing) {
      checkSyncStatus(); // 즉시 한 번 실행
      intervalId = setInterval(checkSyncStatus, 2000); // 2초마다 체크
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSyncing]);

  const loadData = async () => {
    try {
      if (activeTab === 'team') {
        const data = await teamAPI.getAll(selectedDepartmentId);
        setTeams(data);
      } else if (activeTab === 'menu') {
        const data = await menuAPI.getAll(selectedDepartmentId);
        // 카테고리별 그룹화된 데이터를 평면화
        const flatMenus = Object.values(data).flat();
        setMenus(flatMenus);
      } else if (activeTab === 'settings') {
        const data = await settingsAPI.get(selectedDepartmentId);
        setSettings(data);
        // 오늘 주문 개수 확인
        const todayOrders = await orderAPI.getToday(selectedDepartmentId);
        setTodayOrderCount(todayOrders.length);
      } else if (activeTab === 'department') {
        const data = await departmentAPI.getAll();
        setDepartments(data);
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  };

  // 팀원 관리
  const handleCreateTeam = () => {
    setModalMode('create');
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const handleEditTeam = (team) => {
    setModalMode('edit');
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

  // 메뉴 관리
  const handleCreateMenu = () => {
    setModalMode('create');
    setFormData({ name: '', category: '커피' });
    setIsModalOpen(true);
  };

  const handleEditMenu = (menu) => {
    setModalMode('edit');
    setFormData(menu);
    setIsModalOpen(true);
  };

  const handleSaveMenu = async () => {
    try {
      if (modalMode === 'create') {
        await menuAPI.create({ ...formData, departmentId: selectedDepartmentId });
      } else {
        await menuAPI.update(formData.id, formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  const handleDeleteMenu = async (id) => {
    showConfirm('삭제하시겠습니까?', async () => {
      try {
        await menuAPI.delete(id);
        loadData();
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
  };

  // 부서 관리
  const handleCreateDepartment = () => {
    setModalMode('create');
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const handleEditDepartment = (department) => {
    setModalMode('edit');
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

  // 메뉴 모드 변경 처리
  const handleMenuModeChange = (newMode) => {
    if (todayOrderCount > 0 && newMode !== settings.menuMode) {
      showAlert(`오늘 주문 내역이 ${todayOrderCount}건 있습니다.\n주문이 있는 상태에서는 메뉴 모드를 변경할 수 없습니다.`);
      return;
    }
    setSettings({ ...settings, menuMode: newMode });
  };

  // 설정 관리
  const handleSaveSettings = async () => {
    try {
      await settingsAPI.update(settings, selectedDepartmentId);
      showAlert('설정이 저장되었습니다.');
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  // 투썸 메뉴 전체 동기화 (메뉴 + 이미지 + 옵션)
  const handleSyncTwosomeMenu = async () => {
    try {
      // 먼저 동기화 진행 중인지 확인
      const { inProgress } = await twosomeMenuAPI.isSyncInProgress();
      if (inProgress) {
        showAlert('동기화가 이미 진행 중입니다. 잠시 후 다시 시도해주세요.');
        setIsSyncing(true); // 폴링 시작
        return;
      }

      setIsSyncing(true);
      setSyncProgress(null);

      const result = await twosomeMenuAPI.sync();
      showAlert(result.message || '동기화가 완료되었습니다.');
      setIsSyncing(false);
      setSyncProgress(null);
    } catch (err) {
      if (err.code === 'SYNC_IN_PROGRESS') {
        showAlert('동기화가 이미 진행 중입니다. 진행 상태를 확인해주세요.');
        setIsSyncing(true); // 폴링 시작하여 진행 상태 표시
      } else {
        showAlert('동기화 실패했습니다. 잠시 후 다시 시도해주세요.');
        setIsSyncing(false);
      }
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
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
          className={activeTab === 'menu' ? 'active' : ''}
          onClick={() => setActiveTab('menu')}
        >
          메뉴 관리
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          설정
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
                <div key={dept.id} className={`list-item ${dept.id === selectedDepartmentId ? 'current' : ''}`}>
                  <span>
                    {dept.name}
                    {dept.id === selectedDepartmentId && <span className="current-badge">현재</span>}
                  </span>
                  <div className="item-actions">
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
              <h2>팀원 목록</h2>
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

        {/* 메뉴 관리 */}
        {activeTab === 'menu' && (
          <div>
            <div className="section-header">
              <h2>메뉴 목록</h2>
              <button className="btn-add" onClick={handleCreateMenu}>
                + 메뉴 추가
              </button>
            </div>
            <div className="list-grid">
              {menus.map((menu) => (
                <div key={menu.id} className="list-item">
                  <div>
                    <strong>{menu.name}</strong>
                    <div className="item-category">{menu.category}</div>
                  </div>
                  <div className="item-actions">
                    <button onClick={() => handleEditMenu(menu)}>수정</button>
                    <button onClick={() => handleDeleteMenu(menu.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 설정 */}
        {activeTab === 'settings' && settings && (
          <div>
            <h2>설정</h2>
            <div className="settings-form">
              {/* 메뉴 모드 선택 */}
              <div className="form-group">
                <label className="form-label">메뉴 모드</label>
                {todayOrderCount > 0 && (
                  <p className="form-warning">
                    오늘 주문이 {todayOrderCount}건 있어 메뉴 모드를 변경할 수 없습니다.
                  </p>
                )}
                <div className="radio-group">
                  <label className={`radio-label ${todayOrderCount > 0 ? 'disabled' : ''}`}>
                    <input
                      type="radio"
                      name="menuMode"
                      value="CUSTOM"
                      checked={settings.menuMode === 'CUSTOM'}
                      onChange={(e) => handleMenuModeChange(e.target.value)}
                      disabled={todayOrderCount > 0}
                    />
                    커스텀 메뉴 (직접 관리)
                  </label>
                  <label className={`radio-label ${todayOrderCount > 0 ? 'disabled' : ''}`}>
                    <input
                      type="radio"
                      name="menuMode"
                      value="TWOSOME"
                      checked={settings.menuMode === 'TWOSOME'}
                      onChange={(e) => handleMenuModeChange(e.target.value)}
                      disabled={todayOrderCount > 0}
                    />
                    투썸 메뉴 (자동 동기화)
                  </label>
                </div>
                <p className="form-hint">
                  {settings.menuMode === 'CUSTOM'
                    ? '메뉴 관리 탭에서 메뉴를 직접 추가/수정할 수 있습니다.'
                    : '투썸 메뉴를 자동으로 동기화하여 사용합니다.'}
                </p>

                {/* 투썸 메뉴 동기화 버튼 (TWOSOME 모드일 때만 표시) */}
                {settings.menuMode === 'TWOSOME' && (
                  <div className="sync-section">
                    <button
                      className="btn-sync"
                      onClick={handleSyncTwosomeMenu}
                      disabled={isSyncing}
                    >
                      {isSyncing ? '동기화 중...' : '투썸 메뉴 동기화'}
                    </button>
                    <p className="sync-info">
                      메뉴 정보, 이미지, 온도/사이즈 옵션을 동기화합니다. (약 3~5분 소요, 매일 새벽 3시 자동 실행)
                    </p>

                    {/* 동기화 진행률 표시 */}
                    {isSyncing && syncProgress && (
                      <div className="sync-progress-container">
                        <div className="sync-progress-header">
                          <span className="sync-status">
                            {syncProgress.status === 'RUNNING' && '🔄 '}
                            {syncProgress.status === 'COMPLETED' && '✅ '}
                            {syncProgress.status === 'FAILED' && '❌ '}
                            {syncProgress.currentStepName || '동기화 진행 중...'}
                          </span>
                          <span className="sync-percentage">{syncProgress.overallProgress || 0}%</span>
                        </div>
                        <div className="sync-progress-bar">
                          <div
                            className="sync-progress-fill"
                            style={{ width: `${syncProgress.overallProgress || 0}%` }}
                          />
                        </div>
                        {syncProgress.processedCount > 0 && syncProgress.totalCount > 0 && (
                          <div className="sync-progress-detail">
                            처리 중: {syncProgress.processedCount} / {syncProgress.totalCount}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <hr className="settings-divider" />

              {/* 주문 마감 시간 */}
              <div className="form-group">
                <label className="form-label">주문 마감 시간</label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.is24Hours}
                    onChange={(e) =>
                      setSettings({ ...settings, is24Hours: e.target.checked })
                    }
                  />
                  24시간 주문 가능
                </label>
              </div>

              {!settings.is24Hours && (
                <div className="form-group">
                  <label className="form-label">마감 시간</label>
                  <select
                    value={settings.orderDeadlineTime || '09:00:00'}
                    onChange={(e) =>
                      setSettings({ ...settings, orderDeadlineTime: e.target.value })
                    }
                  >
                    {generateTimeOptions().map((time) => (
                      <option key={time} value={`${time}:00`}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button className="btn-save" onClick={handleSaveSettings}>
                설정 저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeTab === 'department'
            ? modalMode === 'create'
              ? '부서 추가'
              : '부서 수정'
            : activeTab === 'team'
              ? modalMode === 'create'
                ? '팀원 추가'
                : '팀원 수정'
              : modalMode === 'create'
                ? '메뉴 추가'
                : '메뉴 수정'
        }
      >
        <div className="modal-form">
          {activeTab === 'department' && (
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

          {activeTab === 'team' && (
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

          {activeTab === 'menu' && (
            <>
              <label>메뉴명</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="메뉴명을 입력하세요"
              />
              <label>카테고리</label>
              <select
                value={formData.category || '커피'}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="커피">커피</option>
                <option value="디카페인 커피">디카페인 커피</option>
                <option value="음료">음료</option>
                <option value="티/티라떼">티/티라떼</option>
                <option value="아이스크림/빙수">아이스크림/빙수</option>
              </select>
            </>
          )}

          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={
                activeTab === 'department'
                  ? handleSaveDepartment
                  : activeTab === 'team'
                    ? handleSaveTeam
                    : handleSaveMenu
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
