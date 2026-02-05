// ✅ src/layouts/membersFiles/AccountMembersFilesTab.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import useMembersFilesData from "./accountMembersFilesData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";

function AccountMembersFilesTab() {
  const { membersFilesListRows, accountList, loading, fetcMembersFilesList } =
    useMembersFilesData();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact || list.find((o) => String(o?.label || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountId(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions]);

  // ✅ 계정 변경 시 조회
  useEffect(() => {
    if (selectedAccountId) fetcMembersFilesList(selectedAccountId);
    else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  // ✅ 조회 → rows/originalRows 동기화
  useEffect(() => {
    const deepRows = (membersFilesListRows || []).map((r) => ({ ...r }));
    const deepOriginal = (membersFilesListRows || []).map((r) => ({ ...r }));
    setRows(deepRows);
    setOriginalRows(deepOriginal);
  }, [membersFilesListRows]);

  // ✅ 계정 자동 선택
  useEffect(() => {
    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(String(accountList[0].account_id));
    }
  }, [accountList, selectedAccountId]);

  // ✅ normalize (공백/개행 차이 무시)
  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ 비교용 값 표준화
  const toCompare = (key, v) => {
    if (v === null || v === undefined) return "";

    if (key === "file_path" && typeof v === "object") return "__FILE_OBJECT__";

    if (key === "issue_dt" || key === "expiry_dt") {
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    }

    if (key === "doc_type_id") return String(v);

    if (typeof v === "string") return normalize(v);

    return String(v);
  };

  // ✅ 변경 비교 스타일
  const getCellStyle = (rowIndex, key, value) => {
    if (!originalRows[rowIndex]) return { color: "black" };

    const original = originalRows[rowIndex]?.[key];
    const a = toCompare(key, original);
    const b = toCompare(key, value);

    return a !== b ? { color: "red" } : { color: "black" };
  };

  // ✅ 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row)));
  };

  // ✅ 문서종류 옵션
  const getDocTypeOptions = (position) => {
    if (position === "조리원") {
      return [
        { value: "2", label: "보건증" },
        { value: "3", label: "위생교육" },
        { value: "4", label: "보수교육" },
      ];
    }
    return [
      { value: "1", label: "자격증" },
      { value: "2", label: "보건증" },
      { value: "3", label: "위생교육" },
      { value: "4", label: "보수교육" },
    ];
  };

  // ✅ 문서종류 변경 시 → 재조회 or 초기화
  const handleDocTypeChange = async (rowIndex, newDocType) => {
    const memberId = rows[rowIndex]?.member_id;
    handleCellChange(rowIndex, "doc_type_id", newDocType);

    if (!memberId) return;

    try {
      const res = await api.get(`/Operate/AccountTypeForFileList`, {
        params: { member_id: memberId, doc_type_id: newDocType },
      });

      const data = Array.isArray(res.data) ? res.data[0] : res.data;

      if (data && Object.keys(data).length > 0) {
        const normalized = {
          ...data,
          doc_type_id: String(data.doc_type_id || newDocType),
          issue_dt: data.issue_dt ? String(data.issue_dt).slice(0, 10) : "",
          expiry_dt: data.expiry_dt ? String(data.expiry_dt).slice(0, 10) : "",
          file_path: data.file_path ?? "",
          note: data.note ?? "",
        };

        setRows((prev) =>
          prev.map((row, idx) => (idx === rowIndex ? { ...row, ...normalized } : row))
        );

        setOriginalRows((prev) =>
          prev.map((row, idx) => (idx === rowIndex ? { ...row, ...normalized } : row))
        );
      } else {
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === rowIndex
              ? {
                  ...row,
                  doc_id: "",
                  issue_dt: "",
                  expiry_dt: "",
                  file_path: "",
                  note: row.note ?? "",
                  doc_type_id: newDocType,
                }
              : row
          )
        );
      }
    } catch (err) {
      console.error("문서 조회 오류:", err);
    }
  };

  // ✅ 컬럼
  const columns = useMemo(
    () => [
      { header: "이름", accessorKey: "name", size: 80 },
      { header: "직급", accessorKey: "position", size: 80 },
      { header: "문서종류", accessorKey: "doc_type_id", size: 90 },
      { header: "발급일", accessorKey: "issue_dt", size: 110 },
      { header: "만료일", accessorKey: "expiry_dt", size: 110 },
      { header: "파일", accessorKey: "file_path", size: 90 },
      { header: "비고", accessorKey: "note", size: 250 },
    ],
    []
  );

  // ✅ 업로드
  const uploadImage = async (file, member_id, account_id) => {
    if (!file) return "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "memberFile");
      formData.append("gubun", member_id);
      formData.append("folder", account_id);

      const res = await api.post(`/Operate/OperateImgUpload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.code === 200) return res.data.image_path;
      return "";
    } catch (err) {
      Swal.fire("실패", "이미지 업로드 실패", "error");
      return "";
    }
  };

  // ✅ 다운로드
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

  // ✅ 미리보기
  const handlePreview = useCallback((value) => {
    if (!value) return;

    if (typeof value === "object") {
      const blobUrl = URL.createObjectURL(value);
      setViewImageSrc(blobUrl);
      return;
    }

    if (typeof value === "string") {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  }, []);

  // ✅ td 꽉 차는 입력 UI 스타일
  const inputLikeStyle = (color) => ({
    width: "100%",
    height: isMobile ? 28 : 30,
    boxSizing: "border-box",
    padding: "0 6px",
    fontSize: isMobile ? 10 : 12,
    border: "1px solid #cfcfcf",
    borderRadius: 4,
    background: "#fff",
    outline: "none",
    color,
  });

  // ✅ 저장
  const handleSave = async () => {
    try {
      const userId = localStorage.getItem("user_id");

      const changedIndexes = rows
        .map((row, idx) => {
          const original = originalRows[idx] || {};
          const isChanged =
            row.isNew ||
            Object.keys(row).some((key) => {
              const a = toCompare(key, original[key]);
              const b = toCompare(key, row[key]);
              return a !== b;
            });
          return isChanged ? idx : null;
        })
        .filter((v) => v !== null);

      if (changedIndexes.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const invalidIdx = changedIndexes.find((idx) => {
        const docType = String(rows[idx]?.doc_type_id ?? "").trim();
        return docType === "";
      });

      if (invalidIdx !== undefined) {
        const who = rows[invalidIdx]?.name ? ` (${rows[invalidIdx].name})` : "";
        Swal.fire("필수 입력", `문서종류는 반드시 선택해야 합니다.${who}`, "warning");
        return;
      }

      const modifiedRows = await Promise.all(
        changedIndexes.map(async (idx) => {
          const row = rows[idx];
          let updatedRow = { ...row };

          if (updatedRow.file_path && typeof updatedRow.file_path === "object") {
            const uploadedPath = await uploadImage(
              updatedRow.file_path,
              updatedRow.member_id,
              selectedAccountId
            );
            updatedRow.file_path = uploadedPath || "";
          }

          return {
            ...updatedRow,
            account_id: selectedAccountId || updatedRow.account_id,
            user_id: userId,
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      const res = await api.post(`/Operate/AccountMembersFilesSave`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.code === 200) {
        Swal.fire("저장 완료", "성공적으로 저장되었습니다.", "success");
        await fetcMembersFilesList(selectedAccountId);
      } else {
        Swal.fire("오류", res.data?.message || "저장 실패", "error");
      }
    } catch (err) {
      Swal.fire("오류", "저장 중 오류가 발생했습니다.", "error");
      console.error(err);
    }
  };

  // ✅ 테이블 스타일
  const tableSx = {
    flex: 1,
    mt: 1,
    maxHeight: isMobile ? "60vh" : "none",
    overflowX: "auto",
    overflowY: isMobile ? "auto" : "visible",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: isMobile ? "700px" : "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "3px" : "4px",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
  };

  const fileIconSx = { color: "#1e88e5" };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 1 : 2,
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* ✅ 거래처 Select → 검색 가능한 Autocomplete로 변경 */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          onChange={(_, opt) => setSelectedAccountId(opt ? opt.value : "")}
          inputValue={accountInput}
          onInputChange={(_, newValue) => setAccountInput(newValue)}
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
              label="거래처 검색"
              placeholder="거래처명을 입력"
              onKeyDown={(e) => {
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

        <MDButton
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

      {/* 테이블 */}
      <MDBox pt={1} pb={3} sx={tableSx}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.accessorKey} style={{ width: col.size }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => {
                  const key = col.accessorKey;
                  const value = row[key] ?? "";
                  const cellStyle = {
                    width: col.size,
                    ...getCellStyle(rowIndex, key, value),
                  };

                  // ✅ 이름/직급 수정불가
                  if (key === "name" || key === "position") {
                    return (
                      <td key={key} style={{ width: col.size, color: "black" }}>
                        {value}
                      </td>
                    );
                  }

                  // ✅ 문서종류
                  if (key === "doc_type_id") {
                    const options = getDocTypeOptions(row.position);
                    return (
                      <td key={key} style={cellStyle}>
                        <select
                          value={String(value || "")}
                          onChange={(e) => handleDocTypeChange(rowIndex, e.target.value)}
                          style={inputLikeStyle(cellStyle.color)}
                        >
                          <option value="">선택</option>
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  // ✅ 날짜
                  if (key === "issue_dt" || key === "expiry_dt") {
                    return (
                      <td key={key} style={cellStyle}>
                        <input
                          type="date"
                          value={String(value || "")}
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                          style={inputLikeStyle(cellStyle.color)}
                        />
                      </td>
                    );
                  }

                  // ✅ 파일
                  if (key === "file_path") {
                    const hasImage = !!value;

                    return (
                      <td key={key} style={{ ...cellStyle, verticalAlign: "middle" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            flexWrap: isMobile ? "wrap" : "nowrap",
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-${key}-${rowIndex}`}
                            style={{ display: "none" }}
                            onChange={(e) => handleCellChange(rowIndex, key, e.target.files?.[0])}
                          />

                          {hasImage ? (
                            <>
                              {typeof value === "string" && (
                                <Tooltip title="다운로드">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownload(value)}
                                    sx={fileIconSx}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="미리보기">
                                <IconButton
                                  size="small"
                                  onClick={() => handlePreview(value)}
                                  sx={fileIconSx}
                                >
                                  <ImageSearchIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <label htmlFor={`upload-${key}-${rowIndex}`}>
                              <MDButton
                                size="small"
                                color="info"
                                component="span"
                                sx={{
                                  fontSize: isMobile ? "10px" : "12px",
                                  minWidth: isMobile ? 60 : 80,
                                }}
                              >
                                업로드
                              </MDButton>
                            </label>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // ✅ 비고(note) 등
                  return (
                    <td
                      key={key}
                      style={cellStyle}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleCellChange(rowIndex, key, e.currentTarget.innerText)}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </MDBox>

      {/* ✅ 확대 미리보기 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setViewImageSrc(null)}
        >
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
            <TransformComponent>
              <img
                src={viewImageSrc}
                alt="미리보기"
                style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 8 }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </>
  );
}

export default AccountMembersFilesTab;
