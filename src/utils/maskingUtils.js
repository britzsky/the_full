// 마스킹 대상 필드 키
export const SENSITIVE_FIELD_SET = new Set(["rrn", "phone", "account_number", "address"]);
// 마스킹 해제 권한 부서 코드(대표/인사/개발)
const FULL_UNMASK_DEPARTMENT_SET = new Set(["0", "3", "6"]);
// 마스킹 해제 권한 직책 코드(대표/팀장)
const FULL_UNMASK_POSITION_SET = new Set(["0", "1"]);
// 마스킹 해제 권한 사용자 ID
const FULL_UNMASK_USER_ID_SET = new Set(["db1"]);

// 저장소/서버 값의 공백을 제거해 코드 비교용 문자열로 통일
const toCode = (value) => String(value ?? "").trim();

// 브라우저 저장소에서 부서/직책 코드를 읽어 기본 권한 정보를 구성
const getMaskingRoleFromStorage = () => {
  if (typeof window === "undefined" || !window?.localStorage) {
    return { department: "", position: "", user_id: "" };
  }

  return {
    department: toCode(window.localStorage.getItem("department")),
    position: toCode(window.localStorage.getItem("position")),
    user_id: toCode(window.localStorage.getItem("user_id")),
  };
};

// 사용자ID/부서/직책 기준으로 민감정보 전체 노출 권한 여부를 판정
export const canUnmaskAllSensitiveFields = (department, position, userId) => {
  const deptCode = toCode(department);
  const posCode = toCode(position);
  const uidCode = toCode(userId);
  return (
    FULL_UNMASK_USER_ID_SET.has(uidCode) ||
    FULL_UNMASK_DEPARTMENT_SET.has(deptCode) ||
    FULL_UNMASK_POSITION_SET.has(posCode)
  );
};

// 권한 + 필드 기준 최종 마스킹 적용 여부
export const shouldMaskSensitiveField = (colKey, maskingEnabled = true, role = {}) => {
  const key = String(colKey ?? "").trim();
  if (!SENSITIVE_FIELD_SET.has(key)) return false;

  // 기본 상태: 민감정보 전체 마스킹
  if (maskingEnabled) return true;

  const fromStorage = getMaskingRoleFromStorage();
  const department = role?.department ?? fromStorage.department;
  const position = role?.position ?? fromStorage.position;
  // user_id 권한은 화면별 선택 적용을 위해 caller가 넘긴 값만 사용
  const userId = role?.user_id ?? role?.userId ?? "";

  // 마스킹 해제 버튼 클릭 후:
  // user_id/부서/직책 중 하나라도 전체 해제 권한이면 민감정보 전체 노출
  if (canUnmaskAllSensitiveFields(department, position, userId)) return false;

  // 그 외 권한은 연락처만 노출
  if (key === "phone") return false;

  // 그 외(주민번호/계좌번호/주소)는 계속 마스킹
  return true;
};

const hasSensitiveValue = (value) => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== "";
};

const onlyDigits = (value, maxLen = Infinity) => String(value ?? "").replace(/\D/g, "").slice(0, maxLen);

// 민감필드 편집 허용 여부:
// - 마스킹되지 않으면 항상 편집 가능
// - 마스킹 중이어도 새 행이거나 값이 비어있으면 입력 허용
export const canEditSensitiveField = (
  colKey,
  value,
  maskingEnabled = true,
  role = {},
  options = {}
) => {
  const key = String(colKey ?? "").trim();
  if (!SENSITIVE_FIELD_SET.has(key)) return true;
  if (!shouldMaskSensitiveField(key, maskingEnabled, role)) return true;
  if (options?.isNewRow) return true;
  return !hasSensitiveValue(value);
};

const formatRrnInput = (value) => {
  const digits = onlyDigits(value, 13);
  if (!digits) return "";
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6, 13)}`;
};

const formatPhoneInput = (value) => {
  const digits = onlyDigits(value, 11);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

// 민감필드 입력 포맷터(입력 시 자동 하이픈 적용)
export const formatSensitiveFieldInputValue = (colKey, value) => {
  const key = String(colKey ?? "").trim();
  if (key === "rrn") return formatRrnInput(value);
  if (key === "phone") return formatPhoneInput(value);
  return value ?? "";
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

// 연락처: 앞 뒤 + 끝 4자리만 노출
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

// "은행명 + 계좌번호" 형태를 분리
const splitBankAndAccount = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return { bank: "", account: "" };

  const m = raw.match(/^([A-Za-z가-힣()]+)\s+(.+)$/);
  if (!m) return { bank: "", account: raw };
  return { bank: m[1], account: m[2].trim() };
};

// 은행별 대표 포맷(대표 패턴 + fallback)
const BANK_MASKS_BY_NAME = {
  KB국민은행: [
    [3, 2, 6],
    [3, 3, 6],
  ],
  신한은행: [
    [3, 3, 6],
    [3, 2, 6],
  ],
  우리은행: [
    [4, 3, 6],
    [3, 3, 6],
  ],
  하나은행: [
    [3, 6, 5],
    [3, 3, 6],
  ],
  IBK기업은행: [
    [3, 6, 2, 3],
    [3, 3, 6],
  ],
  NH농협은행: [
    [3, 4, 4, 2],
    [3, 3, 6],
  ],
  카카오뱅크: [
    [4, 2, 7],
    [3, 3, 6],
  ],
  토스뱅크: [
    [3, 3, 6],
    [4, 3, 6],
  ],
  케이뱅크: [
    [3, 3, 6],
    [4, 2, 7],
  ],
  우체국: [
    [4, 4, 4],
    [3, 3, 6],
  ],
};

// 자주 쓰는 은행 약칭/표기 변형을 대표 은행명으로 통일
const BANK_NAME_ALIASES = {
  KB국민: "KB국민은행",
  국민: "KB국민은행",
  국민은행: "KB국민은행",
  신한: "신한은행",
  우리: "우리은행",
  하나: "하나은행",
  IBK기업: "IBK기업은행",
  기업은행: "IBK기업은행",
  농협: "NH농협은행",
  NH농협: "NH농협은행",
  농축협: "NH농협은행",
  카카오: "카카오뱅크",
  카뱅: "카카오뱅크",
  토스: "토스뱅크",
  케이: "케이뱅크",
  우체국은행: "우체국",
};

// 은행명 비교 전에 공백/괄호 표기를 제거하고 별칭을 정규화
const normalizeBankName = (bank) => {
  const cleaned = String(bank ?? "")
    .replace(/\s+/g, "")
    .replace(/\(.*?\)/g, "")
    .trim();
  if (!cleaned) return "";
  return BANK_NAME_ALIASES[cleaned] || cleaned;
};

// 패턴 그룹 길이 합계 계산(전체 자릿수 일치 여부 확인용)
const sumPattern = (pattern) => pattern.reduce((acc, len) => acc + (Number(len) || 0), 0);

// 계좌번호 길이/첫 그룹 길이에 가장 잘 맞는 은행 패턴을 선택
const selectBankMaskPattern = (patterns, digitsLen, firstChunkLen) => {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;

  const exact = patterns.filter((p) => sumPattern(p) === digitsLen);
  if (exact.length > 0) {
    const matchedFirst = exact.find((p) => Number.isFinite(firstChunkLen) && p[0] === firstChunkLen);
    return matchedFirst || exact[0];
  }

  if (Number.isFinite(firstChunkLen)) {
    const byFirst = patterns.find((p) => p[0] === firstChunkLen);
    if (byFirst) return byFirst;
  }

  return patterns[0];
};

// 선택된 패턴 기준으로 첫 그룹만 노출하고 나머지 그룹은 마스킹
const maskByPattern = (digits, pattern) => {
  if (!digits || !Array.isArray(pattern) || pattern.length === 0) return "";

  let cursor = 0;
  const groups = pattern.map((len, idx) => {
    const n = Math.max(0, Number(len) || 0);
    const chunk = digits.slice(cursor, cursor + n);
    cursor += n;

    if (idx === 0) {
      if (chunk) return chunk;
      return "*".repeat(Math.max(3, n));
    }
    return "*".repeat(Math.max(chunk.length, n));
  });

  // 패턴보다 긴 계좌번호는 꼬리 그룹으로 추가 마스킹
  if (cursor < digits.length) {
    groups.push("*".repeat(digits.length - cursor));
  }

  return groups.filter(Boolean).join("-");
};

// 하이픈 형태 입력은 원본 그룹 구조를 유지해 단순 마스킹
const maskByHyphenShape = (source) => {
  const groups = String(source ?? "")
    .split("-")
    .map((part) => part.replace(/\D/g, ""))
    .filter(Boolean);

  if (groups.length < 2) return "";
  return groups.map((g, idx) => (idx === 0 ? g : "*".repeat(g.length))).join("-");
};

// 계좌번호: 은행별 대표 포맷 우선 + 3/4자리 시작 구분 fallback
export const maskBankAccountNumber = (value) => {
  const { bank, account } = splitBankAndAccount(value);
  const source = account || String(value ?? "").trim();
  if (!source) return "";

  const allDigits = source.replace(/\D/g, "");
  if (!allDigits) return bank ? `${bank} ****` : "****";

  const firstChunkRaw = source.includes("-") ? source.split("-")[0] : source;
  const firstChunkDigits = firstChunkRaw.replace(/\D/g, "");
  const firstChunkLen = [3, 4].includes(firstChunkDigits.length) ? firstChunkDigits.length : NaN;

  const normalizedBank = normalizeBankName(bank);
  const patterns = BANK_MASKS_BY_NAME[normalizedBank] || null;
  let maskedAccount = "";

  if (patterns) {
    const pattern = selectBankMaskPattern(patterns, allDigits.length, firstChunkLen);
    maskedAccount = maskByPattern(allDigits, pattern);
  }

  if (!maskedAccount) {
    maskedAccount = maskByHyphenShape(source);
  }

  // fallback: 앞 3/4자리 노출 후 나머지 별 처리
  if (!maskedAccount) {
    const visibleLen = Number.isFinite(firstChunkLen) ? firstChunkLen : allDigits.length >= 11 ? 4 : 3;
    const prefix = allDigits.slice(0, visibleLen);
    const restLen = Math.max(4, allDigits.length - visibleLen);
    const midLen = visibleLen === 4 ? 2 : 3;
    const tailLen = Math.max(1, restLen - midLen);
    maskedAccount = `${prefix}-${"*".repeat(midLen)}-${"*".repeat(tailLen)}`;
  }

  return bank ? `${bank} ${maskedAccount}` : maskedAccount;
};

// 주소: 도로명 주소 우선, 없으면 지번 주소 기준으로 상세주소 제거
export const maskKoreanAddress = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw.split(",")[0].split("(")[0].replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  // 값 기준 해시로 4~15개 별표
  const getMaskedTail = (seed) => {
    const s = String(seed ?? "");
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    const starCount = 4 + (hash % 12); // 4~15
    return ` ${"*".repeat(starCount)}`;
  };

  const roadMatch = normalized.match(/^(.+?(?:로|길|대로)\s*\d+(?:-\d+)?)/);
  if (roadMatch?.[1]) return `${roadMatch[1].trim()}${getMaskedTail(raw)}`;

  const jibunMatch = normalized.match(/^(.+?(?:읍|면|동|리)\s*(?:산\s*)?\d+(?:-\d+)?)/);
  if (jibunMatch?.[1]) return `${jibunMatch[1].trim()}${getMaskedTail(raw)}`;

  const base = normalized.replace(/\s+(?:\S*동|\S*층|\S*호).*$/, "").trim();
  if (!base) return "";
  return `${base}${getMaskedTail(raw)}`;
};

// 컬럼 키 기준 통합 마스킹 함수
export const maskSensitiveFieldValue = (colKey, value, maskingEnabled = true, role = {}) => {
  if (!shouldMaskSensitiveField(colKey, maskingEnabled, role)) return value ?? "";

  if (colKey === "rrn") return maskResidentRegNo(value);
  if (colKey === "phone") return maskPhoneNumber(value);
  if (colKey === "account_number") return maskBankAccountNumber(value);
  if (colKey === "address") return maskKoreanAddress(value);
  return value ?? "";
};
