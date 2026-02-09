import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Grid,
  TextField,
  useTheme,
  useMediaQuery,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";

import ReactDOM from "react-dom";
import Autocomplete from "@mui/material/Autocomplete";

import Paper from "@mui/material/Paper";
import Draggable from "react-draggable";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import "dayjs/locale/ko";
import { koKR } from "@mui/x-date-pickers/locales";
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
import ExcelJS from "exceljs";
import useAccountPurchaseDeadlineData from "./accountPurchaseDeadlineData";

// ✅ 하단(상세) 훅 추가
import useAccountPurchaseDeadlineDetailData from "./accountPurchaseDeadlineDetailData";

function AccountPurchaseDeadlineTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 🔹 오늘 날짜 (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);

  // ✅ 조회조건 상태
  const [filters, setFilters] = useState({
    type: "1", // 타입
    fromDate: todayStr,
    toDate: todayStr,
    account_id: "", // 거래처 (account_id)
    payType: "0", // 조회구분
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);
  const [accountInput, setAccountInput] = useState("");

  // ✅ (상단) 데이터 훅 사용
  const { rows, setRows, originalRows, loading, fetchPurchaseList } =
    useAccountPurchaseDeadlineData();

  // =========================
  // ✅ (하단) 상세 테이블 훅/상태
  // =========================
  const {
    detailRows,
    setDetailRows,
    originalDetailRows,
    setOriginalDetailRows,
    detailLoading,
    fetchPurchaseDetailList,
  } = useAccountPurchaseDeadlineDetailData();

  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedMasterIndex, setSelectedMasterIndex] = useState(-1);

  // =========================================
  // ✅ 금액 키들: 화면에는 콤마, 저장은 콤마 제거
  // =========================================
  const MONEY_KEYS = useMemo(
    () => ["vat", "taxFree", "tax", "total", "totalCash", "totalCard"],
    []
  );
  const DETAIL_MONEY_KEYS = useMemo(() => ["qty", "unitPrice", "amount", "tax", "vat"], []);

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

  // ✅ 조회 결과가 들어오면 금액 필드에 콤마 적용(초기 표시용)
  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const normalized = rows.map((r) => {
      const nr = { ...r };

      // ✅ money format
      MONEY_KEYS.forEach((k) => {
        nr[k] = formatComma(nr[k]);
      });

      // ✅ payType 보정: 1/2 아니면 기본 1(현금)
      const pt = String(nr.payType ?? "").trim();
      nr.payType = pt === "1" || pt === "2" ? pt : "1";

      return nr;
    });

    // rows 변경 감지 (money + payType)
    const changed = normalized.some((r, i) => {
      const a = rows[i] || {};
      if (String(r.payType) !== String(a.payType ?? "")) return true;
      return MONEY_KEYS.some((k) => String(r?.[k] ?? "") !== String(a?.[k] ?? ""));
    });

    if (changed) setRows(normalized);
  }, [rows, setRows, MONEY_KEYS, formatComma]);

  // ✅ 최초 로딩: 거래처 목록 조회 + 첫 번째 거래처 자동 선택 & 자동 조회
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
      .then((res) => {
        const list = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(list);

        if (list.length > 0) {
          const firstId = String(list[0].account_id);
          const next = { ...filters, account_id: firstId };

          setFilters(next);
          fetchPurchaseList(next);
        }
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []); // ✅ 의도적으로 1회만

  // ✅ 조회조건 변경 (기본 TextField용)
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "account_id") {
        // 거래처 바뀌면 상단 재조회 + 상세 초기화(선택은 rows effect에서 자동 처리)
        setSelectedSaleId("");
        setSelectedMasterIndex(-1);
        setDetailRows([]);
        setOriginalDetailRows([]);
        fetchPurchaseList(next);
      }
      return next;
    });
  };

  // ✅ (NEW) 거래처 Autocomplete 변경 핸들러
  const handleAccountChange = useCallback(
    (_, opt) => {
      const nextId = opt ? String(opt.value) : "";
      setFilters((prev) => {
        const next = { ...prev, account_id: nextId };

        // ✅ 기존 select 변경과 동일하게: 상세 초기화 + 재조회
        setSelectedSaleId("");
        setSelectedMasterIndex(-1);
        setDetailRows([]);
        setOriginalDetailRows([]);

        if (nextId) fetchPurchaseList(next);
        return next;
      });
    },
    [fetchPurchaseList, setDetailRows, setOriginalDetailRows]
  );

  // ✅ 조회 버튼 클릭
  const handleSearch = async () => {
    try {
      setSelectedSaleId("");
      setSelectedMasterIndex(-1);
      setDetailRows([]);
      setOriginalDetailRows([]);

      await fetchPurchaseList(filters);
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    }
  };

  // ✅ 변경 감지 스타일
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];

    if (MONEY_KEYS.includes(key)) {
      const a = stripComma(original);
      const b = stripComma(value);
      return a !== b ? { color: "red" } : { color: "black" };
    }

    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  };

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

  const tableSx = {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: isMobile ? "calc(38vh - 260px)" : "38vh",
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
      borderCollapse: "separate",
      top: 43,
      zIndex: 2,
    },
    "& input[type='text'], & input[type='date']": {
      fontSize: "12px",
      padding: "4px",
      border: "none",
      background: "transparent",
      textAlign: "center",
    },
  };

  const columns = useMemo(
    () => [
      { header: "사업장", accessorKey: "account_name", size: 120 },
      { header: "구매일자", accessorKey: "saleDate", size: 120 },
      { header: "구매처", accessorKey: "use_name", size: 180 },
      { header: "사업자번호", accessorKey: "bizNo", size: 100 },
      { header: "과세", accessorKey: "tax", size: 80 },
      { header: "부가세", accessorKey: "vat", size: 80 },
      { header: "면세", accessorKey: "taxFree", size: 80 },
      { header: "구분", accessorKey: "payType", size: 80 },
      { header: "현금합계", accessorKey: "totalCash", size: 80 },
      { header: "카드합계", accessorKey: "totalCard", size: 80 },
      { header: "합계", accessorKey: "total", size: 80 },
      { header: "증빙자료사진", accessorKey: "receipt_image", size: 150 },
      { header: "기타", accessorKey: "note", size: 200 },
    ],
    []
  );

  // ✅ URL 조립
  const buildFileUrl = useCallback((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const p = String(path).startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  }, []);

  const getExt = (p = "") => {
    const clean = String(p).split("?")[0].split("#")[0];
    return clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  };

  const isPdfFile = (p) => getExt(p) === "pdf";

  const fileItems = useMemo(() => {
    return (rows || [])
      .filter((r) => !!r?.receipt_image)
      .map((r) => {
        const path = r.receipt_image;
        return {
          path,
          src: buildFileUrl(path),
          title: `${r.name || ""} ${r.saleDate || ""}`.trim(),
          isPdf: isPdfFile(path),
        };
      });
  }, [rows, buildFileUrl]);

  const handleNoImageAlert = () => {
    Swal.fire("이미지 없음", "등록된 증빙자료가 없습니다.", "warning");
  };

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
  // ✅ 이미지 뷰어
  // =========================
  // =========================
  // ✅ 파일 뷰어
  // =========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerNodeRef = useRef(null);
  const handleCloseViewer = useCallback(() => setViewerOpen(false), []);

  // ✅ 여기서 계산 (viewerIndex 선언 이후!)
  const currentFile = useMemo(
    () => (fileItems.length ? fileItems[viewerIndex] : null),
    [fileItems, viewerIndex]
  );

  const handleViewImage = useCallback(
    (path) => {
      if (!path) return;
      const idx = fileItems.findIndex((x) => x.path === path);
      setViewerIndex(idx >= 0 ? idx : 0);
      setViewerOpen(true);
    },
    [fileItems]
  );

  const goPrev = useCallback(() => {
    setViewerIndex((i) => (fileItems.length ? (i - 1 + fileItems.length) % fileItems.length : 0));
  }, [fileItems.length]);

  const goNext = useCallback(() => {
    setViewerIndex((i) => (fileItems.length ? (i + 1) % fileItems.length : 0));
  }, [fileItems.length]);

  useEffect(() => {
    if (!viewerOpen) return;
    if (!fileItems.length) {
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > fileItems.length - 1) setViewerIndex(fileItems.length - 1);
  }, [viewerOpen, fileItems.length, viewerIndex]);

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
      "receipt_image",
      "note",
    ],
    []
  );

  const isRowChanged = useCallback(
    (orig, cur) =>
      SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);

        if (typeof a === "string" && typeof b === "string") return normalize(a) !== normalize(b);
        return a !== b;
      }),
    [SAVE_KEYS, MONEY_KEYS, stripComma]
  );

  const buildRowForSave = useCallback(
    (r) => {
      const user_id = localStorage.getItem("user_id") || "";
      const next = { ...r };

      delete next.account_name;

      MONEY_KEYS.forEach((k) => {
        const raw = stripComma(next[k]);
        next[k] = raw === "" ? 0 : raw;
      });

      if (!next.account_id) next.account_id = filters.account_id;
      next.user_id = next.user_id || user_id;
      next.type = next.type || filters.type;
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
    () => ["saleDate", "name", "qty", "unitPrice", "vat", "amount", "taxType", "itemType", "note"],
    []
  );

  const isDetailRowChanged = useCallback(
    (orig, cur) =>
      DETAIL_SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        if (DETAIL_MONEY_KEYS.includes(k)) return stripComma(a) !== stripComma(b);
        if (typeof a === "string" && typeof b === "string") return normalize(a) !== normalize(b);
        return a !== b;
      }),
    [DETAIL_SAVE_KEYS, DETAIL_MONEY_KEYS, stripComma]
  );

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

      delete next.__isNew;

      return next;
    },
    [DETAIL_MONEY_KEYS, stripComma, selectedSaleId, filters.account_id]
  );

  // ✅ rows 바뀔 때: 선택만 유지/보정 (상세 재조회 X)
  useEffect(() => {
    if (!rows || rows.length === 0) {
      setSelectedSaleId("");
      setSelectedMasterIndex(-1);
      setDetailRows([]);
      setOriginalDetailRows([]);
      return;
    }

    const foundIdx = selectedSaleId
      ? rows.findIndex((r) => String(r.sale_id) === String(selectedSaleId))
      : -1;

    const nextIdx = foundIdx >= 0 ? foundIdx : 0;
    const nextSaleId = rows[nextIdx]?.sale_id;

    if (!nextSaleId) return;

    if (String(nextSaleId) !== String(selectedSaleId)) {
      setSelectedSaleId(String(nextSaleId));
    }
    if (selectedMasterIndex !== nextIdx) {
      setSelectedMasterIndex(nextIdx);
    }
  }, [rows]); // ✅ rows만 감시 (fetch 없음)

  // ✅ selectedSaleId 바뀔 때만: 상세 재조회
  useEffect(() => {
    if (!selectedSaleId) return;

    const master = (rows || []).find((r) => String(r.sale_id) === String(selectedSaleId));
    fetchPurchaseDetailList({
      sale_id: selectedSaleId,
      account_id: master?.account_id || filters.account_id,
    });
  }, [selectedSaleId]); // ✅ rows 변화로는 재조회 안 함

  // ✅ 상단 행 클릭 → 하단 조회 (중복 account_id 제거)
  const handleMasterRowClick = useCallback(
    async (row, rowIndex) => {
      const saleId = row?.sale_id;
      if (!saleId) return;

      setSelectedSaleId(String(saleId));
      setSelectedMasterIndex(rowIndex);

      await fetchPurchaseDetailList({
        sale_id: saleId,
        account_id: row?.account_id || filters.account_id,
      });
    },
    [fetchPurchaseDetailList, filters.account_id]
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
      amount: "",

      // ✅ 기본값(선택)
      taxType: "3",
      itemType: "3",

      receipt_image: master?.receipt_image || "",
      note: "",

      user_id,
      __isNew: true,
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

  // ✅ 저장(상단 + 하단 같이)
  const handleSave = useCallback(async () => {
    try {
      // ✅ 상단: 변경된 행만, 하지만 "행 전체"를 전송
      const modifiedMaster = (rows || [])
        .filter((r) => {
          const key = String(r?.sale_id ?? "");
          const o = originalMasterMap.get(key);
          // 원본이 없으면 신규/비정상 -> 전체 전송 대상으로 처리하고 싶으면 true
          if (!o) return true;
          return isRowChanged(o, r);
        })
        .map((r) => buildRowForSave(r)); // ✅ buildRowForSave가 { ...r } 이므로 행 전체가 감

      // ✅ 하단은 기존 로직 유지
      const modifiedDetail = (detailRows || [])
        .map((r, idx) => {
          const o = originalDetailRows?.[idx];
          if (!o) return buildDetailRowForSave(r);
          return isDetailRowChanged(o, r) ? buildDetailRowForSave(r) : null;
        })
        .filter(Boolean);

      if (modifiedMaster.length === 0 && modifiedDetail.length === 0) {
        return Swal.fire("안내", "변경된 내용이 없습니다.", "info");
      }

      Swal.fire({
        title: "저장 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

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

      if (Array.isArray(detailRows) && detailRows.length > 0 && modifiedDetail.length > 0) {
        const res2 = await api.post("/Account/AccountPurchaseDetailSave", modifiedDetail, {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
        });
        const ok2 = res2?.status === 200 || res2?.data?.code === 200;
        if (!ok2) {
          Swal.close();
          return Swal.fire("실패", res2?.data?.message || "하단 저장 실패", "error");
        }
      }

      Swal.close();
      Swal.fire("성공", "저장되었습니다.", "success");

      await fetchPurchaseList(filters);

      if (selectedSaleId) {
        await fetchPurchaseDetailList({
          sale_id: selectedSaleId,
          account_id: filters.account_id,
        });
      }
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e?.message || "저장 중 오류가 발생했습니다.", "error");
    }
  }, [
    rows,
    originalMasterMap,
    isRowChanged,
    buildRowForSave,
    fetchPurchaseList,
    filters,
    selectedSaleId,
    fetchPurchaseDetailList,
    detailRows,
    originalDetailRows,
    isDetailRowChanged,
    buildDetailRowForSave,
  ]);

  // -----------------------------
  // ✅ 엑셀 다운로드(메뉴 + 세금계산서)
  // -----------------------------
  const [excelAnchorEl, setExcelAnchorEl] = useState(null);
  const excelMenuOpen = Boolean(excelAnchorEl);

  const handleExcelMenuOpen = (e) => setExcelAnchorEl(e.currentTarget);
  const handleExcelMenuClose = () => setExcelAnchorEl(null);

  const parseNumber = (v) => {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const payTypeText = (v) => {
    const s = String(v);
    if (s === "0") return "전체";
    return s === "2" ? "카드" : "현금";
  };
  const getAccountName = () => {
    const found = accountList.find((a) => String(a.account_id) === String(filters.account_id));
    return found?.account_name || "";
  };

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
      boxCell("B8", `${filters.fromDate} ~ ${filters.toDate}`);
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
        `${filters.fromDate}~${filters.toDate}`,
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
    const filename = `세금계산서_출력용_${getAccountName() || "전체"}_${filters.fromDate}_${
      filters.toDate
    }_${ymd}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, filename);
  };

  const handleExcelDownload = async (type) => {
    handleExcelMenuClose();

    if (type === "taxInvoice") {
      await downloadTaxInvoiceExcel();
      return;
    }
    Swal.fire("준비중", "현재는 세금계산서만 먼저 구현되어 있어요.", "info");
  };

  // ✅ 하단 셀 스타일/값 변경 유틸 (select에도 사용)
  const getDetailCellStyle = useCallback(
    (index, key, val) => {
      const o = originalDetailRows?.[index] || {};
      const ov = o?.[key];

      if (DETAIL_MONEY_KEYS.includes(key)) {
        return stripComma(ov) !== stripComma(val) ? { color: "red" } : { color: "black" };
      }
      if (typeof ov === "string" && typeof val === "string") {
        return normalize(ov) !== normalize(val) ? { color: "red" } : { color: "black" };
      }
      return ov !== val ? { color: "red" } : { color: "black" };
    },
    [originalDetailRows, DETAIL_MONEY_KEYS, stripComma]
  );

  const setDetailCell = useCallback(
    (rowIndex, key, value) => {
      setDetailRows((prev) =>
        prev.map((x, idx) => (idx === rowIndex ? { ...x, [key]: value } : x))
      );
    },
    [setDetailRows]
  );

  // ✅ 하단 amount 합계
  const detailAmountSum = useMemo(() => {
    return (detailRows || []).reduce((sum, r) => {
      const n = Number(stripComma(r?.amount));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [detailRows, stripComma]);

  const detailAmountSumText = useMemo(
    () => detailAmountSum.toLocaleString("ko-KR"),
    [detailAmountSum]
  );

  // ✅ (NEW) 하단 vat 합계
  const detailVatSum = useMemo(() => {
    return (detailRows || []).reduce((sum, r) => {
      const n = Number(stripComma(r?.vat));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [detailRows, stripComma]);

  const detailVatSumText = useMemo(() => detailVatSum.toLocaleString("ko-KR"), [detailVatSum]);

  // ✅ (NEW) 하단 tax 합계
  const detailTaxSum = useMemo(() => {
    return (detailRows || []).reduce((sum, r) => {
      const n = Number(stripComma(r?.tax));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [detailRows, stripComma]);

  const detailTaxSumText = useMemo(() => detailTaxSum.toLocaleString("ko-KR"), [detailTaxSum]);

  useEffect(() => {
    if (!selectedSaleId) return;
    if (selectedMasterIndex < 0) return;

    // 합계 숫자
    const sumTax = detailTaxSum; // ✅ 상세 tax 합계를 상단 tax로
    const sumVat = detailVatSum;

    setRows((prev) => {
      if (!Array.isArray(prev) || !prev[selectedMasterIndex]) return prev;

      const cur = prev[selectedMasterIndex];

      // 상단 taxFree가 있으면 total에 포함
      const taxFreeNum = Number(stripComma(cur?.taxFree));
      const safeTaxFree = Number.isFinite(taxFreeNum) ? taxFreeNum : 0;

      const nextTaxText = sumTax.toLocaleString("ko-KR");
      const nextVatText = sumVat.toLocaleString("ko-KR");
      const nextTotalText = (sumTax + sumVat + safeTaxFree).toLocaleString("ko-KR");

      // 변화 없으면 그대로(무한루프 방지)
      const same =
        String(cur?.tax ?? "") === String(nextTaxText) &&
        String(cur?.vat ?? "") === String(nextVatText) &&
        String(cur?.total ?? "") === String(nextTotalText);

      if (same) return prev;

      return prev.map((r, i) => {
        if (i !== selectedMasterIndex) return r;
        return {
          ...r,
          tax: nextTaxText,
          vat: nextVatText,
          total: nextTotalText,
        };
      });
    });
  }, [
    detailTaxSum,
    detailAmountSum,
    detailVatSum,
    selectedSaleId,
    selectedMasterIndex,
    setRows,
    stripComma,
  ]);

  const toNum = useCallback(
    (v) => {
      const n = Number(stripComma(v));
      return Number.isFinite(n) ? n : 0;
    },
    [stripComma]
  );

  const computeAmount = useCallback(
    (qty, unitPrice) => {
      const q = toNum(qty);
      const p = toNum(unitPrice);
      return q * p;
    },
    [toNum]
  );

  // ✅ 과세(taxType=1)일 때만 VAT = amount / 11 (반올림)
  const computeVat = useCallback((amount, taxType) => {
    const a = Number(amount);
    if (!Number.isFinite(a)) return 0;
    if (String(taxType) !== "1") return 0;
    return Math.round(a / 11);
  }, []);

  // ✅ 과세(taxType=1)일 때만 TAX = amount * 0.1 (반올림)
  const computeTax = useCallback((amount, taxType) => {
    const a = Number(amount);
    if (!Number.isFinite(a)) return 0;
    if (String(taxType) !== "1") return 0;
    return Math.round(a * 0.1);
  }, []);

  // ✅ 하단 VAT/TAX: amount + taxType 기준으로 항상 자동 정리
  useEffect(() => {
    if (!Array.isArray(detailRows) || detailRows.length === 0) return;

    setDetailRows((prev) => {
      let changed = false;

      const next = prev.map((row) => {
        const taxType = String(row?.taxType ?? "");
        const amountNum = toNum(row?.amount);

        const vatNum = computeVat(amountNum, taxType);
        const taxNum = computeTax(amountNum, taxType);

        const vatText = (taxType === "1" ? vatNum : 0).toLocaleString("ko-KR");
        const taxText = (taxType === "1" ? taxNum : 0).toLocaleString("ko-KR");

        const needVat = String(row?.vat ?? "") !== String(vatText);
        const needTax = String(row?.tax ?? "") !== String(taxText);

        if (needVat || needTax) {
          changed = true;
          return { ...row, vat: vatText, tax: taxText };
        }
        return row;
      });

      return changed ? next : prev; // ✅ 무한루프 방지
    });
  }, [detailRows, setDetailRows, toNum, computeVat, computeTax]);

  // =========================
  // ✅ (NEW) 거래처 Autocomplete 옵션/선택값
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
      <>
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
          <TextField
            select
            label="타입"
            size="small"
            name="type"
            onChange={handleFilterChange}
            sx={{ minWidth: isMobile ? 100 : 120 }}
            SelectProps={{ native: true }}
            value={filters.type}
          >
            <option value="1">요양원</option>
            <option value="4">산업체</option>
            <option value="5">학교</option>
          </TextField>

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

          <TextField
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={handleFilterChange}
            size="small"
            label="조회기간(From)"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: isMobile ? 100 : 120 }}
          />

          <TextField
            type="date"
            name="toDate"
            value={filters.toDate}
            onChange={handleFilterChange}
            size="small"
            label="조회기간(To)"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: isMobile ? 100 : 120 }}
          />

          {/* ✅ 거래처: 검색 가능한 Autocomplete */}
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
            onClick={handleSave}
            sx={{ minWidth: isMobile ? 90 : 100, fontSize: isMobile ? "11px" : "13px" }}
          >
            저장
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleExcelMenuOpen}
            sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "11px" : "13px" }}
          >
            엑셀다운로드
          </MDButton>

          <Menu anchorEl={excelAnchorEl} open={excelMenuOpen} onClose={handleExcelMenuClose}>
            <MenuItem onClick={() => handleExcelDownload("taxInvoice")}>세금계산서</MenuItem>
            <MenuItem onClick={() => handleExcelDownload("invoice")}>계산서</MenuItem>
            <MenuItem onClick={() => handleExcelDownload("simple")}>간이과세</MenuItem>
          </Menu>

          <MDButton
            variant="gradient"
            color="info"
            sx={{ minWidth: isMobile ? 70 : 90, fontSize: isMobile ? "11px" : "13px" }}
          >
            인쇄
          </MDButton>
        </MDBox>
        {/* =========================
          ✅ 상단(집계) 테이블
         ========================= */}
        <MDBox pt={0} pb={2} sx={tableSx}>
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
              매입마감
            </MDTypography>
          </MDBox>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.accessorKey} style={{ minWidth: col.size }}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ textAlign: "center", padding: "12px" }}>
                        데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        onClick={() => handleMasterRowClick(row, rowIndex)}
                        style={{
                          cursor: "pointer",
                          backgroundColor:
                            rowIndex === selectedMasterIndex
                              ? "rgba(25,118,210,0.10)"
                              : "transparent",
                        }}
                      >
                        {columns.map((col) => {
                          const key = col.accessorKey;
                          const value = row[key] ?? "";
                          if (key === "saleDate") {
                            const v = String(value || "");
                            const d = dayjs(v, "YYYY-MM-DD", true).isValid()
                              ? dayjs(v, "YYYY-MM-DD")
                              : null;

                            return (
                              <td
                                key={key}
                                style={{
                                  ...getCellStyle(rowIndex, key, value),
                                  width: `${col.size}px`,
                                  padding: "4px", // ✅ DatePicker가 셀 꽉 차게
                                }}
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
                          // ✅ 사업장(account_name)은 수정 불가
                          if (key === "account_name") {
                            return (
                              <td
                                key={key}
                                style={{
                                  width: `${col.size}px`,
                                  color: "#111",
                                  backgroundColor: "rgba(0,0,0,0.03)",
                                  cursor: "default",
                                }}
                                title="사업장명은 수정할 수 없습니다."
                              >
                                {value}
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
                                style={{
                                  ...getCellStyle(rowIndex, key, value),
                                  width: `${col.size}px`,
                                }}
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
                            const hasImage = !!value;

                            return (
                              <td
                                key={key}
                                style={{
                                  ...getCellStyle(rowIndex, key, value),
                                  width: `${col.size}px`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Box
                                  display="flex"
                                  justifyContent="center"
                                  alignItems="center"
                                  gap={0.5}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={
                                      hasImage ? () => handleDownload(value) : handleNoImageAlert
                                    }
                                    color={hasImage ? "primary" : "error"}
                                    sx={{ padding: "3px", lineHeight: 0 }}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>

                                  <IconButton
                                    size="small"
                                    onClick={
                                      hasImage ? () => handleViewImage(value) : handleNoImageAlert
                                    }
                                    color={hasImage ? "primary" : "error"}
                                    sx={{ padding: "3px", lineHeight: 0 }}
                                  >
                                    <ImageSearchIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={key}
                              contentEditable
                              suppressContentEditableWarning
                              onClick={(e) => e.stopPropagation()} // ✅ 이거 켜기
                              onKeyDown={(e) => e.stopPropagation()} // ✅ 입력 중 전파 방지(추천)
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
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: `${col.size}px`,
                              }}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Grid>
          </Grid>
        </MDBox>

        {/* ✅ 상단/하단 사이: 하단 행추가 버튼 */}
        <MDBox display="flex" justifyContent="flex-end" px={1} py={1} gap={1}>
          <MDButton
            variant="gradient"
            color="success"
            onClick={handleDetailAddRow}
            sx={{ minWidth: isMobile ? 110 : 130, fontSize: isMobile ? "11px" : "13px" }}
          >
            상세 행추가
          </MDButton>
        </MDBox>

        {/* =========================
          ✅ 하단(상세) 테이블  (✅ 여기서 taxType/itemType 셀을 select로 변경)
         ========================= */}
        <MDBox pt={0} pb={2} sx={tableSx}>
          <MDBox
            py={1}
            px={1}
            pt={1}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="secondary"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ position: "sticky", top: 0, zIndex: 3 }}
          >
            <MDTypography variant="h6" color="white">
              매입상세
            </MDTypography>
          </MDBox>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <table>
                <thead>
                  <tr>
                    {[
                      { h: "일자", k: "saleDate", w: 110 },
                      { h: "품목", k: "name", w: 220 },
                      { h: "수량", k: "qty", w: 90 },
                      { h: "단가", k: "unitPrice", w: 110 },
                      { h: "과세", k: "tax", w: 110 },
                      { h: "부가세", k: "vat", w: 110 },
                      { h: "금액", k: "amount", w: 120 },
                      { h: "과세구분", k: "taxType", w: 110 },
                      { h: "품목구분", k: "itemType", w: 110 },
                      { h: "비고", k: "note", w: 240 },
                    ].map((c) => (
                      <th key={c.k} style={{ minWidth: c.w }}>
                        {c.h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "12px" }}>
                        상세 조회 중...
                      </td>
                    </tr>
                  ) : !selectedSaleId ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "12px" }}>
                        상단에서 행을 클릭하면 상세가 조회됩니다.
                      </td>
                    </tr>
                  ) : detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "12px" }}>
                        상세 데이터가 없습니다. [상세 행추가]로 입력할 수 있습니다.
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((r, i) => {
                      const o = originalDetailRows?.[i] || {};
                      const rowChanged = isDetailRowChanged(o, r);

                      return (
                        <tr
                          key={i}
                          style={{
                            backgroundColor: rowChanged ? "rgba(211,47,47,0.04)" : "transparent",
                          }}
                        >
                          {/* saleDate */}
                          <td
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setDetailCell(i, "saleDate", e.target.innerText.trim())}
                            style={{
                              width: 110,
                              ...getDetailCellStyle(i, "saleDate", r.saleDate),
                            }}
                          >
                            {r.saleDate ?? ""}
                          </td>

                          {/* name */}
                          <td
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setDetailCell(i, "name", e.target.innerText)}
                            style={{
                              width: 220,
                              textAlign: "left",
                              ...getDetailCellStyle(i, "name", r.name),
                            }}
                          >
                            {r.name ?? ""}
                          </td>

                          <td
                            style={{
                              width: 90,
                              textAlign: "right",
                              ...getDetailCellStyle(i, "qty", r.qty),
                            }}
                          >
                            <input
                              type="text"
                              value={r.qty ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                // qty 변경 즉시 반영
                                const nextAmountNum = computeAmount(v, r.unitPrice);
                                const nextAmountText = nextAmountNum
                                  ? nextAmountNum.toLocaleString("ko-KR")
                                  : "";

                                const vatNum = computeVat(nextAmountNum, next.taxType);
                                next.vat =
                                  String(next.taxType) === "1"
                                    ? vatNum.toLocaleString("ko-KR")
                                    : "0";

                                setDetailRows((prev) =>
                                  prev.map((row, idx) => {
                                    if (idx !== i) return row;

                                    const nextAmountNum = computeAmount(v, row.unitPrice);
                                    const nextAmountText = nextAmountNum
                                      ? nextAmountNum.toLocaleString("ko-KR")
                                      : "";

                                    const taxType = String(row.taxType ?? "");
                                    const vatNum = computeVat(nextAmountNum, taxType);
                                    const taxNum = computeTax(nextAmountNum, taxType);

                                    return {
                                      ...row,
                                      qty: v,
                                      amount: nextAmountText,
                                      vat: (taxType === "1" ? vatNum : 0).toLocaleString("ko-KR"),
                                      tax: (taxType === "1" ? taxNum : 0).toLocaleString("ko-KR"),
                                    };
                                  })
                                );
                              }}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                setDetailCell(i, "qty", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              width: 110,
                              textAlign: "right",
                              ...getDetailCellStyle(i, "unitPrice", r.unitPrice),
                            }}
                          >
                            <input
                              type="text"
                              value={r.unitPrice ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                const nextAmountNum = computeAmount(r.qty, v);
                                const nextAmountText = nextAmountNum
                                  ? nextAmountNum.toLocaleString("ko-KR")
                                  : "";

                                const vatNum = computeVat(nextAmountNum, next.taxType);
                                next.vat =
                                  String(next.taxType) === "1"
                                    ? vatNum.toLocaleString("ko-KR")
                                    : "0";

                                setDetailRows((prev) =>
                                  prev.map((row, idx) => {
                                    if (idx !== i) return row;

                                    const nextAmountNum = computeAmount(row.qty, v);
                                    const nextAmountText = nextAmountNum
                                      ? nextAmountNum.toLocaleString("ko-KR")
                                      : "";

                                    const taxType = String(row.taxType ?? "");
                                    const vatNum = computeVat(nextAmountNum, taxType);
                                    const taxNum = computeTax(nextAmountNum, taxType);

                                    return {
                                      ...row,
                                      unitPrice: v,
                                      amount: nextAmountText,
                                      vat: (taxType === "1" ? vatNum : 0).toLocaleString("ko-KR"),
                                      tax: (taxType === "1" ? taxNum : 0).toLocaleString("ko-KR"),
                                    };
                                  })
                                );
                              }}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                setDetailCell(i, "unitPrice", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "inherit",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              width: 110,
                              textAlign: "right",
                              ...getDetailCellStyle(i, "tax", r.tax),
                              backgroundColor: "rgba(0,0,0,0.03)",
                            }}
                            title="과세(tax)는 amount 기준으로 자동 계산됩니다."
                          >
                            <input
                              type="text"
                              value={r.tax ?? ""}
                              readOnly
                              tabIndex={-1}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "inherit",
                                cursor: "not-allowed",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              width: 110,
                              textAlign: "right",
                              ...getDetailCellStyle(i, "vat", r.vat),
                              backgroundColor: "rgba(0,0,0,0.03)",
                            }}
                            title="부가세(vat)는 amount와 과세구분(taxType) 기준으로 자동 계산됩니다."
                          >
                            <input
                              type="text"
                              value={r.vat ?? ""}
                              readOnly
                              tabIndex={-1}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "inherit",
                                cursor: "not-allowed",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              width: 120,
                              textAlign: "right",
                              ...getDetailCellStyle(i, "amount", r.amount),
                            }}
                          >
                            <input
                              type="text"
                              value={r.amount ?? ""}
                              onChange={(e) => {
                                // 금액 직접 수정도 즉시 합계 반영
                                const v = e.target.value;

                                setDetailRows((prev) =>
                                  prev.map((row, idx) => {
                                    if (idx !== i) return row;

                                    const taxType = String(row.taxType ?? "");
                                    const amountNum = toNum(v);
                                    const vatNum = computeVat(amountNum, taxType);
                                    const taxNum = computeTax(amountNum, taxType);

                                    return {
                                      ...row,
                                      amount: v,
                                      vat: (taxType === "1" ? vatNum : 0).toLocaleString("ko-KR"),
                                      tax: (taxType === "1" ? taxNum : 0).toLocaleString("ko-KR"),
                                    };
                                  })
                                );
                              }}
                              onBlur={(e) => {
                                const formatted = formatComma(e.target.value);
                                setDetailCell(i, "amount", formatted);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "right",
                                fontSize: "12px",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "inherit",
                              }}
                            />
                          </td>

                          {/* ✅ taxType: select (1=과세,2=면세,3=알수없음) */}
                          {(() => {
                            const cellStyle = getDetailCellStyle(i, "taxType", r.taxType);
                            return (
                              <td style={{ width: 110, ...cellStyle }}>
                                <select
                                  value={r.taxType ?? ""}
                                  onChange={(e) => {
                                    const nextTaxType = e.target.value;

                                    setDetailRows((prev) =>
                                      prev.map((row, idx) => {
                                        if (idx !== i) return row;

                                        const amountNum = toNum(row.amount);
                                        const vatNum = computeVat(amountNum, nextTaxType);

                                        return {
                                          ...row,
                                          taxType: nextTaxType,
                                          vat: (String(nextTaxType) === "1"
                                            ? vatNum
                                            : 0
                                          ).toLocaleString("ko-KR"),
                                          tax: (String(nextTaxType) === "1"
                                            ? taxNum
                                            : 0
                                          ).toLocaleString("ko-KR"),
                                        };
                                      })
                                    );
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    border: "none",
                                    background: "transparent",
                                    textAlign: "center",
                                    width: "100%",
                                    color: "inherit",
                                  }}
                                >
                                  <option value="1">과세</option>
                                  <option value="2">면세</option>
                                  <option value="3">알수없음</option>
                                </select>
                              </td>
                            );
                          })()}

                          {/* ✅ itemType: select (1=식재료,2=소모품,3=알수없음) */}
                          {(() => {
                            const cellStyle = getDetailCellStyle(i, "itemType", r.itemType);
                            return (
                              <td style={{ width: 110, ...cellStyle }}>
                                <select
                                  value={r.itemType ?? ""}
                                  onChange={(e) => setDetailCell(i, "itemType", e.target.value)}
                                  style={{
                                    fontSize: "12px",
                                    border: "none",
                                    background: "transparent",
                                    textAlign: "center",
                                    width: "100%",
                                    color: "inherit",
                                  }}
                                >
                                  <option value="1">식재료</option>
                                  <option value="2">소모품</option>
                                  <option value="3">경관식</option>
                                </select>
                              </td>
                            );
                          })()}

                          {/* note */}
                          <td
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setDetailCell(i, "note", e.target.innerText)}
                            style={{
                              width: 240,
                              textAlign: "left",
                              ...getDetailCellStyle(i, "note", r.note),
                            }}
                          >
                            {r.note ?? ""}
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
                        colSpan={4}
                        style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}
                      >
                        합계
                      </td>

                      {/* ✅ tax 합계 (과세) */}
                      <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>
                        {detailTaxSumText}
                      </td>

                      {/* ✅ vat 합계 */}
                      <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>
                        {detailVatSumText}
                      </td>

                      {/* ✅ amount 합계 */}
                      <td style={{ textAlign: "right", fontWeight: 700, background: "#f7f7f7" }}>
                        {detailAmountSumText}
                      </td>

                      <td colSpan={3} style={{ background: "#f7f7f7" }} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </Grid>
          </Grid>
        </MDBox>

        {/* ========================= ✅ 떠있는 창 미리보기 ========================= */}
        {viewerOpen &&
          ReactDOM.createPortal(
            <Box sx={{ position: "fixed", inset: 0, zIndex: 18000, pointerEvents: "none" }}>
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
                    zIndex: 19000,
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
                      {currentFile?.title || "영수증 미리보기"}
                      {fileItems.length ? `  (${viewerIndex + 1}/${fileItems.length})` : ""}
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
                          disabled={fileItems.length <= 1}
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
                          disabled={fileItems.length <= 1}
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
                            const src = currentFile?.src;
                            if (src) window.open(src, "_blank", "noopener,noreferrer");
                          }}
                          disabled={!currentFile?.src}
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
                            const path = currentFile?.path;
                            if (path) handleDownload(path);
                          }}
                          disabled={!currentFile?.path}
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
                    {currentFile?.src ? (
                      currentFile.isPdf ? (
                        <Box sx={{ width: "100%", height: "100%", bgcolor: "#111" }}>
                          <iframe
                            title="pdf-preview"
                            src={currentFile.src}
                            style={{ width: "100%", height: "100%", border: 0 }}
                          />
                        </Box>
                      ) : (
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
                              {/* 기존 줌 버튼들 그대로 */}
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
                                    src={currentFile.src}
                                    alt="미리보기"
                                    onError={() =>
                                      Swal.fire(
                                        "미리보기 실패",
                                        "이미지 경로 또는 서버 응답을 확인해주세요.",
                                        "error"
                                      )
                                    }
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
                      )
                    ) : (
                      <Typography sx={{ color: "#fff", p: 2 }}>파일이 없습니다.</Typography>
                    )}
                  </Box>
                </Paper>
              </Draggable>
            </Box>,
            document.body
          )}
      </>
    </LocalizationProvider>
  );
}

export default AccountPurchaseDeadlineTab;
