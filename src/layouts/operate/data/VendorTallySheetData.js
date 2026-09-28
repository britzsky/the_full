import { useState, useCallback, useEffect } from "react";
import api from "api/api";

// ✅ 콤마 포함 문자열/숫자 → 순수 숫자
export const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// ✅ 숫자 → 콤마 포맷 문자열
export const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

// ✅ 거래처 집계표 데이터 훅 - 거래처 목록 + 벤더별 일자 매입금액 + 거래처별 평균식수 조회
export default function useVendorTallySheetData(year, month) {
  const [loading, setLoading] = useState(false);
  const [accountList, setAccountList] = useState([]);
  const [vendorData, setVendorData] = useState({ wellstory: [], awhome: [], scenic: [], lunchAvg: [] });

  // ✅ 거래처 목록은 연/월과 무관하므로 최초 1회만 조회 (월 변경마다 재조회하지 않음)
  useEffect(() => {
    api
      .get("/Account/AccountListV2", { params: { del_yn: "N" } })
      .then((res) => setAccountList(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("거래처 목록 조회 실패:", err));
  }, []);

  // ✅ 벤더별 일자 매입금액 + 평균식수는 연/월이 바뀔 때만 조회
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const vendorRes = await api.get("/Operate/AccountVendorTallyList", { params: { year, month } });
      setVendorData({
        wellstory: vendorRes.data?.wellstory || [],
        awhome: vendorRes.data?.awhome || [],
        scenic: vendorRes.data?.scenic || [],
        lunchAvg: vendorRes.data?.lunchAvg || [],
      });
    } catch (err) {
      console.error("거래처 집계표 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return { loading, accountList, vendorData, fetchData };
}
