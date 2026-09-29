/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Grid, Card, TextField, useTheme, useMediaQuery } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useVendorTallySheetData, { parseNumber, formatNumber } from "./data/VendorTallySheetData";

// ✅ 구분(account_type) 표시 순서 - 요양원을 우선 노출
const ACCOUNT_TYPE_ORDER = ["요양원", "산업체", "학교", "도소매", "프랜차이즈"];

// ✅ 거래처별로 나눠 보여줄 매입처 구분 행
const VENDOR_ROWS = [
  { key: "wellstory", label: "삼성웰스토리" },
  { key: "awhome", label: "아워홈" },
  { key: "scenic", label: "경관식" },
];

export default function VendorTallySheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const { loading, accountList, vendorData, fetchData } = useVendorTallySheetData(year, month);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const daysInMonth = useMemo(
    () => dayjs(`${year}-${String(month).padStart(2, "0")}-01`).daysInMonth(),
    [year, month]
  );

  // ✅ account_id 기준 조회용 Map 변환
  const wellstoryMap = useMemo(
    () => new Map(vendorData.wellstory.map((r) => [String(r.account_id), r])),
    [vendorData.wellstory]
  );
  const awhomeMap = useMemo(
    () => new Map(vendorData.awhome.map((r) => [String(r.account_id), r])),
    [vendorData.awhome]
  );
  const scenicMap = useMemo(
    () => new Map(vendorData.scenic.map((r) => [String(r.account_id), r])),
    [vendorData.scenic]
  );
  const lunchAvgMap = useMemo(
    () => new Map(vendorData.lunchAvg.map((r) => [String(r.account_id), parseNumber(r.lunch_avg)])),
    [vendorData.lunchAvg]
  );

  const bucketByKey = { wellstory: wellstoryMap, awhome: awhomeMap, scenic: scenicMap };

  // ✅ account_type(구분) 기준으로 거래처 묶기 - 지점명 가나다순 정렬
  const groupedAccounts = useMemo(() => {
    const groups = new Map();
    (accountList || []).forEach((acc) => {
      const type = acc.account_type || "기타";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(acc);
    });
    groups.forEach((list) =>
      list.sort((a, b) => String(a.account_name ?? "").localeCompare(String(b.account_name ?? ""), "ko"))
    );
    const orderedTypes = [
      ...ACCOUNT_TYPE_ORDER.filter((t) => groups.has(t)),
      ...[...groups.keys()].filter((t) => !ACCOUNT_TYPE_ORDER.includes(t)),
    ];
    return orderedTypes.map((type) => ({ type, accounts: groups.get(type) }));
  }, [accountList]);

  // ✅ 금액 컬럼(일자/합계)은 고정폭 대신 내용 길이에 맞춰 자동으로 늘어나도록 처리
  const columns = [
    { key: "account_type", label: "구분", width: 80 },
    { key: "account_name", label: "업장명", width: 130 },
    { key: "diner_avg", label: "평균식수", width: 90 },
    { key: "vendor", label: "구분", width: 115 },
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      key: `day_${i + 1}`,
      label: `${i + 1}일`,
      isAmount: true,
    })),
    { key: "total", label: "합계", isAmount: true },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar title="🧾 거래처 집계표" />
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            <MDBox pt={2} pb={2} px={2} sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  select
                  size="small"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
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
                  onChange={(e) => setMonth(Number(e.target.value))}
                  sx={{ minWidth: isMobile ? 80 : 85 }}
                  SelectProps={{ native: true }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </TextField>
                <MDButton variant="gradient" color="info" size="small" onClick={() => fetchData()}>
                  새로고침
                </MDButton>
              </Box>
            </MDBox>

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
                      whiteSpace: "nowrap",
                      fontSize: "12px",
                      padding: "4px",
                    },
                    "& th": {
                      backgroundColor: "#f0f0f0",
                      color: "#344767",
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                    },
                    "& .total-row": { backgroundColor: "#FFE3A9", fontWeight: "bold" },
                  }}
                >
                  <table>
                    <colgroup>
                      {columns.map((col) => (
                        <col key={col.key} style={{ width: col.isAmount ? undefined : col.width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {columns.map((col, colIdx) => {
                          // ✅ 오른쪽 "구분"(벤더 구분) 헤더만 대각선으로 나눠 우상단 "날짜" / 좌하단 "거래처" 표시
                          if (col.key === "vendor") {
                            return (
                              <th
                                key={col.key}
                                style={{
                                  minWidth: col.width,
                                  padding: 0,
                                  backgroundColor: "#f0f0f0",
                                  position: "sticky",
                                  left: 220,
                                  zIndex: 3,
                                }}
                              >
                                <Box sx={{ position: "relative", width: "100%", height: 40 }}>
                                  <svg
                                    width="100%"
                                    height="100%"
                                    preserveAspectRatio="none"
                                    style={{ position: "absolute", top: 0, left: 0 }}
                                  >
                                    <line x1="0" y1="0" x2="100%" y2="100%" stroke="#686D76" strokeWidth="1" />
                                  </svg>
                                  <MDBox
                                    component="span"
                                    sx={{ position: "absolute", top: 2, right: 6, fontSize: 11 }}
                                  >
                                    날짜
                                  </MDBox>
                                  <MDBox
                                    component="span"
                                    sx={{ position: "absolute", bottom: 2, left: 6, fontSize: 11 }}
                                  >
                                    거래처
                                  </MDBox>
                                </Box>
                              </th>
                            );
                          }
                          return (
                            <th
                              key={col.key}
                              style={{
                                width: col.width,
                                minWidth: col.isAmount ? 65 : col.width,
                                ...(colIdx === 1 ? { position: "sticky", left: 0, zIndex: 3 } : {}),
                                ...(colIdx === 2 ? { position: "sticky", left: 130, zIndex: 3 } : {}),
                              }}
                            >
                              {col.label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedAccounts.flatMap(({ type, accounts }) =>
                        accounts.flatMap((acc) => {
                          const accountId = String(acc.account_id);
                          const dinerAvg = lunchAvgMap.get(accountId) || 0;

                          // ✅ 벤더별 일자 금액 + 거래처별 합계 계산
                          const vendorDayValues = {};
                          VENDOR_ROWS.forEach(({ key }) => {
                            const row = bucketByKey[key].get(accountId);
                            vendorDayValues[key] = Array.from({ length: daysInMonth }, (_, i) =>
                              parseNumber(row?.[`day_${i + 1}`])
                            );
                          });
                          const totalDayValues = Array.from({ length: daysInMonth }, (_, i) =>
                            VENDOR_ROWS.reduce((sum, { key }) => sum + vendorDayValues[key][i], 0)
                          );

                          const subRows = [
                            ...VENDOR_ROWS.map(({ key, label }) => ({ key, label, values: vendorDayValues[key] })),
                            { key: "total", label: "총액", values: totalDayValues, isTotal: true },
                          ];

                          return subRows.map((row, idx) => (
                            <tr key={`${accountId}_${row.key}`}>
                              {idx === 0 && (
                                <td rowSpan={subRows.length} style={{ backgroundColor: "#f0f0f0" }}>
                                  {type}
                                </td>
                              )}
                              {idx === 0 && (
                                <td
                                  rowSpan={subRows.length}
                                  style={{ position: "sticky", left: 0, backgroundColor: "#f0f0f0", zIndex: 1 }}
                                >
                                  {acc.account_name}
                                </td>
                              )}
                              {idx === 0 && (
                                <td
                                  rowSpan={subRows.length}
                                  style={{ position: "sticky", left: 130, backgroundColor: "#f0f0f0", zIndex: 1 }}
                                >
                                  {formatNumber(dinerAvg)}
                                </td>
                              )}
                              <td
                                className={row.isTotal ? "total-row" : undefined}
                                style={{
                                  position: "sticky",
                                  left: 220,
                                  zIndex: 1,
                                  backgroundColor: row.isTotal ? "#FFE3A9" : "#fff",
                                }}
                              >
                                {row.label}
                              </td>
                              {row.values.map((v, i) => (
                                <td
                                  key={`day_${i + 1}`}
                                  className={row.isTotal ? "total-row" : undefined}
                                  style={{ textAlign: "right" }}
                                >
                                  {v === 0 ? "" : formatNumber(v)}
                                </td>
                              ))}
                              <td
                                className={row.isTotal ? "total-row" : undefined}
                                style={{ textAlign: "right" }}
                              >
                                {formatNumber(row.values.reduce((sum, v) => sum + v, 0))}
                              </td>
                            </tr>
                          ));
                        })
                      )}
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
