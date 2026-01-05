import React, { useMemo, useState, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery } from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";
import useAccountDispatchMembersheetData, {
  parseNumber,
  formatNumber,
} from "./accountDispatchMemberSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";

function AccountDispatchMemberSheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");

  // ✅ 년/월 추가 (기본값: 현재 년/월)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));

  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    fetchAccountMembersAllList,
  } = useAccountDispatchMembersheetData(selectedAccountId, activeStatus, selectedYear, selectedMonth);

  const [loading, setLoading] = useState(true);

  const numericCols = ["salary"];

  // ✅ 조회: account / 재직여부 / 년도 / 월 변경 시 즉시 재조회
  useEffect(() => {
    setLoading(true);
    fetchAccountMembersAllList().then(() => {
      setLoading(false);
    });
  }, [selectedAccountId, activeStatus, selectedYear, selectedMonth]);

  // (기존 코드 유지) - 현재 시트에선 breakfast/lunch/dinner 등이 없어도 0 처리됨
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

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

  const columns = useMemo(() => [
    { header: "성명", accessorKey: "name", size: 50, meta: { align: "left" } },
    { header: "주민번호", accessorKey: "rrn", size: 100, meta: { align: "center" } },
    { header: "업장명", accessorKey: "account_id", size: 120, meta: { align: "left" } },
    { header: "계좌번호", accessorKey: "account_number", size: 120, meta: { align: "center" } },
    { header: "근무횟수", accessorKey: "cnt", size: 50, meta: { align: "right" } },
    { header: "총 금액", accessorKey: "salary", size: 50, meta: { align: "right" } },
    { header: "퇴사여부", accessorKey: "del_yn", size: 50, meta: { align: "center" } },
    { header: "퇴사일", accessorKey: "del_dt", size: 80, meta: { align: "center" } },
    { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150, meta: { align: "left" } },
  ], []);

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

      const changedRowsWithUser = changedRows.map((row) => ({
        ...cleanRow(row),
        user_id: userId,
      }));

      const res = await api.post("/Operate/AccountDispatchMembersSave", {
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

  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");

    const newRow = {
      name: "",
      rrn: "",
      account_id: defaultAccountId,
      account_number: "",
      del_yn: activeStatus,
      del_dt: "",
      note: "",
    };

    setActiveRows((prev) => [newRow, ...prev]);
    setOriginalRows((prev) => [newRow, ...prev]);
  };

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

  const renderTable = (tableInst, rows, originals) => {
    const dateFields = new Set(["del_dt"]);
    // ✅ del_yn도 select로 처리되도록 추가
    const selectFields = new Set(["account_id", "del_yn"]);
    const nonEditableCols = new Set(["cnt", "salary"]);

    const delOptions = [
      { value: "N", label: "재직" },
      { value: "Y", label: "퇴사" },
    ];

    return (
      <MDBox
        ref={tableContainerRef}
        pt={0}
        sx={{
          flex: 1,
          minHeight: 0,
          maxHeight: isMobile ? "55vh" : "70vh",
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
            left: "85px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(3), & th:nth-of-type(3)": {
            position: "sticky",
            left: "185px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "300px",
            background: "#f0f0f0",
            zIndex: 3, // ✅ z59 오타 수정
          },
          "& td:nth-of-type(5), & th:nth-of-type(5)": {
            position: "sticky",
            left: "470px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(6), & th:nth-of-type(6)": {
            position: "sticky",
            left: "550px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:nth-of-type(-n+6)": { zIndex: 5 },
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
                  const normCurrent = isNumeric ? Number(currentValue ?? 0) : String(currentValue ?? "");
                  const normOriginal = isNumeric ? Number(originalValue ?? 0) : String(originalValue ?? "");
                  const isChanged = normCurrent !== normOriginal;

                  const isEditable = !nonEditableCols.has(colKey);
                  const isSelect = selectFields.has(colKey);
                  const isDate = dateFields.has(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = rows.map((r, idx) =>
                      idx === rowIndex
                        ? { ...r, [colKey]: newValue, total: calculateTotal({ ...r, [colKey]: newValue }) }
                        : r
                    );
                    setActiveRows(updatedRows);
                  };

                  return (
                    <td
                      key={cell.id}
                      style={{
                        textAlign:
                          ["rrn", "account_number", "del_yn", "del_dt"].includes(colKey)
                            ? "center"
                            : colKey === "salary" || colKey === "cnt"
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

                              if (isNumeric) e.currentTarget.innerText = formatNumber(newValue);
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

                          {colKey === "del_yn" &&
                            delOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
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

  // ✅ 년/월 옵션 생성
  const yearOptions = (() => {
    const y = now.getFullYear();
    const years = [];
    for (let i = y - 3; i <= y + 1; i += 1) years.push(String(i));
    return years;
  })();

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1));

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 버튼 */}
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

        {/* ✅ 거래처 뒤에 년도/월 select 추가 */}
        <TextField
          select
          size="small"
          value={selectedYear}
          onChange={(e) => {
            setLoading(true);
            setSelectedYear(e.target.value);
          }}
          sx={{ minWidth: 120 }}
          SelectProps={{ native: true }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={selectedMonth}
          onChange={(e) => {
            setLoading(true);
            setSelectedMonth(e.target.value);
          }}
          sx={{ minWidth: 100 }}
          SelectProps={{ native: true }}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>

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
    </>
  );
}

export default AccountDispatchMemberSheet;
