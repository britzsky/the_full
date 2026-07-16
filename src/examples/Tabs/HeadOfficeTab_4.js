import React, { useEffect, useState } from "react";
import { Box, Card, Tab, Tabs } from "@mui/material";
import MDBox from "components/MDBox";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import CorCarTab from "examples/Tabs/Business/CorCarTab";
import UserManagement from "layouts/humanresource/usermanagement";
import WeekMenuManager from "layouts/weekmenusheet";

// 로그인 사용자 정보를 기준으로 탭별 접근 권한을 판정합니다.
const hasAccess = ({ allowedDepartments, allowedPositions, allowUserIds, accessMode = "AND" }) => {
  const department = Number(localStorage.getItem("department"));
  const position = Number(localStorage.getItem("position"));
  const userId = String(localStorage.getItem("user_id") || "").trim();

  if (Array.isArray(allowUserIds) && allowUserIds.includes(userId)) return true;

  const hasDepartmentCondition =
    Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPositionCondition = Array.isArray(allowedPositions) && allowedPositions.length > 0;

  if (!hasDepartmentCondition && !hasPositionCondition) return true;

  const departmentAllowed =
    hasDepartmentCondition && allowedDepartments.includes(department);
  const positionAllowed = hasPositionCondition && allowedPositions.includes(position);

  if (accessMode === "OR") {
    return departmentAllowed || positionAllowed;
  }

  return (
    (!hasDepartmentCondition || departmentAllowed) &&
    (!hasPositionCondition || positionAllowed)
  );
};

function HeadOfficeTab_4() {
  const [tabIndex, setTabIndex] = useState(0);

  // 본사 관리 메뉴에서 표시할 화면과 기존 접근 권한을 정의합니다.
  const tabConfig = [
    {
      key: "weekMenu",
      label: "🍚 본사 식단표",
      component: <WeekMenuManager embedded />,
    },
    {
      key: "carManager",
      label: "🚙 법인차량 관리",
      component: <CorCarTab embedded />,
    },
    {
      key: "userManagement",
      label: "👥 사용자 관리",
      component: <UserManagement embedded />,
      allowedDepartments: [0, 6],
      allowedPositions: [0, 1],
      accessMode: "OR",
      allowUserIds: ["db1", "si1"],
    },
  ];

  const visibleTabs = tabConfig.filter(hasAccess);

  // 권한에 따라 노출 탭 수가 달라지면 첫 번째 탭으로 선택 상태를 보정합니다.
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) setTabIndex(0);
  }, [tabIndex, visibleTabs.length]);

  return (
    <Card sx={{ borderRadius: "16px", boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}>
      {/* 본사 관리 제목 및 화면 전환 탭 영역 */}
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="🏢 본사 관리" />
        <Tabs
          value={tabIndex}
          onChange={(_, newValue) => setTabIndex(newValue)}
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
                minWidth: 150,
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

      {/* 선택한 본사 관리 화면 영역 */}
      <MDBox p={0.5}>{visibleTabs[tabIndex]?.component}</MDBox>
    </Card>
  );
}

export default HeadOfficeTab_4;
