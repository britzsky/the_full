import React from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import HeadOfficeTab_4 from "examples/Tabs/HeadOfficeTab_4";

// 본사 식단표, 법인차량, 사용자 관리 화면을 탭으로 제공합니다.
function HeadOffice_4() {
  return (
    <DashboardLayout>
      <HeadOfficeTab_4 />
    </DashboardLayout>
  );
}

export default HeadOffice_4;
