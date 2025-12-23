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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import { Download, Trash2, Plus, RotateCcw } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "config";
import useAccountEventData from "./accountEventData";

export default function AccountEventTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
  const [previewList, setPreviewList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

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
  // 파일 선택 → pendingFiles에만 저장
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

    const list = (row.images || [])
      .slice()
      .sort((a, b) => a.image_order - b.image_order)
      .map((img) => ({
        url: `${API_BASE_URL}${img.image_path}`,
        name: img.image_name,
        order: img.image_order,
      }));

    const startIndex = list.findIndex((img) => img.order === imgOrder);

    setPreviewList(list);
    setCurrentIndex(startIndex >= 0 ? startIndex : 0);
    setPreviewOpen(true);
  };

  // ================================
  // 기존 이미지 삭제 토글
  // ================================
  const toggleImageDeleted = (rowIndex, img) => {
    setEventRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const exists = row.deletedImages.some((d) => d.image_order === img.image_order);

        return exists
          ? {
              ...row,
              deletedImages: row.deletedImages.filter((d) => d.image_order !== img.image_order),
            }
          : {
              ...row,
              deletedImages: [...row.deletedImages, img],
            };
      })
    );
  };

  // ================================
  // pendingFiles 제거
  // ================================
  const removePendingFile = (rowIndex, indexInPending) => {
    setEventRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const target = row.pendingFiles[indexInPending];
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);

        return {
          ...row,
          pendingFiles: row.pendingFiles.filter((_, idx) => idx !== indexInPending),
        };
      })
    );
  };

  // ================================
  // ✅ "이미지 등록중..." 로딩 Swal
  // ================================
  const showUploadingSwal = (text = "이미지 등록중...") => {
    Swal.fire({
      title: "저장 중",
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  };

  // ================================
  // 전체 저장
  // ================================
  const handleSaveAll = async () => {
    const user_id = localStorage.getItem("user_id") || "admin";

    // ✅ 업로드/삭제 등 시간이 걸릴 수 있어서 로딩 표시
    showUploadingSwal("이미지 등록중...");

    try {
      // ⚠️ setState 배열 원소를 직접 수정하지 않도록 "복사본"으로 처리
      const workingRows = eventRows.map((r) => ({ ...r }));

      for (let idx = 0; idx < workingRows.length; idx++) {
        const row = workingRows[idx];

        // 진행표시(행사명, 업로드 장수)
        const pendingCount = row.pendingFiles?.length || 0;
        const deleteCount = row.deletedImages?.length || 0;
        const label = row.event_name ? ` (${row.event_name})` : "";
        const progressText =
          pendingCount > 0 || deleteCount > 0
            ? `이미지 처리 중${label} - 추가 ${pendingCount}장 / 삭제 ${deleteCount}장`
            : `저장 중${label}`;

        Swal.update({ text: progressText });

        // 1) 신규행 INSERT
        if (!row.event_id) {
          const res = await api.post("/Business/AccountEventSave", {
            account_id: selectedAccountId,
            event_name: row.event_name,
            event_dt: row.event_dt,
            user_id,
          });
          row.event_id = res.data.event_id;
        }

        // 2) 기존행 UPDATE (변경된 경우만)
        const origin = originalEventRows.find((o) => o.event_id === row.event_id);

        if (
          origin &&
          (origin.event_name !== row.event_name || origin.event_dt !== row.event_dt)
        ) {
          await api.post("/Business/AccountEventUpdate", {
            event_id: row.event_id,
            account_id: row.account_id,
            event_name: row.event_name,
            event_dt: row.event_dt,
            user_id,
          });
        }

        // 3) 기존 이미지 삭제
        for (const delImg of row.deletedImages || []) {
          await api.delete("/Business/AccountEventFileDelete", {
            params: {
              event_id: row.event_id,
              image_order: delImg.image_order,
              image_path: delImg.image_path,
            },
          });
        }

        // 4) pendingFiles 업로드
        if ((row.pendingFiles || []).length > 0) {
          const formData = new FormData();
          formData.append("event_id", row.event_id);
          row.pendingFiles.forEach((pf) => formData.append("files", pf.file));

          await api.post("/Business/AccountEventFilesUpload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }

      // ✅ 로딩 닫기
      Swal.close();

      // pendingFiles URL 정리
      eventRows.forEach((row) =>
        (row.pendingFiles || []).forEach((pf) => {
          if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        })
      );

      await Swal.fire("저장 완료", "모든 변경이 저장되었습니다.", "success");

      // 새로고침
      setLoading(true);
      const refreshed = await fetchEventList(selectedAccountId);
      const updated = refreshed.map((r) => ({
        ...r,
        pendingFiles: [],
        deletedImages: [],
      }));
      setEventRows(updated);
      setOriginalEventRows(JSON.parse(JSON.stringify(updated)));
      setLoading(false);
    } catch (e) {
      Swal.close();
      Swal.fire("저장 실패", e?.message || String(e), "error");
    }
  };

  // ================================
  // 테이블 스타일
  // ================================
  const tableSx = {
    flex: 1,
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowY: "auto",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "4px",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 10,
      padding: isMobile ? "4px" : "6px",
    },
  };

  const cellInputStyle = (changed) => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "4px" : "6px",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: isMobile ? "10px" : "12px",
    textAlign: "center",
    color: changed ? "red" : "black",
    boxSizing: "border-box",
  });

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 1 : 0,
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: isMobile ? "wrap" : "nowrap",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ minWidth: isMobile ? 160 : 200, fontSize: isMobile ? "12px" : "14px" }}
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
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : 110 }}
          >
            행사 추가
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSaveAll}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : 110 }}
          >
            전체 저장
          </MDButton>
        </Box>
      </MDBox>

      {/* 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={tableSx}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>행사명</th>
                  <th style={{ width: 90 }}>행사일자</th>
                  <th style={{ width: 260 }}>이미지 목록</th>
                  <th style={{ width: 220 }}>추가될 이미지</th>
                  <th style={{ width: 180 }}>이미지 업로드</th>
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
                        onChange={(e) => handleEventFieldChange(index, "event_name", e.target.value)}
                        style={cellInputStyle(isCellChanged(index, "event_name"))}
                      />
                    </td>

                    {/* 행사일자 */}
                    <td>
                      <input
                        type="date"
                        value={formatDateForInput(row.event_dt)}
                        onChange={(e) => handleEventFieldChange(index, "event_dt", e.target.value)}
                        style={cellInputStyle(isCellChanged(index, "event_dt"))}
                      />
                    </td>

                    {/* 기존 이미지 */}
                    <td>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
                          gap: 1,
                        }}
                      >
                        {(row.images || []).map((img) => {
                          const isDeleted = (row.deletedImages || []).some(
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
                                  src={`${API_BASE_URL}${img.image_path}`}
                                  alt={img.image_name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              </Box>

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

                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  component="a"
                                  href={`${API_BASE_URL}${img.image_path}`}
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

                    {/* pending 미리보기 */}
                    <td>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {(row.pendingFiles || []).map((pf, idx2) => (
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

                            <IconButton size="small" color="error" sx={{ p: 0.5 }} onClick={() => removePendingFile(index, idx2)}>
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
                      <div style={{ fontSize: "10px", color: "#999" }}>(최대 10장)</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Grid>
      </Grid>

      {/* 미리보기 */}
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
              "&:hover": { background: "rgba(0,0,0,0.55)" },
            }}
          >
            <ChevronLeft size={32} />
          </IconButton>

          {previewList.length > 0 && (
            <img
              src={previewList[currentIndex].url}
              alt="preview"
              style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
            />
          )}

          <IconButton
            onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, previewList.length - 1))}
            disabled={currentIndex === previewList.length - 1}
            sx={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              "&:hover": { background: "rgba(0,0,0,0.55)" },
            }}
          >
            <ChevronRight size={32} />
          </IconButton>
        </DialogContent>
      </Dialog>
    </>
  );
}
