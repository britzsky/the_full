/* eslint-disable react/function-component-definition */
import { useCallback, useState } from "react";
import dayjs from "dayjs";
import api from "api/api";

// 적립금 대상 거래처 type (tb_account_mapping.type) — 거래처가 늘어나면 여기에 추가
export const RESERVE_TYPES = [1, 1042];
// 적립금 누적 시작 연월
export const START_YEAR = 2026;
export const START_MONTH = 9;

const isReserveType = (r) => RESERVE_TYPES.includes(Number(r.type));

// 적립금 관리 탭의 조회/저장 API와 원본 데이터를 관리하는 훅
export default function useReserveFundData() {
  const [loading, setLoading] = useState(false);
  // 시작 연도부터 올해까지 거래처별 월 사용금액(매입) 원본 행
  const [rawRows, setRawRows] = useState([]);
  // 대상 거래처 전체의 적립금 사용 내역
  const [useRows, setUseRows] = useState([]);

  // 적립금 사용 내역을 조회하는 함수
  const fetchUseList = useCallback(async () => {
    const res = await api.get("/HeadOffice/ReserveFundUseList");
    setUseRows((res.data || []).filter(isReserveType));
  }, []);

  // 시작 연도부터 올해까지 연도별 거래처 월 사용금액과 적립금 사용 내역을 조회하는 함수
  const fetchReserveSource = useCallback(async () => {
    setLoading(true);
    try {
      const years = [];
      for (let y = START_YEAR; y <= dayjs().year(); y += 1) years.push(y);
      const results = await Promise.all(
        years.map((y) =>
          api
            .get("/HeadOffice/AccountMappingPurchaseList", { params: { year: y } })
            .then((res) => (res.data || []).map((r) => ({ ...r, count_year: y })))
        )
      );
      setRawRows(results.flat().filter(isReserveType));
      await fetchUseList();
    } catch (err) {
      console.error("적립금 데이터 조회 실패:", err);
      setRawRows([]);
      setUseRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUseList]);

  // 적립금 사용 내역을 저장(등록/수정/삭제, id 기준 upsert)하고 목록을 다시 조회하는 함수
  const saveReserveFundUse = useCallback(
    async (payload) => {
      const res = await api.post("/HeadOffice/ReserveFundUseSave", payload);
      if (res.data?.code !== 200) throw new Error(res.data?.message || "저장 실패");
      await fetchUseList();
    },
    [fetchUseList]
  );

  // 선택 거래처(type)·연월의 업장별 사용금액(매입)을 조회하는 함수
  const fetchMonthAccountDetail = useCallback(async (year, month, type) => {
    const res = await api.get("/HeadOffice/AccountMappingPurchaseDetailList", {
      params: { year, month: String(month).padStart(2, "0"), type },
    });
    return (res.data || []).map((r) => ({
      account_id: r.account_id,
      account_name: r.account_name || r.account_id || "-",
      total: Number(r.total) || 0,
    }));
  }, []);

  return {
    loading,
    rawRows,
    useRows,
    fetchReserveSource,
    saveReserveFundUse,
    fetchMonthAccountDetail,
  };
}
