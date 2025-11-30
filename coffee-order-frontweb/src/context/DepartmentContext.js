import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { departmentAPI } from '../services/api';

// 쿠키 유틸리티 함수
const COOKIE_NAME = 'selectedDepartmentId';
const COOKIE_EXPIRY_DAYS = 365;

const setCookie = (name, value, days) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

// Context 생성
const DepartmentContext = createContext();

// Provider 컴포넌트
export const DepartmentProvider = ({ children }) => {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartmentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 부서 목록 로드
  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await departmentAPI.getAll();
      setDepartments(data);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to load departments:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기화: 부서 목록 로드 및 쿠키에서 선택된 부서 복원
  useEffect(() => {
    const initialize = async () => {
      const deptList = await loadDepartments();

      if (deptList.length > 0) {
        // 쿠키에서 저장된 부서 ID 읽기
        const savedDeptId = getCookie(COOKIE_NAME);

        if (savedDeptId) {
          // 저장된 부서가 목록에 있는지 확인
          const savedDept = deptList.find(d => d.id === parseInt(savedDeptId));
          if (savedDept) {
            setSelectedDepartmentState(savedDept);
          } else {
            // 저장된 부서가 없으면 첫 번째 부서 선택
            setSelectedDepartmentState(deptList[0]);
            setCookie(COOKIE_NAME, deptList[0].id, COOKIE_EXPIRY_DAYS);
          }
        } else {
          // 쿠키가 없으면 첫 번째 부서 선택
          setSelectedDepartmentState(deptList[0]);
          setCookie(COOKIE_NAME, deptList[0].id, COOKIE_EXPIRY_DAYS);
        }
      }
    };

    initialize();
  }, [loadDepartments]);

  // 부서 선택 함수
  const setSelectedDepartment = useCallback((department) => {
    setSelectedDepartmentState(department);
    if (department) {
      setCookie(COOKIE_NAME, department.id, COOKIE_EXPIRY_DAYS);
    }
  }, []);

  // 부서 목록 새로고침
  const refreshDepartments = useCallback(async () => {
    await loadDepartments();
  }, [loadDepartments]);

  const value = {
    departments,
    selectedDepartment,
    selectedDepartmentId: selectedDepartment?.id,
    setSelectedDepartment,
    loading,
    error,
    refreshDepartments,
  };

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  );
};

// Custom Hook
export const useDepartment = () => {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartment must be used within a DepartmentProvider');
  }
  return context;
};

export default DepartmentContext;
