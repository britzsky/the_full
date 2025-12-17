import { useEffect, useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";

import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

import logoImage from "assets/images/thefull-Photoroom.png";
import logoImage2 from "assets/images/thefull.png";

import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode } = controller;
  const location = useLocation();
  //const collapseName = location.pathname.replace("/", "");
  const collapseName = location.pathname.split("/")[1] || "";

  // ✅ 현재 열린 메뉴 key 저장
  const [openKey, setOpenKey] = useState(null);

  let textColor = "white";
  if (transparentSidenav || (whiteSidenav && !darkMode)) textColor = "dark";
  else if (whiteSidenav && darkMode) textColor = "inherit";

  const closeSidenav = () => setMiniSidenav(dispatch, true);
  
  useEffect(() => {
    function handleMiniSidenav() {
      const isSmallScreen = window.innerWidth < 1200;

      // 화면이 작으면 mini 모드, 크면 full 모드
      setMiniSidenav(dispatch, isSmallScreen);

      // 화면이 작을 때는 투명/화이트 옵션을 끄고,
      // 클 때만 켜도록 (필요에 따라 조정 가능)
      setTransparentSidenav(dispatch, !isSmallScreen ? false : transparentSidenav);
      setWhiteSidenav(dispatch, !isSmallScreen ? false : whiteSidenav);
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav(); // 처음 렌더링 시 한 번 실행

    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch]);

  const renderRoutes = (routesArray) =>
    routesArray.map(({ type, name, icon, key, href, route, collapse }) => {
      if (type === "collapse") {
        const collapseComponent = href ? (
          <Link
            href={href}
            key={key}
            target="_blank"
            rel="noreferrer"
            sx={{ textDecoration: "none" }}
          >
            <SidenavCollapse
              name={name}
              icon={icon}
              active={key === collapseName}
              subMenu={collapse}
              openKey={openKey}        // ✅ 전달
              setOpenKey={setOpenKey}  // ✅ 전달
              myKey={key}              // ✅ 자기 key 전달
            />
          </Link>
        ) : (
          <NavLink
            key={key}
            to={route || "#"}
            style={{ textDecoration: "none", color: "inherit" }}
            onClick={() => {
              // ✅ 홈(대시보드) 눌렀을 때 열려있는 메뉴 전부 닫기
              if (key === "dashboard") {
                setOpenKey(null);
              }
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
      } else if (type === "title") {
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
      } else if (type === "divider") {
        return <Divider key={key} />;
      }
      return null;
    });

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      <MDBox pt={3} pb={1} px={4} textAlign="center">
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
              <img src={logoImage2} alt="logo" />
            </MDTypography>
          </MDBox>
        </MDBox>
      </MDBox>
      <Divider />
      <List>{renderRoutes(routes)}</List>
    </SidenavRoot>
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
