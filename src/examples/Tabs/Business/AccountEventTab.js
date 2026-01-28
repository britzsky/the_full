/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Box,
  IconButton,
  Dialog,
  DialogContent,
  useTheme,
  useMediaQuery,
  TextField,
  Autocomplete,
  Typography,
} from "@mui/material";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import "./account-event-calendar.css";
import MDBox from "components/MDBox";
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

  // ✅ 거래처: ""(미선택) / "ALL"(전체) / 그 외 account_id
  const [selectedAccountId, setSelectedAccountId] = useState("ALL");

  // ✅ 캘린더 날짜 클릭 시 해당 날짜 행 강조/필터에 활용하고 싶으면 사용
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

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
  // - "ALL" 이면 전체 조회
  // ================================
  useEffect(() => {
    const run = async () => {
      setLoading(true);

      try {
        let rows = [];

        // ✅ (A) 권장: 훅(fetchEventList)이 ALL/빈값을 처리하도록 만들기
        //   - fetchEventList("ALL") 또는 fetchEventList("") 호출 시
        //     백엔드에서 전체를 내려주도록 구현
        if (selectedAccountId === "ALL") {
          // rows = await fetchEventList("ALL");

          // ✅ (B) 훅 수정 없이 여기서 직접 전체조회 API를 호출하는 방식
          // ⚠️ 아래 URL은 예시야. 너 백엔드에 맞게 하나만 맞춰주면 됨.
          // 예1) GET /Business/AccountEventListAll
          // 예2) GET /Business/AccountEventList?account_id= (빈값이면 전체)
          const res = await api.get("/Business/AccountEventList", {
            headers: { "Content-Type": "application/json" },
          });
          rows = res.data || [];
        } else if (selectedAccountId) {
          rows = await fetchEventList(selectedAccountId);
        } else {
          rows = [];
        }

        const updated = (rows || []).map((r) => ({
          ...r,
          pendingFiles: [],
          deletedImages: [],
        }));

        setEventRows(updated);
        setOriginalEventRows(JSON.parse(JSON.stringify(updated)));
      } catch (e) {
        console.error(e);
        setEventRows([]);
        setOriginalEventRows([]);
        Swal.fire("조회 실패", e?.message || String(e), "error");
      } finally {
        setLoading(false);
      }
    };

    run();
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
  // ✅ 캘린더 이벤트 생성: eventRows의 event_dt -> FullCalendar events
  // ================================
  const calendarEvents = useMemo(() => {
    return (eventRows || [])
      .filter((r) => !!formatDateForInput(r.event_dt))
      .map((r) => {
        const d = formatDateForInput(r.event_dt);
        const title = r.event_name || "내용 없음";

        return {
          id: String(r.event_id ?? `${r.account_id}-${title}-${d}`),
          title,
          start: d,
          end: d, // 하루짜리
          allDay: true,
          extendedProps: {
            event_id: r.event_id,
            account_id: r.account_id,
            event_dt: d,
            event_name: title,
          },
        };
      });
  }, [eventRows]);

  // ================================
  // 신규행 추가
  // ================================
  const handleAddEventRow = () => {
    // ✅ 전체 선택 상태에서도 추가는 가능하게 하되,
    //    account_id가 없으면 저장이 불가하니 안내
    if (!selectedAccountId || selectedAccountId === "ALL") {
      Swal.fire(
        "거래처를 먼저 선택하세요.",
        "전체 조회 상태에서는 추가할 거래처를 선택해야 합니다.",
        "info"
      );
      return;
    }

    const newRow = {
      account_id: selectedAccountId,
      event_id: null,
      event_name: "",
      event_dt: selectedCalendarDate || "", // ✅ 캘린더에서 날짜 찍었으면 그 날짜로 기본 입력
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
    const currentCount = (targetRow.images?.length || 0) + (targetRow.pendingFiles?.length || 0);

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

    showUploadingSwal("이미지 등록중...");

    try {
      const workingRows = eventRows.map((r) => ({ ...r }));

      for (let idx = 0; idx < workingRows.length; idx++) {
        const row = workingRows[idx];

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
            account_id: row.account_id, // ✅ 행별 account_id 사용
            event_name: row.event_name,
            event_dt: row.event_dt,
            user_id,
          });
          row.event_id = res.data.event_id;
        }

        // 2) 기존행 UPDATE (변경된 경우만)
        const origin = originalEventRows.find((o) => o.event_id === row.event_id);
        if (origin && (origin.event_name !== row.event_name || origin.event_dt !== row.event_dt)) {
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

      Swal.close();

      // pendingFiles URL 정리
      eventRows.forEach((row) =>
        (row.pendingFiles || []).forEach((pf) => {
          if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        })
      );

      await Swal.fire("저장 완료", "모든 변경이 저장되었습니다.", "success");

      // ✅ 재조회
      setLoading(true);

      let refreshed = [];
      if (selectedAccountId === "ALL") {
        const res = await api.get("/Business/AccountEventList", {
          headers: { "Content-Type": "application/json" },
        });
        refreshed = res.data || [];
      } else if (selectedAccountId) {
        refreshed = await fetchEventList(selectedAccountId);
      } else {
        refreshed = [];
      }

      const updated = (refreshed || []).map((r) => ({
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

  // ================================
  // ✅ 거래처 Autocomplete 옵션: "전체" 추가
  // ================================
  const accountOptions = useMemo(() => {
    const base = accountList || [];
    return [{ account_id: "ALL", account_name: "전체" }, ...base];
  }, [accountList]);

  const selectedAccountValue =
    accountOptions.find((a) => String(a.account_id) === String(selectedAccountId)) || null;

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
          {/* ✅ 거래처 검색 가능한 Autocomplete + "전체" */}
          {(accountOptions || []).length > 0 && (
            <Autocomplete
              size="small"
              sx={{ minWidth: 220 }}
              options={accountOptions}
              value={selectedAccountValue}
              onChange={(_, newValue) => {
                setSelectedAccountId(newValue ? newValue.account_id : "");
              }}
              getOptionLabel={(option) => option?.account_name ?? ""}
              isOptionEqualToValue={(option, value) =>
                String(option?.account_id) === String(value?.account_id)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
                  sx={{
                    "& .MuiInputBase-root": { height: 43, fontSize: 12 },
                    "& input": { padding: "0 8px" },
                  }}
                />
              )}
            />
          )}

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

      {/* ✅ 왼쪽 캘린더 + 오른쪽 테이블 */}
      <Grid container spacing={2}>
        {/* LEFT: 캘린더 */}
        <Grid item xs={12} md={4.5}>
          <Box
            className="account-event-calendar"
            sx={{
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              p: 0,
              background: "#fff",
              height: isMobile ? "auto" : "75vh",
              overflow: "hidden",
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: "bold", mb: 1 }}>📅 행사 캘린더</Typography>

            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="ko"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              showNonCurrentDates={false} // ✅ 다른 달 날짜 숨김
              fixedWeekCount={false} // ✅ 필요 주만 표시
              height={isMobile ? "auto" : "70vh"}
              events={calendarEvents}
              dateClick={(arg) => {
                // ✅ 날짜 클릭하면 그 날짜로 신규행 기본값 넣을 수 있게 저장
                setSelectedCalendarDate(arg.dateStr);

                // 원하면: 해당 날짜 행만 보고 싶을 때 필터링도 가능
                // (지금은 저장만)
              }}
              eventClick={(info) => {
                // ✅ 캘린더에서 이벤트 클릭하면 테이블에서 해당 날짜/행사로 사용자가 찾기 쉬움
                const dt =
                  info.event.extendedProps?.event_dt ||
                  dayjs(info.event.start).format("YYYY-MM-DD");
                setSelectedCalendarDate(dt);

                // 테이블 스크롤까지 하고 싶으면: id를 붙여 scrollIntoView 하는 방식으로 확장 가능
              }}
              dayMaxEventRows={3}
              eventContent={(arg) => (
                <div
                  style={{
                    fontSize: "10px",
                    lineHeight: 1.2,
                    textAlign: "left",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    padding: "0 2px",
                  }}
                >
                  {arg.event.title}
                </div>
              )}
            />
          </Box>
        </Grid>

        {/* RIGHT: 기존 테이블 그대로 */}
        <Grid item xs={12} md={7.5}>
          <Box sx={tableSx}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>행사명</th>
                  <th style={{ width: 90 }}>행사일자</th>
                  <th style={{ width: 300 }}>이미지 목록</th>
                  <th style={{ width: 220 }}>추가될 이미지</th>
                  <th style={{ width: 180 }}>이미지 업로드</th>
                </tr>
              </thead>

              <tbody>
                {eventRows
                  // ✅ 캘린더 날짜를 눌렀으면 그 날짜만 보고 싶다면 아래 주석을 풀어
                  // .filter((r) => !selectedCalendarDate || formatDateForInput(r.event_dt) === selectedCalendarDate)
                  .map((row, index) => (
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

                      {/* 기존 이미지 */}
                      <td>
                        <Box
                          sx={{
                            display: "grid",
                            justifyContent: "start",
                            gridTemplateColumns: {
                              xs: "repeat(auto-fill, 70px)",
                              sm: "repeat(auto-fill, 80px)",
                              md: "repeat(auto-fill, 90px)",
                            }, // ✅ 타일 폭 자체를 줄여서 width도 절반 느낌
                            gap: 0.7,
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
                                  p: 0.5, // ✅ 카드 padding 절반
                                  border: "1px solid #ccc",
                                  borderRadius: "4px",
                                  background: "#fafafa",
                                  opacity: isDeleted ? 0.4 : 1,
                                  filter: isDeleted ? "blur(1px)" : "none",
                                }}
                              >
                                {/* <Box
                                  sx={{
                                    width: "100%",
                                    height: 35,
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
                                </Box> */}

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
                                  width: 30,
                                  height: 30,
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
