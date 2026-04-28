import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Grid,
  Paper,
  Popover,
  TableContainer,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import dayjs from "dayjs";
import useHeadofficeSchedulesheetData from "./HeadofficeScheduleSheetData";

// 파이 차트 요소 등록
ChartJS.register(ArcElement, Tooltip, Legend);

// 팀별 일정 구분 기준값
const TYPE_OPTIONS_BY_DEPT = {
  operate: [
    { value: "1", label: "행사" },
    { value: "2", label: "위생" },
    { value: "3", label: "관리" },
    { value: "4", label: "이슈" },
    { value: "5", label: "미팅" },
    { value: "6", label: "오픈" },
    { value: "7", label: "오픈준비" },
    { value: "8", label: "외근" },
    { value: "9", label: "출장" },
    { value: "10", label: "체크" },
    { value: "11", label: "연차" },
    { value: "12", label: "오전반차" },
    { value: "13", label: "오후반차" },
  ],
  catering: [
    { value: "1", label: "행사" },
    { value: "2", label: "위생" },
    { value: "3", label: "관리" },
    { value: "4", label: "이슈" },
    { value: "5", label: "미팅" },
    { value: "6", label: "오픈" },
    { value: "7", label: "오픈준비" },
    { value: "8", label: "외근" },
    { value: "9", label: "출장" },
    { value: "10", label: "체크" },
    { value: "11", label: "연차" },
    { value: "12", label: "오전반차" },
    { value: "13", label: "오후반차" },
  ],
  business: [
    { value: "1", label: "행사" },
    { value: "2", label: "미팅" },
    { value: "3", label: "오픈" },
    { value: "4", label: "오픈준비" },
    { value: "5", label: "외근" },
    { value: "6", label: "출장" },
    { value: "7", label: "체크" },
    { value: "8", label: "연차" },
    { value: "9", label: "오전반차" },
    { value: "10", label: "오후반차" },
  ],
};

const TOP_FILTER_CONTROL_HEIGHT = 38;
// 거래처별 집계 표 컬럼 너비
const ACCOUNT_COL_WIDTHS = ["30%", "24%", "12%", "12%", "12%", "10%"];
// 파이 차트 항목 색상
const PIE_COLORS = [
  "#5e72e4",
  "#11cdef",
  "#2dce89",
  "#fb6340",
  "#f5365c",
  "#8965e0",
  "#ffd600",
  "#26a69a",
  "#8d6e63",
  "#90A4AE",
];

// 팀 구분별 일정 유형 라벨
const getTypeLabel = (deptType, typeValue) => {
  const options = TYPE_OPTIONS_BY_DEPT[deptType] || [];
  const found = options.find((item) => item.value === String(typeValue));
  return found ? found.label : "미지정";
};

// 통계 집계 대상 유형 라벨
const getStatTypeLabel = (deptType, typeValue) => {
  const label = getTypeLabel(deptType, typeValue);
  if (label === "행사") return "관리";
  if (["위생", "관리", "이슈"].includes(label)) return label;
  return null;
};

// 파이 차트 상위 항목 및 기타 항목
const compactPieRows = (rows, maxItems = 8) => {
  if (rows.length <= maxItems) return rows;
  const head = rows.slice(0, maxItems - 1);
  const tail = rows.slice(maxItems - 1);
  const etcCount = tail.reduce((sum, row) => sum + Number(row.count || 0), 0);
  return [...head, { label: "기타", count: etcCount, color: "#90A4AE" }];
};

// 원그래프 요약 카드
function PieSummaryCard({ title, rows }) {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  // 화면 크기별 차트 카드 높이
  const cardHeight = isMd ? 260 : 160;
  // 파이 차트 전체 건수
  const totalCount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [rows]
  );

  // 파이 차트 데이터셋
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

  // 파이 차트 툴팁 옵션
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
        /* 차트 데이터 없음 안내 영역 */
        <Box
          sx={{
            height: cardHeight,
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
        <Box sx={{ display: "flex", gap: 1.25, height: cardHeight }}>
          {/* 차트 항목별 건수 목록 영역 */}
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

          {/* 파이 차트 표시 영역 */}
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

function HeadofficeScheduleStatTab() {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  // 우측 차트 영역 높이 측정 참조
  const rightPanelRef = useRef(null);
  // 담당자 셀 말줄임 여부 측정 참조
  const memberCellRefs = useRef({});
  // 좌측 표 최대 높이 기준값
  const [rightPanelHeight, setRightPanelHeight] = useState(500);
  // 담당자 셀 말줄임 발생 상태
  const [memberCellOverflowMap, setMemberCellOverflowMap] = useState({});
  // 담당자 목록 팝업 상태
  const [memberPopover, setMemberPopover] = useState({
    anchorEl: null,
    accountName: "",
    rows: [],
  });

  // 우측 차트 영역 높이 동기화
  useEffect(() => {
    if (!rightPanelRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) setRightPanelHeight(h);
    });
    observer.observe(rightPanelRef.current);
    return () => observer.disconnect();
  }, []);

  // 기본 조회 기준 연월
  const currentDayjs = dayjs();
  // 조회 연도 필터 상태
  const [filterYear, setFilterYear] = useState(currentDayjs.year());
  // 조회 월 필터 상태
  const [filterMonth, setFilterMonth] = useState(currentDayjs.month() + 1);

  // 월별 본사 일정 원본 데이터
  const { eventListRows, eventList, accountList, fetchAccountList } = useHeadofficeSchedulesheetData(
    filterYear,
    filterMonth
  );

  // 연월 필터 변경 시 일정 목록 조회
  useEffect(() => {
    eventList();
  }, [filterYear, filterMonth]);

  // 거래처명 보정용 거래처 목록
  useEffect(() => {
    fetchAccountList();
  }, []);

  // 거래처 ID 기준 거래처명 매핑
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((row) => {
      const id = String(row?.account_id || "").trim();
      const name = String(row?.account_name || "").trim();
      if (id) map.set(id, name);
    });
    return map;
  }, [accountList]);

  // 취소 일정 제외 통계 대상 목록
  const statRows = useMemo(
    () => eventListRows.filter((item) => item.del_yn !== "Y"),
    [eventListRows]
  );

  // 거래처별 위생/관리/이슈 집계 데이터
  const statByAccount = useMemo(() => {
    const map = {};
    // 전체 거래처 기준 기본 행
    (accountList || []).forEach((acc) => {
      const id = String(acc.account_id || "").trim();
      const name = String(acc.account_name || "").trim();
      if (!id && !name) return;
      const key = id || name;
      map[key] = {
        account_key: key,
        account_name: name || "미지정",
        members: new Set(),
        memberStats: {},
        위생: 0,
        관리: 0,
        이슈: 0,
        total: 0,
      };
    });

    // 본사 일정 데이터 기준 집계값
    statRows.forEach((item) => {
      const accountId = String(item.account_id || "").trim();
      const accountName =
        String(item.account_name || "").trim() || accountNameById.get(accountId) || "미지정";
      const memberName = String(item.user_name || "").trim() || "미지정";
      const deptType = String(item.dept_type || "").trim();
      const key = accountId || accountName;

      if (!map[key]) {
        map[key] = {
          account_key: key,
          account_name: accountName,
          members: new Set(),
          memberStats: {},
          위생: 0,
          관리: 0,
          이슈: 0,
          total: 0,
        };
      }

      const statLabel = getStatTypeLabel(deptType, item.type);
      if (!statLabel) return;
      map[key].members.add(memberName);
      if (!map[key].memberStats[memberName]) {
        map[key].memberStats[memberName] = { name: memberName, total: 0, 위생: 0, 관리: 0, 이슈: 0 };
      }
      map[key].memberStats[memberName][statLabel] += 1;
      map[key].memberStats[memberName].total += 1;
      map[key][statLabel] += 1;
      map[key].total += 1;
    });

    // 거래처명 기준 정렬 목록
    return Object.values(map)
      .map((row) => ({
        ...row,
        memberRows: Object.values(row.memberStats || {}).sort(
          (a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko")
        ),
        user_names: [...row.members].join(", "),
      }))
      .sort((a, b) => {
        const aUnknown = a.account_name === "미지정" ? 1 : 0;
        const bUnknown = b.account_name === "미지정" ? 1 : 0;
        if (aUnknown !== bUnknown) return aUnknown - bUnknown;
        return a.account_name.localeCompare(b.account_name, "ko");
      });
  }, [statRows, accountList, accountNameById]);

  // 담당자 셀 말줄임 상태 측정
  useEffect(() => {
    const measureMemberCells = () => {
      const nextOverflowMap = {};
      Object.entries(memberCellRefs.current).forEach(([key, cell]) => {
        if (!cell) return;
        nextOverflowMap[key] = cell.scrollWidth > cell.clientWidth + 1;
      });
      setMemberCellOverflowMap(nextOverflowMap);
    };

    const timer = setTimeout(measureMemberCells, 0);
    window.addEventListener("resize", measureMemberCells);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureMemberCells);
    };
  }, [statByAccount]);

  // 유형별 위생/관리/이슈 파이 차트 데이터
  const typePieRows = useMemo(() => {
    const map = {
      위생: 0, 관리: 0, 이슈: 0
    };
    statRows.forEach((item) => {
      const deptType = String(item.dept_type || "").trim();
      const statLabel = getStatTypeLabel(deptType, item.type);
      if (statLabel) map[statLabel] += 1;
    });

    return ["위생", "관리", "이슈"]
      .map((label, idx) => ({
        label: label === "관리" ? "관리(+행사)" : label,
        count: map[label],
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }))
      .filter((row) => row.count > 0);
  }, [statRows]);

  // 담당자별 파이 차트 데이터
  const memberPieRows = useMemo(() => {
    const map = {};
    statRows.forEach((item) => {
      const deptType = String(item.dept_type || "").trim();
      const statLabel = getStatTypeLabel(deptType, item.type);
      if (!statLabel) return;
      const name = String(item.user_name || "").trim() || "미지정";
      map[name] = (map[name] || 0) + 1;
    });

    const rows = Object.entries(map)
      .map(([label, count], idx) => ({
        label,
        count,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));

    return compactPieRows(rows, 8);
  }, [statRows]);

  // 조회 연도 선택 목록
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

  // 통계 표 공통 스타일
  const summaryTableSx = {
    border: "1px solid #ddd",
    borderRadius: 1,
    maxHeight: rightPanelHeight ? `${rightPanelHeight}px` : "calc(100vh - 227px)",
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

  // 고정 너비 테이블 셀 스타일
  const getFixedCellStyle = (width, extra = {}) => ({
    width,
    minWidth: width,
    maxWidth: width,
    ...extra,
  });

  // 담당자 목록 팝업 열기
  const handleOpenMemberPopover = (event, row) => {
    if (!memberCellOverflowMap[row.account_key] || !row.memberRows || row.memberRows.length === 0) return;
    setMemberPopover({
      anchorEl: event.currentTarget,
      accountName: row.account_name,
      rows: row.memberRows,
    });
  };

  // 담당자 목록 팝업 닫기
  const handleCloseMemberPopover = () => {
    setMemberPopover({ anchorEl: null, accountName: "", rows: [] });
  };

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
        {/* 좌측: 거래처별 위생/관리/이슈 집계 표 */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
            거래처별 집계
          </Typography>
          {statByAccount.length === 0 ? (
            /* 거래처별 집계 데이터 없음 안내 */
            <Typography variant="body2" sx={{ color: "#aaa", mb: 2 }}>
              데이터가 없습니다.
            </Typography>
          ) : (
            /* 거래처별 집계 표 영역 */
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
                  {/* 거래처별 집계 행 목록 */}
                  {statByAccount.map((row) => (
                    <tr key={row.account_key}>
                      {(() => {
                        const canOpenMemberPopover = Boolean(memberCellOverflowMap[row.account_key]);
                        return (
                          <>
                            <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[0], { fontWeight: "bold", color: "#344767" })}>{row.account_name}</td>
                            <td
                              ref={(cell) => {
                                if (cell) {
                                  memberCellRefs.current[row.account_key] = cell;
                                } else {
                                  delete memberCellRefs.current[row.account_key];
                                }
                              }}
                              style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[1], {
                                color: "#344767",
                                cursor: canOpenMemberPopover ? "pointer" : "default",
                                textDecoration: "none",
                              })}
                              title={row.user_names || "-"}
                              onClick={(event) => handleOpenMemberPopover(event, row)}
                            >
                              {row.user_names || "-"}
                            </td>
                          </>
                        );
                      })()}
                      <td style={getFixedCellStyle(ACCOUNT_COL_WIDTHS[2], { fontWeight: "bold" })}>{row.total || "-"}</td>
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
                  ))}
                </tbody>
              </table>
            </TableContainer>
          )}
        </Grid>

        {/* 우측: 유형별 원그래프 + 담당자별 원그래프 */}
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
      {/* 담당자별 집계 팝업 */}
      <Popover
        open={Boolean(memberPopover.anchorEl)}
        anchorEl={memberPopover.anchorEl}
        onClose={handleCloseMemberPopover}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        PaperProps={{
          sx: {
            borderRadius: 1,
            boxShadow: "0 2px 10px rgba(0,0,0,0.16)",
            border: "1px solid #ddd",
            p: 1,
            width: 520,
            maxWidth: "90vw",
          },
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
            담당자 목록 / {memberPopover.accountName}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ ...summaryTableSx, maxHeight: 260 }}>
            <table>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>담당자</th>
                  <th>총방문</th>
                  <th>위생</th>
                  <th>관리</th>
                  <th>이슈</th>
                </tr>
              </thead>
              <tbody>
                {memberPopover.rows.map((row) => (
                  <tr key={row.name}>
                    <td style={{ fontWeight: "bold", color: "#344767" }}>{row.name}</td>
                    <td style={{ fontWeight: "bold" }}>{row.total || "-"}</td>
                    <td style={{ color: "#F2921D", fontWeight: row.위생 ? "bold" : "normal" }}>{row.위생 || "-"}</td>
                    <td style={{ color: "#0046FF", fontWeight: row.관리 ? "bold" : "normal" }}>{row.관리 || "-"}</td>
                    <td style={{ color: "#527853", fontWeight: row.이슈 ? "bold" : "normal" }}>{row.이슈 || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        </Box>
      </Popover>
    </Box>
  );
}

export default HeadofficeScheduleStatTab;
