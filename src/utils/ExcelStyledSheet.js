// 엑셀 서식 미리보기: ExcelJS로 시트를 읽어 병합·열 너비·행 높이·글꼴·채우기·테두리·정렬과 시트 안 그림을 살려 표로 그리는 컴포넌트
// .xls처럼 ExcelJS가 못 읽는 파일은 SheetJS로 값과 병합만 그림
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { Minus, Plus } from "lucide-react";

// 화면에 그릴 최대 행·열 (큰 파일 렌더 부하 방지)
const MAX_ROWS = 300;
const MAX_COLS = 60;
// 엑셀 기본 열 너비(문자 수)·행 높이(pt)
const DEFAULT_COL_WIDTH = 8.43;
const DEFAULT_ROW_HEIGHT = 15;
// 셀 테두리가 없을 때 보여주는 눈금선
const GRID_LINE = "1px solid #e3e3e3";
// 그림 위치 오프셋 단위 변환 (EMU → px)
const EMU_PER_PX = 9525;

// 오피스 기본 테마 색 (테마 XML을 못 읽을 때 사용, 순서: lt1 dk1 lt2 dk2 accent1~6 hlink folHlink)
const DEFAULT_THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];
// 엑셀 기본 색인 색 (indexed 0~63)
const INDEXED_COLORS = [
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
  "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
  "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
  "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
  "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
  "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
];
// 테두리 종류별 CSS (굵기·선 모양)
const BORDER_STYLE = {
  thin: "1px solid",
  hair: "1px solid",
  dotted: "1px dotted",
  dashed: "1px dashed",
  dashDot: "1px dashed",
  dashDotDot: "1px dashed",
  medium: "2px solid",
  mediumDashed: "2px dashed",
  mediumDashDot: "2px dashed",
  mediumDashDotDot: "2px dashed",
  slantDashDot: "2px dashed",
  thick: "3px solid",
  double: "3px double",
};

// 통합문서 테마 XML에서 테마 색 목록 추출 (실패 시 기본 테마)
function readThemeColors(workbook) {
  try {
    const xml = workbook?._themes?.theme1;
    if (!xml) return DEFAULT_THEME;
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const scheme = doc.getElementsByTagName("a:clrScheme")[0];
    if (!scheme) return DEFAULT_THEME;
    const pick = (tag) => {
      const node = scheme.getElementsByTagName(`a:${tag}`)[0];
      const srgb = node?.getElementsByTagName("a:srgbClr")[0]?.getAttribute("val");
      const sys = node?.getElementsByTagName("a:sysClr")[0]?.getAttribute("lastClr");
      return srgb || sys || null;
    };
    const order = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
    return order.map((tag, i) => pick(tag) || DEFAULT_THEME[i]);
  } catch {
    return DEFAULT_THEME;
  }
}

// 테마 색 밝기 보정 (tint: -1 어둡게 ~ 1 밝게)
function applyTint(hex, tint) {
  if (!tint) return hex;
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const next = ch.map((c) => Math.round(tint < 0 ? c * (1 + tint) : c + (255 - c) * tint));
  return next.map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("");
}

// ExcelJS 색 객체를 CSS 색으로 변환 (argb / theme+tint / indexed)
function toCssColor(color, theme) {
  if (!color) return null;
  if (color.argb) return `#${String(color.argb).slice(-6)}`;
  if (color.theme !== undefined) return `#${applyTint(theme[color.theme] || "000000", color.tint)}`;
  if (color.indexed !== undefined) {
    const hex = INDEXED_COLORS[color.indexed];
    return hex ? `#${hex}` : null;
  }
  return null;
}

// 테두리 한 변을 CSS로 변환 (없으면 null)
const toCssBorder = (side, theme) =>
  side?.style ? `${BORDER_STYLE[side.style] || "1px solid"} ${toCssColor(side.color, theme) || "#000"}` : null;

// 셀 표시 글자 (날짜는 YYYY-MM-DD, 천 단위 서식 숫자는 콤마, 그 외 ExcelJS 표시값)
function cellText(cell) {
  const { value } = cell;
  if (value === null || value === undefined) return "";
  const raw = value.result !== undefined ? value.result : value;
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "number" && /#,##0/.test(cell.numFmt || "")) {
    const decimals = (String(cell.numFmt).split(".")[1] || "").replace(/[^0#]/g, "").length;
    return raw.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (typeof raw === "number" && /%/.test(cell.numFmt || "")) return `${Math.round(raw * 1000) / 10}%`;
  try {
    return cell.text ?? String(raw);
  } catch {
    return String(raw);
  }
}

// ExcelJS 워크시트를 그리기용 모델로 변환 (열 너비, 행, 셀 스타일, 병합 범위, 그림 위치)
// imageUrlOf(imageId): 통합문서 그림 id → 화면용 blob URL
function buildStyledSheet(ws, theme, imageUrlOf) {
  const rowCount = Math.min(ws.rowCount || 0, MAX_ROWS);
  const colCount = Math.min(ws.columnCount || 0, MAX_COLS);
  const showGrid = ws.views?.[0]?.showGridLines !== false;

  // 병합 범위: 왼쪽 위 셀 → { rowSpan, colSpan, r2, c2 }, 가려지는 셀 목록
  const mergeStart = {};
  const covered = new Set();
  (ws.model?.merges || []).forEach((range) => {
    const [a, b] = range.split(":");
    const tl = ws.getCell(a);
    const br = ws.getCell(b);
    const r1 = Number(tl.row);
    const c1 = Number(tl.col);
    const r2 = Number(br.row);
    const c2 = Number(br.col);
    mergeStart[`${r1}:${c1}`] = { rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1, r2, c2 };
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) if (r !== r1 || c !== c1) covered.add(`${r}:${c}`);
    }
  });

  const hiddenCols = new Set();
  const cols = [];
  for (let c = 1; c <= colCount; c += 1) {
    const col = ws.getColumn(c);
    if (col.hidden) hiddenCols.add(c);
    else cols.push({ c, width: Math.round((col.width || DEFAULT_COL_WIDTH) * 7 + 5) });
  }

  // 셀 한 변의 테두리 (자기 테두리 → 맞닿은 셀의 반대쪽 테두리 → 눈금선 순)
  const edge = (r, c, side, nr, nc, opposite) =>
    toCssBorder(ws.getCell(r, c).border?.[side], theme) ||
    (nr > 0 && nc > 0 ? toCssBorder(ws.getCell(nr, nc).border?.[opposite], theme) : null) ||
    (showGrid ? GRID_LINE : "none");

  const rows = [];
  for (let r = 1; r <= rowCount; r += 1) {
    const row = ws.getRow(r);
    if (!row.hidden) {
      const cells = [];
      cols.forEach(({ c }) => {
        const key = `${r}:${c}`;
        if (covered.has(key)) return;
        const merge = mergeStart[key];
        const cell = ws.getCell(r, c);
        const { font = {}, fill, alignment = {} } = cell.style || {};
        const text = cellText(cell);
        const isNumber = typeof (cell.value?.result ?? cell.value) === "number";
        // 병합 셀은 오른쪽·아래 테두리를 병합 끝 셀에서 가져옴
        const rEnd = merge ? merge.r2 : r;
        const cEnd = merge ? merge.c2 : c;
        // 병합 안에서 숨김 열은 colSpan에서 제외
        let colSpan = merge?.colSpan || 1;
        if (merge) for (let cc = c; cc <= cEnd; cc += 1) if (hiddenCols.has(cc)) colSpan -= 1;
        const fillColor = fill?.type === "pattern" && fill.pattern !== "none" ? toCssColor(fill.fgColor, theme) : null;
        const vertical = { top: "top", middle: "middle", center: "middle", bottom: "bottom" }[alignment.vertical] || "bottom";
        cells.push({
          key,
          text,
          rowSpan: merge?.rowSpan || 1,
          colSpan: Math.max(colSpan, 1),
          style: {
            backgroundColor: fillColor || "#ffffff",
            color: toCssColor(font.color, theme) || "#000000",
            fontWeight: font.bold ? 700 : 400,
            fontStyle: font.italic ? "italic" : "normal",
            textDecoration: [font.underline ? "underline" : "", font.strike ? "line-through" : ""].join(" ").trim() || "none",
            fontSize: `${((font.size || 11) * 4) / 3}px`,
            fontFamily: font.name ? `"${font.name}", "맑은 고딕", sans-serif` : '"맑은 고딕", sans-serif',
            textAlign:
              { left: "left", center: "center", centerContinuous: "center", right: "right", justify: "justify", distributed: "justify" }[
                alignment.horizontal
              ] || (isNumber ? "right" : "left"),
            verticalAlign: vertical,
            whiteSpace: alignment.wrapText ? "pre-wrap" : "pre",
            wordBreak: alignment.wrapText ? "break-all" : "normal",
            paddingLeft: alignment.indent ? alignment.indent * 9 + 2 : 2,
            borderTop: edge(r, c, "top", r - 1, c, "bottom"),
            borderLeft: edge(r, c, "left", r, c - 1, "right"),
            borderBottom: edge(rEnd, c, "bottom", rEnd + 1, c, "top"),
            borderRight: edge(r, cEnd, "right", r, cEnd + 1, "left"),
          },
        });
      });
      rows.push({ r, height: Math.round(((row.height || DEFAULT_ROW_HEIGHT) * 4) / 3), cells });
    }
  }
  // 그림 배치: 열·행 시작 위치(px)를 누적해 그림 기준 셀 + 셀 안 오프셋으로 좌표 계산 (숨김 행·열은 0 크기)
  // colStart[c]: c열 왼쪽 끝, rowStart[r]: r행 위쪽 끝 (1부터, 마지막 칸은 표 끝)
  const colWidth = Object.fromEntries(cols.map((col) => [col.c, col.width]));
  const rowHeight = Object.fromEntries(rows.map((row) => [row.r, row.height]));
  const colStart = [0, 0];
  for (let c = 1; c <= colCount; c += 1) colStart[c + 1] = colStart[c] + (colWidth[c] || 0);
  const rowStart = [0, 0];
  for (let r = 1; r <= rowCount; r += 1) rowStart[r + 1] = rowStart[r] + (rowHeight[r] || 0);
  // 0부터 세는 열·행 번호와 EMU 오프셋을 px 좌표로 변환 (표 범위를 넘으면 끝으로 맞춤)
  const xOf = (nativeCol, off = 0) => colStart[Math.min(nativeCol + 1, colCount + 1)] + off / EMU_PER_PX;
  const yOf = (nativeRow, off = 0) => rowStart[Math.min(nativeRow + 1, rowCount + 1)] + off / EMU_PER_PX;
  const images = [];
  (ws.getImages ? ws.getImages() : []).forEach((img, i) => {
    const { tl, br, ext } = img.range || {};
    const url = imageUrlOf(img.imageId);
    if (!tl || !url) return;
    const left = xOf(tl.nativeCol, tl.nativeColOff);
    const top = yOf(tl.nativeRow, tl.nativeRowOff);
    const width = br ? xOf(br.nativeCol, br.nativeColOff) - left : ext?.width || 0;
    const height = br ? yOf(br.nativeRow, br.nativeRowOff) - top : ext?.height || 0;
    if (width > 0 && height > 0 && top < rowStart[rowCount + 1]) images.push({ key: `img-${i}`, url, left, top, width, height });
  });

  return { cols, rows, images, truncated: (ws.rowCount || 0) > MAX_ROWS || (ws.columnCount || 0) > MAX_COLS };
}

// SheetJS 워크시트를 그리기용 모델로 변환 (.xls 대체 경로: 값·병합·열 너비만)
function buildPlainSheet(ws) {
  const ref = ws["!ref"];
  if (!ref) return { cols: [], rows: [], truncated: false };
  const range = XLSX.utils.decode_range(ref);
  const rowCount = Math.min(range.e.r + 1, MAX_ROWS);
  const colCount = Math.min(range.e.c + 1, MAX_COLS);
  const mergeStart = {};
  const covered = new Set();
  (ws["!merges"] || []).forEach(({ s, e }) => {
    mergeStart[`${s.r}:${s.c}`] = { rowSpan: e.r - s.r + 1, colSpan: e.c - s.c + 1 };
    for (let r = s.r; r <= e.r; r += 1) for (let c = s.c; c <= e.c; c += 1) if (r !== s.r || c !== s.c) covered.add(`${r}:${c}`);
  });
  const cols = Array.from({ length: colCount }, (_, c) => ({ c, width: Math.round((ws["!cols"]?.[c]?.wch || DEFAULT_COL_WIDTH) * 7 + 5) }));
  const rows = [];
  for (let r = 0; r < rowCount; r += 1) {
    const cells = [];
    for (let c = 0; c < colCount; c += 1) {
      const key = `${r}:${c}`;
      if (!covered.has(key)) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        cells.push({
          key,
          text: cell ? String(cell.w ?? cell.v ?? "") : "",
          rowSpan: mergeStart[key]?.rowSpan || 1,
          colSpan: mergeStart[key]?.colSpan || 1,
          style: { border: GRID_LINE, fontSize: "14px", whiteSpace: "pre", verticalAlign: "bottom", textAlign: cell?.t === "n" ? "right" : "left", paddingLeft: 2 },
        });
      }
    }
    rows.push({ r, height: Math.round(DEFAULT_ROW_HEIGHT * (4 / 3)), cells });
  }
  return { cols, rows, images: [], truncated: range.e.r + 1 > MAX_ROWS || range.e.c + 1 > MAX_COLS };
}

// 파일 Blob을 읽어 시트별 그리기 모델 목록으로 변환 (xlsx: 서식·그림 포함, 실패 시 값만)
// 반환: { sheets, urls: 만든 그림 blob URL 목록 (화면을 닫을 때 해제) }
async function loadSheets(blob) {
  const buffer = await blob.arrayBuffer();
  const urls = [];
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const theme = readThemeColors(workbook);
    // 그림 id별 blob URL (여러 시트에서 같은 그림을 쓰면 한 번만 만듦)
    const imageUrls = {};
    const imageUrlOf = (id) => {
      if (imageUrls[id] === undefined) {
        const media = workbook.getImage(id);
        imageUrls[id] = media?.buffer ? URL.createObjectURL(new Blob([media.buffer], { type: `image/${media.extension || "png"}` })) : null;
        if (imageUrls[id]) urls.push(imageUrls[id]);
      }
      return imageUrls[id];
    };
    const sheets = workbook.worksheets
      .filter((ws) => ws.state !== "hidden" && ws.state !== "veryHidden")
      .map((ws) => ({ name: ws.name, styled: true, ...buildStyledSheet(ws, theme, imageUrlOf) }));
    if (sheets.length) return { sheets, urls };
  } catch {
    // ExcelJS가 못 읽는 형식(.xls 등)은 아래 SheetJS 경로로 처리
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.length = 0;
  }
  const workbook = XLSX.read(buffer, { type: "array" });
  return { sheets: workbook.SheetNames.map((name) => ({ name, styled: false, ...buildPlainSheet(workbook.Sheets[name]) })), urls };
}

// 미리보기 상단 도구 버튼 스타일
const toolButtonStyle = {
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d7de",
  borderRadius: 6,
  backgroundColor: "#ffffff",
  color: "#374151",
  cursor: "pointer",
};

// url: 엑셀 파일 주소, fetchBlob: 주소로 파일 Blob을 받아오는 함수 (PreviewOverlay 공용 로더)
function ExcelStyledSheet({ url, fetchBlob }) {
  // 시트 목록, 선택 시트 순번, 로딩·오류 상태, 확대 배율
  const [state, setState] = useState({ loading: true, sheets: [], error: "" });
  const [sheetIndex, setSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  // 파일 주소가 바뀌면 시트를 다시 읽음
  useEffect(() => {
    let cancelled = false;
    // 이번 파일에서 만든 그림 blob URL (파일이 바뀌거나 닫힐 때 해제)
    let imageUrls = [];
    setState({ loading: true, sheets: [], error: "" });
    setSheetIndex(0);
    setZoom(1);
    (async () => {
      try {
        const { sheets, urls } = await loadSheets(await fetchBlob(url));
        imageUrls = urls;
        if (cancelled) {
          urls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        setState({ loading: false, sheets, error: sheets.length ? "" : "시트 정보를 찾을 수 없습니다." });
      } catch {
        if (!cancelled) setState({ loading: false, sheets: [], error: "엑셀 미리보기를 불러오지 못했습니다." });
      }
    })();
    return () => {
      cancelled = true;
      imageUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url, fetchBlob]);

  const sheet = state.sheets[sheetIndex];
  const tableWidth = useMemo(() => (sheet ? sheet.cols.reduce((sum, col) => sum + col.width, 0) : 0), [sheet]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      {/* 시트 탭·확대 축소 도구 줄 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto", minWidth: 0 }}>
          {state.sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setSheetIndex(i)}
              style={{
                height: 26,
                padding: "0 10px",
                border: `1px solid ${i === sheetIndex ? "#1e7b45" : "#d0d7de"}`,
                borderRadius: 6,
                backgroundColor: i === sheetIndex ? "#e8f5e9" : "#ffffff",
                color: i === sheetIndex ? "#1e7b45" : "#374151",
                fontSize: 12,
                fontWeight: i === sheetIndex ? 700 : 500,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button type="button" title="축소" style={toolButtonStyle} onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}>
          <Minus size={14} />
        </button>
        <span style={{ width: 40, textAlign: "center", fontSize: 12, color: "#374151" }}>{Math.round(zoom * 100)}%</span>
        <button type="button" title="확대" style={toolButtonStyle} onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}>
          <Plus size={14} />
        </button>
      </div>

      {/* 시트 본문 (서식 표) */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {state.loading && <div style={{ padding: 16, fontSize: 12, color: "#6b7280" }}>엑셀 미리보기 로딩 중...</div>}
        {!state.loading && state.error && <div style={{ padding: 16, fontSize: 12, color: "#d32f2f" }}>{state.error}</div>}
        {sheet && (
          <div style={{ zoom, padding: 8 }}>
            {/* 표와 그림 겹침 영역 (그림은 셀 기준 좌표로 표 위에 배치) */}
            <div style={{ position: "relative", width: tableWidth }}>
            <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: tableWidth }}>
              <colgroup>
                {sheet.cols.map((col) => (
                  <col key={col.c} style={{ width: col.width }} />
                ))}
              </colgroup>
              <tbody>
                {sheet.rows.map((row) => (
                  <tr key={row.r} style={{ height: row.height }}>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.key}
                        rowSpan={cell.rowSpan}
                        colSpan={cell.colSpan}
                        style={{ ...cell.style, paddingTop: 0, paddingBottom: 0, paddingRight: 2, overflow: "hidden", lineHeight: 1.25 }}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sheet.images.map((img) => (
              <img
                key={img.key}
                src={img.url}
                alt=""
                style={{ position: "absolute", left: img.left, top: img.top, width: img.width, height: img.height, objectFit: "fill", pointerEvents: "none" }}
              />
            ))}
            </div>
            {/* 표시 범위 안내 (행·열 제한, 서식 미지원 형식) */}
            {(sheet.truncated || !sheet.styled) && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
                {sheet.truncated && `미리보기는 ${MAX_ROWS}행 · ${MAX_COLS}열까지만 표시합니다. `}
                {!sheet.styled && "이 형식(.xls)은 서식 없이 값만 표시합니다."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ExcelStyledSheet.propTypes = {
  url: PropTypes.string.isRequired,
  fetchBlob: PropTypes.func.isRequired,
};

export default ExcelStyledSheet;
