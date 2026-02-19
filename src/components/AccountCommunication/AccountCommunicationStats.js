/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Autocomplete, Box, Card, Grid, TextField } from "@mui/material";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";

ChartJS.register(ArcElement, Tooltip, Legend);

// 통계 차트 공통 색상 팔레트
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

// AccountCommunicationTable 과 동일 캐시 키를 사용하여 초기 로딩 속도 개선
const ACCOUNT_CACHE_KEY = "account_communication_account_list_v1";
const TYPE_CACHE_KEY = (teamCode) => `account_communication_type_list_${teamCode}`;
const ROW_CACHE_KEY = (teamCode) => `account_communication_rows_${teamCode}`;

const readSessionCache = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (e) {
    return fallback;
  }
};

const writeSessionCache = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 캐시 저장 실패는 화면 동작에 영향 없도록 무시
  }
};

const normalizeResult = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s === "해결") return "2";
  if (s === "보류") return "1";
  return s;
};

const normalizeRow = (row) => ({
  idx: row.idx ?? null,
  account_id: row.account_id ? String(row.account_id) : "",
  account_name: row.account_name || "",
  type: row.type != null ? String(row.type) : "",
  result: normalizeResult(row.result),
  issue: row.issue || "",
});

const isResolved = (resultCode) => String(resultCode || "").trim() === "2";

// 파이 조각이 너무 많아지면 하위 항목을 "기타"로 묶어서 가독성 확보
const compactRows = (rows, maxItems = 8) => {
  if (rows.length <= maxItems) return rows;
  const head = rows.slice(0, maxItems - 1);
  const tail = rows.slice(maxItems - 1);
  const etcCount = tail.reduce((sum, row) => sum + row.count, 0);
  return [...head, { label: "기타", count: etcCount }];
};

function PieStatCard({ title, rows, emptyText, onSelectRow, selectedRowKey }) {
  const compacted = useMemo(() => compactRows(rows), [rows]);
  const selectable = typeof onSelectRow === "function";
  // 좌측 목록에서 퍼센트 계산용 전체합
  const totalCount = useMemo(
    () => compacted.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [compacted]
  );

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
        legend: {
          display: false,
        },
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
          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              height: 260,
            }}
          >
            {/* 좌측: 마우스 오버 없이 항상 보이는 수치 목록 */}
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

            {/* 우측: 원형 차트 */}
            <Box sx={{ width: "52%", minWidth: 0 }}>
              <Pie data={chartData} options={chartOptions} />
            </Box>
          </Box>
        )}
      </MDBox>
    </Card>
  );
}

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

PieStatCard.defaultProps = {
  onSelectRow: null,
  selectedRowKey: "",
};

export default function AccountCommunicationStats({ teamCode }) {
  // 원본 데이터
  const [rows, setRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [typeList, setTypeList] = useState([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState("");
  const [loading, setLoading] = useState(true);

  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((acc) => {
      map.set(String(acc.account_id), acc.account_name || "");
    });
    return map;
  }, [accountList]);

  const typeLabelById = useMemo(() => {
    const map = new Map();
    (typeList || []).forEach((row) => {
      map.set(String(row.idx), row.type || "");
    });
    return map;
  }, [typeList]);

  /*
    통계 집계 기준을 단일화하기 위해 각 행의 거래처 식별값을 정규화한다.
    account_id가 있으면 id 기준, 없으면 이름 기준으로 묶는다.
  */
  const normalizeAccountMeta = (row) => {
    const accountId = String(row.account_id || "").trim();
    const rowName = String(row.account_name || "").trim();
    const mappedName = accountNameById.get(accountId) || "";

    if (accountId) {
      return {
        key: `id:${accountId}`,
        accountId,
        accountName: mappedName || rowName || accountId,
      };
    }

    if (rowName) {
      return {
        key: `name:${rowName}`,
        accountId: "",
        accountName: rowName,
      };
    }

    return { key: "unassigned", accountId: "", accountName: "미지정" };
  };


  // 상단 3개 카드(전체 업장/구분/해결)는 항상 rows 전체를 기준으로 계산

  const accountStats = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row) => {
      const meta = normalizeAccountMeta(row);
      if (!map.has(meta.key)) {
        map.set(meta.key, { ...meta, count: 0 });
      }
      map.get(meta.key).count += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.accountName).localeCompare(String(b.accountName), "ko");
    });
  }, [rows, accountNameById]);

  // 전체 구분별 통계
  const overallTypeStats = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row) => {
      const typeCode = String(row.type || "").trim();
      const label = typeLabelById.get(typeCode) || typeCode || "미구분";
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, typeLabelById]);

  // 전체 해결/미해결 통계
  const overallResultStats = useMemo(() => {
    if (!rows.length) return [];
    const resolved = rows.filter((row) => isResolved(row.result)).length;
    const unresolved = rows.length - resolved;
    return [
      { label: "해결", count: resolved },
      { label: "미해결", count: unresolved },
    ];
  }, [rows]);

  /*
    하단 선택 통계는 selectedAccountKey 기준으로만 계산한다.
    거래처 검색/선택 또는 상단 "전체 업장별 통계" 카드 클릭으로 키가 변경된다.
  */
  const selectedRows = useMemo(() => {
    if (!selectedAccountKey) return [];
    return rows.filter((row) => normalizeAccountMeta(row).key === selectedAccountKey);
  }, [rows, selectedAccountKey, accountNameById]);

  const selectedAccountName = useMemo(() => {
    const found = accountStats.find((row) => row.key === selectedAccountKey);
    return found?.accountName || "";
  }, [accountStats, selectedAccountKey]);

  const selectedAccountOption = useMemo(
    () => accountStats.find((row) => row.key === selectedAccountKey) || null,
    [accountStats, selectedAccountKey]
  );

  // 선택 업장 구분별 통계
  const selectedTypeStats = useMemo(() => {
    const map = new Map();
    selectedRows.forEach((row) => {
      const typeCode = String(row.type || "").trim();
      const label = typeLabelById.get(typeCode) || typeCode || "미구분";
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedRows, typeLabelById]);

  // 선택 업장 해결/미해결 통계
  const selectedResultStats = useMemo(() => {
    if (!selectedRows.length) return [];
    const resolved = selectedRows.filter((row) => isResolved(row.result)).length;
    const unresolved = selectedRows.length - resolved;
    return [
      { label: "해결", count: resolved },
      { label: "미해결", count: unresolved },
    ];
  }, [selectedRows]);

  const selectedAccountStats = useMemo(() => {
    if (!selectedAccountName || !selectedRows.length) return [];
    return [{ label: selectedAccountName, count: selectedRows.length }];
  }, [selectedAccountName, selectedRows]);

  // 초기 렌더 시 캐시 데이터 선반영 -> 서버 재조회 순서로 동작한다.
  useEffect(() => {
    let mounted = true;

    const cachedAccounts = readSessionCache(ACCOUNT_CACHE_KEY, []);
    if (Array.isArray(cachedAccounts) && cachedAccounts.length) setAccountList(cachedAccounts);

    const cachedTypes = readSessionCache(TYPE_CACHE_KEY(teamCode), []);
    if (Array.isArray(cachedTypes) && cachedTypes.length) setTypeList(cachedTypes);

    const cachedRows = readSessionCache(ROW_CACHE_KEY(teamCode), []);
    if (Array.isArray(cachedRows) && cachedRows.length) {
      setRows(cachedRows.map(normalizeRow));
      setLoading(false);
    } else {
      setLoading(true);
    }

    const fetchAll = async () => {
      try {
        const [accountRes, typeRes, rowRes] = await Promise.all([
          api.get("/Account/AccountList", { params: { account_type: "0" } }),
          api.get("/Account/AccountCommunicationMappingList", { params: { team_code: teamCode } }),
          api.get("/Account/AccountCommunicationList", { params: { team_code: teamCode } }),
        ]);

        if (!mounted) return;

        const accountData = (accountRes.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        const typeData = (typeRes.data || []).map((item) => ({
          idx: item.idx,
          team_code: item.team_code,
          type: item.type,
        }));
        const rowData = (rowRes.data || []).map(normalizeRow);

        setAccountList(accountData);
        setTypeList(typeData);
        setRows(rowData);

        writeSessionCache(ACCOUNT_CACHE_KEY, accountData);
        writeSessionCache(TYPE_CACHE_KEY(teamCode), typeData);
        writeSessionCache(ROW_CACHE_KEY(teamCode), rowData);
      } catch (err) {
        console.error("AccountCommunicationStats 조회 실패:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, [teamCode]);

  // 업장 목록이 바뀌면 선택값이 유효한지 확인 후 기본값 보정
  useEffect(() => {
    if (!selectedAccountKey) return;
    if (!accountStats.length) {
      setSelectedAccountKey("");
      return;
    }
    if (accountStats.some((row) => row.key === selectedAccountKey)) return;
    setSelectedAccountKey("");
  }, [accountStats, selectedAccountKey]);

  if (loading) return <LoadingScreen />;

  return (
    <MDBox>
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

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <PieStatCard
            title="전체 업장별 통계"
            rows={accountStats.map((row) => ({
              key: row.key,
              label: row.accountName,
              count: row.count,
            }))}
            emptyText="통계 데이터가 없습니다."
            onSelectRow={(row) => setSelectedAccountKey(row?.key || "")}
            selectedRowKey={selectedAccountKey}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard
            title="전체 구분별 통계"
            rows={overallTypeStats}
            emptyText="통계 데이터가 없습니다."
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <PieStatCard
            title="전체 해결별 통계"
            rows={overallResultStats}
            emptyText="통계 데이터가 없습니다."
          />
        </Grid>
      </Grid>

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
          sx={{
            minWidth: 320,
            background: "#fff",
          }}
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

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <PieStatCard
            title={selectedAccountName ? `${selectedAccountName} 이슈 총계` : "선택 업장별 이슈 총계"}
            rows={selectedAccountStats}
            emptyText="거래처를 선택하면 업장 통계가 표시됩니다."
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

AccountCommunicationStats.propTypes = {
  teamCode: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};
