// src/layouts/hygiene/HygieneSheetTab.js
import React, { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { ChevronRight, X } from "lucide-react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { Box, ButtonBase, Dialog, DialogTitle, DialogContent, IconButton, MenuItem, Select, TextField, useTheme, useMediaQuery, Autocomplete } from "@mui/material";
import useHygienesheetData, { sortHygieneRows } from "./hygienesheetData";
import HygieneCardBoard, {
  compressImageFile,
  getHygieneSaveError,
  getHygienePendingSummary,
  HygieneCategoryChips,
  HygieneSummaryStatus,
  useFillViewportHeight,
} from "utils/HygieneCardBoard";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
// 이 화면의 알림·확인창은 바깥(검은 배경) 클릭으로 닫히지 않는 Swal 사용
import { LockedSwal as Swal, showSwalLoading } from "utils/swalLoading";
import { API_BASE_URL } from "config";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import PreviewOverlay from "utils/PreviewOverlay";
import accountLabelSx from "utils/accountLabelSx";
import { askUnsavedChanges, setTabLeaveGuard } from "utils/unsavedChangesGuard";
import useDetailBackGuard from "utils/useDetailBackGuard";

const monthLabel = (key) => key ? key.replace("-", "년 ") + "월" : "등록일 미기록 · 전체 기간";

function HygieneSheetTab({ onPendingCount }) {
  const currentMonth = dayjs().format("YYYY-MM");
  const [monthListOpen, setMonthListOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ localStorage account_id로 거래처 고정 + 셀렉트 필터링
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [accountInput, setAccountInput] = useState("");
  const isAccountLocked = !!localAccountId;
  // 조회 시작 전/후 깜빡임 방지를 위한 화면 로딩 상태
  const [viewLoading, setViewLoading] = useState(true);
  const loadingStartedRef = useRef(false);
  // 미저장 변경 확인 후 이동 가능 여부 (저장 함수가 아래에서 정의되어 ref로 참조, 렌더마다 최신 함수로 교체)
  const leaveCheckRef = useRef(async () => true);
  // 카드 영역 ref와 화면 맨 아래까지 채우는 높이
  const [boardAreaRef, boardAreaHeight] = useFillViewportHeight();

  // 탭 이동 전 미저장 변경 확인 등록 (운영관리·현장 탭 묶음에서 탭을 바꾸기 전에 호출)
  useEffect(() => setTabLeaveGuard(() => leaveCheckRef.current()), []);

  const {
    hygieneListRows,
    accountList,
    loading,
    fetcHygieneList,
    categoryList,
    fetchHygieneCategoryList,
  } = useHygienesheetData();

  // 상세 화면 카테고리 key (null: 전체 요약 화면, "": 구분 없음)
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(null);
  // 전체 요약 화면 상태 필터 (전체 / 조치 필요 / 완료 / 점검완료 / 미점검)
  const [statusFilter, setStatusFilter] = useState("전체");

  // 등록일자 → 구분 → 등록 순서로 정렬한 행 (카테고리 구분은 카드 화면에서 처리)
  const accountRows = useMemo(
    () => hygieneListRows.filter((row) => String(row.account_id) === String(selectedAccountId)),
    [hygieneListRows, selectedAccountId]
  );
  const pending = useMemo(() => getHygienePendingSummary(accountRows), [accountRows]);
  useEffect(() => {
    if (localAccountId && !loading) onPendingCount?.(pending.count);
  }, [pending.count, loading, localAccountId, onPendingCount]);

  const filteredHygieneRows = useMemo(() => {
    const visible = month ? accountRows.filter((row) => row.reg_dt?.startsWith(month)) : accountRows;
    return sortHygieneRows(visible, categoryList);
  }, [accountRows, categoryList, month]);

  // 연도 선택 목록: 이 거래처 점검 기록이 있는 연도 + 올해(최신순)
  const yearOptions = useMemo(() => {
    const years = new Set([currentMonth.slice(0, 4)]);
    accountRows.forEach((row) => row.reg_dt && years.add(row.reg_dt.slice(0, 4)));
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [accountRows, currentMonth]);
  // 선택한 점검 연도·월("" 이면 전체 기간)
  const filterYear = month.slice(0, 4);
  const filterMonth = month.slice(5, 7);

  const changeMonth = async (nextMonth, filter) => {
    if (!(await leaveCheckRef.current())) return;
    setMonthListOpen(false);
    setMonth(nextMonth);
    setStatusFilter(filter);
    setSelectedCategoryKey(null);
  };

  // ✅ localStorage account_id 기준으로 거래처 리스트 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  const imageCols = ["problem_image", "clean_image"];

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (filteredAccountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [filteredAccountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  useEffect(() => {
    if (!isAccountLocked || !selectedAccountId) return;
    const matched = (accountList || []).find(
      (acc) => String(acc.account_id) === String(selectedAccountId)
    );
    if (matched) {
      setAccountInput(matched.account_name || "");
    }
  }, [accountList, isAccountLocked, selectedAccountId]);

  // 거래처 변경 시 로딩을 먼저 시작하고 조회를 트리거
  const beginListLoading = useCallback(() => {
    setViewLoading(true);
    loadingStartedRef.current = false;
  }, []);

  const setSelectedAccountWithLoading = useCallback(
    async (nextAccountId) => {
      const nextId = String(nextAccountId ?? "");
      if (nextId === String(selectedAccountId ?? "")) return;
      // 미저장 변경이 있으면 확인 (취소 시 거래처 입력칸을 현재 거래처명으로 되돌림)
      if (!(await leaveCheckRef.current())) {
        setAccountInput(selectedAccountOption?.label || "");
        return;
      }
      beginListLoading();
      setSelectedAccountId(nextId);
    },
    [beginListLoading, selectedAccountId, selectedAccountOption]
  );

  const selectAccountByInput = useCallback(() => {
    if (isAccountLocked) return;
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact || list.find((o) => String(o?.label || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountWithLoading(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions, isAccountLocked, setSelectedAccountWithLoading]);

  // 거래처 변경 시 위생점검 카테고리 목록 조회, 전체 요약 화면으로 초기화
  useEffect(() => {
    setSelectedCategoryKey(null);
    setStatusFilter("전체");
    fetchHygieneCategoryList(selectedAccountId);
  }, [selectedAccountId, fetchHygieneCategoryList]);

  // 거래처 변경 시 데이터 조회
  useEffect(() => {
    if (selectedAccountId) {
      fetcHygieneList(selectedAccountId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  // ✅ 거래처 기본값
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    if (localAccountId) {
      setSelectedAccountWithLoading(localAccountId);
      return;
    }

    if (!selectedAccountId) {
      setSelectedAccountWithLoading(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId, localAccountId, setSelectedAccountWithLoading]);

  // 서버 rows → 로컬 rows / originalRows 복사
  useLayoutEffect(() => {
    const deepCopy = filteredHygieneRows.map((row) => ({
      ...row,
      del_yn: row.del_yn ?? "N", // ✅ 없으면 기본 N
    }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
    // 조회 결과가 화면 상태에 반영된 뒤 로딩 종료
    if (selectedAccountId) {
      setViewLoading(false);
    }
  }, [filteredHygieneRows, selectedAccountId]);

  useEffect(() => {
    if (!viewLoading) return;

    if (loading) {
      loadingStartedRef.current = true;
      return;
    }

    if (loadingStartedRef.current) {
      setViewLoading(false);
      loadingStartedRef.current = false;
    }
  }, [loading, viewLoading]);

  // cell 값 변경 처리
  const handleCellChange = useCallback((rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
  }, []);

  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ 값 비교 통일(이미지는 File 객체면 변경으로 간주)
  const isSameValue = (key, original, current) => {
    if (imageCols.includes(key)) {
      // File 객체가 하나라도 있으면 변경으로 간주(재업로드)
      if (typeof original === "object" || typeof current === "object") return false;
      return String(original ?? "") === String(current ?? "");
    }
    if (typeof original === "string" && typeof current === "string") {
      return normalize(original) === normalize(current);
    }
    return original === current;
  };

  // 상세 화면에서 선택한 카테고리로 항목(행) 추가
  const handleAddRow = (categoryKey) => {
    const newRow = {
      account_id: selectedAccountId,
      category_key: categoryKey || "",
      reg_dt: "",
      problem_note: "",
      mod_dt: "",
      clean_note: "",
      note: "",
      problem_image: "",
      clean_image: "",
      del_yn: "N", // ✅ 기본 N
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, { ...newRow }]);
  };

  // 이미지 뷰어
  const handleViewImage = useCallback((value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  }, []);

  // 미리보기 창 닫기 (새로 고른 파일의 임시 주소 해제)
  const handleCloseViewer = useCallback(() => {
    setViewImageSrc((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // 미리보기 창에 넘길 사진 목록 (서버 사진은 파일명, 새로 고른 파일은 기본 이름 표시)
  const viewerFiles = useMemo(() => {
    if (!viewImageSrc) return [];
    const name = viewImageSrc.startsWith("blob:") ? "점검 사진" : viewImageSrc.split("/").pop() || "점검 사진";
    return [{ url: viewImageSrc, name, kind: "image" }];
  }, [viewImageSrc]);

  // 사진을 축소한 뒤 서버에 업로드하고 저장 경로 반환
  const uploadImage = async (file, imageDt, account_id) => {
    try {
      const formData = new FormData();
      formData.append("file", await compressImageFile(file));
      formData.append("type", "hygiene");
      formData.append("gubun", imageDt);
      formData.append("folder", account_id);

      const res = await api.post("/Operate/OperateImgUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.code === 200 && res.data.image_path?.trim()) {
        return res.data.image_path;
      }
      throw new Error("업로드된 사진 경로를 확인할 수 없습니다.");
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: "이미지 업로드 실패",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      throw err;
    }
  };

  // ✅ 다운로드 (서버 경로 문자열일 때만)
  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = buildFileDownloadUrl(path);
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

  // ✅ 행 삭제: del_yn=Y 로 서버 저장 → 성공하면 화면에서만 제거(재조회 X)
  const handleDeleteRow = async (rowIndex) => {
    if (rowIndex == null) return;
    const row = rows[rowIndex];
    if (!row) return;

    const result = await Swal.fire({
      title: "행 삭제",
      text: "해당 행을 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#9e9e9e",
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });

    if (!result.isConfirmed) return;

    try {
      const deleteRow = {
        idx: row.idx,
        account_id: selectedAccountId || row.account_id,
        del_yn: "Y",
        mod_user_id: localStorage.getItem("user_id") || "",
      };
      const response = await api.post("/Operate/HygieneSave", [deleteRow], {
        headers: { "Content-Type": "application/json" },
      });

      if (response?.data?.code === 200) {
        // ✅ 재조회 없이 화면에서만 제거
        setRows((prev) => prev.filter((_, i) => i !== rowIndex));
        setOriginalRows((prev) => prev.filter((_, i) => i !== rowIndex));

        Swal.fire({
          title: "삭제",
          text: "삭제 처리되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      } else {
        Swal.fire({
          title: "오류",
          text: "삭제 저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "오류",
        text: "삭제 저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  const columns = useMemo(
    () => [
      { header: "구분", accessorKey: "category_key", size: 130 },
      { header: "등록일자", accessorKey: "reg_dt", size: 100 },
      { header: "조치 전 사진", accessorKey: "problem_image", size: 220 },
      { header: "전달 내용", accessorKey: "problem_note", size: 160 },
      { header: "조치일자", accessorKey: "mod_dt", size: 100 },
      { header: "조치 사진", accessorKey: "clean_image", size: 220 },
      { header: "조치 내용", accessorKey: "clean_note", size: 160 },
      { header: "비고", accessorKey: "note", size: 160 },
    ],
    []
  );

  // 항목(행) 변경 여부 (신규 행 또는 컬럼 값이 조회값과 다른 경우, 카드 수정 표시용)
  const isRowChanged = (rowIndex) => {
    const row = rows[rowIndex] || {};
    const original = originalRows[rowIndex] || {};
    return (
      !!row.isNew ||
      columns.some((col) => !isSameValue(col.accessorKey, original[col.accessorKey], row[col.accessorKey]))
    );
  };

  // 로그인 사용자 아이디 (저장 시 reg_user_id·mod_user_id)
  const loginUserId = localStorage.getItem("user_id") || "";

  // 저장 진행 중 여부 (빠른 연속 클릭 시 신규 행이 두 번 INSERT되는 것 방지)
  const savingRef = useRef(false);

  // 저장 (성공 시 true 반환, 미저장 확인 모달의 저장 후 이동에서도 사용)
  const saveError = getHygieneSaveError(rows, originalRows);
  const handleSave = async () => {
    if (saveError) {
      await Swal.fire({ title: "입력 확인", text: saveError, icon: "info" });
      return false;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    // 사진 업로드~저장 완료까지 로딩 창 표시 (저장 결과 알림이 뜨면 그 창으로 교체됨)
    showSwalLoading("저장 중...", "사진 업로드 및 저장 중입니다.");
    try {
      return await saveHygieneRows();
    } finally {
      savingRef.current = false;
    }
  };

  // 변경·신규 행의 사진 업로드 후 위생점검 행 저장
  const saveHygieneRows = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, index) => {
          const original = originalRows[index] || {};

          // ✅ 변경 감지: 공통 비교 로직 사용 + 신규행
          const isChanged =
            row.isNew ||
            columns.some((col) => {
              const key = col.accessorKey;
              return !isSameValue(key, original[key], row[key]);
            });

          if (!isChanged) return null;

          // 조치 전(사진·전달 메모)·조치 후(사진·조치 메모) 중 바뀐 쪽 판단
          const isSideChanged = (keys) => keys.some((key) => !isSameValue(key, original[key], row[key]));
          const beforeChanged = row.isNew || isSideChanged(["problem_image", "problem_note"]);
          const afterChanged = isSideChanged(["clean_image", "clean_note"]);

          const updatedRow = row.isNew ? { ...row } : { idx: row.idx };
          if (!row.isNew) {
            for (const key of ["reg_dt", "mod_dt", "note", "category_key"]) {
              if (isSideChanged([key])) updatedRow[key] = row[key];
            }
            if (beforeChanged) Object.assign(updatedRow, { problem_image: row.problem_image, problem_note: row.problem_note });
            if (afterChanged) Object.assign(updatedRow, { clean_image: row.clean_image, clean_note: row.clean_note });
          }

          // 바뀐 쪽만 사용자 갱신 (등록일자·조치일자는 화면에서 직접 입력)
          if (beforeChanged) updatedRow.reg_user_id = loginUserId;
          if (afterChanged) updatedRow.mod_user_id = loginUserId;

          // 이미지 처리
          for (const field of imageCols) {
            if (row[field] && typeof row[field] === "object") {
              let uploadedPath = "";
              if (field === "problem_image") {
                uploadedPath = await uploadImage(row[field], row.reg_dt, selectedAccountId);
              } else if (field === "clean_image") {
                uploadedPath = await uploadImage(row[field], row.mod_dt, selectedAccountId);
              }
              updatedRow[field] = uploadedPath;
            }
          }

          return {
            ...updatedRow,
            account_id: selectedAccountId || row.account_id,
            del_yn: updatedRow.del_yn ?? "N",
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      if (payload.length === 0) {
        Swal.fire({
          title: "안내",
          text: "변경된 내용이 없습니다.",
          icon: "info",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        return false;
      }

      const response = await api.post("/Operate/HygieneSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        await fetcHygieneList(selectedAccountId);
        return true;
      } else {
        Swal.fire({
          title: "오류",
          text: "저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (error) {
      Swal.fire({
        title: "실패",
        text: "저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      console.error(error);
    }
    return false;
  };

  // 미저장 변경이 있으면 저장 후 이동 / 취소 후 이동 / 취소 확인 (true: 이동 가능)
  // 취소 후 이동: 추가한 새 항목은 빼고 마지막 조회 상태로 되돌림 (카테고리 이동처럼 다시 조회하지 않는 경우 대비)
  leaveCheckRef.current = async () => {
    if (!rows.some((_, index) => isRowChanged(index))) return true;
    const choice = await askUnsavedChanges();
    if (choice === "cancel") return false;
    if (choice === "save") return handleSave();
    const savedRows = originalRows.filter((row) => !row.isNew);
    setRows(savedRows);
    setOriginalRows(savedRows);
    return true;
  };

  // 카테고리 칩·전체로 이동·요약 카드 선택 (미저장 변경이 있으면 확인 후 이동)
  // 이동하면 true, 미저장 확인에서 취소하면 false
  const handleSelectCategory = async (nextKey) => {
    if (nextKey === selectedCategoryKey) return true;
    if (!(await leaveCheckRef.current())) return false;
    setSelectedCategoryKey(nextKey);
    return true;
  };

  // 카테고리 상세 화면에서 브라우저 뒤로가기 시 전체 요약 화면으로 이동
  useDetailBackGuard(selectedCategoryKey !== null, () => handleSelectCategory(null));

  if (loading || viewLoading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 버튼 (모바일 대응) */}
      <MDBox
        pt={0}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: "wrap",
          position: "sticky",
          zIndex: 10,
          // 상위 FieldBoardTabs 헤더/탭 sticky 영역 아래에 고정 (좁은 화면은 헤더가 높아 88)
          top: { xs: 88, md: 78 },
          backgroundColor: "#ffffff",
        }}
      >
        {/* 전체 점검 현황 (요약·상세 화면 모두 상단 고정 표시) */}
        <Box sx={{ display: "flex", gap: 1, mr: "auto", maxWidth: "100%", alignItems: "stretch" }}>
          <HygieneSummaryStatus rows={rows} isMobile={isMobile} />
          {selectedCategoryKey === null && pending.count > 0 && (
            <>
              <ButtonBase
                aria-haspopup={pending.months.length > 1 ? "dialog" : undefined}
                onClick={() => {
                  if (pending.months.length === 1) changeMonth(pending.months[0][0], "조치필요");
                  else setMonthListOpen(true);
                }}
                sx={{
                  minHeight: 40, px: { xs: 1, md: 1.5 }, gap: 0.75, alignSelf: "stretch",
                  bgcolor: "#fff6e9", color: "#753f15", border: "1px solid #eac398", borderRadius: "10px",
                  "&:hover": { bgcolor: "#ffefd9" },
                  "&.Mui-focusVisible": { outline: "2px solid #935319", outlineOffset: 2 },
                }}>
                <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75,
                  flexDirection: { xs: "column", sm: "row" }, whiteSpace: "nowrap", fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>
                  누적 미조치 사항
                  <strong style={{ fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{pending.count}건</strong>
                </Box>
                <ChevronRight size={15} aria-hidden="true" />
              </ButtonBase>
              <Dialog open={monthListOpen} onClose={() => setMonthListOpen(false)} fullWidth maxWidth="xs"
                aria-labelledby="hygiene-month-list-title">
                <DialogTitle id="hygiene-month-list-title"
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  월별 미조치 내역
                  <IconButton size="small" aria-label="닫기" onClick={() => setMonthListOpen(false)}>
                    <X size={20} />
                  </IconButton>
                </DialogTitle>
                <DialogContent sx={{ pt: "8px !important" }}>
                  <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", px: 2, py: 1,
                      bgcolor: "#f8fafc", color: "#475569", fontSize: 13, fontWeight: 600 }}>
                      <span>점검 연월</span><span>미조치 건수</span>
                    </Box>
                    {pending.months.map(([key, count]) => (
                      <ButtonBase key={key} onClick={() => changeMonth(key, "조치필요")}
                        sx={{ width: "100%", minHeight: 48, px: 2, gap: 1, justifyContent: "space-between",
                          borderTop: "1px solid #e2e8f0", bgcolor: "#fff", color: "#344767", fontSize: 15,
                          "&:hover, &.Mui-focusVisible": { bgcolor: "#eef5ff" },
                          "&.Mui-focusVisible": { outline: "2px solid #1a73e8", outlineOffset: -2 } }}>
                        <span>{monthLabel(key)}</span>
                        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1,
                          color: "#245d9c", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {count}건 <ChevronRight size={16} aria-hidden="true" />
                        </Box>
                      </ButtonBase>
                    ))}
                  </Box>
                </DialogContent>
              </Dialog>
            </>
          )}
        </Box>

        {/* 상세 화면 전체로 이동 버튼과 카테고리 칩 (연·월·거래처 필터 왼쪽, 상단 고정) */}
        <HygieneCategoryChips
          rows={rows}
          categoryList={categoryList}
          selectedKey={selectedCategoryKey}
          onSelectKey={handleSelectCategory}
          isMobile={isMobile}
        />

        {/* 점검 연도·월 필터(연도에서 전체를 고르면 전체 기간) */}
        <Select size="small" displayEmpty value={filterYear}
          inputProps={{ "aria-label": "점검 연도" }}
          MenuProps={{ PaperProps: { sx: { "& .MuiMenuItem-root": { fontSize: 16 } } } }}
          sx={{ minWidth: 110, height: 40, "&& .MuiSelect-select": { fontSize: 16 } }}
          onChange={(event) => changeMonth(event.target.value ? `${event.target.value}-${filterMonth || currentMonth.slice(5, 7)}` : "", "전체")}>
          <MenuItem value="">전체</MenuItem>
          {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
        </Select>
        <Select size="small" displayEmpty value={filterMonth} disabled={!filterYear}
          inputProps={{ "aria-label": "점검 월" }}
          MenuProps={{ PaperProps: { sx: { "& .MuiMenuItem-root": { fontSize: 16 } } } }}
          sx={{ minWidth: 90, height: 40, "&& .MuiSelect-select": { fontSize: 16 } }}
          onChange={(event) => changeMonth(`${filterYear}-${event.target.value}`, "전체")}>
          {!filterYear && <MenuItem value="">전체</MenuItem>}
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
            <MenuItem key={m} value={m}>{Number(m)}월</MenuItem>
          ))}
        </Select>
        {(filteredAccountList || []).length > 0 && (
          <Autocomplete
            size="small"
            sx={{ minWidth: isMobile ? 180 : 220 }}
            options={accountOptions}
            value={selectedAccountOption}
            disabled={isAccountLocked}
            onChange={(_, opt) => {
              if (isAccountLocked) return;
              // 입력 비움 시 거래처 선택 유지
              if (!opt) return;
              setSelectedAccountWithLoading(opt.value);
            }}
            inputValue={accountInput}
            onInputChange={(_, newValue) => {
              if (isAccountLocked) return;
              setAccountInput(newValue);
            }}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            filterOptions={(options, state) => {
              const q = (state.inputValue ?? "").trim().toLowerCase();
              if (!q) return options;
              return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={isAccountLocked ? "거래처(고정)" : "거래처"}
                placeholder={isAccountLocked ? "거래처가 고정되어 있습니다" : "거래처명을 입력"}
                onKeyDown={(e) => {
                  if (isAccountLocked) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectAccountByInput();
                  }
                }}
                sx={{
                  "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                  "& .MuiInputLabel-root": { fontSize: 12 },
                  ...accountLabelSx,
                  "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
                }}
              />
            )}
          />
        )}

        {saveError && <MDBox role="status" sx={{ color: "#8c3f15", fontSize: 14 }}>{saveError}</MDBox>}
        {selectedCategoryKey !== null && (
          <MDButton
            variant="gradient"
            color="info"
            disabled={Boolean(saveError)}
            onClick={handleSave}
            sx={{
              fontSize: isMobile ? "11px" : "13px",
              minWidth: isMobile ? 80 : 100,
            }}
          >
            저장
          </MDButton>
        )}
      </MDBox>

      {/* 위생점검 카드 화면 (전체 요약 카드 → 카테고리 상세 조치 전·후 항목 카드), 화면 맨 아래까지 채우고 영역 안에서만 스크롤 */}
      <MDBox
        ref={boardAreaRef}
        pt={1}
        sx={{
          height: boardAreaHeight ?? (isMobile ? "55vh" : "75vh"),
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <HygieneCardBoard
          rows={rows}
          categoryList={categoryList}
          selectedKey={selectedCategoryKey}
          onSelectKey={handleSelectCategory}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          isMobile={isMobile}
          isRowChanged={isRowChanged}
          onCellChange={handleCellChange}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onViewImage={handleViewImage}
          onDownload={handleDownload}
          isFieldMode
          savedRows={originalRows}
        />
      </MDBox>

      {/* 사진 크게 보기 미리보기 창 (확대·축소·회전·다운로드) */}
      <PreviewOverlay
        open={!!viewImageSrc}
        files={viewerFiles}
        currentIndex={0}
        onClose={handleCloseViewer}
        anchorX={1 / 2}
      />

    </>
  );
}

HygieneSheetTab.propTypes = { onPendingCount: PropTypes.func };

export default HygieneSheetTab;
