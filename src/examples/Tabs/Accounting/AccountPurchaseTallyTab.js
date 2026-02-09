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

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import { API_BASE_URL } from "config";
import useAccountPurchaseTallyData from "./accountPurchaseTallyData";

function AccountPurchaseTallyTab() {
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
    payType: "1", // 조회구분
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);
  const [accountInput, setAccountInput] = useState("");

  // ✅ 데이터 훅 사용
  const { rows, setRows, originalRows, loading, fetchPurchaseList } = useAccountPurchaseTallyData();

  // =========================================
  // ✅ 숫자(콤마 대상) 컬럼
  // =========================================
  const MONEY_KEYS = useMemo(
    () => [
      "cons_tax",
      "cons_vat",
      "cons_free",
      "cons_total",
      "food_tax",
      "food_vat",
      "food_free",
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
      if (!Number.isFinite(num)) return String(v); // 숫자 아니면 그대로
      return num.toLocaleString("ko-KR");
    },
    [stripComma]
  );

  // ✅ rows가 바뀌면(조회 후) qty/unitPrice/amount 콤마 적용해서 화면에 표시
  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const formatted = rows.map((r) => {
      const nr = { ...r };
      MONEY_KEYS.forEach((k) => {
        nr[k] = formatComma(nr[k]);
      });
      return nr;
    });

    const changed = formatted.some((r, i) =>
      MONEY_KEYS.some((k) => String(r?.[k] ?? "") !== String(rows?.[i]?.[k] ?? ""))
    );

    if (changed) setRows(formatted);
  }, [rows, setRows, MONEY_KEYS, formatComma]);

  // ✅ 최초 로딩 시: 거래처 목록 조회 + 첫 번째 거래처 자동 선택 & 자동 조회
  useEffect(() => {
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
          setFilters((prev) => {
            const next = { ...prev, account_id: firstId };
            fetchPurchaseList(next);
            return next;
          });
        }
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []); // 의도적으로 1회

  // ✅ 조회조건 변경
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "account_id") fetchPurchaseList(next);
      return next;
    });
  };

  // ✅ 조회 버튼 클릭 (다른 조건 변경 후 수동조회)
  const handleSearch = async () => {
    try {
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

    // ✅ 숫자 컬럼은 콤마 제외하고 비교
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
      { header: "날짜", accessorKey: "saleDate", size: 100 },
      { header: "구매처", accessorKey: "purchase_name", size: 160 },

      // 소모품
      { header: "과세", accessorKey: "cons_tax", size: 90 },
      { header: "부가세", accessorKey: "cons_vat", size: 90 },
      { header: "면세", accessorKey: "cons_free", size: 90 },
      { header: "합계", accessorKey: "cons_total", size: 90 },

      // 식자재
      { header: "과세", accessorKey: "food_tax", size: 90 },
      { header: "부가세", accessorKey: "food_vat", size: 90 },
      { header: "면세", accessorKey: "food_free", size: 90 },
      { header: "합계", accessorKey: "food_total", size: 90 },

      // 기타
      { header: "증빙자료 사진▼", accessorKey: "receipt_image", size: 160 },

      // 이체일
      { header: "이체일", accessorKey: "transfer_dt", size: 110 },
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

  // 🔹 증빙자료 없을 때 클릭 시 안내
  const handleNoImageAlert = () => {
    Swal.fire("이미지 없음", "등록된 증빙자료가 없습니다.", "warning");
  };

  // ============================================================
  // ✅ 떠있는 창(윈도우) 미리보기: 뒤 테이블 입력 가능
  // ============================================================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerNodeRef = useRef(null);

  // ✅ 테이블에 있는 영수증 이미지 목록(순서대로)
  const imageItems = useMemo(() => {
    return (rows || [])
      .filter((r) => !!r?.receipt_image)
      .map((r) => ({
        path: r.receipt_image,
        src: buildFileUrl(r.receipt_image),
        title: `${r.name || ""} ${r.saleDate || ""}`.trim(),
      }));
  }, [rows, buildFileUrl]);

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

  // ============================================================
  // ✅ 저장: 수정된 행만 /Account/AccountPurchaseDetailSave 로 전송
  //    - qty/unitPrice/amount는 콤마 제거해서 전송
  // ============================================================
  const SAVE_KEYS = useMemo(
    () => [
      "saleDate",
      "name",
      "itemType",
      "qty",
      "unitPrice",
      "amount",
      "taxType",
      "receipt_image",
      "note",
    ],
    []
  );

  const isRowChanged = useCallback(
    (orig, cur) => {
      return SAVE_KEYS.some((k) => {
        const a = orig?.[k];
        const b = cur?.[k];

        // ✅ 숫자 컬럼은 콤마 제외 비교
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

      delete next.account_name;

      // ✅ item_id 반드시 포함(조회 row에 있으면 그대로)
      if (!next.item_id) next.item_id = r?.item_id;

      MONEY_KEYS.forEach((k) => {
        const raw = stripComma(next[k]);
        next[k] = raw === "" ? 0 : raw;
      });

      if (!next.account_id) next.account_id = filters.account_id;

      next.user_id = next.user_id || user_id;
      next.type = next.type || filters.type;
      next.payType = next.payType || filters.payType;

      return next;
    },
    [filters, MONEY_KEYS, stripComma]
  );

  const handleSave = useCallback(async () => {
    try {
      const modified = (rows || [])
        .map((r, idx) => {
          const o = originalRows?.[idx];
          if (!o) return null;
          return isRowChanged(o, r) ? buildRowForSave(r) : null;
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

      const res = await api.post("/Account/AccountPurchaseDetailSave", modified, {
        headers: { "Content-Type": "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      // ✅ 성공 판정(프로젝트에서 code=200 패턴/HTTP 200 둘 다 대응)
      const ok = res?.status === 200 || res?.data?.code === 200;
      if (!ok) {
        return Swal.fire("실패", res?.data?.message || "저장에 실패했습니다.", "error");
      }

      Swal.fire("성공", "저장되었습니다.", "success");
      // ✅ 저장 후 재조회해서 originalRows/rows 동기화
      await fetchPurchaseList(filters);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "저장 중 오류가 발생했습니다.", "error");
    }
  }, [rows, originalRows, isRowChanged, buildRowForSave, fetchPurchaseList, filters]);

  // =========================
  // ✅ (NEW) 거래처 Autocomplete 값 만들기
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

  // ✅ 거래처 선택 변경 시: account_id 반영 + 자동조회(기존 동작 유지)
  const handleAccountChange = useCallback(
    (_, opt) => {
      const nextId = opt ? opt.value : "";
      setFilters((prev) => {
        const next = { ...prev, account_id: nextId };
        if (nextId) fetchPurchaseList(next);
        return next;
      });
    },
    [fetchPurchaseList]
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
    <>
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
          <option value="1">위탁급식</option>
          <option value="2">도소매</option>
          <option value="3">프랜차이즈</option>
          <option value="4">산업체</option>
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

        {/* 🔹 거래처(사업장) "검색 가능한" Autocomplete */}
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
          sx={{
            minWidth: isMobile ? 90 : 100,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          조회
        </MDButton>

        {/* ✅ 저장 버튼 추가 */}
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{
            minWidth: isMobile ? 90 : 100,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          저장
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          sx={{
            minWidth: isMobile ? 90 : 110,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          엑셀다운로드
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          sx={{
            minWidth: isMobile ? 70 : 90,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          인쇄
        </MDButton>
      </MDBox>

      {/* 🔹 테이블 */}
      <MDBox pt={0} pb={2} sx={tableSx}>
        {/* ✅ (NEW) 첨부 이미지처럼 타이틀바 + 우측 버튼 */}
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
                {/* ✅ 1줄: 그룹 헤더 */}
                <tr>
                  <th rowSpan={2} style={{ minWidth: 120 }}>
                    사업장
                  </th>
                  <th rowSpan={2} style={{ minWidth: 100 }}>
                    날짜
                  </th>
                  <th rowSpan={2} style={{ minWidth: 160 }}>
                    구매처
                  </th>

                  <th colSpan={4} style={{ minWidth: 360 }}>
                    소모품
                  </th>
                  <th colSpan={4} style={{ minWidth: 360 }}>
                    식자재
                  </th>

                  <th colSpan={1} style={{ minWidth: 160 }}>
                    기타
                  </th>
                  <th rowSpan={2} style={{ minWidth: 110 }}>
                    이체일
                  </th>
                </tr>

                {/* ✅ 2줄: 상세 헤더 */}
                <tr>
                  {/* 소모품 */}
                  <th style={{ minWidth: 90 }}>과세</th>
                  <th style={{ minWidth: 90 }}>부가세</th>
                  <th style={{ minWidth: 90 }}>면세</th>
                  <th style={{ minWidth: 90 }}>합계</th>

                  {/* 식자재 */}
                  <th style={{ minWidth: 90 }}>과세</th>
                  <th style={{ minWidth: 90 }}>부가세</th>
                  <th style={{ minWidth: 90 }}>면세</th>
                  <th style={{ minWidth: 90 }}>합계</th>

                  {/* 기타 */}
                  <th style={{ minWidth: 160 }}>증빙자료 사진▼</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: "center", padding: "12px" }}>
                      데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key] ?? "";

                        // ✅ 증빙자료사진: 다운로드 + 미리보기
                        if (key === "receipt_image") {
                          const hasImage = !!value;
                          return (
                            <td
                              key={key}
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: `${col.size}px`,
                              }}
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

                        // ✅ 날짜/이체일 같은 date는 input date로 바꾸고 싶으면 여기서 분기 가능
                        // if (key === "saleDate" || key === "transfer_dt") { ... }

                        // ✅ 기본 셀: 수정 가능 + 금액은 콤마 유지
                        return (
                          <td
                            key={key}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const text = e.currentTarget.innerText;

                              if (MONEY_KEYS.includes(key)) {
                                const formatted = formatComma(text);
                                handleCellChange(rowIndex, key, formatted);
                                e.currentTarget.innerText = formatted;
                                return;
                              }

                              handleCellChange(rowIndex, key, text);
                            }}
                            style={{
                              ...getCellStyle(rowIndex, key, value),
                              width: `${col.size}px`,
                            }}
                          >
                            {MONEY_KEYS.includes(key) ? formatComma(value) : value}
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
                              onError={() => {
                                Swal.fire(
                                  "미리보기 실패",
                                  "이미지 경로 또는 서버 응답을 확인해주세요.",
                                  "error"
                                );
                              }}
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
    </>
  );
}

export default AccountPurchaseTallyTab;
