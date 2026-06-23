/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Swal from "sweetalert2";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useEvaluationTypeSettingData from "./EvaluationTypeSettingTabData";

// 평가문서 기본 입력값
const emptyForm = {
  doc_id: "",
  doc_type: "",
  large_type: "",
  middle_type: "",
  small_type: "",
  doc_name: "",
  approval_position: "",
  start_time: "",
  end_time: "",
  use_yn: "Y",
};

// 결재범위 선택 목록
const APPROVAL_OPTIONS = [
  { value: 0, label: "대표이사" },
  { value: 1, label: "인사팀장" },
  { value: 2, label: "실장" },
  { value: 3, label: "팀장" },
  { value: 4, label: "팀원 확인만" },
];

const getApprovalLabel = (value) => {
  const found = APPROVAL_OPTIONS.find((option) => Number(option.value) === Number(value));
  return found?.label || "인사팀장까지";
};

export default function EvaluationTypeSettingTab() {
  const {
    saving,
    fetchEvaluationTypeList,
    saveEvaluationType,
    deleteEvaluationType,
  } = useEvaluationTypeSettingData();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");

  // 평가문서 설정 목록 조회
  const loadRows = useCallback(async () => {
    setLoading(true);
    const list = await fetchEvaluationTypeList();
    setRows(list);
    setLoading(false);
  }, [fetchEvaluationTypeList]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // 평가문서 검색 결과 목록
  const filteredRows = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.doc_type, row.large_type, row.middle_type, row.doc_name]
        .some((value) => String(value || "").toLowerCase().includes(keyword))
    );
  }, [rows, filterText]);

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 선택한 평가문서 설정 입력값
  const handleSelect = (row) => {
    setForm({
      doc_id: row.doc_id || "",
      doc_type: row.doc_type || "",
      large_type: row.large_type || "",
      middle_type: row.middle_type || "",
      small_type: row.small_type || "",
      doc_name: row.doc_name || "",
      approval_position: row.approval_position == null || row.approval_position === "" ? "" : Number(row.approval_position),
      start_time: row.start_time ? row.start_time.slice(0, 10) : "",
      end_time: row.end_time ? row.end_time.slice(0, 10) : "",
      use_yn: row.use_yn == null ? "Y" : String(row.use_yn),
    });
  };

  const handleReset = () => {
    setForm(emptyForm);
  };

  // 평가문서 설정 저장 요청
  const handleSave = async () => {
    if (!String(form.doc_type || "").trim()) {
      Swal.fire({ title: "확인", text: "문서구분을 입력해 주세요.", icon: "warning" });
      return;
    }
    if (!String(form.doc_name || "").trim()) {
      Swal.fire({ title: "확인", text: "문서명을 입력해 주세요.", icon: "warning" });
      return;
    }
    if (form.approval_position === "") {
      Swal.fire({ title: "확인", text: "결재범위를 선택해 주세요.", icon: "warning" });
      return;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const ok = await saveEvaluationType({
      ...form,
      approval_position: Number(form.approval_position),
      start_time: form.start_time ? `${form.start_time}T${nowTime}` : "",
      end_time: form.end_time ? `${form.end_time}T${nowTime}` : "",
    });
    if (!ok) {
      Swal.fire({ title: "실패", text: "평가문서 설정 저장 중 오류가 발생했습니다.", icon: "error" });
      return;
    }
    await loadRows();
    handleReset();
    Swal.fire({ title: "완료", text: "평가문서 설정이 저장되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  // 평가문서 설정 삭제 요청
  const handleDelete = async () => {
    if (!form.doc_id) return;
    const res = await Swal.fire({
      title: "삭제하시겠습니까?",
      text: "선택한 평가문서는 설정 목록에서 제외됩니다.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
      confirmButtonColor: "#d32f2f",
    });
    if (!res.isConfirmed) return;

    const ok = await deleteEvaluationType({ docId: form.doc_id });
    if (!ok) {
      Swal.fire({ title: "실패", text: "평가문서 설정 삭제 중 오류가 발생했습니다.", icon: "error" });
      return;
    }
    await loadRows();
    handleReset();
    Swal.fire({ title: "완료", text: "평가문서 설정이 삭제되었습니다.", icon: "success", confirmButtonText: "확인" });
  };

  if (loading || saving) return <LoadingScreen />;

  return (
    <MDBox sx={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", gap: 1, p: 1 }}>
      {/* 평가문서 검색 영역 */}
      <MDBox sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, background: "#fff", p: 1, border: "1px solid #e1e7ef", borderRadius: 1 }}>
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="문서구분, 분류, 문서명 검색"
          style={{ ...inputSx, width: 220 }}
        />
        <span style={{ fontSize: 12, color: "#777", whiteSpace: "nowrap" }}>{filteredRows.length}건</span>
        <MDButton variant="outlined" color="secondary" onClick={loadRows} sx={{ fontSize: 12, whiteSpace: "nowrap" }}>새로고침</MDButton>
      </MDBox>

      <MDBox sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.8fr)", gap: 1, minHeight: 0 }}>
        {/* 평가문서 설정 목록 영역 */}
        <MDBox sx={{ overflow: "auto", border: "1px solid #cfd8e3", borderRadius: 1, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 60 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 200 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 65 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thCell}>순번</th>
                <th style={thCell}>문서구분</th>
                <th style={thCell}>대분류</th>
                <th style={thCell}>중분류</th>
                <th style={thCell}>문서명</th>
                <th style={thCell}>결재범위</th>
                <th style={thCell}>시작일</th>
                <th style={thCell}>종료일</th>
                <th style={thCell}>사용여부</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...tdCell, textAlign: "center", color: "#999", padding: 20 }}>평가문서 설정이 없습니다.</td>
                </tr>
              ) : filteredRows.map((row, index) => (
                <tr
                  key={row.doc_id || `${row.doc_type}-${index}`}
                  onClick={() => handleSelect(row)}
                  style={{ cursor: "pointer", background: String(form.doc_id) === String(row.doc_id) ? "#eef5ff" : "#fff" }}
                >
                  <td style={tdCellCenter}>{row.doc_id || index + 1}</td>
                  <td style={tdCellCenter}>{row.doc_type || "-"}</td>
                  <td style={tdCellCenter}>{row.large_type || "-"}</td>
                  <td style={tdCell}>{row.middle_type || "-"}</td>
                  <td style={tdCell}>{row.doc_name || "-"}</td>
                  <td style={tdCellCenter}>{getApprovalLabel(row.approval_position)}</td>
                  <td style={tdCellCenter}>{row.start_time ? row.start_time.slice(0, 10) : "-"}</td>
                  <td style={tdCellCenter}>{row.end_time ? row.end_time.slice(0, 10) : "-"}</td>
                  <td style={tdCellCenter}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      background: row.use_yn !== "N" ? "#e8f5e9" : "#f5f5f5",
                      color: row.use_yn !== "N" ? "#2e7d32" : "#9e9e9e",
                    }}>
                      {row.use_yn !== "N" ? "사용" : "미사용"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MDBox>

        {/* 평가문서 입력 영역 */}
        <MDBox sx={{ border: "1px solid #cfd8e3", borderRadius: 1, background: "#fff", p: 2, overflow: "auto" }}>
          <MDBox sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <MDBox sx={{ fontSize: 16, fontWeight: 800, color: "#1f4e79" }}>
              {form.doc_id ? "평가문서 수정" : "평가문서 등록"}
            </MDBox>
            <MDButton variant="outlined" color="secondary" onClick={handleReset} sx={{ fontSize: 12 }}>신규</MDButton>
          </MDBox>

          <Field label="문서구분" name="doc_type" value={form.doc_type} onChange={handleChange} maxLength={3} />
          <Field label="대분류" name="large_type" value={form.large_type} onChange={handleChange} maxLength={50} />
          <Field label="중분류" name="middle_type" value={form.middle_type} onChange={handleChange} maxLength={50} />
          <Field label="문서명" name="doc_name" value={form.doc_name} onChange={handleChange} maxLength={200} />

          <MDBox sx={{ mb: 1 }}>
            <label style={labelSx}>평가기간 시작일</label>
            <input
              type="date"
              value={form.start_time}
              onChange={(e) => handleChange("start_time", e.target.value)}
              style={inputSx}
            />
          </MDBox>
          <MDBox sx={{ mb: 1 }}>
            <label style={labelSx}>평가기간 종료일</label>
            <input
              type="date"
              value={form.end_time}
              onChange={(e) => handleChange("end_time", e.target.value)}
              style={inputSx}
            />
          </MDBox>

          <label style={labelSx}>결재범위</label>
          <select
            value={form.approval_position}
            onChange={(e) => handleChange("approval_position", e.target.value === "" ? "" : Number(e.target.value))}
            style={selectSx}
          >
            <option value="" disabled>결재범위 선택</option>
            {APPROVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <MDBox sx={{ mb: 1, mt: 1 }}>
            <label style={labelSx}>사용여부</label>
            <MDBox sx={{ display: "flex", gap: 1 }}>
              {[{ value: "Y", label: "사용" }, { value: "N", label: "미사용" }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange("use_yn", opt.value)}
                  style={{
                    flex: 1,
                    height: 34,
                    border: `1px solid ${form.use_yn === opt.value ? (opt.value === "Y" ? "#2e7d32" : "#9e9e9e") : "#cfd8e3"}`,
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: form.use_yn === opt.value ? 700 : 400,
                    cursor: "pointer",
                    background: form.use_yn === opt.value ? (opt.value === "Y" ? "#e8f5e9" : "#f5f5f5") : "#fff",
                    color: form.use_yn === opt.value ? (opt.value === "Y" ? "#2e7d32" : "#9e9e9e") : "#444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </MDBox>
          </MDBox>

          <MDBox sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
            <MDButton variant="gradient" color="info" onClick={handleSave} sx={{ fontSize: 12 }}>저장</MDButton>
            {form.doc_id && (
              <MDButton variant="gradient" color="error" onClick={handleDelete} sx={{ fontSize: 12 }}>삭제</MDButton>
            )}
          </MDBox>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

const Field = React.memo(function Field({ label, name, value, onChange, maxLength }) {
  return (
    <MDBox sx={{ mb: 1 }}>
      <label style={labelSx}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        maxLength={maxLength}
        style={inputSx}
      />
    </MDBox>
  );
});

Field.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  maxLength: PropTypes.number.isRequired,
};

const labelSx = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#444",
  marginBottom: 4,
};

const inputSx = {
  width: "100%",
  height: 34,
  border: "1px solid #cfd8e3",
  borderRadius: 4,
  padding: "0 10px",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const selectSx = {
  ...inputSx,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  cursor: "pointer",
};

const thCell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "7px 8px",
  textAlign: "center",
  fontWeight: 800,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "7px 8px",
  fontSize: 12,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tdCellCenter = {
  ...tdCell,
  textAlign: "center",
};
