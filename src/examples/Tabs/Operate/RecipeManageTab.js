/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, MenuItem, TextField } from "@mui/material";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useMenuMasterData, { FOOD_TYPE_OPTIONS, labelOf } from "./menuMasterData";
import useRecipeManageData from "./recipeManageData";
import IngredientDetailEditor from "./IngredientDetailEditor";
import RecipeMediaEditor from "./RecipeMediaEditor";

// 🔹 좌측 메뉴 목록 한 페이지에 보여줄 개수 선택지 (20단위로 100까지)
const MENU_PAGE_SIZE_OPTIONS = [20, 40, 60, 80, 100];
const DEFAULT_MENU_PAGE_SIZE = MENU_PAGE_SIZE_OPTIONS[0];

// 페이지 이동 바에서 쓰는 작은 드롭다운 보정
// (전역 테마가 .MuiSelect-select 패딩을 0으로 만들고 화살표를 숨겨서 여기서 다시 살린다)
const pageSizeSelectSx = {
  width: 92,
  "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
  "&& .MuiSelect-select": {
    fontSize: 12,
    padding: "5px 24px 5px 8px !important",
  },
  "& .MuiSelect-icon": { display: "inline-block", right: 2 },
};

// 🔹 레시피 콘텐츠 입력 폼 초기값
const emptyContent = {
  title: "",
  summary: "",
  servingsNote: "",
  stepsText: "",
  tipsText: "",
  storageText: "",
  allergensText: "",
};

// ✅ JSON 컬럼 <-> 화면 텍스트 변환
// JSON 배열 -> 줄바꿈 텍스트 변환 (조리순서/조리팁/알레르기 목록용)
const parseLines = (json) => {
  try {
    const arr = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(arr) ? arr.join("\n") : "";
  } catch {
    return "";
  }
};

// JSON 객체({ text }) -> 단일 텍스트 변환 (보관 방법용)
const parseText = (json) => {
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    return obj?.text ?? "";
  } catch {
    return "";
  }
};

// 줄바꿈 텍스트 -> JSON 배열 변환 (빈 줄 제거)
const linesToJson = (text) =>
  JSON.stringify(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

// 단일 텍스트 -> JSON 객체({ text }) 변환
const textToJson = (text) => JSON.stringify({ text: text || "" });

// 🔹 운영 > 메뉴/레시피 관리 > 레시피 관리 탭 (OperateTabs_7에서 사용)
export default function RecipeManageTab() {
  const { menuRows, menuTotal, loading: menuLoading, fetchMenuList } = useMenuMasterData();
  const { loading: recipeLoading, fetchRecipeInfo, saveRecipeInfo } = useRecipeManageData();

  const [keyword, setKeyword] = useState(""); // 메뉴명 검색어
  const [selectedMenu, setSelectedMenu] = useState(null); // 좌측 목록에서 선택한 메뉴
  const [content, setContent] = useState(emptyContent); // 레시피 콘텐츠 입력값
  const [saving, setSaving] = useState(false); // 레시피 저장 진행 여부
  const [recipeReady, setRecipeReady] = useState(false); // 선택 메뉴의 레시피 조회 완료 여부
  const [ingredientReady, setIngredientReady] = useState(false); // 선택 메뉴의 식재료 상세 최초 조회 완료 여부
  const [menuPage, setMenuPage] = useState(1); // 좌측 메뉴 목록 현재 페이지
  const [menuPageSize, setMenuPageSize] = useState(DEFAULT_MENU_PAGE_SIZE); // 한 페이지에 보여줄 개수
  const recipePanelRef = useRef(null); // 우측 레시피 편집 영역의 스크롤 위치를 관리하는 참조

  // 메뉴가 수천 건이라 전체를 한 번에 조회하면 느려서, 목록은 항상 서버에서 페이지 단위로만 받아온다.
  // 최초 진입 시 메뉴 목록 1페이지 조회
  useEffect(() => {
    fetchMenuList({ page: 1, pageSize: DEFAULT_MENU_PAGE_SIZE });
  }, [fetchMenuList]);

  // 전체 페이지 수 (서버가 내려준 검색 조건 기준 전체 건수로 계산)
  const menuTotalPages = Math.max(1, Math.ceil(menuTotal / menuPageSize));

  // 페이지 이동: 검색 조건/페이지당 개수는 유지한 채 해당 페이지만 다시 조회
  const goToMenuPage = (page) => {
    const target = Math.min(Math.max(1, page), menuTotalPages);
    setMenuPage(target);
    fetchMenuList({ keyword, page: target, pageSize: menuPageSize });
  };

  // 페이지당 개수 변경: 보던 위치가 어긋나므로 1페이지부터 다시 조회
  const handleChangePageSize = (size) => {
    setMenuPageSize(size);
    setMenuPage(1);
    fetchMenuList({ keyword, page: 1, pageSize: size });
  };

  // 선택 메뉴 변경 시 레시피 정보 조회 및 화면 텍스트 변환
  useEffect(() => {
    let active = true; // 언마운트/메뉴 재선택 시 이전 요청 결과 반영 방지

    if (!selectedMenu) {
      setContent(emptyContent);
      setRecipeReady(false);
      setIngredientReady(false);
      return undefined;
    }

    // 레시피 정보 조회 후 JSON 컬럼을 화면 텍스트로 변환
    const loadRecipe = async () => {
      setRecipeReady(false);
      const nextRecipeInfo = await fetchRecipeInfo(selectedMenu.menu_id);
      if (!active) return;

      setContent(
        nextRecipeInfo
          ? {
              title: nextRecipeInfo.title || "",
              summary: nextRecipeInfo.summary || "",
              servingsNote: nextRecipeInfo.servings_note || "",
              stepsText: parseLines(nextRecipeInfo.steps_json),
              tipsText: parseLines(nextRecipeInfo.tips_json),
              storageText: parseText(nextRecipeInfo.storage_json),
              allergensText: parseLines(nextRecipeInfo.allergens_json),
            }
          : emptyContent
      );
      setRecipeReady(true);
    };

    loadRecipe();
    return () => {
      active = false;
    };
  }, [selectedMenu, fetchRecipeInfo]);

  // 메뉴명 검색 처리
  const handleSearch = () => {
    setMenuPage(1);
    fetchMenuList({ keyword, page: 1, pageSize: menuPageSize });
  };

  // 레시피 콘텐츠 필드 값 변경 처리
  const handleContentChange = (field, value) => setContent((prev) => ({ ...prev, [field]: value }));

  // 메뉴 선택 처리: 선택한 메뉴의 레시피 조회가 끝난 뒤 편집 영역을 표시한다.
  const handleSelectMenu = (row) => {
    if (recipePanelRef.current) recipePanelRef.current.scrollTop = 0;
    setRecipeReady(false);
    setIngredientReady(false);
    setSelectedMenu(row);
  };

  // 식재료 상세 최초 조회 완료 처리
  const handleIngredientInitialLoadComplete = useCallback(() => {
    setIngredientReady(true);
  }, []);

  // 레시피 정보 저장 처리
  const handleSave = async () => {
    if (!selectedMenu) return;
    setSaving(true);
    try {
      await saveRecipeInfo(selectedMenu.menu_id, {
        title: content.title || selectedMenu.menu_name,
        summary: content.summary,
        servings_note: content.servingsNote,
        steps_json: linesToJson(content.stepsText),
        tips_json: linesToJson(content.tipsText),
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

  // 메뉴/레시피/식재료 로딩 상태 통합 (메뉴 선택 시 레시피·식재료 조회가 끝나야 로딩 해제)
  const isLoading =
    menuLoading ||
    recipeLoading ||
    (!!selectedMenu && (!recipeReady || !ingredientReady));

  return (
    // 최상위 wrapper: 좌측 메뉴 검색/목록 패널 + 우측 레시피 편집 패널 (가로 배치) + 전체 로딩 오버레이
    <Box sx={{ position: "relative", display: "flex", gap: 2, height: "100%", minHeight: 0 }}>
      {/* 좌측 패널: 메뉴 검색/목록 */}
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
        {/* 검색 입력창 + 검색 버튼 */}
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
        {/* 스크롤 가능한 메뉴 목록 영역 */}
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {/* 검색 결과가 없을 때 보여줄 안내 문구 */}
          {!menuLoading && menuRows.length === 0 && (
            <MDBox sx={{ p: 2, color: "#999", fontSize: 13 }}>등록된 메뉴가 없습니다.</MDBox>
          )}
          {/* 메뉴 목록 행: 클릭 시 해당 메뉴의 레시피를 우측 패널에 표시 (서버에서 이미 페이지 적용된 목록) */}
          {!menuLoading &&
            menuRows.map((row) => (
              <Box
                key={row.menu_id}
                onClick={() => handleSelectMenu(row)}
                sx={{
                  p: 1.2,
                  cursor: "pointer",
                  borderBottom: "1px solid #f2f2f2",
                  backgroundColor: selectedMenu?.menu_id === row.menu_id ? "#f0f7ff" : "transparent",
                  "&:hover": { backgroundColor: "#f7f7f7" },
                }}
              >
                {/* 메뉴명 + 메뉴 ID */}
                <MDBox sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <MDBox sx={{ fontSize: 13, fontWeight: "bold" }}>{row.menu_name}</MDBox>
                  <MDBox sx={{ fontSize: 10, color: "#bbb" }}>{row.menu_id}</MDBox>
                </MDBox>
                {/* 식사분류 라벨 */}
                <MDBox sx={{ fontSize: 11, color: "#888" }}>{labelOf(FOOD_TYPE_OPTIONS, row.food_type)}</MDBox>
              </Box>
            ))}
        </Box>

        {/* 페이지 이동 바: 처음/이전/현재-전체 페이지수/다음/마지막 + 총 건수/페이지당 개수 (메뉴가 있을 때만 표시) */}
        {!menuLoading && menuTotal > 0 && (
          <Box sx={{ borderTop: "1px solid #eee", p: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
            {/* 1행: 처음/이전/현재-전체 페이지수/다음/마지막 (패널 폭이 좁아 버튼 줄을 따로 둠) */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              {/* 처음 페이지로 이동 */}
              <MDButton
                size="small"
                variant="outlined"
                color="info"
                disabled={menuPage === 1}
                onClick={() => goToMenuPage(1)}
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              >
                처음
              </MDButton>
              {/* 이전 페이지로 이동 */}
              <MDButton
                size="small"
                variant="outlined"
                color="info"
                disabled={menuPage === 1}
                onClick={() => goToMenuPage(menuPage - 1)}
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              >
                이전
              </MDButton>
              {/* 현재 페이지 / 전체 페이지 수 */}
              <Box
                sx={{
                  minWidth: 52,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #eee",
                  borderRadius: 999,
                  px: 1,
                  py: 0.4,
                }}
              >
                {menuPage} / {menuTotalPages}
              </Box>
              {/* 다음 페이지로 이동 */}
              <MDButton
                size="small"
                variant="outlined"
                color="info"
                disabled={menuPage === menuTotalPages}
                onClick={() => goToMenuPage(menuPage + 1)}
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              >
                다음
              </MDButton>
              {/* 마지막 페이지로 이동 */}
              <MDButton
                size="small"
                variant="outlined"
                color="info"
                disabled={menuPage === menuTotalPages}
                onClick={() => goToMenuPage(menuTotalPages)}
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              >
                마지막
              </MDButton>
            </Box>

            {/* 2행: 좌측 총 건수 / 우측 페이지당 개수 선택 (20단위로 100까지) */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ fontSize: 11, color: "#94a3b8" }}>총 {menuTotal}건</Box>
              <TextField
                select
                size="small"
                sx={pageSizeSelectSx}
                value={menuPageSize}
                onChange={(e) => handleChangePageSize(Number(e.target.value))}
              >
                {MENU_PAGE_SIZE_OPTIONS.map((size) => (
                  <MenuItem key={size} value={size} sx={{ fontSize: 12 }}>
                    {size}개씩
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        )}
      </MDBox>

      {/* 우측 패널: 선택된 메뉴의 레시피 콘텐츠 입력 폼 + 식재료 상세 + 레시피 영상/이미지 */}
      <MDBox ref={recipePanelRef} sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {!selectedMenu ? (
          // 메뉴 미선택 시 안내 문구
          <MDBox sx={{ p: 2, color: "#999" }}>좌측 목록에서 메뉴를 선택해주세요.</MDBox>
        ) : !recipeReady ? null : (
          <>
            {/* 선택된 메뉴명 + "레시피 저장" 버튼 */}
            <MDBox sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <MDBox sx={{ fontSize: 15, fontWeight: "bold" }}>{selectedMenu.menu_name}</MDBox>
              <MDButton size="small" variant="contained" color="info" onClick={handleSave} disabled={saving || recipeLoading}>
                {saving ? "저장 중..." : "레시피 저장"}
              </MDButton>
            </MDBox>

            {/* 레시피 콘텐츠 입력 필드 묶음 + 식재료 상세 + 영상/이미지 편집기 */}
            <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* 레시피 제목 입력 */}
              <TextField
                label="레시피 제목"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={content.title}
                onChange={(e) => handleContentChange("title", e.target.value)}
              />
              {/* 요약 입력 */}
              <TextField
                label="요약"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.summary}
                onChange={(e) => handleContentChange("summary", e.target.value)}
              />
              {/* 조리 순서 입력 (줄바꿈 = 단계 구분, 저장 시 JSON 배열로 변환) */}
              <TextField
                label="조리 순서 (한 줄에 한 단계씩)"
                size="small"
                multiline
                minRows={4}
                InputLabelProps={{ shrink: true }}
                value={content.stepsText}
                onChange={(e) => handleContentChange("stepsText", e.target.value)}
              />
              {/* 조리 팁은 일단 화면에서 숨김 (tips_json은 DB에 그대로 유지) */}
              {/* 보관 방법 입력 (저장 시 { text } 형태 JSON으로 변환) */}
              <TextField
                label="보관 방법"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.storageText}
                onChange={(e) => handleContentChange("storageText", e.target.value)}
              />
              {/* 알레르기 정보 입력 (줄바꿈 = 항목 구분, 저장 시 JSON 배열로 변환) */}
              <TextField
                label="알레르기 정보 (한 줄에 한 항목씩)"
                size="small"
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
                value={content.allergensText}
                onChange={(e) => handleContentChange("allergensText", e.target.value)}
              />
              {/* 비고 입력 (구 인분 관련 비고) */}
              <TextField
                label="비고"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={content.servingsNote}
                onChange={(e) => handleContentChange("servingsNote", e.target.value)}
              />

              {/* 식재료 상세 편집 컴포넌트 (menu_id 기준 tb_recipe_detail 관리) */}
              <IngredientDetailEditor
                menuId={selectedMenu.menu_id}
                onInitialLoadComplete={handleIngredientInitialLoadComplete}
              />

              {/* 레시피 영상(유튜브 링크)/이미지 편집 컴포넌트 */}
              <RecipeMediaEditor menuId={selectedMenu.menu_id} />
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
