// ────────────────────────────────────────────────────────────────────────────
// EvaluationDocumentSheetTab.js
// 인사 → 평가 → 평가문서 작성 탭
// - KPI 본인 평가표 작성 폼
// - 부서/작성자 선택, 평가기간 입력, KPI 행 편집, 행별 첨부파일, 저장
// - 저장 시 본인 확인란에 작성자 이름 도장 자동 표시
// - 스크롤 시 상단 버튼 고정, 본문만 스크롤
// ────────────────────────────────────────────────────────────────────────────
/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconButton, TextField, useTheme, useMediaQuery } from "@mui/material";
import { RotateCcw, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import PreviewOverlay from "utils/PreviewOverlay";
import logo from "assets/images/the-full-logo4.png";

import useEvaluationData from "./EvaluationDocumentSheetTabData";

// ────────────────────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";

// 업무 타입 옵션 (DB type 컬럼 값과 매핑)
const TYPE_OPTIONS = [
  { value: 1, label: "총괄" }, { value: 2, label: "인사" },
  { value: 3, label: "영업" }, { value: 4, label: "개발" },
  { value: 5, label: "회계" }, { value: 6, label: "운영" },
  { value: 7, label: "기획" },
];

// 빈 KPI 행 생성 팩토리 (신규 스키마: plan 컬럼 제외)
const createEmptyRow = (id) => ({
  id,
  type: "",  // 업무 타입 (1~7)
  goal: "",  // 목표 (%)
  measurement: "",  // 측정방법
  weight: "",  // 가중치 (%)
  performance: "",  // 실적 (%)
  content: "",  // 내용
});

// 기본 5행으로 시작
const createDefaultRows = () =>
  Array.from({ length: 5 }, (_, i) => createEmptyRow(i + 1));

// 행 추가 시 고유 ID 생성용 카운터 (모듈 레벨 — 렌더링 외부에서 관리)
let rowIdCounter = 6;

// 퍼센트 입력값을 숫자만 허용하고 최대 100으로 제한
const normalizePercentValue = (value) => {
  const onlyNumber = String(value || "").replace(/[^\d]/g, "");
  if (!onlyNumber) return "";
  return String(Math.min(Number(onlyNumber), 100));
};

// ────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// Props:
//   editData   - 관리탭에서 수정 요청 시 전달되는 기존 평가 데이터 (null 이면 신규 작성)
//   onEditClear - 저장 완료 후 부모에게 editData 초기화 요청
export default function EvaluationDocumentSheetTab({ editData, onEditClear }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // localStorage에서 로그인 사용자 정보 추출
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || "").trim(), []);
  const loginDepartment = useMemo(() => String(localStorage.getItem("department") || "").trim(), []);

  const {
    saving,
    evaluationFiles,
    saveEvaluation,
    syncEvaluationFiles,
    fetchEvaluationFormInit,   // types + users 단일 API
  } = useEvaluationData();

  // ── 문서 타입 상태 (전자결재 동일 패턴) ─────────────────────────────────
  const [typeList, setTypeList] = useState([]);  // tb_hr_evaluation_type 전체 목록
  const [selectedLargeType, setSelectedLargeType] = useState("");  // 선택된 대분류
  const [selectedMiddleType, setSelectedMiddleType] = useState("");  // 선택된 중분류
  const [docType, setDocType] = useState("");  // 최종 선택된 doc_type

  // 대분류 옵션 (중복 제거)
  const largeTypeOptions = useMemo(() => {
    const seen = new Set();
    return (typeList || []).filter((r) => {
      const v = String(r.large_type ?? "").trim();
      if (!v || seen.has(v)) return false;
      seen.add(v); return true;
    }).map((r) => String(r.large_type));
  }, [typeList]);

  // 중분류 옵션 (대분류 기준 필터 + 중복 제거)
  const middleTypeOptions = useMemo(() => {
    if (!selectedLargeType) return [];
    const seen = new Set();
    return (typeList || [])
      .filter((r) => String(r.large_type ?? "").trim() === selectedLargeType)
      .filter((r) => {
        const v = String(r.middle_type ?? "").trim();
        if (!v || seen.has(v)) return false;
        seen.add(v); return true;
      }).map((r) => String(r.middle_type));
  }, [typeList, selectedLargeType]);

  // 소분류 옵션 (대+중분류 기준 필터)
  const smallTypeOptions = useMemo(() => {
    if (!selectedLargeType || !selectedMiddleType) return [];
    return (typeList || []).filter(
      (r) =>
        String(r.large_type ?? "").trim() === selectedLargeType &&
        String(r.middle_type ?? "").trim() === selectedMiddleType
    );
  }, [typeList, selectedLargeType, selectedMiddleType]);

  // 선택된 문서명 (폼 타이틀에 표시)
  const selectedDocName = useMemo(() => {
    const found = (typeList || []).find(
      (r) => String(r.doc_type) === docType && String(r.middle_type ?? "").trim() === selectedMiddleType
    );
    return found?.doc_name || "";
  }, [typeList, docType, selectedMiddleType]);

  const selectedDocType = useMemo(() => {
    return (typeList || []).find(
      (r) => String(r.doc_type) === docType && String(r.middle_type ?? "").trim() === selectedMiddleType
    ) || null;
  }, [typeList, docType, selectedMiddleType]);

  const approvalPosition = useMemo(() => {
    const value = selectedDocType?.approval_position;
    return value == null || value === "" ? 1 : Number(value);
  }, [selectedDocType]);

  // ── 헤더 입력 상태 ────────────────────────────────────────────────────────
  const [department, setDepartment] = useState("");  // 선택된 부서 코드
  const [writerId, setWriterId] = useState("");  // 선택된 작성자 user_id

  // 전체 사용자 목록 (EvaluationFormInit 단일 API로 로드)
  const [allUsers, setAllUsers] = useState([]);

  // 부서 목록: allUsers에서 department 중복 제거
  const departmentList = useMemo(() => {
    const seen = new Set();
    return (allUsers || []).filter((u) => {
      const d = String(u.department);
      if (seen.has(d)) return false;
      seen.add(d); return true;
    }).map((u) => ({ department: u.department, dept_name: u.dept_name }));
  }, [allUsers]);

  // 작성자 목록: 선택된 부서에서 로그인 사용자만 표시
  const writerList = useMemo(() => {
    if (!department) return [];
    return (allUsers || []).filter(
      (u) => String(u.department) === String(department) && String(u.user_id) === loginUserId
    );
  }, [allUsers, department, loginUserId]);

  // 인사팀 사용자: department=3으로 필터링
  const hrTeamUsers = useMemo(() => {
    return (allUsers || []).filter((u) => String(u.department) === "3");
  }, [allUsers]);

  // 작성자 이름 (도장 표시에 사용)
  const writerName = useMemo(() => {
    const found = (writerList || []).find((u) => String(u.user_id) === String(writerId));
    return found?.user_name || "";
  }, [writerList, writerId]);

  // 팀장ID: 작성자 부서의 position=1 사용자
  const tmUser = useMemo(() => {
    return (writerList || []).find((u) => Number(u.position) === 1)?.user_id || "";
  }, [writerList]);

  // 인사팀장ID: 인사팀(department=3)의 position=1 사용자
  const hrUser = useMemo(() => {
    return (hrTeamUsers || []).find((u) => Number(u.position) === 1)?.user_id || "";
  }, [hrTeamUsers]);

  // 실장팀 사용자: department=8
  const hpTeamUsers = useMemo(() => {
    return (allUsers || []).filter((u) => String(u.department) === "8");
  }, [allUsers]);

  // 실장ID: department=8의 position=1 사용자
  const hpUser = useMemo(() => {
    return (hpTeamUsers || []).find((u) => Number(u.position) === 1)?.user_id || "";
  }, [hpTeamUsers]);

  // dept 4, 5, 8 모두 실장 확인 필요 (dept 8은 팀장 단계 없이 실장이 직접 확인)
  const ceoUser = useMemo(() => {
    return (allUsers || []).find((u) => String(u.user_id) === "ceo")?.user_id
      || (allUsers || []).find((u) => Number(u.position) === 0)?.user_id
      || "";
  }, [allUsers]);

  const needsTeamLeaderConfirm = useMemo(() => approvalPosition <= 3 && String(department) !== "8", [approvalPosition, department]);
  const needsHpConfirm = useMemo(() => approvalPosition <= 2, [approvalPosition]);
  const needsHrConfirm = useMemo(() => approvalPosition <= 1, [approvalPosition]);
  const needsCeoConfirm = useMemo(() => approvalPosition <= 0, [approvalPosition]);

  // ── KPI 행 상태 ───────────────────────────────────────────────────────────
  const [kpiRows, setKpiRows] = useState(createDefaultRows);

  // ── 행별 첨부파일 상태 ────────────────────────────────────────────────────
  // rowPendingFiles: { [rowId]: Array<{ file, name, previewUrl }> } — 새로 선택한 파일(행당 최대 10개)
  // rowDeletedOrders: { [rowId]: number[] } — 기존 파일 삭제 예약(image_order 목록)
  const [rowPendingFiles, setRowPendingFiles] = useState({});
  const [rowDeletedOrders, setRowDeletedOrders] = useState({});
  const pendingFilesRef = useRef({});
  const fileInputRef = useRef(null);
  const activeRowIdRef = useRef(null);  // 현재 파일 선택 중인 rowId 추적

  // ── 미리보기 오버레이 상태 ────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // rowPendingFiles 변경 시 ref 동기화 (언마운트 핸들러에서 최신 값 참조)
  useEffect(() => { pendingFilesRef.current = rowPendingFiles; }, [rowPendingFiles]);

  // 언마운트 시 생성된 blob URL 해제 (메모리 누수 방지)
  useEffect(() => () => {
    Object.values(pendingFilesRef.current).forEach((arr) => {
      (arr || []).forEach((pf) => { if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl); });
    });
  }, []);

  // ── 수정 모드: editData가 전달되면 폼 자동 채움 ──────────────────────────
  useEffect(() => {
    if (!editData) return;
    // KPI 행 복원 (id는 새로 부여, 나머지 필드는 기존 값)
    let counter = 1;
    const rows = (editData.kpiRows || []).map((r) => ({ ...r, id: counter++ }));
    rowIdCounter = counter;
    setKpiRows(rows.length > 0 ? rows : createDefaultRows());

    // 부서/작성자 (writer 목록은 부서 변경 useEffect가 자동 로드)
    setDepartment(String(editData.department || ""));
    setWriterId(editData.writerId || "");

    // 문서구분 (docType은 있으면 설정, 없으면 그대로)
    if (editData.docType) {
      const startDate = editData.startTime ? String(editData.startTime).slice(0, 10) : "";
      const found = typeList.find((t) =>
        String(t.doc_type) === editData.docType &&
        (startDate ? String(t.start_time || "").slice(0, 10) === startDate : true)
      ) || typeList.find((t) => String(t.doc_type) === editData.docType);
      if (found) {
        setSelectedLargeType(String(found.large_type || ""));
        setSelectedMiddleType(String(found.middle_type || ""));
        setDocType(editData.docType);
      }
    }

    // 수정 상태 초기화
    setRowPendingFiles({});
    setRowDeletedOrders({});
  }, [editData, typeList]);

  // ── 폼 초기화: types + 전체 users 단일 API 1회 호출 ─────────────────────
  useEffect(() => {
    (async () => {
      const { types, users } = await fetchEvaluationFormInit();
      setTypeList(types || []);
      setAllUsers(users || []);

      // 로그인 사용자의 부서를 기본값으로 자동 선택
      if (loginDepartment) {
        const inDept = (users || []).some(
          (u) => String(u.department) === loginDepartment
        );
        if (inDept) setDepartment(loginDepartment);
      }
    })();
  }, [fetchEvaluationFormInit, loginDepartment]);

  // 대분류 변경 시 중분류·소분류 초기화
  const onChangeLargeType = useCallback((value) => {
    setSelectedLargeType(value);
    setSelectedMiddleType("");
    setDocType("");
  }, []);

  // 중분류 변경 시 해당 대+중분류 조합의 첫 번째 doc_type 자동 선택
  const onChangeMiddleType = useCallback((value) => {
    setSelectedMiddleType(value);
    const matched = (typeList || []).filter(
      (r) =>
        String(r.large_type ?? "").trim() === selectedLargeType &&
        String(r.middle_type ?? "").trim() === value
    );
    setDocType(matched.length > 0 ? String(matched[0].doc_type) : "");
  }, [typeList, selectedLargeType]);

  // ── 부서 변경 시 작성자 자동 선택 ──────────────────────────────────────
  useEffect(() => {
    if (!department) {
      setWriterId("");
      return;
    }
    const users = (allUsers || []).filter(
      (u) => String(u.department) === String(department)
    );
    const me = users.find((u) => String(u.user_id) === loginUserId);
    if (me) {
      setWriterId(String(me.user_id));
    } else if (users.length > 0) {
      setWriterId(String(users[0].user_id));
    } else {
      setWriterId("");
    }
  }, [department, allUsers, loginUserId]);

  // ── KPI 행 조작 ───────────────────────────────────────────────────────────
  const onChangeRow = useCallback((id, field, value) => {
    setKpiRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  const addRow = useCallback(() => {
    setKpiRows((prev) => [...prev, createEmptyRow(rowIdCounter++)]);
  }, []);

  const removeRow = useCallback((id) => {
    setKpiRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
    // 해당 행의 파일도 정리
    setRowPendingFiles((prev) => {
      const next = { ...prev };
      (next[id] || []).forEach((pf) => { if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl); });
      delete next[id];
      return next;
    });
    setRowDeletedOrders((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // ── 행별 첨부파일 처리 ────────────────────────────────────────────────────
  // 파일 선택 (행 하나에 최대 10개까지 추가)
  const handleSelectRowFile = useCallback((rowId, fileList) => {
    if (!fileList?.length) return;
    const newFiles = Array.from(fileList).map((file) => ({
      file, name: file.name, previewUrl: URL.createObjectURL(file),
    }));
    setRowPendingFiles((prev) => {
      const existing = prev[rowId] || [];
      const combined = [...existing, ...newFiles];
      if (combined.length > 10) {
        combined.slice(10).forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
        return { ...prev, [rowId]: combined.slice(0, 10) };
      }
      return { ...prev, [rowId]: combined };
    });
  }, []);

  // 신규 선택 파일 제거 (인덱스 지정)
  const handleRemoveRowPendingFile = useCallback((rowId, fileIdx) => {
    setRowPendingFiles((prev) => {
      const arr = [...(prev[rowId] || [])];
      if (fileIdx >= 0 && fileIdx < arr.length) {
        if (arr[fileIdx]?.previewUrl) URL.revokeObjectURL(arr[fileIdx].previewUrl);
        arr.splice(fileIdx, 1);
      }
      const next = { ...prev };
      if (arr.length === 0) delete next[rowId];
      else next[rowId] = arr;
      return next;
    });
  }, []);

  // 기존 파일 삭제 예약 토글 (재클릭 시 복원)
  const handleDeleteRowSavedFile = useCallback((rowId, imageOrder) => {
    setRowDeletedOrders((prev) => {
      const existing = prev[rowId] || [];
      const hasIt = existing.includes(imageOrder);
      const next = hasIt
        ? existing.filter((o) => o !== imageOrder)
        : [...existing, imageOrder];
      return { ...prev, [rowId]: next };
    });
  }, []);

  // 수정 모드: image_order 인코딩으로 KPI 행별 파일 배열 매핑
  // 새 방식: image_order = kpiRowIndex * 100 + 행내파일인덱스 (>= 100)
  // 레거시: image_order = kpiRowIndex (< 100)
  const rowSavedFileMap = useMemo(() => {
    const map = {};
    kpiRows.forEach((row, idx) => {
      const kpiOrder = idx + 1;
      const matched = evaluationFiles.filter((f) => {
        const order = Number(f.image_order);
        const decodedKpiRow = order < 100 ? order : Math.floor(order / 100);
        return decodedKpiRow === kpiOrder;
      });
      if (matched.length > 0) map[row.id] = matched;
    });
    return map;
  }, [kpiRows, evaluationFiles]);

  const openPreview = useCallback((url, name) => {
    const kind = getFileKind(name);
    if (!["image", "pdf", "excel"].includes(kind)) return;
    setPreviewList([{ key: "single", url, name, kind }]);
    setPreviewIndex(0);
    setPreviewOpen(true);
  }, []);

  // ── 초기화 ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSelectedLargeType("");
    setSelectedMiddleType("");
    setDocType("");
    setKpiRows(createDefaultRows());
    setRowPendingFiles((prev) => {
      Object.values(prev).forEach((arr) =>
        (arr || []).forEach((pf) => { if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl); })
      );
      return {};
    });
    setRowDeletedOrders({});
  }, []);

  // ── 저장 처리 ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!docType) {
      Swal.fire({ title: "확인", text: "대분류, 중분류를 선택해주세요.", icon: "warning" }); return;
    }
    if (!department) {
      Swal.fire({ title: "확인", text: "부서를 선택해주세요.", icon: "warning" }); return;
    }
    if (!writerId) {
      Swal.fire({ title: "확인", text: "작성자를 선택해주세요.", icon: "warning" }); return;
    }
    const startTime = selectedDocType?.start_time ? selectedDocType.start_time.slice(0, 10) : "";
    const endTime = selectedDocType?.end_time ? selectedDocType.end_time.slice(0, 10) : "";
    if (!startTime || !endTime) {
      Swal.fire({ title: "확인", text: "선택한 문서 유형에 평가기간이 설정되어 있지 않습니다.\n평가문서 설정 탭에서 기간을 먼저 설정해주세요.", icon: "warning" }); return;
    }

    const kpiRequiredFields = ["type", "goal", "measurement", "weight", "content"];

    const filledRows = kpiRows.filter((r) =>
      kpiRequiredFields.some((field) => String(r[field] ?? "").trim())
    );
    if (filledRows.length === 0) {
      Swal.fire({ title: "확인", text: "KPI 내용을 최소 1행 이상 입력해주세요.", icon: "warning" }); return;
    }
    const incompleteRowIndex = kpiRows.findIndex((r) => {
      const hasAnyValue = kpiRequiredFields.some((field) => String(r[field] ?? "").trim());
      if (!hasAnyValue) return false;
      return kpiRequiredFields.some((field) => !String(r[field] ?? "").trim());
    });
    if (incompleteRowIndex >= 0) {
      Swal.fire({ title: "확인", text: `${incompleteRowIndex + 1}번 KPI 행의 모든 내용을 입력해주세요.`, icon: "warning" }); return;
    }
    const totalWeight = kpiRows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    if (totalWeight !== 100) {
      Swal.fire({
        title: "확인",
        text: `가중치 합계가 ${totalWeight}%입니다.\n가중치 합계는 100%여야 합니다.`,
        icon: "warning",
      }); return;
    }

    const confirm = await Swal.fire({
      title: "저장하시겠습니까?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "저장",
      cancelButtonText: "취소",
      confirmButtonColor: "#1f4e79",
    });
    if (!confirm.isConfirmed) return;

    const items = filledRows.map((r) => ({
      type: r.type ? Number(r.type) : null,
      goal: r.goal !== "" ? Number(r.goal) : null,
      measurement: r.measurement || "",
      weight: r.weight !== "" ? Number(r.weight) : null,
      performance: r.performance !== "" ? Number(r.performance) : null,
      content: r.content || "",
    }));

    const result = await saveEvaluation({
      userId: writerId, startTime, endTime, items,
      docType,
      chargeSign: "4",
      tmUser: needsTeamLeaderConfirm ? tmUser : "",
      hrUser: needsHrConfirm ? hrUser : "",
      hpUser: needsHpConfirm ? hpUser : "",
      ceoUser: needsCeoConfirm ? ceoUser : "",
      editIdx: editData?.editIdx || "",
    });

    if (!result?.ok) {
      Swal.fire({ title: "실패", text: "저장 중 오류가 발생했습니다.", icon: "error" }); return;
    }

    // KPI 행별 파일을 flatten → 각 파일에 kpiRowIndex 포함
    const pendingFilesFlat = kpiRows.flatMap((row, idx) =>
      (rowPendingFiles[row.id] || []).map((pf) => ({ ...pf, kpiRowIndex: idx + 1 }))
    );
    const deletedOrdersFlat = new Set(
      Object.values(rowDeletedOrders).flatMap((orders) => orders || [])
    );
    if ((pendingFilesFlat.length > 0 || deletedOrdersFlat.size > 0) && result.idx) {
      await syncEvaluationFiles({
        evaluationIdx: result.idx,
        pendingFiles: pendingFilesFlat,
        deletedFileOrders: deletedOrdersFlat,
        existingFiles: evaluationFiles,
      });
    }

    await Swal.fire({
      title: "저장 완료",
      html: "KPI 본인 평가표가 저장되었습니다.<br/><span style='font-size:13px;color:#555;'>작성한 문서는 <b>평가문서 관리</b> 탭에서 확인할 수 있습니다.</span>",
      icon: "success",
      confirmButtonText: "확인",
      confirmButtonColor: "#1f4e79",
    });

    handleReset();

    if (editData && typeof onEditClear === "function") {
      onEditClear();
    }
  };

  const inputStyle = useMemo(() => inputSx(isMobile), [isMobile]);

  if (saving) return <LoadingScreen />;

  // ────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────────────────────
  return (
    <MDBox
      sx={{
        display: "flex", flexDirection: "column", height: "100%",
        userSelect: "text", "& *": { userSelect: "text" },
      }}
    >
      {/* 숨겨진 파일 입력 (행별 공유 — activeRowIdRef로 대상 행 추적, multiple) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (activeRowIdRef.current != null) {
            handleSelectRowFile(activeRowIdRef.current, e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* ── 상단 버튼 바 (스크롤 시 고정) ─────────────────────────────── */}
      <MDBox
        sx={{
          flexShrink: 0,
          pt: 1, pb: 1, px: 1,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1,
          flexWrap: "wrap",
          borderBottom: "1px solid #e8ecf0", background: "#fff",
        }}
      >
        {/* 왼쪽: 대분류 → 중분류 */}
        <MDBox sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            select size="small"
            value={selectedLargeType}
            onChange={(e) => onChangeLargeType(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 120 : 150 }}
          >
            <option value="" disabled>대분류</option>
            {largeTypeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </TextField>

          <TextField
            select size="small"
            value={selectedMiddleType}
            onChange={(e) => onChangeMiddleType(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 120 : 150 }}
            disabled={!selectedLargeType}
          >
            <option value="" disabled>중분류</option>
            {middleTypeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </TextField>
        </MDBox>

        {/* 오른쪽: 초기화 / 저장 */}
        <MDBox sx={{ display: "flex", gap: 1 }}>
          <MDButton
            variant="outlined" color="secondary" onClick={handleReset}
            sx={{ fontSize: isMobile ? 11 : 13 }}
          >
            초기화
          </MDButton>
          <MDButton
            variant="gradient" color="info" onClick={handleSave}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 90 : 110 }}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      {/* ── 스크롤 가능한 본문 영역 ────────────────────────────────────── */}
      <MDBox sx={{ flex: 1, overflowY: "auto", pt: 1 }}>

        {/* 대분류+중분류 미선택 시 안내 */}
        {(!selectedLargeType || !selectedMiddleType) && (
          <MDBox sx={{ p: 3, border: "1px dashed #bbb", borderRadius: 2, background: "#fafafa", m: 1 }}>
            대분류, 중분류를 선택하면 평가표가 표시됩니다.
          </MDBox>
        )}

        {selectedLargeType && selectedMiddleType && (
          <MDBox sx={sheetWrapSx(isMobile)}>

            {/* ── 평가표 헤더 ──────────────────────────────────────────── */}
            <MDBox sx={headerBarSx}>
              <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <img src={logo} alt="logo" style={{ height: isMobile ? 24 : 30 }} />
              </MDBox>
              <MDBox sx={titleSx(isMobile)}>
                {selectedDocName || "평가표"}
                {editData && <span style={{ fontSize: "0.7em", marginLeft: 8, opacity: 0.8 }}>(수정 중)</span>}
              </MDBox>
              <MDBox sx={{ width: isMobile ? 90 : 110 }} />
            </MDBox>

            {/* ── 평가 정보 섹션 ──────────────────────────────────────── */}
            <MDBox sx={sectionSx}>
              <MDBox sx={sectionTitleSx}>평가 정보</MDBox>
              <MDBox sx={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 400, fontSize: isMobile ? 11 : 12 }}>
                  <colgroup>
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "50%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thCell}>부서</th>
                      <th style={thCell}>작성자</th>
                      <th style={thCell}>평가기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={tdCell}>
                        <TextField
                          select size="small" fullWidth
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          SelectProps={{ native: true }}
                          disabled={!!loginDepartment}
                          sx={inputStyle}
                        >
                          <option value="" disabled>선택</option>
                          {departmentList.map((d) => (
                            <option key={String(d.department)} value={String(d.department)}>
                              {String(d.dept_name || d.department)}
                            </option>
                          ))}
                        </TextField>
                      </td>
                      <td style={tdCell}>
                        <TextField
                          select size="small" fullWidth
                          value={writerId}
                          onChange={(e) => setWriterId(e.target.value)}
                          SelectProps={{ native: true }}
                          disabled
                          sx={inputStyle}
                        >
                          <option value="" disabled>선택</option>
                          {writerList.map((u) => (
                            <option key={String(u.user_id)} value={String(u.user_id)}>
                              {String(u.user_name)}
                            </option>
                          ))}
                        </TextField>
                      </td>
                      <td style={{ ...tdCellCenter, color: "#333", fontWeight: 600 }}>
                        {selectedDocType?.start_time && selectedDocType?.end_time
                          ? `${selectedDocType.start_time.slice(0, 10)} ~ ${selectedDocType.end_time.slice(0, 10)}`
                          : <span style={{ color: "#bbb" }}>평가문서 설정에서 기간을 설정해주세요</span>
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </MDBox>
            </MDBox>

            {/* ── KPI 내용 섹션 ──────────────────────────────────────────── */}
            <MDBox sx={sectionSx}>
              <MDBox sx={{ ...sectionTitleSx, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>KPI 내용</span>
                <MDButton
                  variant="outlined" color="info" size="small" onClick={addRow}
                  sx={{ fontSize: 11, py: 0.2, px: 1 }}
                >
                  + 행 추가
                </MDButton>
              </MDBox>
              <MDBox sx={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900, fontSize: isMobile ? 11 : 12 }}>
                  <colgroup>
                    <col style={{ width: "3%" }} />   {/* No */}
                    <col style={{ width: "7%" }} />   {/* 업무 */}
                    <col style={{ width: "6%" }} />   {/* 목표 */}
                    <col style={{ width: "22%" }} />  {/* 측정방법 */}
                    <col style={{ width: "7%" }} />   {/* 가중치 */}
                    <col style={{ width: "7%" }} />   {/* 실적 */}
                    <col style={{ width: "28%" }} />  {/* 내용 */}
                    <col style={{ width: "11%" }} />  {/* 첨부파일 */}
                    <col style={{ width: "5%" }} />   {/* 삭제 */}
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
                      <th style={thCell}>행 삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRows.map((row, idx) => {
                      const pendingArr = rowPendingFiles[row.id] || [];
                      const savedArr = rowSavedFileMap[row.id] || [];
                      const deletedOrders = rowDeletedOrders[row.id] || [];
                      const totalCount = pendingArr.length + savedArr.length;

                      return (
                        <tr key={row.id}>
                          {/* 순번 */}
                          <td style={{ ...tdCellCenter, fontWeight: 700 }}>{idx + 1}</td>

                          {/* 업무 타입 */}
                          <td style={tdCellCenter}>
                            <TextField
                              select size="small" fullWidth
                              value={row.type}
                              onChange={(e) => onChangeRow(row.id, "type", e.target.value)}
                              SelectProps={{ native: true }}
                              sx={inputStyle}
                            >
                              <option value="">-</option>
                              {TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </TextField>
                          </td>

                          {/* 목표 (%) */}
                          <td style={tdCellCenter}>
                            <TextField
                              size="small" fullWidth
                              value={row.goal}
                              onChange={(e) => onChangeRow(row.id, "goal", normalizePercentValue(e.target.value))}
                              sx={percentInputSx}
                              placeholder="0"
                              inputProps={{ style: { textAlign: "right", fontSize: 11, padding: "6px 2px 4px 4px" } }}
                              InputProps={{ endAdornment: <span style={percentAdornSx}>%</span> }}
                            />
                          </td>

                          {/* 측정방법 — height:1px 트릭으로 행 높이에 맞춰 textarea 자동 확장 */}
                          <td style={{ ...tdCellTop, height: "1px" }}>
                            <TextField
                              multiline minRows={4} size="small" fullWidth
                              value={row.measurement}
                              onChange={(e) => onChangeRow(row.id, "measurement", e.target.value)}
                              sx={textareaStretchSx}
                              placeholder="측정방법"
                            />
                          </td>

                          {/* 가중치 (%) */}
                          <td style={tdCellCenter}>
                            <TextField
                              size="small" fullWidth
                              value={row.weight}
                              onChange={(e) => onChangeRow(row.id, "weight", normalizePercentValue(e.target.value))}
                              sx={percentInputSx}
                              placeholder="0"
                              inputProps={{ style: { textAlign: "right", fontSize: 11, padding: "6px 2px 4px 4px" } }}
                              InputProps={{ endAdornment: <span style={percentAdornSx}>%</span> }}
                            />
                          </td>

                          {/* 실적 (%) */}
                          <td style={tdCellCenter}>
                            <TextField
                              size="small" fullWidth
                              value={row.performance}
                              onChange={(e) => onChangeRow(row.id, "performance", normalizePercentValue(e.target.value))}
                              sx={percentInputSx}
                              placeholder="0"
                              inputProps={{ style: { textAlign: "right", fontSize: 11, padding: "6px 2px 4px 4px" } }}
                              InputProps={{ endAdornment: <span style={percentAdornSx}>%</span> }}
                            />
                          </td>

                          {/* 내용 — height:1px 트릭으로 행 높이에 맞춰 textarea 자동 확장 */}
                          <td style={{ ...tdCellTop, height: "1px" }}>
                            <TextField
                              multiline minRows={4} size="small" fullWidth
                              value={row.content}
                              onChange={(e) => onChangeRow(row.id, "content", e.target.value)}
                              sx={textareaStretchSx}
                              placeholder="내용"
                            />
                          </td>

                          {/* 첨부파일 (행별 최대 10개) */}
                          <td style={{ ...tdCellTop, padding: "4px 4px", textAlign: "center", verticalAlign: totalCount === 0 ? "middle" : "top", overflow: "hidden" }}>
                            <MDBox sx={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", width: "100%", overflow: "hidden" }}>
                              {/* 신규 선택 파일 목록 */}
                              {pendingArr.map((pf, pfIdx) => (
                                <MDBox key={pfIdx} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", width: "100%", minWidth: 0 }}>
                                  <MDBox sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <MDBox sx={rowThumbSx}>
                                      {renderFileThumbnail({
                                        kind: getFileKind(pf.name),
                                        fileViewUrl: pf.previewUrl,
                                        fileName: pf.name,
                                        canPreview: ["image", "pdf", "excel"].includes(getFileKind(pf.name)),
                                        onPreview: () => openPreview(pf.previewUrl, pf.name),
                                      })}
                                    </MDBox>
                                    <IconButton size="small" color="error" onClick={() => handleRemoveRowPendingFile(row.id, pfIdx)} sx={rowIconBtnSx}>
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </MDBox>
                                  <span style={rowFileNameSx}>{pf.name}</span>
                                </MDBox>
                              ))}
                              {/* 저장된 파일 목록 */}
                              {savedArr.map((sf) => {
                                const sfDeleted = deletedOrders.includes(Number(sf.image_order));
                                return (
                                  <MDBox key={sf.image_order} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", width: "100%", minWidth: 0, opacity: sfDeleted ? 0.4 : 1 }}>
                                    <MDBox sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <MDBox sx={rowThumbSx}>
                                        {sfDeleted ? null : renderFileThumbnail({
                                          kind: getFileKind(sf.image_name),
                                          fileViewUrl: `${API_BASE_URL}${sf.image_path}`,
                                          fileName: sf.image_name,
                                          canPreview: ["image", "pdf", "excel"].includes(getFileKind(sf.image_name)),
                                          onPreview: () => openPreview(`${API_BASE_URL}${sf.image_path}`, sf.image_name),
                                        })}
                                      </MDBox>
                                      <IconButton size="small" color={sfDeleted ? "warning" : "error"} onClick={() => handleDeleteRowSavedFile(row.id, Number(sf.image_order))} sx={rowIconBtnSx}>
                                        {sfDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                      </IconButton>
                                    </MDBox>
                                    <span style={{ ...rowFileNameSx, color: sfDeleted ? "#888" : "#444" }}>
                                      {sfDeleted ? "삭제예정" : (sf.image_name || "")}
                                    </span>
                                  </MDBox>
                                );
                              })}
                              {/* 첨부 추가 버튼 (10개 미만일 때) */}
                              {totalCount < 10 && (
                                <MDButton
                                  variant="outlined" size="small"
                                  onClick={() => { activeRowIdRef.current = row.id; fileInputRef.current?.click(); }}
                                  sx={{ fontSize: 10, py: 0.3, px: 0.8, minWidth: 0, color: "#1f4e79", borderColor: "#cfd8e3" }}
                                >
                                  {totalCount === 0 ? "첨부" : "+ 추가"}
                                </MDButton>
                              )}
                            </MDBox>
                          </td>

                          {/* 행 삭제 버튼 */}
                          <td style={tdCellCenter}>
                            <IconButton
                              size="small" color="error"
                              onClick={() => removeRow(row.id)}
                              disabled={kpiRows.length <= 1}
                              sx={{ width: 26, height: 26 }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}

                    {/* 가중치 합계 행 */}
                    <tr>
                      <td colSpan={4} style={{ ...tdCellCenter, fontWeight: 800, background: "#f3f6fb" }}>
                        가중치 합계
                      </td>
                      <td style={{ ...tdCellCenter, fontWeight: 900, background: "#fffde7", color: "#e65100" }}>
                        {kpiRows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0)}%
                      </td>
                      <td colSpan={4} style={{ ...tdCellCenter, background: "#f3f6fb" }} />
                    </tr>
                  </tbody>
                </table>
              </MDBox>
            </MDBox>

            {/* ── 확인란 섹션 ─────────────────────────────────────────────── */}
            <MDBox sx={sectionSx}>
              <MDBox sx={{ p: 2 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      {(() => {
                        // approval_position 설정값 기준으로 도장 칸 구성
                        // 0=대표이사, 1=인사팀장, 2=실장, 3=팀장, 4=팀원확인만
                        const stamps = [
                          { label: "본인", content: writerName ? <Stamp name={writerName} /> : null },
                          ...(approvalPosition <= 3 ? [{ label: "팀장", content: null }] : []),
                          ...(approvalPosition <= 2 ? [{ label: "실장", content: null }] : []),
                          ...(approvalPosition <= 1 ? [{ label: "인사팀장", content: null }] : []),
                          ...(approvalPosition <= 0 ? [{ label: "대표이사", content: null }] : []),
                        ];
                        const w = `${(100 / (stamps.length * 2)).toFixed(2)}%`;
                        return stamps.map(({ label, content }) => (
                          <React.Fragment key={label}>
                            <td style={{ ...thCell, width: w }}>{label}</td>
                            <td style={{ ...tdCellCenter, width: w, height: 72 }}>{content}</td>
                          </React.Fragment>
                        ));
                      })()}
                    </tr>
                  </tbody>
                </table>
              </MDBox>
            </MDBox>

          </MDBox>
        )}
      </MDBox>

      {/* 미리보기 오버레이 */}
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

// ────────────────────────────────────────────────────────────────────────────
// 썸네일 렌더링 헬퍼
// ────────────────────────────────────────────────────────────────────────────
function renderFileThumbnail({ kind, fileViewUrl, fileName, canPreview, onPreview }) {
  if (kind === "image") {
    return canPreview ? (
      <MDBox
        component="button" type="button"
        onClick={onPreview}
        sx={{ border: "none", background: "none", p: 0, width: "100%", height: "100%", cursor: "pointer" }}
      >
        <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </MDBox>
    ) : (
      <MDBox component="img" src={fileViewUrl} alt={fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
    );
  }

  if (kind === "pdf") {
    return (
      <MDBox
        component={canPreview ? "button" : "span"} type={canPreview ? "button" : undefined}
        onClick={canPreview ? onPreview : undefined}
        sx={{ ...pdfThumbBtnSx, cursor: canPreview ? "pointer" : "default" }}
      >
        <MDBox
          component="iframe"
          title={`pdf-thumb`}
          src={toPdfThumbSrc(fileViewUrl)}
          loading="lazy"
          sx={pdfThumbFrameSx}
        />
        <MDBox component="span" sx={pdfThumbLabelSx}>PDF</MDBox>
      </MDBox>
    );
  }

  const label = kind === "excel" ? "XLSX" : getFileExtLabel(fileName);
  const bgColor = kind === "excel" ? "#e8f5e9" : "#edf4ff";
  const textColor = kind === "excel" ? "#2e7d32" : "#1f4e79";
  return canPreview ? (
    <MDBox
      component="button" type="button"
      onClick={onPreview}
      sx={{ border: "none", width: "100%", height: "100%", cursor: "pointer", fontSize: 11, fontWeight: 800, color: textColor, backgroundColor: bgColor }}
    >
      {label}
    </MDBox>
  ) : (
    <MDBox sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: textColor, backgroundColor: bgColor }}>
      {label}
    </MDBox>
  );
}

function toPdfThumbSrc(fileUrl) {
  const baseUrl = String(fileUrl ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

// ────────────────────────────────────────────────────────────────────────────
// 확인 도장 컴포넌트
// ────────────────────────────────────────────────────────────────────────────
function Stamp({ name }) {
  const n = String(name || "").trim();
  return (
    <div style={{
      display: "inline-flex",
      width: 80, height: 52,
      borderRadius: 999,
      border: "2px solid #d32f2f",
      alignItems: "center", justifyContent: "center",
      color: "#d32f2f", fontWeight: 900, letterSpacing: 1,
      transform: "rotate(-6deg)",
      background: "rgba(211,47,47,0.06)",
      userSelect: "none",
      fontSize: 13,
    }}>
      {n}
    </div>
  );
}

Stamp.propTypes = {
  name: PropTypes.string,
};

EvaluationDocumentSheetTab.propTypes = {
  editData: PropTypes.object,
  onEditClear: PropTypes.func,
};

// ────────────────────────────────────────────────────────────────────────────
// 파일 유틸 함수
// ────────────────────────────────────────────────────────────────────────────
function getFileKind(fileName) {
  const ext = String(fileName || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  return "file";
}

function getFileExtLabel(fileName) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "FILE";
  const ext = name.substring(dot + 1).toUpperCase();
  return ext === "JPEG" ? "JPG" : ext || "FILE";
}

// ────────────────────────────────────────────────────────────────────────────
// 스타일 상수
// ────────────────────────────────────────────────────────────────────────────

const sheetWrapSx = (isMobile) => ({
  border: "1px solid #cfd8e3", borderRadius: 2, overflow: "hidden",
  background: "#fff", mx: 1, mb: 2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)", fontSize: isMobile ? 11 : 12,
});

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

const thCell = {
  border: "1px solid #cfd8e3", background: "#f3f6fb",
  padding: "6px 8px", textAlign: "center", fontWeight: 800, whiteSpace: "nowrap",
};
const tdCell = { border: "1px solid #cfd8e3", padding: "4px 4px", background: "#fff" };
const tdCellCenter = {
  border: "1px solid #cfd8e3", padding: "4px 6px",
  background: "#fff", textAlign: "center", verticalAlign: "middle",
};
const tdCellTop = {
  border: "1px solid #cfd8e3", padding: "4px 4px",
  background: "#fff", verticalAlign: "top",
};

const inputSx = (isMobile) => ({
  "& .MuiInputBase-input": { fontSize: isMobile ? 11 : 12, padding: isMobile ? "4px 6px" : "5px 8px" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cfd8e3" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1f4e79" },
});

const textareaSx = {
  "& .MuiInputBase-inputMultiline": { fontSize: 12 },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cfd8e3" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1f4e79" },
};

// 테이블 행 높이에 맞춰 자동으로 늘어나는 textarea 스타일
// td에 height:"1px" 설정 시 height:100%가 실제 행 높이를 채움
const textareaStretchSx = {
  ...textareaSx,
  height: "100%",
  "& .MuiInputBase-root": {
    height: "100%",
    alignItems: "flex-start",
  },
  "& .MuiInputBase-inputMultiline": {
    fontSize: 12,
    height: "100% !important",
    overflowY: "auto !important",
    resize: "none",
    boxSizing: "border-box",
  },
};

const percentInputSx = {
  "& .MuiOutlinedInput-root": { paddingRight: "4px" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cfd8e3" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1f4e79" },
};

const percentAdornSx = { fontSize: 11, color: "#888", userSelect: "none", lineHeight: 1, flexShrink: 0 };

// 행별 첨부파일 썸네일 박스
const rowThumbSx = {
  width: 48, height: 56,
  borderRadius: "3px", overflow: "hidden", flexShrink: 0,
  border: "1px solid #d0d7e2", backgroundColor: "#f1f4f8",
  display: "flex", alignItems: "center", justifyContent: "center",
};

// 파일명: 한 줄, 가운데 정렬, 넘치면 ellipsis
const rowFileNameSx = {
  fontSize: 9, color: "#444",
  width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  display: "block", lineHeight: 1.3, textAlign: "center",
};

const rowIconBtnSx = { width: 28, height: 28, borderRadius: "4px", flexShrink: 0 };

// PDF 썸네일 버튼
const pdfThumbBtnSx = {
  width: "100%", height: "100%", border: "none", p: 0,
  backgroundColor: "#fff", position: "relative",
};
const pdfThumbFrameSx = {
  width: "100%", height: "100%", border: 0,
  pointerEvents: "none", backgroundColor: "#fff",
};
const pdfThumbLabelSx = {
  position: "absolute", right: 4, bottom: 4,
  px: 0.5, py: 0.1, borderRadius: "4px", fontSize: 9, fontWeight: 800,
  color: "#fff", backgroundColor: "rgba(198,40,40,0.9)", lineHeight: 1.2,
};
