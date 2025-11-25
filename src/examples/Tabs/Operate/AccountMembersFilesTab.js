// ✅ src/layouts/membersFiles/AccountMembersFilesTab.js

import React, { useMemo, useState, useEffect } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField } from "@mui/material";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import useMembersFilesData from "./accountMembersFilesData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
//import { buildUrl } from "config";
import { API_BASE_URL } from "config";

function AccountMembersFilesTab() {
  const { membersFilesListRows, accountList, loading, fetcMembersFilesList } =
    useMembersFilesData();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // ✅ 계정 변경 시 조회
  useEffect(() => {
    if (selectedAccountId) fetcMembersFilesList(selectedAccountId);
    else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  // ✅ 조회 → rows 동기화
  useEffect(() => {
    const deep = membersFilesListRows.map((r) => ({ ...r }));
    setRows(deep);
    setOriginalRows(deep);
  }, [membersFilesListRows]);

  // ✅ 계정 자동 선택
  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  // ✅ normalize
  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ 변경 비교 스타일
  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (["issue_dt", "expiry_dt", "file_path"].includes(key)) {
      return original !== value ? { color: "red" } : { color: "black" };
    }
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
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

  // ✅ 문서종류 변경 시 → 데이터 재조회 or 초기화
  const handleDocTypeChange = async (rowIndex, newDocType) => {
    const memberId = rows[rowIndex]?.member_id;

    handleCellChange(rowIndex, "doc_type_id", newDocType);

    if (!memberId) return;

    try {
      const res = await api.get(`/Operate/AccountTypeForFileList`, {
        params: { member_id: memberId, doc_type_id: newDocType },
      });

      const data = Array.isArray(res.data) ? res.data[0] : res.data; // ✅ 배열이면 첫 번째 값만 사용

      if (data && Object.keys(data).length > 0) {
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === rowIndex
              ? {
                  ...row,
                  ...data,
                  doc_type_id: String(data.doc_type_id || newDocType), // ✅ 숫자 → 문자열 변환
                }
              : row
          )
        );

        setOriginalRows((prev) =>
          prev.map((row, idx) =>
            idx === rowIndex
              ? {
                  ...row,
                  ...data,
                  doc_type_id: String(data.doc_type_id || newDocType),
                }
              : row
          )
        );
      } else {
        // ✅ 데이터 없으면 초기화
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === rowIndex
              ? {
                  ...row,
                  doc_id: "",
                  issue_dt: "",
                  expiry_dt: "",
                  file_path: "",
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

  // ✅ 테이블 컬럼 정의
  const columns = useMemo(
    () => [
      { header: "이름", accessorKey: "name", size: 80 },
      { header: "직급", accessorKey: "position", size: 80 },
      { header: "문서종류", accessorKey: "doc_type_id", size: 80 },
      { header: "발급일", accessorKey: "issue_dt", size: 100 },
      { header: "만료일", accessorKey: "expiry_dt", size: 100 },
      { header: "파일", accessorKey: "file_path", size: 80 },
      { header: "비고", accessorKey: "note", size: 250 },
    ],
    []
  );

  // ✅ 저장 (user_id 포함)
  const handleSave = async () => {
    try {
      const userId = localStorage.getItem("user_id");
      const modifiedRows = await Promise.all(
        rows.map(async (row, idx) => {
          const original = originalRows[idx] || {};
          let updatedRow = { ...row };

          const isChanged =
            row.isNew ||
            Object.keys(updatedRow).some((key) => {
              const origVal = original[key];
              const curVal = updatedRow[key];
              if (typeof origVal === "string" && typeof curVal === "string")
                return normalize(origVal) !== normalize(curVal);
              return origVal !== curVal;
            });

          if (!isChanged) return null;

          // ✅ 이미지가 파일 객체이면 서버 업로드 후 URL로 변환
          if (row.file_path && typeof row.file_path === "object") {
            const uploadedPath = await uploadImage(
              row.file_path,
              row.member_id,
              selectedAccountId
            );
            updatedRow.file_path = uploadedPath;
          }

          return {
            ...updatedRow,
            account_id: selectedAccountId || row.account_id,
            user_id: userId,
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);
      if (payload.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const res = await api.post(
        `/Operate/AccountMembersFilesSave`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "성공적으로 저장되었습니다.", "success");
        await fetcMembersFilesList(selectedAccountId);
      }
    } catch (err) {
      Swal.fire("오류", "저장 중 오류가 발생했습니다.", "error");
      console.error(err);
    }
  };

  // ✅ 이미지 업로드 함수
  const uploadImage = async (file, member_id, account_id) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "memberFile");
      formData.append("gubun", member_id);
      formData.append("folder", account_id);

      const res = await api.post(`/Operate/OperateImgUpload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.code === 200) return res.data.image_path;
    } catch (err) {
      Swal.fire("실패", "이미지 업로드 실패", "error");
    }
  };

  // ✅ 테이블 스타일
  const tableSx = {
    flex: 1,
    minHeight: 0,
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 130,
      zIndex: 10,
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* ✅ 상단 메뉴 */}
      <MDBox 
        pb={1} 
        sx={{ 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: 1, 
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
          }}
      >
        <TextField
          select size="small"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {(accountList || []).map((row) => (
            <option key={row.account_id} value={row.account_id}>
              {row.account_name}
            </option>
          ))}
        </TextField>
        <MDButton color="info" onClick={handleSave}>저장</MDButton>
      </MDBox>

      {/* ✅ 테이블 */}
      <MDBox pt={1} pb={3} sx={tableSx}>
        {/* <MDBox
          mx={0} mt={-3} py={1} px={2}
          variant="gradient" bgColor="info"
          borderRadius="lg" coloredShadow="info"
          display="flex" justifyContent="space-between" alignItems="center"
        >
          <MDTypography variant="h6" color="white">자격증 관리</MDTypography>
        </MDBox> */}

        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.accessorKey} style={{ width: col.size }}>{col.header}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => {
                  const key = col.accessorKey;
                  const value = row[key] ?? "";
                  const style = { width: col.size, ...getCellStyle(rowIndex, key, value) };

                  // ✅ 문서종류 select + 행 재조회/초기화
                  if (key === "doc_type_id") {
                    const options = getDocTypeOptions(row.position);
                    return (
                      <td key={key} style={style}>
                        <select
                          value={value || ""}
                          onChange={(e) => handleDocTypeChange(rowIndex, e.target.value)}
                          style={{ width: "100%", ...style }}
                        >
                          <option value="">선택</option>
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  // ✅ 날짜 입력
                  if (["issue_dt", "expiry_dt"].includes(key)) {
                    return (
                      <td key={key} style={style}>
                        <input
                          type="date"
                          value={value}
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                          style={{ width: "100%", ...style }}
                        />
                      </td>
                    );
                  }

                  // ✅ 파일 (이미지 업로드/미리보기)
                  if (key === "file_path") {
                    return (
                      <td key={key} style={{ ...style, verticalAlign: "middle" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",  // 세로 중앙
                            justifyContent: "center", // 가운데 정렬
                            gap: "8px", // 이미지와 버튼 사이 간격
                            height: "100%",
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-${key}-${rowIndex}`}
                            style={{ display: "none" }}
                            onChange={(e) => handleCellChange(rowIndex, key, e.target.files[0])}
                          />
                          {value && (
                            <img
                              src={
                                typeof value === "object"
                                  ? URL.createObjectURL(value)
                                  : `${API_BASE_URL}${value}`
                              }
                              alt="preview"
                              style={{
                                maxWidth: "80px",
                                maxHeight: "80px",
                                cursor: "pointer",
                                borderRadius: "4px",
                              }}
                              onClick={() =>
                                setViewImageSrc(
                                  typeof value === "object"
                                    ? URL.createObjectURL(value)
                                    : `${API_BASE_URL}${value}`
                                )
                              }
                            />
                          )}
                          <label htmlFor={`upload-${key}-${rowIndex}`}>
                            <MDButton
                              size="small"
                              color="info"
                              component="span"
                              style={{ alignSelf: "center" }} // 버튼 세로 중앙 고정
                            >
                              업로드
                            </MDButton>
                          </label>
                        </div>
                      </td>
                    );
                  }

                  // ✅ 기본 contentEditable
                  return (
                    <td
                      key={key}
                      style={style}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleCellChange(rowIndex, key, e.target.innerText.trim())}
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

      {/* ✅ 이미지 확대 보기 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setViewImageSrc(null)}
        >
          <TransformWrapper initialScale={1}>
            <TransformComponent>
              <img src={viewImageSrc} alt="미리보기" style={{ maxWidth: "80%", maxHeight: "80%" }} />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </>
  );
}

export default AccountMembersFilesTab;

