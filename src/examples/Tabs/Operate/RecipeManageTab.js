/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import { Box, TextField } from "@mui/material";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useMenuMasterData, { FOOD_TYPE_OPTIONS, labelOf } from "./menuMasterData";
import useRecipeManageData from "./recipeManageData";
import IngredientDetailEditor from "./IngredientDetailEditor";

const emptyContent = {
  title: "",
  summary: "",
  stepsText: "",
  storageText: "",
  allergensText: "",
};

// ✅ JSON 컬럼 <-> 화면 텍스트 변환
const parseLines = (json) => {
  try {
    const arr = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(arr) ? arr.join("\n") : "";
  } catch {
    return "";
  }
};

const parseText = (json) => {
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    return obj?.text ?? "";
  } catch {
    return "";
  }
};

const linesToJson = (text) =>
  JSON.stringify(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

const textToJson = (text) => JSON.stringify({ text: text || "" });

// 🔹 운영 > 메뉴/레시피 관리 > 레시피 관리 탭 (OperateTabs_7에서 사용)
export default function RecipeManageTab() {
  const { menuRows, loading: menuLoading, fetchMenuList } = useMenuMasterData();
  const { recipeInfo, loading: recipeLoading, fetchRecipeInfo, saveRecipeInfo } = useRecipeManageData();

  const [keyword, setKeyword] = useState("");
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [content, setContent] = useState(emptyContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMenuList();
  }, [fetchMenuList]);

  useEffect(() => {
    if (!selectedMenu) {
      setContent(emptyContent);
      return;
    }
    fetchRecipeInfo(selectedMenu.menu_id);
  }, [selectedMenu, fetchRecipeInfo]);

  useEffect(() => {
    if (!recipeInfo) {
      setContent(emptyContent);
      return;
    }
    setContent({
      title: recipeInfo.title || "",
      summary: recipeInfo.summary || "",
      stepsText: parseLines(recipeInfo.steps_json),
      storageText: parseText(recipeInfo.storage_json),
      allergensText: parseLines(recipeInfo.allergens_json),
    });
  }, [recipeInfo]);

  const handleSearch = () => fetchMenuList({ keyword });

  const handleContentChange = (field, value) => setContent((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!selectedMenu) return;
    setSaving(true);
    try {
      await saveRecipeInfo(selectedMenu.menu_id, {
        title: content.title || selectedMenu.menu_name,
        summary: content.summary,
        steps_json: linesToJson(content.stepsText),
        storage_json: textToJson(content.storageText),
        allergens_json: linesToJson(content.allergensText),
      });
      Swal.fire("저장되었습니다.", "", "success");
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = menuLoading || recipeLoading;

  return (
    <Box sx={{ position: "relative", display: "flex", gap: 2, height: "100%", minHeight: 0 }}>
      {/* 좌측: 메뉴 검색/목록 */}
      <MDBox
        sx={{
          width: 280,
          flexShrink: 0,
          border: "1px solid #eee",
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 1, display: "flex", gap: 1, borderBottom: "1px solid #eee" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="메뉴명 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <MDButton size="small" variant="outlined" color="info" onClick={handleSearch}>
            검색
          </MDButton>
        </Box>
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {!menuLoading && menuRows.length === 0 && (
            <MDBox sx={{ p: 2, color: "#999", fontSize: 13 }}>등록된 메뉴가 없습니다.</MDBox>
          )}
          {!menuLoading &&
            menuRows.map((row) => (
              <Box
                key={row.menu_id}
                onClick={() => setSelectedMenu(row)}
                sx={{
                  p: 1.2,
                  cursor: "pointer",
                  borderBottom: "1px solid #f2f2f2",
                  backgroundColor: selectedMenu?.menu_id === row.menu_id ? "#f0f7ff" : "transparent",
                  "&:hover": { backgroundColor: "#f7f7f7" },
                }}
              >
                <MDBox sx={{ fontSize: 13, fontWeight: "bold" }}>{row.menu_name}</MDBox>
                <MDBox sx={{ fontSize: 11, color: "#888" }}>{labelOf(FOOD_TYPE_OPTIONS, row.food_type)}</MDBox>
              </Box>
            ))}
        </Box>
      </MDBox>

      {/* 우측: 선택된 메뉴의 레시피 콘텐츠 + 식재료 */}
      <MDBox sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {!selectedMenu ? (
          <MDBox sx={{ p: 2, color: "#999" }}>좌측 목록에서 메뉴를 선택해주세요.</MDBox>
        ) : (
          <>
            <MDBox sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <MDBox sx={{ fontSize: 15, fontWeight: "bold" }}>{selectedMenu.menu_name}</MDBox>
              <MDButton size="small" variant="contained" color="info" onClick={handleSave} disabled={saving || recipeLoading}>
                {saving ? "저장 중..." : "레시피 저장"}
              </MDButton>
            </MDBox>

            <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="레시피 제목"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={content.title}
                onChange={(e) => handleContentChange("title", e.target.value)}
              />
              <TextField
                label="요약"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.summary}
                onChange={(e) => handleContentChange("summary", e.target.value)}
              />
              <TextField
                label="조리 순서 (한 줄에 한 단계씩)"
                size="small"
                multiline
                minRows={4}
                InputLabelProps={{ shrink: true }}
                value={content.stepsText}
                onChange={(e) => handleContentChange("stepsText", e.target.value)}
              />
              <TextField
                label="보관 방법"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.storageText}
                onChange={(e) => handleContentChange("storageText", e.target.value)}
              />
              <TextField
                label="알레르기 정보 (한 줄에 한 항목씩)"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.allergensText}
                onChange={(e) => handleContentChange("allergensText", e.target.value)}
              />

              <IngredientDetailEditor menuId={selectedMenu.menu_id} />
            </MDBox>
          </>
        )}
      </MDBox>

      {/* 🔹 로딩은 좌/우 패널마다 따로가 아니라 탭 전체에 한 번만 덮어서 표시 */}
      {isLoading && (
        <MDBox
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            "& .loading-container": { height: "100%" },
          }}
        >
          <LoadingScreen />
        </MDBox>
      )}
    </Box>
  );
}
