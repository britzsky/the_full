/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

// 🔹 레시피 관리 탭 - tb_recipe_video(유튜브 링크) / tb_recipe_image 데이터 훅
export default function useRecipeMediaData() {
  const [videoRows, setVideoRows] = useState([]); // 레시피 영상 목록
  const [imageRows, setImageRows] = useState([]); // 레시피 이미지 목록
  const [loading, setLoading] = useState(false); // 조회/처리 진행 여부

  // ===== 레시피 영상(유튜브 링크) =====

  // ✅ menu_id 기준 영상 목록 조회
  const fetchVideoList = useCallback(async (menuId) => {
    if (!menuId) {
      setVideoRows([]);
      return [];
    }
    try {
      const res = await api.get("/MenuRecipe/RecipeVideoList", { params: { menu_id: menuId } });
      const rows = Array.isArray(res.data) ? res.data : [];
      setVideoRows(rows);
      return rows;
    } catch (err) {
      console.error("데이터 조회 실패 (RecipeVideoList):", err);
      setVideoRows([]);
      return [];
    }
  }, []);

  // ✅ 영상 등록/수정 (payload: { video_id?, title, url, description, sort_order })
  const saveVideo = useCallback(async (menuId, payload) => {
    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/RecipeVideoSave", { menu_id: menuId, user_id, ...payload });
    const rows = Array.isArray(res.data) ? res.data : [];
    setVideoRows(rows);
    return rows;
  }, []);

  // ✅ 영상 삭제
  const deleteVideo = useCallback(async (videoId) => {
    await api.post("/MenuRecipe/RecipeVideoDelete", { video_id: videoId });
  }, []);

  // ===== 레시피 이미지 =====

  // ✅ menu_id 기준 이미지 목록 조회
  const fetchImageList = useCallback(async (menuId) => {
    if (!menuId) {
      setImageRows([]);
      return [];
    }
    try {
      const res = await api.get("/MenuRecipe/RecipeImageList", { params: { menu_id: menuId } });
      const rows = Array.isArray(res.data) ? res.data : [];
      setImageRows(rows);
      return rows;
    } catch (err) {
      console.error("데이터 조회 실패 (RecipeImageList):", err);
      setImageRows([]);
      return [];
    }
  }, []);

  // 공용 업로드 API(/Operate/OperateImgUpload)로 파일을 올린 뒤, 그 결과 경로를 tb_recipe_image에 메타정보로 저장한다.
  const uploadRecipeImage = useCallback(async (file, menuId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "menu");
    formData.append("gubun", menuId || "temp");
    formData.append("folder", "recipe");

    const uploadRes = await api.post("/Operate/OperateImgUpload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (uploadRes.data?.code !== 200) {
      throw new Error(uploadRes.data?.message || "이미지 업로드에 실패했습니다.");
    }

    const user_id = localStorage.getItem("user_id") || "";
    const res = await api.post("/MenuRecipe/RecipeImageSave", {
      menu_id: menuId,
      user_id,
      file_name: file.name,
      file_url: uploadRes.data.image_path,
      file_size: file.size,
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    setImageRows(rows);
    return rows;
  }, []);

  // ✅ 대표 이미지 지정
  const setImagePrimary = useCallback(async (menuId, imageId) => {
    const res = await api.post("/MenuRecipe/RecipeImageSetPrimary", { menu_id: menuId, image_id: imageId });
    return res.data;
  }, []);

  // ✅ 이미지 삭제
  const deleteImage = useCallback(async (imageId) => {
    await api.post("/MenuRecipe/RecipeImageDelete", { image_id: imageId });
  }, []);

  return {
    videoRows,
    imageRows,
    setVideoRows,
    setImageRows,
    loading,
    setLoading,
    fetchVideoList,
    saveVideo,
    deleteVideo,
    fetchImageList,
    uploadRecipeImage,
    setImagePrimary,
    deleteImage,
  };
}
