// src/layouts/account/AccountPurchaseTallyTab.js
/* eslint-disable react/function-component-definition */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  TextField,
  useTheme,
  useMediaQuery,
  Box,
  IconButton,
  MenuItem,
} from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete";

import Paper from "@mui/material/Paper";
import Draggable from "react-draggable";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import api from "api/api";
import { API_BASE_URL } from "config";
import useAccountPurchaseTallyData from "./accountPurchaseTallyData";

// ✅ 연월 입력 로케일 설정
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { koKR } from "@mui/x-date-pickers/locales";

const MONEY_REFORMAT_MAX_ROWS = 700;
const TAX_TOTAL_KEY_TO_PREFIX = {
  expen_taxTotal: "expen",
  food_taxTotal: "food",
  scenic_taxTotal: "scenic",
};
const VAT_KEY_TO_PREFIX = {
  expen_vat: "expen",
  food_vat: "food",
  scenic_vat: "scenic",
};
const AMOUNT_COLUMN_KEYS = [
  "expen_taxTotal",
  "expen_vat",
  "expen_total",
  "food_taxTotal",
  "food_vat",
  "food_total",
  "scenic_taxTotal",
  "scenic_vat",
  "scenic_total",
];

function AccountPurchaseTallyTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  const isMobileTabletLandscape = useMediaQuery(
    "(max-width:1279.95px) and (orientation: landscape)"
  );
  // 모바일/태블릿에서는 테이블이 너무 낮아지지 않도록 최소 높이를 보장
  const tableMinHeight = isMobileTabletLandscape ? 250 : isMobileTablet ? 330 : 0;
  const tableMaxHeight = isMobileTabletLandscape
    ? "calc(100vh - 160px)"
    : isMobileTablet
      ? "calc(100vh - 200px)"
      : "calc(100vh - 140px)";

  // ✅ 조회조건 상태: year/month "0" = 전체, account_id "" = 전체
  const now = new Date();
  const [filters, setFilters] = useState({
    type: "0",
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    account_id: "",
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);
  const [accountInput, setAccountInput] = useState("");

  // ✅ 타입 옵션: 거래처 선택 시 서버에서 조회 (거래처에 등록된 타입만 표시)
  const [typeOptions, setTypeOptions] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);

  // ✅ 데이터 훅 사용
  const { rows, setRows, originalRows, mappingRows, loading, fetchPurchaseList, fetchMappingList } =
    useAccountPurchaseTallyData();

  // ✅ (NEW) 우클릭(컨텍스트) 메뉴 상태 (행 삭제)
  const [ctxMenu, setCtxMenu] = useState({
    open: false,
    mouseX: 0,
    mouseY: 0,
    rowIndex: null,
  });
  const tableWrapRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const dataTableRef = useRef(null);
  const [isBodyOverflow, setIsBodyOverflow] = useState(false);
  const [isDateRenderPending, setIsDateRenderPending] = useState(false);
  const [tableViewportHeight, setTableViewportHeight] = useState(null);
  const [excelDownloading, setExcelDownloading] = useState(false);

  // ✅ account_id -> account_name 매핑
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((a) => map.set(String(a.account_id), String(a.account_name || "")));
    return map;
  }, [accountList]);

  // =========================================
  // ✅ (NEW) 조회 파라미터는 "거래처 + 월"만 보내기
  // =========================================
  // ✅ 타입 옵션 정규화: 서버 응답을 [{value, label}] 배열로 변환
  const normalizeTypeOptions = useCallback((data) => {
    const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const mapped = arr
      .map((x) => {
        const value = x?.type ?? x?.account_type ?? x?.mapping_type ?? x?.code ?? x?.value ?? x?.id;
        const delYn = String(x?.del_yn ?? "N");
        const label =
          x?.type_name ?? x?.account_type_name ?? x?.mapping_name ?? x?.name ?? x?.label ??
          x?.text ?? x?.value_name ?? x?.type ?? x?.account_type ?? x?.code ?? x?.value;
        if (value === null || value === undefined || String(value).trim() === "") return null;
        return { value: String(value), label: String(label ?? value), del_yn: delYn };
      })
      .filter((x) => x && String(x.del_yn) !== "Y");
    const uniq = [];
    const seen = new Set();
    for (const o of mapped) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      uniq.push({ value: o.value, label: o.label });
    }

    // 기본 기타 타입(1002/1003)이 응답에서 누락된 경우 보강
    const blockedSpecial = new Set(
      arr
        .map((x) => ({
          type: String(x?.type ?? x?.value ?? ""),
          del_yn: String(x?.del_yn ?? "N"),
        }))
        .filter((x) => (x.type === "1002" || x.type === "1003") && x.del_yn === "Y")
        .map((x) => x.type)
    );
    if (!seen.has("1002") && !blockedSpecial.has("1002")) {
      uniq.push({ value: "1002", label: "기타경비" });
      seen.add("1002");
    }
    if (!seen.has("1003") && !blockedSpecial.has("1003")) {
      uniq.push({ value: "1003", label: "기타" });
      seen.add("1003");
    }

    uniq.sort((a, b) => {
      const an = Number(a.value);
      const bn = Number(b.value);
      const aNum = Number.isFinite(an);
      const bNum = Number.isFinite(bn);
      if (aNum && bNum) return an - bn;
      return String(a.value).localeCompare(String(b.value), "ko");
    });
    return uniq;
  }, []);

  // ✅ 거래처 기준으로 타입 옵션 조회
  const fetchTypeOptions = useCallback(
    async (accountId) => {
      if (!accountId) {
        setTypeOptions([]);
        return [];
      }
      try {
        setTypeLoading(true);
        const res = await api.get("/Operate/AccountMappingV2List", {
          params: { account_id: accountId, _ts: Date.now() },
        });
        const opts = normalizeTypeOptions(res?.data);
        setTypeOptions(opts);
        return opts;
      } catch (e) {
        console.error("타입 옵션 조회 실패(/Operate/AccountMappingV2List):", e);
        setTypeOptions([]);
        return [];
      } finally {
        setTypeLoading(false);
      }
    },
    [normalizeTypeOptions]
  );

  // ✅ 현재 type이 옵션에 없으면 첫 번째 옵션으로 보정
  // - "0"(전체)은 항상 유효 → 그대로 유지
  // - 기존 type이 opts에 있으면 그대로 유지
  // - 없으면 첫 번째 옵션으로 세팅 (처음 렌더 시 거래처 타입이 바로 나오게)
  const resolveNextType = useCallback((opts, currentType) => {
    const cur = String(currentType ?? "");
    if (cur === "0") return cur;
    if (opts?.some((o) => o.value === cur)) return cur;
    if (opts?.length) return String(opts[0].value);
    return cur;
  }, []);

  const buildSearchParams = useCallback((f) => ({
    account_id: String(f?.account_id ?? ""),
    type: String(f?.type ?? "0"),
    year: String(f?.year ?? "0"),
    month: String(f?.month ?? "0"),
  }), []);

  // =========================================
  // ✅ (핵심) 행추가로 index 밀려도 기존행이 빨개지지 않게:
  // - 각 행에 _rowKey 부여
  // - originalRows를 Map(key->row)로 참조해서 비교
  // =========================================
  const makeStableKey = useCallback((r, fallbackIndex) => {
    const saleId = r?.sale_id ?? r?.saleId;
    if (saleId !== undefined && saleId !== null && String(saleId) !== "") return `sale:${saleId}`;

    const itemId = r?.item_id ?? r?.itemId;
    if (itemId !== undefined && itemId !== null && String(itemId) !== "") return `item:${itemId}`;

    const aid = String(r?.account_id ?? "");
    const dt = String(r?.saleDate ?? "");
    const t = String(r?.type ?? "");
    return `mix:${aid}|${dt}|${t}|${fallbackIndex ?? 0}`;
  }, []);

  const originalByKey = useMemo(() => {
    const map = new Map();
    (originalRows || []).forEach((o, idx) => {
      const k = o?._rowKey || makeStableKey(o, idx);
      map.set(k, o);
    });
    return map;
  }, [originalRows, makeStableKey]);

  // =========================================
  // ✅ 숫자(콤마 대상) 컬럼
  // =========================================
  const MONEY_KEYS = useMemo(
    () => [
      "expen_tax",
      "expen_vat",
      "expen_taxFree",
      "expen_total",
      "food_tax",
      "food_vat",
      "food_taxFree",
      "food_total",
      "scenic_tax",
      "scenic_vat",
      "scenic_taxFree",
      "scenic_total",
    ],
    []
  );

  const stripComma = useCallback((v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/,/g, "").replace(/\s+/g, "").trim();
  }, []);

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

  const toNum = useCallback(
    (v) => {
      const raw = stripComma(v);
      if (raw === "") return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    },
    [stripComma]
  );

  const getTaxTotalNumByPrefix = useCallback(
    (row, prefix) => toNum(row?.[`${prefix}_tax`]) + toNum(row?.[`${prefix}_taxFree`]),
    [toNum]
  );

  const getTaxTotalTextByPrefix = useCallback(
    (row, prefix) => formatComma(getTaxTotalNumByPrefix(row, prefix)),
    [formatComma, getTaxTotalNumByPrefix]
  );

  // =========================================
  // ✅ saleDate(저장용)를 YYYY-MM으로 강제 정규화
  // =========================================
  const normalizeSaleMonth = useCallback((v) => {
    if (!v) return "";
    const d = dayjs(v);
    if (d.isValid()) return d.format("YYYY-MM");
    const s = String(v).trim();
    if (s.length >= 7) return s.slice(0, 7);
    return s;
  }, []);

  const isDateCellsReady = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return true;
    return rows.every((r) => {
      const saleDateText = String(r?.saleDate ?? "").trim();
      if (!saleDateText) return true;
      return String(r?._saleMonth ?? "").trim() !== "";
    });
  }, [rows]);

  // =========================================
  // ✅ 구매처 옵션 (mappingRows 기반)
  // =========================================
  const purchaseOptions = useMemo(() => {
    return (mappingRows || [])
      .map((m) => ({
        value: String(m.type ?? ""),
        label: String(m.name ?? ""),
      }))
      .filter((x) => x.value !== "");
  }, [mappingRows]);

  // ✅ type -> name 매핑
  const purchaseNameByType = useMemo(() => {
    const map = new Map();
    (mappingRows || []).forEach((m) => {
      const t = String(m.type ?? "");
      if (!t) return;
      map.set(t, String(m.name ?? ""));
    });
    return map;
  }, [mappingRows]);

  // =========================================
  // ✅ 조회된 rows 가공
  // =========================================
  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const shouldReformatMoney = rows.length <= MONEY_REFORMAT_MAX_ROWS;

    const nextRows = rows.map((r, idx) => {
      const nr = { ...r };

      if (!nr._rowKey) nr._rowKey = makeStableKey(nr, idx);

      const aid = String(nr.account_id ?? "");
      const aname = accountNameById.get(aid) || "";
      if (aname) nr.account_name = aname;

      if (shouldReformatMoney) {
        MONEY_KEYS.forEach((k) => {
          nr[k] = formatComma(nr[k]);
        });
      }

      if (nr.saleDate) nr._saleMonth = normalizeSaleMonth(nr.saleDate);
      else nr._saleMonth = "";

      const t = String(nr.type ?? "");
      if (t) {
        const mappedName = purchaseNameByType.get(t) || "";
        if (!String(nr.name ?? "").trim() && mappedName) nr.name = mappedName;
        if (!String(nr.purchase_name ?? "").trim() && (nr.name || mappedName))
          nr.purchase_name = nr.name || mappedName;
      }

      return nr;
    });

    const changed = nextRows.some((nr, i) => {
      const r = rows[i];
      if (!r) return true;

      if (String(nr._rowKey ?? "") !== String(r._rowKey ?? "")) return true;

      if (shouldReformatMoney) {
        const moneyChanged = MONEY_KEYS.some((k) => String(nr?.[k] ?? "") !== String(r?.[k] ?? ""));
        if (moneyChanged) return true;
      }

      if (String(nr._saleMonth ?? "") !== String(r._saleMonth ?? "")) return true;
      if (String(nr.name ?? "") !== String(r.name ?? "")) return true;
      if (String(nr.purchase_name ?? "") !== String(r.purchase_name ?? "")) return true;
      if (String(nr.account_name ?? "") !== String(r.account_name ?? "")) return true;

      return false;
    });

    if (changed) setRows(nextRows);
  }, [
    rows,
    setRows,
    MONEY_KEYS,
    formatComma,
    purchaseNameByType,
    accountNameById,
    makeStableKey,
    normalizeSaleMonth,
  ]);

  useEffect(() => {
    if (loading) {
      setIsDateRenderPending(true);
      return;
    }

    if (!isDateCellsReady) {
      setIsDateRenderPending(true);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setIsDateRenderPending(false);
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [loading, isDateCellsReady, rows.length]);

  // ✅ 최초 로딩: 거래처 목록 조회 후 첫 번째 거래처 자동 선택 및 조회
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      try {
        const res = await api.get("/Account/AccountListV2", { params: { account_type: "0" } });
        const list = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(list);
        // ✅ 기본값은 "전체"가 아니라 조회된 첫 번째 거래처를 자동 선택
        if (list.length > 0) {
          const first = list[0];
          const firstId = String(first.account_id ?? "");
          const firstName = String(first.account_name ?? "");
          setAccountInput(firstName);

          // 거래처 기준 구매처 매핑/타입 옵션 조회만 선반영 (조회는 사용자 액션 시점에만 실행)
          fetchMappingList({ account_id: firstId });
          const opts = await fetchTypeOptions(firstId);
          const nextType = resolveNextType(opts, "0");
          const nextFilters = { ...filters, account_id: firstId, type: nextType };

          setFilters(nextFilters);
        } else {
          // 거래처 목록이 비어 있으면 필터만 기본값으로 유지
          fetchMappingList({});
        }
      } catch (err) {
        console.error("데이터 조회 실패 (AccountList):", err);
      }
    })();
  }, []); // eslint-disable-line

  // ✅ 조회(버튼)
  const handleSearch = async () => {
    try {
      await fetchPurchaseList(buildSearchParams(filters));
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    }
  };

  // =========================================
  // ✅ 셀 색상 고정 (클릭/수정 시 빨간색 표시 비활성화)
  // =========================================
  const getCellStyle = () => ({ color: "black" });

  const getCellColor = () => "black";

  // =========================================
  // ✅ 자동합계(의미 기반)
  // =========================================
  const VAT_RATE = 0.1;
  const calcVatText = useCallback(
    (taxText) => {
      const tax = toNum(taxText);
      if (!tax) return formatComma(0);
      const vat = Math.round(tax * VAT_RATE);
      return formatComma(vat);
    },
    [toNum, formatComma]
  );

  const handleCellChange = useCallback(
    (rowIndex, key, value) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIndex) return r;

          const next = { ...r, _isDirty: true };
          const taxTotalPrefix = TAX_TOTAL_KEY_TO_PREFIX[key];
          if (taxTotalPrefix) {
            next[`${taxTotalPrefix}_tax`] = value;
            next[`${taxTotalPrefix}_taxFree`] = formatComma(0);
            next[`${taxTotalPrefix}_vat`] = calcVatText(value);
            const sum = toNum(value) + toNum(next[`${taxTotalPrefix}_vat`]);
            next[`${taxTotalPrefix}_total`] = formatComma(sum);
            return next;
          }

          next[key] = value;

          const vatPrefix = VAT_KEY_TO_PREFIX[key];
          if (vatPrefix) {
            const taxTotal = toNum(next[`${vatPrefix}_tax`]) + toNum(next[`${vatPrefix}_taxFree`]);
            const sum = taxTotal + toNum(next[`${vatPrefix}_vat`]);
            next[`${vatPrefix}_total`] = formatComma(sum);
          }

          return next;
        })
      );
    },
    [setRows, toNum, formatComma, calcVatText]
  );

  const handleSaleMonthChange = useCallback(
    (rowIndex, nextMonth) => {
      const normalizedMonth = normalizeSaleMonth(nextMonth);
      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex
            ? (() => {
              const currentMonthText = String(r?._saleMonth ?? "");
              const currentNormalized = normalizeSaleMonth(currentMonthText || r?.saleDate);
              if (currentMonthText === normalizedMonth && currentNormalized === normalizedMonth) {
                return r;
              }
              if (currentNormalized === normalizedMonth) {
                return { ...r, _saleMonth: normalizedMonth, saleDate: normalizedMonth };
              }
              return { ...r, _saleMonth: normalizedMonth, saleDate: normalizedMonth, _isDirty: true };
            })()
            : r
        )
      );
    },
    [setRows, normalizeSaleMonth]
  );

  const handleSaleMonthInputChange = useCallback(
    (rowIndex, rawMonth) => {
      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex
            ? { ...r, _saleMonth: String(rawMonth ?? "") }
            : r
        )
      );
    },
    [setRows]
  );

  // =========================================
  // ✅ 하단 합계(통합 소계/총합계 계산)
  // =========================================
  const summary = useMemo(() => {
    const expen = { taxTotal: 0, vat: 0, total: 0 };
    const food = { taxTotal: 0, vat: 0, total: 0 };
    const scenic = { taxTotal: 0, vat: 0, total: 0 };

    (rows || []).forEach((r) => {
      // 과/면세 합산 = tax + taxFree
      expen.taxTotal += toNum(r?.expen_tax) + toNum(r?.expen_taxFree);
      expen.vat += toNum(r?.expen_vat);
      expen.total += toNum(r?.expen_total);

      food.taxTotal += toNum(r?.food_tax) + toNum(r?.food_taxFree);
      food.vat += toNum(r?.food_vat);
      food.total += toNum(r?.food_total);

      scenic.taxTotal += toNum(r?.scenic_tax) + toNum(r?.scenic_taxFree);
      scenic.vat += toNum(r?.scenic_vat);
      scenic.total += toNum(r?.scenic_total);
    });

    const total = {
      taxTotal: expen.taxTotal + food.taxTotal + scenic.taxTotal,
      vat: expen.vat + food.vat + scenic.vat,
      total: expen.total + food.total + scenic.total,
    };

    return { expen, food, scenic, total };
  }, [rows, toNum]);

  const formatSummaryNumber = useCallback((v) => Number(v || 0).toLocaleString("ko-KR"), []);

  const getAmountCellDisplayValue = useCallback(
    (row, key) => {
      const prefix = TAX_TOTAL_KEY_TO_PREFIX[key];
      if (prefix) return getTaxTotalTextByPrefix(row, prefix);
      if (key === "scenic_vat" || key === "scenic_total") {
        return formatComma(toNum(row?.[key]));
      }
      return formatComma(row?.[key] ?? "");
    },
    [formatComma, getTaxTotalTextByPrefix, toNum]
  );

  // =========================================
  // ✅ 행추가
  // =========================================
  const handleAddRow = useCallback(() => {
    // 연/월 필터 값으로 신규 행의 기본 월 결정 (전체("0")이면 오늘 월 사용)
    const y = filters.year && filters.year !== "0" ? filters.year : String(new Date().getFullYear());
    const m = filters.month && filters.month !== "0" ? String(filters.month).padStart(2, "0") : String(new Date().getMonth() + 1).padStart(2, "0");
    const month = `${y}-${m}`;

    const firstPurchase = purchaseOptions?.[0] || null;
    const type = firstPurchase ? String(firstPurchase.value) : "";
    const mappedName = type ? purchaseNameByType.get(type) || firstPurchase?.label || "" : "";

    const accountId = String(filters.account_id || "");
    const accountName = accountNameById.get(accountId) || "";

    const newRow = {
      _isNew: true,
      _rowKey: `new:${Date.now()}_${Math.random().toString(16).slice(2)}`,
      item_id: null,
      account_id: accountId,
      account_name: accountName,

      _saleMonth: month,
      saleDate: month, // ✅ YYYY-MM

      type,
      name: mappedName,
      purchase_name: mappedName,

      expen_tax: "",
      expen_vat: "",
      expen_taxFree: "",
      expen_total: "",
      food_tax: "",
      food_vat: "",
      food_taxFree: "",
      food_total: "",
      scenic_tax: "",
      scenic_vat: "",
      scenic_taxFree: "",
      scenic_total: "",
      note: "",
    };

    setRows((prev) => [newRow, ...(prev || [])]);
  }, [
    filters.year,
    filters.month,
    filters.account_id,
    purchaseOptions,
    purchaseNameByType,
    accountNameById,
    setRows,
  ]);

  // =========================================
  // ✅ 테이블 스타일
  // =========================================
  const tableSx = {
    flex: 1,
    height: tableViewportHeight ? `${tableViewportHeight}px` : tableMaxHeight,
    minHeight: isMobileTablet ? tableMinHeight : 0,
    overflow: "hidden",
    maxHeight: tableViewportHeight ? `${tableViewportHeight}px` : tableMaxHeight,
    display: "flex",
    flexDirection: "column",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#fef6e4",
      position: "sticky",
      top: 0,
      zIndex: 2,
      borderCollapse: "separate",
    },
    "& .summary-table td": {
      height: 36,
      lineHeight: "34px",
      padding: "0 8px",
      whiteSpace: "nowrap",
      backgroundColor: "#f7f7f7",
    },
  };

  const tableBodySx = {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    boxSizing: "border-box",
    // 하단 요약행이 스크롤 중에도 가독성을 유지하도록 최소 여백 유지
    paddingBottom: 0,
  };

  const updateOverflowState = useCallback(() => {
    const bodyEl = bodyScrollRef.current;
    const dataTableEl = dataTableRef.current;
    if (!bodyEl) return;
    const contentHeight = dataTableEl ? dataTableEl.offsetHeight : bodyEl.scrollHeight;
    const overflow = contentHeight - bodyEl.clientHeight > 1;

    setIsBodyOverflow((prev) => (prev === overflow ? prev : overflow));
  }, []);

  const updateTableViewportHeight = useCallback(() => {
    const tableWrapEl = tableWrapRef.current;
    if (!tableWrapEl) return;

    const rect = tableWrapEl.getBoundingClientRect();
    // 페이지 전체 스크롤이 생기지 않도록 하단 여유를 두고 높이를 계산
    const viewportBottomGap = 24;
    const nextHeight = Math.max(
      tableMinHeight,
      Math.floor(window.innerHeight - rect.top - viewportBottomGap)
    );

    setTableViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, [tableMinHeight]);

  useEffect(() => {
    const run = () => {
      window.requestAnimationFrame(() => {
        updateTableViewportHeight();
        updateOverflowState();
      });
    };
    run();
    window.addEventListener("resize", run);
    return () => {
      window.removeEventListener("resize", run);
    };
  }, [
    updateOverflowState,
    updateTableViewportHeight,
    rows.length,
    isMobile,
    isMobileTablet,
    isMobileTabletLandscape,
    isDateRenderPending,
  ]);

  const renderColGroup = () => (
    <colgroup>
      <col style={{ width: 120, minWidth: 120, maxWidth: 120 }} /> {/* 사업장 */}
      <col style={{ width: 140, minWidth: 140, maxWidth: 140 }} /> {/* 날짜 */}
      <col style={{ width: 170, minWidth: 170, maxWidth: 170 }} /> {/* 구매처 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 소모품 과/면세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 소모품 부가세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 소모품 합계 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 식자재 과/면세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 식자재 부가세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 식자재 합계 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 경관식 과/면세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 경관식 부가세 */}
      <col style={{ width: 90, minWidth: 90, maxWidth: 90 }} /> {/* 경관식 합계 */}
    </colgroup>
  );

  // ✅ 고정 컬럼(left sticky) 좌표
  const STICKY_LEFT_ACCOUNT = 0;
  const STICKY_LEFT_DATE = 120;
  const STICKY_LEFT_TYPE = 260; // 120 + 140
  const HEADER_FIRST_ROW_HEIGHT = 32;
  const HEADER_SECOND_ROW_TOP = HEADER_FIRST_ROW_HEIGHT;
  const FOOTER_ROW_HEIGHT = 36;

  const renderSummaryTable = useCallback(
    (extraTableStyle = {}) => (
      <table className="summary-table" style={extraTableStyle}>
        {renderColGroup()}
        <tbody>
          <tr>
            <td colSpan={3} style={{ textAlign: "center", fontWeight: 700, background: "#f7f7f7", height: FOOTER_ROW_HEIGHT, lineHeight: `${FOOTER_ROW_HEIGHT - 2}px`, padding: "0 8px" }}>
              소계
            </td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.expen.taxTotal)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.expen.vat)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.expen.total)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.food.taxTotal)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.food.vat)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.food.total)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.scenic.taxTotal)}</td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>
              {formatSummaryNumber(Number(summary.scenic.vat ?? 0))}
            </td>
            <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>{formatSummaryNumber(summary.scenic.total)}</td>
          </tr>

          <tr>
            <td colSpan={3} style={{ textAlign: "center", fontWeight: 700, background: "#ececec", height: FOOTER_ROW_HEIGHT, lineHeight: `${FOOTER_ROW_HEIGHT - 2}px`, padding: "0 8px" }}>
              총합계
            </td>
            <td colSpan={9} style={{ textAlign: "right", fontWeight: 700, background: "#ececec", height: FOOTER_ROW_HEIGHT, lineHeight: `${FOOTER_ROW_HEIGHT - 2}px`, padding: "0 12px" }}>
              {formatSummaryNumber(summary.total.total)}
            </td>
          </tr>
        </tbody>
      </table>
    ),
    [FOOTER_ROW_HEIGHT, formatSummaryNumber, summary, renderColGroup]
  );

  // =========================
  // ✅ 파일 URL 유틸 + 다운로드
  // =========================
  const buildFileUrl = useCallback((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const p = String(path).startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  }, []);

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

  // ============================================================
  // ✅ 저장 (기존 로직 유지)
  // ============================================================
  const SAVE_KEYS = useMemo(
    () => [
      "saleDate",
      "type",
      "name",
      "expen_tax",
      "expen_vat",
      "expen_taxFree",
      "expen_total",
      "food_tax",
      "food_vat",
      "food_taxFree",
      "food_total",
      "scenic_tax",
      "scenic_vat",
      "scenic_taxFree",
      "scenic_total",
      "note",
    ],
    []
  );

  const isRowChanged = useCallback(
    (orig, cur) => {
      if (cur?._isNew || cur?._isDirty) return true;

      return SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);

        return String(a ?? "") !== String(b ?? "");
      });
    },
    [SAVE_KEYS, MONEY_KEYS, stripComma]
  );

  const buildRowForSave = useCallback(
    (r) => {
      const user_id = localStorage.getItem("user_id") || "";
      const next = { ...r };

      delete next._isNew;
      delete next._isDirty;
      delete next._saleMonth;
      delete next._rowKey;
      delete next.account_name;

      MONEY_KEYS.forEach((k) => {
        const raw = stripComma(next[k]);
        next[k] = raw === "" ? 0 : raw;
      });

      // ✅ 저장 saleDate는 YYYY-MM 고정
      next.saleDate = normalizeSaleMonth(r?._saleMonth || next.saleDate);

      if (next.type) {
        const nm = purchaseNameByType.get(String(next.type)) || next.name || "";
        if (!next.name && nm) next.name = nm;
        if (!next.purchase_name && nm) next.purchase_name = nm;
      }

      next.user_id = next.user_id || user_id;
      return next;
    },
    [MONEY_KEYS, stripComma, purchaseNameByType, normalizeSaleMonth]
  );

  const handleSave = useCallback(async () => {
    try {
      const modified = (rows || [])
        .map((r) => {
          if (r?._isNew) return buildRowForSave(r);
          const key = r?._rowKey;
          const orig = key ? originalByKey.get(key) : null;
          if (!orig) return null;
          return isRowChanged(orig, r) ? buildRowForSave(r) : null;
        })
        .filter(Boolean);

      if (modified.length === 0) {
        return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
      }

      Swal.fire({
        title: "저장 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/Account/AccountPurchaseTallyV2Save", modified, {
        headers: { "Content-Type": "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      const ok = res?.status === 200 || res?.data?.code === 200;
      if (!ok) {
        return Swal.fire("실패", res?.data?.message || "저장에 실패했습니다.", "error");
      }

      Swal.fire("성공", "저장되었습니다.", "success");

      // ✅ 저장 후 재조회도 "거래처+월"만
      await fetchPurchaseList(buildSearchParams(filters));
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 오류가 발생했습니다.", "error");
    }
  }, [
    rows,
    originalByKey,
    isRowChanged,
    buildRowForSave,
    fetchPurchaseList,
    filters,
    buildSearchParams,
  ]);

  // =========================================
  // ✅ 현재 화면 포맷 기준 엑셀 다운로드
  // =========================================
  const downloadBlob = useCallback((blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, []);

  const sanitizeFilename = useCallback((value) => {
    const s = String(value ?? "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .trim();
    return s || "전체";
  }, []);

  const handleExcelDownload = useCallback(async () => {
    if (excelDownloading) return;

    const exportRows = Array.isArray(rows) ? rows : [];
    if (exportRows.length === 0) {
      Swal.fire("다운로드 불가", "다운로드할 데이터가 없습니다.", "warning");
      return;
    }

    try {
      setExcelDownloading(true);
      Swal.fire({
        title: "엑셀 생성 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "THEFULL";
      const ws = wb.addWorksheet("매입마감");

      ws.views = [{ state: "frozen", ySplit: 2 }];
      ws.columns = [
        { width: 14 }, // 사업장
        { width: 12 }, // 날짜
        { width: 22 }, // 구매처
        { width: 10 }, // 소모품 과/면세
        { width: 10 }, // 소모품 부가세
        { width: 11 }, // 소모품 합계
        { width: 10 }, // 식자재 과/면세
        { width: 10 }, // 식자재 부가세
        { width: 11 }, // 식자재 합계
        { width: 10 }, // 경관식 과/면세
        { width: 10 }, // 경관식 부가세
        { width: 11 }, // 경관식 합계
      ];

      ws.mergeCells("A1:A2");
      ws.mergeCells("B1:B2");
      ws.mergeCells("C1:C2");
      ws.mergeCells("D1:F1");
      ws.mergeCells("G1:I1");
      ws.mergeCells("J1:L1");

      ws.getCell("A1").value = "사업장";
      ws.getCell("B1").value = "날짜";
      ws.getCell("C1").value = "구매처";
      ws.getCell("D1").value = "소모품";
      ws.getCell("G1").value = "식자재";
      ws.getCell("J1").value = "경관식";

      ws.getCell("D2").value = "과/면세";
      ws.getCell("E2").value = "부가세";
      ws.getCell("F2").value = "합계";
      ws.getCell("G2").value = "과/면세";
      ws.getCell("H2").value = "부가세";
      ws.getCell("I2").value = "합계";
      ws.getCell("J2").value = "과/면세";
      ws.getCell("K2").value = "부가세";
      ws.getCell("L2").value = "합계";

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF6E4" } };
      const borderThin = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      for (let r = 1; r <= 2; r += 1) {
        for (let c = 1; c <= 12; c += 1) {
          const cell = ws.getCell(r, c);
          cell.fill = headerFill;
          cell.border = borderThin;
          cell.font = { bold: true };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      }

      exportRows.forEach((row, idx) => {
        const excelRow = idx + 3;
        const purchaseLabel =
          purchaseNameByType.get(String(row?.type ?? "")) ||
          String(row?.purchase_name ?? row?.name ?? "");
        const monthText = normalizeSaleMonth(row?._saleMonth || row?.saleDate || "");

        ws.getCell(excelRow, 1).value = row?.account_name || "";
        ws.getCell(excelRow, 2).value = monthText;
        ws.getCell(excelRow, 3).value = purchaseLabel;
        ws.getCell(excelRow, 4).value = toNum(row?.expen_tax) + toNum(row?.expen_taxFree);
        ws.getCell(excelRow, 5).value = toNum(row?.expen_vat);
        ws.getCell(excelRow, 6).value = toNum(row?.expen_total);
        ws.getCell(excelRow, 7).value = toNum(row?.food_tax) + toNum(row?.food_taxFree);
        ws.getCell(excelRow, 8).value = toNum(row?.food_vat);
        ws.getCell(excelRow, 9).value = toNum(row?.food_total);
        ws.getCell(excelRow, 10).value = toNum(row?.scenic_tax) + toNum(row?.scenic_taxFree);
        ws.getCell(excelRow, 11).value = toNum(row?.scenic_vat);
        ws.getCell(excelRow, 12).value = toNum(row?.scenic_total);

        for (let c = 1; c <= 12; c += 1) {
          const cell = ws.getCell(excelRow, c);
          cell.border = borderThin;
          cell.alignment = { horizontal: c <= 3 ? "center" : "right", vertical: "middle" };
          if (c >= 4) cell.numFmt = "#,##0";
        }
      });

      const expenRow = exportRows.length + 3;
      ws.mergeCells(expenRow, 1, expenRow, 3);
      ws.getCell(expenRow, 1).value = "소모품 소계";
      ws.getCell(expenRow, 4).value = Number(summary.expen.taxTotal || 0);
      ws.getCell(expenRow, 5).value = Number(summary.expen.vat || 0);
      ws.getCell(expenRow, 6).value = Number(summary.expen.total || 0);

      const foodRow = expenRow + 1;
      ws.mergeCells(foodRow, 1, foodRow, 3);
      ws.getCell(foodRow, 1).value = "식자재 소계";
      ws.getCell(foodRow, 7).value = Number(summary.food.taxTotal || 0);
      ws.getCell(foodRow, 8).value = Number(summary.food.vat || 0);
      ws.getCell(foodRow, 9).value = Number(summary.food.total || 0);

      const scenicRow = foodRow + 1;
      ws.mergeCells(scenicRow, 1, scenicRow, 3);
      ws.getCell(scenicRow, 1).value = "경관식 소계";
      ws.getCell(scenicRow, 10).value = Number(summary.scenic.taxTotal || 0);
      ws.getCell(scenicRow, 11).value = Number(summary.scenic.vat || 0);
      ws.getCell(scenicRow, 12).value = Number(summary.scenic.total || 0);

      const totalRow = scenicRow + 1;
      ws.mergeCells(totalRow, 1, totalRow, 3);
      ws.getCell(totalRow, 1).value = "총 합계";
      ws.getCell(totalRow, 4).value = Number(summary.total.taxTotal || 0);
      ws.getCell(totalRow, 5).value = Number(summary.total.vat || 0);
      ws.getCell(totalRow, 6).value = Number(summary.total.total || 0);

      for (let r = expenRow; r <= totalRow; r += 1) {
        for (let c = 1; c <= 12; c += 1) {
          const cell = ws.getCell(r, c);
          cell.border = borderThin;
          cell.alignment = { horizontal: c <= 3 ? "center" : "right", vertical: "middle" };
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: r === totalRow ? "FFECECEC" : "FFF7F7F7" },
          };
          if (c >= 4) cell.numFmt = "#,##0";
        }
      }

      const accountLabel = filters.account_id
        ? accountNameById.get(String(filters.account_id)) || "선택거래처"
        : "전체";
      const ymLabel =
        filters.year !== "0" && filters.month !== "0"
          ? `${filters.year}-${String(filters.month).padStart(2, "0")}`
          : "전체";
      const ymd = dayjs().format("YYYYMMDD");
      const filename = `매입마감_${sanitizeFilename(accountLabel)}_${sanitizeFilename(ymLabel)}_${ymd}.xlsx`;

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      Swal.close();
      downloadBlob(blob, filename);
      await Swal.fire({
        title: "완료",
        text: "엑셀 다운로드가 완료되었습니다.",
        icon: "success",
        confirmButtonText: "확인",
      });
    } catch (e) {
      Swal.close();
      Swal.fire("엑셀 다운로드 실패", e?.message || "오류가 발생했습니다.", "error");
    } finally {
      setExcelDownloading(false);
    }
  }, [
    excelDownloading,
    rows,
    purchaseNameByType,
    normalizeSaleMonth,
    toNum,
    summary,
    filters,
    accountNameById,
    sanitizeFilename,
    downloadBlob,
  ]);

  // =========================
  // ✅ 거래처 Autocomplete
  // =========================
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((a) => ({
        value: String(a.account_id),
        label: a.account_name,
      })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(filters.account_id ?? "");
    if (!v) return { value: "", label: "전체" };
    const found = (accountList || []).find((a) => String(a.account_id) === v);
    return found ? { value: String(found.account_id), label: found.account_name } : null;
  }, [filters.account_id, accountList]);

  const handleAccountChange = useCallback(
    async (_, opt, reason) => {
      // X 버튼(clear)은 텍스트만 지우고 조회/필터 변경은 하지 않음
      if (reason === "clear") {
        setAccountInput("");
        return;
      }

      const nextId = opt ? String(opt.value ?? "") : "";
      const nextLabel = String(opt?.label ?? "");

      // "전체" 옵션 선택 시: 전체로 변경 후 즉시 조회
      if (nextId === "") {
        setTypeOptions([]);
        setAccountInput(nextLabel || "전체");
        const next = { ...filters, account_id: "", type: "0" };
        setFilters(next);
        fetchMappingList({});
        await fetchPurchaseList(buildSearchParams(next));
        return;
      }

      setAccountInput(nextLabel);

      // ✅ 1) 구매처 목록(매핑) 조회
      fetchMappingList({ account_id: nextId });

      // ✅ 2) 타입 옵션 재조회
      const opts = await fetchTypeOptions(nextId);

      // ✅ 3) 기존 type이 새 옵션에 없으면 첫 번째 타입으로 보정
      setFilters((prev) => {
        const nextType = resolveNextType(opts, prev.type);
        const next = { ...prev, account_id: nextId, type: nextType };
        fetchPurchaseList(buildSearchParams(next));
        return next;
      });
    },
    [filters, fetchPurchaseList, fetchMappingList, fetchTypeOptions, resolveNextType, buildSearchParams]
  );

  const selectAccountByInput = useCallback(async () => {
    const q = String(accountInput || "").trim();
    if (!q) {
      await fetchPurchaseList(buildSearchParams(filters));
      return;
    }

    if (q === "전체") {
      await handleAccountChange(null, { value: "", label: "전체" }, "selectOption");
      return;
    }

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
      await handleAccountChange(null, partial, "selectOption");
      setAccountInput(partial.label || q);
      return;
    }

    // 입력값이 매칭되지 않아도 엔터는 현재 조건으로 조회
    await fetchPurchaseList(buildSearchParams(filters));
  }, [accountInput, accountOptions, handleAccountChange, fetchPurchaseList, buildSearchParams, filters]);

  // =========================================
  // ✅ (NEW) 우클릭 메뉴 열기/닫기 + 삭제
  // =========================================
  const handleRowContextMenu = useCallback((e, rowIndex) => {
    e.preventDefault();
    setCtxMenu({
      open: true,
      mouseX: e.clientX,
      mouseY: e.clientY,
      rowIndex,
    });
  }, []);

  const closeCtxMenu = useCallback(() => {
    setCtxMenu((prev) => ({ ...prev, open: false, rowIndex: null }));
  }, []);

  const handleDeleteRow = useCallback(
    async (rowIndex) => {
      if (rowIndex == null) return;
      const row = rows?.[rowIndex];
      if (!row) return;

      const result = await Swal.fire({
        title: "행 삭제",
        text: "해당 행을 삭제할까요?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#9e9e9e",
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
      });

      if (!result.isConfirmed) return;

      // ✅ 신규행(서버 sale_id 없음)은 화면에서만 제거
      const sale_id = row?.sale_id ?? row?.saleId ?? null;
      if (!sale_id) {
        setRows((prev) => (prev || []).filter((_, i) => i !== rowIndex));
        closeCtxMenu();
        Swal.fire("삭제", "행이 제거되었습니다.", "success");
        return;
      }

      try {
        Swal.fire({
          title: "삭제 중...",
          text: "잠시만 기다려 주세요.",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading(),
        });

        const userId = localStorage.getItem("user_id");

        const payload = {
          sale_id: sale_id,
          user_id: userId,
        };

        // ✅ 삭제 API 호출 (sale_id 전달)
        // - 백엔드가 GET params 방식이면 여기만 변경하면 됨
        const res = await api.post("/Account/AccountPurchaseTallyV2Delete", payload, {
          validateStatus: () => true,
        });

        Swal.close();

        const ok = res?.status === 200 || res?.data?.code === 200;
        if (!ok) {
          return Swal.fire("실패", res?.data?.message || "삭제에 실패했습니다.", "error");
        }

        closeCtxMenu();
        Swal.fire("삭제", "삭제되었습니다.", "success");

        // ✅ 삭제 후 동기화를 위해 재조회(거래처+월만)
        await fetchPurchaseList(buildSearchParams(filters));
      } catch (err) {
        Swal.close();
        console.error(err);
        Swal.fire("오류", err?.message || "삭제 중 오류가 발생했습니다.", "error");
      }
    },
    [rows, setRows, closeCtxMenu, fetchPurchaseList, buildSearchParams, filters]
  );

  if (loading || isDateRenderPending) return <LoadingScreen />;

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
          <DashboardNavbar title="💰 매입마감" />
        </MDBox>

        {/* 🔹 조회조건 영역 */}
        <MDBox
          mt={-0.25}
          pt={0}
          pb={1.25}
          sx={{
            display: "flex",
            justifyContent: isMobile ? "space-between" : "flex-end",
            alignItems: "center",
            gap: isMobile ? 1 : 2,
            flexWrap: isMobile ? "wrap" : "nowrap",
            // 모바일에서는 검색/버튼 영역도 본문과 함께 스크롤
            position: isMobile ? "static" : "sticky",
            zIndex: isMobile ? "auto" : 10,
            top: isMobile ? "auto" : 86,
            backgroundColor: "#ffffff",
          }}
        >
          {/* 타입 선택 필터: 거래처 기반 서버 옵션으로 렌더 */}
          <TextField
            select
            label="타입"
            size="small"
            name="type"
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.type}
          >
            {/* 전체 옵션: "0" = 전체 조회 (AccountPurchaseTallyList SQL과 일치) */}
            <option value="0">전체</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </TextField>

          {/* 연도 셀렉트 */}
          <TextField
            select
            label="연도"
            size="small"
            onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.year}
          >
            <option value="0">전체</option>
            {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </TextField>

          {/* 월 셀렉트 */}
          <TextField
            select
            label="월"
            size="small"
            onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.month}
          >
            <option value="0">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>{m}월</option>
            ))}
          </TextField>

          {/* 거래처 검색: 전체 포함 */}
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={[{ value: "", label: "전체" }, ...accountOptions]}
            value={selectedAccountOption}
            onChange={handleAccountChange}
            inputValue={accountInput}
            onInputChange={(_, newValue, reason) => {
              // "reset"(선택 후 자동 세팅)은 무시, 직접 타이핑/지우기만 반영
              if (reason === "reset") return;
              setAccountInput(newValue);
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
            onClick={handleAddRow}
            sx={{ minWidth: isMobile ? 90 : 100, fontSize: isMobile ? "11px" : "13px" }}
          >
            행추가
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
            onClick={handleExcelDownload}
            disabled={excelDownloading}
            sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "11px" : "13px" }}
          >
            {excelDownloading ? "다운로드 중..." : "엑셀다운로드"}
          </MDButton>
        </MDBox>

        {/* 🔹 테이블 */}
        <MDBox ref={tableWrapRef} pt={3.1} pb={0} sx={tableSx}>
          <MDBox
            py={1}
            px={1}
            pt={1}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ position: "sticky", top: 0, zIndex: 3, mt: 0.4 }}
          >
            <MDTypography variant="h6" color="white" sx={{ mt: 0.2 }}>
              매입마감
            </MDTypography>
          </MDBox>

          <MDBox ref={bodyScrollRef} sx={tableBodySx}>
            <table ref={dataTableRef}>
              {renderColGroup()}
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    style={{
                      minWidth: 120,
                      width: 120,
                      maxWidth: 120,
                      left: STICKY_LEFT_ACCOUNT,
                      zIndex: 7,
                      backgroundColor: "#fef6e4",
                    }}
                  >
                    사업장
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      minWidth: 140,
                      width: 140,
                      maxWidth: 140,
                      left: STICKY_LEFT_DATE,
                      zIndex: 7,
                      backgroundColor: "#fef6e4",
                    }}
                  >
                    날짜
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      minWidth: 170,
                      width: 170,
                      maxWidth: 170,
                      left: STICKY_LEFT_TYPE,
                      zIndex: 7,
                      backgroundColor: "#fef6e4",
                    }}
                  >
                    구매처
                  </th>

                  <th
                    colSpan={3}
                    style={{
                      minWidth: 270,
                      top: 0,
                      zIndex: 6,
                      backgroundColor: "#fef6e4",
                      height: HEADER_FIRST_ROW_HEIGHT,
                      lineHeight: `${HEADER_FIRST_ROW_HEIGHT - 2}px`,
                      padding: "0 4px",
                    }}
                  >
                    소모품
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      minWidth: 270,
                      top: 0,
                      zIndex: 6,
                      backgroundColor: "#fef6e4",
                      height: HEADER_FIRST_ROW_HEIGHT,
                      lineHeight: `${HEADER_FIRST_ROW_HEIGHT - 2}px`,
                      padding: "0 4px",
                    }}
                  >
                    식자재
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      minWidth: 270,
                      top: 0,
                      zIndex: 6,
                      backgroundColor: "#fef6e4",
                      height: HEADER_FIRST_ROW_HEIGHT,
                      lineHeight: `${HEADER_FIRST_ROW_HEIGHT - 2}px`,
                      padding: "0 4px",
                    }}
                  >
                    경관식
                  </th>
                </tr>
                <tr>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    과/면세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    부가세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    합계
                  </th>

                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    과/면세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    부가세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    합계
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    과/면세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    부가세
                  </th>
                  <th style={{ minWidth: 90, top: HEADER_SECOND_ROW_TOP, zIndex: 6, padding: "2px 4px" }}>
                    합계
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: "12px" }}>
                      데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={row._rowKey || rowIndex}
                      onContextMenu={(e) => handleRowContextMenu(e, rowIndex)} // ✅ 우클릭
                      style={{ cursor: "context-menu" }}
                    >
                      {/* 사업장 */}
                      <td
                        style={{
                          ...getCellStyle(row, "account_name", row.account_name),
                          width: 120,
                          minWidth: 120,
                          maxWidth: 120,
                          position: "sticky",
                          left: STICKY_LEFT_ACCOUNT,
                          zIndex: 3,
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {row.account_name || ""}
                      </td>

                      {/* 날짜(연월 텍스트 입력) */}
                      <td
                        style={{
                          width: 140,
                          minWidth: 140,
                          maxWidth: 140,
                          padding: "2px",
                          position: "sticky",
                          left: STICKY_LEFT_DATE,
                          zIndex: 3,
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {(() => {
                          const cellColor = getCellColor(row, "_saleMonth", row._saleMonth);
                          return (
                            <input
                              type="text"
                              value={String(row._saleMonth || "")}
                              placeholder="YYYY-MM"
                              inputMode="numeric"
                              onChange={(e) => {
                                handleSaleMonthInputChange(rowIndex, String(e.target.value || ""));
                              }}
                              onBlur={(e) => {
                                handleSaleMonthChange(rowIndex, String(e.target.value || ""));
                              }}
                              style={{
                                width: "100%",
                                height: 30,
                                border: "1px solid #c4c4c4",
                                borderRadius: 4,
                                padding: "4px 6px",
                                fontSize: 12,
                                color: cellColor,
                                textAlign: "center",
                              }}
                            />
                          );
                        })()}
                      </td>

                      {/* 구매처 */}
                      <td
                        style={{
                          width: 170,
                          minWidth: 170,
                          maxWidth: 170,
                          padding: "2px",
                          position: "sticky",
                          left: STICKY_LEFT_TYPE,
                          zIndex: 3,
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {(() => {
                          const cellColor = getCellColor(row, "type", row.type);

                          return (
                            <TextField
                              select
                              size="small"
                              value={String(row.type ?? "")}
                              onChange={(e) => {
                                const nextType = String(e.target.value ?? "");
                                const nm = purchaseNameByType.get(nextType) || "";
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === rowIndex
                                      ? {
                                        ...r,
                                        type: nextType,
                                        name: nm || r.name,
                                        purchase_name: nm || r.purchase_name,
                                        _isDirty: true,
                                      }
                                      : r
                                  )
                                );
                              }}
                              sx={{
                                width: "100%",
                                "& .MuiInputBase-root": { height: 30, fontSize: 12 },
                                "& .MuiSelect-select": {
                                  padding: "4px 8px",
                                  color: cellColor,
                                },
                              }}
                            >
                              {(purchaseOptions || []).map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          );
                        })()}
                      </td>

                      {/* 금액 */}
                      {AMOUNT_COLUMN_KEYS.map((k) => {
                        const displayValue = getAmountCellDisplayValue(row, k);
                        const styleCompareValue = TAX_TOTAL_KEY_TO_PREFIX[k] ? displayValue : row[k] ?? "";
                        return (
                          <td
                            key={k}
                            contentEditable={!k.endsWith("_total")}
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const text = e.currentTarget.innerText;
                              const formatted = formatComma(text);
                              handleCellChange(rowIndex, k, formatted);
                              e.currentTarget.innerText = formatted;
                            }}
                            style={{
                              width: 90,
                              ...getCellStyle(row, k, styleCompareValue),
                            }}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <MDBox
              sx={{
                position: "sticky",
                bottom: 0,
                zIndex: 8,
                backgroundColor: "#ffffff",
                boxShadow: "0 -2px 6px rgba(0,0,0,0.12)",
              }}
            >
              {renderSummaryTable()}
            </MDBox>
          </MDBox>
        </MDBox>

        {/* ✅ 우클릭 컨텍스트 메뉴 (행 삭제) */}
        {ctxMenu.open && (
          <div
            onClick={closeCtxMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeCtxMenu();
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 10000,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: ctxMenu.mouseY,
                left: ctxMenu.mouseX,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                minWidth: 140,
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => handleDeleteRow(ctxMenu.rowIndex)}
              >
                🗑️ 삭제
              </button>
            </div>
          </div>
        )}
      </DashboardLayout>
    </LocalizationProvider>
  );
}

export default AccountPurchaseTallyTab;
