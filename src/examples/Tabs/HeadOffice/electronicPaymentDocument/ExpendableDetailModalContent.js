import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";

// 금액 문자열을 숫자로 안전 변환한다.
// - 콤마 제거
// - 빈값/NaN 방어
function toNumberValue(v) {
  const raw = String(v ?? "")
    .replace(/,/g, "")
    .trim();
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// 숫자를 한글 금액 표기(1,234) 형태로 노출한다.
function toAmountText(v) {
  const n = toNumberValue(v);
  if (n === null) return "-";
  return n.toLocaleString("ko-KR");
}

function toYnValue(v) {
  return String(v ?? "").trim().toUpperCase() === "Y";
}

const tableCellCenterInnerSx = {
  width: "100%",
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const nativeCheckboxCenterStyle = {
  display: "block",
  margin: 0,
  verticalAlign: "middle",
  width: 18,
  height: 18,
  accentColor: "#1f4e79",
};

// 소모품 구매 품의서(E) 관리 상세 본문
// - 품목 내역 표 + 총 금액 + 요청 사유 블록 구성
// - 결재 라인/결재 처리 표는 상위 ManageTab에서 공통 렌더
function ExpendableDetailModalContent({
  detailItems,
  asText,
  sectionSx,
  sectionTitleSx,
  th2Cell,
  td2CellCenter,
  td2CellWrap,
  td2CellLink,
  totalAmountRowSx,
  requestNoteBodySx,
  showBuyYnColumn,
  editableBuyYn,
  buyYnSavingIdx,
  onToggleBuyYn,
}) {
  // 요청 사유는 item.payment_note 중 첫 유효값을 대표값으로 사용
  const paymentNoteText = useMemo(() => {
    const found = (detailItems || []).find((it) => asText(it.payment_note));
    return asText(found?.payment_note) || "-";
  }, [asText, detailItems]);

  // 합계는 표시 전용 계산값이며 저장값을 변경하지 않는다.
  const totalAmountText = useMemo(() => {
    const sum = (detailItems || []).reduce((acc, it) => {
      if (!toYnValue(it?.buy_yn)) return acc;
      const amount = toNumberValue(it?.price);
      return acc + (amount || 0);
    }, 0);
    return sum.toLocaleString("ko-KR");
  }, [detailItems]);

  const openLink = useCallback((url) => {
    const trimmed = String(url ?? "").trim();
    if (!trimmed) return;

    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;

    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <>
      <MDBox sx={sectionSx}>
        <MDBox sx={sectionTitleSx}>품목 내역</MDBox>
        <MDBox sx={{ overflowX: "auto" }}>
          {/* 상세 모달 본문에서 열 맞춤을 위해 고정 레이아웃 사용 */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: showBuyYnColumn ? 720 : 640,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 46 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: 62 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "14%" }} />
              {showBuyYnColumn && <col style={{ width: 86 }} />}
            </colgroup>
            <thead>
              <tr>
                <th style={th2Cell}>No</th>
                <th style={th2Cell}>품목명</th>
                <th style={th2Cell}>수량</th>
                <th style={th2Cell}>금액</th>
                <th style={th2Cell}>사용처/용도</th>
                <th style={th2Cell}>결제 업체명</th>
                <th style={th2Cell}>링크</th>
                <th style={th2Cell}>비고</th>
                {showBuyYnColumn && <th style={th2Cell}>구매여부</th>}
              </tr>
            </thead>
            <tbody>
              {/* 품목이 없더라도 빈 행을 명시해 레이아웃 높이를 안정화 */}
              {(detailItems || []).length === 0 ? (
                <tr>
                  <td style={{ ...td2CellCenter, padding: "14px" }} colSpan={showBuyYnColumn ? 9 : 8}>
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                // 실제 품목 목록
                detailItems.map((it, idx) => {
                  const itemIdx = asText(it.idx);
                  const isChecked = toYnValue(it.buy_yn);
                  const isSaving = itemIdx && String(buyYnSavingIdx || "") === itemIdx;

                  return (
                    <tr key={`${it.no || idx}`} style={{ verticalAlign: "middle" }}>
                      <td style={td2CellCenter}>{idx + 1}</td>
                      <td style={td2CellWrap}>{asText(it.item_name) || "-"}</td>
                      <td style={td2CellCenter}>{asText(it.qty) || "-"}</td>
                      <td style={td2CellCenter}>{toAmountText(it.price)}</td>
                      <td style={td2CellWrap}>{asText(it.use_note) || "-"}</td>
                      <td style={td2CellWrap}>{asText(it.use_name) || "-"}</td>
                      <td style={td2CellLink}>
                        {asText(it.link) ? (
                          <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <MDBox component="span" sx={{ flex: 1, wordBreak: "break-all" }}>
                              {asText(it.link)}
                            </MDBox>
                            <MDButton
                              variant="gradient"
                              color="info"
                              size="small"
                              onClick={() => openLink(it.link)}
                              sx={{ minWidth: 56, px: 1, fontSize: 11 }}
                            >
                              열기
                            </MDButton>
                          </MDBox>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={td2CellWrap}>{asText(it.note) || "-"}</td>
                      {showBuyYnColumn && (
                        <td style={td2CellCenter}>
                          <MDBox sx={tableCellCenterInnerSx}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              style={{
                                ...nativeCheckboxCenterStyle,
                                cursor: !editableBuyYn || isSaving ? "not-allowed" : "pointer",
                              }}
                              disabled={!editableBuyYn || isSaving}
                              onChange={(e) => {
                                if (!editableBuyYn) return;
                                if (typeof onToggleBuyYn !== "function") return;
                                onToggleBuyYn(it, e.target.checked);
                              }}
                            />
                          </MDBox>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </MDBox>
        <MDBox sx={totalAmountRowSx}>
          <MDBox sx={{ fontWeight: 700, color: "#1f4e79" }}>총 금액</MDBox>
          <MDBox sx={{ fontWeight: 800, color: "#1f4e79" }}>{`${totalAmountText} 원`}</MDBox>
        </MDBox>
      </MDBox>

      {/* 요청 사유는 표와 분리된 읽기 영역으로 노출 */}
      <MDBox sx={sectionSx}>
        <MDBox sx={sectionTitleSx}>요청 사유</MDBox>
        <MDBox sx={requestNoteBodySx}>{paymentNoteText}</MDBox>
      </MDBox>
    </>
  );
}

// ManageTab에서 넘겨주는 공통 스타일/데이터 계약 정의
ExpendableDetailModalContent.propTypes = {
  detailItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  asText: PropTypes.func.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  th2Cell: PropTypes.object.isRequired,
  td2CellCenter: PropTypes.object.isRequired,
  td2CellWrap: PropTypes.object.isRequired,
  td2CellLink: PropTypes.object.isRequired,
  totalAmountRowSx: PropTypes.object.isRequired,
  requestNoteBodySx: PropTypes.object.isRequired,
  showBuyYnColumn: PropTypes.bool,
  editableBuyYn: PropTypes.bool,
  buyYnSavingIdx: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onToggleBuyYn: PropTypes.func,
};

ExpendableDetailModalContent.defaultProps = {
  showBuyYnColumn: false,
  editableBuyYn: false,
  buyYnSavingIdx: "",
  onToggleBuyYn: null,
};

export default React.memo(ExpendableDetailModalContent);


