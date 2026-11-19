import React, { useEffect, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { VStack } from '@astryxdesign/core/VStack';
import { DepartmentProvider, useDepartment } from './context/DepartmentContext';
import BottomSheet from './components/BottomSheet';
import ReleaseNoteModal from './components/ReleaseNoteModal';
import { releaseNoteAPI } from './services/api';
import { dismissReleaseForToday, shouldShowRelease } from './utils/releaseNotice';
import './App.css';

const OrderPage = React.lazy(() => import('./pages/OrderPage'));
const ManagePage = React.lazy(() => import('./pages/ManagePage'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));
const SuggestionPage = React.lazy(() => import('./pages/SuggestionPage'));

const pages = [
  { id: 'order', label: '주문' },
  { id: 'history', label: '내역' },
  { id: 'suggestion', label: '건의' },
  { id: 'manage', label: '설정' },
];

function AppNavigation({ currentPage, onNavigate, onDepartment, onAddDepartment }) {
  const { selectedDepartment, loading } = useDepartment();
  return (
    <TopNav
      label="주요 메뉴"
      heading={<TopNavHeading heading="허다방" superheading="COFFEE CLUB" />}
      startContent={(
        <HStack gap={1} className="app-top-nav-links">
          {pages.map((page) => (
            <TopNavItem
              key={page.id}
              label={page.label}
              href={`#${page.id}`}
              isSelected={currentPage === page.id}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(page.id);
              }}
            />
          ))}
        </HStack>
      )}
      endContent={(
        <HStack gap={1}>
          <Button
            label={loading ? '부서 확인 중' : selectedDepartment?.name || '부서 선택'}
            variant="secondary"
            size="sm"
            onClick={onDepartment}
          />
          <Button className="app-add-department" label="부서 추가" variant="ghost" size="sm" onClick={onAddDepartment} />
        </HStack>
      )}
    />
  );
}

function DepartmentList({ onSelect }) {
  const { departments, selectedDepartment } = useDepartment();
  return (
    <RadioList
      label="부서"
      isLabelHidden
      value={String(selectedDepartment?.id || '')}
      onChange={(value) => {
        const department = departments.find((item) => item.id === Number(value));
        if (department) onSelect(department);
      }}
    >
      {departments.map((department) => (
        <RadioListItem key={department.id} value={String(department.id)} label={department.name} />
      ))}
    </RadioList>
  );
}

const koreaDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function AppContent() {
  const initialParams = new URLSearchParams(window.location.search);
  const initialManageTab = initialParams.get('manageTab') || (window.location.pathname.startsWith('/admin') ? 'reps' : null);
  const [currentPage, setCurrentPage] = useState(initialParams.get('releaseNoteId') ? 'suggestion' : initialManageTab ? 'manage' : 'order');
  const [manageInitialTab, setManageInitialTab] = useState(initialManageTab);
  const [isDepartmentSheetOpen, setIsDepartmentSheetOpen] = useState(false);
  const [releaseNote, setReleaseNote] = useState(null);
  const [releaseDetailId, setReleaseDetailId] = useState(initialParams.get('releaseNoteId'));
  const { setSelectedDepartment } = useDepartment();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('releaseNoteId')) return;
    releaseNoteAPI.latest().then((note) => {
      if (!note) return;
      if (shouldShowRelease(note, localStorage, koreaDate())) setReleaseNote(note);
    }).catch((err) => console.warn('릴리즈 노트를 불러오지 못했습니다.', err));
  }, []);

  const handleReleaseDetail = () => {
    const id = releaseNote?.id;
    setReleaseNote(null);
    if (!id) return;
    setReleaseDetailId(String(id));
    setCurrentPage('suggestion');
    window.history.replaceState(null, '', `/?releaseNoteId=${encodeURIComponent(id)}`);
  };

  const dismissReleaseToday = () => {
    dismissReleaseForToday(releaseNote, localStorage, koreaDate());
    setReleaseNote(null);
  };

  const handleDepartmentSelect = (department) => {
    setSelectedDepartment(department);
    setIsDepartmentSheetOpen(false);
  };

  const openManageTab = (tab) => {
    setIsDepartmentSheetOpen(false);
    setManageInitialTab(tab);
    setCurrentPage('manage');
  };

  const navigate = (page) => {
    if (page === 'manage') setManageInitialTab(null);
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'order': return <OrderPage onAddTeamMember={() => openManageTab('team')} />;
      case 'manage': return <ManagePage initialTab={manageInitialTab} />;
      case 'history': return <HistoryPage onOrderClick={() => setCurrentPage('order')} />;
      case 'suggestion': return <SuggestionPage releaseNoteId={releaseDetailId} onReleaseNoteClosed={() => setReleaseDetailId(null)} />;
      default: return <OrderPage onAddTeamMember={() => openManageTab('team')} />;
    }
  };

  return (
    <>
      <AppShell
        height="auto"
        variant="surface"
        contentPadding={4}
        mobileNav={false}
        topNav={(
          <AppNavigation
            currentPage={currentPage}
            onNavigate={navigate}
            onDepartment={() => setIsDepartmentSheetOpen(true)}
            onAddDepartment={() => openManageTab('department')}
          />
        )}
      >
        <VStack gap={0} width="100%" maxWidth={1200} className="app-page-content">
          <React.Suspense fallback={(
            <VStack gap={2} padding={4} role="status" aria-live="polite">
              <Text type="supporting">화면을 불러오는 중...</Text>
              <Skeleton height={160} />
            </VStack>
          )}>
            {renderPage()}
          </React.Suspense>
        </VStack>
      </AppShell>
      <BottomSheet isOpen={isDepartmentSheetOpen} onClose={() => setIsDepartmentSheetOpen(false)} title="부서 선택">
        <VStack gap={3} padding={3}>
          <DepartmentList onSelect={handleDepartmentSelect} />
          <Button label="부서 추가하기" variant="secondary" onClick={() => openManageTab('department')} width="100%" />
        </VStack>
      </BottomSheet>
      <ReleaseNoteModal note={releaseNote} onClose={() => setReleaseNote(null)} onDismissToday={dismissReleaseToday} onDetail={handleReleaseDetail} />
      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={`nav-item ${currentPage === 'order' ? 'active' : ''}`} onClick={() => navigate('order')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>주문</span>
        </button>
        <button className={`nav-item ${currentPage === 'history' ? 'active' : ''}`} onClick={() => navigate('history')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>내역</span>
        </button>
        <button className={`nav-item ${currentPage === 'suggestion' ? 'active' : ''}`} onClick={() => navigate('suggestion')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>건의</span>
        </button>
        <button className={`nav-item ${currentPage === 'manage' ? 'active' : ''}`} onClick={() => navigate('manage')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>설정</span>
        </button>
      </nav>
    </>
  );
}

function App() {
  return <DepartmentProvider><AppContent /></DepartmentProvider>;
}

export default App;
