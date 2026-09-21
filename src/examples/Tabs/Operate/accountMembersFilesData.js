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

// ✅ 직급(position_type) 코드 → 라벨 매핑 (다른 Operate 탭과 동일한 코드 체계)
const positionOptions = [
  { value: "1", label: "영양사" },
  { value: "2", label: "조리팀장" },
  { value: "3", label: "조리장" },
  { value: "4", label: "조리사" },
  { value: "5", label: "조리원" },
  { value: "6", label: "유틸" },
  { value: "7", label: "통합" },
];

// ✅ 직급 표시는 position_type 우선, 없으면 서버 문자열(position)로 폴백
const getPositionLabel = (positionType, positionText) => {
  const key = String(positionType ?? "").trim();
  if (key) {
    return positionOptions.find((p) => String(p.value) === key)?.label ?? key;
  }
  return String(positionText ?? "").trim();
};

export default function useMembersFilesData() {
  const [membersFilesListRows, setMembersFilesListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 공통 row(문서 1건) 표준화 — 회원당 문서종류별로 여러 행이 내려옴
  const normalizeRow = (item) => ({
    member_id: toStr(item.member_id),
    name: toStr(item.name),
    position_type: toStr(item.position_type), // ✅ 직급 코드 원본 보관
    position: getPositionLabel(item.position_type, item.position), // ✅ position_type 우선으로 직급 라벨 계산
    doc_type_id: toStr(item.doc_type_id), // ✅ 문자열로
    doc_id: toStr(item.doc_id),
    file_path: toStr(item.file_path),
    issue_dt: toDateStr(item.issue_dt),
    expiry_dt: toDateStr(item.expiry_dt),
    note: toStr(item.note), // ✅ 반드시 포함
  });

  // ✅ 회원당 여러 건으로 내려오는 flat rows를 member 단위로 묶어
  //    docs: { [doc_type_id]: { doc_id, file_path, issue_dt, expiry_dt, note } } 형태로 변환
  const groupByMember = (flatRows) => {
    const order = [];
    const map = new Map();

    flatRows.forEach((r) => {
      if (!map.has(r.member_id)) {
        map.set(r.member_id, {
          member_id: r.member_id,
          name: r.name,
          position_type: r.position_type,
          position: r.position,
          docs: {},
        });
        order.push(r.member_id);
      }
      if (r.doc_type_id) {
        map.get(r.member_id).docs[r.doc_type_id] = {
          doc_id: r.doc_id,
          file_path: r.file_path,
          issue_dt: r.issue_dt,
          expiry_dt: r.expiry_dt,
          note: r.note,
        };
      }
    });

    return order.map((id) => map.get(id));
  };

  // ✅ 현장 직원 파일 조회 (회원 × 문서종류 전체를 묶어서 세팅)
  const fetcMembersFilesList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountMembersFilesList", {
        params: { account_id },
      });

      const flatRows = (res.data || []).map(normalizeRow);
      setMembersFilesListRows(groupByMember(flatRows));
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
