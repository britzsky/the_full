// src/layouts/hygiene/HygieneSheetTab.js
import React, { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  TextField,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Autocomplete,
  Select,
  MenuItem,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import useHygienesheetData from "./hygienesheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";

function HygieneSheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1);

  // ✅ localStorage account_id로 거래처 고정 + 셀렉트 필터링
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [accountInput, setAccountInput] = useState("");
  const isAccountLocked = !!localAccountId;
  // 조회 시작 전/후 깜빡임 방지를 위한 화면 로딩 상태
  const [viewLoading, setViewLoading] = useState(true);
  const loadingStartedRef = useRef(false);

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const { hygieneListRows, accountList, loading, fetcHygieneList } = useHygienesheetData(
    year,
    month
  );

  // ✅ localStorage account_id 기준으로 거래처 리스트 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // ✅ 우클릭(컨텍스트) 메뉴 상태 (행 삭제)
  const [ctxMenu, setCtxMenu] = useState({
    open: false,
    mouseX: 0,
    mouseY: 0,
    rowIndex: null,
  });

  const imageCols = ["problem_image", "clean_image"];

  const filteredHygieneRows = useMemo(() => {
    return (hygieneListRows || []).filter((row) => {
      const baseDate = row?.reg_dt || row?.mod_dt;
      if (!baseDate) return true;

      const [rowYear, rowMonth] = String(baseDate).split("-");
      if (String(rowYear ?? "") !== String(year)) return false;
      if (String(month ?? "") === "ALL") return true;

      return String(Number(rowMonth ?? "")) === String(Number(month));
    });
  }, [hygieneListRows, month, year]);

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (filteredAccountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [filteredAccountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  // 거래처/기간 변경 시 로딩을 먼저 시작하고 조회를 트리거
  const beginListLoading = useCallback(() => {
    setViewLoading(true);
    loadingStartedRef.current = false;
  }, []);

  const setSelectedAccountWithLoading = useCallback(
    (nextAccountId) => {
      const nextId = String(nextAccountId ?? "");
      if (nextId === String(selectedAccountId ?? "")) return;
      beginListLoading();
      setSelectedAccountId(nextId);
    },
    [beginListLoading, selectedAccountId]
  );

  const selectAccountByInput = useCallback(() => {
    if (isAccountLocked) return;
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((o) =>
        String(o?.label || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      setSelectedAccountWithLoading(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions, isAccountLocked, setSelectedAccountWithLoading]);

  const requestHygieneList = useCallback(
    (accountId, nextMonth = month, nextYear = year) => {
      if (!accountId) {
        setRows([]);
        setOriginalRows([]);
        return;
      }

      beginListLoading();
      fetcHygieneList(accountId, nextMonth, nextYear);
    },
    [fetcHygieneList, month, year, beginListLoading]
  );

  const handleYearChange = useCallback(
    (e) => {
      const nextYear = Number(e.target.value);
      setYear(nextYear);
      requestHygieneList(selectedAccountId, month, nextYear);
    },
    [month, requestHygieneList, selectedAccountId]
  );

  const handleMonthChange = useCallback(
    (e) => {
      const nextMonth = e.target.value;
      setMonth(nextMonth);
      requestHygieneList(selectedAccountId, nextMonth, year);
    },
    [requestHygieneList, selectedAccountId, year]
  );

  // 거래처 변경 시 데이터 조회
  useEffect(() => {
    if (!selectedAccountId) return;
    requestHygieneList(selectedAccountId, month, year);
  }, [selectedAccountId, month, year, requestHygieneList]);

  // ✅ 거래처 기본값
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    if (localAccountId) {
      setSelectedAccountWithLoading(localAccountId);
      return;
    }

    if (!selectedAccountId) {
      setSelectedAccountWithLoading(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId, localAccountId, setSelectedAccountWithLoading]);

  // 서버 rows → 로컬 rows / originalRows 복사
  useLayoutEffect(() => {
    const deepCopy = filteredHygieneRows.map((row) => ({
      ...row,
      del_yn: row.del_yn ?? "N", // ✅ 없으면 기본 N
    }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
    // 조회 결과가 화면 상태에 반영된 뒤 로딩 종료
    if (selectedAccountId) {
      setViewLoading(false);
    }
  }, [filteredHygieneRows, selectedAccountId]);

  useEffect(() => {
    if (!viewLoading) return;

    if (loading) {
      loadingStartedRef.current = true;
      return;
    }

    if (loadingStartedRef.current) {
      setViewLoading(false);
      loadingStartedRef.current = false;
    }
  }, [loading, viewLoading]);

  // cell 값 변경 처리
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ 값 비교 통일(이미지는 File 객체면 변경으로 간주)
  const isSameValue = (key, original, current) => {
    if (imageCols.includes(key)) {
      // File 객체가 하나라도 있으면 변경으로 간주(재업로드)
      if (typeof original === "object" || typeof current === "object") return false;
      return String(original ?? "") === String(current ?? "");
    }
    if (typeof original === "string" && typeof current === "string") {
      return normalize(original) === normalize(current);
    }
    return original === current;
  };

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    return isSameValue(key, original, value) ? { color: "black" } : { color: "red" };
  };

  // ✅ 아이콘: 변경됐으면 빨강, 아니면 파랑
  const getFileIconSx = (isChanged) => ({
    color: isChanged ? "#d32f2f" : "#1e88e5",
  });

  // ✅ 모바일 대응 테이블 스타일
  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "4px",
      whiteSpace: "pre-wrap",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: isMobile ? "10px" : "12px",
      padding: isMobile ? "2px 3px" : "4px",
      minWidth: isMobile ? "70px" : "80px",
      border: "none",
      background: "transparent",
      outline: "none",
    },
  };

  // 행추가
  const handleAddRow = () => {
    const newRow = {
      account_id: selectedAccountId,
      reg_dt: "",
      problem_note: "",
      mod_dt: "",
      clean_note: "",
      note: "",
      problem_image: "",
      clean_image: "",
      del_yn: "N", // ✅ 기본 N
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, { ...newRow }]);
  };

  // 이미지 뷰어
  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  };

  const handleCloseViewer = () => setViewImageSrc(null);

  const uploadImage = async (file, imageDt, account_id) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "hygiene");
      formData.append("gubun", imageDt);
      formData.append("folder", account_id);

      const res = await api.post("/Operate/OperateImgUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.code === 200) {
        return res.data.image_path;
      }
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: "이미지 업로드 실패",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      throw err;
    }
  };

  // ✅ 다운로드 (서버 경로 문자열일 때만)
  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = `${API_BASE_URL}${path}`;
    const filename = path.split("/").pop() || "download";

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ✅ 우클릭 메뉴 열기
  const handleRowContextMenu = (e, rowIndex) => {
    e.preventDefault();
    setCtxMenu({
      open: true,
      mouseX: e.clientX,
      mouseY: e.clientY,
      rowIndex,
    });
  };

  const closeCtxMenu = () => {
    setCtxMenu((prev) => ({ ...prev, open: false, rowIndex: null }));
  };

  // ✅ 행 삭제: del_yn=Y 로 서버 저장 → 성공하면 화면에서만 제거(재조회 X)
  const handleDeleteRow = async (rowIndex) => {
    if (rowIndex == null) return;
    const row = rows[rowIndex];
    if (!row) return;

    const result = await Swal.fire({
      title: "행 삭제",
      text: "해당 행을 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#9e9e9e",
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });

    if (!result.isConfirmed) return;

    try {
      const deleteRow = { ...row };

      // ✅ 삭제 플래그
      deleteRow.del_yn = "Y";

      // ✅ account_id 보정
      deleteRow.account_id = selectedAccountId || row.account_id;

      // ✅ 이미지가 File 객체면 삭제 저장에선 불필요하니 제거
      imageCols.forEach((f) => {
        if (deleteRow[f] && typeof deleteRow[f] === "object") delete deleteRow[f];
      });

      // ✅ 삭제는 단건이라도 배열로 전송(백엔드가 리스트 처리하는 패턴과 동일하게)
      const response = await api.post("/Operate/HygieneSave", [deleteRow], {
        headers: { "Content-Type": "application/json" },
      });

      if (response?.data?.code === 200) {
        // ✅ 재조회 없이 화면에서만 제거
        setRows((prev) => prev.filter((_, i) => i !== rowIndex));
        setOriginalRows((prev) => prev.filter((_, i) => i !== rowIndex));

        closeCtxMenu();

        Swal.fire({
          title: "삭제",
          text: "삭제 처리되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      } else {
        Swal.fire({
          title: "오류",
          text: "삭제 저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "오류",
        text: "삭제 저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  const columns = useMemo(
    () => [
      { header: "등록일자", accessorKey: "reg_dt", size: 100 },
      { header: "조치 전 사진", accessorKey: "problem_image", size: 220 },
      { header: "전달 내용", accessorKey: "problem_note", size: 160 },
      { header: "조치일자", accessorKey: "mod_dt", size: 100 },
      { header: "조치 사진", accessorKey: "clean_image", size: 220 },
      { header: "조치 내용", accessorKey: "clean_note", size: 160 },
      { header: "비고", accessorKey: "note", size: 160 },
    ],
    []
  );

  // 저장
  const handleSave = async () => {
    try {
      // ✅ 저장 완료/실패 확인창 전까지 로딩 모달 유지
      Swal.fire({
        title: "저장중입니다.",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const modifiedRows = await Promise.all(
        rows.map(async (row, index) => {
          const original = originalRows[index] || {};
          let updatedRow = { ...row };

          // ✅ 변경 감지: 공통 비교 로직 사용 + 신규행
          const isChanged =
            row.isNew ||
            columns.some((col) => {
              const key = col.accessorKey;
              return !isSameValue(key, original[key], row[key]);
            });

          if (!isChanged) return null;

          // 이미지 처리
          for (const field of imageCols) {
            if (row[field] && typeof row[field] === "object") {
              let uploadedPath = "";
              if (field === "problem_image") {
                uploadedPath = await uploadImage(row[field], row.reg_dt, selectedAccountId);
              } else if (field === "clean_image") {
                uploadedPath = await uploadImage(row[field], row.mod_dt, selectedAccountId);
              }
              updatedRow[field] = uploadedPath;
            }
          }

          return {
            ...updatedRow,
            account_id: selectedAccountId || row.account_id,
            del_yn: updatedRow.del_yn ?? "N",
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      if (payload.length === 0) {
        Swal.close();
        Swal.fire({
          title: "안내",
          text: "변경된 내용이 없습니다.",
          icon: "info",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        return;
      }

      const response = await api.post("/Operate/HygieneSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      Swal.close();

      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        await fetcHygieneList(selectedAccountId, month, year);
      } else {
        Swal.fire({
          title: "오류",
          text: "저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (error) {
      Swal.close();
      Swal.fire({
        title: "실패",
        text: "저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      console.error(error);
    }
  };

  if (loading || viewLoading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 + 버튼 (모바일 대응) */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: isMobile ? "wrap" : "nowrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {(filteredAccountList || []).length > 0 && (
          <Autocomplete
            size="small"
            sx={{ minWidth: isMobile ? 180 : 220 }}
            options={accountOptions}
            value={selectedAccountOption}
            disabled={isAccountLocked}
            onChange={(_, opt) => {
              if (isAccountLocked) return;
              // 입력 비움 시 거래처 선택 유지
              if (!opt) return;
              setSelectedAccountWithLoading(opt.value);
            }}
            inputValue={accountInput}
            onInputChange={(_, newValue) => {
              if (isAccountLocked) return;
              setAccountInput(newValue);
            }}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            filterOptions={(options, state) => {
              const q = (state.inputValue ?? "").trim().toLowerCase();
              if (!q) return options;
              return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={isAccountLocked ? "거래처(고정)" : "거래처 검색"}
                placeholder={isAccountLocked ? "거래처가 고정되어 있습니다" : "거래처명을 입력"}
                onKeyDown={(e) => {
                  if (isAccountLocked) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectAccountByInput();
                  }
                }}
                sx={{
                  "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                  "& input": { padding: "0 8px" },
                }}
              />
            )}
          />
        )}

        <Select
          value={year}
          onChange={handleYearChange}
          size="small"
          renderValue={(selected) => `${selected}년`}
          sx={{ minWidth: 110, height: "40px" }}
        >
          {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>

        <Select
          value={month}
          onChange={handleMonthChange}
          size="small"
          sx={{ minWidth: 90, height: "40px" }}
        >
          <MenuItem value="ALL">전체</MenuItem>
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
            <MenuItem key={m} value={m}>
              {m}월
            </MenuItem>
          ))}
        </Select>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleAddRow}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 80 : 100,
          }}
        >
          행 추가
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 80 : 100,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 테이블 영역 */}
      <MDBox pt={0} pb={3} sx={tableSx}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onContextMenu={(e) => handleRowContextMenu(e, rowIndex)} // ✅ 우클릭
                    style={{ cursor: "context-menu" }}
                  >
                    {columns.map((col) => {
                      const key = col.accessorKey;
                      const value = row[key] ?? "";

                      // 이미지 컬럼 (✅ PropertySheetTab 방식 적용: 업로드/재업로드 + 다운로드 + 미리보기 + 변경시 아이콘 빨강)
                      if (imageCols.includes(key)) {
                        const hasImage = !!value;
                        const original = originalRows[rowIndex]?.[key];
                        const isImgChanged = !isSameValue(key, original, value);

                        return (
                          <td
                            key={key}
                            style={{
                              width: `${col.size}px`,
                              textAlign: "center",
                              verticalAlign: "middle",
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              id={`upload-${key}-${rowIndex}`}
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCellChange(rowIndex, key, file);
                                e.target.value = ""; // ✅ 같은 파일 재선택 가능
                              }}
                            />

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                flexWrap: isMobile ? "wrap" : "nowrap",
                              }}
                            >
                              {/* 업로드/재업로드 버튼은 항상 노출 */}
                              <label htmlFor={`upload-${key}-${rowIndex}`}>
                                <MDButton
                                  size="small"
                                  component="span"
                                  color="info"
                                  sx={{ fontSize: isMobile ? "10px" : "12px" }}
                                >
                                  {hasImage ? "재업로드" : "이미지 업로드"}
                                </MDButton>
                              </label>

                              {/* 다운로드: 서버 문자열일 때만 */}
                              {typeof value === "string" && value && (
                                <Tooltip title="다운로드">
                                  <IconButton
                                    size="small"
                                    sx={getFileIconSx(isImgChanged)}
                                    onClick={() => handleDownload(value)}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {/* 미리보기: 서버/로컬 모두 */}
                              {hasImage && (
                                <Tooltip title="미리보기">
                                  <IconButton
                                    size="small"
                                    sx={getFileIconSx(isImgChanged)}
                                    onClick={() => handleViewImage(value)}
                                  >
                                    <ImageSearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // 날짜 컬럼
                      const isDate = ["reg_dt", "mod_dt"].includes(key);
                      if (isDate) {
                        return (
                          <td
                            key={key}
                            style={{
                              ...getCellStyle(rowIndex, key, value),
                              width: `${col.size}px`,
                            }}
                          >
                            <input
                              type="date"
                              value={value || ""}
                              onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: "100%",
                                border: "none",
                                background: "transparent",
                              }}
                            />
                          </td>
                        );
                      }

                      // 일반 텍스트 컬럼
                      return (
                        <td
                          key={key}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => handleCellChange(rowIndex, key, e.currentTarget.innerText)}
                          style={{
                            ...getCellStyle(rowIndex, key, value),
                            width: `${col.size}px`,
                          }}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>

      {/* 이미지 뷰어 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          {/* 컨트롤 버튼 - 오버레이 최상단, TransformWrapper 완전 밖 */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 12,
              marginBottom: 10,
              zIndex: 10001,
            }}
          >
            {[
              { label: "+", action: null, id: "zi" },
              { label: "-", action: null, id: "zo" },
              { label: "⟳", action: null, id: "rt" },
              { label: "✕", action: handleCloseViewer, id: "cl" },
            ].map(({ label, action, id }) => (
              <button
                key={id}
                id={`viewer-btn-${id}`}
                onClick={action ? (e) => { e.stopPropagation(); action(); } : undefined}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.92)",
                  color: "#222",
                  fontWeight: "bold",
                  fontSize: isMobile ? 13 : 15,
                  width: isMobile ? 32 : 36,
                  height: isMobile ? 32 : 36,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  touchAction: "manipulation",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 이미지 영역 */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isMobile ? "100vw" : "90vw",
              height: isMobile ? "calc(100vh - 80px)" : "calc(100vh - 90px)",
              overflow: "hidden",
            }}
          >
            <TransformWrapper
              initialScale={1}
              minScale={0.3}
              maxScale={8}
              centerOnInit
              onInit={({ zoomIn, zoomOut, resetTransform }) => {
                const zi = document.getElementById("viewer-btn-zi");
                const zo = document.getElementById("viewer-btn-zo");
                const rt = document.getElementById("viewer-btn-rt");
                if (zi) zi.onclick = (e) => { e.stopPropagation(); zoomIn(); };
                if (zo) zo.onclick = (e) => { e.stopPropagation(); zoomOut(); };
                if (rt) rt.onclick = (e) => { e.stopPropagation(); resetTransform(); };
              }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={encodeURI(viewImageSrc)}
                  alt="미리보기"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: 8,
                    userSelect: "none",
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}

      {/* ✅ 우클릭 컨텍스트 메뉴 (행 삭제) */}
      {ctxMenu.open && (
        <div
          onClick={closeCtxMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeCtxMenu();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: ctxMenu.mouseY,
              left: ctxMenu.mouseX,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              minWidth: 140,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => handleDeleteRow(ctxMenu.rowIndex)}
            >
              🗑️ 행 삭제
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default HygieneSheetTab;
