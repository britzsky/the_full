import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { TextField } from "@mui/material";

import MDBox from "components/MDBox";

// 기안서(D) 작성 본문 컴포넌트
// - 공통 요청정보/결재라인/저장버튼은 상위 SheetTab에서 처리
// - 이 컴포넌트는 "기안 내용(제목/상세내용/비고)" 입력 UI만 담당
function normalizeDraftSheet(v) {
  return {
    title: String(v?.title ?? ""),
    detail: String(v?.detail ?? ""),
    note: String(v?.note ?? ""),
  };
}

function isSameDraftSheet(a, b) {
  return a.title === b.title && a.detail === b.detail && a.note === b.note;
}

function DraftWriteDocumentForm({
  sectionTitle,
  draftSheet,
  setDraftSheet,
  onDraftSheetBufferChange,
  isMobile,
  inputStyle,
  sectionSx,
  sectionTitleSx,
  thCell,
  tdCell,
}) {
  // 상위 전체 탭 리렌더를 줄이기 위해 기안 본문은 로컬 상태로 먼저 받고,
  // 짧은 디바운스로 상위 상태에 반영한다.
  const normalizedDraftSheet = useMemo(() => normalizeDraftSheet(draftSheet), [draftSheet]);
  const [localDraftSheet, setLocalDraftSheet] = useState(normalizedDraftSheet);

  useEffect(() => {
    setLocalDraftSheet((prev) =>
      isSameDraftSheet(prev, normalizedDraftSheet) ? prev : normalizedDraftSheet
    );
  }, [normalizedDraftSheet]);

  const commitToParent = useCallback(
    (nextDraftSheet) => {
      const normalizedNext = normalizeDraftSheet(nextDraftSheet);
      onDraftSheetBufferChange(normalizedNext);
      setDraftSheet((prev) => {
        const normalizedPrev = normalizeDraftSheet(prev);
        if (isSameDraftSheet(normalizedPrev, normalizedNext)) return prev;
        return { ...prev, ...normalizedNext };
      });
    },
    [onDraftSheetBufferChange, setDraftSheet]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      commitToParent(localDraftSheet);
    }, 120);
    return () => clearTimeout(timer);
  }, [localDraftSheet, commitToParent]);

  const onChangeField = useCallback((key, value) => {
    setLocalDraftSheet((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });
  }, []);

  return (
    <MDBox sx={sectionSx}>
      {/* 상위 탭에서 전달한 섹션 제목(예: 기안 내용) */}
      <MDBox sx={sectionTitleSx}>{sectionTitle}</MDBox>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        {/* 좌측 라벨 고정폭 + 우측 입력영역 가변폭 */}
        <colgroup>
          <col style={{ width: isMobile ? 82 : 92 }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...thCell, width: isMobile ? 82 : 92, padding: "6px 6px" }}>제목</td>
            <td style={{ ...tdCell, padding: "4px 2px" }}>
              <TextField
                size="small"
                value={localDraftSheet.title}
                onChange={(e) => onChangeField("title", e.target.value)}
                onBlur={() => commitToParent(localDraftSheet)}
                fullWidth
                sx={inputStyle}
              />
            </td>
          </tr>
          <tr>
            <td style={{ ...thCell, width: isMobile ? 82 : 92, padding: "6px 6px" }}>상세내용</td>
            <td style={{ ...tdCell, padding: "4px 2px" }}>
              <TextField
                size="small"
                multiline
                minRows={10}
                value={localDraftSheet.detail}
                onChange={(e) => onChangeField("detail", e.target.value)}
                onBlur={() => commitToParent(localDraftSheet)}
                fullWidth
                sx={inputStyle}
              />
            </td>
          </tr>
          <tr>
            <td style={{ ...thCell, width: isMobile ? 82 : 92, padding: "6px 6px" }}>비고</td>
            <td style={{ ...tdCell, padding: "4px 2px" }}>
              <TextField
                size="small"
                multiline
                minRows={4}
                value={localDraftSheet.note}
                onChange={(e) => onChangeField("note", e.target.value)}
                onBlur={() => commitToParent(localDraftSheet)}
                fullWidth
                sx={inputStyle}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </MDBox>
  );
}

// 상위에서 전달받는 공통 스타일/상태의 형태를 고정해
// 문서 컴포넌트 분리 시 런타임 오류를 줄인다.
DraftWriteDocumentForm.propTypes = {
  sectionTitle: PropTypes.string.isRequired,
  draftSheet: PropTypes.shape({
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    note: PropTypes.string.isRequired,
  }).isRequired,
  setDraftSheet: PropTypes.func.isRequired,
  onDraftSheetBufferChange: PropTypes.func.isRequired,
  isMobile: PropTypes.bool.isRequired,
  inputStyle: PropTypes.object.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  thCell: PropTypes.object.isRequired,
  tdCell: PropTypes.object.isRequired,
};

export default React.memo(DraftWriteDocumentForm);
