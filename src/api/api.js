// src/api/client.js
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8080"; // 안전장치

const api = axios.create({
  baseURL: API_BASE_URL,
  // 필요하면 공통 옵션 추가
  // withCredentials: true,
});

// 여기에서 공통 헤더, 토큰, 인터셉터도 설정 가능
// api.interceptors.request.use(...);
// api.interceptors.response.use(...);

export default api;