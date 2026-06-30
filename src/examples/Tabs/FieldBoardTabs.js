import React, { useEffect, useRef, useState, useTransition } from "react";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "layouts/loading/loadingscreen";

import RecordSheetTab from "./FieldBoard/RecordSheetTab";
import TallySheetTab from "./FieldBoard/TallySheetTab";
import DinersNumberSheetTab from "./FieldBoard/DinersNumberSheetTab";
import HandoverSheetTab from "./FieldBoard/HandoverSheetTab";
import HygieneSheetTab from "./FieldBoard/HygieneSheetTab";
import PropertySheetTab from "./FieldBoard/PropertySheetTab";
import MenuManagementTab from "./FieldBoard/MenuManagementTab";

import HeaderWithLogout from "components/Common/HeaderWithLogout";
import { clearSharedAuthCookies } from "utils/sharedAuthSession";

function FieldBoardTabs() {
  const [tabIndex, setTabIndex] = useState(0);
  const [contentTabIndex, setContentTabIndex] = useState(0);
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const [, startTransition] = useTransition();
  const switchTimerRef = useRef(null);
  const TAB_SWITCH_DELAY_MS = 320;
  const navigate = useNavigate();

  const handleTabChange = (_, newValue) => {
    if (newValue === tabIndex) return;

    setTabIndex(newValue);
    setTabSwitchLoading(true);

    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setContentTabIndex(newValue);
      });
    }, TAB_SWITCH_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (contentTabIndex === tabIndex && tabSwitchLoading) {
      setTabSwitchLoading(false);
    }
  }, [contentTabIndex, tabIndex, tabSwitchLoading]);

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
    localStorage.removeItem("autoLogin");
    localStorage.removeItem("autoLoginUserId");
    localStorage.removeItem("autoLoginPassword");
    sessionStorage.removeItem("login_session_id");
    sessionStorage.removeItem("login_user_id");
    clearSharedAuthCookies();

    navigate("/authentication/sign-in", { replace: true });
  };

  const tabLabels = [
    "출근부",
    "집계표",
    "식수현황",
    "인수인계",
    "위생점검",
    "기물관리",
    "식단표 관리",
  ];

  const tabComponents = [
    <RecordSheetTab key="record" />,
    <TallySheetTab key="tally" />,
    <DinersNumberSheetTab key="diner" />,
    <HandoverSheetTab key="handover" />,
    <HygieneSheetTab key="hygiene" />,
    <PropertySheetTab key="property" />,
    <MenuManagementTab key="menu-management" />,
  ];
  const activeTabComponent = tabComponents[contentTabIndex] ?? tabComponents[tabIndex];

  return (
    <Card
      sx={{
        borderRadius: "16px",
        boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
      }}
    >
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <HeaderWithLogout showMenuButton title="현장관리" onLogout={handleLogout} />

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

      <MDBox p={2} sx={{ position: "relative" }}>
        {activeTabComponent}
        {tabSwitchLoading && (
          <MDBox
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              "& .loading-container": {
                height: "100%",
              },
            }}
          >
            <LoadingScreen />
          </MDBox>
        )}
      </MDBox>
    </Card>
  );
}

export default FieldBoardTabs;
