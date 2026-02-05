/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState } from "react";
import { Grid, Box, Select, MenuItem, TextField } from "@mui/material";
import dayjs from "dayjs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";

// ✅ 기존 월 비교 훅
import usePeopleCountingData, { formatNumber } from "./accountMappingPurchaseData";
// ✅ 새 연도 히트맵 훅
import useAccountMappingPurchaseYearData from "./accountMappingPurchaseYeartData";

export default function PeopleCountingTab() {
  const today = dayjs();
  const [mode, setMode] = useState("MONTH_COMPARE"); // ✅ "YEAR_HEATMAP"
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  // =========================
  // 1) 월 비교(기존)
  // =========================
  const {
    loading: monthLoading,
    fetchPeopleCountingList,
    currentTotal,
    prevTotal,
    chartData,
  } = usePeopleCountingData(year, month);

  useEffect(() => {
    if (mode === "MONTH_COMPARE") fetchPeopleCountingList();
  }, [mode, year, month]);

  const diff = useMemo(() => currentTotal - prevTotal, [currentTotal, prevTotal]);
  const diffRate = useMemo(() => {
    if (!prevTotal) return null;
    return (diff / prevTotal) * 100;
  }, [diff, prevTotal]);

  const titleLabel = useMemo(() => {
    const cur = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    const prev = cur.subtract(1, "month");
    return `${prev.format("YYYY년 M월")} vs ${cur.format("YYYY년 M월")} 거래처별 매출 비교`;
  }, [year, month]);

  const diffRateText = useMemo(() => {
    if (diffRate == null) return "전월 데이터 없음";
    const sign = diffRate >= 0 ? "+" : "";
    return `${sign}${diffRate.toFixed(1)}%`;
  }, [diffRate]);

  // =========================
  // 2) 연도 히트맵(추천)
  // =========================
  const {
    loading: yearLoading,
    fetchYear,
    matrixRows,
    yearTotal,
    maxCell,
    heatColor,
    buildLineData,
  } = useAccountMappingPurchaseYearData(year);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("SUM_DESC"); // SUM_DESC | M_DESC
  const [sortMonth, setSortMonth] = useState(1);
  const [topN, setTopN] = useState(30); // 기본 30개, 전체는 999

  const [selectedVendor, setSelectedVendor] = useState(null);

  const HM_BORDER = "1px solid #e0e0e0";

  useEffect(() => {
    if (mode === "YEAR_HEATMAP") fetchYear();
  }, [mode, year]);

  const filteredRows = useMemo(() => {
    let rows = matrixRows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => String(r.name).toLowerCase().includes(q));
    }

    // 정렬
    if (sortKey === "SUM_DESC") {
      rows = [...rows].sort((a, b) => b.sum - a.sum);
    } else if (sortKey === "M_DESC") {
      const key = `m${sortMonth}`;
      rows = [...rows].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
    }

    // Top N
    if (topN !== 999) rows = rows.slice(0, topN);

    return rows;
  }, [matrixRows, search, sortKey, sortMonth, topN]);

  const selectedLineData = useMemo(() => buildLineData(selectedVendor), [selectedVendor]);

  const loading = mode === "MONTH_COMPARE" ? monthLoading : yearLoading;
  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 */}
      <MDBox pt={0} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <MDButton variant="gradient" color="info" sx={{ visibility: "hidden" }}>
          입금
        </MDButton>
        <MDButton variant="gradient" color="success" sx={{ visibility: "hidden" }}>
          저장
        </MDButton>

        {/* ✅ 모드 전환 */}
        <Select value={mode} onChange={(e) => setMode(e.target.value)} size="small">
          <MenuItem value="MONTH_COMPARE">월 비교(전월 vs 당월)</MenuItem>
          <MenuItem value="YEAR_HEATMAP">연도 히트맵(거래처×월)</MenuItem>
        </Select>

        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>

        {/* ✅ 월 선택은 월 비교 모드에서만 */}
        {mode === "MONTH_COMPARE" && (
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} size="small">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <MenuItem key={m} value={m}>
                {m}월
              </MenuItem>
            ))}
          </Select>
        )}
      </MDBox>

      {/* =========================
          A) 월 비교 화면(기존 유지)
         ========================= */}
      {mode === "MONTH_COMPARE" && (
        <Grid container spacing={2}>
          {/* 전월 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2 }}>
              <MDTypography variant="h6" color="text">
                전월 매출
              </MDTypography>
              <MDTypography variant="h5">{formatNumber(prevTotal)}</MDTypography>
            </Box>
          </Grid>

          {/* 당월 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2 }}>
              <MDTypography variant="h6" color="text">
                당월 매출
              </MDTypography>
              <MDTypography variant="h5">{formatNumber(currentTotal)}</MDTypography>
            </Box>
          </Grid>

          {/* 증감 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2 }}>
              <MDTypography variant="h6" color="text">
                증감(당월-전월)
              </MDTypography>
              <MDBox sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <MDTypography variant="h5">
                  {diff >= 0 ? "▲ " : "▼ "}
                  {formatNumber(Math.abs(diff))}
                </MDTypography>
                <MDTypography variant="h6" color="text" sx={{ fontSize: "12px" }}>
                  ({diffRateText})
                </MDTypography>
              </MDBox>
            </Box>
          </Grid>

          {/* 그래프 */}
          <Grid item xs={12}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2, height: 600, fontSize: 12 }}>
              <MDTypography variant="h6" sx={{ mb: 1 }}>
                {titleLabel}
              </MDTypography>

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 100 }}
                  barCategoryGap={2}
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatNumber(v)} />
                  <Legend />
                  <Bar dataKey="prev" name="전월" fill="#90A4AE" maxBarSize={16} />
                  <Bar dataKey="current" name="당월" fill="#FF5F00" maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>
      )}

      {/* =========================
          B) 연도 히트맵 화면(추천)
         ========================= */}
      {mode === "YEAR_HEATMAP" && (
        <Grid container spacing={2}>
          {/* 요약 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 1 }}>
              <MDTypography variant="h6" color="text">
                {year}년 총 매출
              </MDTypography>
              <MDTypography variant="h6">{formatNumber(yearTotal)}</MDTypography>
            </Box>
          </Grid>

          {/* 컨트롤 */}
          <Grid item xs={12} md={8}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <TextField
                size="small"
                placeholder="거래처 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSearch((prev) => prev.trim());
                  }
                }}
              />

              <Select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <MenuItem value="SUM_DESC">연간합계 ↓</MenuItem>
                <MenuItem value="M_DESC">특정월 ↓</MenuItem>
              </Select>

              {sortKey === "M_DESC" && (
                <Select size="small" value={sortMonth} onChange={(e) => setSortMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}월
                    </MenuItem>
                  ))}
                </Select>
              )}

              <Select size="small" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                <MenuItem value={20}>Top 20</MenuItem>
                <MenuItem value={30}>Top 30</MenuItem>
                <MenuItem value={50}>Top 50</MenuItem>
                <MenuItem value={999}>전체</MenuItem>
              </Select>

              <MDTypography variant="caption" color="text">
                (행 클릭하면 아래에 월별 추이 표시)
              </MDTypography>
            </Box>
          </Grid>

          {/* 히트맵 */}
          <Grid item xs={12}>
            <Box sx={{ border: HM_BORDER, borderRadius: 2, p: 0, overflowX: "auto", background: "#fff" }}>
              {/* 헤더 */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "260px repeat(12, 84px) 110px",
                  fontSize: 12,
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "#f7f7f7",
                  borderBottom: HM_BORDER,
                }}
              >
                <Box sx={{ p: 1, fontWeight: 700, borderRight: HM_BORDER }}>거래처</Box>
                {Array.from({ length: 12 }, (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1,
                      textAlign: "center",
                      fontWeight: 700,
                      borderRight: HM_BORDER,
                    }}
                  >
                    {i + 1}월
                  </Box>
                ))}
                <Box sx={{ p: 1, textAlign: "center", fontWeight: 700 }}>합계</Box>
              </Box>

              {/* 바디 */}
              <Box sx={{ maxHeight: "30vh", overflowY: "auto" }}>
                {filteredRows.map((r, rowIdx) => (
                  <Box
                    key={r.name}
                    onClick={() => setSelectedVendor(r)}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "260px repeat(12, 84px) 110px",
                      fontSize: 12,
                      cursor: "pointer",
                      borderBottom: rowIdx === filteredRows.length - 1 ? "none" : HM_BORDER,
                      background: "#fff",
                    }}
                  >
                    {/* 거래처 */}
                    <Box
                      sx={{
                        p: 1,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        borderRight: HM_BORDER,
                        background: selectedVendor?.name === r.name ? "#fff3e6" : "#fff",
                      }}
                      title={r.name}
                    >
                      {r.name}
                    </Box>

                    {/* 1~12월 */}
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const v = r[`m${m}`] ?? 0;

                      return (
                        <Box
                          key={m}
                          sx={{
                            p: 1,
                            textAlign: "right",
                            borderRight: HM_BORDER,
                            background: heatColor(v, maxCell),
                            color: v > 0 ? "#111" : "#777",
                          }}
                          title={`${r.name} / ${m}월: ${formatNumber(v)}`}
                        >
                          {v ? formatNumber(v) : ""}
                        </Box>
                      );
                    })}

                    {/* 합계 */}
                    <Box
                      sx={{
                        p: 1,
                        textAlign: "right",
                        fontWeight: 700,
                        background: heatColor(r.sum ?? 0, maxCell), // ✅ 합계도 색상(원하면 maxSum으로 바꿔도 됨)
                        color: (r.sum ?? 0) > 0 ? "#111" : "#777",
                      }}
                      title={`${r.name} 합계: ${formatNumber(r.sum)}`}
                    >
                      {r.sum ? formatNumber(r.sum) : ""}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* 선택 거래처 라인차트 */}
          <Grid item xs={12}>
            <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 1, height: 280, fontSize: 12 }}>
              <MDTypography variant="h6" sx={{ mb: 1 }}>
                {selectedVendor ? `${selectedVendor.name} 월별 매출 추이 (${year}년)` : "거래처를 클릭하면 월별 추이가 표시됩니다"}
              </MDTypography>

              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={selectedLineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatNumber(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="매출" dot={false} stroke="#FF5F00" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>
      )}
    </>
  );
}
