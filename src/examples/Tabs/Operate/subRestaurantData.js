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

export default function useSubRestaurantData() {
  // ✅ 훅은 항상 호출되도록
  const [activeRows, setActiveRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // 차량 정비 이력 조회
  const fetcSubRestaurantList  = async (region) => {
    setLoading(true);
      try {
        const res = await api.get("/Operate/AccountSubRestaurantList", {
          params: { region },
        });
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          account_address: item.account_address,
          move_lunch: item.move_lunch,
          move_lunch_tel: item.move_lunch_tel,
          sub_restaurant1: item.sub_restaurant1,
          sub_restaurant1_tel: item.sub_restaurant1_tel,
          sub_restaurant2: item.sub_restaurant2,
          sub_restaurant2_tel: item.sub_restaurant2_tel,
          sub_restaurant3: item.sub_restaurant3,
          sub_restaurant3_tel: item.sub_restaurant3_tel,
          sub_restaurant4: item.sub_restaurant4,
          sub_restaurant4_tel: item.sub_restaurant4_tel
        }));
        setActiveRows(rows.map((row) => ({ ...row })));
      } catch (err) {
        console.error("데이터 조회 실패:", err);
        setActiveRows([]);
      } finally {
        setLoading(false);
      }
  };

  return { activeRows, setActiveRows, loading, fetcSubRestaurantList };
}

export { parseNumber, formatNumber };
