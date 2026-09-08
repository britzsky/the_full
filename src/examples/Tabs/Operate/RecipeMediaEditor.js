/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Box, IconButton, TextField, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { API_BASE_URL } from "config";
import useRecipeMediaData from "./recipeMediaData";

// 🔹 영상 등록 폼 초기값
const emptyVideoForm = { title: "", url: "", description: "" };

// 유튜브 URL(watch/youtu.be/shorts/embed 형태 모두)에서 영상 ID만 뽑아낸다. 못 알아보면 null.
const extractYoutubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// 🔹 메뉴/레시피 관리 탭이 공유하는 "레시피 영상(유튜브 링크) + 레시피 이미지" 편집 컴포넌트
export default function RecipeMediaEditor({ menuId }) {
  const {
    videoRows,
    imageRows,
    fetchVideoList,
    saveVideo,
    deleteVideo,
    fetchImageList,
    uploadRecipeImage,
    setImagePrimary,
    deleteImage,
  } = useRecipeMediaData();

  const [videoForm, setVideoForm] = useState(emptyVideoForm); // 영상 등록 입력값
  const [videoSaving, setVideoSaving] = useState(false); // 영상 등록 진행 여부
  const [imageUploading, setImageUploading] = useState(false); // 이미지 업로드 진행 여부

  // ✅ 영상/이미지 목록 동시 조회
  const loadAll = useCallback(() => {
    if (!menuId) return;
    fetchVideoList(menuId);
    fetchImageList(menuId);
  }, [menuId, fetchVideoList, fetchImageList]);

  // menuId 변경 시 영상/이미지 목록 초기 로드
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ✅ 영상 등록 처리
  const handleAddVideo = async () => {
    if (!videoForm.url.trim()) {
      Swal.fire("영상 URL을 입력해주세요.", "", "warning");
      return;
    }
    setVideoSaving(true);
    try {
      await saveVideo(menuId, {
        title: videoForm.title.trim() || "제목 없음",
        url: videoForm.url.trim(),
        description: videoForm.description.trim(),
      });
      setVideoForm(emptyVideoForm);
    } catch (err) {
      Swal.fire("영상 등록 실패", err.message, "error");
    } finally {
      setVideoSaving(false);
    }
  };

  // ✅ 영상 삭제 확인 및 처리
  const handleDeleteVideo = async (videoId) => {
    const confirm = await Swal.fire({
      title: "이 영상을 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteVideo(videoId);
      fetchVideoList(menuId);
    } catch (err) {
      Swal.fire("삭제 실패", err.message, "error");
    }
  };

  // ✅ 이미지 업로드 처리 (다중 파일 순차 업로드)
  const handleUploadImages = async (files) => {
    if (!files || files.length === 0) return;
    setImageUploading(true);
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const file of Array.from(files)) {
        // 파일별 순차 업로드 (동시 업로드 시 서버 처리 순서 보장 안 됨)
        // eslint-disable-next-line no-await-in-loop
        await uploadRecipeImage(file, menuId);
      }
    } catch (err) {
      Swal.fire("이미지 업로드 실패", err.message, "error");
    } finally {
      setImageUploading(false);
    }
  };

  // ✅ 대표 이미지 지정 처리
  const handleSetPrimary = async (imageId) => {
    try {
      await setImagePrimary(menuId, imageId);
      fetchImageList(menuId);
    } catch (err) {
      Swal.fire("대표 이미지 지정 실패", err.message, "error");
    }
  };

  // ✅ 이미지 삭제 확인 및 처리
  const handleDeleteImage = async (imageId) => {
    const confirm = await Swal.fire({
      title: "이 이미지를 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteImage(imageId);
      fetchImageList(menuId);
    } catch (err) {
      Swal.fire("삭제 실패", err.message, "error");
    }
  };

  // 메뉴가 선택되지 않으면 아무것도 표시하지 않음
  if (!menuId) return null;

  return (
    // 최상위 wrapper: 레시피 영상 영역 + 레시피 이미지 영역 (세로 배치)
    <MDBox sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* 레시피 영상(유튜브 링크) 영역 */}
      <MDBox>
        <MDBox sx={{ fontWeight: "bold", fontSize: 13, mb: 1 }}>🎬 레시피 영상 (유튜브 링크)</MDBox>
        {/* 영상 등록 입력줄: URL/제목 입력 + 추가 버튼 */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="유튜브 URL"
            sx={{ minWidth: 240, flex: 1 }}
            value={videoForm.url}
            onChange={(e) => setVideoForm((prev) => ({ ...prev, url: e.target.value }))}
          />
          <TextField
            size="small"
            placeholder="제목(선택)"
            sx={{ minWidth: 160 }}
            value={videoForm.title}
            onChange={(e) => setVideoForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <MDButton
            size="small"
            variant="outlined"
            color="info"
            startIcon={<AddIcon />}
            onClick={handleAddVideo}
            disabled={videoSaving}
          >
            영상 추가
          </MDButton>
        </Box>

        {/* 등록된 영상이 없으면 안내 문구, 있으면 영상 카드 목록 */}
        {videoRows.length === 0 ? (
          <MDBox sx={{ color: "#999", fontSize: 13 }}>등록된 영상이 없습니다.</MDBox>
        ) : (
          // 영상 카드를 가로로 나열하는 그룹 Box
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {videoRows.map((video) => {
              // 유튜브 ID 추출 성공 시 임베드 미리보기, 실패 시 링크 텍스트만 표시
              const youtubeId = extractYoutubeId(video.url);
              return (
                // 영상 카드 하나: 임베드/링크 영역 + 제목/삭제 버튼 영역
                <Box
                  key={video.video_id}
                  sx={{
                    width: 260,
                    border: "1px solid #e2e8f0",
                    borderRadius: 2,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  {youtubeId ? (
                    // 유튜브 ID를 알아낸 경우: 16:9 비율 임베드 플레이어
                    <Box sx={{ position: "relative", pt: "56.25%" }}>
                      <iframe
                        title={video.title || video.url}
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          border: 0,
                        }}
                        allowFullScreen
                      />
                    </Box>
                  ) : (
                    // 유튜브 ID를 알아내지 못한 경우: 원본 링크 텍스트만 표시
                    <Box
                      sx={{
                        p: 2,
                        fontSize: 12,
                        color: "#999",
                        wordBreak: "break-all",
                      }}
                    >
                      미리보기를 지원하지 않는 링크입니다. ({video.url})
                    </Box>
                  )}
                  {/* 영상 제목 + 삭제 버튼 */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1,
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {video.title}
                    </Box>
                    <IconButton size="small" color="error" onClick={() => handleDeleteVideo(video.video_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </MDBox>

      {/* 레시피 이미지 영역 */}
      <MDBox>
        {/* 제목 + 이미지 추가 버튼 */}
        <MDBox sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <MDBox sx={{ fontWeight: "bold", fontSize: 13 }}>🖼️ 레시피 이미지</MDBox>
          {/* 이미지 추가 버튼 (숨김 다중 파일 input을 감싸는 label) */}
          <MDButton
            size="small"
            variant="outlined"
            color="info"
            component="label"
            startIcon={<PhotoCameraIcon />}
            disabled={imageUploading}
          >
            {imageUploading ? "업로드 중..." : "이미지 추가"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                handleUploadImages(e.target.files);
                e.target.value = "";
              }}
            />
          </MDButton>
        </MDBox>

        {/* 등록된 이미지가 없으면 안내 문구, 있으면 썸네일 목록 */}
        {imageRows.length === 0 ? (
          <MDBox sx={{ color: "#999", fontSize: 13 }}>등록된 이미지가 없습니다.</MDBox>
        ) : (
          // 이미지 썸네일을 가로로 나열하는 그룹 Box
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {imageRows.map((image) => (
              // 이미지 썸네일 카드 하나: 대표 이미지는 주황 테두리로 강조
              <Box
                key={image.image_id}
                sx={{
                  position: "relative",
                  width: 140,
                  height: 140,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: image.is_primary === "Y" ? "2px solid #ff9800" : "1px solid #e2e8f0",
                }}
              >
                <Box
                  component="img"
                  src={`${API_BASE_URL}${image.file_url}`}
                  alt={image.file_name}
                  sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* 우측 상단에 겹쳐 표시되는 대표 지정/삭제 버튼 그룹 */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    display: "flex",
                    gap: 0.25,
                    backgroundColor: "rgba(255,255,255,0.85)",
                    borderRadius: 1,
                  }}
                >
                  {/* 대표 이미지 지정/해제 버튼 (별 아이콘 채움 여부로 대표 여부 표시) */}
                  <Tooltip title={image.is_primary === "Y" ? "대표 이미지" : "대표 이미지로 지정"}>
                    <IconButton size="small" onClick={() => handleSetPrimary(image.image_id)}>
                      {image.is_primary === "Y" ? (
                        <StarIcon fontSize="small" sx={{ color: "#ff9800" }} />
                      ) : (
                        <StarBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  {/* 이미지 삭제 버튼 */}
                  <IconButton size="small" color="error" onClick={() => handleDeleteImage(image.image_id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </MDBox>
    </MDBox>
  );
}

RecipeMediaEditor.propTypes = {
  menuId: PropTypes.string,
};

RecipeMediaEditor.defaultProps = {
  menuId: null,
};
