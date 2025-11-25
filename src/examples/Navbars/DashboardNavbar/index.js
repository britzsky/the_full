/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useState, useEffect } from "react";

// react-router components
import { Link } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @material-ui core components
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Icon from "@mui/material/Icon";
import Badge from "@mui/material/Badge";
import ArrowRightIcon from '@mui/icons-material/ArrowRight';

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import NotificationItem from "examples/Items/NotificationItem";
import api from "api/api";

// Custom styles for DashboardNavbar
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// Material Dashboard 2 React context
import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";

function DashboardNavbar({ absolute, light, isMini }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;

  const [openMenu, setOpenMenu] = useState(null);

  // 🔹 알림 상태
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // 🔹 로그인한 유저 아이디 (로그인 시 localStorage.setItem("user_id", ...) 했다는 가정)
  const userId = localStorage.getItem("user_id");

  useEffect(() => {
    // Setting the navbar type
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }

    // A function that sets the transparent state of the navbar.
    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();

    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  // 🔹 처음 진입했을 때 알림 한 번 조회
  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  const handleOpenMenu = (event) => {
    setOpenMenu(event.currentTarget);
    // 🔹 메뉴 열 때마다 최신 알림 조회
    fetchNotifications();
  };

  const handleCloseMenu = () => setOpenMenu(null);

  const fetchNotifications = async () => {
    // userId 없으면 그냥 비워두고 종료
    if (!userId) {
      setNotifications([]);
      return;
    }

    try {
      setNotifLoading(true);

      // 👉 실제 백엔드 규격에 맞춰서 수정
      //   /User/ContractEndAccountList 가
      //   user_id 기준으로 "계약 종료 임박/만료 고객사" 리스트를 준다는 가정
      const res = await api.get("/User/ContractEndAccountList", {
        params: { user_id: userId },
      });

      setNotifications(res.data || []);
    } catch (e) {
      console.error("알림 조회 실패:", e);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  // Render the notifications menu
  const renderMenu = () => (
    <Menu
      anchorEl={openMenu}
      anchorReference={null}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      open={Boolean(openMenu)}
      onClose={handleCloseMenu}
      sx={{ mt: 1 }}
    >
      {notifLoading && (
        <MDBox px={2} py={1}>
          <MDTypography variant="button" fontSize="0.7rem">
            알림을 불러오는 중입니다...
          </MDTypography>
        </MDBox>
      )}

      {!notifLoading && notifications.length === 0 && (
        <MDBox px={2} py={1}>
          <MDTypography variant="button" fontSize="0.7rem">
            새로운 알림이 없습니다.
          </MDTypography>
        </MDBox>
      )}

      {!notifLoading &&
        notifications.map((n, idx) => (
          <NotificationItem
            key={n.id || n.account_id || idx}
            icon={<ArrowRightIcon></ArrowRightIcon>}
            title={
              n.title ||
              n.message ||
              n.account_name + "(" + n.contract_end + ")" ||
              "알림"
            }
            // 필요하면 description, date 같은 prop 도 내려줄 수 있음
          />
        ))}
    </Menu>
  );

  // Styles for the navbar icons
  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;

      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }

      return colorValue;
    },
  });

  const notificationCount = notifications.length;

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox
          color="inherit"
          mb={{ xs: 1, md: 0 }}
          sx={(theme) => navbarRow(theme, { isMini })}
        >
          {/* 지금은 breadcrumb 안 쓰는 상태라 비워둠 */}
        </MDBox>

        {isMini ? null : (
          <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
            <MDBox pr={1}>
              <MDInput label="Search here" />
            </MDBox>
            <MDBox color={light ? "white" : "inherit"}>
              {/* 계정 아이콘 */}
              <Link to="/authentication/sign-in/basic">
                <IconButton sx={navbarIconButton} size="small" disableRipple>
                  <Icon sx={iconsStyle}>account_circle</Icon>
                </IconButton>
              </Link>

              {/* 사이드바 토글 아이콘 */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu}
                onClick={handleMiniSidenav}
              >
                <Icon sx={iconsStyle} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>

              {/* 설정 아이콘 */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={handleConfiguratorOpen}
              >
                <Icon sx={iconsStyle}>settings</Icon>
              </IconButton>

              {/* 알림 아이콘 + 뱃지 */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                aria-controls="notification-menu"
                aria-haspopup="true"
                variant="contained"
                onClick={handleOpenMenu}
              >
                <Badge
                  badgeContent={notificationCount}
                  color="error"
                  max={99}
                  // 0개면 뱃지 안 보이게
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
  );
}

// Setting default values for the props of DashboardNavbar
DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

// Typechecking props for the DashboardNavbar
DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
