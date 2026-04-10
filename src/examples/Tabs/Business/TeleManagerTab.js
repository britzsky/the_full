// src/layouts/investment/index.js
import React, { useState, useEffect, useMemo } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Tooltip from "@mui/material/Tooltip";
import { Box, Select, MenuItem, useTheme, useMediaQuery } from "@mui/material";
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
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"));
  const isMobileOrTablet = isMobile || isTablet;

  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);

  const { teleAccountRows } = useTeleManagerData(year);
  const [loading, setLoading] = useState(true);

  // ✅ 12개월 표시
  const quarterMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => dayjs(`${year}-${i + 1}-01`)),
    [year]
  );

  const [editedRows, setEditedRows] = useState([]);

  // 🔹 드래그 선택 상태
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);

  // 🔹 드래그 범위 일괄 타입/메모
  const [bulkActType, setBulkActType] = useState(1);
  const [bulkMemo, setBulkMemo] = useState("");

  // ✅ 프론트에서만 쓰는 행 고유키
  const makeRowId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    setLoading(true);
  }, [year]);

  // ✅ rows 초기화
  useEffect(() => {
    if (teleAccountRows.length >= 0) {
      setLoading(false);

      const grouped = teleAccountRows.reduce((acc, item) => {
        const existing = acc.find((r) => String(r.idx) === String(item.idx));

        const hasDaily = item.act_type || item.memo;
        const dailyStatus = hasDaily
          ? { [item.act_dt]: { act_type: item.act_type, memo: item.memo } }
          : {};

        if (existing) {
          if (item.act_dt && hasDaily) {
            existing.dailyStatus[item.act_dt] = { act_type: item.act_type, memo: item.memo };
            existing.originalDailyStatus[item.act_dt] = { act_type: item.act_type, memo: item.memo };
          }
        } else {
          const contractType = Number(item.contract_type ?? 0);
          acc.push({
            ...item,
            contract_type: contractType, // ✅ 화면에도 확실히 세팅
            _rowId: makeRowId(),
            isNew: false,
            dailyStatus,
            originalDailyStatus: { ...dailyStatus },
            originalLeft: {
              account_name: item.account_name ?? "",
              sales_root: item.sales_root ?? "",
              manager: item.manager ?? "",
              region: item.region ?? "",
              now_consignor: item.now_consignor ?? "",
              end_dt: item.end_dt ?? "",
              contract_type: contractType,
            },
          });
        }
        return acc;
      }, []);

      setEditedRows(grouped);
    }
  }, [teleAccountRows]);

  const colWidths = [30, 170, 150, 160, 60, 100, 140, 80];
  const desktopStickyColumnCount = 8;
  // 모바일/태블릿은 본문만 순번+업장명까지만 고정
  const bodyStickyColumnCount = isMobileOrTablet ? 2 : desktopStickyColumnCount;
  // 모바일/태블릿 헤더는 순번/업장명만 좌우 고정, 나머지는 상하(top)만 고정
  const headerStickyColumnCount = isMobileOrTablet ? 2 : desktopStickyColumnCount;
  const isBodyStickyColumn = (columnIndex) => columnIndex < bodyStickyColumnCount;
  const isHeaderStickyColumn = (columnIndex) => columnIndex < headerStickyColumnCount;
  const getStickyLeft = (columnIndex) => colWidths.slice(0, columnIndex).reduce((a, b) => a + b, 0);

  // ✅ table style
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
    [`& thead th:nth-child(-n+${headerStickyColumnCount})`]: {
      position: "sticky",
      background: "#fff",
      zIndex: 3,
    },
    [`& tbody td:nth-child(-n+${bodyStickyColumnCount})`]: {
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

  // ✅ 수정
  const handleInputChange = (rowId, key, value) => {
    setEditedRows((prev) => prev.map((row) => (row._rowId === rowId ? { ...row, [key]: value } : row)));
  };

  const handleDailyChange = (rowId, date, value) => {
    setEditedRows((prev) =>
      prev.map((row) => {
        if (row._rowId !== rowId) return row;
        const updated = { ...row.dailyStatus, [date]: value };
        if ((value.act_type ?? 0) === 0 && !(value.memo ?? "")) delete updated[date];
        return { ...row, dailyStatus: updated };
      })
    );
  };

  const [editingCell, setEditingCell] = useState(null);

  function getCellColor(row, key) {
    if (!row.originalLeft) return "black";
    return row[key] !== row.originalLeft[key] ? "red" : "black";
  }

  const statusColors = { 0: "white", 1: "lightgreen", 2: "lightblue", 3: "salmon" };

  const isCellInSelection = (rowId, date) => {
    if (!selectionStart || !selectionEnd) return false;
    if (selectionStart.rowId !== rowId) return false;

    const start = dayjs(selectionStart.date);
    const end = dayjs(selectionEnd.date);
    const current = dayjs(date);

    const min = start.isBefore(end) ? start : end;
    const max = start.isAfter(end) ? start : end;

    return current.isSameOrAfter(min, "day") && current.isSameOrBefore(max, "day");
  };

  const handleApplySelection = () => {
    if (!selectionStart || !selectionEnd) {
      Swal.fire("알림", "선택된 날짜 범위가 없습니다.", "info");
      return;
    }
    const rowId = selectionStart.rowId;
    if (rowId !== selectionEnd.rowId) {
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
        if (r._rowId !== rowId) return r;
        const updatedDaily = { ...r.dailyStatus };
        dates.forEach((dt) => {
          updatedDaily[dt] = { act_type: bulkActType, memo: bulkMemo };
        });
        return { ...r, dailyStatus: updatedDaily };
      })
    );

    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  };

  const handleClearSelection = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const toDateInputValue = (val) => {
    if (!val) return "";
    const d = dayjs(val);
    return d.isValid() ? d.format("YYYY-MM-DD") : "";
  };

  // ✅ 저장
  const handleSave = async () => {
    const payload = editedRows.flatMap((row) => {
      const baseKeys = ["account_name", "sales_root", "manager", "region", "now_consignor", "end_dt", "contract_type"];

      const currType = Number(row.contract_type ?? 0);
      const origType = Number(row.originalLeft?.contract_type ?? 0);

      const isNewRow = !!row.isNew;
      const isChangedToDone = currType !== origType && currType === 2;

      const leftAll = baseKeys.reduce(
        (acc, key) => {
          // ✅ contract_type 누락 방지: 무조건 숫자로
          acc[key] = key === "contract_type" ? Number(row[key] ?? 0) : row[key];
          return acc;
        },
        { idx: row.idx }
      );

      const leftChanged = baseKeys.reduce(
        (acc, key) => {
          const curr = key === "contract_type" ? Number(row[key] ?? 0) : row[key];
          const orig = key === "contract_type" ? Number(row.originalLeft?.[key] ?? 0) : row.originalLeft?.[key];
          if (curr !== orig) acc[key] = curr;
          return acc;
        },
        { idx: row.idx }
      );
      const changedLeft = Object.keys(leftChanged).length > 1;

      const dailyEntries = Object.entries(row.dailyStatus || {});
      const dailyAll = dailyEntries.map(([date, val]) => ({
        idx: row.idx,
        act_dt: date,
        act_type: val.act_type ?? 0,
        memo: val.memo ?? "",
      }));

      const dailyChanged = dailyEntries
        .filter(([date, val]) => {
          const orig = row.originalDailyStatus?.[date] || { act_type: 0, memo: "" };
          return (val.act_type ?? 0) !== orig.act_type || (val.memo ?? "") !== orig.memo;
        })
        .map(([date, val]) => ({
          idx: row.idx,
          act_dt: date,
          act_type: val.act_type ?? 0,
          memo: val.memo ?? "",
        }));

      if (isNewRow) {
        const result = [leftAll];
        if (dailyAll.length > 0) result.push(...dailyAll);
        return result;
      }

      if (isChangedToDone) {
        const result = [leftAll];
        if (dailyAll.length > 0) result.push(...dailyAll);
        return result;
      }

      const result = [];
      if (changedLeft) result.push(leftChanged);
      if (dailyChanged.length > 0) result.push(...dailyChanged);
      return result;
    });

    if (payload.length === 0) return;

    try {
      await api.post("/Business/BusinessTeleAccountSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      Swal.fire({ icon: "success", title: "저장", text: "저장되었습니다." });

      setEditedRows((prev) =>
        prev.map((row) => ({
          ...row,
          isNew: false,
          originalLeft: {
            account_name: row.account_name ?? "",
            sales_root: row.sales_root ?? "",
            manager: row.manager ?? "",
            region: row.region ?? "",
            now_consignor: row.now_consignor ?? "",
            end_dt: row.end_dt ?? "",
            contract_type: Number(row.contract_type ?? 0),
          },
          originalDailyStatus: { ...(row.dailyStatus || {}) },
        }))
      );
    } catch (err) {
      Swal.fire({ title: "실패", text: err.message, icon: "error" });
    }
  };

  // ✅ 행추가: contract_type 기본값 0
  const handleAddRow = () => {
    const newIdx =
      editedRows.length > 0 ? Math.max(...editedRows.map((r) => Number(r.idx) || 0)) + 1 : 1;

    const newRow = {
      idx: newIdx,
      _rowId: makeRowId(),
      isNew: true,
      account_name: "",
      sales_root: "",
      manager: "",
      region: "",
      now_consignor: "",
      end_dt: "",
      contract_type: 0,
      dailyStatus: {},
      originalDailyStatus: {},
      originalLeft: {
        account_name: "",
        sales_root: "",
        manager: "",
        region: "",
        now_consignor: "",
        end_dt: "",
        contract_type: 0,
      },
    };

    setEditedRows((prev) => [...prev, newRow]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobileOrTablet ? "flex-start" : "flex-end",
          alignItems: "center",
          flexWrap: isMobileOrTablet ? "wrap" : "nowrap",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: isMobileOrTablet ? "wrap" : "nowrap",
            justifyContent: isMobileOrTablet ? "flex-start" : "space-between",
            alignItems: "center",
            gap: 1,
            width: isMobileOrTablet ? "100%" : "auto",
          }}
        >
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small" sx={{ minWidth: 90 }}>
            {Array.from({ length: 10 }, (_, i) => now.year() - 5 + i).map((y) => (
              <MenuItem key={y} value={y}>
                {y}년
              </MenuItem>
            ))}
          </Select>

          <MDButton
            color="info"
            sx={{ minWidth: 0, visibility: "hidden", display: isMobileOrTablet ? "none" : "inline-flex" }}
          />
        </Box>

        {/* 범위 적용 */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            border: "1px solid #ccc",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            flexWrap: isMobileOrTablet ? "wrap" : "nowrap",
            width: isMobileOrTablet ? "100%" : "auto",
          }}
        >
          <span style={{ fontSize: 12 }}>범위 타입</span>
          <select value={bulkActType} onChange={(e) => setBulkActType(parseInt(e.target.value, 10))} style={{ fontSize: 12 }}>
            <option value={1}>영업관리소통</option>
            <option value={2}>미팅완료</option>
            <option value={3}>집중관리기간</option>
          </select>

          <MDInput
            placeholder="범위 메모"
            value={bulkMemo}
            onChange={(e) => setBulkMemo(e.target.value)}
            sx={{ width: isMobile ? 150 : isTablet ? 170 : 200 }}
          />

          <MDButton variant="outlined" color="secondary" onClick={handleApplySelection} sx={{ fontSize: 11 }}>
            적용
          </MDButton>
          <MDButton variant="outlined" color="error" onClick={handleClearSelection} sx={{ fontSize: 11 }}>
            선택 해제
          </MDButton>
        </Box>

        <Box sx={{ display: "flex", gap: 1, mt: isMobileOrTablet ? 1 : 0 }}>
          <MDButton variant="gradient" color="success" onClick={handleAddRow} sx={{ fontSize: 11 }}>
            행추가
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={handleSave} sx={{ fontSize: 11 }}>
            저장
          </MDButton>
        </Box>
      </MDBox>

      {/* 테이블 */}
      <MDBox
        pt={0}
        pb={3}
        sx={tableSx}
        onClick={() => {
          setEditingCell(null);
        }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <table>
              <colgroup>
                {colWidths.map((w, idx) => (
                  <col key={idx} style={{ width: w, minWidth: w, maxWidth: w }} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  {colWidths.map((_, i) => (
                    <th
                      key={i}
                      style={{
                        width: colWidths[i],
                        // 상하 고정은 모든 헤더에 적용하고, 좌우 고정은 순번/업장명만 적용
                        left: isHeaderStickyColumn(i) ? getStickyLeft(i) : undefined,
                        position: "sticky",
                        top: 0,
                        background: "#f0f0f0",
                        zIndex: isHeaderStickyColumn(i) ? 6 : 4,
                        borderBottom: "none",
                      }}
                    />
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
                        borderRight: idx === quarterMonths.length - 1 ? "2px solid #000" : undefined,
                      }}
                    >
                      {m.format("M월")}
                    </th>
                  ))}
                </tr>

                <tr>
                  {colWidths.map((_, i) => (
                    <th
                      key={i}
                      style={{
                        width: colWidths[i],
                        // 상하 고정은 모든 헤더에 적용하고, 좌우 고정은 순번/업장명만 적용
                        left: isHeaderStickyColumn(i) ? getStickyLeft(i) : undefined,
                        position: "sticky",
                        top: 21,
                        background: "#f0f0f0",
                        borderTop: "none",
                        borderBottom: "1px solid",
                        zIndex: isHeaderStickyColumn(i) ? 7 : 5,
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
                            borderLeft: isMonthStart ? "2px solid #000" : undefined,
                            borderRight: isMonthEnd ? "2px solid #000" : undefined,
                          }}
                        >
                          {d + 1}
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>

              <tbody>
                {editedRows.map((row) => {
                  // ✅ 계약완료면 행 전체는 잠그되, "계약상태 select"만 수정 가능하게
                  const isContractDone = Number(row.contract_type) === 2;

                  const leftInputStyle = {
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: isMobile ? 10 : 12,
                    padding: "0 2px",
                  };

                  // ✅ 잠금 범위(계약상태 제외)
                  const lockStyle = {
                    background: isContractDone ? "#FFF3B0" : "#fff",
                  };

                  return (
                    <tr
                      key={row._rowId}
                      style={{
                        backgroundColor: isContractDone ? "#FFF3B0" : "#fff",
                      }}
                    >
                      {/* 0: 순번 */}
                      <td
                        style={{
                          position: isBodyStickyColumn(0) ? "sticky" : "static",
                          left: isBodyStickyColumn(0) ? getStickyLeft(0) : undefined,
                          zIndex: isBodyStickyColumn(0) ? 2 : 1,
                          background: lockStyle.background,
                        }}
                      >
                        {row.idx}
                      </td>

                      {/* 1~5: input, 계약완료면 disabled */}
                      {[
                        { key: "account_name", wIdx: 1 },
                        { key: "sales_root", wIdx: 2 },
                        { key: "manager", wIdx: 3 },
                        { key: "region", wIdx: 4 },
                        { key: "now_consignor", wIdx: 5 },
                      ].map(({ key, wIdx }) => {
                        const isSticky = isBodyStickyColumn(wIdx);
                        return (
                          <td
                            key={key}
                            style={{
                              position: isSticky ? "sticky" : "static",
                              left: isSticky ? getStickyLeft(wIdx) : undefined,
                              zIndex: isSticky ? 2 : 1,
                              background: isSticky ? lockStyle.background : isContractDone ? "#FFF3B0" : "#fff",
                              textAlign: "left",
                              color: getCellColor(row, key),
                              padding: "2px 6px",
                              maxWidth: isMobile ? "90px" : "120px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip title={row[key] || ""}>
                              <input
                                value={row[key] ?? ""}
                                disabled={isContractDone}
                                onChange={(e) => handleInputChange(row._rowId, key, e.target.value)}
                                style={{
                                  ...leftInputStyle,
                                  color: "inherit",
                                  cursor: isContractDone ? "default" : "text",
                                }}
                              />
                            </Tooltip>
                          </td>
                        );
                      })}

                      {/* 6: 계약종료일 (계약완료면 disabled) */}
                      <td
                        style={{
                          position: isBodyStickyColumn(6) ? "sticky" : "static",
                          left: isBodyStickyColumn(6) ? getStickyLeft(6) : undefined,
                          zIndex: isBodyStickyColumn(6) ? 2 : 1,
                          background: isBodyStickyColumn(6)
                            ? lockStyle.background
                            : isContractDone
                              ? "#FFF3B0"
                              : "#fff",
                          textAlign: "left",
                          color: getCellColor(row, "end_dt"),
                          padding: "2px 6px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="date"
                          value={toDateInputValue(row.end_dt)}
                          disabled={isContractDone}
                          onChange={(e) => handleInputChange(row._rowId, "end_dt", e.target.value)}
                          style={{
                            ...leftInputStyle,
                            cursor: isContractDone ? "default" : "pointer",
                            color: "inherit",
                          }}
                        />
                      </td>

                      {/* 7: 계약상태 (✅ 계약완료여도 이 select 는 수정 가능) */}
                      <td
                        style={{
                          position: isBodyStickyColumn(7) ? "sticky" : "static",
                          left: isBodyStickyColumn(7) ? getStickyLeft(7) : undefined,
                          zIndex: isBodyStickyColumn(7) ? 3 : 1,
                          background: isContractDone ? "#FFF3B0" : "#fff",
                          color: getCellColor(row, "contract_type"),
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={Number(row.contract_type ?? 0)}
                          onChange={(e) =>
                            handleInputChange(row._rowId, "contract_type", parseInt(e.target.value, 10))
                          }
                          style={{
                            width: "100%",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            border: "none",
                            outline: "none",
                            fontSize: isMobile ? 10 : 12,
                          }}
                        >
                          <option value={0}>계약취소</option>
                          <option value={1}>진행중</option>
                          <option value={2}>계약완료</option>
                        </select>
                      </td>

                      {/* 일자 셀: 계약완료면 클릭/드래그 막기 */}
                      {quarterMonths.map((m, midx) =>
                        Array.from({ length: m.daysInMonth() }, (_, d) => {
                          const date = m.date(d + 1).format("YYYY-MM-DD");
                          const cellData = row.dailyStatus?.[date] || { act_type: 0, memo: "" };
                          const isEditing = editingCell === `${row._rowId}-${date}`;
                          const isSelected = isCellInSelection(row._rowId, date);

                          const isMonthStart = d === 0;
                          const isMonthEnd = d === m.daysInMonth() - 1;

                          return (
                            <td
                              key={`${row._rowId}-${midx}-${d}`}
                              style={{
                                backgroundColor: isSelected ? "#FFE082" : statusColors[cellData.act_type],
                                position: "relative",
                                cursor: isContractDone ? "default" : "pointer",
                                opacity: isContractDone ? 0.6 : 1,
                                pointerEvents: isContractDone ? "none" : "auto",
                                borderLeft: isMonthStart ? "2px solid #000" : undefined,
                                borderRight: isMonthEnd ? "2px solid #000" : undefined,
                              }}
                              onMouseDown={(e) => {
                                if (isContractDone) return;
                                if (e.button !== 0) return;
                                if (!e.shiftKey) return;

                                e.preventDefault();
                                setIsSelecting(true);
                                setSelectionStart({ rowId: row._rowId, date });
                                setSelectionEnd({ rowId: row._rowId, date });
                                setEditingCell(null);
                              }}
                              onMouseEnter={() => {
                                if (!isSelecting) return;
                                if (!selectionStart || selectionStart.rowId !== row._rowId) return;
                                setSelectionEnd({ rowId: row._rowId, date });
                              }}
                              onMouseUp={() => {
                                if (!isSelecting) return;
                                setIsSelecting(false);
                              }}
                              onClick={(e) => {
                                if (isContractDone) return;
                                if (isSelecting) return;
                                e.stopPropagation();
                                setEditingCell(`${row._rowId}-${date}`);
                              }}
                            >
                              {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                  <select
                                    value={cellData.act_type}
                                    autoFocus
                                    onChange={(e) =>
                                      handleDailyChange(row._rowId, date, {
                                        ...cellData,
                                        act_type: parseInt(e.target.value, 10),
                                      })
                                    }
                                  >
                                    <option value={0}>없음</option>
                                    <option value={1}>영업관리소통</option>
                                    <option value={2}>미팅완료</option>
                                    <option value={3}>집중관리기간</option>
                                  </select>

                                  <MDInput
                                    multiline
                                    placeholder="메모"
                                    value={cellData.memo}
                                    onChange={(e) =>
                                      handleDailyChange(row._rowId, date, {
                                        ...cellData,
                                        memo: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              ) : (
                                <>
                                  {cellData.act_type !== 0 ? cellData.act_type : ""}
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
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default TeleManagerTab;
