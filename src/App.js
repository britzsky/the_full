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

import { useState, useEffect, useMemo, useRef } from "react";

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import PropTypes from "prop-types";
import Swal from "sweetalert2";

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

// 화면등록 (커스텀 라우트들)
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

/* =========================================================
   ✅ 권한 관련 유틸
========================================================= */

// 🔹 세션 사용자ID 키 호환 처리(login_user_id / user_id)
const getSessionUserId = () =>
  sessionStorage.getItem("user_id") || sessionStorage.getItem("login_user_id");

// 🔹 사용자 부서/직책/아이디 코드 조회(local/session 기준)
const getUserCodes = () => {
  const localSessionId = localStorage.getItem("login_session_id");
  const tabSessionId = sessionStorage.getItem("login_session_id");
  const localUserId = localStorage.getItem("user_id");
  const tabUserId = getSessionUserId();

  if (
    localSessionId &&
    tabSessionId &&
    localSessionId !== tabSessionId &&
    localUserId &&
    tabUserId &&
    localUserId !== tabUserId
  ) {
    return { deptCode: null, posCode: null, userId: null };
  }

  const dept = localStorage.getItem("department"); // ex: "2"
  const pos = localStorage.getItem("position"); // ex: "4"
  const userId =
    localStorage.getItem("user_id") || getSessionUserId(); // ✅ 특정 아이디 권한용 (키가 다르면 여기만 수정)

  return {
    deptCode: dept != null ? Number(dept) : null,
    posCode: pos != null ? Number(pos) : null,
    userId: userId || null,
  };
};

// 🔹 route 하나에 대해 권한 체크 (부서/직책 + allow/deny/only userId)
const hasAccess = (route, deptCode, posCode, userId) => {
  const {
    allowedDepartments,
    allowedPositions,
    accessMode = "AND",
    allowUserIds,
    denyUserIds,
    onlyUserIds,
  } = route;

  // ✅ 0) 강제 차단
  if (Array.isArray(denyUserIds) && userId && denyUserIds.includes(userId)) {
    return false;
  }

  // ✅ 1) onlyUserIds가 있으면 "여기 포함된 유저만" 허용
  if (Array.isArray(onlyUserIds) && onlyUserIds.length > 0) {
    return !!(userId && onlyUserIds.includes(userId));
  }

  // ✅ 2) allowUserIds(예외 통과): 부서/직책 조건과 상관없이 통과
  if (Array.isArray(allowUserIds) && userId && allowUserIds.includes(userId)) {
    return true;
  }

  const hasDeptCond = Array.isArray(allowedDepartments) && allowedDepartments.length > 0;
  const hasPosCond = Array.isArray(allowedPositions) && allowedPositions.length > 0;

  // 조건이 하나도 없으면 모두 접근 허용
  if (!hasDeptCond && !hasPosCond) return true;

  const deptOk = hasDeptCond && deptCode != null ? allowedDepartments.includes(deptCode) : false;

  const posOk = hasPosCond && posCode != null ? allowedPositions.includes(posCode) : false;

  if (accessMode === "OR") {
    if (hasDeptCond && hasPosCond) return deptOk || posOk;
    if (hasDeptCond) return deptOk;
    if (hasPosCond) return posOk;
    return true;
  }

  // AND 인 경우, 없는 조건은 true 로 간주
  const finalDeptOk = hasDeptCond ? deptOk : true;
  const finalPosOk = hasPosCond ? posOk : true;
  return finalDeptOk && finalPosOk;
};

// 🔹 Sidenav / 라우터에서 쓸 routes 필터링 (userId 포함)
const filterRoutesByPermission = (routesArray, deptCode, posCode, userId) =>
  routesArray
    .map((route) => {
      // 자식 메뉴가 있는 collapse 타입
      if (route.collapse) {
        const filteredChildren = filterRoutesByPermission(
          route.collapse,
          deptCode,
          posCode,
          userId
        );

        const selfAllowed = hasAccess(route, deptCode, posCode, userId);

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
      return hasAccess(route, deptCode, posCode, userId) ? route : null;
    })
    .filter(Boolean);

/* =========================================================
   ✅ ProtectedRoute (Swal 무한 호출 방지 포함)
========================================================= */

const ProtectedRoute = ({
  children,
  allowedDepartments,
  allowedPositions,
  accessMode = "AND",
  allowUserIds,
  denyUserIds,
  onlyUserIds,
}) => {
  const { deptCode, posCode, userId } = getUserCodes();
  const localUserId = localStorage.getItem("user_id");
  const tabUserId = getSessionUserId();
  const hasAnyUserId = !!localUserId || !!tabUserId;
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [shouldMoveLogin, setShouldMoveLogin] = useState(false);
  const noSessionPopupOpenRef = useRef(false);

  // ✅ local/session user_id가 모두 없으면 로그인 안내 후 이동
  useEffect(() => {
    if (hasAnyUserId || noSessionPopupOpenRef.current) return;
    noSessionPopupOpenRef.current = true;

    Swal.fire({
      title: "알림",
      html: "로그인 세션이 없습니다.<br/>로그인 화면으로 이동합니다.",
      icon: "warning",
      confirmButtonColor: "#d33",
      confirmButtonText: "확인",
    }).then(() => setShouldMoveLogin(true));
  }, [hasAnyUserId]);

  // route 형식으로 임시 객체 만들어서 재사용
  const routeLike = {
    allowedDepartments,
    allowedPositions,
    accessMode,
    allowUserIds,
    denyUserIds,
    onlyUserIds,
  };

  const allowed = hasAccess(routeLike, deptCode, posCode, userId);

  useEffect(() => {
    if (!hasAnyUserId || allowed) return;
    Swal.fire({
      title: "권한없음",
      text: "접근 권한이 없습니다.\n관리자에게 확인 바랍니다.",
      icon: "error",
      confirmButtonColor: "#d33",
      confirmButtonText: "확인",
    }).then(() => setShouldRedirect(true));
  }, [allowed, hasAnyUserId]);

  if (!hasAnyUserId) {
    return shouldMoveLogin ? <Navigate to="/authentication/sign-in" replace /> : null;
  }

  if (!allowed) {
    return shouldRedirect ? <Navigate to="/" replace /> : null;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedDepartments: PropTypes.arrayOf(PropTypes.number),
  allowedPositions: PropTypes.arrayOf(PropTypes.number),
  accessMode: PropTypes.oneOf(["AND", "OR"]),

  // ✅ user_id 기반 권한
  allowUserIds: PropTypes.arrayOf(PropTypes.string),
  denyUserIds: PropTypes.arrayOf(PropTypes.string),
  onlyUserIds: PropTypes.arrayOf(PropTypes.string),
};

/* =========================================================
   ✅ App
========================================================= */

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    direction,
    layout,
    openConfigurator,
    sidenavColor,
    transparentSidenav,
    whiteSidenav,
    darkMode,
  } = controller;

  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();
  const [, setAuthTick] = useState(0);
  const sessionPopupOpenRef = useRef(false);

  // 🔹 현재 로그인한 유저의 부서/직책/아이디
  const { deptCode, posCode, userId } = getUserCodes();

  // 🔹 권한 기준으로 걸러진 routes
  const filteredRoutes = useMemo(
    () => filterRoutesByPermission(routes, deptCode, posCode, userId),
    [deptCode, posCode, userId]
  );

  // RTL 캐시 생성
  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });

    setRtlCache(cacheRtl);
  }, []);

  // 미니 사이드바 마우스 진입 시 확장 처리
  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  // 미니 사이드바 마우스 이탈 시 축소 처리
  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  // 설정 패널 열림 상태 토글
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  const localSessionId = localStorage.getItem("login_session_id");
  const tabSessionId = sessionStorage.getItem("login_session_id");
  const localUserId = localStorage.getItem("user_id");
  const tabUserId = getSessionUserId();
  const isSessionMatched =
    !localSessionId || !tabSessionId
      ? false
      : localSessionId === tabSessionId || (localUserId && tabUserId && localUserId === tabUserId);
  const isAuthed = (!!localUserId || !!tabUserId) && (isSessionMatched || !localSessionId || !tabSessionId);

  // body dir 속성 설정
  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  useEffect(() => {
    // 최초 진입 시 탭 세션을 로컬 세션과 동기화
    const localSessionId = localStorage.getItem("login_session_id");
    if (localSessionId && !sessionStorage.getItem("login_session_id")) {
      sessionStorage.setItem("login_session_id", localSessionId);
      const storedUserId = localStorage.getItem("user_id");
      if (storedUserId) sessionStorage.setItem("login_user_id", storedUserId);
    }

    // 다른 탭에서 다른 계정으로 로그인되면 안내 후 이 탭을 로그인 화면으로 돌림
    const showSessionChangedPopup = (nextSessionId) => {
      const currentLocalUserId = localStorage.getItem("user_id");
      const currentTabUserId = sessionStorage.getItem("login_user_id");
      if (currentLocalUserId && currentTabUserId && currentLocalUserId === currentTabUserId) {
        sessionStorage.setItem("login_session_id", nextSessionId || "");
        setAuthTick((prev) => prev + 1);
        return;
      }
      if (sessionPopupOpenRef.current) return;
      sessionPopupOpenRef.current = true;

      Swal.fire({
        title: "로그인 변경",
        text: "다른 계정으로 로그인되었습니다.",
        icon: "warning",
        confirmButtonText: "확인",
        confirmButtonColor: "#d33",
      }).then(() => {
        sessionStorage.removeItem("login_session_id");
        setAuthTick((prev) => prev + 1);
        sessionPopupOpenRef.current = false;
        window.location.hash = "/authentication/sign-in";
      });
    };

    // 포커스/가시성 변경 시 세션 불일치 재검사
    const checkSessionMismatch = () => {
      const currentLocalSession = localStorage.getItem("login_session_id");
      const currentTabSession = sessionStorage.getItem("login_session_id");
      const currentLocalUserId = localStorage.getItem("user_id");
      const currentTabUserId = sessionStorage.getItem("login_user_id");
      if (currentLocalSession && !currentTabSession) {
        sessionStorage.setItem("login_session_id", currentLocalSession);
        if (currentLocalUserId) sessionStorage.setItem("login_user_id", currentLocalUserId);
        setAuthTick((prev) => prev + 1);
        return;
      }

      if (currentLocalUserId && currentTabUserId && currentLocalUserId === currentTabUserId) {
        if (currentLocalSession && currentTabSession && currentLocalSession !== currentTabSession) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
        }
        return;
      }

      if (currentLocalSession && currentTabSession && currentLocalSession !== currentTabSession) {
        if (currentLocalUserId && !currentTabUserId) {
          sessionStorage.setItem("login_user_id", currentLocalUserId);
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        if (currentLocalUserId && currentTabUserId && currentLocalUserId === currentTabUserId) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        showSessionChangedPopup(currentLocalSession);
      }
    };

    // 다른 탭의 storage 변경 이벤트에 반응
    const handleStorage = (event) => {
      if (!event) return;

      const watchKeys = new Set([
        "login_session_id",
        "user_id",
        "user_type",
        "position",
        "department",
        "account_id",
      ]);

      if (!watchKeys.has(event.key)) return;

      const currentLocalSession = localStorage.getItem("login_session_id");
      const currentTabSession = sessionStorage.getItem("login_session_id");
      const currentLocalUserId = localStorage.getItem("user_id");
      const currentTabUserId = sessionStorage.getItem("login_user_id");
      if (currentLocalUserId && currentTabUserId && currentLocalUserId === currentTabUserId) {
        if (currentLocalSession && currentTabSession && currentLocalSession !== currentTabSession) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
        }
        return;
      }

      if (event.key === "login_session_id" && currentLocalSession) {
        if (!currentTabSession) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          if (currentLocalUserId) sessionStorage.setItem("login_user_id", currentLocalUserId);
          setAuthTick((prev) => prev + 1);
          return;
        }
        if (currentLocalUserId && !currentTabUserId) {
          sessionStorage.setItem("login_user_id", currentLocalUserId);
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        if (
          currentLocalSession !== currentTabSession &&
          currentLocalUserId &&
          currentTabUserId &&
          currentLocalUserId === currentTabUserId
        ) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        if (currentLocalSession !== currentTabSession) {
          showSessionChangedPopup(currentLocalSession);
          return;
        }
      }

      if (currentLocalSession && !currentTabSession) {
        sessionStorage.setItem("login_session_id", currentLocalSession);
        if (currentLocalUserId) sessionStorage.setItem("login_user_id", currentLocalUserId);
        setAuthTick((prev) => prev + 1);
        return;
      }

      if (currentLocalSession && currentTabSession && currentLocalSession !== currentTabSession) {
        if (currentLocalUserId && !currentTabUserId) {
          sessionStorage.setItem("login_user_id", currentLocalUserId);
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        if (currentLocalUserId && currentTabUserId && currentLocalUserId === currentTabUserId) {
          sessionStorage.setItem("login_session_id", currentLocalSession);
          setAuthTick((prev) => prev + 1);
          return;
        }
        showSessionChangedPopup(currentLocalSession);
        return;
      }

      setAuthTick((prev) => prev + 1);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", checkSessionMismatch);
    document.addEventListener("visibilitychange", checkSessionMismatch);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", checkSessionMismatch);
      document.removeEventListener("visibilitychange", checkSessionMismatch);
    };
  }, []);

  // 라우트 변경 시 페이지 스크롤 초기화
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/authentication/sign-in") {
      sessionStorage.removeItem("login_session_id");
      sessionStorage.removeItem("login_user_id");
      setAuthTick((prev) => prev + 1);
    }
  }, [pathname]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) return getRoutes(route.collapse);

      if (route.route) {
        const isAuthRoute =
          route.route === "/authentication/sign-in" ||
          route.route === "/authentication/sign-up";

        return (
          <Route
            path={route.route}
            key={route.key}
            element={
              isAuthRoute ? (
                route.component
              ) : (
                <ProtectedRoute
                  allowedDepartments={route.allowedDepartments}
                  allowedPositions={route.allowedPositions}
                  accessMode={route.accessMode}
                  allowUserIds={route.allowUserIds}
                  denyUserIds={route.denyUserIds}
                  onlyUserIds={route.onlyUserIds}
                >
                  {route.component}
                </ProtectedRoute>
              )
            }
          />
        );
      }

      return null;
    });

  // (옵션) 설정 버튼을 쓰고 싶으면 여기 정의 후 Sidenav 아래에 렌더링
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

  const routesForRouter = (
    <Routes>
      {/* ✅ routes.js 기반 (권한 필터 적용) */}
      {getRoutes(filteredRoutes)}

      {/* ✅ 첫 접속(/) 기본 화면 */}
      <Route
        path="/"
        element={<Navigate to={isAuthed ? "/dashboard" : "/authentication/sign-in"} replace />}
      />

      {/* ✅ 커스텀 라우트들 */}
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

      {/* 영업 메뉴 */}
      <Route path="/business/telemanager/:account_id" element={<TeleManagerSheet />} />
      <Route path="/business/corcar/:account_id" element={<CorCarSheet />} />
      <Route path="/business/cookwear/:account_id" element={<CookWearSheet />} />
      <Route path="/business/accountfile/:account_id" element={<AccountFileSheet />} />

      {/* 기타 */}
      <Route path="/fieldboard/fieldbordtab" element={<FieldBoardTabs />} />

      {/* ✅ 나머지 못 찾는 경로는 전부 /로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
        <CssBaseline />
        {layout === "dashboard" && isAuthed && deptCode !== 7 && (
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
        {routesForRouter}
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && isAuthed && deptCode !== 7 && (
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
      {routesForRouter}
    </ThemeProvider>
  );
}
