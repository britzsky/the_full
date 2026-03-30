/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import { Box, Grid, Select, MenuItem, Card, TextField, useTheme, useMediaQuery } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDButton from "components/MDButton";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import LoadingScreen from "layouts/loading/loadingscreen";
import useBudgetTableData, { formatNumber } from "./data/BudgetTableData";
import Swal from "sweetalert2";
import api from "api/api";
import { sortAccountRows } from "utils/accountSort";

export default function BudgetTableTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // ✅ 조회된 값 + 변경 감지 버전
  const [editRows, setEditRows] = useState([]);
  // ✅ 숫자 입력 중에는 raw 문자열을 유지해서 커서 점프 방지
  const [budgetGrantDrafts, setBudgetGrantDrafts] = useState({});
  // ✅ 거래처 검색 없는 표 화면용 정렬 기준(기본: 거래처명)
  const [accountSortKey, setAccountSortKey] = useState("account_name");

  // ✅ 예산 테이블 데이터 훅 (연/월 기준 전체 조회)
  const {
    budgetTableRows,
    loading,
    fetchBudgetTableList,
    budgetStandardList,
    mealsNumberList,
  } = useBudgetTableData(year, month);

  // ✅ 데이터 조회 트리거 (연/월 변경 시마다)
  useEffect(() => {
    fetchBudgetTableList();
  }, [year, month, fetchBudgetTableList]);

  // ✅ 데이터 원본 저장
  useEffect(() => {
    if (budgetTableRows && budgetTableRows.length > 0) {
      const cloned = budgetTableRows.map((row, idx) => ({
        ...row,
        // ✅ 정렬/편집 시에도 행 식별이 안정적이도록 고유 키 부여
        _rowKey: `${row.account_id ?? ""}_${row.month ?? ""}_${row.account_type_name ?? ""}_${row.meal_type_name ?? ""}_${idx}`,
        _original: { ...row },
      }));
      setEditRows(cloned);
    } else {
      setEditRows([]);
    }
  }, [budgetTableRows]);

  // ✅ 화면 표시 순서만 정렬(저장 로직은 기존 editRows 기준 유지)
  const sortedEditRows = sortAccountRows(editRows, {
    sortKey: accountSortKey,
    keepAllOnTop: true,
  });

  // ✅ 직접 입력 가능한 항목만 지정
  const editableFields = ["budget_grant", "note"];

  // ✅ 숫자 필드 목록 (콤마 포맷 대상)
  const numericFields = [
    "total",
    "diet_price",
    "utility_bills",
    "food_budget",
    "budget_total",
    "day_budget",
    "day_use_amount",
    "use_ratio",
    "day_use_ratio",
    "existing_budget",
    "diff_amount",
    "budget_grant",
  ];

  // ✅ % 표시할 필드
  const percentFields = ["use_ratio", "day_use_ratio"];

  // ✅ 테이블 컬럼 정의
  const columns = [
    { key: "month", label: "월", width: 50 },
    { key: "account_type_name", label: "구분", width: 60 },
    { key: "meal_type_name", label: "예산기준", width: 90 },
    { key: "account_name", label: "거래처명", width: 135 },
    // { key: "total",             label: "식수",              width: 50  },
    // { key: "diet_price",        label: "식비",              width: 80 },
    // { key: "utility_bills",     label: "수도광열비",        width: 90 },
    { key: "food_budget", label: "1식 기준 식재비", width: 90 },
    { key: "budget_total", label: "예상 부여금액", width: 120 },
    { key: "day_budget", label: "현기준 적정예산", width: 90 },
    { key: "day_use_amount", label: "현기준 사용금액", width: 90 },
    { key: "day_use_ratio", label: "현기준 적정금액 비율(%)", width: 115 },
    // { key: "existing_budget",   label: "기존예산",        width: 90 },
    { key: "diff_amount", label: "차액", width: 90 },
    { key: "use_ratio", label: "총 예산대비 사용비율(%)", width: 115 },
    { key: "budget_grant", label: "예산부여", width: 90 }, // editable
    { key: "note", label: "비고", width: 185 }, // editable
  ];

  // ✅ 저장 (예산부여, 비고만 변경 체크)
  const handleSave = async () => {
    const modifiedRows = editRows
      .map((row) => {
        if (!row._original) return null;

        const changedFields = {};

        editableFields.forEach((field) => {
          const isNumeric = numericFields.includes(field);

          const original = row._original[field];
          const current = row[field];

          const originalNorm = isNumeric
            ? Number(original ?? 0)
            : (original ?? "");
          const currentNorm = isNumeric
            ? Number(current ?? 0)
            : (current ?? "");

          if (originalNorm !== currentNorm) {
            changedFields[field] = row[field];
          }
        });

        // ✅ 계산용 상태값(status_yn)
        // - 예산부여(budget_grant) 값이 원본과 다르면 "Y"
        // - 예산부여가 같으면 "N"
        const originalBudgetGrantNorm = Number(row._original.budget_grant ?? 0);
        const currentBudgetGrantNorm = Number(row.budget_grant ?? 0);
        const budgetGrantChanged = originalBudgetGrantNorm !== currentBudgetGrantNorm;

        if (Object.keys(changedFields).length > 0) {
          return {
            account_id: row.account_id,
            year,
            month: row.month, // DB에서 가져온 month 사용
            ...changedFields,
            // ✅ "status_yn"로 분기할 수 있도록 전달
            //    - budget_grant 변경 있음: "Y"
            //    - note만 변경/미변경: "N"
            status_yn: budgetGrantChanged ? "Y" : "N",
          };
        }
        return null;
      })
      .filter((row) => row !== null);

    console.log("✅ 저장할 변경값만:", modifiedRows);

    if (modifiedRows.length === 0) {
      Swal.fire("변경된 내용이 없습니다.", "", "info");
      return;
    }

    try {
      // 👉 백엔드 경로는 실제 구현에 맞게 수정
      await api.post("/Operate/BudgetTableSave", { rows: modifiedRows });
      Swal.fire("변경 사항이 저장되었습니다.", "", "success");
      fetchBudgetTableList(); // ✅ 다시 조회
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  const getDraftKey = (rowKey, field) => `${rowKey}__${field}`;

  // ✅ 입력 핸들러 (budget_grant: 숫자, note: 문자열)
  const handleInputChange = (rowKey, field, value) => {
    const newRows = [...editRows];
    const targetIdx = newRows.findIndex((row) => row._rowKey === rowKey);
    if (targetIdx < 0) return;

    if (field === "budget_grant") {
      const numericValue =
        value === "" || value === null
          ? null
          : Number(String(value).replace(/,/g, ""));
      newRows[targetIdx][field] = Number.isNaN(numericValue) ? null : numericValue;
    } else {
      // note 등 문자열
      newRows[targetIdx][field] = value;
    }

    setEditRows(newRows);
  };

  const handleBudgetGrantFocus = (rowKey, value) => {
    const draftKey = getDraftKey(rowKey, "budget_grant");
    setBudgetGrantDrafts((prev) => ({
      ...prev,
      [draftKey]: value == null ? "" : String(value),
    }));
  };

  const handleBudgetGrantChange = (rowKey, value) => {
    const draftKey = getDraftKey(rowKey, "budget_grant");
    setBudgetGrantDrafts((prev) => ({
      ...prev,
      [draftKey]: value,
    }));
    handleInputChange(rowKey, "budget_grant", value);
  };

  const handleBudgetGrantBlur = (rowKey) => {
    const draftKey = getDraftKey(rowKey, "budget_grant");
    setBudgetGrantDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, draftKey)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const handleYearChange = (e) => setYear(Number(e.target.value));
  const handleMonthChange = (e) => setMonth(Number(e.target.value));

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* 🔹 공통 헤더 사용 */}
      {/* <HeaderWithLogout showMenuButton title="📑 예산관리" /> */}
      <DashboardNavbar title="📑 예산관리" />
      <Grid container spacing={6}>
        {/* 거래처 테이블 */}
        <Grid item xs={12}>
          <Card>
            {/* 상단 필터 + 저장 버튼 */}
            <MDBox
              pt={1}
              pb={1}
              px={2}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "nowrap",     // 🔹 한 줄 유지
                gap: 2,
                overflowX: "auto",      // 🔹 내용 많으면 가로 스크롤
                whiteSpace: "nowrap",   // 🔹 텍스트 줄바꿈 방지
              }}
            >
              {/* 🔹 왼쪽: 예산기준 / 식수기준 정보 (한 줄로) */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row", // 🔹 가로 한 줄
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {/* 예산 기준 그룹 */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <MDBox
                    component="span"
                    sx={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: "#555",
                      minWidth: "70px",
                    }}
                  >
                    예산기준
                  </MDBox>

                  {budgetStandardList.length > 0 ? (
                    budgetStandardList.map((item) => (
                      <Box
                        key={item.meal_type}
                        sx={{
                          borderRadius: "16px",
                          border: "1px solid #e0e0e0",
                          px: 1,
                          py: 0.5,
                          fontSize: 11,
                          backgroundColor: "#fafafa",
                        }}
                      >
                        {item.meal_type} : {formatNumber(item.standard)}%
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ fontSize: 11, color: "#999" }}>
                      예산 기준 정보가 없습니다.
                    </Box>
                  )}
                </Box>

                {/* 식수 기준 그룹 */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    ml: 2, // 🔹 예산기준이랑 살짝 띄우기
                  }}
                >
                  <MDBox
                    component="span"
                    sx={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: "#555",
                      minWidth: "70px",
                    }}
                  >
                    식수기준
                  </MDBox>

                  {mealsNumberList.length > 0 ? (
                    mealsNumberList.map((item) => (
                      <Box
                        key={item.account_type}
                        sx={{
                          borderRadius: "16px",
                          border: "1px solid #e0e0e0",
                          px: 1,
                          py: 0.5,
                          fontSize: 11,
                          backgroundColor: "#fafafa",
                        }}
                      >
                        {item.account_type} : {formatNumber(item.meals_number)} 식
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ fontSize: 11, color: "#999" }}>
                      식수 기준 정보가 없습니다.
                    </Box>
                  )}
                </Box>
              </Box>

              {/* 🔹 오른쪽: 연 / 월 / 저장 버튼 */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  select
                  size="small"
                  value={year}
                  onChange={handleYearChange}
                  sx={{ minWidth: isMobile ? 140 : 150 }}   // ← 거래처와 동일
                  SelectProps={{ native: true }}
                >
                  {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  value={month}
                  onChange={handleMonthChange}
                  sx={{ minWidth: isMobile ? 140 : 150 }}   // ← 거래처와 동일
                  SelectProps={{ native: true }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  value={accountSortKey}
                  onChange={(e) => setAccountSortKey(String(e.target.value))}
                  sx={{ minWidth: isMobile ? 140 : 150 }}
                  SelectProps={{ native: true }}
                >
                  <option value="account_name">거래처명 정렬</option>
                  <option value="account_id">거래처ID 정렬</option>
                </TextField>

                <MDButton
                  variant="contained"
                  color="info"
                  size="small"
                  onClick={handleSave}
                >
                  저장
                </MDButton>
              </Box>
            </MDBox>
            {/* 메인 테이블 */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box
                  sx={{
                    flex: 1,
                    maxHeight: "85vh",
                    overflowY: "auto",
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
                      fontSize: "12px",
                      padding: "4px",
                      borderRight: "1px solid #686D76",
                      borderLeft: "1px solid #686D76",
                    },
                    "& th": {
                      backgroundColor: "#f0f0f0",
                      position: "sticky",
                      top: 0,
                      zIndex: 3,
                    },
                    // ✅ editable 셀 공통 스타일
                    "& td.editable-cell": {
                      padding: 0, // 셀 전체가 input 영역처럼
                    },
                    "& td.editable-cell input": {
                      width: "100%",
                      height: "100%",
                      boxSizing: "border-box",
                      border: "none",
                      outline: "none",
                      padding: "4px", // 기존 padding 느낌 유지
                      fontSize: "12px",
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  <table>
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={col.sticky ? "sticky-col sticky-header" : undefined}
                            style={{
                              width: col.width,
                              minWidth: col.width,
                              maxWidth: col.width,
                            }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEditRows.map((row, rowIdx) => (
                        <tr key={row._rowKey || `${row.account_id}_${row.month}_${rowIdx}`}>
                          {columns.map((col) => {
                            const field = col.key;
                            const baseCellStyle = {
                              width: col.width,
                              minWidth: col.width,
                              maxWidth: col.width,
                            };
                            const isEditable = editableFields.includes(field);
                            const isNumeric = numericFields.includes(field);
                            const isPercent = percentFields.includes(field);

                            const original = row._original
                              ? row._original[field]
                              : undefined;
                            const current = row[field];

                            const getRatioColor = (key, value) => {
                              if (key !== "day_use_ratio" && key !== "use_ratio") return undefined;
                              const num = Number(value);
                              if (Number.isNaN(num)) return undefined;
                              if (num >= 100) return "#f44336";
                              if (num >= 90) return "#ff9800";
                              return undefined;
                            };

                            const originalNorm = isNumeric
                              ? Number(original ?? 0)
                              : (original ?? "");
                            const currentNorm = isNumeric
                              ? Number(current ?? 0)
                              : (current ?? "");

                            const isChanged =
                              isEditable && originalNorm !== currentNorm;

                            // 표시값
                            let displayValue = "";
                            if (current !== null && current !== undefined) {
                              if (isNumeric) {
                                const n = Number(current);
                                displayValue = Number.isNaN(n)
                                  ? ""
                                  : formatNumber(n);
                              } else {
                                displayValue = String(current);
                              }
                            }

                            if (!isEditable) {
                              // 읽기 전용 셀
                              if (isNumeric) {
                                return (
                                  <td
                                    key={field}
                                    className={col.sticky ? "sticky-col" : undefined}
                                    style={{
                                      ...baseCellStyle,
                                      textAlign: "right",
                                      color: getRatioColor(field, current),
                                      fontWeight: getRatioColor(field, current) ? 800 : undefined,
                                    }}
                                  >
                                    {current == null
                                      ? ""
                                      : isPercent
                                        ? `${formatNumber(current)}%`
                                        : formatNumber(current)}
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={field}
                                  className={col.sticky ? "sticky-col" : undefined}
                                  style={{
                                    ...baseCellStyle,
                                    textAlign:
                                      field === "note" || field === "account_name"
                                        ? "left"
                                        : "center",
                                  }}
                                >
                                  {displayValue}
                                </td>
                              );
                            }

                            // ✅ editable (note)
                            if (field === "note") {
                              return (
                                <td
                                  key={field}
                                  style={{ ...baseCellStyle, textAlign: "left" }}
                                  className={`${col.sticky ? "sticky-col" : ""} editable-cell`}
                                >
                                  <input
                                    type="text"
                                    value={displayValue}
                                    style={{
                                      width: "100%",
                                      fontSize: "12px",
                                      border: "none",
                                      background: "transparent",
                                      color: isChanged ? "red" : "black",
                                    }}
                                    onChange={(e) =>
                                      handleInputChange(
                                        row._rowKey,
                                        field,
                                        e.target.value
                                      )
                                    }
                                  />
                                </td>
                              );
                            }

                            // ✅ editable (budget_grant, 숫자)
                            const draftKey = getDraftKey(row._rowKey, field);
                            const hasDraft = Object.prototype.hasOwnProperty.call(
                              budgetGrantDrafts,
                              draftKey
                            );
                            const inputValue = hasDraft
                              ? budgetGrantDrafts[draftKey]
                              : displayValue;

                            return (
                              <td
                                key={field}
                                style={{ ...baseCellStyle, textAlign: "right" }}
                                className={`${col.sticky ? "sticky-col" : ""} editable-cell`}
                              >
                                <input
                                  type="text"
                                  value={inputValue}
                                  style={{
                                    width: "80px",
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "right",
                                    border: "none",
                                    background: "transparent",
                                    color: isChanged ? "red" : "black",
                                  }}
                                  onFocus={() =>
                                    handleBudgetGrantFocus(row._rowKey, current)
                                  }
                                  onBlur={() => handleBudgetGrantBlur(row._rowKey)}
                                  onChange={(e) =>
                                    handleBudgetGrantChange(row._rowKey, e.target.value)
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}
