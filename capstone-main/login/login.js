document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.querySelector(".auth-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMe = document.querySelector('input[name="remember"]');
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const eyeIcon = document.getElementById("eyeIcon");
  const errorBox = document.getElementById("loginErrorMsg");
  const errorText = document.getElementById("errorText");
  const USERS_KEY = "dentanueva_users";
  const CURRENT_USER_KEY = "currentUser";
  const REMEMBERED_EMAIL_KEY = "rememberedEmail";
  function getUsers() {
    try {
      const storedUsers = localStorage.getItem(USERS_KEY);
      if (!storedUsers) {
        return [];
      }
      const users = JSON.parse(storedUsers);
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error("Error reading users from LocalStorage:", error);
      return [];
    }
  }
  function showError(message) {
    if (!errorBox || !errorText) {
      return;
    }
    errorText.textContent = message;
    errorBox.style.display = "flex";
  }
  function hideError() {
    if (errorBox) {
      errorBox.style.display = "none";
    }
  }
  function getRedirectPage(role) {
    const normalizedRole = String(role || "")
      .trim()
      .toLowerCase();
    if (normalizedRole === "patient") {
      return "../patients/dashboard/dashboard.html";
    }
    if (normalizedRole === "doctor" || normalizedRole === "dentist") {
      return "../doctor/dashboard/dashboard.html";
    }
    if (
      normalizedRole === "staff" ||
      normalizedRole === "assistant" ||
      normalizedRole === "admin"
    ) {
      return "../staff/dashboard/dashboard.html";
    }
    return null;
  }
  if (togglePasswordBtn && passwordInput && eyeIcon) {
    togglePasswordBtn.addEventListener("click", function () {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");
      eyeIcon.classList.toggle("fa-eye", !isPassword);
      eyeIcon.classList.toggle("fa-eye-slash", isPassword);
    });
  }
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberMe) {
      rememberMe.checked = true;
    }
  }
  if (emailInput) {
    emailInput.addEventListener("input", hideError);
  }
  if (passwordInput) {
    passwordInput.addEventListener("input", hideError);
  }
  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      hideError();
      const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
      const password = passwordInput ? passwordInput.value : "";
      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }
      const users = getUsers();
      if (users.length === 0) {
        showError("No accounts found. Please create an account first.");
        return;
      }
      const validUser = users.find(function (user) {
        const userEmail = String(user.email || "")
          .trim()
          .toLowerCase();
        const userPassword = String(user.password || "");
        return userEmail === email && userPassword === password;
      });
      if (!validUser) {
        const emailExists = users.some(function (user) {
          return (
            String(user.email || "")
              .trim()
              .toLowerCase() === email
          );
        });
        if (!emailExists) {
          showError("Account not found. Please try again.");
        } else {
          showError("Email or Password is incorrect. Please try again.");
        }
        return;
      }
      const firstname = validUser.firstname || validUser.firstName || "";
      const lastname = validUser.lastname || validUser.lastName || "";
      const fullName =
        validUser.fullName ||
        validUser.full_name ||
        validUser.name ||
        `${firstname} ${lastname}`.trim();
      const userRole = String(validUser.role || "").trim();
      const currentUser = {
        ...validUser,
        id: validUser.id || null,
        userId: validUser.userId || validUser.user_id || null,
        firstname: firstname,
        lastname: lastname,
        firstName: firstname,
        lastName: lastname,
        name: fullName || "User",
        fullName: fullName || "User",
        email: validUser.email || email,
        role: userRole,
        department: validUser.department || "",
        staffId: validUser.staffId || validUser.staff_id || null,
        patientId:
          validUser.patientId ||
          validUser.patientID ||
          validUser.patient_id ||
          null,
        dentistId:
          validUser.dentistId ||
          validUser.dentistID ||
          validUser.dentist_id ||
          null,
        accessLevel:
          validUser.accessLevel || validUser.access_level || userRole,
        status: validUser.status || "Active",
        profileImage:
          validUser.profileImage ||
          validUser.profile_image ||
          validUser.image ||
          "",
        contact:
          validUser.contact ||
          validUser.contactNumber ||
          validUser.contact_number ||
          "",
        createdAt: validUser.createdAt || "",
      };
      const redirectPage = getRedirectPage(currentUser.role);
      if (!redirectPage) {
        showError("Your account role is not recognized.");
        console.error("Unrecognized account role:", currentUser.role);
        return;
      }
      if (rememberMe && rememberMe.checked) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      console.log("DentaNueva Login Successful");
      console.log("Logged in user:", currentUser);
      console.log("Role:", currentUser.role);
      console.log("Redirecting to:", redirectPage);
      const targetUrl = new URL(redirectPage, window.location.href).href;
      window.top.location.href = targetUrl;
    });
  }
});
