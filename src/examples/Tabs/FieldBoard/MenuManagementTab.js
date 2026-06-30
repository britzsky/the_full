import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";

const MEAL_ROWS = [
  { key: "breakfast", label: "조식" },
  { key: "lunch", label: "중식" },
  { key: "dinner", label: "석식" },
  { key: "snack", label: "간식" },
  { key: "note", label: "비고" },
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const makeDateKey = (date) => date.format("YYYY-MM-DD");

const makeTableId = (accountId, year, month, week) => `${accountId}/${year}/${month}/${week}`;

const buildMonthWeeks = (year, month) => {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const last = first.endOf("month");
  const start = first.startOf("week");
  const end = last.endOf("week");
  const weeks = [];
  let cursor = start;

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    weeks.push(Array.from({ length: 7 }, (_, index) => cursor.add(index, "day")));
    cursor = cursor.add(7, "day");
  }

  return weeks;
};

const createEmptyMenus = (weeks) => {
  const next = {};

  weeks.flat().forEach((date) => {
    next[makeDateKey(date)] = MEAL_ROWS.reduce(
      (acc, row) => ({
        ...acc,
        [row.key]: "",
      }),
      {}
    );
  });

  return next;
};

const getResponseRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.details)) return data.details;
  if (Array.isArray(data?.detail)) return data.detail;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const pickFirstValue = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const normalizeAccountRow = (row) => ({
  account_id: pickFirstValue(row, ["account_id", "accountId", "id", "value"]),
  account_name: pickFirstValue(row, ["account_name", "accountName", "name", "label", "customer_name"]),
});

const normalizeFetchedMenus = (rows, baseMenus) => {
  const next = { ...baseMenus };
  const detailRowsByCell = {};

  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const rawDate = item.meal_date || item.menu_date || item.date;
    if (!rawDate) return;

    const dateKey = dayjs(rawDate).format("YYYY-MM-DD");
    if (!next[dateKey]) return;

    const mealSlot = item.meal_slot;
    if (mealSlot) {
      const cellKey = `${dateKey}__${mealSlot}`;
      detailRowsByCell[cellKey] = [...(detailRowsByCell[cellKey] || []), item];
      return;
    }

    next[dateKey] = MEAL_ROWS.reduce(
      (acc, row) => ({
        ...acc,
        [row.key]: item[row.key] ?? (row.key === "breakfast" ? item.morning : undefined) ?? acc[row.key] ?? "",
      }),
      {
        ...next[dateKey],
        idx: item.idx ?? item.menu_id ?? next[dateKey].idx,
      }
    );
  });

  Object.entries(detailRowsByCell).forEach(([cellKey, cellRows]) => {
    const [dateKey, mealSlot] = cellKey.split("__");
    if (!next[dateKey]) return;

    const menuNames = cellRows
      .slice()
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((item) => item.menu_name)
      .filter(Boolean);

    next[dateKey] = {
      ...next[dateKey],
      [mealSlot]: menuNames.join("\n"),
    };
  });

  return next;
};

const buildDetailRows = ({ menus, weekDays, selectedAccountId, selectedAccountOption, tableId }) =>
  weekDays.flatMap((date) => {
    const dateKey = makeDateKey(date);
    const dailyMenus = menus[dateKey] || {};
    const weekday = WEEKDAY_LABELS[date.day()];

    return MEAL_ROWS.flatMap((meal) =>
      String(dailyMenus[meal.key] || "")
        .split(/\r?\n/)
        .map((menuName) => menuName.trim())
        .filter(Boolean)
        .map((menuName, index) => ({
          table_id: tableId,
          meal_date: dateKey,
          meal_slot: meal.key,
          sort_order: index + 1,
          menu_id: `${date.format("YYYYMMDD")}${meal.key.slice(0, 1)}${index + 1}`,
          account_id: selectedAccountId,
          account_name: selectedAccountOption?.account_name || "",
          weekday,
          menu_name: menuName,
        }))
    );
  });

function MenuManagementTab({ standalone = false }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const today = dayjs();
  const [accountList, setAccountList] = useState([]);
  const [accountInput, setAccountInput] = useState("");
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [week, setWeek] = useState(1);
  const [menus, setMenus] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const selectedWeekDays = useMemo(() => weeks[week - 1] || weeks[0] || [], [week, weeks]);
  const monthLabel = `${year}년 ${String(month).padStart(2, "0")}월`;

  const accountOptions = useMemo(() => accountList || [], [accountList]);

  const selectedAccountOption = useMemo(
    () => accountOptions.find((option) => String(option.account_id) === String(selectedAccountId)) || null,
    [accountOptions, selectedAccountId]
  );

  useEffect(() => {
    if (!localAccountId) return;
    const matched =
      (accountList || []).find((row) => String(row.account_id) === String(localAccountId)) || null;

    if (matched) {
      if (String(selectedAccountId) !== String(localAccountId)) {
        setSelectedAccountId(localAccountId);
      }
      setAccountInput(matched.account_name || "");
    }
  }, [accountList, localAccountId, selectedAccountId]);

  useEffect(() => {
    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
      .then((list) => {
        const rows = Array.isArray(list?.data) ? list.data : [];
        setAccountList(
          rows
            .map(normalizeAccountRow)
            .filter((item) => item.account_id && item.account_name)
        );
      })
      .catch((err) => {
        console.error("데이터 조회 실패 (AccountList):", err);
        setAccountList([]);
      });
  }, []);

  useEffect(() => {
    if (accountOptions.length === 0) return;
    if (selectedAccountId && selectedAccountOption) return;

    const localMatched =
      localAccountId &&
      accountOptions.find((option) => String(option.account_id) === String(localAccountId));
    const picked = localMatched || accountOptions[0];

    setSelectedAccountId(String(picked.account_id));
    setAccountInput(picked.account_name || "");
  }, [accountOptions, localAccountId, selectedAccountId, selectedAccountOption]);

  useEffect(() => {
    if (!selectedAccountOption) return;
    setAccountInput(selectedAccountOption.account_name || "");
  }, [selectedAccountOption]);

  useEffect(() => {
    if (week <= weeks.length) return;
    setWeek(weeks.length || 1);
  }, [week, weeks.length]);

  const fetchMenus = useCallback(async () => {
    const baseMenus = createEmptyMenus(selectedWeekDays);
    if (!selectedAccountId) {
      setMenus(baseMenus);
      return;
    }

    const tableId = makeTableId(selectedAccountId, year, month, week);

    setLoading(true);
    try {
      const response = await api.get("/Operate/AccountMenuSheetList", {
        params: {
          account_id: selectedAccountId,
          year,
          month,
          week,
          table_id: tableId,
          table_year: year,
          table_month: month,
          table_week: week,
        },
      });
      setMenus(normalizeFetchedMenus(getResponseRows(response.data), baseMenus));
    } catch (error) {
      console.error("식단표 조회 실패:", error);
      setMenus(baseMenus);
    } finally {
      setLoading(false);
    }
  }, [month, selectedAccountId, selectedWeekDays, week, year]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const selectAccountByInput = () => {
    const keyword = String(accountInput || "").trim().toLowerCase();
    if (!keyword) return;

    const exact = accountOptions.find(
      (option) => String(option.account_name || "").toLowerCase() === keyword
    );
    const partial = accountOptions.find((option) =>
      String(option.account_name || "").toLowerCase().includes(keyword)
    );
    const picked = exact || partial;
    if (!picked) return;

    setSelectedAccountId(String(picked.account_id));
    setAccountInput(picked.account_name || "");
  };

  const handleCellChange = (dateKey, field, value) => {
    setMenus((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedAccountId) {
      Swal.fire("확인", "거래처를 선택하세요.", "warning");
      return;
    }

    const accountName = selectedAccountOption?.account_name || "";
    const tableId = makeTableId(selectedAccountId, year, month, week);
    const tableName = `${accountName} ${month}월 ${week}주차 식단표`;
    const detailRows = buildDetailRows({
      menus,
      weekDays: selectedWeekDays,
      selectedAccountId,
      selectedAccountOption,
      tableId,
    });

    const payload = {
      table_id: tableId,
      account_id: selectedAccountId,
      account_name: accountName,
      table_name: tableName,
      table_year: year,
      table_month: month,
      table_week: week,
      year,
      month,
      week,
      details: detailRows,
      menus: selectedWeekDays.map((date) => {
        const menuDate = makeDateKey(date);
        const value = menus[menuDate] || {};
        return {
          idx: value.idx || null,
          menu_date: menuDate,
          breakfast: value.breakfast || "",
          lunch: value.lunch || "",
          dinner: value.dinner || "",
          snack: value.snack || "",
          note: value.note || "",
          del_yn: "N",
        };
      }),
    };

    setSaving(true);
    try {
      const response = await api.post("/Operate/AccountMenuSheetSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data?.code && response.data.code !== 200) {
        throw new Error(response.data?.message || "저장에 실패했습니다.");
      }

      Swal.fire("저장 완료", "식단표가 저장되었습니다.", "success");
      fetchMenus();
    } catch (error) {
      console.error("식단표 저장 실패:", error);
      Swal.fire("저장 실패", error?.message || "서버 연결에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MDBox
        sx={{
          position: "sticky",
          top: standalone ? 48 : 101,
          zIndex: 12,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e5e5",
          py: 1,
        }}
      >
        <MDBox
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <MDBox
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              flexWrap: "wrap",
              width: isMobile ? "100%" : "auto",
            }}
          >
            <Autocomplete
              size="small"
              sx={{
                width: isMobile ? "100%" : 240,
                flex: isMobile ? "1 1 100%" : "0 0 auto",
              }}
              options={accountOptions}
              value={selectedAccountOption}
              onChange={(_, option) => {
                if (!option) return;
                setSelectedAccountId(String(option.account_id));
                setAccountInput(option.account_name || "");
              }}
              inputValue={accountInput}
              onInputChange={(_, value) => {
                setAccountInput(value);
              }}
              getOptionLabel={(option) => option?.account_name ?? ""}
              isOptionEqualToValue={(option, value) =>
                String(option.account_id) === String(value.account_id)
              }
              disableClearable
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처"
                  placeholder={
                    accountOptions.length === 0
                      ? "거래처 목록이 없습니다"
                      : "거래처명 검색"
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      selectAccountByInput();
                    }
                  }}
                  sx={{
                    "& .MuiInputBase-root": { height: 36, fontSize: 12 },
                    "& .MuiInputLabel-root": { fontSize: 12 },
                  }}
                />
              )}
            />

            <TextField
              type="month"
              size="small"
              label="조회월"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={(event) => {
                const [nextYear, nextMonth] = String(event.target.value || "").split("-");
                if (!nextYear || !nextMonth) return;
                setYear(Number(nextYear));
                setMonth(Number(nextMonth));
                setWeek(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{
                width: 150,
                "& .MuiInputBase-root": { height: 36, fontSize: 12 },
                "& .MuiInputLabel-root": { fontSize: 12 },
              }}
            />

            <TextField
              select
              size="small"
              label="주차"
              value={week}
              onChange={(event) => setWeek(Number(event.target.value))}
              sx={{
                width: 100,
                "& .MuiInputBase-root": { height: 36, fontSize: 12 },
                "& .MuiInputLabel-root": { fontSize: 12 },
              }}
            >
              {weeks.map((_, index) => (
                <MenuItem key={index + 1} value={index + 1}>
                  {index + 1}주차
                </MenuItem>
              ))}
            </TextField>

            <MDButton
              variant="outlined"
              color="info"
              size="small"
              startIcon={<SearchIcon />}
              onClick={fetchMenus}
              sx={{ minWidth: 78 }}
            >
              조회
            </MDButton>
          </MDBox>

          <MDButton
            variant="gradient"
            color="info"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ minWidth: 78 }}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      {loading ? (
        <LoadingScreen />
      ) : (
        <MDBox pt={2} pb={standalone ? 3 : 1}>
          <Grid container spacing={2}>
            {[selectedWeekDays].map((weekDays) => {
              const weekTitle = `${monthLabel} ${week}주차 식단표`;

              return (
                <Grid item xs={12} key={weekTitle}>
                  <Card
                    sx={{
                      borderRadius: 1,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <MDBox
                      sx={{
                        bgcolor: "#fff8e1",
                        borderBottom: "2px solid #d6a23a",
                        py: 1,
                        textAlign: "center",
                      }}
                    >
                      <MDTypography sx={{ fontSize: 17, fontWeight: 900, color: "#222" }}>
                        {selectedAccountOption?.account_name ? `${selectedAccountOption.account_name} ` : ""}
                        {weekTitle}
                      </MDTypography>
                    </MDBox>

                    <MDBox
                      sx={{
                        overflowX: "auto",
                        "& table": {
                          width: "100%",
                          minWidth: 980,
                          borderCollapse: "collapse",
                          tableLayout: "fixed",
                        },
                        "& th, & td": {
                          border: "1px solid #4b4b4b",
                          textAlign: "center",
                          verticalAlign: "middle",
                        },
                        "& th": {
                          bgcolor: "#f6e1a7",
                          fontSize: 12,
                          fontWeight: 900,
                          height: 38,
                        },
                        "& td:first-of-type": {
                          bgcolor: "#f8f0d8",
                          fontWeight: 900,
                          width: 76,
                        },
                        "& textarea": {
                          width: "100%",
                          minHeight: 62,
                          border: "none",
                          resize: "vertical",
                          outline: "none",
                          padding: "7px 8px",
                          fontFamily: "inherit",
                          fontSize: 12,
                          lineHeight: 1.45,
                          textAlign: "center",
                          boxSizing: "border-box",
                          background: "transparent",
                        },
                      }}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>구분</th>
                            {weekDays.map((date) => {
                              const isCurrentMonth = date.month() + 1 === month;
                              const dayColor =
                                date.day() === 0 ? "#d32f2f" : date.day() === 6 ? "#1565c0" : "#222";

                              return (
                                <th
                                  key={makeDateKey(date)}
                                  style={{
                                    color: isCurrentMonth ? dayColor : "#9e9e9e",
                                    background: isCurrentMonth ? "#f6e1a7" : "#f5f5f5",
                                  }}
                                >
                                  {date.format("M/D")} ({WEEKDAY_LABELS[date.day()]})
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {MEAL_ROWS.map((meal) => (
                            <tr key={meal.key}>
                              <td>{meal.label}</td>
                              {weekDays.map((date) => {
                                const dateKey = makeDateKey(date);
                                const isCurrentMonth = date.month() + 1 === month;
                                return (
                                  <td
                                    key={`${dateKey}-${meal.key}`}
                                    style={{ background: isCurrentMonth ? "#fff" : "#fafafa" }}
                                  >
                                    <textarea
                                      value={menus[dateKey]?.[meal.key] || ""}
                                      disabled={!isCurrentMonth}
                                      onChange={(event) =>
                                        handleCellChange(dateKey, meal.key, event.target.value)
                                      }
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </MDBox>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </MDBox>
      )}
    </>
  );
}

MenuManagementTab.propTypes = {
  standalone: PropTypes.bool,
};

export default MenuManagementTab;
