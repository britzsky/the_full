// 인사 > 근로계약서 > 계약서 양식 탭: 조항(제목·본문) 편집과 미리보기
// 저장한 조항은 ERP 양식 칸, 앱 계약서 화면, 서명 PDF에 함께 쓰이며 서명 전 계약서에 바로 반영된다 (서명본 PDF는 바뀌지 않음)
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { TextField } from "@mui/material";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import ContractForm from "./ContractForm";

// 조항 본문에 쓸 수 있는 값 자리 안내 (ERP에서는 노란 입력칸, PDF에서는 계약서 값으로 바뀜)
const TOKEN_GUIDE = [
  ["{{contract_period}}", "계약기간 (정규직·계약직 문구 자동)"],
  ["{{day_work_hours}}", "1일 소정근로시간"],
  ["{{month_work_hours}}", "1개월 소정근로시간"],
  ["{{week_work_days}}", "주 근무일수"],
  ["{{start_time}}", "시업 시각"],
  ["{{end_time}}", "종업 시각"],
  ["{{break_hours}}", "총 휴게시간"],
  ["{{break_times}}", "휴게 시간대 1회·2회 (예: 총 {{break_hours}}시간{{break_times}})"],
  ["{{job_name}}", "종사업무"],
  ["{{work_place}}", "취업장소"],
  ["{{probation_months}}", "수습기간(개월)"],
  ["{{name}}", "근로자 성명"],
  ["{{ot_table}}", "연장·야간·휴일근로 표 (한 줄에 단독)"],
  ["{{pay_table}}", "임금 구성항목 표 (한 줄에 단독)"],
  ["{{sign}}", "근로자 성명·서명칸 (줄 오른쪽)"],
];

// 양식 구분 셀렉트 표시 이름 (직원관리 구분과 같은 값)
const CORP_LABELS = { 1: "(주)더채움", 2: "더채움" };

// 편집·미리보기 전환 스위치 칸 스타일
const switchBoxSx = {
  display: "inline-flex",
  height: 40,
  p: "3px",
  boxSizing: "border-box",
  borderRadius: "8px",
  backgroundColor: "#eef1f4",
  border: "1px solid #dfe5ea",
};

function ContractTemplateEditor({ clauses, info, corType, onCorTypeChange, previewForm, onSave }) {
  // 편집 중인 조항 목록 (저장 전까지는 화면에서만 바뀜)
  const [draft, setDraft] = useState(clauses);
  // 화면 보기 방식 (edit: 조항 편집, preview: 양식 미리보기)
  const [view, setView] = useState("edit");

  // 서버에서 조항 양식을 다시 불러오면 편집 내용도 그 값으로 맞춤
  useEffect(() => {
    setDraft(clauses);
  }, [clauses]);

  const changed = JSON.stringify(draft) !== JSON.stringify(clauses);

  // 맨 아래에 빈 조항 추가
  const addClause = () =>
    setDraft((prev) => [...prev, { title: `[제${prev.length + 1}조]`, body: "□ " }]);

  // 법인/개인 양식 전환 (저장하지 않은 수정 내용이 있으면 버릴지 확인)
  const handleCorTypeChange = async (next) => {
    if (next === corType) return;
    if (changed) {
      const confirm = await Swal.fire({
        title: "저장하지 않은 수정 내용이 있습니다",
        text: "다른 양식으로 바꾸면 수정한 내용이 사라집니다. 바꿀까요?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "바꾸기",
        cancelButtonText: "취소",
      });
      if (!confirm.isConfirmed) return;
    }
    onCorTypeChange(next);
  };

  // 양식 저장 (서명 전 계약서에 바로 반영된다는 안내 후 저장)
  const handleSave = async () => {
    if (draft.length === 0 || draft.some((row) => !String(row.title || "").trim())) {
      Swal.fire("알림", "조항 제목을 모두 입력해 주세요.", "warning");
      return;
    }
    const confirm = await Swal.fire({
      title: "계약서 양식을 저장할까요?",
      html:
        `<b>${CORP_LABELS[corType]}</b> 양식입니다.<br/>` +
        `서명 전 ${CORP_LABELS[corType]} 계약서 <b>${info.unsigned_count || 0}건</b>에도 바로 반영됩니다.` +
        "<br/>서명이 끝난 계약서(서명본 PDF)는 바뀌지 않습니다.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "저장",
      cancelButtonText: "취소",
    });
    if (confirm.isConfirmed) onSave(draft);
  };

  return (
    <>
      {/* 양식 탭 상단: 편집/미리보기 전환, 최종 수정 정보, 되돌리기·조항 추가·저장 버튼 */}
      <MDBox
        sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}
      >
        <MDBox sx={switchBoxSx}>
          {[
            ["edit", "조항 편집"],
            ["preview", "미리보기"],
          ].map(([key, label]) => {
            const active = view === key;
            return (
              <MDBox
                key={key}
                component="button"
                type="button"
                onClick={() => setView(key)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 92,
                  px: 1.5,
                  pt: "1px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                  fontWeight: active ? "bold" : "normal",
                  color: active ? "#1687b2" : "#7a8998",
                  backgroundColor: active ? "#fff" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {label}
              </MDBox>
            );
          })}
        </MDBox>
        {/* 편집할 양식 구분 선택 (법인·개인 양식은 따로 저장되고, 계약서는 직원관리 구분의 양식으로 그려짐) */}
        <TextField
          select
          size="small"
          value={corType}
          onChange={(e) => handleCorTypeChange(e.target.value)}
          // 옆 편집·미리보기 스위치와 같은 높이(40px)로 맞추고, 한글이 위로 떠 보이는 만큼 글자를 1px 내림
          sx={{
            minWidth: 130,
            "& .MuiOutlinedInput-root": { height: 40 },
            "& .MuiInputBase-input": { lineHeight: "1.4375em", pt: "9.5px", pb: "7.5px" },
          }}
          SelectProps={{ native: true }}
        >
          {Object.entries(CORP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </TextField>
        {info.mod_dt && (
          <MDBox sx={{ fontSize: 12, color: "#7a8998", ml: 1 }}>
            최종 수정 {info.mod_dt}
            {info.mod_user_id ? ` · ${info.mod_user_id}` : ""}
          </MDBox>
        )}
        <MDBox sx={{ flex: 1 }} />
        <MDButton
          variant="outlined"
          color="dark"
          disabled={!changed}
          onClick={() => setDraft(clauses)}
        >
          되돌리기
        </MDButton>
        <MDButton variant="outlined" color="info" onClick={addClause}>
          + 조항 추가
        </MDButton>
        <MDButton variant="gradient" color="info" disabled={!changed} onClick={handleSave}>
          양식 저장
        </MDButton>
      </MDBox>

      {/* 버튼 영역 아래 스크롤 영역 (작성 안내·양식) */}
      <MDBox sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      {view === "edit" && (
        <>
          {/* 본문 작성 안내와 값 자리 목록 */}
          <MDBox
            sx={{
              border: "1px solid #dde5eb",
              borderRadius: "8px",
              backgroundColor: "#f7f9fb",
              p: 1.5,
              mb: 1.5,
              fontSize: 12,
              color: "#5b6b7c",
              lineHeight: 1.7,
            }}
          >
            <b>작성 방법</b> : 아래 양식의 조항 제목·본문 글자를 눌러 바로 고칩니다. 한 줄이 한
            항목입니다. □로 시작하는 줄은 줄이 넘어가면 □ 뒤에 맞춰 들여씁니다. 아래 값 자리를
            그대로 쓰면 계약서마다 입력한 값으로 바뀝니다.
            <MDBox sx={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", mt: 0.5 }}>
              {TOKEN_GUIDE.map(([token, label]) => (
                <span key={token}>
                  <code style={{ color: "#1687b2" }}>{token}</code> {label}
                </span>
              ))}
            </MDBox>
          </MDBox>

          {/* 조항 글자 편집: 실제 양식 안에서 조항 제목·본문을 바로 고침 */}
          <ContractForm
            form={previewForm}
            onChange={() => {}}
            readOnly
            clauses={draft}
            onClausesChange={setDraft}
          />
        </>
      )}

      {/* 미리보기: 편집 중인 조항으로 그린 실제 양식 (예시 값) */}
      {view === "preview" && (
        <ContractForm form={previewForm} onChange={() => {}} readOnly clauses={draft} />
      )}
      </MDBox>
    </>
  );
}

ContractTemplateEditor.propTypes = {
  // 저장된 조항 목록 [{ title, body }]
  clauses: PropTypes.arrayOf(PropTypes.object).isRequired,
  // 최종 수정 정보와 서명 전 계약서 수
  info: PropTypes.shape({
    mod_dt: PropTypes.string,
    mod_user_id: PropTypes.string,
    unsigned_count: PropTypes.number,
  }).isRequired,
  // 편집 중인 양식 구분 ("1": 법인, "2": 개인)
  corType: PropTypes.string.isRequired,
  // 양식 구분 변경 처리 (바꾼 구분의 양식을 불러옴)
  onCorTypeChange: PropTypes.func.isRequired,
  // 미리보기에 넣을 예시 계약서 값
  previewForm: PropTypes.object.isRequired,
  // 조항 저장 처리 (저장할 조항 목록 전달)
  onSave: PropTypes.func.isRequired,
};

export default ContractTemplateEditor;
