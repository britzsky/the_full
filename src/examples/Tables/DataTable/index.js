/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useMemo, useEffect, useState } from "react";

// prop-types는 props 타입 검사를 위한 라이브러리
import PropTypes from "prop-types";

// react-table 컴포넌트
import { useTable, usePagination, useGlobalFilter, useAsyncDebounce, useSortBy } from "react-table";

// @mui Material 컴포넌트
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Icon from "@mui/material/Icon";
import Autocomplete from "@mui/material/Autocomplete";

// Material Dashboard 2 React 컴포넌트
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";

// Material Dashboard 2 React 예제 컴포넌트
import DataTableHeadCell from "examples/Tables/DataTable/DataTableHeadCell";
import DataTableBodyCell from "examples/Tables/DataTable/DataTableBodyCell";

function DataTable({
  entriesPerPage,
  entriesPerPagePosition,
  canSearch,
  showTotalEntries,
  table,
  pagination,
  isSorted,
  noEndBorder,
}) {
  // 기본 출력 개수
  const defaultValue = entriesPerPage.defaultValue ? entriesPerPage.defaultValue : 25;
  const entries = entriesPerPage.entries
    ? entriesPerPage.entries.map((el) => el.toString())
    : ["5", "10", "15", "20", "25"];
  const columns = useMemo(() => table.columns, [table]);
  const data = useMemo(() => table.rows, [table]);

  const tableInstance = useTable(
    { columns, data, initialState: { pageIndex: 0 } },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    rows,
    page,
    pageOptions,
    canPreviousPage,
    canNextPage,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    setGlobalFilter,
    state: { pageIndex, pageSize, globalFilter },
  } = tableInstance;

  // 컴포넌트 마운트 시 페이지당 표시 개수 기본값 설정
  useEffect(() => setPageSize(defaultValue || 10), [defaultValue]);

  // 선택 값에 따라 페이지당 표시 개수 설정
  const setEntriesPerPage = (value) => setPageSize(value);
  const hasBottomRightEntries = entriesPerPage && entriesPerPagePosition === "bottom-right";
  const hasTopControls = canSearch || (entriesPerPage && !hasBottomRightEntries);
  const entriesPerPageControl = (
    <MDBox display="flex" alignItems="center">
      <Autocomplete
        disableClearable
        value={pageSize.toString()}
        options={entries}
        onChange={(event, newValue) => {
          setEntriesPerPage(parseInt(newValue, 10));
        }}
        size="small"
        sx={{ width: "5rem" }}
        renderInput={(params) => <MDInput {...params} />}
      />
      <MDTypography variant="caption" color="secondary">
        &nbsp;&nbsp;페이지당 표시 개수
      </MDTypography>
    </MDBox>
  );

  // 페이지네이션 렌더링
  const renderPagination = pageOptions.map((option) => (
    <MDPagination
      item
      key={option}
      onClick={() => gotoPage(Number(option))}
      active={pageIndex === option}
    >
      {option + 1}
    </MDPagination>
  ));

  // 입력값으로 이동할 페이지 인덱스를 설정하는 핸들러
  const handleInputPagination = ({ target: { value } }) =>
    value > pageOptions.length || value < 0 ? gotoPage(0) : gotoPage(Number(value));

  // 1부터 시작하는 사용자용 페이지 옵션
  const customizedPageOptions = pageOptions.map((option) => option + 1);

  // 페이지네이션 입력값 처리
  const handleInputPaginationValue = ({ target: value }) => gotoPage(Number(value.value - 1));

  // 검색 입력값 상태
  const [search, setSearch] = useState(globalFilter);

  // 검색 입력값 변경 처리
  const onSearchChange = useAsyncDebounce((value) => {
    setGlobalFilter(value || undefined);
  }, 100);

  // 테이블 정렬 상태 값을 설정하는 함수
  const setSortedValue = (column) => {
    let sortedValue;

    if (isSorted && column.isSorted) {
      sortedValue = column.isSortedDesc ? "desc" : "asce";
    } else if (isSorted) {
      sortedValue = "none";
    } else {
      sortedValue = false;
    }

    return sortedValue;
  };

  // 현재 페이지 시작 항목 번호 설정
  const entriesStart = pageIndex === 0 ? pageIndex + 1 : pageIndex * pageSize + 1;

  // 현재 페이지 끝 항목 번호 설정
  let entriesEnd;

  if (pageIndex === 0) {
    entriesEnd = pageSize;
  } else if (pageIndex === pageOptions.length - 1) {
    entriesEnd = rows.length;
  } else {
    entriesEnd = pageSize * (pageIndex + 1);
  }

  return (
    <TableContainer sx={{ boxShadow: "none" }}>
      {hasTopControls ? (
        <MDBox display="flex" justifyContent="space-between" alignItems="center" p={3}>
          {entriesPerPage && !hasBottomRightEntries && entriesPerPageControl}
          {canSearch && (
            <MDBox width="12rem" ml="auto">
              <MDInput
                placeholder="검색하기"
                value={search}
                size="small"
                fullWidth
                onChange={({ currentTarget }) => {
                  setSearch(currentTarget.value);
                  onSearchChange(currentTarget.value);
                }}
              />
            </MDBox>
          )}
        </MDBox>
      ) : null}
      <Table {...getTableProps()}>
        <MDBox component="thead">
          {headerGroups.map((headerGroup, key) => (
            <TableRow key={key} {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, idx) => (
                <DataTableHeadCell
                  key={idx}
                  {...column.getHeaderProps(isSorted && column.getSortByToggleProps())}
                  width={column.width ? column.width : "auto"}
                  align={column.align ? column.align : "left"}
                  sorted={setSortedValue(column)}
                >
                  {column.render("Header")}
                </DataTableHeadCell>
              ))}
            </TableRow>
          ))}
        </MDBox>
        <TableBody {...getTableBodyProps()}>
          {page.map((row, key) => {
            prepareRow(row);
            return (
              <TableRow key={key} {...row.getRowProps()}>
                {row.cells.map((cell, idx) => (
                  <DataTableBodyCell
                    key={idx}
                    noBorder={noEndBorder && rows.length - 1 === key}
                    align={cell.column.align ? cell.column.align : "left"}
                    {...cell.getCellProps()}
                  >
                    {cell.render("Cell")}
                  </DataTableBodyCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <MDBox
        display="flex"
        flexDirection={{ xs: "column", sm: "row" }}
        justifyContent="flex-start"
        alignItems={{ xs: "flex-start", sm: "center" }}
        p={!showTotalEntries && pageOptions.length === 1 ? 0 : 3}
      >
        <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {pageOptions.length > 1 && (
            <MDPagination
              variant={pagination.variant ? pagination.variant : "gradient"}
              color={pagination.color ? pagination.color : "info"}
            >
              <MDPagination item onClick={() => previousPage()} disabled={!canPreviousPage}>
                <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
              </MDPagination>
              {renderPagination.length > 6 ? (
                <MDBox width="5rem" mx={1}>
                  <MDInput
                    inputProps={{ type: "number", min: 1, max: customizedPageOptions.length }}
                    value={customizedPageOptions[pageIndex]}
                    onChange={(handleInputPagination, handleInputPaginationValue)}
                  />
                </MDBox>
              ) : (
                renderPagination
              )}
              <MDPagination item onClick={() => nextPage()} disabled={!canNextPage}>
                <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
              </MDPagination>
            </MDPagination>
          )}
          {showTotalEntries && (
            <MDTypography variant="button" color="secondary" fontWeight="regular">
              {entriesStart} - {entriesEnd} / {rows.length}건
            </MDTypography>
          )}
          {hasBottomRightEntries && (
            <MDBox display="flex" alignItems="center" ml={{ xs: 0, sm: 1.5 }}>
              {entriesPerPageControl}
            </MDBox>
          )}
        </MDBox>
      </MDBox>
    </TableContainer>
  );
}

// DataTable props 기본값 설정
DataTable.defaultProps = {
  entriesPerPage: { defaultValue: 10, entries: [5, 10, 15, 20, 25] },
  entriesPerPagePosition: "top",
  canSearch: false,
  showTotalEntries: true,
  pagination: { variant: "gradient", color: "info" },
  isSorted: true,
  noEndBorder: false,
};

// DataTable props 타입 검사
DataTable.propTypes = {
  entriesPerPage: PropTypes.oneOfType([
    PropTypes.shape({
      defaultValue: PropTypes.number,
      entries: PropTypes.arrayOf(PropTypes.number),
    }),
    PropTypes.bool,
  ]),
  entriesPerPagePosition: PropTypes.oneOf(["top", "bottom-right"]),
  canSearch: PropTypes.bool,
  showTotalEntries: PropTypes.bool,
  table: PropTypes.objectOf(PropTypes.array).isRequired,
  pagination: PropTypes.shape({
    variant: PropTypes.oneOf(["contained", "gradient"]),
    color: PropTypes.oneOf([
      "primary",
      "secondary",
      "info",
      "success",
      "warning",
      "error",
      "dark",
      "light",
    ]),
  }),
  isSorted: PropTypes.bool,
  noEndBorder: PropTypes.bool,
};

export default DataTable;
