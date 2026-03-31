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

        const fetchedRows = (data || [])
          .filter(Boolean)
          .map((it) => {
            // 타입 테이블의 원본 타입코드(doc_type)를 화면 식별값으로 사용한다.
            const docType = String(it?.doc_type ?? "").trim().toUpperCase();
            const docName = String(it?.doc_name ?? "").trim();
            if (!docType || !docName) return null;
            return {
              doc_id: String(it?.doc_id ?? "").trim(),
              doc_type: docType,
              large_type: String(it?.large_type ?? "").trim(),
              middle_type: String(it?.middle_type ?? "").trim(),
              small_type: String(it?.small_type ?? "").trim(),
              doc_name: docName,
              // 결재선 기준값은 approval_position 원본 컬럼을 사용한다.
              approval_position: Number(it?.approval_position ?? 0),
              position: Number(it?.approval_position ?? 0),
            };
          })
          .filter(Boolean);

        const byType = new Map();
        fetchedRows.forEach((row) => {
          const key = String(row?.doc_type ?? "").trim().toUpperCase();
          if (!key) return;
          if (!byType.has(key)) {
            byType.set(key, row);
          }
        });

        const rows = Array.from(byType.values()).sort((a, b) => {
          const largeDiff = String(a.large_type || "").localeCompare(String(b.large_type || ""));
          if (largeDiff !== 0) return largeDiff;
          const middleDiff = String(a.middle_type || "").localeCompare(String(b.middle_type || ""));
          if (middleDiff !== 0) return middleDiff;
          const smallDiff = String(a.small_type || "").localeCompare(String(b.small_type || ""));
          if (smallDiff !== 0) return smallDiff;
          return String(a.doc_type).localeCompare(String(b.doc_type));
        });

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
