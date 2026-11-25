// 다운로드 URL 생성, 파일명 확장자 복원, 오류 응답 판별, ZIP 저장 결과를 확인하는 테스트
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  buildFileDownloadUrl,
  getDownloadFileExtension,
  isFileDownloadErrorResponse,
  resolveDownloadFileName,
} from "./fileDownloadUrl";

test("S3 원본 키의 퍼센트 문자를 보존하고 인코딩된 URL은 다시 인코딩하지 않습니다", () => {
  const absolute = "https://example.test/api/image/photo/%EC%82%AC%EC%A7%84%2520%23.png?download=1";
  const raw = "/image/photo/사진%20#.png";
  const expected = "/download/image/photo/%EC%82%AC%EC%A7%84%2520%23.png";
  expect(buildFileDownloadUrl(raw).endsWith(expected)).toBe(true);
  expect(buildFileDownloadUrl(absolute).endsWith(expected)).toBe(true);
});

test("저장 경로에 확장자가 없어도 서버가 알려준 엑셀 확장자를 붙입니다", () => {
  expect(resolveDownloadFileName("거래처_주간식단표", {
    path: "/image/branch/menu_xlsx",
    contentDisposition: "attachment; filename*=UTF-8''%EC%8B%9D%EB%8B%A8%ED%91%9C.xlsx",
  })).toBe("거래처_주간식단표.xlsx");
  expect(resolveDownloadFileName("거래처_주간식단표", {
    path: "/image/branch/menu",
    originalName: "menu..xlsx",
  })).toBe("거래처_주간식단표.xlsx");
});

test("이미지 변환 후 저장된 확장자를 원본 파일명보다 우선합니다", () => {
  expect(resolveDownloadFileName("식판사진", {
    path: "https://example.test/image/plate.JPG?version=1",
    originalName: "plate.png",
    contentType: "image/jpeg",
  })).toBe("식판사진.JPG");
  expect(resolveDownloadFileName("사진.file", { contentType: "image/png" })).toBe("사진.png");
});

test("미리보기 표시명과 과거 저장명에서 누락된 확장자를 복원합니다", () => {
  expect(resolveDownloadFileName("계약서", { contentType: "application/pdf" })).toBe("계약서.pdf");
  expect(resolveDownloadFileName("증빙_xlsx", { contentType: "application/octet-stream" })).toBe("증빙.xlsx");
  expect(resolveDownloadFileName("한셀", { path: "/image/식단표_cell", contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBe("한셀.cell");
  expect(getDownloadFileExtension("다운로드.file")).toBe("");
});

test("정상 파일 첨부와 오류 응답을 구분합니다", () => {
  const makeResponse = (contentType, disposition, ok = true) => ({
    ok,
    headers: new Map([["content-type", contentType], ["content-disposition", disposition]]),
  });
  expect(isFileDownloadErrorResponse(makeResponse("text/html; charset=UTF-8"))).toBe(true);
  expect(isFileDownloadErrorResponse(makeResponse("application/json", "attachment", false))).toBe(true);
  expect(isFileDownloadErrorResponse(makeResponse("text/xml", "attachment; filename=data.xml"))).toBe(false);
  expect(isFileDownloadErrorResponse(makeResponse("image/svg+xml"))).toBe(false);
});

test("ZIP 안에서 확장자를 복원한 엑셀과 이미지를 원본 그대로 읽을 수 있습니다", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["식단표"]]), "메뉴");
  const excel = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
    "base64"
  );
  const zip = new JSZip();
  zip.file(resolveDownloadFileName("식단표", { path: "/image/weekly_xlsx" }), excel);
  zip.file(resolveDownloadFileName("식판사진", { contentType: "image/png" }), image);

  const archive = await JSZip.loadAsync(await zip.generateAsync({ type: "nodebuffer" }));
  const actual = XLSX.read(await archive.file("식단표.xlsx").async("nodebuffer"), { type: "buffer" });
  expect(actual.Sheets["메뉴"].A1.v).toBe("식단표");
  expect(await archive.file("식판사진.png").async("nodebuffer")).toEqual(image);
});
