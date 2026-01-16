import React, { useMemo, useState, useEffect, useCallback } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
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

  // ✅ localStorage account_id로 거래처 고정 + 셀렉트 필터링
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);

  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");

  const { hygieneListRows, accountList, loading, fetcHygieneList } = useHygienesheetData();

  // ✅ localStorage account_id 기준으로 거래처 리스트 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // 거래처 변경 시 데이터 조회
  useEffect(() => {
    if (selectedAccountId) {
      fetcHygieneList(selectedAccountId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  // ✅ 거래처 기본값
  // - localStorage account_id가 있으면 무조건 그걸로 고정
  // - 없으면: 첫 번째 업장 자동 선택
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    if (localAccountId) {
      setSelectedAccountId(localAccountId);
      return;
    }

    if (!selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId, localAccountId]);

  // 서버 rows → 로컬 rows / originalRows 복사
  useEffect(() => {
    const deepCopy = (hygieneListRows || []).map((row) => ({ ...row }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
  }, [hygieneListRows]);

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  // cell 값 변경 처리
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  const normalize = (value) => {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim();
  };

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

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

  const handleCloseViewer = () => {
    setViewImageSrc(null);
  };

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
        Swal.fire({
          title: "성공",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        return res.data.image_path;
      }
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: err,
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

  // ✅ 아이콘 파란색
  const fileIconSx = { color: "#1e88e5" };

  const columns = useMemo(
    () => [
      { header: "등록일자", accessorKey: "reg_dt", size: 100 },
      { header: "조치 전 사진", accessorKey: "problem_image", size: 200 },
      { header: "전달 내용", accessorKey: "problem_note", size: 150 },
      { header: "조치일자", accessorKey: "mod_dt", size: 100 },
      { header: "조치 사진", accessorKey: "clean_image", size: 200 },
      { header: "조치 내용", accessorKey: "clean_note", size: 150 },
      { header: "비고", accessorKey: "note", size: 150 },
    ],
    []
  );

  // 저장
  const handleSave = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, index) => {
          const original = originalRows[index] || {};
          let updatedRow = { ...row };

          const isChanged = columns.some((col) => {
            const key = col.accessorKey;
            const origVal = original[key];
            const newVal = row[key];
            if (typeof origVal === "string" && typeof newVal === "string") {
              return normalize(origVal) !== normalize(newVal);
            }
            return origVal !== newVal;
          });

          if (!isChanged) return null;

          // 이미지 처리
          const imageFields = ["problem_image", "clean_image"];
          for (const field of imageFields) {
            if (row[field] && typeof row[field] === "object") {
              let uploadedPath;
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
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      if (payload.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const response = await api.post("/Operate/HygieneSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        await fetcHygieneList(selectedAccountId);
      }
    } catch (error) {
      Swal.fire({
        title: "실패",
        text: error,
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  if (loading) return <LoadingScreen />;

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
          <TextField
            select
            size="small"
            value={selectedAccountId}
            onChange={onSearchList}
            sx={{
              minWidth: isMobile ? 150 : 180,
              fontSize: isMobile ? "12px" : "14px",
            }}
            SelectProps={{ native: true }}
            disabled={!!localAccountId} // ✅ localStorage로 고정이면 변경 불가 (원하면 제거)
          >
            {(filteredAccountList || []).map((row) => (
              <option key={row.account_id} value={row.account_id}>
                {row.account_name}
              </option>
            ))}
          </TextField>
        )}

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
      <MDBox pt={1} pb={3} sx={tableSx}>
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
                  <tr key={rowIndex}>
                    {columns.map((col) => {
                      const key = col.accessorKey;
                      const value = row[key] ?? "";

                      // 이미지 컬럼
                      if (["problem_image", "clean_image"].includes(key)) {
                        const hasImage = !!value;

                        return (
                          <td
                            key={key}
                            style={{
                              ...getCellStyle(rowIndex, key, value),
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
                                handleCellChange(rowIndex, key, file);
                              }}
                            />

                            {hasImage ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  flexWrap: isMobile ? "wrap" : "nowrap",
                                }}
                              >
                                {/* 다운로드: 서버 문자열일 때만 */}
                                {typeof value === "string" && (
                                  <Tooltip title="다운로드">
                                    <IconButton
                                      size="small"
                                      sx={fileIconSx}
                                      onClick={() => handleDownload(value)}
                                    >
                                      <DownloadIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                {/* 미리보기: 서버/로컬 모두 */}
                                <Tooltip title="미리보기">
                                  <IconButton
                                    size="small"
                                    sx={fileIconSx}
                                    onClick={() => handleViewImage(value)}
                                  >
                                    <ImageSearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            ) : (
                              <label htmlFor={`upload-${key}-${rowIndex}`}>
                                <MDButton
                                  size="small"
                                  component="span"
                                  color="info"
                                  sx={{ fontSize: isMobile ? "10px" : "12px" }}
                                >
                                  이미지 업로드
                                </MDButton>
                              </label>
                            )}
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
                          onBlur={(e) => handleCellChange(rowIndex, key, e.target.innerText)}
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
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: isMobile ? "95%" : "80%",
              maxHeight: isMobile ? "90%" : "80%",
            }}
          >
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      zIndex: 1000,
                    }}
                  >
                    <button
                      onClick={zoomIn}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        marginBottom: 2,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={zoomOut}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        marginBottom: 2,
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>
                    <button
                      onClick={resetTransform}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        marginBottom: 2,
                        cursor: "pointer",
                      }}
                    >
                      ⟳
                    </button>
                    <button
                      onClick={handleCloseViewer}
                      style={{
                        border: "none",
                        padding: isMobile ? "2px 6px" : "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      X
                    </button>
                  </div>

                  <TransformComponent>
                    <img
                      src={encodeURI(viewImageSrc)}
                      alt="미리보기"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        borderRadius: 8,
                      }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}

export default HygieneSheetTab;
