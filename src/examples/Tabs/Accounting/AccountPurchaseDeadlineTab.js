import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Grid,
  TextField,
  useTheme,
  useMediaQuery,
  Box,
  Select,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete";

import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import "dayjs/locale/ko";
import { koKR } from "@mui/x-date-pickers/locales";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import { API_BASE_URL } from "config";
import ExcelJS from "exceljs";
import PreviewOverlay from "utils/PreviewOverlay";
import useAccountPurchaseDeadlineData from "./accountPurchaseDeadlineData";

// ✅ 하단(상세) 훅 추가
import useAccountPurchaseDeadlineDetailData from "./accountPurchaseDeadlineDetailData";

// ✅ type=1000 (법인카드) 영수증 타입
const RECEIPT_TYPES_1000 = [
  { value: "UNKNOWN", label: "알수없음" },
  { value: "CARD_SLIP_GENERIC", label: "카드전표" },
  { value: "MART_ITEMIZED", label: "마트" },
  { value: "CONVENIENCE", label: "편의점" },
  { value: "COUPANG_APP", label: "배달앱" },
];

// ✅ type=1002, 1003 (온라인몰) 영수증 타입
const RECEIPT_TYPES_ONLINE = [
  { value: "coupang", label: "쿠팡" },
  { value: "gmarket", label: "G마켓" },
  { value: "11post", label: "11번가" },
  { value: "naver", label: "네이버" },
  { value: "homeplus", label: "홈플러스" },
  { value: "auction", label: "옥션" },
  { value: "daiso", label: "다이소" },
  { value: "MART_ITEMIZED", label: "마트" },
  { value: "CONVENIENCE", label: "편의점" },
];

// ✅ 기타 type (1000/1002/1003 아닌 모든 type) 영수증 타입
const RECEIPT_TYPES_ETC = [
  { value: "UNKNOWN", label: "알수없음" },
  { value: "TRANSACTION", label: "거래명세표(서)" },
  { value: "MART_ITEMIZED", label: "마트" },
];

// type 값 → 해당 RECEIPT_TYPES 배열 반환
const getReceiptTypesByType = (type) => {
  const t = String(type ?? "");
  if (t === "1000") return RECEIPT_TYPES_1000;
  if (t === "1002" || t === "1003") return RECEIPT_TYPES_ONLINE;
  return RECEIPT_TYPES_ETC;
};

// ✅ 모든 가능한 값 집합 (정규화 용도)
const ALL_RECEIPT_VALUES = new Set([
  ...RECEIPT_TYPES_1000,
  ...RECEIPT_TYPES_ONLINE,
  ...RECEIPT_TYPES_ETC,
].map((it) => String(it.value)));

// ✅ 하단 셀렉트 옵션
const DETAIL_TAX_TYPES = [
  { value: "1", label: "과세" },
  { value: "2", label: "면세" },
  { value: "3", label: "알수없음" },
];

// 하단 상세 상품구분 옵션
const DETAIL_ITEM_TYPES = [
  { value: "1", label: "식재료" },
  { value: "2", label: "소모품" },
  { value: "3", label: "경관식" },
];

// 영수증 업로드 버튼 너비 (px)
const RECEIPT_UPLOAD_BTN_WIDTH = 78;


// 숫자 입력 전용: onInput에서 비숫자 즉시 제거 (한글 모음·자음 포함)
const onNumInput = (e) => {
  const el = e.currentTarget;
  const prev = el.value;
  const next = prev.replace(/[^\d\-,]/g, "");
  if (prev === next) return;
  const pos = Math.max(0, (el.selectionStart ?? prev.length) - (prev.length - next.length));
  el.value = next;
  try { el.setSelectionRange(pos, pos); } catch (_) { }
};

// ✅ contentEditable: 입력 중 커서를 오른쪽에 고정 (글씨는 왼쪽으로 밀림)
const keepEditableTailVisible = (el) => {
  if (!el) return;
  requestAnimationFrame(() => {
    if (!el || !el.isConnected) return;
    el.scrollLeft = el.scrollWidth;
  });
};

// ✅ contentEditable: 클릭 시 전체선택 (바로 덮어쓰기 가능)
const selectAllContent = (el) => {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
};

// ✅ receipt_type 값 정규화 (type에 무관하게 known value면 그대로, 아니면 기본값)
const normalizeReceiptTypeVal = (v, rowType) => {
  const raw = String(v ?? "").replace(/\u00A0/g, " ").trim();
  const s = raw.toLowerCase();

  if (ALL_RECEIPT_VALUES.has(raw)) return raw;

  // 텍스트 → value 매핑
  if (s.includes("옥션") || s.includes("auction")) return "auction";
  if (s.includes("11번가") || s.includes("11st") || s.includes("11post")) return "11post";
  if (s.includes("g마켓") || s.includes("gmarket")) return "gmarket";
  if (s.includes("편의점") || s === "convenience") return "CONVENIENCE";
  if (s.includes("마트") || s === "mart_itemized" || s === "mart") return "MART_ITEMIZED";
  if (s.includes("쿠팡앱") || s === "coupang_app") return "COUPANG_APP";
  if (s.includes("쿠팡") || s.includes("coupang")) return "coupang";
  if (s.includes("네이버") || s.includes("naver")) return "naver";
  if (s.includes("홈플러스") || s.includes("homeplus")) return "homeplus";
  if (s.includes("다이소") || s.includes("daiso")) return "daiso";
  if (s.includes("카드전표") || s === "card_slip_generic") return "CARD_SLIP_GENERIC";
  if (s.includes("거래명세") || s === "transaction") return "TRANSACTION";
  if (s.includes("알수없음") || s === "unknown") return "UNKNOWN";
  if (s.includes("배달") || s === "coupang_app") return "COUPANG_APP";

  // 기본값: type에 맞는 첫 번째 옵션
  const opts = getReceiptTypesByType(rowType);
  return opts[0]?.value ?? "UNKNOWN";
};

// 거래처 업종 문자열 → 숫자 코드 변환 (타입 옵션 보정용)
const resolveAccountTypeCode = (v) => {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;

  if (raw.includes("요양")) return "1";
  if (raw.includes("도소매")) return "2";
  if (raw.includes("프랜차이즈")) return "3";
  if (raw.includes("산업")) return "4";
  if (raw.includes("학교")) return "5";
  return "";
};

function AccountPurchaseDeadlineTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  const isMobileTabletLandscape = useMediaQuery(
    "(max-width:1279.95px) and (orientation: landscape)"
  );
  // 모바일/태블릿에서는 상단/하단 패널이 최소 높이 이상 보이도록 고정
  const splitPanelMinHeight = isMobileTabletLandscape ? 260 : isMobileTablet ? 320 : 0;
  const splitContainerMinHeight = isMobileTablet ? splitPanelMinHeight * 2 + 24 : undefined;

  // ✅ 조회조건 상태
  const now = new Date();
  const [filters, setFilters] = useState({
    type: "0", // 타입
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    account_id: "", // 거래처 (account_id)
    payType: "0", // 조회구분
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);
  const accountInputRef = useRef("");
  const masterWrapRef = useRef(null);
  const detailWrapRef = useRef(null);
  const fileInputRefs = useRef({});
  const masterRowsRef = useRef([]);
  const qtyRefs = useRef({});
  const unitPriceRefs = useRef({});

  // 저장 성공 후 상단 선택 복원/스크롤에 사용하는 렌더 대기 함수
  const waitForNextPaint = useCallback(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
    []
  );

  // sale_id로 상단 행 DOM을 찾는다.
  const findMasterRowElementBySaleId = useCallback((saleId) => {
    const sid = String(saleId ?? "").trim();
    if (!sid || !masterWrapRef.current) return null;
    const rowEls = masterWrapRef.current.querySelectorAll("tbody tr");
    for (const rowEl of rowEls) {
      if (String(rowEl.getAttribute("data-sale-id") ?? "") === sid) return rowEl;
    }
    return null;
  }, []);

  // 상단 행을 실제 클릭한 것과 동일하게 동작시킨다.
  const triggerMasterRowClickBySaleId = useCallback(
    (saleId) => {
      const targetRow = findMasterRowElementBySaleId(saleId);
      if (!targetRow) return false;
      targetRow.click();
      return true;
    },
    [findMasterRowElementBySaleId]
  );

  // 저장 완료 후 성공 팝업 확인 시점에 상단 선택 복원 + 하단 재조회를 수행한다.
  const restoreMasterSelectionAfterSave = useCallback(
    async (saleId, keepScrollTop = null) => {
      const sid = String(saleId ?? "").trim();
      if (!sid) return;
      for (let retry = 0; retry < 6; retry += 1) {
        await waitForNextPaint();
        const clicked = triggerMasterRowClickBySaleId(sid);
        if (!clicked) continue;
        if (typeof keepScrollTop === "number" && masterWrapRef.current) {
          masterWrapRef.current.scrollTop = keepScrollTop;
        }
        return;
      }
    },
    [waitForNextPaint, triggerMasterRowClickBySaleId]
  );

  // 타입 옵션 변경 시 현재 선택값 유지 또는 첫 번째 옵션으로 보정
  const resolveNextType = useCallback((opts, currentType, accountTypeCode = "") => {
    const cur = String(currentType ?? "");
    const accountType = String(accountTypeCode ?? "");
    if (opts?.some((o) => o.value === cur)) return cur;
    if (accountType && opts?.some((o) => o.value === accountType)) return accountType;
    if (opts?.length) return String(opts[0].value);
    return accountType || cur || "";
  }, []);

  // ✅ (상단) 데이터 훅 사용
  const {
    rows, setRows, originalRows, setOriginalRows, loading, fetchPurchaseList,
    typeOptions, setTypeOptions, typeLoading, fetchTypeOptions,
  } = useAccountPurchaseDeadlineData();

  // =========================
  // ✅ (하단) 상세 테이블 훅/상태
  // =========================
  const {
    detailRows,
    setDetailRows,
    originalDetailRows,
    setOriginalDetailRows,
    detailLoading,
    setDetailLoading,
    fetchPurchaseDetailList,
  } = useAccountPurchaseDeadlineDetailData();

  // 선택된 상단 행 식별자 및 인덱스
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedMasterIndex, setSelectedMasterIndex] = useState(-1);
  // 테이블 강제 리렌더링용 키 (defaultValue 기반 input 초기화 시 사용)
  const [masterTableKey, setMasterTableKey] = useState(0);
  const [detailTableKey, setDetailTableKey] = useState(0);

  // 미저장 하단 변경 누적 보관소: sale_id → detailRows 배열
  // 다른 상단 행으로 이동해도 수정값을 유지하기 위한 임시 저장소
  const [pendingDetailMap, setPendingDetailMap] = useState(new Map());

  // =========================================
  // ✅ 금액 키들: 화면에는 콤마, 저장은 콤마 제거
  // =========================================
  const MONEY_KEYS = useMemo(
    () => ["vat", "taxFree", "tax", "total", "totalCash", "totalCard"],
    []
  );
  const DETAIL_MONEY_KEYS = useMemo(() => ["qty", "unitPrice", "amount", "tax", "vat"], []);

  // 콤마·공백 제거 (숫자 비교 및 저장 시 사용)
  const stripComma = useCallback((v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/,/g, "").replace(/\s+/g, "").trim();
  }, []);

  // 숫자 → 콤마 포맷 (화면 표시용)
  const formatComma = useCallback(
    (v) => {
      const raw = stripComma(v);
      if (raw === "") return "";
      const num = Number(raw);
      if (!Number.isFinite(num)) return String(v);
      return num.toLocaleString("ko-KR");
    },
    [stripComma]
  );

  // 포맷·보정은 accountPurchaseDeadlineData.js의 fetchPurchaseList에서 처리됨

  // ✅ 최초 로딩: 거래처 목록 조회 + 첫 번째 거래처 자동 선택 & 자동 조회
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      try {
        const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
        const list = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          account_type: item.account_type,
          account_type_code: resolveAccountTypeCode(item.account_type),
        }));
        setAccountList(list);

        if (list.length > 0) {
          const firstId = String(list[0].account_id);
          const firstTypeCode = String(list[0].account_type_code ?? "");

          // ✅ 1) 거래처 먼저 세팅
          const base = { ...filters, account_id: firstId, type: "0" };

          // ✅ 2) 거래처 기준으로 타입 옵션 조회
          const opts = await fetchTypeOptions(firstId);

          // ✅ 3) 현재 type이 옵션에 없으면 첫 번째 옵션으로 보정
          const nextType = resolveNextType(opts, base.type, firstTypeCode);

          const next = { ...base, type: nextType };
          setFilters(next);

          // ✅ 4) 조회
          fetchPurchaseList(next);
        }
      } catch (err) {
        console.error("데이터 조회 실패 (AccountList):", err);
      }
    })();
  }, []); // ✅ 의도적으로 1회만

  // ✅ 조회조건 변경 (기본 TextField용)
  const handleFilterChange = async (e) => {
    const { name, value } = e.target;
    if (name === "type" || name === "payType") {
      if (hasDirtyRowsEarly()) {
        const result = await Swal.fire({
          title: "미저장 변경사항이 있습니다.",
          text: "저장 후 이동하시겠습니까?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "저장 후 이동",
          cancelButtonText: "취소",
          confirmButtonColor: "#1976d2",
          cancelButtonColor: "#9e9e9e",
        });
        if (!result.isConfirmed) return;
        await handleSaveRef.current?.();
      }
    }
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "account_id" || name === "type" || name === "payType") {
        setSelectedSaleId("");
        setSelectedMasterIndex(-1);
        setDetailRows([]);
        setOriginalDetailRows([]);
        fetchPurchaseList(next);
      }
      return next;
    });
  };

  // ✅ (상단) 합계 계산
  const masterSums = useMemo(() => {
    const sum = (key) =>
      (rows || []).reduce((acc, r) => {
        const n = Number(stripComma(r?.[key]));
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);

    return {
      tax: sum("tax"),
      vat: sum("vat"),
      taxFree: sum("taxFree"),
      total: sum("total"),
    };
  }, [rows, stripComma]);

  // 상단 합계 콤마 포맷 문자열 (푸터 표시용)
  const masterSumText = useMemo(
    () => ({
      tax: masterSums.tax.toLocaleString("ko-KR"),
      vat: masterSums.vat.toLocaleString("ko-KR"),
      taxFree: masterSums.taxFree.toLocaleString("ko-KR"),
      total: masterSums.total.toLocaleString("ko-KR"),
    }),
    [masterSums]
  );

  // 미저장 변경 여부 확인: 상단 rows, 현재 하단 detailRows, 누적 보관소(pendingDetailMap) 포함
  const hasDirtyRowsEarly = useCallback(() => {
    if (rows.some((r) => r.__dirty)) return true;
    if (detailRows.some((r) => r.__dirty)) return true;
    // 누적 보관소에 저장된 다른 sale_id의 변경분 존재 여부
    for (const saved of pendingDetailMap.values()) {
      const arr = Array.isArray(saved) ? saved : (saved?.rows ?? []);
      if (arr.some((r) => r.__dirty)) return true;
    }
    return false;
  }, [rows, detailRows, pendingDetailMap]);

  // handleSave는 아래 정의되므로 ref로 참조
  const handleSaveRef = useRef(null);
  // 저장 중 selectedSaleId useEffect의 자동 상세 재조회 방지용 플래그
  const isSavingRef = useRef(false);

  // 거래처 변경 핸들러: 미저장 확인 → 타입 옵션 재조회 → 데이터 조회
  const handleAccountChange = useCallback(
    async (_, opt) => {
      const nextId = opt ? String(opt.value) : "";
      const nextAccountTypeCode = opt ? String(opt.account_type_code ?? "") : "";

      // 미저장 변경 있으면 확인
      if (hasDirtyRowsEarly()) {
        const result = await Swal.fire({
          title: "미저장 변경사항이 있습니다.",
          text: "저장 후 이동하시겠습니까?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "저장 후 이동",
          cancelButtonText: "취소",
          confirmButtonColor: "#1976d2",
          cancelButtonColor: "#9e9e9e",
        });
        if (!result.isConfirmed) return;
        await handleSaveRef.current?.();
      }

      // 공통 초기화 (거래처 변경 시 누적 보관소도 초기화)
      setSelectedSaleId("");
      setSelectedMasterIndex(-1);
      setDetailRows([]);
      setOriginalDetailRows([]);
      setPendingDetailMap(new Map());

      if (!nextId) {
        setTypeOptions([]);
        setFilters((prev) => ({ ...prev, account_id: "" }));
        return;
      }

      // ✅ 1) 타입 옵션 먼저 조회
      const opts = await fetchTypeOptions(nextId);

      // ✅ 2) filters 기반으로 next 구성
      const nextType = resolveNextType(opts, filters.type, nextAccountTypeCode);
      const next = { ...filters, account_id: nextId, type: nextType };

      // ✅ 3) 상태 반영 + 조회
      setFilters(next);
      fetchPurchaseList(next);
    },
    [
      filters,
      fetchPurchaseList,
      fetchTypeOptions,
      resolveNextType,
      setDetailRows,
      setOriginalDetailRows,
    ]
  );

  // ✅ 미저장 변경 여부 (handleSearch용 alias)
  const hasDirtyRows = hasDirtyRowsEarly;

  // 실제 조회 실행 (dirty 확인 없이 바로 조회)
  const doSearch = async (targetFilters) => {
    setRows((originalRows || []).map((r) => ({ ...r })));
    setDetailRows((originalDetailRows || []).map((r) => ({ ...r })));
    setMasterTableKey((k) => k + 1);
    setDetailTableKey((k) => k + 1);
    setPendingDetailMap(new Map());
    setSelectedSaleId("");
    setSelectedMasterIndex(-1);
    setDetailRows([]);
    setOriginalDetailRows([]);
    await fetchPurchaseList(targetFilters ?? filters);
  };

  // 조회 버튼 클릭: 미저장 변경 있으면 [저장 후 이동] / [취소] 확인
  const handleSearch = async () => {
    try {
      if (hasDirtyRows()) {
        const result = await Swal.fire({
          title: "미저장 변경사항이 있습니다.",
          text: "저장 후 조회하시겠습니까?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "저장 후 이동",
          cancelButtonText: "취소",
          confirmButtonColor: "#1976d2",
          cancelButtonColor: "#9e9e9e",
        });
        if (!result.isConfirmed) return;
        await handleSaveRef.current?.();
        return;
      }
      await doSearch();
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    }
  };

  // ✅ 변경 감지: originalRows → sale_id 기반 Map (index 의존 제거, O(1) 조회)
  const originalRowsMap = useMemo(() => {
    const m = new Map();
    (originalRows || []).forEach((r) => {
      const k = String(r?.sale_id ?? "");
      if (k) m.set(k, r);
    });
    return m;
  }, [originalRows]);

  // 문자열 공백 정규화 (변경 감지 비교 시 좌우 공백·연속 공백 제거)
  const normalizeStr = useCallback(
    (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value),
    []
  );

  // 셀 변경 여부에 따른 글자색 반환 (변경 시 빨간색, 신규 행 포함)
  const getCellStyle = useCallback(
    (row, key, value) => {
      if (row?.__isNew) return { color: "red" };
      const saleId = String(row?.sale_id ?? "");
      const original = saleId ? originalRowsMap.get(saleId)?.[key] : undefined;
      if (original === undefined) return { color: "black" };

      if (MONEY_KEYS.includes(key)) {
        return stripComma(original) !== stripComma(value) ? { color: "red" } : { color: "black" };
      }
      if (typeof original === "string" && typeof value === "string") {
        return normalizeStr(original) !== normalizeStr(value) ? { color: "red" } : { color: "black" };
      }
      return original !== value ? { color: "red" } : { color: "black" };
    },
    [originalRowsMap, MONEY_KEYS, stripComma, normalizeStr]
  );

  // 상단 셀 값 변경 핸들러 (total=0 시 하단 금액 전체 초기화 포함)
  const handleCellChange = useCallback((rowIndex, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value, __dirty: true } : r)));

    // ✅ 상단 합계(total)가 0으로 바뀌면 하단 detail 모든 행의 숫자 컬럼을 0으로 초기화
    if (key === "total") {
      const numVal = Number(String(value).replace(/,/g, "")) || 0;
      if (numVal === 0) {
        setDetailRows((prev) =>
          prev.map((r) => ({
            ...r,
            qty: "0",
            unitPrice: "0",
            amount: "0",
            tax: "0",
            vat: "0",
            __dirty: true,
          }))
        );
        // input이 defaultValue 기반이라 key 변경으로 리렌더링
        setDetailTableKey((k) => k + 1);
      }
    }
  }, [setRows, setDetailRows, setDetailTableKey]);

  // 사업자번호 포맷 변환 (숫자 10자리 → XXX-XX-XXXXX)
  const formatBizNo = useCallback((v) => {
    const digits = String(v ?? "")
      .replace(/\D/g, "")
      .slice(0, 10); // 숫자만, 최대 10자리
    if (!digits) return "";

    const a = digits.slice(0, 3);
    const b = digits.slice(3, 5);
    const c = digits.slice(5, 10);

    if (digits.length <= 3) return a;
    if (digits.length <= 5) return `${a}-${b}`;
    return `${a}-${b}-${c}`;
  }, []);

  // 상단 테이블 MUI sx 스타일 (스크롤·테두리·헤더 고정)
  const tableSx = {
    overflow: "auto",
    border: "1px solid #ddd",
    borderRadius: 1,
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& tfoot td": {
      borderTop: "2px solid #333",
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
      boxSizing: "border-box",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "td[contenteditable]": {
      overflowX: "auto",
      overflowY: "hidden",
      whiteSpace: "nowrap",
      msOverflowStyle: "none",
      scrollbarWidth: "none",
    },
    "& td[contenteditable]::-webkit-scrollbar": { display: "none" },
    "& input[type='text'], & input[type='date']": {
      fontSize: "12px",
      padding: "4px",
      border: "none",
      background: "transparent",
      textAlign: "center",
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
  };

  // 하단 상세 테이블 MUI sx 스타일
  const detailTableSx = {
    flex: 1,
    overflow: "auto",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& tfoot td": {
      borderTop: "2px solid #333",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      whiteSpace: "nowrap",
      fontSize: "12px",
      padding: "4px",
      boxSizing: "border-box",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "td[contenteditable]": {
      overflowX: "auto",
      overflowY: "hidden",
      whiteSpace: "nowrap",
      msOverflowStyle: "none",
      scrollbarWidth: "none",
    },
    "& td[contenteditable]::-webkit-scrollbar": { display: "none" },
    "& input[type='text'], & input[type='date']": {
      fontSize: "12px",
      padding: "4px",
      border: "none",
      background: "transparent",
      textAlign: "center",
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
  };

  // 고정 너비 컬럼 인라인 스타일 생성 (width/minWidth/maxWidth 동일 설정)
  const fixedColStyle = useCallback(
    (size, extra = {}) => ({
      width: size,
      minWidth: size,
      maxWidth: size,
      ...extra,
    }),
    []
  );

  // 타입 value → label 매핑 (전체 조회 시 타입명 표시용)
  const typeNameByValue = useMemo(() => {
    const map = new Map();
    typeOptions.forEach((o) => map.set(String(o.value), String(o.label)));
    return map;
  }, [typeOptions]);

  // 상단 테이블 컬럼 정의 (전체 타입 조회 시 타입 컬럼 동적 추가)
  const masterColumns = useMemo(() => {
    const isAllType = String(filters.type ?? "") === "0";
    const typeCol = {
      header: "타입",
      accessorKey: "type",
      size: 150,
      cell: (v) => typeNameByValue.get(String(v ?? "")) || String(v ?? ""),
    };
    const base = [
      { header: "거래처", accessorKey: "account_name", size: 180 },
      ...(isAllType ? [typeCol] : []),
      { header: "결제일자", accessorKey: "saleDate", size: 130 },
      { header: "사용처", accessorKey: "use_name", size: 140 },
      { header: "사업자번호", accessorKey: "bizNo", size: 120 },
      { header: "과세", accessorKey: "tax", size: 90 },
      { header: "부가세", accessorKey: "vat", size: 90 },
      { header: "면세", accessorKey: "taxFree", size: 90 },
      { header: "합계금액", accessorKey: "total", size: 110 },
      { header: "영수증타입", accessorKey: "receipt_type", size: 130 },
      { header: "영수증사진", accessorKey: "receipt_image", size: 180 },
      { header: "비고", accessorKey: "note", size: 160 },
      { header: "등록일자", accessorKey: "reg_dt", size: 110 },
    ];
    return base;
  }, [filters.type, typeNameByValue]);

  // 합계금액 컬럼 인덱스 (푸터 colspan 계산용)
  const masterTotalColIndex = useMemo(
    () => masterColumns.findIndex((c) => c.accessorKey === "total"),
    [masterColumns]
  );

  // 합계금액 오른쪽 컬럼 수 (푸터 빈 칸 colspan)
  const masterSummaryTailColSpan = useMemo(() => {
    const totalIndex = masterTotalColIndex >= 0 ? masterTotalColIndex : 8;
    return Math.max(masterColumns.length - (totalIndex + 1), 0);
  }, [masterColumns.length, masterTotalColIndex]);

  // 하단 상세 테이블 컬럼 정의
  const detailColumns = useMemo(
    () => [
      { header: "상품명", accessorKey: "name", size: 220 },
      { header: "수량", accessorKey: "qty", size: 90 },
      { header: "단가", accessorKey: "unitPrice", size: 110 },
      { header: "과세", accessorKey: "tax", size: 110 },
      { header: "부가세", accessorKey: "vat", size: 110 },
      { header: "금액", accessorKey: "amount", size: 120 },
      { header: "과세구분", accessorKey: "taxType", size: 110 },
      { header: "상품구분", accessorKey: "itemType", size: 110 },
    ],
    []
  );

  // 금액 컬럼 인덱스 (하단 푸터 colspan 계산용)
  const detailAmountColIndex = useMemo(
    () => detailColumns.findIndex((c) => c.accessorKey === "amount"),
    [detailColumns]
  );

  // ✅ URL 조립
  const buildFileUrl = useCallback((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const p = String(path).startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  }, []);

  // 저장된 증빙파일은 정적 /image 경로 대신 전용 조회 API로 미리보기한다.
  const buildFilePreviewUrl = useCallback((path) => {
    if (!path) return "";
    if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const params = new URLSearchParams();
    params.set("file_path", String(path).startsWith("/") ? String(path) : `/${path}`);
    return `${base}/Account/AccountStoredFileView?${params.toString()}`;
  }, []);

  // 파일 경로에서 확장자 추출
  const getExt = (p = "") => {
    const clean = String(p).split("?")[0].split("#")[0];
    return clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  };

  const isPdfFile = (p) => getExt(p) === "pdf";

  // 미리보기 가능한 파일 목록 (영수증 이미지/PDF 경로 포함 행만 추출)
  const fileItems = useMemo(() => {
    return (rows || [])
      .filter((r) => !!r?.receipt_image)
      .map((r) => {
        const path = r.receipt_image;
        return {
          path,
          url: buildFilePreviewUrl(path),
          name: `${r.name || ""} ${r.saleDate || ""}`.trim(),
          kind: isPdfFile(path) ? "pdf" : "image",
        };
      });
  }, [rows, buildFilePreviewUrl]);

  // 영수증 없음 알림
  const handleNoImageAlert = () => {
    Swal.fire("이미지 없음", "등록된 증빙자료가 없습니다.", "warning");
  };

  // rows → masterRowsRef 동기화 (업로드 핸들러에서 stale 방지)
  useEffect(() => {
    masterRowsRef.current = rows;
  }, [rows]);

  // 파일 다운로드 핸들러 (새 탭 열기 방식)
  const handleDownload = useCallback(
    (path) => {
      if (!path || typeof path !== "string") return;
      const url = buildFileUrl(path);
      const filename = path.split("/").pop() || "download";

      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [buildFileUrl]
  );

  // =========================
  // ✅ 영수증 이미지 업로드
  // =========================
  const handleImageUpload = useCallback(
    async (file, rowIndex) => {
      if (!file) return;
      const row = masterRowsRef.current?.[rowIndex] || {};
      const rowType = String(row.type || filters.type || "");
      const accountId = String(row.account_id || "");
      const receiptType = normalizeReceiptTypeVal(row.receipt_type || "", rowType);

      if (!accountId) {
        return Swal.fire("경고", "영수증 업로드 전에 거래처를 먼저 선택해주세요.", "warning");
      }

      // type별 엔드포인트 결정
      // - 1000(법인카드): /receipt-scan + saveType="cor"
      // - 1002/1003(온라인몰): /receipt-scan + saveType="account" (HeadOfficeReceiptParserFactory 라우팅)
      // - 기타: /receipt-scan + saveType="account"
      const endpoint = "/receipt-scan";

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
        formData.append("receipt_type", receiptType);
        formData.append("type", rowType);
        formData.append("account_id", accountId);
        formData.append("saleDate", row.saleDate || "");
        formData.append("saveType", rowType === "1000" ? "cor" : "account");
        console.log("[업로드] 전송 sale_id:", row.sale_id, "rowIndex:", rowIndex);
        formData.append("sale_id", String(row.sale_id || ""));

        const res = await api.post(endpoint, formData, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        Swal.close();

        if (res.status !== 200) {
          return Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
        }

        const data = res.data || {};
        const main = data.main || data || {};
        console.log("[업로드] 응답 sale_id:", main.sale_id, "기존 row.sale_id:", row.sale_id);

        const patch = {
          // sale_id는 기존 행 유지 — 응답값으로 덮으면 저장 시 새 행으로 INSERT됨
          ...(main.account_id != null && main.account_id !== "" ? { account_id: main.account_id } : {}),
          ...(main.saleDate != null ? { saleDate: main.saleDate } : {}),
          ...(main.use_name != null ? { use_name: main.use_name } : {}),
          ...(main.bizNo != null ? { bizNo: main.bizNo } : {}),
          ...(main.total != null ? { total: main.total } : {}),
          ...(main.vat != null ? { vat: main.vat } : {}),
          ...(main.tax != null ? { tax: main.tax } : {}),
          ...(main.taxFree != null ? { taxFree: main.taxFree } : {}),
          // receipt_image: 항상 덮어쓰기 (재업로드 시 새 경로 반영)
          receipt_image: main.receipt_image ?? row.receipt_image ?? "",
          ...(main.receipt_type != null
            ? { receipt_type: normalizeReceiptTypeVal(main.receipt_type, rowType) }
            : {}),
        };

        // rows 갱신 (dirty 유지 — 빨간색 표시 및 변경감지용)
        setRows((prev) =>
          prev.map((r, i) => (i === rowIndex ? { ...r, ...patch, __dirty: true } : r))
        );

        // 업로드한 행 선택 유지 (sale_id는 기존 행 것 사용)
        const uploadedSaleId = row.sale_id;
        if (uploadedSaleId) {
          setSelectedSaleId(String(uploadedSaleId));
          setSelectedMasterIndex(rowIndex);
        }

        Swal.fire("완료", "영수증이 업로드되었습니다.", "success");
      } catch (err) {
        Swal.close();
        Swal.fire("오류", err.message || "업로드 중 오류가 발생했습니다.", "error");
      }
    },
    [filters.type, setRows, setSelectedSaleId, setSelectedMasterIndex]
  );

  // =========================
  // ✅ 이미지 뷰어
  // =========================
  // =========================
  // ✅ 파일 뷰어
  // =========================
  // 파일 뷰어 열림 상태 및 현재 인덱스
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const handleCloseViewer = useCallback(() => setViewerOpen(false), []);

  // 영수증 미리보기 열기 (해당 파일의 인덱스로 이동)
  const handleViewImage = useCallback(
    (path) => {
      if (!path) return;
      const idx = fileItems.findIndex((x) => x.path === path);
      setViewerIndex(idx >= 0 ? idx : 0);
      setViewerOpen(true);
    },
    [fileItems]
  );

  useEffect(() => {
    if (!viewerOpen) return;
    if (!fileItems.length) {
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > fileItems.length - 1) setViewerIndex(fileItems.length - 1);
  }, [viewerOpen, fileItems.length, viewerIndex]);

  // =========================
  // ✅ 저장 관련 (상단)
  // =========================
  const SAVE_KEYS = useMemo(
    () => [
      "saleDate",
      "use_name",
      "vat",
      "taxFree",
      "tax",
      "payType",
      "totalCash",
      "totalCard",
      "total",
      "receipt_type",
      "receipt_image",
      "note",
    ],
    []
  );

  // 상단 행 변경 여부 판별 (저장 대상 필터링용)
  const isRowChanged = useCallback(
    (orig, cur) => {
      if (cur?.__dirty) return true;

      return SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);

        if (typeof a === "string" && typeof b === "string") return normalizeStr(a) !== normalizeStr(b);
        return a !== b;
      });
    },
    [SAVE_KEYS, MONEY_KEYS, stripComma, normalizeStr]
  );

  // 상단 행 저장 형태로 변환 (콤마 제거, 불필요 필드 삭제, payType 보정)
  const buildRowForSave = useCallback(
    (r) => {
      const user_id = localStorage.getItem("user_id") || "";
      const next = { ...r };

      delete next.account_name;
      delete next.__dirty;

      MONEY_KEYS.forEach((k) => {
        const raw = stripComma(next[k]);
        next[k] = raw === "" ? 0 : raw;
      });

      if (!next.account_id) next.account_id = filters.account_id;
      next.user_id = next.user_id || user_id;
      next.type = next.type || filters.type;
      next.savetype = 1;
      next.receipt_type = normalizeReceiptTypeVal(next.receipt_type);
      // ✅ "행의 payType"만 쓴다. (빈 값이면 기본 1로 고정)
      const pt = String(next.payType ?? "").trim();
      next.payType = pt === "1" || pt === "2" ? pt : "1";

      return next;
    },
    [filters, MONEY_KEYS, stripComma]
  );

  // =========================
  // ✅ 하단(상세) 변경감지/저장 빌드
  // =========================
  const DETAIL_SAVE_KEYS = useMemo(
    () => [
      "saleDate",
      "name",
      "qty",
      "unitPrice",
      "tax",
      "vat",
      "amount",
      "taxType",
      "itemType",
      "note",
    ],
    []
  );

  // 하단 상세 행 변경 여부 판별
  const isDetailRowChanged = useCallback(
    (orig, cur) => {
      return DETAIL_SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (DETAIL_MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);
        if (typeof a === "string" && typeof b === "string") return normalizeStr(a) !== normalizeStr(b);
        return a !== b;
      });
    },
    [DETAIL_SAVE_KEYS, DETAIL_MONEY_KEYS, stripComma, normalizeStr]
  );

  // 하단 상세 행 저장 형태로 변환 (임시 플래그 제거, 금액 콤마 제거)
  const buildDetailRowForSave = useCallback(
    (r) => {
      const user_id = localStorage.getItem("user_id") || "";
      const next = { ...r };

      DETAIL_MONEY_KEYS.forEach((k) => {
        const raw = stripComma(next[k]);
        next[k] = raw === "" ? 0 : raw;
      });

      if (!next.sale_id) next.sale_id = selectedSaleId;
      if (!next.account_id) next.account_id = filters.account_id;

      next.user_id = next.user_id || user_id;
      next.savetype = 2;

      delete next.__isNew;
      delete next.__dirty;
      delete next.__taxManual;

      return next;
    },
    [DETAIL_MONEY_KEYS, stripComma, selectedSaleId, filters.account_id]
  );

  // ✅ rows 바뀔 때: 선택만 유지/보정 (상세 재조회 X)
  useEffect(() => {
    if (!rows || rows.length === 0) {
      // 저장 후 재조회 중에는 일시적으로 rows가 비었어도 선택 초기화 안 함
      if (isSavingRef.current) return;
      setSelectedSaleId("");
      setSelectedMasterIndex(-1);
      setDetailRows([]);
      setOriginalDetailRows([]);
      return;
    }

    const foundIdx = selectedSaleId
      ? rows.findIndex((r) => String(r.sale_id) === String(selectedSaleId))
      : -1;

    if (foundIdx < 0) return;

    const nextSaleId = rows[foundIdx]?.sale_id;

    if (!nextSaleId) return;

    if (String(nextSaleId) !== String(selectedSaleId)) {
      setSelectedSaleId(String(nextSaleId));
    }
    if (selectedMasterIndex !== foundIdx) {
      setSelectedMasterIndex(foundIdx);
    }
  }, [rows]); // ✅ rows만 감시 (fetch 없음)

  // selectedSaleId 변경 시 상세 처리:
  // 누적 보관소에 해당 sale_id 캐시가 있으면 복원, 없으면 서버 조회
  useEffect(() => {
    if (!selectedSaleId) return;
    // 저장 중 직접 fetchPurchaseDetailList 호출하므로 여기선 실행 안 함
    if (isSavingRef.current) return;

    const cached = pendingDetailMap.get(String(selectedSaleId));
    if (cached) {
      setDetailRows(cached.rows ?? cached);
      setOriginalDetailRows(cached.originalRows ?? []);
      setDetailLoading(false);
      setDetailTableKey((k) => k + 1);
      return;
    }

    const master = (rows || []).find((r) => String(r.sale_id) === String(selectedSaleId));
    fetchPurchaseDetailList({
      sale_id: selectedSaleId,
      account_id: master?.account_id || filters.account_id,
    });
  }, [selectedSaleId]); // rows 변화로는 재조회 안 함

  // 상단 행 클릭 핸들러:
  // 1) 현재 하단 수정값이 있으면 누적 보관소에 저장 후 이동
  // 2) 이동 대상 sale_id의 캐시가 보관소에 있으면 복원, 없으면 서버 조회
  const handleMasterRowClick = useCallback(
    (row, rowIndex) => {
      const saleId = row?.sale_id;
      if (!saleId) return;

      // 현재 하단에 미저장 수정값이 있을 때만 보관소에 보존 (원본도 함께)
      const hasDirtyDetail = detailRows.some((r) => r.__dirty || r.__isNew);
      if (selectedSaleId && hasDirtyDetail && String(selectedSaleId) !== String(saleId)) {
        setPendingDetailMap((prev) => {
          const next = new Map(prev);
          next.set(String(selectedSaleId), { rows: detailRows, originalRows: originalDetailRows });
          return next;
        });
      }

      // 다른 행 클릭 시 이전 상세가 남아 상단 합계를 건드리는 문제 방지
      setDetailRows([]);
      setOriginalDetailRows([]);
      setDetailLoading(true);

      if (String(selectedSaleId) !== String(saleId)) {
        setSelectedSaleId(String(saleId));
      } else {
        // 같은 행 재클릭: dirty 있으면 캐시 저장 후 복원, 없으면 캐시 or 서버 조회
        if (hasDirtyDetail) {
          setPendingDetailMap((prev) => {
            const next = new Map(prev);
            next.set(String(saleId), { rows: detailRows, originalRows: originalDetailRows });
            return next;
          });
          setDetailRows(detailRows);
          setOriginalDetailRows(originalDetailRows);
          setDetailLoading(false);
          setDetailTableKey((k) => k + 1);
        } else {
          const cached = pendingDetailMap.get(String(saleId));
          if (cached) {
            setDetailRows(cached.rows ?? cached);
            setOriginalDetailRows(cached.originalRows ?? []);
            setDetailLoading(false);
            setDetailTableKey((k) => k + 1);
          } else {
            fetchPurchaseDetailList({
              sale_id: String(saleId),
              account_id: row?.account_id || filters.account_id,
            });
          }
        }
      }
      if (selectedMasterIndex !== rowIndex) {
        setSelectedMasterIndex(rowIndex);
      }
    },
    [
      selectedSaleId,
      selectedMasterIndex,
      filters.account_id,
      fetchPurchaseDetailList,
      setDetailRows,
      setOriginalDetailRows,
      detailRows,
      pendingDetailMap,
    ]
  );

  // ✅ 하단 행추가 버튼
  const handleDetailAddRow = useCallback(() => {
    if (!selectedSaleId) {
      Swal.fire("안내", "상단에서 먼저 행을 선택해 주세요. (sale_id 필요)", "info");
      return;
    }

    const user_id = localStorage.getItem("user_id") || "";
    const master =
      rows?.[selectedMasterIndex] ||
      rows?.find((r) => String(r.sale_id) === String(selectedSaleId)) ||
      {};

    const newRow = {
      account_id: master?.account_id || filters.account_id,
      sale_id: selectedSaleId,

      item_id: null,

      account_name: master?.account_name || "",
      saleDate: master?.saleDate || "",
      name: "",

      qty: "",
      unitPrice: "",
      tax: "",
      vat: "",
      amount: "",

      // ✅ 기본값(선택)
      taxType: "",
      itemType: "",

      receipt_image: master?.receipt_image || "",
      note: "",

      user_id,
      __isNew: true,
      __key: `new-${Date.now()}`,
    };

    setDetailRows((prev) => [newRow, ...prev]);
    setOriginalDetailRows((prev) => [newRow, ...prev]);
  }, [
    selectedSaleId,
    rows,
    selectedMasterIndex,
    filters.account_id,
    setDetailRows,
    setOriginalDetailRows,
  ]);

  // ✅ 원본을 sale_id로 매핑 (index 의존 제거)
  const originalMasterMap = useMemo(() => {
    const m = new Map();
    (originalRows || []).forEach((r) => {
      const key = String(r?.sale_id ?? "");
      if (key) m.set(key, r);
    });
    return m;
  }, [originalRows]);

  // 하단 dirty가 있는 sale_id 집합 (상단 행 글씨색 표시용)
  const dirtyDetailSaleIds = useMemo(() => {
    const ids = new Set();
    // 현재 화면의 하단 rows
    if (detailRows.some((r) => r.__dirty || r.__isNew)) {
      if (selectedSaleId) ids.add(String(selectedSaleId));
    }
    // pendingDetailMap에 저장된 다른 행들
    for (const [saleId, v] of pendingDetailMap.entries()) {
      const arr = Array.isArray(v) ? v : (v?.rows ?? []);
      if (arr.some((r) => r.__dirty || r.__isNew)) ids.add(String(saleId));
    }
    return ids;
  }, [detailRows, selectedSaleId, pendingDetailMap]);

  // 저장 처리: 상단 + 현재 하단 + 누적 보관소의 모든 변경분 일괄 저장
  const handleSave = useCallback(async () => {
    try {
      // 포커스된 셀 blur 강제 실행 (onBlur 우선 처리)
      const active = document.activeElement;
      if (active && (active.isContentEditable || active.tagName === "INPUT")) {
        active.blur();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // 금액 합계 계산 헬퍼 (detail 기반 master 자동계산용)
      const toNumForSave = (v) => {
        const n = Number(String(v ?? "").replace(/,/g, "").trim());
        return Number.isFinite(n) ? n : 0;
      };
      const calcMasterTotalsForSave = (list) => {
        let total = 0, tax = 0, vat = 0, taxFree = 0;
        (list || []).forEach((r) => {
          const amt = toNumForSave(r?.amount);
          const taxType = String(r?.taxType ?? "");
          const autoVat = taxType === "1" ? Math.floor(amt / 11) : 0;
          const autoTax = taxType === "1" ? amt - autoVat : 0;
          const inputTax = toNumForSave(r?.tax);
          const inputVat = toNumForSave(r?.vat);
          const hasManualFlag = !!r?.__taxManual;
          const hasManualValue =
            taxType === "1" &&
            (String(r?.tax ?? "").trim() !== "" || String(r?.vat ?? "").trim() !== "") &&
            (inputTax !== autoTax || inputVat !== autoVat);
          total += amt;
          if (hasManualFlag || hasManualValue) {
            tax += inputTax; vat += inputVat;
          } else if (taxType === "1") {
            tax += autoTax; vat += autoVat;
          } else if (taxType === "2") {
            taxFree += amt;
          }
        });
        return { total, tax, vat, taxFree };
      };

      // 누적 보관소에 현재 하단 수정값 반영 (저장 직전 최신 상태로 병합)
      // pendingDetailMap 값은 { rows, originalRows } 객체
      const fullDetailMap = new Map();
      for (const [k, v] of pendingDetailMap.entries()) {
        const r = Array.isArray(v) ? v : (v?.rows ?? []);
        const o = Array.isArray(v) ? [] : (v?.originalRows ?? []);
        fullDetailMap.set(k, { rows: r, originalRows: o });
      }
      if (selectedSaleId && detailRows.length > 0) {
        fullDetailMap.set(String(selectedSaleId), { rows: detailRows, originalRows: originalDetailRows });
      }

      // 누적 보관소 전체 sale_id의 하단 변경분 취합
      let allModifiedDetail = [];
      let currentRows = rows || [];

      for (const [saleId, { rows: savedDetailRows, originalRows: savedOriginalRows }] of fullDetailMap.entries()) {
        // item_id 기반 원본 Map 생성
        const origMap = new Map();
        (savedOriginalRows || []).forEach((r) => {
          const k = String(r?.item_id ?? "");
          if (k) origMap.set(k, r);
        });

        const detailForSave = (savedDetailRows || [])
          .map((r) => {
            if (r.__isNew) return buildDetailRowForSave(r);
            const itemId = String(r?.item_id ?? "");
            const o = itemId ? origMap.get(itemId) : null;
            if (!o) return buildDetailRowForSave(r);
            return isDetailRowChanged(o, r) ? buildDetailRowForSave(r) : null;
          })
          .filter(Boolean);

        // master 변경 여부 확인 후 detail 강제 포함 여부 결정
        const masterRowChanged = (() => {
          const masterRow = (rows || []).find((r) => String(r?.sale_id ?? "") === String(saleId));
          if (!masterRow) return false;
          const o = originalMasterMap.get(String(saleId));
          if (!o) return true;
          return isRowChanged(o, masterRow);
        })();
        const finalDetailForSave =
          masterRowChanged && detailForSave.length === 0 && savedDetailRows.length > 0
            ? savedDetailRows.map((r) => buildDetailRowForSave(r))
            : detailForSave;

        allModifiedDetail = allModifiedDetail.concat(finalDetailForSave);

        // detail 변경 시 해당 sale_id의 master 합계 자동 반영
        if (finalDetailForSave.length > 0) {
          const { total, tax, vat, taxFree } = calcMasterTotalsForSave(savedDetailRows);
          currentRows = currentRows.map((r) => {
            if (String(r?.sale_id ?? "") !== String(saleId)) return r;
            return {
              ...r,
              tax: tax.toLocaleString("ko-KR"),
              vat: vat.toLocaleString("ko-KR"),
              total: total.toLocaleString("ko-KR"),
              taxFree: taxFree.toLocaleString("ko-KR"),
              __dirty: true,
            };
          });
        }
      }

      // 상단: 변경된 행만 (자동계산 반영된 currentRows 기준)
      const modifiedMaster = currentRows
        .filter((r) => {
          const key = String(r?.sale_id ?? "");
          const o = originalMasterMap.get(key);
          if (!o) return true;
          return isRowChanged(o, r);
        })
        .map((r) => buildRowForSave(r));

      if (modifiedMaster.length === 0 && allModifiedDetail.length === 0) {
        return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
      }

      // 실제 저장 대상(allModifiedDetail)에서만 과세구분/상품구분 미선택 체크
      const invalidDetailCount = allModifiedDetail.filter(
        (r) => !String(r?.taxType ?? "").trim() || !String(r?.itemType ?? "").trim()
      ).length;
      if (invalidDetailCount > 0) {
        return Swal.fire(
          "저장 불가",
          `하단 상세 ${invalidDetailCount}행에 과세구분 또는 상품구분이 선택되지 않았습니다.\n선택 후 저장해주세요.`,
          "warning"
        );
      }

      Swal.fire({
        title: "저장 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // 모든 sale_id의 detail 변경분을 한 번에 저장
      if (allModifiedDetail.length > 0) {
        const res2 = await api.post("/Account/AccountPurchaseDetailSave", allModifiedDetail, {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
        });
        const ok2 = res2?.status === 200 || res2?.data?.code === 200;
        if (!ok2) {
          Swal.close();
          return Swal.fire("실패", res2?.data?.message || "하단 저장 실패", "error");
        }
      }

      if (modifiedMaster.length > 0) {
        const res1 = await api.post("/Account/AccountPurchaseSave", modifiedMaster, {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
        });
        const ok1 = res1?.status === 200 || res1?.data?.code === 200;
        if (!ok1) {
          Swal.close();
          return Swal.fire("실패", res1?.data?.message || "상단 저장 실패", "error");
        }
      }

      // 저장 완료 후 누적 보관소 초기화
      setPendingDetailMap(new Map());

      const keepMasterScrollTop = masterWrapRef.current?.scrollTop ?? 0;
      const savedSaleId = String(selectedSaleId ?? "").trim(); // 재조회 시점의 sale_id 고정
      Swal.close();
      await Swal.fire("성공", "저장되었습니다.", "success");

      // 성공 팝업 확인 후 DB 기준 재조회
      setDetailRows([]);
      setOriginalDetailRows([]);
      setDetailTableKey((k) => k + 1);
      isSavingRef.current = true;
      try {
        await fetchPurchaseList(filters);
      } finally {
        isSavingRef.current = false;
      }

      await restoreMasterSelectionAfterSave(savedSaleId, keepMasterScrollTop);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e?.message || "저장 중 오류가 발생했습니다.", "error");
    }
  }, [
    rows,
    originalMasterMap,
    isRowChanged,
    buildRowForSave,
    setOriginalRows,
    filters,
    selectedSaleId,
    selectedMasterIndex,
    fetchPurchaseList,
    detailRows,
    originalDetailRows,
    isDetailRowChanged,
    buildDetailRowForSave,
    setDetailTableKey,
    pendingDetailMap,
    restoreMasterSelectionAfterSave,
  ]);

  // handleSave ref 동기화 (handleAccountChange에서 forward 참조용)
  handleSaveRef.current = handleSave;

  // -----------------------------
  // ✅ 엑셀 다운로드
  // -----------------------------
  // 추후 메뉴 복원 시 주석 해제
  // const [excelAnchorEl, setExcelAnchorEl] = useState(null);
  // const excelMenuOpen = Boolean(excelAnchorEl);
  // const handleExcelMenuOpen = (e) => setExcelAnchorEl(e.currentTarget);
  // const handleExcelMenuClose = () => setExcelAnchorEl(null);

  // 엑셀용 숫자 파싱 (콤마 포함 문자열 → 숫자)
  const parseNumber = (v) => {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  // 결제구분 코드 → 표시 텍스트 변환
  const payTypeText = (v) => {
    const s = String(v);
    if (s === "0") return "전체";
    return s === "2" ? "카드" : "현금";
  };

  // 현재 선택된 거래처명 반환
  const getAccountName = () => {
    const found = accountList.find((a) => String(a.account_id) === String(filters.account_id));
    return found?.account_name || "";
  };

  // Blob → 파일 다운로드 트리거
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 세금계산서 엑셀 다운로드 (공급자별 시트 분리)
  const downloadTaxInvoiceExcel = async () => {
    if (!rows || rows.length === 0) {
      Swal.fire("다운로드 불가", "다운로드할 데이터가 없습니다.", "warning");
      return;
    }

    const buyer = {
      bizNo: "000-00-00000", // TODO
      name: getAccountName() || "공급받는자(사업장)",
      ceoName: "대표자명", // TODO
    };

    const safeSheetName = (s) =>
      String(s || "세금계산서")
        .replace(/[\[\]\*\/\\\?\:]/g, " ")
        .trim()
        .slice(0, 31) || "세금계산서";

    const calcTaxableSupply = (r) => {
      const total = parseNumber(r.total);
      const vat = parseNumber(r.vat);
      const taxFree = parseNumber(r.taxFree);
      const supply = total - vat - taxFree;
      return supply > 0 ? supply : 0;
    };

    const groups = new Map();
    rows.forEach((r) => {
      const supplierBizNo = (r.bizNo || "").trim();
      const supplierName = (r.use_name || "").trim();
      const key = `${supplierBizNo}__${supplierName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "THEFULL";

    const listWs = wb.addWorksheet("목록");
    listWs.addRow([
      "공급자 사업자번호",
      "공급자 상호",
      "기간",
      "건수",
      "공급가액(과세)",
      "세액",
      "면세",
      "합계",
    ]);
    listWs.getRow(1).font = { bold: true };

    for (const [key, items] of groups.entries()) {
      const [supplierBizNo, supplierName] = key.split("__");
      const supplierCeo = items[0]?.ceo_name || "";

      items.sort((a, b) => String(a.saleDate || "").localeCompare(String(b.saleDate || "")));

      const ws = wb.addWorksheet(safeSheetName(`${supplierName || "공급자"}_세금계산서`));

      ws.mergeCells("A1:I1");
      ws.getCell("A1").value = "세 금 계 산 서 (출력/보관용)";
      ws.getCell("A1").font = { bold: true, size: 16 };
      ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      const label = (addr, text) => {
        ws.getCell(addr).value = text;
        ws.getCell(addr).font = { bold: true };
        ws.getCell(addr).alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell(addr).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        ws.getCell(addr).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
      };
      const boxCell = (addr, text) => {
        ws.getCell(addr).value = text;
        ws.getCell(addr).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell(addr).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      };

      label("A3", "공급자");
      label("A4", "사업자번호");
      boxCell("B4", supplierBizNo);
      label("A5", "상호(명칭)");
      boxCell("B5", supplierName);
      label("A6", "대표자");
      boxCell("B6", supplierCeo);

      label("E3", "공급받는자");
      label("E4", "사업자번호");
      boxCell("F4", buyer.bizNo);
      label("E5", "상호(명칭)");
      boxCell("F5", buyer.name);
      label("E6", "대표자");
      boxCell("F6", buyer.ceoName);

      label("A8", "조회기간");
      boxCell("B8", `${filters.year}년 ${filters.month}월`);
      label("E8", "조회구분");
      boxCell("F8", payTypeText(filters.payType));

      const headerRowIndex = 10;
      const headers = [
        "일자",
        "품목(집계)",
        "수량",
        "단가",
        "공급가액(과세)",
        "세액",
        "면세",
        "합계",
        "비고",
      ];
      ws.getRow(headerRowIndex).values = headers;
      ws.getRow(headerRowIndex).font = { bold: true };
      ws.getRow(headerRowIndex).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(headerRowIndex).height = 18;

      headers.forEach((_, i) => {
        const c = ws.getRow(headerRowIndex).getCell(i + 1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
        c.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      let supplySum = 0;
      let vatSum = 0;
      let taxFreeSum = 0;
      let totalSum = 0;

      items.forEach((r) => {
        const supply = calcTaxableSupply(r);
        const vat = parseNumber(r.vat);
        const taxFree = parseNumber(r.taxFree);
        const total = parseNumber(r.total);

        supplySum += supply;
        vatSum += vat;
        taxFreeSum += taxFree;
        totalSum += total;

        ws.addRow([
          r.saleDate ?? "",
          "매입집계",
          "",
          "",
          supply,
          vat,
          taxFree,
          total,
          r.note ?? "",
        ]);
      });

      ws.addRow(["", "합계", "", "", supplySum, vatSum, taxFreeSum, totalSum, ""]);

      ws.columns = [
        { width: 12 },
        { width: 14 },
        { width: 8 },
        { width: 10 },
        { width: 16 },
        { width: 12 },
        { width: 12 },
        { width: 14 },
        { width: 30 },
      ];

      ws.eachRow((row, rowNumber) => {
        if (rowNumber < headerRowIndex) return;
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          if ([5, 6, 7, 8].includes(colNumber)) cell.numFmt = "#,##0";
        });
      });

      listWs.addRow([
        supplierBizNo,
        supplierName,
        `${filters.year}년 ${filters.month}월`,
        items.length,
        supplySum,
        vatSum,
        taxFreeSum,
        totalSum,
      ]);
    }

    for (let r = 2; r <= listWs.rowCount; r += 1) {
      [5, 6, 7, 8].forEach((c) => (listWs.getCell(r, c).numFmt = "#,##0"));
    }
    listWs.columns = [
      { width: 16 },
      { width: 22 },
      { width: 24 },
      { width: 8 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
    ];

    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `세금계산서_출력용_${getAccountName() || "전체"}_${filters.year}년${filters.month}월_${ymd}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, filename);
  };

  // ✅ 거래처 자료 입력 엑셀 다운로드 (마스터 + 상세 2시트)
  const downloadPurchaseDataExcel = async () => {
    if (!rows || rows.length === 0) {
      Swal.fire("다운로드 불가", "다운로드할 데이터가 없습니다.", "warning");
      return;
    }

    Swal.fire({
      title: "엑셀 생성 중...",
      text: "상세 데이터를 조회하고 있습니다.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // 모든 sale_id의 상세 병렬 조회
      const detailMap = new Map();
      await Promise.all(
        rows.map(async (row) => {
          const saleId = String(row.sale_id ?? "").trim();
          if (!saleId) return;
          try {
            const res = await api.get("/Account/AccountPurchaseDetailList_tmp", {
              params: { sale_id: saleId },
            });
            const list = Array.isArray(res.data)
              ? res.data
              : res.data?.rows || res.data?.data || [];
            detailMap.set(saleId, list);
          } catch {
            detailMap.set(saleId, []);
          }
        })
      );

      const wb = new ExcelJS.Workbook();
      wb.creator = "THEFULL";

      // ── 시트1: 거래처 자료 입력 ──────────────────────────────
      const masterWs = wb.addWorksheet("거래처 자료 입력");

      const masterHeaders = [
        "거래처", "타입", "결제일자", "사용처",
        "사업자번호", "과세", "부가세", "면세",
        "합계금액", "영수증타입", "비고", "등록일자", "sale_id",
      ];
      const masterHeaderRow = masterWs.addRow(masterHeaders);
      masterHeaderRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const receiptTypeLabelMap = Object.fromEntries(
        [...RECEIPT_TYPES_1000, ...RECEIPT_TYPES_ONLINE, ...RECEIPT_TYPES_ETC].map((it) => [it.value, it.label])
      );
      const receiptTypeLabel = (v) => receiptTypeLabelMap[v] || v || "";

      rows.forEach((row) => {
        const dataRow = masterWs.addRow([
          row.account_name || "",
          row.type_name || row.type || "",
          row.saleDate || "",
          row.use_name || "",
          row.bizNo || "",
          parseNumber(row.tax),
          parseNumber(row.vat),
          parseNumber(row.taxFree),
          parseNumber(row.total),
          receiptTypeLabel(row.receipt_type),
          row.note || "",
          row.reg_dt || "",
          row.sale_id || "",
        ]);
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
        });
        // 숫자 컬럼 (과세/부가세/면세/합계) 오른쪽 정렬 + 숫자 포맷
        [6, 7, 8, 9].forEach((colIdx) => {
          const cell = dataRow.getCell(colIdx);
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        });
      });

      masterWs.columns = [
        { width: 18 }, { width: 14 }, { width: 14 }, { width: 16 },
        { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
        { width: 14 }, { width: 16 }, { width: 20 }, { width: 14 }, { width: 20 },
      ];

      // ── 시트2: 거래처 자료 입력 상세 ───────────────────────────
      const detailWs = wb.addWorksheet("거래처 자료 입력 상세");

      const detailHeaders = [
        "거래처", "타입", "결제일자", "사용처",
        "상품명", "수량", "금액", "단가",
        "과세구분", "상품구분", "sale_id",
      ];
      const detailHeaderRow = detailWs.addRow(detailHeaders);
      detailHeaderRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const taxTypeLabel = (v) => {
        if (String(v) === "1") return "과세";
        if (String(v) === "2") return "면세";
        if (String(v) === "3") return "알수없음";
        return v || "";
      };
      const itemTypeLabel = (v) => {
        if (String(v) === "1") return "식재료";
        if (String(v) === "2") return "소모품";
        if (String(v) === "3") return "경관식";
        return v || "";
      };

      rows.forEach((row) => {
        const saleId = String(row.sale_id ?? "").trim();
        const details = detailMap.get(saleId) || [];
        details.forEach((d) => {
          const dataRow = detailWs.addRow([
            row.account_name || d.account_name || "",
            row.type_name || row.type || "",
            row.saleDate || d.saleDate || "",
            row.use_name || "",
            d.name || "",
            d.qty != null ? Number(String(d.qty).replace(/,/g, "")) || 0 : 0,
            d.amount != null ? Number(String(d.amount).replace(/,/g, "")) || 0 : 0,
            d.unitPrice != null ? Number(String(d.unitPrice).replace(/,/g, "")) || 0 : 0,
            taxTypeLabel(d.taxType),
            itemTypeLabel(d.itemType),
            saleId,
          ]);
          dataRow.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" }, bottom: { style: "thin" },
              left: { style: "thin" }, right: { style: "thin" },
            };
          });
          // 수량/금액/단가 숫자 포맷
          [6, 7, 8].forEach((colIdx) => {
            const cell = dataRow.getCell(colIdx);
            cell.numFmt = "#,##0";
            cell.alignment = { horizontal: "right" };
          });
        });
      });

      detailWs.columns = [
        { width: 18 }, { width: 14 }, { width: 14 }, { width: 16 },
        { width: 20 }, { width: 10 }, { width: 14 }, { width: 14 },
        { width: 12 }, { width: 12 }, { width: 20 },
      ];

      Swal.close();

      const ymd = dayjs().format("YYYYMMDD");
      const filename = `거래처자료입력_${getAccountName() || "전체"}_${filters.year || ""}년${filters.month || ""}월_${ymd}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, filename);
      Swal.fire("완료", `${filename} 파일이 다운로드되었습니다.`, "success");
    } catch (err) {
      Swal.close();
      console.error("거래처 자료 입력 엑셀 다운로드 실패:", err);
      Swal.fire("오류", "엑셀 다운로드 중 오류가 발생했습니다.", "error");
    }
  };

  // 추후 메뉴 복원 시 주석 해제
  // const handleExcelDownload = async (type) => {
  //   handleExcelMenuClose();
  //   if (type === "taxInvoice") { await downloadTaxInvoiceExcel(); return; }
  //   if (type === "purchaseData") { await downloadPurchaseDataExcel(); return; }
  //   Swal.fire("준비중", "현재는 세금계산서만 먼저 구현되어 있어요.", "info");
  // };

  // 하단 원본 Map: item_id 기준 (index 의존 제거, 보관소 복원 시에도 정확한 비교)
  const originalDetailMap = useMemo(() => {
    const m = new Map();
    (originalDetailRows || []).forEach((r) => {
      const k = String(r?.item_id ?? "");
      if (k) m.set(k, r);
    });
    return m;
  }, [originalDetailRows]);

  // 하단 셀 스타일: 원본과 실제 값이 다를 때만 빨간색
  const getDetailCellStyle = useCallback(
    (row, key, value) => {
      if (row?.__isNew) return { color: "red" };
      const itemId = String(row?.item_id ?? "");
      const original = itemId ? originalDetailMap.get(itemId)?.[key] : undefined;
      if (original === undefined) return { color: "black" };

      if (DETAIL_MONEY_KEYS.includes(key)) {
        return stripComma(original) !== stripComma(value) ? { color: "red" } : { color: "black" };
      }
      if (typeof original === "string" && typeof value === "string") {
        return normalizeStr(original) !== normalizeStr(value) ? { color: "red" } : { color: "black" };
      }
      return original !== value ? { color: "red" } : { color: "black" };
    },
    [originalDetailMap, DETAIL_MONEY_KEYS, stripComma, normalizeStr]
  );

  // 하단 셀 값 변경 핸들러: qty/unitPrice → amount 자동계산, amount/taxType → vat/tax 자동계산
  const setDetailCell = useCallback(
    (rowIndex, key, value) => {
      setDetailRows((prev) =>
        prev.map((x, idx) => {
          if (idx !== rowIndex) return x;

          const rawValue = value?.__autoCalc ? value.value : value;
          const itemId = String(x?.item_id ?? "");
          const origRow = itemId ? originalDetailMap.get(itemId) : undefined;
          const origVal = origRow?.[key];
          const actuallyChanged = origRow === undefined
            ? false
            : DETAIL_MONEY_KEYS.includes(key)
              ? stripComma(origVal) !== stripComma(rawValue)
              : normalizeStr(String(origVal ?? "")) !== normalizeStr(String(rawValue ?? ""));
          const updated = { ...x, [key]: value, __dirty: x.__dirty || actuallyChanged };

          // tax/vat 직접 수기 입력 시 자동계산 비활성화 플래그
          if (key === "tax" || key === "vat") {
            updated.__taxManual = true;
            return updated;
          }

          // qty 또는 unitPrice 변경 시: blur 확정(autoCalc=true)이면 amount/과세/부가세 자동계산
          if (key === "qty" || key === "unitPrice") {
            if (value?.__autoCalc) {
              const finalVal = value.value;
              updated[key] = finalVal;
              updated.__taxManual = false;
              // ref에서 읽어온 상대방 값 우선, 없으면 state 값 사용
              const qtyVal = key === "qty" ? finalVal : (value._qtyValue ?? x.qty);
              const upVal = key === "unitPrice" ? finalVal : (value._upValue ?? x.unitPrice);
              const qNum = Number(String(qtyVal).replace(/,/g, "")) || 0;
              const pNum = Number(String(upVal).replace(/,/g, "")) || 0;
              if (qNum && pNum) {
                const autoAmt = qNum * pNum;
                updated.amount = autoAmt.toLocaleString("ko-KR");
                const tType = String(x.taxType ?? "");
                const autoVat = tType === "1" ? Math.floor(autoAmt / 11) : 0;
                const autoTax = tType === "1" ? autoAmt - autoVat : 0;
                updated.vat = autoVat === 0 ? "" : autoVat.toLocaleString("ko-KR");
                updated.tax = autoTax === 0 ? "" : autoTax.toLocaleString("ko-KR");
              }
            }
            return updated;
          }

          // amount 또는 taxType 변경 시: __taxManual 리셋 후 자동계산
          if (key === "amount" || key === "taxType") {
            updated.__taxManual = false;
            const amt = Number(String(key === "amount" ? value : x.amount).replace(/,/g, "")) || 0;
            const tType = String(key === "taxType" ? value : x.taxType);
            const autoVat = tType === "1" ? Math.floor(amt / 11) : 0;
            const autoTax = tType === "1" ? amt - autoVat : 0;
            updated.vat = autoVat === 0 ? "" : autoVat.toLocaleString("ko-KR");
            updated.tax = autoTax === 0 ? "" : autoTax.toLocaleString("ko-KR");
          }

          return updated;
        })
      );
    },
    [setDetailRows, originalDetailMap, DETAIL_MONEY_KEYS, stripComma, normalizeStr]
  );

  // 콤마 포함 문자열 → 숫자 변환 (연산용)
  const toNum = useCallback(
    (v) => {
      const n = Number(stripComma(v));
      return Number.isFinite(n) ? n : 0;
    },
    [stripComma]
  );

  // 수량 × 단가 → 금액 계산
  const computeAmount = useCallback(
    (qty, unitPrice) => {
      const q = toNum(qty);
      const p = toNum(unitPrice);
      return q * p;
    },
    [toNum]
  );

  // ✅ 과세(taxType=1)일 때만 VAT = amount / 11 (버림)
  const computeVat = useCallback((amount, taxType) => {
    const a = Number(amount);
    if (!Number.isFinite(a)) return 0;
    if (String(taxType) !== "1") return 0;
    return Math.floor(a / 11);
  }, []);

  // ✅ 과세(taxType=1)일 때만 과세(공급가액) = amount - VAT
  const computeTax = useCallback((amount, taxType) => {
    const a = Number(amount);
    if (!Number.isFinite(a)) return 0;
    if (String(taxType) !== "1") return 0;
    const vat = Math.floor(a / 11);
    const supply = a - vat;
    return supply > 0 ? supply : 0;
  }, []);

  // ✅ 하단 amount 합계
  const detailAmountSum = useMemo(() => {
    return (detailRows || []).reduce((sum, r) => sum + toNum(r?.amount), 0);
  }, [detailRows, toNum]);

  // 하단 금액 합계 콤마 포맷 (푸터 표시용)
  const detailAmountSumText = useMemo(
    () => detailAmountSum.toLocaleString("ko-KR"),
    [detailAmountSum]
  );

  // ✅ 하단 금액/과세구분 기준으로 상단 과세/부가세/면세/합계를 계산
  const calcMasterTotalsFromDetail = useCallback(
    (list) => {
      let total = 0;
      let tax = 0;
      let vat = 0;
      let taxFree = 0;

      (list || []).forEach((r) => {
        const amt = toNum(r?.amount);
        const taxType = String(r?.taxType ?? "");
        const autoVat = computeVat(amt, taxType);
        const autoTax = computeTax(amt, taxType);
        const inputTax = toNum(r?.tax);
        const inputVat = toNum(r?.vat);
        const hasManualFlag = !!r?.__taxManual;
        const hasManualValue =
          taxType === "1" &&
          (String(stripComma(r?.tax ?? "")) !== "" || String(stripComma(r?.vat ?? "")) !== "") &&
          (inputTax !== autoTax || inputVat !== autoVat);

        total += amt;

        if (hasManualFlag || hasManualValue) {
          // 수기 입력된 행은 해당 값 그대로 사용
          tax += inputTax;
          vat += inputVat;
          if (taxType === "2") taxFree += amt;
        } else if (taxType === "1") {
          tax += autoTax;
          vat += autoVat;
        } else if (taxType === "2") {
          taxFree += amt;
        }
      });

      return { total, tax, vat, taxFree };
    },
    [toNum, computeVat, computeTax, stripComma]
  );

  // 하단 상세 변경 시 해당 상단 행의 과세/부가세/면세/합계 자동 동기화
  useEffect(() => {
    if (!selectedSaleId) return;
    if (detailLoading) return;
    if (!Array.isArray(detailRows) || detailRows.length === 0) return;

    const { total, tax, vat, taxFree } = calcMasterTotalsFromDetail(detailRows);

    setRows((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const targetIndex = prev.findIndex((r) => String(r?.sale_id ?? "") === String(selectedSaleId));
      if (targetIndex < 0) return prev;
      const cur = prev[targetIndex];

      const nextTaxText = tax.toLocaleString("ko-KR");
      const nextVatText = vat.toLocaleString("ko-KR");
      const nextTotalText = total.toLocaleString("ko-KR");
      const nextTaxFreeText = taxFree.toLocaleString("ko-KR");

      const same =
        String(cur?.tax ?? "") === String(nextTaxText) &&
        String(cur?.vat ?? "") === String(nextVatText) &&
        String(cur?.total ?? "") === String(nextTotalText) &&
        String(cur?.taxFree ?? "") === String(nextTaxFreeText);

      if (same) return prev;

      return prev.map((r, i) => {
        if (i !== targetIndex) return r;
        return {
          ...r,
          tax: nextTaxText,
          vat: nextVatText,
          total: nextTotalText,
          taxFree: nextTaxFreeText,
          __dirty: true,
        };
      });
    });
  }, [
    selectedSaleId,
    detailLoading,
    detailRows,
    calcMasterTotalsFromDetail,
    setRows,
  ]);

  // =========================
  // ✅ (NEW) 거래처 Autocomplete 옵션/선택값
  // =========================
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((a) => ({
        value: String(a.account_id),
        label: a.account_name,
        account_type_code: String(a.account_type_code ?? ""),
      })),
    [accountList]
  );

  // 현재 선택된 거래처 Autocomplete 옵션값
  const selectedAccountOption = useMemo(() => {
    const v = String(filters.account_id ?? "");
    const found = (accountList || []).find((a) => String(a.account_id) === v);
    return found ? { value: String(found.account_id), label: found.account_name } : null;
  }, [filters.account_id, accountList]);

  // 텍스트 입력으로 거래처 검색 후 자동 선택 (완전 일치 우선, 부분 일치 폴백)
  const selectAccountByInput = useCallback((inputText) => {
    const q = String(inputText ?? accountInputRef.current ?? "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((o) =>
        String(o?.label || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      handleAccountChange(null, partial);
    }
  }, [accountOptions, handleAccountChange]);

  if (loading) return <LoadingScreen />;

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="ko"
      localeText={koKR.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <DashboardLayout>
        {/* 스크롤 시 상단 네비가 화면 위에 유지되도록 고정 */}
        <MDBox
          sx={{
            position: "sticky",
            top: 0,
            zIndex: isMobile ? theme.zIndex.appBar + 1 : 10,
            backgroundColor: "#ffffff",
          }}
        >
          <DashboardNavbar title="💳 거래처 자료 입력" />
        </MDBox>
        <MDBox
          pt={0.5}
          pb={1}
          sx={{
            display: "flex",
            flexWrap: isMobile ? "wrap" : "nowrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            alignItems: "center",
            gap: 1,
            position: isMobile ? "static" : "sticky",
            zIndex: isMobile ? "auto" : 10,
            top: isMobile ? "auto" : 78,
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #eee",
          }}
        >
          <TextField
            select
            label="타입"
            size="small"
            name="type"
            onChange={handleFilterChange}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.type}
            disabled={typeLoading}
          >
            <option value="0">전체</option>
            {typeOptions
              .filter((o) => !["0", "1000", "1002", "1003", "1008"].includes(String(o?.value ?? "")))
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </TextField>

          {/* 조회구분 필터 (임시 비활성화)
          <TextField
            select
            label="조회구분"
            size="small"
            name="payType"
            onChange={handleFilterChange}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.payType}
          >
            <option value="0">전체</option>
            <option value="1">현금</option>
            <option value="2">카드</option>
          </TextField>
          */}

          <Select
            size="small"
            value={filters.year}
            onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            sx={{ minWidth: 110, height: 40 }}
          >
            {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
              <MenuItem key={y} value={String(y)}>
                {y}년
              </MenuItem>
            ))}
          </Select>

          <Select
            size="small"
            value={filters.month}
            onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
            sx={{ minWidth: 90, height: 40 }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <MenuItem key={m} value={String(m)}>
                {m}월
              </MenuItem>
            ))}
          </Select>

          {/* ✅ 거래처: 검색 가능한 Autocomplete */}
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={accountOptions}
            value={selectedAccountOption}
            onChange={handleAccountChange}
            onInputChange={(_, newValue) => {
              accountInputRef.current = newValue || "";
            }}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt?.value === val?.value}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectAccountByInput(e.currentTarget.value);
                  }
                }}
                sx={{
                  "& .MuiInputBase-root": { height: 45, fontSize: 12 },
                  "& input": { padding: "0 8px" },
                }}
              />
            )}
          />

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSearch}
            sx={{ minWidth: isMobile ? 90 : 100, fontSize: isMobile ? "11px" : "13px" }}
          >
            조회
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            sx={{ minWidth: isMobile ? 90 : 100, fontSize: isMobile ? "11px" : "13px" }}
          >
            저장
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={downloadPurchaseDataExcel}
            sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "11px" : "13px" }}
          >
            엑셀다운로드
          </MDButton>

          {/* 추후 메뉴 복원 시 주석 해제
          <Menu anchorEl={excelAnchorEl} open={excelMenuOpen} onClose={handleExcelMenuClose}>
            <MenuItem onClick={() => handleExcelDownload("purchaseData")}>거래처 자료 입력</MenuItem>
            <MenuItem onClick={() => handleExcelDownload("taxInvoice")}>세금계산서</MenuItem>
            <MenuItem onClick={() => handleExcelDownload("invoice")}>계산서</MenuItem>
            <MenuItem onClick={() => handleExcelDownload("simple")}>간이과세</MenuItem>
          </Menu>
          */}

          <MDButton
            variant="gradient"
            color="info"
            sx={{ minWidth: isMobile ? 70 : 90, fontSize: isMobile ? "11px" : "13px" }}
          >
            인쇄
          </MDButton>
        </MDBox>
        <MDBox
          sx={{
            height: isMobileTablet ? "auto" : "calc(100vh - 170px)",
            minHeight: splitContainerMinHeight,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            mt: isMobile ? 1.5 : 2.5,
          }}
        >
          {/* =========================
            ✅ 상단(집계) 테이블
           ========================= */}
          <MDBox
            ref={masterWrapRef}
            sx={{
              ...tableSx,
              flex: 1,
              minHeight: isMobileTablet ? splitPanelMinHeight : 0,
            }}
          >
            <table key={`master-${masterTableKey}`}>
              <thead>
                <tr>
                  {masterColumns.map((col) => (
                    <th key={col.accessorKey} style={fixedColStyle(col.size)}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={masterColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                      데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => {
                    const rowSaleId = String(row?.sale_id ?? "");
                    const hasDetailDirty = dirtyDetailSaleIds.has(rowSaleId);
                    const cellStyle = (key, value) => {
                      const base = getCellStyle(row, key, value);
                      return hasDetailDirty ? { ...base, color: "red" } : base;
                    };
                    return (
                      <tr
                        key={rowIndex}
                        data-sale-id={rowSaleId}
                        onClick={() => handleMasterRowClick(row, rowIndex)}
                        style={{
                          cursor: "pointer",
                          backgroundColor:
                            rowIndex === selectedMasterIndex
                              ? "rgba(25,118,210,0.10)"
                              : "transparent",
                        }}
                      >
                        {masterColumns.map((col) => {
                          const key = col.accessorKey;
                          const value = key === "type" ? (row.type_name || "") : row[key] ?? "";
                          if (key === "saleDate") {
                            const v = String(value || "");
                            const d = dayjs(v, "YYYY-MM-DD", true).isValid()
                              ? dayjs(v, "YYYY-MM-DD")
                              : null;

                            return (
                              <td
                                key={key}
                                style={fixedColStyle(col.size, {
                                  ...cellStyle(key, value),
                                  padding: "4px",
                                })}
                                onClick={(e) => e.stopPropagation()} // ✅ 행 클릭(상세조회) 방지
                              >
                                <DatePicker
                                  value={d}
                                  onChange={(newVal) => {
                                    // ✅ 달력 선택/직접입력 모두 여기로 들어옴
                                    const next =
                                      newVal && newVal.isValid() ? newVal.format("YYYY-MM-DD") : "";
                                    handleCellChange(rowIndex, key, next);
                                  }}
                                  format="YYYY-MM-DD"
                                  slotProps={{
                                    textField: {
                                      variant: "standard",
                                      fullWidth: true,
                                      inputProps: {
                                        style: {
                                          textAlign: "center",
                                          fontSize: "12px",
                                          padding: "2x",
                                          color: "inherit", // ✅ td의 빨간색/검은색 상속
                                        },
                                      },
                                      InputProps: {
                                        disableUnderline: true,
                                        style: { color: "inherit" }, // ✅ 빨간색 상속
                                      },
                                    },
                                    // ✅ 테이블 overflow/z-index 때문에 캘린더가 잘리는 경우 방지
                                    popper: {
                                      disablePortal: false, // 기본이 portal이긴 한데 명시해두면 안전
                                      sx: { zIndex: 25000 },
                                    },
                                  }}
                                />
                              </td>
                            );
                          }
                          // ✅ 타입(type)은 읽기 전용 표시
                          if (key === "type") {
                            return (
                              <td
                                key={key}
                                style={fixedColStyle(col.size, {
                                  color: "#111",
                                  backgroundColor: "rgba(0,0,0,0.03)",
                                  cursor: "default",
                                  textAlign: "center",
                                })}
                              >
                                {typeNameByValue.get(String(value ?? "")) || String(value ?? "")}
                              </td>
                            );
                          }

                          // ✅ 사업장(account_name)은 수정 불가
                          if (key === "account_name") {
                            return (
                              <td
                                key={key}
                                style={fixedColStyle(col.size, {
                                  color: "#111",
                                  backgroundColor: "rgba(0,0,0,0.03)",
                                  cursor: "default",
                                })}
                                title="사업장명은 수정할 수 없습니다."
                              >
                                {value}
                              </td>
                            );
                          }

                          if (key === "receipt_type") {
                            const rowType = String(row.type ?? "");
                            const receiptOpts = getReceiptTypesByType(rowType);
                            const color = cellStyle(key, value)?.color || "black";
                            const safeVal = normalizeReceiptTypeVal(value, rowType);
                            return (
                              <td key={key} style={fixedColStyle(col.size)} onClick={(e) => e.stopPropagation()}>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={safeVal}
                                  onChange={(e) =>
                                    handleCellChange(
                                      rowIndex,
                                      key,
                                      normalizeReceiptTypeVal(e.target.value, rowType)
                                    )
                                  }
                                  sx={{
                                    fontSize: 12,
                                    height: 25,
                                    "& .MuiSelect-select": { color },
                                    "& .MuiSvgIcon-root": { color },
                                  }}
                                >
                                  {receiptOpts.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </td>
                            );
                          }

                          if (key === "payType") {
                            const safePayType = String(value ?? "").trim();
                            const selectValue =
                              safePayType === "1" || safePayType === "2" ? safePayType : "1";

                            return (
                              <td
                                key={key}
                                style={fixedColStyle(col.size, {
                                  ...cellStyle(key, value),
                                })}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  value={selectValue}
                                  onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                                  style={{
                                    fontSize: "12px",
                                    border: "none",
                                    background: "transparent",
                                    textAlign: "center",
                                    width: "100%",
                                  }}
                                >
                                  <option value="1">현금</option>
                                  <option value="2">카드</option>
                                </select>
                              </td>
                            );
                          }

                          if (key === "receipt_image") {
                            const has = !!value;
                            const stableKey = String(row.sale_id ?? rowIndex);
                            const inputId = `receipt-${stableKey}`;
                            const rowCellStyle = cellStyle(key, value);
                            const iconColor = rowCellStyle?.color === "red" ? "red" : has ? "#1976d2" : "#d32f2f";

                            return (
                              <td key={key} style={fixedColStyle(col.size)}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.5,
                                    width: "100%",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id={inputId}
                                    style={{ display: "none" }}
                                    ref={(el) => { if (el) fileInputRefs.current[inputId] = el; }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.currentTarget.value = "";
                                    }}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const f = e.target.files?.[0];
                                      e.currentTarget.value = "";
                                      if (!f) return;
                                      handleImageUpload(f, rowIndex);
                                    }}
                                  />

                                  {has ? (
                                    <>
                                      <Tooltip title="다운로드">
                                        <span>
                                          <IconButton
                                            size="small"
                                            sx={{ color: iconColor }}
                                            onClick={(ev) => {
                                              ev.stopPropagation();
                                              handleDownload(value);
                                            }}
                                          >
                                            <DownloadIcon fontSize="small" />
                                          </IconButton>
                                        </span>
                                      </Tooltip>

                                      <Tooltip title="미리보기(창)">
                                        <IconButton
                                          size="small"
                                          sx={{ color: iconColor }}
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleViewImage(value);
                                          }}
                                        >
                                          <ImageSearchIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>

                                      <MDButton
                                        type="button"
                                        size="small"
                                        color="info"
                                        sx={{
                                          minWidth: RECEIPT_UPLOAD_BTN_WIDTH,
                                          width: RECEIPT_UPLOAD_BTN_WIDTH,
                                          px: 0.5,
                                          whiteSpace: "nowrap",
                                        }}
                                        onClick={(ev) => {
                                          ev.preventDefault();
                                          ev.stopPropagation();
                                          const el = fileInputRefs.current[inputId];
                                          if (el) { el.value = ""; el.click(); }
                                        }}
                                      >
                                        재업로드
                                      </MDButton>
                                    </>
                                  ) : (
                                    <MDButton
                                      type="button"
                                      size="small"
                                      color="info"
                                      sx={{
                                        minWidth: RECEIPT_UPLOAD_BTN_WIDTH,
                                        width: RECEIPT_UPLOAD_BTN_WIDTH,
                                        px: 0.5,
                                        whiteSpace: "nowrap",
                                      }}
                                      onClick={(ev) => {
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        const el = fileInputRefs.current[inputId];
                                        if (el) { el.value = ""; el.click(); }
                                      }}
                                    >
                                      업로드
                                    </MDButton>
                                  )}
                                </Box>
                              </td>
                            );
                          }

                          if (key === "reg_dt") {
                            return (
                              <td
                                key={key}
                                style={fixedColStyle(col.size, {
                                  color: "#111",
                                  backgroundColor: "rgba(0,0,0,0.03)",
                                  cursor: "default",
                                })}
                                title="등록일자는 수정할 수 없습니다."
                              >
                                {value}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={key}
                              contentEditable
                              suppressContentEditableWarning
                              onClick={(e) => { e.stopPropagation(); selectAllContent(e.currentTarget); }}
                              onKeyDown={(e) => e.stopPropagation()}
                              onFocus={(e) => keepEditableTailVisible(e.currentTarget)}
                              onInput={(e) => keepEditableTailVisible(e.currentTarget)}
                              onBlur={(e) => {
                                const text = e.target.innerText;

                                // ✅ bizNo 자동 포맷
                                if (key === "bizNo") {
                                  const formatted = formatBizNo(text);
                                  handleCellChange(rowIndex, key, formatted);
                                  e.target.innerText = formatted;
                                  return;
                                }

                                if (MONEY_KEYS.includes(key)) {
                                  const formatted = formatComma(text);
                                  handleCellChange(rowIndex, key, formatted);
                                  e.target.innerText = formatted;
                                  return;
                                }

                                handleCellChange(rowIndex, key, text);
                              }}
                              style={fixedColStyle(col.size, {
                                ...cellStyle(key, value),
                              })}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    {/* 합계 라벨: total 컬럼 전까지(과세 이전) */}
                    <td colSpan={Math.max(masterTotalColIndex - 3, 1)} style={fixedColStyle(null)}>합계</td>
                    <td style={fixedColStyle(masterColumns[masterTotalColIndex - 3]?.size)}>{masterSumText.tax}</td>
                    <td style={fixedColStyle(masterColumns[masterTotalColIndex - 2]?.size)}>{masterSumText.vat}</td>
                    <td style={fixedColStyle(masterColumns[masterTotalColIndex - 1]?.size)}>{masterSumText.taxFree}</td>
                    <td style={fixedColStyle(masterColumns[masterTotalColIndex]?.size)}>{masterSumText.total}</td>
                    {masterSummaryTailColSpan > 0 && (
                      <td colSpan={masterSummaryTailColSpan} style={fixedColStyle(null)} />
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </MDBox>

          {/* =========================
          ✅ 하단(상세) 테이블  (✅ 여기서 taxType/itemType 셀을 select로 변경)
         ========================= */}
          <MDBox
            sx={{
              flex: 1,
              minHeight: isMobileTablet ? splitPanelMinHeight : 0,
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
              <MDButton
                variant="gradient"
                color="success"
                onClick={handleDetailAddRow}
                sx={{ minWidth: isMobile ? 110 : 130, fontSize: isMobile ? "11px" : "13px" }}
              >
                상세 행추가
              </MDButton>
            </MDBox>

            <MDBox ref={detailWrapRef} sx={detailTableSx}>
              <table key={`detail-${selectedSaleId || "none"}-${detailTableKey}`}>
                <thead>
                  <tr>
                    {detailColumns.map((col) => (
                      <th key={col.accessorKey} style={fixedColStyle(col.size)}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={detailColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                        상세 조회 중...
                      </td>
                    </tr>
                  ) : !selectedSaleId ? (
                    <tr>
                      <td colSpan={detailColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                        상단에서 행을 클릭하면 상세가 조회됩니다.
                      </td>
                    </tr>
                  ) : detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={detailColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                        상세 데이터가 없습니다. [상세 행추가]로 입력할 수 있습니다.
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((r, i) => {
                      return (
                        <tr
                          key={r.__key ?? r.item_id ?? i}
                          style={{
                            backgroundColor:
                              r.__isNew || r.__dirty ? "rgba(211,47,47,0.10)" : "transparent",
                          }}
                        >
                          <td
                            contentEditable
                            suppressContentEditableWarning
                            onClick={(e) => { e.stopPropagation(); selectAllContent(e.currentTarget); }}
                            onKeyDown={(e) => e.stopPropagation()}
                            onFocus={(e) => keepEditableTailVisible(e.currentTarget)}
                            onInput={(e) => keepEditableTailVisible(e.currentTarget)}
                            onBlur={(e) => setDetailCell(i, "name", e.target.innerText)}
                            style={{
                              ...fixedColStyle(220),
                              textAlign: "left",
                              ...getDetailCellStyle(r, "name", r.name),
                            }}
                          >
                            {r.name ?? ""}
                          </td>

                          <td
                            style={{
                              ...fixedColStyle(90),
                              textAlign: "right",
                              ...getDetailCellStyle(r, "qty", r.qty),
                            }}
                          >
                            <input
                              key={`qty-${i}-${detailTableKey}`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={r.qty ?? ""}
                              ref={(el) => { if (el) qtyRefs.current[i] = el; }}
                              onInput={onNumInput}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                e.target.value = formatted;
                                const upFormatted = formatComma(unitPriceRefs.current[i]?.value ?? "");
                                setDetailCell(i, "qty", { value: formatted, __autoCalc: true, _upValue: upFormatted });
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: getDetailCellStyle(r, "qty", r.qty)?.color || "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              ...fixedColStyle(110),
                              textAlign: "right",
                              ...getDetailCellStyle(r, "unitPrice", r.unitPrice),
                            }}
                          >
                            <input
                              key={`up-${i}-${detailTableKey}`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={r.unitPrice ?? ""}
                              ref={(el) => { if (el) unitPriceRefs.current[i] = el; }}
                              onInput={onNumInput}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                e.target.value = formatted;
                                const qtyFormatted = formatComma(qtyRefs.current[i]?.value ?? "");
                                setDetailCell(i, "unitPrice", { value: formatted, __autoCalc: true, _qtyValue: qtyFormatted });
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: getDetailCellStyle(r, "unitPrice", r.unitPrice)?.color || "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              ...fixedColStyle(110),
                              textAlign: "right",
                              ...getDetailCellStyle(r, "tax", r.tax),
                            }}
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              value={r.tax ?? ""}
                              onInput={onNumInput}
                              onChange={(e) => setDetailCell(i, "tax", e.target.value.replace(/[^\d\-,]/g, ""))}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                setDetailCell(i, "tax", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: getDetailCellStyle(r, "tax", r.tax)?.color || "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              ...fixedColStyle(110),
                              textAlign: "right",
                              ...getDetailCellStyle(r, "vat", r.vat),
                            }}
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              value={r.vat ?? ""}
                              onInput={onNumInput}
                              onChange={(e) => setDetailCell(i, "vat", e.target.value.replace(/[^\d\-,]/g, ""))}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                setDetailCell(i, "vat", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: getDetailCellStyle(r, "vat", r.vat)?.color || "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              ...fixedColStyle(120),
                              textAlign: "right",
                              ...getDetailCellStyle(r, "amount", r.amount),
                            }}
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              defaultValue={r.amount ?? ""}
                              onInput={onNumInput}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                e.target.value = formatted;
                                setDetailCell(i, "amount", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: getDetailCellStyle(r, "amount", r.amount)?.color || "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={fixedColStyle(110, {
                              ...getDetailCellStyle(r, "taxType", r.taxType),
                            })}
                          >
                            <Select
                              size="small"
                              fullWidth
                              displayEmpty
                              value={String(r.taxType ?? "")}
                              onChange={(e) => setDetailCell(i, "taxType", e.target.value)}
                              renderValue={(v) => {
                                if (!v) return <em style={{ color: "#aaa", fontStyle: "normal" }}>선택</em>;
                                const found = DETAIL_TAX_TYPES.find((o) => o.value === v);
                                return found ? `${found.value}:${found.label}` : v;
                              }}
                              sx={{
                                fontSize: 12,
                                height: 25,
                                "& .MuiSelect-select": {
                                  color: getDetailCellStyle(r, "taxType", r.taxType)?.color || "black",
                                },
                                "& .MuiSvgIcon-root": {
                                  color: getDetailCellStyle(r, "taxType", r.taxType)?.color || "black",
                                },
                              }}
                            >
                              <MenuItem value="">
                                <em>선택</em>
                              </MenuItem>
                              {DETAIL_TAX_TYPES.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.value}:{opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </td>

                          <td
                            style={fixedColStyle(110, {
                              ...getDetailCellStyle(r, "itemType", r.itemType),
                            })}
                          >
                            <Select
                              size="small"
                              fullWidth
                              displayEmpty
                              value={String(r.itemType ?? "")}
                              onChange={(e) => setDetailCell(i, "itemType", e.target.value)}
                              renderValue={(v) => {
                                if (!v) return <em style={{ color: "#aaa", fontStyle: "normal" }}>선택</em>;
                                const found = DETAIL_ITEM_TYPES.find((o) => o.value === v);
                                return found ? `${found.value}:${found.label}` : v;
                              }}
                              sx={{
                                fontSize: 12,
                                height: 25,
                                "& .MuiSelect-select": {
                                  color: getDetailCellStyle(r, "itemType", r.itemType)?.color || "black",
                                },
                                "& .MuiSvgIcon-root": {
                                  color: getDetailCellStyle(r, "itemType", r.itemType)?.color || "black",
                                },
                              }}
                            >
                              <MenuItem value="">
                                <em>선택</em>
                              </MenuItem>
                              {DETAIL_ITEM_TYPES.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.value}:{opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {selectedSaleId && detailRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td
                        colSpan={Math.max(detailAmountColIndex, 1)}
                        style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}
                      >
                        합계
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>
                        {detailAmountSumText}
                      </td>
                      <td
                        colSpan={Math.max(detailColumns.length - detailAmountColIndex - 1, 0)}
                        style={{ background: "#f7f7f7" }}
                      />
                    </tr>
                  </tfoot>
                )}
              </table>
            </MDBox>
          </MDBox>
        </MDBox>

        {/* 저장된 증빙자료를 공용 오버레이로 미리보는 영역 */}
        <PreviewOverlay
          open={viewerOpen}
          files={fileItems}
          currentIndex={viewerIndex}
          onChangeIndex={setViewerIndex}
          onClose={handleCloseViewer}
        />
      </DashboardLayout>
    </LocalizationProvider>
  );
}

export default AccountPurchaseDeadlineTab;
