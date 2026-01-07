/* eslint-disable react/function-component-definition */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

// ✅ 사이드네브 컨트롤 import
import {
  useMaterialUIController,
  setMiniSidenav,
} from "context";

function HeaderWithLogout({ title, rightContent, showMenuButton }) {
  const navigate = useNavigate();

  // ✅ 사이드 메뉴 상태/디스패치
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav } = controller;

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_type");
    localStorage.removeItem("position");
    localStorage.removeItem("department");
    localStorage.removeItem("account_id");

    navigate("/authentication/sign-in");
  };

  // ✅ 햄버거 버튼 클릭 시 사이드 메뉴 토글
  const handleToggleSidenav = () => {
    setMiniSidenav(dispatch, !miniSidenav);
  };

  return (
    <MDBox
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px={2}
      pt={0.5}
      pb={0.5}
      sx={{
        backgroundColor: "#2f557a",
        borderRadius: "10px 10px 10px 10px",
      }}
    >
      {/* 왼쪽: 메뉴 버튼 + 타이틀 */}
      <MDBox display="flex" alignItems="center" gap={1}>
        {showMenuButton && (
          <IconButton
            size="small"
            onClick={handleToggleSidenav}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "8px",
              padding: "4px",
            }}
          >
            {/* miniSidenav 여부에 따라 아이콘 변경 (선택사항) */}
            <Icon fontSize="small" sx={{color:"white"}}>
              {miniSidenav ? "menu_open" : "menu"}
            </Icon>
          </IconButton>
        )}

        <MDTypography
          variant="button"
          fontWeight="bold"
          fontSize="16px"
          style={{ color: "white" }}
        >
          {title}
        </MDTypography>
      </MDBox>

      {/* 오른쪽: 화면별 버튼들 + 공통 로그아웃 */}
      <MDBox display="flex" alignItems="center" gap={0.5}>
        {rightContent}
        <Tooltip title="로그아웃">
          <IconButton
            size="small"
            onClick={handleLogout}
            sx={{
              border: "2px solid #FFFDF6",
              borderRadius: "50%",
              padding: "4px",
              color: "#FFFDF6",
            }}
          >
            <Icon fontSize="small">logout</Icon>
          </IconButton>
        </Tooltip>
      </MDBox>
    </MDBox>
  );
}

/* ✅ props 타입 정의 */
HeaderWithLogout.propTypes = {
  title: PropTypes.string,
  rightContent: PropTypes.node,
  showMenuButton: PropTypes.bool, // 👈 추가
};

HeaderWithLogout.defaultProps = {
  showMenuButton: false,
};

export default HeaderWithLogout;
