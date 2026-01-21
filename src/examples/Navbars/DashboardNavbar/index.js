/* eslint-disable react/function-component-definition */
import { useState, useEffect, useMemo } from "react";
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

// ✅ 승인 Dialog
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";

// MD
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Example
import NotificationItem from "examples/Items/NotificationItem";
import DataTable from "examples/Tables/DataTable";
import api from "api/api";
import Swal from "sweetalert2";

// ✅ 프로필 모달
import UserProfileModal from "examples/Navbars/DefaultNavbar/UserProfileModal";

// Styles
import { navbar, navbarContainer, navbarIconButton } from "examples/Navbars/DashboardNavbar/styles";

// Context
import { useMaterialUIController, setTransparentNavbar, setMiniSidenav } from "context";

function DashboardNavbar({ absolute, light, isMini, title, showMenuButtonWhenMini }) {
  const NAVBAR_H = 48;

  // ✅ 화면이 너무 작아지면 오른쪽(유저명/프로필/알림) 숨김
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm")); // 600px 이하
  const hideRightArea = isSmDown;

  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, darkMode } = controller;

  const [openMenu, setOpenMenu] = useState(null);
  const [openProfile, setOpenProfile] = useState(false);

  // 계약 만료 알림
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [userName, setUserName] = useState("");
  const [position_name, setPositionName] = useState("");

  const userId = localStorage.getItem("user_id");

  // 관리자 여부 체크
  const isAdmin = (() => {
    const pos = String(localStorage.getItem("position") ?? "");
    const dept = String(localStorage.getItem("department") ?? "");
    return pos === "0" || pos === "1" || dept === "6";
  })();

  // ✅ 승인대기 Dialog 상태 (Navbar에만 존재!)
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRows, setApproveRows] = useState([]);
  const [approveOrigin, setApproveOrigin] = useState([]);
  const [approveLoading2, setApproveLoading2] = useState(false);

  const pendingCount = approveRows.length;

  // ------------------ 승인대기 목록 표시에 필요한 유틸 ------------------
  const DEPT_MAP = {
    0: "대표",
    1: "신사업팀",
    2: "회계팀",
    3: "인사팀",
    4: "영업팀",
    5: "운영팀",
    6: "개발팀",
  };

  const getUserTypeText = (v) => {
    const t = String(v ?? "");
    if (t === "1") return "ceo";
    if (t === "2") return "본사";
    if (t === "3") return "현장";
    return t;
  };

  const getDeptOrAccountText = (row) => {
    if (row?.account_name) return row.account_name;
    if (row?.account_id) return row.account_id;
    const d = row?.department;
    return DEPT_MAP?.[d] ?? String(d ?? "");
  };

  const getPositionText = (v) => {
    const p = Number(v);
    if (p === 0) return "대표";
    if (p === 1) return "팀장";
    if (p === 2) return "파트장";
    if (p >= 3 && p <= 7) return "매니저";
    if (p === 8) return "영양사";
    return String(v ?? "");
  };

  const pick = (r, ...keys) => {
    for (const k of keys) {
      if (r?.[k] !== undefined && r?.[k] !== null && String(r[k]).trim() !== "") return r[k];
    }
    return "";
  };

  // ✅ 승인대기 목록 조회 (use_yn='N'만)  ※ approval_requested_* 로직 제거
  const fetchApprovePendingList = async (withLoading = false) => {
    if (!isAdmin) return;

    try {
      if (withLoading) setApproveLoading2(true);

      // ✅ 백엔드에서 use_yn='N'만 내려주도록 맞추면 가장 깔끔합니다.
      const res = await api.get("/User/ApprovalPendingList");

      const raw =
        Array.isArray(res.data?.list) ? res.data.list :
          Array.isArray(res.data) ? res.data :
            Array.isArray(res.data?.data) ? res.data.data :
              [];

      const mapped = raw.map((r) => {
        const userId2 = pick(r, "user_id", "USER_ID", "userId");
        const userName2 = pick(r, "user_name", "USER_NAME", "userName");
        const userType = pick(r, "user_type", "USER_TYPE", "userType");
        const dept = pick(r, "department", "DEPARTMENT", "dept");
        const accId = pick(r, "account_id", "ACCOUNT_ID", "accountId");
        const accName = pick(r, "account_name", "ACCOUNT_NAME", "accountName");
        const position = pick(r, "position", "POSITION", "pos");
        const useYn = String(pick(r, "use_yn", "USE_YN", "useYn") || "N").trim().toUpperCase();

        const userTypeName =
          pick(r, "user_type_name", "USER_TYPE_NAME", "userTypeName") || getUserTypeText(userType);

        const deptOrAccountName =
          pick(r, "dept_or_account_name", "DEPT_OR_ACCOUNT_NAME", "deptOrAccountName") ||
          (accName || getDeptOrAccountText({ account_id: accId, department: dept }));

        const positionName =
          pick(r, "position_name", "POSITION_NAME", "positionName") || getPositionText(position);

        return {
          ...r,
          user_id: userId2,
          user_name: userName2,
          user_type: userType,
          department: dept,
          account_id: accId,
          account_name: accName,
          position,
          use_yn: useYn,
          user_type_name: userTypeName,
          dept_or_account_name: deptOrAccountName,
          position_name: positionName,
        };
      });

      // ✅ 핵심: use_yn === 'N'만
      const pending = mapped.filter((r) => r.use_yn === "N");

      setApproveRows(pending);
      setApproveOrigin(pending.map((r) => ({ user_id: r.user_id, use_yn: r.use_yn })));
    } catch (e) {
      console.error(e);
      setApproveRows([]);
      setApproveOrigin([]);
    } finally {
      if (withLoading) setApproveLoading2(false);
    }
  };

  const openApproveDialog = async () => {
    setApproveRows([]);
    setApproveOrigin([]);
    setApproveOpen(true);
    await fetchApprovePendingList(true);
  };

  const changeUseYn = (userId2, value) => {
    setApproveRows((prev) =>
      prev.map((r) => (r.user_id === userId2 ? { ...r, use_yn: value } : r))
    );
  };

  const saveApprovals = async () => {
    const changed = approveRows
      .map((r) => ({ user_id: r.user_id, use_yn: String(r.use_yn ?? "N").trim().toUpperCase() }))
      .filter((cur) => {
        const org = approveOrigin.find((o) => o.user_id === cur.user_id);
        return !org || org.use_yn !== cur.use_yn;
      });

    if (!changed.length) {
      Swal.fire({ title: "알림", text: "변경된 항목이 없습니다.", icon: "info", confirmButtonText: "확인" });
      return;
    }

    try {
      await api.post("/User/ApprovalSave", { list: changed });

      Swal.fire({ title: "저장 완료", text: "승인 처리가 저장되었습니다.", icon: "success", confirmButtonText: "확인" });

      setApproveOpen(false);

      // ✅ 뱃지/목록 갱신
      fetchNotifications();
      fetchApprovePendingList(false);
    } catch (e) {
      console.error(e);
      Swal.fire({ title: "오류", text: "저장 중 오류가 발생했습니다.", icon: "error", confirmButtonText: "확인" });
    }
  };

  const approvalColumns = useMemo(
    () => [
      { Header: "아이디", accessor: "user_id", align: "center", width: "80px" },
      { Header: "성명", accessor: "user_name", align: "center", width: "80px" },
      { Header: "구분", accessor: "user_type_name", align: "center", width: "80px" },
      { Header: "부서/고객사", accessor: "dept_or_account_name", align: "center", width: "80px" },
      { Header: "직책", accessor: "position_name", align: "center", width: "80px" },
      { Header: "승인여부", accessor: "use_yn", align: "center", width: "80px" },
    ],
    []
  );

  const approvalTableRows = useMemo(
    () =>
      (approveRows || []).map((r) => ({
        user_id: (
          <MDTypography variant="caption" color="text" fontWeight="medium">
            {r.user_id}
          </MDTypography>
        ),
        user_name: (
          <MDTypography variant="caption" color="text" fontWeight="medium">
            {r.user_name}
          </MDTypography>
        ),
        user_type_name: (
          <MDTypography variant="caption" color="text" fontWeight="medium">
            {r.user_type_name}
          </MDTypography>
        ),
        dept_or_account_name: (
          <MDTypography variant="caption" color="text" fontWeight="medium">
            {r.dept_or_account_name}
          </MDTypography>
        ),
        position_name: (
          <MDTypography variant="caption" color="text" fontWeight="medium">
            {r.position_name}
          </MDTypography>
        ),
        use_yn: (
          <Select
            size="small"
            value={String(r.use_yn ?? "N").trim().toUpperCase()}
            onChange={(e) => changeUseYn(r.user_id, e.target.value)}
            sx={{ height: 30, minWidth: 70, fontSize: 12 }}
          >
            <MenuItem value="N">N</MenuItem>
            <MenuItem value="Y">Y</MenuItem>
          </Select>
        ),
      })),
    [approveRows]
  );

  // ------------------ 기존 Navbar 로직 ------------------
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
    const name = (localStorage.getItem("user_name") || "").trim();
    setUserName(name);
    const pn = (localStorage.getItem("position_name") || "").trim();
    setPositionName(pn);
  }, []);

  useEffect(() => {
    fetchNotifications();
    if (isAdmin) fetchApprovePendingList(false); // ✅ 관리자면 초기부터 승인대기 카운트 확보
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

  const handleOpenMenu = async (event) => {
    setOpenMenu(event.currentTarget);
    fetchNotifications();
    if (isAdmin) fetchApprovePendingList(false); // ✅ 메뉴 열 때도 최신화
  };

  const handleCloseMenu = () => setOpenMenu(null);

  // ✅ mini일 때만 “펼치기” 버튼 보이게
  const showSidenavToggle = Boolean(showMenuButtonWhenMini && miniSidenav);
  const handleToggleSidenav = () => setMiniSidenav(dispatch, !miniSidenav);

  const iconsStyle = { color: "#fff" };

  // ✅ 뱃지 카운트: 계약만료 + (관리자면) 승인대기
  const totalBadgeCount = notifications.length + (isAdmin ? pendingCount : 0);

  const renderMenu = () => {
    const showApprovalSection = isAdmin && pendingCount > 0; // ✅ 있을 때만

    return (
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
        {/* ✅ 승인대기 섹션: "있을 때만" 표시 */}
        {showApprovalSection && (
          <>
            <MDBox px={2} pt={1} pb={0.5}>
              <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
                사용자 승인 대기
              </MDTypography>
            </MDBox>

            <MDBox
              sx={{
                cursor: "pointer",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
                borderRadius: "10px",
              }}
              onClick={async () => {
                handleCloseMenu();
                await openApproveDialog();
              }}
            >
              <NotificationItem
                icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
                title={`사용자 승인 대기 목록 (${pendingCount})`}
              />
            </MDBox>

            <Divider sx={{ mx: 2, my: 0.8, opacity: 0.7 }} />
          </>
        )}

        {/* ✅ 계약 만료 알림 */}
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
  };

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
            flexWrap: "nowrap",
            "@media (min-width:600px)": { minHeight: NAVBAR_H, height: NAVBAR_H },
          })}
        >
          {/* ✅ 왼쪽 */}
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

          {/* ✅ 오른쪽 */}
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
                    badgeContent={totalBadgeCount}
                    color="error"
                    max={99}
                    invisible={totalBadgeCount === 0}
                    sx={
                      isAdmin && pendingCount > 0
                        ? {
                          "& .MuiBadge-badge": {
                            animation: "approveBlink 1.1s infinite",
                            boxShadow: "0 0 0 0 rgba(255,255,255,0.0)",
                            transform: "translate(30%, -20%)",
                          },
                          "@keyframes approveBlink": {
                            "0%": { opacity: 1, boxShadow: "0 0 0 0 rgba(255,255,255,0.0)" },
                            "50%": { opacity: 0.9, boxShadow: "0 0 10px 2px rgba(255,255,255,0.55)" },
                            "100%": { opacity: 1, boxShadow: "0 0 0 0 rgba(255,255,255,0.0)" },
                          },
                        }
                        : undefined
                    }
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

      {/* ✅ 승인대기 Dialog: Navbar에만 1개 */}
      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 800 }}>사용자 승인 대기 목록</DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          {approveLoading2 ? (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              불러오는 중...
            </MDTypography>
          ) : approveRows?.length ? (
            <DataTable
              table={{ columns: approvalColumns, rows: approvalTableRows }}
              entriesPerPage={false}
              showTotalEntries={false}
              isSorted={false}
              noEndBorder
            />
          ) : (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              승인 대기 사용자가 없습니다.
            </MDTypography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <MDButton variant="outlined" color="secondary" onClick={() => setApproveOpen(false)}>
            닫기
          </MDButton>
          <MDButton color="info" onClick={saveApprovals} disabled={approveLoading2 || !approveRows?.length}>
            저장
          </MDButton>
        </DialogActions>
      </Dialog>
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
