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

// 🔹 인건비 예산 관리 탭 (OperateTabs_6 에서 사용)
// - 매출 대비 인건비 45% 이상인 업장만 조회 (당월 실적이 없으면 2개월 전 실적으로 대체, 백엔드 PersonCostBudgetList 처리)
// - 컬럼 헤더는 조회월(화면에서 고른 연/월) 기준으로 "N월 인건비(비율)"처럼 표시
// - 각 셀 안의 실제 값/월은 그 행 자신의 base_year/base_month(대체 로직) 기준으로 계산해서 보여준다 (getMonthInfo)
// - 맨 아래 "합계" 행에는 전체 업장 3개월 합계·비율을 같은 컬럼 구성으로 표시
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

  // ✅ 컬럼 헤더 라벨용: 조회월(화면에서 고른 연/월) 기준 이번월/전월/전전월
  const getPrevYm = (y, m, back) => {
    const total = y * 12 + (m - 1) - back;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
  };
  const thisYm = { year, month };
  const lastYm = getPrevYm(year, month, 1);
  const last2Ym = getPrevYm(year, month, 2);

  // ✅ 어떤 달이든 person_total/sales_total만 있으면 비율 계산 (없으면 null)
  const getRatio = (person, sales) =>
    person == null || sales == null || Number(sales) === 0 ? null : (Number(person) / Number(sales)) * 100;

  // ✅ offset: 0=이번월(그 행의 base_month), 1=전월, 2=전전월 → { month, person, ratio } 반환
  //    (셀 안의 실제 값/월은 그 행 자신의 base_year/base_month 대체 로직을 그대로 따른다)
  const getMonthInfo = (row, offset) => {
    const by = Number(row.base_year) || year;
    const bm = Number(row.base_month) || month;
    const ym = offset === 0 ? { year: by, month: bm } : getPrevYm(by, bm, offset);
    const person = offset === 0 ? row.person_total : offset === 1 ? row.prev_month_person_total : row.prev_prev_month_person_total;
    const sales = offset === 0 ? row.sales_total : offset === 1 ? row.prev_month_sales_total : row.prev_prev_month_sales_total;
    return { month: ym.month, person: person != null ? Number(person) : null, ratio: getRatio(person, sales) };
  };

  const columns = [
    { key: "no", label: "순번", width: 50 },
    { key: "account_name", label: "업장", width: 200 },
    { key: "sales_total", label: "매출액", width: 130 },
    { key: "budget_45", label: "인건비 예산(45%)", width: 130 }, // 매출액 * 45% (인건비 예산 상한선)
    { key: "over_amount", label: "초과금액", width: 130 }, // 인건비 - 예산(45%). 이번월 인건비 금액 자체는 "이번월" 컬럼에서 확인
    { key: "prev_prev_ratio", label: `${last2Ym.month}월 인건비(비율)`, width: 190, monthOffset: 2 },
    { key: "prev_ratio", label: `${lastYm.month}월 인건비(비율)`, width: 190, monthOffset: 1 },
    { key: "person_ratio", label: `${thisYm.month}월 인건비(비율)`, width: 190, monthOffset: 0 },
  ];

  const numericFields = ["sales_total", "budget_45", "over_amount"];
  const monthCellFields = ["prev_prev_ratio", "prev_ratio", "person_ratio"]; // 월+금액+비율을 한 셀에 표시

  // ✅ 예산(45%)/초과금액은 실데이터가 아니라 매출액 기준 계산값
  const getBudget45 = (row) => (Number(row.sales_total) || 0) * 0.45;
  const getOverAmount = (row) => (Number(row.person_total) || 0) - getBudget45(row);
  const getComputedValue = (row, field) => {
    if (field === "budget_45") return getBudget45(row);
    if (field === "over_amount") return getOverAmount(row);
    return row[field];
  };

  // ✅ 맨 아래 합계 행: 필터된 업장들의 전전월/전월/이번월 인건비·매출·비율 합계
  //    (업장마다 기준월이 다를 수 있어 합계 행엔 특정 월을 표시하지 않고 금액·비율만 보여준다)
  const summaryMonths = [
    { personKey: "prev_prev_month_person_total", salesKey: "prev_prev_month_sales_total" },
    { personKey: "prev_month_person_total", salesKey: "prev_month_sales_total" },
    { personKey: "person_total", salesKey: "sales_total" },
  ];
  const summaryTotals = summaryMonths.map(({ personKey, salesKey }) => {
    const person = personCostRows.reduce((sum, row) => sum + (Number(row[personKey]) || 0), 0);
    const sales = personCostRows.reduce((sum, row) => sum + (Number(row[salesKey]) || 0), 0);
    const ratio = sales > 0 ? (person / sales) * 100 : 0;
    return { person, sales, ratio };
  });

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
          } else if (monthCellFields.includes(col.key)) {
            const info = getMonthInfo(row, col.monthOffset);
            rowData[col.key] =
              info.ratio == null ? "-" : `${info.month}월 기준 ${formatNumber(info.person)}(${info.ratio.toFixed(1)}%)`;
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
          } else if (monthCellFields.includes(col.key)) {
            cell.alignment = { horizontal: "right" }; // 텍스트("N월 기준 금액(비율%)")라 numFmt는 안 먹임
          } else {
            cell.alignment = { horizontal: "center" };
          }
          // 인건비 비율 폰트색(3개월 컬럼 전부): >=60 빨강, >=45 주황
          if (monthCellFields.includes(col.key)) {
            const num = getMonthInfo(row, col.monthOffset).ratio;
            if (num != null && num >= 60) {
              cell.font = { bold: true, color: { argb: "FFF44336" } };
            } else if (num != null && num >= 45) {
              cell.font = { bold: true, color: { argb: "FFFF9800" } };
            }
          }
          // 초과금액: 0보다 크면(예산 초과) 빨강 강조
          if (col.key === "over_amount") {
            const over = getOverAmount(row);
            if (over > 0) {
              cell.font = { bold: true, color: { argb: "FFF44336" } };
            }
          }
        });
      });

      // 🔹 합계 행 (조회월/조회월-1/조회월-2 기준 3개월 합계, 월 표시는 헤더에 이미 있어 금액·비율만)
      {
        const totalRow = {
          account_name: "합계",
          sales_total: summaryTotals[2].sales,
          budget_45: summaryTotals[2].sales * 0.45,
          over_amount: summaryTotals[2].person - summaryTotals[2].sales * 0.45,
          prev_prev_ratio: `${formatNumber(Math.round(summaryTotals[0].person))}(${summaryTotals[0].ratio.toFixed(1)}%)`,
          prev_ratio: `${formatNumber(Math.round(summaryTotals[1].person))}(${summaryTotals[1].ratio.toFixed(1)}%)`,
          person_ratio: `${formatNumber(Math.round(summaryTotals[2].person))}(${summaryTotals[2].ratio.toFixed(1)}%)`,
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
          } else if (monthCellFields.includes(col.key)) {
            cell.alignment = { horizontal: "right" }; // 텍스트("N월 기준 금액(비율%)")라 numFmt는 안 먹임
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

                    // 🔹 전전월/전월/이번월: 조회월 기준 고정 달력월로 "N월 금액(비율%)" 표시 (그 달 실적 없으면 "-")
                    if (monthCellFields.includes(field)) {
                      const info = getMonthInfo(row, col.monthOffset);
                      const ratioColor =
                        info.ratio != null && info.ratio >= 45 ? (info.ratio >= 60 ? "#f44336" : "#ff9800") : undefined;
                      return (
                        <td
                          key={field}
                          style={{
                            width: col.width,
                            minWidth: col.width,
                            maxWidth: col.width,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {info.ratio == null ? (
                            "-"
                          ) : (
                            <>
                              <span style={{ color: "#888", fontSize: "11px" }}>{info.month}월 기준</span>{" "}
                              {formatNumber(info.person)}
                              <span style={{ color: ratioColor, fontWeight: ratioColor ? 800 : undefined }}>
                                ({info.ratio.toFixed(1)}%)
                              </span>
                            </>
                          )}
                        </td>
                      );
                    }

                    const value = getComputedValue(row, field);
                    const isNumeric = numericFields.includes(field);
                    const isOverAmount = field === "over_amount";

                    const ratioColor = isOverAmount && Number(value) > 0 ? "#f44336" : undefined;

                    return (
                      <td
                        key={field}
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                          textAlign: isNumeric ? "right" : field === "account_name" ? "left" : "center",
                          color: ratioColor,
                          fontWeight: ratioColor ? 800 : undefined,
                        }}
                      >
                        {value == null ? "" : isNumeric ? formatNumber(Math.round(value)) : value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {/* 🔹 합계 행: 지금 목록에 뜬 업장 전체의 3개월 합계 (위쪽 개별 행과 같은 컬럼 구성으로 바로 비교) */}
            {personCostRows.length > 0 && (
              <tr style={{ backgroundColor: "#eef1f5", fontWeight: "bold" }}>
                <td colSpan={2}>합계</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(summaryTotals[2].sales))}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(summaryTotals[2].sales * 0.45))}</td>
                <td style={{ textAlign: "right" }}>
                  {formatNumber(Math.round(summaryTotals[2].person - summaryTotals[2].sales * 0.45))}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {formatNumber(Math.round(summaryTotals[0].person))} ({summaryTotals[0].ratio.toFixed(1)}%)
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {formatNumber(Math.round(summaryTotals[1].person))} ({summaryTotals[1].ratio.toFixed(1)}%)
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {formatNumber(Math.round(summaryTotals[2].person))} ({summaryTotals[2].ratio.toFixed(1)}%)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>
    </>
  );
}
