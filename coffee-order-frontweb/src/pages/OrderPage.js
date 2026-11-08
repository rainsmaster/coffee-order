import React, { useState, useEffect, useRef } from 'react';
import { teamAPI, orderAPI, twosomeMenuAPI, twosomeStoreAPI, repAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import OrderChangeModal from '../components/OrderChangeModal';
import ReorderModal from '../components/ReorderModal';
import Modal from '../components/Modal';
import useModal from '../hooks/useModal';
import './OrderPage.css';

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
  const [selectedOpts, setSelectedOpts] = useState({}); // {grpCd: opts}
  const [variantInfo, setVariantInfo] = useState(null); // {variantMenuCd, variantMenuNm, price}
  const [customOptions, setCustomOptions] = useState(null); // 퍼스널 옵션 (수량형+선택형)
  const [selectedCustom, setSelectedCustom] = useState({ qty: {}, choices: {} }); // {qty:{key:수량}, choices:{groupKey:choiceKey}}
  const [customOptionsOpen, setCustomOptionsOpen] = useState(false); // 퍼스널 옵션 아코디언 펼침 여부 (기본 접힘)
  const [availableOpts, setAvailableOpts] = useState({}); // 그룹 의존성 {grpCd: [가능 opts...]} (서버 조회 실패 시 빈 맵=전체 렌더)
  const [variantFailed, setVariantFailed] = useState(false); // 변형 조회 실패 (비정상 옵션 조합)
  const [optionsError, setOptionsError] = useState('');
  const [personalOption, setPersonalOption] = useState(''); // 텍스트 입력 옵션
  const orderAvailable = true; // 마감 개념 제거 — 항상 주문 가능
  const [menuSearchQuery, setMenuSearchQuery] = useState(''); // 메뉴 검색어

  // 주문 변경 모달 상태
  const [isOrderChangeModalOpen, setIsOrderChangeModalOpen] = useState(false);
  const [orderChangeData, setOrderChangeData] = useState(null);

  // 재주문 모달 상태
  const [latestOrder, setLatestOrder] = useState(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isReorderLoading, setIsReorderLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 주문 통합 결과 모달 상태 (주문 저장 + 장바구니 담기)
  const [combinedResult, setCombinedResult] = useState(null); // {cartOutcome: {...}}
  const [isCombinedResultOpen, setIsCombinedResultOpen] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false); // 주문~장바구니 통합 처리 중

  // 팀 대표 로그인 상태 (1단계: 로그인 표시까지만, 주문 강제는 없음)
  const [repInfo, setRepInfo] = useState(null); // {id, name, teamName}
  const [orderCartMode, setOrderCartMode] = useState(null); // 'rep' | null (주문 버튼 라벨용, 대표 세션 전용)
  const [isStoreOpen, setIsStoreOpen] = useState(false); // 폐점 게이팅용 개점 여부 (조회 실패 시 false=폐점 취급)
  const [repModalMode, setRepModalMode] = useState(null); // 'login' | 'setup' | 'change' | null
  const [repList, setRepList] = useState([]); // GET /api/reps
  const [repForm, setRepForm] = useState({ memberId: '', pin: '', inviteCode: '', newPin: '', newPinConfirm: '', currentPin: '' });
  const [repLoading, setRepLoading] = useState(false);
  const [repTwosomeStatus, setRepTwosomeStatus] = useState('NONE'); // 대표 투썸 세션 상태
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
    showConfirm,
    closeConfirm,
  } = useModal();

  // 데이터 로드 (부서 변경 시 재로드)
  useEffect(() => {
    if (selectedDepartmentId) {
      loadData();
      resetOrderForm();
    }

    // 5초마다 주문 목록 자동 새로고침 (폴링)
    const interval = setInterval(() => {
      if (selectedDepartmentId) {
        loadOrders();
      }
    }, 5000);

    return () => clearInterval(interval);
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

  // 재주문 처리 - 바로 주문하기
  const handleReorderConfirm = async () => {
    if (!latestOrder || !selectedTeam) return;

    setIsReorderLoading(true);

    try {
      // 기존 주문이 있는지 확인
      const existingOrder = orders.find(
        (o) => o.teamId === parseInt(selectedTeam)
      );

      const orderData = {
        departmentId: selectedDepartmentId,
        teamId: parseInt(selectedTeam),
        twosomeMenuId: latestOrder.twosomeMenuId,
        personalOption: latestOrder.personalOption || null,
        orderDate: new Date().toLocaleDateString('sv-SE'),
      };

      if (existingOrder) {
        // 기존 주문이 있으면 수정
        const updatedOrder = {
          team: { id: parseInt(selectedTeam) },
          menuType: 'TWOSOME',
          twosomeMenu: latestOrder.twosomeMenuId
            ? { id: latestOrder.twosomeMenuId }
            : null,
          personalOption: orderData.personalOption,
          orderDate: existingOrder.orderDate,
        };
        await orderAPI.update(existingOrder.id, updatedOrder, selectedDepartmentId);
        showAlert('주문이 변경되었습니다!');
      } else {
        // 새 주문 생성
        await orderAPI.create(orderData);
        showAlert('주문이 완료되었습니다!');
      }

      setIsReorderModalOpen(false);
      setLatestOrder(null);
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '주문에 실패했습니다.');
    } finally {
      setIsReorderLoading(false);
    }
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

    // 투썸 메뉴 옵션 그룹 필수 선택 체크 (required 그룹만)
    if (menuOptions && menuOptions.parsed) {
      const missingGroup = (menuOptions.groups || []).find(
        (group) => group.required && !selectedOpts[group.grpCd]
      );
      if (missingGroup) {
        showAlert(`'${missingGroup.grpNm}' 옵션을 선택해주세요.`);
        return;
      }
      // 옵션 그룹이 있는 메뉴는 전체 선택 완료 + 변형 검증 통과 필수 (비정상 조합 담기 차단)
      const hasGroups = (menuOptions.groups || []).length > 0;
      if (hasGroups && isAllGroupsSelected() && (!variantInfo || variantFailed)) {
        showAlert('선택한 옵션 조합은 판매되지 않습니다. 옵션을 다시 선택해주세요.');
        return;
      }
    }

    // 옵션 선택 문자열 + 퍼스널 옵션(커스텀) + 퍼스널 텍스트 결합
    const customStr = getCustomOptionString();
    const optionParts = [getTwosomeOptionString(), customStr].filter(Boolean).join(' | ');
    let finalOption = '';
    if (optionParts && personalOption) {
      finalOption = `${optionParts}, ${personalOption}`;
    } else {
      finalOption = optionParts || personalOption;
    }

    // 기존 주문이 있는지 확인
    const existingOrder = orders.find(
      (o) => o.teamId === parseInt(selectedTeam)
    );

    if (existingOrder) {
      // 기존 주문이 있으면 비교 팝업 표시
      setOrderChangeData({
        existingOrder: existingOrder,
        teamName: getSelectedTeamName(),
        existing: {
          menuName: existingOrder.menuName,
          option: existingOrder.personalOption || null
        },
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

    // 기존 주문이 없으면 새로 생성 후 이어서 장바구니 담기
    setIsCartLoading(true);
    try {
      const order = {
        departmentId: selectedDepartmentId,
        teamId: parseInt(selectedTeam),
        twosomeMenuId: parseInt(selectedTwosomeMenu),
        personalOption: finalOption || null,
        orderDate: new Date().toLocaleDateString('sv-SE'),
        // 투썸 변형 정보 영속화 — 다른 기기에서도 변형 코드로 장바구니 담기 가능
        variantMenuCd: variantInfo?.variantMenuCd ?? null,
        variantOpts: getSelectedOptsList().join(',') || null,
        // 투썸 퍼스널 옵션 (cartCstmInfo 배열 스냅샷)
        cstmInfo: variantInfo?.variantMenuCd
          ? (JSON.stringify(buildCartCstmInfo(variantInfo.variantMenuCd)) || null)
          : null,
      };

      const createdOrder = await orderAPI.create(order);

      // (b) 로그인 + 개점 상태일 때만 장바구니 담기 (폐점/비로그인은 팀 주문서 저장만)
      const loggedIn = orderCartMode !== null;
      let cartOutcome;
      if (loggedIn && isStoreOpen) {
        cartOutcome = await runCartStepAfterOrder();

        // 장바구니 담기 성공 시 반영 마킹 (일괄 담기 대상에서 제외)
        if (cartOutcome.type === 'cart' && cartOutcome.result?.success > 0 && createdOrder?.id) {
          try {
            await orderAPI.markCartReflected([createdOrder.id]);
          } catch (markErr) {
            console.error('장바구니 반영 마킹 실패 (무시):', markErr);
          }
        }
      } else if (loggedIn && !isStoreOpen) {
        cartOutcome = { type: 'store-closed' };
      } else {
        cartOutcome = { type: 'no-session' };
      }

      // (c) 통합 결과 모달
      setCombinedResult({ cartOutcome });
      setIsCombinedResultOpen(true);
      if (loggedIn && !isStoreOpen) {
        showAlert('매장이 닫혀 있어 장바구니 담기는 불가합니다. 팀 주문서에 담았으며, 개장 후 내역 페이지에서 일괄 담기할 수 있습니다.');
      }
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '주문 실패했습니다.');
    } finally {
      setIsCartLoading(false);
    }
  };

  // 주문 변경 확인 처리
  const handleOrderChangeConfirm = async () => {
    if (!orderChangeData) return;

    try {
      const { existingOrder, newOrderData } = orderChangeData;

      const updatedOrder = {
        team: { id: existingOrder.teamId },
        menuType: 'TWOSOME',
        twosomeMenu: newOrderData.twosomeMenuId
          ? { id: newOrderData.twosomeMenuId }
          : null,
        personalOption: newOrderData.personalOption,
        orderDate: existingOrder.orderDate,
        variantMenuCd: newOrderData.variantMenuCd,
        variantOpts: newOrderData.variantOpts,
        cstmInfo: newOrderData.cstmInfo,
      };

      await orderAPI.update(existingOrder.id, updatedOrder, selectedDepartmentId);
      showAlert('주문이 변경되었습니다!');
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '주문 변경에 실패했습니다.');
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
    setPersonalOption('');
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
  const handleTwosomeMenuSelect = async (menuId, menuCd) => {
    setSelectedTwosomeMenu(menuId);
    setMenuOptions(null);
    setSelectedOpts({});
    setVariantInfo(null);
    setVariantFailed(false);
    setCustomOptions(null);
    setSelectedCustom({ qty: {}, choices: {} });
    setCustomOptionsOpen(false);
    setAvailableOpts({});
    setOptionsError('');

    if (!menuCd) return;
    try {
      const options = await twosomeStoreAPI.getMenuOptions(menuCd);
      if (!options) return;
      if (!options.parsed) {
        setMenuOptions(options);
        setOptionsError(options.message || '옵션 정보를 파싱하지 못했습니다.');
        return;
      }
      setMenuOptions(options);
      // 기본 선택이 있는 그룹은 미리 선택
      const defaults = {};
      for (const group of options.groups || []) {
        const defaultOpt = (group.options || []).find((o) => o.defaultOpt);
        if (defaultOpt) {
          defaults[group.grpCd] = defaultOpt.opts;
        }
      }
      setSelectedOpts(defaults);
    } catch (err) {
      // 세션 없음 등으로 옵션 조회 불가 — 기본 코드로 주문 가능
      setOptionsError('옵션을 불러오지 못했습니다. 투썸 로그인 상태를 확인해주세요. (기본 옵션으로 주문됩니다)');
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
      setSelectedCustom({ qty: {}, choices: {} });
      setCustomOptionsOpen(false);
      return undefined;
    }
    let cancelled = false;
    const fetchVariant = async () => {
      try {
        const result = await twosomeStoreAPI.resolveVariant(menuOptions.menuCd, getSelectedOptsList());
        if (cancelled) return;
        // 방어: 변형 코드 없거나 가격이 비정상(0 이하)이면 비정상 조합으로 간주해 차단
        if (!result || !result.variantMenuCd || result.price == null || result.price <= 0) {
          setVariantInfo(null);
          setVariantFailed(true);
          setCustomOptions(null);
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
            if (!cancelled) setCustomOptions(custom);
          } catch (err) {
            if (!cancelled) setCustomOptions(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setVariantInfo(null);
          setVariantFailed(true);
          setCustomOptions(null);
          setCustomOptionsOpen(false);
        }
      }
    };
    fetchVariant();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpts, menuOptions]);

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

  // 팀 주문 항목을 집계해 대표 투썸 장바구니에 일괄 담기 (주문 저장 후 이어서 실행)
  // 변형 정보는 Order 엔티티에 영속된 값 사용 (다른 기기에서도 변형 코드로 담김)
  // 반환: {type:'cart', result} | {type:'no-items'} | 예외 throw
  const addTeamOrdersToCart = async () => {
    // 저장 직후 주문이므로 최신 목록을 다시 조회해 집계
    const freshOrders = await orderAPI.getToday(selectedDepartmentId);

    const itemMap = new Map();
    for (const order of freshOrders) {
      if (order.menuType !== 'TWOSOME' || !order.twosomeMenuCode) continue;
      const variantMenuCd = order.variantMenuCd || null;
      const key = variantMenuCd || order.twosomeMenuCode;
      const existing = itemMap.get(key);
      const cstmInfo = order.cstmInfo ? JSON.parse(order.cstmInfo) : null;
      itemMap.set(key, {
        menuCd: order.twosomeMenuCode,
        upMenuCd: order.twosomeMenuCode, // 원메뉴 코드는 기본 코드
        midCd: existing?.midCd || findMidCdByMenuCd(order.twosomeMenuCode),
        qty: (existing?.qty || 0) + 1,
        opts: order.variantOpts ? order.variantOpts.split(',').map((o) => o.trim()).filter(Boolean) : null,
        variantMenuCd,
        cstmInfo,
      });
    }

    if (itemMap.size === 0) {
      return { type: 'no-items' };
    }

    const result = await repAPI.repAddToCart(Array.from(itemMap.values()));
    return { type: 'cart', result };
  };

  // 주문 저장 후 이어지는 장바구니 담기 단계 — 대표 세션 전용 (관리자 세션 미사용)
  // 반환: {type, owner?, ...}
  const runCartStepAfterOrder = async () => {
    if (repInfo && repTwosomeStatus === 'ACTIVE') {
      try {
        const outcome = await addTeamOrdersToCart();
        return { ...outcome, owner: `${repInfo.name} 대표` };
      } catch (err) {
        const expired = err.message === 'TWOSOME_SESSION_EXPIRED';
        if (expired) setRepTwosomeStatus('EXPIRED');
        return {
          type: 'cart-failed',
          owner: `${repInfo.name} 대표`,
          message: expired
            ? '대표 투썸 세션이 만료되었습니다. 다시 로그인해주세요.'
            : (err.message || '장바구니 담기 중 오류가 발생했습니다.'),
        };
      }
    }
    return { type: 'no-session' };
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

  // 주문 버튼 라벨용 로그인 모드 판정 — 대표 세션(PIN 로그인) 전용, 관리자 세션은 사용하지 않음
  const detectOrderCartMode = async () => {
    if (localStorage.getItem('repToken')) {
      try {
        const repSession = await repAPI.twosomeSession();
        if (repSession.status === 'ACTIVE') {
          const me = await repAPI.me(); // 대표 이름 1회 조회 (캐시)
          setOrderCartMode({ mode: 'rep', label: me.name });
          return 'rep';
        }
      } catch (err) {
        // 대표 세션 없음/만료 → 비로그인
      }
    }
    setOrderCartMode(null);
    return null;
  };

  // 폐점 게이팅용 개점 여부 판정. ordTime("07:30 ~ 20:50")과 현재 시각 비교.
  // 로그인 모드가 있을 때만 조회, 실패 시 폐점(false)으로 취급해 담기를 차단한다.
  const loadStoreOpen = async (mode) => {
    if (!mode) {
      setIsStoreOpen(false);
      return;
    }
    try {
      const info = await twosomeStoreAPI.getStoreInfo();
      setIsStoreOpen(isWithinOrdTime(info));
    } catch (err) {
      setIsStoreOpen(false);
    }
  };

  // ordTime 파싱 → 개점 여부 (파싱 불가/응답 없으면 false)
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

  const openRepTwosomeLoginModal = () => {
    // 등록된 계정이 있으면 아이디 프리필 (수정 가능), 패스워드는 항상 빈칸
    setRepTwosomeForm({ loginId: repMe?.twosomeId || '', loginPwd: '' });
    setRepTwosomeModal('login');
    requestRepCaptcha();
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
        try {
          const me = await repAPI.me();
          setRepMe(me);
        } catch (err) {
          // me 갱신 실패 무시
        }
        const mode = await detectOrderCartMode();
        await loadStoreOpen(mode);
        showAlert('투썸 로그인되었습니다.');
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

  const handleRepTwosomeLogout = async () => {
    try {
      await repAPI.twosomeLogout();
    } catch (err) {
      // 세션 없어도 로컬 상태는 초기화
    }
    setRepTwosomeStatus('NONE');
    const mode = await detectOrderCartMode();
    await loadStoreOpen(mode);
  };

  const resetRepForm = () => {
    setRepForm({ memberId: '', pin: '', inviteCode: '', newPin: '', newPinConfirm: '', currentPin: '' });
  };

  const openRepLoginModal = async () => {
    resetRepForm();
    setRepModalMode('login');
    try {
      const list = await repAPI.list();
      setRepList(list || []);
    } catch (err) {
      showAlert('대표 목록을 불러오지 못했습니다.');
    }
  };

  const closeRepModal = () => {
    setRepModalMode(null);
    resetRepForm();
  };

  const handleRepLogin = async () => {
    if (!repForm.memberId) {
      showAlert('대표를 선택해주세요.');
      return;
    }
    if (!repForm.pin) {
      showAlert('PIN을 입력해주세요.');
      return;
    }
    setRepLoading(true);
    try {
      const result = await repAPI.login(parseInt(repForm.memberId), repForm.pin);
      localStorage.setItem('repToken', result.token);
      setRepInfo({ id: parseInt(repForm.memberId), name: result.name, teamName: result.teamName });
      closeRepModal();
    } catch (err) {
      if (err.message === 'PIN_NOT_SET') {
        // PIN 미설정 → 초대코드로 PIN 설정 모드 전환
        showAlert('PIN이 아직 설정되지 않았습니다. 초대코드로 PIN을 설정해주세요.');
        setRepModalMode('setup');
      } else {
        showAlert(err.message || '로그인에 실패했습니다.');
      }
    } finally {
      setRepLoading(false);
    }
  };

  const handleRepPinSetup = async () => {
    if (!repForm.memberId) {
      showAlert('대표를 선택해주세요.');
      return;
    }
    if (!repForm.inviteCode) {
      showAlert('초대코드를 입력해주세요.');
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
      await repAPI.setupPin(parseInt(repForm.memberId), repForm.inviteCode.trim(), repForm.newPin);
      showAlert('PIN이 설정되었습니다. 로그인해주세요.');
      setRepModalMode('login');
      resetRepForm();
    } catch (err) {
      showAlert(err.message || 'PIN 설정에 실패했습니다.');
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

  const handleRepLogout = () => {
    localStorage.removeItem('repToken');
    setRepInfo(null);
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

        {/* 팀 대표 로그인 상태 (1단계: 표시만) */}
        <div className="rep-auth-bar">
          {repInfo ? (
            <>
              <span className="rep-auth-info">
                {repInfo.name}({repInfo.teamName})
                <span className={`rep-twosome-status ${repTwosomeStatus.toLowerCase()}`}>
                  {repTwosomeStatus === 'ACTIVE' ? ' · 투썸 로그인됨' : ' · 투썸 미로그인'}
                </span>
              </span>
              {repTwosomeStatus === 'ACTIVE' ? (
                <button className="rep-auth-btn" onClick={handleRepTwosomeLogout}>투썸 로그아웃</button>
              ) : (
                <button className="rep-auth-btn primary" onClick={openRepTwosomeLoginModal}>투썸 로그인</button>
              )}
              <button className="rep-auth-btn" onClick={() => { resetRepForm(); setRepModalMode('change'); }}>
                PIN 변경
              </button>
              <button className="rep-auth-btn" onClick={handleRepLogout}>로그아웃</button>
            </>
          ) : (
            <button className="rep-auth-btn primary" onClick={openRepLoginModal}>대표 로그인</button>
          )}
        </div>

        <div className="form-group">
          <label>이름 선택</label>
          <select
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
                className="menu-search-input"
                placeholder="메뉴 검색 (예: 아메리카노, 라떼)"
                value={menuSearchQuery}
                onChange={(e) => handleMenuSearch(e.target.value)}
                disabled={!orderAvailable}
              />
              {menuSearchQuery && (
                <button
                  className="menu-search-clear"
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
                    <img
                      src={menu.localImgPath || `https://mcdn.twosome.co.kr${menu.menuImg02 || menu.menuImg}`}
                      alt={menu.menuNm}
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/120?text=No+Image'; }}
                    />
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
                  <img
                    src={menu.localImgPath || `https://mcdn.twosome.co.kr${menu.menuImg02 || menu.menuImg}`}
                    alt={menu.menuNm}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/120?text=No+Image'; }}
                  />
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

        {/* 투썸 메뉴 퍼스널 옵션 — 변형 완료 + 커스텀 있을 때만 헤더 노출, 기본 접힘 아코디언 */}
        {selectedTwosomeMenu && variantInfo && customOptions && customOptions.hasCustom && (
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
            {(customOptions.qtyItems || []).map((item) => {
              const qty = selectedCustom.qty[item.key] || 0;
              return (
                <div key={item.key} className="custom-qty-row">
                  <span className="custom-qty-name">
                    {item.name}
                    <span className="custom-qty-price">(+{item.unitPrice.toLocaleString()}원)</span>
                  </span>
                  <div className="cart-qty-controls">
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() => setSelectedCustom({
                        ...selectedCustom,
                        qty: { ...selectedCustom.qty, [item.key]: Math.max(0, qty - 1) },
                      })}
                      disabled={!orderAvailable || qty <= 0}
                    >
                      -
                    </button>
                    <span className="cart-qty">{qty}</span>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() => setSelectedCustom({
                        ...selectedCustom,
                        qty: { ...selectedCustom.qty, [item.key]: Math.min(item.maxQty || 2, qty + 1) },
                      })}
                      disabled={!orderAvailable || qty >= (item.maxQty || 2)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {(customOptions.choiceGroups || []).map((group) => (
              <div key={group.groupKey} className="custom-group-block">
                <label className="custom-group-label">{group.name}</label>
                <div className="option-buttons-grid">
                  {(group.choices || []).map((choice) => (
                    <button
                      key={choice.choiceKey}
                      type="button"
                      className={`option-chip ${selectedCustom.choices[group.groupKey] === choice.choiceKey ? 'selected' : ''}`}
                      onClick={() => {
                        const current = selectedCustom.choices[group.groupKey];
                        setSelectedCustom({
                          ...selectedCustom,
                          choices: {
                            ...selectedCustom.choices,
                            [group.groupKey]: current === choice.choiceKey ? null : choice.choiceKey,
                          },
                        });
                      }}
                      disabled={!orderAvailable}
                    >
                      {choice.label}
                      {choice.price > 0 && ` (+${choice.price.toLocaleString()}원)`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
              <button
                type="button"
                className="custom-accordion-close"
                onClick={() => setCustomOptionsOpen(false)}
              >
                닫기
              </button>
            </div>
            )}
          </div>
        )}

        {/* 옵션 조회 실패 안내 (기본 코드로 주문 가능) */}
        {selectedTwosomeMenu && optionsError && (
          <div className="option-error-notice">{optionsError}</div>
        )}

        {/* 요청 사항 - 자유 텍스트 (매장 전달 코멘트) */}
        <div className="form-group">
          <label>요청 사항 (선택)</label>
          <input
            type="text"
            value={personalOption}
            onChange={(e) => setPersonalOption(e.target.value)}
            placeholder="예: 덜 달게 해주세요, 받는 시간 10분 뒤로"
            disabled={!orderAvailable}
            className="personal-option-input"
          />
        </div>

        {/* 주문 버튼 (저장 + 투썸 장바구니 담기 통합) */}
        <button
          className={`order-button ${!orderAvailable ? 'disabled' : ''}`}
          onClick={handleOrder}
          disabled={!orderAvailable || isCartLoading}
        >
          {isCartLoading
            ? '처리 중...'
            : orderCartMode && isStoreOpen
              ? `투썸 장바구니 담기 (${orderCartMode.label} 계정)`
              : '팀 주문서에 담기'}
        </button>
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
              초대코드로 PIN 설정
            </button>
          </div>
        </div>
      </Modal>

      {/* PIN 설정 모달 (초대코드 필요) */}
      <Modal
        isOpen={repModalMode === 'setup'}
        onClose={closeRepModal}
        title="PIN 설정 (최초 1회)"
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

          <label className="form-label">초대코드 (8자리)</label>
          <input
            type="text"
            value={repForm.inviteCode}
            onChange={(e) => setRepForm({ ...repForm, inviteCode: e.target.value.trim().toUpperCase() })}
            placeholder="관리자가 발급한 초대코드"
            maxLength={8}
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

      {/* 주문 변경 확인 모달 */}
      <OrderChangeModal
        isOpen={isOrderChangeModalOpen}
        onClose={() => setIsOrderChangeModalOpen(false)}
        onConfirm={handleOrderChangeConfirm}
        teamName={orderChangeData?.teamName}
        existingOrder={orderChangeData?.existing}
        newOrder={orderChangeData?.new}
      />

      {/* 재주문 확인 모달 */}
      <ReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        onConfirm={handleReorderConfirm}
        latestOrder={latestOrder}
        isLoading={isReorderLoading}
      />

      {/* 주문 통합 결과 모달 (주문 저장 + 장바구니 담기) */}
      <Modal
        isOpen={isCombinedResultOpen}
        onClose={() => setIsCombinedResultOpen(false)}
        title="주문 결과"
      >
        {combinedResult && (
          <div className="cart-result">
            <p className="cart-result-summary">주문 1건 저장</p>

            {combinedResult.cartOutcome?.type === 'cart' && (
              <>
                <p className="cart-result-summary">
                  {combinedResult.cartOutcome.owner
                    ? `${combinedResult.cartOutcome.owner} 장바구니에 담았습니다. `
                    : ''}
                  성공 {combinedResult.cartOutcome.result.success}건 / 실패 {combinedResult.cartOutcome.result.failed}건
                </p>
                <ul className="cart-result-list">
                  {combinedResult.cartOutcome.result.results.map((item, index) => (
                    <li
                      key={`${item.menuCd}-${index}`}
                      className={item.success ? 'cart-result-success' : 'cart-result-failed'}
                    >
                      <span className="cart-result-status">{item.success ? '성공' : '실패'}</span>
                      <span className="cart-result-menu">{item.menuNm || item.menuCd}</span>
                      {item.message && <span className="cart-result-message">({item.message})</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {combinedResult.cartOutcome?.type === 'no-items' && (
              <p className="cart-result-summary">장바구니에 담을 투썸 주문 항목이 없습니다.</p>
            )}

            {combinedResult.cartOutcome?.type === 'store-closed' && (
              <p className="cart-result-summary">
                팀 주문서에 담았습니다. 매장이 닫혀 있어 장바구니 담기는 불가하며, 개장 후 내역 페이지에서 일괄 담기할 수 있습니다.
              </p>
            )}

            {combinedResult.cartOutcome?.type === 'no-session' && (
              <p className="cart-result-summary">
                대표 로그인 시 장바구니까지 담깁니다. (관리 페이지의 "투썸 연동" 탭에서 로그인)
              </p>
            )}

            {combinedResult.cartOutcome?.type === 'cart-failed' && (
              <p className="cart-result-summary cart-result-failed">
                장바구니 담기 실패{combinedResult.cartOutcome.owner ? ` (${combinedResult.cartOutcome.owner})` : ''}:
                {' '}{combinedResult.cartOutcome.message}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderPage;
