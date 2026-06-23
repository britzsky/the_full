// =====================================================================
// 거래처 마감 자료 탭 - 데이터 훅
// - API 조회 로직 및 유틸리티 함수 모음
// - AccountReceiptTab.js에서 import하여 사용
// =====================================================================
import { useCallback, useState } from "react";
import api from "api/api";
import { API_BASE_URL } from "config";

// 영수증 이미지 필드 키 목록 (최대 3장)
const RECEIPT_IMAGE_KEYS = ["receipt_image", "receipt_image2", "receipt_image3"];

// 삼성웰스토리 그룹 식별자 (타입 필터 그룹화용)
export const SAMSUNG_WELSTORY_TYPE_GROUP_VALUE = "SAMSUNG_WELSTORY";

// 삼성웰스토리 타입 코드 집합 (1~4번 타입)
export const SAMSUNG_WELSTORY_TYPE_VALUES = new Set(["1", "2", "3", "4"]);

// 파라미터 정규화: 전체 선택(0) 또는 삼성웰스토리 그룹 선택 시 빈 문자열 반환
const toParam = (value) => {
  if (!value || value === "0") return "";
  if (String(value) === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE) return "";
  return value;
};

// 숫자 천 단위 콤마 포맷 (예: 150000 → "150,000")
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString("ko-KR");
};

// 파일 경로에서 확장자 추출 (쿼리스트링 제거 후 처리)
export const getExt = (path = "") => {
  const clean = String(path).split("?")[0].split("#")[0];
  return clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
};

// PDF 파일 여부 판별
export const isPdfFile = (path) => getExt(path) === "pdf";

// 행에서 영수증 이미지 경로 목록 추출 (빈 값·중복 제거)
export const getReceiptImagePaths = (row) => {
  const unique = [];
  RECEIPT_IMAGE_KEYS.forEach((key) => {
    const value = String(row?.[key] ?? "").trim();
    if (!value) return;
    if (!unique.includes(value)) unique.push(value);
  });
  return unique;
};

// 저장된 파일 경로를 미리보기 URL로 변환
// - 이미 절대 URL(http/blob/data)이면 그대로 반환
// - 상대 경로면 서버 파일뷰어 URL로 변환
export const buildFilePreviewUrl = (path) => {
  if (!path) return "";
  if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("file_path", String(path).startsWith("/") ? String(path) : `/${path}`);
  return `${base}/Account/AccountStoredFileView?${params.toString()}`;
};

// =====================================================================
// 거래처 영수증 자료 조회 훅
// - /Account/AccountPurchaseTallyList 를 통해 전체 거래처 영수증 조회
// - filters: { year, month, type, payType }
// - options.updateRows=false: rows 상태를 갱신하지 않고 결과만 반환 (타입 옵션 조회용)
// - options.silent=true: 로딩 스피너 없이 조회 (백그라운드 조회용)
// =====================================================================
export default function useAccountReceiptTabData() {
  // 조회된 영수증 행 목록
  const [rows, setRows] = useState([]);
  // 로딩 상태 (LoadingScreen 표시 여부)
  const [loading, setLoading] = useState(true);

  const fetchReceiptRows = useCallback(async (filters, options = {}) => {
    const shouldUpdateRows = options.updateRows !== false;
    const silent = options.silent === true;
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/Account/AccountPurchaseTallyList", {
        params: {
          account_id: "",             // 전체 거래처 조회
          type: toParam(filters?.type),
          year: toParam(filters?.year),
          month: toParam(filters?.month),
          payType: toParam(filters?.payType),
        },
      });

      // 응답 형태에 따라 배열 추출
      const list = Array.isArray(res.data)
        ? res.data
        : res.data && res.data.code === 200
          ? res.data.rows || []
          : [];

      // 화면 표시용 필드 매핑 및 타입 문자열 정규화
      const mapped = (list || []).map((item) => ({
        sale_id: item.sale_id,
        account_id: item.account_id,
        account_name: item.account_name || "",
        use_name: item.use_name || "",
        saleDate: item.saleDate || "",
        total: formatNumber(item.total),
        receipt_image: item.receipt_image || "",
        receipt_image2: item.receipt_image2 || "",
        receipt_image3: item.receipt_image3 || "",
        type: String(item.type ?? ""),
        type_name: item.type_name || "",
        payType: String(item.payType ?? ""),
      }));

      // 삼성웰스토리 그룹 타입 필터링 (그룹 선택 시 1~4번만 반환)
      const selectedType = String(filters?.type ?? "0");
      const filtered =
        selectedType === SAMSUNG_WELSTORY_TYPE_GROUP_VALUE
          ? mapped.filter((row) => SAMSUNG_WELSTORY_TYPE_VALUES.has(String(row.type ?? "")))
          : mapped;

      if (shouldUpdateRows) setRows(filtered);
      return filtered;
    } catch (err) {
      console.error("거래처 영수증 자료 조회 실패:", err);
      if (shouldUpdateRows) setRows([]);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  return {
    rows,             // 조회된 영수증 행 목록
    loading,          // 로딩 상태
    fetchReceiptRows, // 조회 함수
  };
}
