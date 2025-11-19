/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import {
  Grid,
  Box,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogContent,
} from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import { Download, Trash2, Image as ImageIcon, Plus, RotateCcw } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import useAccountEventData from "./accountEventData";

export default function AccountEventTab() {
  const {
    accountList,
    eventRows,
    setEventRows,
    loading,
    setLoading,
    fetchAccountList,
    fetchEventList,
    originalEventRows,
    setOriginalEventRows,
  } = useAccountEventData();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewList, setPreviewList] = useState([]);   // 이미지 리스트
  const [currentIndex, setCurrentIndex] = useState(0);  // 현재 인덱스

  // ================================
  // 초기 로드
  // ================================
  useEffect(() => {
    fetchAccountList();
  }, []);

  // ================================
  // 거래처 선택 시 행사 조회
  // ================================
  useEffect(() => {
    if (selectedAccountId) {
      setLoading(true);
      fetchEventList(selectedAccountId)
        .then((rows) => {
          const updated = rows.map((r) => ({
            ...r,
            pendingFiles: [],
            deletedImages: [],
          }));
          setEventRows(updated);
          setOriginalEventRows(JSON.parse(JSON.stringify(updated)));
        })
        .finally(() => setLoading(false));
    } else {
      setEventRows([]);
      setOriginalEventRows([]);
    }
  }, [selectedAccountId]);

  // ================================
  // 변경 여부 판단 (빨간 글씨)
  // ================================
  const isCellChanged = (rowIndex, key) => {
    const row = eventRows[rowIndex];
    const origin = originalEventRows[rowIndex];

    // 신규행은 항상 변경 상태
    if (!row.event_id) return true;

    if (!origin) return false;
    return row[key] !== origin[key];
  };

  // ================================
  // 날짜 포맷
  // ================================
  const formatDateForInput = (val) => {
    if (!val && val !== 0) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    try {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  // ================================
  // 신규행 추가
  // ================================
  const handleAddEventRow = () => {
    if (!selectedAccountId) {
      Swal.fire("거래처를 먼저 선택하세요.", "", "info");
      return;
    }

    const newRow = {
      account_id: selectedAccountId,
      event_id: null,
      event_name: "",
      event_dt: "",
      images: [],
      pendingFiles: [],
      deletedImages: [],
    };

    setEventRows((prev) => [...prev, newRow]);
    setOriginalEventRows((prev) => [...prev, { ...newRow }]);
  };

  // ================================
  // 입력 변경
  // ================================
  const handleEventFieldChange = (index, field, value) => {
    setEventRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  // ================================
  // 파일 선택 시 → pendingFiles에 저장 (업로드 X)
  // 썸네일용 previewUrl 같이 저장
  // ================================
  const handleFileSelect = (rowIndex, fileList) => {
    if (!fileList || fileList.length === 0) return;

    const targetRow = eventRows[rowIndex];
    const currentCount =
      (targetRow.images?.length || 0) + (targetRow.pendingFiles?.length || 0);

    if (currentCount >= 10) {
      Swal.fire("이미지는 최대 10장까지 등록 가능합니다.", "", "warning");
      return;
    }

    let files = Array.from(fileList);
    const available = 10 - currentCount;

    if (files.length > available) {
      files = files.slice(0, available);
      Swal.fire(
        "이미지 개수 제한",
        `최대 10장까지 등록 가능하여 ${available}장만 추가되었습니다.`,
        "info"
      );
    }

    const wrappedFiles = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setEventRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              pendingFiles: [...row.pendingFiles, ...wrappedFiles],
            }
          : row
      )
    );
  };

  // ================================
  // 이미지 미리보기 (서버 이미지)
  // ================================
  const openPreview = (rowIndex, imgOrder) => {
    const row = eventRows[rowIndex];

    // 기존 이미지만 슬라이드 (pendingFiles 제외)
    const list = row.images
      .sort((a, b) => a.image_order - b.image_order)
      .map((img) => ({
        url: `http://localhost:8080${img.image_path}`,
        name: img.image_name,
        order: img.image_order,
      }));

    const startIndex = list.findIndex((img) => img.order === imgOrder);

    setPreviewList(list);
    setCurrentIndex(startIndex >= 0 ? startIndex : 0);
    setPreviewOpen(true);
  };

  // ================================
  // 기존 이미지 삭제 → 삭제 예약 목록에 저장
  // (다시 클릭 시 복구)
  // ================================
  const toggleImageDeleted = (rowIndex, img) => {
    setEventRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const exists = row.deletedImages.some(
          (d) => d.image_order === img.image_order
        );

        return exists
          ? {
              ...row,
              deletedImages: row.deletedImages.filter(
                (d) => d.image_order !== img.image_order
              ),
            }
          : {
              ...row,
              deletedImages: [...row.deletedImages, img],
            };
      })
    );
  };

  // ================================
  // pendingFiles 에서 제거 (썸네일 URL revoke)
  // ================================
  const removePendingFile = (rowIndex, indexInPending) => {
    setEventRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const target = row.pendingFiles[indexInPending];
        if (target && target.previewUrl) {
          URL.revokeObjectURL(target.previewUrl);
        }

        return {
          ...row,
          pendingFiles: row.pendingFiles.filter(
            (_, idx) => idx !== indexInPending
          ),
        };
      })
    );
  };

  // ================================
  // 전체 저장 버튼 → 핵심 로직
  // ================================
  const handleSaveAll = async () => {
    const user_id = localStorage.getItem("user_id") || "admin";
    try {
      for (const row of eventRows) {
        // 1) 신규행 INSERT
        if (!row.event_id) {
          const res = await api.post(
            "/Business/AccountEventSave",
            {
              account_id: selectedAccountId,
              event_name: row.event_name,
              event_dt: row.event_dt,
              user_id,
            }
          );
          row.event_id = res.data.event_id;
        }

        // 2) 기존행 UPDATE (변경된 경우만)
        const origin = originalEventRows.find(
          (o) => o.event_id === row.event_id
        );

        if (
          origin &&
          (origin.event_name !== row.event_name ||
            origin.event_dt !== row.event_dt)
        ) {
          await api.post(
            "/Business/AccountEventUpdate",
            {
              event_id: row.event_id,
              account_id: row.account_id,
              event_name: row.event_name,
              event_dt: row.event_dt,
              user_id,
            }
          );
        }

        // 3) 기존 이미지 삭제 처리
        for (const delImg of row.deletedImages) {
          await api.delete(
            "/Business/AccountEventFileDelete",
            {
              params: {
                event_id: row.event_id,
                image_order: delImg.image_order,
                image_path: delImg.image_path,
              },
            }
          );
        }

        // 4) pendingFiles 업로드
        if (row.pendingFiles.length > 0) {
          const formData = new FormData();
          formData.append("event_id", row.event_id);

          row.pendingFiles.forEach((pf) =>
            formData.append("files", pf.file)
          );

          await api.post(
            "/Business/AccountEventFilesUpload",
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
        }
      }

      // 저장 완료 후 pendingFiles URL 정리
      eventRows.forEach((row) =>
        row.pendingFiles.forEach((pf) => {
          if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        })
      );

      Swal.fire("저장 완료", "모든 변경이 저장되었습니다.", "success");

      // 새로고침
      const refreshed = await fetchEventList(selectedAccountId);
      const updated = refreshed.map((r) => ({
        ...r,
        pendingFiles: [],
        deletedImages: [],
      }));
      setEventRows(updated);
      setOriginalEventRows(JSON.parse(JSON.stringify(updated)));
    } catch (e) {
      Swal.fire("저장 실패", e.message, "error");
    }
  };

  // ================================
  // 테이블 스타일
  // ================================
  const tableSx = {
    flex: 1,
    maxHeight: "75vh",
    overflowY: "auto",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "0px",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
      padding: "6px",
    },
  };

  const cellInputStyle = (changed) => ({
    width: "100%",
    height: "100%",
    padding: "6px",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "12px",
    textAlign: "center",
    color: changed ? "red" : "black",
    boxSizing: "border-box",
  });

  if (loading) return <LoadingScreen />;

  // =================================================================================
  // 🟢 전체 UI 렌더링
  // =================================================================================
  return (
    <>
      {/* 상단 필터 + 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}
      >
        <Box sx={{ display: "flex", gap: 1 }}>
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">거래처 선택</MenuItem>
            {(accountList || []).map((acc) => (
              <MenuItem key={acc.account_id} value={acc.account_id}>
                {acc.account_name}
              </MenuItem>
            ))}
          </Select>
          <MDButton
            variant="gradient"
            color="success"
            onClick={handleAddEventRow}
            startIcon={<Plus size={16} />}
          >
            행사 추가
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSaveAll}
          >
            전체 저장
          </MDButton>
        </Box>
      </MDBox>

      {/* 메인 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <MDBox
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            position="sticky"
            top={0}
            zIndex={3}
          >
            <MDTypography variant="h6" color="white">
              행사별 사진 관리
            </MDTypography>
          </MDBox>

          <Box sx={tableSx}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>행사명</th>
                  <th style={{ width: 80 }}>행사일자</th>
                  <th style={{ width: 260 }}>이미지 목록</th>
                  <th style={{ width: 200 }}>추가될 이미지</th>
                  <th style={{ width: 200 }}>이미지 업로드</th>
                </tr>
              </thead>

              <tbody>
                {eventRows.map((row, index) => (
                  <tr key={`${row.event_id ?? "new"}-${index}`}>
                    {/* 행사명 */}
                    <td>
                      <input
                        type="text"
                        value={row.event_name || ""}
                        onChange={(e) =>
                          handleEventFieldChange(index, "event_name", e.target.value)
                        }
                        style={cellInputStyle(isCellChanged(index, "event_name"))}
                      />
                    </td>

                    {/* 행사일자 */}
                    <td>
                      <input
                        type="date"
                        value={formatDateForInput(row.event_dt)}
                        onChange={(e) =>
                          handleEventFieldChange(index, "event_dt", e.target.value)
                        }
                        style={cellInputStyle(isCellChanged(index, "event_dt"))}
                      />
                    </td>

                    {/* 기존 이미지 목록 */}
                    <td>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "repeat(2, 1fr)",
                            sm: "repeat(3, 1fr)",
                            md: "repeat(4, 1fr)",
                          },
                          gap: 1,
                        }}
                      >
                        {row.images.map((img) => {
                          const isDeleted = row.deletedImages.some(
                            (d) => d.image_order === img.image_order
                          );

                          return (
                            <Box
                              key={img.image_order}
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                p: 1,
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                background: "#fafafa",
                                opacity: isDeleted ? 0.4 : 1,
                                filter: isDeleted ? "blur(1px)" : "none",
                              }}
                            >
                              {/* 썸네일 */}
                              <Box
                                sx={{
                                  width: "100%",
                                  height: 70,
                                  mb: 0.5,
                                  overflow: "hidden",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                                onClick={() => openPreview(index, img.image_order)}
                              >
                                <img
                                  src={`http://localhost:8080${img.image_path}`}
                                  alt={img.image_name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              </Box>

                              {/* 파일명 */}
                              <button
                                type="button"
                                onClick={() => openPreview(index, img.image_order)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  fontSize: "10px",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  textAlign: "left",
                                  marginBottom: 2,
                                }}
                              >
                                {img.image_name}
                              </button>

                              {/* 버튼 영역 */}
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <IconButton
                                  size="small"
                                  color="success"
                                  component="a"
                                  href={`http://localhost:8080${img.image_path}`}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ p: 0.5 }}
                                >
                                  <Download size={14} />
                                </IconButton>

                                <IconButton
                                  size="small"
                                  color={isDeleted ? "warning" : "error"}
                                  sx={{ p: 0.5 }}
                                  onClick={() => toggleImageDeleted(index, img)}
                                >
                                  {isDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                </IconButton>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </td>

                    {/* 추가될 이미지 미리보기 (pendingFiles) */}
                    <td>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                        }}
                      >
                        {row.pendingFiles.map((pf, idx2) => (
                        <Box
                          key={idx2}
                          sx={{
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            padding: "4px",
                            display: "flex",
                            gap: 0.5,
                            alignItems: "center",
                            background: "#f9fff6",
                          }}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              overflow: "hidden",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={pf.previewUrl}
                              alt={pf.file.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </Box>

                          <span
                            style={{
                              fontSize: "11px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              textAlign: "left",
                            }}
                          >
                            {pf.file.name}
                          </span>

                          <IconButton
                            size="small"
                            color="error"
                            sx={{ p: 0.5 }}
                            onClick={() => removePendingFile(index, idx2)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>
                      ))}

                      </Box>
                    </td>

                    {/* 파일 선택 */}
                    <td>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ width: "120px", fontSize: "11px" }}
                        onChange={(e) => {
                          handleFileSelect(index, e.target.files);
                          e.target.value = null;
                        }}
                      />
                      <div style={{ fontSize: "10px", color: "#999" }}>
                        (최대 10장)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Grid>
      </Grid>

      {/* 이미지 미리보기 Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md">
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            p: 2,
          }}
        >
          {/* 이전 버튼 */}
          <IconButton
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            sx={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              "&:hover": {
                background: "rgba(0,0,0,0.55)",
              },
            }}
          >
            <ChevronLeft size={32} />
          </IconButton>

          {/* 이미지 */}
          {previewList.length > 0 && (
            <img
              src={previewList[currentIndex].url}
              alt="preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
              }}
            />
          )}

          {/* 다음 버튼 */}
          <IconButton
            onClick={() =>
              setCurrentIndex((prev) => Math.min(prev + 1, previewList.length - 1))
            }
            disabled={currentIndex === previewList.length - 1}
            sx={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              "&:hover": {
                background: "rgba(0,0,0,0.55)",
              },
            }}
          >
            <ChevronRight size={32} />
          </IconButton>
        </DialogContent>
      </Dialog>
    </>
  );
}
