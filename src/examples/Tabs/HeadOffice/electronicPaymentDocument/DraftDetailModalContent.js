import React, { useMemo } from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";

// 기안서(D) 관리 상세 본문
// - 백엔드에서 전달된 detailItems 첫 행을 본문 데이터로 사용
// - 스키마 컬럼(title/details/note)을 우선 사용하고, 기존 응답 포맷도 함께 허용한다.
function DraftDetailModalContent({ detailItems, asText, sectionSx, sectionTitleSx, thCell, tdCell }) {
  // 기안서는 단건 본문이므로 0번 행만 읽는다.
  const draftContent = useMemo(() => {
    const first = (detailItems || [])[0] || {};
    return {
      title: asText(first.title) || asText(first.item_name),
      detail: asText(first.details) || asText(first.use_note),
      note: asText(first.note),
    };
  }, [asText, detailItems]);

  return (
    <MDBox sx={sectionSx}>
      <MDBox sx={sectionTitleSx}>기안 내용</MDBox>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        {/* 좌측 라벨/우측 본문 2열 고정 */}
        <colgroup>
          <col style={{ width: 92 }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td style={thCell}>제목</td>
            <td style={tdCell}>{draftContent.title || "-"}</td>
          </tr>
          <tr>
            <td style={thCell}>상세내용</td>
            <td style={tdCell}>
              {/* 상세내용은 길이가 길 수 있어 기본 높이를 보장한다. */}
              <MDBox sx={{ minHeight: 180, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {draftContent.detail || "-"}
              </MDBox>
            </td>
          </tr>
          <tr>
            <td style={thCell}>비고</td>
            <td style={tdCell}>
              <MDBox sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{draftContent.note || "-"}</MDBox>
            </td>
          </tr>
        </tbody>
      </table>
    </MDBox>
  );
}

// ManageTab 공통 본문 렌더 계약(props) 정의
DraftDetailModalContent.propTypes = {
  detailItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  asText: PropTypes.func.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  thCell: PropTypes.object.isRequired,
  tdCell: PropTypes.object.isRequired,
};

export default React.memo(DraftDetailModalContent);
