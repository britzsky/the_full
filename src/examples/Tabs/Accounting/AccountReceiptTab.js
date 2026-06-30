// =====================================================================
// 거래처 마감 자료 탭
// - 전체 거래처의 영수증 자료를 타입별로 조회하는 탭
// - 데이터 훅은 AccountReceiptTabData.js에서 import
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import Swal from "sweetalert2";
import {
  Autocomplete,
  Box,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import PreviewOverlay from "utils/PreviewOverlay";
import api from "api/api";
import { API_BASE_URL } from "config";
import useAccountReceiptTabData, {
  buildFilePreviewUrl,
  getReceiptImagePaths,
  isPdfFile,
  SAMSUNG_WELSTORY_TYPE_GROUP_VALUE,
  SAMSUNG_WELSTORY_TYPE_VALUES,
} from "./AccountReceiptTabData";

// 타입 필터에서 숨길 타입 코드 집합 (법인카드·현금 타입 제외)
const HIDDEN_TYPE_FILTER_VALUES = new Set(["1000", "1008"]);

// =====================================================================
// 화면 표시용 유틸리티
// =====================================================================

// 연도 선택 옵션 (현재 기준 전후 3년)
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
};

// 월 선택 옵션 (1~12월)
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));

// 조회 컨트롤 공통 높이
const CONTROL_HEIGHT = 40;

// 타입별 배지 색상 팔레트
const TYPE_BADGE_COLORS = [
  "#4f7ef8", "#f87c4f", "#4fc98d", "#c94f8a", "#8a4fc9",
  "#4fc9c9", "#c9a84f", "#4f8ac9", "#c94f4f", "#7ac94f",
];

// 타입 값에 따른 배지 색상 결정
const getTypeBadgeColor = (typeValue) => {
  if (!typeValue || typeValue === "UNKNOWN") return "#9ca3af";
  const num = parseInt(typeValue, 10);
  if (Number.isFinite(num)) return TYPE_BADGE_COLORS[num % TYPE_BADGE_COLORS.length];
  let hash = 0;
  for (let i = 0; i < typeValue.length; i += 1) hash = typeValue.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_BADGE_COLORS[Math.abs(hash) % TYPE_BADGE_COLORS.length];
};

// 다운로드 파일명에서 특수문자 제거
const sanitizeDownloadFileName = (fileName) => {
  const safeName = String(fileName || "receipt").replace(/[\\/:*?"<>|]/g, "_").trim();
  return safeName || "receipt";
};

// 영수증 아이템 기본 다운로드 파일명 생성
const getReceiptDownloadFileName = (item) => {
  const rawName = String(item?.path || "receipt").split("/").pop() || "receipt";
  return sanitizeDownloadFileName(rawName);
};

// 중복 파일명 처리 (번호 접미사 부여)
const getUniqueDownloadFileName = (fileName, usedFileNameMap) => {
  const safeName = sanitizeDownloadFileName(fileName);
  const usedCount = usedFileNameMap.get(safeName) || 0;
  usedFileNameMap.set(safeName, usedCount + 1);
  if (usedCount === 0) return safeName;
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex <= 0) return `${safeName} (${usedCount + 1})`;
  return `${safeName.slice(0, dotIndex)} (${usedCount + 1})${safeName.slice(dotIndex)}`;
};

// =====================================================================
// 메인 컴포넌트
// =====================================================================
function AccountReceiptTab() {
  const now = new Date();
  const { rows, loading, fetchReceiptRows } = useAccountReceiptTabData();

  // 조회 필터 상태 (연도·월·타입·결제유형)
  const [filters, setFilters] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    accountId: "0",
    type: "0",
    payType: "0",
  });

  // 파일 미리보기 오버레이 상태
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFiles, setViewerFiles] = useState([]);

  // 타입 필터 옵션 전용 목록 (전체 타입 조회 결과)
  const [typeOptionRows, setTypeOptionRows] = useState([]);
  const [accountInput, setAccountInput] = useState("");
  const [accountOptionRows, setAccountOptionRows] = useState([]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  // Select 공통 스타일 (고정 높이)
  const selectSx = useMemo(
    () => ({
      height: CONTROL_HEIGHT,
      "& .MuiSelect-select": {
        height: CONTROL_HEIGHT,
        minHeight: `${CONTROL_HEIGHT}px !important`,
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
      },
    }),
    []
  );

  // 필터 변경 시 영수증 목록 재조회
  useEffect(() => {
    fetchReceiptRows(filters);
  }, [fetchReceiptRows, filters.accountId, filters.month, filters.payType, filters.type, filters.year]);

  // 타입 드롭다운 옵션용 전체 목록 별도 조회 (타입 변경해도 드롭다운 옵션은 유지)
  useEffect(() => {
    let cancelled = false;
    fetchReceiptRows({ ...filters, type: "0" }, { updateRows: false, silent: true }).then((nextRows) => {
      if (!cancelled) setTypeOptionRows(nextRows);
    });
    return () => { cancelled = true; };
  }, [fetchReceiptRows, filters.accountId, filters.month, filters.payType, filters.year]);

  useEffect(() => {
    let cancelled = false;
    fetchReceiptRows(
      { ...filters, accountId: "0", type: "0" },
      { updateRows: false, silent: true }
    ).then((nextRows) => {
      if (!cancelled) setAccountOptionRows(nextRows);
    });
    return () => { cancelled = true; };
  }, [fetchReceiptRows, filters.month, filters.payType, filters.year]);

  // 타입 선택 옵션 목록 생성 (숨김 코드 제외, 삼성웰스토리 그룹화)
  const typeOptions = useMemo(() => {
    const map = new Map();
    typeOptionRows.forEach((row) => {
      const value = String(row.type ?? "").trim();
      if (HIDDEN_TYPE_FILTER_VALUES.has(value)) return;
      if (!value || map.has(value)) return;
      if (SAMSUNG_WELSTORY_TYPE_VALUES.has(value)) {
        map.set(SAMSUNG_WELSTORY_TYPE_GROUP_VALUE, "삼성웰스토리");
        return;
      }
      map.set(value, row.type_name || value);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => {
        if (a.value === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE) return -1;
        if (b.value === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE) return 1;
        return Number(a.value) - Number(b.value);
      });
  }, [typeOptionRows]);

  // 전체 타입 포함 옵션 (드롭다운 최상단에 "전체 타입" 추가)
  const typeFilterOptions = useMemo(
    () => [{ value: "0", label: "전체 타입" }, ...typeOptions],
    [typeOptions]
  );

  const accountOptions = useMemo(() => {
    const map = new Map();
    accountOptionRows.forEach((row) => {
      const value = String(row.account_id ?? "").trim();
      const label = String(row.account_name ?? "").trim();
      if (!value || !label || map.has(value)) return;
      map.set(value, { value, label });
    });
    return [{ value: "0", label: "전체 거래처" }, ...Array.from(map.values())];
  }, [accountOptionRows]);

  const selectedAccountOption = useMemo(
    () =>
      accountOptions.find((opt) => opt.value === String(filters.accountId ?? "0")) || {
        value: "0",
        label: "전체 거래처",
      },
    [accountOptions, filters.accountId]
  );

  useEffect(() => {
    setAccountInput(selectedAccountOption?.label || "");
  }, [selectedAccountOption]);

  // 현재 선택된 타입 옵션 객체
  const selectedTypeOption = useMemo(
    () =>
      typeFilterOptions.find((opt) => opt.value === filters.type) || {
        value: filters.type,
        label: filters.type || "전체 타입",
      },
    [filters.type, typeFilterOptions]
  );

  // 1000·1008 타입 제외 + 행 × 이미지 경로 평탄화 처리
  const receiptItems = useMemo(() => {
    return rows
      .filter((row) => !HIDDEN_TYPE_FILTER_VALUES.has(String(row.type ?? "").trim()))
      .flatMap((row) =>
        getReceiptImagePaths(row).map((path, index) => ({
          ...row,
          path,
          imageIndex: index,
          previewUrl: buildFilePreviewUrl(path),
          kind: isPdfFile(path) ? "pdf" : "image",
        }))
      );
  }, [rows]);

  // 전체 다운로드 대상 — 현재 타입 필터 기준, PDF 포함
  const downloadableImageItems = useMemo(() => {
    const selectedType = String(filters.type ?? "0");
    let base;
    if (selectedType === "0") {
      base = receiptItems;
    } else if (selectedType === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE) {
      base = receiptItems.filter((item) => SAMSUNG_WELSTORY_TYPE_VALUES.has(String(item.type ?? "")));
    } else {
      base = receiptItems.filter((item) => String(item.type ?? "") === selectedType);
    }
    return base.filter((item) => item.previewUrl);
  }, [receiptItems, filters.type]);

  // 타입별 그룹화 처리
  const groupedReceiptItems = useMemo(() => {
    const map = new Map();
    receiptItems.forEach((item) => {
      const typeValue = String(item.type ?? "");
      const key = SAMSUNG_WELSTORY_TYPE_VALUES.has(typeValue)
        ? SAMSUNG_WELSTORY_TYPE_GROUP_VALUE
        : typeValue || "UNKNOWN";
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label:
            key === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE ? "삼성웰스토리" : item.type_name || key,
          items: [],
        });
      }
      map.get(key).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) =>
      filters.type === "0"
        ? b.items.length - a.items.length
        : String(a.label).localeCompare(String(b.label), "ko")
    );
  }, [receiptItems, filters.type]);

  // 필터 값 변경 핸들러 (Select용)
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // 타입 Autocomplete 변경 핸들러
  const handleTypeChange = (_, option) => {
    const nextValue = typeof option === "string" ? option : option?.value ?? "0";
    setFilters((prev) => ({ ...prev, type: nextValue || "0" }));
  };

  const handleAccountChange = (_, option) => {
    const nextValue = typeof option === "string" ? option : option?.value ?? "0";
    setFilters((prev) => ({ ...prev, accountId: nextValue || "0" }));
    setAccountInput(option?.label || "");
  };

  // 미리보기 오버레이 열기 (클릭한 아이템 기준 인덱스 계산)
  const handleOpenViewer = (targetItem) => {
    const files = receiptItems.map((item) => ({
      path: item.path,
      url: item.previewUrl,
      name: `${item.account_name || ""} ${item.use_name || ""} ${item.saleDate || ""} (${item.imageIndex + 1})`.trim(),
      kind: item.kind,
    }));
    const nextIndex = receiptItems.findIndex(
      (item) => item.sale_id === targetItem.sale_id && item.path === targetItem.path
    );
    setViewerFiles(files);
    setViewerIndex(nextIndex >= 0 ? nextIndex : 0);
    setViewerOpen(true);
  };

  // 영수증 파일 Blob 다운로드 — 경로 인코딩 후 정적 URL로 시도, 실패 시 AccountStoredFileView로 재시도
  const fetchReceiptBlob = async (item) => {
    const rawPath = String(item.path || "").trim();
    const encodedPath = rawPath.split("/").map((seg) => (seg ? encodeURIComponent(seg) : "")).join("/");
    const normalizedPath = encodedPath.startsWith("/") ? encodedPath : `/${encodedPath}`;
    const staticUrl = `${API_BASE_URL}${normalizedPath}`;

    try {
      const res = await api.get(staticUrl, { responseType: "blob" });
      const blob = res?.data;
      if (blob instanceof Blob && blob.size > 0) return blob;
    } catch {
      // 정적 URL 실패 시 AccountStoredFileView로 재시도
    }

    const res2 = await api.get(item.previewUrl, { responseType: "blob", withCredentials: true });
    const blob2 = res2?.data;
    if (!(blob2 instanceof Blob) || blob2.size === 0) throw new Error("영수증 파일을 불러오지 못했습니다.");
    return blob2;
  };

  const triggerBrowserDownload = (url, fileName) => {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 브라우저 기본 다운로드 실행 (fallback)
  const downloadReceiptFile = async (item) => {
    const fileName = getReceiptDownloadFileName(item);
    try {
      const blob = await fetchReceiptBlob(item);
      const objectUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(objectUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("영수증 파일 다운로드 실패:", error);
      triggerBrowserDownload(item.previewUrl, fileName);
    }
  };

  // File System Access API 활용 단일 파일 저장 (미지원 시 기본 다운로드 폴백)
  const saveReceiptFile = async (item) => {
    if (!item?.previewUrl) return;
    try {
      const blob = await fetchReceiptBlob(item);
      const fileName = getReceiptDownloadFileName(item);

      if (window.showDirectoryPicker) {
        const dirHandle = await window.showDirectoryPicker();
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }

      if (!window.showSaveFilePicker) {
        await downloadReceiptFile(item);
        return;
      }

      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("영수증 파일 저장 실패:", error);
      alert("영수증 파일 저장에 실패했습니다. 브라우저 기본 다운로드로 다시 시도합니다.");
      await downloadReceiptFile(item);
    }
  };

  // 단일 영수증 다운로드 핸들러
  const handleDownload = (item) => saveReceiptFile(item);

  // 이미지 전체를 zip으로 묶어 저장 경로 지정 후 다운로드
  const handleDownloadAll = async () => {
    if (downloadableImageItems.length === 0) return;

    const total = downloadableImageItems.length;
    let done = 0;

    const updateProgress = () => {
      done += 1;
      Swal.update({ text: `${done} / ${total} 처리 중...` });
    };

    Swal.fire({
      title: "다운로드 중...",
      text: `0 / ${total} 처리 중...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const CONCURRENCY = 8;
    const zip = new JSZip();
    const results = [];

    for (let i = 0; i < downloadableImageItems.length; i += CONCURRENCY) {
      const chunk = downloadableImageItems.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          const blob = await fetchReceiptBlob(item);
          updateProgress();
          return { item, blob };
        })
      );
      results.push(...chunkResults);
    }

    const usedFileNameMap = new Map();
    let addedCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { item, blob } = result.value;
        const fileName = getUniqueDownloadFileName(getReceiptDownloadFileName(item), usedFileNameMap);
        zip.file(fileName, blob);
        addedCount += 1;
      } else {
        console.warn("영수증 이미지 추가 실패 (건너뜀):", result.reason);
      }
    }

    if (addedCount === 0) {
      Swal.fire("안내", "저장할 수 있는 이미지가 없습니다.", "info");
      return;
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const defaultName = `영수증_${filters.year}${String(filters.month).padStart(2, "0")}.zip`;

    if (window.showSaveFilePicker) {
      try {
        Swal.close();
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: "ZIP 파일", accept: { "application/zip": [".zip"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
        Swal.fire("완료", "영수증 이미지 저장이 완료되었습니다.", "success");
        return;
      } catch (error) {
        if (error?.name === "AbortError") { Swal.close(); return; }
        console.error("zip 저장 실패:", error);
      }
    }

    const objectUrl = URL.createObjectURL(zipBlob);
    triggerBrowserDownload(objectUrl, defaultName);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    Swal.fire("완료", "영수증 이미지 저장이 완료되었습니다.", "success");
  };

  return (
    <MDBox sx={{ position: "relative", display: "flex", flexDirection: "column", height: "calc(100vh - 143px)", overflow: "hidden" }}>
      {loading && (
        <MDBox sx={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: "white", overflow: "hidden" }}>
          <LoadingScreen />
        </MDBox>
      )}

        {/* 조회 조건 영역 */}
        <MDBox
          sx={{
            flexShrink: 0,
            mb: 2,
            p: 1.5,
            border: "1px solid #e5e7eb",
            borderRadius: 2,
            backgroundColor: "#fff",
            boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)",
          }}
        >
          <Grid container spacing={1.2} alignItems="center">
            {/* 조회 건수 표시 */}
            <Grid item xs={12} md>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <ReceiptLongIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                <Box sx={{ fontSize: 12, color: "#374151" }}>
                  영수증{" "}
                  <Box component="span" sx={{ fontWeight: 700, color: "#111827" }}>
                    {receiptItems.length.toLocaleString("ko-KR")}
                  </Box>
                  건
                </Box>
              </Box>
            </Grid>

            {/* 연도 선택 */}
            <Grid item xs={6} md={1.2}>
              <FormControl fullWidth size="small">
                <InputLabel>연도</InputLabel>
                <Select name="year" label="연도" value={filters.year} onChange={handleFilterChange} sx={selectSx}>
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year}>{year}년</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 월 선택 */}
            <Grid item xs={6} md={1}>
              <FormControl fullWidth size="small">
                <InputLabel>월</InputLabel>
                <Select name="month" label="월" value={filters.month} onChange={handleFilterChange} sx={selectSx}>
                  {MONTH_OPTIONS.map((month) => (
                    <MenuItem key={month} value={month}>{month}월</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 거래처 Autocomplete 선택 */}
            <Grid item xs={12} md={2.4}>
              <Autocomplete
                size="small"
                options={accountOptions}
                value={selectedAccountOption}
                inputValue={accountInput}
                onInputChange={(_, value) => setAccountInput(value)}
                onChange={handleAccountChange}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : option?.label || option?.value || ""
                }
                isOptionEqualToValue={(option, value) => option.value === value.value}
                disableClearable
                renderInput={(params) => <TextField {...params} label="거래처" />}
                sx={{
                  "& .MuiInputBase-root": { height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT, alignItems: "center" },
                  "& .MuiInputBase-input": { height: "auto", py: 0 },
                }}
              />
            </Grid>

            {/* 타입 Autocomplete 선택 */}
            <Grid item xs={12} md={2.2}>
              <Autocomplete
                size="small"
                options={typeFilterOptions}
                value={selectedTypeOption}
                onChange={handleTypeChange}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : option?.label || option?.value || ""
                }
                isOptionEqualToValue={(option, value) => option.value === value.value}
                renderInput={(params) => <TextField {...params} label="타입" />}
                sx={{
                  "& .MuiInputBase-root": { height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT, alignItems: "center" },
                  "& .MuiInputBase-input": { height: "auto", py: 0 },
                }}
              />
            </Grid>

            {/* 조회 버튼 영역 */}
            <Grid item xs={12} md="auto">
              <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" }, gap: 0.8 }}>
                <MDButton
                  size="small"
                  color="success"
                  onClick={handleDownloadAll}
                  disabled={downloadableImageItems.length === 0}
                  sx={{
                    width: 190,
                    height: CONTROL_HEIGHT,
                    minHeight: CONTROL_HEIGHT,
                    whiteSpace: "nowrap",
                    "& .MuiSvgIcon-root": { width: 20, height: 20, fontSize: "24px !important" },
                  }}
                >
                  <DownloadIcon sx={{ mr: 0.6 }} />
                  이미지 전체 다운로드
                </MDButton>
                <MDButton
                  size="small"
                  color="info"
                  onClick={() => fetchReceiptRows(filters)}
                  sx={{ width: 72, height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT }}
                >
                  조회
                </MDButton>
              </Box>
            </Grid>
          </Grid>
        </MDBox>

        {/* 타입별 영수증 목록 — 스크롤 영역 */}
        <MDBox sx={{ flex: 1, overflowY: "auto", pb: 3 }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {groupedReceiptItems.length === 0 ? (
            /* 데이터 없음 안내 */
            <MDBox
              sx={{
                p: 4,
                border: "1px solid #e5e7eb",
                borderRadius: 2,
                backgroundColor: "#fff",
                textAlign: "center",
                fontSize: 13,
                color: "#9ca3af",
                boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)",
              }}
            >
              <ReceiptLongIcon sx={{ fontSize: 36, color: "#d1d5db", mb: 1, display: "block", mx: "auto" }} />
              조회된 영수증 자료가 없습니다.
            </MDBox>
          ) : (
            groupedReceiptItems.map((group) => {
              const badgeColor = getTypeBadgeColor(group.value);
              return (
                <MDBox key={group.value}>
                  {/* 타입 그룹 헤더 */}
                  <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 4, height: 18, borderRadius: 1, backgroundColor: badgeColor, flexShrink: 0 }} />
                    <Box sx={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{group.label}</Box>
                    <Box
                      sx={{
                        fontSize: 11, fontWeight: 600, color: "#fff",
                        backgroundColor: badgeColor, borderRadius: 10,
                        px: 0.9, pt: 0.3, pb: 0.05, lineHeight: 1.5,
                      }}
                    >
                      {group.items.length.toLocaleString("ko-KR")}
                    </Box>
                  </Box>

                  {/* 영수증 카드 목록 */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                    {group.items.map((item) => (
                      <Box
                        key={`${item.sale_id}-${item.path}-${item.imageIndex}`}
                        sx={{
                          border: "1px solid #e5e7eb",
                          borderLeft: `3px solid ${badgeColor}`,
                          borderRadius: 2,
                          backgroundColor: "#fff",
                          px: 1.5, py: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          flexWrap: { xs: "wrap", sm: "nowrap" },
                          boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
                          transition: "box-shadow 0.15s",
                          "&:hover": { boxShadow: "0 2px 8px 0 rgba(0,0,0,0.10)" },
                        }}
                      >
                        {/* 영수증 정보 (요양원·사용처·날짜·금액) */}
                        <Box
                          sx={{
                            minWidth: 0, flex: 1,
                            display: "grid",
                            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "1.3fr 1.3fr 1fr 1fr" },
                            gap: 1, alignItems: "center",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3, mb: 0.2 }}>요양원</Box>
                            <Box sx={{ fontSize: 12, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
                              {item.account_name || "-"}
                            </Box>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3, mb: 0.2 }}>사용처</Box>
                            <Box sx={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{item.use_name || "-"}</Box>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3, mb: 0.2 }}>날짜</Box>
                            <Box sx={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                              {dayjs(item.saleDate).isValid()
                                ? dayjs(item.saleDate).format("YYYY-MM-DD")
                                : item.saleDate}
                            </Box>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3, mb: 0.2 }}>금액</Box>
                            <Box sx={{ fontSize: 12, fontWeight: 600, color: "#374151", lineHeight: 1.4 }}>
                              {item.total ? `${item.total}원` : "-"}
                            </Box>
                          </Box>
                        </Box>

                        {/* 다운로드·미리보기 버튼 */}
                        <Box
                          sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.3, flexShrink: 0, ml: "auto" }}
                        >
                          <Tooltip title="다운로드">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(item)}
                              sx={{ color: "#6b7280", "&:hover": { color: "#1d4ed8", backgroundColor: "#eff6ff" } }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="미리보기">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenViewer(item)}
                              sx={{ color: "#6b7280", "&:hover": { color: "#0891b2", backgroundColor: "#ecfeff" } }}
                            >
                              <ImageSearchIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </MDBox>
              );
            })
          )}
        </MDBox>
        </MDBox>

      {/* 파일 미리보기 오버레이 */}
      <PreviewOverlay
        open={viewerOpen}
        files={viewerFiles}
        currentIndex={viewerIndex}
        onChangeIndex={setViewerIndex}
        onClose={() => setViewerOpen(false)}
        anchorX={1 / 2}
      />
    </MDBox>
  );
}

export default AccountReceiptTab;
