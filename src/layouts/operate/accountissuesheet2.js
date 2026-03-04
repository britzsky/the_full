/* eslint-disable react/function-component-definition */
import React, { useState } from "react";
import { Card, Grid, Tabs, Tab, Box } from "@mui/material";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import AccountIssueSheetTab from "examples/Tabs/Operate/accountissuesheettab";
import AccountIssueSheetStatsTab from "examples/Tabs/Operate/accountissuesheetstatstab";

export default function AccountIssueSheet2() {
  const [tabIndex, setTabIndex] = useState(0);
  const handleTabChange = (_, nextValue) => setTabIndex(nextValue);
  // AccountSalesTab 과 동일한 숫자 이모지 스타일 적용
  const numberIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  // 고객사 소통 화면은 "이슈 입력/수정" + "통계" 2개 탭으로 고정
  const tabLabels = ["고객사 이슈", "고객사 이슈통계"];
  const tabComponents = [
    <AccountIssueSheetTab key="issue" />,
    <AccountIssueSheetStatsTab key="stats" />,
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar title="📋 고객사 소통" />
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card>
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
            <MDBox p={2}>{tabComponents[tabIndex]}</MDBox>
          </Card>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}
