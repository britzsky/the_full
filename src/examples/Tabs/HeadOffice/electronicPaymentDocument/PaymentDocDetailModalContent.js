import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Download } from "lucide-react";

import MDBox from "components/MDBox";
import { API_BASE_URL } from "config";
import api from "api/api";
import {
  getHeadOfficeDocumentPreviewKind,
} from "utils/headOfficeDocumentImageUtils";
import PreviewOverlay from "utils/PreviewOverlay";
// 작성 화면과 동일한 행 높이 기준
const ROW_H = 42;
const PAYMENT_TYPE = Object.freeze({
  CASH: 1,
  CARD: 2,
  TRANSFER: 3,
  AUTO: 4,
  OTHER: 5,
});

const attachmentThumbBoxSx = {
  // 사용자 요청: 첨부파일 썸네일은 가로형이 아니라 세로형 직사각형으로 노출
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

// PDF 파일은 목록에서 첫 페이지를 축소해서 보여준다.
function toPdfThumbSrc(fileUrl) {
  const baseUrl = String(fileUrl ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

// 금액 문자열 숫자 변환
function toNumberValue(v) {
  const raw = String(v ?? "")
    .replace(/,/g, "")
    .trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// 금액 표시 문자열 변환
function toAmountText(v) {
  const n = toNumberValue(v);
  return n !== 0 ? n.toLocaleString("ko-KR") : "";
}

// 작성 폼 합계 표시와 동일하게 통화 문자열(₩ + 천단위 콤마)로 변환
function toWonText(v) {
  const n = toNumberValue(v);
  return n !== 0 ? `₩\u00A0\u00A0${n.toLocaleString("ko-KR")}` : "-";
}

// 지급구분 상세 문자열을 화면 노출용으로 정리한다.
function toPaymentTypeDetailText(typeCode, rawDetail) {
  const detailText = String(rawDetail ?? "").trim();
  if (!detailText) return "-";
  if (Number(typeCode) !== PAYMENT_TYPE.CARD) return detailText;

  const tail = detailText.replace(/[^\d]/g, "").slice(-4);
  if (!tail) return detailText;
  return `****-****-****-${tail}`;
}

// 날짜/일시 문자열을 화면용 YYYY-MM-DD로 정리한다.
function toDateText(v) {
  const text = String(v ?? "").trim();
  const matched = text.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
  if (!matched) return "";
  return `${matched[1]}-${matched[2]}-${matched[3]}`;
}

// 지출결의서 상세 본문 컴포넌트
function PaymentDocDetailModalContent({
  detailItems,
  detailFiles,
  detailMain,
  viewerUserId,
  asText,
  sectionSx,
  sectionTitleSx,
  thCell,
  tdCell,
  th2Cell,
  td2CellCenter,
  td2CellWrap,
}) {
  // 지출결의서는 payment_id 1건에 detail 행(item_name)이 여러 건 들어올 수 있다.
  // 따라서 상세 모달도 1행 고정이 아니라, detailItems 전체를 세부내역으로 렌더한다.
  const paymentDocRows = useMemo(
    () =>
      (Array.isArray(detailItems) ? detailItems : []).map((row, idx) => {
        const qty = toNumberValue(row?.qty);
        const price = toNumberValue(row?.price);
        const amount = toNumberValue(row?.amount);
        const tax = toNumberValue(row?.tax);
        const rowTotal = price !== 0 ? price : amount + tax;

        return {
          key: asText(row?.idx) || `row-${idx}`,
          place: asText(row?.place),
          use_name: asText(row?.use_name),
          item_name: asText(row?.item_name),
          use_note: asText(row?.use_note),
          qty,
          price,
          amount,
          tax,
          rowTotal,
          title: asText(row?.title),
          content: asText(row?.content),
          account_number: asText(row?.account_number),
          biz_no: asText(row?.biz_no),
          account_name: asText(row?.account_name),
          total: toNumberValue(row?.total),
          request_dt: asText(row?.request_dt),
          payment_type: toNumberValue(row?.payment_type),
          payment_type_detail: asText(row?.payment_type_detail),
        };
      }),
    [asText, detailItems]
  );

  // 문서 공통 헤더 정보는 첫 행 기준으로 읽되, 금액은 전체 합계를 기준으로 계산한다.
  const paymentDoc = useMemo(() => {
    const first = paymentDocRows[0] || {};
    const amountSum = paymentDocRows.reduce((acc, row) => acc + row.amount, 0);
    const taxSum = paymentDocRows.reduce((acc, row) => acc + row.tax, 0);
    const rowTotalSum = paymentDocRows.reduce((acc, row) => acc + row.rowTotal, 0);
    const docTotal = first.total !== 0 ? first.total : rowTotalSum;

    return {
      title: first.title || first.item_name || "-",
      content: first.content || "-",
      account_number: first.account_number || "-",
      biz_no: first.biz_no || "-",
      account_name: first.account_name || "-",
      vendor_display_name: first.use_note || "-",
      amountSum,
      taxSum,
      docTotal,
      request_dt: asText(first.request_dt),
      payment_type: toNumberValue(first.payment_type),
      payment_type_detail: asText(first.payment_type_detail) || asText(first.biz_no),
    };
  }, [paymentDocRows]);
  const draftDateText = useMemo(() => toDateText(detailMain?.draft_dt), [detailMain?.draft_dt]);
  const requestDateText = useMemo(
    () => toDateText(paymentDoc.request_dt) || toDateText(detailMain?.start_dt),
    [paymentDoc.request_dt, detailMain?.start_dt]
  );

  const orderedDetailFiles = useMemo(
    () =>
      (Array.isArray(detailFiles) ? detailFiles : [])
        .slice()
        .sort((a, b) => Number(a?.image_order || 0) - Number(b?.image_order || 0)),
    [detailFiles]
  );
  // 첨부파일 미리보기 팝업 상태
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 전자결재 첨부파일은 정적 /image 경로 대신
  // payment_id + image_order 기준 전용 스트림 API로 조회한다.
  const toStoredFileUrl = useCallback(
    (file) => {
      const paymentIdText = asText(file?.payment_id);
      const imageOrder = Number(file?.image_order);
      const userIdText = asText(viewerUserId);
      if (!paymentIdText || !Number.isFinite(imageOrder) || imageOrder <= 0 || !userIdText) {
        return "";
      }

      const params = new URLSearchParams();
      params.set("payment_id", paymentIdText);
      params.set("image_order", String(imageOrder));
      params.set("user_id", userIdText);

      const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");
      return `${apiBase}/HeadOffice/ElectronicPaymentDocumentFileView?${params.toString()}`;
    },
    [asText, viewerUserId]
  );
  // 서버 첨부파일을 미리보기 목록으로 변환한다. (이미지/PDF/엑셀)
  const detailFilePreviewList = useMemo(
    () =>
      orderedDetailFiles
        .map((file) => ({
          // DB image_path는 한글 파일명/공백이 섞일 수 있어
          // 파일명 대신 전용 조회 API를 사용해 인코딩 문제를 제거한다.
          url: toStoredFileUrl(file),
          name: asText(file?.image_name) || "-",
          order: Number(file?.image_order || 0),
          kind: getHeadOfficeDocumentPreviewKind({
            image_name: file?.image_name,
            image_path: file?.image_path,
          }),
        }))
        .filter(
          (file) => file.kind === "image" || file.kind === "pdf" || file.kind === "excel"
        ),
    [orderedDetailFiles, asText, toStoredFileUrl]
  );
  // 파일명 클릭 시 미리보기 열기
  const openFilePreview = useCallback(
    (imageOrder) => {
      if (!detailFilePreviewList.length) return;
      const startIndex = detailFilePreviewList.findIndex(
        (img) => Number(img.order) === Number(imageOrder)
      );
      setPreviewList(detailFilePreviewList);
      setCurrentIndex(startIndex >= 0 ? startIndex : 0);
      setPreviewOpen(true);
    },
    [detailFilePreviewList]
  );
  const handleDownloadFile = useCallback(async (file) => {
    const fileUrl = toStoredFileUrl(file);
    if (!fileUrl) return;

    const fallbackPath = asText(file?.image_path);
    const filename = asText(file?.image_name) || fallbackPath.split("/").pop() || "download";

    try {
      const res = await api.get(fileUrl, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (err) {
      console.error("전자결재 첨부파일 다운로드 실패:", err);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [asText, toStoredFileUrl]);
  const handleAttachmentPreview = useCallback((file) => {
    const previewKind = getHeadOfficeDocumentPreviewKind({
      image_name: file?.image_name,
      image_path: file?.image_path,
    });

    // PDF도 이미지와 동일한 PreviewOverlay 흐름으로 연다.
    if (previewKind === "image" || previewKind === "pdf" || previewKind === "excel") {
      openFilePreview(file?.image_order);
    }
  }, [openFilePreview]);

  // 표 최소 너비 기준값 정의
  const minTableWidth = 1200;
  // 세부내역 대표값(작성 폼 rowSpan 표시용) 계산
  const firstDetailRow = paymentDocRows[0] || null;
  // 지급구분 상세 표시값 계산
  const selectedPaymentType = Number(paymentDoc.payment_type || 0);
  const selectedPaymentTypeDetail = toPaymentTypeDetailText(
    selectedPaymentType,
    paymentDoc.payment_type_detail
  );
  const paymentTypeDetailText = useMemo(
    () => ({
      cash: selectedPaymentType === PAYMENT_TYPE.CASH ? selectedPaymentTypeDetail : "-",
      card: selectedPaymentType === PAYMENT_TYPE.CARD ? selectedPaymentTypeDetail : "-",
      transfer: selectedPaymentType === PAYMENT_TYPE.TRANSFER ? selectedPaymentTypeDetail : "-",
      auto: selectedPaymentType === PAYMENT_TYPE.AUTO ? selectedPaymentTypeDetail : "-",
      other: selectedPaymentType === PAYMENT_TYPE.OTHER ? selectedPaymentTypeDetail : "-",
    }),
    [selectedPaymentType, selectedPaymentTypeDetail]
  );

  return (
    <MDBox sx={sectionSx}>
      {/* 섹션 제목 영역 */}
      <MDBox sx={sectionTitleSx}>지출 내용</MDBox>

      {/* 상단 지출정보/지급구분 영역 (작성 화면 포맷과 동일하게 유지) */}
      <MDBox sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: minTableWidth }}>
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "10.5%" }} />
            <col style={{ width: "10.5%" }} />
            <col style={{ width: "10.5%" }} />
            <col style={{ width: "10.5%" }} />
            <col style={{ width: "16.7%" }} />
            <col style={{ width: "16.65%" }} />
            <col style={{ width: "16.65%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td
                style={{
                  ...tdCell,
                  textAlign: "center",
                  verticalAlign: "middle",
                  fontWeight: 700,
                  height: ROW_H * 3,
                }}
                colSpan={5}
                rowSpan={3}
              >
                다음과 같이 지급(대체)하고자 하오니 승인하여 주시기 바랍니다.
              </td>
              <td style={{ ...tdCell, padding: 0 }} colSpan={3} rowSpan={5}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "30%" }} />
                  </colgroup>
                  <tbody>
                    <tr
                      style={{
                        height: ROW_H,
                        backgroundColor: selectedPaymentType === PAYMENT_TYPE.CASH ? "#eaf2ff" : "#fff",
                      }}
                    >
                      <td style={{ ...thCell, borderLeft: "none", borderTop: "none", borderBottom: "none" }} rowSpan={5}>
                        지급구분
                      </td>
                      <td style={{ ...thCell, borderTop: "none" }}>현 금</td>
                      <td style={{ ...tdCell, borderTop: "none" }}>현금영수증</td>
                      <td style={{ ...tdCell, borderRight: "none" }}>{paymentTypeDetailText.cash}</td>
                    </tr>
                    <tr
                      style={{
                        height: ROW_H,
                        backgroundColor: selectedPaymentType === PAYMENT_TYPE.CARD ? "#eaf2ff" : "#fff",
                      }}
                    >
                      <td style={thCell}>법인카드</td>
                      <td style={tdCell}>카드전표</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}>
                        {paymentTypeDetailText.card}
                      </td>
                    </tr>
                    <tr
                      style={{
                        height: ROW_H,
                        backgroundColor: selectedPaymentType === PAYMENT_TYPE.TRANSFER ? "#eaf2ff" : "#fff",
                      }}
                    >
                      <td style={thCell}>계좌이체</td>
                      <td style={tdCell}>세금계산서</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}>
                        {paymentTypeDetailText.transfer}
                      </td>
                    </tr>
                    <tr
                      style={{
                        height: ROW_H,
                        backgroundColor: selectedPaymentType === PAYMENT_TYPE.AUTO ? "#eaf2ff" : "#fff",
                      }}
                    >
                      <td style={thCell} colSpan={2}>자동이체</td>
                      <td style={{ ...tdCell, borderRight: "none", borderLeft: "none" }}>
                        {paymentTypeDetailText.auto}
                      </td>
                    </tr>
                    <tr
                      style={{
                        height: ROW_H,
                        backgroundColor: selectedPaymentType === PAYMENT_TYPE.OTHER ? "#eaf2ff" : "#fff",
                      }}
                    >
                      <td style={{ ...thCell, borderBottom: "none" }} colSpan={2}>기타납부</td>
                      <td style={{ ...tdCell, borderRight: "none", borderBottom: "none", borderLeft: "none" }}>
                        {paymentTypeDetailText.other}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr />
            <tr />
            <tr>
              <td style={thCell}>지 출 명</td>
              <td style={{ ...tdCell, height: ROW_H }} colSpan={4}>
                {paymentDoc.title || "-"}
              </td>
            </tr>
            <tr>
              <td style={thCell}>금 액</td>
              <td style={{ ...tdCell, textAlign: "center", height: ROW_H }} colSpan={4}>
                <MDBox component="span" sx={{ fontWeight: 700 }}>
                  {toWonText(paymentDoc.docTotal)}
                </MDBox>
              </td>
            </tr>
            <tr>
              <td style={thCell}>내 용</td>
              <td style={tdCell} colSpan={7}>
                <MDBox sx={{ minHeight: 160, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {paymentDoc.content || "-"}
                </MDBox>
              </td>
            </tr>
          </tbody>
        </table>
      </MDBox>

      {/* 중단 세부내역/공급가액/세액/합계 영역 */}
      <MDBox sx={{ overflowX: "auto", borderTop: "1px solid #cfd8e3" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: minTableWidth }}>
          <colgroup>
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 250 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th2Cell}>일 자</th>
              <th style={th2Cell}>현장</th>
              <th style={th2Cell}>용도</th>
              <th style={th2Cell}>세부내역</th>
              <th style={th2Cell}>수량</th>
              <th style={th2Cell}>결제 업체명</th>
              <th style={th2Cell}>공급가액</th>
              <th style={th2Cell}>세액</th>
              <th style={th2Cell}>합계</th>
            </tr>
          </thead>
          <tbody>
            {/* 세부내역은 payment_doc 다건(rows) 기준으로 모두 출력 */}
            {paymentDocRows.length === 0 ? (
              <tr>
                <td style={{ ...td2CellCenter, padding: "14px" }} colSpan={9}>
                  등록된 세부내역이 없습니다.
                </td>
              </tr>
            ) : (
              // 작성 폼과 같은 포맷으로, 공통값은 첫 행에서 rowSpan으로 병합해 출력한다.
              paymentDocRows.map((row, index) => (
                <tr key={row.key}>
                  {index === 0 && (
                    <td style={td2CellCenter} rowSpan={paymentDocRows.length}>
                      {draftDateText || requestDateText || "-"}
                    </td>
                  )}
                  {index === 0 && (
                    <td style={td2CellCenter} rowSpan={paymentDocRows.length}>
                      {firstDetailRow?.place || "-"}
                    </td>
                  )}
                  {index === 0 && (
                    <td style={td2CellCenter} rowSpan={paymentDocRows.length}>
                      {firstDetailRow?.use_name || "-"}
                    </td>
                  )}
                  <td style={td2CellWrap}>{row.item_name || "-"}</td>
                  <td style={td2CellCenter}>{row.qty > 0 ? row.qty.toLocaleString("ko-KR") : "-"}</td>
                  <td style={td2CellCenter}>{row.use_note || paymentDoc.vendor_display_name || "-"}</td>
                  <td style={td2CellCenter}>{toAmountText(row.amount) || "-"}</td>
                  <td style={td2CellCenter}>{toAmountText(row.tax) || "-"}</td>
                  <td style={td2CellCenter}>{toAmountText(row.rowTotal) || "-"}</td>
                </tr>
              ))
            )}
            {/* 세부내역 합계 행 */}
            <tr>
              <td style={{ ...th2Cell, height: ROW_H }} colSpan={6}>
                합계
              </td>
              <td style={{ ...td2CellCenter, height: ROW_H }}>
                <MDBox sx={{ fontWeight: 800 }}>{toWonText(paymentDoc.amountSum)}</MDBox>
              </td>
              <td style={{ ...td2CellCenter, height: ROW_H }}>
                <MDBox sx={{ fontWeight: 800 }}>{toWonText(paymentDoc.taxSum)}</MDBox>
              </td>
              <td style={{ ...td2CellCenter, height: ROW_H }}>
                <MDBox sx={{ fontWeight: 800 }}>{toWonText(paymentDoc.docTotal)}</MDBox>
              </td>
            </tr>
          </tbody>
        </table>
      </MDBox>

      {/* 하단 지급요청/계좌정보 영역 */}
      <MDBox sx={{ overflowX: "auto", borderTop: "1px solid #cfd8e3" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: minTableWidth }}>
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "35%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "35%" }} />
          </colgroup>
          <tbody>
            {/* 첨부서류 안내 행 */}
            <tr>
              <td style={{ ...thCell, height: ROW_H }}>첨부서류</td>
              <td style={{ ...tdCell, padding: "10px 12px" }} colSpan={3}>
                <MDBox sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <MDBox
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <MDBox component="span" sx={{ fontWeight: 700, color: "#1f4e79", fontSize: 12 }}>
                      첨부파일 목록
                    </MDBox>
                    <MDBox component="span" sx={{ fontSize: 11, color: "#6b7280" }}>
                      {`${orderedDetailFiles.length}/10`}
                    </MDBox>
                  </MDBox>

                  {orderedDetailFiles.length > 0 ? (
                    <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {orderedDetailFiles.map((file) => {
                        const fileName = asText(file.image_name) || "-";
                        const fileViewUrl = toStoredFileUrl(file);
                        const previewKind = getHeadOfficeDocumentPreviewKind({
                          image_name: file?.image_name,
                          image_path: file?.image_path,
                        });
                        // PDF는 membersheet와 동일하게 DB 경로를 직접 iframe에 태우지 않고
                        // 목록에서는 라벨만 보여준 뒤 blob 미리보기만 호출한다.
                        const canPreview =
                          !!fileViewUrl &&
                          (previewKind === "image" || previewKind === "pdf" || previewKind === "excel");
                        const thumbLabel =
                          previewKind === "pdf"
                            ? "PDF"
                            : previewKind === "excel"
                              ? "XLSX"
                              : String(fileName).includes(".")
                                ? String(fileName).split(".").pop().toUpperCase()
                                : "FILE";
                        return (
                          <MDBox
                            key={`payment-file-${file.image_order}`}
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
                            }}
                          >
                            <MDBox sx={attachmentThumbBoxSx}>
                              {previewKind === "image" ? (
                                <MDBox
                                  component={canPreview ? "button" : "span"}
                                  type={canPreview ? "button" : undefined}
                                  onClick={
                                   canPreview
                                      ? (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAttachmentPreview(file);
                                      }
                                      : undefined
                                  }
                                  sx={{
                                    border: "none",
                                    background: "none",
                                    p: 0,
                                    width: "100%",
                                    height: "100%",
                                    cursor: canPreview ? "pointer" : "default",
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
                              ) : previewKind === "pdf" ? (
                                <MDBox
                                  component={canPreview ? "button" : "span"}
                                  type={canPreview ? "button" : undefined}
                                  onClick={
                                    canPreview
                                      ? (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAttachmentPreview(file);
                                      }
                                      : undefined
                                  }
                                  sx={{
                                    border: "none",
                                    width: "100%",
                                    height: "100%",
                                    p: 0,
                                    cursor: canPreview ? "pointer" : "default",
                                    position: "relative",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  <MDBox
                                    component="iframe"
                                    title={`pdf-thumb-detail-${file.image_order}`}
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
                              ) : canPreview ? (
                                <MDBox
                                  component="button"
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAttachmentPreview(file);
                                  }}
                                  sx={{
                                    border: "none",
                                    width: "100%",
                                    height: "100%",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: previewKind === "pdf" ? "#c62828" : "#2e7d32",
                                    backgroundColor: previewKind === "pdf" ? "#ffebee" : "#e8f5e9",
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
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#1f4e79",
                                    backgroundColor: "#edf4ff",
                                  }}
                                >
                                  {thumbLabel}
                                </MDBox>
                              )}
                            </MDBox>
                            {canPreview ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAttachmentPreview(file);
                                }}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDownloadFile(file);
                                }}
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
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDownloadFile(file);
                              }}
                              style={{
                                border: "1px solid #c7d2e6",
                                color: "#1f4e79",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "30px",
                                height: "30px",
                                borderRadius: "8px",
                                backgroundColor: "#f5f8ff",
                                marginRight: "8px",
                                flexShrink: 0,
                                cursor: "pointer",
                              }}
                            >
                              <Download size={17} />
                            </button>
                          </MDBox>
                        );
                      })}
                    </MDBox>
                  ) : (
                    <MDBox component="span" sx={{ color: "#d32f2f", fontSize: 12 }}>
                      기안/품의서, 세금계산서/영수증 파일을 첨부해주세요. (이미지/PDF/Excel 허용)
                    </MDBox>
                  )}
                </MDBox>
              </td>
            </tr>
            {/* 지급요청일자/은행계좌 행 */}
            <tr>
              <td style={{ ...thCell, height: ROW_H }}>지급요청일자</td>
              <td style={{ ...tdCell, height: ROW_H }}>{requestDateText || "-"}</td>
              <td style={{ ...thCell, height: ROW_H }}>은행계좌</td>
              <td style={{ ...tdCell, height: ROW_H }}>{paymentDoc.account_number || "-"}</td>
            </tr>
            {/* 거래처/예금주 행 (작성 화면과 동일 포맷) */}
            <tr>
              <td style={{ ...thCell, height: ROW_H }}>거 래 처</td>
              <td style={{ ...tdCell, height: ROW_H }}>{paymentDoc.vendor_display_name || "-"}</td>
              <td style={{ ...thCell, height: ROW_H }}>예 금 주</td>
              <td style={{ ...tdCell, height: ROW_H }}>{paymentDoc.account_name || "-"}</td>
            </tr>
            {/* 금액 행 (작성 화면과 동일 포맷) */}
            <tr>
              <td style={{ ...thCell, height: ROW_H }}>금 액</td>
              <td style={{ ...tdCell, fontWeight: 700, height: ROW_H }}>
                <MDBox component="span">{toWonText(paymentDoc.docTotal)}</MDBox>
              </td>
              <td style={{ ...thCell, height: ROW_H }} />
              <td style={{ ...tdCell, height: ROW_H }} />
            </tr>
          </tbody>
        </table>
      </MDBox>

      {/* 문서 공통 미리보기 오버레이(utils) 재사용 */}
      <PreviewOverlay
        open={previewOpen}
        files={previewList}
        currentIndex={currentIndex}
        onChangeIndex={setCurrentIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </MDBox>
  );
}

PaymentDocDetailModalContent.propTypes = {
  detailItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  detailFiles: PropTypes.arrayOf(PropTypes.object),
  detailMain: PropTypes.object,
  viewerUserId: PropTypes.string,
  asText: PropTypes.func.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  thCell: PropTypes.object.isRequired,
  tdCell: PropTypes.object.isRequired,
  th2Cell: PropTypes.object.isRequired,
  td2CellCenter: PropTypes.object.isRequired,
  td2CellWrap: PropTypes.object.isRequired,
};

PaymentDocDetailModalContent.defaultProps = {
  detailFiles: [],
  detailMain: null,
  viewerUserId: "",
};

export default React.memo(PaymentDocDetailModalContent);
