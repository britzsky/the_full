/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useHygienesheetData(year, month) {
  const [hygieneListRows, setHygieneListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 차량 정비 이력 조회
  const fetcHygieneList = useCallback(async (account_id, monthParam = month, yearParam = year) => {
    setLoading(true);
    try {
      const normalizedMonth =
        String(monthParam ?? "").trim() === "ALL"
          ? ""
          : String(monthParam ?? "")
              .trim()
              .padStart(2, "0");

      const res = await api.get("/Operate/HygieneList", {
        params: {
          account_id,
          year: yearParam,
          month: normalizedMonth,
        },
      });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        idx: item.idx,
        problem_image: item.problem_image,
        problem_note: item.problem_note || "",
        clean_image: item.clean_image,
        clean_note: item.clean_note || "",
        note: item.note || "",
        reg_dt: item.reg_dt,
        mod_dt: item.mod_dt,
        del_yn: item.del_yn,
      }));

      setHygieneListRows(rows.map((row) => ({ ...row })));
    } catch (err) {
      console.error("차량 정보 조회 실패:", err);
      setHygieneListRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

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
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return { hygieneListRows, setHygieneListRows, accountList, loading, fetcHygieneList };
}

export { parseNumber, formatNumber };
