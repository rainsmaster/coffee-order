import React, { useState, useEffect } from 'react';
import { orderAPI, teamAPI, twosomeStoreAPI, repAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
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

  // 투썸 장바구니 상태 (세션 1회 조회 후 ACTIVE일 때만 목록 로드)
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartMode, setCartMode] = useState(null); // 'rep' (대표 세션) | null (비로그인)
  const [repName, setRepName] = useState(null); // rep 모드 라벨용 대표 이름
  const [isStoreOpen, setIsStoreOpen] = useState(false); // 일괄 담기 게이팅용 (실패 시 false=폐점)
  const [bulkAddLoading, setBulkAddLoading] = useState(false);
  const [bulkAddDialog, setBulkAddDialog] = useState(null); // {targets, reflected} 이미 담김 충돌 다이얼로그
  const [expandedCustom, setExpandedCustom] = useState({}); // {`${cartNo}-${cartDtlNo}`: 명세 배열}

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
      checkTwosomeSessionAndCart();
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

  // ==================== 투썸 장바구니 ====================

  // 세션 상태 1회 조회 → 대표 투썸 세션(PIN 로그인) 전용. 관리자 세션은 장바구니에 사용하지 않음.
  const checkTwosomeSessionAndCart = async () => {
    if (localStorage.getItem('repToken')) {
      try {
        const repSession = await repAPI.twosomeSession();
        if (repSession.status === 'ACTIVE') {
          setCartMode('rep');
          try {
            const me = await repAPI.me();
            setRepName(me.name);
          } catch (err) {
            // 이름 조회 실패 시 라벨 폴리백
          }
          await loadCartItems('rep');
          checkStoreOpen();
          return;
        }
      } catch (err) {
        // 대표 세션 없음/만료 → 비로그인
      }
    }
    setCartMode(null);
    setRepName(null);
    setCartItems([]);
  };

  // 대표 세션 장바구니 API (관리자 세션은 장바구니에 사용하지 않음)
  const cartAPI = () => ({
    get: repAPI.repGetCart,
    adjust: repAPI.repAdjustCartItemQty,
    remove: repAPI.repRemoveCartItem,
    clear: repAPI.repClearCart,
  });

  // 일괄 담기 게이팅용 매장 개점 여부 (조회 실패 시 폐점으로 취급)
  const checkStoreOpen = async () => {
    try {
      const info = await twosomeStoreAPI.getStoreInfo();
      setIsStoreOpen(isWithinOrdTime(info));
    } catch (err) {
      setIsStoreOpen(false);
    }
  };

  // ordTime("07:30 ~ 20:50") 파싱 → 개점 여부 (OrderPage와 동일 규칙)
  const isWithinOrdTime = (info) => {
    if (!info || !info.ordTime) return false;
    const match = info.ordTime.match(/(\d{2}):(\d{2})\s*~\s*(\d{2}):(\d{2})/);
    if (!match) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    const closeMinutes = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  };

  // 오늘자 TWOSOME 주문 중 미반영(cartReflectedAt == null) 목록
  const getUnreflectedOrders = () =>
    orders.filter((o) => o.menuType === 'TWOSOME' && o.twosomeMenuCode && !o.cartReflectedAt);

  // 장바구니 담기 items 배열 구성 (변형 + 퍼스널 옵션 포함)
  const buildCartItems = (targetOrders) =>
    targetOrders.map((o) => ({
      menuCd: o.twosomeMenuCode,
      upMenuCd: o.twosomeMenuCode,
      midCd: null, // 백엔드에서 로컬 메뉴로 보완
      qty: 1,
      variantMenuCd: o.variantMenuCd || null,
      opts: o.variantOpts ? o.variantOpts.split(',').map((x) => x.trim()).filter(Boolean) : null,
      cstmInfo: o.cstmInfo ? JSON.parse(o.cstmInfo) : null,
    }));

  // 퍼스널 옵션 명세를 cartCstmInfo 배열로 복원 (재담기/수량조정용)
  // 실측: PRICE=행 합계, CSTM_ORD_CNT=수량(조정 0/추가 1/수량형 N) → 단가는 PRICE/CNT
  const buildCstmInfoFromDetail = (details, variantMenuCd) =>
    (details || []).map((d, i) => ({
      CSTM_NUM: i,
      MENU_CD: variantMenuCd || '',
      SET_MENU_YN: 'N',
      CSTM_GRP_CD: d.grpCd || '',
      TYPE_ADD_CD: d.typeAddCd || '',
      CSTM_ADD_CD: d.cstmAddCd || '',
      TYPE_CHG_CD: d.typeChgCd || '',
      CSTM_CHG_CD: d.cstmChgCd || '',
      CSTM_ORD_CNT: d.cnt || 0,
      CSTM_ORD_AMT: d.cnt > 1 ? Math.round((d.price || 0) / d.cnt) : (d.price || 0),
      CSTM_DEPOSIT: 0,
    }));

  // 장바구니 항목의 퍼스널 옵션 명세 조회 (없으면 빈 배열)
  const fetchCartCustomDetail = async (item) => {
    try {
      return await twosomeStoreAPI.getCartCustomList(item.cartNo, item.cartDtlNo);
    } catch (err) {
      console.error('퍼스널 옵션 명세 조회 실패:', err);
      return [];
    }
  };

  // '퍼스널 옵션' 토글 (펼치기/접기)
  const handleToggleCustom = async (item) => {
    const id = `${item.cartNo}-${item.cartDtlNo}`;
    if (expandedCustom[id]) {
      setExpandedCustom({ ...expandedCustom, [id]: null });
      return;
    }
    const details = await fetchCartCustomDetail(item);
    setExpandedCustom({ ...expandedCustom, [id]: details });
  };

  // 일괄 담기 실행. 성공한 주문은 반영 마킹 후 장바구니 재로드.
  const executeBulkAdd = async (targetOrders) => {
    if (targetOrders.length === 0 || bulkAddLoading) return;
    setBulkAddLoading(true);
    try {
      const addAPI = repAPI.repAddToCart; // 대표 세션 전용
      const result = await addAPI(buildCartItems(targetOrders));

      // 결과의 성공 항목을 주문과 매칭해 반영 마킹 (메뉴코드 기준, 1:1 소진)
      const remaining = (result?.results || []).filter((r) => r.success);
      const reflectedIds = [];
      for (const order of targetOrders) {
        const idx = remaining.findIndex((r) => r.menuCd === order.twosomeMenuCode);
        if (idx >= 0) {
          reflectedIds.push(order.id);
          remaining.splice(idx, 1);
        }
      }
      if (reflectedIds.length > 0) {
        try {
          await orderAPI.markCartReflected(reflectedIds);
        } catch (markErr) {
          console.error('장바구니 반영 마킹 실패 (무시):', markErr);
        }
      }

      await loadCartItems();
      await loadOrders();

      const successCount = reflectedIds.length;
      const failCount = targetOrders.length - successCount;
      if (failCount === 0) {
        showAlert(`장바구니 담기 완료: 성공 ${successCount}건`);
      } else {
        const failedNames = (result?.results || [])
          .filter((r) => !r.success)
          .map((r) => r.menuNm || r.menuCd)
          .filter(Boolean)
          .join(', ');
        showAlert(`장바구니 담기 완료: 성공 ${successCount}건, 실패 ${failCount}건${failedNames ? ` (${failedNames})` : ''}`);
      }
    } catch (err) {
      showAlert(err.message === 'TWOSOME_SESSION_EXPIRED'
        ? '투썸 세션이 만료되었습니다. 다시 로그인해주세요.'
        : '장바구니 일괄 담기에 실패했습니다.');
      await checkTwosomeSessionAndCart();
    } finally {
      setBulkAddLoading(false);
    }
  };

  // 일괄 담기 버튼 클릭: 이미 담긴 항목이 있으면 3버튼 확인 다이얼로그
  const handleBulkAdd = () => {
    const todayTwosome = orders.filter((o) => o.menuType === 'TWOSOME' && o.twosomeMenuCode);
    const reflected = todayTwosome.filter((o) => o.cartReflectedAt);
    const targets = getUnreflectedOrders();
    if (targets.length === 0) return;
    if (reflected.length > 0) {
      setBulkAddDialog({ targets, reflected });
    } else {
      executeBulkAdd(targets);
    }
  };

  const loadCartItems = async (mode = cartMode) => {
    try {
      setCartLoading(true);
      const items = await cartAPI().get();
      setCartItems(items || []);
    } catch (err) {
      if (err.message === 'TWOSOME_SESSION_EXPIRED') {
        setCartMode(null);
        setCartItems([]);
        showAlert('대표 투썸 세션이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        showAlert('장바구니 목록을 불러오지 못했습니다.');
      }
    } finally {
      setCartLoading(false);
    }
  };

  // 수량 조정 (투썸: 삭제 + 재담기, 옵션 조합 + 퍼스널 옵션 복원 포함)
  const handleCartQtyChange = async (item, newQty) => {
    if (newQty < 1 || cartLoading) return;
    try {
      setCartLoading(true);
      const opts = item.menuOptVal ? item.menuOptVal.split(',').map((o) => o.trim()).filter(Boolean) : null;
      // 커스텀 합계가 있는 항목은 명세를 먼저 조회해 cartCstmInfo 복원
      let cstmInfo = null;
      if (item.cstmAmt > 0) {
        const details = await fetchCartCustomDetail(item);
        cstmInfo = buildCstmInfoFromDetail(details, item.menuCd);
      }
      await cartAPI().adjust(item.cartNo, item.cartDtlNo, item.menuCd, newQty, opts, cstmInfo);
      await loadCartItems();
    } catch (err) {
      showAlert(err.message === 'TWOSOME_SESSION_EXPIRED'
        ? '투썸 세션이 만료되었습니다. 다시 로그인해주세요.'
        : '수량 조정에 실패했습니다.');
      await checkTwosomeSessionAndCart();
    } finally {
      setCartLoading(false);
    }
  };

  // 항목 제거
  const handleRemoveCartItem = async (item) => {
    if (cartLoading) return;
    try {
      setCartLoading(true);
      await cartAPI().remove(item.cartNo, item.cartDtlNo);
      await loadCartItems();
    } catch (err) {
      showAlert(err.message === 'TWOSOME_SESSION_EXPIRED'
        ? '투썸 세션이 만료되었습니다. 관리 페이지에서 다시 로그인해주세요.'
        : '장바구니 항목 제거에 실패했습니다.');
      await checkTwosomeSessionAndCart();
    } finally {
      setCartLoading(false);
    }
  };

  // 전체 비우기 (확인 모달 필수)
  const handleClearCart = () => {
    if (cartItems.length === 0 || cartLoading) return;
    showConfirm('투썸 장바구니의 모든 항목을 삭제하시겠습니까?', async () => {
      try {
        setCartLoading(true);
        await cartAPI().clear();
        showAlert('장바구니가 비워졌습니다.');
        await loadCartItems();
      } catch (err) {
        showAlert(err.message === 'TWOSOME_SESSION_EXPIRED'
          ? '투썸 세션이 만료되었습니다. 관리 페이지에서 다시 로그인해주세요.'
          : '장바구니 비우기에 실패했습니다.');
        await checkTwosomeSessionAndCart();
      } finally {
        setCartLoading(false);
      }
    });
  };

  // 오늘 날짜인지 확인
  const isToday = () => {
    const today = new Date().toLocaleDateString('sv-SE');
    return selectedDate === today;
  };

  // 주문 취소 가능 여부 확인 (마감 개념 제거 — 당일 주문이면 항상 취소 가능)
  const canCancelOrder = () => {
    return isToday();
  };

  // 주문 취소 처리 (cartMode일 때 장바구니에서 동일 메뉴 1건 제거, best-effort)
  const handleCancelOrder = (order, teamName) => {
    showConfirm(`${teamName}님의 주문을 취소하시겠습니까?`, async () => {
      try {
        await orderAPI.delete(order.id);

        // 로컬 기록 삭제 후 장바구니 연동 제거 (실패필수 아님)
        if (cartMode && order.menuType === 'TWOSOME' && order.twosomeMenuCode) {
          try {
            const orderOpts = Array.isArray(order.opts) && order.opts.length > 0
              ? order.opts.join(',')
              : null;
            const match = cartItems.find((item) => {
              if ((item.upMenuCd || item.menuCd) !== order.twosomeMenuCode) return false;
              if (orderOpts && item.menuOptVal) return item.menuOptVal === orderOpts;
              return true;
            });
            if (match) {
              await cartAPI().remove(match.cartNo, match.cartDtlNo);
              await loadCartItems();
            }
          } catch (cartErr) {
            console.error('장바구니 항목 제거 실패 (무시):', cartErr);
          }
        }

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
      // 메뉴 이름 (TWOSOME이면 투썸 메뉴 이름, 레거시 CUSTOM이면 personal_option 값)
      const menuName = order.menuName;
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
      ) : orders.length === 0 && !cartMode ? (
        <div className="no-data">주문 내역이 없습니다.</div>
      ) : (
        <div className="history-content">
          {/* 로그인 팀: 메뉴집계 + 투썸 장바구니 통합 섹션 / 비로그인 팀: 팀 주문 현황만 */}
          {cartMode ? (
            <div className="summary-section">
              <h3>투썸 장바구니 ({repName || '대표'} 계정)</h3>
              <div className="total-summary">
                총 <strong>{cartItems.reduce((sum, item) => sum + (item.qty || 0), 0)}</strong>잔
                {cartItems.some((item) => item.price > 0) && (
                  <>
                    {' · 예상 총액 '}
                    <strong>
                      {cartItems
                        .filter((item) => item.price > 0)
                        .reduce((sum, item) => sum + item.price * (item.qty || 0), 0)
                        .toLocaleString()}
                    </strong>
                    원
                  </>
                )}
                {cartItems.some((item) => !item.price || item.price === 0) && (
                  <span className="unpriced-note"> (가격 확인 불가 항목 제외)</span>
                )}
              </div>
              <div className="cart-toolbar">
                <button
                  className="btn-bulk-add"
                  onClick={handleBulkAdd}
                  disabled={
                    bulkAddLoading
                    || !isStoreOpen
                    || getUnreflectedOrders().length === 0
                  }
                  title={!isStoreOpen ? '개장 후 이용 가능' : ''}
                >
                  {bulkAddLoading
                    ? '담는 중...'
                    : `투썸 장바구니 일괄 담기 (미반영 ${getUnreflectedOrders().length}건)`}
                </button>
                <button
                  className="btn-clear-cart"
                  onClick={handleClearCart}
                  disabled={cartLoading || cartItems.length === 0}
                >
                  전체 비우기
                </button>
              </div>
              {cartLoading ? (
                <div className="loading">장바구니 로딩 중...</div>
              ) : cartItems.length === 0 ? (
                <div className="no-data">장바구니가 비어 있습니다.</div>
              ) : (
                <ul className="cart-item-list">
                  {cartItems.map((item, index) => {
                    const saleStopped =
                      item.ordStopYn === 'Y' || item.ordAbleYn === 'N'
                      || (item.notSaleMsg && item.notSaleMsg.trim() !== '');
                    const unpriced = !saleStopped && (!item.price || item.price === 0);
                    return (
                      <li key={`${item.cartNo}-${item.cartDtlNo}-${index}`} className="cart-item">
                        <div className="cart-item-main">
                          <span className="cart-item-name">{item.menuNm || item.menuCd}</span>
                          {item.optNm && <div className="cart-item-opt">{item.optNm}</div>}
                          {item.cstmAmt > 0 && (
                            <div className="cart-custom-wrap">
                              <button
                                type="button"
                                className="cart-custom-toggle"
                                onClick={() => handleToggleCustom(item)}
                                disabled={cartLoading}
                              >
                                퍼스널 옵션 {expandedCustom[`${item.cartNo}-${item.cartDtlNo}`] ? '▴' : '▾'}
                                {' '}({item.cstmAmt.toLocaleString()}원)
                              </button>
                              {expandedCustom[`${item.cartNo}-${item.cartDtlNo}`] && (
                                <ul className="cart-custom-list">
                                  {expandedCustom[`${item.cartNo}-${item.cartDtlNo}`].map((d, di) => (
                                    <li key={`${item.cartDtlNo}-custom-${di}`}>
                                      <span>{d.name}</span>
                                      <span className="cart-custom-price">
                                        {(d.price || 0).toLocaleString()}원
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          <div className="cart-item-badges">
                            {saleStopped && (
                              <span className="cart-badge stopped" title={item.notSaleMsg || ''}>
                                판매불가
                              </span>
                            )}
                            {unpriced && <span className="cart-badge unpriced">가격 확인 불가</span>}
                            {item.depositAmt > 0 && <span className="cart-deposit">보증금 별도</span>}
                          </div>
                        </div>
                        {item.price > 0 && (
                          <span className="cart-item-price">{item.price.toLocaleString()}원</span>
                        )}
                        <div className="cart-qty-controls">
                          <button
                            className="cart-qty-btn"
                            onClick={() => handleCartQtyChange(item, item.qty - 1)}
                            disabled={cartLoading || item.qty <= 1}
                          >
                            -
                          </button>
                          <span className="cart-qty">{item.qty}</span>
                          <button
                            className="cart-qty-btn"
                            onClick={() => handleCartQtyChange(item, item.qty + 1)}
                            disabled={cartLoading}
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="btn-remove-cart-item"
                          onClick={() => handleRemoveCartItem(item)}
                          disabled={cartLoading}
                        >
                          제거
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="summary-section">
              <h3>팀 주문 현황</h3>
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
          )}

          {/* 개인별 주문 내역 */}
          {orders.length > 0 && (
            <div className="individual-section">
              <h3>개인별 주문 내역 ({orders.length}건)</h3>
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order.id} className="order-item">
                    <div className="order-person">{order.teamName}</div>
                    <div className="order-details">
                      <span className="order-menu">
                        {order.menuName}
                      </span>
                      {order.personalOption && (
                        <span className="order-option">
                          ({order.personalOption})
                        </span>
                      )}
                      {cartMode && order.menuType === 'TWOSOME' && !order.cartReflectedAt && (
                        <span className="cart-reflect-badge">장바구니 미반영</span>
                      )}
                    </div>
                    <button
                      className={`btn-cancel ${!canCancelOrder() ? 'disabled' : ''}`}
                      onClick={() => handleCancelOrder(order, order.teamName)}
                      disabled={!canCancelOrder()}
                      title={!canCancelOrder() ? '당일 주문만 취소할 수 있습니다' : ''}
                    >
                      주문취소
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주문 안한 사람 */}
          {orders.length > 0 && unorderedMembers.length > 0 && (
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

      {/* 일괄 담기 충돌 확인 모달 (3버튼) */}
      <Modal
        isOpen={bulkAddDialog !== null}
        onClose={() => setBulkAddDialog(null)}
        title="일부 항목이 이미 장바구니에 있습니다"
      >
        {bulkAddDialog && (
          <div className="bulk-add-dialog">
            <p className="bulk-add-desc">이미 담긴 항목:</p>
            <ul className="bulk-add-reflected-list">
              {bulkAddDialog.reflected.map((order) => (
                <li key={order.id}>
                  {order.twosomeMenuName} x 1 <span className="bulk-add-person">({order.teamName})</span>
                </li>
              ))}
            </ul>
            <div className="bulk-add-buttons">
              <button
                className="bulk-add-btn primary"
                onClick={() => {
                  const targets = bulkAddDialog.targets;
                  setBulkAddDialog(null);
                  executeBulkAdd(targets);
                }}
              >
                새 항목만 담기
              </button>
              <button
                className="bulk-add-btn"
                onClick={() => {
                  const all = [
                    ...bulkAddDialog.targets,
                    ...bulkAddDialog.reflected,
                  ];
                  setBulkAddDialog(null);
                  executeBulkAdd(all);
                }}
              >
                전부 담기
              </button>
              <button className="bulk-add-btn" onClick={() => setBulkAddDialog(null)}>
                취소
              </button>
            </div>
          </div>
        )}
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

export default HistoryPage;
