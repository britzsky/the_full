/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";

// ✅ 문자열로 통일 (null/undefined → "")
const toStr = (v) => (v === null || v === undefined ? "" : String(v));

// ✅ 날짜 통일 (YYYY-MM-DD만)
const toDateStr = (v) => {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

export default function useMembersFilesData() {
  const [membersFilesListRows, setMembersFilesListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 공통 row 표준화
  const normalizeRow = (item) => ({
    member_id: toStr(item.member_id),
    name: toStr(item.name),
    position: toStr(item.position),
    doc_type_id: toStr(item.doc_type_id), // ✅ 문자열로
    doc_id: toStr(item.doc_id),
    file_path: toStr(item.file_path),
    issue_dt: toDateStr(item.issue_dt),
    expiry_dt: toDateStr(item.expiry_dt),
    note: toStr(item.note), // ✅ 반드시 포함
  });

  // ✅ 현장 직원 파일 조회
  const fetcMembersFilesList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountMembersFilesList", {
        params: { account_id },
      });

      const rows = (res.data || []).map(normalizeRow);
      setMembersFilesListRows(rows.map((r) => ({ ...r })));
    } catch (err) {
      console.error("직원 파일 조회 실패:", err);
      setMembersFilesListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ (필요시) 타입별 조회
  const fetcTypeForFileList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountTypeForFileList", {
        params: { account_id },
      });

      const rows = (res.data || []).map(normalizeRow);
      setMembersFilesListRows(rows.map((r) => ({ ...r })));
    } catch (err) {
      console.error("타입별 파일 조회 실패:", err);
      setMembersFilesListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: toStr(item.account_id),
          account_name: toStr(item.account_name),
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return {
    membersFilesListRows,
    setMembersFilesListRows,
    accountList,
    loading,
    fetcMembersFilesList,
    fetcTypeForFileList,
  };
}
