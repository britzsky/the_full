/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";
import { fetchFieldBoardAccountList } from "utils/fieldBoardAccountFilter";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function usePropertiessheetData() {
  // ✅ 훅은 항상 호출되도록
  const [activeRows, setActiveRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 차량 정비 이력 조회
  const fetcPropertyList  = async (account_id) => {
    setLoading(true);
      try {
        const res = await api.get("/Operate/PropertiesList", {
          params: { account_id },
        });
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          idx: item.idx,
          purchase_dt: item.purchase_dt,
          purchase_name: item.purchase_name,
          item: item.item,
          spec: item.spec,
          qty: item.qty,
          type: item.type,
          purchase_price: parseNumber(item.purchase_price),
          item_img: item.item_img,
          receipt_img: item.receipt_img,
          note: item.note,
          depreciation: item.depreciation
        }));
        setActiveRows(rows.map((row) => ({ ...row })));
      } catch (err) {
        console.error("데이터 조회 실패:", err);
        setActiveRows([]);
      } finally {
        setLoading(false);
      }
  };

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    fetchFieldBoardAccountList({ endpoint: "/Account/AccountList", accountType: "0" })
      .then((list) => {
        const rows = (list || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => {
        console.error("데이터 조회 실패 (AccountList):", err);
        setAccountList([]);
      });
  }, []);

  return { activeRows, setActiveRows, accountList, loading, fetcPropertyList };
}

export { parseNumber, formatNumber };
