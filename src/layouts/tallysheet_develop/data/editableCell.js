/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export const EditableCell = ({ value, rowIndex, columnId, dataRows, setDataRows }) => {
  const [val, setVal] = useState(formatNumber(value ?? ""));

  const onChange = (e) => setVal(e.target.value);
  const onBlur = () => {
    const numericVal = parseNumber(val);
    const newRows = [...dataRows];
    newRows[rowIndex][columnId] = numericVal;
    setDataRows(newRows);
    setVal(formatNumber(numericVal));
  };

  useEffect(() => {
    setVal(formatNumber(value ?? ""));
  }, [value]);

  return (
    <input
      value={val}
      onChange={onChange}
      onBlur={onBlur}
      style={{
        width: "80px",
        textAlign: "center",
        border: "none",
        background: "transparent",
        fontFamily: "Roboto, Helvetica, Arial, sans-serif",
      }}
    />
  );
};

EditableCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  rowIndex: PropTypes.number.isRequired,
  columnId: PropTypes.string.isRequired,
  dataRows: PropTypes.array.isRequired,
  setDataRows: PropTypes.func.isRequired,
};
