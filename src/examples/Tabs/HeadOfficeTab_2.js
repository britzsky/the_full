import React, { useState } from "react";
import { Tabs, Tab, Box, Card, Grid } from "@mui/material";
import MDBox from "components/MDBox";

// 탭용 서브 컴포넌트 import
import ElectronicPayment from "./HeadOffice/ElectronicPaymentSheetTab";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

function HeadOfficeTab_2() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);
  // ✅ 숫자 이모지 아이콘
  const numberIcons = ["📝", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = ["전자결재 작성", "손익표", "거래처 통계"];

  const tabComponents = [<ElectronicPayment key="electronicpayment" />];
  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      <MDBox
        sx={{
          position: "sticky",
          top: 20, // 상단 고정 위치 (필요하면 56, 64 등으로 조절 가능)
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        {/* 🔹 공통 헤더 사용 */}
        {/* <HeaderWithLogout showMenuButton title="📊관리표" /> */}
        <DashboardNavbar title="📊관리표" />
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
      </MDBox>
      {/* 탭 내용 */}
      <MDBox p={2}>{tabComponents[tabIndex]}</MDBox>
    </Card>
  );
}

export default HeadOfficeTab_2;
