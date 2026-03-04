/* eslint-disable react/function-component-definition */
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "api/api";

// ✅ 기본 최소 행 수
const MIN_ROWS = 10;

// ✅ 결과 옵션
const RESULT_OPTIONS = [
  { value: "", label: "선택" },
  { value: "1", label: "보류" },
  { value: "2", label: "해결" },
];

// ✅ 월/일 두 자리 문자열 보정
const pad2 = (n) => String(n).padStart(2, "0");

// ✅ 날짜 포맷 정규화 (YYYY-MM-DD)
const toDateInputValue = (value) => {
  if (!value) return "";
  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (s === "0000-00-00" || s === "0001-01-01") return "";
    return s;
  }

  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  const matched = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (matched?.[1]) {
    if (matched[1] === "0000-00-00" || matched[1] === "0001-01-01") return "";
    return matched[1];
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "";

  const normalized = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  if (normalized === "0000-00-00" || normalized === "0001-01-01") return "";
  return normalized;
};

// ✅ 결과값(문자/코드)을 저장용 코드로 정규화
const normalizeResult = (value) => {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (s === "해결") return "2";
  if (s === "보류") return "1";
  return s;
};

// ✅ 서버 row -> UI row
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
});

// ✅ 신규(미저장) 행 식별용 로컬 ID 생성
const makeLocalId = () => `new_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// ✅ 테이블 신규 입력용 빈 행 템플릿
const makeBlankRow = () => ({
  id: makeLocalId(),
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
});

// ✅ 저장 대상 필터링을 위한 "완전 빈 행" 판별
const isRowEmpty = (row) =>
  !row.sub_date &&
  !row.account_id &&
  !row.type &&
  !row.issue &&
  !row.result &&
  !row.end_date &&
  !row.solution &&
  !row.note;

// ✅ 현재 행과 원본 행의 변경 여부 비교
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

// ✅ 저장/삭제 API에 전달할 로그인 사용자 ID 조회
const getStoredUserId = () => {
  if (typeof window === "undefined") return "";

  const keys = ["login_user_id", "user_id"];
  for (const key of keys) {
    const sessionValue = window.sessionStorage.getItem(key);
    if (String(sessionValue || "").trim()) return String(sessionValue).trim();

    const localValue = window.localStorage.getItem(key);
    if (String(localValue || "").trim()) return String(localValue).trim();
  }

  return "";
};

// ✅ 서버 행을 화면용 row + 안정적인 id 형태로 변환
const withRowId = (row, index) => {
  const normalized = normalizeRow(row);
  const id = normalized.idx != null ? `idx_${normalized.idx}` : String(row.id || `tmp_${index}_${makeLocalId()}`);
  return { id, ...normalized };
};

// ✅ 화면 최소 행 수(MIN_ROWS) 보장
const ensureMinRows = (rows) => {
  const nextRows = [...rows];
  while (nextRows.length < MIN_ROWS) {
    nextRows.push(makeBlankRow());
  }
  return nextRows;
};

// ✅ rows 깊은 복사용 유틸
const cloneRows = (rows) => rows.map((row) => ({ ...row }));

export default function useDeadlineIssueTab2Data(teamCode = 2) {
  // ✅ 팀코드 문자열 키(조회/저장 파라미터 공통 사용)
  const teamCodeKey = String(teamCode ?? "");

  // ✅ 메인 테이블 현재값/원본값 상태
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  // ✅ 공통 코드성 목록 상태(고객사/구분)
  const [accountList, setAccountList] = useState([]);
  const [typeList, setTypeList] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ 구분 관리 모달 상태
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeRows, setTypeRows] = useState([]);
  const [typeOriginalRows, setTypeOriginalRows] = useState([]);
  const [typeDeletedIds, setTypeDeletedIds] = useState([]);

  // ✅ 팀코드 1 여부(고객사 이슈 화면 분기용)
  const isCustomerIssueTeam = teamCodeKey === "1";

  // ✅ account_id -> 고객사명 빠른 매핑
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((acc) => {
      map.set(String(acc.account_id), acc.account_name || "");
    });
    return map;
  }, [accountList]);

  // ✅ 고객사 드롭다운 옵션
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name || String(acc.account_id),
      })),
    [accountList]
  );

  // ✅ 구분 드롭다운 옵션
  const typeOptions = useMemo(
    () =>
      (typeList || []).map((type) => ({
        value: String(type.idx),
        label: type.type || String(type.idx),
      })),
    [typeList]
  );

  // ✅ 고객사 목록 조회
  const fetchAccountList = useCallback(async () => {
    const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
    const list = (res.data || []).map((item) => ({
      account_id: item.account_id,
      account_name: item.account_name,
    }));

    setAccountList(list);
    return list;
  }, []);

  // ✅ 구분 매핑 목록 조회
  const fetchTypeList = useCallback(async () => {
    const res = await api.get("/Account/AccountCommunicationMappingList", {
      params: { team_code: teamCodeKey },
    });

    const list = (res.data || []).map((item) => ({
      idx: item.idx,
      team_code: item.team_code,
      type: item.type,
    }));

    setTypeList(list);
    return list;
  }, [teamCodeKey]);

  // ✅ 이슈 커뮤니케이션 원본 데이터 조회
  const fetchCommunicationList = useCallback(async () => {
    const res = await api.get("/Account/AccountCommunicationList", {
      params: { team_code: teamCodeKey },
    });

    const normalizedRows = (res.data || []).map((item, index) => withRowId(item, index));
    const nextRows = ensureMinRows(normalizedRows);
    const snapshot = cloneRows(nextRows);

    setRows(nextRows);
    setOriginalRows(snapshot);

    return nextRows;
  }, [teamCodeKey]);

  // ✅ 초기 로딩: 서버 동기화
  useEffect(() => {
    let mounted = true;

    const blanks = ensureMinRows([]);
    setRows(blanks);
    setOriginalRows(cloneRows(blanks));
    setLoading(true);

    Promise.all([fetchAccountList(), fetchTypeList(), fetchCommunicationList()])
      .catch((err) => console.error("AccountIssueSheet 초기 조회 실패:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [teamCodeKey, fetchAccountList, fetchTypeList, fetchCommunicationList]);

  // ✅ 구분 값이 문자열로 들어온 경우 idx 값으로 보정
  useEffect(() => {
    if (!typeList.length) return;

    const typeLabelMap = new Map(typeList.map((item) => [String(item.idx), item.type || ""]));

    setRows((prev) =>
      prev.map((row) => {
        if (!row.type) return row;
        if (typeLabelMap.has(String(row.type))) return row;

        const matched = typeList.find(
          (item) => String(item.type || "").trim() === String(row.type || "").trim()
        );

        return matched ? { ...row, type: String(matched.idx) } : row;
      })
    );
  }, [typeList]);

  // ✅ 셀 단일 값 업데이트
  const updateRowValue = useCallback((id, key, value) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }, []);

  // ✅ 고객사 선택 업데이트(account_id + account_name 동시 반영)
  const updateAccount = useCallback(
    (id, accountId) => {
      const nextAccountId = String(accountId || "");
      const accountName = accountNameById.get(nextAccountId) || "";

      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                account_id: nextAccountId,
                account_name: accountName,
              }
            : row
        )
      );
    },
    [accountNameById]
  );

  // ✅ 신규 입력 행 추가
  const addRow = useCallback(() => {
    setRows((prev) => [...prev, makeBlankRow()]);
  }, []);

  // ✅ 행 삭제 후에도 최소 행 수 유지
  const removeRowFromState = useCallback((rowId) => {
    setRows((prev) => ensureMinRows(prev.filter((row) => row.id !== rowId)));
    setOriginalRows((prev) => ensureMinRows(prev.filter((row) => row.id !== rowId)));
  }, []);

  // ✅ 행 삭제 처리(미저장행 즉시 삭제 / 저장행 서버 삭제)
  const deleteRow = useCallback(
    async (rowId) => {
      const row = rows.find((item) => item.id === rowId);
      if (!row) return;

      const confirm = await Swal.fire({
        title: "행 삭제",
        text: "해당 행을 삭제할까요?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
      });

      if (!confirm.isConfirmed) return;

      if (row.idx == null) {
        removeRowFromState(rowId);
        return;
      }

      const currentUserId = getStoredUserId();
      if (!currentUserId) {
        Swal.fire("사용자 확인", "로그인 사용자 ID를 찾을 수 없습니다.", "warning");
        return;
      }

      try {
        const payload = {
          idx: row.idx,
          team_code: teamCodeKey,
          sub_date: toDateInputValue(row.sub_date) || null,
          account_id: row.account_id || null,
          type: row.type ? Number(row.type) : null,
          issue: row.issue || "",
          result: row.result ? Number(row.result) : null,
          end_date: toDateInputValue(row.end_date) || null,
          solution: row.solution || "",
          note: row.note || "",
          user_id: currentUserId,
          del_yn: "Y",
        };

        const res = await api.post("/Account/AccountCommunicationSave", { data: [payload] });

        if (res.data?.code === 200) {
          removeRowFromState(rowId);
        } else {
          Swal.fire("삭제 실패", res.data?.message || "서버 오류", "error");
        }
      } catch (err) {
        Swal.fire("삭제 실패", err?.message || "서버 오류", "error");
      }
    },
    [rows, removeRowFromState, teamCodeKey]
  );

  // ✅ 변경된 행만 추려 일괄 저장
  const saveRows = useCallback(async () => {
    const currentUserId = getStoredUserId();
    if (!currentUserId) {
      Swal.fire("사용자 확인", "로그인 사용자 ID를 찾을 수 없습니다.", "warning");
      return;
    }

    const originalById = new Map(originalRows.map((row) => [String(row.id), row]));

    const modifiedRows = rows
      .filter((row) => {
        const original = originalById.get(String(row.id));
        if (!original) return !isRowEmpty(row);
        return !isSameRow(row, original);
      })
      .filter((row) => !(row.idx == null && isRowEmpty(row)));

    if (modifiedRows.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    const invalidRows = modifiedRows.filter((row) => !row.sub_date || !row.account_id || !row.type);
    if (invalidRows.length > 0) {
      Swal.fire("필수값 확인", "접수일/지점/구분은 필수입니다.", "warning");
      return;
    }

    const payload = modifiedRows.map((row) => ({
      idx: row.idx,
      team_code: teamCodeKey,
      sub_date: toDateInputValue(row.sub_date) || null,
      account_id: row.account_id || null,
      type: row.type ? Number(row.type) : null,
      issue: row.issue || "",
      result: row.result ? Number(row.result) : null,
      end_date: toDateInputValue(row.end_date) || null,
      solution: row.solution || "",
      note: row.note || "",
      user_id: currentUserId,
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
      Swal.fire("저장 실패", err?.message || "서버 오류", "error");
    }
  }, [rows, originalRows, teamCodeKey, fetchCommunicationList]);

  // ✅ 구분 모달 열기
  const openTypeModal = useCallback(() => {
    const mapped = (typeList || []).map((row, index) => ({
      id: `type_${row.idx || index}`,
      idx: row.idx,
      type: String(row.type || ""),
    }));

    setTypeRows(mapped);
    setTypeOriginalRows(mapped.map((row) => ({ ...row })));
    setTypeDeletedIds([]);
    setTypeModalOpen(true);
  }, [typeList]);

  // ✅ 구분 모달 닫기
  const closeTypeModal = useCallback(() => {
    setTypeModalOpen(false);
  }, []);

  // ✅ 구분 모달 신규 행 추가
  const addTypeRow = useCallback(() => {
    setTypeRows((prev) => [...prev, { id: makeLocalId(), idx: null, type: "" }]);
  }, []);

  // ✅ 구분 모달 입력값 업데이트
  const updateTypeRow = useCallback((id, value) => {
    setTypeRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              type: value,
            }
          : row
      )
    );
  }, []);

  // ✅ 구분 모달 행 삭제(저장된 항목은 삭제 ID로 누적)
  const deleteTypeRow = useCallback((row) => {
    if (row?.idx) {
      setTypeDeletedIds((prev) => [...prev, row.idx]);
    }
    setTypeRows((prev) => prev.filter((item) => item.id !== row.id));
  }, []);

  // ✅ 구분 모달 변경사항 저장(추가/수정/삭제 일괄 반영)
  const saveTypeRows = useCallback(async () => {
    const trimmedRows = typeRows.map((row) => ({ ...row, type: String(row.type || "").trim() }));

    if (trimmedRows.some((row) => !row.type)) {
      Swal.fire("구분 확인", "구분명은 비워둘 수 없습니다.", "warning");
      return;
    }

    const modifiedRows = trimmedRows.filter((row) => {
      const original = typeOriginalRows.find((item) => item.id === row.id);
      if (!original) return true;
      return String(original.type || "") !== String(row.type || "") || original.idx !== row.idx;
    });

    const deletedIds = [...new Set(typeDeletedIds.filter(Boolean))];

    try {
      let hasSaved = false;

      if (deletedIds.length > 0) {
        const delRes = await api.post("/Account/AccountCommunicationMappingDelete", {
          ids: deletedIds,
        });

        if (delRes.data?.code !== 200) {
          throw new Error(delRes.data?.message || "삭제 실패");
        }
        hasSaved = true;
      }

      if (modifiedRows.length > 0) {
        const payload = modifiedRows.map((row) => ({
          idx: row.idx,
          team_code: teamCodeKey,
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
      Swal.fire("저장 실패", err?.message || "서버 오류", "error");
    }
  }, [typeRows, typeOriginalRows, typeDeletedIds, teamCodeKey, fetchTypeList]);

  // ✅ 탭 컴포넌트가 사용하는 화면 상태/액션 반환
  return {
    loading,
    rows,
    originalRows,
    accountOptions,
    typeOptions,
    isCustomerIssueTeam,
    resultOptions: RESULT_OPTIONS,

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
  };
}

