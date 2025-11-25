/* eslint-disable react/function-component-definition */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";   // ✅ 추가

function HeaderWithLogout({ title, rightContent }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_type");
    localStorage.removeItem("position");
    localStorage.removeItem("department");
    localStorage.removeItem("account_id");

    navigate("/authentication/sign-in");
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
        backgroundColor: "#77BEF0",   // ✅ 원하는 색
        borderRadius: "10px 10px 10px 10px",  // ✅ 위쪽만 둥글게 (좌상, 우상, 우하, 좌하)
      }}
    >
      {/* 왼쪽 타이틀 */}
      <MDTypography variant="button" fontWeight="bold" fontSize="16px" style={{ color: "white" }}>
        {title}
      </MDTypography>

      {/* 오른쪽 영역: 화면마다 다른 버튼들 + 공통 로그아웃 */}
      <MDBox display="flex" alignItems="center" gap={0.5}>
        {rightContent /* 필요하면 오른쪽에 다른 버튼들 넣기 */}
        <Tooltip title="로그아웃">
          <IconButton
            size="small"
            onClick={handleLogout}
            sx={{
              border: "2px solid #FFFDF6",
              borderRadius: "50%",
              padding: "4px",
              color: "#FFFDF6"
            }}
          >
            <Icon fontSize="small">logout</Icon>
          </IconButton>
        </Tooltip>
      </MDBox>
    </MDBox>
  );
}

/* ✅ 여기서 props 타입 정의 */
HeaderWithLogout.propTypes = {
  title: PropTypes.string,      // 문자열 제목
  rightContent: PropTypes.node, // 리액트 노드(버튼들, 아이콘 등)
};

export default HeaderWithLogout;
