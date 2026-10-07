// Iglesia Sobrenatural — app.js
// Versión corregida: programación por fecha + quitar asignaciones.

console.log("Iglesia Sobrenatural — App iniciada");

/* =========================================================
   CONFIGURACIÓN
========================================================= */
const SUPABASE_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fAOdsgeqTNICDG1jIqybgA_a3Xy22fF";
const LOGIN_FUNCTION_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/Login-pin";
const CREATE_ACCOUNT_FUNCTION_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/crear-cuenta";
const RESET_PIN_FUNCTION_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/restablecer-pin";
const CHANGE_PIN_FUNCTION_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/cambiar-mi-pin";
const PUSH_SUBSCRIBE_FUNCTION_URL = "https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/push-subscribe";

/* =========================================================
   ELEMENTOS / ESTADO
========================================================= */
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");
const firstNameInput = document.getElementById("login-first-name");
const lastNameInput = document.getElementById("login-last-name");
const pinInput = document.getElementById("login-pin");
const app = document.querySelector(".app");
const bottomNav = document.querySelector(".bottom-nav");

window.currentUser = null;
window.currentServices = [];
window.currentAssignment = null;
window.currentServiceDetail = null;
window.currentServiceAssignmentData = null;
window.currentMinistries = [];
window.currentSelectedMinistry = null;
window.currentLedMinistries = [];
window.currentProgrammingMinistry = null;
window.currentProgrammingService = null;
window.currentPastoralPerson = null;
window.currentPastoralAccounts = [];
window.currentBodegaInventory = [];
window.currentBodegaMovements = [];
window.currentBodegaBeneficiaries = [];
window.currentBodegaDeliveries = [];

let calendarDate = new Date();
calendarDate.setDate(1);
let selectedCalendarDate = null;

/* =========================================================
   LOGIN — INTERFAZ
========================================================= */
function showApp() {
    if (loginScreen) loginScreen.style.display = "none";
    if (app) app.style.display = "block";
    if (bottomNav) bottomNav.style.display = "flex";
}
function showLogin() {
    if (loginScreen) loginScreen.style.display = "flex";
    if (app) app.style.display = "none";
    if (bottomNav) bottomNav.style.display = "none";
}
function showLoginMessage(message, type) {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = "login-message";
    if (type) loginMessage.classList.add(type);
}

/* =========================================================
   ROLES
========================================================= */
function getCurrentRole() {
    return String(window.currentUser?.role || window.currentUser?.primary_role || "").trim().toLowerCase();
}
function isPastor() { return getCurrentRole() === "pastor"; }
function isLeader() { return getCurrentRole() === "leader"; }

function updateUserInterface(person) {
    if (!person) return;
    const profileName = document.querySelector(".profile-name");
    const profileRole = document.querySelector(".profile-role");
    const avatar = document.querySelector(".profile-avatar");
    if (profileName) profileName.textContent = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    if (profileRole) {
        const roles = { pastor: "Pastor", leader: "Líder", server: "Servidor" };
        profileRole.textContent = roles[getCurrentRole()] || "Servidor";
    }
    if (avatar) {
        const first = person.first_name ? person.first_name.trim().charAt(0).toUpperCase() : "";
        const last = person.last_name ? person.last_name.trim().charAt(0).toUpperCase() : "";
        avatar.textContent = first + last;
    }
    updatePastoralAccess();
    updatePastoralButtonVisibility();
}

/* =========================================================
   LOGIN
========================================================= */
async function login() {
    const firstName = firstNameInput?.value.trim() || "";
    const lastName = lastNameInput?.value.trim() || "";
    const pin = pinInput?.value.trim() || "";
    if (!firstName || !lastName || !pin) {
        showLoginMessage("Completa todos los campos.", "error");
        return;
    }
    if (!loginButton) return;
    loginButton.disabled = true;
    loginButton.textContent = "Ingresando...";
    showLoginMessage("Conectando...", "");
    try {
        const response = await fetch(LOGIN_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, pin })
        });
        const text = await response.text();
        let data;
        try { data = text ? JSON.parse(text) : null; }
        catch { throw new Error("El servidor respondió con un formato inesperado."); }
        if (!response.ok) throw new Error(data?.error || data?.message || `Error HTTP ${response.status}`);
        if (!data?.ok) throw new Error(data?.error || data?.message || "No se pudo iniciar sesión.");
        if (!data.session?.access_token) throw new Error("La sesión no fue recibida correctamente.");
        localStorage.setItem("iglesia_session", JSON.stringify(data.session));
        localStorage.setItem("iglesia_person", JSON.stringify(data.person));
        window.currentUser = data.person;
        updateUserInterface(data.person);
        showLoginMessage("Bienvenido.", "success");
        setTimeout(async () => {
            // Construimos el Inicio nuevo mientras el login todavía cubre la app.
            // Así nunca se alcanza a ver el diseño antiguo durante la carga.
            renderPersonalHome();

            try {
                await Promise.all([loadMinistries(), loadServices(), loadMyLedMinistries()]);
                ensureMyServiceCalendarStyles();
                await loadMyCalendarAssignments();
                await loadMyNextAssignment();
                renderPersonalHome();
            } catch (e) {
                console.error("Error cargando datos:", e);
                // Incluso si falla una carga, mantenemos renderizado el Inicio nuevo.
                renderPersonalHome();
            }

            renderCalendar();
            updatePastoralAccess();
            updatePastoralButtonVisibility();

            // Mostramos la app solamente cuando el primer render ya terminó.
            showApp();

            window.setTimeout(() => {
                handlePushNotificationsAfterLogin();
            }, 700);
        }, 400);
    } catch (error) {
        console.error("ERROR LOGIN:", error);
        showLoginMessage(error instanceof TypeError ? "SPCK no pudo conectarse con Supabase." : (error.message || "No se pudo conectar con el servidor."), "error");
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Ingresar";
    }
}
loginForm?.addEventListener("submit", e => { e.preventDefault(); login(); });

/* =========================================================
   SUPABASE
========================================================= */
function getAccessToken() {
    try { return JSON.parse(localStorage.getItem("iglesia_session") || "null")?.access_token || null; }
    catch { return null; }
}
async function supabaseFetch(endpoint, options = {}) {
    const accessToken = getAccessToken();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        ...options,
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            ...(options.headers || {}),
            Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
    return text ? JSON.parse(text) : null;
}
async function supabaseRpc(functionName, body = {}) {
    const accessToken = getAccessToken();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) {
        let msg = `Supabase RPC ${response.status}: ${text}`;
        try {
            const d = JSON.parse(text);
            msg = d.message || d.error || d.hint || msg;
        } catch {}
        throw new Error(msg);
    }
    return text ? JSON.parse(text) : null;
}

/* =========================================================
   FECHAS
========================================================= */
function formatDate(s) {
    if (!s) return "";
    return new Date(`${s}T00:00:00`).toLocaleDateString("es-GT", {day:"numeric",month:"short"}).replace(".","");
}
function formatLongDate(s) {
    if (!s) return "";
    return new Date(`${s}T00:00:00`).toLocaleDateString("es-GT",{weekday:"long",day:"numeric",month:"long"});
}
function formatDay(s) {
    if (!s) return "";
    const d = new Date(`${s}T00:00:00`).toLocaleDateString("es-GT",{weekday:"long"});
    return d.charAt(0).toUpperCase()+d.slice(1);
}
function formatTime(s) {
    if (!s) return "";
    const [h0,m="00"] = s.split(":");
    const h = parseInt(h0,10), p = h >= 12 ? "PM" : "AM";
    return `${h%12 || 12}:${m} ${p}`;
}
function assignmentStatus(a) {
    if (a?.status === "confirmado") return "Confirmado";
    if (a?.status === "reclinado" || a?.status === "rechazado") return "Rechazado";
    return "Pendiente";
}

/* =========================================================
   MINISTERIOS / PERMISOS
========================================================= */
async function loadMinistries() {
    try {
        const x = await supabaseFetch("ministries?select=*&order=name.asc");
        return window.currentMinistries = Array.isArray(x) ? x : [];
    } catch(e) {
        console.error(e); return window.currentMinistries = [];
    }
}
async function loadMyLedMinistries() {
    if (isPastor()) return window.currentLedMinistries = [];
    try {
        const x = await supabaseRpc("get_my_led_ministries");
        return window.currentLedMinistries = Array.isArray(x) ? x : [];
    } catch(e) {
        console.error(e); return window.currentLedMinistries = [];
    }
}
function canManageMinistry(id) {
    return !!id && (isPastor() || window.currentLedMinistries.some(m => m.ministry_id === id));
}
async function getMinistryMembers(id) {
    const x = await supabaseRpc("get_ministry_members",{p_ministry_id:id});
    return Array.isArray(x) ? x : [];
}

/* =========================================================
   SERVICIOS
========================================================= */
async function loadServices() {
    try {
        const x = await supabaseFetch("services?select=*&order=service_date.asc,start_time.asc");
        window.currentServices = Array.isArray(x) ? x : [];
        renderServices(window.currentServices);
        renderCalendar();
    } catch(e) { console.error("Error cargando servicios:",e); }
}
function getUpcomingServices() {
    const today = new Date(); today.setHours(0,0,0,0);
    return (window.currentServices || []).filter(s => s.service_date && new Date(`${s.service_date}T00:00:00`) >= today)
        .sort((a,b)=>`${a.service_date} ${a.start_time||""}`.localeCompare(`${b.service_date} ${b.start_time||""}`));
}
function renderServices() {
    const next = document.getElementById("next-service-content");
    const list = document.getElementById("services-list-container");

    const legacyTop = next?.closest(".service-detail-card") || document.querySelector("#servicios .service-detail-card");
    if (legacyTop) legacyTop.style.display = "none";

    if (!list) return;

    const canAdmin = isPastor() || isLeader();

    list.innerHTML = `
        <div id="services-clean-home">
            <section class="services-hero">
                <p class="services-eyebrow">SERVICIOS</p>
                <h1>Servicios</h1>
                <p class="services-subtitle">${
                    canAdmin
                        ? "Administra programación, respuestas y actividades especiales."
                        : "Consulta tus asignaciones y próximas actividades."
                }</p>
            </section>

            ${canAdmin ? `
                <section class="services-primary-actions">
                    <button type="button" class="services-action-card" id="services-edit-month-button">
                        <span class="services-action-icon services-icon-programming" aria-hidden="true"></span>
                        <span class="services-action-copy">
                            <strong>Programación del mes</strong>
                            <small>Asignar integrantes a varias fechas</small>
                        </span>
                        <span class="services-action-arrow" aria-hidden="true">›</span>
                    </button>

                    <button type="button" class="services-action-card" id="services-responses-button">
                        <span class="services-action-icon services-icon-responses" aria-hidden="true"></span>
                        <span class="services-action-copy">
                            <strong>Respuestas de servidores</strong>
                            <small>Pendientes, confirmados y rechazados</small>
                        </span>
                        <span class="services-action-arrow" aria-hidden="true">›</span>
                    </button>
                </section>
            ` : ""}

            <section class="services-special-section" id="special-activity-card">
                <div class="services-section-heading">
                    <h2>Próxima actividad especial</h2>
                </div>

                <div class="services-special-card">
                    <span class="services-special-icon services-icon-special" aria-hidden="true"></span>
                    <div id="special-activity-content" class="services-special-content" style="visibility:hidden"></div>
                </div>

                ${isPastor() ? `
                    <button type="button" class="services-action-card services-add-activity" id="add-special-activity-button">
                        <span class="services-action-icon services-icon-add" aria-hidden="true"></span>
                        <span class="services-action-copy">
                            <strong>Agregar actividad especial</strong>
                            <small>Crear una nueva actividad</small>
                        </span>
                        <span class="services-action-arrow" aria-hidden="true">›</span>
                    </button>
                ` : ""}
            </section>
        </div>`;

    list.querySelector("#services-edit-month-button")?.addEventListener("click", openServicesProgrammingHome);
    list.querySelector("#services-responses-button")?.addEventListener("click", openServerResponses);
    list.querySelector("#add-special-activity-button")?.addEventListener("click", openSpecialActivityForm);

    ensureCleanServicesStyles();
    loadNextSpecialActivity();
}

function ensureCleanServicesStyles(){
    if(document.getElementById("clean-services-styles"))return;
    const style=document.createElement("style");
    style.id="clean-services-styles";
    style.textContent=`
        #servicios > .page-header{
            display:none !important;
        }
        #servicios > .service-detail-card{
            display:none !important;
        }
        #services-clean-home{
            display:block;
        }
        .server-response-card{
            padding:16px 0;
            border-bottom:1px solid rgba(255,255,255,.10);
        }
        .server-response-card:last-child{
            border-bottom:0;
        }
        .server-response-card h3{
            margin:4px 0;
        }
        .server-response-card p,
        .server-response-card small{
            margin:0;
        }
        .server-response-reason{
            display:block;
            margin-top:7px !important;
        }
    `;
    document.head.appendChild(style);
}


async function openSpecialActivityForm(){
    if(!isPastor())return alert("Solo Pastor puede agregar actividades especiales.");

    const screen=document.getElementById("servicios");
    if(!screen)return;
    const list=document.querySelector("#servicios .services-list");
    if(list)list.style.display="none";
    document.getElementById("service-detail")?.remove();

    const today=createDateString(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());

    const detail=document.createElement("section");
    detail.id="service-detail";
    detail.className="special-activity-screen";
    detail.innerHTML=`
        <button type="button" class="programming-back-top special-activity-back" id="back-from-special-activity">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Servicios</span>
        </button>

        <section class="special-activity-header">
            <p class="special-activity-eyebrow">SERVICIOS</p>
            <h1>Agregar actividad especial</h1>
            <p>Registra una actividad para toda la iglesia.</p>
        </section>

        <section class="special-activity-form" aria-label="Nueva actividad especial">
            <label class="special-field">
                <span class="special-field-label">Título</span>
                <span class="special-input-shell special-icon-title">
                    <input
                        id="special-activity-title"
                        type="text"
                        placeholder="Ej. Vigilia de oración"
                        autocomplete="off"
                    >
                </span>
            </label>

            <label class="special-field">
                <span class="special-field-label">Fecha</span>
                <span class="special-input-shell special-icon-date">
                    <input
                        id="special-activity-date"
                        type="date"
                        min="${today}"
                    >
                </span>
            </label>

            <label class="special-field">
                <span class="special-field-label">Hora de inicio</span>
                <span class="special-input-shell special-icon-time">
                    <input
                        id="special-activity-start"
                        type="time"
                    >
                </span>
            </label>

            <label class="special-field">
                <span class="special-field-label">Hora de finalización</span>
                <span class="special-input-shell special-icon-time">
                    <input
                        id="special-activity-end"
                        type="time"
                    >
                </span>
            </label>

            <label class="special-field">
                <span class="special-field-label">Lugar</span>
                <span class="special-input-shell special-icon-location">
                    <input
                        id="special-activity-location"
                        type="text"
                        value="Iglesia Sobrenatural"
                        autocomplete="off"
                    >
                </span>
            </label>

            <label class="special-field">
                <span class="special-field-label">Descripción</span>
                <span class="special-input-shell special-textarea-shell special-icon-description">
                    <textarea
                        id="special-activity-description"
                        rows="4"
                        placeholder="Descripción opcional"
                    ></textarea>
                </span>
            </label>
        </section>

        <section class="special-activity-actions">
            <p id="special-activity-message" class="special-activity-message" role="status"></p>
            <button type="button" class="special-save-button" id="save-special-activity">
                <span class="special-save-icon" aria-hidden="true"></span>
                <span class="special-save-copy">
                    <strong>Guardar actividad</strong>
                    <small>Publicar para la iglesia</small>
                </span>
            </button>
        </section>`;

    screen.appendChild(detail);
    window.scrollTo({top:0,behavior:"smooth"});

    detail.querySelector("#back-from-special-activity")?.addEventListener("click",()=>{
        detail.remove();
        if(list)list.style.display="";
        renderServices();
    });

    detail.querySelector("#save-special-activity")?.addEventListener("click",async()=>{
        const title=detail.querySelector("#special-activity-title")?.value.trim()||"";
        const activityDate=detail.querySelector("#special-activity-date")?.value||"";
        const startTime=detail.querySelector("#special-activity-start")?.value||null;
        const endTime=detail.querySelector("#special-activity-end")?.value||null;
        const location=detail.querySelector("#special-activity-location")?.value.trim()||null;
        const description=detail.querySelector("#special-activity-description")?.value.trim()||null;
        const message=detail.querySelector("#special-activity-message");
        const button=detail.querySelector("#save-special-activity");

        if(!title){
            if(message)message.textContent="Escribe el nombre de la actividad.";
            return;
        }
        if(!activityDate){
            if(message)message.textContent="Selecciona la fecha de la actividad.";
            return;
        }
        if(startTime&&endTime&&endTime<=startTime){
            if(message)message.textContent="La hora de finalización debe ser posterior a la hora de inicio.";
            return;
        }

        const old=button?.innerHTML||"";
        try{
            if(button){
                button.disabled=true;
                button.innerHTML=`
                    <span class="special-save-icon" aria-hidden="true"></span>
                    <span class="special-save-copy">
                        <strong>Guardando actividad…</strong>
                        <small>Un momento</small>
                    </span>`;
            }
            if(message)message.textContent="";

            await supabaseFetch("special_activities",{
                method:"POST",
                headers:{Prefer:"return=representation"},
                body:JSON.stringify({
                    title,
                    activity_date:activityDate,
                    start_time:startTime,
                    end_time:endTime,
                    description,
                    location,
                    created_by:window.currentUser?.id||null
                })
            });

            alert("Actividad especial creada correctamente.");
            detail.remove();
            if(list)list.style.display="";
            renderServices();
        }catch(e){
            console.error("Error creando actividad especial:",e);
            if(message)message.textContent=e.message||"No se pudo guardar la actividad.";
            if(button&&document.body.contains(button)){
                button.disabled=false;
                button.innerHTML=old;
            }
        }
    });
}

async function loadNextSpecialActivity(){
    const container=document.getElementById("special-activity-content");
    if(!container)return;

    try{
        const today=createDateString(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());
        const rows=await supabaseFetch(
            `special_activities?select=*&activity_date=gte.${today}&order=activity_date.asc,start_time.asc&limit=1`
        );
        const activity=Array.isArray(rows)&&rows.length?rows[0]:null;

        if(!activity){
            container.innerHTML=`<div class="ministry-member-item"><div class="ministry-member-info"><h3>Sin actividades especiales próximas</h3><p>Cuando Pastor agregue una actividad, aparecerá aquí.</p></div></div>`;
            container.style.visibility="visible";
            return;
        }

        const d=new Date(`${activity.activity_date}T00:00:00`);
        const dateLabel=d.toLocaleDateString("es-GT",{weekday:"long",day:"numeric",month:"long"});
        const pretty=dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1);
        const timeLabel=activity.start_time
            ? `${formatTime(activity.start_time)}${activity.end_time?` - ${formatTime(activity.end_time)}`:""}`
            : "Hora por confirmar";

        container.innerHTML=`
            <div class="ministry-member-item">
                <div class="ministry-member-info">
                    <small>ACTIVIDAD ESPECIAL</small>
                    <h3>${activity.title||"Actividad especial"}</h3>
                    <p>${pretty} · ${timeLabel}</p>
                    ${activity.location?`<small style="display:block;margin-top:6px">${activity.location}</small>`:""}
                    ${activity.description?`<small style="display:block;margin-top:6px">${activity.description}</small>`:""}
                </div>
            </div>`;
        container.style.visibility="visible";
    }catch(e){
        console.error("Error cargando actividad especial:",e);
        container.innerHTML=`<div class="ministry-member-item"><div class="ministry-member-info"><h3>No se pudo cargar</h3><p>Intenta nuevamente al volver a entrar a Servicios.</p></div></div>`;
        container.style.visibility="visible";
    }
}

async function loadAccessibleServerResponses(){
    const today=new Date();today.setHours(0,0,0,0);
    const allowedMinistries=isPastor()
        ? new Set((window.currentMinistries||[]).map(m=>m.id))
        : new Set((window.currentLedMinistries||[]).map(m=>m.ministry_id));

    const rows=await supabaseFetch("assignments?select=*&order=created_at.desc");
    const assignments=(Array.isArray(rows)?rows:[]).filter(a=>{
        const service=(window.currentServices||[]).find(s=>s.id===a.service_id);
        if(!service?.service_date)return false;
        if(new Date(`${service.service_date}T00:00:00`)<today)return false;
        return allowedMinistries.has(a.ministry_id);
    });

    // El overview ya contiene nombre/apellido y evita que la pantalla termine
    // mostrando solamente "Servidor" cuando la tabla people no es legible por RLS.
    const serviceIds=[...new Set(assignments.map(a=>a.service_id).filter(Boolean))];
    const overviewByService=new Map();
    await Promise.all(serviceIds.map(async serviceId=>{
        try{
            const overview=await getServiceAssignmentOverview(serviceId);
            overviewByService.set(serviceId,Array.isArray(overview)?overview:[]);
        }catch{
            overviewByService.set(serviceId,[]);
        }
    }));

    return assignments.map(a=>{
        const overview=(overviewByService.get(a.service_id)||[]).find(x=>
            (x.assignment_id||x.id)===a.id ||
            (x.person_id===a.person_id && x.ministry_id===a.ministry_id)
        );
        return {
            assignment:a,
            person:overview?{
                first_name:overview.first_name||"",
                last_name:overview.last_name||""
            }:null,
            service:(window.currentServices||[]).find(s=>s.id===a.service_id),
            ministry:(window.currentMinistries||[]).find(m=>m.id===a.ministry_id)
        };
    }).filter(x=>x.service).sort((a,b)=>
        `${a.service.service_date} ${a.service.start_time||""}`.localeCompare(`${b.service.service_date} ${b.service.start_time||""}`)
    );
}

function responseCardHtml(item){
    const a=item.assignment;
    const name=item.person?`${item.person.first_name||""} ${item.person.last_name||""}`.trim():"Servidor";
    const rejected=a.status==="reclinado"||a.status==="rechazado";
    const confirmed=a.status==="confirmado";
    const status=assignmentStatus(a);
    const statusKey=rejected?"rejected":confirmed?"confirmed":"pending";
    const d=new Date(`${item.service.service_date}T00:00:00`);
    const dateLabel=d.toLocaleDateString("es-GT",{weekday:"long",day:"numeric",month:"short"}).replace(/\./g,"");
    const pretty=dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1);
    const ministryName=item.ministry?.name||"Ministerio";

    return `<article class="server-response-card-new is-${statusKey}">
        <div class="server-response-card-icon" data-ministry="${ministryName}" aria-hidden="true"></div>

        <div class="server-response-card-body">
            <div class="server-response-card-top">
                <h3>${name||"Servidor"}</h3>
                <span class="server-response-badge is-${statusKey}">
                    <span class="server-response-badge-icon" aria-hidden="true"></span>
                    ${status}
                </span>
            </div>

            <p class="server-response-ministry">
                <span class="server-response-mini-icon icon-people" aria-hidden="true"></span>
                ${ministryName}
            </p>

            <p class="server-response-date">
                <span class="server-response-mini-icon icon-date" aria-hidden="true"></span>
                ${pretty} · ${formatTime(item.service.start_time)}
            </p>

            ${rejected&&a.rejection_reason?`
                <div class="server-response-reason">
                    <span class="server-response-reason-icon" aria-hidden="true"></span>
                    <span><strong>Motivo:</strong> ${a.rejection_reason}</span>
                </div>
            `:""}
        </div>
    </article>`;
}

function ensureServerResponseStyles(){
    if(document.getElementById("server-response-compact-styles"))return;
    const style=document.createElement("style");
    style.id="server-response-compact-styles";
    style.textContent="";
    document.head.appendChild(style);
}

async function openServerResponses(){
    if(!isPastor()&&!isLeader())return alert("No tienes permiso para ver respuestas de servidores.");

    const screen=document.getElementById("servicios");
    if(!screen)return;
    const list=document.querySelector("#servicios .services-list");
    if(list)list.style.display="none";
    document.getElementById("service-detail")?.remove();

    const detail=document.createElement("section");
    detail.id="service-detail";
    detail.className="services-responses-screen";
    detail.innerHTML=`<section class="page-header"><p class="eyebrow">SERVICIOS</p><h1>Respuestas de servidores</h1><p>Cargando respuestas…</p></section>`;
    screen.appendChild(detail);
    window.scrollTo({top:0,behavior:"smooth"});

    try{
        const items=await loadAccessibleServerResponses();
        ensureServerResponseStyles();

        const isRejected=x=>x.assignment.status==="reclinado"||x.assignment.status==="rechazado";
        const isConfirmed=x=>x.assignment.status==="confirmado";
        const groups={
            todos:items,
            pendientes:items.filter(x=>!isConfirmed(x)&&!isRejected(x)),
            confirmados:items.filter(isConfirmed),
            rechazados:items.filter(isRejected)
        };

        detail.innerHTML=`
            <button type="button" class="responses-back-top" id="back-from-server-responses">
                <span class="responses-back-circle" aria-hidden="true">‹</span>
                <span>Volver a Servicios</span>
            </button>

            <section class="responses-header">
                <p class="responses-eyebrow">SERVICIOS</p>
                <h1>Respuestas de servidores</h1>
                <p>${isPastor()?"Todos los ministerios":"Tus ministerios"}</p>
            </section>

            <div class="server-response-filters" role="tablist" aria-label="Filtrar respuestas">
                <button type="button" class="server-response-filter is-active" data-filter="todos">Todos (${groups.todos.length})</button>
                <button type="button" class="server-response-filter" data-filter="pendientes">Pendientes (${groups.pendientes.length})</button>
                <button type="button" class="server-response-filter" data-filter="confirmados">Confirmados (${groups.confirmados.length})</button>
                <button type="button" class="server-response-filter" data-filter="rechazados">Rechazados (${groups.rechazados.length})</button>
            </div>

            <section class="server-response-list" id="server-response-list"></section>`;

        const listEl=detail.querySelector("#server-response-list");

        const renderFilter=filter=>{
            const rows=groups[filter]||[];
            if(listEl)listEl.innerHTML=rows.length
                ? rows.map(responseCardHtml).join("")
                : `<div class="server-response-empty">
                    <span class="server-response-empty-icon" aria-hidden="true"></span>
                    <strong>No hay respuestas en esta categoría</strong>
                    <p>Cuando haya respuestas de servidores, aparecerán aquí.</p>
                   </div>`;

            detail.querySelectorAll(".server-response-filter").forEach(btn=>{
                btn.classList.toggle("is-active",btn.dataset.filter===filter);
            });
        };

        detail.querySelectorAll(".server-response-filter").forEach(btn=>{
            btn.addEventListener("click",()=>renderFilter(btn.dataset.filter));
        });

        renderFilter("todos");

        detail.querySelector("#back-from-server-responses")?.addEventListener("click",()=>{
            detail.remove();
            if(list)list.style.display="";
            renderServices();
        });
    }catch(e){
        console.error("Error cargando respuestas:",e);
        detail.className="services-responses-screen";
        detail.innerHTML=`
            <button type="button" class="responses-back-top" id="back-from-server-responses">
                <span class="responses-back-circle" aria-hidden="true">‹</span>
                <span>Volver a Servicios</span>
            </button>
            <section class="responses-header">
                <p class="responses-eyebrow">SERVICIOS</p>
                <h1>Respuestas de servidores</h1>
                <p>No se pudieron cargar las respuestas.</p>
            </section>`;
        detail.querySelector("#back-from-server-responses")?.addEventListener("click",()=>{
            detail.remove();
            if(list)list.style.display="";
            renderServices();
        });
        alert(e.message||"No se pudieron cargar las respuestas de servidores.");
    }
}


function renderServicesProgrammingShortcut() {
    // Compatibilidad: Programación del mes ahora se renderiza directamente
    // dentro de renderServices(), junto con Respuestas y Actividad especial.
}

async function openServicesProgrammingHome() {
    try {
        if(!window.currentMinistries.length)await loadMinistries();

        const manageable=isPastor()
            ? (window.currentMinistries||[])
            : (window.currentMinistries||[]).filter(m=>canManageMinistry(m.id));

        if(!manageable.length){
            alert("No tienes ministerios disponibles para programar.");
            return;
        }

        // Si el líder administra un solo ministerio, entra directamente
        // al editor mensual: integrante + fechas, sin pantalla intermedia.
        if(!isPastor()&&manageable.length===1){
            await openMonthlyProgrammingDirect(manageable[0]);
            return;
        }

        renderServicesProgrammingMinistryPicker(manageable);
    }catch(e){
        alert(e.message||"No se pudo abrir la programación.");
    }
}

function prepareServicesProgrammingDetail() {
    const screen=document.getElementById("servicios");
    if(!screen)return null;

    document.getElementById("service-detail")?.remove();

    const list=document.querySelector("#servicios .services-list");
    const top=document.querySelector("#servicios .service-detail-card");
    const shortcut=document.getElementById("services-programming-shortcut");

    if(list)list.style.display="none";
    if(top)top.style.display="none";
    if(shortcut)shortcut.style.display="none";

    const detail=document.createElement("section");
    detail.id="service-detail";
    screen.appendChild(detail);
    return detail;
}

function renderServicesProgrammingMinistryPicker(ministries) {
    const screen=document.getElementById("servicios");
    if(!screen)return;

    document.getElementById("service-detail")?.remove();

    const list=document.querySelector("#servicios .services-list");
    const top=document.querySelector("#servicios .service-detail-card");
    const shortcut=document.getElementById("services-programming-shortcut");
    if(list)list.style.display="none";
    if(top)top.style.display="none";
    if(shortcut)shortcut.style.display="none";

    const detail=document.createElement("section");
    detail.id="service-detail";
    detail.className="services-programming-picker";
    detail.innerHTML=`
        <button type="button" class="programming-back-top" id="back-from-services-programming">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Servicios</span>
        </button>

        <section class="page-header programming-picker-header">
            <p class="eyebrow">PROGRAMACIÓN</p>
            <h1>Editar programación del mes</h1>
            <p>Selecciona el ministerio que deseas programar.</p>
        </section>

        <section class="programming-ministries-section">
            <div class="programming-count">${ministries.length} ministerios</div>

            <div class="programming-ministries-list">
                ${ministries.map(m=>`
                    <button
                        type="button"
                        class="programming-ministry-card services-programming-ministry"
                        data-ministry-id="${m.id}"
                        data-ministry-name="${m.name}"
                    >
                        <span class="programming-ministry-icon" aria-hidden="true"></span>
                        <span class="programming-ministry-copy">
                            <strong>${m.name}</strong>
                            <small>Editar servicios del mes</small>
                        </span>
                        <span class="programming-ministry-arrow" aria-hidden="true">›</span>
                    </button>
                `).join("")}
            </div>
        </section>`;

    screen.appendChild(detail);

    detail.querySelectorAll(".services-programming-ministry").forEach(button=>{
        button.addEventListener("click",async()=>{
            const ministry=(window.currentMinistries||[]).find(m=>m.id===button.dataset.ministryId);
            if(ministry)await openMonthlyProgrammingDirect(ministry);
        });
    });

    detail.querySelector("#back-from-services-programming")?.addEventListener("click",()=>{
        detail.remove();
        if(list)list.style.display="";
        if(top)top.style.display="";
        if(shortcut)shortcut.style.display="";
        renderServices();
        window.scrollTo({top:0,behavior:"smooth"});
    });

    window.scrollTo({top:0,behavior:"smooth"});
}
function attachServiceClickEvents() {
    document.querySelectorAll(".service-list-item[data-service-id]").forEach(el=>el.addEventListener("click",()=>openServiceDetail(el.dataset.serviceId)));
}
function getServiceById(id) { return (window.currentServices||[]).find(s=>s.id===id)||null; }
async function getServiceAssignments(id) {
    const x = await supabaseFetch(`assignments?select=*&service_id=eq.${id}&order=created_at.asc`);
    return Array.isArray(x)?x:[];
}
async function getServiceAssignmentOverview(id) {
    const x = await supabaseRpc("get_service_assignment_overview",{p_service_id:id});
    return Array.isArray(x)?x:[];
}
function getPersonServiceAssignment(overview,id) { return (overview||[]).find(a=>a.person_id===id)||null; }
async function getAssignmentPeople(assignments) {
    const ids=[...new Set((assignments||[]).map(a=>a.person_id).filter(Boolean))];
    if(!ids.length)return [];
    try {
        const x=await supabaseFetch(`people?select=id,first_name,last_name&id=in.(${ids.join(",")})`);
        return Array.isArray(x)?x:[];
    } catch { return []; }
}
function getAssignmentPersonById(p,id){return (p||[]).find(x=>x.id===id)||null;}

/* =========================================================
   QUITAR ASIGNACIÓN
========================================================= */
async function removeAssignment(assignmentId) {
    if (!assignmentId) throw new Error("No se encontró la asignación.");
    return await supabaseRpc("remove_assignment",{p_assignment_id:assignmentId});
}
async function confirmRemoveAssignment(service,ministry,assignment,personName,button=null) {
    if (!service || !ministry || !assignment?.id) return false;
    if (!canManageMinistry(ministry.id)) {
        alert("No tienes permiso para quitar esta asignación.");
        return false;
    }
    if (!window.confirm(`¿Quitar a ${personName} de ${ministry.name} para ${formatLongDate(service.service_date)}?`)) return false;
    const old = button?.innerHTML || "";
    try {
        if(button){button.disabled=true;button.textContent="Quitando...";}
        await removeAssignment(assignment.id);
        await loadMyNextAssignment();
        return true;
    } catch(e) {
        console.error(e); alert(e.message||"No se pudo quitar la asignación."); return false;
    } finally {
        if(button && document.body.contains(button)){button.disabled=false;button.innerHTML=old;}
    }
}

/* =========================================================
   DETALLE SERVICIO
========================================================= */
async function openServiceDetail(serviceId) {
    const service=getServiceById(serviceId);
    if(!service)return alert("No se encontró el servicio.");
    window.currentServiceDetail=service; window.currentProgrammingService=null;
    try {
        if(!window.currentMinistries.length) await loadMinistries();
        if(!isPastor() && !isLeader()){
            renderServerServiceDetail(service);
            return;
        }
        const assignments=await getServiceAssignments(service.id);
        const people=await getAssignmentPeople(assignments);
        renderServiceMinistries(service,assignments,people);
    } catch(e){alert(e.message||"No se pudo cargar el servicio.");}
}
function renderServerServiceDetail(service) {
    const screen=document.getElementById("servicios"); if(!screen)return;
    document.getElementById("service-detail")?.remove();
    const myAssignment=(window.currentAssignment?.service_id===service.id)?window.currentAssignment:null;
    const ministry=myAssignment?(window.currentMinistries||[]).find(m=>m.id===myAssignment.ministry_id):null;
    const detail=document.createElement("section"); detail.id="service-detail";
    detail.innerHTML=`<section class="page-header"><p class="eyebrow">SERVICIO</p><h1>${service.title||"Servicio"}</h1><p>${formatDay(service.service_date)} · ${formatTime(service.start_time)}${service.end_time?` - ${formatTime(service.end_time)}`:""}</p>${service.location?`<small>${service.location}</small>`:""}</section><section class="ministry-detail-card"><div class="section-heading"><h2>Mi asignación</h2></div>${myAssignment?`<div class="ministry-member-item"><div class="ministry-member-info"><h3>${ministry?.name||"Ministerio asignado"}</h3><p>${assignmentStatus(myAssignment)}</p></div></div>`:`<div class="ministry-member-item"><div class="ministry-member-info"><h3>Sin asignación</h3><p>No estás asignado a este servicio.</p></div></div>`}</section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-services"><span>Volver a servicios</span><span>‹</span></button></section>`;
    screen.appendChild(detail);
    const list=document.querySelector("#servicios .services-list"),top=document.querySelector("#servicios .service-detail-card");
    if(list)list.style.display="none"; if(top)top.style.display="none";
    detail.querySelector("#back-to-services")?.addEventListener("click",()=>{detail.remove();if(list)list.style.display="";if(top)top.style.display="";});
    window.scrollTo({top:0,behavior:"smooth"});
}
function renderServiceMinistries(service,assignments) {
    const screen=document.getElementById("servicios"); if(!screen)return;
    document.getElementById("service-detail")?.remove();
    const ministries=isPastor()?(window.currentMinistries||[]):(window.currentMinistries||[]).filter(m=>canManageMinistry(m.id));
    const detail=document.createElement("section"); detail.id="service-detail";
    detail.innerHTML=`<section class="page-header"><p class="eyebrow">SERVICIO</p><h1>${service.title||"Servicio"}</h1><p>${formatDay(service.service_date)} · ${formatTime(service.start_time)}${service.end_time?` - ${formatTime(service.end_time)}`:""}</p>${service.location?`<small>${service.location}</small>`:""}</section>
    <section class="ministry-detail-card"><div class="section-heading"><h2>Ministerios</h2><span>${ministries.length}</span></div><div id="service-ministry-list">
    ${ministries.map(m=>{const n=assignments.filter(a=>a.ministry_id===m.id).length;return `<button type="button" class="profile-option service-ministry-button" data-ministry-id="${m.id}"><span><strong>${m.name}</strong><small style="display:block;margin-top:4px">${n===1?"1 asignado":`${n} asignados`}${canManageMinistry(m.id)?" · Administrar":""}</small></span><span>›</span></button>`}).join("")}
    </div></section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-services"><span>Volver a servicios</span><span>‹</span></button></section>`;
    screen.appendChild(detail);
    const list=document.querySelector("#servicios .services-list"),top=document.querySelector("#servicios .service-detail-card");
    if(list)list.style.display="none"; if(top)top.style.display="none";
    detail.querySelectorAll(".service-ministry-button").forEach(b=>b.addEventListener("click",()=>openServiceMinistry(service.id,b.dataset.ministryId)));
    detail.querySelector("#back-to-services")?.addEventListener("click",()=>{detail.remove();if(list)list.style.display="";if(top)top.style.display="";});
    window.scrollTo({top:0,behavior:"smooth"});
}
async function openServiceMinistry(serviceId,ministryId) {
    if(!isPastor() && !isLeader())return alert("No tienes permiso para ver las asignaciones de este ministerio.");
    if(isLeader() && !canManageMinistry(ministryId))return alert("No tienes permiso para ver las asignaciones de este ministerio.");
    const service=getServiceById(serviceId), ministry=window.currentMinistries.find(x=>x.id===ministryId);
    if(!service||!ministry)return alert("No se encontró el ministerio.");
    window.currentSelectedMinistry=ministry;
    try {
        const canManage=canManageMinistry(ministryId);
        const [assignments,overview]=await Promise.all([getServiceAssignments(serviceId),getServiceAssignmentOverview(serviceId)]);
        const members=canManage?await getMinistryMembers(ministryId):[];
        const ma=assignments.filter(a=>a.ministry_id===ministryId);
        const people=await getAssignmentPeople(ma);
        const availability=members.map(m=>{const e=getPersonServiceAssignment(overview,m.person_id);return {...m,existingAssignment:e,isAssigned:!!e,isAssignedHere:e?.ministry_id===ministryId,assignedMinistryName:e?.ministry_name||null};});
        renderServiceMinistryDetail(service,ministry,ma,availability,people);
    } catch(e){console.error(e);alert(e.message||"No se pudo cargar el ministerio.");}
}
function renderServiceMinistryDetail(service,ministry,assignments,members,people) {
    const detail=document.getElementById("service-detail"); if(!detail)return;
    const canManage=canManageMinistry(ministry.id);
    detail.innerHTML=`<section class="page-header"><p class="eyebrow">${service.title||"SERVICIO"}</p><h1>${ministry.name}</h1><p>${formatDay(service.service_date)} · ${formatTime(service.start_time)}</p>${canManage?"<small>Puedes administrar este ministerio.</small>":""}</section>
    ${canManage?`<section class="ministry-detail-actions"><button type="button" class="profile-option" id="open-ministry-programming"><span><strong>Programar próximos servicios</strong><small style="display:block;margin-top:4px">Asignar integrantes por fecha</small></span><span>›</span></button></section>`:""}
    <section class="ministry-detail-card"><div class="section-heading"><h2>Asignados</h2><span>${assignments.length}</span></div>
    ${assignments.length?assignments.map(a=>{const p=members.find(x=>x.person_id===a.person_id)||getAssignmentPersonById(people,a.person_id);const name=p?`${p.first_name||""} ${p.last_name||""}`.trim():"Persona asignada";return `<div class="ministry-member-item"><div class="ministry-member-info"><h3>${name}</h3><p>${assignmentStatus(a)}</p>${(a.status==="reclinado"||a.status==="rechazado")&&a.rejection_reason?`<small>Motivo del rechazo: ${a.rejection_reason}</small>`:""}${a.conflict_override?`<small>Excepción pastoral${a.conflict_note?` · ${a.conflict_note}`:""}</small>`:""}</div>${canManage?`<button type="button" class="assignment-remove-button" data-assignment-id="${a.id}" data-person-name="${name}">Quitar</button>`:""}</div>`}).join(""):`<div class="ministry-member-item"><div class="ministry-member-info"><h3>Sin asignaciones</h3><p>Todavía no hay personas asignadas.</p></div></div>`}
    </section>
    ${canManage?`<section class="ministry-detail-card"><div class="section-heading"><h2>Integrantes</h2><span>${members.length}</span></div>${members.map(m=>m.isAssignedHere?`<div class="profile-option"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px;opacity:.7">${ministry.name} · Ya asignado</small></span><span>✓</span></div>`:m.isAssigned?`<div class="profile-option" style="opacity:.55;cursor:not-allowed"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px">Ya asignado a ${m.assignedMinistryName||"otro ministerio"}</small></span><span>—</span></div>`:`<button type="button" class="profile-option assignment-member-button" data-person-id="${m.person_id}"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px;opacity:.7">Disponible</small></span><span>+</span></button>`).join("")}</section>`:""}
    <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-service-ministries"><span>Volver a ministerios</span><span>‹</span></button></section>`;
    detail.querySelectorAll(".assignment-member-button").forEach(b=>b.addEventListener("click",()=>handleCreateAssignment(service,ministry,b.dataset.personId,b)));
    detail.querySelectorAll(".assignment-remove-button").forEach(b=>b.addEventListener("click",async()=>{const a=assignments.find(x=>x.id===b.dataset.assignmentId);if(a&&await confirmRemoveAssignment(service,ministry,a,b.dataset.personName||"esta persona",b))await openServiceMinistry(service.id,ministry.id);}));
    detail.querySelector("#open-ministry-programming")?.addEventListener("click",()=>openMinistryProgramming(ministry.id));
    detail.querySelector("#back-to-service-ministries")?.addEventListener("click",()=>openServiceDetail(service.id));
    window.scrollTo({top:0,behavior:"smooth"});
}

/* =========================================================
   PROGRAMACIÓN
========================================================= */
async function openMinistryProgramming(ministryId) {
    const ministry=window.currentMinistries.find(x=>x.id===ministryId);
    if(!ministry)return alert("No se encontró el ministerio.");
    if(!canManageMinistry(ministryId))return alert("No tienes permiso para programar este ministerio.");
    window.currentProgrammingMinistry=ministry;

    try {
        const members=await getMinistryMembers(ministryId);
        const services=getUpcomingServices();
        const data=await Promise.all(services.map(async service=>{
            const overview=await getServiceAssignmentOverview(service.id);
            return {service,overview,ministryAssignments:overview.filter(a=>a.ministry_id===ministryId)};
        }));
        renderMinistryProgramming(ministry,members,data);
    } catch(e){
        alert(e.message||"No se pudo cargar la programación.");
    }
}

function renderMinistryProgramming(ministry,members,data) {
    const detail=document.getElementById("service-detail");if(!detail)return;
    detail.classList.remove("services-monthly-editor");

    const now=new Date();
    const months=Array.from({length:3},(_,i)=>{
        const d=new Date(now.getFullYear(),now.getMonth()+i,1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    });
    const currentMonth=months[0]||"";
    const monthLabel=currentMonth
        ? new Date(`${currentMonth}-01T00:00:00`).toLocaleDateString("es-GT",{month:"long",year:"numeric"})
        : "Sin servicios";

    detail.innerHTML=`<section class="page-header">
        <p class="eyebrow">PROGRAMACIÓN</p>
        <h1>${ministry.name}</h1>
        <p>Programa varios servicios del mes desde una sola pantalla.</p>
    </section>

    <section class="ministry-detail-actions">
        <button type="button" class="profile-option" id="open-monthly-programming">
            <span>
                <strong>Editar servicios del mes</strong>
                <small style="display:block;margin-top:4px">${monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)} · selección múltiple</small>
            </span>
            <span>›</span>
        </button>
    </section>

    <section class="ministry-detail-card">
        <div class="section-heading"><h2>Próximos servicios</h2><span>${data.length}</span></div>
        ${data.map(item=>{
            const s=item.service;
            const n=item.ministryAssignments.length
                ? item.ministryAssignments.map(a=>`${a.first_name||""} ${a.last_name||""}`.trim()).join(", ")
                : "Sin integrantes asignados";
            return `<button type="button" class="profile-option programming-service-button" data-service-id="${s.id}">
                <span>
                    <strong>${formatDay(s.service_date)} · ${formatDate(s.service_date)}</strong>
                    <small style="display:block;margin-top:4px">${formatTime(s.start_time)}</small>
                    <small style="display:block;margin-top:6px;opacity:.7">${n}</small>
                </span>
                <span>›</span>
            </button>`;
        }).join("")}
    </section>

    <section class="ministry-detail-actions">
        <button type="button" class="profile-option" id="back-from-programming">
            <span>Volver al ministerio</span><span>‹</span>
        </button>
    </section>`;

    detail.querySelector("#open-monthly-programming")?.addEventListener("click",()=>openMonthlyProgramming(ministry,members,data,currentMonth));
    detail.querySelectorAll(".programming-service-button").forEach(b=>b.addEventListener("click",()=>openProgrammingService(ministry,members,b.dataset.serviceId)));
    detail.querySelector("#back-from-programming")?.addEventListener("click",()=>window.currentServiceDetail?openServiceMinistry(window.currentServiceDetail.id,ministry.id):showScreen("servicios"));
}

function renderMonthlyServiceChecks(services, selectedIds){
    return services.map(s=>`<label class="monthly-service-row">
        <span class="monthly-service-date-icon" aria-hidden="true"></span>
        <span class="monthly-service-copy">
            <strong>${formatDay(s.service_date)} · ${formatDate(s.service_date)}</strong>
            <small>${formatTime(s.start_time)} · ${s.title||"Servicio"}</small>
        </span>
        <input type="checkbox" class="monthly-service-check" value="${s.id}" ${selectedIds.has(s.id)?"checked":""}>
        <span class="monthly-check-ui" aria-hidden="true"></span>
    </label>`).join("");
}

async function openMonthlyProgrammingDirect(ministry) {
    if(!ministry)return alert("No se encontró el ministerio.");
    if(!canManageMinistry(ministry.id))return alert("No tienes permiso para programar este ministerio.");

    window.currentProgrammingMinistry=ministry;

    try{
        prepareServicesProgrammingDetail();

        const members=await getMinistryMembers(ministry.id);
        const services=getUpcomingServices();
        const data=await Promise.all(services.map(async service=>{
            const overview=await getServiceAssignmentOverview(service.id);
            return {
                service,
                overview,
                ministryAssignments:overview.filter(a=>a.ministry_id===ministry.id)
            };
        }));

        const now=new Date();
        const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
        openMonthlyProgramming(ministry,members,data,currentMonth);
    }catch(e){
        alert(e.message||"No se pudo cargar la programación mensual.");
        renderServices();
    }
}

function openMonthlyProgramming(ministry,members,data,initialMonth="") {
    const detail=document.getElementById("service-detail");if(!detail)return;
    if(!canManageMinistry(ministry.id))return alert("No tienes permiso para programar este ministerio.");

    detail.className="services-monthly-editor";

    const now=new Date();
    const months=Array.from({length:3},(_,i)=>{
        const d=new Date(now.getFullYear(),now.getMonth()+i,1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    });
    let selectedMonth=months.includes(initialMonth)?initialMonth:(months[0]||"");

    const render=()=>{
        const monthData=data.filter(item=>String(item.service.service_date||"").startsWith(selectedMonth));
        const monthServices=monthData.map(item=>item.service);
        const monthName=selectedMonth
            ? new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("es-GT",{month:"long",year:"numeric"})
            : "Sin servicios";
        const displayMonth=monthName.charAt(0).toUpperCase()+monthName.slice(1);

        detail.innerHTML=`
        <button type="button" class="programming-back-top monthly-back-top" id="back-from-monthly-programming">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a programación</span>
        </button>

        <section class="page-header monthly-editor-header">
            <p class="eyebrow">EDITAR SERVICIOS</p>
            <h1>${ministry.name}</h1>
            <p>${displayMonth}</p>
        </section>

        <section class="monthly-controls">
            <label class="monthly-control-card">
                <span class="monthly-control-icon monthly-control-icon-calendar" aria-hidden="true"></span>
                <span class="monthly-control-copy">
                    <strong>Mes</strong>
                    <span class="monthly-select-wrap">
                        <select id="monthly-programming-month" aria-label="Mes de programación">
                            ${months.map(month=>{
                                const label=new Date(`${month}-01T00:00:00`).toLocaleDateString("es-GT",{month:"long",year:"numeric"});
                                const pretty=label.charAt(0).toUpperCase()+label.slice(1);
                                return `<option value="${month}" ${month===selectedMonth?"selected":""}>${pretty}</option>`;
                            }).join("")}
                        </select>
                    </span>
                </span>
                <span class="monthly-control-chevron" aria-hidden="true">⌄</span>
            </label>

            <label class="monthly-control-card">
                <span class="monthly-control-icon monthly-control-icon-person" aria-hidden="true"></span>
                <span class="monthly-control-copy">
                    <strong>Integrante</strong>
                    <span class="monthly-select-wrap">
                        <select id="monthly-programming-person" aria-label="Integrante">
                            <option value="">Selecciona un integrante</option>
                            ${members.map(m=>`<option value="${m.person_id}">${m.first_name||""} ${m.last_name||""}</option>`).join("")}
                        </select>
                    </span>
                </span>
                <span class="monthly-control-chevron monthly-person-chevron" aria-hidden="true">›</span>
            </label>
        </section>

        <section class="monthly-services-section">
            <div class="monthly-services-heading">
                <h2>Servicios del mes</h2>
                <span>${monthServices.length} servicios</span>
            </div>
            <div id="monthly-service-checks" class="monthly-service-list">
                ${renderMonthlyServiceChecks(monthServices,new Set())}
            </div>
        </section>

        <section class="monthly-save-section">
            <p id="monthly-programming-message" class="monthly-programming-message"></p>
            <button type="button" class="monthly-save-glass" id="save-monthly-programming">
                <span class="monthly-save-icon" aria-hidden="true"></span>
                <span class="monthly-save-copy">
                    <strong>Guardar programación</strong>
                    <small>Aplicar las fechas seleccionadas</small>
                </span>
            </button>
        </section>`;

        const monthSelect=detail.querySelector("#monthly-programming-month");
        const personSelect=detail.querySelector("#monthly-programming-person");

        monthSelect?.addEventListener("change",()=>{
            selectedMonth=monthSelect.value;
            render();
        });

        personSelect?.addEventListener("change",()=>{
            const personId=personSelect.value;
            const selected=new Set();
            if(personId){
                monthData.forEach(item=>{
                    if(item.overview.some(a=>a.person_id===personId && a.ministry_id===ministry.id)){
                        selected.add(item.service.id);
                    }
                });
            }
            const checks=detail.querySelector("#monthly-service-checks");
            if(checks)checks.innerHTML=renderMonthlyServiceChecks(monthServices,selected);
        });

        detail.querySelector("#save-monthly-programming")?.addEventListener("click",()=>saveMonthlyProgramming(ministry,members,monthData,selectedMonth));
        detail.querySelector("#back-from-monthly-programming")?.addEventListener("click",()=>{
            const manageable=isPastor()
                ? (window.currentMinistries||[])
                : (window.currentMinistries||[]).filter(m=>canManageMinistry(m.id));
            detail.classList.remove("services-monthly-editor");
            if(isPastor()||manageable.length>1){
                renderServicesProgrammingMinistryPicker(manageable);
            }else{
                showScreen("servicios");
            }
        });
        window.scrollTo({top:0,behavior:"smooth"});
    };

    render();
}

async function saveMonthlyProgramming(ministry,members,monthData,selectedMonth){
    const detail=document.getElementById("service-detail");if(!detail)return;
    const personId=detail.querySelector("#monthly-programming-person")?.value||"";
    const message=detail.querySelector("#monthly-programming-message");
    const button=detail.querySelector("#save-monthly-programming");
    const selectedIds=new Set([...detail.querySelectorAll(".monthly-service-check:checked")].map(x=>x.value));

    if(!personId){
        if(message)message.textContent="Selecciona un integrante.";
        return;
    }

    const member=members.find(m=>m.person_id===personId);
    const personName=member?`${member.first_name||""} ${member.last_name||""}`.trim():"este integrante";
    const existingHere=new Map();

    monthData.forEach(item=>{
        const a=item.overview.find(x=>x.person_id===personId && x.ministry_id===ministry.id);
        if(a)existingHere.set(item.service.id,a);
    });

    const toAdd=monthData.filter(item=>selectedIds.has(item.service.id)&&!existingHere.has(item.service.id));
    const toRemove=monthData.filter(item=>!selectedIds.has(item.service.id)&&existingHere.has(item.service.id));

    if(!toAdd.length&&!toRemove.length){
        if(message)message.textContent="No hay cambios que guardar.";
        return;
    }

    const summary=[
        toAdd.length?`${toAdd.length} asignación${toAdd.length===1?"":"es"} nueva${toAdd.length===1?"":"s"}`:"",
        toRemove.length?`${toRemove.length} asignación${toRemove.length===1?"":"es"} a quitar`:""
    ].filter(Boolean).join(" y ");

    if(!confirm(`¿Guardar la programación de ${personName}?\n\nSe aplicarán ${summary}.`))return;

    const old=button?.innerHTML||"";
    try{
        if(button){button.disabled=true;button.innerHTML="<span>Guardando programación...</span><span>…</span>";}
        if(message)message.textContent="";

        // Primero agregamos. Se reutilizan exactamente las reglas ya existentes:
        // permisos, doble asignación y conflictos de horario.
        for(const item of toAdd){
            const ok=await processAssignmentCreation(item.service,ministry,personId,null);
            if(!ok)throw new Error(`La programación se detuvo en ${formatLongDate(item.service.service_date)}.`);
        }

        // Luego quitamos únicamente asignaciones de este mismo ministerio/persona.
        for(const item of toRemove){
            const a=existingHere.get(item.service.id);
            const assignmentId=a?.assignment_id||a?.id;
            if(assignmentId)await removeAssignment(assignmentId);
        }

        await loadMyNextAssignment();
        alert(`Programación de ${personName} actualizada correctamente.`);
        await openMinistryProgramming(ministry.id);
    }catch(error){
        console.error("Error guardando programación mensual:",error);
        if(message)message.textContent=error.message||"No se pudo guardar toda la programación.";
        if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}
    }
}

async function openProgrammingService(ministry,members,serviceId) {
    const service=getServiceById(serviceId);if(!service)return alert("No se encontró el servicio.");
    if(!canManageMinistry(ministry.id))return alert("No tienes permiso para administrar este ministerio.");
    window.currentProgrammingService=service;
    try { renderProgrammingService(ministry,members,service,await getServiceAssignmentOverview(service.id)); }
    catch(e){alert(e.message||"No se pudo cargar esta fecha.");}
}
function renderProgrammingService(ministry,members,service,overview) {
    const detail=document.getElementById("service-detail");if(!detail)return;
    const assigned=overview.filter(a=>a.ministry_id===ministry.id);
    detail.innerHTML=`<section class="page-header"><p class="eyebrow">${ministry.name}</p><h1>${formatDay(service.service_date)}</h1><p>${formatDate(service.service_date)} · ${formatTime(service.start_time)}</p><small>${service.title||"Servicio"}</small></section>
    <section class="ministry-detail-card"><div class="section-heading"><h2>Asignados</h2><span>${assigned.length}</span></div>
    ${assigned.length?assigned.map(a=>{const name=`${a.first_name||""} ${a.last_name||""}`.trim()||"Persona asignada";return `<div class="ministry-member-item"><div class="ministry-member-info"><h3>${name}</h3><p>${assignmentStatus(a)}</p></div><button type="button" class="programming-remove-button" data-assignment-id="${a.assignment_id||a.id}" data-person-name="${name}">Quitar</button></div>`}).join(""):`<div class="ministry-member-item"><div class="ministry-member-info"><h3>Sin asignaciones</h3><p>Todavía no has programado integrantes para esta fecha.</p></div></div>`}
    </section>
    <section class="ministry-detail-card"><div class="section-heading"><h2>Integrantes</h2><span>${members.length}</span></div>
    ${members.map(m=>{const e=getPersonServiceAssignment(overview,m.person_id);if(e?.ministry_id===ministry.id)return `<div class="profile-option"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px;opacity:.7">${ministry.name} · ${assignmentStatus(e)}</small></span><span>✓</span></div>`;if(e)return `<div class="profile-option" style="opacity:.5;cursor:not-allowed"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px">Ya asignado a ${e.ministry_name||"otro ministerio"}</small></span><span>—</span></div>`;return `<button type="button" class="profile-option programming-assign-button" data-person-id="${m.person_id}"><span><strong>${m.first_name||""} ${m.last_name||""}</strong><small style="display:block;margin-top:4px;opacity:.7">Disponible</small></span><span>+</span></button>`}).join("")}</section>
    <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-programming"><span>Volver a fechas</span><span>‹</span></button></section>`;
    detail.querySelectorAll(".programming-assign-button").forEach(b=>b.addEventListener("click",()=>handleProgrammingAssignment(service,ministry,members,b.dataset.personId,b)));
    detail.querySelectorAll(".programming-remove-button").forEach(b=>b.addEventListener("click",async()=>{const a=assigned.find(x=>(x.assignment_id||x.id)===b.dataset.assignmentId);if(!a)return alert("No se encontró la asignación.");const normalized={...a,id:a.assignment_id||a.id};if(await confirmRemoveAssignment(service,ministry,normalized,b.dataset.personName||"esta persona",b))await openProgrammingService(ministry,members,service.id);}));
    detail.querySelector("#back-to-programming")?.addEventListener("click",()=>openMinistryProgramming(ministry.id));
    window.scrollTo({top:0,behavior:"smooth"});
}

/* =========================================================
   CREAR ASIGNACIONES / CONFLICTOS
========================================================= */
async function checkAssignmentConflict(serviceId,personId) {
    const x=await supabaseRpc("check_assignment_conflict",{p_service_id:serviceId,p_person_id:personId});
    return Array.isArray(x)&&x.length?{...x[0],has_conflict:!!x[0].has_conflict}:{has_conflict:false};
}
async function createAssignment(serviceId,personId,ministryId) {
    try{return {ok:true,assignment:await supabaseRpc("create_assignment",{p_service_id:serviceId,p_person_id:personId,p_ministry_id:ministryId})};}
    catch(e){return {ok:false,error:e.message||"No se pudo crear la asignación."};}
}
async function createAssignmentOverride(serviceId,personId,ministryId,note) {
    try{return {ok:true,assignment:await supabaseRpc("create_assignment_override",{p_service_id:serviceId,p_person_id:personId,p_ministry_id:ministryId,p_conflict_note:note.trim()})};}
    catch(e){return {ok:false,error:e.message||"No se pudo crear la excepción."};}
}
async function processAssignmentCreation(service,ministry,personId,button=null) {
    if(!service||!ministry||!personId)return false;
    if(!canManageMinistry(ministry.id)){alert("No tienes permiso para administrar este ministerio.");return false;}
    if(button?.disabled)return false;
    const old=button?.innerHTML||"";
    try {
        if(button){button.disabled=true;button.innerHTML="<span>Asignando...</span><span>…</span>";}
        const overview=await getServiceAssignmentOverview(service.id);
        const existing=getPersonServiceAssignment(overview,personId);
        if(existing){alert(`No se puede realizar la asignación.\n\nEsta persona ya está asignada a ${existing.ministry_name||"otro ministerio"} en este servicio.`);return false;}
        const conflict=await checkAssignmentConflict(service.id,personId);
        if(conflict.has_conflict){
            if(!isPastor()){alert("No se puede realizar la asignación. Esta persona ya está asignada a otro servicio con un horario que se cruza.");return false;}
            if(!confirm("Existe un conflicto de horario.\n\n¿Deseas autorizar la excepción?"))return false;
            const note=prompt("Indica el motivo de la excepción:");
            if(!note?.trim()){alert("La excepción necesita un motivo.");return false;}
            const r=await createAssignmentOverride(service.id,personId,ministry.id,note);
            if(!r.ok){alert(r.error);return false;}
            alert("Asignación creada con autorización pastoral.");return true;
        }
        const r=await createAssignment(service.id,personId,ministry.id);
        if(!r.ok){alert(r.error);return false;}
        alert("Asignación creada correctamente.");return true;
    } catch(e){alert(e.message||"No se pudo crear la asignación.");return false;}
    finally {if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}}
}
async function handleCreateAssignment(service,ministry,personId,button) {
    if(await processAssignmentCreation(service,ministry,personId,button)){await openServiceMinistry(service.id,ministry.id);await loadMyNextAssignment();}
}
async function handleProgrammingAssignment(service,ministry,members,personId,button) {
    if(await processAssignmentCreation(service,ministry,personId,button)){await openProgrammingService(ministry,members,service.id);await loadMyNextAssignment();}
}

/* =========================================================
   INICIO / MI PRÓXIMA ASIGNACIÓN
========================================================= */
function updateHomeNextActivity(upcoming) {
    const d=document.querySelector(".next-activity-date"),t=document.querySelector(".next-activity-title"),i=document.querySelector(".next-activity-info");
    if(!upcoming?.length){if(d)d.textContent="";if(t)t.textContent="Sin actividades próximas";if(i)i.textContent="No hay actividades programadas.";return;}
    const s=upcoming[0],date=new Date(`${s.service_date}T00:00:00`);
    if(d)d.textContent=`${date.toLocaleDateString("es-GT",{month:"short"}).replace(".","").toUpperCase()} ${date.getDate()}`;
    if(t)t.textContent=s.title||"Servicio";if(i)i.textContent=`${formatDay(s.service_date)} · ${formatTime(s.start_time)}`;
}
async function loadMyNextAssignment() {
    const c=document.getElementById("home-next-service-content");if(!c)return;
    window.currentAssignment=null;
    try {
        const person=window.currentUser;if(!person?.id){renderNoAssignment(c);updateAssignmentButtons();return;}
        const a=await supabaseFetch(`assignments?select=*&person_id=eq.${person.id}&order=created_at.asc`);
        const today=new Date();today.setHours(0,0,0,0);
        const candidates=(a||[]).filter(x=>x.status!=="reclinado"&&x.status!=="rechazado").map(x=>({assignment:x,service:window.currentServices.find(s=>s.id===x.service_id)})).filter(x=>x.service?.service_date&&new Date(`${x.service.service_date}T00:00:00`)>=today).sort((x,y)=>`${x.service.service_date} ${x.service.start_time||""}`.localeCompare(`${y.service.service_date} ${y.service.start_time||""}`));
        if(!candidates.length){renderNoAssignment(c);updateAssignmentButtons();return;}
        const x=candidates[0];window.currentAssignment=x.assignment;
        const m=window.currentMinistries.find(z=>z.id===x.assignment.ministry_id);
        c.innerHTML=`<div><h2>${x.service.title||"Servicio"}</h2><p>${formatDay(x.service.service_date)} · ${formatTime(x.service.start_time)}</p>${m?`<small>${m.name}</small>`:""}</div><span class="service-status">${assignmentStatus(x.assignment)}</span>`;
        updateAssignmentButtons();
    } catch(e){console.error(e);renderNoAssignment(c);updateAssignmentButtons();}
}
function renderNoAssignment(c){c.innerHTML=`<div><h2>Sin servicio asignado</h2><p>No tienes servicios programados.</p></div>`;}
function updateAssignmentButtons() {
    const c=document.querySelector(".confirm-button"),r=document.querySelector(".reject-button"),a=window.currentAssignment,has=!!a?.id;
    if(c){c.disabled=!has||a?.status==="confirmado";c.textContent=a?.status==="confirmado"?"Servicio confirmado":"Confirmar servicio";c.classList.toggle("is-confirmed",a?.status==="confirmado");}
    if(r)r.disabled=!has;
}
async function respondToAssignment(id,status,rejectionReason=null){
    return supabaseRpc("respond_to_assignment",{
        p_assignment_id:id,
        p_status:status,
        p_rejection_reason:rejectionReason
    });
}
async function updateCurrentAssignmentStatus(status,rejectionReason=null) {
    const a=window.currentAssignment;
    if(!a?.id)return alert("No tienes una asignación próxima para actualizar.");
    try {
        window.currentAssignment=await respondToAssignment(a.id,status,rejectionReason)||{
            ...a,
            status,
            rejection_reason:status==="reclinado"?rejectionReason:null
        };
        await loadMyCalendarAssignments();
        await loadMyNextAssignment();
        renderCalendar();
        renderPersonalHome();
        alert(status==="confirmado"?"Tu servicio fue confirmado correctamente.":"La asignación fue rechazada.");
    } catch(e) {
        alert(e.message||"No se pudo actualizar la asignación.");
    }
}
document.querySelector(".confirm-button")?.addEventListener("click",()=>updateCurrentAssignmentStatus("confirmado"));
document.querySelector(".reject-button")?.addEventListener("click",()=>{
    const reason=prompt("¿Por qué no puedes servir en esta asignación?\n\nEscribe el motivo del rechazo:");
    if(reason===null)return;
    if(!reason.trim()){
        alert("Debes indicar el motivo del rechazo.");
        return;
    }
    if(confirm(`¿Seguro que deseas rechazar este servicio?\n\nMotivo: ${reason.trim()}`)){
        updateCurrentAssignmentStatus("reclinado",reason.trim());
    }
});

/* =========================================================
   CALENDARIO
========================================================= */
function createDateString(y,m,d){return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function getServicesForDate(ds){return (window.currentServices||[]).filter(s=>s.service_date===ds).sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||""));}
async function ensureMyServiceCalendarStyles() {
    if(document.getElementById("my-service-calendar-styles"))return;
    const style=document.createElement("style");
    style.id="my-service-calendar-styles";
    style.textContent=`
        #calendar-days .my-service-day{
            position:relative;
        }
        #calendar-days .my-service-day::after{
            content:"";
            position:absolute;
            width:6px;
            height:6px;
            border-radius:50%;
            left:50%;
            bottom:3px;
            transform:translateX(-50%);
            background:#d4af37;
            box-shadow:0 0 6px rgba(212,175,55,.65);
        }
        .my-calendar-service{
            position:relative;
        }
    `;
    document.head.appendChild(style);
}

async function loadMyCalendarAssignments() {
    window.myCalendarAssignments=[];
    const person=window.currentUser;
    if(!person?.id)return;

    try{
        const rows=await supabaseFetch(
            `assignments?select=*&person_id=eq.${person.id}&order=created_at.asc`
        );
        window.myCalendarAssignments=(rows||[]).filter(a=>
            a.status!=="reclinado" && a.status!=="rechazado"
        );
    }catch(e){
        console.error("Error cargando asignaciones del calendario:",e);
        window.myCalendarAssignments=[];
    }
}

async function respondHomeAssignment(id,status,rejectionReason=null){
    try{
        await respondToAssignment(id,status,rejectionReason);
        await loadMyCalendarAssignments();
        await loadMyNextAssignment();
        renderCalendar();
        renderPersonalHome();
        alert(status==="confirmado"?"Tu servicio fue confirmado correctamente.":"La asignación fue rechazada.");
    }catch(e){
        alert(e.message||"No se pudo actualizar la asignación.");
    }
}

function renderPersonalHome() {
    const screen=document.getElementById("inicio");
    if(!screen)return;

    // Inicio se reconstruye aquí sin tocar la lógica de asignaciones.
    [...screen.children].forEach(el=>{
        if(el.id==="personal-home-content")return;
        if(el.classList.contains("app-header"))return;
        el.style.display="none";
    });

    let personal=document.getElementById("personal-home-content");
    if(!personal){
        personal=document.createElement("section");
        personal.id="personal-home-content";
        screen.appendChild(personal);
    }
    personal.style.display="";

    const firstName=String(
        window.currentUser?.first_name||
        window.currentUser?.full_name||
        ""
    ).trim().split(/\s+/)[0]||"";

    const today=new Date();
    today.setHours(0,0,0,0);

    const confirmed=(window.myCalendarAssignments||[])
        .filter(a=>a.status==="confirmado")
        .map(a=>({
            assignment:a,
            service:(window.currentServices||[]).find(s=>s.id===a.service_id),
            ministry:(window.currentMinistries||[]).find(m=>m.id===a.ministry_id)
        }))
        .filter(x=>x.service?.service_date && new Date(`${x.service.service_date}T00:00:00`)>=today)
        .sort((a,b)=>`${a.service.service_date} ${a.service.start_time||""}`.localeCompare(`${b.service.service_date} ${b.service.start_time||""}`));

    const pending=(window.myCalendarAssignments||[])
        .filter(a=>a.status==="pendiente")
        .map(a=>({
            assignment:a,
            service:(window.currentServices||[]).find(s=>s.id===a.service_id),
            ministry:(window.currentMinistries||[]).find(m=>m.id===a.ministry_id)
        }))
        .filter(x=>x.service?.service_date && new Date(`${x.service.service_date}T00:00:00`)>=today)
        .sort((a,b)=>`${a.service.service_date} ${a.service.start_time||""}`.localeCompare(`${b.service.service_date} ${b.service.start_time||""}`));

    const buildDateParts=(service)=>{
        const d=new Date(`${service.service_date}T00:00:00`);
        return {
            weekday:d.toLocaleDateString("es-GT",{weekday:"short"}).replace(".",""),
            day:String(d.getDate()).padStart(2,"0"),
            month:d.toLocaleDateString("es-GT",{month:"short"}).replace(".",""),
            full:d.toLocaleDateString("es-GT",{weekday:"long",day:"numeric",month:"long"})
        };
    };

    const pendingCards=pending.map(x=>{
        const date=buildDateParts(x.service);
        return `
            <article class="home-service-card home-service-card--pending">
                <div class="home-service-datebox">
                    <span>${date.month.toUpperCase()}</span>
                    <strong>${date.day}</strong>
                </div>

                <div class="home-service-body">
                    <div class="home-service-topline">
                        <span class="home-status-pill home-status-pill--pending">Por confirmar</span>
                    </div>

                    <h3>${x.ministry?.name||"Servicio"}</h3>
                    <p class="home-service-meta">
                        ${date.full.charAt(0).toUpperCase()+date.full.slice(1)}
                        · ${formatTime(x.service.start_time)}
                        ${x.service.end_time?` - ${formatTime(x.service.end_time)}`:""}
                    </p>

                    <div class="home-service-actions">
                        <button type="button" class="home-confirm-btn" data-home-confirm="${x.assignment.id}">
                            Confirmar
                        </button>
                        <button type="button" class="home-reject-btn" data-home-reject="${x.assignment.id}">
                            Rechazar
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    const confirmedCards=confirmed.length
        ? confirmed.map(x=>{
            const date=buildDateParts(x.service);
            return `
                <article class="home-service-card">
                    <div class="home-service-datebox">
                        <span>${date.month.toUpperCase()}</span>
                        <strong>${date.day}</strong>
                    </div>

                    <div class="home-service-body">
                        <div class="home-service-topline">
                            <span class="home-status-pill home-status-pill--confirmed">Confirmado</span>
                        </div>

                        <h3>${x.ministry?.name||"Servicio"}</h3>
                        <p class="home-service-meta">
                            ${date.full.charAt(0).toUpperCase()+date.full.slice(1)}
                            · ${formatTime(x.service.start_time)}
                            ${x.service.end_time?` - ${formatTime(x.service.end_time)}`:""}
                        </p>
                    </div>
                </article>
            `;
        }).join("")
        : `
            <div class="home-empty-card">
                <div class="home-empty-icon">
                    <span class="icon-calendar"></span>
                </div>
                <div>
                    <h3>Sin servicios confirmados</h3>
                    <p>No tienes servicios confirmados próximamente.</p>
                </div>
            </div>
        `;

    personal.innerHTML=`
        <section class="home-hero">
            <p class="home-eyebrow">IGLESIA SOBRENATURAL</p>
            <h1>Bienvenido${firstName?`, ${firstName}`:""}</h1>
            <p class="home-motto">Un solo cuerpo, una sola familia, una misma visión.</p>
        </section>

        ${pending.length?`
            <section class="home-section">
                <div class="home-section-heading">
                    <div>
                        <p class="home-section-kicker">PENDIENTES</p>
                        <h2>Servicios por confirmar</h2>
                    </div>
                    <span class="home-count">${pending.length}</span>
                </div>
                <div class="home-service-list">
                    ${pendingCards}
                </div>
            </section>
        `:""}

        <section class="home-section">
            <div class="home-section-heading">
                <div>
                    <p class="home-section-kicker">TU PROGRAMACIÓN</p>
                    <h2>Mis próximos servicios confirmados</h2>
                </div>
            </div>

            <div class="home-service-list">
                ${confirmedCards}
            </div>
        </section>

        <section class="home-verse-card">
            <span class="home-verse-line"></span>
            <p>“Todo lo que hagan, háganlo de corazón, como para el Señor.”</p>
            <strong>Colosenses 3:23</strong>
        </section>
    `;

    personal.querySelectorAll("[data-home-confirm]").forEach(btn=>{
        btn.addEventListener("click",()=>respondHomeAssignment(
            btn.dataset.homeConfirm,
            "confirmado"
        ));
    });

    personal.querySelectorAll("[data-home-reject]").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            const reason=prompt(
                "¿Por qué no puedes servir en esta asignación?\n\nEscribe el motivo del rechazo:"
            );

            if(reason===null)return;

            if(!reason.trim()){
                alert("Debes indicar el motivo del rechazo.");
                return;
            }

            if(confirm(
                `¿Seguro que deseas rechazar este servicio?\n\nMotivo: ${reason.trim()}`
            )){
                await respondHomeAssignment(
                    btn.dataset.homeReject,
                    "reclinado",
                    reason.trim()
                );
            }
        });
    });

    ensurePersonalHomeStyles();
}

function ensurePersonalHomeStyles() {
    let style=document.getElementById("personal-home-styles");

    if(!style){
        style=document.createElement("style");
        style.id="personal-home-styles";
        document.head.appendChild(style);
    }

    style.textContent=`
        #personal-home-content{
            display:grid;
            gap:34px;
            margin-top:4px;
            padding-bottom:18px;
        }

        .home-hero{
            padding:8px 0 4px;
        }

        .home-eyebrow{
            margin:0 0 10px;
            color:var(--accent,#D4AF5A);
            font-size:10px;
            font-weight:600;
            letter-spacing:2.7px;
        }

        .home-hero h1{
            margin:0;
            color:#fff;
            font-size:clamp(34px,9vw,46px);
            line-height:1.04;
            font-weight:700;
            letter-spacing:-1.45px;
        }

        .home-motto{
            margin:12px 0 0;
            max-width:390px;
            color:rgba(255,255,255,.68);
            font-size:15px;
            line-height:1.55;
        }

        .home-section{
            display:grid;
            gap:16px;
        }

        .home-section-heading{
            display:flex;
            align-items:flex-end;
            justify-content:space-between;
            gap:14px;
        }

        .home-section-kicker{
            margin:0 0 5px;
            color:var(--accent,#D4AF5A);
            font-size:9px;
            font-weight:700;
            letter-spacing:1.8px;
        }

        .home-section-heading h2{
            margin:0;
            max-width:330px;
            color:#fff;
            font-size:22px;
            line-height:1.15;
            font-weight:650;
            letter-spacing:-.45px;
        }

        .home-count{
            min-width:30px;
            height:30px;
            padding:0 9px;
            border:1px solid rgba(212,175,90,.28);
            border-radius:999px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            color:var(--accent,#D4AF5A);
            background:rgba(212,175,90,.06);
            font-size:11px;
            font-weight:700;
        }

        .home-service-list{
            display:grid;
            gap:11px;
        }

        .home-service-card{
            display:grid;
            grid-template-columns:54px minmax(0,1fr);
            gap:14px;
            padding:15px;
            border:1px solid rgba(255,255,255,.075);
            border-radius:16px;
            background:#141414;
            box-shadow:0 12px 32px rgba(0,0,0,.11);
        }

        .home-service-card--pending{
            border-color:rgba(212,175,90,.18);
        }

        .home-service-datebox{
            width:54px;
            height:62px;
            border-radius:12px;
            border:1px solid rgba(212,175,90,.25);
            background:rgba(212,175,90,.045);
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            flex-shrink:0;
        }

        .home-service-datebox span{
            color:var(--accent,#D4AF5A);
            font-size:8px;
            font-weight:700;
            letter-spacing:1.2px;
        }

        .home-service-datebox strong{
            margin-top:2px;
            color:#fff;
            font-size:23px;
            line-height:1;
            font-weight:650;
        }

        .home-service-body{
            min-width:0;
        }

        .home-service-topline{
            min-height:19px;
            margin-bottom:5px;
        }

        .home-status-pill{
            display:inline-flex;
            align-items:center;
            min-height:21px;
            padding:0 8px;
            border-radius:999px;
            font-size:8px;
            font-weight:700;
            letter-spacing:.45px;
        }

        .home-status-pill--confirmed{
            color:#d9bd72;
            background:rgba(212,175,90,.08);
            border:1px solid rgba(212,175,90,.16);
        }

        .home-status-pill--pending{
            color:rgba(255,255,255,.78);
            background:rgba(255,255,255,.055);
            border:1px solid rgba(255,255,255,.08);
        }

        .home-service-body h3{
            margin:0;
            color:#fff;
            font-size:17px;
            line-height:1.25;
            font-weight:650;
        }

        .home-service-meta{
            margin:6px 0 0;
            color:rgba(255,255,255,.56);
            font-size:12px;
            line-height:1.45;
        }

        .home-service-actions{
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
            margin-top:13px;
        }

        .home-confirm-btn,
        .home-reject-btn{
            min-height:40px;
            border-radius:11px;
            font-size:12px;
            font-weight:650;
            -webkit-tap-highlight-color:transparent;
        }

        .home-confirm-btn{
            border:1px solid #DDBA62;
            background:linear-gradient(180deg,#DFBD65 0%,#D4AF5A 100%);
            color:#0a0a0a;
        }

        .home-reject-btn{
            border:1px solid rgba(210,139,139,.26);
            background:rgba(255,255,255,.025);
            color:#d79a9a;
        }

        .home-empty-card{
            display:flex;
            align-items:center;
            gap:14px;
            min-height:92px;
            padding:17px;
            border:1px solid rgba(255,255,255,.07);
            border-radius:16px;
            background:#121212;
        }

        .home-empty-icon{
            width:44px;
            height:44px;
            flex:0 0 44px;
            border-radius:12px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#1a1a1a;
            color:var(--accent,#D4AF5A);
        }

        .home-empty-icon .icon-calendar{
            width:19px;
            height:19px;
            display:block;
            position:relative;
        }

        .home-empty-card h3{
            margin:0 0 4px;
            color:#fff;
            font-size:14px;
            font-weight:650;
        }

        .home-empty-card p{
            margin:0;
            color:rgba(255,255,255,.50);
            font-size:12px;
            line-height:1.45;
        }

        .home-verse-card{
            position:relative;
            margin-top:12px;
            padding:22px 20px 21px 23px;
            border:1px solid rgba(255,255,255,.065);
            border-radius:16px;
            background:#111;
            overflow:hidden;
        }

        .home-verse-line{
            position:absolute;
            left:0;
            top:18px;
            bottom:18px;
            width:3px;
            border-radius:0 4px 4px 0;
            background:var(--accent,#D4AF5A);
        }

        .home-verse-card p{
            margin:0;
            color:rgba(255,255,255,.82);
            font-size:15px;
            line-height:1.62;
        }

        .home-verse-card strong{
            display:block;
            margin-top:10px;
            color:var(--accent,#D4AF5A);
            font-size:12px;
            font-weight:700;
        }

        @media (max-width:380px){
            #personal-home-content{
                gap:28px;
            }

            .home-hero h1{
                font-size:34px;
            }

            .home-section-heading h2{
                font-size:20px;
            }

            .home-service-card{
                grid-template-columns:48px minmax(0,1fr);
                gap:12px;
                padding:13px;
            }

            .home-service-datebox{
                width:48px;
                height:58px;
            }

            .home-service-actions{
                grid-template-columns:1fr;
            }
        }
    `;
}

function getMyAssignmentsForDate(dateString) {
    return (window.myCalendarAssignments||[]).filter(a=>{
        const service=(window.currentServices||[]).find(s=>s.id===a.service_id);
        return service?.service_date===dateString;
    });
}

function renderCalendar() {
    const title=document.getElementById("calendar-month-title"),days=document.getElementById("calendar-days");if(!title||!days)return;
    const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
    const mn=calendarDate.toLocaleDateString("es-GT",{month:"long",year:"numeric"});title.textContent=mn.charAt(0).toUpperCase()+mn.slice(1);days.innerHTML="";
    const fd=new Date(y,m,1).getDay(),off=fd===0?6:fd-1,n=new Date(y,m+1,0).getDate();
    for(let i=0;i<off;i++){const e=document.createElement("span");e.className="empty";days.appendChild(e);}
    for(let d=1;d<=n;d++){const el=document.createElement("span"),ds=createDateString(y,m+1,d);el.textContent=d;el.dataset.date=ds;if(selectedCalendarDate===ds)el.classList.add("selected-day");if(getServicesForDate(ds).length)el.classList.add("has-event");if(getMyAssignmentsForDate(ds).length)el.classList.add("my-service-day");el.addEventListener("click",()=>{selectedCalendarDate=ds;renderCalendar();});days.appendChild(el);}
    renderCalendarEvents();
}
function renderCalendarEvents() {
    const c=document.getElementById("calendar-events");if(!c)return;
    if(!selectedCalendarDate){c.innerHTML=`<div class="event-small-date">--</div><div><h2>Selecciona una fecha</h2><p>Consulta las actividades programadas.</p></div>`;return;}

    const ss=getServicesForDate(selectedCalendarDate);
    const mine=getMyAssignmentsForDate(selectedCalendarDate);
    const date=new Date(`${selectedCalendarDate}T00:00:00`);
    const label=`${date.toLocaleDateString("es-GT",{month:"short"}).replace(".","").toUpperCase()} ${date.getDate()}`;

    const myCards=mine.map(a=>{
        const s=(window.currentServices||[]).find(x=>x.id===a.service_id);
        const m=(window.currentMinistries||[]).find(x=>x.id===a.ministry_id);
        if(!s)return "";
        return `<div class="calendar-event-item my-calendar-service">
            <div class="event-small-date">${label}</div>
            <div>
                <h2>Sirves en ${m?.name||"un ministerio"}</h2>
                <p>${formatTime(s.start_time)}${s.end_time?` - ${formatTime(s.end_time)}`:""} · ${assignmentStatus(a)}</p>
                <small>${s.title||"Servicio"}</small>
            </div>
        </div>`;
    }).join("");

    const myServiceIds=new Set(mine.map(a=>a.service_id));
    const normalCards=ss.filter(s=>!myServiceIds.has(s.id)).map(s=>`<div class="calendar-event-item">
        <div class="event-small-date">${label}</div>
        <div><h2>${s.title||"Servicio"}</h2><p>${formatDay(s.service_date)} · ${formatTime(s.start_time)}</p>${s.location?`<small>${s.location}</small>`:""}</div>
    </div>`).join("");

    c.innerHTML=(myCards||normalCards)
        ? myCards+normalCards
        : `<div class="event-small-date">${label}</div><div><h2>Sin actividades</h2><p>No hay actividades programadas para esta fecha.</p></div>`;
}
document.getElementById("calendar-prev")?.addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()-1);selectedCalendarDate=null;renderCalendar();});
document.getElementById("calendar-next")?.addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()+1);selectedCalendarDate=null;renderCalendar();});

/* =========================================================
   NAVEGACIÓN
========================================================= */
const navItems=document.querySelectorAll(".nav-item"),screens=document.querySelectorAll(".screen");
function showScreen(id) {
    const target=document.getElementById(id);if(!target)return;if(id==="pastoral"&&!isPastor())return;
    if(id!=="servicios")document.getElementById("service-detail")?.remove();
    if(id!=="ministerios"){
        document.getElementById("bodega-detail")?.remove();
        const ministryList=document.querySelector("#ministerios .ministries-list");
        if(ministryList)ministryList.style.display="";
    }
    screens.forEach(s=>s.classList.remove("active-screen"));target.classList.add("active-screen");
    navItems.forEach(i=>i.classList.toggle("active",i.dataset.screen===(id==="pastoral"?"perfil":id)));
    if(bottomNav)bottomNav.style.display="flex";
    if(id==="servicios"){document.getElementById("service-detail")?.remove();const l=document.querySelector("#servicios .services-list");if(l)l.style.display="";loadServices().then(loadMyNextAssignment);}
    if(id==="calendario")renderCalendar();
    if(id==="inicio")renderPersonalHome();
    window.scrollTo({top:0,behavior:"smooth"});
}
navItems.forEach(i=>i.addEventListener("click",()=>showScreen(i.dataset.screen)));
document.querySelectorAll(".quick-card").forEach(c=>c.addEventListener("click",()=>showScreen(c.dataset.screen)));

/* =========================================================
   MINISTERIOS GENERAL
========================================================= */
function normalizeMinistryName(n){return String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}

function getMinistrySVG(name=""){
    const key=normalizeMinistryName(name);

    const svg=(body)=>`
        <svg class="ministry-real-svg" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            ${body}
        </svg>`;

    if(key==="pastores"){
        return svg(`
            <path d="M12 3V21M7.5 8H16.5"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round"/>
        `);
    }

    if(key==="jovenes"){
        return svg(`
            <circle cx="12" cy="7" r="2.5"
                stroke="currentColor" stroke-width="1.8"/>
            <circle cx="6.5" cy="9" r="2"
                stroke="currentColor" stroke-width="1.8"/>
            <circle cx="17.5" cy="9" r="2"
                stroke="currentColor" stroke-width="1.8"/>
            <path d="M7 19C7.5 15.8 9.2 14 12 14C14.8 14 16.5 15.8 17 19"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M2.5 18C2.8 15.8 4 14.5 6 14.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M21.5 18C21.2 15.8 20 14.5 18 14.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    if(key==="ninos"){
        return svg(`
            <circle cx="12" cy="6" r="2.4"
                stroke="currentColor" stroke-width="1.8"/>
            <path d="M12 8.8V15.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 11.5L7 8M12 11.5L17 8"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 15.5L8.5 21M12 15.5L15.5 21"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    if(key==="diaconado"){
        return svg(`
            <path d="M12 20S4.5 15.2 4.5 9.3C4.5 6.5 6.4 5 8.5 5C10 5 11.2 5.8 12 7C12.8 5.8 14 5 15.5 5C17.6 5 19.5 6.5 19.5 9.3C19.5 15.2 12 20 12 20Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M7 21H17"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    if(key==="intercesion"){
        return svg(`
            <path d="M9.5 4V10L7 14M14.5 4V10L17 14"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 14L10.5 20M17 14L13.5 20"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M10.5 10L12 12L13.5 10"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
        `);
    }

    if(key==="maestro y maestra de sala"){
        return svg(`
            <path d="M3 5.5H9C10.7 5.5 12 6.8 12 8.5V20C12 18.4 10.7 17 9 17H3V5.5Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M21 5.5H15C13.3 5.5 12 6.8 12 8.5V20C12 18.4 13.3 17 15 17H21V5.5Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        `);
    }

    if(key==="alabanza"){
        return svg(`
            <path d="M10 5V17M10 5L18 3V15"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="7" cy="18" r="3"
                stroke="currentColor" stroke-width="1.8"/>
            <circle cx="15" cy="16" r="3"
                stroke="currentColor" stroke-width="1.8"/>
        `);
    }

    if(key==="danza"){
        return svg(`
            <circle cx="13" cy="5" r="2"
                stroke="currentColor" stroke-width="1.8"/>
            <path d="M12 8L9 12L13 14L17 11"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 14L9 20M13 14L18 18M10 10L6 8"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    if(key==="cocina"){
        return svg(`
            <path d="M6 3V10M4 3V7M8 3V7M6 10V21"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16 3C14 5 13 7 13 10H16V21"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
        `);
    }

    if(key==="multimedia"){
        return svg(`
            <rect x="3" y="5" width="14" height="12" rx="2"
                stroke="currentColor" stroke-width="1.8"/>
            <path d="M17 9L21 7V15L17 13"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M8 20H12"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    if(key==="bodega siloe"){
        return svg(`
            <path d="M12 3L20 7L12 11L4 7L12 3Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M4 7V17L12 21L20 17V7"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 11V21"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `);
    }

    return svg(`
        <circle cx="8" cy="9" r="3"
            stroke="currentColor" stroke-width="1.8"/>
        <circle cx="16" cy="9" r="3"
            stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 20C3.5 16.5 5.5 14.5 8.5 14.5M21 20C20.5 16.5 18.5 14.5 15.5 14.5"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `);
}

function applyMinistrySVGIcons(){
    document.querySelectorAll("#ministerios .ministry-card").forEach(card=>{
        const icon=card.querySelector(".ministry-icon");
        if(!icon)return;
        icon.innerHTML=getMinistrySVG(card.dataset.ministryName||"");
    });
}

async function openMinistry(name) {
    try {
        if (!window.currentMinistries.length) {
            await loadMinistries();
        }

        const m = window.currentMinistries.find(
            x =>
                normalizeMinistryName(x.name) ===
                normalizeMinistryName(name)
        );

        if (!m) {
            alert("No se encontró el ministerio.");
            return;
        }

        if (!canManageMinistry(m.id)) {
            alert("No tienes acceso a la administración de este ministerio.");
            return;
        }

        // Bodega Siloé tiene un panel administrativo propio.
        if (normalizeMinistryName(m.name) === normalizeMinistryName("Bodega Siloé")) {
            await openBodegaPanel(m);
            return;
        }

        const members = await getMinistryMembers(m.id);
        showMinistryDetail(m, members);

    } catch (e) {
        console.error("Error abriendo ministerio:", e);
        alert(e.message || "No se pudo cargar el ministerio.");
    }
}

function showMinistryDetail(m,members) {
    const screen=document.getElementById("ministerios");
    if(!screen)return;

    document.getElementById("ministry-detail")?.remove();

    const d=document.createElement("section");
    d.id="ministry-detail";
    d.className="ministry-detail-screen";

    const memberRows=members.length
        ? members.map(x=>{
            const isLeader=x.membership_role==="leader";
            const roleLabel=isLeader?"Líder":"Servidor";

            return `
                <div class="ministry-detail-member ${isLeader?"is-leader":""}">
                    <span class="ministry-detail-avatar" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="3.2"
                                stroke="currentColor"
                                stroke-width="1.8"/>
                            <path d="M5.5 20C6.2 15.9 8.5 14 12 14C15.5 14 17.8 15.9 18.5 20"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"/>
                        </svg>
                    </span>

                    <span class="ministry-detail-member-copy">
                        <strong>${x.first_name||""} ${x.last_name||""}</strong>
                        <span class="ministry-role-badge ${isLeader?"leader":"server"}">${roleLabel}</span>
                    </span>
                </div>`;
        }).join("")
        : `
            <div class="ministry-detail-empty">
                <strong>Sin integrantes</strong>
                <span>Este ministerio todavía no tiene integrantes.</span>
            </div>`;

    d.innerHTML=`
        <button type="button"
                class="programming-back-top ministry-detail-back"
                id="back-to-ministries">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Ministerios</span>
        </button>

        <section class="ministry-detail-header">
            <p class="ministry-detail-eyebrow">MINISTERIO</p>
            <h1>${m.name}</h1>
            <p>${m.description||""}</p>
        </section>

        <section class="ministry-detail-members-card">
            <div class="ministry-detail-members-heading">
                <span class="ministry-detail-members-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="8" cy="9" r="2.7"
                            stroke="currentColor"
                            stroke-width="1.7"/>
                        <circle cx="16" cy="9" r="2.7"
                            stroke="currentColor"
                            stroke-width="1.7"/>
                        <path d="M3.5 19C4.1 15.8 5.8 14.3 8.5 14.3"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"/>
                        <path d="M20.5 19C19.9 15.8 18.2 14.3 15.5 14.3"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"/>
                    </svg>
                </span>

                <h2>Integrantes</h2>
                <span class="ministry-detail-count">${members.length}</span>
            </div>

            <div class="ministry-detail-members-list">
                ${memberRows}
            </div>
        </section>`;

    screen.appendChild(d);

    const list=screen.querySelector(".ministries-list");
    if(list)list.style.display="none";

    window.scrollTo({top:0,behavior:"smooth"});

    d.querySelector("#back-to-ministries")?.addEventListener("click",()=>{
        d.remove();
        if(list)list.style.display="";
        window.scrollTo({top:0,behavior:"smooth"});
    });
}
document.querySelectorAll(".ministry-card").forEach(c=>{
    c.addEventListener("click",()=>openMinistry(c.dataset.ministryName));
});
applyMinistrySVGIcons();

/* =========================================================
   BODEGA SILOÉ
========================================================= */
function formatBodegaNumber(value){
    const n=Number(value);
    if(!Number.isFinite(n))return "0";
    return n.toLocaleString("es-GT",{maximumFractionDigits:2});
}
function formatBodegaDate(value){
    if(!value)return "";
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return "";
    return d.toLocaleString("es-GT",{
        day:"numeric",
        month:"short",
        year:"numeric",
        hour:"numeric",
        minute:"2-digit"
    }).replace(".","");
}
async function canManageBodega(){
    try{
        return !!(await supabaseRpc("can_manage_bodega"));
    }catch(error){
        console.error("Error verificando acceso a Bodega:",error);
        return false;
    }
}
async function loadBodegaInventory(){
    const x=await supabaseRpc("get_bodega_inventory");
    window.currentBodegaInventory=Array.isArray(x)?x:[];
    return window.currentBodegaInventory;
}
async function loadBodegaMovements(){
    const x=await supabaseRpc("get_bodega_movements");
    window.currentBodegaMovements=Array.isArray(x)?x:[];
    return window.currentBodegaMovements;
}
async function loadBodegaBeneficiaries(){
    const x=await supabaseRpc("get_bodega_beneficiaries");
    window.currentBodegaBeneficiaries=Array.isArray(x)?x:[];
    return window.currentBodegaBeneficiaries;
}
async function loadBodegaDeliveries(){
    const x=await supabaseRpc("get_bodega_deliveries");
    window.currentBodegaDeliveries=Array.isArray(x)?x:[];
    return window.currentBodegaDeliveries;
}
async function loadBodegaDeliveryItems(deliveryId){
    const x=await supabaseRpc("get_bodega_delivery_items",{p_delivery_id:deliveryId});
    return Array.isArray(x)?x:[];
}
function getBodegaView(){
    const screen=document.getElementById("ministerios");
    if(!screen)return null;
    let view=document.getElementById("bodega-detail");
    if(!view){
        view=document.createElement("section");
        view.id="bodega-detail";
        screen.appendChild(view);
    }
    return view;
}
function hideMinistriesListForBodega(){
    const screen=document.getElementById("ministerios");
    if(!screen)return;
    document.getElementById("ministry-detail")?.remove();
    const list=screen.querySelector(".ministries-list");
    if(list)list.style.display="none";
}
function closeBodegaPanel(){
    const view=document.getElementById("bodega-detail");
    if(view)view.remove();
    const screen=document.getElementById("ministerios");
    const list=screen?.querySelector(".ministries-list");
    if(list)list.style.display="";
    window.currentBodegaInventory=[];
    window.currentBodegaMovements=[];
    window.scrollTo({top:0,behavior:"smooth"});
}
async function openBodegaPanel(ministry=null){
    const allowed=await canManageBodega();
    if(!allowed){
        alert("No tienes permiso para acceder a Bodega Siloé.");
        return;
    }

    hideMinistriesListForBodega();
    const view=getBodegaView();
    if(!view)return;

    view.innerHTML=`<section class="page-header"><p class="eyebrow">BODEGA SILOÉ</p><h1>Inventario</h1><p>Cargando...</p></section>`;

    try{
        await Promise.all([loadBodegaInventory(),loadBodegaMovements(),loadBodegaBeneficiaries(),loadBodegaDeliveries()]);
        renderBodegaPanel();
    }catch(error){
        console.error("Error cargando Bodega Siloé:",error);
        view.innerHTML=`<section class="page-header"><p class="eyebrow">BODEGA SILOÉ</p><h1>Inventario</h1><p>No se pudo cargar la bodega.</p></section>
        <section class="ministry-detail-card"><p>${error.message||"Error desconocido."}</p></section>
        <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-from-bodega"><span>Volver a ministerios</span><span>‹</span></button></section>`;
        view.querySelector("#back-from-bodega")?.addEventListener("click",closeBodegaPanel);
    }
}
function renderBodegaPanel(){
    const view=getBodegaView();
    if(!view)return;

    const inventory=window.currentBodegaInventory||[];
    const movements=window.currentBodegaMovements||[];
    const deliveries=window.currentBodegaDeliveries||[];
    const lowCount=inventory.filter(p=>p.low_stock).length;

    const actionIcon=(type)=>{
        const icons={
            product:`
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3 20 7 12 11 4 7 12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M4 7V17L12 21 20 17V7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M12 11V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`,
            beneficiaries:`
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="7" r="2.5" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="6.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="17.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M7 19C7.5 15.8 9.2 14 12 14C14.8 14 16.5 15.8 17 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M2.5 18C2.8 15.8 4 14.5 6 14.5M21.5 18C21.2 15.8 20 14.5 18 14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`,
            delivery:`
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 6H14V17H3V6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M14 10H18L21 13V17H14V10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <circle cx="7" cy="18" r="2" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="18" cy="18" r="2" stroke="currentColor" stroke-width="1.8"/>
                </svg>`,
            history:`
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 3H16L19 6V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 3V21H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 8H15M8 12H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <circle cx="17" cy="17" r="4" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M17 15V17.4L18.7 18.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`
        };
        return icons[type]||icons.product;
    };

    const emptyIcon=(type)=>{
        if(type==="movements"){
            return `
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 3H18V21H6V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M9 8H15M9 12H15M9 16H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`;
        }
        return actionIcon("product");
    };

    view.className="bodega-dashboard";

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-back-top"
                id="back-from-bodega">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Ministerios</span>
        </button>

        <section class="bodega-dashboard-header">
            <p class="bodega-dashboard-eyebrow">BODEGA SILOÉ</p>
            <h1>Inventario</h1>
            <p>${inventory.length} productos · ${lowCount} con existencia baja</p>
        </section>

        <section class="bodega-dashboard-actions" aria-label="Acciones de Bodega Siloé">
            <button type="button" class="bodega-action-card" id="bodega-new-product-button">
                <span class="bodega-action-icon">${actionIcon("product")}</span>
                <span class="bodega-action-copy">
                    <strong>Nuevo producto</strong>
                    <small>Agregar un producto al inventario</small>
                </span>
                <span class="bodega-action-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" class="bodega-action-card" id="bodega-beneficiaries-button">
                <span class="bodega-action-icon">${actionIcon("beneficiaries")}</span>
                <span class="bodega-action-copy">
                    <strong>Beneficiarios</strong>
                    <small>Registrar y consultar beneficiarios</small>
                </span>
                <span class="bodega-action-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" class="bodega-action-card" id="bodega-new-delivery-button">
                <span class="bodega-action-icon">${actionIcon("delivery")}</span>
                <span class="bodega-action-copy">
                    <strong>Nueva entrega</strong>
                    <small>Entregar productos a un beneficiario</small>
                </span>
                <span class="bodega-action-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" class="bodega-action-card" id="bodega-deliveries-button">
                <span class="bodega-action-icon">${actionIcon("history")}</span>
                <span class="bodega-action-copy">
                    <strong>Historial de entregas</strong>
                    <small>${deliveries.length} entregas registradas</small>
                </span>
                <span class="bodega-action-arrow" aria-hidden="true">›</span>
            </button>
        </section>

        <section class="bodega-dashboard-section">
            <div class="bodega-section-heading">
                <h2>Productos</h2>
                <span>${inventory.length}</span>
            </div>

            <div class="bodega-section-content">
                ${inventory.length
                    ? inventory.map(p=>`
                        <button type="button"
                                class="bodega-product-card bodega-product-button ${p.low_stock?"low-stock":""}"
                                data-product-id="${p.product_id}">
                            <span class="bodega-product-icon">${actionIcon("product")}</span>
                            <span class="bodega-product-copy">
                                <strong>${p.name}</strong>
                                <small>${formatBodegaNumber(p.quantity)} ${p.unit}</small>
                                <span>${p.low_stock
                                    ? `Existencia baja · mínimo ${formatBodegaNumber(p.minimum_stock)} ${p.unit}`
                                    : `Mínimo ${formatBodegaNumber(p.minimum_stock)} ${p.unit}`}</span>
                            </span>
                            <span class="bodega-product-arrow" aria-hidden="true">›</span>
                        </button>
                    `).join("")
                    : `
                        <div class="bodega-empty-card">
                            <span class="bodega-empty-icon">${emptyIcon("products")}</span>
                            <span class="bodega-empty-copy">
                                <strong>Inventario vacío</strong>
                                <small>Crea el primer producto para comenzar.</small>
                            </span>
                        </div>
                    `}
            </div>
        </section>

        <section class="bodega-dashboard-section">
            <div class="bodega-section-heading">
                <h2>Movimientos recientes</h2>
                <span>${movements.length}</span>
            </div>

            <div class="bodega-section-content">
                ${movements.length
                    ? movements.slice(0,8).map(m=>`
                        <div class="bodega-movement-card ${m.movement_type==="entrada"?"entry":"exit"}">
                            <span class="bodega-movement-icon" aria-hidden="true">
                                ${m.movement_type==="entrada"?"↓":"↑"}
                            </span>
                            <span class="bodega-movement-copy">
                                <strong>${m.movement_type==="entrada"?"Entrada":"Salida"} · ${m.product_name}</strong>
                                <small>${formatBodegaNumber(m.quantity)} ${m.unit} · ${m.created_by_name||"Usuario"}</small>
                                <span>${formatBodegaDate(m.created_at)}${m.note?` · ${m.note}`:""}</span>
                            </span>
                        </div>
                    `).join("")
                    : `
                        <div class="bodega-empty-card">
                            <span class="bodega-empty-icon">${emptyIcon("movements")}</span>
                            <span class="bodega-empty-copy">
                                <strong>Sin movimientos</strong>
                                <small>Las entradas y salidas aparecerán aquí.</small>
                            </span>
                        </div>
                    `}

                ${movements.length>8
                    ? `<button type="button" class="bodega-history-more" id="bodega-history-button">
                        <span>Ver historial completo</span>
                        <span aria-hidden="true">›</span>
                       </button>`
                    : ""}
            </div>
        </section>`;

    view.querySelector("#bodega-new-product-button")?.addEventListener("click",renderBodegaNewProduct);
    view.querySelector("#bodega-beneficiaries-button")?.addEventListener("click",renderBodegaBeneficiaries);
    view.querySelector("#bodega-new-delivery-button")?.addEventListener("click",renderBodegaNewDelivery);
    view.querySelector("#bodega-deliveries-button")?.addEventListener("click",renderBodegaDeliveries);

    view.querySelectorAll(".bodega-product-button").forEach(button=>button.addEventListener("click",()=>{
        const product=inventory.find(p=>p.product_id===button.dataset.productId);
        if(product)renderBodegaProductDetail(product);
    }));

    view.querySelector("#bodega-history-button")?.addEventListener("click",renderBodegaHistory);
    view.querySelector("#back-from-bodega")?.addEventListener("click",closeBodegaPanel);

    window.scrollTo({top:0,behavior:"smooth"});
}

function renderBodegaNewProduct(){
    const view=getBodegaView();
    if(!view)return;

    view.className="bodega-new-product-screen";

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-form-back"
                id="back-to-bodega">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Inventario</span>
        </button>

        <section class="bodega-form-header">
            <p class="bodega-form-eyebrow">BODEGA SILOÉ</p>
            <h1>Nuevo producto</h1>
            <p>El producto comenzará con existencia 0.</p>
        </section>

        <section class="bodega-product-form" aria-label="Nuevo producto">
            <label class="bodega-form-field">
                <span class="bodega-form-shell bodega-form-icon-product">
                    <input
                        id="bodega-product-name"
                        type="text"
                        autocomplete="off"
                        placeholder="Nombre del producto"
                        aria-label="Nombre del producto"
                    >
                </span>
            </label>

            <label class="bodega-form-field">
                <span class="bodega-form-shell bodega-form-icon-unit">
                    <input
                        id="bodega-product-unit"
                        type="text"
                        autocomplete="off"
                        placeholder="Unidad: libras, bolsas, botellas..."
                        aria-label="Unidad del producto"
                    >
                </span>
            </label>

            <label class="bodega-form-field">
                <span class="bodega-form-shell bodega-form-icon-minimum">
                    <input
                        id="bodega-product-minimum"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="0.01"
                        value="0"
                        placeholder="Existencia mínima"
                        aria-label="Existencia mínima"
                    >
                </span>
            </label>

            <p id="bodega-product-message" class="bodega-form-message" role="status"></p>

            <button type="button"
                    class="bodega-create-product-glass"
                    id="bodega-save-product">
                <span class="bodega-create-product-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 3 20 7 12 11 4 7 12 3Z"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linejoin="round"/>
                        <path d="M4 7V17L12 21 20 17V7"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linejoin="round"/>
                        <path d="M12 11V21"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"/>
                    </svg>
                </span>

                <span class="bodega-create-product-copy">
                    <strong>Crear producto</strong>
                    <small>Agregar al inventario</small>
                </span>
            </button>
        </section>`;

    view.querySelector("#bodega-save-product")?.addEventListener("click",createBodegaProduct);
    view.querySelector("#back-to-bodega")?.addEventListener("click",renderBodegaPanel);

    window.scrollTo({top:0,behavior:"smooth"});
}

async function createBodegaProduct(){
    const name=document.getElementById("bodega-product-name")?.value.trim()||"";
    const unit=document.getElementById("bodega-product-unit")?.value.trim()||"";
    const minimumRaw=document.getElementById("bodega-product-minimum")?.value??"0";
    const minimum=Number(minimumRaw);
    const msg=document.getElementById("bodega-product-message");
    const button=document.getElementById("bodega-save-product");

    if(!name){if(msg)msg.textContent="Escribe el nombre del producto.";return;}
    if(!unit){if(msg)msg.textContent="Escribe la unidad del producto.";return;}
    if(!Number.isFinite(minimum)||minimum<0){if(msg)msg.textContent="La existencia mínima no es válida.";return;}

    const old=button?.innerHTML||"";
    try{
        if(button){button.disabled=true;button.innerHTML="<span>Creando...</span><span>…</span>";}
        if(msg)msg.textContent="";
        await supabaseRpc("bodega_create_product",{p_name:name,p_unit:unit,p_minimum_stock:minimum});
        await Promise.all([loadBodegaInventory(),loadBodegaMovements()]);
        alert(`Producto "${name}" creado correctamente.`);
        renderBodegaPanel();
    }catch(error){
        console.error("Error creando producto de Bodega:",error);
        if(msg)msg.textContent=error.message||"No se pudo crear el producto.";
        if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}
    }
}
function renderBodegaProductDetail(product){
    const view=getBodegaView();
    if(!view||!product)return;

    view.innerHTML=`<section class="page-header">
        <p class="eyebrow">BODEGA SILOÉ</p>
        <h1>${product.name}</h1>
        <p>${formatBodegaNumber(product.quantity)} ${product.unit}</p>
        <small>${product.low_stock?`Existencia baja · mínimo ${formatBodegaNumber(product.minimum_stock)} ${product.unit}`:`Existencia mínima: ${formatBodegaNumber(product.minimum_stock)} ${product.unit}`}</small>
    </section>

    <section class="ministry-detail-actions">
        <button type="button" class="profile-option" id="bodega-add-stock-button"><span><strong>Registrar entrada</strong><small style="display:block;margin-top:4px">Aumentar existencia</small></span><span>+</span></button>
        <button type="button" class="profile-option" id="bodega-remove-stock-button"><span><strong>Registrar salida</strong><small style="display:block;margin-top:4px">Descontar existencia</small></span><span>−</span></button>
    </section>

    <section class="ministry-detail-card">
        <div class="section-heading"><h2>Datos</h2></div>
        <div class="ministry-member-item"><div class="ministry-member-info"><h3>Existencia actual</h3><p>${formatBodegaNumber(product.quantity)} ${product.unit}</p></div></div>
        <div class="ministry-member-item"><div class="ministry-member-info"><h3>Existencia mínima</h3><p>${formatBodegaNumber(product.minimum_stock)} ${product.unit}</p></div></div>
    </section>

    <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-bodega"><span>Volver al inventario</span><span>‹</span></button></section>`;

    view.querySelector("#bodega-add-stock-button")?.addEventListener("click",()=>renderBodegaMovementForm(product,"entrada"));
    view.querySelector("#bodega-remove-stock-button")?.addEventListener("click",()=>renderBodegaMovementForm(product,"salida"));
    view.querySelector("#back-to-bodega")?.addEventListener("click",renderBodegaPanel);
    window.scrollTo({top:0,behavior:"smooth"});
}
function renderBodegaMovementForm(product,type){
    const view=getBodegaView();
    if(!view||!product)return;
    const isEntry=type==="entrada";

    view.innerHTML=`<section class="page-header"><p class="eyebrow">BODEGA SILOÉ</p><h1>${isEntry?"Registrar entrada":"Registrar salida"}</h1><p>${product.name} · ${formatBodegaNumber(product.quantity)} ${product.unit} disponibles</p></section>
    <section class="ministry-detail-card">
        <input id="bodega-movement-quantity" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="Cantidad en ${product.unit}" style="width:100%;margin-bottom:12px">
        <textarea id="bodega-movement-note" placeholder="Nota opcional" style="width:100%;margin-bottom:12px"></textarea>
        <p id="bodega-movement-message"></p>
        <button type="button" class="profile-option" id="bodega-save-movement"><span>${isEntry?"Guardar entrada":"Guardar salida"}</span><span>✓</span></button>
    </section>
    <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-bodega-product"><span>Volver al producto</span><span>‹</span></button></section>`;

    view.querySelector("#bodega-save-movement")?.addEventListener("click",()=>saveBodegaMovement(product,type));
    view.querySelector("#back-to-bodega-product")?.addEventListener("click",()=>renderBodegaProductDetail(product));
    window.scrollTo({top:0,behavior:"smooth"});
}
async function saveBodegaMovement(product,type){
    const quantity=Number(document.getElementById("bodega-movement-quantity")?.value||"");
    const note=document.getElementById("bodega-movement-note")?.value.trim()||"";
    const msg=document.getElementById("bodega-movement-message");
    const button=document.getElementById("bodega-save-movement");

    if(!Number.isFinite(quantity)||quantity<=0){
        if(msg)msg.textContent="Escribe una cantidad mayor que cero.";
        return;
    }

    const isEntry=type==="entrada";
    if(!isEntry && quantity>Number(product.quantity)){
        if(msg)msg.textContent=`Existencia insuficiente. Disponible: ${formatBodegaNumber(product.quantity)} ${product.unit}.`;
        return;
    }

    if(!window.confirm(`¿Registrar ${isEntry?"entrada":"salida"} de ${formatBodegaNumber(quantity)} ${product.unit} de ${product.name}?`))return;

    const old=button?.innerHTML||"";
    try{
        if(button){
        button.disabled=true;
        button.innerHTML=`
            <span class="bodega-save-beneficiary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="7" r="2.5" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="6.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="17.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M7 19C7.5 15.8 9.2 14 12 14C14.8 14 16.5 15.8 17 19"
                        stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
            </span>
            <span class="bodega-save-beneficiary-copy">
                <strong>Guardando beneficiario…</strong>
                <small>Un momento</small>
            </span>`;
    }
        if(msg)msg.textContent="";

        const newQuantity=await supabaseRpc(
            isEntry?"bodega_add_stock":"bodega_remove_stock",
            {p_product_id:product.product_id,p_quantity:quantity,p_note:note||null}
        );

        await Promise.all([loadBodegaInventory(),loadBodegaMovements()]);
        const updated=window.currentBodegaInventory.find(p=>p.product_id===product.product_id);

        alert(`${isEntry?"Entrada":"Salida"} registrada correctamente. Nueva existencia: ${formatBodegaNumber(newQuantity)} ${product.unit}.`);

        if(updated)renderBodegaProductDetail(updated);
        else renderBodegaPanel();
    }catch(error){
        console.error("Error registrando movimiento de Bodega:",error);
        if(msg)msg.textContent=error.message||"No se pudo registrar el movimiento.";
        if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}
    }
}
function renderBodegaHistory(){
    const view=getBodegaView();
    if(!view)return;
    const movements=window.currentBodegaMovements||[];

    view.innerHTML=`<section class="page-header"><p class="eyebrow">BODEGA SILOÉ</p><h1>Historial</h1><p>${movements.length} movimientos</p></section>
    <section class="ministry-detail-card">
        ${movements.length?movements.map(m=>`<div class="ministry-member-item"><div class="ministry-member-info">
            <h3>${m.movement_type==="entrada"?"Entrada":"Salida"} · ${m.product_name}</h3>
            <p>${formatBodegaNumber(m.quantity)} ${m.unit}</p>
            <small>${m.created_by_name||"Usuario"} · ${formatBodegaDate(m.created_at)}${m.note?` · ${m.note}`:""}</small>
        </div></div>`).join(""):`<div class="ministry-member-item"><div class="ministry-member-info"><h3>Sin movimientos</h3></div></div>`}
    </section>
    <section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-bodega"><span>Volver al inventario</span><span>‹</span></button></section>`;

    view.querySelector("#back-to-bodega")?.addEventListener("click",renderBodegaPanel);
    window.scrollTo({top:0,behavior:"smooth"});
}


/* =========================================================
   BODEGA SILOÉ — BENEFICIARIOS / ENTREGAS
========================================================= */
function renderBodegaBeneficiaries(){
    const view=getBodegaView();
    if(!view)return;

    const beneficiaries=window.currentBodegaBeneficiaries||[];
    view.className="bodega-beneficiaries-screen";

    const peopleIcon=`
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="7" r="2.5" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="6.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="17.5" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/>
            <path d="M7 19C7.5 15.8 9.2 14 12 14C14.8 14 16.5 15.8 17 19"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M2.5 18C2.8 15.8 4 14.5 6 14.5M21.5 18C21.2 15.8 20 14.5 18 14.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-form-back"
                id="back-to-bodega">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Inventario</span>
        </button>

        <section class="bodega-beneficiaries-header">
            <p class="bodega-beneficiaries-eyebrow">BODEGA SILOÉ</p>
            <h1>Beneficiarios</h1>
            <p>${beneficiaries.length} registrados</p>
        </section>

        <section class="bodega-beneficiaries-actions">
            <button type="button"
                    class="bodega-beneficiary-primary-card"
                    id="bodega-new-beneficiary">
                <span class="bodega-beneficiary-primary-icon">${peopleIcon}</span>
                <span class="bodega-beneficiary-primary-copy">
                    <strong>Nuevo beneficiario</strong>
                    <small>Registrar una persona que recibe ayuda</small>
                </span>
                <span class="bodega-beneficiary-primary-arrow" aria-hidden="true">›</span>
            </button>
        </section>

        <section class="bodega-beneficiaries-list-section">
            <div class="bodega-beneficiaries-section-heading">
                <h2>Personas</h2>
                <span>${beneficiaries.length}</span>
            </div>

            <div class="bodega-beneficiaries-list">
                ${beneficiaries.length
                    ? beneficiaries.map(b=>`
                        <button type="button"
                                class="bodega-beneficiary-card"
                                data-beneficiary-id="${b.beneficiary_id}">
                            <span class="bodega-beneficiary-avatar">
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="8" r="3.1"
                                        stroke="currentColor" stroke-width="1.8"/>
                                    <path d="M5.5 20C6.2 15.9 8.5 14 12 14C15.5 14 17.8 15.9 18.5 20"
                                        stroke="currentColor" stroke-width="1.8"
                                        stroke-linecap="round"/>
                                </svg>
                            </span>

                            <span class="bodega-beneficiary-copy">
                                <strong>${b.full_name}</strong>
                                <small>${b.household_size
                                    ? `${b.household_size} personas en el hogar`
                                    : "Personas del hogar no especificadas"}</small>
                                ${b.notes?`<span>${b.notes}</span>`:""}
                            </span>

                            <span class="bodega-beneficiary-arrow" aria-hidden="true">›</span>
                        </button>
                    `).join("")
                    : `
                        <div class="bodega-beneficiaries-empty">
                            <span class="bodega-beneficiaries-empty-icon">${peopleIcon}</span>
                            <span class="bodega-beneficiaries-empty-copy">
                                <strong>No hay beneficiarios registrados</strong>
                                <small>Registra al primero para comenzar.</small>
                            </span>
                        </div>
                    `}
            </div>
        </section>`;

    view.querySelector("#bodega-new-beneficiary")?.addEventListener("click",renderBodegaNewBeneficiary);

    view.querySelectorAll(".bodega-beneficiary-card").forEach(btn=>{
        btn.addEventListener("click",()=>renderBodegaBeneficiaryDetail(btn.dataset.beneficiaryId));
    });

    view.querySelector("#back-to-bodega")?.addEventListener("click",renderBodegaPanel);

    window.scrollTo({top:0,behavior:"smooth"});
}

function renderBodegaNewBeneficiary(){
    const view=getBodegaView();
    if(!view)return;

    view.className="bodega-new-beneficiary-screen";

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-form-back"
                id="back-to-beneficiaries">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Beneficiarios</span>
        </button>

        <section class="bodega-beneficiary-form-header">
            <p class="bodega-beneficiary-form-eyebrow">BODEGA SILOÉ</p>
            <h1>Nuevo beneficiario</h1>
            <p>Registra a la persona que recibirá ayuda.</p>
        </section>

        <section class="bodega-beneficiary-form" aria-label="Nuevo beneficiario">
            <label class="bodega-beneficiary-field">
                <span class="bodega-beneficiary-input-shell bodega-beneficiary-icon-name">
                    <input
                        id="bodega-beneficiary-name"
                        type="text"
                        autocomplete="off"
                        placeholder="Nombre completo"
                        aria-label="Nombre completo"
                    >
                </span>
            </label>

            <label class="bodega-beneficiary-field">
                <span class="bodega-beneficiary-input-shell bodega-beneficiary-icon-household">
                    <input
                        id="bodega-beneficiary-household"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        step="1"
                        placeholder="Personas en el hogar (opcional)"
                        aria-label="Personas en el hogar"
                    >
                </span>
            </label>

            <label class="bodega-beneficiary-field">
                <span class="bodega-beneficiary-input-shell bodega-beneficiary-textarea-shell bodega-beneficiary-icon-notes">
                    <textarea
                        id="bodega-beneficiary-notes"
                        rows="4"
                        placeholder="Notas opcionales"
                        aria-label="Notas opcionales"
                    ></textarea>
                </span>
            </label>

            <p id="bodega-beneficiary-message"
               class="bodega-beneficiary-form-message"
               role="status"></p>

            <button type="button"
                    class="bodega-save-beneficiary-glass"
                    id="bodega-save-beneficiary">
                <span class="bodega-save-beneficiary-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="7" r="2.5"
                            stroke="currentColor" stroke-width="1.8"/>
                        <circle cx="6.5" cy="9" r="2"
                            stroke="currentColor" stroke-width="1.8"/>
                        <circle cx="17.5" cy="9" r="2"
                            stroke="currentColor" stroke-width="1.8"/>
                        <path d="M7 19C7.5 15.8 9.2 14 12 14C14.8 14 16.5 15.8 17 19"
                            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M2.5 18C2.8 15.8 4 14.5 6 14.5M21.5 18C21.2 15.8 20 14.5 18 14.5"
                            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </span>

                <span class="bodega-save-beneficiary-copy">
                    <strong>Guardar beneficiario</strong>
                    <small>Registrar beneficiario</small>
                </span>
            </button>
        </section>`;

    view.querySelector("#bodega-save-beneficiary")?.addEventListener("click",saveBodegaBeneficiary);
    view.querySelector("#back-to-beneficiaries")?.addEventListener("click",renderBodegaBeneficiaries);

    window.scrollTo({top:0,behavior:"smooth"});
}

async function saveBodegaBeneficiary(){
    const name=document.getElementById("bodega-beneficiary-name")?.value.trim()||"";
    const raw=document.getElementById("bodega-beneficiary-household")?.value.trim()||"";
    const notes=document.getElementById("bodega-beneficiary-notes")?.value.trim()||"";
    const msg=document.getElementById("bodega-beneficiary-message"),button=document.getElementById("bodega-save-beneficiary");
    if(!name){if(msg)msg.textContent="Escribe el nombre del beneficiario.";return;}
    const household=raw===""?null:Number(raw);
    if(household!==null&&(!Number.isInteger(household)||household<=0)){if(msg)msg.textContent="La cantidad de personas debe ser un número entero mayor que cero.";return;}
    const old=button?.innerHTML||"";
    try{if(button){button.disabled=true;button.innerHTML="<span>Guardando...</span><span>…</span>";}await supabaseRpc("bodega_create_beneficiary",{p_full_name:name,p_household_size:household,p_notes:notes||null});await loadBodegaBeneficiaries();alert(`Beneficiario "${name}" registrado correctamente.`);renderBodegaBeneficiaries();}
    catch(error){console.error(error);if(msg)msg.textContent=error.message||"No se pudo registrar el beneficiario.";if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}}
}
async function renderBodegaBeneficiaryDetail(id){
    const view=getBodegaView();if(!view)return;
    const b=(window.currentBodegaBeneficiaries||[]).find(x=>x.beneficiary_id===id);if(!b)return alert("No se encontró el beneficiario.");
    const deliveries=(window.currentBodegaDeliveries||[]).filter(d=>d.beneficiary_id===id);
    view.innerHTML=`<section class="page-header"><p class="eyebrow">BENEFICIARIO</p><h1>${b.full_name}</h1><p>${b.household_size?`${b.household_size} personas en el hogar`:"Personas del hogar no especificadas"}</p>${b.notes?`<small>${b.notes}</small>`:""}</section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="delivery-for-beneficiary"><span><strong>Nueva entrega</strong></span><span>+</span></button></section><section class="ministry-detail-card"><div class="section-heading"><h2>Entregas</h2><span>${deliveries.length}</span></div>${deliveries.length?deliveries.map(d=>`<button type="button" class="profile-option beneficiary-delivery-button" data-delivery-id="${d.delivery_id}"><span><strong>${formatBodegaDate(d.created_at)}</strong><small style="display:block;margin-top:4px">${d.created_by_name||"Usuario"}${d.note?` · ${d.note}`:""}</small></span><span>›</span></button>`).join(""):`<p>Este beneficiario todavía no tiene entregas.</p>`}</section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-to-beneficiaries"><span>Volver a beneficiarios</span><span>‹</span></button></section>`;
    view.querySelector("#delivery-for-beneficiary")?.addEventListener("click",()=>renderBodegaNewDelivery(id));
    view.querySelectorAll(".beneficiary-delivery-button").forEach(btn=>btn.addEventListener("click",()=>renderBodegaDeliveryDetail(btn.dataset.deliveryId,()=>renderBodegaBeneficiaryDetail(id))));
    view.querySelector("#back-to-beneficiaries")?.addEventListener("click",renderBodegaBeneficiaries);
    window.scrollTo({top:0,behavior:"smooth"});
}
function renderBodegaNewDelivery(preselected=""){
    const view=getBodegaView();
    if(!view)return;

    const beneficiaries=window.currentBodegaBeneficiaries||[];
    const inventory=window.currentBodegaInventory||[];

    /* Conservamos la misma lógica:
       si todavía no hay beneficiarios, se avisa y se abre el registro. */
    if(!beneficiaries.length){
        alert("Primero registra un beneficiario.");
        renderBodegaNewBeneficiary();
        return;
    }

    if(!inventory.length){
        alert("No hay productos en el inventario.");
        return;
    }

    view.className="bodega-new-delivery-screen";

    const deliveryIcon=`
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6H14V17H3V6Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M14 10H18L21 13V17H14V10Z"
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="7" cy="18" r="2"
                stroke="currentColor" stroke-width="1.8"/>
            <circle cx="18" cy="18" r="2"
                stroke="currentColor" stroke-width="1.8"/>
        </svg>`;

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-form-back"
                id="back-from-new-delivery">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Inventario</span>
        </button>

        <section class="bodega-delivery-header">
            <p class="bodega-delivery-eyebrow">BODEGA SILOÉ</p>
            <h1>Nueva entrega</h1>
            <p>Registra los productos que se entregarán.</p>
        </section>

        <section class="bodega-delivery-block">
            <div class="bodega-delivery-block-heading">
                <span class="bodega-delivery-heading-icon bodega-delivery-people-icon" aria-hidden="true"></span>
                <span>
                    <strong>Beneficiario</strong>
                    <small>Selecciona la persona que recibirá la ayuda.</small>
                </span>
            </div>

            <label class="bodega-delivery-select-shell">
                <select id="bodega-delivery-beneficiary" aria-label="Selecciona un beneficiario">
                    <option value="">Selecciona un beneficiario</option>
                    ${beneficiaries.map(b=>`
                        <option value="${b.beneficiary_id}"
                            ${b.beneficiary_id===preselected?"selected":""}>
                            ${b.full_name}
                        </option>
                    `).join("")}
                </select>
            </label>
        </section>

        <section class="bodega-delivery-block">
            <div class="bodega-delivery-block-heading">
                <span class="bodega-delivery-heading-icon bodega-delivery-box-icon" aria-hidden="true"></span>
                <span>
                    <strong>Productos</strong>
                    <small>Indica la cantidad que se entregará de cada producto.</small>
                </span>
            </div>

            <div class="bodega-delivery-products">
                ${inventory.map(p=>`
                    <div class="bodega-delivery-product-card">
                        <span class="bodega-delivery-product-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 3 20 7 12 11 4 7 12 3Z"
                                    stroke="currentColor" stroke-width="1.8"
                                    stroke-linejoin="round"/>
                                <path d="M4 7V17L12 21 20 17V7"
                                    stroke="currentColor" stroke-width="1.8"
                                    stroke-linejoin="round"/>
                                <path d="M12 11V21"
                                    stroke="currentColor" stroke-width="1.8"
                                    stroke-linecap="round"/>
                            </svg>
                        </span>

                        <span class="bodega-delivery-product-copy">
                            <strong>${p.name}</strong>
                            <small>Disponible: ${formatBodegaNumber(p.quantity)} ${p.unit}</small>
                        </span>

                        <input
                            class="bodega-delivery-quantity"
                            data-product-id="${p.product_id}"
                            data-product-name="${p.name}"
                            data-unit="${p.unit}"
                            data-available="${p.quantity}"
                            type="number"
                            inputmode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="Cant."
                            aria-label="Cantidad de ${p.name}"
                        >
                    </div>
                `).join("")}
            </div>
        </section>

        <section class="bodega-delivery-block">
            <div class="bodega-delivery-block-heading">
                <span class="bodega-delivery-heading-icon bodega-delivery-note-icon" aria-hidden="true"></span>
                <span>
                    <strong>Notas</strong>
                    <small>Información adicional (opcional).</small>
                </span>
            </div>

            <textarea
                id="bodega-delivery-note"
                class="bodega-delivery-note"
                rows="4"
                placeholder="Escribe notas adicionales..."
                aria-label="Notas adicionales"
            ></textarea>
        </section>

        <p id="bodega-delivery-message"
           class="bodega-delivery-message"
           role="status"></p>

        <button type="button"
                class="bodega-register-delivery-glass"
                id="bodega-save-delivery">
            <span class="bodega-register-delivery-icon">${deliveryIcon}</span>
            <span class="bodega-register-delivery-copy">
                <strong>Registrar entrega</strong>
                <small>Guardar la entrega en Bodega Siloé</small>
            </span>
        </button>`;

    view.querySelector("#bodega-save-delivery")?.addEventListener("click",saveBodegaDelivery);

    view.querySelector("#back-from-new-delivery")?.addEventListener("click",
        preselected
            ? ()=>renderBodegaBeneficiaryDetail(preselected)
            : renderBodegaPanel
    );

    window.scrollTo({top:0,behavior:"smooth"});
}

async function saveBodegaDelivery(){
    const beneficiaryId=document.getElementById("bodega-delivery-beneficiary")?.value||"",note=document.getElementById("bodega-delivery-note")?.value.trim()||"",msg=document.getElementById("bodega-delivery-message"),button=document.getElementById("bodega-save-delivery");
    if(!beneficiaryId){if(msg)msg.textContent="Selecciona un beneficiario.";return;}
    const items=[];
    for(const input of document.querySelectorAll(".bodega-delivery-quantity")){const raw=input.value.trim();if(raw==="")continue;const q=Number(raw);if(!Number.isFinite(q)||q<0){if(msg)msg.textContent=`Cantidad no válida para ${input.dataset.productName}.`;return;}if(q===0)continue;const available=Number(input.dataset.available);if(q>available){if(msg)msg.textContent=`Existencia insuficiente de ${input.dataset.productName}. Disponible: ${formatBodegaNumber(available)} ${input.dataset.unit}.`;return;}items.push({product_id:input.dataset.productId,quantity:q});}
    if(!items.length){if(msg)msg.textContent="Agrega al menos un producto a la entrega.";return;}
    const b=(window.currentBodegaBeneficiaries||[]).find(x=>x.beneficiary_id===beneficiaryId);
    const summary=items.map(i=>{const p=(window.currentBodegaInventory||[]).find(x=>x.product_id===i.product_id);return `${formatBodegaNumber(i.quantity)} ${p?.unit||""} de ${p?.name||"producto"}`;}).join("\n");
    if(!confirm(`¿Registrar esta entrega para ${b?.full_name||"el beneficiario"}?\n\n${summary}`))return;
    const old=button?.innerHTML||"";
    try{
        if(button){
            button.disabled=true;
            button.innerHTML=`
                <span class="bodega-register-delivery-icon">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 6H14V17H3V6Z"
                            stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M14 10H18L21 13V17H14V10Z"
                            stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <circle cx="7" cy="18" r="2"
                            stroke="currentColor" stroke-width="1.8"/>
                        <circle cx="18" cy="18" r="2"
                            stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                </span>
                <span class="bodega-register-delivery-copy">
                    <strong>Registrando entrega…</strong>
                    <small>Un momento</small>
                </span>`;
        }
        if(msg)msg.textContent="";
        const deliveryId=await supabaseRpc("bodega_create_delivery",{p_beneficiary_id:beneficiaryId,p_items:items,p_note:note||null});await Promise.all([loadBodegaInventory(),loadBodegaMovements(),loadBodegaDeliveries()]);alert("Entrega registrada correctamente.");await renderBodegaDeliveryDetail(deliveryId,()=>renderBodegaBeneficiaryDetail(beneficiaryId));}
    catch(error){console.error(error);if(msg)msg.textContent=error.message||"No se pudo registrar la entrega.";if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}}
}
function renderBodegaDeliveries(){
    const view=getBodegaView();
    if(!view)return;

    const deliveries=window.currentBodegaDeliveries||[];
    view.className="bodega-deliveries-history-screen";

    const historyIcon=`
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 3H16L19 6V14"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 3V21H13"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 8H15M8 12H13"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round"/>
            <circle cx="17" cy="17" r="4"
                stroke="currentColor" stroke-width="1.8"/>
            <path d="M17 15V17.4L18.7 18.4"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round"/>
        </svg>`;

    view.innerHTML=`
        <button type="button"
                class="programming-back-top bodega-form-back"
                id="back-to-bodega">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Inventario</span>
        </button>

        <section class="bodega-history-header">
            <p class="bodega-history-eyebrow">BODEGA SILOÉ</p>
            <h1>Historial de entregas</h1>
            <p>${deliveries.length} registradas</p>
            <small>Consulta las entregas realizadas a beneficiarios.</small>
        </section>

        <section class="bodega-history-list">
            ${deliveries.length
                ? deliveries.map(d=>`
                    <button type="button"
                            class="bodega-history-delivery-card"
                            data-delivery-id="${d.delivery_id}">
                        <span class="bodega-history-delivery-icon">${historyIcon}</span>

                        <span class="bodega-history-delivery-copy">
                            <strong>${d.beneficiary_name}</strong>
                            <small>${formatBodegaDate(d.created_at)} · ${d.created_by_name||"Usuario"}</small>
                            ${d.note?`<span>${d.note}</span>`:""}
                        </span>

                        <span class="bodega-history-delivery-arrow" aria-hidden="true">›</span>
                    </button>
                `).join("")
                : `
                    <div class="bodega-history-empty">
                        <span class="bodega-history-empty-icon">${historyIcon}</span>
                        <strong>No hay entregas registradas</strong>
                        <p>Las entregas aparecerán aquí cuando se registre la primera.</p>
                    </div>
                `}
        </section>`;

    view.querySelectorAll(".bodega-history-delivery-card").forEach(btn=>{
        btn.addEventListener("click",
            ()=>renderBodegaDeliveryDetail(btn.dataset.deliveryId,renderBodegaDeliveries)
        );
    });

    view.querySelector("#back-to-bodega")?.addEventListener("click",renderBodegaPanel);

    window.scrollTo({top:0,behavior:"smooth"});
}

async function renderBodegaDeliveryDetail(id,back=renderBodegaDeliveries){
    const view=getBodegaView();if(!view)return;const d=(window.currentBodegaDeliveries||[]).find(x=>x.delivery_id===id);if(!d)return alert("No se encontró la entrega.");
    view.innerHTML=`<section class="page-header"><p class="eyebrow">ENTREGA</p><h1>${d.beneficiary_name}</h1><p>Cargando productos...</p></section>`;
    try{const items=await loadBodegaDeliveryItems(id);view.innerHTML=`<section class="page-header"><p class="eyebrow">ENTREGA</p><h1>${d.beneficiary_name}</h1><p>${formatBodegaDate(d.created_at)}</p><small>Entregado por ${d.created_by_name||"Usuario"}${d.note?` · ${d.note}`:""}</small></section><section class="ministry-detail-card"><div class="section-heading"><h2>Productos entregados</h2><span>${items.length}</span></div>${items.map(i=>`<div class="ministry-member-item"><div class="ministry-member-info"><h3>${i.product_name}</h3><p>${formatBodegaNumber(i.quantity)} ${i.unit}</p></div></div>`).join("")}</section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-from-delivery-detail"><span>Volver</span><span>‹</span></button></section>`;view.querySelector("#back-from-delivery-detail")?.addEventListener("click",back);}
    catch(error){view.innerHTML=`<section class="page-header"><p class="eyebrow">ENTREGA</p><h1>${d.beneficiary_name}</h1><p>${error.message||"No se pudo cargar el detalle."}</p></section><section class="ministry-detail-actions"><button type="button" class="profile-option" id="back-from-delivery-detail"><span>Volver</span><span>‹</span></button></section>`;view.querySelector("#back-from-delivery-detail")?.addEventListener("click",back);}
    window.scrollTo({top:0,behavior:"smooth"});
}

/* =========================================================
   PANEL PASTORAL
========================================================= */
function updatePastoralAccess(){
    const s=document.getElementById("pastoral");
    if(s&&!isPastor())s.classList.remove("active-screen");
}

function updatePastoralButtonVisibility(){
    const b=document.getElementById("open-pastoral-from-profile");
    if(b)b.style.display=isPastor()?"":"none";
}

function getPastoralRoot(){
    return document.getElementById("pastoral");
}

function hidePastoralDirectChildren(except=[]){
    const pastoral=getPastoralRoot();
    if(!pastoral)return;
    const keep=new Set(except.filter(Boolean));
    Array.from(pastoral.children).forEach(child=>{
        child.hidden=!keep.has(child);
    });
}

function getPastoralHomeView(){
    const pastoral=getPastoralRoot();
    if(!pastoral)return null;

    let view=document.getElementById("pastoral-home-redesign");
    if(!view){
        view=document.createElement("section");
        view.id="pastoral-home-redesign";
        view.className="pastoral-home-redesign";
        pastoral.appendChild(view);
    }
    return view;
}

function pastoralMenuIcon(type){
    if(type==="people"){
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="16.5" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"/>
            <path d="M2.5 19c.6-4 2.6-6 5.5-6s4.9 2 5.5 6M13.5 14.2c.8-.7 1.8-1.1 3-1.1 2.6 0 4.3 1.9 4.9 5.4"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
    }

    if(type==="accounts"){
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/>
            <path d="M4.5 19c.7-4.2 3.2-6.2 7.5-6.2 2 0 3.7.5 5 1.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="18" cy="18" r="3.5" stroke="currentColor" stroke-width="1.8"/>
            <path d="M18 16.3V18l1.2.8"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
    }

    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5"
            stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 9h18M8 3v4M16 3v4"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M8 13h3M14 13h2M8 16h2"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
}

function renderPastoralHome(){
    if(!isPastor())return;

    const pastoral=getPastoralRoot();
    const view=getPastoralHomeView();
    if(!pastoral||!view)return;

    pastoral.classList.add("pastoral-redesign-active");

    view.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="pastoral-home-back">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al perfil</span>
        </button>

        <section class="pastoral-redesign-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
            <h1>Panel pastoral</h1>
            <p>Administración general de la iglesia.</p>
        </section>

        <section class="pastoral-menu-list">
            <button type="button" class="pastoral-menu-card" id="pastoral-home-people">
                <span class="pastoral-menu-icon">${pastoralMenuIcon("people")}</span>
                <span class="pastoral-menu-copy">
                    <strong>Personas</strong>
                    <small>Miembros, roles y ministerios.</small>
                </span>
                <span class="pastoral-menu-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" class="pastoral-menu-card" id="pastoral-home-accounts">
                <span class="pastoral-menu-icon">${pastoralMenuIcon("accounts")}</span>
                <span class="pastoral-menu-copy">
                    <strong>Cuentas</strong>
                    <small>Accesos y seguridad.</small>
                </span>
                <span class="pastoral-menu-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" class="pastoral-menu-card" id="pastoral-home-services">
                <span class="pastoral-menu-icon">${pastoralMenuIcon("services")}</span>
                <span class="pastoral-menu-copy">
                    <strong>Servicios</strong>
                    <small>Programación de servicios.</small>
                </span>
                <span class="pastoral-menu-arrow" aria-hidden="true">›</span>
            </button>
        </section>`;

    hidePastoralDirectChildren([view]);
    view.hidden=false;

    view.querySelector("#pastoral-home-back")
        ?.addEventListener("click",closePastoralPanel);

    view.querySelector("#pastoral-home-people")
        ?.addEventListener("click",openPastoralPeople);

    view.querySelector("#pastoral-home-accounts")
        ?.addEventListener("click",async()=>{
            view.hidden=true;
            await openPastoralAccounts();
        });

    view.querySelector("#pastoral-home-services")
        ?.addEventListener("click",()=>{
            showScreen("servicios");
        });

    window.scrollTo({top:0,behavior:"smooth"});
}

function openPastoralPanel(){
    if(!isPastor())return alert("No tienes permiso para acceder al panel pastoral.");
    showScreen("pastoral");
    renderPastoralHome();
}

function closePastoralPanel(){
    showScreen("perfil");
}

document.getElementById("pastoral-back-button")?.addEventListener("click",closePastoralPanel);

function getPastoralPeopleView(){
    const pastoral=getPastoralRoot();
    if(!pastoral)return null;

    let view=document.getElementById("pastoral-people-redesign");
    if(!view){
        view=document.createElement("section");
        view.id="pastoral-people-redesign";
        view.className="pastoral-people-redesign";
        pastoral.appendChild(view);
    }
    return view;
}

function pastoralRoleLabel(role){
    if(role==="pastor")return "Pastor";
    if(role==="leader")return "Líder";
    return "Servidor";
}

function pastoralRoleClass(role){
    if(role==="pastor")return "pastor";
    if(role==="leader")return "leader";
    return "server";
}

function renderPastoralPeopleList(people){
    const view=getPastoralPeopleView();
    if(!view)return;

    const list=Array.isArray(people)?people:[];
    const countText=list.length===1?"1 persona":`${list.length} personas`;

    view.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-to-pastoral-home">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Panel pastoral</span>
        </button>

        <section class="pastoral-redesign-header pastoral-people-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
            <h1>Personas</h1>
            <p>${countText}</p>
        </section>

        <button type="button"
                class="pastoral-new-person-glass pastoral-new-person-top"
                id="pastoral-redesign-new-person">
            <span class="pastoral-new-person-icon" aria-hidden="true">+</span>
            <span class="pastoral-new-person-copy">
                <strong>Nueva persona</strong>
                <small>Agregar una persona a la iglesia</small>
            </span>
        </button>

        <section class="pastoral-people-list">
            ${list.length
                ? list.map(person=>{
                    const role=pastoralRoleLabel(person.primary_role);
                    const roleClass=pastoralRoleClass(person.primary_role);
                    const name=`${person.first_name||""} ${person.last_name||""}`.trim()||"Persona";
                    return `
                        <button type="button"
                                class="pastoral-person-row"
                                data-person-id="${person.person_id}">
                            <span class="pastoral-person-name">${name}</span>
                            <span class="pastoral-person-role ${roleClass}">${role}</span>
                            <span class="pastoral-person-arrow" aria-hidden="true">›</span>
                        </button>`;
                }).join("")
                : `
                    <div class="pastoral-people-empty">
                        <strong>No hay personas registradas</strong>
                        <p>Cuando se agregue una persona aparecerá aquí.</p>
                    </div>
                `}
        </section>`;

    view.querySelector("#back-to-pastoral-home")
        ?.addEventListener("click",renderPastoralHome);

    view.querySelectorAll(".pastoral-person-row").forEach(button=>{
        button.addEventListener("click",()=>{
            const person=list.find(item=>item.person_id===button.dataset.personId);
            if(!person)return alert("No se encontró la persona.");
            view.hidden=true;
            openPastoralPersonDetail(person);
        });
    });

    view.querySelector("#pastoral-redesign-new-person")
        ?.addEventListener("click",()=>{
            view.hidden=true;
            openNewPersonForm();
        });
}

async function loadPastoralPeople() {
    if(!isPastor())return;

    const view=getPastoralPeopleView();
    if(!view)return;

    view.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-to-pastoral-home">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Panel pastoral</span>
        </button>

        <section class="pastoral-redesign-header pastoral-people-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
            <h1>Personas</h1>
            <p>Cargando personas...</p>
        </section>`;

    view.querySelector("#back-to-pastoral-home")
        ?.addEventListener("click",renderPastoralHome);

    try{
        const people=await supabaseRpc("get_people_for_pastor");
        window.currentPastoralPeople=Array.isArray(people)?people:[];
        renderPastoralPeopleList(window.currentPastoralPeople);
    }catch(error){
        console.error("Error cargando personas:",error);
        view.innerHTML=`
            <button type="button"
                    class="programming-back-top pastoral-top-back"
                    id="back-to-pastoral-home">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver al Panel pastoral</span>
            </button>

            <section class="pastoral-redesign-header pastoral-people-header">
                <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
                <h1>Personas</h1>
                <p>No se pudieron cargar las personas.</p>
            </section>

            <div class="pastoral-people-empty">
                <strong>No se pudo cargar</strong>
                <p>${error.message||"Ocurrió un error."}</p>
            </div>`;

        view.querySelector("#back-to-pastoral-home")
            ?.addEventListener("click",renderPastoralHome);
    }
}

async function getPastoralPersonMinistries(personId){const x=await supabaseRpc("get_person_ministries",{p_person_id:personId});return Array.isArray(x)?x:[];}
function pastoralPersonRoleLabel(role){
    if(role==="pastor")return "Pastor";
    if(role==="leader")return "Líder";
    return "Servidor";
}

function pastoralPersonRoleClass(role){
    if(role==="pastor")return "pastor";
    if(role==="leader")return "leader";
    return "server";
}

function showPastoralDetailConfirm({
    title,
    message,
    confirmText="Confirmar",
    cancelText="Cancelar"
}={}){
    return new Promise(resolve=>{
        const detail=document.getElementById("pastoral-person-detail");
        if(!detail){
            resolve(false);
            return;
        }

        detail.querySelector(".pastoral-detail-confirm-overlay")?.remove();

        const overlay=document.createElement("div");
        overlay.className="pastoral-detail-confirm-overlay";
        overlay.innerHTML=`
            <div class="pastoral-detail-confirm-card"
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby="pastoral-detail-confirm-title">
                <p class="pastoral-detail-confirm-eyebrow">CONFIRMACIÓN</p>
                <h2 id="pastoral-detail-confirm-title">${title||"Confirmar acción"}</h2>
                <p>${message||"¿Deseas continuar?"}</p>

                <div class="pastoral-detail-confirm-actions">
                    <button type="button"
                            class="pastoral-detail-confirm-button"
                            data-confirm-action="cancel">
                        ${cancelText}
                    </button>

                    <button type="button"
                            class="pastoral-detail-confirm-button is-primary"
                            data-confirm-action="confirm">
                        ${confirmText}
                    </button>
                </div>
            </div>`;

        const finish=value=>{
            overlay.remove();
            resolve(value);
        };

        overlay.addEventListener("click",event=>{
            if(event.target===overlay)finish(false);
        });

        overlay.querySelector('[data-confirm-action="cancel"]')
            ?.addEventListener("click",()=>finish(false));

        overlay.querySelector('[data-confirm-action="confirm"]')
            ?.addEventListener("click",()=>finish(true));

        detail.appendChild(overlay);
    });
}

async function openPastoralPersonDetail(person){
    if(!isPastor())return;
    if(!person?.person_id)return alert("No se encontró la persona.");

    window.currentPastoralPerson=person;

    const pastoral=getPastoralRoot();
    const form=document.getElementById("pastoral-persona-form");

    if(!pastoral)return;
    if(form)form.hidden=true;

    let detail=document.getElementById("pastoral-person-detail");
    if(!detail){
        detail=document.createElement("section");
        detail.id="pastoral-person-detail";
        pastoral.appendChild(detail);
    }

    pastoral.classList.add("pastoral-redesign-active");
    detail.className="pastoral-person-detail-redesign";

    hidePastoralDirectChildren([detail]);
    detail.hidden=false;

    const personName=`${person.first_name||""} ${person.last_name||""}`.trim()||"Persona";

    detail.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-to-pastoral-people">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Personas</span>
        </button>

        <section class="pastoral-person-detail-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
            <h1>${personName}</h1>
            <p>Cargando ministerios...</p>
        </section>`;

    detail.querySelector("#back-to-pastoral-people")
        ?.addEventListener("click",closePastoralPersonDetail);

    window.scrollTo({top:0,behavior:"smooth"});

    try{
        const ministries=await getPastoralPersonMinistries(person.person_id);
        renderPastoralPersonDetail(person,ministries);
    }catch(error){
        console.error(error);

        detail.innerHTML=`
            <button type="button"
                    class="programming-back-top pastoral-top-back"
                    id="back-to-pastoral-people">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver a Personas</span>
            </button>

            <section class="pastoral-person-detail-header">
                <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
                <h1>${personName}</h1>
                <p>No se pudieron cargar los ministerios.</p>
            </section>

            <div class="pastoral-person-detail-empty">
                <strong>No se pudo cargar</strong>
                <p>${error.message||"No se pudieron consultar los ministerios."}</p>
            </div>`;

        detail.querySelector("#back-to-pastoral-people")
            ?.addEventListener("click",closePastoralPersonDetail);
    }
}

function renderPastoralPersonDetail(person,ministries){
    const detail=document.getElementById("pastoral-person-detail");
    if(!detail)return;

    const ministryList=Array.isArray(ministries)?ministries:[];

    // Conserva el comportamiento que ya tenía la ficha:
    // si no es Pastor, el rol visual se deriva de sus membresías.
    const hasLeaderMinistry=ministryList.some(m=>m.membership_role==="leader");
    if(person.primary_role!=="pastor"){
        person.primary_role=hasLeaderMinistry?"leader":"server";
    }

    const roleLabel=pastoralPersonRoleLabel(person.primary_role);
    const roleClass=pastoralPersonRoleClass(person.primary_role);
    const personName=`${person.first_name||""} ${person.last_name||""}`.trim()||"Persona";

    const currentIds=new Set(ministryList.map(m=>m.ministry_id));
    const available=(window.currentMinistries||[]).filter(m=>!currentIds.has(m.id));

    detail.className="pastoral-person-detail-redesign";

    detail.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-to-pastoral-people">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Personas</span>
        </button>

        <section class="pastoral-person-detail-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>

            <div class="pastoral-person-detail-title-row">
                <h1>${personName}</h1>
                <span class="pastoral-person-detail-main-role ${roleClass}">
                    ${roleLabel}
                </span>
            </div>
        </section>

        <section class="pastoral-person-ministries-section">
            <div class="pastoral-person-ministries-heading">
                <h2>Ministerios</h2>
                <span>${ministryList.length}</span>
            </div>

            <div class="pastoral-person-ministries-list">
                ${ministryList.length
                    ? ministryList.map(m=>{
                        const membershipRole=m.membership_role==="leader"?"leader":"server";
                        const membershipLabel=membershipRole==="leader"?"Líder":"Servidor";
                        const changeLabel=membershipRole==="leader"?"Hacer servidor":"Hacer líder";

                        return `
                            <article class="pastoral-person-ministry-card">
                                <div class="pastoral-person-ministry-top">
                                    <strong>${m.ministry_name||"Ministerio"}</strong>
                                    <span class="pastoral-person-ministry-role ${membershipRole}">
                                        ${membershipLabel}
                                    </span>
                                </div>

                                <div class="pastoral-person-ministry-actions">
                                    <button type="button"
                                            class="pastoral-detail-glass-button pastoral-change-ministry-role-button"
                                            data-ministry-id="${m.ministry_id}"
                                            data-ministry-name="${m.ministry_name||"Ministerio"}"
                                            data-current-role="${membershipRole}">
                                        ${changeLabel}
                                    </button>

                                    <button type="button"
                                            class="pastoral-detail-glass-button pastoral-remove-ministry-button"
                                            data-ministry-id="${m.ministry_id}"
                                            data-ministry-name="${m.ministry_name||"Ministerio"}"
                                            data-current-role="${membershipRole}">
                                        Quitar del ministerio
                                    </button>
                                </div>
                            </article>`;
                    }).join("")
                    : `
                        <div class="pastoral-person-detail-empty">
                            <strong>No pertenece a ningún ministerio</strong>
                            <p>Agrega a esta persona a un ministerio cuando corresponda.</p>
                        </div>
                    `}
            </div>
        </section>

        <section class="pastoral-person-detail-actions">
            ${available.length
                ? `
                    <button type="button"
                            class="pastoral-detail-add-glass"
                            id="pastoral-add-ministry-button">
                        <span class="pastoral-detail-add-plus" aria-hidden="true">+</span>
                        <span>
                            <strong>Agregar a un ministerio</strong>
                            <small>Asignar una nueva membresía</small>
                        </span>
                    </button>
                  `
                : `
                    <div class="pastoral-person-all-ministries">
                        <strong>Todos los ministerios asignados</strong>
                        <p>Esta persona ya pertenece a todos los ministerios disponibles.</p>
                    </div>
                  `
            }

            <div id="pastoral-add-ministry-form"
                 class="pastoral-inline-add-ministry"
                 hidden>
                <label for="pastoral-ministry-select">MINISTERIO</label>

                <div class="pastoral-inline-select-shell">
                    <select id="pastoral-ministry-select">
                        <option value="">Selecciona un ministerio</option>
                        ${available.map(m=>`
                            <option value="${m.id}">${m.name}</option>
                        `).join("")}
                    </select>
                </div>

                <p class="pastoral-inline-add-note">
                    Se agregará inicialmente como Servidor.
                </p>

                <p class="pastoral-inline-add-message"
                   id="pastoral-add-ministry-message"></p>

                <div class="pastoral-inline-add-actions">
                    <button type="button"
                            class="pastoral-detail-glass-button"
                            id="pastoral-save-ministry-button">
                        Guardar ministerio
                    </button>

                    <button type="button"
                            class="pastoral-detail-glass-button"
                            id="pastoral-cancel-ministry-button">
                        Cancelar
                    </button>
                </div>
            </div>
        </section>`;

    const add=detail.querySelector("#pastoral-add-ministry-button");
    const form=detail.querySelector("#pastoral-add-ministry-form");
    const select=detail.querySelector("#pastoral-ministry-select");
    const save=detail.querySelector("#pastoral-save-ministry-button");
    const cancel=detail.querySelector("#pastoral-cancel-ministry-button");
    const msg=detail.querySelector("#pastoral-add-ministry-message");

    add?.addEventListener("click",()=>{
        if(form)form.hidden=false;
        add.hidden=true;
    });

    cancel?.addEventListener("click",()=>{
        if(form)form.hidden=true;
        if(add)add.hidden=false;
        if(select)select.value="";
        if(msg)msg.textContent="";
    });

    save?.addEventListener("click",async()=>{
        const ministryId=select?.value||"";

        if(!ministryId){
            if(msg)msg.textContent="Selecciona un ministerio.";
            return;
        }

        if(currentIds.has(ministryId)){
            if(msg)msg.textContent="Esta persona ya pertenece a ese ministerio.";
            return;
        }

        const old=save.innerHTML;

        try{
            save.disabled=true;
            save.textContent="Guardando...";
            if(msg)msg.textContent="";

            await supabaseRpc("add_person_to_ministry",{
                p_person_id:person.person_id,
                p_ministry_id:ministryId,
                p_membership_role:"server"
            });

            renderPastoralPersonDetail(
                person,
                await getPastoralPersonMinistries(person.person_id)
            );
        }catch(error){
            console.error(error);
            if(msg)msg.textContent=error.message||"No se pudo agregar al ministerio.";

            if(document.body.contains(save)){
                save.disabled=false;
                save.innerHTML=old;
            }
        }
    });

    detail.querySelectorAll(".pastoral-change-ministry-role-button")
        .forEach(button=>button.addEventListener("click",async()=>{
            const ministryId=button.dataset.ministryId;
            const ministryName=button.dataset.ministryName||"este ministerio";
            const currentRole=button.dataset.currentRole==="leader"?"leader":"server";
            const newRole=currentRole==="leader"?"server":"leader";

            if(!ministryId)return;

            const newLabel=newRole==="leader"?"Líder":"Servidor";

            const confirmed=await showPastoralDetailConfirm({
                title:`Cambiar rol en ${ministryName}`,
                message:`${personName} pasará a ser ${newLabel} en este ministerio.`,
                confirmText:`Cambiar a ${newLabel}`
            });

            if(!confirmed)return;

            const old=button.innerHTML;

            try{
                button.disabled=true;
                button.textContent="Guardando...";

                const changed=await supabaseRpc("set_ministry_member_role",{
                    p_person_id:person.person_id,
                    p_ministry_id:ministryId,
                    p_membership_role:newRole
                });

                if(changed===false){
                    throw new Error("No se encontró la membresía que se quería actualizar.");
                }

                renderPastoralPersonDetail(
                    person,
                    await getPastoralPersonMinistries(person.person_id)
                );
            }catch(error){
                console.error("Error cambiando rol del ministerio:",error);
                alert(error.message||"No se pudo cambiar el rol.");

                if(document.body.contains(button)){
                    button.disabled=false;
                    button.innerHTML=old;
                }
            }
        }));

    detail.querySelectorAll(".pastoral-remove-ministry-button")
        .forEach(button=>button.addEventListener("click",async()=>{
            const ministryId=button.dataset.ministryId;
            const ministryName=button.dataset.ministryName||"este ministerio";
            const currentRole=button.dataset.currentRole==="leader"?"leader":"server";

            if(!ministryId)return;

            const leaderWarning=currentRole==="leader"
                ? ` ${personName} también dejará de ser Líder de ${ministryName}.`
                : "";

            const confirmed=await showPastoralDetailConfirm({
                title:`Quitar de ${ministryName}`,
                message:`¿Deseas quitar a ${personName} de este ministerio? Esto no eliminará a la persona ni su cuenta.${leaderWarning}`,
                confirmText:"Quitar"
            });

            if(!confirmed)return;

            const old=button.innerHTML;

            try{
                button.disabled=true;
                button.textContent="Quitando...";

                await supabaseRpc("remove_person_from_ministry",{
                    p_person_id:person.person_id,
                    p_ministry_id:ministryId
                });

                renderPastoralPersonDetail(
                    person,
                    await getPastoralPersonMinistries(person.person_id)
                );
            }catch(error){
                console.error("Error quitando persona del ministerio:",error);
                alert(error.message||"No se pudo quitar del ministerio.");

                if(document.body.contains(button)){
                    button.disabled=false;
                    button.innerHTML=old;
                }
            }
        }));

    detail.querySelector("#back-to-pastoral-people")
        ?.addEventListener("click",closePastoralPersonDetail);

    window.scrollTo({top:0,behavior:"smooth"});
}

function closePastoralPersonDetail(){
    const d=document.getElementById("pastoral-person-detail");
    if(d)d.hidden=true;
    window.currentPastoralPerson=null;
    openPastoralPeople();
}
function openPastoralPeople(){
    if(!isPastor())return;

    const view=getPastoralPeopleView();
    if(!view)return;

    const accounts=document.getElementById("pastoral-cuentas-view");
    const detail=document.getElementById("pastoral-person-detail");
    const form=document.getElementById("pastoral-persona-form");

    if(accounts)accounts.hidden=true;
    if(detail)detail.hidden=true;
    if(form)form.hidden=true;

    window.currentPastoralPerson=null;
    hidePastoralDirectChildren([view]);
    view.hidden=false;
    loadPastoralPeople();
    window.scrollTo({top:0,behavior:"smooth"});
}
function getNewPersonDraft(){
    if(!window.newPastoralPersonDraft){
        window.newPastoralPersonDraft={
            selected:new Set(),
            generalRole:"server",
            customRoles:false,
            roles:{}
        };
    }
    return window.newPastoralPersonDraft;
}

function resetNewPersonDraft(){
    window.newPastoralPersonDraft={
        selected:new Set(),
        generalRole:"server",
        customRoles:false,
        roles:{}
    };
    return window.newPastoralPersonDraft;
}

function renderNewPersonMinistryState(form){
    if(!form)return;
    const draft=getNewPersonDraft();

    form.querySelectorAll(".new-person-ministry-chip").forEach(button=>{
        const selected=draft.selected.has(button.dataset.ministryId);
        button.classList.toggle("is-selected",selected);
        button.setAttribute("aria-pressed",selected?"true":"false");
    });

    form.querySelectorAll(".new-person-general-role").forEach(button=>{
        const active=button.dataset.role===draft.generalRole;
        button.classList.toggle("is-active",active);
        button.setAttribute("aria-pressed",active?"true":"false");
    });

    const customToggle=form.querySelector("#new-person-custom-role-toggle");
    if(customToggle){
        const canCustomize=draft.selected.size>0;
        customToggle.classList.toggle("is-on",draft.customRoles&&canCustomize);
        customToggle.classList.toggle("is-disabled",!canCustomize);
        customToggle.setAttribute("aria-pressed",draft.customRoles&&canCustomize?"true":"false");
        customToggle.setAttribute("aria-disabled",canCustomize?"false":"true");
    }

    const customArea=form.querySelector("#new-person-custom-roles");
    if(!customArea)return;

    if(!draft.customRoles || !draft.selected.size){
        customArea.hidden=true;
        customArea.innerHTML="";
        return;
    }

    const ministries=window.currentMinistries||[];
    const selectedMinistries=ministries.filter(m=>draft.selected.has(m.id));

    customArea.hidden=false;
    customArea.innerHTML=selectedMinistries.map(m=>{
        const role=draft.roles[m.id]||draft.generalRole;
        return `
            <button type="button"
                    class="new-person-custom-role-row"
                    data-ministry-id="${m.id}">
                <span class="new-person-custom-role-name">${m.name}</span>
                <span class="new-person-custom-role-pill ${role==="leader"?"leader":"server"}">
                    ${role==="leader"?"Líder":"Servidor"}
                </span>
                <span class="new-person-custom-role-arrow" aria-hidden="true">›</span>
            </button>`;
    }).join("");

    customArea.querySelectorAll(".new-person-custom-role-row").forEach(button=>{
        button.addEventListener("click",()=>{
            const ministryId=button.dataset.ministryId;
            const current=draft.roles[ministryId]||draft.generalRole;
            draft.roles[ministryId]=current==="leader"?"server":"leader";
            renderNewPersonMinistryState(form);
        });
    });
}

async function openNewPersonForm(){
    if(!isPastor())return;

    const pastoral=getPastoralRoot();
    const form=document.getElementById("pastoral-persona-form");
    const detail=document.getElementById("pastoral-person-detail");

    if(!pastoral||!form)return;
    if(detail)detail.hidden=true;

    if(!window.currentMinistries?.length){
        await loadMinistries();
    }

    const ministries=window.currentMinistries||[];
    const draft=resetNewPersonDraft();

    pastoral.classList.add("pastoral-redesign-active");
    form.className="pastoral-new-person-screen";

    form.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="new-person-back">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Personas</span>
        </button>

        <section class="pastoral-redesign-header new-person-header">
            <p class="pastoral-redesign-eyebrow">ADMINISTRACIÓN</p>
            <h1>Nueva persona</h1>
            <p>Crea una persona y asígnala a uno o varios ministerios.</p>
        </section>

        <section class="new-person-field-group">
            <label for="pastoral-first-name">NOMBRE</label>
            <input id="pastoral-first-name"
                   type="text"
                   autocomplete="off"
                   placeholder="Nombre">
        </section>

        <section class="new-person-field-group">
            <label for="pastoral-last-name">APELLIDO</label>
            <input id="pastoral-last-name"
                   type="text"
                   autocomplete="off"
                   placeholder="Apellido">
        </section>

        <section class="new-person-ministry-section">
            <div class="new-person-section-heading">
                <span>MINISTERIOS</span>
                <small>Selecciona uno o varios.</small>
            </div>

            <div class="new-person-ministry-grid">
                ${ministries.map(m=>`
                    <button type="button"
                            class="new-person-ministry-chip"
                            data-ministry-id="${m.id}"
                            aria-pressed="false">
                        <span class="new-person-chip-check" aria-hidden="true">✓</span>
                        <span>${m.name}</span>
                    </button>
                `).join("")}
            </div>
        </section>

        <section class="new-person-role-section">
            <div class="new-person-section-heading">
                <span>ROL GENERAL</span>
            </div>

            <div class="new-person-role-glass" role="group" aria-label="Rol general">
                <button type="button"
                        class="new-person-general-role is-active"
                        data-role="server"
                        aria-pressed="true">
                    Servidor
                </button>
                <button type="button"
                        class="new-person-general-role"
                        data-role="leader"
                        aria-pressed="false">
                    Líder
                </button>
            </div>
        </section>

        <section class="new-person-custom-section">
            <div class="new-person-custom-heading">
                <span>
                    <strong>PERSONALIZAR ROLES</strong>
                    <small>Solo si algún ministerio tendrá un rol diferente.</small>
                </span>

                <button type="button"
                        class="new-person-custom-toggle"
                        id="new-person-custom-role-toggle"
                        aria-pressed="false"
                        aria-label="Personalizar roles">
                    <span></span>
                </button>
            </div>

            <div class="new-person-custom-roles"
                 id="new-person-custom-roles"
                 hidden></div>
        </section>

        <p class="new-person-message"
           id="pastoral-persona-message"
           role="status"></p>

        <button type="button"
                class="new-person-create-glass"
                id="pastoral-guardar-persona-button">
            <span class="new-person-create-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="3"
                        stroke="currentColor" stroke-width="1.8"/>
                    <path d="M3.5 19c.6-4 2.4-6 5.5-6s4.9 2 5.5 6"
                        stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round"/>
                    <path d="M18 8v6M15 11h6"
                        stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round"/>
                </svg>
            </span>
            <span class="new-person-create-copy">
                <strong>Crear persona</strong>
                <small>Guardar persona y ministerios</small>
            </span>
        </button>`;

    hidePastoralDirectChildren([form]);
    form.hidden=false;

    form.querySelector("#new-person-back")
        ?.addEventListener("click",cancelNewPersonForm);

    form.querySelectorAll(".new-person-ministry-chip").forEach(button=>{
        button.addEventListener("click",()=>{
            const ministryId=button.dataset.ministryId;
            if(draft.selected.has(ministryId)){
                draft.selected.delete(ministryId);
                delete draft.roles[ministryId];

                if(!draft.selected.size){
                    draft.customRoles=false;
                }
            }else{
                draft.selected.add(ministryId);
                draft.roles[ministryId]=draft.generalRole;
            }

            const message=form.querySelector("#pastoral-persona-message");
            if(draft.selected.size && message?.textContent?.includes("Selecciona al menos un ministerio")){
                message.textContent="";
            }

            renderNewPersonMinistryState(form);
        });
    });

    form.querySelectorAll(".new-person-general-role").forEach(button=>{
        button.addEventListener("click",()=>{
            const previousRole=draft.generalRole;
            draft.generalRole=button.dataset.role==="leader"?"leader":"server";

            draft.selected.forEach(ministryId=>{
                const current=draft.roles[ministryId]||previousRole;
                if(!draft.customRoles || current===previousRole){
                    draft.roles[ministryId]=draft.generalRole;
                }
            });

            renderNewPersonMinistryState(form);
        });
    });

    form.querySelector("#new-person-custom-role-toggle")
        ?.addEventListener("click",()=>{
            const message=form.querySelector("#pastoral-persona-message");

            if(!draft.selected.size){
                draft.customRoles=false;
                if(message){
                    message.textContent="Selecciona al menos un ministerio para personalizar roles.";
                }
                renderNewPersonMinistryState(form);
                return;
            }

            if(message?.textContent?.includes("Selecciona al menos un ministerio")){
                message.textContent="";
            }

            draft.customRoles=!draft.customRoles;

            if(!draft.customRoles){
                draft.selected.forEach(ministryId=>{
                    draft.roles[ministryId]=draft.generalRole;
                });
            }

            renderNewPersonMinistryState(form);
        });

    form.querySelector("#pastoral-guardar-persona-button")
        ?.addEventListener("click",createPastoralPerson);

    renderNewPersonMinistryState(form);
    window.scrollTo({top:0,behavior:"smooth"});
}

function cancelNewPersonForm(){
    const form=document.getElementById("pastoral-persona-form");
    const detail=document.getElementById("pastoral-person-detail");

    if(form)form.hidden=true;
    if(detail)detail.hidden=true;

    resetNewPersonDraft();
    openPastoralPeople();
}

function extractCreatedPastoralPersonId(created){
    if(typeof created==="string" && created.trim())return created.trim();

    if(Array.isArray(created) && created.length){
        const first=created[0];
        if(typeof first==="string")return first;
        return first?.person_id||first?.id||first?.new_person_id||null;
    }

    if(created && typeof created==="object"){
        return created.person_id||created.id||created.new_person_id||created.created_person_id||null;
    }

    return null;
}

async function resolveCreatedPastoralPersonId(created,firstName,lastName,beforeIds){
    const direct=extractCreatedPastoralPersonId(created);
    if(direct)return direct;

    const people=await supabaseRpc("get_people_for_pastor");
    const list=Array.isArray(people)?people:[];

    const first=normalizeText(firstName);
    const last=normalizeText(lastName);

    const createdPerson=list.find(person=>{
        if(beforeIds.has(person.person_id))return false;
        return normalizeText(person.first_name||"")===first &&
               normalizeText(person.last_name||"")===last;
    });

    window.currentPastoralPeople=list;
    return createdPerson?.person_id||null;
}

async function createPastoralPerson(){
    if(!isPastor())return;

    const form=document.getElementById("pastoral-persona-form");
    if(!form)return;

    const firstName=form.querySelector("#pastoral-first-name")?.value.trim()||"";
    const lastName=form.querySelector("#pastoral-last-name")?.value.trim()||"";
    const message=form.querySelector("#pastoral-persona-message");
    const saveButton=form.querySelector("#pastoral-guardar-persona-button");
    const draft=getNewPersonDraft();

    if(!firstName||!lastName){
        if(message)message.textContent="Escribe nombre y apellido.";
        return;
    }

    if(!draft.selected.size){
        if(message)message.textContent="Selecciona al menos un ministerio.";
        return;
    }

    const selectedMinistries=(window.currentMinistries||[])
        .filter(m=>draft.selected.has(m.id));

    const beforeIds=new Set(
        (window.currentPastoralPeople||[])
            .map(person=>person.person_id)
            .filter(Boolean)
    );

    const oldButtonHtml=saveButton?.innerHTML||"";

    try{
        if(message)message.textContent="";

        if(saveButton){
            saveButton.disabled=true;
            saveButton.innerHTML=`
                <span class="new-person-create-icon" aria-hidden="true">…</span>
                <span class="new-person-create-copy">
                    <strong>Creando persona…</strong>
                    <small>Guardando información</small>
                </span>`;
        }

        const created=await supabaseRpc("create_person",{
            p_first_name:firstName,
            p_last_name:lastName,
            p_primary_role:draft.generalRole
        });

        const personId=await resolveCreatedPastoralPersonId(
            created,
            firstName,
            lastName,
            beforeIds
        );

        if(!personId){
            throw new Error("La persona fue creada, pero no se pudo identificar para asignarle ministerios.");
        }

        const failures=[];

        for(const ministry of selectedMinistries){
            const membershipRole=draft.customRoles
                ? (draft.roles[ministry.id]||draft.generalRole)
                : draft.generalRole;

            try{
                await supabaseRpc("add_person_to_ministry",{
                    p_person_id:personId,
                    p_ministry_id:ministry.id,
                    p_membership_role:membershipRole
                });
            }catch(error){
                console.error(`No se pudo asignar ${ministry.name}:`,error);
                failures.push(ministry.name);
            }
        }

        try{
            const people=await supabaseRpc("get_people_for_pastor");
            window.currentPastoralPeople=Array.isArray(people)?people:[];
        }catch(error){
            console.error("No se pudo refrescar la lista de personas:",error);
        }

        resetNewPersonDraft();

        if(failures.length){
            alert(
                `La persona fue creada, pero no se pudo asignar a: ${failures.join(", ")}. `+
                `Puedes completar esas membresías desde el detalle de la persona.`
            );
        }

        cancelNewPersonForm();

    }catch(error){
        console.error("Error creando persona:",error);

        if(message){
            message.textContent=error.message||"No se pudo crear la persona.";
        }

        if(saveButton && document.body.contains(saveButton)){
            saveButton.disabled=false;
            saveButton.innerHTML=oldButtonHtml;
        }
    }
}
document.getElementById("pastoral-personas-button")?.addEventListener("click",openPastoralPeople);
document.getElementById("pastoral-servicios-button")?.addEventListener("click",()=>{if(isPastor())showScreen("servicios");});
/* =========================================================
   PANEL PASTORAL — CUENTAS / PIN
========================================================= */
async function loadPastoralAccounts() {
    if(!isPastor())return [];
    const x=await supabaseRpc("get_accounts_for_pastor");
    window.currentPastoralAccounts=Array.isArray(x)?x:[];
    return window.currentPastoralAccounts;
}
function getPastoralAccountsView(){
    const pastoral=document.getElementById("pastoral");if(!pastoral)return null;
    let view=document.getElementById("pastoral-cuentas-view");
    if(!view){view=document.createElement("section");view.id="pastoral-cuentas-view";view.hidden=true;pastoral.appendChild(view);}
    return view;
}
function hidePastoralPeopleViews(){
    ["pastoral-personas-section","pastoral-persona-form","pastoral-person-detail"].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
}
async function openPastoralAccounts(){
    if(!isPastor())return alert("Solo un pastor puede administrar cuentas.");

    const view=getPastoralAccountsView();
    if(!view)return;

    hidePastoralPeopleViews();

    const home=document.getElementById("pastoral-home-redesign");
    const people=document.getElementById("pastoral-people-redesign");
    if(home)home.hidden=true;
    if(people)people.hidden=true;

    hidePastoralDirectChildren([view]);
    view.hidden=false;
    view.className="pastoral-accounts-redesign";

    view.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-from-pastoral-accounts">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Panel pastoral</span>
        </button>

        <section class="pastoral-accounts-header">
            <p class="pastoral-redesign-eyebrow">PANEL PASTORAL</p>
            <h1>Cuentas</h1>
            <p>Cargando cuentas...</p>
        </section>`;

    view.querySelector("#back-from-pastoral-accounts")
        ?.addEventListener("click",closePastoralAccounts);

    window.scrollTo({top:0,behavior:"smooth"});

    try{
        await loadPastoralAccounts();
        renderPastoralAccounts();
    }catch(error){
        console.error("Error cargando cuentas:",error);

        view.innerHTML=`
            <button type="button"
                    class="programming-back-top pastoral-top-back"
                    id="back-from-pastoral-accounts">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver al Panel pastoral</span>
            </button>

            <section class="pastoral-accounts-header">
                <p class="pastoral-redesign-eyebrow">PANEL PASTORAL</p>
                <h1>Cuentas</h1>
                <p>No se pudieron cargar las cuentas.</p>
            </section>

            <div class="pastoral-accounts-empty">
                <strong>No se pudo cargar</strong>
                <p>${error.message||"Error desconocido."}</p>
            </div>`;

        view.querySelector("#back-from-pastoral-accounts")
            ?.addEventListener("click",closePastoralAccounts);
    }
}

function renderPastoralAccounts(){
    const view=getPastoralAccountsView();
    if(!view)return;

    const accounts=window.currentPastoralAccounts||[];
    const withAccess=accounts.filter(x=>x.has_account).length;
    const withoutAccess=accounts.length-withAccess;

    view.className="pastoral-accounts-redesign";

    view.innerHTML=`
        <button type="button"
                class="programming-back-top pastoral-top-back"
                id="back-from-pastoral-accounts">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al Panel pastoral</span>
        </button>

        <section class="pastoral-accounts-header">
            <p class="pastoral-redesign-eyebrow">PANEL PASTORAL</p>
            <h1>Cuentas</h1>
            <p>${withAccess} con acceso · ${withoutAccess} sin acceso</p>
        </section>

        <section class="pastoral-accounts-people">
            <div class="pastoral-accounts-section-heading">
                <div>
                    <h2>Personas</h2>
                    <p>${accounts.length}</p>
                </div>
            </div>

            <div class="pastoral-account-list">
                ${accounts.length
                    ? accounts.map(person=>{
                        const name=`${person.first_name||""} ${person.last_name||""}`.trim()||"Persona";
                        const pinText=person.has_account
                            ? (person.has_pin?"PIN configurado":"PIN pendiente")
                            : "PIN no configurado";
                        const accessText=person.has_account?"Con acceso":"Sin acceso";
                        const accessClass=person.has_account?"has-access":"no-access";

                        return `
                            <button type="button"
                                    class="pastoral-account-row"
                                    data-person-id="${person.person_id}">
                                <span class="pastoral-account-copy">
                                    <strong>${name}</strong>
                                    <small>${pinText}</small>
                                </span>

                                <span class="pastoral-account-access ${accessClass}">
                                    ${accessText}
                                </span>

                                <span class="pastoral-account-arrow" aria-hidden="true">›</span>
                            </button>`;
                    }).join("")
                    : `
                        <div class="pastoral-accounts-empty">
                            <strong>No hay personas registradas</strong>
                            <p>Las cuentas aparecerán aquí cuando haya personas disponibles.</p>
                        </div>
                    `}
            </div>
        </section>`;

    view.querySelectorAll(".pastoral-account-row").forEach(button=>{
        button.addEventListener("click",()=>{
            const person=accounts.find(x=>x.person_id===button.dataset.personId);
            if(person)renderPastoralAccountDetail(person);
        });
    });

    view.querySelector("#back-from-pastoral-accounts")
        ?.addEventListener("click",closePastoralAccounts);

    window.scrollTo({top:0,behavior:"smooth"});
}

function renderPastoralAccountDetail(person){
    const view=getPastoralAccountsView();
    if(!view||!person)return;

    const name=`${person.first_name||""} ${person.last_name||""}`.trim()||"Persona";
    const hasAccess=Boolean(person.has_account);
    const statusLabel=hasAccess?"Con acceso":"Sin acceso";
    const statusClass=hasAccess?"has-access":"no-access";

    view.className="pastoral-account-detail-redesign";

    if(!hasAccess){
        view.innerHTML=`
            <button type="button"
                    class="programming-back-top pastoral-top-back"
                    id="back-to-pastoral-accounts">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver a cuentas</span>
            </button>

            <section class="pastoral-account-detail-header">
                <p class="pastoral-redesign-eyebrow">CUENTA</p>

                <div class="pastoral-account-detail-title-row">
                    <h1>${name}</h1>
                    <span class="pastoral-account-detail-status ${statusClass}">
                        ${statusLabel}
                    </span>
                </div>
            </section>

            <section class="pastoral-account-pin-section">
                <h2>PIN</h2>
                <p>Configura un PIN de 4 dígitos para habilitar el acceso.</p>

                <div class="pastoral-account-pin-fields">
                    <input id="pastoral-new-account-pin"
                           type="password"
                           inputmode="numeric"
                           maxlength="4"
                           autocomplete="new-password"
                           placeholder="PIN inicial">

                    <input id="pastoral-new-account-pin-confirm"
                           type="password"
                           inputmode="numeric"
                           maxlength="4"
                           autocomplete="new-password"
                           placeholder="Confirmar PIN">
                </div>

                <p class="pastoral-account-message"
                   id="pastoral-account-message"
                   role="status"></p>

                <button type="button"
                        class="pastoral-account-primary-glass"
                        id="pastoral-create-account-button">
                    <span class="pastoral-account-primary-icon" aria-hidden="true">+</span>
                    <span class="pastoral-account-primary-copy">
                        <strong>Crear acceso</strong>
                        <small>Guardar cuenta y PIN</small>
                    </span>
                </button>
            </section>`;

        view.querySelector("#pastoral-create-account-button")
            ?.addEventListener("click",()=>createPastoralAccount(person));

    }else{
        view.innerHTML=`
            <button type="button"
                    class="programming-back-top pastoral-top-back"
                    id="back-to-pastoral-accounts">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver a cuentas</span>
            </button>

            <section class="pastoral-account-detail-header">
                <p class="pastoral-redesign-eyebrow">CUENTA</p>

                <div class="pastoral-account-detail-title-row">
                    <h1>${name}</h1>
                    <span class="pastoral-account-detail-status ${statusClass}">
                        ${statusLabel}
                    </span>
                </div>
            </section>

            <section class="pastoral-account-pin-section">
                <h2>PIN</h2>
                <p>${person.has_pin
                    ?"PIN configurado."
                    :"Esta cuenta todavía no tiene PIN configurado."
                }</p>

                <div class="pastoral-account-pin-fields">
                    <input id="pastoral-reset-pin"
                           type="password"
                           inputmode="numeric"
                           maxlength="4"
                           autocomplete="new-password"
                           placeholder="Nuevo PIN">

                    <input id="pastoral-reset-pin-confirm"
                           type="password"
                           inputmode="numeric"
                           maxlength="4"
                           autocomplete="new-password"
                           placeholder="Confirmar nuevo PIN">
                </div>

                <p class="pastoral-account-message"
                   id="pastoral-account-message"
                   role="status"></p>

                <button type="button"
                        class="pastoral-account-primary-glass"
                        id="pastoral-reset-pin-button">
                    <span class="pastoral-account-primary-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                            <rect x="6" y="10" width="12" height="9" rx="2"
                                stroke="currentColor" stroke-width="1.8"/>
                            <path d="M9 10V7.5a3 3 0 0 1 6 0V10"
                                stroke="currentColor" stroke-width="1.8"
                                stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span class="pastoral-account-primary-copy">
                        <strong>Restablecer PIN</strong>
                        <small>Generar y guardar nuevo PIN</small>
                    </span>
                </button>
            </section>`;
    }

    view.querySelector("#back-to-pastoral-accounts")
        ?.addEventListener("click",renderPastoralAccounts);

    if(hasAccess){
        view.querySelector("#pastoral-reset-pin-button")
            ?.addEventListener("click",()=>resetPastoralPin(person));
    }

    window.scrollTo({top:0,behavior:"smooth"});
}
async function createPastoralAccount(person){
    if(!isPastor())return;
    const pin=document.getElementById("pastoral-new-account-pin")?.value.trim()||"",confirmPin=document.getElementById("pastoral-new-account-pin-confirm")?.value.trim()||"",msg=document.getElementById("pastoral-account-message"),button=document.getElementById("pastoral-create-account-button");
    if(!/^\d{4}$/.test(pin)){if(msg)msg.textContent="El PIN debe tener exactamente 4 dígitos.";return;}
    if(pin!==confirmPin){if(msg)msg.textContent="Los PIN no coinciden.";return;}
    const name=`${person.first_name||""} ${person.last_name||""}`.trim();if(!confirm(`¿Crear una cuenta de acceso para ${name}?`))return;
    const old=button?.innerHTML||"";
    try{
        if(button){button.disabled=true;button.innerHTML="<span>Creando cuenta...</span><span>…</span>";}if(msg)msg.textContent="";
        const token=getAccessToken();if(!token)throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
        const response=await fetch(CREATE_ACCOUNT_FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`},body:JSON.stringify({person_id:person.person_id,pin})});
        const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{throw new Error("El servidor respondió con un formato inesperado.");}
        if(!response.ok||!data?.ok)throw new Error(data?.error||data?.message||`Error HTTP ${response.status}`);
        await loadPastoralAccounts();const updated=window.currentPastoralAccounts.find(x=>x.person_id===person.person_id);
        if(!updated?.has_account||!updated?.has_pin)throw new Error("La cuenta fue creada, pero la verificación del PIN no quedó completa.");
        alert(`Cuenta creada correctamente para ${name}.`);renderPastoralAccountDetail(updated);
    }catch(error){console.error("Error creando cuenta:",error);if(msg)msg.textContent=error.message||"No se pudo crear la cuenta.";if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=old;}}
}
async function resetPastoralPin(person){
    if(!isPastor())return;

    const pin=document.getElementById("pastoral-reset-pin")?.value.trim()||"";
    const confirmPin=document.getElementById("pastoral-reset-pin-confirm")?.value.trim()||"";
    const msg=document.getElementById("pastoral-account-message");
    const button=document.getElementById("pastoral-reset-pin-button");

    if(!/^\d{4}$/.test(pin)){
        if(msg)msg.textContent="El PIN debe tener exactamente 4 dígitos.";
        return;
    }

    if(pin!==confirmPin){
        if(msg)msg.textContent="Los PIN no coinciden.";
        return;
    }

    const name=`${person.first_name||""} ${person.last_name||""}`.trim();

    if(!confirm(`¿Restablecer el PIN de ${name}?\n\nEl PIN anterior dejará de funcionar.`))return;

    const old=button?.innerHTML||"";

    try{
        if(button){
            button.disabled=true;
            button.innerHTML="<span>Guardando...</span><span>…</span>";
        }
        if(msg)msg.textContent="";

        const token=getAccessToken();
        if(!token)throw new Error("La sesión expiró. Vuelve a iniciar sesión.");

        const response=await fetch(RESET_PIN_FUNCTION_URL,{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                apikey:SUPABASE_ANON_KEY,
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({
                person_id:person.person_id,
                pin
            })
        });

        const responseText=await response.text();
        let data=null;
        try{
            data=responseText?JSON.parse(responseText):null;
        }catch{
            throw new Error("El servidor respondió con un formato inesperado.");
        }

        if(!response.ok||!data?.ok){
            throw new Error(data?.error||data?.message||`Error HTTP ${response.status}`);
        }

        const a=document.getElementById("pastoral-reset-pin");
        const b=document.getElementById("pastoral-reset-pin-confirm");
        if(a)a.value="";
        if(b)b.value="";
        if(msg)msg.textContent="PIN restablecido correctamente.";

        alert(`PIN restablecido correctamente para ${name}.`);
    }catch(error){
        console.error("Error restableciendo PIN:",error);
        if(msg)msg.textContent=error.message||"No se pudo restablecer el PIN.";
    }finally{
        if(button&&document.body.contains(button)){
            button.disabled=false;
            button.innerHTML=old;
        }
    }
}
function closePastoralAccounts(){
    const view=document.getElementById("pastoral-cuentas-view");
    if(view)view.hidden=true;
    renderPastoralHome();
}

document.getElementById("pastoral-cuentas-button")?.addEventListener("click",openPastoralAccounts);
// Actividad reciente fue descartada del Panel Pastoral.
document.getElementById("pastoral-actividad-button")?.remove();

function attachPastoralProfileButton() {
    const profile=document.getElementById("perfil");if(!profile)return;
    let b=document.getElementById("open-pastoral-from-profile");
    if(!b){const o=profile.querySelector(".profile-options");if(!o)return;b=document.createElement("button");b.id="open-pastoral-from-profile";b.type="button";b.className="profile-option";b.innerHTML="<span>Panel pastoral</span><span>›</span>";o.appendChild(b);b.addEventListener("click",openPastoralPanel);}
    updatePastoralButtonVisibility();
}


/* =========================================================
   PERFIL — MIS MINISTERIOS
========================================================= */
function attachMyMinistriesProfileButton() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    const options = profile.querySelector(".profile-options");
    if (!options) return;

    let button = document.getElementById("open-my-ministries-from-profile");

    if (!button) {
        button = Array.from(options.querySelectorAll("button")).find(b =>
            String(b.textContent || "").trim().toLowerCase().includes("mis ministerios")
        );
    }

    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "profile-option";
        button.innerHTML = "<span>Mis ministerios</span><span>›</span>";
        options.prepend(button);
    }

    button.id = "open-my-ministries-from-profile";

    const cleanButton = button.cloneNode(true);
    button.replaceWith(cleanButton);
    cleanButton.addEventListener("click", renderMyMinistries);
}

function getMyMinistryDescription(name="") {
    const key = normalizeMinistryName(name);

    const descriptions = {
        "pastores": "Dirección pastoral",
        "jovenes": "Ministerio de jóvenes",
        "ninos": "Ministerio de niños",
        "diaconado": "Servicio y apoyo",
        "intercesion": "Oración e intercesión",
        "maestro y maestra de sala": "Enseñanza y acompañamiento",
        "alabanza": "Alabanza y adoración",
        "danza": "Ministerio de danza",
        "cocina": "Servicio de cocina",
        "multimedia": "Comunicación y multimedia",
        "bodega siloe": "Inventario y ayuda"
    };

    return descriptions[key] || "Servicio en el ministerio";
}

async function renderMyMinistries() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    document.getElementById("my-ministries-view")?.remove();

    const view = document.createElement("section");
    view.id = "my-ministries-view";
    view.className = "profile-my-ministries-screen";

    view.innerHTML = `
        <button type="button"
                class="programming-back-top profile-subscreen-back"
                id="back-from-my-ministries">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al perfil</span>
        </button>

        <section class="my-ministries-header">
            <p class="my-ministries-eyebrow">PERFIL</p>
            <h1>Mis ministerios</h1>
            <p>Cargando ministerios...</p>
        </section>`;

    Array.from(profile.children).forEach(child => {
        if (child !== view) {
            child.dataset.myMinistriesPreviousDisplay = child.style.display || "";
        }
    });

    profile.appendChild(view);

    Array.from(profile.children).forEach(child => {
        if (child !== view) child.style.display = "none";
    });

    view.querySelector("#back-from-my-ministries")
        ?.addEventListener("click", closeMyMinistries);

    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
        const ministries = await supabaseRpc("get_my_ministries");
        const list = Array.isArray(ministries) ? ministries : [];

        const countText = list.length === 1
            ? "Sirves en 1 ministerio"
            : list.length > 1
                ? `Sirves en ${list.length} ministerios`
                : "No sirves en ningún ministerio actualmente";

        view.innerHTML = `
            <button type="button"
                    class="programming-back-top profile-subscreen-back"
                    id="back-from-my-ministries">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver al perfil</span>
            </button>

            <section class="my-ministries-header">
                <p class="my-ministries-eyebrow">PERFIL</p>
                <h1>Mis ministerios</h1>
                <p>${countText}</p>
            </section>

            <section class="my-ministries-list">
                ${list.length
                    ? list.map(m => {
                        const ministryName = m.ministry_name || "Ministerio";
                        const isLeader = m.membership_role === "leader";
                        return `
                            <article class="my-ministry-card">
                                <span class="my-ministry-card-copy">
                                    <strong>${ministryName}</strong>
                                    <small>${getMyMinistryDescription(ministryName)}</small>
                                </span>

                                <span class="my-ministry-role ${isLeader ? "leader" : "server"}">
                                    ${isLeader ? "Líder" : "Servidor"}
                                </span>
                            </article>`;
                    }).join("")
                    : `
                        <div class="my-ministries-empty">
                            <strong>Sin ministerios</strong>
                            <p>Cuando formes parte de un ministerio aparecerá aquí.</p>
                        </div>
                    `}
            </section>`;

        view.querySelector("#back-from-my-ministries")
            ?.addEventListener("click", closeMyMinistries);

    } catch (error) {
        console.error("Error cargando Mis ministerios:", error);

        view.innerHTML = `
            <button type="button"
                    class="programming-back-top profile-subscreen-back"
                    id="back-from-my-ministries">
                <span class="programming-back-circle" aria-hidden="true">‹</span>
                <span>Volver al perfil</span>
            </button>

            <section class="my-ministries-header">
                <p class="my-ministries-eyebrow">PERFIL</p>
                <h1>Mis ministerios</h1>
                <p>No se pudieron cargar los ministerios.</p>
            </section>

            <div class="my-ministries-empty">
                <strong>No se pudo cargar</strong>
                <p>${error.message || "Ocurrió un error."}</p>
            </div>`;

        view.querySelector("#back-from-my-ministries")
            ?.addEventListener("click", closeMyMinistries);
    }
}

function closeMyMinistries() {
    const profile = document.getElementById("perfil");
    const view = document.getElementById("my-ministries-view");

    if (view) view.remove();
    if (!profile) return;

    Array.from(profile.children).forEach(child => {
        if (Object.prototype.hasOwnProperty.call(child.dataset, "myMinistriesPreviousDisplay")) {
            child.style.display = child.dataset.myMinistriesPreviousDisplay;
            delete child.dataset.myMinistriesPreviousDisplay;
        } else {
            child.style.display = "";
        }
    });

    updatePastoralButtonVisibility();
    window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =========================================================
   PERFIL — CONFIGURACIÓN / LIMPIEZA
========================================================= */
function attachProfileConfiguration() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    const options = profile.querySelector(".profile-options");
    if (!options) return;

    // Quitar "Información personal" del Perfil.
    Array.from(options.querySelectorAll("button")).forEach(button => {
        const label = String(button.textContent || "").trim().toLowerCase();
        if (label.includes("información personal") || label.includes("informacion personal")) {
            button.remove();
        }
    });

    // Usar el botón Configuración que ya existe en el HTML.
    let configButton = document.getElementById("open-settings-from-profile");

    if (!configButton) {
        configButton = Array.from(options.querySelectorAll("button")).find(button =>
            String(button.textContent || "").trim().toLowerCase().includes("configuración") ||
            String(button.textContent || "").trim().toLowerCase().includes("configuracion")
        );
    }

    if (!configButton) {
        configButton = document.createElement("button");
        configButton.type = "button";
        configButton.className = "profile-option";
        configButton.innerHTML = "<span>Configuración</span><span>›</span>";

        const pastoralButton = document.getElementById("open-pastoral-from-profile");
        if (pastoralButton && pastoralButton.parentElement === options) {
            options.insertBefore(configButton, pastoralButton);
        } else {
            options.appendChild(configButton);
        }
    }

    configButton.id = "open-settings-from-profile";

    const cleanConfigButton = configButton.cloneNode(true);
    configButton.replaceWith(cleanConfigButton);
    cleanConfigButton.addEventListener("click", renderProfileSettings);

    // Quitar el botón independiente "Cambiar mi PIN".
    document.getElementById("open-change-pin-from-profile")?.remove();
}

function renderProfileSettings() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    document.getElementById("profile-settings-view")?.remove();

    const view = document.createElement("section");
    view.id = "profile-settings-view";
    view.className = "profile-settings-screen";

    view.innerHTML = `
        <button type="button"
                class="programming-back-top profile-subscreen-back"
                id="back-from-profile-settings">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver al perfil</span>
        </button>

        <section class="profile-settings-header">
            <p class="profile-settings-eyebrow">PERFIL</p>
            <h1>Configuración</h1>
            <p>Administra las opciones de tu cuenta.</p>
        </section>

        <section class="profile-settings-options">
            <button type="button"
                    class="profile-settings-option"
                    id="settings-change-pin">
                <span class="profile-settings-option-icon profile-settings-lock-icon" aria-hidden="true"></span>
                <span class="profile-settings-option-copy">
                    <strong>Cambiar mi PIN</strong>
                    <small>Actualiza tu PIN de acceso.</small>
                </span>
                <span class="profile-settings-option-arrow" aria-hidden="true">›</span>
            </button>
        </section>`;

    Array.from(profile.children).forEach(child => {
        if (child !== view) child.dataset.settingsPreviousDisplay = child.style.display || "";
    });

    profile.appendChild(view);

    Array.from(profile.children).forEach(child => {
        if (child !== view) child.style.display = "none";
    });

    view.querySelector("#settings-change-pin")?.addEventListener("click", () => {
        closeProfileSettings(false);
        renderChangeMyPinForm();
    });

    view.querySelector("#back-from-profile-settings")?.addEventListener("click", () => {
        closeProfileSettings(true);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeProfileSettings(scroll = true) {
    const profile = document.getElementById("perfil");
    const view = document.getElementById("profile-settings-view");

    if (view) view.remove();
    if (!profile) return;

    Array.from(profile.children).forEach(child => {
        if (Object.prototype.hasOwnProperty.call(child.dataset, "settingsPreviousDisplay")) {
            child.style.display = child.dataset.settingsPreviousDisplay;
            delete child.dataset.settingsPreviousDisplay;
        } else {
            child.style.display = "";
        }
    });

    updatePastoralButtonVisibility();

    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   PERFIL — CAMBIAR MI PIN
========================================================= */
function attachChangePinProfileButton() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    const options = profile.querySelector(".profile-options");
    if (!options) return;

    let button = document.getElementById("open-change-pin-from-profile");

    if (!button) {
        button = document.createElement("button");
        button.id = "open-change-pin-from-profile";
        button.type = "button";
        button.className = "profile-option";
        button.innerHTML = "<span>Cambiar mi PIN</span><span>›</span>";

        const pastoralButton = document.getElementById("open-pastoral-from-profile");
        if (pastoralButton && pastoralButton.parentElement === options) {
            options.insertBefore(button, pastoralButton);
        } else {
            options.appendChild(button);
        }

        button.addEventListener("click", renderChangeMyPinForm);
    }
}

function renderChangeMyPinForm() {
    const profile = document.getElementById("perfil");
    if (!profile) return;

    document.getElementById("change-my-pin-view")?.remove();

    const view = document.createElement("section");
    view.id = "change-my-pin-view";
    view.className = "profile-change-pin-screen";

    const lockSvg = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2"
                  stroke="currentColor" stroke-width="1.8"/>
            <path d="M8 10V7.5C8 5.02 9.79 3 12 3s4 2.02 4 4.5V10"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="15" r="1.2" fill="currentColor"/>
        </svg>`;

    const saveSvg = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 4H16L19 7V20H5V4Z"
                  stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M8 4V10H16V4M8 20V14H16V20"
                  stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`;

    view.innerHTML = `
        <button type="button"
                class="programming-back-top profile-subscreen-back"
                id="back-from-change-pin">
            <span class="programming-back-circle" aria-hidden="true">‹</span>
            <span>Volver a Configuración</span>
        </button>

        <section class="profile-change-pin-header">
            <p class="profile-change-pin-eyebrow">PERFIL</p>
            <h1>Cambiar mi PIN</h1>
            <p>Tu nuevo PIN debe tener exactamente 4 dígitos.</p>
        </section>

        <section class="profile-change-pin-form">
            <label class="profile-pin-field" for="change-current-pin">
                <span class="profile-pin-field-icon">${lockSvg}</span>
                <input
                    id="change-current-pin"
                    type="password"
                    inputmode="numeric"
                    maxlength="4"
                    autocomplete="current-password"
                    placeholder="PIN actual"
                    aria-label="PIN actual"
                >
            </label>

            <label class="profile-pin-field" for="change-new-pin">
                <span class="profile-pin-field-icon">${lockSvg}</span>
                <input
                    id="change-new-pin"
                    type="password"
                    inputmode="numeric"
                    maxlength="4"
                    autocomplete="new-password"
                    placeholder="Nuevo PIN"
                    aria-label="Nuevo PIN"
                >
            </label>

            <label class="profile-pin-field" for="change-new-pin-confirm">
                <span class="profile-pin-field-icon">${lockSvg}</span>
                <input
                    id="change-new-pin-confirm"
                    type="password"
                    inputmode="numeric"
                    maxlength="4"
                    autocomplete="new-password"
                    placeholder="Confirmar nuevo PIN"
                    aria-label="Confirmar nuevo PIN"
                >
            </label>

            <p id="change-my-pin-message" class="profile-change-pin-message" role="status"></p>

            <button type="button"
                    class="profile-save-pin-glass"
                    id="change-my-pin-button">
                <span class="profile-save-pin-icon">${saveSvg}</span>
                <span class="profile-save-pin-copy">
                    <strong>Guardar nuevo PIN</strong>
                    <small>Actualizar PIN de acceso</small>
                </span>
            </button>
        </section>`;

    Array.from(profile.children).forEach(child => {
        if (child !== view) child.dataset.changePinPreviousDisplay = child.style.display || "";
    });

    profile.appendChild(view);

    Array.from(profile.children).forEach(child => {
        if (child !== view) child.style.display = "none";
    });

    view.querySelector("#change-my-pin-button")?.addEventListener("click", changeMyPin);
    view.querySelector("#back-from-change-pin")?.addEventListener("click", () => {
        closeChangeMyPinForm();
        renderProfileSettings();
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeChangeMyPinForm() {
    const profile = document.getElementById("perfil");
    const view = document.getElementById("change-my-pin-view");

    if (view) view.remove();
    if (!profile) return;

    Array.from(profile.children).forEach(child => {
        if (child.id === "change-my-pin-view") return;

        if (Object.prototype.hasOwnProperty.call(child.dataset, "changePinPreviousDisplay")) {
            child.style.display = child.dataset.changePinPreviousDisplay;
            delete child.dataset.changePinPreviousDisplay;
        } else {
            child.style.display = "";
        }
    });

    updatePastoralButtonVisibility();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function changeMyPin() {
    const currentPin = document.getElementById("change-current-pin")?.value.trim() || "";
    const newPin = document.getElementById("change-new-pin")?.value.trim() || "";
    const confirmPin = document.getElementById("change-new-pin-confirm")?.value.trim() || "";
    const msg = document.getElementById("change-my-pin-message");
    const button = document.getElementById("change-my-pin-button");

    if (!/^\d{4}$/.test(currentPin)) {
        if (msg) msg.textContent = "El PIN actual debe tener exactamente 4 dígitos.";
        return;
    }

    if (!/^\d{4}$/.test(newPin)) {
        if (msg) msg.textContent = "El nuevo PIN debe tener exactamente 4 dígitos.";
        return;
    }

    if (newPin !== confirmPin) {
        if (msg) msg.textContent = "Los nuevos PIN no coinciden.";
        return;
    }

    if (currentPin === newPin) {
        if (msg) msg.textContent = "El nuevo PIN debe ser diferente al PIN actual.";
        return;
    }

    if (!window.confirm("¿Cambiar tu PIN?\n\nEl PIN anterior dejará de funcionar.")) return;

    const old = button?.innerHTML || "";

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <span class="profile-save-pin-icon">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 4H16L19 7V20H5V4Z"
                              stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M8 4V10H16V4M8 20V14H16V20"
                              stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    </svg>
                </span>
                <span class="profile-save-pin-copy">
                    <strong>Guardando PIN…</strong>
                    <small>Un momento</small>
                </span>`;
        }

        if (msg) msg.textContent = "";

        const token = getAccessToken();
        if (!token) throw new Error("La sesión expiró. Vuelve a iniciar sesión.");

        const response = await fetch(CHANGE_PIN_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                current_pin: currentPin,
                new_pin: newPin
            })
        });

        const responseText = await response.text();
        let data = null;

        try {
            data = responseText ? JSON.parse(responseText) : null;
        } catch {
            throw new Error("El servidor respondió con un formato inesperado.");
        }

        if (!response.ok || !data?.ok) {
            throw new Error(data?.error || data?.message || `Error HTTP ${response.status}`);
        }

        const currentInput = document.getElementById("change-current-pin");
        const newInput = document.getElementById("change-new-pin");
        const confirmInput = document.getElementById("change-new-pin-confirm");

        if (currentInput) currentInput.value = "";
        if (newInput) newInput.value = "";
        if (confirmInput) confirmInput.value = "";
        if (msg) msg.textContent = "PIN actualizado correctamente.";

        alert("Tu PIN fue actualizado correctamente.");
    } catch (error) {
        console.error("Error cambiando PIN:", error);
        if (msg) msg.textContent = error.message || "No se pudo cambiar el PIN.";
    } finally {
        if (button && document.body.contains(button)) {
            button.disabled = false;
            button.innerHTML = old;
        }
    }
}

/* =========================================================
   SESIÓN SEGURA / INICIALIZACIÓN
========================================================= */
function clearStoredSession() {
    localStorage.removeItem("iglesia_session");localStorage.removeItem("iglesia_person");
    window.currentUser=null;window.currentAssignment=null;window.currentLedMinistries=[];
    window.currentServiceDetail=null;window.currentSelectedMinistry=null;window.currentServiceAssignmentData=null;
    window.currentProgrammingMinistry=null;window.currentProgrammingService=null;window.currentPastoralPerson=null;window.currentPastoralAccounts=[];window.currentBodegaInventory=[];window.currentBodegaMovements=[];window.currentBodegaBeneficiaries=[];window.currentBodegaDeliveries=[];
}
function initializeSecureLogin() {
    clearStoredSession();
    if(firstNameInput)firstNameInput.value="";
    if(lastNameInput)lastNameInput.value="";
    if(pinInput)pinInput.value="";
    showLoginMessage("","");showLogin();updateAssignmentButtons();
}
attachPastoralProfileButton();
attachMyMinistriesProfileButton();
attachProfileConfiguration();
updatePastoralAccess();
updatePastoralButtonVisibility();
initializeSecureLogin();


/* =========================================================
   INSTALACIÓN PWA — ANDROID / iPHONE
========================================================= */
let deferredInstallPrompt = null;
const INSTALL_PROMPT_KEY = "sobrenatural_install_prompt_seen_v1";

function isStandalonePWA(){
    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true
    );
}

function isIOSDevice(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroidDevice(){
    return /android/i.test(navigator.userAgent);
}

function hasSeenInstallPrompt(){
    return localStorage.getItem(INSTALL_PROMPT_KEY) === "1";
}

function rememberInstallPrompt(){
    localStorage.setItem(INSTALL_PROMPT_KEY,"1");
}

function closeInstallPrompt({remember=true}={}){
    const overlay=document.getElementById("pwa-install-overlay");
    if(overlay)overlay.remove();
    document.body.classList.remove("pwa-install-open");
    if(remember)rememberInstallPrompt();
}

function getInstallIcon(){
    return `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v11m0 0 4-4m-4 4-4-4"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"/>
            <path d="M5 15v3.2A2.8 2.8 0 0 0 7.8 21h8.4a2.8 2.8 0 0 0 2.8-2.8V15"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"/>
        </svg>`;
}

function renderInstallPrompt(mode){
    if(
        isStandalonePWA() ||
        hasSeenInstallPrompt() ||
        document.getElementById("pwa-install-overlay")
    ){
        return;
    }

    const isIOS=mode==="ios";
    const isAndroid=mode==="android";
    const overlay=document.createElement("div");

    overlay.id="pwa-install-overlay";
    overlay.className="pwa-install-overlay";

    overlay.innerHTML=`
        <div class="pwa-install-sheet"
             role="dialog"
             aria-modal="true"
             aria-labelledby="pwa-install-title">

            <button type="button"
                    class="pwa-install-close"
                    id="pwa-install-close"
                    aria-label="Cerrar">
                ×
            </button>

            <div class="pwa-install-brand">
                <img src="icon-192.png"
                     alt=""
                     class="pwa-install-app-icon">
            </div>

            <p class="pwa-install-eyebrow">IGLESIA SOBRENATURAL</p>

            <h2 id="pwa-install-title">
                Instala Iglesia Sobrenatural
            </h2>

            <p class="pwa-install-description">
                Accede más rápido a tus servicios, asignaciones y ministerios desde tu pantalla de inicio.
            </p>

            ${
                isIOS
                    ? `
                        <div class="pwa-install-ios-help">
                            <span class="pwa-install-ios-number">1</span>
                            <span>Toca <strong>Compartir</strong> en Safari.</span>
                        </div>

                        <div class="pwa-install-ios-help">
                            <span class="pwa-install-ios-number">2</span>
                            <span>Selecciona <strong>Añadir a pantalla de inicio</strong>.</span>
                        </div>

                        <button type="button"
                                class="pwa-install-primary"
                                id="pwa-install-understood">
                            <span class="pwa-install-primary-icon">
                                ${getInstallIcon()}
                            </span>
                            <span>
                                <strong>Entendido</strong>
                                <small>La instalaré desde Safari</small>
                            </span>
                        </button>
                    `
                    : `
                        <button type="button"
                                class="pwa-install-primary"
                                id="pwa-install-action">
                            <span class="pwa-install-primary-icon">
                                ${getInstallIcon()}
                            </span>
                            <span>
                                <strong>${isAndroid ? "Instalar app" : "Instalar"}</strong>
                                <small>Abrir como aplicación</small>
                            </span>
                        </button>
                    `
            }

            <button type="button"
                    class="pwa-install-later"
                    id="pwa-install-later">
                Ahora no
            </button>
        </div>`;

    document.body.appendChild(overlay);
    document.body.classList.add("pwa-install-open");

    requestAnimationFrame(()=>{
        overlay.classList.add("is-visible");
    });

    overlay.querySelector("#pwa-install-close")
        ?.addEventListener("click",()=>closeInstallPrompt());

    overlay.querySelector("#pwa-install-later")
        ?.addEventListener("click",()=>closeInstallPrompt());

    overlay.querySelector("#pwa-install-understood")
        ?.addEventListener("click",()=>closeInstallPrompt());

    overlay.addEventListener("click",(event)=>{
        if(event.target===overlay){
            closeInstallPrompt();
        }
    });

    overlay.querySelector("#pwa-install-action")
        ?.addEventListener("click",async()=>{
            if(!deferredInstallPrompt){
                closeInstallPrompt({remember:false});
                alert("En Chrome abre el menú ⋮ y toca “Instalar aplicación” o “Agregar a pantalla de inicio”.");
                return;
            }

            const button=overlay.querySelector("#pwa-install-action");
            if(button)button.disabled=true;

            try{
                await deferredInstallPrompt.prompt();
                const choice=await deferredInstallPrompt.userChoice;

                deferredInstallPrompt=null;

                if(choice?.outcome==="accepted"){
                    closeInstallPrompt();
                }else{
                    closeInstallPrompt();
                }
            }catch(error){
                console.error("No se pudo abrir el instalador PWA:",error);
                if(button)button.disabled=false;
            }
        });
}

window.addEventListener("beforeinstallprompt",(event)=>{
    event.preventDefault();
    deferredInstallPrompt=event;

    if(
        isAndroidDevice() &&
        !isStandalonePWA() &&
        !hasSeenInstallPrompt()
    ){
        window.setTimeout(()=>{
            renderInstallPrompt("android");
        },900);
    }
});

window.addEventListener("appinstalled",()=>{
    deferredInstallPrompt=null;
    rememberInstallPrompt();
    closeInstallPrompt({remember:false});
});

window.addEventListener("load",()=>{
    if(isStandalonePWA()||hasSeenInstallPrompt())return;

    if(isIOSDevice()){
        window.setTimeout(()=>{
            renderInstallPrompt("ios");
        },1200);
        return;
    }

    if(isAndroidDevice()){
        // Respaldo por si Chrome tarda en disparar beforeinstallprompt.
        window.setTimeout(()=>{
            if(!document.getElementById("pwa-install-overlay")){
                renderInstallPrompt("android");
            }
        },3500);
    }
});


/* =========================================================
   NOTIFICACIONES PUSH — REGISTRO DEL DISPOSITIVO
========================================================= */

const PUSH_PROMPT_NEXT_KEY = "sobrenatural_push_prompt_next_at_v1";

function isInstalledPWA(){
    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true
    );
}

function canUsePushNotifications(){
    return (
        isInstalledPWA() &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

function base64UrlToUint8ArrayPush(base64Url){
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function getPushPromptNextAt(){
    const raw = Number(localStorage.getItem(PUSH_PROMPT_NEXT_KEY) || "0");
    return Number.isFinite(raw) ? raw : 0;
}

function postponePushPrompt(days = 7){
    const next = Date.now() + (days * 24 * 60 * 60 * 1000);
    localStorage.setItem(PUSH_PROMPT_NEXT_KEY, String(next));
}

function clearPushPromptDelay(){
    localStorage.removeItem(PUSH_PROMPT_NEXT_KEY);
}

async function getVapidPublicKey(){
    const response = await fetch(PUSH_SUBSCRIBE_FUNCTION_URL, {
        method: "GET",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
    });

    const text = await response.text();
    let data = null;

    try{
        data = text ? JSON.parse(text) : null;
    }catch{}

    if(!response.ok || !data?.ok || !data?.publicKey){
        throw new Error(
            data?.error ||
            data?.message ||
            "No se pudo obtener la llave de notificaciones."
        );
    }

    return String(data.publicKey).trim();
}

async function savePushSubscription(subscription){
    const accessToken = getAccessToken();

    if(!accessToken){
        throw new Error("Debes iniciar sesión nuevamente.");
    }

    const json = subscription.toJSON();

    const response = await fetch(PUSH_SUBSCRIBE_FUNCTION_URL, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            endpoint: json.endpoint,
            keys: {
                p256dh: json.keys?.p256dh || "",
                auth: json.keys?.auth || ""
            }
        })
    });

    const text = await response.text();
    let data = null;

    try{
        data = text ? JSON.parse(text) : null;
    }catch{}

    if(!response.ok || !data?.ok){
        throw new Error(
            data?.error ||
            data?.message ||
            "No se pudo registrar este dispositivo."
        );
    }

    return data;
}

async function ensurePushSubscription(){
    if(!canUsePushNotifications()){
        throw new Error(
            "Las notificaciones están disponibles cuando Iglesia Sobrenatural está instalada como app."
        );
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if(!subscription){
        const publicKey = await getVapidPublicKey();

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8ArrayPush(publicKey)
        });
    }

    await savePushSubscription(subscription);
    clearPushPromptDelay();

    return subscription;
}

function removePushOptInCard(){
    const overlay = document.getElementById("push-optin-overlay");
    if(!overlay) return;

    overlay.classList.remove("is-visible");

    window.setTimeout(()=>{
        overlay.remove();
        document.body.classList.remove("push-optin-open");
    }, 200);
}

function renderPushOptInCard(){
    if(
        document.getElementById("push-optin-overlay") ||
        !canUsePushNotifications()
    ){
        return;
    }

    const overlay = document.createElement("div");
    overlay.id = "push-optin-overlay";
    overlay.className = "push-optin-overlay";

    overlay.innerHTML = `
        <div class="push-optin-card"
             role="dialog"
             aria-modal="true"
             aria-labelledby="push-optin-title">

            <button type="button"
                    class="push-optin-close"
                    id="push-optin-close"
                    aria-label="Cerrar">
                ×
            </button>

            <div class="push-optin-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
                          stroke="currentColor"
                          stroke-width="1.7"
                          stroke-linejoin="round"/>
                    <path d="M10 21h4"
                          stroke="currentColor"
                          stroke-width="1.7"
                          stroke-linecap="round"/>
                </svg>
            </div>

            <p class="push-optin-eyebrow">IGLESIA SOBRENATURAL</p>

            <h2 id="push-optin-title">
                Activa las notificaciones
            </h2>

            <p class="push-optin-description">
                Recibe avisos de tus servicios asignados y recordatorios importantes.
            </p>

            <div class="push-optin-benefits">
                <div>
                    <span class="push-optin-dot"></span>
                    <span>Servicios asignados</span>
                </div>

                <div>
                    <span class="push-optin-dot"></span>
                    <span>Recordatorios importantes</span>
                </div>
            </div>

            <p class="push-optin-message"
               id="push-optin-message"
               role="status"></p>

            <button type="button"
                    class="push-optin-primary"
                    id="push-optin-enable">
                <span class="push-optin-primary-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linejoin="round"/>
                        <path d="M10 21h4"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"/>
                    </svg>
                </span>

                <span>
                    <strong>Activar notificaciones</strong>
                    <small>Permitir avisos en este teléfono</small>
                </span>
            </button>

            <button type="button"
                    class="push-optin-later"
                    id="push-optin-later">
                Ahora no
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("push-optin-open");

    requestAnimationFrame(()=>{
        overlay.classList.add("is-visible");
    });

    const close = ()=>{
        postponePushPrompt(7);
        removePushOptInCard();
    };

    overlay.querySelector("#push-optin-close")
        ?.addEventListener("click", close);

    overlay.querySelector("#push-optin-later")
        ?.addEventListener("click", close);

    overlay.addEventListener("click",(event)=>{
        if(event.target === overlay){
            close();
        }
    });

    overlay.querySelector("#push-optin-enable")
        ?.addEventListener("click", async()=>{
            const button = overlay.querySelector("#push-optin-enable");
            const message = overlay.querySelector("#push-optin-message");

            if(button) button.disabled = true;

            if(message){
                message.textContent = "";
                message.className = "push-optin-message";
            }

            try{
                const permission = await Notification.requestPermission();

                if(permission !== "granted"){
                    if(permission === "denied"){
                        postponePushPrompt(30);

                        if(message){
                            message.textContent =
                                "Las notificaciones fueron desactivadas. Puedes habilitarlas después desde los ajustes del teléfono.";
                            message.classList.add("is-error");
                        }

                        if(button) button.disabled = false;
                        return;
                    }

                    postponePushPrompt(7);
                    removePushOptInCard();
                    return;
                }

                if(message){
                    message.textContent = "Activando...";
                    message.classList.add("is-success");
                }

                await ensurePushSubscription();

                if(message){
                    message.textContent = "Notificaciones activadas.";
                    message.classList.add("is-success");
                }

                window.setTimeout(()=>{
                    removePushOptInCard();
                }, 800);

            }catch(error){
                console.error("Error activando notificaciones:", error);

                if(message){
                    message.textContent =
                        error?.message ||
                        "No se pudieron activar las notificaciones.";
                    message.classList.add("is-error");
                }

                if(button) button.disabled = false;
            }
        });
}

async function handlePushNotificationsAfterLogin(){
    if(!canUsePushNotifications()){
        return;
    }

    try{
        if(Notification.permission === "granted"){
            // Si ya dio permiso antes, asociamos este mismo dispositivo
            // con la persona que inició sesión actualmente.
            await ensurePushSubscription();
            return;
        }

        if(Notification.permission === "denied"){
            return;
        }

        if(Date.now() < getPushPromptNextAt()){
            return;
        }

        renderPushOptInCard();

    }catch(error){
        console.error("Preparando notificaciones:", error);
    }
}
