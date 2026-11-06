"use client";

import React, { useState, useEffect, useRef } from "react";

// Tipos
interface Milestone {
  id: string;
  tabLabel: string;
  badge: string;
  subBadge: string;
  title: string;
  description: React.ReactNode;
  roleBox: React.ReactNode;
  tags: string[];
  imageSrc: string;
  imageAlt: string;
}

// Datos Estáticos
const NAV_ITEMS = [
  { id: "experience", label: "Experience" },
  { id: "competitions", label: "Leadership & GSC" },
  { id: "certifications", label: "Certifications" },
  { id: "skills", label: "Skills Matrix" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const MILESTONES: Milestone[] = [
  {
    id: "gsc",
    tabLabel: "GSC Competition",
    badge: "CASE COMPETITION",
    subBadge: "UNM Anderson School",
    title: "6th Annual Global Scaling Challenge (GSC)",
    description: (
      <>
        Engineered market expansion and scaling frameworks for{" "}
        <strong className="text-slate-800">Mesa Quantum</strong>, a deep-tech venture pioneering chip-scale quantum sensors designed to ensure reliable navigation in GPS-denied environments.
      </>
    ),
    roleBox: (
      <>
        <strong className="text-slate-800">Role: Team Lead &amp; Strategy Analyst</strong>
        <br />
        <span className="text-slate-500">Florida Institute of Technology &bull; Case Competition</span>
      </>
    ),
    tags: ["#GlobalScalingChallenge", "#FloridaTech", "#Leadership", "#DeepTech"],
    imageSrc: "/assets/gsc-competition.jpg",
    imageAlt: "Global Scaling Challenge Team",
  },
  {
    id: "bisk",
    tabLabel: "Bisk Business Connect",
    badge: "PROFESSIONAL MENTORSHIP",
    subBadge: "Bisk College of Business",
    title: "Bisk College Business Connect Workshop",
    description: (
      <>
        Active participant and leadership facilitator at the Business Connect Student Mentoring Workshop, exchanging strategies with executives from Fortune 500 corporations (Apple, Microsoft, Blue Origin) on career readiness and rapid tech industry integration.
      </>
    ),
    roleBox: (
      <>
        <strong className="text-slate-800">Event: Bisk College Presents Business Connect</strong>
        <br />
        <span className="text-slate-500">Florida Institute of Technology &bull; Executive Mentorship</span>
      </>
    ),
    tags: ["#BiskCollege", "#FloridaTech", "#Mentorship", "#CareerReadiness"],
    imageSrc: "/assets/bisk-connect.jpg",
    imageAlt: "Bisk College Business Connect Workshop",
  },
  {
    id: "leadership",
    tabLabel: "Student Leadership",
    badge: "CAMPUS INITIATIVE",
    subBadge: "Florida Tech RSO",
    title: "Student Community Director & Campus Leadership",
    description: (
      <>
        Serving as <strong className="text-slate-800">Student Community Director</strong> and Co-Founder, directing organizational growth, student community outreach, and structural operations at Florida Tech. Successfully spearheaded formal recommendation for <strong className="text-slate-800">Registered Student Organization (RSO)</strong> status to foster peer collaboration, career integration, and technical workshops.
      </>
    ),
    roleBox: (
      <>
        <strong className="text-slate-800">Role: Student Community Director &amp; Co-Founder</strong>
        <br />
        <span className="text-slate-500">Florida Institute of Technology &bull; Community Growth &amp; Engagement</span>
      </>
    ),
    tags: ["#StudentCommunityDirector", "#FloridaTech", "#Leadership", "#RSO"],
    imageSrc: "/assets/student-leadership.jpg",
    imageAlt: "Student Community Director & Campus Leadership",
  },
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState("experience");

  const isManualScroll = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados del Modal de Contacto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessView, setIsSuccessView] = useState(false);
  const [dispatchSeq, setDispatchSeq] = useState(0); // Reiniciado a 0

  // Estado del formulario vacio por defecto
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    title: "",
    message: "",
  });

  const [validationError, setValidationError] = useState<{ show: boolean; heading: string; message: string }>({
    show: false,
    heading: "",
    message: "",
  });

  const [emailValidationStatus, setEmailValidationStatus] = useState<"valid" | "invalid" | "empty">("empty");

  const [payloadSummary, setPayloadSummary] = useState({
    sender: "",
    title: "",
    timestamp: "",
    seqId: "#00000",
    hexId: "0x0000",
    binId: "0b00000000",
    rowIndex: "Row #00001",
  });

  // Bloqueo estricto del scroll del fondo cuando el modal esta activo
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  // IntersectionObserver para navegacion fluida
  useEffect(() => {
    setMounted(true);

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: "-25% 0px -65% 0px",
      threshold: 0,
    };

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      if (isManualScroll.current) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);
    const sections = ["experience", "competitions", "certifications", "skills"];

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    isManualScroll.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScroll.current = false;
    }, 850);
  };

  // Funciones del Modal de Contacto
  const openContactModal = () => {
    setIsModalOpen(true);
    setIsSuccessView(false);
    setValidationError({ show: false, heading: "", message: "" });
  };

  const closeContactModal = () => {
    setIsModalOpen(false);
  };

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, email: val }));

    if (val.trim() === "") {
      setEmailValidationStatus("empty");
      return;
    }

    if (EMAIL_REGEX.test(val.trim())) {
      setEmailValidationStatus("valid");
    } else {
      setEmailValidationStatus("invalid");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const missingFields: string[] = [];
    if (!formData.name.trim()) missingFields.push("Your Name");
    if (!formData.email.trim()) missingFields.push("Your Email");
    if (!formData.title.trim()) missingFields.push("Title of the Message");
    if (!formData.message.trim()) missingFields.push("Description of the Message");

    const isEmailValid = EMAIL_REGEX.test(formData.email.trim());

    if (missingFields.length > 0 || !isEmailValid) {
      if (!isEmailValid && missingFields.length > 0) {
        setValidationError({
          show: true,
          heading: "Please correct the following errors:",
          message: `Missing required field(s): ${missingFields.join(", ")}. Invalid email format.`,
        });
      } else if (!isEmailValid) {
        setValidationError({
          show: true,
          heading: "Invalid Email Format:",
          message: "Please enter a valid email address (e.g. name@example.com).",
        });
      } else {
        setValidationError({
          show: true,
          heading: "Field(s) missing:",
          message: `Please fill out: ${missingFields.join(", ")} before sending your message.`,
        });
      }
      return;
    }

    setValidationError({ show: false, heading: "", message: "" });
    setIsSubmitting(true);

    const paddedDec = `#${String(dispatchSeq).padStart(5, "0")}`;
    const hexVal = `0x${dispatchSeq.toString(16).toUpperCase().padStart(4, "0")}`;
    const binVal = `0b${dispatchSeq.toString(2).padStart(8, "0")}`;
    const rowIdx = `Cataloged at Row #${String(dispatchSeq + 1).padStart(5, "0")}`;
    const now = new Date();
    const timeStr = `${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

    setPayloadSummary({
      sender: `${formData.name} <${formData.email}>`,
      title: formData.title,
      timestamp: timeStr,
      seqId: paddedDec,
      hexId: `Hex: ${hexVal}`,
      binId: binVal,
      rowIndex: rowIdx,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccessView(true);

      const mailtoUrl = `mailto:aleglacayo03@gmail.com?subject=${encodeURIComponent(
        formData.title
      )}&body=${encodeURIComponent(`From: ${formData.name} (${formData.email})\n\nMessage:\n${formData.message}`)}`;
      
      try {
        window.open(mailtoUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        window.location.href = mailtoUrl;
      }
    }, 900);
  };

  const handleSendAnother = () => {
    setDispatchSeq((prev) => prev + 1);
    setIsSuccessView(false);
    setFormData({
      name: "",
      email: "",
      title: "",
      message: "",
    });
    setEmailValidationStatus("empty");
    setValidationError({ show: false, heading: "", message: "" });
  };

  const totalSlides = MILESTONES.length;
  const activeMilestone = MILESTONES[currentSlide];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);

  // Deslizar con el dedo en el carrusel (teléfonos)
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX < 0) nextSlide();
    else prevSlide();
  };

  return (
    <div className="bg-[#f8f9ff] text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white min-h-screen">
      
      {/* Estilos CSS Auxiliares */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }

        @keyframes floatFlame {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.85; }
          50% { transform: translateY(-18px) scale(1.18) rotate(6deg); opacity: 0.85; }
          100% { transform: translateY(-38px) scale(0.55) rotate(-8deg); opacity: 0; }
        }

        .flame-particle {
          display: none;
          position: absolute;
          border-radius: 50% 50% 20% 20%;
          pointer-events: none;
          filter: blur(4px);
          opacity: 0;
        }

        .portrait-wrapper:hover .flame-particle {
          display: block;
          opacity: 0.85;
          animation: floatFlame 1.8s infinite ease-out;
        }

        @keyframes lightSweep {
          0% { transform: translateX(-180%) skewX(-25deg); opacity: 0; }
          5% { opacity: 1; }
          35% { transform: translateX(320%) skewX(-25deg); opacity: 1; }
          36%, 100% { transform: translateX(320%) skewX(-25deg); opacity: 0; }
        }

        .light-dash-beam {
          position: absolute;
          top: -60%; bottom: -60%; width: 180px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.04) 20%,
            rgba(255, 255, 255, 0.28) 50%,
            rgba(255, 255, 255, 0.04) 80%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: lightSweep 8s infinite ease-in-out;
          pointer-events: none;
          z-index: 5;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">

          <a
            href="https://github.com/alejandrojosegomez"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 sm:gap-3 group min-w-0"
            title="Ir a mi Perfil de GitHub (alejandrojosegomez)"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200/80 shadow-sm group-hover:scale-105 group-hover:border-blue-500 transition-all bg-slate-100 flex-shrink-0">
              <img
                src="/assets/elgato-icon.jpg"
                alt="Alejandro Gomez GitHub Cat Icon"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-1.5 group-hover:text-blue-700 transition whitespace-nowrap">
                Alejandro Gómez
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-wide uppercase truncate">Information Systems B.S.</div>
            </div>
          </a>

          {/* Navegación fluida */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60 shadow-inner">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative inline-flex items-center justify-center rounded-full p-[1.5px] transition-transform duration-200 active:scale-95 cursor-pointer overflow-hidden ${
                    isActive ? "shadow-sm" : "bg-transparent"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-[-150%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_270deg,#2563eb_320deg,#60a5fa_345deg,transparent_360deg)] pointer-events-none" />
                  )}
                  
                  <span
                    className={`relative z-10 px-4 py-1.5 text-xs transition-colors duration-200 rounded-full ${
                      isActive
                        ? "bg-white text-blue-900 font-bold"
                        : "text-slate-700 hover:text-blue-800 hover:bg-white/70 font-semibold"
                    }`}
                  >
                    {item.label}
                  </span>
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <a href="https://linkedin.com/in/alejandro-josegomez" target="_blank" rel="noopener noreferrer" className="p-2 sm:p-2.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition" title="LinkedIn" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
            <a href="/CV_Alejandro_Gomez.pdf" target="_blank" aria-label="View CV" className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2 border border-blue-200 text-blue-800 bg-blue-50/50 hover:bg-blue-100/60 font-semibold text-xs rounded-lg transition shadow-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="hidden sm:inline">View CV</span>
            </a>
            <button
              onClick={openContactModal}
              aria-label="Contact Me"
              className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2 bg-[#3443c7] hover:bg-[#2b36a8] text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">Contact Me</span>
            </button>
          </div>
        </div>

        {/* Navegación móvil (solo teléfonos y tablets) */}
        <nav className="md:hidden border-t border-slate-200/70 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 px-4 py-2 w-max">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`whitespace-nowrap px-3.5 py-1.5 text-xs rounded-full border transition-colors active:scale-95 ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white font-bold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 font-semibold"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16 sm:space-y-24">

        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pt-2 sm:pt-4">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              <span>Melbourne, FL, USA &bull; Open to Full-Stack &amp; IS Roles</span>
            </div>

            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Alejandro Gómez
              </h1>
              <p className="text-lg sm:text-2xl font-semibold text-blue-700 mt-2">
                Information Systems B.S. <span className="hidden sm:inline text-slate-300 font-light mx-2">|</span> <span className="block sm:inline text-slate-700">Junior Full-Stack Developer &amp; Systems Analyst</span>
              </p>
            </div>

            <p className="text-slate-600 text-base leading-relaxed max-w-2xl">
              Information Systems B.S. student at <strong className="text-slate-900 font-semibold">Florida Tech</strong> (GPA 3.81, Dean's List) with enterprise background in full-stack software development, banking transaction workflows, and business process optimization. Aspiring M.S. in Cybersecurity.
            </p>

            {/* Contact Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a href="mailto:aleglacayo03@gmail.com" className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl shadow-sm hover:shadow-md transition group">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="truncate min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</span>
                  <span className="font-semibold text-xs sm:text-sm text-slate-800">aleglacayo03@gmail.com</span>
                </div>
              </a>

              <a href="tel:3216558177" className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl shadow-sm hover:shadow-md transition group">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</span>
                  <span className="font-semibold text-xs sm:text-sm text-slate-800">(321) 655-8177</span>
                </div>
              </a>

              <a href="https://linkedin.com/in/alejandro-josegomez" target="_blank" rel="noopener noreferrer" className="sm:col-span-2 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl shadow-sm hover:shadow-md transition group">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </div>
                <div className="truncate min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">LinkedIn Profile</span>
                  <span className="font-semibold text-xs sm:text-sm text-blue-800">linkedin.com/in/alejandro-josegomez</span>
                </div>
              </a>
            </div>
          </div>

          {/* Portrait Container */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative portrait-wrapper group cursor-pointer">
              {mounted && (
                <>
                  <div className="flame-particle w-12 h-16 bg-gradient-to-t from-sky-400 to-blue-600 -top-4 left-6" style={{ animationDelay: "0.1s" }}></div>
                  <div className="flame-particle w-14 h-20 bg-gradient-to-t from-cyan-300 to-sky-500 -top-6 left-1/3" style={{ animationDelay: "0.4s" }}></div>
                  <div className="flame-particle w-12 h-16 bg-gradient-to-t from-blue-400 to-indigo-600 -top-4 right-10" style={{ animationDelay: "0.2s" }}></div>
                  <div className="flame-particle w-10 h-14 bg-gradient-to-t from-sky-400 to-blue-500 top-1/4 -right-3" style={{ animationDelay: "0.7s" }}></div>
                  <div className="flame-particle w-10 h-14 bg-gradient-to-t from-cyan-400 to-blue-600 top-1/4 -left-3" style={{ animationDelay: "0.5s" }}></div>
                </>
              )}

              <div className="absolute -inset-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition duration-700 group-hover:duration-200"></div>

              <div className="relative w-64 sm:w-80 h-[22rem] sm:h-[26rem] rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-slate-100">
                <img 
                  src="/assets/alejandro-portrait.jpg" 
                  alt="Alejandro Gómez Portrait" 
                  className="w-full h-full object-cover object-top transition duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          </div>
        </section>

        {/* WORK EXPERIENCE SECTION */}
        <section id="experience" className="scroll-mt-36 md:scroll-mt-28 space-y-6 pt-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-blue-700 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Career Progression &amp; Verified Records
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Work Experience</h2>
          </div>

          <div className="space-y-4">
            {/* Experience Card 1 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm hover:shadow-md transition">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Junior Full-Stack Developer</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Current Role</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">Okhten Group LLC <span className="text-slate-400 font-normal">&bull; Miami, FL (Hybrid)</span></p>
                </div>
                <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
                  May 2026 – Present
                </div>
              </div>
              <div className="mt-4 space-y-2 text-slate-600 text-sm leading-relaxed">
                <p>Spearheading full-stack software development initiatives and operational integrations utilizing modern C# architectural paradigms, managed file transfer platforms, and service workflow engineering.</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1">
                  <li>Engineered full-stack features and API connectors implementing <strong className="text-slate-800">C#</strong> enterprise backend services.</li>
                  <li>Configured and managed secure transaction automation utilizing <strong className="text-slate-800">MFT (GoAnywhere)</strong> protocols.</li>
                  <li>Collaborated within agile sprint cycles, resolution workflows, and ticket lifecycle tracking via <strong className="text-slate-800">Jira Service Management</strong>.</li>
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 pt-2">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">C#</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">MFT (GoAnywhere)</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">Jira Service Management</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">Full-Stack Development</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">API Integration</span>
              </div>
            </div>

            {/* Experience Card 2 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm hover:shadow-md transition">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Programmer Analyst Intern</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">International Work Experience</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">Grupo LAFISE <span className="text-slate-400 font-normal">&bull; Managua, Nicaragua</span></p>
                </div>
                <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
                  May 2026 – Aug 2026
                </div>
              </div>
              <div className="mt-4 space-y-2 text-slate-600 text-sm leading-relaxed">
                <p>Introduced to critical banking workflows within <strong className="text-slate-800">BancaNet</strong>, SWIFT code verification pipelines, legal entity classification systems, and financial transaction lifecycles spanning core banking modules: <strong className="text-slate-800">MTI, STI, SP, and D2B</strong>.</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1">
                  <li>Audited and verified transactions using <strong className="text-slate-800">WinSCP, MFT (GoAnywhere), Host2Host, NoSQL, Postman API, and H2HAdmin</strong>.</li>
                  <li>Executed manual and automated SQL validations against databases via <strong className="text-slate-800">DBeaver / SSMS</strong>.</li>
                  <li>Ensured international financial data accuracy, regulatory compliance, and transaction throughput adhering to <strong className="text-slate-800">ISO20022</strong> standards across Azure DevOps sprints.</li>
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 pt-2">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">SWIFT / ISO20022</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">BancaNet</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">MFT (GoAnywhere)</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">Host2Host</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">DBeaver / SSMS</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">Postman API</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">Azure DevOps</span>
              </div>
            </div>
          </div>
        </section>

        {/* MILESTONES & LEADERSHIP CAROUSEL SECTION */}
        <section id="competitions" className="scroll-mt-36 md:scroll-mt-28 space-y-6 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold tracking-widest text-blue-700 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                MILESTONES &amp; FLORIDA TECH LEADERSHIP
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Collegiate Competitions &amp; Leadership</h2>
            </div>

            {/* Carousel Controls */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex flex-1 sm:flex-none items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {MILESTONES.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSlide(idx)}
                    className={`whitespace-nowrap px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                      currentSlide === idx
                        ? "bg-blue-600 text-white shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.tabLabel}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={prevSlide}
                  className="p-2 bg-white border border-slate-200 hover:border-blue-500 rounded-lg text-slate-700 hover:text-blue-800 shadow-sm transition cursor-pointer"
                  aria-label="Previous slide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  onClick={nextSlide}
                  className="p-2 bg-white border border-slate-200 hover:border-blue-500 rounded-lg text-slate-700 hover:text-blue-800 shadow-sm transition cursor-pointer"
                  aria-label="Next slide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Locked Card Container */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-8 shadow-sm overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div key={activeMilestone.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-6 w-full">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                  <img 
                    src={activeMilestone.imageSrc}
                    alt={activeMilestone.imageAlt} 
                    className="w-full h-full object-cover transition-all duration-500" 
                  />
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                    {activeMilestone.badge}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {activeMilestone.subBadge}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {activeMilestone.title}
                </h3>

                <p className="text-slate-600 text-sm leading-relaxed">
                  {activeMilestone.description}
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                  {activeMilestone.roleBox}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {activeMilestone.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* CERTIFICATIONS SECTION */}
        <section id="certifications" className="scroll-mt-36 md:scroll-mt-28 space-y-6 pt-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-blue-700 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Verified Credentials
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Licenses &amp; Certifications</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-700 group-hover:text-white transition duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-4 group-hover:text-blue-800 transition">Lean Six Sigma Black Belt</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Six Sigma Academy Amsterdam</p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Issued May 2026 &bull; DMAIC methodology, KPI analysis, regression modeling, and workflow standardization.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: f55c2496-e439-40ed</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">✓ Verified</span>
              </div>
            </div>

            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-700 group-hover:text-white transition duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-4 group-hover:text-blue-800 transition">[PCEP-30-02] PCEP™</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">OpenEDG Python Institute</p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Certified Entry-Level Python Programmer. Algorithm structure, modules, package handling, and core semantics.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: 063390d7-7555-4567</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">✓ Verified</span>
              </div>
            </div>

            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-700 group-hover:text-white transition duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7c0 1.657-3.582 3-8 3S4 8.657 4 7m16 0c0-1.657-3.582-3-8-3S4 5.343 4 7m16 0v5c0 1.657-3.582 3-8 3s-8-1.343-8-3V7m16 5v5c0 1.657-3.582 3-8 3s-8-1.343-8-3v-5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-4 group-hover:text-blue-800 transition">[L4-DE] Data Engineering</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">KNIME Analytics</p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Issued Jan 2026 &bull; Specialization in ETL/ELT pipelines, data governance, workflow switches, and loops.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Enterprise Workflow</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">✓ Verified</span>
              </div>
            </div>
          </div>
        </section>

        {/* SKILLS MATRIX SECTION */}
        <section id="skills" className="scroll-mt-36 md:scroll-mt-28 space-y-6 pt-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-blue-700 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Technical Competence
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Verified Skills Matrix</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Systems &amp; Enterprise</h3>
                  <p className="text-[11px] text-slate-400 font-medium">FinTech &amp; Protocols</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>SWIFT / ISO20022 Compliance</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>BancaNet Architecture &amp; H2H</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>MFT (GoAnywhere) File Transfer</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>DBeaver &amp; SSMS SQL Validation</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Postman RESTful API Testing</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>WinSCP &amp; Azure DevOps CI/CD</li>
              </ul>
            </div>

            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 022 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Programming &amp; Data</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Full-Stack &amp; ETL</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>C# (.NET Services &amp; Architecture)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Python (PCEP Certified / Data Scripts)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Java, C++, &amp; Object Oriented Design</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>SQL, PostgreSQL, &amp; NoSQL</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>KNIME Analytics (ETL/ELT Workflows)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>HTML5, Tailwind CSS, Modern Web</li>
              </ul>
            </div>

            <div className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-[0_0_35px_rgba(37,99,235,0.25)] hover:border-blue-500 transition-all duration-300">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Operational Excellence</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Six Sigma &amp; Efficiency</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>DMAIC Cycle Execution</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Value Stream Mapping (VSM)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>SIPOC Diagrams &amp; Process Flows</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>KPI Definition &amp; Regression Analysis</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Standard Operating Procedures (SOP)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Bilingual (English / Spanish - Fluent)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section id="contact" className="relative rounded-3xl bg-slate-950 text-white p-6 sm:p-10 md:p-14 overflow-hidden shadow-2xl border border-blue-900/50">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="light-dash-beam"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-xs font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>Available for Hire &amp; Collaboration</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Seeking a developer with rigorous systems training?
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                Open to Junior Full-Stack Developer, Systems Analyst, and Data Engineering opportunities in Melbourne, FL, Miami, or remote. Feel free to download my complete resume or dispatch a message.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-3">
              <button
                onClick={openContactModal}
                className="w-full text-center py-3.5 px-6 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg transition cursor-pointer active:scale-95"
              >
                Dispatch Message
              </button>
              <a href="/CV_Alejandro_Gomez.pdf" target="_blank" className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#3443c7] hover:bg-[#2b36a8] text-white font-bold text-sm shadow-lg transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Preview Official Resume
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="mt-16 sm:mt-20 border-t border-slate-200/80 bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center lg:text-left">
          <div>
            <strong className="text-slate-800 font-semibold">Alejandro Gómez</strong> &bull; Information Systems B.S., Florida Institute of Technology
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#experience" className="hover:text-blue-800 transition">Experience</a>
            <a href="#competitions" className="hover:text-blue-800 transition">Leadership</a>
            <a href="#certifications" className="hover:text-blue-800 transition">Certifications</a>
            <a href="#skills" className="hover:text-blue-800 transition">Skills Matrix</a>
            <a href="https://github.com/alejandrojosegomez" target="_blank" className="hover:text-blue-800 transition">GitHub</a>
            <a href="https://linkedin.com/in/alejandro-josegomez" target="_blank" className="hover:text-blue-800 transition">LinkedIn</a>
          </div>
          <div>
            &copy; 2026 Alejandro Gómez &bull; All systems nominal
          </div>
        </div>
      </footer>

      {/* MODAL INTERACTIVO DE CONTACTO */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
          onClick={closeContactModal}
        >
          <div
            className="relative z-[100000] w-full max-w-[540px] bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ opacity: 1, visibility: 'visible' }}
          >
            {/* Header del Modal */}
            <header className="shrink-0 bg-[#3443c7] px-5 sm:px-6 py-3.5 text-white flex items-center justify-between relative shadow-sm rounded-t-[24px]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-60"></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-white/30 ${isSuccessView ? 'bg-emerald-400' : 'bg-[#6f82ff]'}`}></span>
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  {isSuccessView ? "Message Dispatched" : "Send a Message to Alejandro"}
                </h2>
              </div>
              <button
                onClick={closeContactModal}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition-all focus:outline-none"
                aria-label="Close dialog"
              >
                <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
            </header>

            {/* VISTA 1: FORMULARIO */}
            {!isSuccessView ? (
              <div className="p-4 sm:p-5 bg-white rounded-b-[24px]">
                <form onSubmit={handleFormSubmit} className="space-y-3" noValidate>
                  
                  {/* Fila Nombre y Correo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Campo: YOUR NAME */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="user-name">
                        YOUR NAME <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        id="user-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Alejandro Gomez"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 font-medium text-base sm:text-sm focus:bg-white focus:border-[#3443c7] focus:ring-2 focus:ring-[#3443c7]/20 transition-all outline-none"
                      />
                    </div>

                    {/* Campo: YOUR EMAIL */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="user-email">
                          YOUR EMAIL <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span className="text-[9px] text-slate-400 font-medium">Autofill enabled</span>
                      </div>
                      
                      <div className="relative flex items-center">
                        <input
                          id="user-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={formData.email}
                          onChange={handleEmailInputChange}
                          placeholder="e.g. name@example.com"
                          className={`w-full pl-3 pr-16 py-2 rounded-xl border font-medium text-base sm:text-sm focus:bg-white focus:ring-2 transition-all outline-none ${
                            emailValidationStatus === "invalid"
                              ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/10 text-slate-800"
                              : emailValidationStatus === "valid"
                              ? "border-[#3443c7] ring-2 ring-[#3443c7]/20 bg-white text-slate-800"
                              : "border-slate-200 bg-slate-50/50 text-slate-800"
                          }`}
                        />

                        {/* Insignia de Estado de Email */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                          {emailValidationStatus === "valid" && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 shadow-xs">
                              <svg className="w-3 h-3 stroke-[2.5] text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                              <span className="text-[9px] font-semibold text-emerald-700">Valid</span>
                            </div>
                          )}
                          {emailValidationStatus === "invalid" && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 border border-red-300 text-red-700 shadow-xs">
                              <svg className="w-3 h-3 stroke-[2.5] text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                              <span className="text-[9px] font-semibold text-red-700">Invalid</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Campo: TITLE OF THE MESSAGE */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="user-title">
                      TITLE OF THE MESSAGE <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      id="user-title"
                      name="title"
                      type="text"
                      autoComplete="off"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. Collaboration / Job Opportunity"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 font-medium text-base sm:text-sm focus:bg-white focus:border-[#3443c7] focus:ring-2 focus:ring-[#3443c7]/20 transition-all outline-none"
                    />
                  </div>

                  {/* Campo: DESCRIPTION OF THE MESSAGE */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="user-message">
                        DESCRIPTION OF THE MESSAGE <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formData.message.length} / 800
                      </span>
                    </div>
                    <textarea
                      id="user-message"
                      name="message"
                      rows={3}
                      maxLength={800}
                      autoComplete="off"
                      required
                      value={formData.message}
                      onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="Write your message here..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 font-normal text-base sm:text-sm resize-none focus:bg-white focus:border-[#3443c7] focus:ring-2 focus:ring-[#3443c7]/20 transition-all outline-none leading-relaxed"
                    />
                  </div>

                  {/* Insignia de Target Slot */}
                  <div className="flex justify-end pt-0.5">
                    <div className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>Target Slot: <strong className="font-semibold text-indigo-700">#{String(dispatchSeq).padStart(5, '0')}</strong></span>
                    </div>
                  </div>

                  {/* Banner de Errores */}
                  {validationError.show && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-medium flex items-start gap-2 shadow-sm">
                      <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                      </svg>
                      <div>
                        <p className="font-semibold text-red-900 leading-tight">{validationError.heading}</p>
                        <p className="text-red-700 text-[10px] mt-0.5">{validationError.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Acciones de Pie de Formulario */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeContactModal}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="relative overflow-hidden inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#2b36a8] hover:bg-[#232b85] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-900/20 transition-all cursor-pointer group disabled:opacity-90"
                    >
                      {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-90" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor"></path>
                          </svg>
                          <span className="text-indigo-100 text-xs font-medium">Dispatching Seq #{String(dispatchSeq).padStart(5, '0')}...</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span>Submit Message</span>
                          <svg className="w-3.5 h-3.5 text-indigo-200 transition-transform duration-200 group-hover:translate-x-0.5 -rotate-45" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </span>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            ) : (
              /* VISTA 2: PANTALLA DE CONFIRMACIÓN EXITOSA */
              <div className="p-5 text-center bg-white flex flex-col items-center justify-center rounded-b-[24px]">
                
                {/* Animación de Éxito (check con burbujas) */}
                <div className="relative -my-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={payloadSummary.seqId}
                    src={`/assets/check_animation_bubbles.png?run=${encodeURIComponent(payloadSummary.seqId)}`}
                    alt="Message sent successfully"
                    width={300}
                    height={300}
                    className="w-32 h-32 sm:w-36 sm:h-36 select-none pointer-events-none"
                    draggable={false}
                  />
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 mt-0 mb-1.5 tracking-tight">
                  Message Sent Successfully!
                </h3>

                <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold shadow-xs">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    <span>Google Drive: Saved &amp; Encrypted</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold shadow-xs">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    <span>Email Forwarded to aleglacayo03@gmail.com</span>
                  </div>
                </div>

                <div className="w-full bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 mb-4 text-left text-[11px] font-mono text-slate-600 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 font-sans text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    <span>Dispatched Payload Summary</span>
                    <span className="text-emerald-600 font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Delivered
                    </span>
                  </div>

                  <div className="flex justify-between items-center gap-3 pt-0.5 pb-0.5 border-b border-dashed border-slate-200">
                    <span className="text-slate-400 shrink-0 font-sans text-[10px]">Dispatch Sequence ID:</span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="font-bold text-emerald-700 font-mono px-2 py-0.5 rounded bg-emerald-100/70 border border-emerald-300 text-[10px]">
                        {payloadSummary.seqId}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{payloadSummary.hexId}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-400 shrink-0">Sender:</span>
                    <span className="font-medium text-slate-800 truncate text-right">{payloadSummary.sender}</span>
                  </div>

                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-400 shrink-0">Subject:</span>
                    <span className="font-medium text-slate-800 truncate text-right">{payloadSummary.title}</span>
                  </div>

                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-400 shrink-0">Timestamp:</span>
                    <span className="font-medium text-slate-700 text-right">{payloadSummary.timestamp}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendAnother}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3443c7] hover:bg-[#2b36a8] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                  </svg>
                  <span>Send Another Message</span>
                </button>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}