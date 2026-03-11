/* eslint-disable react/function-component-definition, no-unused-vars */
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import api from "api/api";

// 기본 빈 행 수(최소 표시 행)
const MIN_ROWS = 10;
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
  solution: "",
  note: "",
  user_id: "",
  // 삭제 플래그 기본값(N): 화면 기본 행은 항상 노출 대상
  del_yn: "N",
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
  solution: row.solution || "",
  note: row.note || "",
  user_id: row.user_id ? String(row.user_id) : "",
  // 소프트삭제 컬럼(미존재/NULL 대비 기본값 N)
  del_yn: String(row.del_yn || "N").toUpperCase(),
});

// 비어있는 행(신규 placeholder 행) 판별
const isRowEmpty = (row) =>
  !row.sub_date &&
  !row.account_id &&
  !row.type &&
  !row.issue &&
  !row.result &&
  !row.end_date &&
  !row.solution &&
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
  String(a.solution || "") === String(b.solution || "") &&
  String(a.note || "") === String(b.note || "");

// 로그인 사용자 ID 조회(여러 저장 위치 대응)
const getStoredUserId = () => {
  if (typeof window === "undefined") return "";

  // localStorage 단일 기준(user_id) 사용
  return String(window.localStorage.getItem("user_id") || "").trim();
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

export default function useDeadlineIssueTab2Data(teamCode = 2) {
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
  const [selectedAccountKey, setSelectedAccountKey] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [ctxMenu, setCtxMenu] = useState({
    open: false,
    mouseX: 0,
    mouseY: 0,
    rowIndex: null,
  });

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
        const solutionText = String(row.solution || "").trim();
        const noteText = String(row.note || "").trim();
        const typeCode = String(row.type || "").trim();

        const hasData = Boolean(
          subDate ||
          endDate ||
          accountMeta.accountId ||
          (accountMeta.accountName && accountMeta.accountName !== "미지정") ||
          typeCode ||
          issueText ||
          solutionText ||
          noteText ||
          resultCode
        );

        return {
          ...row,
          ...accountMeta,
          subDate,
          endDate,
          issueText,
          solutionText,
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
    return list;
  };

  // 이슈 목록 조회
  const fetchCommunicationList = async () => {
    const res = await api.get("/Account/AccountCommunicationList", {
      // 소프트삭제 적용: 삭제되지 않은 행(del_yn='N')만 조회
      params: { team_code: teamCode, del_yn: "N" },
    });
    const list = (res.data || []).map((item) => normalizeRow(item));

    const mapped = list.map((row, index) => ({ id: index + 1, ...row }));
    while (mapped.length < MIN_ROWS) {
      mapped.push(makeBlankRow(mapped.length + 1));
    }
    setRows(mapped);
    setPanelRows(mapped.map((row) => ({ ...row })));
    setOriginalRows(mapped.map((row) => ({ ...row })));
    return mapped;
  };

  // 초기 조회: 서버 데이터 동기화
  useEffect(() => {
    let mounted = true;
    setRows([]);
    setPanelRows([]);
    setOriginalRows([]);
    setLoading(true);

    Promise.all([fetchAccountList(), fetchTypeList(), fetchCommunicationList()])
      .catch((err) => console.error("AccountCommunication 초기 조회 실패:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
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

  // 행 전체 map 비용을 줄이기 위해 대상 행만 찾아 갱신
  const updateRowById = (id, updater) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      if (index < 0) return prev;

      const currentRow = prev[index];
      const nextRow = updater(currentRow);
      if (nextRow === currentRow) return prev;

      const next = [...prev];
      next[index] = nextRow;
      return next;
    });
  };

  // 일반 셀 변경 핸들러
  const handleRowChange = (id, key, value) => {
    updateRowById(id, (row) => {
      if (row?.[key] === value) return row;
      return { ...row, [key]: value };
    });
  };

  // 고객사 선택(자동완성 선택값 반영)
  const handleAccountChange = (id, value) => {
    const nextValue = value ? String(value) : "";
    const name = accountNameById.get(String(nextValue)) || "";
    setSelectedRowId(id);
    updateRowById(id, (row) => {
      if (row.account_id === nextValue && row.account_name === name) return row;
      return { ...row, account_id: nextValue, account_name: name };
    });
    if (nextValue) setSelectedAccountKey(`id:${nextValue}`);
  };

  // 고객사 입력 중(자유 입력) 상태 처리
  const handleAccountInputChange = (id, inputValue) => {
    const nextName = String(inputValue || "");
    updateRowById(id, (row) => {
      const selectedName = accountNameById.get(String(row.account_id || "")) || "";
      if (!nextName) {
        if (!row.account_id && !row.account_name) return row;
        return { ...row, account_id: "", account_name: "" };
      }
      if (selectedName && selectedName === nextName) {
        if (row.account_name === nextName) return row;
        return { ...row, account_name: nextName };
      }
      if (!row.account_id && row.account_name === nextName) return row;
      return { ...row, account_id: "", account_name: nextName };
    });
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

  // 고객사 셀 클릭 시 선택 상태만 변경하고, 드롭다운은 사용자가 직접 열도록 유지
  const handleAccountCellSelect = (row) => {
    setSelectedRowId(row.id);
    const meta = normalizeAccountMeta(row);
    if (!meta?.accountKey || meta.accountKey === "unassigned") return;
    setSelectedAccountKey(meta.accountKey);
  };

  // 편집 행 직접 추가
  const handleAddTableRow = () => {
    const newRow = makeBlankRow(makeLocalId());
    setRows((prev) => [...prev, newRow]);
    // 행 추가 직후 새 행을 선택 상태로 만들어 즉시 입력 가능하게 한다.
    setSelectedRowId(newRow.id);
    setSelectedAccountKey(null);
    scrollToBottom(mainTableScrollRef);
  };

  // 우클릭 컨텍스트 메뉴 열기
  const handleRowContextMenu = (e, row, rowIndex) => {
    e.preventDefault();
    handleAccountCellSelect(row);
    setCtxMenu({
      open: true,
      mouseX: e.clientX,
      mouseY: e.clientY,
      rowIndex,
    });
  };

  const closeCtxMenu = () => {
    setCtxMenu((prev) => ({ ...prev, open: false, rowIndex: null }));
  };

  // 우클릭 시에는 셀 내부 입력 컨트롤 이벤트(달력/셀렉트/자동완성)가 동작하지 않도록 차단
  const blockRightMouseCellInteraction = (e) => {
    if (e.button !== 2) return;
    e.stopPropagation();
  };

  const removeRowFromState = (rowIndex, rowId) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    setOriginalRows((prev) => prev.filter((_, i) => i !== rowIndex));
    setPanelRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleDeleteRow = async (rowIndex) => {
    if (rowIndex == null) return;
    const row = rows[rowIndex];
    if (!row) return;

    const result = await Swal.fire({
      title: "행 삭제",
      text: "해당 행을 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#9e9e9e",
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });

    if (!result.isConfirmed) return;

    // 미저장 신규 행은 서버 저장 없이 화면에서만 제거
    if (row.idx == null) {
      removeRowFromState(rowIndex, row.id);
      closeCtxMenu();
      Swal.fire({
        title: "삭제",
        text: "삭제 처리되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      return;
    }

    const currentUserId = getStoredUserId();
    if (!currentUserId) {
      Swal.fire("사용자 확인", "로그인 사용자 ID를 찾을 수 없습니다. 다시 로그인 후 삭제해주세요.", "warning");
      return;
    }

    try {
      const deletePayload = {
        idx: row.idx,
        team_code: teamCode,
        sub_date: toDateInputValue(row.sub_date) || null,
        account_id: row.account_id || null,
        type: row.type ? Number(row.type) : null,
        issue: row.issue || "",
        result: row.result ? Number(row.result) : null,
        end_date: toDateInputValue(row.end_date) || null,
        solution: row.solution || "",
        note: row.note || "",
        user_id: currentUserId || null,
        del_yn: "Y",
      };

      const res = await api.post("/Account/AccountCommunicationSave", { data: [deletePayload] });

      if (res.data?.code === 200) {
        removeRowFromState(rowIndex, row.id);
        closeCtxMenu();
        Swal.fire({
          title: "삭제",
          text: "삭제 처리되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      } else {
        Swal.fire({
          title: "오류",
          text: res.data?.message || "삭제 저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "오류",
        text: "삭제 저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  // 메인 테이블 저장
  const handleSave = async () => {
    const currentUserId = getStoredUserId();
    if (!currentUserId) {
      Swal.fire("사용자 확인", "로그인 사용자 ID를 찾을 수 없습니다. 다시 로그인 후 저장해주세요.", "warning");
      return;
    }

    const modifiedCandidates = rows
      .map((row, i) => ({ row, orig: originalRows[i] }))
      .filter(({ row, orig }) => !isSameRow(row, orig))
      .filter(({ row }) => !(row.idx == null && isRowEmpty(row)));

    const modified = modifiedCandidates.map(({ row }) => row);

    // 저장 전 선택 행을 기억해, 저장/재조회 뒤에도 동일 행을 다시 선택한다.
    const selectedBeforeSave = rows.find((row) => row.id === selectedRowId) || null;
    const selectedBeforeIdx = selectedBeforeSave?.idx != null ? String(selectedBeforeSave.idx) : "";
    const selectedBeforeSignature = selectedBeforeSave
      ? {
        sub_date: String(toDateInputValue(selectedBeforeSave.sub_date) || ""),
        account_id: String(selectedBeforeSave.account_id || ""),
        type: String(selectedBeforeSave.type || ""),
        issue: String(selectedBeforeSave.issue || ""),
        result: String(selectedBeforeSave.result || ""),
        end_date: String(toDateInputValue(selectedBeforeSave.end_date) || ""),
        solution: String(selectedBeforeSave.solution || ""),
        note: String(selectedBeforeSave.note || ""),
      }
      : null;

    if (modified.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    const invalidRows = modified.filter(
      (row) => !row.account_id || !row.sub_date || !row.type
    );

    if (invalidRows.length > 0) {
      Swal.fire("필수값 확인", "접수일/고객사/구분은 필수입니다.", "warning");
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
        solution: row.solution || "",
        note: row.note || "",
        user_id: currentUserId || null,
        // 일반 저장은 항상 활성 상태(N)로 유지
        del_yn: "N",
    }));

    try {
      const res = await api.post("/Account/AccountCommunicationSave", { data: payload });
      if (res.data?.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        const refreshedRows = await fetchCommunicationList();

        let nextSelectedId = null;
        if (selectedBeforeSave) {
          if (selectedBeforeIdx) {
            const matchedByIdx = refreshedRows.find(
              (row) => String(row?.idx ?? "") === selectedBeforeIdx
            );
            if (matchedByIdx) nextSelectedId = matchedByIdx.id;
          }

          if (!nextSelectedId && selectedBeforeSignature) {
            const matchedBySignature = refreshedRows.find((row) => (
              String(toDateInputValue(row?.sub_date) || "") === selectedBeforeSignature.sub_date
              && String(row?.account_id || "") === selectedBeforeSignature.account_id
              && String(row?.type || "") === selectedBeforeSignature.type
              && String(row?.issue || "") === selectedBeforeSignature.issue
              && String(row?.result || "") === selectedBeforeSignature.result
              && String(toDateInputValue(row?.end_date) || "") === selectedBeforeSignature.end_date
              && String(row?.solution || "") === selectedBeforeSignature.solution
              && String(row?.note || "") === selectedBeforeSignature.note
            ));
            if (matchedBySignature) nextSelectedId = matchedBySignature.id;
          }
        }

        setSelectedRowId(nextSelectedId);
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

  return {
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
  };
}
