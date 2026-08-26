import React, { useState, useEffect, useRef, useTransition } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";
import LoadingScreen from "layouts/loading/loadingscreen";

// 탭용 서브 컴포넌트 import
import FoodBudgetTableTab from "./Operate/FoodBudgetTableTab";
import PersonCostBudgetTab from "./Operate/PersonCostBudgetTab";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// 🔹 로그인 유저의 부서/직책 코드 가져오기 (localStorage 기준)
const getUserCodes = () => {
  const dept = localStorage.getItem("department"); // ex) "2"
  const pos = localStorage.getItem("position"); // ex) "4"

  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
  };
};

// 🔹 route와 동일한 방식의 접근 권한 체크 함수
const hasAccess = (tab, deptCode, posCode) => {
  const { allowedDepartments, allowedPositions, accessMode = "AND" } = tab;

  const hasDeptCond = Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond = Array.isArray(allowedPositions) && allowedPositions.length > 0;

  // 조건이 하나도 없으면 모두 접근 허용
  if (!hasDeptCond && !hasPosCond) return true;

  const deptOk = hasDeptCond && deptCode != null ? allowedDepartments.includes(deptCode) : false;
  const posOk = hasPosCond && posCode != null ? allowedPositions.includes(posCode) : false;

  if (accessMode === "OR") {
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk; // 부서만 있을 때
    if (hasPosCond) return posOk; // 직책만 있을 때
    return true;
  } else {
    // AND: 없는 조건은 true 로 간주 (부서만 있으면 부서만 체크)
    const finalDeptOk = hasDeptCond ? deptOk : true;
    const finalPosOk = hasPosCond ? posOk : true;
    return finalDeptOk && finalPosOk;
  }
};

function OperateTabs_6() {
  const [tabIndex, setTabIndex] = useState(0);
  const [contentTabIndex, setContentTabIndex] = useState(0);
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const [, startTransition] = useTransition();
  const switchTimerRef = useRef(null);
  const TAB_SWITCH_DELAY_MS = 320;
  const { deptCode, posCode } = getUserCodes();

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

  // 부서코드: 0:대표, 1:신사업, 2:회계, 3:인사, 4:영업, 5:운영, 6:개발, 7:현장
  // 직책코드: 0:대표, 1:팀장, 2:부장, 3:차장, 4:과장, 5:대리, 6:주임, 7:사원

  // 🔹 탭 설정 + 권한 정의
  const tabConfig = [
    {
      key: "foodBudget",
      label: "🍚 식자재 예산관리",
      iconIndex: 0,
      component: <FoodBudgetTableTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 8, 9], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3], // 🔹 직책권한
      accessMode: "AND",
    },
    {
      key: "personCostBudget",
      label: "🧑‍🤝‍🧑 인건비 예산관리",
      iconIndex: 1,
      component: <PersonCostBudgetTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 8, 9], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3], // 🔹 직책권한
      accessMode: "AND",
    },
  ];

  // 🔹 현재 유저 기준으로 보여줄 탭만 필터링
  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode));

  // 🔹 권한 변경/로그인 변경 등으로 visibleTabs 길이가 줄었을 때 index 보정
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
    if (contentTabIndex >= visibleTabs.length) {
      setContentTabIndex(0);
    }
  }, [visibleTabs.length, tabIndex, contentTabIndex]);

  useEffect(
    () => () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (contentTabIndex === tabIndex && tabSwitchLoading) {
      setTabSwitchLoading(false);
    }
  }, [contentTabIndex, tabIndex, tabSwitchLoading]);

  // 🔹 권한 있는 탭이 하나도 없을 때
  if (visibleTabs.length === 0) {
    return (
      <Card sx={{ borderRadius: "16px", padding: 3 }}>
        <MDBox textAlign="center">조회 가능한 예산관리 탭이 없습니다. (권한 확인 필요)</MDBox>
      </Card>
    );
  }
  const activeTabComponent = visibleTabs[contentTabIndex]?.component ?? visibleTabs[tabIndex]?.component;

  return (
    <Card
      sx={{
        borderRadius: "16px",
        boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
        // ✅ 남은 화면 높이를 그대로 채워서 내부 표만 스크롤되게(브라우저 자체 스크롤 방지)
        height: "calc(100vh - 40px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MDBox
        sx={{
          flexShrink: 0,
          position: "sticky",
          top: 0, // 상단 고정 위치 (필요하면 56, 64 등으로 조절 가능)
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        {/* 🔹 공통 헤더 사용 */}
        <DashboardNavbar title="📑 예산관리" />
        {/* 탭 상단 */}
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
      {/* 탭 내용 (남은 공간을 채우고, 내부에서만 스크롤) */}
      <MDBox
        pt={1}
        pb={2}
        px={2}
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTabComponent}
        {tabSwitchLoading && (
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

export default OperateTabs_6;
