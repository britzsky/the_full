import React, { useMemo, useState, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import { TextField, useTheme, useMediaQuery } from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import useAccountMemberCardSheetData, {
  parseNumber,
  formatNumber,
} from "./accountMemberCardSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";

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
    workSystemList,
    originalWorkSystemList, // ✅ 추가
    fetchWorkSystemList, // ✅ 추가
    saveWorkSystemList, // ✅ 추가
    saveData,
    fetchAccountMembersAllList,
    loading: hookLoading,
  } = useAccountMemberCardSheetData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  // =========================
  // ✅ 근무형태 관리 Modal 상태
  // =========================
  const [wsOpen, setWsOpen] = useState(false);
  const [wsRows, setWsRows] = useState([]);
  const [wsOriginal, setWsOriginal] = useState([]);

  const numericCols = ["salary"];

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

  useEffect(() => {
    if (selectedAccountId) return;
    if (!Array.isArray(accountList) || accountList.length === 0) return;

    setSelectedAccountId(String(accountList[0].account_id));
  }, [accountList, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;

    setLoading(true);
    Promise.resolve(fetchAccountMembersAllList()).finally(() => setLoading(false));
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
      { header: "업장명", accessorKey: "account_id", size: 150 },
      {
        header: "급여(월)",
        accessorKey: "salary",
        size: 80,
        cell: (info) => formatNumber(info.getValue()),
      },
      { header: "직책", accessorKey: "position_type", size: 65 },
      { header: "근무형태", accessorKey: "idx", size: 180 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },
      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },
    ],
    []
  );

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

      // 🔥 row 내부에 user_id 추가 + null 변환
      const changedRowsWithUser = changedRows.map((row) => ({
        ...cleanRow(row),
        user_id: userId,
      }));

      const res = await api.post("/Operate/AccountMembersSave", {
        data: changedRowsWithUser,
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
    const ws0 = workSystemList?.[0];

    const newRow = {
      name: "",
      account_id: defaultAccountId,
      position_type: 1,
      join_dt: "",
      salary: "",
      idx: ws0?.idx ? String(ws0.idx) : "",
      start_time: ws0?.start_time ?? startTimes?.[0] ?? "6:00",
      end_time: ws0?.end_time ?? endTimes?.[0] ?? "10:00",
      note: "",
    };

    setActiveRows((prev) => [newRow, ...prev]);
    setOriginalRows((prev) => [newRow, ...prev]);
  };

  const renderTable = (tableInst, rows, originals) => {
    const dateFields = new Set(["join_dt"]);
    const selectFields = new Set(["position_type", "start_time", "end_time", "account_id", "idx"]);
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
          "& .edited-cell": {
            color: "#d32f2f",
            fontWeight: 500,
          },
          "td[contenteditable]": {
            minWidth: "80px",
            cursor: "text",
          },
          "& select": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
          },
          "& select.edited-cell": {
            color: "#d32f2f",
            fontWeight: 500,
          },
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
            {tableInst.getHeaderGroups().map((headerGroup) => (
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
            {tableInst.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = cell.column.columnDef.accessorKey;
                  const currentValue = row.getValue(colKey);
                  const originalValue = originals?.[rowIndex]?.[colKey];

                  const isNumeric = numericCols.includes(colKey);
                  const normCurrent = isNumeric
                    ? Number(currentValue ?? 0)
                    : String(currentValue ?? "");
                  const normOriginal = isNumeric
                    ? Number(originalValue ?? 0)
                    : String(originalValue ?? "");
                  const isChanged = normCurrent !== normOriginal;

                  const isEditable = !nonEditableCols.has(colKey);
                  const isSelect = selectFields.has(colKey);
                  const isDate = dateFields.has(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = rows.map((r, idx) => {
                      if (idx !== rowIndex) return r;

                      if (colKey === "idx") {
                        const selected = (workSystemList || []).find(
                          (w) => String(w.idx) === String(newValue)
                        );

                        return {
                          ...r,
                          idx: newValue,
                          start_time: selected?.start_time ?? r.start_time,
                          end_time: selected?.end_time ?? r.end_time,
                          total: calculateTotal({
                            ...r,
                            idx: newValue,
                            start_time: selected?.start_time ?? r.start_time,
                            end_time: selected?.end_time ?? r.end_time,
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

                  return (
                    <td
                      key={cell.id}
                      style={{
                        textAlign: ["join_dt", "idx", "start_time", "end_time"].includes(colKey)
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
                              start_time: w.start_time,
                              end_time: w.end_time,
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
                                  color: isChanged ? "#d32f2f" : "inherit",
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
                                    color: isChanged ? "#d32f2f" : "inherit",
                                    fontWeight: isChanged ? 600 : 400,
                                  },
                                }}
                              />
                            )}
                            sx={{
                              width: "100%",
                              "& .MuiInputBase-root": { minHeight: 24 },
                              "& .MuiAutocomplete-input": {
                                fontSize: "12px",
                                padding: "0px !important",
                                color: isChanged ? "#d32f2f" : "inherit",
                                fontWeight: isChanged ? 600 : 400,
                              },
                              "& .MuiSvgIcon-root": {
                                fontSize: 18,
                                color: isChanged ? "#d32f2f" : "inherit",
                              },
                              "& .MuiAutocomplete-option": { fontSize: "12px", minHeight: 28 },
                            }}
                            ListboxProps={{
                              style: { fontSize: "12px" },
                            }}
                          />
                        ) : (
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
                            {colKey === "account_id" &&
                              (accountList || []).map((acc) => (
                                <option key={acc.account_id} value={acc.account_id}>
                                  {acc.account_name}
                                </option>
                              ))}

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
          {/* ✅ 상단 버튼 영역 sticky */}
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

          {/* ✅ 여기만 스크롤 */}
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

                    const changedWorkSystem =
                      String(r.work_system ?? "") !== String(o.work_system ?? "");
                    const changedStartTime =
                      String(r.start_time ?? "") !== String(o.start_time ?? "");
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
    </>
  );
}

export default AccountMemberSheet;
