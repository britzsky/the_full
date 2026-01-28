import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import Autocomplete from "@mui/material/Autocomplete";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Swal from "sweetalert2";
import api from "api/api";
import useAccountMemberRecSheetData, {
  parseNumber,
  formatNumber,
} from "./accountMemberRecSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import { API_BASE_URL } from "config";

function AccountMemberRecSheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activeStatus, setActiveStatus] = useState("Y");
  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    workSystemList,
    fetchAccountMembersAllList,
  } = useAccountMemberRecSheetData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  // ✅ 이미지 뷰어
  const [viewImageSrc, setViewImageSrc] = useState(null);

  const numericCols = ["salary"];

  const imageFields = ["employment_contract", "id", "bankbook"];

  const normalizeTime = (t) => {
    if (!t) return "";
    return String(t)
      .trim()
      .replace(/^0(\d):/, "$1:");
  };

  // 조회
  useEffect(() => {
    setLoading(true);
    fetchAccountMembersAllList().then(() => setLoading(false));
  }, [selectedAccountId, activeStatus]);

  // (기존 로직 유지) total 계산 — 현재 컬럼에 meal 컬럼이 없어도 0으로 유지됨
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

  // activeRows 변경 시 total 반영 + 원본 스냅샷
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

  // ✅ 채용여부(use_yn) 옵션
  const useYnOptions = [
    { value: "D", label: "진행중" },
    { value: "Y", label: "채용확정" },
    { value: "N", label: "채용취소" },
  ];

  const corOptions = [
    { value: "1", label: "(주)더채움" },
    { value: "2", label: "더채움" },
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
      { header: "구분", accessorKey: "cor_type", size: 50 },
      { header: "성명", accessorKey: "name", size: 50 },
      { header: "주민번호", accessorKey: "rrn", size: 100 },
      { header: "업장명", accessorKey: "account_id", size: 150 },
      { header: "직책", accessorKey: "position_type", size: 65 },
      { header: "계좌번호", accessorKey: "account_number", size: 160 },
      { header: "연락처", accessorKey: "phone", size: 100 },
      { header: "주소", accessorKey: "address", size: 150 },
      { header: "계약형태", accessorKey: "contract_type", size: 50 },
      { header: "실입사일", accessorKey: "act_join_dt", size: 80 },
      {
        header: "급여(월)",
        accessorKey: "salary",
        size: 80,
        cell: (info) => formatNumber(info.getValue()),
      },
      { header: "근무형태", accessorKey: "idx", size: 180 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },
      { header: "채용여부", accessorKey: "use_yn", size: 60 },
      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },
      { header: "근로계약서", accessorKey: "employment_contract", size: 90 }, // ✅ 이미지
      { header: "신분증", accessorKey: "id", size: 80 }, // ✅ 이미지
      { header: "통장사본", accessorKey: "bankbook", size: 80 }, // ✅ 이미지
    ],
    []
  );

  // ✅ 거래처 Autocomplete 옵션
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [accountList]
  );

  // ✅ Autocomplete value 객체
  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  const onSearchList = (e) => {
    setLoading(true);
    setSelectedAccountId(e.target.value);
  };

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ✅ 이미지 뷰어
  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  };

  const handleCloseViewer = () => setViewImageSrc(null);

  // ✅ 다운로드 (서버 문자열일 때만)
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

  // ✅ 아이콘 컬러
  const fileIconSx = { color: "#1e88e5" };

  // ✅ 업로드(이미지)
  const uploadImage = async (file, field, row) => {
    const formData = new FormData();
    formData.append("file", file);

    // hygiene와 동일하게 OperateImgUpload 사용
    formData.append("type", "member"); // 서버에서 type 분기 없으면 "hygiene"로 바꿔도 됨
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

  const handleSave = async () => {
    const changedRows = activeRows.filter((row, idx) => {
      const original = originalRows[idx];
      if (!original) return true;

      return Object.keys(row).some((key) => {
        // 이미지 필드: object(File)로 바뀌면 무조건 변경
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

      const res = await api.post("/Operate/AccountRecMembersSave", { data: processed });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        await fetchAccountMembersAllList(); // 재조회(원본 스냅샷 갱신)
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message || String(err), "error");
    }
  };

  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");
    const defaultWorkSystemIdx = workSystemList?.[0]?.idx ? String(workSystemList[0].idx) : "";

    const newRow = {
      name: "",
      rrn: "",
      address: "",
      account_id: defaultAccountId,
      contract_type: "1",
      position_type: "1",
      act_join_dt: "",
      salary: "",
      idx: defaultWorkSystemIdx,
      start_time: workSystemList?.[0]?.start_time
        ? normalizeTime(workSystemList[0].start_time)
        : startTimes?.[0] ?? "6:00",
      end_time: workSystemList?.[0]?.end_time
        ? normalizeTime(workSystemList[0].end_time)
        : endTimes?.[0] ?? "10:00",
      use_yn: "D", // ✅ 기본값
      note: "",
      employment_contract: "",
      id: "",
      bankbook: "",
      cor_type: 1,
    };

    setActiveRows((prev) => [newRow, ...prev]);
    setOriginalRows((prev) => [newRow, ...prev]);
  };

  const renderTable = (table, rows, originals) => {
    const dateFields = new Set(["act_join_dt"]);
    const selectFields = new Set([
      "contract_type",
      "position_type",
      "start_time",
      "end_time",
      "account_id",
      "idx",
      "use_yn", // ✅ 추가
      "cor_type",
    ]);
    const nonEditableCols = new Set(["total"]);

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
            left: "90px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(3), & th:nth-of-type(3)": {
            position: "sticky",
            left: "170px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "274px",
            background: "#f0f0f0",
            zIndex: 3,
          },
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

                  // ✅ 변경 여부(이미지 포함)
                  const isNumeric = numericCols.includes(colKey);
                  const isImage = imageFields.includes(colKey);

                  const normCurrent = isImage
                    ? typeof currentValue === "object"
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

                      // ✅ 근무형태(idx) 변경 시 start/end 자동 세팅
                      if (colKey === "idx") {
                        const selected = (workSystemList || []).find(
                          (w) => String(w.idx) === String(newValue)
                        );
                        return {
                          ...r,
                          idx: newValue,
                          start_time: selected?.start_time
                            ? normalizeTime(selected.start_time)
                            : r.start_time,
                          end_time: selected?.end_time
                            ? normalizeTime(selected.end_time)
                            : r.end_time,
                          total: calculateTotal({
                            ...r,
                            idx: newValue,
                            start_time: selected?.start_time
                              ? normalizeTime(selected.start_time)
                              : r.start_time,
                            end_time: selected?.end_time
                              ? normalizeTime(selected.end_time)
                              : r.end_time,
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

                  // ✅ 이미지 컬럼 렌더링 (아이콘/버튼 한줄 고정)
                  if (isImage) {
                    const value = currentValue ?? "";
                    const hasImage = !!value;
                    const inputId = `upload-${colKey}-${rowIndex}`;

                    const rowActionSx = {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      flexWrap: "nowrap", // ✅ 줄바꿈 금지
                      whiteSpace: "nowrap", // ✅ 텍스트 줄바꿈 금지
                    };

                    const actionBtnSx = {
                      fontSize: isMobile ? "10px" : "11px",
                      minWidth: 44, // ✅ 버튼 폭 축소
                      px: 1,
                      py: 0.5,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    };

                    const iconBtnSx = { ...fileIconSx, p: 0.5 }; // ✅ 아이콘 버튼 패딩 축소

                    return (
                      <td
                        key={cell.id}
                        className={isChanged ? "edited-cell" : ""}
                        style={{ textAlign: "center" }}
                      >
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
                          <div style={rowActionSx}>
                            {typeof value === "string" && (
                              <Tooltip title="다운로드">
                                <IconButton
                                  size="small"
                                  sx={iconBtnSx}
                                  onClick={() => handleDownload(value)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="미리보기">
                              <IconButton
                                size="small"
                                sx={iconBtnSx}
                                onClick={() => handleViewImage(value)}
                              >
                                <ImageSearchIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <label htmlFor={inputId} style={{ display: "inline-flex" }}>
                              <MDButton size="small" component="span" color="info" sx={actionBtnSx}>
                                변경
                              </MDButton>
                            </label>
                          </div>
                        ) : (
                          <div style={rowActionSx}>
                            <label htmlFor={inputId} style={{ display: "inline-flex" }}>
                              <MDButton size="small" component="span" color="info" sx={actionBtnSx}>
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
                          "act_join_dt",
                          "idx",
                          "start_time",
                          "end_time",
                          "use_yn",
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
                        colKey === "idx" ? (
                          <Autocomplete
                            size="small"
                            options={(workSystemList || []).map((w) => ({
                              value: String(w.idx),
                              label: w.work_system,
                            }))}
                            value={(() => {
                              const v = String(currentValue ?? "");
                              return (
                                (workSystemList || [])
                                  .map((w) => ({ value: String(w.idx), label: w.work_system }))
                                  .find((o) => o.value === v) || null
                              );
                            })()}
                            onChange={(_, opt) => handleCellChange(opt ? opt.value : "")}
                            getOptionLabel={(opt) => opt?.label ?? ""}
                            isOptionEqualToValue={(opt, val) => opt.value === val.value}
                            renderOption={(props, option) => (
                              <li
                                {...props}
                                style={{
                                  fontSize: "12px",
                                  paddingTop: 4,
                                  paddingBottom: 4,
                                  color: isChanged ? "#d32f2f" : "inherit", // ✅ 목록 글씨도 같이 빨강
                                  fontWeight: isChanged ? 600 : 400,
                                }}
                              >
                                {option.label}
                              </li>
                            )}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                variant="standard"
                                placeholder="검색"
                                InputProps={{
                                  ...params.InputProps,
                                  disableUnderline: true,
                                }}
                                inputProps={{
                                  ...params.inputProps,
                                  style: {
                                    fontSize: "12px",
                                    padding: 0,
                                    color: isChanged ? "#d32f2f" : "inherit", // ✅ 입력 글씨 빨강
                                    fontWeight: isChanged ? 600 : 400,
                                  },
                                }}
                              />
                            )}
                            sx={{
                              width: "100%",
                              "& .MuiInputBase-root": { minHeight: 24 },

                              // ✅ 선택된 값(입력부) 빨강 강제
                              "& .MuiAutocomplete-input": {
                                fontSize: "12px",
                                padding: "0px !important",
                                color: isChanged ? "#d32f2f" : "inherit",
                                fontWeight: isChanged ? 600 : 400,
                              },

                              // ✅ 아이콘도 같이 빨강(원하면)
                              "& .MuiSvgIcon-root": {
                                fontSize: 18,
                                color: isChanged ? "#d32f2f" : "inherit",
                              },

                              // ✅ 펼친 목록 글씨
                              "& .MuiAutocomplete-option": { fontSize: "12px", minHeight: 28 },
                            }}
                            ListboxProps={{
                              style: { fontSize: "12px" },
                            }}
                          />
                        ) : (
                          // ✅ 나머지 select는 기존대로 유지
                          <select
                            value={currentValue ?? ""}
                            onChange={(e) => handleCellChange(e.target.value)}
                            className={isChanged ? "edited-cell" : ""}
                            style={{
                              width: "100%",
                              background: "transparent",
                              cursor: "pointer",
                              border: "none",
                            }}
                          >
                            {colKey === "cor_type" &&
                              corOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}

                            {colKey === "account_id" &&
                              (accountList || []).map((acc) => (
                                <option key={acc.account_id} value={acc.account_id}>
                                  {acc.account_name}
                                </option>
                              ))}

                            {colKey === "use_yn" &&
                              useYnOptions.map((opt) => (
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
                        )
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
          <option value="D">진행중</option>
          <option value="Y">채용확정</option>
          <option value="N">채용취소</option>
        </TextField>

        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          onChange={(_, opt) => {
            setLoading(true);
            setSelectedAccountId(opt ? opt.value : "");
          }}
          getOptionLabel={(opt) => opt?.label ?? ""}
          isOptionEqualToValue={(opt, val) => opt.value === val.value}
          // ✅ (선택) 검색 품질: 이름에 포함되면 매칭
          filterOptions={(options, state) => {
            const q = (state.inputValue ?? "").trim().toLowerCase();
            if (!q) return options;
            return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

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

      {/* ✅ 이미지 뷰어 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
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
                    <button
                      onClick={zoomIn}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={zoomOut}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>
                    <button
                      onClick={resetTransform}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      ⟳
                    </button>
                    <button
                      onClick={handleCloseViewer}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      X
                    </button>
                  </div>

                  <TransformComponent>
                    <img
                      src={encodeURI(viewImageSrc)}
                      alt="미리보기"
                      style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
                    />
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

export default AccountMemberRecSheet;
