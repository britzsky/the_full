/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  Box,
  Select,
  MenuItem,
  Typography,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
} from "@mui/material";

import Paper from "@mui/material/Paper";
import Draggable from "react-draggable";

import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";
import useAccountPersonPurchaseData from "./data/AccountPersonPurchaseData";

// ========================= 상수/유틸 =========================
const DEFAULT_CARD_BRAND = "";

// ✅ 영수증 타입(상단 테이블용)
const RECEIPT_TYPES = [
  { value: "UNKNOWN", label: "알수없음" },
  { value: "CARD_SLIP_GENERIC", label: "카드전표" },
  { value: "MART_ITEMIZED", label: "마트" },
  { value: "CONVENIENCE", label: "편의점" },
  { value: "COUPANG_CARD", label: "쿠팡" },
  { value: "COUPANG_APP", label: "배달앱" },
];

// ✅ receipt_type 값 보정(조회값이 옵션과 1:1로 매핑되게)
const RECEIPT_TYPE_SET = new Set(RECEIPT_TYPES.map((o) => String(o.value)));
const normalizeReceiptTypeVal = (v) => {
  const s = String(v ?? "").trim();
  return RECEIPT_TYPE_SET.has(s) ? s : "UNKNOWN";
};

// ✅ 하단 셀렉트 옵션
const TAX_TYPES = [
  { value: 1, label: "과세" },
  { value: 2, label: "면세" },
  { value: 3, label: "알수없음" },
];

const ITEM_TYPES = [
  { value: 1, label: "식재료" },
  { value: 2, label: "소모품" },
  { value: 3, label: "알수없음" },
];

const onlyDigits = (v = "") => String(v).replace(/\D/g, "");

const formatCardNoFull = (digits) => {
  const d = onlyDigits(digits).slice(0, 16);
  const a = d.slice(0, 4);
  const b = d.slice(4, 8);
  const c = d.slice(8, 12);
  const e = d.slice(12, 16);
  return [a, b, c, e].filter(Boolean).join("-");
};

const maskCardNo = (digits) => {
  const d = onlyDigits(digits).slice(0, 16);
  if (!d) return "";
  const first = d.slice(0, 4);
  const last = d.slice(Math.max(d.length - 4, 0));
  return `${first}-********-${last}`;
};

const normalize = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);

const isChangedValue = (orig, cur) => {
  if (typeof orig === "string" && typeof cur === "string")
    return normalize(orig) !== normalize(cur);
  return orig !== cur;
};

const makeTempId = () => `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const cleanMasterRow = (r) => {
  const { isNew, client_id, ...rest } = r;
  return rest;
};

// ✅ (추가) 상세 row 정리
const cleanDetailRow = (r) => {
  const { isNew, isForcedRed, ...rest } = r;
  return rest;
};

// ✅ yyyy-mm-dd
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// ✅ year/month로 "해당 월의 오늘(없으면 1일)" 기본값 만들기
const defaultPaymentDtForYM = (year, month) => {
  const t = new Date();
  const y = Number(year);
  const m = Number(month);
  if (t.getFullYear() === y && t.getMonth() + 1 === m) return todayStr();
  return `${y}-${pad2(m)}-01`;
};

// ✅ 숫자 컬럼(콤마 표시/저장시 제거)
const MASTER_NUMBER_KEYS = ["total", "vat", "taxFree", "totalCard", "tax"];

// ✅ 상세(하단)에서 숫자로 취급할 컬럼들
const DETAIL_NUMBER_KEYS = ["qty", "amount", "unitPrice"];

// ✅ 상세 Select 컬럼(숫자 enum)
const DETAIL_SELECT_KEYS = ["taxType", "itemType"];

const parseNumMaybe = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .replace(/\u00A0/g, " ")
    .trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? null : n;
};

// ✅ taxType / itemType 은 "숫자"로 비교
const isDetailFieldChanged = (key, origVal, curVal) => {
  if (DETAIL_NUMBER_KEYS.includes(key) || DETAIL_SELECT_KEYS.includes(key)) {
    return parseNumMaybe(origVal) !== parseNumMaybe(curVal);
  }
  return isChangedValue(origVal, curVal);
};

const isDetailFieldSame = (key, a, b) => !isDetailFieldChanged(key, a, b);

const formatNumber = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) return "";
  return n.toLocaleString();
};

const parseNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(
    String(v)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isNaN(n) ? 0 : n;
};

// ✅ input[type=date] 안정적으로 쓰기 위한 보정
const toDateInputValue = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// ✅ (추가) contentEditable 숫자셀 클릭 시 전체선택(덮어쓰기 입력)
const selectAllContent = (el) => {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
};

// ============================================================
// ✅ 특정 거래처(account_id) 조건
// - 사용처(use_name) 상단 셀: Select 고정 (value=1 / text=웰스토리)
// - 이미지 첨부(업로드/재업로드) 차단
// - 저장 시 type: 특정 account_id면 1, 그 외 1008
// ============================================================
const SPECIAL_ACCOUNT_IDS = new Set([
  "20260126093618",
  "20260126093730",
  "20260126093808",
  "20260127025350",
  "20260127025657",
]);

// ✅ 결제타입 / 현금영수증(증빙)타입
const PAY_TYPES = [
  { value: 1, label: "현금" },
  { value: 2, label: "카드" },
];

const CASH_RECEIPT_TYPES = [
  { value: 1, label: "개인소득공제" },
  { value: 2, label: "사업자지출증빙" },
  { value: 3, label: "미발급" },
];

// master쪽 enum 비교/저장용
const MASTER_SELECT_KEYS = ["payType", "cash_receipt_type"];

const isSpecialAccount = (accountId) => SPECIAL_ACCOUNT_IDS.has(String(accountId || ""));

// 사용처 셀렉트 옵션 (고정)
const SPECIAL_USE_OPTIONS = [{ value: "1", label: "웰스토리" }];

const normalizeSpecialUseValue = (v) => {
  const s = String(v ?? "").trim();
  if (s === "1") return "1";
  if (s.includes("웰스토리")) return "1";
  return "1";
};

const getSaveTypeByAccount = (accountId) => (isSpecialAccount(accountId) ? 1 : 1008);

function AccountCorporateCardSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    loading,
    accountList,
    fetchAccountList,
    paymentRows,
    fetchAccountCorporateCardPaymentList,
    paymentDetailRows,
    fetchAccountCorporateCardPaymentDetailList,
  } = useAccountPersonPurchaseData();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [masterRows, setMasterRows] = useState([]);
  const [origMasterRows, setOrigMasterRows] = useState([]);

  const [detailRows, setDetailRows] = useState([]);
  const [origDetailRows, setOrigDetailRows] = useState([]);

  const [selectedMaster, setSelectedMaster] = useState(null);

  // ✅ 거래처 검색조건 (string id 유지)
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");

  // ✅ 스캔된 상세 item 은 무조건 빨간 글씨
  const isForcedRedRow = (row) => !!row?.isForcedRed;

  // ✅ 스크롤 ref
  const masterWrapRef = useRef(null);
  const masterScrollPosRef = useRef(0);
  const detailScrollPosRef = useRef(0);
  const scrollMasterToBottom = useCallback((smooth = true) => {
    const el = masterWrapRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // ✅ (추가) 상세 스크롤 ref
  const detailWrapRef = useRef(null);
  const scrollDetailToBottom = useCallback((smooth = true) => {
    const el = detailWrapRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const saveMasterScroll = useCallback(() => {
    const el = masterWrapRef.current;
    if (el) masterScrollPosRef.current = el.scrollTop;
  }, []);

  const saveDetailScroll = useCallback(() => {
    const el = detailWrapRef.current;
    if (el) detailScrollPosRef.current = el.scrollTop;
  }, []);

  const fileIconSx = { color: "#1e88e5" };

  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = `${API_BASE_URL}${path}`;
    const filename = path.split("/").pop() || "download";

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ============================================================
  // ✅ 잔상(행추가) 제거 + contentEditable DOM 잔상 제거
  // ============================================================
  const skipPendingNewMergeRef = useRef(false);
  const [masterRenderKey, setMasterRenderKey] = useState(0);
  const [detailRenderKey, setDetailRenderKey] = useState(0);

  // ========================= 초기 로드: 거래처 목록 =========================
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchAccountList();
  }, [fetchAccountList]);

  // ✅ 추가: 기본 거래처 자동세팅은 딱 1번만
  const didSetDefaultAccountRef = useRef(false);

  // accountList 로딩 후 기본 선택값 (초기 1회만)
  useEffect(() => {
    if (didSetDefaultAccountRef.current) return;

    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(String(accountList[0].account_id));
      didSetDefaultAccountRef.current = true;
    }
  }, [accountList, selectedAccountId]);

  // ✅ 거래처 Autocomplete 옵션(안정화)
  const accountOptions = useMemo(() => {
    return (accountList || []).map((a) => ({
      account_id: String(a.account_id),
      account_name: String(a.account_name ?? ""),
    }));
  }, [accountList]);

  const selectedAccountOption = useMemo(() => {
    const id = String(selectedAccountId || "");
    return accountOptions.find((o) => o.account_id === id) || null;
  }, [accountOptions, selectedAccountId]);

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.account_name || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((o) =>
        String(o?.account_name || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      setSelectedAccountId(partial.account_id);
      setAccountInput(partial.account_name || q);
    }
  }, [accountInput, accountOptions]);

  // ========================= 조회 =========================
  const handleFetchMaster = useCallback(async () => {
    if (!selectedAccountId) return;
    await fetchAccountCorporateCardPaymentList({ year, month, account_id: selectedAccountId });
  }, [fetchAccountCorporateCardPaymentList, year, month, selectedAccountId]);

  // ✅ 거래처/연/월 변경 시 자동 조회
  useEffect(() => {
    if (!selectedAccountId) return;

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);

    skipPendingNewMergeRef.current = true;
    handleFetchMaster();
  }, [selectedAccountId, year, month, handleFetchMaster]);

  const accountNameById = useMemo(() => {
    const m = new Map();
    (accountList || []).forEach((a) => m.set(String(a.account_id), a.account_name));
    return m;
  }, [accountList]);

  // ✅ 서버 paymentRows 갱신 시
  // - receipt_type 옵션값 보정
  // - cardNo digits 정규화
  // - ✅ 특정 account_id면 use_name(사용처) 강제 "1"(웰스토리)
  useEffect(() => {
    saveMasterScroll();

    const serverRows = (paymentRows || [])
      .slice()
      .sort((a, b) => {
        const da = String(a?.saleDate ?? "");
        const db = String(b?.saleDate ?? "");
        if (da !== db) return da.localeCompare(db);
        const sa = String(a?.sale_id ?? "");
        const sb = String(b?.sale_id ?? "");
        return sa.localeCompare(sb);
      })
      .map((r) => {
        const acctKey = String(r.account_id ?? selectedAccountId ?? "");
        const cardNoDigits = onlyDigits(r.cardNo ?? r.card_no ?? "");

        const next = {
          ...r,
          cardNo: cardNoDigits, // digits 정규화
          cardBrand: r.cardBrand ?? r.card_brand ?? r.cardBrand ?? DEFAULT_CARD_BRAND,
          receipt_type: normalizeReceiptTypeVal(r.receipt_type),
          // ✅ 추가: payType, cash_receipt_type 정규화(숫자)
          payType: parseNumMaybe(r.payType) ?? 2, // 기본 카드
          cash_receipt_type:
            (parseNumMaybe(r.payType) ?? 2) === 2 ? 3 : parseNumMaybe(r.cash_receipt_type) ?? 3,
        };

        // ✅ 특정 거래처면 사용처는 항상 "1"(웰스토리)로 맞춤
        if (isSpecialAccount(acctKey)) {
          next.use_name = normalizeSpecialUseValue(next.use_name);
        }

        return next;
      });

    setMasterRows((prev) => {
      const keepNew = !skipPendingNewMergeRef.current;
      const pendingNew = keepNew ? (prev || []).filter((x) => x?.isNew) : [];
      skipPendingNewMergeRef.current = false;
      return [...serverRows, ...pendingNew];
    });

    setOrigMasterRows(serverRows);

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);

    setMasterRenderKey((k) => k + 1);
  }, [paymentRows, selectedAccountId, saveMasterScroll]);

  // ✅ 상세 rows 갱신 시
  useEffect(() => {
    saveDetailScroll();
    const copy = (paymentDetailRows || []).map((r) => ({
      ...r,
      isForcedRed: false,
      isNew: false,
    }));
    setDetailRows(copy);
    setOrigDetailRows(copy);

    setDetailRenderKey((k) => k + 1);
  }, [paymentDetailRows, saveDetailScroll]);

  useLayoutEffect(() => {
    const el = masterWrapRef.current;
    if (el) el.scrollTop = masterScrollPosRef.current;
  }, [masterRenderKey]);

  useLayoutEffect(() => {
    const el = detailWrapRef.current;
    if (el) el.scrollTop = detailScrollPosRef.current;
  }, [detailRenderKey, selectedMaster?.sale_id]);

  useLayoutEffect(() => {
    if (loading) return;
    const masterEl = masterWrapRef.current;
    if (masterEl) masterEl.scrollTop = masterScrollPosRef.current;
    const detailEl = detailWrapRef.current;
    if (detailEl) detailEl.scrollTop = detailScrollPosRef.current;
  }, [loading]);

  // ========================= 변경 핸들러 =========================
  const handleMasterCellChange = useCallback((rowIndex, key, value) => {
    setMasterRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  }, []);

  const handleDetailCellChange = useCallback((rowIndex, key, value) => {
    const nextRaw = typeof value === "string" ? value.replace(/\u00A0/g, " ").trim() : value;

    setDetailRows((prev) => {
      const curRow = prev[rowIndex];
      if (!curRow) return prev;

      const curVal = curRow[key] ?? "";
      if (isDetailFieldSame(key, curVal, nextRaw)) return prev;

      const nextVal =
        DETAIL_NUMBER_KEYS.includes(key) || DETAIL_SELECT_KEYS.includes(key)
          ? parseNumMaybe(nextRaw) ?? 0
          : nextRaw;

      return prev.map((r, i) => (i === rowIndex ? { ...r, [key]: nextVal } : r));
    });
  }, []);

  // ✅ 행추가(상단)
  const addMasterRow = useCallback(() => {
    if (!selectedAccountId) {
      return Swal.fire("안내", "거래처를 먼저 선택해주세요.", "info");
    }

    const paymentDtDefault = defaultPaymentDtForYM(year, month);
    const special = isSpecialAccount(selectedAccountId);

    const newRow = {
      client_id: makeTempId(),
      sale_id: "",

      account_id: selectedAccountId,
      saleDate: "",

      // ✅ 특정 거래처면 사용처 고정 "1"
      use_name: special ? "1" : "",
      bizNo: "",
      total: 0,
      vat: 0,
      taxFree: 0,
      totalCard: 0,
      payType: 2, // ✅ 기본: 카드
      cash_receipt_type: 3, // ✅ 카드일 때 기본: 미발급

      // ✅ 카드번호/카드사는 "조회값 표시" 컨셉이므로 신규행은 비워둠
      cardNo: "",
      cardBrand: "",

      // ✅ 영수증 타입(추가)
      receipt_type: "UNKNOWN",

      receipt_image: "",
      note: "",
      reg_dt: "",
      user_id: localStorage.getItem("user_id") || "",

      isNew: true,
    };

    setMasterRows((prev) => [...prev, newRow]);
    requestAnimationFrame(() => scrollMasterToBottom(true));
  }, [year, month, scrollMasterToBottom, selectedAccountId]);

  // ✅ (추가) 행추가(하단) - 선택된 상단 sale_id로 상세행 추가
  const addDetailRow = useCallback(() => {
    if (!selectedMaster) {
      return Swal.fire("안내", "상단 결제내역에서 행을 먼저 선택해주세요.", "info");
    }
    const sid = String(selectedMaster.sale_id || "").trim();
    if (!sid) {
      return Swal.fire(
        "안내",
        "선택한 상단 행이 아직 저장되지 않아 상세를 추가할 수 없습니다.\n상단을 먼저 저장한 후 다시 추가해주세요.",
        "info"
      );
    }

    const newDetail = {
      sale_id: sid,
      name: "",
      qty: 0,
      amount: 0,
      unitPrice: 0,
      taxType: "",
      itemType: "",
      isForcedRed: false,
      isNew: true,
    };

    setDetailRows((prev) => [...(prev || []), newDetail]);
    setOrigDetailRows((prev) => [...(prev || []), {}]);
    setDetailRenderKey((k) => k + 1);

    requestAnimationFrame(() => scrollDetailToBottom(true));
  }, [selectedMaster, scrollDetailToBottom]);

  // ========================= 영수증 업로드/스캔 =========================
  const handleImageUpload = useCallback(
    async (file, rowIndex) => {
      if (!file) return;

      const row = masterRows[rowIndex] || {};

      // ✅ (추가) 결제일자 필수
      const payDt = toDateInputValue(row.saleDate);
      if (!payDt) {
        return Swal.fire("경고", "결제일자가 없으면 영수증 업로드가 불가합니다.", "warning");
      }

      // ✅ 특정 거래처는 이미지 첨부(업로드) 금지
      if (isSpecialAccount(row.account_id)) {
        return Swal.fire("안내", "해당 거래처는 영수증 이미지 첨부가 불가합니다.", "info");
      }

      const typeOk = !!String(row.receipt_type || ""); // ✅ 타입 필수
      if (!typeOk) {
        return Swal.fire("경고", "영수증타입을 선택해주세요.", "warning");
      }

      try {
        Swal.fire({
          title: "영수증 확인 중 입니다.",
          text: "잠시만 기다려 주세요...",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading(),
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", localStorage.getItem("user_id") || "");
        formData.append("receipt_type", row.receipt_type);
        formData.append("type", 1008);
        formData.append("account_id", row.account_id);
        formData.append("saleDate", row.saleDate);
        formData.append("saveType", "person");

        const res = await api.post("/receipt-scanV5", formData, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        Swal.close();

        if (res.status !== 200) {
          return Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
        }

        const data = res.data || {};
        const main = data.main || {};
        const items = data.item || [];

        const patch = {
          ...(main.sale_id != null ? { sale_id: main.sale_id } : {}),
          ...(main.account_id != null && main.account_id !== ""
            ? { account_id: main.account_id }
            : {}),
          ...(main.saleDate != null ? { saleDate: main.saleDate } : {}),
          ...(main.use_name != null ? { use_name: main.use_name } : {}),
          ...(main.bizNo != null ? { bizNo: main.bizNo } : {}),
          ...(main.total != null ? { total: parseNumber(main.total) } : {}),
          ...(main.vat != null ? { vat: parseNumber(main.vat) } : {}),
          ...(main.taxFree != null ? { taxFree: parseNumber(main.taxFree) } : {}),
          ...(main.totalCard != null ? { totalCard: parseNumber(main.totalCard) } : {}),
          ...(main.cardNo != null ? { cardNo: onlyDigits(main.cardNo) } : {}),
          ...(main.cardBrand != null ? { cardBrand: main.cardBrand } : {}),
          ...(main.receipt_image != null ? { receipt_image: main.receipt_image } : {}),
          ...(main.receipt_type != null
            ? { receipt_type: normalizeReceiptTypeVal(main.receipt_type) }
            : {}),
        };

        setMasterRows((prev) =>
          prev.map((r, i) => {
            if (i !== rowIndex) return r;

            const digits =
              patch.cardNo !== undefined ? onlyDigits(patch.cardNo) : onlyDigits(r.cardNo);

            const next = {
              ...r,
              ...patch,
              account_id: patch.account_id !== undefined ? patch.account_id : r.account_id ?? "",
              cardNo: digits,
              cardBrand: patch.cardBrand ?? r.cardBrand ?? DEFAULT_CARD_BRAND,
            };

            // ✅ 혹시라도 파서 결과로 사용처가 들어오더라도, 특정 거래처면 고정
            if (isSpecialAccount(next.account_id)) {
              next.use_name = normalizeSpecialUseValue(next.use_name);
            }

            return next;
          })
        );

        if (Array.isArray(items)) {
          const saleIdForDetail = main.sale_id || row.sale_id || "";
          const normalized = items.map((it) => ({
            sale_id: it.sale_id || saleIdForDetail || "",
            name: it.name ?? "",
            qty: it.qty ?? "",
            amount: it.amount ?? "",
            unitPrice: it.unitPrice ?? "",
            taxType: it.taxType ?? "",
            itemType: it.itemType ?? "",
            isForcedRed: true,
            isNew: false,
          }));

          const patchedSelected = {
            ...(masterRows[rowIndex] || {}),
            ...patch,
            account_id: patch.account_id !== undefined ? patch.account_id : row.account_id ?? "",
          };
          setSelectedMaster(patchedSelected);

          setDetailRows(normalized);
          setOrigDetailRows(normalized.map((x) => ({ ...x })));
          setDetailRenderKey((k) => k + 1);
        }

        Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        skipPendingNewMergeRef.current = true;
        await handleFetchMaster();

        const newSaleId = main.sale_id;
        const newAcct = patch.account_id ?? row.account_id;
        const newPayDt = patch.saleDate ?? row.saleDate;

        if (newSaleId) {
          await fetchAccountCorporateCardPaymentDetailList({
            sale_id: newSaleId,
            account_id: newAcct,
            saleDate: newPayDt,
          });
        }
      } catch (err) {
        Swal.close();
        Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
      }
    },
    [masterRows, handleFetchMaster, fetchAccountCorporateCardPaymentDetailList]
  );

  // ========================= 저장: main + item 한 번에 =========================
  const origMasterBySaleId = useMemo(() => {
    const m = new Map();
    for (const r of origMasterRows || []) {
      if (r?.sale_id != null && String(r.sale_id) !== "") m.set(String(r.sale_id), r);
    }
    return m;
  }, [origMasterRows]);

  const normalizeMasterForSave = useCallback((r) => {
    const row = cleanMasterRow(r);
    MASTER_NUMBER_KEYS.forEach((k) => {
      if (row[k] !== undefined) row[k] = parseNumber(row[k]);
    });

    // ✅ receipt_type 보정(혹시 모를 비정상 값 저장 방지)
    if (row.receipt_type !== undefined) {
      row.receipt_type = normalizeReceiptTypeVal(row.receipt_type);
    }

    // ✅ cardNo digits 정규화
    if (row.cardNo !== undefined && row.cardNo !== null) {
      row.cardNo = onlyDigits(row.cardNo);
    }

    // ✅ 특정 거래처면 사용처 "1"로 고정 저장
    if (isSpecialAccount(row.account_id)) {
      row.use_name = normalizeSpecialUseValue(row.use_name);
    }
    // ✅ payType / cash_receipt_type 숫자 정규화
    if (row.payType !== undefined) row.payType = parseNumMaybe(row.payType);
    if (row.cash_receipt_type !== undefined)
      row.cash_receipt_type = parseNumMaybe(row.cash_receipt_type);

    return row;
  }, []);

  const saveAll = useCallback(async () => {
    const userId = localStorage.getItem("user_id") || "";
    const typeForThisAccount = getSaveTypeByAccount(selectedAccountId);

    // ✅ (추가) 결제일자 필수 검증 함수
    const hasPaymentDate = (r) => !!toDateInputValue(r?.saleDate);

    // ✅ (추가) "저장 대상 main"을 먼저 계산하기 위해, 저장 대상 여부만 판정
    const willSaveMain = (r) => {
      if (r.isNew) return true;

      const sid = String(r.sale_id || "");
      const o = sid ? origMasterBySaleId.get(sid) : null;
      if (!o) return true;

      const changed = Object.keys(r).some((k) => {
        if (MASTER_NUMBER_KEYS.includes(k)) return parseNumber(o[k]) !== parseNumber(r[k]);
        return isChangedValue(o[k], r[k]);
      });

      return changed;
    };

    // ✅ (추가) main 저장 대상 중 결제일자 없는 행 있으면 저장 차단
    const missingMainPayDtIdx = (masterRows || []).findIndex(
      (r) => willSaveMain(r) && !hasPaymentDate(r)
    );
    if (missingMainPayDtIdx >= 0) {
      return Swal.fire(
        "경고",
        `결제일자가 없으면 저장할 수 없습니다.\n(상단 ${
          missingMainPayDtIdx + 1
        }번째 행 결제일자 확인)`,
        "warning"
      );
    }

    // ✅ (추가) item 저장이 발생하는데 선택된 상단 결제일자 없으면 저장 차단
    // (detailRows는 항상 selectedMaster 기준이므로 여기서 한번 더 막아주면 안전)
    const willSaveAnyItem = (detailRows || []).some((r, i) => {
      if (r?.isNew) return true;
      if (isForcedRedRow(r)) return true;
      const o = origDetailRows[i] || {};
      return Object.keys(r).some((k) => isDetailFieldChanged(k, o[k], r[k]));
    });

    if (willSaveAnyItem) {
      const masterPayDt = toDateInputValue(selectedMaster?.saleDate);
      if (!masterPayDt) {
        return Swal.fire("경고", "결제일자가 없으면 상세내역 저장이 불가합니다.", "warning");
      }
    }

    // ---- 여기부터 기존 코드 그대로(main/item payload 생성) ----
    const main = masterRows
      .map((r) => {
        if (r.isNew) return normalizeMasterForSave(r);

        const sid = String(r.sale_id || "");
        const o = sid ? origMasterBySaleId.get(sid) : null;
        if (!o) return normalizeMasterForSave(r);

        const changed = Object.keys(r).some((k) => {
          if (MASTER_NUMBER_KEYS.includes(k)) return parseNumber(o[k]) !== parseNumber(r[k]);
          return isChangedValue(o[k], r[k]);
        });

        return changed ? normalizeMasterForSave(r) : null;
      })
      .filter(Boolean)
      .map((r) => ({
        ...r,
        user_id: userId,
        type: getSaveTypeByAccount(r.account_id),
      }));

    const item = detailRows
      .map((r, i) => {
        if (r?.isNew) return cleanDetailRow(r);
        if (isForcedRedRow(r)) return cleanDetailRow(r);

        const o = origDetailRows[i] || {};
        const changed = Object.keys(r).some((k) => isDetailFieldChanged(k, o[k], r[k]));
        return changed ? cleanDetailRow(r) : null;
      })
      .filter(Boolean)
      .map((r) => ({
        ...r,
        user_id: userId,
        type: typeForThisAccount,
      }));

    if (main.length === 0 && item.length === 0) {
      return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
    }

    try {
      Swal.fire({
        title: "저장 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post(
        "/Account/AccountPersonPurchasePaymentAllSave",
        { main, item },
        { headers: { "Content-Type": "application/json" } }
      );

      if (!(res.data?.code === 200 || res.status === 200)) {
        Swal.close();
        return Swal.fire("실패", res.data?.message || "저장 실패", "error");
      }

      Swal.close();
      Swal.fire("성공", "저장되었습니다.", "success");

      skipPendingNewMergeRef.current = true;
      await handleFetchMaster();

      if (selectedMaster?.sale_id) {
        await fetchAccountCorporateCardPaymentDetailList({
          sale_id: selectedMaster.sale_id,
          account_id: selectedMaster.account_id,
          saleDate: selectedMaster.saleDate,
        });
      } else {
        setOrigDetailRows(detailRows.map((x) => ({ ...x, isForcedRed: false, isNew: false })));
        setDetailRows((prev) => prev.map((x) => ({ ...x, isForcedRed: false, isNew: false })));
        setDetailRenderKey((k) => k + 1);
      }
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 오류", "error");
    }
  }, [
    masterRows,
    detailRows,
    origDetailRows,
    handleFetchMaster,
    selectedMaster,
    fetchAccountCorporateCardPaymentDetailList,
    origMasterBySaleId,
    normalizeMasterForSave,
    selectedAccountId,
  ]);

  // ========================= ✅ "윈도우"처럼 이동 가능한 이미지 뷰어 =========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const viewerNodeRef = useRef(null);

  const imageItems = useMemo(() => {
    return (masterRows || [])
      .filter((r) => !!r?.receipt_image)
      .map((r) => ({
        path: r.receipt_image,
        src: `${API_BASE_URL}${r.receipt_image}`,
        title: `${r.use_name || ""} ${toDateInputValue(r.saleDate) || ""}`.trim(),
      }));
  }, [masterRows]);

  const handleViewImage = useCallback(
    (path) => {
      if (!path) return;
      const idx = imageItems.findIndex((x) => x.path === path);
      setViewerIndex(idx >= 0 ? idx : 0);
      setViewerOpen(true);
    },
    [imageItems]
  );

  const handleCloseViewer = useCallback(() => setViewerOpen(false), []);

  const goPrev = useCallback(() => {
    setViewerIndex((i) =>
      imageItems.length ? (i - 1 + imageItems.length) % imageItems.length : 0
    );
  }, [imageItems.length]);

  const goNext = useCallback(() => {
    setViewerIndex((i) => (imageItems.length ? (i + 1) % imageItems.length : 0));
  }, [imageItems.length]);

  useEffect(() => {
    if (!viewerOpen) return;
    if (!imageItems.length) {
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > imageItems.length - 1) setViewerIndex(imageItems.length - 1);
  }, [viewerOpen, imageItems.length, viewerIndex]);

  useEffect(() => {
    if (!viewerOpen) return;

    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (isTyping) return;

      if (e.key === "Escape") handleCloseViewer();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerOpen, goPrev, goNext, handleCloseViewer]);

  const currentImg = imageItems[viewerIndex];

  // ========================= 컬럼 정의 =========================
  const masterColumns = useMemo(
    () => [
      { header: "거래처", key: "account_id", editable: false, size: 180 },
      { header: "결제일자", key: "saleDate", editable: true, editType: "date", size: 130 },
      { header: "사용처", key: "use_name", editable: true, size: 140 },
      { header: "사업자번호", key: "bizNo", editable: true, size: 120 },
      { header: "과세", key: "tax", editable: true, size: 90 },
      { header: "부가세", key: "vat", editable: true, size: 90 },
      { header: "면세", key: "taxFree", editable: true, size: 90 },
      { header: "합계금액", key: "total", editable: true, size: 110 },

      // ✅ 추가
      {
        header: "결제타입",
        key: "payType",
        editable: false,
        size: 110,
        type: "select",
        options: PAY_TYPES,
      },
      {
        header: "증빙타입",
        key: "cash_receipt_type",
        editable: false,
        size: 150,
        type: "select",
        options: CASH_RECEIPT_TYPES,
      },

      // ✅ 카드번호/카드사는 "조회된 값 표시" (Select 제거)
      { header: "카드번호", key: "cardNo", editable: true, size: 200 },
      { header: "카드사", key: "cardBrand", editable: true, size: 130 },

      {
        header: "영수증타입",
        key: "receipt_type",
        editable: false,
        size: 120,
        type: "select",
        options: RECEIPT_TYPES,
      },
      { header: "영수증사진", key: "receipt_image", editable: false, size: 110 },
      { header: "비고", key: "note", editable: true, size: 160 },
      { header: "등록일자", key: "reg_dt", editable: false, size: 110 },
    ],
    []
  );

  const detailColumns = useMemo(
    () => [
      { header: "상품명", key: "name", editable: true, size: 220 },
      { header: "수량", key: "qty", editable: true, size: 80 },
      { header: "금액", key: "amount", editable: true, size: 100 },
      { header: "단가", key: "unitPrice", editable: true, size: 100 },
      {
        header: "과세구분",
        key: "taxType",
        editable: false,
        size: 120,
        type: "select",
        options: TAX_TYPES,
      },
      {
        header: "상품구분",
        key: "itemType",
        editable: false,
        size: 120,
        type: "select",
        options: ITEM_TYPES,
      },
    ],
    []
  );

  // ========================= ✅ 합계(footer) 계산 =========================
  const sumMasterTax = useMemo(
    () => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.tax), 0),
    [masterRows]
  );
  const sumMasterVat = useMemo(
    () => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.vat), 0),
    [masterRows]
  );
  const sumMasterTaxFree = useMemo(
    () => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.taxFree), 0),
    [masterRows]
  );
  const sumMasterTotal = useMemo(
    () => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.total), 0),
    [masterRows]
  );

  const sumDetailQty = useMemo(
    () => (detailRows || []).reduce((acc, r) => acc + parseNumber(r?.qty), 0),
    [detailRows]
  );
  const sumDetailAmount = useMemo(
    () => (detailRows || []).reduce((acc, r) => acc + parseNumber(r?.amount), 0),
    [detailRows]
  );

  // ========================= ✅ 하단 수정 → 상단 자동 반영 =========================
  useEffect(() => {
    if (!selectedMaster) return;

    // ✅ 핵심: 하단 행이 없으면 상단 합계를 절대 건드리지 않음
    if (!detailRows || detailRows.length === 0) return;

    const masterKey = selectedMaster.sale_id
      ? { type: "sale_id", value: String(selectedMaster.sale_id) }
      : selectedMaster.client_id
      ? { type: "client_id", value: String(selectedMaster.client_id) }
      : null;

    if (!masterKey) return;

    const nextTotal = Number(sumDetailAmount || 0);

    let nextTax = 0;
    let nextVat = 0;
    let nextTaxFree = 0;

    (detailRows || []).forEach((r) => {
      const amt = parseNumber(r?.amount);
      const tt = parseNumMaybe(r?.taxType);

      if (tt === 1) {
        const supply = Math.round(amt / 1.1);
        const vat = amt - supply;
        nextTax += supply;
        nextVat += vat;
      } else if (tt === 2) {
        nextTaxFree += amt;
      }
    });

    setMasterRows((prev) => {
      const idx = prev.findIndex((r) =>
        masterKey.type === "sale_id"
          ? String(r.sale_id) === masterKey.value
          : String(r.client_id) === masterKey.value
      );
      if (idx < 0) return prev;

      const row = prev[idx];

      const same =
        parseNumber(row.total) === nextTotal &&
        parseNumber(row.tax) === nextTax &&
        parseNumber(row.vat) === nextVat &&
        parseNumber(row.taxFree) === nextTaxFree;

      if (same) return prev;

      const next = [...prev];
      next[idx] = { ...row, total: nextTotal, tax: nextTax, vat: nextVat, taxFree: nextTaxFree };
      return next;
    });

    setSelectedMaster((prev) =>
      prev ? { ...prev, total: nextTotal, tax: nextTax, vat: nextVat, taxFree: nextTaxFree } : prev
    );
  }, [detailRows, sumDetailAmount, selectedMaster]);

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* ====== 상단 sticky 헤더 ====== */}
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="💳 현장 개인구매 관리" />

        <MDBox
          pt={1}
          pb={1}
          sx={{
            display: "flex",
            flexWrap: isMobile ? "wrap" : "nowrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            alignItems: "center",
            gap: 1,
            position: "sticky",
            zIndex: 10,
            top: 78,
            backgroundColor: "#ffffff",
          }}
        >
          <Box
            sx={{
              flexWrap: isMobile ? "wrap" : "nowrap",
              justifyContent: isMobile ? "flex-start" : "flex-end",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "right",
              gap: 1,
            }}
          >
            {/* ✅ 거래처: 문자 검색 가능한 Autocomplete */}
            <Autocomplete
              size="small"
              sx={{ minWidth: 200 }}
              options={accountOptions}
              value={selectedAccountOption}
              onChange={(_, newValue) => setSelectedAccountId(newValue?.account_id || "")}
              inputValue={accountInput}
              onInputChange={(_, newValue) => setAccountInput(newValue)}
              getOptionLabel={(opt) => opt?.account_name || ""}
              isOptionEqualToValue={(opt, val) => String(opt.account_id) === String(val.account_id)}
              disablePortal
              autoHighlight
              openOnFocus
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      selectAccountByInput();
                    }
                  }}
                  sx={{
                    "& .MuiInputBase-root": { height: 45, fontSize: 12 },
                    "& input": { padding: "0 8px" },
                  }}
                />
              )}
            />

            <Select
              size="small"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              sx={{ minWidth: 110 }}
            >
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
                <MenuItem key={y} value={y}>
                  {y}년
                </MenuItem>
              ))}
            </Select>

            <Select
              size="small"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              sx={{ minWidth: 90 }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MenuItem key={m} value={m}>
                  {m}월
                </MenuItem>
              ))}
            </Select>

            <MDButton color="info" onClick={addMasterRow} sx={{ minWidth: 90 }}>
              행추가
            </MDButton>

            <MDButton color="info" onClick={handleFetchMaster} sx={{ minWidth: 80 }}>
              조회
            </MDButton>

            <MDButton color="info" onClick={saveAll} sx={{ minWidth: 80 }}>
              저장
            </MDButton>

            {/* ✅ 법인카드관리 버튼 제거 */}
          </Box>
        </MDBox>
      </MDBox>

      {/* ====== 상단/하단 50:50 영역 ====== */}
      <MDBox
        sx={{
          height: "calc(100vh - 170px)",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          mt: 1.5,
        }}
      >
        {/* ========================= 상단(50%) 결제내역 ========================= */}
        <MDBox
          ref={masterWrapRef}
          sx={{
            flex: 1,
            overflow: "auto",
            border: "1px solid #ddd",
            borderRadius: 1,
            "& table": {
              borderCollapse: "separate",
              width: "max-content",
              minWidth: "100%",
              borderSpacing: 0,
            },
            "& tfoot td": {
              backgroundColor: "#fafafa",
              position: "sticky",
              bottom: 0,
              zIndex: 3,
              fontWeight: 700,
            },
            "& th, & td": {
              border: "1px solid #686D76",
              textAlign: "center",
              whiteSpace: "nowrap",
              fontSize: "12px",
              padding: "4px",
            },
            "& th": {
              backgroundColor: "#f0f0f0",
              position: "sticky",
              top: 0,
              zIndex: 2,
            },
          }}
        >
          <table key={`master-${selectedAccountId}-${year}-${month}-${masterRenderKey}`}>
            <thead>
              <tr>
                {masterColumns.map((c) => (
                  <th key={c.key} style={{ width: c.size }}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {masterRows.map((row, rowIndex) => (
                <tr
                  key={row.sale_id || row.client_id || rowIndex}
                  style={{
                    background:
                      selectedMaster?.sale_id &&
                      selectedMaster?.sale_id === row.sale_id &&
                      row.sale_id
                        ? "#d3f0ff"
                        : "white",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    saveMasterScroll();
                    if (!row.sale_id) {
                      setSelectedMaster(row);
                      return;
                    }

                    setSelectedMaster(row);
                    await fetchAccountCorporateCardPaymentDetailList({
                      sale_id: row.sale_id,
                      account_id: row.account_id,
                      saleDate: row.saleDate,
                    });
                  }}
                >
                  {masterColumns.map((c) => {
                    const key = c.key;

                    const rawVal = row[key] ?? "";
                    const val = MASTER_NUMBER_KEYS.includes(key) ? formatNumber(rawVal) : rawVal;

                    const origRaw = origMasterRows[rowIndex]?.[key];
                    const changed = row.isNew
                      ? true
                      : MASTER_NUMBER_KEYS.includes(key)
                      ? parseNumber(origRaw) !== parseNumber(rawVal)
                      : isChangedValue(origRaw, rawVal);

                    if (key === "account_id") {
                      const acctName =
                        accountNameById.get(String(row.account_id)) || String(row.account_id || "");
                      return (
                        <td key={key} style={{ width: c.size, color: changed ? "red" : "black" }}>
                          {acctName}
                        </td>
                      );
                    }

                    if (key === "saleDate") {
                      const dateVal = toDateInputValue(rawVal);
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <TextField
                            type="date"
                            size="small"
                            fullWidth
                            value={dateVal}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) =>
                              handleMasterCellChange(rowIndex, "saleDate", e.target.value)
                            }
                            sx={{
                              "& input": {
                                fontSize: 12,
                                height: 14,
                                padding: "6px 8px",
                                color: changed ? "red" : "black",
                              },
                            }}
                            inputProps={{ style: { textAlign: "center" } }}
                          />
                        </td>
                      );
                    }

                    // ✅ 사용처: 특정 거래처면 Select 고정(1:웰스토리)
                    if (key === "use_name") {
                      const special = isSpecialAccount(row.account_id);
                      if (special) {
                        const cur = normalizeSpecialUseValue(row.use_name);
                        return (
                          <td key={key} style={{ width: c.size }}>
                            <Select
                              size="small"
                              fullWidth
                              value={cur}
                              onChange={(e) =>
                                handleMasterCellChange(rowIndex, "use_name", e.target.value)
                              }
                              onClick={(ev) => ev.stopPropagation()}
                              sx={{
                                fontSize: 12,
                                height: 28,
                                "& .MuiSelect-select": { color: changed ? "red" : "black" },
                                "& .MuiSvgIcon-root": { color: changed ? "red" : "black" },
                              }}
                            >
                              {SPECIAL_USE_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                        );
                      }

                      if (c.editable) {
                        return (
                          <td
                            key={key}
                            contentEditable
                            suppressContentEditableWarning
                            style={{ width: c.size, color: changed ? "red" : "black" }}
                            onBlur={(e) => {
                              const text = e.currentTarget.innerText.trim();
                              handleMasterCellChange(rowIndex, key, text);
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {val}
                          </td>
                        );
                      }

                      return (
                        <td key={key} style={{ width: c.size, color: changed ? "red" : "black" }}>
                          {val}
                        </td>
                      );
                    }
                    // ✅ 결제타입: payType (1:현금, 2:카드)
                    if (key === "payType") {
                      const curNum = parseNumMaybe(row.payType) ?? 2; // 기본 카드
                      const curStr = String(curNum);

                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={curStr}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) => {
                              const nextPayType = parseNumMaybe(e.target.value) ?? 2;

                              setMasterRows((prev) =>
                                prev.map((r, i) => {
                                  if (i !== rowIndex) return r;

                                  // ✅ payType이 카드면 cash_receipt_type은 무조건 3(미발급)
                                  if (nextPayType === 2) {
                                    return { ...r, payType: 2, cash_receipt_type: 3 };
                                  }

                                  // ✅ 현금이면 활성화만 (기존 증빙타입 유지, 없으면 3)
                                  const curCash = parseNumMaybe(r.cash_receipt_type);
                                  return { ...r, payType: 1, cash_receipt_type: curCash ?? 3 };
                                })
                              );
                            }}
                            sx={{
                              fontSize: 12,
                              height: 28,
                              "& .MuiSelect-select": { color: changed ? "red" : "black" },
                              "& .MuiSvgIcon-root": { color: changed ? "red" : "black" },
                            }}
                          >
                            {PAY_TYPES.map((opt) => (
                              <MenuItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </td>
                      );
                    }

                    // ✅ 증빙타입: cash_receipt_type (현금일 때만 활성화)
                    if (key === "cash_receipt_type") {
                      const payTypeNum = parseNumMaybe(row.payType) ?? 2;
                      const enabled = payTypeNum === 1;

                      // 카드(2)면 무조건 3 보이게
                      const curNum = enabled ? parseNumMaybe(row.cash_receipt_type) ?? 3 : 3;
                      const curStr = String(curNum);

                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={curStr}
                            disabled={!enabled}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) => {
                              const nextVal = parseNumMaybe(e.target.value) ?? 3;
                              handleMasterCellChange(rowIndex, "cash_receipt_type", nextVal);
                            }}
                            sx={{
                              fontSize: 12,
                              height: 28,
                              "& .MuiSelect-select": { color: changed ? "red" : "black" },
                              "& .MuiSvgIcon-root": { color: changed ? "red" : "black" },
                              ...(enabled
                                ? {}
                                : {
                                    bgcolor: "#f5f5f5",
                                    "& .MuiSelect-select": { color: "#888" },
                                  }),
                            }}
                          >
                            {CASH_RECEIPT_TYPES.map((opt) => (
                              <MenuItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </td>
                      );
                    }

                    // ✅ 카드번호: 수정 가능 (digits 저장, 표시만 하이픈)
                    if (key === "cardNo") {
                      const digits = onlyDigits(row.cardNo).slice(0, 16);
                      const display = formatCardNoFull(digits); // 0000-0000-0000-0000

                      return (
                        <td key={key} style={{ width: c.size }}>
                          <TextField
                            size="small"
                            fullWidth
                            value={display}
                            placeholder="0000-0000-0000-0000"
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) => {
                              const nextDigits = onlyDigits(e.target.value).slice(0, 16);
                              handleMasterCellChange(rowIndex, "cardNo", nextDigits);
                            }}
                            inputProps={{ style: { textAlign: "center", fontSize: 12 } }}
                            sx={{
                              "& .MuiInputBase-root": { height: 28, fontSize: 12 },
                              "& input": {
                                padding: "6px 8px",
                                color: changed ? "red" : "black",
                              },
                            }}
                          />
                        </td>
                      );
                    }

                    // ✅ 카드사: 수정 가능
                    if (key === "cardBrand") {
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <TextField
                            size="small"
                            fullWidth
                            value={row.cardBrand ?? ""}
                            placeholder="카드사"
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) =>
                              handleMasterCellChange(rowIndex, "cardBrand", e.target.value)
                            }
                            inputProps={{ style: { textAlign: "center", fontSize: 12 } }}
                            sx={{
                              "& .MuiInputBase-root": { height: 28, fontSize: 12 },
                              "& input": {
                                padding: "6px 8px",
                                color: changed ? "red" : "black",
                              },
                            }}
                          />
                        </td>
                      );
                    }

                    if (key === "receipt_type") {
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={normalizeReceiptTypeVal(row.receipt_type ?? "UNKNOWN")}
                            onChange={(e) =>
                              handleMasterCellChange(rowIndex, "receipt_type", e.target.value)
                            }
                            onClick={(ev) => ev.stopPropagation()}
                            displayEmpty
                            sx={{
                              fontSize: 12,
                              height: 28,
                              "& .MuiSelect-select": { color: changed ? "red" : "black" },
                              "& .MuiSvgIcon-root": { color: changed ? "red" : "black" },
                            }}
                          >
                            {RECEIPT_TYPES.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </td>
                      );
                    }

                    if (key === "receipt_image") {
                      const has = !!rawVal;
                      const inputId = `receipt-${row.client_id || row.sale_id || rowIndex}`;
                      const uploadBlocked = isSpecialAccount(row.account_id);

                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 1,
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              id={inputId}
                              style={{ display: "none" }}
                              disabled={uploadBlocked}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                handleImageUpload(f, rowIndex);
                                e.target.value = "";
                              }}
                            />

                            {has ? (
                              <>
                                <Tooltip title="다운로드">
                                  <IconButton
                                    size="small"
                                    sx={fileIconSx}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleDownload(rawVal);
                                    }}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title="미리보기(창)">
                                  <IconButton
                                    size="small"
                                    sx={fileIconSx}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleViewImage(rawVal);
                                    }}
                                  >
                                    <ImageSearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>

                                {!uploadBlocked && (
                                  <label htmlFor={inputId} onClick={(ev) => ev.stopPropagation()}>
                                    <MDButton component="span" size="small" color="info">
                                      재업로드
                                    </MDButton>
                                  </label>
                                )}

                                {uploadBlocked && (
                                  <Typography variant="caption" sx={{ color: "#888" }}>
                                    첨부불가
                                  </Typography>
                                )}
                              </>
                            ) : (
                              <>
                                {!uploadBlocked ? (
                                  <label htmlFor={inputId} onClick={(ev) => ev.stopPropagation()}>
                                    <MDButton component="span" size="small" color="info">
                                      업로드
                                    </MDButton>
                                  </label>
                                ) : (
                                  <Typography variant="caption" sx={{ color: "#888" }}>
                                    첨부불가
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        </td>
                      );
                    }

                    if (c.editable) {
                      return (
                        <td
                          key={key}
                          contentEditable
                          suppressContentEditableWarning
                          style={{ width: c.size, color: changed ? "red" : "black" }}
                          onBlur={(e) => {
                            const text = e.currentTarget.innerText.trim();

                            if (MASTER_NUMBER_KEYS.includes(key)) {
                              const n = parseNumber(text);
                              e.currentTarget.innerText = formatNumber(n);
                              handleMasterCellChange(rowIndex, key, n);
                              return;
                            }

                            handleMasterCellChange(rowIndex, key, text);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {val}
                        </td>
                      );
                    }

                    return (
                      <td key={key} style={{ width: c.size, color: changed ? "red" : "black" }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                {masterColumns.map((c, i) => {
                  if (i === 0) {
                    return (
                      <td key={c.key} style={{ width: c.size }}>
                        합계
                      </td>
                    );
                  }

                  if (c.key === "tax") {
                    return (
                      <td key={c.key} style={{ width: c.size }}>
                        {formatNumber(sumMasterTax)}
                      </td>
                    );
                  }
                  if (c.key === "vat") {
                    return (
                      <td key={c.key} style={{ width: c.size }}>
                        {formatNumber(sumMasterVat)}
                      </td>
                    );
                  }
                  if (c.key === "taxFree") {
                    return (
                      <td key={c.key} style={{ width: c.size }}>
                        {formatNumber(sumMasterTaxFree)}
                      </td>
                    );
                  }
                  if (c.key === "total") {
                    return (
                      <td key={c.key} style={{ width: c.size }}>
                        {formatNumber(sumMasterTotal)}
                      </td>
                    );
                  }

                  return <td key={c.key} style={{ width: c.size }} />;
                })}
              </tr>
            </tfoot>
          </table>
        </MDBox>

        {/* ========================= 하단(50%) 상세내역 ========================= */}
        <MDBox
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            border: "1px solid #ddd",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <MDBox
            sx={{
              px: 1,
              py: 0.8,
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              backgroundColor: "#fff",
            }}
          >
            <MDButton color="info" size="small" onClick={addDetailRow} sx={{ minWidth: 90 }}>
              행추가
            </MDButton>
          </MDBox>

          <MDBox
            ref={detailWrapRef}
            sx={{
              flex: 1,
              overflow: "auto",
              "& table": {
                borderCollapse: "separate",
                width: "max-content",
                minWidth: "100%",
                borderSpacing: 0,
              },
              "& tfoot td": {
                backgroundColor: "#fafafa",
                position: "sticky",
                bottom: 0,
                zIndex: 3,
                fontWeight: 700,
              },
              "& th, & td": {
                border: "1px solid #686D76",
                textAlign: "center",
                whiteSpace: "nowrap",
                fontSize: "12px",
                padding: "4px",
              },
              "& th": {
                backgroundColor: "#f0f0f0",
                position: "sticky",
                top: 0,
                zIndex: 2,
              },
            }}
          >
            <table key={`detail-${selectedMaster?.sale_id || "new"}-${detailRenderKey}`}>
              <thead>
                <tr>
                  {detailColumns.map((c) => (
                    <th key={c.key} style={{ width: c.size }}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {detailRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {detailColumns.map((c) => {
                      const key = c.key;
                      const rawVal = row[key] ?? "";
                      const orig = origDetailRows[rowIndex]?.[key];

                      const changed = row?.isNew
                        ? true
                        : isForcedRedRow(row)
                        ? true
                        : isDetailFieldChanged(key, orig, rawVal);

                      const isNumCol = DETAIL_NUMBER_KEYS.includes(key);
                      const displayVal = isNumCol ? formatNumber(rawVal) : String(rawVal ?? "");

                      if (c.type === "select") {
                        const curNum = parseNumMaybe(rawVal);
                        const curStr = curNum == null ? "" : String(curNum);

                        return (
                          <td key={key} style={{ width: c.size }}>
                            <Select
                              size="small"
                              fullWidth
                              value={curStr}
                              onChange={(e) =>
                                handleDetailCellChange(rowIndex, key, e.target.value)
                              }
                              onClick={(ev) => ev.stopPropagation()}
                              displayEmpty
                              sx={{
                                fontSize: 12,
                                height: 25,
                                "& .MuiSelect-select": { color: changed ? "red" : "black" },
                                "& .MuiSvgIcon-root": { color: changed ? "red" : "black" },
                              }}
                            >
                              <MenuItem value="">
                                <em>선택</em>
                              </MenuItem>
                              {c.options.map((opt) => (
                                <MenuItem key={opt.value} value={String(opt.value)}>
                                  {opt.value}:{opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                        );
                      }

                      if (c.editable) {
                        return (
                          <td
                            key={key}
                            contentEditable
                            suppressContentEditableWarning
                            style={{ width: c.size, color: changed ? "red" : "black" }}
                            onMouseDown={(ev) => {
                              if (!isNumCol) return;

                              const el = ev.currentTarget;
                              ev.preventDefault();

                              requestAnimationFrame(() => {
                                if (!el || !el.isConnected) return;

                                try {
                                  el.focus();
                                } catch (e) {
                                  // ignore
                                }

                                el.innerText = String(parseNumber(el.innerText) || "");
                                selectAllContent(el);
                              });
                            }}
                            onFocus={(ev) => {
                              if (!isNumCol) return;
                              const el = ev.currentTarget;

                              el.innerText = String(parseNumber(el.innerText) || "");
                              requestAnimationFrame(() => {
                                if (!el || !el.isConnected) return;
                                selectAllContent(el);
                              });
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                            onBlur={(e) => {
                              const text = e.currentTarget.innerText.trim();

                              if (isNumCol) {
                                const n = parseNumber(text);
                                e.currentTarget.innerText = formatNumber(n);
                                handleDetailCellChange(rowIndex, key, n);
                                return;
                              }
                              handleDetailCellChange(rowIndex, key, text);
                            }}
                          >
                            {displayVal}
                          </td>
                        );
                      }

                      return (
                        <td key={key} style={{ width: c.size, color: changed ? "red" : "black" }}>
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  {detailColumns.map((c, i) => {
                    if (i === 0) {
                      return (
                        <td key={c.key} style={{ width: c.size }}>
                          합계
                        </td>
                      );
                    }

                    if (c.key === "qty") {
                      return (
                        <td key={c.key} style={{ width: c.size }}>
                          {formatNumber(sumDetailQty)}
                        </td>
                      );
                    }

                    if (c.key === "amount") {
                      return (
                        <td key={c.key} style={{ width: c.size }}>
                          {formatNumber(sumDetailAmount)}
                        </td>
                      );
                    }

                    return <td key={c.key} style={{ width: c.size }} />;
                  })}
                </tr>
              </tfoot>
            </table>
          </MDBox>
        </MDBox>
      </MDBox>

      {/* ========================= ✅ 떠있는 창 미리보기 ========================= */}
      {viewerOpen && (
        <Box sx={{ position: "fixed", inset: 0, zIndex: 2000, pointerEvents: "none" }}>
          <Draggable
            nodeRef={viewerNodeRef}
            handle="#receipt-viewer-titlebar"
            bounds="parent"
            cancel={'button, a, input, textarea, select, img, [contenteditable="true"]'}
          >
            <Paper
              ref={viewerNodeRef}
              sx={{
                position: "absolute",
                top: 120,
                left: 120,
                m: 0,
                width: "450px",
                height: "650px",
                maxWidth: "95vw",
                maxHeight: "90vh",
                borderRadius: 1.2,
                border: "1px solid rgba(0,0,0,0.25)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                overflow: "hidden",
                resize: "both",
                pointerEvents: "auto",
                backgroundColor: "#000",
              }}
            >
              <Box
                id="receipt-viewer-titlebar"
                sx={{
                  height: 42,
                  bgcolor: "#1b1b1b",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  cursor: "move",
                  userSelect: "none",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    pr: 1,
                  }}
                >
                  {currentImg?.title || "영수증 미리보기"}
                  {imageItems.length ? `  (${viewerIndex + 1}/${imageItems.length})` : ""}
                </Typography>

                <Tooltip title="이전(←)">
                  <span>
                    <IconButton
                      size="small"
                      sx={{ color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                      }}
                      disabled={imageItems.length <= 1}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="다음(→)">
                  <span>
                    <IconButton
                      size="small"
                      sx={{ color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                      }}
                      disabled={imageItems.length <= 1}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="새 탭으로 열기">
                  <span>
                    <IconButton
                      size="small"
                      sx={{ color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const src = currentImg?.src;
                        if (src) window.open(src, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!currentImg?.src}
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="다운로드">
                  <span>
                    <IconButton
                      size="small"
                      sx={{ color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const path = currentImg?.path;
                        if (path) handleDownload(path);
                      }}
                      disabled={!currentImg?.path}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="닫기(ESC)">
                  <IconButton
                    size="small"
                    sx={{ color: "#fff" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseViewer();
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ height: "calc(100% - 42px)", bgcolor: "#000", position: "relative" }}>
                {currentImg?.src ? (
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={6}
                    centerOnInit
                    wheel={{ step: 0.12 }}
                    doubleClick={{ mode: "zoomIn" }}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        <Box
                          sx={{
                            position: "absolute",
                            right: 10,
                            top: 10,
                            zIndex: 3,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          <Tooltip title="확대">
                            <IconButton
                              size="small"
                              onClick={zoomIn}
                              sx={{ bgcolor: "rgba(255,255,255,0.15)" }}
                            >
                              <ZoomInIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="축소">
                            <IconButton
                              size="small"
                              onClick={zoomOut}
                              sx={{ bgcolor: "rgba(255,255,255,0.15)" }}
                            >
                              <ZoomOutIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="리셋">
                            <IconButton
                              size="small"
                              onClick={resetTransform}
                              sx={{ bgcolor: "rgba(255,255,255,0.15)" }}
                            >
                              <RestartAltIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <TransformComponent
                          wrapperStyle={{ width: "100%", height: "100%" }}
                          contentStyle={{ width: "100%", height: "100%" }}
                        >
                          <Box
                            sx={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <img
                              src={currentImg.src}
                              alt="미리보기"
                              style={{ maxWidth: "95%", maxHeight: "95%", userSelect: "none" }}
                            />
                          </Box>
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                ) : (
                  <Typography sx={{ color: "#fff", p: 2 }}>이미지가 없습니다.</Typography>
                )}
              </Box>
            </Paper>
          </Draggable>
        </Box>
      )}
    </DashboardLayout>
  );
}

export default AccountCorporateCardSheet;
