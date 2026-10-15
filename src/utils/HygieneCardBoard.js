/* eslint-disable react/prop-types */
// 위생점검 카드형 화면 (앱 위생 점검 화면 구성: 전체 요약 카드 → 카테고리 상세 조치 전·후 항목 카드)
// 운영관리·현장관리 위생점검 탭에서 공통 사용, 행 데이터·저장·삭제·업로드는 각 탭에서 처리
import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconButton, Tooltip, TextField, Select, MenuItem } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import MDButton from "components/MDButton";
import { API_BASE_URL } from "config";

// 상태 필터 탭 목록
const FILTER_TABS = ["전체", "조치 필요", "완료", "미점검"];

// 점검 상태별 배지 배경색과 글자색 (앱과 동일)
const STATUS_TONE = {
  완료: { bg: "#eaf7ef", fg: "#2a7a49" },
  "조치 필요": { bg: "#fff3e6", fg: "#a55d1d" },
  미점검: { bg: "#f0f3f5", fg: "#667584" },
};

// 강조 색 (ERP info 색)
const ACCENT = "#1A73E8";

// 카드 안 입력칸 공통 글자 크기
// 라벨은 14px(위로 올라가면 75%인 10.5px), 테두리를 끊는 legend 글자도 10.5px로 맞춰 라벨 좌우 여백 통일
const inputSx = {
  "& .MuiInputBase-root": { fontSize: 12, backgroundColor: "#ffffff" },
  "& .MuiInputLabel-root, & .MuiInputLabel-root.MuiInputLabel-shrink": { fontSize: 14 },
  "& .MuiInputLabel-root.MuiInputLabel-shrink ~ .MuiInputBase-root .MuiOutlinedInput-notchedOutline legend": {
    fontSize: "10.5px",
    paddingRight: 0,
  },
};

// 읽기 전용 입력칸 (현장 화면의 조치 전 칸) 회색 배경
const lockedInputSx = {
  ...inputSx,
  "& .MuiInputBase-root": { fontSize: 12, backgroundColor: "#f3f5f7" },
};

// 조치 필요 카드 강조 테두리 (주황, 두께 2px 효과)
const NEED_ACTION_BORDER = { borderColor: "#f0a35c", boxShadow: "0 0 0 1px #f0a35c" };

// 줄 안에 같이 놓이는 작은 버튼 공통 높이 (칩·셀렉트와 세로 가운데 맞춤)
const buttonSx = { height: 32, minHeight: 32, py: 0, lineHeight: 1, fontSize: 12 };

// 항목 조치 완료 여부 (조치 사진과 조치 내용이 모두 있는 경우)
// 구분 없음(카테고리 없는 기존 웹 등록 행)은 조치 사진 없이 조치 내용만 있어도 처리된 것으로 판단
const isItemDone = (row) => {
  const hasActionNote = Boolean(String(row.clean_note || "").trim());
  if (!row.category_key) return hasActionNote;
  return Boolean(row.clean_image && hasActionNote);
};

// 카테고리 점검 상태 (항목 없음: 미점검, 모든 항목 조치 완료: 완료, 그 외: 조치 필요)
const getStatus = (items) => {
  if (items.length === 0) return "미점검";
  return items.every(({ row }) => isItemDone(row)) ? "완료" : "조치 필요";
};

// 요약 카드 한 줄 안내 문구
const getHint = (items, status) => {
  if (status === "완료") return "모든 항목 조치 완료";
  if (status === "조치 필요") {
    return `조치 ${items.filter(({ row }) => !isItemDone(row)).length}건 남음`;
  }
  return "아직 점검하지 않음";
};

// 조치 전·후 사진이 있는 항목 수
// 구분 없음(카테고리 없는 기존 웹 등록 행)은 사진 또는 내용(전: 전달 내용, 후: 조치 내용)이 있으면 셈
const getPhotoCounts = (items) => {
  const hasSide = (row, imageKey, noteKey) =>
    row.category_key ? row[imageKey] : row[imageKey] || String(row[noteKey] || "").trim();
  return {
    before: items.filter(({ row }) => hasSide(row, "problem_image", "problem_note")).length,
    after: items.filter(({ row }) => hasSide(row, "clean_image", "clean_note")).length,
  };
};

// 행을 카테고리별로 묶고 화면 표시 카테고리 목록 계산 (카드 화면·상단 칩 공통)
// itemsByKey: 카테고리 key별 항목 목록 (rows 인덱스 유지, 구분 없는 행은 "" key)
// categories: 사용 중 카테고리 + 숨김·삭제·구분 없음이라도 기록이 있는 카테고리
const groupRowsByCategory = (rows, categoryList) => {
  const itemsByKey = {};
  (rows || []).forEach((row, rowIndex) => {
    const key = row.category_key || "";
    if (!itemsByKey[key]) itemsByKey[key] = [];
    itemsByKey[key].push({ row, rowIndex });
  });

  const categories = (categoryList || []).filter((c) => c.use_yn !== "N" || itemsByKey[c.category_key]);
  const knownKeys = new Set((categoryList || []).map((c) => c.category_key));
  Object.keys(itemsByKey)
    .filter((key) => !knownKeys.has(key))
    .forEach((key) => categories.push({ category_key: key, category_name: key || "구분 없음" }));

  return { itemsByKey, categories };
};

// 둥근 상태 배지
function Badge({ label, bg, fg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

// 사진 미리보기 칸 (File 객체는 임시 주소, 서버 경로는 API 주소로 표시, 클릭 시 크게 보기)
function PhotoThumb({ value, onView }) {
  const isFile = !!value && typeof value === "object";
  const src = useMemo(() => {
    if (!value) return "";
    return isFile ? URL.createObjectURL(value) : encodeURI(`${API_BASE_URL}${value}`);
  }, [value, isFile]);

  // 선택한 파일 임시 주소 해제
  useEffect(
    () => () => {
      if (isFile && src) URL.revokeObjectURL(src);
    },
    [isFile, src]
  );

  return (
    <div
      onClick={() => value && onView(value)}
      style={{
        height: 140,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#e3e9ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: value ? "zoom-in" : "default",
        color: "#8a97a3",
        fontSize: 12,
      }}
    >
      {src ? (
        <img src={src} alt="점검 사진" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        "사진 없음"
      )}
    </div>
  );
}

// 항목 한쪽 칸 (조치 전: 등록일자·사진·전달 내용 / 조치 후: 조치일자·사진·조치 내용)
// locked: 읽기 전용 여부 (현장 화면의 조치 전 칸: 날짜·사진 업로드·전달 내용 수정 불가, 크게 보기·다운로드는 가능)
function ItemSide({ side, row, rowIndex, locked = false, onCellChange, onViewImage, onDownload }) {
  const isBefore = side === "before";
  const dateKey = isBefore ? "reg_dt" : "mod_dt";
  const imageKey = isBefore ? "problem_image" : "clean_image";
  const noteKey = isBefore ? "problem_note" : "clean_note";
  const image = row[imageKey];

  return (
    // 한쪽 칸 (조치 전은 주황 톤, 조치 후는 초록 톤 배경)
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "10px 8px",
        borderRadius: 8,
        backgroundColor: isBefore ? "#fbf5f0" : "#eff7f1",
      }}
    >
      {/* 칸 제목 */}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#344767" }}>{isBefore ? "조치 전" : "조치 후"}</span>

      {/* 등록일자 / 조치일자 입력 */}
      <TextField
        type="date"
        size="small"
        label={isBefore ? "등록일자" : "조치일자"}
        value={row[dateKey] || ""}
        onChange={(e) => onCellChange(rowIndex, dateKey, e.target.value)}
        InputLabelProps={{ shrink: true }}
        InputProps={{ readOnly: locked }}
        fullWidth
        sx={locked ? lockedInputSx : inputSx}
      />

      {/* 사진 미리보기 */}
      <PhotoThumb value={image} onView={onViewImage} />

      {/* 사진 업로드/재업로드 버튼(잠금 칸은 미표시)과 다운로드 아이콘 */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 30 }}>
        {locked ? (
          <span style={{ flex: 1, fontSize: 12, color: "#8a97a3" }}>본사 등록 항목 (수정 불가)</span>
        ) : (
          <MDButton component="label" variant="outlined" color="info" size="small" sx={{ flex: 1, fontSize: 12 }}>
            {image ? "재업로드" : "사진 업로드"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCellChange(rowIndex, imageKey, file);
                e.target.value = ""; // 같은 파일 재선택 가능
              }}
            />
          </MDButton>
        )}
        {typeof image === "string" && image && (
          <Tooltip title="다운로드">
            <IconButton size="small" sx={{ color: ACCENT }} onClick={() => onDownload(image)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>

      {/* 전달 내용 / 조치 내용 입력 */}
      <TextField
        size="small"
        label={isBefore ? "전달 내용" : "조치 내용"}
        value={row[noteKey] || ""}
        onChange={(e) => onCellChange(rowIndex, noteKey, e.target.value)}
        placeholder={locked ? "" : isBefore ? "확인할 내용을 입력해 주세요." : "조치 내용을 입력해 주세요."}
        InputLabelProps={{ shrink: true }}
        InputProps={{ readOnly: locked }}
        multiline
        minRows={3}
        fullWidth
        sx={locked ? lockedInputSx : inputSx}
      />
    </div>
  );
}

function HygieneCardBoard({
  rows,
  categoryList,
  selectedKey,
  onSelectKey,
  statusFilter,
  onStatusFilter,
  isMobile,
  isRowChanged,
  onCellChange,
  onAddRow,
  onDeleteRow,
  onViewImage,
  onDownload,
  onEditCategories,
  // 현장 화면 여부 (조치 전 칸 잠금, 항목 추가·구분 변경·삭제 미표시, 상세 항목 조치 안 된 것 먼저 정렬)
  isFieldMode = false,
  // 마지막 조회·저장 상태 행 (rows와 같은 인덱스, 현장 상세 정렬의 조치 여부 판단 기준)
  savedRows = [],
}) {
  // 카테고리별 항목 목록과 화면 표시 카테고리
  const { itemsByKey, categories } = useMemo(() => groupRowsByCategory(rows, categoryList), [rows, categoryList]);

  // 카테고리별 점검 상태
  const statusMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.category_key, getStatus(itemsByKey[c.category_key] || [])])),
    [categories, itemsByKey]
  );

  // 상태별 카테고리 개수와 전체 진행률 (진행률 = 점검한 카테고리 중 완료 비율, 미점검 제외)
  const summary = useMemo(() => {
    const statuses = Object.values(statusMap);
    const doneCount = statuses.filter((s) => s === "완료").length;
    const pendingCount = statuses.filter((s) => s === "조치 필요").length;
    const checkedCount = doneCount + pendingCount;
    return {
      doneCount,
      pendingCount,
      uncheckedCount: statuses.filter((s) => s === "미점검").length,
      percent: checkedCount > 0 ? Math.round((doneCount / checkedCount) * 100) : 0,
    };
  }, [statusMap]);

  // 상세 화면 카테고리 (null이면 전체 요약 화면)
  const selectedCategory = selectedKey === null ? null : categories.find((c) => c.category_key === selectedKey) || null;

  // 카드·박스 공통 테두리 스타일
  const cardStyle = {
    border: "1px solid #dde5eb",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  };

  // 카테고리 상세 화면
  if (selectedCategory) {
    const categoryItems = itemsByKey[selectedCategory.category_key] || [];
    // 현장 화면: 조치 안 된 항목 먼저, 그다음 등록일자 오름차순 (행은 이미 등록일자 순이라 안정 정렬로 유지)
    // 조치 여부는 마지막 저장 상태로 판단해 입력 중에 카드 순서가 바뀌지 않게 함
    const items = isFieldMode
      ? [...categoryItems].sort(
          ({ row: a, rowIndex: ai }, { row: b, rowIndex: bi }) =>
            Number(isItemDone(savedRows[ai] || a)) - Number(isItemDone(savedRows[bi] || b))
        )
      : categoryItems;
    const counts = getPhotoCounts(items);
    const remaining = items.filter(({ row }) => !isItemDone(row)).length;
    const description = selectedCategory.description || "";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
        {/* 선택 카테고리 이름·사진 건수·누적 건수 요약 박스 */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#344767" }}>{selectedCategory.category_name}</div>
            <div style={{ fontSize: 13, color: "#7b809a" }}>
              조치 전 {counts.before}건 · 조치 후 {counts.after}건{remaining > 0 ? ` (${remaining}건 남음)` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#7b809a" }}>누적 {items.length}건</span>
            <Badge
              label={statusMap[selectedCategory.category_key]}
              {...STATUS_TONE[statusMap[selectedCategory.category_key]]}
            />
          </div>
        </div>

        {/* 카테고리 점검 안내 박스 (주요 확인내용 칩 + 관리 포인트) */}
        {(description || selectedCategory.manage_point) && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              backgroundColor: "#eaf5fa",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {description && (
              <div>
                <div style={{ fontSize: 13, color: "#1687b2", marginBottom: 4 }}>주요 확인내용</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {description
                    .split(description.includes("/") ? "/" : "·")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => (
                      <Badge key={item} label={item} bg="#ffffff" fg="#344252" />
                    ))}
                </div>
              </div>
            )}
            {selectedCategory.manage_point && (
              <div>
                <div style={{ fontSize: 13, color: "#1687b2", marginBottom: 4 }}>관리 포인트</div>
                <div style={{ fontSize: 13, color: "#344252", whiteSpace: "pre-wrap" }}>
                  {selectedCategory.manage_point}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 조치 전·후 항목 카드 목록 (한 항목 = 위생관리 한 행), 항목이 없으면 안내 박스 */}
        {items.length === 0 ? (
          <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>
            {isFieldMode
              ? "등록된 항목이 없습니다. 본사에서 점검 항목을 등록하면 조치 후 사진을 추가할 수 있습니다."
              : "등록된 항목이 없습니다. 아래 항목 추가를 눌러 등록해 주세요."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(560px, 1fr))",
              gap: 12,
            }}
          >
            {items.map(({ row, rowIndex }, index) => {
              const changed = isRowChanged(rowIndex);
              // 조치가 끝나지 않은 항목 강조 여부
              const needAction = !changed && !isItemDone(row);

              return (
                // 항목 카드 (수정된 항목은 빨간 테두리, 조치 필요 항목은 주황 테두리)
                <div
                  key={row.idx ?? `new-${rowIndex}`}
                  style={{
                    ...cardStyle,
                    ...(needAction ? NEED_ACTION_BORDER : {}),
                    borderColor: changed ? "#d32f2f" : needAction ? NEED_ACTION_BORDER.borderColor : "#dde5eb",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {/* 항목 번호·수정 표시·구분 변경·삭제 버튼 줄 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#dcebf3",
                        color: "#1687b2",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>항목 {index + 1}</span>
                    {changed && <Badge label="수정됨" bg="#fdecea" fg="#d32f2f" />}
                    <span style={{ flex: 1 }} />
                    {/* 항목 구분(카테고리) 변경·삭제 (현장 화면은 미표시) */}
                    {!isFieldMode && (
                      <Select
                        size="small"
                        value={row.category_key || ""}
                        onChange={(e) => onCellChange(rowIndex, "category_key", e.target.value)}
                        displayEmpty
                        sx={{ minWidth: 130, height: 32, fontSize: 12 }}
                      >
                        <MenuItem value="">구분 없음</MenuItem>
                        {(categoryList || []).map((c) => (
                          <MenuItem key={c.category_key} value={c.category_key}>
                            {c.category_name}
                          </MenuItem>
                        ))}
                        {row.category_key && !(categoryList || []).some((c) => c.category_key === row.category_key) && (
                          <MenuItem value={row.category_key}>{row.category_key}</MenuItem>
                        )}
                      </Select>
                    )}
                    {!isFieldMode && (
                      <MDButton
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => onDeleteRow(rowIndex)}
                        sx={buttonSx}
                      >
                        삭제
                      </MDButton>
                    )}
                  </div>

                  {/* 조치 전(왼쪽) → 조치 후(오른쪽) 두 칸 */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
                    <ItemSide
                      side="before"
                      row={row}
                      rowIndex={rowIndex}
                      locked={isFieldMode}
                      onCellChange={onCellChange}
                      onViewImage={onViewImage}
                      onDownload={onDownload}
                    />
                    <ArrowForwardIcon fontSize="small" sx={{ alignSelf: "center", color: ACCENT }} />
                    <ItemSide
                      side="after"
                      row={row}
                      rowIndex={rowIndex}
                      onCellChange={onCellChange}
                      onViewImage={onViewImage}
                      onDownload={onDownload}
                    />
                  </div>

                  {/* 비고 입력 */}
                  <TextField
                    size="small"
                    label="비고"
                    value={row.note || ""}
                    onChange={(e) => onCellChange(rowIndex, "note", e.target.value)}
                    fullWidth
                    sx={inputSx}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* 선택 카테고리 항목 추가 버튼 (현장 화면은 미표시) */}
        {!isFieldMode && (
          <MDButton
            variant="outlined"
            color="info"
            onClick={() => onAddRow(selectedCategory.category_key)}
            sx={{ borderStyle: "dashed", fontSize: 14 }}
          >
            + 항목 추가
          </MDButton>
        )}
      </div>
    );
  }

  // 전체 요약 화면 표시 카드 (메인 표시 카테고리 + 상태 필터)
  const visibleCategories = categories.filter(
    (c) => c.main_yn !== "N" && (statusFilter === "전체" || statusMap[c.category_key] === statusFilter)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
      {/* 전체 점검 진행률과 상태별 개수 영역 */}
      <div style={{ ...cardStyle, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: "#344767" }}>
            전체 점검 현황 <span style={{ color: ACCENT }}>{summary.percent}%</span>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <Badge label={`완료 ${summary.doneCount}`} {...STATUS_TONE["완료"]} />
            <Badge label={`조치 필요 ${summary.pendingCount}`} {...STATUS_TONE["조치 필요"]} />
            <Badge label={`미점검 ${summary.uncheckedCount}`} {...STATUS_TONE["미점검"]} />
          </div>
        </div>
        {/* 진행률 막대 */}
        <div style={{ height: 7, borderRadius: 999, backgroundColor: "#e7edf2", overflow: "hidden" }}>
          <div style={{ height: 7, width: `${summary.percent}%`, backgroundColor: ACCENT }} />
        </div>
      </div>

      {/* 상태 필터 탭, 점검 항목 개수, 카테고리 편집 버튼 영역 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {FILTER_TABS.map((filter) => (
          // 상태 필터 탭 버튼
          <button
            key={filter}
            type="button"
            onClick={() => onStatusFilter(filter)}
            style={chipStyle(filter === statusFilter)}
          >
            {filter}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 32 }}>
          <span style={{ fontSize: 14, lineHeight: 1, color: "#7b809a" }}>
            점검 항목 <b style={{ color: "#344767" }}>{visibleCategories.length}개</b>
          </span>
          {onEditCategories && (
            <MDButton variant="outlined" color="info" size="small" onClick={onEditCategories} sx={buttonSx}>
              카테고리 편집
            </MDButton>
          )}
        </div>
      </div>

      {/* 카테고리별 요약 카드 목록 (클릭 시 상세 화면 이동) */}
      {visibleCategories.length === 0 ? (
        <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>
          {statusFilter} 항목이 없습니다.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {visibleCategories.map((c) => {
            const items = itemsByKey[c.category_key] || [];
            const counts = getPhotoCounts(items);
            const status = statusMap[c.category_key];

            return (
              // 카테고리 요약 카드 (조치 필요 카테고리는 주황 테두리)
              <div
                key={c.category_key || "__none"}
                onClick={() => onSelectKey(c.category_key)}
                style={{
                  ...cardStyle,
                  ...(status === "조치 필요" ? NEED_ACTION_BORDER : {}),
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                {/* 카테고리명과 상세 보기 표시 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#344767",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.category_name}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 20,
                      fontSize: 12,
                      lineHeight: 1,
                      color: ACCENT,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ lineHeight: 1 }}>상세 보기</span>
                    <ChevronRightIcon sx={{ fontSize: 16, display: "block" }} />
                  </span>
                </div>
                {/* 조치 전/후 사진 건수 배지와 점검 상태 배지 */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Badge label={`전 ${counts.before}`} bg="#f2f5f7" fg="#667584" />
                  <Badge label={`후 ${counts.after}`} bg="#eef6f1" fg="#3e7652" />
                  <span style={{ flex: 1 }} />
                  {c.status_yn !== "N" && <Badge label={status} {...STATUS_TONE[status]} />}
                </div>
                {/* 조치 진행 안내 문구 */}
                <span style={{ fontSize: 12, color: "#7b809a" }}>{getHint(items, status)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 상세 화면 상단 고정 바의 전체로 이동 버튼과 카테고리 전환 칩 (상세 화면일 때만 표시)
// 칩 줄은 좌우 스크롤(마우스 드래그·휠·터치), 선택한 칩은 항상 가운데로 이동
export function HygieneCategoryChips({ rows, categoryList, selectedKey, onSelectKey, isMobile }) {
  const { categories } = useMemo(() => groupRowsByCategory(rows, categoryList), [rows, categoryList]);
  // 칩 가로 스크롤 영역
  const scrollRef = useRef(null);
  // 마우스 드래그 진행 정보 (시작 좌표·시작 스크롤 위치), 드래그로 움직였는지 여부 (칩 클릭 무시용)
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const isOpen = selectedKey !== null && categories.some((c) => c.category_key === selectedKey);

  // 선택한 칩이 보이도록 칩 줄 가운데로 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (!isOpen || !el) return;
    const chip = el.querySelector(`[data-chip="${CSS.escape(selectedKey || "__none")}"]`);
    if (!chip) return;
    el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [isOpen, selectedKey, categories.length]);

  // 마우스 휠(세로)을 칩 줄 가로 스크롤로 변환
  useEffect(() => {
    const el = scrollRef.current;
    if (!isOpen || !el) return undefined;
    const handleWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isOpen]);

  if (!isOpen) return null;

  // 마우스로 누른 채 좌우로 끌어 칩 줄 스크롤 (터치는 기본 가로 스크롤 사용)
  const handlePointerDown = (e) => {
    if (e.pointerType !== "mouse") return;
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
  };
  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 4) movedRef.current = true;
    if (movedRef.current) scrollRef.current.scrollLeft = drag.scrollLeft - dx;
  };
  const handlePointerEnd = () => {
    dragRef.current = null;
  };

  return (
    <div
      style={{
        flex: isMobile ? "1 1 100%" : "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {/* 전체 요약 화면으로 이동 버튼 (칩 줄 왼쪽 고정) */}
      <button
        type="button"
        onClick={() => onSelectKey(null)}
        style={{ ...chipStyle(false), flexShrink: 0, borderColor: ACCENT, color: ACCENT, fontWeight: 700, paddingLeft: 8 }}
      >
        <ChevronLeftIcon sx={{ fontSize: 18, display: "block" }} />
        <span style={{ lineHeight: 1 }}>전체로 이동</span>
      </button>

      {/* 카테고리 전환 칩 가로 스크롤 영역 (드래그로 움직였으면 칩 클릭 무시) */}
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onClickCapture={(e) => {
          if (!movedRef.current) return;
          e.stopPropagation();
          e.preventDefault();
          movedRef.current = false;
        }}
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          overflowY: "hidden",
          // 스크롤바 높이만큼 칩이 위로 밀리지 않도록 숨김 (드래그·휠·터치로 좌우 이동)
          scrollbarWidth: "none",
          userSelect: "none",
        }}
      >
        {categories.map((c) => (
          // 카테고리 칩 버튼
          <button
            key={c.category_key || "__none"}
            data-chip={c.category_key || "__none"}
            type="button"
            onClick={() => onSelectKey(c.category_key)}
            style={{ ...chipStyle(c.category_key === selectedKey), flexShrink: 0 }}
          >
            {c.category_name}
          </button>
        ))}
      </div>
    </div>
  );
}

// 카드 영역을 화면 맨 아래까지 채우는 높이 계산 훅 (운영관리·현장 위생점검 탭 공통)
// 반환값: [카드 영역에 연결할 ref 함수, 계산된 높이(px, 계산 전 null)]
// 창 크기 변경, 바로 위 상단 바 높이 변경(모바일 줄바꿈·칩 표시)에도 다시 계산
export function useFillViewportHeight(bottomGap = 24) {
  const [element, setElement] = useState(null);
  const [height, setHeight] = useState(null);

  useEffect(() => {
    if (!element) return undefined;
    const update = () =>
      setHeight(Math.max(320, Math.floor(window.innerHeight - element.getBoundingClientRect().top - bottomGap)));
    update();
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer && element.previousElementSibling) observer.observe(element.previousElementSibling);
    return () => {
      window.removeEventListener("resize", update);
      if (observer) observer.disconnect();
    };
  }, [element, bottomGap]);

  return [setElement, height];
}

// 필터 탭·카테고리 칩 버튼 스타일 (선택 시 강조 색 채움, 아이콘·글자 세로 가운데 정렬)
function chipStyle(active) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    height: 32,
    padding: "0 14px",
    borderRadius: 999,
    border: `1px solid ${active ? ACCENT : "#dce4ea"}`,
    backgroundColor: active ? ACCENT : "#f7f9fa",
    color: active ? "#ffffff" : "#5b6a79",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    lineHeight: 1,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default HygieneCardBoard;
