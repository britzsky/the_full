// 구입요청서 데이터 훅 (현장 영양사 → 전자결재 시스템 연동)
// - 거래처명: tb_user.account_id → tb_account.account_name JOIN
// - 작성자명: localStorage user_name
// - 1차결재자: 거래처에 매핑된 관리자 (구입 업장관리 매핑 기준)
// - 2차결재자: 1차결재자와 같은 부서의 position=1 사용자
// - 저장: /HeadOffice/ElectronicPaymentSave (FP 문서타입, 소모품 구매 품의서 품목 구조)
/* eslint-disable react/function-component-definition */
import { useState, useCallback, useEffect } from "react";
import api from "api/api";

// 구입요청 사용자 정보 조회 API (거래처명 + 1차결재자)
const USER_INFO_API = "/FieldBoard/PurchaseRequestUserInfo";
// 전자결재 저장 API (FP 타입 문서로 저장)
const PAYMENT_SAVE_API = "/HeadOffice/ElectronicPaymentSave";
// 문서번호 조회용 목록 API
const MANAGE_LIST_API = "/HeadOffice/ElectronicPaymentManageList";
// 구매요청서 상세 조회 API
const MANAGE_DETAIL_API = "/HeadOffice/ElectronicPaymentManageDetail";
// 최종 승인된 개인구매 품목의 구매일자·영수증 후첨 저장 API (저장 시 개인구매 관리에 반영)
const PERSON_PURCHASE_RECEIPT_SAVE_API = "/FieldBoard/PersonPurchaseReceiptSave";

// 온라인구매(FP) 문서 타입 코드 (tb_electronic_payment_type.doc_type)
export const FP_DOC_TYPE = "FP";
// 개인구매(FR) 문서 타입 코드 - 결재 후 직접 구매하고 구매일자·영수증을 후첨하는 문서
export const FR_DOC_TYPE = "FR";
// 구매요청서 탭에서 다루는 문서 타입 목록
export const PURCHASE_REQUEST_DOC_TYPES = [FP_DOC_TYPE, FR_DOC_TYPE];

// 문서번호 생성 (FP-YYYYMMDDHHmmss001 / FR-YYYYMMDDHHmmss001 형식)
function buildFpRequestNo(draftDt, sequence = 1, docType = FP_DOC_TYPE) {
  const now = draftDt || new Date().toISOString();
  const dt = new Date(now);
  if (isNaN(dt.getTime())) return `${docType}-`;

  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const stamp =
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}` +
    `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  const seq = String(Math.max(1, Number(sequence) || 1)).padStart(3, "0");
  return `${docType}-${stamp}${seq}`;
}

// ─── 구입요청서 데이터 훅 ─────────────────────────────────────────────────────
export default function usePurchaseRequestData() {
  // 거래처명 상태
  const [accountName, setAccountName] = useState("");
  // 작성자명 상태
  const [writerName, setWriterName] = useState("");
  // 1차결재자 정보 (user_id, user_name)
  const [approver1st, setApprover1st] = useState({ user_id: "", user_name: "" });
  // 2차결재자 정보 (1차결재자와 같은 부서의 position=1 사용자)
  const [approver2nd, setApprover2nd] = useState({ user_id: "", user_name: "" });
  // 초기 로딩 여부
  const [loading, setLoading] = useState(false);

  // 사용자 정보 초기 조회 (거래처명 + 1차결재자)
  useEffect(() => {
    const userId = localStorage.getItem("user_id") || "";
    const name = localStorage.getItem("user_name") || "";
    setWriterName(name);
    if (!userId) return;

    setLoading(true);
    api
      .get(USER_INFO_API, { params: { user_id: userId } })
      .then((res) => {
        const data = res.data || {};
        const resolvedAccountName = data.account_name ?? data.ACCOUNT_NAME ?? "";
        const resolvedApproverId = data.approver_user_id ?? data.APPROVER_USER_ID ?? "";
        const resolvedApproverName = data.approver_user_name ?? data.APPROVER_USER_NAME ?? "";
        const resolvedApprover2ndId =
          data.approver_2nd_user_id ?? data.APPROVER_2ND_USER_ID ?? "";
        const resolvedApprover2ndName =
          data.approver_2nd_user_name ?? data.APPROVER_2ND_USER_NAME ?? "";
        setAccountName(resolvedAccountName);
        // 1차결재자 (계정 매핑된 관리자)
        if (resolvedApproverId) {
          setApprover1st({
            user_id: String(resolvedApproverId),
            user_name: String(resolvedApproverName || resolvedApproverId),
          });
        } else {
          setApprover1st({ user_id: "", user_name: "" });
        }
        if (resolvedApprover2ndId) {
          setApprover2nd({
            user_id: String(resolvedApprover2ndId),
            user_name: String(resolvedApprover2ndName || resolvedApprover2ndId),
          });
        } else {
          setApprover2nd({ user_id: "", user_name: "" });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 문서번호 순번 조회 (기안일자 기준 동일 타입 문서 수 + 1)
  const fetchNextRequestNo = useCallback(async (draftDt, docType = FP_DOC_TYPE) => {
    const userId = localStorage.getItem("user_id") || "";
    const fallback = buildFpRequestNo(draftDt, 1, docType);
    if (!userId) return fallback;

    try {
      const res = await api.get(MANAGE_LIST_API, { params: { user_id: userId } });
      const rows = Array.isArray(res.data) ? res.data : (res.data?.list || []);
      const draftDateKey = draftDt
        ? new Date(draftDt).toISOString().slice(0, 10).replace(/-/g, "")
        : "";

      const sameDay = rows.filter((r) => {
        const rowDocType = String(r?.doc_type || "").toUpperCase();
        const draft = String(r?.draft_dt || "");
        const dateKey = draft.slice(0, 10).replace(/-/g, "");
        return rowDocType === docType && dateKey === draftDateKey;
      });

      return buildFpRequestNo(draftDt, sameDay.length + 1, docType);
    } catch {
      return fallback;
    }
  }, []);

  // 구입요청서 저장 (전자결재 시스템 FP/FR 타입)
  const savePurchaseRequest = useCallback(async (payload) => {
    const userId = localStorage.getItem("user_id") || "";

    const department = localStorage.getItem("department") || "";

    return api.post(
      PAYMENT_SAVE_API,
      {
        main: {
          payment_id: payload.payment_id || "",
          doc_type: payload.doc_type || FP_DOC_TYPE,
          department,
          user_id: userId,
          reg_user_id: userId,
          draft_dt: payload.draft_dt || "",
          start_dt: payload.start_dt || payload.draft_dt || "",
          retention_dt: 5,
          access_level: 1,
          tm_user: payload.tm_user || "",
          payer_user: payload.payer_user || "",
          ceo_user: "",
          charge_sign: "4",
          tm_sign: "",
          payer_sign: "",
          ceo_sign: "",
          status: "",
        },
        // 소모품 구매 품의서 품목 행 배열을 그대로 전달
        item: payload.items || [],
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }, []);

  // 로그인 사용자가 직접 기안한 FP/FR 구매요청서 목록을 조회한다.
  const fetchPurchaseRequestHistory = useCallback(async () => {
    const userId = localStorage.getItem("user_id") || "";
    if (!userId) return [];

    const res = await api.get(MANAGE_LIST_API, { params: { user_id: userId } });
    const rows = Array.isArray(res.data) ? res.data : (res.data?.list || []);
    return rows.filter((row) =>
      PURCHASE_REQUEST_DOC_TYPES.includes(String(row?.doc_type || "").toUpperCase()) &&
      String(row?.reg_user_id || row?.user_id || "") === userId
    );
  }, []);

  // 선택한 구매요청서의 메인 정보, 품목 내역, 첨부 영수증을 조회한다.
  const fetchPurchaseRequestDetail = useCallback(async (paymentId) => {
    const userId = localStorage.getItem("user_id") || "";
    if (!userId || !paymentId) return { main: null, items: [], files: [] };

    const res = await api.get(MANAGE_DETAIL_API, {
      params: { user_id: userId, payment_id: paymentId },
    });
    return {
      main: res.data?.main || null,
      items: Array.isArray(res.data?.items) ? res.data.items : [],
      files: Array.isArray(res.data?.files) ? res.data.files : [],
    };
  }, []);

  // 개인구매 품목들의 구매일자·영수증을 일괄 후첨 저장한다. 하나라도 실패하면 서버에서 전체 취소된다.
  // - rows: [{ itemIdx, saleDate, file }] (같은 순서로 item_idx/saleDate/files 배열 전송)
  // - 응답 code 200: 성공, 그 외: message 안내
  const savePersonPurchaseReceipt = useCallback(async ({ paymentId, rows }) => {
    const formData = new FormData();
    formData.append("payment_id", paymentId);
    formData.append("user_id", localStorage.getItem("user_id") || "");
    (rows || []).forEach((row) => {
      formData.append("item_idx", row.itemIdx);
      formData.append("saleDate", row.saleDate);
      formData.append("files", row.file);
    });
    const res = await api.post(PERSON_PURCHASE_RECEIPT_SAVE_API, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res?.data || {};
  }, []);

  return {
    savePersonPurchaseReceipt,
    accountName,
    writerName,
    approver1st,
    approver2nd,
    loading,
    fetchNextRequestNo,
    savePurchaseRequest,
    fetchPurchaseRequestHistory,
    fetchPurchaseRequestDetail,
  };
}
