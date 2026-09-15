document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
});
async function loadSidebar(activePageKey) {
  const container = document.getElementById("sidebar-container");
  if (!container) {
    return;
  }
  try {
    const response = await fetch("../navigationbar/sidebar.html");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const html = await response.text();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const logoutModal = tempDiv.querySelector("#logoutModalBackdrop");
    if (logoutModal) {
      logoutModal.remove();
    }
    container.innerHTML = tempDiv.innerHTML;
    if (!document.getElementById("logoutModalBackdrop") && logoutModal) {
      document.body.appendChild(logoutModal);
    }
    loadActiveDoctorProfile();
    let pageKey = activePageKey;
    if (!pageKey) {
      const currentPath = window.location.pathname;
      if (currentPath.includes("dashboard")) {
        pageKey = "dashboard";
      } else if (currentPath.includes("appointment")) {
        pageKey = "appointment";
      } else if (currentPath.includes("patient")) {
        pageKey = "patients";
      } else if (currentPath.includes("finance")) {
        pageKey = "finance";
      }
    }
    if (pageKey) {
      const activeLink = container.querySelector(`[data-page="${pageKey}"]`);
      if (activeLink) {
        activeLink.classList.add("active");
      }
    }
    applySavedSidebarState();
    initSidebarLogic();
  } catch (error) {
    console.error("Failed to load sidebar navigation:", error);
  }
}
function parseUserData(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      if (parsed.user && typeof parsed.user === "object") {
        return parsed.user;
      }
      if (parsed.data && typeof parsed.data === "object") {
        if (parsed.data.user && typeof parsed.data.user === "object") {
          return parsed.data.user;
        }
        return parsed.data;
      }
      return parsed;
    }
  } catch (error) {
    return null;
  }
  return null;
}
function getCurrentUser() {
  const storageKeys = [
    "currentUser",
    "loggedInUser",
    "user",
    "authUser",
    "activeUser",
    "sessionUser",
    "userData",
    "current_user",
    "loggedInUserData",
    "loginUser",
  ];
  for (const key of storageKeys) {
    const localValue = localStorage.getItem(key);
    if (localValue) {
      const user = parseUserData(localValue);
      if (user && isDoctorUser(user)) {
        return user;
      }
    }
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) {
      const user = parseUserData(sessionValue);
      if (user && isDoctorUser(user)) {
        return user;
      }
    }
  }
  return null;
}
function isDoctorUser(user) {
  if (!user || typeof user !== "object") {
    return false;
  }
  const role = String(user.role || user.userRole || user.accountType || "")
    .trim()
    .toLowerCase();
  const doctorId = user.doctorId || user.doctor_id || user.doctorID;
  return role === "doctor" || Boolean(doctorId);
}
function getDoctorInitials(name) {
  if (!name) {
    return "DR";
  }
  const cleanName = String(name).trim();
  if (!cleanName) {
    return "DR";
  }
  const cleanedParts = cleanName
    .replace(/^Dr\.\s*/i, "")
    .replace(/^Dr\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (cleanedParts.length === 1) {
    return cleanedParts[0].substring(0, 2).toUpperCase();
  }
  return (
    cleanedParts[0].charAt(0) + cleanedParts[cleanedParts.length - 1].charAt(0)
  ).toUpperCase();
}
function loadActiveDoctorProfile() {
  const nameEl = document.getElementById("activeDoctorName");
  const imageEl = document.getElementById("activeDoctorImage");
  const initialsEl = document.getElementById("activeDoctorInitials");
  if (!nameEl) {
    return;
  }
  const activeDoctor = getCurrentUser();
  if (!activeDoctor) {
    nameEl.textContent = "Doctor";
    if (imageEl) {
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
    }
    if (initialsEl) {
      initialsEl.textContent = "DR";
      initialsEl.style.display = "flex";
    }
    return;
  }
  const firstname = activeDoctor.firstname || activeDoctor.firstName || "";
  const lastname = activeDoctor.lastname || activeDoctor.lastName || "";
  const name =
    activeDoctor.name ||
    activeDoctor.full_name ||
    activeDoctor.fullName ||
    activeDoctor.fullname ||
    `${firstname} ${lastname}`.trim() ||
    "Doctor";
  const image =
    activeDoctor.image ||
    activeDoctor.profileImage ||
    activeDoctor.profile_image ||
    activeDoctor.photo ||
    activeDoctor.photoURL ||
    activeDoctor.avatar ||
    "";
  const initials = getDoctorInitials(name);
  nameEl.textContent = name;
  if (image && imageEl) {
    imageEl.src = image;
    imageEl.style.display = "block";
    if (initialsEl) {
      initialsEl.textContent = initials;
      initialsEl.style.display = "none";
    }
  } else {
    if (imageEl) {
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
    }
    if (initialsEl) {
      initialsEl.textContent = initials;
      initialsEl.style.display = "flex";
    }
  }
}
function applySavedSidebarState() {
  const sidebar = document.getElementById("sidebar");
  const toggleIcon = document.getElementById("toggleIcon");
  const savedState = localStorage.getItem("sidebarState");
  if (!sidebar) {
    return;
  }
  if (window.innerWidth > 768) {
    if (savedState === "collapsed") {
      sidebar.classList.add("collapsed");
      if (toggleIcon) {
        toggleIcon.className = "fa-solid fa-chevron-right";
      }
    } else {
      sidebar.classList.remove("collapsed");
      if (toggleIcon) {
        toggleIcon.className = "fa-solid fa-chevron-left";
      }
    }
  }
}
function initSidebarLogic() {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const toggleIcon = document.getElementById("toggleIcon");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      if (sidebar.classList.contains("collapsed")) {
        localStorage.setItem("sidebarState", "collapsed");
        if (toggleIcon) {
          toggleIcon.className = "fa-solid fa-chevron-right";
        }
      } else {
        localStorage.setItem("sidebarState", "expanded");
        if (toggleIcon) {
          toggleIcon.className = "fa-solid fa-chevron-left";
        }
      }
    });
  }
  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
      if (sidebarOverlay) {
        sidebarOverlay.classList.toggle("active");
      }
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      sidebarOverlay.classList.remove("active");
    });
  }
  const profileTrigger = document.getElementById("sidebarProfileTrigger");
  if (profileTrigger) {
    profileTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof window.openProfileModal === "function") {
        window.openProfileModal();
      } else {
        window.dispatchEvent(new Event("open-doctor-profile"));
      }
    });
    profileTrigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      if (typeof window.openProfileModal === "function") {
        window.openProfileModal();
      } else {
        window.dispatchEvent(new Event("open-doctor-profile"));
      }
    });
  }
}
document.addEventListener("click", (event) => {
  const logoutBtn = event.target.closest(".btn-logout");
  const cancelBtn = event.target.closest("#logoutCancelBtn");
  const confirmBtn = event.target.closest("#logoutConfirmBtn");
  const backdrop = document.getElementById("logoutModalBackdrop");
  if (logoutBtn) {
    event.preventDefault();
    if (backdrop) {
      backdrop.classList.add("active");
    }
  }
  if (cancelBtn) {
    event.preventDefault();
    if (backdrop) {
      backdrop.classList.remove("active");
    }
  }
  if (confirmBtn) {
    event.preventDefault();
    localStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("currentUser");
    localStorage.removeItem("currentUser");
    window.location.href = "../../homepage/homepage.html";
  }
});
window.getLoggedInDoctor = getCurrentUser;
window.getDoctorInitials = getDoctorInitials;
