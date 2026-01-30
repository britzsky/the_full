// src/layouts/handover/electronicPaymentSheetData.js
/* eslint-disable react/function-component-definition */
import { useCallback, useEffect, useState } from "react";
import api from "api/api";

// ✅ TODO: 실제 엔드포인트로 교체
const DEPARTMENT_LIST_API = "/HeadOffice/HeadOfficeDepartmentList";

// ✅ TODO: 부서별 사용자 목록 (부서코드/부서id 기준)
const USERS_BY_DEPARTMENT_API = "/HeadOffice/HeadOfficeUserListByDepartment";

// ✅ TODO: 회사 트리(부서 + 사용자 + 직급) - payer_user 선택용
const COMPANY_TREE_API = "/HeadOffice/HeadOfficeCompanyUserTree";

export default function useElectronicPaymentSheetData() {
  const [docTypeList, setDocTypeList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 문서 타입 목록 조회
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/HeadOffice/HeadOfficeElectronicPaymentTypeList");
        const data = Array.isArray(res.data) ? res.data : [res.data];

        const rows = (data || [])
          .filter(Boolean)
          .map((it) => ({
            doc_type: it.doc_type,
            doc_name: it.doc_name,
            position: Number(it.position ?? 0), // ✅ 0/1/2
          }))
          .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));

        setDocTypeList(rows);
      } catch (err) {
        console.error("문서 타입 조회 실패:", err);
        setDocTypeList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ 부서 목록 조회: value=department, text=dept_name
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get(DEPARTMENT_LIST_API);
      const data = Array.isArray(res.data) ? res.data : [res.data];

      // 문자열 배열 fallback
      if (data.every((x) => typeof x === "string")) {
        return data
          .filter((v) => String(v).trim())
          .map((v) => ({ department: String(v), dept_name: String(v) }));
      }

      const mapped = (data || [])
        .filter(Boolean)
        .map((x) => ({
          department: x.department ?? x.dept_code ?? x.dept_id ?? x.code ?? "",
          dept_name: x.dept_name ?? x.department_name ?? x.name ?? "",
        }))
        .filter((d) => String(d.department).trim() && String(d.dept_name).trim());

      const uniq = new Map();
      mapped.forEach((d) => {
        const key = String(d.department);
        if (!uniq.has(key)) uniq.set(key, { department: key, dept_name: String(d.dept_name) });
      });

      return Array.from(uniq.values());
    } catch (err) {
      console.error("부서 목록 조회 실패:", err);
      return [];
    }
  }, []);

  // ✅ 부서별 사용자 조회: writer 선택 + tm_user 자동선정에 필요
  // 반환: [{ user_id, user_name, position, position_name }]
  const fetchUsersByDepartment = useCallback(async (department) => {
    if (!department) return [];
    try {
      const res = await api.get(USERS_BY_DEPARTMENT_API, { params: { department } });
      const data = Array.isArray(res.data) ? res.data : [res.data];

      return (data || [])
        .filter(Boolean)
        .map((u) => ({
          user_id: String(u.user_id ?? u.id ?? ""),
          user_name: String(u.user_name ?? u.name ?? ""),
          position: Number(u.position ?? u.pos ?? u.rank ?? 99), // ✅ 0/1/2 같은 숫자라고 가정
          position_name: String(u.position_name ?? u.rank_name ?? u.pos_name ?? ""),
        }))
        .filter((u) => u.user_id && u.user_name);
    } catch (err) {
      console.error("부서별 사용자 조회 실패:", err);
      return [];
    }
  }, []);

  // ✅ 회사 트리 조회(결재라인에서 payer_user 선택용)
  // 기대 형태(예시):
  // [
  //   { department:'D01', dept_name:'영업팀', users:[{user_id,user_name,position,position_name}, ...] },
  //   ...
  // ]
  const fetchCompanyTree = useCallback(async () => {
    try {
      const res = await api.get(COMPANY_TREE_API);
      const data = Array.isArray(res.data) ? res.data : [res.data];
      return (data || []).filter(Boolean);
    } catch (err) {
      console.error("회사 트리 조회 실패:", err);
      return [];
    }
  }, []);

  return {
    docTypeList,
    loading,
    fetchDepartments,
    fetchUsersByDepartment,
    fetchCompanyTree,
  };
}
