/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Box, useTheme, useMediaQuery } from "@mui/material";

import useAccountRootData from "./accountRootData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function AccountRootTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    rootRows,
    sidoRows,
    sigunguRows,
    eupmyeondongRows,
    loading,
    fetchRootList,
    fetchSidoList,
    fetchSigunguList,
    fetchEupmyeondongList,
    setRootRows,
    setSigunguRows,
    setEupmyeondongRows,
  } = useAccountRootData();

  const [selectedSido, setSelectedSido] = useState(null);
  const [selectedSigungu, setSelectedSigungu] = useState(null);
  const [selectedEmd, setSelectedEmd] = useState(null);

  // ✅ 왼쪽에서 "← 적용 대상" 행 인덱스
  // - 행추가하면 자동으로 그 행을 타겟으로
  // - 왼쪽 행을 클릭하면 그 행이 타겟으로
  const [activeLeftRowIndex, setActiveLeftRowIndex] = useState(null);

  // ✅ 조회 원본 스냅샷 (빨간 표시용)
  const [originalRootRows, setOriginalRootRows] = useState([]);
  const needOriginalSyncRef = useRef(true);

  // =========================================
  // 초기 로딩
  // =========================================
  useEffect(() => {
    const init = async () => {
      needOriginalSyncRef.current = true;
      await Promise.all([fetchRootList(), fetchSidoList()]);
      setSelectedSido(null);
      setSelectedSigungu(null);
      setSelectedEmd(null);
      setSigunguRows([]);
      setEupmyeondongRows([]);
      setActiveLeftRowIndex(null);
    };
    init();
  }, []);

  // ✅ rootRows가 "조회 완료 시점"에만 original 저장
  useEffect(() => {
    if (!needOriginalSyncRef.current) return;
    // fetchRootList 후 rootRows가 채워지는 시점
    setOriginalRootRows((rootRows || []).map((r) => ({ ...r })));
    needOriginalSyncRef.current = false;
  }, [rootRows]);

  const handleRefresh = async () => {
    needOriginalSyncRef.current = true;
    await fetchRootList();
    setSelectedSido(null);
    setSelectedSigungu(null);
    setSelectedEmd(null);
    setSigunguRows([]);
    setEupmyeondongRows([]);
    setActiveLeftRowIndex(null);
  };

  // =========================================
  // 저장
  // =========================================
  // 숫자 변환(빈값은 "" 유지)
  const toNumOrEmpty = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    if (s === "") return "";
    const n = Number(s);
    return Number.isNaN(n) ? "" : n;
  };

  // 문자열 변환(빈값은 "" 유지)
  const toStrOrEmpty = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const handleSave = async () => {
    try {
      // ✅ localStorage user_id 읽기 (프로젝트 키에 맞게)
      const userId = toStrOrEmpty(localStorage.getItem("user_id"));

      if (!userId) {
        Swal.fire("실패", "localStorage에 user_id가 없습니다.", "error");
        return;
      }

      const payload = {
        user_id: userId, // ✅ 함께 전송
        list: (rootRows || []).map((r) => ({
          user_id: userId,
          // root_idx가 숫자라면 숫자로, 문자열이면 toStrOrEmpty로 바꾸면 됨
          root_idx: r.root_idx == "" ? null : r.root_idx,

          // ✅ 코드들은 숫자로 보내기 (문자열로 넘어가는 문제 해결)
          sido_code: r.sido_code == "" ? null : r.sido_code,
          sigungu_code: r.sigungu_code == "" ? null : r.sigungu_code,
          emd_code: r.emd_code == "" ? null : r.emd_code,

          // 명칭은 문자열
          sido_name: toStrOrEmpty(r.sido_name),
          sigungu_name: toStrOrEmpty(r.sigungu_name),
          emd_name: toStrOrEmpty(r.emd_name),
          del_yn: toStrOrEmpty(r.del_yn || "N"), // ✅ 추가 (기본 N)
        })),
      };

      const res = await api.post("/Operate/RootSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      const ok = res?.data?.code === 200 || res?.status === 200;
      if (ok) {
        await Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        await handleRefresh();
      } else {
        Swal.fire("실패", res?.data?.message || "저장 실패", "error");
      }
    } catch (e) {
      Swal.fire("실패", e?.message || "저장 중 오류", "error");
    }
  };
  // =========================================
  // 스타일
  // =========================================
  const tableSx = {
    flex: 1,
    minHeight: "75vh",
    maxHeight: isMobile ? "70vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "100%",
      tableLayout: "fixed",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "6px",
      fontSize: isMobile ? "10px" : "12px",
      whiteSpace: "pre-wrap",
      verticalAlign: "middle",
      overflow: "hidden",
      textOverflow: "ellipsis",
      cursor: "pointer",
    },
  };

  // =========================================
  // 데이터
  // =========================================
  const leftRows = useMemo(() => rootRows || [], [rootRows]);
  const rightSidoRows = useMemo(() => sidoRows || [], [sidoRows]);
  const rightSigunguRows = useMemo(() => sigunguRows || [], [sigunguRows]);
  const rightEmdRows = useMemo(() => eupmyeondongRows || [], [eupmyeondongRows]);

  // =========================================
  // 연쇄 조회
  // =========================================
  const handleClickSidoRow = useCallback(
    async (row) => {
      setSelectedSido(row);
      setSelectedSigungu(null);
      setSelectedEmd(null);

      setSigunguRows([]);
      setEupmyeondongRows([]);

      if (row?.sido_code) {
        await fetchSigunguList(row.sido_code);
      }
    },
    [fetchSigunguList, setSigunguRows, setEupmyeondongRows]
  );

  const handleClickSigunguRow = useCallback(
    async (row) => {
      setSelectedSigungu(row);
      setSelectedEmd(null);

      setEupmyeondongRows([]);

      if (row?.sigungu_code) {
        await fetchEupmyeondongList(row.sigungu_code);
      }
    },
    [fetchEupmyeondongList, setEupmyeondongRows]
  );

  const handleClickEmdRow = useCallback((row) => {
    setSelectedEmd(row);
  }, []);

  // =========================================
  // 왼쪽 행 추가: 추가된 행이 "타겟"이 되게
  // =========================================
  const addEmptyLeftRow = () => {
    setRootRows((prev) => {
      const next = [
        ...(prev || []),
        {
          root_idx: "",
          sido_code: "",
          sido_name: "",
          sigungu_code: "",
          sigungu_name: "",
          emd_code: "",
          emd_name: "",
          del_yn: "N", // ✅ 기본값
        },
      ];
      // ✅ 방금 추가한 행을 타겟으로
      setActiveLeftRowIndex(next.length - 1);
      return next;
    });
  };

  // =========================================
  // ✅ ← 버튼: "새로 추가한 빈 행(또는 선택한 왼쪽 행)"에 세팅
  // - 우선순위: 읍면동 > 시군구 > 시도
  // - activeLeftRowIndex가 없으면, 안전하게 새 행을 하나 만들고 거기에 넣음(예외 방지)
  // =========================================
  const handlePushSelectedToLeft = () => {
    const pick = (() => {
      if (selectedEmd) {
        return {
          sido_code: selectedSido?.sido_code || "",
          sido_name: selectedSido?.sido_name || "",
          sigungu_code: selectedSigungu?.sigungu_code || "",
          sigungu_name: selectedSigungu?.sigungu_name || "",
          emd_code: selectedEmd.emd_code,
          emd_name: selectedEmd.emd_name,
        };
      }
      if (selectedSigungu) {
        return {
          sido_code: selectedSido?.sido_code || "",
          sido_name: selectedSido?.sido_name || "",
          sigungu_code: selectedSigungu.sigungu_code,
          sigungu_name: selectedSigungu.sigungu_name,
          emd_code: "",
          emd_name: "",
        };
      }
      if (selectedSido) {
        return {
          sido_code: selectedSido.sido_code,
          sido_name: selectedSido.sido_name,
          sigungu_code: "",
          sigungu_name: "",
          emd_code: "",
          emd_name: "",
        };
      }
      return null;
    })();

    if (!pick) return;

    setRootRows((prev) => {
      const arr = [...(prev || [])];

      let targetIndex = activeLeftRowIndex;
      const validTarget =
        typeof targetIndex === "number" && targetIndex >= 0 && targetIndex < arr.length;

      // 타겟이 없으면 새 행을 하나 만들어서 그 행에 세팅
      if (!validTarget) {
        arr.push({
          root_idx: "",
          sido_code: "",
          sido_name: "",
          sigungu_code: "",
          sigungu_name: "",
          emd_code: "",
          emd_name: "",
        });
        targetIndex = arr.length - 1;
        setActiveLeftRowIndex(targetIndex);
      }

      arr[targetIndex] = {
        ...arr[targetIndex],
        ...pick,
      };
      return arr;
    });
  };

  const canPush = Boolean(selectedSido) || Boolean(selectedSigungu) || Boolean(selectedEmd);

  // =========================================
  // ✅ 빨간 글씨 표시 (원본 vs 현재)
  // - original에 row가 없으면 "신규 행"이라 빨간색
  // - 값이 달라지면 빨간색
  // =========================================
  const normalize = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);

  const getCellStyle = useCallback(
    (rowIndex, key, value) => {
      const origRow = originalRootRows?.[rowIndex];

      // 신규 행(조회 원본에 없음)
      if (!origRow) return { color: "red", fontWeight: 700 };

      const orig = origRow?.[key];

      if (typeof orig === "string" && typeof value === "string") {
        return normalize(orig) !== normalize(value) ? { color: "red", fontWeight: 700 } : {};
      }
      return String(orig ?? "") !== String(value ?? "") ? { color: "red", fontWeight: 700 } : {};
    },
    [originalRootRows]
  );

  // =========================================
  // 공용 테이블 컴포넌트 (왼쪽만 빨간 스타일 적용)
  // =========================================
  const SimpleTable = ({
    title,
    columns,
    rows,
    selectedRowKey,
    onRowClick,
    cellStyleFn,
    onCellChange,
  }) => {
    const HEADER_H = isMobile ? 34 : 40;

    return (
      <MDBox
        sx={{
          ...tableSx,
          pt: 0,
          pb: 0,
        }}
      >
        <MDBox
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
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
              const isSelected = selectedRowKey ? selectedRowKey(r) : false;

              return (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(r, idx)}
                  style={{
                    background: isSelected ? "rgba(255, 244, 179, 0.55)" : "transparent",
                  }}
                >
                  {columns.map((c) => {
                    const v = r?.[c.key] ?? "";
                    const style = cellStyleFn ? cellStyleFn(idx, c.key, v) : undefined;

                    // ✅ del_yn만 select 처리
                    if (c.key === "del_yn") {
                      return (
                        <td key={c.key} style={style}>
                          <select
                            value={v || "N"}
                            onChange={(e) => onCellChange?.(idx, "del_yn", e.target.value)}
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              outline: "none",
                              cursor: "pointer",
                              ...(style || {}),
                            }}
                          >
                            <option value="N">N</option>
                            <option value="Y">Y</option>
                          </select>
                        </td>
                      );
                    }

                    return (
                      <td key={c.key} title={String(v)} style={style}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </MDBox>
    );
  };

  SimpleTable.propTypes = {
    title: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        width: PropTypes.number,
      })
    ).isRequired,
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
    selectedRowKey: PropTypes.func,
    onRowClick: PropTypes.func,
    cellStyleFn: PropTypes.func,
    onCellChange: PropTypes.func,
  };

  // =========================================
  // 컬럼
  // =========================================
  const leftColumns = useMemo(
    () => [
      { key: "root_idx", label: "순번", width: 50 },
      { key: "sido_code", label: "시도코드", width: 70 },
      { key: "sido_name", label: "시도명", width: 100 },
      { key: "sigungu_code", label: "시군구코드", width: 70 },
      { key: "sigungu_name", label: "시군구명", width: 100 },
      { key: "emd_code", label: "읍면동코드", width: 70 },
      { key: "emd_name", label: "읍면동명", width: 100 },
      { key: "del_yn", label: "삭제여부", width: 70 }, // ✅ 추가
    ],
    []
  );

  const sidoColumns = useMemo(
    () => [
      { key: "sido_code", label: "시도 코드", width: 100 },
      { key: "sido_name", label: "시도명", width: 110 },
    ],
    []
  );

  const sigunguColumns = useMemo(
    () => [
      { key: "sigungu_code", label: "시군구 코드", width: 100 },
      { key: "sigungu_name", label: "시군구명", width: 110 },
    ],
    []
  );

  const emdColumns = useMemo(
    () => [
      { key: "emd_code", label: "읍면동 코드", width: 100 },
      { key: "emd_name", label: "읍면동명", width: 110 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* ✅ 상단 버튼: 새로고침 / 행추가 / 저장 */}
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
        {/* ✅ 새로고침(재조회) */}
        <MDButton variant="gradient" color="info" onClick={handleRefresh}>
          새로고침
        </MDButton>

        {/* ✅ 행추가 */}
        <MDButton variant="gradient" color="info" onClick={addEmptyLeftRow}>
          왼쪽(root) 행 추가
        </MDButton>

        {/* ✅ 저장 */}
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <Grid container spacing={2} alignItems="stretch">
        {/* ✅ 왼쪽 Root */}
        <Grid item xs={12} md={5}>
          <SimpleTable
            title="경로 (조회/추가)"
            columns={leftColumns}
            rows={leftRows}
            // ✅ 왼쪽은 "타겟 행" 하이라이트
            selectedRowKey={(_, idx) => idx === activeLeftRowIndex}
            // ✅ 왼쪽 행 클릭하면 그 행이 타겟
            onRowClick={(_, idx) => setActiveLeftRowIndex(idx)}
            // ✅ 변경/추가 빨간 표시
            cellStyleFn={getCellStyle}
            onCellChange={(rowIndex, key, value) => {
              setRootRows((prev) =>
                (prev || []).map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
              );
            }}
          />
        </Grid>

        {/* ✅ 단일 ← 버튼 (왼쪽과 오른쪽 사이) */}
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
            onClick={handlePushSelectedToLeft}
            disabled={!canPush}
            sx={{ minWidth: 44, height: 44 }}
            title="오른쪽에서 선택한 값을 왼쪽의 선택 행(또는 최근 추가 행)에 세팅"
          >
            ←
          </MDButton>
        </Grid>

        {/* ✅ 오른쪽 3단 */}
        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <SimpleTable
                title="시도"
                columns={sidoColumns}
                rows={rightSidoRows}
                selectedRowKey={(r) => r?.sido_code === selectedSido?.sido_code}
                onRowClick={(r) => handleClickSidoRow(r)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <SimpleTable
                title="시군구 (시도 클릭 후)"
                columns={sigunguColumns}
                rows={rightSigunguRows}
                selectedRowKey={(r) => r?.sigungu_code === selectedSigungu?.sigungu_code}
                onRowClick={(r) => handleClickSigunguRow(r)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <SimpleTable
                title="읍면동 (시군구 클릭 후)"
                columns={emdColumns}
                rows={rightEmdRows}
                selectedRowKey={(r) => r?.emd_code === selectedEmd?.emd_code}
                onRowClick={(r) => handleClickEmdRow(r)}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </>
  );
}

export default AccountRootTab;
