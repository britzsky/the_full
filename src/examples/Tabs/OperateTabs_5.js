import React, { useState, useEffect } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";

import OperateScheduleSheetTab from "./Operate/OperateScheduleSheetTab";
import OperateScheduleStatTab from "./Operate/OperateScheduleStatTab";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const getUserCodes = () => {
  const dept = localStorage.getItem("department");
  const pos = localStorage.getItem("position");
  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
  };
};

const hasAccess = (tab, deptCode, posCode) => {
  const { allowedDepartments, allowedPositions, accessMode = "AND" } = tab;
  const hasDeptCond = Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond = Array.isArray(allowedPositions) && allowedPositions.length > 0;
  if (!hasDeptCond && !hasPosCond) return true;
  const deptOk = hasDeptCond && deptCode != null ? allowedDepartments.includes(deptCode) : false;
  const posOk = hasPosCond && posCode != null ? allowedPositions.includes(posCode) : false;
  if (accessMode === "OR") {
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk;
    if (hasPosCond) return posOk;
    return true;
  } else {
    const finalDeptOk = hasDeptCond ? deptOk : true;
    const finalPosOk = hasPosCond ? posOk : true;
    return finalDeptOk && finalPosOk;
  }
};

function OperateTabs_5() {
  const [tabIndex, setTabIndex] = useState(0);
  const { deptCode, posCode } = getUserCodes();

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  const tabConfig = [
    {
      key: "scheduleSheet",
      label: "📅 일정표 관리",
      component: <OperateScheduleSheetTab />,
    },
    {
      key: "scheduleStat",
      label: "📊 일정 통계",
      component: <OperateScheduleStatTab />,
    },
  ];

  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode));

  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
  }, [visibleTabs, tabIndex]);

  if (visibleTabs.length === 0) {
    return (
      <Card sx={{ borderRadius: "16px", padding: 3 }}>
        <MDBox textAlign="center">조회 가능한 탭이 없습니다. (권한 확인 필요)</MDBox>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="📅 일정표 관리" />
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
      <MDBox p={0.5}>{visibleTabs[tabIndex].component}</MDBox>
    </Card>
  );
}

export default OperateTabs_5;
