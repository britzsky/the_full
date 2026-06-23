import React from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import HumanResourceTabs_2 from "examples/Tabs/HumanResourceTabs_2";

function HumanResourceEvaluation() {
  return (
    <DashboardLayout>
      <DashboardNavbar title="📊 평가 관리" />
      <HumanResourceTabs_2 />
    </DashboardLayout>
  );
}

export default HumanResourceEvaluation;
