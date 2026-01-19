/* eslint-disable react/function-component-definition */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { Select, MenuItem, TextField, useMediaQuery, useTheme } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import useDinersNumbersheetData, { parseNumber, formatNumber } from "./data/DinersNumberSheetData";
import LoadingScreen from "../loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import "./dinersnumbersheet.css";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import { useParams } from "react-router-dom";

// 🔹 데이케어 컬럼이 보이는 account_id 목록 (기본 레이아웃용)
const DAYCARE_ACCOUNT_IDS = [
  "20250919162439",
  "20250819193615",
  "20250819193504",
  "20250819193455",
];

// 🔹 특수 배치가 필요한 account_id 목록 (colspan 레이아웃)
const SPECIAL_LAYOUT_IDS = [
  "20250819193620",
  "20250819193603",
  "20250819193502",
  "20250819193632",
  "20250819193523",
  "20250819193544",
  "20250819193634",
  "20250819193630",
  "20250819193610", // ✅ 추가(직원 3칸 구조)
];

// 🔹 숫자 컬럼 목록
const numericCols = [
  "breakfast",
  "lunch",
  "dinner",
  "ceremony",
  "ceremony2",
  "breakfast2",
  "lunch2",
  "dinner2",
  "daycare_breakfast",
  "daycare_lunch",
  "daycare_diner",
  "daycare_employ_breakfast",
  "daycare_employ_lunch",
  "daycare_employ_dinner",
  "daycare_elderly_lunch",
  "daycare_elderly_dinner",
  "employ",
  "employ_breakfast",
  "employ_lunch",
  "employ_dinner",
  "total",
  "extra_diet1_price",
  "extra_diet2_price",
  "extra_diet3_price",
  "extra_diet4_price",
  "extra_diet5_price",
];

// 🔹 학교 / 산업체 판별
const isSchoolAccount = (accountType) =>
  accountType === "학교" || accountType === "5" || accountType === 5;

const isIndustryAccount = (accountType) =>
  accountType === "산업체" || accountType === "4" || accountType === 4;

// ✅ 평균(있는 항목만)
// - "없으면 있는 항목들로 평균" 요구사항 반영 (0은 "없음"으로 취급)
const avgOfExisting = (...vals) => {
  let sum = 0;
  let cnt = 0;

  vals.forEach((v) => {
    const n = parseNumber(v);
    if (!Number.isNaN(n) && n > 0) {
      sum += n;
      cnt += 1;
    }
  });

  return cnt > 0 ? sum / cnt : 0;
};

// ✅ 합계 계산 (account_id 별 분기 포함)
const calculateTotal = (row, accountType, extraDietCols, accountId) => {
  const extras = Array.isArray(extraDietCols) ? extraDietCols : [];

  // =========================================================
  // ✅ account_id별 특수 합계 규칙
  // =========================================================

  // ✅ 20250819193617: (조식/중식/석식 평균(있는 항목만)) + 직원
  if (accountId === "20250819193617") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const employ = parseNumber(row.employ);
    return Math.round(avgMeals + employ);
  }

  // ✅ 20250819193620: 2층 주간보호(어르신) (조/중/석 평균(있는 항목만)) + 경관식
  // - 2층 주간보호(어르신) = daycare_breakfast/daycare_lunch/daycare_diner
  if (accountId === "20250819193620") {
    const avgMeals = avgOfExisting(row.daycare_breakfast, row.daycare_lunch, row.daycare_diner);
    const ceremony = parseNumber(row.ceremony);
    return Math.round(avgMeals + ceremony);
  }

  // ✅ 20250819193630: 평균값 + 2,3층 경관식 + 7층 경관식
  if (accountId === "20250819193630") {
    const avg23 = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const ceremony23 = parseNumber(row.ceremony);
    const ceremony7 = parseNumber(row.ceremony2);
    return Math.round(avg23 + ceremony23 + ceremony7);
  }

  // ✅ 20250919162439: (조/중/석 평균) + 데이케어 중식
  if (accountId === "20250919162439") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const daycareLunch = parseNumber(row.daycare_lunch);
    return Math.round(avgMeals + daycareLunch);
  }

  // =========================================================
  // 🏫 / 🏭 학교 & 산업체 공통
  // =========================================================
  if (isSchoolAccount(accountType) || isIndustryAccount(accountType)) {
    // ✅ 20250819193651 전용:
    // - TH에 "조식/중식*/석식"이 있을 때, (있는 값만) 평균을 계(total)에 사용
    // - "중식", "중식(간편식)"처럼 "중식"으로 시작하면 전부 중식으로 인식
    // - 그 외 extraDiet 컬럼들은 평균값에 더하지 않고 합산(otherSum)으로 더함
    if (accountId === "20250819193651") {
      const breakfastVal = parseNumber(row.breakfast);

      const lunchCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("중식"));
      const dinnerCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("석식"));

      // 중식/석식이 여러 개면(혹시라도) 해당 값들을 합산해서 한 끼 값으로 처리
      const lunchVal = lunchCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);
      const dinnerVal = dinnerCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);

      const avgMeals = avgOfExisting(breakfastVal, lunchVal, dinnerVal);
      return Math.round(avgMeals);
    }

    // - ✅ special_yn 노출은 테이블에서만 제어, 합계 로직은 기존 유지
    // - ✅ 20250819193651: 기본 칼럼을 중식(lunch) -> 조식(breakfast)로 사용(표시용)
    const mainKey = accountId === "20250819193651" ? "breakfast" : "lunch";
    const mainMeal = parseNumber(row[mainKey]);

    // 🏭 산업체 중, TH에 "간편식"/"석식" 이 있는 특수 케이스
    const hasSimpleMealCols = extras.some((col) =>
      ["간편식", "석식"].includes((col.name || "").trim())
    );

    if (isIndustryAccount(accountType) && hasSimpleMealCols) {
      const baseName = mainKey === "breakfast" ? "조식" : "중식";
      const baseNames = [baseName, "간편식(포케)", "석식"];

      const baseValues = [mainMeal];
      let otherSum = 0;

      extras.forEach((col) => {
        const name = (col.name || "").trim();
        const value = parseNumber(row[col.priceKey]);

        if (baseNames.includes(name)) baseValues.push(value);
        else otherSum += value;
      });

      const avgBase =
        baseValues.length > 0 ? baseValues.reduce((sum, v) => sum + v, 0) / baseValues.length : 0;

      return Math.round(avgBase + otherSum);
    }

    // 🏫 학교 + 일반 산업체 → "기본 + extraDiet 합"
    const extraSum = extras.reduce((sum, col) => sum + parseNumber(row[col.priceKey]), 0);
    return mainMeal + extraSum;
  }

  // =========================================================
  // 🧓 그 외(요양원 등) 기본 로직 유지
  // =========================================================
  const breakfast = parseNumber(row.breakfast);
  const lunch = parseNumber(row.lunch);
  const dinner = parseNumber(row.dinner);
  const ceremony = parseNumber(row.ceremony);

  const baseAvgMeals = (breakfast + lunch + dinner) / 3;
  const baseTotal = Math.round(baseAvgMeals + ceremony);

  let total = baseTotal;

  if (
    (accountType === "4" || accountType === "5" || accountType === 4 || accountType === 5) &&
    extras.length > 0
  ) {
    const extraSum = extras.reduce((sum, col) => sum + parseNumber(row[col.priceKey]), 0);
    total += extraSum;
  }

  return total;
};

// ✅ 비교용 공통 정규화 함수 (테이블용)
const normalizeValueForCompare = (key, value) => {
  if (numericCols.includes(key)) {
    if (value === null || value === undefined || value === "") return 0;
    const num = parseNumber(value);
    if (Number.isNaN(num)) return 0;
    return Number(num);
  }

  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  return value;
};

// 🔹 account_id + account_type 별 헤더 구조 + 컬럼 키 정의
const getTableStructure = (
  selectedAccountId,
  isDaycareVisible,
  extraDietCols,
  selectedAccountType
) => {
  const isSchoolOrIndustry = selectedAccountType === "학교" || selectedAccountType === "산업체";

  // ✅ 학교/산업체일 때만 특식여부(special_yn) 노출
  if (isSchoolOrIndustry) {
    const mainKey = selectedAccountId === "20250819193651" ? "breakfast" : "lunch";
    const mainLabel =
      selectedAccountId === "20250819193651"
        ? "조식"
        : selectedAccountType === "학교"
        ? "학생"
        : "중식";

    const baseColumns = [
      mainKey,
      "special_yn",
      ...extraDietCols.map((col) => col.priceKey),
      "total",
      "note",
    ];

    const headerRow = [
      { label: "구분" },
      { label: mainLabel },
      { label: "특식여부" },
      ...extraDietCols.map((col) => ({ label: col.name })),
      { label: "계" },
      { label: "비고" },
    ];

    return { headerRows: [headerRow], visibleColumns: baseColumns };
  }

  // =========================================================
  // 🔸 특수 배치 케이스들
  // =========================================================

  // ✅ 20250819193610: 직원 TH 아래 조/중/석(3칸) 노출
  if (selectedAccountId === "20250819193610") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "경관식", rowSpan: 2 },
          { label: "직원", colSpan: 3 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [{ label: "조식" }, { label: "중식" }, { label: "석식" }],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "employ_breakfast",
        "employ_lunch",
        "employ_dinner",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193620") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "2층 주간보호(어르신)", colSpan: 3 },
          { label: "3층-5층 요양원(어르신)", colSpan: 3 },
          { label: "경관식", rowSpan: 2 },
          { label: "2층 주간보호(직원조식)", rowSpan: 2 },
          { label: "요양원직원", colSpan: 2 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
          { label: "조식" },
          { label: "중식" },
        ],
      ],
      visibleColumns: [
        "daycare_breakfast",
        "daycare_lunch",
        "daycare_diner",
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "daycare_employ_breakfast",
        "employ_breakfast",
        "employ_lunch",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193603") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "주간보호", colSpan: 2 },
          { label: "직원(조식)", rowSpan: 2 },
          { label: "직원(중식)", colSpan: 2 },
          { label: "직원(석식)", rowSpan: 2 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [{ label: "중식" }, { label: "석식" }, { label: "요양원" }, { label: "주간보호" }],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "daycare_lunch",
        "daycare_diner",
        "employ_breakfast",
        "employ_lunch",
        "daycare_employ_lunch",
        "daycare_employ_dinner",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193502") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "경관식", rowSpan: 2 },
          { label: "직원", colSpan: 2 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [{ label: "중식" }, { label: "석식" }],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "employ_lunch",
        "employ_dinner",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193632") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "경관식", rowSpan: 2 },
          { label: "주간보호(어르신)", colSpan: 2 },
          { label: "주간보호(직원)", colSpan: 2 },
          { label: "직원", colSpan: 3 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [
          { label: "중식" },
          { label: "석식" },
          { label: "중식" },
          { label: "석식" },
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
        ],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "daycare_lunch",
        "daycare_diner",
        "daycare_employ_lunch",
        "daycare_employ_dinner",
        "employ_breakfast",
        "employ_lunch",
        "employ_dinner",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193523") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "경관식", rowSpan: 2 },
          { label: "직원", colSpan: 2 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [{ label: "조식" }, { label: "중식" }],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "employ_breakfast",
        "employ_lunch",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193544") {
    return {
      headerRows: [
        [
          { label: "구분" },
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
          { label: "경관식" },
          { label: "주간보호 중식" },
          { label: "직원" },
          { label: "계" },
          { label: "비고" },
          { label: "조식취소" },
          { label: "중식취소" },
          { label: "석식취소" },
        ],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "daycare_lunch",
        "employ",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193634") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "조식", rowSpan: 2 },
          { label: "중식", rowSpan: 2 },
          { label: "석식", rowSpan: 2 },
          { label: "경관식", rowSpan: 2 },
          { label: "직원", colSpan: 3 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [{ label: "조식" }, { label: "중식" }, { label: "석식" }],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "ceremony",
        "employ_breakfast",
        "employ_lunch",
        "employ_dinner",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  if (selectedAccountId === "20250819193630") {
    return {
      headerRows: [
        [
          { label: "구분", rowSpan: 2 },
          { label: "2,3층", colSpan: 3 },
          { label: "7층", colSpan: 3 },
          { label: "경관식", colSpan: 2 },
          { label: "직원", colSpan: 2 },
          { label: "계", rowSpan: 2 },
          { label: "비고", rowSpan: 2 },
          { label: "조식취소", rowSpan: 2 },
          { label: "중식취소", rowSpan: 2 },
          { label: "석식취소", rowSpan: 2 },
        ],
        [
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
          { label: "조식" },
          { label: "중식" },
          { label: "석식" },
          { label: "2,3층" },
          { label: "7층" },
          { label: "조식" },
          { label: "중식" },
        ],
      ],
      visibleColumns: [
        "breakfast",
        "lunch",
        "dinner",
        "breakfast2",
        "lunch2",
        "dinner2",
        "ceremony",
        "ceremony2",
        "employ_breakfast",
        "employ_lunch",
        "total",
        "note",
        "breakcancel",
        "lunchcancel",
        "dinnercancel",
      ],
    };
  }

  // =========================================================
  // ✅ 기본 레이아웃(학교/산업체 제외) : special_yn 숨김
  // =========================================================
  const showDaycareLunch = isDaycareVisible;
  const showDaycareDinner = isDaycareVisible;

  const baseColumns = [
    "breakfast",
    "lunch",
    "dinner",
    "ceremony",
    ...extraDietCols.map((col) => col.priceKey),
    ...(showDaycareLunch ? ["daycare_lunch"] : []),
    ...(showDaycareDinner ? ["daycare_diner"] : []),
    "employ",
    "total",
    "note",
    "breakcancel",
    "lunchcancel",
    "dinnercancel",
  ];

  const headerRow = [
    { label: "구분" },
    { label: "조식" },
    { label: "중식" },
    { label: "석식" },
    { label: "경관식" },
    ...extraDietCols.map((col) => ({ label: col.name })),
    ...(showDaycareLunch ? [{ label: "데이케어 중식" }] : []),
    ...(showDaycareDinner ? [{ label: "데이케어 석식" }] : []),
    { label: "직원" },
    { label: "계" },
    { label: "비고" },
    { label: "조식취소" },
    { label: "중식취소" },
    { label: "석식취소" },
  ];

  return { headerRows: [headerRow], visibleColumns: baseColumns };
};

function DinersNumberSheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  // 👉 라우트 파라미터에서 account_id 가져오기
  const { account_id } = useParams();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [originalRows, setOriginalRows] = useState([]);

  // ✅ 근무일수 상태 (테이블과 완전 분리)
  const [workingDay, setWorkingDay] = useState("0");
  const [originalWorkingDay, setOriginalWorkingDay] = useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { activeRows, setActiveRows, loading, fetchAllData, extraDietCols, accountList } =
    useDinersNumbersheetData(selectedAccountId, year, month);

  // ✅ 거래처 Autocomplete 옵션
  const accountOptions = useMemo(() => {
    return (accountList || []).map((acc) => ({
      value: String(acc.account_id),
      label: acc.account_name,
    }));
  }, [accountList]);

  // ✅ extraDietCols 레퍼런스 변동으로 originalRows가 덮이는 문제 방지
  const extraDietSignature = useMemo(() => {
    const arr = Array.isArray(extraDietCols) ? extraDietCols : [];
    return arr.map((c) => `${c.priceKey}:${c.name}`).join("|");
  }, [extraDietCols]);

  const stableExtraDietCols = useMemo(() => {
    return Array.isArray(extraDietCols) ? extraDietCols : [];
  }, [extraDietSignature]);

  const isDaycareVisible =
    selectedAccountId &&
    DAYCARE_ACCOUNT_IDS.includes(selectedAccountId) &&
    !SPECIAL_LAYOUT_IDS.includes(selectedAccountId);

  const selectedAccount = (accountList || []).find((acc) => acc.account_id === selectedAccountId);
  const selectedAccountType = selectedAccount?.account_type;

  const isWorkingDayVisible = selectedAccountType === "학교" || selectedAccountType === "산업체";

  const isWorkingDayChanged =
    isWorkingDayVisible && parseNumber(workingDay ?? 0) !== originalWorkingDay;

  // =========================================================
  // ✅ (C) Shift+드래그 선택 → 입력창 → 일괄 적용
  // =========================================================
  const [dragSelect, setDragSelect] = useState(null);

  const selectRef = useRef({
    selecting: false,
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    visibleColumnsSnapshot: [],
  });

  const isEditableKey = (key) => !["total", "diner_date"].includes(key) && key !== "special_yn";

  const isCellSelected = (rowIndex, colIndex, key) => {
    if (!dragSelect) return false;
    if (!numericCols.includes(key)) return false;
    if (!isEditableKey(key)) return false;

    const r1 = Math.min(dragSelect.startRow, dragSelect.endRow);
    const r2 = Math.max(dragSelect.startRow, dragSelect.endRow);
    const c1 = Math.min(dragSelect.startCol, dragSelect.endCol);
    const c2 = Math.max(dragSelect.startCol, dragSelect.endCol);

    return rowIndex >= r1 && rowIndex <= r2 && colIndex >= c1 && colIndex <= c2;
  };

  const applyFillToSelection = useCallback(
    (fillNumber) => {
      const s = selectRef.current;
      const cols = s.visibleColumnsSnapshot || [];

      const r1 = Math.min(s.startRow, s.endRow);
      const r2 = Math.max(s.startRow, s.endRow);
      const c1 = Math.min(s.startCol, s.endCol);
      const c2 = Math.max(s.startCol, s.endCol);

      const targetKeys = cols
        .slice(c1, c2 + 1)
        .filter((k) => numericCols.includes(k))
        .filter((k) => isEditableKey(k));

      if (targetKeys.length === 0) return;

      setActiveRows((prev) => {
        const next = prev.map((r) => ({ ...r }));

        for (let r = r1; r <= r2; r += 1) {
          const rowCopy = { ...next[r] };

          targetKeys.forEach((k) => {
            rowCopy[k] = fillNumber;
          });

          rowCopy.total = calculateTotal(
            rowCopy,
            selectedAccountType,
            stableExtraDietCols,
            selectedAccountId
          );
          next[r] = rowCopy;
        }

        return next;
      });
    },
    [setActiveRows, selectedAccountType, stableExtraDietCols, selectedAccountId]
  );

  const finishSelectionAndPrompt = useCallback(async () => {
    const s = selectRef.current;
    if (!s.selecting) return;

    s.selecting = false;

    const { isConfirmed, value } = await Swal.fire({
      title: "값 입력",
      text: "선택한 셀 범위에 입력할 숫자를 적어주세요.",
      input: "text",
      inputAttributes: { inputmode: "numeric", autocomplete: "off" },
      showCancelButton: true,
      confirmButtonText: "적용",
      cancelButtonText: "취소",
      inputValidator: (v) => {
        const trimmed = String(v ?? "").trim();
        if (trimmed === "") return "값을 입력하세요.";
        const num = parseNumber(trimmed);
        if (Number.isNaN(num)) return "숫자만 입력할 수 있어요.";
        return undefined;
      },
    });

    if (isConfirmed) {
      const num = parseNumber(value);
      applyFillToSelection(num);
    }

    setDragSelect(null);
  }, [applyFillToSelection]);
  // =========================================================

  // ✅ accountList 로딩 후, URL param의 account_id를 우선 1번만 적용
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    setSelectedAccountId((prev) => {
      if (prev) return prev;

      if (account_id && accountList.some((row) => String(row.account_id) === String(account_id))) {
        return account_id;
      }

      return accountList[0].account_id;
    });
  }, [accountList, account_id]);

  // ✅ 기준(originalRows) + 화면용(activeRows) 세팅 + 근무일수 초기값 세팅
  useEffect(() => {
    if (loading || !selectedAccountId) return;

    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();

    const baseRows = Array.from({ length: daysInMonth }, (_, i) => {
      const base = {
        diner_date: dayjs(`${year}-${month}-${i + 1}`).toDate(),
        diner_year: year,
        diner_month: month,

        breakfast: 0,
        lunch: 0,
        dinner: 0,
        ceremony: 0,

        breakfast2: 0,
        lunch2: 0,
        dinner2: 0,
        ceremony2: 0,

        daycare_breakfast: 0,
        daycare_lunch: 0,
        daycare_diner: 0,
        daycare_elderly_lunch: 0,
        daycare_elderly_dinner: 0,

        daycare_employ_breakfast: 0,
        daycare_employ_lunch: 0,
        daycare_employ_dinner: 0,

        employ: 0,
        employ_breakfast: 0,
        employ_lunch: 0,
        employ_dinner: 0,

        extra_diet1_price: 0,
        extra_diet2_price: 0,
        extra_diet3_price: 0,
        extra_diet4_price: 0,
        extra_diet5_price: 0,

        total: 0,
        note: "",
        breakcancel: "",
        lunchcancel: "",
        dinnercancel: "",
        special_yn: "N",
      };

      stableExtraDietCols.forEach((col) => {
        if (!(col.priceKey in base)) base[col.priceKey] = 0;
      });

      return base;
    });

    const merged = baseRows.map((base) => {
      const found = activeRows.find((item) => {
        const itemDate = dayjs(item.diner_date);
        return (
          itemDate.year() === year &&
          itemDate.month() + 1 === month &&
          itemDate.date() === dayjs(base.diner_date).date()
        );
      });

      const mergedRow = found ? { ...base, ...found } : { ...base };
      return {
        ...mergedRow,
        total: calculateTotal(
          mergedRow,
          selectedAccountType,
          stableExtraDietCols,
          selectedAccountId
        ),
      };
    });

    setActiveRows(merged);
    setOriginalRows(merged.map((r) => ({ ...r })));

    const rowWithWorkingDay = merged.find(
      (r) => r.working_day !== undefined && r.working_day !== null
    );
    const initialWorkingDay =
      rowWithWorkingDay && !Number.isNaN(rowWithWorkingDay.working_day)
        ? parseNumber(rowWithWorkingDay.working_day)
        : 0;

    setWorkingDay(initialWorkingDay.toString());
    setOriginalWorkingDay(initialWorkingDay);

    setDragSelect(null);
    selectRef.current.selecting = false;
  }, [selectedAccountId, year, month, loading, selectedAccountType, extraDietSignature]);

  // ✅ 셀 변경 (테이블)
  const handleCellChange = (rowIndex, key, value) => {
    setActiveRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              [key]: value,
              total: calculateTotal(
                { ...row, [key]: value },
                selectedAccountType,
                stableExtraDietCols,
                selectedAccountId
              ),
            }
          : row
      )
    );
  };

  // ✅ 스타일 비교 (테이블 전용)
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    const origNorm = normalizeValueForCompare(key, original);
    const currNorm = normalizeValueForCompare(key, value);
    return origNorm !== currNorm ? { color: "red" } : { color: "black" };
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    if (!originalRows || originalRows.length === 0) {
      Swal.fire("안내", "비교 기준 데이터가 없습니다. 다시 조회해 주세요.", "info");
      return;
    }

    const modified = activeRows.filter((r, idx) => {
      const original = originalRows[idx] || {};
      return Object.keys(r).some((key) => {
        if (!(key in original)) return false;
        if (key === "diner_date") return false;

        const currNorm = normalizeValueForCompare(key, r[key]);
        const origNorm = normalizeValueForCompare(key, original[key]);
        return currNorm !== origNorm;
      });
    });

    const workingDayNumber = isWorkingDayVisible ? parseNumber(workingDay ?? 0) || 0 : 0;
    const workingDayChanged = isWorkingDayVisible && workingDayNumber !== originalWorkingDay;

    if (modified.length === 0 && !workingDayChanged) {
      Swal.fire("안내", "변경된 데이터가 없습니다.", "info");
      return;
    }

    const rowsToSend = workingDayChanged ? activeRows : modified;

    const payload = rowsToSend.map((row) => ({
      ...row,
      ...(isWorkingDayVisible ? { working_day: workingDayNumber } : {}),
      account_id: selectedAccountId,
      diner_year: year,
      diner_month: month,
      diner_date: dayjs(row.diner_date).format("DD"),
    }));

    try {
      const res = await api.post("/Operate/AccountDinnersNumberSave", payload);
      if (res.data.code === 200) {
        Swal.fire("성공", "저장되었습니다.", "success");
        await fetchAllData();
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  if (loading && (!activeRows || activeRows.length === 0)) return <LoadingScreen />;

  const { headerRows, visibleColumns } = getTableStructure(
    selectedAccountId,
    isDaycareVisible,
    stableExtraDietCols,
    selectedAccountType
  );

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <HeaderWithLogout showMenuButton title="🍽️ 식수관리" />

      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: isMobile ? "wrap" : "nowrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {isWorkingDayVisible && (
          <>
            <MDTypography variant="button">근무일수</MDTypography>
            <TextField
              value={workingDay}
              onChange={(e) => setWorkingDay(e.target.value)}
              onBlur={(e) => {
                const num = parseNumber(e.target.value) || 0;
                setWorkingDay(num.toString());
              }}
              variant="outlined"
              size="small"
              sx={{ width: 80, mr: 1 }}
              inputProps={{
                style: {
                  textAlign: "right",
                  ...(isWorkingDayChanged ? { color: "red" } : {}),
                },
              }}
            />
          </>
        )}

        {/* ✅ 거래처: 문자 검색 가능한 Autocomplete로 변경 */}
        {(accountList || []).length > 0 && (
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={accountOptions}
            value={(() => {
              const v = String(selectedAccountId ?? "");
              return accountOptions.find((o) => o.value === v) || null;
            })()}
            onChange={(_, opt) => setSelectedAccountId(opt ? opt.value : "")}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            renderInput={(params) => (
              <TextField
                {...params}
                label="거래처 검색"
                placeholder="거래처명을 입력"
                sx={{
                  "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                  "& input": { padding: "0 8px" },
                }}
              />
            )}
          />
        )}

        <TextField
          select
          size="small"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>

        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={3} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card sx={{ height: "calc(95vh - 160px)", display: "flex", flexDirection: "column" }}>
              <MDBox
                pt={0}
                sx={{
                  flex: 1,
                  minHeight: 0,
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
                    width: "5%",
                  },
                  "& th": {
                    backgroundColor: "#f0f0f0",
                    position: "sticky",
                    zIndex: 10,
                  },
                }}
              >
                <table className="dinersheet-table">
                  <thead>
                    {headerRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, i) => (
                          <th
                            key={i}
                            colSpan={cell.colSpan || 1}
                            rowSpan={cell.rowSpan || 1}
                            style={{ top: rowIdx * 24 }}
                          >
                            {cell.label}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>

                  <tbody>
                    {activeRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td>{dayjs(row.diner_date).format("YYYY-MM-DD")}</td>

                        {visibleColumns.map((key, colIndex) => {
                          const editable = !["total", "diner_date"].includes(key);
                          const value = row[key] ?? "";
                          const isNumeric = numericCols.includes(key);
                          const style = getCellStyle(rowIndex, key, value);
                          const isSpecial = key === "special_yn";

                          const selectedBg = isCellSelected(rowIndex, colIndex, key)
                            ? { background: "#e3f2fd" }
                            : {};

                          return (
                            <td
                              key={key}
                              contentEditable={editable && !isSpecial}
                              suppressContentEditableWarning
                              style={{ ...style, ...selectedBg, width: "80px" }}
                              onMouseDown={(e) => {
                                if (!e.shiftKey) return;
                                if (!isNumeric) return;
                                if (!isEditableKey(key)) return;
                                if (!editable || isSpecial) return;

                                e.preventDefault();

                                selectRef.current.selecting = true;
                                selectRef.current.startRow = rowIndex;
                                selectRef.current.endRow = rowIndex;
                                selectRef.current.startCol = colIndex;
                                selectRef.current.endCol = colIndex;
                                selectRef.current.visibleColumnsSnapshot = [...visibleColumns];

                                setDragSelect({
                                  startRow: rowIndex,
                                  endRow: rowIndex,
                                  startCol: colIndex,
                                  endCol: colIndex,
                                });

                                window.addEventListener("mouseup", finishSelectionAndPrompt, {
                                  once: true,
                                });
                              }}
                              onMouseEnter={() => {
                                if (!selectRef.current.selecting) return;
                                if (!isNumeric) return;

                                selectRef.current.endRow = rowIndex;
                                selectRef.current.endCol = colIndex;

                                setDragSelect({
                                  startRow: selectRef.current.startRow,
                                  endRow: rowIndex,
                                  startCol: selectRef.current.startCol,
                                  endCol: colIndex,
                                });
                              }}
                              onBlur={(e) => {
                                if (selectRef.current.selecting) return;
                                if (isSpecial) return;

                                let newValue = e.target.innerText.trim();
                                if (isNumeric) newValue = parseNumber(newValue);

                                handleCellChange(rowIndex, key, newValue);

                                if (isNumeric) e.currentTarget.innerText = formatNumber(newValue);
                              }}
                            >
                              {isSpecial ? (
                                <select
                                  value={value || "N"}
                                  onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                                  style={{
                                    width: "100%",
                                    border: "none",
                                    background: "transparent",
                                    textAlign: "center",
                                    ...style,
                                  }}
                                >
                                  <option value="Y">유</option>
                                  <option value="N">무</option>
                                </select>
                              ) : isNumeric ? (
                                formatNumber(value)
                              ) : (
                                value
                              )}
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
    </DashboardLayout>
  );
}

export default DinersNumberSheet;
