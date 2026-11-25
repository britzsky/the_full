import PropTypes from "prop-types";
import { TextField } from "@mui/material";
import "./koreanDateInput.css";

// 날짜 문자열을 시간대 변환 없이 한글 요일과 함께 표시합니다.
export function getKoreanDateLabel(value) {
  const parts = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return undefined;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    year === 0 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${value} (${"일월화수목금토"[date.getUTCDay()]})`;
}

export function KoreanDateInput({ value, ...props }) {
  return <input {...props} type="date" value={value} data-date-label={getKoreanDateLabel(value)} />;
}

KoreanDateInput.propTypes = {
  value: PropTypes.string,
};

export function KoreanDateField({ value, inputProps, ...props }) {
  return (
    <TextField
      {...props}
      type="date"
      value={value}
      inputProps={{ ...inputProps, "data-date-label": getKoreanDateLabel(value) }}
    />
  );
}

KoreanDateField.propTypes = {
  value: PropTypes.string,
  inputProps: PropTypes.object,
};
