/* eslint-disable react/function-component-definition */
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import PropTypes from "prop-types";
// @mui
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

// MD
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Layout
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import LoadingScreen from "layouts/loading/loadingscreen";

// (선택) 로딩 컴포넌트가 프로젝트에 있으면 사용
// import LoadingScreen from "layouts/loading/loadingscreen";

import useDashBoardData from "layouts/dashboard/data/dashboardData";

function HeaderCard({ title, children, minHeight = 140 }) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} display="flex" alignItems="center" justifyContent="space-between">
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {title}
        </MDTypography>
        <Icon sx={{ opacity: 0.6, fontSize: 18 }}>chevron_right</Icon>
      </MDBox>

      <Divider sx={{ my: 0 }} />

      <MDBox px={2} py={1.5} sx={{ minHeight }}>
        {children}
      </MDBox>
    </Card>
  );
}

HeaderCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
HeaderCard.defaultProps = {
  children: null,
  minHeight: 140,
};

function ListLines({ items, emptyText = "데이터가 없습니다." }) {
  if (!items?.length) {
    return (
      <MDTypography variant="caption" color="text" sx={{ opacity: 0.75 }}>
        {emptyText}
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" flexDirection="column" gap={0.75}>
      {items.map((it, idx) => (
        <MDBox key={`${idx}-${it?.content || ""}`} display="flex" justifyContent="space-between" gap={2}>
          <MDTypography variant="caption" color="dark" sx={{ fontWeight: 500 }}>
            {it.content}
          </MDTypography>
          {it.date && (
            <MDTypography variant="caption" color="text" sx={{ opacity: 0.8, whiteSpace: "nowrap" }}>
              {it.content}
            </MDTypography>
          )}
        </MDBox>
      ))}
    </MDBox>
  );
}

ListLines.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      content: PropTypes.string,
    })
  ),
  emptyText: PropTypes.string,
};

ListLines.defaultProps = {
  items: [],
  emptyText: "데이터가 없습니다.",
};

// ✅ 행사 종류별 색상 매핑
const getTypeColor = (type) => {
  const t = String(type);
  switch (t) {
    case "1": // 행사
      return "#FF5F00";
    case "2": // 미팅
      return "#0046FF";
    case "3": // 오픈
      return "#527853";
    case "4": // 오픈준비
      return "#F266AB";
    case "5": // 외근
      return "#A459D1";
    case "6": // 출장
      return "#D71313";
    case "7": // 체크
      return "#364F6B";
    case "8": // 연차
      return "#1A0841";
    case "9": // 오전반차
      return "#1A0841";
    case "10": // 오후반차
      return "#1A0841";
    default:
    return "#F2921D";
  }
};

// ✅ 행사 종류 정의 (getTypeColor 주석과 동일하게)
const TYPE_OPTIONS = [
  { value: "1", label: "행사" },
  { value: "2", label: "미팅" },
  { value: "3", label: "오픈" },
  { value: "4", label: "오픈준비" },
  { value: "5", label: "외근" },
  { value: "6", label: "출장" },
  { value: "7", label: "체크" },
  { value: "8", label: "연차" },
  { value: "9", label: "오전반차" },
  { value: "10", label: "오후반차" },
];

// 🔽 TYPE_OPTIONS 아래 즈음에 추가
const getTypeLabel = (typeValue) => {
  const v = String(typeValue ?? "");
  const found = TYPE_OPTIONS.find((t) => t.value === v);
  return found ? found.label : "";
};

function ScheduleLines({ items, emptyText = "일정이 없습니다." }) {
  if (!items?.length) {
    return (
      <MDTypography variant="caption" color="text" sx={{ opacity: 0.75 }}>
        {emptyText}
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" flexDirection="column" gap={1}>
      {items.map((it, idx) => {
        const typeLabel = getTypeLabel(it.type);
        return (
          <MDBox
            key={`${idx}-${it?.time || ""}`}
            display="flex"
            alignItems="center"
            gap={1.2}
            sx={{
              //borderLeft: `4px solid ${getTypeColor(it.type)}`,
              pl: 1,              // 컬러바와 내용 간격
              py: 0.4,
              borderRadius: "8px",
              backgroundColor: `${getTypeColor(it.type)}20`, // ✅ 투명도 있는 배경(헥사 14 ≈ 8%)
            }}
          >
            <MDTypography
              variant="caption"
              color="dark"
              sx={{ fontWeight: 800, whiteSpace: "nowrap", minWidth: 86 }}
            >
              {/* ✅ type 라벨 + content */}
              {typeLabel ? `[${typeLabel}] ` : ""}
              {it.content}
            </MDTypography>
            <MDTypography variant="caption" color="dark" sx={{ fontWeight: 600 }}>
              {it.user_name}
              {it.position_name ? `[${it.position_name}] ` : ""}
            </MDTypography>
          </MDBox>
        );
      })}
    </MDBox>
  );
}

ScheduleLines.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      user_name: PropTypes.string,
      content: PropTypes.string,
    })
  ),
  emptyText: PropTypes.string,
};

ScheduleLines.defaultProps = {
  items: [],
  emptyText: "일정이 없습니다.",
};

function SmallBox({ title, items }) {
  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} textAlign="center">
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {title}
        </MDTypography>
      </MDBox>
      <Divider sx={{ my: 0 }} />
      <MDBox px={2} py={1.5} minHeight={90}>
        <ListLines items={items} emptyText="비어있습니다." />
      </MDBox>
    </Card>
  );
}

SmallBox.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.array,
};

SmallBox.defaultProps = {
  items: [],
};

function MiniCalendar() {
  const [cursor, setCursor] = useState(dayjs());

  const start = useMemo(() => cursor.startOf("month").startOf("week"), [cursor]);
  const end = useMemo(() => cursor.endOf("month").endOf("week"), [cursor]);

  const days = useMemo(() => {
    const arr = [];
    let d = start;
    while (d.isBefore(end) || d.isSame(end, "day")) {
      arr.push(d);
      d = d.add(1, "day");
    }
    return arr;
  }, [start, end]);

  const weekLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} display="flex" alignItems="center" justifyContent="space-between">
        <Icon
          sx={{ cursor: "pointer", opacity: 0.7 }}
          onClick={() => setCursor((p) => p.subtract(1, "month"))}
        >
          chevron_left
        </Icon>
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {cursor.format("YYYY")}년 {cursor.format("M")}월
        </MDTypography>
        <Icon
          sx={{ cursor: "pointer", opacity: 0.7 }}
          onClick={() => setCursor((p) => p.add(1, "month"))}
        >
          chevron_right
        </Icon>
      </MDBox>
      <Divider sx={{ my: 0 }} />

      <MDBox px={2} py={1.5}>
        <MDBox display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.75} mb={1}>
          {weekLabels.map((w) => (
            <MDTypography
              key={w}
              variant="caption"
              sx={{
                fontWeight: 800,
                textAlign: "center",
                color: w === "SUN" ? "error.main" : "text.secondary",
              }}
            >
              {w}
            </MDTypography>
          ))}
        </MDBox>

        <MDBox display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.75}>
          {days.map((d) => {
            const isThisMonth = d.month() === cursor.month();
            const isToday = d.isSame(dayjs(), "day");
            return (
              <MDBox
                key={d.format("YYYY-MM-DD")}
                sx={{
                  height: 28,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isThisMonth ? 1 : 0.35,
                  border: isToday ? "1px solid rgba(0,0,0,0.35)" : "1px solid transparent",
                }}
              >
                <MDTypography variant="caption" color="dark" sx={{ fontWeight: isToday ? 800 : 600 }}>
                  {d.date()}
                </MDTypography>
              </MDBox>
            );
          })}
        </MDBox>
      </MDBox>
    </Card>
  );
}

function ContractTableCard({ rows }) {
  return (
    <Card
      sx={{
        borderRadius: "18px",
        boxShadow: "none",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#F3F3F3",
      }}
    >
      <MDBox px={2} pt={1.5} pb={1} textAlign="center">
        <MDTypography variant="button" fontWeight="bold" color="dark">
          계약 만료 예정 고객사
        </MDTypography>
      </MDBox>
      <Divider sx={{ my: 0 }} />
      <MDBox px={2} py={1.5}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 780,
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",

              // ✅ 누군가 flex/block로 바꾼 걸 강제로 되돌림 (핵심)
              "& thead": { display: "table-header-group" },
              "& tbody": { display: "table-row-group" },
              "& tr": { display: "table-row" },
              "& th, & td": {
                display: "table-cell",
                whiteSpace: "nowrap",
                borderColor: "rgba(0,0,0,0.08)",
              },
            }}
          >
            <colgroup>
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 250 }} />
              <col style={{ width: 70 }} />
            </colgroup>

            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  고객사
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  계약기간
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  유형
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  지역
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 12, backgroundColor: "rgba(120,170,90,0.15)" }}>
                  담당자
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows?.length ? (
                rows.map((r, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.customer_name}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12 }}>
                      {r.contract_start}~{r.contract_end}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.account_type}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.account_address}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.manager_name}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} sx={{ fontSize: 12, opacity: 0.7 }}>
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </MDBox>
    </Card>
  );
}

ContractTableCard.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      customer_name: PropTypes.string,
      start_date: PropTypes.string,
      end_date: PropTypes.string,
      type: PropTypes.string,
      region: PropTypes.string,
      manager: PropTypes.string,
    })
  ),
};

ContractTableCard.defaultProps = {
  rows: [],
};

function Dashboard() {
  const {
    accountList,
    loading,
    notices,
    meals,
    educations,
    welfares,
    opsSchedules,
    salesSchedules,
    contracts,
    bookmarks,
    todos,
    fetchAll,
  } = useDashBoardData();

  // ✅ account_id 결정: localStorage 우선 → 없으면 accountList 첫 번째
  const [accountId, setAccountId] = useState(localStorage.getItem("account_id") || "");

  useEffect(() => {
    if (!accountId && accountList?.length) {
      setAccountId(accountList[0].account_id);
    }
  }, [accountList, accountId]);

  // ✅ dashboard 접속 시 "한 번에 다 조회"
  useEffect(() => {
    if (!accountId) return;
    fetchAll(accountId);
  }, [accountId]);

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={1} pt={2}>
        {/* 상단 4개 카드 */}
        <Grid container spacing={2.2}>
          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="공지사항">
              <ListLines items={notices} />
            </HeaderCard>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="본사 식단표">
              <ListLines items={meals} emptyText="식단표가 없습니다." />
            </HeaderCard>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="본사교육">
              <ListLines items={educations} emptyText="교육이 없습니다." />
            </HeaderCard>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <HeaderCard title="복리후생">
              <ListLines items={welfares} emptyText="복리후생 공지가 없습니다." />
            </HeaderCard>
          </Grid>
        </Grid>

        {/* 중단: 운영/영업 일정 + 우측(Bookmark/ToDo/달력) */}
        <MDBox mt={2.2}>
          <Grid container spacing={2.2}>
            <Grid item xs={12} lg={8}>
              <Grid container spacing={2.2}>
                <Grid item xs={12} md={6}>
                  <HeaderCard title={`운영팀 일정(${dayjs().format("YYYY-MM-DD")})`} minHeight={170}>
                    <ScheduleLines items={opsSchedules} />
                  </HeaderCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <HeaderCard title={`영업팀 일정(${dayjs().format("YYYY-MM-DD")})`} minHeight={170}>
                    <ScheduleLines items={salesSchedules} />
                  </HeaderCard>
                </Grid>
              </Grid>

              {/* 하단 큰 테이블 */}
              <MDBox mt={2.2}>
                <ContractTableCard rows={contracts} />
              </MDBox>
            </Grid>

            {/* 우측 사이드 */}
            <Grid item xs={12} lg={4}>
              <Grid container spacing={2.2}>
                <Grid item xs={12}>
                  <SmallBox title="Bookmark" items={bookmarks} />
                </Grid>
                <Grid item xs={12}>
                  <SmallBox title="To Do List" items={todos} />
                </Grid>
                <Grid item xs={12}>
                  <MiniCalendar />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>

      {/* <Footer /> */}
    </DashboardLayout>
  );
}

export default Dashboard;
