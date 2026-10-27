// 지점업로드 탭: 거래처별 급식일자·구분마다 식단표와 식판 사진을 올리고 내려받는 화면 (목록 보기 / 달력 보기)
// 조회·업로드·저장 API와 자료 판별 헬퍼는 branchUploadData.js에서 처리
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import JSZip from "jszip";
import {
  Autocomplete,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { API_BASE_URL } from "config";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import { PhotoThumb, useFillViewportHeight } from "utils/HygieneCardBoard";
import accountLabelSx from "utils/accountLabelSx";
import PreviewOverlay from "utils/PreviewOverlay";
import { LockedSwal as Swal, showSwalLoading } from "utils/swalLoading";
import useBranchUploadData, {
  MEAL_TYPES,
  FILE_KINDS,
  ALL_ACCOUNTS,
  DOWNLOAD_OPTIONS,
  fileOf,
  isPdf,
  countFiles,
  isDone,
  buildFileName,
  fetchFileBlob,
} from "./branchUploadData";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 등록 카드 자료 종류별 아이콘
const KIND_ICON = { menu: ArticleOutlinedIcon, plate: RestaurantOutlinedIcon };

// 위생점검 화면과 같은 색 구성 (강조: ERP info 파랑)
const ACCENT = "#1A73E8";
const TONE = {
  done: { bg: "#eaf7ef", fg: "#2a7a49" },
  missing: { bg: "#fff3e6", fg: "#a55d1d" },
};
const TEXT = "#344767";
const SUB = "#7b809a";
const BORDER = "#dde5eb";
const cardStyle = { border: `1px solid ${BORDER}`, borderRadius: 8, backgroundColor: "#ffffff" };
// 달력 막대의 자료 종류별 색 (미등록은 회색)
const KIND_COLOR = { menu: ACCENT, plate: "#2a9d6a" };
const EMPTY_BAR = "#e3e8ed";

// 입력칸 공통 스타일 (높이 40px 고정, 안쪽 위아래 여백을 없애 글자를 상하 가운데 정렬)
const inputBoxSx = {
  "& .MuiInputBase-root": { height: 40, fontSize: 13, display: "flex", alignItems: "center" },
  "& .MuiInputBase-input": {
    height: "100%",
    paddingTop: "0 !important",
    paddingBottom: "0 !important",
    boxSizing: "border-box",
    lineHeight: 1,
  },
};

// URL을 지정한 파일명으로 내려받는 함수
const triggerDownload = (url, fileName) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
};


// 둥근 상태 배지
function Badge({ label, bg, fg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 22,
        boxSizing: "border-box",
        borderRadius: 999,
        padding: "0 9px",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

// 필터 칩 버튼 스타일 (선택 시 강조 색 채움, color: 선택 색)
const chipStyle = (active, color = ACCENT) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 32,
  boxSizing: "border-box",
  padding: "0 14px",
  borderRadius: 999,
  border: `1px solid ${active ? color : "#dce4ea"}`,
  backgroundColor: active ? color : "#f7f9fa",
  color: active ? "#ffffff" : "#5b6a79",
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  lineHeight: 1,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

// 급식 구분별 색 (목록 구분 배지·필터 칩 선택 색)
const MEAL_COLOR = {
  조식: { bg: "#fff4e0", fg: "#c77700" },
  중식: { bg: "#eef4fc", fg: ACCENT },
  석식: { bg: "#f3eefc", fg: "#6a3fc1" },
  간식: { bg: "#fdeef4", fg: "#c2185b" },
};

// 목록/달력 보기 전환 버튼 스타일 (선택된 쪽은 흰 바탕으로 띄움)
const viewButtonStyle = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 30,
  padding: "0 12px",
  border: "none",
  borderRadius: 8,
  backgroundColor: active ? "#ffffff" : "transparent",
  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
  color: active ? TEXT : SUB,
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  lineHeight: 1,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

// 자료 썸네일 (사진은 축소 미리보기, PDF는 문서 아이콘 / value: 서버 경로 또는 새로 고른 File)
function FileThumb({ value, width, height, onView }) {
  const pdf = typeof value === "string" ? isPdf(value) : value?.type === "application/pdf";
  return (
    <div style={{ width, flexShrink: 0 }}>
      {pdf ? (
        <div
          onClick={onView}
          style={{
            height,
            borderRadius: 8,
            backgroundColor: "#fdecea",
            color: "#c62828",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: onView ? "zoom-in" : "default",
          }}
        >
          <PictureAsPdfOutlinedIcon sx={{ fontSize: Math.round(height * 0.5) }} />
        </div>
      ) : (
        <PhotoThumb value={value} height={height} onView={() => onView && onView()} />
      )}
    </div>
  );
}

// 목록 표의 식단표/식판 사진 칸 (등록됨: 썸네일·등록 시각, 미등록: 점선 추가 버튼)
function FileCell({ file, onView, onAdd }) {
  if (!file) {
    return (
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 52,
          padding: "0 14px",
          border: "1px dashed #c9d5df",
          borderRadius: 8,
          backgroundColor: "#f8fafb",
          color: "#9aa6b1",
          fontSize: 12,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 18, display: "block" }} />
        미등록 · 추가
      </button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <FileThumb value={file.path} width={72} height={52} onView={onView} />
      <div>
        <Badge label="등록됨" {...TONE.done} />
        <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{file.regDt.slice(5)}</div>
      </div>
    </div>
  );
}

// 등록·수정 모달의 첨부자료 카드 (클릭 또는 파일 드래그로 선택, 기존 파일이 있으면 미리보기 후 교체)
function FileDropCard({ index, kind, file, existing, onSelect, onView, onDownload }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const { label, hint, accept } = kind;
  const Icon = KIND_ICON[kind.key];
  const current = file || existing?.path;

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onSelect(dropped);
      }}
      style={{
        minHeight: 168,
        padding: 14,
        boxSizing: "border-box",
        border: `1px dashed ${dragOver || file ? ACCENT : "#c9d5df"}`,
        borderRadius: 10,
        backgroundColor: dragOver ? "#eef5ff" : file ? "#f6faff" : "#fbfcfd",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textAlign: "center",
        cursor: "pointer",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      {current ? (
        // 선택했거나 기존에 등록된 파일 미리보기
        <>
          {/* 기존 파일 썸네일은 누르면 크게 보기 (카드의 파일 선택 동작은 막음) */}
          <div
            onClick={(e) => {
              if (file || !onView) return;
              e.stopPropagation();
              onView();
            }}
          >
            <FileThumb value={current} width={120} height={78} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
            {index} {label}
          </div>
          <div style={{ fontSize: 11, color: SUB, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file ? file.name : existing.name || existing.path.split("/").pop()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Badge label={file ? "새 파일 선택됨" : "등록됨"} {...(file ? { bg: "#eef4fc", fg: ACCENT } : TONE.done)} />
            {!file && onDownload && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                style={{ ...chipStyle(false), height: 24, padding: "0 8px", fontSize: 11 }}
              >
                <DownloadIcon sx={{ fontSize: 14, display: "block" }} />
                다운로드
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#9aa6b1" }}>클릭 또는 파일 드래그로 교체</div>
        </>
      ) : (
        // 파일 선택 전 안내
        <>
          <Icon sx={{ fontSize: 30, color: "#8aa0b4" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
            {index} {label}
          </div>
          <div style={{ fontSize: 12, color: "#9aa6b1", lineHeight: 1.6 }}>
            {hint}
            <br />
            클릭 또는 파일 드래그
          </div>
        </>
      )}
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={accept}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) onSelect(picked);
        }}
      />
    </div>
  );
}

// 달력 보기 (날짜별 등록 건수·완료 건수와 건별 상태 막대, 날짜 클릭 시 해당 날짜 목록으로 이동)
// summaryMode: 전체 거래처 조회 여부 (건별 막대 대신 날짜별 요약 표시)
function UploadCalendar({ year, month, rows, isMobile, summaryMode, onSelectDate }) {
  const first = dayjs(new Date(year, month - 1, 1));
  const todayStr = dayjs().format("YYYY-MM-DD");
  // 앞쪽 빈칸 + 날짜 + 마지막 주 빈칸 (7칸 단위)
  const cells = [...Array(first.day()).fill(null), ...Array.from({ length: first.daysInMonth() }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  // 급식일자별 행 묶음
  const rowsByDate = rows.reduce((acc, row) => {
    (acc[row.meal_date] = acc[row.meal_date] || []).push(row);
    return acc;
  }, {});

  return (
    // 달력 카드 (영역 높이를 꽉 채우고, 날짜 칸은 주 수에 맞춰 남은 높이를 나눠 가짐)
    <div
      style={{
        ...cardStyle,
        padding: isMobile ? 10 : 16,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 달력 제목과 상태 색 범례 */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>
          {year}년 {month}월
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 12, color: SUB }}>
          {FILE_KINDS.map(({ key, label }) => (
            <span key={key}>
              <span style={{ color: KIND_COLOR[key] }}>●</span> {label}
            </span>
          ))}
          <span>
            <span style={{ color: EMPTY_BAR }}>●</span> 미등록
          </span>
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(${isMobile ? 64 : 80}px, 1fr))`,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* 요일 머리 줄 */}
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            style={{
              padding: "9px 0",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: "#f5f8fa",
              color: i === 0 ? "#d32f2f" : i === 6 ? ACCENT : "#5b6b7c",
              borderBottom: `1px solid ${BORDER}`,
              borderRight: i < 6 ? `1px solid ${BORDER}` : "none",
            }}
          >
            {w}
          </div>
        ))}

        {/* 날짜 칸 (등록 건이 있는 날만 클릭 가능) */}
        {cells.map((day, i) => {
          const dateStr = day ? first.date(day).format("YYYY-MM-DD") : "";
          const dayRows = (day && rowsByDate[dateStr]) || [];
          // 날짜의 등록 자료 수 / 필요 자료 수 (건당 식단표·식판 사진 2개)
          const fileCount = dayRows.reduce((sum, row) => sum + countFiles(row), 0);
          const fileTotal = dayRows.length * FILE_KINDS.length;
          const weekday = i % 7;
          const isToday = dateStr === todayStr;
          return (
            <div
              key={day ? dateStr : `blank-${i}`}
              onClick={() => dayRows.length && onSelectDate(dateStr)}
              style={{
                padding: isMobile ? 6 : 10,
                boxSizing: "border-box",
                backgroundColor: day ? "#ffffff" : "#fafbfc",
                borderRight: weekday < 6 ? `1px solid ${BORDER}` : "none",
                borderBottom: i < cells.length - 7 ? `1px solid ${BORDER}` : "none",
                cursor: dayRows.length ? "pointer" : "default",
              }}
            >
              {day && (
                <>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                      backgroundColor: isToday ? ACCENT : "transparent",
                      color: isToday ? "#ffffff" : weekday === 0 ? "#d32f2f" : weekday === 6 ? ACCENT : "#5b6b7c",
                    }}
                  >
                    {day}
                  </span>
                  {/* 전체 거래처: 날짜별 요약 (거래처 수·건수 + 자료 종류별 등록 진행 막대) */}
                  {dayRows.length > 0 && summaryMode && (
                    <>
                      <div style={{ fontSize: 11, lineHeight: 1, marginTop: 6, whiteSpace: "nowrap", fontWeight: 700, color: TEXT }}>
                        {new Set(dayRows.map((row) => row.account_id)).size}곳 · {dayRows.length}건
                      </div>
                      {FILE_KINDS.map(({ key, label }) => {
                        const count = dayRows.filter((row) => fileOf(row, key)).length;
                        return (
                          <div
                            key={key}
                            title={`${label} ${count} / ${dayRows.length}건 등록`}
                            style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}
                          >
                            <span style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: EMPTY_BAR, overflow: "hidden" }}>
                              <span
                                style={{
                                  display: "block",
                                  width: `${(count / dayRows.length) * 100}%`,
                                  height: "100%",
                                  backgroundColor: KIND_COLOR[key],
                                }}
                              />
                            </span>
                            {!isMobile && (
                              <span style={{ fontSize: 10, lineHeight: 1, color: SUB, whiteSpace: "nowrap" }}>
                                {count}/{dayRows.length}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {/* 단일 거래처: 등록 자료 수와 건별 막대 */}
                  {dayRows.length > 0 && !summaryMode && (
                    <>
                      <div
                        style={{
                          fontSize: 11,
                          lineHeight: 1,
                          marginTop: 6,
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                          color: fileCount === fileTotal ? TONE.done.fg : TONE.missing.fg,
                        }}
                      >
                        {fileCount} / {fileTotal}개 등록
                      </div>
                      {/* 건별 자료 막대 (식단표·식판 사진 두 칸, 미등록은 회색) */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {dayRows.map((row) => (
                          <span key={row.idx} title={`${row.account_name} ${row.meal_type}`} style={{ display: "flex", gap: 2 }}>
                            {FILE_KINDS.map(({ key }) => (
                              <span
                                key={key}
                                style={{
                                  width: 12,
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor: fileOf(row, key) ? KIND_COLOR[key] : EMPTY_BAR,
                                }}
                              />
                            ))}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: SUB, marginTop: 10 }}>
        날짜를 선택하면 해당 날짜의 거래처별 상세 목록을 확인할 수 있습니다.
      </div>
    </div>
  );
}

const fileShape = PropTypes.shape({ path: PropTypes.string, name: PropTypes.string, regDt: PropTypes.string });
Badge.propTypes = { label: PropTypes.node, bg: PropTypes.string, fg: PropTypes.string };
FileThumb.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  width: PropTypes.number,
  height: PropTypes.number,
  onView: PropTypes.func,
};
FileCell.propTypes = { file: fileShape, onView: PropTypes.func, onAdd: PropTypes.func };
FileDropCard.propTypes = {
  index: PropTypes.string,
  kind: PropTypes.object.isRequired,
  file: PropTypes.object,
  existing: fileShape,
  onSelect: PropTypes.func.isRequired,
  onView: PropTypes.func,
  onDownload: PropTypes.func,
};
UploadCalendar.propTypes = {
  summaryMode: PropTypes.bool,
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  isMobile: PropTypes.bool,
  onSelectDate: PropTypes.func.isRequired,
};

// 식사 구분 선택 목록 (SelectAutocomplete 옵션)
const MEAL_OPTIONS = MEAL_TYPES.map((t) => ({ value: t, label: t }));

// 정해진 목록에서 값을 고르는 Autocomplete (식사 구분, options: [{ value, label }])
function SelectAutocomplete({ options, value, onChange, label, disabled, sx }) {
  return (
    <Autocomplete
      size="small"
      options={options}
      value={options.find((o) => o.value === value) || null}
      onChange={(_, opt) => opt && onChange(opt.value)}
      getOptionLabel={(opt) => opt?.label ?? ""}
      isOptionEqualToValue={(opt, val) => opt.value === val.value}
      disableClearable
      disabled={disabled}
      renderInput={(params) => <TextField {...params} label={label} sx={{ ...inputBoxSx, ...accountLabelSx }} />}
      ListboxProps={{ style: { fontSize: "12px" } }}
      sx={sx}
    />
  );
}

SelectAutocomplete.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.any, label: PropTypes.string })).isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  sx: PropTypes.object,
};

// isHeadOffice: 본사 메뉴 화면 여부 (전체 거래처 조회, 거래처 고정 없음, 다운로드 시 거래처 범위 선택)
function BranchUploadTab({ isHeadOffice }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const today = dayjs();

  // 현장 화면에서 localStorage account_id가 있으면 해당 거래처로 고정
  const localAccountId = useMemo(
    () => (isHeadOffice ? "" : localStorage.getItem("account_id") || ""),
    [isHeadOffice]
  );
  const isAccountLocked = !!localAccountId;

  // 거래처 목록·조회 자료·조회 중 여부와 조회/저장 API (branchUploadData.js)
  const {
    accountList,
    rows,
    loading: listLoading,
    fetchBranchUploadList,
    fetchBranchUploadRows,
    findExistingRow,
    saveBranchUpload,
  } = useBranchUploadData(isHeadOffice);

  // 조회 조건: 거래처(전체/단일), 연도, 월
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || ALL_ACCOUNTS);
  const [accountInput, setAccountInput] = useState("");
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  // 목록 필터: 구분, 달력에서 고른 날짜("": 전체 날짜)
  const [mealFilter, setMealFilter] = useState("전체");
  const [selectedDate, setSelectedDate] = useState("");
  // 화면 보기 방식 (list: 목록, calendar: 달력)
  const [viewMode, setViewMode] = useState("list");

  // 다운로드용으로 체크한 행 idx 목록
  const [checkedIds, setCheckedIds] = useState([]);
  // 다운로드 메뉴 기준 버튼
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  // 본사 다운로드 범위 선택 팝업 (label: 다운로드 종류, accountId: 고른 거래처)과 선택 결과 전달 함수
  // startDate·endDate: 다운로드 기간 (선택 월 안)
  const [scopeDialog, setScopeDialog] = useState({
    open: false,
    label: "",
    accountId: ALL_ACCOUNTS,
    startDate: "",
    endDate: "",
  });
  const scopeResolveRef = useRef(null);
  // 사진 확대 미리보기 대상
  const [previewFiles, setPreviewFiles] = useState(null);

  // 등록·수정 모달 (mode: register | edit, row: 수정 대상 행, form: 입력값과 새로 고른 파일)
  const [modal, setModal] = useState({ open: false, mode: "register", row: null, form: {} });

  // 목록·달력 영역 ref와 화면 맨 아래까지 채우는 높이
  // (아래 여백: 현장 탭 안쪽 패딩 기준 32px, 본사 화면은 카드·페이지 패딩까지 56px)
  const [contentAreaRef, contentAreaHeight] = useFillViewportHeight(isHeadOffice ? 56 : 32);

  // 표의 미등록 칸 추가 버튼이 쓰는 숨김 파일 입력과 대상 (행, 자료 종류)
  const fileInputRef = useRef(null);
  const pickTargetRef = useRef(null);

  // 선택 연월·거래처의 자료 목록 조회
  const fetchList = useCallback(
    () =>
      fetchBranchUploadList({
        year,
        month,
        account_id: selectedAccountId === ALL_ACCOUNTS ? "" : selectedAccountId,
      }),
    [year, month, selectedAccountId, fetchBranchUploadList]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 조회 조건이 바뀌면 체크·선택 날짜 해제
  useEffect(() => {
    setCheckedIds([]);
    setSelectedDate("");
  }, [year, month, selectedAccountId]);

  // 거래처 검색 선택 옵션 (고정 사용자가 아니면 맨 앞에 전체 거래처)
  const accountOptions = useMemo(() => {
    const list = accountList.map((acc) => ({ value: String(acc.account_id), label: acc.account_name }));
    return isAccountLocked ? list : [{ value: ALL_ACCOUNTS, label: "전체 거래처" }, ...list];
  }, [accountList, isAccountLocked]);

  // 구분 필터를 적용한 행 (달력 표시 기준)
  const mealRows = useMemo(
    () => rows.filter((row) => mealFilter === "전체" || row.meal_type === mealFilter),
    [rows, mealFilter]
  );
  // 목록 표시 행 (달력에서 고른 날짜가 있으면 그 날짜만)
  const visibleRows = useMemo(
    () => (selectedDate ? mealRows.filter((row) => row.meal_date === selectedDate) : mealRows),
    [mealRows, selectedDate]
  );

  const allChecked = visibleRows.length > 0 && visibleRows.every((row) => checkedIds.includes(row.idx));

  // 거래처·일자·구분 1건의 자료를 올리고 저장한 뒤 목록 다시 조회 (files: { menu?: File, plate?: File })
  const saveUpload = async (target, files) => {
    showSwalLoading("업로드 중...");
    try {
      await saveBranchUpload(target, files);
      await fetchList();
      Swal.fire({ title: "저장 완료", icon: "success", timer: 900, showConfirmButton: false });
      return true;
    } catch (err) {
      console.error("지점업로드 저장 실패:", err);
      Swal.fire("업로드 실패", err?.message || "잠시 후 다시 시도해 주세요.", "error");
      return false;
    }
  };

  // 표의 미등록 칸 추가 버튼: 파일 선택창 열기
  const pickFile = (row, kind) => {
    pickTargetRef.current = { row, kind };
    fileInputRef.current.value = "";
    fileInputRef.current.accept = FILE_KINDS.find((k) => k.key === kind).accept;
    fileInputRef.current.click();
  };

  // 숨김 파일 입력에서 파일을 고른 뒤 대상 행의 해당 자료만 저장
  const handlePickedFile = (e) => {
    const file = e.target.files?.[0];
    const target = pickTargetRef.current;
    if (file && target) saveUpload(target.row, { [target.kind]: file });
  };

  // 등록 모달 열기 (일자는 달력 선택 날짜 → 선택 월의 오늘 → 1일 순, 거래처는 현재 선택 거래처)
  const openRegister = () => {
    const inMonth = today.year() === year && today.month() + 1 === month;
    const defaultDate =
      selectedDate || (inMonth ? today.format("YYYY-MM-DD") : dayjs(new Date(year, month - 1, 1)).format("YYYY-MM-DD"));
    setModal({
      open: true,
      mode: "register",
      row: null,
      form: {
        meal_date: defaultDate,
        account_id: selectedAccountId === ALL_ACCOUNTS ? "" : selectedAccountId,
        meal_type: mealFilter === "전체" ? "중식" : mealFilter,
        menu: null,
        plate: null,
      },
    });
  };

  // 수정 모달 열기 (거래처·일자·구분은 고정, 파일만 교체)
  const openEdit = (row) =>
    setModal({
      open: true,
      mode: "edit",
      row,
      form: { account_id: String(row.account_id), meal_date: row.meal_date, meal_type: row.meal_type, menu: null, plate: null },
    });

  const closeModal = () => setModal((m) => ({ ...m, open: false }));
  const setFormValue = (key, value) => setModal((m) => ({ ...m, form: { ...m.form, [key]: value } }));

  // 등록·수정 모달 저장 (등록은 이미 있는 건이면 막고 수정으로 안내, 수정은 선택한 파일만 교체)
  const handleModalSave = async () => {
    const { form, mode } = modal;
    if (!form.account_id) return Swal.fire("거래처를 선택해 주세요.", "", "warning");
    if (!form.meal_date) return Swal.fire("급식일자를 선택해 주세요.", "", "warning");
    if (!form.menu && !form.plate) {
      return Swal.fire(mode === "edit" ? "교체할 파일을 선택해 주세요." : "식단표나 식판 사진 중 하나 이상 올려 주세요.", "", "warning");
    }

    if (mode === "register") {
      let existing;
      try {
        existing = await findExistingRow(form);
      } catch (err) {
        return Swal.fire("확인 실패", "기존 등록 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      }
      if (existing) {
        const result = await Swal.fire({
          title: "이미 등록된 자료가 있습니다",
          html: `${dayjs(form.meal_date).format("YYYY.MM.DD")} ${form.meal_type} 자료가 이미 등록되어 있습니다.<br/>새로 등록하지 말고 <b>수정</b>으로 변경해 주세요.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "수정하기",
          cancelButtonText: "닫기",
        });
        // 수정하기: 기존 건 수정 모달로 전환 (방금 고른 파일은 그대로 유지)
        if (result.isConfirmed) {
          setModal({
            open: true,
            mode: "edit",
            row: existing,
            form: { ...form, account_id: String(existing.account_id) },
          });
        }
        return null;
      }
    }

    closeModal();
    const ok = await saveUpload(form, { menu: form.menu, plate: form.plate });
    if (!ok) {
      setModal((m) => ({ ...m, open: true }));
      return null;
    }
    // 등록한 일자의 연월로 조회 조건 이동
    const d = dayjs(form.meal_date);
    setYear(d.year());
    setMonth(d.month() + 1);
    return null;
  };

  // 선택 월의 첫날·마지막 날 (다운로드 기간 선택 범위)
  const monthStart = dayjs(new Date(year, month - 1, 1)).format("YYYY-MM-DD");
  const monthEnd = dayjs(new Date(year, month - 1, 1)).endOf("month").format("YYYY-MM-DD");

  // 다운로드 범위 선택 팝업 닫기 (value: { accountId, startDate, endDate }, 취소면 null)
  const closeScopeDialog = (value) => {
    setScopeDialog((d) => ({ ...d, open: false }));
    if (scopeResolveRef.current) scopeResolveRef.current(value);
    scopeResolveRef.current = null;
  };

  // 본사 화면 다운로드 범위 선택 (거래처: 전체 또는 1곳, 기간: 선택 월 안) 후 해당 자료 조회, 취소하면 null
  // 기간 기본값은 달력에서 고른 날짜가 있으면 그 날짜, 없으면 선택 월 전체
  const askDownloadScope = async (optionLabel) => {
    const value = await new Promise((resolve) => {
      scopeResolveRef.current = resolve;
      setScopeDialog({
        open: true,
        label: optionLabel,
        accountId: String(selectedAccountId),
        startDate: selectedDate || monthStart,
        endDate: selectedDate || monthEnd,
      });
    });
    if (!value) return null;

    const monthRows = await fetchBranchUploadRows({
      year,
      month,
      account_id: value.accountId === ALL_ACCOUNTS ? "" : value.accountId,
    });
    const list = monthRows.filter(
      (row) =>
        (mealFilter === "전체" || row.meal_type === mealFilter) &&
        row.meal_date >= value.startDate &&
        row.meal_date <= value.endDate
    );
    return { rows: list, allAccounts: value.accountId === ALL_ACCOUNTS };
  };

  // 지정 자료를 ZIP으로 내려받는 함수
  // 체크한 행이 있으면 그 행만, 없으면 현장 화면은 표시 목록 전체 / 본사 화면은 거래처 범위 선택 후 해당 월 전체
  const handleZipDownload = async ({ label, kinds }) => {
    setDownloadAnchor(null);
    let targets = checkedIds.length ? visibleRows.filter((row) => checkedIds.includes(row.idx)) : visibleRows;
    // 전체 거래처 묶음이면 거래처별 폴더로 나눠 담음
    let byAccountFolder = false;
    if (isHeadOffice && checkedIds.length === 0) {
      try {
        const scope = await askDownloadScope(label);
        if (!scope) return;
        targets = scope.rows;
        byAccountFolder = scope.allAccounts;
      } catch (err) {
        Swal.fire("조회 실패", "다운로드할 자료를 불러오지 못했습니다.", "error");
        return;
      }
    }
    const jobs = targets.flatMap((row) => kinds.filter((kind) => fileOf(row, kind)).map((kind) => ({ row, kind })));
    if (jobs.length === 0) {
      Swal.fire("내려받을 자료가 없습니다.", "", "info");
      return;
    }

    showSwalLoading("압축 파일 만드는 중...", `${jobs.length}개 파일`);
    const zip = new JSZip();
    let failed = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const { row, kind } of jobs) {
      try {
        // 자료 종류별 폴더 (전체 거래처 묶음이면 거래처 폴더 아래에 나눔)
        const kindFolder = `${FILE_KINDS.find((k) => k.key === kind).label.replace(" ", "")}/`;
        const folder = byAccountFolder ? `${row.account_name || row.account_id}/${kindFolder}` : kindFolder;
        // eslint-disable-next-line no-await-in-loop
        zip.file(`${folder}${buildFileName(row, kind)}`, await fetchFileBlob(fileOf(row, kind).path));
      } catch (err) {
        failed += 1;
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `지점업로드_${year}-${String(month).padStart(2, "0")}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (failed) Swal.fire("일부 파일 누락", `${failed}개 파일을 받지 못했습니다.`, "warning");
    else Swal.close();
  };

  // 자료 하나를 확대 미리보기로 여는 함수
  const openPreview = (row, kind) => {
    const { path, name } = fileOf(row, kind);
    setPreviewFiles([{ url: `${API_BASE_URL}${path}`, name: name || path.split("/").pop(), kind: isPdf(path) ? "pdf" : "image" }]);
  };

  // 달력에서 날짜를 고르면 그 날짜 목록으로 이동
  const handleSelectDate = (dateStr) => {
    setSelectedDate(dateStr);
    setCheckedIds([]);
    setViewMode("list");
  };

  const toggleChecked = (idx) =>
    setCheckedIds((prev) => (prev.includes(idx) ? prev.filter((v) => v !== idx) : [...prev, idx]));

  // 표 머리·칸 공통 스타일
  const th = {
    padding: "11px 12px",
    fontSize: 12,
    fontWeight: 700,
    color: "#5b6b7c",
    backgroundColor: "#f5f8fa",
    borderBottom: `1px solid ${BORDER}`,
    textAlign: "left",
    whiteSpace: "nowrap",
    // 카드 안에서 스크롤해도 머리 줄 고정
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
  const td = { padding: "12px", borderBottom: "1px solid #eef2f5", verticalAlign: "middle" };

  const { form } = modal;
  const isEdit = modal.mode === "edit";

  return (
    <MDBox>
      {/* 상단 구분 필터·조회 조건·보기 전환·다운로드/등록 버튼 영역 */}
      {/* 넓은 화면은 한 줄, 좁아지면 [구분 칩] / [조회 조건·버튼] 두 묶음으로 줄바꿈, 모바일은 칸이 폭을 나눠 사용 */}
      <MDBox
        sx={{
          display: "flex",
          alignItems: "center",
          columnGap: 2,
          rowGap: 1.25,
          flexWrap: "wrap",
          pb: 1.5,
          mb: 1.5,
          borderBottom: "1px solid #eef2f5",
        }}
      >
        {/* 구분 필터 칩 (선택 날짜가 있으면 날짜 칩도 표시) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            flex: isMobile ? "1 1 100%" : "1 1 auto",
          }}
        >
          {["전체", ...MEAL_TYPES].map((type) => (
            <button key={type} type="button" onClick={() => setMealFilter(type)} style={chipStyle(mealFilter === type, MEAL_COLOR[type]?.fg)}>
              {type}
            </button>
          ))}
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate("")}
              style={{ ...chipStyle(false), borderColor: ACCENT, color: ACCENT, fontWeight: 700 }}
            >
              {dayjs(selectedDate).format("MM.DD")}만 보기
              <CloseIcon sx={{ fontSize: 15, display: "block" }} />
            </button>
          )}
        </div>

        {/* 조회 조건·보기 전환·다운로드/등록 버튼 묶음 (좁아지면 칩 아래 줄로 내려가 오른쪽 정렬) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            flex: isMobile ? "1 1 100%" : "0 1 auto",
            marginLeft: isMobile ? 0 : "auto",
          }}
        >
          <Autocomplete
            size="small"
            options={accountOptions}
            value={accountOptions.find((o) => o.value === String(selectedAccountId)) || null}
            onChange={(_, opt) => opt && setSelectedAccountId(opt.value)}
            inputValue={accountInput}
            onInputChange={(_, v) => setAccountInput(v)}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            disabled={isAccountLocked}
            disableClearable
            renderInput={(params) => (
              <TextField
                {...params}
                label={isAccountLocked ? "거래처(고정)" : "거래처 검색"}
                placeholder="거래처명을 입력"
                sx={{ ...inputBoxSx, ...accountLabelSx }}
              />
            )}
            sx={{ width: isMobile ? "100%" : 220 }}
            ListboxProps={{ style: { fontSize: "12px" } }}
          />
          <TextField
            select
            size="small"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            SelectProps={{ native: true }}
            sx={{ width: isMobile ? "calc(50% - 4px)" : 100, ...inputBoxSx }}
          >
            {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            SelectProps={{ native: true }}
            sx={{ width: isMobile ? "calc(50% - 4px)" : 80, ...inputBoxSx }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </TextField>

          {/* 목록/달력 보기 전환 */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              borderRadius: 10,
              backgroundColor: "#eef2f5",
              width: isMobile ? "100%" : "auto",
              boxSizing: "border-box",
            }}
          >
            {[
              { mode: "list", label: "목록 보기", Icon: ViewListOutlinedIcon },
              { mode: "calendar", label: "달력 보기", Icon: CalendarMonthOutlinedIcon },
            ].map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{ ...viewButtonStyle(viewMode === mode), flex: isMobile ? 1 : "0 0 auto", justifyContent: "center" }}
              >
                <Icon sx={{ fontSize: 17, display: "block" }} />
                {label}
              </button>
            ))}
          </div>

          <MDButton
            variant="outlined"
            color="info"
            startIcon={<DownloadIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(e) => setDownloadAnchor(e.currentTarget)}
            sx={{ flex: isMobile ? 1 : "0 0 auto", whiteSpace: "nowrap" }}
          >
            {checkedIds.length ? `선택 ${checkedIds.length}건` : "사진 다운로드"}
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            startIcon={<AddIcon />}
            onClick={openRegister}
            sx={{ flex: isMobile ? 1 : "0 0 auto", whiteSpace: "nowrap" }}
          >
            자료 등록
          </MDButton>
        </div>
      </MDBox>

      {/* 다운로드 자료 종류 선택 메뉴 (체크한 행이 없으면 표시 목록 전체) */}
      <Menu anchorEl={downloadAnchor} open={Boolean(downloadAnchor)} onClose={() => setDownloadAnchor(null)}>
        {DOWNLOAD_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.label}
            onClick={() => handleZipDownload(opt)}
            sx={{ fontSize: "0.85rem", minHeight: "40px !important" }}
          >
            {opt.label} (ZIP)
          </MenuItem>
        ))}
      </Menu>

      {/* 목록·달력 영역 (화면 맨 아래까지 높이 제한, 넘치면 영역 안에서만 스크롤) */}
      <div
        ref={contentAreaRef}
        style={{
          height: contentAreaHeight ?? (isMobile ? "60vh" : "70vh"),
          overflowY: viewMode === "calendar" ? "auto" : "hidden",
        }}
      >
      {viewMode === "calendar" ? (
        <UploadCalendar
          year={year}
          month={month}
          rows={mealRows}
          isMobile={isMobile}
          summaryMode={selectedAccountId === ALL_ACCOUNTS}
          onSelectDate={handleSelectDate}
        />
      ) : (
        // 일자별 자료 목록 카드
        <div style={{ ...cardStyle, overflow: "hidden", height: "100%", boxSizing: "border-box" }}>
          <div style={{ overflow: "auto", height: "100%" }}>
            <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 44 }}>
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={checkedIds.length > 0 && !allChecked}
                      onChange={(e) => setCheckedIds(e.target.checked ? visibleRows.map((row) => row.idx) : [])}
                      sx={{ p: 0 }}
                    />
                  </th>
                  <th style={th}>급식일자</th>
                  <th style={th}>거래처</th>
                  <th style={th}>구분</th>
                  <th style={th}>식단표</th>
                  <th style={th}>식판 사진</th>
                  <th style={th}>등록 상태</th>
                  <th style={{ ...th, textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {/* 조회 중·자료 없음 안내 행 */}
                {(listLoading || visibleRows.length === 0) && (
                  <tr>
                    <td colSpan={8} style={{ ...td, padding: "48px 12px", textAlign: "center", color: "#9aa6b1", fontSize: 13 }}>
                      {listLoading ? (
                        "불러오는 중..."
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: "#b8c3cc" }} />
                          <span>등록된 자료가 없습니다.</span>
                          <span style={{ color: ACCENT, cursor: "pointer" }} onClick={openRegister}>
                            눌러서 자료 등록
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}

                {/* 급식일자·거래처·구분별 자료 행 */}
                {!listLoading &&
                  visibleRows.map((row) => {
                    const d = dayjs(row.meal_date);
                    const done = isDone(row);
                    const checked = checkedIds.includes(row.idx);
                    return (
                      <tr key={row.idx} style={{ backgroundColor: checked ? "#f3f8ff" : "#ffffff" }}>
                        <td style={td}>
                          <Checkbox size="small" checked={checked} onChange={() => toggleChecked(row.idx)} sx={{ p: 0 }} />
                        </td>
                        <td style={td}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{d.format("MM.DD")}</div>
                          <div style={{ fontSize: 11, color: d.day() === 0 ? "#d32f2f" : d.day() === 6 ? ACCENT : SUB }}>
                            {WEEKDAYS[d.day()]}요일
                          </div>
                        </td>
                        <td style={{ ...td, fontSize: 13, fontWeight: 700, color: TEXT }}>{row.account_name}</td>
                        <td style={td}>
                          <Badge label={row.meal_type} {...(MEAL_COLOR[row.meal_type] || { bg: "#eef4fc", fg: ACCENT })} />
                        </td>
                        {FILE_KINDS.map(({ key }) => (
                          <td key={key} style={td}>
                            <FileCell
                              file={fileOf(row, key)}
                              onView={() => openPreview(row, key)}
                              onAdd={() => pickFile(row, key)}
                            />
                          </td>
                        ))}
                        {/* 등록 자료 개수 (모두 등록: 초록, 일부만: 주황) */}
                        <td style={{ ...td, fontSize: 13, fontWeight: 700, color: done ? TONE.done.fg : TONE.missing.fg }}>
                          {countFiles(row)} / {FILE_KINDS.length}개 등록
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              height: 30,
                              padding: "0 6px 0 12px",
                              borderRadius: 999,
                              border: `1px solid ${BORDER}`,
                              backgroundColor: "#ffffff",
                              color: ACCENT,
                              fontSize: 12,
                              lineHeight: 1,
                              cursor: "pointer",
                            }}
                          >
                            수정
                            <ChevronRightIcon sx={{ fontSize: 16, display: "block" }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* 급식자료 등록·수정 모달 */}
      <Dialog
        open={modal.open}
        onClose={closeModal}
        PaperProps={{ sx: { width: "100%", maxWidth: 720, m: 2, borderRadius: "16px" } }}
      >
        {/* 모달 상단 제목·설명·닫기 영역 */}
        <div style={{ display: "flex", alignItems: "flex-start", padding: "22px 24px 16px", borderBottom: "1px solid #eef2f5" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{isEdit ? "급식자료 수정" : "급식자료 등록"}</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
              {isEdit
                ? "교체할 자료만 다시 선택하면 됩니다. 선택하지 않은 자료는 그대로 유지됩니다."
                : "거래처와 급식 일자를 기준으로 식단표와 식판 사진을 한 번에 등록합니다."}
            </div>
          </div>
          <IconButton onClick={closeModal} sx={{ backgroundColor: "#f3f5f8" }} aria-label="닫기">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <DialogContent sx={{ px: 3, py: 2.5 }}>
          {/* 거래처·급식일자·식사 구분 입력 줄 (수정 모달은 고정) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>거래처</div>
              <Autocomplete
                size="small"
                options={accountOptions.filter((o) => o.value !== ALL_ACCOUNTS)}
                value={accountOptions.find((o) => o.value === String(form.account_id)) || null}
                onChange={(_, opt) => setFormValue("account_id", opt?.value || "")}
                getOptionLabel={(opt) => opt?.label ?? ""}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                disabled={isAccountLocked || isEdit}
                renderInput={(params) => <TextField {...params} placeholder="거래처 선택" sx={inputBoxSx} />}
                ListboxProps={{ style: { fontSize: "12px" } }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>급식 일자</div>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={form.meal_date || ""}
                onChange={(e) => setFormValue("meal_date", e.target.value)}
                disabled={isEdit}
                sx={inputBoxSx}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>식사 구분</div>
              <SelectAutocomplete
                options={MEAL_OPTIONS}
                value={form.meal_type || ""}
                onChange={(v) => setFormValue("meal_type", v)}
                disabled={isEdit}
              />
            </div>
          </div>

          {/* 첨부자료 카드 영역 (식단표·식판 사진) */}
          <div style={{ marginTop: 22, marginBottom: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>첨부자료</span>
            <span style={{ fontSize: 12, color: "#9aa6b1" }}>· 필요한 항목만 선택하셔도 됩니다.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            {FILE_KINDS.map((kind, i) => (
              <FileDropCard
                key={kind.key}
                index={["①", "②"][i]}
                kind={kind}
                file={form[kind.key]}
                existing={isEdit ? fileOf(modal.row, kind.key) : null}
                onSelect={(file) => setFormValue(kind.key, file)}
                onView={isEdit ? () => openPreview(modal.row, kind.key) : undefined}
                onDownload={
                  isEdit
                    ? () => triggerDownload(buildFileDownloadUrl(fileOf(modal.row, kind.key).path), buildFileName(modal.row, kind.key))
                    : undefined
                }
              />
            ))}
          </div>

          {/* 저장 방식 안내 박스 */}
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 8,
              backgroundColor: "#eaf5fa",
              display: "flex",
              gap: 8,
              fontSize: 12,
              lineHeight: 1.6,
              color: "#3b5568",
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16, color: "#1687b2", mt: "2px" }} />
            <span>
              {isEdit
                ? "선택한 파일만 교체되고, 선택하지 않은 기존 파일은 그대로 유지됩니다."
                : "같은 거래처·급식 일자·식사 구분으로 이미 등록된 자료가 있으면 새로 등록할 수 없습니다. 목록에서 [수정]으로 변경해 주세요."}
            </span>
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #eef2f5" }}>
          <MDButton variant="outlined" color="secondary" onClick={closeModal}>
            취소
          </MDButton>
          <MDButton variant="gradient" color="info" startIcon={<CloudUploadOutlinedIcon />} onClick={handleModalSave}>
            자료 저장
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* 본사 다운로드 범위 선택 팝업 (전체 거래처 또는 거래처 1곳) */}
      <Dialog
        open={scopeDialog.open}
        onClose={() => closeScopeDialog(null)}
        PaperProps={{ sx: { width: "100%", maxWidth: 420, m: 2, borderRadius: "16px" } }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", padding: "20px 22px 12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{scopeDialog.label} 다운로드</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
              {year}년 {month}월 자료를 받을 거래처를 선택해 주세요.
            </div>
          </div>
          <IconButton onClick={() => closeScopeDialog(null)} sx={{ backgroundColor: "#f3f5f8" }} aria-label="닫기">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <DialogContent sx={{ px: "22px", pt: 1, pb: 1 }}>
          <Autocomplete
            size="small"
            options={accountOptions}
            value={accountOptions.find((o) => o.value === scopeDialog.accountId) || null}
            onChange={(_, opt) => opt && setScopeDialog((d) => ({ ...d, accountId: opt.value }))}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            disableClearable
            renderInput={(params) => (
              <TextField {...params} label="거래처" placeholder="거래처명을 입력" sx={{ ...inputBoxSx, ...accountLabelSx }} />
            )}
            ListboxProps={{ style: { fontSize: "12px" } }}
            sx={{ mt: 1 }}
          />
          {/* 다운로드 기간 (선택 월 안에서 시작일 ~ 종료일) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <TextField
              type="date"
              size="small"
              label="시작일"
              value={scopeDialog.startDate}
              onChange={(e) => setScopeDialog((d) => ({ ...d, startDate: e.target.value }))}
              inputProps={{ min: monthStart, max: scopeDialog.endDate || monthEnd }}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, ...inputBoxSx, ...accountLabelSx }}
            />
            <span style={{ color: SUB }}>~</span>
            <TextField
              type="date"
              size="small"
              label="종료일"
              value={scopeDialog.endDate}
              onChange={(e) => setScopeDialog((d) => ({ ...d, endDate: e.target.value }))}
              inputProps={{ min: scopeDialog.startDate || monthStart, max: monthEnd }}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, ...inputBoxSx, ...accountLabelSx }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#9aa6b1", marginTop: 8, lineHeight: 1.6 }}>
            압축 파일 안에 식단표·식판사진 폴더로 나뉘어 담기며, 전체 거래처는 거래처별 폴더 아래에 나뉩니다.
          </div>
        </DialogContent>
        <DialogActions sx={{ px: "22px", pb: 2.5 }}>
          <MDButton variant="outlined" color="secondary" onClick={() => closeScopeDialog(null)}>
            취소
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            startIcon={<DownloadIcon />}
            onClick={() => {
              const { accountId, startDate, endDate } = scopeDialog;
              if (!startDate || !endDate || startDate > endDate) {
                Swal.fire("기간을 확인해 주세요.", "시작일이 종료일보다 늦을 수 없습니다.", "warning");
                return;
              }
              closeScopeDialog({ accountId, startDate, endDate });
            }}
          >
            다운로드
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* 표 미등록 칸 추가 버튼용 숨김 파일 입력 */}
      <input ref={fileInputRef} hidden type="file" onChange={handlePickedFile} />

      {/* 자료 확대 미리보기 */}
      <PreviewOverlay
        open={Boolean(previewFiles)}
        files={previewFiles || []}
        currentIndex={0}
        onClose={() => setPreviewFiles(null)}
        anchorX={1 / 2}
      />
    </MDBox>
  );
}

BranchUploadTab.propTypes = { isHeadOffice: PropTypes.bool };
BranchUploadTab.defaultProps = { isHeadOffice: false };

export default BranchUploadTab;
