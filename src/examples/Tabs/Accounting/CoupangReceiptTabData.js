// =====================================================================
// 쿠팡 영수증 등록 탭 - 데이터 훅 모음
// - API 조회 로직만 분리하여 관리
// =====================================================================
import { useCallback, useState } from "react";
import api from "api/api";

// =====================================================================
// 본사 법인카드 목록 조회 훅
// - /Account/HeadOfficeCorporateCardList API를 통해 등록된 법인카드 목록 조회
// - 응답이 JSON 문자열로 올 수 있으므로 파싱 처리
// =====================================================================
export function useHeadOfficeCardList() {
  const [cardList, setCardList] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const fetchCardList = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await api.get("/Account/HeadOfficeCorporateCardList", {
        validateStatus: () => true,
      });
      if (res.status !== 200) throw new Error("본사 법인카드 목록 조회 실패");
      const raw = res.data;
      // 응답이 JSON 문자열로 오는 경우 파싱
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const list = Array.isArray(parsed) ? parsed : parsed?.data || [];
      const result = Array.isArray(list) ? list : [];
      setCardList(result);
      return result;
    } catch (err) {
      console.error("본사 법인카드 목록 조회 실패:", err);
      setCardList([]);
      return [];
    } finally {
      setLoadingCards(false);
    }
  }, []);

  return { cardList, loadingCards, fetchCardList };
}

// =====================================================================
// 거래처 목록 조회 훅
// - /Account/AccountListV2 API를 통해 거래처 전체 목록을 조회
// =====================================================================
export function useCoupangAccountList() {
  const [accountList, setAccountList] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const fetchAccountList = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await api.get("/Account/AccountListV2", {
        params: { account_type: "0" }, // 전체 타입 조회
        validateStatus: () => true,
      });
      // 응답 형태에 따라 배열 추출
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAccountList(list);
      return list;
    } catch (err) {
      console.error("거래처 목록 조회 실패:", err);
      return [];
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  return { accountList, loadingAccounts, fetchAccountList };
}
