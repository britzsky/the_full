/* eslint-disable react/function-component-definition */
import { useEffect, useMemo, useState } from "react";
import api from "api/api";

// =========================
// 데이터 정규화/판정 유틸
// =========================

// 결과값(문자/코드)을 통계 계산용 코드값으로 정규화
const normalizeResult = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s === "해결") return "2";
  if (s === "보류") return "1";
  return s;
};

// 서버 row를 통계 계산용 최소 필드 구조로 정규화
const normalizeRow = (row) => ({
  idx: row.idx ?? null,
  account_id: row.account_id ? String(row.account_id) : "",
  account_name: row.account_name || "",
  type: row.type != null ? String(row.type) : "",
  result: normalizeResult(row.result),
});

// 해결 여부 판정(코드 2 = 해결)
const isResolved = (resultCode) => String(resultCode || "").trim() === "2";

export default function useDeadlineIssueStatsTab2Data(teamCode = 2) {
  // =========================
  // 기본 상태/키
  // =========================
  // 팀 코드 문자열 키(조회 파라미터 공통 사용)
  const teamCodeKey = String(teamCode ?? "");

  // 원본 데이터 상태(행/고객사/구분)
  const [rows, setRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [typeList, setTypeList] = useState([]);
  // 화면 필터 상태(선택 고객사 + 로딩)
  const [selectedAccountKey, setSelectedAccountKey] = useState("");
  const [loading, setLoading] = useState(true);

  // =========================
  // 매핑 테이블(고객사/구분)
  // =========================
  // account_id -> 고객사명 매핑(빠른 조회용)
  const accountNameById = useMemo(() => {
    const map = new Map();
    (accountList || []).forEach((acc) => {
      map.set(String(acc.account_id), acc.account_name || "");
    });
    return map;
  }, [accountList]);

  // type idx -> 구분명 매핑
  const typeLabelById = useMemo(() => {
    const map = new Map();
    (typeList || []).forEach((type) => {
      map.set(String(type.idx), type.type || "");
    });
    return map;
  }, [typeList]);

  // 고객사 묶음 기준 통일(id 우선, 없으면 이름 기준)
  const normalizeAccountMeta = (row) => {
    const accountId = String(row.account_id || "").trim();
    const rowName = String(row.account_name || "").trim();
    const mappedName = accountNameById.get(accountId) || "";

    if (accountId) {
      return {
        key: `id:${accountId}`,
        accountId,
        accountName: mappedName || rowName || accountId,
      };
    }

    if (rowName) {
      return {
        key: `name:${rowName}`,
        accountId: "",
        accountName: rowName,
      };
    }

    return {
      key: "unassigned",
      accountId: "",
      accountName: "미지정",
    };
  };

  // =========================
  // 전체 통계 계산
  // =========================
  // 전체 고객사별 건수 통계
  const accountStats = useMemo(() => {
    const map = new Map();

    (rows || []).forEach((row) => {
      const meta = normalizeAccountMeta(row);
      if (!map.has(meta.key)) {
        map.set(meta.key, { ...meta, count: 0 });
      }
      map.get(meta.key).count += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.accountName).localeCompare(String(b.accountName), "ko");
    });
  }, [rows, accountNameById]);

  // 전체 구분별 건수 통계
  const overallTypeStats = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row) => {
      const typeCode = String(row.type || "").trim();
      const label = typeLabelById.get(typeCode) || typeCode || "미구분";
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, typeLabelById]);

  // 전체 해결/미해결 통계
  const overallResultStats = useMemo(() => {
    if (!rows.length) return [];
    const resolved = rows.filter((row) => isResolved(row.result)).length;
    const unresolved = rows.length - resolved;
    return [
      { label: "해결", count: resolved },
      { label: "미해결", count: unresolved },
    ];
  }, [rows]);

  // =========================
  // 선택 고객사 기준 통계 계산
  // =========================
  // 선택 고객사에 해당하는 행 목록
  const selectedRows = useMemo(() => {
    if (!selectedAccountKey) return [];
    return rows.filter((row) => normalizeAccountMeta(row).key === selectedAccountKey);
  }, [rows, selectedAccountKey, accountNameById]);

  // 선택 고객사명
  const selectedAccountName = useMemo(() => {
    const found = accountStats.find((row) => row.key === selectedAccountKey);
    return found?.accountName || "";
  }, [accountStats, selectedAccountKey]);

  // 선택 고객사의 구분별 건수 통계
  const selectedTypeStats = useMemo(() => {
    const map = new Map();
    (selectedRows || []).forEach((row) => {
      const typeCode = String(row.type || "").trim();
      const label = typeLabelById.get(typeCode) || typeCode || "미구분";
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedRows, typeLabelById]);

  // 선택 고객사의 해결/미해결 통계
  const selectedResultStats = useMemo(() => {
    if (!selectedRows.length) return [];
    const resolved = selectedRows.filter((row) => isResolved(row.result)).length;
    const unresolved = selectedRows.length - resolved;
    return [
      { label: "해결", count: resolved },
      { label: "미해결", count: unresolved },
    ];
  }, [selectedRows]);

  // 선택 고객사 총계(1개 항목 카드용)
  const selectedAccountStats = useMemo(() => {
    if (!selectedAccountName || !selectedRows.length) return [];
    return [{ label: selectedAccountName, count: selectedRows.length }];
  }, [selectedAccountName, selectedRows]);

  // Autocomplete value로 사용하는 선택 객체
  const selectedAccountOption = useMemo(
    () => accountStats.find((item) => item.key === selectedAccountKey) || null,
    [accountStats, selectedAccountKey]
  );

  // =========================
  // 서버 데이터 동기화
  // =========================
  // 초기 로딩 시 서버 데이터만 조회하여 상태 반영
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [accountRes, typeRes, rowRes] = await Promise.all([
          api.get("/Account/AccountList", { params: { account_type: "0" } }),
          api.get("/Account/AccountCommunicationMappingList", { params: { team_code: teamCodeKey } }),
          // 소프트삭제 적용: 삭제되지 않은 행(del_yn='N')만 통계에 반영
          api.get("/Account/AccountCommunicationList", {
            params: { team_code: teamCodeKey, del_yn: "N" },
          }),
        ]);

        if (!mounted) return;

        const nextAccounts = (accountRes.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));

        const nextTypes = (typeRes.data || []).map((item) => ({
          idx: item.idx,
          team_code: item.team_code,
          type: item.type,
        }));

        const nextRows = (rowRes.data || []).map(normalizeRow);

        setAccountList(nextAccounts);
        setTypeList(nextTypes);
        setRows(nextRows);
      } catch (err) {
        console.error("AccountIssueStats 조회 실패:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, [teamCodeKey]);

  // 선택 고객사가 목록에서 사라진 경우 필터 초기화
  useEffect(() => {
    if (!selectedAccountKey) return;

    if (!accountStats.length) {
      setSelectedAccountKey("");
      return;
    }

    if (accountStats.some((row) => row.key === selectedAccountKey)) return;
    setSelectedAccountKey("");
  }, [accountStats, selectedAccountKey]);

  // =========================
  // 화면 반환 데이터
  // =========================
  // 통계 탭에서 사용하는 계산 결과/필터 상태 반환
  return {
    loading,
    selectedAccountKey,
    setSelectedAccountKey,
    selectedAccountName,
    selectedAccountOption,
    accountStats,
    overallTypeStats,
    overallResultStats,
    selectedAccountStats,
    selectedTypeStats,
    selectedResultStats,
  };
}

