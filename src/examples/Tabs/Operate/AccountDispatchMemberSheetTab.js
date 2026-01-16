import React, { useMemo, useState, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import MDButton from "components/MDButton";
import DownloadIcon from "@mui/icons-material/Download";
import { TextField, useTheme, useMediaQuery, Box, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import useAccountDispatchMembersheetData, { formatNumber } from "./accountDispatchMemberSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";

/**
 * ✅ 달력 주차(월~일) 계산 (월요일 시작)
 * - 1주차: 해당 월 1일 ~ 그 주의 일요일(또는 말일)
 * - 이후: 월요일~일요일 단위로 끊고, 마지막 주는 말일까지
 */
const buildCalendarWeekRanges = (year, month) => {
  const y = Number(year);
  const m = Number(month); // 1~12
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=일,1=월,...6=토

  // 월요일 시작 주차 기준: 0=월..6=일
  const firstDowMonIndex = (firstDow + 6) % 7;
  const firstWeekDays = 7 - firstDowMonIndex;

  const ranges = [];
  let start = 1;
  let end = Math.min(daysInMonth, firstWeekDays);

  let weekNo = 1;
  ranges.push({ weekNo, start, end });

  start = end + 1;
  weekNo += 1;

  while (start <= daysInMonth) {
    end = Math.min(daysInMonth, start + 6);
    ranges.push({ weekNo, start, end });
    start = end + 1;
    weekNo += 1;
  }

  // ✅ day -> weekNo 매핑
  const dayToWeekNo = {};
  ranges.forEach((w) => {
    for (let d = w.start; d <= w.end; d += 1) dayToWeekNo[String(d)] = w.weekNo;
  });

  // ✅ endDay -> weekNo 매핑 (주차 마지막날에 마커 표시용)
  const endDayToWeekNo = {};
  ranges.forEach((w) => {
    endDayToWeekNo[String(w.end)] = w.weekNo;
  });

  return { daysInMonth, ranges, dayToWeekNo, endDayToWeekNo };
};

const WEEK_BG = [
  "#FFF3B0", // 1주차
  "#CDE8FF", // 2주차
  "#D5F5E3", // 3주차
  "#FADBD8", // 4주차
  "#E8DAEF", // 5주차
  "#FDEBD0", // 6주차
];

const getWeekBg = (weekNo) => WEEK_BG[(weekNo - 1) % WEEK_BG.length];

/**
 * ✅ row들의 주차별 salary 합계 계산
 * - row의 "dSalary" 키들을 보고 합산
 */
const calcWeekSalarySums = (rows, weekRanges) => {
  const sums = {};
  weekRanges.forEach((w) => (sums[w.weekNo] = 0));

  (rows || []).forEach((row) => {
    weekRanges.forEach((w) => {
      let s = 0;
      for (let d = w.start; d <= w.end; d += 1) {
        const salKey = `${d}Salary`;
        s += Number(row?.[salKey] ?? 0) || 0;
      }
      sums[w.weekNo] += s;
    });
  });

  return sums; // {1: xxxx, 2: yyyy, ...}
};

function AccountDispatchMemberSheet() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [activeStatus, setActiveStatus] = useState("N");

  // ✅ 거래처: 최초 진입 시 첫 번째 거래처로 자동 선택
  const [selectedAccountId, setSelectedAccountId] = useState("");

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
    loading,
  } = useAccountDispatchMembersheetData(
    selectedAccountId,
    activeStatus,
    selectedYear,
    selectedMonth
  );

  const [localLoading, setLocalLoading] = useState(true);

  const {
    daysInMonth,
    ranges: weekRanges,
    dayToWeekNo,
    endDayToWeekNo,
  } = useMemo(() => {
    return buildCalendarWeekRanges(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // ✅ accountList 로드 후: selectedAccountId 없으면 첫 번째로 세팅
  useEffect(() => {
    if (!selectedAccountId && (accountList || []).length > 0) {
      setSelectedAccountId(String(accountList[0].account_id));
    }
  }, [accountList, selectedAccountId]);

  // ✅ 거래처 Autocomplete 옵션
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [accountList]
  );

  // ✅ 조회
  useEffect(() => {
    if (!selectedAccountId) return;

    setLocalLoading(true);
    fetchAccountMembersAllList({ snapshot: false })
      .then((rows) => {
        setActiveRows(rows || []);
        setOriginalRows(rows || []);
      })
      .finally(() => setLocalLoading(false));
  }, [selectedAccountId, activeStatus, selectedYear, selectedMonth, daysInMonth]);

  // ✅ “주차별 salary 합계” 캡션 데이터
  const weekSalarySums = useMemo(() => {
    return calcWeekSalarySums(activeRows, weekRanges);
  }, [activeRows, weekRanges]);

  // ✅ 일자 컬럼(1~말일)
  const dayColumns = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayKey = String(day);

      return {
        header: (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              lineHeight: 1.05,
            }}
          >
            <div>{dayKey}</div>
          </div>
        ),
        accessorKey: dayKey,
        size: 44,
        meta: { align: "center", isDay: true, day },
      };
    });
  }, [daysInMonth]);

  const columns = useMemo(
    () => [
      { header: "성명", accessorKey: "name", size: 90, meta: { align: "left" } },
      { header: "주민번호", accessorKey: "rrn", size: 120, meta: { align: "center" } },
      { header: "은행명", accessorKey: "bank_name", size: 80, meta: { align: "left" } },
      { header: "계좌번호", accessorKey: "account_number", size: 190, meta: { align: "left" } },

      ...dayColumns,

      { header: "근무횟수", accessorKey: "work_cnt", size: 90, meta: { align: "right" } },
      { header: "총 금액", accessorKey: "salary_sum", size: 110, meta: { align: "right" } },
      {
        header: "비고",
        accessorKey: "note",
        minWidth: 120,
        maxWidth: 220,
        meta: { align: "left" },
      },
    ],
    [dayColumns]
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const renderWeekCaption = () => {
    if (!weekRanges?.length) return null;

    return (
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexWrap: "wrap",
          alignItems: "center",
          px: 1,
          py: 1,
          border: "1px solid #ddd",
          borderRadius: 1,
          mb: 1,
          background: "#fafafa",
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, mr: 0.5 }}>주차별 급여 합계</Typography>

        {weekRanges.map((w) => (
          <Box
            key={w.weekNo}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.8,
              px: 1.1,
              py: 0.7,
              borderRadius: 1,
              backgroundColor: getWeekBg(w.weekNo),
              border: "1px solid rgba(0,0,0,0.10)",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
              {w.weekNo}주차 ({w.start}~{w.end})
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
              {formatNumber(weekSalarySums?.[w.weekNo] ?? 0)}원
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const renderTable = (tableInst) => {
    const isNumericKey = (k) => k === "salary_sum" || k === "work_cnt";

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
          // ✅ sticky: 성명~계좌번호만
          "& td:nth-of-type(1), & th:nth-of-type(1)": {
            position: "sticky",
            left: 0,
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(2), & th:nth-of-type(2)": {
            position: "sticky",
            left: "90px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(3), & th:nth-of-type(3)": {
            position: "sticky",
            left: "210px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "290px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:nth-of-type(-n+4)": { zIndex: 5 },
        }}
      >
        <table>
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
            {tableInst.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = String(cell.column.columnDef.accessorKey || "");
                  const meta = cell.column.columnDef.meta || {};
                  const currentValue = row.getValue(colKey);

                  const isDayCol = meta.isDay === true && /^\d+$/.test(colKey);

                  // ✅ 주차별 배경
                  const weekNo = isDayCol ? dayToWeekNo[colKey] : null;
                  const weekBg = weekNo ? getWeekBg(weekNo) : null;

                  // ✅ 주차 끝(마지막날)만 더 진하게
                  const endWeekNo = isDayCol ? endDayToWeekNo[colKey] : null;
                  const isWeekEndDay = Boolean(endWeekNo);

                  return (
                    <td
                      key={cell.id}
                      style={{
                        textAlign: isNumericKey(colKey) ? "right" : "left",
                        backgroundColor: isDayCol ? weekBg : undefined,
                        borderRight: isWeekEndDay ? "3px solid rgba(0,0,0,0.35)" : undefined,
                      }}
                      contentEditable={false}
                      suppressContentEditableWarning
                    >
                      {isDayCol ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            lineHeight: 1.1,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{currentValue ?? ""}</div>
                          <div style={{ fontSize: 10, fontWeight: 500 }}>{/* salary 숨김 */}</div>
                        </div>
                      ) : isNumericKey(colKey) ? (
                        formatNumber(currentValue ?? 0)
                      ) : (
                        currentValue ?? ""
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

  // ✅ 년/월 옵션
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    const years = [];
    for (let i = y - 3; i <= y + 1; i += 1) years.push(String(i));
    return years;
  }, []);

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);

  // ✅ HEX -> ARGB (ExcelJS는 ARGB 필요)
  const hexToArgb = (hex) => {
    if (!hex) return "FFFFFFFF";
    const h = hex.replace("#", "");
    return `FF${h.toUpperCase()}`; // FF + RRGGBB
  };

  const handleExcelDownload = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "AccountDispatchMemberSheet";
      const ws = wb.addWorksheet("파견직 급여", {
        views: [{ state: "frozen", ySplit: 0 }],
      });

      const fixedCols = ["성명", "주민번호", "은행명", "계좌번호"];
      const dayCols = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const tailCols = ["근무횟수", "총 금액", "비고"];

      const headers = [...fixedCols, ...dayCols, ...tailCols];
      const totalColCount = headers.length;

      const accName =
        (accountList || []).find((a) => String(a.account_id) === String(selectedAccountId))
          ?.account_name ?? "거래처";
      const fileName = `파견직급여_${accName}_${selectedYear}-${String(selectedMonth).padStart(
        2,
        "0"
      )}.xlsx`;

      ws.addRow([`파견직 급여 (${selectedYear}년 ${selectedMonth}월) - ${accName}`]);
      ws.mergeCells(1, 1, 1, totalColCount);
      ws.getRow(1).height = 22;
      ws.getCell(1, 1).font = { bold: true, size: 14 };
      ws.getCell(1, 1).alignment = { vertical: "middle", horizontal: "center" };

      ws.addRow(["주차별 급여 합계"]);
      ws.mergeCells(2, 1, 2, totalColCount);
      ws.getRow(2).height = 18;
      ws.getCell(2, 1).font = { bold: true, size: 11 };
      ws.getCell(2, 1).alignment = { vertical: "middle", horizontal: "left" };

      const captionRowStart = 3;

      let c = 1;
      weekRanges.forEach((w) => {
        const label = `${w.weekNo}주차 (${w.start}~${w.end})`;
        const money = `${formatNumber(weekSalarySums?.[w.weekNo] ?? 0)}원`;
        const text = `${label}  ${money}`;

        if (c <= totalColCount) {
          ws.getCell(captionRowStart, c).value = text;
          ws.mergeCells(captionRowStart, c, captionRowStart, Math.min(c + 2, totalColCount));
          ws.getCell(captionRowStart, c).alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
          };
          ws.getCell(captionRowStart, c).font = { bold: true, size: 10 };

          ws.getCell(captionRowStart, c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: hexToArgb(getWeekBg(w.weekNo)) },
          };

          ws.getCell(captionRowStart, c).border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            left: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
            right: { style: "thin", color: { argb: "FFCCCCCC" } },
          };
        }

        c += 3;
      });

      ws.getRow(captionRowStart).height = 18;

      ws.addRow([]);
      const headerRowIndex = captionRowStart + 2;

      ws.addRow(headers);
      const headerRow = ws.getRow(headerRowIndex);
      headerRow.height = 18;

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FF686D76" } },
          left: { style: "thin", color: { argb: "FF686D76" } },
          bottom: { style: "thin", color: { argb: "FF686D76" } },
          right: { style: "thin", color: { argb: "FF686D76" } },
        };
      });

      const dataStartRowIndex = headerRowIndex + 1;

      (activeRows || []).forEach((r) => {
        const rowValues = [];
        rowValues.push(r?.name ?? "");
        rowValues.push(r?.rrn ?? "");
        rowValues.push(r?.bank_name ?? "");
        rowValues.push(r?.account_number ?? "");

        for (let d = 1; d <= daysInMonth; d += 1) {
          const k = String(d);
          rowValues.push(r?.[k] ?? "");
        }

        rowValues.push(r?.work_cnt ?? 0);
        rowValues.push(r?.salary_sum ?? 0);
        rowValues.push(r?.note ?? "");

        ws.addRow(rowValues);
      });

      const lastRowIndex = ws.rowCount;

      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 18;
      ws.getColumn(3).width = 12;
      ws.getColumn(4).width = 26;

      const dayStartCol = 5;
      for (let d = 1; d <= daysInMonth; d += 1) {
        ws.getColumn(dayStartCol + (d - 1)).width = 6;
      }

      ws.getColumn(dayStartCol + daysInMonth + 0).width = 12;
      ws.getColumn(dayStartCol + daysInMonth + 1).width = 14;
      ws.getColumn(dayStartCol + daysInMonth + 2).width = 22;

      ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

      for (let rIdx = dataStartRowIndex; rIdx <= lastRowIndex; rIdx += 1) {
        const row = ws.getRow(rIdx);
        row.height = 16;

        for (let cIdx = 1; cIdx <= totalColCount; cIdx += 1) {
          const cell = row.getCell(cIdx);

          cell.border = {
            top: { style: "thin", color: { argb: "FF686D76" } },
            left: { style: "thin", color: { argb: "FF686D76" } },
            bottom: { style: "thin", color: { argb: "FF686D76" } },
            right: { style: "thin", color: { argb: "FF686D76" } },
          };

          const isNumeric =
            cIdx === dayStartCol + daysInMonth || cIdx === dayStartCol + daysInMonth + 1;

          if (isNumeric) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else if (cIdx <= 4) {
            cell.alignment = { vertical: "middle", horizontal: cIdx === 1 ? "left" : "center" };
          } else if (cIdx >= dayStartCol && cIdx < dayStartCol + daysInMonth) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }

          if (cIdx === dayStartCol + daysInMonth) cell.numFmt = "#,##0";
          if (cIdx === dayStartCol + daysInMonth + 1) cell.numFmt = "#,##0";

          if (cIdx >= dayStartCol && cIdx < dayStartCol + daysInMonth) {
            const day = cIdx - dayStartCol + 1;
            const weekNo = dayToWeekNo[String(day)];
            if (weekNo) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: hexToArgb(getWeekBg(weekNo)) },
              };
            }

            const isWeekEnd = Boolean(endDayToWeekNo[String(day)]);
            if (isWeekEnd) {
              cell.border = {
                ...cell.border,
                right: { style: "thick", color: { argb: "FF444444" } },
              };
            }
          }
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        fileName
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      Swal.fire("엑셀 다운로드 실패", e?.message || "오류", "error");
    }
  };

  if (loading || localLoading || !selectedAccountId) return <LoadingScreen />;

  return (
    <>
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
            setLocalLoading(true);
            setActiveStatus(e.target.value);
          }}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          <option value="N">재직자</option>
          <option value="Y">퇴사자</option>
        </TextField>

        {/* ✅ 거래처: 문자 검색 가능한 Autocomplete */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={(() => {
            const v = String(selectedAccountId ?? "");
            return accountOptions.find((o) => o.value === v) || null;
          })()}
          onChange={(_, opt) => {
            setLocalLoading(true);
            setSelectedAccountId(opt ? opt.value : "");
          }}
          getOptionLabel={(opt) => opt?.label ?? ""}
          isOptionEqualToValue={(opt, val) => opt.value === val.value}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

        <TextField
          select
          size="small"
          value={selectedYear}
          onChange={(e) => {
            setLocalLoading(true);
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
            setLocalLoading(true);
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

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleExcelDownload}
          startIcon={<DownloadIcon />}
        >
          엑셀다운로드
        </MDButton>
      </MDBox>

      <MDBox pt={1} pb={1}>
        {renderWeekCaption()}
      </MDBox>

      <MDBox pt={0} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            {renderTable(table)}
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default AccountDispatchMemberSheet;
