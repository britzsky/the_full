/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import { Box, TextField, useTheme, useMediaQuery } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import usePersonCostBudgetData, { formatNumber } from "./personCostBudgetData";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// 인건비 예산 관리 탭
// - 매출 대비 기존 인건비 비율이 45% 이상인 업장을 조회한다.
// - 당월 인건비는 일반 직원 급여와 유틸·통합 배부액을 합산한 신규 API 계산값을 사용한다.
// - 금일 기준 인건비는 당월 인건비와 같은 방식으로 "오늘까지"만 일할 계산한 값이며,
//   출근부(초과/결근/파출·직원파출/유틸) 상세 내역을 괄호로 함께 보여준다. (근무체계별 세부 계산은 후속 작업)
// - 당월 예상 인건비는 후속 급여체계 계산을 위한 컬럼으로 유지한다.
export default function PersonCostBudgetTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { personCostRows, loading, fetchPersonCostBudgetList } = usePersonCostBudgetData(year, month);

  useEffect(() => {
    fetchPersonCostBudgetList();
  }, [year, month, fetchPersonCostBudgetList]);

  const handleYearChange = (e) => setYear(Number(e.target.value));
  const handleMonthChange = (e) => setMonth(Number(e.target.value));

  // 매출 반영 시차에 맞춰 조회 월보다 2개월 전의 헤더 월을 계산한다.
  const getPrevYm = (y, m, back) => {
    const total = y * 12 + (m - 1) - back;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
  };
  const salesYm = getPrevYm(year, month, 2);

  const columns = [
    { key: "no", label: "순번", width: 50 },
    { key: "account_name", label: "업장", width: 200 },
    { key: "sales_total", label: `${salesYm.month}월 매출액`, width: 130 }, // 매출은 2개월 전(base_month) 실적으로 대체
    { key: "budget_45", label: `${salesYm.month}월 매출 기준 인건비 예산(45%)`, width: 170 }, // 매출액 * 45% (인건비 예산 상한선)
    { key: "current_month_person_cost", label: "당월 인건비", width: 130 },
    { key: "today_person_cost", label: "금일 기준 인건비", width: 260 },
    { key: "estimated_month_person_cost", label: "당월 예상 인건비", width: 140 },
    { key: "note", label: "비고", width: 200 },
  ];

  const numericFields = [
    "sales_total",
    "budget_45",
    "current_month_person_cost",
    "today_person_cost",
    "estimated_month_person_cost",
  ];
  // 매출 기준 인건비 예산은 화면과 엑셀에서 같은 계산식을 사용한다.
  const getBudget45 = (row) => (Number(row.sales_total) || 0) * 0.45;
  const getComputedValue = (row, field) => {
    if (field === "budget_45") return getBudget45(row);
    return row[field];
  };
  // 2개월 전 매출액 대비 인건비 비율(%) - 화면 표시 전용. field로 당월/금일 인건비 둘 다 계산
  const getPersonCostRatio = (row, field = "current_month_person_cost") => {
    const sales = Number(row.sales_total) || 0;
    const cost = Number(row[field]) || 0;
    if (sales <= 0) return null;
    return Math.round((cost / sales) * 100);
  };
  // 비율 구간별 경고 색상: 45% 이상 빨강, 40% 이상 노랑
  const getPersonCostColor = (ratio) => {
    if (ratio == null) return undefined;
    if (ratio >= 45) return "#d32f2f";
    if (ratio >= 40) return "#f9a825";
    return undefined;
  };

  // 금일 기준 인건비 괄호 안 상세 내역: 초과(시간) / 결근(횟수) / 파출·직원파출(금액) / 유틸(횟수)
  // - 값이 0인 항목은 굳이 표시하지 않는다 (해당 없는 업장에서 괄호가 계속 떠 있으면 오히려 지저분함)
  const getTodayPersonCostDetail = (row) => {
    const overtimeHours = Number(row.overtime_hours) || 0;
    const absenceCount = Number(row.absence_count) || 0;
    const dispatchTotal = Number(row.dispatch_total_amount) || 0;
    const employeeDispatch = Number(row.employee_dispatch_amount) || 0;
    const utilCount = Number(row.util_count) || 0;

    const parts = [];
    if (overtimeHours > 0) parts.push(`초과: ${overtimeHours}시간`);
    if (absenceCount > 0) parts.push(`결근: ${absenceCount}회`);
    if (dispatchTotal > 0)
      parts.push(`파출(직원파출):${formatNumber(dispatchTotal)}(${formatNumber(employeeDispatch)})원`);
    if (utilCount > 0) parts.push(`유틸: ${utilCount}회`);

    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  };

  const salesTotal = personCostRows.reduce((sum, row) => sum + (Number(row.sales_total) || 0), 0);
  // 업장별 일반 직원 급여와 유틸·통합 배부액을 합산한 당월 인건비 합계
  const currentMonthPersonCostTotal = personCostRows.reduce(
    (sum, row) => sum + (Number(row.current_month_person_cost) || 0),
    0
  );
  const handleExcelDownload = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("인건비예산");

      ws.columns = columns.map((col) => ({
        header: col.label,
        key: col.key,
        width: col.excelWidth ?? Math.round(col.width / 7),
      }));

      // 헤더 스타일
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 20;
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
      });

      personCostRows.forEach((row, rowIdx) => {
        const rowData = {};
        columns.forEach((col) => {
          if (col.key === "no") {
            rowData[col.key] = rowIdx + 1;
          } else if (numericFields.includes(col.key)) {
            const v = getComputedValue(row, col.key);
            rowData[col.key] = v != null ? Number(v) : "";
          } else {
            rowData[col.key] = row[col.key] ?? "";
          }
        });
        const excelRow = ws.addRow(rowData);
        excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const col = columns[colNum - 1];
          if (!col) return;
          cell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
          if (numericFields.includes(col.key)) {
            cell.alignment = { horizontal: "right" };
            cell.numFmt = "#,##0";
          } else {
            cell.alignment = { horizontal: "center" };
          }
        });
      });

      // 현재 화면에 조회된 업장의 매출·예산·당월 인건비 합계
      {
        const totalRow = {
          account_name: "합계",
          sales_total: salesTotal,
          budget_45: salesTotal * 0.45,
          current_month_person_cost: currentMonthPersonCostTotal,
          today_person_cost: "",
          estimated_month_person_cost: "",
          note: "",
        };
        const excelRow = ws.addRow(totalRow);
        excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const col = columns[colNum - 1];
          if (!col) return;
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
          cell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
          if (numericFields.includes(col.key)) {
            cell.alignment = { horizontal: "right" };
            cell.numFmt = "#,##0";
          } else {
            cell.alignment = { horizontal: "center" };
          }
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `인건비예산관리_${year}년_${month}월.xlsx`);
    } catch (e) {
      console.error(e);
      Swal.fire("실패", "엑셀 생성 중 오류가 발생했습니다.", "error");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 */}
      <MDBox
        pt={0}
        pb={1}
        px={0}
        sx={{
          flexShrink: 0, // 🔹 필터바는 항상 제 높이만큼만 차지
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "nowrap",
          gap: 2,
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <MDBox
          component="span"
          sx={{ fontSize: 12, fontWeight: "bold", color: "#555" }}
        >
          {/* 📌 매출 대비 인건비 45% 이상 업장만 조회됩니다. (당월 실적이 없으면 2개월 전 실적 기준) */}
        </MDBox>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            select
            size="small"
            value={year}
            onChange={handleYearChange}
            sx={{ minWidth: isMobile ? 90 : 100 }}
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
            sx={{ minWidth: isMobile ? 80 : 85 }}
            SelectProps={{ native: true }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </TextField>

          <MDButton
            variant="contained"
            color="success"
            size="small"
            onClick={handleExcelDownload}
          >
            엑셀 다운로드
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            onClick={() => fetchPersonCostBudgetList()}
          >
            새로고침
          </MDButton>
        </Box>
      </MDBox>

      {/* 메인 테이블 */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
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
        }}
      >
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
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
            {personCostRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: "16px", color: "#999" }}>
                  매출 대비 인건비 45% 이상인 업장이 없습니다.
                </td>
              </tr>
            ) : (
              personCostRows.map((row, rowIdx) => (
                <tr key={row.account_id ?? rowIdx}>
                  {columns.map((col) => {
                    const field = col.key;

                    // 🔹 순번(no)은 실데이터가 아니라 화면 표시용 인덱스
                    if (field === "no") {
                      return (
                        <td
                          key={field}
                          style={{
                            width: col.width,
                            minWidth: col.width,
                            maxWidth: col.width,
                            textAlign: "center",
                          }}
                        >
                          {rowIdx + 1}
                        </td>
                      );
                    }

                    const value = getComputedValue(row, field);
                    const isNumeric = numericFields.includes(field);

                    const ratio =
                      field === "current_month_person_cost" || field === "today_person_cost"
                        ? getPersonCostRatio(row, field)
                        : null;
                    const ratioColor = getPersonCostColor(ratio);

                    // 🔹 금일 기준 인건비 셀은 숫자 아래에 초과/결근/파출/유틸 상세를 줄바꿈으로 덧붙인다
                    const todayDetail = field === "today_person_cost" ? getTodayPersonCostDetail(row) : "";

                    return (
                      <td
                        key={field}
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                          textAlign: isNumeric ? "right" : field === "account_name" ? "left" : "center",
                          whiteSpace: todayDetail ? "normal" : undefined,
                          ...(ratioColor && { color: ratioColor, fontWeight: "bold" }),
                        }}
                      >
                        {value == null
                          ? ""
                          : isNumeric
                          ? ratio != null
                            ? `${formatNumber(Math.round(value))}(${ratio}%)`
                            : formatNumber(Math.round(value))
                          : value}
                        {todayDetail && (
                          <>
                            <br />
                            <span style={{ fontSize: "10px", color: "#777", fontWeight: "normal" }}>
                              {todayDetail}
                            </span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {/* 현재 목록에 조회된 업장 전체 합계 */}
            {personCostRows.length > 0 && (
              <tr style={{ backgroundColor: "#eef1f5", fontWeight: "bold" }}>
                <td colSpan={2}>합계</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(salesTotal))}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(salesTotal * 0.45))}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(currentMonthPersonCostTotal))}</td>
                <td />
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </Box>
    </>
  );
}
