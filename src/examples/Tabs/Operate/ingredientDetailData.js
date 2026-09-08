/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

// 🔹 메뉴 관리 / 레시피 관리 탭이 공유하는 "식재료 상세(tb_recipe_detail)" 데이터 훅
export default function useIngredientDetailData() {
  const [detailRows, setDetailRows] = useState([]); // 식재료 상세 목록
  const [loading, setLoading] = useState(false); // 목록 조회 진행 여부

  // ✅ menu_id 기준 식재료 상세 목록 조회
  const fetchRecipeDetailList = useCallback(async (menuId) => {
    if (!menuId) {
      setDetailRows([]);
      return [];
    }
    setLoading(true);
    try {
      const res = await api.get("/MenuRecipe/RecipeDetailList", {
        params: { menu_id: menuId },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setDetailRows(rows);
      return rows;
    } catch (err) {
      console.error("데이터 조회 실패 (RecipeDetailList):", err);
      setDetailRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 한 메뉴의 식재료 상세 행 배열을 통째로 upsert
  const saveRecipeDetailRows = useCallback(async (menuId, rows) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/RecipeDetailSave", {
      menu_id: menuId,
      user_id,
      rows,
    });
    const nextRows = Array.isArray(res.data) ? res.data : [];
    setDetailRows(nextRows);
    return nextRows;
  }, []);

  // ✅ 식재료 상세 행 1개 삭제
  const deleteRecipeDetailRow = useCallback(async (recipeDetailId) => {
    await api.post("/MenuRecipe/RecipeDetailDelete", {
      recipe_detail_id: recipeDetailId,
    });
  }, []);

  // ✅ 식재료 마스터 자동완성 검색
  const searchIngredients = useCallback(async (keyword) => {
    if (!keyword || !keyword.trim()) return [];
    try {
      const res = await api.get("/MenuRecipe/IngredientSearchList", {
        params: { keyword },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error("데이터 조회 실패 (IngredientSearchList):", err);
      return [];
    }
  }, []);

  // ✅ 목록에 없는 식재료를 이 자리에서 즉석 등록
  const quickCreateIngredient = useCallback(async ({ ingredient_name_std, base_unit }) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/IngredientQuickSave", {
      ingredient_name_std,
      base_unit,
      user_id,
    });
    return res.data;
  }, []);

  // ✅ 식재료 단건 상세 조회 (분류/보관방법/안전재고 등 tb_ingredient_master 전체 필드)
  const getIngredient = useCallback(async (ingredientId) => {
    if (!ingredientId) return null;
    const res = await api.get("/MenuRecipe/IngredientGet", {
      params: { ingredient_id: ingredientId },
    });
    return res.data && Object.keys(res.data).length > 0 ? res.data : null;
  }, []);

  // ✅ 식재료 상세정보 수정
  const updateIngredient = useCallback(async (payload) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/IngredientUpdate", { ...payload, user_id });
    return res.data;
  }, []);

  return {
    detailRows,
    setDetailRows,
    loading,
    fetchRecipeDetailList,
    saveRecipeDetailRows,
    deleteRecipeDetailRow,
    searchIngredients,
    quickCreateIngredient,
    getIngredient,
    updateIngredient,
  };
}
