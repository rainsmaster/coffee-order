import React, { useState, useEffect } from 'react';
import { orderAPI, settingsAPI, teamAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './HistoryPage.css';

const HistoryPage = () => {
  const { selectedDepartmentId } = useDepartment();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString('sv-SE')
  );
  const [orders, setOrders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderAvailable, setOrderAvailable] = useState(true);

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

  const handleTodayClick = () => {
    setSelectedDate(new Date().toLocaleDateString('sv-SE'));
  };

  useEffect(() => {
    if (selectedDepartmentId) {
      loadData();
      checkOrderAvailable();
    }
  }, [selectedDate, selectedDepartmentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, teamsData] = await Promise.all([
        orderAPI.getByDate(selectedDate, selectedDepartmentId),
        teamAPI.getAll(selectedDepartmentId)
      ]);
      setOrders(ordersData);
      setTeams(teamsData);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await orderAPI.getByDate(selectedDate, selectedDepartmentId);
      setOrders(data);
    } catch (err) {
      console.error('주문 내역 로드 실패:', err);
    }
  };

  const checkOrderAvailable = async () => {
    try {
      const result = await settingsAPI.checkOrderAvailable(selectedDepartmentId);
      setOrderAvailable(result.available);
    } catch (err) {
      console.error('주문 가능 여부 확인 실패:', err);
    }
  };

  // 오늘 날짜인지 확인
  const isToday = () => {
    const today = new Date().toLocaleDateString('sv-SE');
    return selectedDate === today;
  };

  // 주문 취소 가능 여부 확인
  const canCancelOrder = () => {
    return isToday() && orderAvailable;
  };

  // 주문 취소 처리
  const handleCancelOrder = (orderId, teamName) => {
    showConfirm(`${teamName}님의 주문을 취소하시겠습니까?`, async () => {
      try {
        await orderAPI.delete(orderId);
        showAlert('주문이 취소되었습니다.');
        loadOrders();
      } catch (err) {
        showAlert('주문 취소에 실패했습니다.');
      }
    });
  };

  // 메뉴별 집계 (투썸 메뉴 지원)
  const getMenuSummary = () => {
    const summary = {};
    orders.forEach((order) => {
      // 메뉴 타입에 따라 메뉴 이름과 카테고리 가져오기
      const menuName = order.menuType === 'TWOSOME'
        ? order.twosomeMenuName
        : order.menuName;
      // 투썸 메뉴만 카테고리가 있음
      const category = order.menuType === 'TWOSOME'
        ? order.twosomeMenuCategory
        : '커스텀 메뉴';

      if (!menuName) return;

      if (!summary[menuName]) {
        summary[menuName] = {
          category: category || '기타',
          count: 0,
          options: {},
        };
      }

      summary[menuName].count++;

      // 옵션별 카운트 (옵션이 없는 경우도 포함)
      const optionKey = order.personalOption || '(옵션 없음)';
      summary[menuName].options[optionKey] =
        (summary[menuName].options[optionKey] || 0) + 1;
    });

    return summary;
  };

  const menuSummary = getMenuSummary();

  // 카테고리별로 그룹화
  const groupedSummary = {};
  Object.entries(menuSummary).forEach(([menuName, data]) => {
    const category = data.category;
    if (!groupedSummary[category]) {
      groupedSummary[category] = [];
    }
    groupedSummary[category].push({ menuName, ...data });
  });

  // 주문 안한 사람 목록
  const getUnorderedMembers = () => {
    const orderedTeamIds = new Set(orders.map(order => order.teamId));
    return teams.filter(team => !orderedTeamIds.has(team.id));
  };

  const unorderedMembers = getUnorderedMembers();

  return (
    <div className="history-page">
      <div className="history-header">
        <h2>주문 내역</h2>
        <div className="date-selector">
          <label>날짜 선택</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button className="today-button" onClick={handleTodayClick}>
            오늘
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : orders.length === 0 ? (
        <div className="no-data">주문 내역이 없습니다.</div>
      ) : (
        <div className="history-content">
          {/* 메뉴별 집계 */}
          <div className="summary-section">
            <h3>메뉴별 집계</h3>
            <div className="total-summary">
              총 <strong>{orders.length}</strong>잔
            </div>
            {Object.entries(groupedSummary).map(([category, items]) => (
              <div key={category} className="category-group">
                <div className="category-header">{category}</div>
                {items.map((item) => (
                  <div key={item.menuName} className="summary-item">
                    <div className="summary-main">
                      {item.menuName} x {item.count}
                    </div>
                    {Object.entries(item.options).map(([option, count]) => (
                      <div key={option} className="summary-option">
                        └ {option} x {count}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 개인별 주문 내역 */}
          <div className="individual-section">
            <h3>개인별 주문 내역 ({orders.length}건)</h3>
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-item">
                  <div className="order-person">{order.teamName}</div>
                  <div className="order-details">
                    <span className="order-menu">
                      {order.menuType === 'TWOSOME' ? order.twosomeMenuName : order.menuName}
                    </span>
                    {order.personalOption && (
                      <span className="order-option">
                        ({order.personalOption})
                      </span>
                    )}
                  </div>
                  <button
                    className={`btn-cancel ${!canCancelOrder() ? 'disabled' : ''}`}
                    onClick={() => handleCancelOrder(order.id, order.teamName)}
                    disabled={!canCancelOrder()}
                    title={!canCancelOrder() ? (isToday() ? '주문 마감 시간이 지났습니다' : '당일 주문만 취소할 수 있습니다') : ''}
                  >
                    주문취소
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 주문 안한 사람 */}
          {unorderedMembers.length > 0 && (
            <div className="unordered-section">
              <h3>미주문 ({unorderedMembers.length}명)</h3>
              <div className="unordered-list">
                {unorderedMembers.map((member) => (
                  <span key={member.id} className="unordered-member">
                    {member.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

export default HistoryPage;
