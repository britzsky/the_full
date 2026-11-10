// 근로계약서 작성 양식: 원본 엑셀 근로계약서와 같은 표 모양으로 그리고, 회사가 채우는 칸(노란색)만 입력칸으로 둔다
// 저장된 계약서는 채움원 앱 전자계약 화면에서 같은 양식으로 보인다 (백엔드 templates/contract/labor_contract.html)
import React from "react";
import PropTypes from "prop-types";
import { IconButton, InputBase } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

// 양식 표 테두리·제목칸 스타일 (엑셀 회색 제목칸, 검은 테두리)
const tableSx = {
  width: "100%",
  minWidth: 900,
  // 열 너비를 colgroup 기준으로 고정 (값 칸 두 개가 남는 폭을 똑같이 나눔)
  tableLayout: "fixed",
  borderCollapse: "collapse",
  border: "2px solid #000",
  fontSize: 13,
  lineHeight: 1.7,
  backgroundColor: "#fff",
};
const thStyle = {
  border: "1px solid #555",
  backgroundColor: "#d9d9d9",
  fontWeight: "bold",
  textAlign: "center",
  whiteSpace: "nowrap",
  padding: "4px 6px",
};
const tdStyle = { border: "1px solid #555", padding: "4px 8px", textAlign: "left" };
const subThStyle = { ...thStyle, backgroundColor: "#f2f2f2", fontWeight: "normal", fontSize: 12 };
const subTdStyle = { border: "1px solid #555", padding: "2px 4px", textAlign: "center" };

// 사용자(甲) 회사 정보 (cor_type 1: 법인, 2: 개인 사업자등록증 기준, 빈 값: 일괄 작성 직원별 구분)
const CORP_INFO = {
  1: {
    name: "주식회사 더채움",
    addr: "경기도 수원시 권선구 금호로 210, 401,501,502호",
    bizno: "875-87-02456",
  },
  2: {
    name: "더채움",
    addr: "인천광역시 계양구 장제로927번길 4, 3층(방축동)",
    bizno: "175-05-00954",
  },
  "": {
    name: "직원별 구분",
    addr: "직원관리 구분((주)더채움 / 더채움)에 따라 법인·개인 정보로 채움",
    bizno: "직원별 구분",
  },
};

// 조항 본문 한 줄 스타일 (입력한 띄어쓰기 유지, □ 줄은 줄바꿈 시 □ 뒤에 맞춰 들여씀)
const lineStyle = { flex: 1, whiteSpace: "pre-wrap" };
const bulletLineStyle = { paddingLeft: "1.15em", textIndent: "-1.15em" };

// 조항 글자 편집칸 스타일 (양식 글자와 같은 크기, 마우스를 올리거나 고칠 때만 테두리 표시)
const editTextSx = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "inherit",
  p: "1px 4px",
  borderRadius: "3px",
  border: "1px dashed transparent",
  "&:hover": { borderColor: "#b9c6d2" },
  "&.Mui-focused": { borderColor: "#1687b2", backgroundColor: "#f5fbff" },
  "& textarea": { padding: 0 },
};

// 조항 본문 값 자리별 입력칸 너비 ({{항목}} → 노란 입력칸)
const TOKEN_INPUT_WIDTH = {
  day_work_hours: 50,
  month_work_hours: 70,
  week_work_days: 50,
  start_time: 70,
  end_time: 70,
  break_hours: 50,
  job_name: 120,
  work_place: 200,
  probation_months: 40,
};

// 금액 입력칸 표시값 (숫자만 남기고 천 단위 콤마)
export const formatMoney = (value) => {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits === "" ? "" : Number(digits).toLocaleString();
};

// 월급여액 = 통상임금(기본급·식대·차량유지비·육아수당) + 연차·연장·휴일·야간수당 합계
export const PAY_KEYS = [
  "base_pay",
  "meal_pay",
  "car_pay",
  "child_pay",
  "annual_leave_pay",
  "ot_pay",
  "holiday_pay",
  "night_pay",
];
export const sumPay = (form) =>
  PAY_KEYS.reduce((sum, key) => sum + (Number(String(form[key] ?? "").replace(/,/g, "")) || 0), 0);

function ContractForm({ form, onChange, readOnly, bulk, clauses, onClausesChange }) {
  // 조항 글자 편집 모드 (계약서 양식 탭: 조항 제목·본문을 양식 안에서 바로 수정)
  const editable = Boolean(onClausesChange);

  // 조항 제목·본문 글자 변경
  const changeClause = (index, key, value) =>
    onClausesChange(clauses.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  // 조항 순서 이동 (dir: -1 위로, 1 아래로)
  const moveClause = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= clauses.length) return;
    const next = [...clauses];
    [next[index], next[target]] = [next[target], next[index]];
    onClausesChange(next);
  };
  // 조항 삭제
  const removeClause = (index) => onClausesChange(clauses.filter((_, i) => i !== index));

  // 일괄 작성에서 대상자마다 따로 채우는 칸 표시 (성명·주민등록번호·주소·종사업무)
  const auto = <span style={{ color: "#1687b2", fontSize: 12 }}>대상자별 자동 입력</span>;

  // 회사 입력칸 (노란색, 서명완료 건은 읽기 전용)
  const input = (key, width = 70, opts = {}) => (
    <input
      value={form[key] ?? ""}
      disabled={readOnly}
      type={opts.type || "text"}
      placeholder={opts.placeholder || ""}
      onChange={(e) => onChange(key, opts.money ? formatMoney(e.target.value) : e.target.value)}
      style={{
        width,
        backgroundColor: readOnly ? "#f5f5f5" : "#fff9c4",
        border: "1px solid #d4b800",
        borderRadius: 2,
        padding: "2px 4px",
        fontSize: 13,
        textAlign: opts.money ? "right" : "center",
      }}
    />
  );

  // 제4조 월평균 연장·야간·휴일근로시간 표 ({{ot_table}} 자리)
  const otTable = (
    <table style={{ borderCollapse: "collapse", margin: "4px 0 4px 90px" }}>
      <tbody>
        <tr>
          <th style={subThStyle}>월평균</th>
          <th style={subThStyle}>연장근로</th>
          <th style={subThStyle}>야간근로</th>
          <th style={subThStyle}>휴일근로</th>
        </tr>
        <tr>
          <th style={subThStyle}>근로시간</th>
          <td style={subTdStyle}>{input("ot_hours", 80)}</td>
          <td style={subTdStyle}>{input("night_hours", 80)}</td>
          <td style={subTdStyle}>{input("holiday_hours", 80)}</td>
        </tr>
      </tbody>
    </table>
  );

  // 제7조 월급여액 및 임금 구성항목 표 ({{pay_table}} 자리, 월급여액은 합계 자동 계산)
  const payTable = (
    <table style={{ borderCollapse: "collapse", margin: "4px 0 4px 18px" }}>
      <tbody>
        <tr>
          <th rowSpan={2} style={subThStyle}>
            월 급여액
          </th>
          <th colSpan={4} style={subThStyle}>
            통상임금
          </th>
          <th rowSpan={2} style={subThStyle}>
            연차수당
          </th>
          <th rowSpan={2} style={subThStyle}>
            연장수당
          </th>
          <th rowSpan={2} style={subThStyle}>
            휴일수당
          </th>
          <th rowSpan={2} style={subThStyle}>
            야간수당
          </th>
        </tr>
        <tr>
          <th style={subThStyle}>기본급</th>
          <th style={subThStyle}>식대보조비</th>
          <th style={subThStyle}>차량유지비</th>
          <th style={subThStyle}>육아수당</th>
        </tr>
        <tr>
          <td style={{ ...subTdStyle, fontWeight: "bold", minWidth: 90 }}>
            {sumPay(form).toLocaleString()}
          </td>
          {PAY_KEYS.map((key) => (
            <td key={key} style={subTdStyle}>
              {input(key, 85, { money: true })}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );

  // 조항 본문의 값 자리({{항목}})를 입력칸·표시값으로 바꾸는 함수
  const renderToken = (key, idx) => {
    if (key === "contract_period") {
      // 제2조 계약기간 (정규직은 시작일만, 계약직은 종료일까지)
      return form.contract_kind === "계약직" ? (
        <React.Fragment key={idx}>
          {input("contract_start_dt", 140, { type: "date" })} ~{" "}
          {input("contract_end_dt", 140, { type: "date" })}
        </React.Fragment>
      ) : (
        <React.Fragment key={idx}>
          계약기간의 정함이 없는 ( {input("contract_start_dt", 140, { type: "date" })} ) 부터로
          정한다.
        </React.Fragment>
      );
    }
    if (key === "name") return <React.Fragment key={idx}>{form.name}</React.Fragment>;
    if (key === "job_name" && bulk) return <React.Fragment key={idx}>{auto}</React.Fragment>;
    // 일괄 작성 취업장소: 대상자 구분이 섞여 비어 있으면 '직원별 구분' 안내 (직접 입력하면 그 장소로 저장)
    if (key === "work_place" && bulk) {
      return (
        <React.Fragment key={idx}>
          {input(key, TOKEN_INPUT_WIDTH[key], { placeholder: "직원별 구분" })}
        </React.Fragment>
      );
    }
    if (TOKEN_INPUT_WIDTH[key]) {
      return <React.Fragment key={idx}>{input(key, TOKEN_INPUT_WIDTH[key])}</React.Fragment>;
    }
    return <React.Fragment key={idx}>{`{{${key}}}`}</React.Fragment>;
  };

  // 조항 본문 한 줄 그리기 (표 자리, 서명 자리, □ 줄 들여쓰기)
  const renderLine = (line) => {
    const trimmed = line.trim();
    if (trimmed === "{{ot_table}}") return otTable;
    if (trimmed === "{{pay_table}}") return payTable;
    const hasSign = line.includes("{{sign}}");
    const parts = line.replace("{{sign}}", "").split(/\{\{(\w+)\}\}/);
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={trimmed.startsWith("□") ? { ...lineStyle, ...bulletLineStyle } : lineStyle}>
          {parts.map((part, idx) =>
            // 짝수 칸은 문구, 홀수 칸은 {{항목}} 이름
            // eslint-disable-next-line react/no-array-index-key
            idx % 2 === 0 ? (
              <React.Fragment key={idx}>{part}</React.Fragment>
            ) : (
              renderToken(part, idx)
            )
          )}
          {line === "" && "\u00a0"}
        </div>
        {/* 제9조 근로자 성명·서명 자리 (근로자가 앱에서 서명) */}
        {hasSign && (
          <span style={{ backgroundColor: "#dbeafe", padding: "0 8px", whiteSpace: "nowrap" }}>
            {form.name} (서명 또는 날인)
          </span>
        )}
      </div>
    );
  };

  // 양식 甲 칸에 표시할 회사 정보 (값이 없으면 법인)
  const corp = CORP_INFO[form.cor_type ?? "1"] || CORP_INFO[1];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableSx}>
        {/* 왼쪽 구분 칸을 뺀 나머지를 반반으로 (업체명|전화, 성명|주민등록번호 등 항목명·값 칸 너비 동일) */}
        <colgroup>
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
          <col />
          <col style={{ width: 120 }} />
          <col />
        </colgroup>
        <tbody>
          {/* 제목 */}
          <tr>
            <td colSpan={5} style={{ ...thStyle, fontSize: 24, letterSpacing: 14, padding: 8 }}>
              근 로 계 약 서
            </td>
          </tr>

          {/* 사용자(甲) 회사 정보 (상단 회사 구분 선택에 따라 법인/개인) */}
          <tr>
            <th rowSpan={3} style={thStyle}>
              사용자(甲)
            </th>
            <th style={thStyle}>업체명</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>{corp.name}</td>
            <th style={thStyle}>전화</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>031-223-7324</td>
          </tr>
          <tr>
            <th style={thStyle}>소재지</th>
            <td colSpan={3} style={tdStyle}>
              {corp.addr}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>대표자</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>최희영</td>
            <th style={thStyle}>사업자등록번호</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>{corp.bizno}</td>
          </tr>

          {/* 근로자(乙) 정보 (성명·주민등록번호·주소 입력, 직원 선택 시 직원 정보 값으로 미리 채움) */}
          <tr>
            <th rowSpan={2} style={thStyle}>
              근로자(乙)
            </th>
            <th style={thStyle}>성명</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>{bulk ? auto : input("name", 120)}</td>
            <th style={thStyle}>주민등록번호</th>
            <td style={{ ...tdStyle, textAlign: "center" }}>
              {bulk ? auto : input("rrn", 160, { placeholder: "000000-0000000" })}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>주소</th>
            <td colSpan={3} style={tdStyle}>
              {bulk ? auto : input("address", "95%", { money: false })}
            </td>
          </tr>

          {/* 조항 행 (계약서 양식 탭에서 관리하는 조항 목록으로 그림) */}
          {!editable &&
            clauses.map((clause, index) => (
              <tr key={`${index}-${clause.title}`}>
                <th style={thStyle}>
                  {String(clause.title || "")
                    .split("\n")
                    .map((part, i) => (
                      <React.Fragment key={part + String(i)}>
                        {i > 0 && <br />}
                        {part}
                      </React.Fragment>
                    ))}
                </th>
                <td colSpan={4} style={tdStyle}>
                  {String(clause.body || "")
                    .split("\n")
                    .map((line, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <React.Fragment key={i}>{renderLine(line)}</React.Fragment>
                    ))}
                </td>
              </tr>
            ))}

          {/* 조항 글자 편집 행 (제목·본문 칸을 바로 고침, 제목 칸 아래 순서 이동·삭제 버튼) */}
          {editable &&
            clauses.map((clause, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={index}>
                <th style={{ ...thStyle, whiteSpace: "normal", verticalAlign: "middle" }}>
                  <InputBase
                    multiline
                    fullWidth
                    value={clause.title || ""}
                    onChange={(e) => changeClause(index, "title", e.target.value)}
                    sx={{
                      ...editTextSx,
                      "& textarea": { textAlign: "center", fontWeight: "bold" },
                    }}
                  />
                  <div style={{ marginTop: 2 }}>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => moveClause(index, -1)}
                    >
                      <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={index === clauses.length - 1}
                      onClick={() => moveClause(index, 1)}
                    >
                      <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeClause(index)}>
                      <DeleteOutlineIcon sx={{ fontSize: 16, color: "#c62828" }} />
                    </IconButton>
                  </div>
                </th>
                <td colSpan={4} style={tdStyle}>
                  <InputBase
                    multiline
                    fullWidth
                    value={clause.body || ""}
                    onChange={(e) => changeClause(index, "body", e.target.value)}
                    sx={editTextSx}
                  />
                </td>
              </tr>
            ))}

          {/* 작성일자와 甲·乙 서명란 */}
          <tr>
            <td
              colSpan={5}
              style={{ ...tdStyle, textAlign: "center", fontWeight: "bold", padding: 8 }}
            >
              {/* 작성일자는 근로자가 앱에서 서명한 날짜로 자동 입력 */}
              작성일자 :{" "}
              <span style={{ color: "#7b809a", fontWeight: "normal" }}>
                근로자 서명 시 서명한 날짜로 자동 입력
              </span>
            </td>
          </tr>
          {/* 甲(회사)·乙(근로자) 서명란을 좌우 반반으로 나눈 영역 */}
          <tr>
            <td colSpan={5} style={{ ...tdStyle, padding: 0 }}>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, padding: "12px 8px" }}>
                  甲 : {corp.name} &nbsp;&nbsp; 최희영 (서명 또는 날인)
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    borderLeft: "1px solid #555",
                    backgroundColor: "#dbeafe",
                  }}
                >
                  乙 : {form.name} (서명 또는 날인)
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

ContractForm.propTypes = {
  form: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  bulk: PropTypes.bool,
  // 조항 목록 [{ title, body }] (계약서 양식 탭에서 관리)
  clauses: PropTypes.arrayOf(PropTypes.object),
  // 조항 글자 편집 처리 (있으면 계약서 양식 탭 편집 모드, 바뀐 조항 목록 전달)
  onClausesChange: PropTypes.func,
};

ContractForm.defaultProps = {
  readOnly: false,
  bulk: false,
  clauses: [],
  onClausesChange: null,
};

export default ContractForm;
