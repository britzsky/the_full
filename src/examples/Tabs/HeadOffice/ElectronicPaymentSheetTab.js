// src/layouts/handover/ElectronicPaymentSheetTab.js
/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { TextField, useTheme, useMediaQuery, Modal, Box } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import logo from "assets/images/the-full-logo4.png";
import useElectronicPaymentSheetData from "./electronicPaymentSheetData";
import { getWriteDocumentComponent } from "./electronicPaymentDocument";
import {
  DOC_KIND,
  getDocKindByType,
  getDocTypeByKind,
  isDocKind,
} from "./electronicPaymentManageData";
import PropTypes from "prop-types";
import {
  HEADOFFICE_DOCUMENT_FILE_ACCEPT,
  MAX_HEADOFFICE_DOCUMENT_IMAGE_COUNT,
  preparePendingDocumentImageFiles,
  removePendingDocumentImageAt,
  revokePendingDocumentImageUrls,
  syncHeadOfficeDocumentImages,
  toggleDeletedDocumentImage,
} from "utils/headOfficeDocumentImageUtils";

const RETENTION_OPTIONS = [
  { v: "1", t: "1년" },
  { v: "2", t: "2년" },
  { v: "3", t: "3년" },
  { v: "4", t: "4년" },
  { v: "5", t: "5년" },
  { v: "6", t: "10년" },
  { v: "7", t: "영구" },
];

const ACCESS_LEVEL_OPTIONS = [
  { v: "1", t: "1등급" },
  { v: "2", t: "2등급" },
  { v: "3", t: "3등급" },
  { v: "4", t: "4등급" },
  { v: "5", t: "5등급" },
];

const DEFAULT_RETENTION_DT = "5";
const DEFAULT_ACCESS_LEVEL = "1";
const MIN_DOC_TYPE_LOADING_MS = 220;
// TODO: 소모품 구매 품의서 결재자 고정 ID는 운영 정책에 맞춰 변경 가능
const EXPENDABLE_FIXED_PAYER_USER_ID = "iy1";
const DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT = "hh2";

const DEFAULT_PAYER_DOC_TYPE_META = Object.freeze({
  largeType: "공통",
  middleType: "결의서",
  smallType: "지출결의서-소모품",
  docName: "지출결의서",
  position: 2,
});
const REQUEST_NO_SEQUENCE_LENGTH = 3;

const PAYMENT_DOC_FORM_CONFIG = {
  title: "지출결의서",
  requestInfoTitle: "지출 정보",
  itemsTitle: "지출 내용",
  contentMode: "payment_doc",
  reasonTitle: "지출 사유",
  reasonPlaceholder: "지출 사유",
};

const DOC_FORM_CONFIG_BY_KIND = {
  [DOC_KIND.EXPENDABLE]: {
    title: "소모품 구매 품의서",
    requestInfoTitle: "요청 정보",
    itemsTitle: "품목 내역",
    contentMode: "items",
    itemNameLabel: "품목명",
    useNoteLabel: "사용처/용도",
    linkLabel: "구매링크",
    reasonTitle: "요청 사유",
    reasonPlaceholder: "요청 사유",
  },
  [DOC_KIND.DRAFT]: {
    title: "기안서",
    requestInfoTitle: "기안 정보",
    itemsTitle: "기안 내용",
    contentMode: "draft_sheet",
    reasonTitle: "기안 사유",
    reasonPlaceholder: "기안 사유",
  },
  [DOC_KIND.PAYMENT]: PAYMENT_DOC_FORM_CONFIG,
};

function toDocTypeKey(value) {
  return String(value ?? "").trim().toUpperCase();
}

// 기안일자에서 문서번호 일자 비교용 키를 만든다.
function resolveRequestNoDateKey(value) {
  const targetDate = dayjs(value);
  if (!targetDate.isValid()) return "";
  return targetDate.format("YYYYMMDD");
}

// 문서번호 본문에는 기안일자의 시분초(YYYYMMDDHHmmss)까지만 사용한다.
function resolveRequestNoBaseStamp(value) {
  const targetDate = dayjs(value);
  if (!targetDate.isValid()) return "";
  return targetDate.format("YYYYMMDDHHmmss");
}

// 문서번호는 doc_type-YYYYMMDDHHmmss001 형식으로 만든다.
function buildRequestNo(docType, draftDateTimeValue, sequence = 1) {
  const docTypeKey = toDocTypeKey(docType);
  const baseStamp = resolveRequestNoBaseStamp(draftDateTimeValue);
  if (!docTypeKey) return "";
  if (!baseStamp) return `${docTypeKey}-`;

  const safeSequence = Math.max(Number(sequence) || 1, 1);
  return `${docTypeKey}-${baseStamp}${String(safeSequence).padStart(REQUEST_NO_SEQUENCE_LENGTH, "0")}`;
}

// 관리 목록의 기안일자가 현재 문서와 같은 날짜인지 비교한다.
function isSameRequestNoDate(value, requestDateKey) {
  return resolveRequestNoDateKey(value) === String(requestDateKey ?? "").trim();
}

function isDefaultPayerDocTypeRow(row) {
  if (!row) return false;

  return (
    String(row?.large_type ?? "").trim() === DEFAULT_PAYER_DOC_TYPE_META.largeType &&
    String(row?.middle_type ?? "").trim() === DEFAULT_PAYER_DOC_TYPE_META.middleType &&
    String(row?.small_type ?? "").trim() === DEFAULT_PAYER_DOC_TYPE_META.smallType &&
    String(row?.doc_name ?? "").trim() === DEFAULT_PAYER_DOC_TYPE_META.docName &&
    Number(row?.approval_position ?? row?.position ?? -1) === DEFAULT_PAYER_DOC_TYPE_META.position
  );
}

function getDocFormConfig(docType, docTypeList) {
  const kind = getDocKindByType(docType, docTypeList);
  return DOC_FORM_CONFIG_BY_KIND[kind] || null;
}

function isPaymentDocType(docType, docTypeList) {
  return isDocKind(docType, docTypeList, DOC_KIND.PAYMENT);
}

function resolveDefaultPaymentDocType(docTypeList) {
  return getDocTypeByKind(docTypeList, DOC_KIND.PAYMENT);
}

// ✅ position 규칙(결재권자 범위)
// - 0: 팀장 -> 대표
// - 1: 팀장
// - 2: 결재자
const getRequiredRoles = (pos) => {
  if (pos === 0) return ["tm", "ceo"];
  if (pos === 1) return ["tm"];
  if (pos === 2) return ["payer"];
  return [];
};

const createEmptyItems = () =>
  Array.from({ length: 15 }).map((_, i) => ({
    no: i + 1,
    item_name: "",
    qty: "",
    price: "",
    use_note: "",
    use_name: "",
    link: "",
    note: "",
    buy_yn: "N",
  }));

const createEmptyDraftSheet = () => ({
  title: "",
  detail: "",
  note: "",
  item_name: "",
  content: "",
  qty: "",
  price: "",
  amount: "",
  tax: "",
  total: "",
  place: "",
  use_note: "",
  account_number: "",
  biz_no: "",
  account_name: "",
  payment_type: 2,
  payment_type_detail: "",
  payment_method: "card",
  card_tail: "",
  cash_receipt_text: "",
  transfer_receipt_text: "",
  auto_text: "",
  other_text: "",
  request_dt: "",
  detail_rows: [],
});

const PAYMENT_METHOD_BY_TYPE = Object.freeze({
  1: "cash",
  2: "card",
  3: "transfer",
  4: "auto",
  5: "other",
});

const PAYMENT_TYPE_BY_METHOD = Object.freeze({
  cash: 1,
  card: 2,
  transfer: 3,
  auto: 4,
  other: 5,
});

// 지급구분 DB코드/문자열을 화면 메서드 키로 정규화한다.
function normalizePaymentMethod(typeValue, methodValue) {
  const typeCode = Number(typeValue);
  if (PAYMENT_METHOD_BY_TYPE[typeCode]) return PAYMENT_METHOD_BY_TYPE[typeCode];

  const methodText = String(methodValue ?? "").trim().toLowerCase();
  if (PAYMENT_TYPE_BY_METHOD[methodText]) return methodText;
  return "card";
}

// 지급구분별 상세 문자열을 추출한다.
function resolvePaymentTypeDetailByMethod(method, paymentDoc) {
  const current = paymentDoc || {};
  const explicitDetail = String(current.payment_type_detail ?? "").trim();
  if (method === "card") {
    const currentCardNo = resolveCorporateCardNumber(current.card_tail, explicitDetail);
    if (currentCardNo) return currentCardNo;
  }
  if (explicitDetail) return explicitDetail;

  if (method === "cash") return String(current.cash_receipt_text ?? "").trim();
  if (method === "card") return resolveCorporateCardNumber(current.card_tail);
  if (method === "transfer") return String(current.transfer_receipt_text ?? "").trim();
  if (method === "auto") return String(current.auto_text ?? "").trim();
  if (method === "other") return String(current.other_text ?? "").trim();
  return "";
}

// 시행일자는 기본값을 "현재 + 1일"로 맞춘다.
const getDefaultStartDt = () => dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm:ss");

// 숫자만 남긴 문자열로 정리
function formatDigitsInput(value) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

// 법인카드 번호는 DB 저장 형식에 맞춰 숫자만 유지한다.
function normalizeCorporateCardNumber(value) {
  return formatDigitsInput(value);
}

// 카드번호 후보가 여러 개면 가장 정보가 많은 값(전체번호)을 우선 사용한다.
function resolveCorporateCardNumber(...values) {
  return values.reduce((best, current) => {
    const normalized = normalizeCorporateCardNumber(current);
    return normalized.length > best.length ? normalized : best;
  }, "");
}

// 금액 입력값을 숫자만 남긴 뒤 1,234 형식으로 변환
function formatAmountInput(value) {
  const digits = formatDigitsInput(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function parseAmountNumber(value) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeYn(value) {
  return String(value ?? "").trim().toUpperCase() === "Y";
}

// 지출결의서 합계/공급가액/세액 분리 계산
function splitPaymentDocAmounts(totalValue) {
  const safeTotal = Math.round(Number(totalValue) || 0);
  // 할인(-) 금액은 공급가액/세액 자동 분리를 하지 않고 합계만 반영한다.
  if (safeTotal < 0) {
    return { amount: 0, tax: 0, total: safeTotal };
  }
  const tax = Math.round(safeTotal * 0.1);
  const amount = Math.max(safeTotal - tax, 0);
  return { amount, tax, total: safeTotal };
}

function parseSourcePaymentIds(searchText) {
  const params = new URLSearchParams(searchText || "");
  const raw = String(params.get("source_payment_ids") || "");
  if (!raw) return [];

  const unique = new Set();
  raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .forEach((paymentId) => unique.add(paymentId));

  return Array.from(unique);
}

function uniqueTextList(list) {
  const unique = new Set();
  (Array.isArray(list) ? list : []).forEach((value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    unique.add(text);
  });
  return Array.from(unique);
}

// 지출결의서 기본 지출명 포맷 생성
// - 형식: YYYYMMDD_본사 비품 구매 지출결의서_법인(0000)
function buildDefaultPaymentTitleByDraftDate(draftDateTimeText, cardTailText = "") {
  const dateKey = dayjs(draftDateTimeText).isValid()
    ? dayjs(draftDateTimeText).format("YYYYMMDD")
    : dayjs().format("YYYYMMDD");
  const tail = String(cardTailText ?? "")
    .replace(/[^\d]/g, "")
    .slice(-4)
    .padStart(4, "0");
  return `${dateKey}_본사 비품 구매 지출결의서_법인(${tail})`;
}

export default function ElectronicPaymentSheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const navigate = useNavigate();
  const sourcePaymentIds = useMemo(() => parseSourcePaymentIds(location.search), [location.search]);
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || "").trim(), []);
  const loginDepartment = useMemo(() => String(localStorage.getItem("department") || "").trim(), []);

  const { docTypeList, loading, fetchDepartments, fetchUsersByDepartment, fetchCompanyTree } =
    useElectronicPaymentSheetData();
  const defaultPaymentDocType = useMemo(
    () => resolveDefaultPaymentDocType(docTypeList),
    [docTypeList]
  );

  const [docType, setDocType] = useState("");
  const [selectedLargeType, setSelectedLargeType] = useState("");
  const [selectedMiddleType, setSelectedMiddleType] = useState("");
  const currentDocTypeKey = useMemo(() => toDocTypeKey(docType), [docType]);
  const currentDocKind = useMemo(
    () => getDocKindByType(currentDocTypeKey, docTypeList),
    [currentDocTypeKey, docTypeList]
  );
  const isCurrentExpendableDoc = currentDocKind === DOC_KIND.EXPENDABLE;
  const prevDocTypeKeyRef = useRef("");
  const appliedSourceImportKeyRef = useRef("");
  const linkedImportHydratedRef = useRef(false);
  const docTypeLoadingTimerRef = useRef(null);
  const docTypeLoadingRafRef = useRef([]);
  const selectedDocMeta = useMemo(
    () => (docTypeList || []).find((d) => toDocTypeKey(d.doc_type) === currentDocTypeKey),
    [docTypeList, currentDocTypeKey]
  );
  const isCurrentDefaultPayerDoc = useMemo(
    () => isDefaultPayerDocTypeRow(selectedDocMeta),
    [selectedDocMeta]
  );
  const largeTypeOptions = useMemo(
    () => uniqueTextList((docTypeList || []).map((row) => row?.large_type)),
    [docTypeList]
  );
  const middleTypeOptions = useMemo(() => {
    if (!selectedLargeType) return [];
    return uniqueTextList(
      (docTypeList || [])
        .filter((row) => String(row?.large_type ?? "").trim() === selectedLargeType)
        .map((row) => row?.middle_type)
    );
  }, [docTypeList, selectedLargeType]);
  const smallTypeOptions = useMemo(() => {
    if (!selectedLargeType || !selectedMiddleType) return [];
    return (docTypeList || []).filter(
      (row) =>
        String(row?.large_type ?? "").trim() === selectedLargeType &&
        String(row?.middle_type ?? "").trim() === selectedMiddleType
    );
  }, [docTypeList, selectedLargeType, selectedMiddleType]);
  const requiredRoles = useMemo(() => {
    // 소모품 구매 품의서는 결재자 1명(고정)만 사용한다.
    if (isCurrentExpendableDoc) return ["payer"];
    return getRequiredRoles(Number(selectedDocMeta?.approval_position ?? selectedDocMeta?.position ?? -1));
  }, [isCurrentExpendableDoc, selectedDocMeta]);
  const inputStyle = useMemo(() => inputSx(isMobile), [isMobile]);
  const gridInputStyle = useMemo(() => gridInputSx(isMobile), [isMobile]);

  // ✅ 부서/작성자
  const [department, setDepartment] = useState("");
  const [departmentList, setDepartmentList] = useState([]);
  const [writerId, setWriterId] = useState("");
  const [writerList, setWriterList] = useState([]);

  const writerName = useMemo(() => {
    const u = (writerList || []).find((x) => String(x.user_id) === String(writerId));
    return u?.user_name || "";
  }, [writerList, writerId]);

  // ✅ 기안일자
  const [draftDt, setDraftDt] = useState(() => dayjs().format("YYYY-MM-DDTHH:mm:ss"));
  const [startDt, setStartDt] = useState(getDefaultStartDt);

  // ✅ 요청사유
  const [paymentNote, setPaymentNote] = useState("");
  const paymentNoteBufferRef = useRef(paymentNote);
  const [retentionDt, setRetentionDt] = useState(DEFAULT_RETENTION_DT);
  const [accessLevel, setAccessLevel] = useState(DEFAULT_ACCESS_LEVEL);

  // ✅ 품목내역
  const [items, setItems] = useState(createEmptyItems);
  const itemsBufferRef = useRef(items);
  const [draftSheet, setDraftSheet] = useState(createEmptyDraftSheet);
  const draftSheetBufferRef = useRef(draftSheet);
  const [paymentDocImages, setPaymentDocImages] = useState([]);
  const [paymentDocPendingFiles, setPaymentDocPendingFiles] = useState([]);
  const [paymentDocDeletedImages, setPaymentDocDeletedImages] = useState([]);
  const paymentDocPendingFilesRef = useRef([]);

  useEffect(() => {
    itemsBufferRef.current = items;
  }, [items]);

  useEffect(() => {
    draftSheetBufferRef.current = draftSheet;
  }, [draftSheet]);

  useEffect(() => {
    paymentDocPendingFilesRef.current = paymentDocPendingFiles;
  }, [paymentDocPendingFiles]);

  useEffect(() => {
    paymentNoteBufferRef.current = paymentNote;
  }, [paymentNote]);

  const onItemsBufferChange = useCallback((nextItems) => {
    itemsBufferRef.current = nextItems;
  }, []);

  const onDraftSheetBufferChange = useCallback((nextDraftSheet) => {
    draftSheetBufferRef.current = nextDraftSheet;
  }, []);

  const onPaymentNoteBufferChange = useCallback((nextPaymentNote) => {
    paymentNoteBufferRef.current = String(nextPaymentNote ?? "");
  }, []);

  useEffect(() => {
    if (!selectedDocMeta) return;

    const nextLargeType = String(selectedDocMeta.large_type ?? "").trim();
    const nextMiddleType = String(selectedDocMeta.middle_type ?? "").trim();

    setSelectedLargeType((prev) => (prev === nextLargeType ? prev : nextLargeType));
    setSelectedMiddleType((prev) => (prev === nextMiddleType ? prev : nextMiddleType));
  }, [selectedDocMeta]);

  const onSelectPaymentDocFiles = useCallback(
    (fileList) => {
      // 첨부파일 선택 시점에는 DB/파일서버 저장을 절대 하지 않는다.
      // - 여기서는 브라우저 메모리(pendingFiles)만 갱신
      // - 실제 저장(image_order 포함)은 하단 handleSave 상신 성공 후 1회 처리
      const result = preparePendingDocumentImageFiles({
        fileList,
        existingImages: paymentDocImages,
        deletedImages: paymentDocDeletedImages,
        pendingFiles: paymentDocPendingFiles,
      });

      if (result.status === "limit") {
        Swal.fire("첨부 파일은 최대 10개까지 등록 가능합니다.", "", "warning");
        return;
      }
      if (result.status === "empty") return;
      if (result.status === "unsupported") {
        Swal.fire(
          "지원하지 않는 파일 형식",
          "이미지, PDF, Excel(xls/xlsx) 파일만 첨부할 수 있습니다.",
          "warning"
        );
        return;
      }
      if (result.status === "partial") {
        const ignoredTypeText =
          Number(result?.ignoredTypeCount || 0) > 0
            ? ` 지원 형식이 아닌 ${result.ignoredTypeCount}개 파일은 제외되었습니다.`
            : "";
        Swal.fire(
          "첨부 파일 개수 제한",
          `최대 ${MAX_HEADOFFICE_DOCUMENT_IMAGE_COUNT}개까지 등록 가능하여 ${result.addedCount}개만 추가되었습니다.${ignoredTypeText}`,
          "info"
        );
      } else if (Number(result?.ignoredTypeCount || 0) > 0) {
        Swal.fire(
          "일부 파일 제외",
          `지원하지 않는 형식 ${result.ignoredTypeCount}개 파일은 제외되었습니다.`,
          "info"
        );
      }
      setPaymentDocPendingFiles(result.nextPendingFiles);
    },
    [paymentDocDeletedImages, paymentDocImages, paymentDocPendingFiles]
  );

  const onTogglePaymentDocDeletedImage = useCallback((image) => {
    setPaymentDocDeletedImages((prev) => toggleDeletedDocumentImage(prev, image));
  }, []);

  const onRemovePendingPaymentDocFile = useCallback((pendingIndex) => {
    setPaymentDocPendingFiles((prev) => removePendingDocumentImageAt(prev, pendingIndex));
  }, []);

  const revokePendingPaymentDocFiles = useCallback((pendingFiles) => {
    revokePendingDocumentImageUrls(pendingFiles);
  }, []);

  const resetPaymentDocAttachments = useCallback(() => {
    revokePendingPaymentDocFiles(paymentDocPendingFilesRef.current);
    setPaymentDocImages([]);
    setPaymentDocPendingFiles([]);
    setPaymentDocDeletedImages([]);
    paymentDocPendingFilesRef.current = [];
  }, [revokePendingPaymentDocFiles]);

  // 문서선택 변경 시 본문 입력 버퍼 초기화
  const resetDocumentBufferOnDocTypeChange = useCallback(() => {
    const emptyItems = createEmptyItems();
    const emptyDraftSheet = createEmptyDraftSheet();
    setItems(emptyItems);
    itemsBufferRef.current = emptyItems;
    setDraftSheet(emptyDraftSheet);
    draftSheetBufferRef.current = emptyDraftSheet;
    setPaymentNote("");
    paymentNoteBufferRef.current = "";
    resetPaymentDocAttachments();
    appliedSourceImportKeyRef.current = "";
    linkedImportHydratedRef.current = false;
  }, [resetPaymentDocAttachments]);

  const closeDocTypeLoadingPopup = useCallback(() => {
    if (docTypeLoadingTimerRef.current) {
      clearTimeout(docTypeLoadingTimerRef.current);
      docTypeLoadingTimerRef.current = null;
    }
    (docTypeLoadingRafRef.current || []).forEach((id) => cancelAnimationFrame(id));
    docTypeLoadingRafRef.current = [];
    Swal.close();
  }, []);

  const onChangeDocType = useCallback(
    (nextDocTypeRaw) => {
      const nextDocType = toDocTypeKey(nextDocTypeRaw);
      if (nextDocType === currentDocTypeKey) return;
      const loadingStartedAt = performance.now();

      closeDocTypeLoadingPopup();
      Swal.fire({
        title: "불러오는 중",
        text: "문서 화면을 준비하고 있습니다.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const prePaintRaf = requestAnimationFrame(() => {
        // Swal 팝업이 최소 1프레임은 보이도록 보장한 뒤 문서 타입 렌더를 시작한다.
        const paintRaf = requestAnimationFrame(() => {
          setDocType(nextDocType);

          const afterRenderRaf1 = requestAnimationFrame(() => {
            const afterRenderRaf2 = requestAnimationFrame(() => {
              const elapsed = performance.now() - loadingStartedAt;
              const remain = Math.max(MIN_DOC_TYPE_LOADING_MS - elapsed, 0);
              docTypeLoadingTimerRef.current = setTimeout(() => {
                closeDocTypeLoadingPopup();
              }, remain);
            });
            docTypeLoadingRafRef.current.push(afterRenderRaf2);
          });
          docTypeLoadingRafRef.current.push(afterRenderRaf1);
        });
        docTypeLoadingRafRef.current.push(paintRaf);
      });
      docTypeLoadingRafRef.current.push(prePaintRaf);
    },
    [currentDocTypeKey, closeDocTypeLoadingPopup]
  );

  // 문서선택 드롭다운 수동 변경 처리
  const onChangeDocTypeBySelect = useCallback(
    (nextDocTypeRaw) => {
      const nextDocType = toDocTypeKey(nextDocTypeRaw);
      if (!nextDocType || nextDocType === currentDocTypeKey) return;
      const keepLinkedImportedData =
        linkedImportHydratedRef.current &&
        isPaymentDocType(currentDocTypeKey, docTypeList) &&
        isPaymentDocType(nextDocType, docTypeList);
      if (!keepLinkedImportedData) {
        resetDocumentBufferOnDocTypeChange();
      }
      onChangeDocType(nextDocType);
    },
    [currentDocTypeKey, docTypeList, onChangeDocType, resetDocumentBufferOnDocTypeChange]
  );

  const onChangeLargeType = useCallback(
    (nextLargeTypeRaw) => {
      const nextLargeType = String(nextLargeTypeRaw ?? "").trim();
      if (nextLargeType === selectedLargeType) return;

      closeDocTypeLoadingPopup();
      setSelectedLargeType(nextLargeType);
      setSelectedMiddleType("");
      setDocType("");
      resetDocumentBufferOnDocTypeChange();
    },
    [closeDocTypeLoadingPopup, resetDocumentBufferOnDocTypeChange, selectedLargeType]
  );

  const onChangeMiddleType = useCallback(
    (nextMiddleTypeRaw) => {
      const nextMiddleType = String(nextMiddleTypeRaw ?? "").trim();
      if (nextMiddleType === selectedMiddleType) return;

      closeDocTypeLoadingPopup();
      setSelectedMiddleType(nextMiddleType);
      setDocType("");
      resetDocumentBufferOnDocTypeChange();
    },
    [closeDocTypeLoadingPopup, resetDocumentBufferOnDocTypeChange, selectedMiddleType]
  );

  useEffect(
    () => () => {
      closeDocTypeLoadingPopup();
    },
    [closeDocTypeLoadingPopup]
  );

  useEffect(
    () => () => {
      revokePendingPaymentDocFiles(paymentDocPendingFilesRef.current);
    },
    [revokePendingPaymentDocFiles]
  );

  // 관리 탭 우클릭 액션으로 들어온 문서타입 쿼리(doc_type)를 작성 탭에서 1회 반영한다.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetDocTypeParam = toDocTypeKey(params.get("doc_type"));
    const hasTargetDocTypeInList = (docTypeList || []).some(
      (row) => toDocTypeKey(row?.doc_type) === targetDocTypeParam
    );
    const normalizedTargetDocTypeParam =
      targetDocTypeParam && !hasTargetDocTypeInList && sourcePaymentIds.length > 0
        ? defaultPaymentDocType
        : targetDocTypeParam;
    const targetDocType =
      normalizedTargetDocTypeParam || (sourcePaymentIds.length > 0 ? defaultPaymentDocType : "");
    if (!targetDocType) return;

    onChangeDocType(targetDocType);

    // 한 번 반영한 뒤에는 쿼리를 제거해 수동 변경 시 다시 덮어쓰지 않도록 한다.
    if (targetDocTypeParam) {
      params.delete("doc_type");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true }
      );
    }
  }, [defaultPaymentDocType, docTypeList, location.pathname, location.search, navigate, onChangeDocType, sourcePaymentIds]);

  // 관리 탭에서 전달된 source_payment_ids를 지출결의서(P) 본문으로 자동 매핑한다.
  // - 소모품 구매 품의서 상세의 buy_yn='Y' 항목만 집계
  // - 합계(total)=체크 항목 금액 합
  // - 공급가액(amount)/세액(tax)은 합계를 9:1로 분리해 계산
  useEffect(() => {
    if (!isPaymentDocType(currentDocTypeKey, docTypeList)) return;
    if (sourcePaymentIds.length === 0) return;

    const sourceKey = sourcePaymentIds.join(",");
    if (appliedSourceImportKeyRef.current === sourceKey) return;

    let cancelled = false;

    (async () => {
      const detailResults = await Promise.all(
        sourcePaymentIds.map((paymentId) =>
          api
            .get("/HeadOffice/ElectronicPaymentManageDetail", {
              params: { payment_id: paymentId, user_id: loginUserId },
            })
            .then((res) => res?.data || null)
            .catch(() => null)
        )
      );
      if (cancelled) return;

      const checkedItems = [];
      detailResults.forEach((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        items.forEach((item) => {
          if (!normalizeYn(item?.buy_yn)) return;
          checkedItems.push(item);
        });
      });

      if (checkedItems.length > 0) {
        const mappedDetailRows = checkedItems
          .map((item) => {
            const name = String(item?.item_name ?? "").trim();
            const vendorName = String(item?.use_name ?? "").trim();
            const qty = Math.max(0, Math.round(parseAmountNumber(item?.qty)));
            const rowTotal = parseAmountNumber(item?.price);
            const { amount: rowAmount, tax: rowTax, total: normalizedRowTotal } =
              splitPaymentDocAmounts(rowTotal);
            // 사용자 요청: 세부내역 텍스트와 수량(qty)을 분리해 저장/표시한다.
            const detailText = name;

            if (!detailText) return null;
            return {
              detail_text: detailText,
              qty: qty > 0 ? qty : 1,
              // 소모품 연결 시 결제업체명도 세부내역 행 단위로 함께 가져온다.
              use_note: vendorName,
              amount: rowAmount,
              tax: rowTax,
              total: normalizedRowTotal,
            };
          })
          .filter(Boolean);

        const amount = mappedDetailRows.reduce((acc, row) => acc + parseAmountNumber(row?.amount), 0);
        const tax = mappedDetailRows.reduce((acc, row) => acc + parseAmountNumber(row?.tax), 0);
        const total = mappedDetailRows.reduce((acc, row) => acc + parseAmountNumber(row?.total), 0);
        const purposeText = uniqueTextList(checkedItems.map((item) => item?.use_note)).join(", ");
        const vendorText = uniqueTextList(checkedItems.map((item) => item?.use_name)).join(", ");
        const detailText = mappedDetailRows
          .map((row) => String(row?.detail_text ?? "").trim())
          .filter((text) => !!text)
          .join("\n");

        const nextDraftSheet = {
          // 요구사항: 지출명은 "기안일자_본사 비품 구매 지출결의서_법인(0000)" 기본 포맷 사용
          // - 카드 뒷자리가 이미 선택되어 있으면 해당 값을 우선 반영
          title: buildDefaultPaymentTitleByDraftDate(
            draftDt,
            String(draftSheetBufferRef.current?.card_tail ?? "")
          ),
          item_name: purposeText,
          content: detailText,
          qty: "",
          amount: amount !== 0 ? amount.toLocaleString("ko-KR") : "",
          tax: tax !== 0 ? tax.toLocaleString("ko-KR") : "",
          total: total !== 0 ? total.toLocaleString("ko-KR") : "",
          use_note: vendorText,
          detail_rows: mappedDetailRows,
        };

        setDraftSheet((prev) => ({ ...prev, ...nextDraftSheet }));
        draftSheetBufferRef.current = { ...draftSheetBufferRef.current, ...nextDraftSheet };
        linkedImportHydratedRef.current = true;
      }

      appliedSourceImportKeyRef.current = sourceKey;

      const params = new URLSearchParams(location.search);
      if (!params.get("source_payment_ids")) return;
      params.delete("source_payment_ids");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [currentDocTypeKey, docTypeList, sourcePaymentIds, loginUserId, draftDt, location.pathname, location.search, navigate]);

  // 지출결의서 기본 진입 시 지출명 초기화
  useEffect(() => {
    const prevDocTypeKey = prevDocTypeKeyRef.current;
    prevDocTypeKeyRef.current = currentDocTypeKey;

    if (!isPaymentDocType(currentDocTypeKey, docTypeList)) return;
    if (isPaymentDocType(prevDocTypeKey, docTypeList)) return;
    if (sourcePaymentIds.length > 0) return;

    setDraftSheet((prev) => {
      if (!String(prev?.title ?? "").trim()) return prev;
      return { ...prev, title: "" };
    });
  }, [currentDocTypeKey, docTypeList, sourcePaymentIds]);

  // ✅ 결재라인(실제 값은 user_id)
  const [approvalLine, setApprovalLine] = useState({
    tm_user: "",
    tm_user_name: "",
    payer_user: "",
    payer_user_name: "",
    ceo_user: "",
    ceo_user_name: "",
  });
  const [payerLineAdded, setPayerLineAdded] = useState(false);
  const payerRequiredByDocType = requiredRoles.includes("payer");
  const needPayerStep = payerRequiredByDocType || payerLineAdded;
  const requestDateKey = useMemo(() => resolveRequestNoDateKey(draftDt), [draftDt]);
  const [requestNo, setRequestNo] = useState("");

  // 같은 문서타입과 같은 기안일자의 기존 문서 수를 세어 마지막 3자리 순번을 만든다.
  const fetchNextRequestNo = useCallback(
    async (targetDocTypeKey, targetDraftDt) => {
      const safeDocTypeKey = toDocTypeKey(targetDocTypeKey);
      const safeRequestDateKey = resolveRequestNoDateKey(targetDraftDt);
      const fallbackRequestNo = buildRequestNo(safeDocTypeKey, targetDraftDt, 1);
      if (!safeDocTypeKey) return "";

      const lookupUserId = String(loginUserId || writerId || "").trim();
      if (!lookupUserId) return fallbackRequestNo;

      try {
        const res = await api.get("/HeadOffice/ElectronicPaymentManageList", {
          params: { user_id: lookupUserId },
        });
        const rows = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.list) ? res.data.list : [];

        const nextSequence =
          (rows || []).filter(
            (row) =>
              toDocTypeKey(row?.doc_type) === safeDocTypeKey &&
              isSameRequestNoDate(row?.draft_dt, safeRequestDateKey)
          ).length + 1;

        return buildRequestNo(safeDocTypeKey, targetDraftDt, nextSequence);
      } catch (err) {
        console.error("문서번호 순번 조회 실패:", err);
        return fallbackRequestNo;
      }
    },
    [loginUserId, writerId]
  );

  useEffect(() => {
    const fallbackRequestNo = buildRequestNo(currentDocTypeKey, draftDt, 1);
    setRequestNo(fallbackRequestNo);

    if (!currentDocTypeKey || !requestDateKey) return;

    let cancelled = false;

    (async () => {
      const nextRequestNo = await fetchNextRequestNo(currentDocTypeKey, draftDt);
      if (cancelled) return;
      setRequestNo(nextRequestNo || fallbackRequestNo);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentDocTypeKey, requestDateKey, draftDt, fetchNextRequestNo]);

  // ✅ 부서 목록 로드
  useEffect(() => {
    (async () => {
      const deps = await fetchDepartments();
      setDepartmentList(deps || []);

      if (loginDepartment) {
        const matched = (deps || []).find(
          (d) => String(d?.department ?? "").trim() === String(loginDepartment)
        );
        if (matched) {
          setDepartment((prev) => (String(prev || "").trim() ? prev : String(matched.department)));
          return;
        }
      }

      if (!loginUserId) return;

      // 로그인 사용자 ID로 소속 부서를 역탐색한다.
      for (const dep of deps || []) {
        const depCode = String(dep?.department ?? "").trim();
        if (!depCode) continue;
        // eslint-disable-next-line no-await-in-loop
        const users = await fetchUsersByDepartment(depCode);
        const isMine = (users || []).some((u) => String(u.user_id) === String(loginUserId));
        if (isMine) {
          setDepartment((prev) => (String(prev || "").trim() ? prev : depCode));
          return;
        }
      }
    })();
  }, [fetchDepartments, fetchUsersByDepartment, loginDepartment, loginUserId]);

  // 선택한 부서 기준으로 작성자 목록과 팀장 결재선을 동기화한다.
  const syncDepartmentUsers = useCallback(
    async (targetDepartment) => {
      if (!targetDepartment) {
        setWriterList([]);
        setWriterId("");
        setApprovalLine((prev) => ({
          ...prev,
          tm_user: "",
          tm_user_name: "",
        }));
        return;
      }

      const users = await fetchUsersByDepartment(targetDepartment);
      setWriterList(users || []);

      // 작성자 자동 선택: 로그인 사용자 우선, 없으면 첫번째
      const loginWriter = (users || []).find((u) => String(u.user_id) === String(loginUserId));
      if (loginWriter?.user_id) {
        setWriterId(String(loginWriter.user_id));
      } else if ((users || []).length > 0) {
        setWriterId(String(users[0].user_id));
      } else {
        setWriterId("");
      }

      // 부서 내 position==1 사용자를 팀장 결재선으로 자동 반영한다.
      const tm = (users || []).find((u) => Number(u.position) === 1);
      if (tm) {
        setApprovalLine((prev) => ({
          ...prev,
          tm_user: String(tm.user_id),
          tm_user_name: String(tm.user_name),
        }));
      } else {
        setApprovalLine((prev) => ({ ...prev, tm_user: "", tm_user_name: "" }));
      }
    },
    [fetchUsersByDepartment, loginUserId]
  );

  // ✅ 부서가 바뀌면 작성자 목록 로드 + tm_user 자동 설정(부서의 position==1인 사람)
  useEffect(() => {
    void syncDepartmentUsers(department);
  }, [department, syncDepartmentUsers]);

  // ✅ docType이 position==0(대표 필요)이면 ceo 자동 세팅(회사 트리에서 position==0 찾기)
  useEffect(() => {
    (async () => {
      const needCeo = requiredRoles.includes("ceo");
      if (!needCeo) {
        // 대표 필요 없으면 값 비움
        setApprovalLine((prev) => ({ ...prev, ceo_user: "", ceo_user_name: "" }));
        return;
      }

      // 이미 들어있으면 유지
      if (approvalLine.ceo_user) return;

      const tree = await fetchCompanyTree();
      let found = null;

      for (const dept of tree || []) {
        const users = dept.users || dept.user_list || [];
        const ceo = (users || []).find((u) => Number(u.position ?? u.pos ?? 99) === 0);
        if (ceo) {
          found = {
            user_id: String(ceo.user_id ?? ceo.id ?? ""),
            user_name: String(ceo.user_name ?? ceo.name ?? ""),
          };
          break;
        }
      }

      if (found?.user_id) {
        setApprovalLine((prev) => ({
          ...prev,
          ceo_user: found.user_id,
          ceo_user_name: found.user_name,
        }));
      }
    })();
  }, [requiredRoles, fetchCompanyTree, approvalLine.ceo_user]);

  // 문서 타입이 바뀌면 결재자 추가 상태를 기본값으로 되돌린다.
  // - 기본 규칙은 type.approval_position 기준
  // - 결재자(payer)는 "결재라인 추가" 시에만 선택적으로 활성화
  useEffect(() => {
    if (isCurrentExpendableDoc) {
      // 소모품 구매 품의서는 결재자 1명 고정(iy1) 정책을 강제한다.
      setPayerLineAdded(true);
      setApprovalLine((prev) => ({
        ...prev,
        tm_user: "",
        tm_user_name: "",
        payer_user: EXPENDABLE_FIXED_PAYER_USER_ID,
        payer_user_name: prev.payer_user_name || EXPENDABLE_FIXED_PAYER_USER_ID,
        ceo_user: "",
        ceo_user_name: "",
      }));

      (async () => {
        const tree = await fetchCompanyTree();
        let fixedPayerName = "";
        for (const dept of tree || []) {
          const users = dept.users || dept.user_list || [];
          const found = (users || []).find(
            (u) => String(u.user_id ?? u.id ?? "") === EXPENDABLE_FIXED_PAYER_USER_ID
          );
          if (found) {
            fixedPayerName = String(found.user_name ?? found.name ?? "").trim();
            break;
          }
        }
        if (!fixedPayerName) return;

        setApprovalLine((prev) => {
          if (prev.payer_user !== EXPENDABLE_FIXED_PAYER_USER_ID) return prev;
          if (prev.payer_user_name === fixedPayerName) return prev;
          return { ...prev, payer_user_name: fixedPayerName };
        });
      })();
      return;
    }

    if (isCurrentDefaultPayerDoc) {
      setPayerLineAdded(false);
      setApprovalLine((prev) => ({
        ...prev,
        payer_user: DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT,
        payer_user_name:
          prev.payer_user === DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT &&
            prev.payer_user_name
            ? prev.payer_user_name
            : DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT,
      }));

      (async () => {
        const tree = await fetchCompanyTree();
        let defaultPayerName = "";
        for (const dept of tree || []) {
          const users = dept.users || dept.user_list || [];
          const found = (users || []).find(
            (u) =>
              String(u.user_id ?? u.id ?? "") === DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT
          );
          if (found) {
            defaultPayerName = String(found.user_name ?? found.name ?? "").trim();
            break;
          }
        }
        if (!defaultPayerName) return;

        setApprovalLine((prev) => {
          if (prev.payer_user !== DEFAULT_PAYER_USER_ID_FOR_EXPENDABLE_PAYMENT) return prev;
          if (prev.payer_user_name === defaultPayerName) return prev;
          return { ...prev, payer_user_name: defaultPayerName };
        });
      })();
      return;
    }

    setPayerLineAdded(false);
    setApprovalLine((prev) => {
      if (!prev.payer_user && !prev.payer_user_name) return prev;
      return { ...prev, payer_user: "", payer_user_name: "" };
    });
  }, [isCurrentExpendableDoc, isCurrentDefaultPayerDoc, fetchCompanyTree]);

  const onChangeItem = useCallback((idx, key, value) => {
    let nextValue = value;
    if (key === "price") nextValue = formatAmountInput(value);
    if (key === "qty") nextValue = formatDigitsInput(value);

    setItems((prev) => {
      const currentRow = prev[idx];
      if (!currentRow || currentRow[key] === nextValue) return prev;

      const next = [...prev];
      next[idx] = { ...currentRow, [key]: nextValue };
      return next;
    });
  }, []);

  const openLink = useCallback((url) => {
    if (!url) return;
    const trimmed = String(url).trim();
    if (!trimmed) return;

    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;

    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, []);

  // ✅ 결재라인 추가 모달(결재자 선택)
  const [openLineModal, setOpenLineModal] = useState(false);
  const [companyTree, setCompanyTree] = useState([]);
  const [selectedPayer, setSelectedPayer] = useState({ user_id: "", user_name: "", dept: "" });

  const openApprovalModal = async () => {
    if (!docType) {
      Swal.fire({ title: "확인", text: "소분류를 먼저 선택해주세요.", icon: "info" });
      return;
    }
    if (isCurrentExpendableDoc) {
      Swal.fire({
        title: "안내",
        text: "소모품 구매 품의서는 결재자(iy1) 1명 고정 문서입니다.",
        icon: "info",
      });
      return;
    }

    const tree = await fetchCompanyTree();
    setCompanyTree(tree || []);
    setSelectedPayer({
      user_id: approvalLine.payer_user || "",
      user_name: approvalLine.payer_user_name || "",
      dept: "",
    });
    setOpenLineModal(true);
  };

  const saveApprovalLine = () => {
    if (!selectedPayer.user_id) {
      Swal.fire({ title: "확인", text: "결재자를 선택해주세요.", icon: "warning" });
      return;
    }

    setApprovalLine((prev) => ({
      ...prev,
      payer_user: String(selectedPayer.user_id),
      payer_user_name: String(selectedPayer.user_name),
    }));
    setPayerLineAdded(true);
    setOpenLineModal(false);
  };

  // 저장 완료 후 초기 화면(대분류/중분류/소분류 선택)으로 복귀
  const resetToDocTypeSelect = useCallback(() => {
    const emptyItems = createEmptyItems();
    const emptyDraftSheet = createEmptyDraftSheet();
    const nextDepartment = loginDepartment || "";
    setDocType("");
    setSelectedLargeType("");
    setSelectedMiddleType("");
    setDepartment(nextDepartment);
    setWriterId(loginUserId || "");
    setWriterList([]);
    setDraftDt(dayjs().format("YYYY-MM-DDTHH:mm:ss"));
    setStartDt(getDefaultStartDt());
    setPaymentNote("");
    paymentNoteBufferRef.current = "";
    setRetentionDt(DEFAULT_RETENTION_DT);
    setAccessLevel(DEFAULT_ACCESS_LEVEL);
    setItems(emptyItems);
    itemsBufferRef.current = emptyItems;
    setDraftSheet(emptyDraftSheet);
    draftSheetBufferRef.current = emptyDraftSheet;
    setApprovalLine({
      tm_user: "",
      tm_user_name: "",
      payer_user: "",
      payer_user_name: "",
      ceo_user: "",
      ceo_user_name: "",
    });
    setCompanyTree([]);
    setSelectedPayer({ user_id: "", user_name: "", dept: "" });
    setPayerLineAdded(false);
    setOpenLineModal(false);
    resetPaymentDocAttachments();
    if (nextDepartment) {
      void syncDepartmentUsers(nextDepartment);
    }
  }, [loginDepartment, loginUserId, resetPaymentDocAttachments, syncDepartmentUsers]);

  // ✅ 상신 payload: main / item 분리
  const handleSave = async () => {
    if (!docType) {
      Swal.fire({ title: "확인", text: "소분류까지 선택해주세요.", icon: "warning" });
      return;
    }
    if (!department) {
      Swal.fire({ title: "확인", text: "부서를 선택해주세요.", icon: "warning" });
      return;
    }
    if (!writerId) {
      Swal.fire({ title: "확인", text: "작성자를 선택해주세요.", icon: "warning" });
      return;
    }

    const docTypeKey = toDocTypeKey(docType);
    const isExpendableDoc = isDocKind(docTypeKey, docTypeList, DOC_KIND.EXPENDABLE);
    // 소모품(E)은 결재자 고정값을 우선 사용하고, 그 외 문서는 사용자가 선택한 결재자를 사용한다.
    const resolvedPayerUser = isExpendableDoc
      ? EXPENDABLE_FIXED_PAYER_USER_ID
      : String(approvalLine.payer_user || "").trim();

    // ✅ 필요한 결재라인 존재 체크
    if (requiredRoles.includes("tm") && !approvalLine.tm_user) {
      Swal.fire({
        title: "확인",
        text: "부서 팀장이 자동 지정되지 않았습니다.",
        icon: "warning",
      });
      return;
    }
    if (needPayerStep && !resolvedPayerUser) {
      Swal.fire({
        title: "확인",
        text: "결재라인 추가에서 결재자를 지정해주세요.",
        icon: "warning",
      });
      return;
    }
    if (requiredRoles.includes("ceo") && !approvalLine.ceo_user) {
      Swal.fire({
        title: "확인",
        text: "대표가 자동 지정되지 않았습니다.",
        icon: "warning",
      });
      return;
    }

    const submitConfirm = await Swal.fire({
      title: "상신하시겠습니까?",
      text: "상신 후에는 내용을 수정하기 어렵습니다.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "상신",
      cancelButtonText: "취소",
      confirmButtonColor: "#1f4e79",
    });
    if (!submitConfirm.isConfirmed) return;

    const resolvedRequestNo =
      (await fetchNextRequestNo(docTypeKey, draftDt)) || buildRequestNo(docTypeKey, draftDt, 1);
    setRequestNo(resolvedRequestNo);

    const clean = (v) => String(v ?? "").trim();
    const currentPaymentNoteClean = clean(paymentNoteBufferRef.current ?? "");
    const toIntOrNull = (v) => {
      const raw = String(v ?? "").replace(/,/g, "").trim();
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    let filteredItems = [];

    if (isDocKind(docTypeKey, docTypeList, DOC_KIND.DRAFT)) {
      const currentDraftSheet = draftSheetBufferRef.current || draftSheet;
      const draftTitle = clean(currentDraftSheet.title);
      const draftDetail = clean(currentDraftSheet.detail);
      const draftNote = clean(currentDraftSheet.note);
      const hasDraftContent = [draftTitle, draftDetail, draftNote].some((v) => v !== "");

      if (!hasDraftContent) {
        Swal.fire({
          title: "확인",
          text: "기안서 내용을 입력해주세요.",
          icon: "warning",
        });
        return;
      }

      filteredItems = [
        {
          no: 1,
          title: draftTitle,
          details: draftDetail,
          note: draftNote,
        },
      ];
    } else if (isPaymentDocType(docTypeKey, docTypeList)) {
      const currentPaymentDoc = draftSheetBufferRef.current || draftSheet;
      const paymentTitle = clean(currentPaymentDoc.title);
      // 지출결의서 컬럼 매핑 (tb_headoffice_payment_doc 기준)
      // - place     : 현장
      // - use_name  : 용도
      // - use_note  : 결제업체명
      // - item_name : 세부내역(행 단위)
      const paymentUseName = clean(currentPaymentDoc.item_name);
      // 현장은 기본값 본사를 강제하지 않고 사용자가 입력한 값만 저장한다.
      const paymentPlace = clean(currentPaymentDoc.place);
      const paymentContent = clean(currentPaymentDoc.content);
      const paymentVendorName = clean(currentPaymentDoc.use_note);
      const paymentAccountNumber = clean(currentPaymentDoc.account_number);
      const paymentBizNo = clean(currentPaymentDoc.biz_no);
      const paymentDepositorName = clean(currentPaymentDoc.account_name);
      const paymentMethod = normalizePaymentMethod(
        currentPaymentDoc.payment_type,
        currentPaymentDoc.payment_method
      );
      const paymentType = Number(currentPaymentDoc.payment_type) || PAYMENT_TYPE_BY_METHOD[paymentMethod] || 2;
      const paymentTypeDetail = resolvePaymentTypeDetailByMethod(paymentMethod, currentPaymentDoc);
      const requestDt = clean(currentPaymentDoc.request_dt) || dayjs(startDt).format("YYYY-MM-DD");
      const detailRows = Array.isArray(currentPaymentDoc.detail_rows)
        ? currentPaymentDoc.detail_rows
        : [];

      const qty = toIntOrNull(currentPaymentDoc.qty) ?? 0;
      const price = toIntOrNull(currentPaymentDoc.price) ?? 0;
      const amountInput = toIntOrNull(currentPaymentDoc.amount);
      const taxInput = toIntOrNull(currentPaymentDoc.tax);
      const computedAmount = amountInput ?? qty * price;
      const computedTax = taxInput ?? 0;
      const totalInput = toIntOrNull(currentPaymentDoc.total);
      const computedTotal = totalInput ?? computedAmount + computedTax;

      const hasDetailText = detailRows.some((row) => clean(row?.detail_text || row?.item_name) !== "");
      const hasPaymentDocContent = [paymentTitle, paymentUseName, paymentContent, paymentVendorName].some(
        (v) => v !== ""
      ) || hasDetailText;

      if (!hasPaymentDocContent) {
        Swal.fire({
          title: "확인",
          text: "지출결의서 내용을 입력해주세요.",
          icon: "warning",
        });
        return;
      }

      // 지출결의서는 payment_id 1건에 detail 행(item_name) 여러 건으로 저장한다.
      // - item_name: 세부내역 텍스트
      // - qty/price: 행 단위 값 (qty는 화면 입력값을 그대로, price는 행 합계)
      // - total: 문서 전체 합계(모든 행에 동일하게 저장)
      const normalizedDetailRows =
        detailRows.length > 0
          ? detailRows
          : [{ detail_text: paymentContent, qty: 1, amount: computedAmount, tax: computedTax, total: computedTotal }];

      filteredItems = normalizedDetailRows
        .map((row, rowIndex) => {
          const detailText = clean(row?.detail_text || row?.item_name);
          if (!detailText) return null;

          const rowAmount = toIntOrNull(row?.amount) ?? 0;
          const rowTax = toIntOrNull(row?.tax) ?? 0;
          const rowTotal = toIntOrNull(row?.total) ?? toIntOrNull(row?.price) ?? rowAmount + rowTax;
          const rowQtyRaw = toIntOrNull(row?.qty);
          const rowQty = rowQtyRaw && rowQtyRaw > 0 ? rowQtyRaw : 1;
          const rowVendorName = clean(row?.use_note || paymentVendorName);
          // 세부내역 합계는 음수도 허용하므로 price에도 그대로 반영한다.
          const rowPrice = rowTotal;

          return {
            no: rowIndex + 1,
            title: paymentTitle,
            place: paymentPlace,
            use_name: paymentUseName,
            // 결제업체명은 문서 공통값이 있더라도 세부내역 행 값이 있으면 우선 저장한다.
            use_note: rowVendorName,
            item_name: detailText,
            qty: rowQty,
            price: rowPrice,
            amount: rowAmount,
            tax: rowTax,
            total: computedTotal,
            content: paymentContent,
            account_number: paymentAccountNumber,
            biz_no: paymentBizNo,
            // tb_headoffice_payment_doc.account_name 은 예금주 용도로 저장
            account_name: paymentDepositorName || rowVendorName || paymentVendorName,
            payment_type: paymentType,
            payment_type_detail: paymentTypeDetail,
            request_dt: requestDt,
          };
        })
        .filter(Boolean);
    } else {
      const currentItems = itemsBufferRef.current || items;
      filteredItems = (currentItems || [])
        .map((r) => ({
          no: r.no,
          item_name: clean(r.item_name),
          qty: toIntOrNull(r.qty),
          price: toIntOrNull(r.price),
          use_note: clean(r.use_note),
          use_name: clean(r.use_name),
          link: clean(r.link),
          note: clean(r.note),
          buy_yn: clean(r.buy_yn).toUpperCase() === "Y" ? "Y" : "N",
          payment_note: currentPaymentNoteClean,
        }))
        .filter((r) => r.item_name !== "");
    }

    const payload = {
      main: {
        // 문서타입 테이블의 doc_type 값을 그대로 저장한다.
        doc_type: docTypeKey,
        // 전자결재 메인 테이블 payment_id에 문서번호 형식을 그대로 사용한다.
        payment_id: resolvedRequestNo,

        department,
        user_id: writerId, // 작성자 user_id
        draft_dt: dayjs(draftDt).format("YYYY-MM-DD HH:mm:ss"),
        start_dt: dayjs(startDt).format("YYYY-MM-DD HH:mm:ss"),
        retention_dt: Number(retentionDt),
        access_level: Number(accessLevel),

        // ✅ 결재라인(실제 값 user_id)
        tm_user: isExpendableDoc ? "" : requiredRoles.includes("tm") ? approvalLine.tm_user : "",
        payer_user: needPayerStep ? resolvedPayerUser : "",
        ceo_user: isExpendableDoc ? "" : requiredRoles.includes("ceo") ? approvalLine.ceo_user : "",

        // 작성자(user_id)와 등록자(reg_user_id)를 동일하게 저장
        reg_user_id: writerId,
      },
      item: filteredItems,
    };

    const deletedImagesToApply = Array.isArray(paymentDocDeletedImages)
      ? paymentDocDeletedImages
      : [];
    const pendingFilesToUpload = Array.isArray(paymentDocPendingFiles) ? paymentDocPendingFiles : [];

    try {
      await api.post("/HeadOffice/ElectronicPaymentSave", payload);
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: err?.message || "상신 중 오류 발생",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      return;
    }

    if (resolvedRequestNo) {
      try {
        // 문서 메인/아이템 저장이 성공한 뒤에만 첨부파일 동기화를 수행한다.
        // 즉, 사용자가 파일을 선택해도 "상신 전"에는 DB에 저장되지 않는다.
        await syncHeadOfficeDocumentImages({
          api,
          paymentId: resolvedRequestNo,
          deletedImages: deletedImagesToApply,
          pendingFiles: pendingFilesToUpload,
        });
      } catch (attachmentError) {
        Swal.fire({
          title: "부분 성공",
          text: "문서 상신은 완료되었지만 첨부 이미지 처리 중 오류가 발생했습니다. 다시 확인해주세요.",
          icon: "warning",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        return;
      }
    }

    await Swal.fire({
      title: "상신",
      text: "상신되었습니다.",
      icon: "success",
      confirmButtonColor: "#d33",
      confirmButtonText: "확인",
    });
    // 상신 완료 후 문서 선택 화면으로 복귀
    resetToDocTypeSelect();
  };

  if (loading) return <LoadingScreen />;

  const renderByDocType = () => {
    const formConfig = getDocFormConfig(docType, docTypeList);
    if (formConfig) return renderDocumentForm(formConfig);
    if (!docType) return renderEmptyState("대분류, 중분류, 소분류를 선택하면 화면이 표시됩니다.");
    return renderEmptyState(`"${docType}" 타입 화면은 아직 템플릿이 없습니다. (추가 예정)`);
  };

  const renderEmptyState = (msg) => (
    <MDBox p={1} sx={{ border: "1px dashed #bbb", borderRadius: 2, background: "#fafafa" }}>
      {msg}
    </MDBox>
  );

  const needTM = requiredRoles.includes("tm");
  const needPayer = needPayerStep;
  const needCeo = requiredRoles.includes("ceo");
  // 결재 칸은 왼쪽부터 채워 보이도록 재배치한다.
  // - 팀장이 없고 결재자만 있으면 결재자를 팀장 칸으로 당긴다.
  // - 결재자가 없고 대표만 있으면 대표를 결재자 칸으로 당긴다.
  const movePayerToTmSlot = !needTM && needPayer;
  const moveCeoToPayerSlot = !needPayer && needCeo;

  const renderRoleCell = ({ need, userName, width, hideWhenNotNeed }) => {
    // ✅ 대표처럼 "칸은 유지 + 내용만 숨김" 옵션
    if (!need && hideWhenNotNeed) {
      return (
        <td style={{ ...tdCellCenter, width, visibility: "hidden", pointerEvents: "none" }}>
          <div>hidden</div>
        </td>
      );
    }

    // 필요 없으면: 사용안함(칸은 유지)
    if (!need) {
      return (
        <td style={{ ...tdCellCenter, width }}>
          <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5, opacity: 0.6 }}>
            <MDBox sx={{ fontSize: 11, fontWeight: 700 }}>{userName || "-"}</MDBox>
            <StatusBadge text="사용안함" />
          </MDBox>
        </td>
      );
    }

    // 필요하면 정상 렌더
    return (
      <td style={{ ...tdCellCenter, width }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <MDBox sx={{ fontSize: 11, fontWeight: 700 }}>{userName || "-"}</MDBox>
          <MDBox>
            <StatusBadge text="대기" />
          </MDBox>
        </MDBox>
      </td>
    );
  };

  renderRoleCell.propTypes = {
    need: PropTypes.bool,
    userName: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hideWhenNotNeed: PropTypes.bool,
  };

  const renderDocumentForm = (formConfig) => {
    const WriteDocumentComponent = getWriteDocumentComponent(docType, docTypeList);

    return (
      <MDBox sx={sheetWrapSx(isMobile)}>
        {/* 헤더 */}
        <MDBox sx={headerBarSx}>
          <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <img src={logo} alt="logo" style={{ height: isMobile ? 24 : 30 }} />
          </MDBox>
          <MDBox sx={titleSx(isMobile)}>{formConfig.title}</MDBox>
          <MDBox sx={{ width: isMobile ? 90 : 110 }} />
        </MDBox>

        {/* 요청 정보 */}
        <MDBox sx={sectionSx}>
          <MDBox sx={sectionTitleSx}>{formConfig.requestInfoTitle}</MDBox>
          <MDBox sx={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 1240 }}>
              <colgroup>
                <col style={{ width: "4%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={thCell}>부서</td>
                  <td style={tdCell}>
                    <TextField
                      select
                      size="small"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      SelectProps={{ native: true }}
                      fullWidth
                      sx={inputStyle}
                    >
                      <option value="" disabled>
                        선택
                      </option>
                      {(departmentList || []).map((d) => (
                        <option key={String(d.department)} value={String(d.department)}>
                          {String(d.dept_name)}
                        </option>
                      ))}
                    </TextField>
                  </td>

                  <td style={thCell}>작성자</td>
                  <td style={tdCell}>
                    <TextField
                      select
                      size="small"
                      value={writerId}
                      onChange={(e) => setWriterId(e.target.value)}
                      SelectProps={{ native: true }}
                      fullWidth
                      sx={inputStyle}
                      disabled={!department}
                    >
                      <option value="" disabled>
                        선택
                      </option>
                      {(writerList || []).map((u) => (
                        <option key={String(u.user_id)} value={String(u.user_id)}>
                          {String(u.user_name)}
                        </option>
                      ))}
                    </TextField>
                  </td>

                  <td style={thCell}>기안일자</td>
                  <td style={tdCell}>
                    <TextField
                      type="datetime-local"
                      size="small"
                      value={draftDt}
                      onChange={(e) => setDraftDt(e.target.value)}
                      fullWidth
                      inputProps={{ step: 1 }}
                      sx={inputStyle}
                    />
                  </td>

                  <td style={thCell}>시행일자</td>
                  <td style={tdCell}>
                    <TextField
                      type="datetime-local"
                      size="small"
                      value={startDt}
                      onChange={(e) => setStartDt(e.target.value)}
                      fullWidth
                      inputProps={{ step: 1 }}
                      sx={inputStyle}
                    />
                  </td>

                  <td style={thCell}>문서번호</td>
                  <td style={tdCell}>
                    <TextField
                      size="small"
                      value={requestNo}
                      fullWidth
                      sx={inputStyle}
                      InputProps={{ readOnly: true }}
                    />
                  </td>

                  <td style={thCell}>보존연한</td>
                  <td style={tdCell}>
                    <TextField
                      select
                      size="small"
                      value={retentionDt}
                      onChange={(e) => setRetentionDt(e.target.value)}
                      SelectProps={{ native: true }}
                      fullWidth
                      sx={inputStyle}
                    >
                      {RETENTION_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.t}
                        </option>
                      ))}
                    </TextField>
                  </td>
                  <td style={thCell}>열람등급</td>
                  <td style={tdCell}>
                    <TextField
                      select
                      size="small"
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                      SelectProps={{ native: true }}
                      fullWidth
                      sx={inputStyle}
                    >
                      {ACCESS_LEVEL_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.t}
                        </option>
                      ))}
                    </TextField>
                  </td>
                </tr>
              </tbody>
            </table>
          </MDBox>
        </MDBox>

        <WriteDocumentComponent
          sectionTitle={formConfig.itemsTitle}
          itemNameLabel={formConfig.itemNameLabel}
          useNoteLabel={formConfig.useNoteLabel}
          linkLabel={formConfig.linkLabel}
          items={items}
          setItems={setItems}
          onItemsBufferChange={onItemsBufferChange}
          draftSheet={draftSheet}
          setDraftSheet={setDraftSheet}
          onDraftSheetBufferChange={onDraftSheetBufferChange}
          draftDt={draftDt}
          setDraftDt={setDraftDt}
          startDt={startDt}
          setStartDt={setStartDt}
          isMobile={isMobile}
          onChangeItem={onChangeItem}
          openLink={openLink}
          inputStyle={inputStyle}
          gridInputStyle={gridInputStyle}
          sectionSx={sectionSx}
          sectionTitleSx={sectionTitleSx}
          thCell={thCell}
          tdCell={tdCell}
          th2Cell={th2Cell}
          td2Cell={td2Cell}
          td2CellCenter={td2CellCenter}
          attachmentImages={paymentDocImages}
          attachmentPendingFiles={paymentDocPendingFiles}
          attachmentDeletedImages={paymentDocDeletedImages}
          onSelectAttachmentFiles={onSelectPaymentDocFiles}
          onRemovePendingAttachment={onRemovePendingPaymentDocFile}
          onToggleDeleteAttachment={onTogglePaymentDocDeletedImage}
          attachmentAccept={HEADOFFICE_DOCUMENT_FILE_ACCEPT}
        />

        {/* 요청 사유 */}
        <MDBox sx={sectionSx}>
          {formConfig.contentMode === "items" && (
            <RequestReasonField
              title={formConfig.reasonTitle}
              placeholder={formConfig.reasonPlaceholder}
              value={paymentNote}
              inputStyle={inputStyle}
              sectionTitleSx={sectionTitleSx}
              onBufferChange={onPaymentNoteBufferChange}
              onCommit={setPaymentNote}
            />
          )}

          {/* ✅ 결재 라인(담당/팀장/부서장/대표) - position에 따라 표시 */}
          <MDBox sx={{ p: 1 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed", // ✅ 핵심: 칸 고정
              }}
            >
              <tbody>
                <tr>
                  <td style={{ ...thCell, width: 80 }} rowSpan={2}>
                    결재
                  </td>

                  <td style={{ ...thCell, width: "23%" }}>담당</td>
                  <td
                    style={{
                      ...thCell,
                      width: "23%",
                      ...(needTM || movePayerToTmSlot ? {} : { visibility: "hidden" }),
                    }}
                  >
                    {movePayerToTmSlot ? "결재자" : "팀장"}
                  </td>
                  <td
                    style={{
                      ...thCell,
                      width: "23%",
                      ...((needPayer && !movePayerToTmSlot) || moveCeoToPayerSlot
                        ? {}
                        : { visibility: "hidden" }),
                    }}
                  >
                    {moveCeoToPayerSlot ? "대표" : "결재자"}
                  </td>
                  {/* 대표는 position===0일 때만 "표시" */}
                  <td
                    style={{
                      ...thCell,
                      width: "23%",
                      ...(needCeo && !moveCeoToPayerSlot ? {} : { visibility: "hidden" }),
                    }}
                  >
                    대표
                  </td>
                </tr>

                <tr>
                  {/* 담당 */}
                  <td style={{ ...tdCellCenter, width: "23%" }}>
                    <Stamp name={writerName || "작성자"} />
                  </td>

                  {/* 팀장 */}
                  {renderRoleCell({
                    need: needTM || movePayerToTmSlot,
                    userName: movePayerToTmSlot
                      ? approvalLine.payer_user_name
                      : approvalLine.tm_user_name,
                    width: "23%",
                    hideWhenNotNeed: true,
                  })}

                  {/* 부서장(처리부서 팀장) */}
                  {renderRoleCell({
                    need: (needPayer && !movePayerToTmSlot) || moveCeoToPayerSlot,
                    userName: moveCeoToPayerSlot
                      ? approvalLine.ceo_user_name
                      : approvalLine.payer_user_name,
                    width: "23%",
                    hideWhenNotNeed: true,
                  })}

                  {/* 대표: position===0일 때만 "보이게" (칸은 유지) */}
                  {renderRoleCell({
                    need: needCeo && !moveCeoToPayerSlot, // ✅ 필요 시 마지막 칸에만 표시
                    userName: approvalLine.ceo_user_name,
                    width: "23%",
                    hideWhenNotNeed: true, // ✅ 내용 숨김 옵션
                  })}
                </tr>
              </tbody>
            </table>
          </MDBox>
        </MDBox>

        {/* ✅ 결재라인 추가 모달(결재자 선택) */}
        {openLineModal && (
          <Modal open={openLineModal} onClose={() => setOpenLineModal(false)}>
            <Box sx={modalSx(isMobile)}>
              <MDBox sx={{ fontWeight: 800, mb: 1 }}>결재라인 추가 (결재자 선택)</MDBox>

              <MDBox sx={{ display: "flex", gap: 2, flexDirection: isMobile ? "column" : "row" }}>
                {/* 왼쪽: 현재 선택 */}
                <MDBox sx={{ flex: 1, border: "1px solid #ddd", borderRadius: 2, p: 1 }}>
                  <MDBox sx={{ fontWeight: 700, mb: 1 }}>payer_user</MDBox>
                  <MDBox sx={{ fontSize: 13 }}>
                    {selectedPayer.user_name ? (
                      <>
                        <span style={{ fontWeight: 700 }}>{selectedPayer.user_name}</span>
                        <span style={{ marginLeft: 8, color: "#666" }}>
                          ({selectedPayer.user_id})
                        </span>
                      </>
                    ) : (
                      "선택 없음"
                    )}
                  </MDBox>
                  <MDBox sx={{ mt: 1, color: "#666", fontSize: 12 }}>
                    * 모든 문서에서 결재자를 추가할 수 있고, position 2는 결재자 지정이 필수입니다.
                  </MDBox>
                </MDBox>

                {/* 오른쪽: 트리(간단 구현) */}
                <MDBox
                  sx={{
                    flex: 2,
                    border: "1px solid #ddd",
                    borderRadius: 2,
                    p: 1,
                    maxHeight: 360,
                    overflowY: "auto",
                  }}
                >
                  {(companyTree || []).map((dept, i) => {
                    const deptName =
                      dept.dept_name ||
                      dept.department_name ||
                      dept.name ||
                      dept.department ||
                      "부서";
                    const users = dept.users || dept.user_list || [];
                    const eligibleUsers = (users || []).filter((u) => {
                      const positionValue = Number(u?.position ?? u?.pos ?? u?.rank);
                      return Number.isFinite(positionValue) && positionValue <= 2;
                    });
                    if (eligibleUsers.length === 0) return null;
                    return (
                      <MDBox key={i} sx={{ mb: 1.5 }}>
                        <MDBox sx={{ fontWeight: 800, color: "#1f4e79", mb: 0.5 }}>{deptName}</MDBox>
                        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          {eligibleUsers.map((u, idx) => {
                            const uid = String(u.user_id ?? u.id ?? "");
                            const uname = String(u.user_name ?? u.name ?? "");
                            const posName = String(u.position_name ?? u.rank_name ?? "");
                            if (!uid || !uname) return null;

                            return (
                              <MDBox
                                key={idx}
                                onClick={() =>
                                  setSelectedPayer({ user_id: uid, user_name: uname, dept: deptName })
                                }
                                sx={{
                                  cursor: "pointer",
                                  p: "6px 8px",
                                  borderRadius: 1.5,
                                  border:
                                    selectedPayer.user_id === uid
                                      ? "1px solid #1f4e79"
                                      : "1px solid transparent",
                                  background: selectedPayer.user_id === uid ? "#e9f0fb" : "#f8f8f8",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{uname}</span>
                                <span style={{ color: "#666", fontSize: 12 }}>
                                  {posName || ""} {posName ? "· " : ""}
                                  {uid}
                                </span>
                              </MDBox>
                            );
                          })}
                        </MDBox>
                      </MDBox>
                    );
                  })}
                </MDBox>
              </MDBox>

              <MDBox sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
                <MDButton
                  variant="outlined"
                  color="secondary"
                  onClick={() => setOpenLineModal(false)}
                >
                  닫기
                </MDButton>
                <MDButton variant="gradient" color="info" onClick={saveApprovalLine}>
                  저장
                </MDButton>
              </MDBox>
            </Box>
          </Modal>
        )}
      </MDBox>
    );
  };

  // ✅ 상단 바(문서 타입 셀렉트 + 버튼 + 결재라인 추가)
  return (
    <>
      <MDBox
        pt={0}
        pb={1}
        px={1}
        sx={{
          mt: -1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <MDBox sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {/* 대분류 select */}
          <TextField
            select
            size="small"
            value={selectedLargeType}
            onChange={(e) => onChangeLargeType(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 140 : 180 }}
          >
            <option value="" disabled>
              대분류
            </option>
            {largeTypeOptions.map((largeType) => (
              <option key={largeType} value={largeType}>
                {largeType}
              </option>
            ))}
          </TextField>

          {/* 중분류 select */}
          <TextField
            select
            size="small"
            value={selectedMiddleType}
            onChange={(e) => onChangeMiddleType(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 140 : 180 }}
            disabled={!selectedLargeType}
          >
            <option value="" disabled>
              중분류
            </option>
            {middleTypeOptions.map((middleType) => (
              <option key={middleType} value={middleType}>
                {middleType}
              </option>
            ))}
          </TextField>

          {/* 소분류 select */}
          <TextField
            select
            size="small"
            value={docType}
            onChange={(e) => onChangeDocTypeBySelect(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 170 : 220 }}
            disabled={!selectedLargeType || !selectedMiddleType}
          >
            <option value="" disabled>
              소분류
            </option>
            {smallTypeOptions.map((d) => (
              <option key={String(d.doc_type)} value={String(d.doc_type)}>
                {String(d.small_type || d.doc_name)}
              </option>
            ))}
          </TextField>

          {/* ✅ 결재라인 추가 (문서 타입과 무관하게 사용 가능) */}
          <MDButton
            variant="gradient"
            color="success"
            onClick={openApprovalModal}
            disabled={!docType || isCurrentExpendableDoc}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 120 : 150 }}
          >
            결재라인 추가
          </MDButton>
        </MDBox>

        <MDBox sx={{ display: "flex", gap: 1 }}>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 90 : 110 }}
          >
            상신
          </MDButton>
        </MDBox>
      </MDBox>

      {renderByDocType()}
    </>
  );
}

/* -------------------- 작은 컴포넌트 -------------------- */

const RequestReasonField = React.memo(function RequestReasonField({
  title,
  placeholder,
  value,
  inputStyle,
  sectionTitleSx,
  onBufferChange,
  onCommit,
}) {
  const normalizedValue = useMemo(() => String(value ?? ""), [value]);
  const [localValue, setLocalValue] = useState(normalizedValue);

  useEffect(() => {
    setLocalValue((prev) => (prev === normalizedValue ? prev : normalizedValue));
  }, [normalizedValue]);

  const onChangeLocalValue = useCallback(
    (e) => {
      const nextValue = e.target.value;
      setLocalValue(nextValue);
      if (typeof onBufferChange === "function") {
        onBufferChange(nextValue);
      }
    },
    [onBufferChange]
  );

  const commitLocalValue = useCallback(() => {
    if (typeof onCommit !== "function") return;
    onCommit((prev) => {
      const prevValue = String(prev ?? "");
      if (prevValue === localValue) return prev;
      return localValue;
    });
  }, [localValue, onCommit]);

  return (
    <>
      <MDBox sx={sectionTitleSx}>{title}</MDBox>
      <MDBox sx={{ p: 1 }}>
        <TextField
          multiline
          rows={3}
          value={localValue}
          onChange={onChangeLocalValue}
          onBlur={commitLocalValue}
          fullWidth
          sx={inputStyle}
          placeholder={placeholder}
        />
      </MDBox>
    </>
  );
});

RequestReasonField.propTypes = {
  title: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.string,
  inputStyle: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  onBufferChange: PropTypes.func,
  onCommit: PropTypes.func,
};

function Stamp({ name }) {
  const n = String(name || "").trim() || "결재";
  return (
    <div
      style={{
        display: "inline-flex",
        width: 86,
        height: 56,
        borderRadius: 999,
        border: "2px solid #d32f2f",
        alignItems: "center",
        justifyContent: "center",
        color: "#d32f2f",
        fontWeight: 900,
        letterSpacing: 1,
        transform: "rotate(-6deg)",
        background: "rgba(211,47,47,0.06)",
        userSelect: "none",
      }}
    >
      {n}
    </div>
  );
}

Stamp.propTypes = {
  name: PropTypes.string,
};

function StatusBadge({ text }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #999",
        fontWeight: 700,
        fontSize: 12,
        color: "#333",
        background: "#fafafa",
        alignSelf: "center",
      }}
    >
      {text}
    </div>
  );
}

StatusBadge.propTypes = {
  text: PropTypes.string.isRequired,
};

/* -------------------- styles -------------------- */

const modalSx = (isMobile) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: isMobile ? "92vw" : 900,
  backgroundColor: "#fff",
  borderRadius: 12,
  boxShadow: 24,
  padding: 16,
});

const sheetWrapSx = (isMobile) => ({
  border: "1px solid #cfd8e3",
  borderRadius: 2,
  overflow: "hidden",
  background: "#fff",
  mx: 1,
  mb: 2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  fontSize: isMobile ? 11 : 12,
});

const headerBarSx = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  alignItems: "center",
  gap: 8,
  background: "#1f4e79",
  padding: "4px 4px",
};

const titleSx = (isMobile) => ({
  textAlign: "center",
  color: "#fff",
  fontWeight: 800,
  letterSpacing: 1,
  fontSize: isMobile ? 16 : 20,
});

const sectionSx = {
  borderTop: "1px solid #cfd8e3",
};

const sectionTitleSx = {
  background: "#e9f0fb",
  borderBottom: "1px solid #cfd8e3",
  padding: "8px 10px",
  fontWeight: 800,
  color: "#1f4e79",
};

const thCell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  background: "#fff",
  minWidth: 140,
};

const tdCellCenter = {
  border: "1px solid #cfd8e3",
  padding: "10px 8px",
  background: "#fff",
  textAlign: "center",
};

const th2Cell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const td2CellCenter = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  textAlign: "center",
  background: "#fff",
};

const td2Cell = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  background: "#fff",
};

const inputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "7px 10px",
  },
  "& .MuiInputBase-inputMultiline": {
    fontSize: isMobile ? 11 : 12,
  },
});

const gridInputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "6px 10px",
  },
});
