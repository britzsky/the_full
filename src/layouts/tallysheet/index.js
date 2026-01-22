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
import LoadingScreen from "../loading/loadingscreen";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import useTallysheetData, { parseNumber, formatNumber } from "./data/TallySheetData";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";
import Draggable from "react-draggable";
import { API_BASE_URL } from "config";

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
          <Button size="small" variant="outlined" onClick={onClose}>
            닫기
          </Button>
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

  // ✅ monthText를 안 주면 현재 월로 표시 (기존 동작 유지)
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
      {/* 타이틀 바 */}
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

      {/* 3칸 그리드 */}
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
  monthText: PropTypes.string, // (선택) "01월" 같은 표시를 외부에서 넣고 싶을 때
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
function TallySheet() {
  // ✅ localStorage account_id 우선 적용(있으면 고정)
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const isAccountLocked = useMemo(() => !!localAccountId, [localAccountId]);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");

  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const [images, setImages] = useState(Array(31).fill(null));
  const [receiptType, setReceiptType] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ 탭 상태 (0: 현재월, 1: 전월)
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

    // ✅ (전월) 날짜
    prevYear: hookPrevYear,
    prevMonth: hookPrevMonth,

    // ✅ (예산) - 훅이 지원하면 사용, 아니면 0 처리
    budgetGrant = 0,
    budget2Grant = 0,
    fetchBudgetGrant = async () => {},
    fetchBudget2Grant = async () => {},
  } = hook || {};

  // ✅ 전월 year/month를 "현재 선택된 year/month 기준"으로 안전 계산 (훅이 주는 값이 있어도 덮어쓰지 않음)
  const prevYm = useMemo(() => {
    const base = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    return base.subtract(1, "month");
  }, [year, month]);
  const prevYear = useMemo(() => hookPrevYear ?? prevYm.year(), [hookPrevYear, prevYm]);
  const prevMonth = useMemo(() => hookPrevMonth ?? prevYm.month() + 1, [hookPrevMonth, prevYm]);

  // ✅ localStorage account_id가 있으면 selectedAccountId 강제 고정
  useEffect(() => {
    if (!localAccountId) return;
    if (String(selectedAccountId) !== String(localAccountId)) setSelectedAccountId(localAccountId);
  }, [localAccountId, selectedAccountId]);

  // ✅ localStorage account_id에 해당하는 거래처만 보이도록 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  // ✅ 거래처 Autocomplete value 객체
  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (filteredAccountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) ||
      null
    );
  }, [filteredAccountList, selectedAccountId]);

  // ✅ 원본 데이터 관리 로직 개선 (+ account/year/month 바뀌면 상태 초기화)
  useEffect(() => {
    setDataRows?.([]);
    setData2Rows?.([]);
    setOriginalRows([]);
    setOriginal2Rows([]);
    setImages(Array(31).fill(null));
  }, [selectedAccountId, year, month, setDataRows, setData2Rows]);

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

  // ✅ 거래처 자동 선택: localStorage 있으면 고정, 없으면 첫번째
  useEffect(() => {
    if (localAccountId) {
      setSelectedAccountId(localAccountId);
      return;
    }
    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
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

  // ======================== ✅ 법인카드 모달 플로우 ========================
  const [cardChoiceOpen, setCardChoiceOpen] = useState(false);
  const [cardCreateOpen, setCardCreateOpen] = useState(false);
  const [cardListOpen, setCardListOpen] = useState(false);
  const [cardEditOpen, setCardEditOpen] = useState(false);
  const cardFileRef = useRef(null);

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

  // ✅ 상대경로면 API_BASE_URL 붙여서 미리보기 깨짐 방지
  const toPreviewUrl = useCallback((path) => {
    if (!path) return null;
    const s = String(path);
    if (s.startsWith("blob:")) return s;
    if (s.startsWith("http")) return s;
    return `${API_BASE_URL}${s}`;
  }, []);

  const getCorpCardByIdx = useCallback(
    (idx) => {
      const key = String(idx ?? "");
      if (!key) return null;
      return (corpCardList || []).find((c) => String(c.idx) === key) || null;
    },
    [corpCardList]
  );

  const maskCardNo = (no) => {
    const s = String(no ?? "").replace(/\s+/g, "");
    if (!s) return "";
    const last4 = s.slice(-4);
    return `****-****-****-${last4}`;
  };

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

  const [cardReceiptPreview, setCardReceiptPreview] = useState(null);

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

  useEffect(() => {
    if (!selectedAccountId) return;
    if (cardCreateOpen || cardEditOpen) {
      fetchAccountCorporateCardList(selectedAccountId).catch((e) => {
        Swal.fire("오류", e.message || "법인카드 목록 조회 중 오류", "error");
      });
    }
  }, [selectedAccountId, cardCreateOpen, cardEditOpen, fetchAccountCorporateCardList]);

  useEffect(() => {
    if (!(cardCreateOpen || cardEditOpen)) return;
    if (!corpCardList?.length) return;

    setCardForm((p) => {
      if (p.card_idx) return p;
      const first = corpCardList[0];
      return {
        ...p,
        card_idx: String(first.idx),
        card_brand: first.card_brand || "",
        card_no: first.card_no || "",
      };
    });
  }, [corpCardList, cardCreateOpen, cardEditOpen]);

  const buildDateStr = (y, m, dayIdx) => {
    const mm = String(m).padStart(2, "0");
    const dd = String(dayIdx + 1).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

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

    const submitAccountId =
      mode === "edit"
        ? String(cardForm.account_id || selectedAccountId)
        : String(selectedAccountId);

    fd.append("account_id", submitAccountId);
    fd.append("cell_date", cardContext.dateStr);

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

      const res = await api.post("/receipt-scanV3", fd, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        // ✅ 성공 후: 빨간색(변경표시) 확실 제거 + 예산 재조회(지원 시)
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
        Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
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
      Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
      return false;
    }
  };

  const handleCorpCardCellClick = (rowOriginal, rIdx, colKey, isSecond = false) => {
    if (!rowOriginal || rowOriginal.name === "총합") return;
    if (colKey === "name" || colKey === "total") return;
    if (String(rowOriginal.type) !== "1000") return;

    const rows = isSecond ? data2Rows : dataRows;
    const cellVal = parseNumber(rows?.[rIdx]?.[colKey]);

    const dayIndex = Number(String(colKey).replace("day_", "")) - 1;
    if (Number.isNaN(dayIndex) || dayIndex < 0) return;

    // ✅ 전월 탭이면 prevYear/prevMonth 사용
    const y = isSecond ? prevYear : year;
    const m = isSecond ? prevMonth : month;
    const dateStr = buildDateStr(y, m, dayIndex);

    setCardContext({
      isSecond,
      rowIndex: rIdx,
      colKey,
      dayIndex,
      dateStr,
      cellValue: cellVal,
    });

    if (!cellVal || cellVal === 0) {
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
      return;
    }

    setCardChoiceOpen(true);
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
    setCardSelectedRow(null);
    setCardSelectedKey(null);

    try {
      Swal.fire({
        title: "불러오는 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCorpCardList(selectedAccountId, cardContext.dateStr);
      Swal.close();

      setCardRows(list);
      setCardListOpen(true);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }
  };

  const openEditFromList = () => {
    if (!cardSelectedRow) {
      Swal.fire("안내", "수정할 항목을 선택하세요.", "info");
      return;
    }

    setCardForm((p) => ({
      ...p,
      id: cardSelectedRow.id,
      use_name: cardSelectedRow.use_name || "",
      total: String(cardSelectedRow.total ?? ""),
      receipt_image: null,
      card_idx: String(
        cardSelectedRow.card_idx ?? cardSelectedRow.corp_card_idx ?? cardSelectedRow.idx ?? ""
      ),
      receipt_type: cardSelectedRow.receipt_type || p.receipt_type || "UNKNOWN",
      card_brand: cardSelectedRow.card_brand || p.card_brand || "",
      card_no: cardSelectedRow.card_no || p.card_no || "",
      sale_id: String(cardSelectedRow.sale_id ?? ""),
      account_id: String(cardSelectedRow.account_id ?? selectedAccountId ?? ""),
    }));

    setCardReceiptPreview(toPreviewUrl(cardSelectedRow.receipt_image));
    setCardListOpen(false);
    setCardEditOpen(true);
  };

  // ======================== 컬럼 구성 ========================
  const columns = useMemo(() => {
    const dayColumns = Array.from({ length: 31 }, (_, i) => ({
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

  const makeTableData = (rows) => {
    if (!rows || rows.length === 0) return [];

    const calculatedRows = rows.map((r) => {
      const total = Array.from({ length: 31 }, (_, i) => parseNumber(r[`day_${i + 1}`])).reduce(
        (sum, val) => sum + val,
        0
      );
      return { ...r, total };
    });

    const totals = {};
    for (let i = 1; i <= 31; i++) {
      totals[`day_${i}`] = calculatedRows.reduce((sum, r) => sum + parseNumber(r[`day_${i}`]), 0);
    }
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    return [...calculatedRows, { name: "총합", ...totals, total: grandTotal }];
  };

  const tableData = useMemo(() => makeTableData(dataRows), [dataRows]);
  const table2Data = useMemo(() => makeTableData(data2Rows), [data2Rows]);

  const table = useReactTable({ data: tableData, columns, getCoreRowModel: getCoreRowModel() });
  const table2 = useReactTable({ data: table2Data, columns, getCoreRowModel: getCoreRowModel() });

  // ✅ (핵심) 탭 기준 사용금액(총합)
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

  const handleCellChange = (rowIndex, colKey, value, isSecond = false) => {
    const setter = isSecond ? setData2Rows : setDataRows;
    const rows = isSecond ? data2Rows : dataRows;
    const row = rows?.[rowIndex];
    if (!row || row.name === "총합" || colKey === "name" || colKey === "total") return;
    const newValue = parseNumber(value);
    setter?.(rows.map((r, i) => (i === rowIndex ? { ...r, [colKey]: newValue } : r)));
  };

  const handleImageUpload = async (e, dayIndex) => {
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
      const payload = { nowList: changedNow, beforeList: changedBefore };
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

  const ratioData = useMemo(
    () => Array.from({ length: 31 }, (_, i) => (((i + 1) / 31) * 100).toFixed(2) + "%"),
    []
  );

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
      const payload = rightItems || [];
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

      const payload = { ...formData, bank_image: bankPath, biz_image: bizPath, del_yn: "N" };

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

  if (loading) return <LoadingScreen />;

  const renderTable = (tableInstance, originalData, handleChange, dataState, isSecond = false) => (
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
                const isEditable =
                  colKey !== "name" && colKey !== "total" && row.original.name !== "총합";

                const currVal = parseNumber(dataState?.[rIdx]?.[colKey]);
                const origVal = parseNumber(originalData?.[rIdx]?.[colKey]);
                const isChanged = isEditable && currVal !== origVal;

                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{ color: isChanged ? "#d32f2f" : "black", width: "80px" }}
                    onClick={() => handleCorpCardCellClick(row.original, rIdx, colKey, isSecond)}
                    onBlur={(e) => handleChange(rIdx, colKey, e.currentTarget.innerText, isSecond)}
                  >
                    {colKey === "name" ? row.original[colKey] : formatNumber(row.original[colKey])}
                  </td>
                );
              })}
            </tr>
          ))}

          <tr>
            <td style={{ fontWeight: "bold", background: "#f0f0f0" }}>이미지첨부</td>

            {Array.from({ length: 31 }, (_, i) => (
              <td
                key={`img_${i}`}
                style={{
                  textAlign: "center",
                  background: "#f9f9f9",
                  fontSize: "12px",
                  verticalAlign: "top",
                }}
              >
                <select
                  value={receiptType[i] || ""}
                  onChange={(e) => handleTypeChange(e, i)}
                  style={{
                    width: "65px",
                    fontSize: "11px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                >
                  <option value="">유형</option>
                  <option value="mart">마트</option>
                  <option value="convenience">편의점</option>
                  <option value="coupang">쿠팡</option>
                  <option value="delivery">배달앱</option>
                </select>
                <br />
                <input
                  type="file"
                  accept="image/*"
                  style={{ width: "65px", fontSize: "12px", marginBottom: "4px" }}
                  onChange={(e) => handleImageUpload(e, i)}
                />
              </td>
            ))}

            <td />
          </tr>
        </tbody>
      </table>
    </MDBox>
  );

  return (
    <DashboardLayout>
      {/* ✅ Floating Preview (비차단) */}
      <FloatingImagePreview
        open={floatingPreview.open}
        src={floatingPreview.src}
        title={floatingPreview.title}
        onClose={closeFloatingPreview}
      />

      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="🧮 집계표" />

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

          <MDButton
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
      </MDBox>

      <MDBox pt={3} pb={3}>
        <Card>
          {/* ✅ 파란 띠 안에 예산바까지 포함 (여기만 수정) */}
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
            {/* 1줄: 제목 + 탭 */}
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
              {/* 2줄: 예산바 (모바일에서 100% 폭으로 자연스럽게) */}
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
            {tabValue === 0 && renderTable(table, originalRows, handleCellChange, dataRows)}
            {tabValue === 1 &&
              renderTable(table2, original2Rows, handleCellChange, data2Rows, true)}
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

      {/* ======================== ✅ 법인카드 모달 3종 ======================== */}
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
            법인카드 결제
          </Typography>
          <Typography sx={{ fontSize: 13, mb: 2 }}>
            이미 입력된 금액이 있습니다.
            <br />
            등록 / 수정을 선택하세요. ({cardContext.dateStr})
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

      {/* 1) 법인카드 결제 등록 모달 */}
      <Modal open={cardCreateOpen} onClose={() => setCardCreateOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 560,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            법인카드 결제 등록
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 12, mb: 0.5, color: "#555" }}>법인카드 선택</Typography>
              <Select
                fullWidth
                size="small"
                sx={{ height: "35px" }}
                value={cardForm.card_idx || ""}
                onChange={(e) => {
                  const nextIdx = e.target.value;
                  const picked = (corpCardList || []).find(
                    (c) => String(c.idx) === String(nextIdx)
                  );

                  setCardForm((p) => ({
                    ...p,
                    card_idx: nextIdx,
                    card_brand: picked?.card_brand || "",
                    card_no: picked?.card_no || "",
                  }));
                }}
                displayEmpty
                disabled={corpCardLoading}
              >
                <MenuItem value="">
                  <em>{corpCardLoading ? "불러오는 중..." : "선택"}</em>
                </MenuItem>
                {(corpCardList || []).map((c) => (
                  <MenuItem key={c.idx} value={String(c.idx)}>
                    {`${c.card_brand || ""} (${maskCardNo(c.card_no)})`}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            <Grid item xs={4}>
              <Select
                fullWidth
                size="small"
                sx={{ height: "35px" }}
                value={cardForm.receipt_type || "UNKNOWN"}
                onChange={(e) => setCardForm((p) => ({ ...p, receipt_type: e.target.value }))}
                displayEmpty
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
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="사용처"
                value={cardForm.use_name}
                onChange={(e) => setCardForm((p) => ({ ...p, use_name: e.target.value }))}
              />
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="합계금액"
                value={cardForm.total}
                onChange={(e) => setCardForm((p) => ({ ...p, total: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography sx={{ minWidth: 70, fontSize: 13 }}>영수증 첨부</Typography>

                <Button component="label" variant="contained" color="info">
                  영수증 업로드
                  <input
                    ref={cardFileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleCardReceiptFileChange}
                  />
                </Button>

                <Typography sx={{ fontSize: 12, color: "#666" }}>
                  {cardForm.receipt_image?.name || ""}
                </Typography>

                {cardReceiptPreview && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      openFloatingPreview(cardReceiptPreview, "법인카드 영수증 미리보기")
                    }
                  >
                    미리보기
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>

          <Box mt={3} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                if (!cardForm.card_idx) {
                  Swal.fire("안내", "법인카드를 선택하세요.", "info");
                  return;
                }
                const ok = await saveCorpCardPayment("create");
                if (ok) {
                  Swal.fire("완료", "등록되었습니다.", "success");
                  setCardCreateOpen(false);
                  setCardReceiptPreview(null);
                }
              }}
            >
              저장
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setCardCreateOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* 2) 법인카드 결제 목록 모달 */}
      <Modal open={cardListOpen} onClose={() => setCardListOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 820,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            법인카드 결제 목록
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>{cardContext.dateStr}</Typography>

          <Box sx={{ maxHeight: 380, overflow: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>사용처</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>금액</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>결제일자</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>영수증</th>
                </tr>
              </thead>
              <tbody>
                {(cardRows || []).map((r, idx) => {
                  const rowKey = String(r.id ?? r.sale_id ?? idx);
                  const selected = cardSelectedKey === rowKey;

                  return (
                    <tr
                      key={rowKey}
                      onClick={() => {
                        setCardSelectedRow(r);
                        setCardSelectedKey(rowKey);
                      }}
                      style={{
                        background: selected ? "#d3f0ff" : "#ffffff",
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                      }}
                    >
                      <td
                        style={{
                          border: "1px solid #ddd",
                          padding: 6,
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {r.use_name}
                      </td>
                      <td
                        style={{
                          border: "1px solid #ddd",
                          padding: 6,
                          textAlign: "right",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {formatNumber(r.total)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #ddd",
                          padding: 6,
                          textAlign: "center",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {r.payment_dt}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        {r.receipt_image ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openFloatingPreview(
                                toPreviewUrl(r.receipt_image),
                                `${r.use_name || "영수증"} (목록)`
                              );
                            }}
                          >
                            보기
                          </Button>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <MDButton variant="contained" color="info" onClick={openEditFromList}>
              선택
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setCardListOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>

      {/* 3) 법인카드 결제 수정 모달 */}
      <Modal open={cardEditOpen} onClose={() => setCardEditOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 560,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            법인카드 결제 수정
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 12, mb: 0.5, color: "#555" }}>법인카드 선택</Typography>
              <Select
                fullWidth
                size="small"
                sx={{ height: "35px" }}
                value={cardForm.card_idx || ""}
                onChange={(e) => {
                  const nextIdx = e.target.value;
                  const picked = (corpCardList || []).find(
                    (c) => String(c.idx) === String(nextIdx)
                  );
                  setCardForm((p) => ({
                    ...p,
                    card_idx: nextIdx,
                    card_brand: picked?.card_brand || "",
                    card_no: picked?.card_no || "",
                  }));
                }}
                displayEmpty
                disabled={corpCardLoading}
              >
                <MenuItem value="">
                  <em>{corpCardLoading ? "불러오는 중..." : "선택"}</em>
                </MenuItem>
                {(corpCardList || []).map((c) => (
                  <MenuItem key={c.idx} value={String(c.idx)}>
                    {`${c.card_brand || ""} (${maskCardNo(c.card_no)})`}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            <Grid item xs={4}>
              <Select
                fullWidth
                size="small"
                sx={{ height: "35px" }}
                value={cardForm.receipt_type || "UNKNOWN"}
                onChange={(e) => setCardForm((p) => ({ ...p, receipt_type: e.target.value }))}
                displayEmpty
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
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="사용처"
                value={cardForm.use_name}
                onChange={(e) => setCardForm((p) => ({ ...p, use_name: e.target.value }))}
              />
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="합계금액"
                value={cardForm.total}
                onChange={(e) => setCardForm((p) => ({ ...p, total: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography sx={{ minWidth: 70, fontSize: 13 }}>영수증 첨부</Typography>

                <Button component="label" variant="contained" color="info">
                  영수증 업로드
                  <input
                    ref={cardFileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleCardReceiptFileChange}
                  />
                </Button>

                <Typography sx={{ fontSize: 12, color: "#666" }}>
                  {cardForm.receipt_image?.name || ""}
                </Typography>

                {cardReceiptPreview && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      openFloatingPreview(cardReceiptPreview, "법인카드 영수증 미리보기")
                    }
                  >
                    미리보기
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>

          <Box mt={3} display="flex" justifyContent="center" gap={2}>
            <MDButton
              variant="contained"
              color="info"
              onClick={async () => {
                if (!cardForm.card_idx) {
                  Swal.fire("안내", "법인카드를 선택하세요.", "info");
                  return;
                }
                const ok = await saveCorpCardPayment("edit");
                if (ok) {
                  Swal.fire("완료", "수정되었습니다.", "success");
                  setCardEditOpen(false);
                }
              }}
            >
              저장
            </MDButton>
            <MDButton variant="contained" color="warning" onClick={() => setCardEditOpen(false)}>
              취소
            </MDButton>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default TallySheet;
