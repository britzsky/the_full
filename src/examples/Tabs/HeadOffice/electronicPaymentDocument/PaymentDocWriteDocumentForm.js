import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { IconButton, TextField } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import MDBox from "components/MDBox";
import api from "api/api";
import { API_BASE_URL } from "config";
import {
  HEADOFFICE_DOCUMENT_FILE_ACCEPT,
  buildHeadOfficeDocumentFileUrl,
  getHeadOfficeDocumentPreviewKind,
  isHeadOfficeDocumentImageFile,
  toHeadOfficeDocumentViewUrl,
} from "utils/headOfficeDocumentImageUtils";
import PreviewOverlay from "utils/PreviewOverlay";

// 지급구분 코드 상수 정의
const METHOD = { CASH: "cash", CARD: "card", TRANSFER: "transfer", AUTO: "auto", OTHER: "other" };
// 지급구분 허용 목록 정의
const METHOD_LIST = [METHOD.CASH, METHOD.CARD, METHOD.TRANSFER, METHOD.AUTO, METHOD.OTHER];
// 지급구분 DB 코드 매핑 (tb_headoffice_payment_doc.payment_type)
const METHOD_TYPE_CODE = Object.freeze({
  [METHOD.CASH]: 1,
  [METHOD.CARD]: 2,
  [METHOD.TRANSFER]: 3,
  [METHOD.AUTO]: 4,
  [METHOD.OTHER]: 5,
});
const TYPE_CODE_METHOD = Object.freeze({
  1: METHOD.CASH,
  2: METHOD.CARD,
  3: METHOD.TRANSFER,
  4: METHOD.AUTO,
  5: METHOD.OTHER,
});
// 표준 행 높이 정의
const ROW_H = 42;

// 비활성 입력창 마우스 커서 표기 스타일
const disabledNotAllowedInputSx = {
  "& .MuiInputBase-root.Mui-disabled": { cursor: "not-allowed" },
  "& .MuiInputBase-input.Mui-disabled": { cursor: "not-allowed" },
  "& .MuiSelect-select.Mui-disabled": { cursor: "not-allowed" },
};

// 지급구분 선택 입력창 강조 스타일
const methodInputSelectedSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#f4f8ff",
    boxShadow: "inset 0 0 0 2px #1f4e79",
  },
  "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.23)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.23)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.23)",
  },
};

// 세부내역 헤더 행 제어 버튼 스타일
const detailRowActionBtnSx = {
  p: 0,
  width: 24,
  height: 24,
  borderRadius: "999px",
  border: "1px solid #c7d2e6",
  backgroundColor: "#f7faff",
  color: "#1f4e79",
  "&:hover": {
    backgroundColor: "#eaf2ff",
    borderColor: "#95afd6",
  },
  "&.Mui-disabled": {
    color: "#b0bac8",
    borderColor: "#d9e1ee",
    backgroundColor: "#f6f8fb",
  },
};

// 첨부파일 목록 썸네일 카드 스타일
const attachmentThumbBoxSx = {
  // 사용자 요청: 가로형(좌우) 카드가 아니라 세로형(상하) 직사각형으로 통일
  width: 62,
  height: 92,
  borderRadius: "6px",
  overflow: "hidden",
  flexShrink: 0,
  border: "1px solid #d0d7e2",
  backgroundColor: "#f1f4f8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// 숫자만 추출 문자열 변환
const digits = (v) => String(v ?? "").replace(/[^\d]/g, "");
// 금액 문자열 숫자 변환
// - 합계 음수 입력을 위해 마이너스(-)를 허용한다.
const num = (v) => {
  const raw = String(v ?? "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const sign = raw.startsWith("-") ? -1 : 1;
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return 0;
  return sign * Number(digitsOnly);
};
// 수량 문자열 숫자 변환
// - 수량은 음수 없이 정수만 허용한다.
const qtyNum = (v) => {
  const digitsOnly = digits(v);
  if (!digitsOnly) return 0;
  return Number(digitsOnly);
};
// 금액 표시 문자열 변환
const toAmountText = (v) => (num(v) !== 0 ? num(v).toLocaleString("ko-KR") : "");
// 수량 표시 문자열 변환
const toQtyText = (v) => (qtyNum(v) > 0 ? String(qtyNum(v)) : "");
// 합계 표시 문자열 변환(원 단위)
const toWonText = (v) => (num(v) !== 0 ? `₩\u00A0\u00A0${num(v).toLocaleString("ko-KR")}` : "-");
// 파일 확장자 라벨 추출
const toFileExtLabel = (fileName) => {
  const text = String(fileName ?? "").trim();
  if (!text.includes(".")) return "FILE";
  const ext = text.split(".").pop();
  return String(ext || "FILE").toUpperCase();
};
// PDF 썸네일 iframe src 생성
// - 툴바/사이드패널을 숨기고 1페이지 기준으로 축소 표시해 목록 썸네일처럼 보이게 한다.
function toPdfThumbSrc(fileUrl) {
  const baseUrl = String(fileUrl ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}
// 카드번호 끝 4자리 추출
const cardTail = (v) => {
  const d = digits(v);
  return d.length >= 4 ? d.slice(-4) : "";
};

// DB 코드/문자열 지급구분을 화면 지급구분 키로 정규화
function toMethodFromTypeOrMethod(typeValue, methodValue) {
  // 클릭 직후에는 method 값을 우선 반영해야 선택 박스가 즉시 이동한다.
  const methodText = String(methodValue ?? "").trim().toLowerCase();
  if (METHOD_LIST.includes(methodText)) return methodText;

  const typeCode = Number(typeValue);
  if (TYPE_CODE_METHOD[typeCode]) return TYPE_CODE_METHOD[typeCode];
  return METHOD.CARD;
}

// 화면 지급구분 키를 DB 지급구분 코드로 변환
function toPaymentTypeCode(method) {
  return Number(METHOD_TYPE_CODE[method] || METHOD_TYPE_CODE[METHOD.CARD]);
}

// 지급구분별 상세 문자열을 추출한다.
function toMethodDetailText(sheetLike) {
  const s = sheetLike || {};
  const method = toMethodFromTypeOrMethod(s.payment_type, s.payment_method);
  if (method === METHOD.CASH) return String(s.cash_receipt_text ?? "");
  if (method === METHOD.CARD) return cardTail(s.card_tail) || String(s.card_tail ?? "");
  if (method === METHOD.TRANSFER) return String(s.transfer_receipt_text ?? "");
  if (method === METHOD.AUTO) return String(s.auto_text ?? "");
  if (method === METHOD.OTHER) return String(s.other_text ?? "");
  return "";
}

// 카드번호 마스킹 표시 텍스트 생성
// - 형식: ****-****-****-0000
function toMaskedCardText(v) {
  const tail = cardTail(v);
  if (!tail) return "****-****-****-0000";
  return `****-****-****-${tail}`;
}

// 자동 지출명 포맷 문자열 생성
// - 형식: YYYYMMDD_본사 비품 구매 지출결의서_법인(0000)
function buildAutoPaymentTitle(draftDateTimeText, cardTailText) {
  const datePart = toDate(draftDateTimeText).replace(/-/g, "") || toDate(new Date().toISOString()).replace(/-/g, "");
  const tail = cardTail(cardTailText).padStart(4, "0");
  return `${datePart}_본사 비품 구매 지출결의서_법인(${tail})`;
}

// 자동 지출명 패턴 여부 판정
function isAutoPaymentTitleText(titleText) {
  const text = String(titleText ?? "").trim();
  return /^\d{8}_본사 비품 구매 지출결의서_법인\(\d{4}\)$/.test(text);
}

// 합계 기준 공급가액/세액 분리 계산
function splitTotal(totalValue) {
  const total = Math.max(0, Math.round(Math.abs(num(totalValue))));
  const tax = Math.round(total * 0.1);
  const amount = total - tax;
  return { amount, tax, total };
}

// 날짜 문자열 YYYY-MM-DD 정규화
function toDate(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

// 날짜 수기입력 중간 포맷 보정
function normalizeDateTyping(v) {
  const d = digits(v).slice(0, 8);
  if (!d) return "";
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

// 네이티브 날짜 선택기 열기 처리
function openPicker(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof el.showPicker === "function") return el.showPicker();
  el.focus();
  el.click();
}

// 날짜값 기존 시간값 결합 문자열 생성
function mergeDateToDateTime(dateText, baseDateTimeText) {
  const date = toDate(dateText);
  if (!date) return String(baseDateTimeText ?? "");
  const b = String(baseDateTimeText ?? "");
  const sec = b.match(/(\d{2}):(\d{2}):(\d{2})/);
  const min = b.match(/(\d{2}):(\d{2})/);
  const time = sec ? `${sec[1]}:${sec[2]}:${sec[3]}` : min ? `${min[1]}:${min[2]}:00` : "00:00:00";
  return `${date}T${time}`;
}

// 상세행 데이터 표준 구조 정규화
function normalizeRows(detailRows, content) {
  const src = Array.isArray(detailRows) ? detailRows : [];
  if (src.length > 0) {
    const rows = src.map((r) => {
      const detailText = String(r?.detail_text ?? r?.text ?? "").trim();
      const vendorName = String(r?.use_note ?? "").trim();
      const qtyRaw = qtyNum(r?.qty);
      const qty = qtyRaw > 0 ? qtyRaw : 1;
      const total = num(r?.total);
      let amount = num(r?.amount);
      let tax = num(r?.tax);
      if (total > 0 && amount <= 0 && tax <= 0) {
        const s = splitTotal(total);
        amount = s.amount;
        tax = s.tax;
      }
      // 합계가 음수인 행은 공급가액/세액 자동 계산을 하지 않는다.
      if (total < 0) {
        amount = 0;
        tax = 0;
      }
      return { detail_text: detailText, qty, use_note: vendorName, amount, tax, total };
    });
    return rows.length > 0
      ? rows
      : [{ detail_text: "", qty: 1, use_note: "", amount: 0, tax: 0, total: 0 }];
  }
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length === 0) return [{ detail_text: "", qty: 1, use_note: "", amount: 0, tax: 0, total: 0 }];
  return lines.map((x) => ({ detail_text: x, qty: 1, use_note: "", amount: 0, tax: 0, total: 0 }));
}

// 지출결의서 시트 데이터 표준 구조 정규화
function normalizeSheet(s) {
  const total = num(s?.total);
  let amount = num(s?.amount);
  let tax = num(s?.tax);
  if (total > 0 && amount <= 0 && tax <= 0) {
    const x = splitTotal(total);
    amount = x.amount;
    tax = x.tax;
  }
  const payment_method = toMethodFromTypeOrMethod(s?.payment_type, s?.payment_method);
  const payment_type = toPaymentTypeCode(payment_method);
  // 신규 컬럼(payment_type_detail) 우선 사용, 없으면 기존 상세 필드에서 역추론한다.
  const paymentTypeDetailText =
    String(s?.payment_type_detail ?? "").trim() || String(toMethodDetailText(s)).trim();
  const normalizedCardTail =
    payment_method === METHOD.CARD
      ? cardTail(paymentTypeDetailText) || cardTail(s?.card_tail) || cardTail(s?.biz_no)
      : "";
  const normalizedRows = normalizeRows(s?.detail_rows, s?.content);
  const commonVendorName =
    String(s?.use_note ?? "").trim() ||
    String(normalizedRows.find((row) => String(row?.use_note ?? "").trim())?.use_note ?? "").trim();

  return {
    title: String(s?.title ?? ""),
    item_name: String(s?.item_name ?? ""),
    content: String(s?.content ?? ""),
    amount: amount !== 0 ? amount.toLocaleString("ko-KR") : "",
    tax: tax !== 0 ? tax.toLocaleString("ko-KR") : "",
    total: total !== 0 ? total.toLocaleString("ko-KR") : "",
    account_number: String(s?.account_number ?? ""),
    // account_name은 지급문서 DB에서 예금주 컬럼으로 사용한다.
    account_name: String(s?.account_name ?? ""),
    // 거래처명은 세부내역 use_note의 공통 입력값으로 사용한다.
    use_note: commonVendorName,
    place: String(s?.place ?? ""),
    biz_no: String(s?.biz_no ?? ""),
    payment_type,
    payment_type_detail: paymentTypeDetailText,
    payment_method,
    card_tail: normalizedCardTail,
    cash_receipt_text:
      payment_method === METHOD.CASH ? paymentTypeDetailText || String(s?.cash_receipt_text ?? "") : String(s?.cash_receipt_text ?? ""),
    transfer_receipt_text:
      payment_method === METHOD.TRANSFER ? paymentTypeDetailText || String(s?.transfer_receipt_text ?? "") : String(s?.transfer_receipt_text ?? ""),
    auto_text:
      payment_method === METHOD.AUTO ? paymentTypeDetailText || String(s?.auto_text ?? "") : String(s?.auto_text ?? ""),
    other_text:
      payment_method === METHOD.OTHER ? paymentTypeDetailText || String(s?.other_text ?? "") : String(s?.other_text ?? ""),
    request_dt: toDate(s?.request_dt),
    detail_rows: normalizedRows,
  };
}

// 변경 비교용 직렬화 키 생성
const keyOf = (sheet) =>
  JSON.stringify({
    ...sheet,
    detail_rows: (Array.isArray(sheet?.detail_rows) ? sheet.detail_rows : []).map((r) => ({
      detail_text: String(r?.detail_text ?? ""),
      qty: qtyNum(r?.qty),
      use_note: String(r?.use_note ?? ""),
      amount: num(r?.amount),
      tax: num(r?.tax),
      total: num(r?.total),
    })),
  });

// 날짜 텍스트 입력 + 달력 버튼 결합 컴포넌트
function DatePickerText({ id, value, onChange, inputStyle, inputWidthCh }) {
  return (
    <MDBox sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", position: "relative" }}>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(normalizeDateTyping(e.target.value))}
        onBlur={(e) => {
          const d = toDate(e.target.value);
          if (d || !String(e.target.value || "").trim()) onChange(d);
        }}
        sx={{ ...inputStyle, width: `${inputWidthCh}ch`, "& .MuiInputBase-input": { padding: "6px 6px", textAlign: "left" } }}
      />
      <IconButton size="small" sx={{ p: 0, width: 16, height: 16 }} onClick={() => openPicker(id)}>
        <CalendarTodayIcon sx={{ fontSize: "0.95rem", color: "#6c757d" }} />
      </IconButton>
      <input id={id} type="date" value={toDate(value)} onChange={(e) => onChange(toDate(e.target.value))} style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />
    </MDBox>
  );
}

DatePickerText.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  inputStyle: PropTypes.object.isRequired,
  inputWidthCh: PropTypes.number,
};
DatePickerText.defaultProps = { inputWidthCh: 11.1 };

// 입력 중에는 내부 상태만 갱신하고, blur/Enter 시점에만 부모 커밋한다.
function BufferedTextField({
  value,
  onCommit,
  commitOnEnter,
  onBlur: userOnBlur,
  onKeyDown: userOnKeyDown,
  ...props
}) {
  const normalizedValue = useMemo(() => String(value ?? ""), [value]);
  const [inputValue, setInputValue] = useState(normalizedValue);

  useEffect(() => {
    setInputValue((prev) => (prev === normalizedValue ? prev : normalizedValue));
  }, [normalizedValue]);

  const commitValue = useCallback(() => {
    if (typeof onCommit === "function") onCommit(inputValue);
  }, [onCommit, inputValue]);

  const handleBlur = useCallback(
    (e) => {
      if (typeof userOnBlur === "function") userOnBlur(e);
      commitValue();
    },
    [commitValue, userOnBlur]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (typeof userOnKeyDown === "function") userOnKeyDown(e);
      if (!commitOnEnter) return;
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      e.currentTarget.blur();
    },
    [commitOnEnter, userOnKeyDown]
  );

  return (
    <TextField
      {...props}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

BufferedTextField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCommit: PropTypes.func,
  commitOnEnter: PropTypes.bool,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,
};

BufferedTextField.defaultProps = {
  value: "",
  onCommit: null,
  commitOnEnter: true,
  onBlur: null,
  onKeyDown: null,
};

function PaymentDocWriteDocumentForm({
  sectionTitle,
  draftSheet,
  setDraftSheet,
  onDraftSheetBufferChange,
  draftDt,
  setDraftDt,
  startDt,
  setStartDt,
  isMobile,
  inputStyle,
  sectionSx,
  sectionTitleSx,
  thCell,
  tdCell,
  th2Cell,
  td2Cell,
  td2CellCenter,
  attachmentImages,
  attachmentPendingFiles,
  attachmentDeletedImages,
  onSelectAttachmentFiles,
  onRemovePendingAttachment,
  onToggleDeleteAttachment,
  attachmentAccept,
}) {
  // 내용 직접 수정 여부 추적
  const contentEditedRef = useRef(false);
  // 로컬 편집 버퍼 상태
  const [local, setLocal] = useState(() => {
    const next = normalizeSheet(draftSheet);
    if (Array.isArray(next.detail_rows) && next.detail_rows.length > 0) next.content = "";
    return next;
  });
  // 법인카드 끝 4자리 목록 상태
  const [cardOptions, setCardOptions] = useState([]);
  // 날짜 선택기 DOM id 상태
  const [draftDateId] = useState(() => `paymentdoc_draft_${Math.random().toString(36).slice(2)}`);
  const [requestDateId] = useState(() => `paymentdoc_req_${Math.random().toString(36).slice(2)}`);

  // 외부 draftSheet -> 로컬 편집 상태 동기화
  useEffect(() => {
    const next = normalizeSheet(draftSheet);
    if (!contentEditedRef.current && Array.isArray(next.detail_rows) && next.detail_rows.length > 0) next.content = "";
    setLocal((prev) => (keyOf(prev) === keyOf(next) ? prev : next));
  }, [draftSheet]);

  // 법인카드 목록 API 조회 처리
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/Account/HeadOfficeCorporateCardList");
        if (cancelled) return;
        const list = Array.from(new Set((Array.isArray(res?.data) ? res.data : []).map((r) => cardTail(r?.card_no)).filter(Boolean)));
        setCardOptions(list);
      } catch (e) {
        if (!cancelled) setCardOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 로컬 편집 상태 -> 부모 버퍼/상태 반영 처리
  useEffect(() => {
    // 입력 중에는 부모 상태를 매번 갱신하지 않고 버퍼(ref)만 갱신해
    // 상위 대형 컴포넌트 리렌더를 줄여 타이핑 지연을 완화한다.
    if (typeof onDraftSheetBufferChange === "function") {
      onDraftSheetBufferChange(local);
    }
  }, [local, onDraftSheetBufferChange]);

  // 화면 표시 기준 날짜 계산
  const draftDate = useMemo(() => toDate(draftDt) || toDate(new Date().toISOString()), [draftDt]);
  const requestDate = useMemo(() => local.request_dt || toDate(startDt) || draftDate, [local.request_dt, startDt, draftDate]);
  // 상세행 표시 목록 계산
  const rows = useMemo(() => normalizeRows(local.detail_rows, local.content), [local.detail_rows, local.content]);

  // 하단 합계 금액 계산
  const totals = useMemo(() => {
    const has = rows.some((r) => num(r.amount) !== 0 || num(r.tax) !== 0 || num(r.total) !== 0);
    if (!has) return { amount: num(local.amount), tax: num(local.tax), total: num(local.total) };
    return {
      amount: rows.reduce((a, r) => a + num(r.amount), 0),
      tax: rows.reduce((a, r) => a + num(r.tax), 0),
      total: rows.reduce((a, r) => a + num(r.total), 0),
    };
  }, [rows, local.amount, local.tax, local.total]);

  const [attachmentFileInputId] = useState(
    () => `paymentdoc_attachment_${Math.random().toString(36).slice(2)}`
  );
  const orderedAttachmentImages = useMemo(
    () =>
      (Array.isArray(attachmentImages) ? attachmentImages : [])
        .slice()
        .sort((a, b) => Number(a?.image_order || 0) - Number(b?.image_order || 0)),
    [attachmentImages]
  );
  const deletedAttachmentOrderSet = useMemo(
    () =>
      new Set(
        (Array.isArray(attachmentDeletedImages) ? attachmentDeletedImages : [])
          .map((img) => Number(img?.image_order))
          .filter((order) => Number.isFinite(order))
      ),
    [attachmentDeletedImages]
  );
  // 첨부파일 미리보기 모달 상태
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  // 미리보기 목록은 "삭제 예정이 아닌 기존 파일 + 업로드 예정 파일"을 모두 구성한다.
  // - image: 이미지 렌더
  // - pdf: iframe 렌더
  // - excel: xlsx 파싱 후 표 렌더
  const attachmentPreviewList = useMemo(() => {
    const saved = orderedAttachmentImages
      .filter((img) => !deletedAttachmentOrderSet.has(Number(img?.image_order)))
      .map((img) => ({
        key: `saved-${Number(img?.image_order)}`,
        // 서버 저장 파일은 image_path(상대경로) 기반으로 URL을 만들고,
        // 한글/공백 파일명 대응을 위해 브라우저 렌더용 URL로 인코딩한다.
        url: toHeadOfficeDocumentViewUrl(
          buildHeadOfficeDocumentFileUrl(String(img?.image_path || ""), API_BASE_URL)
        ),
        name: String(img?.image_name || "-"),
        kind: getHeadOfficeDocumentPreviewKind({
          image_name: img?.image_name,
          image_path: img?.image_path,
        }),
      }));
    const pending = (Array.isArray(attachmentPendingFiles) ? attachmentPendingFiles : [])
      .map((pendingFile, idx) => ({
        key: `pending-${idx}`,
        url: String(pendingFile?.previewUrl || ""),
        name: String(pendingFile?.file?.name || "-"),
        kind: getHeadOfficeDocumentPreviewKind(pendingFile?.file),
      }));
    return [...saved, ...pending].filter(
      (file) => !!file.url && (file.kind === "image" || file.kind === "pdf" || file.kind === "excel")
    );
  }, [orderedAttachmentImages, deletedAttachmentOrderSet, attachmentPendingFiles]);
  // 파일명/썸네일 클릭 시 미리보기 팝업 오픈
  const openAttachmentPreview = useCallback(
    (previewKey) => {
      if (!attachmentPreviewList.length) return;
      const startIndex = attachmentPreviewList.findIndex((img) => img.key === previewKey);
      setPreviewList(attachmentPreviewList);
      setPreviewIndex(startIndex >= 0 ? startIndex : 0);
      setPreviewOpen(true);
    },
    [attachmentPreviewList]
  );

  // 상위 버퍼(ref) 즉시 동기화
  const commitBuffer = useCallback(
    (nextSheet) => {
      if (typeof onDraftSheetBufferChange === "function") onDraftSheetBufferChange(nextSheet);
    },
    [onDraftSheetBufferChange]
  );

  // 지급구분/지급구분상세 값을 DB 컬럼(payment_type/payment_type_detail)에 맞춰 동기화한다.
  const applyPaymentTypeMeta = useCallback((sheetLike) => {
    const method = toMethodFromTypeOrMethod(sheetLike?.payment_type, sheetLike?.payment_method);
    const detailText = String(toMethodDetailText({ ...sheetLike, payment_method: method }) ?? "")
      .trim()
      .slice(0, 50);
    return {
      ...sheetLike,
      payment_method: method,
      payment_type: toPaymentTypeCode(method),
      payment_type_detail: detailText,
    };
  }, []);

  // 단일 필드 변경 반영 처리
  const setField = useCallback((key, value) => {
    setLocal((prev) => {
      const next = { ...prev };
      if (key === "content") contentEditedRef.current = true;
      if (key === "total") {
        const s = splitTotal(value);
        next.total = s.total ? s.total.toLocaleString("ko-KR") : "";
        next.amount = s.amount ? s.amount.toLocaleString("ko-KR") : "";
        next.tax = s.tax ? s.tax.toLocaleString("ko-KR") : "";
      } else {
        next[key] = String(value ?? "");
      }
      const normalized = applyPaymentTypeMeta(next);
      commitBuffer(normalized);
      return normalized;
    });
  }, [applyPaymentTypeMeta, commitBuffer]);

  // 상세행 필드 변경 및 합계 재계산 처리
  const setDetailRowField = useCallback((rowIndex, key, value) => {
    setLocal((prev) => {
      const baseRows = Array.isArray(prev.detail_rows) ? prev.detail_rows : [];
      const nextRows = baseRows.map((r, idx) => {
        if (idx !== rowIndex) return r;

        if (key === "total") {
          const total = num(value);
          if (total < 0) {
            // 합계가 음수면 공급가액/세액 자동 계산을 건너뛴다.
            return { ...r, total, amount: 0, tax: 0 };
          }
          const split = splitTotal(total);
          return { ...r, total, amount: split.amount, tax: split.tax };
        }

        if (key === "amount") {
          const amount = num(value);
          const tax = num(r.tax);
          return { ...r, amount, total: amount + tax };
        }

        if (key === "tax") {
          const tax = num(value);
          const amount = num(r.amount);
          return { ...r, tax, total: amount + tax };
        }

        if (key === "qty") {
          const qty = qtyNum(value);
          return { ...r, qty };
        }

        return { ...r, [key]: value };
      });
      const amountSum = nextRows.reduce((acc, r) => acc + num(r.amount), 0);
      const taxSum = nextRows.reduce((acc, r) => acc + num(r.tax), 0);
      const totalSum = nextRows.reduce((acc, r) => acc + num(r.total), 0);
      const next = {
        ...prev,
        detail_rows: nextRows,
        amount: amountSum !== 0 ? amountSum.toLocaleString("ko-KR") : "",
        tax: taxSum !== 0 ? taxSum.toLocaleString("ko-KR") : "",
        total: totalSum !== 0 ? totalSum.toLocaleString("ko-KR") : "",
      };
      commitBuffer(next);
      return next;
    });
  }, [commitBuffer]);

  // 세부내역 행 추가
  const addDetailRow = useCallback(() => {
    setLocal((prev) => {
      const baseRows = Array.isArray(prev.detail_rows) ? prev.detail_rows : [];
      const nextRows = [
        ...baseRows,
        { detail_text: "", qty: 1, use_note: "", amount: 0, tax: 0, total: 0 },
      ];
      const next = { ...prev, detail_rows: nextRows };
      commitBuffer(next);
      return next;
    });
  }, [commitBuffer]);

  // 세부내역 행 삭제 (최소 1행 유지)
  // - rowIndex 미지정 시 마지막 행 삭제
  const removeDetailRow = useCallback((rowIndex) => {
    setLocal((prev) => {
      const baseRows = Array.isArray(prev.detail_rows) ? prev.detail_rows : [];
      if (baseRows.length <= 1) return prev;
      const normalizedRowIndex = Number.isInteger(rowIndex) ? rowIndex : baseRows.length - 1;
      const safeRowIndex = Math.min(Math.max(normalizedRowIndex, 0), baseRows.length - 1);
      const nextRows = baseRows.filter((_, idx) => idx !== safeRowIndex);
      const amountSum = nextRows.reduce((acc, r) => acc + num(r.amount), 0);
      const taxSum = nextRows.reduce((acc, r) => acc + num(r.tax), 0);
      const totalSum = nextRows.reduce((acc, r) => acc + num(r.total), 0);
      const next = {
        ...prev,
        detail_rows: nextRows,
        amount: amountSum !== 0 ? amountSum.toLocaleString("ko-KR") : "",
        tax: taxSum !== 0 ? taxSum.toLocaleString("ko-KR") : "",
        total: totalSum !== 0 ? totalSum.toLocaleString("ko-KR") : "",
      };
      commitBuffer(next);
      return next;
    });
  }, [commitBuffer]);

  // 지급구분 우측 값 변경 반영 처리
  const setMethodDetail = useCallback((key, value) => {
    setLocal((prev) => {
      const next = { ...prev, [key]: key === "card_tail" ? digits(value).slice(-4) : String(value ?? "") };
      const normalized = applyPaymentTypeMeta(next);
      commitBuffer(normalized);
      return normalized;
    });
  }, [applyPaymentTypeMeta, commitBuffer]);

  // 지급구분 선택 변경 처리
  const setMethod = useCallback((m) => {
    setLocal((prev) => {
      const next = {
        ...prev,
        payment_method: m,
        cash_receipt_text: m === METHOD.CASH ? prev.cash_receipt_text : "",
        card_tail: m === METHOD.CARD ? prev.card_tail : "",
        transfer_receipt_text: m === METHOD.TRANSFER ? prev.transfer_receipt_text : "",
        auto_text: m === METHOD.AUTO ? prev.auto_text : "",
        other_text: m === METHOD.OTHER ? prev.other_text : "",
      };
      const normalized = applyPaymentTypeMeta(next);
      commitBuffer(normalized);
      return normalized;
    });
  }, [applyPaymentTypeMeta, commitBuffer]);

  // 카드번호 끝 4자리 표시값 계산
  const selectedTail = useMemo(() => {
    if (cardTail(local.card_tail)) return cardTail(local.card_tail);
    return "";
  }, [local.card_tail]);

  // 카드 지급구분 선택 시 카드번호가 바뀌면 지급구분상세도 함께 동기화한다.
  useEffect(() => {
    if (local.payment_method !== METHOD.CARD) return;
    setLocal((prev) => {
      if (prev.payment_method !== METHOD.CARD) return prev;
      const nextCardTail = selectedTail;
      if (prev.card_tail === nextCardTail) return prev;
      return applyPaymentTypeMeta({ ...prev, card_tail: nextCardTail });
    });
  }, [local.payment_method, selectedTail, applyPaymentTypeMeta]);

  // 자동 지출명 패턴인 경우, 기안일자/카드끝4자리 변경 시 제목을 자동 동기화한다.
  // - 사용자가 수동으로 다른 형식으로 수정한 제목은 덮어쓰지 않는다.
  useEffect(() => {
    setLocal((prev) => {
      const currentTitle = String(prev?.title ?? "").trim();
      if (!isAutoPaymentTitleText(currentTitle)) return prev;

      const nextTitle = buildAutoPaymentTitle(draftDt, selectedTail);
      if (currentTitle === nextTitle) return prev;
      return { ...prev, title: nextTitle };
    });
  }, [draftDt, selectedTail]);

  // 지급구분 선택 여부 판정
  const isMethodSelected = useCallback(
    (method) => local.payment_method === method,
    [local.payment_method]
  );

  // 상세표 일자는 메인 기안일자(draft_dt)의 날짜 부분을 그대로 사용한다.
  const onChangeDraftDate = useCallback((d) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof setDraftDt === "function") {
      setDraftDt((prev) => mergeDateToDateTime(d, prev || draftDt));
    }
  }, [draftDt, setDraftDt]);

  // 하단 지급요청일자 변경 처리
  const onChangeRequestDate = useCallback((d) => {
    setLocal((prev) => {
      const next = { ...prev, request_dt: d };
      commitBuffer(next);
      return next;
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof setStartDt === "function") {
      setStartDt((prev) => mergeDateToDateTime(d, prev || startDt));
    }
  }, [setStartDt, startDt, commitBuffer]);

  // 반응형 최소 너비 계산
  const minWidth = isMobile ? 1040 : 1200;

  return (
    <MDBox sx={sectionSx}>
      {/* 섹션 제목 영역 */}
      <MDBox sx={sectionTitleSx}>{sectionTitle}</MDBox>

      {/* 상단 지출정보/지급구분 영역 */}
      <MDBox sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth }}>
          <colgroup>
            <col style={{ width: "8%" }} /><col style={{ width: "10.5%" }} /><col style={{ width: "10.5%" }} /><col style={{ width: "10.5%" }} /><col style={{ width: "10.5%" }} />
            <col style={{ width: "16.7%" }} /><col style={{ width: "16.65%" }} /><col style={{ width: "16.65%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td style={{ ...tdCell, textAlign: "center", verticalAlign: "middle", fontWeight: 700, height: ROW_H * 3 }} colSpan={5} rowSpan={3}>다음과 같이 지급(대체)하고자 하오니 승인하여 주시기 바랍니다.</td>
              <td style={{ ...tdCell, padding: 0 }} colSpan={3} rowSpan={5}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup><col style={{ width: "16%" }} /><col style={{ width: "28%" }} /><col style={{ width: "26%" }} /><col style={{ width: "30%" }} /></colgroup>
                  <tbody>
                    <tr style={{ height: ROW_H, backgroundColor: isMethodSelected(METHOD.CASH) ? "#eaf2ff" : "#fff" }} onClick={() => setMethod(METHOD.CASH)}>
                      <td style={{ ...thCell, borderLeft: "none", borderTop: "none", borderBottom: "none" }} rowSpan={5}>지급구분</td>
                      <td style={{ ...thCell, borderTop: "none" }}>현 금</td><td style={{ ...tdCell, borderTop: "none" }}>현금영수증</td>
                      <td style={{ ...tdCell, borderRight: "none" }}><BufferedTextField size="small" value={local.cash_receipt_text} onCommit={(v) => setMethodDetail("cash_receipt_text", v)} fullWidth sx={isMethodSelected(METHOD.CASH) ? { ...inputStyle, ...methodInputSelectedSx } : { ...inputStyle, ...disabledNotAllowedInputSx }} disabled={!isMethodSelected(METHOD.CASH)} /></td>
                    </tr>
                    <tr style={{ height: ROW_H, backgroundColor: isMethodSelected(METHOD.CARD) ? "#eaf2ff" : "#fff" }} onClick={() => setMethod(METHOD.CARD)}>
                      <td style={thCell}>법인카드</td><td style={tdCell}>카드전표</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}><TextField select size="small" value={selectedTail} onChange={(e) => setMethodDetail("card_tail", e.target.value)} SelectProps={{ native: true }} fullWidth sx={isMethodSelected(METHOD.CARD) ? { ...inputStyle, ...methodInputSelectedSx } : { ...inputStyle, ...disabledNotAllowedInputSx }} disabled={!isMethodSelected(METHOD.CARD)}><option value="">선택</option>{cardOptions.map((x) => <option key={cardTail(x)} value={cardTail(x)}>{toMaskedCardText(x)}</option>)}</TextField></td>
                    </tr>
                    <tr style={{ height: ROW_H, backgroundColor: isMethodSelected(METHOD.TRANSFER) ? "#eaf2ff" : "#fff" }} onClick={() => setMethod(METHOD.TRANSFER)}>
                      <td style={thCell}>계좌이체</td><td style={tdCell}>세금계산서</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}><BufferedTextField size="small" value={local.transfer_receipt_text} onCommit={(v) => setMethodDetail("transfer_receipt_text", v)} fullWidth sx={isMethodSelected(METHOD.TRANSFER) ? { ...inputStyle, ...methodInputSelectedSx } : { ...inputStyle, ...disabledNotAllowedInputSx }} disabled={!isMethodSelected(METHOD.TRANSFER)} /></td>
                    </tr>
                    <tr style={{ height: ROW_H, backgroundColor: isMethodSelected(METHOD.AUTO) ? "#eaf2ff" : "#fff" }} onClick={() => setMethod(METHOD.AUTO)}>
                      <td style={thCell} colSpan={2}>자동이체</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}><BufferedTextField size="small" value={local.auto_text} onCommit={(v) => setMethodDetail("auto_text", v)} fullWidth sx={isMethodSelected(METHOD.AUTO) ? { ...inputStyle, ...methodInputSelectedSx } : { ...inputStyle, ...disabledNotAllowedInputSx }} disabled={!isMethodSelected(METHOD.AUTO)} /></td>
                    </tr>
                    <tr style={{ height: ROW_H, backgroundColor: isMethodSelected(METHOD.OTHER) ? "#eaf2ff" : "#fff" }} onClick={() => setMethod(METHOD.OTHER)}>
                      <td style={{ ...thCell, borderBottom: "none" }} colSpan={2}>기타납부</td>
                      <td style={{ ...tdCell, borderRight: "none", borderBottom: "none", borderLeft: "none" }}><BufferedTextField size="small" value={local.other_text} onCommit={(v) => setMethodDetail("other_text", v)} fullWidth sx={isMethodSelected(METHOD.OTHER) ? { ...inputStyle, ...methodInputSelectedSx } : { ...inputStyle, ...disabledNotAllowedInputSx }} disabled={!isMethodSelected(METHOD.OTHER)} /></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr />
            <tr />
            <tr><td style={thCell}>지 출 명</td><td style={{ ...tdCell, height: ROW_H }} colSpan={4}><BufferedTextField size="small" value={local.title} onCommit={(v) => setField("title", v)} fullWidth sx={inputStyle} /></td></tr>
            <tr><td style={thCell}>금 액</td><td style={{ ...tdCell, textAlign: "center", height: ROW_H }} colSpan={4}><MDBox component="span" sx={{ fontWeight: 700 }}>{toWonText(local.total)}</MDBox></td></tr>
            <tr><td style={thCell}>내 용</td><td style={tdCell} colSpan={7}><BufferedTextField size="small" multiline minRows={4} value={local.content} onCommit={(v) => setField("content", v)} commitOnEnter={false} fullWidth sx={inputStyle} /></td></tr>
          </tbody>
        </table>
      </MDBox>

      {/* 세부내역 입력/합계 영역 */}
      <MDBox sx={{ overflowX: "auto", borderTop: "1px solid #cfd8e3" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth }}>
          <colgroup><col style={{ width: 130 }} /><col style={{ width: 100 }} /><col style={{ width: 120 }} /><col style={{ width: 250 }} /><col style={{ width: 70 }} /><col style={{ width: 110 }} /><col style={{ width: 96 }} /><col style={{ width: 84 }} /><col style={{ width: 96 }} /></colgroup>
          <thead>
            <tr>
              <th style={th2Cell}>일 자</th>
              <th style={th2Cell}>현장</th>
              <th style={th2Cell}>용도</th>
              <th style={th2Cell}>
                <MDBox sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 24 }}>
                  <MDBox component="span" sx={{ textAlign: "center" }}>세부내역</MDBox>
                  <MDBox sx={{ position: "absolute", right: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <IconButton
                      size="small"
                      sx={detailRowActionBtnSx}
                      title="행 추가"
                      aria-label="행 추가"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addDetailRow();
                      }}
                    >
                      <AddRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={detailRowActionBtnSx}
                      title="행 삭제"
                      aria-label="행 삭제"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeDetailRow();
                      }}
                      disabled={rows.length <= 1}
                    >
                      <RemoveRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </MDBox>
                </MDBox>
              </th>
              <th style={th2Cell}>수량</th>
              <th style={th2Cell}>결제 업체명</th>
              <th style={th2Cell}>공급가액</th>
              <th style={th2Cell}>세액</th>
              <th style={th2Cell}>합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`row-${index}`}>
                {index === 0 && <td style={td2CellCenter} rowSpan={rows.length}><DatePickerText id={draftDateId} value={draftDate} onChange={onChangeDraftDate} inputStyle={inputStyle} inputWidthCh={15} /></td>}
                {index === 0 && <td style={td2CellCenter} rowSpan={rows.length}><BufferedTextField size="small" value={local.place} onCommit={(v) => setField("place", v)} fullWidth sx={inputStyle} /></td>}
                {index === 0 && <td style={td2CellCenter} rowSpan={rows.length}><BufferedTextField size="small" value={local.item_name} onCommit={(v) => setField("item_name", v)} fullWidth sx={inputStyle} /></td>}
                <td style={{ ...td2Cell, textAlign: "center" }}><BufferedTextField size="small" value={String(row.detail_text || "")} onCommit={(v) => setDetailRowField(index, "detail_text", v)} fullWidth sx={{ ...inputStyle, "& .MuiInputBase-input": { textAlign: "center" } }} /></td>
                <td style={td2CellCenter}><BufferedTextField size="small" value={toQtyText(row.qty)} onCommit={(v) => setDetailRowField(index, "qty", v)} fullWidth sx={{ ...inputStyle, "& .MuiInputBase-input": { textAlign: "center" } }} inputProps={{ inputMode: "numeric" }} /></td>
                <td style={td2CellCenter}>
                  <BufferedTextField
                    size="small"
                    value={String(row.use_note || local.use_note || "")}
                    onCommit={(v) => setDetailRowField(index, "use_note", v)}
                    fullWidth
                    sx={inputStyle}
                  />
                </td>
                <td style={td2CellCenter}><BufferedTextField size="small" value={toAmountText(row.amount)} onCommit={(v) => setDetailRowField(index, "amount", num(v))} fullWidth sx={{ ...inputStyle, "& .MuiInputBase-input": { textAlign: "right" } }} inputProps={{ inputMode: "numeric" }} /></td>
                <td style={td2CellCenter}><BufferedTextField size="small" value={toAmountText(row.tax)} onCommit={(v) => setDetailRowField(index, "tax", num(v))} fullWidth sx={{ ...inputStyle, "& .MuiInputBase-input": { textAlign: "right" } }} inputProps={{ inputMode: "numeric" }} /></td>
                <td style={td2CellCenter}><BufferedTextField size="small" value={toAmountText(row.total)} onCommit={(v) => setDetailRowField(index, "total", v)} fullWidth sx={{ ...inputStyle, "& .MuiInputBase-input": { textAlign: "right" } }} inputProps={{ inputMode: "text" }} /></td>
              </tr>
            ))}
            <tr><td style={{ ...th2Cell, height: ROW_H }} colSpan={6}>합계</td><td style={{ ...td2CellCenter, height: ROW_H }}><MDBox sx={{ fontWeight: 800 }}>{toWonText(totals.amount)}</MDBox></td><td style={{ ...td2CellCenter, height: ROW_H }}><MDBox sx={{ fontWeight: 800 }}>{toWonText(totals.tax)}</MDBox></td><td style={{ ...td2CellCenter, height: ROW_H }}><MDBox sx={{ fontWeight: 800 }}>{toWonText(totals.total)}</MDBox></td></tr>
          </tbody>
        </table>
      </MDBox>

      {/* 하단 지급요청/계좌정보 영역 */}
      <MDBox sx={{ overflowX: "auto", borderTop: "1px solid #cfd8e3" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth }}>
          <colgroup><col style={{ width: "15%" }} /><col style={{ width: "35%" }} /><col style={{ width: "15%" }} /><col style={{ width: "35%" }} /></colgroup>
          <tbody>
            <tr>
              <td style={{ ...thCell, height: ROW_H }}>첨부서류</td>
              <td style={{ ...tdCell, padding: "10px 12px" }} colSpan={3}>
                <MDBox sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <MDBox
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: 1,
                    }}
                  >
                    <MDBox sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12 }}>
                        첨부파일 목록
                      </MDBox>
                      <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12, ml: 0.5 }}>
                        (최대 10개)
                      </MDBox>
                    </MDBox>
                  </MDBox>

                  {orderedAttachmentImages.length > 0 && (
                    <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {orderedAttachmentImages.map((img) => {
                        const imageOrder = Number(img?.image_order);
                        const isDeleted = deletedAttachmentOrderSet.has(imageOrder);
                        const fileName = String(img?.image_name || "-");
                        const previewKind = getHeadOfficeDocumentPreviewKind({
                          image_name: img?.image_name,
                          image_path: img?.image_path,
                        });
                        const canPreview =
                          previewKind === "image" || previewKind === "pdf" || previewKind === "excel";
                        const thumbLabel =
                          previewKind === "pdf"
                            ? "PDF"
                            : previewKind === "excel"
                              ? "XLSX"
                              : toFileExtLabel(fileName);
                        const previewKey = `saved-${imageOrder}`;
                        // 관리 상세/작성 화면 모두 DB image_path를 그대로 쓰되,
                        // 브라우저 렌더링 시에는 한글/공백 파일명 문제를 막기 위해 인코딩 URL을 사용한다.
                        const fileOpenUrl = buildHeadOfficeDocumentFileUrl(
                          String(img?.image_path || ""),
                          API_BASE_URL
                        );
                        const fileViewUrl = toHeadOfficeDocumentViewUrl(fileOpenUrl);
                        return (
                          <MDBox
                            key={`saved-image-${imageOrder}`}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1,
                              border: "1px solid #d7dce3",
                              borderRadius: "6px",
                              px: 1,
                              py: 0.5,
                              backgroundColor: "#fafbfc",
                              opacity: isDeleted ? 0.45 : 1,
                              filter: isDeleted ? "blur(1px)" : "none",
                            }}
                          >
                            <MDBox sx={attachmentThumbBoxSx}>
                              {previewKind === "image" ? (
                                canPreview && !isDeleted ? (
                                  <MDBox
                                    component="button"
                                    type="button"
                                    onClick={() => openAttachmentPreview(previewKey)}
                                    sx={{
                                      border: "none",
                                      background: "none",
                                      p: 0,
                                      width: "100%",
                                      height: "100%",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <MDBox
                                      component="img"
                                      src={fileViewUrl}
                                      alt={fileName}
                                      sx={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  </MDBox>
                                ) : (
                                  <MDBox
                                    component="img"
                                    src={fileViewUrl}
                                    alt={fileName}
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                )
                              ) : previewKind === "pdf" ? (
                                // PDF는 목록에서도 첫 페이지가 보이도록 세로 썸네일(iframe)로 노출한다.
                                <MDBox
                                  component={canPreview && !isDeleted ? "button" : "span"}
                                  type={canPreview && !isDeleted ? "button" : undefined}
                                  onClick={canPreview && !isDeleted ? () => openAttachmentPreview(previewKey) : undefined}
                                  sx={{
                                    border: "none",
                                    width: "100%",
                                    height: "100%",
                                    p: 0,
                                    cursor: canPreview && !isDeleted ? "pointer" : "default",
                                    position: "relative",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  <MDBox
                                    component="iframe"
                                    title={`pdf-thumb-saved-${imageOrder}`}
                                    src={toPdfThumbSrc(fileViewUrl)}
                                    loading="lazy"
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      border: 0,
                                      pointerEvents: "none",
                                      backgroundColor: "#fff",
                                    }}
                                  />
                                  <MDBox
                                    component="span"
                                    sx={{
                                      position: "absolute",
                                      right: 4,
                                      bottom: 4,
                                      px: 0.5,
                                      py: 0.1,
                                      borderRadius: "4px",
                                      fontSize: 9,
                                      fontWeight: 800,
                                      color: "#fff",
                                      backgroundColor: "rgba(198, 40, 40, 0.9)",
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    PDF
                                  </MDBox>
                                </MDBox>
                              ) : canPreview && !isDeleted ? (
                                <MDBox
                                  component="button"
                                  type="button"
                                  onClick={() => openAttachmentPreview(previewKey)}
                                  sx={{
                                    border: "none",
                                    width: "100%",
                                    height: "100%",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: "#2e7d32",
                                    backgroundColor: "#e8f5e9",
                                  }}
                                >
                                  {thumbLabel}
                                </MDBox>
                              ) : (
                                <MDBox
                                  component="span"
                                  sx={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: "#2e7d32",
                                    backgroundColor: "#e8f5e9",
                                  }}
                                >
                                  {thumbLabel}
                                </MDBox>
                              )}
                            </MDBox>

                            {isDeleted ? (
                              <MDBox
                                component="span"
                                sx={{
                                  fontSize: 12,
                                  color: "#6b7280",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  textAlign: "left",
                                }}
                              >
                                {fileName}
                              </MDBox>
                            ) : canPreview ? (
                              <button
                                type="button"
                                onClick={() => openAttachmentPreview(previewKey)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  padding: 0,
                                  fontSize: "12px",
                                  color: "#1f4e79",
                                  textDecoration: "underline",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                {fileName}
                              </button>
                            ) : (
                              <a
                                href={fileViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "12px",
                                  color: "#1f4e79",
                                  textDecoration: "underline",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  textAlign: "left",
                                }}
                              >
                                {fileName}
                              </a>
                            )}
                            <MDBox sx={{ display: "inline-flex", alignItems: "center", gap: "4px", mr: 1 }}>
                              <IconButton
                                size="small"
                                component="a"
                                href={fileViewUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "8px",
                                  border: "1px solid #c7d2e6",
                                  backgroundColor: "#f5f8ff",
                                  color: "#1f4e79",
                                  "&:hover": {
                                    backgroundColor: "#eaf2ff",
                                    borderColor: "#95afd6",
                                  },
                                }}
                              >
                                <Download size={17} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color={isDeleted ? "warning" : "error"}
                                onClick={() => {
                                  if (typeof onToggleDeleteAttachment === "function") {
                                    onToggleDeleteAttachment(img);
                                  }
                                }}
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "8px",
                                  border: "1px solid #e2b4b4",
                                  backgroundColor: isDeleted ? "#fff4e5" : "#fff1f1",
                                  "&:hover": {
                                    backgroundColor: isDeleted ? "#ffe8c2" : "#ffe3e3",
                                  },
                                }}
                              >
                                {isDeleted ? <RotateCcw size={17} /> : <Trash2 size={17} />}
                              </IconButton>
                            </MDBox>
                          </MDBox>
                        );
                      })}
                    </MDBox>
                  )}

                  {(Array.isArray(attachmentPendingFiles) ? attachmentPendingFiles : []).length > 0 && (
                    <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {(Array.isArray(attachmentPendingFiles) ? attachmentPendingFiles : []).map(
                        (pending, pendingIndex) => {
                          const previewKey = `pending-${pendingIndex}`;
                          const pendingFileName = String(pending?.file?.name || "-");
                          const pendingExtLabel = toFileExtLabel(pendingFileName);
                          const pendingPreviewKind = getHeadOfficeDocumentPreviewKind(pending?.file);
                          const isPendingImageFile = isHeadOfficeDocumentImageFile(pending?.file);
                          const canPendingPreview =
                            pendingPreviewKind === "image" ||
                            pendingPreviewKind === "pdf" ||
                            pendingPreviewKind === "excel";
                          return (
                            <MDBox
                              key={`pending-image-${pendingIndex}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                border: "1px solid #d6ead3",
                                borderRadius: "6px",
                                px: 1,
                                py: 0.5,
                                backgroundColor: "#f6fff3",
                              }}
                            >
                              <MDBox sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1 }}>
                                <MDBox sx={attachmentThumbBoxSx}>
                                  {isPendingImageFile ? (
                                    <MDBox
                                      component="button"
                                      type="button"
                                      onClick={() => openAttachmentPreview(previewKey)}
                                      sx={{
                                        border: "none",
                                        background: "none",
                                        width: "100%",
                                        height: "100%",
                                        p: 0,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <MDBox
                                        component="img"
                                        src={pending?.previewUrl}
                                        alt={pendingFileName || "preview"}
                                        sx={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    </MDBox>
                                  ) : pendingPreviewKind === "pdf" ? (
                                    <MDBox
                                      component="button"
                                      type="button"
                                      onClick={() => openAttachmentPreview(previewKey)}
                                      sx={{
                                        border: "none",
                                        width: "100%",
                                        height: "100%",
                                        p: 0,
                                        cursor: "pointer",
                                        position: "relative",
                                        backgroundColor: "#fff",
                                      }}
                                    >
                                      <MDBox
                                        component="iframe"
                                        title={`pdf-thumb-pending-${pendingIndex}`}
                                        src={toPdfThumbSrc(pending?.previewUrl)}
                                        loading="lazy"
                                        sx={{
                                          width: "100%",
                                          height: "100%",
                                          border: 0,
                                          pointerEvents: "none",
                                          backgroundColor: "#fff",
                                        }}
                                      />
                                      <MDBox
                                        component="span"
                                        sx={{
                                          position: "absolute",
                                          right: 4,
                                          bottom: 4,
                                          px: 0.5,
                                          py: 0.1,
                                          borderRadius: "4px",
                                          fontSize: 9,
                                          fontWeight: 800,
                                          color: "#fff",
                                          backgroundColor: "rgba(198, 40, 40, 0.9)",
                                          lineHeight: 1.2,
                                        }}
                                      >
                                        PDF
                                      </MDBox>
                                    </MDBox>
                                  ) : canPendingPreview ? (
                                    <MDBox
                                      component="button"
                                      type="button"
                                      onClick={() => openAttachmentPreview(previewKey)}
                                      sx={{
                                        border: "none",
                                        width: "100%",
                                        height: "100%",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: "#2e7d32",
                                        backgroundColor: "#e8f5e9",
                                      }}
                                    >
                                      {pendingPreviewKind === "excel" ? "XLSX" : pendingExtLabel}
                                    </MDBox>
                                  ) : (
                                    <MDBox
                                      component="span"
                                      sx={{
                                        width: "100%",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#1f4e79",
                                        backgroundColor: "#edf4ff",
                                      }}
                                    >
                                      {pendingExtLabel}
                                    </MDBox>
                                  )}
                                </MDBox>
                                {canPendingPreview ? (
                                  <button
                                    type="button"
                                    onClick={() => openAttachmentPreview(previewKey)}
                                    style={{
                                      border: "none",
                                      background: "none",
                                      padding: 0,
                                      fontSize: "12px",
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      flex: 1,
                                      textAlign: "left",
                                      color: "#1f4e79",
                                    }}
                                  >
                                    {pendingFileName}
                                  </button>
                                ) : (
                                  <a
                                    href={pending?.previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: 0,
                                      fontSize: "12px",
                                      textDecoration: "underline",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      flex: 1,
                                      textAlign: "left",
                                      color: "#1f4e79",
                                    }}
                                  >
                                    {pendingFileName}
                                  </a>
                                )}
                              </MDBox>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  if (typeof onRemovePendingAttachment === "function") {
                                    onRemovePendingAttachment(pendingIndex);
                                  }
                                }}
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "8px",
                                  border: "1px solid #e2b4b4",
                                  backgroundColor: "#fff1f1",
                                  mr: 1,
                                  "&:hover": {
                                    backgroundColor: "#ffe3e3",
                                  },
                                }}
                              >
                                <Trash2 size={17} />
                              </IconButton>
                            </MDBox>
                          );
                        }
                      )}
                    </MDBox>
                  )}

                  {orderedAttachmentImages.length === 0 &&
                    (Array.isArray(attachmentPendingFiles) ? attachmentPendingFiles.length : 0) === 0 && (
                      <MDBox component="span" sx={{ fontSize: 11, color: "#8a93a3" }}>
                        첨부된 파일이 없습니다.
                      </MDBox>
                    )}

                  <MDBox sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <input
                      id={attachmentFileInputId}
                      type="file"
                      accept={attachmentAccept}
                      multiple
                      style={{ fontSize: "11px", maxWidth: "320px" }}
                      onChange={(e) => {
                        if (typeof onSelectAttachmentFiles === "function") {
                          onSelectAttachmentFiles(e.target.files);
                        }
                        e.target.value = null;
                      }}
                    />
                    <MDBox component="span" sx={{ fontSize: 11, color: "#c62828", fontWeight: 800 }}>
                      ※ 기안,품의서 / 세금계산서 or 영수증 (스캔하여 반드시 첨부할 것)
                    </MDBox>
                  </MDBox>
                </MDBox>
              </td>
            </tr>
            <tr><td style={{ ...thCell, height: ROW_H }}>지급요청일자</td><td style={{ ...tdCell, height: ROW_H }}><DatePickerText id={requestDateId} value={requestDate} onChange={onChangeRequestDate} inputStyle={inputStyle} inputWidthCh={15} /></td><td style={{ ...thCell, height: ROW_H }}>은행계좌</td><td style={{ ...tdCell, height: ROW_H }}><BufferedTextField size="small" value={local.account_number} onCommit={(v) => setField("account_number", v)} fullWidth sx={inputStyle} /></td></tr>
            <tr><td style={{ ...thCell, height: ROW_H }}>거 래 처</td><td style={{ ...tdCell, height: ROW_H }}><BufferedTextField size="small" value={local.use_note} onCommit={(v) => setField("use_note", v)} fullWidth sx={inputStyle} /></td><td style={{ ...thCell, height: ROW_H }}>예 금 주</td><td style={{ ...tdCell, height: ROW_H }}><BufferedTextField size="small" value={local.account_name} onCommit={(v) => setField("account_name", v)} fullWidth sx={inputStyle} /></td></tr>
            <tr><td style={{ ...thCell, height: ROW_H }}>금 액</td><td style={{ ...tdCell, fontWeight: 700, height: ROW_H }}><MDBox component="span">{toWonText(local.total)}</MDBox></td><td style={{ ...thCell, height: ROW_H }} /><td style={{ ...tdCell, height: ROW_H }} /></tr>
          </tbody>
        </table>
      </MDBox>

      {/* 문서 공통 미리보기 오버레이(utils) 재사용 */}
      <PreviewOverlay
        open={previewOpen}
        files={previewList}
        currentIndex={previewIndex}
        onChangeIndex={setPreviewIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </MDBox>
  );
}

PaymentDocWriteDocumentForm.propTypes = {
  sectionTitle: PropTypes.string.isRequired,
  draftSheet: PropTypes.object.isRequired,
  setDraftSheet: PropTypes.func,
  onDraftSheetBufferChange: PropTypes.func,
  draftDt: PropTypes.string,
  setDraftDt: PropTypes.func,
  startDt: PropTypes.string,
  setStartDt: PropTypes.func,
  isMobile: PropTypes.bool.isRequired,
  inputStyle: PropTypes.object.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  thCell: PropTypes.object.isRequired,
  tdCell: PropTypes.object.isRequired,
  th2Cell: PropTypes.object.isRequired,
  td2Cell: PropTypes.object.isRequired,
  td2CellCenter: PropTypes.object.isRequired,
  attachmentImages: PropTypes.arrayOf(PropTypes.object),
  attachmentPendingFiles: PropTypes.arrayOf(PropTypes.object),
  attachmentDeletedImages: PropTypes.arrayOf(PropTypes.object),
  onSelectAttachmentFiles: PropTypes.func,
  onRemovePendingAttachment: PropTypes.func,
  onToggleDeleteAttachment: PropTypes.func,
  attachmentAccept: PropTypes.string,
};

PaymentDocWriteDocumentForm.defaultProps = {
  setDraftSheet: null,
  onDraftSheetBufferChange: null,
  draftDt: "",
  setDraftDt: null,
  startDt: "",
  setStartDt: null,
  attachmentImages: [],
  attachmentPendingFiles: [],
  attachmentDeletedImages: [],
  onSelectAttachmentFiles: null,
  onRemovePendingAttachment: null,
  onToggleDeleteAttachment: null,
  attachmentAccept: HEADOFFICE_DOCUMENT_FILE_ACCEPT,
};

export default React.memo(PaymentDocWriteDocumentForm);
