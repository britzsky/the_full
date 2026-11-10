/* eslint-disable react/function-component-definition */
// 인사 > 근로계약서 화면의 API 호출 모음 (거래처·직원·계약서 조회, 계약서 저장·삭제)
import { useCallback, useEffect, useState } from "react";
import api from "api/api";

export default function useContractData() {
  // 거래처 선택 목록
  const [accountList, setAccountList] = useState([]);
  // 계약서 현황 목록
  const [contractRows, setContractRows] = useState([]);
  // 작성 탭에서 선택한 거래처의 재직 직원 목록
  const [memberList, setMemberList] = useState([]);
  // 작성 탭에서 선택한 거래처의 파출 직원 목록 (기준월별)
  const [dispatchList, setDispatchList] = useState([]);

  // 거래처 목록 조회 (화면 진입 시 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
      .then((res) => setAccountList(res.data || []))
      .catch(() => setAccountList([]));
  }, []);

  // 계약서 현황 목록을 검색 조건(거래처·상태·이름)으로 조회하는 함수
  const fetchContractList = useCallback(async (filter) => {
    try {
      const res = await api.get("/Operate/ContractList", { params: filter });
      setContractRows(res.data || []);
    } catch (err) {
      console.error("ContractList 조회 실패:", err);
      setContractRows([]);
    }
  }, []);

  // 선택한 거래처의 재직 직원 목록을 조회하는 함수 (작성 탭 직원 선택용)
  const fetchMemberList = useCallback(async (accountId) => {
    if (!accountId) {
      setMemberList([]);
      return;
    }
    try {
      const res = await api.get("/Operate/AccountMemberAllList", {
        params: { account_id: accountId, del_yn: "N" },
      });
      setMemberList((res.data || []).filter((row) => String(row.account_id) === String(accountId)));
    } catch (err) {
      console.error("AccountMemberAllList 조회 실패:", err);
      setMemberList([]);
    }
  }, []);

  // 선택한 거래처의 파출 직원 목록을 조회하는 함수 (기준월별 행, 최신월 먼저)
  const fetchDispatchList = useCallback(async (accountId) => {
    if (!accountId) {
      setDispatchList([]);
      return;
    }
    try {
      const res = await api.get("/Operate/ContractDispatchMemberList", {
        params: { account_id: accountId },
      });
      setDispatchList(res.data || []);
    } catch (err) {
      console.error("ContractDispatchMemberList 조회 실패:", err);
      setDispatchList([]);
    }
  }, []);

  // 선택한 거래처에 이미 작성된 계약서 목록을 조회하는 함수 (일괄 작성 대상의 기존 계약서 표시용)
  const fetchAccountContracts = async (accountId) => {
    const res = await api.get("/Operate/ContractList", { params: { account_id: accountId } });
    return res.data || [];
  };

  // 요양원 일괄 작성: 공통 계약 조건 + 대상자 목록을 한 번에 저장하는 함수
  const saveContractBulk = async (payload) => {
    const res = await api.post("/Operate/ContractBulkSave", payload);
    return res.data;
  };

  // 계약서 1건 상세를 조회하는 함수 (현황 목록에서 계약서 열기)
  const fetchContractDetail = async (contractId) => {
    const res = await api.get("/Operate/ContractDetail", { params: { contract_id: contractId } });
    return res.data;
  };

  // 계약서를 저장하는 함수 (contract_id 없으면 신규, 있으면 수정)
  const saveContract = async (payload) => {
    const res = await api.post("/Operate/ContractSave", payload);
    return res.data;
  };

  // 서명 전 계약서의 근로자에게 앱 알림을 다시 보내는 함수 (응답 push_count: 보낸 기기 수)
  const resendContractPush = async (contractId) => {
    const res = await api.post("/Operate/ContractPushResend", { contract_id: contractId });
    return res.data;
  };

  // 계약서를 삭제 처리하는 함수 (서명 전 계약서만)
  const deleteContract = async (payload) => {
    const res = await api.post("/Operate/ContractDelete", payload);
    return res.data;
  };

  // 계약서 보기 PDF를 불러와 화면 표시용 주소(blob URL)로 만드는 함수 (서명본 또는 현재 양식으로 만든 PDF)
  const fetchContractViewPdf = async (contractId) => {
    const res = await api.get("/Operate/ContractViewPdf", {
      params: { contract_id: contractId },
      responseType: "blob",
    });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  };

  // 구분별 근로계약서 조항 양식을 조회하는 함수 (corType "1" 법인 / "2" 개인, { clauses, mod_dt, mod_user_id, unsigned_count })
  const fetchTemplate = useCallback(async (corType) => {
    const res = await api.get("/Operate/ContractTemplate", { params: { cor_type: corType } });
    return res.data || { clauses: [] };
  }, []);

  // 구분별 근로계약서 조항 양식을 저장하는 함수 (cor_type 포함, 그 구분의 서명 전 계약서에 바로 반영)
  const saveTemplate = async (payload) => {
    const res = await api.post("/Operate/ContractTemplateSave", payload);
    return res.data;
  };

  // 서명 완료 계약서의 서명본 PDF를 내려받는 함수 (파일명: 요양원_성명_생년월일_근로계약서.pdf)
  // 생년월일은 계약서 상세의 주민등록번호 앞 6자리 (조회 실패 시 생년월일 없이 저장)
  const downloadContractPdf = async (row) => {
    const [res, detail] = await Promise.all([
      api.get("/Operate/ContractPdf", {
        params: { contract_id: row.contract_id },
        responseType: "blob",
      }),
      api
        .get("/Operate/ContractDetail", { params: { contract_id: row.contract_id } })
        .then((detailRes) => detailRes.data)
        .catch(() => null),
    ]);
    const birth6 = String(detail?.rrn || "").replace(/\D/g, "").slice(0, 6);
    // 파일명에 쓸 수 없는 문자(\ / : * ? " < > |)는 빼고 밑줄로 연결
    const fileName = [row.account_name, row.name, birth6, "근로계약서"]
      .map((part) => String(part || "").replace(/[\\/:*?"<>|]/g, "").trim())
      .filter(Boolean)
      .join("_");
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
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
  };
}
