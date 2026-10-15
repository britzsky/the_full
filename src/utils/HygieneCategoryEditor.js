/* eslint-disable react/prop-types */
// 위생점검 카테고리 편집 창 (앱 카테고리 관리 / 카테고리 수정 화면과 같은 구성, 본사 운영관리 탭 전용)
// 목록: 손잡이 끌어서 순서 변경·사용 토글·수정·추가 → 변경사항 저장 시 거래처 카테고리 목록 전체 저장
import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
} from "@mui/material";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";

// 둥근 안내 배지
function Badge({ label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 12,
        whiteSpace: "nowrap",
        backgroundColor: "#ecf7fc",
        color: "#1687b2",
      }}
    >
      {label}
    </span>
  );
}

// 표시 옵션 토글 한 줄 (제목·설명 + 스위치)
function OptionRow({ title, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#7b809a" }}>{description}</div>
      </div>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

// 목록 카테고리 줄 사이 간격 (DialogContent gap과 동일)
const ROW_GAP = 8;

// 박스 공통 스타일
const boxStyle = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #dde5eb",
  backgroundColor: "#ffffff",
};

function HygieneCategoryEditor({ open, accountName, categories, saving, onCancel, onSave }) {
  // 저장 전까지 편집하는 카테고리 목록 사본
  const [draft, setDraft] = useState([]);
  // 수정 중인 카테고리와 신규 추가 여부 (null이면 목록 화면)
  const [editing, setEditing] = useState(null);

  // 창을 열 때마다 현재 카테고리 설정으로 초기화
  useEffect(() => {
    if (!open) return;
    setDraft((categories || []).map((c) => ({ ...c })));
    setEditing(null);
  }, [open, categories]);

  // 목록 각 카테고리 줄 DOM (드래그 시작 시 위치·높이 측정용)
  const rowRefs = useRef({});
  // 드래그 진행 정보 (원래 위치 from, 놓일 위치 to, 시작 좌표, 줄 위치 목록)
  const dragRef = useRef(null);
  // 화면 표시용 드래그 상태 (from, to, 끌고 있는 거리 dy, null이면 드래그 중 아님)
  const [drag, setDrag] = useState(null);

  // 손잡이를 누르면 드래그 시작 (마우스·터치 공통, 손을 뗄 때까지 포인터 고정)
  const handleDragStart = (e, index) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      from: index,
      to: index,
      startY: e.clientY,
      rects: draft.map((c) => rowRefs.current[c.category_key]?.getBoundingClientRect()),
    };
    setDrag({ from: index, to: index, dy: 0 });
  };

  // 끄는 중 끌고 있는 줄의 가운데 위치 기준으로 놓일 자리 계산
  const handleDragMove = (e) => {
    const current = dragRef.current;
    if (!current) return;

    const dy = e.clientY - current.startY;
    const fromRect = current.rects[current.from];
    const center = fromRect.top + fromRect.height / 2 + dy;
    let to = current.from;

    current.rects.forEach((rect, index) => {
      const middle = rect.top + rect.height / 2;
      if (index < current.from && center < middle) to = Math.min(to, index);
      if (index > current.from && center > middle) to = Math.max(to, index);
    });

    current.to = to;
    setDrag({ from: current.from, to, dy });
  };

  // 손을 떼면 놓인 자리로 카테고리 순서 변경
  const handleDragEnd = () => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current || current.from === current.to) return;

    setDraft((list) => {
      const next = [...list];
      const [moved] = next.splice(current.from, 1);
      next.splice(current.to, 0, moved);
      return next;
    });
  };

  // 드래그 중 다른 줄이 비켜나는 거리 (끌고 있는 줄 높이만큼 위/아래로 이동)
  const getRowShift = (index) => {
    if (!drag || index === drag.from) return 0;
    const shift = (dragRef.current?.rects[drag.from]?.height || 0) + ROW_GAP;
    if (drag.from < index && index <= drag.to) return -shift;
    if (drag.to <= index && index < drag.from) return shift;
    return 0;
  };

  // 목록 사용/숨김 토글
  const toggleUse = (key, checked) => {
    setDraft((current) => current.map((c) => (c.category_key === key ? { ...c, use_yn: checked ? "Y" : "N" } : c)));
  };

  // 신규 카테고리 추가용 수정 화면 열기
  const openNewCategory = () => {
    setEditing({
      isNew: true,
      category: {
        category_key: `custom-${Date.now()}`,
        category_name: "",
        description: "",
        manage_point: "",
        use_yn: "Y",
        main_yn: "Y",
        status_yn: "Y",
      },
    });
  };

  // 수정 화면 입력값 변경
  const updateEditing = (patch) => {
    setEditing((current) => (current ? { ...current, category: { ...current.category, ...patch } } : current));
  };

  // 수정 화면 내용 목록 반영 (카테고리명 필수·중복 확인)
  const handleApplyEdit = () => {
    const name = String(editing.category.category_name || "").trim();

    if (!name) {
      Swal.fire({ title: "카테고리명 확인", text: "카테고리명을 입력해 주세요.", icon: "warning" });
      return;
    }

    if (draft.some((c) => c.category_key !== editing.category.category_key && c.category_name === name)) {
      Swal.fire({ title: "카테고리명 확인", text: "같은 이름의 카테고리가 이미 있습니다.", icon: "warning" });
      return;
    }

    const nextCategory = {
      ...editing.category,
      category_name: name,
      description: String(editing.category.description || "").trim(),
      manage_point: String(editing.category.manage_point || "").trim(),
    };

    setDraft((current) =>
      editing.isNew
        ? [...current, nextCategory]
        : current.map((c) => (c.category_key === nextCategory.category_key ? nextCategory : c))
    );
    setEditing(null);
  };

  // 삭제 확인 후 목록에서 카테고리 제거 (저장 시 서버에서 삭제 처리)
  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "카테고리 삭제",
      text: `${editing.category.category_name} 카테고리를 삭제할까요?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#9e9e9e",
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!result.isConfirmed) return;

    setDraft((current) => current.filter((c) => c.category_key !== editing.category.category_key));
    setEditing(null);
  };

  // 변경사항 저장 요청 (사용 중 카테고리 1개 이상 필수)
  const handleSaveAll = () => {
    if (!draft.some((c) => c.use_yn !== "N")) {
      Swal.fire({ title: "카테고리 확인", text: "사용하는 카테고리가 하나 이상 있어야 합니다.", icon: "warning" });
      return;
    }
    onSave(draft);
  };

  const category = editing?.category;

  return (
    <Dialog open={open} onClose={saving ? undefined : onCancel} fullWidth maxWidth="sm">
      {/* 창 제목 (거래처명) */}
      <DialogTitle sx={{ fontSize: 18 }}>
        {editing ? (editing.isNew ? "새 카테고리 추가" : `${category.category_name || "카테고리"} 카테고리 수정`) : "카테고리 편집"}
        {accountName && <span style={{ marginLeft: 8, fontSize: 13, color: "#7b809a" }}>{accountName}</span>}
      </DialogTitle>

      {editing ? (
        <>
          {/* 카테고리 이름·설명·표시 옵션 수정 영역 */}
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: "#7b809a" }}>카테고리는 조치 전·후 사진 등록이 기본으로 포함됩니다.</span>

            {/* 카테고리명 입력 */}
            <TextField
              size="small"
              label="카테고리명"
              value={category.category_name}
              onChange={(e) => updateEditing({ category_name: e.target.value })}
              placeholder="카테고리명을 입력해 주세요."
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            {/* 주요 확인내용 입력 (/ 로 구분하면 상세 화면에 항목별 표시) */}
            <TextField
              size="small"
              label="주요 확인내용"
              value={category.description}
              onChange={(e) => updateEditing({ description: e.target.value })}
              placeholder="예) 온도 / 소분라벨 / 청결"
              helperText="/ 로 구분하면 상세 화면에 항목별로 나뉘어 표시됩니다."
              InputLabelProps={{ shrink: true }}
              multiline
              minRows={2}
              fullWidth
            />

            {/* 관리 포인트 입력 (상세 화면 점검 안내에 표시) */}
            <TextField
              size="small"
              label="관리 포인트"
              value={category.manage_point}
              onChange={(e) => updateEditing({ manage_point: e.target.value })}
              placeholder="예) 냉장보관 및 표시사항 관리"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            {/* 모든 카테고리 공통 기본 입력 항목 안내 박스 */}
            <div style={{ ...boxStyle, backgroundColor: "#f7f9fa" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>기본 입력 구성</span>
                <Badge label="사진 기본" />
              </div>
              <div style={{ fontSize: 13, color: "#344252" }}>조치 전 사진 · 전달 메모 · 조치 후 사진 · 조치 내용 · 비고</div>
              <div style={{ fontSize: 12, color: "#7b809a" }}>사진 입력은 기본 구성으로 항상 포함됩니다.</div>
            </div>

            {/* 전체 요약 화면 표시 옵션 박스 */}
            <div style={{ ...boxStyle, display: "flex", flexDirection: "column", gap: 8 }}>
              <OptionRow
                title="메인 화면에 표시"
                description="사용자가 바로 접근할 수 있도록 표시"
                checked={category.main_yn !== "N"}
                onChange={(checked) => updateEditing({ main_yn: checked ? "Y" : "N" })}
              />
              <OptionRow
                title="점검 상태 표시"
                description="미점검·조치 필요 상태를 메인에 표시"
                checked={category.status_yn !== "N"}
                onChange={(checked) => updateEditing({ status_yn: checked ? "Y" : "N" })}
              />
            </div>

            {/* 전체 요약 카드 미리보기 박스 */}
            <div style={boxStyle}>
              <div style={{ fontSize: 12, color: "#7b809a", marginBottom: 4 }}>미리보기</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#344767" }}>
                  {String(category.category_name || "").trim() || "카테고리명"}
                </span>
                <Badge label="사진 기본" />
              </div>
              <div style={{ fontSize: 13, color: "#7b809a" }}>
                {String(category.description || "").trim() || "조치 전·후 사진과 메모 입력란이 자동으로 제공됩니다."}
              </div>
            </div>

            {/* 기존 카테고리 삭제 안내·버튼 줄 (신규 추가 시 미표시) */}
            {!editing.isNew && (
              <div
                style={{
                  ...boxStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderColor: "#f3c7c3",
                  backgroundColor: "#fff6f5",
                }}
              >
                <span style={{ fontSize: 13, color: "#a33a2f" }}>이 카테고리를 더 이상 사용하지 않나요?</span>
                <MDButton variant="outlined" color="error" size="small" onClick={handleDelete}>
                  삭제
                </MDButton>
              </div>
            )}
          </DialogContent>

          {/* 수정 취소 및 목록 반영 버튼 */}
          <DialogActions>
            <MDButton variant="outlined" color="secondary" onClick={() => setEditing(null)}>
              취소
            </MDButton>
            <MDButton variant="gradient" color="info" onClick={handleApplyEdit}>
              {editing.isNew ? "추가" : "수정 반영"}
            </MDButton>
          </DialogActions>
        </>
      ) : (
        <>
          {/* 카테고리 순서·사용·수정 목록 영역 */}
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 13, color: "#7b809a" }}>
              모든 카테고리는 사진 기록형이며 이름·순서·숨김 설정이 가능합니다.
            </span>

            {draft.map((c, index) => (
              // 카테고리 한 줄 (드래그 손잡이, 이름·설명, 수정 버튼, 사용 토글)
              <div
                key={c.category_key}
                ref={(el) => {
                  rowRefs.current[c.category_key] = el;
                }}
                style={{
                  ...boxStyle,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: c.use_yn === "N" && drag?.from !== index ? 0.55 : 1,
                  position: "relative",
                  ...(drag?.from === index
                    ? {
                        transform: `translateY(${drag.dy}px)`,
                        zIndex: 2,
                        borderColor: "#1A73E8",
                        boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                      }
                    : { transform: `translateY(${getRowShift(index)}px)`, transition: "transform 150ms ease" }),
                }}
              >
                {/* 순서 변경 드래그 손잡이 (누른 채로 위아래로 끌기) */}
                <div
                  onPointerDown={(e) => handleDragStart(e, index)}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: 4,
                    color: "#8a97a4",
                    cursor: drag ? "grabbing" : "grab",
                    touchAction: "none",
                  }}
                >
                  <DragHandleIcon sx={{ display: "block" }} />
                </div>
                {/* 카테고리명과 설명 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>{c.category_name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#7b809a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.description || "조치 전·후 사진 기록"}
                  </div>
                </div>
                {/* 수정 화면 이동 버튼 */}
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => setEditing({ isNew: false, category: { ...c } })}
                >
                  수정
                </MDButton>
                {/* 사용/숨김 토글 */}
                <Switch checked={c.use_yn !== "N"} onChange={(e) => toggleUse(c.category_key, e.target.checked)} />
              </div>
            ))}

            {/* 카테고리 추가 버튼 */}
            <MDButton variant="outlined" color="info" onClick={openNewCategory} sx={{ borderStyle: "dashed" }}>
              + 카테고리 추가
            </MDButton>
          </DialogContent>

          {/* 편집 취소 및 변경사항 저장 버튼 */}
          <DialogActions>
            <MDButton variant="outlined" color="secondary" disabled={saving} onClick={onCancel}>
              취소
            </MDButton>
            <MDButton variant="gradient" color="info" disabled={saving} onClick={handleSaveAll}>
              {saving ? "저장 중..." : "변경사항 저장"}
            </MDButton>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

export default HygieneCategoryEditor;
