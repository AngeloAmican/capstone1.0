document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
});

async function loadSidebar(activePageKey) {
  const container = document.getElementById("sidebar-container");

  if (!container) {
    return;
  }

  try {
    const response = await fetch("../navigation_bar/sidebar.html");

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

    loadActivePatientProfile();

    let pageKey = activePageKey;

    if (!pageKey) {
      const currentPath = window.location.pathname;

      if (currentPath.includes("dashboard")) {
        pageKey = "dashboard";
      } else if (currentPath.includes("appointment")) {
        pageKey = "appointment";
      } else if (currentPath.includes("medical_records")) {
        pageKey = "medical_records";
      } else if (currentPath.includes("payments")) {
        pageKey = "payments";
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
    console.error("Failed to load patient sidebar navigation:", error);
  }
}

function getCurrentUser() {
  try {
    const storedUser = sessionStorage.getItem("currentUser");
    if (storedUser) {
      return JSON.parse(storedUser);
    }
    return null;
  } catch (error) {
    return null;
  }
}

function getInitials(name) {
  if (!name) {
    return "PT";
  }

  const cleanName = String(name).trim();

  if (!cleanName) {
    return "PT";
  }

  const parts = cleanName.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function loadActivePatientProfile() {
  const nameEl = document.getElementById("activePatientName");
  const imageEl = document.getElementById("activePatientImage");
  const initialsEl = document.getElementById("activePatientInitials");

  if (!nameEl) {
    return;
  }

  const currentUser = getCurrentUser();

  if (!currentUser) {
    nameEl.textContent = "Patient";

    if (imageEl) {
      imageEl.style.display = "none";
    }

    if (initialsEl) {
      initialsEl.textContent = "PT";
      initialsEl.style.display = "flex";
    }

    return;
  }

  const firstname = currentUser.firstname || currentUser.firstName || "";

  const lastname = currentUser.lastname || currentUser.lastName || "";

  const fullName =
    currentUser.name ||
    currentUser.full_name ||
    `${firstname} ${lastname}`.trim();

  const initials = getInitials(fullName);

  nameEl.textContent = fullName || "Patient";

  if (currentUser.profileImage && imageEl) {
    imageEl.src = currentUser.profileImage;
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

  if (!sidebar) {
    return;
  }

  const savedState = localStorage.getItem("patientSidebarState");

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
        localStorage.setItem("patientSidebarState", "collapsed");

        if (toggleIcon) {
          toggleIcon.className = "fa-solid fa-chevron-right";
        }
      } else {
        localStorage.setItem("patientSidebarState", "expanded");

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

  const profileTrigger = document.getElementById("activePatientProfileTrigger");

  if (profileTrigger) {
    profileTrigger.addEventListener("click", (event) => {
      event.preventDefault();

      if (typeof window.openProfileModal === "function") {
        window.openProfileModal();
      } else {
        console.warn("openProfileModal() is not available yet.");
      }
    });
  }
}

document.addEventListener("click", (e) => {
  const logoutBtn = e.target.closest(".btn-logout");
  const cancelBtn = e.target.closest("#logoutCancelBtn");
  const confirmBtn = e.target.closest("#logoutConfirmBtn");
  const backdrop = document.getElementById("logoutModalBackdrop");

  if (logoutBtn) {
    e.preventDefault();

    if (backdrop) {
      backdrop.classList.add("active");
    }
  }

  if (cancelBtn) {
    e.preventDefault();

    if (backdrop) {
      backdrop.classList.remove("active");
    }
  }

  if (confirmBtn) {
    e.preventDefault();

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("currentUser");
    window.location.href = "../../homepage/homepage.html";
  }
});
