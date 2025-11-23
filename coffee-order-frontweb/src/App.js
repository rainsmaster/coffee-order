import React, { useState } from 'react';
import OrderPage from './pages/OrderPage';
import ManagePage from './pages/ManagePage';
import HistoryPage from './pages/HistoryPage';
import './App.css';

function App() {
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
        <h1>상품서비스개발팀 커피주문</h1>
        <nav className="App-nav">
          <button
            className={currentPage === 'order' ? 'active' : ''}
            onClick={() => setCurrentPage('order')}
          >
            주문하기
          </button>
          <button
            className={currentPage === 'manage' ? 'active' : ''}
            onClick={() => setCurrentPage('manage')}
          >
            관리
          </button>
          <button
            className={currentPage === 'history' ? 'active' : ''}
            onClick={() => setCurrentPage('history')}
          >
            주문내역
          </button>
        </nav>
      </header>
      <main className="App-main">{renderPage()}</main>
    </div>
  );
}

export default App;
