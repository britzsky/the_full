import React, { useState } from "react";
import { Tabs, Tab, Box, Card, Grid } from "@mui/material";
import MDBox from "components/MDBox";
import HeaderWithLogout from "components/Common/HeaderWithLogout";

// 탭용 서브 컴포넌트 import
import DeadlineBalanceTab from "./AccountSales/DeadlineBalanceTab";
import DeadlineFilesTab from "./AccountSales/DeadlineFilesTab";
import DeadlineIssueTab from "./AccountSales/DeadlineIssueTab";

function AccountSalesTab() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);
  // ✅ 숫자 이모지 아이콘
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = [
    "매출마감/미수잔액",
    "마감자료",
    "마감이슈",
  ];

  const tabComponents = [
    <DeadlineBalanceTab key="dead" />,
    <DeadlineFilesTab key="files" />,
    <DeadlineIssueTab key="issue" />,
  ];
  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      {/* 🔹 공통 헤더 사용 */}
      <HeaderWithLogout title="매출 관리" />
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

export default AccountSalesTab;
