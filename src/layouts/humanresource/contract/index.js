// 인사 > 근로계약서 화면: 계약서 현황 목록과 계약서 작성(원본 엑셀 양식)을 탭으로 표시
// 저장한 계약서는 채움원 앱 전자계약 화면에서 해당 직원이 바로 확인할 수 있다
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import { Autocomplete, Box, Card, Checkbox, Tab, Tabs, TextField } from "@mui/material";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import ContractForm, { formatMoney, PAY_KEYS, sumPay } from "./ContractForm";
import { useFillViewportHeight } from "utils/HygieneCardBoard";
import ContractTemplateEditor from "./ContractTemplateEditor";
import useContractData from "./data/ContractData";

// 직원 직책 코드 → 종사업무 기본값 (현장 직원관리 직책 구분과 동일)
const POSITION_LABELS = {
  1: "영양사",
  2: "조리팀장",
  3: "조리장",
  4: "조리사",
  5: "조리원",
  6: "유틸",
  7: "통합",
};

// 진행 상태별 표시 색상
const STATUS_COLORS = {
  미확인: { bg: "#fff3cd", fg: "#8a6d00" },
  확인: { bg: "#e2f0fb", fg: "#1687b2" },
  서명완료: { bg: "#e1f4e7", fg: "#2a7a49" },
  "이전 계약": { bg: "#eceff1", fg: "#7a8998" },
};

// 화면에 보일 상태 (같은 직원의 더 나중 서명완료 계약서가 있으면 이전 서명본은 '이전 계약')
const statusLabel = (row) => (row?.replaced_yn === "Y" ? "이전 계약" : row?.status);

// 상태 배지 스타일 (고정 높이 + 세로 가운데 정렬, small: 직원 검색 목록용 작은 배지)
// 한글이 대체 글꼴로 그려져 위로 뜨는 만큼 위 여백을 1px 더 줘서 글자를 배지 가운데에 맞춤
const statusBadgeStyle = (color, small = false) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: small ? 18 : 22,
  padding: small ? "1px 8px 0" : "1px 10px 0",
  boxSizing: "border-box",
  borderRadius: 11,
  fontSize: small ? 11 : 12,
  lineHeight: 1,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
  backgroundColor: color?.bg,
  color: color?.fg,
});

// 저장 결과의 앱 알림 발송 안내 문구 (새 계약서만 push_count가 옴, 0이면 앱 알림을 받을 기기 없음)
const pushResultText = (result) => {
  if (result?.push_count === undefined) return "";
  return Number(result.push_count) > 0
    ? `<br/><br/>채움원 앱 알림을 ${result.push_count}대 기기로 보냈습니다.`
    : "<br/><br/>앱 알림을 받을 기기가 없습니다.<br/>(앱 미설치·알림 꺼짐·새 버전 로그인 전) 근로자에게 직접 안내해 주세요.";
};

// 취업장소 회사명 기본값 (법인 / 개인, 직원 구분에 따라 자동으로 바뀌는 값)
const COMPANY_PLACES = ["주식회사 더채움", "더채움"];

// 새 계약서 작성 시 기본값 (작성일자는 비워 두고 서명 시 입력, 수습 3개월)
const emptyForm = () => ({
  contract_id: "",
  account_id: "",
  account_name: "",
  member_id: "",
  member_type: "직원",
  // 양식 甲 칸 표시용 구분 (직원 선택 시 직원관리 값, 저장 시에는 서버가 직원관리 값으로 기록, 빈 값: 일괄 작성 직원별)
  cor_type: "1",
  contract_kind: "정규직",
  name: "",
  rrn: "",
  address: "",
  contract_dt: "",
  contract_start_dt: "",
  contract_end_dt: "",
  day_work_hours: "",
  month_work_hours: "",
  week_work_days: "",
  start_time: "",
  end_time: "",
  break_hours: "",
  ot_hours: "",
  night_hours: "",
  holiday_hours: "",
  job_name: "",
  // 취업장소 기본값 (근무 요양원이 아닌 소속 회사명으로 표기)
  work_place: "주식회사 더채움",
  base_pay: "",
  meal_pay: "",
  car_pay: "",
  child_pay: "",
  annual_leave_pay: "",
  ot_pay: "",
  holiday_pay: "",
  night_pay: "",
  probation_months: "3",
  status: "",
});

// 계약서 양식 미리보기에 넣는 예시 값
const PREVIEW_FORM = {
  ...emptyForm(),
  name: "홍길동",
  rrn: "800101-2******",
  address: "경기도 수원시 권선구 금호로 210",
  contract_start_dt: dayjs().format("YYYY-MM-DD"),
  day_work_hours: "8",
  month_work_hours: "209",
  week_work_days: "5",
  start_time: "06:00",
  end_time: "15:00",
  break_hours: "1",
  job_name: "조리사",
  base_pay: "2,500,000",
  meal_pay: "200,000",
};

// 조회한 숫자 값을 입력칸 문자열로 변환 (null은 빈칸, 금액은 콤마)
const toFormValues = (row) => {
  const next = { ...emptyForm() };
  Object.keys(next).forEach((key) => {
    const value = row[key];
    if (value === null || value === undefined) return;
    next[key] = PAY_KEYS.includes(key) ? formatMoney(value) : String(value);
  });
  return next;
};

// 거래처 검색의 "전체" 항목 (같은 객체를 계속 써야 입력 중인 글자가 지워지지 않음)
const ALL_ACCOUNT_OPTION = { account_id: "", account_name: "전체" };

// 거래처 검색 선택칸 (다른 ERP 화면 거래처 검색과 같은 방식: 이름 일부 입력, Enter로 바로 선택, 삭제 거래처는 빨간 글씨)
// allOption: 맨 위에 "전체" 항목을 두고 값이 비어 있으면 "전체"로 표시 (현황 검색용)
function AccountSearch({ accountList, value, onSelect, allOption }) {
  // 검색칸에 입력 중인 글자
  const [input, setInput] = useState("");
  // 선택 목록 (allOption이면 맨 위에 전체 항목)
  const options = useMemo(
    () => (allOption ? [ALL_ACCOUNT_OPTION, ...accountList] : accountList),
    [allOption, accountList]
  );
  const selected = options.find((row) => String(row.account_id) === String(value)) || null;

  // Enter 입력 시 입력한 글자로 거래처 선택 (정확 일치 우선, 없으면 부분 일치)
  const selectByInput = () => {
    const q = input.trim().toLowerCase();
    if (!q) return;
    const found =
      options.find((a) => String(a?.account_name || "").toLowerCase() === q) ||
      options.find((a) =>
        String(a?.account_name || "")
          .toLowerCase()
          .includes(q)
      );
    if (found) onSelect(found.account_id);
  };

  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      onChange={(_, next) => onSelect(next?.account_id || "")}
      disableClearable={allOption}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      // Enter는 입력한 글자로 선택 (목록에서 강조된 항목이 대신 선택되지 않도록 기본 처리 막음)
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.defaultMuiPrevented = true;
          e.preventDefault();
          selectByInput();
        }
      }}
      getOptionLabel={(opt) => (opt?.account_name ? String(opt.account_name) : "")}
      isOptionEqualToValue={(opt, val) => String(opt?.account_id) === String(val?.account_id)}
      renderOption={(optionProps, opt) => (
        <li
          {...optionProps}
          key={opt.account_id || "all"}
          style={{
            ...(optionProps.style || {}),
            color: String(opt?.del_yn ?? "N").toUpperCase() === "Y" ? "#d32f2f" : "inherit",
          }}
        >
          {opt.account_name}
        </li>
      )}
      noOptionsText="검색된 거래처가 없습니다"
      sx={{
        width: 240,
        // 옆 셀렉트 박스(37.25px)와 같은 높이, 글자 세로 가운데
        "& .MuiOutlinedInput-root": { height: "37.25px" },
        "& .MuiInputBase-input": { lineHeight: "1.4375em" },
      }}
      renderInput={(params) => (
        <TextField {...params} label="거래처 검색" placeholder="거래처명을 입력" />
      )}
    />
  );
}

AccountSearch.propTypes = {
  accountList: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSelect: PropTypes.func.isRequired,
  allOption: PropTypes.bool,
};

AccountSearch.defaultProps = {
  allOption: false,
};

function ContractManager() {
  // 현재 탭 (list: 계약서 현황, write: 계약서 작성·개별 수정, template: 계약서 수정(조항 문구 편집))
  const [tab, setTab] = useState("list");
  // 계약서 현황 검색 조건
  const [filter, setFilter] = useState({ account_id: "", status: "", name: "" });
  // 작성 중인 계약서 값
  const [form, setForm] = useState(emptyForm());
  // 작성 방식 (single: 1명 작성, bulk: 요양원 일괄 작성)
  const [writeMode, setWriteMode] = useState("single");
  // 일괄 작성 대상자 선택 (키: "구분-member_id", 값: 대상자 정보)
  const [bulkTargets, setBulkTargets] = useState({});
  // 일괄 작성 대상 목록 보기 조건 (직원/파출 탭, 이름 검색)
  const [bulkTab, setBulkTab] = useState("직원");
  const [bulkSearch, setBulkSearch] = useState("");
  // 선택한 요양원에 이미 작성된 계약서 (일괄 작성 대상의 기존 계약서 상태 표시)
  const [accountContracts, setAccountContracts] = useState([]);
  // 구분별 계약서 조항 목록과 양식 정보 (1: 법인, 2: 개인 / 최종 수정일시·수정자, 그 구분의 서명 전 계약서 수)
  const [templates, setTemplates] = useState({
    1: { clauses: [], info: {} },
    2: { clauses: [], info: {} },
  });
  // 계약서 수정(양식) 탭에서 편집 중인 양식 구분 ("1": (주)더채움 법인, "2": 더채움 개인)
  const [templateCorType, setTemplateCorType] = useState("1");
  // 현황에서 PDF로 보고 있는 계약서 행과 PDF 화면 주소 (없으면 목록 표시)
  const [viewRow, setViewRow] = useState(null);
  const [viewPdfUrl, setViewPdfUrl] = useState("");
  // PDF 보기 영역을 화면 맨 아래까지 채우는 높이 (페이지 스크롤 없이 PDF 안에서만 스크롤)
  // 아래 여백 38px: 카드 안쪽 여백 16px + 카드 아래 끝을 왼쪽 메뉴 바 끝(화면 아래 22px)에 맞춤
  const [pdfAreaRef, pdfAreaHeight] = useFillViewportHeight(38);

  // 거래처·계약서·직원 조회와 저장·삭제 API (data/ContractData.js)
  const {
    accountList,
    contractRows,
    memberList,
    setMemberList,
    dispatchList,
    setDispatchList,
    fetchContractList,
    fetchMemberList,
    fetchDispatchList,
    fetchAccountContracts,
    saveContractBulk,
    fetchContractDetail,
    saveContract,
    resendContractPush,
    deleteContract,
    downloadContractPdf,
    fetchContractViewPdf,
    fetchTemplate,
    saveTemplate,
  } = useContractData();

  // 구분별 계약서 조항 양식을 불러오는 함수 (화면 진입 시 법인·개인 둘 다, 양식 탭 진입·저장 후 다시)
  const loadTemplate = useCallback(
    async (corType) => {
      try {
        const data = await fetchTemplate(corType);
        setTemplates((prev) => ({
          ...prev,
          [corType]: {
            clauses: Array.isArray(data.clauses) ? data.clauses : [],
            info: {
              mod_dt: data.mod_dt || "",
              mod_user_id: data.mod_user_id || "",
              unsigned_count: Number(data.unsigned_count) || 0,
            },
          },
        }));
      } catch (err) {
        console.error("ContractTemplate 조회 실패:", err);
      }
    },
    [fetchTemplate]
  );

  useEffect(() => {
    loadTemplate("1");
    loadTemplate("2");
  }, [loadTemplate]);

  const isSigned = form.status === "서명완료";
  const isBulk = writeMode === "bulk" && !form.contract_id;

  // 파출 직원별 가장 최근 기준월 1건 (조회 결과가 최신월 순이라 최근 기준월 파출부터 표시)
  const latestDispatch = dispatchList.filter(
    (row, idx) => dispatchList.findIndex((other) => other.member_id === row.member_id) === idx
  );
  // 1명 작성 직원 검색 목록 (직원 + 파출, 구분별로 묶어 표시)
  const personOptions = [
    ...memberList.map((row) => ({ ...row, member_type: "직원" })),
    ...latestDispatch.map((row) => ({ ...row, member_type: "파출", address: "" })),
  ];
  // 직원 검색 목록 표시 이름 (직책이 없는 파출은 파출업체)
  const personLabel = (opt) =>
    `${opt.name} (${POSITION_LABELS[opt.position_type] || opt.dispatch_account || "-"})`;

  // 일괄 작성 대상 목록 (현재 탭·이름 검색 조건)
  const bulkRows = (
    bulkTab === "직원"
      ? memberList.map((row) => ({ ...row, member_type: "직원" }))
      : latestDispatch.map((row) => ({ ...row, member_type: "파출", address: "" }))
  )
    .filter((row) => !bulkSearch || String(row.name || "").includes(bulkSearch.trim()))
    .map((row) => ({
      ...row,
      account_id: form.account_id,
      account_name: form.account_name,
      // 여러 요양원 대상을 함께 담으므로 요양원까지 포함한 키
      key: `${form.account_id}-${row.member_type}-${row.member_id}`,
    }));
  const bulkCount = Object.keys(bulkTargets).length;
  // 일괄 작성에 담긴 요양원별 대상자 수 [[요양원명, 인원]]
  const bulkAccounts = Object.entries(
    Object.values(bulkTargets).reduce((acc, t) => {
      acc[t.account_name] = (acc[t.account_name] || 0) + 1;
      return acc;
    }, {})
  );

  // 현황 탭으로 오거나 검색 조건이 바뀌면 계약서 목록 다시 조회
  useEffect(() => {
    if (tab === "list") fetchContractList(filter);
  }, [tab, filter, fetchContractList]);

  // 양식 입력칸 값 변경 처리
  const handleFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // 작성 탭 거래처 선택 처리 (직원 선택 초기화 후 직원 목록 조회)
  const handleAccountSelect = (accountId) => {
    const account = accountList.find((row) => String(row.account_id) === String(accountId));
    setForm((prev) => ({
      ...prev,
      account_id: accountId,
      account_name: account?.account_name || "",
      member_id: "",
      member_type: "직원",
      name: "",
      rrn: "",
      address: "",
    }));
    // 일괄 작성 체크 대상은 요양원을 바꿔도 유지 (여러 요양원 대상을 모아 한 번에 저장)
    setBulkSearch("");
    fetchMemberList(accountId);
    fetchDispatchList(accountId);
    if (accountId) {
      fetchAccountContracts(accountId)
        .then(setAccountContracts)
        .catch(() => setAccountContracts([]));
    } else {
      setAccountContracts([]);
    }
  };

  // 작성 탭 직원 선택 처리 (성명·주민등록번호·주소·시업/종업 시각·종사업무를 직원·파출 정보로 채움)
  const handleMemberSelect = (member) => {
    if (!member) {
      setForm((prev) => ({
        ...prev,
        member_id: "",
        member_type: "직원",
        name: "",
        rrn: "",
        address: "",
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      member_id: member.member_id,
      member_type: member.member_type,
      cor_type: member.member_type === "직원" && String(member.cor_type) === "2" ? "2" : "1",
      // 취업장소가 회사명 기본값이면 직원 구분에 맞는 회사명으로 (직접 입력한 장소는 유지)
      work_place: COMPANY_PLACES.includes(prev.work_place)
        ? member.member_type === "직원" && String(member.cor_type) === "2"
          ? "더채움"
          : "주식회사 더채움"
        : prev.work_place,
      name: member.name || "",
      rrn: member.rrn || "",
      address: member.address || "",
      start_time: member.start_time || prev.start_time,
      end_time: member.end_time || prev.end_time,
      job_name: POSITION_LABELS[member.position_type] || prev.job_name,
    }));
  };

  // 새 계약서 작성 시작 (빈 양식으로 작성 탭 열기, mode: single 1명 / bulk 요양원 일괄)
  const handleNewContract = (mode) => {
    setForm({ ...emptyForm(), cor_type: mode === "bulk" ? "" : "1" });
    setWriteMode(mode);
    setMemberList([]);
    setDispatchList([]);
    setBulkTargets({});
    setBulkSearch("");
    setAccountContracts([]);
    setTab("write");
  };

  // 일괄 작성 대상자 체크 처리 (체크하면 추가, 해제하면 제외)
  const toggleBulkTarget = (row) =>
    setBulkTargets((prev) => {
      const next = { ...prev };
      if (next[row.key]) delete next[row.key];
      else next[row.key] = row;
      return next;
    });

  // 일괄 작성 체크 대상의 구분으로 양식 표시 맞춤 (모두 같은 구분이면 그 회사, 섞이면 '직원별 구분')
  // 저장 시 구분·취업장소는 서버가 대상자마다 직원관리 구분으로 다시 정함
  useEffect(() => {
    if (!isBulk) return;
    const types = new Set(
      Object.values(bulkTargets).map((t) =>
        t.member_type === "직원" && String(t.cor_type) === "2" ? "2" : "1"
      )
    );
    const corType = types.size === 1 ? [...types][0] : "";
    // 취업장소가 회사명 기본값(또는 빈 값)이면 구분에 맞는 회사명, 섞이면 빈 값('직원별 구분' 안내)
    const companyPlace = { 1: "주식회사 더채움", 2: "더채움" }[corType] || "";
    setForm((prev) => ({
      ...prev,
      cor_type: corType,
      work_place:
        !prev.work_place || COMPANY_PLACES.includes(prev.work_place)
          ? companyPlace
          : prev.work_place,
    }));
  }, [bulkTargets, isBulk]);

  // 일괄 작성 대상 목록 전체 선택·해제 (현재 보이는 목록 기준)
  const toggleBulkAll = (checked) =>
    setBulkTargets((prev) => {
      const next = { ...prev };
      bulkRows.forEach((row) => {
        if (checked) next[row.key] = row;
        else delete next[row.key];
      });
      return next;
    });

  // 대상자의 기존 계약서 상태 (최근 작성 1건, 없으면 빈 값)
  const existingStatus = (row) =>
    accountContracts.find(
      (c) =>
        String(c.member_id) === String(row.member_id) &&
        (c.member_type || "직원") === row.member_type
    )?.status || "";

  // 현황 목록 행 클릭 처리 (계약서를 PDF로 보기, 서명본이 아니면 현재 양식으로 만든 PDF)
  const handleViewContract = async (row) => {
    setViewRow(row);
    setViewPdfUrl("");
    try {
      setViewPdfUrl(await fetchContractViewPdf(row.contract_id));
    } catch (err) {
      console.error("ContractViewPdf 조회 실패:", err);
      Swal.fire("오류", "계약서 PDF를 불러오지 못했습니다.", "error");
      setViewRow(null);
    }
  };

  // PDF 보기 닫고 현황 목록으로 돌아가기 (화면 주소 해제)
  const closeView = () => {
    if (viewPdfUrl) URL.revokeObjectURL(viewPdfUrl);
    setViewPdfUrl("");
    setViewRow(null);
  };

  // 계약서 양식 저장 처리 (저장 후 조항 다시 조회)
  const handleSaveTemplate = async (nextClauses) => {
    try {
      const result = await saveTemplate({
        cor_type: templateCorType,
        clauses: nextClauses,
        user_id: localStorage.getItem("user_id") || "",
      });
      if (String(result?.code) !== "200") {
        Swal.fire("저장 실패", result?.message || "저장하지 못했습니다.", "error");
        return;
      }
      await loadTemplate(templateCorType);
      Swal.fire("저장 완료", "계약서 양식이 저장되었습니다.", "success");
    } catch (err) {
      console.error("ContractTemplateSave 실패:", err);
      Swal.fire("오류", "양식 저장 중 오류가 발생했습니다.", "error");
    }
  };

  // PDF 보기에서 [수정] 처리 (계약서 상세를 불러와 계약서 수정 탭으로)
  const handleOpenContract = async (contractId) => {
    closeView();
    try {
      const detail = await fetchContractDetail(contractId);
      if (!detail?.contract_id) {
        Swal.fire("알림", "계약서를 찾을 수 없습니다.", "warning");
        return;
      }
      setForm(toFormValues(detail));
      await fetchMemberList(detail.account_id);
      setTab("write");
    } catch (err) {
      console.error("ContractDetail 조회 실패:", err);
      Swal.fire("오류", "계약서를 불러오지 못했습니다.", "error");
    }
  };

  // 저장 전 빠진 필수 입력 확인 (성명·계약기간 중 빠진 항목을 모아 한 번에 알림, 계약직은 종료일까지 확인)
  const alertMissing = (checkName) => {
    const missing = [];
    if (checkName && !form.name.trim()) missing.push("성명");
    const noStart = !form.contract_start_dt;
    const noEnd = form.contract_kind === "계약직" && !form.contract_end_dt;
    if (noStart || noEnd) {
      missing.push(
        `계약기간(${noStart && noEnd ? "시작일·종료일" : noStart ? "시작일" : "종료일"})`
      );
    }
    if (missing.length === 0) return false;
    Swal.fire("입력 확인", `${missing.join("과 ")}이 입력되지 않았습니다.`, "warning");
    return true;
  };

  // 계약서 저장 처리 (저장 즉시 앱 전자계약 화면에 표시)
  const handleSave = async () => {
    if (!form.account_id || !form.member_id) {
      Swal.fire("알림", "거래처와 직원을 선택해 주세요.", "warning");
      return;
    }
    if (alertMissing(true)) return;

    // 새 계약서인데 같은 직원의 계약서가 이미 있으면 한 번 더 확인 (재계약 등은 그대로 작성 가능)
    const existing = form.contract_id
      ? ""
      : existingStatus({ member_id: form.member_id, member_type: form.member_type });
    if (existing) {
      const again = await Swal.fire({
        title: "이미 계약서가 있는 직원입니다",
        html: `${form.name}님은 <b>${existing}</b> 상태의 계약서가 있습니다.<br/>새 계약서를 추가로 작성할까요?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "새로 작성",
        cancelButtonText: "취소",
      });
      if (!again.isConfirmed) return;
    }

    const confirm = await Swal.fire({
      title: "계약서를 저장할까요?",
      text: "저장하면 해당 직원이 채움원 앱에서 바로 확인할 수 있습니다.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "저장",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    const payload = {
      ...form,
      contract_end_dt: form.contract_kind === "계약직" ? form.contract_end_dt : "",
      total_pay: String(sumPay(form)),
      user_id: localStorage.getItem("user_id") || "",
    };

    try {
      const result = await saveContract(payload);
      if (String(result?.code) !== "200") {
        Swal.fire("저장 실패", result?.message || "저장하지 못했습니다.", "error");
        return;
      }
      setForm((prev) => ({ ...prev, contract_id: result.contract_id || prev.contract_id }));
      await Swal.fire({
        title: "저장 완료",
        html: `계약서가 저장되었습니다.${pushResultText(result)}`,
        icon: "success",
      });
      setTab("list");
    } catch (err) {
      console.error("ContractSave 실패:", err);
      Swal.fire("오류", "저장 중 오류가 발생했습니다.", "error");
    }
  };

  // 요양원 일괄 작성 저장 처리 (공통 계약 조건 + 여러 요양원에서 체크한 대상자를 한 번에 저장)
  const handleBulkSave = async () => {
    const targets = Object.values(bulkTargets);
    if (targets.length === 0) {
      Swal.fire("알림", "요양원과 계약서를 만들 대상자를 선택해 주세요.", "warning");
      return;
    }
    // 일괄 작성은 성명을 대상자 목록에서 가져오므로 계약기간만 확인
    if (alertMissing(false)) return;

    // 주민등록번호가 없으면 앱 본인 확인(생년월일 6자리)이 안 되므로 저장 전에 알림
    const noRrn = targets.filter((t) => !String(t.rrn || "").trim()).map((t) => t.name);
    const confirm = await Swal.fire({
      title: `${targets.length}명의 계약서를 저장할까요?`,
      html:
        bulkAccounts.map(([name, count]) => `${name} ${count}명`).join(", ") +
        "<br/><br/>저장하면 각 직원이 채움원 앱에서 바로 확인할 수 있습니다." +
        (noRrn.length
          ? `<br/><br/><b style="color:#c0392b">주민등록번호 없음: ${noRrn.join(", ")}</b>` +
            "<br/>저장 후 계약서를 열어 주민등록번호를 입력해야 앱에서 확인할 수 있습니다."
          : ""),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "일괄 저장",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    // 대상자별 개인 칸(성명·주민번호·주소·종사업무)은 빼고 공통 계약 조건만 전달
    const common = { ...form };
    ["contract_id", "member_id", "name", "rrn", "address", "job_name", "status"].forEach(
      (key) => delete common[key]
    );
    const payload = {
      ...common,
      contract_end_dt: form.contract_kind === "계약직" ? form.contract_end_dt : "",
      // 취업장소가 비어 있으면(구분 섞임) 회사명 기본값으로 보내 서버가 대상자 구분별 회사명으로 저장
      work_place: form.work_place || "주식회사 더채움",
      total_pay: String(sumPay(form)),
      user_id: localStorage.getItem("user_id") || "",
      // 대상자별 요양원(account_id)은 서버에서 공통 값보다 우선 적용됨
      targets: targets.map((t) => ({
        account_id: t.account_id,
        member_id: t.member_id,
        member_type: t.member_type,
        name: t.name || "",
        rrn: t.rrn || "",
        address: t.address || "",
        job_name: POSITION_LABELS[t.position_type] || "",
      })),
    };

    try {
      const result = await saveContractBulk(payload);
      if (String(result?.code) !== "200") {
        Swal.fire("저장 실패", result?.message || "저장하지 못했습니다.", "error");
        return;
      }
      await Swal.fire({
        title: "저장 완료",
        html: `${result.count}명의 계약서가 저장되었습니다.${pushResultText(result)}`,
        icon: "success",
      });
      setTab("list");
    } catch (err) {
      console.error("ContractBulkSave 실패:", err);
      Swal.fire("오류", "일괄 저장 중 오류가 발생했습니다.", "error");
    }
  };

  // 현황 목록에서 알림 버튼을 눌렀을 때 서명 전 계약서의 근로자에게 앱 알림을 다시 보내는 함수
  const handleResendPush = async (row) => {
    const confirm = await Swal.fire({
      title: "알림 보내기",
      html: `${row.name}님에게 근로계약서 도착 알림을<br/>채움원 앱으로 다시 보낼까요?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "보내기",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;
    try {
      const result = await resendContractPush(row.contract_id);
      if (String(result?.code) !== "200") {
        Swal.fire("발송 실패", result?.message || "알림을 보내지 못했습니다.", "error");
        return;
      }
      Swal.fire({
        title: Number(result.push_count) > 0 ? "발송 완료" : "받을 기기 없음",
        html: `${row.name}님${pushResultText(result)}`,
        icon: Number(result.push_count) > 0 ? "success" : "warning",
      });
    } catch (err) {
      console.error("ContractPushResend 실패:", err);
      Swal.fire("오류", "알림 발송 중 오류가 발생했습니다.", "error");
    }
  };

  // 계약서 보기 화면에서 서명 전 계약서 회수 처리 (삭제 처리되어 근로자 앱 목록·배지·알림 대상에서 빠짐)
  const handleRecall = async (row) => {
    const confirm = await Swal.fire({
      title: "계약서 회수",
      html: `${row.name}님의 근로계약서(${row.status})를 회수할까요?<br/>회수하면 채움원 앱에서 더 이상 보이지 않고<br/>현황 목록에서도 빠집니다.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "회수",
      confirmButtonColor: "#d33",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;
    try {
      const result = await deleteContract({
        contract_id: row.contract_id,
        user_id: localStorage.getItem("user_id") || "",
      });
      if (String(result?.code) !== "200") {
        // 회수 직전에 근로자가 서명을 마쳤거나 이미 회수된 경우 (서버가 이유를 구분해 메시지로 보냄)
        await Swal.fire(
          "회수 불가",
          result?.message || "근로자가 이미 서명을 완료한 계약서라 회수할 수 없습니다.",
          "error"
        );
      } else {
        await Swal.fire("회수 완료", `${row.name}님의 계약서를 회수했습니다.`, "success");
      }
      // 회수 성공·실패 모두 보기 화면을 닫고 최신 상태로 목록 다시 조회
      closeView();
      fetchContractList(filter);
    } catch (err) {
      console.error("ContractDelete 실패:", err);
      Swal.fire("오류", "회수 중 오류가 발생했습니다.", "error");
    }
  };

  // 현황 목록에서 서명본 PDF 버튼을 눌렀을 때 PDF 내려받기
  const handleDownloadPdf = async (row) => {
    try {
      await downloadContractPdf(row);
    } catch (err) {
      console.error("ContractPdf 다운로드 실패:", err);
      Swal.fire("다운로드 실패", "서명본 PDF를 내려받지 못했습니다.", "error");
    }
  };

  // 탭 목록 (인사 > 현장관리 등 다른 탭 화면과 같은 MUI 탭 구성)
  const tabConfig = [
    { key: "list", label: "📋 계약서 현황" },
    { key: "write", label: "📝 계약서 작성" },
    { key: "template", label: "✏️ 계약서 수정" },
  ];
  const tabIndex = Math.max(
    0,
    tabConfig.findIndex((item) => item.key === tab)
  );

  // 목록 표 스타일 (지점업로드 표와 같은 톤: 연회색 머리 줄 고정, 세로선 없이 가로 구분선만)
  const tableBoxSx = {
    border: "1px solid #dde5eb",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    overflow: "auto",
    // 칸 사이 세로 구분선 (첫 칸 왼쪽은 바깥 테두리와 겹치지 않게 제외)
    "& th + th": { borderLeft: "1px solid #dde5eb" },
    "& td + td": { borderLeft: "1px solid #dde5eb" },
  };
  const thSx = {
    padding: "11px 12px",
    fontSize: 12,
    fontWeight: 700,
    color: "#5b6b7c",
    backgroundColor: "#f5f8fa",
    borderBottom: "1px solid #dde5eb",
    textAlign: "center",
    whiteSpace: "nowrap",
    // 표 영역 안에서 스크롤해도 머리 줄 고정
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
  // 입력칸·셀렉트 박스 글자를 세로 가운데로 맞추는 스타일 (줄 높이를 입력칸 높이와 같게)
  const centerInputSx = { "& .MuiInputBase-input": { lineHeight: "1.4375em" } };
  // 검색 선택칸(Autocomplete) 높이를 옆 셀렉트 박스(37.25px)와 같게 맞추는 스타일
  const autocompleteSx = { "& .MuiOutlinedInput-root": { height: "37.25px" } };
  // 계약서 상세 상단 정보 칸 스타일 (옆 버튼과 같은 높이 40px, 세로 가운데 정렬)
  const infoChipSx = {
    display: "inline-flex",
    alignItems: "center",
    height: 40,
    px: 1.5,
    borderRadius: "8px",
    border: "1px solid #dfe5ea",
    backgroundColor: "#f7f9fb",
    fontSize: 13,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  const tdSx = {
    padding: "8px 12px",
    borderBottom: "1px solid #eef2f5",
    fontSize: 13,
    color: "#344767",
    textAlign: "center",
    verticalAlign: "middle",
  };

  return (
    <DashboardLayout>
      {/* 화면 상단 공통 헤더 (본사 교육 등 다른 메뉴와 같은 상단바) */}
      <DashboardNavbar title="📝 근로계약서" />
      <Card
        sx={{
          borderRadius: "16px",
          boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
          // 한글이 대체 글꼴로 그려져 버튼 글자가 위로 뜨는 것을 1px 내려 세로 가운데로 맞춤 (높이 40px 유지)
          "& .MuiButton-sizeMedium": { paddingTop: "11px", paddingBottom: "9px" },
        }}
      >
        {/* 상단 고정 영역: 계약서 현황 / 계약서 작성 / 계약서 수정 탭 */}
        <MDBox
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #eee",
          }}
        >
          <Tabs
            value={tabIndex}
            // 탭을 옮기면 각 탭을 기본 상태로 다시 조회 (현황: 목록, 작성: 빈 새 계약서, 양식: 저장된 조항)
            onChange={(_, newValue) => {
              const nextTab = tabConfig[newValue].key;
              closeView();
              if (nextTab === "write") {
                handleNewContract("single");
                return;
              }
              if (nextTab === "template") loadTemplate(templateCorType);
              setTab(nextTab);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              backgroundColor: "#f7f7f7",
              borderRadius: "16px 16px 0 0",
              "& .MuiTabs-indicator": {
                backgroundColor: "#ff9800",
                height: "3px",
                borderRadius: "3px",
              },
            }}
          >
            {tabConfig.map((item, index) => (
              <Tab
                key={item.key}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>{item.label}</span>
                  </Box>
                }
                sx={{
                  fontSize: "0.8rem",
                  minWidth: 120,
                  textTransform: "none",
                  color: tabIndex === index ? "#ff9800" : "#666",
                  fontWeight: "bold",
                  transition: "0.2s",
                  "&:hover": {
                    color: "#ff9800",
                    opacity: 0.8,
                  },
                }}
              />
            ))}
          </Tabs>
        </MDBox>

        {/* 탭 내용 */}
        <MDBox p={2}>
          {/* 현황에서 고른 계약서 PDF 보기 (서명 전 계약서만 [수정] 가능) */}
          {tab === "list" && viewRow && (
            <>
              <MDBox
                sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", flexWrap: "wrap" }}
              >
                <MDButton
                  variant="gradient"
                  color="secondary"
                  // 보기 화면을 닫고, 보는 동안 앱 서명 등으로 바뀐 상태를 반영하도록 목록 다시 조회
                  onClick={() => {
                    closeView();
                    fetchContractList(filter);
                  }}
                >
                  목록으로
                </MDButton>
                <MDBox sx={{ flex: 1 }} />
                {[
                  ["거래처", viewRow.account_name],
                  ["성명", viewRow.name],
                  ["구분", viewRow.contract_kind],
                ].map(([label, value]) => (
                  <MDBox key={label} sx={infoChipSx}>
                    <span style={{ color: "#8a97a3", marginRight: 6 }}>{label}</span>
                    <b style={{ color: "#273542" }}>{value}</b>
                  </MDBox>
                ))}
                <MDBox sx={infoChipSx}>
                  <span style={{ color: "#8a97a3", marginRight: 6 }}>상태</span>
                  <b
                    style={{
                      color: (STATUS_COLORS[statusLabel(viewRow)] || STATUS_COLORS["미확인"]).fg,
                    }}
                  >
                    {statusLabel(viewRow)}
                  </b>
                </MDBox>
                {viewRow.status === "서명완료" ? (
                  <MDButton
                    variant="gradient"
                    color="success"
                    onClick={() => handleDownloadPdf(viewRow)}
                  >
                    PDF 저장
                  </MDButton>
                ) : (
                  <>
                    {/* 서명 전(미확인·확인) 계약서 회수 버튼 */}
                    {(viewRow.status === "미확인" || viewRow.status === "확인") && (
                      <MDButton variant="gradient" color="error" onClick={() => handleRecall(viewRow)}>
                        회수
                      </MDButton>
                    )}
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={() => handleOpenContract(viewRow.contract_id)}
                    >
                      수정
                    </MDButton>
                  </>
                )}
              </MDBox>
              {/* 계약서 PDF 화면 (서명본 또는 현재 양식으로 만든 PDF) */}
              <MDBox
                ref={pdfAreaRef}
                sx={{ ...tableBoxSx, overflow: "hidden", height: pdfAreaHeight ?? "70vh" }}
              >
                {viewPdfUrl ? (
                  <iframe
                    title="근로계약서"
                    // 브라우저 PDF 뷰어에서 A4 한 장이 화면 높이에 모두 보이게 페이지 맞춤으로 열기
                    src={`${viewPdfUrl}#view=Fit`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <MDBox sx={{ p: 4, textAlign: "center", fontSize: 13, color: "#7a8998" }}>
                    계약서를 불러오는 중...
                  </MDBox>
                )}
              </MDBox>
            </>
          )}

          {tab === "list" && !viewRow && (
            <>
              {/* 계약서 현황 검색 조건 영역 */}
              <MDBox
                sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", flexWrap: "wrap" }}
              >
                {/* 거래처 검색 선택 (비우면 전체 거래처) */}
                <AccountSearch
                  accountList={accountList}
                  value={filter.account_id}
                  allOption
                  onSelect={(accountId) =>
                    setFilter((prev) => ({ ...prev, account_id: accountId }))
                  }
                />
                <TextField
                  select
                  size="small"
                  value={filter.status}
                  onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
                  sx={{ minWidth: 130, ...centerInputSx }}
                  SelectProps={{ native: true }}
                >
                  <option value="">전체 상태</option>
                  <option value="미확인">미확인</option>
                  <option value="확인">확인</option>
                  <option value="서명완료">서명완료</option>
                </TextField>
                <TextField
                  size="small"
                  placeholder="직원 이름"
                  value={filter.name}
                  onChange={(e) => setFilter((prev) => ({ ...prev, name: e.target.value }))}
                  sx={{ minWidth: 150, ...centerInputSx }}
                />
                {/* 현재 검색 조건으로 계약서 현황 다시 조회 (앱 확인·서명 상태 반영) */}
                <MDButton variant="outlined" color="dark" onClick={() => fetchContractList(filter)}>
                  새로고침
                </MDButton>
                <MDBox sx={{ flex: 1 }} />
                <MDButton variant="outlined" color="info" onClick={() => handleNewContract("bulk")}>
                  + 계약서 일괄 작성
                </MDButton>
                <MDButton
                  variant="gradient"
                  color="info"
                  onClick={() => handleNewContract("single")}
                >
                  + 새 계약서
                </MDButton>
              </MDBox>

              {/* 계약서 현황 목록 (행 클릭 시 계약서 열기) */}
              <MDBox sx={tableBoxSx}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        "거래처",
                        "성명",
                        "구분",
                        "계약기간",
                        "월급여",
                        "근무형태",
                        "작성일시",
                        "상태",
                        "앱 확인일시",
                        "서명일시",
                      ].map((label) => (
                        <th key={label} style={thSx}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contractRows.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ ...tdSx, padding: 24, color: "#7a8998" }}>
                          작성된 계약서가 없습니다.
                        </td>
                      </tr>
                    )}
                    {contractRows.map((row) => {
                      const color = STATUS_COLORS[statusLabel(row)] || STATUS_COLORS["미확인"];
                      return (
                        <tr
                          key={row.contract_id}
                          onClick={() => handleViewContract(row)}
                          // 행 높이를 PDF 버튼이 있는 서명완료 행(45px)에 맞춰 통일
                          style={{ cursor: "pointer", height: 45 }}
                        >
                          <td style={tdSx}>{row.account_name}</td>
                          <td style={tdSx}>
                            {row.name}
                            {row.member_type === "파출" && (
                              <span style={{ marginLeft: 4, fontSize: 11, color: "#8a6d00" }}>
                                파출
                              </span>
                            )}
                          </td>
                          <td style={tdSx}>{row.contract_kind}</td>
                          <td style={tdSx}>
                            {row.contract_start_dt} ~ {row.contract_end_dt || ""}
                          </td>
                          <td style={{ ...tdSx, textAlign: "right" }}>
                            {row.total_pay ? Number(row.total_pay).toLocaleString() : "-"}
                          </td>
                          {/* 직원관리에 지정된 근무형태 (파출·미지정은 -) */}
                          <td style={tdSx}>{row.work_system || "-"}</td>
                          <td style={tdSx}>{row.reg_dt}</td>
                          <td style={tdSx}>
                            <span style={statusBadgeStyle(color)}>{statusLabel(row)}</span>
                          </td>
                          <td style={tdSx}>{row.view_dt || "-"}</td>
                          {/* 서명일시와 서명본 PDF 다운로드(서명 완료 건) 또는 앱 알림 다시 보내기(서명 전 건), 버튼이 있어도 행 높이 45px 유지하도록 위아래 여백 축소 */}
                          <td style={{ ...tdSx, paddingTop: 4, paddingBottom: 4 }}>
                            {row.sign_dt || "-"}
                            {row.status !== "서명완료" && (
                              <MDButton
                                size="small"
                                variant="outlined"
                                color="info"
                                // 한글이 위로 1px 떠 보여 위 여백 2px로 가운데 맞춤
                                sx={{ ml: 1, minWidth: 0, pt: "2px", pb: 0, px: 1 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResendPush(row);
                                }}
                              >
                                알림
                              </MDButton>
                            )}
                            {row.status === "서명완료" && (
                              <MDButton
                                size="small"
                                variant="outlined"
                                color="success"
                                sx={{ ml: 1, minWidth: 0, py: 0, px: 1 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPdf(row);
                                }}
                              >
                                PDF
                              </MDButton>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </MDBox>
            </>
          )}

          {tab === "write" && (
            <>
              {/* 계약서 작성 상단: 왼쪽 목록으로·(새 계약서) 선택칸, 오른쪽 (상세) 계약 정보·상태와 저장 버튼 */}
              <MDBox
                sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", flexWrap: "wrap" }}
              >
                <MDButton variant="gradient" color="secondary" onClick={() => setTab("list")}>
                  목록으로
                </MDButton>
                {/* 새 계약서: 거래처·직원·계약 구분 선택 */}
                {!form.contract_id && (
                  <>
                    {/* 요양원(거래처) 검색 선택 */}
                    <AccountSearch
                      accountList={accountList}
                      value={form.account_id}
                      onSelect={handleAccountSelect}
                    />
                    {/* 선택한 요양원의 직원·파출 검색 선택 (1명 작성, 구분별로 묶어 표시) */}
                    {!isBulk && (
                      <Autocomplete
                        size="small"
                        options={personOptions}
                        groupBy={(opt) => opt.member_type}
                        value={
                          personOptions.find(
                            (row) =>
                              row.member_type === form.member_type &&
                              String(row.member_id) === String(form.member_id)
                          ) || null
                        }
                        disabled={!form.account_id}
                        onChange={(_, next) => handleMemberSelect(next)}
                        getOptionLabel={(opt) => (opt?.name ? personLabel(opt) : "")}
                        isOptionEqualToValue={(opt, val) =>
                          opt?.member_type === val?.member_type &&
                          String(opt?.member_id) === String(val?.member_id)
                        }
                        renderOption={(props, opt) => {
                          // 이미 작성된 계약서 상태 (오른쪽 배지, 없으면 표시 안 함)
                          const status = existingStatus(opt);
                          const color = STATUS_COLORS[status];
                          return (
                            <li {...props} key={`${opt.member_type}-${opt.member_id}`}>
                              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                                <span style={{ flex: 1 }}>{personLabel(opt)}</span>
                                {status && (
                                  <span style={statusBadgeStyle(color, true)}>{status}</span>
                                )}
                              </div>
                            </li>
                          );
                        }}
                        noOptionsText="검색된 직원이 없습니다"
                        sx={{ width: 220, ...autocompleteSx }}
                        renderInput={(params) => (
                          <TextField {...params} placeholder="직원·파출 검색" sx={centerInputSx} />
                        )}
                      />
                    )}
                    <TextField
                      select
                      size="small"
                      value={form.contract_kind}
                      onChange={(e) => handleFormChange("contract_kind", e.target.value)}
                      sx={{ minWidth: 110, ...centerInputSx }}
                      SelectProps={{ native: true }}
                    >
                      <option value="정규직">정규직</option>
                      <option value="계약직">계약직</option>
                    </TextField>
                  </>
                )}
                <MDBox sx={{ flex: 1 }} />
                {/* 기존 계약서 상세: 거래처·성명·계약 구분·상태 표시 (변경 불가) */}
                {form.contract_id && (
                  <>
                    {[
                      ["거래처", form.account_name],
                      ["성명", form.name],
                      ["구분", form.contract_kind],
                      ["근로자", form.member_type],
                    ].map(([label, value]) => (
                      <MDBox key={label} sx={infoChipSx}>
                        <span style={{ color: "#8a97a3", marginRight: 6 }}>{label}</span>
                        <b style={{ color: "#273542" }}>{value}</b>
                      </MDBox>
                    ))}
                    <MDBox sx={infoChipSx}>
                      <span style={{ color: "#8a97a3", marginRight: 6 }}>상태</span>
                      <b
                        style={{
                          color: (STATUS_COLORS[form.status] || STATUS_COLORS["미확인"]).fg,
                        }}
                      >
                        {form.status}
                      </b>
                    </MDBox>
                  </>
                )}
                {!isSigned && !isBulk && (
                  <MDButton variant="gradient" color="info" onClick={handleSave}>
                    저장
                  </MDButton>
                )}
                {isBulk && (
                  <MDButton variant="gradient" color="info" onClick={handleBulkSave}>
                    일괄 저장 ({bulkCount}명)
                  </MDButton>
                )}
              </MDBox>

              {/* 일괄 작성 대상자 선택 영역 (직원/파출 탭, 파출 기준월, 이름 검색, 체크 목록) */}
              {isBulk && (
                <MDBox sx={{ border: "1px solid #dfe5ea", borderRadius: "8px", p: 1.5, mb: 1.5 }}>
                  {/* 대상 목록 보기 조건 */}
                  <MDBox
                    sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center", flexWrap: "wrap" }}
                  >
                    {/* 직원 / 파출 목록 전환 스위치 (선택된 쪽이 흰 칸으로 올라옴) */}
                    <MDBox
                      sx={{
                        display: "inline-flex",
                        height: 40,
                        p: "3px",
                        boxSizing: "border-box",
                        borderRadius: "8px",
                        backgroundColor: "#eef1f4",
                        border: "1px solid #dfe5ea",
                      }}
                    >
                      {["직원", "파출"].map((type) => {
                        const active = bulkTab === type;
                        return (
                          <MDBox
                            key={type}
                            component="button"
                            type="button"
                            onClick={() => setBulkTab(type)}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 84,
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
                              transition: "all 0.15s",
                            }}
                          >
                            {type}
                            <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>
                              {type === "직원" ? memberList.length : latestDispatch.length}
                            </span>
                          </MDBox>
                        );
                      })}
                    </MDBox>
                    <TextField
                      size="small"
                      placeholder="이름 검색"
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      sx={{ width: 150, ...centerInputSx }}
                    />
                    <MDBox sx={{ flex: 1 }} />
                    {/* 담긴 대상자 수 (여러 요양원이면 요양원별 인원을 마우스 올려 확인) */}
                    <MDBox
                      sx={infoChipSx}
                      title={bulkAccounts.map(([name, count]) => `${name} ${count}명`).join("\n")}
                    >
                      <span style={{ color: "#8a97a3", marginRight: 6 }}>선택</span>
                      <b style={{ color: "#273542" }}>
                        {bulkCount}명
                        {bulkAccounts.length > 1 ? ` · 요양원 ${bulkAccounts.length}곳` : ""}
                      </b>
                    </MDBox>
                  </MDBox>

                  {/* 대상자 체크 목록 (기존 계약서가 있으면 상태 표시) */}
                  <MDBox sx={{ ...tableBoxSx, maxHeight: 280 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ ...thSx, width: 48 }}>
                            <Checkbox
                              size="small"
                              checked={
                                bulkRows.length > 0 && bulkRows.every((row) => bulkTargets[row.key])
                              }
                              indeterminate={
                                bulkRows.some((row) => bulkTargets[row.key]) &&
                                !bulkRows.every((row) => bulkTargets[row.key])
                              }
                              onChange={(e) => toggleBulkAll(e.target.checked)}
                              sx={{ p: 0 }}
                            />
                          </th>
                          {[
                            "성명",
                            "직책",
                            "파출업체",
                            "최근 기준월",
                            "주민등록번호",
                            "기존 계약서",
                          ].map((label) => (
                            <th key={label} style={thSx}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ ...tdSx, padding: 16, color: "#7a8998" }}>
                              {form.account_id
                                ? "대상자가 없습니다."
                                : "요양원을 먼저 선택해 주세요."}
                            </td>
                          </tr>
                        )}
                        {bulkRows.map((row) => {
                          const status = existingStatus(row);
                          const color = STATUS_COLORS[status];
                          return (
                            <tr
                              key={row.key}
                              onClick={() => toggleBulkTarget(row)}
                              style={{
                                cursor: "pointer",
                                backgroundColor: bulkTargets[row.key] ? "#f3f8ff" : "#ffffff",
                              }}
                            >
                              <td style={tdSx}>
                                <Checkbox
                                  size="small"
                                  checked={!!bulkTargets[row.key]}
                                  sx={{ p: 0, pointerEvents: "none" }}
                                />
                              </td>
                              <td style={tdSx}>{row.name}</td>
                              <td style={tdSx}>{POSITION_LABELS[row.position_type] || "-"}</td>
                              <td style={tdSx}>{row.dispatch_account || "-"}</td>
                              <td style={tdSx}>
                                {row.record_year
                                  ? `${row.record_year}-${String(row.record_month).padStart(
                                      2,
                                      "0"
                                    )}`
                                  : "-"}
                              </td>
                              <td
                                style={{
                                  ...tdSx,
                                  color: String(row.rrn || "").trim() ? undefined : "#c0392b",
                                }}
                              >
                                {String(row.rrn || "").trim()
                                  ? `${String(row.rrn)
                                      .replace(/[^0-9]/g, "")
                                      .slice(0, 6)}-*******`
                                  : "없음"}
                              </td>
                              <td style={tdSx}>
                                {status ? (
                                  <span style={statusBadgeStyle(color)}>{status}</span>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </MDBox>
                </MDBox>
              )}
              {isSigned && (
                <MDBox sx={{ mb: 1, fontSize: 13, color: "#2a7a49" }}>
                  서명이 완료된 계약서는 수정·삭제할 수 없습니다.
                </MDBox>
              )}

              {/* 근로계약서 양식 (노란 칸: 회사 입력, 파란 칸: 근로자 앱 서명) */}
              <ContractForm
                form={form}
                onChange={handleFormChange}
                readOnly={isSigned}
                bulk={isBulk}
                // 작성 중인 계약서의 구분(직원관리 값)에 맞는 양식 조항
                clauses={templates[form.cor_type === "2" ? 2 : 1].clauses}
              />
            </>
          )}

          {/* 계약서 양식 탭 (조항 편집·미리보기·저장) */}
          {tab === "template" && (
            <ContractTemplateEditor
              clauses={templates[templateCorType].clauses}
              info={templates[templateCorType].info}
              corType={templateCorType}
              onCorTypeChange={(next) => {
                setTemplateCorType(next);
                loadTemplate(next);
              }}
              previewForm={{ ...PREVIEW_FORM, cor_type: templateCorType }}
              onSave={handleSaveTemplate}
            />
          )}
        </MDBox>
      </Card>
    </DashboardLayout>
  );
}

export default ContractManager;
