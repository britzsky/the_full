/* eslint-disable react/function-component-definition */
import { useState } from "react";
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

export default function useCarManagerData() {
  const [carListRows, setCarListRows] = useState([]);
  const [carSelectList, setCarSelectList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 차량 정비 이력 조회
  const fetchCarList = async (car_number) => {
    setLoading(true);
    try {
      const res = await api.get("/Business/CarList", {
        params: { car_number: car_number },
      });

      const rows = (res.data || []).map((item) => ({
        car_number: item.car_number,
        car_name: item.car_name || "",
        full_name: item.full_name || "",
        service_dt: item.service_dt || "",
        service_note: item.service_note || "",
        service_amt: formatNumber(item.service_amt),
        mileage: formatNumber(item.mileage),
        comment: item.comment || "",
        exterior_image: item.exterior_image,
        exterior_note: item.exterior_note,
      }));

      setCarListRows(rows.map((row) => ({ ...row })));
    } catch (err) {
      console.error("차량 정보 조회 실패:", err);
      setCarListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 차량 선택 리스트 조회
  const fetchCarSelectList = async () => {
    try {
      const res = await api.get("/Business/CarSelectList");
      setCarSelectList(res.data || []);
    } catch (err) {
      console.error("차량 선택 리스트 조회 실패:", err);
      setCarSelectList([]);
    }
  };

  return { carListRows, setCarListRows, carSelectList, loading, fetchCarList, fetchCarSelectList };
}

export { parseNumber, formatNumber };
