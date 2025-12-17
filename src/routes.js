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

/** 
  All of the routes for the Material Dashboard 2 React are added here,
  You can add a new route, customize the routes and delete the routes here.

  Once you add a new route on this file it will be visible automatically on
  the Sidenav.

  For adding a new route you can follow the existing routes in the routes array.
  1. The `type` key with the `collapse` value is used for a route.
  2. The `type` key with the `title` value is used for a title inside the Sidenav. 
  3. The `type` key with the `divider` value is used for a divider between Sidenav items.
  4. The `name` key is used for the name of the route on the Sidenav.
  5. The `key` key is used for the key of the route (It will help you with the key prop inside a loop).
  6. The `icon` key is used for the icon of the route on the Sidenav, you have to add a node.
  7. The `collapse` key is used for making a collapsible item on the Sidenav that has other routes
  inside (nested routes), you need to pass the nested routes inside an array as a value for the `collapse` key.
  8. The `route` key is used to store the route location which is used for the react router.
  9. The `href` key is used to store the external links location.
  10. The `title` key is only for the item with the type of `title` and its used for the title text on the Sidenav.
  10. The `component` key is used to store the component of its route.
*/

// Material Dashboard 2 React layouts
//import Dashboard from "layouts/dashboard";
import HomeSwitcher from "layouts/dashboard/HomeSwitcher";
import Tables from "layouts/tables";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import AccountMemberSheet from "layouts/accountmembersheet";
// 본사
import PeopleCountingManager from "layouts/headoffice/headofficetab";
import WeekMenuManager from "layouts/weekmenusheet";
import EventManager from "layouts/eventsheet";
// 영업
import BusinessSchedule from "layouts/business/BusinessScheduleSheet";
import TeleManager from "layouts/business/telemanager";
import ContractManager from "layouts/accountinfosheet";
// 운영
import OperateSchedule from "layouts/operate/OperateScheduleSheet";
import OperateTab from "layouts/operate/operatetab";
import OperateTab_2 from "layouts/operate/operatetab_2";
import AccountIssueManager from "layouts/operate/accountissuesheet";
import BudgetManager from "layouts/operate/budgettablesheet";
// 회계
//import DeadlineBalance from "examples/Tabs/AccountSales/DeadlineBalanceTab";
import AccountSales from "layouts/accountsales/accountsales";
import PurchaseTally from "layouts/accounting/accountpurchasetally"
// 현장
import TallyManager from "layouts/tallysheet";
import RecordManager from "layouts/recordsheet";
// @mui icons
import Icon from "@mui/material/Icon";
import HomeIcon from "@mui/icons-material/Home";

const routes = [
  {
    type: "collapse",
    name: "홈",
    key: "dashboard",
    icon: <HomeIcon style={{color: "white"}} />,
    route: "/dashboard",
    component: <HomeSwitcher />,
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "본사",
    key: "tables",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "🗂️ 관리표",
        key: "account_managerment",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/HeadOffice/PeopleCountingTab",
        component: <PeopleCountingManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🎉 행사",
        key: "event",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/event",
        component: <EventManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🍚 본사 식단표",
        key: "weekmenu",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/weekmenu",
        component: <WeekMenuManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
    ]
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "영업",
    key: "business",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7],   // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "📅 일정관리",
        key: "businessschedule",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/businessschedule",
        component: <BusinessSchedule />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "ℹ️ 고객사 정보",
        key: "accountinfosheet",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/accountinfosheet/index",
        component: <ContractManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📁 고객사 관리",
        key: "business",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/business/telemanager",
        component: <TeleManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7],   // 🔹 직책권한
        accessMode: "AND",
      },
    ]
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "운영",
    key: "operate",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    accessMode: "AND",
    collapse: [
       {
        type: "collapse",
        name: "📅 일정관리",
        key: "operateschedule",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/operateschedule",
        component: <OperateSchedule />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📑 예산",
        key: "budget",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/budget/budgetManager",
        component: <BudgetManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🧑‍🔧 현장관리",
        key: "fieldstaff",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/fieldstaff",
        component: <OperateTab_2 />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🏢 고객사 목록",
        key: "account",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/account",
        component: <Tables />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📁 고객사 관리",
        key: "account_management",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/Operate/OperateTabs",
        component: <OperateTab />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📋 고객사 소통",
        key: "business",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/Operate/accountissuesheet",
        component: <AccountIssueManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
    ]
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "회계",
    key: "accounting",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 6],   // 🔹 부서권한
    accessMode: "OR",
    collapse: [
      {
        type: "collapse",
        name: "💰 매출",
        key: "deadline",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/AccountSales/AccountSalesTab",
        component: <AccountSales />,
        allowedDepartments: [0, 2, 6],   // 🔹 부서권한
        accessMode: "OR",
      },
      {
        type: "collapse",
        name: "📦 매입",
        key: "accounting",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchase/purchasetally",
        component: <PurchaseTally />,
        allowedDepartments: [0, 2, 6],   // 🔹 부서권한
        accessMode: "OR",
      },
    ]
  },
  {
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    type: "collapse",
    name: "인사",
    key: "human",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "본사 교육",
        key: "account",
        icon: <Icon fontSize="small">*</Icon>,
        route: "/tables",
        component: <Tables />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "인사평가",
        key: "account_member",
        icon: <Icon fontSize="small">*</Icon>,
        route: "/accountmembersheet",
        component: <AccountMemberSheet />,
        allowedDepartments: [0, 3, 6],   // 🔹 부서권한
      },
      {
        type: "collapse",
        name: "연봉테이블",
        key: "business",
        icon: <Icon fontSize="small">*</Icon>,
        route: "/business/telemanager",
        component: <TeleManager />,
        allowedDepartments: [0, 3, 6],   // 🔹 부서권한
      },
      {
        type: "collapse",
        name: "복리후생",
        key: "business",
        icon: <Icon fontSize="small">*</Icon>,
        route: "/business/telemanager",
        component: <TeleManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "평가/교육 자료",
        key: "business",
        icon: <Icon fontSize="small">*</Icon>,
        route: "/business/telemanager",
        component: <TeleManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
        allowedPositions: [0, 1],   // 🔹 직책권한
        accessMode: "AND",
      },
    ]
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "현장",
    key: "site",
    icon: <Icon fontSize="small">table_view</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "📋 집계표",
        key: "account",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/layouts/tallysheet",
        component: <TallyManager />,
      },
      {
        type: "collapse",
        name: "📅 출근부",
        key: "account_member",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/layouts/recordsheet",
        component: <RecordManager />,
      },
      // {
      //   type: "collapse",
      //   name: "인수인계",
      //   key: "hand_over",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/Operate/HandoverSheetTab",
      //   component: <HandOverManager />,
      // },
    ]
  },
  {
    type: "collapse",
    name: "로그인",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    type: "collapse",
    name: "회원가입",
    key: "sign-up",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/authentication/sign-up",
    component: <SignUp />,
  },
];

export default routes;
