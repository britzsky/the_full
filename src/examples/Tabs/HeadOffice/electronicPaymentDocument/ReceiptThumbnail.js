import React from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";
import { API_BASE_URL } from "config";
import { getHeadOfficeDocumentPreviewKind } from "utils/headOfficeDocumentImageUtils";

// 품목 행 안에 들어가는 영수증 썸네일 크기 (세로형 직사각형)
const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 96;

// PDF 파일은 썸네일에서 첫 페이지를 축소해서 보여준다.
function toPdfThumbSrc(fileUrl) {
  const baseUrl = String(fileUrl ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

// 파일명 확장자를 썸네일 라벨로 변환
function toFileExtLabel(name) {
  const text = String(name || "");
  return text.includes(".") ? text.split(".").pop().toUpperCase() : "FILE";
}

// 서버에 저장된 첨부파일 목록을 image_order 순서의 썸네일 카드 목록으로 변환한다.
// - 파일은 지출결의서 상세와 같은 payment_id + image_order 전용 조회 API로 불러온다.
// - 개인구매(FR)는 품목 순서대로 영수증을 올리므로 n번째 카드 = n번째 품목의 영수증이다.
export function toSavedReceiptCards(files, viewerUserId) {
  const userIdText = String(viewerUserId ?? "").trim();
  const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");
  return (Array.isArray(files) ? files : [])
    .slice()
    .sort((a, b) => Number(a?.image_order || 0) - Number(b?.image_order || 0))
    .map((file) => {
      const params = new URLSearchParams({
        payment_id: String(file?.payment_id ?? ""),
        image_order: String(file?.image_order ?? ""),
        user_id: userIdText,
      });
      return {
        key: `saved-${file?.image_order}`,
        url: `${apiBase}/HeadOffice/ElectronicPaymentDocumentFileView?${params.toString()}`,
        name: String(file?.image_name || "-"),
        kind: getHeadOfficeDocumentPreviewKind({
          image_name: file?.image_name,
          image_path: file?.image_path,
        }),
      };
    });
}

// 상신 전 브라우저에만 있는 첨부 대기 파일({ file, previewUrl })을 썸네일 카드로 변환한다.
export function toPendingReceiptCard(pending, key) {
  return {
    key,
    url: String(pending?.previewUrl || ""),
    name: String(pending?.file?.name || "-"),
    kind: getHeadOfficeDocumentPreviewKind(pending?.file),
  };
}

// PreviewOverlay에 넘길 수 있는 카드(이미지/PDF/엑셀)인지 판정
export const isPreviewableReceiptCard = (card) =>
  card?.kind === "image" || card?.kind === "pdf" || card?.kind === "excel";

// 영수증 썸네일 1장 - 이미지/PDF 첫 페이지/확장자 라벨 + 파일명, 클릭 시 미리보기
function ReceiptThumbnail({ card, onOpen, onRemove }) {
  const canPreview = isPreviewableReceiptCard(card) && typeof onOpen === "function";

  return (
    <MDBox sx={{ width: THUMB_WIDTH, position: "relative", mx: "auto" }}>
      {/* 파일 종류별 썸네일 영역 */}
      <MDBox
        component={canPreview ? "button" : "div"}
        type={canPreview ? "button" : undefined}
        onClick={canPreview ? () => onOpen(card) : undefined}
        sx={{
          position: "relative",
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          p: 0,
          borderRadius: "6px",
          overflow: "hidden",
          border: "1px solid #d0d7e2",
          backgroundColor: "#f1f4f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: canPreview ? "pointer" : "default",
        }}
      >
        {card.kind === "image" ? (
          <MDBox
            component="img"
            src={card.url}
            alt={card.name}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : card.kind === "pdf" ? (
          <>
            <MDBox
              component="iframe"
              title={`pdf-thumb-${card.key}`}
              src={toPdfThumbSrc(card.url)}
              loading="lazy"
              sx={{ width: "100%", height: "100%", border: 0, pointerEvents: "none", backgroundColor: "#fff" }}
            />
            <MDBox
              component="span"
              sx={{
                position: "absolute",
                right: 4,
                bottom: 4,
                px: 0.5,
                borderRadius: "4px",
                fontSize: 9,
                fontWeight: 800,
                color: "#fff",
                backgroundColor: "rgba(198, 40, 40, 0.9)",
                lineHeight: 1.4,
              }}
            >
              PDF
            </MDBox>
          </>
        ) : (
          <MDBox
            component="span"
            sx={{ fontSize: 13, fontWeight: 800, color: card.kind === "excel" ? "#2e7d32" : "#1f4e79" }}
          >
            {card.kind === "excel" ? "XLSX" : toFileExtLabel(card.name)}
          </MDBox>
        )}
      </MDBox>

      {/* 첨부 대기 파일 삭제 버튼 (썸네일 우측 상단) */}
      {typeof onRemove === "function" && (
        <MDBox
          component="button"
          type="button"
          title="삭제"
          onClick={() => onRemove(card)}
          sx={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "none",
            backgroundColor: "rgba(198, 40, 40, 0.9)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: "18px",
            p: 0,
            cursor: "pointer",
          }}
        >
          ×
        </MDBox>
      )}

      {/* 파일명 (1줄, 넘치면 말줄임) */}
      <MDBox
        title={card.name}
        sx={{
          mt: 0.25,
          fontSize: 10,
          color: "#1f4e79",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {card.name}
      </MDBox>
    </MDBox>
  );
}

ReceiptThumbnail.propTypes = {
  card: PropTypes.shape({
    key: PropTypes.string,
    url: PropTypes.string,
    name: PropTypes.string,
    kind: PropTypes.string,
  }).isRequired,
  onOpen: PropTypes.func,
  onRemove: PropTypes.func,
};

ReceiptThumbnail.defaultProps = {
  onOpen: null,
  onRemove: null,
};

export default ReceiptThumbnail;
