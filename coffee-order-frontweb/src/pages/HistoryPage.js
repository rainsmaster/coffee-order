import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import './HistoryPage.css';

const HistoryPage = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString('sv-SE')
  );

  const handleTodayClick = () => {
    setSelectedDate(new Date().toLocaleDateString('sv-SE'));
  };
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('individual'); // individual or summary
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [selectedDate]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await orderAPI.getByDate(selectedDate);
      setOrders(data);
    } catch (err) {
      console.error('주문 내역 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 메뉴별 집계 (투썸 메뉴 지원)
  const getMenuSummary = () => {
    const summary = {};
    orders.forEach((order) => {
      // 메뉴 타입에 따라 메뉴 이름과 카테고리 가져오기
      const menuName = order.menuType === 'TWOSOME'
        ? order.twosomeMenuName
        : order.menuName;
      const category = order.menuType === 'TWOSOME'
        ? order.twosomeMenuCategory
        : order.menuCategory;

      if (!menuName) return;

      if (!summary[menuName]) {
        summary[menuName] = {
          category: category || '기타',
          count: 0,
          options: {},
        };
      }

      summary[menuName].count++;

      if (order.personalOption) {
        const option = order.personalOption;
        summary[menuName].options[option] =
          (summary[menuName].options[option] || 0) + 1;
      }
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

      <div className="view-toggle">
        <button
          className={viewMode === 'individual' ? 'active' : ''}
          onClick={() => setViewMode('individual')}
        >
          개인별 보기
        </button>
        <button
          className={viewMode === 'summary' ? 'active' : ''}
          onClick={() => setViewMode('summary')}
        >
          메뉴별 보기
        </button>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <div className="history-content">
          {/* 개인별 보기 */}
          {viewMode === 'individual' && (
            <div className="individual-view">
              <h3>개인별 주문 내역 ({orders.length}건)</h3>
              {orders.length === 0 ? (
                <div className="no-data">주문 내역이 없습니다.</div>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => (
                    <div key={order.id} className="order-item">
                      <div className="order-person">{order.teamName}</div>
                      <div className="order-details">
                        <div className="order-menu">
                          {order.menuType === 'TWOSOME' ? order.twosomeMenuName : order.menuName}
                        </div>
                        {order.personalOption && (
                          <div className="order-option">
                            옵션: {order.personalOption}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 메뉴별 보기 */}
          {viewMode === 'summary' && (
            <div className="summary-view">
              <h3>메뉴별 집계</h3>
              {Object.keys(menuSummary).length === 0 ? (
                <div className="no-data">주문 내역이 없습니다.</div>
              ) : (
                <>
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
                              └ 옵션: {option} x {count}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
