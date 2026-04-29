/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
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

import Autocomplete from "@mui/material/Autocomplete";

import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import PreviewOverlay from "utils/PreviewOverlay";

import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";
import useCorporateCardData from "./data/CorporateCardData";

// 회계 - 본사 법인카드 시트
// ========================= 상수/유틸 =========================
// 기본 카드사 상수
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

// 영수증 타입 목록(상단 테이블용)
const RECEIPT_TYPES = [
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

// 영수증 타입 값 정규화(버튼 업로드 시 API 안정 전달)
const RECEIPT_TYPE_SET = new Set(RECEIPT_TYPES.map((it) => String(it.value)));
const normalizeReceiptTypeVal = (v) => {
  const raw = String(v ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
  const s = raw.toLowerCase();

  if (RECEIPT_TYPE_SET.has(raw)) return raw;

  // 라벨/변형 입력 방어
  if (s.includes("옥션") || s.includes("auction")) return "auction";
  if (s.includes("11번가") || s.includes("11st") || s.includes("11post")) return "11post";
  if (s.includes("g마켓") || s.includes("gmarket")) return "gmarket";
  if (s.includes("편의점") || s === "convenience") return "CONVENIENCE";
  if (s.includes("마트") || s === "mart_itemized" || s === "mart") return "MART_ITEMIZED";
  if (s.includes("쿠팡") || s.includes("coupang")) return "coupang";
  if (s.includes("네이버") || s.includes("naver")) return "naver";
  if (s.includes("홈플러스") || s.includes("homeplus")) return "homeplus";
  if (s.includes("다이소") || s.includes("daiso")) return "daiso";

  return "coupang";
};

// 하단 셀렉트 옵션 목록
const TAX_TYPES = [
  { value: 1, label: "과세" },
  { value: 2, label: "면세" },
  { value: 3, label: "알수없음" },
];

const ITEM_TYPES = [
  { value: 1, label: "식재료" },
  { value: 2, label: "소모품" },
  { value: 3, label: "예산미발행" },
];
const ITEM_TYPE_FILTER_OPTIONS = [
  { value: "0", label: "상품구분 전체" },
  { value: "1", label: "식재료" },
  { value: "2", label: "소모품" },
  { value: "3", label: "예산미발행" },
];
const DETAIL_FILTER_CONCURRENCY = 10;

const onlyDigits = (v = "") => String(v).replace(/\D/g, "");
const isValidCardNoDigits = (v = "") => /^\d{16}$/.test(onlyDigits(v));
const RECEIPT_UPLOAD_BTN_WIDTH = 78;

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
  return `${first}-****-****-${last}`;
};

const normalize = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);

const isChangedValue = (orig, cur) => {
  if (typeof orig === "string" && typeof cur === "string")
    return normalize(orig) !== normalize(cur);
  return orig !== cur;
};

const makeTempId = () => `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// 저장 전 상단 행 정리(내부 플래그 제거)
const cleanMasterRow = (r) => {
  const {
    isNew,
    client_id,
    __dirty,
    __receiptImageDirty,
    __imgTouchedAt,
    __pendingFile,
    __pendingPreviewUrl,
    __pendingAt,
    __manualMasterAmount,
    ...rest
  } = r;
  if (__manualMasterAmount) rest.manualMasterAmount = true;
  return rest;
};
const cleanCardRow = (r) => {
  const { isNew, ...rest } = r;
  return rest;
};
// 저장 전 상세 행 정리(내부 플래그 제거)
const cleanDetailRow = (r) => {
  const { isNew, isForcedRed, ...rest } = r;
  return rest;
};

// 두 자리 패딩 유틸(yyyy-mm-dd 형식용)
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// 연/월 기준 결제일 기본값 생성(당월이면 오늘, 아니면 1일)
const defaultPaymentDtForYM = (year, month) => {
  const t = new Date();
  const y = Number(year);
  const m = Number(month);
  if (t.getFullYear() === y && t.getMonth() + 1 === m) return todayStr();
  return `${y}-${pad2(m)}-01`;
};

// 상단 숫자 컬럼 목록(콤마 표시/저장 시 제거)
const MASTER_NUMBER_KEYS = ["total", "vat", "taxFree", "totalCard", "tax"];
const MASTER_AUTO_CALC_KEYS = ["total", "vat", "taxFree", "tax"];

// 하단 숫자 컬럼 목록
const DETAIL_NUMBER_KEYS = ["qty", "amount", "unitPrice"];

// 하단 Select 컬럼 목록(숫자 enum)
const DETAIL_SELECT_KEYS = ["taxType", "itemType"];

const getFileKind = (pathOrUrl) => {
  const ext = String(pathOrUrl || "").split("?")[0].split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  return "image";
};

// URL 캐시 무력화 유틸(쿼리 파라미터 추가)
const appendQuery = (url, q) => `${url}${url.includes("?") ? "&" : "?"}${q}`;
const buildReceiptUrl = (path, v) => {
  if (!path) return "";
  const base = `${API_BASE_URL}${path}`;
  const vv = v || 0;
  return appendQuery(appendQuery(base, `v=${vv}`), `cb=${Date.now()}`);
};

const parseNumMaybe = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .replace(/\u00A0/g, " ")
    .trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? null : n;
};

// 상세 필드 변경 여부 비교(taxType/itemType은 숫자 비교)
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

// 과세 금액의 부가세를 계산할 때 취소 금액도 승인 금액과 정확히 상쇄되도록 절사
const truncateVatAmount = (amount) => Math.trunc(amount / 11);

// input[type=date] 안정 입력을 위한 날짜 문자열 보정
const toDateInputValue = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// contentEditable 숫자 셀 전체 선택(클릭 시 덮어쓰기 입력)
const selectAllContent = (el) => {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
};

const moveCaretToEnd = (el) => {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
};

const enforceDigitsOnlyEditable = (el) => {
  if (!el) return "";
  const raw = String(el.innerText ?? "");
  const digits = onlyDigits(raw);
  if (raw !== digits) {
    el.innerText = digits;
    moveCaretToEnd(el);
  }
  return digits;
};

const enforceAmountEditable = (el) => {
  if (!el) return "";
  const raw = String(el.innerText ?? "");
  // 맨 앞 -만 유지, 나머지는 숫자만
  const cleaned = raw.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "");
  if (raw !== cleaned) {
    el.innerText = cleaned;
    moveCaretToEnd(el);
  }
  return cleaned;
};

const keepEditableTailVisible = (el) => {
  if (!el) return;
  requestAnimationFrame(() => {
    if (!el || !el.isConnected) return;
    el.scrollLeft = el.scrollWidth;
  });
};

// pending 행 판단 유틸(파일/프리뷰/타임스탬프 존재 여부)
const isPendingRow = (r) => !!r?.__pendingFile || !!r?.__pendingPreviewUrl || !!r?.__pendingAt;

// 기존 저장 행에서 영수증만 재업로드된 상태 구분
const isReceiptImageOnlyDirtyRow = (row) => !row?.isNew && !!row?.__receiptImageDirty;

// 영수증 재업로드 전 다른 컬럼 수정 여부 확인
const hasMasterNonReceiptChange = (row, origRow) => {
  if (!row || row?.__receiptImageDirty) return false;
  if (!origRow) return false;

  const skipKeys = new Set([
    "isNew",
    "client_id",
    "__dirty",
    "__receiptImageDirty",
    "__imgTouchedAt",
    "__pendingFile",
    "__pendingPreviewUrl",
    "__pendingAt",
    "receipt_image",
  ]);

  const keys = new Set([...Object.keys(origRow || {}), ...Object.keys(row || {})]);
  for (const key of keys) {
    if (skipKeys.has(key)) continue;

    if (MASTER_NUMBER_KEYS.includes(key)) {
      if (parseNumber(origRow[key]) !== parseNumber(row[key])) return true;
      continue;
    }

    if (isChangedValue(origRow[key], row[key])) return true;
  }

  return false;
};

// 상단 셀 변경 여부 판단(신규 전체 빨강, 재업로드 영수증 칼럼만 빨강)
const isMasterCellChanged = (row, origRow, key) => {
  if (row?.isNew) return true;
  if (isReceiptImageOnlyDirtyRow(row)) return key === "receipt_image";
  if (row?.__dirty) return true;

  if (MASTER_NUMBER_KEYS.includes(key)) {
    return parseNumber(origRow?.[key]) !== parseNumber(row?.[key]);
  }

  return isChangedValue(origRow?.[key], row?.[key]);
};

const fixedColStyle = (size, extra = {}) => ({
  width: size,
  minWidth: size,
  maxWidth: size,
  ...extra,
});

function CorporateCardSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  const isMobileTabletLandscape = useMediaQuery(
    "(max-width:1279.95px) and (orientation: landscape)"
  );
  // 모바일/태블릿 상하단 테이블 최소 노출 높이
  const splitPanelMinHeight = isMobileTabletLandscape ? 260 : isMobileTablet ? 320 : 0;
  const splitContainerMinHeight = isMobileTablet ? splitPanelMinHeight * 2 + 24 : undefined;

  const {
    loading,
    setLoading,
    withLoading,
    activeRows,
    accountList,
    fetchHeadOfficeCorporateCardList,
    paymentRows,
    setPaymentRows,
    fetchHeadOfficeCorporateCardPaymentList,
    paymentDetailRows,
    fetchHeadOfficeCorporateCardPaymentDetailList,
    fetchAccountList,
  } = useCorporateCardData();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // 상단 결제내역 행 상태 /상단 원본 행(변경 비교 기준)
  const [masterRows, setMasterRows] = useState(null);
  const [origMasterRows, setOrigMasterRows] = useState([]);

  // 하단 테이블 상태
  const [detailRows, setDetailRows] = useState([]);
  const [origDetailRows, setOrigDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 하단 수정 여부 ref
  const detailEditedRef = useRef(false);
  // 상단 조회 중복 방지 ref
  const masterFetchStateRef = useRef({ key: "", promise: null });
  // 저장 중복 방지 ref
  const isSavingRef = useRef(false);
  // 마지막 카드 조회 거래처 ref
  const lastCardFetchAccountRef = useRef("");
  // 파일 input DOM ref 맵
  const fileInputRefs = useRef({});

  // 선택된 상단 행
  const [selectedMaster, setSelectedMaster] = useState(null);
  const selectedMasterRef = useRef(null);
  // 저장 후 선택 복원 시 상단 행 클릭 로직을 직접 호출하기 위한 ref
  const handleMasterRowClickRef = useRef(null);
  // 상단 재조회 렌더 완료 후 선택 복원을 수행할 sale_id
  const pendingMasterRestoreSaleIdRef = useRef("");
  // 선택된 sale_id 상태
  const [selectedSaleId, setSelectedSaleId] = useState("");
  // 선택된 상단 행 인덱스
  const [selectedMasterIndex, setSelectedMasterIndex] = useState(-1);

  // 이동 시 하단 수정 보관 맵
  const [pendingDetailMap, setPendingDetailMap] = useState(new Map());

  // masterRows 최신값 ref(비동기 콜백 내 stale 방지)
  const masterRowsRef = useRef([]);
  useEffect(() => {
    masterRowsRef.current = masterRows;
  }, [masterRows]);

  // 거래처 검색 조건 상태
  const [selectedAccountId, setSelectedAccountId] = useState("");
  // 상품구분 필터 상태
  const [itemTypeFilter, setItemTypeFilter] = useState("0");
  // 상품구분 필터 조회 로딩 상태
  const [masterFilterLoading, setMasterFilterLoading] = useState(false);
  // 거래처 입력 텍스트 ref
  const accountInputRef = useRef("");
  // 상세 itemType 필터 캐시 ref
  const detailItemTypeCacheRef = useRef(new Map());

  // 스캔된 상세 행 강제 빨간 글씨 여부 판단
  const isForcedRedRow = (row) => !!row?.isForcedRed;

  // 상단 테이블 스크롤 래퍼 ref
  const masterWrapRef = useRef(null);
  // 스크롤 위치 보존 ref
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

  // 하단 테이블 스크롤 래퍼 ref
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

  // 저장 성공 후 상단 선택 복원/스크롤 대기용 렌더 완료 대기 함수
  const waitForNextPaint = useCallback(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
    []
  );

  // sale_id로 상단 행 DOM 요소 검색
  const findMasterRowElementBySaleId = useCallback((saleId) => {
    const sid = String(saleId ?? "").trim();
    if (!sid || !masterWrapRef.current) return null;
    const rowEls = masterWrapRef.current.querySelectorAll("tbody tr");
    for (const rowEl of rowEls) {
      if (String(rowEl.getAttribute("data-sale-id") ?? "") === sid) return rowEl;
    }
    return null;
  }, []);

  // sale_id로 상단 행 클릭 트리거(하단 조회 연동)
  const triggerMasterRowClickBySaleId = useCallback(
    (saleId) => {
      const sid = String(saleId ?? "").trim();
      const rows = masterRowsRef.current || [];
      const rowIndex = rows.findIndex((r) => String(r?.sale_id ?? "").trim() === sid);
      if (rowIndex >= 0 && handleMasterRowClickRef.current) {
        handleMasterRowClickRef.current(rows[rowIndex], rowIndex);
        return true;
      }

      const targetRow = findMasterRowElementBySaleId(saleId);
      if (!targetRow) return false;
      targetRow.click();
      return true;
    },
    [findMasterRowElementBySaleId]
  );

  // 선택 상단 행이 화면 밖이면 보이도록 스크롤
  const scrollMasterRowIntoViewBySaleId = useCallback(
    (saleId) => {
      const targetRow = findMasterRowElementBySaleId(saleId);
      if (!targetRow) return false;
      const wrap = masterWrapRef.current;
      if (!wrap) return false;
      const nextTop = targetRow.offsetTop - wrap.clientHeight / 2 + targetRow.offsetHeight / 2;
      wrap.scrollTo({ top: Math.max(0, nextTop), behavior: "auto" });
      masterScrollPosRef.current = wrap.scrollTop;
      return true;
    },
    [findMasterRowElementBySaleId]
  );

  // 저장 완료 후 상단 선택 복원 + 하단 재조회 + 스크롤 수행
  const restoreMasterSelectionAfterSave = useCallback(
    async (saleId) => {
      const sid = String(saleId ?? "").trim();
      if (!sid) return;
      for (let retry = 0; retry < 10; retry += 1) {
        await waitForNextPaint();
        const clicked = triggerMasterRowClickBySaleId(sid);
        if (!clicked) continue;
        await waitForNextPaint();
        scrollMasterRowIntoViewBySaleId(sid);
        return;
      }
    },
    [
      waitForNextPaint,
      triggerMasterRowClickBySaleId,
      scrollMasterRowIntoViewBySaleId,
    ]
  );

  // 영수증 아이콘 기본 색상(정상 상태)
  const normalIconColor = "#1e88e5";
  const [cardNoEditingIndex, setCardNoEditingIndex] = useState(null);

  // 서버 경로 또는 Blob URL 다운로드 처리
  const downloadBySrc = useCallback((src, filename = "download") => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDownloadServerPath = useCallback(
    (path, v) => {
      if (!path || typeof path !== "string") return;
      const url = buildReceiptUrl(path, v);
      const filename = path.split("/").pop() || "download";
      downloadBySrc(url, filename);
    },
    [downloadBySrc]
  );

  // ============================================================
  // 행 잔상 및 contentEditable DOM 잔상 제거 관련 ref/state
  // ============================================================
  // 신규 행 병합 건너뜀 플래그 ref
  const skipPendingNewMergeRef = useRef(false);
  // 서버 강제 동기화 플래그 ref
  const forceServerSyncRef = useRef(false);
  // 상단 테이블 강제 리렌더 키
  const [masterRenderKey, setMasterRenderKey] = useState(0);
  // 하단 테이블 강제 리렌더 키
  const [detailRenderKey, setDetailRenderKey] = useState(0);

  // ========================= 초기 로드: 거래처 목록 =========================
  // 초기 거래처 목록 조회 완료 여부 ref
  const didInitRef = useRef(false);
  // 초기 1회 거래처 목록 조회
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchAccountList();
  }, [fetchAccountList]);

  // 기본 거래처 자동 세팅 완료 여부 ref(1회만 실행)
  const didSetDefaultAccountRef = useRef(false);

  // 거래처 목록 로딩 후 기본 선택값 초기화(초기 1회)
  useEffect(() => {
    if (didSetDefaultAccountRef.current) return;

    if ((accountList || []).length > 0 && !selectedAccountId) {
      setLoading(true);
      setSelectedAccountId(String(accountList[0].account_id));
      didSetDefaultAccountRef.current = true;
    }
  }, [accountList, selectedAccountId]);

  // ========================= 조회 =========================
  // 상품구분 필터 기준 상단 행 필터링
  const filterMasterRowsByItemType = useCallback(
    async (rows) => {
      const targetItemType = Number(itemTypeFilter || 0);
      if (!targetItemType || !Array.isArray(rows) || rows.length === 0) return rows || [];

      setMasterFilterLoading(true);
      try {
        const matched = new Array(rows.length).fill(false);
        const pending = [];

        rows.forEach((row, idx) => {
          const saleId = String(row?.sale_id || "").trim();
          if (!saleId) return;

          const cachedTypeSet = detailItemTypeCacheRef.current.get(saleId);
          if (cachedTypeSet) {
            matched[idx] = cachedTypeSet.has(targetItemType);
            return;
          }

          pending.push({ row, idx, saleId });
        });

        let cursor = 0;
        const worker = async () => {
          while (cursor < pending.length) {
            const current = pending[cursor];
            cursor += 1;

            const { row, idx, saleId } = current;
            try {
              const res = await api.get("/Account/HeadOfficeCorporateCardPaymentDetailList", {
                params: {
                  sale_id: saleId,
                  account_id: row?.account_id ?? selectedAccountId ?? "",
                  payment_dt: row?.payment_dt ?? "",
                },
                validateStatus: () => true,
              });

              const detailList =
                res?.status === 200
                  ? Array.isArray(res?.data)
                    ? res.data
                    : res?.data?.rows || []
                  : [];

              const typeSet = new Set(
                (detailList || [])
                  .map((it) => Number(it?.itemType ?? it?.itemtype ?? 0))
                  .filter((v) => Number.isFinite(v) && v > 0)
              );
              detailItemTypeCacheRef.current.set(saleId, typeSet);
              matched[idx] = typeSet.has(targetItemType);
            } catch (err) {
              console.error("상세 itemType 필터 조회 실패:", err);
              detailItemTypeCacheRef.current.set(saleId, new Set());
              matched[idx] = false;
            }
          }
        };

        const workerCount = Math.min(DETAIL_FILTER_CONCURRENCY, pending.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        return rows.filter((_, idx) => matched[idx]);
      } finally {
        setMasterFilterLoading(false);
      }
    },
    [itemTypeFilter, selectedAccountId]
  );

  // 상단 결제내역 조회(중복 방지 포함)
  const handleFetchMaster = useCallback(async (opts = {}) => {
    const force = !!opts.force;
    const accountId = String(opts.account_id ?? selectedAccountId ?? "").trim();
    if (!accountId) return;
    const key = `${accountId}|${year}|${month}|${itemTypeFilter}`;
    const inflight = masterFetchStateRef.current;

    if (!force && inflight.promise && inflight.key === key) {
      await inflight.promise;
      return;
    }

    const requestPromise = withLoading(async () => {
      const fetchedRows =
        (await fetchHeadOfficeCorporateCardPaymentList({
          year,
          month,
          account_id: accountId,
          itemType: itemTypeFilter,
          setState: false,
        })) || [];

      const filteredRows = await filterMasterRowsByItemType(fetchedRows);
      if (masterFetchStateRef.current.key !== key) return;
      setPaymentRows(filteredRows);
    });
    masterFetchStateRef.current = { key, promise: requestPromise };

    try {
      await requestPromise;
    } finally {
      const cur = masterFetchStateRef.current;
      if (cur.promise === requestPromise) {
        masterFetchStateRef.current = { key, promise: null };
      }
    }
  }, [
    fetchHeadOfficeCorporateCardPaymentList,
    withLoading,
    year,
    month,
    selectedAccountId,
    itemTypeFilter,
    filterMasterRowsByItemType,
    setPaymentRows,
  ]);

  // 조회 버튼 클릭 시 상단 초기화 후 재조회
  const handleSearchMaster = useCallback(async () => {
    if (!selectedAccountId) return;
    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);
    setPendingDetailMap(new Map());
    setSelectedSaleId("");
    setSelectedMasterIndex(-1);
    detailEditedRef.current = false;
    forceServerSyncRef.current = true;
    skipPendingNewMergeRef.current = true;
    await handleFetchMaster();
  }, [selectedAccountId, handleFetchMaster]);

  // 거래처 변경 시 카드 목록만 조회(연/월 변경 시 미재호출)
  useEffect(() => {
    if (!selectedAccountId) {
      lastCardFetchAccountRef.current = "";
      return;
    }
    const accountKey = String(selectedAccountId);
    if (lastCardFetchAccountRef.current === accountKey) return;
    lastCardFetchAccountRef.current = accountKey;
    fetchHeadOfficeCorporateCardList(selectedAccountId);
  }, [selectedAccountId, fetchHeadOfficeCorporateCardList]);

  // 거래처/연/월/상품구분 변경 시 상단 자동 조회
  useEffect(() => {
    if (!selectedAccountId) return;

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);
    setPendingDetailMap(new Map());
    setSelectedSaleId("");
    setSelectedMasterIndex(-1);
    detailEditedRef.current = false;

    forceServerSyncRef.current = true;
    skipPendingNewMergeRef.current = true;

    handleFetchMaster();
  }, [selectedAccountId, year, month, itemTypeFilter, handleFetchMaster]);

  // 거래처 무관 전체 카드 목록(중복 제거)
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

  // account_id → 거래처명 맵
  const accountNameById = useMemo(() => {
    const m = new Map();
    (accountList || []).forEach((a) => m.set(String(a.account_id), a.account_name));
    return m;
  }, [accountList]);

  // 거래처 Autocomplete 옵션 목록
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((a) => ({
        value: String(a.account_id),
        label: a.account_name,
      })),
    [accountList]
  );

  // 현재 선택된 거래처 Autocomplete 옵션 값
  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  // 입력 텍스트로 거래처 선택(Enter 키 처리)
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
      setSelectedAccountId(partial.value);
    }
  }, [accountOptions]);

  // 서버 paymentRows 갱신 시 masterRows 병합 처리
  useEffect(() => {
    saveMasterScroll();
    const serverRows = (paymentRows || [])
      .slice()
      .sort((a, b) => {
        const da = String(a?.payment_dt ?? "");
        const db = String(b?.payment_dt ?? "");
        if (da !== db) return da.localeCompare(db);
        const sa = String(a?.sale_id ?? "");
        const sb = String(b?.sale_id ?? "");
        return sa.localeCompare(sb);
      })
      .map((r) => ({ ...r }));

    setMasterRows((prev) => {
      const forceSync = forceServerSyncRef.current;
      const keepNew = !skipPendingNewMergeRef.current && !forceSync;
      const pendingNew = keepNew ? (prev || []).filter((r) => r?.isNew) : [];
      skipPendingNewMergeRef.current = false;

      // dirty 또는 pending(재업로드 대기) 행 로컬 보존
      const prevLocalMap = new Map();
      if (!forceSync) {
        (prev || []).forEach((r) => {
          const sid = String(r?.sale_id || "").trim();
          if (!sid) return;

          const hasPending = isPendingRow(r);
          if (r?.__dirty || hasPending) prevLocalMap.set(sid, r);
        });
      }

      // 서버 rows 기본, 로컬(dirty/pending) 존재 시 로컬 우선 병합
      const merged = forceSync
        ? serverRows
        : serverRows.map((sr) => {
          const sid = String(sr?.sale_id || "").trim();
          const local = sid ? prevLocalMap.get(sid) : null;
          return local ? { ...sr, ...local } : sr;
        });

      forceServerSyncRef.current = false;

      return [...merged, ...pendingNew];
    });

    // orig는 서버 기준으로 유지(변경 비교 기준)
    setOrigMasterRows(serverRows);

    setSelectedMaster(null);
    setDetailRows([]);
    setOrigDetailRows([]);
    setPendingDetailMap(new Map());
    setSelectedSaleId("");
    setSelectedMasterIndex(-1);

    setMasterRenderKey((k) => k + 1);
  }, [paymentRows, saveMasterScroll]);

  // 서버 paymentDetailRows 갱신 시 하단 행 초기화
  useEffect(() => {
    saveDetailScroll();
    const copy = (paymentDetailRows || []).map((r) => ({
      ...r,
      isForcedRed: false,
      isNew: false,
    }));
    setDetailRows(copy);
    setOrigDetailRows(copy);
    detailEditedRef.current = false;
    setDetailLoading(false);
    setDetailRenderKey((k) => k + 1);
  }, [paymentDetailRows, saveDetailScroll]);

  // 상단 테이블 리렌더 후 스크롤 위치 복원
  useLayoutEffect(() => {
    const el = masterWrapRef.current;
    if (el) el.scrollTop = masterScrollPosRef.current;
  }, [masterRenderKey]);

  // 하단 테이블 리렌더 후 스크롤 위치 복원
  useLayoutEffect(() => {
    const el = detailWrapRef.current;
    if (el) el.scrollTop = detailScrollPosRef.current;
  }, [detailRenderKey, selectedMaster?.sale_id]);

  // 로딩 완료 후 상하단 스크롤 위치 복원
  useLayoutEffect(() => {
    if (loading) return;
    const masterEl = masterWrapRef.current;
    if (masterEl) masterEl.scrollTop = masterScrollPosRef.current;
    const detailEl = detailWrapRef.current;
    if (detailEl) detailEl.scrollTop = detailScrollPosRef.current;
  }, [loading]);

  // 행에서 카드번호 숫자 추출
  const getRowCardNoDigits = (row) => onlyDigits(row?.cardNo ?? row?.card_no ?? row?.cardno ?? "");

  // 행에서 카드사명 추출
  const getRowCardBrand = (row) =>
    row?.cardBrand ?? row?.card_brand ?? row?.cardbrand ?? DEFAULT_CARD_BRAND;

  // 행에서 영수증 타입 추출 및 정규화
  const getRowReceiptType = (row) =>
    normalizeReceiptTypeVal(row?.receipt_type ?? row?.receiptType ?? row?.type);

  // 영수증 파일 선택 가능 여부 검증(카드번호 16자리 필요)
  const canOpenReceiptFilePicker = useCallback((row) => {
    const cardNoDigits = onlyDigits(row?.cardNo ?? row?.card_no ?? row?.cardno ?? "");
    if (!isValidCardNoDigits(cardNoDigits)) {
      Swal.fire("안내", "카드번호를 먼저 선택해주세요. (16자리)", "info");
      return false;
    }
    return true;
  }, []);

  // ========================= 변경 핸들러 =========================
  // 상단 셀 값 변경 처리
  const handleMasterCellChange = useCallback((rowIndex, key, value) => {
    setMasterRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
            ...r,
            [key]: value,
            __receiptImageDirty: false,
            ...(MASTER_AUTO_CALC_KEYS.includes(key) ? { __manualMasterAmount: true } : {}),
          }
          : r
      )
    );
  }, []);

  // 하단 셀 값 변경 처리
  const handleDetailCellChange = useCallback(
    (rowIndex, key, value) => {
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
        detailEditedRef.current = true;
        return prev.map((r, i) => (i === rowIndex ? { ...r, [key]: nextVal } : r));
      });
    },
    []
  );

  // 상단 행 카드번호 선택 처리
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
            __receiptImageDirty: false,
          };
        });
      });
    },
    [cardsAll]
  );

  // 상단 신규 행 추가
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
      tax: 0,
      totalCard: 0,
      cardNo: auto?.card_no || "",
      cardBrand: auto?.card_brand || DEFAULT_CARD_BRAND,

      receipt_type: "coupang",

      receipt_image: "",
      note: "",
      reg_dt: "",
      user_id: localStorage.getItem("user_id") || "",

      // 재업로드 대기값(초기 없음)
      __pendingFile: null,
      __pendingPreviewUrl: "",
      __pendingAt: 0,
      __receiptImageDirty: false,

      isNew: true,
    };

    setMasterRows((prev) => [...prev, newRow]);
    requestAnimationFrame(() => scrollMasterToBottom(true));
  }, [year, month, scrollMasterToBottom, selectedAccountId, cardsAll]);

  // 하단 신규 행 추가
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
    detailEditedRef.current = true;
    setDetailRenderKey((k) => k + 1);

    requestAnimationFrame(() => scrollDetailToBottom(true));
  }, [selectedMaster, scrollDetailToBottom]);

  // 영수증 이미지 업로드 및 스캔 처리
  const handleImageUpload = useCallback(
    async (file, rowIndex) => {
      if (!file) return;

      // 업로드 순간 최신 row 참조(stale 방지)
      const row = masterRowsRef.current?.[rowIndex] || {};

      // 최신값 안전 추출
      const accountId = String(row.account_id || "");
      const cardNoDigits = getRowCardNoDigits(row);
      const cardBrand = getRowCardBrand(row);
      const receiptType = normalizeReceiptTypeVal(getRowReceiptType(row));
      const saleId = String(row.sale_id || "").trim();
      const origRow = saleId
        ? (origMasterRows || []).find((r) => String(r?.sale_id || "").trim() === saleId)
        : null;
      const highlightReceiptOnly =
        !!row.__receiptImageDirty || (!row.isNew && !hasMasterNonReceiptChange(row, origRow));
      // 본사 법인카드 영수증 스캔 엔드포인트(모든 타입 동일 처리)
      const parseEndpoint = "/Corporate/receipt-scan";

      console.log("SCAN payload", {
        accountId,
        cardNoDigits,
        cardBrand,
        receiptType,
        sale_id: row.sale_id,
      });

      if (!accountId || !cardNoDigits) {
        return Swal.fire(
          "경고",
          "영수증 업로드 전에 거래처와 카드번호를 먼저 선택해주세요.",
          "warning"
        );
      }
      if (!isValidCardNoDigits(cardNoDigits)) {
        return Swal.fire("경고", "영수증 업로드 전에 카드번호 16자리를 선택해주세요.", "warning");
      }
      if (!receiptType) {
        return Swal.fire("경고", "영수증타입을 선택해주세요.", "warning");
      }

      // 업로드 시작 표시(dirty/pending 플래그 초기화)
      setMasterRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex
            ? {
              ...r,
              __dirty: true,
              __receiptImageDirty: highlightReceiptOnly,
              __imgTouchedAt: Date.now(),
              __pendingFile: null,
              __pendingPreviewUrl: "",
              __pendingAt: 0,
            }
            : r
        )
      );

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

        // 스캔 API 필수 파라미터 추가
        formData.append("type", receiptType);
        formData.append("receiptType", receiptType);
        formData.append("objectValue", accountId);
        formData.append("folderValue", "acnCorporate");
        formData.append("cardNo", cardNoDigits);
        formData.append("cardBrand", cardBrand);
        formData.append("saveType", "headoffice");

        // 기존 sale_id 포함(재업로드/재스캔 구분)
        formData.append("sale_id", row.sale_id || "");

        const res = await api.post(parseEndpoint, formData, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        Swal.close();

        if (res.status !== 200) {
          return Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
        }

        const data = res.data || {};
        const main = data.main || data || {};
        const items = Array.isArray(data.item) ? data.item : [];
        const parsedCardNoDigits = onlyDigits(main.cardNo);
        const safeCardNo = isValidCardNoDigits(parsedCardNoDigits)
          ? parsedCardNoDigits
          : getRowCardNoDigits(row);

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
          ...(main.tax != null ? { tax: parseNumber(main.tax) } : {}),
          ...(main.taxFree != null ? { taxFree: parseNumber(main.taxFree) } : {}),
          ...(main.totalCard != null ? { totalCard: parseNumber(main.totalCard) } : {}),
          ...(main.cardNo != null ? { cardNo: safeCardNo } : {}),
          ...(main.cardBrand != null ? { cardBrand: main.cardBrand } : {}),
          ...(main.receipt_image != null ? { receipt_image: main.receipt_image } : {}),
          ...(main.receipt_type != null ? { receipt_type: main.receipt_type } : {}),
        };

        // 스캔 결과를 상단 행에 반영
        setMasterRows((prev) =>
          prev.map((r, i) => {
            if (i !== rowIndex) return r;
            return {
              ...r,
              ...patch,
              account_id: patch.account_id !== undefined ? patch.account_id : r.account_id ?? "",
              __dirty: true,
              __receiptImageDirty: highlightReceiptOnly,
              __imgTouchedAt: Date.now(),
            };
          })
        );

        // 스캔 결과를 하단 행에 반영
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
            ...row,
            ...patch,
            account_id: patch.account_id !== undefined ? patch.account_id : row.account_id ?? "",
            __receiptImageDirty: highlightReceiptOnly,
          };
          setSelectedMaster(patchedSelected);

          setDetailRows(normalized);
          setOrigDetailRows(normalized.map((x) => ({ ...x })));
          detailEditedRef.current = false;
          setDetailRenderKey((k) => k + 1);
        }

        const nextSaleId = String(main.sale_id || row.sale_id || "").trim();

        await Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        forceServerSyncRef.current = true;
        skipPendingNewMergeRef.current = true;
        if (nextSaleId) pendingMasterRestoreSaleIdRef.current = nextSaleId;
        await handleFetchMaster({ force: true });
      } catch (err) {
        Swal.close();
        Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
      }
    },
    [handleFetchMaster, origMasterRows]
  );

  // 하단 수정 있는 sale_id 집합(상단 행 색상 표시용)
  const dirtyDetailSaleIds = useMemo(() => {
    const ids = new Set();
    if (selectedSaleId && detailRows.some((r) => r.__dirty || r.isNew || r.isForcedRed)) {
      ids.add(String(selectedSaleId));
    }
    for (const [saleId] of pendingDetailMap.entries()) {
      ids.add(String(saleId));
    }
    return ids;
  }, [detailRows, selectedSaleId, pendingDetailMap]);

  // ========================= 저장: main + item + (재업로드 pending files) =========================
  // 원본 상단 행 sale_id → 행 맵(변경 비교 기준)
  const origMasterBySaleId = useMemo(() => {
    const m = new Map();
    for (const r of origMasterRows || []) {
      if (r?.sale_id != null && String(r.sale_id) !== "") m.set(String(r.sale_id), r);
    }
    return m;
  }, [origMasterRows]);

  const normalizeMasterForSave = useCallback((r) => {
    const row = cleanMasterRow(r);

    // ✅ receipt_type 항상 포함
    row.receipt_type = normalizeReceiptTypeVal(row.receipt_type ?? r.receipt_type ?? "coupang");

    MASTER_NUMBER_KEYS.forEach((k) => {
      if (row[k] !== undefined) row[k] = parseNumber(row[k]);
    });

    return row;
  }, []);

  const calcMasterTotalsFromDetail = useCallback((rows) => {
    const list = rows || [];
    let total = 0;
    let tax = 0;
    let vat = 0;
    let taxFree = 0;

    list.forEach((r) => {
      const amt = parseNumber(r?.amount);
      const tt = parseNumMaybe(r?.taxType);
      total += amt;

      if (tt === 1) {
        const rowVat = truncateVatAmount(amt);
        const rowTax = amt - rowVat;
        tax += rowTax;
        vat += rowVat;
      } else if (tt === 2) {
        taxFree += amt;
      }
    });

    return { total, tax, vat, taxFree };
  }, []);

  // ========================= 마스터 행 클릭 (pendingDetailMap 보존/복원) =========================
  const handleMasterRowClick = useCallback(
    (row, rowIndex) => {
      const saleId = row?.sale_id;
      saveMasterScroll();

      const nextSaleId = saleId ? String(saleId) : null;
      const prevSaleId = selectedSaleId ? String(selectedSaleId) : null;

      const hasDirty = detailEditedRef.current;
      const isSameRow = nextSaleId && nextSaleId === prevSaleId;

      // 같은 행 재클릭 + 수정 있으면 현재 rows 그대로 유지
      if (isSameRow && hasDirty) {
        setSelectedMaster(row);
        if (selectedMasterIndex !== rowIndex) setSelectedMasterIndex(rowIndex);
        return;
      }

      // 다른 행으로 이동 시 수정 있으면 map에 저장
      if (prevSaleId && hasDirty && !isSameRow) {
        setPendingDetailMap((prev) => {
          const next = new Map(prev);
          next.set(prevSaleId, { rows: detailRows, originalRows: origDetailRows });
          return next;
        });
      }

      setDetailRows([]);
      setOrigDetailRows([]);
      detailEditedRef.current = false;

      if (!nextSaleId) {
        setSelectedMaster(row);
        if (selectedMasterIndex !== rowIndex) setSelectedMasterIndex(rowIndex);
        return;
      }

      setSelectedMaster(row);
      if (selectedMasterIndex !== rowIndex) setSelectedMasterIndex(rowIndex);
      if (nextSaleId !== prevSaleId) setSelectedSaleId(nextSaleId);

      // map에 캐시가 있으면 복원, 없으면 API 조회
      const cached = pendingDetailMap.get(nextSaleId);
      if (cached) {
        setDetailRows(cached.rows ?? []);
        setOrigDetailRows(cached.originalRows ?? []);
        return;
      }

      setDetailLoading(true);
      fetchHeadOfficeCorporateCardPaymentDetailList({
        sale_id: nextSaleId,
        account_id: row.account_id,
        payment_dt: row.payment_dt,
      });
    },
    [
      selectedSaleId,
      selectedMasterIndex,
      detailRows,
      origDetailRows,
      pendingDetailMap,
      saveMasterScroll,
      fetchHeadOfficeCorporateCardPaymentDetailList,
    ]
  );

  useEffect(() => {
    handleMasterRowClickRef.current = handleMasterRowClick;
  }, [handleMasterRowClick]);

  // 상단 재조회 결과가 렌더된 뒤 저장했던 행을 다시 선택하고 하단 상세를 조회한다.
  useEffect(() => {
    const sid = String(pendingMasterRestoreSaleIdRef.current ?? "").trim();
    if (!sid) return;

    pendingMasterRestoreSaleIdRef.current = "";
    restoreMasterSelectionAfterSave(sid);
  }, [masterRenderKey, restoreMasterSelectionAfterSave]);

  const saveAll = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      const active = document.activeElement;
      if (active && (active.isContentEditable || active.tagName === "INPUT")) {
        active.blur();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const userId = localStorage.getItem("user_id") || "";

      // 누적 보관소에 현재 하단 수정값 병합
      const fullDetailMap = new Map();
      for (const [k, v] of pendingDetailMap.entries()) {
        const r = Array.isArray(v) ? v : (v?.rows ?? []);
        const o = Array.isArray(v) ? [] : (v?.originalRows ?? []);
        fullDetailMap.set(k, { rows: r, originalRows: o });
      }
      if (selectedSaleId && detailRows.length > 0) {
        fullDetailMap.set(String(selectedSaleId), { rows: detailRows, originalRows: origDetailRows });
      }

      // 모든 sale_id의 하단 변경분 취합 + 마스터 합계 자동계산
      let allModifiedDetail = [];
      let currentMasterRows = masterRows || [];

      for (const [saleId, { rows: savedDetailRows, originalRows: savedOriginalRows }] of fullDetailMap.entries()) {
        const masterForSaleId = (masterRows || []).find((r) => String(r?.sale_id ?? "") === String(saleId));
        const topAccountId = masterForSaleId?.account_id ?? selectedMaster?.account_id ?? "";
        const topPaymentDt = masterForSaleId?.payment_dt ?? selectedMaster?.payment_dt ?? "";

        const origMap = new Map();
        (savedOriginalRows || []).forEach((r) => {
          const k = String(r?.item_id ?? "");
          if (k) origMap.set(k, r);
        });

        const detailForSave = (savedDetailRows || [])
          .map((r) => {
            const base = { ...cleanDetailRow(r), account_id: topAccountId, payment_dt: topPaymentDt, user_id: userId };
            if (r?.isNew || isForcedRedRow(r)) return base;
            const itemId = String(r?.item_id ?? "");
            const o = itemId ? origMap.get(itemId) : null;
            if (!o) return base;
            const changed = Object.keys(r).some((k) => isDetailFieldChanged(k, o[k], r[k]));
            return changed ? base : null;
          })
          .filter(Boolean);

        allModifiedDetail = allModifiedDetail.concat(detailForSave);

        if (detailForSave.length > 0 && !masterForSaleId?.__manualMasterAmount) {
          const { total, tax, vat, taxFree } = calcMasterTotalsFromDetail(savedDetailRows);
          currentMasterRows = currentMasterRows.map((r) => {
            if (String(r?.sale_id ?? "") !== String(saleId)) return r;
            return { ...r, total, tax, vat, taxFree };
          });
        }
      }

      // pendings (파일 첨부)
      const pendings = (masterRows || [])
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => isPendingRow(r));

      // 상단: 변경된 행만 (자동계산 반영된 currentMasterRows 기준)
      const main = currentMasterRows
        .map((r) => {
          if (r.isNew) return { ...normalizeMasterForSave(r), user_id: userId };
          if (r.__dirty) return { ...normalizeMasterForSave(r), user_id: userId };
          const sid = String(r.sale_id || "");
          const o = sid ? origMasterBySaleId.get(sid) : null;
          if (!o) return { ...normalizeMasterForSave(r), user_id: userId };
          const changed = Object.keys(r).some((k) => {
            if (MASTER_NUMBER_KEYS.includes(k)) return parseNumber(o[k]) !== parseNumber(r[k]);
            return isChangedValue(o[k], r[k]);
          });
          return changed ? { ...normalizeMasterForSave(r), user_id: userId } : null;
        })
        .filter(Boolean);

      if (main.length === 0 && allModifiedDetail.length === 0 && pendings.length === 0) {
        return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
      }

      // 과세구분/상품구분 미선택 검증
      const invalidRows = allModifiedDetail.filter(
        (r) => !String(r?.taxType ?? "").trim() || !String(r?.itemType ?? "").trim()
      );
      if (invalidRows.length > 0) {
        const missingTax = invalidRows.some((r) => !String(r?.taxType ?? "").trim());
        const missingItem = invalidRows.some((r) => !String(r?.itemType ?? "").trim());
        const missingMsg =
          missingTax && missingItem
            ? "과세구분과 상품구분이"
            : missingTax
              ? "과세구분이"
              : "상품구분이";
        return Swal.fire("저장 불가", `하단 상세 ${invalidRows.length}행에 ${missingMsg} 선택되지 않았습니다.\n선택 후 저장해주세요.`, "warning");
      }

      Swal.fire({
        title: "저장 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // 파일이 있으면 multipart로 전송
      if (pendings.length > 0) {
        const form = new FormData();
        form.append(
          "payload",
          new Blob([JSON.stringify({ main, item: allModifiedDetail })], { type: "application/json" })
        );
        pendings.forEach(({ r, idx }) => {
          const rowKey = String(r.sale_id || r.client_id || idx);
          if (!r.__pendingFile) return;
          form.append("files", r.__pendingFile);
          form.append("fileRowKeys", rowKey);
          form.append(
            "fileMetas",
            new Blob(
              [JSON.stringify({
                rowKey,
                sale_id: r.sale_id || "",
                account_id: r.account_id || "",
                payment_dt: r.payment_dt || "",
                receipt_type: r.receipt_type || "",
                cardNo: r.cardNo || "",
                cardBrand: r.cardBrand || "",
                user_id: userId,
              })],
              { type: "application/json" }
            )
          );
        });
        const res = await api.post(
          "/Account/HeadOfficeCorporateCardPaymentAllSaveWithFiles",
          form,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        if (!(res.data?.code === 200 || res.status === 200)) {
          Swal.close();
          return Swal.fire("실패", res.data?.message || "저장 실패", "error");
        }
      } else {
        const res = await api.post(
          "/Account/HeadOfficeCorporateCardPaymentAllSave",
          { main, item: allModifiedDetail },
          { headers: { "Content-Type": "application/json" } }
        );
        if (!(res.data?.code === 200 || res.status === 200)) {
          Swal.close();
          return Swal.fire("실패", res.data?.message || "저장 실패", "error");
        }
      }

      setPendingDetailMap(new Map());
      detailEditedRef.current = false;

      const nextMasterRows = (currentMasterRows || []).map((r) => {
        if (r.__pendingPreviewUrl) {
          try { URL.revokeObjectURL(r.__pendingPreviewUrl); } catch (e) { /* ignore */ }
        }
        const { __pendingFile, __pendingPreviewUrl, __pendingAt, __receiptImageDirty, ...rest } = r;
        return { ...rest, __dirty: false, __receiptImageDirty: false, isNew: false, isForcedRed: false };
      });
      setMasterRows(nextMasterRows);
      setOrigMasterRows(nextMasterRows.map((r) => ({ ...r })));

      setOrigDetailRows(detailRows.map((x) => ({ ...x, isForcedRed: false, isNew: false })));
      setDetailRows((prev) => prev.map((x) => ({ ...x, isForcedRed: false, isNew: false })));
      detailEditedRef.current = false;
      setDetailRenderKey((k) => k + 1);

      const savedSaleId = String(selectedSaleId || selectedMaster?.sale_id || "").trim();

      Swal.close();
      await Swal.fire("성공", "저장되었습니다.", "success");

      // 저장 후 서버 정렬 기준으로 다시 조회한 뒤 저장 직전 선택한 상단행을 다시 선택한다.
      forceServerSyncRef.current = true;
      skipPendingNewMergeRef.current = true;
      if (savedSaleId) pendingMasterRestoreSaleIdRef.current = savedSaleId;
      await handleFetchMaster({ force: true });
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 오류", "error");
    } finally {
      isSavingRef.current = false;
    }
  }, [
    masterRows,
    detailRows,
    origDetailRows,
    pendingDetailMap,
    selectedSaleId,
    selectedMaster,
    origMasterBySaleId,
    normalizeMasterForSave,
    calcMasterTotalsFromDetail,
    handleFetchMaster,
    restoreMasterSelectionAfterSave,
  ]);

  // ========================= ✅ "윈도우"처럼 이동 가능한 이미지 뷰어 =========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerId, setViewerId] = useState(null);


  // ✅ imageItems: pending(로컬) 우선, 없으면 서버 receipt_image
  const imageItems = useMemo(() => {
    return (masterRows || [])
      .map((r, idx) => {
        const id = String(r.sale_id || r.client_id || idx); // ✅ 안정키

        // ✅ 재업로드 대기중이면 로컬 미리보기 우선
        if (r.__pendingPreviewUrl) {
          const localKind = getFileKind(r.__pendingFile?.name || r.__pendingPreviewUrl);
          return {
            id,
            rowIndex: idx,
            sale_id: r.sale_id || "",
            path: r.receipt_image || "",
            src: r.__pendingPreviewUrl,
            url: r.__pendingPreviewUrl,
            kind: localKind,
            name: r.__pendingFile?.name || `영수증_${idx + 1}`,
            isLocal: true,
            title: `${r.use_name || ""} ${toDateInputValue(r.payment_dt) || ""}`.trim(),
            v: r.__pendingAt || 0,
          };
        }

        // ✅ 서버 이미지
        if (!r?.receipt_image) return null;
        const v = r.__imgTouchedAt || 0;
        const serverSrc = buildReceiptUrl(r.receipt_image, v);
        return {
          id,
          rowIndex: idx,
          sale_id: r.sale_id || "",
          path: r.receipt_image,
          src: serverSrc,
          url: serverSrc,
          kind: getFileKind(r.receipt_image),
          name: r.receipt_image.split("/").pop() || `영수증_${idx + 1}`,
          isLocal: false,
          title: `${r.use_name || ""} ${toDateInputValue(r.payment_dt) || ""}`.trim(),
          v,
        };
      })
      .filter(Boolean);
  }, [masterRows]);

  // ✅ viewerIndex는 "딱 1번만" 선언
  const viewerIndex = useMemo(() => {
    if (!imageItems.length) return 0;
    if (!viewerId) return 0;
    const i = imageItems.findIndex((x) => x.id === viewerId);
    return i >= 0 ? i : 0;
  }, [viewerId, imageItems]);

  const handleViewImage = useCallback(
    (row, rowIndex) => {
      const id = String(row.sale_id || row.client_id || rowIndex);
      setViewerId(id);
      setViewerOpen(true);
    },
    []
  );

  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  // ✅ 컴포넌트 unmount 시 pending preview revoke(메모리 누수 방지)
  useEffect(() => {
    return () => {
      try {
        (masterRows || []).forEach((r) => {
          if (r?.__pendingPreviewUrl) URL.revokeObjectURL(r.__pendingPreviewUrl);
        });
      } catch (e) {
        // ignore
      }
    };
  }, [masterRows]);

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
      { header: "과세", key: "tax", editable: true, size: 90 },
      { header: "부가세", key: "vat", editable: true, size: 90 },
      { header: "면세", key: "taxFree", editable: true, size: 90 },
      { header: "합계금액", key: "total", editable: true, size: 110 },
      { header: "카드번호", key: "cardNo", editable: false, size: 200 },
      { header: "카드사", key: "cardBrand", editable: false, size: 130 },
      {
        header: "영수증타입",
        key: "receipt_type",
        editable: true,
        size: 120,
        type: "select",
        options: RECEIPT_TYPES,
      },
      { header: "영수증사진", key: "receipt_image", editable: false, size: 180 },
      { header: "비고", key: "note", editable: true, size: 160 },
      { header: "등록일자", key: "reg_dt", editable: false, size: 110 },
    ],
    []
  );

  const detailColumns = useMemo(
    () => [
      { header: "상품명", key: "name", editable: true, size: 220 },
      { header: "수량", key: "qty", editable: true, size: 80 },
      { header: "단가", key: "unitPrice", editable: true, size: 100 },
      { header: "금액", key: "amount", editable: true, size: 100 },
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

  // ✅ (추가) 하단 amount 합계 계산
  const sumDetailAmount = useCallback((rows) => {
    return (rows || []).reduce((acc, r) => acc + parseNumber(r?.amount), 0);
  }, []);

  // ✅ (추가) 상단 total 합계(전체 행)
  const masterTotalSum = useMemo(() => {
    return (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.total), 0);
  }, [masterRows]);

  // 상단 과세/부가세/면세 합계
  const sumMasterTax = useMemo(() => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.tax), 0), [masterRows]);
  const sumMasterVat = useMemo(() => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.vat), 0), [masterRows]);
  const sumMasterTaxFree = useMemo(() => (masterRows || []).reduce((acc, r) => acc + parseNumber(r?.taxFree), 0), [masterRows]);

  // ✅ (추가) 하단 amount 합계(현재 선택된 상세 목록)
  const detailAmountSum = useMemo(() => {
    return sumDetailAmount(detailRows || []);
  }, [detailRows, sumDetailAmount]);

  // ✅ (추가) footer 위치를 위해 컬럼 index
  const masterTotalColIndex = useMemo(
    () => masterColumns.findIndex((c) => c.key === "total"),
    [masterColumns]
  );

  const detailAmountColIndex = useMemo(
    () => detailColumns.findIndex((c) => c.key === "amount"),
    [detailColumns]
  );

  useEffect(() => {
    selectedMasterRef.current = selectedMaster;
  }, [selectedMaster]);

  // ========================= ✅ 하단 수정 → 상단 자동 반영(과세/면세 분해 포함) =========================
  useEffect(() => {
    const selectedMaster = selectedMasterRef.current;
    if (!selectedMaster) return;

    // 하단이 아예 없으면 상단을 0으로 덮어쓰지 않도록(원하면 정책 변경 가능)
    if (!(detailRows || []).length) return;
    if (!detailEditedRef.current) return;

    // ✅ 상단에서 저장된 행이면 sale_id로, 신규면 client_id로 매칭
    const masterKey = selectedMaster.sale_id
      ? { type: "sale_id", value: String(selectedMaster.sale_id) }
      : selectedMaster.client_id
        ? { type: "client_id", value: String(selectedMaster.client_id) }
        : null;

    if (!masterKey) return;

    // 1) 하단 amount 합계로 상단 total 자동 반영
    const nextTotal = (detailRows || []).reduce((acc, r) => acc + parseNumber(r?.amount), 0);

    // 2) taxType 기준으로 과세/면세 자동 분리
    //    - 과세(1): 부가세 = amount/11 절사, 과세 = amount - 부가세
    //    - 면세(2): taxFree에 누적
    let nextTax = 0;
    let nextVat = 0;
    let nextTaxFree = 0;

    (detailRows || []).forEach((r) => {
      const amt = parseNumber(r?.amount);
      const tt = parseNumMaybe(r?.taxType); // 1/2/3 or null

      if (tt === 1) {
        const rowVat = truncateVatAmount(amt);
        const rowTax = amt - rowVat;
        nextTax += rowTax;
        nextVat += rowVat;
      } else if (tt === 2) {
        nextTaxFree += amt;
      } else {
        // 알수없음(3)이나 미선택("")은 total만 맞추고 분해는 하지 않음
        // 정책 바꾸고 싶으면 여기서 처리
      }
    });

    // 3) masterRows 업데이트 (불필요한 set 방지)
    setMasterRows((prev) => {
      const idx = (prev || []).findIndex((r) =>
        masterKey.type === "sale_id"
          ? String(r.sale_id) === masterKey.value
          : String(r.client_id) === masterKey.value
      );
      if (idx < 0) return prev;

      const row = prev[idx];
      if (row?.__manualMasterAmount) return prev;

      // 기존 값과 동일하면 업데이트 안 함 (무한렌더/깜빡임 방지)
      const same =
        parseNumber(row.total) === nextTotal &&
        parseNumber(row.tax) === nextTax &&
        parseNumber(row.vat) === nextVat &&
        parseNumber(row.taxFree) === nextTaxFree;

      if (same) return prev;

      const next = [...prev];
      next[idx] = {
        ...row,
        total: nextTotal,
        tax: nextTax,
        vat: nextVat,
        taxFree: nextTaxFree,
        // 필요하면 totalCard도 같이 맞추려면:
        // totalCard: nextTotal,
      };
      return next;
    });

    // 선택된 행 state도 같이 최신화(하이라이트/화면 동기화)
    setSelectedMaster((prevSel) => {
      if (!prevSel) return prevSel;
      if (prevSel?.__manualMasterAmount) return prevSel;
      const sameSelected =
        parseNumber(prevSel.total) === nextTotal &&
        parseNumber(prevSel.tax) === nextTax &&
        parseNumber(prevSel.vat) === nextVat &&
        parseNumber(prevSel.taxFree) === nextTaxFree;
      if (sameSelected) return prevSel;
      return {
        ...prevSel,
        total: nextTotal,
        tax: nextTax,
        vat: nextVat,
        taxFree: nextTaxFree,
      };
    });
  }, [detailRows]);

  if (loading || !selectedAccountId || masterRows === null) return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* ====== 상단 sticky 헤더 ====== */}
      <MDBox
        sx={{
          // 스크롤 시 상단 네비가 화면 위에 유지되도록 고정
          position: "sticky",
          top: 0,
          zIndex: isMobile ? theme.zIndex.appBar + 1 : 10,
          backgroundColor: "#ffffff",
        }}
      >
        <DashboardNavbar title="💳 거래처(본사) 법인카드 관리" />
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
          // 모바일에서는 상단 툴바를 고정하지 않음
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
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
          <Select
            size="small"
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(String(e.target.value))}
            sx={{ minWidth: 140 }}
          >
            {ITEM_TYPE_FILTER_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>

          {/* ✅ 거래처 검색 가능한 Autocomplete */}
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={accountOptions}
            value={selectedAccountOption}
            onChange={(_, opt) => {
              // 입력 비움 시 거래처 선택 유지
              if (!opt) return;
              setSelectedAccountId(opt.value);
            }}
            onInputChange={(_, newValue) => {
              accountInputRef.current = newValue || "";
            }}
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

          <MDButton
            color="info"
            onClick={handleSearchMaster}
            disabled={masterFilterLoading}
            sx={{ minWidth: 80 }}
          >
            {masterFilterLoading ? "조회중..." : "조회"}
          </MDButton>

          <MDButton color="info" onClick={addMasterRow} sx={{ minWidth: 90 }}>
            행추가
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

      {/* ====== 상단/하단 50:50 영역 ====== */}
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
        {/* ========================= 상단(50%) 결제내역 ========================= */}
        <MDBox
          ref={masterWrapRef}
          sx={{
            flex: 1,
            minHeight: isMobileTablet ? splitPanelMinHeight : 0,
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
          }}
        >
          <table key={`master-${selectedAccountId}-${year}-${month}-${itemTypeFilter}-${masterRenderKey}`}>
            <thead>
              <tr>
                {masterColumns.map((c) => (
                  <th key={c.key} style={fixedColStyle(c.size)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {masterRows.length === 0 ? (
                <tr>
                  <td colSpan={masterColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                    데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                  </td>
                </tr>
              ) : masterRows.map((row, rowIndex) => (
                <tr
                  key={row.sale_id || row.client_id || rowIndex}
                  data-sale-id={String(row.sale_id || "")}
                  style={{
                    background:
                      selectedMaster?.sale_id && selectedMaster?.sale_id === row.sale_id && row.sale_id
                        ? "#d3f0ff"
                        : "white",
                    cursor: "pointer",
                  }}
                  onClick={() => handleMasterRowClick(row, rowIndex)}
                >
                  {masterColumns.map((c) => {
                    const key = c.key;

                    const rawVal = row[key] ?? "";
                    const val = MASTER_NUMBER_KEYS.includes(key) ? formatNumber(rawVal) : rawVal;
                    const origRow = origMasterRows[rowIndex] || {};

                    const pending = isPendingRow(row);
                    const hasDetailDirty = row.sale_id ? dirtyDetailSaleIds.has(String(row.sale_id)) : false;

                    // ✅ 변경여부
                    const changed = hasDetailDirty ? true : isMasterCellChanged(row, origRow, key);

                    if (key === "account_id") {
                      const acctName =
                        accountNameById.get(String(row.account_id)) || String(row.account_id || "");
                      return (
                        <td
                          key={key}
                          style={fixedColStyle(c.size, {
                            color: changed ? "red" : "#111",
                            backgroundColor: "rgba(0,0,0,0.03)",
                            cursor: "default",
                          })}
                          title="거래처는 수정할 수 없습니다."
                        >
                          {acctName}
                        </td>
                      );
                    }

                    if (key === "payment_dt") {
                      const dateVal = toDateInputValue(rawVal);
                      return (
                        <td key={key} style={fixedColStyle(c.size)}>
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
                        <td key={key} style={fixedColStyle(c.size)}>
                          <Select
                            size="small"
                            fullWidth
                            value={onlyDigits(row.cardNo) || ""}
                            renderValue={(selected) => {
                              const d = onlyDigits(selected);
                              return d ? maskCardNo(d) : "카드 선택";
                            }}
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
                        <td key={key} style={fixedColStyle(c.size, { color: changed ? "red" : "black" })}>
                          {row.cardBrand || ""}
                        </td>
                      );
                    }

                    // ✅ 영수증타입 Select
                    if (key === "receipt_type") {
                      return (
                        <td key={key} style={fixedColStyle(c.size)}>
                          <Select
                            size="small"
                            fullWidth
                            value={normalizeReceiptTypeVal(row.receipt_type)}
                            onChange={(e) =>
                              handleMasterCellChange(
                                rowIndex,
                                "receipt_type",
                                normalizeReceiptTypeVal(e.target.value)
                              )
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
                      const stableKey = String(row.sale_id || row.client_id || rowIndex);
                      const inputId = `receipt-${stableKey}`;
                      const hasPending = pending;

                      const iconColor = changed ? "red" : normalIconColor;

                      return (
                        <td key={key} style={fixedColStyle(c.size)}>
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
                              ref={(el) => {
                                if (el) fileInputRefs.current[inputId] = el;
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.value = ""; // ✅ 파일창 뜨기 직전에 초기화 (같은 파일도 change 뜸)
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                const f = e.target.files?.[0];
                                console.log("file picked:", f);
                                e.currentTarget.value = ""; // ✅ 이것도 빈 문자열로
                                if (!f) return;
                                handleImageUpload(f, rowIndex);
                              }}
                            />

                            {has ? (
                              <>
                                <Tooltip title={hasPending ? "대기파일 다운로드" : "다운로드"}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      sx={{ color: iconColor }}
                                      onClick={(ev) => {
                                        ev.stopPropagation();

                                        if (row.__pendingPreviewUrl) {
                                          downloadBySrc(
                                            row.__pendingPreviewUrl,
                                            `receipt_pending_${row.sale_id || rowIndex}.jpg`
                                          );
                                          return;
                                        }

                                        handleDownloadServerPath(rawVal, row.__imgTouchedAt);
                                      }}
                                    >
                                      <DownloadIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title={hasPending ? "미리보기(대기파일)" : "미리보기(창)"}>
                                  <IconButton
                                    size="small"
                                    sx={{ color: iconColor }}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleViewImage(row, rowIndex);
                                    }}
                                  >
                                    <ImageSearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>

                                {/* ✅ label 제거하고 ref로 click */}
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
                                    if (!canOpenReceiptFilePicker(row)) return;
                                    const el = fileInputRefs.current[inputId];
                                    if (el) {
                                      el.value = ""; // ✅ 반드시 빈 문자열로
                                      el.click();
                                    }
                                  }}
                                >
                                  재업로드
                                </MDButton>

                                {hasPending && (
                                  <Typography variant="caption" sx={{ color: "red" }}>
                                    대기중
                                  </Typography>
                                )}
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
                                  if (!canOpenReceiptFilePicker(row)) return;
                                  const el = fileInputRefs.current[inputId];
                                  if (el) {
                                    el.value = ""; // ✅ 반드시 빈 문자열로
                                    el.click();
                                  }
                                }}
                              >
                                업로드
                              </MDButton>
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
                          style={fixedColStyle(c.size, { color: changed ? "red" : "black" })}
                          onFocus={(ev) => keepEditableTailVisible(ev.currentTarget)}
                          onInput={(ev) => keepEditableTailVisible(ev.currentTarget)}
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
                      <td key={key} style={fixedColStyle(c.size, { color: changed ? "red" : "black" })}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* 상단 합계 — 데이터 있을 때만 표시 */}
            {masterRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={fixedColStyle(null)}>합계</td>
                  <td style={fixedColStyle(masterColumns[4]?.size)}>{formatNumber(sumMasterTax)}</td>
                  <td style={fixedColStyle(masterColumns[5]?.size)}>{formatNumber(sumMasterVat)}</td>
                  <td style={fixedColStyle(masterColumns[6]?.size)}>{formatNumber(sumMasterTaxFree)}</td>
                  <td style={fixedColStyle(masterColumns[7]?.size)}>{formatNumber(masterTotalSum)}</td>
                  <td colSpan={masterColumns.length - 8} style={fixedColStyle(null)} />
                </tr>
              </tfoot>
            )}
          </table>
        </MDBox>

        {/* ========================= 하단(50%) 상세내역 ========================= */}
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
            }}
          >
            <table key={`detail-${selectedMaster?.sale_id || "new"}-${detailRenderKey}`}>
              <thead>
                <tr>
                  {detailColumns.map((c) => (
                    <th key={c.key} style={fixedColStyle(c.size)}>
                      {c.header}
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
                ) : detailRows.map((row, rowIndex) => {
                  const origRow = origDetailRows[rowIndex] || {};
                  const isDetailRowChanged =
                    row.isNew || row.isForcedRed
                      ? true
                      : Object.keys(row).some((k) => isDetailFieldChanged(k, origRow[k], row[k]));
                  return (
                    <tr
                      key={rowIndex}
                      style={{
                        backgroundColor: isDetailRowChanged ? "rgba(211,47,47,0.10)" : "transparent",
                      }}
                    >
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
                        const isAmountCol = key === "amount";
                        const displayVal = isNumCol ? formatNumber(rawVal) : String(rawVal ?? "");

                        if (c.type === "select") {
                          const curNum = parseNumMaybe(rawVal);
                          const curStr = curNum == null ? "" : String(curNum);

                          return (
                            <td key={key} style={fixedColStyle(c.size)}>
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
                              style={fixedColStyle(c.size, { color: changed ? "red" : "black" })}
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
                                  // amount 컬럼은 음수(-) 유지
                                  const raw = String(parseNumber(el.innerText) || "");
                                  el.innerText = isAmountCol
                                    ? raw === "0" ? "" : raw
                                    : raw;
                                  selectAllContent(el);
                                });
                              }}
                              onFocus={(ev) => {
                                const el = ev.currentTarget;
                                if (!isNumCol) {
                                  keepEditableTailVisible(el);
                                  return;
                                }

                                // amount 컬럼은 음수(-) 유지
                                const raw = String(parseNumber(el.innerText) || "");
                                el.innerText = isAmountCol
                                  ? raw === "0" ? "" : raw
                                  : raw;
                                requestAnimationFrame(() => {
                                  if (!el || !el.isConnected) return;
                                  selectAllContent(el);
                                });
                              }}
                              onInput={(ev) => {
                                if (isAmountCol) {
                                  enforceAmountEditable(ev.currentTarget);
                                  return;
                                }
                                if (isNumCol) {
                                  enforceDigitsOnlyEditable(ev.currentTarget);
                                  return;
                                }
                                keepEditableTailVisible(ev.currentTarget);
                              }}
                              onKeyDown={(ev) => {
                                if (!isNumCol) return;
                                if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
                                const allowKeys = [
                                  "Backspace",
                                  "Delete",
                                  "ArrowLeft",
                                  "ArrowRight",
                                  "ArrowUp",
                                  "ArrowDown",
                                  "Tab",
                                  "Home",
                                  "End",
                                ];
                                if (allowKeys.includes(ev.key)) return;
                                if (isAmountCol && ev.key === "-") return;
                                if (!/^\d$/.test(ev.key)) {
                                  ev.preventDefault();
                                }
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
                          <td key={key} style={fixedColStyle(c.size, { color: changed ? "red" : "black" })}>
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {/* 하단 합계 — 데이터 있을 때만 표시 */}
              {detailRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={fixedColStyle(null)}>합계</td>
                    <td style={fixedColStyle(detailColumns[3]?.size)}>
                      {formatNumber(detailAmountSum)}
                    </td>
                    {detailColumns.slice(4).map((c) => (
                      <td key={c.key} style={fixedColStyle(c.size)} />
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </MDBox>
        </MDBox>
      </MDBox>

      {/* ========================= ✅ 떠있는 창 미리보기 ========================= */}
      <PreviewOverlay
        open={viewerOpen}
        files={imageItems}
        currentIndex={viewerIndex}
        onChangeIndex={(updater) => {
          const next = typeof updater === "function" ? updater(viewerIndex) : updater;
          const safeNext = Math.min(Math.max(0, next), imageItems.length - 1);
          setViewerId(imageItems[safeNext]?.id ?? null);
        }}
        onClose={handleCloseViewer}
        anchorX={1 / 3}
      />

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

