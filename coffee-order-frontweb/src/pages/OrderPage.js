import React, { useState, useEffect, useRef } from 'react';
import { teamAPI, orderAPI, twosomeMenuAPI, twosomeStoreAPI, repAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import OrderChangeModal from '../components/OrderChangeModal';
import ReorderModal from '../components/ReorderModal';
import RepSelectModal from '../components/RepSelectModal';
import CustomOptionsPanel from '../components/CustomOptionsPanel';
import MenuThumbnail from '../components/MenuThumbnail';
import Modal from '../components/Modal';
import useModal from '../hooks/useModal';
import { isWithinStoreHours } from '../utils/storeHours';
import { needsOptionConfirmation, restoreOptionSelections } from '../utils/reorderOptions';
import './OrderPage.css';
import './OrderLayout.css';

const OrderPage = ({ onAddTeamMember }) => {
  const { selectedDepartmentId } = useDepartment();
  const [teams, setTeams] = useState([]);
  const [twosomeMenus, setTwosomeMenus] = useState({});
  const [orders, setOrders] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTwosomeMenu, setSelectedTwosomeMenu] = useState('');
  // 서버 기반 옵션 그룹 (메뉴 상세 페이지 파싱 결과) + 선택값 + 변형 코드
  const [menuOptions, setMenuOptions] = useState(null); // {menuCd, parsed, groups:[...]}
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedOpts, setSelectedOpts] = useState({}); // {grpCd: opts}
  const [variantInfo, setVariantInfo] = useState(null); // {variantMenuCd, variantMenuNm, price}
  const [customOptions, setCustomOptions] = useState(null); // 퍼스널 옵션 (수량형+선택형)
  const [customOptionsStatus, setCustomOptionsStatus] = useState('idle');
  const [customOptionsRetry, setCustomOptionsRetry] = useState(0);
  const [selectedCustom, setSelectedCustom] = useState({ qty: {}, choices: {} }); // {qty:{key:수량}, choices:{groupKey:choiceKey}}
  const [customOptionsOpen, setCustomOptionsOpen] = useState(false); // 퍼스널 옵션 아코디언 펼침 여부 (기본 접힘)
  const [availableOpts, setAvailableOpts] = useState({}); // 그룹 의존성 {grpCd: [가능 opts...]} (서버 조회 실패 시 빈 맵=전체 렌더)
  const [variantFailed, setVariantFailed] = useState(false); // 변형 조회 실패 (비정상 옵션 조합)
  const [optionsError, setOptionsError] = useState('');
  const orderAvailable = true; // 마감 개념 제거 — 항상 주문 가능
  const [menuSearchQuery, setMenuSearchQuery] = useState(''); // 메뉴 검색어

  // 주문 변경 모달 상태
  const [isOrderChangeModalOpen, setIsOrderChangeModalOpen] = useState(false);
  const [orderChangeData, setOrderChangeData] = useState(null);

  // 재주문 모달 상태
  const [latestOrder, setLatestOrder] = useState(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 주문 통합 결과 모달 상태 (주문 저장 + 장바구니 담기)
  const [combinedResult, setCombinedResult] = useState(null); // {cartOutcome: {...}}
  const [isCombinedResultOpen, setIsCombinedResultOpen] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false); // 주문~장바구니 통합 처리 중

  const [, setRepInfo] = useState(null);
  const [isStoreOpen, setIsStoreOpen] = useState(false); // 폐점 게이팅용 개점 여부 (조회 실패 시 false=폐점 취급)
  const [repModalMode, setRepModalMode] = useState(null); // 'login' | 'setup' | 'change' | null
  const [repList, setRepList] = useState([]); // GET /api/reps
  const [repSelectOpen, setRepSelectOpen] = useState(false);
  const [selectedTargetRepId, setSelectedTargetRepId] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [pendingCartOrder, setPendingCartOrder] = useState(null);
  const [repForm, setRepForm] = useState({ memberId: '', teamMemberId: '', pin: '', newPin: '', newPinConfirm: '', currentPin: '' });
  const [repLoading, setRepLoading] = useState(false);
  const [, setRepTwosomeStatus] = useState('NONE');
  const [repMe, setRepMe] = useState(null); // GET /api/rep/me (twosomeAccount 등)
  const [repTwosomeModal, setRepTwosomeModal] = useState(null); // 'login' | null
  const [repCaptcha, setRepCaptcha] = useState(null); // {contextId, imageBase64}
  const [repCaptchaAnswer, setRepCaptchaAnswer] = useState('');
  // 통합 로그인 폼: 아이디(등록 계정 있으면 프리필, 수정 가능) + 패스워드(매번 입력) + 캡차
  const [repTwosomeForm, setRepTwosomeForm] = useState({ loginId: '', loginPwd: '' });


  // 주문 폼 ref (수정 모드 시 스크롤용)
  const orderFormRef = useRef(null);

  // 커스텀 모달 훅
  const {
    isAlertOpen,
    alertConfig,
    showAlert,
    closeAlert,
    isConfirmOpen,
    confirmConfig,
    closeConfirm,
  } = useModal();

  // 데이터 로드 (부서 변경 시 재로드)
  useEffect(() => {
    if (selectedDepartmentId) {
      loadData();
      loadRepList();
      resetOrderForm();
    }

    // 5초마다 주문 목록 자동 새로고침 (폴링)
    const interval = setInterval(() => {
      if (selectedDepartmentId) {
        loadOrders();
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, twosomeMenusData, ordersData] = await Promise.all([
        teamAPI.getAll(selectedDepartmentId),
        twosomeMenuAPI.getAll(),
        orderAPI.getToday(selectedDepartmentId),
      ]);
      setTeams(teamsData);
      setTwosomeMenus(twosomeMenusData);
      setOrders(ordersData);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const ordersData = await orderAPI.getToday(selectedDepartmentId);
      setOrders(ordersData);
    } catch (err) {
      console.error('주문 목록 새로고침 실패:', err);
    }
  };

  const loadRepList = async () => {
    try {
      const list = await repAPI.list(selectedDepartmentId) || [];
      setRepList(list);
      setSelectedTargetRepId((current) => {
        const selected = list.find((rep) => rep.id === current && rep.twosomeStatus === 'ACTIVE');
        return selected?.id || list.find((rep) => rep.twosomeStatus === 'ACTIVE')?.id || null;
      });
      return list;
    } catch (err) {
      setRepList([]);
      setSelectedTargetRepId(null);
      console.error('대표 목록 조회 실패:', err);
      return [];
    }
  };

  // 팀원 선택 시 최근 주문 조회
  const handleTeamSelect = async (teamId) => {
    setSelectedTeam(teamId);
    setLatestOrder(null);

    if (teamId) {
      try {
        const latest = await orderAPI.getLatestByTeam(teamId);
        // 오늘 주문이 아닌 경우에만 표시 (오늘 주문이면 이미 주문한 것)
        const today = new Date().toLocaleDateString('sv-SE');
        if (latest && latest.orderDate !== today) {
          setLatestOrder(latest);
        }
      } catch (err) {
        // 404 등 에러는 무시 (최근 주문이 없는 경우)
        console.log('최근 주문 없음');
      }
    }
  };

  const prepareReorderOptions = async (order) => {
    setIsReorderModalOpen(false);
    const entry = Object.entries(twosomeMenus).find(([, menus]) =>
      menus.some((menu) => menu.id === order.twosomeMenuId));
    if (!entry) {
      showAlert('현재 판매 메뉴에서 이전 메뉴를 찾을 수 없습니다. 메뉴를 직접 선택해주세요.');
      return;
    }
    const [category, menus] = entry;
    const menu = menus.find((item) => item.id === order.twosomeMenuId);
    if (menu.salesPsblQty === 0) {
      showAlert('이전 메뉴는 현재 품절입니다. 다른 메뉴를 선택해주세요.');
      return;
    }

    setIsCartLoading(true);
    setSelectedCategory(category);
    setMenuSearchQuery('');
    try {
      const options = await handleTwosomeMenuSelect(
        menu.id.toString(), menu.menuCd, order.personalOption);
      if (!options?.parsed) {
        showAlert('이전 주문의 옵션을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setLatestOrder(null);
      showAlert('이전 주문에 저장되지 않은 옵션이 있어 현재 메뉴의 옵션을 불러왔습니다. 선택 옵션과 퍼스널 옵션을 확인한 후 주문 버튼을 눌러주세요.');
      orderFormRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleReorderConfirm = async () => {
    if (!latestOrder || !selectedTeam) return;
    if (needsOptionConfirmation(latestOrder)) {
      await prepareReorderOptions(latestOrder);
      return;
    }
    const orderData = {
      departmentId: selectedDepartmentId,
      teamId: parseInt(selectedTeam, 10),
      twosomeMenuId: latestOrder.twosomeMenuId,
      personalOption: latestOrder.personalOption || null,
      orderDate: new Date().toLocaleDateString('sv-SE'),
      variantMenuCd: latestOrder.variantMenuCd || null,
      variantOpts: latestOrder.variantOpts || null,
      cstmInfo: latestOrder.cstmInfo || null,
    };
    const existingOrders = orders.filter((order) => order.teamId === orderData.teamId);
    setIsReorderModalOpen(false);
    setLatestOrder(null);
    if (existingOrders.length > 0) {
      setOrderChangeData({
        teamName: getSelectedTeamName(),
        existingOrders,
        selectedExistingId: existingOrders[0].id,
        new: { menuName: latestOrder.menuName, option: latestOrder.personalOption },
        newOrderData: orderData,
      });
      setIsOrderChangeModalOpen(true);
      return;
    }
    resetOrderForm();
    await createOrderAndMaybeCart(orderData);
  };

  // 재주문 버튼 클릭 시 모달 열기
  const handleReorderClick = () => {
    setIsReorderModalOpen(true);
  };

  // 현재 선택된 메뉴 이름 가져오기 (투썸 메뉴 기준)
  const getSelectedMenuName = () => {
    if (selectedTwosomeMenu) {
      for (const category of Object.values(twosomeMenus)) {
        const menu = category.find(m => m.id.toString() === selectedTwosomeMenu);
        if (menu) return menu.menuNm;
      }
    }
    return '';
  };

  // 현재 선택된 팀원 이름 가져오기
  const getSelectedTeamName = () => {
    const team = teams.find(t => t.id.toString() === selectedTeam);
    return team ? team.name : '';
  };

  // 주문하기 (투썸 메뉴 고정)
  const handleOrder = async () => {
    if (!selectedTeam || !selectedTwosomeMenu) {
      showAlert('이름과 메뉴를 선택해주세요.');
      return;
    }

    if (optionsLoading) {
      showAlert('옵션 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (menuOptions && menuOptions.parsed) {
      const missingGroup = (menuOptions.groups || []).find(
        (group) => group.required && !selectedOpts[group.grpCd]
      );
      if (missingGroup) {
        showAlert(`'${missingGroup.grpNm}' 옵션을 선택해주세요.`);
        return;
      }
      const hasGroups = (menuOptions.groups || []).length > 0;
      if (hasGroups && !isAllGroupsSelected()) {
        showAlert('모든 옵션을 선택해주세요.');
        return;
      }
      if (hasGroups && (!variantInfo || variantFailed)) {
        showAlert('선택한 옵션 조합은 판매되지 않습니다. 옵션을 다시 선택해주세요.');
        return;
      }
    }

    const finalOption = [getTwosomeOptionString(), getCustomOptionString()].filter(Boolean).join(' | ');

    const existingOrders = orders.filter((order) => order.teamId === parseInt(selectedTeam, 10));
    if (existingOrders.length > 0) {
      setOrderChangeData({
        existingOrders,
        selectedExistingId: existingOrders[0].id,
        teamName: getSelectedTeamName(),
        new: {
          menuName: getSelectedMenuName(),
          option: finalOption || null
        },
        newOrderData: {
          twosomeMenuId: parseInt(selectedTwosomeMenu),
          personalOption: finalOption || null,
          variantMenuCd: variantInfo?.variantMenuCd ?? null,
          variantOpts: getSelectedOptsList().join(',') || null,
          cstmInfo: variantInfo?.variantMenuCd
            ? (JSON.stringify(buildCartCstmInfo(variantInfo.variantMenuCd)) || null)
            : null,
        }
      });
      setIsOrderChangeModalOpen(true);
      return;
    }

    await createOrderAndMaybeCart({
      departmentId: selectedDepartmentId,
      teamId: parseInt(selectedTeam),
      twosomeMenuId: parseInt(selectedTwosomeMenu),
      personalOption: finalOption || null,
      orderDate: new Date().toLocaleDateString('sv-SE'),
      variantMenuCd: variantInfo?.variantMenuCd ?? null,
      variantOpts: getSelectedOptsList().join(',') || null,
      cstmInfo: variantInfo?.variantMenuCd
        ? (JSON.stringify(buildCartCstmInfo(variantInfo.variantMenuCd)) || null)
        : null,
    });
  };

  const createOrderAndMaybeCart = async (newOrderData) => {
    setIsCartLoading(true);
    try {
      const createdOrder = await orderAPI.create(newOrderData);
      await prepareCartOutcome(createdOrder);
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '주문 실패했습니다.');
    } finally {
      setIsCartLoading(false);
    }
  };

  const prepareCartOutcome = async (createdOrder) => {
    const storeOpen = await loadStoreOpen();
    if (!storeOpen) {
      setCombinedResult({ cartOutcome: { type: 'store-closed' } });
      setIsCombinedResultOpen(true);
      return;
    }

    const latestReps = await loadRepList();
    if (latestReps.length === 0) {
      setPendingCartOrder(createdOrder);
      resetRepForm('', createdOrder.teamId);
      setRepModalMode('setup');
      return;
    }

    if (latestReps.length === 1) {
      const rep = latestReps[0];
      if (rep.twosomeStatus !== 'ACTIVE') {
        setPendingCartOrder(createdOrder);
        setCombinedResult({ cartOutcome: { type: 'rep-login-required', owner: rep.name, repId: rep.id } });
        setIsCombinedResultOpen(true);
        return;
      }
      await executeCartForRep(rep, createdOrder);
      return;
    }

    const activeRep = latestReps.find((rep) => rep.twosomeStatus === 'ACTIVE');
    if (!activeRep) {
      setPendingCartOrder(createdOrder);
      setCombinedResult({ cartOutcome: { type: 'rep-login-required', owner: latestReps[0].name, repId: latestReps[0].id } });
      setIsCombinedResultOpen(true);
      return;
    }
    setPendingOrder(createdOrder);
    setRepSelectOpen(true);
  };

  const executeCartForRep = async (rep, createdOrder) => {
    if (!createdOrder) return;
    setIsCartLoading(true);
    try {
      const outcome = await addOrdersToCart(rep.id, [createdOrder]);
      if (outcome.type === 'cart' && outcome.result?.success > 0) {
        try {
          await orderAPI.markCartReflected([createdOrder.id], rep.id);
        } catch (markErr) {
          console.error('장바구니 반영 마킹 실패 (무시):', markErr);
        }
      }
      setCombinedResult({ cartOutcome: { ...outcome, owner: rep.name } });
    } catch (err) {
      const expired = err.message === 'TWOSOME_SESSION_EXPIRED' || err.message === 'TARGET_REP_SESSION_REQUIRED';
      if (expired) setPendingCartOrder(createdOrder);
      setCombinedResult({
        cartOutcome: {
          type: expired ? 'rep-login-required' : 'cart-failed',
          owner: rep.name,
          repId: rep.id,
          message: expired
            ? '대표 투썸 세션이 만료되었습니다. 다시 로그인하면 방금 주문을 담을 수 있습니다.'
            : (err.message || '장바구니 담기 중 오류가 발생했습니다.'),
        },
      });
    } finally {
      setIsCartLoading(false);
      setIsCombinedResultOpen(true);
    }
  };

  const handleTargetRepConfirm = async (rep) => {
    const order = pendingOrder;
    setRepSelectOpen(false);
    setPendingOrder(null);
    await executeCartForRep(rep, order);
  };

  const handleTargetRepCancel = () => {
    setRepSelectOpen(false);
    setPendingOrder(null);
    setCombinedResult({ cartOutcome: { type: 'local-only' } });
    setIsCombinedResultOpen(true);
  };

  const handleOrderAddConfirm = async () => {
    setIsOrderChangeModalOpen(false);
    await createOrderAndMaybeCart({
      ...orderChangeData.newOrderData,
      departmentId: selectedDepartmentId,
      teamId: parseInt(selectedTeam, 10),
      orderDate: new Date().toLocaleDateString('sv-SE'),
    });
  };

  const handleOrderChangeConfirm = async (existingOrder) => {
    if (!orderChangeData || !existingOrder) return;
    setIsCartLoading(true);
    setIsOrderChangeModalOpen(false);
    try {
      const { newOrderData } = orderChangeData;
      await orderAPI.update(existingOrder.id, {
        team: { id: existingOrder.teamId },
        menuType: 'TWOSOME',
        twosomeMenu: { id: newOrderData.twosomeMenuId },
        personalOption: newOrderData.personalOption,
        orderDate: existingOrder.orderDate,
        variantMenuCd: newOrderData.variantMenuCd,
        variantOpts: newOrderData.variantOpts,
        cstmInfo: newOrderData.cstmInfo,
      }, selectedDepartmentId);
      const freshOrders = await orderAPI.getToday(selectedDepartmentId);
      setOrders(freshOrders);
      resetOrderForm();
      await prepareCartOutcome(freshOrders.find((order) => order.id === existingOrder.id));
    } catch (err) {
      showAlert(err.message || '주문 변경에 실패했습니다.');
    } finally {
      setIsCartLoading(false);
    }
  };

  // 주문 폼 초기화
  const resetOrderForm = () => {
    setSelectedTeam('');
    setSelectedCategory('');
    setSelectedTwosomeMenu('');
    setMenuOptions(null);
    setSelectedOpts({});
    setVariantInfo(null);
    setVariantFailed(false);
    setCustomOptions(null);
    setSelectedCustom({ qty: {}, choices: {} });
    setCustomOptionsOpen(false);
    setAvailableOpts({});
    setOptionsError('');
  };

  // 카테고리 선택 시 메뉴 초기화
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedTwosomeMenu('');
    setMenuOptions(null);
    setSelectedOpts({});
    setVariantInfo(null);
    setOptionsError('');
    setMenuSearchQuery(''); // 검색어 초기화
  };

  // 메뉴 검색 처리
  const handleMenuSearch = (query) => {
    setMenuSearchQuery(query);
    if (query.trim()) {
      setSelectedCategory(''); // 검색 시 카테고리 선택 해제
    }
  };

  // 검색된 메뉴 목록 (투썸 모드 전용)
  const getSearchedMenus = () => {
    if (!menuSearchQuery.trim()) return [];
    const query = menuSearchQuery.toLowerCase().trim();
    const results = [];

    Object.entries(twosomeMenus).forEach(([category, menuList]) => {
      menuList.forEach((menu) => {
        if (menu.menuNm.toLowerCase().includes(query)) {
          results.push({ ...menu, category });
        }
      });
    });

    return results;
  };

  // 현재 선택된 카테고리의 메뉴 목록 (투썸 메뉴 기준)
  const getCurrentMenus = () => {
    if (!selectedCategory) return [];
    return twosomeMenus[selectedCategory] || [];
  };

  // 카테고리 목록 (투썸 메뉴만 사용) - 순서 정렬
  const getCategories = () => {
    const categoryOrder = [
      '커피',
      '음료',
      '티/티라떼',
      '아이스크림/빙수',
      '베이커리',
      '샌드위치',
      '샐러드/기타',
      '홀케이크',
      '피스케이크',
      '마카롱',
      '스낵',
      '카페용품',
      '원두/티 상품'
    ];

    const categories = Object.keys(twosomeMenus);
    return categories.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      // 둘 다 목록에 없으면 원래 순서 유지
      if (indexA === -1 && indexB === -1) return 0;
      // 목록에 없는 카테고리는 맨 뒤로
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  // 투썸 메뉴 카드 클릭 — 품절(판매가능수량 0)이면 안내 후 차단
  const handleTwosomeMenuCardClick = (menu) => {
    if (menu.salesPsblQty === 0) {
      showAlert('해당 메뉴는 품절입니다. 다른 메뉴를 선택해주세요.');
      return;
    }
    handleTwosomeMenuSelect(menu.id.toString(), menu.menuCd);
  };

  // 투썸 메뉴 선택 시 서버 기반 옵션 그룹 로드 (기본값 미리 선택)
  const handleTwosomeMenuSelect = async (menuId, menuCd, savedOptionText = '') => {
    setSelectedTwosomeMenu(menuId);
    setMenuOptions(null);
    setOptionsLoading(true);
    setSelectedOpts({});
    setVariantInfo(null);
    setVariantFailed(false);
    setCustomOptions(null);
    setSelectedCustom({ qty: {}, choices: {} });
    setCustomOptionsOpen(false);
    setAvailableOpts({});
    setOptionsError('');

    if (!menuCd) {
      setOptionsLoading(false);
      return null;
    }
    try {
      const options = await twosomeStoreAPI.getMenuOptions(menuCd);
      if (!options) return null;
      if (!options.parsed) {
        setMenuOptions(options);
        setOptionsError(options.message || '옵션 정보를 파싱하지 못했습니다.');
        return options;
      }
      setMenuOptions(options);
      setSelectedOpts(restoreOptionSelections(options, savedOptionText));
      return options;
    } catch (err) {
      setOptionsError('옵션을 불러오지 못했습니다. 옵션 확인 전에는 실제 장바구니에 담지 않습니다.');
      return null;
    } finally {
      setOptionsLoading(false);
    }
  };

  // 그룹 내 선택된 옵션 객체
  const getSelectedOption = (group) => {
    const opts = selectedOpts[group.grpCd];
    return (group.options || []).find((o) => o.opts === opts) || null;
  };

  // 모든 그룹 선택 완료 여부
  const isAllGroupsSelected = () => {
    if (!menuOptions || !menuOptions.groups || menuOptions.groups.length === 0) return false;
    return menuOptions.groups.every((group) => selectedOpts[group.grpCd]);
  };

  // 그룹 순서대로 선택된 opts 배열
  const getSelectedOptsList = () =>
    (menuOptions?.groups || [])
      .map((group) => selectedOpts[group.grpCd])
      .filter(Boolean);

  // 선택 옵션 표시 문자열 ("핫 | 라지 | ..." 형태)
  const getTwosomeOptionString = () => {
    if (!menuOptions || !menuOptions.groups) return '';
    return menuOptions.groups
      .map((group) => getSelectedOption(group)?.optNm)
      .filter(Boolean)
      .join(' | ');
  };

  // 그룹 의존성: 선택 변경 시 미선택 그룹의 가능 선택지를 서버에서 조회 (예: 핫이면 맥스 미제공)
  useEffect(() => {
    if (!menuOptions || !menuOptions.parsed || !menuOptions.groups || menuOptions.groups.length === 0) {
      setAvailableOpts({});
      return undefined;
    }
    const selectedList = [];
    const selectedGrps = [];
    let firstUnselected = menuOptions.groups.length;
    menuOptions.groups.forEach((group, idx) => {
      const opt = selectedOpts[group.grpCd];
      if (opt) {
        selectedList.push(opt);
        selectedGrps.push(group.grpCd);
      } else if (firstUnselected === menuOptions.groups.length) {
        firstUnselected = idx;
      }
    });
    // 모두 선택 완료면 변형 조회가 최종 검증 — 의존성 조회 불필요
    if (firstUnselected === menuOptions.groups.length) {
      setAvailableOpts({});
      return undefined;
    }
    let cancelled = false;
    const fetchAvailable = async () => {
      try {
        const result = await twosomeStoreAPI.getAvailableOptions(
          menuOptions.menuCd, selectedList, selectedGrps);
        if (cancelled) return;
        const map = {};
        for (const item of result || []) {
          (map[item.OPT_GRP_CD] = map[item.OPT_GRP_CD] || []).push(item.OPTS);
        }
        setAvailableOpts(map);
        // 미선택 그룹 중 서버가 불가능하다고 알려준 선택이 남아있으면
        // 기본값(가능한 것) → 가능한 첫 옵션 → 빈 값 순으로 교정 (연쇄는 effect 재실행으로 처리)
        const cleaned = { ...selectedOpts };
        let dirty = false;
        menuOptions.groups.slice(firstUnselected).forEach((group) => {
          const sel = cleaned[group.grpCd];
          if (sel && map[group.grpCd] && !map[group.grpCd].includes(sel)) {
            cleaned[group.grpCd] = resolveAutoSelectOpt(group, cleaned, map[group.grpCd]);
            dirty = true;
          }
        });
        if (dirty) setSelectedOpts(cleaned);
      } catch (err) {
        if (!cancelled) setAvailableOpts({}); // 실패 시 전체 렌더 + KNOWN invalid 방어로 폴리백
      }
    };
    fetchAvailable();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpts, menuOptions]);

  // KNOWN invalid 판정 (실측 확인): 핫 음료(010H) + 맥스 사이즈(020M)는 서버 미판매
  // (menuOptListAjax 응답에 020M 없음, resolve-variant도 변형코드 미반환)
  const isKnownInvalidOpt = (grpCd, opt, optsMap) =>
    grpCd === '020' && opt === '020M' && optsMap && optsMap['010'] === '010H';

  // 그룹의 자동 선택값: 기본값(defaultOpt) 중 KNOWN invalid가 아닌 것.
  // 기본값이 없는 그룹(컵 선택 등)은 자동 선택하지 않음(기존 예외 규칙 존중).
  // 기본값이 불가능하면(서버 목록 기준) 가능한 다음 옵션, 둘 다 없으면 빈 값.
  const resolveAutoSelectOpt = (group, optsMap, availList) => {
    const options = group.options || [];
    const hasDefault = options.some((o) => o.defaultOpt);
    if (!hasDefault) return undefined;
    const candidates = availList ? options.filter((o) => availList.includes(o.opts)) : options;
    const def = candidates.find((o) => o.defaultOpt && !isKnownInvalidOpt(group.grpCd, o.opts, optsMap));
    if (def) return def.opts;
    const first = candidates.find((o) => !isKnownInvalidOpt(group.grpCd, o.opts, optsMap));
    return first ? first.opts : undefined;
  };

  // 그룹별 렌더 가능 선택지 — 서버 의존성 목록 적용, 실패 시 KNOWN invalid만 차단
  const getVisibleOptions = (group) => {
    let options = group.options || [];
    const avail = availableOpts[group.grpCd];
    if (avail) {
      options = options.filter((o) => avail.includes(o.opts));
    }
    return options.filter((o) => !isKnownInvalidOpt(group.grpCd, o.opts, selectedOpts));
  };

  // 모든 그룹 선택 완료 시 변형 코드 조회 → 예상 가격, 이어서 퍼스널 옵션 조회
  useEffect(() => {
    if (!menuOptions || !menuOptions.parsed || !isAllGroupsSelected()) {
      setVariantInfo(null);
      setVariantFailed(false);
      setCustomOptions(null);
      setCustomOptionsStatus('idle');
      setSelectedCustom({ qty: {}, choices: {} });
      setCustomOptionsOpen(false);
      return undefined;
    }
    let cancelled = false;
    setCustomOptions(null);
    setCustomOptionsStatus('loading');
    const fetchVariant = async () => {
      try {
        const result = await twosomeStoreAPI.resolveVariant(menuOptions.menuCd, getSelectedOptsList());
        if (cancelled) return;
        // 방어: 변형 코드 없거나 가격이 비정상(0 이하)이면 비정상 조합으로 간주해 차단
        if (!result || !result.variantMenuCd || result.price == null || result.price <= 0) {
          setVariantInfo(null);
          setVariantFailed(true);
          setCustomOptions(null);
          setCustomOptionsStatus('idle');
          return;
        }
        setVariantFailed(false);
        setVariantInfo(result);
        // 변형 확정 → 퍼스널 옵션 재조회 및 선택/펼침 초기화 (온도 변경 등으로 변형이 바뀌면 리셋)
        setSelectedCustom({ qty: {}, choices: {} });
        setCustomOptionsOpen(false);
        setCustomOptions(null);
        if (result?.variantMenuCd) {
          try {
            const custom = await twosomeStoreAPI.getMenuCustomOptions(result.variantMenuCd);
            if (cancelled) return;
            setCustomOptions(custom || null);
            setCustomOptionsStatus(custom?.hasCustom ? 'success' : 'empty');
          } catch (err) {
            if (cancelled) return;
            setCustomOptions(null);
            setCustomOptionsStatus('error');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setVariantInfo(null);
          setVariantFailed(true);
          setCustomOptions(null);
          setCustomOptionsStatus('idle');
          setCustomOptionsOpen(false);
        }
      }
    };
    fetchVariant();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpts, menuOptions, customOptionsRetry]);

  // 선택한 퍼스널 옵션을 cartCstmInfo 배열로 변환 (투썸 원문 필드명)
  const buildCartCstmInfo = (variantMenuCd) => {
    const result = [];
    let num = 0;
    if (!customOptions) return result;
    for (const item of customOptions.qtyItems || []) {
      const qty = selectedCustom.qty[item.key] || 0;
      if (qty > 0) {
        result.push({
          CSTM_NUM: num++,
          MENU_CD: variantMenuCd,
          SET_MENU_YN: 'N',
          CSTM_GRP_CD: item.grpCd || '',
          TYPE_ADD_CD: item.typeAddCd || '',
          CSTM_ADD_CD: item.cstmAddCd || '',
          TYPE_CHG_CD: item.typeChgCd || '',
          CSTM_CHG_CD: item.cstmChgCd || '',
          CSTM_ORD_CNT: qty,
          CSTM_ORD_AMT: item.unitPrice || 0,
          CSTM_DEPOSIT: item.deposit || 0,
        });
      }
    }
    for (const group of customOptions.choiceGroups || []) {
      const choiceKey = selectedCustom.choices[group.groupKey];
      if (!choiceKey) continue;
      const choice = (group.choices || []).find((c) => c.choiceKey === choiceKey);
      if (!choice) continue;
      result.push({
        CSTM_NUM: num++,
        MENU_CD: variantMenuCd,
        SET_MENU_YN: 'N',
        CSTM_GRP_CD: choice.grpCd || '',
        TYPE_ADD_CD: choice.typeAddCd || '',
        CSTM_ADD_CD: choice.cstmAddCd || '',
        TYPE_CHG_CD: choice.typeChgCd || '',
        CSTM_CHG_CD: choice.cstmChgCd || '',
        // 투썸 규칙: 조정(chgYn=Y)이면 0, 추가면 1
        CSTM_ORD_CNT: choice.chgYn === 'Y' ? 0 : 1,
        CSTM_ORD_AMT: choice.price || 0,
        CSTM_DEPOSIT: choice.deposit || 0,
      });
    }
    return result;
  };

  // 퍼스널 옵션 추가 금액 합계
  const getCustomTotalPrice = () => {
    if (!customOptions) return 0;
    let total = 0;
    for (const item of customOptions.qtyItems || []) {
      total += (item.unitPrice || 0) * (selectedCustom.qty[item.key] || 0);
    }
    for (const group of customOptions.choiceGroups || []) {
      const choiceKey = selectedCustom.choices[group.groupKey];
      const choice = choiceKey && (group.choices || []).find((c) => c.choiceKey === choiceKey);
      if (choice) total += choice.price || 0;
    }
    return total;
  };

  // 퍼스널 옵션 헤더 요약 ('첫 선택 외 N건', 1건이면 '외 N건' 생략)
  const getCustomSummaryText = () => {
    const str = getCustomOptionString();
    if (!str) return null;
    const parts = str.split(', ');
    return parts.length > 1 ? `${parts[0]} 외 ${parts.length - 1}건` : parts[0];
  };

  // 퍼스널 옵션 선택 표시 문자열 (개인 주문 옵션 텍스트에 합산)
  const getCustomOptionString = () => {
    if (!customOptions) return '';
    const parts = [];
    for (const item of customOptions.qtyItems || []) {
      const qty = selectedCustom.qty[item.key] || 0;
      if (qty > 0) parts.push(`${item.name} +${qty}`);
    }
    for (const group of customOptions.choiceGroups || []) {
      const choiceKey = selectedCustom.choices[group.groupKey];
      const choice = choiceKey && (group.choices || []).find((c) => c.choiceKey === choiceKey);
      if (choice) parts.push(`${group.name} ${choice.label}`);
    }
    return parts.join(', ');
  };

  // 메뉴 코드로 중분류 코드 조회 (장바구니 담기용)
  const findMidCdByMenuCd = (menuCd) => {
    for (const menuList of Object.values(twosomeMenus)) {
      const menu = menuList.find(m => m.menuCd === menuCd);
      if (menu) return menu.midCd;
    }
    return null;
  };

  const addOrdersToCart = async (targetRepMemberId, targetOrders) => {
    const items = targetOrders
      .filter((order) => order.menuType === 'TWOSOME' && order.twosomeMenuCode)
      .map((order) => ({
        menuCd: order.twosomeMenuCode,
        upMenuCd: order.twosomeMenuCode,
        midCd: findMidCdByMenuCd(order.twosomeMenuCode),
        qty: 1,
        opts: order.variantOpts ? order.variantOpts.split(',').map((option) => option.trim()).filter(Boolean) : null,
        variantMenuCd: order.variantMenuCd || null,
        cstmInfo: order.cstmInfo ? JSON.parse(order.cstmInfo) : null,
      }));
    if (items.length === 0) return { type: 'no-items' };
    const result = await repAPI.repAddToCart(targetRepMemberId, items);
    return { type: 'cart', result };
  };

  // ==================== 팀 대표 로그인 (1단계) ====================

  // 페이지 로드 시 저장된 rep 토큰이 있으면 내 정보 + 투썸 세션 상태 복원
  useEffect(() => {
    const restoreRepSession = async () => {
      if (!localStorage.getItem('repToken')) return;
      try {
        const me = await repAPI.me();
        setRepMe(me);
        setRepInfo({ id: me.id, name: me.name, teamName: me.teamName });
        if (me.twosomeAccount) {
          refreshRepTwosomeSession();
        }
      } catch (err) {
        localStorage.removeItem('repToken');
      }
    };
    restoreRepSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectOrderCartMode = async () => {
    if (localStorage.getItem('repToken')) {
      try {
        const repSession = await repAPI.twosomeSession();
        if (repSession.status === 'ACTIVE') {
          const me = await repAPI.me();
          setRepMe(me);
          setRepInfo({ id: me.id, name: me.name, teamName: me.teamName });
          setRepTwosomeStatus('ACTIVE');
          return 'rep';
        }
      } catch (err) {
        // 대표 세션이 없으면 로컬 주문만 진행한다.
      }
    }
    setRepTwosomeStatus('NONE');
    return null;
  };

  // 매장 정보는 대표 로그인 여부와 무관하게 조회하며, 실패 시 외부 담기를 차단한다.
  const loadStoreOpen = async () => {
    try {
      const info = await twosomeStoreAPI.getStoreInfo();
      const open = isWithinOrdTime(info);
      setIsStoreOpen(open);
      return open;
    } catch (err) {
      setIsStoreOpen(false);
      return false;
    }
  };

  const isWithinOrdTime = (info) => isWithinStoreHours(info);

  // 페이지 로드 시 로그인 모드 + 개점 여부 조회
  useEffect(() => {
    const initOrderModeAndStore = async () => {
      const mode = await detectOrderCartMode();
      await loadStoreOpen(mode);
    };
    initOrderModeAndStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 대표 투썸 세션 상태 새로고침
  const refreshRepTwosomeSession = async () => {
    try {
      const session = await repAPI.twosomeSession();
      setRepTwosomeStatus(session?.status || 'NONE');
    } catch (err) {
      setRepTwosomeStatus('NONE');
    }
  };

  // ==================== 대표 투썸 계정 / 로그인 ====================

  const requestRepCaptcha = async () => {
    try {
      const data = await repAPI.twosomeCaptcha();
      setRepCaptcha(data);
      setRepCaptchaAnswer('');
    } catch (err) {
      showAlert('캡차를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const openRepTwosomeLoginModal = (account = null) => {
    setRepTwosomeForm({ loginId: account?.twosomeId || repMe?.twosomeId || '', loginPwd: '' });
    setRepTwosomeModal('login');
    requestRepCaptcha();
  };

  const resumePendingCart = async (rep) => {
    if (!pendingCartOrder || !rep) return;
    const order = pendingCartOrder;
    setPendingCartOrder(null);
    setPendingOrder(null);
    setCombinedResult(null);
    setIsCombinedResultOpen(false);
    await executeCartForRep({ ...rep, twosomeStatus: 'ACTIVE' }, order);
  };

  const handleCombinedLogin = async () => {
    setIsCombinedResultOpen(false);
    if (repList.length === 0) {
      resetRepForm();
      setRepModalMode('setup');
      return;
    }
    await openRepLoginModal(combinedResult?.cartOutcome?.repId);
  };

  const completeRepLogin = async (result) => {
    localStorage.setItem('repToken', result.token);
    const me = await repAPI.me();
    setRepMe(me);
    setRepInfo({ id: me.id, name: me.name, teamName: me.teamName });
    closeRepModal();
    const session = await repAPI.twosomeSession();
    setRepTwosomeStatus(session.status || 'NONE');
    await loadRepList();
    if (session.status === 'ACTIVE') {
      await detectOrderCartMode();
      await resumePendingCart({ id: me.id, name: me.name });
    } else {
      openRepTwosomeLoginModal(me);
    }
  };

  // 통합 로그인 폼 제출: 아이디/패스워드+캡차 → 서버가 로그인 후 계정 저장
  const handleRepTwosomeLogin = async () => {
    if (!repTwosomeForm.loginId.trim() || !repTwosomeForm.loginPwd) {
      showAlert('투썸 아이디와 패스워드를 입력해주세요.');
      return;
    }
    if (!repCaptcha || !repCaptchaAnswer) {
      showAlert('캡차 숫자를 입력해주세요.');
      return;
    }
    setRepLoading(true);
    try {
      const result = await repAPI.twosomeLogin(
        repCaptcha.contextId, repCaptchaAnswer,
        repTwosomeForm.loginId.trim(), repTwosomeForm.loginPwd);
      if (result.status === 'SUCCESS') {
        setRepTwosomeStatus('ACTIVE');
        setRepTwosomeModal(null);
        setRepCaptcha(null);
        const me = await repAPI.me();
        setRepMe(me);
        setRepInfo({ id: me.id, name: me.name, teamName: me.teamName });
        await detectOrderCartMode();
        await loadStoreOpen();
        await loadRepList();
        await resumePendingCart({ id: me.id, name: me.name });
        if (!pendingCartOrder) showAlert('투썸 로그인되었습니다.');
      } else {
        showAlert(result.message || '투썸 로그인에 실패했습니다.');
        requestRepCaptcha();
        setRepCaptchaAnswer('');
      }
    } catch (err) {
      showAlert(err.message || '투썸 로그인에 실패했습니다.');
      requestRepCaptcha();
      setRepCaptchaAnswer('');
    } finally {
      setRepLoading(false);
    }
  };

  const resetRepForm = (memberId = '', teamMemberId = '') => {
    setRepForm({ memberId: memberId ? String(memberId) : '', teamMemberId: teamMemberId ? String(teamMemberId) : '', pin: '', newPin: '', newPinConfirm: '', currentPin: '' });
  };

  const openRepLoginModal = async (preferredMemberId = null) => {
    setRepModalMode('login');
    const list = await loadRepList();
    resetRepForm(preferredMemberId || list[0]?.id);
  };

  const closeRepModal = () => {
    setRepModalMode(null);
    resetRepForm();
  };

  const handleRepLogin = async () => {
    if (!repForm.memberId || !repForm.pin) {
      showAlert('대표와 PIN을 입력해주세요.');
      return;
    }
    setRepLoading(true);
    try {
      const result = await repAPI.login(parseInt(repForm.memberId, 10), repForm.pin);
      await completeRepLogin(result);
    } catch (err) {
      if (err.message === 'PIN_NOT_SET') {
        showAlert('대표 등록에서 본인 팀원을 선택하고 PIN을 생성해주세요.');
        resetRepForm();
        setRepModalMode('setup');
      } else {
        showAlert(err.message || '로그인에 실패했습니다.');
      }
    } finally {
      setRepLoading(false);
    }
  };

  const handleRepPinSetup = async () => {
    if (!repForm.teamMemberId) {
      showAlert('본인 팀원을 선택해주세요.');
      return;
    }
    if (!/^\d{6}$/.test(repForm.newPin)) {
      showAlert('PIN은 숫자 6자리여야 합니다.');
      return;
    }
    if (repForm.newPin !== repForm.newPinConfirm) {
      showAlert('새 PIN이 서로 일치하지 않습니다.');
      return;
    }
    setRepLoading(true);
    try {
      const result = await repAPI.register(parseInt(repForm.teamMemberId, 10), repForm.newPin);
      await completeRepLogin(result);
    } catch (err) {
      showAlert(err.message || '대표 등록에 실패했습니다.');
    } finally {
      setRepLoading(false);
    }
  };

  const handleRepPinChange = async () => {
    if (!repForm.currentPin || !repForm.newPin) {
      showAlert('현재 PIN과 새 PIN을 입력해주세요.');
      return;
    }
    if (!/^\d{6}$/.test(repForm.newPin)) {
      showAlert('PIN은 숫자 6자리여야 합니다.');
      return;
    }
    if (repForm.newPin !== repForm.newPinConfirm) {
      showAlert('새 PIN이 서로 일치하지 않습니다.');
      return;
    }
    setRepLoading(true);
    try {
      await repAPI.changePin(repForm.currentPin, repForm.newPin);
      showAlert('PIN이 변경되었습니다.');
      closeRepModal();
    } catch (err) {
      showAlert(err.message || 'PIN 변경에 실패했습니다.');
    } finally {
      setRepLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="order-page">
      {error && <div className="error-message">{error}</div>}

      {/* 주문 폼 */}
      <div className="order-form-card" ref={orderFormRef}>
        <h2>오늘의 커피 주문</h2>
        <p className="date-info">{new Date().toLocaleDateString('ko-KR')}</p>

        <div className="rep-team-summary">
          <strong>이 팀의 대표: {repList.length}명 · 장바구니 사용 가능 {repList.filter((rep) => rep.twosomeStatus === 'ACTIVE').length}명</strong>
          <span>{repList.length > 0 ? repList.map((rep) => `${rep.name}(${rep.statusReason})`).join(', ') : '주문 후 대표 등록과 투썸 로그인을 진행할 수 있습니다.'}</span>
          <span>매장 상태: {isStoreOpen ? '영업 중 · 실제 장바구니 담기 가능' : '매장 닫힘 또는 확인 불가 · 로컬 주문서만 저장'}</span>
        </div>
        <div className="order-layout">
          <div className="order-main">
        <div className="form-group">
          <label>이름 선택</label>
          <select
            aria-label="주문자 이름 선택"
            value={selectedTeam}
            onChange={(e) => {
              if (e.target.value === 'ADD_TEAM_MEMBER') {
                if (onAddTeamMember) onAddTeamMember();
              } else {
                handleTeamSelect(e.target.value);
              }
            }}
            disabled={!orderAvailable}
          >
            <option value="">선택하세요</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
            <option value="ADD_TEAM_MEMBER" className="add-team-option">+ 팀원 추가하기</option>
          </select>
        </div>

        {/* 최근 주문 표시 (레거시 CUSTOM 주문은 투썸 메뉴가 아니므로 재주문 불가) */}
        {latestOrder && orderAvailable && (() => {
          const latestMode = latestOrder.menuType || 'CUSTOM';
          const isModeMatch = latestMode === 'TWOSOME';

          return (
            <div className={`latest-order-box ${!isModeMatch ? 'disabled' : ''}`}>
              <div className="latest-order-info">
                <span className="latest-order-label">최근 주문</span>
                <span className={`latest-order-mode-badge ${latestMode === 'TWOSOME' ? 'twosome' : 'custom'}`}>
                  {latestMode === 'TWOSOME' ? '투썸' : '커스텀'}
                </span>
                <span className="latest-order-date">
                  {(() => {
                    const date = new Date(latestOrder.orderDate);
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    return `${month}/${day}`;
                  })()}
                </span>
                <span className="latest-order-menu">
                  {latestOrder.menuName}
                </span>
                {latestOrder.personalOption && (
                  <span className="latest-order-option">
                    ({latestOrder.personalOption})
                  </span>
                )}
              </div>
              <button
                className={`reorder-button ${!isModeMatch ? 'disabled' : ''}`}
                onClick={handleReorderClick}
                disabled={!isModeMatch}
                title={!isModeMatch ? '투썸 메뉴 기준 주문만 다시 주문할 수 있습니다' : ''}
              >
                다시 주문
              </button>
            </div>
          );
        })()}

        {/* 투썸 메뉴 선택 - 검색 및 카테고리 선택 */}
        {(
          <div className="form-group">
            <label>메뉴 선택 <span className="mode-badge">투썸 메뉴</span></label>

            {/* 메뉴 검색 입력 */}
            <div className="menu-search-container">
              <input
                type="text"
                name="menuSearch"
                autoComplete="off"
                aria-label="메뉴 검색"
                className="menu-search-input"
                placeholder="메뉴 검색 (예: 아메리카노, 라떼)"
                value={menuSearchQuery}
                onChange={(e) => handleMenuSearch(e.target.value)}
                disabled={!orderAvailable}
              />
              {menuSearchQuery && (
                <button
                  className="menu-search-clear"
                  aria-label="메뉴 검색어 지우기"
                  onClick={() => setMenuSearchQuery('')}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 카테고리 버튼 (검색 중이 아닐 때만 표시) */}
            {!menuSearchQuery && (
              <div className="category-buttons">
                {getCategories().map((category) => (
                  <button
                    key={category}
                    className={`category-btn ${selectedCategory === category ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect(category)}
                    disabled={!orderAvailable}
                  >
                    {category}
                    {twosomeMenus[category] && (
                      <span className="category-count">({twosomeMenus[category].length})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 투썸 메뉴 검색 결과 */}
        {menuSearchQuery && (
          <div className="form-group">
            <label>검색 결과 ({getSearchedMenus().length}건)</label>
            {getSearchedMenus().length === 0 ? (
              <div className="empty-search-result">
                '{menuSearchQuery}'에 대한 검색 결과가 없습니다.
              </div>
            ) : (
              <div className="twosome-card-grid">
                {getSearchedMenus().map((menu) => (
                  <button
                    key={menu.id}
                    className={`twosome-card ${
                      selectedTwosomeMenu === menu.id.toString() ? 'selected' : ''
                    } ${menu.salesPsblQty === 0 ? 'sold-out' : ''}`}
                    onClick={() => handleTwosomeMenuCardClick(menu)}
                    disabled={!orderAvailable}
                  >
                    <MenuThumbnail menu={menu} />
                    <span className="twosome-card-name">{menu.menuNm}</span>
                    <span className="twosome-card-category">{menu.category}</span>
                    {menu.salesPsblQty === 0 && <span className="sold-out-badge">품절</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 투썸 메뉴 2단계: 메뉴 선택 (카테고리 선택 후 표시) */}
        {selectedCategory && (
          <div className="form-group">
            <label>{selectedCategory} 메뉴</label>
            <div className="twosome-card-grid">
              {getCurrentMenus().map((menu) => (
                <button
                  key={menu.id}
                  className={`twosome-card ${
                    selectedTwosomeMenu === menu.id.toString() ? 'selected' : ''
                  } ${menu.salesPsblQty === 0 ? 'sold-out' : ''}`}
                  onClick={() => handleTwosomeMenuCardClick(menu)}
                  disabled={!orderAvailable}
                >
                  <MenuThumbnail menu={menu} />
                  <span className="twosome-card-name">{menu.menuNm}</span>
                  {menu.salesPsblQty === 0 && <span className="sold-out-badge">품절</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 투썸 메뉴 옵션 그룹 선택 (서버 기반, 그룹 순서대로) */}
        {selectedTwosomeMenu && menuOptions && menuOptions.parsed
          && menuOptions.groups.length > 0 && (
          <div className="form-group twosome-options">
            {menuOptions.groups.map((group) => (
              <div key={group.grpCd} style={{ marginTop: '0.5rem' }}>
                <label>
                  {group.grpNm} 선택
                  {group.required && !selectedOpts[group.grpCd] && (
                    <span className="option-required-mark"> (필수)</span>
                  )}
                </label>
                <div className="option-buttons-grid">
                  {getVisibleOptions(group).map((option) => (
                    <button
                      key={option.opts}
                      className={`option-chip ${selectedOpts[group.grpCd] === option.opts ? 'selected' : ''}`}
                      onClick={() => {
                        // 그룹 의존성: 현재 그룹 이후는 초기화 후 기본값 자동 선택 (앱 동작과 동일)
                        // 서버 available-options 조회로 불가능한 자동값은 이후 effect에서 교정
                        const next = { ...selectedOpts, [group.grpCd]: option.opts };
                        const groupIdx = (menuOptions.groups || []).findIndex((g) => g.grpCd === group.grpCd);
                        (menuOptions.groups || []).slice(groupIdx + 1).forEach((g) => {
                          next[g.grpCd] = resolveAutoSelectOpt(g, next);
                        });
                        setSelectedOpts(next);
                        setVariantInfo(null);
                        setVariantFailed(false);
                      }}
                      disabled={!orderAvailable}
                    >
                      {option.optNm || option.opts}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* 선택 옵션 표시 + 예상 가격 (변형 코드 조회 결과) */}
            <div className="option-display" style={{ marginTop: '0.5rem' }}>
              {isAllGroupsSelected() ? (
                variantFailed ? (
                  <span className="option-required-mark">선택한 옵션 조합은 판매되지 않습니다. 옵션을 다시 선택해주세요.</span>
                ) : variantInfo ? (
                  <>
                    선택: {getTwosomeOptionString()}
                    {getCustomOptionString() && ` | ${getCustomOptionString()}`}
                    {variantInfo.variantMenuNm && ` (${variantInfo.variantMenuNm})`}
                    {variantInfo.price != null && (
                      <span className="variant-price">
                        {' '}예상 가격: {(variantInfo.price + getCustomTotalPrice()).toLocaleString()}원
                      </span>
                    )}
                  </>
                ) : '옵션 가격 확인 중...'
              ) : (
                '옵션을 모두 선택하면 예상 가격이 표시됩니다.'
              )}
            </div>
          </div>
        )}

        {/* 로딩 상태도 같은 영역을 유지해 주문 버튼 위치가 밀리지 않게 한다 */}
        {selectedTwosomeMenu && customOptionsStatus !== 'success' && (
          <div className="form-group twosome-options custom-accordion">
            {customOptionsStatus === 'loading' ? (
              <div className="custom-options-status" role="status" aria-live="polite">
                <span className="custom-options-spinner" aria-hidden="true" />
                퍼스널 옵션을 불러오는 중…
              </div>
            ) : customOptionsStatus === 'error' ? (
              <div className="custom-options-status is-error" role="alert">
                <span>퍼스널 옵션을 불러오지 못했습니다.</span>
                <button
                  type="button"
                  className="custom-options-retry"
                  onClick={() => setCustomOptionsRetry((retry) => retry + 1)}
                >
                  다시 시도
                </button>
              </div>
            ) : customOptionsStatus === 'empty' ? (
              <div className="custom-options-status">퍼스널 옵션 없음</div>
            ) : (
              <div className="custom-options-status">
                {variantFailed
                  ? '선택한 옵션 조합에서는 퍼스널 옵션을 사용할 수 없습니다.'
                  : '기본 옵션을 선택하면 퍼스널 옵션을 사용할 수 있습니다.'}
              </div>
            )}
          </div>
        )}

        {selectedTwosomeMenu && customOptionsStatus === 'success' && variantInfo && customOptions?.hasCustom && (
          <div className="form-group twosome-options custom-accordion">
            <button
              type="button"
              className="custom-accordion-header"
              onClick={() => setCustomOptionsOpen(!customOptionsOpen)}
            >
              {getCustomSummaryText()
                ? `퍼스널 옵션 — ${getCustomSummaryText()} ${customOptionsOpen ? '▾' : '▸'} (+${getCustomTotalPrice().toLocaleString()}원)`
                : `퍼스널 옵션 (선택) ${customOptionsOpen ? '▾' : '▸'}`}
            </button>
            {customOptionsOpen && (
            <div className="custom-accordion-body">
              <CustomOptionsPanel
                customOptions={customOptions}
                selectedCustom={selectedCustom}
                onChange={setSelectedCustom}
                onClose={() => setCustomOptionsOpen(false)}
                disabled={!orderAvailable}
              />
            </div>
            )}
          </div>
        )}

        {/* 옵션 조회 실패 안내 (기본 코드로 주문 가능) */}
        {selectedTwosomeMenu && optionsError && (
          <div className="option-error-notice">{optionsError}</div>
        )}

        {/* 주문 버튼 (저장 + 투썸 장바구니 담기 통합) */}
        <button
          className={`order-button ${!orderAvailable ? 'disabled' : ''}`}
          onClick={handleOrder}
          disabled={!orderAvailable || isCartLoading}
        >
          {isCartLoading ? '처리 중...' : !isStoreOpen
            ? '팀 주문서에 담기 (매장 닫힘)'
            : repList.filter((rep) => rep.twosomeStatus === 'ACTIVE').length === 1
              ? `투썸 장바구니 담기 (${repList.find((rep) => rep.twosomeStatus === 'ACTIVE').name} 계정)`
              : repList.some((rep) => rep.twosomeStatus === 'ACTIVE')
                ? '대표 선택 후 투썸 장바구니 담기'
                : '팀 주문서에 담기'}
        </button>
          </div>
          <aside className={`order-summary ${!selectedTwosomeMenu ? 'is-empty' : ''}`} aria-label="주문 요약">
            <div className="order-summary-heading">
              <h3>주문 요약</h3>
              <span className="order-summary-caption">총 예상 금액</span>
            </div>
            <div className="order-summary-menu">
              {selectedTwosomeMenu ? getSelectedMenuName() : '메뉴를 선택해주세요'}
            </div>
            {selectedTwosomeMenu && (
              <>
                <p className="order-summary-options">
                  {[getTwosomeOptionString(), getCustomOptionString()].filter(Boolean).join(' | ') || '기본 옵션을 선택해주세요.'}
                </p>
                <div className="order-summary-price">
                  {variantInfo?.price != null
                    ? `${(variantInfo.price + getCustomTotalPrice()).toLocaleString()}원`
                    : '가격 확인 중…'}
                </div>
              </>
            )}
            <div className="order-summary-destination">
              {!isStoreOpen
                ? '매장 닫힘 · 팀 주문서만 저장'
                : repList.filter((rep) => rep.twosomeStatus === 'ACTIVE').length === 1
                  ? `${repList.find((rep) => rep.twosomeStatus === 'ACTIVE').name} 대표의 투썸 장바구니`
                  : repList.some((rep) => rep.twosomeStatus === 'ACTIVE')
                    ? '대표를 선택해 투썸 장바구니에 담기'
                    : '팀 주문서만 저장'}
            </div>
            <div className="order-summary-caption">
              {getSelectedTeamName() || '주문자를 선택해주세요'}
            </div>
          </aside>
        </div>
      </div>

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

      {/* 대표 로그인 모달 */}
      <Modal
        isOpen={repModalMode === 'login'}
        onClose={closeRepModal}
        title="대표 로그인"
      >
        <div className="rep-modal-form">
          <label className="form-label">대표 선택</label>
          <select
            value={repForm.memberId}
            onChange={(e) => setRepForm({ ...repForm, memberId: e.target.value })}
          >
            <option value="">선택해주세요</option>
            {repList.map((rep) => (
              <option key={rep.id} value={rep.id}>{rep.name} ({rep.teamName})</option>
            ))}
          </select>

          <label className="form-label">PIN (숫자 6자리)</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.pin}
            onChange={(e) => setRepForm({ ...repForm, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            onKeyDown={(e) => e.key === 'Enter' && handleRepLogin()}
            placeholder="PIN 입력"
            maxLength={6}
          />

          <div className="rep-modal-buttons">
            <button className="rep-auth-btn primary" onClick={handleRepLogin} disabled={repLoading}>
              {repLoading ? '로그인 중...' : '로그인'}
            </button>
            <button className="rep-auth-btn" onClick={() => { resetRepForm(); setRepModalMode('setup'); }}>
              본인 팀원으로 대표 등록
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={repModalMode === 'setup'} onClose={closeRepModal} title="대표 등록 및 PIN 생성">
        <div className="rep-modal-form">
          <p className="rep-twosome-guide">본인 팀원을 선택하고 본인만 아는 PIN을 만드세요. 기존 대표는 입력한 기존 PIN으로 로그인하며 PIN이 바뀌지는 않습니다.</p>
          <label className="form-label">본인 팀원 선택</label>
          <select value={repForm.teamMemberId} onChange={(e) => setRepForm({ ...repForm, teamMemberId: e.target.value })}>
            <option value="">선택해주세요</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <label className="form-label">새 PIN (숫자 6자리)</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.newPin}
            onChange={(e) => setRepForm({ ...repForm, newPin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            placeholder="새 PIN"
            maxLength={6}
          />

          <label className="form-label">새 PIN 확인</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.newPinConfirm}
            onChange={(e) => setRepForm({ ...repForm, newPinConfirm: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            onKeyDown={(e) => e.key === 'Enter' && handleRepPinSetup()}
            placeholder="새 PIN 재입력"
            maxLength={6}
          />

          <div className="rep-modal-buttons">
            <button className="rep-auth-btn primary" onClick={handleRepPinSetup} disabled={repLoading}>
              {repLoading ? '처리 중...' : 'PIN 설정'}
            </button>
            <button className="rep-auth-btn" onClick={() => { resetRepForm(); setRepModalMode('login'); }}>
              로그인으로 돌아가기
            </button>
          </div>
        </div>
      </Modal>

      {/* PIN 변경 모달 */}
      <Modal
        isOpen={repModalMode === 'change'}
        onClose={closeRepModal}
        title="PIN 변경"
      >
        <div className="rep-modal-form">
          <label className="form-label">현재 PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.currentPin}
            onChange={(e) => setRepForm({ ...repForm, currentPin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            placeholder="현재 PIN"
            maxLength={6}
          />

          <label className="form-label">새 PIN (숫자 6자리)</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.newPin}
            onChange={(e) => setRepForm({ ...repForm, newPin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            placeholder="새 PIN"
            maxLength={6}
          />

          <label className="form-label">새 PIN 확인</label>
          <input
            type="password"
            inputMode="numeric"
            value={repForm.newPinConfirm}
            onChange={(e) => setRepForm({ ...repForm, newPinConfirm: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
            onKeyDown={(e) => e.key === 'Enter' && handleRepPinChange()}
            placeholder="새 PIN 재입력"
            maxLength={6}
          />

          <div className="rep-modal-buttons">
            <button className="rep-auth-btn primary" onClick={handleRepPinChange} disabled={repLoading}>
              {repLoading ? '처리 중...' : 'PIN 변경'}
            </button>
            <button className="rep-auth-btn" onClick={closeRepModal}>취소</button>
          </div>
        </div>
      </Modal>

      {/* 대표 투썸 로그인 모달 (수동 캡차 입력) */}
      <Modal
        isOpen={repTwosomeModal === 'login'}
        onClose={() => { setRepTwosomeModal(null); setRepCaptcha(null); }}
        title="투썸 로그인"
      >
        <div className="rep-modal-form">
          <p className="rep-twosome-guide">
            투썸 계정으로 로그인합니다. 새 로그인으로 인해 투썸하트 앱이 로그아웃될 수 있습니다.
          </p>
          <label className="form-label">투썸 아이디</label>
          <input
            type="text"
            value={repTwosomeForm.loginId}
            onChange={(e) => setRepTwosomeForm({ ...repTwosomeForm, loginId: e.target.value })}
            placeholder="투썸하트 아이디"
            autoComplete="off"
          />
          <label className="form-label">패스워드</label>
          <input
            type="password"
            value={repTwosomeForm.loginPwd}
            onChange={(e) => setRepTwosomeForm({ ...repTwosomeForm, loginPwd: e.target.value })}
            placeholder="패스워드"
          />
          <div className="twosome-captcha-row">
            {repCaptcha ? (
              <img className="twosome-captcha-img" src={repCaptcha.imageBase64} alt="캡차" />
            ) : (
              <div className="twosome-captcha-loading">캡차 로딩 중...</div>
            )}
            <button className="rep-auth-btn" onClick={requestRepCaptcha} disabled={repLoading}>
              캡차 새로고침
            </button>
          </div>
          <label className="form-label">캡차 입력 (6자리 숫자)</label>
          <input
            type="text"
            inputMode="numeric"
            value={repCaptchaAnswer}
            onChange={(e) => setRepCaptchaAnswer(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handleRepTwosomeLogin()}
            placeholder="이미지의 숫자 6자리 입력"
            maxLength={6}
          />
          <div className="rep-modal-buttons">
            <button
              className="rep-auth-btn primary"
              onClick={handleRepTwosomeLogin}
              disabled={repLoading || !repCaptcha || !repTwosomeForm.loginId.trim() || !repTwosomeForm.loginPwd}
            >
              {repLoading ? '로그인 중...' : '로그인'}
            </button>
            <button
              className="rep-auth-btn"
              onClick={() => { setRepTwosomeModal(null); setRepCaptcha(null); }}
              disabled={repLoading}
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      <OrderChangeModal
        isOpen={isOrderChangeModalOpen}
        onClose={() => setIsOrderChangeModalOpen(false)}
        onConfirm={handleOrderChangeConfirm}
        onAdd={handleOrderAddConfirm}
        teamName={orderChangeData?.teamName}
        existingOrders={orderChangeData?.existingOrders || []}
        selectedExistingId={orderChangeData?.selectedExistingId}
        onSelectExisting={(id) => setOrderChangeData((previous) => ({ ...previous, selectedExistingId: id }))}
        newOrder={orderChangeData?.new}
        loading={isCartLoading}
      />

      <ReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        onConfirm={handleReorderConfirm}
        latestOrder={latestOrder}
        isLoading={isCartLoading}
      />

      <RepSelectModal
        isOpen={repSelectOpen}
        reps={repList}
        selectedId={selectedTargetRepId}
        onSelect={setSelectedTargetRepId}
        onConfirm={handleTargetRepConfirm}
        onCancel={handleTargetRepCancel}
        loading={isCartLoading}
      />

      <Modal isOpen={isCombinedResultOpen} onClose={() => setIsCombinedResultOpen(false)} title="주문 결과">
        {combinedResult && (
          <div className="cart-result">
            <p className="cart-result-summary">로컬 주문서에 주문 1건을 저장했습니다.</p>
            {combinedResult.cartOutcome?.type === 'cart' && (
              <>
                <p className="cart-result-summary">{combinedResult.cartOutcome.owner}의 실제 투썸 장바구니 반영: 성공 {combinedResult.cartOutcome.result.success}건 / 실패 {combinedResult.cartOutcome.result.failed}건</p>
                <ul className="cart-result-list">
                  {(combinedResult.cartOutcome.result.results || []).map((item, index) => (
                    <li key={`${item.menuCd}-${index}`} className={item.success ? 'cart-result-success' : 'cart-result-failed'}>
                      <span className="cart-result-status">{item.success ? '성공' : '실패'}</span>
                      <span className="cart-result-menu">{item.menuNm || item.menuCd}</span>
                      {item.message && <span className="cart-result-message">({item.message})</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {combinedResult.cartOutcome?.type === 'no-items' && <p>장바구니에 담을 투썸 주문 항목이 없습니다.</p>}
            {combinedResult.cartOutcome?.type === 'store-closed' && <p>매장이 닫혀 있어 실제 투썸 장바구니에는 담지 않았습니다. 팀 주문서만 유지하며, 개장 후 내역에서 일괄 담기할 수 있습니다.</p>}
            {combinedResult.cartOutcome?.type === 'local-only' && <p>팀 주문서만 유지합니다. 실제 투썸 장바구니에는 담지 않았습니다.</p>}
            {combinedResult.cartOutcome?.type === 'no-reps' && (
              <>
                <p>로컬 주문서에 저장했습니다. 실제 투썸플레이스 앱 장바구니에 저장하려면 로그인이 필요합니다. 로그인 하시겠습니까?</p>
                <div className="rep-modal-buttons"><button className="rep-auth-btn primary" onClick={handleCombinedLogin}>로그인하기</button><button className="rep-auth-btn" onClick={() => setIsCombinedResultOpen(false)}>취소</button></div>
              </>
            )}
            {combinedResult.cartOutcome?.type === 'rep-login-required' && (
              <>
                <p>{combinedResult.cartOutcome.message || `${combinedResult.cartOutcome.owner} 대표의 투썸 로그인이 필요합니다. 로그인 후 방금 주문을 장바구니에 담으시겠습니까?`}</p>
                <div className="rep-modal-buttons"><button className="rep-auth-btn primary" onClick={handleCombinedLogin}>로그인하기</button><button className="rep-auth-btn" onClick={() => setIsCombinedResultOpen(false)}>취소</button></div>
              </>
            )}
            {combinedResult.cartOutcome?.type === 'cart-failed' && <p className="cart-result-failed">로컬 주문은 저장했지만 {combinedResult.cartOutcome.owner} 장바구니 담기에 실패했습니다: {combinedResult.cartOutcome.message}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderPage;
