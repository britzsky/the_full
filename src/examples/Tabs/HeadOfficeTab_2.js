import React, { useState } from "react";
import { Tabs, Tab, Box, Card, Grid } from "@mui/material";
import MDBox from "components/MDBox";
import { useLocation, useNavigate } from "react-router-dom";

// 탭용 서브 컴포넌트 import
import ElectronicPayment from "./HeadOffice/ElectronicPaymentSheetTab";
import ElectronicPaymentManageTab from "./HeadOffice/ElectronicPaymentManageTab";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

function HeadOfficeTab_2() {
  const [tabIndex, setTabIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const paymentIdParam = searchParams.get("payment_id") || "";
  const openTsParam = searchParams.get("open_ts") || "";

  React.useEffect(() => {
    const next = tabParam === "1" ? 1 : 0;
    setTabIndex(next);
  }, [tabParam]);

  const handleTabChange = (_, newValue) => {
    setTabIndex(newValue);

    const nextParams = new URLSearchParams(location.search);
    if (newValue === 1) {
      nextParams.set("tab", "1");
    } else {
      nextParams.delete("tab");
      nextParams.delete("payment_id");
      nextParams.delete("open_ts");
    }

    const nextSearch = nextParams.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    );
  };
  // ✅ 이모지 아이콘
  const numberIcons = ["📝", "📋", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = [
    "전자결재 작성",
    "전자결재 관리",
  ];

  const tabComponents = [
    <ElectronicPayment key="electronicpayment" />,
    <ElectronicPaymentManageTab
      key="electronicpaymentmanage"
      initialPaymentId={paymentIdParam}
      initialOpenToken={openTsParam}
    />,
  ];
  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      <MDBox
        sx={{
          position: "sticky",
          top: 0, // PeopleCounting 탭과 동일한 상단 기준
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        {/* 🔹 공통 헤더 사용 */}
        {/* <HeaderWithLogout showMenuButton title="📝관리표" /> */}
        <DashboardNavbar title="📝 전자결재 관리" />
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
      <MDBox px={2} pb={2} pt={2}>{tabComponents[tabIndex]}</MDBox>
    </Card>
  );
}

export default HeadOfficeTab_2;
