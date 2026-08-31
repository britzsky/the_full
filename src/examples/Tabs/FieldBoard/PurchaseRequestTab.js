// 구매요청서 작성 탭 (현장 영양사 → 전자결재 FP 타입 상신)
// - 소모품 구매 품의서(ExpendableWriteDocumentForm)와 동일한 포맷 사용
// - 헤더: 거래처/작성자/기안일자/시행일자/문서번호
// - 바디: 품목 내역과 요청 사유
/* eslint-disable react/function-component-definition */
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Box, Modal, TextField, useTheme, useMediaQuery } from "@mui/material";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import LoadingScreen from "layouts/loading/loadingscreen";

// 소모품 구매 품의서와 동일한 품목 폼 컴포넌트 사용
import ExpendableWriteDocumentForm from "../HeadOffice/electronicPaymentDocument/ExpendableWriteDocumentForm";
import usePurchaseRequestData from "./PurchaseRequestData";

// 시행일자 기본값 (기안일 + 1일)
const getDefaultStartDt = () => dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm:ss");

// 소모품 구매 품의서와 동일한 10개 품목 행을 만든다.
const createEmptyItems = () =>
  Array.from({ length: 10 }).map((_, i) => ({
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

// ─── 스타일 상수 (ElectronicPaymentSheetTab 동일) ─────────────────────────────

const sectionSx = { borderTop: "1px solid #cfd8e3" };

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
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
  fontSize: 12,
};

const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "3px 4px",
  background: "#fff",
  fontSize: 12,
};

const th2Cell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
  fontSize: 12,
};

const td2CellCenter = {
  border: "1px solid #cfd8e3",
  padding: "3px 4px",
  textAlign: "center",
  background: "#fff",
  fontSize: 12,
};

const td2Cell = {
  border: "1px solid #cfd8e3",
  padding: "3px 4px",
  background: "#fff",
  fontSize: 12,
};

const inputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "7px 10px",
  },
  "& .MuiInputBase-inputMultiline": { fontSize: isMobile ? 11 : 12 },
});

const gridInputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "6px 10px",
  },
});

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function PurchaseRequestTab({ isActive, openHistoryPaymentId, openHistoryToken }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 거래처·작성자 정보와 상신 시 자동 지정할 결재자 정보를 관리하는 데이터 훅
  const {
    accountName,
    writerName,
    approver1st,
    approver2nd,
    loading,
    fetchNextRequestNo,
    savePurchaseRequest,
    fetchPurchaseRequestHistory,
    fetchPurchaseRequestDetail,
  } = usePurchaseRequestData();

  // 기안일자
  const [draftDt, setDraftDt] = useState(() => dayjs().format("YYYY-MM-DDTHH:mm:ss"));
  // 시행일자
  const [startDt, setStartDt] = useState(getDefaultStartDt);
  // 문서번호
  const [requestNo, setRequestNo] = useState("");
  // 구매 품목과 요청 사유 입력 상태
  const [items, setItems] = useState(createEmptyItems);
  const itemsBufferRef = useRef(items);
  const [paymentNote, setPaymentNote] = useState("");
  const paymentNoteBufferRef = useRef(paymentNote);
  // 저장 진행 중 여부
  const [saving, setSaving] = useState(false);
  // 로그인 사용자의 구매요청서 요청내역 모달 상태
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  // inputStyle 메모이제이션
  const inputStyle = useMemo(() => inputSx(isMobile), [isMobile]);
  const gridInputStyle = useMemo(() => gridInputSx(isMobile), [isMobile]);

  // 품목과 요청 사유의 최신 입력값을 상신 시점까지 유지한다.
  useEffect(() => { itemsBufferRef.current = items; }, [items]);
  useEffect(() => { paymentNoteBufferRef.current = paymentNote; }, [paymentNote]);

  // 문서번호 자동 생성
  useEffect(() => {
    let cancelled = false;
    fetchNextRequestNo(draftDt).then((no) => {
      if (!cancelled) setRequestNo(no);
    });
    return () => { cancelled = true; };
  }, [draftDt, fetchNextRequestNo]);

  // 품목 입력 버퍼 변경 콜백
  const onItemsBufferChange = useCallback((next) => {
    itemsBufferRef.current = Array.isArray(next) ? next : itemsBufferRef.current;
  }, []);

  // 구매링크를 새 창으로 연다.
  const openLink = useCallback((url) => {
    const trimmed = String(url ?? "").trim();
    if (!trimmed) return;
    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, []);

  // 폼 초기화
  const handleReset = useCallback(() => {
    const emptyItems = createEmptyItems();
    setItems(emptyItems);
    itemsBufferRef.current = emptyItems;
    setPaymentNote("");
    paymentNoteBufferRef.current = "";
    setDraftDt(dayjs().format("YYYY-MM-DDTHH:mm:ss"));
    setStartDt(getDefaultStartDt());
  }, []);

  // 목록에서 선택한 구매요청서의 품목 상세를 조회한다.
  const handleSelectHistory = useCallback(async (row) => {
    const paymentId = String(row?.payment_id || "").trim();
    if (!paymentId) return;

    setHistoryDetailLoading(true);
    try {
      const detail = await fetchPurchaseRequestDetail(paymentId);
      setSelectedHistory({ ...detail, payment_id: paymentId });
    } catch (e) {
      Swal.fire("오류", e?.message || "상신 상세 조회 중 오류가 발생했습니다.", "error");
    } finally {
      setHistoryDetailLoading(false);
    }
  }, [fetchPurchaseRequestDetail]);

  // 로그인 사용자의 상신 목록을 열고 알림에서 지정한 문서가 있으면 상세까지 표시한다.
  const openPurchaseRequestHistory = useCallback(async (targetPaymentId = "") => {
    const paymentId = String(targetPaymentId || "").trim();
    setHistoryOpen(true);
    setSelectedHistory(null);
    setHistoryLoading(true);
    try {
      const rows = await fetchPurchaseRequestHistory();
      setHistoryRows(rows);

      const targetRow = paymentId
        ? rows.find((row) => String(row?.payment_id || "").trim() === paymentId)
        : null;
      if (targetRow) await handleSelectHistory(targetRow);
    } catch (e) {
      setHistoryRows([]);
      Swal.fire("오류", e?.message || "요청내역 조회 중 오류가 발생했습니다.", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchPurchaseRequestHistory, handleSelectHistory]);

  // 알림에서 넘어온 문서번호가 바뀔 때 작성자 본인의 해당 상신 상세를 자동으로 연다.
  useEffect(() => {
    if (!openHistoryToken || !String(openHistoryPaymentId || "").trim()) return;
    openPurchaseRequestHistory(openHistoryPaymentId);
  }, [openHistoryPaymentId, openHistoryToken, openPurchaseRequestHistory]);

  // 다른 현장관리 탭으로 이동하면 요청내역 모달과 선택 문서를 즉시 닫는다.
  useEffect(() => {
    if (isActive) return;
    setHistoryOpen(false);
    setSelectedHistory(null);
  }, [isActive]);

  // 상신 핸들러
  const handleSubmit = useCallback(async () => {
    if (!String(approver1st.user_id || "").trim()) {
      Swal.fire({
        title: "상신 불가",
        text: "상신이 되지 않았습니다. 관리자에게 문의해 주세요.",
        icon: "warning",
      });
      return;
    }
    if (!String(approver2nd.user_id || "").trim()) {
      Swal.fire({
        title: "상신 불가",
        text: "상신이 되지 않았습니다. 관리자에게 문의해 주세요.",
        icon: "warning",
      });
      return;
    }

    const currentItems = itemsBufferRef.current || items;
    const clean = (v) => String(v ?? "").trim();
    const toInt = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : null; };

    // 소모품 구매 품의서 품목 구조로 저장 데이터를 만든다.
    const purchaseItems = (currentItems || [])
      .map((row) => ({
        no: row.no,
        item_name: clean(row.item_name),
        qty: toInt(row.qty),
        price: toInt(row.price),
        use_note: clean(row.use_note),
        use_name: clean(row.use_name),
        link: clean(row.link),
        note: clean(row.note),
        buy_yn: "N",
        payment_note: clean(paymentNoteBufferRef.current),
      }))
      .filter((row) => row.item_name !== "");

    if (purchaseItems.length === 0) {
      Swal.fire({ title: "확인", text: "품목 내역을 입력해주세요.", icon: "warning" });
      return;
    }

    // 품목별 필수값 검증 - 품목명/수량/금액/사용처·용도/결제 업체명은 필수, 링크·비고는 선택
    const REQUIRED_ITEM_FIELDS = [
      { key: "qty", label: "수량" },
      { key: "price", label: "금액" },
      { key: "use_note", label: "사용처/용도" },
      { key: "use_name", label: "결제 업체명" },
    ];
    for (let i = 0; i < purchaseItems.length; i += 1) {
      const row = purchaseItems[i];
      const missingField = REQUIRED_ITEM_FIELDS.find((field) => {
        const value = row[field.key];
        return value === null || value === undefined || value === "";
      });
      if (missingField) {
        Swal.fire({
          title: "확인",
          text: `${row.no || i + 1}번 품목의 ${missingField.label}을(를) 입력해주세요.`,
          icon: "warning",
        });
        return;
      }
    }

    // 요청 사유 필수값 검증
    if (!clean(paymentNoteBufferRef.current)) {
      Swal.fire({ title: "확인", text: "요청 사유를 입력해주세요.", icon: "warning" });
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

    setSaving(true);
    try {
      const res = await savePurchaseRequest({
        payment_id: requestNo,
        draft_dt: dayjs(draftDt).format("YYYY-MM-DD HH:mm:ss"),
        start_dt: dayjs(startDt).format("YYYY-MM-DD HH:mm:ss"),
        tm_user: approver1st.user_id || "",
        payer_user: approver2nd.user_id || "",
        items: purchaseItems,
      });

      const ok = res?.data?.code === 200 || res?.status === 200;
      if (!ok) {
        Swal.fire("실패", res?.data?.message || "저장 실패", "error");
        return;
      }

      await Swal.fire({
        title: "완료",
        text: "구매요청서가 상신되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      handleReset();
    } catch (e) {
      Swal.fire("오류", e?.message || "저장 중 오류 발생", "error");
    } finally {
      setSaving(false);
    }
  }, [items, requestNo, draftDt, startDt, approver1st, approver2nd, savePurchaseRequest, handleReset]);

  if (loading) return <LoadingScreen />;

  return (
    <MDBox sx={{ width: "100%", px: isMobile ? 1 : 3 }}>
      {/* 제목(가운데) + 상신 버튼(오른쪽) 한 줄 */}
      <MDBox
        mb={2}
        pb={1.5}
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "2px solid #1f4e79",
          px: isMobile ? 0 : "180px",
          pt: isMobile ? 5 : 0,
        }}
      >
        <MDBox
          sx={{
            fontSize: isMobile ? 16 : 20,
            fontWeight: 900,
            letterSpacing: 6,
            color: "#1f4e79",
          }}
        >
          구매요청서
        </MDBox>
        <MDBox sx={{ position: "absolute", right: 0, top: isMobile ? 0 : "auto", display: "flex", gap: 1 }}>
          <MDButton
            variant="gradient"
            color="info"
            onClick={() => openPurchaseRequestHistory()}
            sx={{ fontSize: 12, minWidth: 82, height: 30, px: 1.5 }}
          >
            요청내역
          </MDButton>
          <MDButton
            variant="gradient"
            color="warning"
            onClick={handleSubmit}
            disabled={saving}
            sx={{ fontSize: 12, minWidth: 72, height: 30, px: 1.5 }}
          >
            {saving ? "상신 중..." : "상신"}
          </MDButton>
        </MDBox>
      </MDBox>

      {/* ── 기본 정보 헤더 (지출결의서 동일 구조) ──────────────────────────── */}
      <MDBox sx={{ border: "1px solid #cfd8e3", mb: 0 }}>
        <MDBox sx={sectionTitleSx}>기본 정보</MDBox>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12 }}>
          <colgroup>
            <col style={{ width: "7%" }} />
            <col />
            <col style={{ width: "7%" }} />
            <col />
            <col style={{ width: "9%" }} />
            <col />
            <col style={{ width: "9%" }} />
            <col />
            <col style={{ width: "9%" }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <td style={thCell}>거래처</td>
              <td style={tdCell}>
                <TextField size="small" value={accountName || ""} fullWidth sx={inputStyle} InputProps={{ readOnly: true }} />
              </td>
              <td style={thCell}>작성자</td>
              <td style={tdCell}>
                <TextField size="small" value={writerName || ""} fullWidth sx={inputStyle} InputProps={{ readOnly: true }} />
              </td>
              <td style={thCell}>문서번호</td>
              <td style={tdCell}>
                <TextField size="small" value={requestNo} fullWidth sx={inputStyle} InputProps={{ readOnly: true }} />
              </td>
              <td style={thCell}>기안일자</td>
              <td style={tdCell}>
                <TextField type="datetime-local" size="small" value={draftDt} onChange={(e) => setDraftDt(e.target.value)} fullWidth inputProps={{ step: 1 }} sx={inputStyle} />
              </td>
              <td style={thCell}>시행일자</td>
              <td style={tdCell}>
                <TextField type="datetime-local" size="small" value={startDt} onChange={(e) => setStartDt(e.target.value)} fullWidth inputProps={{ step: 1 }} sx={inputStyle} />
              </td>
            </tr>
          </tbody>
        </table>
      </MDBox>

      {/* 소모품 구매 품의서와 동일한 품목 내역 영역 */}
      <MDBox sx={{ fontSize: "12px", overflowX: "auto", "& table": { fontSize: "12px" }, "& th, & td": { fontSize: "12px" }, "& label, & p, & span:not(.MuiButton-label)": { fontSize: "12px" } }}>
        <ExpendableWriteDocumentForm
          sectionTitle="품목 내역"
          itemNameLabel="품목명"
          useNoteLabel="사용처/용도"
          linkLabel="구매링크"
          items={items}
          setItems={setItems}
          onItemsBufferChange={onItemsBufferChange}
          isMobile={isMobile}
          openLink={openLink}
          gridInputStyle={gridInputStyle}
          sectionSx={sectionSx}
          sectionTitleSx={sectionTitleSx}
          th2Cell={th2Cell}
          td2Cell={td2Cell}
          td2CellCenter={td2CellCenter}
        />
      </MDBox>

      {/* 구매 품목 전체에 적용되는 요청 사유 영역 */}
      <MDBox sx={sectionSx}>
        <MDBox sx={sectionTitleSx}>요청 사유</MDBox>
        <MDBox sx={{ p: 1 }}>
          <TextField
            multiline
            rows={3}
            value={paymentNote}
            onChange={(e) => {
              setPaymentNote(e.target.value);
              paymentNoteBufferRef.current = e.target.value;
            }}
            fullWidth
            sx={inputStyle}
            placeholder="요청 사유"
          />
        </MDBox>
      </MDBox>

      {/* 로그인 사용자가 직접 기안한 구매요청서 목록과 상세를 보여주는 모달 */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <Box sx={historyModalSx(isMobile)}>
          <MDBox sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <MDBox sx={{ fontSize: 17, fontWeight: 800, color: "#1f4e79" }}>
              구매요청서 요청내역
            </MDBox>
            <MDBox sx={{ display: "flex", gap: 1 }}>
              {selectedHistory && (
                <MDButton color="info" variant="outlined" onClick={() => setSelectedHistory(null)}>
                  목록으로
                </MDButton>
              )}
              <MDButton color="secondary" variant="outlined" onClick={() => setHistoryOpen(false)}>
                닫기
              </MDButton>
            </MDBox>
          </MDBox>

          {selectedHistory ? (
            <PurchaseRequestHistoryDetail
              detail={selectedHistory}
              loading={historyDetailLoading}
            />
          ) : (
            <PurchaseRequestHistoryList
              rows={historyRows}
              loading={historyLoading || historyDetailLoading}
              onSelect={handleSelectHistory}
            />
          )}
        </Box>
      </Modal>
    </MDBox>
  );
}

// 요청내역 목록은 문서번호를 누르면 해당 기안의 상세 화면으로 전환한다.
function PurchaseRequestHistoryList({ rows, loading, onSelect }) {
  if (loading) return <MDBox sx={{ py: 5, textAlign: "center" }}>조회 중...</MDBox>;

  return (
    <MDBox sx={{ overflowX: "auto", maxHeight: "65vh", overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
        <thead>
          <tr>
            <th style={historyThCell}>문서번호</th>
            <th style={historyThCell}>기안일자</th>
            <th style={historyThCell}>시행일자</th>
            <th style={historyThCell}>진행상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td style={historyEmptyCell} colSpan={4}>상신한 구매요청서가 없습니다.</td></tr>
          ) : rows.map((row, index) => (
            <tr key={`${row.payment_id}-${index}`} onClick={() => onSelect(row)} style={{ cursor: "pointer" }}>
              <td style={historyTdLink}>{row.payment_id || "-"}</td>
              <td style={historyTdCell}>{row.draft_dt || "-"}</td>
              <td style={historyTdCell}>{row.start_dt || "-"}</td>
              <td style={historyTdCell}>
                <MDBox component="span" sx={getHistoryStatusSx(getHistoryStatusText(row))}>
                  {getHistoryStatusText(row)}
                </MDBox>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </MDBox>
  );
}

// 선택한 구매요청서의 품목과 요청 사유를 읽기 전용으로 표시한다.
function PurchaseRequestHistoryDetail({ detail, loading }) {
  const items = Array.isArray(detail?.items) ? detail.items : [];
  const paymentNoteRow = items.find((row) => String(getHistoryItemValue(row, "payment_note")).trim());
  const paymentNote = getHistoryItemValue(paymentNoteRow, "payment_note") || "-";
  const total = items.reduce((sum, row) => {
    const qty = Number(getHistoryItemValue(row, "qty")) || 1;
    const price = Number(String(getHistoryItemValue(row, "price")).replace(/,/g, "")) || 0;
    return sum + qty * price;
  }, 0);

  // 작성 화면과 동일하게 프로토콜이 없는 구매링크에는 https를 붙여 연다.
  const openHistoryLink = (url) => {
    const trimmed = String(url ?? "").trim();
    if (!trimmed) return;
    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <MDBox>
      {loading ? <MDBox sx={{ py: 5, textAlign: "center" }}>조회 중...</MDBox> : (
        <>
          <MDBox sx={{ mb: 1, fontSize: 13, fontWeight: 700 }}>
            문서번호: {detail.payment_id}
          </MDBox>
          <MDBox sx={{ overflowX: "auto", maxHeight: "48vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr>
                  {["No", "품목명", "수량", "금액(원)", "사용처/용도", "결제 업체명", "구매링크", "비고", "예산포함여부", "구매진행여부", "구매여부"].map((label) => (
                    <th key={label} style={historyThCell}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={`${row.idx || row.no}-${index}`}>
                    <td style={historyTdCell}>{index + 1}</td>
                    <td style={historyTdCell}>{getHistoryItemValue(row, "item_name") || "-"}</td>
                    <td style={historyTdCell}>{getHistoryItemValue(row, "qty") || "-"}</td>
                    <td style={historyTdCell}>
                      {Number(getHistoryItemValue(row, "price") || 0).toLocaleString("ko-KR")}
                    </td>
                    <td style={historyTdCell}>{getHistoryItemValue(row, "use_note") || "-"}</td>
                    <td style={historyTdCell}>{getHistoryItemValue(row, "use_name") || "-"}</td>
                    <td style={historyTdCell}>
                      {getHistoryItemValue(row, "link") ? (
                        <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <MDBox component="span" sx={{ flex: 1, wordBreak: "break-all" }}>
                            {getHistoryItemValue(row, "link")}
                          </MDBox>
                          <MDButton
                            variant="gradient"
                            color="info"
                            size="small"
                            onClick={() => openHistoryLink(getHistoryItemValue(row, "link"))}
                            sx={{ minWidth: 56, px: 1, fontSize: 11 }}
                          >
                            열기
                          </MDButton>
                        </MDBox>
                      ) : "-"}
                    </td>
                    <td style={historyTdCell}>{getHistoryItemValue(row, "note") || "-"}</td>
                    <td style={historyTdCell}>
                      <MDBox component="span" sx={getDecisionYnBadgeSx(getHistoryItemValue(row, "budget_yn"))}>
                        {isHistoryYnTrue(getHistoryItemValue(row, "budget_yn")) ? "포함" : "미포함"}
                      </MDBox>
                    </td>
                    <td style={historyTdCell}>
                      <MDBox component="span" sx={getDecisionYnBadgeSx(getHistoryItemValue(row, "purchase_yn"))}>
                        {isHistoryYnTrue(getHistoryItemValue(row, "purchase_yn")) ? "진행" : "미진행"}
                      </MDBox>
                    </td>
                    <td style={historyTdCell}>
                      <MDBox component="span" sx={getBuyYnBadgeSx(getHistoryItemValue(row, "buy_yn"))}>
                        {isHistoryYnTrue(getHistoryItemValue(row, "buy_yn")) ? "구매" : "미구매"}
                      </MDBox>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MDBox>
          <MDBox sx={{ textAlign: "right", fontWeight: 800, color: "#1f4e79", p: 1 }}>
            합계 금액: {total.toLocaleString("ko-KR")} 원
          </MDBox>
          <MDBox sx={sectionTitleSx}>요청 사유</MDBox>
          <MDBox sx={{ minHeight: 70, p: 1.5, whiteSpace: "pre-wrap", border: "1px solid #cfd8e3" }}>
            {paymentNote}
          </MDBox>
        </>
      )}
    </MDBox>
  );
}

PurchaseRequestHistoryList.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

PurchaseRequestHistoryDetail.propTypes = {
  detail: PropTypes.shape({
    payment_id: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  loading: PropTypes.bool.isRequired,
};

PurchaseRequestTab.propTypes = {
  isActive: PropTypes.bool,
  openHistoryPaymentId: PropTypes.string,
  openHistoryToken: PropTypes.number,
};

PurchaseRequestTab.defaultProps = {
  isActive: true,
  openHistoryPaymentId: "",
  openHistoryToken: 0,
};

// MyBatis Map의 컬럼 키 대소문자 차이가 있어도 상세 값을 동일하게 읽는다.
const getHistoryItemValue = (row, key) => {
  if (!row) return "";
  return row[key] ?? row[key.toUpperCase()] ?? "";
};

// buy_yn 등 Y/N 컬럼 값을 boolean으로 정규화한다.
const isHistoryYnTrue = (v) => String(v ?? "").trim().toUpperCase() === "Y";

// 구매여부 배지 색상 - 구매: 하늘색, 미구매: 회색 (전자결재 관리 상세와 동일한 톤)
const getBuyYnBadgeSx = (buyYn) => {
  const isBuy = isHistoryYnTrue(buyYn);
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
    px: 1,
    py: 0.35,
    borderRadius: 1,
    fontWeight: 700,
    fontSize: 11,
    color: isBuy ? "#1565c0" : "#546e7a",
    backgroundColor: isBuy ? "#e3f2fd" : "#f1f3f5",
  };
};

// 예산포함여부/구매진행여부 배지 색상 - 포함/진행: 초록, 미포함/미진행: 빨강 (전자결재 관리 상세와 동일한 톤)
const getDecisionYnBadgeSx = (v) => {
  const isYes = isHistoryYnTrue(v);
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
    px: 1,
    py: 0.35,
    borderRadius: 1,
    fontWeight: 700,
    fontSize: 11,
    color: isYes ? "#1b5e20" : "#c62828",
    backgroundColor: isYes ? "#dff3e0" : "#fdecea",
  };
};

const getHistoryStatusText = (row) => {
  if (String(row?.progress_status_text || "").trim()) return row.progress_status_text;
  if (String(row?.status || "") === "3" || String(row?.tm_sign || "") === "3") return "반려";
  if (String(row?.status || "") === "4" || String(row?.tm_sign || "") === "4") return "승인완료";
  return "결재대기";
};

// 요청내역의 진행 단계를 완료·반려·검토·대기 색상으로 구분한다.
const getHistoryStatusSx = (status) => {
  const statusText = String(status || "");
  let color = "#1565c0";
  let backgroundColor = "#e3f2fd";

  if (statusText === "승인완료") {
    color = "#2e7d32";
    backgroundColor = "#e8f5e9";
  } else if (statusText.includes("반려")) {
    color = "#c62828";
    backgroundColor = "#ffebee";
  } else if (statusText.includes("검토중")) {
    color = "#e65100";
    backgroundColor = "#fff3e0";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
    px: 1.1,
    py: 0.45,
    borderRadius: "999px",
    color,
    backgroundColor,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
};

const historyModalSx = (isMobile) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: isMobile ? "94vw" : "min(1220px, 96vw)",
  maxHeight: "88vh",
  overflow: "auto",
  bgcolor: "#fff",
  borderRadius: 2,
  boxShadow: 24,
  p: isMobile ? 1.5 : 2.5,
});

const historyThCell = { ...th2Cell, padding: "7px 8px" };
const historyTdCell = { ...td2CellCenter, padding: "7px 8px", wordBreak: "break-all" };
const historyTdLink = { ...historyTdCell, color: "#1f4e79", fontWeight: 800, textDecoration: "underline" };
const historyEmptyCell = { ...historyTdCell, padding: 24 };
