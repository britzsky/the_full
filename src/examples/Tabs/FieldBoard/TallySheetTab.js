import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import dayjs from "dayjs";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField, Select, MenuItem } from "@mui/material";
import useTallysheetData, { parseNumber, formatNumber } from "./tallysheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";

function TallySheetTab() {
  // ✅ localStorage 에서 account_id 가져오기
  const storedAccountId = localStorage.getItem("account_id") || "";

  const [selectedAccountId, setSelectedAccountId] = useState(storedAccountId);
  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const handleYearChange = (e) => setYear(Number(e.target.value));
  const handleMonthChange = (e) => setMonth(Number(e.target.value));

  const {
    dataRows,
    setDataRows,
    data2Rows,
    setData2Rows,
    accountList,
    countMonth,
    count2Month,
    loading,
    fetchDataRows,
    fetchData2Rows,
  } = useTallysheetData(selectedAccountId, year, month);

  // 최초 조회 후 original 세팅
  useEffect(() => {
    if (dataRows?.length > 0) setOriginalRows(dataRows.map((row) => ({ ...row })));
  }, [dataRows]);

  useEffect(() => {
    if (data2Rows?.length > 0) setOriginal2Rows(data2Rows.map((row) => ({ ...row })));
  }, [data2Rows]);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) setSelectedAccountId(accountList[0].account_id);
  }, [accountList, selectedAccountId]);

  // 컬럼 정의
  const columns = useMemo(() => {
    const dayColumns = Array.from({ length: 31 }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      size: 80,
    }));
    return [{ header: "구분", accessorKey: "name", size: 80 }, ...dayColumns, { header: "합계", accessorKey: "total", size: 80 }];
  }, []);

  // 총합행 계산
  const tableData = useMemo(() => {
    if (!dataRows || dataRows.length === 0) return [];
    const columnTotals = {};
    for (let i = 1; i <= 31; i++) columnTotals[`day_${i}`] = dataRows.reduce((sum, row) => sum + parseNumber(row[`day_${i}`]), 0);
    const grandTotal = Object.values(columnTotals).reduce((a, b) => a + b, 0);
    return [...dataRows, { name: "총합", ...columnTotals, total: grandTotal }];
  }, [dataRows]);

  const table2Data = useMemo(() => {
    if (!data2Rows || data2Rows.length === 0) return [];
    const columnTotals = {};
    for (let i = 1; i <= 31; i++) columnTotals[`day_${i}`] = data2Rows.reduce((sum, row) => sum + parseNumber(row[`day_${i}`]), 0);
    const grandTotal = Object.values(columnTotals).reduce((a, b) => a + b, 0);
    return [...data2Rows, { name: "총합", ...columnTotals, total: grandTotal }];
  }, [data2Rows]);

  const table = useReactTable({ data: tableData, columns, getCoreRowModel: getCoreRowModel() });
  const table2 = useReactTable({ data: table2Data, columns, getCoreRowModel: getCoreRowModel() });

  // 셀 수정 핸들러
  const handleCellChange = (rowIndex, columnId, value) => {
    const row = dataRows[rowIndex];
    if (!row || row.name === "총합" || columnId === "name" || columnId === "total") return;
    const newValue = parseNumber(value);
    setDataRows(dataRows.map((r, idx) => (idx === rowIndex ? { ...r, [columnId]: newValue } : r)));
  };

  const handleCell2Change = (rowIndex, columnId, value) => {
    const row = data2Rows[rowIndex];
    if (!row || row.name === "총합" || columnId === "name" || columnId === "total") return;
    const newValue = parseNumber(value);
    setData2Rows(data2Rows.map((r, idx) => (idx === rowIndex ? { ...r, [columnId]: newValue } : r)));
  };

  // 저장
  const handleSave = async () => {
    const getChangedRows = (current, original) =>
      current
        .map((row, rowIndex) => {
          const changedCols = {};
          let hasChange = false;
          Object.keys(row).forEach((key) => {
            if (key === "name" || key === "total" || row.name === "총합") return;
            const currVal = parseNumber(row[key]);
            const origVal = parseNumber(original?.[rowIndex]?.[key]);
            if (currVal !== origVal) {
              changedCols[key] = currVal;
              hasChange = true;
            }
          });
          return hasChange ? { ...row, ...changedCols } : null;
        })
        .filter(Boolean);

    const changedNowList = getChangedRows(dataRows, originalRows);
    const changedBeforeList = getChangedRows(data2Rows, original2Rows);

    if (!changedNowList.length && !changedBeforeList.length) return console.log("변경된 내용이 없습니다.");

    const payload = { nowList: changedNowList, beforeList: changedBeforeList };

    try {
      const response = await api.post("/Operate/TallySheetSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
        Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success", confirmButtonColor: "#d33", confirmButtonText: "확인" });
        await fetchDataRows(selectedAccountId, year, month);
        await fetchData2Rows(selectedAccountId, year, month);
      }
    } catch (error) {
      Swal.fire({ title: "실패", text: error.message || "저장 중 오류 발생", icon: "error", confirmButtonColor: "#d33", confirmButtonText: "확인" });
    }
  };

  const ratioData = useMemo(() => Array.from({ length: 31 }, (_, i) => (((i + 1) / 31) * 100).toFixed(2) + "%"), []);

  if (loading) return <LoadingScreen />;

  // 테이블 렌더링
  const renderTable = (tableInstance, originalRowsRef, handleChangeFn, dataState) => (
    <MDBox
      pt={0}
      sx={{
        overflowX: "auto",
        "& table": { borderCollapse: "separate", width: "max-content", minWidth: "50%", borderSpacing: 0 },
        "& th, & td": { border: "1px solid #686D76", textAlign: "center", whiteSpace: "nowrap", fontSize: "12px", padding: "4px" },
        "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
        "& td:first-of-type, & th:first-of-type": { position: "sticky", left: 0, background: "#f0f0f0", zIndex: 3, border: "1px solid #686D76" },
        "& .edited-cell": { color: "#d32f2f !important", fontWeight: 500 },
        "td[contenteditable]": { minWidth: "70px", cursor: "text" },
        "& .total-row": { backgroundColor: "#f0f0f0", fontWeight: "bold" },
      }}
    >
      <table>
        <thead>
          <tr style={{ backgroundColor: "#FFE3A9" }}>
            <td>일 사용기준 %</td>
            {ratioData.map((val, idx) => (
              <td key={idx} style={{ fontSize: "14px", fontWeight: "bold" }}>
                {val}
              </td>
            ))}
            <td></td>
          </tr>
          {tableInstance.getHeaderGroups().map((headerGroup) => (
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
          {tableInstance.getRowModel().rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const colKey = cell.column.columnDef.accessorKey;
                const isTotalRow = row.original.name === "총합";

                if (colKey === "total") {
                  const total = Array.from({ length: 31 }, (_, i) => parseNumber(row.original[`day_${i + 1}`])).reduce((a, b) => a + b, 0);
                  return (
                    <td key={cell.id} className={isTotalRow ? "total-row" : ""}>
                      {formatNumber(total)}
                    </td>
                  );
                }

                const isEditable = !isTotalRow && colKey !== "name" && colKey !== "total";
                const curr = parseNumber(dataState[rowIndex]?.[colKey] ?? 0);
                const orig = parseNumber(originalRowsRef?.[rowIndex]?.[colKey] ?? 0);
                //const isChanged = isEditable && curr !== orig;
                const isChanged = isEditable && parseNumber(dataState[rowIndex][colKey]) !== parseNumber(originalRowsRef[rowIndex][colKey]);
                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{ color: isChanged ? "red" : "black" }}
                    onInput={(e) => {
                      if (!isEditable) return;
                      handleChangeFn(rowIndex, colKey, e.currentTarget.innerText);
                    }}
                    onBlur={(e) => {
                      if (colKey !== "name" && colKey !== "total") 
                        e.target.innerText = formatNumber(parseNumber(e.currentTarget.innerText));
                    }}
                  >
                    {colKey === "name" ? row.original[colKey] : formatNumber(row.original[colKey])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </MDBox>
  );

  return (
    <>
      <MDBox 
        pt={1} 
        pb={1} 
        gap={1} 
        sx={{ 
          display: "flex", 
          justifyContent: "flex-end",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        <Select value={year} onChange={handleYearChange} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>
        <Select value={month} onChange={handleMonthChange} size="small">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>
              {m}월
            </MenuItem>
          ))}
        </Select>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 첫 번째 테이블 */}
      <MDBox pt={3} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">
                  집계표 {countMonth ? `(${countMonth})` : ""}
                </MDTypography>
              </MDBox>
              {renderTable(table, originalRows, handleCellChange, dataRows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* 두 번째 테이블 */}
      <MDBox pt={1} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">
                  집계표 {count2Month ? `(${count2Month})` : ""}
                </MDTypography>
              </MDBox>
              {renderTable(table2, original2Rows, handleCell2Change, data2Rows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default TallySheetTab;
