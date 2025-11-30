import React, { useState, useEffect } from 'react';
import { teamAPI, menuAPI, settingsAPI, personalOptionAPI, twosomeMenuAPI } from '../services/api';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './ManagePage.css';

const ManagePage = () => {
  const [activeTab, setActiveTab] = useState('team');
  const [teams, setTeams] = useState([]);
  const [menus, setMenus] = useState([]);
  const [settings, setSettings] = useState(null);
  const [personalOptions, setPersonalOptions] = useState([]);
  const [twosomeMenus, setTwosomeMenus] = useState({});
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // 동기화 진행 상태 폴링
  useEffect(() => {
    let intervalId;

    const checkSyncStatus = async () => {
      try {
        const status = await twosomeMenuAPI.getSyncStatus();
        setSyncProgress(status);

        if (status.status === 'RUNNING') {
          setIsSyncing(true);
        } else if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          setIsSyncing(false);
          // 완료 또는 실패 시 폴링 중지
          if (intervalId) {
            clearInterval(intervalId);
          }
          // 완료 시 메뉴 새로고침
          if (status.status === 'COMPLETED' && activeTab === 'twosomeMenu') {
            loadData();
          }
        }
      } catch (err) {
        console.error('동기화 상태 조회 실패:', err);
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
  }, [isSyncing, activeTab]);

  const loadData = async () => {
    try {
      if (activeTab === 'team') {
        const data = await teamAPI.getAll();
        setTeams(data);
      } else if (activeTab === 'menu') {
        const data = await menuAPI.getAll();
        // 카테고리별 그룹화된 데이터를 평면화
        const flatMenus = Object.values(data).flat();
        setMenus(flatMenus);
      } else if (activeTab === 'settings') {
        const data = await settingsAPI.get();
        setSettings(data);
      } else if (activeTab === 'personalOption') {
        const data = await personalOptionAPI.getAllList();
        setPersonalOptions(data);
      } else if (activeTab === 'twosomeMenu') {
        const data = await twosomeMenuAPI.getAll();
        setTwosomeMenus(data);
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
        await teamAPI.create(formData);
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
        await menuAPI.create(formData);
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

  // 설정 관리
  const handleSaveSettings = async () => {
    try {
      await settingsAPI.update(settings);
      showAlert('설정이 저장되었습니다.');
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  // 퍼스널 옵션 관리
  const handleCreatePersonalOption = () => {
    setModalMode('create');
    setFormData({ name: '', category: '샷', sortOrd: 0 });
    setIsModalOpen(true);
  };

  const handleEditPersonalOption = (option) => {
    setModalMode('edit');
    setFormData(option);
    setIsModalOpen(true);
  };

  const handleSavePersonalOption = async () => {
    try {
      if (modalMode === 'create') {
        await personalOptionAPI.create(formData);
      } else {
        await personalOptionAPI.update(formData.id, formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('저장 실패했습니다.');
    }
  };

  const handleDeletePersonalOption = async (id) => {
    showConfirm('삭제하시겠습니까?', async () => {
      try {
        await personalOptionAPI.delete(id);
        loadData();
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
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
      loadData();
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
          className={activeTab === 'personalOption' ? 'active' : ''}
          onClick={() => setActiveTab('personalOption')}
        >
          퍼스널 옵션
        </button>
        <button
          className={activeTab === 'twosomeMenu' ? 'active' : ''}
          onClick={() => setActiveTab('twosomeMenu')}
        >
          투썸 메뉴
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          설정
        </button>
      </div>

      <div className="manage-content">
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

        {/* 퍼스널 옵션 관리 */}
        {activeTab === 'personalOption' && (
          <div>
            <div className="section-header">
              <h2>퍼스널 옵션 목록</h2>
              <button className="btn-add" onClick={handleCreatePersonalOption}>
                + 옵션 추가
              </button>
            </div>
            <div className="list-grid">
              {personalOptions.map((option) => (
                <div key={option.id} className="list-item">
                  <div>
                    <strong>{option.name}</strong>
                    <div className="item-category">{option.category}</div>
                  </div>
                  <div className="item-actions">
                    <button onClick={() => handleEditPersonalOption(option)}>수정</button>
                    <button onClick={() => handleDeletePersonalOption(option.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 투썸 메뉴 */}
        {activeTab === 'twosomeMenu' && (
          <div>
            <div className="section-header">
              <h2>투썸 메뉴 목록</h2>
              <button
                className="btn-add"
                onClick={handleSyncTwosomeMenu}
                disabled={isSyncing}
              >
                {isSyncing ? '동기화 중...' : '메뉴 동기화'}
              </button>
            </div>

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

            <p className="sync-info">
              메뉴 정보, 이미지, 온도/사이즈 옵션을 동기화합니다. (약 3~5분 소요, 매일 새벽 3시 자동 실행)
            </p>
            {Object.keys(twosomeMenus).length === 0 ? (
              <p className="empty-message">동기화된 메뉴가 없습니다. 메뉴 동기화 버튼을 클릭하세요.</p>
            ) : (
              Object.entries(twosomeMenus).map(([category, items]) => (
                <div key={category} className="twosome-category">
                  <h3>{category} ({items.length})</h3>
                  <div className="twosome-menu-grid">
                    {items.map((menu) => (
                      <div key={menu.id} className="twosome-menu-item">
                        <img
                          src={menu.localImgPath || `https://mcdn.twosome.co.kr${menu.menuImg02 || menu.menuImg}`}
                          alt={menu.menuNm}
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=No+Image'; }}
                        />
                        <span>{menu.menuNm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
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
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="menuMode"
                      value="CUSTOM"
                      checked={settings.menuMode === 'CUSTOM'}
                      onChange={(e) =>
                        setSettings({ ...settings, menuMode: e.target.value })
                      }
                    />
                    커스텀 메뉴 (직접 관리)
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="menuMode"
                      value="TWOSOME"
                      checked={settings.menuMode === 'TWOSOME'}
                      onChange={(e) =>
                        setSettings({ ...settings, menuMode: e.target.value })
                      }
                    />
                    투썸 메뉴 (자동 동기화)
                  </label>
                </div>
                <p className="form-hint">
                  {settings.menuMode === 'CUSTOM'
                    ? '메뉴 관리 탭에서 메뉴를 직접 추가/수정할 수 있습니다.'
                    : '투썸 메뉴 탭에서 동기화된 메뉴를 확인할 수 있습니다.'}
                </p>
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
          activeTab === 'team'
            ? modalMode === 'create'
              ? '팀원 추가'
              : '팀원 수정'
            : activeTab === 'menu'
            ? modalMode === 'create'
              ? '메뉴 추가'
              : '메뉴 수정'
            : activeTab === 'personalOption'
            ? modalMode === 'create'
              ? '퍼스널 옵션 추가'
              : '퍼스널 옵션 수정'
            : ''
        }
      >
        <div className="modal-form">
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

          {activeTab === 'personalOption' && (
            <>
              <label>옵션명</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="옵션명을 입력하세요"
              />
              <label>카테고리</label>
              <select
                value={formData.category || '샷'}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="샷">샷</option>
                <option value="시럽">시럽</option>
                <option value="우유">우유</option>
                <option value="휘핑">휘핑</option>
                <option value="온도">온도</option>
                <option value="기타">기타</option>
              </select>
              <label>정렬순서</label>
              <input
                type="number"
                value={formData.sortOrd || 0}
                onChange={(e) => setFormData({ ...formData, sortOrd: parseInt(e.target.value) || 0 })}
                placeholder="정렬순서 (숫자)"
              />
            </>
          )}

          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={
                activeTab === 'team'
                  ? handleSaveTeam
                  : activeTab === 'menu'
                  ? handleSaveMenu
                  : handleSavePersonalOption
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
