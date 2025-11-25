/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useState, useEffect, useMemo } from "react";

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import PropTypes from "prop-types";

import Swal from "sweetalert2";

const ProtectedRoute = ({
  children,
  allowedDepartments,
  allowedPositions,
  accessMode = "AND",
}) => {
  const { deptCode, posCode } = getUserCodes();

  // route 형식으로 임시 객체 만들어서 재사용
  const routeLike = { allowedDepartments, allowedPositions, accessMode };

  const allowed = hasAccess(routeLike, deptCode, posCode);

  if (!allowed) {

    Swal.fire({
      title: "권한없음",
      text: "접근 권한이 없습니다.\n관리자에게 확인 바랍니다.",
      icon: "error",
      confirmButtonColor: "#d33",
      confirmButtonText: "확인",
    });
    return <Navigate to="/authentication/sign-in" replace />;
  }

  return children;
};

// 🔹 사용자 부서/직책 코드 가져오기 (localStorage 에 "0"~"7" 형태로 저장되어 있다고 가정)
const getUserCodes = () => {
  const dept = localStorage.getItem("department"); // ex: "2"
  const pos = localStorage.getItem("position");   // ex: "4"

  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
  };
};

// 🔹 route 하나에 대해 권한 체크 (부서만, 직책만, 둘 다 모두 지원)
const hasAccess = (route, deptCode, posCode) => {
  const {
    allowedDepartments,
    allowedPositions,
    accessMode = "AND", // 기본 AND
  } = route;

  const hasDeptCond =
    Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond =
    Array.isArray(allowedPositions) && allowedPositions.length > 0;

  // 조건이 하나도 없으면 모두 접근 허용
  if (!hasDeptCond && !hasPosCond) return true;

  const deptOk =
    hasDeptCond && deptCode != null
      ? allowedDepartments.includes(deptCode)
      : false;
  const posOk =
    hasPosCond && posCode != null
      ? allowedPositions.includes(posCode)
      : false;

  if (accessMode === "OR") {
    // OR 인 경우, 실제로 조건이 있는 애들만 OR 연산에 참여
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk; // 부서 조건만 있을 때 → 부서 기준
    if (hasPosCond) return posOk;   // 직책 조건만 있을 때 → 직책 기준
    return true;
  } else {
    // AND 인 경우, 없는 조건은 true 로 간주 (부서만 있으면 부서만 체크)
    const finalDeptOk = hasDeptCond ? deptOk : true;
    const finalPosOk = hasPosCond ? posOk : true;
    return finalDeptOk && finalPosOk;
  }
};

// 🔹 Sidenav / 라우터에서 쓸 routes 필터링
const filterRoutesByPermission = (routesArray, deptCode, posCode) =>
  routesArray
    .map((route) => {
      // 자식 메뉴가 있는 collapse 타입
      if (route.collapse) {
        const filteredChildren = filterRoutesByPermission(
          route.collapse,
          deptCode,
          posCode
        );

        const selfAllowed = hasAccess(route, deptCode, posCode);

        // 본인도 접근 불가이고, 자식도 하나도 없으면 통째로 제거
        if (!selfAllowed && filteredChildren.length === 0) {
          return null;
        }

        // 본인 접근은 안 되더라도, 접근 가능한 자식이 있으면 그룹은 보여줌
        return { ...route, collapse: filteredChildren };
      }

      // 실제 route 없는 title/divider 같은 애들은 그대로 둠
      if (!route.route) return route;

      // 일반 route → 접근 가능할 때만 남김
      return hasAccess(route, deptCode, posCode) ? route : null;
    })
    .filter(Boolean);

// 🔽🔽 여기 추가 🔽🔽
ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedDepartments: PropTypes.arrayOf(PropTypes.number),
  allowedPositions: PropTypes.arrayOf(PropTypes.number),
  accessMode: PropTypes.oneOf(["AND", "OR"]),
};

// @mui material components
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Material Dashboard 2 React example components
import Sidenav from "examples/Sidenav";
import Configurator from "examples/Configurator";

// Material Dashboard 2 React themes
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";

// Material Dashboard 2 React Dark Mode themes
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";

// RTL plugins
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

// Material Dashboard 2 React routes
import routes from "routes";

// Material Dashboard 2 React contexts
import { useMaterialUIController, setMiniSidenav, setOpenConfigurator } from "context";

// Images
import brandWhite from "assets/images/logo-ct.png";
import brandDark from "assets/images/logo-ct-dark.png";

// 화면등록
import TallySheet from "layouts/tallysheet";
import RecordSheet from "layouts/recordsheet";
import MemberSheet from "layouts/membersheet";
import DinersNumberSheet from "layouts/dinersnumbersheet";
import PropertySheet from "layouts/propertysheet";
import AccountInfoSheet from "layouts/accountinfosheet";
import NewRecordSheet from "layouts/newrecordsheet";
// 신사업 메뉴
import CostSheet from "layouts/analysis/cost";
import SalesProfitSheet from "layouts/analysis/salesprofit";
import BrandProfitSheet from "layouts/analysis/brandprofit";
import BranchProfitSheet from "layouts/analysis/branchprofit";
import MonthlySalesSheet from "layouts/analysis/monthlysales";
import InvestMentSheet from "layouts/analysis/investment";
// 영업 메뉴
import TeleManagerSheet from "layouts/business/telemanager";
import CorCarSheet from "layouts/business/corcar";
import CookWearSheet from "layouts/business/cookwear";
import AccountFileSheet from "layouts/business/accountfile";
import FieldBoardTabs from "examples/Tabs/FieldBoardTabs";
// 운영메뉴

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, direction, layout, openConfigurator, sidenavColor, transparentSidenav, whiteSidenav, darkMode } =
    controller;

  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();

  // 🔹 현재 로그인한 유저의 부서/직책 코드
  const { deptCode, posCode } = getUserCodes();

  // 🔹 권한 기준으로 걸러진 routes
  const filteredRoutes = useMemo(
    () => filterRoutesByPermission(routes, deptCode, posCode),
    [deptCode, posCode]
  );

  // Cache for the rtl
  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });

    setRtlCache(cacheRtl);
  }, []);

  // Open sidenav when mouse enter on mini sidenav
  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  // Close sidenav when mouse leave mini sidenav
  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  // Change the openConfigurator state
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  // Setting the dir attribute for the body element
  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  // Setting page scroll to 0 when changing the route
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

    const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }

      if (route.route) {
        return (
          <Route
            exact
            path={route.route}
            key={route.key}
            element={
              <ProtectedRoute
                allowedDepartments={route.allowedDepartments}
                allowedPositions={route.allowedPositions}
                accessMode={route.accessMode}
              >
                {route.component}
              </ProtectedRoute>
            }
          />
        );
      }

      return null;
    });

  // const configsButton = (
  //   <MDBox
  //     display="flex"
  //     justifyContent="center"
  //     alignItems="center"
  //     width="3.25rem"
  //     height="3.25rem"
  //     bgColor="white"
  //     shadow="sm"
  //     borderRadius="50%"
  //     position="fixed"
  //     right="2rem"
  //     bottom="2rem"
  //     zIndex={99}
  //     color="dark"
  //     sx={{ cursor: "pointer" }}
  //     onClick={handleConfiguratorOpen}
  //   >
  //     <Icon fontSize="small" color="inherit">
  //       settings
  //     </Icon>
  //   </MDBox>
  // );

    return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
        <CssBaseline />
        {layout === "dashboard" && deptCode !== 7 && (   // 🔴 여기 조건 추가
          <>
            <Sidenav
              color={sidenavColor}
              brand={(transparentSidenav && !darkMode) || whiteSidenav ? brandDark : brandWhite}
              brandName="Material Dashboard 2"
              routes={filteredRoutes}
              onMouseEnter={handleOnMouseEnter}
              onMouseLeave={handleOnMouseLeave}
            />
            <Configurator />
            {configsButton}
          </>
        )}
        {layout === "vr" && <Configurator />}
        <Routes>
          {getRoutes(filteredRoutes)}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && deptCode !== 7 && (   // 🔴 여기도 동일하게 추가
        <>
          <Sidenav
            color={sidenavColor}
            brand={(transparentSidenav && !darkMode) || whiteSidenav ? brandDark : brandWhite}
            brandName="Material Dashboard 2"
            routes={filteredRoutes}
            onMouseEnter={handleOnMouseEnter}
            onMouseLeave={handleOnMouseLeave}
          />
          <Configurator />
          {/* {configsButton} */}
        </>
      )}
      {layout === "vr" && <Configurator />}
      <Routes>
        {getRoutes(filteredRoutes)}
        <Route path="/tallysheet/:account_id" element={<TallySheet />} />
        <Route path="/recordsheet/:account_id" element={<RecordSheet />} />
        <Route path="/membersheet/:account_id" element={<MemberSheet />} />
        <Route path="/dinersnumbersheet/:account_id" element={<DinersNumberSheet />} />
        <Route path="/propertysheet/:account_id" element={<PropertySheet />} />
        <Route path="/accountinfosheet/:account_id" element={<AccountInfoSheet />} />
        <Route path="/newrecordsheet" element={<NewRecordSheet />} />
        <Route path="/newrecordsheet/:account_id" element={<NewRecordSheet />} />
        {/* 신사업메뉴 */}
        <Route path="/analysis/cost/:account_id" element={<CostSheet />} />
        <Route path="/analysis/salesprofit/:account_id" element={<SalesProfitSheet />} />
        <Route path="/analysis/brandprofit/:account_id" element={<BrandProfitSheet />} />
        <Route path="/analysis/branchprofit/:account_id" element={<BranchProfitSheet />} />
        <Route path="/analysis/monthlysales/:account_id" element={<MonthlySalesSheet />} />
        <Route path="/analysis/investment/:account_id" element={<InvestMentSheet />} />
        <Route path="*" element={<Navigate to="/authentication/sign-in" />} />
        {/* 영업 메뉴 */}
        <Route path="/business/telemanager/:account_id" element={<TeleManagerSheet />}/>
        <Route path="/business/corcar/:account_id" element={<CorCarSheet />}/>
        <Route path="/business/cookwear/:account_id" element={<CookWearSheet />}/>
        <Route path="/business/accountfile/:account_id" element={<AccountFileSheet />}/>
        {/* 운영메뉴 */}
        

        <Route path="/fieldboard/fieldbordtab" element={<FieldBoardTabs />}/>
      </Routes>
    </ThemeProvider>
  );
}
