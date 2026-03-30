/* eslint-disable react/function-component-definition */
import { useCallback, useEffect, useState } from "react";
import api from "api/api";

// 전자결재 관리 탭에서 사용하는 백엔드 API 경로
// - 목록: 로그인 사용자가 볼 수 있는 문서(기안자/결재자 대상)
// - 상세: 선택한 문서의 메인/품목 데이터
// - 저장: 결재(4) / 반려(3) 처리
const MANAGE_LIST_API = "/HeadOffice/ElectronicPaymentManageList";
const MANAGE_DETAIL_API = "/HeadOffice/ElectronicPaymentManageDetail";
const MANAGE_SIGN_SAVE_API = "/HeadOffice/ElectronicPaymentManageSignSave";
const MANAGE_ITEM_BUY_YN_SAVE_API = "/HeadOffice/ElectronicPaymentItemBuyYnSave";
const COMPANY_TREE_API = "/HeadOffice/HeadOfficeCompanyUserTree";
const DOC_TYPE_LIST_API = "/HeadOffice/HeadOfficeElectronicPaymentTypeList";

// --------------------------------------------------------------------------
// 문서타입 공통 유틸
// - 기준 데이터: tb_electronic_payment_type (doc_type, doc_name)
//   "타입 목록에서 내려온 doc_type"을 기준으로 판정한다.
// --------------------------------------------------------------------------

// 문서종류 내부 식별값
// - draft: 기안서
// - expendable: 소모품 구매 품의서
// - payment: 지출결의서
// - unknown: 분류 불가
export const DOC_KIND = Object.freeze({
  DRAFT: "draft",
  EXPENDABLE: "expendable",
  PAYMENT: "payment",
  UNKNOWN: "unknown",
});

// null/undefined 안전 문자열 변환
function asText(value) {
  return String(value ?? "").trim();
}

// 문서타입 코드(doc_type) 정규화
// - 공백 제거
// - 대문자 통일
export function toDocTypeKey(value) {
  return asText(value).toUpperCase();
}

// 문서명(doc_name) 비교용 정규화
// - 공백 제거(띄어쓰기 차이 흡수)
// - trim 처리
function toDocNameKey(value) {
  return asText(value).replace(/\s+/g, "");
}

// doc_name 텍스트를 문서종류로 분류
// - "소모품 ... 품의서"  : 소모품 문서
// - "기안서"             : 기안 문서
// - "지출결의서"         : 지출결의서 문서
function detectDocKindByName(docName) {
  const name = toDocNameKey(docName);
  if (!name) return DOC_KIND.UNKNOWN;

  if (name.includes("소모품") && name.includes("품의서")) return DOC_KIND.EXPENDABLE;
  if (name.includes("기안서")) return DOC_KIND.DRAFT;
  if (name.includes("지출결의서")) return DOC_KIND.PAYMENT;
  return DOC_KIND.UNKNOWN;
}

// doc_type 코드로 타입목록에서 해당 행 1건 조회
export function getDocTypeRow(docType, docTypeList) {
  const key = toDocTypeKey(docType);
  if (!key) return null;

  const rows = Array.isArray(docTypeList) ? docTypeList : [];
  return rows.find((row) => toDocTypeKey(row?.doc_type) === key) || null;
}

// doc_type 코드 -> 문서종류(draft/expendable/payment) 변환
//   타입목록에서 doc_name을 찾아 분류한다.
export function getDocKindByType(docType, docTypeList) {
  const row = getDocTypeRow(docType, docTypeList);
  return detectDocKindByName(row?.doc_name);
}

// doc_type 코드가 특정 문서종류인지 여부 판정
export function isDocKind(docType, docTypeList, targetKind) {
  return getDocKindByType(docType, docTypeList) === targetKind;
}

// 문서종류(draft/expendable/payment)에 대응하는 doc_type 코드 조회
// - 반환값은 tb_electronic_payment_type.doc_type 원본 코드(대문자 정규화)
export function getDocTypeByKind(docTypeList, targetKind) {
  const rows = Array.isArray(docTypeList) ? docTypeList : [];
  const found = rows.find((row) => detectDocKindByName(row?.doc_name) === targetKind);
  return toDocTypeKey(found?.doc_type);
}

// doc_type 코드 -> 표시용 문서명(doc_name) 조회
// - 타입목록에 없으면 코드값 또는 fallbackText를 반환
export function getDocNameByType(docType, docTypeList, fallbackText = "-") {
  const row = getDocTypeRow(docType, docTypeList);
  const docName = asText(row?.doc_name);
  if (docName) return docName;

  const key = toDocTypeKey(docType);
  if (key) return key;
  return fallbackText;
}

// 전자결재 관리 탭 전용 데이터 훅
// UI 컴포넌트에서는 이 훅이 제공하는 상태/함수만 사용하도록 분리
export default function useElectronicPaymentManageData() {
  // 문서타입 목록 상태
  // - tb_electronic_payment_type 기반 doc_type/doc_name 목록
  const [docTypeList, setDocTypeList] = useState([]);

  // 목록 영역 상태
  // - loading: 목록 조회 중 로딩 표시
  // - rows: 목록 테이블 원본 데이터
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // 상세 모달 영역 상태
  // - detailLoading: 상세 조회 중 로딩 표시
  // - detailMain: 결재문서 메인 정보
  // - detailItems: 품목 상세 목록
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMain, setDetailMain] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailFiles, setDetailFiles] = useState([]);

  // 결재/반려 저장 버튼 상태
  // - 저장 중 중복 클릭을 막기 위해 사용
  const [saving, setSaving] = useState(false);

  // 사용자 메타 정보 맵
  // key: user_id, value: { user_id, user_name, position, position_name }
  // 결재선 표시 시 ID 대신 "이름 + 직책" 출력에 사용한다.
  const [userMetaMap, setUserMetaMap] = useState({});

  // 내 문서/결재대상 목록 조회
  // user_id가 없으면 조회하지 않고 빈 배열을 반환한다.
  const fetchManageList = useCallback(async (userId) => {
    if (!userId) {
      setRows([]);
      return [];
    }

    try {
      setLoading(true);
      const res = await api.get(MANAGE_LIST_API, { params: { user_id: userId } });
      // 백엔드 응답 포맷이 배열 혹은 { list: [] } 둘 다 가능하도록 방어 처리
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.list) ? res.data.list : [];
      setRows(data || []);
      return data || [];
    } catch (err) {
      console.error("전자결재 관리 목록 조회 실패:", err);
      setRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 문서타입 목록 조회
  // - 기준 테이블: tb_electronic_payment_type
  // - 화면 로직은 이 목록의 doc_type 값을 기준으로 판단한다.
  const fetchDocTypeList = useCallback(async () => {
    try {
      const res = await api.get(DOC_TYPE_LIST_API);
      const data = Array.isArray(res.data) ? res.data : [res.data];

      const normalized = (data || [])
        .filter(Boolean)
        .map((row) => ({
          doc_type: toDocTypeKey(row?.doc_type),
          doc_name: asText(row?.doc_name),
          position: Number(row?.position ?? 0),
        }))
        .filter((row) => !!row.doc_type && !!row.doc_name);

      // doc_type 중복 제거
      const byType = new Map();
      normalized.forEach((row) => {
        if (!byType.has(row.doc_type)) byType.set(row.doc_type, row);
      });

      const uniqueRows = Array.from(byType.values()).sort((a, b) => {
        const posDiff = Number(a.position ?? 0) - Number(b.position ?? 0);
        if (posDiff !== 0) return posDiff;
        return String(a.doc_type).localeCompare(String(b.doc_type));
      });

      setDocTypeList(uniqueRows);
      return uniqueRows;
    } catch (err) {
      console.error("전자결재 문서타입 조회 실패:", err);
      setDocTypeList([]);
      return [];
    }
  }, []);

  // 훅 최초 진입 시 문서타입 목록 선조회
  useEffect(() => {
    fetchDocTypeList();
  }, [fetchDocTypeList]);

  // 문서 상세 조회
  // - payment_id: 조회 대상 문서 키
  // - user_id: 권한 검증용(백엔드에서 목록 권한과 동일하게 제한)
  // 필수값이 비어있으면 상세 상태를 초기화한다.
  const fetchManageDetail = useCallback(async (paymentId, userId) => {
    if (!paymentId || !userId) {
      setDetailMain(null);
      setDetailItems([]);
      setDetailFiles([]);
      return { main: null, items: [], files: [] };
    }

    try {
      setDetailLoading(true);
      const res = await api.get(MANAGE_DETAIL_API, {
        params: { payment_id: paymentId, user_id: userId },
      });
      // main/items가 누락되어도 화면이 깨지지 않도록 기본값 보정
      const main = res?.data?.main || null;
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      const files = Array.isArray(res?.data?.files) ? res.data.files : [];
      setDetailMain(main);
      setDetailItems(items);
      setDetailFiles(files);
      return { main, items, files };
    } catch (err) {
      console.error("전자결재 상세 조회 실패:", err);
      setDetailMain(null);
      setDetailItems([]);
      setDetailFiles([]);
      return { main: null, items: [], files: [] };
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 결재(4)/반려(3) 처리 저장
  // 성공 시 true, 실패 시 false를 반환해 UI에서 안내 문구를 분기한다.
  const saveSign = useCallback(async ({ payment_id, user_id, action_status }) => {
    if (!payment_id || !user_id || !action_status) return false;

    try {
      setSaving(true);
      // action_status: "4" = 결재, "3" = 반려
      await api.post(MANAGE_SIGN_SAVE_API, { payment_id, user_id, action_status });
      return true;
    } catch (err) {
      console.error("전자결재 승인/반려 저장 실패:", err);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // 소모품 품목 구매여부(buy_yn) 저장
  // - 결재자 권한 검증은 백엔드에서 최종 검사
  // - 성공 시 detailItems 로컬 상태도 즉시 반영한다.
  const saveItemBuyYn = useCallback(async ({ payment_id, idx, user_id, buy_yn }) => {
    if (!payment_id || !idx || !user_id) return false;

    const normalizedBuyYn = String(buy_yn || "").trim().toUpperCase() === "Y" ? "Y" : "N";

    try {
      await api.post(MANAGE_ITEM_BUY_YN_SAVE_API, {
        payment_id,
        idx,
        user_id,
        buy_yn: normalizedBuyYn,
      });

      setDetailItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) => {
          if (String(row?.idx ?? "") !== String(idx)) return row;
          return { ...row, buy_yn: normalizedBuyYn };
        })
      );
      return true;
    } catch (err) {
      console.error("소모품 구매여부 저장 실패:", err);
      return false;
    }
  }, []);

  // 회사 트리 조회 후 사용자 메타 맵 구성
  // 응답 구조가 부서[{ users:[] }] 또는 사용자 배열일 수 있어 모두 대응한다.
  const fetchUserMetaMap = useCallback(async () => {
    try {
      const res = await api.get(COMPANY_TREE_API);
      const rows = Array.isArray(res.data) ? res.data : [res.data];
      const nextMap = {};

      const upsertUser = (rawUser) => {
        if (!rawUser) return;
        const userId = String(rawUser.user_id ?? rawUser.id ?? "").trim();
        if (!userId) return;

        if (!nextMap[userId]) {
          nextMap[userId] = {
            user_id: userId,
            user_name: String(rawUser.user_name ?? rawUser.name ?? "").trim(),
            position: String(rawUser.position ?? rawUser.pos ?? rawUser.rank ?? "").trim(),
            position_name: String(
              rawUser.position_name ?? rawUser.rank_name ?? rawUser.pos_name ?? ""
            ).trim(),
          };
        }
      };

      (rows || []).forEach((row) => {
        if (!row) return;

        const deptUsers = Array.isArray(row.users)
          ? row.users
          : Array.isArray(row.user_list)
            ? row.user_list
            : [];

        if (deptUsers.length > 0) {
          deptUsers.forEach(upsertUser);
          return;
        }

        upsertUser(row);
      });

      setUserMetaMap(nextMap);
      return nextMap;
    } catch (err) {
      console.error("사용자 메타 조회 실패:", err);
      setUserMetaMap({});
      return {};
    }
  }, []);

  // 탭 컴포넌트에서 필요한 상태/함수 노출
  return {
    docTypeList,
    loading,
    rows,
    detailLoading,
    detailMain,
    detailItems,
    detailFiles,
    saving,
    userMetaMap,
    fetchManageList,
    fetchManageDetail,
    saveSign,
    saveItemBuyYn,
    fetchUserMetaMap,
    fetchDocTypeList,
  };
}
