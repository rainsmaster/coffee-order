import React, { useState, useEffect, useRef } from 'react';
import { teamAPI, menuAPI, orderAPI, settingsAPI, twosomeMenuAPI } from '../services/api';
import { useDepartment } from '../context/DepartmentContext';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import OrderChangeModal from '../components/OrderChangeModal';
import ReorderModal from '../components/ReorderModal';
import useModal from '../hooks/useModal';
import './OrderPage.css';

const OrderPage = () => {
  const { selectedDepartmentId } = useDepartment();
  const [teams, setTeams] = useState([]);
  const [menus, setMenus] = useState({});
  const [twosomeMenus, setTwosomeMenus] = useState({});
  const [orders, setOrders] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [selectedTwosomeMenu, setSelectedTwosomeMenu] = useState('');
  const [twosomeMenuOptions, setTwosomeMenuOptions] = useState(null); // 온도/사이즈 옵션
  const [selectedTemperature, setSelectedTemperature] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [personalOption, setPersonalOption] = useState(''); // 텍스트 입력 옵션
  const [orderAvailable, setOrderAvailable] = useState(true);

  // 주문 변경 모달 상태
  const [isOrderChangeModalOpen, setIsOrderChangeModalOpen] = useState(false);
  const [orderChangeData, setOrderChangeData] = useState(null);

  // 재주문 모달 상태
  const [latestOrder, setLatestOrder] = useState(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isReorderLoading, setIsReorderLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState(null);

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
      loadSettings();
      checkOrderAvailable();
      resetOrderForm();
    }

    // 5초마다 주문 목록 및 주문 가능 여부 자동 새로고침 (폴링)
    const interval = setInterval(() => {
      if (selectedDepartmentId) {
        loadOrders();
        checkOrderAvailable();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDepartmentId]);

  // 현재 시간 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, menusData, twosomeMenusData, ordersData, settingsData] = await Promise.all([
        teamAPI.getAll(selectedDepartmentId),
        menuAPI.getAll(selectedDepartmentId),
        twosomeMenuAPI.getAll(),
        orderAPI.getToday(selectedDepartmentId),
        settingsAPI.get(selectedDepartmentId),
      ]);
      setTeams(teamsData);
      setMenus(menusData);
      setTwosomeMenus(twosomeMenusData);
      setOrders(ordersData);
      setSettings(settingsData);
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

  const loadSettings = async () => {
    try {
      const settingsData = await settingsAPI.get(selectedDepartmentId);
      setSettings(settingsData);
    } catch (err) {
      console.error('설정 로드 실패:', err);
    }
  };

  const checkOrderAvailable = async () => {
    try {
      const result = await settingsAPI.checkOrderAvailable(selectedDepartmentId);
      setOrderAvailable(result.available);
    } catch (err) {
      console.error('주문 가능 여부 확인 실패:', err);
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
      const isTwosome = latestOrder.menuType === 'TWOSOME';

      // 기존 주문이 있는지 확인
      const existingOrder = orders.find(
        (o) => o.teamId === parseInt(selectedTeam)
      );

      const orderData = {
        departmentId: selectedDepartmentId,
        teamId: parseInt(selectedTeam),
        menuType: isTwosome ? 'TWOSOME' : 'CUSTOM',
        menuId: isTwosome ? null : latestOrder.menuId,
        twosomeMenuId: isTwosome ? latestOrder.twosomeMenuId : null,
        personalOption: latestOrder.personalOption || null,
        orderDate: new Date().toLocaleDateString('sv-SE'),
      };

      if (existingOrder) {
        // 기존 주문이 있으면 수정
        const updatedOrder = {
          team: { id: parseInt(selectedTeam) },
          menuType: orderData.menuType,
          menu: orderData.menuType === 'CUSTOM' && orderData.menuId
            ? { id: orderData.menuId }
            : null,
          twosomeMenu: orderData.menuType === 'TWOSOME' && orderData.twosomeMenuId
            ? { id: orderData.twosomeMenuId }
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

  // 메뉴 모드 확인
  const isTwosomeMode = settings?.menuMode === 'TWOSOME';

  // 현재 선택된 메뉴 이름 가져오기
  const getSelectedMenuName = () => {
    if (isTwosomeMode && selectedTwosomeMenu) {
      // 투썸 메뉴에서 찾기
      for (const category of Object.values(twosomeMenus)) {
        const menu = category.find(m => m.id.toString() === selectedTwosomeMenu);
        if (menu) return menu.menuNm;
      }
    } else if (selectedMenu) {
      // 커스텀 메뉴에서 찾기
      for (const category of Object.values(menus)) {
        const menu = category.find(m => m.id.toString() === selectedMenu);
        if (menu) return menu.name;
      }
    }
    return '';
  };

  // 현재 선택된 팀원 이름 가져오기
  const getSelectedTeamName = () => {
    const team = teams.find(t => t.id.toString() === selectedTeam);
    return team ? team.name : '';
  };

  // 주문하기
  const handleOrder = async () => {
    const hasMenuSelected = isTwosomeMode ? selectedTwosomeMenu : selectedMenu;
    if (!selectedTeam || !hasMenuSelected) {
      showAlert('이름과 메뉴를 선택해주세요.');
      return;
    }

    // 투썸 메뉴일 경우 온도/사이즈 필수 체크
    if (isTwosomeMode && twosomeMenuOptions) {
      if (!selectedTemperature) {
        showAlert('온도를 선택해주세요.');
        return;
      }
      const availableSizes = getAvailableSizes();
      if (availableSizes.length > 0 && !selectedSize) {
        showAlert('사이즈를 선택해주세요.');
        return;
      }
    }

    // 온도/사이즈 옵션 + 퍼스널 옵션 결합
    const twosomeOptStr = getTwosomeOptionString();
    let finalOption = '';
    if (twosomeOptStr && personalOption) {
      finalOption = `${twosomeOptStr}, ${personalOption}`;
    } else {
      finalOption = twosomeOptStr || personalOption;
    }

    // 기존 주문이 있는지 확인
    const existingOrder = orders.find(
      (o) => o.teamId === parseInt(selectedTeam)
    );

    if (existingOrder) {
      // 기존 주문이 있으면 비교 팝업 표시
      const existingMenuName = existingOrder.menuType === 'TWOSOME'
        ? existingOrder.twosomeMenuName
        : existingOrder.menuName;

      setOrderChangeData({
        existingOrder: existingOrder,
        teamName: getSelectedTeamName(),
        existing: {
          menuName: existingMenuName,
          option: existingOrder.personalOption || null
        },
        new: {
          menuName: getSelectedMenuName(),
          option: finalOption || null
        },
        newOrderData: {
          menuType: isTwosomeMode ? 'TWOSOME' : 'CUSTOM',
          menuId: isTwosomeMode ? null : parseInt(selectedMenu),
          twosomeMenuId: isTwosomeMode ? parseInt(selectedTwosomeMenu) : null,
          personalOption: finalOption || null,
        }
      });
      setIsOrderChangeModalOpen(true);
      return;
    }

    // 기존 주문이 없으면 새로 생성
    try {
      const order = {
        departmentId: selectedDepartmentId,
        teamId: parseInt(selectedTeam),
        menuType: isTwosomeMode ? 'TWOSOME' : 'CUSTOM',
        menuId: isTwosomeMode ? null : parseInt(selectedMenu),
        twosomeMenuId: isTwosomeMode ? parseInt(selectedTwosomeMenu) : null,
        personalOption: finalOption || null,
        orderDate: new Date().toLocaleDateString('sv-SE'),
      };

      await orderAPI.create(order);
      showAlert('주문이 완료되었습니다!');
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '주문 실패했습니다.');
    }
  };

  // 주문 변경 확인 처리
  const handleOrderChangeConfirm = async () => {
    if (!orderChangeData) return;

    try {
      const { existingOrder, newOrderData } = orderChangeData;

      const updatedOrder = {
        team: { id: existingOrder.teamId },
        menuType: newOrderData.menuType,
        menu: newOrderData.menuType === 'CUSTOM' && newOrderData.menuId
          ? { id: newOrderData.menuId }
          : null,
        twosomeMenu: newOrderData.menuType === 'TWOSOME' && newOrderData.twosomeMenuId
          ? { id: newOrderData.twosomeMenuId }
          : null,
        personalOption: newOrderData.personalOption,
        orderDate: existingOrder.orderDate,
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
    setSelectedMenu('');
    setSelectedTwosomeMenu('');
    setTwosomeMenuOptions(null);
    setSelectedTemperature('');
    setSelectedSize('');
    setPersonalOption('');
  };

  // 카테고리 선택 시 메뉴 초기화
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedMenu('');
    setSelectedTwosomeMenu('');
    setTwosomeMenuOptions(null);
    setSelectedTemperature('');
    setSelectedSize('');
  };

  // 현재 선택된 카테고리의 메뉴 목록
  const getCurrentMenus = () => {
    if (!selectedCategory) return [];
    if (isTwosomeMode) {
      return twosomeMenus[selectedCategory] || [];
    }
    return menus[selectedCategory] || [];
  };

  // 카테고리 목록
  const getCategories = () => {
    if (isTwosomeMode) {
      return Object.keys(twosomeMenus);
    }
    return Object.keys(menus);
  };

  // 투썸 메뉴 선택 시 옵션 로드
  const handleTwosomeMenuSelect = async (menuId, menuCd) => {
    setSelectedTwosomeMenu(menuId);
    setTwosomeMenuOptions(null);
    setSelectedTemperature('');
    setSelectedSize('');

    if (menuCd) {
      try {
        const options = await twosomeMenuAPI.getOptions(menuCd);
        if (options && options.temperatures && options.temperatures.length > 0) {
          setTwosomeMenuOptions(options);
          // 첫 번째 온도 옵션 자동 선택
          setSelectedTemperature(options.temperatures[0].ondoOptCd);
        }
      } catch (err) {
        console.error('옵션 로드 실패:', err);
      }
    }
  };

  // 온도 선택 시 사이즈 초기화
  const handleTemperatureSelect = (ondoOptCd) => {
    setSelectedTemperature(ondoOptCd);
    setSelectedSize('');
  };

  // 선택된 온도의 사이즈 옵션 가져오기
  const getAvailableSizes = () => {
    if (!twosomeMenuOptions || !selectedTemperature) return [];
    const temp = twosomeMenuOptions.temperatures.find(t => t.ondoOptCd === selectedTemperature);
    return temp ? temp.sizes : [];
  };

  // 온도/사이즈 선택 문자열 생성
  const getTwosomeOptionString = () => {
    const parts = [];
    if (twosomeMenuOptions && selectedTemperature) {
      const temp = twosomeMenuOptions.temperatures.find(t => t.ondoOptCd === selectedTemperature);
      if (temp) {
        parts.push(temp.ondoOptNm);
      }
    }
    if (selectedSize) {
      const sizes = getAvailableSizes();
      const size = sizes.find(s => s.sizeOptCd === selectedSize);
      if (size) {
        parts.push(size.sizeOptNm);
      }
    }
    return parts.join('/');
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

        <div className="time-info-box">
            <p className="current-time">
              현재 시간: {currentTime.toLocaleTimeString('ko-KR', { hour12: false })}
            </p>
            {settings && !settings.is24Hours && (
              <p className="deadline-time">
                주문 마감: {settings.orderDeadlineTime?.substring(0, 5)} {orderAvailable ? '주문가능합니다' : '주문이 마감되었습니다'}
              </p>
            )}
            {settings && settings.is24Hours && (
              <p className="deadline-time">
                24시간 주문 가능 합니다
              </p>
            )}
        </div>

        <div className="form-group">
          <label>이름 선택</label>
          <select
            value={selectedTeam}
            onChange={(e) => handleTeamSelect(e.target.value)}
            disabled={!orderAvailable}
          >
            <option value="">선택하세요</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* 최근 주문 표시 */}
        {latestOrder && orderAvailable && (() => {
          // 메뉴 모드 일치 여부 확인
          const currentMode = isTwosomeMode ? 'TWOSOME' : 'CUSTOM';
          const latestMode = latestOrder.menuType || 'CUSTOM';
          const isModeMatch = currentMode === latestMode;

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
                  {latestOrder.menuType === 'TWOSOME'
                    ? latestOrder.twosomeMenuName
                    : latestOrder.menuName}
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
                title={!isModeMatch ? `현재 ${isTwosomeMode ? '투썸' : '커스텀'} 메뉴 모드에서는 사용할 수 없습니다` : ''}
              >
                다시 주문
              </button>
            </div>
          );
        })()}

        {/* 1단계: 카테고리 선택 */}
        <div className="form-group">
          <label>카테고리 선택 {isTwosomeMode && <span className="mode-badge">투썸 메뉴</span>}</label>
          <div className="category-buttons">
            {getCategories().map((category) => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'selected' : ''}`}
                onClick={() => handleCategorySelect(category)}
                disabled={!orderAvailable}
              >
                {category}
                {isTwosomeMode && twosomeMenus[category] && (
                  <span className="category-count">({twosomeMenus[category].length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2단계: 메뉴 선택 (카테고리 선택 후 표시) */}
        {selectedCategory && (
          <div className="form-group">
            <label>메뉴 선택</label>

            {/* CUSTOM 모드 */}
            {!isTwosomeMode && (
              <div className="menu-grid">
                {getCurrentMenus().map((menu) => (
                  <button
                    key={menu.id}
                    className={`menu-item ${
                      selectedMenu === menu.id.toString() ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedMenu(menu.id.toString())}
                    disabled={!orderAvailable}
                  >
                    {menu.name}
                  </button>
                ))}
              </div>
            )}

            {/* TWOSOME 모드 */}
            {isTwosomeMode && (
              <div className="twosome-card-grid">
                {getCurrentMenus().map((menu) => (
                  <button
                    key={menu.id}
                    className={`twosome-card ${
                      selectedTwosomeMenu === menu.id.toString() ? 'selected' : ''
                    }`}
                    onClick={() => handleTwosomeMenuSelect(menu.id.toString(), menu.menuCd)}
                    disabled={!orderAvailable}
                  >
                    <img
                      src={menu.localImgPath || `https://mcdn.twosome.co.kr${menu.menuImg02 || menu.menuImg}`}
                      alt={menu.menuNm}
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/120?text=No+Image'; }}
                    />
                    <span className="twosome-card-name">{menu.menuNm}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 투썸 메뉴 온도/사이즈 선택 */}
        {isTwosomeMode && selectedTwosomeMenu && twosomeMenuOptions && (
          <div className="form-group twosome-options">
            {/* 온도 선택 */}
            <label>온도 선택</label>
            <div className="option-buttons-grid">
              {twosomeMenuOptions.temperatures.map((temp) => (
                <button
                  key={temp.ondoOptCd}
                  className={`option-chip ${selectedTemperature === temp.ondoOptCd ? 'selected' : ''}`}
                  onClick={() => handleTemperatureSelect(temp.ondoOptCd)}
                  disabled={!orderAvailable}
                >
                  {temp.ondoOptNm}
                </button>
              ))}
            </div>

            {/* 사이즈 선택 */}
            {selectedTemperature && getAvailableSizes().length > 0 && (
              <>
                <label style={{ marginTop: '0.75rem' }}>사이즈 선택</label>
                <div className="option-buttons-grid">
                  {getAvailableSizes().map((size) => (
                    <button
                      key={size.sizeOptCd}
                      className={`option-chip ${selectedSize === size.sizeOptCd ? 'selected' : ''}`}
                      onClick={() => setSelectedSize(size.sizeOptCd)}
                      disabled={!orderAvailable}
                    >
                      {size.sizeOptNm}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 선택된 옵션 표시 */}
            {getTwosomeOptionString() && (
              <div className="option-display" style={{ marginTop: '0.5rem' }}>
                선택: {getTwosomeOptionString()}
              </div>
            )}
          </div>
        )}

        {/* 퍼스널 옵션 - 텍스트 입력 */}
        <div className="form-group">
          <label>퍼스널 옵션 (선택)</label>
          <input
            type="text"
            value={personalOption}
            onChange={(e) => setPersonalOption(e.target.value)}
            placeholder="예: 샷 추가, 얼음 적게, 시럽 빼기"
            disabled={!orderAvailable}
            className="personal-option-input"
          />
        </div>

        {/* 주문 버튼 */}
        <button
          className={`order-button ${!orderAvailable ? 'disabled' : ''}`}
          onClick={handleOrder}
          disabled={!orderAvailable}
        >
          {orderAvailable ? '주문하기' : '주문 마감되었습니다'}
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
    </div>
  );
};

export default OrderPage;
