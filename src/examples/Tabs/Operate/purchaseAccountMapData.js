// 구입 업장관리 데이터 훅 (API 연동 전용)
// - 관리자 목록 조회 (department=5, position=2,3)
// - 전체 거래처 목록 조회
// - 관리자별 매핑 거래처 조회
// - 매핑 저장
/* eslint-disable react/function-component-definition */
import { useState, useCallback, useEffect } from "react";
import api from "api/api";

// 관리자 목록 조회 API 경로
const MANAGER_LIST_API = "/FieldBoard/PurchaseManagerList";
// 전체 거래처 목록 조회 API 경로
const ACCOUNT_LIST_API = "/FieldBoard/PurchaseAccountList";
// 관리자별 매핑 거래처 조회 API 경로
const MAP_LIST_API = "/FieldBoard/PurchaseManagerAccountMapList";
// 매핑 저장 API 경로
const MAP_SAVE_API = "/FieldBoard/PurchaseManagerAccountMapSave";

// ─── 구입 업장관리 데이터 훅 ─────────────────────────────────────────────────
// - managerRows: 운영팀 부장/차장 목록
// - accountRows: 전체 거래처 목록
// - loading: 초기 데이터 로딩 여부
// - fetchMapList: 관리자별 매핑 거래처 조회
// - saveMap: 매핑 저장
export default function usePurchaseAccountMapData() {
  // 관리자 목록 상태
  const [managerRows, setManagerRows] = useState([]);
  // 전체 거래처 목록 상태
  const [accountRows, setAccountRows] = useState([]);
  // 초기 로딩 여부
  const [loading, setLoading] = useState(false);

  // 관리자 목록 조회 (운영팀 부장/차장)
  const fetchManagers = useCallback(async () => {
    try {
      const res = await api.get(MANAGER_LIST_API);
      const list = Array.isArray(res.data) ? res.data : res.data?.list || [];
      setManagerRows(list);
    } catch {
      setManagerRows([]);
    }
  }, []);

  // 전체 거래처 목록 조회
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get(ACCOUNT_LIST_API);
      const list = Array.isArray(res.data) ? res.data : res.data?.list || [];
      setAccountRows(list);
    } catch {
      setAccountRows([]);
    }
  }, []);

  // 초기 로드 (관리자 + 거래처 병렬 조회)
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchManagers(), fetchAccounts()]).finally(() => setLoading(false));
  }, [fetchManagers, fetchAccounts]);

  // 관리자별 매핑 거래처 목록 조회
  const fetchMapList = useCallback(async (managerUserId) => {
    if (!managerUserId) return [];
    try {
      const res = await api.get(MAP_LIST_API, {
        params: { user_id: managerUserId },
      });
      return Array.isArray(res.data) ? res.data : res.data?.list || [];
    } catch {
      return [];
    }
  }, []);

  // 매핑 저장 (user_id + 거래처 목록)
  const saveMap = useCallback(async (managerUserId, mapList) => {
    const res = await api.post(
      MAP_SAVE_API,
      {
        user_id: managerUserId,
        list: mapList.map((r) => ({ account_id: r.account_id })),
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return res;
  }, []);

  return { managerRows, accountRows, loading, fetchMapList, saveMap };
}
