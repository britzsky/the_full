// HumanResourceTabs_2.js
// 인사 평가 관리 화면의 탭 컨테이너
//
// [수정 흐름]
//   1. 평가문서 관리 탭에서 수정할 문서 데이터를 전달합니다.
//   2. 평가문서 작성 탭으로 전환해 기존 내용을 입력값에 채웁니다.
//   3. 저장 완료 후 수정 데이터를 초기화합니다.
import React, { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Tabs, Tab, Box, Card } from "@mui/material";
import MDBox from "components/MDBox";

import EvaluationDocumentSheetTab from "./HumanResource/EvaluationDocumentSheetTab";
import EvaluationManageTab from "./HumanResource/EvaluationManageTab";
import EvaluationTypeSettingTab from "./HumanResource/EvaluationTypeSettingTab";

// 로그인 유저의 부서/직책/유저ID 가져오기 (localStorage 기준)
const getUserCodes = () => {
  const dept = localStorage.getItem("department");
  const pos = localStorage.getItem("position");
  const userId = String(localStorage.getItem("user_id") || "").trim();

  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
    userId,
  };
};

// 탭별 접근 권한 판정
const hasAccess = (tab, deptCode, posCode, userId) => {
  const { allowedDepartments, allowedPositions, allowedUserIds, accessMode = "AND" } = tab;

  // 특정 유저 ID 허용
  if (Array.isArray(allowedUserIds) && allowedUserIds.length > 0) {
    if (allowedUserIds.includes(userId)) return true;
  }

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

function HumanResourceEvaluationTab() {
  const location = useLocation();
  const [tabIndex, setTabIndex] = useState(0);
  const { deptCode, posCode, userId } = getUserCodes();

  // 알림에서 이동한 경우 관리 탭으로 전환하고 해당 문서를 자동으로 엽니다.
  const [initialEvalIdx, setInitialEvalIdx] = useState(null);

  useEffect(() => {
    const state = location.state;
    if (!state) return;
    if (state.activeTab === 1) setTabIndex(1);
    if (state.openEvalIdx) setInitialEvalIdx(state.openEvalIdx);
    // 같은 알림 이동 상태가 반복되지 않도록 비웁니다.
    window.history.replaceState({}, "");
  }, [location.state]);

  // 수정 모드에서 평가문서 작성 탭에 전달할 기존 평가 데이터입니다.
  const [editData, setEditData] = useState(null);

  const handleTabChange = (_, newValue) => {
    setTabIndex(newValue);
  };

  // 관리 탭에서 선택한 평가 데이터를 작성 탭으로 전달합니다.
  const handleEditRequest = useCallback((data) => {
    setEditData(data);
    setTabIndex(0);
  }, []);

  // 작성 완료 후 수정 데이터 초기화
  const handleEditClear = useCallback(() => {
    setEditData(null);
  }, []);

  const numberIcons = ["1️⃣", "2️⃣", "3️⃣"];

  // 탭 설정 + 권한 정의
  const tabConfig = [
    {
      key: "write",
      label: "평가문서 작성",
      component: (
        <EvaluationDocumentSheetTab
          editData={editData}
          onEditClear={handleEditClear}
        />
      ),
      // 모든 사용자 접근 가능
    },
    {
      key: "manage",
      label: "평가문서 관리",
      component: (
        <EvaluationManageTab
          onEditRequest={handleEditRequest}
          initialEvalIdx={initialEvalIdx}
          onInitialEvalIdxConsumed={() => setInitialEvalIdx(null)}
        />
      ),
      // 모든 사용자 접근 가능
    },
    {
      key: "setting",
      label: "평가문서 설정",
      component: <EvaluationTypeSettingTab />,
      allowedUserIds: ["bh4", "ceo"],   // 특정 유저 ID 허용
      allowedDepartments: [6],           // 부서 6 허용
      accessMode: "OR",
    },
  ];

  const visibleTabs = tabConfig.filter((tab) => hasAccess(tab, deptCode, posCode, userId));

  // 권한 변경으로 visibleTabs 길이가 줄었을 때 index 보정
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) {
      setTabIndex(0);
    }
  }, [visibleTabs.length, tabIndex]);

  return (
    <Card
      sx={{
        borderRadius: "16px",
        boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
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
                  <span>{numberIcons[index]}</span>
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
                "&:hover": { color: "#ff9800", opacity: 0.8 },
              }}
            />
          ))}
        </Tabs>
      </MDBox>

      <MDBox
        sx={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          px: 2,
          pt: 0,
          pb: 1,
        }}
      >
        {visibleTabs[tabIndex]?.component}
      </MDBox>
    </Card>
  );
}

export default HumanResourceEvaluationTab;
