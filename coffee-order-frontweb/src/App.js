import React, { useState } from 'react';
import OrderPage from './pages/OrderPage';
import ManagePage from './pages/ManagePage';
import HistoryPage from './pages/HistoryPage';
import { DepartmentProvider, useDepartment } from './context/DepartmentContext';
import './App.css';

// 부서 선택 드롭다운 컴포넌트
function DepartmentSelector() {
  const { departments, selectedDepartment, setSelectedDepartment, loading } = useDepartment();

  if (loading) {
    return <span className="department-loading">로딩...</span>;
  }

  return (
    <select
      className="department-selector"
      value={selectedDepartment?.id || ''}
      onChange={(e) => {
        const dept = departments.find(d => d.id === parseInt(e.target.value));
        setSelectedDepartment(dept);
      }}
    >
      {departments.map((dept) => (
        <option key={dept.id} value={dept.id}>
          {dept.name}
        </option>
      ))}
    </select>
  );
}

// 헤더 타이틀 컴포넌트
function HeaderTitle() {
  const { selectedDepartment, loading } = useDepartment();

  if (loading) {
    return <h1>커피주문</h1>;
  }

  return <h1>{selectedDepartment?.name || ''} 커피주문</h1>;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('order');

  const renderPage = () => {
    switch (currentPage) {
      case 'order':
        return <OrderPage />;
      case 'manage':
        return <ManagePage />;
      case 'history':
        return <HistoryPage />;
      default:
        return <OrderPage />;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-left">
          <DepartmentSelector />
        </div>
        <HeaderTitle />
      </header>
      <main className="App-main">{renderPage()}</main>

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
          className={`nav-item ${currentPage === 'manage' ? 'active' : ''}`}
          onClick={() => setCurrentPage('manage')}
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
