// API Base URL 설정
// 프로덕션: 상대 경로 사용 (Spring Boot와 같은 서버)
// 개발: localhost:8080 (프록시 사용)
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 공통 Fetch 함수
const fetchAPI = async (url, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    // 204 No Content는 빈 응답
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// ==================== Team API ====================
export const teamAPI = {
  // 전체 팀원 조회
  getAll: () => fetchAPI('/teams'),

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

// ==================== Menu API ====================
export const menuAPI = {
  // 전체 메뉴 조회 (카테고리별 그룹화)
  getAll: () => fetchAPI('/menus'),

  // 메뉴 생성
  create: (menu) => fetchAPI('/menus', {
    method: 'POST',
    body: JSON.stringify(menu),
  }),

  // 메뉴 수정
  update: (id, menu) => fetchAPI(`/menus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(menu),
  }),

  // 메뉴 삭제
  delete: (id) => fetchAPI(`/menus/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== Order API ====================
export const orderAPI = {
  // 오늘 주문 조회
  getToday: () => fetchAPI('/orders/today'),

  // 특정 날짜 주문 조회
  getByDate: (date) => fetchAPI(`/orders?date=${date}`),

  // 주문 생성
  create: (order) => fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),

  // 주문 수정
  update: (id, order) => fetchAPI(`/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(order),
  }),

  // 주문 삭제
  delete: (id) => fetchAPI(`/orders/${id}`, {
    method: 'DELETE',
  }),

  // 날짜별 메뉴 집계
  getSummary: (date) => fetchAPI(`/orders/summary?date=${date}`),

  // 특정 팀원의 오늘 주문 조회
  getTodayByTeam: (teamId) => fetchAPI(`/orders/team/${teamId}/today`),
};

// ==================== Settings API ====================
export const settingsAPI = {
  // 설정 조회
  get: () => fetchAPI('/settings'),

  // 설정 업데이트
  update: (settings) => fetchAPI('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // 주문 가능 여부 체크
  checkOrderAvailable: () => fetchAPI('/settings/order-available'),
};
