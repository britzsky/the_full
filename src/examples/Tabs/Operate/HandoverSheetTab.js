// src/layouts/handover/HandoverSheetTab.js
import React, { useState, useEffect } from "react";
import { TextField } from "@mui/material";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import useHandOversheetData from "./handoverheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import XlsxPopulate from "xlsx-populate/browser/xlsx-populate";
import FileSaver from "file-saver";

const tableSx = {
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
  },
  "& th, & td": {
    border: "1px solid #000",
    fontSize: "12px",
    textAlign: "left",
    verticalAlign: "middle",
    padding: "2px",
  },
  "& th": {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
  "& input[type='date'], & input[type='text'], & input[type='textarea']": {
      fontSize: "12px",
      padding: "2px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
    },
};

export default function HandoverSheetTab() {
  const [form, setForm] = useState({});
  const [originalForm, setOriginalForm] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const { handOverListRows, accountList, loading, fetcHandOverList } =
    useHandOversheetData(selectedAccountId);

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) fetcHandOverList(selectedAccountId);
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) setForm((prev) => ({ ...prev, account_id: selectedAccountId }));
  }, [selectedAccountId]);

  useEffect(() => {
    if (handOverListRows && handOverListRows.length > 0) {
      setForm(handOverListRows[0] || {});
      setOriginalForm(handOverListRows[0] || {});
    } else {
      setForm({});
      setOriginalForm({});
    }
  }, [handOverListRows]);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async () => {
    form.account_id = selectedAccountId;
    form.user_id = localStorage.getItem("user_id");
    try {
      const response = await api.post(
        "/Operate/HandOverSave",
        form
      );
      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        await fetcHandOverList(selectedAccountId);
      }
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: err.message || "저장 중 오류 발생",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  if (loading) return <LoadingScreen />;

  const normalize = (v) => (v === null || v === undefined ? "" : String(v).trim());
  const isChanged = (key) => normalize(form[key]) !== normalize(originalForm[key]);

  const renderInput = (key, opts = {}) => {
    const changed = isChanged(key);
    const color = changed ? "red" : "black";
    return (
      <TextField
        {...opts}
        fullWidth
        value={form[key] ?? ""}
        onChange={handleChange(key)}
        inputProps={{ style: { color, ...(opts.inputProps?.style || {}) } }}
        sx={{
          "& .MuiInputBase-input": { color },
          "& .MuiInputBase-input.MuiInputBase-inputMultiline": { color },
          "& input[type='date']": { color },
        }}
      />
    );
  };

  const handleExcelDownload = async () => {
    // ✅ form 값 정리 (제어문자 제거)
    const sanitize = (v) =>
      typeof v === "string" ? v.replace(/[\x00-\x1F\x7F]/g, "").trim() : v ?? "";
    Object.keys(form).forEach((k) => (form[k] = sanitize(form[k])));

    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    sheet.name("Sheet1");

    // ✅ 공통 스타일 파라미터
    const gray = "F0F0F0";
    const fontKor = "맑은 고딕";
    const borderThin = {
      top: { style: "thin", color: "999999" },
      left: { style: "thin", color: "999999" },
      bottom: { style: "thin", color: "999999" },
      right: { style: "thin", color: "999999" },
    };

    // ✅ 열 너비 설정
    ["A", "B", "C", "D", "E", "F"].forEach((col, i) => {
      sheet.column(col).width(i % 2 === 0 ? 18 : 25);
    });

    // =========================
    // 1. 제목 (A1:F1 병합 + 테두리)
    // =========================
    sheet.range("A1:F1").merged(true);
    sheet.range("A1:F1").style({ border: borderThin });
    sheet.cell("A1").value("업 무 인 수 인 계 서").style({
      bold: true,
      fontSize: 12,
      fontFamily: fontKor,
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: gray,
    });
    sheet.row(1).height(25);

    // =========================
    // 2. 인계자 / 인수자 / 확인자 (헤더 라인)
    // =========================
    const headerData = [
      ["A2:B2", "인계자"],
      ["C2:D2", "인수자"],
      ["E2:F2", "확인자"],
    ];

    headerData.forEach(([range, title]) => {
      sheet.range(range).merged(true);
      sheet.range(range).style({ border: borderThin });
      sheet
        .cell(range.split(":")[0])
        .value(title)
        .style({
          bold: true,
          fontFamily: fontKor,
          horizontalAlignment: "center",
          verticalAlignment: "center",
          fill: gray,
        });
    });

    // =========================
    // 3. 기본 정보 테이블
    // =========================
    const baseRows = [
      ["업체명", form.handover_company, "업체명", form.acquisition_company, "부서명", form.check_team],
      ["성명", form.handover_name, "성명", form.acquisition_name, "성명", form.check_name],
      ["인계일자", form.handover_dt, "인수일자", form.acquisition_dt, "인계장소", form.handover_location],
    ];

    let rowIdx = 3;

    baseRows.forEach((cols) => {
      // 라벨 셀들 (A, C, E)
      ["A", "C", "E"].forEach((col, i) => {
        sheet.cell(`${col}${rowIdx}`).value(cols[i * 2]).style({
          bold: true,
          fill: gray,
          fontFamily: fontKor,
          verticalAlignment: "center",
          horizontalAlignment: "center",
          border: borderThin,
        });
      });

      // 값 셀들 (B, D, F)
      ["B", "D", "F"].forEach((col, i) => {
        sheet.cell(`${col}${rowIdx}`).value(cols[i * 2 + 1]).style({
          fontFamily: fontKor,
          verticalAlignment: "center",
          horizontalAlignment: "left",
          border: borderThin,
        });
      });

      rowIdx++;
    });

    // =========================
    // 4. 섹션 타이틀 (예: "1. 업무 현황")
    // =========================
    const addSection = (title) => {
      rowIdx++;
      sheet.range(`A${rowIdx}:F${rowIdx}`).merged(true);
      sheet.range(`A${rowIdx}:F${rowIdx}`).style({ border: borderThin });
      sheet.cell(`A${rowIdx}`).value(title).style({
        bold: true,
        fontFamily: fontKor,
        fill: gray,
        horizontalAlignment: "left",
        verticalAlignment: "center",
      });
      sheet.row(rowIdx).height(22);
    };

    // =========================
    // 5. 라벨 + 값 블록
    //    - A열(라벨): 회색, bold
    //    - B~F열(값): 병합 + 테두리
    // =========================
    const addRowBlock = (label, value, height = 20) => {
      rowIdx++;

      // 라벨 (A열)
      sheet.cell(`A${rowIdx}`).value(label).style({
        bold: true,
        fill: gray,
        fontFamily: fontKor,
        verticalAlignment: "center",
        horizontalAlignment: "left",
        border: borderThin,
      });

      // 값 (B~F 병합)
      sheet.range(`B${rowIdx}:F${rowIdx}`).merged(true);
      sheet.range(`B${rowIdx}:F${rowIdx}`).style({ border: borderThin });
      sheet.cell(`B${rowIdx}`).value(value || "").style({
        fontFamily: fontKor,
        verticalAlignment: "center",
        horizontalAlignment: "left",
      });

      sheet.row(rowIdx).height(height);
    };

    // =========================
    // 6. 실제 섹션/내용 채우기
    // =========================

    // 1. 업무 현황
    addSection("1. 업무 현황");
    addRowBlock("▶ 급식 대상자 수", form.meal_number);
    addRowBlock("▶ 식수 운영 방식 및 배식 방식", form.catering_ration);
    addRowBlock("▶ 일반 식단 운영 방식", form.normal_diet);
    addRowBlock("▶ 주방 인력 구성 (이름, 연락처)", form.kitchen_member);
    addRowBlock("▶ 근무자 시간 및 스케줄 근무 형태", form.work_type);
    addRowBlock("▶ 발주 프로그램 아이디 & 비밀번호", form.order_program_info);
    addRowBlock("▶ 식재료 발주 방식 및 인원수", form.ingredients_order_type);
    addRowBlock("▶ 검수 및 입고 방법", form.inspection_store_type);
    addRowBlock("▶ 재고 관리 방법", form.stock_manage_type);

    // 2. 주요 업무 및 주의사항
    addSection("2. 주요 업무 및 주의사항");
    addRowBlock("▶ 식단 구성 및 제출 주기", form.diet_submit_cycle);
    addRowBlock("▶ 위생 점검 사항", form.hygiene_note);
    addRowBlock("▶ 주요 문제", form.hot_issue);
    addRowBlock("▶ (운영방) 케어포 등 프로그램 사용 여부", form.program_use_whether);
    addRowBlock("▶ 라운딩 횟수 및 만족도 조사 여부", form.rounding_satis_whether);
    addRowBlock("▶ 클레임 및 민원 이력", form.complain_note);
    addRowBlock("▶ 매니저 연락처", form.manager_phone);
    addRowBlock("▶ 쓰레기 처리 방식", form.trash_treatment_type);
    addRowBlock("▶ 정기 일정", form.regular_schedule);

    // 3. 인계자 요청사항 및 기타 특이사항
    addSection("3. 인계자 요청사항 및 기타 특이사항");
    addRowBlock("내용", form.special_note, 60);

    // =========================
    // 7. 다운로드
    // =========================
    const blob = await workbook.outputAsync();

    // ✅ 현재 선택된 계정명 찾기
    const selectedAccount = accountList.find((a) => a.account_id === selectedAccountId);
    const accountName = selectedAccount ? selectedAccount.account_name : "handover";

    FileSaver.saveAs(blob, `${accountName}_인수인계서.xlsx`);
  };

  return (
    <>
      <MDBox pt={1} gap={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          select
          size="small"
          value={selectedAccountId}
          onChange={onSearchList}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {(accountList || []).map((row) => (
            <option key={row.account_id} value={row.account_id}>
              {row.account_name}
            </option>
          ))}
        </TextField>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
        <MDButton variant="gradient" color="success" onClick={handleExcelDownload}>
          엑셀 다운로드
        </MDButton>
      </MDBox>

      <MDBox sx={tableSx}>
        <table>
          <thead>
            <tr>
              <th colSpan={6}>업 무 인 수 인 계 서</th>
            </tr>
            <tr>
              <th colSpan={2}>인계자</th>
              <th colSpan={2}>인수자</th>
              <th colSpan={2}>확인자</th>
            </tr>
            <tr>
              <td>업체명</td>
              <td>{renderInput("handover_company")}</td>
              <td>업체명</td>
              <td>{renderInput("acquisition_company")}</td>
              <td>부서명</td>
              <td>{renderInput("check_team")}</td>
            </tr>
            <tr>
              <td>성명</td>
              <td>{renderInput("handover_name")}</td>
              <td>성명</td>
              <td>{renderInput("acquisition_name")}</td>
              <td>성명</td>
              <td>{renderInput("check_name")}</td>
            </tr>
            <tr>
              <td>인계일자</td>
              <td>{renderInput("handover_dt", { type: "date" })}</td>
              <td>인수일자</td>
              <td>{renderInput("acquisition_dt", { type: "date" })}</td>
              <td>인계장소</td>
              <td>{renderInput("handover_location")}</td>
            </tr>
          </thead>
          <tbody>
            {/* 1. 업무 현황 */}
            <tr>
              <th colSpan={6}>1. 업무 현황</th>
            </tr>
            <tr>
              <td>▶ 급식 대상자 수</td>
              <td colSpan={5}>{renderInput("meal_number")}</td>
            </tr>
            <tr>
              <td>
                ▶ 식수 운영 방식 및 배식 방식 <br />
                <span style={{ color: "red", fontSize: "11px" }}>
                  (예 : 선택식, 일품식, 샐러드바식, 식판배식, 그룹배식 등) <br />
                  * 그릇 세척, 음식물 처리 시 아웃소싱도 나누어 기재
                </span>
              </td>
              <td colSpan={5}>{renderInput("catering_ration", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 일반 식단 운영 방식<br />
                (예: 1일 3식, 간식 포함 여부, 식사제공시간 등)
              </td>
              <td colSpan={5}>{renderInput("normal_diet", { multiline: true })}</td>
            </tr>
            <tr>
              <td>▶ 주방 인력 구성 (이름, 연락처)</td>
              <td colSpan={5}>{renderInput("kitchen_member", { multiline: true })}</td>
            </tr>
            <tr>
              <td>▶ 근무자 시간 및 스케줄 근무 형태</td>
              <td colSpan={5}>{renderInput("work_type", { multiline: true })}</td>
            </tr>
            <tr>
              <td>▶ 발주 프로그램 아이디 & 비밀번호</td>
              <td colSpan={5}>{renderInput("order_program_info")}</td>
            </tr>
            <tr>
              <td>
                ▶ 식재료 발주 방식 및 인원수<br />
                (업체명, 발주 요일, 발주 방법 등)
              </td>
              <td colSpan={5}>{renderInput("ingredients_order_type", { multiline: true })}</td>
            </tr>
            <tr>
              <td>▶ 검수 및 입고 방법<br />(시간, 장소, 확인자 등)</td>
              <td colSpan={5}>{renderInput("inspection_store_type", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 재고 관리 방법<br />
                (보관 방식, 소진기한 관리 등)
              </td>
              <td colSpan={5}>{renderInput("stock_manage_type", { multiline: true })}</td>
            </tr>

            {/* 2. 주요 업무 및 주의사항 */}
            <tr>
              <th colSpan={6}>2. 주요 업무 및 주의사항</th>
            </tr>
            <tr>
              <td>
                ▶ 식단 구성 및 제출 주기<br />
                (계절별 메뉴, 영양사 검토 포함)
              </td>
              <td colSpan={5}>{renderInput("diet_submit_cycle", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 위생 점검 사항<br />
                (정기/수시 점검 내용 및 주의사항)
              </td>
              <td colSpan={5}>{renderInput("hygiene_note", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 주요 문제<br />
                (일일 점식구, 우샘검검표, 주방도구 소독일지 등)
              </td>
              <td colSpan={5}>{renderInput("hot_issue", { multiline: true })}</td>
            </tr>
            <tr>
              <td>▶ (운영방) 케어포 등 프로그램 사용 여부</td>
              <td colSpan={5}>{renderInput("program_use_whether")}</td>
            </tr>
            <tr>
              <td>▶ 라운딩 횟수 및 만족도 조사 여부</td>
              <td colSpan={5}>{renderInput("rounding_satis_whether")}</td>
            </tr>
            <tr>
              <td>▶ 클레임 및 민원 이력<br />(최근 3개월 내)</td>
              <td colSpan={5}>{renderInput("complain_note", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 매니저 연락처<br />
                (식당소장, 점검담당자, 긴급대출출입 등 주요 연락처)
              </td>
              <td colSpan={5}>{renderInput("manager_phone", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 쓰레기 처리 방식<br />
                (업체 수거/분리배출 규칙 등)
              </td>
              <td colSpan={5}>{renderInput("trash_treatment_type", { multiline: true })}</td>
            </tr>
            <tr>
              <td>
                ▶ 정기 일정<br />
                (예: 주간 교육, 회의, 설비점검 등)
              </td>
              <td colSpan={5}>{renderInput("regular_schedule", { multiline: true })}</td>
            </tr>

            {/* 3. 특이사항 */}
            <tr>
              <th colSpan={6}>3. 인계자 요청사항 및 기타 특이사항</th>
            </tr>
            <tr>
              <td>내용</td>
              <td colSpan={5}>{renderInput("special_note", { multiline: true, rows: 5 })}</td>
            </tr>
          </tbody>
        </table>
      </MDBox>
    </>
  );
}
