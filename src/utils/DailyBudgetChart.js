import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// 금액을 천 단위 콤마 + "원" 형태로 표시
const fmt = (v) => `${Math.round(Number(v) || 0).toLocaleString("ko-KR")}원`;

// 식자재 월 예산을 말일 수로 나눈 일 예산(고정선)과 일자별 식자재 사용금액을 비교하는 꺾은선 그래프
function DailyBudgetChart({ budget, dailyUsed, height = 260 }) {
  // 일 예산 = 월 예산 / 해당 월 일수
  const dailyBudget = dailyUsed.length > 0 ? (Number(budget) || 0) / dailyUsed.length : 0;

  // 그래프용 일자별 데이터(일자, 일 예산, 사용금액)
  const data = useMemo(
    () => dailyUsed.map((used, i) => ({ day: i + 1, budget: dailyBudget, used })),
    [dailyUsed, dailyBudget]
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="day" interval={0} tick={{ fontSize: 10 }} tickFormatter={(d) => `${d}일`} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={84} />
        <Tooltip formatter={(v) => fmt(v)} labelFormatter={(d) => `${d}일`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="linear"
          dataKey="budget"
          name={`일 예산 (${fmt(dailyBudget)})`}
          stroke="#e53935"
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="used"
          name="식자재 사용금액"
          stroke="#1e88e5"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

DailyBudgetChart.propTypes = {
  budget: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  dailyUsed: PropTypes.arrayOf(PropTypes.number).isRequired,
  height: PropTypes.number,
};

export default DailyBudgetChart;
