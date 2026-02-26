const LOCALE = "ko-KR";

const normalizeText = (value) => String(value ?? "").trim();

const compareText = (a, b) =>
  normalizeText(a).localeCompare(normalizeText(b), LOCALE, {
    numeric: true,
    sensitivity: "base",
  });

const isAllAccountOption = (row) => {
  const accountId = normalizeText(row?.account_id).toUpperCase();
  const accountName = normalizeText(row?.account_name);
  // ✅ "전체" 옵션은 어떤 화면에서도 항상 맨 위로 고정
  return accountId === "ALL" || accountName === "전체";
};

const compareBySortKey = (a, b, sortKey) => {
  const keyA = normalizeText(a?.[sortKey]);
  const keyB = normalizeText(b?.[sortKey]);

  if (keyA && keyB) {
    const keyCompare = compareText(keyA, keyB);
    if (keyCompare !== 0) return keyCompare;
  } else if (keyA && !keyB) {
    return -1;
  } else if (!keyA && keyB) {
    return 1;
  }

  const nameA = normalizeText(a?.account_name);
  const nameB = normalizeText(b?.account_name);
  if (nameA && nameB) {
    const nameCompare = compareText(nameA, nameB);
    if (nameCompare !== 0) return nameCompare;
  } else if (nameA && !nameB) {
    return -1;
  } else if (!nameA && nameB) {
    return 1;
  }

  return compareText(a?.account_id, b?.account_id);
};

export const sortAccountRows = (rows, { sortKey = "account_name", keepAllOnTop = true } = {}) => {
  if (!Array.isArray(rows) || rows.length <= 1) return Array.isArray(rows) ? [...rows] : [];

  const copied = [...rows];
  if (!keepAllOnTop) {
    copied.sort((a, b) => compareBySortKey(a, b, sortKey));
    return copied;
  }

  const allRows = [];
  const normalRows = [];
  copied.forEach((row) => {
    if (isAllAccountOption(row)) allRows.push(row);
    else normalRows.push(row);
  });

  normalRows.sort((a, b) => compareBySortKey(a, b, sortKey));
  return [...allRows, ...normalRows];
};
