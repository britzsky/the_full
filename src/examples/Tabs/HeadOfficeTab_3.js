import React, { useState, useEffect, useRef, useTransition } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";
import LoadingScreen from "layouts/loading/loadingscreen";

import HeadofficeScheduleSheetTab from "./HeadOffice/HeadofficeScheduleSheetTab";
import HeadofficeScheduleStatTab from "./HeadOffice/headofficeScheduleStatTab";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// 로그인 사용자 부서/직책 권한 코드
const getUserCodes = () => {
  const dept = localStorage.getItem("department");
  const pos = localStorage.getItem("position");
  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
  };
};

// 탭별 부서/직책 접근 권한 판정
const hasAccess = (tab, deptCode, posCode) => {
  const { allowedDepartments, allowedPositions, accessMode = "AND" } = tab;
  const hasDeptCond = Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond = Array.isArray(allowedPositions) && allowedPositions.length > 0;
  if (!hasDeptCond && !hasPosCond) return true;
  const deptOk = hasDeptCond && deptCode != null ? allowedDepartments.includes(deptCode) : false;
  const posOk = hasPosCond && posCode != null ? allowedPositions.includes(posCode) : false;
  if (accessMode === "OR") {
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk;
    if (hasPosCond) return posOk;
    return true;
  } else {
    const finalDeptOk = hasDeptCond ? deptOk : true;
    const finalPosOk = hasPosCond ? posOk : true;
    return finalDeptOk && finalPosOk;
  }
};

function HeadOfficeTab_3() {
  // 상단 탭 선택 상태
  const [tabIndex, setTabIndex] = useState(0);
  // 실제 화면에 표시되는 탭 내용 상태
  const [contentTabIndex, setContentTabIndex] = useState(0);
  // 탭 전환 중 로딩 화면 상태
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const [, startTransition] = useTransition();
  // 탭 전환 지연 타이머 참조
  const switchTimerRef = useRef(null);
  const TAB_SWITCH_DELAY_MS = 320;
  const { deptCode, posCode } = getUserCodes();

  // 탭 선택 변경 처리
  const handleTabChange = (_, newValue) => {
    if (newValue === tabIndex) return;

    setTabIndex(newValue);
    setTabSwitchLoading(true);

    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setContentTabIndex(newValue);
      });
    }, TAB_SWITCH_DELAY_MS);
  };

  // 본사 일정관리 탭 구성
  const tabConfig = [
    {
      key: "scheduleSheet",
      label: "📅 급식사업부 일정관리",
      component: <HeadofficeScheduleSheetTab />,
    },
    {
      key: "scheduleStat",
      label: "📊 일정 통계",
      component: <HeadofficeScheduleStatTab />,
    },
  ];

  // 사용자 권한 기준 노출 탭 목록
  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode));

  // 권한 변경 시 선택 탭 보정
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
    if (contentTabIndex >= visibleTabs.length) {
      setContentTabIndex(0);
    }
  }, [visibleTabs.length, tabIndex, contentTabIndex]);

  // 탭 전환 타이머 정리
  useEffect(
    () => () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    },
    []
  );

  // 탭 내용 전환 완료 후 로딩 해제
  useEffect(() => {
    if (contentTabIndex === tabIndex && tabSwitchLoading) {
      setTabSwitchLoading(false);
    }
  }, [contentTabIndex, tabIndex, tabSwitchLoading]);

  // 접근 가능한 탭 없음 안내
  if (visibleTabs.length === 0) {
    return (
      <Card sx={{ borderRadius: "16px", padding: 3 }}>
        <MDBox textAlign="center">조회 가능한 탭이 없습니다. (권한 확인 필요)</MDBox>
      </Card>
    );
  }
  // 현재 선택 탭 내용 컴포넌트
  const activeTabComponent = visibleTabs[contentTabIndex]?.component ?? visibleTabs[tabIndex]?.component;

  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      {/* 상단 내비게이션 및 탭 영역 */}
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="📅 급식사업부 일정관리" />
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            backgroundColor: "#f7f7f7",
            borderRadius: "16px 16px 0 0",
            "& .MuiTabs-indicator": {
              backgroundColor: "#ff9800",
              height: "3px",
              borderRadius: "3px",
            },
          }}
        >
          {visibleTabs.map((tab, index) => (
            <Tab
              key={tab.key}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <span>{tab.label}</span>
                </Box>
              }
              sx={{
                fontSize: "0.8rem",
                minWidth: 120,
                textTransform: "none",
                color: tabIndex === index ? "#ff9800" : "#666",
                fontWeight: "bold",
                transition: "0.2s",
                "&:hover": {
                  color: "#ff9800",
                  opacity: 0.8,
                },
              }}
            />
          ))}
        </Tabs>
      </MDBox>
      {/* 선택 탭 내용 영역 */}
      <MDBox p={0.5} sx={{ position: "relative" }}>
        {activeTabComponent}
        {tabSwitchLoading && (
          /* 탭 전환 로딩 오버레이 */
          <MDBox
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              "& .loading-container": {
                height: "100%",
              },
            }}
          >
            <LoadingScreen />
          </MDBox>
        )}
      </MDBox>
    </Card>
  );
}

export default HeadOfficeTab_3;
