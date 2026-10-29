/**
 * Motor Principal del Aplicativo CV Dinámico & Documentado
 * Desarrollado para Adders Mark Molina Huamani
 */

(function () {
  const STORAGE_KEY = "cv_dinamico_adders_molina_v2";

  // Estado Global
  let state = loadState();
  let activeTab = "perfil";
  let zoomLevel = 100;

  // Referencias del DOM
  const sidebarContent = document.getElementById("sidebarContent");
  const cvDocumentRoot = document.getElementById("cvDocumentRoot");
  const cvAnnexesRoot = document.getElementById("cvAnnexesRoot");
  const cvPrintWrapper = document.getElementById("cvPrintWrapper");
  const chkPreviewDocs = document.getElementById("chkPreviewDocs");
  const lblCountDocs = document.getElementById("lblCountDocs");
  const lblZoom = document.getElementById("lblZoom");
  const saveStatus = document.getElementById("saveStatus");

  // Métricas en vivo
  const metricExpTotal = document.getElementById("metricExpTotal");
  const metricHorasTotal = document.getElementById("metricHorasTotal");
  const metricDocsTotal = document.getElementById("metricDocsTotal");

  // Modal de Certificados
  const certModal = document.getElementById("certModal");
  const certModalTitle = document.getElementById("certModalTitle");
  const certModalSubtitle = document.getElementById("certModalSubtitle");
  const certModalBody = document.getElementById("certModalBody");

  // =========================================================================
  // 1. GESTIÓN DE ESTADO Y PERSISTENCIA
  // =========================================================================
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return deepMerge(structuredClone(window.DEFAULT_CV_DATA), parsed);
      }
    } catch (err) {
      console.warn("No se pudo leer localStorage, cargando datos por defecto:", err);
    }
    return structuredClone(window.DEFAULT_CV_DATA);
  }

  function saveState() {
    try {
      state.meta.lastUpdated = new Date().toISOString().slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (saveStatus) {
        saveStatus.innerHTML = `<span class="status-dot"></span> Guardado (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;
      }
    } catch (err) {
      console.error("Error guardando en localStorage:", err);
    }
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    for (const key of Object.keys(source)) {
      if (Array.isArray(source[key])) {
        target[key] = source[key];
      } else if (source[key] && typeof source[key] === "object" && key in target) {
        target[key] = deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================================================================
  // 2. CÁLCULO AUTOMÁTICO DE EXPERIENCIA Y HORAS LECTIVAS
  // =========================================================================
  function calculateExperienceStats() {
    const activeExp = state.experiencia.filter(item => item.visible);
    const activeSpecExp = activeExp.filter(item => item.esEspecifica);

    const calcDays = (list) => {
      let totalDays = 0;
      for (const item of list) {
        const declared = Number(item.diasDeclarados);
        if (!isNaN(declared) && declared > 0) {
          totalDays += declared;
        } else if (item.fechaInicio && item.fechaFin) {
          const d1 = new Date(item.fechaInicio);
          const d2 = new Date(item.fechaFin);
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
          if (diff > 0) totalDays += diff;
        }
      }
      return totalDays;
    };

    const formatDuration = (days) => {
      const years = Math.floor(days / 365);
      const remAfterYears = days % 365;
      const months = Math.floor(remAfterYears / 30);
      const remDays = remAfterYears % 30;
      const parts = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? "año" : "años"}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
      if (years === 0 && months === 0) parts.push(`${remDays} días`);
      return {
        days,
        years,
        months,
        remDays,
        shortText: parts.join(", ") || "0 meses",
        fullText: `${years}a ${months}m ${remDays}d (${days} días)`
      };
    };

    const general = formatDuration(calcDays(activeExp));
    const especifica = formatDuration(calcDays(activeSpecExp));

    const horasDiplomados = state.diplomados
      .filter(d => d.visible)
      .reduce((acc, cur) => acc + (Number(cur.horas) || 0), 0);

    const horasCursos = state.cursos
      .filter(c => c.visible)
      .reduce((acc, cur) => acc + (Number(cur.horas) || 0), 0);

    const activePages = collectActiveCertificatePages();

    return {
      general,
      especifica,
      horasDiplomados,
      horasCursos,
      horasTotales: horasDiplomados + horasCursos,
      totalActiveFolios: activePages.length,
      activePages
    };
  }

  function collectActiveCertificatePages() {
    const pages = [];
    const includeDividers = state.config.includeSectionDividers !== false;

    const addPages = (arr, dividerPage) => {
      const subPages = [];
      for (const item of arr) {
        if (item.visible && Array.isArray(item.paginasDoc)) {
          for (const p of item.paginasDoc) {
            const pNum = Number(p);
            if (!isNaN(pNum) && pNum >= 2 && pNum <= 55 && !subPages.includes(pNum)) {
              subPages.push(pNum);
            }
          }
        }
      }
      if (subPages.length > 0) {
        if (includeDividers && dividerPage) {
          pages.push({ page: dividerPage, label: "Carátula de Sección" });
        }
        for (const sp of subPages) {
          pages.push({ page: sp, label: `Folio Documentado (Pág. ${sp} del PDF original)` });
        }
      }
    };

    // Ordenar folios de formación según el PDF original
    const eduItems = state.formacion.filter(item => {
      if (!state.config.showSecondaryEducation && item.tipo === "secundaria") return false;
      return item.visible;
    });
    addPages(eduItems, state.caratulas?.formacion || 2);
    addPages(state.experiencia, state.caratulas?.experiencia || 8);
    addPages(state.diplomados, state.caratulas?.diplomados || 23);
    addPages(state.cursos, state.caratulas?.cursos || 35);
    addPages(state.adicionales || [], state.caratulas?.adicionales || 52);

    return pages;
  }

  // =========================================================================
  // 3. RENDERIZADO DEL VISOR DE CV EN TIEMPO REAL (PLANTILLAS 1 Y 2)
  // =========================================================================
  function updatePreview() {
    // Actualizar variables CSS dinámicas
    document.documentElement.style.setProperty("--cv-original-teal", state.config.primaryColor || "#83c5cb");
    document.documentElement.style.setProperty("--cv-executive-primary", state.config.executiveColor || "#0f4c5c");
    document.documentElement.style.setProperty("--cv-font-scale", (state.config.fontSizeScale || 100) / 100);

    // Sincronizar botones de plantilla en barra superior
    document.querySelectorAll(".tpl-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tpl === state.config.template);
    });

    // Sincronizar checkbox de documentos
    if (chkPreviewDocs) {
      chkPreviewDocs.checked = !!state.config.includeDocsInPrint;
    }

    const stats = calculateExperienceStats();

    // Actualizar barra de métricas en vivo
    if (metricExpTotal) metricExpTotal.textContent = `${stats.general.shortText} (${stats.general.days} d)`;
    if (metricHorasTotal) metricHorasTotal.textContent = `${stats.horasTotales} hrs lectivas`;
    if (metricDocsTotal) metricDocsTotal.textContent = `${stats.totalActiveFolios} págs.`;
    if (lblCountDocs) lblCountDocs.textContent = stats.totalActiveFolios;

    // Renderizar plantilla seleccionada
    if (state.config.template === "original") {
      cvDocumentRoot.innerHTML = renderOriginalTemplate(stats);
    } else {
      cvDocumentRoot.innerHTML = renderExecutiveTemplate(stats);
    }

    // Renderizar Anexos Documentados si está activado
    renderAnnexes(stats.activePages);
  }

  function renderFolioButton(paginasDoc, title) {
    if (!Array.isArray(paginasDoc) || paginasDoc.length === 0) return "";
    const pagesStr = paginasDoc.join(",");
    return `<button type="button" class="doc-folio-pill no-print" data-pages="${escapeHtml(pagesStr)}" data-title="${escapeHtml(title)}" title="Ver certificado/constancia escaneada">
      📄 Ver sustento (${paginasDoc.length > 1 ? `Págs. ${pagesStr}` : `Pág. ${pagesStr}`})
    </button>`;
  }

  // -------------------------------------------------------------------------
  // PLANTILLA 1: FIEL AL DISEÑO ACTUAL (PÁG. 1 DEL PDF ADJUNTO)
  // -------------------------------------------------------------------------
  function renderOriginalTemplate(stats) {
    const p = state.personal;
    const compBlandas = state.competencias.blandas.filter(c => c.visible);
    const midPoint = Math.ceil(compBlandas.length / 2);
    const col1Blandas = compBlandas.slice(0, midPoint);
    const col2Blandas = compBlandas.slice(midPoint);

    // En la página 1 original del PDF, la formación va cronológica (2008-2009 -> 2010-2012 -> 2015-2021)
    const eduItems = [...state.formacion]
      .filter(item => item.visible && (state.config.showSecondaryEducation || item.tipo !== "secundaria"))
      .reverse();

    const activeLogos = (state.logosEducacion || []).filter(l => l.visible);
    const activeExp = state.experiencia.filter(e => e.visible && (state.config.experienceFilter !== "especifica" || e.esEspecifica));
    const activeDip = state.diplomados.filter(d => d.visible);
    const activeCur = state.cursos.filter(c => c.visible);
    const activeAdi = (state.adicionales || []).filter(a => a.visible);

    return `
      <article class="a4-sheet tpl-original">
        <!-- CABECERA TURQUESA FIEL AL PDF -->
        <header class="orig-header-banner">
          <div class="orig-photo-box" style="${p.mostrarFoto ? "" : "visibility:hidden"}">
            <img src="${escapeHtml(p.foto)}" alt="Fotografía de ${escapeHtml(p.nombres)}" />
          </div>
          <div class="orig-title-block">
            <h1 class="orig-first-name">${escapeHtml(p.nombres)}</h1>
            <h2 class="orig-last-name">${escapeHtml(p.apellidos)}</h2>
            ${p.frase ? `<p class="orig-quote">${escapeHtml(p.frase)}</p>` : ""}
          </div>
          <div class="orig-contact-block">
            ${p.telefono ? `
              <div class="orig-contact-row">
                <span>${escapeHtml(p.telefono)}</span>
                <span class="orig-contact-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/></svg>
                </span>
              </div>` : ""}
            ${p.ubicacion ? `
              <div class="orig-contact-row">
                <span>${escapeHtml(p.ubicacion)}</span>
                <span class="orig-contact-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
                </span>
              </div>` : ""}
            ${p.email ? `
              <div class="orig-contact-row">
                <span>${escapeHtml(p.email)}</span>
                <span class="orig-contact-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                </span>
              </div>` : ""}
          </div>
        </header>

        <div class="orig-body">
          <!-- RESUMEN PROFESIONAL -->
          ${p.resumen ? `<p class="orig-summary">${escapeHtml(p.resumen)}</p>` : ""}

          <!-- COMPETENCIAS -->
          <div class="orig-section-heading">
            <span>COMPETENCIAS</span>
          </div>
          <div class="orig-competencias-grid">
            <ul class="orig-comp-list">
              ${col1Blandas.map(c => `<li>${escapeHtml(c.nombre)}</li>`).join("")}
            </ul>
            <ul class="orig-comp-list">
              ${col2Blandas.map(c => `<li>${escapeHtml(c.nombre)}</li>`).join("")}
            </ul>
            <div class="orig-software-col">
              <p><strong>Software:</strong> ${escapeHtml(state.competencias.softwareTexto)}</p>
              ${state.competencias.adicionalesTexto ? `<p><strong>Adicionales:</strong> ${escapeHtml(state.competencias.adicionalesTexto)}</p>` : ""}
            </div>
          </div>

          <!-- FORMACIÓN ACADÉMICA -->
          <div class="orig-section-heading">
            <span>FORMACIÓN ACADÉMICA</span>
          </div>
          <div class="orig-edu-list">
            ${eduItems.map(edu => `
              <div class="orig-edu-row">
                <div class="orig-edu-left">
                  <div class="orig-edu-years">${escapeHtml(edu.periodo)}</div>
                  <div class="orig-edu-loc">${escapeHtml(edu.ubicacion)}</div>
                </div>
                <div class="orig-edu-right">
                  <div class="orig-edu-title">
                    ${escapeHtml(edu.titulo)}
                    ${renderFolioButton(edu.paginasDoc, edu.titulo)}
                  </div>
                  <div class="orig-edu-inst">${escapeHtml(edu.institucion)}</div>
                  ${edu.destacado ? `<div class="orig-edu-highlight">${escapeHtml(edu.destacado)}</div>` : ""}
                  ${Array.isArray(edu.detalles) && edu.detalles.length > 0 ? `
                    <ul class="orig-edu-bullets">
                      ${edu.detalles.map(d => `<li>${escapeHtml(d)}</li>`).join("")}
                    </ul>
                  ` : ""}
                </div>
              </div>
            `).join("")}
          </div>

          <!-- LOGOS INSTITUCIONALES (PIE DE PÁGINA 1 FIEL AL PDF) -->
          ${state.config.showInstitutionLogos && activeLogos.length > 0 ? `
            <div class="orig-logos-strip">
              ${activeLogos.map(l => `<img class="orig-logo-item" src="${escapeHtml(l.imagen)}" alt="${escapeHtml(l.nombre)}" />`).join("")}
            </div>
          ` : ""}

          <!-- SECCIONES EXTENDIDAS EN ESTILO CLÁSICO (SI ESTÁN HABILITADAS) -->
          ${state.config.showExperienceInOriginal ? `
            ${activeExp.length > 0 ? `
              <div class="orig-extra-block">
                <div class="orig-section-heading">
                  <span>EXPERIENCIA PROFESIONAL Y LABORAL</span>
                  ${state.config.showExperienceSummaryBox ? `<span class="orig-section-subbadge">Acumulado Activo: ${escapeHtml(stats.general.shortText)} (${stats.general.days} días)</span>` : ""}
                </div>
                ${activeExp.map(exp => `
                  <div class="orig-exp-item">
                    <div class="orig-edu-left">
                      <div class="orig-edu-years">${escapeHtml(exp.periodoTexto)}</div>
                      <div class="orig-edu-loc">${escapeHtml(exp.ubicacion || "Lima, Perú")}</div>
                    </div>
                    <div class="orig-edu-right">
                      <div class="orig-edu-title">
                        ${escapeHtml(exp.cargoCorto || exp.cargo)}
                        ${renderFolioButton(exp.paginasDoc, exp.entidad)}
                      </div>
                      <div class="orig-edu-inst">${escapeHtml(exp.entidad)}</div>
                      <div class="orig-exp-meta">${escapeHtml(exp.documentoSustento)} ${exp.monto ? `• Monto: ${escapeHtml(exp.monto)}` : ""}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : ""}

            ${activeDip.length > 0 ? `
              <div class="orig-extra-block">
                <div class="orig-section-heading">
                  <span>DIPLOMADOS Y PROGRAMAS DE ESPECIALIZACIÓN</span>
                  ${state.config.showExperienceSummaryBox ? `<span class="orig-section-subbadge">${stats.horasDiplomados} horas lectivas</span>` : ""}
                </div>
                ${activeDip.map(dip => `
                  <div class="orig-exp-item">
                    <div class="orig-edu-left">
                      <div class="orig-edu-years">${escapeHtml(dip.horas)} Horas</div>
                      <div class="orig-edu-loc">${escapeHtml(dip.nota)}</div>
                    </div>
                    <div class="orig-edu-right">
                      <div class="orig-edu-title">
                        ${escapeHtml(dip.titulo)}
                        ${renderFolioButton(dip.paginasDoc, dip.titulo)}
                      </div>
                      <div class="orig-edu-inst">${escapeHtml(dip.institucion)} (${escapeHtml(dip.fecha)})</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : ""}

            ${activeCur.length > 0 ? `
              <div class="orig-extra-block">
                <div class="orig-section-heading">
                  <span>CURSOS, TALLERES Y CAPACITACIONES</span>
                  ${state.config.showExperienceSummaryBox ? `<span class="orig-section-subbadge">${stats.horasCursos} horas lectivas</span>` : ""}
                </div>
                ${activeCur.map(cur => `
                  <div class="orig-exp-item">
                    <div class="orig-edu-left">
                      <div class="orig-edu-years">${escapeHtml(cur.horas)} Horas</div>
                      <div class="orig-edu-loc">${escapeHtml(cur.fecha)}</div>
                    </div>
                    <div class="orig-edu-right">
                      <div class="orig-edu-title">
                        ${escapeHtml(cur.titulo)}
                        ${renderFolioButton(cur.paginasDoc, cur.titulo)}
                      </div>
                      <div class="orig-edu-inst">${escapeHtml(cur.institucion)} • ${escapeHtml(cur.nota)}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : ""}

            ${activeAdi.length > 0 ? `
              <div class="orig-extra-block">
                <div class="orig-section-heading">
                  <span>INFORMACIÓN ADICIONAL Y RECONOCIMIENTOS</span>
                </div>
                ${activeAdi.map(adi => `
                  <div class="orig-exp-item">
                    <div class="orig-edu-left">
                      <div class="orig-edu-years">${escapeHtml(adi.fecha)}</div>
                    </div>
                    <div class="orig-edu-right">
                      <div class="orig-edu-title">
                        ${escapeHtml(adi.titulo)}
                        ${renderFolioButton(adi.paginasDoc, adi.titulo)}
                      </div>
                      <div class="orig-edu-inst">${escapeHtml(adi.institucion)} — ${escapeHtml(adi.detalle)}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          ` : ""}
        </div>
      </article>
    `;
  }

  // -------------------------------------------------------------------------
  // PLANTILLA 2: PROPUESTA EJECUTIVA PRO / ATS (RECOMENDADA PARA CONVOCATORIAS)
  // -------------------------------------------------------------------------
  function renderExecutiveTemplate(stats) {
    const p = state.personal;
    const activeExp = state.experiencia.filter(e => e.visible && (state.config.experienceFilter !== "especifica" || e.esEspecifica));
    const activeEdu = state.formacion.filter(item => item.visible && (state.config.showSecondaryEducation || item.tipo !== "secundaria"));
    const activeDip = state.diplomados.filter(d => d.visible);
    const activeCur = state.cursos.filter(c => c.visible);
    const activeAdi = (state.adicionales || []).filter(a => a.visible);
    const activeSw = (state.competencias.softwareTags || []).filter(s => s.visible);
    const activeBlandas = state.competencias.blandas.filter(b => b.visible);

    return `
      <article class="a4-sheet tpl-ejecutivo">
        <!-- CABECERA EJECUTIVA -->
        <header class="exec-header ${p.mostrarFoto ? "with-photo" : ""}">
          ${p.mostrarFoto ? `
            <div class="exec-photo">
              <img src="${escapeHtml(p.foto)}" alt="Foto de ${escapeHtml(p.nombres)}" />
            </div>
          ` : ""}
          <div>
            <h1 class="exec-name">${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</h1>
            <div class="exec-role">${escapeHtml(p.tituloProfesional)}</div>
            ${p.frase ? `<div class="exec-quote">${escapeHtml(p.frase)}</div>` : ""}
            <div class="exec-contact-bar">
              ${p.dni ? `<span class="exec-contact-item">🪪 DNI: ${escapeHtml(p.dni)}</span>` : ""}
              ${p.ruc ? `<span class="exec-contact-item">🏛️ RUC: ${escapeHtml(p.ruc)}</span>` : ""}
              ${p.telefono ? `<span class="exec-contact-item">📞 ${escapeHtml(p.telefono)}</span>` : ""}
              ${p.email ? `<span class="exec-contact-item">✉️ ${escapeHtml(p.email)}</span>` : ""}
              ${p.ubicacion ? `<span class="exec-contact-item">📍 ${escapeHtml(p.ubicacion)}</span>` : ""}
              ${p.brevete ? `<span class="exec-contact-item">🚗 ${escapeHtml(p.brevete)}</span>` : ""}
            </div>
          </div>
        </header>

        <!-- BARRA KPI DE TIEMPO DE EXPERIENCIA Y CAPACITACIÓN -->
        ${state.config.showExperienceSummaryBox ? `
          <section class="exec-kpi-strip">
            <div class="exec-kpi-box">
              <span class="exec-kpi-label">Experiencia General</span>
              <span class="exec-kpi-val">${escapeHtml(stats.general.shortText)} (${stats.general.days} días)</span>
            </div>
            <div class="exec-kpi-box">
              <span class="exec-kpi-label">Exp. Específica (Saneamiento)</span>
              <span class="exec-kpi-val">${escapeHtml(stats.especifica.shortText)} (${stats.especifica.days} días)</span>
            </div>
            <div class="exec-kpi-box">
              <span class="exec-kpi-label">Diplomados / Especialización</span>
              <span class="exec-kpi-val">${activeDip.length} prog. (${stats.horasDiplomados} hrs)</span>
            </div>
            <div class="exec-kpi-box">
              <span class="exec-kpi-label">Total Horas Capacitación</span>
              <span class="exec-kpi-val">${stats.horasTotales} horas lectivas</span>
            </div>
          </section>
        ` : ""}

        <!-- PERFIL PROFESIONAL -->
        ${p.resumen ? `<p class="exec-summary-text">${escapeHtml(p.resumen)}</p>` : ""}

        <!-- FORMACIÓN ACADÉMICA -->
        ${activeEdu.length > 0 ? `
          <section class="exec-section">
            <h2 class="exec-section-title">
              <span>Formación Académica</span>
              <span class="exec-section-badge">UNI • COAR Lima</span>
            </h2>
            <div class="exec-exp-list">
              ${activeEdu.map(edu => `
                <div class="exec-exp-item">
                  <div class="exec-exp-top">
                    <span class="exec-exp-role">
                      ${escapeHtml(edu.titulo)}
                      ${renderFolioButton(edu.paginasDoc, edu.titulo)}
                    </span>
                    <span class="exec-exp-date">${escapeHtml(edu.periodo)} | ${escapeHtml(edu.ubicacion)}</span>
                  </div>
                  <div class="exec-exp-org-row">
                    <span class="exec-exp-org">${escapeHtml(edu.institucion)}</span>
                    ${edu.destacado ? `<span class="exec-exp-doc">${escapeHtml(edu.destacado)}</span>` : ""}
                  </div>
                  ${Array.isArray(edu.detalles) && edu.detalles.length > 0 ? `
                    <div class="exec-exp-desc">
                      ${edu.detalles.map(d => `• <strong>${escapeHtml(d)}</strong>`).join(" &nbsp;|&nbsp; ")}
                    </div>
                  ` : ""}
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <!-- EXPERIENCIA PROFESIONAL -->
        ${activeExp.length > 0 ? `
          <section class="exec-section">
            <h2 class="exec-section-title">
              <span>Experiencia Profesional y de Especialidad</span>
              <span class="exec-section-badge">${activeExp.length} registros acreditados • ${escapeHtml(stats.general.shortText)}</span>
            </h2>
            <div class="exec-exp-list">
              ${activeExp.map(exp => `
                <div class="exec-exp-item">
                  <div class="exec-exp-top">
                    <span class="exec-exp-role">
                      ${escapeHtml(exp.cargoCorto || exp.cargo)}
                      ${renderFolioButton(exp.paginasDoc, `${exp.entidad} - ${exp.documentoSustento}`)}
                    </span>
                    <span class="exec-exp-date">${escapeHtml(exp.periodoTexto)}</span>
                  </div>
                  <div class="exec-exp-org-row">
                    <span class="exec-exp-org">${escapeHtml(exp.entidad)} ${exp.area ? `— ${escapeHtml(exp.area)}` : ""}</span>
                    <span class="exec-exp-doc">${escapeHtml(exp.documentoSustento)} ${exp.monto ? `(${escapeHtml(exp.monto)})` : ""}</span>
                  </div>
                  ${exp.descripcion ? `<p class="exec-exp-desc">${escapeHtml(exp.descripcion)}</p>` : ""}
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <!-- DIPLOMADOS Y PROGRAMAS DE ESPECIALIZACIÓN -->
        ${activeDip.length > 0 ? `
          <section class="exec-section">
            <h2 class="exec-section-title">
              <span>Diplomados y Programas de Especialización</span>
              <span class="exec-section-badge">${stats.horasDiplomados} horas lectivas acreditadas</span>
            </h2>
            <div class="exec-compact-grid">
              ${activeDip.map(dip => `
                <div class="exec-course-row">
                  <div class="exec-course-main">
                    <div class="exec-course-title">
                      ${escapeHtml(dip.titulo)}
                      ${renderFolioButton(dip.paginasDoc, dip.titulo)}
                    </div>
                    <div class="exec-course-inst">
                      <strong>${escapeHtml(dip.institucion)}</strong> • ${escapeHtml(dip.fecha)}
                      ${dip.registro ? ` • Reg: ${escapeHtml(dip.registro)}` : ""}
                    </div>
                    ${dip.detalle ? `<div class="exec-exp-desc">${escapeHtml(dip.detalle)}</div>` : ""}
                  </div>
                  <div class="exec-course-meta">
                    <span class="badge-hours">${escapeHtml(dip.horas)} hrs</span>
                    ${dip.nota ? `<span class="badge-grade">${escapeHtml(dip.nota)}</span>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <!-- CURSOS Y CAPACITACIONES TÉCNICAS -->
        ${activeCur.length > 0 ? `
          <section class="exec-section">
            <h2 class="exec-section-title">
              <span>Cursos, Talleres y Capacitación Técnica</span>
              <span class="exec-section-badge">${stats.horasCursos} horas lectivas</span>
            </h2>
            <div class="exec-compact-grid">
              ${activeCur.map(cur => `
                <div class="exec-course-row">
                  <div class="exec-course-main">
                    <span class="exec-course-title">${escapeHtml(cur.titulo)}</span>
                    <span class="exec-course-inst"> — ${escapeHtml(cur.institucion)} (${escapeHtml(cur.fecha)})</span>
                    ${renderFolioButton(cur.paginasDoc, cur.titulo)}
                  </div>
                  <div class="exec-course-meta">
                    ${cur.horas ? `<span class="badge-hours">${escapeHtml(cur.horas)} hrs</span>` : ""}
                    ${cur.nota ? `<span class="badge-grade">${escapeHtml(cur.nota)}</span>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <!-- COMPETENCIAS Y HERRAMIENTAS DE SOFTWARE -->
        <section class="exec-section">
          <h2 class="exec-section-title">
            <span>Software Especializado y Competencias</span>
          </h2>
          <div class="exec-skills-wrapper">
            <div>
              <div class="exec-skill-Sub">Herramientas de Ingeniería, Saneamiento y Ciencia de Datos</div>
              <div class="exec-tags">
                ${activeSw.map(sw => `<span class="exec-tag tag-tech">${escapeHtml(sw.nombre)}</span>`).join("")}
              </div>
            </div>
            <div>
              <div class="exec-skill-Sub">Competencias Profesionales</div>
              <div class="exec-tags">
                ${activeBlandas.map(cb => `<span class="exec-tag">${escapeHtml(cb.nombre)}</span>`).join("")}
              </div>
            </div>
          </div>
        </section>

        <!-- INFORMACIÓN ADICIONAL Y MÉRITOS -->
        ${activeAdi.length > 0 ? `
          <section class="exec-section">
            <h2 class="exec-section-title">
              <span>Licencias, Méritos y Participación Cívica</span>
            </h2>
            <div class="exec-compact-grid">
              ${activeAdi.map(adi => `
                <div class="exec-course-row">
                  <div class="exec-course-main">
                    <span class="exec-course-title">${escapeHtml(adi.titulo)}</span>
                    <span class="exec-course-inst"> — ${escapeHtml(adi.institucion)} (${escapeHtml(adi.fecha)})</span>
                    ${renderFolioButton(adi.paginasDoc, adi.titulo)}
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}
      </article>
    `;
  }

  // -------------------------------------------------------------------------
  // RENDERIZADO DE HOJAS ANEXAS DOCUMENTADAS (PÁGINAS 2 A 55)
  // -------------------------------------------------------------------------
  function renderAnnexes(activePages) {
    if (!state.config.includeDocsInPrint || activePages.length === 0) {
      cvAnnexesRoot.innerHTML = "";
      return;
    }

    cvAnnexesRoot.innerHTML = activePages.map((item, idx) => {
      const pStr = String(item.page).padStart(2, "0");
      return `
        <div class="annex-sheet">
          <div class="annex-caption-bar no-print">Anexo #${idx + 1} • ${escapeHtml(item.label)}</div>
          <img src="assets/certificados/pag_${pStr}.jpg" loading="lazy" alt="Sustento Documentado Página ${pStr}" />
        </div>
      `;
    }).join("");
  }

  // =========================================================================
  // 4. RENDERIZADO DEL PANEL LATERAL EDITOR (6 PESTAÑAS)
  // =========================================================================
  function renderSidebar() {
    if (activeTab === "perfil") {
      renderTabPerfil();
    } else if (activeTab === "academica") {
      renderTabAcademica();
    } else if (activeTab === "experiencia") {
      renderTabExperiencia();
    } else if (activeTab === "diplomados") {
      renderTabDiplomados();
    } else if (activeTab === "cursos") {
      renderTabCursos();
    } else if (activeTab === "ajustes") {
      renderTabAjustes();
    }
  }

  // --- PESTAÑA 1: PERFIL Y COMPETENCIAS ---
  function renderTabPerfil() {
    const p = state.personal;
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Datos Personales y Perfil</h2>
      </div>
      <p class="editor-section-desc">Edita tus datos de contacto, extracto profesional, foto y competencias. Todo se refleja al instante en el visor.</p>

      <div class="form-card">
        <div class="card-top-bar">
          <label class="card-check-label">
            <input type="checkbox" data-bind="personal.mostrarFoto" ${p.mostrarFoto ? "checked" : ""} />
            <span>Mostrar fotografía de perfil en el CV</span>
          </label>
          <label class="btn-xs" for="uploadPhotoInput" style="cursor:pointer">📷 Cambiar Foto</label>
          <input type="file" id="uploadPhotoInput" accept="image/*" hidden />
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nombres</label>
            <input type="text" class="form-input" data-bind="personal.nombres" value="${escapeHtml(p.nombres)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Apellidos</label>
            <input type="text" class="form-input" data-bind="personal.apellidos" value="${escapeHtml(p.apellidos)}" />
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Título / Especialidad (Vista Ejecutiva)</label>
            <input type="text" class="form-input" data-bind="personal.tituloProfesional" value="${escapeHtml(p.tituloProfesional)}" />
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Frase / Lema Personal</label>
            <input type="text" class="form-input" data-bind="personal.frase" value="${escapeHtml(p.frase)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono / Celular</label>
            <input type="text" class="form-input" data-bind="personal.telefono" value="${escapeHtml(p.telefono)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Ubicación / Distrito</label>
            <input type="text" class="form-input" data-bind="personal.ubicacion" value="${escapeHtml(p.ubicacion)}" />
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" class="form-input" data-bind="personal.email" value="${escapeHtml(p.email)}" />
          </div>
          <div class="form-group">
            <label class="form-label">DNI</label>
            <input type="text" class="form-input" data-bind="personal.dni" value="${escapeHtml(p.dni)}" />
          </div>
          <div class="form-group">
            <label class="form-label">RUC</label>
            <input type="text" class="form-input" data-bind="personal.ruc" value="${escapeHtml(p.ruc)}" />
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Licencia de Conducir / Adicional</label>
            <input type="text" class="form-input" data-bind="personal.brevete" value="${escapeHtml(p.brevete)}" />
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Resumen Profesional</label>
            <textarea class="form-textarea" rows="4" data-bind="personal.resumen">${escapeHtml(p.resumen)}</textarea>
          </div>
        </div>
      </div>

      <!-- COMPETENCIAS Y SOFTWARE -->
      <div class="form-card">
        <div class="editor-section-header">
          <h3 class="editor-section-title">Software y Competencias</h3>
        </div>
        <div class="form-group">
          <label class="form-label">Texto de Software (Vista Original Pág. 1)</label>
          <textarea class="form-textarea" rows="2" data-bind="competencias.softwareTexto">${escapeHtml(state.competencias.softwareTexto)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Texto Adicionales (Vista Original Pág. 1)</label>
          <input type="text" class="form-input" data-bind="competencias.adicionalesTexto" value="${escapeHtml(state.competencias.adicionalesTexto)}" />
        </div>

        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Etiquetas de Software Técnico (Activar / Desactivar)</label>
          <div class="chip-list">
            ${state.competencias.softwareTags.map((sw, idx) => `
              <span class="chip-item">
                <input type="checkbox" data-array="softwareTags" data-index="${idx}" data-field="visible" ${sw.visible ? "checked" : ""} />
                <span>${escapeHtml(sw.nombre)}</span>
                <button type="button" class="chip-remove" data-action="remove-sw" data-index="${idx}" title="Eliminar">×</button>
              </span>
            `).join("")}
          </div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <input type="text" id="newSwInput" class="form-input" placeholder="Nuevo software (ej. EPANET, Civil 3D)..." />
            <button type="button" class="btn-xs btn-add" id="btnAddSw">+ Añadir</button>
          </div>
        </div>

        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Competencias Blandas (Activar / Desactivar)</label>
          <div class="chip-list">
            ${state.competencias.blandas.map((cb, idx) => `
              <span class="chip-item">
                <input type="checkbox" data-array="blandas" data-index="${idx}" data-field="visible" ${cb.visible ? "checked" : ""} />
                <span>${escapeHtml(cb.nombre)}</span>
                <button type="button" class="chip-remove" data-action="remove-cb" data-index="${idx}" title="Eliminar">×</button>
              </span>
            `).join("")}
          </div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <input type="text" id="newCbInput" class="form-input" placeholder="Nueva competencia..." />
            <button type="button" class="btn-xs btn-add" id="btnAddCb">+ Añadir</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- PESTAÑA 2: FORMACIÓN ACADÉMICA ---
  function renderTabAcademica() {
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Formación Académica (${state.formacion.length})</h2>
        <button type="button" class="btn-xs btn-add" data-action="add-item" data-list="formacion">+ Agregar Estudio</button>
      </div>
      <p class="editor-section-desc">Activa o edita tus grados universitarios y estudios secundarios. Puedes ocultar la secundaria con un clic para convocatorias profesionales.</p>

      <div class="quick-actions-row">
        <label class="toggle-inline">
          <input type="checkbox" data-bind="config.showSecondaryEducation" ${state.config.showSecondaryEducation ? "checked" : ""} />
          <span>Incluir Educación Secundaria (COAR Lima / Aucará)</span>
        </label>
        <label class="toggle-inline">
          <input type="checkbox" data-bind="config.showInstitutionLogos" ${state.config.showInstitutionLogos ? "checked" : ""} />
          <span>Mostrar Escudos Institucionales en Diseño Original</span>
        </label>
      </div>

      ${state.formacion.map((item, idx) => `
        <div class="form-card ${item.visible ? "" : "is-hidden-item"}">
          <div class="card-top-bar">
            <label class="card-check-label">
              <input type="checkbox" data-list="formacion" data-index="${idx}" data-field="visible" ${item.visible ? "checked" : ""} />
              <span>${escapeHtml(item.titulo || "Estudio Académico")}</span>
            </label>
            <div class="card-controls">
              ${item.paginasDoc?.length ? `<button type="button" class="icon-btn btn-doc-preview" data-pages="${item.paginasDoc.join(",")}" data-title="${escapeHtml(item.titulo)}">📄 Sustento</button>` : ""}
              <button type="button" class="icon-btn" data-action="move-up" data-list="formacion" data-index="${idx}" title="Subir">↑</button>
              <button type="button" class="icon-btn" data-action="move-down" data-list="formacion" data-index="${idx}" title="Bajar">↓</button>
              <button type="button" class="icon-btn btn-delete" data-action="delete-item" data-list="formacion" data-index="${idx}" title="Eliminar">🗑</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Periodo / Años</label>
              <input type="text" class="form-input" data-list="formacion" data-index="${idx}" data-field="periodo" value="${escapeHtml(item.periodo)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Ubicación</label>
              <input type="text" class="form-input" data-list="formacion" data-index="${idx}" data-field="ubicacion" value="${escapeHtml(item.ubicacion)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Grado / Estudios</label>
              <input type="text" class="form-input" data-list="formacion" data-index="${idx}" data-field="titulo" value="${escapeHtml(item.titulo)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Universidad / Institución</label>
              <input type="text" class="form-input" data-list="formacion" data-index="${idx}" data-field="institucion" value="${escapeHtml(item.institucion)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Nivel</label>
              <select class="form-select" data-list="formacion" data-index="${idx}" data-field="tipo">
                <option value="universitaria" ${item.tipo === "universitaria" ? "selected" : ""}>Universitaria / Posgrado</option>
                <option value="secundaria" ${item.tipo === "secundaria" ? "selected" : ""}>Secundaria</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Páginas Sustento PDF (ej. 4,5,6,7)</label>
              <input type="text" class="form-input" data-list="formacion" data-index="${idx}" data-field="paginasDoc" value="${escapeHtml((item.paginasDoc || []).join(", "))}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Viñetas / Grados obtenidos (1 por línea)</label>
              <textarea class="form-textarea" rows="2" data-list="formacion" data-index="${idx}" data-field="detalles">${escapeHtml((item.detalles || []).join("\n"))}</textarea>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  // --- PESTAÑA 3: EXPERIENCIA LABORAL ---
  function renderTabExperiencia() {
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Experiencia Laboral (${state.experiencia.length})</h2>
        <button type="button" class="btn-xs btn-add" data-action="add-item" data-list="experiencia">+ Nueva Experiencia</button>
      </div>
      <p class="editor-section-desc">Activa o desactiva órdenes de servicio y certificados según la convocatoria. El tiempo total de experiencia se recalcula al instante.</p>

      <div class="quick-actions-row">
        <button type="button" class="btn-xs" data-action="toggle-all-exp" data-mode="all">✅ Activar Todas</button>
        <button type="button" class="btn-xs" data-action="toggle-all-exp" data-mode="especifica">🎯 Solo Exp. Específica (Saneamiento)</button>
        <button type="button" class="btn-xs" data-action="toggle-all-exp" data-mode="publico">🏛️ Solo Sector Público (SUNASS/OTASS/MML)</button>
      </div>

      ${state.experiencia.map((exp, idx) => `
        <div class="form-card ${exp.visible ? "" : "is-hidden-item"}">
          <div class="card-top-bar">
            <label class="card-check-label">
              <input type="checkbox" data-list="experiencia" data-index="${idx}" data-field="visible" ${exp.visible ? "checked" : ""} />
              <span>${escapeHtml(exp.entidad.split("—")[0].trim())} — ${escapeHtml(exp.periodoTexto)}</span>
            </label>
            <div class="card-controls">
              ${exp.paginasDoc?.length ? `<button type="button" class="icon-btn btn-doc-preview" data-pages="${exp.paginasDoc.join(",")}" data-title="${escapeHtml(exp.entidad)}">📄 Pág. ${exp.paginasDoc.join(",")}</button>` : ""}
              <button type="button" class="icon-btn" data-action="move-up" data-list="experiencia" data-index="${idx}" title="Subir">↑</button>
              <button type="button" class="icon-btn" data-action="move-down" data-list="experiencia" data-index="${idx}" title="Bajar">↓</button>
              <button type="button" class="icon-btn btn-delete" data-action="delete-item" data-list="experiencia" data-index="${idx}" title="Eliminar">🗑</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Entidad / Empresa</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="entidad" value="${escapeHtml(exp.entidad)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Cargo / Servicio (Título Visible en CV)</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="cargoCorto" value="${escapeHtml(exp.cargoCorto || exp.cargo)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Periodo (Texto en CV)</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="periodoTexto" value="${escapeHtml(exp.periodoTexto)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Días Acreditados (Para Cálculo)</label>
              <input type="number" class="form-input" data-list="experiencia" data-index="${idx}" data-field="diasDeclarados" value="${escapeHtml(exp.diasDeclarados)}" />
            </div>
            <div class="form-group">
              <label class="form-label">N° Constancia / Orden de Servicio</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="documentoSustento" value="${escapeHtml(exp.documentoSustento)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Monto Contractual (Opcional)</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="monto" value="${escapeHtml(exp.monto)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Descripción / Funciones Principales</label>
              <textarea class="form-textarea" rows="2" data-list="experiencia" data-index="${idx}" data-field="descripcion">${escapeHtml(exp.descripcion)}</textarea>
            </div>
            <div class="form-group">
              <label class="card-check-label" style="margin-top:4px">
                <input type="checkbox" data-list="experiencia" data-index="${idx}" data-field="esEspecifica" ${exp.esEspecifica ? "checked" : ""} />
                <span>Es Experiencia Específica</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Folio PDF (Pág.)</label>
              <input type="text" class="form-input" data-list="experiencia" data-index="${idx}" data-field="paginasDoc" value="${escapeHtml((exp.paginasDoc || []).join(", "))}" />
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  // --- PESTAÑA 4: DIPLOMADOS Y ESPECIALIZACIÓN ---
  function renderTabDiplomados() {
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Diplomados y Especializaciones (${state.diplomados.length})</h2>
        <button type="button" class="btn-xs btn-add" data-action="add-item" data-list="diplomados">+ Nuevo Diplomado</button>
      </div>
      <p class="editor-section-desc">Programas de larga duración (ESAN, Toulouse Lautrec, UNI, CENAM, CIAR). Total actual: <strong>${calculateExperienceStats().horasDiplomados} horas</strong>.</p>

      ${state.diplomados.map((dip, idx) => `
        <div class="form-card ${dip.visible ? "" : "is-hidden-item"}">
          <div class="card-top-bar">
            <label class="card-check-label">
              <input type="checkbox" data-list="diplomados" data-index="${idx}" data-field="visible" ${dip.visible ? "checked" : ""} />
              <span>${escapeHtml(dip.titulo)}</span>
            </label>
            <div class="card-controls">
              ${dip.paginasDoc?.length ? `<button type="button" class="icon-btn btn-doc-preview" data-pages="${dip.paginasDoc.join(",")}" data-title="${escapeHtml(dip.titulo)}">📄 Pág. ${dip.paginasDoc.join(",")}</button>` : ""}
              <button type="button" class="icon-btn" data-action="move-up" data-list="diplomados" data-index="${idx}" title="Subir">↑</button>
              <button type="button" class="icon-btn" data-action="move-down" data-list="diplomados" data-index="${idx}" title="Bajar">↓</button>
              <button type="button" class="icon-btn btn-delete" data-action="delete-item" data-list="diplomados" data-index="${idx}" title="Eliminar">🗑</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Nombre del Diplomado / Programa</label>
              <input type="text" class="form-input" data-list="diplomados" data-index="${idx}" data-field="titulo" value="${escapeHtml(dip.titulo)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Universidad / Institución</label>
              <input type="text" class="form-input" data-list="diplomados" data-index="${idx}" data-field="institucion" value="${escapeHtml(dip.institucion)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fechas de realización</label>
              <input type="text" class="form-input" data-list="diplomados" data-index="${idx}" data-field="fecha" value="${escapeHtml(dip.fecha)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Horas Lectivas</label>
              <input type="number" class="form-input" data-list="diplomados" data-index="${idx}" data-field="horas" value="${escapeHtml(dip.horas)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Promedio / Calificación</label>
              <input type="text" class="form-input" data-list="diplomados" data-index="${idx}" data-field="nota" value="${escapeHtml(dip.nota)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Folio PDF (Pág.)</label>
              <input type="text" class="form-input" data-list="diplomados" data-index="${idx}" data-field="paginasDoc" value="${escapeHtml((dip.paginasDoc || []).join(", "))}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Módulos / Detalle Curricular</label>
              <textarea class="form-textarea" rows="2" data-list="diplomados" data-index="${idx}" data-field="detalle">${escapeHtml(dip.detalle)}</textarea>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  // --- PESTAÑA 5: CURSOS, TALLERES Y ADICIONALES ---
  function renderTabCursos() {
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Cursos y Capacitaciones (${state.cursos.length})</h2>
        <button type="button" class="btn-xs btn-add" data-action="add-item" data-list="cursos">+ Nuevo Curso</button>
      </div>
      <p class="editor-section-desc">Cursos técnicos de especialización (Power BI, Revit MEP, ArcGIS, WaterCAD, S10, Instalaciones Sanitarias).</p>

      ${state.cursos.map((cur, idx) => `
        <div class="form-card ${cur.visible ? "" : "is-hidden-item"}">
          <div class="card-top-bar">
            <label class="card-check-label">
              <input type="checkbox" data-list="cursos" data-index="${idx}" data-field="visible" ${cur.visible ? "checked" : ""} />
              <span>${escapeHtml(cur.titulo)}</span>
            </label>
            <div class="card-controls">
              ${cur.paginasDoc?.length ? `<button type="button" class="icon-btn btn-doc-preview" data-pages="${cur.paginasDoc.join(",")}" data-title="${escapeHtml(cur.titulo)}">📄 Pág. ${cur.paginasDoc.join(",")}</button>` : ""}
              <button type="button" class="icon-btn" data-action="move-up" data-list="cursos" data-index="${idx}" title="Subir">↑</button>
              <button type="button" class="icon-btn" data-action="move-down" data-list="cursos" data-index="${idx}" title="Bajar">↓</button>
              <button type="button" class="icon-btn btn-delete" data-action="delete-item" data-list="cursos" data-index="${idx}" title="Eliminar">🗑</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Curso / Taller</label>
              <input type="text" class="form-input" data-list="cursos" data-index="${idx}" data-field="titulo" value="${escapeHtml(cur.titulo)}" />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Institución</label>
              <input type="text" class="form-input" data-list="cursos" data-index="${idx}" data-field="institucion" value="${escapeHtml(cur.institucion)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="text" class="form-input" data-list="cursos" data-index="${idx}" data-field="fecha" value="${escapeHtml(cur.fecha)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Horas</label>
              <input type="number" class="form-input" data-list="cursos" data-index="${idx}" data-field="horas" value="${escapeHtml(cur.horas)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Calificación / Estado</label>
              <input type="text" class="form-input" data-list="cursos" data-index="${idx}" data-field="nota" value="${escapeHtml(cur.nota)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Folio PDF (Pág.)</label>
              <input type="text" class="form-input" data-list="cursos" data-index="${idx}" data-field="paginasDoc" value="${escapeHtml((cur.paginasDoc || []).join(", "))}" />
            </div>
          </div>
        </div>
      `).join("")}

      <!-- SECCIÓN ADICIONALES -->
      <div class="editor-section-header" style="margin-top:20px">
        <h2 class="editor-section-title">Adicionales y Reconocimientos (${(state.adicionales || []).length})</h2>
        <button type="button" class="btn-xs btn-add" data-action="add-item" data-list="adicionales">+ Añadir Adicional</button>
      </div>
      ${(state.adicionales || []).map((adi, idx) => `
        <div class="form-card ${adi.visible ? "" : "is-hidden-item"}">
          <div class="card-top-bar">
            <label class="card-check-label">
              <input type="checkbox" data-list="adicionales" data-index="${idx}" data-field="visible" ${adi.visible ? "checked" : ""} />
              <span>${escapeHtml(adi.titulo)}</span>
            </label>
            <div class="card-controls">
              ${adi.paginasDoc?.length ? `<button type="button" class="icon-btn btn-doc-preview" data-pages="${adi.paginasDoc.join(",")}" data-title="${escapeHtml(adi.titulo)}">📄 Pág. ${adi.paginasDoc.join(",")}</button>` : ""}
              <button type="button" class="icon-btn btn-delete" data-action="delete-item" data-list="adicionales" data-index="${idx}" title="Eliminar">🗑</button>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Título / Documento</label>
              <input type="text" class="form-input" data-list="adicionales" data-index="${idx}" data-field="titulo" value="${escapeHtml(adi.titulo)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Institución</label>
              <input type="text" class="form-input" data-list="adicionales" data-index="${idx}" data-field="institucion" value="${escapeHtml(adi.institucion)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="text" class="form-input" data-list="adicionales" data-index="${idx}" data-field="fecha" value="${escapeHtml(adi.fecha)}" />
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  // --- PESTAÑA 6: AJUSTES DE DISEÑO Y EXPORTACIÓN ---
  function renderTabAjustes() {
    const cfg = state.config;
    sidebarContent.innerHTML = `
      <div class="editor-section-header">
        <h2 class="editor-section-title">Diseño, Plantillas y Exportación</h2>
      </div>
      <p class="editor-section-desc">Personaliza el aspecto visual del visor A4, colores, tamaño de letra y opciones de exportación del CV Documentado.</p>

      <div class="form-card">
        <div class="form-group">
          <label class="form-label">Plantilla Activa del Visor</label>
          <select class="form-select" data-bind="config.template">
            <option value="ejecutivo" ${cfg.template === "ejecutivo" ? "selected" : ""}>Propuesta Ejecutiva Pro / ATS (Recomendada)</option>
            <option value="original" ${cfg.template === "original" ? "selected" : ""}>Diseño Actual Fiel a tu PDF (Cabecera Turquesa + Logos)</option>
          </select>
        </div>

        <div class="form-grid" style="margin-top:10px">
          <div class="form-group">
            <label class="form-label">Color Cabecera (Diseño Original)</label>
            <input type="color" class="form-input" style="height:38px; padding:3px;" data-bind="config.primaryColor" value="${escapeHtml(cfg.primaryColor || "#7bc0c7")}" />
          </div>
          <div class="form-group">
            <label class="form-label">Color Principal (Ejecutivo Pro)</label>
            <input type="color" class="form-input" style="height:38px; padding:3px;" data-bind="config.executiveColor" value="${escapeHtml(cfg.executiveColor || "#0f4c5c")}" />
          </div>
        </div>

        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Escala de Tamaño de Fuente (${cfg.fontSizeScale || 100}%)</label>
          <input type="range" min="85" max="115" step="1" data-bind="config.fontSizeScale" value="${cfg.fontSizeScale || 100}" />
        </div>
      </div>

      <div class="form-card">
        <div class="editor-section-header">
          <h3 class="editor-section-title">Opciones de Contenido y Anexos</h3>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label class="card-check-label">
            <input type="checkbox" data-bind="config.showExperienceSummaryBox" ${cfg.showExperienceSummaryBox ? "checked" : ""} />
            <span>Mostrar cuadro resumen de cálculo de experiencia (años/meses/días) y horas</span>
          </label>
          <label class="card-check-label">
            <input type="checkbox" data-bind="config.showExperienceInOriginal" ${cfg.showExperienceInOriginal ? "checked" : ""} />
            <span>En "Diseño Actual Fiel", mostrar también el listado de Experiencia, Diplomados y Cursos debajo de la Página 1</span>
          </label>
          <label class="card-check-label">
            <input type="checkbox" data-bind="config.includeDocsInPrint" ${cfg.includeDocsInPrint ? "checked" : ""} />
            <span>Adjuntar automáticamente los certificados escaneados de los ítems activos al final del visor</span>
          </label>
          <label class="card-check-label">
            <input type="checkbox" data-bind="config.includeSectionDividers" ${cfg.includeSectionDividers !== false ? "checked" : ""} />
            <span>Incluir carátulas separadoras ("FORMACIÓN ACADÉMICA", "EXPERIENCIA LABORAL", etc.) en el CV Documentado</span>
          </label>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 5. EVENTOS Y ACTUALIZACIÓN EN TIEMPO REAL
  // =========================================================================
  function setupEventListeners() {
    // Cambio de pestañas del sidebar
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeTab = btn.dataset.tab;
        renderSidebar();
      });
    });

    // Cambio de plantilla desde la barra superior
    document.querySelectorAll(".tpl-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.config.template = btn.dataset.tpl;
        saveState();
        updatePreview();
        if (activeTab === "ajustes") renderSidebar();
      });
    });

    // Escucha delegada en tiempo real para inputs del sidebar
    sidebarContent.addEventListener("input", handleSidebarInput);
    sidebarContent.addEventListener("change", handleSidebarInput);
    sidebarContent.addEventListener("click", handleSidebarClick);

    // Checkbox de vista previa de documentos en el visor
    if (chkPreviewDocs) {
      chkPreviewDocs.addEventListener("change", (e) => {
        state.config.includeDocsInPrint = e.target.checked;
        saveState();
        updatePreview();
        if (activeTab === "ajustes") renderSidebar();
      });
    }

    // Botones de Impresión / Exportación PDF
    document.getElementById("btnPrintResumen")?.addEventListener("click", () => {
      const prev = state.config.includeDocsInPrint;
      state.config.includeDocsInPrint = false;
      updatePreview();
      setTimeout(() => {
        window.print();
        state.config.includeDocsInPrint = prev;
        updatePreview();
      }, 150);
    });

    document.getElementById("btnPrintDocumentado")?.addEventListener("click", () => {
      state.config.includeDocsInPrint = true;
      saveState();
      updatePreview();
      setTimeout(() => {
        window.print();
      }, 300);
    });

    // Controles de Zoom
    document.getElementById("btnZoomIn")?.addEventListener("click", () => setZoom(zoomLevel + 10));
    document.getElementById("btnZoomOut")?.addEventListener("click", () => setZoom(zoomLevel - 10));
    document.getElementById("btnZoomReset")?.addEventListener("click", () => setZoom(100));

    // Exportar / Importar JSON y Restaurar
    document.getElementById("btnExportJson")?.addEventListener("click", exportJson);
    document.getElementById("inputImportJson")?.addEventListener("change", importJson);
    document.getElementById("btnResetDefault")?.addEventListener("click", () => {
      if (confirm("¿Deseas restaurar todos los datos originales extraídos de tu CV PDF? Se reemplazarán tus ediciones actuales.")) {
        state = structuredClone(window.DEFAULT_CV_DATA);
        saveState();
        renderSidebar();
        updatePreview();
      }
    });

    // Clic en píldoras de "Ver sustento" dentro del visor A4
    cvDocumentRoot.addEventListener("click", (e) => {
      const pill = e.target.closest(".doc-folio-pill");
      if (pill) {
        openCertModal(pill.dataset.pages, pill.dataset.title);
      }
    });

    // Cerrar modal de certificados
    document.getElementById("btnCloseModal")?.addEventListener("click", () => certModal.close());
    certModal?.addEventListener("click", (e) => {
      if (e.target === certModal) certModal.close();
    });
  }

  function handleSidebarInput(e) {
    const target = e.target;

    // Subida de fotografía personalizada
    if (target.id === "uploadPhotoInput" && target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.personal.foto = ev.target.result;
        saveState();
        updatePreview();
      };
      reader.readAsDataURL(target.files[0]);
      return;
    }

    // Binding directo (ej. personal.nombres, config.primaryColor)
    if (target.dataset.bind) {
      const [section, key] = target.dataset.bind.split(".");
      const val = target.type === "checkbox" ? target.checked : (target.type === "range" ? Number(target.value) : target.value);
      state[section][key] = val;
      saveState();
      updatePreview();
      if (key === "fontSizeScale" || key === "showSecondaryEducation") renderSidebar();
      return;
    }

    // Binding de listas de objetos (formacion, experiencia, diplomados, cursos, adicionales)
    if (target.dataset.list !== undefined && target.dataset.index !== undefined) {
      const listName = target.dataset.list;
      const idx = Number(target.dataset.index);
      const field = target.dataset.field;
      const item = state[listName]?.[idx];
      if (!item) return;

      if (target.type === "checkbox") {
        item[field] = target.checked;
        if (field === "visible") {
          target.closest(".form-card")?.classList.toggle("is-hidden-item", !target.checked);
        }
      } else if (field === "detalles") {
        item[field] = target.value.split("\n").map(s => s.trim()).filter(Boolean);
      } else if (field === "paginasDoc") {
        item[field] = target.value
          .split(",")
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n) && n >= 2 && n <= 55);
      } else if (target.type === "number") {
        item[field] = Number(target.value) || 0;
      } else {
        item[field] = target.value;
      }

      saveState();
      updatePreview();
      return;
    }

    // Binding de chips de competencias / software
    if (target.dataset.array && target.dataset.index !== undefined) {
      const arrName = target.dataset.array;
      const idx = Number(target.dataset.index);
      state.competencias[arrName][idx].visible = target.checked;
      saveState();
      updatePreview();
    }
  }

  function handleSidebarClick(e) {
    // Botón de vista rápida de certificado escaneado
    const docBtn = e.target.closest(".btn-doc-preview");
    if (docBtn) {
      openCertModal(docBtn.dataset.pages, docBtn.dataset.title);
      return;
    }

    // Añadir software tag
    if (e.target.id === "btnAddSw") {
      const input = document.getElementById("newSwInput");
      const val = input?.value.trim();
      if (val) {
        state.competencias.softwareTags.push({ id: "sw-" + Date.now(), nombre: val, nivel: "Intermedio", visible: true });
        saveState();
        renderSidebar();
        updatePreview();
      }
      return;
    }

    // Añadir competencia blanda
    if (e.target.id === "btnAddCb") {
      const input = document.getElementById("newCbInput");
      const val = input?.value.trim();
      if (val) {
        state.competencias.blandas.push({ id: "cb-" + Date.now(), nombre: val, visible: true });
        saveState();
        renderSidebar();
        updatePreview();
      }
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const listName = actionBtn.dataset.list;
    const idx = Number(actionBtn.dataset.index);

    if (action === "remove-sw") {
      state.competencias.softwareTags.splice(idx, 1);
      saveState();
      renderSidebar();
      updatePreview();
    } else if (action === "remove-cb") {
      state.competencias.blandas.splice(idx, 1);
      saveState();
      renderSidebar();
      updatePreview();
    } else if (action === "move-up" && idx > 0) {
      const arr = state[listName];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      saveState();
      renderSidebar();
      updatePreview();
    } else if (action === "move-down" && idx < state[listName].length - 1) {
      const arr = state[listName];
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      saveState();
      renderSidebar();
      updatePreview();
    } else if (action === "delete-item") {
      if (confirm("¿Seguro que deseas eliminar este registro? (También puedes solo desmarcar su casilla para ocultarlo temporalmente)")) {
        state[listName].splice(idx, 1);
        saveState();
        renderSidebar();
        updatePreview();
      }
    } else if (action === "add-item") {
      addNewItemToList(listName);
    } else if (action === "toggle-all-exp") {
      const mode = actionBtn.dataset.mode;
      state.experiencia.forEach(exp => {
        if (mode === "all") exp.visible = true;
        else if (mode === "especifica") exp.visible = !!exp.esEspecifica;
        else if (mode === "publico") exp.visible = exp.sector === "Público";
      });
      saveState();
      renderSidebar();
      updatePreview();
    }
  }

  function addNewItemToList(listName) {
    if (listName === "formacion") {
      state.formacion.unshift({
        id: "edu-" + Date.now(),
        periodo: "2026",
        ubicacion: "Lima, Perú",
        titulo: "Nuevo Grado o Estudio Académico",
        institucion: "Nombre de la Institución / Universidad",
        tipo: "universitaria",
        destacado: "",
        detalles: [],
        paginasDoc: [],
        visible: true
      });
    } else if (listName === "experiencia") {
      state.experiencia.unshift({
        id: "exp-" + Date.now(),
        entidad: "Nombre de la Entidad o Empresa",
        area: "Área o Dirección",
        cargo: "Nombre del Cargo o Servicio",
        cargoCorto: "Especialista / Ingeniero Sanitario",
        documentoSustento: "Constancia / Orden de Servicio N°",
        fechaInicio: "2026-01-01",
        fechaFin: "2026-03-31",
        diasDeclarados: 90,
        periodoTexto: "Enero 2026 – Marzo 2026 (90 días)",
        monto: "",
        ubicacion: "Lima",
        sector: "Público",
        esEspecifica: true,
        descripcion: "Descripción de las actividades realizadas en el servicio o puesto.",
        paginasDoc: [],
        visible: true
      });
    } else if (listName === "diplomados") {
      state.diplomados.unshift({
        id: "dip-" + Date.now(),
        titulo: "Nuevo Diplomado o Programa de Especialización",
        institucion: "Universidad / Institución",
        fecha: "2026",
        horas: 120,
        nota: "Aprobado",
        registro: "",
        detalle: "",
        paginasDoc: [],
        visible: true
      });
    } else if (listName === "cursos") {
      state.cursos.unshift({
        id: "cur-" + Date.now(),
        titulo: "Nuevo Curso o Taller Técnico",
        institucion: "Institución Capacitadora",
        fecha: "2026",
        horas: 24,
        nota: "Aprobado",
        registro: "",
        paginasDoc: [],
        visible: true
      });
    } else if (listName === "adicionales") {
      state.adicionales.unshift({
        id: "adi-" + Date.now(),
        titulo: "Nuevo Reconocimiento o Licencia",
        institucion: "Entidad Emisora",
        fecha: "2026",
        detalle: "",
        paginasDoc: [],
        visible: true
      });
    }
    saveState();
    renderSidebar();
    updatePreview();
  }

  // =========================================================================
  // 6. UTILIDADES (MODAL DE CERTIFICADOS, ZOOM, JSON)
  // =========================================================================
  function openCertModal(pagesStr, title) {
    if (!pagesStr) return;
    const pages = pagesStr.split(",").map(s => s.trim()).filter(Boolean);
    certModalTitle.textContent = title || "Sustento Documentado";
    certModalSubtitle.textContent = `Visualizando folio(s) del PDF original: Página(s) ${pages.join(", ")}`;
    certModalBody.innerHTML = pages.map(p => {
      const pPad = String(p).padStart(2, "0");
      return `<img src="assets/certificados/pag_${pPad}.jpg" alt="Certificado Página ${pPad}" />`;
    }).join("");
    certModal.showModal();
  }

  function setZoom(newZoom) {
    zoomLevel = Math.max(60, Math.min(140, newZoom));
    lblZoom.textContent = `${zoomLevel}%`;
    cvPrintWrapper.style.transform = `scale(${zoomLevel / 100})`;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CV_Adders_Molina_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        state = deepMerge(structuredClone(window.DEFAULT_CV_DATA), imported);
        saveState();
        renderSidebar();
        updatePreview();
        alert("¡Datos importados correctamente!");
      } catch (err) {
        alert("El archivo JSON seleccionado no es válido.");
      }
    };
    reader.readAsText(file);
  }

  // Inicialización
  renderSidebar();
  updatePreview();
  setupEventListeners();
})();
