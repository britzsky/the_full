/* eslint-disable react/function-component-definition */
import PropTypes from "prop-types";
import { useLocation, NavLink } from "react-router-dom";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import List from "@mui/material/List";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import { useMaterialUIController } from "context";

function SidenavCollapse({
  icon,
  name,
  active,
  subMenu,
  openKey,
  setOpenKey,
  myKey,
  depth = 0,
  hideIcon = true,
  ...rest
}) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [controller] = useMaterialUIController();
  const { miniSidenav } = controller;

  const isOpen = openKey === myKey;

  const ACTIVE_BG = "#F4FF63";
  const ACTIVE_TEXT = "#1C2633";
  const TEXT = "rgba(255,255,255,0.92)";
  const SUB_TEXT = "rgba(255,255,255,0.75)";

  // ✅ 들여쓰기(서브메뉴가 안쪽으로 들어간 느낌)
  const indent = depth === 0 ? 5 : 18; // px (원하면 14~24로 조절)

  const handleClick = () => {
    if (subMenu) setOpenKey(isOpen ? null : myKey);
  };

  return (
    <>
      <ListItem
        component="li"
        onClick={handleClick}
        disableGutters
        sx={{
          px: 1,
          py: 0.1,
          cursor: subMenu ? "pointer" : "default",

          // ✅ 메인은 왼쪽 정렬 / 서브도 왼쪽 정렬
          justifyContent: "flex-start",
        }}
      >
        <MDBox
          {...rest}
          sx={() => ({
            width: "100%",
            maxWidth: 220, // 메인메뉴가 살짝 더 왼쪽 느낌이 나도록 폭 여유
            mx: 0,         // ✅ 가운데정렬 해제
            ml: `${10 + indent}px`, // ✅ 메인도 약간 왼쪽 여백, 서브는 더 안쪽
            mr: 1,

            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start", // ✅ 텍스트 왼쪽
            gap: 1,

            backgroundColor: "transparent",
            borderRadius: 999,
            padding: "8px 10px",
            transition: "all .15s ease",

            "&:hover": {
              backgroundColor: active ? ACTIVE_BG : "rgba(255,255,255,0.10)",
            },

            ...(active && {
              backgroundColor: ACTIVE_BG,
              border: "2px solid rgba(255,255,255,0.35)",
              boxShadow: "0 6px 0 rgba(0,0,0,0.18)",
            }),
          })}
        >
          <ListItemIcon
            sx={{
              display: hideIcon ? "none" : "flex",
              minWidth: 32,
              color: active ? ACTIVE_TEXT : TEXT,
              justifyContent: "center",
            }}
          >
            {typeof icon === "string" ? <Icon>{icon}</Icon> : icon}
          </ListItemIcon>

          <ListItemText
            primary={name}
            sx={{
              m: 0,
              textAlign: "left", // ✅ 메인/서브 모두 왼쪽 정렬
              "& .MuiListItemText-primary": {
                fontSize: depth === 0 ? 15 : 13,
                fontWeight: active ? 800 : depth === 0 ? 700 : 600,
                letterSpacing: "-0.2px",
                color: active ? ACTIVE_TEXT : depth === 0 ? TEXT : SUB_TEXT,
              },
            }}
          />
        </MDBox>
      </ListItem>

      {subMenu && isOpen && (
        <List
          sx={{
            pl: 0,
            pb: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch", // ✅ 가운데정렬 해제(서브는 왼쪽 기준)
            gap: 0.2,
          }}
        >
          {subMenu.map((item) => (
            <NavLink
              key={item.key}
              to={item.route || "#"}
              style={{ textDecoration: "none", color: "inherit", width: "100%" }}
            >
              <SidenavCollapse
                name={item.name}
                icon={item.icon}
                active={item.route === currentPath}
                subMenu={item.collapse}
                openKey={openKey}
                setOpenKey={setOpenKey}
                myKey={item.key}
                depth={depth + 1}
                hideIcon={hideIcon}
              />
            </NavLink>
          ))}
        </List>
      )}
    </>
  );
}

SidenavCollapse.defaultProps = {
  active: false,
  subMenu: null,
  depth: 0,
  hideIcon: true,
};

SidenavCollapse.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.string.isRequired,
  active: PropTypes.bool,
  subMenu: PropTypes.arrayOf(PropTypes.object),
  openKey: PropTypes.string,
  setOpenKey: PropTypes.func,
  myKey: PropTypes.string.isRequired,
  depth: PropTypes.number,
  hideIcon: PropTypes.bool,
};

export default SidenavCollapse;
