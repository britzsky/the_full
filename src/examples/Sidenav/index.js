import { useEffect, useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";

import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

import logoImage3 from "assets/images/the-full-logo2.png";

import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";

import { navbarIconButton } from "examples/Navbars/DashboardNavbar/styles";

// ✅ 프로필 모달 (DashboardNavbar에서 쓰던 것과 동일)
import UserProfileModal from "examples/Navbars/DefaultNavbar/UserProfileModal";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode } = controller;

  const location = useLocation();
  const collapseName = location.pathname.split("/")[1] || "";

  // ✅ 현재 열린 메뉴 key 저장
  const [openKey, setOpenKey] = useState(null);

  // ✅ 프로필 모달 오픈 상태 (추가)
  const [openProfile, setOpenProfile] = useState(false);

  // ✅ localStorage user_name, position_name
  const [userName, setUserName] = useState("");
  const [position_name, setPositionName] = useState("");

  useEffect(() => {
    const name = (localStorage.getItem("user_name") || "").trim();
    setUserName(name);
    const position_name = (localStorage.getItem("position_name") || "").trim();
    setPositionName(position_name);
  }, []);

  let textColor = "white";
  if (transparentSidenav || (whiteSidenav && !darkMode)) textColor = "dark";
  else if (whiteSidenav && darkMode) textColor = "inherit";

  const closeSidenav = () => setMiniSidenav(dispatch, true);

  useEffect(() => {
    function handleMiniSidenav() {
      const isSmallScreen = window.innerWidth < 1200;

      setMiniSidenav(dispatch, isSmallScreen);
      setTransparentSidenav(dispatch, !isSmallScreen ? false : transparentSidenav);
      setWhiteSidenav(dispatch, !isSmallScreen ? false : whiteSidenav);
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();

    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch, transparentSidenav, whiteSidenav]);

  const renderRoutes = (routesArray) =>
    routesArray.map(({ type, name, icon, key, href, route, collapse }) => {
      if (type === "collapse") {
        const collapseComponent = href ? (
          <Link href={href} key={key} target="_blank" rel="noreferrer" sx={{ textDecoration: "none" }}>
            <SidenavCollapse
              name={name}
              icon={icon}
              active={key === collapseName}
              subMenu={collapse}
              openKey={openKey}
              setOpenKey={setOpenKey}
              myKey={key}
            />
          </Link>
        ) : (
          <NavLink
            key={key}
            to={route || "#"}
            style={{ textDecoration: "none", color: "inherit" }}
            onClick={() => {
              if (key === "dashboard") setOpenKey(null);
            }}
          >
            <SidenavCollapse
              name={name}
              icon={icon}
              active={key === collapseName}
              subMenu={collapse}
              openKey={openKey}
              setOpenKey={setOpenKey}
              myKey={key}
            />
          </NavLink>
        );
        return collapseComponent;
      }

      if (type === "title") {
        return (
          <MDTypography
            key={key}
            color={textColor}
            display="block"
            variant="caption"
            fontWeight="bold"
            textTransform="uppercase"
            pl={3}
            mt={2}
            mb={1}
            ml={1}
          >
            {name}
          </MDTypography>
        );
      }

      if (type === "divider") {
        return <Divider sx={{ borderColor: "rgba(255,255,255,0.18)" }} key={key} />;
      }

      return null;
    });

  return (
    <>
      <SidenavRoot
        {...rest}
        variant="permanent"
        ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
        sx={{
          "& .MuiDrawer-paper": {
            backgroundColor: "#2F557A",
            backgroundImage: "none",
            border: "none",
            overflow: "auto",

            // ⚠️ 너가 현재 적용해둔 숨김 방식 유지
            width: miniSidenav ? 0 : 260,
            minWidth: miniSidenav ? 0 : 260,
            margin: miniSidenav ? 0 : "10px",
            borderRadius: miniSidenav ? 0 : "24px",
            transform: miniSidenav ? "translateX(-110%)" : "translateX(0)",
            transition: "width .2s ease, transform .2s ease, margin .2s ease",
            pointerEvents: miniSidenav ? "none" : "auto",
          },
        }}
      >
        {/* 로고 영역 */}
        <MDBox pt={4} pb={1} px={4} textAlign="center" sx={{ position: "relative" }}>
          <MDBox
            display={{ xs: "block", xl: "none" }}
            position="absolute"
            top={0}
            right={0}
            p={1.4}
            onClick={closeSidenav}
            sx={{ cursor: "pointer" }}
          >
            <MDTypography variant="h6" color="secondary">
              <Icon sx={{ fontWeight: "bold" }}>close</Icon>
            </MDTypography>
          </MDBox>

          <MDBox component={NavLink} to="/dashboard" display="flex" alignItems="center">
            <MDBox width={!brandName && "100%"} sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })}>
              <MDTypography component="h6" variant="button" fontWeight="medium" color={textColor}>
                <img src={logoImage3} alt="logo" />
              </MDTypography>
            </MDBox>
          </MDBox>

          {/* ✅ 로고와 계정아이콘 사이 흰 줄 */}
          {/* {!miniSidenav && (
            <Divider
              sx={{
                border: 1,
                mt: 2,
                mb: 1,
                borderColor: "rgba(255,255,255,0.85)", // ✅ 흰색 느낌
              }}
            />
          )} */}

          {/* ✅ 계정 아이콘 + user_name */}
          {!miniSidenav && (
            <MDBox mt={1} display="flex" flexDirection="column" alignItems="center" gap={1}>
              {/* <IconButton
                size="large"
                disableRipple
                onClick={() => setOpenProfile(true)}
                sx={{
                  ...navbarIconButton,
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.55)",
                  borderRadius: "999px",
                  px: 1,
                  py: 1,
                  fontSize: 44, // ✅ 아이콘 크기(원하는 값으로 조절)
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                <Icon fontSize="mideum">account_circle</Icon>
              </IconButton> */}

              {/* ✅ user_name 표시 */}
              {/* {userName && (
                <MDTypography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 500,
                    letterSpacing: "-0.2px",
                    lineHeight: 1.1,
                  }}
                >
                  {userName}
                  <br />
                  {position_name}
                </MDTypography>
              )} */}
            </MDBox>
          )}
          {/* ✅ 계정아이콘과 메뉴 사이 흰 줄 */}
          {/* {!miniSidenav && (
            <Divider
              sx={{
                border: 1,
                mt: 1,
                mb: 1,
                borderColor: "rgba(255,255,255,0.85)", // ✅ 흰색 느낌
              }}
            />
          )} */}
        </MDBox>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.18)" }} />
        <List>{renderRoutes(routes)}</List>
      </SidenavRoot>

      {/* ✅ 프로필 모달 */}
      <UserProfileModal open={openProfile} onClose={() => setOpenProfile(false)} />
    </>
  );
}

Sidenav.defaultProps = { color: "info", brand: "" };

Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
