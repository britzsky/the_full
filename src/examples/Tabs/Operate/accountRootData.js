/* eslint-disable react/function-component-definition */
import { useState, useMemo } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value && value !== 0) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useAccountRootData() {
  const [rootRows, setRootRows] = useState([]);
  const [sidoRows, setSidoRows] = useState([]);
  const [sigunguRows, setSigunguRows] = useState([]);
  const [eupmyeondongRows, setEupmyeondongRows] = useState([]);

  const [loadingCount, setLoadingCount] = useState(0);
  const loading = useMemo(() => loadingCount > 0, [loadingCount]);

  const startLoading = () => setLoadingCount((c) => c + 1);
  const endLoading = () => setLoadingCount((c) => Math.max(0, c - 1));

  // ✅ Root 조회
  const fetchRootList = async () => {
    startLoading();
    try {
      const res = await api.get("/Operate/RootList");
      const rows = (res.data || []).map((item) => ({
        root_idx: item.root_idx,
        sido_code: item.sido_code,
        sido_name: item.sido_name,
        sigungu_code: item.sigungu_code,
        sigungu_name: item.sigungu_name,
        emd_code: item.emd_code,
        emd_name: item.emd_name,
        del_yn: item.del_yn,
      }));
      setRootRows(rows);
    } catch (err) {
      console.error("RootList 조회 실패:", err);
      setRootRows([]);
    } finally {
      endLoading();
    }
  };

  // ✅ Sido: 파라미터 없이 조회
  const fetchSidoList = async () => {
    startLoading();
    try {
      const res = await api.get("/Operate/SidoList");
      const rows = (res.data || []).map((item) => ({
        sido_code: item.sido_code,
        sido_name: item.sido_name,
      }));
      setSidoRows(rows);
    } catch (err) {
      console.error("SidoList 조회 실패:", err);
      setSidoRows([]);
    } finally {
      endLoading();
    }
  };

  // ✅ Sigungu: sido_code 필요
  const fetchSigunguList = async (sido_code) => {
    if (!sido_code) {
      console.warn("fetchSigunguList: sido_code is required");
      setSigunguRows([]);
      return;
    }

    startLoading();
    try {
      // ⚠️ query param 키가 서버와 다르면 여기만 변경
      const res = await api.get("/Operate/SigunguList", { params: { sido_code } });
      const rows = (res.data || []).map((item) => ({
        sigungu_code: item.sigungu_code,
        sigungu_name: item.sigungu_name,
      }));
      setSigunguRows(rows);
    } catch (err) {
      console.error("SigunguList 조회 실패:", err);
      setSigunguRows([]);
    } finally {
      endLoading();
    }
  };

  // ✅ Eupmyeondong: sigungu_code 필요
  const fetchEupmyeondongList = async (sigungu_code) => {
    if (!sigungu_code) {
      console.warn("fetchEupmyeondongList: sigungu_code is required");
      setEupmyeondongRows([]);
      return;
    }

    startLoading();
    try {
      // ⚠️ query param 키가 서버와 다르면 여기만 변경
      const res = await api.get("/Operate/EupmyeondongList", { params: { sigungu_code } });
      const rows = (res.data || []).map((item) => ({
        emd_code: item.emd_code,
        emd_name: item.emd_name,
      }));
      setEupmyeondongRows(rows);
    } catch (err) {
      console.error("EupmyeondongList 조회 실패:", err);
      setEupmyeondongRows([]);
    } finally {
      endLoading();
    }
  };

  return {
    rootRows,
    sidoRows,
    sigunguRows,
    eupmyeondongRows,
    loading,
    fetchRootList,
    fetchSidoList,
    fetchSigunguList,
    fetchEupmyeondongList,
    setRootRows,
    setSidoRows,
    setSigunguRows,
    setEupmyeondongRows,
  };
}

export { parseNumber, formatNumber };
