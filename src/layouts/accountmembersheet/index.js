import React, { useMemo, useState, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField } from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import useAccountMembersheetData, {
  parseNumber,
  formatNumber,
} from "./data/AccountMemberSheetData";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import LoadingScreen from "../loading/loadingscreen";

function AccountMemberSheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");
  const tableContainerRef = useRef(null);

  const { activeRows, setActiveRows, accountList, saveData, fetchAccountMembersAllList } =
    useAccountMembersheetData(selectedAccountId, activeStatus);

  const [originalRows, setOriginalRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const numericCols = ["salary"];

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
  const startTimes = generateTimeOptions("5:30", "14:00", 30);
  const endTimes = generateTimeOptions("10:00", "20:00", 30);

  const positionOptions = [
    { value: "1", label: "영양사" },
    { value: "2", label: "조리팀장" },
    { value: "3", label: "조리장" },
    { value: "4", label: "조리사" },
    { value: "5", label: "조리원" },
    { value: "6", label: "유틸" },
    { value: "7", label: "통합" },
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
      { header: "퇴직정산일", accessorKey: "ret_set_dt", size: 80 },
      { header: "4대보험 상실일", accessorKey: "loss_major_insurances", size: 80 },
      { header: "퇴사여부", accessorKey: "del_yn", size: 80 },
      { header: "퇴사일", accessorKey: "del_dt", size: 80 },
      { header: "퇴사사유", accessorKey: "del_note", size: 100 },
      {
        header: "급여(월)",
        accessorKey: "salary",
        size: 80,
        cell: (info) => formatNumber(info.getValue()),
      },
      { header: "근무형태", accessorKey: "work_system", size: 100 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },
      { header: "국민연금", accessorKey: "national_pension", size: 80 },
      { header: "건강보험", accessorKey: "health_insurance", size: 80 },
      { header: "산재보험", accessorKey: "industrial_insurance", size: 80 },
      { header: "고용보험", accessorKey: "employment_insurance", size: 80 },
      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },
      { header: "본사노트", accessorKey: "headoffice_note", minWidth: 80, maxWidth: 150 },
      { header: "지원금", accessorKey: "subsidy", minWidth: 80, maxWidth: 150 },
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

  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");

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
      work_system: "",
      start_time: "",
      end_time: "",
      national_pension: "",
      health_insurance: "",
      industrial_insurance: "",
      employment_insurance: "",
      note: "",
      headoffice_note: "",
      subsidy: "",
      total: 0,
    };

    setActiveRows((prev) => [newRow, ...prev]);

    // setTimeout(() => {
    //   if (tableContainerRef.current) {
    //     tableContainerRef.current.scrollTo({
    //       top: tableContainerRef.current.scrollHeight,
    //       behavior: "smooth",
    //     });
    //   }
    // }, 0);

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
    const selectFields = new Set([
      "position_type",
      "del_yn",
      "contract_type",
      "start_time",
      "end_time",
      "account_id",
    ]);
    const nonEditableCols = new Set(["diner_date", "total"]);

    return (
      <MDBox
        ref={tableContainerRef}
        pt={0}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          "& table": {
            width: "max-content",
            minWidth: "100%",
            borderSpacing: 0,
            borderCollapse: "separate",
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
            z59: 3,
          },
          "& td:nth-of-type(5), & th:nth-of-type(5)": {
            position: "sticky",
            left: "420px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(6), & th:nth-of-type(6)": {
            position: "sticky",
            left: "570px",
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
          // select / date 등 폼 컨트롤 스타일(간단)
          "& select": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
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
                    const updatedRows = rows.map((r, idx) =>
                      idx === rowIndex
                        ? {
                            ...r,
                            [colKey]: newValue,
                            total: calculateTotal({ ...r, [colKey]: newValue }),
                          }
                        : r
                    );
                    setActiveRows(updatedRows);
                  };

                  return (
                    <td
                      key={cell.id}
                      style={{
                        textAlign: [
                          "rrn",
                          "account_number",
                          "phone",
                          "name",
                          "contract_type",
                          "join_dt",
                          "act_join_dt",
                          "ret_set_dt",
                          "loss_major_insurances",
                          "del_yn",
                          "del_dt",
                          "work_system",
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
                          {colKey === "start_time" &&
                            startTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          {colKey === "end_time" &&
                            endTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
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

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* 🔹 공통 헤더 사용 */}
      <HeaderWithLogout showMenuButton title="🧑‍🍳 현장 직원관리" />
      <MDBox pt={1} pb={1} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
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
            <Card
              sx={{
                height: "calc(98vh - 160px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* <MDBox
                mx={0}
                mt={-3}
                py={1}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <MDTypography variant="h6" color="white">
                  현장 직원관리
                </MDTypography>
              </MDBox> */}

              {renderTable(table, activeRows, originalRows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default AccountMemberSheet;
