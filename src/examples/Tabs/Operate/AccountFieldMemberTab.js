/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { useTheme, useMediaQuery, TextField, MenuItem } from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";

import useAccountFieldMemberDataData from "./accountFieldMemberData";
import LoadingScreen from "layouts/loading/loadingscreen";

/**
 * ✅ 중요: 컴포넌트는 파일 상단(외부)에 고정 선언
 * - 부모 렌더마다 함수가 새로 만들어지지 않게 해서 리마운트/스크롤 초기화 방지
 */
const SimpleTable = React.memo(function SimpleTable({
  title,
  columns,
  rows,
  selectedRowKey,
  onRowClick,
  onCellChange,
  scrollRef,
  onBeforeAction,
  isMobile,
  getRowKey,
}) {
  const HEADER_H = isMobile ? 34 : 40;

  const tableSx = {
    flex: 1,
    minHeight: "75vh",
    maxHeight: isMobile ? "70vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    fontSize: "11.5px",
    overflowAnchor: "none",
    backgroundColor: "#fff",
    position: "relative",
    isolation: "isolate",

    "& table": {
      borderCollapse: "separate",
      width: "100%",
      tableLayout: "fixed",
      borderSpacing: 0,
      overflowAnchor: "none",
    },
    "& th, & td": {
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

  const defaultGetRowKey = useCallback((r, idx) => {
    const primary =
      r?.root_idx ?? r?.idx ?? r?.id ?? r?.emd_code ?? r?.sigungu_code ?? r?.sido_code ?? idx;

    const secondary =
      r?.idx ?? r?.root_idx ?? r?.id ?? r?.emd_code ?? r?.sigungu_code ?? r?.sido_code ?? idx;

    return `${String(primary)}-${String(secondary)}-${String(idx)}`;
  }, []);

  const resolveRowKey = getRowKey || defaultGetRowKey;

  return (
    <Box
      sx={tableSx}
      ref={scrollRef}
      onMouseDownCapture={(e) => onBeforeAction?.(e)}
      onClickCapture={(e) => onBeforeAction?.(e)}
    >
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
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

      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  width: c.width || 120,
                  position: "sticky",
                  top: HEADER_H,
                  zIndex: 4,
                  backgroundColor: "#f0f0f0",
                  userSelect: "none",
                  cursor: "default",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {(rows || []).map((r, idx) => {
            const isSelected = selectedRowKey ? Boolean(selectedRowKey(r, idx)) : false;
            const stableKey = resolveRowKey(r, idx);

            return (
              <tr
                key={stableKey}
                onMouseDownCapture={(e) => onBeforeAction?.(e)}
                onClick={(e) => onRowClick?.(r, idx, e)}
                style={{ background: isSelected ? "rgba(255, 244, 179, 0.55)" : "transparent" }}
              >
                {columns.map((c) => {
                  const v = r?.[c.key] ?? "";

                  if (c.editor?.type === "select") {
                    const options = c.editor.options || [];
                    return (
                      <td key={c.key}>
                        <select
                          value={v ?? ""}
                          onChange={(e) => onCellChange?.(idx, c.key, e.target.value)}
                          style={{
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            cursor: "pointer",
                            textAlignLast: "center",
                            fontSize: "11.5px",
                          }}
                          onMouseDownCapture={(e) => onBeforeAction?.(e)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {options.map((op) => (
                            <option key={String(op.value)} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  if (c.editor?.type === "text") {
                    return (
                      <td key={c.key}>
                        <input
                          value={v ?? ""}
                          onChange={(e) => onCellChange?.(idx, c.key, e.target.value)}
                          style={{
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            textAlign: "center",
                            fontSize: "11.5px",
                          }}
                          onMouseDownCapture={(e) => onBeforeAction?.(e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    );
                  }

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
  );
});

SimpleTable.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
  selectedRowKey: PropTypes.func,
  onRowClick: PropTypes.func,
  onCellChange: PropTypes.func,
  scrollRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  onBeforeAction: PropTypes.func,
  isMobile: PropTypes.bool.isRequired,
  getRowKey: PropTypes.func,
};

function AccountFieldMemberTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { personRows, rootRows, loading, fetchRootList, setPersonRows } =
    useAccountFieldMemberDataData();

  const [searchName, setSearchName] = useState("");
  const [searchRootIdx, setSearchRootIdx] = useState("");

  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedRoot, setSelectedRoot] = useState(null);
  const [mapRows, setMapRows] = useState([]);

  const leftScrollRef = useRef(null);
  const middleScrollRef = useRef(null);
  const rightScrollRef = useRef(null);

  const leftTopRef = useRef(0);
  const rightTopRef = useRef(0);

  const pendingLeftRestoreRef = useRef(false);
  const pendingRightRestoreRef = useRef(false);

  const fetchRootListRef = useRef(fetchRootList);

  // ✅ 마지막 사람 클릭 요청만 반영하기 위한 request id
  const personMapRequestSeqRef = useRef(0);

  useEffect(() => {
    fetchRootListRef.current = fetchRootList;
  }, [fetchRootList]);

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
  }, [selectedPerson?.idx, mapRows?.length, personRows?.length]);

  useLayoutEffect(() => {
    if (!pendingRightRestoreRef.current) return;
    pendingRightRestoreRef.current = false;

    const el = rightScrollRef.current;
    if (!el) return;

    const top = rightTopRef.current;
    el.scrollTop = top;
    requestAnimationFrame(() => {
      if (rightScrollRef.current) rightScrollRef.current.scrollTop = top;
    });
  }, [selectedRoot?.root_idx, rootRows?.length]);

  const captureLeftScroll = useCallback(() => {
    const el = leftScrollRef.current;
    if (!el) return;
    leftTopRef.current = el.scrollTop;
    pendingLeftRestoreRef.current = true;
  }, []);

  const captureRightScroll = useCallback(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    rightTopRef.current = el.scrollTop;
    pendingRightRestoreRef.current = true;
  }, []);

  const rootIndexById = useMemo(() => {
    const m = new Map();
    (rootRows || []).forEach((r) => {
      const key = String(r?.root_idx ?? "");
      if (key) m.set(key, r);
    });
    return m;
  }, [rootRows]);

  const rootSelectOptions = useMemo(() => {
    return (rootRows || []).map((r) => {
      const label = [
        r?.root_idx ? `[${r.root_idx}]` : "",
        r?.sido_name || "",
        r?.sigungu_name || "",
        r?.emd_name || "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        value: String(r?.root_idx ?? ""),
        label,
      };
    });
  }, [rootRows]);

  const normalizeMapRows = useCallback(
    (list) => {
      const arr = Array.isArray(list) ? list : [];
      return arr.map((r, idx) => {
        const key = String(r?.root_idx ?? "");
        const root = rootIndexById.get(key);
        return {
          ...r,
          __rowKey: `map-${String(r?.root_idx ?? "")}-${String(r?.idx ?? "")}-${idx}`,
          root_idx: r?.root_idx ?? "",
          sido_name: r?.sido_name ?? root?.sido_name ?? "",
          sigungu_name: r?.sigungu_name ?? root?.sigungu_name ?? "",
          emd_name: r?.emd_name ?? root?.emd_name ?? "",
        };
      });
    },
    [rootIndexById]
  );

  // ✅ 사람 목록 직접 조회: name, root_idx를 항상 명시적으로 전달
  const fetchFieldPersonListWithParams = useCallback(
    async ({ name = "", root_idx = "" } = {}) => {
      const res = await api.get("/Operate/FieldPersonMasterList", {
        params: {
          name: String(name ?? ""),
          root_idx: String(root_idx ?? ""),
        },
      });

      const raw = res?.data?.list ?? res?.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setPersonRows(list);
    },
    [setPersonRows]
  );

  const handleRefresh = useCallback(
    async ({ name = "", root_idx = "" } = {}) => {
      try {
        const q = String(name ?? "");
        const rootIdx = String(root_idx ?? "");

        // ✅ 진행 중인 가운데 조회 무효화
        personMapRequestSeqRef.current += 1;

        await Promise.all([
          fetchFieldPersonListWithParams({ name: q, root_idx: rootIdx }),
          fetchRootListRef.current?.(),
        ]);

        setSelectedPerson(null);
        setSelectedRoot(null);
        setMapRows([]);

        leftTopRef.current = 0;
        rightTopRef.current = 0;

        if (leftScrollRef.current) leftScrollRef.current.scrollTop = 0;
        if (middleScrollRef.current) middleScrollRef.current.scrollTop = 0;
        if (rightScrollRef.current) rightScrollRef.current.scrollTop = 0;
      } catch (e) {
        Swal.fire("실패", e?.message || "재조회 중 오류", "error");
      }
    },
    [fetchFieldPersonListWithParams]
  );

  useEffect(() => {
    handleRefresh({ name: "", root_idx: "" });
  }, [handleRefresh]);

  const fetchPersonRootMapList = useCallback(async (personIdx) => {
    const res = await api.get("/Operate/PersonToRootList", { params: { idx: personIdx } });
    const raw = res?.data?.list ?? res?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, []);

  const handleClickPersonRow = useCallback(
    async (row) => {
      setSelectedPerson(row);
      setSelectedRoot(null);

      setMapRows([]);
      if (middleScrollRef.current) {
        middleScrollRef.current.scrollTop = 0;
      }

      if (!row?.idx) return;

      const requestId = ++personMapRequestSeqRef.current;

      try {
        const list = await fetchPersonRootMapList(row.idx);

        if (requestId !== personMapRequestSeqRef.current) return;

        const normalized = normalizeMapRows(list);
        setMapRows(normalized);

        if (middleScrollRef.current) {
          middleScrollRef.current.scrollTop = 0;
        }
      } catch (err) {
        if (requestId !== personMapRequestSeqRef.current) return;
        setMapRows([]);
        Swal.fire("실패", err?.message || "매핑 조회 오류", "error");
      }
    },
    [fetchPersonRootMapList, normalizeMapRows]
  );

  useEffect(() => {
    if ((mapRows || []).length > 0) {
      setMapRows((prev) => normalizeMapRows(prev));
    }
  }, [rootRows?.length, normalizeMapRows]);

  const handleSaveMap = useCallback(async () => {
    try {
      if (!selectedPerson?.idx) {
        Swal.fire("안내", "사람을 먼저 선택하세요.", "info");
        return;
      }

      const payload = {
        idx: selectedPerson.idx,
        list: (mapRows || []).map((r) => ({
          idx: selectedPerson.idx,
          root_idx: r.root_idx,
        })),
      };

      const res = await api.post("/Operate/PersonToRootSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

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

      const requestId = ++personMapRequestSeqRef.current;
      const list = await fetchPersonRootMapList(selectedPerson.idx);
      if (requestId !== personMapRequestSeqRef.current) return;

      setMapRows(normalizeMapRows(list));

      if (middleScrollRef.current) {
        middleScrollRef.current.scrollTop = 0;
      }
    } catch (e) {
      Swal.fire("실패", e?.message || "저장 중 오류", "error");
    }
  }, [fetchPersonRootMapList, mapRows, normalizeMapRows, selectedPerson]);

  const handleClickRootRow = useCallback((row) => {
    setSelectedRoot(row);
  }, []);

  const canPushToMap = Boolean(selectedPerson?.idx) && Boolean(selectedRoot?.root_idx);

  const handlePushRootToMap = useCallback(() => {
    if (!canPushToMap) return;

    const exists = (mapRows || []).some(
      (m) => String(m.root_idx) === String(selectedRoot.root_idx)
    );
    if (exists) return;

    const newRow = {
      __rowKey: `map-${String(selectedRoot.root_idx)}-${String(selectedPerson.idx)}-new`,
      idx: selectedPerson.idx,
      root_idx: selectedRoot.root_idx,
      sido_code: selectedRoot.sido_code,
      sido_name: selectedRoot.sido_name,
      sigungu_code: selectedRoot.sigungu_code,
      sigungu_name: selectedRoot.sigungu_name,
      emd_code: selectedRoot.emd_code,
      emd_name: selectedRoot.emd_name,
    };

    setMapRows((prev) => [newRow, ...(prev || [])]);

    if (middleScrollRef.current) {
      middleScrollRef.current.scrollTop = 0;
    }
  }, [canPushToMap, mapRows, selectedPerson, selectedRoot]);

  const personColumns = useMemo(
    () => [
      { key: "idx", label: "순번", width: 50 },
      { key: "name", label: "이름", width: 90, editor: { type: "text" } },
      {
        key: "position_type",
        label: "직책",
        width: 90,
        editor: {
          type: "select",
          options: [
            { value: "4", label: "조리사" },
            { value: "5", label: "조리원" },
          ],
        },
      },
    ],
    []
  );

  const mapColumns = useMemo(
    () => [
      { key: "root_idx", label: "경로순번", width: 70 },
      { key: "sido_name", label: "시도", width: 90 },
      { key: "sigungu_name", label: "시군구", width: 110 },
      { key: "emd_name", label: "읍면동", width: 100 },
    ],
    []
  );

  const rootColumns = useMemo(
    () => [
      { key: "root_idx", label: "순번", width: 50 },
      { key: "sido_code", label: "시도코드", width: 70 },
      { key: "sido_name", label: "시도명", width: 100 },
      { key: "sigungu_code", label: "시군구코드", width: 70 },
      { key: "sigungu_name", label: "시군구명", width: 100 },
      { key: "emd_code", label: "읍면동코드", width: 70 },
      { key: "emd_name", label: "읍면동명", width: 100 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox
        pt={0}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <TextField
          size="small"
          label="이름"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleRefresh({ name: searchName, root_idx: searchRootIdx });
            }
          }}
          sx={{ minWidth: isMobile ? 100 : 150 }}
        />

        <TextField
          select
          size="small"
          label="경로"
          value={searchRootIdx}
          onChange={(e) => {
            const nextValue = String(e.target.value ?? "");
            setSearchRootIdx(nextValue);
            handleRefresh({ name: searchName, root_idx: nextValue });
          }}
          sx={{
            minWidth: isMobile ? 180 : 300,
            "& .MuiOutlinedInput-root": {
              minHeight: 38,
            },
            "& .MuiSelect-select": {
              display: "flex",
              alignItems: "center",
              minHeight: "38px !important",
            },
          }}
        >
          <MenuItem value="">전체</MenuItem>
          {rootSelectOptions.map((op) => (
            <MenuItem key={op.value} value={op.value}>
              {op.label}
            </MenuItem>
          ))}
        </TextField>

        <MDButton
          variant="gradient"
          color="info"
          onClick={() => handleRefresh({ name: searchName, root_idx: searchRootIdx })}
        >
          조회
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={() => {
            setSearchName("");
            setSearchRootIdx("");
            handleRefresh({ name: "", root_idx: "" });
          }}
        >
          새로고침
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSaveMap}
          disabled={!selectedPerson?.idx}
        >
          저장
        </MDButton>
      </MDBox>

      <Grid container spacing={2} alignItems="stretch">
        {/* 왼쪽 */}
        <Grid item xs={12} md={3}>
          <SimpleTable
            isMobile={isMobile}
            title="사람 목록"
            columns={personColumns}
            rows={personRows || []}
            selectedRowKey={(r) => r?.idx === selectedPerson?.idx}
            onBeforeAction={captureLeftScroll}
            scrollRef={leftScrollRef}
            onRowClick={(r) => handleClickPersonRow(r)}
            onCellChange={(rowIndex, key, value) => {
              captureLeftScroll();
              setPersonRows((prev) =>
                (prev || []).map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
              );
            }}
            getRowKey={(r, idx) => `person-${String(r?.idx ?? idx)}`}
          />
        </Grid>

        {/* 가운데 */}
        <Grid item xs={12} md={3}>
          <SimpleTable
            key={selectedPerson?.idx ? `map-table-${selectedPerson.idx}` : "map-table-empty"}
            isMobile={isMobile}
            title={
              selectedPerson
                ? `연결 (${selectedPerson.name || selectedPerson.idx})`
                : "연결 (사람 선택)"
            }
            columns={mapColumns}
            rows={mapRows || []}
            scrollRef={middleScrollRef}
            onBeforeAction={null}
            getRowKey={(r, idx) =>
              r?.__rowKey
                ? String(r.__rowKey)
                : `map-${String(r?.root_idx ?? "")}-${String(r?.idx ?? "")}-${idx}`
            }
          />
        </Grid>

        {/* 버튼 */}
        <Grid
          item
          xs={12}
          md={1}
          sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <MDButton
            variant="gradient"
            color="info"
            onClick={handlePushRootToMap}
            disabled={!canPushToMap}
            sx={{ minWidth: 44, height: 44 }}
          >
            ←
          </MDButton>
        </Grid>

        {/* 오른쪽 */}
        <Grid item xs={12} md={5}>
          <SimpleTable
            isMobile={isMobile}
            title="경로 목록"
            columns={rootColumns}
            rows={rootRows || []}
            selectedRowKey={(r) => r?.root_idx === selectedRoot?.root_idx}
            onBeforeAction={captureRightScroll}
            scrollRef={rightScrollRef}
            onRowClick={(r) => handleClickRootRow(r)}
            getRowKey={(r, idx) => `root-${String(r?.root_idx ?? idx)}`}
          />
        </Grid>
      </Grid>
    </>
  );
}

export default AccountFieldMemberTab;
