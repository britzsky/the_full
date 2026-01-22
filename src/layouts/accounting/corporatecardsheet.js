/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  Modal,
  Box,
  Select,
  MenuItem,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  TextField,
} from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete"; // ✅ 추가

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
import useCorporateCardData from "./data/CorporateCardData";

// ========================= 상수/유틸 =========================
const DEFAULT_CARD_BRAND = "IBK기업은행";

const CARD_BRANDS = [
  "IBK기업은행",
  "신한카드",
  "삼성카드",
  "현대카드",
  "KB국민카드",
  "하나카드",
  "우리카드",
  "롯데카드",
  "NH농협카드",
  "BC카드",
  "기타",
];

// ✅ 영수증 타입(상단 테이블용)
const RECEIPT_TYPES = [
  // { value: "CARD_SLIP_GENERIC", label: "카드전표" },
  { value: "coupang", label: "쿠팡" },
  { value: "gmarket", label: "G마켓" },
  { value: "11post", label: "11번가" },
  { value: "naver", label: "네이버" },
  { value: "homeplus", label: "홈플러스" },
];

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
const cleanCardRow = (r) => {
  const { isNew, ...rest } = r;
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
const MASTER_NUMBER_KEYS = ["total", "vat", "taxFree", "totalCard"];

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

function CorporateCardSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    loading,
    activeRows,
    accountList,
    fetchHeadOfficeCorporateCardList,
    paymentRows,
    fetchHeadOfficeCorporateCardPaymentList,
    paymentDetailRows,
    fetchHeadOfficeCorporateCardPaymentDetailList,
    fetchAccountList,
  } = useCorporateCardData();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [masterRows, setMasterRows] = useState([]);
  const [origMasterRows, setOrigMasterRows] = useState([]);

  const [detailRows, setDetailRows] = useState([]);
  const [origDetailRows, setOrigDetailRows] = useState([]);

  const [selectedMaster, setSelectedMaster] = useState(null);

  // ✅ 거래처 검색조건
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // ✅ 스캔된 상세 item 은 무조건 빨간 글씨
  const isForcedRedRow = (row) => !!row?.isForcedRed;

  // ✅ 스크롤 ref
  const masterWrapRef = useRef(null);
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

  const fileIconSx = { color: "#1e88e5" };
  const [cardNoEditingIndex, setCardNoEditingIndex] = useState(null);

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

  // accountList 로딩 후 기본 선택값
  useEffect(() => {
    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  // ========================= 조회 =========================
  const handleFetchMaster = useCallback(async () => {
    if (!selectedAccountId) return;
    await fetchHeadOfficeCorporateCardPaymentList({ year, month, account_id: selectedAccountId });
  }, [fetchHeadOfficeCorporateCardPaymentList, year, month, selectedAccountId]);

  // ✅ 거래처/연/월 변경 시 자동 조회 + 카드목록도 재조회
  useEffect(() => {
    if (!selectedAccountId) return;

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);

    skipPendingNewMergeRef.current = true;

    fetchHeadOfficeCorporateCardList(selectedAccountId);
    handleFetchMaster();
  }, [selectedAccountId, year, month, fetchHeadOfficeCorporateCardList, handleFetchMaster]);

  // ✅ 거래처(account_id) 무관: 전체 카드 목록
  const cardsAll = useMemo(() => {
    const list = (activeRows || []).filter((r) => String(r.del_yn || "N") !== "Y");

    const arr = list.map((r) => ({
      card_no: onlyDigits(r.card_no ?? r.cardNo ?? ""),
      card_brand: r.card_brand ?? r.cardBrand ?? DEFAULT_CARD_BRAND,
    }));

    // 중복 제거
    const seen = new Set();
    return arr.filter((x) => {
      const key = `${x.card_brand}|${x.card_no}`;
      if (!x.card_no) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeRows]);

  const accountNameById = useMemo(() => {
    const m = new Map();
    (accountList || []).forEach((a) => m.set(String(a.account_id), a.account_name));
    return m;
  }, [accountList]);

  // ✅ (추가) Autocomplete 옵션/값
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((a) => ({
        value: String(a.account_id),
        label: a.account_name,
      })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  // ✅ 서버 paymentRows 갱신 시
  useEffect(() => {
    const serverRows = (paymentRows || []).map((r) => ({ ...r }));

    setMasterRows((prev) => {
      const keepNew = !skipPendingNewMergeRef.current;
      const pendingNew = keepNew ? (prev || []).filter((r) => r?.isNew) : [];
      skipPendingNewMergeRef.current = false;
      return [...serverRows, ...pendingNew];
    });

    setOrigMasterRows(serverRows);

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);

    setMasterRenderKey((k) => k + 1);
  }, [paymentRows]);

  // ✅ 상세 rows 갱신 시
  useEffect(() => {
    const copy = (paymentDetailRows || []).map((r) => ({
      ...r,
      isForcedRed: false,
      isNew: false,
    }));
    setDetailRows(copy);
    setOrigDetailRows(copy);

    setDetailRenderKey((k) => k + 1);
  }, [paymentDetailRows]);

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

  // ✅ 카드 선택
  const handleCardSelect = useCallback(
    (rowIndex, cardNoDigits) => {
      const digits = onlyDigits(cardNoDigits);

      setMasterRows((prev) => {
        const picked = cardsAll.find((o) => o.card_no === digits);

        return prev.map((r, i) => {
          if (i !== rowIndex) return r;
          return {
            ...r,
            cardNo: picked?.card_no || digits,
            cardBrand: picked?.card_brand || r.cardBrand || DEFAULT_CARD_BRAND,
          };
        });
      });
    },
    [cardsAll]
  );

  // ✅ 행추가(상단)
  const addMasterRow = useCallback(() => {
    if (!selectedAccountId) {
      return Swal.fire("안내", "거래처를 먼저 선택해주세요.", "info");
    }

    const paymentDtDefault = defaultPaymentDtForYM(year, month);
    const options = cardsAll || [];
    const auto = options.length === 1 ? options[0] : null;

    const newRow = {
      client_id: makeTempId(),
      sale_id: "",

      account_id: selectedAccountId,
      payment_dt: paymentDtDefault,

      use_name: "",
      bizNo: "",
      total: 0,
      vat: 0,
      taxFree: 0,
      totalCard: 0,
      cardNo: auto?.card_no || "",
      cardBrand: auto?.card_brand || DEFAULT_CARD_BRAND,

      // ✅ 영수증 타입(추가)
      receipt_type: "coupang",

      receipt_image: "",
      note: "",
      reg_dt: "",
      user_id: localStorage.getItem("user_id") || "",

      isNew: true,
    };

    setMasterRows((prev) => [...prev, newRow]);
    requestAnimationFrame(() => scrollMasterToBottom(true));
  }, [year, month, scrollMasterToBottom, selectedAccountId, cardsAll]);

  // ✅ (추가) 행추가(하단) - 선택된 상단 sale_id로 상세행 추가
  const addDetailRow = useCallback(() => {
    if (!selectedMaster) {
      return Swal.fire("안내", "상단 결제내역에서 행을 먼저 선택해주세요.", "info");
    }
    const sid = String(selectedMaster.sale_id || "").trim();
    if (!sid) {
      // 저장 전 임시행이면 sale_id가 없을 가능성이 큼
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
    // index 정렬을 위해 orig에도 placeholder 추가
    setOrigDetailRows((prev) => [...(prev || []), {}]);
    setDetailRenderKey((k) => k + 1);

    requestAnimationFrame(() => scrollDetailToBottom(true));
  }, [selectedMaster, scrollDetailToBottom]);

  // ========================= 영수증 업로드/스캔 =========================
  const handleImageUpload = useCallback(
    async (file, rowIndex) => {
      if (!file) return;

      const row = masterRows[rowIndex] || {};
      const acctOk = !!String(row.account_id || "");
      const cardOk = !!onlyDigits(row.cardNo);
      const typeOk = !!String(row.receipt_type || ""); // ✅ 타입 필수

      if (!acctOk || !cardOk) {
        return Swal.fire(
          "경고",
          "영수증 업로드 전에 거래처와 카드번호를 먼저 선택해주세요.",
          "warning"
        );
      }

      // ✅ 타입 선택 강제
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
        // ✅ 여기로 전달
        formData.append("type", row.receipt_type);
        formData.append("objectValue", row.account_id);
        formData.append("folderValue", "acnCorporate");
        formData.append("cardNo", row.cardNo);
        formData.append("cardBrand", row.cardBrand);
        formData.append("saveType", "headoffice");
        formData.append("receiptType", row.receipt_type);

        const res = await api.post("/Corporate/receipt-scan", formData, {
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
          ...(main.payment_dt != null ? { payment_dt: main.payment_dt } : {}),
          ...(main.use_name != null ? { use_name: main.use_name } : {}),
          ...(main.bizNo != null ? { bizNo: main.bizNo } : {}),
          ...(main.total != null ? { total: parseNumber(main.total) } : {}),
          ...(main.vat != null ? { vat: parseNumber(main.vat) } : {}),
          ...(main.taxFree != null ? { taxFree: parseNumber(main.taxFree) } : {}),
          ...(main.totalCard != null ? { totalCard: parseNumber(main.totalCard) } : {}),
          ...(main.cardNo != null ? { cardNo: main.cardNo } : {}),
          ...(main.cardBrand != null ? { cardBrand: main.cardBrand } : {}),
          ...(main.receipt_image != null ? { receipt_image: main.receipt_image } : {}),
          ...(main.receipt_type != null ? { receipt_type: main.receipt_type } : {}),
        };

        // ✅ 상단 반영
        setMasterRows((prev) =>
          prev.map((r, i) => {
            if (i !== rowIndex) return r;
            return {
              ...r,
              ...patch,
              account_id: patch.account_id !== undefined ? patch.account_id : r.account_id ?? "",
            };
          })
        );

        // ✅ 하단 반영(스캔된 항목은 무조건 빨간 글씨)
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
        const newPayDt = patch.payment_dt ?? row.payment_dt;

        if (newSaleId) {
          await fetchHeadOfficeCorporateCardPaymentDetailList({
            sale_id: newSaleId,
            account_id: newAcct,
            payment_dt: newPayDt,
          });
        }
      } catch (err) {
        Swal.close();
        Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
      }
    },
    [masterRows, handleFetchMaster, fetchHeadOfficeCorporateCardPaymentDetailList]
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

    // ✅ receipt_type 항상 포함(없으면 기본값)
    row.receipt_type = String(row.receipt_type ?? r.receipt_type ?? "coupang");

    MASTER_NUMBER_KEYS.forEach((k) => {
      if (row[k] !== undefined) row[k] = parseNumber(row[k]);
    });

    return row;
  }, []);

  const saveAll = useCallback(async () => {
    // ✅ 선택된 상단행의 account_id / payment_dt 확보(최신 masterRows 기준으로 보정)
    const selectedSaleId = String(selectedMaster?.sale_id || "").trim();

    const selectedTopRow =
      (selectedSaleId
        ? (masterRows || []).find((r) => String(r.sale_id || "") === selectedSaleId)
        : null) || selectedMaster;

    const topAccountId = selectedTopRow?.account_id ?? "";
    const topPaymentDt = selectedTopRow?.payment_dt ?? "";

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
      .filter(Boolean);

    const item = detailRows
      .map((r, i) => {
        // ✅ 신규 상세행은 무조건 저장 대상
        if (r?.isNew) {
          return {
            ...cleanDetailRow(r),
            account_id: topAccountId,
            payment_dt: topPaymentDt,
          };
        }

        // ✅ 스캔(강제 빨강)은 무조건 저장 대상
        if (isForcedRedRow(r)) {
          return {
            ...cleanDetailRow(r),
            account_id: topAccountId,
            payment_dt: topPaymentDt,
          };
        }

        const o = origDetailRows[i] || {};
        const changed = Object.keys(r).some((k) => isDetailFieldChanged(k, o[k], r[k]));

        return changed
          ? {
              ...cleanDetailRow(r),
              account_id: topAccountId,
              payment_dt: topPaymentDt,
            }
          : null;
      })
      .filter(Boolean);

    if (main.length === 0 && item.length === 0) {
      return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
    }

    // ✅ 선택된 상단행이 없으면 item 저장은 막는 게 안전
    if (item.length > 0 && (!topAccountId || !topPaymentDt)) {
      return Swal.fire(
        "안내",
        "하단 상세 저장을 위해 상단 결제내역을 먼저 클릭해서 선택해주세요.",
        "info"
      );
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
        "/Account/HeadOfficeCorporateCardPaymentAllSave",
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
        await fetchHeadOfficeCorporateCardPaymentDetailList({
          sale_id: selectedMaster.sale_id,
          account_id: selectedMaster.account_id,
          payment_dt: selectedMaster.payment_dt,
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
    fetchHeadOfficeCorporateCardPaymentDetailList,
    origMasterBySaleId,
    normalizeMasterForSave,
  ]);

  // ========================= ✅ "윈도우"처럼 이동 가능한 이미지 뷰어 =========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ✅ (추가) Draggable nodeRef
  const viewerNodeRef = useRef(null);

  // ✅ 테이블에 있는 영수증 이미지 목록(순서대로)
  const imageItems = useMemo(() => {
    return (masterRows || [])
      .filter((r) => !!r?.receipt_image)
      .map((r) => ({
        path: r.receipt_image,
        src: `${API_BASE_URL}${r.receipt_image}`,
        title: `${r.use_name || ""} ${toDateInputValue(r.payment_dt) || ""}`.trim(),
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

  // ✅ 이미지 목록이 바뀌면 index 보정
  useEffect(() => {
    if (!viewerOpen) return;
    if (!imageItems.length) {
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > imageItems.length - 1) setViewerIndex(imageItems.length - 1);
  }, [viewerOpen, imageItems.length, viewerIndex]);

  // ✅ 키보드로 이동(좌/우/ESC) - 입력 중에는 방해 안되게
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

  // ========================= 법인카드관리 모달 =========================
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardRows, setCardRows] = useState([]);
  const [origCardRows, setOrigCardRows] = useState([]);

  const openCardModal = useCallback(async () => {
    setCardModalOpen(true);

    const acct =
      selectedAccountId || (accountList?.[0]?.account_id ? String(accountList[0].account_id) : "");

    if (acct) {
      await fetchHeadOfficeCorporateCardList(acct);
    }
  }, [fetchHeadOfficeCorporateCardList, selectedAccountId, accountList]);

  useEffect(() => {
    if (!cardModalOpen) return;
    const copy = (activeRows || []).map((r) => ({ ...r }));
    setCardRows(copy);
    setOrigCardRows(copy);
  }, [activeRows, cardModalOpen]);

  const closeCardModal = () => setCardModalOpen(false);

  const addCardRow = useCallback(() => {
    setCardRows((prev) => [
      ...prev,
      {
        idx: null,
        card_brand: DEFAULT_CARD_BRAND,
        card_no: "",
        del_yn: "N",
        isNew: true,
      },
    ]);
  }, []);

  const handleCardCell = useCallback((rowIndex, key, value) => {
    setCardRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  }, []);

  const saveCardModal = useCallback(async () => {
    const invalid = cardRows.find((r) => {
      const brandOk = !!r.card_brand;
      const noOk = !!onlyDigits(r.card_no);
      return !(brandOk && noOk);
    });

    if (invalid) {
      return Swal.fire("경고", "카드사, 카드번호는 필수입니다.", "warning");
    }

    try {
      const payload = cardRows.map((r) => ({
        ...cleanCardRow(r),
        card_no: onlyDigits(r.card_no),
        del_yn: r.del_yn ?? "N",
        user_id: localStorage.getItem("user_id"),
      }));

      const res = await api.post("/Account/HeadOfficeCorporateCardSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.code === 200 || res.status === 200) {
        Swal.fire("성공", "저장되었습니다.", "success");
        if (selectedAccountId) await fetchHeadOfficeCorporateCardList(selectedAccountId);
      } else {
        Swal.fire("실패", res.data?.message || "저장 실패", "error");
      }
    } catch (e) {
      Swal.fire("오류", e.message || "저장 중 오류", "error");
    }
  }, [cardRows, fetchHeadOfficeCorporateCardList, selectedAccountId]);

  // ========================= 컬럼 정의 =========================
  const masterColumns = useMemo(
    () => [
      { header: "거래처", key: "account_id", editable: false, size: 180 },
      { header: "결제일자", key: "payment_dt", editable: true, editType: "date", size: 130 },
      { header: "사용처", key: "use_name", editable: true, size: 140 },
      { header: "사업자번호", key: "bizNo", editable: true, size: 120 },
      { header: "부가세", key: "vat", editable: true, size: 90 },
      { header: "면세", key: "taxFree", editable: true, size: 90 },
      { header: "과세", key: "tax", editable: true, size: 90 },
      { header: "합계금액", key: "total", editable: true, size: 110 },
      { header: "카드번호", key: "cardNo", editable: false, size: 200 },
      { header: "카드사", key: "cardBrand", editable: false, size: 130 },
      // ✅ 영수증타입(영수증사진 왼쪽)
      {
        header: "영수증타입",
        key: "receipt_type",
        editable: true,
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
        <DashboardNavbar title="💳 거래처 법인카드 관리" />
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
            {/* ✅ 거래처 검색 가능한 Autocomplete */}
            <Autocomplete
              size="small"
              sx={{ minWidth: 200 }}
              options={accountOptions}
              value={selectedAccountOption}
              onChange={(_, opt) => setSelectedAccountId(opt ? opt.value : "")}
              getOptionLabel={(opt) => opt?.label ?? ""}
              isOptionEqualToValue={(opt, val) => opt.value === val.value}
              filterOptions={(options, state) => {
                const q = (state.inputValue ?? "").trim().toLowerCase();
                if (!q) return options;
                return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
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

            <MDButton
              variant="gradient"
              color="info"
              onClick={openCardModal}
              sx={{ minWidth: 120 }}
            >
              법인카드관리
            </MDButton>
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
                    if (!row.sale_id) {
                      setSelectedMaster(row);
                      return;
                    }

                    setSelectedMaster(row);
                    await fetchHeadOfficeCorporateCardPaymentDetailList({
                      sale_id: row.sale_id,
                      account_id: row.account_id,
                      payment_dt: row.payment_dt,
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

                    if (key === "payment_dt") {
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
                              handleMasterCellChange(rowIndex, "payment_dt", e.target.value)
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

                    if (key === "cardNo") {
                      const options = cardsAll || [];
                      const disabled = options.length === 0;

                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={onlyDigits(row.cardNo) || ""}
                            onChange={(e) => handleCardSelect(rowIndex, e.target.value)}
                            onClick={(ev) => ev.stopPropagation()}
                            displayEmpty
                            disabled={disabled}
                            sx={{ fontSize: 12, height: 28 }}
                          >
                            <MenuItem value="">
                              <em>{disabled ? "등록된 카드 없음" : "카드 선택"}</em>
                            </MenuItem>

                            {options.map((opt) => (
                              <MenuItem
                                key={`${opt.card_brand}-${opt.card_no}`}
                                value={opt.card_no}
                              >
                                {opt.card_brand} / {maskCardNo(opt.card_no)}
                              </MenuItem>
                            ))}
                          </Select>
                        </td>
                      );
                    }

                    if (key === "cardBrand") {
                      return (
                        <td key={key} style={{ width: c.size, color: changed ? "red" : "black" }}>
                          {row.cardBrand || ""}
                        </td>
                      );
                    }

                    // ✅ 영수증타입 Select
                    if (key === "receipt_type") {
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={String(row.receipt_type ?? "coupang")}
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

                                <label htmlFor={inputId} onClick={(ev) => ev.stopPropagation()}>
                                  <MDButton component="span" size="small" color="info">
                                    재업로드
                                  </MDButton>
                                </label>
                              </>
                            ) : (
                              <label htmlFor={inputId} onClick={(ev) => ev.stopPropagation()}>
                                <MDButton component="span" size="small" color="info">
                                  업로드
                                </MDButton>
                              </label>
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
            </table>
          </MDBox>
        </MDBox>
      </MDBox>

      {/* ========================= ✅ 떠있는 창 미리보기: 뒤 테이블 입력 가능 ========================= */}
      {viewerOpen && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            pointerEvents: "none",
          }}
        >
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
                              style={{
                                maxWidth: "95%",
                                maxHeight: "95%",
                                userSelect: "none",
                              }}
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

      {/* ========================= 법인카드관리 모달 ========================= */}
      <Modal open={cardModalOpen} onClose={closeCardModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 900,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
              gap: 1,
            }}
          >
            <Typography variant="h6">법인카드관리</Typography>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "right", gap: 1 }}
            >
              <MDButton color="info" size="small" onClick={addCardRow}>
                행추가
              </MDButton>
            </Box>
          </Box>

          <Box
            sx={{
              "& table": { width: "100%", borderCollapse: "collapse" },
              "& th, & td": {
                border: "1px solid #686D76",
                padding: "6px",
                fontSize: "12px",
                textAlign: "center",
              },
              "& th": {
                background: "#f0f0f0",
                position: "sticky",
                top: 0,
                zIndex: 1,
              },
            }}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>카드사</th>
                  <th style={{ width: 240 }}>카드번호</th>
                  <th style={{ width: 120 }}>삭제여부</th>
                </tr>
              </thead>

              <tbody>
                {cardRows.map((row, idx) => {
                  const brandChanged = isChangedValue(
                    origCardRows[idx]?.card_brand,
                    row.card_brand
                  );
                  const noChanged = isChangedValue(origCardRows[idx]?.card_no, row.card_no);
                  const delChanged = isChangedValue(origCardRows[idx]?.del_yn, row.del_yn);

                  return (
                    <tr key={row.idx ?? `new_${idx}`}>
                      <td style={{ color: brandChanged ? "red" : "black" }}>
                        <Select
                          size="small"
                          fullWidth
                          value={row.card_brand ?? DEFAULT_CARD_BRAND}
                          onChange={(e) => handleCardCell(idx, "card_brand", e.target.value)}
                        >
                          {CARD_BRANDS.map((b) => (
                            <MenuItem key={b} value={b}>
                              {b}
                            </MenuItem>
                          ))}
                        </Select>
                      </td>

                      <td style={{ color: noChanged ? "red" : "black" }}>
                        <Tooltip title={formatCardNoFull(row.card_no)} arrow>
                          <TextField
                            size="small"
                            fullWidth
                            value={
                              cardNoEditingIndex === idx
                                ? formatCardNoFull(row.card_no)
                                : maskCardNo(row.card_no)
                            }
                            onFocus={() => setCardNoEditingIndex(idx)}
                            onBlur={() => setCardNoEditingIndex(null)}
                            onChange={(e) => {
                              const digits = onlyDigits(e.target.value).slice(0, 16);
                              handleCardCell(idx, "card_no", digits);
                            }}
                            placeholder="카드번호 입력"
                            inputProps={{ inputMode: "numeric", maxLength: 19 }}
                          />
                        </Tooltip>
                      </td>

                      <td style={{ color: delChanged ? "red" : "black" }}>
                        <Select
                          size="small"
                          fullWidth
                          value={row.del_yn ?? "N"}
                          onChange={(e) => handleCardCell(idx, "del_yn", e.target.value)}
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
          </Box>

          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={closeCardModal}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" onClick={saveCardModal} sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default CorporateCardSheet;
