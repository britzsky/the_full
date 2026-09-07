// ✅ 식수(다이너) "계(total)" 계산 로직 - 단일 소스
// dinersnumbersheet(식수관리) 화면과 출근부(RecordSheetTab / recordsheet) 화면의
// "평균식수" 표시가 서로 다른 값을 보여주지 않도록, 계산 로직을 이 파일 하나로 통일해서 공유한다.
// (두 화면이 각자 계산식을 복사해 들고 있으면 한쪽만 수정됐을 때 값이 어긋난다)

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 2026년 8월부터 모든 업장에 직원 조식·중식·석식 컬럼을 적용
const isEmployeeMealColumnPeriod = (year, month) =>
  Number(year) > 2026 || (Number(year) === 2026 && Number(month) >= 8);

// 🔹 학교 / 산업체 판별
const isSchoolAccount = (accountType) =>
  accountType === "학교" || accountType === "5" || accountType === 5;

const isIndustryAccount = (accountType) =>
  accountType === "산업체" || accountType === "4" || accountType === 4;

// ✅ 평균(있는 항목만)
// - "없으면 있는 항목들로 평균" 요구사항 반영 (0은 "없음"으로 취급)
const avgOfExisting = (...vals) => {
  let sum = 0;
  let cnt = 0;

  vals.forEach((v) => {
    const n = parseNumber(v);
    if (!Number.isNaN(n) && n > 0) {
      sum += n;
      cnt += 1;
    }
  });

  return cnt > 0 ? sum / cnt : 0;
};

// ✅ 합계 계산 (account_id 별 분기 포함)
// dinersnumbersheet/index.js 의 calculateTotal 과 완전히 동일한 로직이어야 한다.
const calculateTotal = (row, accountType, extraDietCols, accountId, year, month) => {
  const extras = Array.isArray(extraDietCols) ? extraDietCols : [];
  const useEmployeeMealColumns = isEmployeeMealColumnPeriod(year, month);

  // =========================================================
  // ✅ account_id별 특수 합계 규칙
  // =========================================================

  // 해당 업장의 이용자와 직원 식수를 식사별 평균으로 합산
  if (accountId === "20250819193617") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    if (!useEmployeeMealColumns) return Math.round(avgMeals + parseNumber(row.employ));

    const avgEmployeeMeals = avgOfExisting(
      row.employ_breakfast,
      row.employ_lunch,
      row.employ_dinner
    );
    return Math.round(avgMeals + avgEmployeeMeals);
  }

  // ✅ 20250819193620: 기본 조/중/석 평균(있는 항목만) + 경관식
  // - breakfast/lunch/dinner 값을 계(total) 계산 기준으로 사용
  // - (2026-04-09 데이케어 평균에서 요양원 평균으로 변경)
  if (accountId === "20250819193620") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const ceremony = parseNumber(row.ceremony);
    return Math.round(avgMeals + ceremony);
  }

  // ✅ 20250819193630: 평균값 + 2,3층 경관식 + 7층 경관식 (7층은 2026년 6월까지만)
  if (accountId === "20250819193630") {
    const avg23 = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const ceremony23 = parseNumber(row.ceremony);
    const show7F = !year || !month || year < 2026 || (year === 2026 && month <= 6);
    const ceremony7 = show7F ? parseNumber(row.ceremony2) : 0;
    return Math.round(avg23 + ceremony23 + ceremony7);
  }

  // ✅ 20250919162439: (조/중/석 평균) + 데이케어 중식
  if (accountId === "20250919162439") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const daycareLunch = parseNumber(row.daycare_lunch);
    return Math.round(avgMeals + daycareLunch);
  }

  // =========================================================
  // 🏫 / 🏭 학교 & 산업체 공통
  // =========================================================
  if (isSchoolAccount(accountType) || isIndustryAccount(accountType)) {
    // ✅ 20250819193651 전용:
    // - TH에 "조식/중식*/석식"이 있을 때, (있는 값만) 평균을 계(total)에 사용
    // - "중식", "중식(간편식)"처럼 "중식"으로 시작하면 전부 중식으로 인식
    // - 그 외 extraDiet 컬럼들은 평균값에 더하지 않고 합산(otherSum)으로 더함
    if (accountId === "20250819193651") {
      const breakfastVal = parseNumber(row.breakfast);

      const lunchCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("중식"));
      const dinnerCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("석식"));

      // 중식/석식이 여러 개면(혹시라도) 해당 값들을 합산해서 한 끼 값으로 처리
      const lunchVal = lunchCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);
      const dinnerVal = dinnerCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);

      const avgMeals = avgOfExisting(breakfastVal, lunchVal, dinnerVal);
      return Math.round(avgMeals);
    }

    // - ✅ special_yn 노출은 테이블에서만 제어, 합계 로직은 기존 유지
    // - ✅ 20250819193651: 기본 칼럼을 중식(lunch) -> 조식(breakfast)로 사용(표시용)
    const mainKey = accountId === "20250819193651" ? "breakfast" : "lunch";
    const mainMeal = parseNumber(row[mainKey]);

    // ✅ 20260609110526: 중식(mainMeal) + 석식(dinner) 단순 합산 + 특식합
    if (accountId === "20260609110526") {
      const dinnerMeal = parseNumber(row.dinner);
      const extraSum = extras.reduce((sum, col) => sum + parseNumber(row[col.priceKey]), 0);
      return mainMeal + dinnerMeal + extraSum;
    }

    // 🏭 산업체 중, TH에 "간편식"/"석식" 이 있는 특수 케이스
    const hasSimpleMealCols = extras.some((col) =>
      ["간편식", "석식"].includes((col.name || "").trim())
    );

    if (isIndustryAccount(accountType) && hasSimpleMealCols) {
      const baseName = mainKey === "breakfast" ? "조식" : "중식";
      const baseNames = [baseName, "간편식(포케)", "석식"];

      const baseValues = [mainMeal];
      let otherSum = 0;

      extras.forEach((col) => {
        const name = (col.name || "").trim();
        const value = parseNumber(row[col.priceKey]);

        if (baseNames.includes(name)) baseValues.push(value);
        else otherSum += value;
      });

      const avgBase =
        baseValues.length > 0 ? baseValues.reduce((sum, v) => sum + v, 0) / baseValues.length : 0;

      return Math.round(avgBase + otherSum);
    }

    // 🏫 학교 + 일반 산업체 → "기본 + extraDiet 합"
    const extraSum = extras.reduce((sum, col) => sum + parseNumber(row[col.priceKey]), 0);
    return mainMeal + extraSum;
  }

  // =========================================================
  // 🧓 그 외(요양원 등) 기본 로직 유지
  // =========================================================
  const breakfast = parseNumber(row.breakfast);
  const lunch = parseNumber(row.lunch);
  const dinner = parseNumber(row.dinner);
  const ceremony = parseNumber(row.ceremony);

  const baseAvgMeals = (breakfast + lunch + dinner) / 3;
  const baseTotal = Math.round(baseAvgMeals + ceremony);

  let total = baseTotal;

  if (
    (accountType === "4" || accountType === "5" || accountType === 4 || accountType === 5) &&
    extras.length > 0
  ) {
    const extraSum = extras.reduce((sum, col) => sum + parseNumber(row[col.priceKey]), 0);
    total += extraSum;
  }

  return total;
};

// =========================================================
// ✅ "평균식수"는 그날 실제로 밥을 먹은 사람 수(헤드카운트)를 날짜별로 구해서 평균낸 것이다.
//    calculateTotal이 만드는 "계"와는 다르다 — "계"는 정산 금액과 맞물려서 extraDietCols
//    (라면/포케처럼 별도 가격이 매겨진 추가 메뉴) 수량까지 더하지만, "식수"는 그 추가 메뉴
//    수량을 포함하지 않는다.
//    실제 DB 데이터로 검증(55보병사단 간부식당 / 2026-07, tb_account_diners_number 31일치
//    직접 조회): 중식(lunch) 컬럼만 평균 내면 78, 라면/포케 등 extra_diet 컬럼까지 더하면
//    81, 저장된 total 컬럼을 평균 내면 75 — 식수현황 화면에서 실제로 보이던 값은 78이었다.
//    그래서 calculateTotal을 그대로 베끼되, "추가 메뉴 수량 합산(extraSum/otherSum)"만
//    빼고 나머지 분기(각 업장별 특수 규칙)는 전부 동일하게 유지한다.
// =========================================================

// ① dinersNumbersheetData.js(식수현황 데이터 훅)의 fetchAllData가 API 원본 행을
//    화면용 행으로 바꾸는 매핑을 그대로 옮김 (필드별 parseNumber + diner_date를
//    "YYYY-MM-DD" 문자열로 조립)
const buildDinerActiveRows = (rawRows) => {
  const list = Array.isArray(rawRows) ? rawRows : [];

  return list.map((item) => {
    const { diner_year, diner_month, diner_date } = item || {};
    const formattedDate = `${diner_year}-${String(diner_month).padStart(2, "0")}-${String(
      diner_date
    ).padStart(2, "0")}`;

    return {
      diner_date: formattedDate,
      breakfast: parseNumber(item?.breakfast),
      lunch: parseNumber(item?.lunch),
      dinner: parseNumber(item?.dinner),
      ceremony: parseNumber(item?.ceremony),
      ceremony2: parseNumber(item?.ceremony2),
      daycare_lunch: parseNumber(item?.daycare_lunch),
      daycare_diner: parseNumber(item?.daycare_diner),
      employ: parseNumber(item?.employ),
      total: parseNumber(item?.total),
      note: item?.note,
      breakcancel: item?.breakcancel,
      lunchcancel: item?.lunchcancel,
      dinnercancel: item?.dinnercancel,
      extra_diet1_price: parseNumber(item?.extra_diet1_price),
      extra_diet2_price: parseNumber(item?.extra_diet2_price),
      extra_diet3_price: parseNumber(item?.extra_diet3_price),
      extra_diet4_price: parseNumber(item?.extra_diet4_price),
      extra_diet5_price: parseNumber(item?.extra_diet5_price),
      special_yn: item?.special_yn || "N",
      daycare_breakfast: parseNumber(item?.daycare_breakfast),
      employ_breakfast: parseNumber(item?.employ_breakfast),
      employ_lunch: parseNumber(item?.employ_lunch),
      employ_dinner: parseNumber(item?.employ_dinner),
      breakfast2: parseNumber(item?.breakfast2),
      lunch2: parseNumber(item?.lunch2),
      dinner2: parseNumber(item?.dinner2),
      daycare_elderly_lunch: parseNumber(item?.daycare_elderly_lunch),
      daycare_elderly_dinner: parseNumber(item?.daycare_elderly_dinner),
      daycare_employ_breakfast: parseNumber(item?.daycare_employ_breakfast),
      daycare_employ_lunch: parseNumber(item?.daycare_employ_lunch),
      daycare_employ_dinner: parseNumber(item?.daycare_employ_dinner),
      working_day: parseNumber(item?.working_day),
    };
  });
};

// ② calculateTotal과 완전히 같은 분기 구조지만, "추가 메뉴 수량(extraSum/otherSum)"만
//    더하지 않는다 — 그 부분이 정산용 "계"에는 들어가지만 실제 "식수"(밥 먹은 사람 수)는
//    아니기 때문. (20250819193651처럼 extras를 애초에 조/중/석 값 자체로 쓰는 분기는
//    "추가 메뉴"가 아니라 그대로 유지)
const calculateDinerHeadcount = (row, accountType, extraDietCols, accountId, year, month) => {
  const extras = Array.isArray(extraDietCols) ? extraDietCols : [];
  const useEmployeeMealColumns = isEmployeeMealColumnPeriod(year, month);

  if (accountId === "20250819193617") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    if (!useEmployeeMealColumns) return Math.round(avgMeals + parseNumber(row.employ));
    const avgEmployeeMeals = avgOfExisting(row.employ_breakfast, row.employ_lunch, row.employ_dinner);
    return Math.round(avgMeals + avgEmployeeMeals);
  }

  if (accountId === "20250819193620") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    return Math.round(avgMeals + parseNumber(row.ceremony));
  }

  if (accountId === "20250819193630") {
    const avg23 = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    const ceremony23 = parseNumber(row.ceremony);
    const show7F = !year || !month || year < 2026 || (year === 2026 && month <= 6);
    const ceremony7 = show7F ? parseNumber(row.ceremony2) : 0;
    return Math.round(avg23 + ceremony23 + ceremony7);
  }

  if (accountId === "20250919162439") {
    const avgMeals = avgOfExisting(row.breakfast, row.lunch, row.dinner);
    return Math.round(avgMeals + parseNumber(row.daycare_lunch));
  }

  if (isSchoolAccount(accountType) || isIndustryAccount(accountType)) {
    if (accountId === "20250819193651") {
      const breakfastVal = parseNumber(row.breakfast);
      const lunchCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("중식"));
      const dinnerCols = extras.filter((c) => ((c.name || "").trim() || "").startsWith("석식"));
      const lunchVal = lunchCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);
      const dinnerVal = dinnerCols.reduce((sum, c) => sum + parseNumber(row[c.priceKey]), 0);
      return Math.round(avgOfExisting(breakfastVal, lunchVal, dinnerVal));
    }

    const mainKey = accountId === "20250819193651" ? "breakfast" : "lunch";
    const mainMeal = parseNumber(row[mainKey]);

    // ✅ 20260609110526: 중식 + 석식 (extraDiet 추가메뉴 수량은 식수에서 제외)
    if (accountId === "20260609110526") {
      return mainMeal + parseNumber(row.dinner);
    }

    // 🏭 산업체 중 "간편식"/"석식" 대체메뉴가 있는 경우: 대체메뉴는 인원수로 평균에 포함,
    //    그 외 추가메뉴(otherSum)는 식수에서 제외
    const hasSimpleMealCols = extras.some((col) => ["간편식", "석식"].includes((col.name || "").trim()));
    if (isIndustryAccount(accountType) && hasSimpleMealCols) {
      const baseName = mainKey === "breakfast" ? "조식" : "중식";
      const baseNames = [baseName, "간편식(포케)", "석식"];
      const baseValues = [mainMeal];
      extras.forEach((col) => {
        const name = (col.name || "").trim();
        if (baseNames.includes(name)) baseValues.push(parseNumber(row[col.priceKey]));
      });
      const avgBase = baseValues.reduce((sum, v) => sum + v, 0) / baseValues.length;
      return Math.round(avgBase);
    }

    // 🏫 학교 + 일반 산업체 → 메인 식수 컬럼만(extraDiet 추가메뉴 수량은 식수에서 제외)
    return mainMeal;
  }

  // 🧓 그 외(요양원 등) 기본 로직 — calculateTotal과 동일(extraSum 분기는 애초에 학교/산업체가
  // 위에서 먼저 처리되므로 여기선 도달하지 않는 죽은 코드였음)
  const breakfast = parseNumber(row.breakfast);
  const lunch = parseNumber(row.lunch);
  const dinner = parseNumber(row.dinner);
  const ceremony = parseNumber(row.ceremony);
  const baseAvgMeals = (breakfast + lunch + dinner) / 3;
  return Math.round(baseAvgMeals + ceremony);
};

// ③ 위 헤드카운트를 날짜별로 구해서, 값이 있는(> 0) 날짜만 평균 낸다.
const calculateDinerAverageMealCount = (rawRows, accountType, extraDietCols, accountId, year, month) => {
  const activeRows = buildDinerActiveRows(rawRows);

  let sum = 0;
  let count = 0;

  activeRows.forEach((row) => {
    const headcount = calculateDinerHeadcount(row, accountType, extraDietCols, accountId, year, month);
    if (headcount > 0) {
      sum += headcount;
      count += 1;
    }
  });

  return count > 0 ? Math.round(sum / count) : 0;
};

// =========================================================
// ✅ "업장마다 조식 평균 몇, 중식 평균 몇..." 표 — 하나로 합친 숫자 대신, 식수현황
//    (layouts/dinersnumbersheet/index.js) 표 맨 아래 "평균" 행에 실제로 찍히는 값을
//    컬럼별로 그대로 보여준다. getTableStructure()가 업장별로 만드는 컬럼 key 목록을
//    그대로 옮겼고(헤더 라벨만 뺌), 평균 계산도 summaryRows(avgs)와 1:1 동일하다
//    (컬럼마다 값 있는 날짜만 평균 → 반올림). 식수현황 쪽 컬럼 구성이 바뀌면 여기도
//    같이 고쳐야 한다.
// =========================================================

const employeeMealColumns = ["employ_breakfast", "employ_lunch", "employ_dinner"];

const DAYCARE_ACCOUNT_IDS = [
  "20250919162439",
  "20250819193615",
  "20250819193504",
  "20250819193455",
];

const SPECIAL_LAYOUT_IDS = [
  "20250819193620",
  "20250819193603",
  "20250819193502",
  "20250819193632",
  "20250819193523",
  "20250819193544",
  "20250819193634",
  "20250819193630",
  "20250819193610",
  "20260415190758",
];

// 식수현황 화면의 numericCols와 동일
const dinerNumericCols = [
  "breakfast",
  "lunch",
  "dinner",
  "ceremony",
  "ceremony2",
  "breakfast2",
  "lunch2",
  "dinner2",
  "daycare_breakfast",
  "daycare_lunch",
  "daycare_diner",
  "daycare_employ_breakfast",
  "daycare_employ_lunch",
  "daycare_employ_dinner",
  "daycare_elderly_lunch",
  "daycare_elderly_dinner",
  "employ",
  "employ_breakfast",
  "employ_lunch",
  "employ_dinner",
  "total",
  "extra_diet1_price",
  "extra_diet2_price",
  "extra_diet3_price",
  "extra_diet4_price",
  "extra_diet5_price",
];

// 식수현황 화면(DinersNumberSheetTab.js)의 defaultColumnLabels와 동일
const defaultDinerColumnLabels = {
  breakfast: "조식",
  lunch: "중식",
  dinner: "석식",
  ceremony: "경관식",
  ceremony2: "경관식",
  breakfast2: "조식",
  lunch2: "중식",
  dinner2: "석식",
  daycare_breakfast: "주간보호 조식",
  daycare_lunch: "주간보호 중식",
  daycare_diner: "주간보호 석식",
  daycare_employ_breakfast: "주간보호 직원 조식",
  daycare_employ_lunch: "주간보호 직원 중식",
  daycare_employ_dinner: "주간보호 직원 석식",
  daycare_elderly_lunch: "주간보호 어르신 중식",
  daycare_elderly_dinner: "주간보호 어르신 석식",
  employ: "직원",
  employ_breakfast: "직원 조식",
  employ_lunch: "직원 중식",
  employ_dinner: "직원 석식",
};

// 식수현황의 getTableStructure()가 만드는 visibleColumns(헤더 라벨은 빼고 컬럼 key만)
const getDinerVisibleColumns = (accountId, isDaycareVisible, extraDietCols, accountType, year, month) => {
  const extras = Array.isArray(extraDietCols) ? extraDietCols : [];
  const useEmployeeMealColumns = isEmployeeMealColumnPeriod(year, month);

  if (isSchoolAccount(accountType) || isIndustryAccount(accountType)) {
    const mainKey = accountId === "20250819193651" ? "breakfast" : "lunch";
    const showDinnerColumn = accountId === "20260609110526";

    if (!useEmployeeMealColumns) {
      return [
        mainKey,
        ...(showDinnerColumn ? ["dinner"] : []),
        "special_yn",
        ...extras.map((col) => col.priceKey),
        "total",
        "note",
      ];
    }
    return [
      mainKey,
      ...(showDinnerColumn ? ["dinner"] : []),
      "special_yn",
      ...extras.map((col) => col.priceKey),
      ...employeeMealColumns,
      "total",
      "note",
    ];
  }

  if (accountId === "20250819193610") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      "employ_breakfast", "employ_lunch", "employ_dinner",
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193620") {
    return [
      "daycare_breakfast", "daycare_lunch", "daycare_diner",
      "breakfast", "lunch", "dinner", "ceremony",
      "daycare_employ_breakfast",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_breakfast", "employ_lunch"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193603") {
    return [
      "breakfast", "lunch", "dinner", "daycare_lunch", "daycare_diner",
      ...(useEmployeeMealColumns
        ? ["daycare_employ_lunch", "daycare_employ_dinner", ...employeeMealColumns]
        : ["employ_breakfast", "employ_lunch", "daycare_employ_lunch", "daycare_employ_dinner"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193502") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_lunch", "employ_dinner"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193632") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      "daycare_lunch", "daycare_diner",
      "daycare_employ_lunch", "daycare_employ_dinner",
      "employ_breakfast", "employ_lunch", "employ_dinner",
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193523") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_breakfast", "employ_lunch"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193544") {
    return [
      "breakfast", "lunch", "dinner", "ceremony", "daycare_lunch",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193634") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      "employ_breakfast", "employ_lunch", "employ_dinner",
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20250819193630") {
    const show7F = !year || !month || year < 2026 || (year === 2026 && month <= 6);
    if (show7F) {
      return [
        "breakfast", "lunch", "dinner", "breakfast2", "lunch2", "dinner2",
        "ceremony", "ceremony2",
        ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_breakfast", "employ_lunch"]),
        "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
      ];
    }
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_breakfast", "employ_lunch"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20260415190758") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ_breakfast", "employ_lunch"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  if (accountId === "20260210044430") {
    return [
      "breakfast", "lunch", "dinner", "ceremony",
      ...(useEmployeeMealColumns ? employeeMealColumns : ["employ"]),
      "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
    ];
  }

  // 기본 레이아웃(학교/산업체, 특수 업장 제외)
  return [
    "breakfast", "lunch", "dinner", "ceremony",
    ...extras.map((col) => col.priceKey),
    ...(isDaycareVisible ? ["daycare_lunch"] : []),
    ...(isDaycareVisible ? ["daycare_diner"] : []),
    ...(useEmployeeMealColumns ? employeeMealColumns : ["employ"]),
    "total", "note", "breakcancel", "lunchcancel", "dinnercancel",
  ];
};

// ✅ 업장의 노출 컬럼별(조식/중식/석식/경관식/직원/추가메뉴 등) 평균값 목록.
//    식수현황 표 맨 아래 "평균" 행과 완전히 같은 계산(값 있는 날짜만 평균 → 반올림).
const getDinerColumnAverages = (rawRows, accountType, extraDietCols, accountId, year, month) => {
  const activeRows = buildDinerActiveRows(rawRows);
  const extras = Array.isArray(extraDietCols) ? extraDietCols : [];

  const isDaycareVisible =
    !!accountId && DAYCARE_ACCOUNT_IDS.includes(accountId) && !SPECIAL_LAYOUT_IDS.includes(accountId);

  const visibleColumns = getDinerVisibleColumns(
    accountId,
    isDaycareVisible,
    extras,
    accountType,
    year,
    month
  );

  const extraLabelMap = extras.reduce((acc, col) => {
    if (col?.priceKey) acc[col.priceKey] = col.name;
    return acc;
  }, {});

  // ✅ 직원식(직원/직원 조식·중식·석식)은 이 표에서 뺀다 — 이용자 식수가 아니라 직원 식수라서
  const employMealKeys = ["employ", "employ_breakfast", "employ_lunch", "employ_dinner"];

  const targetKeys = visibleColumns.filter(
    (key) => dinerNumericCols.includes(key) && key !== "total" && !employMealKeys.includes(key)
  );

  return targetKeys.map((key) => {
    let sum = 0;
    let count = 0;

    activeRows.forEach((row) => {
      const value = parseNumber(row?.[key]);
      if (value > 0) {
        sum += value;
        count += 1;
      }
    });

    return {
      key,
      label: extraLabelMap[key] || defaultDinerColumnLabels[key] || key,
      average: count > 0 ? Math.round(sum / count) : 0,
    };
  });
};

export {
  parseNumber,
  isEmployeeMealColumnPeriod,
  isSchoolAccount,
  isIndustryAccount,
  avgOfExisting,
  calculateTotal,
  calculateDinerAverageMealCount,
  getDinerColumnAverages,
};
