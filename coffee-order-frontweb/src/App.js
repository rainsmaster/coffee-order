import React, { useState } from 'react';
import OrderPage from './pages/OrderPage';
import ManagePage from './pages/ManagePage';
import HistoryPage from './pages/HistoryPage';
import SuggestionPage from './pages/SuggestionPage';
import { DepartmentProvider, useDepartment } from './context/DepartmentContext';
import BottomSheet from './components/BottomSheet';
import './App.css';

// 헤더 타이틀 컴포넌트 (터치하면 부서 선택 바텀시트 열림)
function HeaderTitle({ onTap }) {
  const { selectedDepartment, loading } = useDepartment();

  if (loading) {
    return <h1 className="header-title">커피주문</h1>;
  }

  return (
    <button className="header-title-button" onClick={onTap}>
      <span className="header-title-text">
        {selectedDepartment?.name || ''} 커피주문
      </span>
      <svg
        className="header-title-arrow"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// 부서 선택 바텀시트 내용
function DepartmentList({ onSelect, onAddTeam }) {
  const { departments, selectedDepartment } = useDepartment();

  return (
    <>
      {departments.map((dept) => (
        <button
          key={dept.id}
          className={`department-list-item ${selectedDepartment?.id === dept.id ? 'selected' : ''}`}
          onClick={() => onSelect(dept)}
        >
          <span>{dept.name}</span>
          {selectedDepartment?.id === dept.id && (
            <span className="check-icon">✓</span>
          )}
        </button>
      ))}
      <button className="department-list-item add-team" onClick={onAddTeam}>
        <span className="add-team-content">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="add-icon"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          부서 추가하기
        </span>
      </button>
    </>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('order');
  const [manageInitialTab, setManageInitialTab] = useState(null);
  const [isDepartmentSheetOpen, setIsDepartmentSheetOpen] = useState(false);
  const { setSelectedDepartment } = useDepartment();

  const handleDepartmentSelect = (dept) => {
    setSelectedDepartment(dept);
    setIsDepartmentSheetOpen(false);
  };

  const handleAddTeam = () => {
    setIsDepartmentSheetOpen(false);
    setManageInitialTab('department');
    setCurrentPage('manage');
  };

  const handleAddTeamMember = () => {
    setManageInitialTab('team');
    setCurrentPage('manage');
  };

  const handleAddMenu = () => {
    setManageInitialTab('settings');
    setCurrentPage('manage');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'order':
        return <OrderPage onAddTeamMember={handleAddTeamMember} onAddMenu={handleAddMenu} />;
      case 'manage':
        return <ManagePage initialTab={manageInitialTab} />;
      case 'history':
        return <HistoryPage />;
      case 'suggestion':
        return <SuggestionPage />;
      default:
        return <OrderPage />;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <HeaderTitle onTap={() => setIsDepartmentSheetOpen(true)} />
      </header>
      <main className="App-main">{renderPage()}</main>

      {/* 부서 선택 바텀시트 */}
      <BottomSheet
        isOpen={isDepartmentSheetOpen}
        onClose={() => setIsDepartmentSheetOpen(false)}
        title="부서 선택"
      >
        <DepartmentList onSelect={handleDepartmentSelect} onAddTeam={handleAddTeam} />
      </BottomSheet>

      {/* 하단 고정 네비게이션 */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${currentPage === 'order' ? 'active' : ''}`}
          onClick={() => setCurrentPage('order')}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>주문</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentPage('history')}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>내역</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'suggestion' ? 'active' : ''}`}
          onClick={() => setCurrentPage('suggestion')}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>건의</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'manage' ? 'active' : ''}`}
          onClick={() => {
            setManageInitialTab(null);
            setCurrentPage('manage');
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>설정</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  return (
    <DepartmentProvider>
      <AppContent />
    </DepartmentProvider>
  );
}

export default App;
