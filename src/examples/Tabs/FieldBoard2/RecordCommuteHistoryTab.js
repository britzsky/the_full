/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import useRecordCommuteHistoryData from "./RecordCommuteHistorydata";

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ✅ 거래처 검색(Autocomplete, height: 40 강제)과 년/월 Select의 높이를 맞추기 위한 스타일.
//    이 프로젝트 테마(inputOutlined.js)가 size="small" 입력창 padding을 10px로 커스텀하고
//    있어서, 강제로 안 맞추면 Select만 더 짧게 렌더링된다.
const selectHeightSx = (minWidth) => ({
  minWidth,
  height: 40,
  "& .MuiSelect-select": {
    height: 40,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
  },
});

// ✅ "HH:mm:ss" -> "HH:mm" (초 단위는 화면에서 생략)
const formatHM = (timeStr) => (timeStr ? String(timeStr).slice(0, 5) : "");

// ✅ recordsheet(layouts/recordsheet/index.js)의 출근부 달력(직원명 × 일자) 형태를 그대로 참고해서,
//    업장 하나를 고르면 그 업장 전 직원의 한 달치 출퇴근 기록을 달력 테이블로 한눈에 보여준다.
//    (recordsheet는 근무타입을 "입력"하는 화면이고, 여기는 모바일 GPS 체크인 기록을 "조회"만 하는 화면)
function RecordCommuteHistoryTab() {
  const { accountList, fetchAccountList, fetchRecordList, loading } = useRecordCommuteHistoryData();

  const today = dayjs();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const accountInputRef = useRef("");
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  // ✅ 기본값은 특정 업장 이름을 하드코딩하지 않고, 거래처 목록에서 맨 위에 오는 업장을 그대로 선택한다.
  useEffect(() => {
    fetchAccountList()
      .then((list) => {
        const firstAccount = (list || [])[0];
        if (firstAccount) {
          setSelectedAccountId(firstAccount.account_id);
          accountInputRef.current = firstAccount.account_name;
        }
      })
      .finally(() => setInitialLoading(false));
  }, [fetchAccountList]);

  // ✅ 검색어 정확히 일치 -> 없으면 부분일치 후보가 하나뿐일 때만 선택 (recordsheet와 동일 규칙)
  const selectAccountByInput = useCallback(
    (rawInput) => {
      const q = String(rawInput ?? accountInputRef.current ?? "").trim();
      if (!q) return;
      const list = accountList || [];
      const qLower = q.toLowerCase();
      const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
      let partial = exact;
      if (!partial) {
        const candidates = list.filter((a) =>
          String(a?.account_name || "")
            .toLowerCase()
            .includes(qLower)
        );
        // 부분일치 후보가 여럿이면(동명 업장) 잘못 선택되지 않도록 매칭하지 않음
        if (candidates.length === 1) partial = candidates[0];
      }
      if (partial) {
        setSelectedAccountId(partial.account_id);
        accountInputRef.current = partial.account_name || q;
      }
    },
    [accountList]
  );

  const handleSearch = useCallback(async () => {
    if (!selectedAccountId) {
      Swal.fire("업장 선택", "거래처를 먼저 선택해주세요.", "warning");
      return;
    }

    const monthStart = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    const list = await fetchRecordList({
      account_id: selectedAccountId,
      start_date: monthStart.startOf("month").format("YYYY-MM-DD"),
      end_date: monthStart.endOf("month").format("YYYY-MM-DD"),
    });
    setRows(list);
    setSearched(true);
  }, [selectedAccountId, year, month, fetchRecordList]);

  // ✅ 업장/년/월을 고르면 그 업장 기록만 바로 조회한다. 업장 미선택 시에는 조회하지 않는다.
  useEffect(() => {
    if (!selectedAccountId) {
      setRows([]);
      setSearched(false);
      return;
    }
    handleSearch();
    // eslint-disable-next-line
  }, [selectedAccountId, year, month]);

  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

  // ✅ 직원명 × 일자 달력 형태로 피벗 (recordsheet의 attendanceRows day_N 패턴과 동일한 모양)
  const calendarRows = useMemo(() => {
    const map = new Map();

    (rows || []).forEach((row) => {
      const name = row.user_name || "";
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, days: {} });

      const day = dayjs(row.t_date).date();
      if (Number.isFinite(day)) {
        map.get(name).days[day] = row;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const dayHeaders = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const date = dayjs(`${year}-${month}-${dayNum}`);
        const weekday = KOREAN_WEEKDAYS[date.day()];
        const isSun = date.day() === 0;
        const isSat = date.day() === 6;
        return { dayNum, weekday, isSun, isSat };
      }),
    [daysInMonth, year, month]
  );

  const isEmpty = searched && calendarRows.length === 0;
  const displayRows = calendarRows;

  const tableSx = {
    maxHeight: "560px",
    overflow: "auto",
    "& table": {
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      borderCollapse: "separate",
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "nowrap",
      fontSize: "12px",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& td:first-of-type, & th:first-of-type": {
      position: "sticky",
      left: 0,
      background: "#f0f0f0",
      zIndex: 3,
      border: "1px solid #686D76",
    },
    "thead th:first-of-type": { zIndex: 5 },
  };

  return (
    <MDBox>
      {/* ✅ 거래처 검색/년/월/새로고침 - recordsheet처럼 헤더(카드) 바깥, 맨 위에 둔다 */}
      <MDBox
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="flex-end"
        gap={1}
        mb={2}
      >
        <Autocomplete
          size="small"
          options={accountList || []}
          value={(accountList || []).find((a) => a.account_id === selectedAccountId) || null}
          onChange={(_, newVal) => {
            if (!newVal) return;
            setSelectedAccountId(newVal?.account_id || "");
            accountInputRef.current = newVal?.account_name || "";
          }}
          onInputChange={(_, newValue) => {
            accountInputRef.current = String(newValue ?? "");
          }}
          getOptionLabel={(opt) => opt?.account_name || ""}
          isOptionEqualToValue={(opt, val) => opt?.account_id === val?.account_id}
          sx={{ minWidth: 280, flex: "0 0 auto" }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.nativeEvent?.isComposing) return;
                  e.preventDefault();
                  selectAccountByInput(e.currentTarget.value);
                }
              }}
              sx={{
                "& .MuiInputBase-root": { height: 40, fontSize: 12 },
                "& .MuiInputLabel-root": { fontSize: 12 },
                "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
              }}
            />
          )}
        />

        <Select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          size="small"
          sx={selectHeightSx(85)}
        >
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>
              {y}년
            </MenuItem>
          ))}
        </Select>

        <Select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          size="small"
          sx={selectHeightSx(75)}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>
              {m}월
            </MenuItem>
          ))}
        </Select>

        <MDButton
          variant="gradient"
          color="warning"
          onClick={handleSearch}
          sx={{
            fontSize: "0.8rem",
            minWidth: "unset !important",
            padding: "6px 20px !important",
            whiteSpace: "nowrap",
          }}
        >
          새로고침
        </MDButton>
      </MDBox>

      {/* ✅ recordsheet의 "출근 현황" 헤더와 동일한 스타일. 탭 콘텐츠 영역(FieldBoardTabs_2의
          Card) 안에 바로 놓이므로, 여기서 Card를 한 번 더 씌우지 않는다. */}
      <MDBox
        mt={0}
        py={1}
        px={2}
        variant="gradient"
        bgColor="info"
        borderRadius="lg"
        coloredShadow="info"
      >
        <MDTypography variant="h6" color="white">
          출퇴근 기록
        </MDTypography>
      </MDBox>

      <MDBox pt={2}>
        {initialLoading ? (
          <MDTypography variant="button" color="text">
            불러오는 중...
          </MDTypography>
        ) : !selectedAccountId ? (
          <MDTypography variant="button" color="text">
            거래처를 검색해서 업장을 선택하면 출퇴근 기록이 표시됩니다.
          </MDTypography>
        ) : loading ? (
          <MDTypography variant="button" color="text">
            불러오는 중...
          </MDTypography>
        ) : isEmpty ? (
          <MDTypography variant="button" color="text">
            조회된 출퇴근 기록이 없습니다.
          </MDTypography>
        ) : (
          <>
            <MDBox sx={tableSx}>
              <table>
                <thead>
                  <tr>
                    <th>직원명</th>
                    {dayHeaders.map(({ dayNum, weekday, isSun, isSat }) => (
                      <th
                        key={dayNum}
                        style={{
                          backgroundColor: isSun ? "#ffe5e5" : isSat ? "#ddf0ff" : undefined,
                        }}
                      >
                        {dayNum}일({weekday})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={row.name}>
                      <td style={{ fontWeight: "bold" }}>{row.name}</td>
                      {dayHeaders.map(({ dayNum }) => {
                        const record = row.days[dayNum];
                        if (!record) return <td key={dayNum} />;
                        return (
                          <td key={dayNum}>
                            {record.start_time && (
                              <MDTypography
                                variant="caption"
                                display="block"
                                sx={{ color: "#1FA45C", fontSize: "0.68rem" }}
                              >
                                출 {formatHM(record.start_time)}
                              </MDTypography>
                            )}
                            {record.end_time && (
                              <MDTypography
                                variant="caption"
                                display="block"
                                sx={{ color: "#E5566B", fontSize: "0.68rem" }}
                              >
                                퇴 {formatHM(record.end_time)}
                              </MDTypography>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>
          </>
        )}
      </MDBox>
    </MDBox>
  );
}

export default RecordCommuteHistoryTab;
