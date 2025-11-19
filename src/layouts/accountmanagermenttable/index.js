/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Modal, Box, Select, MenuItem, Typography, Button, TextField } from "@mui/material";
import dayjs from "dayjs";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "../loading/loadingscreen";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import useAccountManagermentTableData, { parseNumber, formatNumber } from "./data/accountmanagermenttableData";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";

// ======================== 선택 테이블 컴포넌트 ========================
function YourSelectableTable({ data, selected, setSelected }) {
  const safeData = Array.isArray(data) ? data : [];

  const toggleSelect = (item) => {
    const index = selected.findIndex((i) => JSON.stringify(i) === JSON.stringify(item));
    if (index !== -1) setSelected(selected.filter((_, idx) => idx !== index));
    else setSelected([...selected, item]);
  };

  const isSelected = (item) => selected.some((i) => JSON.stringify(i) === JSON.stringify(item));

  const tableSx = {
    maxHeight: "550px",
    overflow: "auto",
    "& table": { borderCollapse: "collapse", width: "100%", minWidth: "100%", borderSpacing: 0 },
    "& th, & td": { border: "1px solid #686D76", textAlign: "center", padding: "4px", whiteSpace: "nowrap", fontSize: "12px" },
    "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
  };

  return (
    <Box sx={tableSx}>
      <table>
        <thead>
          <tr>
            <th>선택</th>
            <th>이름</th>
            <th>타입</th>
          </tr>
        </thead>
        <tbody>
          {safeData.map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: isSelected(row)
                  ? "#d3f0ff"
                  : row.del_yn === "Y"
                  ? "#E0E0E0"
                  : "white",
              }}
            >
              <td>
                <input
                  type="checkbox"
                  checked={isSelected(row)}
                  onChange={() => toggleSelect(row)}
                />
              </td>
              <td>{row.name}</td>
              <td>{row.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

YourSelectableTable.propTypes = {
  data: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  setSelected: PropTypes.func.isRequired,
};

// ======================== 메인 집계표 컴포넌트 ========================
function AccountManagermentTable() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const {
    dataRows = [],
    setDataRows,
    accountList = [],
    loading,
    fetchDataRows,
  } = useAccountManagermentTableData(selectedAccountId, year, month);

  // ✅ 원본 데이터 관리 로직 개선
  useEffect(() => {
    setDataRows([]);
    setOriginalRows([]);
  }, [selectedAccountId, year, month]);

  // ✅ 원본 데이터 저장 useEffect 수정
  useEffect(() => {
    if (Array.isArray(dataRows) && dataRows.length > 0 && originalRows.length === 0) {
      setOriginalRows(dataRows.map(r => ({ ...r })));
    }
  }, [dataRows]);

  useEffect(() => {
    if (Array.isArray(accountList) && accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  // 컬럼 구성
  const columns = useMemo(() => {
    const dayColumns = Array.from({ length: 31 }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      size: 80,
    }));
    return [
      { header: "구분", accessorKey: "name", size: 80 },
      ...dayColumns,
      { header: "합계", accessorKey: "total", size: 80 },
    ];
  }, []);

  // 합계 계산
  const makeTableData = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const totals = {};
    for (let i = 1; i <= 31; i++)
      totals[`day_${i}`] = rows.reduce(
        (sum, r) => sum + parseNumber(r[`day_${i}`]),
        0
      );
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    return [...rows, { name: "총합", ...totals, total: grandTotal }];
  };

  const tableData = useMemo(() => makeTableData(dataRows), [dataRows]);

  const table = useReactTable({ data: tableData, columns, getCoreRowModel: getCoreRowModel() });

  // ✅ 셀 변경 핸들러
  const handleCellChange = (rowIndex, colKey, value) => {
    const rows = [...dataRows];
    const row = rows[rowIndex];
    if (!row || row.name === "총합" || colKey === "name" || colKey === "total") return;
    const newValue = parseNumber(value);
    rows[rowIndex] = { ...row, [colKey]: newValue };
    setDataRows(rows);
  };

  // ✅ 저장
  const handleSave = async () => {
    const getChangedRows = (curr, orig) =>
      curr
        .map((row, idx) => {
          const changed = {};
          let hasChange = false;
          Object.keys(row).forEach((k) => {
            if (["name", "total"].includes(k) || row.name === "총합") return;
            if (parseNumber(row[k]) !== parseNumber(orig?.[idx]?.[k])) {
              changed[k] = parseNumber(row[k]);
              hasChange = true;
            }
          });
          return hasChange ? { ...row, ...changed } : null;
        })
        .filter(Boolean);

    const changedNow = getChangedRows(dataRows, originalRows);
    const changedBefore = getChangedRows([], original2Rows); // data2Rows 제거됨

    if (!changedNow.length && !changedBefore.length) {
      return Swal.fire("정보", "변경된 내용이 없습니다.", "info");
    }

    try {
      const payload = { nowList: changedNow, beforeList: changedBefore };
      const res = await api.post("/Operate/TallySheetSave", payload);
      if (res.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        }).then(async (result) => {
          if (result.isConfirmed) {
            await fetchDataRows(selectedAccountId, year, month);
            setOriginalRows(dataRows.map(r => ({ ...r })));
          }
        });
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  const ratioData = useMemo(
    () => Array.from({ length: 31 }, (_, i) => (((i + 1) / 31) * 100).toFixed(2) + "%"),
    []
  );

  // 모달 상태 및 항목 관리 상태
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState([]);
  const [selectedRight, setSelectedRight] = useState([]);

  // 모달 오픈 시 데이터 조회
  const handleModalOpen = async () => {
    setOpen(true);
    setSelectedLeft([]);
    setSelectedRight([]);
    try {
      const leftRes = await api.get("/Operate/AccountMappingList");
      const safeLeft = Array.isArray(leftRes.data) ? leftRes.data : leftRes.data?.data || [];
      setLeftItems(safeLeft);

      if (selectedAccountId) {
        const rightRes = await api.get("/Operate/AccountMappingV2List", {
          params: { account_id: selectedAccountId },
        });
        const safeRight = Array.isArray(rightRes.data) ? rightRes.data : rightRes.data?.data || [];
        setRightItems(safeRight);
      } else {
        setRightItems([]);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ title: "오류", text: "거래처 목록을 불러오지 못했습니다.", icon: "error" });
    }
  };

  // 항목 이동
  const moveRight = () => {
    const duplicates = selectedLeft.filter(item =>
      rightItems.some(r => r.type === item.type && r.del_yn === "N")
    );

    if (duplicates.length > 0) {
      Swal.fire({ title: "중복", text: "이미 등록되어 있는 항목입니다.", icon: "warning" });
      return;
    }

    const updatedRightItems = [
      ...rightItems,
      ...selectedLeft.map(item => ({ ...item, account_id: selectedAccountId, del_yn: "N" })),
    ];

    setRightItems(updatedRightItems);
    setSelectedLeft([]);
  };

  const moveLeft = () => {
    const updatedRightItems = rightItems.map(item =>
      selectedRight.includes(item)
        ? { ...item, del_yn: "Y" }
        : item
    );
    setRightItems(updatedRightItems);
    setSelectedRight([]);
  };

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      return Swal.fire({ title: "계정 선택", text: "계정을 먼저 선택하세요.", icon: "warning" });
    }

    try {
      const payload = rightItems;
      const response = await api.post("/Operate/AccountMappingSave", payload);
      if (response.data.code === 200) {
        Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success" });
        setOpen(false);
        await fetchDataRows(selectedAccountId, year, month);
      }
    } catch (err) {
      Swal.fire({ title: "오류", text: err.message || "저장 실패", icon: "error" });
    }
  };

  // 거래처 등록 모달
  const [formData, setFormData] = useState({ name: "" });

  const handleModalOpen2 = () => setOpen2(true);
  const handleModalClose2 = () => setOpen2(false);

  const handleChange2 = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit2 = async () => {
    if (!formData.name) {
      return Swal.fire({
        title: "경고",
        text: "필수항목을 확인하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
    try {
      const response = await api.post("/Operate/AccountCreateSave", formData);
      if (response.data.code === 200) {
        Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success" });
        setOpen2(false);
      }
    } catch (err) {
      Swal.fire({ title: "오류", text: err.message || "저장 실패", icon: "error" });
    }
  };

  if (loading) return <LoadingScreen />;

  // ✅ React 기반 색상 비교 렌더링
  const renderTable = (tableInstance, originalData, handleChange, dataState) => (
    <MDBox
      pt={0}
      sx={{
        overflowX: "auto",
        "& table": { borderCollapse: "separate", width: "max-content", minWidth: "50%", borderSpacing: 0 },
        "& th, & td": { border: "1px solid #686D76", textAlign: "center", whiteSpace: "nowrap", fontSize: "12px", padding: "4px" },
        "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
        "& td:first-of-type, & th:first-of-type": { position: "sticky", left: 0, background: "#f0f0f0", zIndex: 3 },
        "& .total-row": { backgroundColor: "#FFE3A9", fontWeight: "bold" },
      }}
    >
      <table>
        <thead>
          <tr style={{ backgroundColor: "#FFE3A9" }}>
            <td>일 사용기준 %</td>
            {ratioData.map((val, idx) => (
              <td key={idx}>{val}</td>
            ))}
            <td></td>
          </tr>
          {tableInstance.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {tableInstance.getRowModel().rows.map((row, rIdx) => (
            <tr key={row.id} className={row.original.name === "총합" ? "total-row" : ""}>
              {row.getVisibleCells().map((cell) => {
                const colKey = cell.column.columnDef.accessorKey;
                const isEditable = colKey !== "name" && row.original.name !== "총합";

                const currVal = parseNumber(dataState[rIdx]?.[colKey]);
                const origVal = parseNumber(originalData[rIdx]?.[colKey]);
                const isChanged = isEditable && currVal !== origVal;

                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{ color: isChanged ? "#d32f2f" : "black" }}
                    onBlur={(e) =>
                      handleChange(rIdx, colKey, e.currentTarget.innerText)
                    }
                  >
                    {colKey === "name"
                      ? row.original[colKey]
                      : formatNumber(row.original[colKey])}
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
    <DashboardLayout>
      <MDBox pt={1} pb={1} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          select
          size="small"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {Array.isArray(accountList) &&
            accountList.map((row) => (
              <option key={row.account_id} value={row.account_id}>
                {row.account_name}
              </option>
            ))}
        </TextField>
        <Select value={year} onChange={(e) => setYear(e.target.value)} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>{y}년</MenuItem>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} size="small">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>{m}월</MenuItem>
          ))}
        </Select>
        <MDButton variant="gradient" color="info" onClick={handleModalOpen2}>
          거래처 등록
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleModalOpen}>
          거래처 연결
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 현재월 테이블 */}
      <MDBox pt={3} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">집계표</MDTypography>
              </MDBox>
              {renderTable(table, originalRows, handleCellChange, dataRows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* 거래처 연결 모달 */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <MDBox sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "80%", bgcolor: "background.paper", p: 3, overflow: "auto" }}>
          <Typography variant="h6" gutterBottom>거래처 연결 관리</Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", height: "calc(100% - 60px)" }}>
            <YourSelectableTable data={leftItems} selected={selectedLeft} setSelected={setSelectedLeft} />
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
              <Button variant="contained" onClick={moveRight}>▶</Button>
              <Button variant="contained" onClick={moveLeft}>◀</Button>
            </Box>
            <YourSelectableTable data={rightItems} selected={selectedRight} setSelected={setSelectedRight} />
          </Box>
          <Box sx={{ textAlign: "right", mt: 2 }}>
            <Button variant="contained" color="primary" onClick={handleSubmit}>저장</Button>
          </Box>
        </MDBox>
      </Modal>

      {/* 거래처 등록 모달 */}
      <Modal open={open2} onClose={handleModalClose2}>
        <MDBox sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, bgcolor: "background.paper", p: 4 }}>
          <Typography variant="h6" gutterBottom>거래처 등록</Typography>
          <TextField fullWidth margin="normal" name="name" label="이름" value={formData.name} onChange={handleChange2} />
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button variant="contained" color="primary" onClick={handleSubmit2}>저장</Button>
          </Box>
        </MDBox>
      </Modal>
    </DashboardLayout>
  );
}

export default AccountManagermentTable;
