/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import Swal from "sweetalert2";
import api from "api/api";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import useAccountMembersheetData, { parseNumber, formatNumber } from "./accountMemberSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import { API_BASE_URL } from "config";

function AccountMemberSheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");
  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    workSystemList, // ✅ 추가
    originalWorkSystemList, // ✅ 추가
    fetchWorkSystemList, // ✅ 추가
    saveWorkSystemList, // ✅ 추가
    saveData,
    fetchAccountMembersAllList,
    loading: hookLoading,
  } = useAccountMembersheetData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  // =========================
  // ✅ 근무형태 관리 Modal 상태
  // =========================
  const [wsOpen, setWsOpen] = useState(false);
  const [wsRows, setWsRows] = useState([]);
  const [wsOriginal, setWsOriginal] = useState([]);

  const numericCols = ["salary"];

  // =========================
  // ✅ 이미지 업로드/뷰어 기능 (추가)
  // =========================
  const imageFields = ["employment_contract", "id", "bankbook"];
  const [viewImageSrc, setViewImageSrc] = useState(null);
  const fileIconSx = { color: "#1e88e5" };

  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  };
  const handleCloseViewer = () => setViewImageSrc(null);

  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = `${API_BASE_URL}${path}`;
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

  const normalizeTime = (t) => {
    if (!t) return "";
    return String(t).trim().replace(/^0(\d):/, "$1:");
  };

  // hygiene와 동일하게 OperateImgUpload 사용
  const uploadImage = async (file, field, row) => {
    const formData = new FormData();
    formData.append("file", file);

    formData.append("type", "member");
    const gubun = `${field}_${row.member_id || row.rrn || Date.now()}`;
    formData.append("gubun", gubun);
    formData.append("folder", row.account_id || selectedAccountId || "common");

    const res = await api.post("/Operate/OperateImgUpload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data.code === 200) {
      return res.data.image_path;
    }
    throw new Error(res.data.message || "이미지 업로드 실패");
  };
  // =========================

  // ★★★★★ 조회 useEffect 추가 (핵심)
  useEffect(() => {
    setLoading(true);
    fetchAccountMembersAllList().then(() => {
      setLoading(false);
    });
  }, [selectedAccountId, activeStatus]);

  // 합계 계산
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

  // ★★★★★ activeRows 변경 시 loading false 제거
  useEffect(() => {
    if (activeRows && activeRows.length > 0) {
      const updated = activeRows.map((row) => ({
        ...row,
        total: calculateTotal(row),
      }));
      setActiveRows(updated);
      setOriginalRows(updated);
    } else {
      setOriginalRows([]);
    }
  }, [activeRows?.length]);

  // 시간 옵션
  const generateTimeOptions = (startHHMM, endHHMM, stepMinutes = 30) => {
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const start = toMinutes(startHHMM);
    const end = toMinutes(endHHMM);
    const arr = [];
    for (let t = start; t <= end; t += stepMinutes) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      arr.push(`${hh}:${pad(mm)}`);
    }
    return arr;
  };
  const startTimes = generateTimeOptions("6:00", "16:00", 30);
  const endTimes = generateTimeOptions("10:00", "20:00", 30);

  const positionOptions = [
    { value: "1", label: "영양사" },
    { value: "2", label: "조리팀장" },
    { value: "3", label: "조리장" },
    { value: "4", label: "조리사" },
    { value: "5", label: "조리원" },
  ];

  const contractOptions = [
    { value: "1", label: "4대보험" },
    { value: "2", label: "프리랜서" },
  ];

  const delOptions = [
    { value: "N", label: "재직" },
    { value: "Y", label: "퇴사" },
  ];

  const formatDateForInput = (val) => {
    if (!val && val !== 0) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    try {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const columns = useMemo(
    () => [
      { header: "성명", accessorKey: "name", size: 50 },
      { header: "주민번호", accessorKey: "rrn", size: 100 },
      { header: "업장명", accessorKey: "account_id", size: 150 },
      { header: "직책", accessorKey: "position_type", size: 65 },
      { header: "계좌번호", accessorKey: "account_number", size: 160 },
      { header: "연락처", accessorKey: "phone", size: 100 },
      { header: "주소", accessorKey: "address", size: 150 },
      { header: "계약형태", accessorKey: "contract_type", size: 50 },
      { header: "실입사일", accessorKey: "act_join_dt", size: 80 },
      { header: "입사일", accessorKey: "join_dt", size: 80 },
      { header: "퇴직정산일", accessorKey: "ret_set_dt", size: 80 },
      { header: "4대보험 상실일", accessorKey: "loss_major_insurances", size: 80 },
      { header: "퇴사여부", accessorKey: "del_yn", size: 80 },
      { header: "퇴사일", accessorKey: "del_dt", size: 80 },
      { header: "퇴사사유", accessorKey: "del_note", size: 100 },
      { header: "급여(월)", accessorKey: "salary", size: 80, cell: (info) => formatNumber(info.getValue()) },
      { header: "근무형태", accessorKey: "idx", size: 100 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },
      { header: "국민연금", accessorKey: "national_pension", size: 80 },
      { header: "건강보험", accessorKey: "health_insurance", size: 80 },
      { header: "산재보험", accessorKey: "industrial_insurance", size: 80 },
      { header: "고용보험", accessorKey: "employment_insurance", size: 80 },
      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },
      { header: "본사노트", accessorKey: "headoffice_note", minWidth: 80, maxWidth: 150 },
      { header: "지원금", accessorKey: "subsidy", minWidth: 80, maxWidth: 150 },

      // ✅ 이미지 컬럼 3개 추가 (RecSheet와 동일 항목명)
      { header: "근로계약서", accessorKey: "employment_contract", size: 120 },
      { header: "신분증", accessorKey: "id", size: 120 },
      { header: "통장사본", accessorKey: "bankbook", size: 120 },
    ],
    []
  );

  const onSearchList = (e) => {
    setLoading(true);
    setSelectedAccountId(e.target.value);
  };

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSave = async () => {
    const changedRows = activeRows.filter((row, idx) => {
      const original = originalRows[idx];
      if (!original) return true;

      return Object.keys(row).some((key) => {
        // ✅ 이미지 필드: object(File)로 바뀌면 무조건 변경
        if (imageFields.includes(key)) {
          const v = row[key];
          const o = original[key];
          if (typeof v === "object" && v) return true;
          return String(v ?? "") !== String(o ?? "");
        }

        if (numericCols.includes(key)) {
          return Number(row[key] ?? 0) !== Number(original[key] ?? 0);
        }
        return String(row[key] ?? "") !== String(original[key] ?? "");
      });
    });

    if (changedRows.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    try {
      const userId = localStorage.getItem("user_id");

      // ⭐ 빈 문자열 제거 → null 값으로 변환
      const cleanRow = (row) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (newRow[key] === "" || newRow[key] === undefined) {
            newRow[key] = null;
          }
        });
        return newRow;
      };

      // ✅ 이미지가 File이면 업로드 후 경로 문자열로 치환
      const processed = await Promise.all(
        changedRows.map(async (row) => {
          const newRow = cleanRow(row);

          for (const field of imageFields) {
            if (newRow[field] && typeof newRow[field] === "object") {
              const uploadedPath = await uploadImage(newRow[field], field, newRow);
              newRow[field] = uploadedPath;
            }
          }

          return {
            ...newRow,
            user_id: userId,
          };
        })
      );

      const res = await api.post("/Operate/AccountMembersSave", {
        data: processed,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        setOriginalRows([...activeRows]);
        await fetchAccountMembersAllList();
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // 모달 열기: 현재 workSystemList로 스냅샷 생성
  const openWorkSystemModal = async () => {
    const latest = await fetchWorkSystemList({ snapshot: true });

    setWsRows(latest || []);
    setWsOriginal(latest || []);
    setWsOpen(true);
  };

  const closeWorkSystemModal = () => {
    setWsOpen(false);
  };

  // 모달 행추가
  const handleWsAddRow = () => {
    const newRow = {
      idx: null,
      work_system: "",
      start_time: startTimes?.[0] ?? "6:00",
      end_time: endTimes?.[0] ?? "10:00",
    };
    setWsRows((prev) => [newRow, ...prev]);
    setWsOriginal((prev) => [newRow, ...prev]);
  };

  // 모달 셀 변경
  const handleWsChange = (rowIndex, key, value) => {
    setWsRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  };

  // 변경분 추출
  const getWsChangedRows = () => {
    const norm = (v) => String(v ?? "");
    return wsRows.filter((r, i) => {
      const o = wsOriginal[i];
      if (!o) return true;

      return (
        norm(r.work_system) !== norm(o.work_system) ||
        norm(r.start_time) !== norm(o.start_time) ||
        norm(r.end_time) !== norm(o.end_time)
      );
    });
  };

  // 모달 저장
  const handleWsSave = async () => {
    const changed = getWsChangedRows();

    if (changed.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    try {
      const res = await saveWorkSystemList(changed);
      const ok = res?.status === 200 || res?.data?.code === 200;

      if (!ok) {
        Swal.fire("저장 실패", res?.data?.message || "서버 오류", "error");
        return;
      }

      Swal.fire("저장 완료", "근무형태가 저장되었습니다.", "success");

      const latest = await fetchWorkSystemList({ snapshot: true });
      setWsRows(latest || []);
      setWsOriginal(latest || []);

      setWsOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");
    const defaultWorkSystemIdx = workSystemList?.[0]?.idx ? String(workSystemList[0].idx) : "";

    const newRow = {
      name: "",
      rrn: "",
      account_id: defaultAccountId,
      position_type: 1,
      account_number: "",
      phone: "",
      address: "",
      contract_type: 1,
      join_dt: "",
      act_join_dt: "",
      ret_set_dt: "",
      loss_major_insurances: "",
      del_yn: activeStatus,
      del_dt: "",
      del_note: "",
      salary: "",
      idx: defaultWorkSystemIdx,
      start_time: workSystemList?.[0]?.start_time ? normalizeTime(workSystemList[0].start_time) : startTimes?.[0] ?? "6:00",
      end_time: workSystemList?.[0]?.end_time ? normalizeTime(workSystemList[0].end_time) : endTimes?.[0] ?? "10:00",
      national_pension: "",
      health_insurance: "",
      industrial_insurance: "",
      employment_insurance: "",
      note: "",
      headoffice_note: "",
      subsidy: "",
      total: 0,

      // ✅ 이미지 필드 초기값
      employment_contract: "",
      id: "",
      bankbook: "",
    };

    setActiveRows((prev) => [newRow, ...prev]);
    setOriginalRows((prev) => [newRow, ...prev]);
  };

  const renderTable = (table, rows, originals) => {
    const dateFields = new Set([
      "join_dt",
      "act_join_dt",
      "ret_set_dt",
      "loss_major_insurances",
      "del_dt",
      "national_pension",
      "health_insurance",
      "industrial_insurance",
      "employment_insurance",
    ]);
    const selectFields = new Set(["position_type", "del_yn", "contract_type", "start_time", "end_time", "account_id", "idx"]);
    const nonEditableCols = new Set(["diner_date", "total"]);

    return (
      <MDBox
        ref={tableContainerRef}
        pt={0}
        sx={{
          flex: 1,
          minHeight: 0,
          maxHeight: isMobile ? "55vh" : "75vh",
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          "& table": {
            borderCollapse: "separate",
            width: "max-content",
            minWidth: "100%",
            borderSpacing: 0,
            tableLayout: "fixed",
          },
          "& th, & td": {
            border: "1px solid #686D76",
            textAlign: "center",
            padding: "4px",
            whiteSpace: "nowrap",
            fontSize: "12px",
            verticalAlign: "middle",
          },
          "& th": {
            backgroundColor: "#f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 2,
          },
          "& td:nth-of-type(1), & th:nth-of-type(1)": {
            position: "sticky",
            left: 0,
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(2), & th:nth-of-type(2)": {
            position: "sticky",
            left: "80px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(3), & th:nth-of-type(3)": {
            position: "sticky",
            left: "180px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "330px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(5), & th:nth-of-type(5)": {
            position: "sticky",
            left: "415px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(6), & th:nth-of-type(6)": {
            position: "sticky",
            left: "575px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:nth-of-type(-n+6)": { zIndex: 5 },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
          "td[contenteditable]": { minWidth: "80px", cursor: "text" },
          "& select": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
          },
          "& select.edited-cell": { color: "#d32f2f", fontWeight: 500 },
          "& input[type='date']": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
          },
        }}
      >
        <table className="dinersheet-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.column.columnDef.size }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = cell.column.columnDef.accessorKey;
                  const currentValue = row.getValue(colKey);
                  const originalValue = originals?.[rowIndex]?.[colKey];

                  const isNumeric = numericCols.includes(colKey);
                  const isImage = imageFields.includes(colKey);

                  // ✅ 이미지 변경 판정 포함
                  const normCurrent = isImage
                    ? typeof currentValue === "object" && currentValue
                      ? "__FILE__"
                      : String(currentValue ?? "")
                    : isNumeric
                    ? Number(currentValue ?? 0)
                    : String(currentValue ?? "");

                  const normOriginal = isImage
                    ? String(originalValue ?? "")
                    : isNumeric
                    ? Number(originalValue ?? 0)
                    : String(originalValue ?? "");

                  const isChanged = normCurrent !== normOriginal;

                  const isEditable = !nonEditableCols.has(colKey);
                  const isSelect = selectFields.has(colKey);
                  const isDate = dateFields.has(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = rows.map((r, idx) => {
                      if (idx !== rowIndex) return r;

                      // ✅ work_system 변경 시 start/end 자동 세팅
                      if (colKey === "idx") {
                        const selected = (workSystemList || []).find((w) => String(w.idx) === String(newValue));

                        return {
                          ...r,
                          idx: newValue,
                          start_time: selected?.start_time ? normalizeTime(selected.start_time) : r.start_time,
                          end_time: selected?.end_time ? normalizeTime(selected.end_time) : r.end_time,
                          total: calculateTotal({
                            ...r,
                            idx: newValue,
                            start_time: selected?.start_time ? normalizeTime(selected.start_time) : r.start_time,
                            end_time: selected?.end_time ? normalizeTime(selected.end_time) : r.end_time,
                          }),
                        };
                      }

                      return {
                        ...r,
                        [colKey]: newValue,
                        total: calculateTotal({ ...r, [colKey]: newValue }),
                      };
                    });

                    setActiveRows(updatedRows);
                  };

                  // ✅ 이미지 컬럼 렌더링 (RecSheet 방식 그대로)
                  if (isImage) {
                    const value = currentValue ?? "";
                    const hasImage = !!value;
                    const inputId = `upload-${colKey}-${rowIndex}`;

                    return (
                      <td key={cell.id} className={isChanged ? "edited-cell" : ""} style={{ textAlign: "center" }}>
                        <input
                          type="file"
                          accept="image/*"
                          id={inputId}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            handleCellChange(file);
                          }}
                        />

                        {hasImage ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              flexWrap: "nowrap",        // ✅ 줄바꿈 금지
                              whiteSpace: "nowrap",      // ✅ 텍스트 줄바꿈 금지
                            }}
                          >
                            {typeof value === "string" && (
                              <Tooltip title="다운로드">
                                <IconButton
                                  size="small"
                                  sx={{ ...fileIconSx, p: 0.5 }}  // ✅ 패딩 축소
                                  onClick={() => handleDownload(value)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="미리보기">
                              <IconButton
                                size="small"
                                sx={{ ...fileIconSx, p: 0.5 }}    // ✅ 패딩 축소
                                onClick={() => handleViewImage(value)}
                              >
                                <ImageSearchIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <label htmlFor={inputId}>
                              <MDButton
                                size="small"
                                component="span"
                                color="info"
                                sx={{
                                  fontSize: isMobile ? "10px" : "11px",
                                  minWidth: 44,             // ✅ 버튼 폭 축소
                                  px: 1,                    // ✅ 좌우 패딩 축소
                                  py: 0.5,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                변경
                              </MDButton>
                            </label>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              flexWrap: "nowrap",        // ✅ 줄바꿈 금지
                              whiteSpace: "nowrap",
                            }}
                          >
                            <label htmlFor={inputId} style={{ display: "inline-flex" }}>
                              <MDButton
                                size="small"
                                component="span"
                                color="info"
                                sx={{
                                  fontSize: isMobile ? "10px" : "11px",
                                  minWidth: 44,
                                  px: 1,
                                  py: 0.5,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                업로드
                              </MDButton>
                            </label>
                          </div>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={cell.id}
                      style={{
                        textAlign: [
                          "rrn",
                          "account_number",
                          "phone",
                          "contract_type",
                          "join_dt",
                          "act_join_dt",
                          "ret_set_dt",
                          "loss_major_insurances",
                          "del_yn",
                          "del_dt",
                          "idx",
                          "start_time",
                          "end_time",
                          "national_pension",
                          "health_insurance",
                          "industrial_insurance",
                          "employment_insurance",
                        ].includes(colKey)
                          ? "center"
                          : colKey === "salary"
                          ? "right"
                          : "left",
                      }}
                      contentEditable={isEditable && !isSelect && !isDate}
                      suppressContentEditableWarning
                      className={isEditable && isChanged ? "edited-cell" : ""}
                      onBlur={
                        isEditable && !isSelect && !isDate
                          ? (e) => {
                              let newValue = e.target.innerText.trim();
                              if (isNumeric) newValue = parseNumber(newValue);
                              handleCellChange(newValue);

                              if (isNumeric) {
                                e.currentTarget.innerText = formatNumber(newValue);
                              }
                            }
                          : undefined
                      }
                    >
                      {isSelect ? (
                        <select
                          value={currentValue ?? ""}
                          onChange={(e) => handleCellChange(e.target.value)}
                          className={isChanged ? "edited-cell" : ""}
                          style={{ width: "100%", background: "transparent", cursor: "pointer", border: "none" }}
                        >
                          {colKey === "account_id" &&
                            (accountList || []).map((acc) => (
                              <option key={acc.account_id} value={acc.account_id}>
                                {acc.account_name}
                              </option>
                            ))}

                          {colKey === "idx" && (
                            <>
                              <option value="">선택</option>
                              {(workSystemList || []).map((opt) => (
                                <option key={opt.idx} value={opt.idx}>
                                  {opt.work_system}
                                </option>
                              ))}
                            </>
                          )}

                          {colKey === "del_yn" &&
                            delOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}

                          {colKey === "position_type" &&
                            positionOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}

                          {colKey === "contract_type" &&
                            contractOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}

                          {colKey === "start_time" && (
                            <>
                              <option value="">없음</option>
                              {startTimes.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </>
                          )}

                          {colKey === "end_time" && (
                            <>
                              <option value="">없음</option>
                              {endTimes.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      ) : isDate ? (
                        <input
                          type="date"
                          value={formatDateForInput(currentValue)}
                          onChange={(e) => handleCellChange(e.target.value)}
                          className={isChanged ? "edited-cell" : ""}
                        />
                      ) : (
                        (isNumeric ? formatNumber(currentValue) : currentValue) ?? ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </MDBox>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 버튼 (모바일 대응) */}
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
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        <TextField
          select
          size="small"
          value={activeStatus}
          onChange={(e) => {
            setLoading(true);
            setActiveStatus(e.target.value);
          }}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          <option value="N">재직자</option>
          <option value="Y">퇴사자</option>
        </TextField>

        <TextField
          select
          size="small"
          value={selectedAccountId}
          onChange={onSearchList}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          <option value="">전체</option>
          {(accountList || []).map((row) => (
            <option key={row.account_id} value={row.account_id}>
              {row.account_name}
            </option>
          ))}
        </TextField>

        <MDButton variant="gradient" color="warning" onClick={openWorkSystemModal}>
          근무형태 관리
        </MDButton>

        <MDButton variant="gradient" color="success" onClick={handleAddRow}>
          행추가
        </MDButton>

        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={1} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            {renderTable(table, activeRows, originalRows)}
          </Grid>
        </Grid>
      </MDBox>

      {/* =========================
          ✅ 근무형태 모달(기존 그대로)
         ========================= */}
      <Modal open={wsOpen} onClose={closeWorkSystemModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "95vw" : 720,
            maxHeight: "85vh",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MDBox
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              bgcolor: "#fff",
              px: 2,
              py: 1,
              borderBottom: "1px solid #e0e0e0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <MDTypography variant="h6">근무형태 관리</MDTypography>

            <MDBox display="flex" gap={1}>
              <MDButton variant="gradient" color="success" onClick={handleWsAddRow}>
                행추가
              </MDButton>
              <MDButton variant="gradient" color="info" onClick={handleWsSave}>
                저장
              </MDButton>
              <MDButton variant="outlined" color="secondary" onClick={closeWorkSystemModal}>
                닫기
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox
            sx={{
              flex: 1,
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              bgcolor: "#fff",
            }}
          >
            <MDBox
              sx={{
                p: 2,
                "& table": {
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                },
                "& th, & td": {
                  border: "1px solid #686D76",
                  padding: "6px",
                  fontSize: "12px",
                  textAlign: "center",
                  backgroundColor: "#fff",
                },
                "& thead th": {
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  backgroundColor: "#f0f0f0",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.12)",
                  backgroundClip: "padding-box",
                },
                "& input, & select": {
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                },
                "& .edited-cell": { color: "#d32f2f", fontWeight: 600 },
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>idx</th>
                    <th>근무형태명</th>
                    <th style={{ width: 140 }}>시작</th>
                    <th style={{ width: 140 }}>마감</th>
                  </tr>
                </thead>

                <tbody>
                  {(wsRows || []).map((r, i) => {
                    const o = wsOriginal?.[i] || {};
                    const isNewRow = r.idx == null || !wsOriginal?.[i];

                    const changedWorkSystem = String(r.work_system ?? "") !== String(o.work_system ?? "");
                    const changedStartTime = String(r.start_time ?? "") !== String(o.start_time ?? "");
                    const changedEndTime = String(r.end_time ?? "") !== String(o.end_time ?? "");

                    return (
                      <tr key={`${r.idx ?? "new"}-${i}`} className={isNewRow ? "edited-cell" : ""}>
                        <td className={isNewRow ? "edited-cell" : ""}>{r.idx ?? ""}</td>

                        <td className={isNewRow || changedWorkSystem ? "edited-cell" : ""}>
                          <input
                            value={r.work_system ?? ""}
                            onChange={(e) => handleWsChange(i, "work_system", e.target.value)}
                            placeholder="예) 주5일(09~18)"
                            className={isNewRow || changedWorkSystem ? "edited-cell" : ""}
                          />
                        </td>

                        <td className={isNewRow || changedStartTime ? "edited-cell" : ""}>
                          <select
                            value={r.start_time ?? ""}
                            onChange={(e) => handleWsChange(i, "start_time", e.target.value)}
                            className={isNewRow || changedStartTime ? "edited-cell" : ""}
                          >
                            <option value="">없음</option>
                            {startTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className={isNewRow || changedEndTime ? "edited-cell" : ""}>
                          <select
                            value={r.end_time ?? ""}
                            onChange={(e) => handleWsChange(i, "end_time", e.target.value)}
                            className={isNewRow || changedEndTime ? "edited-cell" : ""}
                          >
                            <option value="">없음</option>
                            {endTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </MDBox>
          </MDBox>
        </Box>
      </Modal>

      {/* =========================
          ✅ 이미지 뷰어 (추가)
         ========================= */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "50vw",
            height: "90vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: isMobile ? "95%" : "80%",
              maxHeight: isMobile ? "90%" : "80%",
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
                    }}
                  >
                    <button onClick={zoomIn} style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}>
                      +
                    </button>
                    <button onClick={zoomOut} style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}>
                      -
                    </button>
                    <button onClick={resetTransform} style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}>
                      ⟳
                    </button>
                    <button onClick={handleCloseViewer} style={{ border: "none", padding: isMobile ? "2px 6px" : "4px 8px", cursor: "pointer" }}>
                      X
                    </button>
                  </div>

                  <TransformComponent>
                    <img src={encodeURI(viewImageSrc)} alt="미리보기" style={{ maxWidth: "70%", maxHeight: "100%", borderRadius: 8 }} />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}

export default AccountMemberSheet;
