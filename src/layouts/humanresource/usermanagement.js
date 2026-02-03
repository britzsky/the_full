/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTheme, useMediaQuery } from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import api from "api/api";
import Swal from "sweetalert2";

// 직책 코드 → 라벨
const POSITION_LABELS = {
  0: "대표",
  1: "팀장",
  2: "파트장",
  3: "매니저",
  4: "매니저",
  5: "매니저",
  6: "매니저",
  7: "매니저",
  8: "영양사",
};

// 부서 코드 → 라벨
const DEPT_LABELS = {
  0: "대표",
  1: "신사업팀",
  2: "회계팀",
  3: "인사팀",
  4: "영업팀",
  5: "운영팀",
  6: "개발팀",
  7: "현장",
};

function UserManagement() {
  const STICKY_TOP_OFFSET = "calc(48px + 12px)";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 화면 데이터/상태
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingDelYn, setPendingDelYn] = useState({});
  const [saving, setSaving] = useState(false);

  // 로그인 사용자 아이디 (저장 요청에 포함)
  const localUserId = useMemo(() => localStorage.getItem("user_id") || "", []);

  // 사용자 목록 조회 (DB → 화면)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/User/UserManageList");
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(
        list.map((item) => ({
          user_id: item.user_id,
          user_name: item.user_name,
          department: item.department,
          account_id: item.account_id,
          account_name: item.account_name,
          position: item.position,
          position_label: POSITION_LABELS[item.position] ?? item.position ?? "-",
          join_dt: item.join_dt,
          birth_date: item.birth_date,
          phone: item.phone,
          address: item.address,
          address_detail: item.address_detail,
          del_yn: String(item.del_yn || "N").toUpperCase(),
          orig_del_yn: String(item.del_yn || "N").toUpperCase(),
          dept_or_account:
            item.account_name ||
            (item.account_id
              ? item.account_id
              : DEPT_LABELS[item.department] ?? item.department ?? "-"),
          address_full: item.address
            ? `${item.address}${item.address_detail ? ` ${item.address_detail}` : ""}`
            : "-",
        }))
      );
      setPendingDelYn({});
    } catch (err) {
      console.error("사용자 목록 조회 실패:", err);
      Swal.fire("조회 실패", "사용자 목록을 불러오지 못했습니다.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelYnChange = (userId, nextValue, originalValue) => {
    // 드롭다운 변경값을 화면에 즉시 반영
    setRows((prev) =>
      prev.map((r) => (r.user_id === userId ? { ...r, del_yn: nextValue } : r))
    );

    // 원래값과 비교해서 변경 목록 갱신
    setPendingDelYn((prev) => {
      const next = { ...prev };
      if (String(nextValue).toUpperCase() === String(originalValue).toUpperCase()) {
        delete next[userId];
      } else {
        next[userId] = nextValue;
      }
      return next;
    });
  };

  // 변경된 del_yn만 저장
  const handleSaveDelYn = async () => {
    const entries = Object.entries(pendingDelYn).map(([user_id, del_yn]) => ({
      user_id,
      del_yn,
    }));

    if (entries.length === 0) {
      Swal.fire("알림", "변경 사항이 없습니다.", "info");
      return;
    }

    try {
      setSaving(true);
      for (const row of entries) {
        const userId = row.user_id;
        const delYn = row.del_yn;
        const res = await api.post("/User/UserDelYnSave", {
          user_id: userId,
          del_yn: delYn,
          actor_id: localUserId || undefined,
        });
        const code = String(res.data?.code ?? "");
        if (code !== "200") {
          throw new Error(res.data?.msg || "저장 실패");
        }
      }
      Swal.fire("저장 완료", "퇴사여부 변경이 저장되었습니다.", "success");
      setPendingDelYn({});
      fetchUsers();
    } catch (err) {
      Swal.fire("저장 실패", err.message || "퇴사여부 저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  // 테이블 컬럼 정의
  const columns = useMemo(
    () => [
      {
        Header: "아이디",
        accessor: "user_id",
        align: "center",
        width: "90px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111" fontWeight="medium">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "성명",
        accessor: "user_name",
        align: "center",
        width: "90px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111" fontWeight="medium">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "부서/거래처",
        accessor: "dept_or_account",
        align: "center",
        width: "140px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "직책",
        accessor: "position_label",
        align: "center",
        width: "80px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value ?? "-"}
          </MDTypography>
        ),
      },
      {
        Header: "입사일자",
        accessor: "join_dt",
        align: "center",
        width: "100px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "생년월일",
        accessor: "birth_date",
        align: "center",
        width: "100px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "전화번호",
        accessor: "phone",
        align: "center",
        width: "120px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "주소",
        accessor: "address_full",
        align: "center",
        width: "220px",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="#111">
            {value || "-"}
          </MDTypography>
        ),
      },
      {
        Header: "퇴사여부",
        accessor: "del_yn",
        align: "center",
        width: "110px",
        disableSortBy: true,
        Cell: ({ row }) => {
          const userId = row.original.user_id;
          const currentValue =
            pendingDelYn[userId] ??
            String(row.original.del_yn || "N").toUpperCase();
          return (
            <Select
              key={`${userId}-${currentValue}`}
              size="small"
              value={currentValue}
              onChange={(e) =>
                handleDelYnChange(userId, e.target.value, row.original.orig_del_yn)
              }
              sx={{ height: 30, minWidth: 90, fontSize: 10, color: "#111" }}
            >
              <MenuItem value="N">재직</MenuItem>
              <MenuItem value="Y">퇴사</MenuItem>
            </Select>
          );
        },
      },
    ],
    []
  );

  return (
    <DashboardLayout>
      {/* 상단 네비 */}
      <DashboardNavbar title="사용자 관리" />
      <MDBox
        pt={2}
        pb={3}
        sx={{
          background: "linear-gradient(180deg, #f2f6fb 0%, #ffffff 70%)",
          borderRadius: "16px",
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              {/* 상단 액션 바 */}
              <MDBox
                mx={0}
                mt={0}
                py={1}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                // ✅ 스크롤 시 상단 네비 아래에 붙여서 액션(저장/새로고침) 유지
                sx={(theme) => ({
                  position: "sticky",
                  top: STICKY_TOP_OFFSET,
                  zIndex: theme.zIndex.appBar - 1,
                  flexWrap: "wrap",
                  gap: 1,
                })}
              >
                <MDTypography variant="h6" color="white">
                  사용자 목록
                </MDTypography>
                <MDBox display="flex" gap={1} flexWrap="wrap">
                  <MDButton
                    size="small"
                    variant="contained"
                    color="light"
                    onClick={fetchUsers}
                    disabled={loading}
                  >
                    새로고침
                  </MDButton>
                  <MDButton
                    size="small"
                    variant="contained"
                    color="warning"
                    onClick={handleSaveDelYn}
                    disabled={saving}
                  >
                    저장
                  </MDButton>
                </MDBox>
              </MDBox>

              <MDBox p={2}>
                {loading ? (
                  <MDTypography variant="caption" color="text">
                    불러오는 중...
                  </MDTypography>
                ) : (
                  <>
                    {isMobile ? (
                      // ✅ 모바일: 카드형 리스트
                      <MDBox display="flex" flexDirection="column" gap={1}>
                        {rows.map((row) => (
                          <Card key={row.user_id} sx={{ p: 1.5 }}>
                            <MDBox display="flex" justifyContent="space-between" gap={1}>
                              <MDBox>
                                <MDTypography variant="caption" color="#111" fontWeight="medium">
                                  {row.user_name} ({row.user_id})
                                </MDTypography>
                                <MDTypography variant="caption" color="text">
                                  {row.dept_or_account} · {row.position_label}
                                </MDTypography>
                                <MDTypography variant="caption" color="text">
                                  {row.phone || "-"}
                                </MDTypography>
                                <MDTypography variant="caption" color="text">
                                  {row.join_dt || "-"}
                                </MDTypography>
                              </MDBox>
                              <Select
                                size="small"
                                value={pendingDelYn[row.user_id] ?? row.del_yn}
                                onChange={(e) =>
                                  handleDelYnChange(row.user_id, e.target.value, row.orig_del_yn)
                                }
                                sx={{ height: 30, minWidth: 90, fontSize: 10, color: "#111" }}
                              >
                                <MenuItem value="N">재직</MenuItem>
                                <MenuItem value="Y">퇴사</MenuItem>
                              </Select>
                            </MDBox>
                            <MDTypography variant="caption" color="text">
                              {row.address_full}
                            </MDTypography>
                          </Card>
                        ))}
                      </MDBox>
                    ) : (
                      // 데스크톱: 테이블
                      <DataTable
                        table={{ columns, rows }}
                        canSearch
                        entriesPerPage={{ defaultValue: 20, entries: [10, 20, 30, 40, 50] }}
                        showTotalEntries
                        isSorted
                        noEndBorder
                      />
                    )}
                  </>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

    </DashboardLayout>
  );
}

export default UserManagement;
