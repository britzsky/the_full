// src/layouts/account/AccountPurchaseTallyTab.js
/* eslint-disable react/function-component-definition */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Grid,
  TextField,
  useTheme,
  useMediaQuery,
  Box,
  IconButton,
  Tooltip,
  Typography,
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
import api from "api/api";
import { API_BASE_URL } from "config";
import useAccountPurchaseTallyData from "./accountPurchaseTallyData";

// ✅ 월 달력(DatePicker) - 한글(ko) 적용
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { koKR } from "@mui/x-date-pickers/locales";

function AccountPurchaseTallyTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ 기본 월(YYYY-MM)
  const defaultMonthStr = dayjs().locale("ko").format("YYYY-MM");

  // ✅ 조회조건 상태: saleDate(월, YYYY-MM)
  const [filters, setFilters] = useState({
    type: "1",
    saleDate: defaultMonthStr,
    toDate: "",
    account_id: "",
    payType: "1",
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);
  const [accountInput, setAccountInput] = useState("");

  // ✅ 데이터 훅 사용
  const { rows, setRows, originalRows, mappingRows, loading, fetchPurchaseList, fetchMappingList } =
    useAccountPurchaseTallyData();

  // ✅ account_id -> account_name 매핑
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((a) => map.set(String(a.account_id), String(a.account_name || "")));
    return map;
  }, [accountList]);

  // =========================================
  // ✅ (NEW) 조회 파라미터는 "거래처 + 월"만 보내기
  // =========================================
  const buildSearchParams = useCallback((f) => {
    const account_id = String(f?.account_id ?? "");
    const saleDate = String(f?.saleDate ?? "");
    return { account_id, saleDate }; // ✅ 딱 2개만
  }, []);

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

    const nextRows = rows.map((r, idx) => {
      const nr = { ...r };

      if (!nr._rowKey) nr._rowKey = makeStableKey(nr, idx);

      const aid = String(nr.account_id ?? "");
      const aname = accountNameById.get(aid) || "";
      if (aname) nr.account_name = aname;

      MONEY_KEYS.forEach((k) => {
        nr[k] = formatComma(nr[k]);
      });

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

      const moneyChanged = MONEY_KEYS.some((k) => String(nr?.[k] ?? "") !== String(r?.[k] ?? ""));
      if (moneyChanged) return true;

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

  // ✅ 최초 로딩
  useEffect(() => {
    api
      .get("/Account/AccountListV2", { params: { account_type: "0" } })
      .then((res) => {
        const list = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(list);

        if (list.length > 0) {
          const firstId = String(list[0].account_id);
          setFilters((prev) => {
            const next = { ...prev, account_id: firstId };

            // ✅ 구매처 목록은 account_id로 조회
            fetchMappingList({ account_id: firstId });

            // ✅ 매입집계 조회는 "거래처+월"만
            fetchPurchaseList(buildSearchParams(next));

            return next;
          });
        }
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  // ✅ 월 변경(상단 조회조건)
  const handleMonthChange = useCallback((v) => {
    const nextMonth = v ? dayjs(v).locale("ko").format("YYYY-MM") : "";
    setFilters((prev) => ({ ...prev, saleDate: nextMonth }));
  }, []);

  // ✅ 조회(버튼)
  const handleSearch = async () => {
    try {
      await fetchPurchaseList(buildSearchParams(filters)); // ✅ 2개만 전송
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    }
  };

  // =========================================
  // ✅ 변경 감지 스타일 (rowIndex 대신 _rowKey로 비교)
  // =========================================
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  const getOriginalMonthByRow = useCallback(
    (origRow) => normalizeSaleMonth(origRow?.saleDate),
    [normalizeSaleMonth]
  );

  const getCellStyle = (row, key, value) => {
    if (row?._isNew) return { color: "red" };

    const k = row?._rowKey;
    const orig = k ? originalByKey.get(k) : null;
    if (!orig) return { color: "black" };

    if (key === "_saleMonth") {
      const a = getOriginalMonthByRow(orig);
      const b = String(value ?? "");
      return a !== b ? { color: "red" } : { color: "black" };
    }

    if (key === "type") {
      const a = String(orig?.type ?? "");
      const b = String(value ?? "");
      return a !== b ? { color: "red" } : { color: "black" };
    }

    if (key === "account_name") {
      const a = String(orig?.account_id ?? "");
      const b = String(row?.account_id ?? "");
      return a !== b ? { color: "red" } : { color: "black" };
    }

    const originalValue = orig?.[key];

    if (MONEY_KEYS.includes(key)) {
      const a = stripComma(originalValue);
      const b = stripComma(value);
      return a !== b ? { color: "red" } : { color: "black" };
    }

    if (typeof originalValue === "string" && typeof value === "string") {
      return normalize(originalValue) !== normalize(value) ? { color: "red" } : { color: "black" };
    }

    return originalValue !== value ? { color: "red" } : { color: "black" };
  };

  const getCellColor = (row, key, value) => getCellStyle(row, key, value)?.color ?? "black";

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

          const next = { ...r, [key]: value };

          // ✅ 소모품
          if (key === "expen_tax") next.expen_vat = calcVatText(next.expen_tax);
          if (key === "expen_tax" || key === "expen_vat" || key === "expen_taxFree") {
            const sum = toNum(next.expen_tax) + toNum(next.expen_vat) + toNum(next.expen_taxFree);
            next.expen_total = formatComma(sum);
          }

          // ✅ 식자재
          if (key === "food_tax") next.food_vat = calcVatText(next.food_tax);
          if (key === "food_tax" || key === "food_vat" || key === "food_taxFree") {
            const sum = toNum(next.food_tax) + toNum(next.food_vat) + toNum(next.food_taxFree);
            next.food_total = formatComma(sum);
          }

          return next;
        })
      );
    },
    [setRows, toNum, formatComma, calcVatText]
  );

  // =========================================
  // ✅ 행추가
  // =========================================
  const handleAddRow = useCallback(() => {
    const month = filters.saleDate || dayjs().locale("ko").format("YYYY-MM");

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
      note: "",
    };

    setRows((prev) => [newRow, ...(prev || [])]);
  }, [
    filters.saleDate,
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
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: isMobile ? "calc(100vh - 260px)" : "75vh",
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
  };

  const columns = useMemo(
    () => [
      { header: "사업장", accessorKey: "account_name", size: 120 },
      { header: "날짜", accessorKey: "_saleMonth", size: 140 },
      { header: "구매처", accessorKey: "type", size: 170 },

      { header: "과세", accessorKey: "expen_tax", size: 90 },
      { header: "부가세", accessorKey: "expen_vat", size: 90 },
      { header: "면세", accessorKey: "expen_taxFree", size: 90 },
      { header: "합계", accessorKey: "expen_total", size: 90 },

      { header: "과세", accessorKey: "food_tax", size: 90 },
      { header: "부가세", accessorKey: "food_vat", size: 90 },
      { header: "면세", accessorKey: "food_taxFree", size: 90 },
      { header: "합계", accessorKey: "food_total", size: 90 },
    ],
    []
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
      "note",
    ],
    []
  );

  const isRowChanged = useCallback(
    (orig, cur) => {
      if (cur?._isNew) return true;

      return SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);

        if (typeof a === "string" && typeof b === "string") return normalize(a) !== normalize(b);
        return a !== b;
      });
    },
    [SAVE_KEYS, MONEY_KEYS, stripComma]
  );

  const buildRowForSave = useCallback(
    (r) => {
      const user_id = localStorage.getItem("user_id") || "";
      const next = { ...r };

      delete next._isNew;
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
    const found = (accountList || []).find((a) => String(a.account_id) === v);
    return found ? { value: String(found.account_id), label: found.account_name } : null;
  }, [filters.account_id, accountList]);

  const handleAccountChange = useCallback(
    (_, opt) => {
      const nextId = opt ? opt.value : "";
      setFilters((prev) => {
        const next = { ...prev, account_id: nextId };
        if (nextId) {
          // ✅ 구매처 목록은 account_id로
          fetchMappingList({ account_id: nextId });

          // ✅ 매입집계 조회는 account_id + saleDate만
          fetchPurchaseList(buildSearchParams(next));
        }
        return next;
      });
    },
    [fetchPurchaseList, fetchMappingList, buildSearchParams]
  );

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
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
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions, handleAccountChange]);

  if (loading) return <LoadingScreen />;

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="ko"
      localeText={koKR.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <DashboardLayout>
        <DashboardNavbar title="💰 매입집계" />

        {/* 🔹 조회조건 영역 */}
        <MDBox
          pt={1}
          pb={1}
          sx={{
            display: "flex",
            justifyContent: isMobile ? "space-between" : "flex-end",
            alignItems: "center",
            gap: isMobile ? 1 : 2,
            flexWrap: isMobile ? "wrap" : "nowrap",
            position: "sticky",
            zIndex: 10,
            top: 85,
            backgroundColor: "#ffffff",
          }}
        >
          <DatePicker
            label="월"
            views={["year", "month"]}
            value={filters.saleDate ? dayjs(filters.saleDate, "YYYY-MM").locale("ko") : null}
            onChange={handleMonthChange}
            format="YYYY년 MM월"
            slotProps={{
              textField: { size: "small", sx: { minWidth: isMobile ? 150 : 170 } },
            }}
          />

          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={accountOptions}
            value={selectedAccountOption}
            onChange={handleAccountChange}
            inputValue={accountInput}
            onInputChange={(_, newValue) => setAccountInput(newValue)}
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
            sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "11px" : "13px" }}
          >
            엑셀다운로드
          </MDButton>
        </MDBox>

        {/* 🔹 테이블 */}
        <MDBox pt={4.5} pb={2} sx={tableSx}>
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
            sx={{ position: "sticky", top: 0, zIndex: 3 }}
          >
            <MDTypography variant="h6" color="white">
              매입집계
            </MDTypography>
          </MDBox>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <table>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ minWidth: 120 }}>
                      사업장
                    </th>
                    <th rowSpan={2} style={{ minWidth: 140 }}>
                      날짜
                    </th>
                    <th rowSpan={2} style={{ minWidth: 170 }}>
                      구매처
                    </th>

                    <th colSpan={4} style={{ minWidth: 360 }}>
                      소모품
                    </th>
                    <th colSpan={4} style={{ minWidth: 360 }}>
                      식자재
                    </th>
                  </tr>
                  <tr>
                    <th style={{ minWidth: 90 }}>과세</th>
                    <th style={{ minWidth: 90 }}>부가세</th>
                    <th style={{ minWidth: 90 }}>면세</th>
                    <th style={{ minWidth: 90 }}>합계</th>

                    <th style={{ minWidth: 90 }}>과세</th>
                    <th style={{ minWidth: 90 }}>부가세</th>
                    <th style={{ minWidth: 90 }}>면세</th>
                    <th style={{ minWidth: 90 }}>합계</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: "center", padding: "12px" }}>
                        데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, rowIndex) => (
                      <tr key={row._rowKey || rowIndex}>
                        {/* 사업장 */}
                        <td
                          style={{
                            ...getCellStyle(row, "account_name", row.account_name),
                            width: 120,
                          }}
                        >
                          {row.account_name || ""}
                        </td>

                        {/* 날짜(월달력) */}
                        <td style={{ width: 140, padding: "2px" }}>
                          {(() => {
                            const cellColor = getCellColor(row, "_saleMonth", row._saleMonth);

                            return (
                              <DatePicker
                                views={["year", "month"]}
                                value={
                                  row._saleMonth
                                    ? dayjs(row._saleMonth, "YYYY-MM").locale("ko")
                                    : null
                                }
                                onChange={(v) => {
                                  const nextMonth = v ? dayjs(v).format("YYYY-MM") : "";
                                  setRows((prev) =>
                                    prev.map((r, i) =>
                                      i === rowIndex
                                        ? { ...r, _saleMonth: nextMonth, saleDate: nextMonth }
                                        : r
                                    )
                                  );
                                }}
                                format="YYYY-MM"
                                slotProps={{
                                  textField: {
                                    size: "small",
                                    variant: "outlined",
                                    sx: {
                                      width: "100%",
                                      "& .MuiInputBase-root": { height: 30, fontSize: 12 },
                                      "& input": {
                                        textAlign: "center",
                                        padding: "4px 6px",
                                        color: cellColor, // ✅ 글씨색 적용 핵심
                                      },
                                    },
                                  },
                                }}
                              />
                            );
                          })()}
                        </td>

                        {/* 구매처 */}
                        <td style={{ width: 170, padding: "2px" }}>
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
                                    color: cellColor, // ✅ 글씨색 적용 핵심
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
                        {[
                          "expen_tax",
                          "expen_vat",
                          "expen_taxFree",
                          "expen_total",
                          "food_tax",
                          "food_vat",
                          "food_taxFree",
                          "food_total",
                        ].map((k) => (
                          <td
                            key={k}
                            contentEditable={k !== "expen_total" && k !== "food_total"}
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const text = e.currentTarget.innerText;
                              const formatted = formatComma(text);
                              handleCellChange(rowIndex, k, formatted);
                              e.currentTarget.innerText = formatted;
                            }}
                            style={{
                              width: 90,
                              ...getCellStyle(row, k, row[k] ?? ""),
                            }}
                          >
                            {formatComma(row[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Grid>
          </Grid>
        </MDBox>

        {/* 미리보기 영역은 기존 그대로 유지하면 됨(생략) */}
      </DashboardLayout>
    </LocalizationProvider>
  );
}

export default AccountPurchaseTallyTab;
