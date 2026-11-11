import React, { useCallback, useEffect, useRef, useState } from 'react';
import { orderAPI, repAPI, twosomeStoreAPI } from '../services/api';
import AlertModal from './AlertModal';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import useModal from '../hooks/useModal';
import { isWithinStoreHours as storeIsOpen } from '../utils/storeHours';
import createVisiblePolling from '../utils/polling';

const parseCustom = (order) => {
  try {
    return order.cstmInfo ? JSON.parse(order.cstmInfo) : null;
  } catch {
    return null;
  }
};

const LiveCartPanel = ({ departmentId, onOrderClick, orders: externalOrders, reps: externalReps, onOrdersChange, onRepsChange, onSummaryChange }) => {
  const [internalReps, setInternalReps] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [internalOrders, setInternalOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [cartError, setCartError] = useState('');
  const [storeOpen, setStoreOpen] = useState(false);
  const [expandedCustom, setExpandedCustom] = useState({});
  const [bulkDialog, setBulkDialog] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const requestSequence = useRef(0);
  const {
    isAlertOpen, alertConfig, showAlert, closeAlert,
    isConfirmOpen, confirmConfig, showConfirm, closeConfirm,
  } = useModal();
  const reps = externalReps ?? internalReps;
  const hasExternalReps = externalReps !== undefined;
  const hasExternalOrders = externalOrders !== undefined;
  const selectedRep = reps.find((rep) => rep.id === Number(selectedRepId));
  const isActive = selectedRep?.twosomeStatus === 'ACTIVE';
  const orders = externalOrders ?? internalOrders;
  const pendingOrders = orders.filter((order) => order.twosomeMenuCode && !order.cartReflectedAt);
  const reflectedForRep = orders.filter((order) => order.twosomeMenuCode && order.cartReflectedBy === selectedRep?.id);

  const loadReps = useCallback(async () => {
    try {
      const list = await repAPI.list(departmentId) || [];
      setInternalReps(list);
      onRepsChange?.(list);
    } catch (err) {
      setInternalReps([]);
      onRepsChange?.([]);
      setCartError('대표 목록을 불러오지 못했습니다.');
    }
  }, [departmentId, onRepsChange]);

  useEffect(() => {
    setSelectedRepId((current) => reps.find((rep) => rep.id === current)?.id
      || reps.find((rep) => rep.twosomeStatus === 'ACTIVE')?.id || reps[0]?.id || null);
  }, [reps]);

  const loadOrders = useCallback(async (signal) => {
    try {
      const nextOrders = await orderAPI.getToday(departmentId, { signal }) || [];
      setInternalOrders(nextOrders);
      onOrdersChange?.(nextOrders);
    } catch (err) {
      if (err.name !== 'AbortError') setCartError('오늘의 팀 주문서를 불러오지 못했습니다.');
    }
  }, [departmentId, onOrdersChange]);

  useEffect(() => {
    onSummaryChange?.({
      itemCount: cartItems.reduce((sum, item) => sum + (item.qty || 0), 0),
      totalPrice: cartItems.some((item) => item.price > 0)
        ? cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0)
        : 0,
    });
  }, [cartItems, onSummaryChange]);

  const loadStoreOpen = useCallback(async () => {
    try {
      const info = await twosomeStoreAPI.getStoreInfo();
      const open = storeIsOpen(info);
      setStoreOpen(open);
      return open;
    } catch (err) {
      setStoreOpen(false);
      return false;
    }
  }, []);

  const loadCart = useCallback(async (rep, silent = false, signal) => {
    if (!rep || rep.twosomeStatus !== 'ACTIVE') {
      requestSequence.current += 1;
      setCartItems([]);
      setCartError('');
      setLastCheckedAt(null);
      return;
    }
    const sequence = ++requestSequence.current;
    if (!silent) setLoading(true);
    setCartError('');
    try {
      const items = await repAPI.repGetCart(rep.id, { signal }) || [];
      if (sequence !== requestSequence.current) return;
      setCartItems(items);
      setLastCheckedAt(new Date());
    } catch (err) {
      if (err.name === 'AbortError' || sequence !== requestSequence.current) return;
      setCartItems([]);
      setCartError(err.message === 'TARGET_REP_SESSION_REQUIRED' || err.message === 'TWOSOME_SESSION_EXPIRED'
        ? '대표 투썸 세션이 만료되었습니다. 주문 화면에서 다시 로그인해주세요.'
        : '장바구니 조회에 실패했습니다. 이전 항목을 현재 상태로 표시하지 않습니다.');
      loadReps();
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [loadReps]);

  useEffect(() => {
    setCartItems([]);
    setLastCheckedAt(null);
    setCartError('');
    setExpandedCustom({});
    if (!hasExternalReps) loadReps();
    if (!hasExternalOrders) loadOrders();
    loadStoreOpen();
  }, [hasExternalReps, hasExternalOrders, loadReps, loadOrders, loadStoreOpen]);

  useEffect(() => {
    setCartItems([]);
    setLastCheckedAt(null);
    setExpandedCustom({});
    if (!selectedRep) return undefined;
    loadCart(selectedRep);
    const stopPolling = createVisiblePolling(async (signal) => {
      await Promise.all([loadCart(selectedRep, true, signal), loadOrders(signal)]);
    }, 15000);
    return () => {
      requestSequence.current += 1;
      stopPolling();
    };
  }, [selectedRep, loadCart, loadOrders]);

  const fetchCustomDetail = async (item) => {
    try {
      return await twosomeStoreAPI.getCartCustomList(item.cartNo, item.cartDtlNo, selectedRep.id);
    } catch (err) {
      showAlert('퍼스널 옵션을 조회하지 못했습니다.');
      return [];
    }
  };

  const toggleCustom = async (item) => {
    const id = `${item.cartNo}-${item.cartDtlNo}`;
    if (expandedCustom[id]) {
      setExpandedCustom((previous) => ({ ...previous, [id]: null }));
      return;
    }
    const details = await fetchCustomDetail(item);
    setExpandedCustom((previous) => ({ ...previous, [id]: details }));
  };

  const changeQuantity = async (item, quantity) => {
    if (quantity < 1 || loading) return;
    setLoading(true);
    try {
      const opts = item.menuOptVal ? item.menuOptVal.split(',').map((value) => value.trim()).filter(Boolean) : null;
      const details = item.cstmAmt > 0 ? await fetchCustomDetail(item) : [];
      const cstmInfo = details.map((detail, index) => ({
        CSTM_NUM: index, MENU_CD: item.menuCd, SET_MENU_YN: 'N',
        CSTM_GRP_CD: detail.grpCd || '', TYPE_ADD_CD: detail.typeAddCd || '',
        CSTM_ADD_CD: detail.cstmAddCd || '', TYPE_CHG_CD: detail.typeChgCd || '',
        CSTM_CHG_CD: detail.cstmChgCd || '', CSTM_ORD_CNT: detail.cnt || 0,
        CSTM_ORD_AMT: detail.cnt > 1 ? Math.round((detail.price || 0) / detail.cnt) : (detail.price || 0),
        CSTM_DEPOSIT: 0,
      }));
      await repAPI.repAdjustCartItemQty(item.cartNo, item.cartDtlNo, item.menuCd, quantity, opts, cstmInfo, selectedRep.id);
      await loadCart(selectedRep);
    } catch (err) {
      showAlert('수량 변경에 실패했습니다. 장바구니를 새로고침해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (item) => {
    setLoading(true);
    try {
      await repAPI.repRemoveCartItem(item.cartNo, item.cartDtlNo, selectedRep.id);
      await loadCart(selectedRep);
    } catch (err) {
      showAlert('항목 제거에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = () => {
    if (cartItems.length === 0 || loading) return;
    showConfirm(`${selectedRep.name}의 실제 투썸 장바구니를 모두 비우시겠습니까? 로컬 주문 기록은 유지됩니다.`, async () => {
      setLoading(true);
      try {
        await repAPI.repClearCart(selectedRep.id);
        setExpandedCustom({});
        await loadCart(selectedRep);
        showAlert('실제 투썸 장바구니를 비웠습니다. 로컬 주문 기록은 유지됩니다.');
      } catch (err) {
        showAlert('장바구니 비우기에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    });
  };

  const buildItems = (targets) => targets.map((order) => ({
    menuCd: order.twosomeMenuCode, upMenuCd: order.twosomeMenuCode, midCd: order.twosomeMenuMidCd || null, qty: 1,
    variantMenuCd: order.variantMenuCd || null,
    opts: order.variantOpts ? order.variantOpts.split(',').map((value) => value.trim()).filter(Boolean) : null,
    cstmInfo: parseCustom(order),
  }));

  const executeBulkAdd = async (targets) => {
    if (bulkLoading || targets.length === 0) return;
    setBulkLoading(true);
    try {
      const open = await loadStoreOpen();
      if (!open) {
        showAlert('매장이 닫혀 있어 팀 주문서만 유지합니다. 개장 후 다시 시도해주세요.');
        return;
      }
      const result = await repAPI.repAddToCart(selectedRep.id, buildItems(targets));
      const successful = (result?.results || []).filter((item) => item.success);
      const remaining = [...successful];
      const ids = [];
      targets.forEach((order) => {
        const index = remaining.findIndex((item) => item.menuCd === order.twosomeMenuCode);
        if (index >= 0) {
          ids.push(order.id);
          remaining.splice(index, 1);
        }
      });
      if (ids.length > 0) await orderAPI.markCartReflected(ids, selectedRep.id);
      await Promise.all([loadCart(selectedRep), loadOrders()]);
      const failed = (result?.results || []).filter((item) => !item.success).map((item) => item.menuNm || item.menuCd).join(', ');
      showAlert(`담기 결과: 성공 ${ids.length}건, 실패 ${targets.length - ids.length}건${failed ? ` (${failed})` : ''}`);
    } catch (err) {
      showAlert('일괄 담기에 실패했습니다. 대표 로그인 상태와 매장 영업시간을 확인해주세요.');
      await loadReps();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAdd = () => {
    if (!storeOpen) return;
    if (reflectedForRep.length > 0) {
      setBulkDialog({ targets: pendingOrders, reflected: reflectedForRep });
    } else {
      executeBulkAdd(pendingOrders);
    }
  };

  return (
    <section id="live-cart-section" className="live-cart-panel" aria-busy={loading} aria-labelledby="live-cart-title">
      <div className="live-cart-card">
        <div className="live-cart-heading">
          <div>
            <h2 id="live-cart-title">실시간 장바구니</h2>
            <p>선택한 대표의 실제 투썸 장바구니입니다.</p>
          </div>
          {isActive && (
            <div className="live-cart-heading-total">
              총 <strong>{cartItems.reduce((sum, item) => sum + (item.qty || 0), 0)}</strong>건
              {cartItems.some((item) => item.price > 0) && <span> · {cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0).toLocaleString()}원</span>}
            </div>
          )}
        </div>
        <div className="live-cart-toolbar">
          <label>장바구니 대표
            <select value={selectedRepId || ''} onChange={(event) => setSelectedRepId(Number(event.target.value) || null)}>
              {reps.length === 0 && <option value="">등록된 대표 없음</option>}
              {reps.map((rep) => <option key={rep.id} value={rep.id} disabled={rep.twosomeStatus !== 'ACTIVE'}>{rep.name} · {rep.statusReason}</option>)}
            </select>
          </label>
          <button className="today-button" onClick={() => { loadReps(); loadCart(selectedRep); loadOrders(); }} disabled={loading}>지금 새로고침</button>
        </div>
        {reps.length === 0 && <div className="no-data">등록된 대표가 없습니다. 주문 화면에서 본인 팀원을 선택하고 대표로 등록할 수 있습니다.</div>}
        {selectedRep && !isActive && <div className="cart-status-message"><strong>{selectedRep.name}</strong> · {selectedRep.statusReason}<p>주문 화면에서 해당 대표로 로그인하면 실시간 장바구니를 조회할 수 있습니다.</p></div>}
        {!isActive && <button className="btn-bulk-add" onClick={onOrderClick}>주문 화면에서 대표 로그인</button>}
        {isActive && (
          <>
            <div className="cart-live-status">
              <span>15초마다 자동 확인 · 마지막 확인: {lastCheckedAt ? lastCheckedAt.toLocaleString('ko-KR') : '확인 중'}</span>
              {!storeOpen && <strong>매장 닫힘 · 로컬 주문서만 저장 가능</strong>}
            </div>
            {cartError && <div className="cart-error-notice">{cartError}</div>}
            {!cartError && (
              <div className="summary-section">
                <div className="live-cart-content-heading">
                  <h3>{selectedRep.name}의 실제 투썸 장바구니</h3>
                  {cartItems.length > 0 && <button className="btn-clear-cart" onClick={clearCart} disabled={loading}>전체 비우기</button>}
                </div>
                {loading && cartItems.length === 0 ? <div className="loading">장바구니 확인 중...</div> : cartItems.length === 0 ? (
                  <div className="no-data">현재는 {selectedRep.name}의 장바구니가 비어 있습니다.</div>
                ) : (
                  <ul className="cart-item-list">
                    {cartItems.map((item, index) => {
                      const id = `${item.cartNo}-${item.cartDtlNo}`;
                      const stopped = item.ordStopYn === 'Y' || item.ordAbleYn === 'N' || Boolean(item.notSaleMsg?.trim());
                      return <li className="cart-item" key={`${id}-${index}`}>
                        <div className="cart-item-main">
                          <span className="cart-item-name">{item.menuNm || item.menuCd}</span>
                          {item.optNm && <div className="cart-item-opt">{item.optNm}</div>}
                          {item.cstmAmt > 0 && <div className="cart-custom-wrap"><button className="cart-custom-toggle" onClick={() => toggleCustom(item)}>퍼스널 옵션 {expandedCustom[id] ? '닫기' : '보기'} ({item.cstmAmt.toLocaleString()}원)</button>{expandedCustom[id] && <ul className="cart-custom-list">{expandedCustom[id].map((detail, detailIndex) => <li key={detailIndex}><span>{detail.name}</span><span>{(detail.price || 0).toLocaleString()}원</span></li>)}</ul>}</div>}
                          <div className="cart-item-badges">{stopped && <span className="cart-badge stopped">판매불가{item.notSaleMsg ? ` · ${item.notSaleMsg}` : ''}</span>}{!stopped && !item.price && <span className="cart-badge unpriced">가격 확인 불가</span>}</div>
                        </div>
                        {item.price > 0 && <span className="cart-item-price">{item.price.toLocaleString()}원</span>}
                        <div className="cart-qty-controls"><button className="cart-qty-btn" onClick={() => changeQuantity(item, item.qty - 1)} disabled={loading || item.qty <= 1} aria-label={`${item.menuNm} 수량 줄이기`}>-</button><span className="cart-qty">{item.qty}</span><button className="cart-qty-btn" onClick={() => changeQuantity(item, item.qty + 1)} disabled={loading} aria-label={`${item.menuNm} 수량 늘리기`}>+</button></div>
                        <button className="btn-remove-cart-item" onClick={() => removeItem(item)} disabled={loading}>제거</button>
                      </li>;
                    })}
                  </ul>
                )}
              </div>
            )}
            <div className="local-cart-section">
              <h3>오늘의 팀 주문서 (로컬)</h3>
              <p>외부 장바구니와 별도로 저장된 기록입니다. 미반영 {pendingOrders.length}건 · {selectedRep.name}에게 반영됨 {reflectedForRep.length}건</p>
              <button className="btn-bulk-add" onClick={handleBulkAdd} disabled={bulkLoading || !storeOpen || pendingOrders.length === 0} title={!storeOpen ? '매장 개장 후 이용할 수 있습니다' : ''}>{bulkLoading ? '담는 중...' : `미반영 주문을 ${selectedRep.name} 장바구니에 일괄 담기`}</button>
            </div>
          </>
        )}
      </div>
      <Modal isOpen={Boolean(bulkDialog)} onClose={() => setBulkDialog(null)} title="이미 담은 항목이 있습니다">
        {bulkDialog && <div className="bulk-add-dialog">
          <p>다음 항목은 이미 {selectedRep.name} 장바구니 담기로 기록되어 있습니다.</p>
          <ul className="bulk-add-reflected-list">{bulkDialog.reflected.map((order) => <li key={order.id}>{order.menuName} · {order.teamName}</li>)}</ul>
          <p>미반영 {bulkDialog.targets.length}건을 담거나, 기존 항목도 한 번 더 담을 수 있습니다.</p>
          <div className="bulk-add-buttons">
            <button className="bulk-add-btn primary" onClick={() => { const targets = bulkDialog.targets; setBulkDialog(null); executeBulkAdd(targets); }} disabled={bulkDialog.targets.length === 0}>미반영 항목만 담기</button>
            <button className="bulk-add-btn" onClick={() => { const targets = [...bulkDialog.targets, ...bulkDialog.reflected]; setBulkDialog(null); executeBulkAdd(targets); }}>기존 항목도 한 번 더 담기</button>
            <button className="bulk-add-btn" onClick={() => setBulkDialog(null)}>취소</button>
          </div>
        </div>}
      </Modal>
      <ConfirmModal isOpen={isConfirmOpen} onClose={closeConfirm} onConfirm={confirmConfig.onConfirm} message={confirmConfig.message} title={confirmConfig.title} />
      <AlertModal isOpen={isAlertOpen} onClose={closeAlert} message={alertConfig.message} title={alertConfig.title} />
    </section>
  );
};

export default LiveCartPanel;
