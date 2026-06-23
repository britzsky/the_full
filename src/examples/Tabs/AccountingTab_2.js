import React, { useState } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";

import AccountReceiptTab from "./Accounting/AccountReceiptTab";
import CoupangReceiptTab from "./Accounting/CoupangReceiptTab";
import CorpCardReceiptArchiveTab from "./Accounting/CorpCardReceiptArchiveTab";

function AccountingTab_2() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const tabLabels = [
    "거래처 마감 자료",
    "영수증 등록(본사 법인카드)",
    "영수증 마감 자료(본사 법인카드)",
  ];

  const tabComponents = [
    <AccountReceiptTab key="receipt" />,
    <CoupangReceiptTab key="coupang" />,
    <CorpCardReceiptArchiveTab key="corpcard-archive" />,
  ];

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
        <MDBox p={2} sx={{ overflow: "hidden" }}>{tabComponents[tabIndex]}</MDBox>
      </Card>
    </DashboardLayout>
  );
}

export default AccountingTab_2;
