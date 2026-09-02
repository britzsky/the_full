import React, { useState } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";

import RecordCommuteTab from "./FieldBoard2/recordcommutetab";
import RecordCommuteHistoryTab from "./FieldBoard2/RecordCommuteHistoryTab";

const COMMUTE_PURPLE = "#6C5DD3";

function FieldBoardTabs_2() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  const tabLabels = ["📱 기기 관리", "🗓️ 출퇴근 기록"];

  const tabComponents = [
    <RecordCommuteTab key="device" />,
    <RecordCommuteHistoryTab key="history" />,
  ];

  return (
    <Card
      sx={{
        borderRadius: "16px",
        boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
        // ✅ 왼쪽 네비바(사이드바) 높이에 맞춰 카드가 뷰포트 높이를 꽉 채우도록.
        //    HumanResourceTabs_2.js와 동일한 방식.
        height: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <MDBox
        sx={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            backgroundColor: "#f7f7f7",
            "& .MuiTabs-indicator": {
              backgroundColor: COMMUTE_PURPLE,
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
                  <span>{label}</span>
                </Box>
              }
              sx={{
                fontSize: "0.8rem",
                minWidth: 120,
                textTransform: "none",
                color: tabIndex === index ? COMMUTE_PURPLE : "#666",
                fontWeight: "bold",
                transition: "0.2s",
                "&:hover": {
                  color: COMMUTE_PURPLE,
                  opacity: 0.8,
                },
              }}
            />
          ))}
        </Tabs>
      </MDBox>

      <MDBox
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 2,
        }}
      >
        {tabComponents[tabIndex]}
      </MDBox>
    </Card>
  );
}

export default FieldBoardTabs_2;
