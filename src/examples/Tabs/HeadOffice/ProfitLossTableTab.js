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
      account_type: accountTypeById.get(String(a.account_id)) ?? a.account_type ?? "", // ✅ 보강
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
    // "전체"는 특정 타입이 아니므로 기본은 숨김(원하면 true로 바꿔도 됨)
    if (selectedAccountId === "ALL") return false;

    const t = String(selectedAccount?.account_type ?? "").trim();

    console.log(t);

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
    "ALL",
  ]);

  // ✅ 전체("ALL")일 때는 false 처리됨
  const isHangyeol = HANGYEOL_ACCOUNT_IDS.has(String(selectedAccountId));

  // ✅ 화면 헤더 구조
  const headers = [
    { group: "인원", cols: ["생계인원", "일반인원", "인원합계"] },
    {
      group: "매출",
      cols: [
        "생계비",
        "일반식대",
        "직원식대",
        "주간일반",
        "주간직원",
        "보전",
        "반환금",
        "판장금",
        "매출소계",
      ],
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

      // ✅ 기존: 특정 거래처 아니면 주간 컬럼 숨김
      if (!isHangyeol) {
        cols = cols.filter((col) => !hiddenCols.includes(col));
      }

      // ✅ 추가: 학교 아니면 반환금 숨김
      if (!showReturnCost) {
        cols = cols.filter((col) => col !== "반환금");
      }

      return { ...h, cols };
    })
    // 혹시 그룹이 비면 헤더 깨짐 방지
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

  // ✅ 파일명에 못 쓰는 문자 제거(Windows 기준) + 길이 제한
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
    fgColor: { argb: "FFEFEFEF" }, // ✅ 연한 회색
  };

  // ✅ arraybuffer -> 매직넘버로 xlsx/xls/에러텍스트 판별
  const detectExcelExtOrError = (arrayBuffer) => {
    const u8 = new Uint8Array(arrayBuffer);
    if (u8.length < 4) return { kind: "unknown" };

    // xlsx(zip): 50 4B 03 04  => "PK.."
    const isXlsx =
      u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);

    // xls(ole): D0 CF 11 E0 A1 B1 1A E1
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

    // 그 외면 텍스트(HTML/JSON 등)일 가능성이 큼
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
    baseURL: api.defaults.baseURL, // 기존 api baseURL 재사용
    withCredentials: api.defaults.withCredentials,
    timeout: 60000,
    // ✅ transformResponse로 손대지 않음
    transformResponse: [(d) => d],
  });

  // arraybuffer -> json 파싱
  const arrayBufferToJson = (ab) => {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(ab));
    return JSON.parse(text);
  };

  const toPercentCell = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    if (Number.isNaN(n)) return "";

    // ✅ 0~1 사이는 이미 소수(0.315)로 보고 그대로
    if (n >= 0 && n <= 1) return n;

    // ✅ 1~100 사이는 퍼센트 값(31.5)으로 보고 /100
    if (n > 1 && n <= 100) return n / 100;

    // ✅ 그 외는 일단 그대로(예외 데이터 방어)
    return n;
  };

  const buildTwoRowHeader = (sheet, firstTitle, firstKey) => {
    const subCols = filteredHeaders.flatMap((h) => h.cols);
    const allHeaders = [firstTitle, ...subCols, "영업이익"];

    // ✅ 첫 컬럼 key를 인자로 받은 firstKey로
    sheet.columns = [
      { key: firstKey, width: firstTitle === "거래처" ? 22 : 10 },
      ...subCols.map((col) => ({
        key: fieldMap[col]?.value || col,
        width: col === "비고" ? 30 : 14,
      })),
      { key: fieldMap["영업이익"].value, width: 14 },
    ];

    // 1행(그룹)
    const topRowValues = new Array(allHeaders.length).fill(null);
    topRowValues[0] = firstTitle;
    topRowValues[allHeaders.length - 1] = "영업이익";

    let colIdx = 2;
    filteredHeaders.forEach((h) => {
      topRowValues[colIdx - 1] = h.group;
      colIdx += h.cols.length;
    });

    sheet.addRow(topRowValues); // row 1
    sheet.addRow(allHeaders); // row 2

    // 세로 병합
    sheet.mergeCells(1, 1, 2, 1);
    sheet.mergeCells(1, allHeaders.length, 2, allHeaders.length);

    // 그룹 가로 병합
    let start = 2;
    filteredHeaders.forEach((h) => {
      const end = start + h.cols.length - 1;
      sheet.mergeCells(1, start, 1, end);
      start = end + 1;
    });

    // 헤더 스타일
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

  // ✅ 엑셀 다운로드
  const handleExcelDownload = async () => {
    if (!selectedAccountId) return;

    // ✅ 파일명: 전체면 "연도(손익표)", 아니면 "거래처명"
    const accountName = selectedAccount?.account_name || "거래처";
    const fileName =
      selectedAccountId === "ALL"
        ? `${year}-손익표.xlsx`
        : `${year}-${sanitizeFilename(accountName)}.xlsx`;

    try {
      // ✅ 1) 전체(ALL)
      if (selectedAccountId === "ALL") {
        const res = await excelApi.get("/HeadOffice/ExcelDaownProfitLossTableList", {
          params: { year },
          responseType: "arraybuffer",
          headers: {
            Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        });

        const detected = detectExcelExtOrError(res.data);

        // ✅ (A) 서버가 진짜 엑셀을 준 경우 → 그대로 다운로드
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

        // ✅ (B) 서버가 JSON을 준 경우 → JSON을 ExcelJS로 만들어서 다운로드
        let rows;
        try {
          rows = arrayBufferToJson(res.data);
        } catch (e) {
          Swal.fire(
            "엑셀 다운로드 실패",
            `서버가 엑셀도 아니고 JSON 파싱도 실패했습니다.\n\n(앞부분)\n${detected.preview || ""}`,
            "error"
          );
          return;
        }

        if (!Array.isArray(rows) || rows.length === 0) {
          Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
          return;
        }

        // ✅ (B) 서버가 JSON을 준 경우 → 화면과 같은 컬럼 구성으로 ExcelJS 생성
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("손익표(전체)");

        // ✅ 화면과 동일한 컬럼 순서
        const columns = [
          { header: "거래처", key: "__account_month", width: 22 }, // ✅ 월 위치에 account_name만 추가
          ...filteredHeaders.flatMap((h) =>
            h.cols.map((col) => ({
              header: col,
              key: fieldMap[col]?.value || col,
              width: col === "비고" ? 30 : 14,
            }))
          ),
          { header: "영업이익", key: fieldMap["영업이익"].value, width: 14 },
        ];

        buildTwoRowHeader(sheet, "거래처", "__account_month");

        // ✅ 헤더 스타일(=th): 연한 회색 + Bold + 가운데 + 테두리
        const headerRow = sheet.getRow(1);
        headerRow.height = 18;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.fill = excelHeaderFill;
          cell.border = excelBorderThin;
        });

        const ratioRowNumbers = new Set();

        rows.forEach((r) => {
          const m = r?.month ?? r?.mm ?? r?.mon ?? "";
          const monthText = m !== "" ? `${m}월` : "";

          // 1) 값행
          const valueObj = {
            __account_month: `${r?.account_name ?? ""}${r?.account_name ? "" : ""}${monthText}`,
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

          // 2) 비율행 (같은 컬럼에 ratio 값 넣기)
          const ratioObj = {
            __account_month: "", // ✅ 화면 rowSpan 느낌(아래행은 비워둠)
          };

          filteredHeaders.forEach((h) => {
            h.cols.forEach((col) => {
              const ratioKey = fieldMap[col]?.ratio;
              const valueKey = fieldMap[col]?.value || col;

              // 비고 같은 ratio 없는 컬럼은 공백
              ratioObj[valueKey] = ratioKey ? toPercentCell(r?.[ratioKey]) : "";
            });
          });

          ratioObj[fieldMap["영업이익"].value] = toPercentCell(r?.[fieldMap["영업이익"].ratio]);
          sheet.addRow(ratioObj);

          const ratioRowNo = sheet.lastRow.number;
          ratioRowNumbers.add(ratioRowNo);

          // ✅ 첫 컬럼(거래처/월) 두 줄 병합 (엑셀에서 보기 좋게)
          sheet.mergeCells(valueRowNo, 1, ratioRowNo, 1);
        });

        // ✅ 숫자/비율 포맷 + 전체 테두리
        sheet.eachRow((row, rowNumber) => {
          row.eachCell((cell, colNumber) => {
            cell.border = excelBorderThin;

            // ✅ 헤더 1~2행은 이미 스타일 적용됨
            if (rowNumber <= 2) return;

            // ✅ 헤더명은 2행(하위 헤더) 기준으로 판단
            const headerText = sheet.getRow(2).getCell(colNumber).value;

            // 첫 컬럼/비고는 텍스트
            if (headerText === "거래처/월" || headerText === "월" || headerText === "비고") {
              cell.alignment = {
                vertical: "middle",
                horizontal: headerText === "비고" ? "left" : "center",
              };
              return;
            }

            // ✅ 비율행은 퍼센트 포맷 적용
            if (ratioRowNumbers.has(rowNumber)) {
              if (typeof cell.value === "number") {
                cell.numFmt = "0.0%";
              }
              cell.alignment = { vertical: "middle", horizontal: "center" };
              return;
            }

            // ✅ 값행은 천단위
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

      // 2) 전체가 아닐 때: 기존 조회 데이터(editRows)로 프론트에서 엑셀 생성
      if (!editRows || editRows.length === 0) {
        Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("손익표");

      // ✅ 컬럼 순서: 화면과 동일하게 (월 + filteredHeaders + 영업이익)
      const columns = [
        { header: "월", key: "__month", width: 8 },
        ...filteredHeaders.flatMap((h) =>
          h.cols.map((col) => ({
            header: col,
            key: fieldMap[col]?.value || col,
            width: col === "비고" ? 30 : 14,
          }))
        ),
        { header: "영업이익", key: fieldMap["영업이익"].value, width: 14 },
      ];

      buildTwoRowHeader(sheet, "월", "__month");

      // ✅ 헤더 스타일(=th): 연한 회색 + Bold + 가운데 + 테두리
      const headerRow = sheet.getRow(1);
      headerRow.height = 18;

      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = excelHeaderFill;
        cell.border = excelBorderThin;
      });

      const ratioRowNumbers = new Set();

      editRows.forEach((r) => {
        // 1) 값행
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

        // 2) 비율행
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

        // ✅ 월 컬럼 병합(화면 rowSpan 느낌)
        sheet.mergeCells(valueRowNo, 1, ratioRowNo, 1);
      });

      // ✅ 숫자/비율 포맷 + 전체 테두리
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          cell.border = excelBorderThin;

          // ✅ 헤더 1~2행은 이미 스타일 적용됨
          if (rowNumber <= 2) return;

          // ✅ 헤더명은 2행(하위 헤더) 기준으로 판단
          const headerText = sheet.getRow(2).getCell(colNumber).value;

          // 첫 컬럼/비고는 텍스트
          if (headerText === "거래처/월" || headerText === "월" || headerText === "비고") {
            cell.alignment = {
              vertical: "middle",
              horizontal: headerText === "비고" ? "left" : "center",
            };
            return;
          }

          // ✅ 비율행은 퍼센트 포맷 적용
          if (ratioRowNumbers.has(rowNumber)) {
            if (typeof cell.value === "number") {
              cell.numFmt = "0.0%";
            }
            cell.alignment = { vertical: "middle", horizontal: "center" };
            return;
          }

          // ✅ 값행은 천단위
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
          // ✅ return_cost raw가 남아있으면 숫자로 정리(또는 null)
          if (field === "return_cost") {
            const rawKey = `__raw_${field}`;
            const raw = String(row?.[rawKey] ?? "")
              .replace(/,/g, "")
              .trim();

            if (raw === "-") {
              row[field] = null; // 미완성 입력은 null 처리
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

  // ✅ 숫자 입력 핸들러 (콤마 제거 → 숫자 저장)
  // ✅ 숫자 입력 핸들러 (콤마 제거 → 숫자 저장)
  //    return_cost는 "-" 같은 중간 입력도 허용하기 위해 raw를 같이 관리
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

    // 빈값
    if (cleaned === "") {
      newRows[rowIdx][field] = null;
      newRows[rowIdx][rawKey] = "";
      setEditRows(newRows);
      return;
    }

    // ✅ return_cost: 마이너스를 "어디서 치든" 허용
    if (field === "return_cost") {
      // '-'만 있는 중간 입력 허용
      if (cleaned === "-") {
        newRows[rowIdx][field] = null;
        newRows[rowIdx][rawKey] = "-";
        setEditRows(newRows);
        return;
      }

      // '-'가 포함되어 있으면 음수로 간주하고 '-' 제거 후 숫자만 남김
      const isNegative = cleaned.includes("-");
      const digits = cleaned.replace(/-/g, "");

      // 숫자만 허용 (정수만이면: /^\d+$/)
      if (!/^\d+(\.\d+)?$/.test(digits)) {
        // 입력 중인 값은 그대로 보여주기
        newRows[rowIdx][rawKey] = raw;
        setEditRows(newRows);
        return;
      }

      const n = Number(digits);
      newRows[rowIdx][field] = isNegative ? -n : n;
      newRows[rowIdx][rawKey] = ""; // 정상 숫자가 되면 raw는 비움
      setEditRows(newRows);
      return;
    }

    // ✅ 그 외 일반 숫자 필드
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
        {/* ✅ 거래처 검색 가능한 Autocomplete (전체 옵션 포함) */}
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

        {/* ✅ 새로고침 오른쪽: 엑셀다운로드 */}
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
