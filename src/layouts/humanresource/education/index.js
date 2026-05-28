/* eslint-disable react/function-component-definition */
// ── 외부 라이브러리 임포트 ────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { IconButton, TextField, useTheme, useMediaQuery } from "@mui/material";
import { Download, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

// ── 레이아웃 및 공통 컴포넌트 임포트 ─────────────────────────
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";

// ── 내부 훅 및 유틸리티 임포트 ───────────────────────────────
import useEducationData from "./data/EducationData";
import PreviewOverlay from "utils/PreviewOverlay";
import { toHeadOfficeDocumentViewUrl } from "utils/headOfficeDocumentImageUtils";
import logo from "assets/images/the-full-logo4.png";

// 백엔드가 파일 경로를 상대경로(/uploads/...)로 내려주므로, 앞에 서버 주소를 붙여 실제 접근 URL을 만들 때 사용
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";
const MAX_FILES = 10; // 첨부파일 최대 개수

// ── 교육 분류 옵션 (DB large_type 값과 매핑) ─────────────────
const LARGE_TYPE_OPTIONS = [
  { value: 1, label: "법정 의무교육" },
  { value: 2, label: "사외 교육" },
  { value: 3, label: "사내 교육" },
];

// ── 교육 메인 컴포넌트 ────────────────────────────────────────
function Education() {
  // 테마 및 반응형 분기
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // md 미만이면 모바일

  // ── 로그인 사용자 정보 (localStorage 읽기) ───────────────────
  const loginUserId = String(localStorage.getItem("user_id") || "").trim();
  const loginPosition = Number(localStorage.getItem("position") ?? 99);
  const loginDept = Number(localStorage.getItem("department") ?? -1);
  // position = 대표님, 팀장님들
  // department = 3(인사팀) · 6(개발팀) 이면 작성·수정·삭제 가능
  const canWrite = loginPosition === 0 || loginPosition === 1 || loginDept === 3 || loginDept === 6;

  // ── 데이터 훅 (상태·API 함수 일괄 구조분해) ─────────────────
  const {
    rows,
    loading,
    detail,
    detailLoading,
    saving,
    educationFiles,
    loadList,
    loadDetail,
    saveEducation,
    deleteEducation,
    syncEducationFiles,
    clearEducationFiles,
  } = useEducationData();

  // ── 현재 화면 모드: "list"(목록) | "detail"(상세) | "write"(작성·수정) ──
  const [view, setView] = useState("list");

  // ── 목록 필터 상태 ───────────────────────────────────────────
  const [filterLarge, setFilterLarge] = useState(0);  // 분류 필터 (0 = 전체)
  const [filterText, setFilterText] = useState("");    // 키워드 검색어

  // ── 작성·수정 폼 입력 상태 ───────────────────────────────────
  const [editIdx, setEditIdx] = useState(null);        // null: 신규 작성, 숫자: 수정 대상 idx
  const [formTitle, setFormTitle] = useState("");      // 교육 제목
  const [formContent, setFormContent] = useState(""); // 교육 본문
  const [formLargeType, setFormLargeType] = useState(0); // 분류 코드

  // ── 첨부파일 상태 ─────────────────────────────────────────────
  // pendingFiles: 선택했지만 아직 서버에 미저장된 파일 배열 { file, name, previewUrl }
  // deletedFileOrders: 삭제 예약된 기존 파일의 image_order Set
  const [pendingFiles, setPendingFiles] = useState([]);
  const [deletedFileOrders, setDeletedFileOrders] = useState(new Set());
  const pendingFilesRef = useRef([]);  // 언마운트 시 blob URL 해제용 ref
  const fileInputRef = useRef(null);   // 파일 선택 input ref

  // ── 미리보기 오버레이 상태 ────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // pendingFiles 변경 시 ref 동기화 (언마운트 핸들러에서 최신 값 참조)
  useEffect(() => { pendingFilesRef.current = pendingFiles; }, [pendingFiles]);

  // 컴포넌트 언마운트 시 생성된 blob URL 일괄 해제 (메모리 누수 방지)
  useEffect(() => () => {
    pendingFilesRef.current.forEach((pf) => {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    });
  }, []);

  // 최초 마운트 시 교육 목록 자동 조회
  useEffect(() => { loadList(); }, [loadList]);

  // ── 클라이언트 사이드 필터링 (API 재호출 없이 로컬 처리) ─────
  const filteredRows = rows.filter((row) => {
    if (filterLarge && Number(row.large_type) !== filterLarge) return false;
    if (filterText.trim()) {
      const keyword = filterText.trim().toLowerCase();
      const title = String(row.title || "").toLowerCase();
      const writer = `${row.user_name || ""}${row.position_name ? ` ${row.position_name}` : ""}`.toLowerCase();
      if (!title.includes(keyword) && !writer.includes(keyword)) return false;
    }
    return true;
  });

  // ── 상세 화면 열기 ───────────────────────────────────────────
  const openDetail = useCallback(async (idx) => {
    const data = await loadDetail(idx);
    if (!data) {
      Swal.fire({ title: "오류", text: "상세 정보를 불러오지 못했습니다.", icon: "error" });
      return;
    }
    window.history.pushState({ education: "detail" }, "");
    setView("detail");
  }, [loadDetail]);

  // 대시보드에서 특정 교육 idx를 state로 전달받은 경우 상세 자동 진입
  useEffect(() => {
    const educationIdx = location.state?.educationIdx;
    if (!educationIdx) return;
    openDetail(educationIdx);
    window.history.replaceState({}, "");
  }, [location.state, openDetail]);

  // ── 작성·수정 폼 열기 ────────────────────────────────────────
  const openWrite = useCallback((existing = null) => {
    pendingFilesRef.current.forEach((pf) => {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    });
    setPendingFiles([]);
    setDeletedFileOrders(new Set());
    if (!existing) clearEducationFiles();
    if (existing) {
      setEditIdx(existing.idx ?? null);
      setFormTitle(existing.title || "");
      setFormContent(existing.content || "");
      setFormLargeType(Number(existing.large_type) || 0);
    } else {
      setEditIdx(null);
      setFormTitle("");
      setFormContent("");
      setFormLargeType(0);
    }
    window.history.pushState({ education: "write" }, "");
    setView("write");
  }, [clearEducationFiles]);

  // ── 목록 화면 복귀 및 재조회 ─────────────────────────────────
  const goList = useCallback(() => {
    setView("list");
    loadList();
  }, [loadList]);

  // ── 브라우저 뒤로가기 처리 ───────────────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      if (view === "write") {
        if (editIdx) { setView("detail"); } else { setView("list"); loadList(); }
      } else if (view === "detail") {
        setView("list");
        loadList();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view, editIdx, loadList]);

  // ── 저장 처리 (유효성 검사 → API → 첨부파일 동기화) ─────────
  const handleSave = async () => {
    if (!formLargeType) {
      Swal.fire({ title: "확인", text: "분류를 선택해주세요.", icon: "warning" });
      return;
    }
    if (!formTitle.trim()) {
      Swal.fire({ title: "확인", text: "제목을 입력해주세요.", icon: "warning" });
      return;
    }
    if (!formContent.trim()) {
      Swal.fire({ title: "확인", text: "내용을 입력해주세요.", icon: "warning" });
      return;
    }
    const confirm = await Swal.fire({
      title: editIdx ? "수정하시겠습니까?" : "등록하시겠습니까?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: editIdx ? "수정" : "등록",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    const result = await saveEducation({
      editIdx,
      title: formTitle.trim(),
      content: formContent.trim(),
      largeType: formLargeType,
      userId: loginUserId,
    });
    if (!result?.ok) {
      Swal.fire({ title: "실패", text: "저장 중 오류가 발생했습니다.", icon: "error" });
      return;
    }
    // 첨부파일 변경사항이 있을 때만 동기화
    if ((pendingFiles.length > 0 || deletedFileOrders.size > 0) && result.idx) {
      await syncEducationFiles({
        educationIdx: result.idx,
        pendingFiles,
        deletedFileOrders,
        existingFiles: educationFiles,
      });
    }
    await Swal.fire({
      title: "저장",
      text: editIdx ? "수정되었습니다." : "등록되었습니다.",
      icon: "success",
      confirmButtonText: "확인",
    });
    goList();
  };

  // ── 삭제 처리 ────────────────────────────────────────────────
  const handleDelete = async (idx) => {
    const result = await Swal.fire({
      title: "삭제하시겠습니까?",
      text: "삭제 후 복구할 수 없습니다.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
      confirmButtonColor: "#d32f2f",
    });
    if (!result.isConfirmed) return;
    const ok = await deleteEducation({ idx, userId: loginUserId });
    if (!ok) {
      Swal.fire({ title: "실패", text: "삭제 중 오류가 발생했습니다.", icon: "error" });
      return;
    }
    await Swal.fire({ title: "삭제", text: "삭제되었습니다.", icon: "success", confirmButtonText: "확인" });
    goList();
  };

  // ── 첨부파일 선택 (최대 개수 초과 방지) ─────────────────────
  const handleSelectFiles = useCallback((fileList) => {
    const existingCount = (educationFiles.length - deletedFileOrders.size) + pendingFiles.length;
    const available = MAX_FILES - existingCount;
    if (available <= 0) {
      Swal.fire("첨부 파일은 최대 10개까지 등록 가능합니다.", "", "warning");
      return;
    }
    const files = Array.from(fileList || []).slice(0, available);
    const newPending = files.map((f) => ({
      file: f,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
  }, [educationFiles, deletedFileOrders, pendingFiles]);

  // 작성 화면 전체에서 드롭한 파일을 첨부파일 목록에 추가하는 함수
  const handleDropFiles = useCallback((e) => {
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes("Files");
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.files?.length) return;
    handleSelectFiles(e.dataTransfer.files);
  }, [handleSelectFiles]);

  // 브라우저가 드롭 파일을 직접 열지 않도록 작성 화면 드래그 동작을 처리하는 함수
  const handleDragOverFiles = useCallback((e) => {
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes("Files");
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  // 신규 선택 파일 제거 (blob URL 해제 포함)
  const handleRemovePending = useCallback((index) => {
    setPendingFiles((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      if (removed[0]?.previewUrl) URL.revokeObjectURL(removed[0].previewUrl);
      return next;
    });
  }, []);

  // 기존 파일 삭제 예약 토글 (재클릭 시 복원)
  const handleToggleDeleteFile = useCallback((imageOrder) => {
    setDeletedFileOrders((prev) => {
      const next = new Set(prev);
      if (next.has(imageOrder)) next.delete(imageOrder);
      else next.add(imageOrder);
      return next;
    });
  }, []);

  // ── 상세 뷰 미리보기 목록 ────────────────────────────────────
  const detailPreviewList = useMemo(() =>
    educationFiles
      .map((f) => ({
        key: `saved-${f.image_order}`,
        url: `${API_BASE_URL}${f.image_path}`,
        name: f.image_name || "",
        kind: getFileKind(f.image_name),
      }))
      .filter((f) => ["image", "pdf", "excel"].includes(f.kind) && !!f.url),
    [educationFiles]
  );

  // ── 작성 뷰 미리보기 목록 (삭제 예약 제외 + 신규 파일 합산) ──
  const writePreviewList = useMemo(() => {
    const saved = educationFiles
      .filter((f) => !deletedFileOrders.has(Number(f.image_order)))
      .map((f) => ({
        key: `saved-${f.image_order}`,
        url: `${API_BASE_URL}${f.image_path}`,
        name: f.image_name || "",
        kind: getFileKind(f.image_name),
      }))
      .filter((f) => ["image", "pdf", "excel"].includes(f.kind));
    const pending = pendingFiles
      .map((pf, i) => ({
        key: `pending-${i}`,
        url: pf.previewUrl || "",
        name: pf.name,
        kind: getFileKind(pf.name),
      }))
      .filter((f) => ["image", "pdf", "excel"].includes(f.kind) && !!f.url);
    return [...saved, ...pending];
  }, [educationFiles, deletedFileOrders, pendingFiles]);

  // 미리보기 오버레이 열기
  const openPreview = useCallback((key, list) => {
    if (!list.length) return;
    const idx = list.findIndex((f) => f.key === key);
    setPreviewList(list);
    setPreviewIndex(idx >= 0 ? idx : 0);
    setPreviewOpen(true);
  }, []);

  // ── 화면 렌더링 분기 ──────────────────────────────────────────
  const renderContent = () => {
    if (loading || detailLoading) return <LoadingScreen />;

    // ──────────────────────────────────────────────────────────
    // 목록 뷰: 버튼/필터 고정 + 테이블 스크롤
    // ──────────────────────────────────────────────────────────
    if (view === "list") {
      return (
        <MDBox sx={{ display: "flex", flexDirection: "column", height: "100%", ...selectableAreaSx }}>
          {/* 고정 필터+버튼 영역 */}
          <MDBox
            pt={1} pb={1} px={1}
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", flexShrink: 0, borderBottom: "1px solid #e8ecf0", background: "#fff" }}
          >
            {/* 좌측: 분류 필터 + 건수 */}
            <MDBox sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <select
                value={filterLarge}
                onChange={(e) => setFilterLarge(Number(e.target.value))}
                style={filterSelectSx}
              >
                <option value={0}>전체 분류</option>
                {LARGE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                {filteredRows.length}건
              </span>
            </MDBox>
            {/* 우측: 검색·새로고침·글작성 */}
            <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="검색어를 입력해주세요."
                style={{ ...filterSelectSx, minWidth: isMobile ? 120 : 160, paddingRight: 10 }}
              />
              <MDButton variant="gradient" color="info" onClick={loadList} sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 70 : 90 }}>
                새로고침
              </MDButton>
              {canWrite && (
                <MDButton variant="gradient" color="success" onClick={() => openWrite(null)} sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 70 : 90 }}>
                  글작성
                </MDButton>
              )}
            </MDBox>
          </MDBox>

          {/* 스크롤 내용 영역 */}
          <MDBox sx={{ flex: 1, overflowY: "auto" }}>
            <MDBox sx={sheetWrapSx(isMobile)}>
              <MDBox sx={sectionTitleSx}>목록</MDBox>
              <MDBox sx={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 50 }} />
                    <col style={{ width: isMobile ? 120 : 160 }} />
                    <col />
                    <col style={{ width: isMobile ? 115 : 150 }} />
                    <col style={{ width: isMobile ? 140 : 165 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ ...th2Cell, height: 38 }}>번호</th>
                      <th style={{ ...th2Cell, height: 38 }}>분류</th>
                      <th style={{ ...th2Cell, height: 38 }}>제목</th>
                      <th style={{ ...th2Cell, height: 38 }}>작성자</th>
                      <th style={{ ...th2Cell, height: 38 }}>작성일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td style={{ ...td2CellCenter, padding: "16px" }} colSpan={5}>
                          교육 자료가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, i) => {
                        const rowIdx = row.idx ?? i + 1;
                        const writer = row.user_name
                          ? `${row.user_name}${row.position_name ? ` ${row.position_name}` : ""}`
                          : "-";
                        const fileCnt = Number(row.file_cnt) || 0;
                        return (
                          <tr key={`${rowIdx}-${i}`} onClick={() => openDetail(rowIdx)} style={{ cursor: "pointer" }}>
                            <td style={{ ...td2CellCenter, height: 44 }}>{rowIdx}</td>
                            <td style={{ ...td2CellCenter, height: 44 }}>{row.large_type_nm || "-"}</td>
                            <td style={{ ...td2CellLeft, height: 44, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                  {row.title || "-"}
                                </span>
                                {/* 첨부파일 있을 때 클립 아이콘 + 개수 표시 */}
                                {fileCnt > 0 && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0, color: "#1976d2", fontSize: 11, fontWeight: 700 }}>
                                    <Paperclip size={12} />
                                    {`첨부파일 ${fileCnt}개`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ ...td2CellCenter, height: 44 }}>{writer}</td>
                            <td style={{ ...td2CellCenter, height: 44 }}>{row.reg_dt || "-"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </MDBox>
            </MDBox>
          </MDBox>
        </MDBox>
      );
    }

    // ──────────────────────────────────────────────────────────
    // 상세 뷰: 버튼 고정 + 내용 스크롤
    // - 작성자 본인(canWrite + user_id 일치)에게만 수정·삭제 버튼 노출
    // ──────────────────────────────────────────────────────────
    if (view === "detail") {
      const detailIdx = detail?.idx ?? null;
      return (
        <MDBox sx={{ display: "flex", flexDirection: "column", height: "100%", ...selectableAreaSx }}>
          {/* 고정 버튼 영역 */}
          <MDBox
            pt={1} pb={1} px={1}
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", flexShrink: 0, borderBottom: "1px solid #e8ecf0", background: "#fff" }}
          >
            <MDButton variant="outlined" color="secondary" onClick={goList} sx={{ fontSize: isMobile ? 11 : 13 }}>
              ← 목록으로
            </MDButton>
            {/* 작성자 본인에게만 수정·삭제 버튼 표시 */}
            {canWrite && detail?.user_id === loginUserId && (
              <MDBox sx={{ display: "flex", gap: 1 }}>
                <MDButton variant="gradient" color="error" onClick={() => handleDelete(detailIdx)} sx={{ fontSize: isMobile ? 11 : 13 }}>
                  삭제
                </MDButton>
                <MDButton variant="gradient" color="info" onClick={() => openWrite(detail)} sx={{ fontSize: isMobile ? 11 : 13 }}>
                  수정
                </MDButton>
              </MDBox>
            )}
          </MDBox>

          {/* 스크롤 내용 영역 */}
          <MDBox sx={{ flex: 1, overflowY: "auto" }}>
            {/* 교육 기본 정보 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={noticeHeaderBarSx}>
                <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <img src={logo} alt="logo" style={{ height: isMobile ? 22 : 28 }} />
                </MDBox>
                <MDBox sx={noticeTitleSx(isMobile)}>교육 자료</MDBox>
                <MDBox sx={{ width: isMobile ? 90 : 110 }} />
              </MDBox>
              <MDBox sx={sectionTitleSx}>교육 정보</MDBox>
              <table style={summaryTableSx}>
                <colgroup>
                  <col style={{ width: isMobile ? 68 : 85 }} />
                  <col />
                  <col style={{ width: isMobile ? 68 : 85 }} />
                  <col />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={thCell}>분류</td>
                    <td style={tdCell} colSpan={3}>{detail?.large_type_nm || "-"}</td>
                  </tr>
                  <tr>
                    <td style={thCell}>제목</td>
                    <td style={tdCell} colSpan={3}>{detail?.title || "-"}</td>
                  </tr>
                  <tr>
                    <td style={thCell}>작성자</td>
                    <td style={tdCell}>
                      {detail?.user_name
                        ? `${detail.user_name}${detail.position_name ? ` ${detail.position_name}` : ""}`
                        : "-"}
                    </td>
                    <td style={thCell}>작성일</td>
                    <td style={tdCell}>{detail?.reg_dt || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </MDBox>

            {/* 교육 본문 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={sectionTitleSx}>문서 내용</MDBox>
              <MDBox sx={{ p: 2, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: 120, background: "#fff", wordBreak: "break-word", userSelect: "text" }}>
                {detail?.content || <span style={{ opacity: 0.5 }}>내용이 없습니다.</span>}
              </MDBox>
            </MDBox>

            {/* 첨부파일 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={sectionTitleSx}>첨부파일</MDBox>
              <MDBox sx={{ p: "10px 12px", display: "flex", flexDirection: "column", gap: 1 }}>
                <MDBox sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                  <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12 }}>첨부파일 목록</MDBox>
                  <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12, ml: 0.5 }}>({educationFiles.length}/10)</MDBox>
                </MDBox>
                {educationFiles.length === 0 ? (
                  <MDBox component="span" sx={{ fontSize: 11, color: "#8a93a3" }}>첨부된 파일이 없습니다.</MDBox>
                ) : (
                  <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {educationFiles.map((f) => {
                      const kind = getFileKind(f.image_name);
                      const canPreview = kind === "image" || kind === "pdf" || kind === "excel";
                      const previewKey = `saved-${f.image_order}`;
                      const fileUrl = `${API_BASE_URL}${f.image_path}`;
                      const fileViewUrl = toHeadOfficeDocumentViewUrl(fileUrl);
                      const fileName = f.image_name || "-";
                      const thumbLabel = kind === "pdf" ? "PDF" : kind === "excel" ? "XLSX" : getFileExtLabel(f.image_name);
                      return (
                        <MDBox key={`ef-${f.image_order}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, border: "1px solid #d7dce3", borderRadius: "6px", px: 1, py: 0.5, backgroundColor: "#fafbfc" }}>
                          {/* 파일 썸네일 */}
                          <MDBox sx={attachmentThumbBoxSx}>
                            {kind === "image" ? (
                              canPreview ? (
                                <MDBox component="button" type="button" onClick={() => openPreview(previewKey, detailPreviewList)} sx={{ border: "none", background: "none", p: 0, width: "100%", height: "100%", cursor: "pointer" }}>
                                  <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </MDBox>
                              ) : (
                                <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              )
                            ) : kind === "pdf" ? (
                              <MDBox component={canPreview ? "button" : "span"} type={canPreview ? "button" : undefined} onClick={canPreview ? () => openPreview(previewKey, detailPreviewList) : undefined} sx={{ ...pdfThumbButtonSx, cursor: canPreview ? "pointer" : "default" }}>
                                <MDBox component="iframe" title={`pdf-thumb-saved-${f.image_order}`} src={toPdfThumbSrc(fileViewUrl)} loading="lazy" sx={pdfThumbFrameSx} />
                                <MDBox component="span" sx={pdfThumbLabelSx}>PDF</MDBox>
                              </MDBox>
                            ) : canPreview ? (
                              <MDBox component="button" type="button" onClick={() => openPreview(previewKey, detailPreviewList)} sx={{ border: "none", width: "100%", height: "100%", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#2e7d32", backgroundColor: "#e8f5e9" }}>
                                {thumbLabel}
                              </MDBox>
                            ) : (
                              <MDBox component="span" sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1f4e79", backgroundColor: "#edf4ff" }}>
                                {thumbLabel}
                              </MDBox>
                            )}
                          </MDBox>
                          {/* 파일명 */}
                          {canPreview ? (
                            <button type="button" onClick={() => openPreview(previewKey, detailPreviewList)} style={{ border: "none", background: "none", padding: 0, fontSize: "12px", color: "#1f4e79", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", cursor: "pointer" }}>
                              {fileName}
                            </button>
                          ) : (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1f4e79", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
                              {fileName}
                            </a>
                          )}
                          {/* 다운로드 버튼 */}
                          <IconButton size="small" component="a" href={fileUrl} download target="_blank" rel="noopener noreferrer" sx={{ width: 30, height: 30, borderRadius: "8px", border: "1px solid #c7d2e6", backgroundColor: "#f5f8ff", color: "#1f4e79", mr: 1, "&:hover": { backgroundColor: "#eaf2ff", borderColor: "#95afd6" } }}>
                            <Download size={17} />
                          </IconButton>
                        </MDBox>
                      );
                    })}
                  </MDBox>
                )}
              </MDBox>
            </MDBox>

            <PreviewOverlay
              open={previewOpen}
              files={previewList}
              currentIndex={previewIndex}
              onChangeIndex={setPreviewIndex}
              onClose={() => setPreviewOpen(false)}
            />
          </MDBox>
        </MDBox>
      );
    }

    // ──────────────────────────────────────────────────────────
    // 작성·수정 뷰: 버튼 고정 + 폼 내용 스크롤
    // ──────────────────────────────────────────────────────────
    if (view === "write") {
      return (
        <MDBox
          onDragOver={handleDragOverFiles}
          onDrop={handleDropFiles}
          sx={{ display: "flex", flexDirection: "column", height: "100%", ...selectableAreaSx }}
        >
          {/* 고정 버튼 영역 */}
          <MDBox
            pt={1} pb={1} px={1}
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexShrink: 0, borderBottom: "1px solid #e8ecf0", background: "#fff" }}
          >
            <MDButton variant="outlined" color="secondary" onClick={() => (editIdx ? setView("detail") : goList())} sx={{ fontSize: isMobile ? 11 : 13 }}>
              ← 취소 후 목록으로 이동
            </MDButton>
            <MDButton variant="gradient" color="success" onClick={handleSave} disabled={saving} sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 80 : 100 }}>
              {saving ? "저장중..." : "저장"}
            </MDButton>
          </MDBox>

          {/* 스크롤 내용 영역 */}
          <MDBox sx={{ flex: 1, overflowY: "auto" }}>
            {/* 교육 정보 입력 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={sectionTitleSx}>교육 정보</MDBox>
              <table style={summaryTableSx}>
                <colgroup>
                  <col style={{ width: isMobile ? 68 : 85 }} />
                  <col />
                </colgroup>
                <tbody>
                  {/* 분류 선택 */}
                  <tr>
                    <td style={thCell}>분류</td>
                    <td style={writeTdCell}>
                      <TextField
                        select fullWidth size="small"
                        value={formLargeType || ""}
                        onChange={(e) => setFormLargeType(Number(e.target.value))}
                        SelectProps={{ native: true }}
                        inputProps={{ style: { fontSize: isMobile ? 11 : 13 } }}
                        sx={formTextFieldSx}
                      >
                        <option value="">선택</option>
                        {LARGE_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </TextField>
                    </td>
                  </tr>
                  {/* 제목 입력 */}
                  <tr>
                    <td style={thCell}>제목</td>
                    <td style={writeTdCell}>
                      <TextField
                        fullWidth size="small"
                        placeholder="제목을 입력하세요"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        inputProps={{ style: { fontSize: isMobile ? 11 : 13 } }}
                        sx={formTextFieldSx}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </MDBox>

            {/* 본문 입력 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={sectionTitleSx}>문서 내용</MDBox>
              <MDBox sx={{ p: 1 }}>
                <TextField
                  fullWidth multiline minRows={10} size="small"
                  placeholder="내용을 입력하세요"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  inputProps={{ style: { fontSize: 13, lineHeight: 1.7 } }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, "& fieldset": { borderColor: "#cfd8e3" } } }}
                />
              </MDBox>
            </MDBox>

            {/* 첨부파일 입력 */}
            <MDBox sx={{ ...sheetWrapSx(isMobile), mb: 2 }}>
              <MDBox sx={sectionTitleSx}>첨부파일</MDBox>
              <MDBox sx={{ p: "10px 12px", display: "flex", flexDirection: "column", gap: 1 }}>
                {/* 헤더: 카운트 + 파일선택 버튼 */}
                <MDBox sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <MDBox sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12 }}>첨부파일 목록</MDBox>
                    <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12, ml: 0.5 }}>
                      ({(educationFiles.length - deletedFileOrders.size) + pendingFiles.length}/{MAX_FILES})
                    </MDBox>
                  </MDBox>
                  <MDButton variant="outlined" color="info" size="small" onClick={() => fileInputRef.current?.click()} sx={{ fontSize: 11, py: 0.3, px: 1.2 }}>
                    파일 선택
                  </MDButton>
                  {/* 숨겨진 파일 input */}
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { handleSelectFiles(e.target.files); e.target.value = ""; }} />
                </MDBox>

                {/* 기존 파일 목록 (수정 모드, 삭제 예약 시 흐리게) */}
                {educationFiles.length > 0 && (
                  <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {educationFiles.map((f) => {
                      const isDeleted = deletedFileOrders.has(Number(f.image_order));
                      const kind = getFileKind(f.image_name);
                      const canPreview = (kind === "image" || kind === "pdf" || kind === "excel") && !isDeleted;
                      const previewKey = `saved-${f.image_order}`;
                      const fileUrl = `${API_BASE_URL}${f.image_path}`;
                      const fileViewUrl = toHeadOfficeDocumentViewUrl(fileUrl);
                      const fileName = f.image_name || "-";
                      const thumbLabel = kind === "pdf" ? "PDF" : kind === "excel" ? "XLSX" : getFileExtLabel(f.image_name);
                      return (
                        <MDBox key={`ef-${f.image_order}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, border: "1px solid #d7dce3", borderRadius: "6px", px: 1, py: 0.5, backgroundColor: "#fafbfc", opacity: isDeleted ? 0.45 : 1, filter: isDeleted ? "blur(1px)" : "none" }}>
                          <MDBox sx={attachmentThumbBoxSx}>
                            {kind === "image" ? (
                              canPreview ? (
                                <MDBox component="button" type="button" onClick={() => openPreview(previewKey, writePreviewList)} sx={{ border: "none", background: "none", p: 0, width: "100%", height: "100%", cursor: "pointer" }}>
                                  <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </MDBox>
                              ) : (
                                <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              )
                            ) : kind === "pdf" ? (
                              <MDBox component={canPreview ? "button" : "span"} type={canPreview ? "button" : undefined} onClick={canPreview ? () => openPreview(previewKey, writePreviewList) : undefined} sx={{ ...pdfThumbButtonSx, cursor: canPreview ? "pointer" : "default" }}>
                                <MDBox component="iframe" title={`pdf-thumb-saved-${f.image_order}`} src={toPdfThumbSrc(fileViewUrl)} loading="lazy" sx={pdfThumbFrameSx} />
                                <MDBox component="span" sx={pdfThumbLabelSx}>PDF</MDBox>
                              </MDBox>
                            ) : canPreview ? (
                              <MDBox component="button" type="button" onClick={() => openPreview(previewKey, writePreviewList)} sx={{ border: "none", width: "100%", height: "100%", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#2e7d32", backgroundColor: "#e8f5e9" }}>
                                {thumbLabel}
                              </MDBox>
                            ) : (
                              <MDBox component="span" sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1f4e79", backgroundColor: "#edf4ff" }}>
                                {thumbLabel}
                              </MDBox>
                            )}
                          </MDBox>
                          {/* 삭제 예약 상태면 일반 텍스트 */}
                          {isDeleted ? (
                            <MDBox component="span" sx={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{fileName}</MDBox>
                          ) : canPreview ? (
                            <button type="button" onClick={() => openPreview(previewKey, writePreviewList)} style={{ border: "none", background: "none", padding: 0, fontSize: "12px", color: "#1f4e79", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", cursor: "pointer" }}>
                              {fileName}
                            </button>
                          ) : (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1f4e79", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
                              {fileName}
                            </a>
                          )}
                          <MDBox sx={{ display: "inline-flex", alignItems: "center", gap: "4px", mr: 1 }}>
                            <IconButton size="small" component="a" href={fileUrl} download target="_blank" rel="noopener noreferrer" sx={{ width: 30, height: 30, borderRadius: "8px", border: "1px solid #c7d2e6", backgroundColor: "#f5f8ff", color: "#1f4e79", "&:hover": { backgroundColor: "#eaf2ff", borderColor: "#95afd6" } }}>
                              <Download size={17} />
                            </IconButton>
                            {/* 삭제 예약/복원 토글 */}
                            <IconButton size="small" color={isDeleted ? "warning" : "error"} onClick={() => handleToggleDeleteFile(Number(f.image_order))} sx={{ width: 30, height: 30, borderRadius: "8px", border: "1px solid #e2b4b4", backgroundColor: isDeleted ? "#fff4e5" : "#fff1f1", "&:hover": { backgroundColor: isDeleted ? "#ffe8c2" : "#ffe3e3" } }}>
                              {isDeleted ? <RotateCcw size={17} /> : <Trash2 size={17} />}
                            </IconButton>
                          </MDBox>
                        </MDBox>
                      );
                    })}
                  </MDBox>
                )}

                {/* 신규 선택 파일 목록 (연두색 배경으로 기존 파일과 구분) */}
                {pendingFiles.length > 0 && (
                  <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {pendingFiles.map((pf, i) => {
                      const kind = getFileKind(pf.name);
                      const canPreview = (kind === "image" || kind === "pdf" || kind === "excel") && !!pf.previewUrl;
                      const previewKey = `pending-${i}`;
                      const pendingFileName = pf.name || "-";
                      const pendingExtLabel = getFileExtLabel(pf.name);
                      return (
                        <MDBox key={`pf-${i}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, border: "1px solid #d6ead3", borderRadius: "6px", px: 1, py: 0.5, backgroundColor: "#f6fff3" }}>
                          <MDBox sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1 }}>
                            <MDBox sx={attachmentThumbBoxSx}>
                              {kind === "image" && pf.previewUrl ? (
                                <MDBox component="button" type="button" onClick={() => openPreview(previewKey, writePreviewList)} sx={{ border: "none", background: "none", width: "100%", height: "100%", p: 0, cursor: "pointer" }}>
                                  <MDBox component="img" src={pf.previewUrl} alt={pendingFileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </MDBox>
                              ) : kind === "pdf" && pf.previewUrl ? (
                                <MDBox component="button" type="button" onClick={() => openPreview(previewKey, writePreviewList)} sx={{ ...pdfThumbButtonSx, cursor: "pointer" }}>
                                  <MDBox component="iframe" title={`pdf-thumb-pending-${i}`} src={toPdfThumbSrc(pf.previewUrl)} loading="lazy" sx={pdfThumbFrameSx} />
                                  <MDBox component="span" sx={pdfThumbLabelSx}>PDF</MDBox>
                                </MDBox>
                              ) : canPreview ? (
                                <MDBox component="button" type="button" onClick={() => openPreview(previewKey, writePreviewList)} sx={{ border: "none", width: "100%", height: "100%", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#2e7d32", backgroundColor: "#e8f5e9" }}>
                                  {kind === "excel" ? "XLSX" : pendingExtLabel}
                                </MDBox>
                              ) : (
                                <MDBox component="span" sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1f4e79", backgroundColor: "#edf4ff" }}>
                                  {pendingExtLabel}
                                </MDBox>
                              )}
                            </MDBox>
                            {canPreview ? (
                              <button type="button" onClick={() => openPreview(previewKey, writePreviewList)} style={{ border: "none", background: "none", padding: 0, fontSize: "12px", textDecoration: "underline", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", color: "#1f4e79" }}>
                                {pendingFileName}
                              </button>
                            ) : (
                              <a href={pf.previewUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 0, fontSize: "12px", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", color: "#1f4e79" }}>
                                {pendingFileName}
                              </a>
                            )}
                          </MDBox>
                          {/* 신규 파일 제거 버튼 */}
                          <IconButton size="small" color="error" onClick={() => handleRemovePending(i)} sx={{ width: 30, height: 30, borderRadius: "8px", border: "1px solid #e2b4b4", backgroundColor: "#fff1f1", mr: 1, "&:hover": { backgroundColor: "#ffe3e3" } }}>
                            <Trash2 size={17} />
                          </IconButton>
                        </MDBox>
                      );
                    })}
                  </MDBox>
                )}

                {educationFiles.length === 0 && pendingFiles.length === 0 && (
                  <MDBox component="span" sx={{ fontSize: 11, color: "#8a93a3" }}>첨부된 파일이 없습니다. (모든 형식, 최대 10개)</MDBox>
                )}
              </MDBox>
            </MDBox>

            <PreviewOverlay
              open={previewOpen}
              files={previewList}
              currentIndex={previewIndex}
              onChangeIndex={setPreviewIndex}
              onClose={() => setPreviewOpen(false)}
            />
          </MDBox>
        </MDBox>
      );
    }

    return null;
  };

  return (
    <DashboardLayout>
      <DashboardNavbar title="📚 본사 교육" />
      {/* 전체를 flex column으로 감싸서 버튼 고정 + 내용 스크롤 구조 */}
      <MDBox sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", overflow: "hidden" }}>
        {renderContent()}
      </MDBox>
    </DashboardLayout>
  );
}

export default Education;

// ── 스타일 상수 정의 ──────────────────────────────────────────

// 섹션 카드 래퍼 스타일 (반응형 폰트 포함)
const sheetWrapSx = (isMobile) => ({
  border: "1px solid #cfd8e3",
  borderRadius: 2,
  overflow: "hidden",
  background: "#fff",
  mx: 1,
  mb: 2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  fontSize: isMobile ? 11 : 12,
});

// 섹션 제목 헤더 스타일
const sectionTitleSx = {
  background: "#e9f0fb",
  borderBottom: "1px solid #cfd8e3",
  padding: "4px 6px",
  fontWeight: 800,
  color: "#1f4e79",
};

// 상세 테이블 헤더 셀
const thCell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "4px 5px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

// 상세 테이블 데이터 셀
const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "4px 8px",
  background: "#fff",
};

// 목록 테이블 헤더 셀
const th2Cell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "4px 5px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

// 목록 테이블 데이터 셀 (가운데 정렬)
const td2CellCenter = {
  border: "1px solid #cfd8e3",
  padding: "4px 5px",
  textAlign: "center",
  verticalAlign: "middle",
  background: "#fff",
};

// 목록 테이블 데이터 셀 (좌측 정렬, 제목 컬럼)
const td2CellLeft = {
  ...td2CellCenter,
  textAlign: "left",
  padding: "4px 8px",
};

// 요약 정보 테이블 공통 스타일
const summaryTableSx = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

// 필터 바 select/input 스타일 (높이 36px 통일)
const filterSelectSx = {
  border: "1px solid #cfd8e3",
  borderRadius: 4,
  padding: "0 10px",
  fontSize: 12,
  background: "#fff",
  outline: "none",
  cursor: "pointer",
  minWidth: 140,
  height: 36,
  boxSizing: "border-box",
};

// 작성 폼 입력 셀
const writeTdCell = {
  border: "1px solid #cfd8e3",
  padding: "3px 6px",
  background: "#fff",
  verticalAlign: "middle",
};

// 작성 폼 TextField 공통 스타일
const formTextFieldSx = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { border: "none" },
  },
  "& .MuiInputBase-input": {
    fontSize: 13,
    padding: "4px 6px",
  },
  "& .MuiInputBase-input::placeholder": {
    fontSize: 13,
    opacity: 0.55,
  },
};

// 첨부파일 썸네일 박스 스타일
const attachmentThumbBoxSx = {
  width: 62,
  height: 92,
  borderRadius: "6px",
  overflow: "hidden",
  flexShrink: 0,
  border: "1px solid #d0d7e2",
  backgroundColor: "#f1f4f8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// 전역 선택 제한을 덮어 화면 텍스트를 드래그로 선택할 수 있게 하는 영역 스타일
const selectableAreaSx = {
  userSelect: "text",
  "& *": {
    userSelect: "text",
  },
};

// PDF 첨부파일을 스크롤 없는 썸네일 카드로 보여주는 공통 스타일
const pdfThumbButtonSx = {
  width: "100%",
  height: "100%",
  border: "none",
  p: 0,
  backgroundColor: "#fff",
  position: "relative",
};

const pdfThumbLabelSx = {
  position: "absolute",
  right: 4,
  bottom: 4,
  px: 0.5,
  py: 0.1,
  borderRadius: "4px",
  fontSize: 9,
  fontWeight: 800,
  color: "#fff",
  backgroundColor: "rgba(198, 40, 40, 0.9)",
  lineHeight: 1.2,
};

const pdfThumbFrameSx = {
  width: "100%",
  height: "100%",
  border: 0,
  pointerEvents: "none",
  backgroundColor: "#fff",
};

// PDF 썸네일용 iframe src 조립 (toolbar·스크롤바 숨김)
function toPdfThumbSrc(fileUrl) {
  const baseUrl = String(fileUrl ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

// 상세 뷰 로고 헤더 바 스타일
const noticeHeaderBarSx = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  alignItems: "center",
  background: "#1f4e79",
  padding: "4px 8px",
};

// 상세 뷰 헤더 타이틀 스타일
const noticeTitleSx = (isMobile) => ({
  textAlign: "center",
  color: "#fff",
  fontWeight: 800,
  letterSpacing: 1,
  fontSize: isMobile ? 15 : 19,
});

// 파일명 → 확장자 뱃지 레이블 추출 (JPEG → JPG 정규화)
function getFileExtLabel(fileName) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "FILE";
  const ext = name.substring(dot + 1).toUpperCase();
  if (ext === "JPEG") return "JPG";
  return ext || "FILE";
}

// 파일명 → PreviewOverlay kind 결정
function getFileKind(fileName) {
  const ext = String(fileName || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  return "file";
}
