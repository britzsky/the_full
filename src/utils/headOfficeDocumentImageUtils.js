export const MAX_HEADOFFICE_DOCUMENT_IMAGE_COUNT = 10;
// 문서 공통 첨부파일 허용 확장자
// - 이미지 + PDF + 엑셀(xls, xlsx)
export const HEADOFFICE_DOCUMENT_ALLOWED_EXTENSIONS = Object.freeze([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
  "pdf",
  "xls",
  "xlsx",
]);
// 파일 input accept 문자열(브라우저 파일 선택창 필터)
export const HEADOFFICE_DOCUMENT_FILE_ACCEPT = "image/*,.pdf,.xls,.xlsx";
const HEADOFFICE_DOCUMENT_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
]);
const HEADOFFICE_DOCUMENT_PDF_EXTENSIONS = new Set(["pdf"]);
const HEADOFFICE_DOCUMENT_EXCEL_EXTENSIONS = new Set(["xls", "xlsx"]);
const HEADOFFICE_DOCUMENT_EXTENSION_SET = new Set(HEADOFFICE_DOCUMENT_ALLOWED_EXTENSIONS);
const ABSOLUTE_FILE_URL_REGEX = /^(https?:\/\/|blob:|data:)/i;
const HEADOFFICE_DOCUMENT_ALLOWED_MIME_SET = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const toSafeArray = (value) => (Array.isArray(value) ? value : []);
const toImageOrder = (image) => Number(image?.image_order);
const toText = (value) => String(value ?? "").trim();
const toLowerText = (value) => toText(value).toLowerCase();
const toFileNameFromPath = (pathText) => {
  const normalized = toText(pathText).split("?")[0].split("#")[0];
  if (!normalized) return "";
  const parts = normalized.split("/");
  return toText(parts[parts.length - 1]);
};
const toFileExtension = (nameText) => {
  const fileName = toText(nameText);
  if (!fileName.includes(".")) return "";
  return toLowerText(fileName.split(".").pop());
};
const decodeUriRepeatedly = (value) => {
  let current = toText(value);
  if (!current) return "";

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURI(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }

  return current;
};
const getCandidateFileName = (target) =>
  toText(target?.name || target?.image_name || target?.file_name || toFileNameFromPath(target?.path || target?.image_path || target?.url));
const getCandidateMimeType = (target) =>
  toLowerText(target?.type || target?.mimeType || target?.contentType || target?.file_type);

// DB에 저장된 상대경로(image_path) 또는 절대 URL을 실제 접근 가능한 URL로 정규화한다.
// - 상대경로(`/image/...`)는 API_BASE_URL을 앞에 붙여 절대주소로 변환
// - 이미 절대 URL/Blob/Data URL이면 그대로 반환
export const buildHeadOfficeDocumentFileUrl = (pathOrUrl, apiBaseUrl = "") => {
  const raw = toText(pathOrUrl);
  if (!raw) return "";
  if (ABSOLUTE_FILE_URL_REGEX.test(raw)) return raw;

  const base = toText(apiBaseUrl).replace(/\/+$/, "");
  if (!base) return raw;

  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${normalizedPath}`;
};

// 브라우저 렌더링(이미지/iframe/fetch)에 사용할 URL 인코딩 값을 만든다.
// - 한글/공백 파일명은 인코딩이 필요하다.
// - 이미 %EB... 형태로 저장된 경로를 다시 인코딩하면 %25EB...가 되므로
//   먼저 반복 decode 후 마지막에 한 번만 encode 한다.
// - blob:/data: URL은 인코딩하면 오히려 깨질 수 있어 원문 그대로 사용한다.
export const toHeadOfficeDocumentViewUrl = (pathOrUrl, apiBaseUrl = "") => {
  const absoluteUrl = buildHeadOfficeDocumentFileUrl(pathOrUrl, apiBaseUrl);
  if (!absoluteUrl) return "";
  if (/^(blob:|data:)/i.test(absoluteUrl)) return absoluteUrl;
  return encodeURI(decodeUriRepeatedly(absoluteUrl));
};

// 첨부파일이 이미지인지 판정한다. (미리보기 가능 여부)
export const isHeadOfficeDocumentImageFile = (target) => {
  const mimeType = getCandidateMimeType(target);
  if (mimeType.startsWith("image/")) return true;
  const ext = toFileExtension(getCandidateFileName(target));
  return HEADOFFICE_DOCUMENT_IMAGE_EXTENSIONS.has(ext);
};

// 첨부파일이 PDF인지 판정한다. (미리보기 가능 여부)
export const isHeadOfficeDocumentPdfFile = (target) => {
  const mimeType = getCandidateMimeType(target);
  if (mimeType === "application/pdf") return true;
  const ext = toFileExtension(getCandidateFileName(target));
  return HEADOFFICE_DOCUMENT_PDF_EXTENSIONS.has(ext);
};

// 첨부파일이 엑셀(xls/xlsx)인지 판정한다. (미리보기 가능 여부)
export const isHeadOfficeDocumentExcelFile = (target) => {
  const mimeType = getCandidateMimeType(target);
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  const ext = toFileExtension(getCandidateFileName(target));
  return HEADOFFICE_DOCUMENT_EXCEL_EXTENSIONS.has(ext);
};

// 첨부파일 종류를 화면 표시용으로 분류한다.
// - image: 이미지 태그 미리보기
// - pdf: iframe 미리보기
// - excel: xlsx 라이브러리로 표 미리보기
// - file: 기타 파일
export const getHeadOfficeDocumentPreviewKind = (target) => {
  if (isHeadOfficeDocumentImageFile(target)) return "image";
  if (isHeadOfficeDocumentPdfFile(target)) return "pdf";
  if (isHeadOfficeDocumentExcelFile(target)) return "excel";
  return "file";
};

// 첨부파일 허용 형식인지 판정한다. (업로드 가능 여부)
export const isHeadOfficeDocumentSupportedFile = (file) => {
  if (!file) return false;
  const mimeType = getCandidateMimeType(file);
  if (mimeType.startsWith("image/")) return true;
  if (HEADOFFICE_DOCUMENT_ALLOWED_MIME_SET.has(mimeType)) return true;
  const ext = toFileExtension(getCandidateFileName(file));
  return HEADOFFICE_DOCUMENT_EXTENSION_SET.has(ext);
};

const getDeletedOrderSet = (deletedImages) =>
  new Set(
    toSafeArray(deletedImages)
      .map((img) => toImageOrder(img))
      .filter((order) => Number.isFinite(order))
  );

const countActiveExistingImages = (existingImages, deletedImages) => {
  const deletedOrderSet = getDeletedOrderSet(deletedImages);
  return toSafeArray(existingImages).filter(
    (img) => !deletedOrderSet.has(toImageOrder(img))
  ).length;
};

// 문서 첨부파일 선택 시 현재 상태 기준으로 추가 가능한 파일만 pending으로 변환한다.
// - 허용 확장자: 이미지 + PDF + XLS + XLSX
export const preparePendingDocumentImageFiles = ({
  fileList,
  existingImages,
  deletedImages,
  pendingFiles,
  maxCount = MAX_HEADOFFICE_DOCUMENT_IMAGE_COUNT,
}) => {
  const basePendingFiles = toSafeArray(pendingFiles);
  const activeExistingCount = countActiveExistingImages(existingImages, deletedImages);
  const currentCount = activeExistingCount + basePendingFiles.length;
  if (currentCount >= maxCount) {
    return {
      status: "limit",
      addedCount: 0,
      nextPendingFiles: basePendingFiles,
    };
  }

  const selectedFiles = Array.from(fileList || []);
  if (selectedFiles.length === 0) {
    return {
      status: "empty",
      addedCount: 0,
      nextPendingFiles: basePendingFiles,
      ignoredTypeCount: 0,
      ignoredLimitCount: 0,
    };
  }

  const supportedFiles = selectedFiles.filter((file) => isHeadOfficeDocumentSupportedFile(file));
  const ignoredTypeCount = selectedFiles.length - supportedFiles.length;
  if (supportedFiles.length === 0) {
    return {
      status: "unsupported",
      addedCount: 0,
      nextPendingFiles: basePendingFiles,
      ignoredTypeCount,
      ignoredLimitCount: 0,
    };
  }

  const availableCount = maxCount - currentCount;
  const allowedByCountFiles = supportedFiles.slice(0, availableCount);
  const ignoredLimitCount = Math.max(supportedFiles.length - allowedByCountFiles.length, 0);
  const wrappedFiles = allowedByCountFiles.map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
  }));

  return {
    status: ignoredLimitCount > 0 ? "partial" : "added",
    addedCount: wrappedFiles.length,
    nextPendingFiles: [...basePendingFiles, ...wrappedFiles],
    ignoredTypeCount,
    ignoredLimitCount,
  };
};

export const toggleDeletedDocumentImage = (deletedImages, image) => {
  const baseDeletedImages = toSafeArray(deletedImages);
  const imageOrder = toImageOrder(image);
  if (!Number.isFinite(imageOrder)) return baseDeletedImages;

  const exists = baseDeletedImages.some((item) => toImageOrder(item) === imageOrder);
  if (exists) return baseDeletedImages.filter((item) => toImageOrder(item) !== imageOrder);
  return [...baseDeletedImages, image];
};

export const revokePendingDocumentImageUrls = (pendingFiles) => {
  toSafeArray(pendingFiles).forEach((pending) => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
  });
};

export const removePendingDocumentImageAt = (pendingFiles, pendingIndex) => {
  const basePendingFiles = toSafeArray(pendingFiles);
  const target = basePendingFiles[pendingIndex];
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
  return basePendingFiles.filter((_, idx) => idx !== pendingIndex);
};

// 저장 시점에 문서 공통 이미지 삭제/업로드를 반영한다.
export const syncHeadOfficeDocumentImages = async ({ api, paymentId, deletedImages, pendingFiles }) => {
  const paymentIdText = String(paymentId || "").trim();
  if (!paymentIdText) return;

  const deletedTargets = toSafeArray(deletedImages)
    .map((img) => ({
      image_order: Number(img?.image_order),
      image_path: String(img?.image_path || "").trim(),
    }))
    .filter((img) => Number.isFinite(img.image_order) && img.image_path);

  if (deletedTargets.length > 0) {
    await Promise.all(
      deletedTargets.map((img) =>
        api.delete("/HeadOffice/ElectronicPaymentDocumentFileDelete", {
          params: {
            payment_id: paymentIdText,
            image_order: img.image_order,
            image_path: img.image_path,
          },
        })
      )
    );
  }

  const validPendingFiles = toSafeArray(pendingFiles)
    .map((pending) => pending?.file)
    .filter((file) => isHeadOfficeDocumentSupportedFile(file));
  if (validPendingFiles.length === 0) return;

  const formData = new FormData();
  formData.append("payment_id", paymentIdText);
  validPendingFiles.forEach((file) => {
    formData.append("files", file);
  });

  await api.post("/HeadOffice/ElectronicPaymentDocumentFilesUpload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
