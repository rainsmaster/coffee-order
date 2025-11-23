import React, { useState, useEffect } from 'react';
import { teamAPI, menuAPI, settingsAPI } from '../services/api';
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

        {/* 설정 */}
        {activeTab === 'settings' && settings && (
          <div>
            <h2>주문 마감 시간 설정</h2>
            <div className="settings-form">
              <div className="form-group">
                <label>
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
                  <label>마감 시간</label>
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
            : modalMode === 'create'
            ? '메뉴 추가'
            : '메뉴 수정'
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

          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={activeTab === 'team' ? handleSaveTeam : handleSaveMenu}
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
