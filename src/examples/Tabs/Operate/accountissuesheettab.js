/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Grid,
  IconButton,
  Modal,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import useAccountIssueSheetTabData from "./accountissuesheettabData";

// ✅ 테이블 기본 톤(AccountMemberSheetTab 톤)
const TABLE_STYLE = {
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
};

// ✅ 공통 헤더 셀 스타일
const TH_STYLE = {
  border: "1px solid #686D76",
  padding: "4px",
  fontSize: 12,
  background: "#f0f0f0",
  whiteSpace: "nowrap",
};

// ✅ 공통 본문 셀 스타일
const TD_STYLE = {
  border: "1px solid #686D76",
  padding: "4px",
  fontSize: 12,
  whiteSpace: "nowrap",
};

// ✅ input 공통 기본 스타일
const INPUT_STYLE = {
  width: "100%",
  boxSizing: "border-box",
  height: 30,
  fontSize: 12,
  fontFamily: "inherit",
  border: "none",
  outline: "none",
  background: "transparent",
};

// ✅ textarea 공통 기본 스타일
const TEXTAREA_STYLE = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 30,
  height: 30,
  fontSize: 12,
  fontFamily: "inherit",
  border: "none",
  outline: "none",
  background: "transparent",
  resize: "none",
  overflow: "hidden",
  lineHeight: 1.35,
  padding: 0,
};

// ✅ 좌/우 패널 높이 및 텍스트 입력 표시 규칙 상수
const PANEL_HEIGHT = "calc(100vh - 190px)";
const RIGHT_WARN_BORDER = "#d99292"; // ✅ 너무 쨍하지 않은 빨강
const MAX_TEXTAREA_ROWS = 5;
const PREVIEW_TEXTAREA_HEIGHT = 36; // 2줄 미리보기 높이
const TEXTAREA_LINE_HEIGHT = 18; // 선택 행 textarea 줄높이

// ✅ 마감일 경고 색상(보류 전용)
const DEADLINE_WARN_COLOR = "#b28704"; // D-3 ~ D-day
const DEADLINE_DANGER_COLOR = "#d32f2f"; // 기한 경과

// ✅ 결과 상태별 텍스트 색(요약 배경 톤에 맞춤)
const getResultTextColor = (value) => {
  const code = String(value ?? "").trim();
  if (code === "2" || code === "해결") return "#2e7d32"; // 해결
  if (code === "1" || code === "보류") return "#b28704"; // 보류
  return "#111";
};

// ✅ 오른쪽 요약 배지(총/해결/보류/미입력) 계산
const summarizeRows = (list) =>
  (list || []).reduce(
    (acc, row) => {
      acc.total += 1;

      if (row.resultCode === "2") {
        acc.resolved += 1;
      } else {
        acc.unresolved += 1;
        if (row.resultCode === "1") acc.pending += 1;
        if (!row.resultCode) acc.noResult += 1;
      }

      return acc;
    },
    {
      total: 0,
      resolved: 0,
      unresolved: 0,
      pending: 0,
      noResult: 0,
    }
  );

// ✅ 날짜 문자열을 "날짜(00:00)" 기준으로 변환
const toDateOnly = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

// ✅ 보류 상태일 때만 마감일 임박/지연 색상 계산
const getPendingDeadlineColor = (resultCode, endDate) => {
  const normalizedResult = String(resultCode || "").trim();
  if (normalizedResult !== "1" && normalizedResult !== "보류") return "";

  const targetDate = toDateOnly(endDate);
  if (!targetDate) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return DEADLINE_DANGER_COLOR;
  if (diffDays <= 3) return DEADLINE_WARN_COLOR;
  return "";
};

export default function AccountIssueSheetTab() {
  // ✅ 데이터(백엔드) 훅은 Data 파일에서만 관리
  const {
    loading,
    rows,
    originalRows,
    accountOptions,
    typeOptions,
    isCustomerIssueTeam,
    resultOptions,

    updateRowValue,
    updateAccount,
    addRow,
    deleteRow,
    saveRows,

    typeModalOpen,
    typeRows,
    openTypeModal,
    closeTypeModal,
    addTypeRow,
    updateTypeRow,
    deleteTypeRow,
    saveTypeRows,
  } = useAccountIssueSheetTabData(1);

  // ✅ 좌/우 테이블 선택 및 스크롤 상태
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState("");
  const leftTableScrollRef = useRef(null);

  // ✅ 고객사 이슈 화면은 이슈/해결방안/비고 폭을 더 넓게
  const leftColWidth = (colKey) => {
    const customerSize = {
      sub_date: 96,
      account_id: 120, // 요청: 지점 컬럼 우측으로 확장
      type: 84,
      issue: 280,
      result: 80,
      end_date: 96,
      solution: 280,
      note: 250,
      delete: 58,
    };

    const defaultSize = {
      sub_date: 96,
      account_id: 120,
      type: 84,
      issue: 220,
      result: 80,
      end_date: 96,
      solution: 220,
      note: 170,
      delete: 58,
    };

    const map = isCustomerIssueTeam ? customerSize : defaultSize;
    return map[colKey] || 100;
  };

  // ✅ account_id -> 지점명 매핑(표시용)
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountOptions || []).forEach((opt) => {
      map.set(String(opt.value), opt.label || String(opt.value));
    });
    return map;
  }, [accountOptions]);

  // ✅ 구분 코드 -> 구분명 매핑
  const typeLabelById = useMemo(() => {
    const map = new Map();
    (typeOptions || []).forEach((opt) => {
      map.set(String(opt.value), opt.label || String(opt.value));
    });
    return map;
  }, [typeOptions]);

  // ✅ 결과 코드 -> 결과명 매핑
  const resultLabelByValue = useMemo(() => {
    const map = new Map();
    (resultOptions || []).forEach((opt) => {
      map.set(String(opt.value || ""), opt.label || String(opt.value));
    });
    return map;
  }, [resultOptions]);

  // ✅ 변경 여부 비교를 위한 원본 행 맵
  const originalRowById = useMemo(() => {
    const map = new Map();
    (originalRows || []).forEach((row) => {
      map.set(String(row.id), row);
    });
    return map;
  }, [originalRows]);

  // ✅ 변경 셀 빨간색 표시
  const isCellChanged = (row, key) => {
    const current = String(row?.[key] ?? "");
    const original = originalRowById.get(String(row?.id));
    if (!original) return current.trim() !== "";
    return current !== String(original?.[key] ?? "");
  };

  // ✅ 일반 입력 셀(날짜/선택)의 변경 강조 스타일
  const getEditableStyle = (row, key) => ({
    ...INPUT_STYLE,
    color: isCellChanged(row, key) ? "#d32f2f" : "#111",
    fontWeight: isCellChanged(row, key) ? 700 : 400,
  });

  // ✅ 장문 텍스트 셀(이슈/해결방안/비고)의 공통 스타일
  const getTextareaStyle = (row, key) => ({
    ...TEXTAREA_STYLE,
    color: isCellChanged(row, key) ? "#d32f2f" : "#111",
    fontWeight: 400,
    textAlign: "left",
  });

  // ✅ 지점 컬럼은 account_id/account_name 둘 중 하나라도 바뀌면 변경 표시
  const getAccountEditableStyle = (row) => {
    const changed = isCellChanged(row, "account_id") || isCellChanged(row, "account_name");
    return {
      ...INPUT_STYLE,
      color: changed ? "#d32f2f" : "#111",
      fontWeight: changed ? 700 : 400,
    };
  };

  // ✅ 결과 컬럼은 변경색보다 상태색 우선 적용
  const getResultEditableStyle = (row) => ({
    ...getEditableStyle(row, "result"),
    color: getResultTextColor(row?.result),
    fontWeight: row?.result ? 700 : 400,
  });

  // ✅ 마감일은 "보류 + 기한 임박/경과" 색상을 우선 적용
  const getEndDateEditableStyle = (row) => {
    const base = getEditableStyle(row, "end_date");
    const deadlineColor = getPendingDeadlineColor(row?.result, row?.end_date);
    if (!deadlineColor) return base;
    return {
      ...base,
      color: deadlineColor,
      fontWeight: 700,
    };
  };

  // ✅ 지점 셀 표시값: account_id 우선, 없으면 직접 입력한 account_name 사용
  const getAccountDisplayValue = (row) => {
    const accountId = String(row?.account_id || "").trim();
    if (accountId) {
      return accountNameById.get(accountId) || String(row?.account_name || accountId);
    }
    return String(row?.account_name || "");
  };

  // ✅ 입력한 지점명이 목록에 있으면 해당 account_id로 매핑
  const findAccountOption = (keyword) => {
    const target = String(keyword || "").trim();
    if (!target) return null;
    return (accountOptions || []).find((opt) => String(opt.label || "").trim() === target) || null;
  };

  // ✅ 선택 행 textarea는 항상 5줄로 고정
  const getSelectedTextareaRows = () => MAX_TEXTAREA_ROWS;

  // ✅ 선택된 행의 텍스트 입력칸은 항상 5줄 높이 + 내부 스크롤로 고정
  const getSelectedTextareaStyle = (row, key) => {
    return {
      ...getTextareaStyle(row, key),
      height: `${TEXTAREA_LINE_HEIGHT * MAX_TEXTAREA_ROWS + 6}px`,
      minHeight: `${TEXTAREA_LINE_HEIGHT * MAX_TEXTAREA_ROWS + 6}px`,
      maxHeight: `${TEXTAREA_LINE_HEIGHT * MAX_TEXTAREA_ROWS + 6}px`,
      overflowY: "auto",
      lineHeight: `${TEXTAREA_LINE_HEIGHT}px`,
      padding: "2px 0",
    };
  };

  // ✅ 지점 셀 편집 처리(목록 매칭 시 ID 저장, 미매칭 시 자유입력 이름 저장)
  const handleAccountInputChange = (rowId, inputValue) => {
    const keyword = String(inputValue || "");
    const matched = findAccountOption(keyword);

    if (matched) {
      updateAccount(rowId, matched.value);
      setSelectedAccountKey(`id:${matched.value}`);
      return;
    }

    updateRowValue(rowId, "account_id", "");
    updateRowValue(rowId, "account_name", keyword);
  };

  // ✅ 행추가 시 마지막 행이 바로 보이도록 스크롤 이동
  const scrollLeftTableToBottom = () => {
    if (!leftTableScrollRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = leftTableScrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    });
  };

  const handleAddRowClick = () => {
    // 행추가 직후 왼쪽 편집 테이블의 스크롤을 맨 아래로 이동
    addRow();
    scrollLeftTableToBottom();
  };

  // ✅ 오른쪽 집계용 지점 키/이름 표준화
  const normalizeAccountMeta = (row) => {
    const accountId = String(row?.account_id || "").trim();
    const typedName = String(row?.account_name || "").trim();
    const mappedName = accountNameById.get(accountId) || "";

    if (accountId) {
      return {
        key: `id:${accountId}`,
        accountId,
        accountName: mappedName || typedName || accountId,
      };
    }

    if (typedName) {
      return {
        key: `name:${typedName}`,
        accountId: "",
        accountName: typedName,
      };
    }

    return {
      key: "unassigned",
      accountId: "",
      accountName: "미지정",
    };
  };

  // 저장된 원본 기준으로만 오른쪽 통계/테이블을 렌더링한다.
  const analysisRows = useMemo(() => {
    return (originalRows || [])
      .filter((row) =>
        Boolean(
          row?.sub_date ||
          row?.account_id ||
          row?.account_name ||
          row?.type ||
          row?.issue ||
          row?.result ||
          row?.end_date ||
          row?.solution ||
          row?.note
        )
      )
      .map((row) => {
        const meta = normalizeAccountMeta(row);
        const typeCode = String(row?.type || "").trim();
        const resultCode = String(row?.result || "").trim();

        return {
          ...row,
          accountKey: meta.key,
          accountName: meta.accountName,
          typeLabel: typeLabelById.get(typeCode) || typeCode || "-",
          resultCode,
          resultLabel: resultLabelByValue.get(resultCode) || "미입력",
        };
      });
  }, [originalRows, accountNameById, typeLabelById, resultLabelByValue]);

  // ✅ 오른쪽 요약(지점별 총/해결/보류/미입력) 데이터
  const accountSummaryRows = useMemo(() => {
    const map = new Map();

    analysisRows.forEach((row) => {
      if (!map.has(row.accountKey)) {
        map.set(row.accountKey, {
          key: row.accountKey,
          accountName: row.accountName,
          total: 0,
          resolved: 0,
          pending: 0,
          noResult: 0,
          unresolved: 0,
        });
      }

      const target = map.get(row.accountKey);
      target.total += 1;

      if (row.resultCode === "2") {
        target.resolved += 1;
      } else {
        target.unresolved += 1;
        if (row.resultCode === "1") target.pending += 1;
        if (!row.resultCode) target.noResult += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.unresolved !== a.unresolved) return b.unresolved - a.unresolved;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.accountName).localeCompare(String(b.accountName), "ko");
    });
  }, [analysisRows]);

  // ✅ 우측 필터에서 선택된 지점 요약
  const selectedSummary = useMemo(
    () => accountSummaryRows.find((row) => row.key === selectedAccountKey) || null,
    [accountSummaryRows, selectedAccountKey]
  );

  // ✅ 우측 "지점별 확인" 대상 행(선택 지점 필터 반영)
  const scopedRows = useMemo(() => {
    if (!selectedAccountKey) return analysisRows;
    return analysisRows.filter((row) => row.accountKey === selectedAccountKey);
  }, [analysisRows, selectedAccountKey]);

  // ✅ 우측 상세 테이블 표시 순서를 접수일/idx 기준으로 정렬
  const scopedRowsSorted = useMemo(
    () =>
      [...scopedRows].sort((a, b) => {
        const aDate = a.sub_date || "9999-12-31";
        const bDate = b.sub_date || "9999-12-31";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return String(a.idx || a.id || "").localeCompare(String(b.idx || b.id || ""));
      }),
    [scopedRows]
  );

  // ✅ 우측 "미해결건 확인"은 해결(2) 제외
  const unresolvedRows = useMemo(
    () =>
      analysisRows
        .filter((row) => row.resultCode !== "2")
        .sort((a, b) => {
          const aDate = a.sub_date || "9999-12-31";
          const bDate = b.sub_date || "9999-12-31";
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return String(a.idx || a.id || "").localeCompare(String(b.idx || b.id || ""));
        }),
    [analysisRows]
  );

  // ✅ 우측 상단 배지(전체 또는 선택 지점)
  const overallSummary = useMemo(() => summarizeRows(analysisRows), [analysisRows]);
  // ✅ 선택 고객사가 있으면 선택 집계, 없으면 전체 집계를 표시
  const currentSummary = selectedSummary || overallSummary;
  const selectedAccountName = selectedSummary?.accountName || "";

  // ✅ 선택한 고객사 키가 사라지면 전체로 자동 복귀
  useEffect(() => {
    if (!selectedAccountKey) return;
    if (accountSummaryRows.some((row) => row.key === selectedAccountKey)) return;
    setSelectedAccountKey("");
  }, [selectedAccountKey, accountSummaryRows]);

  // ✅ 삭제 등으로 선택 행이 사라진 경우 선택 상태 초기화
  useEffect(() => {
    if (!selectedRowId) return;
    if ((rows || []).some((row) => row.id === selectedRowId)) return;
    setSelectedRowId(null);
  }, [selectedRowId, rows]);

  // ✅ 왼쪽 행 선택 시 오른쪽 고객사 필터를 동일 고객사로 동기화
  const handleRowSelect = (row) => {
    setSelectedRowId(row.id);

    const meta = normalizeAccountMeta(row);
    if (meta.key && meta.key !== "unassigned") {
      setSelectedAccountKey(meta.key);
    }
  };

  // ✅ 오른쪽 상세 테이블 렌더
  const renderRightDetailTable = (list, emptyText, showAccount = true) => {
    if (!list || list.length === 0) {
      return <Box sx={{ padding: 1, fontSize: 12, color: "#666" }}>{emptyText}</Box>;
    }

    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: isCustomerIssueTeam ? 1080 : 860,
          tableLayout: "auto",
        }}
      >
        {/* ✅ 팀 유형별 요구 순서로 헤더 구성
            - 고객사 이슈(team1): 접수일 고객사 구분 이슈 결과 마감일 해결방안 비고
            - deadline(team2): 접수일 고객사 구분 이슈 결과 마감일 비고 */}
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, width: "1%", minWidth: 92 }}>접수일</th>
            {showAccount && <th style={{ ...TH_STYLE, width: "1%", minWidth: 108 }}>고객사</th>}
            <th style={{ ...TH_STYLE, width: "1%", minWidth: 78 }}>구분</th>
            <th style={{ ...TH_STYLE, width: 240, minWidth: 240 }}>이슈</th>
            <th style={{ ...TH_STYLE, width: "1%", minWidth: 78 }}>결과</th>
            <th style={{ ...TH_STYLE, width: "1%", minWidth: 92 }}>마감일</th>
            {isCustomerIssueTeam && <th style={{ ...TH_STYLE, width: 240, minWidth: 240 }}>해결방안</th>}
            <th style={{ ...TH_STYLE, width: 220, minWidth: 220 }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => {
            return (
              <tr key={`detail_${row.id}`}>
                <td style={{ ...TD_STYLE, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.sub_date || "-"}
                </td>
                {showAccount && (
                  <td style={{ ...TD_STYLE, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.accountName || "-"}
                  </td>
                )}
                <td style={{ ...TD_STYLE, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.typeLabel || "-"}
                </td>
                <td
                  style={{
                    ...TD_STYLE,
                    textAlign: "left",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.35,
                    minWidth: 240,
                    maxWidth: 240,
                  }}
                >
                  {row.issue || "-"}
                </td>
                <td
                  style={{
                    ...TD_STYLE,
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: getResultTextColor(row.resultCode),
                    fontWeight: row.resultCode ? 700 : 400,
                  }}
                >
                  {row.resultLabel || "미입력"}
                </td>
                {/* ✅ 마감일은 다른 컬럼과 동일한 기본 텍스트 색상으로 표시 */}
                <td style={{ ...TD_STYLE, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.end_date || "-"}
                </td>
                {isCustomerIssueTeam && (
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: "left",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.35,
                      minWidth: 240,
                      maxWidth: 240,
                    }}
                  >
                    {row.solution || "-"}
                  </td>
                )}
                <td
                  style={{
                    ...TD_STYLE,
                    textAlign: "left",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.35,
                    minWidth: 220,
                    maxWidth: 220,
                  }}
                >
                  {row.note || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // ✅ 왼쪽 입력 테이블 렌더
  const renderLeftTable = () => (
    <Box
      ref={leftTableScrollRef}
      sx={{
        width: { xs: "100%", lg: "50%" },
        border: "1px solid #686D76",
        overflow: "auto",
        height: PANEL_HEIGHT,
        maxHeight: PANEL_HEIGHT,
        "& th, & td": {
          border: "1px solid #686D76",
          textAlign: "center",
          padding: "4px",
          fontSize: "12px",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
        },
        "& th": {
          backgroundColor: "#f0f0f0",
          position: "sticky",
          top: 0,
          zIndex: 2,
        },
        "& select": {
          fontSize: "12px",
          minWidth: "80px",
          border: "none",
          background: "transparent",
          outline: "none",
          cursor: "pointer",
        },
      }}
    >
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, width: leftColWidth("sub_date") }}>접수일</th>
            <th style={{ ...TH_STYLE, width: leftColWidth("account_id") }}>고객사</th>
            <th style={{ ...TH_STYLE, width: leftColWidth("type") }}>구분</th>
            <th style={{ ...TH_STYLE, width: leftColWidth("issue") }}>이슈</th>
            <th style={{ ...TH_STYLE, width: leftColWidth("result") }}>결과</th>
            <th style={{ ...TH_STYLE, width: leftColWidth("end_date") }}>마감일</th>
            {isCustomerIssueTeam && <th style={{ ...TH_STYLE, width: leftColWidth("solution") }}>해결방안</th>}
            {isCustomerIssueTeam && <th style={{ ...TH_STYLE, width: leftColWidth("note") }}>비고</th>}
            <th style={{ ...TH_STYLE, width: leftColWidth("delete") }}>삭제</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((row) => {
            const isSelected = selectedRowId === row.id;
            const accountEditableStyle = getAccountEditableStyle(row);
            const selectedAccountOption =
              accountOptions.find((opt) => String(opt.value) === String(row.account_id || "")) || null;

            return (
              <tr
                key={row.id}
                onClick={() => handleRowSelect(row)}
                style={{ background: isSelected ? "#fff7e6" : "#fff" }}
              >
                <td style={{ ...TD_STYLE, width: leftColWidth("sub_date") }}>
                  <input
                    type="date"
                    value={row.sub_date || ""}
                    onChange={(e) => updateRowValue(row.id, "sub_date", e.target.value || "")}
                    style={getEditableStyle(row, "sub_date")}
                  />
                </td>

                <td style={{ ...TD_STYLE, width: leftColWidth("account_id"), whiteSpace: "normal" }}>
                  {/* ✅ 고객사 셀 */}
                  {isSelected ? (
                    <Autocomplete
                      size="small"
                      options={accountOptions}
                      value={selectedAccountOption}
                      inputValue={getAccountDisplayValue(row)}
                      onChange={(_, opt) => {
                        if (!opt) {
                          handleAccountInputChange(row.id, "");
                          return;
                        }
                        updateAccount(row.id, opt.value);
                        setSelectedAccountKey(`id:${opt.value}`);
                      }}
                      onInputChange={(_, newValue, reason) => {
                        if (reason === "input" || reason === "clear") {
                          handleAccountInputChange(row.id, newValue || "");
                        }
                      }}
                      getOptionLabel={(opt) => opt?.label ?? ""}
                      isOptionEqualToValue={(opt, val) => opt.value === val.value}
                      renderOption={(props, option) => (
                        <li
                          {...props}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            boxSizing: "border-box",
                            margin: 0,
                            borderRadius: 0,
                            fontSize: 0,
                            minHeight: 28,
                            padding: 0,
                            background: "transparent",
                          }}
                        >
                          <Box
                            component="span"
                            className="account-option-inner"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              width: 160,
                              ml: "6px",
                              minHeight: 28,
                              px: "10px",
                              boxSizing: "border-box",
                              borderRadius: "4px",
                              fontSize: "12px",
                              color: accountEditableStyle.color,
                              fontWeight: accountEditableStyle.fontWeight,
                              background: "#fff",
                            }}
                          >
                            {option.label}
                          </Box>
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="standard"
                          placeholder="고객사 검색"
                          InputProps={{
                            ...params.InputProps,
                            disableUnderline: true,
                          }}
                          inputProps={{
                            ...params.inputProps,
                            style: {
                              fontSize: "12px",
                              padding: 0,
                              color: accountEditableStyle.color,
                              fontWeight: accountEditableStyle.fontWeight,
                              fontFamily: "inherit",
                            },
                          }}
                        />
                      )}
                      sx={{
                        minWidth: leftColWidth("account_id"),
                        "& .MuiInputBase-root": { minHeight: 24 },
                        "& .MuiAutocomplete-input": {
                          fontSize: "12px",
                          padding: "0px !important",
                          color: accountEditableStyle.color,
                          fontWeight: accountEditableStyle.fontWeight,
                          fontFamily: "inherit",
                        },
                        "& .MuiSvgIcon-root": {
                          fontSize: 18,
                          color: accountEditableStyle.color,
                        },
                        "& .MuiAutocomplete-listbox": { padding: "3px 0" },
                        "& .MuiAutocomplete-option": {
                          fontSize: 0,
                          minHeight: 28,
                          width: "100%",
                          boxSizing: "border-box",
                          margin: 0,
                          borderRadius: 0,
                          padding: "0 !important",
                          backgroundColor: "transparent !important",
                        },
                      }}
                      ListboxProps={{
                        style: {
                          fontSize: "12px",
                          padding: "3px 0",
                          margin: 0,
                          boxSizing: "border-box",
                          backgroundColor: "#fff",
                        },
                      }}
                      slotProps={{
                        popper: {
                          sx: {
                            width: "176px !important",
                            minWidth: "176px !important",
                            "& .MuiAutocomplete-paper": {
                              minWidth: 176,
                              width: 176,
                              maxWidth: 176,
                              backgroundColor: "#fff !important",
                            },
                            "& .MuiAutocomplete-listbox": {
                              padding: "3px 0",
                              margin: 0,
                              boxSizing: "border-box",
                              backgroundColor: "#fff !important",
                            },
                            "& .MuiAutocomplete-option": {
                              width: "100%",
                              margin: 0,
                              borderRadius: 0,
                              boxSizing: "border-box",
                              minHeight: 28,
                              padding: "0 !important",
                              backgroundColor: "transparent !important",
                            },
                            "& .MuiAutocomplete-option:hover": {
                              backgroundColor: "transparent !important",
                            },
                            "& .MuiAutocomplete-option.Mui-focused": {
                              backgroundColor: "transparent !important",
                            },
                            "& .MuiAutocomplete-option[aria-selected='true']": {
                              backgroundColor: "transparent !important",
                            },
                            "& .MuiAutocomplete-option .account-option-inner": {
                              width: 160,
                              margin: 0,
                              marginLeft: "6px",
                              backgroundColor: "#fff",
                            },
                            "& .MuiAutocomplete-option[aria-selected='true'] .account-option-inner": {
                              backgroundColor: "#fff",
                            },
                            "& .MuiAutocomplete-option.Mui-focused .account-option-inner": {
                              backgroundColor: "#e0e0e0",
                            },
                            "& .MuiAutocomplete-option:hover .account-option-inner": {
                              backgroundColor: "#e0e0e0",
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        ...getAccountEditableStyle(row),
                        display: "flex",
                        alignItems: "center",
                        height: 24,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getAccountDisplayValue(row) || "-"}
                    </Box>
                  )}
                </td>

                <td style={{ ...TD_STYLE, width: leftColWidth("type") }}>
                  <select
                    value={row.type || ""}
                    onChange={(e) => updateRowValue(row.id, "type", e.target.value)}
                    style={getEditableStyle(row, "type")}
                  >
                    <option value="">선택</option>
                    {(typeOptions || []).map((opt) => (
                      <option key={opt.value} value={opt.value} style={{ color: "#111" }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ ...TD_STYLE, width: leftColWidth("issue"), whiteSpace: "normal", verticalAlign: "top" }}>
                  {/* ✅ 텍스트 셀 */}
                  {isSelected ? (
                    <textarea
                      value={row.issue || ""}
                      onChange={(e) => updateRowValue(row.id, "issue", e.target.value)}
                      rows={getSelectedTextareaRows()}
                      style={getSelectedTextareaStyle(row, "issue")}
                    />
                  ) : (
                    <Box
                      sx={{
                        ...getTextareaStyle(row, "issue"),
                        maxHeight: PREVIEW_TEXTAREA_HEIGHT,
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.35,
                      }}
                    >
                      {row.issue || ""}
                    </Box>
                  )}
                </td>

                <td style={{ ...TD_STYLE, width: leftColWidth("result") }}>
                  <select
                    value={row.result || ""}
                    onChange={(e) => updateRowValue(row.id, "result", e.target.value)}
                    style={getResultEditableStyle(row)}
                  >
                    {(resultOptions || []).map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value} style={{ color: "#111" }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ ...TD_STYLE, width: leftColWidth("end_date") }}>
                  <input
                    type="date"
                    value={row.end_date || ""}
                    onChange={(e) => updateRowValue(row.id, "end_date", e.target.value || "")}
                    style={getEndDateEditableStyle(row)}
                  />
                </td>

                {isCustomerIssueTeam && (
                  <td
                    style={{ ...TD_STYLE, width: leftColWidth("solution"), whiteSpace: "normal", verticalAlign: "top" }}
                  >
                    {isSelected ? (
                      <textarea
                        value={row.solution || ""}
                        onChange={(e) => updateRowValue(row.id, "solution", e.target.value)}
                        rows={getSelectedTextareaRows()}
                        style={getSelectedTextareaStyle(row, "solution")}
                      />
                    ) : (
                      <Box
                        sx={{
                          ...getTextareaStyle(row, "solution"),
                          maxHeight: PREVIEW_TEXTAREA_HEIGHT,
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.35,
                        }}
                      >
                        {row.solution || ""}
                      </Box>
                    )}
                  </td>
                )}

                {isCustomerIssueTeam && (
                  <td style={{ ...TD_STYLE, width: leftColWidth("note"), whiteSpace: "normal", verticalAlign: "top" }}>
                    {isSelected ? (
                      <textarea
                        value={row.note || ""}
                        onChange={(e) => updateRowValue(row.id, "note", e.target.value)}
                        rows={getSelectedTextareaRows()}
                        style={getSelectedTextareaStyle(row, "note")}
                      />
                    ) : (
                      <Box
                        sx={{
                          ...getTextareaStyle(row, "note"),
                          maxHeight: PREVIEW_TEXTAREA_HEIGHT,
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.35,
                        }}
                      >
                        {row.note || ""}
                      </Box>
                    )}
                  </td>
                )}

                <td style={{ ...TD_STYLE, width: leftColWidth("delete") }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRow(row.id);
                    }}
                    style={{ height: 30, fontSize: 12, minWidth: 44 }}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );

  // ✅ 오른쪽 패널은 저장 기준 데이터만 렌더
  const rightPanelNode = useMemo(() => {
    return (
      <Box
        sx={{
          width: { xs: "100%", lg: "50%" },
          border: "1px solid #686D76",
          p: 0.5,
          height: PANEL_HEIGHT,
          maxHeight: PANEL_HEIGHT,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <MDBox sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <MDTypography variant="h6" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
            {selectedAccountName ? `${selectedAccountName} 고객사별 확인` : "전체 고객사별 확인"}
          </MDTypography>
        </MDBox>

        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5, minHeight: 0, flex: 1 }}>
          <Box
            sx={{
              border: "1px solid #686D76",
              minHeight: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <MDBox sx={{ px: 1, pt: 0 }}>
              <MDTypography variant="button" sx={{ fontSize: 13, fontWeight: 700 }}>
                고객사별 확인
              </MDTypography>
            </MDBox>
            <Box sx={{ minHeight: 0, flex: 1, overflow: "auto" }}>
              {renderRightDetailTable(scopedRowsSorted, "표시할 건이 없습니다.", !selectedAccountKey)}
            </Box>
          </Box>

          <Box
            sx={{
              border: `3px solid ${RIGHT_WARN_BORDER}`,
              minHeight: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <MDBox sx={{ px: 1, pt: 0 }}>
              <MDTypography variant="button" sx={{ fontSize: 13, fontWeight: 700 }}>
                미해결건 확인
              </MDTypography>
            </MDBox>
            <Box sx={{ minHeight: 0, flex: 1, overflow: "auto" }}>
              {renderRightDetailTable(unresolvedRows, "미해결 건이 없습니다.", !selectedAccountKey)}
            </Box>
          </Box>
        </MDBox>
      </Box>
    );
  }, [
    selectedAccountName,
    scopedRowsSorted,
    unresolvedRows,
    isCustomerIssueTeam,
  ]);

  // ✅ 상단 툴바 좌측: 고객사 검색 + 요약 배지 세트
  const toolbarSummaryNode = useMemo(() => {
    const allAccountOption = { key: "", accountName: "전체" };
    const accountSummaryOptions = [allAccountOption, ...(accountSummaryRows || [])];
    const selectedFilterOption =
      accountSummaryOptions.find((opt) => opt.key === selectedAccountKey) || allAccountOption;

    return (
      <MDBox sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Box sx={{ border: "1px solid #dee2e6", bgcolor: "#fff", px: 1, py: 0.35, fontSize: 12, fontWeight: 700 }}>
          총 {currentSummary.total}
        </Box>
        <Box sx={{ border: "1px solid #b7e4c7", bgcolor: "#edf9f0", px: 1, py: 0.35, fontSize: 12, fontWeight: 700 }}>
          해결 {currentSummary.resolved}
        </Box>
        <Box sx={{ border: "1px solid #ffe8a1", bgcolor: "#fff8db", px: 1, py: 0.35, fontSize: 12, fontWeight: 700 }}>
          보류 {currentSummary.pending}
        </Box>
        <Box sx={{ border: "1px solid #d0d7de", bgcolor: "#f1f3f5", px: 1, py: 0.35, fontSize: 12, fontWeight: 700 }}>
          미입력 {currentSummary.noResult}
        </Box>
        <Autocomplete
          size="small"
          options={accountSummaryOptions}
          value={selectedFilterOption}
          onChange={(_, newValue) => setSelectedAccountKey(newValue?.key || "")}
          getOptionLabel={(option) => option?.accountName || "전체"}
          isOptionEqualToValue={(option, value) => option?.key === value?.key}
          clearOnEscape
          noOptionsText="고객사 데이터 없음"
          sx={{
            minWidth: 210,
            "& .MuiInputBase-root": { height: 35, fontSize: 12 },
            "& input": { padding: "0 8px", color: "#111" },
            "& .MuiSvgIcon-root": { color: "#111" },
          }}
          ListboxProps={{ style: { fontSize: 12, color: "#111" } }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="고객사 검색"
              placeholder="전체"
              sx={{ "& .MuiInputLabel-root": { fontSize: 12 } }}
            />
          )}
        />
      </MDBox>
    );
  }, [accountSummaryRows, selectedAccountKey, currentSummary]);

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* ✅ 상단 툴바: 요약/검색 + 구분관리/행추가/저장 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {toolbarSummaryNode}

        <MDBox sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <MDButton variant="gradient" color="warning" onClick={openTypeModal}>
            구분 관리
          </MDButton>
          <MDButton variant="gradient" color="success" onClick={handleAddRowClick}>
            행추가
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={saveRows}>
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      <MDBox sx={{ display: "flex", gap: 1, flexDirection: { xs: "column", lg: "row" } }}>
        {renderLeftTable()}
        {rightPanelNode}
      </MDBox>

      {/* ✅ 구분 관리 모달: 원래 형태 + 취소 버튼 복원 */}
      <Modal open={typeModalOpen} onClose={closeTypeModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "#fff",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <MDTypography variant="h6">구분 관리</MDTypography>
            <IconButton size="small" onClick={closeTypeModal}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </MDBox>

          <Box sx={{ maxHeight: 320, overflow: "auto", border: "1px solid #cfd6de" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "4px 8px",
                      background: "#dbe7f5",
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid #cfd6de",
                      whiteSpace: "nowrap",
                    }}
                  >
                    구분
                  </th>
                  <th
                    style={{
                      width: 60,
                      background: "#dbe7f5",
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid #cfd6de",
                      whiteSpace: "nowrap",
                    }}
                  >
                    삭제
                  </th>
                </tr>
              </thead>
              <tbody>
                {(typeRows || []).map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "4px 6px", border: "1px solid #cfd6de" }}>
                      <TextField
                        size="small"
                        value={row.type}
                        onChange={(e) => updateTypeRow(row.id, e.target.value)}
                        fullWidth
                        sx={{ "& .MuiInputBase-input": { fontSize: 12, py: 0.6 } }}
                      />
                    </td>
                    <td style={{ textAlign: "center", border: "1px solid #cfd6de" }}>
                      <Tooltip title="삭제">
                        <IconButton size="small" onClick={() => deleteTypeRow(row)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
                {(typeRows || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        border: "1px solid #cfd6de",
                        fontSize: 12,
                      }}
                    >
                      등록된 구분이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>

          <Grid container spacing={1} mt={1}>
            <Grid item xs={4}>
              <MDButton variant="outlined" color="info" fullWidth onClick={addTypeRow}>
                <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                구분 추가
              </MDButton>
            </Grid>
            <Grid item xs={4}>
              <MDButton variant="gradient" color="info" fullWidth onClick={saveTypeRows}>
                저장
              </MDButton>
            </Grid>
            <Grid item xs={4}>
              <MDButton variant="outlined" color="secondary" fullWidth onClick={closeTypeModal}>
                취소
              </MDButton>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </>
  );
}
