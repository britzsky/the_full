import React from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import FieldBoardTabs_2 from "examples/Tabs/FieldBoardTabs_2";

function RecordCommuteSheet() {
  return (
    <DashboardLayout>
      <DashboardNavbar title="📍 출·퇴근 관리" />
      <FieldBoardTabs_2 />
    </DashboardLayout>
  );
}

export default RecordCommuteSheet;
