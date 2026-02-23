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
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";

// ✅ 엑셀 생성용
import ExcelJS from "exceljs";

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

  const accountTypeById = useMemo(() => {
    const map = new Map();
    (profitLossTableRows || []).forEach((r) => {
      if (r?.account_id) map.set(String(r.account_id), r?.account_type);
    });
    return map;
  }, [profitLossTableRows]);

  const accountOptions = useMemo(() => {
    const allOption = { account_id: "ALL", account_name: "전체", account_type: "" };

    const normalized = (accountList || []).map((a) => ({
      account_id: a.account_id,
      account_name: a.account_name,
      account_type: accountTypeById.get(String(a.account_id)) ?? a.account_type ?? "",
    }));

    return [allOption, ...normalized];
  }, [accountList, accountTypeById]);

  // ✅ 실제 조회에 사용할 account_id (전체면 빈값으로 넘김)
  const queryAccountId = useMemo(() => {
    return selectedAccountId === "ALL" ? "" : selectedAccountId;
  }, [selectedAccountId]);

  // ✅ 데이터 조회 (전체 포함)
  useEffect(() => {
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

  // ✅ account_type 이 "학교" 인 경우에만 반환금(=return_cost) 컬럼 표시
  const showReturnCost = useMemo(() => {
    if (selectedAccountId === "ALL") return false;
    const t = String(selectedAccount?.account_type ?? "").trim();
    return t === "학교";
  }, [selectedAccountId, selectedAccount]);

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;

    const list = accountOptions || [];
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
    "return_cost",
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
    "20250819193622",
    "20250819193615",
    "ALL",
  ]);

  const isHangyeol = HANGYEOL_ACCOUNT_IDS.has(String(selectedAccountId));

  // ✅ 특정 거래처에서만 추가 컬럼 표시
  const SPECIAL_ACCOUNT_ID = "20250819193630";
  const isSpecialSales2 = String(selectedAccountId) === SPECIAL_ACCOUNT_ID;

  // ✅ 화면 헤더 구조 (특정 거래처는 매출에 (2) 컬럼 3개 추가)
  const headers = useMemo(() => {
    const salesColsBase = [
      "생계비",
      "일반식대",
      "직원식대",
      "주간일반",
      "주간직원",
      "보전",
      "반환금",
      "판장금",
      "매출소계",
    ];

    // ✅ 생계비/일반식대/직원식대 "옆으로" (2) 컬럼 삽입
    const salesCols = isSpecialSales2
      ? [
          "생계비",
          "일반식대",
          "직원식대",
          "생계비(2)",
          "일반식대(2)",
          "직원식대(2)",
          "주간일반",
          "주간직원",
          "보전",
          "반환금",
          "판장금",
          "매출소계",
        ]
      : salesColsBase;

    return [
      { group: "인원", cols: ["생계인원", "일반인원", "인원합계"] },
      { group: "매출", cols: salesCols },
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
  }, [isSpecialSales2]);

  // ✅ 컬럼 → DB 필드 매핑
  const fieldMap = {
    생계인원: { value: "living_estimate", ratio: "living_estimate_ratio" },
    일반인원: { value: "basic_estimate", ratio: "basic_estimate_ratio" },
    인원합계: { value: "estimate_total", ratio: "estimate_total_ratio" },
    생계비: { value: "living_cost", ratio: "living_ratio" },
    일반식대: { value: "basic_cost", ratio: "basic_ratio" },
    직원식대: { value: "employ_cost", ratio: "employ_ratio" },
    "생계비(2)": { value: "living_cost2", ratio: "living_ratio2" },
    "일반식대(2)": { value: "basic_cost2", ratio: "basic_ratio2" },
    "직원식대(2)": { value: "employ_cost2", ratio: "employ_ratio2" },
    주간일반: { value: "daycare_cost", ratio: "daycare_ratio" },
    주간직원: { value: "daycare_emp_cost", ratio: "daycare_emp_ratio" },
    보전: { value: "integrity_cost", ratio: "integrity_ratio" },
    반환금: { value: "return_cost", ratio: "return_ratio" },
    판장금: { value: "payback_price", ratio: "payback_ratio" },
    매출소계: { value: "sales_total", ratio: "sales_total_ratio" },
    식자재: { value: "food_cost", ratio: "food_ratio" },
    음식물처리: { value: "food_process", ratio: "food_trash_ratio" },
    식기세척기: { value: "dishwasher", ratio: "dishwasher_ratio" },
    세스코방제: { value: "cesco", ratio: "cesco_ratio" },
    정수기: { value: "water_puri", ratio: "water_ratio" },
    기타경비: { value: "etc_cost", ratio: "etc_ratio" },
    이벤트: { value: "event_cost", ratio: "event_ratio" },
    예산미발행: { value: "not_budget_cost", ratio: "not_budget_ratio" },
    매입소계: { value: "purchase_total", ratio: "purchase_total_ratio" },
    인건비정보: { value: "person_cost", ratio: "person_ratio" },
    파출비: { value: "dispatch_cost", ratio: "dispatch_ratio" },
    인건소계: { value: "person_total", ratio: "person_total_ratio" },
    수도광열비: { value: "utility_bills", ratio: "utility_ratio" },
    비고: { value: "utility_bills_note" },
    세금정보: { value: "duty_secure", ratio: "duty_secure_ratio" },
    기타간접비: { value: "etc_indirect_cost", ratio: "etc_indirect_ratio" },
    간접소계: { value: "indirect_total", ratio: "indirect_total_ratio" },
    영업이익: { value: "business_profit", ratio: "business_profit_ratio" },
  };

  // ✅ 숨겨진 컬럼 적용
  const filteredHeaders = headers
    .map((h) => {
      let cols = h.cols;

      if (!isHangyeol) {
        cols = cols.filter((col) => !hiddenCols.includes(col));
      }

      if (!showReturnCost) {
        cols = cols.filter((col) => col !== "반환금");
      }

      return { ...h, cols };
    })
    .filter((h) => h.cols.length > 0);

  // ✅ 수정사항 존재 여부 체크
  const hasUnsavedChanges = useMemo(() => {
    return (editRows || []).some((row) => {
      const numChanged = editableNumberFields.some((field) => {
        const original = Number(row?._original?.[field] ?? 0);
        const current = Number(row?.[field] ?? 0);
        return original !== current;
      });

      const textChanged = editableTextFields.some((field) => {
        const original = String(row?._original?.[field] ?? "").trim();
        const current = String(row?.[field] ?? "").trim();
        return original !== current;
      });

      return numChanged || textChanged;
    });
  }, [editRows, editableNumberFields, editableTextFields]);

  // ✅ 새로고침: 현재 조건(year, 거래처/전체)로 재조회
  const handleRefresh = async () => {
    if (!selectedAccountId) return;

    if (hasUnsavedChanges) {
      const result = await Swal.fire({
        title: "변경사항이 있습니다.",
        text: "새로고침하면 저장되지 않은 변경사항이 사라집니다. 계속할까요?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "새로고침",
        cancelButtonText: "취소",
      });
      if (!result.isConfirmed) return;
    }

    fetchProfitLossTableList(queryAccountId);
  };

  // ✅ 파일 다운로드 유틸
  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const sanitizeFilename = (name) => {
    const safe = String(name || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return safe.length > 100 ? safe.slice(0, 100) : safe;
  };

  // ✅ ExcelJS 테두리/헤더 스타일
  const excelBorderThin = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  const excelHeaderFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };

  // ✅ arraybuffer -> 매직넘버로 xlsx/xls/에러텍스트 판별
  const detectExcelExtOrError = (arrayBuffer) => {
    const u8 = new Uint8Array(arrayBuffer);
    if (u8.length < 4) return { kind: "unknown" };

    const isXlsx =
      u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);

    const isXls =
      u8.length >= 8 &&
      u8[0] === 0xd0 &&
      u8[1] === 0xcf &&
      u8[2] === 0x11 &&
      u8[3] === 0xe0 &&
      u8[4] === 0xa1 &&
      u8[5] === 0xb1 &&
      u8[6] === 0x1a &&
      u8[7] === 0xe1;

    if (isXlsx) return { kind: "xlsx" };
    if (isXls) return { kind: "xls" };

    let preview = "";
    try {
      preview = new TextDecoder("utf-8").decode(u8.slice(0, 400));
    } catch (e) {
      preview = "(텍스트 디코딩 실패)";
    }
    return { kind: "not_excel", preview };
  };

  // ✅ 인터셉터 없는 엑셀 전용 axios
  const excelApi = axios.create({
    baseURL: api.defaults.baseURL,
    withCredentials: api.defaults.withCredentials,
    timeout: 60000,
    transformResponse: [(d) => d],
  });

  const arrayBufferToJson = (ab) => {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(ab));
    return JSON.parse(text);
  };

  const toPercentCell = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    if (Number.isNaN(n)) return "";
    if (n >= 0 && n <= 1) return n;
    if (n > 1 && n <= 100) return n / 100;
    return n;
  };

  const buildTwoRowHeader = (sheet, firstTitle, firstKey) => {
    const subCols = filteredHeaders.flatMap((h) => h.cols);
    const allHeaders = [firstTitle, ...subCols, "영업이익"];

    sheet.columns = [
      { key: firstKey, width: firstTitle === "거래처" ? 22 : 10 },
      ...subCols.map((col) => ({
        key: fieldMap[col]?.value || col,
        width: col === "비고" ? 30 : 14,
      })),
      { key: fieldMap["영업이익"].value, width: 14 },
    ];

    const topRowValues = new Array(allHeaders.length).fill(null);
    topRowValues[0] = firstTitle;
    topRowValues[allHeaders.length - 1] = "영업이익";

    let colIdx = 2;
    filteredHeaders.forEach((h) => {
      topRowValues[colIdx - 1] = h.group;
      colIdx += h.cols.length;
    });

    sheet.addRow(topRowValues);
    sheet.addRow(allHeaders);

    sheet.mergeCells(1, 1, 2, 1);
    sheet.mergeCells(1, allHeaders.length, 2, allHeaders.length);

    let start = 2;
    filteredHeaders.forEach((h) => {
      const end = start + h.cols.length - 1;
      sheet.mergeCells(1, start, 1, end);
      start = end + 1;
    });

    [1, 2].forEach((rno) => {
      const r = sheet.getRow(rno);
      r.height = 18;
      r.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = excelHeaderFill;
        cell.border = excelBorderThin;
      });
    });
  };

  // ==============================
  // ✅ 월전체(첨부 엑셀 형태) 생성 로직 추가
  // ==============================
  const monthExcelRowDefs = [
    // 인원
    {
      group: "인원",
      label: "인원추산(생계비)",
      valueKey: "living_estimate",
      ratioKey: "living_estimate_ratio",
    },
    {
      group: "인원",
      label: "인원추산(일반)",
      valueKey: "basic_estimate",
      ratioKey: "basic_estimate_ratio",
    },
    {
      group: "인원",
      label: "인원추산(합계)",
      valueKey: "estimate_total",
      ratioKey: "estimate_total_ratio",
    },

    // 매출
    { group: "매출", label: "생계비", valueKey: "living_cost", ratioKey: "living_ratio" },
    { group: "매출", label: "일반식대", valueKey: "basic_cost", ratioKey: "basic_ratio" },
    { group: "매출", label: "직원식대", valueKey: "employ_cost", ratioKey: "employ_ratio" },
    { group: "매출", label: "주간보호", valueKey: "daycare_cost", ratioKey: "daycare_ratio" },
    {
      group: "매출",
      label: "주간보호직원",
      valueKey: "daycare_emp_cost",
      ratioKey: "daycare_emp_ratio",
    },
    { group: "매출", label: "보전", valueKey: "integrity_cost", ratioKey: "integrity_ratio" },
    { group: "매출", label: "반환금", valueKey: "return_cost", ratioKey: "return_ratio" },
    { group: "매출", label: "판장금", valueKey: "payback_price", ratioKey: "payback_ratio" },
    { __blank: true },
    { group: "매출", label: "소계(매출)", valueKey: "sales_total", ratioKey: "sales_total_ratio" },

    // 매입
    { group: "매입", label: "식자재", valueKey: "food_cost", ratioKey: "food_ratio" },
    { group: "매입", label: "음식물처리", valueKey: "food_process", ratioKey: "food_trash_ratio" },
    { group: "매입", label: "식기세척기", valueKey: "dishwasher", ratioKey: "dishwasher_ratio" },
    { group: "매입", label: "세스코방제", valueKey: "cesco", ratioKey: "cesco_ratio" },
    { group: "매입", label: "정수기임대", valueKey: "water_puri", ratioKey: "water_ratio" },
    { group: "매입", label: "기타경비", valueKey: "etc_cost", ratioKey: "etc_ratio" },
    { group: "매입", label: "이벤트", valueKey: "event_cost", ratioKey: "event_ratio" },
    {
      group: "매입",
      label: "예산미발행",
      valueKey: "not_budget_cost",
      ratioKey: "not_budget_ratio",
    },
    { __blank: true },
    {
      group: "매입",
      label: "소계(매입)",
      valueKey: "purchase_total",
      ratioKey: "purchase_total_ratio",
    },

    // 인건
    { group: "인건", label: "인건비확보", valueKey: "person_cost", ratioKey: "person_ratio" },
    { group: "인건", label: "파출비", valueKey: "dispatch_cost", ratioKey: "dispatch_ratio" },
    { __blank: true },
    {
      group: "인건",
      label: "소계(인건)",
      valueKey: "person_total",
      ratioKey: "person_total_ratio",
    },

    // 간접
    { group: "간접", label: "수도광열비", valueKey: "utility_bills", ratioKey: "utility_ratio" },
    { group: "간접", label: "비고", valueKey: "utility_bills_note", ratioKey: null }, // 텍스트
    { group: "간접", label: "세금확보", valueKey: "duty_secure", ratioKey: "duty_secure_ratio" },
    { __blank: true },
    {
      group: "간접",
      label: "소계(간접)",
      valueKey: "indirect_total",
      ratioKey: "indirect_total_ratio",
    },

    // 이익
    {
      group: "이익",
      label: "영업이익",
      valueKey: "business_profit",
      ratioKey: "business_profit_ratio",
    },
  ];

  const monthExcelRowDefsSales2 = [
    { group: "매출", label: "생계비(2)", valueKey: "living_cost2", ratioKey: "living_ratio2" },
    { group: "매출", label: "일반식대(2)", valueKey: "basic_cost2", ratioKey: "basic_ratio2" },
    { group: "매출", label: "직원식대(2)", valueKey: "employ_cost2", ratioKey: "employ_ratio2" },
  ];

  const isMonthlyRecordArray = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const sample = rows.find((r) => r && typeof r === "object");
    if (!sample) return false;
    const hasMonth = "month" in sample || "mm" in sample || "mon" in sample;
    const hasKnownValueKey = Object.values(fieldMap).some((m) => m?.value && m.value in sample);
    return Boolean(hasMonth && hasKnownValueKey);
  };

  const getMonthNumber = (r) => {
    const v = r?.month ?? r?.mm ?? r?.mon;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const buildMonthAllExcelLikeTemplate = async (rows) => {
    // ✅ rows: [{account_id, account_name, month, ...value/ratio fields...}] 형태를 기대
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("손익표(월전체)");
    const grayRowNumbers = new Set(); // ✅ 이 줄 추가 (에러 방지)
    // ✅ 첨부 엑셀과 같은 헤더 구성(단일 헤더 행)
    const header = [
      "NO",
      "", // 2번째 빈 헤더 유지(원래 양식 느낌)
      "C분류", // 거래처명
      "E분류", // 그룹(인원/매출/매입/인건/간접/이익)
      "F분류", // 항목명(라벨)
      "당월",
      "비율",
      "1월",
      "비율",
      "2월",
      "비율",
      "3월",
      "비율",
      "4월",
      "비율",
      "5월",
      "비율",
      "6월",
      "비율",
      "7월",
      "비율",
      "8월",
      "비율",
      "9월",
      "비율",
      "10월",
      "비율",
      "11월",
      "비율",
      "12월",
      "비율",
      "합계",
      "비율",
    ];

    sheet.columns = header.map((h, idx) => {
      const w =
        idx === 0
          ? 6
          : idx === 1
          ? 10
          : idx === 2
          ? 18
          : idx === 3
          ? 12
          : idx === 4
          ? 14
          : idx === 5
          ? 10
          : idx === 6
          ? 22
          : idx >= 7
          ? 12
          : 12;
      return { header: h, key: `c${idx + 1}`, width: w };
    });

    // 1행: 헤더
    sheet.addRow(header);

    // 헤더 스타일
    const hr = sheet.getRow(1);
    hr.height = 18;
    hr.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = excelHeaderFill;
      cell.border = excelBorderThin;
    });

    // ✅ account 기준 그룹핑
    const byAccount = new Map();
    rows.forEach((r) => {
      const aid = String(r?.account_id ?? r?.account_name ?? "");
      if (!aid) return;
      if (!byAccount.has(aid)) byAccount.set(aid, []);
      byAccount.get(aid).push(r);
    });

    // 당월 기준: 동일 연도면 "현재월", 아니면 12월로
    const currentMonth = year === today.year() ? today.month() : 12;

    let no = 1;

    const putBlankRow = () => {
      const blank = new Array(header.length).fill(null);
      sheet.addRow(blank);
    };

    for (const [, accRows] of byAccount.entries()) {
      const accId = String(accRows[0]?.account_id ?? "");
      const defs =
        accId === SPECIAL_ACCOUNT_ID
          ? (() => {
              // 매출의 생계비/일반식대/직원식대 뒤에 (2) 3개를 끼워넣기
              const out = [];
              for (const d of monthExcelRowDefs) {
                out.push(d);
                if (d.label === "생계비") out.push(monthExcelRowDefsSales2[0]);
                if (d.label === "일반식대") out.push(monthExcelRowDefsSales2[1]);
                if (d.label === "직원식대") out.push(monthExcelRowDefsSales2[2]);
              }
              return out;
            })()
          : monthExcelRowDefs;

      // 월별 인덱싱
      const monthMap = new Map();
      accRows.forEach((r) => {
        const m = getMonthNumber(r);
        if (m) monthMap.set(m, r);
      });

      const accName = accRows[0]?.account_name ?? "";
      const aCat = accRows[0]?.a_category ?? accRows[0]?.company_name ?? accRows[0]?.A ?? "";
      const bCat = accRows[0]?.b_category ?? accRows[0]?.biz_type ?? accRows[0]?.B ?? "";

      for (const def of defs) {
        if (def.__blank) {
          putBlankRow();
          continue;
        }

        const row = new Array(header.length).fill(null);

        // ✅ 고정 컬럼 (A/B분류 제거한 헤더에 맞춤)
        row[0] = no++;
        row[1] = accRows[0]?.account_code ?? null; // 2번째(빈 헤더 컬럼)
        row[2] = accName || null; // C분류 = 거래처명
        row[3] = def.group || null; // E분류 = 그룹
        row[4] = def.label || null; // F분류 = 항목(라벨)

        // ✅ 값/비율 넣기 헬퍼
        const setValueRatioAt = (valueColIdx0, value, ratio) => {
          row[valueColIdx0] = value ?? null;
          row[valueColIdx0 + 1] = ratio ?? null;
        };

        // ✅ 당월
        const curRec = monthMap.get(currentMonth);
        const curVal = curRec ? curRec?.[def.valueKey] : null;
        const curRatio = def.ratioKey && curRec ? toPercentCell(curRec?.[def.ratioKey]) : null;
        setValueRatioAt(5, curVal, curRatio);

        // ✅ 1~12월
        for (let m = 1; m <= 12; m++) {
          const rec = monthMap.get(m);
          const val = rec ? rec?.[def.valueKey] : null;
          const ratio = def.ratioKey && rec ? toPercentCell(rec?.[def.ratioKey]) : null;

          // 1월 value가 시작되는 index: 9(0-base)
          // 각 월은 (value, ratio) 2칸씩
          // ✅ 1~12월 (1월 값 시작 인덱스: 7)
          const base = 7 + (m - 1) * 2;
          setValueRatioAt(base, val, ratio);
        }

        // ✅ 합계(값만 합산, 비율은 서버정의 불명이라 비움)
        if (def.valueKey && def.valueKey !== "utility_bills_note") {
          let sum = 0;
          let hasAny = false;
          for (let m = 1; m <= 12; m++) {
            const rec = monthMap.get(m);
            const v = rec?.[def.valueKey];
            const n = Number(v);
            if (Number.isFinite(n)) {
              sum += n;
              hasAny = true;
            }
          }
          // ✅ 합계 (value index: 31, ratio index: 32)
          row[31] = hasAny ? sum : null;
          row[32] = null;
        }

        sheet.addRow(row);
      }
    }

    // ✅ 연한 회색(요약행), 연한 하늘색, 빨강 폰트
    const excelGrayFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
    const excelSkyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEEFF" } };
    const excelRedFont = { color: { argb: "FFFF0000" } };

    // 값/비율 컬럼 셋(현재 너 헤더 기준)
    const valueCols = new Set(
      [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31].map((x) => x + 1)
    );
    const ratioCols = new Set(
      [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].map((x) => x + 1)
    );

    sheet.eachRow((r, rno) => {
      if (rno === 1) return; // 헤더 제외

      // ✅ F분류(5번째 컬럼 = cno 5) 텍스트
      const fLabel = String(r.getCell(5).value ?? "");
      const isSoGyeRow = fLabel.includes("소계"); // ✅ '소계' 뒤에 뭐가 붙어도 OK

      // ✅ '영업이익' + 오타 '영엽이익' 둘 다 처리
      const isProfitRow = fLabel.includes("영업이익") || fLabel.includes("영엽이익");

      // ✅ 요약행(회색 기본): 소계/합계/영업이익
      const isSummaryRow = isSoGyeRow || fLabel.includes("합계") || isProfitRow;

      r.eachCell((cell, cno) => {
        cell.border = excelBorderThin;

        // 1) 요약행은 기본 회색
        if (isSummaryRow) cell.fill = excelGrayFill;

        // 2) C분류(3번째 컬럼)는 항상 연한 하늘색
        if (cno === 3) cell.fill = excelSkyFill;

        // 3) 소계 행: F분류 셀만 하늘색 + 빨강 + Bold
        if (cno === 5 && isSoGyeRow) {
          cell.fill = excelSkyFill;
          cell.font = { ...(cell.font || {}), ...excelRedFont, bold: true };
        }

        // 4) 영업이익(영엽이익 포함) 행: 행 전체 하늘색 + Bold
        if (isProfitRow) {
          cell.fill = excelSkyFill;
          cell.font = { ...(cell.font || {}), bold: true };
        }

        // 정렬/포맷
        if (cno <= 5) {
          cell.alignment = { vertical: "middle", horizontal: cno === 5 ? "left" : "center" };
          return;
        }

        if (ratioCols.has(cno)) {
          if (typeof cell.value === "number") cell.numFmt = "0.0%";
          cell.alignment = { vertical: "middle", horizontal: "center" };
          return;
        }

        if (valueCols.has(cno)) {
          if (typeof cell.value === "number") {
            cell.numFmt = "#,##0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
          return;
        }

        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  };

  // ✅ 엑셀 다운로드
  const handleExcelDownload = async () => {
    if (!selectedAccountId) return;

    const accountName = selectedAccount?.account_name || "거래처";
    const fileName =
      selectedAccountId === "ALL"
        ? `${year}-손익표.xlsx`
        : `${year}-${sanitizeFilename(accountName)}.xlsx`;

    try {
      // ✅ 1) 전체(ALL)일 때: "월 전체 / 거래처 전체" 선택
      if (selectedAccountId === "ALL") {
        const { value: mode } = await Swal.fire({
          title: "전체 다운로드 옵션",
          text: "다운로드 방식을 선택하세요.",
          input: "radio",
          inputOptions: {
            account: "거래처 전체",
            month: "월 전체",
          },
          inputValidator: (v) => (!v ? "옵션을 선택해주세요." : undefined),
          confirmButtonText: "다운로드",
          showCancelButton: true,
          cancelButtonText: "취소",
        });

        if (!mode) return;

        // --------------------------
        // (1-A) 거래처 전체 (기존)
        // --------------------------
        if (mode === "account") {
          const res = await excelApi.get("/HeadOffice/ExcelDaownProfitLossTableList", {
            params: { year },
            responseType: "arraybuffer",
            headers: {
              Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          });

          const detected = detectExcelExtOrError(res.data);

          // ✅ 서버가 엑셀 → 그대로 다운로드
          if (detected.kind === "xlsx" || detected.kind === "xls") {
            const ext = detected.kind === "xls" ? "xls" : "xlsx";
            const blob = new Blob([res.data], {
              type:
                ext === "xls"
                  ? "application/vnd.ms-excel"
                  : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            downloadBlob(blob, `${year}(손익표).${ext}`);
            return;
          }

          // ✅ 서버가 JSON → 기존 화면형(2줄 헤더) ExcelJS 생성
          let rows;
          try {
            rows = arrayBufferToJson(res.data);
          } catch (e) {
            Swal.fire(
              "엑셀 다운로드 실패",
              `서버가 엑셀도 아니고 JSON 파싱도 실패했습니다.\n\n(앞부분)\n${
                detected.preview || ""
              }`,
              "error"
            );
            return;
          }

          if (!Array.isArray(rows) || rows.length === 0) {
            Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
            return;
          }

          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet("손익표(전체)");

          buildTwoRowHeader(sheet, "거래처", "__account_month");

          const ratioRowNumbers = new Set();

          rows.forEach((r) => {
            const m = r?.month ?? r?.mm ?? r?.mon ?? "";
            const monthText = m !== "" ? `${m}월` : "";

            const valueObj = {
              __account_month: `${r?.account_name ?? ""}${monthText ? ` ${monthText}` : ""}`,
            };

            filteredHeaders.forEach((h) => {
              h.cols.forEach((col) => {
                const key = fieldMap[col]?.value || col;
                valueObj[key] = r?.[key] ?? "";
              });
            });

            valueObj[fieldMap["영업이익"].value] = r?.[fieldMap["영업이익"].value] ?? 0;
            sheet.addRow(valueObj);

            const valueRowNo = sheet.lastRow.number;

            const ratioObj = { __account_month: "" };

            filteredHeaders.forEach((h) => {
              h.cols.forEach((col) => {
                const ratioKey = fieldMap[col]?.ratio;
                const valueKey = fieldMap[col]?.value || col;
                ratioObj[valueKey] = ratioKey ? toPercentCell(r?.[ratioKey]) : "";
              });
            });

            ratioObj[fieldMap["영업이익"].value] = toPercentCell(r?.[fieldMap["영업이익"].ratio]);
            sheet.addRow(ratioObj);

            const ratioRowNo = sheet.lastRow.number;
            ratioRowNumbers.add(ratioRowNo);

            sheet.mergeCells(valueRowNo, 1, ratioRowNo, 1);
          });

          sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
              cell.border = excelBorderThin;
              if (rowNumber <= 2) return;

              const headerText = sheet.getRow(2).getCell(colNumber).value;

              if (headerText === "거래처" || headerText === "월" || headerText === "비고") {
                cell.alignment = {
                  vertical: "middle",
                  horizontal: headerText === "비고" ? "left" : "center",
                };
                return;
              }

              if (ratioRowNumbers.has(rowNumber)) {
                if (typeof cell.value === "number") cell.numFmt = "0.0%";
                cell.alignment = { vertical: "middle", horizontal: "center" };
                return;
              }

              if (typeof cell.value === "number") {
                cell.numFmt = "#,##0";
                cell.alignment = { vertical: "middle", horizontal: "right" };
              } else {
                cell.alignment = { vertical: "middle", horizontal: "center" };
              }
            });
          });

          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          downloadBlob(blob, `${year}(손익표).xlsx`);
          return;
        }

        // --------------------------
        // (1-B) 월 전체 (신규)
        // --------------------------
        if (mode === "month") {
          const res = await excelApi.get("/HeadOffice/ExcelDaownMonthProfitLossTableList", {
            params: { year },
            responseType: "arraybuffer",
            headers: {
              Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          });

          const detected = detectExcelExtOrError(res.data);

          // ✅ 서버가 엑셀 → 그대로 다운로드 (가장 정확: 서버가 첨부형태로 주는 경우)
          if (detected.kind === "xlsx" || detected.kind === "xls") {
            const ext = detected.kind === "xls" ? "xls" : "xlsx";
            const blob = new Blob([res.data], {
              type:
                ext === "xls"
                  ? "application/vnd.ms-excel"
                  : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            downloadBlob(blob, `${year}(손익표-월전체).${ext}`);
            return;
          }

          // ✅ 서버가 JSON → 첨부 엑셀처럼 피벗해서 생성
          let rows;
          try {
            rows = arrayBufferToJson(res.data);
          } catch (e) {
            Swal.fire(
              "엑셀 다운로드 실패",
              `서버가 엑셀도 아니고 JSON 파싱도 실패했습니다.\n\n(앞부분)\n${
                detected.preview || ""
              }`,
              "error"
            );
            return;
          }

          if (!Array.isArray(rows) || rows.length === 0) {
            Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
            return;
          }

          if (!isMonthlyRecordArray(rows)) {
            Swal.fire(
              "월 전체 다운로드",
              "서버 JSON 구조가 월별 레코드(month 포함) 형태가 아니라서, 서버에서 엑셀로 내려주도록 확인이 필요합니다.\n(우선 서버 엑셀 응답을 권장)",
              "warning"
            );
            return;
          }

          const buffer = await buildMonthAllExcelLikeTemplate(rows);
          const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          downloadBlob(blob, `${year}(손익표-월전체).xlsx`);
          return;
        }

        return;
      }

      // ✅ 2) 전체가 아닐 때: 기존 조회 데이터(editRows)로 프론트에서 엑셀 생성
      if (!editRows || editRows.length === 0) {
        Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("손익표");

      buildTwoRowHeader(sheet, "월", "__month");

      const ratioRowNumbers = new Set();

      editRows.forEach((r) => {
        const valueObj = { __month: `${r.month}월` };

        filteredHeaders.forEach((h) => {
          h.cols.forEach((col) => {
            const key = fieldMap[col]?.value || col;
            valueObj[key] = r[key] ?? "";
          });
        });

        valueObj[fieldMap["영업이익"].value] = r[fieldMap["영업이익"].value] ?? 0;
        sheet.addRow(valueObj);

        const valueRowNo = sheet.lastRow.number;

        const ratioObj = { __month: "" };

        filteredHeaders.forEach((h) => {
          h.cols.forEach((col) => {
            const ratioKey = fieldMap[col]?.ratio;
            const valueKey = fieldMap[col]?.value || col;
            ratioObj[valueKey] = ratioKey ? toPercentCell(r?.[ratioKey]) : "";
          });
        });

        ratioObj[fieldMap["영업이익"].value] = toPercentCell(r?.[fieldMap["영업이익"].ratio]);
        sheet.addRow(ratioObj);

        const ratioRowNo = sheet.lastRow.number;
        ratioRowNumbers.add(ratioRowNo);

        sheet.mergeCells(valueRowNo, 1, ratioRowNo, 1);
      });

      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          cell.border = excelBorderThin;
          if (rowNumber <= 2) return;

          const headerText = sheet.getRow(2).getCell(colNumber).value;

          if (headerText === "월" || headerText === "비고") {
            cell.alignment = {
              vertical: "middle",
              horizontal: headerText === "비고" ? "left" : "center",
            };
            return;
          }

          if (ratioRowNumbers.has(rowNumber)) {
            if (typeof cell.value === "number") cell.numFmt = "0.0%";
            cell.alignment = { vertical: "middle", horizontal: "center" };
            return;
          }

          if (typeof cell.value === "number") {
            cell.numFmt = "#,##0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadBlob(blob, fileName);
    } catch (err) {
      Swal.fire("엑셀 다운로드 실패", err?.message || "오류가 발생했습니다.", "error");
    }
  };

  // ✅ 변경 저장
  const handleSave = async () => {
    const modifiedRows = editRows
      .map((row) => {
        const changedFields = {};

        editableNumberFields.forEach((field) => {
          if (field === "return_cost") {
            const rawKey = `__raw_${field}`;
            const raw = String(row?.[rawKey] ?? "")
              .replace(/,/g, "")
              .trim();

            if (raw === "-") {
              row[field] = null;
            } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
              row[field] = Number(raw);
            }
          }

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
      fetchProfitLossTableList(queryAccountId);
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // ✅ 숫자 입력 핸들러
  const handleInputChange = (rowIdx, field, value) => {
    const newRows = [...editRows];

    if (editableTextFields.includes(field)) {
      newRows[rowIdx][field] = value;
      setEditRows(newRows);
      return;
    }

    const rawKey = `__raw_${field}`;
    const raw = String(value ?? "");
    const cleaned = raw.replace(/,/g, "").trim();

    if (cleaned === "") {
      newRows[rowIdx][field] = null;
      newRows[rowIdx][rawKey] = "";
      setEditRows(newRows);
      return;
    }

    if (field === "return_cost") {
      if (cleaned === "-") {
        newRows[rowIdx][field] = null;
        newRows[rowIdx][rawKey] = "-";
        setEditRows(newRows);
        return;
      }

      const isNegative = cleaned.includes("-");
      const digits = cleaned.replace(/-/g, "");

      if (!/^\d+(\.\d+)?$/.test(digits)) {
        newRows[rowIdx][rawKey] = raw;
        setEditRows(newRows);
        return;
      }

      const n = Number(digits);
      newRows[rowIdx][field] = isNegative ? -n : n;
      newRows[rowIdx][rawKey] = "";
      setEditRows(newRows);
      return;
    }

    const isValidNumber = /^\d+(\.\d+)?$/.test(cleaned);
    if (!isValidNumber) {
      setEditRows(newRows);
      return;
    }

    newRows[rowIdx][field] = Number(cleaned);
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
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccount}
          onChange={(_, newValue) => {
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

        <MDButton
          variant="contained"
          color="info"
          size="small"
          onClick={handleRefresh}
          startIcon={<RefreshIcon />}
        >
          새로고침
        </MDButton>

        <MDButton
          variant="contained"
          color="success"
          size="small"
          onClick={handleExcelDownload}
          startIcon={<DownloadIcon />}
        >
          엑셀다운로드
        </MDButton>

        <MDButton variant="contained" color="info" size="small" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

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
                              ) : isNumber ? (
                                (() => {
                                  const rawKey = `__raw_${field}`;
                                  const displayValue =
                                    field === "return_cost" && r?.[rawKey]
                                      ? r[rawKey]
                                      : r[field] !== null && r[field] !== undefined
                                      ? formatNumber(r[field])
                                      : "";

                                  return (
                                    <input
                                      type="text"
                                      value={displayValue}
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
                                  );
                                })()
                              ) : (
                                <input
                                  type="text"
                                  value={formatNumber(r[field] ?? 0)}
                                  disabled
                                  style={{
                                    width: "80px",
                                    height: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    textAlign: "right",
                                    border: "none",
                                    background: "transparent",
                                    WebkitTextFillColor: "inherit",
                                    opacity: 1,
                                  }}
                                />
                              )}
                            </td>
                          );
                        })
                      )}

                      <td style={{ fontWeight: "bold", color: "#d32f2f" }}>
                        {formatNumber(r[fieldMap["영업이익"].value] ?? 0)}
                      </td>
                    </tr>

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
