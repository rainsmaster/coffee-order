import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { orderAPI, teamAPI, repAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import LiveCartPanel from '../components/LiveCartPanel';
import PageHeader from '../components/PageHeader';
import useModal from '../hooks/useModal';
import './HistoryPage.css';
import './HistoryLayout.css';

const today = () => new Date().toLocaleDateString('sv-SE');

const HistoryPage = ({ onOrderClick }) => {
  const { selectedDepartmentId } = useDepartment();
  const [selectedDate, setSelectedDate] = useState(today);
  const [orders, setOrders] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartSummary, setCartSummary] = useState({ itemCount: 0, totalPrice: 0 });
  const isTodayRef = useRef(true);
  const {
    isAlertOpen, alertConfig, showAlert, closeAlert,
    isConfirmOpen, confirmConfig, showConfirm, closeConfirm,
  } = useModal();
  const isToday = selectedDate === today();
  isTodayRef.current = isToday;

  const loadData = useCallback(async () => {
    if (!selectedDepartmentId) return;
    setLoading(true);
    try {
      const [ordersData, teamsData, repsData] = await Promise.all([
        orderAPI.getByDate(selectedDate, selectedDepartmentId),
        teamAPI.getAll(selectedDepartmentId),
        repAPI.list(selectedDepartmentId),
      ]);
      const nextOrders = ordersData || [];
      setOrders(nextOrders);
      if (isTodayRef.current) setTodayOrders(nextOrders);
      setTeams(teamsData || []);
      setReps(repsData || []);
    } catch (err) {
      showAlert('주문 내역을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDepartmentId, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCartSummary({ itemCount: 0, totalPrice: 0 });
  }, [selectedDepartmentId]);

  const handleTodayOrdersChange = useCallback((nextOrders) => {
    setTodayOrders(nextOrders);
    if (isTodayRef.current) setOrders(nextOrders);
  }, []);

  const handleCancelOrder = (order) => {
    showConfirm(`${order.teamName}님의 '${order.menuName}' 주문 한 건을 취소하시겠습니까?`, async () => {
      let externalWarning = '';
      if (order.cartReflectedBy && order.twosomeMenuCode) {
        try {
          const repId = order.cartReflectedBy;
          const items = await repAPI.repGetCart(repId) || [];
          const match = items.find((item) => {
            if ((item.upMenuCd || item.menuCd) !== order.twosomeMenuCode) return false;
            if (order.variantMenuCd && item.menuCd !== order.variantMenuCd) return false;
            const options = order.variantOpts ? order.variantOpts.split(',').map((value) => value.trim()).join(',') : '';
            const itemOptions = item.menuOptVal ? item.menuOptVal.split(',').map((value) => value.trim()).join(',') : '';
            return options === itemOptions;
          });
          if (match) {
            if (match.qty > 1) {
              await repAPI.repAdjustCartItemQty(match.cartNo, match.cartDtlNo, match.menuCd, match.qty - 1,
                order.variantOpts?.split(',').map((value) => value.trim()) || null,
                order.cstmInfo ? JSON.parse(order.cstmInfo) : null, repId);
            } else {
              await repAPI.repRemoveCartItem(match.cartNo, match.cartDtlNo, repId);
            }
          }
        } catch (err) {
          externalWarning = ' 해당 대표의 투썸 장바구니는 확인이 필요합니다.';
        }
      }
      try {
        await orderAPI.delete(order.id);
        await loadData();
        showAlert(`로컬 주문 기록을 취소했습니다.${externalWarning}`);
      } catch (err) {
        showAlert(`주문 취소에 실패했습니다.${externalWarning}`);
      }
    });
  };

  const groupedSummary = useMemo(() => {
    const groups = {};
    orders.forEach((order) => {
      if (!order.menuName) return;
      const category = order.twosomeMenuCategory || '기타';
      if (!groups[category]) groups[category] = {};
      const item = groups[category][order.menuName] || { count: 0, options: {} };
      item.count += 1;
      const option = order.personalOption || '(옵션 없음)';
      item.options[option] = (item.options[option] || 0) + 1;
      groups[category][order.menuName] = item;
    });
    return groups;
  }, [orders]);

  const groupedOrders = useMemo(() => {
    const groups = new Map();
    orders.forEach((order) => {
      const key = order.teamId || order.teamName;
      if (!groups.has(key)) groups.set(key, { teamName: order.teamName, orders: [] });
      groups.get(key).orders.push(order);
    });
    return [...groups.values()];
  }, [orders]);

  const menuKindCount = useMemo(() => new Set(orders.map((order) => order.menuName).filter(Boolean)).size, [orders]);
  const pendingOrderCount = orders.filter((order) => order.twosomeMenuCode && !order.cartReflectedAt).length;
  const orderedMemberIds = new Set(orders.map((order) => order.teamId));
  const unorderedMembers = teams.filter((team) => !orderedMemberIds.has(team.id));
  const repName = (id) => reps.find((rep) => rep.id === id)?.name || `대표 ID ${id}`;

  return (
    <div className="history-page">
      <PageHeader title="주문 내역" description="실제 장바구니와 팀 주문 기록을 한 화면에서 확인하세요." />
      <nav className="history-overview" aria-label="주문 현황 바로가기">
        <a href="#live-cart-section">
          <span>실제 장바구니</span>
          <strong>{cartSummary.itemCount}건{cartSummary.totalPrice > 0 && ` · ${cartSummary.totalPrice.toLocaleString()}원`}</strong>
          <small>선택한 대표의 현재 장바구니</small>
        </a>
        <a href="#individual-orders-section">
          <span>개인별 주문</span>
          <strong>{orders.length}건 · 미반영 {pendingOrderCount}건</strong>
          <small>{selectedDate} 팀 주문서</small>
        </a>
        <a href="#menu-summary-section">
          <span>메뉴 집계</span>
          <strong>{menuKindCount}종</strong>
          <small>선택 날짜의 메뉴·옵션</small>
        </a>
      </nav>
      <LiveCartPanel
        departmentId={selectedDepartmentId}
        onOrderClick={onOrderClick}
        orders={todayOrders}
        reps={reps}
        onOrdersChange={handleTodayOrdersChange}
        onRepsChange={setReps}
        onSummaryChange={setCartSummary}
      />
      <section className="team-history-section" aria-labelledby="team-history-title">
        <div className="history-header">
          <div>
            <h2 id="team-history-title">팀 주문 기록 (로컬)</h2>
            <p className="history-description">실제 투썸 결제 완료가 아닌 허다방 주문 기록입니다.</p>
          </div>
          <div className="date-selector">
            <label htmlFor="history-date">날짜 선택</label>
            <input id="history-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            <button className="today-button" onClick={() => setSelectedDate(today())}>오늘</button>
          </div>
        </div>
        <div className="history-content">
          <section className="individual-section" id="individual-orders-section" aria-labelledby="individual-orders-title">
            <h3 id="individual-orders-title">개인별 주문 내역 ({orders.length}건)</h3>
            {loading ? <div className="history-inline-empty">주문 기록을 불러오는 중...</div> : groupedOrders.length === 0 ? (
              <div className="history-inline-empty">{selectedDate}의 주문 내역이 없습니다.</div>
            ) : (
              <div className="orders-list">
                {groupedOrders.map((group) => (
                  <article className="person-order-group" key={group.orders[0].teamId || group.teamName}>
                    <h4>{group.teamName} <span>· {group.orders.length}건</span></h4>
                    {group.orders.map((order) => (
                      <div key={order.id} className="order-item">
                        <div className="order-details">
                          <span className="order-menu">{order.menuName}</span>
                          {order.personalOption && <span className="order-option">{order.personalOption}</span>}
                          {order.cartReflectedAt ? (
                            <span className="cart-reflect-badge reflected">{repName(order.cartReflectedBy)} 장바구니 반영 · {new Date(order.cartReflectedAt).toLocaleString('ko-KR')}</span>
                          ) : <span className="cart-reflect-badge">투썸 장바구니 미반영</span>}
                        </div>
                        <button className="btn-cancel" onClick={() => handleCancelOrder(order)} disabled={!isToday} title={!isToday ? '당일 주문만 취소할 수 있습니다' : ''}>주문 취소</button>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
            {!loading && unorderedMembers.length > 0 && (
              <div className="unordered-section">
                <h4>미주문 ({unorderedMembers.length}명)</h4>
                <div className="unordered-list">{unorderedMembers.map((member) => <span key={member.id} className="unordered-member">{member.name}</span>)}</div>
              </div>
            )}
          </section>
          <section className="summary-section" id="menu-summary-section" aria-labelledby="menu-summary-title">
            <h3 id="menu-summary-title">메뉴·옵션별 주문 집계</h3>
            <div className="total-summary">총 <strong>{orders.length}</strong>건</div>
            {loading ? <div className="history-inline-empty">주문 집계를 불러오는 중...</div> : orders.length === 0 ? (
              <div className="history-inline-empty">선택한 날짜의 주문 집계가 없습니다.</div>
            ) : Object.entries(groupedSummary).map(([category, menuItems]) => (
              <div key={category} className="category-group">
                <div className="category-header">{category}</div>
                {Object.entries(menuItems).map(([menuName, item]) => (
                  <div className="summary-item" key={menuName}>
                    <div className="summary-main">{menuName} × {item.count}</div>
                    {Object.entries(item.options).map(([option, count]) => <div className="summary-option" key={option}>{option} × {count}</div>)}
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      </section>
      <AlertModal isOpen={isAlertOpen} onClose={closeAlert} message={alertConfig.message} title={alertConfig.title} />
      <ConfirmModal isOpen={isConfirmOpen} onClose={closeConfirm} onConfirm={confirmConfig.onConfirm} message={confirmConfig.message} title={confirmConfig.title} />
    </div>
  );
};

export default HistoryPage;
