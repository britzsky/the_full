/* eslint-disable react/function-component-definition */
import { useCallback, useRef, useState } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useAccountCorporateCardData() {
  // ========================= 공통 로딩(카운터 방식) =========================
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef(0);

  const withLoading = useCallback(async (fn) => {
    pendingRef.current += 1;
    setLoading(true);
    try {
      return await fn();
    } finally {
      pendingRef.current -= 1;
      if (pendingRef.current <= 0) {
        pendingRef.current = 0;
        setLoading(false);
      }
    }
  }, []);

  // ========================= 법인카드관리(모달) =========================
  const [activeRows, setActiveRows] = useState([]); // 카드 목록

  // ========================= 결제내역(상단) =========================
  const [paymentRows, setPaymentRows] = useState([]);

  // ========================= 결제상세(하단) =========================
  const [paymentDetailRows, setPaymentDetailRows] = useState([]);

  // (옵션) 기존 유지
  const [corporateRows, setCorporateRows] = useState([]);

  // 거래처 셀렉트용
  const [accountList, setAccountList] = useState([]);

  // ========================= (0) 거래처 목록 조회 =========================
  const fetchAccountList = useCallback(async () => {
    return withLoading(async () => {
      try {
        const res = await api.get("/Account/AccountList", {
          params: { account_type: 0 },
        });
        setAccountList(res.data || []);
      } catch (err) {
        console.error("AccountList 조회 실패:", err);
        setAccountList([]);
      }
    });
  }, [withLoading]);

  // ========================= (1) 법인카드관리 목록 조회 =========================
  const fetchHeadOfficeCorporateCardList = useCallback(
    async (account_id) => {
      return withLoading(async () => {
        try {
          const res = await api.get("/Account/HeadOfficeCorporateCardList", {
            params: { account_id },
          });

          const rows = (res.data || []).map((item) => ({
            idx: item.idx,
            account_id: item.account_id, // string/number 가능
            card_brand: item.card_brand,
            card_no: item.card_no,
            del_yn: item.del_yn ?? "N",
          }));

          setActiveRows(rows);
        } catch (err) {
          console.error("법인카드 목록 조회 실패:", err);
          setActiveRows([]);
        }
      });
    },
    [withLoading]
  );

  // ========================= (2) 결제내역(상단) 조회 =========================
  // ✅ account_id 추가
  const fetchHeadOfficeCorporateCardPaymentList = useCallback(
    async ({ year, month, account_id }) => {
      return withLoading(async () => {
        try {
          const res = await api.get("/Account/HeadOfficeCorporateCardPaymentList", {
            params: { year, month, account_id },
          });

          console.log(res.data);
          setPaymentRows(res.data || []);
        } catch (err) {
          console.error("결제내역 조회 실패:", err);
          setPaymentRows([]);
        }
      });
    },
    [withLoading]
  );

  // ========================= (3) 결제상세(하단) 조회 =========================
  const fetchHeadOfficeCorporateCardPaymentDetailList = useCallback(
    async ({ sale_id, account_id, payment_dt }) => {
      return withLoading(async () => {
        try {
          const res = await api.get("/Account/HeadOfficeCorporateCardPaymentDetailList", {
            params: { sale_id, account_id, payment_dt },
          });

          setPaymentDetailRows(res.data || []);
        } catch (err) {
          console.error("결제상세 조회 실패:", err);
          setPaymentDetailRows([]);
        }
      });
    },
    [withLoading]
  );

  // ========================= (4) (옵션) 기존 corporateRows 조회 =========================
  const fetchCorporateCardPayList = useCallback(
    async (account_id) => {
      return withLoading(async () => {
        try {
          const res = await api.get("/Account/HeadOfficeCorporateCardList", {
            params: { account_id },
          });

          const rows = (res.data || []).map((item) => ({
            idx: item.idx,
            account_id: item.account_id,
            card_brand: item.card_brand,
            card_no: item.card_no,
            del_yn: item.del_yn ?? "N",
          }));

          setCorporateRows(rows);
        } catch (err) {
          console.error("데이터 조회 실패:", err);
          setCorporateRows([]);
        }
      });
    },
    [withLoading]
  );

  return {
    // state
    loading,

    activeRows,
    setActiveRows,

    paymentRows,
    setPaymentRows,

    paymentDetailRows,
    setPaymentDetailRows,

    corporateRows,
    setCorporateRows,

    accountList,
    setAccountList,

    // fetchers
    fetchAccountList,
    fetchHeadOfficeCorporateCardList,
    fetchHeadOfficeCorporateCardPaymentList,
    fetchHeadOfficeCorporateCardPaymentDetailList,
    fetchCorporateCardPayList,
  };
}

export { parseNumber, formatNumber };
