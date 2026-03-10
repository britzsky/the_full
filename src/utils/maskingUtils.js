// 마스킹 대상 필드 키
export const SENSITIVE_FIELD_SET = new Set(["rrn", "phone", "account_number", "address"]);

// "은행명 + 계좌번호" 형태를 분리
const splitBankAndAccount = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return { bank: "", account: "" };

  const m = raw.match(/^([A-Za-z가-힣()]+)\s+(.+)$/);
  if (!m) return { bank: "", account: raw };
  return { bank: m[1], account: m[2].trim() };
};

// 주민등록번호: 앞 6자리 + 뒤 1자리만 노출 (예: 900101-1******)
export const maskResidentRegNo = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 6) return digits;

  const front = digits.slice(0, 6);
  const backFirst = digits.slice(6, 7);
  return `${front}-${backFirst}${"*".repeat(6)}`;
};

// 연락처: 끝 4자리만 노출
export const maskPhoneNumber = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7, 11)}`;
  if (digits.length === 10) {
    if (digits.startsWith("02")) return `02-***-${digits.slice(6, 10)}`;
    return `${digits.slice(0, 3)}-***-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 4) return digits;

  return `${"*".repeat(Math.max(1, digits.length - 4))}${digits.slice(-4)}`;
};

// 계좌번호: 은행명 + 앞 3~4자리만 노출, 나머지 마스킹
export const maskBankAccountNumber = (value) => {
  const { bank, account } = splitBankAndAccount(value);
  const source = account || String(value ?? "").trim();
  if (!source) return "";

  const allDigits = source.replace(/\D/g, "");
  const firstChunkRaw = source.includes("-") ? source.split("-")[0] : source;
  const firstChunkDigits = firstChunkRaw.replace(/\D/g, "");

  let prefix = firstChunkDigits;
  if (prefix.length > 4) prefix = prefix.slice(0, 4);
  if (prefix.length < 3) prefix = allDigits.slice(0, 4);
  if (!prefix) return bank ? `${bank} ****` : "****";

  const restLen = Math.max(4, allDigits.length - prefix.length);
  const masked = `${prefix}-${"*".repeat(restLen)}`;
  return bank ? `${bank} ${masked}` : masked;
};

// 주소: 도로명 주소 우선, 없으면 지번 주소 기준으로 상세주소 제거
export const maskKoreanAddress = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw.split(",")[0].split("(")[0].replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const roadMatch = normalized.match(/^(.+?(?:로|길|대로)\s*\d+(?:-\d+)?)/);
  if (roadMatch?.[1]) return roadMatch[1].trim();

  const jibunMatch = normalized.match(/^(.+?(?:읍|면|동|리)\s*(?:산\s*)?\d+(?:-\d+)?)/);
  if (jibunMatch?.[1]) return jibunMatch[1].trim();

  return normalized.replace(/\s+(?:\S*동|\S*층|\S*호).*$/, "").trim();
};

// 컬럼 키 기준 통합 마스킹 함수
export const maskSensitiveFieldValue = (colKey, value, maskingEnabled = true) => {
  if (!maskingEnabled) return value ?? "";

  if (colKey === "rrn") return maskResidentRegNo(value);
  if (colKey === "phone") return maskPhoneNumber(value);
  if (colKey === "account_number") return maskBankAccountNumber(value);
  if (colKey === "address") return maskKoreanAddress(value);
  return value ?? "";
};
