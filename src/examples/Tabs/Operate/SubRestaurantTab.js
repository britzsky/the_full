/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField } from "@mui/material";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import useSubRestaurantData from "./subRestaurantData"; // ✅ 수정된 훅 사용

function SubRestaurantTab() {
  const { activeRows, setActiveRows, loading, fetcSubRestaurantList } = useSubRestaurantData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [regionFilter, setRegionFilter] = useState(""); // ✅ 지역 필터 상태

  // ✅ 지역 목록 (value는 SQL LIKE 패턴)
  const regionOptions = [
    { label: "전체", value: "" },
    { label: "서울", value: "서울%" },
    { label: "부산", value: "부산%" },
    { label: "대구", value: "대구%" },
    { label: "인천", value: "인천%" },
    { label: "광주", value: "광주%" },
    { label: "대전", value: "대전%" },
    { label: "울산", value: "울산%" },
    { label: "세종", value: "세종%" },
    { label: "경기", value: "경기%" },
    { label: "강원", value: "강원%" },
    { label: "충북", value: "충북%" },
    { label: "충남", value: "충남%" },
    { label: "전북", value: "전북%" },
    { label: "전남", value: "전남%" },
    { label: "경북", value: "경북%" },
    { label: "경남", value: "경남%" },
    { label: "제주", value: "제주%" },
  ];

  // ✅ 초기 조회
  useEffect(() => {
    fetcSubRestaurantList(regionFilter);
  }, [regionFilter]);

  // ✅ activeRows → rows / originalRows 복사
  useEffect(() => {
    const deepCopy = activeRows.map((r) => ({ ...r }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
  }, [activeRows]);

  // ✅ 문자열 비교 시 공백 정규화
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  // ✅ 셀 변경 시 스타일 지정 (빨간색)
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 셀 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    try {
      const userId = localStorage.getItem("user_id");
      const modifiedRows = rows
        .map((row, idx) => {
          const original = originalRows[idx] || {};
          const isChanged = Object.keys(row).some((key) => {
            const origVal = original[key];
            const curVal = row[key];
            if (typeof origVal === "string" && typeof curVal === "string")
              return normalize(origVal) !== normalize(curVal);
            return origVal !== curVal;
          });
          return isChanged ? { ...row, user_id: userId } : null; // ✅ user_id 추가
        })
        .filter(Boolean);

      if (modifiedRows.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const response = await api.post(
        `/Operate/AccountSubRestaurantSave`,
        modifiedRows,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.code === 200) {
        Swal.fire("성공", "저장되었습니다.", "success");
        await fetcSubRestaurantList(regionFilter);
      } else {
        Swal.fire("실패", response.data.message || "저장 실패", "error");
      }
    } catch (err) {
      Swal.fire("오류", err.message || "저장 중 오류 발생", "error");
    }
  };

  // ✅ 테이블 컬럼 정의
  const columns = useMemo(
    () => [
      { header: "업장명", accessorKey: "account_name", size: 120 },
      { header: "주소", accessorKey: "account_address", size: 300 },
      { header: "이동급식", accessorKey: "move_lunch", size: 110 },
      { header: "연락처", accessorKey: "move_lunch_tel", size: 110 },
      { header: "식당1", accessorKey: "sub_restaurant1", size: 110 },
      { header: "연락처1", accessorKey: "sub_restaurant1_tel", size: 110 },
      { header: "식당2", accessorKey: "sub_restaurant2", size: 110 },
      { header: "연락처2", accessorKey: "sub_restaurant2_tel", size: 110 },
      { header: "식당3", accessorKey: "sub_restaurant3", size: 110 },
      { header: "연락처3", accessorKey: "sub_restaurant3_tel", size: 110 },
    ],
    []
  );

  // ✅ 테이블 스타일
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
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 130,
      zIndex: 10,
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 저장 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 2,
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* ✅ 지역 선택 SelectBox */}
        <TextField
          select
          size="small"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {regionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </TextField>

        <MDButton color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 테이블 렌더링 */}
      <MDBox pt={1} pb={3} sx={tableSx}>
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
        >
          <MDTypography variant="h6" color="white">
            서브식당 관리
          </MDTypography>
        </MDBox> */}

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
                  const key = col.accessorKey;
                  const value = row[key] ?? "";
                  const style = getCellStyle(rowIndex, key, value);
                  const nonEditable = ["account_id", "account_name", "account_address"];

                  return (
                    <td
                      key={key}
                      contentEditable={!nonEditable.includes(key)}
                      suppressContentEditableWarning
                      style={{ ...style, width: col.size }}
                      onBlur={(e) => {
                        if (!nonEditable.includes(key)) {
                          handleCellChange(rowIndex, key, e.target.innerText.trim());
                        }
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
      </MDBox>
    </>
  );
}

export default SubRestaurantTab;
