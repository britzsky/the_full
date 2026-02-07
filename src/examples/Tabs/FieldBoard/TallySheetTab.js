/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import {
  Modal,
  Box,
  Select,
  MenuItem,
  Typography,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
  Checkbox,
} from "@mui/material";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Autocomplete from "@mui/material/Autocomplete";
import dayjs from "dayjs";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import useTallysheetData, { parseNumber, formatNumber } from "./tallysheetData";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";
import Draggable from "react-draggable";
import { API_BASE_URL } from "config";

/**
 * ✅✅ IMPORTANT
 * - type=1000: 현재 구성(법인카드) 기능 그대로 유지
 * - type=1008: "현금/카드" + (현금이면 "현금영수증 유형") 포함 모달 추가, 저장/조회 endpoint는 별도
 * - type != 1 인 셀: 테이블에서 직접 입력(contentEditable) 불가, 모달로만 입력/수정
 * - 단, type=1002, 1003 은 모달도 띄우지 않음(클릭 무시)
 *
 * ✅ type=1008 endpoint는 아래 상수만 실제 서버에 맞게 바꿔주세요.
 */

// ======================== ✅ type=1008 전용 endpoint (프로젝트에 맞게 교체) ========================
const ENDPOINT_CASH_SAVE = "/receipt-scanV4"; // TODO: 실제 저장 endpoint로 변경
const ENDPOINT_CASH_LIST = "/Account/AccountPurchaseTallyPaymentList"; // TODO: 실제 목록 조회 endpoint로 변경

// ======================== ✅ 기타 type(1000/1008/1/1002/1003 제외) 공통 endpoint ========================
// ✅ 요청 반영: 저장 endPoint = /receipt-scan, 결제 리스트 endPoint = /Account/AccountPurchaseList
const ENDPOINT_OTHER_SAVE = "/receipt-scan";
const ENDPOINT_OTHER_LIST = "/Account/AccountPurchaseTallyPaymentList";

// ======================== ✅ Floating(비차단) 이미지 미리보기 ========================
function FloatingImagePreview({ open, src, title = "미리보기", onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open || !src) return null;

  return ReactDOM.createPortal(
    <Draggable handle=".drag-handle" bounds="parent">
      <Box
        sx={{
          position: "fixed",
          top: 120,
          left: 120,
          zIndex: 4000,
          width: 460,
          maxWidth: "92vw",
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 24,
          p: 1,
          pointerEvents: "auto",
          border: "1px solid #ddd",
          overflow: "hidden",
        }}
      >
        <Box
          className="drag-handle"
          sx={{
            cursor: "move",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
            px: 1,
            py: 0.75,
            borderRadius: 1,
            bgcolor: "#f5f5f5",
            borderBottom: "1px solid #e5e5e5",
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{title}</Typography>
          <MDButton variant="contained" color="error" onClick={onClose}>
            닫기
          </MDButton>
        </Box>

        <Box sx={{ mt: 1, maxHeight: "75vh", overflow: "auto" }}>
          <img
            src={src}
            alt="preview"
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 10,
              objectFit: "contain",
              display: "block",
            }}
          />
        </Box>
      </Box>
    </Draggable>,
    document.body
  );
}

FloatingImagePreview.propTypes = {
  open: PropTypes.bool.isRequired,
  src: PropTypes.string,
  title: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

// ======================== ✅ 상단 예산/사용/비율 표시 바 (모바일 UI로 통일) ========================
function BudgetSummaryBar({ budget, used, title = "식자재", monthText }) {
  const safeBudget = parseNumber(budget);
  const safeUsed = parseNumber(used);

  const ratio = useMemo(() => {
    if (!safeBudget || safeBudget <= 0) return 0;
    return (safeUsed / safeBudget) * 100;
  }, [safeBudget, safeUsed]);

  const ratioText = `${ratio.toFixed(2)}%`;

  const items = [
    { label: "월예산", value: formatNumber(safeBudget) },
    { label: "사용금액", value: formatNumber(safeUsed) },
    { label: "예산대비", value: ratioText },
  ];

  const monthLabel = monthText ?? dayjs().format("MM월");

  return (
    <Box
      sx={{
        width: "100%",
        border: "1px solid #111",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 0.5,
          py: 0.5,
          bgcolor: "#288ebe",
          borderBottom: "1px solid #111",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{monthLabel}</Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
        }}
      >
        {items.map((it) => (
          <Box
            key={it.label}
            sx={{
              px: 0.5,
              py: 0.5,
              borderRight: "1px solid #111",
              "&:last-of-type": { borderRight: "none" },
              bgcolor: "#fff",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#444" }}>
              {it.label} : {it.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

BudgetSummaryBar.propTypes = {
  budget: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  used: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  title: PropTypes.string,
  monthText: PropTypes.string,
};

// ======================== 은행/포맷 유틸 ========================
const KOREAN_BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "IBK기업은행",
  "NH농협은행",
  "수협은행",
  "KDB산업은행",
  "SC제일은행",
  "씨티은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "우체국",
  "새마을금고",
  "신협",
  "저축은행",
  "부산은행",
  "대구은행",
  "광주은행",
  "전북은행",
  "경남은행",
  "제주은행",
  "기타(직접입력)",
];

const onlyDigits = (v = "") => String(v).replace(/\D/g, "");

const formatByGroups = (digits, groups) => {
  let idx = 0;
  const parts = [];
  for (const g of groups) {
    if (digits.length <= idx) break;
    parts.push(digits.slice(idx, idx + g));
    idx += g;
  }
  if (digits.length > idx) parts.push(digits.slice(idx));
  return parts.filter(Boolean).join("-");
};

const BANK_MASKS_BY_NAME = {
  KB국민은행: [
    [3, 2, 6],
    [3, 3, 6],
  ],
  신한은행: [
    [3, 3, 6],
    [3, 2, 6],
  ],
  우리은행: [
    [4, 3, 6],
    [3, 3, 6],
  ],
  하나은행: [
    [3, 6, 5],
    [3, 3, 6],
  ],
  IBK기업은행: [
    [3, 6, 2, 3],
    [3, 3, 6],
  ],
  NH농협은행: [
    [3, 4, 4, 2],
    [3, 3, 6],
  ],
  카카오뱅크: [
    [4, 2, 7],
    [3, 3, 6],
  ],
  토스뱅크: [
    [3, 3, 6],
    [4, 3, 6],
  ],
  케이뱅크: [
    [3, 3, 6],
    [4, 2, 7],
  ],
  우체국: [
    [4, 4, 4],
    [3, 3, 6],
  ],
};

const pickBestMask = (bankName, len) => {
  const masks = BANK_MASKS_BY_NAME[bankName] || [];
  if (!masks.length) return null;

  let best = masks[0];
  let bestScore = Infinity;
  for (const m of masks) {
    const sum = m.reduce((a, b) => a + b, 0);
    const score = Math.abs(sum - len);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
};

const formatAccountNumber = (bankName, value) => {
  const digits = onlyDigits(value).slice(0, 16);
  const mask = pickBestMask(bankName, digits.length);

  if (mask) return formatByGroups(digits, mask);

  if (digits.length <= 9) return formatByGroups(digits, [3, 3, 3]);
  if (digits.length <= 12) return formatByGroups(digits, [3, 3, 6]);
  return formatByGroups(digits, [4, 4, 4, 4]);
};

const formatBizNo = (value) => {
  const digits = onlyDigits(value).slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 5);
  const c = digits.slice(5, 10);
  if (digits.length <= 3) return a;
  if (digits.length <= 5) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
};

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.startsWith("0505")) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

// ======================== 선택 테이블 컴포넌트 ========================
function YourSelectableTable({ data, selected, setSelected }) {
  const toggleSelect = (item) => {
    const index = selected.findIndex((i) => JSON.stringify(i) === JSON.stringify(item));
    if (index !== -1) setSelected(selected.filter((_, idx) => idx !== index));
    else setSelected([...selected, item]);
  };

  const isSelected = (item) => selected.some((i) => JSON.stringify(i) === JSON.stringify(item));

  const tableSx = {
    maxHeight: "550px",
    overflow: "auto",
    "& table": { borderCollapse: "collapse", width: "100%", minWidth: "100%", borderSpacing: 0 },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "nowrap",
      fontSize: "12px",
    },
    "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
  };

  return (
    <Box sx={tableSx}>
      <table>
        <thead>
          <tr>
            <th>선택</th>
            <th>이름</th>
            <th>타입</th>
          </tr>
        </thead>
        <tbody>
          {(data || []).map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: isSelected(row) ? "#d3f0ff" : row.del_yn === "Y" ? "#E0E0E0" : "white",
              }}
            >
              <td>
                <input
                  type="checkbox"
                  checked={isSelected(row)}
                  onChange={() => toggleSelect(row)}
                />
              </td>
              <td>{row.name}</td>
              <td>{row.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

YourSelectableTable.propTypes = {
  data: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  setSelected: PropTypes.func.isRequired,
};

// ======================== 메인 집계표 컴포넌트 ========================
function TallySheetTab() {
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const localUserId = useMemo(() => localStorage.getItem("user_id") || "", []);
  const isAccountLocked = useMemo(() => !!localAccountId, [localAccountId]);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [accountInput, setAccountInput] = useState("");

  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const [images, setImages] = useState(Array(31).fill(null));
  const [receiptType, setReceiptType] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [tabValue, setTabValue] = useState(0);

  const hook = useTallysheetData(selectedAccountId, year, month);

  const {
    dataRows,
    setDataRows,
    data2Rows,
    setData2Rows,
    accountList,
    countMonth,
    count2Month,
    loading,
    fetchDataRows,
    fetchData2Rows,
    prevYear: hookPrevYear,
    prevMonth: hookPrevMonth,
    budgetGrant = 0,
    budget2Grant = 0,
    fetchBudgetGrant = async () => {},
    fetchBudget2Grant = async () => {},
  } = hook || {};

  const prevYm = useMemo(() => {
    const base = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    return base.subtract(1, "month");
  }, [year, month]);

  const prevYear = useMemo(() => hookPrevYear ?? prevYm.year(), [hookPrevYear, prevYm]);
  const prevMonth = useMemo(() => hookPrevMonth ?? prevYm.month() + 1, [hookPrevMonth, prevYm]);

  // ✅ 해당 월의 실제 일수
  const daysInMonthNow = useMemo(() => {
    return dayjs(`${year}-${String(month).padStart(2, "0")}-01`).daysInMonth();
  }, [year, month]);

  const daysInMonthPrev = useMemo(() => {
    return dayjs(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01`).daysInMonth();
  }, [prevYear, prevMonth]);

  useEffect(() => {
    if (!localAccountId) return;
    if (String(selectedAccountId) !== String(localAccountId)) setSelectedAccountId(localAccountId);
  }, [localAccountId, selectedAccountId]);

  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (filteredAccountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) ||
      null
    );
  }, [filteredAccountList, selectedAccountId]);

  // ✅ localStorage account_id가 있으면: accountList 로딩 후 거래처명까지 자동 매핑 + 선택 고정
  useEffect(() => {
    if (!localAccountId) return;

    const match = (accountList || []).find((a) => String(a.account_id) === String(localAccountId));

    // account_id는 무조건 고정
    if (String(selectedAccountId) !== String(localAccountId)) {
      setSelectedAccountId(String(localAccountId));
    }

    // 화면에 보이는 텍스트(거래처명)도 고정
    if (match?.account_name) {
      if (accountInput !== String(match.account_name)) {
        setAccountInput(String(match.account_name));
      }
    } else {
      // 혹시 목록에서 못 찾는 경우(비정상)에는 입력값은 비워둠
      // (원하면 localAccountId 표시로 바꿔도 됨)
      if (accountInput !== "") setAccountInput("");
    }
  }, [localAccountId, accountList, selectedAccountId, accountInput]);

  // ✅ 검색: 엔터 입력 시 텍스트로 거래처 선택 (정확 일치 우선, 없으면 부분 일치)
  const selectAccountByInput = () => {
    if (isAccountLocked) return;
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = filteredAccountList || [];
    const qLower = q.toLowerCase();
    const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((a) =>
        String(a?.account_name || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      setSelectedAccountId(partial.account_id);
      setAccountInput(partial.account_name || q);
    }
  };

  useEffect(() => {
    setDataRows?.([]);
    setData2Rows?.([]);
    setOriginalRows([]);
    setOriginal2Rows([]);

    // ✅ 현재 선택 월 기준으로 길이 맞춤
    setImages(Array(daysInMonthNow).fill(null));
    setReceiptType(Array(daysInMonthNow).fill("")); // 타입도 같이 맞추는게 안전
  }, [selectedAccountId, year, month, setDataRows, setData2Rows, daysInMonthNow]);

  useEffect(() => {
    if ((dataRows || []).length > 0 && originalRows.length === 0) {
      setOriginalRows((dataRows || []).map((r) => ({ ...r })));
    }
  }, [dataRows, originalRows.length]);

  useEffect(() => {
    if ((data2Rows || []).length > 0 && original2Rows.length === 0) {
      setOriginal2Rows((data2Rows || []).map((r) => ({ ...r })));
    }
  }, [data2Rows, original2Rows.length]);

  useEffect(() => {
    if (localAccountId) {
      setSelectedAccountId(String(localAccountId));

      const match = (accountList || []).find(
        (a) => String(a.account_id) === String(localAccountId)
      );
      if (match?.account_name) setAccountInput(String(match.account_name));

      return;
    }

    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
      setAccountInput(String(accountList[0].account_name || ""));
    }
  }, [accountList, selectedAccountId, localAccountId]);

  // ======================== ✅ Floating Preview 상태 ========================
  const [floatingPreview, setFloatingPreview] = useState({
    open: false,
    src: null,
    title: "미리보기",
  });

  const openFloatingPreview = useCallback((src, title = "미리보기") => {
    if (!src) return;
    setFloatingPreview({ open: true, src, title });
  }, []);

  const closeFloatingPreview = useCallback(() => {
    setFloatingPreview((p) => ({ ...p, open: false }));
  }, []);

  // ======================== ✅ "클릭된 셀/행" 하이라이트 상태 (요청 반영) ========================
  const [activeCell, setActiveCell] = useState({
    isSecond: false,
    rowIndex: null,
    colKey: null,
  });

  // ======================== 공통 util ========================
  const toPreviewUrl = useCallback((path) => {
    if (!path) return null;
    const s = String(path);
    if (s.startsWith("blob:")) return s;
    if (s.startsWith("http")) return s;
    return `${API_BASE_URL}${s}`;
  }, []);

  // ✅✅ FIX: 날짜는 항상 dayjs로 확정해서 YYYY-MM-DD 만들기
  const buildCellDate = useCallback((y, m, dayIdx) => {
    const dd = String((dayIdx ?? 0) + 1).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const yy = String(y);
    return dayjs(`${yy}-${mm}-${dd}`).format("YYYY-MM-DD");
  }, []);

  const maskCardNo = (no) => {
    const s = String(no ?? "").replace(/\s+/g, "");
    if (!s) return "";
    const last4 = s.slice(-4);
    return `****-****-****-${last4}`;
  };

  // ======================== ✅ 법인카드(1000) 모달 플로우 (기존 유지 + 목록에서 바로 수정/저장) ========================
  const [cardChoiceOpen, setCardChoiceOpen] = useState(false);
  const [cardCreateOpen, setCardCreateOpen] = useState(false);
  const [cardListOpen, setCardListOpen] = useState(false);
  const cardFileRef = useRef(null);

  // ✅ (1000) 목록 전체 편집용
  const [cardOrigRowsForList, setCardOrigRowsForList] = useState([]);

  // 문자열 비교용(차량관리 탭과 동일 컨셉)
  const normalizeStr = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);

  // 변경 셀 스타일
  const getCardCellStyle = (rowIndex, key, value) => {
    const orig = cardOrigRowsForList?.[rowIndex]?.[key];

    // total 같은 숫자계열
    if (key === "total") {
      return parseNumber(orig) !== parseNumber(value) ? { color: "red" } : { color: "black" };
    }

    if (typeof orig === "string" && typeof value === "string") {
      return normalizeStr(orig) !== normalizeStr(value) ? { color: "red" } : { color: "black" };
    }
    return orig !== value ? { color: "red" } : { color: "black" };
  };

  // 행 변경 여부(필드 + 파일)
  const isCardRowChanged = (row, orig) => {
    if (!row || !orig) return false;
    const fields = ["use_name", "total", "card_idx", "receipt_type"];
    const fieldChanged = fields.some((k) => {
      if (k === "total") return parseNumber(row[k]) !== parseNumber(orig[k]);
      return normalizeStr(row[k]) !== normalizeStr(orig[k]);
    });
    const fileChanged = !!row._file; // 새 파일 선택하면 변경으로 취급
    return fieldChanged || fileChanged;
  };

  // 행 업데이트 헬퍼
  const updateCardRow = (rowIndex, patch) => {
    setCardEditRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, ...patch } : r)));
  };

  // 파일 선택(행마다)
  const handleCardRowFileChange = (rowIndex, file) => {
    if (!file) return;

    // 기존 previewUrl 있으면 revoke
    setCardEditRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        if (r._preview && String(r._preview).startsWith("blob:")) URL.revokeObjectURL(r._preview);
        return { ...r, _file: file, _preview: URL.createObjectURL(file) };
      })
    );
  };

  const [cardContext, setCardContext] = useState({
    isSecond: false,
    rowIndex: null,
    colKey: null,
    dayIndex: null,
    dateStr: "",
    cellValue: 0,
  });

  const [cardRows, setCardRows] = useState([]);
  const [cardSelectedRow, setCardSelectedRow] = useState(null);
  const [cardSelectedKey, setCardSelectedKey] = useState(null);

  const [corpCardList, setCorpCardList] = useState([]);
  const [corpCardLoading, setCorpCardLoading] = useState(false);

  // ======================== ✅ (1000) List: 전체 행 편집용 상태 ========================
  const [cardEditRows, setCardEditRows] = useState([]);
  const [cardOrigRowsForDiff, setCardOrigRowsForDiff] = useState([]);
  const [cardRowFiles, setCardRowFiles] = useState({}); // { [rowKey]: {file, previewUrl} }

  const [cardForm, setCardForm] = useState({
    id: null,
    use_name: "",
    total: "",
    receipt_image: null,
    card_idx: "",
    receipt_type: "UNKNOWN",
    card_brand: "",
    card_no: "",
    sale_id: "",
    account_id: "",
  });

  const [cardReceiptPreview, setCardReceiptPreview] = useState(null);

  const getCorpCardByIdx = useCallback(
    (idx) => {
      const key = String(idx ?? "");
      if (!key) return null;
      return (corpCardList || []).find((c) => String(c.idx) === key) || null;
    },
    [corpCardList]
  );

  const fetchAccountCorporateCardList = useCallback(async (accountId) => {
    if (!accountId) {
      setCorpCardList([]);
      return [];
    }

    setCorpCardLoading(true);
    try {
      const res = await api.get("/Account/AccountCorporateCardList", {
        params: { account_id: accountId },
        validateStatus: () => true,
      });

      if (res.status !== 200) throw new Error(res.data?.message || "법인카드 목록 조회 실패");

      const list = res.data?.data || res.data || [];
      setCorpCardList(Array.isArray(list) ? list : []);
      return Array.isArray(list) ? list : [];
    } finally {
      setCorpCardLoading(false);
    }
  }, []);

  // ✅ 목록 열릴 때도 카드목록 필요(선택 셀렉트 편집)
  useEffect(() => {
    if (!selectedAccountId) return;
    if (cardCreateOpen || cardListOpen) {
      fetchAccountCorporateCardList(selectedAccountId).catch((e) => {
        Swal.fire("오류", e.message || "법인카드 목록 조회 중 오류", "error");
      });
    }
  }, [selectedAccountId, cardCreateOpen, cardListOpen, fetchAccountCorporateCardList]);

  useEffect(() => {
    if (!cardSelectedRow) return;
    setCardReceiptPreview(toPreviewUrl(cardSelectedRow.receipt_image));
  }, [cardSelectedRow, toPreviewUrl]);

  const handleCardReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCardForm((p) => ({ ...p, receipt_image: file }));
    const url = URL.createObjectURL(file);
    setCardReceiptPreview(url);
  };

  useEffect(() => {
    return () => {
      if (cardReceiptPreview && String(cardReceiptPreview).startsWith("blob:")) {
        URL.revokeObjectURL(cardReceiptPreview);
      }
    };
  }, [cardReceiptPreview]);

  const fetchCorpCardList = async (accountId, dateStr) => {
    const res = await api.get("/Account/AccountCorporateCardPaymentList", {
      params: { account_id: accountId, payment_dt: dateStr },
      validateStatus: () => true,
    });

    if (res.status !== 200) throw new Error(res.data?.message || "목록 조회 실패");
    return res.data || [];
  };

  const saveCorpCardPayment = async (mode) => {
    const fd = new FormData();

    fd.append("user_id", localUserId);

    const submitAccountId =
      mode === "edit"
        ? String(cardForm.account_id || selectedAccountId)
        : String(selectedAccountId);

    fd.append("account_id", submitAccountId);

    // ✅✅ FIX: cell_date는 항상 컨텍스트(클릭한 셀) 기준 dayjs로 확정
    const y = cardContext.isSecond ? prevYear : year;
    const m = cardContext.isSecond ? prevMonth : month;
    const fixedCellDate = buildCellDate(y, m, cardContext.dayIndex ?? 0);

    fd.append("cell_day", String((cardContext.dayIndex ?? 0) + 1));
    fd.append("cell_date", fixedCellDate);

    fd.append("receipt_type", cardForm.receipt_type || "UNKNOWN");
    fd.append("type", 1000);
    fd.append("saveType", "cor");

    if (cardForm.card_idx) fd.append("card_idx", cardForm.card_idx);

    const picked = getCorpCardByIdx(cardForm.card_idx);
    const brand = cardForm.card_brand || picked?.card_brand || "";
    const no = cardForm.card_no || picked?.card_no || "";

    fd.append("card_brand", brand);
    fd.append("card_no", no);
    fd.append("total", parseNumber(cardForm.total));

    if (cardForm.receipt_image) fd.append("file", cardForm.receipt_image);

    if (mode === "edit") {
      if (cardForm.id != null) fd.append("id", cardForm.id);
      if (cardForm.sale_id) fd.append("sale_id", String(cardForm.sale_id));
      fd.append("row_account_id", submitAccountId);
    }

    try {
      Swal.fire({
        title: "영수증 확인 중 입니다.",
        text: "잠시만 기다려 주세요...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // ✅ "등록할 때 endpoint" 그대로 사용
      const res = await api.post("/receipt-scanV3", fd, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        Swal.fire("완료", mode === "edit" ? "수정되었습니다." : "등록되었습니다.", "success");

        await fetchDataRows?.(selectedAccountId, year, month);
        await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
        await fetchBudgetGrant?.(selectedAccountId, year, month);
        await fetchBudget2Grant?.(selectedAccountId, year, month);

        setOriginalRows([]);
        setOriginal2Rows([]);

        if (cardFileRef.current) cardFileRef.current.value = "";
        setCardForm((p) => ({ ...p, receipt_image: null }));
        setCardReceiptPreview(null);
        return true;
      }

      if (res.status === 400) {
        Swal.fire("실패", res.data?.message || "저장에 실패했습니다.", "error");
        return false;
      }

      Swal.fire(
        "오류",
        res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`,
        "error"
      );
      return false;
    } catch (err) {
      Swal.close();
      Swal.fire("오류", err.message || "저장 중 문제가 발생했습니다.", "error");
      return false;
    }
  };

  const saveCorpCardPaymentsBulk = async () => {
    if (!Array.isArray(cardEditRows) || cardEditRows.length === 0) {
      Swal.fire("안내", "저장할 데이터가 없습니다.", "info");
      return false;
    }

    const changedIndexes = cardEditRows
      .map((r, i) => (isCardRowChanged(r, cardOrigRowsForList?.[i]) ? i : -1))
      .filter((i) => i >= 0);

    if (changedIndexes.length === 0) {
      Swal.fire("안내", "변경된 내용이 없습니다.", "info");
      return false;
    }

    try {
      Swal.fire({
        title: "저장 중 입니다.",
        text: `0 / ${changedIndexes.length}`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      for (let step = 0; step < changedIndexes.length; step++) {
        const idx = changedIndexes[step];
        const row = cardEditRows[idx];

        Swal.update({
          text: `${step + 1} / ${changedIndexes.length}`,
        });

        const fd = new FormData();
        fd.append("user_id", localUserId);

        const submitAccountId = String(row.account_id || selectedAccountId);
        fd.append("account_id", submitAccountId);

        // ✅ 클릭한 셀 날짜 기준(기존 로직 유지)
        const y = cardContext.isSecond ? prevYear : year;
        const m = cardContext.isSecond ? prevMonth : month;
        const fixedCellDate = buildCellDate(y, m, cardContext.dayIndex ?? 0);

        fd.append("cell_day", String((cardContext.dayIndex ?? 0) + 1));
        fd.append("cell_date", fixedCellDate);

        fd.append("receipt_type", row.receipt_type || "UNKNOWN");
        fd.append("type", 1000);
        fd.append("saveType", "cor");

        if (row.card_idx) fd.append("card_idx", String(row.card_idx));

        const picked = getCorpCardByIdx(row.card_idx);
        const brand = row.card_brand || picked?.card_brand || "";
        const no = row.card_no || picked?.card_no || "";
        fd.append("card_brand", brand);
        fd.append("card_no", no);

        fd.append("use_name", row.use_name || "");
        fd.append("total", parseNumber(row.total));

        // ✅ 파일 선택한 경우만
        if (row._file) fd.append("file", row._file);

        // ✅ edit 필수키
        if (row.id != null) fd.append("id", row.id);
        if (row.sale_id) fd.append("sale_id", String(row.sale_id));
        fd.append("row_account_id", submitAccountId);

        const res = await api.post("/receipt-scanV3", fd, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        if (res.status !== 200) {
          throw new Error(res.data?.message || `저장 실패 (code: ${res.status})`);
        }
      }

      Swal.close();
      Swal.fire("완료", "저장되었습니다.", "success");

      await fetchDataRows?.(selectedAccountId, year, month);
      await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
      await fetchBudgetGrant?.(selectedAccountId, year, month);
      await fetchBudget2Grant?.(selectedAccountId, year, month);

      setOriginalRows([]);
      setOriginal2Rows([]);

      return true;
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 문제가 발생했습니다.", "error");
      return false;
    }
  };

  const handleCorpCardCellClick = async (rowOriginal, rIdx, colKey, isSecond = false) => {
    if (!rowOriginal || rowOriginal.name === "총합") return;
    if (colKey === "name" || colKey === "total") return;
    if (String(rowOriginal.type) !== "1000") return;

    const rows = isSecond ? data2Rows : dataRows;
    const cellVal = parseNumber(rows?.[rIdx]?.[colKey]);

    const dayIndex = Number(String(colKey).replace("day_", "")) - 1;
    if (Number.isNaN(dayIndex) || dayIndex < 0) return;

    const y = isSecond ? prevYear : year;
    const m = isSecond ? prevMonth : month;
    const dateStr = buildCellDate(y, m, dayIndex);

    setCardContext({
      isSecond,
      rowIndex: rIdx,
      colKey,
      dayIndex,
      dateStr,
      cellValue: cellVal,
    });
    try {
      Swal.fire({
        title: "확인 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCorpCardList(selectedAccountId, dateStr);
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      if (safe.length > 0) {
        // 이미 등록됨 -> 선택 모달(등록/수정)
        setCardChoiceOpen(true);
        return;
      }
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }

    // 목록이 없으면 신규 등록
    setCardForm((p) => ({
      ...p,
      id: null,
      use_name: "",
      total: "",
      receipt_image: null,
      card_idx: "",
      receipt_type: "UNKNOWN",
      card_brand: "",
      card_no: "",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
    }));
    setCardReceiptPreview(null);
    setCardCreateOpen(true);
  };

  const openCreateFromChoice = () => {
    setCardChoiceOpen(false);
    setCardForm((p) => ({
      ...p,
      id: null,
      use_name: "",
      total: "",
      receipt_image: null,
      card_idx: "",
      receipt_type: "UNKNOWN",
      card_brand: "",
      card_no: "",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
    }));
    setCardReceiptPreview(null);
    setCardCreateOpen(true);
  };

  const openListFromChoice = async () => {
    setCardChoiceOpen(false);

    try {
      Swal.fire({
        title: "불러오는 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCorpCardList(selectedAccountId, cardContext.dateStr);
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      setCardRows(safe);

      const deep = safe.map((r) => ({ ...r }));
      setCardEditRows(deep);
      setCardOrigRowsForDiff(JSON.parse(JSON.stringify(deep)));
      setCardRowFiles({});

      setCardListOpen(true);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }
  };

  // ✅ 목록에서 행 클릭하면 곧바로 편집 상태(cardForm)로 바뀌게
  const selectCardRowForInlineEdit = (rowObj, rowKey) => {
    setCardSelectedRow(rowObj);
    setCardSelectedKey(rowKey);

    setCardForm((p) => ({
      ...p,
      id: rowObj.id,
      use_name: rowObj.use_name || "",
      total: String(rowObj.total ?? ""),
      receipt_image: null,
      card_idx: String(rowObj.card_idx ?? rowObj.corp_card_idx ?? rowObj.idx ?? ""),
      receipt_type: rowObj.receipt_type || p.receipt_type || "UNKNOWN",
      card_brand: rowObj.card_brand || p.card_brand || "",
      card_no: rowObj.card_no || p.card_no || "",
      sale_id: String(rowObj.sale_id ?? ""),
      account_id: String(rowObj.account_id ?? selectedAccountId ?? ""),
    }));

    setCardReceiptPreview(toPreviewUrl(rowObj.receipt_image));
  };

  useEffect(() => {
    if (!cardListOpen) return;
    if (cardSelectedRow) return; // 이미 선택되어 있으면 패스
    if (!Array.isArray(cardRows) || cardRows.length === 0) return;

    const first = cardRows[0];
    const rowKey = String(first.id ?? first.sale_id ?? 0);
    selectCardRowForInlineEdit(first, rowKey);
  }, [cardListOpen, cardRows, cardSelectedRow, selectCardRowForInlineEdit]);

  // ======================== ✅ 1008 모달 플로우 (목록에서 바로 수정/저장) ========================
  const [cashChoiceOpen, setCashChoiceOpen] = useState(false);
  const [cashCreateOpen, setCashCreateOpen] = useState(false);
  const [cashListOpen, setCashListOpen] = useState(false);
  const cashFileRef = useRef(null);

  const [cashContext, setCashContext] = useState({
    isSecond: false,
    rowIndex: null,
    colKey: null,
    dayIndex: null,
    dateStr: "",
    cellValue: 0,
  });

  const [cashRows, setCashRows] = useState([]);
  const [cashSelectedRow, setCashSelectedRow] = useState(null);
  const [cashSelectedKey, setCashSelectedKey] = useState(null);

  // ======================== ✅ (1008) List: 전체 행 편집용 상태 ========================
  const [cashEditRows, setCashEditRows] = useState([]);
  const [cashOrigRowsForDiff, setCashOrigRowsForDiff] = useState([]);
  const [cashRowFiles, setCashRowFiles] = useState({}); // { [rowKey]: {file, previewUrl} }

  const [cashForm, setCashForm] = useState({
    id: null,
    use_name: "",
    total: "",
    payType: "1",
    cash_receipt_type: "3",
    receipt_image: null,
    receipt_type: "UNKNOWN",
    sale_id: "",
    account_id: "",
  });

  const [cashReceiptPreview, setCashReceiptPreview] = useState(null);

  const handleCashReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCashForm((p) => ({ ...p, receipt_image: file }));
    const url = URL.createObjectURL(file);
    setCashReceiptPreview(url);
  };

  useEffect(() => {
    return () => {
      if (cashReceiptPreview && String(cashReceiptPreview).startsWith("blob:")) {
        URL.revokeObjectURL(cashReceiptPreview);
      }
    };
  }, [cashReceiptPreview]);

  const fetchCashPaymentList = async (accountId, dateStr) => {
    const res = await api.get(ENDPOINT_CASH_LIST, {
      params: { account_id: accountId, saleDate: dateStr, type: 1008 },
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res.data?.message || "목록 조회 실패");
    return res.data || [];
  };

  const saveCashPayment = async (mode) => {
    const fd = new FormData();

    fd.append("user_id", localUserId);

    const submitAccountId =
      mode === "edit"
        ? String(cashForm.account_id || selectedAccountId)
        : String(selectedAccountId);

    fd.append("account_id", submitAccountId);

    const y = cashContext.isSecond ? prevYear : year;
    const m = cashContext.isSecond ? prevMonth : month;
    const fixedCellDate = buildCellDate(y, m, cashContext.dayIndex ?? 0);

    const cellDay = String((cashContext.dayIndex ?? 0) + 1);
    fd.append("cell_day", cellDay);
    fd.append("cell_date", fixedCellDate);

    fd.append("type", 1008);

    fd.append("payType", String(cashForm.payType || "1"));
    fd.append("cash_receipt_type", String(cashForm.cash_receipt_type || "3"));
    fd.append("receipt_type", cashForm.receipt_type || "UNKNOWN");
    fd.append("use_name", cashForm.use_name || "");
    fd.append("total", parseNumber(cashForm.total));

    if (cashForm.receipt_image) fd.append("file", cashForm.receipt_image);

    if (mode === "edit") {
      if (cashForm.id != null) fd.append("id", cashForm.id);
      if (cashForm.sale_id) fd.append("sale_id", String(cashForm.sale_id));
      fd.append("row_account_id", submitAccountId);
    }

    try {
      Swal.fire({
        title: "저장 중 입니다.",
        text: "잠시만 기다려 주세요...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // ✅ 등록 때 endpoint 그대로
      const res = await api.post(ENDPOINT_CASH_SAVE, fd, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        const desiredPayType = String(cashForm.payType || "1");
        const desiredCashReceiptType = String(cashForm.cash_receipt_type || "3");
        const savedPayType = String(res.data?.payType ?? res.data?.pay_type ?? "");
        const savedCashReceiptType = String(
          res.data?.cashReceiptType ?? res.data?.cash_receipt_type ?? ""
        );

        // ✅ OCR이 payType을 카드로 덮어쓴 경우, 사용자 선택(현금)을 다시 반영
        if (
          desiredPayType === "1" &&
          (savedPayType === "2" || savedCashReceiptType !== desiredCashReceiptType)
        ) {
          const purchase = res.data || {};
          const saleId = String(purchase.sale_id || cashForm.sale_id || "");
          const fixAccountId = String(purchase.account_id || submitAccountId || "");
          const fixSaleDate = String(purchase.saleDate || cashContext.dateStr || "");

          if (saleId && fixAccountId) {
            const fdFix = new FormData();
            fdFix.append("user_id", localUserId);
            fdFix.append("account_id", fixAccountId);
            fdFix.append("row_account_id", fixAccountId);
            fdFix.append("saleDate", fixSaleDate);
            fdFix.append("type", 1008);
            fdFix.append("payType", "1");
            fdFix.append("cash_receipt_type", desiredCashReceiptType);
            fdFix.append("use_name", purchase.use_name || cashForm.use_name || "");
            fdFix.append(
              "receipt_type",
              purchase.receipt_type || cashForm.receipt_type || "UNKNOWN"
            );
            fdFix.append("total", parseNumber(purchase.total ?? cashForm.total ?? 0));
            fdFix.append("vat", parseNumber(purchase.vat ?? 0));
            fdFix.append("taxFree", parseNumber(purchase.taxFree ?? 0));
            fdFix.append("tax", parseNumber(purchase.tax ?? 0));
            fdFix.append("totalCash", parseNumber(purchase.total ?? cashForm.total ?? 0));
            fdFix.append("totalCard", 0);
            fdFix.append("cardNo", "");
            fdFix.append("cardBrand", "");
            if (purchase.bizNo) fdFix.append("bizNo", purchase.bizNo);
            if (purchase.note) fdFix.append("note", purchase.note);
            if (purchase.receipt_image) fdFix.append("receipt_image", purchase.receipt_image);
            fdFix.append("sale_id", saleId);
            if (purchase.id != null) fdFix.append("id", purchase.id);

            const resFix = await api.post("/Account/AccountTallyToPurchaseSave", fdFix, {
              headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
              validateStatus: () => true,
            });

            if (resFix.status !== 200) {
              throw new Error(resFix.data?.message || `결제수단 보정 실패(code: ${resFix.status})`);
            }
          }
        }

        Swal.fire("완료", mode === "edit" ? "수정되었습니다." : "등록되었습니다.", "success");

        await fetchDataRows?.(selectedAccountId, year, month);
        await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
        await fetchBudgetGrant?.(selectedAccountId, year, month);
        await fetchBudget2Grant?.(selectedAccountId, year, month);

        setOriginalRows([]);
        setOriginal2Rows([]);

        if (cashFileRef.current) cashFileRef.current.value = "";
        setCashForm((p) => ({ ...p, receipt_image: null }));
        setCashReceiptPreview(null);
        return true;
      }

      if (res.status === 400) {
        Swal.fire("실패", res.data?.message || "저장에 실패했습니다.", "error");
        return false;
      }

      Swal.fire(
        "오류",
        res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`,
        "error"
      );
      return false;
    } catch (err) {
      Swal.close();
      Swal.fire("오류", err.message || "저장 중 문제가 발생했습니다.", "error");
      return false;
    }
  };

  const handleCashCellClick = async (rowOriginal, rIdx, colKey, isSecond = false) => {
    if (!rowOriginal || rowOriginal.name === "총합") return;
    if (colKey === "name" || colKey === "total") return;
    if (String(rowOriginal.type) !== "1008") return;

    const rows = isSecond ? data2Rows : dataRows;
    const cellVal = parseNumber(rows?.[rIdx]?.[colKey]);

    const dayIndex = Number(String(colKey).replace("day_", "")) - 1;
    if (Number.isNaN(dayIndex) || dayIndex < 0) return;

    const y = isSecond ? prevYear : year;
    const m = isSecond ? prevMonth : month;
    const dateStr = buildCellDate(y, m, dayIndex);

    setCashContext({
      isSecond,
      rowIndex: rIdx,
      colKey,
      dayIndex,
      dateStr,
      cellValue: cellVal,
    });
    try {
      Swal.fire({
        title: "확인 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCashPaymentList(selectedAccountId, dateStr);
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      if (safe.length > 0) {
        // 이미 등록됨 -> 선택 모달(등록/수정)
        setCashChoiceOpen(true);
        return;
      }
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }

    // 목록이 없으면 신규 등록
    setCashForm({
      id: null,
      use_name: "",
      total: "",
      payType: "1",
      cash_receipt_type: "3",
      receipt_image: null,
      receipt_type: "UNKNOWN",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
    });
    setCashReceiptPreview(null);
    setCashCreateOpen(true);
  };

  const openCashCreateFromChoice = () => {
    setCashChoiceOpen(false);
    setCashForm({
      id: null,
      use_name: "",
      total: "",
      payType: "1",
      cash_receipt_type: "3",
      receipt_image: null,
      receipt_type: "UNKNOWN",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
    });
    setCashReceiptPreview(null);
    setCashCreateOpen(true);
  };

  const openCashListFromChoice = async () => {
    setCashChoiceOpen(false);

    try {
      Swal.fire({
        title: "불러오는 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCashPaymentList(selectedAccountId, cashContext.dateStr);
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      const normalized = safe.map((r) => ({
        ...r,
        cash_receipt_type: String(r.cash_receipt_type ?? r.cashReceiptType ?? "3"),
      }));
      setCashRows(normalized);

      const deep = normalized.map((r) => ({ ...r }));
      setCashEditRows(deep);
      setCashOrigRowsForDiff(JSON.parse(JSON.stringify(deep)));
      setCashRowFiles({});

      setCashListOpen(true);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }
  };

  const selectCashRowForInlineEdit = (rowObj, rowKey) => {
    setCashSelectedRow(rowObj);
    setCashSelectedKey(rowKey);

    setCashForm({
      id: rowObj.id,
      use_name: rowObj.use_name || "",
      total: String(rowObj.total ?? ""),
      payType: String(rowObj.payType ?? "1"),
      cash_receipt_type: String(rowObj.cash_receipt_type ?? rowObj.cashReceiptType ?? "3"),
      receipt_image: null,
      receipt_type: rowObj.receipt_type || "UNKNOWN",
      sale_id: String(rowObj.sale_id ?? ""),
      account_id: String(rowObj.account_id ?? selectedAccountId ?? ""),
    });

    setCashReceiptPreview(toPreviewUrl(rowObj.receipt_image));
  };

  useEffect(() => {
    if (!cashListOpen) return;
    if (cashSelectedRow) return;
    if (!Array.isArray(cashRows) || cashRows.length === 0) return;

    const first = cashRows[0];
    const rowKey = String(first.id ?? first.sale_id ?? 0);
    selectCashRowForInlineEdit(first, rowKey);
  }, [cashListOpen, cashRows, cashSelectedRow]);

  // ======================== ✅ 기타 type 공통 모달 플로우 (목록에서 바로 수정/저장) ========================
  const [otherChoiceOpen, setOtherChoiceOpen] = useState(false);
  const [otherCreateOpen, setOtherCreateOpen] = useState(false);
  const [otherListOpen, setOtherListOpen] = useState(false);
  const otherFileRef = useRef(null);

  const [otherContext, setOtherContext] = useState({
    isSecond: false,
    rowIndex: null,
    colKey: null,
    dayIndex: null,
    dateStr: "",
    cellValue: 0,
    type: "",
    rowName: "",
  });

  const [otherRows, setOtherRows] = useState([]);
  const [otherSelectedRow, setOtherSelectedRow] = useState(null);
  const [otherSelectedKey, setOtherSelectedKey] = useState(null);

  // ======================== ✅ (기타 type) List: 전체 행 편집용 상태 ========================
  const [otherEditRows, setOtherEditRows] = useState([]);
  const [otherOrigRowsForDiff, setOtherOrigRowsForDiff] = useState([]);
  const [otherRowFiles, setOtherRowFiles] = useState({}); // { [rowKey]: {file, previewUrl} }

  const [otherForm, setOtherForm] = useState({
    id: null,
    use_name: "",
    total: "",
    receipt_image: null,
    receipt_type: "UNKNOWN",
    sale_id: "",
    account_id: "",
    type: "",
  });

  const [otherReceiptPreview, setOtherReceiptPreview] = useState(null);

  const handleOtherReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOtherForm((p) => ({ ...p, receipt_image: file }));
    const url = URL.createObjectURL(file);
    setOtherReceiptPreview(url);
  };

  useEffect(() => {
    return () => {
      if (otherReceiptPreview && String(otherReceiptPreview).startsWith("blob:")) {
        URL.revokeObjectURL(otherReceiptPreview);
      }
    };
  }, [otherReceiptPreview]);

  const fetchOtherPurchaseList = async (accountId, dateStr, typeValue) => {
    const res = await api.get(ENDPOINT_OTHER_LIST, {
      params: {
        account_id: accountId,
        saleDate: dateStr,
        type: typeValue,
      },
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res.data?.message || "목록 조회 실패");
    return res.data || [];
  };

  const saveOtherPayment = async (mode) => {
    if (otherContext.dayIndex == null) {
      Swal.fire("오류", "날짜 정보가 없습니다. (셀을 다시 클릭 후 저장하세요)", "error");
      return false;
    }

    const fd = new FormData();

    fd.append("user_id", localUserId);

    const submitAccountId =
      mode === "edit"
        ? String(otherForm.account_id || selectedAccountId)
        : String(selectedAccountId);

    fd.append("account_id", submitAccountId);

    const y = otherContext.isSecond ? prevYear : year;
    const m = otherContext.isSecond ? prevMonth : month;
    const fixedCellDate = buildCellDate(y, m, otherContext.dayIndex ?? 0);

    const cellDay = String((otherContext.dayIndex ?? 0) + 1);
    fd.append("cell_day", cellDay);
    fd.append("cell_date", fixedCellDate);
    fd.append("type", otherForm.type);
    fd.append("receipt_type", otherForm.receipt_type || "UNKNOWN");
    fd.append("use_name", otherForm.use_name || "");
    fd.append("total", parseNumber(otherForm.total));

    if (otherForm.receipt_image) fd.append("file", otherForm.receipt_image);

    if (mode === "edit") {
      if (otherForm.id != null) fd.append("id", otherForm.id);
      if (otherForm.sale_id) fd.append("sale_id", String(otherForm.sale_id));
      fd.append("row_account_id", submitAccountId);
    }

    try {
      Swal.fire({
        title: "저장 중 입니다.",
        text: "잠시만 기다려 주세요...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // ✅ 등록 때 endpoint 그대로
      const res = await api.post(ENDPOINT_OTHER_SAVE, fd, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        Swal.fire("완료", mode === "edit" ? "수정되었습니다." : "등록되었습니다.", "success");

        await fetchDataRows?.(selectedAccountId, year, month);
        await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
        await fetchBudgetGrant?.(selectedAccountId, year, month);
        await fetchBudget2Grant?.(selectedAccountId, year, month);

        setOriginalRows([]);
        setOriginal2Rows([]);

        if (otherFileRef.current) otherFileRef.current.value = "";
        setOtherForm((p) => ({ ...p, receipt_image: null }));
        setOtherReceiptPreview(null);
        return true;
      }

      if (res.status === 400) {
        Swal.fire("실패", res.data?.message || "저장에 실패했습니다.", "error");
        return false;
      }

      Swal.fire(
        "오류",
        res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`,
        "error"
      );
      return false;
    } catch (err) {
      Swal.close();
      Swal.fire("오류", err.message || "저장 중 문제가 발생했습니다.", "error");
      return false;
    }
  };

  const handleOtherCellClick = async (rowOriginal, rIdx, colKey, isSecond = false) => {
    if (!rowOriginal || rowOriginal.name === "총합") return;
    if (colKey === "name" || colKey === "total") return;

    const t = String(rowOriginal.type ?? "");
    if (!t) return;

    const rows = isSecond ? data2Rows : dataRows;
    const cellVal = parseNumber(rows?.[rIdx]?.[colKey]);

    const dayIndex = Number(String(colKey).replace("day_", "")) - 1;
    if (Number.isNaN(dayIndex) || dayIndex < 0) return;

    const y = isSecond ? prevYear : year;
    const m = isSecond ? prevMonth : month;
    const dateStr = buildCellDate(y, m, dayIndex);

    setOtherContext({
      isSecond,
      rowIndex: rIdx,
      colKey,
      dayIndex,
      dateStr,
      cellValue: cellVal,
      type: t,
      rowName: String(rowOriginal?.name ?? ""),
    });
    try {
      Swal.fire({
        title: "확인 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchOtherPurchaseList(selectedAccountId, dateStr, t);
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      if (safe.length > 0) {
        // 이미 등록됨 -> 선택 모달(등록/수정)
        setOtherChoiceOpen(true);
        return;
      }
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }

    // 목록이 없으면 신규 등록
    setOtherForm({
      id: null,
      use_name: "",
      total: "",
      receipt_image: null,
      receipt_type: "UNKNOWN",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
      type: t,
    });
    setOtherReceiptPreview(null);
    setOtherCreateOpen(true);
  };

  const openOtherCreateFromChoice = () => {
    setOtherChoiceOpen(false);
    setOtherForm({
      id: null,
      use_name: "",
      total: "",
      receipt_image: null,
      receipt_type: "UNKNOWN",
      sale_id: "",
      account_id: String(selectedAccountId || ""),
      type: String(otherContext.type || ""),
    });
    setOtherReceiptPreview(null);
    setOtherCreateOpen(true);
  };

  const openOtherListFromChoice = async () => {
    setOtherChoiceOpen(false);

    try {
      Swal.fire({
        title: "불러오는 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchOtherPurchaseList(
        selectedAccountId,
        otherContext.dateStr,
        otherContext.type
      );
      Swal.close();

      const safe = Array.isArray(list) ? list : [];
      setOtherRows(safe);

      const deep = safe.map((r) => ({ ...r }));
      setOtherEditRows(deep);
      setOtherOrigRowsForDiff(JSON.parse(JSON.stringify(deep)));
      setOtherRowFiles({});

      setOtherListOpen(true);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }
  };

  const selectOtherRowForInlineEdit = (rowObj, rowKey) => {
    setOtherSelectedRow(rowObj);
    setOtherSelectedKey(rowKey);

    setOtherForm({
      id: rowObj.id ?? null,
      use_name: rowObj.use_name || "",
      total: String(rowObj.total ?? ""),
      receipt_image: null,
      receipt_type: rowObj.receipt_type || "UNKNOWN",
      sale_id: String(rowObj.sale_id ?? ""),
      account_id: String(rowObj.account_id ?? selectedAccountId ?? ""),
      type: String(otherContext.type || rowObj.type || ""),
    });

    setOtherReceiptPreview(toPreviewUrl(rowObj.receipt_image));
  };

  useEffect(() => {
    if (!otherListOpen) return;
    if (otherSelectedRow) return;
    if (!Array.isArray(otherRows) || otherRows.length === 0) return;

    const first = otherRows[0];
    const rowKey = String(first.id ?? first.sale_id ?? 0);
    selectOtherRowForInlineEdit(first, rowKey);
  }, [otherListOpen, otherRows, otherSelectedRow]);

  // ✅ 직접 입력 허용 타입 (1~4)
  const INLINE_EDIT_TYPES = useMemo(() => new Set(["1", "2", "3", "4"]), []);

  // ✅ 1002/1003 은 클릭 무시
  const shouldBlockModalByType = useCallback((typeValue) => {
    const t = String(typeValue ?? "");
    return t === "1002" || t === "1003";
  }, []);

  const handleSpecialCellClick = useCallback(
    (rowOriginal, rIdx, colKey, isSecond) => {
      if (!rowOriginal || rowOriginal.name === "총합") return;
      if (colKey === "name" || colKey === "total") return;

      setActiveCell({ isSecond: !!isSecond, rowIndex: rIdx, colKey });

      const t = String(rowOriginal.type ?? "");
      if (!t) return;

      if (shouldBlockModalByType(t)) return;

      // ✅ type 1~4 는 직접 입력 대상이므로 모달/기타 클릭로직 타지 않게 종료
      if (INLINE_EDIT_TYPES.has(t)) return;

      if (t === "1000") {
        handleCorpCardCellClick(rowOriginal, rIdx, colKey, isSecond);
        return;
      }

      if (t === "1008") {
        handleCashCellClick(rowOriginal, rIdx, colKey, isSecond);
        return;
      }

      handleOtherCellClick(rowOriginal, rIdx, colKey, isSecond);
    },
    [
      INLINE_EDIT_TYPES,
      shouldBlockModalByType,
      handleCorpCardCellClick,
      handleCashCellClick,
      handleOtherCellClick,
    ]
  );

  // ======================== 컬럼 구성 ========================
  const buildColumns = useCallback((daysCount) => {
    const dayColumns = Array.from({ length: daysCount }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      size: 100,
    }));

    return [
      { header: "구분", accessorKey: "name", size: 100 },
      ...dayColumns,
      { header: "합계", accessorKey: "total", size: 100 },
    ];
  }, []);

  const columnsNow = useMemo(() => buildColumns(daysInMonthNow), [buildColumns, daysInMonthNow]);
  const columnsPrev = useMemo(() => buildColumns(daysInMonthPrev), [buildColumns, daysInMonthPrev]);

  const makeTableData = (rows, daysCount) => {
    if (!rows || rows.length === 0) return [];

    const calculatedRows = rows.map((r) => {
      const total = Array.from({ length: daysCount }, (_, i) =>
        parseNumber(r[`day_${i + 1}`])
      ).reduce((sum, val) => sum + val, 0);

      return { ...r, total };
    });

    const totals = {};
    for (let i = 1; i <= daysCount; i++) {
      totals[`day_${i}`] = calculatedRows.reduce((sum, r) => sum + parseNumber(r[`day_${i}`]), 0);
    }

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    return [...calculatedRows, { name: "총합", ...totals, total: grandTotal }];
  };

  const tableData = useMemo(
    () => makeTableData(dataRows, daysInMonthNow),
    [dataRows, daysInMonthNow]
  );
  const table2Data = useMemo(
    () => makeTableData(data2Rows, daysInMonthPrev),
    [data2Rows, daysInMonthPrev]
  );

  const table = useReactTable({
    data: tableData,
    columns: columnsNow,
    getCoreRowModel: getCoreRowModel(),
  });
  const table2 = useReactTable({
    data: table2Data,
    columns: columnsPrev,
    getCoreRowModel: getCoreRowModel(),
  });

  const usedTotalNow = useMemo(() => {
    const last = (tableData || []).find((r) => r?.name === "총합");
    return parseNumber(last?.total);
  }, [tableData]);

  const usedTotalPrev = useMemo(() => {
    const last = (table2Data || []).find((r) => r?.name === "총합");
    return parseNumber(last?.total);
  }, [table2Data]);

  const budgetForTab = tabValue === 1 ? budget2Grant : budgetGrant;
  const usedForTab = tabValue === 1 ? usedTotalPrev : usedTotalNow;

  // ✅ 직접 입력은 type=1~4 허용
  const handleCellChange = (rowIndex, colKey, value, isSecond = false) => {
    const rows = isSecond ? data2Rows : dataRows;
    const row = rows?.[rowIndex];
    if (!row || row.name === "총합" || colKey === "name" || colKey === "total") return;

    if (!INLINE_EDIT_TYPES.has(String(row.type ?? ""))) return;

    const setter = isSecond ? setData2Rows : setDataRows;
    const newValue = parseNumber(value);
    setter?.(rows.map((r, i) => (i === rowIndex ? { ...r, [colKey]: newValue } : r)));
  };

  const handleImageUpload = async (e, dayIndex) => {
    if (dayIndex >= daysInMonthNow) {
      return Swal.fire("경고", "해당 월의 날짜 범위를 초과했습니다.", "info");
    }
    const typeForDay = receiptType[dayIndex];
    if (!typeForDay) return Swal.fire("경고", "영수증 유형을 선택하세요.", "info");

    const file = e.target.files?.[0];
    if (!file) return;

    setImages((prev) => {
      const newImages = [...prev];
      newImages[dayIndex] = file;
      return newImages;
    });

    const day = dayIndex + 1;
    const selectedDate = dayjs(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );

    const formData = new FormData();
    formData.append("user_id", localUserId);
    formData.append("file", file);
    formData.append("type", typeForDay);
    formData.append("account_id", selectedAccountId);
    formData.append("cell_day", String(day));
    formData.append("cell_date", selectedDate.format("YYYY-MM-DD"));

    try {
      Swal.fire({
        title: "영수증 확인 중 입니다.",
        text: "잠시만 기다려 주세요...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/receipt-scan", formData, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        await fetchDataRows?.(selectedAccountId, year, month);
        await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
        await fetchBudgetGrant?.(selectedAccountId, year, month);
        await fetchBudget2Grant?.(selectedAccountId, year, month);

        setOriginalRows([]);
        setOriginal2Rows([]);
      } else if (res.status === 400) {
        Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
      } else {
        Swal.fire(
          "오류",
          res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`,
          "error"
        );
      }
    } catch (err) {
      Swal.close();
      Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    const getChangedRows = (curr, orig) =>
      (curr || [])
        .map((row, idx) => {
          const changed = {};
          let hasChange = false;

          Object.keys(row || {}).forEach((k) => {
            if (["name", "total"].includes(k) || row.name === "총합") return;
            if (parseNumber(row[k]) !== parseNumber(orig?.[idx]?.[k])) {
              changed[k] = parseNumber(row[k]);
              hasChange = true;
            }
          });

          return hasChange ? { ...row, ...changed } : null;
        })
        .filter(Boolean);

    const changedNow = getChangedRows(dataRows, originalRows);
    const changedBefore = getChangedRows(data2Rows, original2Rows);

    if (!changedNow.length && !changedBefore.length) {
      return Swal.fire("정보", "변경된 내용이 없습니다.", "info");
    }

    try {
      const payload = { user_id: localUserId, nowList: changedNow, beforeList: changedBefore };
      const res = await api.post("/Operate/TallySheetSave", payload);

      if (res.data?.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        }).then(async (result) => {
          if (result.isConfirmed) {
            await fetchDataRows?.(selectedAccountId, year, month);
            await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
            await fetchBudgetGrant?.(selectedAccountId, year, month);
            await fetchBudget2Grant?.(selectedAccountId, year, month);
            setOriginalRows([]);
            setOriginal2Rows([]);
          }
        });
      } else {
        Swal.fire("실패", res.data?.message || "저장 실패", "error");
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  // ✅ 새로고침: 선택된 거래처 기준으로 데이터 재조회
  const handleRefresh = async () => {
    if (!selectedAccountId) return;
    try {
      await fetchDataRows?.(selectedAccountId, year, month);
      await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
      await fetchBudgetGrant?.(selectedAccountId, year, month);
      await fetchBudget2Grant?.(selectedAccountId, year, month);
      setOriginalRows([]);
      setOriginal2Rows([]);
      setImages(Array(daysInMonthNow).fill(null));
      setReceiptType(Array(daysInMonthNow).fill(""));
    } catch (e) {
      Swal.fire("실패", e.message || "새로고침 중 오류가 발생했습니다.", "error");
    }
  };

  const ratioDataNow = useMemo(() => {
    return Array.from(
      { length: daysInMonthNow },
      (_, i) => (((i + 1) / daysInMonthNow) * 100).toFixed(2) + "%"
    );
  }, [daysInMonthNow]);

  const ratioDataPrev = useMemo(() => {
    return Array.from(
      { length: daysInMonthPrev },
      (_, i) => (((i + 1) / daysInMonthPrev) * 100).toFixed(2) + "%"
    );
  }, [daysInMonthPrev]);

  // ======================== 거래처 연결/등록 ========================
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState([]);
  const [selectedRight, setSelectedRight] = useState([]);

  const handleModalOpen = async () => {
    setOpen(true);
    setSelectedLeft([]);
    setSelectedRight([]);
    try {
      const leftRes = await api.get("/Operate/AccountMappingList");
      setLeftItems(leftRes.data || []);

      if (selectedAccountId) {
        const rightRes = await api.get("/Operate/AccountMappingV2List", {
          params: { account_id: selectedAccountId },
        });
        setRightItems(rightRes.data || []);
      } else {
        setRightItems([]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      Swal.fire({ title: "오류", text: "거래처 목록을 불러오지 못했습니다.", icon: "error" });
    }
  };

  const moveRight = () => {
    const duplicates = selectedLeft.filter((item) =>
      (rightItems || []).some((r) => r.type === item.type && r.del_yn === "N")
    );
    if (duplicates.length > 0) {
      Swal.fire({ title: "중복", text: "이미 등록되어 있는 항목입니다.", icon: "warning" });
      return;
    }

    const updatedRightItems = [
      ...(rightItems || []),
      ...selectedLeft.map((item) => ({ ...item, account_id: selectedAccountId, del_yn: "N" })),
    ];
    setRightItems(updatedRightItems);
    setSelectedLeft([]);
  };

  const moveLeft = () => {
    const updatedRightItems = (rightItems || []).map((item) =>
      selectedRight.includes(item) ? { ...item, del_yn: "Y" } : item
    );
    setRightItems(updatedRightItems);
    setSelectedRight([]);
  };

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      return Swal.fire({ title: "계정 선택", text: "계정을 먼저 선택하세요.", icon: "warning" });
    }

    try {
      const payload = (rightItems || []).map((r) => ({ ...r, user_id: localUserId }));
      const response = await api.post("/Operate/AccountMappingSave", payload);

      if (response.data?.code === 200) {
        Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success" });
        setOpen(false);

        await fetchDataRows?.(selectedAccountId, year, month);
        await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
        setOriginalRows([]);
        setOriginal2Rows([]);
      } else {
        Swal.fire({ title: "오류", text: response.data?.message || "저장 실패", icon: "error" });
      }
    } catch (err) {
      Swal.fire({ title: "오류", text: err.message || "저장 실패", icon: "error" });
    }
  };

  // ======================= 거래처 등록 =======================
  const initialForm = {
    name: "",
    biz_no: "",
    ceo_name: "",
    tel: "",
    bank_name: "",
    bank_no: "",
    bank_image: null,
    biz_image: null,
    add_yn: "N",
    add_name: "",
  };

  const [formData, setFormData] = useState(initialForm);
  const [imagePreviews, setImagePreviews] = useState({ bank_image: null, biz_image: null });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleImagePreviewOpen = (src) => {
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const handleImagePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  const handleModalOpen2 = async () => setOpen2(true);
  const handleModalClose2 = async () => setOpen2(false);

  const handleChange2 = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const handleAddYnChange = (e) => {
    const checked = e.target.checked;
    setFormData((prev) => ({
      ...prev,
      add_yn: checked ? "Y" : "N",
      add_name: checked ? prev.add_name || "" : "",
    }));
  };

  const handleBankSelect = (e) => {
    const bankName = e.target.value;

    setFormData((prev) => {
      if (bankName === "기타(직접입력)") {
        return {
          ...prev,
          bank_name: prev.bank_name || "",
          bank_no: formatAccountNumber(prev.bank_name || "", prev.bank_no || ""),
        };
      }
      return {
        ...prev,
        bank_name: bankName,
        bank_no: formatAccountNumber(bankName, prev.bank_no || ""),
      };
    });
  };

  const handleBankNoChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, bank_no: formatAccountNumber(prev.bank_name || "", value) }));
  };

  const handleBizNoChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, biz_no: formatBizNo(value) }));
  };

  const handleTelChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, tel: formatPhone(value) }));
  };

  const handleImageUploadPreview = (e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreviews((prev) => ({ ...prev, [name]: previewUrl }));
    setFormData((prev) => ({ ...prev, [name]: file }));
  };

  const handleSubmit2 = async () => {
    const requiredFields = [
      "name",
      "biz_no",
      "ceo_name",
      "tel",
      "bank_name",
      "bank_no",
      "bank_image",
      "biz_image",
    ];

    const missing = requiredFields.filter((key) => !formData[key]);
    if (missing.length > 0) {
      return Swal.fire({
        title: "경고",
        text: "필수항목을 모두 입력하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }

    try {
      const imageFields = ["bank_image", "biz_image"];
      const uploadPromises = imageFields.map(async (field) => {
        const file = formData[field];
        if (!file || typeof file === "string") return file;

        const formDataToSend = new FormData();
        formDataToSend.append("user_id", localUserId);
        formDataToSend.append("file", file);
        formDataToSend.append("type", "account");
        formDataToSend.append("gubun", field);
        formDataToSend.append("folder", selectedAccountId);

        const res = await api.post("/Operate/OperateImgUpload", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data?.code === 200) return res.data.image_path;
        throw new Error(res.data?.message || "이미지 업로드 실패");
      });

      const [bankPath, bizPath] = await Promise.all(uploadPromises);

      const payload = {
        ...formData,
        bank_image: bankPath,
        biz_image: bizPath,
        del_yn: "N",
        user_id: localUserId,
      };

      const response = await api.post("/Operate/AccountRetailBusinessSave", payload);
      if (response.data?.code === 200) {
        Swal.fire({
          title: "성공",
          text: "거래처가 등록되었습니다.",
          icon: "success",
          confirmButtonColor: "#3085d6",
          confirmButtonText: "확인",
        });
        setOpen2(false);
        setFormData(initialForm);
        setImagePreviews({ bank_image: null, biz_image: null });
      } else {
        Swal.fire("실패", response.data?.message || "저장 중 오류 발생", "error");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      Swal.fire("에러", err.message || "저장 중 문제가 발생했습니다.", "error");
    }
  };

  const handleTypeChange = (e, index) => {
    const newTypes = [...receiptType];
    newTypes[index] = e.target.value;
    setReceiptType(newTypes);
  };

  const stopRowClick = (e) => {
    e.stopPropagation();
  };
  // ======================== ✅ List 모달 공통(변경감지/스타일) ========================
  const normalizeText = (v) =>
    String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const isDiff = (a, b) => {
    // 숫자처럼 생기면 숫자 비교
    const an = parseNumber(a);
    const bn = parseNumber(b);

    // 둘 다 숫자 비교가 의미있는 케이스(하나라도 숫자 입력이 있으면)
    const aHas = normalizeText(a) !== "";
    const bHas = normalizeText(b) !== "";

    // payType 같은 문자열 숫자도 여기로 들어오니,
    // 숫자 비교가 맞는 필드에서는 호출부에서 String 비교를 쓰는 게 안전함.
    // 여기서는 기본만 제공.
    if (aHas || bHas) {
      // 숫자 필드로 쓰는 곳이면 parseNumber 비교가 유리
      if (!Number.isNaN(an) || !Number.isNaN(bn)) {
        return an !== bn;
      }
    }

    // 기본: 문자열 정규화 비교
    return normalizeText(a) !== normalizeText(b);
  };

  const getCellStyleByCompare = (origVal, newVal) =>
    isDiff(origVal, newVal) ? { color: "red" } : { color: "black" };

  if (loading) return <LoadingScreen />;

  const renderTable = (
    tableInstance,
    originalData,
    handleChange,
    dataState,
    ratioData,
    isSecond = false
  ) => (
    <MDBox
      pt={0}
      sx={{
        overflowX: "auto",
        "& table": {
          borderCollapse: "separate",
          width: "max-content",
          minWidth: "50%",
          borderSpacing: 0,
        },
        "& th, & td": {
          border: "1px solid #686D76",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontSize: "12px",
          padding: "4px",
        },
        "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
        "& td:first-of-type, & th:first-of-type": {
          position: "sticky",
          left: 0,
          background: "#f0f0f0",
          zIndex: 3,
        },
        "& .total-row": { backgroundColor: "#FFE3A9", fontWeight: "bold" },
      }}
    >
      <table>
        <thead>
          <tr style={{ backgroundColor: "#FFE3A9" }}>
            <td>일 사용기준 %</td>
            {ratioData.map((val, idx) => (
              <td key={idx}>{val}</td>
            ))}
            <td />
          </tr>
          {tableInstance.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {tableInstance.getRowModel().rows.map((row, rIdx) => (
            <tr key={row.id} className={row.original.name === "총합" ? "total-row" : ""}>
              {row.getVisibleCells().map((cell) => {
                const colKey = cell.column.columnDef.accessorKey;

                const isTotalRow = row.original.name === "총합";
                const isBaseCell = colKey !== "name" && colKey !== "total" && !isTotalRow;

                const rowType = String(row.original.type ?? "");
                const canInlineEdit = INLINE_EDIT_TYPES.has(rowType);
                const isEditable = isBaseCell && canInlineEdit;

                const currVal = parseNumber(dataState?.[rIdx]?.[colKey]);
                const origVal = parseNumber(originalData?.[rIdx]?.[colKey]);
                const isChanged = isEditable && currVal !== origVal;

                // ✅ 클릭된 행/셀 하이라이트(요청 반영)
                const isActiveRow =
                  !isTotalRow &&
                  activeCell.rowIndex != null &&
                  activeCell.rowIndex === rIdx &&
                  activeCell.isSecond === !!isSecond;

                const isActiveThisCell = isActiveRow && activeCell.colKey === colKey;

                const baseBg =
                  !canInlineEdit && isBaseCell && !isTotalRow ? "rgba(25,118,210,0.03)" : "";

                const activeRowBg = isActiveRow ? "rgba(255, 244, 179, 0.55)" : "";
                const activeCellBg = isActiveThisCell ? "rgba(255, 213, 79, 0.60)" : "";

                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{
                      color: isChanged ? "#d32f2f" : "black",
                      width: "80px",
                      cursor: !isBaseCell
                        ? "default"
                        : canInlineEdit
                        ? "text"
                        : shouldBlockModalByType(rowType)
                        ? "not-allowed"
                        : "pointer",
                      background: activeCellBg || activeRowBg || baseBg || "",
                      outline: isActiveThisCell ? "2px solid rgba(255, 152, 0, 0.9)" : "none",
                      outlineOffset: isActiveThisCell ? "-2px" : "0px",
                    }}
                    onMouseDown={
                      isEditable
                        ? undefined
                        : (e) => {
                            e.preventDefault();
                            handleSpecialCellClick(row.original, rIdx, colKey, isSecond);
                          }
                    }
                    onClick={
                      isEditable
                        ? () => handleSpecialCellClick(row.original, rIdx, colKey, isSecond)
                        : undefined
                    }
                    onBlur={
                      isEditable
                        ? (e) => handleChange(rIdx, colKey, e.currentTarget.innerText, isSecond)
                        : undefined
                    }
                  >
                    {colKey === "name" ? row.original[colKey] : formatNumber(row.original[colKey])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </MDBox>
  );

  return (
    <>
      <FloatingImagePreview
        open={floatingPreview.open}
        src={floatingPreview.src}
        title={floatingPreview.title}
        onClose={closeFloatingPreview}
      />
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          flexWrap: isMobile ? "wrap" : "nowrap",
          justifyContent: isMobile ? "flex-start" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
        }}
      >
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={filteredAccountList || []}
          value={selectedAccountOption}
          onChange={(_, newValue) => {
            if (isAccountLocked) return;
            setSelectedAccountId(newValue ? newValue.account_id : "");
            setAccountInput(newValue?.account_name || "");
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => {
            if (isAccountLocked) return;
            setAccountInput(newValue);
          }}
          getOptionLabel={(opt) => (opt?.account_name ? String(opt.account_name) : "")}
          isOptionEqualToValue={(opt, val) => String(opt?.account_id) === String(val?.account_id)}
          disableClearable={isAccountLocked}
          disabled={isAccountLocked}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              inputProps={{
                ...params.inputProps,
                readOnly: isAccountLocked, // ✅ 잠금 시 커서/입력 완전 차단(표시만)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectAccountByInput();
                }
              }}
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

        <TextField
          select
          size="small"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>

        {/* <MDButton
          variant="gradient"
          color="info"
          onClick={handleModalOpen2}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 90 : 110,
            px: isMobile ? 1 : 2,
          }}
        >
          거래처 등록
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleModalOpen}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 90 : 110,
            px: isMobile ? 1 : 2,
          }}
        >
          거래처 연결
        </MDButton> */}

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleRefresh}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 70 : 90,
            px: isMobile ? 1 : 2,
          }}
        >
          새로고침
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 70 : 90,
            px: isMobile ? 1 : 2,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={3} pb={3}>
        <Card>
          <MDBox
            mx={0}
            mt={-3}
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <MDTypography variant="h6" color="white">
                집계표
              </MDTypography>

              <Box sx={{ width: "65%" }}>
                <BudgetSummaryBar budget={budgetForTab} used={usedForTab} />
              </Box>

              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                textColor="inherit"
                indicatorColor="secondary"
                variant={isMobile ? "scrollable" : "standard"}
                sx={{
                  position: "relative",
                  zIndex: 1,
                  minHeight: 36,
                  "& .MuiTab-root": {
                    minHeight: 36,
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 13,
                    fontWeight: 600,
                  },
                  "& .Mui-selected": { color: "#fff" },
                }}
              >
                <Tab label={countMonth ? `현재월 (${countMonth})` : "현재월"} />
                <Tab label={count2Month ? `전월 (${count2Month})` : "전월"} />
              </Tabs>
            </Box>
          </MDBox>

          <MDBox pt={1}>
            {tabValue === 0 &&
              renderTable(table, originalRows, handleCellChange, dataRows, ratioDataNow)}
            {tabValue === 1 &&
              renderTable(table2, original2Rows, handleCellChange, data2Rows, ratioDataPrev, true)}
          </MDBox>
        </Card>
      </MDBox>

      {/* ================= 거래처 연결 모달(open) ================= */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <MDBox
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            bgcolor: "background.paper",
            borderRadius: 2,
            p: 3,
          }}
        >
          <MDBox
            mx={0}
            mt={-2}
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
          >
            <MDTypography variant="h6" color="white">
              거래처 연결
            </MDTypography>
          </MDBox>

          <Grid container spacing={2}>
            <Grid item xs={5}>
              <YourSelectableTable
                data={leftItems}
                selected={selectedLeft}
                setSelected={setSelectedLeft}
              />
            </Grid>
            <Grid
              item
              xs={2}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <MDButton variant="gradient" color="info" onClick={moveRight}>
                {">"}
              </MDButton>
              <MDButton variant="gradient" color="primary" onClick={moveLeft}>
                {"<"}
              </MDButton>
            </Grid>
            <Grid item xs={5}>
              <YourSelectableTable
                data={rightItems}
                selected={selectedRight}
                setSelected={setSelectedRight}
              />
            </Grid>
          </Grid>

          <MDBox mt={2} display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="gradient" color="primary" onClick={() => setOpen(false)}>
              취소
            </MDButton>
            <MDButton variant="gradient" color="info" onClick={handleSubmit}>
              저장
            </MDButton>
          </MDBox>
        </MDBox>
      </Modal>

      {/* ================= 거래처 등록 모달(open2) ================= */}
      <Modal open={open2} onClose={handleModalClose2}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 500,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 5,
          }}
        >
          <Typography variant="h6" gutterBottom>
            거래처 등록
          </Typography>

          <TextField
            fullWidth
            required
            margin="normal"
            label="거래처명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="name"
            value={formData.name || ""}
            onChange={handleChange2}
            sx={{ mt: 1 }}
          />

          <Grid container spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Grid item xs={4} sm={3}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={(formData.add_yn || "N") === "Y"}
                  onChange={handleAddYnChange}
                  sx={{ p: 0.5 }}
                />
                <Typography sx={{ fontSize: "0.8rem", lineHeight: 1, whiteSpace: "nowrap" }}>
                  약식사용
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={8} sm={9}>
              <TextField
                fullWidth
                margin="none"
                label="약식명"
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                name="add_name"
                value={formData.add_name || ""}
                onChange={handleChange2}
                disabled={(formData.add_yn || "N") !== "Y"}
                placeholder="약식사용 체크 시 입력"
                size="small"
              />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            required
            margin="normal"
            label="사업자번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="biz_no"
            value={formData.biz_no || ""}
            onChange={handleBizNoChange}
            placeholder="예: 123-45-67890"
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="대표자명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="ceo_name"
            value={formData.ceo_name || ""}
            onChange={handleChange2}
            sx={{ mt: 1 }}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="연락처"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="tel"
            value={formData.tel || ""}
            onChange={handleTelChange}
            placeholder="예: 010-1234-5678"
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
          />

          <Box mt={1}>
            <Typography sx={{ fontSize: "0.8rem", mb: 0.5 }}>은행명 (필수)</Typography>
            <Select
              fullWidth
              size="small"
              value={
                KOREAN_BANKS.includes(formData.bank_name)
                  ? formData.bank_name
                  : formData.bank_name
                  ? "기타(직접입력)"
                  : ""
              }
              onChange={handleBankSelect}
              displayEmpty
              sx={{ fontSize: "0.85rem" }}
            >
              <MenuItem value="">
                <em>은행 선택</em>
              </MenuItem>
              {KOREAN_BANKS.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>

            {(!KOREAN_BANKS.includes(formData.bank_name) ||
              formData.bank_name === "기타(직접입력)") && (
              <TextField
                fullWidth
                required
                margin="normal"
                label="은행명 직접입력"
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                name="bank_name"
                value={formData.bank_name === "기타(직접입력)" ? "" : formData.bank_name || ""}
                onChange={handleChange2}
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          <TextField
            fullWidth
            required
            margin="normal"
            label="계좌번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="bank_no"
            value={formData.bank_no || ""}
            onChange={handleBankNoChange}
            placeholder="숫자만 입력해도 자동으로 - 가 들어갑니다."
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
          />

          <Box mt={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>통장사본 (필수)</Typography>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  color: "#e8a500",
                  borderColor: "#e8a500",
                  fontSize: "12px",
                  height: "32px",
                  "&:hover": { borderColor: "#e8a500", backgroundColor: "rgba(232, 165, 0, 0.1)" },
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  name="bank_image"
                  onChange={handleImageUploadPreview}
                />
              </Button>

              {imagePreviews.bank_image && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <img
                    src={imagePreviews.bank_image}
                    alt="bank_image"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      cursor: "pointer",
                      transition: "transform 0.2s",
                    }}
                    onClick={() => handleImagePreviewOpen(imagePreviews.bank_image)}
                  />
                  <Typography variant="caption" sx={{ fontSize: "11px" }}>
                    {formData.bank_image?.name || "업로드 완료"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box mt={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>
              사업자등록증 (필수)
            </Typography>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  color: "#e8a500",
                  borderColor: "#e8a500",
                  fontSize: "12px",
                  height: "32px",
                  "&:hover": { borderColor: "#e8a500", backgroundColor: "rgba(232, 165, 0, 0.1)" },
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  name="biz_image"
                  onChange={handleImageUploadPreview}
                />
              </Button>

              {imagePreviews.biz_image && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <img
                    src={imagePreviews.biz_image}
                    alt="biz_image"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      cursor: "pointer",
                      transition: "transform 0.2s",
                    }}
                    onClick={() => handleImagePreviewOpen(imagePreviews.biz_image)}
                  />
                  <Typography variant="caption" sx={{ fontSize: "11px" }}>
                    {formData.biz_image?.name || "업로드 완료"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box mt={4} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={handleModalClose2}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" onClick={handleSubmit2} sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 🔍 이미지 확대 미리보기 모달(거래처 등록용) */}
      <Modal open={previewOpen} onClose={handleImagePreviewClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          {previewImage && (
            <img
              src={previewImage}
              alt="미리보기"
              style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }}
            />
          )}
        </Box>
      </Modal>

      {/* ======================== ✅ (1000) 법인카드 모달 3종 (Choice/Create/List) ======================== */}
      <Modal open={cardChoiceOpen} onClose={() => setCardChoiceOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 420,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            (법인카드) 결제 입력
          </Typography>
          <Typography sx={{ fontSize: 13, mb: 2 }}>
            이미 입력된 금액이 있습니다.
            <br />
            등록 / 수정을 선택하세요.
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {cardContext.dateStr}
          </Typography>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="contained" color="info" onClick={openCreateFromChoice}>
              등록
            </MDButton>
            <MDButton variant="contained" color="primary" onClick={openListFromChoice}>
              수정
            </MDButton>
            <MDButton variant="outlined" onClick={() => setCardChoiceOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (1000) 목록 모달: "선택" → "저장", 테이블에서 직접 수정 ======================== */}
      <Modal
        open={cardListOpen}
        onClose={() => {
          // blob revoke
          Object.values(cardRowFiles || {}).forEach((v) => {
            if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
              URL.revokeObjectURL(v.previewUrl);
          });
          setCardRowFiles({});
          setCardListOpen(false);
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 1200,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            fontSize: 12,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            법인카드 결제 목록 (전체 편집)
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#666", mb: 2 }}>
            날짜: {cardContext.dateStr}
          </Typography>

          <Box sx={{ maxHeight: 360, overflow: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 160 }}>사용처</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 110 }}>금액</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 220 }}>카드</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 160 }}>분류</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 260 }}>영수증</th>
                </tr>
              </thead>

              <tbody>
                {(cardEditRows || []).map((r, idx) => {
                  const rowKey = String(r.id ?? r.sale_id ?? idx);

                  const orig = cardOrigRowsForDiff?.[idx] || {};
                  const fileInfo = cardRowFiles?.[rowKey];
                  const previewSrc = fileInfo?.previewUrl || toPreviewUrl(r.receipt_image);

                  return (
                    <tr key={rowKey} style={{ background: "#ffffff" }}>
                      <td style={{ border: "1px solid #ddd", padding: 6 }}>
                        <TextField
                          size="small"
                          value={r.use_name || ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCardEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, use_name: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{ "& input": getCellStyleByCompare(orig.use_name, r.use_name) }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "right" }}>
                        <TextField
                          size="small"
                          value={r.total ?? ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCardEditRows((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, total: e.target.value } : x))
                            )
                          }
                          fullWidth
                          sx={{
                            "& input": getCellStyleByCompare(
                              parseNumber(orig.total),
                              parseNumber(r.total)
                            ),
                          }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={String(r.card_idx ?? r.corp_card_idx ?? r.idx ?? "")}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) => {
                            const v = String(e.target.value || "");
                            const picked = getCorpCardByIdx(v);
                            setCardEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      card_idx: v,
                                      card_brand: picked?.card_brand || x.card_brand || "",
                                      card_no: picked?.card_no || x.card_no || "",
                                    }
                                  : x
                              )
                            );
                          }}
                          fullWidth
                          displayEmpty
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              String(orig.card_idx ?? orig.corp_card_idx ?? orig.idx ?? ""),
                              String(r.card_idx ?? r.corp_card_idx ?? r.idx ?? "")
                            ),
                          }}
                        >
                          <MenuItem value="">
                            <em>카드 선택</em>
                          </MenuItem>
                          {(corpCardList || []).map((c) => (
                            <MenuItem key={String(c.idx)} value={String(c.idx)}>
                              {c.card_brand || "카드"} / {maskCardNo(c.card_no)} / idx=
                              {String(c.idx)}
                            </MenuItem>
                          ))}
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={r.receipt_type || "UNKNOWN"}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCardEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, receipt_type: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              orig.receipt_type,
                              r.receipt_type
                            ),
                          }}
                        >
                          <MenuItem value="UNKNOWN">
                            <em>알수없음</em>
                          </MenuItem>
                          <MenuItem value="CARD_SLIP_GENERIC">카드전표</MenuItem>
                          <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                          <MenuItem value="CONVENIENCE">편의점</MenuItem>
                          <MenuItem value="COUPANG_CARD">쿠팡</MenuItem>
                          <MenuItem value="COUPANG_APP">배달앱</MenuItem>
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <MDButton component="label" variant="contained" color="info" size="small">
                            파일
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setCardRowFiles((prev) => {
                                  // 기존 blob revoke
                                  const old = prev?.[rowKey];
                                  if (
                                    old?.previewUrl &&
                                    String(old.previewUrl).startsWith("blob:")
                                  ) {
                                    URL.revokeObjectURL(old.previewUrl);
                                  }
                                  return {
                                    ...prev,
                                    [rowKey]: { file, previewUrl: URL.createObjectURL(file) },
                                  };
                                });
                                e.target.value = "";
                              }}
                            />
                          </MDButton>

                          {previewSrc && (
                            <MDButton
                              variant="contained"
                              color="error"
                              size="small"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openFloatingPreview(previewSrc, "(법인카드) 영수증 미리보기");
                              }}
                            >
                              미리보기
                            </MDButton>
                          )}
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                // ✅ 변경된 행만 찾아서 일괄 저장
                const changed = (cardEditRows || [])
                  .map((r, idx) => {
                    const orig = cardOrigRowsForDiff?.[idx] || {};
                    const rowKey = String(r.id ?? r.sale_id ?? idx);

                    const pickedCardIdx = String(r.card_idx ?? r.corp_card_idx ?? r.idx ?? "");
                    const origCardIdx = String(
                      orig.card_idx ?? orig.corp_card_idx ?? orig.idx ?? ""
                    );

                    const fieldChanged =
                      normalizeText(r.use_name) !== normalizeText(orig.use_name) ||
                      parseNumber(r.total) !== parseNumber(orig.total) ||
                      String(r.receipt_type || "UNKNOWN") !==
                        String(orig.receipt_type || "UNKNOWN") ||
                      pickedCardIdx !== origCardIdx;

                    const hasFile = !!cardRowFiles?.[rowKey]?.file;

                    return fieldChanged || hasFile ? { r, idx, rowKey } : null;
                  })
                  .filter(Boolean);

                if (!changed.length) {
                  Swal.fire("정보", "변경된 내용이 없습니다.", "info");
                  return;
                }

                try {
                  Swal.fire({
                    title: "저장 중 입니다.",
                    text: `0 / ${changed.length}`,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => Swal.showLoading(),
                  });

                  for (let i = 0; i < changed.length; i++) {
                    const { r, rowKey, idx } = changed[i];
                    const orig = cardOrigRowsForDiff?.[idx] || {};

                    // ✅ 컨텍스트 날짜(클릭 셀 기준) 유지
                    const y = cardContext.isSecond ? prevYear : year;
                    const m = cardContext.isSecond ? prevMonth : month;
                    const fixedCellDate = buildCellDate(y, m, cardContext.dayIndex ?? 0);

                    const submitAccountId = String(
                      r.account_id ?? orig.account_id ?? selectedAccountId ?? ""
                    );
                    const cardIdx = String(
                      r.card_idx ??
                        r.corp_card_idx ??
                        r.idx ??
                        orig.card_idx ??
                        orig.corp_card_idx ??
                        orig.idx ??
                        ""
                    );
                    const picked = getCorpCardByIdx(cardIdx);
                    const cardBrand =
                      r.card_brand ||
                      r.cardBrand ||
                      orig.card_brand ||
                      orig.cardBrand ||
                      picked?.card_brand ||
                      "";
                    const cardNo =
                      r.card_no || r.cardNo || orig.card_no || orig.cardNo || picked?.card_no || "";
                    const paymentDt = r.payment_dt || orig.payment_dt || fixedCellDate;

                    const receiptImage = r.receipt_image || orig.receipt_image || "";
                    const bizNo = r.bizNo || orig.bizNo || "";
                    const note = r.note || orig.note || "";
                    const vat = parseNumber(r.vat === "" || r.vat == null ? orig.vat : r.vat);
                    const taxFree = parseNumber(
                      r.taxFree === "" || r.taxFree == null ? orig.taxFree : r.taxFree
                    );
                    const tax = parseNumber(r.tax === "" || r.tax == null ? orig.tax : r.tax);
                    const totalCard = parseNumber(
                      r.totalCard === "" || r.totalCard == null ? orig.totalCard : r.totalCard
                    );

                    const file = cardRowFiles?.[rowKey]?.file;

                    if (file) {
                      // ✅ 파일 변경 시: OCR 저장 endpoint 사용 (receipt_image 갱신)
                      const fd = new FormData();
                      fd.append("user_id", localUserId);
                      fd.append("account_id", submitAccountId);
                      fd.append("row_account_id", submitAccountId);
                      fd.append("cell_day", String((cardContext.dayIndex ?? 0) + 1));
                      fd.append("cell_date", fixedCellDate);
                      fd.append("type", 1000);
                      fd.append("saveType", "cor");

                      if (r.id != null) fd.append("id", r.id);
                      if (r.sale_id) fd.append("sale_id", String(r.sale_id));
                      if (cardIdx) fd.append("card_idx", cardIdx);

                      fd.append("card_brand", cardBrand);
                      fd.append("card_no", cardNo);
                      fd.append("use_name", r.use_name || "");
                      fd.append("receipt_type", r.receipt_type || "UNKNOWN");
                      fd.append("total", parseNumber(r.total));
                      fd.append("file", file);

                      const res = await api.post("/receipt-scanV3", fd, {
                        headers: {
                          "Content-Type": "multipart/form-data",
                          Accept: "application/json",
                        },
                        validateStatus: () => true,
                      });

                      if (res.status !== 200) {
                        throw new Error(res.data?.message || `저장 실패(code: ${res.status})`);
                      }
                    } else {
                      // ✅ 파일 변경 없음: 기존 receipt_image 유지 + JSON 저장
                      const main = {
                        sale_id: r.sale_id || orig.sale_id || "",
                        account_id: submitAccountId,
                        payment_dt: paymentDt,
                        type: 1000,
                        use_name: r.use_name || orig.use_name || "",
                        bizNo,
                        total: parseNumber(
                          r.total === "" || r.total == null ? orig.total : r.total
                        ),
                        vat,
                        taxFree,
                        tax,
                        totalCard,
                        cardNo,
                        cardBrand,
                        receipt_image: receiptImage,
                        note,
                        user_id: localUserId,
                        receipt_type: r.receipt_type || orig.receipt_type || "UNKNOWN",
                        idx: cardIdx || r.idx || orig.idx || "",
                      };

                      const res = await api.post(
                        "/Account/AccountCorporateCardPaymentAllSave",
                        { main: [main], item: [] },
                        {
                          headers: { "Content-Type": "application/json" },
                          validateStatus: () => true,
                        }
                      );

                      if (!(res.data?.code === 200 || res.status === 200)) {
                        throw new Error(res.data?.message || `저장 실패(code: ${res.status})`);
                      }
                    }

                    Swal.update?.({ text: `${i + 1} / ${changed.length}` });
                  }

                  Swal.close();
                  Swal.fire("완료", "저장되었습니다.", "success");

                  await fetchDataRows?.(selectedAccountId, year, month);
                  await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
                  await fetchBudgetGrant?.(selectedAccountId, year, month);
                  await fetchBudget2Grant?.(selectedAccountId, year, month);
                  setOriginalRows([]);
                  setOriginal2Rows([]);

                  // 파일 blob 정리
                  Object.values(cardRowFiles || {}).forEach((v) => {
                    if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                      URL.revokeObjectURL(v.previewUrl);
                  });
                  setCardRowFiles({});
                  setCardListOpen(false);
                } catch (e) {
                  Swal.close();
                  Swal.fire("오류", e.message || "저장 중 오류", "error");
                }
              }}
            >
              저장(변경분 일괄)
            </MDButton>

            <MDButton
              variant="contained"
              color="warning"
              onClick={() => {
                Object.values(cardRowFiles || {}).forEach((v) => {
                  if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                    URL.revokeObjectURL(v.previewUrl);
                });
                setCardRowFiles({});
                setCardListOpen(false);
              }}
            >
              닫기
            </MDButton>
          </Box>

          <Box mt={1} sx={{ fontSize: 11, color: "#777", textAlign: "center" }}>
            ※ 목록 전체를 직접 수정하고, 변경된 행만 저장됩니다.
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (1008) 현금/카드 목록 모달: 테이블에서 직접 수정 + 저장 ======================== */}
      <Modal
        open={cashListOpen}
        onClose={() => {
          Object.values(cashRowFiles || {}).forEach((v) => {
            if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
              URL.revokeObjectURL(v.previewUrl);
          });
          setCashRowFiles({});
          setCashListOpen(false);
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 980,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            fontSize: 12,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            결제 목록 (개인결제, 전체 편집)
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            날짜: {cashContext.dateStr}
          </Typography>

          <Box sx={{ maxHeight: 360, overflow: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>사용처</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 110 }}>금액</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 120 }}>결제수단</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 140 }}>현금영수증</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 160 }}>분류</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 220 }}>영수증</th>
                </tr>
              </thead>

              <tbody>
                {(cashEditRows || []).map((r, idx) => {
                  const rowKey = String(r.id ?? r.sale_id ?? idx);
                  const orig = cashOrigRowsForDiff?.[idx] || {};
                  const fileInfo = cashRowFiles?.[rowKey];
                  const previewSrc = fileInfo?.previewUrl || toPreviewUrl(r.receipt_image);

                  const payType = String(r.payType ?? "1");

                  return (
                    <tr key={rowKey}>
                      <td style={{ border: "1px solid #ddd", padding: 6 }}>
                        <TextField
                          size="small"
                          value={r.use_name || ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCashEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, use_name: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{ "& input": getCellStyleByCompare(orig.use_name, r.use_name) }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "right" }}>
                        <TextField
                          size="small"
                          value={r.total ?? ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCashEditRows((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, total: e.target.value } : x))
                            )
                          }
                          fullWidth
                          sx={{
                            "& input": getCellStyleByCompare(
                              parseNumber(orig.total),
                              parseNumber(r.total)
                            ),
                          }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={payType}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) => {
                            const v = String(e.target.value);
                            setCashEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      payType: v,
                                      // 카드로 바꾸면 cash_receipt_type 의미 없으니 기본값만 유지
                                      cash_receipt_type:
                                        v === "1" ? String(x.cash_receipt_type ?? "3") : "3",
                                    }
                                  : x
                              )
                            );
                          }}
                          fullWidth
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              String(orig.payType ?? "1"),
                              payType
                            ),
                          }}
                        >
                          <MenuItem value="1">현금</MenuItem>
                          <MenuItem value="2">카드</MenuItem>
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={String(r.cash_receipt_type ?? "3")}
                          disabled={payType !== "1"}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCashEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, cash_receipt_type: String(e.target.value) } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              String(orig.cash_receipt_type ?? "3"),
                              String(r.cash_receipt_type ?? "3")
                            ),
                          }}
                        >
                          <MenuItem value="1">개인소득공제</MenuItem>
                          <MenuItem value="2">사업자지출증빙</MenuItem>
                          <MenuItem value="3">미발급</MenuItem>
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={r.receipt_type || "UNKNOWN"}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setCashEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, receipt_type: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              orig.receipt_type,
                              r.receipt_type
                            ),
                          }}
                        >
                          <MenuItem value="UNKNOWN">
                            <em>알수없음</em>
                          </MenuItem>
                          <MenuItem value="TRANSACTION">거래명세표(서)</MenuItem>
                          <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                          <MenuItem value="CONVENIENCE">편의점</MenuItem>
                          {/* <MenuItem value="COUPANG_CARD">쿠팡</MenuItem> */}
                          <MenuItem value="COUPANG_APP">배달앱</MenuItem>
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <MDButton component="label" variant="contained" color="info" size="small">
                            파일
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setCashRowFiles((prev) => {
                                  const old = prev?.[rowKey];
                                  if (
                                    old?.previewUrl &&
                                    String(old.previewUrl).startsWith("blob:")
                                  ) {
                                    URL.revokeObjectURL(old.previewUrl);
                                  }
                                  return {
                                    ...prev,
                                    [rowKey]: { file, previewUrl: URL.createObjectURL(file) },
                                  };
                                });
                                e.target.value = "";
                              }}
                            />
                          </MDButton>

                          {previewSrc && (
                            <MDButton
                              variant="contained"
                              color="error"
                              size="small"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openFloatingPreview(previewSrc, "(1008) 영수증 미리보기");
                              }}
                            >
                              미리보기
                            </MDButton>
                          )}
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                const changed = (cashEditRows || [])
                  .map((r, idx) => {
                    const orig = cashOrigRowsForDiff?.[idx] || {};
                    const rowKey = String(r.id ?? r.sale_id ?? idx);

                    const fieldChanged =
                      normalizeText(r.use_name) !== normalizeText(orig.use_name) ||
                      parseNumber(r.total) !== parseNumber(orig.total) ||
                      String(r.payType ?? "1") !== String(orig.payType ?? "1") ||
                      String(r.cash_receipt_type ?? "3") !==
                        String(orig.cash_receipt_type ?? "3") ||
                      String(r.receipt_type ?? "UNKNOWN") !==
                        String(orig.receipt_type ?? "UNKNOWN");

                    const hasFile = !!cashRowFiles?.[rowKey]?.file;
                    return fieldChanged || hasFile ? { r, idx, rowKey } : null;
                  })
                  .filter(Boolean);

                if (!changed.length) {
                  Swal.fire("정보", "변경된 내용이 없습니다.", "info");
                  return;
                }

                try {
                  Swal.fire({
                    title: "저장 중 입니다.",
                    text: `0 / ${changed.length}`,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => Swal.showLoading(),
                  });

                  for (let i = 0; i < changed.length; i++) {
                    const { r, rowKey, idx } = changed[i];
                    const orig = cashOrigRowsForDiff?.[idx] || {};

                    const y = cashContext.isSecond ? prevYear : year;
                    const m = cashContext.isSecond ? prevMonth : month;
                    const fixedCellDate = buildCellDate(y, m, cashContext.dayIndex ?? 0);

                    const fd = new FormData();
                    fd.append("user_id", localUserId);

                    const submitAccountId = String(
                      r.account_id ?? orig.account_id ?? selectedAccountId ?? ""
                    );
                    fd.append("account_id", submitAccountId);
                    fd.append("row_account_id", submitAccountId);

                    fd.append("cell_day", String((cashContext.dayIndex ?? 0) + 1));
                    fd.append("saleDate", fixedCellDate);

                    fd.append("type", 1008);

                    fd.append("payType", String(r.payType ?? "1"));
                    fd.append("cash_receipt_type", String(r.cash_receipt_type ?? "3"));

                    fd.append("use_name", r.use_name || "");
                    fd.append("receipt_type", r.receipt_type || "UNKNOWN");
                    fd.append("total", parseNumber(r.total));

                    if (r.id != null) fd.append("id", r.id);
                    if (r.sale_id || orig.sale_id)
                      fd.append("sale_id", String(r.sale_id || orig.sale_id));

                    const file = cashRowFiles?.[rowKey]?.file;
                    if (file) fd.append("file", file);
                    const receiptImage = r.receipt_image || orig.receipt_image || "";
                    if (receiptImage) fd.append("receipt_image", receiptImage);

                    const res = await api.post("/Account/AccountTallyToPurchaseSave", fd, {
                      headers: {
                        "Content-Type": "multipart/form-data",
                        Accept: "application/json",
                      },
                      validateStatus: () => true,
                    });

                    if (res.status !== 200) {
                      throw new Error(res.data?.message || `저장 실패(code: ${res.status})`);
                    }

                    Swal.update?.({ text: `${i + 1} / ${changed.length}` });
                  }

                  Swal.close();
                  Swal.fire("완료", "저장되었습니다.", "success");

                  await fetchDataRows?.(selectedAccountId, year, month);
                  await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
                  await fetchBudgetGrant?.(selectedAccountId, year, month);
                  await fetchBudget2Grant?.(selectedAccountId, year, month);
                  setOriginalRows([]);
                  setOriginal2Rows([]);

                  Object.values(cashRowFiles || {}).forEach((v) => {
                    if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                      URL.revokeObjectURL(v.previewUrl);
                  });
                  setCashRowFiles({});
                  setCashListOpen(false);
                } catch (e) {
                  Swal.close();
                  Swal.fire("오류", e.message || "저장 중 오류", "error");
                }
              }}
            >
              저장(변경분 일괄)
            </MDButton>

            <MDButton
              variant="contained"
              color="warning"
              onClick={() => {
                Object.values(cashRowFiles || {}).forEach((v) => {
                  if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                    URL.revokeObjectURL(v.previewUrl);
                });
                setCashRowFiles({});
                setCashListOpen(false);
              }}
            >
              닫기
            </MDButton>
          </Box>

          <Box mt={1} sx={{ fontSize: 11, color: "#777", textAlign: "center" }}>
            ※ 목록 전체를 직접 수정하고, 변경된 행만 저장됩니다. (등록 endpoint 사용):{" "}
            {ENDPOINT_CASH_SAVE}
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (기타 type) 목록 모달: 테이블에서 직접 수정 + 저장 ======================== */}
      <Modal
        open={otherListOpen}
        onClose={() => {
          Object.values(otherRowFiles || {}).forEach((v) => {
            if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
              URL.revokeObjectURL(v.previewUrl);
          });
          setOtherRowFiles({});
          setOtherListOpen(false);
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 980,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            fontSize: 12,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            결제 목록 ({otherContext.rowName}, 전체 편집)
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            날짜: {otherContext.dateStr}
          </Typography>

          <Box sx={{ maxHeight: 360, overflow: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>사용처</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 110 }}>금액</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 160 }}>분류</th>
                  <th style={{ border: "1px solid #ddd", padding: 6, width: 220 }}>영수증</th>
                </tr>
              </thead>

              <tbody>
                {(otherEditRows || []).map((r, idx) => {
                  const rowKey = String(r.id ?? r.sale_id ?? idx);
                  const orig = otherOrigRowsForDiff?.[idx] || {};
                  const fileInfo = otherRowFiles?.[rowKey];
                  const previewSrc = fileInfo?.previewUrl || toPreviewUrl(r.receipt_image);

                  return (
                    <tr key={rowKey}>
                      <td style={{ border: "1px solid #ddd", padding: 6 }}>
                        <TextField
                          size="small"
                          value={r.use_name || ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setOtherEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, use_name: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{ "& input": getCellStyleByCompare(orig.use_name, r.use_name) }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "right" }}>
                        <TextField
                          size="small"
                          value={r.total ?? ""}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setOtherEditRows((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, total: e.target.value } : x))
                            )
                          }
                          fullWidth
                          sx={{
                            "& input": getCellStyleByCompare(
                              parseNumber(orig.total),
                              parseNumber(r.total)
                            ),
                          }}
                        />
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Select
                          size="small"
                          value={r.receipt_type || "UNKNOWN"}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onChange={(e) =>
                            setOtherEditRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, receipt_type: e.target.value } : x
                              )
                            )
                          }
                          fullWidth
                          sx={{
                            "& .MuiSelect-select": getCellStyleByCompare(
                              orig.receipt_type,
                              r.receipt_type
                            ),
                          }}
                        >
                          <MenuItem value="UNKNOWN">
                            <em>알수없음</em>
                          </MenuItem>
                          <MenuItem value="TRANSACTION">거래명세표(서)</MenuItem>
                          <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                          {/*  <MenuItem value="CONVENIENCE">편의점</MenuItem>
                          <MenuItem value="COUPANG_CARD">쿠팡</MenuItem>
                          <MenuItem value="COUPANG_APP">배달앱</MenuItem> */}
                        </Select>
                      </td>

                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Button component="label" size="small" variant="contained">
                            파일
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setOtherRowFiles((prev) => {
                                  const old = prev?.[rowKey];
                                  if (
                                    old?.previewUrl &&
                                    String(old.previewUrl).startsWith("blob:")
                                  ) {
                                    URL.revokeObjectURL(old.previewUrl);
                                  }
                                  return {
                                    ...prev,
                                    [rowKey]: { file, previewUrl: URL.createObjectURL(file) },
                                  };
                                });
                                e.target.value = "";
                              }}
                            />
                          </Button>

                          {previewSrc && (
                            <MDButton
                              variant="contained"
                              color="error"
                              size="small"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openFloatingPreview(previewSrc, "(기타) 영수증 미리보기");
                              }}
                            >
                              미리보기
                            </MDButton>
                          )}
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                const changed = (otherEditRows || [])
                  .map((r, idx) => {
                    const orig = otherOrigRowsForDiff?.[idx] || {};
                    const rowKey = String(r.id ?? r.sale_id ?? idx);

                    const fieldChanged =
                      normalizeText(r.use_name) !== normalizeText(orig.use_name) ||
                      parseNumber(r.total) !== parseNumber(orig.total) ||
                      String(r.receipt_type ?? "UNKNOWN") !==
                        String(orig.receipt_type ?? "UNKNOWN");

                    const hasFile = !!otherRowFiles?.[rowKey]?.file;

                    return fieldChanged || hasFile ? { r, idx, rowKey } : null;
                  })
                  .filter(Boolean);

                if (!changed.length) {
                  Swal.fire("정보", "변경된 내용이 없습니다.", "info");
                  return;
                }

                try {
                  Swal.fire({
                    title: "저장 중 입니다.",
                    text: `0 / ${changed.length}`,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => Swal.showLoading(),
                  });

                  for (let i = 0; i < changed.length; i++) {
                    const { r, rowKey, idx } = changed[i];
                    const orig = otherOrigRowsForDiff?.[idx] || {};

                    const y = otherContext.isSecond ? prevYear : year;
                    const m = otherContext.isSecond ? prevMonth : month;
                    const fixedCellDate = buildCellDate(y, m, otherContext.dayIndex ?? 0);

                    const fd = new FormData();
                    fd.append("user_id", localUserId);

                    const submitAccountId = String(
                      r.account_id ?? orig.account_id ?? selectedAccountId ?? ""
                    );
                    fd.append("account_id", submitAccountId);
                    fd.append("row_account_id", submitAccountId);

                    fd.append("cell_day", String((otherContext.dayIndex ?? 0) + 1));
                    fd.append("saleDate", fixedCellDate);

                    fd.append("type", String(otherContext.type || r.type || ""));
                    fd.append("use_name", r.use_name || "");
                    fd.append("receipt_type", r.receipt_type || "UNKNOWN");
                    fd.append("total", parseNumber(r.total));

                    if (r.id != null) fd.append("id", r.id);
                    if (r.sale_id || orig.sale_id)
                      fd.append("sale_id", String(r.sale_id || orig.sale_id));

                    const file = otherRowFiles?.[rowKey]?.file;
                    if (file) fd.append("file", file);
                    const receiptImage = r.receipt_image || orig.receipt_image || "";
                    if (receiptImage) fd.append("receipt_image", receiptImage);

                    const res = await api.post("/Account/AccountTallyToPurchaseSave", fd, {
                      headers: {
                        "Content-Type": "multipart/form-data",
                        Accept: "application/json",
                      },
                      validateStatus: () => true,
                    });

                    if (res.status !== 200) {
                      throw new Error(res.data?.message || `저장 실패(code: ${res.status})`);
                    }

                    Swal.update?.({ text: `${i + 1} / ${changed.length}` });
                  }

                  Swal.close();
                  Swal.fire("완료", "저장되었습니다.", "success");

                  await fetchDataRows?.(selectedAccountId, year, month);
                  await fetchData2Rows?.(selectedAccountId, prevYear, prevMonth);
                  await fetchBudgetGrant?.(selectedAccountId, year, month);
                  await fetchBudget2Grant?.(selectedAccountId, year, month);
                  setOriginalRows([]);
                  setOriginal2Rows([]);

                  Object.values(otherRowFiles || {}).forEach((v) => {
                    if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                      URL.revokeObjectURL(v.previewUrl);
                  });
                  setOtherRowFiles({});
                  setOtherListOpen(false);
                } catch (e) {
                  Swal.close();
                  Swal.fire("오류", e.message || "저장 중 오류", "error");
                }
              }}
            >
              저장(변경분 일괄)
            </MDButton>

            <MDButton
              variant="contained"
              color="warning"
              onClick={() => {
                Object.values(otherRowFiles || {}).forEach((v) => {
                  if (v?.previewUrl && String(v.previewUrl).startsWith("blob:"))
                    URL.revokeObjectURL(v.previewUrl);
                });
                setOtherRowFiles({});
                setOtherListOpen(false);
              }}
            >
              닫기
            </MDButton>
          </Box>

          <Box mt={1} sx={{ fontSize: 11, color: "#777", textAlign: "center" }}>
            ※ 목록 전체를 직접 수정하고, 변경된 행만 저장됩니다. (등록 endpoint 사용):{" "}
            {ENDPOINT_OTHER_SAVE}
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (1000) 법인카드 등록 모달 ======================== */}
      <Modal open={cardCreateOpen} onClose={() => setCardCreateOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            (법인카드) 결제 등록 (type=1000)
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {cardContext.dateStr}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField
                label="사용처"
                size="small"
                value={cardForm.use_name || ""}
                onChange={(e) => setCardForm((p) => ({ ...p, use_name: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="금액"
                size="small"
                value={cardForm.total || ""}
                onChange={(e) => setCardForm((p) => ({ ...p, total: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={cardForm.card_idx || ""}
                onChange={(e) => {
                  const v = String(e.target.value || "");
                  const picked = getCorpCardByIdx(v);
                  setCardForm((p) => ({
                    ...p,
                    card_idx: v,
                    card_brand: picked?.card_brand || p.card_brand || "",
                    card_no: picked?.card_no || p.card_no || "",
                  }));
                }}
                fullWidth
                displayEmpty
              >
                <MenuItem value="">
                  <em>카드 선택</em>
                </MenuItem>
                {(corpCardList || []).map((c) => (
                  <MenuItem key={String(c.idx)} value={String(c.idx)}>
                    {c.card_brand || "카드"} / {maskCardNo(c.card_no)} / idx={String(c.idx)}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={cardForm.receipt_type || "UNKNOWN"}
                onChange={(e) => setCardForm((p) => ({ ...p, receipt_type: e.target.value }))}
                fullWidth
              >
                <MenuItem value="UNKNOWN">
                  <em>알수없음</em>
                </MenuItem>
                <MenuItem value="CARD_SLIP_GENERIC">카드전표</MenuItem>
                <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                <MenuItem value="CONVENIENCE">편의점</MenuItem>
                {/*<MenuItem value="COUPANG_CARD">쿠팡</MenuItem> */}
                <MenuItem value="COUPANG_APP">배달앱</MenuItem>
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <MDButton component="label" variant="contained" color="info" size="small">
                  영수증 파일 선택
                  <input
                    ref={cardFileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleCardReceiptFileChange}
                  />
                </MDButton>

                {(cardReceiptPreview || cardForm.receipt_image) && (
                  <MDButton
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() =>
                      openFloatingPreview(cardReceiptPreview, "(법인카드) 영수증 미리보기")
                    }
                  >
                    미리보기
                  </MDButton>
                )}
              </Box>
            </Grid>
          </Grid>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                const ok = await saveCorpCardPayment("create");
                if (ok) setCardCreateOpen(false);
              }}
            >
              등록
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setCardCreateOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (1008) 선택 모달 (0원 아니면 뜨는 모달) ======================== */}
      <Modal open={cashChoiceOpen} onClose={() => setCashChoiceOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 420,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            개인 결제 입력
          </Typography>
          <Typography sx={{ fontSize: 13, mb: 2 }}>
            이미 입력된 금액이 있습니다.
            <br />
            등록 / 수정을 선택하세요.
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {cashContext.dateStr}
          </Typography>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="contained" color="info" onClick={openCashCreateFromChoice}>
              등록
            </MDButton>
            <MDButton variant="contained" color="primary" onClick={openCashListFromChoice}>
              수정
            </MDButton>
            <MDButton variant="outlined" onClick={() => setCashChoiceOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (1008) 등록 모달 ======================== */}
      <Modal open={cashCreateOpen} onClose={() => setCashCreateOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            개인 결제 등록 (type=1008)
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {cashContext.dateStr}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField
                label="사용처"
                size="small"
                value={cashForm.use_name || ""}
                onChange={(e) => setCashForm((p) => ({ ...p, use_name: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="금액"
                size="small"
                value={cashForm.total || ""}
                onChange={(e) => setCashForm((p) => ({ ...p, total: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={cashForm.payType || "1"}
                onChange={(e) =>
                  setCashForm((p) => ({
                    ...p,
                    payType: String(e.target.value),
                    cash_receipt_type:
                      String(e.target.value) === "1" ? String(p.cash_receipt_type ?? "3") : "3",
                  }))
                }
                fullWidth
              >
                <MenuItem value="1">현금</MenuItem>
                <MenuItem value="2">카드</MenuItem>
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={cashForm.cash_receipt_type || "3"}
                disabled={String(cashForm.payType) !== "1"}
                onChange={(e) =>
                  setCashForm((p) => ({
                    ...p,
                    cash_receipt_type: String(e.target.value),
                  }))
                }
                fullWidth
              >
                <MenuItem value="1">개인소득공제</MenuItem>
                <MenuItem value="2">사업자지출증빙</MenuItem>
                <MenuItem value="3">미발급</MenuItem>
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={cashForm.receipt_type || "UNKNOWN"}
                onChange={(e) => setCashForm((p) => ({ ...p, receipt_type: e.target.value }))}
                fullWidth
              >
                <MenuItem value="UNKNOWN">
                  <em>알수없음</em>
                </MenuItem>
                <MenuItem value="TRANSACTION">거래명세표(서)</MenuItem>
                <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                <MenuItem value="CONVENIENCE">편의점</MenuItem>
                {/*<MenuItem value="COUPANG_CARD">쿠팡</MenuItem>*/}
                <MenuItem value="COUPANG_APP">배달앱</MenuItem>
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <MDButton component="label" variant="contained" color="info" size="small">
                  영수증 파일 선택
                  <input
                    ref={cashFileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleCashReceiptFileChange}
                  />
                </MDButton>

                {cashReceiptPreview && (
                  <MDButton
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() =>
                      openFloatingPreview(cashReceiptPreview, "(1008) 영수증 미리보기")
                    }
                  >
                    미리보기
                  </MDButton>
                )}
              </Box>
            </Grid>
          </Grid>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                const ok = await saveCashPayment("create");
                if (ok) setCashCreateOpen(false);
              }}
            >
              등록
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setCashCreateOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (기타 type) 선택 모달 ======================== */}
      <Modal open={otherChoiceOpen} onClose={() => setOtherChoiceOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 420,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            (기타) 결제 입력 (type={otherContext.type})
          </Typography>
          <Typography sx={{ fontSize: 13, mb: 2 }}>
            이미 입력된 금액이 있습니다.
            <br />
            등록 / 수정을 선택하세요.
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {otherContext.dateStr}
          </Typography>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="contained" color="info" onClick={openOtherCreateFromChoice}>
              등록
            </MDButton>
            <MDButton variant="contained" color="primary" onClick={openOtherListFromChoice}>
              수정
            </MDButton>
            <MDButton variant="outlined" onClick={() => setOtherChoiceOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* ======================== ✅ (기타 type) 등록 모달 ======================== */}
      <Modal open={otherCreateOpen} onClose={() => setOtherCreateOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            (기타) 결제 등록 (type={otherForm.type || otherContext.type})
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>
            거래처명: {selectedAccountOption?.account_name || "-"} / 날짜: {otherContext.dateStr}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField
                label="사용처"
                size="small"
                value={otherForm.use_name || ""}
                onChange={(e) => setOtherForm((p) => ({ ...p, use_name: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="금액"
                size="small"
                value={otherForm.total || ""}
                onChange={(e) => setOtherForm((p) => ({ ...p, total: e.target.value }))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Select
                size="small"
                value={otherForm.receipt_type || "UNKNOWN"}
                onChange={(e) => setOtherForm((p) => ({ ...p, receipt_type: e.target.value }))}
                fullWidth
              >
                <MenuItem value="UNKNOWN">
                  <em>알수없음</em>
                </MenuItem>
                <MenuItem value="TRANSACTION">거래명세표(서)</MenuItem>
                <MenuItem value="MART_ITEMIZED">마트</MenuItem>
                {/*<MenuItem value="CONVENIENCE">편의점</MenuItem>
                <MenuItem value="COUPANG_CARD">쿠팡</MenuItem>
                <MenuItem value="COUPANG_APP">배달앱</MenuItem>*/}
              </Select>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <MDButton component="label" variant="contained" color="info" size="small">
                  영수증 파일 선택
                  <input
                    ref={otherFileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleOtherReceiptFileChange}
                  />
                </MDButton>

                {otherReceiptPreview && (
                  <MDButton
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() =>
                      openFloatingPreview(otherReceiptPreview, "(기타) 영수증 미리보기")
                    }
                  >
                    미리보기
                  </MDButton>
                )}
              </Box>
            </Grid>
          </Grid>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                const ok = await saveOtherPayment("create");
                if (ok) setOtherCreateOpen(false);
              }}
            >
              등록
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setOtherCreateOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default TallySheetTab;
