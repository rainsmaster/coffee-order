import React, { useState, useEffect } from 'react';
import { twosomeMenuAPI } from '../services/api';
import './TwosomeMenuPage.css';

function TwosomeMenuPage() {
  const [menus, setMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await twosomeMenuAPI.getAll();
      setMenus(data);
    } catch (err) {
      setError('메뉴를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      setError(null);
      const result = await twosomeMenuAPI.sync();
      setSyncResult(result);
      await fetchMenus();
    } catch (err) {
      setError('동기화에 실패했습니다.');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const categories = Object.keys(menus);
  const totalCount = Object.values(menus).reduce((sum, items) => sum + items.length, 0);

  const filteredMenus = selectedCategory === 'all'
    ? menus
    : { [selectedCategory]: menus[selectedCategory] };

  if (loading) {
    return <div className="twosome-loading">메뉴를 불러오는 중...</div>;
  }

  return (
    <div className="twosome-menu-page">
      <div className="twosome-header">
        <h2>투썸플레이스 메뉴</h2>
        <div className="twosome-actions">
          <span className="menu-count">총 {totalCount}개 메뉴</span>
          <button
            className="sync-button"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '동기화 중...' : '메뉴 동기화'}
          </button>
        </div>
      </div>

      {error && <div className="twosome-error">{error}</div>}

      {syncResult && (
        <div className="sync-result">
          {syncResult.message}
        </div>
      )}

      <div className="category-filter">
        <button
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => setSelectedCategory('all')}
        >
          전체
        </button>
        {categories.map(category => (
          <button
            key={category}
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => setSelectedCategory(category)}
          >
            {category} ({menus[category]?.length || 0})
          </button>
        ))}
      </div>

      {Object.keys(filteredMenus).length === 0 ? (
        <div className="twosome-empty">
          <p>등록된 메뉴가 없습니다.</p>
          <p>동기화 버튼을 눌러 메뉴를 가져오세요.</p>
        </div>
      ) : (
        Object.entries(filteredMenus).map(([category, items]) => (
          <div key={category} className="category-section">
            <h3 className="category-title">{category}</h3>
            <div className="menu-grid">
              {items.map(menu => (
                <div key={menu.id} className="menu-card">
                  {menu.menuImg03 && (
                    <div className="menu-image">
                      <img
                        src={menu.menuImg03}
                        alt={menu.menuNm}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="menu-info">
                    <div className="menu-name">{menu.menuNm}</div>
                    <div className="menu-name-en">{menu.enMenuNm}</div>
                    {menu.badgNm && (
                      <span className={`menu-badge ${menu.badgNm.toLowerCase()}`}>
                        {menu.badgNm}
                      </span>
                    )}
                  </div>
                  <div className="menu-meta">
                    <span className="menu-code">#{menu.menuCd}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default TwosomeMenuPage;