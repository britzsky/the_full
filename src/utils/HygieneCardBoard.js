/* eslint-disable react/prop-types */
// 위생점검 카드형 화면 (앱 위생 점검 화면 구성: 전체 요약 카드 → 카테고리 상세 조치 전·후 항목 카드)
// 운영관리·현장관리 위생점검 탭에서 공통 사용, 행 데이터·저장·삭제·업로드는 각 탭에서 처리
import React, { useEffect, useMemo, useState } from "react";
import { IconButton, Tooltip, TextField, Select, MenuItem } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
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

// 요약 카드에 미리 보여줄 최대 항목 수
const PREVIEW_COUNT = 3;

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

// 요약 카드 상태 배지 문구 (조치 필요는 남은 건수 함께 표시)
const getStatusLabel = (items, status) =>
  status === "조치 필요" ? `조치 필요 ${items.filter(({ row }) => !isItemDone(row)).length}건` : status;

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

// 미리보기 칸에 그릴 축소 사진의 긴 변 크기(px)
const THUMB_MAX_SIZE = 400;

// 사진을 받아 작은 크기로 한 번만 줄인 임시 주소를 반환하는 훅 (스크롤 때 큰 원본을 다시 풀지 않도록)
// File 객체는 임시 주소, 서버 경로는 API 주소에서 받으며, 축소에 실패하면 원본 주소를 그대로 사용
// ponytail: 다운로드 용량은 원본 그대로, 첫 로딩까지 줄이려면 서버 썸네일 생성 필요
function useThumbSrc(value) {
  const [thumbSrc, setThumbSrc] = useState("");

  useEffect(() => {
    setThumbSrc("");
    if (!value) return undefined;

    const isFile = typeof value === "object";
    const originalSrc = isFile ? URL.createObjectURL(value) : encodeURI(`${API_BASE_URL}${value}`);
    let cancelled = false;
    let resizedSrc = "";
    const img = new Image();
    // 서버 사진을 canvas로 줄이려면 CORS 요청 필요
    if (!isFile) img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;
      const scale = Math.min(1, THUMB_MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale === 1) {
        setThumbSrc(originalSrc);
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        // 투명 PNG가 검게 나오지 않도록 흰 배경 채움
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (cancelled) return;
            if (!blob) {
              setThumbSrc(originalSrc);
              return;
            }
            resizedSrc = URL.createObjectURL(blob);
            setThumbSrc(resizedSrc);
          },
          "image/jpeg",
          0.85
        );
      } catch (err) {
        // CORS 미허용 등으로 canvas 사용이 막히면 원본 표시
        setThumbSrc(originalSrc);
      }
    };
    img.onerror = () => {
      if (!cancelled) setThumbSrc(originalSrc);
    };
    img.src = originalSrc;

    // 화면에서 빠지거나 사진이 바뀌면 진행 중인 축소 중단, 임시 주소 해제
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      if (resizedSrc) URL.revokeObjectURL(resizedSrc);
      if (isFile) URL.revokeObjectURL(originalSrc);
    };
  }, [value]);

  return thumbSrc;
}

// 사진 미리보기 칸 (축소한 사진 표시, 클릭 시 원본 크게 보기, 법인차량 상태 사진에서도 사용)
// height: 칸 높이(px, 기본 140)
// loadingText: 사진을 불러오는 동안 표시할 문구 (작은 칸은 짧은 문구를 넘겨 줄바꿈 방지)
export function PhotoThumb({ value, onView, height = 140, loadingText = "불러오는 중..." }) {
  const src = useThumbSrc(value);

  return (
    <div
      onClick={() => value && onView(value)}
      style={{
        height,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#e3e9ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: value ? "zoom-in" : "default",
        color: "#8a97a3",
        fontSize: 12,
        // 안내 문구는 한 줄로 고정 (좁은 칸에서 두 줄로 꺾이며 칸 크기가 흔들리지 않게)
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {src ? (
        <img
          src={src}
          alt="점검 사진"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : value ? (
        loadingText
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

// 값이 바뀐 항목 칸만 다시 그리는 조치 전·후 칸 (입력 시 전체 카드 재렌더링 방지)
const MemoItemSide = React.memo(ItemSide);

// 업로드 전 사진 축소 (긴 변 최대 1600px, JPEG 80% 품질, 줄어들지 않거나 실패하면 원본 반환)
// ponytail: 브라우저 canvas 기준 단순 축소, 서버 썸네일이 필요해지면 업로드 API에서 생성
export async function compressImageFile(file, maxSize = 1600, quality = 0.8) {
  if (!file || !String(file.type || "").startsWith("image/") || file.type === "image/gif") return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });

    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    // 투명 PNG가 검게 나오지 않도록 흰 배경 채움
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const baseName = String(file.name || "photo").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch (err) {
    console.error("사진 축소 실패, 원본으로 업로드:", err);
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
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
                    <MemoItemSide
                      side="before"
                      row={row}
                      rowIndex={rowIndex}
                      locked={isFieldMode}
                      onCellChange={onCellChange}
                      onViewImage={onViewImage}
                      onDownload={onDownload}
                    />
                    <ArrowForwardIcon fontSize="small" sx={{ alignSelf: "center", color: ACCENT }} />
                    <MemoItemSide
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
            gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(300px, 1fr))",
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
                  {c.status_yn !== "N" && <Badge label={getStatusLabel(items, status)} {...STATUS_TONE[status]} />}
                </div>
                {/* 항목별 전달 내용 미리보기 목록 (조치 안 된 항목 먼저 최대 3건, 긴 내용은 한 줄 말줄임) */}
                {/* 항목 수와 관계없이 3줄 + 외 N건 줄 높이를 항상 확보해 카드 크기 통일 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "content-box",
                    height: PREVIEW_COUNT * 28 + 24,
                    borderTop: "1px solid #eef2f5",
                    paddingTop: 4,
                  }}
                >
                  {/* 항목 없는 카테고리 안내 (미리보기 영역 전체를 점선 박스로 채움, 운영관리 화면은 추가 방법 안내) */}
                  {items.length === 0 && (
                    <div
                      style={{
                        flex: 1,
                        marginTop: 4,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        border: "1px dashed #d3dce3",
                        borderRadius: 6,
                        backgroundColor: "#f8fafb",
                        color: "#9aa6b1",
                        fontSize: 12,
                      }}
                    >
                      <AssignmentOutlinedIcon sx={{ fontSize: 22, color: "#b8c3cc" }} />
                      <span>등록된 점검 항목이 없습니다</span>
                      {!isFieldMode && <span style={{ color: ACCENT }}>눌러서 항목 추가</span>}
                    </div>
                  )}
                  {[...items]
                    .sort((a, b) => Number(isItemDone(a.row)) - Number(isItemDone(b.row)))
                    .slice(0, PREVIEW_COUNT)
                    .map(({ row, rowIndex }) => {
                      const done = isItemDone(row);
                      const note = String(row.problem_note || "").trim();
                      return (
                        // 항목 한 줄 (상태 점, 전달 내용, 조치 상태)
                        <div
                          key={rowIndex}
                          title={note}
                          style={{ display: "flex", alignItems: "center", gap: 6, height: 28, fontSize: 12 }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              flexShrink: 0,
                              backgroundColor: done ? STATUS_TONE["완료"].fg : "#f0a35c",
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: note ? "#344767" : "#9aa6b1",
                            }}
                          >
                            {note || "전달 내용 없음"}
                          </span>
                          <span
                            style={{
                              flexShrink: 0,
                              color: done ? STATUS_TONE["완료"].fg : STATUS_TONE["조치 필요"].fg,
                            }}
                          >
                            {done ? "완료" : "조치 대기"}
                          </span>
                        </div>
                      );
                    })}
                  {/* 미리보기 개수를 넘는 항목 수 안내 */}
                  {items.length > PREVIEW_COUNT && (
                    <span style={{ height: 24, display: "flex", alignItems: "center", fontSize: 12, color: ACCENT }}>
                      외 {items.length - PREVIEW_COUNT}건
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 상단 고정 바의 전체 점검 현황 (진행률·항목 단위 완료·조치 필요 건수, 요약·상세 화면 모두 표시)
// 진행률 = 전체 항목 중 조치 완료 비율
export function HygieneSummaryStatus({ rows, isMobile }) {
  const summary = useMemo(() => {
    const items = rows || [];
    const doneCount = items.filter((row) => isItemDone(row)).length;
    return {
      doneCount,
      pendingCount: items.length - doneCount,
      percent: items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0,
    };
  }, [rows]);

  // 상태별 건수 표시 목록 (색 점 + 이름 + 건수)
  const statusItems = [
    { label: "완료", count: summary.doneCount },
    { label: "조치 필요", count: summary.pendingCount },
  ];

  return (
    // 현황 박스 (연한 파랑 바탕 둥근 박스, 연·월 셀렉트와 같은 40px 높이)
    <div
      style={{
        flex: isMobile ? "1 1 100%" : "0 0 auto",
        marginRight: isMobile ? 0 : "auto",
        height: 40,
        boxSizing: "border-box",
        padding: "0 14px 0 6px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        whiteSpace: "nowrap",
        lineHeight: 1,
        border: "1px solid #d6e6fb",
        borderRadius: 999,
        background: "linear-gradient(90deg, #eef5ff 0%, #f8fbff 100%)",
      }}
    >
      {/* 진행률 원형 표시 (바깥 원 테두리가 진행률만큼 채워짐) */}
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: "50%",
          background: `conic-gradient(${ACCENT} ${summary.percent * 3.6}deg, #dbe6f3 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FactCheckOutlinedIcon sx={{ fontSize: 14, color: ACCENT }} />
        </div>
      </div>
      {/* 제목과 진행률 % */}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#5b6b7c" }}>전체 점검 현황</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{summary.percent}%</span>
      </span>
      {/* 구분선 */}
      <span style={{ width: 1, height: 16, backgroundColor: "#d6e0ea" }} />
      {/* 상태별 카테고리 개수 (상태 색 테두리의 흰 바탕 작은 박스) */}
      {statusItems.map(({ label, count }) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: 26,
            padding: "0 10px",
            boxSizing: "border-box",
            fontSize: 12,
            borderRadius: 999,
            border: `1px solid ${STATUS_TONE[label].fg}33`,
            backgroundColor: "#ffffff",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: STATUS_TONE[label].fg }} />
          <span style={{ color: "#667584" }}>{label}</span>
          <b style={{ color: STATUS_TONE[label].fg }}>{count}건</b>
        </span>
      ))}
    </div>
  );
}

// 상세 화면 상단 고정 바의 전체로 이동 버튼 (상세 화면일 때만 표시)
export function HygieneCategoryChips({ rows, categoryList, selectedKey, onSelectKey, isMobile }) {
  const { categories } = useMemo(() => groupRowsByCategory(rows, categoryList), [rows, categoryList]);
  const isOpen = selectedKey !== null && categories.some((c) => c.category_key === selectedKey);

  if (!isOpen) return null;

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
      {/* 전체 요약 화면으로 이동 버튼 */}
      <button
        type="button"
        onClick={() => onSelectKey(null)}
        style={{ ...chipStyle(false), flexShrink: 0, borderColor: ACCENT, color: ACCENT, fontWeight: 700, paddingLeft: 8 }}
      >
        <ChevronLeftIcon sx={{ fontSize: 18, display: "block" }} />
        <span style={{ lineHeight: 1 }}>전체로 이동</span>
      </button>
    </div>
  );
}

// 카드 영역을 화면 맨 아래까지 채우는 높이 계산 훅 (운영관리·현장 위생점검 탭 공통)
// 반환값: [카드 영역에 연결할 ref 함수, 계산된 높이(px, 계산 전 null)]
// 창 크기 변경, 바로 위 상단 바 높이 변경(모바일 줄바꿈·칩 표시)에도 다시 계산
// bottomGap: 카드 영역 아래 남길 여백 (탭 안쪽 패딩 16px + 레이아웃 패딩 12px + 여유 4px, 바깥 페이지 스크롤 방지)
export function useFillViewportHeight(bottomGap = 32) {
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
