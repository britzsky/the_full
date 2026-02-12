/* eslint-disable react/function-component-definition */
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Box, Grid, Select, MenuItem, TextField, Autocomplete } from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useProfitLossTableData, { formatNumber } from "./profitLossTableData";
import Swal from "sweetalert2";
import api from "api/api";

export default function ProfitLossTableTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const didSetDefaultAccountRef = useRef(false);

  // ✅ 조회된 값 + 변경 감지 버전
  const [editRows, setEditRows] = useState([]);

  const { profitLossTableRows, accountList, loading, fetchProfitLossTableList } =
    useProfitLossTableData(year, selectedAccountId);

  // ✅ "전체" 옵션 포함한 거래처 옵션 리스트
  const accountOptions = useMemo(() => {
    const allOption = { account_id: "ALL", account_name: "전체" };
    return [allOption, ...(accountList || [])];
  }, [accountList]);

  // ✅ 실제 조회에 사용할 account_id (전체면 빈값으로 넘김)
  const queryAccountId = useMemo(() => {
    return selectedAccountId === "ALL" ? "" : selectedAccountId;
  }, [selectedAccountId]);

  // ✅ 데이터 조회 (전체 포함)
  useEffect(() => {
    // "ALL"도 truthy라서 여기서 걸리긴 하지만, 안전하게 queryAccountId로 통일
    if (selectedAccountId) fetchProfitLossTableList(queryAccountId);
  }, [year, selectedAccountId, queryAccountId]);

  // ✅ 데이터 원본 저장
  useEffect(() => {
    if (profitLossTableRows.length > 0) {
      const cloned = profitLossTableRows.map((row) => ({
        ...row,
        _original: { ...row },
      }));
      setEditRows(cloned);
    } else {
      setEditRows([]);
    }
  }, [profitLossTableRows]);

  // ✅ 계정 자동 선택
  useEffect(() => {
    if (selectedAccountId) {
      didSetDefaultAccountRef.current = true;
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (didSetDefaultAccountRef.current) return;
    if (accountList.length > 0 && !selectedAccountId) {
      // ✅ 기존 유지: 첫 거래처 자동 선택
      // (원하면 여기서 "ALL"로 바꾸면 최초 화면이 전체조회로 시작함)
      setSelectedAccountId(accountList[0].account_id);
      didSetDefaultAccountRef.current = true;
    }
  }, [accountList, selectedAccountId]);

  // ✅ Autocomplete에서 선택된 객체 (전체 옵션 포함)
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (accountOptions || []).find((a) => String(a.account_id) === String(selectedAccountId)) || null
    );
  }, [accountOptions, selectedAccountId]);

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;

    const list = accountOptions || []; // ✅ 전체 옵션 포함
    const qLower = q.toLowerCase();

    const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((a) =>
        String(a?.account_name || "")
          .toLowerCase()
          .includes(qLower)
      );

    if (partial) {
      setSelectedAccountId(partial.account_id);
      setAccountInput(partial.account_name || q);
    }
  }, [accountInput, accountOptions]);

  // ✅ 숫자 입력 가능한 항목
  const editableNumberFields = [
    "food_process",
    "dishwasher",
    "cesco",
    "water_puri",
    "etc_cost",
    "utility_bills",
    "duty_secure",
    "person_cost",
    "event_cost",
    "not_budget_cost",
    "etc_indirect_cost",
  ];

  // ✅ 텍스트 입력 가능한 항목
  const editableTextFields = ["utility_bills_note"];

  // ✅ 숨길 컬럼
  const hiddenCols = ["주간일반", "주간직원"];

  // ✅ 특정 거래처들(주간일반/주간직원 컬럼까지 보여줄 거래처)
  const HANGYEOL_ACCOUNT_IDS = new Set([
    "20250819193455",
    "20250819193504",
    "20250819193603",
    "20250919162439",
    "20250819193620",
    "20250819193632",
    "ALL",
  ]);

  // ✅ 전체("ALL")일 때는 false 처리됨
  const isHangyeol = HANGYEOL_ACCOUNT_IDS.has(String(selectedAccountId));

  // ✅ 화면 헤더 구조
  const headers = [
    { group: "인원", cols: ["생계인원", "일반인원", "인원합계"] },
    {
      group: "매출",
      cols: ["생계비", "일반식대", "직원식대", "주간일반", "주간직원", "판장금", "매출소계"],
    },
    {
      group: "매입",
      cols: [
        "식자재",
        "음식물처리",
        "식기세척기",
        "세스코방제",
        "정수기",
        "기타경비",
        "이벤트",
        "예산미발행",
        "매입소계",
      ],
    },
    { group: "인건", cols: ["인건비정보", "파출비", "인건소계"] },
    { group: "간접", cols: ["수도광열비", "비고", "세금정보", "기타간접비", "간접소계"] },
  ];

  // ✅ 컬럼 → DB 필드 매핑
  const fieldMap = {
    생계인원: { value: "living_estimate", ratio: "living_estimate_ratio" },
    일반인원: { value: "basic_estimate", ratio: "basic_estimate_ratio" },
    인원합계: { value: "estimate_total", ratio: "estimate_total_ratio" },
    생계비: { value: "living_cost", ratio: "living_ratio" },
    일반식대: { value: "basic_cost", ratio: "basic_ratio" },
    직원식대: { value: "employ_cost", ratio: "employ_ratio" },
    주간일반: { value: "daycare_cost", ratio: "daycare_ratio" },
    주간직원: { value: "daycare_emp_cost", ratio: "daycare_emp_ratio" },
    판장금: { value: "payback_price", ratio: "payback_ratio" },
    매출소계: { value: "sales_total", ratio: "sales_total_ratio" },
    식자재: { value: "food_cost", ratio: "food_ratio" },
    음식물처리: { value: "food_process", ratio: "food_trash_ratio" },
    식기세척기: { value: "dishwasher", ratio: "dishwasher_ratio" },
    세스코방제: { value: "cesco", ratio: "cesco_ratio" },
    정수기: { value: "water_puri", ratio: "water_ratio" },
    기타경비: { value: "etc_cost", ratio: "etc_ratio" },
    이벤트: { value: "event_cost", ratio: "event_ratio" },
    예산미발행: { value: "not_budget_cost" },
    매입소계: { value: "purchase_total", ratio: "purchase_total_ratio" },
    인건비정보: { value: "person_cost", ratio: "person_ratio" },
    파출비: { value: "dispatch_cost", ratio: "dispatch_ratio" },
    인건소계: { value: "person_total", ratio: "person_total_ratio" },
    수도광열비: { value: "utility_bills", ratio: "utility_ratio" },
    비고: { value: "utility_bills_note" },
    세금정보: { value: "duty_secure", ratio: "duty_secure_ratio" },
    기타간접비: { value: "etc_indirect_cost" },
    간접소계: { value: "indirect_total", ratio: "indirect_total_ratio" },
    영업이익: { value: "business_profit", ratio: "business_profit_ratio" },
  };

  // ✅ 숨겨진 컬럼 적용
  const filteredHeaders = headers.map((h) => ({
    ...h,
    cols: isHangyeol ? h.cols : h.cols.filter((col) => !hiddenCols.includes(col)),
  }));

  // ✅ 변경 저장
  const handleSave = async () => {
    const modifiedRows = editRows
      .map((row) => {
        const changedFields = {};

        editableNumberFields.forEach((field) => {
          const original = Number(row._original[field] ?? 0);
          const current = Number(row[field] ?? 0);
          if (original !== current) changedFields[field] = row[field];
        });

        editableTextFields.forEach((field) => {
          const original = String(row._original[field] ?? "").trim();
          const current = String(row[field] ?? "").trim();
          if (original !== current) changedFields[field] = row[field] ?? "";
        });

        if (Object.keys(changedFields).length > 0) {
          return {
            account_id: row.account_id,
            year: year,
            month: row.month,
            ...changedFields,
          };
        }
        return null;
      })
      .filter((row) => row !== null);

    if (modifiedRows.length === 0) {
      Swal.fire("변경된 내용이 없습니다.", "", "info");
      return;
    }

    try {
      await api.post("/HeadOffice/ProfitLossTableSave", { rows: modifiedRows });
      Swal.fire("변경 사항이 저장되었습니다.", "", "success");
      // ✅ 저장 후 재조회도 전체 반영
      fetchProfitLossTableList(queryAccountId);
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // ✅ 숫자 입력 핸들러 (콤마 제거 → 숫자 저장)
  const handleInputChange = (rowIdx, field, value) => {
    const newRows = [...editRows];

    if (editableTextFields.includes(field)) {
      newRows[rowIdx][field] = value;
    } else {
      const numericValue = value === "" || value === null ? null : Number(value.replace(/,/g, ""));
      newRows[rowIdx][field] = numericValue;
    }

    setEditRows(newRows);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox
        pt={1}
        pb={1}
        sx={{ display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}
      >
        {/* ✅ 거래처 검색 가능한 Autocomplete (전체 옵션 포함) */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccount}
          onChange={(_, newValue) => {
            // ✅ clear 되면 전체로
            setSelectedAccountId(newValue ? newValue.account_id : "ALL");
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => setAccountInput(newValue)}
          getOptionLabel={(option) => option?.account_name ?? ""}
          isOptionEqualToValue={(option, value) =>
            String(option.account_id) === String(value.account_id)
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectAccountByInput();
                }
              }}
            />
          )}
        />

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
          <Box
            sx={{
              maxHeight: "75vh",
              overflowY: "auto",
              "& table": {
                borderCollapse: "collapse",
                width: "100%",
                minWidth: "1800px",
                borderSpacing: 0,
                borderCollapse: "separate",
                fontWeight: "bold",
              },
              "& th, & td": {
                border: "1px solid #686D76",
                textAlign: "center",
                fontSize: "12px",
                padding: "4px",
                borderRight: "1px solid #686D76",
                borderLeft: "1px solid #686D76",
              },
              "& th": {
                backgroundColor: "#f0f0f0",
              },
              ".sticky-col": {
                position: "sticky",
                left: 0,
                background: "#e8f0ff",
                zIndex: 2,
                borderRight: "1px solid #686D76",
                width: "50px",
                minWidth: "50px",
                maxWidth: "50px",
              },
              ".sticky-header": {
                zIndex: 3,
                background: "#e8f0ff",
                borderRight: "1px solid #686D76",
              },
            }}
          >
            <table>
              <thead>
                <tr>
                  <th className="sticky-col sticky-header" rowSpan={2}>
                    월
                  </th>
                  {filteredHeaders.map((h) => (
                    <th key={h.group} colSpan={h.cols.length}>
                      {h.group}
                    </th>
                  ))}
                  <th rowSpan={2}>영업이익</th>
                </tr>
                <tr>{filteredHeaders.flatMap((h) => h.cols.map((c) => <th key={c}>{c}</th>))}</tr>
              </thead>

              <tbody>
                {editRows.map((r, i) => (
                  <React.Fragment key={i}>
                    {/* 1️⃣ 숫자 입력행 */}
                    <tr>
                      <td
                        className="sticky-col"
                        rowSpan={2}
                        style={{ fontWeight: "bold", background: "#fafafa" }}
                      >
                        {r.month}월
                      </td>

                      {filteredHeaders.flatMap((h) =>
                        h.cols.map((col) => {
                          const field = fieldMap[col]?.value;

                          const isText = editableTextFields.includes(field);
                          const isNumber = editableNumberFields.includes(field);

                          // 변경 여부 체크도 타입별로
                          const isChanged = (() => {
                            if (isText) {
                              const o = String(r._original[field] ?? "").trim();
                              const c = String(r[field] ?? "").trim();
                              return o !== c;
                            }
                            if (isNumber) {
                              const o = Number(r._original[field] ?? 0);
                              const c = Number(r[field] ?? 0);
                              return o !== c;
                            }
                            return false;
                          })();

                          return (
                            <td key={col}>
                              {isText ? (
                                <input
                                  type="text"
                                  value={r[field] ?? ""}
                                  style={{
                                    width: "120px", // ✅ 텍스트는 좀 넓게
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "left", // ✅ 텍스트는 좌측 정렬 추천
                                    border: "none",
                                    background: "transparent",
                                    color: isChanged ? "red" : "black",
                                  }}
                                  onChange={(e) => handleInputChange(i, field, e.target.value)}
                                />
                              ) : isNumber ? (
                                <input
                                  type="text"
                                  value={
                                    r[field] !== null && r[field] !== undefined
                                      ? formatNumber(r[field])
                                      : ""
                                  }
                                  style={{
                                    width: "80px",
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "right",
                                    border: "none",
                                    background: "transparent",
                                    color: isChanged ? "red" : "black",
                                  }}
                                  onChange={(e) => handleInputChange(i, field, e.target.value)}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={formatNumber(r[field] ?? 0)}
                                  disabled
                                  style={{
                                    width: "80px", // ✅ 텍스트는 좀 넓게
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "right", // ✅ 텍스트는 좌측 정렬 추천
                                    border: "none",
                                    background: "transparent",
                                    WebkitTextFillColor: "inherit", // 크롬에서 disabled 회색 처리 방지
                                    opacity: 1, // disabled 기본 흐림 방지
                                  }}
                                ></input>
                                // ✅ 수정 불가 컬럼
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
