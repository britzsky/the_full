// src/api/client.js
import axios from "axios";
import { sortAccountRows } from "utils/accountSort";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8080"; // 안전장치

const api = axios.create({
  baseURL: API_BASE_URL,
  // 필요하면 공통 옵션 추가
  // withCredentials: true,
});

// ✅ 전역에서 거래처 목록으로 사용하는 엔드포인트만 정렬 대상
const ACCOUNT_LIST_ENDPOINTS = new Set(["/Account/AccountList", "/Account/AccountListV2"]);

// ✅ 응답 행이 거래처 기준 데이터인지 판별(account_id + account_name 보유)
const hasAccountIdentity = (row) =>
  !!row &&
  typeof row === "object" &&
  Object.prototype.hasOwnProperty.call(row, "account_id") &&
  Object.prototype.hasOwnProperty.call(row, "account_name");

// ✅ GET 배열 응답 중 거래처 행 리스트는 자동 정렬 대상으로 처리
const canAutoSortAccountRows = (response) => {
  const method = String(response?.config?.method || "get").toLowerCase();
  if (method !== "get") return false;

  const data = response?.data;
  if (!Array.isArray(data) || data.length <= 1) return false;

  // ✅ 필요 시 특정 요청에서 정렬을 끌 수 있도록 우회 플래그 제공
  const skipSort = String(response?.config?.params?.skip_account_sort || "").toUpperCase();
  if (skipSort === "Y") return false;

  const sample = data.slice(0, Math.min(data.length, 20));
  return sample.every(hasAccountIdentity);
};

// ✅ 상대/절대 URL을 모두 동일한 pathname 형태로 정규화
const normalizePath = (url) => {
  const raw = String(url || "").split("?")[0];
  if (!raw) return "";

  if (/^https?:\/\//iu.test(raw)) {
    try {
      return new URL(raw).pathname || "";
    } catch (error) {
      return raw;
    }
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
};

// 여기에서 공통 헤더, 토큰, 인터셉터도 설정 가능
// api.interceptors.request.use(...);
// api.interceptors.response.use(...);
api.interceptors.response.use(
  (response) => {
    const path = normalizePath(response?.config?.url);
    // ✅ 거래처 목록 응답은 화면 공통 기준(거래처명 오름차순 + 전체 상단고정)으로 정렬
    if (ACCOUNT_LIST_ENDPOINTS.has(path) && Array.isArray(response?.data)) {
      response.data = sortAccountRows(response.data, {
        sortKey: "account_name",
        keepAllOnTop: true,
      });
      return response;
    }

    // ✅ 프로젝트 전역: 거래처 행 배열이면 기본 정렬을 거래처명으로 통일
    if (canAutoSortAccountRows(response)) {
      response.data = sortAccountRows(response.data, {
        sortKey: "account_name",
        keepAllOnTop: true,
      });
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default api;
