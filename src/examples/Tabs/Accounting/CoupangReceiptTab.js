// =====================================================================
// 쿠팡 영수증 등록 탭
// - 거래처를 선택하고 카테고리별 쿠팡 영수증을 등록하는 탭
// - 파일 클릭 선택 및 드래그앤드롭 모두 지원
// - 영수증 OCR 파서가 날짜를 인식하면 집계표 해당 날짜에 자동 저장됨
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Autocomplete,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import PreviewOverlay from "utils/PreviewOverlay";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";
import { useCoupangAccountList, useHeadOfficeCardList } from "./CoupangReceiptTabData";

// =====================================================================
// 상수 정의
// =====================================================================

// 영수증 카테고리 (집계표 type 값과 동일하게 사용)
// 1002 = 기타(소모품), 1003 = 기타(식자재)
const RECEIPT_CATEGORIES = [
  { type: "1002", label: "기타(소모품)", color: "#4f7ef8" },
  { type: "1003", label: "기타(식자재)", color: "#f87c4f" },
];

// 영수증 타입 목록 (corporatecardsheet.js와 동일)
const RECEIPT_TYPES = [
  { value: "coupang",       label: "쿠팡" },
  { value: "gmarket",       label: "G마켓" },
  { value: "11post",        label: "11번가" },
  { value: "naver",         label: "네이버" },
  { value: "homeplus",      label: "홈플러스" },
  { value: "auction",       label: "옥션" },
  { value: "daiso",         label: "다이소" },
  { value: "MART_ITEMIZED", label: "마트" },
  { value: "CONVENIENCE",   label: "편의점" },
];

// 저장 API 엔드포인트 (집계표 corp card save와 동일하게 사용)
const SAVE_ENDPOINT = "/Corporate/receipt-scan";

// =====================================================================
// 유틸: 파일 유효성 검사
// =====================================================================
const isValidFile = (file) =>
  file && (file.type.startsWith("image/") || file.type === "application/pdf");

// =====================================================================
// 유틸: ZIP 다운로드 헬퍼
// =====================================================================
const sanitizeDownloadFileName = (fileName) => {
  const safeName = String(fileName || "receipt").replace(/[\\/:*?"<>|]/g, "_").trim();
  return safeName || "receipt";
};

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
// 카테고리별 드래그앤드롭 업로드 섹션 컴포넌트
// =====================================================================
function UploadSection({ category, files, previews, onFileAdd, onFileRemove, onPreview }) {
  // 드래그 중 상태 (드롭존 하이라이트용)
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 드래그 진입 시 하이라이트 표시
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // 드래그 영역 벗어날 때 하이라이트 해제
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // 파일 드롭 처리: 유효한 이미지·PDF 파일만 추가
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []).filter(isValidFile);
    if (droppedFiles.length) onFileAdd(category.type, droppedFiles);
  };

  // 파일 입력(클릭 선택) 처리
  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(isValidFile);
    if (selectedFiles.length) onFileAdd(category.type, selectedFiles);
    e.currentTarget.value = ""; // 같은 파일 재선택 가능하도록 초기화
  };

  return (
    <MDBox
      sx={{
        border: isDragging ? `2px dashed ${category.color}` : "1px solid #e5e7eb",
        borderLeft: `4px solid ${category.color}`,
        borderRadius: 2,
        backgroundColor: isDragging ? `${category.color}0d` : "#fff",
        boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "border-color 0.2s, background-color 0.2s",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 카테고리 헤더 */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: files.length > 0 ? "1px solid #f3f4f6" : "none",
          backgroundColor: "#fafafa",
        }}
      >
        {/* 카테고리명 + 파일 개수 배지 */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            {category.label}
          </Box>
          {files.length > 0 && (
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                backgroundColor: category.color,
                borderRadius: 10,
                px: 0.9,
                lineHeight: 1.8,
              }}
            >
              {files.length}
            </Box>
          )}
        </Box>

        {/* 파일 선택 버튼 */}
        <MDButton
          size="small"
          color="info"
          onClick={() => fileInputRef.current?.click()}
          sx={{ height: 32, fontSize: "0.72rem" }}
        >
          <AddPhotoAlternateIcon sx={{ fontSize: 16, mr: 0.5 }} />
          파일 추가
        </MDButton>

        {/* 숨겨진 파일 입력 (다중 선택 허용) */}
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleFileInputChange}
        />
      </Box>

      {/* 파일 목록 또는 드롭존 안내 */}
      {files.length > 0 ? (
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 0.6 }}>
          {files.map((file, idx) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.6,
                borderRadius: 1,
                border: "1px solid #f3f4f6",
                backgroundColor: "#f9fafb",
                "&:hover": { backgroundColor: "#f3f4f6" },
              }}
            >
              {/* 이미지 썸네일 (PDF는 표시 안 됨) */}
              {previews[idx] && !file.type.includes("pdf") && (
                <Box
                  component="img"
                  src={previews[idx]}
                  alt={file.name}
                  sx={{
                    width: 36,
                    height: 36,
                    objectFit: "cover",
                    borderRadius: 1,
                    flexShrink: 0,
                    border: "1px solid #e5e7eb",
                    cursor: "pointer",
                  }}
                  onClick={() => onPreview(category.type, idx)}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}

              {/* 파일명 */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: "#374151",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.name}
              </Box>

              {/* 파일 크기 */}
              <Box sx={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, mr: 0.5 }}>
                {(file.size / 1024).toFixed(0)}KB
              </Box>

              {/* 미리보기 버튼 */}
              <Tooltip title="미리보기">
                <IconButton
                  size="small"
                  onClick={() => onPreview(category.type, idx)}
                  sx={{ color: "#6b7280", "&:hover": { color: "#0891b2" } }}
                >
                  <ImageSearchIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              {/* 파일 제거 버튼 */}
              <Tooltip title="제거">
                <IconButton
                  size="small"
                  onClick={() => onFileRemove(category.type, idx)}
                  sx={{ color: "#6b7280", "&:hover": { color: "#dc2626" } }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      ) : (
        /* 파일 없을 때: 드래그앤드롭 안내 영역 */
        <Box
          sx={{
            px: 2,
            py: 2.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            color: isDragging ? category.color : "#9ca3af",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <CloudUploadIcon sx={{ fontSize: 28, opacity: 0.6 }} />
          <Box sx={{ fontSize: 12 }}>
            {isDragging ? "파일을 여기에 놓으세요" : "클릭하거나 파일을 드래그해서 업로드하세요"}
          </Box>
          <Box sx={{ fontSize: 11, opacity: 0.7 }}>이미지, PDF 파일 지원</Box>
        </Box>
      )}
    </MDBox>
  );
}

// UploadSection PropTypes 정의
UploadSection.propTypes = {
  category: PropTypes.shape({
    type: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
  }).isRequired,
  files: PropTypes.arrayOf(PropTypes.instanceOf(File)).isRequired,
  previews: PropTypes.arrayOf(PropTypes.string).isRequired,
  onFileAdd: PropTypes.func.isRequired,
  onFileRemove: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
};

// =====================================================================
// 메인 컴포넌트
// =====================================================================
function CoupangReceiptTab() {
  // localStorage에서 사용자·거래처 정보 로드
  const localUserId = useMemo(() => localStorage.getItem("user_id") || "", []);
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  // 현장 계정은 거래처가 고정됨
  const isAccountLocked = useMemo(() => !!localAccountId, [localAccountId]);

  // 거래처 목록 데이터 훅
  const { accountList, loadingAccounts, fetchAccountList } = useCoupangAccountList();
  // 본사 법인카드 목록 데이터 훅
  const { cardList, fetchCardList } = useHeadOfficeCardList();

  // 선택된 거래처 상태
  const [selectedAccountId, setSelectedAccountId] = useState(localAccountId || "");
  const [accountInput, setAccountInput] = useState("");
  // 선택된 카드 idx (드롭박스 선택값, 미선택 시 "")
  const [selectedCardIdx, setSelectedCardIdx] = useState("");
  // 선택된 영수증 타입 (미선택 시 "")
  const [selectedReceiptType, setSelectedReceiptType] = useState("");
  const [saving, setSaving] = useState(false);

  // OCR 날짜 미인식 영수증 수동 날짜 지정 모달 상태
  const [failedDateItems, setFailedDateItems] = useState([]); // 날짜 인식 실패 항목 목록
  const [dateRetryOpen, setDateRetryOpen] = useState(false);  // 모달 오픈 여부
  const [retryDate, setRetryDate] = useState("");             // 수동 지정 날짜
  const [retryLoading, setRetryLoading] = useState(false);    // 재등록 로딩 상태
  const [preRetrySuccessCount, setPreRetrySuccessCount] = useState(0); // 날짜 인식 성공 건수

  // 카테고리별 파일 상태: { [type]: File[] }
  const [categoryFiles, setCategoryFiles] = useState(
    Object.fromEntries(RECEIPT_CATEGORIES.map((c) => [c.type, []]))
  );
  // 카테고리별 미리보기 Blob URL: { [type]: string[] }
  const [categoryPreviews, setCategoryPreviews] = useState(
    Object.fromEntries(RECEIPT_CATEGORIES.map((c) => [c.type, []]))
  );

  // 미리보기 오버레이 상태
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFiles, setViewerFiles] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // 컴포넌트 언마운트 시 Blob URL 해제 (메모리 누수 방지)
  const previewsRef = useRef(categoryPreviews);
  useEffect(() => { previewsRef.current = categoryPreviews; }, [categoryPreviews]);
  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).flat().forEach((url) => {
        if (String(url || "").startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // 초기 거래처 목록 + 법인카드 목록 동시 조회
  useEffect(() => {
    (async () => {
      const [list, cards] = await Promise.all([fetchAccountList(), fetchCardList()]);

      if (localAccountId) {
        // 현장 계정: 고정 거래처 표시
        const matched = list.find((a) => String(a.account_id) === String(localAccountId));
        if (matched) setAccountInput(matched.account_name || "");
        setSelectedAccountId(localAccountId);
      } else if (list.length > 0) {
        // 일반 계정: 첫 번째 거래처 자동 선택
        setSelectedAccountId(String(list[0].account_id));
        setAccountInput(list[0].account_name || "");
      }

      // 카드 목록 로드 후 자동 선택 없음 — 사용자가 직접 선택
    })();
  }, [localAccountId, fetchAccountList, fetchCardList]);

  // 현재 선택된 거래처 옵션 객체
  const selectedAccountOption = useMemo(
    () => (accountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) || null,
    [accountList, selectedAccountId]
  );

  // 거래처 엔터 선택 핸들러 (tallysheet 동일 방식)
  const selectAccountByInput = useCallback(() => {
    if (isAccountLocked) return;
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountList || [];
    const qLower = q.toLowerCase();
    const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
    const partial = exact || list.find((a) => String(a?.account_name || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountId(String(partial.account_id));
      setAccountInput(partial.account_name || q);
    }
  }, [isAccountLocked, accountInput, accountList]);

  // =====================================================================
  // 파일 추가 핸들러 (클릭 선택 및 드래그앤드롭 공통)
  // =====================================================================
  const handleFileAdd = useCallback((type, newFiles) => {
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setCategoryFiles((prev) => ({ ...prev, [type]: [...(prev[type] || []), ...newFiles] }));
    setCategoryPreviews((prev) => ({ ...prev, [type]: [...(prev[type] || []), ...newPreviews] }));
  }, []);

  // =====================================================================
  // 파일 개별 제거 핸들러
  // =====================================================================
  const handleFileRemove = useCallback((type, index) => {
    setCategoryFiles((prev) => {
      const next = [...(prev[type] || [])];
      next.splice(index, 1);
      return { ...prev, [type]: next };
    });
    setCategoryPreviews((prev) => {
      const next = [...(prev[type] || [])];
      const [removed] = next.splice(index, 1);
      // 제거된 Blob URL 즉시 해제
      if (removed && String(removed).startsWith("blob:")) URL.revokeObjectURL(removed);
      return { ...prev, [type]: next };
    });
  }, []);

  // =====================================================================
  // 미리보기 오버레이 열기
  // =====================================================================
  const handleOpenPreview = useCallback((type, index) => {
    const previews = categoryPreviews[type] || [];
    const files = categoryFiles[type] || [];
    const viewFiles = previews
      .map((url, i) => ({
        url,
        name: files[i]?.name || `영수증 ${i + 1}`,
        kind: files[i]?.type?.includes("pdf") ? "pdf" : "image",
      }))
      .filter((f) => f.url);
    const clickedUrl = previews[index];
    const filteredIndex = viewFiles.findIndex((f) => f.url === clickedUrl);
    setViewerFiles(viewFiles);
    setViewerIndex(filteredIndex >= 0 ? filteredIndex : 0);
    setViewerOpen(true);
  }, [categoryPreviews, categoryFiles]);

  // =====================================================================
  // 등록 후 파일 전체 초기화
  // =====================================================================
  const resetAllFiles = useCallback(() => {
    setCategoryPreviews((prev) => {
      // 기존 Blob URL 전부 해제
      Object.values(prev).flat().forEach((url) => {
        if (String(url || "").startsWith("blob:")) URL.revokeObjectURL(url);
      });
      return Object.fromEntries(RECEIPT_CATEGORIES.map((c) => [c.type, []]));
    });
    setCategoryFiles(Object.fromEntries(RECEIPT_CATEGORIES.map((c) => [c.type, []])));
  }, []);

  // =====================================================================
  // 영수증 등록 저장 처리
  //
  // [날짜 자동 인식]
  // - cell_date / cell_day 를 전송하지 않으므로 서버(쿠팡 파서 OCR)가
  //   영수증에서 결제 날짜를 자동으로 인식하여 집계표 해당 날짜에 저장함
  // - 저장 후 서버 응답(response.saleDate)에서 인식된 날짜를 팝업으로 표시
  // =====================================================================
  const handleSave = async () => {
    // 입력값 유효성 검사
    if (!selectedAccountId) {
      Swal.fire("안내", "거래처를 선택해주세요.", "warning");
      return;
    }
    if (!selectedCardIdx) {
      Swal.fire("안내", "카드를 선택해주세요.", "warning");
      return;
    }
    if (!selectedReceiptType) {
      Swal.fire("안내", "영수증 타입을 선택해주세요.", "warning");
      return;
    }

    const totalFileCount = Object.values(categoryFiles).flat().length;
    if (totalFileCount === 0) {
      Swal.fire("안내", "등록할 영수증 파일을 선택해주세요.", "warning");
      return;
    }

    setSaving(true);

    // 전체 파일 수 계산 (진행률 표시용)
    const allFiles = RECEIPT_CATEGORIES.flatMap((c) =>
      (categoryFiles[c.type] || []).map((f) => ({ category: c, file: f }))
    );
    const totalCount = allFiles.length;

    Swal.fire({
      title: "영수증 등록 중입니다.",
      html: `<b>0 / ${totalCount}</b> 처리 중...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    // 선택된 카드 정보 추출
    const pickedCard = cardList.find((c) => String(c.idx ?? "") === selectedCardIdx) || null;
    const pickedCardNo = pickedCard?.card_no || "";
    const pickedCardBrand = pickedCard?.card_brand || "";
    // 영수증 타입 한글 라벨 (use_name 필드에 사용)
    const receiptTypeLabel = RECEIPT_TYPES.find((r) => r.value === selectedReceiptType)?.label || selectedReceiptType;

    let successCount = 0;
    let failCount = 0;
    // OCR 날짜 인식 실패 항목: 모달에서 수동 날짜 지정 후 재등록
    const newFailedDateItems = [];

    // 카테고리별, 파일별 순차 저장 (파일 인덱스 추적하여 미리보기 URL 접근)
    for (const category of RECEIPT_CATEGORIES) {
      const files = categoryFiles[category.type] || [];
      const previews = categoryPreviews[category.type] || [];
      if (!files.length) continue;

      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        const previewUrl = previews[fi] || "";

        try {
          const fd = new FormData();
          fd.append("user_id", localUserId);
          // /Corporate/receipt-scan 은 account_id를 objectValue 키로 받음 (TallySheetTab 동일 방식)
          fd.append("objectValue", selectedAccountId);
          fd.append("folderValue", "acnCorporate");
          fd.append("tallyType", category.type);         // 집계표 type: 1002 or 1003
          fd.append("type", selectedReceiptType);        // 저장 경로 분기용 type
          fd.append("receiptType", selectedReceiptType); // 영수증 파서 타입
          fd.append("receipt_type", selectedReceiptType);// 영수증 타입 저장 필드
          fd.append("saveType", "headoffice");           // headoffice 저장 타입
          fd.append("use_name", receiptTypeLabel);
          fd.append("total", 0);                         // OCR이 금액을 파싱하므로 0으로 전송
          fd.append("cardNo", pickedCardNo);
          fd.append("cardBrand", pickedCardBrand);
          // cell_date 미전송 → 서버 OCR이 영수증 날짜를 자동 인식하여 저장
          fd.append("file", file);

          const res = await api.post(SAVE_ENDPOINT, fd, {
            headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
            validateStatus: () => true,
          });

          if (res.status === 200) {
            const parsedDate = res.data?.saleDate || res.data?.cell_date || res.data?.sale_date;
            const saleId = res.data?.sale_id || res.data?.saleId || "";

            if (parsedDate) {
              // OCR 날짜 인식 성공
              successCount += 1;
            } else {
              // OCR 날짜 인식 실패 → 수동 날짜 지정 대상으로 수집
              newFailedDateItems.push({ file, category, previewUrl, saleId });
            }
          } else {
            failCount += 1;
            console.error(`저장 실패 (${category.label}, ${file.name}):`, res.data?.message);
          }
        } catch (err) {
          failCount += 1;
          console.error(`저장 오류 (${category.label}, ${file.name}):`, err);
        }

        const done = successCount + failCount + newFailedDateItems.length;
        Swal.update({
          html: `<b>${done} / ${totalCount}</b> 처리 중...`,
          showConfirmButton: false,
        });
        Swal.showLoading();
      }
    }

    setSaving(false);
    Swal.close();

    if (newFailedDateItems.length > 0) {
      // OCR 날짜 미인식 항목 → 수동 날짜 지정 모달 오픈
      setPreRetrySuccessCount(successCount);
      setFailedDateItems(newFailedDateItems);
      setRetryDate(new Date().toISOString().slice(0, 10));
      setDateRetryOpen(true);
    } else if (failCount === 0) {
      Swal.fire({ title: "완료", text: `${successCount}건 등록되었습니다.`, icon: "success" });
      resetAllFiles();
    } else if (successCount > 0) {
      Swal.fire("일부 완료", `${successCount}건 성공, ${failCount}건 실패했습니다.`, "warning");
    } else {
      Swal.fire("실패", "영수증 등록에 실패했습니다.", "error");
    }
  };

  // =====================================================================
  // OCR 날짜 미인식 영수증 재등록 (수동 날짜 지정)
  // - 모달에서 선택한 날짜(retryDate)를 cell_date로 포함하여 재전송
  // - saleId가 있으면 ON DUPLICATE KEY UPDATE로 기존 레코드 날짜만 갱신
  // =====================================================================
  const handleDateRetry = async () => {
    if (!retryDate) {
      Swal.fire("안내", "날짜를 지정해주세요.", "warning");
      return;
    }

    setRetryLoading(true);
    const pickedCard = cardList.find((c) => String(c.idx ?? "") === selectedCardIdx) || null;
    const pickedCardNo = pickedCard?.card_no || "";
    const pickedCardBrand = pickedCard?.card_brand || "";
    const receiptTypeLabel = RECEIPT_TYPES.find((r) => r.value === selectedReceiptType)?.label || selectedReceiptType;

    let retrySuccess = 0;
    let retryFail = 0;

    for (const item of failedDateItems) {
      try {
        const fd = new FormData();
        fd.append("user_id", localUserId);
        fd.append("objectValue", selectedAccountId);
        fd.append("folderValue", "acnCorporate");
        fd.append("tallyType", item.category.type);
        fd.append("type", selectedReceiptType);
        fd.append("receiptType", selectedReceiptType);
        fd.append("receipt_type", selectedReceiptType);
        fd.append("saveType", "headoffice");
        fd.append("use_name", receiptTypeLabel);
        fd.append("total", 0);
        fd.append("cardNo", pickedCardNo);
        fd.append("cardBrand", pickedCardBrand);
        fd.append("cell_date", retryDate); // 수동 지정 날짜
        if (item.saleId) fd.append("sale_id", item.saleId); // 기존 레코드 업데이트용
        fd.append("file", item.file);

        const res = await api.post(SAVE_ENDPOINT, fd, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          validateStatus: () => true,
        });

        if (res.status === 200) retrySuccess += 1;
        else retryFail += 1;
      } catch (err) {
        retryFail += 1;
        console.error("날짜 재등록 오류:", err);
      }
    }

    setRetryLoading(false);
    setDateRetryOpen(false);
    setFailedDateItems([]);

    const totalSuccess = preRetrySuccessCount + retrySuccess;
    if (retryFail === 0) {
      Swal.fire({ title: "완료", text: `${totalSuccess}건 모두 등록되었습니다.`, icon: "success" });
      resetAllFiles();
    } else {
      Swal.fire("일부 완료", `${totalSuccess}건 성공, ${retryFail}건 실패했습니다.`, "warning");
    }
  };

  // 전체 첨부 파일 수 (등록 버튼 비활성화 조건용)
  const totalFileCount = Object.values(categoryFiles).flat().length;

  const handleDownloadAll = async () => {
    const allItems = RECEIPT_CATEGORIES.flatMap((c) =>
      (categoryFiles[c.type] || []).map((file) => ({ file }))
    );
    if (allItems.length === 0) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const defaultName = `쿠팡영수증_${dateStr}.zip`;

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

    const total = allItems.length;
    let done = 0;

    Swal.fire({
      title: "ZIP 생성 중...",
      text: `0 / ${total} 처리 중...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const CONCURRENCY = 8;
    const zip = new JSZip();
    const results = [];

    for (let i = 0; i < allItems.length; i += CONCURRENCY) {
      const chunk = allItems.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(
          (item) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                done += 1;
                Swal.update({ text: `${done} / ${total} 처리 중...` });
                resolve({ item, blob: e.target.result });
              };
              reader.onerror = () => reject(new Error(`파일 읽기 실패: ${item.file.name}`));
              reader.readAsArrayBuffer(item.file);
            })
        )
      );
      results.push(...chunkResults);
    }

    const usedFileNameMap = new Map();
    let addedCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { item, blob } = result.value;
        const fileName = getUniqueDownloadFileName(item.file.name, usedFileNameMap);
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
      {(loadingAccounts || saving) && (
        <MDBox sx={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: "white", overflow: "hidden" }}>
          <LoadingScreen />
        </MDBox>
      )}

        {/* 거래처 선택 + 등록 버튼 영역 */}
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
          <Grid container spacing={1.5} alignItems="center">
            {/* 거래처 검색 Autocomplete */}
            <Grid item xs={12} md={5}>
              <Autocomplete
                size="small"
                options={accountList || []}
                value={selectedAccountOption}
                onChange={(_, newValue) => {
                  if (isAccountLocked) return;
                  if (!newValue) return;
                  setSelectedAccountId(String(newValue.account_id));
                  setAccountInput(newValue?.account_name || "");
                }}
                inputValue={accountInput}
                onInputChange={(_, newValue) => {
                  if (isAccountLocked) return;
                  setAccountInput(newValue);
                }}
                getOptionLabel={(opt) => (opt?.account_name ? String(opt.account_name) : "")}
                isOptionEqualToValue={(opt, val) => String(opt?.account_id) === String(val?.account_id)}
                disableClearable={isAccountLocked}
                disabled={isAccountLocked}
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
                  />
                )}
                sx={{ "& .MuiInputBase-root": { height: 40, alignItems: "center" } }}
              />
            </Grid>

            {/* 카드 선택 드롭박스 */}
            <Grid item xs={12} md={3}>
              <Select
                size="small"
                value={selectedCardIdx}
                onChange={(e) => setSelectedCardIdx(e.target.value)}
                displayEmpty
                fullWidth
                sx={{ height: 40 }}
              >
                <MenuItem value="" disabled>
                  <em>카드 선택</em>
                </MenuItem>
                {cardList.map((card) => {
                  // 카드번호 XXXX-****-****-XXXX 형식 (앞 4자리 + 뒤 4자리만 표시)
                  const digits = String(card.card_no || "").replace(/\D/g, "");
                  const first4 = digits.slice(0, 4);
                  const last4 = digits.slice(-4);
                  const maskedNo = digits.length >= 8 ? `${first4}-****-****-${last4}` : digits;
                  const label = `${card.card_brand || ""}${maskedNo ? ` (${maskedNo})` : ""}`;
                  return (
                    <MenuItem key={String(card.idx)} value={String(card.idx ?? "")}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
            </Grid>

            {/* 영수증 타입 드롭박스 */}
            <Grid item xs={12} md={2}>
              <Select
                size="small"
                value={selectedReceiptType}
                onChange={(e) => setSelectedReceiptType(e.target.value)}
                displayEmpty
                fullWidth
                sx={{ height: 40 }}
              >
                <MenuItem value="" disabled>
                  <em>영수증 타입 선택</em>
                </MenuItem>
                {RECEIPT_TYPES.map((rt) => (
                  <MenuItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            {/* ZIP 다운로드 + 등록 버튼 */}
            <Grid item xs={12} md="auto" sx={{ ml: "auto" }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <MDButton
                  color="success"
                  size="small"
                  onClick={handleDownloadAll}
                  disabled={totalFileCount === 0}
                  sx={{ height: 40, minWidth: 130, whiteSpace: "nowrap" }}
                >
                  <DownloadIcon sx={{ fontSize: 16, mr: 0.5 }} />
                  ZIP 다운로드
                </MDButton>
                <MDButton
                  color="warning"
                  size="small"
                  onClick={handleSave}
                  disabled={saving || totalFileCount === 0 || !selectedAccountId}
                  sx={{ height: 40, minWidth: 110 }}
                >
                  등록 ({totalFileCount}건)
                </MDButton>
              </Box>
            </Grid>
          </Grid>
        </MDBox>

        {/* 카테고리별 영수증 업로드 섹션 — 스크롤 영역 */}
        <MDBox sx={{ flex: 1, overflowY: "auto", pb: 3 }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {RECEIPT_CATEGORIES.map((category) => (
            <UploadSection
              key={category.type}
              category={category}
              files={categoryFiles[category.type] || []}
              previews={categoryPreviews[category.type] || []}
              onFileAdd={handleFileAdd}
              onFileRemove={handleFileRemove}
              onPreview={handleOpenPreview}
            />
          ))}
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

      {/* OCR 날짜 미인식 영수증 수동 날짜 지정 모달 */}
      <Dialog
        open={dateRetryOpen}
        onClose={() => !retryLoading && setDateRetryOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          📅 날짜 미인식 영수증 날짜 지정
          {preRetrySuccessCount > 0 && (
            <Typography variant="body2" sx={{ color: "#6b7280", mt: 0.5 }}>
              {preRetrySuccessCount}건 자동 등록 완료 · 아래 {failedDateItems.length}건은 날짜를 지정해주세요
            </Typography>
          )}
        </DialogTitle>

        <DialogContent dividers>
          {/* 날짜 미인식 영수증 목록 */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
            {failedDateItems.map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${item.category.color}`,
                  borderRadius: 1.5,
                  backgroundColor: "#fafafa",
                }}
              >
                {/* 영수증 썸네일 (이미지만, PDF는 아이콘 대체) */}
                {item.previewUrl && !item.file.type.includes("pdf") ? (
                  <Box
                    component="img"
                    src={item.previewUrl}
                    alt={item.file.name}
                    sx={{
                      width: 52,
                      height: 52,
                      objectFit: "cover",
                      borderRadius: 1,
                      flexShrink: 0,
                      border: "1px solid #e5e7eb",
                    }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1,
                      flexShrink: 0,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    📄
                  </Box>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* 파일명 */}
                  <Box sx={{ fontSize: 13, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.file.name}
                  </Box>
                  {/* 카테고리 배지 */}
                  <Box
                    sx={{
                      display: "inline-block",
                      mt: 0.4,
                      px: 0.8,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#fff",
                      backgroundColor: item.category.color,
                    }}
                  >
                    {item.category.label}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          {/* 날짜 선택 */}
          <TextField
            label="날짜 지정"
            type="date"
            size="small"
            fullWidth
            value={retryDate}
            onChange={(e) => setRetryDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <MDButton
            size="small"
            color="secondary"
            onClick={() => setDateRetryOpen(false)}
            disabled={retryLoading}
            sx={{ mr: 1 }}
          >
            취소
          </MDButton>
          <MDButton
            size="small"
            color="warning"
            onClick={handleDateRetry}
            disabled={retryLoading || !retryDate}
          >
            {retryLoading ? "등록 중..." : `날짜 지정 등록 (${failedDateItems.length}건)`}
          </MDButton>
        </DialogActions>
      </Dialog>
    </MDBox>
  );
}

export default CoupangReceiptTab;
