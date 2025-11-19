/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useRetailBusinessData() {
  // ✅ 훅은 항상 호출되도록
  const [activeRows, setActiveRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 차량 정비 이력 조회
  const fetcRetailBusinessList  = async (account_id) => {
    setLoading(true);
      try {
        const res = await api.get("/Operate/AccountRetailBusinessList", {
          params: { account_id },
        });
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          type: item.type,
          name: item.name,
          biz_no: item.biz_no,
          ceo_name: item.ceo_name,
          tel: item.tel,
          bank_name: item.bank_name,
          bank_no: item.bank_no,
          bank_image: item.bank_image,
          biz_image: item.biz_image,
          del_yn: item.del_yn,
          account_name: item.account_name
        }));
        setActiveRows(rows.map((row) => ({ ...row })));
      } catch (err) {
        console.error("데이터 조회 실패:", err);
        setActiveRows([]);
      } finally {
        setLoading(false);
      }
  };

  return { activeRows, setActiveRows, accountList, loading, fetcRetailBusinessList };
}

export { parseNumber, formatNumber };
