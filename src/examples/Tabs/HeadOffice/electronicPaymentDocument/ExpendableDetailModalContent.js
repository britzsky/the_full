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

function toBuyYnText(v) {
  return toYnValue(v) ? "구매" : "미구매";
}

function toBudgetYnText(v) {
  return toYnValue(v) ? "포함" : "미포함";
}

function toPurchaseYnText(v) {
  return toYnValue(v) ? "진행" : "미진행";
}

// 예산포함여부/구매진행여부 배지 톤 - 포함/진행: 초록, 미포함/미진행: 빨강
const DECISION_YES_TONE = { backgroundColor: "#dff3e0", color: "#1b5e20" };
const DECISION_NO_TONE = { backgroundColor: "#fdecea", color: "#c62828" };
// 구매여부 배지 톤 - 구매: 하늘색, 미구매: 회색
const BUY_YES_TONE = { backgroundColor: "#e3f2fd", color: "#1565c0" };
const BUY_NO_TONE = { backgroundColor: "#f1f3f5", color: "#546e7a" };

// 조회 전용으로 노출되는 예산포함여부/구매진행여부/구매여부를 색상 배지로 표시한다.
function ynBadgeSx(isYes, yesTone, noTone) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
    padding: "3px 8px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    ...(isYes ? yesTone : noTone),
  };
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
  showFpColumns,
  editableFpDecisionFields,
  fpDraftMap,
  fpFieldsDisabled,
  onChangeFpDraft,
}) {
  // 품목의 예산포함여부/구매진행여부 draft 값을 계산한다.
  // - draft(상위 컴포넌트에서 관리, 결재 저장 시점까지 임시 보관)가 없으면 서버에서 내려온 현재 값을 그대로 사용한다.
  const getFpDraft = useCallback(
    (it) => {
      const itemIdx = asText(it?.idx);
      const draft = fpDraftMap?.[itemIdx];
      return {
        budget_yn: draft?.budget_yn ?? it?.budget_yn,
        purchase_yn: draft?.purchase_yn ?? it?.purchase_yn,
      };
    },
    [asText, fpDraftMap]
  );

  // 요청 사유는 item.payment_note 중 첫 유효값을 대표값으로 사용
  const paymentNoteText = useMemo(() => {
    const found = (detailItems || []).find((it) => asText(it.payment_note));
    return asText(found?.payment_note) || "-";
  }, [asText, detailItems]);

  // 합계는 표시 전용 계산값이며 저장값을 변경하지 않는다.
  const totalAmountText = useMemo(() => {
    const sum = (detailItems || []).reduce((acc, it) => {
      const price = toNumberValue(it?.price) || 0;
      if (!price) return acc;
      const qty = Math.max(Number(it?.qty) || 1, 1);
      return acc + price * qty;
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

  const extraColumnCount = (showBuyYnColumn ? 1 : 0) + (showFpColumns ? 2 : 0);

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
              minWidth: 640 + (showBuyYnColumn ? 86 : 0) + (showFpColumns ? 184 : 0),
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 46 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: 62 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "14%" }} />
              {showFpColumns && <col style={{ width: 92 }} />}
              {showFpColumns && <col style={{ width: 92 }} />}
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
                {showFpColumns && <th style={th2Cell}>예산포함여부</th>}
                {showFpColumns && <th style={th2Cell}>구매진행여부</th>}
                {showBuyYnColumn && <th style={th2Cell}>구매여부</th>}
              </tr>
            </thead>
            <tbody>
              {/* 품목이 없더라도 빈 행을 명시해 레이아웃 높이를 안정화 */}
              {(detailItems || []).length === 0 ? (
                <tr>
                  <td style={{ ...td2CellCenter, padding: "14px" }} colSpan={8 + extraColumnCount}>
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                // 실제 품목 목록
                detailItems.map((it, idx) => {
                  const itemIdx = asText(it.idx);
                  const isChecked = toYnValue(it.buy_yn);
                  const isBuyYnSaving = itemIdx && String(buyYnSavingIdx || "") === itemIdx;
                  const fpDraft = getFpDraft(it);
                  // FP 품목은 구매진행여부가 '진행(Y)'인 품목만 구매여부를 체크할 수 있다.
                  // (2차 결재까지 끝나 구매진행여부가 미진행으로 확정된 품목은 애초에 구매 대상이 아니다.)
                  const canToggleBuyYn = editableBuyYn && (!showFpColumns || toYnValue(it.purchase_yn));

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
                      {showFpColumns && (
                        <td style={td2CellCenter}>
                          <MDBox sx={tableCellCenterInnerSx}>
                            {editableFpDecisionFields ? (
                              <input
                                type="checkbox"
                                checked={toYnValue(fpDraft.budget_yn)}
                                disabled={fpFieldsDisabled}
                                style={{
                                  ...nativeCheckboxCenterStyle,
                                  cursor: fpFieldsDisabled ? "not-allowed" : "pointer",
                                }}
                                onChange={(e) => {
                                  if (typeof onChangeFpDraft !== "function") return;
                                  onChangeFpDraft(it, "budget_yn", e.target.checked ? "Y" : "N");
                                }}
                              />
                            ) : (
                              <MDBox component="span" sx={ynBadgeSx(toYnValue(it.budget_yn), DECISION_YES_TONE, DECISION_NO_TONE)}>
                                {toBudgetYnText(it.budget_yn)}
                              </MDBox>
                            )}
                          </MDBox>
                        </td>
                      )}
                      {showFpColumns && (
                        <td style={td2CellCenter}>
                          <MDBox sx={tableCellCenterInnerSx}>
                            {editableFpDecisionFields ? (
                              <input
                                type="checkbox"
                                checked={toYnValue(fpDraft.purchase_yn)}
                                disabled={fpFieldsDisabled}
                                style={{
                                  ...nativeCheckboxCenterStyle,
                                  cursor: fpFieldsDisabled ? "not-allowed" : "pointer",
                                }}
                                onChange={(e) => {
                                  if (typeof onChangeFpDraft !== "function") return;
                                  onChangeFpDraft(it, "purchase_yn", e.target.checked ? "Y" : "N");
                                }}
                              />
                            ) : (
                              <MDBox component="span" sx={ynBadgeSx(toYnValue(it.purchase_yn), DECISION_YES_TONE, DECISION_NO_TONE)}>
                                {toPurchaseYnText(it.purchase_yn)}
                              </MDBox>
                            )}
                          </MDBox>
                        </td>
                      )}
                      {showBuyYnColumn && (
                        <td style={td2CellCenter}>
                          <MDBox sx={tableCellCenterInnerSx}>
                            {canToggleBuyYn ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                style={{
                                  ...nativeCheckboxCenterStyle,
                                  cursor: isBuyYnSaving ? "not-allowed" : "pointer",
                                }}
                                disabled={isBuyYnSaving}
                                onChange={(e) => {
                                  if (typeof onToggleBuyYn !== "function") return;
                                  onToggleBuyYn(it, e.target.checked);
                                }}
                              />
                            ) : (
                              <MDBox component="span" sx={ynBadgeSx(isChecked, BUY_YES_TONE, BUY_NO_TONE)}>
                                {toBuyYnText(it.buy_yn)}
                              </MDBox>
                            )}
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
          <MDBox sx={{ fontWeight: 700, color: "#1f4e79" }}>합계 금액</MDBox>
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
  showFpColumns: PropTypes.bool,
  editableFpDecisionFields: PropTypes.bool,
  fpDraftMap: PropTypes.object,
  fpFieldsDisabled: PropTypes.bool,
  onChangeFpDraft: PropTypes.func,
};

ExpendableDetailModalContent.defaultProps = {
  showBuyYnColumn: false,
  editableBuyYn: false,
  buyYnSavingIdx: "",
  onToggleBuyYn: null,
  showFpColumns: false,
  editableFpDecisionFields: false,
  fpDraftMap: {},
  fpFieldsDisabled: false,
  onChangeFpDraft: null,
};

export default React.memo(ExpendableDetailModalContent);
