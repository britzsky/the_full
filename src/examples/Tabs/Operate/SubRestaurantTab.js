/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery } from "@mui/material";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import useSubRestaurantData from "./subRestaurantData"; // ✅ 수정된 훅 사용

function SubRestaurantTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { activeRows, setActiveRows, loading, fetcSubRestaurantList } = useSubRestaurantData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [regionFilter, setRegionFilter] = useState(""); // ✅ 지역 필터 상태
  // 식당별 비고 컬럼 표시 상태
  const [noteColumnOpen, setNoteColumnOpen] = useState({
    1: false,
    2: false,
    3: false,
    4: false,
  });

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

  // ✅ 초기 조회 + 지역 변경 시 재조회
  useEffect(() => {
    fetcSubRestaurantList(regionFilter);
  }, [regionFilter]);

  // ✅ activeRows → rows / originalRows 복사
  useEffect(() => {
    const deepCopy = activeRows.map((r) => ({ ...r }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
    // 조회된 비고 입력 여부에 따른 식당별 비고 컬럼 초기 표시 상태 
    setNoteColumnOpen({
      1: deepCopy.some((row) => String(row.sub_restaurant1_note ?? "").trim() !== ""),
      2: deepCopy.some((row) => String(row.sub_restaurant2_note ?? "").trim() !== ""),
      3: deepCopy.some((row) => String(row.sub_restaurant3_note ?? "").trim() !== ""),
      4: deepCopy.some((row) => String(row.sub_restaurant4_note ?? "").trim() !== ""),
    });
  }, [activeRows]);

  // ✅ 문자열 비교 시 공백 정규화
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  // ✅ 셀 변경 시 스타일 지정 (빨간색)
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 셀 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  };

  // 식당별 비고 컬럼 표시 상태 변경 함수
  const handleNoteColumnToggle = (restaurantIndex) => {
    setNoteColumnOpen((prev) => ({
      ...prev,
      [restaurantIndex]: !prev[restaurantIndex],
    }));
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

      const response = await api.post(`/Operate/AccountSubRestaurantSave`, modifiedRows, {
        headers: { "Content-Type": "application/json" },
      });

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
  const baseColumns = useMemo(
    () => [
      { header: "업장명", accessorKey: "account_name", size: 140 },
      { header: "주소", accessorKey: "account_address", size: 320 },
      { header: "이동급식", accessorKey: "move_lunch", size: 110 },
      { header: "연락처", accessorKey: "move_lunch_tel", size: 110 },
    ],
    []
  );

  // 식당별 하위 컬럼과 비고 데이터 키 목록
  const restaurantGroups = useMemo(
    () => [
      {
        index: 1,
        header: "식당1",
        nameKey: "sub_restaurant1",
        telKey: "sub_restaurant1_tel",
        noteKey: "sub_restaurant1_note",
      },
      {
        index: 2,
        header: "식당2",
        nameKey: "sub_restaurant2",
        telKey: "sub_restaurant2_tel",
        noteKey: "sub_restaurant2_note",
      },
      {
        index: 3,
        header: "식당3",
        nameKey: "sub_restaurant3",
        telKey: "sub_restaurant3_tel",
        noteKey: "sub_restaurant3_note",
      },
      {
        index: 4,
        header: "식당4",
        nameKey: "sub_restaurant4",
        telKey: "sub_restaurant4_tel",
        noteKey: "sub_restaurant4_note",
      },
    ],
    []
  );

  const columns = useMemo(
    () => [
      ...baseColumns,
      ...restaurantGroups.flatMap((group) => [
        { header: "이름", accessorKey: group.nameKey, size: 110 },
        { header: "연락처", accessorKey: group.telKey, size: 110 },
        ...(noteColumnOpen[group.index]
          ? [{ header: "비고", accessorKey: group.noteKey, size: 110 }]
          : []),
      ]),
    ],
    [baseColumns, restaurantGroups, noteColumnOpen]
  );

  // ✅ 테이블 스타일 (모바일 대응)
  const tableSx = {
    position: "relative",
    zIndex: 0,
    isolation: "isolate",
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content", // ✅ 화면보다 넓으면 가로 스크롤
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "4px",
      whiteSpace: "pre-wrap",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      zIndex: 3,
    },
    "& thead tr:first-of-type th": {
      top: 0, // 스크롤 박스 안에서 첫 번째 헤더 행을 상단에 고정
    },
    "& thead tr:nth-of-type(2) th": {
      top: isMobile ? 23 : 29, // 식당별 이름/연락처 헤더 행 위치
      zIndex: 2,
    },
    "& .sticky-account-name": {
      position: "sticky",
      left: 0,
      minWidth: baseColumns[0].size,
      width: baseColumns[0].size,
      backgroundColor: "#ffffff",
      zIndex: 1,
      boxShadow: "2px 0 0 #686D76",
    },
    "& thead .sticky-account-name": {
      backgroundColor: "#f0f0f0",
      zIndex: 4,
    },
    "& .restaurant-header-title": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "2px",
      minWidth: 0,
      cursor: "pointer",
      lineHeight: 1,
      verticalAlign: "middle",
    },
    "& .restaurant-header-title.open": {
      boxShadow: "0 2px 0 -1px currentColor",
    },
    "& .note-toggle-button": {
      cursor: "inherit",
      display: "inline-flex",
      alignItems: "center",
      lineHeight: 1,
      fontSize: isMobile ? "8px" : "10px",
      fontFamily: "inherit",
      fontWeight: "inherit",
      color: "inherit",
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 저장 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: isMobile ? "wrap" : "nowrap",
          // 모바일에서는 검색/버튼 영역도 본문과 함께 스크롤
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* ✅ 지역 선택 SelectBox */}
        <TextField
          select
          size="small"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          sx={{
            minWidth: isMobile ? 140 : 150,
            fontSize: isMobile ? "12px" : "14px",
          }}
          SelectProps={{ native: true }}
        >
          {regionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </TextField>

        <MDButton
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 80 : 100 }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 테이블 렌더링 */}
      <MDBox pt={0} pb={3} sx={tableSx}>
        {/* 타이틀 박스 필요하면 주석 해제 */}
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
              <th rowSpan={2} className="sticky-account-name" style={{ width: baseColumns[0].size }}>
                업장명
              </th>
              <th rowSpan={2} style={{ width: baseColumns[1].size }}>
                주소
              </th>
              <th rowSpan={2} style={{ width: baseColumns[2].size }}>
                이동급식
              </th>
              <th rowSpan={2} style={{ width: baseColumns[3].size }}>
                연락처
              </th>
              {restaurantGroups.map((group) => (
                <th key={group.index} colSpan={noteColumnOpen[group.index] ? 3 : 2}>
                  <span
                    role="button"
                    tabIndex={0}
                    className={`restaurant-header-title${noteColumnOpen[group.index] ? " open" : ""
                      }`}
                    title={`${group.header} 비고 컬럼 ${noteColumnOpen[group.index] ? "닫기" : "열기"}`}
                    onClick={() => handleNoteColumnToggle(group.index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNoteColumnToggle(group.index);
                      }
                    }}
                  >
                    {group.header}
                    <span className="note-toggle-button">
                      {noteColumnOpen[group.index] ? "▶" : "◀"}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {restaurantGroups.map((group) => (
                <React.Fragment key={group.index}>
                  <th style={{ width: 110 }}>이름</th>
                  <th style={{ width: 110 }}>연락처</th>
                  {noteColumnOpen[group.index] && <th style={{ width: 110 }}>비고</th>}
                </React.Fragment>
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
                      className={key === "account_name" ? "sticky-account-name" : undefined}
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
