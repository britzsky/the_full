import React, { useState, useEffect } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";

import AccountReceiptTab from "./Accounting/AccountReceiptTab";
import CoupangReceiptTab from "./Accounting/CoupangReceiptTab";
import CorpCardReceiptArchiveTab from "./Accounting/CorpCardReceiptArchiveTab";
import SiteCorpCardReceiptArchiveTab from "./Accounting/SiteCorpCardReceiptArchiveTab";
import PersonPurchaseReceiptArchiveTab from "./Accounting/PersonPurchaseReceiptArchiveTab";

// 로그인 유저의 부서/직책 코드를 localStorage에서 가져오는 함수
const getUserCodes = () => {
  const dept = localStorage.getItem("department");
  const pos = localStorage.getItem("position");

  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
  };
};

// 탭별 부서/직책 조건으로 접근 가능 여부를 판단하는 함수 (route 권한 체크와 동일 방식)
const hasAccess = (tab, deptCode, posCode) => {
  const { allowedDepartments, allowedPositions, accessMode = "AND" } = tab;

  const hasDeptCond =
    Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond =
    Array.isArray(allowedPositions) && allowedPositions.length > 0;

  // 조건이 하나도 없으면 모두 접근 허용
  if (!hasDeptCond && !hasPosCond) return true;

  const deptOk =
    hasDeptCond && deptCode != null
      ? allowedDepartments.includes(deptCode)
      : false;
  const posOk =
    hasPosCond && posCode != null
      ? allowedPositions.includes(posCode)
      : false;

  if (accessMode === "OR") {
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk;
    if (hasPosCond) return posOk;
    return true;
  } else {
    // AND: 없는 조건은 통과로 간주
    const finalDeptOk = hasDeptCond ? deptOk : true;
    const finalPosOk = hasPosCond ? posOk : true;
    return finalDeptOk && finalPosOk;
  }
};

function AccountingTab_2() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const { deptCode, posCode } = getUserCodes();

  // 직책 -> (0: 대표, 1: 팀장, 2: 파트장, 3: 매니저)
  // 부서 -> (0: 대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀, 6: 개발팀, 7: 현장, 8: 급식사업부, 9: 기획팀)

  // 탭 목록과 탭별 접근 권한 정의
  const tabConfig = [
    {
      key: "receipt",
      label: "거래처 마감 자료",
      component: <AccountReceiptTab />,
      allowedDepartments: [0, 2, 6, 9], // 부서권한
      allowedPositions: [0, 1, 2, 3], // 직책권한
      accessMode: "AND",
    },
    {
      key: "coupang",
      label: "영수증 등록(본사 법인카드)",
      component: <CoupangReceiptTab />,
      allowedDepartments: [0, 2, 6, 5, 9], // 부서권한
      allowedPositions: [0, 1, 2, 3], // 직책권한
      accessMode: "AND",
    },
    {
      key: "corpcard-archive",
      label: "영수증 마감 자료(본사 법인카드)",
      component: <CorpCardReceiptArchiveTab />,
      allowedDepartments: [0, 2, 6, 9], // 부서권한
      allowedPositions: [0, 1, 2, 3], // 직책권한
      accessMode: "AND",
    },
    {
      key: "site-corpcard-archive",
      label: "영수증 마감 자료(현장 법인카드)",
      component: <SiteCorpCardReceiptArchiveTab />,
      allowedDepartments: [0, 2, 6, 9], // 부서권한
      allowedPositions: [0, 1, 2, 3], // 직책권한
      accessMode: "AND",
    },
    {
      key: "person-purchase-archive",
      label: "영수증 마감 자료(개인구매)",
      component: <PersonPurchaseReceiptArchiveTab />,
      allowedDepartments: [0, 2, 6, 9], // 부서권한
      allowedPositions: [0, 1, 2, 3], // 직책권한
      accessMode: "AND",
    },
  ];

  // 현재 유저 권한으로 볼 수 있는 탭 목록
  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode));

  // 보이는 탭 수가 줄어 선택 인덱스가 범위를 벗어나면 첫 탭으로 보정
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
  }, [visibleTabs.length, tabIndex]);

  // 권한 있는 탭이 하나도 없을 때 안내 화면
  if (visibleTabs.length === 0) {
    return (
      <DashboardLayout>
        <Card sx={{ borderRadius: "16px", padding: 3 }}>
          <MDBox textAlign="center">조회 가능한 탭이 없습니다. (권한 확인 필요)</MDBox>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
        <MDBox
          sx={{
            position: "sticky",
            top: 15,
            zIndex: 10,
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #eee",
          }}
        >
          <DashboardNavbar title="🧾 거래처 마감 자료" />
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
                    <span>{numberIcons[index]}</span>
                    <span>{tab.label}</span>
                  </Box>
                }
                sx={{
                  fontSize: "0.8rem",
                  minWidth: 140,
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
        <MDBox p={2} sx={{ overflow: "hidden" }}>
          {visibleTabs[tabIndex]?.component}
        </MDBox>
      </Card>
    </DashboardLayout>
  );
}

export default AccountingTab_2;
