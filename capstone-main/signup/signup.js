const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const passwordInput = document.getElementById("password");
const eyeIcon = document.getElementById("eyeIcon");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", function () {
    const type =
      passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    eyeIcon.classList.toggle("fa-eye");
    eyeIcon.classList.toggle("fa-eye-slash");
  });
}
const toggleConfirmBtn = document.getElementById("toggleConfirmBtn");
const confirmInput = document.getElementById("confirm_password");
const eyeIconConfirm = document.getElementById("eyeIconConfirm");
if (toggleConfirmBtn) {
  toggleConfirmBtn.addEventListener("click", function () {
    const type =
      confirmInput.getAttribute("type") === "password" ? "text" : "password";
    confirmInput.setAttribute("type", type);
    eyeIconConfirm.classList.toggle("fa-eye");
    eyeIconConfirm.classList.toggle("fa-eye-slash");
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.querySelector(".auth-form");
  const passwordField = document.getElementById("password");
  const confirmPasswordField = document.getElementById("confirm_password");
  const emailField = document.getElementById("email");
  const requirementsBox = document.getElementById("passwordRequirements");
  const lengthRule = document.getElementById("lengthRule");
  const upperRule = document.getElementById("upperRule");
  const numberRule = document.getElementById("numberRule");
  const specialRule = document.getElementById("specialRule");
  function checkPasswordRequirements(pwd) {
    const minLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(pwd);
    if (lengthRule) {
      lengthRule.className = minLength ? "valid" : "invalid";
    }
    if (upperRule) {
      upperRule.className = hasUppercase ? "valid" : "invalid";
    }
    if (numberRule) {
      numberRule.className = hasNumber ? "valid" : "invalid";
    }
    if (specialRule) {
      specialRule.className = hasSpecialChar ? "valid" : "invalid";
    }
    const allMet = minLength && hasUppercase && hasNumber && hasSpecialChar;
    if (requirementsBox) {
      requirementsBox.style.display = allMet ? "none" : "flex";
    }
    return allMet;
  }
  function generateStaffId(users) {
    const staffNumbers = users
      .map((user) => {
        const match = String(user.staffId || user.staff_id || "").match(
          /^STF-(\d+)$/,
        );
        return match ? Number(match[1]) : 0;
      })
      .filter((number) => number > 0);
    const nextNumber = staffNumbers.length ? Math.max(...staffNumbers) + 1 : 1;
    return `STF-${String(nextNumber).padStart(4, "0")}`;
  }
  if (passwordField) {
    passwordField.addEventListener("input", () => {
      checkPasswordRequirements(passwordField.value);
      passwordField.setCustomValidity("");
    });
  }
  [confirmPasswordField, emailField].forEach((field) => {
    if (field) {
      field.addEventListener("input", () => {
        field.setCustomValidity("");
      });
    }
  });
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const firstname = document.getElementById("firstname").value.trim();
      const lastname = document.getElementById("lastname").value.trim();
      const email = emailField.value.trim().toLowerCase();
      const password = passwordField.value;
      const confirmPassword = confirmPasswordField.value;
      if (!checkPasswordRequirements(password)) {
        passwordField.setCustomValidity(
          "Please meet all password requirements listed below.",
        );
        passwordField.reportValidity();
        return;
      }
      if (password !== confirmPassword) {
        confirmPasswordField.setCustomValidity(
          "Passwords do not match. Please try again.",
        );
        confirmPasswordField.reportValidity();
        return;
      }
      let users = [];
      try {
        users = JSON.parse(localStorage.getItem("dentanueva_users")) || [];
      } catch (error) {
        users = [];
      }
      const existingUser = users.find(
        (user) => user.email && user.email.toLowerCase() === email,
      );
      if (existingUser) {
        emailField.setCustomValidity(
          "An account with this email already exists! Please log in.",
        );
        emailField.reportValidity();
        return;
      }
      const name = `${firstname} ${lastname}`.trim();
      const newUser = {
        firstname: firstname,
        lastname: lastname,
        name: name,
        email: email,
        password: password,
        role: "Staff",
        department: "Clinic Operations",
        staffId: generateStaffId(users),
        accessLevel: "Staff",
        status: "Active",
        profileImage: "",
        contact: "",
      };
      users.push(newUser);
      localStorage.setItem("dentanueva_users", JSON.stringify(users));
      window.location.href = "../login/login.html";
    });
  }
});
