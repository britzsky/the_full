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

// FP 문서 타입 코드 (tb_electronic_payment_type.doc_type)
export const FP_DOC_TYPE = "FP";

// 문서번호 생성 (FP-YYYYMMDDHHmmss001 형식)
function buildFpRequestNo(draftDt, sequence = 1) {
  const now = draftDt || new Date().toISOString();
  const dt = new Date(now);
  if (isNaN(dt.getTime())) return `${FP_DOC_TYPE}-`;

  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const stamp =
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}` +
    `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  const seq = String(Math.max(1, Number(sequence) || 1)).padStart(3, "0");
  return `${FP_DOC_TYPE}-${stamp}${seq}`;
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
  const fetchNextRequestNo = useCallback(async (draftDt) => {
    const userId = localStorage.getItem("user_id") || "";
    const fallback = buildFpRequestNo(draftDt, 1);
    if (!userId) return fallback;

    try {
      const res = await api.get(MANAGE_LIST_API, { params: { user_id: userId } });
      const rows = Array.isArray(res.data) ? res.data : (res.data?.list || []);
      const draftDateKey = draftDt
        ? new Date(draftDt).toISOString().slice(0, 10).replace(/-/g, "")
        : "";

      const sameDay = rows.filter((r) => {
        const docType = String(r?.doc_type || "").toUpperCase();
        const draft = String(r?.draft_dt || "");
        const dateKey = draft.slice(0, 10).replace(/-/g, "");
        return docType === FP_DOC_TYPE && dateKey === draftDateKey;
      });

      return buildFpRequestNo(draftDt, sameDay.length + 1);
    } catch {
      return fallback;
    }
  }, []);

  // 구입요청서 저장 (전자결재 시스템 FP 타입)
  const savePurchaseRequest = useCallback(async (payload) => {
    const userId = localStorage.getItem("user_id") || "";

    const department = localStorage.getItem("department") || "";

    return api.post(
      PAYMENT_SAVE_API,
      {
        main: {
          payment_id: payload.payment_id || "",
          doc_type: FP_DOC_TYPE,
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

  // 로그인 사용자가 직접 기안한 FP 구매요청서 목록을 조회한다.
  const fetchPurchaseRequestHistory = useCallback(async () => {
    const userId = localStorage.getItem("user_id") || "";
    if (!userId) return [];

    const res = await api.get(MANAGE_LIST_API, { params: { user_id: userId } });
    const rows = Array.isArray(res.data) ? res.data : (res.data?.list || []);
    return rows.filter((row) =>
      String(row?.doc_type || "").toUpperCase() === FP_DOC_TYPE &&
      String(row?.reg_user_id || row?.user_id || "") === userId
    );
  }, []);

  // 선택한 구매요청서의 메인 정보와 품목 내역을 조회한다.
  const fetchPurchaseRequestDetail = useCallback(async (paymentId) => {
    const userId = localStorage.getItem("user_id") || "";
    if (!userId || !paymentId) return { main: null, items: [] };

    const res = await api.get(MANAGE_DETAIL_API, {
      params: { user_id: userId, payment_id: paymentId },
    });
    return {
      main: res.data?.main || null,
      items: Array.isArray(res.data?.items) ? res.data.items : [],
    };
  }, []);

  return {
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
