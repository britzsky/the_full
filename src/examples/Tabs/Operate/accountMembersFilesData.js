/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useMembersFilesData() {
  const [membersFilesListRows, setMembersFilesListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 현장 직원 파일 조회
  const fetcMembersFilesList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountMembersFilesList", {
        params: { account_id: account_id },
      });

      const rows = (res.data || []).map((item) => ({
        member_id: item.member_id,
        name: item.name,
        position: item.position,
        doc_type_id: item.doc_type_id,
        doc_id: item.doc_id,
        file_path: item.file_path,
        issue_dt: item.issue_dt,
        expiry_dt: item.expiry_dt,
      }));

      setMembersFilesListRows(rows.map((row) => ({ ...row })));
    } catch (err) {
      console.error("차량 정보 조회 실패:", err);
      setMembersFilesListRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetcTypeForFileList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountTypeForFileList", {
        params: { account_id: account_id },
      });

      const rows = (res.data || []).map((item) => ({
        member_id: item.member_id,
        doc_type_id: item.doc_type_id,
        doc_id: item.doc_id,
        file_path: item.file_path,
        issue_dt: item.issue_dt,
        expiry_dt: item.expiry_dt,
        note: item.note
      }));

      setMembersFilesListRows(rows.map((row) => ({ ...row })));
    } catch (err) {
      console.error("차량 정보 조회 실패:", err);
      setMembersFilesListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return { membersFilesListRows, setMembersFilesListRows, accountList, loading, fetcMembersFilesList, fetcTypeForFileList };
}

export { parseNumber, formatNumber };
