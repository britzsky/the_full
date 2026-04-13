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
// 본사
import PeopleCountingManager from "layouts/headoffice/headofficetab";
import WeekMenuManager from "layouts/weekmenusheet";
import EventManager from "layouts/eventsheet";
import CarManager from "examples/Tabs/Business/CorCarTab";
import ElectronicPaymentManager from "layouts/headoffice/headofficetab_2";
// 영업
import BusinessSchedule from "layouts/business/BusinessScheduleSheet";
import TeleManager from "layouts/business/telemanager";
import ContractManager from "layouts/accountinfosheet";
// 운영
import OperateSchedule from "layouts/operate/OperateScheduleSheet";
import OperateTab from "layouts/operate/operatetab";
import OperateTab_3 from "layouts/operate/operatetab_3";
import OperateTab_4 from "layouts/operate/operatetab_4";
import AccountIssueManager2 from "layouts/operate/accountissuesheet2";
import BudgetManager from "layouts/operate/budgettablesheet";
// 회계
import AccountSales from "layouts/accountsales/accountsales";
import PurchaseDeadLineTally from "examples/Tabs/Accounting/AccountPurchaseDeadlineTab";
import PurchaseTally from "examples/Tabs/Accounting/AccountPurchaseTallyTab";
import HeadOfficeCorporateCardManager from "layouts/accounting/corporatecardsheet";
import AccountCorporateCardManager from "layouts/accounting/accountcorporatecardsheet";
import AccountPersonPurchaseManager from "layouts/accounting/accountpersonpurchasesheet";

// 인사
import HumanResourceTab_1 from "layouts/humanresource/humanresourcetab_1";
// 사용자 관리
import UserManagement from "layouts/humanresource/usermanagement";
// 현장
import TallyManager from "layouts/tallysheet";
import RecordManager from "layouts/recordsheet";
import DinersManager from "layouts/dinersnumbersheet";

// 개발팀 전용
import TallyDevelopManager from "layouts/tallysheet_develop";

// 테스트
//import Temp from "layouts/temp/AccountEventTab";

// @mui icons
import Icon from "@mui/material/Icon";
import HomeIcon from "@mui/icons-material/Home";

const routes = [
  {
    type: "collapse",
    name: "홈",
    key: "dashboard",
    icon: <HomeIcon style={{ color: "white" }} />,
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
    allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "🗂️ 관리표",
        key: "account_managerment",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/HeadOffice/PeopleCountingTab",
        component: <PeopleCountingManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1], // 🔹 직책권한

        // ✅ 특정 아이디에게도 권한 부여 (예: 팀장/대표 조건과는 별개로 통과시키고 싶을 때)
        allowUserIds: [
          "jr1", // 김주람 파트장
          "sy7", // 이수연 파트장
          "mh3", // 이미희 매니저
          "dh2", // 민다희 매니저
          "ys",  // 박이슬 매니저
          "db1", // 송다빈 매니저
          "ww1", // 이원우 매니저
          "iy1", // 최인영 매니저
          "me1", // 김맑음 매니저

        ],

        // (옵션) ✅ 특정 아이디는 무조건 차단
        //denyUserIds: ["baduser"],

        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🎉 행사",
        key: "event",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/event",
        component: <EventManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🍚 본사 식단표",
        key: "weekmenu",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/weekmenu",
        component: <WeekMenuManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🚙 법인차량 관리",
        key: "weekmenu",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/carManager",
        component: <CarManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "👥 사용자 관리",
        key: "user_management",
        // icon: <Icon fontSize="small">*</Icon>,
        route: "/headoffice/user-management",
        component: <UserManagement />,
        allowedDepartments: [6], // 🔹 부서권한 (개발팀)
        allowedPositions: [0, 1], // 🔹 직책권한 (대표님 / 팀장님)
        accessMode: "OR",
      },
      {
        type: "collapse",
        name: "📝 전자결재 관리",
        key: "weekmenu",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/electronicpaymentmanager",
        component: <ElectronicPaymentManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        // allowedDepartments: [6], // 🔹 부서권한
        accessMode: "AND",
      },
    ],
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "영업",
    key: "business",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "📅 일정관리",
        key: "businessschedule",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/businessschedule",
        component: <BusinessSchedule />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "ℹ️ 고객사 정보",
        key: "accountinfosheet",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/accountinfosheet/index",
        component: <ContractManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📁 고객사 관리",
        key: "businessaccount",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/businessaccount/telemanager",
        component: <TeleManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "💰 매출",
        key: "deadline",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/AccountSales/AccountSalesTab",
        component: <AccountSales />,
        allowedDepartments: [0, 5, 4, 6], // 🔹 부서권한
        // ✅ 특정 아이디에게도 권한 부여 (예: 팀장/대표 조건과는 별개로 통과시키고 싶을 때)
        allowUserIds: ["dh2", "mh2", "ww1", "hh2", "mh3"],
        accessMode: "OR",
      },
    ],
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "운영",
    key: "operate",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "📅 일정관리",
        key: "operateschedule",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/operateschedule",
        component: <OperateSchedule />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📑 예산",
        key: "budget",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/budget/budgetManager",
        component: <BudgetManager />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🧑‍🔧 현장관리",
        key: "fieldstaff",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/fieldstaff",
        component: <OperateTab_4 />,
        allowedDepartments: [6], // 🔹 부서권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🧑‍🔧 채용관리",
        key: "fieldstaff2",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/fieldstaff2",
        component: <OperateTab_3 />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "🏢 고객사 목록",
        key: "account",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/account",
        component: <Tables />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📁 고객사 관리",
        key: "account_management",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/Operate/OperateTabs",
        component: <OperateTab />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      {
        type: "collapse",
        name: "📋 고객사 소통",
        key: "business",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/Operate/accountissuesheet2",
        component: <AccountIssueManager2 />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
    ],
  },
  {
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    type: "collapse",
    name: "회계",
    key: "accounting",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 6], // 🔹 부서권한
    allowUserIds: ["yh2"], //   
    accessMode: "OR",
    collapse: [
      {
        type: "collapse",
        // name: "💳 거래처 자료 입력",
        name: "📦 매입마감",
        key: "purchaseDeadLineTally",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchaseDeadLineTally/purchasetally",
        component: <PurchaseDeadLineTally />,
        allowedDepartments: [0, 2, 6], // 🔹 부서권한
        allowUserIds: ["yh2"], // 이윤희 팀장님
        accessMode: "OR",
      },
      {
        type: "collapse",
        name: "💳 본사 법인카드",
        key: "headofficecorporatecard",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchase/headofficecorporatecard",
        component: <HeadOfficeCorporateCardManager />,
        allowedDepartments: [0, 2, 5, 6], // 🔹 부서권한
        allowUserIds: ["yh2"], // 이윤희 팀장님
        accessMode: "OR",
      },
      {
        type: "collapse",
        name: "💳 현장 법인카드",
        key: "accountcorporatecard",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchase/accountcorporatecard",
        component: <AccountCorporateCardManager />,
        allowedDepartments: [0, 2, 6], // 🔹 부서권한
        allowUserIds: ["yh2"], // 이윤희 팀장님
        accessMode: "OR",
      },
      {
        type: "collapse",
        name: "💳 개인구매 관리",
        key: "accountpersonpurchase",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchase/accountpersonpurchase",
        component: <AccountPersonPurchaseManager />,
        allowedDepartments: [0, 2, 6], // 🔹 부서권한
        allowUserIds: ["yh2"], // 이윤희 팀장님
        accessMode: "OR",
      },
      {
        type: "collapse",
        // name: "📦 매입마감",
        name: "📦 매입집계",
        key: "purchaseTally",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/purchaseTally/purchasetally",
        component: <PurchaseTally />,
        allowedDepartments: [0, 2, 6], // 🔹 부서권한
        allowUserIds: ["yh2"], // 이윤희 팀장님
        accessMode: "OR",
      },
    ],
  },
  {
    // 부서 -> (0:대표, 1: 신사업팀, 2: 회계팀, 3: 인사팀, 4: 영업팀, 5: 운영팀,  6: 개발팀, 7:현장)
    // 직책 -> (0: 대표, 1:팀장, 2: 부장, 3:차장, 4: 과장, 5: 대리, 6: 주임, 7: 사원,)
    type: "collapse",
    name: "인사",
    key: "human",
    icon: <Icon fontSize="small">table_view</Icon>,
    allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
    allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
    accessMode: "AND",
    collapse: [
      {
        type: "collapse",
        name: "🧑‍🔧 현장관리",
        key: "fieldstaff_1",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/fieldstaff_1",
        component: <HumanResourceTab_1 />,
        allowedDepartments: [0, 2, 3, 4, 5, 6], // 🔹 부서권한
        allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7], // 🔹 직책권한
        accessMode: "AND",
      },
      // {
      //   type: "collapse",
      //   name: "본사 교육",
      //   key: "account",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/tables",
      //   component: <Tables />,
      //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
      //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
      //   accessMode: "AND",
      // },
      // {
      //   type: "collapse",
      //   name: "인사평가",
      //   key: "account_member",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/accountmembersheet",
      //   component: <AccountMemberSheet />,
      //   allowedDepartments: [0, 3, 6],   // 🔹 부서권한
      // },
      // {
      //   type: "collapse",
      //   name: "연봉테이블",
      //   key: "business",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/business/telemanager",
      //   component: <TeleManager />,
      //   allowedDepartments: [0, 3, 6],   // 🔹 부서권한
      // },
      // {
      //   type: "collapse",
      //   name: "복리후생",
      //   key: "business",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/business/telemanager",
      //   component: <TeleManager />,
      //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
      //   allowedPositions: [0, 1, 2, 3, 4, 5, 6, 7,],   // 🔹 직책권한
      //   accessMode: "AND",
      // },
      // {
      //   type: "collapse",
      //   name: "평가/교육 자료",
      //   key: "business",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/business/telemanager",
      //   component: <TeleManager />,
      //   allowedDepartments: [0, 2, 3, 4, 5, 6],   // 🔹 부서권한
      //   allowedPositions: [0, 1],   // 🔹 직책권한
      //   accessMode: "AND",
      // },
    ],
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
      {
        type: "collapse",
        name: "🍽️ 식수현황",
        key: "diners",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/diners/dinersnumber",
        component: <DinersManager />,
      },
      {
        type: "collapse",
        name: "📋 집계표-개발팀",
        key: "account",
        //icon: <Icon fontSize="small">*</Icon>,
        route: "/layouts/tallysheet_develop",
        component: <TallyDevelopManager />,
        allowUserIds: ["britzsky", "ww1"],
        allowedDepartments: [6], // 🔹 부서권한
      },
      // {
      //   type: "collapse",
      //   name: "인수인계",
      //   key: "hand_over",
      //   icon: <Icon fontSize="small">*</Icon>,
      //   route: "/Operate/HandoverSheetTab",
      //   component: <HandOverManager />,
      // },
    ],
  },
  {
    type: "collapse",
    name: "로그아웃",
    key: "log-out",
    icon: <Icon fontSize="small">logout</Icon>,
    route: "components/Common/headerWithLogout",
    component: <SignIn />,
  },

  {
    //type: "collapse",
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
