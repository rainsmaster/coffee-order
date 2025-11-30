import React, { useState, useEffect } from 'react';
import { teamAPI, menuAPI, orderAPI, settingsAPI, twosomeMenuAPI, personalOptionAPI } from '../services/api';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import useModal from '../hooks/useModal';
import './OrderPage.css';

const OrderPage = () => {
  const [teams, setTeams] = useState([]);
  const [menus, setMenus] = useState({});
  const [twosomeMenus, setTwosomeMenus] = useState({});
  const [personalOptions, setPersonalOptions] = useState({});
  const [orders, setOrders] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [selectedTwosomeMenu, setSelectedTwosomeMenu] = useState('');
  const [twosomeMenuOptions, setTwosomeMenuOptions] = useState(null); // 온도/사이즈 옵션
  const [selectedTemperature, setSelectedTemperature] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [personalOption, setPersonalOption] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderAvailable, setOrderAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState(null);

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

  // 데이터 로드
  useEffect(() => {
    loadData();
    loadSettings();
    checkOrderAvailable();

    // 5초마다 주문 목록 및 주문 가능 여부 자동 새로고침 (폴링)
    const interval = setInterval(() => {
      loadOrders();
      checkOrderAvailable();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
      const [teamsData, menusData, twosomeMenusData, ordersData, optionsData, settingsData] = await Promise.all([
        teamAPI.getAll(),
        menuAPI.getAll(),
        twosomeMenuAPI.getAll(),
        orderAPI.getToday(),
        personalOptionAPI.getAll(),
        settingsAPI.get(),
      ]);
      setTeams(teamsData);
      setMenus(menusData);
      setTwosomeMenus(twosomeMenusData);
      setOrders(ordersData);
      setPersonalOptions(optionsData);
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
      const ordersData = await orderAPI.getToday();
      setOrders(ordersData);
    } catch (err) {
      console.error('주문 목록 새로고침 실패:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const settingsData = await settingsAPI.get();
      setSettings(settingsData);
    } catch (err) {
      console.error('설정 로드 실패:', err);
    }
  };

  const checkOrderAvailable = async () => {
    try {
      const result = await settingsAPI.checkOrderAvailable();
      setOrderAvailable(result.available);
    } catch (err) {
      console.error('주문 가능 여부 확인 실패:', err);
    }
  };

  // 메뉴 모드 확인
  const isTwosomeMode = settings?.menuMode === 'TWOSOME';

  // 퍼스널 옵션 토글
  const toggleOption = (optionName) => {
    setSelectedOptions((prev) => {
      if (prev.includes(optionName)) {
        return prev.filter((o) => o !== optionName);
      } else {
        return [...prev, optionName];
      }
    });
  };

  // 선택된 옵션들을 문자열로 변환
  const getPersonalOptionString = () => {
    if (selectedOptions.length > 0) {
      return selectedOptions.join(', ');
    }
    return personalOption || '';
  };

  // 주문하기
  const handleOrder = async () => {
    const hasMenuSelected = isTwosomeMode ? selectedTwosomeMenu : selectedMenu;
    if (!selectedTeam || !hasMenuSelected) {
      showAlert('이름과 메뉴를 선택해주세요.');
      return;
    }

    try {
      // 퍼스널 옵션 + 투썸 온도/사이즈 옵션 결합
      const personalOptStr = getPersonalOptionString();
      const twosomeOptStr = getTwosomeOptionString();
      let finalOption = '';
      if (twosomeOptStr && personalOptStr) {
        finalOption = `${twosomeOptStr}, ${personalOptStr}`;
      } else {
        finalOption = twosomeOptStr || personalOptStr;
      }

      const order = {
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
      if (err.message.includes('이미 오늘 주문하셨습니다')) {
        showConfirm('이미 주문하셨습니다. 수정하시겠습니까?', () => {
          const existingOrder = orders.find(
            (o) => o.teamId === parseInt(selectedTeam)
          );
          if (existingOrder) {
            handleEditOrder(existingOrder);
          }
        });
      } else {
        showAlert(err.message || '주문 실패했습니다.');
      }
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
    setSelectedOptions([]);
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

  // 주문 수정
  const handleEditOrder = (order) => {
    setEditingOrder(order);
    // 메뉴 타입에 따라 적절한 상태 설정
    if (order.menuType === 'TWOSOME' && order.twosomeMenuId) {
      setSelectedTwosomeMenu(order.twosomeMenuId.toString());
      setSelectedMenu('');
      // 카테고리 설정
      setSelectedCategory(order.twosomeMenuCategory || '');
    } else if (order.menuId) {
      setSelectedMenu(order.menuId.toString());
      setSelectedTwosomeMenu('');
      // 카테고리 설정
      setSelectedCategory(order.menuCategory || '');
    }
    setPersonalOption(order.personalOption || '');
    setSelectedOptions(order.personalOption ? order.personalOption.split(', ') : []);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async () => {
    try {
      // 퍼스널 옵션 + 투썸 온도/사이즈 옵션 결합
      const personalOptStr = getPersonalOptionString();
      const twosomeOptStr = getTwosomeOptionString();
      let finalOption = '';
      if (twosomeOptStr && personalOptStr) {
        finalOption = `${twosomeOptStr}, ${personalOptStr}`;
      } else {
        finalOption = twosomeOptStr || personalOptStr;
      }

      const updatedOrder = {
        team: { id: editingOrder.teamId },
        menuType: isTwosomeMode ? 'TWOSOME' : 'CUSTOM',
        menu: isTwosomeMode ? null : { id: parseInt(selectedMenu) },
        twosomeMenu: isTwosomeMode ? { id: parseInt(selectedTwosomeMenu) } : null,
        personalOption: finalOption || null,
        orderDate: editingOrder.orderDate,
      };

      await orderAPI.update(editingOrder.id, updatedOrder);
      showAlert('주문이 수정되었습니다!');
      setIsEditModalOpen(false);
      setEditingOrder(null);
      resetOrderForm();
      loadOrders();
    } catch (err) {
      showAlert(err.message || '수정 실패했습니다.');
    }
  };

  // 주문 삭제
  const handleDeleteOrder = async (orderId) => {
    showConfirm('주문을 취소하시겠습니까?', async () => {
      try {
        await orderAPI.delete(orderId);
        showAlert('주문이 취소되었습니다.');
        loadOrders();
      } catch (err) {
        showAlert('삭제 실패했습니다.');
      }
    });
  };

  // 메뉴별 집계
  const getMenuSummary = () => {
    const summary = {};
    orders.forEach((order) => {
      // 메뉴 타입에 따라 메뉴 이름 가져오기
      const menuName = order.menuType === 'TWOSOME'
        ? order.twosomeMenuName
        : order.menuName;

      if (!menuName) return;

      if (!summary[menuName]) {
        summary[menuName] = { count: 0, options: {} };
      }
      summary[menuName].count++;

      if (order.personalOption) {
        const optionKey = order.personalOption;
        summary[menuName].options[optionKey] =
          (summary[menuName].options[optionKey] || 0) + 1;
      }
    });
    return summary;
  };

  const menuSummary = getMenuSummary();

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="order-page">
      {error && <div className="error-message">{error}</div>}

      {/* 주문 폼 */}
      <div className="order-form-card">
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
            onChange={(e) => setSelectedTeam(e.target.value)}
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
            <label>
              메뉴 선택
              <button
                className="category-back-btn"
                onClick={() => handleCategorySelect('')}
              >
                ← 카테고리 다시 선택
              </button>
            </label>

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

        {/* 퍼스널 옵션 - 동적 옵션이 있으면 버튼형 UI, 없으면 기존 텍스트 입력 */}
        <div className="form-group">
          <label>퍼스널 옵션</label>
          {Object.keys(personalOptions).length > 0 ? (
            <>
              {Object.entries(personalOptions).map(([category, options]) => (
                <div key={category} className="option-category">
                  <div className="option-category-title">{category}</div>
                  <div className="option-buttons-grid">
                    {options.map((opt) => (
                      <button
                        key={opt.id}
                        className={`option-chip ${selectedOptions.includes(opt.name) ? 'selected' : ''}`}
                        onClick={() => toggleOption(opt.name)}
                        disabled={!orderAvailable}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {selectedOptions.length > 0 && (
                <div className="option-display">
                  선택된 옵션: {selectedOptions.join(', ')}
                  <button
                    className="option-clear"
                    onClick={() => setSelectedOptions([])}
                  >
                    X
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                className="option-button"
                onClick={() => setIsOptionModalOpen(true)}
                disabled={!orderAvailable}
              >
                {personalOption ? '퍼스널 옵션 수정' : '+ 퍼스널 옵션 추가'}
              </button>
              {personalOption && (
                <div className="option-display">
                  옵션: {personalOption}
                  <button
                    className="option-clear"
                    onClick={() => setPersonalOption('')}
                  >
                    X
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <button
          className={`order-button ${!orderAvailable ? 'disabled' : ''}`}
          onClick={handleOrder}
          disabled={!orderAvailable}
        >
          {orderAvailable ? '주문하기' : '주문 마감되었습니다'}
        </button>
      </div>

      {/* 오늘의 주문 현황 */}
      <div className="orders-section">
        <h3>오늘의 주문 현황 ({orders.length}건)</h3>
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-item">
              <div className="order-info">
                <strong>{order.teamName}</strong> -{' '}
                {order.menuType === 'TWOSOME' ? order.twosomeMenuName : order.menuName}
                {order.personalOption && (
                  <div className="order-option">옵션: {order.personalOption}</div>
                )}
              </div>
              <div className="order-actions">
                <button
                  className="btn-edit"
                  onClick={() => handleEditOrder(order)}
                  disabled={!orderAvailable}
                >
                  수정
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴별 집계 */}
      <div className="summary-section">
        <h3>메뉴별 집계</h3>
        <div className="summary-list">
          {Object.entries(menuSummary).map(([menuName, data]) => (
            <div key={menuName} className="summary-item">
              <div className="summary-name">
                {menuName} x {data.count}
              </div>
              {Object.entries(data.options).map(([option, count]) => (
                <div key={option} className="summary-option">
                  └ 옵션: {option} x {count}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 퍼스널 옵션 모달 */}
      <Modal
        isOpen={isOptionModalOpen}
        onClose={() => setIsOptionModalOpen(false)}
        title="퍼스널 옵션"
      >
        <div className="modal-form">
          <label>옵션 내용</label>
          <textarea
            value={personalOption}
            onChange={(e) => setPersonalOption(e.target.value)}
            placeholder="예: 샷 추가, 얼음 빼기, 아로마노트로 변경"
            rows="4"
          />
          <div className="modal-buttons">
            <button
              className="btn-primary"
              onClick={() => setIsOptionModalOpen(false)}
            >
              확인
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setPersonalOption('');
                setIsOptionModalOpen(false);
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>

      {/* 주문 수정 모달 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingOrder(null);
          resetOrderForm();
        }}
        title="주문 수정"
      >
        <div className="modal-form">
          {/* 1단계: 카테고리 선택 */}
          <div className="form-group">
            <label>카테고리 선택</label>
            <div className="category-buttons">
              {getCategories().map((category) => (
                <button
                  key={category}
                  className={`category-btn ${selectedCategory === category ? 'selected' : ''}`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* 2단계: 메뉴 선택 */}
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
                    >
                      {menu.name}
                    </button>
                  ))}
                </div>
              )}

              {/* TWOSOME 모드 */}
              {isTwosomeMode && (
                <div className="twosome-card-grid modal-grid">
                  {getCurrentMenus().map((menu) => (
                    <button
                      key={menu.id}
                      className={`twosome-card ${
                        selectedTwosomeMenu === menu.id.toString() ? 'selected' : ''
                      }`}
                      onClick={() => handleTwosomeMenuSelect(menu.id.toString(), menu.menuCd)}
                    >
                      <img
                        src={menu.localImgPath || `https://mcdn.twosome.co.kr${menu.menuImg02 || menu.menuImg}`}
                        alt={menu.menuNm}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=No+Image'; }}
                      />
                      <span className="twosome-card-name">{menu.menuNm}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 투썸 메뉴 온도/사이즈 선택 (모달용) */}
          {isTwosomeMode && selectedTwosomeMenu && twosomeMenuOptions && (
            <div className="form-group twosome-options">
              <label>온도 선택</label>
              <div className="option-buttons-grid">
                {twosomeMenuOptions.temperatures.map((temp) => (
                  <button
                    key={temp.ondoOptCd}
                    className={`option-chip ${selectedTemperature === temp.ondoOptCd ? 'selected' : ''}`}
                    onClick={() => handleTemperatureSelect(temp.ondoOptCd)}
                  >
                    {temp.ondoOptNm}
                  </button>
                ))}
              </div>
              {selectedTemperature && getAvailableSizes().length > 0 && (
                <>
                  <label style={{ marginTop: '0.75rem' }}>사이즈 선택</label>
                  <div className="option-buttons-grid">
                    {getAvailableSizes().map((size) => (
                      <button
                        key={size.sizeOptCd}
                        className={`option-chip ${selectedSize === size.sizeOptCd ? 'selected' : ''}`}
                        onClick={() => setSelectedSize(size.sizeOptCd)}
                      >
                        {size.sizeOptNm}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label>퍼스널 옵션</label>
            {Object.keys(personalOptions).length > 0 ? (
              <>
                {Object.entries(personalOptions).map(([category, options]) => (
                  <div key={category} className="option-category">
                    <div className="option-category-title">{category}</div>
                    <div className="option-buttons-grid">
                      {options.map((opt) => (
                        <button
                          key={opt.id}
                          className={`option-chip ${selectedOptions.includes(opt.name) ? 'selected' : ''}`}
                          onClick={() => toggleOption(opt.name)}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <textarea
                value={personalOption}
                onChange={(e) => setPersonalOption(e.target.value)}
                placeholder="예: 샷 추가, 얼음 빼기"
                rows="3"
              />
            )}
          </div>

          <div className="modal-buttons">
            <button className="btn-primary" onClick={handleUpdateOrder}>
              수정 완료
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingOrder(null);
                resetOrderForm();
              }}
            >
              취소
            </button>
          </div>
        </div>
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

export default OrderPage;
