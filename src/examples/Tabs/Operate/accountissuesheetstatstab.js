/* eslint-disable react/function-component-definition */
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Autocomplete, Box, Card, Grid, TextField } from "@mui/material";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import useAccountIssueSheetStatsTabData from "./accountissuesheetstatstabData";

// 파이 차트 컴포넌트에서 사용하는 요소 등록
ChartJS.register(ArcElement, Tooltip, Legend);

// 파이 차트 조각 색상 팔레트
const PIE_COLORS = [
  "#5e72e4",
  "#11cdef",
  "#2dce89",
  "#fb6340",
  "#f5365c",
  "#8965e0",
  "#ffd600",
  "#4a4a4a",
  "#66bb6a",
  "#ff8f00",
];

// 항목 수가 많을 때 상위 항목 + 기타로 압축
const compactRows = (rows, maxItems = 8) => {
  if (rows.length <= maxItems) return rows;
  const head = rows.slice(0, maxItems - 1);
  const tail = rows.slice(maxItems - 1);
  const etcCount = tail.reduce((sum, row) => sum + row.count, 0);
  return [...head, { label: "기타", count: etcCount }];
};

// 공통 파이 차트 카드(리스트 + 차트 동시 표시)
function PieStatCard({ title, rows, emptyText, onSelectRow, selectedRowKey }) {
  // 렌더 부하 완화를 위해 표시용 데이터는 메모이제이션
  const compacted = useMemo(() => compactRows(rows), [rows]);
  const selectable = typeof onSelectRow === "function";

  // 건수/비율 계산용 전체 합계
  const totalCount = useMemo(
    () => compacted.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [compacted]
  );

  // chart.js 입력 포맷 데이터 구성
  const chartData = useMemo(
    () => ({
      labels: compacted.map((row) => row.label),
      datasets: [
        {
          data: compacted.map((row) => row.count),
          backgroundColor: compacted.map((_, idx) => PIE_COLORS[idx % PIE_COLORS.length]),
          borderColor: "#ffffff",
          borderWidth: 1,
        },
      ],
    }),
    [compacted]
  );

  // 차트 클릭/툴팁 동작 설정
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_, elements) => {
        if (!selectable || !elements?.length) return;
        const picked = compacted[elements[0]?.index];
        if (!picked?.key) return;
        onSelectRow(picked);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = compacted.reduce((sum, row) => sum + row.count, 0);
              const value = Number(ctx.raw || 0);
              const ratio = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${ctx.label}: ${value}건 (${ratio}%)`;
            },
          },
        },
      },
    }),
    [compacted, selectable, onSelectRow]
  );

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={2}>
        <MDTypography variant="h6" fontSize="0.95rem" mb={1}>
          {title}
        </MDTypography>

        {rows.length === 0 ? (
          <MDBox
            sx={{
              height: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed #d7dee8",
              borderRadius: 1,
              color: "#7b809a",
              fontSize: 13,
            }}
          >
            {emptyText}
          </MDBox>
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
                <MDTypography variant="caption" sx={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>
                  항목
                </MDTypography>
                <MDTypography variant="caption" sx={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>
                  건수(비율)
                </MDTypography>
              </Box>

              {compacted.map((row, idx) => {
                const ratio = totalCount > 0 ? ((row.count / totalCount) * 100).toFixed(1) : "0.0";
                const isClickable = selectable && Boolean(row?.key);
                const isSelected = Boolean(selectedRowKey) && row?.key === selectedRowKey;

                return (
                  <Box
                    key={`${row.label}_${idx}`}
                    onClick={() => {
                      if (!isClickable) return;
                      onSelectRow(row);
                    }}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 0.5,
                      px: 0.5,
                      borderRadius: 0.75,
                      borderBottom: "1px dashed #f0f2f5",
                      backgroundColor: isSelected ? "#eef4ff" : "transparent",
                      cursor: isClickable ? "pointer" : "default",
                    }}
                  >
                    <MDBox sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: PIE_COLORS[idx % PIE_COLORS.length],
                          flex: "0 0 10px",
                        }}
                      />
                      <MDTypography
                        variant="caption"
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
                      </MDTypography>
                    </MDBox>

                    <MDTypography
                      variant="caption"
                      sx={{ fontSize: 12, fontWeight: 700, color: "#344767", ml: 1, flexShrink: 0 }}
                    >
                      {row.count}건 ({ratio}%)
                    </MDTypography>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ width: "52%", minWidth: 0 }}>
              <Pie data={chartData} options={chartOptions} />
            </Box>
          </Box>
        )}
      </MDBox>
    </Card>
  );
}

// 공통 차트 카드 prop 타입 정의
PieStatCard.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  ).isRequired,
  emptyText: PropTypes.string.isRequired,
  onSelectRow: PropTypes.func,
  selectedRowKey: PropTypes.string,
};

// 공통 차트 카드 기본 prop
PieStatCard.defaultProps = {
  onSelectRow: null,
  selectedRowKey: "",
};

export default function AccountIssueSheetStatsTab() {
  // 운영팀(team_code=1) 통계 데이터/필터 상태 훅(del_yn='N' 기준 집계)
  const {
    loading,
    selectedAccountKey,
    setSelectedAccountKey,
    selectedAccountName,
    selectedAccountOption,
    accountStats,
    overallTypeStats,
    overallResultStats,
    selectedAccountStats,
    selectedTypeStats,
    selectedResultStats,
  } = useAccountIssueSheetStatsTabData(1);

  // 데이터 초기 조회 전 로딩 화면
  if (loading) return <LoadingScreen />;

  return (
    <MDBox>
      {/* 상단 제목 영역 */}
      <MDBox
        mb={2}
        sx={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <MDTypography variant="h6">이슈 통계</MDTypography>
      </MDBox>

      {/* 전체 기준 통계 3종(거래처/구분/해결) */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <PieStatCard
            title="전체 거래처별 통계"
            rows={accountStats.map((row) => ({ key: row.key, label: row.accountName, count: row.count }))}
            emptyText="통계 데이터가 없습니다."
            onSelectRow={(row) => setSelectedAccountKey(row?.key || "")}
            selectedRowKey={selectedAccountKey}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard title="전체 구분별 통계" rows={overallTypeStats} emptyText="통계 데이터가 없습니다." />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard title="전체 해결별 통계" rows={overallResultStats} emptyText="통계 데이터가 없습니다." />
        </Grid>
      </Grid>

      {/* 선택 거래처 필터 + 선택 대상 제목 */}
      <MDBox
        mt={3}
        mb={2}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <MDTypography variant="h6" fontSize="0.95rem">
          {selectedAccountName ? `${selectedAccountName} 통계` : "거래처 선택 통계"}
        </MDTypography>

        <Autocomplete
          size="small"
          options={accountStats}
          value={selectedAccountOption}
          onChange={(_, newValue) => setSelectedAccountKey(newValue?.key || "")}
          getOptionLabel={(option) => option?.accountName || ""}
          filterOptions={(options, { inputValue }) => {
            const keyword = String(inputValue || "").trim().toLowerCase();
            if (!keyword) return options;
            return options.filter(
              (row) =>
                String(row?.accountName || "").toLowerCase().includes(keyword) ||
                String(row?.accountId || "").toLowerCase().includes(keyword)
            );
          }}
          isOptionEqualToValue={(option, value) => option?.key === value?.key}
          sx={{ minWidth: 320, background: "#fff" }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 선택"
              placeholder="거래처 검색"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();

                const keyword = String(e.currentTarget.value || "").trim().toLowerCase();
                if (!keyword) return;

                const exact = accountStats.find(
                  (row) =>
                    String(row.accountName || "").trim().toLowerCase() === keyword ||
                    String(row.accountId || "").trim().toLowerCase() === keyword
                );

                const partial = accountStats.find(
                  (row) =>
                    String(row.accountName || "").toLowerCase().includes(keyword) ||
                    String(row.accountId || "").toLowerCase().includes(keyword)
                );

                const picked = exact || partial;
                if (!picked) return;

                setSelectedAccountKey(picked.key);
                e.currentTarget.blur();
              }}
            />
          )}
        />
      </MDBox>

      {/* 선택 거래처 기준 통계 3종 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <PieStatCard
            title={selectedAccountName ? `${selectedAccountName} 이슈 총계` : "선택 거래처별 이슈 총계"}
            rows={selectedAccountStats}
            emptyText="거래처를 선택하면 통계가 표시됩니다."
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard
            title={selectedAccountName ? `${selectedAccountName} 구분별 통계` : "선택 구분별 통계"}
            rows={selectedTypeStats}
            emptyText="거래처를 선택하면 구분 통계가 표시됩니다."
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard
            title={selectedAccountName ? `${selectedAccountName} 해결별 통계` : "선택 해결별 통계"}
            rows={selectedResultStats}
            emptyText="거래처를 선택하면 해결 통계가 표시됩니다."
          />
        </Grid>
      </Grid>
    </MDBox>
  );
}
