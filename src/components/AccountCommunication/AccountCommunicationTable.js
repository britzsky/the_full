/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Popper,
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
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";

// 기본 빈 행 수(최소 표시 행)
const MIN_ROWS = 10;
// 이슈/비고 멀티라인 최대 노출 줄 수
const ISSUE_NOTE_MAX_ROWS = 10;
// 좌/우 패널 공통 높이(화면 하단까지 사용)
const CONTENT_HEIGHT = "calc(100vh - 220px)";
// 고객사 자동완성 드롭다운 최소 폭
const ACCOUNT_DROPDOWN_MIN_WIDTH = 320;
// 입력 컨트롤 공통 폰트
const CONTROL_FONT_SIZE = 12;
const PLACEHOLDER_FONT_SIZE = CONTROL_FONT_SIZE;
const DROPDOWN_ICON_SIZE = "1rem";
const SELECTED_ROW_BG = "#ffe4e1";
// 왼쪽 편집 테이블 컬럼 폭
const LEFT_COL_WIDTH = {
  subDate: 90,
  account: 100,
  type: 60,
  issue: 131,
  result: 66,
  endDate: 90,
  note: 131,
};
const ACCOUNT_CACHE_KEY = "account_communication_account_list_v1";
const TYPE_CACHE_KEY = (teamCode) => `account_communication_type_list_${teamCode}`;
const ROW_CACHE_KEY = (teamCode) => `account_communication_rows_${teamCode}`;

const RESULT_OPTIONS = [
  { value: "1", label: "보류" },
  { value: "2", label: "해결" },
];

// 날짜 문자열 자리수 보정
const pad2 = (n) => String(n).padStart(2, "0");
// 서버/입력에서 내려오는 다양한 날짜 포맷을 YYYY-MM-DD로 통일
const toDateInputValue = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (s === "0000-00-00" || s === "0001-01-01") return "";
    return s;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const matchedDate = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (matchedDate?.[1]) {
    const d = matchedDate[1];
    if (d === "0000-00-00" || d === "0001-01-01") return "";
    return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const normalized = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (normalized === "0000-00-00" || normalized === "0001-01-01") return "";
  return normalized;
};

const parseDateOnly = (yyyyMmDd) => {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(String(yyyyMmDd))) return null;
  const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// 날짜 입력칸 숫자 타이핑을 yyyy-mm-dd 형태로 마스킹
const formatDateTypingValue = (rawValue) => {
  const digits = String(rawValue || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

// 마감일 텍스트 경고색 계산 (해결/미해결 + 남은일수 기준)
const getDeadlineTextColor = (dateStr, resultCode) => {
  // 해결 건은 마감 경고색을 적용하지 않음
  if (String(resultCode || "").trim() === "2" || String(resultCode || "").trim() === "해결") {
    return "#344767";
  }

  const normalized = toDateInputValue(dateStr);
  const target = parseDateOnly(normalized);
  if (!target) return "#344767";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "#d32f2f"; // 마감일 지남
  if (diffDays <= 3) return "#f57c00"; // 3일 이내(주황색)
  return "#344767";
};

// 테이블 신규 행 기본값
const makeBlankRow = (id) => ({
  id,
  idx: null,
  sub_date: "",
  account_id: "",
  account_name: "",
  type: "",
  issue: "",
  result: "",
  end_date: "",
  note: "",
  user_id: "",
});

// 저장되지 않은 신규 행 구분용 로컬 ID
const makeLocalId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

// 결과 코드 정규화 (라벨/숫자 혼재 대응)
const normalizeResult = (value) => {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (s === "해결") return "2";
  if (s === "보류") return "1";
  return s;
};

// 서버 응답 행을 화면/저장 공통 포맷으로 정규화
const normalizeRow = (row) => ({
  idx: row.idx ?? null,
  sub_date: toDateInputValue(row.sub_date),
  account_id: row.account_id ? String(row.account_id) : "",
  account_name: row.account_name || "",
  type: row.type != null ? String(row.type) : "",
  issue: row.issue || "",
  result: normalizeResult(row.result),
  end_date: toDateInputValue(row.end_date),
  note: row.note || "",
  user_id: row.user_id ? String(row.user_id) : "",
});

// 비어있는 행(신규 placeholder 행) 판별
const isRowEmpty = (row) =>
  !row.sub_date &&
  !row.account_id &&
  !row.type &&
  !row.issue &&
  !row.result &&
  !row.end_date &&
  !row.note;

// 저장 전 변경감지를 위한 행 비교 함수
const isSameRow = (a, b) =>
  !!a &&
  !!b &&
  String(a.idx || "") === String(b.idx || "") &&
  String(a.sub_date || "") === String(b.sub_date || "") &&
  String(a.account_id || "") === String(b.account_id || "") &&
  String(a.type || "") === String(b.type || "") &&
  String(a.issue || "") === String(b.issue || "") &&
  String(a.result || "") === String(b.result || "") &&
  String(a.end_date || "") === String(b.end_date || "") &&
  String(a.note || "") === String(b.note || "");

// 세션 캐시 조회
const readSessionCache = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (e) {
    return fallback;
  }
};

// 세션 캐시 저장
const writeSessionCache = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore cache write failures
  }
};

// 로그인 사용자 ID 조회(여러 저장 위치 대응)
const getStoredUserId = () => {
  if (typeof window === "undefined") return "";

  // 과거/현재 키명(user_id, login_user_id) + 저장 위치(session/local) 모두 호환
  const keys = ["login_user_id", "user_id"];
  for (const key of keys) {
    const sessionValue = window.sessionStorage.getItem(key);
    if (String(sessionValue || "").trim()) return String(sessionValue).trim();

    const localValue = window.localStorage.getItem(key);
    if (String(localValue || "").trim()) return String(localValue).trim();
  }
  return "";
};

// native date input picker 열기 유틸
const openDateInputPicker = (inputId) => {
  if (typeof document === "undefined") return;
  const target = document.getElementById(inputId);
  if (!target) return;

  if (typeof target.showPicker === "function") {
    try {
      target.showPicker();
      return;
    } catch (e) {
      // showPicker 실패 브라우저는 focus/click 폴백으로 처리
    }
  }

  try {
    target.focus();
    target.click();
  } catch (e) {
    // ignore
  }
};

// 고객사 자동완성 팝업 최소폭 강제
function AccountAutocompletePopper(props) {
  const { style, ...rest } = props;
  const anchorWidth = Number(style?.width || 0);
  return (
    <Popper
      {...rest}
      placement="bottom-start"
      style={{
        ...style,
        width: Math.max(anchorWidth, ACCOUNT_DROPDOWN_MIN_WIDTH),
      }}
    />
  );
}

AccountAutocompletePopper.propTypes = {
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
};

export default function AccountCommunicationTable({ teamCode }) {
  // 행 추가 시 자동 하단 이동을 위한 스크롤 컨테이너 참조
  const mainTableScrollRef = useRef(null);
  const typeTableScrollRef = useRef(null);

  const scrollToBottom = (ref) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = ref?.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    });
  };

  // 메인 데이터 상태
  const [rows, setRows] = useState([]);
  const [panelRows, setPanelRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [typeList, setTypeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountDropdownRowId, setAccountDropdownRowId] = useState(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  // 구분 관리 모달 상태
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeRows, setTypeRows] = useState([]);
  const [typeOriginalRows, setTypeOriginalRows] = useState([]);
  const [typeDeletedIds, setTypeDeletedIds] = useState([]);

  // account_id -> 고객사명 맵
  const accountNameById = useMemo(() => {
    const map = new Map();
    accountList.forEach((acc) => map.set(String(acc.account_id), acc.account_name || ""));
    return map;
  }, [accountList]);

  // 구분 idx -> 구분명 맵
  const typeLabelById = useMemo(() => {
    const map = new Map();
    typeList.forEach((t) => map.set(String(t.idx), t.type || ""));
    return map;
  }, [typeList]);

  // 입력 행의 고객사 정보를 "집계 키/표시명" 형태로 표준화
  const normalizeAccountMeta = (row) => {
    const currentId = String(row?.account_id || "").trim();
    const typedName = String(row?.account_name || "").trim();
    const mappedName = accountNameById.get(currentId) || "";

    if (currentId) {
      return {
        accountKey: `id:${currentId}`,
        accountId: currentId,
        accountName: mappedName || typedName || currentId,
      };
    }

    if (typedName) {
      const exact = (accountList || []).find(
        (acc) => String(acc?.account_name || "").trim() === typedName
      );
      if (exact) {
        const exactId = String(exact.account_id || "").trim();
        return {
          accountKey: `id:${exactId}`,
          accountId: exactId,
          accountName: exact.account_name || typedName,
        };
      }
      return { accountKey: `name:${typedName}`, accountId: "", accountName: typedName };
    }

    return { accountKey: "unassigned", accountId: "", accountName: "미지정" };
  };

  // 오른쪽 패널 집계/목록 계산용 파생 데이터
  const analysisRows = useMemo(() => {
    return (panelRows || [])
      .map((row) => {
        const accountMeta = normalizeAccountMeta(row);
        const subDate = toDateInputValue(row.sub_date);
        const endDate = toDateInputValue(row.end_date);
        const resultCode = String(row.result || "").trim();
        const issueText = String(row.issue || "").trim();
        const noteText = String(row.note || "").trim();
        const typeCode = String(row.type || "").trim();

        const hasData = Boolean(
          subDate ||
          endDate ||
          accountMeta.accountId ||
          (accountMeta.accountName && accountMeta.accountName !== "미지정") ||
          typeCode ||
          issueText ||
          noteText ||
          resultCode
        );

        return {
          ...row,
          ...accountMeta,
          subDate,
          endDate,
          issueText,
          noteText,
          typeCode,
          resultCode,
          isResolved: resultCode === "2",
          isPending: resultCode === "1",
          isNoResult: !resultCode,
          hasData,
        };
      })
      .filter((row) => row.hasData);
  }, [panelRows, accountList, accountNameById]);

  // 업장별 요약(총건수/해결/보류/미입력)
  const accountSummaryRows = useMemo(() => {
    const map = new Map();
    analysisRows.forEach((row) => {
      const key = row.accountKey;
      if (!map.has(key)) {
        map.set(key, {
          key,
          accountId: row.accountId,
          accountName: row.accountName || "미지정",
          total: 0,
          resolved: 0,
          pending: 0,
          noResult: 0,
          unresolved: 0,
        });
      }
      const target = map.get(key);
      target.total += 1;
      if (row.isResolved) {
        target.resolved += 1;
      } else {
        target.unresolved += 1;
        if (row.isPending) target.pending += 1;
        if (row.isNoResult) target.noResult += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.unresolved !== a.unresolved) return b.unresolved - a.unresolved;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.accountName).localeCompare(String(b.accountName), "ko");
    });
  }, [analysisRows]);

  // 전체 요약
  const overallSummary = useMemo(() => {
    return analysisRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.isResolved) acc.resolved += 1;
        else {
          acc.unresolved += 1;
          if (row.isPending) acc.pending += 1;
          if (row.isNoResult) acc.noResult += 1;
        }
        return acc;
      },
      { total: 0, resolved: 0, unresolved: 0, pending: 0, noResult: 0 }
    );
  }, [analysisRows]);

  const selectedSummary = useMemo(
    () => accountSummaryRows.find((row) => row.key === selectedAccountKey) || null,
    [accountSummaryRows, selectedAccountKey]
  );

  const scopedRows = useMemo(() => {
    if (!selectedAccountKey) return analysisRows;
    return analysisRows.filter((row) => row.accountKey === selectedAccountKey);
  }, [analysisRows, selectedAccountKey]);

  const unresolvedRows = useMemo(() => {
    // 미해결건 확인은 고객사 선택과 무관하게 항상 전체 거래처 기준으로 표시
    return analysisRows
      .filter((row) => !row.isResolved)
      .sort((a, b) => {
        const aDate = a.subDate || "9999-12-31";
        const bDate = b.subDate || "9999-12-31";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return String(a.idx || "").localeCompare(String(b.idx || ""));
      });
  }, [analysisRows]);

  const scopedRowsSorted = useMemo(() => {
    return [...scopedRows].sort((a, b) => {
      const aDate = a.subDate || "9999-12-31";
      const bDate = b.subDate || "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(a.idx || "").localeCompare(String(b.idx || ""));
    });
  }, [scopedRows]);

  const currentPanelSummary = selectedSummary || overallSummary;

  // 고객사 목록 조회
  const fetchAccountList = async () => {
    const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
    const list = (res.data || []).map((item) => ({
      account_id: item.account_id,
      account_name: item.account_name,
    }));
    setAccountList(list);
    writeSessionCache(ACCOUNT_CACHE_KEY, list);
    return list;
  };

  // 구분 매핑 조회
  const fetchTypeList = async () => {
    const res = await api.get("/Account/AccountCommunicationMappingList", {
      params: { team_code: teamCode },
    });
    const list = (res.data || []).map((item) => ({
      idx: item.idx,
      team_code: item.team_code,
      type: item.type,
    }));
    setTypeList(list);
    writeSessionCache(TYPE_CACHE_KEY(teamCode), list);
    return list;
  };

  // 이슈 목록 조회
  const fetchCommunicationList = async () => {
    const res = await api.get("/Account/AccountCommunicationList", {
      params: { team_code: teamCode },
    });
    const list = (res.data || []).map((item) => normalizeRow(item));

    const mapped = list.map((row, index) => ({ id: index + 1, ...row }));
    while (mapped.length < MIN_ROWS) {
      mapped.push(makeBlankRow(mapped.length + 1));
    }
    setRows(mapped);
    setPanelRows(mapped.map((row) => ({ ...row })));
    setOriginalRows(mapped.map((row) => ({ ...row })));
    writeSessionCache(ROW_CACHE_KEY(teamCode), mapped);
    return mapped;
  };

  // 초기 조회: 캐시 반영 -> 최신 데이터 동기화
  useEffect(() => {
    let mounted = true;

    const cachedAccounts = readSessionCache(ACCOUNT_CACHE_KEY, []);
    if (Array.isArray(cachedAccounts) && cachedAccounts.length > 0) {
      setAccountList(cachedAccounts);
    }

    const cachedTypes = readSessionCache(TYPE_CACHE_KEY(teamCode), []);
    if (Array.isArray(cachedTypes) && cachedTypes.length > 0) {
      setTypeList(cachedTypes);
    }

    const cachedRows = readSessionCache(ROW_CACHE_KEY(teamCode), []);
    if (Array.isArray(cachedRows) && cachedRows.length > 0) {
      setRows(cachedRows);
      setPanelRows(cachedRows.map((row) => ({ ...row })));
      setOriginalRows(cachedRows.map((row) => ({ ...row })));
      setLoading(false);
    } else {
      setRows([]);
      setPanelRows([]);
      setOriginalRows([]);
      setLoading(true);
    }

    Promise.all([fetchTypeList(), fetchCommunicationList()])
      .catch((err) => console.error("AccountCommunication 초기 조회 실패:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    fetchAccountList().catch((err) => console.error("Account list 조회 실패:", err));
    return () => {
      mounted = false;
    };
  }, [teamCode]);

  // 구분 목록 갱신 시 문자열 구분값을 idx 값으로 보정
  useEffect(() => {
    if (!typeList.length) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!row.type) return row;
        if (typeLabelById.has(String(row.type))) return row;
        const match = typeList.find(
          (opt) => String(opt.type || "").trim() === String(row.type || "").trim()
        );
        return match ? { ...row, type: String(match.idx) } : row;
      })
    );
  }, [typeList, typeLabelById]);

  // 팀코드 변경 시 우측 선택 상태 초기화
  useEffect(() => {
    setSelectedAccountKey(null);
  }, [teamCode]);

  // 선택된 업장이 목록에서 사라지면 선택 해제
  useEffect(() => {
    if (!selectedAccountKey) return;
    if (accountSummaryRows.some((row) => row.key === selectedAccountKey)) return;
    setSelectedAccountKey(null);
  }, [accountSummaryRows, selectedAccountKey]);

  // 선택 행이 데이터에서 사라지면 선택 상태 해제
  useEffect(() => {
    if (!selectedRowId) return;
    if (rows.some((row) => row.id === selectedRowId)) return;
    setSelectedRowId(null);
  }, [rows, selectedRowId]);

  // 일반 셀 변경 핸들러
  const handleRowChange = (id, key, value) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  // 고객사 선택(자동완성 선택값 반영)
  const handleAccountChange = (id, value) => {
    const nextValue = value ? String(value) : "";
    const name = accountNameById.get(String(nextValue)) || "";
    setSelectedRowId(id);
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, account_id: nextValue, account_name: name } : row
      )
    );
    if (nextValue) setSelectedAccountKey(`id:${nextValue}`);
  };

  // 고객사 입력 중(자유 입력) 상태 처리
  const handleAccountInputChange = (id, inputValue) => {
    const nextName = String(inputValue || "");
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const selectedName = accountNameById.get(String(row.account_id || "")) || "";
        if (!nextName) return { ...row, account_id: "", account_name: "" };
        if (selectedName && selectedName === nextName) return { ...row, account_name: nextName };
        return { ...row, account_id: "", account_name: nextName };
      })
    );
  };

  // 고객사 검색 입력 후 Enter 시 첫 일치값 자동 선택
  const handleAccountEnterSelect = (id, keyword) => {
    const q = String(keyword || "").trim().toLowerCase();
    if (!q) return false;

    const exactId = (accountList || []).find((acc) => String(acc?.account_id || "").toLowerCase() === q);
    const exactName = (accountList || []).find(
      (acc) => String(acc?.account_name || "").trim().toLowerCase() === q
    );
    const partial = (accountList || []).find((acc) => {
      const name = String(acc?.account_name || "").toLowerCase();
      const aid = String(acc?.account_id || "").toLowerCase();
      return name.includes(q) || aid.includes(q);
    });

    const picked = exactId || exactName || partial;
    if (picked) {
      handleAccountChange(id, String(picked.account_id));
      return true;
    }
    return false;
  };

  // 고객사 셀 클릭 시 우측 패널 업장 선택 동기화
  const handleAccountCellSelect = (row) => {
    setSelectedRowId(row.id);
    const meta = normalizeAccountMeta(row);
    if (!meta?.accountKey || meta.accountKey === "unassigned") return;
    setSelectedAccountKey(meta.accountKey);
  };

  // 편집 행 직접 추가
  const handleAddTableRow = () => {
    setRows((prev) => [...prev, makeBlankRow(makeLocalId())]);
    scrollToBottom(mainTableScrollRef);
  };

  // 메인 테이블 저장
  const handleSave = async () => {
    const currentUserId = getStoredUserId();
    if (!currentUserId) {
      Swal.fire("사용자 확인", "로그인 사용자 ID를 찾을 수 없습니다. 다시 로그인 후 저장해주세요.", "warning");
      return;
    }

    const modified = rows
      .map((row, i) => ({ row, orig: originalRows[i] }))
      .filter(({ row, orig }) => !isSameRow(row, orig))
      .map(({ row }) => row)
      .filter((row) => !(row.idx == null && isRowEmpty(row)));

    if (modified.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    const invalidRows = modified.filter(
      (row) => !row.account_id || !row.sub_date || !row.type
    );

    if (invalidRows.length > 0) {
      Swal.fire("필수값 확인", "접수일/지점/구분은 필수입니다.", "warning");
      return;
    }

    const payload = modified.map((row) => ({
      idx: row.idx,
      team_code: teamCode,
      sub_date: toDateInputValue(row.sub_date) || null,
      account_id: row.account_id || null,
      type: row.type ? Number(row.type) : null,
      issue: row.issue || "",
      result: row.result ? Number(row.result) : null,
      end_date: toDateInputValue(row.end_date) || null,
      note: row.note || "",
      user_id: currentUserId || null,
    }));

    try {
      const res = await api.post("/Account/AccountCommunicationSave", { data: payload });
      if (res.data?.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        await fetchCommunicationList();
      } else {
        Swal.fire("저장 실패", res.data?.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // 구분 관리 모달 열기
  const openTypeModal = () => {
    const mapped = typeList.map((row, index) => ({
      id: index + 1,
      idx: row.idx,
      type: row.type || "",
    }));
    setTypeRows(mapped);
    setTypeOriginalRows(mapped.map((row) => ({ ...row })));
    setTypeDeletedIds([]);
    setTypeModalOpen(true);
  };

  // 구분 행 추가
  const handleTypeAdd = () => {
    setTypeRows((prev) => [
      ...prev,
      { id: makeLocalId(), idx: null, type: "" },
    ]);
    scrollToBottom(typeTableScrollRef);
  };

  // 구분 값 변경
  const handleTypeChange = (id, value) => {
    setTypeRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, type: value } : row))
    );
  };

  // 구분 삭제(기존 idx는 삭제 목록에 적재)
  const handleTypeDelete = (row) => {
    if (row.idx) setTypeDeletedIds((prev) => [...prev, row.idx]);
    setTypeRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  // 구분 저장(삽입/수정/삭제 동시 처리)
  const handleTypeSave = async () => {
    const trimmed = typeRows.map((row) => ({ ...row, type: String(row.type || "").trim() }));
    const invalid = trimmed.filter((row) => !row.type);
    if (invalid.length > 0) {
      Swal.fire("구분 확인", "구분명은 비워둘 수 없습니다.", "warning");
      return;
    }

    const modified = trimmed.filter((row, i) => {
      const orig = typeOriginalRows[i];
      if (!orig) return true;
      return String(orig.type || "") !== String(row.type || "") || orig.idx !== row.idx;
    });

    try {
      let hasSaved = false;

      if (typeDeletedIds.length > 0) {
        const delRes = await api.post("/Account/AccountCommunicationMappingDelete", {
          ids: typeDeletedIds,
        });
        if (delRes.data?.code !== 200) {
          throw new Error(delRes.data?.message || "삭제 실패");
        }
        hasSaved = true;
      }

      if (modified.length > 0) {
        const payload = modified.map((row) => ({
          idx: row.idx,
          team_code: teamCode,
          type: row.type,
        }));
        const saveRes = await api.post("/Account/AccountCommunicationMappingSave", { data: payload });
        if (saveRes.data?.code !== 200) {
          throw new Error(saveRes.data?.message || "저장 실패");
        }
        hasSaved = true;
      }

      if (!hasSaved) {
        Swal.fire("저장할 변경사항이 없습니다.", "", "info");
        return;
      }

      await fetchTypeList();
      setTypeModalOpen(false);
      Swal.fire("저장 완료", "구분 변경사항이 저장되었습니다.", "success");
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
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
      borderCollapse: "collapse",
      tableLayout: "fixed",
    },
    "& th, & td": {
      border: "1px solid #cfd6de",
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
      zIndex: 2,
      fontWeight: 700,
    },
    // 고객사 컬럼은 값 유무와 무관하게 동일 폭으로 고정
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

  // 멀티라인 입력칸 스타일(이슈/비고)
  const multilineFieldSx = {
    "& .MuiInputBase-root": {
      alignItems: "center",
    },
    "& .MuiInputBase-inputMultiline": {
      padding: "6px 8px",
      fontSize: CONTROL_FONT_SIZE,
      lineHeight: 1.35,
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

  // 구분 셀은 결과 셀과 동일 톤의 단색 박스로 표시
  const typeBoxSx = {
    backgroundColor: "#f1f3f5",
    "& .MuiSelect-select": {
      ...compactCenteredSelectTextSx,
      color: "#495057",
    },
  };

  const colStyle = (w) => ({ minWidth: w, width: w });

  const getResultLabel = (resultCode) =>
    RESULT_OPTIONS.find((opt) => opt.value === String(resultCode || ""))?.label || "미입력";

  const renderDetailTable = (dataRows, emptyText, { showAccount = false } = {}) => {
    /*
      우측 "전체 지점별 확인 / 미해결건 확인" 공통 테이블 렌더러.
      가로/세로 셀 구분선이 동일하게 보이도록 th/td 기본 테두리를 통일한다.
    */
    const headCellStyle = {
      padding: "6px",
      fontSize: 12,
      background: "#edf2f7",
      whiteSpace: "nowrap",
      wordBreak: "keep-all",
      border: "1px solid #dbe3eb",
    };
    const bodyCellStyle = {
      fontSize: 12,
      border: "1px solid #edf2f7",
    };

    return (
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 92 }} />
          {showAccount && <col style={{ width: 96 }} />}
          <col style={{ width: 62 }} />
          <col style={{ width: showAccount ? 176 : 188 }} />
          <col style={{ width: 62 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: showAccount ? 176 : 188 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={headCellStyle}>접수일</th>
            {showAccount && <th style={headCellStyle}>고객사</th>}
            <th style={headCellStyle}>구분</th>
            <th style={{ ...headCellStyle, textAlign: "left" }}>이슈</th>
            <th style={headCellStyle}>결과</th>
            <th style={headCellStyle}>마감일</th>
            <th style={{ ...headCellStyle, textAlign: "left" }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((item) => {
            const deadlineColor = getDeadlineTextColor(item.endDate, item.resultCode);
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
                    whiteSpace: "normal",
                    wordBreak: "break-all",
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
                  {getResultLabel(item.resultCode)}
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
                    whiteSpace: "normal",
                    wordBreak: "break-all",
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
                colSpan={showAccount ? 7 : 6}
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
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <MDButton variant="outlined" color="dark" onClick={handleAddTableRow}>
          행 추가
        </MDButton>
        <MDButton variant="outlined" color="info" onClick={openTypeModal}>
          구분 관리
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
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
                <col style={colStyle(LEFT_COL_WIDTH.note)} />
              </colgroup>
              <thead>
                <tr>
                  <th style={colStyle(LEFT_COL_WIDTH.subDate)}>접수일</th>
                  <th style={colStyle(LEFT_COL_WIDTH.account)}>고객사</th>
                  <th style={colStyle(LEFT_COL_WIDTH.type)}>구분</th>
                  <th style={colStyle(LEFT_COL_WIDTH.issue)}>이슈</th>
                  <th style={colStyle(LEFT_COL_WIDTH.result)}>결과</th>
                  <th style={colStyle(LEFT_COL_WIDTH.endDate)}>마감일</th>
                  <th style={colStyle(LEFT_COL_WIDTH.note)}>비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const deadlineColor = getDeadlineTextColor(row.end_date, row.result);
                  const isSelectedRow = selectedRowId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={isSelectedRow ? "row-selected" : ""}
                      onClick={() => handleAccountCellSelect(row)}
                    >
                      <td>
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
                      </td>
                      <td style={{ overflow: "hidden" }}>
                        <Autocomplete
                          size="small"
                          options={accountList || []}
                          // clear 아이콘을 없애서 화살표 기준 간격을 일정하게 유지
                          disableClearable
                          popupIcon={
                            <ArrowDropDownIcon sx={{ fontSize: DROPDOWN_ICON_SIZE, color: "#6c757d" }} />
                          }
                          PopperComponent={AccountAutocompletePopper}
                          ListboxProps={{
                            style: {
                              whiteSpace: "nowrap",
                            },
                          }}
                          open={accountDropdownRowId === row.id}
                          onOpen={() => setAccountDropdownRowId(row.id)}
                          onClose={() =>
                            setAccountDropdownRowId((prev) => (prev === row.id ? null : prev))
                          }
                          value={
                            (accountList || []).find(
                              (acc) => String(acc.account_id) === String(row.account_id || "")
                            ) || null
                          }
                          inputValue={
                            row.account_name ||
                            accountNameById.get(String(row.account_id || "")) ||
                            ""
                          }
                          onChange={(_, newValue) => {
                            handleAccountChange(row.id, newValue ? String(newValue.account_id) : "");
                            setAccountDropdownRowId(null);
                          }}
                          onInputChange={(_, newInputValue, reason) => {
                            if (reason === "reset") return;
                            handleAccountInputChange(row.id, newInputValue);
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
                            minWidth: 0,
                            maxWidth: "100%",
                            // 고객사 입력칸 우측(텍스트-화살표) 여백 최소화
                            "&.MuiAutocomplete-hasPopupIcon .MuiAutocomplete-inputRoot": {
                              paddingRight: "12px !important",
                            },
                            "&.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot": {
                              paddingRight: "12px !important",
                            },
                            "& .MuiAutocomplete-inputRoot": {
                              minWidth: 0,
                              width: "100%",
                              paddingRight: "12px !important",
                            },
                            "& .MuiAutocomplete-inputRoot[class*='MuiOutlinedInput-root']": {
                              paddingRight: "12px !important",
                            },
                            "& .MuiInputBase-root": {
                              minWidth: 0,
                              width: "100%",
                            },
                            "& .MuiAutocomplete-input": {
                              minWidth: "0 !important",
                              padding: "0 !important",
                            },
                            "& .MuiAutocomplete-endAdornment": {
                              right: "2px !important",
                            },
                            "& .MuiAutocomplete-popupIndicator": {
                              p: "0 !important",
                              m: 0,
                              width: 12,
                              height: 12,
                            },
                            "& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root": {
                              fontSize: `${DROPDOWN_ICON_SIZE} !important`,
                              color: "#6c757d",
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
                              placeholder="고객사 검색"
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                const keyword =
                                  row.account_name ||
                                  accountNameById.get(String(row.account_id || "")) ||
                                  e.currentTarget.value;
                                handleAccountEnterSelect(row.id, keyword);
                                setAccountDropdownRowId(null);
                                e.currentTarget.blur();
                              }}
                              sx={{
                                ...textFieldSx,
                                width: "100%",
                                "& .MuiInputBase-root": {
                                  minWidth: 0,
                                },
                                "& .MuiInputBase-input": {
                                  padding: "6px 0 6px 8px",
                                  fontSize: CONTROL_FONT_SIZE,
                                  minWidth: 0,
                                },
                                "& .MuiInputBase-input::placeholder": {
                                  fontSize: PLACEHOLDER_FONT_SIZE,
                                  opacity: 0.82,
                                },
                              }}
                            />
                          )}
                        />
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
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
                            ...(isSelectedRow ? { backgroundColor: SELECTED_ROW_BG } : {}),
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
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <TextField
                          size="small"
                          value={row.issue}
                          onChange={(e) => handleRowChange(row.id, "issue", e.target.value)}
                          multiline
                          minRows={1}
                          maxRows={ISSUE_NOTE_MAX_ROWS}
                          sx={{ ...textFieldSx, ...multilineFieldSx, width: "100%" }}
                        />
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <Select
                          size="small"
                          value={row.result || ""}
                          onChange={(e) => handleRowChange(row.id, "result", e.target.value)}
                          IconComponent={() => null}
                          displayEmpty
                          renderValue={(selected) =>
                            RESULT_OPTIONS.find((opt) => opt.value === selected)?.label || "선택"
                          }
                          sx={{
                            ...selectSx,
                            ...resultSx(row.result || ""),
                            ...(isSelectedRow ? { backgroundColor: SELECTED_ROW_BG } : {}),
                            display: "block",
                            width: "88%",
                            minWidth: 52,
                            overflow: "hidden",
                            mx: "auto",
                            "& .MuiSelect-select": {
                              ...((resultSx(row.result || "")["& .MuiSelect-select"] || {})),
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
                      </td>
                      <td>
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
                                color: deadlineColor,
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
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <TextField
                          size="small"
                          value={row.note}
                          onChange={(e) => handleRowChange(row.id, "note", e.target.value)}
                          multiline
                          minRows={1}
                          maxRows={ISSUE_NOTE_MAX_ROWS}
                          sx={{ ...textFieldSx, ...multilineFieldSx, width: "100%" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>

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
          <MDBox display="flex" justifyContent="space-between" alignItems="center" gap={1}>
            <MDTypography variant="h6">
              {selectedSummary ? `${selectedSummary.accountName} 지점별 확인` : "전체 지점별 확인"}
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={1}>
              <Autocomplete
                size="small"
                options={accountSummaryRows}
                popupIcon={
                  <ArrowDropDownIcon sx={{ fontSize: DROPDOWN_ICON_SIZE, color: "#6c757d" }} />
                }
                value={selectedSummary}
                onChange={(_, newValue) => setSelectedAccountKey(newValue?.key || null)}
                getOptionLabel={(option) => option?.accountName || ""}
                isOptionEqualToValue={(option, value) => option?.key === value?.key}
                sx={{
                  minWidth: 190,
                  background: "#fff",
                  "& .MuiInputBase-root": {
                    minHeight: "25px !important",
                    height: 25,
                  },
                  "& .MuiInputBase-input": {
                    py: 0,
                    fontSize: CONTROL_FONT_SIZE,
                    fontWeight: 700,
                    lineHeight: 1.2,
                  },
                  "& .MuiAutocomplete-popupIndicator": { p: "2px" },
                  "& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root": {
                    fontSize: `${DROPDOWN_ICON_SIZE} !important`,
                    color: "#6c757d",
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="지점 선택(전체)"
                    sx={{
                      ...textFieldSx,
                      "& .MuiInputBase-input::placeholder": {
                        fontSize: PLACEHOLDER_FONT_SIZE,
                        opacity: 0.8,
                      },
                    }}
                  />
                )}
              />
              <MDButton
                variant="text"
                color="dark"
                size="small"
                onClick={() => setSelectedAccountKey(null)}
                sx={{ minWidth: "auto", p: "2px 8px" }}
              >
                전체 보기
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
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
            {renderDetailTable(scopedRowsSorted, "표시할 건이 없습니다.", { showAccount: !selectedAccountKey })}
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
            {renderDetailTable(unresolvedRows, "미해결 건이 없습니다.", {
              showAccount: true,
            })}
          </Box>
        </Box>
      </MDBox>

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

AccountCommunicationTable.propTypes = {
  teamCode: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};
