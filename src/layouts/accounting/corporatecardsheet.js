/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
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

import HeaderWithLogout from "components/Common/HeaderWithLogout";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";
import useCorporateCardData from "./data/CorporateCardData";

// ========================= 상수/유틸 =========================
const DEPARTMENTS = [
  { value: 2, label: "회계팀" },
  { value: 3, label: "인사팀" },
  { value: 4, label: "영업팀" },
  { value: 5, label: "운영팀" },
  { value: 6, label: "개발팀" },
];

// ✅ 영수증 타입(상단 테이블용)
const RECEIPT_TYPES = [
  { value: "UNKNOWN", label: "알수없음" },
  { value: "CARD_SLIP_GENERIC", label: "카드전표" },
  { value: "MART_ITEMIZED", label: "마트" },
  { value: "CONVENIENCE", label: "편의점" },
  { value: "COUPANG_APP", label: "쿠팡" },
  { value: "COUPANG_CARD", label: "배달앱" },
];

const DEFAULT_DEPARTMENT = 5;
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
  if (typeof orig === "string" && typeof cur === "string") return normalize(orig) !== normalize(cur);
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

// ✅ yyyy-mm-dd
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

const formatNumber = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) return "";
  return n.toLocaleString();
};

const parseNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

function CorporateCardSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { loading, activeRows, fetchHeadOfficeCorporateCardList, paymentRows, fetchHeadOfficeCorporateCardPaymentList } =
    useCorporateCardData();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [masterRows, setMasterRows] = useState([]);
  const [origMasterRows, setOrigMasterRows] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);

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

  // ========================= 조회 =========================
  const handleFetchMaster = useCallback(async () => {
    await fetchHeadOfficeCorporateCardPaymentList({ year, month });
  }, [fetchHeadOfficeCorporateCardPaymentList, year, month]);

  // ✅ 카드목록 최초 1회 로드 (StrictMode 2회 호출 방지)
  const didLoadCardsRef = useRef(false);
  useEffect(() => {
    if (didLoadCardsRef.current) return;
    didLoadCardsRef.current = true;
    fetchHeadOfficeCorporateCardList();
  }, [fetchHeadOfficeCorporateCardList]);

  // ✅ 연/월 변경 시 자동 조회 (월 바뀌면 로컬 신규행 제거)
  useEffect(() => {
    skipPendingNewMergeRef.current = true;
    setSelectedMaster(null);
    handleFetchMaster();
  }, [year, month, handleFetchMaster]);

  // ✅ 삭제되지 않은 카드만, 부서별로 그룹
  const cardsByDept = useMemo(() => {
    const list = (activeRows || []).filter((r) => String(r.del_yn || "N") !== "Y");

    const map = {};
    for (const r of list) {
      const dept = Number(r.department);
      if (!dept) continue;
      if (!map[dept]) map[dept] = [];
      map[dept].push({
        card_no: onlyDigits(r.card_no),
        card_brand: r.card_brand,
      });
    }

    // 부서별 중복 제거
    for (const k of Object.keys(map)) {
      const seen = new Set();
      map[k] = map[k].filter((x) => {
        const key = `${x.card_brand}|${x.card_no}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return map;
  }, [activeRows]);

  // ✅ 서버 paymentRows 갱신 시: 서버행 + (옵션) 로컬 신규행
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

    // contentEditable DOM 잔상 제거 (상단 테이블 리마운트)
    setMasterRenderKey((k) => k + 1);
  }, [paymentRows]);

  // ========================= 변경 핸들러 =========================
  const handleMasterCellChange = useCallback((rowIndex, key, value) => {
    setMasterRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  }, []);

  // ✅ 상단: 부서 변경 시 카드 초기화(+ 카드가 1개면 자동 선택)
  const handleDepartmentChange = useCallback(
    (rowIndex, deptValue) => {
      const dept = Number(deptValue);
      const options = cardsByDept[dept] || [];
      const auto = options.length === 1 ? options[0] : null;

      setMasterRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIndex) return r;
          return {
            ...r,
            department: dept,
            cardNo: auto?.card_no || "",
            cardBrand: auto?.card_brand || DEFAULT_CARD_BRAND,
          };
        })
      );
    },
    [cardsByDept]
  );

  // ✅ 상단: 카드 선택 시 cardNo + cardBrand 동시 세팅
  const handleCardSelect = useCallback(
    (rowIndex, cardNoDigits) => {
      const digits = onlyDigits(cardNoDigits);

      setMasterRows((prev) => {
        const row = prev[rowIndex] || {};
        const dept = Number(row.department);
        const options = cardsByDept[dept] || [];
        const picked = options.find((o) => o.card_no === digits);

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
    [cardsByDept]
  );

  // ✅ 행추가
  const addMasterRow = useCallback(() => {
    const paymentDtDefault = defaultPaymentDtForYM(year, month);

    const newRow = {
      client_id: makeTempId(),
      sale_id: "",

      department: "",
      payment_dt: paymentDtDefault,

      use_name: "",
      bizNo: "",
      total: 0,
      vat: 0,
      taxFree: 0,
      totalCard: 0,
      cardNo: "",
      cardBrand: DEFAULT_CARD_BRAND,

      receipt_type: "UNKNOWN",
      receipt_image: "",
      note: "",
      reg_dt: "",
      user_id: localStorage.getItem("user_id") || "",

      isNew: true,
    };

    setMasterRows((prev) => [...prev, newRow]);
    requestAnimationFrame(() => scrollMasterToBottom(true));
  }, [year, month, scrollMasterToBottom]);

  // ========================= 영수증 업로드/스캔 =========================
  const handleImageUpload = useCallback(
    async (file, rowIndex) => {
      if (!file) return;

      const row = masterRows[rowIndex] || {};
      const deptOk = !!Number(row.department);
      const cardOk = !!onlyDigits(row.cardNo);
      const typeOk = !!String(row.receipt_type || "");

      if (!deptOk || !cardOk) {
        return Swal.fire("경고", "영수증 업로드 전에 부서와 카드번호를 먼저 선택해주세요.", "warning");
      }
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
        // ✅ 타입 전달 (행에서 선택한 값)
        formData.append("type", row.receipt_type);
        formData.append("objectValue", row.department);
        formData.append("folderValue", "hocCorporate");
        formData.append("cardNo", row.cardNo);
        formData.append("cardBrand", row.cardBrand);
        formData.append("saveType", "headoffice");

        const res = await api.post("/card-receipt/parse", formData, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        Swal.close();

        if (res.status !== 200) {
          return Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
        }

        const data = res.data || {};
        const main = data.main || {};

        const patch = {
          ...(main.sale_id != null ? { sale_id: main.sale_id } : {}),
          ...(main.department != null && main.department !== "" ? { department: main.department } : {}),
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

        setMasterRows((prev) =>
          prev.map((r, i) => {
            if (i !== rowIndex) return r;
            return {
              ...r,
              ...patch,
              department: patch.department !== undefined ? patch.department : r.department ?? "",
            };
          })
        );

        Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        skipPendingNewMergeRef.current = true;
        await handleFetchMaster();
      } catch (err) {
        Swal.close();
        Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
      }
    },
    [masterRows, handleFetchMaster]
  );

  // ========================= 저장: main만 (item은 제거) =========================
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
    return row;
  }, []);

  const saveAll = useCallback(async () => {
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

    if (main.length === 0) {
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
        "/Account/HeadOfficeCorporateCardPaymentAllSave",
        { main, item: [] },
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
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 오류", "error");
    }
  }, [masterRows, handleFetchMaster, origMasterBySaleId, normalizeMasterForSave]);

  // ========================= ✅ (적용) 떠있는 창(윈도우) 미리보기: 뒤 테이블 입력 가능 =========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
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
    setViewerIndex((i) => (imageItems.length ? (i - 1 + imageItems.length) % imageItems.length : 0));
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
    await fetchHeadOfficeCorporateCardList();
  }, [fetchHeadOfficeCorporateCardList]);

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
        department: DEFAULT_DEPARTMENT,
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
      const deptOk = !!r.department;
      const brandOk = !!r.card_brand;
      const noOk = !!onlyDigits(r.card_no);
      return !(deptOk && brandOk && noOk);
    });

    if (invalid) {
      return Swal.fire("경고", "부서, 카드사, 카드번호는 필수입니다.", "warning");
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
        await fetchHeadOfficeCorporateCardList();
      } else {
        Swal.fire("실패", res.data?.message || "저장 실패", "error");
      }
    } catch (e) {
      Swal.fire("오류", e.message || "저장 중 오류", "error");
    }
  }, [cardRows, fetchHeadOfficeCorporateCardList]);

  // ========================= 컬럼 정의 =========================
  const masterColumns = useMemo(
    () => [
      { header: "부서", key: "department", editable: false, size: 120 },
      { header: "결제일자", key: "payment_dt", editable: true, editType: "date", size: 130 },
      { header: "사용처", key: "use_name", editable: true, size: 140 },
      { header: "사업자번호", key: "bizNo", editable: true, size: 120 },
      { header: "총구매금액", key: "total", editable: true, size: 110 },
      { header: "총부가세", key: "vat", editable: true, size: 90 },
      { header: "총면세", key: "taxFree", editable: true, size: 90 },
      { header: "총카드금액", key: "totalCard", editable: true, size: 110 },
      { header: "카드번호", key: "cardNo", editable: false, size: 200 },
      { header: "카드사", key: "cardBrand", editable: false, size: 130 },
      { header: "영수증타입", key: "receipt_type", editable: false, size: 120, type: "select", options: RECEIPT_TYPES },
      { header: "영수증사진", key: "receipt_image", editable: false, size: 130 },
      { header: "비고", key: "note", editable: true, size: 160 },
      { header: "등록일자", key: "reg_dt", editable: false, size: 110 },
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
        <HeaderWithLogout showMenuButton title="💳 본사 법인카드 관리" />

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
            <Select size="small" value={year} onChange={(e) => setYear(e.target.value)} sx={{ minWidth: 110 }}>
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
                <MenuItem key={y} value={y}>
                  {y}년
                </MenuItem>
              ))}
            </Select>

            <Select size="small" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 90 }}>
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

            <MDButton variant="gradient" color="info" onClick={openCardModal} sx={{ minWidth: 120 }}>
              법인카드관리
            </MDButton>
          </Box>
        </MDBox>
      </MDBox>

      {/* ====== 상단 테이블만 크게 ====== */}
      <MDBox sx={{ height: "calc(100vh - 170px)", mt: 1.5 }}>
        <MDBox
          ref={masterWrapRef}
          sx={{
            height: "100%",
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
          <table key={`master-${year}-${month}-${masterRenderKey}`}>
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
                      selectedMaster?.sale_id && selectedMaster?.sale_id === row.sale_id && row.sale_id ? "#d3f0ff" : "white",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedMaster(row)}
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

                    if (key === "department") {
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={row.department || ""}
                            onChange={(e) => handleDepartmentChange(rowIndex, e.target.value)}
                            onClick={(ev) => ev.stopPropagation()}
                            displayEmpty
                            sx={{ fontSize: 12, height: 28 }}
                          >
                            <MenuItem value="">
                              <em>선택</em>
                            </MenuItem>
                            {DEPARTMENTS.map((d) => (
                              <MenuItem key={d.value} value={d.value}>
                                {d.label}
                              </MenuItem>
                            ))}
                          </Select>
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
                            onChange={(e) => handleMasterCellChange(rowIndex, "payment_dt", e.target.value)}
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
                      const dept = Number(row.department);
                      const options = cardsByDept[dept] || [];
                      const disabled = !dept || options.length === 0;

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
                              <em>{!dept ? "부서 먼저 선택" : options.length === 0 ? "등록된 카드 없음" : "카드 선택"}</em>
                            </MenuItem>

                            {options.map((opt) => (
                              <MenuItem key={`${opt.card_brand}-${opt.card_no}`} value={opt.card_no}>
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

                    if (key === "receipt_type") {
                      return (
                        <td key={key} style={{ width: c.size }}>
                          <Select
                            size="small"
                            fullWidth
                            value={String(row.receipt_type ?? "UNKNOWN")}
                            onChange={(e) => handleMasterCellChange(rowIndex, "receipt_type", e.target.value)}
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
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
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
      </MDBox>

      {/* ========================= ✅ 떠있는 창 미리보기: 뒤 테이블 입력 가능 ========================= */}
      {viewerOpen && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            pointerEvents: "none", // ✅ 전체 화면은 클릭 통과
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

                pointerEvents: "auto", // ✅ 창만 클릭 가능
                backgroundColor: "#000",
              }}
            >
              {/* 타이틀바(드래그 핸들) */}
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

              {/* 컨텐츠 영역 */}
              <Box
                sx={{
                  height: "calc(100% - 42px)",
                  bgcolor: "#000",
                  position: "relative",
                }}
              >
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
                        {/* 줌 컨트롤(우상단) */}
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
                            <IconButton size="small" onClick={zoomIn} sx={{ bgcolor: "rgba(255,255,255,0.15)" }}>
                              <ZoomInIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="축소">
                            <IconButton size="small" onClick={zoomOut} sx={{ bgcolor: "rgba(255,255,255,0.15)" }}>
                              <ZoomOutIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="리셋">
                            <IconButton size="small" onClick={resetTransform} sx={{ bgcolor: "rgba(255,255,255,0.15)" }}>
                              <RestartAltIcon sx={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* 이미지 */}
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
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6">법인카드관리</Typography>

            <MDButton color="info" size="small" onClick={addCardRow}>
              행추가
            </MDButton>
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
                  <th style={{ width: 140 }}>부서</th>
                  <th style={{ width: 180 }}>카드사</th>
                  <th style={{ width: 240 }}>카드번호</th>
                  <th style={{ width: 120 }}>삭제여부</th>
                </tr>
              </thead>

              <tbody>
                {cardRows.map((row, idx) => {
                  const deptChanged = isChangedValue(origCardRows[idx]?.department, row.department);
                  const brandChanged = isChangedValue(origCardRows[idx]?.card_brand, row.card_brand);
                  const noChanged = isChangedValue(origCardRows[idx]?.card_no, row.card_no);
                  const delChanged = isChangedValue(origCardRows[idx]?.del_yn, row.del_yn);

                  return (
                    <tr key={row.idx ?? `new_${idx}`}>
                      <td style={{ color: deptChanged ? "red" : "black" }}>
                        <Select
                          size="small"
                          fullWidth
                          value={row.department ?? DEFAULT_DEPARTMENT}
                          onChange={(e) => handleCardCell(idx, "department", e.target.value)}
                        >
                          {DEPARTMENTS.map((d) => (
                            <MenuItem key={d.value} value={d.value}>
                              {d.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </td>

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
                            value={cardNoEditingIndex === idx ? formatCardNoFull(row.card_no) : maskCardNo(row.card_no)}
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
