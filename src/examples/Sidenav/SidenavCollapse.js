/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useState } from "react";
import PropTypes from "prop-types";
import { useLocation, NavLink, Link } from "react-router-dom";
// @mui material components
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import List from "@mui/material/List";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Custom styles for the SidenavCollapse
import {
  collapseItem,
  collapseIconBox,
  collapseIcon,
  collapseText,
} from "examples/Sidenav/styles/sidenavCollapse";

// Material Dashboard 2 React context
import { useMaterialUIController } from "context";

function SidenavCollapse({ icon, name, active, subMenu, openKey, setOpenKey, myKey, ...rest }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [controller] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode, sidenavColor } = controller;
  const isOpen = openKey === myKey;   // ✅ 열린 상태 여부

  const handleClick = () => {
    if (subMenu) {
      setOpenKey(isOpen ? null : myKey);  // ✅ 클릭 시 토글
    }
  };

  return (
    <>
      <ListItem component="li" onClick={handleClick} sx={{ cursor: subMenu ? "pointer" : "default" }}>
        <MDBox
          {...rest}
          sx={(theme) => ({
            // 기존 스타일 먼저
            ...collapseItem(theme, {
              active,
              transparentSidenav,
              whiteSidenav,
              darkMode,
              sidenavColor,
            }),
            // ✅ active일 때만 덮어쓸 스타일
            ...(active && {
              backgroundColor: "rgba(255, 255, 255, 0.16)", // 눌린 메뉴 배경
              borderRadius: "8px",
            }),
          })}
        >
          <ListItemIcon
            sx={(theme) =>
              collapseIconBox(theme, { transparentSidenav, whiteSidenav, darkMode, active })
            }
          >
            {typeof icon === "string" ? (
              <Icon sx={(theme) => collapseIcon(theme, { active })}>{icon}</Icon>
            ) : (
              icon
            )}
          </ListItemIcon>

          <ListItemText
            primary={name}
            sx={(theme) =>
              collapseText(theme, {
                miniSidenav,
                transparentSidenav,
                whiteSidenav,
                active,
              })
            }
          />
        </MDBox>
      </ListItem>

      {subMenu && isOpen && (
        <List sx={{ pl: 4 }}>
          {subMenu.map((item) => (
            <NavLink
              key={item.key}
              to={item.route || "#"}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <SidenavCollapse
                name={item.name}
                icon={item.icon}
                // ✅ 현재 URL과 route 비교해서 active 결정
                active={item.route === currentPath}
                subMenu={item.collapse}
                openKey={openKey}
                setOpenKey={setOpenKey}
                myKey={item.key}
              />
            </NavLink>
          ))}
        </List>
      )}
    </>
  );
}

// Default props
SidenavCollapse.defaultProps = {
  active: false,
  subMenu: null,
};

// PropTypes
SidenavCollapse.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.string.isRequired,
  active: PropTypes.bool,
  subMenu: PropTypes.arrayOf(PropTypes.object),
  // ✅ 추가된 부분
  openKey: PropTypes.string,            // 현재 열려 있는 메뉴 key
  setOpenKey: PropTypes.func,           // 부모에서 내려주는 setter
  myKey: PropTypes.string.isRequired,   // 자기 자신을 식별할 key
};

export default SidenavCollapse;
