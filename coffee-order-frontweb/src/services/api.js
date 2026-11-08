// API Base URL 설정
// 프로덕션: 상대 경로 사용 (Spring Boot와 같은 서버)
// 개발: localhost:8080 (프록시 사용)
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 공통 Fetch 함수
const fetchAPI = async (url, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    // 204 No Content 또는 빈 응답 처리
    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// ==================== Department API ====================
export const departmentAPI = {
  // 전체 부서 조회
  getAll: () => fetchAPI('/departments'),

  // ID로 조회
  getById: (id) => fetchAPI(`/departments/${id}`),

  // 부서 생성
  create: (department) => fetchAPI('/departments', {
    method: 'POST',
    body: JSON.stringify(department),
  }),

  // 부서 수정
  update: (id, department) => fetchAPI(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(department),
  }),

  // 부서 삭제
  delete: (id) => fetchAPI(`/departments/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== Team API ====================
export const teamAPI = {
  // 전체 팀원 조회 (부서별 필터링)
  getAll: (departmentId) => fetchAPI(departmentId ? `/teams?departmentId=${departmentId}` : '/teams'),

  // 팀원 생성
  create: (team) => fetchAPI('/teams', {
    method: 'POST',
    body: JSON.stringify(team),
  }),

  // 팀원 수정
  update: (id, team) => fetchAPI(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(team),
  }),

  // 팀원 삭제
  delete: (id) => fetchAPI(`/teams/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== Order API ====================
export const orderAPI = {
  // 오늘 주문 조회 (부서별 필터링)
  getToday: (departmentId) => fetchAPI(departmentId ? `/orders/today?departmentId=${departmentId}` : '/orders/today'),

  // 특정 날짜 주문 조회 (부서별 필터링)
  getByDate: (date, departmentId) => {
    const params = new URLSearchParams({ date });
    if (departmentId) params.append('departmentId', departmentId);
    return fetchAPI(`/orders?${params.toString()}`);
  },

  // 주문 생성
  create: (order) => fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),

  // 주문 수정
  update: (id, order, departmentId) => {
    const params = departmentId ? `?departmentId=${departmentId}` : '';
    return fetchAPI(`/orders/${id}${params}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  },

  // 주문 삭제
  delete: (id) => fetchAPI(`/orders/${id}`, {
    method: 'DELETE',
  }),

  // 장바구니 반영 일시 일괄 마킹 (일괄 담기 성공 후)
  markCartReflected: (orderIds) => fetchAPI('/orders/cart-reflected', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  }),

  // 날짜별 메뉴 집계
  getSummary: (date) => fetchAPI(`/orders/summary?date=${date}`),

  // 특정 팀원의 오늘 주문 조회
  getTodayByTeam: (teamId) => fetchAPI(`/orders/team/${teamId}/today`),

  // 특정 팀원의 최근 주문 조회
  getLatestByTeam: (teamId) => fetchAPI(`/orders/team/${teamId}/latest`),
};

// ==================== Settings API ====================
export const settingsAPI = {
  // 설정 조회 (부서별)
  get: (departmentId) => fetchAPI(departmentId ? `/settings?departmentId=${departmentId}` : '/settings'),

  // 설정 업데이트 (부서별)
  update: (settings, departmentId) => {
    const params = departmentId ? `?departmentId=${departmentId}` : '';
    return fetchAPI(`/settings${params}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // 주문 가능 여부 체크 (부서별)
  checkOrderAvailable: (departmentId) => fetchAPI(departmentId ? `/settings/order-available?departmentId=${departmentId}` : '/settings/order-available'),
};

// ==================== Twosome Menu API ====================
export const twosomeMenuAPI = {
  // 전체 메뉴 조회 (중분류별 그룹화, 매장 메뉴 기준)
  getAll: () => fetchAPI('/twosome-menus'),};

// ==================== Twosome Store Integration API (PoC) ====================
const repTokenHeaderIfAny = () => {
  const token = localStorage.getItem('repToken');
  return token ? { 'X-Rep-Token': token } : {};
};

export const twosomeStoreAPI = {
  // 세션 상태 조회
  getSession: () => fetchAPI('/twosome/session'),

  // 연동 상태 패널 (세션 + 유형별 지표 + 최근 이벤트)
  getHealth: () => fetchAPI('/twosome/health'),

  // 캡차 발급
  requestCaptcha: () => fetchAPI('/twosome/auth/captcha', {
    method: 'POST',
  }),

  // 로그인
  login: (loginData) => fetchAPI('/twosome/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  }),

  // 로그아웃
  logout: () => fetchAPI('/twosome/auth/logout', {
    method: 'POST',
  }),

  // 자동 재로그인 (캡차 OCR + 관리자 자격증명)
  autoLogin: () => fetchAPI('/twosome/auth/auto-login', {
    method: 'POST',
  }),

  // 매장 메뉴로 메뉴 DB 새로고침
  refreshMenu: () => fetchAPI('/twosome/menu/refresh', {
    method: 'POST',
  }),

  // 팀 주문 항목을 투썸 장바구니에 일괄 담기
  addToCart: (items) => fetchAPI('/twosome/cart/add', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }),

  // 투썸 장바구니 목록 조회
  getCart: () => fetchAPI('/twosome/cart'),

  // 투썸 장바구니 항목 삭제
  removeCartItem: (cartNo, cartDtlNo) => fetchAPI(`/twosome/cart/items/${cartNo}?cartDtlNo=${encodeURIComponent(cartDtlNo)}`, {
    method: 'DELETE',
  }),

  // 투썸 장바구니 항목 수량 조정 (삭제 + 재담기)
  // 투썸 장바구니 항목 수량 조정 (삭제 + 재담기, 옵션 조합 + 퍼스널 옵션 복원 포함)
  adjustCartItemQty: (cartNo, cartDtlNo, menuCd, qty, opts, cstmInfo) => fetchAPI(`/twosome/cart/items/${cartNo}/qty`, {
    method: 'PUT',
    body: JSON.stringify({ cartDtlNo, menuCd, qty, opts, cstmInfo }),
  }),

  // 투썸 장바구니 전체 비우기
  clearCart: () => fetchAPI('/twosome/cart/clear', {
    method: 'POST',
  }),

  // 장바구니 항목의 퍼스널 옵션(커스텀) 명세 조회 (읽기 전용)
  getCartCustomList: (cartNo, cartDtlNo) => fetchAPI('/twosome/cart/custom-list', {
    method: 'POST',
    headers: repTokenHeaderIfAny(),
    body: JSON.stringify({ cartNo, cartDtlNo }),
  }),

  // 메뉴 옵션 그룹 조회 (상세 페이지 파싱 + 캐시, 관리자/대표 세션 필요)
  getMenuOptions: (menuCd) => fetchAPI(`/twosome/menus/${menuCd}/options`, {
    headers: repTokenHeaderIfAny(),
  }),

  // 옵션 그룹 의존성 조회 (선택한 옵션 기준 미선택 그룹의 가능 선택지, 읽기 전용)
  getAvailableOptions: (menuCd, opts, groupOptCds) => fetchAPI('/twosome/menus/available-options', {
    method: 'POST',
    headers: repTokenHeaderIfAny(),
    body: JSON.stringify({ menuCd, opts, groupOptCds }),
  }),

  // 투썸 퍼스널 옵션(커스텀) 목록 조회 (변형 메뉴 코드 기준, 수량형+선택형)
  getMenuCustomOptions: (variantMenuCd) => fetchAPI('/twosome/menus/custom-options', {
    method: 'POST',
    headers: repTokenHeaderIfAny(),
    body: JSON.stringify({ menuCd: variantMenuCd }),
  }),

  // 선택 옵션의 변형 메뉴 코드 조회 (예상 가격 포함)
  resolveVariant: (menuCd, opts) => fetchAPI('/twosome/menus/resolve-variant', {
    method: 'POST',
    headers: repTokenHeaderIfAny(),
    body: JSON.stringify({ menuCd, opts }),
  }),

  // 매장 상세 정보 (영업시간/시설 태그, 세션 불필요)
  getStoreInfo: () => fetchAPI('/twosome/store-info'),

  // 최근 메뉴 새로고침 diff 리포트 (없으면 빈 객체)
  getMenuRefreshDiff: () => fetchAPI('/twosome/menu-refresh/diff'),
};

// ==================== Admin API (/admin 전용 페이지) ====================
const adminTokenHeader = () => ({
  'X-Admin-Token': localStorage.getItem('adminToken') || '',
});

export const adminAPI = {
  login: (password) => fetchAPI('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),

  // 팀 대표 목록 (PIN 관련 값 미포함)
  getReps: () => fetchAPI('/admin/reps', { headers: adminTokenHeader() }),

  createRep: (data) => fetchAPI('/admin/reps', {
    method: 'POST',
    headers: adminTokenHeader(),
    body: JSON.stringify(data),
  }),

  updateRep: (id, data) => fetchAPI(`/admin/reps/${id}`, {
    method: 'PUT',
    headers: adminTokenHeader(),
    body: JSON.stringify(data),
  }),

  deleteRep: (id) => fetchAPI(`/admin/reps/${id}`, {
    method: 'DELETE',
    headers: adminTokenHeader(),
  }),

  // 초대코드 발급 (평문은 이 응답 1회만 제공)
  issueInvite: (id) => fetchAPI(`/admin/reps/${id}/invite`, {
    method: 'POST',
    headers: adminTokenHeader(),
  }),
};

// ==================== Rep API (팀 대표) ====================
const repTokenHeader = () => ({
  'X-Rep-Token': localStorage.getItem('repToken') || '',
});

export const repAPI = {
  // 로그인 화면용 활성 대표 목록
  list: () => fetchAPI('/reps'),

  login: (memberId, pin) => fetchAPI('/rep/login', {
    method: 'POST',
    body: JSON.stringify({ memberId, pin }),
  }),

  // 최초 PIN 설정 (초대코드 필요)
  setupPin: (memberId, inviteCode, pin) => fetchAPI('/rep/pin/setup', {
    method: 'POST',
    body: JSON.stringify({ memberId, inviteCode, pin }),
  }),

  changePin: (currentPin, newPin) => fetchAPI('/rep/pin/change', {
    method: 'POST',
    headers: repTokenHeader(),
    body: JSON.stringify({ currentPin, newPin }),
  }),

  me: () => fetchAPI('/rep/me', { headers: repTokenHeader() }),

  // ==================== 대표 투썸 계정 / 개인 세션 ====================

  // 투썸 계정 등록 (서버 AES-256-GCM 암호화 저장)
  registerTwosomeAccount: (twosomeId, twosomePw) => fetchAPI('/rep/twosome/account', {
    method: 'POST',
    headers: repTokenHeader(),
    body: JSON.stringify({ twosomeId, twosomePw }),
  }),

  // 대표 투썸 로그인용 캡차 (수동 입력)
  twosomeCaptcha: () => fetchAPI('/rep/twosome/captcha', {
    method: 'POST',
    headers: repTokenHeader(),
  }),

  // 통합 로그인 폼: 아이디/패스워드 입력 시 서버가 계정으로 저장, 미입력 시 저장된 계정 사용
  twosomeLogin: (contextId, answerCd, loginId, loginPwd) => fetchAPI('/rep/twosome/login', {
    method: 'POST',
    headers: repTokenHeader(),
    body: JSON.stringify({ contextId, answerCd, loginId, loginPwd }),
  }),

  twosomeLogout: () => fetchAPI('/rep/twosome/logout', {
    method: 'POST',
    headers: repTokenHeader(),
  }),

  twosomeSession: () => fetchAPI('/rep/twosome/session', { headers: repTokenHeader() }),

  // ==================== 대표 세션 장바구니 ====================

  repAddToCart: (items) => fetchAPI('/rep/twosome/cart/add', {
    method: 'POST',
    headers: repTokenHeader(),
    body: JSON.stringify({ items }),
  }),

  repGetCart: () => fetchAPI('/rep/twosome/cart', { headers: repTokenHeader() }),

  repRemoveCartItem: (cartNo, cartDtlNo) => fetchAPI(`/rep/twosome/cart/items/${cartNo}?cartDtlNo=${encodeURIComponent(cartDtlNo)}`, {
    method: 'DELETE',
    headers: repTokenHeader(),
  }),

  repAdjustCartItemQty: (cartNo, cartDtlNo, menuCd, qty, opts, cstmInfo) => fetchAPI(`/rep/twosome/cart/items/${cartNo}/qty`, {
    method: 'PUT',
    headers: repTokenHeader(),
    body: JSON.stringify({ cartDtlNo, menuCd, qty, opts, cstmInfo }),
  }),

  repClearCart: () => fetchAPI('/rep/twosome/cart/clear', {
    method: 'POST',
    headers: repTokenHeader(),
  }),
};

// ==================== Suggestion API ====================
export const suggestionAPI = {
  // 목록 조회 (페이징)
  getList: (page = 0) => fetchAPI(`/suggestions?page=${page}`),

  // 상세 조회
  getById: (id) => fetchAPI(`/suggestions/${id}`),

  // 작성
  create: (suggestion) => fetchAPI('/suggestions', {
    method: 'POST',
    body: JSON.stringify(suggestion),
  }),

  // 수정
  update: (id, suggestion) => fetchAPI(`/suggestions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(suggestion),
  }),

  // 삭제
  delete: (id, password) => fetchAPI(`/suggestions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  }),

  // 고정/해제 (관리자)
  togglePin: (id, adminPassword) => fetchAPI(`/suggestions/${id}/pin`, {
    method: 'POST',
    body: JSON.stringify({ adminPassword }),
  }),

  // 댓글 목록 조회
  getComments: (suggestionId) => fetchAPI(`/suggestions/${suggestionId}/comments`),

  // 댓글 작성
  createComment: (suggestionId, comment) => fetchAPI(`/suggestions/${suggestionId}/comments`, {
    method: 'POST',
    body: JSON.stringify(comment),
  }),

  // 댓글 수정
  updateComment: (commentId, comment) => fetchAPI(`/suggestions/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify(comment),
  }),

  // 댓글 삭제
  deleteComment: (commentId, password) => fetchAPI(`/suggestions/comments/${commentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  }),
};

