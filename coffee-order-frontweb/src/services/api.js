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

// ==================== Menu API ====================
export const menuAPI = {
  // 전체 메뉴 조회 (부서별 필터링)
  getAll: (departmentId) => fetchAPI(departmentId ? `/menus?departmentId=${departmentId}` : '/menus'),

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

