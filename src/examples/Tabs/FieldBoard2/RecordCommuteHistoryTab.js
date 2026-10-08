/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
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

// 출근부 근무타입 코드 -> 화면 표시명 (recordsheet의 TYPE_LABEL과 동일)
const TYPE_LABEL = {
  1: "영양사",
  2: "상용",
  3: "초과",
  4: "결근",
  5: "파출",
  6: "직원파출",
  7: "유틸",
  8: "대체근무",
  9: "연차",
  10: "반차",
  11: "대체휴무",
  12: "병가",
  13: "출산휴가",
  14: "육아휴직",
  15: "하계휴가",
  16: "업장휴무",
  17: "조기퇴근",
  18: "경조사",
  19: "통합",
  20: "재택근무",
  21: "공휴일",
};

// 위·아래 달력 표 공통 칸 너비 (px)
const NAME_COL_WIDTH = 90;
const DAY_COL_WIDTH = 76;

// 출근부 근무타입별 셀 배경색 (recordsheet의 typeColors와 동일)
const TYPE_COLORS = {
  1: "#d9f2d9",
  2: "#fff7cc",
  3: "#e6d9f2",
  4: "#f9d9d9",
  5: "#ffe6cc",
  6: "#cce6ff",
  19: "#d9f2e6",
  16: "#DDAED3",
  17: "#9F8383",
  21: "#dd7b93",
};

// 근무타입이 없는 빈 칸 배경색 (recordsheet 기본색과 동일)
const DEFAULT_CELL_BG = "#ffefd5";

// 위·아래 표가 함께 쓰는 일자 셀 박스 스타일
const cellBoxStyle = (bg) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  backgroundColor: bg,
  padding: "2px",
  borderRadius: "4px",
  fontSize: "0.75rem",
});

// 배경색(#rrggbb)을 같은 계열의 진한 글자색으로 바꾸는 함수
const darkenHex = (hex, ratio = 0.45) => {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * ratio);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

// 실제로 업장에 출근해야 하는 근무타입 (이 타입이면 출퇴근 기록이 있어야 정상)
const WORK_TYPES = new Set(["1", "2", "3", "5", "6", "7", "8", "10", "17", "19"]);

// 출근부 시작시간보다 몇 분까지 늦어도 지각으로 보지 않을지 (허용 오차)
const LATE_GRACE_MIN = 0;

// "H:mm" / "HH:mm:ss" -> 0시 기준 분
const toMinutes = (timeStr) => {
  const m = String(timeStr || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// 비교 결과별 셀 배경색과 표시 문구
const STATUS_STYLE = {
  late: { bg: "#ffd6d6", color: "#c62828", label: "지각" },
  early: { bg: "#ffe9cc", color: "#e65100", label: "일찍 퇴근" },
  missing: { bg: "#fff6c2", color: "#8d6e00", label: "미기록" },
  mismatch: { bg: "#ead9ff", color: "#6a1b9a", label: "이력없음" },
};

// 출근부 셀(sheet)과 출퇴근 기록(commute)을 비교해 문제 목록을 반환하는 함수
//    - 출근부 근무타입인데 기록 없음 -> 미기록 (오늘 이후 날짜는 제외)
//    - 출근부가 비었거나 휴무/결근 타입인데 기록 있음 -> 이력없음
//    - 기록 출근시간 > 출근부 시작시간 -> 지각 / 기록 퇴근시간 < 출근부 종료시간 -> 일찍 퇴근
//    - 정시이거나 일찍 출근·늦게 퇴근한 경우는 정상
const compareDay = (sheet, commute, isFuture) => {
  const type = String(sheet?.type ?? "");
  const isWork = WORK_TYPES.has(type);
  const issues = [];

  if (!commute) {
    if (isWork && !isFuture) issues.push({ key: "missing" });
    return issues;
  }
  if (!isWork) {
    issues.push({ key: "mismatch" });
    return issues;
  }

  const planStart = toMinutes(sheet.start_time);
  const realStart = toMinutes(commute.start_time);
  if (planStart != null && realStart != null && realStart - planStart > LATE_GRACE_MIN) {
    issues.push({ key: "late", diff: realStart - planStart });
  }

  const planEnd = toMinutes(sheet.end_time);
  const realEnd = toMinutes(commute.end_time);
  if (planEnd != null && realEnd != null && planEnd - realEnd > 0) {
    issues.push({ key: "early", diff: planEnd - realEnd });
  }
  return issues;
};

// 출근부 인원의 휴대폰 뒷자리 조회 키 (직원은 member_id, 파출인원은 업장+member_id)
const phoneKeyOf = (gubun, accountId, memberId) =>
  gubun === "dis" ? `dis|${accountId}|${memberId}` : `nor|${memberId}`;

// 한 업장·한 달의 출퇴근 기록과 출근부를 이름 + 휴대폰 뒷자리 + 업장 기준으로 짝지어 비교하는 함수
//    - commuteRows: CommuteRecordList 결과 (같은 업장으로 조회된 행)
//    - sheetRows: AccountRecordSheetList 결과 (같은 업장)
//    - phoneMap: phoneKeyOf -> 휴대폰 뒷자리
//    반환값
//    - commutePersons: 위쪽 표 행 (출퇴근 기록 인원, 짝지어진 출근부 셀 sheet 포함)
//    - sheetPersons: 아래쪽 표 행 (출근부 인원, 짝지어진 출퇴근 기록 commuteDays 포함)
//    - personSummary: 사람별 지각/일찍 퇴근/미기록/이력없음 건수
const buildCommuteComparison = ({ commuteRows, sheetRows, phoneMap, year, month, todayKey }) => {
  const viewMonthStart = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const daysInMonth = viewMonthStart.daysInMonth();
  const isFuture = (d) => viewMonthStart.date(d).format("YYYY-MM-DD") > todayKey;

  // 출퇴근 기록을 이름 + 휴대폰 뒷자리 단위로 묶음
  const commuteMap = new Map();
  (commuteRows || []).forEach((row) => {
    const name = String(row.user_name || "").trim();
    if (!name) return;
    const phone = String(row.phone_last4 || "").trim();
    const key = `${name}|${phone}`;
    if (!commuteMap.has(key)) {
      commuteMap.set(key, { key, name, phone_last4: phone, days: {}, sheet: {}, paired: false });
    }
    const day = dayjs(row.t_date).date();
    if (Number.isFinite(day)) commuteMap.get(key).days[day] = row;
  });

  // 출근부 인원을 member_id 기준 1행으로 묶음 (API 순서 유지, 퇴사자는 퇴사월까지만)
  const sheetMap = new Map();
  (sheetRows || []).forEach((row) => {
    const mid = String(row.member_id ?? "").trim();
    if (!mid) return;
    if (row.del_dt && dayjs(row.del_dt).startOf("month").isBefore(viewMonthStart)) return;
    if (!sheetMap.has(mid)) {
      sheetMap.set(mid, {
        member_id: mid,
        name: String(row.name || "").trim(),
        phone_last4: phoneMap.get(phoneKeyOf(row.gubun, row.account_id, mid)) || "",
        cells: {},
        commuteDays: {},
      });
    }
    const day = Number(row.record_date);
    if (Number.isFinite(day) && day > 0 && !sheetMap.get(mid).cells[day]) {
      sheetMap.get(mid).cells[day] = row;
    }
  });
  const sheetPersons = Array.from(sheetMap.values());

  // 출근부 인원 ↔ 출퇴근 기록 짝짓기
  //    뒷자리가 있으면 이름+뒷자리 일치, 출근부에 번호가 없으면 같은 이름 기록이 1명뿐일 때만 매칭
  const commutePersonsAll = Array.from(commuteMap.values());
  sheetPersons.forEach((p) => {
    let match = null;
    if (p.phone_last4) {
      match = commuteMap.get(`${p.name}|${p.phone_last4}`) || null;
    } else {
      const sameName = commutePersonsAll.filter((c) => c.name === p.name);
      if (sameName.length === 1) [match] = sameName;
    }
    if (!match) return;
    match.paired = true;
    match.sheet = p.cells;
    if (!match.phone_last4) match.phone_last4 = p.phone_last4;
    p.commuteDays = match.days;
  });

  // 사람별 문제 건수 집계 (출근부 인원 + 출근부에 없는 출퇴근 기록 인원)
  const countIssues = (cells, days) => {
    const counts = { late: 0, early: 0, missing: 0, mismatch: 0 };
    for (let d = 1; d <= daysInMonth; d += 1) {
      compareDay(cells[d], days[d], isFuture(d)).forEach((i) => {
        counts[i.key] += 1;
      });
    }
    return counts;
  };
  const personSummary = [
    ...sheetPersons.map((p) => ({
      name: p.name,
      phone_last4: p.phone_last4,
      ...countIssues(p.cells, p.commuteDays),
    })),
    ...commutePersonsAll
      .filter((c) => !c.paired)
      .map((c) => ({ name: c.name, phone_last4: c.phone_last4, ...countIssues({}, c.days) })),
  ];

  const commutePersons = commutePersonsAll
    .filter((c) => Object.keys(c.days).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return { commutePersons, sheetPersons, personSummary, isFuture };
};

// ✅ recordsheet(layouts/recordsheet/index.js)의 출근부 달력(직원명 × 일자) 형태를 그대로 참고해서,
//    업장 하나를 고르면 그 업장 전 직원의 한 달치 출퇴근 기록을 달력 테이블로 한눈에 보여준다.
//    (recordsheet는 근무타입을 "입력"하는 화면이고, 여기는 모바일 GPS 체크인 기록을 "조회"만 하는 화면)
function RecordCommuteHistoryTab() {
  const {
    accountList,
    fetchAccountList,
    fetchRecordList,
    fetchRecordSheetList,
    fetchMemberPhoneList,
    loading,
  } = useRecordCommuteHistoryData();

  const today = dayjs();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const accountInputRef = useRef("");
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [rows, setRows] = useState([]);
  // 같은 업장/월의 출근부(근무타입·예정시간) 원본 행
  const [sheetRows, setSheetRows] = useState([]);
  // 출근부 인원 휴대폰 뒷자리 목록 (조회 월 기준)
  const [phoneRows, setPhoneRows] = useState([]);
  // 엑셀 다운로드 진행 중 여부
  const [excelLoading, setExcelLoading] = useState(false);
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
    const [list, sheet, phones] = await Promise.all([
      fetchRecordList({
        account_id: selectedAccountId,
        start_date: monthStart.startOf("month").format("YYYY-MM-DD"),
        end_date: monthStart.endOf("month").format("YYYY-MM-DD"),
      }),
      fetchRecordSheetList({ account_id: selectedAccountId, year, month }),
      fetchMemberPhoneList({ year, month }),
    ]);
    setRows(list);
    setSheetRows(sheet);
    setPhoneRows(phones);
    setSearched(true);
  }, [selectedAccountId, year, month, fetchRecordList, fetchRecordSheetList, fetchMemberPhoneList]);

  // ✅ 업장/년/월을 고르면 그 업장 기록만 바로 조회한다. 업장 미선택 시에는 조회하지 않는다.
  useEffect(() => {
    if (!selectedAccountId) {
      setRows([]);
      setSheetRows([]);
      setPhoneRows([]);
      setSearched(false);
      return;
    }
    handleSearch();
    // eslint-disable-next-line
  }, [selectedAccountId, year, month]);

  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();
  const todayKey = today.format("YYYY-MM-DD");

  // 휴대폰 뒷자리 조회 맵 (phoneKeyOf -> 뒷자리 4자리)
  const phoneMap = useMemo(
    () =>
      new Map(
        (phoneRows || []).map((r) => [
          phoneKeyOf(r.gubun, r.account_id, r.member_id),
          String(r.phone_last4 || ""),
        ])
      ),
    [phoneRows]
  );

  // 출퇴근 기록 ↔ 출근부를 이름 + 휴대폰 뒷자리 + 업장 기준으로 짝지은 결과
  //    displayRows: 위쪽 출퇴근 기록 표 / attendanceRows: 아래쪽 출근부 표
  const comparison = useMemo(
    () =>
      buildCommuteComparison({
        commuteRows: rows,
        sheetRows,
        phoneMap,
        year,
        month,
        todayKey,
      }),
    [rows, sheetRows, phoneMap, year, month, todayKey]
  );
  const {
    commutePersons: displayRows,
    sheetPersons: attendanceRows,
    isFuture: isFutureDay,
  } = comparison;

  // 화면 전체의 문제 건수 요약 (범례에 표시)
  const issueSummary = useMemo(
    () =>
      comparison.personSummary.reduce(
        (acc, p) => ({
          late: acc.late + p.late,
          early: acc.early + p.early,
          missing: acc.missing + p.missing,
          mismatch: acc.mismatch + p.mismatch,
        }),
        { late: 0, early: 0, missing: 0, mismatch: 0 }
      ),
    [comparison]
  );

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

  const isEmpty = searched && displayRows.length === 0 && attendanceRows.length === 0;

  // 엑셀 다운로드 실행 함수 (scope: "account" 선택 업장 / "all" 업장 전체)
  //    1번 시트: 업장별 출퇴근 기록 + 출근부 달력 (손익표 "거래처 전체"처럼 업장을 위에서 아래로 이어 붙임)
  //    2번 시트: 업장별 사람별 지각/일찍 퇴근/미기록/이력없음 건수
  const handleExcelDownload = async (scope) => {
    if (!selectedAccountId) return;
    setExcelLoading(true);
    try {
      const accountName =
        (accountList || []).find((a) => a.account_id === selectedAccountId)?.account_name || "";

      // 대상 업장별 비교 결과 목록 [{ name, comp }]
      //    선택 업장: 화면에 조회된 결과 그대로 / 업장 전체: 해당 월 출퇴근 기록이 있는 업장 전부
      let targets = [];
      if (scope === "account") {
        targets = [{ name: accountName, comp: comparison }];
      } else {
        const monthStart = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
        const allCommute = await fetchRecordList(
          {
            start_date: monthStart.format("YYYY-MM-DD"),
            end_date: monthStart.endOf("month").format("YYYY-MM-DD"),
          },
          { silent: true }
        );

        // 대상 업장 = 거래처 목록 전체 (손익표 "거래처 전체"와 동일) + 목록에 없지만 출퇴근 기록이 있는 업장
        const byAccount = new Map();
        (accountList || []).forEach((a) => {
          byAccount.set(a.account_id, { name: a.account_name || a.account_id, rows: [] });
        });
        allCommute.forEach((r) => {
          if (!byAccount.has(r.account_id)) {
            byAccount.set(r.account_id, { name: r.account_name || r.account_id, rows: [] });
          }
          byAccount.get(r.account_id).rows.push(r);
        });
        const accounts = Array.from(byAccount.entries()).sort((a, b) =>
          String(a[1].name).localeCompare(String(b[1].name), "ko")
        );

        // 업장별 출근부 조회 (동시에 5곳씩) 후 비교
        for (let i = 0; i < accounts.length; i += 5) {
          const chunk = accounts.slice(i, i + 5);
          const results = await Promise.all(
            chunk.map(([id]) => fetchRecordSheetList({ account_id: id, year, month }))
          );
          chunk.forEach(([, acc], idx) => {
            const comp = buildCommuteComparison({
              commuteRows: acc.rows,
              sheetRows: results[idx],
              phoneMap,
              year,
              month,
              todayKey,
            });
            // 출퇴근 기록도 출근부 인원도 없는 업장은 제외
            if (comp.commutePersons.length === 0 && comp.sheetPersons.length === 0) return;
            targets.push({ name: acc.name, comp });
          });
        }
      }

      if (targets.length === 0) {
        Swal.fire("다운로드할 데이터가 없습니다.", "", "info");
        return;
      }

      const wb = new ExcelJS.Workbook();
      const argb = (hex) => `FF${String(hex).replace("#", "").toUpperCase()}`;
      const fill = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
      const border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      const nameText = (p) => (p.phone_last4 ? `${p.name}\n(${p.phone_last4})` : p.name);

      // ── 1번 시트: 업장별 달력 ──
      const ws1 = wb.addWorksheet("출퇴근 기록");
      ws1.columns = [{ width: 12 }, ...dayHeaders.map(() => ({ width: 11 }))];
      ws1.addRow([`${year}년 ${month}월 출퇴근 기록 / 출근부`]).font = { bold: true, size: 13 };

      // 달력 한 구역(제목 + 헤더 + 사람별 행)을 시트에 쓰는 함수
      const writeSection = (title, persons, cellOf) => {
        ws1.addRow([]);
        ws1.addRow([title]).font = { bold: true };
        const header = ws1.addRow([
          "직원명",
          ...dayHeaders.map((h) => `${h.dayNum}일(${h.weekday})`),
        ]);
        header.eachCell((c, col) => {
          const h = dayHeaders[col - 2];
          c.font = { bold: true };
          c.border = border;
          c.alignment = { horizontal: "center" };
          c.fill = fill(h?.isSun ? "#ffe5e5" : h?.isSat ? "#ddf0ff" : "#f0f0f0");
        });
        persons.forEach((p) => {
          const cells = dayHeaders.map((h) => cellOf(p, h.dayNum));
          const row = ws1.addRow([nameText(p), ...cells.map((c) => c.text)]);
          row.eachCell({ includeEmpty: true }, (c, col) => {
            c.border = border;
            c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            if (col === 1) c.font = { bold: true };
            else c.fill = fill(cells[col - 2].bg);
          });
        });
      };

      targets.forEach(({ name, comp }) => {
        // 업장명 구분 행 - 표 너비(직원명 + 일자 칸)만큼 병합해서 배경색을 채움
        ws1.addRow([]);
        const titleRow = ws1.addRow([name]);
        ws1.mergeCells(titleRow.number, 1, titleRow.number, dayHeaders.length + 1);
        titleRow.font = { bold: true, size: 12 };
        titleRow.getCell(1).fill = fill("#cce6ff");
        titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

        writeSection("출퇴근 기록", comp.commutePersons, (p, d) => {
          const record = p.days[d];
          const issues = compareDay(p.sheet[d], record, comp.isFuture(d));
          const lines = [];
          if (record?.start_time) lines.push(`출 ${formatHM(record.start_time)}`);
          if (record?.end_time) lines.push(`퇴 ${formatHM(record.end_time)}`);
          issues.forEach((i) =>
            lines.push(`${STATUS_STYLE[i.key].label}${i.diff ? ` ${i.diff}분` : ""}`)
          );
          return {
            text: lines.length ? lines.join("\n") : "-",
            bg: (issues[0] && STATUS_STYLE[issues[0].key].bg) || DEFAULT_CELL_BG,
          };
        });

        writeSection("출근 현황 (출근부)", comp.sheetPersons, (p, d) => {
          const cell = p.cells[d];
          const type = String(cell?.type ?? "");
          const lines = [TYPE_LABEL[type] || "-"];
          if (WORK_TYPES.has(type)) {
            lines.push(formatHM(cell?.start_time) || "출근", formatHM(cell?.end_time) || "퇴근");
          }
          // 출퇴근 기록과 비교한 판정 문구 (지각/일찍 퇴근/미기록/이력없음)
          compareDay(cell, p.commuteDays[d], comp.isFuture(d)).forEach((i) => {
            lines.push(STATUS_STYLE[i.key].label);
          });
          return { text: lines.join("\n"), bg: TYPE_COLORS[type] || DEFAULT_CELL_BG };
        });
      });

      // ── 2번 시트: 업장별 · 사람별 문제 건수 ──
      const ws2 = wb.addWorksheet("업장별 집계");
      ws2.columns = [
        { header: "업장명", width: 24 },
        { header: "직원명", width: 12 },
        { header: "휴대폰 뒷자리", width: 14 },
        { header: STATUS_STYLE.late.label, width: 8 },
        { header: STATUS_STYLE.early.label, width: 10 },
        { header: STATUS_STYLE.missing.label, width: 8 },
        { header: STATUS_STYLE.mismatch.label, width: 10 },
      ];
      ws2.getRow(1).eachCell((c) => {
        c.font = { bold: true };
        c.fill = fill("#f0f0f0");
        c.border = border;
        c.alignment = { horizontal: "center" };
      });

      targets.forEach(({ name, comp }) => {
        // 문제가 1건이라도 있는 사람만 표시
        const persons = comp.personSummary
          .filter((p) => p.late + p.early + p.missing + p.mismatch > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "ko"));
        if (persons.length === 0) return;

        const total = { late: 0, early: 0, missing: 0, mismatch: 0 };
        persons.forEach((p) => {
          ["late", "early", "missing", "mismatch"].forEach((k) => {
            total[k] += p[k];
          });
          ws2
            .addRow([name, p.name, p.phone_last4, p.late, p.early, p.missing, p.mismatch])
            .eachCell({ includeEmpty: true }, (c) => {
              c.border = border;
            });
        });
        // 업장 소계 행
        const sub = ws2.addRow([
          `${name} 소계`,
          "",
          "",
          total.late,
          total.early,
          total.missing,
          total.mismatch,
        ]);
        sub.eachCell({ includeEmpty: true }, (c) => {
          c.font = { bold: true };
          c.fill = fill("#fff7cc");
          c.border = border;
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const ym = `${year}${String(month).padStart(2, "0")}`;
      saveAs(
        new Blob([buf]),
        `출퇴근비교_${scope === "all" ? "업장전체" : accountName}_${ym}.xlsx`
      );
    } catch (e) {
      console.error("엑셀 다운로드 실패:", e);
      Swal.fire("엑셀 다운로드", "엑셀 생성 중 오류가 발생했습니다.", "error");
    } finally {
      setExcelLoading(false);
    }
  };

  // 엑셀 다운로드 버튼 클릭 시 다운로드 범위를 라디오로 선택하는 함수 (손익표 전체 다운로드 옵션과 동일 방식)
  const handleExcelButtonClick = async () => {
    const { value: scope } = await Swal.fire({
      title: "전체 다운로드 옵션",
      text: "다운로드 방식을 선택하세요.",
      input: "radio",
      inputOptions: {
        account: "선택 업장",
        all: "업장 전체",
      },
      inputValidator: (v) => (!v ? "옵션을 선택해주세요." : undefined),
      confirmButtonText: "다운로드",
      showCancelButton: true,
      cancelButtonText: "취소",
    });
    if (!scope) return;
    handleExcelDownload(scope);
  };

  // 위(출퇴근 기록)·아래(출근부) 표의 스크롤 영역
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  // 한쪽 표를 좌우로 스크롤하면 다른 표도 같은 일자 위치로 맞추는 함수
  const syncScrollLeft = (e) => {
    const other =
      e.currentTarget === topScrollRef.current ? bottomScrollRef.current : topScrollRef.current;
    if (other && other.scrollLeft !== e.currentTarget.scrollLeft) {
      other.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // 직원명 칸 - 이름 아래에 휴대폰 뒷자리(동명이인 구분용)를 작게 표시
  const renderNameCell = (row) => (
    <>
      {row.name}
      {row.phone_last4 && (
        <span style={{ display: "block", fontSize: "0.64rem", fontWeight: "normal" }}>
          ({row.phone_last4})
        </span>
      )}
    </>
  );

  // 두 달력 표(출퇴근 기록/출근부)가 함께 쓰는 직원명 + 일자(요일) 헤더 행
  const dayHeaderRow = (
    <tr>
      <th>직원명</th>
      {dayHeaders.map(({ dayNum, weekday, isSun, isSat }) => (
        <th
          key={dayNum}
          style={{ backgroundColor: isSun ? "#ffe5e5" : isSat ? "#ddf0ff" : undefined }}
        >
          {dayNum}일({weekday})
        </th>
      ))}
    </tr>
  );

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
      // 위(출퇴근 기록)·아래(출근부) 표의 일자 칸 너비를 출근부 셀 기준으로 동일하게 고정
      width: DAY_COL_WIDTH,
      minWidth: DAY_COL_WIDTH,
      maxWidth: DAY_COL_WIDTH,
      boxSizing: "border-box",
    },
    // 직원명 칸 너비 고정 (긴 이름은 말줄임)
    "& th:first-of-type, & td:first-of-type": {
      width: NAME_COL_WIDTH,
      minWidth: NAME_COL_WIDTH,
      maxWidth: NAME_COL_WIDTH,
      overflow: "hidden",
      textOverflow: "ellipsis",
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

        <MDButton
          variant="gradient"
          color="success"
          onClick={handleExcelButtonClick}
          disabled={excelLoading || !selectedAccountId}
          sx={{
            fontSize: "0.8rem",
            minWidth: "unset !important",
            padding: "6px 20px !important",
            whiteSpace: "nowrap",
          }}
        >
          {excelLoading ? "엑셀 생성 중..." : "엑셀 다운로드"}
        </MDButton>
      </MDBox>

      {/* 비교 결과 범례 및 문제 건수 요약 영역 */}
      <MDBox display="flex" flexWrap="wrap" justifyContent="flex-end" gap={1} mb={1}>
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
          <MDBox
            key={key}
            px={1}
            py={0.25}
            borderRadius="md"
            sx={{ backgroundColor: s.bg, color: s.color, fontSize: "0.75rem", fontWeight: "bold" }}
          >
            {s.label} {issueSummary[key]}건
          </MDBox>
        ))}
      </MDBox>

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

          {/* 위쪽: 모바일 출퇴근 앱 기록 달력 (출근부와 비교한 지각/일찍 퇴근/이력없음 표시) */}
          <MDBox pt={2}>
            {displayRows.length === 0 ? (
              <MDTypography variant="button" color="text">
                조회된 출퇴근 기록이 없습니다.
              </MDTypography>
            ) : (
              <MDBox sx={tableSx} ref={topScrollRef} onScroll={syncScrollLeft}>
                <table>
                  <thead>{dayHeaderRow}</thead>
                  <tbody>
                    {displayRows.map((row) => (
                      <tr key={row.key}>
                        <td style={{ fontWeight: "bold" }}>{renderNameCell(row)}</td>
                        {dayHeaders.map(({ dayNum }) => {
                          const record = row.days[dayNum];
                          const issues = compareDay(row.sheet[dayNum], record, isFutureDay(dayNum));
                          const first = issues[0] && STATUS_STYLE[issues[0].key];
                          return (
                            <td key={dayNum} style={{ padding: "2px" }}>
                              {/* 출근부 표와 같은 모양의 셀 박스 (문제가 있으면 판정 색으로 표시) */}
                              <div style={cellBoxStyle(first?.bg || DEFAULT_CELL_BG)}>
                                {!record && issues.length === 0 && <span>-</span>}
                                {record?.start_time && (
                                  <MDTypography
                                    variant="caption"
                                    display="block"
                                    sx={{ color: "#1FA45C", fontSize: "0.68rem" }}
                                  >
                                    출 {formatHM(record.start_time)}
                                  </MDTypography>
                                )}
                                {record?.end_time && (
                                  <MDTypography
                                    variant="caption"
                                    display="block"
                                    sx={{ color: "#E5566B", fontSize: "0.68rem" }}
                                  >
                                    퇴 {formatHM(record.end_time)}
                                  </MDTypography>
                                )}
                                {/* 출근부와 비교한 문제 표시 (지각/일찍 퇴근은 차이 분 포함) */}
                                {issues.map((i) => (
                                  <MDTypography
                                    key={i.key}
                                    variant="caption"
                                    display="block"
                                    sx={{
                                      color: STATUS_STYLE[i.key].color,
                                      fontSize: "0.64rem",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {STATUS_STYLE[i.key].label}
                                    {i.diff ? ` ${i.diff}분` : ""}
                                  </MDTypography>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MDBox>
            )}
          </MDBox>

          {/* 출근부 영역 제목 */}
          <MDBox
            mt={3}
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
          >
            <MDTypography variant="h6" color="white">
              출근 현황 (출근부)
            </MDTypography>
          </MDBox>

          {/* 아래쪽: recordsheet 출근 현황과 같은 모양의 출근부 달력 (조회 전용) */}
          <MDBox pt={2}>
            {attendanceRows.length === 0 ? (
              <MDTypography variant="button" color="text">
                입력된 출근부가 없습니다.
              </MDTypography>
            ) : (
              <MDBox sx={tableSx} ref={bottomScrollRef} onScroll={syncScrollLeft}>
                <table>
                  <thead>{dayHeaderRow}</thead>
                  <tbody>
                    {attendanceRows.map((row) => (
                      <tr key={row.member_id}>
                        <td style={{ fontWeight: "bold" }}>{renderNameCell(row)}</td>
                        {dayHeaders.map(({ dayNum }) => {
                          const cell = row.cells[dayNum];
                          const type = String(cell?.type ?? "");
                          // 출퇴근 기록과 비교한 판정 목록 (상단 범례 집계와 같은 기준)
                          const issues = compareDay(
                            cell,
                            row.commuteDays[dayNum],
                            isFutureDay(dayNum)
                          );
                          return (
                            <td key={dayNum} style={{ padding: "2px" }}>
                              {/* 근무타입별 배경색 셀 (recordsheet AttendanceCell과 동일 색상) */}
                              <div style={cellBoxStyle(TYPE_COLORS[type] || DEFAULT_CELL_BG)}>
                                {/* 근무타입명 - 배경색과 같은 계열의 진한 톤 글자 */}
                                <span
                                  style={{
                                    color: darkenHex(TYPE_COLORS[type] || DEFAULT_CELL_BG),
                                    fontWeight: "bold",
                                  }}
                                >
                                  {TYPE_LABEL[type] || "-"}
                                </span>
                                {WORK_TYPES.has(type) && (
                                  <>
                                    <span>{formatHM(cell?.start_time) || "출근"}</span>
                                    <span>{formatHM(cell?.end_time) || "퇴근"}</span>
                                  </>
                                )}
                                {/* 판정별 문구 (지각/일찍 퇴근/미기록/이력없음) */}
                                {issues.map((i) => (
                                  <span
                                    key={i.key}
                                    style={{
                                      color: STATUS_STYLE[i.key].color,
                                      fontSize: "0.64rem",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {STATUS_STYLE[i.key].label}
                                  </span>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MDBox>
            )}
          </MDBox>
        </>
      )}
    </MDBox>
  );
}

export default RecordCommuteHistoryTab;
