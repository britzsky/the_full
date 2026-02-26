/* eslint-disable react/function-component-definition */
import React, { useMemo, useEffect, useState } from "react";
import { Grid, Box, Select, MenuItem, TextField, Pagination } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import useDeadlineIssueData, { formatNumber } from "./deadlineIssueData";
import { sortAccountRows } from "utils/accountSort";

export default function DeadlineIssueTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [editableRows, setEditableRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [page, setPage] = useState(1);
  // ✅ 거래처 검색 없는 표 화면용 정렬 기준(기본: 거래처명)
  const [accountSortKey, setAccountSortKey] = useState("account_name");
  const rowsPerPage = 10;

  const { deadlineIssueRows, loading, fetchDeadlineIssueList } = useDeadlineIssueData(year);

  // ✅ 조회
  useEffect(() => {
    fetchDeadlineIssueList();
  }, [year]);

  // ✅ 원본/편집본 초기화 (깊은 복사 적용)
  useEffect(() => {
    const mapped = deadlineIssueRows.map((r) => ({
      ...r,
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`month_${i + 1}`, r[`month_${i + 1}`] || ""])
      ),
    }));
    setEditableRows(mapped);
    setOriginalRows(JSON.parse(JSON.stringify(mapped))); // ✅ 깊은 복사
  }, [deadlineIssueRows]);

  // ✅ 컬럼 구조
  const columns = useMemo(() => {
    const base = [{ header: "거래처", accessorKey: "account_name" }];
    const months = Array.from({ length: 12 }, (_, i) => ({
      header: `${i + 1}월`,
      accessorKey: `month_${i + 1}`,
    }));
    return [...base, ...months];
  }, []);

  // ✅ 화면 표시 순서만 정렬(저장 payload 생성 로직은 기존 유지)
  const sortedRows = useMemo(
    () => sortAccountRows(editableRows, { sortKey: accountSortKey, keepAllOnTop: true }),
    [editableRows, accountSortKey]
  );

  // ✅ 정렬 후에도 원본 비교가 깨지지 않도록 account_id 기준 맵 사용
  const originalRowByAccountId = useMemo(() => {
    const map = new Map();
    (originalRows || []).forEach((row) => {
      map.set(String(row?.account_id || ""), row);
    });
    return map;
  }, [originalRows]);

  // ✅ 입력 변경
  const handleChange = (account_id, key, value) => {
    setEditableRows((prev) =>
      prev.map((row) =>
        row.account_id === account_id ? { ...row, [key]: value } : row
      )
    );
  };

  // ✅ 변경된 행 추출
  const getModifiedRows = () => {
    const results = [];

    editableRows.forEach((row, i) => {
      const orig = originalRows[i];
      for (let m = 1; m <= 12; m++) {
        const key = `month_${m}`;
        if (row[key] !== orig[key]) {
          results.push({
            account_id: row.account_id,
            month: m, // ✅ 월 추가
            note: row[key] || "", // ✅ note 필드명으로 명확히 전달
            year: year,
            type: 1
          });
        }
      }
    });

    return results;
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    const modified = getModifiedRows();
    if (modified.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }
    try {
      const res = await api.post("/Account/AccountIssueSave", {
        data:modified,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        await fetchDeadlineIssueList();
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };


  // ✅ 페이징
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const tableSx = {
    flex: 1,
    maxHeight: "68vh",
    overflow: "auto",
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
      padding: "6px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "middle",
      background: "#fff", // ✅ 스크롤 시 깜빡임 방지
    },

    // ✅ 헤더 행 고정
    "& thead th": {
      position: "sticky",
      top: 0,
      background: "#f0f0f0",
      zIndex: 3,
    },

    // ✅ 거래처 열 고정
    "& td:first-of-type, & th:first-of-type": {
      position: "sticky",
      left: 0,
      background: "#f0f0f0",
      zIndex: 2,
    },

    // ✅ 교차 셀(맨 왼쪽 상단 헤더)은 최상단
    "& thead th:first-of-type": {
      zIndex: 4,
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 */}
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Select
            value={accountSortKey}
            onChange={(e) => setAccountSortKey(String(e.target.value))}
            size="small"
          >
            <MenuItem value="account_name">거래처명 정렬</MenuItem>
            <MenuItem value="account_id">거래처ID 정렬</MenuItem>
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
            {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
              <MenuItem key={y} value={y}>
                {y}년
              </MenuItem>
            ))}
          </Select>
          {/* <MDButton variant="gradient" color="info" onClick={fetchDeadlineIssueList}>
            새로고침
          </MDButton> */}
        </Box>

        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 메인 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <MDBox
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
              거래처별 마감 이슈 현황
            </MDTypography>
          </MDBox>

          <Box sx={tableSx}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => {
                  const origRow = originalRowByAccountId.get(String(row?.account_id || ""));

                  return (
                    <tr key={row.account_id || i}>
                      {columns.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key];
                        const orig = origRow?.[key];

                        if (key === "account_name") {
                          return (
                            <td
                              key={key}
                              onClick={() => setSelectedCustomer(row)}
                            >
                              {value}
                            </td>
                          );
                        }

                        if (key.startsWith("month_")) {
                          const color = value !== orig ? "red" : "black";
                          return (
                            <td key={key}>
                              <TextField
                                variant="outlined"
                                multiline
                                minRows={4}
                                maxRows={5}
                                value={value || ""}
                                onChange={(e) =>
                                  handleChange(row.account_id, key, e.target.value)
                                }
                                 sx={{
                                  width: "100%",
                                  height: "100%",
                                  "& textarea": {
                                    fontSize: "12px",
                                    color: value !== orig ? "red" : "black", // ✅ 여기서 색상 적용
                                    padding: "2px",
                                    lineHeight: "1.2",
                                  },
                                }}
                              />
                            </td>
                          );
                        }

                        return (
                          <td key={key} align="right">
                            {formatNumber(value)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          {/* ✅ 페이징 */}
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
              size="small"
            />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
