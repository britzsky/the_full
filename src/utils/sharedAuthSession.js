// ERP와 공개 웹이 함께 읽는 사용자 식별 쿠키 키 목록
const SHARED_USER_COOKIE_KEYS = ["erp_user_id", "login_user_id", "user_id", "thefull_user_id"];
// 공개 웹 메뉴/권한 표시를 위한 관리자 쿠키 키 목록
const SHARED_ADMIN_COOKIE_KEYS = ["thefull_admin", "promotion_admin"];
// ERP와 공개 웹이 함께 읽는 세션 식별 쿠키 키 목록
const SHARED_SESSION_COOKIE_KEYS = ["login_session_id"];
// ERP와 공개 웹이 함께 읽는 문의관리 권한 코드 쿠키 키 목록
const SHARED_WEB_POSITION_COOKIE_KEYS = ["login_web_position", "web_position", "thefull_web_position"];

// 쿠키/스토리지에 저장할 문자열 값을 공통 규칙으로 정리
const normalizeText = (value) => (value == null ? "" : String(value).trim());
// 문의관리 권한 코드는 대문자로 정규화
const normalizeWebPosition = (value) => normalizeText(value).toUpperCase();

// 쿠키 공통 옵션을 생성하고 HTTPS 환경이면 Secure 속성을 추가
const buildCookieOptions = (maxAgeSeconds) => {
  const options = ["Path=/", "SameSite=Lax"];

  if (typeof maxAgeSeconds === "number" && Number.isFinite(maxAgeSeconds)) {
    options.push(`Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`);
  }

  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    options.push("Secure");
  }

  return options.join("; ");
};

// ERP와 공개 웹이 함께 쓰는 인증 쿠키 값을 저장
const setCookieValue = (key, value, maxAgeSeconds) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${key}=${encodeURIComponent(normalizeText(value))}; ${buildCookieOptions(maxAgeSeconds)}`;
};

// 특정 인증 쿠키를 즉시 만료시켜 삭제
const clearCookieValue = (key) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${key}=; ${buildCookieOptions(0)}`;
};

// ERP 로그인 사용자 중 공개 웹 관리자 권한을 함께 줄 대상을 판별
export const isSharedAdminUser = ({ position, department }) => {
  const normalizedPosition = normalizeText(position);
  const normalizedDepartment = normalizeText(department);

  return normalizedPosition === "0" || normalizedPosition === "1" || normalizedDepartment === "6";
};

// 로컬스토리지 기반 로그인 상태를 공개 웹 공용 쿠키로 동기화
export const writeSharedAuthCookies = ({ userId, sessionId, position, department, webPosition }) => {
  const normalizedUserId = normalizeText(userId);
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedWebPosition = normalizeWebPosition(webPosition);
  const adminEnabled = isSharedAdminUser({ position, department });

  if (!normalizedUserId || !normalizedSessionId) {
    SHARED_USER_COOKIE_KEYS.forEach(clearCookieValue);
    SHARED_SESSION_COOKIE_KEYS.forEach(clearCookieValue);
    SHARED_WEB_POSITION_COOKIE_KEYS.forEach(clearCookieValue);
    SHARED_ADMIN_COOKIE_KEYS.forEach(clearCookieValue);
    return;
  }

  SHARED_USER_COOKIE_KEYS.forEach((cookieKey) => setCookieValue(cookieKey, normalizedUserId));
  SHARED_SESSION_COOKIE_KEYS.forEach((cookieKey) => setCookieValue(cookieKey, normalizedSessionId));
  SHARED_WEB_POSITION_COOKIE_KEYS.forEach((cookieKey) => setCookieValue(cookieKey, normalizedWebPosition || "N"));

  if (adminEnabled) {
    SHARED_ADMIN_COOKIE_KEYS.forEach((cookieKey) => setCookieValue(cookieKey, "1"));
    return;
  }

  SHARED_ADMIN_COOKIE_KEYS.forEach(clearCookieValue);
};

// 로그아웃 또는 세션 만료 시 공용 인증 쿠키를 모두 제거
export const clearSharedAuthCookies = () => {
  [
    ...SHARED_USER_COOKIE_KEYS,
    ...SHARED_SESSION_COOKIE_KEYS,
    ...SHARED_WEB_POSITION_COOKIE_KEYS,
    ...SHARED_ADMIN_COOKIE_KEYS,
  ].forEach(clearCookieValue);
};

// ERP 앱이 유지하는 로컬 로그인 정보를 기준으로 공용 쿠키를 다시 맞춤
export const syncSharedAuthCookiesFromStorage = () => {
  if (typeof window === "undefined") {
    return;
  }

  writeSharedAuthCookies({
    userId: window.localStorage.getItem("user_id"),
    sessionId: window.localStorage.getItem("login_session_id"),
    position: window.localStorage.getItem("position"),
    department: window.localStorage.getItem("department"),
    webPosition: window.localStorage.getItem("web_position"),
  });
};
