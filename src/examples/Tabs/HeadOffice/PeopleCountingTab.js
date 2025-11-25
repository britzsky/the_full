/* eslint-disable react/function-component-definition */
import React, { useMemo, useEffect, useState } from "react";
import { Grid, Box, Select, MenuItem } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import usePeopleCountingData, { formatNumber } from "./peopleCountingData";

export default function PeopleCountingTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1); // ✅ 현재 월

  const { peopleCountingRows, loading, fetchPeopleCountingList } =
    usePeopleCountingData(year, month);

  // ✅ 조회
  useEffect(() => {
    fetchPeopleCountingList();
  }, [year, month]);

  // ✅ 컬럼 구조
  const columns = useMemo(() => {
    const base = [{ header: "거래처", accessorKey: "account_name", width: "160px" }];
    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      width: "3%",
    }));
    return [...base, ...days];
  }, [year, month]);

  // ✅ 테이블 스타일
  const tableWrapperSx = {
    maxHeight: "75vh",
    overflowY: "auto",
  };

  const tableSx = {
    "& table": {
      borderCollapse: "separate", // ✅ 핵심
      width: "100%",
      borderSpacing: 0,
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
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: "12px",
      padding: "4px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
    },
  };


  // ✅ 증감 계산 함수
  const getChangeIndicator = (prev, curr) => {
    if (prev === "" || prev == null) return "-";
    if (curr === "" || curr == null) return "-";

    const diff = Number(curr) - Number(prev);
    if (diff > 0) return <span style={{ color: "red" }}>▲{diff}</span>;
    if (diff < 0) return <span style={{ color: "blue" }}>▼{Math.abs(diff)}</span>;
    return <span style={{ color: "gray" }}>-</span>;
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 */}
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <MDButton variant="gradient" color="info" sx={{ visibility: "hidden" }}>입금</MDButton>
        <MDButton variant="gradient" color="success" sx={{ visibility: "hidden" }}>저장</MDButton>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>{y}년</MenuItem>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} size="small">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>{m}월</MenuItem>
          ))}
        </Select>
      </MDBox>

      {/* 메인 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          {/* <MDBox
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            position="sticky"
            top={0}
            zIndex={3}
          >
            <MDTypography variant="h6" color="white">
              거래처별 일자별 인원 현황
            </MDTypography>
          </MDBox> */}
          <Box sx={tableWrapperSx}>
            <Box sx={tableSx}>
              <table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.accessorKey} style={{ width: col.width, minWidth: col.width }}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {peopleCountingRows.map((row, i) => (
                    <React.Fragment key={i}>
                      {/* 첫 번째 줄 - 인원 */}
                      <tr>
                        {columns.map((col, idx) => {
                          const key = col.accessorKey;

                          if (key === "account_name") {
                            return (
                              <td
                                key={key}
                                rowSpan={2} // ✅ 두 줄 병합
                                style={{
                                  width: col.width,
                                  minWidth: col.width,
                                  fontWeight: "bold",
                                  background: "#f9f9f9",
                                }}
                              >
                                {row[key]}
                              </td>
                            );
                          }

                          return (
                            <td key={key} style={{ width: col.width, minWidth: col.width }}>
                              {row[key] !== "" ? formatNumber(row[key]) : ""}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 두 번째 줄 - 증감 */}
                      <tr>
                        {columns.map((col, idx) => {
                          const key = col.accessorKey;
                          if (key === "account_name") return null; // ✅ 생략

                          if (idx === 1) {
                            return (
                              <td key={key} style={{ fontSize: "11px", color: "gray" }}>
                                -
                              </td>
                            );
                          }

                          const prevKey = columns[idx - 1].accessorKey;
                          return (
                            <td key={key} style={{ fontSize: "11px" }}>
                              {getChangeIndicator(row[prevKey], row[key])}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
