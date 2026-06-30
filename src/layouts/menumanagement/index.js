import React from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import MDBox from "components/MDBox";
import MenuManagementTab from "examples/Tabs/FieldBoard/MenuManagementTab";

function MenuManagement() {
  return (
    <DashboardLayout>
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#ffffff",
        }}
      >
        <HeaderWithLogout showMenuButton title="식단표 관리" />
      </MDBox>
      <MenuManagementTab standalone />
    </DashboardLayout>
  );
}

export default MenuManagement;
