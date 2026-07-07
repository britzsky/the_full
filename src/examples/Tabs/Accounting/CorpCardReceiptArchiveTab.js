// =====================================================================
// 영수증 마감 자료(본사 법인카드) 탭
// - 전체 거래처 본사 법인카드 영수증을 1회 API 호출로 조회
// - receipt_type(영수증 타입)별로 그룹화하여 표시
// - 필터 영역은 스크롤 시 탭 바 아래에 고정 (top: 111)
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
import { fetchAccountListByName } from "api/accountQueryApi";
import useCorpCardReceiptArchiveData, {
  buildCorpCardFilePreviewUrl,
  isCorpCardPdfFile,
  CORP_CARD_RECEIPT_TYPES,
  RECEIPT_TYPE_LABEL_MAP,
} from "./CorpCardReceiptArchiveTabData";

// =====================================================================
// 상수 / 유틸
// =====================================================================

const getYearOptions = () => {
  const cur = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => String(cur - 3 + i));
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

const CONTROL_HEIGHT = 40;

const SELECT_SX = {
  height: CONTROL_HEIGHT,
  "& .MuiSelect-select": {
    height: CONTROL_HEIGHT,
    minHeight: `${CONTROL_HEIGHT}px !important`,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  },
};

const RECEIPT_TYPE_COLORS = {
  coupang: "#f87c4f",
  gmarket: "#4f7ef8",
  "11post": "#e74c3c",
  naver: "#2ecc71",
  homeplus: "#3498db",
  auction: "#9b59b6",
  daiso: "#e67e22",
  MART_ITEMIZED: "#1abc9c",
  CONVENIENCE: "#34495e",
};
const FALLBACK_COLOR = "#9ca3af";

const sanitizeFileName = (name) =>
  String(name || "receipt").replace(/[\\/:*?"<>|]/g, "_").trim() || "receipt";

const getUniqueFileName = (fileName, usedMap) => {
  const safe = sanitizeFileName(fileName);
  const count = usedMap.get(safe) || 0;
  usedMap.set(safe, count + 1);
  if (count === 0) return safe;
  const dot = safe.lastIndexOf(".");
  if (dot <= 0) return `${safe} (${count + 1})`;
  return `${safe.slice(0, dot)} (${count + 1})${safe.slice(dot)}`;
};

// =====================================================================
// 메인 컴포넌트
// =====================================================================
function CorpCardReceiptArchiveTab() {
  const now = new Date();
  const { rows, loading, fetchRows } = useCorpCardReceiptArchiveData();

  const [filters, setFilters] = useState({
    accountId: "",
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    receiptType: "0",
  });

  const [accountOptions, setAccountOptions] = useState([]);
  const [selectedAccountOption, setSelectedAccountOption] = useState({ value: "", label: "전체" });
  const [accountInput, setAccountInput] = useState("전체");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFiles, setViewerFiles] = useState([]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  useEffect(() => {
    let cancelled = false;
    fetchAccountListByName({
      useV2: true,
      params: { del_yn: "ALL" },
    })
      .then((list) => {
        if (!cancelled) setAccountOptions(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        console.error("거래처 목록 조회 실패:", error);
        if (!cancelled) setAccountOptions([]);
      });
    return () => { cancelled = true; };
  }, []);

  // 필터 변경 시 자동 재조회
  useEffect(() => {
    fetchRows(filters);
  }, [fetchRows, filters.accountId, filters.year, filters.month, filters.receiptType]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // 거래처 Autocomplete 옵션 목록
  const accountAutocompleteOptions = useMemo(() => {
    const list = accountOptions.map((acc) => ({
      value: acc.account_id,
      label: acc.account_name || acc.name || acc.account_id,
    }));
    list.sort((a, b) => String(a.label).localeCompare(String(b.label), "ko"));
    return [{ value: "", label: "전체" }, ...list];
  }, [accountOptions]);

  const handleAccountChange = (_, option) => {
    const next = option || { value: "", label: "전체" };
    setSelectedAccountOption(next);
    setAccountInput(next.label);
    setFilters((prev) => ({ ...prev, accountId: next.value }));
  };

  // receipt_image 있는 항목 → previewUrl 추가
  const receiptItems = useMemo(
    () =>
      rows
        .filter((row) => row.receipt_image)
        .map((row) => ({
          ...row,
          previewUrl: buildCorpCardFilePreviewUrl(row.receipt_image),
          kind: isCorpCardPdfFile(row.receipt_image) ? "pdf" : "image",
        })),
    [rows]
  );

  const downloadableItems = useMemo(
    () => receiptItems.filter((item) => item.kind === "image" && item.previewUrl),
    [receiptItems]
  );

  // receipt_type별 그룹화
  const groupedItems = useMemo(() => {
    const map = new Map();
    receiptItems.forEach((item) => {
      const key = item.receipt_type || "UNKNOWN";
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: RECEIPT_TYPE_LABEL_MAP[key] || key,
          color: RECEIPT_TYPE_COLORS[key] || FALLBACK_COLOR,
          items: [],
        });
      }
      map.get(key).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) =>
      filters.receiptType === "0"
        ? b.items.length - a.items.length
        : String(a.label).localeCompare(String(b.label), "ko")
    );
  }, [receiptItems, filters.receiptType]);

  const handleOpenViewer = (targetItem) => {
    const files = receiptItems.map((item) => ({
      path: item.receipt_image,
      url: item.previewUrl,
      name: `${item.account_name || ""} ${item.use_name || ""} ${item.saleDate || ""}`.trim(),
      kind: item.kind,
    }));
    const idx = receiptItems.findIndex((item) => item.sale_id === targetItem.sale_id);
    setViewerFiles(files);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  const fetchBlob = async (item) => {
    const res = await fetch(item.previewUrl, { credentials: "include" });
    if (!res.ok) throw new Error("영수증 파일을 불러오지 못했습니다.");
    return res.blob();
  };

  const downloadItem = (item) => {
    const a = document.createElement("a");
    a.href = item.previewUrl;
    a.rel = "noopener noreferrer";
    a.download = sanitizeFileName(item.receipt_image?.split("/").pop());
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = async () => {
    if (!downloadableItems.length) return;

    const defaultName = `영수증_${filters.year}${String(filters.month).padStart(2, "0")}.zip`;

    // user activation이 살아있는 동안 먼저 저장 위치 선택
    let fileHandle = null;
    if (Boolean(window.isSecureContext && window.showSaveFilePicker)) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: "ZIP 파일", accept: { "application/zip": [".zip"] } }],
        });
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const total = downloadableItems.length;
    let done = 0;

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

    for (let i = 0; i < downloadableItems.length; i += CONCURRENCY) {
      const chunk = downloadableItems.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          const blob = await fetchBlob(item);
          done += 1;
          Swal.update({ text: `${done} / ${total} 처리 중...` });
          return { item, blob };
        })
      );
      results.push(...chunkResults);
    }

    const usedMap = new Map();
    let addedCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { item, blob } = result.value;
        const fileName = getUniqueFileName(
          sanitizeFileName(item.receipt_image?.split("/").pop() || "receipt"),
          usedMap
        );
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
    Swal.close();

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
        Swal.fire("완료", "영수증 이미지 저장이 완료되었습니다.", "success");
        return;
      } catch (error) {
        console.error("zip 파일 저장 실패:", error);
      }
    }

    const objectUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
    Swal.fire("완료", "영수증 이미지 다운로드를 시작했습니다.", "success");
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
          {/* 조회 건수 */}
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

          {/* 연도 */}
          <Grid item xs={6} md={1.2}>
            <FormControl fullWidth size="small">
              <InputLabel>연도</InputLabel>
              <Select name="year" label="연도" value={filters.year} onChange={handleFilterChange} sx={SELECT_SX}>
                {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* 월 */}
          <Grid item xs={6} md={1}>
            <FormControl fullWidth size="small">
              <InputLabel>월</InputLabel>
              <Select name="month" label="월" value={filters.month} onChange={handleFilterChange} sx={SELECT_SX}>
                {MONTH_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m}월</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* 영수증 타입 */}
          <Grid item xs={12} md={1.4}>
            <FormControl fullWidth size="small">
              <InputLabel>영수증 타입</InputLabel>
              <Select name="receiptType" label="영수증 타입" value={filters.receiptType} onChange={handleFilterChange} sx={SELECT_SX}>
                <MenuItem value="0">전체</MenuItem>
                {CORP_CARD_RECEIPT_TYPES.map((rt) => (
                  <MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 거래처 */}
          <Grid item xs={12} md={1.8}>
            <Autocomplete
              size="small"
              options={accountAutocompleteOptions}
              value={selectedAccountOption}
              inputValue={accountInput}
              onInputChange={(_, value) => setAccountInput(value)}
              onChange={handleAccountChange}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.label || option?.value || ""
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              renderInput={(params) => <TextField {...params} label="거래처 검색" />}
              sx={{
                "& .MuiInputBase-root": { height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT, alignItems: "center" },
                "& .MuiInputBase-input": { height: "auto", py: 0 },
              }}
            />
          </Grid>

          {/* 버튼 */}
          <Grid item xs={12} md="auto">
            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" }, gap: 0.8 }}>
              <MDButton
                size="small"
                color="success"
                onClick={handleDownloadAll}
                disabled={!downloadableItems.length}
                sx={{
                  width: 190, height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT,
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
                onClick={() => fetchRows(filters)}
                sx={{ width: 72, height: CONTROL_HEIGHT, minHeight: CONTROL_HEIGHT }}
              >
                조회
              </MDButton>
            </Box>
          </Grid>
        </Grid>
      </MDBox>

      {/* 영수증 타입별 그룹 목록 — 스크롤 영역 */}
      <MDBox sx={{ flex: 1, overflowY: "auto", pb: 3 }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {groupedItems.length === 0 ? (
            <MDBox sx={{ p: 4, border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#fff", textAlign: "center", fontSize: 13, color: "#9ca3af", boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)" }}>
              <ReceiptLongIcon sx={{ fontSize: 36, color: "#d1d5db", mb: 1, display: "block", mx: "auto" }} />
              조회된 영수증 자료가 없습니다.
            </MDBox>
          ) : (
            groupedItems.map((group) => (
              <MDBox key={group.value}>
                <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 1, backgroundColor: group.color, flexShrink: 0 }} />
                  <Box sx={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{group.label}</Box>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: "#fff", backgroundColor: group.color, borderRadius: 10, px: 0.9, pt: 0.3, pb: 0.05, lineHeight: 1.5 }}>
                    {group.items.length.toLocaleString("ko-KR")}
                  </Box>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                  {group.items.map((item) => (
                    <Box
                      key={item.sale_id}
                      sx={{
                        border: "1px solid #e5e7eb",
                        borderLeft: `3px solid ${group.color}`,
                        borderRadius: 2,
                        backgroundColor: "#fff",
                        px: 1.5, py: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        flexWrap: { xs: "wrap", sm: "nowrap" },
                        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
                        "&:hover": { boxShadow: "0 2px 8px 0 rgba(0,0,0,0.10)" },
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0, flex: 1,
                          display: "grid",
                          gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "1.4fr 1.2fr 1fr 0.8fr 0.8fr" },
                          gap: 1, alignItems: "center",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ fontSize: 10, color: "#9ca3af", mb: 0.2 }}>요양원</Box>
                          <Box sx={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.account_name || "-"}</Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ fontSize: 10, color: "#9ca3af", mb: 0.2 }}>사용처</Box>
                          <Box sx={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.use_name || "-"}</Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ fontSize: 10, color: "#9ca3af", mb: 0.2 }}>날짜</Box>
                          <Box sx={{ fontSize: 12, color: "#374151" }}>
                            {dayjs(item.saleDate).isValid() ? dayjs(item.saleDate).format("YYYY-MM-DD") : item.saleDate || "-"}
                          </Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ fontSize: 10, color: "#9ca3af", mb: 0.2 }}>금액</Box>
                          <Box sx={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.total ? `${item.total}원` : "-"}</Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ fontSize: 10, color: "#9ca3af", mb: 0.2 }}>영수증 타입</Box>
                          <Box sx={{ display: "inline-block", px: 0.8, py: 0.15, borderRadius: 1, fontSize: 11, fontWeight: 600, color: "#fff", backgroundColor: group.color }}>
                            {group.label}
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                        {item.previewUrl && (
                          <>
                            <Tooltip title="미리보기">
                              <IconButton size="small" onClick={() => handleOpenViewer(item)} sx={{ color: "#6b7280", "&:hover": { color: "#0891b2" } }}>
                                <ImageSearchIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="다운로드">
                              <IconButton size="small" onClick={() => downloadItem(item)} sx={{ color: "#6b7280", "&:hover": { color: "#059669" } }}>
                                <DownloadIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </MDBox>
            ))
          )}
        </MDBox>
      </MDBox>

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

export default CorpCardReceiptArchiveTab;
