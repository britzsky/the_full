// src/config.js
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";

// 파일/이미지 URL 만들 때 쓸 함수 (옵션)
export const buildUrl = (path = "") => {
  if (!path) return "";
  // 이미 http로 시작하면 그대로 사용
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
};