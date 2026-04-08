import React, { useState } from "react";
import { Tabs, Tab, Box, Card, IconButton, Tooltip } from "@mui/material";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useNavigate } from "react-router-dom";

// 탭용 서브 컴포넌트 import
import RecordSheetTab from "./FieldBoard/RecordSheetTab";
import TallySheetTab from "./FieldBoard/TallySheetTab";
import DinersNumberSheetTab from "./FieldBoard/DinersNumberSheetTab";
import HandoverSheetTab from "./FieldBoard/HandoverSheetTab";
import HygieneSheetTab from "./FieldBoard/HygieneSheetTab";
import PropertySheetTab from "./FieldBoard/PropertySheetTab";

import HeaderWithLogout from "components/Common/HeaderWithLogout";
import { clearSharedAuthCookies } from "utils/sharedAuthSession";

function FieldBoardTabs() {
  const [tabIndex, setTabIndex] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  // ✅ 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_type");
    localStorage.removeItem("position");
    localStorage.removeItem("department");
    localStorage.removeItem("account_id");
    localStorage.removeItem("web_position");
    localStorage.removeItem("login_session_id");
    localStorage.removeItem("position_name");
    localStorage.removeItem("user_name");
    sessionStorage.removeItem("login_session_id");
    sessionStorage.removeItem("login_user_id");
    clearSharedAuthCookies();

    navigate("/authentication/sign-in");
  };

  // ✅ 숫자 이모지 아이콘 (탭 개수에 맞게 6개로)
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

  const tabLabels = [
    "🙋‍♂️ 출근부",
    "📋 집계표",
    "🍽️ 식수현황",
    "🔁 인수인계",
    "🧹 위생점검",
    "📦 기물관리",
  ];

  const tabComponents = [
    <RecordSheetTab key="record" />,
    <TallySheetTab key="tally" />,
    <DinersNumberSheetTab key="diner" />,
    <HandoverSheetTab key="handover" />,
    <HygieneSheetTab key="hygiene" />,
    <PropertySheetTab key="property" />, // TODO: 나중에 교육 탭 따로 빼도 됨
  ];

  return (
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
          top: 0,             // 상단 고정 위치 (필요하면 56, 64 등으로 조절 가능)
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        {/* 상단 헤더 영역 (타이틀 + 로그아웃) */}
        {/* 🔹 공통 헤더 사용 */}
        <HeaderWithLogout showMenuButton title="현장관리" />

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
                  {/* <span>{numberIcons[index]}</span> */}
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
  );
}

export default FieldBoardTabs;
