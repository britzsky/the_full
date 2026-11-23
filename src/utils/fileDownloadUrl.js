// 첨부파일 다운로드 URL 생성, 다운로드 응답 조회, 저장 파일명(확장자) 복원을 담당하는 공통 유틸
import { API_BASE_URL } from "config";

// 응답 MIME 형식별로 붙일 파일 확장자 목록 (백엔드 DownloadFileFormat과 같은 기준)
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/apng": "apng",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/jxl": "jxl",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel.sheet.macroenabled.12": "xlsm",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": "xlsb",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.hancom.hancell": "cell",
  "application/vnd.hancom.hwp": "hwp",
  "application/x-hwp": "hwp",
  "application/vnd.hancom.hwpx": "hwpx",
  "text/csv": "csv",
};

// 이전 업로드에서 "파일명..xlsx"의 점이 밑줄로 바뀌어 저장된 "파일명_xlsx" 형태의 끝부분
const LEGACY_SUFFIX = /_(jpe?g|a?png|gif|webp|bmp|tiff?|svg|avif|jxl|heic|heif|ico|pdf|zip|docx?|pptx?|xlsx?|xlsm|xlsb|ods|csv|cell|hwpx?)$/i;
// 저장 경로의 확장자를 그대로 믿어도 되는 확장자 목록
const KNOWN_EXTENSIONS = new Set([...Object.values(MIME_EXTENSIONS), "jpeg", "tif"]);

// 경로를 떼어 낸 마지막 이름만 남기고 윈도우 파일명에 쓸 수 없는 문자를 밑줄로 바꾸는 함수
const cleanFilename = (value) =>
  String(value || "").trim().split(/[\\/]/).pop().replace(/[<>:"|?*\u0000-\u001f]/g, "_");

// 저장 경로 또는 절대 URL에서 실제 저장 파일명을 꺼내는 함수 (blob/data URL은 파일명이 없어 제외)
const pathFilename = (path) => {
  const value = String(path || "").trim();
  if (/^(blob:|data:)/i.test(value)) return "";
  try {
    const isUrl = /^https?:\/\//i.test(value);
    const pathname = isUrl ? new URL(value).pathname : value;
    const segment = pathname.split("/").pop();
    // 절대 URL은 인코딩된 상태라 한 번 풀고, 저장 경로는 원본 그대로 사용한다.
    try {
      return cleanFilename(isUrl ? decodeURIComponent(segment) : segment);
    } catch {
      return cleanFilename(segment);
    }
  } catch {
    return "";
  }
};

// 응답 Content-Disposition 헤더에서 서버가 정한 다운로드 파일명을 읽는 함수
const dispositionFilename = (value) => {
  const header = String(value || "");
  // filename*=UTF-8''... 형식(한글 파일명)을 우선 사용한다.
  const encoded = /(?:^|;)\s*filename\*=UTF-8'[^']*'([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return cleanFilename(decodeURIComponent(encoded.trim()));
    } catch {
      // 인코딩된 파일명을 읽을 수 없으면 일반 파일명 항목을 사용한다.
    }
  }
  // 일반 filename="..." 또는 filename=... 형식
  const plain = /(?:^|;)\s*filename=(?:"([^"]+)"|([^;]+))/i.exec(header);
  return cleanFilename(plain?.[1] || plain?.[2]);
};

// 파일명의 확장자를 반환하는 함수 (.file/.bin 같은 임시 확장자는 확장자가 없는 것으로 본다)
export const getDownloadFileExtension = (name) => {
  const ext = /\.([a-z][a-z0-9]{0,11})$/i.exec(cleanFilename(name))?.[1] || "";
  return /^(file|bin)$/i.test(ext) ? "" : ext;
};

// 화면의 파일명에 다운로드 응답, 저장 경로, MIME 순으로 확인한 확장자를 붙인다.
// - name: 화면에서 정한 파일명, path: 서버 저장 경로, originalName: 업로드 당시 원본 파일명
// - contentType / contentDisposition: 다운로드 응답의 형식과 파일명 헤더
export const resolveDownloadFileName = (name, { path, originalName, contentType, contentDisposition } = {}) => {
  // 후보 파일명: 저장 경로 파일명, 응답 헤더 파일명, 최종 기준 파일명
  const storedName = pathFilename(path);
  const responseName = dispositionFilename(contentDisposition);
  const filename = cleanFilename(name) || responseName || storedName || cleanFilename(originalName) || "download";
  // 출처별 확장자 후보: 현재 이름, 응답 헤더, 저장 경로, MIME, 과거 저장명, 원본 파일명
  const currentExtension = getDownloadFileExtension(filename);
  const responseExtension = getDownloadFileExtension(responseName);
  const pathExtension = getDownloadFileExtension(storedName);
  const storedExtension = KNOWN_EXTENSIONS.has(pathExtension.toLowerCase()) ? pathExtension : "";
  const mimeExtension = MIME_EXTENSIONS[String(contentType || "").split(";")[0].trim().toLowerCase()];
  const legacyExtension = LEGACY_SUFFIX.exec(storedName || filename)?.[1];
  const originalExtension = getDownloadFileExtension(originalName);
  // 파일명 쪽에서 알 수 있는 확장자 (현재 이름 → 과거 저장명 → 원본 파일명 순)
  const namedExtension = currentExtension || legacyExtension || originalExtension;
  const lowerNamed = namedExtension.toLowerCase();
  // 같은 형식으로 열 수 있는 기존 확장자는 유지한다. 예를 들어 한셀은 .cell을 사용한다.
  const compatibleMime = (mimeExtension === "jpg" && lowerNamed === "jpeg") ||
    (mimeExtension === "tiff" && lowerNamed === "tif") ||
    (mimeExtension === "xlsx" && lowerNamed === "cell") ||
    (mimeExtension === "zip" && /^(xlsx|xlsm|xlsb|cell|ods|docx|pptx|hwpx)$/i.test(namedExtension));
  // 최종 확장자 우선순위: 응답 헤더 → 저장 경로 → MIME(호환 확장자면 기존 이름 유지) → 파일명 쪽 확장자
  const extension = responseExtension || storedExtension || (compatibleMime ? namedExtension : mimeExtension) ||
    namedExtension;
  // 붙일 확장자가 없거나 이미 같은 확장자면 파일명을 그대로 사용한다.
  if (!extension || currentExtension.toLowerCase() === extension.toLowerCase()) return filename;

  // 기존 확장자, 임시 확장자(.file/.bin), 끝의 점, 과거 "_xlsx" 꼬리를 떼고 새 확장자를 붙인다.
  const stem = currentExtension
    ? filename.slice(0, -(currentExtension.length + 1))
    : filename.replace(/(?:\.(?:file|bin)|\.+)$/i, "").replace(LEGACY_SUFFIX, "");
  return `${stem || "download"}.${extension}`;
};

// 경로를 "/" 단위로 나눠 각 구간만 URL 인코딩하는 함수 (파일명 속 %, #, 공백 보존)
const encodePath = (path) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

// 저장 경로를 다운로드 API에 연결한다. 절대 URL에 이미 인코딩된 경로는 그대로 사용한다.
export const buildFileDownloadUrl = (path) => {
  if (!path || typeof path !== "string") return "";

  let normalizedPath = path.trim();
  if (!normalizedPath) return "";
  // 절대 URL이면 경로 부분만 쓰고, 이미 인코딩된 상태이므로 다시 인코딩하지 않는다.
  let isEncodedUrl = false;
  try {
    if (/^https?:\/\//i.test(normalizedPath)) {
      normalizedPath = new URL(normalizedPath).pathname;
      isEncodedUrl = true;
    }
  } catch {
    return "";
  }

  // "/api/image/..."처럼 앞에 붙은 경로는 떼고 "/image/..."부터 사용한다.
  const imageIndex = normalizedPath.indexOf("/image/");
  if (imageIndex >= 0) normalizedPath = normalizedPath.slice(imageIndex);
  if (!normalizedPath.startsWith("/")) normalizedPath = `/${normalizedPath}`;

  // 결과 예: {API_BASE_URL}/download/image/폴더/파일명
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  return `${base}/download${isEncodedUrl ? normalizedPath : encodePath(normalizedPath)}`;
};

// 다운로드 응답이 파일이 아니라 오류 화면(HTML/JSON/XML)인지 판별하는 함수
// - 첨부(attachment)로 내려온 XML 파일, 엑셀(…spreadsheetml.sheet), SVG는 정상 파일로 본다.
export const isFileDownloadErrorResponse = (response) => {
  const contentType = String(response?.headers?.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const disposition = response?.headers?.get("content-disposition") || "";
  return (
    !response?.ok ||
    (!/^attachment(?:;|$)/i.test(disposition) &&
      ["application/xml", "text/xml", "text/html", "application/json"].includes(contentType))
  );
};

// 개별 다운로드와 ZIP에 사용할 원본 파일 및 파일명 헤더를 함께 가져온다.
export const fetchDownloadFile = async (url) => {
  if (!url) throw new Error("다운로드 파일 경로가 없습니다.");
  // 로그인 쿠키를 함께 보내 다운로드 API(/download/image/...)를 호출한다.
  const response = await fetch(url, { credentials: "include" });
  if (isFileDownloadErrorResponse(response)) {
    throw new Error(`파일을 불러오지 못했습니다. (${response.status})`);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("다운로드 파일이 비어 있습니다.");
  // blob: 파일 본문, contentDisposition: 서버가 정한 파일명 헤더, contentType: 파일 형식
  return { blob, contentDisposition: response.headers.get("content-disposition"), contentType: blob.type };
};
