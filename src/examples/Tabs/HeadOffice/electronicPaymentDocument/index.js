import DraftDetailModalContent from "./DraftDetailModalContent";
import DraftWriteDocumentForm from "./DraftWriteDocumentForm";
import PaymentDocDetailModalContent from "./PaymentDocDetailModalContent";
import PaymentDocWriteDocumentForm from "./PaymentDocWriteDocumentForm";
import ExpendableDetailModalContent from "./ExpendableDetailModalContent";
import ExpendableWriteDocumentForm from "./ExpendableWriteDocumentForm";
import { DOC_KIND, getDocKindByType } from "../electronicPaymentManageData";

// 작성 탭 본문 컴포넌트 매핑(문서종류 기준)
const WRITE_DOCUMENT_COMPONENT_BY_KIND = {
  [DOC_KIND.DRAFT]: DraftWriteDocumentForm,
  [DOC_KIND.EXPENDABLE]: ExpendableWriteDocumentForm,
  [DOC_KIND.PAYMENT]: PaymentDocWriteDocumentForm,
};

// 관리 상세 모달 본문 컴포넌트 매핑(문서종류 기준)
const DETAIL_DOCUMENT_COMPONENT_BY_KIND = {
  [DOC_KIND.DRAFT]: DraftDetailModalContent,
  [DOC_KIND.EXPENDABLE]: ExpendableDetailModalContent,
  [DOC_KIND.PAYMENT]: PaymentDocDetailModalContent,
};

// 상세 rows 형태를 보고 문서종류를 보정 추론한다.
// ------------------------------------------------------------------
function inferDetailDocKindByItems(detailItems = []) {
  const rows = Array.isArray(detailItems) ? detailItems : [];
  if (rows.length === 0) return DOC_KIND.UNKNOWN;

  const hasPaymentDocFields = rows.some((row) => {
    const amount = String(row?.amount ?? "").trim();
    const tax = String(row?.tax ?? "").trim();
    const total = String(row?.total ?? "").trim();
    const accountNumber = String(row?.account_number ?? "").trim();
    const bizNo = String(row?.biz_no ?? "").trim();
    return !!(amount || tax || total || accountNumber || bizNo);
  });
  if (hasPaymentDocFields) return DOC_KIND.PAYMENT;

  const hasExpendableFields = rows.some((row) => {
    const qty = String(row?.qty ?? "").trim();
    const price = String(row?.price ?? "").trim();
    const useName = String(row?.use_name ?? "").trim();
    const link = String(row?.link ?? "").trim();
    const buyYn = String(row?.buy_yn ?? "").trim();
    return !!(qty || price || useName || link || buyYn);
  });
  if (hasExpendableFields) return DOC_KIND.EXPENDABLE;

  // 남은 케이스는 기안서 단건 본문(title/details/note)을 item 포맷으로 맵핑한 데이터로 간주
  return DOC_KIND.DRAFT;
}

// 작성 화면에서 문서타입에 맞는 본문 컴포넌트를 반환한다.
// 알 수 없는 타입이면 기존 문서(소모품) 포맷을 fallback으로 사용한다.
export function getWriteDocumentComponent(docType, docTypeList = []) {
  const kind = getDocKindByType(docType, docTypeList);
  return WRITE_DOCUMENT_COMPONENT_BY_KIND[kind] || ExpendableWriteDocumentForm;
}

// 관리 상세 모달에서 문서타입에 맞는 본문 컴포넌트를 반환한다.
// - 1차: type테이블(doc_type/doc_name) 기준
// - 2차: 상세 데이터(rows) 컬럼 구조 기준 보정
// 알 수 없는 타입이라고 해서 소모품으로 고정 fallback하지 않도록 수정한다.
export function getDetailDocumentComponent(docType, docTypeList = [], detailItems = []) {
  const kind = getDocKindByType(docType, docTypeList);
  if (DETAIL_DOCUMENT_COMPONENT_BY_KIND[kind]) {
    return DETAIL_DOCUMENT_COMPONENT_BY_KIND[kind];
  }

  const inferredKind = inferDetailDocKindByItems(detailItems);
  return DETAIL_DOCUMENT_COMPONENT_BY_KIND[inferredKind] || DraftDetailModalContent;
}
