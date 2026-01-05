// src/layouts/investment/index.js
import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Tooltip from "@mui/material/Tooltip";
import {
  Box,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import useTeleManagerData from "./teleManagerData";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";

function TeleManagerTab() {
  dayjs.extend(isSameOrAfter);
  dayjs.extend(isSameOrBefore);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);

  const { teleAccountRows } = useTeleManagerData(year);
  const [loading, setLoading] = useState(true);

  const quarterStartMonth =
    month <= 3 ? 1 : month <= 6 ? 4 : month <= 9 ? 7 : 10;

  // const quarterMonths = Array.from({ length: 3 }, (_, i) =>
  //   dayjs(`${year}-${quarterStartMonth + i}-01`)
  // );

  const quarterMonths = Array.from({ length: 12 }, (_, i) =>
    dayjs(`${year}-${i + 1}-01`)
  );

  const [editedRows, setEditedRows] = useState([]);

  // 🔹 드래그 선택 상태
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null); // { rowIdx, date }
  const [selectionEnd, setSelectionEnd] = useState(null); // { rowIdx, date }

  // 🔹 드래그 범위에 일괄로 넣을 타입/메모
  const [bulkActType, setBulkActType] = useState(1); // 기본: 영업관리소통
  const [bulkMemo, setBulkMemo] = useState("");

  useEffect(() => {
    setLoading(true);
  }, [year]);

  // editedRows 초기화
  useEffect(() => {
    if (teleAccountRows.length > 0) {
      setLoading(false);

      const grouped = teleAccountRows.reduce((acc, item) => {
        const existing = acc.find((r) => r.idx === item.idx);
        const hasDaily = item.act_type || item.memo;

        const dailyStatus = hasDaily
          ? { [item.act_dt]: { act_type: item.act_type, memo: item.memo } }
          : {};

        if (existing) {
          if (item.act_dt && hasDaily) {
            existing.dailyStatus[item.act_dt] = {
              act_type: item.act_type,
              memo: item.memo,
            };
            existing.originalDailyStatus[item.act_dt] = {
              act_type: item.act_type,
              memo: item.memo,
            };
          }
        } else {
          acc.push({
            ...item,
            dailyStatus,
            originalDailyStatus: { ...dailyStatus },
            originalLeft: {
              account_name: item.account_name,
              sales_root: item.sales_root,
              manager: item.manager,
              region: item.region,
              now_consignor: item.now_consignor,
              end_dt: item.end_dt,
              contract_type: item.contract_type,
            },
          });
        }
        return acc;
      }, []);

      setEditedRows(grouped);
    }
  }, [teleAccountRows]);

  // ✅ 반응형 테이블 컨테이너 스타일
  const tableSx = {
    maxHeight: isMobile ? "60vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    whiteSpace: "nowrap",
    "& table": {
      borderCollapse: "collapse",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      borderCollapse: "separate",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      whiteSpace: "nowrap",
      fontSize: isMobile ? "10px" : "12px",
      width: isMobile ? "18px" : "20px",
      height: isMobile ? "20px" : "22px",
      borderCollapse: "collapse",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& thead th:nth-child(-n+8), & tbody td:nth-child(-n+8)": {
      position: "sticky",
      background: "#fff",
      zIndex: 3,
    },
    "& thead tr:first-child th": {
      position: "sticky",
      top: 0,
      background: "#f0f0f0",
      zIndex: 3,
    },
    "& thead tr:nth-child(2) th": {
      position: "sticky",
      background: "#f0f0f0",
      zIndex: 2,
    },
    ".memo-tooltip": {
      display: "none",
      position: "absolute",
      top: "100%",
      left: "0",
      background: "#333",
      color: "fff",
      padding: "2px 4px",
      fontSize: "12px",
      whiteSpace: "pre-wrap",
      zIndex: "100",
      width: "100px",
    },
    "td:hover .memo-tooltip": {
      display: "block",
    },
  };

  const handleInputChange = (rowIdx, key, value) => {
    setEditedRows((prev) =>
      prev.map((row) => (row.idx === rowIdx ? { ...row, [key]: value } : row))
    );
  };

  const handleDailyChange = (rowIdx, date, value) => {
    setEditedRows((prev) =>
      prev.map((row) => {
        if (row.idx === rowIdx) {
          const updated = { ...row.dailyStatus, [date]: value };
          if (value.act_type === 0 && !value.memo) delete updated[date];
          return { ...row, dailyStatus: updated };
        }
        return row;
      })
    );
  };

  const colWidths = [30, 170, 150, 160, 60, 100, 80, 80];
  const [editingCell, setEditingCell] = useState(null);

  // 빨간글씨 비교는 originalLeft 기준
  function getCellColor(row, key) {
    if (!row.originalLeft) return "black";
    return row[key] !== row.originalLeft[key] ? "red" : "black";
  }

  const statusColors = {
    0: "white",
    1: "lightgreen",
    2: "lightblue",
    3: "salmon",
  };

  // 🔹 현재 셀이 선택 영역 안에 있는지 확인
  const isCellInSelection = (rowIdx, date) => {
    if (!selectionStart || !selectionEnd) return false;
    if (selectionStart.rowIdx !== rowIdx) return false; // 한 행 기준

    const start = dayjs(selectionStart.date);
    const end = dayjs(selectionEnd.date);
    const current = dayjs(date);

    const min = start.isBefore(end) ? start : end;
    const max = start.isAfter(end) ? start : end;

    return (
      current.isSameOrAfter(min, "day") &&
      current.isSameOrBefore(max, "day")
    );
  };

  // 🔹 선택된 범위에 일괄 적용 (버튼 눌렀을 때만 실행)
  const handleApplySelection = () => {
    if (!selectionStart || !selectionEnd) {
      Swal.fire("알림", "선택된 날짜 범위가 없습니다.", "info");
      return;
    }

    const rowIdx = selectionStart.rowIdx;
    if (rowIdx !== selectionEnd.rowIdx) {
      Swal.fire("알림", "한 업장(행)에서만 범위 적용이 가능합니다.", "info");
      return;
    }

    const start = dayjs(selectionStart.date);
    const end = dayjs(selectionEnd.date);
    const min = start.isBefore(end) ? start : end;
    const max = start.isAfter(end) ? start : end;

    const dates = [];
    let tmp = min.clone();
    while (tmp.isSameOrBefore(max, "day")) {
      dates.push(tmp.format("YYYY-MM-DD"));
      tmp = tmp.add(1, "day");
    }

    setEditedRows((prev) =>
      prev.map((r) => {
        if (r.idx !== rowIdx) return r;

        const updatedDaily = { ...r.dailyStatus };

        dates.forEach((dt) => {
          updatedDaily[dt] = {
            act_type: bulkActType,
            memo: bulkMemo,
          };
        });

        return {
          ...r,
          dailyStatus: updatedDaily,
        };
      })
    );

    // 적용 후 선택 해제
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  };

  // 🔹 선택 해제 전용
  const handleClearSelection = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // 저장
  const handleSave = async () => {
    const payload = editedRows.flatMap((row) => {
      const baseKeys = [
        "account_name",
        "sales_root",
        "manager",
        "region",
        "now_consignor",
        "end_dt",
        "contract_type",
      ];

      const leftChanged = baseKeys.reduce(
        (acc, key) => {
          if (row[key] !== row.originalLeft[key]) acc[key] = row[key];
          return acc;
        },
        { idx: row.idx }
      );

      const changedLeft = Object.keys(leftChanged).length > 1;

      const changedDaily = Object.entries(row.dailyStatus || {})
        .filter(([date, val]) => {
          const orig = row.originalDailyStatus?.[date] || {
            act_type: 0,
            memo: "",
          };
          return val.act_type !== orig.act_type || val.memo !== orig.memo;
        })
        .map(([date, val]) => ({
          idx: row.idx,
          act_dt: date,
          ...val,
        }));

      const result = [];
      if (changedLeft) result.push(leftChanged);
      if (changedDaily.length > 0) result.push(...changedDaily);
      return result;
    });

    if (payload.length === 0) return;

    try {
      await api.post("/Business/BusinessTeleAccountSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      Swal.fire({ icon: "success", title: "저장", text: "저장되었습니다." });

      // ✅ 저장 후 현재 상태를 "원본"으로 갱신 → 다음부터는 변경분만 다시 나감
      setEditedRows((prev) =>
        prev.map((row) => ({
          ...row,
          originalLeft: {
            account_name: row.account_name,
            sales_root: row.sales_root,
            manager: row.manager,
            region: row.region,
            now_consignor: row.now_consignor,
            end_dt: row.end_dt,
            contract_type: row.contract_type,
          },
          originalDailyStatus: { ...(row.dailyStatus || {}) },
        }))
      );
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: err.message,
        icon: "error",
      });
    }
  };

  // 행추가
  const handleAddRow = () => {
    const newIdx =
      editedRows.length > 0
        ? Math.max(...editedRows.map((r) => Number(r.idx))) + 1
        : 1;

    const newRow = {
      idx: newIdx,
      account_name: "",
      sales_root: "",
      manager: "",
      region: "",
      now_consignor: "",
      end_dt: "",
      contract_type: 1,
      dailyStatus: {},
      originalDailyStatus: {},
      originalLeft: {
        account_name: "",
        sales_root: "",
        manager: "",
        region: "",
        now_consignor: "",
        end_dt: "",
        contract_type: 1,
      },
    };

    setEditedRows((prev) => [...prev, newRow]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터/버튼 영역 - 모바일에서는 줄 바꿈 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: 1,
        }}
      >
        <Box sx={{ flexWrap: isMobile ? "wrap" : "nowrap", justifyContent: isMobile ? "flex-start" : "flex-end", display: "flex", justifyContent: "space-between", alignItems: "right"}}>
          <Select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            size="small"
            sx={{ minWidth: 90 }}
          >
            {Array.from({ length: 10 }, (_, i) => now.year() - 5 + i).map(
              (y) => (
                <MenuItem key={y} value={y}>
                  {y}년
                </MenuItem>
              )
            )}
          </Select>
          <MDButton
            color="info"
            sx={{ minWidth: 0, visibility: "hidden" }}
          >
          </MDButton>
        </Box>

        {/* 🔹 드래그 범위에 일괄 적용할 타입/메모 설정 */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            border: "1px solid #ccc",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <span style={{ fontSize: 12 }}>범위 타입</span>
          <select
            value={bulkActType}
            onChange={(e) => setBulkActType(parseInt(e.target.value))}
            style={{ fontSize: 12 }}
          >
            <option value={1}>영업관리소통</option>
            <option value={2}>미팅완료</option>
            <option value={3}>집중관리기간</option>
          </select>
          <MDInput
            placeholder="범위 메모"
            value={bulkMemo}
            onChange={(e) => setBulkMemo(e.target.value)}
            sx={{ width: isMobile ? 150 : 200 }}
          />
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={handleApplySelection}
            sx={{ fontSize: 11, minWidth: isMobile ? 60 : 80 }}
          >
            적용
          </MDButton>
          <MDButton
            variant="outlined"
            color="error"
            onClick={handleClearSelection}
            sx={{ fontSize: 11, minWidth: isMobile ? 60 : 80 }}
          >
            선택 해제
          </MDButton>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            mt: isMobile ? 1 : 0,
          }}
        >
          <MDButton
            variant="gradient"
            color="success"
            onClick={handleAddRow}
            sx={{ fontSize: 11, minWidth: isMobile ? 60 : undefined }}
          >
            행추가
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            sx={{ fontSize: 11, minWidth: isMobile ? 60 : undefined }}
          >
            저장
          </MDButton>
        </Box>
      </MDBox>

      {/* 테이블 영역 - 가로/세로 스크롤 */}
      <MDBox pt={0} pb={3} sx={tableSx}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <div
              onClick={() => {
                // 바깥 클릭 시: 셀 편집만 종료, 선택 영역은 유지
                setEditingCell(null);
              }}
            >
              <table>
                <colgroup>
                  {colWidths.map((w, idx) => (
                    <col
                      key={idx}
                      style={{ width: w, minWidth: w, maxWidth: w }}
                    />
                  ))}
                </colgroup>

                {/* THEAD */}
                <thead>
                  {/* 1줄째: 월 헤더 */}
                  <tr>
                    {colWidths.map((_, i) => (
                      <th
                        key={i}
                        style={{
                          width: colWidths[i],
                          left:
                            i < 8
                              ? colWidths.slice(0, i).reduce((a, b) => a + b, 0)
                              : undefined,
                          position: i < 8 ? "sticky" : "static",
                          top: 0,
                          background: "#f0f0f0",
                          zIndex: 5,
                          borderBottom: "none",
                        }}
                      ></th>
                    ))}

                    {quarterMonths.map((m, idx) => (
                      <th
                        key={idx}
                        colSpan={m.daysInMonth()}
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#f0f0f0",
                          zIndex: 4,
                          borderLeft: "2px solid #000",
                          borderRight:
                            idx === quarterMonths.length - 1
                              ? "2px solid #000"
                              : undefined,
                        }}
                      >
                        {m.format("M월")}
                      </th>
                    ))}
                  </tr>

                  {/* 2줄째: 왼쪽 헤더 + 일자 숫자 */}
                  <tr>
                    {colWidths.map((_, i) => (
                      <th
                        key={i}
                        style={{
                          width: colWidths[i],
                          left:
                            i < 8
                              ? colWidths.slice(0, i).reduce((a, b) => a + b, 0)
                              : undefined,
                          position: i < 8 ? "sticky" : "static",
                          top: 21,
                          background: "#f0f0f0",
                          borderTop: "none",
                          borderBottom: "1px solid",
                          zIndex: 6,
                        }}
                      >
                        {i === 0
                          ? "순번"
                          : i === 1
                          ? "업장명"
                          : i === 2
                          ? "영업루트"
                          : i === 3
                          ? "담당자"
                          : i === 4
                          ? "지역"
                          : i === 5
                          ? "현 위탁사"
                          : i === 6
                          ? "계약종료일"
                          : "계약상태"}
                      </th>
                    ))}

                    {quarterMonths.map((m, idx) =>
                      Array.from({ length: m.daysInMonth() }, (_, d) => {
                        const isMonthStart = d === 0;
                        const isMonthEnd = d === m.daysInMonth() - 1;

                        return (
                          <th
                            key={`${idx}-${d}`}
                            style={{
                              position: "sticky",
                              top: 21,
                              background: "#f0f0f0",
                              borderBottom: "1px solid",
                              zIndex: 5,
                              borderLeft: isMonthStart
                                ? "2px solid #000"
                                : undefined,
                              borderRight: isMonthEnd
                                ? "2px solid #000"
                                : undefined,
                            }}
                          >
                            {d + 1}
                          </th>
                        );
                      })
                    )}
                  </tr>
                </thead>

                {/* TBODY */}
                <tbody>
                  {editedRows.map((row) => {
                    const isDisabled = row.contract_type === 2; // 계약완료

                    return (
                      <tr
                        key={row.idx}
                        style={{
                          backgroundColor: isDisabled
                            ? "#FFF3B0"
                            : "transparent",
                          opacity: isDisabled ? 0.8 : 1,
                          pointerEvents: isDisabled ? "none" : "auto",
                        }}
                      >
                        {colWidths.map((_, i) => {
                          const key =
                            i === 1
                              ? "account_name"
                              : i === 2
                              ? "sales_root"
                              : i === 3
                              ? "manager"
                              : i === 4
                              ? "region"
                              : i === 5
                              ? "now_consignor"
                              : i === 6
                              ? "end_dt"
                              : i === 7
                              ? "contract_type"
                              : null;

                          const leftOffset =
                            i < 8
                              ? colWidths.slice(0, i).reduce((a, b) => a + b, 0)
                              : undefined;

                          // 순번
                          if (i === 0) {
                            return (
                              <td
                                key={i}
                                style={{
                                  position: i < 7 ? "sticky" : "static",
                                  left: leftOffset,
                                  zIndex: 2,
                                  background: isDisabled
                                    ? "#FFF3B0"
                                    : "#fff",
                                }}
                              >
                                {row.idx}
                              </td>
                            );
                          }

                          // 계약상태
                          if (i === 7) {
                            return (
                              <td
                                key={i}
                                style={{
                                  position: i < 8 ? "sticky" : "static",
                                  left: leftOffset,
                                  background: isDisabled
                                    ? "#FFF3B0"
                                    : "#fff",
                                  zIndex: 2,
                                  color: getCellColor(row, key),
                                  pointerEvents: isDisabled ? "none" : "auto",
                                }}
                              >
                                <select
                                  value={row.contract_type || 0}
                                  onChange={(e) =>
                                    handleInputChange(
                                      row.idx,
                                      "contract_type",
                                      parseInt(e.target.value)
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    background: isDisabled
                                      ? "#FFF3B0"
                                      : "transparent",
                                    color: "inherit",
                                    cursor: isDisabled ? "default" : "pointer",
                                    border: "none",
                                  }}
                                >
                                  <option value={0}>계약취소</option>
                                  <option value={1}>진행중</option>
                                  <option value={2}>계약완료</option>
                                </select>
                              </td>
                            );
                          }

                          // 일반 좌측 셀
                          return (
                            <td
                              key={i}
                              contentEditable={!isDisabled}
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                handleInputChange(
                                  row.idx,
                                  key,
                                  e.currentTarget.innerText.trim()
                                )
                              }
                              style={{
                                color: getCellColor(row, key),
                                position: i < 8 ? "sticky" : "static",
                                left: leftOffset,
                                zIndex: 2,
                                cursor: isDisabled ? "default" : "text",
                                background: isDisabled ? "#FFF3B0" : "#fff",
                                maxWidth: isMobile ? "90px" : "120px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                textAlign: "left",
                              }}
                            >
                              <Tooltip title={row[key] || ""}>
                                <span>{row[key]}</span>
                              </Tooltip>
                            </td>
                          );
                        })}

                        {/* 일자 셀 */}
                        {quarterMonths.map((m, midx) =>
                          Array.from({ length: m.daysInMonth() }, (_, d) => {
                            const date = m
                              .date(d + 1)
                              .format("YYYY-MM-DD");
                            const cellData =
                              row.dailyStatus?.[date] || {
                                act_type: 0,
                                memo: "",
                              };

                            const isEditing =
                              editingCell === `${row.idx}-${date}`;

                            const isSelected = isCellInSelection(
                              row.idx,
                              date
                            );

                            const isMonthStart = d === 0;
                            const isMonthEnd =
                              d === m.daysInMonth() - 1;

                            return (
                              <td
                                key={`${row.idx}-${midx}-${d}`}
                                style={{
                                  backgroundColor: isSelected
                                    ? "#FFE082" // 선택 영역 하이라이트
                                    : statusColors[cellData.act_type],
                                  position: "relative",
                                  cursor: isDisabled
                                    ? "default"
                                    : "pointer",
                                  opacity: isDisabled ? 0.7 : 1,
                                  borderLeft: isMonthStart
                                    ? "2px solid #000"
                                    : undefined,
                                  borderRight: isMonthEnd
                                    ? "2px solid #000"
                                    : undefined,
                                }}
                                onMouseDown={(e) => {
                                  if (isDisabled) return;
                                  if (e.button !== 0) return; // 좌클릭만

                                  // 🔸 Shift + 드래그일 때만 범위 선택 시작
                                  if (!e.shiftKey) {
                                    return; // 일반 클릭은 아래 onClick에서 편집 모드
                                  }

                                  e.preventDefault();
                                  setIsSelecting(true);
                                  setSelectionStart({
                                    rowIdx: row.idx,
                                    date,
                                  });
                                  setSelectionEnd({
                                    rowIdx: row.idx,
                                    date,
                                  });
                                  setEditingCell(null);
                                }}
                                onMouseEnter={() => {
                                  if (!isSelecting) return;
                                  if (
                                    !selectionStart ||
                                    selectionStart.rowIdx !== row.idx
                                  )
                                    return;
                                  setSelectionEnd({
                                    rowIdx: row.idx,
                                    date,
                                  });
                                }}
                                onMouseUp={() => {
                                  if (!isSelecting) return;
                                  setIsSelecting(false);
                                }}
                                onClick={(e) => {
                                  if (isDisabled) return;
                                  if (isSelecting) return;
                                  e.stopPropagation();
                                  setEditingCell(`${row.idx}-${date}`);
                                }}
                              >
                                {isEditing ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "2px",
                                    }}
                                  >
                                    <select
                                      value={cellData.act_type}
                                      autoFocus
                                      onChange={(e) =>
                                        handleDailyChange(row.idx, date, {
                                          ...cellData,
                                          act_type: parseInt(
                                            e.target.value
                                          ),
                                        })
                                      }
                                    >
                                      <option value={0}>없음</option>
                                      <option value={1}>
                                        영업관리소통
                                      </option>
                                      <option value={2}>미팅완료</option>
                                      <option value={3}>
                                        집중관리기간
                                      </option>
                                    </select>

                                    <MDInput
                                      multiline
                                      placeholder="메모"
                                      value={cellData.memo}
                                      onChange={(e) =>
                                        handleDailyChange(row.idx, date, {
                                          ...cellData,
                                          memo: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                ) : (
                                  <>
                                    {cellData.act_type !== 0
                                      ? cellData.act_type
                                      : ""}
                                    {cellData.memo && (
                                      <div
                                        className="memo-tooltip"
                                        style={{
                                          userSelect: "text",
                                          position: "absolute",
                                          top: "100%",
                                          left: 0,
                                          background: "#333",
                                          color: "#fff",
                                          padding: "2px 4px",
                                          fontSize: "12px",
                                          whiteSpace: "pre-wrap",
                                          zIndex: 100,
                                          width: "200px",
                                        }}
                                      >
                                        {cellData.memo}
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default TeleManagerTab;
