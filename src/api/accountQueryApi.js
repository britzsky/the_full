import api from "api/api";
import { sortAccountRows } from "utils/accountSort";

// ✅ 거래처 목록을 이름 기준으로 조회하는 공통 API 헬퍼
export const fetchAccountListByName = async ({
  accountType = "0",
  useV2 = false,
  params = {},
} = {}) => {
  const endpoint = useV2 ? "/Account/AccountListV2" : "/Account/AccountList";
  const response = await api.get(endpoint, {
    params: {
      account_type: accountType,
      ...params,
    },
  });

  // ✅ 응답 정렬 기준을 강제해서 화면별 정렬 편차를 제거
  return sortAccountRows(response?.data || [], { sortKey: "account_name", keepAllOnTop: true });
};
