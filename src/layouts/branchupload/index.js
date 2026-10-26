// 본사 지점업로드 메뉴 화면: 현장 지점업로드 탭과 같은 화면을 본사 모드(전체 거래처, 다운로드 범위 선택)로 표시
import React from "react";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import BranchUploadTab from "examples/Tabs/FieldBoard/BranchUploadTab";

function BranchUploadManager() {
  return (
    <DashboardLayout>
      {/* 상단 제목·메뉴 버튼 영역 */}
      <MDBox sx={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#ffffff" }}>
        <HeaderWithLogout showMenuButton title="📤 지점업로드" />
      </MDBox>

      {/* 지점업로드 화면 영역 */}
      <MDBox pt={2} pb={3}>
        <Card sx={{ p: 2, borderRadius: "16px" }}>
          <BranchUploadTab isHeadOffice />
        </Card>
      </MDBox>
    </DashboardLayout>
  );
}

export default BranchUploadManager;
