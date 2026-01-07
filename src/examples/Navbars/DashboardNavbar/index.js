/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";

// @mui
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Icon from "@mui/material/Icon";
import Badge from "@mui/material/Badge";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import useTheme from "@mui/material/styles/useTheme";
import useMediaQuery from "@mui/material/useMediaQuery";

// MD
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Example
import NotificationItem from "examples/Items/NotificationItem";
import api from "api/api";

// ✅ 프로필 모달
import UserProfileModal from "examples/Navbars/DefaultNavbar/UserProfileModal";

// Styles
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// Context
import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";

function DashboardNavbar({ absolute, light, isMini, title, showMenuButtonWhenMini }) {
  const NAVBAR_H = 48;

  // ✅ 화면이 너무 작아지면 오른쪽(유저명/프로필/알림) 숨김
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm")); // 600px 이하
  const hideRightArea = isSmDown;

  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;

  const [openMenu, setOpenMenu] = useState(null);
  const [openProfile, setOpenProfile] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [userName, setUserName] = useState("");
  const [position_name, setPositionName] = useState("");

  const userId = localStorage.getItem("user_id");

  useEffect(() => {
    setNavbarType(fixedNavbar ? "sticky" : "static");

    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();

    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const name = (localStorage.getItem("user_name") || "").trim();
    setUserName(name);
    const pn = (localStorage.getItem("position_name") || "").trim();
    setPositionName(pn);
  }, []);

  const fetchNotifications = async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    try {
      setNotifLoading(true);
      const res = await api.get("/User/ContractEndAccountList", { params: { user_id: userId } });
      setNotifications(res.data || []);
    } catch (e) {
      console.error("알림 조회 실패:", e);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleOpenMenu = (event) => {
    setOpenMenu(event.currentTarget);
    fetchNotifications();
  };
  const handleCloseMenu = () => setOpenMenu(null);

  // ✅ mini일 때만 “펼치기” 버튼 보이게
  const showSidenavToggle = Boolean(showMenuButtonWhenMini && miniSidenav);
  const handleToggleSidenav = () => setMiniSidenav(dispatch, !miniSidenav);

  const iconsStyle = { color: "#fff" };
  const notificationCount = notifications.length;

  const renderMenu = () => (
    <Menu
      anchorEl={openMenu}
      anchorReference={null}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      open={Boolean(openMenu)}
      onClose={handleCloseMenu}
      sx={{
        mt: 1,
        "& .MuiPaper-root": {
          backgroundColor: "#2F557A",
          backgroundImage: "none",
          color: "#fff",
          borderRadius: "12px",
          minWidth: 260,
          border: "1px solid rgba(255,255,255,0.18)",
        },
        "& .MuiBackdrop-root": { backgroundColor: "transparent" },
      }}
    >
      {notifLoading && (
        <MDBox px={2} py={1}>
          <MDTypography variant="button" fontSize="0.7rem" sx={{ color: "#fff" }}>
            알림을 불러오는 중입니다...
          </MDTypography>
        </MDBox>
      )}

      {!notifLoading && notifications.length === 0 && (
        <MDBox px={2} py={1}>
          <MDTypography variant="button" fontSize="0.7rem" sx={{ color: "#fff" }}>
            새로운 알림이 없습니다.
          </MDTypography>
        </MDBox>
      )}

      {!notifLoading &&
        notifications.map((n, idx) => (
          <MDBox
            key={n.id || n.account_id || idx}
            sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" }, borderRadius: "10px" }}
          >
            <NotificationItem
              icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
              title={n.title || n.message || `${n.account_name}(${n.contract_end})` || "알림"}
            />
          </MDBox>
        ))}
    </Menu>
  );

  return (
    <>
      <AppBar
        position={absolute ? "absolute" : navbarType}
        color="inherit"
        sx={(theme2) => ({
          ...navbar(theme2, { transparentNavbar, absolute, light, darkMode }),
          backgroundColor: "#2F557A",
          backgroundImage: "none",
          paddingTop: 0,
          paddingBottom: 0,
          minHeight: NAVBAR_H,
          height: NAVBAR_H,
          "& .MuiToolbar-root": {
            minHeight: NAVBAR_H,
            height: NAVBAR_H,
            paddingTop: 0,
            paddingBottom: 0,
          },
          "@media (min-width:600px)": {
            minHeight: NAVBAR_H,
            height: NAVBAR_H,
            "& .MuiToolbar-root": { minHeight: NAVBAR_H, height: NAVBAR_H },
          },
        })}
      >
        <Toolbar
          variant="dense"
          disableGutters
          sx={(theme2) => ({
            ...navbarContainer(theme2),
            minHeight: NAVBAR_H,
            height: NAVBAR_H,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: theme2.spacing(1.5),
            paddingRight: theme2.spacing(1.5),
            flexWrap: "nowrap", // ✅ 줄바꿈 방지
            "@media (min-width:600px)": { minHeight: NAVBAR_H, height: NAVBAR_H },
          })}
        >
          {/* ✅ 왼쪽: (mini일 때만) 토글 버튼 + title */}
          <MDBox display="flex" alignItems="center" gap={1} sx={{ flex: 1, minWidth: 0 }}>
            {showSidenavToggle && (
              <IconButton
                size="small"
                onClick={handleToggleSidenav}
                sx={{
                  color: "white",
                  border: "2px solid rgba(255,255,255,0.6)",
                  borderRadius: "8px",
                  padding: "4px",
                  flex: "0 0 auto",
                }}
              >
                <Icon fontSize="small" sx={{ color: "white" }}>
                  menu_open
                </Icon>
              </IconButton>
            )}

            {!!title && (
              <MDTypography
                variant="button"
                fontWeight="bold"
                fontSize="16px"
                sx={{
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </MDTypography>
            )}
          </MDBox>

          {/* ✅ 오른쪽: 화면이 작아지면 통째로 숨김 (user/프로필/알림) */}
          {isMini || hideRightArea ? null : (
            <MDBox
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                flex: "0 0 auto",
                whiteSpace: "nowrap",
                flexWrap: "nowrap",
                gap: 0.5,
                minWidth: 0,
              }}
            >
              {userName && (
                <MDTypography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 500,
                    letterSpacing: "-0.2px",
                    lineHeight: 1.1,
                    textAlign: "right",
                    mr: 0.5,
                  }}
                >
                  {userName}
                  <br />
                  {position_name}
                </MDTypography>
              )}

              <MDBox
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "nowrap",
                  whiteSpace: "nowrap",
                  gap: 0.25,
                }}
              >
                <IconButton
                  sx={{ ...navbarIconButton, color: "#fff" }}
                  size="medium"
                  disableRipple
                  onClick={() => setOpenProfile(true)}
                >
                  <Icon sx={iconsStyle}>account_circle</Icon>
                </IconButton>

                <IconButton
                  size="medium"
                  disableRipple
                  sx={{ ...navbarIconButton, color: "#fff" }}
                  aria-controls="notification-menu"
                  aria-haspopup="true"
                  onClick={handleOpenMenu}
                >
                  <Badge
                    badgeContent={notificationCount}
                    color="error"
                    max={99}
                    invisible={notificationCount === 0}
                  >
                    <Icon sx={iconsStyle}>notifications</Icon>
                  </Badge>
                </IconButton>

                {renderMenu()}
              </MDBox>
            </MDBox>
          )}
        </Toolbar>
      </AppBar>

      <UserProfileModal open={openProfile} onClose={() => setOpenProfile(false)} />
    </>
  );
}

DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
  title: "",
  showMenuButtonWhenMini: true,
};

DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
  title: PropTypes.string,
  showMenuButtonWhenMini: PropTypes.bool,
};

export default DashboardNavbar;
