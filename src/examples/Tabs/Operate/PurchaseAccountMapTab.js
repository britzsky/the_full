// 구입 업장관리 탭 (관리자 ↔ 거래처 매핑)
// - 왼쪽: 관리자 목록 (department=5, position=2,3 단일 선택)
// - 가운데: 선택된 관리자에 매핑된 거래처 목록
// - 오른쪽: 전체 거래처 목록 (노란색 복수 선택 후 ← 버튼으로 추가)
/* eslint-disable react/function-component-definition */
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { useTheme, useMediaQuery } from "@mui/material";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import LoadingScreen from "layouts/loading/loadingscreen";
import usePurchaseAccountMapData from "./purchaseAccountMapData";

// ─── SimpleTable 공통 컴포넌트 ───────────────────────────────────────────────
// AccountFieldMemberTab 동일 구조 사용 (스크롤 유지, 행 선택 강조)
const SimpleTable = React.memo(function SimpleTable({
  title,
  columns,
  rows,
  selectedRowKey,
  onRowClick,
  scrollRef,
  onBeforeAction,
  isMobile,
  getRowKey,
  tableHeight,
}) {
  // 고정 제목과 스크롤 표를 함께 배치하는 테이블 영역
  const tableSx = {
    flex: 1,
    height: tableHeight ? `${tableHeight}px` : isMobile ? "62dvh" : "68dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontSize: "11.5px",
    overflowAnchor: "none",
    backgroundColor: "#fff",
    position: "relative",
  };

  // 표 본문이 파란색 제목 영역을 침범하지 않도록 제목 아래에서만 스크롤
  const tableScrollSx = {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overflowAnchor: "none",
    position: "relative",
    "& table": {
      borderCollapse: "separate",
      width: "100%",
      tableLayout: "fixed",
      borderSpacing: 0,
      overflowAnchor: "none",
    },
    // th: overflow hidden 제거 — sticky 동작 방해 방지
    "& th": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "6px",
      fontSize: isMobile ? "10px" : "11.5px",
      whiteSpace: "nowrap",
      verticalAlign: "middle",
      cursor: "default",
      overflowAnchor: "none",
    },
    "& td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "6px",
      fontSize: isMobile ? "10px" : "11.5px",
      whiteSpace: "pre-wrap",
      verticalAlign: "middle",
      overflow: "hidden",
      textOverflow: "ellipsis",
      cursor: "pointer",
      overflowAnchor: "none",
    },
  };

  // 기본 행 키 생성 (user_id / account_id / idx / 배열 인덱스 순서 fallback)
  const defaultGetRowKey = useCallback(
    (r, idx) => {
      const primary = r?.user_id ?? r?.account_id ?? r?.idx ?? r?.id ?? idx;
      return `${String(primary)}-${String(idx)}`;
    },
    []
  );

  const resolveRowKey = getRowKey || defaultGetRowKey;

  return (
    <Box
      sx={tableSx}
      onMouseDownCapture={(e) => onBeforeAction?.(e)}
      onClickCapture={(e) => onBeforeAction?.(e)}
    >
      {/* 테이블 타이틀 헤더 */}
      <MDBox
        sx={{
          flexShrink: 0,
          backgroundColor: (theme) => theme.palette.info.main,
          backgroundImage: "none",
          opacity: 1,
          isolation: "isolate",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          margin: 0,
          borderRadius: 2,
        }}
        py={0.8}
        px={2}
        variant="gradient"
        bgColor="info"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <MDTypography variant={isMobile ? "button" : "h6"} color="white">
          {title}
        </MDTypography>
      </MDBox>

      <Box sx={tableScrollSx} ref={scrollRef}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    width: c.width || 120,
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                    backgroundColor: "#f0f0f0",
                    userSelect: "none",
                    cursor: "default",
                    boxShadow: "0 2px 0 #c0c0c0",
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(rows || []).map((r, idx) => {
              // 선택된 행 여부 (노란색 강조)
              const isSelected = selectedRowKey ? Boolean(selectedRowKey(r, idx)) : false;
              const stableKey = resolveRowKey(r, idx);

              return (
                <tr
                  key={stableKey}
                  onMouseDownCapture={(e) => onBeforeAction?.(e)}
                  onClick={(e) => onRowClick?.(r, idx, e)}
                  style={{
                    background: isSelected ? "rgba(255, 215, 0, 0.38)" : "transparent",
                  }}
                >
                  {columns.map((c) => {
                    const v = r?.[c.key] ?? "";
                    return (
                      <td key={c.key} title={String(v)} style={{ fontSize: "11.5px" }}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Box>
  );
});

// SimpleTable PropTypes 정의
SimpleTable.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
  selectedRowKey: PropTypes.func,
  onRowClick: PropTypes.func,
  scrollRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  onBeforeAction: PropTypes.func,
  isMobile: PropTypes.bool.isRequired,
  getRowKey: PropTypes.func,
  tableHeight: PropTypes.number,
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function PurchaseAccountMapTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 데이터 훅 (purchaseAccountMapData.js)
  const { managerRows, accountRows, loading, fetchMapList, saveMap } = usePurchaseAccountMapData();

  // 선택된 관리자 (왼쪽 단일 선택)
  const [selectedManager, setSelectedManager] = useState(null);
  // 현재 선택된 관리자의 매핑된 거래처 목록 (가운데)
  const [mapRows, setMapRows] = useState([]);
  // 오른쪽 거래처 복수 선택 Set (account_id 문자열)
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set());
  // 매핑 저장 진행 중 여부
  const [mapSaving, setMapSaving] = useState(false);

  // 스크롤 위치 복원용 ref
  const leftScrollRef = useRef(null);
  const middleScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const leftTopRef = useRef(0);
  const pendingLeftRestoreRef = useRef(false);
  const tableStartRef = useRef(null);
  const [tableHeight, setTableHeight] = useState(null);

  // 표 시작 위치부터 왼쪽 네비게이션 하단 여백까지의 높이를 계산
  useLayoutEffect(() => {
    if (loading || !tableStartRef.current) return undefined;

    const updateTableHeight = () => {
      if (!tableStartRef.current) return;

      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const tableTop = tableStartRef.current.getBoundingClientRect().top;
      // 카드와 그리드의 하단 여백을 확보해 화면 전체 스크롤이 생기지 않도록 조정
      const sidenavBottomMargin = 64;
      const nextHeight = Math.max(320, Math.floor(viewportHeight - tableTop - sidenavBottomMargin));

      setTableHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const frameId = requestAnimationFrame(updateTableHeight);
    window.addEventListener("resize", updateTableHeight);
    window.visualViewport?.addEventListener("resize", updateTableHeight);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateTableHeight);
      window.visualViewport?.removeEventListener("resize", updateTableHeight);
    };
  }, [loading, isMobile]);

  // 왼쪽 스크롤 위치 복원 (관리자 목록)
  useLayoutEffect(() => {
    if (!pendingLeftRestoreRef.current) return;
    pendingLeftRestoreRef.current = false;
    const el = leftScrollRef.current;
    if (!el) return;
    const top = leftTopRef.current;
    el.scrollTop = top;
    requestAnimationFrame(() => {
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = top;
    });
  }, [selectedManager?.user_id, mapRows?.length]);

  // 왼쪽 스크롤 위치 캡처
  const captureLeftScroll = useCallback(() => {
    const el = leftScrollRef.current;
    if (!el) return;
    leftTopRef.current = el.scrollTop;
    pendingLeftRestoreRef.current = true;
  }, []);

  // 관리자 클릭 → 매핑 거래처 목록 로드
  const handleClickManager = useCallback(async (manager) => {
    setSelectedManager(manager);
    setSelectedAccountIds(new Set());
    setMapRows([]);

    if (middleScrollRef.current) middleScrollRef.current.scrollTop = 0;
    if (!manager?.user_id) return;

    const list = await fetchMapList(manager.user_id);
    setMapRows(list);
  }, [fetchMapList]);

  // 오른쪽 거래처 클릭 → 복수 선택 토글 (노란색 강조)
  const handleClickAccount = useCallback((account) => {
    const id = String(account?.account_id ?? "");
    if (!id) return;

    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ← 버튼 클릭 → 선택된 거래처를 가운데 매핑 목록에 추가
  const handlePushToMap = useCallback(() => {
    if (!selectedManager?.user_id || selectedAccountIds.size === 0) return;

    // 이미 매핑된 거래처 ID Set
    const existingIds = new Set(mapRows.map((r) => String(r.account_id ?? "")));

    // 새로 추가할 거래처 (중복 제외)
    const toAdd = accountRows.filter(
      (acc) =>
        selectedAccountIds.has(String(acc.account_id ?? "")) &&
        !existingIds.has(String(acc.account_id ?? ""))
    );

    if (toAdd.length > 0) {
      setMapRows((prev) => [...prev, ...toAdd]);
    }

    // 오른쪽 선택 전체 해제
    setSelectedAccountIds(new Set());
  }, [selectedManager, selectedAccountIds, mapRows, accountRows]);

  // 매핑 저장 핸들러
  const handleSaveMap = useCallback(async () => {
    if (!selectedManager?.user_id) {
      Swal.fire("안내", "관리자를 먼저 선택하세요.", "info");
      return;
    }

    setMapSaving(true);
    try {
      const res = await saveMap(selectedManager.user_id, mapRows);

      const ok = res?.data?.code === 200 || res?.status === 200;
      if (!ok) {
        Swal.fire("실패", res?.data?.message || "저장 실패", "error");
        return;
      }

      await Swal.fire({
        title: "저장",
        text: "매핑이 저장되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });

      // 저장 후 최신 매핑 재조회
      const list = await fetchMapList(selectedManager.user_id);
      setMapRows(list);
    } catch (e) {
      Swal.fire("실패", e?.message || "저장 중 오류", "error");
    } finally {
      setMapSaving(false);
    }
  }, [selectedManager, mapRows, saveMap, fetchMapList]);


  // ─── 컬럼 정의 ──────────────────────────────────────────────────────────────

  // 관리자 목록 컬럼
  const managerColumns = useMemo(
    () => [
      { key: "user_name", label: "이름", width: 80 },
      { key: "position_name", label: "직책", width: 70 },
      { key: "department_name", label: "부서", width: 70 },
    ],
    []
  );

  // 매핑된 거래처 컬럼 (가운데 - 거래처명만 표시)
  const mapColumns = useMemo(
    () => [
      { key: "account_name", label: "거래처명", width: 200 },
    ],
    []
  );

  // 전체 거래처 컬럼 (오른쪽 복수선택 - 거래처명만 표시)
  const accountColumns = useMemo(
    () => [
      { key: "account_name", label: "거래처명", width: 280 },
    ],
    []
  );

  // 로딩 화면
  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 버튼 바 (저장) */}
      <MDBox
        pt={0}
        pb={1}
        sx={{ display: "flex", justifyContent: "flex-end" }}
      >
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSaveMap}
          disabled={!selectedManager?.user_id || mapSaving}
        >
          {mapSaving ? "저장 중..." : "저장"}
        </MDButton>
      </MDBox>

      {/* 3단 매핑 레이아웃 */}
      <Box ref={tableStartRef} sx={{ height: 0 }} />
      <Grid container spacing={1} alignItems="stretch">

        {/* ── 왼쪽: 관리자 목록 (단일 선택) ──────────────────────────────── */}
        <Grid item xs={12} md={3}>
          <SimpleTable
            isMobile={isMobile}
            tableHeight={tableHeight}
            title="관리자 목록"
            columns={managerColumns}
            rows={managerRows || []}
            selectedRowKey={(r) => r?.user_id === selectedManager?.user_id}
            onBeforeAction={captureLeftScroll}
            scrollRef={leftScrollRef}
            onRowClick={(r) => {
              captureLeftScroll();
              handleClickManager(r);
            }}
            getRowKey={(r, idx) => `manager-${String(r?.user_id ?? idx)}`}
          />
        </Grid>

        {/* ── 가운데: 매핑된 거래처 목록 ──────────────────────────────────── */}
        <Grid item xs={12} md={3}>
          <SimpleTable
            key={
              selectedManager?.user_id
                ? `map-table-${selectedManager.user_id}`
                : "map-table-empty"
            }
            isMobile={isMobile}
            tableHeight={tableHeight}
            title={
              selectedManager
                ? `매핑 거래처 (${selectedManager.user_name || selectedManager.user_id})`
                : "매핑 거래처 (관리자 선택)"
            }
            columns={mapColumns}
            rows={mapRows || []}
            scrollRef={middleScrollRef}
            onBeforeAction={null}
            getRowKey={(r, idx) => `map-${String(r?.account_id ?? "")}-${idx}`}
          />
        </Grid>

        {/* ── 버튼: 선택 거래처 추가 화살표 ──────────────────────────────── */}
        <Grid
          item
          xs={12}
          md={1}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MDButton
            variant="gradient"
            color="info"
            onClick={handlePushToMap}
            disabled={!selectedManager?.user_id || selectedAccountIds.size === 0}
            sx={{ minWidth: 44, height: 44 }}
            title={`선택된 거래처 ${selectedAccountIds.size}개 추가`}
          >
            ←
          </MDButton>
        </Grid>

        {/* ── 오른쪽: 전체 거래처 목록 (복수 선택, 노란색 강조) ───────────── */}
        <Grid item xs={12} md={5}>
          <SimpleTable
            isMobile={isMobile}
            tableHeight={tableHeight}
            title={
              selectedAccountIds.size > 0
                ? `전체 거래처 (${selectedAccountIds.size}개 선택됨)`
                : "전체 거래처 (클릭하여 복수 선택)"
            }
            columns={accountColumns}
            rows={accountRows || []}
            selectedRowKey={(r) =>
              selectedAccountIds.has(String(r?.account_id ?? ""))
            }
            onBeforeAction={null}
            scrollRef={rightScrollRef}
            onRowClick={(r) => handleClickAccount(r)}
            getRowKey={(r, idx) => `account-${String(r?.account_id ?? idx)}`}
          />
        </Grid>
      </Grid>
    </>
  );
}
