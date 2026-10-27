// 지점업로드 탭: 거래처별 주차(월~일)마다 주간 식단표 1장과 요일별 식판 사진을 올리고 내려받는 화면 (목록 보기 / 달력 보기)
// 조회·업로드·저장 API와 주차·자료 판별 헬퍼는 branchUploadData.js에서 처리
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
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
import { LockedSwal as Swal, showSwalLoading, updateSwalLoading } from "utils/swalLoading";
import useBranchUploadData, {
  WEEK_DAY_LABELS,
  FILE_KINDS,
  ALL_ACCOUNTS,
  DOWNLOAD_OPTIONS,
  mondayOf,
  monthWeeks,
  fileOf,
  previewKindOf,
  groupWeekRows,
  weekRowsOf,
  buildFileName,
  fetchFileBlob,
} from "./branchUploadData";
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

// 문서 썸네일 아이콘·색 (PDF: 빨강, 엑셀: 초록)
const DOC_THUMB = {
  pdf: { Icon: PictureAsPdfOutlinedIcon, bg: "#fdecea", fg: "#c62828" },
  excel: { Icon: GridOnOutlinedIcon, bg: "#e8f5e9", fg: "#1e7b45" },
};

// 자료 썸네일 (사진은 축소 미리보기, PDF·엑셀은 문서 아이콘 / value: 서버 경로 또는 새로 고른 File)
function FileThumb({ value, width, height, onView }) {
  const doc = DOC_THUMB[previewKindOf(value)];
  return (
    <div style={{ width, flexShrink: 0 }}>
      {doc ? (
        <div
          onClick={onView}
          style={{
            height,
            borderRadius: 8,
            backgroundColor: doc.bg,
            color: doc.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: onView ? "zoom-in" : "default",
          }}
        >
          <doc.Icon sx={{ fontSize: Math.round(height * 0.5) }} />
        </div>
      ) : (
        <PhotoThumb value={value} height={height} onView={() => onView && onView()} />
      )}
    </div>
  );
}

// 목록 표의 식단표/식판 사진 칸 (등록됨: 썸네일·등록 시각, 미등록: 점선 추가 버튼)
// compact: 요일별 식판 사진 칸 (썸네일·작은 + 버튼만 표시)
function FileCell({ file, onView, onAdd, compact }) {
  if (compact) {
    return file ? (
      <FileThumb value={file.path} width={56} height={42} onView={onView} />
    ) : (
      <button
        type="button"
        onClick={onAdd}
        title="식판 사진 추가"
        style={{
          width: 56,
          height: 42,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #c9d5df",
          borderRadius: 8,
          backgroundColor: "#f8fafb",
          color: "#9aa6b1",
          cursor: onAdd ? "pointer" : "default",
        }}
      >
        <AddIcon sx={{ fontSize: 18, display: "block" }} />
      </button>
    );
  }
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
// compact: 요일별 식판 사진 카드 (작은 크기, 안내 문구 생략)
// deleted: 기존 파일 삭제 예정 여부, onDelete(true|false): 기존 파일 삭제 표시·되돌리기 (수정 모달)
function FileDropCard({ index, kind, file, existing, onSelect, onView, onDownload, onDelete, deleted, compact }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const { label, hint, accept } = kind;
  const Icon = KIND_ICON[kind.key];
  // 화면에 보여줄 파일 (새로 고른 파일 → 삭제 예정이 아닌 기존 파일)
  const current = file || (!deleted && existing?.path);
  // 카드 안 작은 버튼 스타일 (다운로드·삭제·되돌리기)
  const miniButton = { ...chipStyle(false), height: 24, padding: "0 8px", fontSize: 11 };

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
        minHeight: compact ? 118 : 168,
        padding: compact ? 10 : 14,
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
            <FileThumb value={current} width={compact ? 96 : 120} height={compact ? 60 : 78} />
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
                title="다운로드"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                style={miniButton}
              >
                <DownloadIcon sx={{ fontSize: 14, display: "block" }} />
                {!compact && "다운로드"}
              </button>
            )}
            {/* 기존 파일 삭제 표시 (저장할 때 삭제) */}
            {!file && onDelete && (
              <button
                type="button"
                title="삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(true);
                }}
                style={{ ...miniButton, color: "#c62828", borderColor: "#f3c4c4", backgroundColor: "#fff5f5" }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 14, display: "block" }} />
                {!compact && "삭제"}
              </button>
            )}
          </div>
          {!compact && <div style={{ fontSize: 11, color: "#9aa6b1" }}>클릭 또는 파일 드래그로 교체</div>}
        </>
      ) : (
        // 파일 선택 전 안내 (기존 파일을 삭제 표시했으면 삭제 예정 배지와 되돌리기 버튼)
        <>
          <Icon sx={{ fontSize: compact ? 22 : 30, color: "#8aa0b4" }} />
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: TEXT }}>
            {index} {label}
          </div>
          {deleted && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Badge label="삭제 예정" bg="#fdecea" fg="#c62828" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(false);
                }}
                style={miniButton}
              >
                되돌리기
              </button>
            </div>
          )}
          <div style={{ fontSize: compact ? 11 : 12, color: "#9aa6b1", lineHeight: 1.6 }}>
            {compact ? "클릭 · 드래그" : hint}
            {!compact && (
              <>
                <br />
                클릭 또는 파일 드래그
              </>
            )}
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

// 달력 보기 (월~일 주차 단위, 월 경계 주의 다른 달 날짜는 흐리게 표시, 날짜 클릭 시 해당 주차 목록으로 이동)
// 각 날짜: 식판 사진 등록 여부, 월요일 칸: 주간 식단표 등록 여부도 함께 표시
// summaryMode: 전체 거래처 조회 여부 (등록 여부 대신 등록한 거래처 수 표시)
function UploadCalendar({ year, month, weeks, rows, isMobile, summaryMode, onSelectWeek }) {
  const todayStr = dayjs().format("YYYY-MM-DD");
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  // 날짜별 행 묶음
  const rowsByDate = rows.reduce((acc, row) => {
    (acc[row.meal_date] = acc[row.meal_date] || []).push(row);
    return acc;
  }, {});

  // 칸 안의 자료 상태 한 줄 (등록: 자료 색, 미등록: 회색 / 전체 거래처: 등록 거래처 수)
  const statusLine = (kindKey, label, dayRows) => {
    const count = dayRows.filter((row) => fileOf(row, kindKey)).length;
    const on = count > 0;
    return (
      <div
        key={kindKey}
        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, lineHeight: 1, whiteSpace: "nowrap" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, backgroundColor: on ? KIND_COLOR[kindKey] : EMPTY_BAR }} />
        <span style={{ color: on ? TEXT : "#9aa6b1", fontWeight: on ? 700 : 500 }}>
          {label}
          {summaryMode ? ` ${count}곳` : on ? "" : " 미등록"}
        </span>
      </div>
    );
  };

  return (
    // 달력 카드 (영역 높이를 꽉 채우고, 주차 줄은 주 수에 맞춰 남은 높이를 나눠 가짐)
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
      {/* 달력 제목과 자료 색 범례 */}
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
          gridTemplateColumns: `${isMobile ? 36 : 64}px repeat(7, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${weeks.length}, minmax(${isMobile ? 64 : 80}px, 1fr))`,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* 요일 머리 줄 (맨 앞은 주차 칸) */}
        {["주차", ...WEEK_DAY_LABELS].map((w, i) => (
          <div
            key={w}
            style={{
              padding: "9px 0",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: "#f5f8fa",
              color: i === 7 ? "#d32f2f" : i === 6 ? ACCENT : "#5b6b7c",
              borderBottom: `1px solid ${BORDER}`,
              borderRight: i < 7 ? `1px solid ${BORDER}` : "none",
            }}
          >
            {w}
          </div>
        ))}

        {/* 주차 줄 (주차 칸 + 월~일 날짜 칸, 누르면 그 주차 목록으로 이동) */}
        {weeks.map((week, wi) => {
          const lastRow = wi === weeks.length - 1;
          const cellBorder = (ci) => ({
            borderRight: ci < 7 ? `1px solid ${BORDER}` : "none",
            borderBottom: lastRow ? "none" : `1px solid ${BORDER}`,
          });
          return (
            <React.Fragment key={week.start}>
              <div
                onClick={() => onSelectWeek(week.start)}
                style={{
                  ...cellBorder(0),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: SUB,
                  backgroundColor: "#fafbfc",
                  cursor: "pointer",
                }}
              >
                {week.no}주
              </div>
              {week.dates.map((date, di) => {
                const d = dayjs(date);
                const inMonth = date.startsWith(monthKey);
                const dayRows = rowsByDate[date] || [];
                const isToday = date === todayStr;
                return (
                  <div
                    key={date}
                    onClick={() => onSelectWeek(week.start)}
                    style={{
                      ...cellBorder(di + 1),
                      padding: isMobile ? 6 : 10,
                      boxSizing: "border-box",
                      backgroundColor: inMonth ? "#ffffff" : "#fafbfc",
                      opacity: inMonth ? 1 : 0.6,
                      cursor: "pointer",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 24,
                        height: 24,
                        padding: "0 4px",
                        boxSizing: "border-box",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1,
                        backgroundColor: isToday ? ACCENT : "transparent",
                        color: isToday ? "#ffffff" : di === 6 ? "#d32f2f" : di === 5 ? ACCENT : "#5b6b7c",
                      }}
                    >
                      {inMonth ? d.date() : d.format("M/D")}
                    </span>
                    {/* 월요일 칸: 주간 식단표 상태 */}
                    {di === 0 && statusLine("menu", isMobile ? "식단" : "식단표", dayRows)}
                    {/* 날짜별 식판 사진 상태 */}
                    {statusLine("plate", isMobile ? "식판" : "식판 사진", dayRows)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: SUB, marginTop: 10 }}>
        날짜나 주차를 선택하면 해당 주차의 거래처별 상세 목록을 확인할 수 있습니다.
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
FileCell.propTypes = { file: fileShape, onView: PropTypes.func, onAdd: PropTypes.func, compact: PropTypes.bool };
FileDropCard.propTypes = {
  index: PropTypes.string,
  kind: PropTypes.object.isRequired,
  file: PropTypes.object,
  existing: fileShape,
  onSelect: PropTypes.func.isRequired,
  onView: PropTypes.func,
  onDownload: PropTypes.func,
  onDelete: PropTypes.func,
  deleted: PropTypes.bool,
  compact: PropTypes.bool,
};
UploadCalendar.propTypes = {
  summaryMode: PropTypes.bool,
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired,
  weeks: PropTypes.arrayOf(PropTypes.object).isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  isMobile: PropTypes.bool,
  onSelectWeek: PropTypes.func.isRequired,
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
    findWeekRows,
    saveBranchUpload,
    saveWeekUpload,
  } = useBranchUploadData(isHeadOffice);

  // 조회 조건: 거래처(전체/단일), 연도, 월
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || ALL_ACCOUNTS);
  const [accountInput, setAccountInput] = useState("");
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  // 목록 필터: 고른 주차의 월요일 날짜 ("": 전체 주차)
  const [selectedWeek, setSelectedWeek] = useState("");
  // 화면 보기 방식 (list: 목록, calendar: 달력)
  const [viewMode, setViewMode] = useState("list");

  // 다운로드용으로 체크한 거래처·주차 줄 key 목록
  const [checkedKeys, setCheckedKeys] = useState([]);
  // 다운로드 메뉴 기준 버튼
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  // 다운로드 범위 선택 팝업 (label: 다운로드 종류, accountId: 고른 거래처)과 선택 결과 전달 함수
  // startDate·endDate: 다운로드 기간 (YYYY-MM-DD, 달과 상관없이 자유롭게 선택)
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

  // 등록·수정 모달 (mode: register | edit, item: 수정 대상 거래처·주차 묶음)
  // form: 거래처, 주 시작 월요일, 새로 고른 식단표 파일, 날짜별 새로 고른 식판 사진 { 날짜: File }
  const [modal, setModal] = useState({ open: false, mode: "register", item: null, form: { plates: {} } });

  // 목록·달력 영역 ref와 화면 맨 아래까지 채우는 높이
  // (아래 여백: 현장 탭 안쪽 패딩 기준 32px, 본사 화면은 카드·페이지 패딩까지 56px)
  const [contentAreaRef, contentAreaHeight] = useFillViewportHeight(isHeadOffice ? 56 : 32);

  // 표의 미등록 칸 추가 버튼이 쓰는 숨김 파일 입력과 대상 (행, 자료 종류)
  const fileInputRef = useRef(null);
  const pickTargetRef = useRef(null);

  // 선택 연월의 주차 목록과 조회 기간 (그 달 첫 월요일 ~ 마지막 주 일요일, 다음 달 날짜 포함 가능)
  const weeks = useMemo(() => monthWeeks(year, month), [year, month]);
  const rangeStart = weeks[0].start;
  const rangeEnd = weeks[weeks.length - 1].end;

  // 선택 연월(주차 포함 기간)·거래처의 자료 목록 조회
  const fetchList = useCallback(
    () =>
      fetchBranchUploadList({
        start_date: rangeStart,
        end_date: rangeEnd,
        account_id: selectedAccountId === ALL_ACCOUNTS ? "" : selectedAccountId,
      }),
    [rangeStart, rangeEnd, selectedAccountId, fetchBranchUploadList]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 조회 조건이 바뀌면 체크·선택 주차 해제
  useEffect(() => {
    setCheckedKeys([]);
    setSelectedWeek("");
  }, [year, month, selectedAccountId]);

  // 거래처 검색 선택 옵션 (고정 사용자가 아니면 맨 앞에 전체 거래처)
  const accountOptions = useMemo(() => {
    const list = accountList.map((acc) => ({ value: String(acc.account_id), label: acc.account_name }));
    return isAccountLocked ? list : [{ value: ALL_ACCOUNTS, label: "전체 거래처" }, ...list];
  }, [accountList, isAccountLocked]);

  // 거래처·주차 단위 목록 (단일 거래처는 자료가 없는 주차도 줄을 만들어 바로 올릴 수 있게 표시)
  const weekItems = useMemo(() => {
    const names = Object.fromEntries(accountList.map((acc) => [String(acc.account_id), acc.account_name]));
    const ids = selectedAccountId === ALL_ACCOUNTS ? [] : [String(selectedAccountId)];
    return groupWeekRows(rows, weeks, ids, names);
  }, [rows, weeks, accountList, selectedAccountId]);
  // 목록 표시 줄 (주차 필터가 있으면 그 주차만)
  const visibleItems = useMemo(
    () => (selectedWeek ? weekItems.filter((item) => item.week.start === selectedWeek) : weekItems),
    [weekItems, selectedWeek]
  );

  const allChecked = visibleItems.length > 0 && visibleItems.every((item) => checkedKeys.includes(item.key));

  // 거래처·일자 1건의 자료를 올리고 저장한 뒤 목록 다시 조회 (files: { menu?: File, plate?: File })
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

  // 표의 미등록 칸 추가 버튼: 파일 선택창 열기 (target: { account_id, meal_date }, kind: menu | plate)
  const pickFile = (target, kind) => {
    pickTargetRef.current = { target, kind };
    fileInputRef.current.value = "";
    fileInputRef.current.accept = FILE_KINDS.find((k) => k.key === kind).accept;
    fileInputRef.current.click();
  };

  // 숨김 파일 입력에서 파일을 고른 뒤 대상 일자의 해당 자료만 저장
  const handlePickedFile = (e) => {
    const file = e.target.files?.[0];
    const picked = pickTargetRef.current;
    if (file && picked) saveUpload(picked.target, { [picked.kind]: file });
  };

  // 등록 모달 열기 (연월은 화면 조회 연월, 주차는 선택 주차 → 오늘이 속한 주차 → 첫 주차 순, 거래처는 현재 선택 거래처)
  const openRegister = () => {
    const todayWeek = weeks.find((w) => w.start === mondayOf(today));
    setModal({
      open: true,
      mode: "register",
      item: null,
      form: {
        account_id: selectedAccountId === ALL_ACCOUNTS ? "" : selectedAccountId,
        year,
        month,
        week_start: selectedWeek || todayWeek?.start || weeks[0].start,
        menu: null,
        plates: {},
      },
    });
  };

  // 수정 모달 열기 (거래처·주차는 고정, 파일만 교체·추가)
  const openEdit = (item) =>
    setModal({
      open: true,
      mode: "edit",
      item,
      form: { account_id: String(item.account_id), year, month, week_start: item.week.start, menu: null, plates: {} },
    });

  // 등록 모달 연·월 변경 (주차는 바뀐 달의 첫 주차로, 고른 식판 사진은 날짜가 달라지므로 비움)
  const setFormYearMonth = (key, value) =>
    setModal((m) => {
      const next = { ...m.form, [key]: value };
      return { ...m, form: { ...next, week_start: monthWeeks(next.year, next.month)[0].start, plates: {} } };
    });

  const closeModal = () => setModal((m) => ({ ...m, open: false }));
  const setFormValue = (key, value) => setModal((m) => ({ ...m, form: { ...m.form, [key]: value } }));
  // 요일 식판 사진 선택 (새 파일을 고르면 그 날짜 삭제 표시는 해제)
  const setPlateFile = (date, file) =>
    setModal((m) => ({
      ...m,
      form: {
        ...m.form,
        plates: { ...m.form.plates, [date]: file },
        deletePlates: { ...m.form.deletePlates, [date]: false },
      },
    }));
  // 요일 식판 사진 기존 파일 삭제 표시·되돌리기
  const setPlateDelete = (date, on) =>
    setModal((m) => ({ ...m, form: { ...m.form, deletePlates: { ...m.form.deletePlates, [date]: on } } }));

  // 거래처·주차 1개의 자료를 일자별로 저장한 뒤 목록 다시 조회
  const saveWeek = async (form) => {
    showSwalLoading("업로드 중...");
    try {
      await saveWeekUpload(form);
      await fetchList();
      Swal.fire({ title: "저장 완료", icon: "success", timer: 900, showConfirmButton: false });
      return true;
    } catch (err) {
      console.error("지점업로드 저장 실패:", err);
      Swal.fire("업로드 실패", err?.message || "잠시 후 다시 시도해 주세요.", "error");
      return false;
    }
  };

  // 등록·수정 모달 저장 (등록은 이미 자료가 있는 주차면 막고 수정으로 안내, 수정은 선택한 파일만 교체)
  const handleModalSave = async () => {
    const { form, mode } = modal;
    if (!form.account_id) return Swal.fire("거래처를 선택해 주세요.", "", "warning");
    if (!form.week_start) return Swal.fire("주차를 선택해 주세요.", "", "warning");
    const hasDelete = !!form.deleteMenu || Object.values(form.deletePlates || {}).some(Boolean);
    if (!form.menu && !Object.values(form.plates).some(Boolean) && !hasDelete) {
      return Swal.fire(mode === "edit" ? "교체하거나 삭제할 파일을 선택해 주세요." : "식단표나 식판 사진 중 하나 이상 올려 주세요.", "", "warning");
    }
    // 삭제 표시가 있으면 한 번 더 확인
    if (hasDelete) {
      const confirm = await Swal.fire({
        title: "파일을 삭제할까요?",
        text: "삭제 표시한 파일은 저장하면 목록에서 사라집니다.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "저장",
        cancelButtonText: "취소",
      });
      if (!confirm.isConfirmed) return null;
    }

    if (mode === "register") {
      let existingRows;
      try {
        existingRows = await findWeekRows(form);
      } catch (err) {
        return Swal.fire("확인 실패", "기존 등록 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      }
      if (existingRows.some((row) => fileOf(row, "menu") || fileOf(row, "plate"))) {
        const week = monthWeeks(form.year, form.month).find((w) => w.start === form.week_start);
        const result = await Swal.fire({
          title: "이미 등록된 주차입니다",
          html: `${dayjs(week.start).format("MM.DD")} ~ ${dayjs(week.end).format("MM.DD")} 주차 자료가 이미 등록되어 있습니다.<br/>새로 등록하지 말고 <b>수정</b>으로 변경해 주세요.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "수정하기",
          cancelButtonText: "닫기",
        });
        // 수정하기: 기존 주차 수정 모달로 전환 (방금 고른 파일은 그대로 유지)
        if (result.isConfirmed) {
          setModal({
            open: true,
            mode: "edit",
            item: groupWeekRows(existingRows, [week])[0],
            form,
          });
        }
        return null;
      }
    }

    closeModal();
    const ok = await saveWeek(form);
    if (!ok) {
      setModal((m) => ({ ...m, open: true }));
      return null;
    }
    // 등록한 연월로 화면 조회 조건 이동
    setYear(form.year);
    setMonth(form.month);
    return null;
  };

  // 다운로드 범위 선택 팝업 닫기 (value: { accountId, startDate, endDate }, 취소면 null)
  const closeScopeDialog = (value) => {
    setScopeDialog((d) => ({ ...d, open: false }));
    if (scopeResolveRef.current) scopeResolveRef.current(value);
    scopeResolveRef.current = null;
  };

  // 다운로드 범위 선택 (거래처: 전체 또는 1곳, 기간: 시작일 ~ 종료일) 후 해당 자료 조회, 취소하면 null
  // 기본 기간은 선택 주차가 있으면 그 주차, 없으면 화면 조회 월의 주차 전체
  // 식단표는 그 주 월요일 행에 있으므로 시작일이 속한 주 월요일부터 조회 (기간에 걸친 주의 식단표 포함)
  const askDownloadScope = async (optionLabel) => {
    const week = weeks.find((w) => w.start === selectedWeek);
    const value = await new Promise((resolve) => {
      scopeResolveRef.current = resolve;
      setScopeDialog({
        open: true,
        label: optionLabel,
        accountId: String(selectedAccountId),
        startDate: week?.start || rangeStart,
        endDate: week?.end || rangeEnd,
      });
    });
    if (!value) return null;

    showSwalLoading("자료 조회 중...", `${value.startDate} ~ ${value.endDate}`);
    const list = await fetchBranchUploadRows({
      start_date: mondayOf(value.startDate),
      end_date: value.endDate,
      account_id: value.accountId === ALL_ACCOUNTS ? "" : value.accountId,
    });
    return { rows: list, allAccounts: value.accountId === ALL_ACCOUNTS, startDate: value.startDate, endDate: value.endDate };
  };

  // 지정 자료를 ZIP으로 내려받는 함수
  // 체크한 줄이 있으면 그 줄만, 없으면 거래처·기간(시작일 ~ 종료일) 선택 후 해당 자료
  // 진행 상황: 조회 중 → 파일 받는 중 (n / 전체) → 압축 중 (%) → 완료 알림
  const handleZipDownload = async ({ label, kinds }) => {
    setDownloadAnchor(null);
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    let targets = visibleItems.filter((item) => checkedKeys.includes(item.key)).flatMap(weekRowsOf);
    // 전체 거래처 묶음이면 거래처별 폴더로 나눠 담음
    let byAccountFolder = false;
    // ZIP 파일명 기간 표시
    let periodLabel = ym;
    // 식판 사진 시작일 (기간 선택 시, 시작일 이전 같은 주 식판 사진은 제외)
    let plateFrom = "";
    if (checkedKeys.length === 0) {
      try {
        const scope = await askDownloadScope(label);
        if (!scope) return;
        targets = scope.rows;
        byAccountFolder = scope.allAccounts;
        periodLabel = scope.startDate === scope.endDate ? scope.startDate : `${scope.startDate}~${scope.endDate}`;
        plateFrom = scope.startDate;
      } catch (err) {
        Swal.fire("조회 실패", "다운로드할 자료를 불러오지 못했습니다.", "error");
        return;
      }
    }
    const jobs = targets.flatMap((row) =>
      kinds
        .filter((kind) => fileOf(row, kind) && !(kind === "plate" && row.meal_date < plateFrom))
        .map((kind) => ({ row, kind }))
    );
    if (jobs.length === 0) {
      Swal.fire("내려받을 자료가 없습니다.", "선택한 기간에 등록된 자료가 없습니다.", "info");
      return;
    }

    showSwalLoading("사진 받는 중...", `0 / ${jobs.length}개 파일`);
    const zip = new JSZip();
    let failed = 0;
    let done = 0;
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
      done += 1;
      updateSwalLoading(`${done} / ${jobs.length}개 파일`);
    }

    try {
      Swal.update({ title: "압축 파일 만드는 중..." });
      updateSwalLoading("0%");
      const blob = await zip.generateAsync({ type: "blob" }, (meta) => updateSwalLoading(`${Math.floor(meta.percent)}%`));
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `지점업로드_${periodLabel}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      Swal.fire("다운로드 실패", "압축 파일을 만들지 못했습니다.", "error");
      return;
    }
    if (failed) {
      Swal.fire("일부 파일 누락", `${jobs.length - failed}개 파일을 받았고, ${failed}개 파일은 받지 못했습니다.`, "warning");
    } else {
      Swal.fire({ title: "다운로드 완료", text: `${jobs.length}개 파일`, icon: "success", timer: 1200, showConfirmButton: false });
    }
  };

  // 자료 하나를 확대 미리보기로 여는 함수
  const openPreview = (row, kind) => {
    const { path, name } = fileOf(row, kind);
    setPreviewFiles([{ url: `${API_BASE_URL}${path}`, name: name || path.split("/").pop(), kind: previewKindOf(path) }]);
  };

  // 달력에서 날짜·주차를 고르면 그 주차 목록으로 이동
  const handleSelectWeek = (weekStart) => {
    setSelectedWeek(weekStart);
    setCheckedKeys([]);
    setViewMode("list");
  };

  const toggleChecked = (key) =>
    setCheckedKeys((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));

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
  // 표 머리 2줄 높이 고정 (아랫줄 요일 머리가 윗줄 바로 아래에 붙어 고정되도록)
  const TH_ROW_HEIGHT = 38;
  const thRow = { height: TH_ROW_HEIGHT, boxSizing: "border-box", paddingTop: 0, paddingBottom: 0 };
  const thTall = { height: TH_ROW_HEIGHT * 2, boxSizing: "border-box", paddingTop: 0, paddingBottom: 0 };
  const td = { padding: "12px", borderBottom: "1px solid #eef2f5", verticalAlign: "middle" };

  const { form } = modal;
  const isEdit = modal.mode === "edit";
  // 모달 연월의 주차 목록과 모달에서 다루는 주차 (수정: 대상 묶음의 주차, 등록: 고른 주차)
  const modalWeeks = form.year ? monthWeeks(form.year, form.month) : weeks;
  const modalWeek = isEdit ? modal.item?.week : modalWeeks.find((w) => w.start === form.week_start);

  return (
    <MDBox>
      {/* 상단 주차 필터·조회 조건·보기 전환·다운로드/등록 버튼 영역 */}
      {/* 넓은 화면은 한 줄, 좁아지면 [주차 칩] / [조회 조건·버튼] 두 묶음으로 줄바꿈, 모바일은 칸이 폭을 나눠 사용 */}
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
        {/* 목록 필터 칩 (전체, 달력에서 주차를 고르면 해당 주차 칩 표시) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            flex: isMobile ? "1 1 100%" : "1 1 auto",
          }}
        >
          <button type="button" onClick={() => setSelectedWeek("")} style={chipStyle(!selectedWeek)}>
            전체
          </button>
          {/* 달력에서 고른 주차 (누르면 해제) */}
          {selectedWeek && (
            <button
              type="button"
              onClick={() => setSelectedWeek("")}
              style={{ ...chipStyle(false), borderColor: ACCENT, color: ACCENT, fontWeight: 700 }}
            >
              {weeks.find((w) => w.start === selectedWeek)?.no}주차만 보기
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
            {checkedKeys.length ? `선택 ${checkedKeys.length}주` : "사진 다운로드"}
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
          weeks={weeks}
          rows={rows}
          isMobile={isMobile}
          summaryMode={selectedAccountId === ALL_ACCOUNTS}
          onSelectWeek={handleSelectWeek}
        />
      ) : (
        // 거래처·주차별 자료 목록 카드 (식단표 1칸 + 월~일 식판 사진 7칸)
        <div style={{ ...cardStyle, overflow: "hidden", height: "100%", boxSizing: "border-box" }}>
          <div style={{ overflow: "auto", height: "100%" }}>
            <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
              {/* 표 머리 2줄 (윗줄: 항목명과 "식판 사진" 묶음 제목, 아랫줄: 식판 사진 요일) */}
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...th, ...thTall, width: 44 }}>
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={checkedKeys.length > 0 && !allChecked}
                      onChange={(e) => setCheckedKeys(e.target.checked ? visibleItems.map((item) => item.key) : [])}
                      sx={{ p: 0 }}
                    />
                  </th>
                  <th rowSpan={2} style={{ ...th, ...thTall }}>주차</th>
                  <th rowSpan={2} style={{ ...th, ...thTall }}>거래처</th>
                  <th rowSpan={2} style={{ ...th, ...thTall }}>주간 식단표</th>
                  <th
                    colSpan={WEEK_DAY_LABELS.length}
                    style={{ ...th, ...thRow, textAlign: "center", borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}
                  >
                    식판 사진
                  </th>
                  <th rowSpan={2} style={{ ...th, ...thTall, textAlign: "center" }}>관리</th>
                </tr>
                <tr>
                  {WEEK_DAY_LABELS.map((w, i) => (
                    <th
                      key={w}
                      style={{
                        ...th,
                        ...thRow,
                        top: TH_ROW_HEIGHT,
                        textAlign: "center",
                        color: i === 6 ? "#d32f2f" : i === 5 ? ACCENT : th.color,
                        borderLeft: `1px solid ${BORDER}`,
                        borderRight: i === 6 ? `1px solid ${BORDER}` : "none",
                      }}
                    >
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 조회 중·자료 없음 안내 행 */}
                {(listLoading || visibleItems.length === 0) && (
                  <tr>
                    <td colSpan={12} style={{ ...td, padding: "48px 12px", textAlign: "center", color: "#9aa6b1", fontSize: 13 }}>
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

                {/* 거래처·주차별 자료 줄 */}
                {!listLoading &&
                  visibleItems.map((item) => {
                    const { week } = item;
                    const checked = checkedKeys.includes(item.key);
                    return (
                      <tr key={item.key} style={{ backgroundColor: checked ? "#f3f8ff" : "#ffffff" }}>
                        <td style={td}>
                          <Checkbox size="small" checked={checked} onChange={() => toggleChecked(item.key)} sx={{ p: 0 }} />
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          {/* 주차 표시 (월요일이 속한 달 기준 "N월 N주차") */}
                          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                            {dayjs(week.start).month() + 1}월 {week.no}주차
                          </div>
                          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
                            {dayjs(week.start).format("MM.DD")} ~ {dayjs(week.end).format("MM.DD")}
                          </div>
                        </td>
                        <td style={{ ...td, fontSize: 13, fontWeight: 700, color: TEXT }}>{item.account_name}</td>
                        {/* 주간 식단표 (그 주 월요일 행에 저장) */}
                        <td style={td}>
                          <FileCell
                            file={fileOf(item.menuRow, "menu")}
                            onView={() => openPreview(item.menuRow, "menu")}
                            onAdd={() => pickFile({ account_id: item.account_id, meal_date: week.start }, "menu")}
                          />
                        </td>
                        {/* 월~일 식판 사진 (칸 아래 날짜) */}
                        {week.dates.map((date, di) => {
                          const row = item.dayRows[date];
                          return (
                            <td
                              key={date}
                              style={{
                                ...td,
                                padding: "10px 6px",
                                textAlign: "center",
                                // 요일 칸 사이 세로 구분선
                                borderLeft: `1px solid ${BORDER}`,
                                borderRight: di === 6 ? `1px solid ${BORDER}` : "none",
                              }}
                            >
                              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <FileCell
                                  compact
                                  file={fileOf(row, "plate")}
                                  onView={() => openPreview(row, "plate")}
                                  onAdd={() => pickFile({ account_id: item.account_id, meal_date: date }, "plate")}
                                />
                                <span style={{ fontSize: 11, lineHeight: 1, color: SUB }}>{dayjs(date).format("MM.DD")}</span>
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ ...td, textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
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
                              whiteSpace: "nowrap",
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
        PaperProps={{ sx: { width: "100%", maxWidth: 760, m: 2, borderRadius: "16px" } }}
      >
        {/* 모달 상단 제목·설명·닫기 영역 */}
        <div style={{ display: "flex", alignItems: "flex-start", padding: "22px 24px 16px", borderBottom: "1px solid #eef2f5" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{isEdit ? "급식자료 수정" : "급식자료 등록"}</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
              {isEdit
                ? "교체할 자료만 다시 선택하면 됩니다. 선택하지 않은 자료는 그대로 유지됩니다."
                : "거래처와 주차를 기준으로 주간 식단표와 요일별 식판 사진을 한 번에 등록합니다."}
            </div>
          </div>
          <IconButton onClick={closeModal} sx={{ backgroundColor: "#f3f5f8" }} aria-label="닫기">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <DialogContent sx={{ px: 3, py: 2.5 }}>
          {/* 거래처·연·월·주차 입력 줄 (수정 모달은 고정, 모바일은 거래처·주차 한 줄씩 + 연·월 반반) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1.3fr 0.8fr 0.7fr 1.6fr",
              gap: 12,
            }}
          >
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto", minWidth: 0 }}>
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
            {/* 주차를 고를 연·월 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>연도</div>
              <TextField
                select
                size="small"
                fullWidth
                value={form.year || year}
                onChange={(e) => setFormYearMonth("year", Number(e.target.value))}
                SelectProps={{ native: true }}
                disabled={isEdit}
                sx={inputBoxSx}
              >
                {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </TextField>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>월</div>
              <TextField
                select
                size="small"
                fullWidth
                value={form.month || month}
                onChange={(e) => setFormYearMonth("month", Number(e.target.value))}
                SelectProps={{ native: true }}
                disabled={isEdit}
                sx={inputBoxSx}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </TextField>
            </div>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6 }}>주차 (월~일)</div>
              {isEdit ? (
                <TextField
                  size="small"
                  fullWidth
                  disabled
                  value={`${modalWeek.no}주차 · ${dayjs(modalWeek.start).format("MM.DD")} ~ ${dayjs(modalWeek.end).format("MM.DD")}`}
                  sx={inputBoxSx}
                />
              ) : (
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={form.week_start || ""}
                  onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, week_start: e.target.value, plates: {} } }))}
                  SelectProps={{ native: true }}
                  sx={inputBoxSx}
                >
                  {modalWeeks.map((w) => (
                    <option key={w.start} value={w.start}>
                      {w.no}주차 · {dayjs(w.start).format("MM.DD")} ~ {dayjs(w.end).format("MM.DD")}
                    </option>
                  ))}
                </TextField>
              )}
            </div>
          </div>

          {/* 주간 식단표 카드 (주 1장, 그 주 월요일 행에 저장) */}
          <div style={{ marginTop: 22, marginBottom: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>주간 식단표</span>
            <span style={{ fontSize: 12, color: "#9aa6b1" }}>· 주차별 1장</span>
          </div>
          <FileDropCard
            kind={FILE_KINDS[0]}
            file={form.menu}
            existing={isEdit ? fileOf(modal.item.menuRow, "menu") : null}
            onSelect={(file) => setModal((m) => ({ ...m, form: { ...m.form, menu: file, deleteMenu: false } }))}
            deleted={!!form.deleteMenu}
            onDelete={isEdit && fileOf(modal.item.menuRow, "menu") ? (on) => setFormValue("deleteMenu", on) : undefined}
            onView={isEdit ? () => openPreview(modal.item.menuRow, "menu") : undefined}
            onDownload={
              isEdit
                ? () =>
                    triggerDownload(
                      buildFileDownloadUrl(fileOf(modal.item.menuRow, "menu").path),
                      buildFileName(modal.item.menuRow, "menu")
                    )
                : undefined
            }
          />

          {/* 요일별 식판 사진 카드 (월~일 하루 1장) */}
          <div style={{ marginTop: 22, marginBottom: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>식판 사진</span>
            <span style={{ fontSize: 12, color: "#9aa6b1" }}>· 하루 1장, 필요한 요일만 선택하셔도 됩니다.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
            {(modalWeek?.dates || []).map((date, i) => {
              const row = isEdit ? modal.item.dayRows[date] : null;
              return (
                <FileDropCard
                  key={date}
                  compact
                  index={WEEK_DAY_LABELS[i]}
                  kind={{ ...FILE_KINDS[1], label: dayjs(date).format("MM.DD") }}
                  file={form.plates[date]}
                  existing={fileOf(row, "plate")}
                  onSelect={(file) => setPlateFile(date, file)}
                  deleted={!!form.deletePlates?.[date]}
                  onDelete={fileOf(row, "plate") ? (on) => setPlateDelete(date, on) : undefined}
                  onView={row ? () => openPreview(row, "plate") : undefined}
                  onDownload={
                    row && fileOf(row, "plate")
                      ? () => triggerDownload(buildFileDownloadUrl(fileOf(row, "plate").path), buildFileName(row, "plate"))
                      : undefined
                  }
                />
              );
            })}
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
                ? "선택한 파일만 교체·추가되고, [삭제]를 누른 파일은 저장할 때 지워집니다. 나머지 기존 파일은 그대로 유지됩니다."
                : "같은 거래처·주차로 이미 등록된 자료가 있으면 새로 등록할 수 없습니다. 목록에서 [수정]으로 변경해 주세요."}
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

      {/* 다운로드 범위 선택 팝업 (거래처: 전체 또는 1곳, 기간: 시작일 ~ 종료일) */}
      <Dialog
        open={scopeDialog.open}
        onClose={() => closeScopeDialog(null)}
        PaperProps={{ sx: { width: "100%", maxWidth: 420, m: 2, borderRadius: "16px" } }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", padding: "20px 22px 12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{scopeDialog.label} 다운로드</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
              자료를 받을 거래처와 기간을 선택해 주세요.
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
            disabled={isAccountLocked}
            renderInput={(params) => (
              <TextField {...params} label="거래처" placeholder="거래처명을 입력" sx={{ ...inputBoxSx, ...accountLabelSx }} />
            )}
            ListboxProps={{ style: { fontSize: "12px" } }}
            sx={{ mt: 1 }}
          />
          {/* 다운로드 기간 (시작일 ~ 종료일, 달을 넘겨도 선택 가능, 식단표는 기간에 걸친 주의 것 포함) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <TextField
              type="date"
              size="small"
              label="시작일"
              value={scopeDialog.startDate}
              onChange={(e) => setScopeDialog((d) => ({ ...d, startDate: e.target.value }))}
              inputProps={{ max: scopeDialog.endDate || undefined }}
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
              inputProps={{ min: scopeDialog.startDate || undefined }}
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
        excelStyled
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
