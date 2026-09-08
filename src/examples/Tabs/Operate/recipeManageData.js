/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

// 🔹 레시피 관리 탭 - tb_recipe_info 데이터 훅
export default function useRecipeManageData() {
  const [recipeInfo, setRecipeInfo] = useState(null); // 조회된 레시피 정보
  const [loading, setLoading] = useState(false); // 조회 진행 여부

  // ✅ menu_id 기준 레시피 정보 조회
  const fetchRecipeInfo = useCallback(async (menuId) => {
    if (!menuId) {
      setRecipeInfo(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await api.get("/MenuRecipe/RecipeInfoGet", { params: { menu_id: menuId } });
      const data = res.data && Object.keys(res.data).length > 0 ? res.data : null;
      setRecipeInfo(data);
      return data;
    } catch (err) {
      console.error("데이터 조회 실패 (RecipeInfoGet):", err);
      setRecipeInfo(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 레시피 정보(제목/요약/조리순서/보관방법/알레르기) 저장
  const saveRecipeInfo = useCallback(async (menuId, payload) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/RecipeInfoSave", { menu_id: menuId, ...payload, user_id });
    setRecipeInfo(res.data);
    return res.data;
  }, []);

  return {
    recipeInfo,
    setRecipeInfo,
    loading,
    fetchRecipeInfo,
    saveRecipeInfo,
  };
}
