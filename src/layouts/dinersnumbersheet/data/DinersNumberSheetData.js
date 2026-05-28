import { useState, useEffect, useCallback } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

// ✅ accountId 를 외부에서 받아서 사용하도록 변경
export default function useDinersNumbersheetData(accountId, year, month) {
  const [activeRows, setActiveRows] = useState([]);
  const [extraDietCols, setExtraDietCols] = useState([]);     // 🔹 추가 식단가 컬럼 정보
  const [accountList, setAccountList] = useState([]);         // 🔹 거래처 목록
  const [loading, setLoading] = useState(false);

  // ✅ 식수 데이터 조회
  const fetchAllData = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return; // 선택된 거래처가 없으면 중단
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      const params = { account_id: accountId, year, month };
      const res = await api.get("/Operate/AccountDinnersNumberList", { params });

      const rows = (res.data || []).map((item) => {
        const { diner_year, diner_month, diner_date } = item;
        const formattedDate = `${diner_year}-${String(diner_month).padStart(
          2,
          "0"
        )}-${String(diner_date).padStart(2, "0")}`;

        return {
          diner_date: formattedDate,
          breakfast: parseNumber(item.breakfast),
          lunch: parseNumber(item.lunch),
          dinner: parseNumber(item.dinner),
          ceremony: parseNumber(item.ceremony),
          ceremony2: parseNumber(item.ceremony2),
          daycare_lunch: parseNumber(item.daycare_lunch),
          daycare_diner: parseNumber(item.daycare_diner),
          employ: parseNumber(item.employ),
          total: parseNumber(item.total),
          note: item.note,
          breakcancel: item.breakcancel,
          lunchcancel: item.lunchcancel,
          dinnercancel: item.dinnercancel,
          // 🔹 추가 식단가 단가들
          extra_diet1_price: parseNumber(item.extra_diet1_price),
          extra_diet2_price: parseNumber(item.extra_diet2_price),
          extra_diet3_price: parseNumber(item.extra_diet3_price),
          extra_diet4_price: parseNumber(item.extra_diet4_price),
          extra_diet5_price: parseNumber(item.extra_diet5_price),
          special_yn: item.special_yn || "N",

          daycare_breakfast: parseNumber(item.daycare_breakfast),
          employ_breakfast: parseNumber(item.employ_breakfast),
          employ_lunch: parseNumber(item.employ_lunch),
          employ_dinner: parseNumber(item.employ_dinner),
          breakfast2: parseNumber(item.breakfast2),
          lunch2: parseNumber(item.lunch2),
          dinner2: parseNumber(item.dinner2),
          daycare_elderly_lunch: parseNumber(item.daycare_elderly_lunch),
          daycare_elderly_dinner: parseNumber(item.daycare_elderly_dinner),
          daycare_employ_breakfast: parseNumber(item.daycare_employ_breakfast),
          daycare_employ_lunch: parseNumber(item.daycare_employ_lunch),
          daycare_employ_dinner: parseNumber(item.daycare_employ_dinner),
          working_day: parseNumber(item.working_day),
        };
      });

      setActiveRows(rows);
    } catch (err) {
      console.error("데이터 조회 실패:", err);
    } finally {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(1000 - elapsed, 0); // 최소 1초 로딩 유지
      setTimeout(() => setLoading(false), delay);
    }
  }, [accountId, year, month]);

  // ✅ accountId, year, month 변경될 때마다 조회
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ✅ 🔹 추가 식단가 이름/가격(컬럼 정보) 조회
  useEffect(() => {
    if (!accountId) {
      setExtraDietCols([]);
      return;
    }

    const fetchExtraDiet = async () => {
      try {
        const res = await api.get("/Business/AccountEctDietList", {
          params: { account_id: accountId },
        });

        const row = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};

        const cols = Array.from({ length: 5 }, (_, i) => {
          const idx = i + 1;
          const name = row[`extra_diet${idx}_name`];

          if (!name || name.trim() === "") return null;

          return {
            idx,
            name,
            priceKey: `extra_diet${idx}_price`,
          };
        }).filter(Boolean);

        setExtraDietCols(cols);
      } catch (e) {
        console.error("추가 식단가 조회 실패:", e);
      }
    };

    fetchExtraDiet();
  }, [accountId]);

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          account_type: item.account_type,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  // 🔹 extraDietCols + accountList 까지 같이 리턴
  return {
    activeRows,
    setActiveRows,
    loading,
    fetchAllData,
    extraDietCols,
    accountList,
  };
}

export { parseNumber, formatNumber };
