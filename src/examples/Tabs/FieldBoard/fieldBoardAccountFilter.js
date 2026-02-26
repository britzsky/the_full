import api from "api/api";

const toSafeString = (value) => String(value ?? "").trim();
const sortByAccountName = (rows = []) =>
  [...rows].sort((a, b) =>
    toSafeString(a?.account_name).localeCompare(toSafeString(b?.account_name), "ko", {
      sensitivity: "base",
      numeric: true,
    })
  );

// FieldBoard 공통: 로그인 사용자 기준으로 접근 가능한 거래처만 반환
export const fetchFieldBoardAccountList = async ({
  endpoint = "/Account/AccountList",
  accountType = "0",
} = {}) => {
  const localAccountId = toSafeString(localStorage.getItem("account_id"));
  const localUserId = toSafeString(localStorage.getItem("user_id"));
  const localUserType = toSafeString(localStorage.getItem("user_type"));

  const accountRes = await api.get(endpoint, {
    params: { account_type: accountType },
  });
  const baseRows = sortByAccountName(Array.isArray(accountRes?.data) ? accountRes.data : []);

  // 영양사/고정계정은 기존처럼 account_id 단건 고정
  if (localAccountId) {
    return baseRows.filter((row) => toSafeString(row?.account_id) === localAccountId);
  }

  // 통합/유틸(4)만 매핑 테이블 기준으로 제한
  if (localUserType !== "4") return baseRows;

  // 안전 처리: user_id가 없으면 아무 거래처도 노출하지 않음
  if (!localUserId) return [];

  try {
    const mappingRes = await api.get("/Account/AccountUtilMappingList", {
      params: { user_id: localUserId },
    });
    const mappedIds = new Set(
      (Array.isArray(mappingRes?.data) ? mappingRes.data : [])
        .map((row) => toSafeString(row?.account_id))
        .filter(Boolean)
    );

    // 매핑이 없으면 거래처 비노출
    if (mappedIds.size === 0) return [];

    return baseRows.filter((row) => mappedIds.has(toSafeString(row?.account_id)));
  } catch (err) {
    // 매핑 조회 실패 시에도 전체 노출 방지
    console.error("FieldBoard 매핑 거래처 조회 실패:", err);
    return [];
  }
};
