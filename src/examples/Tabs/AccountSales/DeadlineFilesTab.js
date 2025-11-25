/* eslint-disable react/function-component-definition */
import React, { useMemo, useEffect, useState } from "react";
import { Grid, Box, Select, MenuItem, IconButton } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import { Download, Trash2 } from "lucide-react"; // 🔹 아이콘
import { API_BASE_URL } from "config";

// 🔹 데이터 훅 import
import useDeadlineFilesData, { formatNumber } from "./deadlineFilesData";

export default function DeadlineFilesTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [editableRows, setEditableRows] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const { deadlineFilesRows, loading, fetchDeadlineFilesList } = useDeadlineFilesData(year);

  useEffect(() => {
    fetchDeadlineFilesList();
  }, [year]);

  // ✅ 초기 데이터 매핑 (12개월 파일 컬럼 초기화)
  useEffect(() => {
    setEditableRows(
      deadlineFilesRows.map((r) => ({
        ...r,
        ...Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => [`month_${i + 1}`, r[`month_${i + 1}`] || null])
        ),
      }))
    );
  }, [deadlineFilesRows]);

  // ✅ 월별 파일 컬럼 생성
  const columns = useMemo(() => {
    const base = [{ header: "거래처", accessorKey: "account_name" }];
    const months = Array.from({ length: 12 }, (_, i) => ({
      header: `${i + 1}월`,
      accessorKey: `month_${i + 1}`,
    }));
    return [...base, ...months];
  }, []);

  // ✅ 파일 업로드
  const handleFileUpload = async (account_id, monthKey, file) => {
    if (!file) return;
    const monthNum = monthKey.replace("month_", "");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("account_id", account_id);
    formData.append("year", year);
    formData.append("month", monthNum);
    formData.append("file_yn", "Y");

    try {
      const res = await api.post(
        "/Account/AccountDeadlineFilesSave",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data.code === 200) {
        Swal.fire("업로드 완료", `${monthNum}월 첨부 완료`, "success");
        await fetchDeadlineFilesList();
      } else {
        Swal.fire("업로드 실패", "서버 응답 오류", "error");
      }
    } catch (err) {
      Swal.fire("업로드 실패", err.message, "error");
    }
  };

  // ✅ 파일 삭제
  const handleDelete = async (account_id, monthKey) => {
    const month = monthKey.replace("month_", ""); // ✅ key로부터 월 번호 추출
    const row = editableRows.find((r) => r.account_id === account_id);
    const filePath = row ? row[monthKey] : null; // ✅ 해당 셀의 파일 path 찾기

    if (!filePath) {
      Swal.fire("삭제 실패", "파일 경로를 찾을 수 없습니다.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: `${month}월 파일을 삭제할까요?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    try {
      // ✅ month, filePath 같이 전송
      const res = await api.delete("/Account/AccountDeadlineFilesDelete", {
        params: { account_id, year, month, filePath, file_yn:"N" },
      });

      if (res.data.code === 200) {
        Swal.fire("삭제 완료", `${month}월 파일 삭제됨`, "success");
        await fetchDeadlineFilesList();
      } else {
        Swal.fire("삭제 실패", res.data.message, "error");
      }
    } catch (err) {
      Swal.fire("삭제 실패", err.message, "error");
    }
  };

  const tableSx = {
    flex: 1,
    maxHeight: "70vh",
    overflowY: "auto",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "6px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 */}
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>
        <MDButton variant="gradient" color="info" onClick={fetchDeadlineFilesList}>
          새로고침
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
              거래처별 마감 파일 업로드 현황
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
                {editableRows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => {
                      const key = col.accessorKey;
                      const value = row[key];

                      if (key === "account_name") {
                        return (
                          <td
                            key={key}
                            style={{
                              cursor: "pointer",
                              backgroundColor:
                                selectedCustomer?.account_name === row.account_name
                                  ? "#ffe4e1"
                                  : "transparent",
                              fontWeight:
                                selectedCustomer?.account_name === row.account_name
                                  ? "bold"
                                  : "normal",
                            }}
                            onClick={() => setSelectedCustomer(row)}
                          >
                            {value}
                          </td>
                        );
                      }

                      // ✅ 파일 관련 셀
                      if (key.startsWith("month_")) {
                        return (
                          <td key={key}>
                            {value ? (
                              <Box
                                display="flex"
                                justifyContent="center"
                                alignItems="center"
                                gap={0.5} // 살짝 간격 조정
                                sx={{ height: "100%", verticalAlign: "middle" }}
                              >
                                {/* ✅ 다운로드 아이콘을 IconButton처럼 맞춤 */}
                                <IconButton
                                  size="small"
                                  color="success"
                                  component="a"
                                  href={`${API_BASE_URL}${value}`}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{
                                    padding: "3px",
                                    lineHeight: 0,
                                  }}
                                >
                                  <Download size={16} />
                                </IconButton>

                                <IconButton
                                  size="small"
                                  color="error"
                                  sx={{ padding: "3px", lineHeight: 0 }}
                                  onClick={() => handleDelete(row.account_id, key)}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Box>
                            ) : (
                              <input
                                type="file"
                                accept="*/*"
                                style={{ width: "95px", fontSize: "11px" }}
                                onChange={(e) =>
                                  handleFileUpload(row.account_id, key, e.target.files[0])
                                }
                              />
                            )}
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
                ))}
              </tbody>
            </table>
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
