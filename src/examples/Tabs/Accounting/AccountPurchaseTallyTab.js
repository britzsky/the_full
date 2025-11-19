// src/layouts/account/AccountPurchaseTallyTab.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Grid,
  Box,
  TextField,
  MenuItem,
  Button,
  InputLabel,
  Select,
} from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";

function AccountPurchaseTallyTab() {
  // ✅ 조회조건 상태
  const [filters, setFilters] = useState({
    bizType: "1", // 사업장유형
    type: "1", // 타입
    fromDate: "",
    toDate: "",
    partner: "", // 거래처
    payType: "1", // 조회구분
  });

  const [partnerList, setPartnerList] = useState([]);
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 조회조건 변경
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ 조회 버튼 클릭
  const handleSearch = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      const res = await api.post("/Account/PurchaseTallyList", params);
      if (res.data.code === 200) {
        setRows(res.data.rows || []);
        setOriginalRows(res.data.rows || []);
        setPartnerList(res.data.partners || []);
      } else {
        Swal.fire("실패", "데이터 조회 실패", "error");
      }
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 변경 감지 스타일
  const normalize = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value);
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  };

  const tableSx = {
    flex: 1,
    minHeight: 0,
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#fef6e4",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='text'], & input[type='date']": {
      fontSize: "12px",
      padding: "4px",
      border: "none",
      background: "transparent",
      textAlign: "center",
    },
  };

  const columns = useMemo(
    () => [
      { header: "사업장", accessorKey: "biz_name", size: 120 },
      { header: "관리업장", accessorKey: "branch_name", size: 120 },
      { header: "날짜", accessorKey: "date", size: 100 },
      { header: "구분(소모품, 식재료)", accessorKey: "category", size: 150 },
      { header: "구매처", accessorKey: "vendor", size: 180 },
      { header: "공급가", accessorKey: "supply", size: 80 },
      { header: "부가세", accessorKey: "vat", size: 80 },
      { header: "금액", accessorKey: "amount", size: 80 },
      { header: "면세", accessorKey: "taxfree", size: 80 },
      { header: "합계", accessorKey: "total", size: 80 },
      { header: "증빙자료사진", accessorKey: "proof", size: 200 },
      { header: "기타", accessorKey: "note", size: 200 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 🔹 조회조건 영역 */}
      <MDBox display="flex" justifyContent="flex-end" alignItems="center" gap={2} my={1} mx={1}>
        <TextField select label="사업장 유형" size="small" onChange={handleFilterChange} sx={{ minWidth: 150 }} SelectProps={{ native: true }} value={filters.bizType}>
          <option value="1">법인</option>
          <option value="2">개인</option>
          <option value="3">신사업</option>
        </TextField>
        <TextField select label="타입" size="small" onChange={handleFilterChange} sx={{ minWidth: 150 }} SelectProps={{ native: true }} value={filters.type}>
          <option value="1">위탁급식</option>
          <option value="2">도소매</option>
          <option value="3">프랜차이즈</option>
          <option value="4">산업체</option>
        </TextField>

        <TextField
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(From)"
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(To)"
          InputLabelProps={{ shrink: true }}
        />
        <TextField select label="거래처" size="small" onChange={handleFilterChange} sx={{ minWidth: 150 }} SelectProps={{ native: true }} value={filters.partner}>
          {partnerList.length === 0 ? (
            <option value="0">조회 후 표시</option>
          ) : (
            partnerList.map((p) => (
              <option key={p.partner_id} value={p.partner_id}>
                {p.partner_name}
              </option>
            ))
          )}
        </TextField>
        <TextField select label="조회구분" size="small" onChange={handleFilterChange} sx={{ minWidth: 150 }} SelectProps={{ native: true }} value={filters.payType}>
          <option value="1">현금</option>
          <option value="2">카드</option>
        </TextField>
        <MDButton variant="gradient" color="info" onClick={handleSearch}>
          조회
        </MDButton>
        <MDButton variant="gradient" color="info">
          엑셀다운로드
        </MDButton>
        <MDButton variant="gradient" color="info">
          인쇄
        </MDButton>
      </MDBox>

      {/* 🔹 테이블 */}
      <MDBox pt={2} pb={3} sx={tableSx}>
        <MDBox
          mx={0}
          mt={-2}
          py={1}
          px={2}
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          coloredShadow="info"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <MDTypography variant="h6" color="white">
            매입 집계용
          </MDTypography>
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col) => {
                      const value = row[col.accessorKey] || "";
                      return (
                        <td
                          key={col.accessorKey}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            handleCellChange(rowIndex, col.accessorKey, e.target.innerText)
                          }
                          style={{
                            ...getCellStyle(rowIndex, col.accessorKey, value),
                            width: `${col.size}px`,
                          }}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default AccountPurchaseTallyTab;
