import React, { useState, useEffect } from 'react';
import { teamAPI, menuAPI, orderAPI, settingsAPI } from '../services/api';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './OrderPage.css';

const OrderPage = () => {
  const [teams, setTeams] = useState([]);
  const [menus, setMenus] = useState({});
  const [orders, setOrders] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [personalOption, setPersonalOption] = useState('');
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderAvailable, setOrderAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState(null);

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

  // 데이터 로드
  useEffect(() => {
    loadData();
    loadSettings();
    checkOrderAvailable();

    // 5초마다 주문 목록 및 주문 가능 여부 자동 새로고침 (폴링)
    const interval = setInterval(() => {
      loadOrders();
      checkOrderAvailable();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 현재 시간 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, menusData, ordersData] = await Promise.all([
        teamAPI.getAll(),
        menuAPI.getAll(),
        orderAPI.getToday(),
      ]);
      setTeams(teamsData);
      setMenus(menusData);
      setOrders(ordersData);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const ordersData = await orderAPI.getToday();
      setOrders(ordersData);
    } catch (err) {
      console.error('주문 목록 새로고침 실패:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const settingsData = await settingsAPI.get();
      setSettings(settingsData);
    } catch (err) {
      console.error('설정 로드 실패:', err);
    }
  };

  const checkOrderAvailable = async () => {
    try {
      const result = await settingsAPI.checkOrderAvailable();
      setOrderAvailable(result.available);
    } catch (err) {
      console.error('주문 가능 여부 확인 실패:', err);
    }
  };

  // 주문하기
  const handleOrder = async () => {
    if (!selectedTeam || !selectedMenu) {
      showAlert('이름과 메뉴를 선택해주세요.');
      return;
    }

    try {
      const order = {
        teamId: parseInt(selectedTeam),
        menuId: parseInt(selectedMenu),
        personalOption: personalOption || null,
        orderDate: new Date().toLocaleDateString('sv-SE'),
      };

      await orderAPI.create(order);
      showAlert('주문이 완료되었습니다!');
      setSelectedTeam('');
      setSelectedMenu('');
      setPersonalOption('');
      loadOrders();
    } catch (err) {
      if (err.message.includes('이미 오늘 주문하셨습니다')) {
        showConfirm('이미 주문하셨습니다. 수정하시겠습니까?', () => {
          const existingOrder = orders.find(
            (o) => o.team.id === parseInt(selectedTeam)
          );
          if (existingOrder) {
            handleEditOrder(existingOrder);
          }
        });
      } else {
        showAlert(err.message || '주문 실패했습니다.');
      }
    }
  };

  // 주문 수정
  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setSelectedMenu(order.menu.id.toString());
    setPersonalOption(order.personalOption || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async () => {
    try {
      const updatedOrder = {
        team: editingOrder.team,
        menu: { id: parseInt(selectedMenu) },
        personalOption: personalOption || null,
        orderDate: editingOrder.orderDate,
      };

      await orderAPI.update(editingOrder.id, updatedOrder);
      showAlert('주문이 수정되었습니다!');
      setIsEditModalOpen(false);
      setEditingOrder(null);
      setSelectedMenu('');
      setPersonalOption('');
      loadOrders();
    } catch (err) {
      showAlert(err.message || '수정 실패했습니다.');
    }
  };

  // 주문 삭제
  const handleDeleteOrder = async (orderId) => {
    showConfirm('주문을 취소하시겠습니까?', async () => {
      try {
        await orderAPI.delete(orderId);
        showAlert('주문이 취소되었습니다.');
        loadOrders();
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
  };

  // 메뉴별 집계
  const getMenuSummary = () => {
    const summary = {};
    orders.forEach((order) => {
      const key = order.menu.name;
      if (!summary[key]) {
        summary[key] = { count: 0, options: {} };
      }
      summary[key].count++;

      if (order.personalOption) {
        const optionKey = order.personalOption;
        summary[key].options[optionKey] =
          (summary[key].options[optionKey] || 0) + 1;
      }
    });
    return summary;
  };

  const menuSummary = getMenuSummary();

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="order-page">
      {error && <div className="error-message">{error}</div>}

      {/* 주문 폼 */}
      <div className="order-form-card">
        <h2>오늘의 커피 주문</h2>
        <p className="date-info">{new Date().toLocaleDateString('ko-KR')}</p>
        <div className="time-info-box">
          <p className="current-time">
            현재 시간: {currentTime.toLocaleTimeString('ko-KR', { hour12: false })}
          </p>
          {settings && !settings.is24Hours && (
            <p className="deadline-time">
              주문 마감: {settings.orderDeadlineTime?.substring(0, 5)} {orderAvailable ? '주문가능합니다' : '주문이 마감되었습니다'}
            </p>
          )}
          {settings && settings.is24Hours && (
            <p className="deadline-time">
              24시간 주문 가능 합니다
            </p>
          )}
        </div>

        <div className="form-group">
          <label>이름 선택</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            disabled={!orderAvailable}
          >
            <option value="">선택하세요</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>메뉴 선택</label>
          {Object.entries(menus).map(([category, items]) => (
            <div key={category} className="menu-category">
              <div className="category-title">{category}</div>
              <div className="menu-grid">
                {items.map((menu) => (
                  <button
                    key={menu.id}
                    className={`menu-item ${
                      selectedMenu === menu.id.toString() ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedMenu(menu.id.toString())}
                    disabled={!orderAvailable}
                  >
                    {menu.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <button
            className="option-button"
            onClick={() => setIsOptionModalOpen(true)}
            disabled={!orderAvailable}
          >
            {personalOption ? '퍼스널 옵션 수정' : '+ 퍼스널 옵션 추가'}
          </button>
          {personalOption && (
            <div className="option-display">
              옵션: {personalOption}
              <button
                className="option-clear"
                onClick={() => setPersonalOption('')}
              >
                X
              </button>
            </div>
          )}
        </div>

        <button
          className={`order-button ${!orderAvailable ? 'disabled' : ''}`}
          onClick={handleOrder}
          disabled={!orderAvailable}
        >
          {orderAvailable ? '주문하기' : '주문 마감되었습니다'}
        </button>
      </div>

      {/* 오늘의 주문 현황 */}
      <div className="orders-section">
        <h3>오늘의 주문 현황 ({orders.length}건)</h3>
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-item">
              <div className="order-info">
                <strong>{order.team.name}</strong> - {order.menu.name}
                {order.personalOption && (
                  <div className="order-option">옵션: {order.personalOption}</div>
                )}
              </div>
              <div className="order-actions">
                <button
                  className="btn-edit"
                  onClick={() => handleEditOrder(order)}
                  disabled={!orderAvailable}
                >
                  수정
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴별 집계 */}
      <div className="summary-section">
        <h3>메뉴별 집계</h3>
        <div className="summary-list">
          {Object.entries(menuSummary).map(([menuName, data]) => (
            <div key={menuName} className="summary-item">
              <div className="summary-name">
                {menuName} x {data.count}
              </div>
              {Object.entries(data.options).map(([option, count]) => (
                <div key={option} className="summary-option">
                  └ 옵션: {option} x {count}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 퍼스널 옵션 모달 */}
      <Modal
        isOpen={isOptionModalOpen}
        onClose={() => setIsOptionModalOpen(false)}
        title="퍼스널 옵션"
      >
        <div className="modal-form">
          <label>옵션 내용</label>
          <textarea
            value={personalOption}
            onChange={(e) => setPersonalOption(e.target.value)}
            placeholder="예: 샷 추가, 얼음 빼기, 아로마노트로 변경"
            rows="4"
          />
          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={() => setIsOptionModalOpen(false)}
            >
              확인
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setPersonalOption('');
                setIsOptionModalOpen(false);
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>

      {/* 주문 수정 모달 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingOrder(null);
          setSelectedMenu('');
          setPersonalOption('');
        }}
        title="주문 수정"
      >
        <div className="modal-form">
          <div className="form-group">
            <label>메뉴 선택</label>
            {Object.entries(menus).map(([category, items]) => (
              <div key={category} className="menu-category">
                <div className="category-title">{category}</div>
                <div className="menu-grid">
                  {items.map((menu) => (
                    <button
                      key={menu.id}
                      className={`menu-item ${
                        selectedMenu === menu.id.toString() ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedMenu(menu.id.toString())}
                    >
                      {menu.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label>퍼스널 옵션</label>
            <textarea
              value={personalOption}
              onChange={(e) => setPersonalOption(e.target.value)}
              placeholder="예: 샷 추가, 얼음 빼기"
              rows="3"
            />
          </div>

          <div className="modal-buttons">
            <button className="btn-primary" onClick={handleUpdateOrder}>
              수정 완료
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingOrder(null);
                setSelectedMenu('');
                setPersonalOption('');
              }}
            >
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

export default OrderPage;
