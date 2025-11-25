/* eslint-disable react/function-component-definition */
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Select, MenuItem } from "@mui/material";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import useDinersNumbersheetData, { parseNumber, formatNumber } from "./dinersNumbersheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import { useLocation } from "react-router-dom";

function DinersNumberSheet() {

  // ✅ localStorage 에서 account_id 가져오기
  const storedAccountId = localStorage.getItem("account_id") || "";

  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const { activeRows, setActiveRows, loading, fetchAllData, account_id } =
    useDinersNumbersheetData(storedAccountId, year, month);

  const [originalRows, setOriginalRows] = useState([]);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name");

  const numericCols = [
    "breakfast",
    "lunch",
    "dinner",
    "ceremony",
    "daycare_lunch",
    "daycare_diner",
    "employ",
    "total",
  ];

  // ✅ 초기 데이터 동기화 (수정됨)
  useEffect(() => {
    if (loading || !account_id) return;

    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();

    // 한 달 전체 기본 구조
    const baseRows = Array.from({ length: daysInMonth }, (_, i) => ({
      diner_date: dayjs(`${year}-${month}-${i + 1}`).toDate(),
      diner_year: year,
      diner_month: month,
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      ceremony: 0,
      daycare_lunch: 0,
      daycare_diner: 0,
      employ: 0,
      total: 0,
      note: "",
      breakfastcancel: "",
      lunchcancel: "",
      dinnercancel: "",
    }));

    // DB 데이터와 병합
    const merged = baseRows.map((base) => {
      const found = activeRows.find((item) => {
        const itemDate = dayjs(item.diner_date);
        return (
          itemDate.year() === year &&
          itemDate.month() + 1 === month &&
          itemDate.date() === dayjs(base.diner_date).date()
        );
      });
      return found
        ? { ...base, ...found, total: calculateTotal(found) }
        : { ...base, total: calculateTotal(base) };
    });

    setActiveRows(merged);
    setOriginalRows(merged);
  }, [account_id, loading, year, month]);

  // ✅ 2️⃣ originalRows는 최초 한 번만 복사
  useEffect(() => {
    if (!loading && activeRows.length > 0 && originalRows.length === 0) {
      setOriginalRows(activeRows.map((r) => ({ ...r })));
    }
  }, [loading, activeRows]);

  // ✅ 합계 계산
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

  // ✅ 셀 변경
  const handleCellChange = (rowIndex, key, value) => {
    setActiveRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? { ...row, [key]: value, total: calculateTotal({ ...row, [key]: value }) }
          : row
      )
    );
  };

  // ✅ 스타일 비교 (RetailBusinessTab 방식)
  const normalize = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v);
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (numericCols.includes(key)) {
      return Number(original ?? 0) !== Number(value ?? 0)
        ? { color: "red" }
        : { color: "black" };
    }
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    const modified = activeRows.filter((r, idx) =>
      Object.keys(r).some((key) => normalize(r[key]) !== normalize(originalRows[idx]?.[key]))
    );

    if (modified.length === 0) {
      Swal.fire("안내", "변경된 데이터가 없습니다.", "info");
      return;
    }

    const payload = modified.map((row) => ({
      ...row,
      account_id,
      diner_year: year,
      diner_month: month,
      diner_date: dayjs(row.diner_date).format("DD"),
    }));

    try {
      const res = await api.post(
        "/Operate/AccountDinnersNumberSave",
        payload
      );
      if (res.data.code === 200) {
        Swal.fire("성공", "저장되었습니다.", "success");
        await fetchAllData();
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
        {/* ✅ 상단 컨트롤 */}
        <MDBox pt={1} pb={1} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Select value={year} onChange={(e) => setYear(e.target.value)} size="small">
            {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
                <MenuItem key={y} value={y}>
                {y}년
                </MenuItem>
            ))}
            </Select>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} size="small">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MenuItem key={m} value={m}>
                {m}월
                </MenuItem>
            ))}
            </Select>
            <MDButton variant="gradient" color="info" onClick={handleSave}>
            저장
            </MDButton>
        </MDBox>

        {/* ✅ 본문 테이블 */}
        <MDBox pt={1} pb={3}>
            <Grid container spacing={6}>
            <Grid item xs={12}>
                <Card sx={{ height: "calc(95vh - 160px)", display: "flex", flexDirection: "column" }}>
                {/* ✅ 헤더 영역 */}
                {/* <MDBox
                    mx={0}
                    mt={-3}
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
                    식수현황 (업장명 : {account_name || "미지정"})
                    </MDTypography>
                </MDBox> */}

                {/* ✅ 테이블 스타일 (디자인 유지) */}
                <MDBox
                    pt={0}
                    sx={{
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
                        padding: "4px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        width: "8%"
                    },
                    "& th": {
                        backgroundColor: "#f0f0f0",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                    }
                  }}
                >
                    <table className="dinersheet-table">
                    <thead>
                        <tr>
                        <th>구분</th>
                        <th>조식</th>
                        <th>중식</th>
                        <th>석식</th>
                        <th>경관식</th>
                        <th>데이케어 점심</th>
                        <th>데이케어 석식</th>
                        <th>직원</th>
                        <th>계</th>
                        <th>비고</th>
                        <th>조식취소</th>
                        <th>중식취소</th>
                        <th>석식취소</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            <td>{dayjs(row.diner_date).format("YYYY-MM-DD")}</td>

                            {[
                            "breakfast",
                            "lunch",
                            "dinner",
                            "ceremony",
                            "daycare_lunch",
                            "daycare_diner",
                            "employ",
                            "total",
                            "note",
                            "breakfastcancel",
                            "lunchcancel",
                            "dinnercancel",
                            ].map((key) => {
                            const editable = !["total", "diner_date"].includes(key);
                            const value = row[key] ?? "";
                            const isNumeric = numericCols.includes(key);
                            const style = getCellStyle(rowIndex, key, value);

                            return (
                                <td
                                key={key}
                                contentEditable={editable}
                                suppressContentEditableWarning
                                style={{ ...style, width: "80px" }}
                                onBlur={(e) => {
                                    let newValue = e.target.innerText.trim();
                                    if (isNumeric) newValue = parseNumber(newValue);
                                    handleCellChange(rowIndex, key, newValue);
                                    if (isNumeric)
                                    e.currentTarget.innerText = formatNumber(newValue);
                                }}
                                >
                                {isNumeric ? formatNumber(value) : value}
                                </td>
                            );
                            })}
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </MDBox>
                </Card>
            </Grid>
            </Grid>
        </MDBox>
    </>
  );
}

export default DinersNumberSheet;
