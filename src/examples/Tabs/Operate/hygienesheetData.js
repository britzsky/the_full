/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

// 앱 위생점검 기본 카테고리 (거래처 카테고리 설정이 저장되지 않았을 때 사용, 앱 initialCategories와 동일)
// description: 주요 확인내용, manage_point: 관리 포인트
const DEFAULT_HYGIENE_CATEGORIES = [
  ["preservedFood", "보존식", "보존식 라벨 / 중량 / 보관상태", "보존식 라벨 및 중량 확인"],
  ["fridge", "냉장고", "소분라벨 / 밀폐보관 / 계란보관 / 온도 / 청결", "냉장보관 및 표시사항 관리"],
  ["freezer", "냉동고", "성에 / 소분라벨 / 선입선출 / 온도 / 청결", "냉동보관·라벨·선입선출 관리"],
  ["storage", "창고·식재료 보관", "식자재·세제 혼재 / 바닥적재 / 구분보관", "식품·비식품류 분리 및 적정 적재"],
  ["crossContamination", "식재료 보관·교차오염", "밀폐보관 / 전처리 식재 / 교차오염", "밀폐 및 교차오염 예방"],
  ["labeling", "표시·소비기한", "소분·제조 라벨 / 소비기한 / 유통기한", "제품명·일자·소비기한 표시"],
  ["documents", "서류·법정서류", "보건증 / 면허증 / 위생서류 / 교육자료 / 점검표", "서류 비치 및 유효기간 관리"],
  ["personalHygiene", "개인위생", "위생모 / 마스크 / 장신구 / 손톱 등", "조리종사자 개인위생 준수"],
  ["equipment", "조리기구·시설", "조리도구 / 온도계 / 방충망 / 살균기 / 후드 등", "파손·노후·시설 상태 점검"],
  ["cleaning", "청소·정리정돈", "청소 / 세척 / 청결 / 먼지 / 곰팡이 등", "청소 및 정리정돈 상태 관리"],
  ["etc", "기타", "위 항목에 해당하지 않는 사항", "개별 확인 및 조치"],
].map(([category_key, category_name, description, manage_point]) => ({
  category_key,
  category_name,
  description,
  manage_point,
  use_yn: "Y",
  main_yn: "Y",
  status_yn: "Y",
}));

// 기본 카테고리 key → 기본 관리 포인트 (관리 포인트가 저장되지 않은 기본 카테고리에 사용, 앱과 동일)
const DEFAULT_MANAGE_POINTS = Object.fromEntries(
  DEFAULT_HYGIENE_CATEGORIES.map((c) => [c.category_key, c.manage_point])
);

// 위생관리 행 정렬 (등록일자 → 구분(카테고리 목록 순서, 구분 없음은 마지막) → 등록 순서)
const sortHygieneRows = (rows, categoryList) => {
  const categoryOrder = Object.fromEntries(
    (categoryList || []).map((c, index) => [c.category_key, index])
  );
  const orderOf = (row) => categoryOrder[row.category_key] ?? Number.MAX_SAFE_INTEGER;

  return [...rows].sort(
    (a, b) =>
      String(a.reg_dt || "").localeCompare(String(b.reg_dt || "")) ||
      orderOf(a) - orderOf(b) ||
      Number(a.idx || 0) - Number(b.idx || 0)
  );
};

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

export default function useHygienesheetData(year, month) {
  const [hygieneListRows, setHygieneListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);
  // 거래처 위생점검 카테고리 목록 (구분 컬럼·카테고리 필터용)
  const [categoryList, setCategoryList] = useState(DEFAULT_HYGIENE_CATEGORIES);

  // 거래처 위생점검 카테고리 조회 (저장된 설정이 없으면 기본 카테고리 사용)
  const fetchHygieneCategoryList = useCallback(async (account_id) => {
    if (!account_id) {
      setCategoryList(DEFAULT_HYGIENE_CATEGORIES);
      return;
    }

    try {
      const res = await api.get("/Operate/HygieneCategoryList", { params: { account_id } });
      const rows = (res.data || []).map((item) => ({
        category_key: item.category_key,
        category_name: item.category_name,
        // 상세 화면 안내 박스용 주요 확인내용·관리 포인트
        description: item.description || "",
        manage_point: item.manage_point || DEFAULT_MANAGE_POINTS[item.category_key] || "",
        // 사용 여부 (N이면 기록이 있을 때만 카드 표시)
        use_yn: item.use_yn,
        // 전체 요약 카드 표시 여부, 점검 상태 배지 표시 여부
        main_yn: item.main_yn,
        status_yn: item.status_yn,
      }));
      setCategoryList(rows.length > 0 ? rows : DEFAULT_HYGIENE_CATEGORIES);
    } catch (err) {
      console.error("위생점검 카테고리 조회 실패:", err);
      setCategoryList(DEFAULT_HYGIENE_CATEGORIES);
    }
  }, []);

  // 차량 정비 이력 조회
  const fetcHygieneList = useCallback(async (account_id, monthParam = month, yearParam = year) => {
    setLoading(true);
    try {
      const normalizedMonth =
        String(monthParam ?? "").trim() === "ALL"
          ? ""
          : String(monthParam ?? "")
              .trim()
              .padStart(2, "0");

      const res = await api.get("/Operate/HygieneList", {
        params: {
          account_id,
          year: yearParam,
          month: normalizedMonth,
        },
      });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        idx: item.idx,
        // 위생점검 카테고리 key (웹에서 등록한 기존 행은 빈 값)
        category_key: item.category_key || "",
        problem_image: item.problem_image,
        problem_note: item.problem_note || "",
        clean_image: item.clean_image,
        clean_note: item.clean_note || "",
        note: item.note || "",
        reg_dt: item.reg_dt,
        mod_dt: item.mod_dt,
        del_yn: item.del_yn,
      }));

      setHygieneListRows(rows.map((row) => ({ ...row })));
    } catch (err) {
      console.error("차량 정보 조회 실패:", err);
      setHygieneListRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

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

  return {
    hygieneListRows,
    setHygieneListRows,
    accountList,
    loading,
    fetcHygieneList,
    categoryList,
    fetchHygieneCategoryList,
  };
}

export { parseNumber, formatNumber, sortHygieneRows };
