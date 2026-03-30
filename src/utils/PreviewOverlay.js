import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import { useTheme, useMediaQuery } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as XLSX from "xlsx";
import MDBox from "components/MDBox";

// 화면 정중앙 기준 기본 좌표를 계산한다.
function getCenteredViewerPos(isMobile) {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const modalW = isMobile ? w * 0.92 : w * 0.58;
  const modalH = isMobile ? h * 0.92 : h * 0.88;
  return {
    x: Math.max(0, (w - modalW) / 2),
    y: Math.max(0, (h - modalH) / 2),
  };
}

// 파일 미리보기 fetch 공통 함수
// - 상세 모달(DB 경로)에서는 인증 쿠키가 필요한 경우가 있어 credentials 포함 호출을 우선한다.
// - 실패 시 일반 fetch로 한 번 더 시도해 환경별 차이를 흡수한다.
async function fetchPreviewResponse(url) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) throw new Error("미리보기 URL이 비어있습니다.");

  const fallbackDecodedUrl = (() => {
    try {
      return decodeURI(targetUrl);
    } catch {
      return "";
    }
  })();

  const candidates = Array.from(new Set([targetUrl, fallbackDecodedUrl].filter(Boolean)));

  for (let i = 0; i < candidates.length; i += 1) {
    const candidateUrl = candidates[i];
    const isLocalUrl = /^(blob:|data:)/i.test(candidateUrl);
    if (isLocalUrl) {
      const localResponse = await fetch(candidateUrl);
      if (localResponse.ok) return localResponse;
      continue;
    }

    try {
      const withCredentials = await fetch(candidateUrl, { credentials: "include" });
      if (withCredentials.ok) return withCredentials;
    } catch {
      // 다음 fallback(fetch without credentials)으로 진행
    }

    try {
      const fallback = await fetch(candidateUrl);
      if (fallback.ok) return fallback;
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
  // 미리보기 URL은 한글/공백 경로 대응을 위해 인코딩하되,
  // blob/data URL은 브라우저 내부 리소스이므로 원문을 유지한다.
  const currentFileViewUrl = useMemo(() => {
    const rawUrl = String(currentFile?.url ?? "").trim();
    if (!rawUrl) return "";
    if (/^(blob:|data:)/i.test(rawUrl)) return rawUrl;
    return encodeURI(rawUrl);
  }, [currentFile?.url]);
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < maxIndex;

  // 파일을 바꿀 때 이전 배율이 남아 있으면 사용성이 떨어져 기본 배율로 초기화한다.
  useEffect(() => {
    if (!open) return;
    setPdfScale(1);
  }, [open, safeIndex]);

  // 오버레이를 열 때 화면 중앙 위치로 기본 배치
  useEffect(() => {
    if (!open) return;
    setViewerPos(getCenteredViewerPos(isMobile));
  }, [open, isMobile, safeIndex]);

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
      const modalW = isMobile ? w * 0.92 : w * 0.58;
      const modalH = isMobile ? h * 0.92 : h * 0.88;
      const nextX = e.clientX - dragOffsetRef.current.x;
      const nextY = e.clientY - dragOffsetRef.current.y;
      setViewerPos({
        x: Math.min(Math.max(0, nextX), Math.max(0, w - modalW)),
        y: Math.min(Math.max(0, nextY), Math.max(0, h - modalH)),
      });
    },
    [dragging, isMobile]
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
      try {
        const response = await fetchPreviewResponse(currentFileViewUrl);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        if (!buffer || buffer.byteLength === 0) {
          throw new Error("빈 PDF 파일입니다.");
        }
        const headerBytes = new Uint8Array(buffer.slice(0, 5));
        const headerText = String.fromCharCode(...headerBytes);
        if (headerText !== "%PDF-") {
          throw new Error("PDF 형식이 아닌 응답입니다.");
        }

        const blob = new Blob([buffer], { type: "application/pdf" });
        clearPdfBlobUrl();
        const nextBlobUrl = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = nextBlobUrl;
        setPdfPreview({ loading: false, blobUrl: nextBlobUrl, directUrl: "", error: "" });
      } catch {
        if (cancelled) return;
        clearPdfBlobUrl();
        setPdfPreview({
          loading: false,
          blobUrl: "",
          // blob 변환이 실패하면 DB 경로 원본 URL로 한 번 더 렌더링을 시도한다.
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
        const response = await fetchPreviewResponse(currentFileViewUrl);
        const buffer = await response.arrayBuffer();
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
    () => ({
      position: "absolute",
      left: viewerPos.x,
      top: viewerPos.y,
      width: isMobile ? "92vw" : "58vw",
      height: isMobile ? "92vh" : "88vh",
    }),
    [viewerPos.x, viewerPos.y, isMobile]
  );

  if (!open || !currentFile) return null;

  const overlayElement = (
    // 배경 클릭으로 닫기: 모달 외부 클릭 닫힘 UX를 기본으로 제공
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "transparent",
        zIndex: 13000,
      }}
      onClick={onClose}
    >
      {/* 내부 컨텐츠 클릭은 닫힘 이벤트 전파를 막아야 버튼/드래그가 정상 동작한다. */}
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        {/* 제목 바를 마우스로 잡아서 오버레이 위치를 이동할 수 있게 구성 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 8,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            cursor: "move",
            zIndex: 1002,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            color: "#fff",
            fontSize: 12,
            userSelect: "none",
          }}
          onMouseDown={handleDragStart}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
            {currentFile?.name || "미리보기"}
          </span>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            X
          </button>
        </div>

        {/* 파일 목록 이전/다음 이동 버튼 */}
        <button
          type="button"
          onClick={movePrev}
          disabled={!canGoPrev}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1003,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: canGoPrev ? "rgba(0,0,0,0.48)" : "rgba(255,255,255,0.2)",
            color: "#fff",
            cursor: canGoPrev ? "pointer" : "not-allowed",
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={moveNext}
          disabled={!canGoNext}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1003,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: canGoNext ? "rgba(0,0,0,0.48)" : "rgba(255,255,255,0.2)",
            color: "#fff",
            cursor: canGoNext ? "pointer" : "not-allowed",
          }}
        >
          <ChevronRight size={20} />
        </button>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            zIndex: 1001,
            paddingTop: 32,
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
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  zIndex: 1000,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPdfScale((prev) => Math.min(prev + 0.1, 2.5));
                  }}
                  style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                >
                  +
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPdfScale((prev) => Math.max(prev - 0.1, 0.5));
                  }}
                  style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                >
                  -
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPdfScale(1);
                  }}
                  style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                >
                  ⟳
                </button>
              </div>
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
                    src={`${pdfPreview.blobUrl || pdfPreview.directUrl}#view=FitH`}
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
                        top: 8,
                        right: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        zIndex: 1000,
                        pointerEvents: "auto",
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          zoomIn();
                        }}
                        style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                      >
                        +
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          zoomOut();
                        }}
                        style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                      >
                        -
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          resetTransform();
                        }}
                        style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}
                      >
                        ⟳
                      </button>
                    </div>

                    <TransformComponent>
                      <img
                        src={currentFileViewUrl}
                        alt={currentFile.name || "미리보기"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          height: "auto",
                          width: "auto",
                          borderRadius: 8,
                          display: "block",
                        }}
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
