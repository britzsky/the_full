/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import { Box, Grid, Select, MenuItem, TextField } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useProfitLossTableData, { formatNumber } from "./profitLossTableData";
import Swal from "sweetalert2";
import api from "api/api";

export default function ProfitLossTableTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // ✅ 조회된 값 + 변경 감지 버전
  const [editRows, setEditRows] = useState([]);

  const { profitLossTableRows, accountList, loading, fetchProfitLossTableList } =
    useProfitLossTableData(year, selectedAccountId);

  // ✅ 데이터 조회
  useEffect(() => {
    if (selectedAccountId) fetchProfitLossTableList(selectedAccountId);
  }, [year, selectedAccountId]);

  // ✅ 데이터 원본 저장
  useEffect(() => {
    if (profitLossTableRows.length > 0) {
      const cloned = profitLossTableRows.map((row) => ({
        ...row,
        _original: { ...row },
      }));
      setEditRows(cloned);
    }
  }, [profitLossTableRows]);

  // ✅ 계정 자동 선택
  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  // ✅ 입력 가능한 항목
  const editableFields = [
    "food_process",
    "dishwasher",
    "cesco",
    "water_puri",
    "etc_cost",
    "utility_bills",
    "duty_secure",
  ];

  // ✅ 숨길 컬럼
  const hiddenCols = ["주간일반", "주간직원"];

  // ✅ 특정 거래처
  const isHangyeol = selectedAccountId === "20250819193455";

  // ✅ 화면 헤더 구조
  const headers = [
    { group: "인원", cols: ["생계인원", "일반인원", "인원합계"] },
    {
      group: "매출",
      cols: ["생계비", "일반식대", "직원식대", "주간일반", "주간직원", "판장금", "매출소계"],
    },
    {
      group: "매입",
      cols: ["식자재", "음식물처리", "식기세척기", "세스코방제", "정수기", "기타경비", "매입소계"],
    },
    { group: "인건", cols: ["인건비정보", "파출비", "인건소계"] },
    { group: "간접", cols: ["수도광열비", "세금정보", "간접소계"] },
  ];

  // ✅ 컬럼 → DB 필드 매핑
  const fieldMap = {
    // 인원
    생계인원: { value: "living_estimate", ratio: "living_estimate_ratio" },
    일반인원: { value: "basic_estimate", ratio: "basic_estimate_ratio" },
    인원합계: { value: "estimate_total", ratio: "estimate_total_ratio" },
    // 매출
    생계비: { value: "living_cost", ratio: "living_ratio" },
    일반식대: { value: "basic_cost", ratio: "basic_ratio" },
    직원식대: { value: "employ_cost", ratio: "employ_ratio" },
    주간일반: { value: "daycare_cost", ratio: "daycare_ratio" },
    주간직원: { value: "daycare_emp_cost", ratio: "daycare_emp_ratio" },
    판장금: { value: "payback_price", ratio: "payback_ratio" },
    매출소계: { value: "sales_total", ratio: "sales_total_ratio" },
    // 매입
    식자재: { value: "food_cost", ratio: "food_ratio" },
    음식물처리: { value: "food_process", ratio: "food_trash_ratio" },
    식기세척기: { value: "dishwasher", ratio: "dishwasher_ratio" },
    세스코방제: { value: "cesco", ratio: "cesco_ratio" },
    정수기: { value: "water_puri", ratio: "water_ratio" },
    기타경비: { value: "etc_cost", ratio: "etc_ratio" },
    매입소계: { value: "purchase_total", ratio: "purchase_total_ratio" },
    // 인건
    인건비정보: { value: "person_cost", ratio: "person_ratio" },
    파출비: { value: "dispatch_cost", ratio: "dispatch_ratio" },
    인건소계: { value: "person_total", ratio: "person_total_ratio" },
    // 간접
    수도광열비: { value: "utility_bills", ratio: "utility_ratio" },
    세금정보: { value: "duty_secure", ratio: "duty_secure_ratio" },
    간접소계: { value: "indirect_total", ratio: "indirect_total_ratio" },
    // 영업이익
    영업이익: { value: "business_profit", ratio: "business_profit_ratio" },
  };

  // ✅ 숨겨진 컬럼 적용
  const filteredHeaders = headers.map((h) => ({
    ...h,
    cols: isHangyeol ? h.cols : h.cols.filter((col) => !hiddenCols.includes(col)),
  }));

  // ✅ 변경 저장
  const handleSave = async() => {
    // ✅ 1) 변경된 행만 필터
    const modifiedRows = editRows
      .map((row) => {
        // 변경된 필드만 추출
        const changedFields = {};
        editableFields.forEach((field) => {
          const original = Number(row._original[field] ?? 0);
          const current = Number(row[field] ?? 0);
          if (original !== current) {
            changedFields[field] = row[field]; // ✅ 달라졌으면 저장할 값만 담음
          }
        });

        // ✅ 필드가 1개라도 변경되었으면 account_id, month 포함해서 전송 준비
        if (Object.keys(changedFields).length > 0) {
          return {
            account_id: row.account_id,
            year: year,
            month: row.month,
            ...changedFields, // ✅ 변경된 값만 담기
          };
        }
        return null;
      })
      .filter((row) => row !== null);

    console.log("✅ 저장할 변경값만:", modifiedRows);

    if (modifiedRows.length === 0) {
      Swal.fire("변경된 내용이 없습니다.", "", "info");
      return;
    }

    // ✅ 2) 백엔드 저장 API 호출 (예시)
    try {
      await api.post("/HeadOffice/ProfitLossTableSave", { rows: modifiedRows });
      Swal.fire("변경 사항이 저장되었습니다.", "", "success");
      fetchProfitLossTableList();
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // ✅ 숫자 입력 핸들러 (콤마 제거 → 숫자 저장)
  const handleInputChange = (rowIdx, field, value) => {
    const numericValue =
      value === "" || value === null ? null : Number(value.replace(/,/g, ""));
    const newRows = [...editRows];
    newRows[rowIdx][field] = numericValue;
    setEditRows(newRows);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 저장 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}
      >
        {accountList.length > 0 && (
          <TextField
            select
            size="small"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            sx={{ minWidth: 150 }}
            SelectProps={{ native: true }}
          >
            {accountList.map((row) => (
              <option key={row.account_id} value={row.account_id}>
                {row.account_name}
              </option>
            ))}
          </TextField>
        )}

        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>

        <MDButton variant="contained" color="info" size="small" onClick={handleSave}>
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
          >
            <MDTypography variant="h6" color="white">
              월별 손익표
            </MDTypography>
          </MDBox>

          <Box
            sx={{
              overflowX: "auto",
              "& table": {
                borderCollapse: "collapse",
                width: "100%",
                minWidth: "1800px",
                borderSpacing: 0,
                borderCollapse: "separate",
                fontWeight: "bold"
              },
              "& th, & td": {
                border: "1px solid #686D76",
                textAlign: "center",
                fontSize: "12px",
                padding: "4px",
                borderRight: "1px solid #686D76",  /* ✅ 테두리 유지 */
                borderLeft: "1px solid #686D76",  /* ✅ 테두리 유지 */
              },
              "& th": {
                backgroundColor: "#f0f0f0",
              },
              /* ✅ 공통 Sticky 스타일 */
              ".sticky-col": {
                position: "sticky",
                left: 0,
                background: "#e8f0ff",  /* 헤더 배경 있으면 더 좋음 */
                zIndex: 2,
                /* ✅ 오른쪽 테두리 강조 (겹침 방지 핵심포인트!) */
                borderRight: "1px solid #686D76",
              },

              /* ✅ 헤더의 첫 번째 열은 가장 위에 위치해야 함 (z-index +1) */
              ".sticky-header": {
                zIndex: 3,
                background: "#e8f0ff",  /* 헤더 배경 있으면 더 좋음 */
                borderRight: "1px solid #686D76",  /* ✅ 테두리 유지 */
              },
            }}
          >
            <table>
              <thead>
                <tr>
                  <th className="sticky-col sticky-header" rowSpan={2}>월</th>
                  {filteredHeaders.map((h) => (
                    <th key={h.group} colSpan={h.cols.length}>
                      {h.group}
                    </th>
                  ))}
                  <th rowSpan={2}>영업이익</th>
                </tr>
                <tr>
                  {filteredHeaders.flatMap((h) =>
                    h.cols.map((c) => <th key={c}>{c}</th>)
                  )}
                </tr>
              </thead>

              <tbody>
                {editRows.map((r, i) => (
                  <React.Fragment key={i}>
                    {/* 1️⃣ 숫자 입력행 */}
                    <tr>
                      <td className="sticky-col" rowSpan={2} style={{ fontWeight: "bold", background: "#fafafa" }}>
                        {r.month}월
                      </td>

                      {filteredHeaders.flatMap((h) =>
                        h.cols.map((col) => {
                          const field = fieldMap[col]?.value;
                          const isEditable = editableFields.includes(field);
                          const originalValue = Number(r._original[field] ?? 0);
                          const currentValue = Number(r[field] ?? 0);
                          const isChanged = isEditable && originalValue !== currentValue;
                          
                          return (
                            <td key={col}>
                              {isEditable ? (
                                <input
                                  type="text"
                                  value={r[field] !== null && r[field] !== undefined ? formatNumber(r[field]) : ""}
                                  style={{
                                    width: "60px",
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "right",
                                    border: "none",
                                    background: "transparent",
                                    color: isChanged ? "red" : "black"
                                  }}
                                  onChange={(e) => handleInputChange(i, field, e.target.value)}
                                />
                              ) : (
                                formatNumber(r[field] ?? 0)
                              )}
                            </td>
                          );
                        })
                      )}

                      <td style={{ fontWeight: "bold", color: "#d32f2f" }}>
                        {formatNumber(r[fieldMap["영업이익"].value] ?? 0)}
                      </td>
                    </tr>

                    {/* 2️⃣ 비율행 */}
                    <tr>
                      {filteredHeaders.flatMap((h) =>
                        h.cols.map((col) => {
                          const ratioField = fieldMap[col]?.ratio;
                          const value = r[ratioField];
                          return (
                            <td key={`${col}_ratio`} style={{ fontSize: "11px", color: "#CD2C58" }}>
                              {value ? `${formatNumber(value)}%` : "-"}
                            </td>
                          );
                        })
                      )}
                      <td style={{ fontSize: "11px", color: "gray" }}>
                        {r[fieldMap["영업이익"].ratio]
                          ? `${formatNumber(r[fieldMap["영업이익"].ratio])}%`
                          : "-"}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
