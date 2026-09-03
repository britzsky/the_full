import { API_BASE_URL } from "config";

const encodePath = (path) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const buildFileDownloadUrl = (path) => {
  if (!path || typeof path !== "string") return "";

  let normalizedPath = path;
  try {
    if (/^https?:\/\//i.test(path)) normalizedPath = new URL(path).pathname;
  } catch {
    normalizedPath = path;
  }

  const imageIndex = normalizedPath.indexOf("/image/");
  if (imageIndex >= 0) normalizedPath = normalizedPath.slice(imageIndex);
  if (!normalizedPath.startsWith("/")) normalizedPath = `/${normalizedPath}`;

  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  return `${base}/download${encodePath(normalizedPath)}`;
};
