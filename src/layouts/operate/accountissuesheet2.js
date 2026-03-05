/* eslint-disable react/function-component-definition */
import React, { useEffect, useRef, useState } from "react";
import { Card, Grid, Tabs, Tab, Box } from "@mui/material";
import MDBox from "components/MDBox";
import AccountIssueSheetTab from "examples/Tabs/Operate/accountissuesheettab";
import AccountIssueSheetStatsTab from "examples/Tabs/Operate/accountissuesheetstatstab";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";

// 기본 네비바
// import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// 사이드 네비 컨트롤
import {
  useMaterialUIController,
  setMiniSidenav,
} from "context";

// 상단 네비바 축소
import HeaderWithLogout from "components/Common/HeaderWithLogout";

export default function AccountIssueSheet2() {
  const [tabIndex, setTabIndex] = useState(0);
  const handleTabChange = (_, nextValue) => setTabIndex(nextValue);

  // 탭 접힘 index 셋팅
  const miniSidenavTabs = [0, 2]; // // 0부터 시작
  const iscommunicationIssueTab = miniSidenavTabs.includes(tabIndex);

  // 사이드 네비 컨트롤러
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav } = controller;
  const initialMiniSidenavRef = useRef(miniSidenav);

  useEffect(() => {
    // 화면 좌측 네비 고객사 이슈 탭은 default 접힘(true), 다른 탭은 펼침(false)
    setMiniSidenav(dispatch, iscommunicationIssueTab);
  }, [dispatch, iscommunicationIssueTab]);

  useEffect(
    () => () => {
      // 페이지 이탈(뒤로가기 포함) 시 진입 전 사이드바 상태 복원
      setMiniSidenav(dispatch, initialMiniSidenavRef.current);
    },
    [dispatch]
  );

  // ✅ 숫자 이모지 아이콘
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = ["고객사 이슈", "고객사 이슈통계"];

  const tabComponents = [
    <AccountIssueSheetTab key="issue" />,
    <AccountIssueSheetStatsTab key="stats" />,
  ];

  return (
    <DashboardLayout>
      {/* 기존 네비바 */}
      {/* <DashboardNavbar title="📋 고객사 소통" /> */}
      <MDBox
        sx={({ breakpoints, functions: { pxToRem }, transitions }) => ({
          [breakpoints.up("xl")]: {
            // 접힘(true)일 때만 DashboardLayout 좌측 여백(120)을 상쇄
            marginLeft: miniSidenav ? `-${pxToRem(120)}` : 0,
            // 상단바와 본문이 함께 늘어나도록 폭도 같이 보정
            width: miniSidenav ? `calc(100% + ${pxToRem(120)})` : "100%",
            transition: transitions.create(["margin-left", "width"], {
              easing: transitions.easing.easeInOut,
              duration: transitions.duration.standard,
            }),
          },
        })}
      >
        <Card
          sx={{
            borderRadius: "16px",
            boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
          }}
        >
          {/* ✅ 헤더 + 탭 전체를 sticky 영역으로 묶음 */}
          <MDBox
            sx={{
              position: "sticky",
              top: 0, // 상단 고정 위치 (필요하면 56, 64 등으로 조절 가능)
              zIndex: 10,
              backgroundColor: "#ffffff",
              borderBottom: "1px solid #eee",
            }}
          >
            {/* 상단 헤더 영역 (타이틀 + 로그아웃) */}
            {/* 🔹 공통 헤더 사용 */}
            <HeaderWithLogout showMenuButton title="📋 고객사 소통" />

            {/* 탭 상단 */}
            <Tabs
              value={tabIndex}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                backgroundColor: "#f7f7f7",
                borderRadius: "0 0 0 0",
                "& .MuiTabs-indicator": {
                  backgroundColor: "#ff9800",
                  height: "3px",
                  borderRadius: "3px",
                },
              }}
            >
              {tabLabels.map((label, index) => (
                <Tab
                  key={label}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{numberIcons[index]}</span>
                      <span>{label}</span>
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

          {/* 🔹 내용영역 → 이 부분만 스크롤됨 */}
          <MDBox p={2}>{tabComponents[tabIndex]}</MDBox>
        </Card>
      </MDBox>
    </DashboardLayout>
  );
}
