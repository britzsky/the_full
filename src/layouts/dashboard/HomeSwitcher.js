/* eslint-disable react/function-component-definition */
import React from "react";
import Dashboard from "./index";             // 기존 대시보드
import TallyManager from "layouts/tallysheet"; // 예시: 현장용 홈으로 쓸 컴포넌트

function HomeSwitcher() {
  // localStorage 에 어떻게 저장했는지에 따라 맞춰서 읽어오면 됨
  // 예1) department 만 따로 저장해둔 경우
  const department = Number(localStorage.getItem("department"));

  // 예2) userInfo JSON 으로 저장해둔 경우
  // const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  // const department = Number(userInfo.department);

  if (department === 7) {
    // 부서가 7(현장)이면 현장용 홈
    return <TallyManager />;
  }

  // 그 외에는 기존 대시보드
  return <Dashboard />;
}

export default HomeSwitcher;