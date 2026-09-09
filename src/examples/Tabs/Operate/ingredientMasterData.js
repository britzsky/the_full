/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

// 🔹 tb_ingredient_master 코드값 (식재료 관리 탭 / 식재료 상세 다이얼로그 공용)

// 분류명(category_name) 고정 목록 — 가나다순, 지정된 순서 그대로 사용
export const INGREDIENT_CATEGORY_OPTIONS = [
  "가공식품",
  "가공육",
  "견과종실류",
  "곡류",
  "곡류가공품",
  "과일류",
  "근채류",
  "김치류",
  "나물류",
  "난류",
  "냉동식품",
  "두류",
  "면류",
  "버섯류",
  "서류",
  "소스류",
  "수산가공품",
  "수산물",
  "유제품",
  "유지류",
  "육류",
  "음료류",
  "장류",
  "젓갈류",
  "제과류",
  "조미료",
  "채소류",
  "해조가공품",
  "해조류",
  "향신료",
  "향신채",
];

// 보관방법 프리셋 — 목록에 없는 값은 "기타"로 직접 입력
export const STORAGE_TYPE_PRESETS = ["냉장", "냉동", "실온"];
export const OTHER_STORAGE_TYPE = "기타";

// 기준단위/발주단위 공통 프리셋 — 목록에 없는 단위는 "기타"로 직접 입력
export const UNIT_PRESETS = ["g", "mL", "EA", "팩"];
export const OTHER_UNIT = "기타";

// 단위의 대소문자 차이를 프리셋 표기로 통일한다. 예: ml, ML → mL / ea, Ea → EA
export const normalizeUnit = (value) => {
  const trimmedValue = typeof value === "string" ? value.trim() : value;
  if (!trimmedValue) return "";
  return (
    UNIT_PRESETS.find((unit) => unit.toLowerCase() === String(trimmedValue).toLowerCase()) ||
    trimmedValue
  );
};

// 🔹 식재료 관리 탭 - tb_ingredient_master 데이터 훅
export default function useIngredientMasterData() {
  const [ingredientRows, setIngredientRows] = useState([]); // 식재료 목록 (filter.pageSize를 넘기면 해당 페이지만)
  const [ingredientTotal, setIngredientTotal] = useState(0); // 검색 조건 기준 전체 건수 (페이지네이션 표시용)
  const [loading, setLoading] = useState(true); // 목록 조회 진행 여부

  // ✅ 식재료 목록 조회 (filter에 page/pageSize를 넘기면 서버에서 그 페이지만 잘라서 내려줌)
  const fetchIngredientList = useCallback(async (filter = {}) => {
    setLoading(true);
    try {
      const needsCount = filter.pageSize != null && filter.pageSize !== "";
      const [listRes, countRes] = await Promise.all([
        api.get("/MenuRecipe/IngredientList", { params: filter }),
        needsCount ? api.get("/MenuRecipe/IngredientListCount", { params: filter }) : Promise.resolve(null),
      ]);
      const rows = Array.isArray(listRes.data) ? listRes.data : [];
      setIngredientRows(rows);
      setIngredientTotal(needsCount ? Number(countRes?.data) || 0 : rows.length);
      return rows;
    } catch (err) {
      console.error("데이터 조회 실패 (IngredientList):", err);
      setIngredientRows([]);
      setIngredientTotal(0);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 식재료 신규 등록/수정 (ingredient_id 있으면 수정)
  const saveIngredient = useCallback(async (payload) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/IngredientSave", { ...payload, user_id });
    return res.data;
  }, []);

  // ✅ 식재료 삭제 (레시피에서 사용 중이면 서버에서 거부됨)
  const deleteIngredient = useCallback(async (ingredient_id) => {
    await api.post("/MenuRecipe/IngredientDelete", { ingredient_id });
  }, []);

  return {
    ingredientRows,
    setIngredientRows,
    ingredientTotal,
    loading,
    fetchIngredientList,
    saveIngredient,
    deleteIngredient,
  };
}
