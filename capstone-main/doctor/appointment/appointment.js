const APPOINTMENTS_STORAGE_KEY = "appointments";
const LEGACY_STORAGE_KEY = "dentanueva_appointments";
const DOCTORS_STORAGE_KEY = "dentanueva_doctors";
const RESCHEDULE_REQUESTS_STORAGE_KEY = "dentanueva_reschedule_requests";
const START_HOUR = 10;
const END_HOUR = 20;
const SLOT_MIN = 30;
const APPOINTMENT_STATUS = {
  SCHEDULED: "scheduled",
  IN_CONSULTATION: "in_consultation",
  READY_COMPLETE: "ready_complete",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
};
let appointments = [];
let currentCalendarDate = new Date();
let selectedDate = new Date();
let selectedAppointmentId = null;
let statusActionTargetId = null;
let statusActionType = null;
let toastTimer = null;
let currentDoctorDentistId = null;
let currentDoctor = null;
document.addEventListener("DOMContentLoaded", () => {
  initializeCurrentDoctor();
  initializeDate();
  loadAppointments();
  setupEvents();
  updateAutomaticAppointmentStatuses();
  renderAll();
  setInterval(() => {
    loadAppointments();
    const changed = updateAutomaticAppointmentStatuses();
    if (changed) {
      renderAll();
    } else {
      renderCalendar();
      renderTimeline();
      renderWaitingQueue();
    }
  }, 1000);
});
function getCurrentUser() {
  const storedUser = sessionStorage.getItem("currentUser");
  if (!storedUser) {
    return null;
  }
  try {
    const user = JSON.parse(storedUser);
    if (user && typeof user === "object") {
      return user;
    }
    return null;
  } catch (error) {
    console.error("Unable to read current user:", error);
    return null;
  }
}
function getStoredDoctors() {
  try {
    const stored = localStorage.getItem(DOCTORS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((user) => {
      if (!user || typeof user !== "object") {
        return false;
      }
      const role = String(user.role || user.userRole || user.accountType || "")
        .trim()
        .toLowerCase();
      const doctorId = String(
        user.doctorId ||
          user.doctor_id ||
          user.doctorID ||
          user.dentistId ||
          user.dentist_id ||
          user.dentistID ||
          "",
      ).trim();
      return role === "doctor" || Boolean(doctorId);
    });
  } catch (error) {
    console.error("Unable to load doctor accounts:", error);
    return [];
  }
}
function getDoctorIdFromUser(user) {
  if (!user || typeof user !== "object") {
    return "";
  }
  return String(
    user.dentistId ||
      user.dentist_id ||
      user.dentistID ||
      user.doctorId ||
      user.doctor_id ||
      user.doctorID ||
      "",
  )
    .trim()
    .toLowerCase();
}
function getDoctorNameFromUser(user) {
  if (!user || typeof user !== "object") {
    return "";
  }
  const firstName = user.firstname || user.firstName || "";
  const lastName = user.lastname || user.lastName || "";
  return String(
    user.name ||
      user.fullName ||
      user.full_name ||
      user.fullname ||
      `${firstName} ${lastName}`.trim() ||
      "",
  ).trim();
}
function normalizeDoctorName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^doctor\s+/i, "")
    .replace(/^dr\.\s*/i, "")
    .replace(/^dr\s+/i, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function findDoctorAccount(currentUser) {
  if (!currentUser) {
    return null;
  }
  const doctors = getStoredDoctors();
  const currentDoctorId = getDoctorIdFromUser(currentUser);
  if (currentDoctorId) {
    const byDoctorId = doctors.find((doctor) => {
      return getDoctorIdFromUser(doctor) === currentDoctorId;
    });
    if (byDoctorId) {
      return byDoctorId;
    }
  }
  const currentUserId = String(
    currentUser.id || currentUser.userId || currentUser.user_id || "",
  )
    .trim()
    .toLowerCase();
  if (currentUserId) {
    const byUserId = doctors.find((doctor) => {
      const doctorUserId = String(
        doctor.id || doctor.userId || doctor.user_id || "",
      )
        .trim()
        .toLowerCase();
      return doctorUserId === currentUserId;
    });
    if (byUserId) {
      return byUserId;
    }
  }
  const currentEmail = String(currentUser.email || "")
    .trim()
    .toLowerCase();
  if (currentEmail) {
    const byEmail = doctors.find((doctor) => {
      const doctorEmail = String(doctor.email || "")
        .trim()
        .toLowerCase();
      return doctorEmail === currentEmail;
    });
    if (byEmail) {
      return byEmail;
    }
  }
  const currentName = normalizeDoctorName(getDoctorNameFromUser(currentUser));
  if (currentName) {
    const byName = doctors.find((doctor) => {
      return normalizeDoctorName(getDoctorNameFromUser(doctor)) === currentName;
    });
    if (byName) {
      return byName;
    }
  }
  return null;
}
function registerCurrentDoctor() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return;
  }
  const doctorId = getDoctorIdFromUser(currentUser);
  if (!doctorId) {
    return;
  }
  const doctorName = getDoctorNameFromUser(currentUser);
  if (!doctorName) {
    return;
  }
  const specialization = String(
    currentUser.specialization ||
      currentUser.specialty ||
      currentUser.speciality ||
      currentUser.department ||
      "Dental Care",
  ).trim();
  let doctors = [];
  try {
    const stored = localStorage.getItem(DOCTORS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        doctors = parsed;
      }
    }
  } catch (error) {
    console.error("Unable to read doctor registry:", error);
    doctors = [];
  }
  const doctorRecord = {
    ...currentUser,
    doctorId:
      currentUser.doctorId ||
      currentUser.doctor_id ||
      currentUser.doctorID ||
      doctorId,
    dentistId:
      currentUser.dentistId ||
      currentUser.dentist_id ||
      currentUser.dentistID ||
      doctorId,
    name: doctorName,
    fullName: currentUser.fullName || currentUser.full_name || doctorName,
    specialization,
    role: "doctor",
  };
  const existingIndex = doctors.findIndex((doctor) => {
    return getDoctorIdFromUser(doctor) === doctorId;
  });
  if (existingIndex === -1) {
    doctors.push(doctorRecord);
  } else {
    doctors[existingIndex] = {
      ...doctors[existingIndex],
      ...doctorRecord,
    };
  }
  localStorage.setItem(DOCTORS_STORAGE_KEY, JSON.stringify(doctors));
}
function getCurrentDoctorDentistId() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return null;
  }
  const currentUserDoctorId = getDoctorIdFromUser(currentUser);
  if (currentUserDoctorId) {
    return currentUserDoctorId;
  }
  const doctorAccount = findDoctorAccount(currentUser);
  if (doctorAccount) {
    const doctorId = getDoctorIdFromUser(doctorAccount);
    if (doctorId) {
      return doctorId;
    }
  }
  return null;
}
function initializeCurrentDoctor() {
  const currentUser = getCurrentUser();
  registerCurrentDoctor();
  const doctorAccount = findDoctorAccount(currentUser);
  currentDoctor = doctorAccount || currentUser;
  currentDoctorDentistId = getCurrentDoctorDentistId();
}
function getDoctorIdentityValues(doctor) {
  if (!doctor || typeof doctor !== "object") {
    return [];
  }
  const values = [
    doctor.doctorId,
    doctor.doctor_id,
    doctor.doctorID,
    doctor.dentistId,
    doctor.dentist_id,
    doctor.dentistID,
    doctor.id,
    doctor.userId,
    doctor.user_id,
    doctor.username,
    doctor.email,
    doctor.name,
    doctor.fullName,
    doctor.full_name,
    doctor.fullname,
    getDoctorNameFromUser(doctor),
  ];
  return values
    .filter(
      (value) => value !== null && value !== undefined && String(value).trim(),
    )
    .map((value) => String(value).trim().toLowerCase());
}
function resolveAppointmentDoctorId(value, appointment = null) {
  const doctors = getStoredDoctors();
  const original = String(value || "").trim();
  const normalizedOriginal = original.toLowerCase();
  if (!original && appointment) {
    const appointmentDoctorId = String(
      appointment.doctorId ||
        appointment.doctor_id ||
        appointment.doctorID ||
        appointment.dentistId ||
        appointment.dentist_id ||
        appointment.dentistID ||
        "",
    ).trim();
    if (appointmentDoctorId) {
      return appointmentDoctorId.toLowerCase();
    }
  }
  if (!original && !appointment) {
    return "";
  }
  const directDoctor = doctors.find((doctor) => {
    const identities = getDoctorIdentityValues(doctor);
    return identities.includes(normalizedOriginal);
  });
  if (directDoctor) {
    return getDoctorIdFromUser(directDoctor);
  }
  const normalizedName = normalizeDoctorName(original);
  if (normalizedName) {
    const doctorByName = doctors.find((doctor) => {
      return (
        normalizeDoctorName(getDoctorNameFromUser(doctor)) === normalizedName
      );
    });
    if (doctorByName) {
      return getDoctorIdFromUser(doctorByName);
    }
  }
  return normalizedOriginal;
}
function getDoctorDisplayName(doctorId) {
  const doctors = getStoredDoctors();
  const normalizedId = String(doctorId || "")
    .trim()
    .toLowerCase();
  if (!normalizedId) {
    return "Unassigned";
  }
  const doctor = doctors.find((item) => {
    return getDoctorIdFromUser(item) === normalizedId;
  });
  if (doctor) {
    const name = getDoctorNameFromUser(doctor);
    if (name) {
      return /^dr\./i.test(name) ? name : `Dr. ${name}`;
    }
  }
  return "Unassigned";
}
function initializeDate() {
  const today = new Date();
  selectedDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  currentCalendarDate = new Date(selectedDate);
}
function setupEvents() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderTimeline();
      renderWaitingQueue();
    });
  }
}
function loadAppointments() {
  let stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
  if (!stored) {
    stored = localStorage.getItem(LEGACY_STORAGE_KEY);
  }
  if (!stored) {
    appointments = [];
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      appointments = parsed.map(normalizeAppointment);
    } else {
      appointments = [];
    }
  } catch (error) {
    console.error("Unable to load patient appointments:", error);
    appointments = [];
  }
}
function saveAppointmentsToStorage() {
  localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
}
function normalizeAppointment(appt) {
  const appointmentDoctorId = resolveAppointmentDoctorId(
    appt.dentist ||
      appt.dentistId ||
      appt.dentist_id ||
      appt.dentistID ||
      appt.doctorId ||
      appt.doctor_id ||
      appt.doctorID ||
      appt.doctor ||
      appt.doctorName ||
      "",
    appt,
  );
  const normalized = {
    id:
      appt.id || `appt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    patient: appt.patient || appt.patientName || "Unknown Patient",
    patientId: appt.patientId || appt.patient_id || "",
    date: appt.date || appt.appointment_date || appt.appointmentDate || "",
    start:
      appt.start ||
      appt.time ||
      appt.appointment_time ||
      appt.appointmentTime ||
      "10:00",
    type:
      appt.type ||
      appt.service ||
      appt.service_type ||
      appt.serviceType ||
      "Consultation",
    dentist: appointmentDoctorId,
    dentistId: appointmentDoctorId,
    dentist_id: appointmentDoctorId,
    duration:
      Number(appt.duration) || getDefaultDuration(appt.type || appt.service),
    status: appt.status || APPOINTMENT_STATUS.SCHEDULED,
  };
  if (!Number.isFinite(normalized.duration) || normalized.duration <= 0) {
    normalized.duration = 30;
  }
  const validStatuses = Object.values(APPOINTMENT_STATUS);
  if (!validStatuses.includes(normalized.status)) {
    normalized.status = APPOINTMENT_STATUS.SCHEDULED;
  }
  return normalized;
}
function getDefaultDuration(service) {
  const durations = {
    Consultation: 30,
    "Dental Cleaning": 45,
    "Tooth Filling / Pasta": 45,
    "Tooth Extraction": 60,
    "Root Canal": 90,
    "Braces Adjustment": 30,
  };
  return durations[service] || 30;
}
function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function keyToDate(key) {
  const parts = key.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}
function isToday(dateOrKey) {
  const today = new Date();
  const todayKey = dateToKey(today);
  const key = typeof dateOrKey === "string" ? dateOrKey : dateToKey(dateOrKey);
  return key === todayKey;
}
function isPastDate(dateOrKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date =
    typeof dateOrKey === "string" ? keyToDate(dateOrKey) : new Date(dateOrKey);
  date.setHours(0, 0, 0, 0);
  return date < today;
}
function timeToMinutes(time) {
  if (!time) {
    return 0;
  }
  const parts = time.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return hours * 60 + minutes;
}
function minutesToTime(totalMinutes) {
  totalMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return (
    String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0")
  );
}
function fmtTime(time) {
  const minutes = timeToMinutes(time);
  let hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }
  return `${hours}:${String(mins).padStart(2, "0")} ${suffix}`;
}
function formatDateLong(dateKey) {
  const date = keyToDate(dateKey);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function getAppointmentEnd(appt) {
  const start = timeToMinutes(appt.start);
  const duration = Number(appt.duration) || 30;
  return start + duration;
}
function getAppointmentEndTime(appt) {
  return minutesToTime(getAppointmentEnd(appt));
}
function updateAutomaticAppointmentStatuses() {
  const now = new Date();
  const todayKey = dateToKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let changed = false;
  appointments.forEach((appt) => {
    if (appt.date !== todayKey) {
      return;
    }
    if (appt.status !== APPOINTMENT_STATUS.IN_CONSULTATION) {
      return;
    }
    const appointmentEnd = getAppointmentEnd(appt);
    if (currentMinutes >= appointmentEnd) {
      appt.status = APPOINTMENT_STATUS.READY_COMPLETE;
      changed = true;
    }
  });
  if (changed) {
    saveAppointmentsToStorage();
  }
  return changed;
}
function getStatusLabel(status) {
  switch (status) {
    case APPOINTMENT_STATUS.SCHEDULED:
      return "Scheduled";
    case APPOINTMENT_STATUS.CANCELLED:
      return "Cancelled";
    case APPOINTMENT_STATUS.IN_CONSULTATION:
      return "In Consultation";
    case APPOINTMENT_STATUS.READY_COMPLETE:
      return "Ready to Complete";
    case APPOINTMENT_STATUS.COMPLETED:
      return "Completed";
    case APPOINTMENT_STATUS.NO_SHOW:
      return "No Show";
    default:
      return "Scheduled";
  }
}
function filteredAppts() {
  const doctorDentistId = String(currentDoctorDentistId || "")
    .trim()
    .toLowerCase();
  if (!doctorDentistId) {
    return [];
  }
  const selectedDateKey = dateToKey(selectedDate);
  const searchInput = document.getElementById("searchInput");
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
  let filtered = appointments.filter((appt) => {
    const appointmentDoctorId = String(
      appt.dentist || appt.dentistId || appt.dentist_id || "",
    )
      .trim()
      .toLowerCase();
    if (appointmentDoctorId !== doctorDentistId) return false;
    if (appt.status !== APPOINTMENT_STATUS.CANCELLED) return true;
    return !appointments.some((replacement) => {
      if (replacement.id === appt.id) return false;
      if (replacement.date !== appt.date) return false;
      if (replacement.status === APPOINTMENT_STATUS.CANCELLED) return false;
      const replacementDoctorId = String(
        replacement.dentist ||
          replacement.dentistId ||
          replacement.dentist_id ||
          "",
      )
        .trim()
        .toLowerCase();
      if (replacementDoctorId !== doctorDentistId) return false;
      const cancelledStart = timeToMinutes(appt.start);
      const replacementStart = timeToMinutes(replacement.start);
      const cancelledEnd = cancelledStart + Number(appt.duration || 30);
      const replacementEnd =
        replacementStart + Number(replacement.duration || 30);
      return replacementStart < cancelledEnd && replacementEnd > cancelledStart;
    });
  });
  filtered = filtered.filter((appt) => {
    return appt.date === selectedDateKey;
  });
  if (searchTerm) {
    filtered = filtered.filter((appt) => {
      const patientName = String(appt.patient || "")
        .trim()
        .toLowerCase();
      const serviceType = String(appt.type || "")
        .trim()
        .toLowerCase();
      return (
        patientName.includes(searchTerm) || serviceType.includes(searchTerm)
      );
    });
  }
  filtered.sort((a, b) => {
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });
  return filtered;
}
function renderAll() {
  loadAppointments();
  updateAutomaticAppointmentStatuses();
  renderCalendar();
  renderTimeline();
  renderWaitingQueue();
}
function renderCalendar() {
  const grid = document.getElementById("calGrid");
  const label = document.getElementById("calMonthLabel");
  if (!grid || !label) {
    return;
  }
  grid.innerHTML = "";
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  label.textContent = currentCalendarDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdays.forEach((day) => {
    const element = document.createElement("div");
    element.className = "dow";
    element.textContent = day;
    grid.appendChild(element);
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    grid.appendChild(makeDayBtn(date, true));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    grid.appendChild(makeDayBtn(date, false));
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = 42 - totalCells;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day);
    grid.appendChild(makeDayBtn(date, true));
  }
}
function makeDayBtn(date, muted) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "day";
  const key = dateToKey(date);
  if (muted) {
    button.classList.add("muted");
  }
  if (dateToKey(selectedDate) === key) {
    button.classList.add("selected");
  }
  if (isToday(date)) {
    button.classList.add("today");
  }
  const hasAppointment = appointments.some((appt) => {
    const appointmentDoctorId = String(
      appt.dentist || appt.dentistId || appt.dentist_id || "",
    )
      .trim()
      .toLowerCase();
    const doctorDentistId = String(currentDoctorDentistId || "")
      .trim()
      .toLowerCase();
    return appt.date === key && appointmentDoctorId === doctorDentistId;
  });
  if (hasAppointment) {
    button.classList.add("has-appt");
  }
  button.textContent = date.getDate();
  button.addEventListener("click", () => {
    selectedDate = new Date(date);
    renderAll();
  });
  return button;
}
function shiftMonth(offset) {
  currentCalendarDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + offset,
    1,
  );
  renderCalendar();
}
function renderTimeline() {
  const timeline = document.getElementById("timeline");
  const title = document.getElementById("scheduleTitle");
  const dateLabel = document.getElementById("scheduleDateLabel");
  const count = document.getElementById("appointmentCount");
  const headerCount = document.getElementById("headerAppointmentCount");
  if (!timeline) {
    return;
  }
  timeline.innerHTML = "";
  const selectedKey = dateToKey(selectedDate);
  const selectedIsToday = isToday(selectedKey);
  const selectedIsPast = isPastDate(selectedKey);
  if (title) {
    title.textContent = selectedIsToday
      ? "Today's Appointments"
      : selectedIsPast
        ? "Appointment History"
        : "Upcoming Appointments";
  }
  if (dateLabel) {
    dateLabel.textContent = formatDateLong(selectedKey);
  }
  const dayAppointments = filteredAppts();
  if (count) {
    count.textContent = dayAppointments.length;
  }
  if (headerCount) {
    headerCount.textContent = dayAppointments.length;
  }
  for (
    let minutes = START_HOUR * 60;
    minutes < END_HOUR * 60;
    minutes += SLOT_MIN
  ) {
    const row = document.createElement("div");
    row.className = "tl-row";
    const time = minutesToTime(minutes);
    const timeElement = document.createElement("div");
    timeElement.className = "tl-time";
    timeElement.textContent = fmtTime(time);
    const slot = document.createElement("div");
    slot.className = "tl-slot";
    const activeAppointments = dayAppointments.filter((appt) => {
      const start = timeToMinutes(appt.start);
      const end = getAppointmentEnd(appt);
      return minutes >= start && minutes < end;
    });
    if (activeAppointments.length) {
      activeAppointments.forEach((appt) => {
        const appointmentStart = timeToMinutes(appt.start);
        if (appointmentStart === minutes) {
          slot.appendChild(createAppointmentCard(appt));
        } else {
          const occupied = document.createElement("div");
          occupied.className = "no-appointment";
          occupied.innerHTML = `
              <i class="fa-solid fa-clock"></i>
              Appointment continues
              · ${fmtTime(appt.start)}
              – ${fmtTime(getAppointmentEndTime(appt))}
            `;
          slot.appendChild(occupied);
        }
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-slot";
      if (selectedIsPast) {
        empty.innerHTML = `
          <i class="fa-solid fa-clock-rotate-left"></i>
          No appointment recorded
        `;
      } else {
        empty.innerHTML = `
          <i class="fa-regular fa-calendar"></i>
          No patient appointment
        `;
      }
      slot.appendChild(empty);
    }
    row.appendChild(timeElement);
    row.appendChild(slot);
    timeline.appendChild(row);
  }
}
function loadRescheduleRequests() {
  try {
    const stored = localStorage.getItem(RESCHEDULE_REQUESTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to load reschedule requests:", error);
    return [];
  }
}
function getPendingRescheduleRequestForAppointment(appointmentId) {
  return (
    loadRescheduleRequests().find(
      (request) =>
        String(request?.appointment_id || request?.appointmentId || "") ===
          String(appointmentId) &&
        String(request?.status || "")
          .trim()
          .toLowerCase() === "pending",
    ) || null
  );
}
function createAppointmentCard(appt) {
  const card = document.createElement("div");
  card.className = "appt-card";
  const initials = getInitials(appt.patient);
  const endTime = getAppointmentEndTime(appt);
  const pendingRescheduleRequest = getPendingRescheduleRequestForAppointment(
    appt.id,
  );
  const info = document.createElement("div");
  info.style.display = "flex";
  info.style.alignItems = "center";
  info.style.flex = "1";
  info.style.minWidth = "0";
  info.innerHTML = `
    <div class="patient-avatar">
      ${initials}
    </div>
    <div class="appt-info">
      <div class="pname">
        ${escapeHtml(appt.patient)}
      </div>
      <div class="ptype">
        ${escapeHtml(appt.type)}
      </div>
      ${pendingRescheduleRequest ? `<div class="appointment-reschedule-request"><span><i class="fa-solid fa-calendar-days"></i> Reschedule Requested</span></div>` : ""}
    </div>
  `;
  const time = document.createElement("div");
  time.className = "appt-time-range";
  time.textContent = `${fmtTime(appt.start)}
     – ${fmtTime(endTime)}`;
  const statusArea = createAppointmentStatusButton(appt);
  card.appendChild(info);
  card.appendChild(time);
  card.appendChild(statusArea);
  card.addEventListener("click", () => {
    openViewModal(appt.id);
  });
  return card;
}
function renderWaitingQueue() {
  const list = document.getElementById("waitingQueueList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const selectedKey = dateToKey(selectedDate);
  const queue = filteredAppts();
  if (!queue.length) {
    const empty = document.createElement("div");
    empty.className = "empty-queue";
    if (isPastDate(selectedKey)) {
      empty.textContent = "No appointment records for this date.";
    } else {
      empty.textContent = "No patient appointments.";
    }
    list.appendChild(empty);
    return;
  }
  queue.forEach((appt) => {
    const item = document.createElement("div");
    item.className = "queue-item";
    const initials = getInitials(appt.patient);
    const end = getAppointmentEndTime(appt);
    const pendingRescheduleRequest = getPendingRescheduleRequestForAppointment(
      appt.id,
    );
    item.innerHTML = `
        <div class="queue-main">
          <div class="queue-avatar">
            ${initials}
          </div>
          <div class="queue-text">
            <span class="queue-name">
              ${escapeHtml(appt.patient)}
            </span>
            <span class="queue-time">
              ${fmtTime(appt.start)}
              –
              ${fmtTime(end)}
            </span>
            ${pendingRescheduleRequest ? `<span class="queue-reschedule-request"><i class="fa-solid fa-calendar-days"></i> Reschedule Requested</span>` : ""}
          </div>
        </div>
        <div class="queue-type${pendingRescheduleRequest ? " pending" : ""}">
          ${escapeHtml(appt.type)}${pendingRescheduleRequest ? " · Pending" : ""}
        </div>
      `;
    item.addEventListener("click", () => {
      openViewModal(appt.id);
    });
    list.appendChild(item);
  });
}
function openViewModal(id) {
  const appt = appointments.find((item) => String(item.id) === String(id));
  if (!appt) {
    return;
  }
  const appointmentDentist = String(
    appt.dentist || appt.dentistId || appt.dentist_id || "",
  )
    .trim()
    .toLowerCase();
  const doctorDentistId = String(currentDoctorDentistId || "")
    .trim()
    .toLowerCase();
  if (!doctorDentistId || appointmentDentist !== doctorDentistId) {
    console.warn("Access denied: appointment belongs to another doctor.", {
      appointmentId: appt.id,
      appointmentDoctorId: appointmentDentist,
      currentDoctor: doctorDentistId,
    });
    return;
  }
  selectedAppointmentId = appt.id;
  sessionStorage.setItem(
    "doctorSelectedPatientId",
    String(appt.patientId || appt.patient_id || ""),
  );
  document.getElementById("modalTitle").textContent = "Appointment Details";
  document.getElementById("modalSubtitle").textContent =
    `${formatDateLong(appt.date)}
     · ${fmtTime(appt.start)}
     – ${fmtTime(getAppointmentEndTime(appt))}`;
  document.getElementById("f_patient").value = appt.patient;
  sessionStorage.setItem(
    "doctorSelectedPatientId",
    String(appt.patientId || appt.patient_id || ""),
  );
  const patientRecordButton = document.getElementById("viewPatientRecordBtn");
  if (patientRecordButton) {
    patientRecordButton.onclick = () => {
      const patientId = appt.patientId || appt.patient_id || "";
      if (!patientId) {
        console.warn("This appointment has no patient ID.", appt);
        return;
      }
      sessionStorage.setItem("doctorSelectedPatientId", String(patientId));
      window.location.href = "../patient/patient.html";
    };
  }
  document.getElementById("f_date").value = appt.date;
  document.getElementById("f_time").value = appt.start;
  document.getElementById("f_type").value = appt.type;
  document.getElementById("f_duration").value = appt.duration;
  const status = document.getElementById("modalStatus");
  if (status) {
    status.className = "modal-status";
    if (appt.status === APPOINTMENT_STATUS.IN_CONSULTATION) {
      status.classList.add("in-consultation");
    }
    if (appt.status === APPOINTMENT_STATUS.READY_COMPLETE) {
      status.classList.add("ready-complete");
    }
    if (appt.status === APPOINTMENT_STATUS.COMPLETED) {
      status.classList.add("completed");
    }
    status.textContent = getStatusLabel(appt.status);
  }
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.classList.add("show");
  }
}
function closeModal() {
  document.getElementById("overlay").classList.remove("show");
  selectedAppointmentId = null;
}
function createAppointmentStatusButton(appt) {
  const wrapper = document.createElement("div");
  wrapper.className = "appt-status-area";
  if (appt.status === APPOINTMENT_STATUS.SCHEDULED) {
    if (!isToday(appt.date)) {
      const badge = document.createElement("span");
      badge.className = "appt-status-badge scheduled";
      badge.textContent = "Scheduled";
      wrapper.appendChild(badge);
      return wrapper;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "appt-status-btn status-checkin";
    button.innerHTML = '<i class="fa-solid fa-user-check"></i> Check In';
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      checkInAppointment(appt.id);
    });
    wrapper.appendChild(button);

    const noShowButton = document.createElement("button");
    noShowButton.type = "button";
    noShowButton.className = "appt-status-btn status-noshow";
    noShowButton.innerHTML = '<i class="fa-solid fa-user-slash"></i> No Show';
    noShowButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openStatusConfirmation(appt.id, "markNoShow");
    });
    wrapper.appendChild(noShowButton);
    return wrapper;
  }
  if (appt.status === APPOINTMENT_STATUS.IN_CONSULTATION) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "appt-status-btn status-consultation";
    button.innerHTML = '<i class="fa-solid fa-tooth"></i> In Consultation';
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openStatusConfirmation(appt.id, "finishConsultation");
    });
    wrapper.appendChild(button);
    return wrapper;
  }
  if (appt.status === APPOINTMENT_STATUS.READY_COMPLETE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "appt-status-btn status-complete";
    button.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete';
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openStatusConfirmation(appt.id, "completeAppointment");
    });
    wrapper.appendChild(button);
    return wrapper;
  }
  if (appt.status === APPOINTMENT_STATUS.COMPLETED) {
    const badge = document.createElement("span");
    badge.className = "appt-status-btn status-completed";
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Completed';
    wrapper.appendChild(badge);
    return wrapper;
  }
  if (appt.status === APPOINTMENT_STATUS.NO_SHOW) {
    const badge = document.createElement("span");
    badge.className = "appt-status-badge no-show";
    badge.textContent = "No Show";
    wrapper.appendChild(badge);
    return wrapper;
  }
  if (appt.status === APPOINTMENT_STATUS.CANCELLED) {
    const badge = document.createElement("span");
    badge.className = "appt-status-badge cancelled";
    badge.textContent = "Cancelled";
    wrapper.appendChild(badge);
    return wrapper;
  }
  return wrapper;
}
function checkInAppointment(id) {
  const appt = appointments.find((item) => String(item.id) === String(id));
  if (!appt) {
    return;
  }
  const appointmentDentist = String(
    appt.dentist || appt.dentistId || appt.dentist_id || "",
  )
    .trim()
    .toLowerCase();
  const doctorDentistId = String(currentDoctorDentistId || "")
    .trim()
    .toLowerCase();
  if (!doctorDentistId || appointmentDentist !== doctorDentistId) {
    console.warn("Check In blocked: appointment belongs to another doctor.", {
      appointmentId: appt.id,
      appointmentDoctorId: appointmentDentist,
      currentDoctor: doctorDentistId,
    });
    return;
  }
  if (appt.status !== APPOINTMENT_STATUS.SCHEDULED || !isToday(appt.date)) {
    return;
  }
  appt.status = APPOINTMENT_STATUS.IN_CONSULTATION;
  saveAppointmentsToStorage();
  renderAll();
  showToast(`${appt.patient} has been checked in.`);
}
function openStatusConfirmation(id, actionType) {
  const appt = appointments.find((item) => String(item.id) === String(id));
  if (!appt) {
    return;
  }
  statusActionTargetId = id;
  statusActionType = actionType;
  const overlay = document.getElementById("statusConfirmOverlay");
  const title = document.getElementById("statusConfirmTitle");
  const message = document.getElementById("statusConfirmMessage");
  const button = document.getElementById("statusConfirmButton");
  const icon = document.getElementById("statusConfirmIcon");
  if (actionType === "finishConsultation") {
    title.textContent = "Finish Consultation?";
    message.textContent = `Are you sure you want to finish ${appt.patient}'s consultation?`;
    button.textContent = "Yes, Finish";
    icon.innerHTML = '<i class="fa-solid fa-stethoscope"></i>';
  }
  if (actionType === "completeAppointment") {
    title.textContent = "Complete Appointment?";
    message.textContent = `Are you sure you want to mark ${appt.patient}'s appointment as completed?`;
    button.textContent = "Yes, Complete";
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  }
  if (actionType === "markNoShow") {
    title.textContent = "Mark as No Show?";
    message.textContent = `${appt.patient}'s appointment was not checked in on the scheduled date. Marking this as No Show will close the appointment as missed.`;
    button.textContent = "Yes, Mark No Show";
    icon.innerHTML = '<i class="fa-solid fa-user-slash"></i>';
  }
  overlay.classList.add("show");
}
function closeStatusConfirmation() {
  statusActionTargetId = null;
  statusActionType = null;
  document.getElementById("statusConfirmOverlay").classList.remove("show");
}
function confirmStatusAction() {
  if (!statusActionTargetId || !statusActionType) {
    return;
  }
  const appt = appointments.find(
    (item) => String(item.id) === String(statusActionTargetId),
  );
  if (!appt) {
    closeStatusConfirmation();
    return;
  }
  const appointmentDentist = String(
    appt.dentist || appt.dentistId || appt.dentist_id || "",
  )
    .trim()
    .toLowerCase();
  const doctorDentistId = String(currentDoctorDentistId || "")
    .trim()
    .toLowerCase();
  if (!doctorDentistId || appointmentDentist !== doctorDentistId) {
    console.warn(
      "Status action blocked: appointment belongs to another doctor.",
      {
        appointmentId: appt.id,
        appointmentDoctorId: appointmentDentist,
        currentDoctor: doctorDentistId,
        action: statusActionType,
      },
    );
    closeStatusConfirmation();
    return;
  }
  if (statusActionType === "finishConsultation") {
    if (appt.status !== APPOINTMENT_STATUS.IN_CONSULTATION) {
      closeStatusConfirmation();
      return;
    }
    appt.status = APPOINTMENT_STATUS.READY_COMPLETE;
    saveAppointmentsToStorage();
    closeStatusConfirmation();
    renderAll();
    showToast(`${appt.patient}'s consultation is finished.`);
    return;
  }
  if (statusActionType === "completeAppointment") {
    if (appt.status !== APPOINTMENT_STATUS.READY_COMPLETE) {
      closeStatusConfirmation();
      return;
    }
    appt.status = APPOINTMENT_STATUS.COMPLETED;
    saveAppointmentsToStorage();
    closeStatusConfirmation();
    renderAll();
    showToast(`${appt.patient}'s appointment is now completed.`);
    return;
  }
  if (statusActionType === "markNoShow") {
    if (appt.status !== APPOINTMENT_STATUS.SCHEDULED || !isToday(appt.date)) {
      closeStatusConfirmation();
      return;
    }
    appt.status = APPOINTMENT_STATUS.NO_SHOW;
    saveAppointmentsToStorage();
    closeStatusConfirmation();
    renderAll();
    showToast(`${appt.patient} has been marked as No Show.`);
  }
}
function getInitials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
document.addEventListener("click", (event) => {
  const overlay = document.getElementById("overlay");
  const statusOverlay = document.getElementById("statusConfirmOverlay");
  if (event.target === overlay) {
    closeModal();
  }
  if (event.target === statusOverlay) {
    closeStatusConfirmation();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  const statusOverlay = document.getElementById("statusConfirmOverlay");
  if (statusOverlay.classList.contains("show")) {
    closeStatusConfirmation();
    return;
  }
  closeModal();
});