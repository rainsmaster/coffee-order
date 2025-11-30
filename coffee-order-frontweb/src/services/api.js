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

// ==================== Twosome Menu API ====================
export const twosomeMenuAPI = {
  // 전체 메뉴 조회 (중분류별 그룹화)
  getAll: () => fetchAPI('/twosome-menus'),

  // ID로 조회
  getById: (id) => fetchAPI(`/twosome-menus/${id}`),

  // 메뉴코드로 조회
  getByCode: (menuCd) => fetchAPI(`/twosome-menus/code/${menuCd}`),

  // 중분류명으로 조회
  getByCategory: (midNm) => fetchAPI(`/twosome-menus/category/${midNm}`),

  // 메뉴 옵션 조회 (온도/사이즈)
  getOptions: (menuCd) => fetchAPI(`/twosome-menus/options/${menuCd}`),

  // 전체 동기화 (메뉴 + 이미지 + 옵션)
  sync: async () => {
    const response = await fetch(`${API_BASE_URL}/twosome-menus/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // 409 Conflict (동기화 진행 중) 처리
    if (response.status === 409) {
      const error = new Error(data.message || '동기화가 이미 진행 중입니다.');
      error.code = 'SYNC_IN_PROGRESS';
      throw error;
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  },

  // 동기화 진행 상태 조회
  getSyncStatus: () => fetchAPI('/twosome-menus/sync/status'),

  // 동기화 진행 중인지 확인
  isSyncInProgress: () => fetchAPI('/twosome-menus/sync/in-progress'),
};

// ==================== Personal Option API ====================
export const personalOptionAPI = {
  // 전체 옵션 조회 (카테고리별 그룹화)
  getAll: () => fetchAPI('/personal-options'),

  // 전체 옵션 조회 (리스트)
  getAllList: () => fetchAPI('/personal-options/list'),

  // ID로 조회
  getById: (id) => fetchAPI(`/personal-options/${id}`),

  // 카테고리별 조회
  getByCategory: (category) => fetchAPI(`/personal-options/category/${category}`),

  // 옵션 생성
  create: (option) => fetchAPI('/personal-options', {
    method: 'POST',
    body: JSON.stringify(option),
  }),

  // 옵션 수정
  update: (id, option) => fetchAPI(`/personal-options/${id}`, {
    method: 'PUT',
    body: JSON.stringify(option),
  }),

  // 옵션 삭제
  delete: (id) => fetchAPI(`/personal-options/${id}`, {
    method: 'DELETE',
  }),
};
