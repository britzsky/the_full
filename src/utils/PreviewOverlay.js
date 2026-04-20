import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import { useTheme, useMediaQuery } from "@mui/material";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Minus, Plus, RefreshCw, X } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as XLSX from "xlsx";
import MDBox from "components/MDBox";
import api from "api/api";

// 파일 종류별 미리보기 창 비율을 계산한다.
function getViewerFrameRatio(isMobile, fileKind) {
  const kind = String(fileKind || "").trim().toLowerCase();
  if (kind === "pdf") {
    return isMobile ? { widthRatio: 0.8, heightRatio: 0.84 } : { widthRatio: 0.46, heightRatio: 0.82 };
  }
  return isMobile ? { widthRatio: 0.68, heightRatio: 0.92 } : { widthRatio: 0.34, heightRatio: 0.88 };
}

// 화면 정중앙 기준 기본 좌표를 계산한다.
function getCenteredViewerPos(isMobile, fileKind) {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { widthRatio, heightRatio } = getViewerFrameRatio(isMobile, fileKind);
  const modalW = w * widthRatio;
  const modalH = h * heightRatio;
  return {
    x: Math.max(0, (w - modalW) / 2),
    y: Math.max(0, (h - modalH) / 2),
  };
}

// DB image_path 기반 파일은 캐시 응답(304)로 들어오면 본문이 비어
// PDF/엑셀 미리보기가 깨질 수 있어 재요청용 쿼리를 붙일 수 있게 만든다.
function appendPreviewCacheBust(url) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl || /^(blob:|data:)/i.test(targetUrl)) return targetUrl;

  try {
    const parsed = new URL(targetUrl);
    parsed.searchParams.set("_preview_ts", String(Date.now()));
    return parsed.toString();
  } catch {
    const separator = targetUrl.includes("?") ? "&" : "?";
    return `${targetUrl}${separator}_preview_ts=${Date.now()}`;
  }
}

function decodeUriRepeatedly(value) {
  let current = String(value ?? "").trim();
  if (!current) return "";

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURI(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }

  return current;
}

// 전자결재 상세와 동일하게 PDF는 좌측 페이지 패널을 접은 기본 뷰로 연다.
function buildPdfViewerUrl(url) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) return "";

  const [baseUrl] = targetUrl.split("#");
  return `${baseUrl}#page=1&view=FitH&pagemode=none&navpanes=0&toolbar=1`;
}

// 파일 미리보기 blob 로드 공통 함수
// - AccountMemberSheetTab과 동일하게 axios blob 요청을 우선 사용한다.
// - 304/캐시 문제로 본문이 비면 cache bust URL로 한 번 더 재요청한다.
// - 마지막에는 fetch fallback으로 환경별 차이를 흡수한다.
async function fetchPreviewBlob(url) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) throw new Error("미리보기 URL이 비어있습니다.");

  const fallbackDecodedUrl = (() => {
    try {
      return decodeURI(targetUrl);
    } catch {
      return "";
    }
  })();

  const baseCandidates = Array.from(new Set([targetUrl, fallbackDecodedUrl].filter(Boolean)));
  const candidates = baseCandidates.flatMap((candidateUrl) => {
    const bustUrl = appendPreviewCacheBust(candidateUrl);
    return bustUrl && bustUrl !== candidateUrl ? [candidateUrl, bustUrl] : [candidateUrl];
  });

  for (let i = 0; i < candidates.length; i += 1) {
    const candidateUrl = candidates[i];
    const isLocalUrl = /^(blob:|data:)/i.test(candidateUrl);
    if (isLocalUrl) {
      const localResponse = await fetch(candidateUrl);
      if (!localResponse.ok) continue;
      const localBlob = await localResponse.blob();
      if (localBlob.size > 0) return localBlob;
      continue;
    }

    try {
      const response = await api.get(candidateUrl, {
        responseType: "blob",
        withCredentials: true,
      });
      const responseBlob = response?.data;
      if (responseBlob instanceof Blob && responseBlob.size > 0) {
        return responseBlob;
      }
    } catch {
      // 다음 fallback(fetch)으로 진행
    }

    try {
      const withCredentials = await fetch(candidateUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!withCredentials.ok) continue;
      const fallbackBlob = await withCredentials.blob();
      if (fallbackBlob.size > 0) return fallbackBlob;
    } catch {
      // 다음 candidateUrl로 진행
    }
  }
  throw new Error("미리보기 파일을 불러오지 못했습니다.");
}

// 공통 첨부파일 미리보기 오버레이
// - 문서별로 중복 구현하지 않도록 utils로 이동한 공용 컴포넌트
// - AccountMemberSheetTab 스타일을 기준으로 작성탭/상세모달 모두 재사용
// - 파일 목록 이동(좌/우), 이미지 줌, PDF 확대, XLSX 표 미리보기 지원
function PreviewOverlay({
  open,
  files,
  currentIndex,
  onChangeIndex,
  onClose,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // PDF는 iframe 렌더링이라 이미지 줌 라이브러리와 분리해 배율을 직접 제어한다.
  const [pdfScale, setPdfScale] = useState(1);
  // 이미지는 회전값을 별도 상태로 관리해 확대/축소와 함께 사용한다.
  const [imageRotation, setImageRotation] = useState(0);
  // 오버레이 창 드래그 위치(좌상단 기준 px)
  const [viewerPos, setViewerPos] = useState(() => getCenteredViewerPos(isMobile));
  // 드래그 상태/오프셋을 분리해 마우스 이동마다 불필요한 계산을 줄인다.
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // 엑셀 미리보기 상태: 로딩/시트명/표데이터/오류를 한 객체로 관리한다.
  const [excelPreview, setExcelPreview] = useState({
    loading: false,
    sheetName: "",
    rows: [],
    error: "",
  });
  // PDF 미리보기는 DB 파일(URL) 원본 대신 blob URL로 렌더해 자동 다운로드를 방지한다.
  const [pdfPreview, setPdfPreview] = useState({
    loading: false,
    blobUrl: "",
    directUrl: "",
    error: "",
  });
  const pdfBlobUrlRef = useRef("");

  const previewFiles = Array.isArray(files) ? files : [];
  const maxIndex = Math.max(previewFiles.length - 1, 0);
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), maxIndex);
  const currentFile = previewFiles[safeIndex] || null;
  // 첨부파일 URL은 image_path 기준으로 이미 한 번 인코딩된 값이 들어올 수 있으므로
  // decode -> encode 한 번만 적용해 %25 형태의 이중 인코딩을 막는다.
  const currentFileViewUrl = useMemo(() => {
    const rawUrl = String(currentFile?.url ?? "").trim();
    if (!rawUrl) return "";
    if (/^(blob:|data:)/i.test(rawUrl)) return rawUrl;
    try {
      return encodeURI(decodeUriRepeatedly(rawUrl));
    } catch {
      return encodeURI(rawUrl);
    }
  }, [currentFile?.url]);
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < maxIndex;

  // 파일을 바꿀 때 이전 배율이 남아 있으면 사용성이 떨어져 기본 배율로 초기화한다.
  useLayoutEffect(() => {
    if (!open) return;
    setPdfScale(1);
    setImageRotation(0);
  }, [open, safeIndex]);

  // 오버레이를 열 때 화면 중앙 위치로 기본 배치
  useLayoutEffect(() => {
    if (!open) return;
    setViewerPos(getCenteredViewerPos(isMobile, currentFile?.kind));
  }, [open, isMobile, safeIndex, currentFile?.kind]);

  // 오버레이가 열린 동안은 바깥 페이지 스크롤을 잠가
  // PDF 주변에 브라우저 기본 스크롤이 노출되지 않게 한다.
  useEffect(() => {
    if (!open) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  const handleDragStart = useCallback(
    (e) => {
      if (!open) return;
      e.preventDefault();
      setDragging(true);
      dragOffsetRef.current = {
        x: e.clientX - viewerPos.x,
        y: e.clientY - viewerPos.y,
      };
    },
    [open, viewerPos.x, viewerPos.y]
  );

  const handleDragMove = useCallback(
    (e) => {
      if (!dragging) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { widthRatio, heightRatio } = getViewerFrameRatio(isMobile, currentFile?.kind);
      const modalW = w * widthRatio;
      const modalH = h * heightRatio;
      const nextX = e.clientX - dragOffsetRef.current.x;
      const nextY = e.clientY - dragOffsetRef.current.y;
      setViewerPos({
        x: Math.min(Math.max(0, nextX), Math.max(0, w - modalW)),
        y: Math.min(Math.max(0, nextY), Math.max(0, h - modalH)),
      });
    },
    [dragging, isMobile, currentFile?.kind]
  );

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // drag 중에만 전역 이벤트를 붙여 입력 지연/부하를 최소화한다.
  // 특히 폼 입력 탭에서 타이핑 버벅임이 생기지 않도록 종료 시 즉시 해제한다.
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  const movePrev = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (!canGoPrev) return;
      if (typeof onChangeIndex === "function") onChangeIndex((prev) => Math.max(prev - 1, 0));
    },
    [canGoPrev, onChangeIndex]
  );

  const moveNext = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (!canGoNext) return;
      if (typeof onChangeIndex === "function") onChangeIndex((prev) => Math.min(prev + 1, maxIndex));
    },
    [canGoNext, maxIndex, onChangeIndex]
  );

  // PDF 파일 미리보기 데이터 로드
  // - DB 경로 PDF가 attachment 헤더로 내려오는 경우를 대비해 먼저 blob URL로 변환한다.
  useEffect(() => {
    let cancelled = false;
    const clearPdfBlobUrl = () => {
      if (!pdfBlobUrlRef.current) return;
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = "";
    };

    const loadPdfPreview = async () => {
      if (!open || currentFile?.kind !== "pdf" || !currentFileViewUrl) {
        clearPdfBlobUrl();
        setPdfPreview({ loading: false, blobUrl: "", directUrl: "", error: "" });
        return;
      }

      setPdfPreview({ loading: true, blobUrl: "", directUrl: "", error: "" });

      if (/^(blob:|data:)/i.test(currentFileViewUrl)) {
        setPdfPreview({
          loading: false,
          blobUrl: "",
          directUrl: currentFileViewUrl,
          error: "",
        });
        return;
      }

      try {
        const previewBlob = await fetchPreviewBlob(currentFileViewUrl);
        if (cancelled) return;

        const nextPdfBlob = String(previewBlob?.type || "")
          .toLowerCase()
          .includes("pdf")
          ? previewBlob
          : new Blob([previewBlob], { type: "application/pdf" });
        clearPdfBlobUrl();
        const nextBlobUrl = URL.createObjectURL(nextPdfBlob);
        pdfBlobUrlRef.current = nextBlobUrl;
        setPdfPreview({ loading: false, blobUrl: nextBlobUrl, directUrl: "", error: "" });
      } catch {
        if (cancelled) return;
        clearPdfBlobUrl();
        setPdfPreview({
          loading: false,
          blobUrl: "",
          directUrl: currentFileViewUrl,
          error: "",
        });
      }
    };

    loadPdfPreview();
    return () => {
      cancelled = true;
      clearPdfBlobUrl();
    };
  }, [open, currentFile?.kind, currentFileViewUrl]);

  // 엑셀 파일 미리보기 데이터 로드
  // - 첫 번째 시트만 표로 렌더
  // - 대용량 파일 렌더 부하를 막기 위해 최대 행/열 개수를 제한
  // - 언마운트/파일전환 타이밍의 setState 경고 방지를 위해 cancelled 플래그 사용
  useEffect(() => {
    let cancelled = false;

    const loadExcelPreview = async () => {
      if (!open || currentFile?.kind !== "excel" || !currentFileViewUrl) {
        setExcelPreview({ loading: false, sheetName: "", rows: [], error: "" });
        return;
      }

      setExcelPreview({ loading: true, sheetName: "", rows: [], error: "" });
      try {
        const previewBlob = await fetchPreviewBlob(currentFileViewUrl);
        const buffer = await previewBlob.arrayBuffer();
        if (cancelled) return;

        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = String(workbook.SheetNames?.[0] || "");
        if (!firstSheetName) throw new Error("시트 정보를 찾을 수 없습니다.");

        const worksheet = workbook.Sheets[firstSheetName];
        const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        // 미리보기는 "원본 확인" 목적만 충족하면 되므로 전체 데이터 렌더링 대신
        // 상위 80행, 좌측 16열만 노출해 브라우저 렌더 비용을 낮춘다.
        const trimmedRows = (Array.isArray(matrix) ? matrix : []).slice(0, 80).map((row) =>
          (Array.isArray(row) ? row : []).slice(0, 16).map((cell) => String(cell ?? ""))
        );

        if (cancelled) return;
        setExcelPreview({
          loading: false,
          sheetName: firstSheetName,
          rows: trimmedRows,
          error: "",
        });
      } catch {
        if (cancelled) return;
        setExcelPreview({
          loading: false,
          sheetName: "",
          rows: [],
          error: "엑셀 미리보기를 불러오지 못했습니다.",
        });
      }
    };

    loadExcelPreview();
    return () => {
      cancelled = true;
    };
  }, [open, currentFile?.kind, currentFileViewUrl]);

  const panelStyle = useMemo(
    () => {
      const { widthRatio, heightRatio } = getViewerFrameRatio(isMobile, currentFile?.kind);
      return {
        position: "absolute",
        left: viewerPos.x,
        top: viewerPos.y,
        width: `${widthRatio * 100}vw`,
        height: `${heightRatio * 100}vh`,
        minWidth: 280,
        minHeight: 200,
        resize: "both",
        overflow: "hidden",
      };
    },
    [viewerPos.x, viewerPos.y, isMobile, currentFile?.kind]
  );

  const titlebarIconButtonStyle = useMemo(
    () => ({
      width: isMobile ? 26 : 28,
      height: isMobile ? 26 : 28,
      borderRadius: 6,
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      color: "#fff",
      cursor: "pointer",
      transition: "all 0.18s ease",
    }),
    [isMobile]
  );

  const imageToolButtonStyle = useMemo(
    () => ({
      width: isMobile ? 28 : 30,
      height: isMobile ? 28 : 30,
      borderRadius: 8,
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.15)",
      color: "#fff",
      cursor: "pointer",
    }),
    [isMobile]
  );

  const isQuarterRotation = Math.abs(imageRotation % 180) === 90;

  // 이미지 크기: 고정 px 대신 100%로 창 크기에 맞게 자동 조절
  const rotatedImageStyle = useMemo(
    () => ({
      width: isQuarterRotation ? "100%" : "100%",
      height: isQuarterRotation ? "100%" : "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      borderRadius: 12,
      display: "block",
      objectFit: "contain",
      transform: `rotate(${imageRotation}deg)`,
      transformOrigin: "center center",
      boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
    }),
    [imageRotation, isQuarterRotation]
  );

  if (!open || !currentFile) return null;

  const currentPreviewUrl =
    currentFile.kind === "pdf"
      ? pdfPreview.blobUrl || pdfPreview.directUrl || currentFileViewUrl
      : currentFileViewUrl;

  const viewerTitleText = `${currentFile?.name || "첨부 미리보기"}${previewFiles.length ? `  (${safeIndex + 1}/${previewFiles.length})` : ""}`;

  const overlayElement = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "transparent",
        zIndex: 13000,
        pointerEvents: "none",
      }}
    >
      <div style={{ ...panelStyle, pointerEvents: "auto" }}>
        {/* 제목 바를 마우스로 잡아서 오버레이 위치를 이동할 수 있게 구성 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#000",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.25)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 42,
            cursor: "move",
            zIndex: 1002,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 8px",
            color: "#fff",
            fontSize: 12,
            userSelect: "none",
            backgroundColor: "#1b1b1b",
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
          onMouseDown={handleDragStart}
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
            {viewerTitleText}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              movePrev(e);
            }}
            disabled={!canGoPrev}
            style={{
              ...titlebarIconButtonStyle,
              opacity: canGoPrev ? 1 : 0.45,
              cursor: canGoPrev ? "pointer" : "not-allowed",
            }}
            title="이전(←)"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveNext(e);
            }}
            disabled={!canGoNext}
            style={{
              ...titlebarIconButtonStyle,
              opacity: canGoNext ? 1 : 0.45,
              cursor: canGoNext ? "pointer" : "not-allowed",
            }}
            title="다음(→)"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!currentPreviewUrl) return;
              window.open(currentPreviewUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!currentPreviewUrl}
            style={{
              ...titlebarIconButtonStyle,
              opacity: currentPreviewUrl ? 1 : 0.45,
              cursor: currentPreviewUrl ? "pointer" : "not-allowed",
            }}
            title="새 탭으로 열기"
          >
            <ExternalLink size={14} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!currentPreviewUrl) return;
              const link = document.createElement("a");
              link.href = currentPreviewUrl;
              link.download = currentFile?.name || "preview";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            disabled={!currentPreviewUrl}
            style={{
              ...titlebarIconButtonStyle,
              opacity: currentPreviewUrl ? 1 : 0.45,
              cursor: currentPreviewUrl ? "pointer" : "not-allowed",
            }}
            title="다운로드"
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              ...titlebarIconButtonStyle,
            }}
            title="닫기"
          >
            <X size={isMobile ? 12 : 14} />
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            zIndex: 1001,
            paddingTop: 42,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* PDF: iframe + 별도 배율 제어 버튼 */}
          {currentFile.kind === "pdf" ? (
            <MDBox
              sx={{
                width: "100%",
                height: "100%",
                bgcolor: "#111",
                overflow: "auto",
                position: "relative",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": {
                  display: "none",
                },
              }}
            >
              {pdfPreview.loading ? (
                <MDBox sx={{ p: 2, color: "#fff", fontSize: 12 }}>PDF 미리보기 로딩 중...</MDBox>
              ) : pdfPreview.error ? (
                <MDBox sx={{ p: 2, color: "#ffb4b4", fontSize: 12 }}>{pdfPreview.error}</MDBox>
              ) : pdfPreview.blobUrl || pdfPreview.directUrl ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: `scale(${pdfScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <iframe
                    title="pdf-preview"
                    src={buildPdfViewerUrl(pdfPreview.blobUrl || pdfPreview.directUrl)}
                    style={{ width: "100%", height: "100%", border: 0 }}
                  />
                </div>
              ) : null}
            </MDBox>
          ) : null}

          {/* 이미지: react-zoom-pan-pinch로 확대/축소/초기화 지원 */}
          {currentFile.kind === "image" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "auto",
                position: "relative",
              }}
            >
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        zIndex: 1000,
                        pointerEvents: "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          zoomIn();
                        }}
                        style={imageToolButtonStyle}
                        title="확대"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          zoomOut();
                        }}
                        style={imageToolButtonStyle}
                        title="축소"
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          resetTransform();
                          setImageRotation((prev) => (prev + 90) % 360);
                        }}
                        style={imageToolButtonStyle}
                        title="90도 회전"
                      >
                        <span
                          style={{
                            fontSize: isMobile ? 9 : 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          90°
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          resetTransform();
                          setImageRotation(0);
                        }}
                        style={imageToolButtonStyle}
                        title="원래대로"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <img
                        src={currentFileViewUrl}
                        alt={currentFile.name || "미리보기"}
                        style={rotatedImageStyle}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
          ) : null}

          {/* Excel(xls/xlsx): 첫 시트 내용을 표 형태로 렌더 */}
          {currentFile.kind === "excel" ? (
            <MDBox
              sx={{
                width: "100%",
                height: "100%",
                border: "1px solid #d8dee8",
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              <MDBox
                sx={{
                  px: 1.5,
                  py: 1,
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 12,
                  color: "#374151",
                  fontWeight: 700,
                }}
              >
                {excelPreview.sheetName || "Sheet1"}
              </MDBox>
              <MDBox sx={{ flex: 1, overflow: "auto" }}>
                {excelPreview.loading ? (
                  <MDBox sx={{ p: 2, fontSize: 12, color: "#6b7280" }}>엑셀 미리보기 로딩 중...</MDBox>
                ) : excelPreview.error ? (
                  <MDBox sx={{ p: 2, fontSize: 12, color: "#d32f2f" }}>{excelPreview.error}</MDBox>
                ) : excelPreview.rows.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      {excelPreview.rows.map((row, rowIndex) => (
                        <tr key={`excel-row-${rowIndex}`}>
                          {row.map((cell, colIndex) => (
                            <td
                              key={`excel-cell-${rowIndex}-${colIndex}`}
                              style={{
                                border: "1px solid #e5e7eb",
                                padding: "6px 8px",
                                fontSize: 11,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {cell || "\u00a0"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <MDBox sx={{ p: 2, fontSize: 12, color: "#6b7280" }}>미리보기 데이터가 없습니다.</MDBox>
                )}
              </MDBox>
            </MDBox>
          ) : null}
        </div>
      </div>
    </div>
  );

  // 상세 모달(Box transform 컨텍스트) 내부에서 렌더되면 고정 오버레이가 잘릴 수 있어
  // document.body 포털로 올려 항상 화면 정중앙 기준으로 표시한다.
  if (typeof document === "undefined" || !document.body) return overlayElement;
  return createPortal(overlayElement, document.body);
}

PreviewOverlay.propTypes = {
  open: PropTypes.bool,
  files: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string,
      name: PropTypes.string,
      kind: PropTypes.oneOf(["image", "pdf", "excel", "file"]),
    })
  ),
  currentIndex: PropTypes.number,
  onChangeIndex: PropTypes.func,
  onClose: PropTypes.func,
};

PreviewOverlay.defaultProps = {
  open: false,
  files: [],
  currentIndex: 0,
  onChangeIndex: null,
  onClose: null,
};

export default React.memo(PreviewOverlay);
