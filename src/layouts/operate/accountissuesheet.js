/* eslint-disable react/function-component-definition */
import React, { useMemo, useEffect, useState } from "react";
import { Grid, Box, Select, MenuItem, TextField, Pagination, Card } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Swal from "sweetalert2";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import useAccountIssueData, { formatNumber } from "./data/AccountIssueData";
import { sortAccountRows } from "utils/accountSort";

export default function AccountIssueSheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [editableRows, setEditableRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [page, setPage] = useState(1);
  // ✅ 거래처 검색 없는 표 화면용 정렬 기준(기본: 거래처명)
  const [accountSortKey, setAccountSortKey] = useState("account_name");
  const rowsPerPage = 10;

  const { accountIssueRows, loading, fetchAccountIssueList } = useAccountIssueData(year);

  // ✅ 조회
  useEffect(() => {
    fetchAccountIssueList();
  }, [year]);

  /**
   * ✅ month 필드 정규화
   * 서버에서 month_1이 문자열(note)로 오든, 객체({note,solution,event_note})로 오든
   * 화면에서는 항상 객체 형태로 맞춤
   */
  const normalizeMonthValue = (v) => {
    if (!v) return { note: "", solution: "", event_note: "" };
    if (typeof v === "string") return { note: v, solution: "", event_note: "" };
    // 객체로 오는 경우(혹은 JSON 문자열로 오는 경우)도 대비
    if (typeof v === "object") {
      return {
        note: v.note || "",
        solution: v.solution || "",
        event_note: v.event_note || "",
      };
    }
    return { note: "", solution: "", event_note: "" };
  };

  // ✅ 원본/편집본 초기화 (깊은 복사 적용)
  useEffect(() => {
    const mapped = accountIssueRows.map((r) => {
      const monthObj = Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => {
          const key = `month_${i + 1}`;
          return [key, normalizeMonthValue(r[key])];
        })
      );
      return { ...r, ...monthObj };
    });

    setEditableRows(mapped);
    setOriginalRows(JSON.parse(JSON.stringify(mapped)));
  }, [accountIssueRows]);

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

  /**
   * ✅ 입력 변경
   * month_# 안의 note/solution/event_note 중 어떤 필드를 바꿨는지 field로 전달
   */
  const handleMonthFieldChange = (account_id, monthKey, field, value) => {
    setEditableRows((prev) =>
      prev.map((row) => {
        if (row.account_id !== account_id) return row;
        const prevMonth = row[monthKey] || { note: "", solution: "", event_note: "" };
        return {
          ...row,
          [monthKey]: {
            ...prevMonth,
            [field]: value,
          },
        };
      })
    );
  };

  // ✅ 변경된 행 추출
  const getModifiedRows = () => {
    const results = [];

    editableRows.forEach((row, i) => {
      const orig = originalRows[i];

      for (let m = 1; m <= 12; m++) {
        const key = `month_${m}`;
        const cur = row[key] || { note: "", solution: "", event_note: "" };
        const org = orig?.[key] || { note: "", solution: "", event_note: "" };

        // ✅ 3필드 중 하나라도 바뀌면 저장 대상으로
        if (
          (cur.note || "") !== (org.note || "") ||
          (cur.solution || "") !== (org.solution || "") ||
          (cur.event_note || "") !== (org.event_note || "")
        ) {
          results.push({
            account_id: row.account_id,
            year,
            month: m,
            type: 2,
            note: cur.note || "",
            solution: cur.solution || "",
            event_note: cur.event_note || "",
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
        data: modified,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        await fetchAccountIssueList();
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

  // ✅ 셀 크게 + 내부 3필드 보기 좋게
  const tableSx = {
    flex: 1,
    maxHeight: "75vh",
    overflow: "auto",
    "& table": {
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      borderCollapse: "separate",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "8px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "top",
      background: "#fff",
    },
    "& thead th": {
      position: "sticky",
      top: 0,
      background: "#f0f0f0",
      zIndex: 3,
    },
    "& td:first-of-type, & th:first-of-type": {
      position: "sticky",
      left: 0,
      background: "#f0f0f0",
      zIndex: 2,
      minWidth: 160,
      maxWidth: 220,
    },
    "& thead th:first-of-type": {
      zIndex: 4,
    },

    // ✅ 월 컬럼 폭/높이 크게
    "& th:not(:first-of-type), & td:not(:first-of-type)": {
      minWidth: 280, // 월 셀 가로 크게
    },
  };

  const labelSx = (changed) => ({
    fontSize: "11px",
    fontWeight: 700,
    textAlign: "left",
    mb: 0.5,
    color: changed ? "red" : "#555",
  });

  const inputSx = (changed) => ({
    width: "100%",
    "& .MuiInputBase-root": {
      fontSize: "12px",
    },
    "& textarea": {
      fontSize: "12px",
      padding: "6px",
      lineHeight: "1.25",
      color: changed ? "red" : "black",
    },
  });

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar title="📋 고객사 이슈 현황" />
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
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
              </Box>
              <MDButton variant="gradient" color="info" onClick={handleSave}>
                저장
              </MDButton>
            </MDBox>

            <Grid container spacing={2}>
              <Grid item xs={12}>
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

                              if (key === "account_name") {
                                return (
                                  <td key={key} onClick={() => setSelectedCustomer(row)}>
                                    {row[key]}
                                  </td>
                                );
                              }

                              if (key.startsWith("month_")) {
                                const cur = row[key] || { note: "", solution: "", event_note: "" };
                                const org = origRow?.[key] || {
                                  note: "",
                                  solution: "",
                                  event_note: "",
                                };

                                const changedNote = (cur.note || "") !== (org.note || "");
                                const changedSolution =
                                  (cur.solution || "") !== (org.solution || "");
                                const changedEvent =
                                  (cur.event_note || "") !== (org.event_note || "");

                                return (
                                  <td key={key}>
                                    {/* ✅ 이슈내용(note) */}
                                    <Box sx={{ mb: 1 }}>
                                      <Box sx={labelSx(changedNote)}>이슈내용</Box>
                                      <TextField
                                        variant="outlined"
                                        multiline
                                        minRows={5}
                                        maxRows={15}
                                        value={cur.note || ""}
                                        onChange={(e) =>
                                          handleMonthFieldChange(
                                            row.account_id,
                                            key,
                                            "note",
                                            e.target.value
                                          )
                                        }
                                        sx={inputSx(changedNote)}
                                      />
                                    </Box>

                                    {/* ✅ 해결방안(solution) */}
                                    <Box sx={{ mb: 1 }}>
                                      <Box sx={labelSx(changedSolution)}>해결방안</Box>
                                      <TextField
                                        variant="outlined"
                                        multiline
                                        minRows={5}
                                        maxRows={15}
                                        value={cur.solution || ""}
                                        onChange={(e) =>
                                          handleMonthFieldChange(
                                            row.account_id,
                                            key,
                                            "solution",
                                            e.target.value
                                          )
                                        }
                                        sx={inputSx(changedSolution)}
                                      />
                                    </Box>

                                    {/* ✅ 특이사항(event_note) */}
                                    <Box>
                                      <Box sx={labelSx(changedEvent)}>특이사항</Box>
                                      <TextField
                                        variant="outlined"
                                        multiline
                                        minRows={5}
                                        maxRows={15}
                                        value={cur.event_note || ""}
                                        onChange={(e) =>
                                          handleMonthFieldChange(
                                            row.account_id,
                                            key,
                                            "event_note",
                                            e.target.value
                                          )
                                        }
                                        sx={inputSx(changedEvent)}
                                      />
                                    </Box>
                                  </td>
                                );
                              }

                              // 그 외 숫자 등
                              return (
                                <td key={key} align="right">
                                  {formatNumber(row[key])}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>

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
          </Card>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}
