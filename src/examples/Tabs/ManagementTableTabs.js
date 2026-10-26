import React, { useState } from "react";
import { Tabs, Tab, Box, Card, Grid } from "@mui/material";
import MDBox from "components/MDBox";
import HeaderWithLogout from "components/Common/HeaderWithLogout";

// 탭용 서브 컴포넌트 import
import TeleManagerTab from "./Business/TeleManagerTab";
import CorCarTab from "./Business/CorCarTab";
import CookWearTab from "./Business/CookWearTab";
import AccountFileTab from "./Business/AccountFileTab";
import { confirmTabLeave } from "utils/unsavedChangesGuard";

function ManagementTableTabs() {
  const [tabIndex, setTabIndex] = useState(0);

  // 탭 변경 (현재 탭 화면에 미저장 변경이 있으면 저장 후 이동 / 취소 후 이동 / 취소 확인)
  const handleTabChange = async (_, newValue) => {
    if (newValue === tabIndex) return;
    if (!(await confirmTabLeave())) return;
    setTabIndex(newValue);
  };
  // ✅ 숫자 이모지 아이콘
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = [
    "인원증감",
    "미수",
    "조리복 재고관리",
    "거래처 파일관리",
  ];

  const tabComponents = [
    <TeleManagerTab key="tele" />,
    <CorCarTab key="car" />,
    <CookWearTab key="cook" />,
    <AccountFileTab key="account" />,
  ];
  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      {/* 🔹 공통 헤더 사용 */}
      <HeaderWithLogout showMenuButton title="현장 업무 보드" />
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

      {/* 탭 내용 */}
      <MDBox p={2}>{tabComponents[tabIndex]}</MDBox>
    </Card>
  );
}

export default ManagementTableTabs;
