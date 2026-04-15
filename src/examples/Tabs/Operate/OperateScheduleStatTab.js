import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Grid,
  Paper,
  TableContainer,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import dayjs from "dayjs";
import useOperateSchedulesheetData from "./operateScheduleSheetData";

// 파이 차트에서 사용하는 chart.js 요소 등록
ChartJS.register(ArcElement, Tooltip, Legend);

// 운영 일정 구분(type) 옵션: 시트 탭과 동일한 순서/값 유지
const TYPE_OPTIONS = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생", color: "#F2921D" },
  { value: "3", label: "관리", color: "#0046FF" },
  { value: "4", label: "이슈", color: "#527853" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// 통계 화면에서 집계할 대상 유형(위생/관리/이슈)
const STAT_TYPE_OPTIONS = TYPE_OPTIONS.filter((t) => ["2", "3", "4"].includes(t.value));
const TOP_FILTER_CONTROL_HEIGHT = 38;
const ACCOUNT_COL_WIDTHS = ["35%", "17%", "12%", "12%", "12%", "12%"];
const MEMBER_PIE_COLORS = [
  "#5e72e4",
  "#11cdef",
  "#2dce89",
  "#fb6340",
  "#f5365c",
  "#8965e0",
  "#ffd600",
  "#26a69a",
  "#8d6e63",
];

// type 숫자값을 집계 컬럼명(라벨)로 변환
const getTypeLabel = (typeValue) => {
  const found = STAT_TYPE_OPTIONS.find((t) => t.value === String(typeValue));
  return found ? found.label : null;
};

// 파이 항목이 많을 때 상위 항목 + 기타로 축약
const compactPieRows = (rows, maxItems = 8) => {
  if (rows.length <= maxItems) return rows;
  const head = rows.slice(0, maxItems - 1);
  const tail = rows.slice(maxItems - 1);
  const etcCount = tail.reduce((sum, row) => sum + Number(row.count || 0), 0);
  return [...head, { label: "기타", count: etcCount, color: "#90A4AE" }];
};

// 우측 카드형 원그래프(좌측 목록 + 우측 파이)
function PieSummaryCard({ title, rows }) {
  const totalCount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [rows]
  );

  const chartData = useMemo(
    () => ({
      labels: rows.map((row) => row.label),
      datasets: [
        {
          data: rows.map((row) => row.count),
          backgroundColor: rows.map((row) => row.color),
          borderColor: "#ffffff",
          borderWidth: 1,
        },
      ],
    }),
    [rows]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.raw || 0);
              const ratio = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : "0.0";
              return `${ctx.label}: ${value}건 (${ratio}%)`;
            },
          },
        },
      },
    }),
    [totalCount]
  );

  return (
    <Paper variant="outlined" sx={{ border: "1px solid #ddd", borderRadius: 1, p: 1.5, backgroundColor: "#fff" }}>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
          {title}
        </Typography>
      )}
      {rows.length === 0 ? (
        <Box
          sx={{
            height: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            border: "1px dashed #d7dee8",
            borderRadius: 1,
          }}
        >
          데이터가 없습니다.
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 1.25, height: 260 }}>
          <Box
            sx={{
              width: "48%",
              minWidth: 120,
              borderRight: "1px solid #eef2f7",
              pr: 1,
              overflowY: "auto",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pb: 0.5,
                mb: 0.25,
                borderBottom: "1px solid #e9edf3",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#344767" }}>항목</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#344767" }}>건수(비율)</Typography>
            </Box>
            {rows.map((row, idx) => {
              const ratio = totalCount > 0 ? ((row.count / totalCount) * 100).toFixed(1) : "0.0";
              return (
                <Box
                  key={`${row.label}_${idx}`}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 0.5,
                    px: 0.5,
                    borderBottom: "1px dashed #f0f2f5",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: row.color,
                        flex: "0 0 10px",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: "#344767",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={row.label}
                    >
                      {row.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#344767", ml: 1, flexShrink: 0 }}>
                    {row.count}건 ({ratio}%)
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ width: "52%", minWidth: 0 }}>
            <Pie data={chartData} options={chartOptions} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}

PieSummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
    })
  ).isRequired,
};

function OperateScheduleStatTab() {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  const rightPanelRef = useRef(null);
  const [rightPanelHeight, setRightPanelHeight] = useState(500);

  useEffect(() => {
    if (!rightPanelRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) setRightPanelHeight(h);
    });
    observer.observe(rightPanelRef.current);
    return () => observer.disconnect();
  }, []);

  // 기본 조회 기준: 현재 연/월
  const currentDayjs = dayjs();
  const [filterYear, setFilterYear] = useState(currentDayjs.year());
  const [filterMonth, setFilterMonth] = useState(currentDayjs.month() + 1);

  // 월별 일정 원본 데이터 조회
  const { eventListRows, eventList, accountList, fetchAccountList } = useOperateSchedulesheetData(
    filterYear,
    filterMonth
  );

  // 연/월 필터 변경 시 목록 재조회
  useEffect(() => {
    eventList();
  }, [filterYear, filterMonth]);
  // 거래처명 보정용 거래처 목록을 미리 조회
  useEffect(() => {
    fetchAccountList();
  }, []);

  // account_id -> account_name 매핑
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((row) => {
      const id = String(row?.account_id || "").trim();
      const name = String(row?.account_name || "").trim();
      if (id) map.set(id, name);
    });
    return map;
  }, [accountList]);

  // 통계 대상 행만 필터(취소건 제외 + 위생/관리/이슈만)
  const statRows = useMemo(
    () =>
      eventListRows.filter(
        (item) => item.del_yn !== "Y" && STAT_TYPE_OPTIONS.some((t) => t.value === String(item.type))
      ),
    [eventListRows]
  );

  // 담당자별 집계: 담당자 단위 위생/관리/이슈 + 합계
  const statByMember = useMemo(() => {
    const map = {};
    statRows.forEach((item) => {
      const name = String(item.user_name || "").trim() || "미지정";
      if (!map[name]) map[name] = { total: 0, 위생: 0, 관리: 0, 이슈: 0 };
      const label = getTypeLabel(item.type);
      if (!label) return;
      map[name][label] += 1;
      map[name].total += 1;
    });
    return Object.entries(map)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko"));
  }, [statRows]);

  // 거래처별 집계: 거래처+담당자 조합 단위 집계 후 담당자 -> 거래처 순 정렬
  const statByAccount = useMemo(() => {
    const map = {};
    statRows.forEach((item) => {
      const accountId = String(item.account_id || "").trim();
      const accountName =
        String(item.account_name || "").trim() || accountNameById.get(accountId) || "미지정";
      const memberName = String(item.user_name || "").trim() || "미지정";
      const key = `${accountId || accountName}__${memberName}`;
      if (!map[key]) {
        map[key] = {
          account_key: key,
          account_name: accountName,
          user_name: memberName,
          위생: 0,
          관리: 0,
          이슈: 0,
          total: 0,
        };
      }
      const label = getTypeLabel(item.type);
      if (!label) return;
      map[key][label] += 1;
      map[key].total = map[key].위생 + map[key].관리 + map[key].이슈;
    });

    return Object.values(map).sort((a, b) => (
      a.user_name.localeCompare(b.user_name, "ko")
      || a.account_name.localeCompare(b.account_name, "ko")
    ));
  }, [statRows, accountNameById]);

  // 유형별 총 건수
  const statByType = useMemo(() => {
    const map = {};
    statRows.forEach((item) => {
      const label = getTypeLabel(item.type);
      if (label) map[label] = (map[label] || 0) + 1;
    });
    return map;
  }, [statRows]);

  // 유형별 파이 차트 데이터
  const typePieRows = useMemo(
    () =>
      STAT_TYPE_OPTIONS.map((t) => ({
        label: t.label,
        count: Number(statByType[t.label] || 0),
        color: t.color,
      })).filter((row) => row.count > 0),
    [statByType]
  );

  // 담당자별 파이 차트 데이터(상위 + 기타)
  const memberPieRows = useMemo(() => {
    const rows = statByMember
      .filter((row) => Number(row.total || 0) > 0)
      .map((row, idx) => ({
        label: row.name,
        count: Number(row.total || 0),
        color: MEMBER_PIE_COLORS[idx % MEMBER_PIE_COLORS.length],
      }));
    return compactPieRows(rows, 8);
  }, [statByMember]);

  const yearOptions = [];
  for (let y = currentDayjs.year() - 2; y <= currentDayjs.year() + 1; y += 1) yearOptions.push(y);

  // 상단 필터 공통 스타일
  const filterSx = {
    "& .MuiOutlinedInput-root": {
      height: TOP_FILTER_CONTROL_HEIGHT,
      minHeight: TOP_FILTER_CONTROL_HEIGHT,
      background: "#fff",
    },
  };

  // 회계 법인카드 시트와 동일 톤의 테이블 스타일
  const summaryTableSx = {
    border: "1px solid #ddd",
    borderRadius: 1,
    maxHeight: isMd ? rightPanelHeight - 33 : "60vh",
    overflow: "auto",
    "& table": {
      borderCollapse: "separate",
      width: "100%",
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      whiteSpace: "nowrap",
      fontSize: "12px",
      padding: "6px 4px",
      boxSizing: "border-box",
      verticalAlign: "middle",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      fontWeight: 700,
      color: "#344767",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& tbody tr:hover": {
      backgroundColor: "#fafafa",
    },
  };
  const getFixedCellStyle = (width, extra = {}) => ({
    width,
    minWidth: width,
    maxWidth: width,
    ...extra,
  });

  return (
    <Box sx={{ p: 1 }}>
      {/* 상단 연/월 필터 */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, mb: 1.5 }}>
        <TextField
          select
          size="small"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          sx={{ minWidth: 110, ...filterSx }}
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
          value={filterMonth}
          onChange={(e) => setFilterMonth(Number(e.target.value))}
          sx={{ minWidth: 110, ...filterSx }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>
      </Box>

      {/* 본문: 좌측 50%(표), 우측 50%(원그래프 2개) */}
      <Grid container spacing={1.5}>
        {/* 좌측: 거래처별 표 */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
            거래처별 집계
          </Typography>
          {statByAccount.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#aaa", mb: 2 }}>
              데이터가 없습니다.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={summaryTableSx}>
              <table>
                <colgroup>
                  {ACCOUNT_COL_WIDTHS.map((width, idx) => (
                    <col key={`account-col-${idx}`} style={{ width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[0])}>거래처</th>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[1])}>담당자</th>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[2])}>총 방문</th>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[3])}>위생</th>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[4])}>관리</th>
                    <th style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[5])}>이슈</th>
                  </tr>
                </thead>
                <tbody>
                  {statByAccount.map((row, idx) => {
                    const prevUserName = idx > 0 ? statByAccount[idx - 1]?.user_name : "";
                    const isNewMemberGroup = idx === 0 || prevUserName !== row.user_name;
                    return (
                      <React.Fragment key={row.account_key}>
                        {isNewMemberGroup && (
                          <tr>
                            <td
                              colSpan={6}
                              style={{
                                ...getFixedCellStyle("100%"),
                                fontWeight: 700,
                                textAlign: "left",
                                padding: "6px 10px",
                                backgroundColor: "#f7f9fc",
                                borderTop: "2px solid #8a8f98",
                                color: "#344767",
                              }}
                            >
                              담당자: {row.user_name}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[0], { fontWeight: "bold", color: "#344767" })}>{row.account_name}</td>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[1], { color: "#344767" })}>{row.user_name}</td>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[2], { fontWeight: "bold" })}>{row.total}</td>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[3], { color: "#F2921D", fontWeight: row.위생 ? "bold" : "normal" })}>
                            {row.위생 || "-"}
                          </td>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[4], { color: "#0046FF", fontWeight: row.관리 ? "bold" : "normal" })}>
                            {row.관리 || "-"}
                          </td>
                          <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[5], { color: "#527853", fontWeight: row.이슈 ? "bold" : "normal" })}>
                            {row.이슈 || "-"}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableContainer>
          )}
        </Grid>

        {/* 우측: 유형별 원그래프 + 담당자별 집계 */}
        <Grid item xs={12} md={6}>
          <Box ref={rightPanelRef} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: -0.5 }}>
              유형별 집계
            </Typography>
            <PieSummaryCard title="" rows={typePieRows} />

            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: -0.5 }}>
              담당자별 집계
            </Typography>
            <PieSummaryCard title="" rows={memberPieRows} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default OperateScheduleStatTab;
