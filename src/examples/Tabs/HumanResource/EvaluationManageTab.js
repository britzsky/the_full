// EvaluationManageTab.js
// 인사 KPI 평가문서 관리 탭
// 권한 정책
//   - 관리자: 전체 조회
//   - 실장: 전체 조회 및 실장 확인
//
// 확인 흐름
//   - 결재범위 기준으로 팀장, 실장, 인사팀장, 대표이사 확인 단계 표시
//   - 이전 확인 단계 완료 후 다음 확인 버튼 표시
//   - 결재범위에 없는 단계는 목록과 도장에서 제외

/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IconButton, useTheme, useMediaQuery } from "@mui/material";
import { Download } from "lucide-react";
import Swal from "sweetalert2";

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import PreviewOverlay from "utils/PreviewOverlay";
import logo from "assets/images/the-full-logo4.png";
import useEvaluationData from "./EvaluationManageTabData";

// 상수
// 화면 및 권한 계산에 사용하는 고정값

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";

const ADMIN_USER_IDS =
  ["bh4",       // 정병화 팀장님
    "britzsky",  // 손경원 팀장님
    "ceo"];      // 대표님
const HR_DEPARTMENT_CODE = "3";   // 인사팀
const HP_DEPARTMENT_CODE = "8";   // 실장 부서

const TYPE_LABELS = { 1: "총괄", 2: "인사", 3: "영업", 4: "개발", 5: "회계", 6: "운영", 7: "기획" };
const POSITION_LABELS = { 0: "대표이사", 1: "팀장", 2: "파트장", 3: "매니저" };


// 결재범위 기본값 계산 함수
const getApprovalPosition = (value) => {
  if (value == null || value === "") return 1;
  const n = Number(value);
  return Number.isNaN(n) ? 1 : n;
};

// 실적 입력값 100% 상한 처리 함수
const normalizePerformanceValue = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits === "") return "";
  return String(Math.min(Number(digits), 100));
};

export default function EvaluationManageTab({ onEditRequest, initialEvalIdx, onInitialEvalIdxConsumed }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 로그인 사용자 식별 정보
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || "").trim(), []);
  const loginUserName = useMemo(() => String(localStorage.getItem("user_name") || "").trim(), []);
  const loginPosition = useMemo(() => Number(localStorage.getItem("position") ?? 99), []);
  const loginDepartment = useMemo(() => String(localStorage.getItem("department") || "").trim(), []);

  // 로그인 사용자 권한 계산
  const isAdmin = useMemo(() => ADMIN_USER_IDS.includes(loginUserId), [loginUserId]);
  const isTeamLeader = useMemo(() => isAdmin || loginPosition === 1, [isAdmin, loginPosition]);
  const isHrLeader = useMemo(() => isTeamLeader && loginDepartment === HR_DEPARTMENT_CODE, [isTeamLeader, loginDepartment]);
  // 실장 권한 여부
  const isHpLeader = useMemo(() => (isAdmin || loginPosition === 1) && loginDepartment === HP_DEPARTMENT_CODE, [isAdmin, loginPosition, loginDepartment]);
  const isCeoLeader = useMemo(() => loginUserId === "ceo" || loginPosition === 0, [loginUserId, loginPosition]);
  // 평가문서 목록, 상세, 결재 처리 데이터 훅
  const {
    rows, loading, detail, detailLoading, saving, evaluationFiles,
    loadList, loadDetail, deleteEvaluation,
    confirmTeamLeader, confirmHpLeader, confirmHrLeader, confirmCeoLeader,
    updatePerformance, clearEvaluationFiles,
  } = useEvaluationData();

  // 화면 상태
  const [view, setView] = useState("list");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [filterText, setFilterText] = useState("");

  // 실적 입력 모드 상태
  const [performanceEditMode, setPerformanceEditMode] = useState(false);
  const [perfValues, setPerfValues] = useState({});

  // 결재 의견 입력 상태
  const [tmOpinionText, setTmOpinionText] = useState("");
  const [hpOpinionText, setHpOpinionText] = useState("");

  // 첨부파일 미리보기 상태
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 목록 조회 파라미터
  // 실장은 모든 팀의 평가문서 조회, position 1(팀장)은 같은 부서 전체 조회, position 2~3은 자신의 문서만 조회
  const listParams = useMemo(() => {
    if (isAdmin) return {};
    if (isHpLeader) return {};
    if (isTeamLeader) return { department: loginDepartment };
    return { user_id: loginUserId };
  }, [isAdmin, isHpLeader, isTeamLeader, loginDepartment, loginUserId]);

  // 권한별 조회 조건에 따른 목록 초기 조회
  useEffect(() => { loadList(listParams); }, [loadList, listParams]);

  // 외부에서 전달된 평가문서 번호 기준 상세 자동 진입
  useEffect(() => {
    if (!initialEvalIdx || loading) return;
    openDetail(initialEvalIdx);
    if (typeof onInitialEvalIdxConsumed === "function") onInitialEvalIdxConsumed();
  }, [initialEvalIdx, loading]);

  // 작성자명과 평가기간 기준 목록 검색 결과
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const kw = filterText.trim().toLowerCase();
    return rows.filter((r) => {
      const name = String(r.user_name || "").toLowerCase();
      const period = `${r.start_time || ""}~${r.end_time || ""}`;
      return name.includes(kw) || period.includes(kw);
    });
  }, [rows, filterText]);

  // 상세 열기
  const openDetail = useCallback(async (idx) => {
    setPreviewOpen(false);
    setSelectedIdx(idx);
    const data = await loadDetail(idx);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      Swal.fire({ title: "오류", text: "상세 정보를 불러오지 못했습니다.", icon: "error" });
      return;
    }
    window.history.pushState({ evalManage: "detail" }, "");
    setView("detail");
  }, [loadDetail]);

  // 목록으로 이동
  const goList = useCallback(() => {
    clearEvaluationFiles();
    setSelectedIdx(null);
    setView("list");
    setPerformanceEditMode(false);
    setPerfValues({});
    setTmOpinionText("");
    setHpOpinionText("");
    loadList(listParams);
  }, [clearEvaluationFiles, loadList, listParams]);

  // 실적 입력 시작
  const handleStartPerformanceEdit = useCallback(() => {
    const vals = {};
    (Array.isArray(detail) ? detail : []).forEach((item) => {
      vals[item.idx] = item.performance != null ? String(item.performance) : "";
    });
    setPerfValues(vals);
    setPerformanceEditMode(true);
  }, [detail]);

  // KPI 항목별 실적 저장
  const handleSavePerformance = async () => {
    const items = (Array.isArray(detail) ? detail : []).map((item) => ({
      idx: item.idx,
      performance: perfValues[item.idx] !== "" && perfValues[item.idx] != null
        ? Number(perfValues[item.idx]) : null,
    }));
    const res = await Swal.fire({
      title: "실적을 저장하시겠습니까?", icon: "question",
      showCancelButton: true, confirmButtonText: "저장", cancelButtonText: "취소",
      confirmButtonColor: "#1f4e79",
    });
    if (!res.isConfirmed) return;
    const ok = await updatePerformance({ items });
    if (!ok) { Swal.fire({ title: "실패", text: "실적 저장 중 오류가 발생했습니다.", icon: "error" }); return; }
    await loadDetail(selectedIdx);
    setPerformanceEditMode(false);
    setPerfValues({});
    Swal.fire({ title: "완료", text: "실적이 저장되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 브라우저 뒤로가기 시 상세 화면에서 목록 화면으로 전환
  useEffect(() => {
    const handlePop = () => { if (view === "detail") setView("list"); };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [view]);

  // 평가문서 삭제
  const handleDelete = async () => {
    if (!selectedIdx) return;
    const res = await Swal.fire({
      title: "삭제하시겠습니까?", text: "해당 평가기간의 모든 KPI 항목이 삭제됩니다.",
      icon: "warning", showCancelButton: true,
      confirmButtonText: "삭제", cancelButtonText: "취소", confirmButtonColor: "#d32f2f",
    });
    if (!res.isConfirmed) return;
    const ok = await deleteEvaluation({ idx: selectedIdx });
    if (!ok) { Swal.fire({ title: "실패", text: "삭제 중 오류가 발생했습니다.", icon: "error" }); return; }
    await Swal.fire({ title: "삭제", text: "삭제되었습니다.", icon: "success", confirmButtonText: "확인" });
    goList();
  };

  // 팀장 의견 저장 및 확인
  const handleTeamLeaderConfirm = async () => {
    if (!selectedIdx) return;
    const firstItem = detailItems[0] || {};
    if (!isAdmin && String(firstItem.writer_department) !== loginDepartment) {
      Swal.fire({ title: "권한 없음", text: "같은 부서의 평가만 확인할 수 있습니다.", icon: "warning" });
      return;
    }
    const res = await Swal.fire({
      title: "팀장 의견을 저장하시겠습니까?",
      text: "확인 처리 후에는 취소할 수 없습니다.",
      icon: "question", showCancelButton: true,
      confirmButtonText: "확인", cancelButtonText: "취소", confirmButtonColor: "#1f4e79",
    });
    if (!res.isConfirmed) return;
    const ok = await confirmTeamLeader({ idx: selectedIdx, userName: loginUserName || loginUserId, opinion: tmOpinionText });
    if (!ok) { Swal.fire({ title: "실패", text: "확인 처리 중 오류가 발생했습니다.", icon: "error" }); return; }
    await loadDetail(selectedIdx);
    setTmOpinionText("");
    Swal.fire({ title: "완료", text: "팀장 확인이 완료되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 실장 의견 저장 및 확인
  const handleHpLeaderConfirm = async () => {
    if (!selectedIdx) return;
    const res = await Swal.fire({
      title: "실장 의견을 저장하시겠습니까?",
      text: "확인 처리 후에는 취소할 수 없습니다.",
      icon: "question", showCancelButton: true,
      confirmButtonText: "확인", cancelButtonText: "취소", confirmButtonColor: "#6a1b9a",
    });
    if (!res.isConfirmed) return;
    const ok = await confirmHpLeader({ idx: selectedIdx, userName: loginUserName || loginUserId, opinion: hpOpinionText });
    if (!ok) { Swal.fire({ title: "실패", text: "확인 처리 중 오류가 발생했습니다.", icon: "error" }); return; }
    await loadDetail(selectedIdx);
    setHpOpinionText("");
    Swal.fire({ title: "완료", text: "실장 확인이 완료되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 인사팀장 확인
  const handleHrLeaderConfirm = async () => {
    if (!selectedIdx) return;
    const res = await Swal.fire({
      title: "확인하시겠습니까?", text: "확인 처리 후에는 취소할 수 없습니다.",
      icon: "question", showCancelButton: true,
      confirmButtonText: "확인", cancelButtonText: "취소", confirmButtonColor: "#1f4e79",
    });
    if (!res.isConfirmed) return;
    const ok = await confirmHrLeader({ idx: selectedIdx, userName: loginUserName || loginUserId });
    if (!ok) { Swal.fire({ title: "실패", text: "확인 처리 중 오류가 발생했습니다.", icon: "error" }); return; }
    await loadDetail(selectedIdx);
    Swal.fire({ title: "완료", text: "인사팀장 확인이 완료되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 대표이사 확인
  const handleCeoLeaderConfirm = async () => {
    if (!selectedIdx) return;
    const res = await Swal.fire({
      title: "확인하시겠습니까?", text: "확인 처리 후에는 취소할 수 없습니다.",
      icon: "question", showCancelButton: true,
      confirmButtonText: "확인", cancelButtonText: "취소", confirmButtonColor: "#1f4e79",
    });
    if (!res.isConfirmed) return;
    const ok = await confirmCeoLeader({ idx: selectedIdx, userName: loginUserName || loginUserId });
    if (!ok) { Swal.fire({ title: "실패", text: "확인 처리 중 오류가 발생했습니다.", icon: "error" }); return; }
    await loadDetail(selectedIdx);
    Swal.fire({ title: "완료", text: "대표이사 확인이 완료되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 상세 첨부파일 미리보기 대상 목록
  const detailPreviewList = useMemo(() =>
    evaluationFiles
      .map((f) => ({
        key: `saved-${f.image_order}`,
        url: `${API_BASE_URL}${f.image_path}`,
        name: f.image_name || "",
        kind: getFileKind(f.image_name),
      }))
      .filter((f) => ["image", "pdf", "excel"].includes(f.kind) && !!f.url),
    [evaluationFiles]
  );

  // 선택한 첨부파일 기준 미리보기 열기
  const openPreview = useCallback((key) => {
    if (!detailPreviewList.length) return;
    const idx = detailPreviewList.findIndex((f) => f.key === key);
    setPreviewList(detailPreviewList);
    setPreviewIndex(idx >= 0 ? idx : 0);
    setPreviewOpen(true);
  }, [detailPreviewList]);

  if (loading || detailLoading || saving) return <LoadingScreen />;


  // 목록 화면
  if (view === "list") {
    return (
      <MDBox sx={{ display: "flex", flexDirection: "column", height: "100%", ...selectableAreaSx }}>
        {/* 목록 검색 및 새로고침 영역 */}
        <MDBox sx={{ flexShrink: 0, pt: 1, pb: 1, px: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", background: "#fff" }}>
          <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <input type="text" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="작성자 검색" style={filterInputSx} />
            <span style={{ fontSize: 12, color: "#888" }}>{filteredRows.length}건</span>
          </MDBox>
          <MDButton variant="gradient" color="info" onClick={() => loadList(listParams)} sx={{ fontSize: isMobile ? 11 : 13 }}>
            새로고침
          </MDButton>
        </MDBox>

        <MDBox sx={{ flex: 1, overflowY: "auto" }}>
          <MDBox sx={sheetWrapSx(isMobile)}>
            <MDBox sx={sectionTitleSx}>평가 목록</MDBox>
            {/* 평가문서 목록 테이블 */}
            <MDBox sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 42 }} />
                  <col style={{ width: isMobile ? 150 : 190 }} />
                  <col style={{ width: isMobile ? 150 : 190 }} />
                  <col style={{ width: isMobile ? 100 : 130 }} />
                  <col style={{ width: isMobile ? 130 : 160 }} />
                  <col style={{ width: isMobile ? 45 : 55 }} />
                  <col style={{ width: isMobile ? 110 : 140 }} />
                  <col style={{ width: isMobile ? 110 : 140 }} />
                  <col style={{ width: isMobile ? 110 : 140 }} />
                  <col style={{ width: isMobile ? 110 : 140 }} />
                  <col style={{ width: isMobile ? 120 : 150 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...th2Cell, height: 36 }}>번호</th>
                    <th style={{ ...th2Cell, height: 36 }}>문서번호</th>
                    <th style={{ ...th2Cell, height: 36 }}>문서명</th>
                    <th style={{ ...th2Cell, height: 36 }}>작성자</th>
                    <th style={{ ...th2Cell, height: 36 }}>평가기간</th>
                    <th style={{ ...th2Cell, height: 36 }}>KPI 수</th>
                    <th style={{ ...th2Cell, height: 36 }}>팀장</th>
                    <th style={{ ...th2Cell, height: 36 }}>실장</th>
                    <th style={{ ...th2Cell, height: 36 }}>인사팀장</th>
                    <th style={{ ...th2Cell, height: 36 }}>대표이사</th>
                    <th style={{ ...th2Cell, height: 36 }}>등록일시</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td style={{ ...td2CellCenter, padding: 16 }} colSpan={11}>평가 데이터가 없습니다.</td>
                    </tr>
                  ) : filteredRows.map((row, i) => {
                    // 목록 행별 결재범위 표시 여부
                    const rowDept = String(row.department || row.writer_department || "");
                    const rowApprovalPosition = getApprovalPosition(row.approval_position);
                    const needsTeam = rowApprovalPosition <= 3 && rowDept !== "8";
                    const needsHp = rowApprovalPosition <= 2;
                    const needsHr = rowApprovalPosition <= 1;
                    const needsCeo = rowApprovalPosition <= 0;
                    return (
                      <tr
                        key={`${row.idx}-${i}`}
                        onClick={() => openDetail(row.idx)}
                        style={listRowSx}

                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f4fa"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      >
                        <td style={td2CellCenter}>{i + 1}</td>
                        <td style={td2CellCenter}>{row.document_id || "-"}</td>
                        <td style={td2CellCenter}>{row.doc_name || "-"}</td>
                        <td style={td2CellCenter}>
                          {row.position != null && POSITION_LABELS[Number(row.position)]
                            ? `${row.user_name || "-"} ${POSITION_LABELS[Number(row.position)]}`
                            : row.user_name || "-"}
                        </td>
                        <td style={td2CellCenter}>
                          {row.start_time && row.end_time ? `${row.start_time.slice(0, 10)} ~ ${row.end_time.slice(0, 10)}` : "-"}
                        </td>
                        <td style={td2CellCenter}>{row.kpi_count ?? 1}건</td>
                        {/* 팀장 확인 상태 */}
                        <td style={td2CellCenter}>
                          {!needsTeam ? <span style={{ fontSize: 11, color: "#ccc" }}>-</span> : (
                            <div style={String(row.tm_sign || "") === "4" ? confirmCellConfirmedSx : confirmCellInnerSx}>
                              <ConfirmBadge confirmed={String(row.tm_sign || "") === "4"} />
                              {row.tm_dt && <div style={confirmDtSx}>{row.tm_dt}</div>}
                            </div>
                          )}
                        </td>
                        {/* 실장 확인 상태 */}
                        <td style={td2CellCenter}>
                          {!needsHp ? <span style={{ fontSize: 11, color: "#ccc" }}>-</span> : (
                            <div style={String(row.hp_sign || "") === "4" ? confirmCellConfirmedSx : confirmCellInnerSx}>
                              <ConfirmBadge confirmed={String(row.hp_sign || "") === "4"} />
                              {row.hp_dt && <div style={confirmDtSx}>{row.hp_dt}</div>}
                            </div>
                          )}
                        </td>
                        {/* 인사팀장 확인 상태 */}
                        <td style={td2CellCenter}>
                          {!needsHr ? <span style={{ fontSize: 11, color: "#ccc" }}>-</span> : (
                            <div style={String(row.hr_sign || "") === "4" ? confirmCellConfirmedSx : confirmCellInnerSx}>
                              <ConfirmBadge confirmed={String(row.hr_sign || "") === "4"} />
                              {row.hr_dt && <div style={confirmDtSx}>{row.hr_dt}</div>}
                            </div>
                          )}
                        </td>
                        {/* 대표이사 확인 상태 */}
                        <td style={td2CellCenter}>
                          {!needsCeo ? <span style={{ fontSize: 11, color: "#ccc" }}>-</span> : (
                            <div style={String(row.ceo_sign || "") === "4" ? confirmCellConfirmedSx : confirmCellInnerSx}>
                              <ConfirmBadge confirmed={String(row.ceo_sign || "") === "4"} />
                              {row.ceo_dt && <div style={confirmDtSx}>{row.ceo_dt}</div>}
                            </div>
                          )}
                        </td>
                        <td style={td2CellCenter}>{row.reg_dt || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </MDBox>
          </MDBox>
        </MDBox>
      </MDBox>
    );
  }

  // 상세 화면
  // 선택한 평가문서의 KPI 항목과 결재 상태 표시
  const detailItems = Array.isArray(detail) ? detail : (detail ? [detail] : []);
  const firstItem = detailItems[0] || {};

  // 상세 평가문서 결재범위 계산값
  const writerDept = String(firstItem.writer_department || "");
  const approvalPosition = getApprovalPosition(firstItem.approval_position);
  const needsTeamLeaderConfirm = approvalPosition <= 3 && writerDept !== "8";
  const needsHpConfirm = approvalPosition <= 2;
  const needsHrConfirm = approvalPosition <= 1;
  const needsCeoConfirm = approvalPosition <= 0;

  const tmAlreadyConfirmed = String(firstItem.tm_sign || "") === "4";
  const hpAlreadyConfirmed = String(firstItem.hp_sign || "") === "4";
  const hrAlreadyConfirmed = String(firstItem.hr_sign || "") === "4";
  const ceoAlreadyConfirmed = String(firstItem.ceo_sign || "") === "4";

  // 결재범위와 선행 결재 완료 여부 기준 확인 버튼 표시
  const canTeamLeaderConfirm = needsTeamLeaderConfirm && !tmAlreadyConfirmed &&
    (isAdmin || (loginPosition === 1 && String(firstItem.writer_department) === loginDepartment));

  const canHpLeaderConfirm = needsHpConfirm && !hpAlreadyConfirmed && isHpLeader &&
    (!needsTeamLeaderConfirm || tmAlreadyConfirmed);

  const canHrLeaderConfirm = needsHrConfirm && !hrAlreadyConfirmed && isHrLeader &&
    (!needsTeamLeaderConfirm || tmAlreadyConfirmed) &&
    (!needsHpConfirm || hpAlreadyConfirmed);

  const canCeoLeaderConfirm = needsCeoConfirm && !ceoAlreadyConfirmed && isCeoLeader &&
    (!needsTeamLeaderConfirm || tmAlreadyConfirmed) &&
    (!needsHpConfirm || hpAlreadyConfirmed) &&
    (!needsHrConfirm || hrAlreadyConfirmed);


  const isOwner = firstItem.user_id === loginUserId;

  return (
    <MDBox sx={{ display: "flex", flexDirection: "column", height: "100%", ...selectableAreaSx }}>

      {/* 상단 고정 버튼 영역 */}
      <MDBox sx={{ flexShrink: 0, pt: 1, pb: 1, px: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", borderBottom: "1px solid #e8ecf0", background: "#fff" }}>
        <MDButton variant="outlined" color="secondary" onClick={goList} sx={{ fontSize: isMobile ? 11 : 13 }}>
          목록으로
        </MDButton>

        <MDBox sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {/* 결재 도장 영역 */}
          <MDBox sx={{ borderRight: "1px solid #e8ecf0", pr: 1 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
              <tbody>
                <tr>
                  <td style={stampLabelCell}>본인</td>
                  {needsTeamLeaderConfirm && <td style={stampLabelCell}>팀장</td>}
                  {needsHpConfirm && <td style={stampLabelCell}>실장</td>}
                  {needsHrConfirm && <td style={stampLabelCell}>인사팀장</td>}
                  {needsCeoConfirm && <td style={stampLabelCell}>대표이사</td>}
                </tr>
                <tr>
                  <td style={stampCell}>{String(firstItem.charge_sign || "") === "4" ? <Stamp name={firstItem.user_name} small /> : null}</td>
                  {needsTeamLeaderConfirm && <td style={stampCell}>{tmAlreadyConfirmed ? <Stamp name={firstItem.tm_user_name} small /> : null}</td>}
                  {needsHpConfirm && <td style={stampCell}>{hpAlreadyConfirmed ? <Stamp name={firstItem.hp_user_name} small /> : null}</td>}
                  {needsHrConfirm && <td style={stampCell}>{hrAlreadyConfirmed ? <Stamp name={firstItem.hr_user_name} small /> : null}</td>}
                  {needsCeoConfirm && <td style={stampCell}>{ceoAlreadyConfirmed ? <Stamp name={firstItem.ceo_user_name} small /> : null}</td>}
                </tr>
              </tbody>
            </table>
          </MDBox>

          {/* 팀장 의견 저장 및 확인 버튼 */}
          {canTeamLeaderConfirm && (
            <MDButton variant="gradient" color="info" onClick={handleTeamLeaderConfirm} sx={{ fontSize: isMobile ? 11 : 13 }}>
              팀장 의견 저장 및 확인
            </MDButton>
          )}

          {/* 실장 의견 저장 및 확인 버튼 */}
          {canHpLeaderConfirm && (
            <MDButton variant="gradient" color="info" onClick={handleHpLeaderConfirm} sx={{ fontSize: isMobile ? 11 : 13 }}>
              실장 의견 저장 및 확인
            </MDButton>
          )}

          {/* 인사팀장 확인 버튼 */}
          {canHrLeaderConfirm && (
            <MDButton variant="gradient" color="success" onClick={handleHrLeaderConfirm} sx={{ fontSize: isMobile ? 11 : 13 }}>
              인사팀장 확인
            </MDButton>
          )}

          {canCeoLeaderConfirm && (
            <MDButton variant="gradient" color="success" onClick={handleCeoLeaderConfirm} sx={{ fontSize: isMobile ? 11 : 13 }}>
              대표이사 확인
            </MDButton>
          )}

          {/* 작성자 평가문서 수정 버튼 */}
          {isOwner && !tmAlreadyConfirmed && typeof onEditRequest === "function" && (
            <MDButton
              variant="gradient" color="warning"
              onClick={() => {
                onEditRequest({
                  editIdx: String(selectedIdx || ""),
                  kpiRows: detailItems.map((item, i) => ({
                    id: i + 1,
                    type: String(item.type || ""),
                    goal: item.goal != null ? String(item.goal) : "",
                    measurement: item.measurement || "",
                    weight: item.weight != null ? String(item.weight) : "",
                    performance: item.performance != null ? String(item.performance) : "",
                    content: item.content || "",
                  })),
                  startTime: firstItem.start_time || "",
                  endTime: firstItem.end_time || "",
                  docType: firstItem.doc_type || "",
                  writerId: firstItem.user_id || "",
                  department: String(firstItem.writer_department || ""),
                });
              }}
              sx={{ fontSize: isMobile ? 11 : 13 }}
            >
              수정
            </MDButton>
          )}

          {/* 작성자 실적 입력 버튼 */}
          {isOwner && tmAlreadyConfirmed && !performanceEditMode && (
            <MDButton variant="gradient" color="warning" onClick={handleStartPerformanceEdit} sx={{ fontSize: isMobile ? 11 : 13 }}>
              실적 입력
            </MDButton>
          )}
          {performanceEditMode && (
            <>
              <MDButton variant="gradient" color="success" onClick={handleSavePerformance} sx={{ fontSize: isMobile ? 11 : 13 }}>실적 저장</MDButton>
              <MDButton variant="outlined" color="secondary" onClick={() => { setPerformanceEditMode(false); setPerfValues({}); }} sx={{ fontSize: isMobile ? 11 : 13 }}>취소</MDButton>
            </>
          )}

          {/* 작성자 평가문서 삭제 버튼 */}
          {isOwner && !tmAlreadyConfirmed && (
            <MDButton variant="gradient" color="error" onClick={handleDelete} sx={{ fontSize: isMobile ? 11 : 13 }}>삭제</MDButton>
          )}
        </MDBox>
      </MDBox>

      {/* 상세 본문 영역 */}
      <MDBox sx={{ flex: 1, overflowY: "auto", pt: 1 }}>
        <MDBox sx={sheetWrapSx(isMobile)}>

          {/* 평가문서 헤더 */}
          <MDBox sx={headerBarSx}>
            <MDBox sx={{ display: "flex", alignItems: "center" }}>
              <img src={logo} alt="logo" style={{ height: isMobile ? 24 : 30 }} />
            </MDBox>
            <MDBox sx={titleSx(isMobile)}>{firstItem.doc_name || firstItem.doc_type || "평가문서"}</MDBox>
            <MDBox sx={{ width: isMobile ? 90 : 110 }} />
          </MDBox>

          {/* 평가 정보 영역 */}
          <MDBox sx={sectionSx}>
            <MDBox sx={sectionTitleSx}>평가 정보</MDBox>
            <MDBox sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 500, fontSize: isMobile ? 11 : 12 }}>
                <colgroup>
                  <col style={{ width: "25%" }} /><col style={{ width: "25%" }} />
                  <col style={{ width: "22%" }} /><col style={{ width: "3%" }} /><col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thCell}>부서</th>
                    <th style={thCell}>작성자</th>
                    <th style={thCell} colSpan={3}>평가기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={roTdCellCenter}>{firstItem.dept_name || "-"}</td>
                    <td style={roTdCellCenter}>
                      {firstItem.position != null && POSITION_LABELS[Number(firstItem.position)]
                        ? `${firstItem.user_name || "-"} ${POSITION_LABELS[Number(firstItem.position)]}`
                        : firstItem.user_name || "-"}
                    </td>
                    <td style={roTdCellCenter}>{firstItem.start_time ? firstItem.start_time.slice(0, 10) : "-"}</td>
                    <td style={{ ...roTdCellCenter, padding: "0 2px", fontSize: 13, fontWeight: 700, color: "#555" }}>~</td>
                    <td style={roTdCellCenter}>{firstItem.end_time ? firstItem.end_time.slice(0, 10) : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </MDBox>
          </MDBox>

          {/* KPI 내용 영역 */}
          <MDBox sx={sectionSx}>
            <MDBox sx={sectionTitleSx}>KPI 내용</MDBox>
            <MDBox sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 880, fontSize: isMobile ? 11 : 12 }}>
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "29%" }} />
                  <col style={{ width: "19%" }} />  {/* 첨부파일 */}
                </colgroup>
                <thead>
                  <tr>
                    <th style={thCell}>No</th>
                    <th style={thCell}>업무</th>
                    <th style={thCell}>목표</th>
                    <th style={thCell}>측정방법</th>
                    <th style={thCell}>가중치</th>
                    <th style={thCell}>실적</th>
                    <th style={thCell}>내용</th>
                    <th style={thCell}>첨부파일</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((item, idx) => {
                    // KPI 순번과 같은 순서의 첨부파일 목록 (다중 파일 지원)
                    // 새 방식: image_order = kpiRow * 100 + 파일인덱스 (>= 100)
                    // 레거시: image_order = kpiRow (< 100)
                    const kpiOrder = idx + 1;
                    const rowFiles = evaluationFiles.filter((f) => {
                      const order = Number(f.image_order);
                      return (order < 100 ? order : Math.floor(order / 100)) === kpiOrder;
                    });
                    return (
                      <tr key={item.idx || idx}>
                        <td style={{ ...roTdCellCenter, fontWeight: 700 }}>{idx + 1}</td>
                        <td style={roTdCellCenter}>{TYPE_LABELS[item.type] || item.type_nm || "-"}</td>
                        <td style={roTdCellCenter}>{item.goal != null ? `${item.goal}%` : "-"}</td>
                        <td style={roTdCellTop}>{item.measurement || "-"}</td>
                        <td style={roTdCellCenter}>{item.weight != null ? `${item.weight}%` : "-"}</td>
                        {/* 실적 입력 모드와 읽기 모드 표시 */}
                        <td style={roTdCellCenter}>
                          {performanceEditMode ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                              <input
                                type="text"
                                value={perfValues[item.idx] ?? ""}
                                onChange={(e) => setPerfValues((prev) => ({ ...prev, [item.idx]: normalizePerformanceValue(e.target.value) }))}
                                style={{ width: 48, textAlign: "right", border: "1px solid #1f4e79", borderRadius: 4, padding: "3px 4px", fontSize: 12, outline: "none" }}
                              />
                              <span style={{ fontSize: 11, color: "#888" }}>%</span>
                            </span>
                          ) : (
                            item.performance != null ? `${item.performance}%` : "-"
                          )}
                        </td>
                        <td style={roTdCellTop}>{item.content || "-"}</td>
                        {/* KPI 첨부파일 썸네일 및 다운로드 (다중 파일 지원) */}
                        <td style={{ ...roTdCellTop, padding: "6px 4px", textAlign: "center", verticalAlign: "top", overflow: "hidden" }}>
                          {rowFiles.length > 0 ? (
                            <MDBox sx={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", width: "100%", overflow: "hidden" }}>
                              {rowFiles.map((rf) => {
                                const rfUrl = `${API_BASE_URL}${rf.image_path}`;
                                const rfKind = getFileKind(rf.image_name);
                                const rfCanPreview = rfKind === "image" || rfKind === "pdf" || rfKind === "excel";
                                const rfPreviewKey = `saved-${rf.image_order}`;
                                return (
                                  <MDBox key={rf.image_order} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", width: "100%", minWidth: 0 }}>
                                    <MDBox sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <MDBox sx={roThumbSx}>
                                        {rfKind === "image" ? (
                                          rfCanPreview ? (
                                            <MDBox component="button" type="button" onClick={() => openPreview(rfPreviewKey)} sx={{ border: "none", background: "none", p: 0, width: "100%", height: "100%", cursor: "pointer" }}>
                                              <MDBox component="img" src={rfUrl} alt={rf.image_name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            </MDBox>
                                          ) : (
                                            <MDBox component="img" src={rfUrl} alt={rf.image_name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                          )
                                        ) : rfKind === "pdf" ? (
                                          <MDBox component={rfCanPreview ? "button" : "span"} type={rfCanPreview ? "button" : undefined} onClick={rfCanPreview ? () => openPreview(rfPreviewKey) : undefined} sx={{ ...pdfThumbBtnSx, cursor: rfCanPreview ? "pointer" : "default" }}>
                                            <MDBox component="iframe" title={`pdf-${rf.image_order}`} src={toPdfThumbSrc(rfUrl)} loading="lazy" sx={pdfThumbFrameSx} />
                                            <MDBox component="span" sx={pdfThumbLabelSx}>PDF</MDBox>
                                          </MDBox>
                                        ) : (
                                          <MDBox sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1f4e79", backgroundColor: "#edf4ff" }}>
                                            {getFileExtLabel(rf.image_name)}
                                          </MDBox>
                                        )}
                                      </MDBox>
                                      <IconButton size="small" component="a" href={rfUrl} download target="_blank" rel="noopener noreferrer" sx={{ ...iconBtnSx, width: 24, height: 24 }}>
                                        <Download size={13} />
                                      </IconButton>
                                    </MDBox>
                                    {rfCanPreview ? (
                                      <button type="button" onClick={() => openPreview(rfPreviewKey)} style={roFileNameSx}>{rf.image_name}</button>
                                    ) : (
                                      <span style={{ ...roFileNameSx, textDecoration: "none", cursor: "default" }}>{rf.image_name}</span>
                                    )}
                                  </MDBox>
                                );
                              })}
                            </MDBox>
                          ) : (
                            <span style={{ fontSize: 10, color: "#ccc" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* KPI 가중치 합계 행 */}
                  <tr>
                    <td colSpan={4} style={{ ...roTdCellCenter, fontWeight: 800, background: "#f3f6fb" }}>가중치 합계</td>
                    <td style={{ ...roTdCellCenter, fontWeight: 900, background: "#fffde7", color: "#e65100" }}>
                      {detailItems.reduce((s, r) => s + (Number(r.weight) || 0), 0)}%
                    </td>
                    <td colSpan={3} style={{ ...roTdCellCenter, background: "#f3f6fb" }} />
                  </tr>
                </tbody>
              </table>
            </MDBox>
          </MDBox>

          {/* 의견 입력 및 표시 영역 */}
          <MDBox sx={sectionSx}>
            <MDBox sx={sectionTitleSx}>의견</MDBox>
            <MDBox sx={{ p: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
              {/* 팀장 의견 영역 */}
              {writerDept !== "8" && (
                <MDBox>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 }}>
                    팀장 의견{firstItem.tm_user_name ? ` (${firstItem.tm_user_name})` : ""}
                  </div>
                  {canTeamLeaderConfirm ? (
                    <textarea value={tmOpinionText} onChange={(e) => setTmOpinionText(e.target.value)} placeholder="팀장 의견을 입력하세요. (선택)" style={opinionTextareaSx} />
                  ) : (
                    <div style={opinionReadOnlySx}>
                      {!tmAlreadyConfirmed
                        ? <span style={{ color: "#aaa" }}>팀장 확인 전입니다</span>
                        : firstItem.tm_opinion || <span style={{ color: "#bbb" }}>(의견 없음)</span>}
                    </div>
                  )}
                </MDBox>
              )}
              {/* 실장 의견 영역 */}
              {needsHpConfirm && (
                <MDBox>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 }}>
                    실장 의견{firstItem.hp_user_name ? ` (${firstItem.hp_user_name})` : ""}
                  </div>
                  {canHpLeaderConfirm ? (
                    <textarea value={hpOpinionText} onChange={(e) => setHpOpinionText(e.target.value)} placeholder="실장 의견을 입력하세요. (선택)" style={opinionTextareaSx} />
                  ) : (
                    <div style={opinionReadOnlySx}>
                      {!hpAlreadyConfirmed
                        ? <span style={{ color: "#aaa" }}>실장 확인 전입니다</span>
                        : firstItem.hp_opinion || <span style={{ color: "#bbb" }}>(의견 없음)</span>}
                    </div>
                  )}
                </MDBox>
              )}
            </MDBox>
          </MDBox>


        </MDBox>
      </MDBox>

      {/* 첨부파일 미리보기 오버레이 */}
      <PreviewOverlay
        open={previewOpen}
        files={previewList}
        currentIndex={previewIndex}
        onChangeIndex={setPreviewIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </MDBox>
  );
}

// 확인 상태 배지
// 결재 완료 여부 표시

EvaluationManageTab.propTypes = {
  onEditRequest: PropTypes.func,
  initialEvalIdx: PropTypes.number,
  onInitialEvalIdxConsumed: PropTypes.func,
};

function ConfirmBadge({ confirmed }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 700,
      background: confirmed ? "#e8f4fd" : "#f3f4f6",
      color: confirmed ? "#1565c0" : "#888",
      border: `1px solid ${confirmed ? "#90caf9" : "#ddd"}`,
      whiteSpace: "nowrap",
    }}>
      {confirmed ? "확인" : "미확인"}
    </span>
  );
}
ConfirmBadge.propTypes = { confirmed: PropTypes.bool };

// 결재 도장 컴포넌트
// 결재자 이름 표시

function Stamp({ name, small }) {
  const n = String(name || "").trim();
  const w = small ? 52 : 80;
  const h = small ? 34 : 52;
  const fs = small ? 10 : 13;
  return (
    <div style={{
      display: "inline-flex", width: w, height: h, borderRadius: 999,
      border: "2px solid #d32f2f", alignItems: "center", justifyContent: "center",
      color: "#d32f2f", fontWeight: 900, letterSpacing: 1,
      transform: "rotate(-6deg)", background: "rgba(211,47,47,0.06)",
      userSelect: "none", fontSize: fs, flexShrink: 0,
    }}>
      {n}
    </div>
  );
}
Stamp.defaultProps = { small: false };
Stamp.propTypes = { name: PropTypes.string, small: PropTypes.bool };

// 파일 종류 판별 함수
// 첨부파일 확장자 기준 표시 방식

function getFileKind(fileName) {
  const ext = String(fileName || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  return "file";
}

// 첨부파일 확장자 표시명 생성 함수
function getFileExtLabel(fileName) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "FILE";
  const ext = name.substring(dot + 1).toUpperCase();
  return ext === "JPEG" ? "JPG" : ext || "FILE";
}

// PDF 첫 페이지 썸네일 표시용 주소 생성 함수
function toPdfThumbSrc(fileUrl) {
  const base = String(fileUrl ?? "").trim();
  if (!base) return "";
  return `${base}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

// 스타일 상수
// 평가문서 화면 구성 스타일

const selectableAreaSx = { userSelect: "text", "& *": { userSelect: "text" } };

// 평가문서 카드형 외곽 레이아웃
const sheetWrapSx = (isMobile) => ({
  border: "1px solid #cfd8e3", borderRadius: 2, overflow: "hidden", background: "#fff",
  mx: 1, mb: 2, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", fontSize: isMobile ? 11 : 12,
});

// 평가문서 제목 헤더 영역
const headerBarSx = {
  display: "grid", gridTemplateColumns: "1fr 2fr 1fr", alignItems: "center",
  background: "#1f4e79", padding: "4px 8px",
};
const titleSx = (isMobile) => ({
  textAlign: "center", color: "#fff", fontWeight: 800, letterSpacing: 1,
  fontSize: isMobile ? 16 : 20,
});
const sectionSx = { borderTop: "1px solid #cfd8e3" };
const sectionTitleSx = {
  background: "#e9f0fb", borderBottom: "1px solid #cfd8e3",
  padding: "6px 10px", fontWeight: 800, color: "#1f4e79",
};

// 상세 테이블 공통 셀 스타일
const thCell = {
  border: "1px solid #cfd8e3", background: "#f3f6fb",
  padding: "6px 8px", textAlign: "center", fontWeight: 800, whiteSpace: "nowrap",
};
const roTdCellCenter = {
  border: "1px solid #cfd8e3", padding: "7px 8px",
  background: "#fff", textAlign: "center", verticalAlign: "middle", fontSize: 12,
};
const roTdCellTop = {
  border: "1px solid #cfd8e3", padding: "7px 10px",
  background: "#fff", verticalAlign: "top", whiteSpace: "pre-wrap",
  fontSize: 12, lineHeight: 1.6,
};

// 목록 테이블 공통 셀 스타일
const th2Cell = {
  border: "1px solid #cfd8e3", background: "#f3f6fb",
  padding: "4px 5px", textAlign: "center", fontWeight: 800, whiteSpace: "nowrap",
};
const td2CellCenter = {
  border: "1px solid #cfd8e3", padding: "4px 5px",
  textAlign: "center", verticalAlign: "middle", background: "#fff",
  height: 50, boxSizing: "border-box",
};
const listRowSx = { cursor: "pointer", height: 50 };
// 도장 제목 셀
const stampLabelCell = {
  border: "1px solid #e8ecf0", background: "#f3f6fb",
  padding: "2px 8px", textAlign: "center", fontWeight: 700,
  fontSize: 10, whiteSpace: "nowrap", color: "#1f4e79",
};
// 도장 표시 셀
const stampCell = {
  border: "1px solid #e8ecf0", background: "#fff",
  padding: "4px 8px", textAlign: "center", verticalAlign: "middle",
  minWidth: 66, height: 44,
};
// KPI 첨부파일 썸네일 박스
const roThumbSx = {
  width: 44, height: 52, borderRadius: "4px", overflow: "hidden", flexShrink: 0,
  border: "1px solid #d0d7e2", backgroundColor: "#f1f4f8",
  display: "flex", alignItems: "center", justifyContent: "center",
};
// KPI 첨부파일명 표시
const roFileNameSx = {
  border: "none", background: "none", padding: 0, fontSize: 9, color: "#1f4e79",
  textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis",
  whiteSpace: "nowrap", maxWidth: "100%", textAlign: "center", cursor: "pointer",
  display: "block",
};

// 첨부파일 다운로드 아이콘 버튼
const iconBtnSx = {
  width: 28, height: 28, borderRadius: "6px",
  border: "1px solid #c7d2e6", backgroundColor: "#f5f8ff", color: "#1f4e79",
};

// 목록 결재 상태 셀 내부 정렬
const confirmCellInnerSx = {
  height: 34,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
const confirmCellConfirmedSx = confirmCellInnerSx;
const confirmDtSx = {
  marginTop: 2, fontSize: 10, lineHeight: 1, color: "#888", whiteSpace: "nowrap",
};

// 목록 작성자 검색 입력창
const filterInputSx = {
  border: "1px solid #cfd8e3", borderRadius: 4, padding: "0 10px",
  fontSize: 12, background: "#fff", outline: "none", minWidth: 180, height: 34,
  boxSizing: "border-box",
};

// PDF 첨부파일 썸네일 표시 스타일
const pdfThumbBtnSx = { width: "100%", height: "100%", border: "none", p: 0, backgroundColor: "#fff", position: "relative" };
const pdfThumbFrameSx = { width: "100%", height: "100%", border: 0, pointerEvents: "none", backgroundColor: "#fff" };
const pdfThumbLabelSx = {
  position: "absolute", right: 4, bottom: 4,
  px: 0.5, py: 0.1, borderRadius: "4px", fontSize: 9, fontWeight: 800,
  color: "#fff", backgroundColor: "rgba(198,40,40,0.9)", lineHeight: 1.2,
};

// 결재 의견 입력 및 읽기 전용 표시 스타일
const opinionTextareaSx = {
  width: "100%", minHeight: 76, padding: "8px 10px", fontSize: 12,
  border: "1px solid #cfd8e3", borderRadius: 4, resize: "vertical",
  outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box",
};
const opinionReadOnlySx = {
  fontSize: 12, color: "#333", padding: "8px 10px", minHeight: 40,
  border: "1px solid #eee", borderRadius: 4, background: "#fafbfc",
  whiteSpace: "pre-wrap", lineHeight: 1.6,
};
