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
import api from "api/api";

// 인건비 예산 관리 탭
// - 매출 대비 기존 인건비 비율(전전월 매출 기준)이 45% 이상인 업장을 기본으로 조회하되,
//   비율이 45% 미만이어도 금일 기준으로 초과/결근/파출/직원파출/유틸 중 하나라도 찍혀 있으면 함께 보여준다.
// - 당월 인건비는 결근/초과/조퇴 같은 출근부 조정 없이 salary(중도입퇴사만 반영)만 합산한 값이다.
// - 금일 기준 인건비는 당월 인건비에 결근/초과/조퇴(오늘까지) + 파출비/직원파출비를 더한 값이며,
//   출근부(초과/결근/파출·직원파출/유틸) 상세 내역을 괄호로 함께 보여준다.
// - 당월 예상 인건비는 금일 기준과 같은 계산이지만 "오늘" 캡 없이 이번 달 전체 출근부(월초에 미리 입력되는 방식)
//   기준으로 계산한 값이며, 마찬가지로 상세 내역을 괄호로 보여준다.
export default function PersonCostBudgetTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { personCostRows, loading, fetchPersonCostBudgetList } = usePersonCostBudgetData(year, month);

  useEffect(() => {
    fetchPersonCostBudgetList();
    setNoteEdits({}); // 🔹 조회 월이 바뀌면 이전 달 편집 중이던 비고 임시값은 버린다
  }, [year, month, fetchPersonCostBudgetList]);

  // 🔹 비고(note) 입력창 임시 편집값. account_id별로 타이핑 중인 내용을 들고 있다가 blur 시 저장한다.
  //    (personCostRows는 조회 API 응답 그대로라 여기 없이 직접 수정하면 다음 새로고침 때 덮어써짐)
  const [noteEdits, setNoteEdits] = useState({});
  const [noteSaving, setNoteSaving] = useState({});

  const handleNoteChange = (accountId, value) => {
    setNoteEdits((prev) => ({ ...prev, [accountId]: value }));
  };

  // 🔹 포커스 아웃(blur)으로 저장하지 않고, 상단 "비고 저장" 버튼을 눌렀을 때 수정된(dirty) 비고를 한번에 저장한다.
  const hasDirtyNotes = personCostRows.some(
    (row) => noteEdits[row.account_id] !== undefined && noteEdits[row.account_id] !== (row.note ?? "")
  );
  const isNoteSavingAny = Object.values(noteSaving).some(Boolean);

  const handleNoteSaveAll = async () => {
    const dirtyRows = personCostRows.filter(
      (row) => noteEdits[row.account_id] !== undefined && noteEdits[row.account_id] !== (row.note ?? "")
    );
    if (dirtyRows.length === 0) return;

    setNoteSaving((prev) => {
      const next = { ...prev };
      dirtyRows.forEach((row) => {
        next[row.account_id] = true;
      });
      return next;
    });

    const results = await Promise.allSettled(
      dirtyRows.map((row) =>
        api
          .post("/Operate/PersonCostBudgetNoteSave", {
            account_id: row.account_id,
            year,
            month,
            note: noteEdits[row.account_id],
            user_id: localStorage.getItem("user_id") || "",
          })
          .then(() => {
            row.note = noteEdits[row.account_id]; // 성공한 건만 원본에도 반영(다음 렌더에서 dirty 해제)
          })
      )
    );

    setNoteSaving((prev) => {
      const next = { ...prev };
      dirtyRows.forEach((row) => {
        next[row.account_id] = false;
      });
      return next;
    });

    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (failedCount > 0) {
      console.error(
        "비고 저장 실패:",
        results.filter((r) => r.status === "rejected")
      );
      Swal.fire("일부 실패", `${dirtyRows.length}건 중 ${failedCount}건 저장에 실패했습니다.`, "warning");
    } else {
      Swal.fire("저장 완료", `비고 ${dirtyRows.length}건이 저장되었습니다.`, "success");
    }
  };

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
    { key: "budget_45", label: `${salesYm.month}월 매출 기준 인건비 예산(45%)`, width: 170 }, // 라벨은 그대로 45%, 값은 (매출액×1.2)×45%로 계산(인건비 확보금액과 같은 120% 반영)
    { key: "current_month_person_cost", label: "당월 인건비", width: 170 }, // 🔹 확보금액(120%) 줄이 붙어서 폭 넓힘
    { key: "today_person_cost", label: "금일 기준 인건비", width: 260 },
    { key: "estimated_month_person_cost", label: "당월 예상 인건비", width: 260 }, // 🔹 today_person_cost와 같은 상세 텍스트가 붙어서 폭도 맞춤(3줄로 줄바꿈되는 것 방지)
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
  // 🔹 (매출액 × 1.2) × 45% : 다른 인건비 확보금액(×120%)들과 같은 맥락으로, 매출도 먼저 1.2배 한 뒤 45%를 곱한다.
  //    (매출×0.45)×1.2와 수학적으로 완전히 같은 값(=매출×0.54)이지만, 코드를 이 순서로 써서 의도를 명확히 한다.
  const getBudget45 = (row) => (Number(row.sales_total) || 0) * 1.2 * 0.45;
  // 🔹 당월/금일 기준/당월 예상 인건비는 인건비 확보금액(인건비×120%, 직원 개인별로 계산해서 합산한 값)을
  //    그대로 금액으로 쓴다 (화면·엑셀·합계 전부 동일하게 이 값을 사용).
  const SECURED_FIELD_MAP = {
    current_month_person_cost: "current_month_person_cost_secured",
    today_person_cost: "today_person_cost_secured",
    estimated_month_person_cost: "estimated_month_person_cost_secured",
  };
  const getComputedValue = (row, field) => {
    if (field === "budget_45") return getBudget45(row);
    if (SECURED_FIELD_MAP[field]) return row[SECURED_FIELD_MAP[field]];
    return row[field];
  };
  // 2개월 전 매출액 대비 인건비 비율(%) - 화면 표시 전용. field로 당월/금일/당월예상 인건비 다 계산 가능
  const getPersonCostRatio = (row, field = "current_month_person_cost") => {
    const sales = Number(row.sales_total) || 0;
    const cost = Number(getComputedValue(row, field)) || 0;
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
    // 🔹 dispatch_total_amount는 파출+직원파출 "합계"라서 괄호 안 두 숫자가 같아 보이는 문제가 있었음
    //    (예: 파출 0원 + 직원파출 175,000원 → "175,000(175,000)원"으로 표시).
    //    파출/직원파출을 각각 구분해서 보여주려면 합계가 아니라 각 원본 금액을 써야 한다.
    const dispatchAmount = Number(row.dispatch_amount) || 0;
    const employeeDispatch = Number(row.employee_dispatch_amount) || 0;
    const utilCount = Number(row.util_count) || 0;

    const parts = [];
    if (overtimeHours > 0) parts.push(`초과: ${overtimeHours}시간`);
    if (absenceCount > 0) parts.push(`결근: ${absenceCount}회`);
    if (dispatchAmount > 0 || employeeDispatch > 0)
      parts.push(`파출(직원파출): ${formatNumber(dispatchAmount)}(${formatNumber(employeeDispatch)})원`);
    if (utilCount > 0) parts.push(`유틸: ${utilCount}회`);

    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  };

  // 당월 예상 인건비 괄호 안 상세 내역: 금일 기준과 같은 항목이지만, 오늘 캡 없이 출근부에 이미 입력된
  // 이번 달 전체(월초에 미리 채워두는 방식) 초과/결근/파출/직원파출/유틸을 그대로 집계한 값이다.
  const getEstimatedMonthPersonCostDetail = (row) => {
    const overtimeHours = Number(row.overtime_hours_month) || 0;
    const absenceCount = Number(row.absence_count_month) || 0;
    const dispatchAmount = Number(row.dispatch_amount_month) || 0;
    const employeeDispatch = Number(row.employee_dispatch_amount_month) || 0;
    const utilCount = Number(row.util_count_month) || 0;

    const parts = [];
    if (overtimeHours > 0) parts.push(`초과: ${overtimeHours}시간`);
    if (absenceCount > 0) parts.push(`결근: ${absenceCount}회`);
    if (dispatchAmount > 0 || employeeDispatch > 0)
      parts.push(`파출(직원파출): ${formatNumber(dispatchAmount)}(${formatNumber(employeeDispatch)})원`);
    if (utilCount > 0) parts.push(`유틸: ${utilCount}회`);

    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  };

  const salesTotal = personCostRows.reduce((sum, row) => sum + (Number(row.sales_total) || 0), 0);
  // 업장별 일반 직원 급여와 유틸·통합 배부액을 합산한 당월 인건비 합계
  const currentMonthPersonCostTotal = personCostRows.reduce(
    (sum, row) => sum + (Number(getComputedValue(row, "current_month_person_cost")) || 0),
    0
  );
  // 금일 기준 인건비 합계
  const todayPersonCostTotal = personCostRows.reduce(
    (sum, row) => sum + (Number(getComputedValue(row, "today_person_cost")) || 0),
    0
  );
  // 당월 예상 인건비 합계
  const estimatedMonthPersonCostTotal = personCostRows.reduce(
    (sum, row) => sum + (Number(getComputedValue(row, "estimated_month_person_cost")) || 0),
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

      // 현재 화면에 조회된 업장의 매출·예산·당월/금일/당월예상 인건비 합계
      {
        const totalRow = {
          account_name: "합계",
          sales_total: salesTotal,
          budget_45: salesTotal * 0.45,
          current_month_person_cost: currentMonthPersonCostTotal,
          today_person_cost: todayPersonCostTotal,
          estimated_month_person_cost: estimatedMonthPersonCostTotal,
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
          <MDButton
            variant="gradient"
            color="warning"
            size="small"
            disabled={!hasDirtyNotes || isNoteSavingAny}
            onClick={handleNoteSaveAll}
          >
            저장
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

                    // 🔹 비고는 입력 가능한 텍스트필드로만 렌더링 (개별 저장 버튼 없음).
                    //    커서 뗀다고(blur) 저장하지 않고, 상단 "비고 저장" 버튼을 눌러야 한번에 저장된다.
                    //    저장 전까지는 빨간색으로 dirty 표시.
                    if (field === "note") {
                      const noteValue =
                        noteEdits[row.account_id] !== undefined ? noteEdits[row.account_id] : row.note ?? "";
                      const isNoteDirty =
                        noteEdits[row.account_id] !== undefined && noteEdits[row.account_id] !== (row.note ?? "");
                      const isNoteSaving = !!noteSaving[row.account_id];
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
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={noteValue}
                            disabled={isNoteSaving}
                            onChange={(e) => handleNoteChange(row.account_id, e.target.value)}
                            InputProps={{
                              disableUnderline: true,
                              style: { fontSize: "12px", color: isNoteDirty ? "#d32f2f" : undefined },
                            }}
                          />
                        </td>
                      );
                    }

                    // 🔹 당월/금일 기준/당월 예상 인건비 세 컬럼은 인건비 확보금액(인건비×120%, 직원 개인별로
                    //    계산해서 합산한 값)을 그대로 금액으로 보여준다 (getComputedValue가 알아서 _secured로 치환)
                    const value = getComputedValue(row, field);
                    const isNumeric = numericFields.includes(field);

                    const ratio =
                      field === "current_month_person_cost" ||
                        field === "today_person_cost" ||
                        field === "estimated_month_person_cost"
                        ? getPersonCostRatio(row, field)
                        : null;
                    const ratioColor = getPersonCostColor(ratio);

                    // 🔹 금일 기준/당월 예상 인건비 셀은 숫자 아래에 초과/결근/파출/유틸 상세를 줄바꿈으로 덧붙인다
                    const detailText =
                      field === "today_person_cost"
                        ? getTodayPersonCostDetail(row)
                        : field === "estimated_month_person_cost"
                          ? getEstimatedMonthPersonCostDetail(row)
                          : "";

                    return (
                      <td
                        key={field}
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                          textAlign: isNumeric ? "right" : field === "account_name" ? "left" : "center",
                          whiteSpace: detailText ? "normal" : undefined,
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
                        {detailText && (
                          <>
                            <br />
                            <span style={{ fontSize: "10px", color: "#777", fontWeight: "normal" }}>
                              {detailText}
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
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(todayPersonCostTotal))}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(Math.round(estimatedMonthPersonCostTotal))}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </Box>
    </>
  );
}
