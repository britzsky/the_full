/* eslint-disable react/function-component-definition */
import { useCallback, useMemo, useState } from "react";
import api from "api/api";

export const formatNumber = (value) => {
  if (value == null || value === "") return "";
  const n = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return "";
  return n.toLocaleString();
};

const pad2 = (m) => String(m).padStart(2, "0");

const toNumber = (v) => {
  const n = Number(String(v ?? 0).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

// ✅ 월별 응답 rows([{type,name,total}]) → Map(name -> {type,name,total})
const groupMonthByVendor = (rows = []) => {
  const map = new Map();
  rows.forEach((r) => {
    const name = String(r.name ?? "").trim();
    if (!name) return;
    const total = toNumber(r.total);
    if (!map.has(name)) map.set(name, { type: r.type ?? "", name, total: 0 });
    map.get(name).total += total;
  });
  return map;
};

// ✅ 히트맵 색 (데이터 없어도 기본 색상, 값이 클수록 진하게)
const heatColor = (value, max) => {
  // 기본 배경(0이어도 연하게 깔리게)
  const baseAlpha = 0.06;      // ✅ "데이터 없음" 기본 색
  const maxAlpha = 0.85;       // ✅ 최대 진하기

  if (!max || max <= 0) {
    // 전체가 0인 경우에도 기본 색 유지
    return `rgba(255, 95, 0, ${baseAlpha})`;
  }

  const v = Math.max(0, Number(value) || 0);
  const ratio = v / max; // 0~1
  const alpha = Math.min(maxAlpha, baseAlpha + ratio * (maxAlpha - baseAlpha));

  return `rgba(255, 95, 0, ${alpha})`;
};

export default function useAccountMappingPurchaseYearData(year) {
  const [loading, setLoading] = useState(false);
  const [matrixRows, setMatrixRows] = useState([]); // [{name,type,m1..m12,sum}]
  const [yearTotal, setYearTotal] = useState(0);
  const [maxCell, setMaxCell] = useState(0);

  const ENDPOINT = "/HeadOffice/AccountMappingPurchaseList";
  const DETAIL_ENDPOINT = "/HeadOffice/AccountMappingPurchaseDetailList";

  const fetchYear = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ 12개월 병렬 호출
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      const results = await Promise.all(
        months.map(async (m) => {
          const res = await api.get(ENDPOINT, {
            params: { year, month: pad2(m) }, // ✅ month는 2자리로
          });
          return { month: m, rows: res.data || [] };
        })
      );

      // ✅ 거래처별로 12개월 누적 매트릭스 생성
      const vendors = new Map(); // name -> row

      results.forEach(({ month, rows }) => {
        const monthMap = groupMonthByVendor(rows);
        monthMap.forEach((v, name) => {
          if (!vendors.has(name)) {
            vendors.set(name, {
              type: v.type ?? "",
              name,
              m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0,
              m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0,
              sum: 0,
            });
          }
          vendors.get(name)[`m${month}`] += v.total;
        });
      });

      // ✅ sum / maxCell 계산
      let totalSum = 0;
      let max = 0;

      const rowsArr = Array.from(vendors.values()).map((r) => {
        const sum =
          r.m1 + r.m2 + r.m3 + r.m4 + r.m5 + r.m6 +
          r.m7 + r.m8 + r.m9 + r.m10 + r.m11 + r.m12;

        totalSum += sum;

        for (let m = 1; m <= 12; m++) max = Math.max(max, r[`m${m}`]);
        return { ...r, sum };
      });

      // ✅ 연간합계 기준 내림차순 정렬(기본)
      rowsArr.sort((a, b) => b.sum - a.sum);

      setMatrixRows(rowsArr);
      setYearTotal(totalSum);
      setMaxCell(max);
    } catch (e) {
      console.error("연도 매출 히트맵 조회 실패:", e);
      setMatrixRows([]);
      setYearTotal(0);
      setMaxCell(0);
    } finally {
      setLoading(false);
    }
  }, [year]);

  // ✅ 특정 거래처 라인차트용 데이터
  const buildLineData = useCallback((vendorRow) => {
    if (!vendorRow) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return { month: `${m}월`, total: vendorRow[`m${m}`] ?? 0 };
    });
  }, []);

  // 월 셀 클릭 시 거래처+월 기준 업장별 금액 조회
  const fetchMonthAccountBreakdown = useCallback(
    async (vendorRow, month) => {
      const monthNumber = Number(month);
      if (!vendorRow || monthNumber < 1 || monthNumber > 12) return [];

      const targetName = String(vendorRow?.name ?? "").trim();
      if (!targetName) return [];

      try {
        const res = await api.get(DETAIL_ENDPOINT, {
          params: {
            year,
            month: pad2(monthNumber),
            name: targetName,
          },
        });

        const rows = Array.isArray(res?.data) ? res.data : [];
        const grouped = new Map();

        rows.forEach((r) => {
          const accountId = String(r?.account_id ?? "").trim();
          const accountName = String(r?.account_name ?? "").trim();
          if (!accountId && !accountName) return;

          const key = accountId || accountName;
          const total = toNumber(r?.total);

          if (!grouped.has(key)) {
            grouped.set(key, {
              account_id: accountId,
              account_name: accountName || accountId,
              total: 0,
            });
          }
          grouped.get(key).total += total;
        });

        return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
      } catch (e) {
        console.error("업장별 상세 조회 실패:", e);
        return [];
      }
    },
    [year]
  );

  return {
    loading,
    fetchYear,
    matrixRows,
    yearTotal,
    maxCell,
    heatColor,
    buildLineData,
    fetchMonthAccountBreakdown,
  };
}
