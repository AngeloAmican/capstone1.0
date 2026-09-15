document.addEventListener("DOMContentLoaded", () => {
  const navToggleBtn = document.getElementById("navToggleBtn");
  const navMenuWrapper = document.getElementById("navMenuWrapper");
  const navOverlay = document.getElementById("navOverlay");
  const pageBlurWrapper = document.getElementById("pageBlurWrapper");
  const navToggleIcon = document.getElementById("navToggleIcon");
  const navBrand = document.getElementById("navBrand");
  const homeNavbar = document.getElementById("homeNavbar");

  function toggleMobileMenu() {
    const isOpen = navMenuWrapper.classList.toggle("mobile-open");

    if (navOverlay) {
      navOverlay.classList.toggle("active", isOpen);
    }

    if (pageBlurWrapper) {
      pageBlurWrapper.classList.toggle("is-blurred", isOpen);
    }

    if (navBrand) {
      navBrand.classList.toggle("hidden", isOpen);
    }

    if (homeNavbar) {
      homeNavbar.classList.toggle("nav-active-bg", isOpen);
    }

    if (navToggleIcon) {
      navToggleIcon.className = isOpen
        ? "fa-solid fa-xmark"
        : "fa-solid fa-bars";
    }
  }

  if (navToggleBtn) {
    navToggleBtn.addEventListener("click", toggleMobileMenu);
  }

  if (navOverlay) {
    navOverlay.addEventListener("click", toggleMobileMenu);
  }

  const mobileLinks = document.querySelectorAll(".nav-links a");

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navMenuWrapper.classList.contains("mobile-open")) {
        toggleMobileMenu();
      }
    });
  });

  const openLoginBtn = document.getElementById("openLoginBtn");
  const openAppointmentBtn = document.getElementById("openAppointmentBtn");
  const openAppointmentSectionBtn = document.getElementById(
    "openAppointmentSectionBtn",
  );
  const loginModalOverlay = document.getElementById("loginModalOverlay");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  function openLoginModal(event) {
    event.preventDefault();

    if (loginModalOverlay) {
      loginModalOverlay.classList.add("active");
    }
  }

  if (openLoginBtn && loginModalOverlay) {
    openLoginBtn.addEventListener("click", openLoginModal);
  }

  if (openAppointmentBtn && loginModalOverlay) {
    openAppointmentBtn.addEventListener("click", openLoginModal);
  }

  if (openAppointmentSectionBtn && loginModalOverlay) {
    openAppointmentSectionBtn.addEventListener("click", openLoginModal);
  }

  if (modalCloseBtn && loginModalOverlay) {
    modalCloseBtn.addEventListener("click", () => {
      loginModalOverlay.classList.remove("active");
    });
  }

  if (loginModalOverlay) {
    loginModalOverlay.addEventListener("click", (event) => {
      if (event.target === loginModalOverlay) {
        loginModalOverlay.classList.remove("active");
      }
    });
  }

  const heroSlides = document.querySelectorAll(".hero-slide");
  let currentHeroSlide = 0;
  let heroSlideInterval;

  function showHeroSlide(index) {
    if (!heroSlides.length) {
      return;
    }

    if (index < 0 || index >= heroSlides.length) {
      index = 0;
    }

    heroSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });

    currentHeroSlide = index;
  }

  function startHeroSlider() {
    clearInterval(heroSlideInterval);

    if (heroSlides.length > 1) {
      heroSlideInterval = setInterval(() => {
        const nextSlide = (currentHeroSlide + 1) % heroSlides.length;
        showHeroSlide(nextSlide);
      }, 4500);
    }
  }

  if (heroSlides.length > 0) {
    showHeroSlide(0);
    startHeroSlider();
  }
});
