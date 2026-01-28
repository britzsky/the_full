import { useEffect, useMemo, useState, useCallback } from "react";
import api from "api/api";
import Swal from "sweetalert2";
import PropTypes from "prop-types";

// @mui
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

// MD
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// 주소 검색
import DaumPostcode from "react-daum-postcode";

// DatePicker
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ko from "date-fns/locale/ko";
registerLocale("ko", ko);

// Images
import bgImage2 from "assets/images/thefull-Photoroom.png";

// ✅ 저장 API (백엔드에 맞게 변경)
const SAVE_API = "/User/UserUpdate"; // 필요 시 "/User/UserRgt" 등으로 변경

function UserProfileModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    user_name: "",
    user_id: "",
    password: "",
    user_type: "",
    phone: "",
    address: "",
    address_detail: "",
    zipcode: "",
    department: "",
    position: "",
    join_dt: "",
    account_id: "",
    birth_date: "",
  });

  const [errors, setErrors] = useState({});
  const [openPostcode, setOpenPostcode] = useState(false);
  const [accountList, setAccountList] = useState([]);

  const selectSx = {
    "& .MuiOutlinedInput-root": { height: "40px" },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      paddingTop: "10px",
      paddingBottom: "10px",
      fontSize: "0.8rem",
    },
    "& .MuiInputLabel-root": { fontSize: "0.7rem" },
  };

  // 회원가입과 동일한 라벨 잘림 방지 스타일
  const inputSx = {
    "& .MuiInputLabel-root": {
      fontSize: "0.7rem",
      lineHeight: 1.3,
    },
    "& .MuiOutlinedInput-input": {
      paddingTop: "12px",
      paddingBottom: "12px",
      fontSize: "0.85rem",
    },
  };

  // 부서/직책/근무지 라벨 위치 보정
  const selectLabelSx = {
    fontSize: "0.7rem",
    lineHeight: 1.4,
    overflow: "visible",
    transform: "translate(14px, 13px) scale(1)",
    "&.MuiInputLabel-shrink": {
      transform: "translate(14px, -7px) scale(0.75)",
      backgroundColor: "#fff",
      paddingLeft: "4px",
      paddingRight: "4px",
    },
  };

  const USER_TYPE_OPTIONS = useMemo(
    () => [
      { label: "ceo", labelKo: "ceo", code: "1" },
      { label: "본사", labelKo: "본사", code: "2" },
      { label: "영양사", labelKo: "영양사", code: "3" },
    ],
    []
  );

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const fetchAccountList = useCallback(async () => {
    try {
      const res = await api.get("/Account/AccountList", { params: { account_type: 0 } });
      setAccountList(res.data || []);
    } catch (err) {
      console.error("AccountList 조회 실패:", err);
      setAccountList([]);
    }
  }, []);

  const handleUserTypeChange = (code) => {
    if (code === "1") {
      setForm((prev) => ({
        ...prev,
        user_type: code,
        department: "0",
        position: "0",
        account_id: "",
      }));
    } else if (code === "2") {
      setForm((prev) => ({
        ...prev,
        user_type: code,
        department: prev.department ?? "",
        position: prev.position ?? "",
        account_id: "",
      }));
    } else if (code === "3") {
      setForm((prev) => ({
        ...prev,
        user_type: code,
        department: "7",
        position: "8",
        account_id: prev.account_id ?? "",
      }));
      fetchAccountList();
    } else {
      setForm((prev) => ({ ...prev, user_type: code }));
    }

    setErrors((prev) => ({
      ...prev,
      user_type: "",
      department: "",
      position: "",
      account_id: "",
    }));
  };

  const handleJoinDateChange = (date) => {
    if (!date) return handleInputChange("join_dt", "");
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    handleInputChange("join_dt", `${y}-${m}-${d}`);
  };

  const handleBirthDateChange = (date) => {
    if (!date) return handleInputChange("birth_date", "");
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    handleInputChange("birth_date", `${y}-${m}-${d}`);
  };

  const handlePhoneChange = (value) => {
    const num = value.replace(/\D/g, "");
    let formatted = num;
    if (num.length < 4) formatted = num;
    else if (num.length < 7) formatted = `${num.slice(0, 3)}-${num.slice(3)}`;
    else if (num.length < 11) formatted = `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
    else formatted = `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
    handleInputChange("phone", formatted);
  };

  const handleCompletePostcode = (data) => {
    const fullAddress = data.address;
    const extraAddress = data.buildingName ? ` (${data.buildingName})` : "";
    handleInputChange("address", fullAddress + extraAddress);
    handleInputChange("zipcode", data.zonecode);
    setOpenPostcode(false);
  };

  // ✅ 조회: 모달 열릴 때 user_id로 조회 (응답: 배열[0] flat)
  useEffect(() => {
    if (!open) return;

    const user_id = localStorage.getItem("user_id");
    if (!user_id) {
      Swal.fire("오류", "localStorage에 user_id가 없습니다.", "error");
      onClose?.();
      return;
    }

    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await api.get("/User/SelectUserInfo", { params: { user_id } });
        const row = Array.isArray(res.data) ? res.data[0] : res.data;

        if (!row) {
          Swal.fire("조회 실패", "사용자 정보가 없습니다.", "error");
          return;
        }

        const next = {
          user_name: row.user_name ?? "",
          user_id: row.user_id ?? user_id,
          password: row.password ?? "",
          user_type: row.user_type != null ? String(row.user_type) : "",
          phone: row.phone ?? "",
          address: row.address ?? "",
          address_detail: row.address_detail ?? "",
          zipcode: row.zipcode ?? "",
          department: row.department != null ? String(row.department) : "",
          position: row.position != null ? String(row.position) : "",
          join_dt: row.join_dt ?? "",
          account_id: row.account_id ?? "",
          birth_date: row.birth_date ?? "",
        };

        setForm(next);

        if (String(next.user_type) === "3") {
          await fetchAccountList();
        }
      } catch (err) {
        console.error(err);
        Swal.fire("조회 실패", "사용자 정보를 불러오지 못했습니다.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [open, onClose, fetchAccountList]);

  const datePickerSx = {
    "& .react-datepicker-popper": {
      zIndex: 99999,
    },
    "& .react-datepicker": {
      zIndex: 99999,
    },
    "& .react-datepicker__portal": {
      zIndex: 99999,
    },
  };

  // ✅ 저장: SignUp의 handleSubmit과 동일한 방식(info/detail payload)
  const handleSave = async () => {
    const requiredFields = [
      "user_name",
      "user_id",
      "password",
      "user_type",
      "phone",
      "address",
      "address_detail",
      "join_dt",
    ];

    if (form.user_type === "2") requiredFields.push("department", "position");
    if (form.user_type === "3") requiredFields.push("account_id");

    const newErrors = {};
    let hasError = false;

    requiredFields.forEach((field) => {
      if (!form[field]) {
        newErrors[field] = "필수 입력 항목입니다.";
        hasError = true;
      }
    });

    setErrors(newErrors);

    if (hasError) {
      Swal.fire({ icon: "error", title: "입력 오류", text: "필수 항목을 모두 입력해주세요." });
      return;
    }

    // ✅ payload 구성 (SignUp과 동일)
    const info = {
      user_id: form.user_id,
      user_name: form.user_name,
      password: form.password,
      user_type: form.user_type,
      join_dt: form.join_dt,
      department: form.department !== "" ? Number(form.department) : null,
      position: form.position !== "" ? Number(form.position) : null,
    };

    if (form.user_type === "3" && form.account_id) {
      info.account_id = form.account_id;
    }

    const detail = {
      user_id: form.user_id,
      phone: form.phone,
      address: form.address,
      address_detail: form.address_detail,
      zipcode: form.zipcode,
      birth_date: form.birth_date || null,
    };

    const payload = { info, detail };

    try {
      setLoading(true);
      const res = await api.post("/User/UserRgt", payload);

      Swal.fire({
        icon: "success",
        title: "저장 완료",
        text: "내 정보가 저장되었습니다.",
      });

      // 저장 후 최신값 다시 조회(선택)
      const user_id = localStorage.getItem("user_id");
      if (user_id) {
        const re = await api.get("/User/SelectUserInfo", { params: { user_id } });
        const row = Array.isArray(re.data) ? re.data[0] : re.data;
        if (row) {
          setForm((prev) => ({
            ...prev,
            user_name: row.user_name ?? prev.user_name,
            password: row.password ?? prev.password,
            user_type: row.user_type != null ? String(row.user_type) : prev.user_type,
            phone: row.phone ?? prev.phone,
            address: row.address ?? prev.address,
            address_detail: row.address_detail ?? prev.address_detail,
            zipcode: row.zipcode ?? prev.zipcode,
            department: row.department != null ? String(row.department) : prev.department,
            position: row.position != null ? String(row.position) : prev.position,
            join_dt: row.join_dt ?? prev.join_dt,
            account_id: row.account_id ?? prev.account_id,
            birth_date: row.birth_date ?? prev.birth_date,
          }));
        }
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "저장 실패",
        text: err?.response?.data?.message || "서버에 문제가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <MDTypography variant="h6">내 정보</MDTypography>
          <IconButton onClick={onClose} size="small">
            <Icon>close</Icon>
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Card sx={{ boxShadow: "none" }}>
            <MDBox pt={1} pb={1} px={3} textAlign="center">
              <img src={bgImage2} alt="logo" style={{ maxWidth: 150 }} />

              <MDBox component="form" role="form" mt={1}>
                <MDBox mb={2}>
                  <MDInput
                    type="text"
                    label="이름"
                    value={form.user_name}
                    onChange={(e) => handleInputChange("user_name", e.target.value)}
                    fullWidth
                    sx={inputSx}
                    error={!!errors.user_name}
                    helperText={errors.user_name}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                <MDBox mb={2}>
                  <MDInput
                    type="text"
                    label="아이디"
                    value={form.user_id}
                    fullWidth
                    sx={inputSx}
                    disabled
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                <MDBox mb={2}>
                  <MDInput
                    type="password"
                    label="비밀번호"
                    value={form.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    fullWidth
                    sx={inputSx}
                    error={!!errors.password}
                    helperText={errors.password}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                {/* 입사일자 */}
                <MDBox
                  mb={2}
                  sx={{
                    "& .react-datepicker-wrapper": { width: "100%" },
                    "& .react-datepicker__input-container": { width: "100%" },
                    ...datePickerSx,
                  }}
                >
                  <DatePicker
                    selected={form.join_dt ? new Date(form.join_dt) : null}
                    onChange={handleJoinDateChange}
                    dateFormat="yyyy-MM-dd"
                    locale="ko"
                    customInput={
                      <MDInput
                        type="text"
                        label="입사일자"
                        fullWidth
                        sx={inputSx}
                        error={!!errors.join_dt}
                        helperText={errors.join_dt}
                        InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                      />
                    }
                  />
                </MDBox>

                {/* 생년월일 */}
                <MDBox
                  mb={2}
                  sx={{
                    "& .react-datepicker-wrapper": { width: "100%" },
                    "& .react-datepicker__input-container": { width: "100%" },
                    ...datePickerSx,
                  }}
                >
                  <DatePicker
                    selected={form.birth_date ? new Date(form.birth_date) : null}
                    onChange={handleBirthDateChange}
                    dateFormat="yyyy-MM-dd"
                    locale="ko"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    maxDate={new Date()}
                    minDate={new Date(1950, 0, 1)}
                    customInput={
                      <MDInput
                        type="text"
                        label="생년월일"
                        fullWidth
                        sx={inputSx}
                        InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                      />
                    }
                  />
                </MDBox>

                {/* 사용자타입 */}
                <MDBox mb={2}>
                  <MDBox display="flex" justifyContent="space-between">
                    {USER_TYPE_OPTIONS.map((opt) => (
                      <MDBox key={opt.code} display="flex" alignItems="center">
                        <Checkbox checked={form.user_type === opt.code} onChange={() => handleUserTypeChange(opt.code)} />
                        <MDTypography variant="body2" sx={{ fontSize: "0.75rem" }}>
                          {opt.labelKo}
                        </MDTypography>
                      </MDBox>
                    ))}
                  </MDBox>
                  {errors.user_type && (
                    <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                      {errors.user_type}
                    </MDTypography>
                  )}
                </MDBox>

                {/* 본사일 때 부서/직책 */}
                {form.user_type === "2" && (
                  <MDBox mb={2} display="flex" gap={1}>
                    <FormControl fullWidth error={!!errors.department} sx={{ flex: 1, ...selectSx }}>
                      <InputLabel sx={selectLabelSx}>부서</InputLabel>
                      <Select label="부서" value={form.department} onChange={(e) => handleInputChange("department", e.target.value)}>
                        {/* <MenuItem value="0">대표</MenuItem> */}
                        <MenuItem value="2">회계팀</MenuItem>
                        <MenuItem value="3">인사팀</MenuItem>
                        <MenuItem value="4">영업팀</MenuItem>
                        <MenuItem value="5">운영팀</MenuItem>
                        <MenuItem value="6">개발팀</MenuItem>
                        {/* <MenuItem value="7">현장</MenuItem> */}
                      </Select>
                      {errors.department && (
                        <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                          {errors.department}
                        </MDTypography>
                      )}
                    </FormControl>

                    <FormControl fullWidth error={!!errors.position} sx={{ flex: 1, ...selectSx }}>
                      <InputLabel sx={selectLabelSx}>직책</InputLabel>
                      <Select label="직책" value={form.position} onChange={(e) => handleInputChange("position", e.target.value)}>
                        {/* <MenuItem value="0">대표</MenuItem> */}
                        <MenuItem value="1">팀장</MenuItem>
                        <MenuItem value="2">파트장</MenuItem>
                        <MenuItem value="3">매니저</MenuItem>
                        {/* <MenuItem value="2">부장</MenuItem>
                        <MenuItem value="3">차장</MenuItem>
                        <MenuItem value="4">과장</MenuItem>
                        <MenuItem value="5">대리</MenuItem>
                        <MenuItem value="6">주임</MenuItem>
                        <MenuItem value="7">사원</MenuItem> */}
                      </Select>
                      {errors.position && (
                        <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                          {errors.position}
                        </MDTypography>
                      )}
                    </FormControl>
                  </MDBox>
                )}

                {/* 영양사일 때 거래처 */}
                {form.user_type === "3" && (
                  <MDBox mb={2}>
                    <FormControl fullWidth error={!!errors.account_id} sx={selectSx}>
                      <InputLabel sx={selectLabelSx}>근무지(거래처)</InputLabel>
                      <Select
                        label="근무지(거래처)"
                        value={form.account_id}
                        onChange={(e) => handleInputChange("account_id", e.target.value)}
                      >
                        {accountList.map((account) => (
                          <MenuItem key={account.account_id} value={account.account_id}>
                            {account.name || account.account_name || account.account_id}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.account_id && (
                        <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                          {errors.account_id}
                        </MDTypography>
                      )}
                    </FormControl>
                  </MDBox>
                )}

                <MDBox mb={2}>
                  <MDInput
                    type="text"
                    label="전화번호"
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    fullWidth
                    sx={inputSx}
                    error={!!errors.phone}
                    helperText={errors.phone}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                <MDBox mb={2} display="flex">
                  <MDInput
                    type="text"
                    label="주소"
                    value={form.address}
                    fullWidth
                    sx={inputSx}
                    readOnly
                    error={!!errors.address}
                    helperText={errors.address}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                  <MDButton variant="gradient" color="info" onClick={() => setOpenPostcode(true)} sx={{ ml: 1, padding: "2px" }}>
                    주소찾기
                  </MDButton>
                </MDBox>

                <MDBox mb={2}>
                  <MDInput
                    type="text"
                    label="상세주소"
                    value={form.address_detail}
                    onChange={(e) => handleInputChange("address_detail", e.target.value)}
                    fullWidth
                    sx={inputSx}
                    error={!!errors.address_detail}
                    helperText={errors.address_detail}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                <MDBox mb={2}>
                  <MDInput
                    type="text"
                    label="우편번호"
                    value={form.zipcode}
                    fullWidth
                    sx={inputSx}
                    readOnly
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                </MDBox>

                <MDBox mt={2} display="flex" justifyContent="flex-end" gap={1}>
                  <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={loading}>
                    닫기
                  </MDButton>
                  <MDButton variant="gradient" color="info" onClick={handleSave} disabled={loading}>
                    {loading ? "저장중..." : "저장"}
                  </MDButton>
                </MDBox>

                {/* 주소 검색 모달 */}
                <Dialog open={openPostcode} onClose={() => setOpenPostcode(false)} maxWidth="sm" fullWidth>
                  <DialogContent>
                    <DaumPostcode onComplete={handleCompletePostcode} autoClose />
                  </DialogContent>
                </Dialog>
              </MDBox>
            </MDBox>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}

UserProfileModal.defaultProps = {
  open: false,
  onClose: () => { },
};

UserProfileModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default UserProfileModal;
