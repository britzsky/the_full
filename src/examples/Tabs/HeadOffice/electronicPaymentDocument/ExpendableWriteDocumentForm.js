import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { TextField } from "@mui/material";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";

// 소모품 구매 품의서(E) 한 행 렌더링
// - 행 단위로 분리해 테이블 전체 재렌더 비용을 줄인다.
// - 입력 변경은 로컬 버퍼 상태를 갱신한다.
const ItemRow = React.memo(function ItemRow({
  row,
  idx,
  isMobile,
  onChangeLocalItem,
  onChangeItem,
  onBlurItem,
  openLink,
  gridInputStyle,
  td2Cell,
  td2CellCenter,
}) {
  const handleChangeItem =
    typeof onChangeLocalItem === "function"
      ? onChangeLocalItem
      : typeof onChangeItem === "function"
        ? onChangeItem
        : () => {};
  const handleBlurItem = typeof onBlurItem === "function" ? onBlurItem : () => {};

  return (
    <tr>
      {/* No 컬럼은 읽기 전용 */}
      <td style={td2CellCenter}>{row.no}</td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.item_name}
          onChange={(e) => handleChangeItem(idx, "item_name", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          sx={gridInputStyle}
        />
      </td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.qty}
          // 수량은 숫자 키패드 유도 + 입력값은 숫자만 유지
          onChange={(e) => handleChangeItem(idx, "qty", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          sx={gridInputStyle}
        />
      </td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.price}
          // 금액은 숫자 키패드 유도 + 입력값은 천단위 포맷 유지
          onChange={(e) => handleChangeItem(idx, "price", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          sx={gridInputStyle}
        />
      </td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.use_note}
          onChange={(e) => handleChangeItem(idx, "use_note", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          sx={gridInputStyle}
        />
      </td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.use_name}
          onChange={(e) => handleChangeItem(idx, "use_name", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          sx={gridInputStyle}
        />
      </td>

      <td style={td2Cell}>
        <MDBox sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            value={row.link}
            onChange={(e) => handleChangeItem(idx, "link", e.target.value)}
            onBlur={handleBlurItem}
            fullWidth
            sx={gridInputStyle}
          />
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            // 링크가 비어있으면 오픈 버튼 비활성화
            disabled={!String(row.link || "").trim()}
            onClick={() => openLink(row.link)}
            sx={{
              minWidth: isMobile ? 48 : 56,
              px: 1,
              fontSize: isMobile ? 10 : 11,
            }}
          >
            열기
          </MDButton>
        </MDBox>
      </td>

      <td style={td2Cell}>
        <TextField
          size="small"
          value={row.note}
          onChange={(e) => handleChangeItem(idx, "note", e.target.value)}
          onBlur={handleBlurItem}
          fullWidth
          sx={gridInputStyle}
        />
      </td>
    </tr>
  );
});

ItemRow.propTypes = {
  row: PropTypes.shape({
    no: PropTypes.number.isRequired,
    item_name: PropTypes.string.isRequired,
    qty: PropTypes.string.isRequired,
    price: PropTypes.string.isRequired,
    use_note: PropTypes.string.isRequired,
    use_name: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    note: PropTypes.string.isRequired,
  }).isRequired,
  idx: PropTypes.number.isRequired,
  isMobile: PropTypes.bool.isRequired,
  onChangeLocalItem: PropTypes.func,
  onChangeItem: PropTypes.func,
  onBlurItem: PropTypes.func,
  openLink: PropTypes.func.isRequired,
  gridInputStyle: PropTypes.object.isRequired,
  td2Cell: PropTypes.object.isRequired,
  td2CellCenter: PropTypes.object.isRequired,
};

function normalizeItemRow(row, idx) {
  return {
    no: Number(row?.no ?? idx + 1),
    item_name: String(row?.item_name ?? ""),
    qty: String(row?.qty ?? ""),
    price: String(row?.price ?? ""),
    use_note: String(row?.use_note ?? ""),
    use_name: String(row?.use_name ?? ""),
    link: String(row?.link ?? ""),
    note: String(row?.note ?? ""),
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((row, idx) => normalizeItemRow(row, idx));
}

function isSameRow(a, b) {
  return (
    a.no === b.no &&
    a.item_name === b.item_name &&
    a.qty === b.qty &&
    a.price === b.price &&
    a.use_note === b.use_note &&
    a.use_name === b.use_name &&
    a.link === b.link &&
    a.note === b.note
  );
}

function areItemsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!isSameRow(a[i], b[i])) return false;
  }
  return true;
}

function normalizeFieldValue(key, value) {
  const raw = String(value ?? "");
  if (key === "qty") return raw.replace(/[^\d]/g, "");
  if (key === "price") {
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("ko-KR");
  }
  return raw;
}

// 소모품 구매 품의서(E) 작성 본문 컴포넌트
// - 공통 헤더/요청정보/결재라인은 상위 SheetTab에 유지
// - 이 컴포넌트는 품목 내역 그리드 렌더링만 담당
function ExpendableWriteDocumentForm({
  sectionTitle,
  itemNameLabel,
  useNoteLabel,
  linkLabel,
  items,
  setItems,
  onItemsBufferChange,
  onChangeItem,
  isMobile,
  openLink,
  gridInputStyle,
  sectionSx,
  sectionTitleSx,
  th2Cell,
  td2Cell,
  td2CellCenter,
}) {
  // 상위 탭 전체 리렌더를 줄이기 위해 품목 입력은 로컬 버퍼로 먼저 받고,
  // 입력 중에는 부모 상태 갱신을 최소화하고 blur 시점에만 반영한다.
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const [localItems, setLocalItems] = useState(normalizedItems);
  const localItemsRef = useRef(localItems);

  useEffect(() => {
    setLocalItems((prev) => (areItemsEqual(prev, normalizedItems) ? prev : normalizedItems));
  }, [normalizedItems]);

  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  const commitToParent = useCallback(
    (nextItems) => {
      const normalizedNext = normalizeItems(nextItems);
      if (typeof onItemsBufferChange === "function") {
        onItemsBufferChange(normalizedNext);
      }

      if (typeof setItems !== "function") return;

      setItems((prev) => {
        const normalizedPrev = normalizeItems(prev);
        if (areItemsEqual(normalizedPrev, normalizedNext)) return prev;
        return normalizedNext;
      });
    },
    [onItemsBufferChange, setItems]
  );

  const onChangeLocalItem = useCallback((idx, key, value) => {
    setLocalItems((prev) => {
      const currentRow = prev[idx];
      if (!currentRow) return prev;
      const nextValue = normalizeFieldValue(key, value);
      if (currentRow[key] === nextValue) return prev;

      const next = [...prev];
      next[idx] = { ...currentRow, [key]: nextValue };
      localItemsRef.current = next;
      if (typeof onItemsBufferChange === "function") {
        onItemsBufferChange(next);
      }
      return next;
    });
  }, [onItemsBufferChange]);

  const onBlurItem = useCallback(() => {
    commitToParent(localItemsRef.current);
  }, [commitToParent]);

  return (
    <MDBox sx={sectionSx}>
      <MDBox sx={sectionTitleSx}>{sectionTitle}</MDBox>
      <MDBox sx={{ overflowX: "auto" }}>
        {/* 컬럼 폭을 고정해 스크롤 시에도 입력 폼 정렬이 흔들리지 않게 한다. */}
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: isMobile ? 46 : 54 }} />
            <col style={{ width: isMobile ? 180 : 240 }} />
            <col style={{ width: isMobile ? 70 : 82 }} />
            <col style={{ width: isMobile ? 84 : 98 }} />
            <col style={{ width: isMobile ? 180 : 240 }} />
            <col style={{ width: isMobile ? 140 : 170 }} />
            <col style={{ width: isMobile ? 180 : 220 }} />
            <col style={{ width: isMobile ? 130 : 160 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th2Cell}>No</th>
              <th style={th2Cell}>{itemNameLabel}</th>
              <th style={th2Cell}>수량</th>
              <th style={th2Cell}>금액(원)</th>
              <th style={th2Cell}>{useNoteLabel}</th>
              <th style={th2Cell}>결제 업체명</th>
              <th style={th2Cell}>{linkLabel}</th>
              <th style={th2Cell}>비고</th>
            </tr>
          </thead>
          <tbody>
            {/* key는 row.no를 기준으로 고정해 행 입력 포커스 이탈을 줄인다. */}
            {localItems.map((row, idx) => (
              <ItemRow
                key={row.no}
                row={row}
                idx={idx}
                isMobile={isMobile}
                onChangeLocalItem={onChangeLocalItem}
                onChangeItem={onChangeItem}
                onBlurItem={onBlurItem}
                openLink={openLink}
                gridInputStyle={gridInputStyle}
                td2Cell={td2Cell}
                td2CellCenter={td2CellCenter}
              />
            ))}
          </tbody>
        </table>
      </MDBox>
    </MDBox>
  );
}

// 문서별 컴포넌트로 분리되더라도 기존 상위 계약(props)은 그대로 유지한다.
ExpendableWriteDocumentForm.propTypes = {
  sectionTitle: PropTypes.string.isRequired,
  itemNameLabel: PropTypes.string.isRequired,
  useNoteLabel: PropTypes.string.isRequired,
  linkLabel: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  setItems: PropTypes.func,
  onItemsBufferChange: PropTypes.func,
  onChangeItem: PropTypes.func,
  isMobile: PropTypes.bool.isRequired,
  openLink: PropTypes.func.isRequired,
  gridInputStyle: PropTypes.object.isRequired,
  sectionSx: PropTypes.object.isRequired,
  sectionTitleSx: PropTypes.object.isRequired,
  th2Cell: PropTypes.object.isRequired,
  td2Cell: PropTypes.object.isRequired,
  td2CellCenter: PropTypes.object.isRequired,
};

export default React.memo(ExpendableWriteDocumentForm);
