/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

// 🔹 tb_menu_master 코드값 (메뉴 관리 / 레시피 관리 탭 공용)
export const FOOD_TYPE_OPTIONS = [
  { value: 1, label: "한식" },
  { value: 2, label: "중식" },
  { value: 3, label: "일식" },
  { value: 4, label: "분식" },
  { value: 5, label: "간식" },
  { value: 6, label: "기타" },
];

export const MENU_TYPE_OPTIONS = [
  { value: 0, label: "주메뉴" },
  { value: 1, label: "부메뉴" },
  { value: 2, label: "후식/간식" },
  { value: 3, label: "음료" },
  { value: 4, label: "기타" },
];

export const MENU_GUBUN_OPTIONS = [
  { value: 1, label: "밥류/덮밥" },
  { value: 2, label: "탕/찌개/국" },
  { value: 3, label: "무침/생채/겉절이" },
  { value: 4, label: "튀김/까스/강정" },
  { value: 5, label: "구이스테이크" },
  { value: 6, label: "찜/수육" },
  { value: 7, label: "전/계란/부침" },
  { value: 8, label: "면류" },
  { value: 9, label: "조림" },
  { value: 10, label: "볶음" },
  { value: 11, label: "나물" },
  { value: 12, label: "샐러드" },
  { value: 13, label: "분식/간식" },
  { value: 14, label: "후식/간식" },
  { value: 15, label: "절임/피클" },
  { value: 16, label: "소스/드레싱" },
  { value: 17, label: "음료" },
  { value: 18, label: "기타 부찬" },
  { value: 19, label: "기타" },
];

export const MEAL_PLAN_TYPE_OPTIONS = [
  { value: 0, label: "일반식" },
  { value: 1, label: "가성비식단" },
  { value: 2, label: "요양원맞춤식단" },
  { value: 3, label: "테마식단" },
  { value: 4, label: "다이어트식단" },
  { value: 5, label: "프리미엄식단" },
];

export const labelOf = (options, value) =>
  options.find((o) => String(o.value) === String(value))?.label ?? "";

// 🔹 메뉴 관리 탭 - tb_menu_master 데이터 훅
export default function useMenuMasterData() {
  const [menuRows, setMenuRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ 메뉴 목록 조회
  const fetchMenuList = useCallback(async (filter = {}) => {
    setLoading(true);
    try {
      const res = await api.get("/operate/menulist", { params: filter });
      const rows = Array.isArray(res.data) ? res.data : [];
      setMenuRows(rows);
      return rows;
    } catch (err) {
      console.error("데이터 조회 실패 (MenuList):", err);
      setMenuRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 메뉴 신규 등록/수정 (menu_id 있으면 수정)
  const saveMenu = useCallback(async (payload) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/MenuSave", { ...payload, user_id });
    return res.data;
  }, []);

  // ✅ 메뉴 논리 삭제
  const deleteMenu = useCallback(async (menu_id) => {
    const user_id = localStorage.getItem("user_id") || "";
    await api.post("/MenuRecipe/MenuDelete", { menu_id, user_id });
  }, []);

  // ✅ 메뉴 이미지 업로드 (기존 공용 S3 업로드 엔드포인트 재사용)
  const uploadMenuImage = useCallback(async (file, menuId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "menu");
    formData.append("gubun", menuId || "temp");
    formData.append("folder", "master");

    const res = await api.post("/Operate/OperateImgUpload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (res.data?.code === 200) return res.data.image_path;
    throw new Error(res.data?.message || "이미지 업로드에 실패했습니다.");
  }, []);

  return {
    menuRows,
    setMenuRows,
    loading,
    fetchMenuList,
    saveMenu,
    deleteMenu,
    uploadMenuImage,
  };
}
