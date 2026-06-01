/* eslint-disable react/function-component-definition */
import { useEffect, useMemo, useState, forwardRef } from "react";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import DatePicker, { registerLocale } from "react-datepicker";
import ko from "date-fns/locale/ko";
import Swal from "sweetalert2";
registerLocale("ko", ko);

// @mui
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Popover from "@mui/material/Popover";

// MD
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Layout
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
// import Footer from "examples/Footer";
import LoadingScreen from "layouts/loading/loadingscreen";

import api from "api/api";
import useDashBoardData from "layouts/dashboard/data/dashboardData";

function HeaderCard({ title, children, minHeight = 140, onClick }) {
  const clickable = typeof onClick === "function";

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox
        px={2}
        pt={1.5}
        pb={1}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {title}
        </MDTypography>

        {/* ✅ 화살표 클릭 시 이동 */}
        <Icon
          sx={{
            opacity: 0.6,
            fontSize: 18,
            cursor: clickable ? "pointer" : "default",
          }}
          onClick={(e) => {
            if (!clickable) return;
            e.stopPropagation();
            onClick();
          }}
        >
          chevron_right
        </Icon>
      </MDBox>

      <Divider sx={{ my: 0 }} />

      <MDBox px={2} py={1.5} sx={{ minHeight }}>
        {children}
      </MDBox>
    </Card>
  );
}

HeaderCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClick: PropTypes.func,
};
HeaderCard.defaultProps = {
  children: null,
  minHeight: 140,
  onClick: undefined,
};

function ListLines({ items, emptyText = "데이터가 없습니다.", onItemClick, onItemContextMenu }) {
  if (!items?.length) {
    return (
      <MDTypography variant="caption" color="text" sx={{ opacity: 0.75 }}>
        {emptyText}
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" flexDirection="column" gap={0.75}>
      {items.map((it, idx) => (
        <MDBox
          key={`${idx}-${it?.content || ""}`}
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={2}
          onClick={onItemClick ? () => onItemClick(it) : undefined}
          onContextMenu={
            onItemContextMenu
              ? (e) => {
                e.preventDefault();
                onItemContextMenu(it);
              }
              : undefined
          }
          sx={{
            minWidth: 0,
            cursor: onItemClick || onItemContextMenu ? "pointer" : "default",
            borderRadius: "6px",
            px: onItemClick || onItemContextMenu ? 0.5 : 0,
            "&:hover": onItemClick || onItemContextMenu ? { backgroundColor: "rgba(0,0,0,0.04)" } : {},
          }}
        >
          <MDTypography
            variant="caption"
            color="dark"
            sx={{
              fontWeight: 500,
              flex: 1,
              minWidth: 0,
              whiteSpace: "pre-line",
              wordBreak: "break-word",
            }}
          >
            {it.content}
          </MDTypography>

          {it.date && (
            <MDTypography
              variant="caption"
              color="text"
              sx={{ opacity: 0.8, whiteSpace: "nowrap", flex: "0 0 auto" }}
            >
              {it.date}
            </MDTypography>
          )}
        </MDBox>
      ))}
    </MDBox>
  );
}

ListLines.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      idx: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      content: PropTypes.string,
      date: PropTypes.string,
    })
  ),
  emptyText: PropTypes.string,
  onItemClick: PropTypes.func,
  onItemContextMenu: PropTypes.func,
};

ListLines.defaultProps = {
  items: [],
  emptyText: "데이터가 없습니다.",
  onItemClick: undefined,
  onItemContextMenu: undefined,
};

// ✅ 행사 종류별 색상 매핑 (department=4용)
const getTypeColor = (type) => {
  const t = String(type);
  switch (t) {
    case "1":
      return "#FF5F00";
    case "2":
      return "#0046FF";
    case "3":
      return "#527853";
    case "4":
      return "#F266AB";
    case "5":
      return "#A459D1";
    case "6":
      return "#D71313";
    case "7":
      return "#364F6B";
    case "8":
    case "9":
    case "10":
      return "#1A0841";
    default:
      return "#F2921D";
  }
};

// ✅ 행사 종류별 색상 매핑 (department=5용)
const getTypeColor2 = (type) => {
  const t = String(type);
  switch (t) {
    case "1":
      return "#FF5F00";
    case "2":
      return "#F2921D";
    case "3":
      return "#0046FF";
    case "4":
      return "#527853";
    case "5":
      return "#F266AB";
    case "6":
      return "#A459D1";
    case "7":
      return "#D71313";
    case "8":
      return "#364F6B";
    case "9":
    case "10":
    case "11":
      return "#1A0841";
    case "12":
      return "#e53935";
    case "13":
      return "#7B1FA2";
    default:
      return "#F2921D";
  }
};

// ✅ 행사 종류 정의 (department=4용)
const TYPE_OPTIONS = [
  { value: "1", label: "행사" },
  { value: "2", label: "미팅" },
  { value: "3", label: "오픈" },
  { value: "4", label: "오픈준비" },
  { value: "5", label: "외근" },
  { value: "6", label: "출장" },
  { value: "7", label: "체크" },
  { value: "8", label: "연차" },
  { value: "9", label: "오전반차" },
  { value: "10", label: "오후반차" },
];

// ✅ 행사 종류 정의 (department=5용)
const TYPE_OPTIONS2 = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생" },
  { value: "3", label: "관리" },
  { value: "4", label: "이슈" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// ✅ department에 따라 라벨 옵션 선택
const getTypeLabelByDepartment = (typeValue, department) => {
  const v = String(typeValue ?? "");
  const dept = String(department ?? "");
  const options = dept === "5" ? TYPE_OPTIONS2 : TYPE_OPTIONS;
  const found = options.find((t) => t.value === v);
  return found ? found.label : "";
};

// ✅ department에 따라 색상 함수 선택
const getTypeColorByDepartment = (typeValue, department) => {
  const dept = String(department ?? "");
  return dept === "5" ? getTypeColor2(typeValue) : getTypeColor(typeValue);
};
const stripSchedulePrefix = (text) => String(text || "").replace(/^\[[^\]]*\]\s*/, "").trim();

function ScheduleLines({ items, emptyText = "일정이 없습니다." }) {
  if (!items?.length) {
    return (
      <MDTypography variant="caption" color="text" sx={{ opacity: 0.75 }}>
        {emptyText}
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" flexDirection="column" gap={1}>
      {items.map((it, idx) => {
        const typeLabel = getTypeLabelByDepartment(it.type, it.department);
        const color = getTypeColorByDepartment(it.type, it.department);
        const accountName = String(it.account_name || "").trim();
        const badgeText = typeLabel
          ? `[${typeLabel}${accountName ? ` - ${accountName}` : ""}]`
          : accountName
            ? `[${accountName}]`
            : "";
        const rawContent = String(it.content || "").trim();
        const hasPrefixedContent = /^\[[^\]]+\]\s*/.test(rawContent);
        const hasAccountInPrefix = /^\[[^\]]+\s-\s[^\]]+\]\s*/.test(rawContent);
        const strippedContent = stripSchedulePrefix(rawContent);
        const displayContent = hasPrefixedContent && (hasAccountInPrefix || !badgeText)
          ? rawContent
          : `${badgeText}${badgeText && strippedContent ? " " : ""}${strippedContent}`.trim();
        // ✅ 본문 포맷: "[구분-거래처] 내용 / 이름 [직책]"
        const positionText = it.position_name ? ` [${it.position_name}]` : "";
        const scheduleText = `${displayContent}${it.user_name ? ` / ${it.user_name}${positionText}` : ""}`;

        return (
          <MDBox
            key={`${idx}-${it?.time || ""}`}
            display="flex"
            alignItems="flex-start"
            gap={1.2}
            sx={{
              pl: 0.4,
              py: 0.4,
              borderRadius: "8px",
              backgroundColor: `${color}22`,
              minWidth: 0,
            }}
          >
            <MDTypography
              variant="caption"
              color="dark"
              sx={{
                fontWeight: 600,
                fontSize: 11,
                flex: "1 1 auto",
                minWidth: 0,
                // ✅ 긴 한글 문장은 자연스럽게 다음 줄로 줄바꿈되도록 처리
                whiteSpace: "normal",
                wordBreak: "keep-all",
                overflowWrap: "break-word",
                lineHeight: 1.3,
              }}
            >
              {scheduleText}
            </MDTypography>
          </MDBox>
        );
      })}
    </MDBox>
  );
}

ScheduleLines.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      department: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      user_name: PropTypes.string,
      content: PropTypes.string,
      position_name: PropTypes.string,
      account_name: PropTypes.string,
      time: PropTypes.string,
    })
  ),
  emptyText: PropTypes.string,
};

ScheduleLines.defaultProps = {
  items: [],
  emptyText: "일정이 없습니다.",
};

// DatePicker 유틸
function formatDateObj(dt) {
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatYMDInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  let out = y;
  if (m) out += `-${m}`;
  if (d) out += `-${d}`;
  return out;
}

function tryParseYMD(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const [yy, mm, dd] = String(ymd).split("-").map(Number);
  const dt = new Date(yy, mm - 1, dd);
  if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

const DatePickerTextInput = forwardRef(function DatePickerTextInput(
  { value, onClick, onChange, label, required },
  ref
) {
  return (
    <TextField
      value={value || ""}
      onClick={onClick}
      onChange={onChange}
      label={label}
      required={required}
      inputRef={ref}
      fullWidth
      size="small"
      sx={{ "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}
    />
  );
});

DatePickerTextInput.propTypes = {
  value: PropTypes.string,
  onClick: PropTypes.func,
  onChange: PropTypes.func,
  label: PropTypes.string,
  required: PropTypes.bool,
};

// ERP 북마크 내부 메뉴 경로 목록 (카테고리 → 페이지)
const INTERNAL_ROUTES = {
  본사: [
    { name: "🗂️ 관리표", route: "/HeadOffice/PeopleCountingTab" },
    { name: "📢 공지사항", route: "/headoffice/notices" },
    { name: "📅 급식사업부 일정관리", route: "/headoffice/schedule" },
    { name: "🎉 행사", route: "/event" },
    { name: "🍚 본사 식단표", route: "/weekmenu" },
    { name: "🚙 법인차량 관리", route: "/carManager" },
    { name: "👥 사용자 관리", route: "/headoffice/user-management" },
    { name: "📝 전자결재 관리", route: "/electronicpaymentmanager" },
  ],
  영업: [
    { name: "📅 일정관리", route: "/businessschedule" },
    { name: "ℹ️ 고객사 정보", route: "/account" },
    { name: "📁 고객사 관리", route: "/businessaccount/telemanager" },
    { name: "💰 매출", route: "/AccountSales/AccountSalesTab" },
  ],
  운영: [
    { name: "📅 일정관리", route: "/operateschedule" },
    { name: "📑 예산", route: "/budget/budgetManager" },
    { name: "🧑‍🔧 현장관리", route: "/fieldstaff" },
    { name: "🧑‍🔧 채용관리", route: "/fieldstaff2" },
    { name: "📁 고객사 관리", route: "/Operate/OperateTabs" },
    { name: "📋 고객사 소통", route: "/Operate/accountissuesheet2" },
  ],
  회계: [
    { name: "💳 거래처 자료 입력", route: "/purchaseDeadLineTally/purchasetally" },
    { name: "💳 본사 법인카드", route: "/purchase/headofficecorporatecard" },
    { name: "💳 현장 법인카드", route: "/purchase/accountcorporatecard" },
    { name: "💳 개인구매 관리", route: "/purchase/accountpersonpurchase" },
    { name: "📦 매입마감", route: "/purchaseTally/purchasetally" },
  ],
  인사: [
    { name: "🧑‍🔧 현장관리", route: "/fieldstaff_1" },
    { name: "📚 본사 교육", route: "/humanresource/education" },
  ],
  현장: [
    { name: "📋 집계표", route: "/layouts/tallysheet" },
    { name: "📅 출근부", route: "/layouts/recordsheet" },
    { name: "🍽️ 식수현황", route: "/diners/dinersnumber" },
    { name: "📋 집계표-개발팀", route: "/layouts/tallysheet_develop" },
  ],
};
// 북마크 전용 모달: 카테고리 → 페이지 순으로 선택하는 2단계 드롭박스
const findInternalRoutePage = (route) => {
  const routeText = String(route || "");
  const category = Object.keys(INTERNAL_ROUTES).find((cat) =>
    INTERNAL_ROUTES[cat].some((page) => page.route === routeText)
  );

  if (!category) return null;

  const page = INTERNAL_ROUTES[category].find((item) => item.route === routeText);
  return page ? { category, page } : null;
};

function BookmarkAddModal({ open, onClose, onSubmit }) {
  const [category, setCategory] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");

  // 모달 열릴 때마다 선택값 초기화
  useEffect(() => {
    if (open) {
      setCategory("");
      setSelectedRoute("");
    }
  }, [open]);

  // 카테고리 변경 시 하위 페이지 선택 초기화
  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setSelectedRoute("");
  };

  const pages = category ? INTERNAL_ROUTES[category] : [];
  const selectedPage = pages.find((p) => p.route === selectedRoute);

  const handleSubmit = () => {
    if (!selectedPage) return;
    onSubmit({ title: `[${category}] ${selectedPage.name}`, route: selectedPage.route });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>북마크 등록</DialogTitle>
      <DialogContent sx={{ px: 3, pt: "16px !important", pb: 0 }}>
        {/* 1단계: 카테고리 선택 */}
        <FormControl fullWidth sx={{ mb: 1.5 }}>
          <Select
            value={category}
            onChange={handleCategoryChange}
            displayEmpty
            renderValue={(v) => v || <span style={{ color: "#aaa" }}>카테고리 선택</span>}
            sx={{ height: 44, "& .MuiSelect-select": { display: "flex", alignItems: "center" } }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}
          >
            {Object.keys(INTERNAL_ROUTES).map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 2단계: 페이지 선택 */}
        <FormControl fullWidth disabled={!category} sx={{ mb: 0.5 }}>
          <Select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            displayEmpty
            renderValue={(v) => {
              if (!v) return <span style={{ color: "#aaa" }}>페이지 선택</span>;
              return pages.find((p) => p.route === v)?.name || v;
            }}
            sx={{ height: 44, "& .MuiSelect-select": { display: "flex", alignItems: "center" } }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}
          >
            {pages.map((p) => (
              <MenuItem key={p.route} value={p.route}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* 취소 버튼: 회색 */}
        <Button
          onClick={onClose}
          size="small"
          variant="contained"
          sx={{ backgroundColor: "#9e9e9e", "&:hover": { backgroundColor: "#757575" }, color: "#fff" }}
        >
          취소
        </Button>
        {/* 등록 버튼: 카테고리·페이지 모두 선택해야 활성화 */}
        <Button
          onClick={handleSubmit}
          size="small"
          variant="contained"
          disabled={!selectedRoute}
          sx={{ backgroundColor: "#4caf50", "&:hover": { backgroundColor: "#43a047" }, color: "#fff" }}
        >
          등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}

BookmarkAddModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

// 내부/외부 북마크를 선택해 등록하는 모달
function BookmarkRegisterModal({ open, onClose, onSubmit }) {
  const [bookmarkType, setBookmarkType] = useState("1");
  const [category, setCategory] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  // 모달이 열릴 때 북마크 입력값을 초기화
  useEffect(() => {
    if (open) {
      setBookmarkType("1");
      setCategory("");
      setSelectedRoute("");
      setExternalTitle("");
      setExternalUrl("");
    }
  }, [open]);

  // 내부 북마크 카테고리를 바꾸면 선택된 페이지를 초기화
  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setSelectedRoute("");
  };

  // 타입을 바꾸면 다른 타입의 입력값을 초기화
  const handleTypeChange = (e) => {
    setBookmarkType(e.target.value);
    setCategory("");
    setSelectedRoute("");
    setExternalTitle("");
    setExternalUrl("");
  };

  const pages = category ? INTERNAL_ROUTES[category] : [];
  const selectedPage = pages.find((p) => p.route === selectedRoute);
  const canSubmit = bookmarkType === "1" ? !!selectedRoute : !!externalTitle.trim() && !!externalUrl.trim();

  const handleSubmit = () => {
    if (bookmarkType === "1") {
      if (!selectedPage) return;
      onSubmit({ type: 1, title: `[${category}] ${selectedPage.name}`, route: selectedPage.route });
      return;
    }

    onSubmit({ type: 2, title: externalTitle.trim(), route: externalUrl.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>북마크 등록</DialogTitle>
      <DialogContent sx={{ px: 3, pt: "16px !important", pb: 0 }}>
        {/* 북마크 타입 선택 영역 */}
        <FormControl fullWidth size="small" sx={{ mb: 1.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}>
          <InputLabel>종류</InputLabel>
          <Select value={bookmarkType} onChange={handleTypeChange} label="종류">
            <MenuItem value="1">내부 링크</MenuItem>
            <MenuItem value="2">외부 링크</MenuItem>
          </Select>
        </FormControl>

        {bookmarkType === "1" ? (
          <>
            {/* 내부 북마크 카테고리 선택 영역 */}
            <FormControl fullWidth size="small" sx={{ mb: 1.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}>
              <InputLabel>카테고리</InputLabel>
              <Select
                value={category}
                onChange={handleCategoryChange}
                label="카테고리"
                MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}
              >
                {Object.keys(INTERNAL_ROUTES).map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 내부 북마크 페이지 선택 영역 */}
            <FormControl fullWidth size="small" disabled={!category} sx={{ mb: 0.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}>
              <InputLabel>페이지</InputLabel>
              <Select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                label="페이지"
                MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}
              >
                {pages.map((p) => (
                  <MenuItem key={p.route} value={p.route}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ) : (
          <>
            {/* 외부 북마크 이름 입력 영역 */}
            <TextField
              label="북마크 이름"
              value={externalTitle}
              onChange={(e) => setExternalTitle(e.target.value)}
              fullWidth
              required
              size="small"
              sx={{ mb: 1.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}
            />

            {/* 외부 북마크 URL 입력 영역 */}
            <TextField
              label="URL"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              fullWidth
              required
              size="small"
              sx={{ mb: 0.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          size="small"
          variant="contained"
          sx={{ backgroundColor: "#9e9e9e", "&:hover": { backgroundColor: "#757575" }, color: "#fff" }}
        >
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          size="small"
          variant="contained"
          disabled={!canSubmit}
          sx={{ backgroundColor: "#4caf50", "&:hover": { backgroundColor: "#43a047" }, color: "#fff" }}
        >
          등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}

BookmarkRegisterModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

// 북마크·투두 등록에 공용으로 사용되는 입력 모달
function AddModal({ open, title, fields, onClose, onSubmit }) {
  const [values, setValues] = useState({});
  const [dateObjs, setDateObjs] = useState({});
  const [dateTexts, setDateTexts] = useState({});

  useEffect(() => {
    if (open) {
      setValues({});
      setDateObjs({});
      setDateTexts({});
    }
  }, [open]);

  const handleChange = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    const merged = { ...values };
    fields.forEach((f) => {
      if (f.type === "date") merged[f.key] = dateTexts[f.key] || "";
    });
    onSubmit(merged);
  };

  const dateFields = fields.filter((f) => f.type === "date");
  const textFields = fields.filter((f) => f.type !== "date");

  const renderDatePicker = (f) => (
    <MDBox
      key={f.key}
      sx={{
        flex: 1,
        minWidth: 0,
        "& .react-datepicker-wrapper": { display: "block", width: "100%" },
      }}
    >
      <DatePicker
        selected={dateObjs[f.key] || null}
        value={dateTexts[f.key] || ""}
        dateFormat="yyyy년 MM월 dd일"
        locale="ko"
        popperProps={{ strategy: "fixed" }}
        customInput={<DatePickerTextInput label={f.required ? `${f.label} *` : f.label} />}
        onChange={(date) => {
          setDateObjs((prev) => ({ ...prev, [f.key]: date }));
          const ymd = date ? formatDateObj(date) : "";
          setDateTexts((prev) => ({ ...prev, [f.key]: ymd }));
        }}
        onChangeRaw={(e) => {
          const formatted = formatYMDInput(e.target.value);
          setDateTexts((prev) => ({ ...prev, [f.key]: formatted }));
          if (!formatted) {
            setDateObjs((prev) => ({ ...prev, [f.key]: null }));
            return;
          }
          if (formatted.length === 10) {
            const parsed = tryParseYMD(formatted);
            if (parsed) setDateObjs((prev) => ({ ...prev, [f.key]: parsed }));
          }
        }}
      />
    </MDBox>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>{title}</DialogTitle>
      <DialogContent sx={{ px: 3, pt: "16px !important", pb: 0 }}>
        {textFields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={values[f.key] || ""}
            onChange={(e) => handleChange(f.key, e.target.value)}
            fullWidth
            required={f.required}
            size="small"
            sx={{ mb: 1.5, "& .MuiInputBase-root": { height: 44 }, "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" } }}
          />
        ))}
        {dateFields.length > 0 && (
          <MDBox sx={{ display: "flex", gap: 2, mb: 0.5 }}>
            {dateFields.map((f) => renderDatePicker(f))}
          </MDBox>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          size="small"
          variant="contained"
          sx={{ backgroundColor: "#9e9e9e", "&:hover": { backgroundColor: "#757575" }, color: "#fff" }}
        >
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          size="small"
          variant="contained"
          disabled={fields.filter((f) => f.required).some((f) =>
            f.type === "date" ? !dateTexts[f.key] : !values[f.key]?.trim()
          )}
          sx={{ backgroundColor: "#4caf50", "&:hover": { backgroundColor: "#43a047" }, color: "#fff" }}
        >
          등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AddModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, required: PropTypes.bool })).isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

// 북마크·투두에 사용되는 카드 박스
// 헤더 우측 + 버튼 클릭 시 onAdd 콜백을 호출해 등록 모달을 오픈함
// 북마크와 투두 항목을 클릭했을 때 수정/삭제에 사용하는 모달
function EditModal({ open, type, item, onClose, onSubmit, onDelete }) {
  const [values, setValues] = useState({});
  const isBookmark = type === "bookmark";

  useEffect(() => {
    if (!open) return;
    const itemType = String(item?.type || "1");
    let category = "";
    let selectedRoute = "";
    if (itemType === "1" && item?.route) {
      const found = Object.keys(INTERNAL_ROUTES).find((cat) =>
        INTERNAL_ROUTES[cat].some((p) => p.route === item.route)
      );
      if (found) { category = found; selectedRoute = item.route; }
    }
    setValues({
      idx: item?.idx ?? "",
      type: itemType,
      category,
      selectedRoute,
      title: item?.title || item?.content || "",
      route: item?.route || "",
      start_date: item?.start_date || "",
      end_date: item?.end_date || "",
      complete_yn: item?.complete_yn || "N",
    });
  }, [open, item]);

  const handleChange = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const pages = values.category ? INTERNAL_ROUTES[values.category] || [] : [];

  const handleTypeChange = (nextType) => {
    setValues((prev) => ({ ...prev, type: nextType, category: "", selectedRoute: "", route: "", title: nextType === "2" ? prev.title : "" }));
  };
  const handleCategoryChange = (nextCat) => {
    setValues((prev) => ({ ...prev, category: nextCat, selectedRoute: "", route: "", title: "" }));
  };
  const handleRouteChange = (nextRoute) => {
    const page = pages.find((p) => p.route === nextRoute);
    setValues((prev) => ({ ...prev, selectedRoute: nextRoute, route: nextRoute, title: page ? `[${prev.category}] ${page.name}` : prev.title }));
  };

  const handleSubmit = () => {
    if (isBookmark && String(values.type || "1") === "1") {
      const page = pages.find((p) => p.route === values.selectedRoute);
      if (!page) return;
      onSubmit({ ...values, type: 1, title: `[${values.category}] ${page.name}`, route: values.selectedRoute });
      return;
    }
    onSubmit({ ...values, type: isBookmark ? Number(values.type || 1) : values.type });
  };

  const submitDisabled = isBookmark
    ? (String(values.type || "1") === "1" ? !values.selectedRoute : !values.title?.trim() || !values.route?.trim())
    : !values.title?.trim() || !values.start_date;

  const SX44 = {
    "& .MuiInputBase-root": { height: 44 },
    "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: "2px" },
  };

  const renderTodoDatePicker = (key, label, required = false) => (
    <MDBox
      sx={{
        flex: 1,
        minWidth: 0,
        "& .react-datepicker-wrapper": { display: "block", width: "100%" },
      }}
    >
      <DatePicker
        selected={tryParseYMD(values[key]) || null}
        value={values[key] || ""}
        dateFormat="yyyy년 MM월 dd일"
        locale="ko"
        popperProps={{ strategy: "fixed" }}
        customInput={<DatePickerTextInput label={required ? `${label} *` : label} />}
        onChange={(date) => handleChange(key, date ? formatDateObj(date) : "")}
        onChangeRaw={(e) => handleChange(key, formatYMDInput(e.target.value))}
      />
    </MDBox>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
        {isBookmark ? "Bookmark 수정" : "To Do 수정"}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: "16px !important", pb: 0 }}>
        {(!isBookmark || String(values.type || "1") === "2") && (
          <TextField
            label={isBookmark ? "북마크 표시명" : "할 일 내용"}
            value={values.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            fullWidth
            required
            size="small"
            sx={{ mb: 1.5, ...SX44 }}
          />
        )}
        {isBookmark ? (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 1.5, ...SX44 }}>
              <InputLabel>종류</InputLabel>
              <Select value={values.type || "1"} onChange={(e) => handleTypeChange(e.target.value)} label="종류">
                <MenuItem value="1">내부 링크</MenuItem>
                <MenuItem value="2">외부 링크</MenuItem>
              </Select>
            </FormControl>
            {String(values.type || "1") === "1" ? (
              <>
                <FormControl fullWidth size="small" sx={{ mb: 1.5, ...SX44 }}>
                  <InputLabel>카테고리</InputLabel>
                  <Select value={values.category || ""} onChange={(e) => handleCategoryChange(e.target.value)} label="카테고리" MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}>
                    {Object.keys(INTERNAL_ROUTES).map((cat) => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" disabled={!values.category} sx={{ mb: 0.5, ...SX44 }}>
                  <InputLabel>페이지</InputLabel>
                  <Select value={values.selectedRoute || ""} onChange={(e) => handleRouteChange(e.target.value)} label="페이지" MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}>
                    {pages.map((p) => (
                      <MenuItem key={p.route} value={p.route}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            ) : (
              <TextField
                label="URL"
                value={values.route || ""}
                onChange={(e) => handleChange("route", e.target.value)}
                fullWidth
                required
                size="small"
                sx={{ mb: 1.5, ...SX44 }}
              />
            )}
          </>
        ) : (
          <MDBox sx={{ display: "flex", gap: 2, mb: 1.5 }}>
            {renderTodoDatePicker("start_date", "시작일", true)}
            {renderTodoDatePicker("end_date", "종료일")}
          </MDBox>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onDelete}
          size="small"
          variant="contained"
          sx={{ mr: "auto", backgroundColor: "#e53935", "&:hover": { backgroundColor: "#c62828" }, color: "#fff" }}
        >
          삭제
        </Button>
        <Button
          onClick={onClose}
          size="small"
          variant="contained"
          sx={{ backgroundColor: "#9e9e9e", "&:hover": { backgroundColor: "#757575" }, color: "#fff" }}
        >
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          size="small"
          variant="contained"
          disabled={submitDisabled}
          sx={{ backgroundColor: "#4caf50", "&:hover": { backgroundColor: "#43a047" }, color: "#fff" }}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

EditModal.propTypes = {
  open: PropTypes.bool.isRequired,
  type: PropTypes.oneOf(["bookmark", "todo"]),
  item: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

EditModal.defaultProps = {
  type: "bookmark",
  item: null,
};

function SmallBox({ title, items, onAdd, onItemClick, onItemContextMenu }) {
  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} display="flex" alignItems="center" justifyContent="space-between">
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {title}
        </MDTypography>
        {/* + 버튼: 클릭 시 등록 모달 오픈 */}
        <Icon
          sx={{ opacity: 0.7, fontSize: 20, cursor: "pointer", "&:hover": { opacity: 1 } }}
          onClick={onAdd}
        >
          add
        </Icon>
      </MDBox>
      <Divider sx={{ my: 0 }} />
      <MDBox px={2} py={1.5} minHeight={90}>
        <ListLines
          items={items}
          emptyText="비어있습니다."
          onItemClick={onItemClick}
          onItemContextMenu={onItemContextMenu}
        />
      </MDBox>
    </Card>
  );
}

SmallBox.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.array,
  onAdd: PropTypes.func,
  onItemClick: PropTypes.func,
  onItemContextMenu: PropTypes.func,
};

SmallBox.defaultProps = {
  items: [],
  onAdd: undefined,
  onItemClick: undefined,
  onItemContextMenu: undefined,
};

function MiniCalendar({ todos }) {
  const [cursor, setCursor] = useState(dayjs());
  const [popover, setPopover] = useState({ anchor: null, date: null });
  // ✅ 본사행사(type=2) 목록 상태
  const [headOfficeEvents, setHeadOfficeEvents] = useState([]);

  // ✅ 달력 월 이동 시 해당 연/월 본사행사 재조회
  const cursorYM = cursor.format("YYYY-MM");

  useEffect(() => {
    const year = cursor.year();
    const month = String(cursor.month() + 1).padStart(2, "0");
    api
      .get("/HeadOffice/EventList", { params: { year, month } })
      .then((res) => {
        // ✅ type=2(본사행사)이고 삭제되지 않은 항목만 필터링
        const events = (res.data || []).filter(
          (x) => String(x.type) === "2" && String(x.del_yn || "N") !== "Y"
        );
        setHeadOfficeEvents(events);
      })
      .catch(() => setHeadOfficeEvents([]));
  }, [cursorYM]);

  const start = useMemo(() => cursor.startOf("month").startOf("week"), [cursor]);
  const end = useMemo(() => cursor.endOf("month").endOf("week"), [cursor]);

  const todoDates = useMemo(() => {
    const set = new Set();
    (todos || []).forEach((t) => {
      const s = t.start_date ? dayjs(t.start_date) : null;
      const e = t.end_date ? dayjs(t.end_date) : null;
      if (s && e) {
        let cur = s;
        while (cur.isBefore(e) || cur.isSame(e, "day")) {
          set.add(cur.format("YYYY-MM-DD"));
          cur = cur.add(1, "day");
        }
      } else if (s) set.add(s.format("YYYY-MM-DD"));
      else if (e) set.add(e.format("YYYY-MM-DD"));
    });
    return set;
  }, [todos]);

  // ✅ 본사행사 날짜 Set — 달력 점 표시 판별용
  const headOfficeDates = useMemo(() => {
    const set = new Set();
    headOfficeEvents.forEach((ev) => {
      const s = ev.menu_date ? dayjs(ev.menu_date) : null;
      const e = ev.end_date ? dayjs(ev.end_date) : null;
      if (s && e) {
        let cur = s;
        while (cur.isBefore(e) || cur.isSame(e, "day")) {
          set.add(cur.format("YYYY-MM-DD"));
          cur = cur.add(1, "day");
        }
      } else if (s) set.add(s.format("YYYY-MM-DD"));
      else if (e) set.add(e.format("YYYY-MM-DD"));
    });
    return set;
  }, [headOfficeEvents]);

  const days = useMemo(() => {
    const arr = [];
    let d = start;
    while (d.isBefore(end) || d.isSame(end, "day")) {
      arr.push(d);
      d = d.add(1, "day");
    }
    return arr;
  }, [start, end]);

  const popoverTodos = useMemo(() => {
    if (!popover.date) return [];
    const target = dayjs(popover.date);
    return (todos || []).filter((t) => {
      const s = t.start_date ? dayjs(t.start_date) : null;
      const e = t.end_date ? dayjs(t.end_date) : null;
      if (s && e) return (target.isSame(s, "day") || target.isAfter(s, "day")) && (target.isSame(e, "day") || target.isBefore(e, "day"));
      if (s) return target.isSame(s, "day");
      if (e) return target.isSame(e, "day");
      return false;
    });
  }, [popover.date, todos]);

  // ✅ 팝오버에 표시할 본사행사 목록 — 선택 날짜 기준 필터
  const popoverHeadOfficeEvents = useMemo(() => {
    if (!popover.date) return [];
    const target = dayjs(popover.date);
    return headOfficeEvents.filter((ev) => {
      const s = ev.menu_date ? dayjs(ev.menu_date) : null;
      const e = ev.end_date ? dayjs(ev.end_date) : null;
      if (s && e) return (target.isSame(s, "day") || target.isAfter(s, "day")) && (target.isSame(e, "day") || target.isBefore(e, "day"));
      if (s) return target.isSame(s, "day");
      if (e) return target.isSame(e, "day");
      return false;
    });
  }, [popover.date, headOfficeEvents]);

  const weekLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} display="flex" alignItems="center" justifyContent="space-between">
        <Icon sx={{ cursor: "pointer", opacity: 0.7 }} onClick={() => setCursor((p) => p.subtract(1, "month"))}>
          chevron_left
        </Icon>
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {cursor.format("YYYY")}년 {cursor.format("M")}월
        </MDTypography>
        <Icon sx={{ cursor: "pointer", opacity: 0.7 }} onClick={() => setCursor((p) => p.add(1, "month"))}>
          chevron_right
        </Icon>
      </MDBox>
      <Divider sx={{ my: 0 }} />

      <MDBox px={2} py={1.5}>
        <MDBox display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.75} mb={1}>
          {weekLabels.map((w) => (
            <MDTypography
              key={w}
              variant="caption"
              sx={{ fontWeight: 800, textAlign: "center", color: w === "SUN" ? "error.main" : "text.secondary" }}
            >
              {w}
            </MDTypography>
          ))}
        </MDBox>

        <MDBox display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.75}>
          {days.map((d) => {
            const key = d.format("YYYY-MM-DD");
            const isThisMonth = d.month() === cursor.month();
            const isToday = d.isSame(dayjs(), "day");
            const hasTodo = todoDates.has(key);
            // ✅ 본사행사 존재 여부 — 파란 점 표시 판별
            const hasEvent = headOfficeDates.has(key);
            const hasAny = hasTodo || hasEvent;
            return (
              <MDBox
                key={key}
                onClick={hasAny ? (e) => setPopover({ anchor: e.currentTarget, date: key }) : undefined}
                sx={{
                  height: 28,
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isThisMonth ? 1 : 0.35,
                  border: isToday ? "1px solid rgba(0,0,0,0.35)" : "1px solid transparent",
                  cursor: hasAny ? "pointer" : "default",
                  "&:hover": hasAny ? { backgroundColor: "rgba(0,0,0,0.04)" } : {},
                }}
              >
                <MDTypography variant="caption" color="dark" sx={{ fontWeight: isToday ? 800 : 600, lineHeight: 1 }}>
                  {d.date()}
                </MDTypography>
                <MDBox sx={{ height: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                  {hasTodo && <MDBox sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#e53935" }} />}
                  {hasEvent && <MDBox sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#0046FF" }} />}
                </MDBox>
              </MDBox>
            );
          })}
        </MDBox>
      </MDBox>

      <Popover
        open={Boolean(popover.anchor)}
        anchorEl={popover.anchor}
        onClose={() => setPopover({ anchor: null, date: null })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { style: { backgroundColor: "#fff", background: "#fff" }, sx: { borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", p: 1.5, minWidth: 180, maxWidth: 260, backgroundColor: "#fff !important", background: "#fff !important" } } }}
      >
        <MDTypography variant="caption" fontWeight="bold" color="dark" sx={{ display: "block", mb: 0.75, opacity: 0.6 }}>
          {popover.date}
        </MDTypography>
        <MDBox display="flex" flexDirection="column" gap={0.5}>
          {/* ✅ 본사행사(type=2): [본사행사]만 파란색, 내용은 일반 글씨 */}
          {popoverHeadOfficeEvents.map((ev, i) => (
            <MDTypography key={`ev-${i}`} variant="caption" color="dark" sx={{ fontWeight: 500, whiteSpace: "pre-line", wordBreak: "break-word" }}>
              • <span style={{ color: "#0046FF", fontWeight: 600 }}>[본사행사]</span> {ev.content}
            </MDTypography>
          ))}
          {/* ✅ 투두 목록: [Todo]만 빨간색, 내용은 일반 글씨 */}
          {popoverTodos.map((t, i) => (
            <MDTypography key={`td-${i}`} variant="caption" color="dark" sx={{ fontWeight: 500, whiteSpace: "pre-line", wordBreak: "break-word" }}>
              • <span style={{ color: "#e53935", fontWeight: 600 }}>[Todo]</span> {t.title || t.content}
            </MDTypography>
          ))}
        </MDBox>
      </Popover>
    </Card>
  );
}

MiniCalendar.propTypes = { todos: PropTypes.array };
MiniCalendar.defaultProps = { todos: [] };

function ContractTableCard({ rows }) {
  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} textAlign="center">
        <MDTypography variant="button" fontWeight="bold" color="dark">
          계약 만료 예정 고객사
        </MDTypography>
      </MDBox>
      <Divider sx={{ my: 0 }} />
      <MDBox px={2} py={1.5}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 780,
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
              "& thead": { display: "table-header-group" },
              "& tbody": { display: "table-row-group" },
              "& tr": { display: "table-row" },
              "& th, & td": {
                display: "table-cell",
                whiteSpace: "nowrap",
                borderColor: "rgba(0,0,0,0.08)",
              },
            }}
          >
            <colgroup>
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 250 }} />
              <col style={{ width: 70 }} />
            </colgroup>

            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  고객사
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  계약기간
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  유형
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  지역
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  담당자
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows?.length ? (
                rows.map((r, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.customer_name}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12 }}>
                      {r.contract_start}~{r.contract_end}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.account_type}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.account_address}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.manager_name}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} sx={{ fontSize: 12, opacity: 0.7 }}>
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </MDBox>
    </Card>
  );
}

ContractTableCard.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      customer_name: PropTypes.string,
      contract_start: PropTypes.string,
      contract_end: PropTypes.string,
      account_type: PropTypes.string,
      account_address: PropTypes.string,
      manager_name: PropTypes.string,
    })
  ),
};

ContractTableCard.defaultProps = {
  rows: [],
};

function Dashboard() {
  const navigate = useNavigate();
  const userDeptCode = Number(localStorage.getItem("department"));
  const isSalesDept = userDeptCode === 4;

  const {
    accountList,
    loading,
    notices,
    meals,
    educations,
    welfares,
    opsSchedules,
    salesSchedules,
    contracts,
    bookmarks,
    todos,
    fetchAll,
    addBookmark,  // 북마크 저장 API (dashboardData에서 관리)
    deleteBookmark,
    addTodo,      // 투두 저장 API (dashboardData에서 관리)
    deleteTodo,
  } = useDashBoardData();

  const [accountId, setAccountId] = useState(localStorage.getItem("account_id") || "");
  // 현재 열린 모달 종류: "bookmark" | "todo" | null
  const [modalType, setModalType] = useState(null);
  const [editType, setEditType] = useState(null);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    if (!accountId && accountList?.length) {
      setAccountId(accountList[0].account_id);
    }
  }, [accountList, accountId]);

  useEffect(() => {
    if (!accountId) return;
    fetchAll(accountId);
  }, [accountId, fetchAll]);

  // 모달 등록 버튼 클릭 시 호출 - 종류에 따라 북마크/투두 API 분기
  const handleAddSubmit = async (values) => {
    try {
      if (modalType === "bookmark") {
        await addBookmark(accountId, values);
      } else if (modalType === "todo") {
        await addTodo(accountId, values);
      }
      setModalType(null);
    } catch (err) {
      console.error("등록 실패:", err);
    }
  };

  const openEditModal = (type, item) => {
    setEditType(type);
    setEditItem(item);
  };

  const closeEditModal = () => {
    setEditType(null);
    setEditItem(null);
  };

  // 외부 북마크 URL에 프로토콜이 없으면 새 탭 이동이 가능하도록 보정
  const getExternalBookmarkUrl = (url) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  // 북마크 좌클릭 시 내부는 라우트 이동, 외부는 새 탭으로 이동
  const handleBookmarkClick = (item) => {
    const route = String(item?.route || "").trim();
    if (!route) return;

    if (String(item?.type || "1") === "2") {
      window.open(getExternalBookmarkUrl(route), "_blank", "noopener,noreferrer");
      return;
    }

    navigate(route);
  };

  const bookmarkItems = useMemo(() =>
    bookmarks.map((item) => {
      if (String(item?.type || "1") !== "1") return item;

      const found = findInternalRoutePage(item?.route);
      if (!found) return item;

      const title = `[${found.category}] ${found.page.name}`;
      return { ...item, title, content: title };
    }),
    [bookmarks]
  );

  const handleEditSubmit = async (values) => {
    try {
      if (editType === "bookmark") {
        await addBookmark(accountId, values);
      } else if (editType === "todo") {
        await addTodo(accountId, values);
      }
      closeEditModal();
    } catch (err) {
      console.error("수정 실패:", err);
    }
  };

  const handleEditDelete = async () => {
    const confirm = await Swal.fire({
      title: "삭제",
      text: "선택한 항목을 삭제하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed || !editItem?.idx) return;

    try {
      if (editType === "bookmark") {
        await deleteBookmark(accountId, { idx: editItem.idx });
      } else if (editType === "todo") {
        await deleteTodo(accountId, { idx: editItem.idx });
      }
      closeEditModal();
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={1} pt={2}>
        <Grid container spacing={2.2}>
          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="공지사항" onClick={() => navigate("/headoffice/notices")}> {/* 본사 공지사항 페이지로 이동 */}
              <ListLines
                items={notices}
                emptyText="공지사항이 없습니다."
                onItemClick={(item) =>
                  navigate("/headoffice/notices", {
                    state: { noticeIdx: item.idx ?? null },
                  })
                }
              />
            </HeaderCard>
          </Grid>

          {/* ✅ 본사 식단표: WeekMenuManager 로 연결된 라우트 경로로 이동 */}
          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="본사 식단표" onClick={() => navigate("/weekmenu")}> {/* ✅ routes.js에서 WeekMenuManager path와 동일하게 */}
              <ListLines items={meals} emptyText="식단표가 없습니다." />
            </HeaderCard>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="본사 교육" onClick={() => navigate("/humanresource/education")}>
              <ListLines
                items={educations}
                emptyText="본사교육이 없습니다."
                onItemClick={(item) =>
                  navigate("/humanresource/education", {
                    state: { educationIdx: item.idx ?? null },
                  })
                }
              />
            </HeaderCard>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="복리후생" onClick={() => navigate("/welfare")}> {/*  ✅ 기존대로(라우트 경로만 맞추면 됨) */}
              <ListLines items={welfares} emptyText="복리후생이 없습니다." />
            </HeaderCard>
          </Grid>
        </Grid>

        <MDBox mt={2.2}>
          <Grid container spacing={2.2}>
            <Grid item xs={12} lg={9}>
              <Grid container spacing={2.2}>
                {isSalesDept ? (
                  <Grid item xs={12}>
                    <HeaderCard
                      title={`영업팀 일정(${dayjs().format("YYYY-MM-DD")})`}
                      minHeight={170}
                      onClick={() => navigate("/businessschedule")}
                    >
                      <ScheduleLines items={salesSchedules} />
                    </HeaderCard>
                  </Grid>
                ) : (
                  <>
                    {/* 운영팀 일정: OperateSchedule 로 연결된 라우트 경로로 이동 */}
                    <Grid item xs={12} md={6}>
                      <HeaderCard
                        title={`운영팀 일정(${dayjs().format("YYYY-MM-DD")})`}
                        minHeight={170}
                        onClick={() => navigate("/operateschedule")}
                      >
                        <ScheduleLines items={opsSchedules} />
                      </HeaderCard>
                    </Grid>

                    {/* 영업팀 일정: BusinessSchedule 로 연결된 라우트 경로로 이동 */}
                    <Grid item xs={12} md={6}>
                      <HeaderCard
                        title={`영업팀 일정(${dayjs().format("YYYY-MM-DD")})`}
                        minHeight={170}
                        onClick={() => navigate("/businessschedule")}
                      >
                        <ScheduleLines items={salesSchedules} />
                      </HeaderCard>
                    </Grid>
                  </>
                )}
              </Grid>

              <MDBox mt={2.2}>
                <ContractTableCard rows={contracts} />
              </MDBox>
            </Grid>

            <Grid item xs={12} lg={3}>
              <Grid container spacing={2.2}>
                <Grid item xs={12}>
                  <SmallBox
                    title="Bookmark"
                    items={bookmarkItems}
                    onAdd={() => setModalType("bookmark")}
                    onItemClick={handleBookmarkClick}
                    onItemContextMenu={(item) => openEditModal("bookmark", item)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <SmallBox
                    title="To Do List"
                    items={todos.map((t) => ({
                      ...t,
                      date: t.start_date && t.end_date && t.start_date !== t.end_date
                        ? `${t.start_date} ~ ${t.end_date}`
                        : t.start_date || t.end_date || "",
                    }))}
                    onAdd={() => setModalType("todo")}
                    onItemContextMenu={(item) => openEditModal("todo", item)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <MiniCalendar todos={todos} />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>

      {/* <Footer /> */}

      {/* 북마크 등록 모달: 카테고리 → 페이지 2단계 드롭박스 */}
      <BookmarkRegisterModal
        open={modalType === "bookmark"}
        onClose={() => setModalType(null)}
        onSubmit={handleAddSubmit}
      />

      {/* 투두 등록 모달 */}
      <AddModal
        open={modalType === "todo"}
        title="To Do 등록"
        fields={[
          { key: "title", label: "내용", required: true },
          { key: "start_date", label: "시작일", required: true, type: "date" },
          { key: "end_date", label: "종료일", required: false, type: "date" },
        ]}
        onClose={() => setModalType(null)}
        onSubmit={handleAddSubmit}
      />

      <EditModal
        open={!!editType}
        type={editType || "bookmark"}
        item={editItem}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
        onDelete={handleEditDelete}
      />
    </DashboardLayout>
  );
}

export default Dashboard;
