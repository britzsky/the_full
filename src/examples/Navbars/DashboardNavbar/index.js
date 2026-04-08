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
import api from "api/api";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { syncSharedAuthCookiesFromStorage } from "utils/sharedAuthSession";

// ✅ 프로필 모달
import UserProfileModal from "examples/Navbars/DefaultNavbar/UserProfileModal";

// Styles
import { navbar, navbarContainer, navbarIconButton } from "examples/Navbars/DashboardNavbar/styles";

// Context
import { useMaterialUIController, setTransparentNavbar, setMiniSidenav } from "context";

// ERP .env 값 기준으로 공개 웹 주소를 정한다.
const resolveTheFullWebBaseUrl = () => {
  const explicitWebBaseUrl = String(
    process.env.REACT_APP_THE_FULL_WEB_BASE_URL || process.env.REACT_APP_WEB_BASE_URL || ""
  ).trim().replace(/\/+$/, "");

  if (explicitWebBaseUrl) {
    return explicitWebBaseUrl;
  }

  const apiBaseUrl = String(process.env.REACT_APP_API_BASE_URL || "").trim();

  if (apiBaseUrl) {
    try {
      const parsedApiUrl = new URL(apiBaseUrl);
      return `${parsedApiUrl.protocol}//${parsedApiUrl.hostname}:8081`;
    } catch (error) {
      // API 주소 파싱에 실패하면 아래 기본 로컬 주소를 사용한다.
    }
  }

  return "http://localhost:8081";
};

function DashboardNavbar({ absolute, light, isMini, title, showMenuButtonWhenMini }) {
  const NAVBAR_H = 48;
  // ✅ 승인대기/문의답변대기/알림 뱃지 자동 갱신 주기 (화면 전체 새로고침 없이 알림만 업데이트)
  const NOTIF_POLL_MS = 30000;
  const CONTACT_PENDING_ENDPOINTS = ["/ERP/ContactInquiryPendingList", "/User/ContactInquiryPendingList"];
  const THE_FULL_WEB_BASE_URL = resolveTheFullWebBaseUrl();

  // ✅ 화면이 너무 작아지면 오른쪽(유저명/프로필/알림) 숨김
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm")); // 600px 이하
  const hideRightArea = isSmDown;

  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, darkMode } = controller;

  const [openMenu, setOpenMenu] = useState(null);
  const [openProfile, setOpenProfile] = useState(false);
  const navigate = useNavigate();

  // 계약 만료 알림
  const [notifications, setNotifications] = useState([]);
  const [electronicPaymentNotifications, setElectronicPaymentNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [userName, setUserName] = useState("");
  const [position_name, setPositionName] = useState("");

  const userId = localStorage.getItem("user_id");
  const webPosition = String(localStorage.getItem("web_position") ?? "").trim().toUpperCase();
  const canViewPromotionAlert = webPosition === "P" || webPosition === "A";
  const canViewInquiryAlert = webPosition === "I" || webPosition === "A";
  const shouldAlwaysShowInquirySection = canViewInquiryAlert;

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

  // ✅ 문의 목록 Dialog 상태 (Navbar에만 존재)
  const [inquiryPendingOpen, setInquiryPendingOpen] = useState(false);
  const [inquiryPendingRows, setInquiryPendingRows] = useState([]);
  const [inquiryPendingLoading, setInquiryPendingLoading] = useState(false);

  // 이달 생일자 알림
  const [birthdayMemberOpen, setBirthdayMemberOpen] = useState(false);
  const [birthdayMemberRows, setBirthdayMemberRows] = useState([]);
  const [birthdayMemberLoading, setBirthdayMemberLoading] = useState(false);
  const [birthdayMemberSort, setBirthdayMemberSort] = useState({ key: "birthday", direction: "asc" });

  const inquiryPendingCount = (inquiryPendingRows || []).filter((row) => row?.answer_yn !== "Y").length;
  const birthdayMemberCount = birthdayMemberRows.length;
  const electronicPaymentNotifCount = electronicPaymentNotifications.length;
  const currentMonthText = `${new Date().getMonth() + 1}월`;
  const inquiryMenuSectionTitle = inquiryPendingCount > 0 ? "문의 답변 대기" : "문의 목록";
  const inquiryMenuItemTitle =
    inquiryPendingCount > 0 ? `문의 답변 대기 목록 (${inquiryPendingCount})` : "문의 목록";
  const promotionMenuSectionTitle = "홍보 게시글";
  const promotionMenuItemTitle = "홍보 게시글 이동";

  // ------------------ 승인대기 목록 표시에 필요한 유틸 ------------------
  const DEPT_MAP = {
    0: "대표",
    1: "신사업팀",
    2: "회계팀",
    3: "인사팀",
    4: "영업팀",
    5: "운영팀",
    6: "개발팀",
    7: "현장",
  };

  const getUserTypeText = (v) => {
    const t = String(v ?? "");
    if (t === "1") return "ceo";
    if (t === "2") return "본사";
    if (t === "3") return "현장";
    if (t === "4") return "통합/유틸";
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

  // 생일 문자열을 월/일 정렬용 숫자로 변환한다.
  const getBirthdaySortValue = (birthday) => {
    const digits = String(birthday || "").replace(/\D/g, "");
    if (digits.length >= 4) {
      return Number(digits.slice(0, 4));
    }
    return 9999;
  };

  const getBirthdaySortDirectionMark = (sortState, key) => {
    if (!sortState || sortState.key !== key) return "";
    return sortState.direction === "asc" ? " ▲" : " ▼";
  };

  const compareBirthdayTextValue = (aValue, bValue) => {
    const aText = String(aValue ?? "").trim();
    const bText = String(bValue ?? "").trim();
    const aEmpty = !aText;
    const bEmpty = !bText;

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    return aText.localeCompare(bText, "ko", { numeric: true, sensitivity: "base" });
  };

  const toggleBirthdayMemberSort = (key) => {
    setBirthdayMemberSort((prev) => {
      if (prev.key === key) {
        return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedBirthdayMemberRows = useMemo(() => {
    const rows = [...(birthdayMemberRows || [])];

    return rows.sort((a, b) => {
      const compareBirthday = getBirthdaySortValue(a?.birthday) - getBirthdaySortValue(b?.birthday);
      const compareAccountName = compareBirthdayTextValue(a?.account_name, b?.account_name);
      const compareName = compareBirthdayTextValue(a?.name, b?.name);

      if (birthdayMemberSort.key === "accountName") {
        if (compareAccountName !== 0) {
          return birthdayMemberSort.direction === "asc" ? compareAccountName : -compareAccountName;
        }
        if (compareBirthday !== 0) return compareBirthday;
        return compareName;
      }

      if (compareBirthday !== 0) {
        return birthdayMemberSort.direction === "asc" ? compareBirthday : -compareBirthday;
      }
      if (compareAccountName !== 0) return compareAccountName;
      return compareName;
    });
  }, [birthdayMemberRows, birthdayMemberSort]);

  // the_full_web 처리
  const buildInquiryManageUrl = (inquiryId) => {
    const parsedId = Number(inquiryId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return `${THE_FULL_WEB_BASE_URL}/contact/manage`;
    }

    return `${THE_FULL_WEB_BASE_URL}/contact/manage/${parsedId}`;
  };

  const openInquiryManagePage = (inquiryId) => {
    // 문의답변 관리 화면으로 이동하기 직전에 ERP 로그인 정보를 공용 쿠키로 다시 맞춘다.
    syncSharedAuthCookiesFromStorage();
    const targetUrl = buildInquiryManageUrl(inquiryId);
    window.open(targetUrl, "_blank", "noopener");
  };

  // 문의관리 목록으로 이동할 때도 ERP 로그인 정보를 공용 쿠키로 다시 맞춘다.
  const openInquiryManageListPage = () => {
    openInquiryManagePage();
  };

  // 홍보 게시판으로 이동하기 직전에 ERP 로그인 정보를 공용 쿠키로 다시 맞춘다.
  const openPromotionBoardPage = () => {
    syncSharedAuthCookiesFromStorage();
    window.open(`${THE_FULL_WEB_BASE_URL}/promotion`, "_blank", "noopener");
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
        const utilMemberType = pick(r, "util_member_type", "UTIL_MEMBER_TYPE", "utilMemberType");
        const useYn = String(pick(r, "use_yn", "USE_YN", "useYn") || "N").trim().toUpperCase();

        const utilLabel =
          String(utilMemberType) === "7" ? "통합" : String(utilMemberType) === "6" ? "유틸" : "통합/유틸";

        const userTypeName =
          pick(r, "user_type_name", "USER_TYPE_NAME", "userTypeName") ||
          (String(userType) === "4" ? utilLabel : getUserTypeText(userType));

        const deptOrAccountName =
          pick(r, "dept_or_account_name", "DEPT_OR_ACCOUNT_NAME", "deptOrAccountName") ||
          (accName || getDeptOrAccountText({ account_id: accId, department: dept }));

        const positionName =
          pick(r, "position_name", "POSITION_NAME", "positionName") ||
          (String(userType) === "4" ? utilLabel : getPositionText(position));

        return {
          ...r,
          user_id: userId2,
          user_name: userName2,
          user_type: userType,
          department: dept,
          account_id: accId,
          account_name: accName,
          position,
          util_member_type: utilMemberType,
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

  // ✅ 문의 목록 조회 (answer_yn 전체)
  const fetchInquiryPendingList = async (withLoading = false) => {
    if (!canViewInquiryAlert) {
      setInquiryPendingRows([]);
      return;
    }

    try {
      if (withLoading) setInquiryPendingLoading(true);

      let responseData = null;
      for (const endpoint of CONTACT_PENDING_ENDPOINTS) {
        try {
          // ERP 문의 목록 모달은 답변 여부와 상관없이 전체 목록을 조회한다.
          const res = await api.get(endpoint, { params: { answer_yn: "ALL" } });
          responseData = res.data;
          break;
        } catch (error) {
          const statusCode = Number(error?.response?.status || 0);
          if (statusCode && statusCode !== 404) {
            throw error;
          }
        }
      }

      const raw =
        Array.isArray(responseData?.list) ? responseData.list :
          Array.isArray(responseData) ? responseData :
            Array.isArray(responseData?.data) ? responseData.data :
              [];

      const mapped = raw
        .map((row) => {
          const inquiryId = Number(pick(row, "id", "ID", "inquiry_id", "INQUIRY_ID", "inquiryId"));
          if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
            return null;
          }

          const answerYn = String(pick(row, "answer_yn", "ANSWER_YN", "answerYn") || "N").trim().toUpperCase();
          return {
            id: inquiryId,
            title: String(pick(row, "title", "TITLE") || "").trim(),
            business_name: String(pick(row, "business_name", "BUSINESS_NAME", "businessName") || "").trim(),
            manager_name: String(pick(row, "manager_name", "MANAGER_NAME", "managerName") || "").trim(),
            email: String(pick(row, "email", "EMAIL") || "").trim(),
            phone_number: String(pick(row, "phone_number", "PHONE_NUMBER", "phoneNumber") || "").trim(),
            answer_yn: answerYn === "Y" ? "Y" : "N",
          };
        })
        .filter(Boolean)
        .sort((beforeRow, afterRow) => {
          if (beforeRow.answer_yn !== afterRow.answer_yn) {
            return beforeRow.answer_yn === "N" ? -1 : 1;
          }
          return afterRow.id - beforeRow.id;
        });

      setInquiryPendingRows(mapped);
    } catch (error) {
      console.error("문의 답변 대기 조회 실패:", error);
      setInquiryPendingRows([]);
    } finally {
      if (withLoading) setInquiryPendingLoading(false);
    }
  };

  const openApproveDialog = async () => {
    setApproveRows([]);
    setApproveOrigin([]);
    setApproveOpen(true);
    await fetchApprovePendingList(true);
  };

  const openInquiryPendingDialog = async () => {
    setInquiryPendingRows([]);
    setInquiryPendingOpen(true);
    await fetchInquiryPendingList(true);
  };

  const openBirthdayMemberDialog = async () => {
    setBirthdayMemberSort({ key: "birthday", direction: "asc" });
    setBirthdayMemberRows([]);
    setBirthdayMemberOpen(true);
    await fetchBirthdayMemberList(true);
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

  // accountissuesheettab.js 테이블 톤을 Navbar 모달 테이블에도 동일 적용
  const pendingTableBorderColor = "#cfd8e3";
  const pendingTableHeadBg = "#dbe7f5";

  const pendingTableWrapSx = {
    border: `1px solid ${pendingTableBorderColor}`,
    borderRadius: 1,
    overflow: "auto",
    background: "#fff",
  };

  const pendingTableStyle = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "fixed",
    borderLeft: `1px solid ${pendingTableBorderColor}`,
    borderTop: `1px solid ${pendingTableBorderColor}`,
  };

  const pendingHeadCellStyle = {
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 700,
    color: "#344767",
    textAlign: "center",
    background: pendingTableHeadBg,
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
    borderTop: `1px solid ${pendingTableBorderColor}`,
    borderRight: `1px solid ${pendingTableBorderColor}`,
    borderBottom: `1px solid ${pendingTableBorderColor}`,
  };

  const pendingBodyCellStyle = {
    padding: "4px 8px",
    fontSize: 12,
    textAlign: "center",
    whiteSpace: "nowrap",
    borderRight: `1px solid ${pendingTableBorderColor}`,
    borderBottom: `1px solid ${pendingTableBorderColor}`,
    verticalAlign: "middle",
    background: "#fff",
  };
  const inquiryActionButtonSx = { minWidth: 92, py: 0.15, px: 1, fontSize: 12, lineHeight: 1.2 };

  const approvalChangedAccentColor = "#d32f2f";

  const isApprovalUseYnChanged = (row) => {
    const current = String(row?.use_yn ?? "N").trim().toUpperCase();
    const original = approveOrigin.find((item) => item.user_id === row?.user_id);
    if (!original) return false;
    return current !== String(original.use_yn ?? "N").trim().toUpperCase();
  };

  const renderApprovalPendingTable = () => (
    <MDBox sx={pendingTableWrapSx}>
      <table style={pendingTableStyle}>
        <colgroup>
          <col style={{ width: 96 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={pendingHeadCellStyle}>아이디</th>
            <th style={pendingHeadCellStyle}>성명</th>
            <th style={pendingHeadCellStyle}>구분</th>
            <th style={pendingHeadCellStyle}>부서/고객사</th>
            <th style={pendingHeadCellStyle}>직책</th>
            <th style={pendingHeadCellStyle}>승인여부</th>
          </tr>
        </thead>
        <tbody>
          {(approveRows || []).map((row) => {
            const useYnChanged = isApprovalUseYnChanged(row);
            return (
              <tr key={row.user_id}>
                <td style={pendingBodyCellStyle}>{row.user_id || "-"}</td>
                <td style={pendingBodyCellStyle}>{row.user_name || "-"}</td>
                <td style={pendingBodyCellStyle}>{row.user_type_name || "-"}</td>
                <td style={pendingBodyCellStyle}>
                  {row.dept_or_account_name || "-"}
                </td>
                <td style={pendingBodyCellStyle}>{row.position_name || "-"}</td>
                <td style={pendingBodyCellStyle}>
                  <Select
                    size="small"
                    value={String(row.use_yn ?? "N").trim().toUpperCase()}
                    onChange={(e) => changeUseYn(row.user_id, e.target.value)}
                    IconComponent={() => null}
                    displayEmpty
                    sx={{
                      height: 30,
                      minWidth: 70,
                      backgroundColor: "#f1f3f5",
                      "& .MuiOutlinedInput-notchedOutline": {
                        border: useYnChanged ? `1px solid ${approvalChangedAccentColor}` : "none !important",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        border: useYnChanged ? `1px solid ${approvalChangedAccentColor}` : "none !important",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        border: useYnChanged ? `1px solid ${approvalChangedAccentColor}` : "none !important",
                      },
                      "& .MuiSelect-select": {
                        fontSize: 12,
                        fontWeight: 700,
                        minHeight: "25px !important",
                        height: "25px",
                        padding: "0 10px !important",
                        boxSizing: "border-box",
                        display: "flex !important",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: useYnChanged ? approvalChangedAccentColor : "#495057",
                      },
                    }}
                  >
                    <MenuItem value="N">N</MenuItem>
                    <MenuItem value="Y">Y</MenuItem>
                  </Select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </MDBox>
  );

  const renderInquiryPendingTable = () => (
    <MDBox sx={pendingTableWrapSx}>
      <table style={pendingTableStyle}>
        <colgroup>
          <col style={{ width: 70 }} />
          <col style={{ width: 260 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 130 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={pendingHeadCellStyle}>NO</th>
            <th style={pendingHeadCellStyle}>제목</th>
            <th style={pendingHeadCellStyle}>업장명</th>
            <th style={pendingHeadCellStyle}>담당자</th>
            <th style={pendingHeadCellStyle}>이메일</th>
            <th style={pendingHeadCellStyle}>연락처</th>
            <th style={pendingHeadCellStyle}>문의답변</th>
          </tr>
        </thead>
        <tbody>
          {(inquiryPendingRows || []).map((row) => (
            <tr key={row.id}>
              <td style={pendingBodyCellStyle}>{row.id}</td>
              <td
                style={{
                  ...pendingBodyCellStyle,
                  textAlign: "left",
                  paddingLeft: "10px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={row.title || "-"}
              >
                {row.title || "-"}
              </td>
              <td style={pendingBodyCellStyle}>{row.business_name || "-"}</td>
              <td style={pendingBodyCellStyle}>{row.manager_name || "-"}</td>
              <td style={pendingBodyCellStyle}>{row.email || "-"}</td>
              <td style={pendingBodyCellStyle}>{row.phone_number || "-"}</td>
              <td style={pendingBodyCellStyle}>
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={row.answer_yn !== "Y" ? () => openInquiryManagePage(row.id) : undefined}
                  disabled={row.answer_yn === "Y"}
                  tabIndex={row.answer_yn === "Y" ? -1 : 0}
                  sx={{
                    ...inquiryActionButtonSx,
                    visibility: row.answer_yn === "Y" ? "hidden" : "visible",
                    pointerEvents: row.answer_yn === "Y" ? "none" : "auto",
                  }}
                >
                  문의답변
                </MDButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </MDBox>
  );

  const renderBirthdayMemberTable = () => (
    <MDBox sx={pendingTableWrapSx}>
      <table style={pendingTableStyle}>
        <colgroup>
          <col style={{ width: 70 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={pendingHeadCellStyle}>NO</th>
            <th
              style={{ ...pendingHeadCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => toggleBirthdayMemberSort("accountName")}
            >
              {`업장명${getBirthdaySortDirectionMark(birthdayMemberSort, "accountName")}`}
            </th>
            <th style={pendingHeadCellStyle}>성명</th>
            <th
              style={{ ...pendingHeadCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => toggleBirthdayMemberSort("birthday")}
            >
              {`생일${getBirthdaySortDirectionMark(birthdayMemberSort, "birthday")}`}
            </th>
          </tr>
        </thead>
        <tbody>
          {(sortedBirthdayMemberRows || []).map((row, index) => (
            <tr key={row.member_id || `${row.account_id || "account"}-${row.name || index}`}>
              <td style={pendingBodyCellStyle}>{index + 1}</td>
              <td style={pendingBodyCellStyle}>{row.account_name || "-"}</td>
              <td style={pendingBodyCellStyle}>{row.name || "-"}</td>
              <td style={pendingBodyCellStyle}>{row.birthday || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MDBox>
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
    fetchElectronicPaymentNotifications();
    if (isAdmin) fetchApprovePendingList(false); // ✅ 관리자면 초기부터 승인대기 카운트 확보
    fetchInquiryPendingList(false);
    fetchBirthdayMemberList(false);
  }, [canViewInquiryAlert]);

  useEffect(() => {
    // ✅ 주기적 폴링: 탭이 보일 때만 승인대기/문의답변대기/알림 리스트 갱신
    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchNotifications();
      fetchElectronicPaymentNotifications();
      if (isAdmin) fetchApprovePendingList(false);
      fetchInquiryPendingList(false);
      fetchBirthdayMemberList(false);
    }, NOTIF_POLL_MS);

    return () => clearInterval(intervalId);
  }, [canViewInquiryAlert, isAdmin]);

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

  const fetchBirthdayMemberList = async (withLoading = false) => {
    if (!userId) {
      setBirthdayMemberRows([]);
      return;
    }

    try {
      if (withLoading) setBirthdayMemberLoading(true);

      const res = await api.get("/User/BirthdayMemberList", { params: { user_id: userId } });
      const raw =
        Array.isArray(res.data?.list) ? res.data.list :
          Array.isArray(res.data) ? res.data :
            Array.isArray(res.data?.data) ? res.data.data :
              [];

      const mapped = raw
        .map((row) => ({
          member_id: pick(row, "member_id", "MEMBER_ID", "memberId"),
          account_id: pick(row, "account_id", "ACCOUNT_ID", "accountId"),
          account_name: String(pick(row, "account_name", "ACCOUNT_NAME", "accountName") || "").trim(),
          name: String(pick(row, "name", "NAME") || "").trim(),
          birthday: String(pick(row, "birthday", "BIRTHDAY", "birthday_md", "BIRTHDAY_MD") || "").trim(),
        }))
        .filter((row) => row.member_id || row.account_name || row.name || row.birthday);

      setBirthdayMemberRows(mapped);
    } catch (error) {
      console.error("이달 생일자 조회 실패:", error);
      setBirthdayMemberRows([]);
    } finally {
      if (withLoading) setBirthdayMemberLoading(false);
    }
  };

  const fetchElectronicPaymentNotifications = async () => {
    if (!userId) {
      setElectronicPaymentNotifications([]);
      return;
    }

    try {
      const res = await api.get("/HeadOffice/ElectronicPaymentNotificationList", {
        params: { user_id: userId },
      });
      setElectronicPaymentNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("전자결재 알림 조회 실패:", e);
      setElectronicPaymentNotifications([]);
    }
  };

  useEffect(() => {
    // 상세 모달에서 결재/반려 저장 완료 시 알림을 즉시 다시 읽는다.
    const handleElectronicPaymentNotifRefresh = () => {
      fetchElectronicPaymentNotifications();
    };

    window.addEventListener("electronic-payment-notification-refresh", handleElectronicPaymentNotifRefresh);
    return () => {
      window.removeEventListener("electronic-payment-notification-refresh", handleElectronicPaymentNotifRefresh);
    };
  }, []);

  const markElectronicPaymentNotificationRead = async (paymentId, notifyType) => {
    const paymentIdText = String(paymentId ?? "").trim();
    const notifyTypeText = String(notifyType ?? "").trim();
    const loginUserId = String(userId ?? "").trim();

    if (!paymentIdText || !loginUserId) return;
    if (notifyTypeText !== "승인" && notifyTypeText !== "반려") return;

    try {
      await api.post("/HeadOffice/ElectronicPaymentNotificationReadSave", {
        payment_id: paymentIdText,
        user_id: loginUserId,
        notify_type: notifyTypeText,
      });
      // 결재요청 알림은 기존처럼 유지하고, 승인/반려 알림만 즉시 숨긴다.
      setElectronicPaymentNotifications((prev) =>
        (prev || []).filter((row) => {
          const rowPaymentId = String(row?.payment_id ?? "").trim();
          const rowNotifyType = String(row?.notify_type ?? "").trim();
          return !(rowPaymentId === paymentIdText && rowNotifyType === notifyTypeText);
        })
      );
    } catch (e) {
      console.error("전자결재 알림 읽음 처리 실패:", e);
    }
  };

  const goElectronicPaymentManage = (paymentId) => {
    const params = new URLSearchParams();
    params.set("tab", "1");
    if (paymentId != null && String(paymentId).trim() !== "") {
      params.set("payment_id", String(paymentId).trim());
    }
    // 같은 문서를 연속 클릭해도 상세 오픈 effect가 다시 실행되도록 토큰 추가
    params.set("open_ts", String(Date.now()));
    navigate(`/electronicpaymentmanager?${params.toString()}`);
  };

  const handleOpenMenu = async (event) => {
    setOpenMenu(event.currentTarget);
    fetchNotifications();
    fetchElectronicPaymentNotifications();
    if (isAdmin) fetchApprovePendingList(false); // ✅ 메뉴 열 때도 최신화
    fetchInquiryPendingList(false); // ✅ 메뉴 열 때 문의답변대기도 최신화
    fetchBirthdayMemberList(false);
  };

  const handleCloseMenu = () => setOpenMenu(null);

  // ✅ mini일 때만 “펼치기” 버튼 보이게
  const showSidenavToggle = Boolean(showMenuButtonWhenMini && miniSidenav);
  const handleToggleSidenav = () => setMiniSidenav(dispatch, !miniSidenav);

  const iconsStyle = { color: "#fff" };

  // ✅ 뱃지 카운트: 전자결재 + 계약만료 + (관리자면) 승인대기 + 문의답변대기
  const totalBadgeCount =
    electronicPaymentNotifCount +
    notifications.length +
    inquiryPendingCount +
    birthdayMemberCount +
    (isAdmin ? pendingCount : 0);

  // 사용자 승인대기 / 문의 답변대기 / 전자결재 알림이 있으면 네비 알림 뱃지를 강조한다.
  const shouldBlinkNotificationBadge =
    (isAdmin && pendingCount > 0) ||
    inquiryPendingCount > 0 ||
    electronicPaymentNotifCount > 0;

  const renderMenu = () => {
    const showPromotionSection = canViewPromotionAlert;
    const showInquirySection = canViewInquiryAlert && (shouldAlwaysShowInquirySection || inquiryPendingCount > 0);
    const showElectronicPaymentSection = electronicPaymentNotifCount > 0;
    const showApprovalSection = isAdmin && pendingCount > 0;
    const showBirthdaySection = birthdayMemberCount > 0;
    const showContractSection = notifLoading || notifications.length > 0;
    const hasAnyMenuItems =
      showPromotionSection ||
      showInquirySection ||
      showElectronicPaymentSection ||
      showApprovalSection ||
      showBirthdaySection ||
      showContractSection;

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
        {showInquirySection && (
          <>
            <MDBox px={2} pt={1} pb={0.5}>
              <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
                {inquiryMenuSectionTitle}
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
                await openInquiryPendingDialog();
              }}
            >
              <NotificationItem
                icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
                title={inquiryMenuItemTitle}
              />
            </MDBox>

            <Divider sx={{ mx: 2, my: 0.8, opacity: 0.7 }} />
          </>
        )}

        {showElectronicPaymentSection && (
          <>
            <MDBox px={2} pt={1} pb={0.5}>
              <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
                전자결재 알림
              </MDTypography>
            </MDBox>

            {electronicPaymentNotifications.map((n, idx) => (
              <MDBox
                key={`${n.payment_id || "payment"}-${idx}`}
                sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" }, borderRadius: "10px" }}
              >
                <NotificationItem
                  icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
                  title={n.notify_message || "전자결재 알림"}
                  onClick={async () => {
                    handleCloseMenu();
                    await markElectronicPaymentNotificationRead(n.payment_id, n.notify_type);
                    goElectronicPaymentManage(n.payment_id);
                  }}
                />
              </MDBox>
            ))}

            <Divider sx={{ mx: 2, my: 0.8, opacity: 0.7 }} />
          </>
        )}

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

        {showPromotionSection && (
          <>
            <MDBox px={2} pt={1} pb={0.5}>
              <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
                {promotionMenuSectionTitle}
              </MDTypography>
            </MDBox>

            <MDBox
              sx={{
                cursor: "pointer",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
                borderRadius: "10px",
              }}
              onClick={() => {
                handleCloseMenu();
                openPromotionBoardPage();
              }}
            >
              <NotificationItem
                icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
                title={promotionMenuItemTitle}
              />
            </MDBox>

            <Divider sx={{ mx: 2, my: 0.8, opacity: 0.7 }} />
          </>
        )}

        {showBirthdaySection && (
          <>
            <MDBox px={2} pt={1} pb={0.5}>
              <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
                {`${currentMonthText}의 생일자 알림`}
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
                await openBirthdayMemberDialog();
              }}
            >
              <NotificationItem
                icon={<ArrowRightIcon sx={{ color: "#fff" }} />}
                title={`${currentMonthText}의 생일자 목록 (${birthdayMemberCount})`}
              />
            </MDBox>

            <Divider sx={{ mx: 2, my: 0.8, opacity: 0.7 }} />
          </>
        )}

        {showContractSection && (
          <MDBox px={2} pt={1} pb={0.5}>
            <MDTypography variant="button" fontSize="0.72rem" sx={{ fontWeight: 700, color: "text.primary" }}>
              계약 만료 알림
            </MDTypography>
          </MDBox>
        )}

        {showContractSection && notifLoading && (
          <MDBox px={2} py={1}>
            <MDTypography variant="button" fontSize="0.7rem" sx={{ color: "#fff" }}>
              알림을 불러오는 중입니다...
            </MDTypography>
          </MDBox>
        )}

        {!notifLoading && !hasAnyMenuItems && (
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
                      shouldBlinkNotificationBadge
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
            renderApprovalPendingTable()
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

      {/* ✅ 문의 목록 Dialog: Navbar에만 1개 */}
      <Dialog open={inquiryPendingOpen} onClose={() => setInquiryPendingOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle sx={{ px: 2, py: 1.5 }}>
          <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={1}>
            <MDTypography variant="h6" fontWeight="bold">
              문의 목록
            </MDTypography>
            <MDButton
              color="info"
              size="small"
              onClick={openInquiryManageListPage}
              sx={{
                ...inquiryActionButtonSx,
                color: "#ffffff !important",
              }}
            >
              문의관리
            </MDButton>
          </MDBox>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          {inquiryPendingLoading ? (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              불러오는 중...
            </MDTypography>
          ) : inquiryPendingRows?.length ? (
            renderInquiryPendingTable()
          ) : (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              문의 내역이 없습니다.
            </MDTypography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <MDButton variant="outlined" color="secondary" onClick={() => setInquiryPendingOpen(false)}>
            닫기
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={birthdayMemberOpen} onClose={() => setBirthdayMemberOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 800 }}>{`${currentMonthText}의 생일자 목록`}</DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          {birthdayMemberLoading ? (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              불러오는 중...
            </MDTypography>
          ) : birthdayMemberRows?.length ? (
            renderBirthdayMemberTable()
          ) : (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
              {`${currentMonthText}의 생일자가 없습니다.`}
            </MDTypography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <MDButton variant="outlined" color="secondary" onClick={() => setBirthdayMemberOpen(false)}>
            닫기
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
