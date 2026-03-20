/* eslint-disable react/function-component-definition */
import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Grid,
  IconButton,
  MenuItem,
  Modal,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import useAccountIssueSheetData from "./accountissuesheettabData";

// 이슈/해결방안/비고 멀티라인 최대 노출 줄 수
const ISSUE_NOTE_MAX_ROWS = 10;
// 좌/우 패널 공통 높이(화면 하단까지 사용)
const CONTENT_HEIGHT = "calc(100vh - 220px)";
// 입력 컨트롤 공통 폰트
const CONTROL_FONT_SIZE = 12;
const PLACEHOLDER_FONT_SIZE = CONTROL_FONT_SIZE;
const DROPDOWN_ICON_SIZE = "1rem";
const SELECTED_ROW_BG = "#ffe4e1";
const BODY_BORDER_COLOR = "#cfd8e3";
// 저장 전 변경 셀 강조 색상
const CHANGED_ACCENT_COLOR = "#d32f2f";
const MULTILINE_CELL_MAX_HEIGHT = 140;
const TOP_ACCOUNT_INPUT_MIN_WIDTH = 240;
const TOP_ACCOUNT_DROPDOWN_MIN_WIDTH = 240;
const LEFT_ACCOUNT_DROPDOWN_WIDTH = 240;
// 왼쪽 편집 테이블 컬럼 폭
const LEFT_COL_WIDTH = {
  subDate: 90,
  account: 150,
  type: 60,
  issue: 220,
  result: 66,
  endDate: 90,
  solution: 220,
  note: 220,
};
const RIGHT_DETAIL_COL_WIDTH = {
  withAccount: 220,
  withoutAccount: 240,
};
const ALL_ACCOUNT_OPTION = {
  key: "__all__",
  accountId: "",
  accountName: "전체",
};

export default function AccountIssueSheetTab() {
  // 이슈 목록/행삭제는 데이터 훅에서 소프트삭제(del_yn) 규칙으로 처리
  const {
    loading,
    rows,
    originalRows,
    accountList,
    typeList,
    accountNameById,
    typeLabelById,
    selectedAccountKey,
    setSelectedAccountKey,
    selectedRowId,
    ctxMenu,
    typeModalOpen,
    setTypeModalOpen,
    typeRows,
    accountSummaryRows,
    selectedSummary,
    scopedRowsSorted,
    unresolvedRows,
    currentPanelSummary,
    mainTableScrollRef,
    typeTableScrollRef,
    RESULT_OPTIONS,
    formatDateTypingValue,
    getDeadlineTextColor,
    toDateInputValue,
    openDateInputPicker,
    handleRowChange,
    handleAccountChange,
    handleAccountInputChange,
    handleAccountEnterSelect,
    handleAccountCellSelect,
    handleAddTableRow,
    handleRowContextMenu,
    closeCtxMenu,
    blockRightMouseCellInteraction,
    handleDeleteRow,
    openTypeModal,
    handleTypeAdd,
    handleTypeChange,
    handleTypeDelete,
    handleTypeSave,
    handleSave,
  } = useAccountIssueSheetData(1);

  // 헤더 클릭 정렬 상태(좌/우 테이블을 각각 독립적으로 관리)
  const [leftSort, setLeftSort] = useState({ key: "subDate", direction: "desc" });
  const [rightSortByTable, setRightSortByTable] = useState({
    summary: { key: "subDate", direction: "asc" },
    unresolved: { key: "subDate", direction: "asc" },
  });
  // 저장 버튼 클릭 시점에 현재 정렬을 다시 적용하기 위한 트리거
  const [leftSortTrigger, setLeftSortTrigger] = useState(0);

  // 상단 거래처 선택: 항상 "전체" 옵션을 맨 위에 노출
  const accountSelectOptions = useMemo(
    () => [ALL_ACCOUNT_OPTION, ...(accountSummaryRows || [])],
    [accountSummaryRows]
  );

  // 선택 키가 없으면 기본값은 "전체"
  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountKey) return ALL_ACCOUNT_OPTION;
    return accountSummaryRows.find((row) => row.key === selectedAccountKey) || ALL_ACCOUNT_OPTION;
  }, [accountSummaryRows, selectedAccountKey]);

  // 셀 변경 여부(원본 대비)를 빠르게 확인하기 위한 원본 행 맵
  const originalRowById = useMemo(() => {
    const map = new Map();
    (originalRows || []).forEach((row) => {
      map.set(row.id, row);
    });
    return map;
  }, [originalRows]);

  // 저장 전 수정된 셀만 빨간색으로 표시
  const isCellModified = (row, key) => {
    const current = String(row?.[key] ?? "");
    const original = originalRowById.get(row.id);
    if (!original) return current.trim() !== "";
    return String(original?.[key] ?? "") !== current;
  };

  // 행에서 보여줄 거래처명을 한 번에 정리(직접입력 우선, 없으면 ID 매핑)
  const getRowAccountDisplayName = (row) =>
    row.account_name || accountNameById.get(String(row.account_id || "")) || "";

  const getModifiedCellSx = (row, key) =>
    isCellModified(row, key)
      ? { color: CHANGED_ACCENT_COLOR }
      : {};

  // 수정된 드롭다운은 텍스트와 테두리를 같은 빨간색으로 표시
  const changedDropdownBorderSx = {
    "& .MuiOutlinedInput-notchedOutline": {
      border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
    },
  };

  // Autocomplete용 TextField에도 같은 빨간 테두리를 적용
  const changedAutocompleteInputBorderSx = {
    "& .MuiOutlinedInput-root": {
      "& .MuiOutlinedInput-notchedOutline": {
        border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        border: `1px solid ${CHANGED_ACCENT_COLOR} !important`,
      },
    },
  };

  // 테이블 공통 스타일
  const tableSx = {
    flex: 1,
    height: CONTENT_HEIGHT,
    maxHeight: CONTENT_HEIGHT,
    overflow: "auto",
    "& table": {
      width: "max-content",
      minWidth: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      tableLayout: "fixed",
      borderLeft: `1px solid ${BODY_BORDER_COLOR}`,
      borderTop: `1px solid ${BODY_BORDER_COLOR}`,
    },
    "& th, & td": {
      borderRight: `1px solid ${BODY_BORDER_COLOR}`,
      borderBottom: `1px solid ${BODY_BORDER_COLOR}`,
      textAlign: "center",
      padding: "4px",
      fontSize: "12px",
      background: "#fff",
      whiteSpace: "nowrap",
    },
    // 거래처(업장) 클릭으로 선택된 행은 분홍색으로 강조
    "& tbody tr.row-selected td": {
      backgroundColor: `${SELECTED_ROW_BG} !important`,
    },
    "& thead th": {
      position: "sticky",
      top: 0,
      background: "#dbe7f5",
      borderTop: `1px solid ${BODY_BORDER_COLOR}`,
      borderRight: `1px solid ${BODY_BORDER_COLOR}`,
      borderBottom: `1px solid ${BODY_BORDER_COLOR}`,
      boxSizing: "border-box",
      zIndex: 3,
      fontWeight: 700,
    },
    "& thead th:first-of-type": {
      borderLeft: `1px solid ${BODY_BORDER_COLOR}`,
    },
    // 거래처 컬럼은 값 유무와 무관하게 동일 폭으로 고정
    "& th:nth-of-type(2), & td:nth-of-type(2)": {
      width: `${LEFT_COL_WIDTH.account}px`,
      minWidth: `${LEFT_COL_WIDTH.account}px`,
      maxWidth: `${LEFT_COL_WIDTH.account}px`,
    },
  };

  // 단일 입력칸 스타일
  const textFieldSx = {
    "& .MuiOutlinedInput-root": {
      "& .MuiOutlinedInput-notchedOutline": {
        border: "none !important",
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        border: "none !important",
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        border: "none !important",
      },
    },
    "& .MuiInputBase-input": {
      padding: "6px 8px",
      fontSize: CONTROL_FONT_SIZE,
      lineHeight: 1.25,
    },
  };

  // 멀티라인 입력칸 스타일(이슈/해결방안/비고)
  const multilineFieldSx = {
    "& .MuiInputBase-root": {
      alignItems: "flex-start",
      maxHeight: MULTILINE_CELL_MAX_HEIGHT,
      overflow: "hidden",
    },
    "& .MuiInputBase-inputMultiline": {
      padding: "6px 8px",
      fontSize: CONTROL_FONT_SIZE,
      lineHeight: 1.35,
      maxHeight: MULTILINE_CELL_MAX_HEIGHT,
      overflowY: "auto !important",
    },
  };

  // 셀렉트 공통 스타일
  const selectSx = {
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "& .MuiSelect-select": {
      padding: "8px 30px 8px 10px",
      fontSize: CONTROL_FONT_SIZE,
      lineHeight: 1.25,
      minHeight: "34px !important",
      boxSizing: "border-box",
    },
    "& .MuiSelect-icon": {
      display: "block !important",
      opacity: 1,
      right: 8,
      color: "#6c757d",
      fontSize: `${DROPDOWN_ICON_SIZE} !important`,
    },
  };

  // 구분/결과 셀 글자가 초기 렌더에서도 흔들리지 않도록 높이/정렬을 고정
  const compactCenteredSelectTextSx = {
    fontSize: CONTROL_FONT_SIZE,
    fontWeight: 700,
    minHeight: "25px !important",
    height: "25px",
    padding: "0 10px !important",
    boxSizing: "border-box",
    display: "flex !important",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  // 결과 셀(보류/해결/미선택) 상태별 스타일
  const resultSx = (value) => {
    if (value === "2") {
      return {
        backgroundColor: "#dff3e0",
        "& .MuiSelect-select": {
          ...compactCenteredSelectTextSx,
          color: "#1b5e20",
        },
      };
    }
    if (value === "1") {
      return {
        backgroundColor: "#fff2cc",
        "& .MuiSelect-select": {
          ...compactCenteredSelectTextSx,
          color: "#8a5d00",
        },
      };
    }
    return {
      backgroundColor: "#f1f3f5",
      "& .MuiSelect-select": {
        ...compactCenteredSelectTextSx,
        color: "#495057",
      },
    };
  };

  const resultBoxSx = (value) => {
    if (value === "2") return { backgroundColor: "#dff3e0", color: "#1b5e20" };
    if (value === "1") return { backgroundColor: "#fff2cc", color: "#8a5d00" };
    return { backgroundColor: "#f1f3f5", color: "#495057" };
  };

  // 구분 셀은 결과 셀과 동일 톤의 단색 박스로 표시
  const typeBoxSx = {
    backgroundColor: "#f1f3f5",
    "& .MuiSelect-select": {
      ...compactCenteredSelectTextSx,
      color: "#495057",
    },
  };

  const colStyle = (w) => ({ minWidth: w, width: w });

  // 우측 상세 테이블에서도 결과값(문자/코드)을 동일 코드(1/2)로 맞춰 색상 매핑을 고정
  const normalizeResultCode = (value) => {
    const code = String(value || "").trim();
    if (code === "해결") return "2";
    if (code === "보류") return "1";
    return code;
  };

  const getResultLabel = (resultCode) =>
    RESULT_OPTIONS.find((opt) => opt.value === String(resultCode || ""))?.label || "미입력";

  const getSortDirectionMark = (sortState, key) => {
    if (!sortState || sortState.key !== key) return "";
    return sortState.direction === "asc" ? " ▲" : " ▼";
  };

  // 빈 값은 항상 아래로 보내고, 값이 있으면 문자열 기준으로 정렬
  const compareSortValue = (aValue, bValue) => {
    const aText = String(aValue ?? "").trim();
    const bText = String(bValue ?? "").trim();
    const aEmpty = !aText;
    const bEmpty = !bText;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    return aText.localeCompare(bText, "ko", { numeric: true, sensitivity: "base" });
  };

  const toggleLeftSort = (key) => {
    setLeftSort((prev) => {
      if (prev.key === key) {
        return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const toggleRightSort = (tableKey, key) => {
    setRightSortByTable((prev) => {
      const current = prev[tableKey] || { key: "subDate", direction: "asc" };
      if (current.key === key) {
        return {
          ...prev,
          [tableKey]: {
            ...current,
            direction: current.direction === "asc" ? "desc" : "asc",
          },
        };
      }
      return {
        ...prev,
        [tableKey]: { key, direction: "asc" },
      };
    });
  };

  // 저장 완료 후 편집 테이블 정렬을 한 번 더 적용
  const handleSaveWithSort = async () => {
    await handleSave();
    setLeftSortTrigger((prev) => prev + 1);
  };

  // 행 추가/삭제처럼 구조가 바뀌면 즉시 정렬을 다시 계산
  const leftRowsIdKey = useMemo(
    () => (rows || []).map((row) => String(row.id)).join("|"),
    [rows]
  );

  const leftRowById = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row, sourceIndex) => {
      map.set(row.id, { row, sourceIndex });
    });
    return map;
  }, [rows]);

  // 왼쪽 편집 테이블은 기본 접수일 내림차순으로 표시
  const leftSortedRowIds = useMemo(() => {
    const withSourceIndex = (rows || []).map((row, sourceIndex) => ({ row, sourceIndex }));
    return withSourceIndex
      .sort((a, b) => {
        const resolveValue = (targetRow) => {
          if (leftSort.key === "subDate") return toDateInputValue(targetRow.sub_date);
          if (leftSort.key === "account") return getRowAccountDisplayName(targetRow);
          if (leftSort.key === "type") {
            const typeCode = String(targetRow.type || "");
            return typeLabelById.get(typeCode) || typeCode;
          }
          if (leftSort.key === "result") {
            const resultCode = String(targetRow.result || "");
            return RESULT_OPTIONS.find((opt) => opt.value === resultCode)?.label || resultCode;
          }
          if (leftSort.key === "endDate") return toDateInputValue(targetRow.end_date);
          return "";
        };

        const compared = compareSortValue(resolveValue(a.row), resolveValue(b.row));
        if (compared !== 0) {
          return leftSort.direction === "asc" ? compared : -compared;
        }
        return a.sourceIndex - b.sourceIndex;
      })
      .map(({ row }) => row.id);
  }, [leftSort, leftSortTrigger, leftRowsIdKey, RESULT_OPTIONS, toDateInputValue, typeLabelById, accountNameById]);

  // 우측 상세 테이블은 기존 기본값(접수일 오름차순)을 유지한 채 컬럼 클릭 정렬을 추가
  const sortDetailRows = (dataRows, sortState) => {
    const withIndex = (dataRows || []).map((item, index) => ({ item, index }));
    return withIndex
      .sort((a, b) => {
        const resolveValue = (targetItem) => {
          if (sortState.key === "subDate") return targetItem.subDate;
          if (sortState.key === "account") return targetItem.accountName;
          if (sortState.key === "type") {
            return typeLabelById.get(targetItem.typeCode) || targetItem.typeCode;
          }
          if (sortState.key === "result") {
            return getResultLabel(normalizeResultCode(targetItem.resultCode));
          }
          if (sortState.key === "endDate") return targetItem.endDate;
          return "";
        };

        const compared = compareSortValue(resolveValue(a.item), resolveValue(b.item));
        if (compared !== 0) {
          return sortState.direction === "asc" ? compared : -compared;
        }
        return a.index - b.index;
      })
      .map(({ item }) => item);
  };

  const rightSummaryRowsSorted = useMemo(
    () => sortDetailRows(scopedRowsSorted, rightSortByTable.summary),
    [scopedRowsSorted, rightSortByTable.summary, RESULT_OPTIONS, typeLabelById]
  );

  const rightUnresolvedRowsSorted = useMemo(
    () => sortDetailRows(unresolvedRows, rightSortByTable.unresolved),
    [unresolvedRows, rightSortByTable.unresolved, RESULT_OPTIONS, typeLabelById]
  );

  const renderDetailTable = (
    dataRows,
    emptyText,
    { showAccount = false, sortState, onSort } = {}
  ) => {
    /*
      우측 "전체 거래처별 확인 / 미해결건 확인" 공통 테이블 렌더러.
      가로/세로 셀 구분선이 동일하게 보이도록 th/td 기본 테두리를 통일한다.
    */
    const headCellStyle = {
      padding: "4px",
      fontSize: 12,
      background: "#DBE7F5",
      whiteSpace: "nowrap",
      wordBreak: "keep-all",
      borderTop: `1px solid ${BODY_BORDER_COLOR}`,
      borderRight: `1px solid ${BODY_BORDER_COLOR}`,
      borderBottom: `1px solid ${BODY_BORDER_COLOR}`,
      position: "sticky",
      top: 0,
      zIndex: 3,
    };
    const firstHeadCellStyle = {
      ...headCellStyle,
      borderLeft: `1px solid ${BODY_BORDER_COLOR}`,
    };
    const bodyCellStyle = {
      fontSize: 12,
      borderRight: `1px solid ${BODY_BORDER_COLOR}`,
      borderBottom: `1px solid ${BODY_BORDER_COLOR}`,
    };

    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: "fixed",
          borderLeft: `1px solid ${BODY_BORDER_COLOR}`,
          borderTop: `1px solid ${BODY_BORDER_COLOR}`,
        }}
      >
        <colgroup>
          <col style={{ width: 92 }} />
          {showAccount && <col style={{ width: 96 }} />}
          <col style={{ width: 62 }} />
          <col style={{ width: showAccount ? RIGHT_DETAIL_COL_WIDTH.withAccount : RIGHT_DETAIL_COL_WIDTH.withoutAccount }} />
          <col style={{ width: 62 }} />
          <col style={{ width: 92 }} />
          <col
            style={{
              width: showAccount
                ? RIGHT_DETAIL_COL_WIDTH.withAccount
                : RIGHT_DETAIL_COL_WIDTH.withoutAccount,
            }}
          />
          <col
            style={{
              width: showAccount
                ? RIGHT_DETAIL_COL_WIDTH.withAccount
                : RIGHT_DETAIL_COL_WIDTH.withoutAccount,
            }}
          />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{ ...firstHeadCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => onSort?.("subDate")}
            >
              {`접수일${getSortDirectionMark(sortState, "subDate")}`}
            </th>
            {showAccount && (
              <th
                style={{ ...headCellStyle, cursor: "pointer", userSelect: "none" }}
                onClick={() => onSort?.("account")}
              >
                {`거래처${getSortDirectionMark(sortState, "account")}`}
              </th>
            )}
            <th
              style={{ ...headCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => onSort?.("type")}
            >
              {`구분${getSortDirectionMark(sortState, "type")}`}
            </th>
            <th style={headCellStyle}>이슈</th>
            <th
              style={{ ...headCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => onSort?.("result")}
            >
              {`결과${getSortDirectionMark(sortState, "result")}`}
            </th>
            <th
              style={{ ...headCellStyle, cursor: "pointer", userSelect: "none" }}
              onClick={() => onSort?.("endDate")}
            >
              {`마감일${getSortDirectionMark(sortState, "endDate")}`}
            </th>
            <th style={headCellStyle}>해결방안</th>
            <th style={headCellStyle}>비고</th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((item) => {
            const deadlineColor = getDeadlineTextColor(item.endDate, item.resultCode);
            const normalizedResultCode = normalizeResultCode(item.resultCode);
            return (
              <tr key={`${item.id}_${item.idx || "n"}_${item.subDate || ""}`}>
                <td
                  style={{
                    ...bodyCellStyle,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    wordBreak: "keep-all",
                  }}
                >
                  {item.subDate || "-"}
                </td>
                {showAccount && (
                  <td
                    style={{
                      ...bodyCellStyle,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={item.accountName || "-"}
                  >
                    {item.accountName || "-"}
                  </td>
                )}
                <td
                  style={{
                    ...bodyCellStyle,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    wordBreak: "keep-all",
                  }}
                >
                  {typeLabelById.get(item.typeCode) || item.typeCode || "-"}
                </td>
                <td
                  style={{
                    ...bodyCellStyle,
                    padding: "6px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.issueText || "-"}
                </td>
                <td
                  style={{
                    ...bodyCellStyle,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    wordBreak: "keep-all",
                  }}
                >
                  {/* 우측 결과 컬럼도 좌측 드롭다운과 동일한 상태색 박스로 고정 표시 */}
                  <Box
                    sx={{
                      ...compactCenteredSelectTextSx,
                      ...resultBoxSx(normalizedResultCode),
                      minHeight: "25px !important",
                      height: "25px",
                      width: "72%",
                      minWidth: 40,
                      overflow: "hidden",
                      mx: "auto",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                  >
                    {getResultLabel(normalizedResultCode)}
                  </Box>
                </td>
                <td
                  style={{
                    ...bodyCellStyle,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    wordBreak: "keep-all",
                    color: deadlineColor,
                    fontWeight: deadlineColor === "#344767" ? 400 : 700,
                  }}
                >
                  {item.endDate || "-"}
                </td>
                <td
                  style={{
                    ...bodyCellStyle,
                    padding: "6px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.solutionText || "-"}
                </td>
                <td
                  style={{
                    ...bodyCellStyle,
                    padding: "6px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.noteText || "-"}
                </td>
              </tr>
            );
          })}
          {dataRows.length === 0 && (
            <tr>
              <td
                colSpan={showAccount ? 8 : 7}
                style={{ ...bodyCellStyle, textAlign: "center", padding: "16px" }}
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  if (loading && rows.length === 0) return <LoadingScreen />;

  return (
    <>
      {/* 상단: 거래처 필터 + 액션 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Autocomplete
          size="small"
          options={accountSelectOptions}
          value={selectedAccountOption}
          onChange={(_, newValue) => {
            if (!newValue?.key || newValue.key === ALL_ACCOUNT_OPTION.key) {
              setSelectedAccountKey(null);
              return;
            }
            setSelectedAccountKey(newValue.key);
          }}
          getOptionLabel={(option) => option?.accountName || ""}
          filterOptions={(options, { inputValue }) => {
            const keyword = String(inputValue || "").trim().toLowerCase();
            if (!keyword) return options;
            return options.filter(
              (row) =>
                String(row?.accountName || "").toLowerCase().includes(keyword) ||
                String(row?.accountId || "").toLowerCase().includes(keyword)
            );
          }}
          isOptionEqualToValue={(option, value) => option?.key === value?.key}
          sx={{ minWidth: TOP_ACCOUNT_INPUT_MIN_WIDTH, background: "#fff" }}
          slotProps={{
            popper: {
              sx: {
                minWidth: `${TOP_ACCOUNT_DROPDOWN_MIN_WIDTH}px !important`,
              },
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 선택"
              placeholder="거래처 검색"
            />
          )}
        />
        <MDButton variant="outlined" color="dark" onClick={handleAddTableRow}>
          행 추가
        </MDButton>
        <MDButton variant="outlined" color="info" onClick={openTypeModal}>
          구분 관리
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSaveWithSort}>
          저장
        </MDButton>
      </MDBox>

      <MDBox
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: 1.5,
          alignItems: "stretch",
        }}
      >
        {/* 좌측: 편집 테이블 */}
        <Box sx={{ width: { xs: "100%", lg: "50%" }, minWidth: 0 }}>
          <Box sx={tableSx} ref={mainTableScrollRef}>
            <table>
              <colgroup>
                <col style={colStyle(LEFT_COL_WIDTH.subDate)} />
                <col style={colStyle(LEFT_COL_WIDTH.account)} />
                <col style={colStyle(LEFT_COL_WIDTH.type)} />
                <col style={colStyle(LEFT_COL_WIDTH.issue)} />
                <col style={colStyle(LEFT_COL_WIDTH.result)} />
                <col style={colStyle(LEFT_COL_WIDTH.endDate)} />
                <col style={colStyle(LEFT_COL_WIDTH.solution)} />
                <col style={colStyle(LEFT_COL_WIDTH.note)} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={{ ...colStyle(LEFT_COL_WIDTH.subDate), cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleLeftSort("subDate")}
                  >
                    {`접수일${getSortDirectionMark(leftSort, "subDate")}`}
                  </th>
                  <th
                    style={{ ...colStyle(LEFT_COL_WIDTH.account), cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleLeftSort("account")}
                  >
                    {`거래처${getSortDirectionMark(leftSort, "account")}`}
                  </th>
                  <th
                    style={{ ...colStyle(LEFT_COL_WIDTH.type), cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleLeftSort("type")}
                  >
                    {`구분${getSortDirectionMark(leftSort, "type")}`}
                  </th>
                  <th style={colStyle(LEFT_COL_WIDTH.issue)}>이슈</th>
                  <th
                    style={{ ...colStyle(LEFT_COL_WIDTH.result), cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleLeftSort("result")}
                  >
                    {`결과${getSortDirectionMark(leftSort, "result")}`}
                  </th>
                  <th
                    style={{ ...colStyle(LEFT_COL_WIDTH.endDate), cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleLeftSort("endDate")}
                  >
                    {`마감일${getSortDirectionMark(leftSort, "endDate")}`}
                  </th>
                  <th style={colStyle(LEFT_COL_WIDTH.solution)}>해결방안</th>
                  <th style={colStyle(LEFT_COL_WIDTH.note)}>비고</th>
                </tr>
              </thead>
              <tbody>
                {leftSortedRowIds.map((rowId) => {
                  const rowEntry = leftRowById.get(rowId);
                  if (!rowEntry) return null;
                  const { row, sourceIndex: rowIndex } = rowEntry;
                  // 행 단위 파생값은 한 번만 계산해 셀 렌더에서 재사용
                  const deadlineColor = getDeadlineTextColor(row.end_date, row.result);
                  const isSelectedRow = selectedRowId === row.id;
                  const accountDisplayName = getRowAccountDisplayName(row);
                  const resultValue = String(row.result || "");
                  const resultStyle = resultSx(resultValue);
                  const resultLabel =
                    RESULT_OPTIONS.find((opt) => opt.value === resultValue)?.label || "선택";
                  const typeValue = String(row.type || "");
                  const typeDisplayLabel = typeLabelById.get(typeValue) || (typeValue ? typeValue : "선택");
                  const isSubDateModified = isCellModified(row, "sub_date");
                  const isAccountModified =
                    isCellModified(row, "account_id") || isCellModified(row, "account_name");
                  const isTypeModified = isCellModified(row, "type");
                  const isResultModified = isCellModified(row, "result");
                  const isEndDateModified = isCellModified(row, "end_date");
                  return (
                    <tr
                      key={row.id}
                      className={isSelectedRow ? "row-selected" : ""}
                      onClick={() => handleAccountCellSelect(row)}
                      onContextMenu={(e) => handleRowContextMenu(e, row, rowIndex)}
                      onMouseDownCapture={blockRightMouseCellInteraction}
                      style={{ cursor: "context-menu" }}
                    >
                      <td>
                        {isSelectedRow ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "3px",
                              position: "relative",
                            }}
                          >
                            <TextField
                              id={`sub_date_text_${row.id}`}
                              type="text"
                              size="small"
                              value={row.sub_date || ""}
                              placeholder="yyyy-mm-dd"
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "sub_date",
                                  formatDateTypingValue(e.target.value || "")
                                )
                              }
                              onFocus={(e) => {
                                requestAnimationFrame(() => {
                                  try {
                                    e.target.setSelectionRange(0, 0);
                                  } catch (err) {
                                    // ignore
                                  }
                                });
                              }}
                              onDoubleClick={() => openDateInputPicker(`sub_date_picker_${row.id}`)}
                              onBlur={(e) => {
                                const normalized = toDateInputValue(e.target.value);
                                if (normalized || !e.target.value) {
                                  handleRowChange(row.id, "sub_date", normalized);
                                }
                              }}
                              sx={{
                                ...textFieldSx,
                                width: "10.2ch",
                                "& .MuiInputBase-input": {
                                  padding: "6px 0 6px 2px",
                                  fontSize: CONTROL_FONT_SIZE,
                                  lineHeight: 1.25,
                                  whiteSpace: "nowrap",
                                  fontVariantNumeric: "tabular-nums",
                                  color: isSubDateModified ? CHANGED_ACCENT_COLOR : undefined,
                                  cursor: "text",
                                  textAlign: "left",
                                },
                              }}
                            />
                            <IconButton
                              size="small"
                              sx={{
                                p: 0,
                                width: 16,
                                height: 16,
                                flex: "0 0 16px",
                                ml: "5px",
                              }}
                              onClick={() => openDateInputPicker(`sub_date_picker_${row.id}`)}
                            >
                              <CalendarTodayIcon sx={{ fontSize: "0.95rem", color: "#6c757d" }} />
                            </IconButton>
                            <input
                              id={`sub_date_picker_${row.id}`}
                              type="date"
                              value={toDateInputValue(row.sub_date)}
                              onChange={(e) => handleRowChange(row.id, "sub_date", e.target.value || "")}
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                opacity: 0,
                                pointerEvents: "none",
                                border: 0,
                                padding: 0,
                                margin: 0,
                              }}
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          </Box>
                        ) : (
                          // 비선택 행은 읽기 전용으로 그려 불필요한 입력 컨트롤 렌더를 줄인다.
                          <Box
                            sx={{
                              px: 1,
                              py: "6px",
                              fontSize: CONTROL_FONT_SIZE,
                              lineHeight: 1.25,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums",
                              minHeight: 34,
                              ...getModifiedCellSx(row, "sub_date"),
                            }}
                          >
                            {row.sub_date || ""}
                          </Box>
                        )}
                      </td>
                      <td style={{ overflow: "hidden" }}>
                        {isSelectedRow ? (
                          <Autocomplete
                            key={`account_auto_${row.id}_${row.account_id || ""}_${row.account_name || ""}`}
                            size="small"
                            freeSolo
                            options={accountList || []}
                            // 타이핑 시 rows 상태를 건드리지 않고, 선택/엔터 시점에만 반영
                            popupIcon={
                              <ArrowDropDownIcon sx={{ fontSize: DROPDOWN_ICON_SIZE, color: "#6c757d" }} />
                            }
                            defaultValue={
                              accountDisplayName
                                ? {
                                  account_id: String(row.account_id || ""),
                                  account_name: accountDisplayName,
                                }
                                : null
                            }
                            onChange={(_, newValue) => {
                              if (typeof newValue === "string") {
                                const keyword = String(newValue || "").trim();
                                if (!keyword) {
                                  handleAccountChange(row.id, "");
                                  return;
                                }
                                const matched = handleAccountEnterSelect(row.id, keyword);
                                if (!matched) handleAccountInputChange(row.id, keyword);
                                return;
                              }

                              if (!newValue) {
                                handleAccountChange(row.id, "");
                                return;
                              }

                              handleAccountChange(row.id, String(newValue.account_id));
                            }}
                            getOptionLabel={(option) => option?.account_name || ""}
                            filterOptions={(options, { inputValue }) => {
                              const keyword = String(inputValue || "").trim().toLowerCase();
                              if (!keyword) return options;
                              return options.filter((opt) => {
                                const name = String(opt?.account_name || "").toLowerCase();
                                const id = String(opt?.account_id || "").toLowerCase();
                                return name.includes(keyword) || id.includes(keyword);
                              });
                            }}
                            isOptionEqualToValue={(option, value) =>
                              String(option?.account_id) === String(value?.account_id)
                            }
                            sx={{
                              width: "100%",
                              ...(isAccountModified
                                ? {
                                  "& .MuiInputBase-input": {
                                    color: CHANGED_ACCENT_COLOR,
                                  },
                                }
                                : {}),
                            }}
                            slotProps={{
                              popper: {
                                sx: {
                                  width: `${LEFT_ACCOUNT_DROPDOWN_WIDTH}px !important`,
                                },
                              },
                            }}
                            renderOption={(props, option) => (
                              <li
                                {...props}
                                key={option.account_id}
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={option.account_name}
                              >
                                {option.account_name}
                              </li>
                            )}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder="거래처 검색"
                                onKeyDown={(e) => {
                                  // 한글 조합 중 Enter(229)는 입력 확정 단계라서 가로채지 않는다.
                                  if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const keyword = e.currentTarget.value;
                                  handleAccountEnterSelect(row.id, keyword);
                                }}
                                sx={{
                                  ...textFieldSx,
                                  ...(isAccountModified ? changedAutocompleteInputBorderSx : {}),
                                  width: "100%",
                                  "& .MuiInputBase-input": {
                                    padding: "6px 8px",
                                    fontSize: CONTROL_FONT_SIZE,
                                    ...(isAccountModified
                                      ? { color: CHANGED_ACCENT_COLOR }
                                      : {}),
                                  },
                                  "& .MuiInputBase-input::placeholder": {
                                    fontSize: PLACEHOLDER_FONT_SIZE,
                                    opacity: 0.82,
                                  },
                                }}
                              />
                            )}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: CONTROL_FONT_SIZE,
                              textAlign: "left",
                              px: 1,
                              py: "6px",
                              ...(
                                isAccountModified
                                  ? { color: CHANGED_ACCENT_COLOR }
                                  : {}
                              ),
                            }}
                            title={accountDisplayName || "-"}
                          >
                            {accountDisplayName || "-"}
                          </Box>
                        )}
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        {isSelectedRow ? (
                          <Select
                            size="small"
                            value={row.type || ""}
                            onChange={(e) => handleRowChange(row.id, "type", e.target.value)}
                            IconComponent={() => null}
                            displayEmpty
                            renderValue={(selected) => {
                              if (selected) return typeLabelById.get(String(selected)) || selected;
                              return "선택";
                            }}
                            sx={{
                              ...selectSx,
                              ...typeBoxSx,
                              ...(isTypeModified ? changedDropdownBorderSx : {}),
                              display: "block",
                              width: "88%",
                              minWidth: 52,
                              overflow: "hidden",
                              mx: "auto",
                              "& .MuiSelect-select": {
                                ...(typeBoxSx["& .MuiSelect-select"] || {}),
                                pt: "0 !important",
                                pb: "0 !important",
                                pl: "10px !important",
                                pr: "10px !important",
                                minHeight: "25px !important",
                                height: "25px",
                                display: "flex !important",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                color: isTypeModified ? CHANGED_ACCENT_COLOR : undefined,
                              },
                            }}
                          >
                            <MenuItem value="">
                              <em>선택</em>
                            </MenuItem>
                            {(typeList || []).map((opt) => (
                              <MenuItem key={opt.idx} value={String(opt.idx)}>
                                {opt.type}
                              </MenuItem>
                            ))}
                          </Select>
                        ) : (
                          <Box
                            sx={{
                              ...compactCenteredSelectTextSx,
                              minHeight: "25px !important",
                              height: "25px",
                              width: "88%",
                              minWidth: 52,
                              overflow: "hidden",
                              mx: "auto",
                              borderRadius: "4px",
                              backgroundColor: "#f1f3f5",
                              color: isTypeModified ? CHANGED_ACCENT_COLOR : "#495057",
                            }}
                          >
                            {typeDisplayLabel}
                          </Box>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {isSelectedRow ? (
                          <TextField
                            key={`issue_input_${row.id}_${row.issue || ""}`}
                            size="small"
                            defaultValue={row.issue || ""}
                            onChange={(e) => {
                              e.target.style.color = CHANGED_ACCENT_COLOR;
                            }}
                            onBlur={(e) => handleRowChange(row.id, "issue", e.target.value)}
                            multiline
                            minRows={1}
                            maxRows={ISSUE_NOTE_MAX_ROWS}
                            sx={{
                              ...textFieldSx,
                              ...multilineFieldSx,
                              width: "100%",
                              "& .MuiInputBase-inputMultiline": {
                                ...multilineFieldSx["& .MuiInputBase-inputMultiline"],
                                ...(isCellModified(row, "issue")
                                  ? { color: CHANGED_ACCENT_COLOR }
                                  : {}),
                              },
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              px: 1,
                              py: "6px",
                              fontSize: CONTROL_FONT_SIZE,
                              lineHeight: 1.35,
                              textAlign: "left",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              minHeight: 34,
                              maxHeight: MULTILINE_CELL_MAX_HEIGHT,
                              overflowY: "auto",
                              ...getModifiedCellSx(row, "issue"),
                            }}
                          >
                            {row.issue || ""}
                          </Box>
                        )}
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        {isSelectedRow ? (
                          <Select
                            size="small"
                            value={resultValue}
                            onChange={(e) => handleRowChange(row.id, "result", e.target.value)}
                            IconComponent={() => null}
                            displayEmpty
                            renderValue={() => resultLabel}
                            sx={{
                              ...selectSx,
                              ...resultStyle,
                              ...(isResultModified ? changedDropdownBorderSx : {}),
                              display: "block",
                              width: "88%",
                              minWidth: 52,
                              overflow: "hidden",
                              mx: "auto",
                              "& .MuiSelect-select": {
                                ...((resultStyle["& .MuiSelect-select"] || {})),
                                pt: "0 !important",
                                pb: "0 !important",
                                pl: "10px !important",
                                pr: "10px !important",
                                minHeight: "25px !important",
                                height: "25px",
                                display: "flex !important",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                color: isResultModified ? CHANGED_ACCENT_COLOR : undefined,
                              },
                            }}
                          >
                            <MenuItem value="">
                              <em>선택</em>
                            </MenuItem>
                            {RESULT_OPTIONS.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        ) : (
                          <Box
                            sx={{
                              ...compactCenteredSelectTextSx,
                              ...resultBoxSx(resultValue),
                              minHeight: "25px !important",
                              height: "25px",
                              width: "88%",
                              minWidth: 52,
                              overflow: "hidden",
                              mx: "auto",
                              borderRadius: "4px",
                              ...(isResultModified ? { color: CHANGED_ACCENT_COLOR } : {}),
                            }}
                          >
                            {resultLabel}
                          </Box>
                        )}
                      </td>
                      <td>
                        {isSelectedRow ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "3px",
                              position: "relative",
                            }}
                          >
                            <TextField
                              id={`end_date_text_${row.id}`}
                              type="text"
                              size="small"
                              value={row.end_date || ""}
                              placeholder="yyyy-mm-dd"
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "end_date",
                                  formatDateTypingValue(e.target.value || "")
                                )
                              }
                              onFocus={(e) => {
                                requestAnimationFrame(() => {
                                  try {
                                    e.target.setSelectionRange(0, 0);
                                  } catch (err) {
                                    // ignore
                                  }
                                });
                              }}
                              onDoubleClick={() => openDateInputPicker(`end_date_picker_${row.id}`)}
                              onBlur={(e) => {
                                const normalized = toDateInputValue(e.target.value);
                                if (normalized || !e.target.value) {
                                  handleRowChange(row.id, "end_date", normalized);
                                }
                              }}
                              sx={{
                                ...textFieldSx,
                                width: "10.2ch",
                                "& .MuiInputBase-input": {
                                  padding: "6px 0 6px 2px",
                                  fontSize: CONTROL_FONT_SIZE,
                                  lineHeight: 1.25,
                                  whiteSpace: "nowrap",
                                  fontVariantNumeric: "tabular-nums",
                                  color: isEndDateModified ? CHANGED_ACCENT_COLOR : deadlineColor,
                                  fontWeight: deadlineColor === "#344767" ? 400 : 700,
                                  cursor: "text",
                                  textAlign: "left",
                                },
                              }}
                            />
                            <IconButton
                              size="small"
                              sx={{
                                p: 0,
                                width: 16,
                                height: 16,
                                flex: "0 0 16px",
                                ml: "5px",
                              }}
                              onClick={() => openDateInputPicker(`end_date_picker_${row.id}`)}
                            >
                              <CalendarTodayIcon sx={{ fontSize: "0.95rem", color: "#6c757d" }} />
                            </IconButton>
                            <input
                              id={`end_date_picker_${row.id}`}
                              type="date"
                              value={toDateInputValue(row.end_date)}
                              onChange={(e) => handleRowChange(row.id, "end_date", e.target.value || "")}
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                opacity: 0,
                                pointerEvents: "none",
                                border: 0,
                                padding: 0,
                                margin: 0,
                              }}
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              px: 1,
                              py: "6px",
                              fontSize: CONTROL_FONT_SIZE,
                              lineHeight: 1.25,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums",
                              color: isEndDateModified ? CHANGED_ACCENT_COLOR : deadlineColor,
                              fontWeight: deadlineColor === "#344767" ? 400 : 700,
                              minHeight: 34,
                            }}
                          >
                            {row.end_date || ""}
                          </Box>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {isSelectedRow ? (
                          <TextField
                            key={`solution_input_${row.id}_${row.solution || ""}`}
                            size="small"
                            onContextMenu={(e) => e.preventDefault()}
                            defaultValue={row.solution || ""}
                            onChange={(e) => {
                              e.target.style.color = CHANGED_ACCENT_COLOR;
                            }}
                            onBlur={(e) => handleRowChange(row.id, "solution", e.target.value)}
                            multiline
                            minRows={1}
                            maxRows={ISSUE_NOTE_MAX_ROWS}
                            sx={{
                              ...textFieldSx,
                              ...multilineFieldSx,
                              width: "100%",
                              "& .MuiInputBase-inputMultiline": {
                                ...multilineFieldSx["& .MuiInputBase-inputMultiline"],
                                ...(isCellModified(row, "solution")
                                  ? { color: CHANGED_ACCENT_COLOR }
                                  : {}),
                              },
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              px: 1,
                              py: "6px",
                              fontSize: CONTROL_FONT_SIZE,
                              lineHeight: 1.35,
                              textAlign: "left",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              minHeight: 34,
                              maxHeight: MULTILINE_CELL_MAX_HEIGHT,
                              overflowY: "auto",
                              ...getModifiedCellSx(row, "solution"),
                            }}
                          >
                            {row.solution || ""}
                          </Box>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {isSelectedRow ? (
                          <TextField
                            key={`note_input_${row.id}_${row.note || ""}`}
                            size="small"
                            onContextMenu={(e) => e.preventDefault()}
                            defaultValue={row.note || ""}
                            onChange={(e) => {
                              e.target.style.color = CHANGED_ACCENT_COLOR;
                            }}
                            onBlur={(e) => handleRowChange(row.id, "note", e.target.value)}
                            multiline
                            minRows={1}
                            maxRows={ISSUE_NOTE_MAX_ROWS}
                            sx={{
                              ...textFieldSx,
                              ...multilineFieldSx,
                              width: "100%",
                              "& .MuiInputBase-inputMultiline": {
                                ...multilineFieldSx["& .MuiInputBase-inputMultiline"],
                                ...(isCellModified(row, "note")
                                  ? { color: CHANGED_ACCENT_COLOR }
                                  : {}),
                              },
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              px: 1,
                              py: "6px",
                              fontSize: CONTROL_FONT_SIZE,
                              lineHeight: 1.35,
                              textAlign: "left",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              minHeight: 34,
                              maxHeight: MULTILINE_CELL_MAX_HEIGHT,
                              overflowY: "auto",
                              ...getModifiedCellSx(row, "note"),
                            }}
                          >
                            {row.note || ""}
                          </Box>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>

        {/* 우측: 거래처/미해결 현황 테이블 */}
        <Box
          sx={{
            width: { xs: "100%", lg: "50%" },
            minWidth: 0,
            border: "1px solid #cfd6de",
            borderRadius: 1,
            background: "#f8fafc",
            p: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            height: CONTENT_HEIGHT,
            maxHeight: CONTENT_HEIGHT,
          }}
        >
          <MDBox
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
          >
            <MDTypography variant="h6">
              {selectedSummary ? `${selectedSummary.accountName} 거래처별 확인` : "전체 거래처별 확인"}
            </MDTypography>
            <MDBox sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <MDBox
                sx={{
                  px: 1,
                  py: 0,
                  minHeight: 25,
                  border: "1px solid #dee2e6",
                  borderRadius: 1,
                  bgcolor: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <MDTypography
                  variant="caption"
                  sx={{ lineHeight: 1, fontSize: CONTROL_FONT_SIZE, fontWeight: 700 }}
                >
                  총 {currentPanelSummary.total}
                </MDTypography>
              </MDBox>
              <MDBox
                sx={{
                  px: 1,
                  py: 0,
                  minHeight: 25,
                  border: "1px solid #b7e4c7",
                  borderRadius: 1,
                  bgcolor: "#edf9f0",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <MDTypography
                  variant="caption"
                  sx={{ lineHeight: 1, fontSize: CONTROL_FONT_SIZE, fontWeight: 700 }}
                >
                  해결 {currentPanelSummary.resolved}
                </MDTypography>
              </MDBox>
              <MDBox
                sx={{
                  px: 1,
                  py: 0,
                  minHeight: 25,
                  border: "1px solid #ffe8a1",
                  borderRadius: 1,
                  bgcolor: "#fff8db",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <MDTypography
                  variant="caption"
                  sx={{ lineHeight: 1, fontSize: CONTROL_FONT_SIZE, fontWeight: 700 }}
                >
                  보류 {currentPanelSummary.pending}
                </MDTypography>
              </MDBox>
              <MDBox
                sx={{
                  px: 1,
                  py: 0,
                  minHeight: 25,
                  border: "1px solid #d0d7de",
                  borderRadius: 1,
                  bgcolor: "#f1f3f5",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <MDTypography
                  variant="caption"
                  sx={{ lineHeight: 1, fontSize: CONTROL_FONT_SIZE, fontWeight: 700 }}
                >
                  미입력 {currentPanelSummary.noResult}
                </MDTypography>
              </MDBox>
            </MDBox>
          </MDBox>

          <Box
            sx={{
              border: "1px solid #dbe3eb",
              borderRadius: 1,
              overflow: "auto",
              background: "#fff",
              minHeight: 0,
              flex: 1,
            }}
          >
            {renderDetailTable(rightSummaryRowsSorted, "표시할 건이 없습니다.", {
              showAccount: !selectedAccountKey,
              sortState: rightSortByTable.summary,
              onSort: (key) => toggleRightSort("summary", key),
            })}
          </Box>

          <MDTypography variant="h6">미해결건 확인</MDTypography>

          <Box
            sx={{
              border: "1px solid #dbe3eb",
              borderRadius: 1,
              overflow: "auto",
              background: "#fff",
              minHeight: 0,
              flex: 1,
            }}
          >
            {renderDetailTable(rightUnresolvedRowsSorted, "미해결 건이 없습니다.", {
              showAccount: true,
              sortState: rightSortByTable.unresolved,
              onSort: (key) => toggleRightSort("unresolved", key),
            })}
          </Box>
        </Box>
      </MDBox>

      {ctxMenu.open && (
        <div
          onClick={closeCtxMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeCtxMenu();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: ctxMenu.mouseY,
              left: ctxMenu.mouseX,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              minWidth: 140,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => handleDeleteRow(ctxMenu.rowIndex)}
            >
              🗑️ 행 삭제
            </button>
          </div>
        </div>
      )}

      <Modal open={typeModalOpen} onClose={() => setTypeModalOpen(false)}>
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
            <IconButton size="small" onClick={() => setTypeModalOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </MDBox>

          {/* 구분 관리 모달 테이블도 본문 테이블과 동일한 테두리 톤 적용 */}
          <Box
            sx={{ maxHeight: 320, overflow: "auto", border: "1px solid #cfd6de" }}
            ref={typeTableScrollRef}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {/* 왼쪽 이슈 테이블 헤더 톤/폰트와 맞춤 */}
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
                {typeRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "4px 6px", border: "1px solid #cfd6de" }}>
                      <TextField
                        size="small"
                        value={row.type}
                        onChange={(e) => handleTypeChange(row.id, e.target.value)}
                        fullWidth
                        sx={textFieldSx}
                      />
                    </td>
                    <td style={{ textAlign: "center", border: "1px solid #cfd6de" }}>
                      <Tooltip title="삭제">
                        <IconButton size="small" onClick={() => handleTypeDelete(row)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
                {typeRows.length === 0 && (
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
            <Grid item xs={6}>
              <MDButton variant="outlined" color="info" fullWidth onClick={handleTypeAdd}>
                <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                구분 추가
              </MDButton>
            </Grid>
            <Grid item xs={6}>
              <MDButton variant="gradient" color="info" fullWidth onClick={handleTypeSave}>
                저장
              </MDButton>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </>
  );
}
