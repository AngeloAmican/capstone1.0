document.addEventListener("DOMContentLoaded", () => {
  loadProfileModal();
});
let profileSuccessTimeout = null;
let profileModalLoadingPromise = null;
async function loadProfileModal() {
  const existingModal = document.getElementById("profileModalBackdrop");
  if (existingModal) {
    initProfileLogic();
    return existingModal;
  }
  if (profileModalLoadingPromise) {
    return profileModalLoadingPromise;
  }
  profileModalLoadingPromise = (async () => {
    try {
      const response = await fetch("../profile/profile.html");
      if (!response.ok) {
        throw new Error("Unable to load profile modal.");
      }
      const html = await response.text();
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const modal = tempDiv.querySelector("#profileModalBackdrop");
      if (!modal) {
        throw new Error("Profile modal markup was not found.");
      }
      document.body.appendChild(modal);
      initProfileLogic();
      return modal;
    } catch (error) {
      console.error("Failed to load profile modal:", error);
      return null;
    } finally {
      profileModalLoadingPromise = null;
    }
  })();
  return profileModalLoadingPromise;
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
function getDoctorId(currentUser = getCurrentUser()) {
  if (!currentUser) {
    return "";
  }
  return String(
    currentUser.doctorId || currentUser.doctor_id || currentUser.doctorID || "",
  ).trim();
}
function isValidDoctorId(doctorId) {
  return /^DOC-\d{4}$/.test(String(doctorId || "").trim());
}
function getUserIdentity(user) {
  if (!user) {
    return "";
  }
  const id = user.id || user.userId || user.user_id || "";
  if (id) {
    return `id:${String(id).trim().toLowerCase()}`;
  }
  const email = user.email || "";
  if (email) {
    return `email:${String(email).trim().toLowerCase()}`;
  }
  const username = user.username || "";
  if (username) {
    return `username:${String(username).trim().toLowerCase()}`;
  }
  const firstname = user.firstname || user.firstName || "";
  const lastname = user.lastname || user.lastName || "";
  const name =
    user.name ||
    user.full_name ||
    user.fullName ||
    `${firstname} ${lastname}`.trim();
  return `name:${String(name).trim().toLowerCase()}`;
}
function getDoctorAccounts(users) {
  if (!Array.isArray(users)) {
    return [];
  }
  return users.filter((user) => isDoctorUser(user));
}
function syncDoctorAccountIds(currentUser) {
  if (!currentUser) {
    return "";
  }
  try {
    const users = JSON.parse(localStorage.getItem("dentanueva_users")) || [];
    if (!Array.isArray(users)) {
      return "";
    }
    const doctorAccounts = getDoctorAccounts(users);
    const currentIdentity = getUserIdentity(currentUser);
    let currentDoctorIndex = doctorAccounts.findIndex(
      (user) => getUserIdentity(user) === currentIdentity,
    );
    if (currentDoctorIndex === -1) {
      currentDoctorIndex = doctorAccounts.length;
      doctorAccounts.push(currentUser);
    }
    const doctorIdMap = new Map();
    doctorAccounts.forEach((doctor, index) => {
      const identity = getUserIdentity(doctor);
      if (identity) {
        doctorIdMap.set(identity, `DOC-${String(index + 1).padStart(4, "0")}`);
      }
    });
    const updatedUsers = users.map((user) => {
      if (!isDoctorUser(user)) {
        return user;
      }
      const identity = getUserIdentity(user);
      const doctorId = doctorIdMap.get(identity);
      if (!doctorId) {
        return user;
      }
      return { ...user, doctorId };
    });
    localStorage.setItem("dentanueva_users", JSON.stringify(updatedUsers));
    const currentDoctorId =
      doctorIdMap.get(currentIdentity) ||
      `DOC-${String(currentDoctorIndex + 1).padStart(4, "0")}`;
    const updatedCurrentUser = { ...currentUser, doctorId: currentDoctorId };
    localStorage.setItem("currentUser", JSON.stringify(updatedCurrentUser));
    sessionStorage.setItem("currentUser", JSON.stringify(updatedCurrentUser));
    return currentDoctorId;
  } catch (error) {
    console.error("Failed to synchronize doctor ID:", error);
    const existingId = getDoctorId(currentUser);
    return isValidDoctorId(existingId) ? existingId : "";
  }
}
function getDoctorInitials(name) {
  if (!name) {
    return "DR";
  }
  const cleanName = String(name)
    .trim()
    .replace(/^Dr\.\s*/i, "")
    .replace(/^Dr\s+/i, "");
  if (!cleanName) {
    return "DR";
  }
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function getDoctorData() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return {
      name: "Doctor",
      initials: "DR",
      image: "",
      role: "Doctor",
      specialization: "General Dentistry",
      doctorId: "No doctor ID available",
      accessLevel: "Doctor",
      email: "",
      contact: "",
      status: "Active",
    };
  }
  const firstname = currentUser.firstname || currentUser.firstName || "";
  const lastname = currentUser.lastname || currentUser.lastName || "";
  const name =
    currentUser.name ||
    currentUser.full_name ||
    currentUser.fullName ||
    currentUser.fullname ||
    `${firstname} ${lastname}`.trim() ||
    "Doctor";
  const doctorId = syncDoctorAccountIds(currentUser);
  return {
    name,
    initials: getDoctorInitials(name),
    image:
      currentUser.profileImage ||
      currentUser.profile_image ||
      currentUser.image ||
      currentUser.photo ||
      currentUser.photoURL ||
      currentUser.avatar ||
      "",
    role: currentUser.role || "Doctor",
    specialization:
      currentUser.specialization ||
      currentUser.specialisation ||
      currentUser.specialty ||
      currentUser.speciality ||
      "General Dentistry",
    doctorId: doctorId || "No doctor ID available",
    accessLevel:
      currentUser.accessLevel || currentUser.access_level || "Doctor",
    email: currentUser.email || "",
    contact:
      currentUser.contact ||
      currentUser.contactNumber ||
      currentUser.contact_number ||
      "",
    status: currentUser.status || "Active",
  };
}
function saveDoctorData(data) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return false;
  }
  const doctorId = syncDoctorAccountIds(currentUser);
  const updatedUser = {
    ...currentUser,
    doctorId: doctorId || getDoctorId(currentUser),
    contact: data.contact,
    specialization: data.specialization,
  };
  try {
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));
    const users = JSON.parse(localStorage.getItem("dentanueva_users")) || [];
    const currentIdentity = getUserIdentity(currentUser);
    const updatedUsers = users.map((user) => {
      const sameIdentity = getUserIdentity(user) === currentIdentity;
      if (sameIdentity) {
        return {
          ...user,
          contact: data.contact,
          specialization: data.specialization,
          doctorId: updatedUser.doctorId,
        };
      }
      return user;
    });
    localStorage.setItem("dentanueva_users", JSON.stringify(updatedUsers));
    return true;
  } catch (error) {
    console.error("Failed to save doctor profile:", error);
    return false;
  }
}
function populateProfileModal(doctor) {
  const nameEl = document.getElementById("profileModalName");
  const roleEl = document.getElementById("profileModalRole");
  const statusEl = document.getElementById("profileModalStatus");
  const doctorIdEl = document.getElementById("profileModalDoctorId");
  const specializationEl = document.getElementById(
    "profileModalSpecialization",
  );
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  const accessLevelEl = document.getElementById("profileModalAccessLevel");
  const emailEl = document.getElementById("profileModalEmail");
  const contactEl = document.getElementById("profileModalContact");
  const contactInput = document.getElementById("profileModalContactInput");
  const imageEl = document.getElementById("profileModalImage");
  const initialsEl = document.getElementById("profileModalInitials");
  if (nameEl) {
    nameEl.textContent = doctor.name;
  }
  if (roleEl) {
    roleEl.textContent = doctor.role;
  }
  if (statusEl) {
    statusEl.textContent = doctor.status;
  }
  if (doctorIdEl) {
    doctorIdEl.textContent = doctor.doctorId;
  }
  if (specializationEl) {
    specializationEl.textContent = doctor.specialization;
  }
  if (specializationInput) {
    specializationInput.value = doctor.specialization || "";
  }
  if (accessLevelEl) {
    accessLevelEl.textContent = doctor.accessLevel;
  }
  if (emailEl) {
    emailEl.textContent = doctor.email || "No email available";
  }
  if (contactEl) {
    contactEl.textContent = doctor.contact || "No contact number available";
  }
  if (contactInput) {
    contactInput.value = doctor.contact || "";
  }
  if (imageEl && initialsEl) {
    const initials = getDoctorInitials(doctor.name);
    if (doctor.image) {
      imageEl.src = doctor.image;
      imageEl.style.display = "block";
      initialsEl.textContent = initials;
      initialsEl.style.display = "none";
    } else {
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
      initialsEl.textContent = initials;
      initialsEl.style.display = "flex";
    }
  }
  clearProfileValidation();
}
function updateSidebarProfile(doctor) {
  const nameEl = document.getElementById("activeDoctorName");
  const imageEl = document.getElementById("activeDoctorImage");
  const initialsEl = document.getElementById("activeDoctorInitials");
  if (nameEl) {
    nameEl.textContent = doctor.name;
  }
  if (!imageEl || !initialsEl) {
    return;
  }
  if (doctor.image) {
    imageEl.src = doctor.image;
    imageEl.style.display = "block";
    initialsEl.textContent = getDoctorInitials(doctor.name);
    initialsEl.style.display = "none";
  } else {
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    initialsEl.textContent = getDoctorInitials(doctor.name);
    initialsEl.style.display = "flex";
  }
}
async function openProfileModal() {
  let backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    backdrop = await loadProfileModal();
  }
  if (!backdrop) {
    console.error("profileModalBackdrop was not found.");
    return;
  }
  initProfileLogic();
  const card = backdrop.querySelector(".profile-modal-card");
  const doctor = getDoctorData();
  populateProfileModal(doctor);
  updateSidebarProfile(doctor);
  if (card) {
    card.classList.remove("editing");
  }
  clearProfileValidation();
  hideProfileSaveSuccess();
  backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeProfileModal() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  if (card) {
    card.classList.remove("editing");
  }
  backdrop.classList.remove("active");
  clearProfileValidation();
  hideProfileSaveSuccess();
  document.body.style.overflow = "";
}
function startProfileEditing() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  if (!card || !contactInput || !specializationInput) {
    return;
  }
  const doctor = getDoctorData();
  contactInput.value = doctor.contact || "";
  specializationInput.value = doctor.specialization || "";
  clearProfileValidation();
  hideProfileSaveSuccess();
  card.classList.add("editing");
  setTimeout(() => {
    specializationInput.focus();
  }, 50);
}
function cancelProfileEditing() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  if (!card) {
    return;
  }
  const doctor = getDoctorData();
  populateProfileModal(doctor);
  card.classList.remove("editing");
  clearProfileValidation();
  hideProfileSaveSuccess();
}
function validateContact(contact) {
  return /^09\d{9}$/.test(contact);
}
function showFieldError(input, errorElement, message) {
  if (input) {
    input.classList.add("field-invalid");
    input.setAttribute("aria-invalid", "true");
  }
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }
}
function clearFieldError(input, errorElement) {
  if (input) {
    input.classList.remove("field-invalid");
    input.removeAttribute("aria-invalid");
  }
  if (errorElement) {
    errorElement.textContent = "";
    errorElement.classList.remove("show");
  }
}
function clearProfileValidation() {
  const contactInput = document.getElementById("profileModalContactInput");
  const contactError = document.getElementById("profileModalContactError");
  clearFieldError(contactInput, contactError);
}
function validateProfileFields() {
  const contactInput = document.getElementById("profileModalContactInput");
  const contactError = document.getElementById("profileModalContactError");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  if (!contactInput || !specializationInput) {
    return false;
  }
  clearProfileValidation();
  const contact = contactInput.value.trim();
  const specialization = specializationInput.value.trim();
  if (!specialization) {
    specializationInput.focus();
    return false;
  }
  if (!contact) {
    showFieldError(contactInput, contactError, "Contact number is required.");
    contactInput.focus();
    return false;
  }
  if (!validateContact(contact)) {
    showFieldError(
      contactInput,
      contactError,
      "Use a valid 11-digit number starting with 09.",
    );
    contactInput.focus();
    return false;
  }
  return true;
}
function saveProfileChanges() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  const saveBtn = document.getElementById("profileSaveBtn");
  if (!card || !contactInput || !specializationInput) {
    return;
  }
  if (!validateProfileFields()) {
    return;
  }
  const contact = contactInput.value.trim();
  const specialization = specializationInput.value.trim();
  const doctor = getDoctorData();
  const updatedDoctor = {
    ...doctor,
    contact,
    specialization,
  };
  if (!saveDoctorData(updatedDoctor)) {
    return;
  }
  populateProfileModal(updatedDoctor);
  updateSidebarProfile(updatedDoctor);
  card.classList.remove("editing");
  if (saveBtn) {
    saveBtn.disabled = true;
    setTimeout(() => {
      saveBtn.disabled = false;
    }, 300);
  }
  showProfileSaveSuccess();
}
function showProfileSaveSuccess() {
  const successEl = document.getElementById("profileSaveSuccess");
  if (!successEl) {
    return;
  }
  if (profileSuccessTimeout) {
    clearTimeout(profileSuccessTimeout);
  }
  successEl.classList.add("show");
  profileSuccessTimeout = setTimeout(() => {
    successEl.classList.remove("show");
    profileSuccessTimeout = null;
  }, 2500);
}
function hideProfileSaveSuccess() {
  const successEl = document.getElementById("profileSaveSuccess");
  if (profileSuccessTimeout) {
    clearTimeout(profileSuccessTimeout);
    profileSuccessTimeout = null;
  }
  if (successEl) {
    successEl.classList.remove("show");
  }
}
function initProfileLogic() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  if (backdrop.dataset.initialized === "true") {
    return;
  }
  backdrop.dataset.initialized = "true";
  const closeBtn = document.getElementById("profileModalClose");
  const editBtn = document.getElementById("profileEditBtn");
  const cancelBtn = document.getElementById("profileCancelBtn");
  const saveBtn = document.getElementById("profileSaveBtn");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  const doctor = getDoctorData();
  populateProfileModal(doctor);
  updateSidebarProfile(doctor);
  closeBtn?.addEventListener("click", closeProfileModal);
  editBtn?.addEventListener("click", startProfileEditing);
  cancelBtn?.addEventListener("click", cancelProfileEditing);
  saveBtn?.addEventListener("click", saveProfileChanges);
  specializationInput?.addEventListener("input", () => {
    specializationInput.value = specializationInput.value
      .replace(/\s+/g, " ")
      .replace(/^\s+/, "");
  });
  contactInput?.addEventListener("input", () => {
    contactInput.value = contactInput.value.replace(/\D/g, "").slice(0, 11);
    const contactError = document.getElementById("profileModalContactError");
    if (validateContact(contactInput.value.trim())) {
      clearFieldError(contactInput, contactError);
    }
  });
  contactInput?.addEventListener("blur", () => {
    const contact = contactInput.value.trim();
    const contactError = document.getElementById("profileModalContactError");
    if (!contact) {
      return;
    }
    if (!validateContact(contact)) {
      showFieldError(
        contactInput,
        contactError,
        "Use a valid 11-digit number starting with 09.",
      );
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeProfileModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && backdrop.classList.contains("active")) {
      closeProfileModal();
    }
  });
  const imageEl = document.getElementById("profileModalImage");
  imageEl?.addEventListener("error", () => {
    const initialsEl = document.getElementById("profileModalInitials");
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    if (initialsEl) {
      initialsEl.textContent = getDoctorInitials(getDoctorData().name);
      initialsEl.style.display = "flex";
    }
  });
}
window.addEventListener("open-doctor-profile", () => {
  openProfileModal();
});
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.getDoctorData = getDoctorData;
window.getDoctorId = getDoctorId;
