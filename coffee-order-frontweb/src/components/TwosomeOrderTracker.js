import React, { useCallback, useEffect, useRef, useState } from 'react';
import { repAPI } from '../services/api';
import createVisiblePolling from '../utils/polling';
import './TwosomeOrderTracker.css';

const PROGRESS_STEPS = ['결제완료', '주문전송', '주문접수', '준비완료', '수령완료'];
const TERMINAL_CODES = new Set(['60', '80']);

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};

const statusClass = (order) => {
  if (order.statusCode === '80') return 'canceled';
  if (order.statusCode === '60') return 'completed';
  if (order.displayStatus === '준비완료') return 'ready';
  return 'progress';
};

const TwosomeOrderTracker = ({ selectedRep, onNeedLogin, refreshNonce = 0 }) => {
  const [ownerId, setOwnerId] = useState(null);
  const [ownerLoaded, setOwnerLoaded] = useState(false);
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [refreshDelay, setRefreshDelay] = useState(3000);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const requestSequence = useRef(0);
  const inFlight = useRef(false);
  const sessionBlockedRef = useRef(false);
  const selectedRepId = selectedRep?.id;
  const isActive = selectedRep?.twosomeStatus === 'ACTIVE';
  const canView = ownerLoaded && ownerId !== null && Number(selectedRepId) === Number(ownerId);

  useEffect(() => {
    let alive = true;
    setOwnerLoaded(false);
    setOwnerId(null);
    if (!localStorage.getItem('repToken')) {
      setOwnerLoaded(true);
      return () => { alive = false; };
    }
    repAPI.me().then((me) => {
      if (alive) setOwnerId(me.id);
    }).catch(() => {
      if (alive) setOwnerId(null);
    }).finally(() => {
      if (alive) setOwnerLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  const applyView = useCallback((nextView) => {
    setView(nextView);
    if (nextView.status === 'CHECK_UNAVAILABLE') {
      setError(nextView.message || '일시적으로 주문 상태를 확인할 수 없습니다.');
      setRefreshDelay(30000);
      return;
    }
    setError('');
    const orders = nextView.orders || [];
    const hasInProgressOrder = orders.some((order) => !TERMINAL_CODES.has(order.statusCode));
    const receiptOnly = !nextView.observation && !hasInProgressOrder && orders.some((order) =>
      order.statusCode === '60' && order.receiptAvailable && !order.paymentApproved);
    setRefreshDelay(nextView.observation?.status === 'HOLD' ? 15000 : receiptOnly ? 60000 : 3000);
    setLastCheckedAt(new Date());
  }, []);

  const refresh = useCallback(async (silent = true, signal) => {
    if (!canView || !isActive || sessionBlockedRef.current || inFlight.current) return;
    const sequence = ++requestSequence.current;
    inFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const nextView = await repAPI.refreshTwosomeOrders({ signal });
      if (sequence !== requestSequence.current) return;
      applyView(nextView);
    } catch (err) {
      if (err.name === 'AbortError' || sequence !== requestSequence.current) return;
      if (err.message === 'AUTH_FAILED') {
        localStorage.removeItem('repToken');
        sessionBlockedRef.current = true;
        setSessionBlocked(true);
        setOwnerId(null);
        setError('');
      } else if (err.message === 'TARGET_REP_SESSION_REQUIRED' || err.message === 'TWOSOME_SESSION_EXPIRED') {
        sessionBlockedRef.current = true;
        setSessionBlocked(true);
        setError('투썸 세션이 만료되어 자동 확인을 멈췄습니다. 대표 로그인 후 다시 시도해주세요.');
      } else {
        setError('네트워크 오류로 확인하지 못했습니다. 저장된 주문과 스냅숏은 유지하며 30초 후 다시 시도합니다.');
        setRefreshDelay(30000);
      }
    } finally {
      if (sequence === requestSequence.current) {
        inFlight.current = false;
        setRefreshing(false);
      }
    }
  }, [applyView, canView, isActive]);

  useEffect(() => {
    let alive = true;
    requestSequence.current += 1;
    inFlight.current = false;
    sessionBlockedRef.current = false;
    setView(null);
    setError('');
    setSessionBlocked(false);
    setResetting(false);
    setRefreshDelay(3000);
    setLastCheckedAt(null);
    setExpandedOrders({});
    if (!canView) return undefined;
    if (isActive) {
      refresh(false);
    } else {
      repAPI.getTwosomeOrders().then((nextView) => {
        if (alive) applyView(nextView);
      }).catch(() => {
        if (alive) setError('저장된 주문 상태를 불러오지 못했습니다.');
      });
    }
    return () => { alive = false; };
  }, [selectedRepId, canView, isActive, refresh, refreshNonce, applyView]);

  const hasActiveWork = Boolean(view?.observation)
    || Boolean(view?.orders?.some((order) => !TERMINAL_CODES.has(order.statusCode)
      || (order.statusCode === '60' && order.receiptAvailable && !order.paymentApproved)));
  const shouldPoll = canView && isActive && !sessionBlocked && hasActiveWork;

  useEffect(() => {
    if (!shouldPoll) return undefined;
    return createVisiblePolling((signal) => refresh(true, signal), refreshDelay);
  }, [refresh, refreshDelay, shouldPoll]);

  const resetObservation = async () => {
    if (inFlight.current) return;
    const sequence = ++requestSequence.current;
    inFlight.current = true;
    setResetting(true);
    try {
      const nextView = await repAPI.resetTwosomeOrders();
      if (sequence === requestSequence.current) applyView(nextView);
    } catch (err) {
      if (err.message === 'AUTH_FAILED') {
        localStorage.removeItem('repToken');
        setOwnerId(null);
      } else if (sequence === requestSequence.current) {
        setError('현재 장바구니로 관찰을 다시 시작하지 못했습니다. 로그인 상태를 확인해주세요.');
      }
    } finally {
      if (sequence === requestSequence.current) {
        inFlight.current = false;
        setResetting(false);
      }
    }
  };

  const toggleDetails = (orderId) => {
    setExpandedOrders((previous) => ({ ...previous, [orderId]: !previous[orderId] }));
  };

  if (!selectedRep) return null;

  return (
    <section className="twosome-order-tracker" aria-labelledby="twosome-order-tracker-title">
      <div className="order-tracker-heading">
        <div>
          <h3 id="twosome-order-tracker-title">투썸 주문 진행</h3>
          <p>장바구니 반영 후 실제 주문과 결제 상태를 자동으로 연결합니다.</p>
        </div>
        {canView && isActive && !sessionBlocked && (
          <button type="button" className="order-tracker-refresh" onClick={() => refresh(false)} disabled={refreshing || resetting}>
            {refreshing ? '확인 중...' : '지금 확인'}
          </button>
        )}
      </div>

      {!ownerLoaded && <div className="order-tracker-empty">대표 본인 확인 중...</div>}
      {ownerLoaded && !canView && (
        <div className="order-tracker-login-guide">
          <strong>{selectedRep.name} 대표의 주문은 본인만 조회할 수 있습니다.</strong>
          <p>대표 본인 PIN 로그인 후 실제 주문번호와 준비 상태를 확인할 수 있습니다.</p>
          <button type="button" className="order-tracker-login-button" onClick={onNeedLogin}>주문 화면에서 대표 로그인</button>
        </div>
      )}

      {canView && (
        <>
          <div className="order-tracker-status-line" aria-live="polite">
            <span className={shouldPoll ? 'tracker-live-dot active' : 'tracker-live-dot'} />
            <span>
              {sessionBlocked ? '자동 확인 중단' : shouldPoll
                ? `${refreshDelay / 1000}초마다 자동 확인` : '진행 중인 주문이 없어 자동 확인 대기'}
              {lastCheckedAt && ` · 마지막 확인 ${lastCheckedAt.toLocaleTimeString('ko-KR')}`}
            </span>
          </div>
          {error && <div className="order-tracker-error" role="alert">{error}</div>}
          {sessionBlocked && <button type="button" className="order-tracker-login-button" onClick={onNeedLogin}>주문 화면에서 대표 로그인</button>}
          {(view?.observation?.holdReason || view?.status === 'EXPIRED') && (
            <div className="order-tracker-hold">
              <strong>{view?.status === 'EXPIRED' ? '결제 관찰 종료' : '자동 연결 보류'}</strong>
              <span>{view?.observation?.holdReason || view?.message}</span>
              <button type="button" className="order-tracker-login-button" onClick={resetObservation} disabled={resetting || refreshing}>
                {resetting ? '기준점 저장 중...' : '현재 장바구니로 다시 관찰'}
              </button>
            </div>
          )}
          {view?.message && !error && <p className="order-tracker-message">{view.message}</p>}
          {!view && !error && <div className="order-tracker-empty">저장된 주문 상태를 확인하는 중...</div>}
          {view && view.orders.length === 0 && (
            <div className="order-tracker-empty">
              {view.observation
                ? '아직 새 주문이 감지되지 않았습니다. 투썸 앱에서 결제하면 실제 주문을 자동으로 연결합니다.'
                : '자동 연결된 투썸 주문이 없습니다. 장바구니 반영 후 투썸 앱에서 결제해주세요.'}
            </div>
          )}
          <div className="twosome-order-list">
            {view?.orders?.map((order) => {
              const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const expanded = Boolean(expandedOrders[order.id]);
              return (
                <article className="twosome-order-card" key={order.ordNo}>
                  <div className="twosome-order-card-heading">
                    <div className="twosome-order-number">
                      <span>주문번호</span>
                      <strong>{order.simpleOrderNo || '확인 중'}</strong>
                    </div>
                    <span className={`twosome-order-status ${statusClass(order)}`}>{order.displayStatus}</span>
                  </div>
                  <div className="twosome-order-meta">
                    <span>{order.storeNm}</span>
                    <span>{formatDateTime(order.orderedAt)}</span>
                    <span>{quantity}개</span>
                  </div>
                  {order.statusCode !== '80' && order.steps.length > 0 && (
                    <ol className="twosome-order-progress" aria-label="주문 진행 단계">
                      {PROGRESS_STEPS.map((name) => {
                        const step = order.steps.find((candidate) => candidate.name === name);
                        const state = step?.state || 'PENDING';
                        return <li key={name} className={state.toLowerCase()}><span />{name}</li>;
                      })}
                    </ol>
                  )}
                  <div className="twosome-order-payment-line">
                    {order.finalPaymentAmount !== null && (
                      <strong>{order.statusCode === '80' ? '취소 주문 표시 금액' : '상세 결제금액'} {order.finalPaymentAmount.toLocaleString()}원</strong>
                    )}
                    <span>{order.paymentApproved
                      ? `카드 승인 확인 · ${formatDateTime(order.paymentApprovedAt)}`
                      : order.receiptAvailable ? '전자영수증 승인 정보 확인 대기' : '주문 상태 동기화 기준'}</span>
                  </div>
                  {order.pickupAt && <div className="twosome-order-pickup">실제 수령 · {formatDateTime(order.pickupAt)}</div>}
                  <button type="button" className="twosome-order-detail-toggle" onClick={() => toggleDetails(order.id)} aria-expanded={expanded}>
                    {expanded ? '주문 상세 닫기' : '메뉴·결제 상세 보기'}
                  </button>
                  {expanded && (
                    <div className="twosome-order-detail">
                      <ul className="twosome-order-item-list">
                        {order.items.map((item) => (
                          <li key={item.ordDtlNo}>
                            <div><strong>{item.menuNm || item.menuCd}</strong><span> × {item.quantity}</span></div>
                            {item.optionNm && <p>{item.optionNm}</p>}
                            {item.customOptions.length > 0 && (
                              <p>퍼스널 옵션 · {item.customOptions.map((option) => `${option.name || option.cstmAddCd || option.cstmChgCd}${option.quantity > 1 ? ` × ${option.quantity}` : ''}`).join(', ')}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                      <dl className="twosome-order-facts">
                        <div><dt>전체 주문 식별자</dt><dd>{order.ordNo}</dd></div>
                        {order.totalOrderAmount !== null && <div><dt>총 주문금액</dt><dd>{order.totalOrderAmount.toLocaleString()}원</dd></div>}
                        {order.discountAmount !== null && <div><dt>할인</dt><dd>{order.discountAmount.toLocaleString()}원</dd></div>}
                        {Object.entries(order.paymentAmounts).filter(([label]) => !['총 주문금액', '할인', '최종 결제금액'].includes(label)).map(([label, amount]) => (
                          <div key={label}><dt>{label}</dt><dd>{amount.toLocaleString()}원</dd></div>
                        ))}
                        {order.posSaleNo && <div><dt>POS 판매번호</dt><dd>{order.posSaleNo}</dd></div>}
                        {order.linkedAt && <div><dt>자동 연결 시각</dt><dd>{formatDateTime(order.linkedAt)}</dd></div>}
                      </dl>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};

export default TwosomeOrderTracker;
