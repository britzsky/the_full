import React, { useState, useEffect } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";

// 탭용 서브 컴포넌트 import
import AccountMemberRecordMainTableTab from "./Operate/AccountMemberRecordMainTableTab";
import AccountEmergencyMemberSheetTab from "./Operate/AccountEmergencyMemberSheetTab";
import AccountRootTab from "./Operate/AccountRootTab";
import AccountFieldMemberTab from "./Operate/AccountFieldMemberTab";
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

function OperateTabs_2() {
  const [tabIndex, setTabIndex] = useState(0);
  const { deptCode, posCode } = getUserCodes();

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  // ✅ 숫자 이모지 아이콘
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

  // 부서코드: 0:대표, 1:신사업, 2:회계, 3:인사, 4:영업, 5:운영, 6:개발, 7:현장
  // 직책코드: 0:대표, 1:팀장, 2:부장, 3:차장, 4:과장, 5:대리, 6:주임, 7:사원

  // 🔹 탭 설정 + 권한 정의
  const tabConfig = [
    {
      key: "fieldstaff",
      label: "👥 긴급인력 확인",
      iconIndex: 0,
      component: <AccountMemberRecordMainTableTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 7], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
      accessMode: "AND",
    },
    {
      key: "property",
      label: "🙋 인력관리",
      iconIndex: 1,
      component: <AccountEmergencyMemberSheetTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 7], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
      accessMode: "AND",
    },
    {
      key: "property",
      label: "🛣️ 권역관리",
      iconIndex: 2,
      component: <AccountRootTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 7], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
      accessMode: "AND",
    },
    {
      key: "property",
      label: "🗺️ 근무가능지역 관리",
      iconIndex: 3,
      component: <AccountFieldMemberTab />,
      allowedDepartments: [0, 2, 3, 4, 5, 6, 7], // 🔹 부서권한
      allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
      accessMode: "AND",
    },

    // {
    //   key: "retail",
    //   label: "🏢 거래처관리",
    //   iconIndex: 2,
    //   component: <RetailBusinessTab />,
    //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    //   accessMode: "AND",
    // },
    // {
    //   key: "subRestaurant",
    //   label: "🏢 대체업체관리",
    //   iconIndex: 3,
    //   component: <SubRestaurantTab />,
    //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    //   accessMode: "AND",
    // },
    // {
    //   key: "handover",
    //   label: "🔁 인수인계 관리",
    //   iconIndex: 4,
    //   component: <HandOverSheetTab />,
    //   allowedDepartments: [0, 2, 3, 4, 5, 6, 7],   // 🔹 부서권한
    //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    //   accessMode: "AND",
    // },
    // {
    //   key: "accountFiles",
    //   label: "📋 면허증 및 자격증 관리",
    //   iconIndex: 5,
    //   component: <AccountMembersFilesTab />,
    //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    //   accessMode: "AND",
    // },
  ];

  // 🔹 현재 유저 기준으로 보여줄 탭만 필터링
  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode));

  // 🔹 권한 변경/로그인 변경 등으로 visibleTabs 길이가 줄었을 때 index 보정
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
  }, [visibleTabs, tabIndex]);

  // 🔹 권한 있는 탭이 하나도 없을 때
  if (visibleTabs.length === 0) {
    return (
      <Card sx={{ borderRadius: "16px", padding: 3 }}>
        <MDBox textAlign="center">조회 가능한 운영 탭이 없습니다. (권한 확인 필요)</MDBox>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      <MDBox
        sx={{
          position: "sticky",
          top: 0, // 상단 고정 위치 (필요하면 56, 64 등으로 조절 가능)
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        {/* 🔹 공통 헤더 사용 */}
        {/* <HeaderWithLogout showMenuButton title="📁고객사 관리" /> */}
        <DashboardNavbar title="🧑‍🔧채용관리" />
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
                  {/* <span>{numberIcons[tab.iconIndex]}</span> */}
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
      {/* 탭 내용 */}
      <MDBox p={2}>{visibleTabs[tabIndex].component}</MDBox>
    </Card>
  );
}

export default OperateTabs_2;
