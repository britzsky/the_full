// =====================================================================
// 영수증 마감 자료(본사 법인카드) 탭 - 데이터 훅
// - HeadOfficeCorporateCardPaymentListAll (account_id 무관 전체 조회)
// - 1회 API 호출로 전체 거래처 영수증 조회
// - receipt_type(쿠팡/G마켓 등)별로 그룹화하여 표시
// =====================================================================
import { useCallback, useState } from "react";
import api from "api/api";
import { API_BASE_URL } from "config";

// 영수증 타입 코드 → 한글 라벨 매핑
export const RECEIPT_TYPE_LABEL_MAP = {
  coupang:       "쿠팡",
  gmarket:       "G마켓",
  "11post":      "11번가",
  naver:         "네이버",
  homeplus:      "홈플러스",
  auction:       "옥션",
  daiso:         "다이소",
  MART_ITEMIZED: "마트",
  CONVENIENCE:   "편의점",
};

// 영수증 타입 목록 (필터 드롭박스용)
export const CORP_CARD_RECEIPT_TYPES = Object.entries(RECEIPT_TYPE_LABEL_MAP).map(
  ([value, label]) => ({ value, label })
);

// 저장된 파일 경로를 미리보기 URL로 변환
export const buildCorpCardFilePreviewUrl = (path) => {
  if (!path) return "";
  if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("file_path", String(path).startsWith("/") ? String(path) : `/${path}`);
  return `${base}/Account/AccountStoredFileView?${params.toString()}`;
};

// PDF 파일 여부 판별
export const isCorpCardPdfFile = (path = "") => {
  const clean = String(path).split("?")[0].split("#")[0];
  const ext = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  return ext === "pdf";
};

// 숫자 천 단위 콤마 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString("ko-KR");
};

// =====================================================================
// 본사 법인카드 영수증 마감 자료 조회 훅
// - /Account/HeadOfficeCorporateCardPaymentListAll 1회 호출
// - filters: { year, month, receiptType }
// =====================================================================
export default function useCorpCardReceiptArchiveData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async (filters) => {
    setLoading(true);
    try {
      const res = await api.get("/Account/HeadOfficeCorporateCardPaymentListAll", {
        params: {
          year:  filters?.year  || "",
          month: filters?.month || "",
        },
        validateStatus: () => true,
      });

      // 응답 형태 방어 처리
      const raw = res.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const list = Array.isArray(parsed) ? parsed : parsed?.data || [];

      const mapped = (list || []).map((item) => ({
        sale_id:       item.sale_id,
        account_id:    item.account_id,
        account_name:  item.account_name || "",
        use_name:      item.use_name || "",
        saleDate:      item.payment_dt || item.saleDate || "",
        total:         formatNumber(item.total),
        receipt_image: item.receipt_image || "",
        receipt_type:  String(item.receipt_type || ""),
      }));

      // receipt_type 필터 (프론트에서 적용)
      const filtered =
        filters?.receiptType && filters.receiptType !== "0"
          ? mapped.filter((r) => r.receipt_type === filters.receiptType)
          : mapped;

      setRows(filtered);
      return filtered;
    } catch (err) {
      console.error("본사 법인카드 영수증 마감 자료 조회 실패:", err);
      setRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, fetchRows };
}
