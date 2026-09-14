console.log("Iglesia Sobrenatural — App iniciada");

const SUPABASE_URL =
"https://ppetgpgytbmkbcvtfqhh.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_fAOdsgeqTNICDG1jIqybgA_a3Xy22fF";

const LOGIN_FUNCTION_URL =
"https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/Login-pin";

const CREATE_ACCOUNT_FUNCTION_URL =
"https://ppetgpgytbmkbcvtfqhh.supabase.co/functions/v1/crear-cuenta";

/* =========================
ELEMENTOS
========================= */

const loginScreen =
document.getElementById("login-screen");

const loginForm =
document.getElementById("login-form");

const loginButton =
document.getElementById("login-button");

const loginMessage =
document.getElementById("login-message");

const firstNameInput =
document.getElementById("login-first-name");

const lastNameInput =
document.getElementById("login-last-name");

const pinInput =
document.getElementById("login-pin");

const app =
document.querySelector(".app");

const bottomNav =
document.querySelector(".bottom-nav");

/* =========================
ESTADO
========================= */

window.currentUser = null;
window.currentServices = [];
window.currentAssignment = null;
window.currentServiceDetail = null;
window.currentServiceAssignmentData = null;

/* =========================
CALENDARIO
========================= */

let calendarDate =
new Date();

calendarDate.setDate(1);

let selectedCalendarDate =
null;

/* =========================
LOGIN / INTERFAZ
========================= */

function showApp() {

    if (loginScreen) {
        loginScreen.style.display = "none";
    }

    if (app) {
        app.style.display = "block";
    }

    if (bottomNav) {
        bottomNav.style.display = "flex";
    }

}

function showLogin() {

    if (loginScreen) {
        loginScreen.style.display = "flex";
    }

    if (app) {
        app.style.display = "none";
    }

    if (bottomNav) {
        bottomNav.style.display = "none";
    }

}

function showLoginMessage(message, type) {

    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = message;
    loginMessage.className = "login-message";

    if (type) {
        loginMessage.classList.add(type);
    }

}

/* =========================
PERFIL
========================= */

function updateUserInterface(person) {

    if (!person) {
        return;
    }

    const profileName =
    document.querySelector(".profile-name");

    const profileRole =
    document.querySelector(".profile-role");

    const avatar =
    document.querySelector(".profile-avatar");

    if (profileName) {
        profileName.textContent =
        `${person.first_name} ${person.last_name}`;
    }

    if (profileRole) {

        const roles = {
            pastor: "Pastor",
            leader: "Líder",
            server: "Servidor"
        };

        profileRole.textContent =
        roles[person.role] || "Servidor";
    }

    if (avatar) {

        const first =
        person.first_name
            ? person.first_name.trim().charAt(0).toUpperCase()
            : "";

        const last =
        person.last_name
            ? person.last_name.trim().charAt(0).toUpperCase()
            : "";

        avatar.textContent =
        first + last;
    }

    updatePastoralAccess();
    updatePastoralButtonVisibility();

}

/* =========================
LOGIN
========================= */

async function login() {

    const firstName =
    firstNameInput
        ? firstNameInput.value.trim()
        : "";

    const lastName =
    lastNameInput
        ? lastNameInput.value.trim()
        : "";

    const pin =
    pinInput
        ? pinInput.value.trim()
        : "";

    if (!firstName || !lastName || !pin) {

        showLoginMessage(
            "Completa todos los campos.",
            "error"
        );

        return;
    }

    if (!loginButton) {

        console.error(
            "No se encontró el botón de login."
        );

        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Ingresando...";

    showLoginMessage(
        "Conectando...",
        ""
    );

    try {

        const response =
        await fetch(
            LOGIN_FUNCTION_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    pin: pin
                })
            }
        );

        const text =
        await response.text();

        let data;

        try {

            data =
            text
                ? JSON.parse(text)
                : null;

        } catch {

            throw new Error(
                "El servidor respondió con un formato inesperado."
            );
        }

        if (!response.ok) {

            throw new Error(
                data?.error ||
                data?.message ||
                `Error HTTP ${response.status}`
            );
        }

        if (!data || !data.ok) {

            throw new Error(
                data?.error ||
                data?.message ||
                "No se pudo iniciar sesión."
            );
        }

        if (
            !data.session ||
            !data.session.access_token
        ) {

            throw new Error(
                "La sesión no fue recibida correctamente."
            );
        }

        localStorage.setItem(
            "iglesia_session",
            JSON.stringify(data.session)
        );

        localStorage.setItem(
            "iglesia_person",
            JSON.stringify(data.person)
        );

        window.currentUser =
        data.person;

        updateUserInterface(
            data.person
        );

        showLoginMessage(
            "Bienvenido.",
            "success"
        );

        setTimeout(
            async () => {

                showApp();

                try {

                    await loadServices();

                } catch (error) {

                    console.error(
                        "Error cargando servicios después del login:",
                        error
                    );

                }

                try {

                    await loadMyNextAssignment();

                } catch (error) {

                    console.error(
                        "Error cargando próximo servicio:",
                        error
                    );

                }

                renderCalendar();

                updatePastoralAccess();
                updatePastoralButtonVisibility();

            },
            400
        );

    } catch (error) {

        console.error(
            "ERROR COMPLETO:",
            error
        );

        let message =
        "No se pudo conectar con el servidor.";

        if (
            error instanceof TypeError
        ) {

            message =
            "SPCK no pudo conectarse con Supabase.";

        } else if (
            error &&
            error.message
        ) {

            message =
            error.message;
        }

        showLoginMessage(
            message,
            "error"
        );

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Ingresar";
    }

}

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            login();

        }
    );

}

/* =========================
SUPABASE
========================= */

async function supabaseFetch(
    endpoint,
    options = {}
) {

    const sessionData =
    localStorage.getItem(
        "iglesia_session"
    );

    let session = null;

    try {

        session =
        sessionData
            ? JSON.parse(sessionData)
            : null;

    } catch {

        session = null;
    }

    const accessToken =
    session?.access_token;

    const headers = {
        "apikey":
            SUPABASE_ANON_KEY,
        "Content-Type":
            "application/json",
        ...(options.headers || {})
    };

    if (accessToken) {

        headers["Authorization"] =
        `Bearer ${accessToken}`;

    } else {

        headers["Authorization"] =
        `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const response =
    await fetch(
        `${SUPABASE_URL}/rest/v1/${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const text =
    await response.text();

    if (!response.ok) {

        console.error(
            "Supabase error:",
            response.status,
            text
        );

        throw new Error(
            `Supabase ${response.status}: ${text}`
        );
    }

    if (!text) {
        return null;
    }

    return JSON.parse(text);

}

/* =========================
SUPABASE RPC
========================= */

async function supabaseRpc(
    functionName,
    body = {}
) {

    const sessionData =
    localStorage.getItem(
        "iglesia_session"
    );

    let session = null;

    try {

        session =
        sessionData
            ? JSON.parse(sessionData)
            : null;

    } catch {

        session = null;
    }

    const accessToken =
    session?.access_token;

    const headers = {

        "apikey":
            SUPABASE_ANON_KEY,

        "Authorization":
            accessToken
                ? `Bearer ${accessToken}`
                : `Bearer ${SUPABASE_ANON_KEY}`,

        "Content-Type":
            "application/json"
    };

    const response =
    await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
        {
            method: "POST",
            headers,
            body:
                JSON.stringify(body)
        }
    );

    const text =
    await response.text();

    if (!response.ok) {

        console.error(
            "Supabase RPC error:",
            response.status,
            text
        );

        let errorMessage =
        `Supabase RPC ${response.status}: ${text}`;

        try {

            const errorData =
            JSON.parse(text);

            errorMessage =
            errorData.message ||
            errorData.error ||
            errorData.hint ||
            errorMessage;

        } catch {
            /* Mantener mensaje original */
        }

        throw new Error(
            errorMessage
        );
    }

    if (!text) {
        return null;
    }

    return JSON.parse(text);

}

/* =========================
FORMATO DE FECHAS
========================= */

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
    new Date(
        `${dateString}T00:00:00`
    );

    return date
        .toLocaleDateString(
            "es-GT",
            {
                day: "numeric",
                month: "short"
            }
        )
        .replace(".", "");

}

function formatDay(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
    new Date(
        `${dateString}T00:00:00`
    );

    const day =
    date.toLocaleDateString(
        "es-GT",
        {
            weekday: "long"
        }
    );

    return (
        day.charAt(0).toUpperCase() +
        day.slice(1)
    );

}

function formatTime(timeString) {

    if (!timeString) {
        return "";
    }

    const parts =
    timeString.split(":");

    const hour =
    parseInt(parts[0], 10);

    const minutes =
    parts[1] || "00";

    const period =
    hour >= 12 ? "PM" : "AM";

    let hour12 =
    hour % 12;

    if (hour12 === 0) {
        hour12 = 12;
    }

    return `${hour12}:${minutes} ${period}`;

}

/* =========================
SERVICIOS
========================= */

async function loadServices() {

    const nextServiceContent =
    document.getElementById(
        "next-service-content"
    );

    const servicesListContainer =
    document.getElementById(
        "services-list-container"
    );

    try {

        if (nextServiceContent) {

            nextServiceContent.innerHTML =
            `
            <div class="service-loading">
                <span>Cargando...</span>
                <small>Consultando servicios</small>
            </div>
            `;
        }

        if (servicesListContainer) {

            servicesListContainer.innerHTML =
            `
            <div class="service-loading">
                <span>Cargando...</span>
            </div>
            `;
        }

        const services =
        await supabaseFetch(
            "services?select=*&order=service_date.asc,start_time.asc"
        );

        window.currentServices =
        Array.isArray(services)
            ? services
            : [];

        renderServices(
            window.currentServices
        );

        renderCalendar();

    } catch (error) {

        console.error(
            "Error cargando servicios:",
            error
        );

        if (nextServiceContent) {

            nextServiceContent.innerHTML =
            `
            <div class="service-loading">
                <span>
                    No se pudieron cargar los servicios.
                </span>
                <small>
                    Intenta nuevamente.
                </small>
            </div>
            `;
        }

        if (servicesListContainer) {

            servicesListContainer.innerHTML =
            `
            <div class="service-loading">
                <span>
                    No se pudieron cargar los servicios.
                </span>
            </div>
            `;
        }

        renderCalendar();
    }

}

/* =========================
RENDER SERVICIOS
========================= */

function renderServices(services) {

    const nextServiceContent =
    document.getElementById(
        "next-service-content"
    );

    const servicesListContainer =
    document.getElementById(
        "services-list-container"
    );

    if (!Array.isArray(services)) {
        services = [];
    }

    const today =
    new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    const upcomingServices =
    services
        .filter(service => {

            if (!service.service_date) {
                return false;
            }

            const date =
            new Date(
                `${service.service_date}T00:00:00`
            );

            return date >= today;

        })
        .sort((a, b) => {

            const dateA =
            `${a.service_date} ${a.start_time || ""}`;

            const dateB =
            `${b.service_date} ${b.start_time || ""}`;

            return dateA.localeCompare(
                dateB
            );

        });

    const nextService =
    upcomingServices[0];

    if (
        nextServiceContent &&
        nextService
    ) {

        nextServiceContent.innerHTML =
        `
        <div class="service-main">
            <div class="service-main-info">
                <span class="service-label">
                    PRÓXIMO SERVICIO
                </span>
                <h3>
                    ${nextService.title || "Servicio"}
                </h3>
                <p>
                    ${formatDay(nextService.service_date)}
                    ·
                    ${formatTime(nextService.start_time)}
                </p>
                ${
                    nextService.location
                        ? `<small>${nextService.location}</small>`
                        : ""
                }
            </div>
            <span class="service-status">
                Pendiente
            </span>
        </div>
        `;
    }

    if (
        nextServiceContent &&
        !nextService
    ) {

        nextServiceContent.innerHTML =
        `
        <div class="service-main">
            <div class="service-main-info">
                <span class="service-label">
                    PRÓXIMO SERVICIO
                </span>
                <h3>
                    Sin servicios próximos
                </h3>
                <p>
                    No tienes servicios programados.
                </p>
            </div>
        </div>
        `;
    }

    if (servicesListContainer) {

        if (
            upcomingServices.length === 0
        ) {

            servicesListContainer.innerHTML =
            `
            <div class="service-loading">
                <span>
                    No hay servicios próximos.
                </span>
            </div>
            `;

        } else {

            servicesListContainer.innerHTML =
            upcomingServices
                .map(service => {

                    return `
                    <div
                        class="service-list-item"
                        data-service-id="${service.id}"
                    >
                        <div class="service-list-info">
                            <h3>
                                ${service.title || "Servicio"}
                            </h3>
                            <p>
                                ${formatDay(service.service_date)}
                                ·
                                ${formatTime(service.start_time)}
                            </p>
                        </div>
                        <span class="service-list-date">
                            ${formatDate(service.service_date)}
                        </span>
                    </div>
                    `;

                })
                .join("");

            attachServiceClickEvents();
        }
    }

    updateHomeNextActivity(
        upcomingServices
    );

}

/* =========================
CLIC EN SERVICIO
========================= */

function attachServiceClickEvents() {

    document
        .querySelectorAll(
            ".service-list-item"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    async () => {

                        const serviceId =
                        item.dataset.serviceId;

                        if (!serviceId) {
                            return;
                        }

                        await openServiceDetail(
                            serviceId
                        );

                    }
                );

            }
        );

}

/* =========================
DETALLE DE SERVICIO
========================= */

async function openServiceDetail(
    serviceId
) {

    const service =
    getServiceById(
        serviceId
    );

    if (!service) {

        console.error(
            "No se encontró el servicio:",
            serviceId
        );

        return;
    }

    window.currentServiceDetail =
    service;

    try {

        const oldDetail =
        document.getElementById(
            "service-detail"
        );

        if (oldDetail) {
            oldDetail.remove();
        }

        const assignmentData =
        await getServiceAssignmentData(
            service.id,
            service.ministry_id
        );

        console.log(
            "Datos completos del servicio:",
            assignmentData
        );

        renderServiceDetail(
            service,
            assignmentData
        );

    } catch (error) {

        console.error(
            "Error abriendo detalle del servicio:",
            error
        );

        alert(
            error.message ||
            "No se pudo cargar el servicio."
        );
    }

}

/* =========================
RENDER DETALLE SERVICIO
========================= */

function renderServiceDetail(
    service,
    assignmentData
) {

    const servicesScreen =
    document.getElementById(
        "servicios"
    );

    if (!servicesScreen) {
        return;
    }

    const oldDetail =
    document.getElementById(
        "service-detail"
    );

    if (oldDetail) {
        oldDetail.remove();
    }

    const detail =
    document.createElement(
        "section"
    );

    detail.id =
    "service-detail";

    const assignments =
    Array.isArray(
        assignmentData.assignments
    )
        ? assignmentData.assignments
        : [];

    const members =
    Array.isArray(
        assignmentData.members
    )
        ? assignmentData.members
        : [];

    const assignmentPeople =
    Array.isArray(
        assignmentData.assignmentPeople
    )
        ? assignmentData.assignmentPeople
        : [];

    const availableMembers =
    Array.isArray(
        assignmentData.availableMembers
    )
        ? assignmentData.availableMembers
        : [];

    const canManageAssignments =
    window.currentUser &&
    (
        window.currentUser.role ===
            "pastor" ||
        window.currentUser.role ===
            "leader"
    );

    detail.innerHTML =
    `
    <section class="page-header">
        <p class="eyebrow">
            SERVICIO
        </p>
        <h1>
            ${service.title || "Servicio"}
        </h1>
        <p>
            ${formatDay(service.service_date)}
            ·
            ${formatTime(service.start_time)}
            ${
                service.end_time
                    ? ` - ${formatTime(service.end_time)}`
                    : ""
            }
        </p>
        ${
            service.location
                ? `<small>${service.location}</small>`
                : ""
        }
    </section>

    <section class="ministry-detail-card">

        <div class="section-heading">
            <h2>
                Asignaciones
            </h2>

            <span>
                ${assignments.length}
            </span>
        </div>

        <div
            id="service-assignments-container"
        >
            ${
                assignments.length > 0
                    ? assignments
                        .map(
                            assignment => {

                                const member =
                                getMemberById(
                                    members,
                                    assignment.person_id
                                );

                                const assignmentPerson =
                                getAssignmentPersonById(
                                    assignmentPeople,
                                    assignment.person_id
                                );

                                const person =
                                member ||
                                assignmentPerson;

                                const name =
                                person
                                    ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
                                    : "Persona asignada";

                                let status =
                                "Pendiente";

                                if (
                                    assignment.status ===
                                    "confirmado"
                                ) {
                                    status =
                                    "Confirmado";
                                }

                                if (
                                    assignment.status ===
                                    "reclinado"
                                ) {
                                    status =
                                    "Rechazado";
                                }

                                return `
                                <div class="ministry-member-item">
                                    <div class="ministry-member-info">
                                        <h3>
                                            ${name}
                                        </h3>
                                        <p>
                                            ${status}
                                        </p>
                                    </div>
                                </div>
                                `;
                            }
                        )
                        .join("")
                    : `
                        <div class="ministry-member-item">
                            <div class="ministry-member-info">
                                <h3>
                                    Sin asignaciones
                                </h3>
                                <p>
                                    Todavía no hay personas asignadas a este servicio.
                                </p>
                            </div>
                        </div>
                    `
            }
        </div>

    </section>

    ${
        canManageAssignments
            ? `
            <section
                class="ministry-detail-card"
                id="new-assignment-section"
            >

                <div class="section-heading">
                    <h2>
                        Nueva asignación
                    </h2>
                </div>

                ${
                    availableMembers.length > 0
                        ? `
                        <div
                            id="assignment-member-list"
                        >

                            ${availableMembers
                                .map(
                                    member => {

                                        return `
                                        <button
                                            type="button"
                                            class="profile-option assignment-member-button"
                                            data-person-id="${member.person_id}"
                                        >
                                            <span>
                                                ${member.first_name}
                                                ${member.last_name}
                                            </span>

                                            <span>
                                                +
                                            </span>
                                        </button>
                                        `;

                                    }
                                )
                                .join("")}

                        </div>
                        `
                        : `
                        <div class="ministry-member-item">
                            <div class="ministry-member-info">
                                <h3>
                                    Todos están asignados
                                </h3>

                                <p>
                                    No hay integrantes disponibles para este servicio.
                                </p>
                            </div>
                        </div>
                        `
                }

            </section>
            `
            : ""
    }

    <section class="ministry-detail-actions">

        <button
            type="button"
            class="profile-option"
            id="back-to-services"
        >

            <span>
                Volver a servicios
            </span>

            <span>
                ‹
            </span>

        </button>

    </section>
    `;

    servicesScreen.appendChild(
        detail
    );

    const servicesList =
    document.getElementById(
        "services-list-container"
    );

    if (servicesList) {

        servicesList.style.display =
        "none";
    }

    const backButton =
    document.getElementById(
        "back-to-services"
    );

    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                detail.remove();

                if (servicesList) {
                    servicesList.style.display =
                    "";
                }

                window.currentServiceDetail =
                null;

                window.currentServiceAssignmentData =
                null;

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );
    }

    document
        .querySelectorAll(
            ".assignment-member-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const personId =
                        button.dataset.personId;

                        if (!personId) {
                            return;
                        }

                        await handleCreateAssignment(
                            service,
                            personId,
                            button
                        );

                    }
                );

            }
        );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

/* =========================
CREAR ASIGNACIÓN
========================= */

async function handleCreateAssignment(
    service,
    personId,
    button = null
) {

    if (!service || !personId) {

        alert(
            "Faltan datos para realizar la asignación."
        );

        return;
    }

    if (button?.disabled) {
        return;
    }

    if (button) {

        button.disabled = true;

        button.dataset.originalText =
        button.innerHTML;

        button.innerHTML =
        `
        <span>
            Asignando...
        </span>

        <span>
            …
        </span>
        `;
    }

    try {

        const conflict =
        await checkAssignmentConflict(
            service.id,
            personId
        );

        if (
            conflict &&
            conflict.has_conflict
        ) {

            if (
                !window.currentUser ||
                window.currentUser.role !==
                    "pastor"
            ) {

                const conflictDate =
                conflict.conflicting_service_date
                    ? formatDay(
                        conflict.conflicting_service_date
                    )
                    : "";

                const conflictTime =
                conflict.conflicting_start_time
                    ? formatTime(
                        conflict.conflicting_start_time
                    )
                    : "";

                alert(
                    `No se puede realizar la asignación.\n\n` +
                    `Esta persona ya está asignada a otro servicio con un horario que se cruza.` +
                    (
                        conflict.conflicting_service_title
                            ? `\n\nServicio: ${conflict.conflicting_service_title}`
                            : ""
                    ) +
                    (
                        conflictDate
                            ? `\nFecha: ${conflictDate}`
                            : ""
                    ) +
                    (
                        conflictTime
                            ? `\nHora: ${conflictTime}`
                            : ""
                    )
                );

                return;
            }

            const conflictDate =
            conflict.conflicting_service_date
                ? formatDay(
                    conflict.conflicting_service_date
                )
                : "";

            const conflictTime =
            conflict.conflicting_start_time
                ? formatTime(
                    conflict.conflicting_start_time
                )
                : "";

            const allowOverride =
            confirm(
                `Existe un conflicto de horario.\n\n` +
                (
                    conflict.conflicting_service_title
                        ? `Servicio en conflicto: ${conflict.conflicting_service_title}\n`
                        : ""
                ) +
                (
                    conflictDate
                        ? `Fecha: ${conflictDate}\n`
                        : ""
                ) +
                (
                    conflictTime
                        ? `Hora: ${conflictTime}\n`
                        : ""
                ) +
                `\n¿Deseas autorizar la excepción?`
            );

            if (!allowOverride) {
                return;
            }

            const conflictNote =
            prompt(
                "Indica el motivo de la excepción:"
            );

            if (
                !conflictNote ||
                !conflictNote.trim()
            ) {

                alert(
                    "La excepción necesita un motivo."
                );

                return;
            }

            const overrideResult =
            await createAssignmentOverride(
                service.id,
                personId,
                conflictNote
            );

            if (
                !overrideResult.ok
            ) {

                alert(
                    overrideResult.error
                );

                return;
            }

            alert(
                "La asignación fue creada con autorización del pastor."
            );

            await refreshServiceDetail(
                service.id
            );

            return;
        }

        const result =
        await createAssignment(
            service.id,
            personId
        );

        if (!result.ok) {

            alert(
                result.error
            );

            return;
        }

        alert(
            "Asignación creada correctamente."
        );

        await refreshServiceDetail(
            service.id
        );

    } catch (error) {

        console.error(
            "Error procesando asignación:",
            error
        );

        alert(
            error.message ||
            "No se pudo crear la asignación."
        );

    } finally {

        if (
            button &&
            document.body.contains(button)
        ) {

            button.disabled = false;

            if (
                button.dataset.originalText
            ) {

                button.innerHTML =
                button.dataset.originalText;
            }
        }
    }

}

/* =========================
ACTUALIZAR DETALLE
========================= */

async function refreshServiceDetail(
    serviceId
) {

    const service =
    getServiceById(
        serviceId
    );

    if (!service) {
        return;
    }

    try {

        const assignmentData =
        await getServiceAssignmentData(
            service.id,
            service.ministry_id
        );

        window.currentServiceAssignmentData =
        assignmentData;

        renderServiceDetail(
            service,
            assignmentData
        );

    } catch (error) {

        console.error(
            "Error actualizando detalle:",
            error
        );

        alert(
            error.message ||
            "No se pudo actualizar el servicio."
        );
    }

}

/* =========================
OBTENER ASIGNACIONES
========================= */

async function getServiceAssignments(
    serviceId
) {

    if (!serviceId) {

        throw new Error(
            "Falta el servicio."
        );
    }

    try {

        const assignments =
        await supabaseFetch(
            `assignments?select=*&service_id=eq.${serviceId}&order=created_at.asc`
        );

        console.log(
            "Asignaciones del servicio:",
            assignments
        );

        return Array.isArray(assignments)
            ? assignments
            : [];

    } catch (error) {

        console.error(
            "Error obteniendo asignaciones del servicio:",
            error
        );

        throw error;
    }

}

/* =========================
PERSONAS HISTÓRICAS
========================= */

const ASSIGNMENT_PERSON_FALLBACKS = {

    "734e74dc-cc90-43b3-85b4-cee0dac1b3ac": {
        id: "734e74dc-cc90-43b3-85b4-cee0dac1b3ac",
        first_name: "Esaú",
        last_name: "Sánchez"
    }

};

/* =========================
OBTENER PERSONAS DE ASIGNACIONES
========================= */

async function getAssignmentPeople(
    assignments,
    members = []
) {

    if (
        !Array.isArray(assignments) ||
        assignments.length === 0
    ) {
        return [];
    }

    const memberIds =
    new Set(
        Array.isArray(members)
            ? members
                .map(
                    member =>
                        member.person_id
                )
                .filter(Boolean)
            : []
    );

    const personIds =
    [
        ...new Set(
            assignments
                .map(
                    assignment =>
                        assignment.person_id
                )
                .filter(Boolean)
        )
    ];

    const missingPersonIds =
    personIds.filter(
        personId =>
            !memberIds.has(personId)
    );

    if (
        missingPersonIds.length === 0
    ) {
        return [];
    }

    const peopleFound = [];

    try {

        const ids =
        missingPersonIds.join(",");

        const people =
        await supabaseFetch(
            `people?select=id,first_name,last_name&id=in.(${ids})`
        );

        if (Array.isArray(people)) {

            peopleFound.push(
                ...people
            );

        }

        console.log(
            "Personas encontradas para las asignaciones:",
            people
        );

    } catch (error) {

        console.warn(
            "No se pudieron obtener las personas de las asignaciones directamente:",
            error
        );

    }

    missingPersonIds.forEach(
        personId => {

            const alreadyFound =
            peopleFound.some(
                person =>
                    person.id === personId
            );

            if (alreadyFound) {
                return;
            }

            const fallback =
            ASSIGNMENT_PERSON_FALLBACKS[
                personId
            ];

            if (fallback) {

                peopleFound.push(
                    fallback
                );

            }

        }
    );

    console.log(
        "Personas finales de las asignaciones:",
        peopleFound
    );

    return peopleFound;

}

/* =========================
DIAGNÓSTICO DE PERSON_ID
========================= */

function diagnoseAssignmentPeople(
    assignments,
    members
) {

    console.group(
        "DIAGNÓSTICO DE ASIGNACIONES"
    );

    console.log(
        "Asignaciones recibidas:",
        assignments
    );

    console.log(
        "Integrantes del ministerio:",
        members
    );

    const memberIds =
    new Set(
        members.map(
            member =>
                member.person_id
        )
    );

    assignments.forEach(
        assignment => {

            const member =
            members.find(
                item =>
                    item.person_id ===
                    assignment.person_id
            );

            if (member) {

                console.log(
                    "Asignación encontrada:",
                    {
                        assignment_id:
                            assignment.id,

                        person_id:
                            assignment.person_id,

                        nombre:
                            `${member.first_name} ${member.last_name}`,

                        status:
                            assignment.status
                    }
                );

            } else {

                console.warn(
                    "ASIGNACIÓN SIN INTEGRANTE COINCIDENTE:",
                    {
                        assignment_id:
                            assignment.id,

                        person_id:
                            assignment.person_id,

                        status:
                            assignment.status,

                        mensaje:
                            "Este person_id existe en assignments, pero no coincide con ningún person_id devuelto por get_ministry_members."
                    }
                );
            }
        }
    );

    const unavailableAssignmentIds =
    assignments
        .filter(
            assignment =>
                !memberIds.has(
                    assignment.person_id
                )
        )
        .map(
            assignment =>
                assignment.person_id
        );

    if (
        unavailableAssignmentIds.length > 0
    ) {

        console.warn(
            "person_id de asignaciones que NO coinciden:",
            unavailableAssignmentIds
        );

    } else {

        console.log(
            "Todas las asignaciones coinciden correctamente con un integrante."
        );
    }

    console.groupEnd();

}

/* =========================
DATOS DE ASIGNACIONES
========================= */

async function getServiceAssignmentData(
    serviceId,
    ministryId
) {

    if (!serviceId) {

        throw new Error(
            "Falta el servicio."
        );
    }

    if (!ministryId) {

        throw new Error(
            "Falta el ministerio."
        );
    }

    const [
        assignments,
        members
    ] = await Promise.all([

        getServiceAssignments(
            serviceId
        ),

        getMinistryMembers(
            ministryId
        )

    ]);

    const assignmentPeople =
    await getAssignmentPeople(
        assignments,
        members
    );

    diagnoseAssignmentPeople(
        assignments,
        members
    );

    const assignedPersonIds =
    new Set(
        assignments.map(
            assignment =>
                assignment.person_id
        )
    );

    const availableMembers =
    members.filter(
        member =>
            !assignedPersonIds.has(
                member.person_id
            )
    );

    const result = {

        assignments,

        members,

        availableMembers,

        assignmentPeople
    };

    window.currentServiceAssignmentData =
    result;

    console.log(
        "Datos completos de asignaciones:",
        result
    );

    return result;

}

/* =========================
MINISTERIOS / INTEGRANTES
========================= */

async function getMinistryMembers(
    ministryId
) {

    if (!ministryId) {

        throw new Error(
            "Falta el ministerio."
        );
    }

    const members =
    await supabaseRpc(
        "get_ministry_members",
        {
            p_ministry_id:
                ministryId
        }
    );

    console.log(
        "Integrantes del ministerio:",
        members
    );

    return Array.isArray(members)
        ? members
        : [];

}

/* =========================
SERVICIO POR ID
========================= */

function getServiceById(
    serviceId
) {

    if (
        !Array.isArray(
            window.currentServices
        )
    ) {
        return null;
    }

    return window.currentServices.find(
        service =>
            service.id === serviceId
    ) || null;

}

/* =========================
INTEGRANTE POR ID
========================= */

function getMemberById(
    members,
    personId
) {

    if (!Array.isArray(members)) {
        return null;
    }

    return members.find(
        member =>
            member.person_id === personId
    ) || null;

}

/* =========================
PERSONA DE ASIGNACIÓN
========================= */

function getAssignmentPersonById(
    assignmentPeople,
    personId
) {

    if (
        !Array.isArray(
            assignmentPeople
        )
    ) {
        return null;
    }

    return assignmentPeople.find(
        person =>
            person.id === personId
    ) || null;

}

/* =========================
CONFLICTO DE ASIGNACIÓN
========================= */

async function checkAssignmentConflict(
    serviceId,
    personId
) {

    if (!serviceId || !personId) {

        throw new Error(
            "Faltan datos para comprobar el conflicto."
        );
    }

    const result =
    await supabaseRpc(
        "check_assignment_conflict",
        {
            p_service_id:
                serviceId,

            p_person_id:
                personId
        }
    );

    if (
        !Array.isArray(result) ||
        result.length === 0
    ) {

        return {
            has_conflict: false
        };
    }

    return {
        ...result[0],
        has_conflict: true
    };

}

/* =========================
CREAR ASIGNACIÓN NORMAL
========================= */

async function createAssignment(
    serviceId,
    personId
) {

    if (!serviceId || !personId) {

        throw new Error(
            "Debes seleccionar un servicio y una persona."
        );
    }

    try {

        const assignment =
        await supabaseRpc(
            "create_assignment",
            {
                p_service_id:
                    serviceId,

                p_person_id:
                    personId
            }
        );

        console.log(
            "Asignación creada:",
            assignment
        );

        return {
            ok: true,
            assignment
        };

    } catch (error) {

        console.error(
            "Error creando asignación:",
            error
        );

        return {
            ok: false,
            error:
                error.message ||
                "No se pudo crear la asignación."
        };
    }

}

/* =========================
CREAR EXCEPCIÓN
========================= */

async function createAssignmentOverride(
    serviceId,
    personId,
    conflictNote
) {

    if (!serviceId || !personId) {

        throw new Error(
            "Debes seleccionar un servicio y una persona."
        );
    }

    if (
        !conflictNote ||
        !conflictNote.trim()
    ) {

        throw new Error(
            "Debes indicar el motivo de la excepción."
        );
    }

    try {

        const assignment =
        await supabaseRpc(
            "create_assignment_override",
            {
                p_service_id:
                    serviceId,

                p_person_id:
                    personId,

                p_conflict_note:
                    conflictNote.trim()
            }
        );

        console.log(
            "Asignación autorizada por excepción:",
            assignment
        );

        return {
            ok: true,
            assignment
        };

    } catch (error) {

        console.error(
            "Error creando excepción:",
            error
        );

        return {
            ok: false,
            error:
                error.message ||
                "No se pudo crear la excepción."
        };
    }

}

/* =========================
INICIO — PRÓXIMA ACTIVIDAD
========================= */

function updateHomeNextActivity(
    upcomingServices
) {

    const dateElement =
    document.querySelector(
        ".next-activity-date"
    );

    const titleElement =
    document.querySelector(
        ".next-activity-title"
    );

    const infoElement =
    document.querySelector(
        ".next-activity-info"
    );

    if (
        !Array.isArray(upcomingServices) ||
        upcomingServices.length === 0
    ) {

        if (dateElement) {
            dateElement.textContent =
            "";
        }

        if (titleElement) {
            titleElement.textContent =
            "Sin actividades próximas";
        }

        if (infoElement) {
            infoElement.textContent =
            "No hay actividades programadas.";
        }

        return;
    }

    const nextActivity =
    upcomingServices[0];

    if (dateElement) {

        const date =
        new Date(
            `${nextActivity.service_date}T00:00:00`
        );

        const month =
        date
            .toLocaleDateString(
                "es-GT",
                {
                    month: "short"
                }
            )
            .replace(".", "")
            .toUpperCase();

        const day =
        date.getDate();

        dateElement.textContent =
        `${month} ${day}`;
    }

    if (titleElement) {

        titleElement.textContent =
        nextActivity.title ||
        "Servicio";
    }

    if (infoElement) {

        const dayText =
        formatDay(
            nextActivity.service_date
        );

        const timeText =
        formatTime(
            nextActivity.start_time
        );

        infoElement.textContent =
        timeText
            ? `${dayText} · ${timeText}`
            : dayText;
    }

}

/* =========================
MI PRÓXIMO SERVICIO
========================= */

async function loadMyNextAssignment() {

    const homeServiceContent =
    document.getElementById(
        "home-next-service-content"
    );

    if (!homeServiceContent) {
        return;
    }

    try {

        const person =
        window.currentUser;

        if (
            !person ||
            !person.id
        ) {

            homeServiceContent.innerHTML =
            `
            <div>
                <h2>
                    Sin servicio asignado
                </h2>
                <p>
                    No tienes servicios programados.
                </p>
            </div>
            `;

            return;
        }

        const assignments =
        await supabaseFetch(
            `assignments?select=*&person_id=eq.${person.id}&order=created_at.asc`
        );

        if (
            !Array.isArray(assignments) ||
            assignments.length === 0
        ) {

            homeServiceContent.innerHTML =
            `
            <div>
                <h2>
                    Sin servicio asignado
                </h2>
                <p>
                    No tienes servicios programados.
                </p>
            </div>
            `;

            return;
        }

        const today =
        new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        let selectedAssignment =
        null;

        let selectedService =
        null;

        for (
            const assignment
            of assignments
        ) {

            if (
                assignment.status ===
                "reclinado"
            ) {
                continue;
            }

            const service =
            window.currentServices.find(
                item =>
                    item.id ===
                    assignment.service_id
            );

            if (!service) {
                continue;
            }

            if (!service.service_date) {
                continue;
            }

            const serviceDate =
            new Date(
                `${service.service_date}T00:00:00`
            );

            if (serviceDate < today) {
                continue;
            }

            selectedAssignment =
            assignment;

            selectedService =
            service;

            break;
        }

        if (
            !selectedAssignment ||
            !selectedService
        ) {

            homeServiceContent.innerHTML =
            `
            <div>
                <h2>
                    Sin servicio asignado
                </h2>
                <p>
                    No tienes servicios próximos.
                </p>
            </div>
            `;

            return;
        }

        window.currentAssignment =
        selectedAssignment;

        const statusText =
        selectedAssignment.status ===
        "confirmado"
            ? "Confirmado"
            : "Pendiente";

        homeServiceContent.innerHTML =
        `
        <div>
            <h2>
                ${selectedService.title || "Servicio"}
            </h2>

            <p>
                ${formatDay(
                    selectedService.service_date
                )}
                ·
                ${formatTime(
                    selectedService.start_time
                )}
            </p>
        </div>

        <span class="service-status">
            ${statusText}
        </span>
        `;

    } catch (error) {

        console.error(
            "Error cargando próximo servicio:",
            error
        );

        homeServiceContent.innerHTML =
        `
        <div>
            <h2>
                No se pudo cargar
            </h2>

            <p>
                Intenta nuevamente.
            </p>
        </div>
        `;
    }

}

/* =========================
CALENDARIO
========================= */

function renderCalendar() {

    const monthTitle =
    document.getElementById(
        "calendar-month-title"
    );

    const calendarDays =
    document.getElementById(
        "calendar-days"
    );

    if (
        !monthTitle ||
        !calendarDays
    ) {
        return;
    }

    const year =
    calendarDate.getFullYear();

    const month =
    calendarDate.getMonth();

    const monthName =
    calendarDate.toLocaleDateString(
        "es-GT",
        {
            month: "long",
            year: "numeric"
        }
    );

    monthTitle.textContent =
    monthName.charAt(0).toUpperCase() +
    monthName.slice(1);

    calendarDays.innerHTML =
    "";

    const firstDay =
    new Date(
        year,
        month,
        1
    ).getDay();

    const mondayOffset =
    firstDay === 0
        ? 6
        : firstDay - 1;

    const daysInMonth =
    new Date(
        year,
        month + 1,
        0
    ).getDate();

    for (
        let i = 0;
        i < mondayOffset;
        i++
    ) {

        const empty =
        document.createElement(
            "span"
        );

        empty.className =
        "empty";

        calendarDays.appendChild(
            empty
        );
    }

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const dayElement =
        document.createElement(
            "span"
        );

        dayElement.textContent =
        day;

        const dateString =
        createDateString(
            year,
            month + 1,
            day
        );

        dayElement.dataset.date =
        dateString;

        if (
            selectedCalendarDate ===
            dateString
        ) {

            dayElement.classList.add(
                "selected-day"
            );
        }

        if (
            getServicesForDate(
                dateString
            ).length > 0
        ) {

            dayElement.classList.add(
                "has-event"
            );
        }

        dayElement.addEventListener(
            "click",
            () => {

                selectCalendarDate(
                    dateString
                );

            }
        );

        calendarDays.appendChild(
            dayElement
        );
    }

    if (
        !selectedCalendarDate
    ) {

        const firstService =
        window.currentServices
            .find(
                service => {

                    if (
                        !service.service_date
                    ) {
                        return false;
                    }

                    const serviceDate =
                    new Date(
                        `${service.service_date}T00:00:00`
                    );

                    return (
                        serviceDate.getFullYear() ===
                        year &&
                        serviceDate.getMonth() ===
                        month
                    );

                }
            );

        if (firstService) {

            selectedCalendarDate =
            firstService.service_date;

            renderCalendar();

            return;
        }
    }

    renderCalendarEvents();

}

/* =========================
FECHA
========================= */

function createDateString(
    year,
    month,
    day
) {

    return (
        `${year}-` +
        `${String(month).padStart(2, "0")}-` +
        `${String(day).padStart(2, "0")}`
    );

}

/* =========================
SERVICIOS POR FECHA
========================= */

function getServicesForDate(
    dateString
) {

    if (
        !Array.isArray(
            window.currentServices
        )
    ) {
        return [];
    }

    return window.currentServices
        .filter(
            service =>
                service.service_date ===
                dateString
        )
        .sort(
            (a, b) => {

                const timeA =
                a.start_time || "";

                const timeB =
                b.start_time || "";

                return timeA.localeCompare(
                    timeB
                );

            }
        );

}

/* =========================
SELECCIONAR FECHA
========================= */

function selectCalendarDate(
    dateString
) {

    selectedCalendarDate =
    dateString;

    renderCalendar();

}

/* =========================
EVENTOS CALENDARIO
========================= */

function renderCalendarEvents() {

    const eventsContainer =
    document.getElementById(
        "calendar-events"
    );

    if (!eventsContainer) {
        return;
    }

    if (!selectedCalendarDate) {

        eventsContainer.innerHTML =
        `
        <div class="event-small-date">
            --
        </div>

        <div>
            <h2>
                Selecciona una fecha
            </h2>

            <p>
                Consulta las actividades programadas.
            </p>
        </div>
        `;

        return;
    }

    const services =
    getServicesForDate(
        selectedCalendarDate
    );

    const date =
    new Date(
        `${selectedCalendarDate}T00:00:00`
    );

    const month =
    date
        .toLocaleDateString(
            "es-GT",
            {
                month: "short"
            }
        )
        .replace(".", "")
        .toUpperCase();

    const day =
    date.getDate();

    const dateLabel =
    `${month} ${day}`;

    if (
        services.length === 0
    ) {

        eventsContainer.innerHTML =
        `
        <div class="event-small-date">
            ${dateLabel}
        </div>

        <div>
            <h2>
                Sin actividades
            </h2>

            <p>
                No hay actividades programadas para esta fecha.
            </p>
        </div>
        `;

        return;
    }

    eventsContainer.innerHTML =
    services
        .map(
            service => {

                return `
                <div class="calendar-event-item">

                    <div class="event-small-date">
                        ${dateLabel}
                    </div>

                    <div>
                        <h2>
                            ${service.title || "Servicio"}
                        </h2>

                        <p>
                            ${formatDay(service.service_date)}
                            ·
                            ${formatTime(service.start_time)}
                        </p>

                        ${
                            service.location
                                ? `<small>${service.location}</small>`
                                : ""
                        }
                    </div>

                </div>
                `;

            }
        )
        .join("");

}

/* =========================
BOTONES CALENDARIO
========================= */

const previousMonthButton =
document.getElementById(
    "calendar-prev"
);

const nextMonthButton =
document.getElementById(
    "calendar-next"
);

if (previousMonthButton) {

    previousMonthButton.addEventListener(
        "click",
        () => {

            calendarDate.setMonth(
                calendarDate.getMonth() - 1
            );

            selectedCalendarDate =
            null;

            renderCalendar();

        }
    );

}

if (nextMonthButton) {

    nextMonthButton.addEventListener(
        "click",
        () => {

            calendarDate.setMonth(
                calendarDate.getMonth() + 1
            );

            selectedCalendarDate =
            null;

            renderCalendar();

        }
    );

}

/* =========================
NAVEGACIÓN
========================= */

const navItems =
document.querySelectorAll(
    ".nav-item"
);

const screens =
document.querySelectorAll(
    ".screen"
);

function showScreen(screenId) {

    const targetScreen =
    document.getElementById(
        screenId
    );

    if (!targetScreen) {

        console.error(
            "No existe la pantalla:",
            screenId
        );

        return;
    }

    screens.forEach(
        screen => {

            screen.classList.remove(
                "active-screen"
            );

        }
    );

    targetScreen.classList.add(
        "active-screen"
    );

    navItems.forEach(
        nav => {

            nav.classList.toggle(
                "active",
                nav.dataset.screen ===
                screenId
            );

        }
    );

    if (bottomNav) {

        bottomNav.style.display =
        "flex";

    }

    if (
        screenId === "pastoral"
    ) {

        targetScreen.style.display =
        "";

        const peopleSection =
        document.getElementById(
            "pastoral-personas-section"
        );

        const personForm =
        document.getElementById(
            "pastoral-persona-form"
        );

        if (peopleSection) {
            peopleSection.hidden = true;
        }

        if (personForm) {
            personForm.hidden = true;
        }

    }

    if (
        screenId === "servicios"
    ) {

        loadServices();
        loadMyNextAssignment();

    }

    if (
        screenId === "calendario"
    ) {

        renderCalendar();

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

navItems.forEach(
    item => {

        item.addEventListener(
            "click",
            () => {

                const target =
                item.dataset.screen;

                showScreen(
                    target
                );

            }
        );

    }
);

/* =========================
ACCESO RÁPIDO
========================= */

const quickCards =
document.querySelectorAll(
    ".quick-card"
);

quickCards.forEach(
    card => {

        card.addEventListener(
            "click",
            () => {

                const target =
                card.dataset.screen;

                showScreen(
                    target
                );

            }
        );

    }
);

/* =========================
CONFIRMAR SERVICIO
========================= */

const confirmButton =
document.querySelector(
    ".confirm-button"
);

if (confirmButton) {

    confirmButton.addEventListener(
        "click",
        () => {

            confirmButton.textContent =
            "Servicio confirmado";

            confirmButton.style.background =
            "var(--accent)";

            confirmButton.style.color =
            "#0d0d0d";

        }
    );

}

/* =========================
MINISTERIOS
========================= */

function normalizeMinistryName(
    name
) {

    if (!name) {
        return "";
    }

    return name
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .trim();

}

/* =========================
ABRIR MINISTERIO
========================= */

async function openMinistry(
    ministryName
) {

    console.log(
        "Ministerio seleccionado:",
        ministryName
    );

    try {

        const ministries =
        await supabaseFetch(
            "ministries?select=*"
        );

        if (
            !Array.isArray(
                ministries
            )
        ) {

            console.error(
                "Supabase no devolvió los ministerios."
            );

            return;
        }

        const selectedMinistry =
        ministries.find(
            ministry =>
                normalizeMinistryName(
                    ministry.name
                ) ===
                normalizeMinistryName(
                    ministryName
                )
        );

        if (!selectedMinistry) {

            console.error(
                "No se encontró el ministerio:",
                ministryName
            );

            return;
        }

        console.log(
            "Ministerio encontrado:",
            selectedMinistry
        );

        const members =
        await supabaseRpc(
            "get_ministry_members",
            {
                p_ministry_id:
                    selectedMinistry.id
            }
        );

        console.log(
            "Integrantes obtenidos mediante RPC:",
            members
        );

        showMinistryDetail(
            selectedMinistry,
            Array.isArray(members)
                ? members
                : []
        );

    } catch (error) {

        console.error(
            "Error abriendo ministerio:",
            error
        );
    }

}

/* =========================
DETALLE MINISTERIO
========================= */

function showMinistryDetail(
    ministry,
    members
) {

    const ministeriosScreen =
    document.getElementById(
        "ministerios"
    );

    if (!ministeriosScreen) {
        return;
    }

    const oldDetail =
    document.getElementById(
        "ministry-detail"
    );

    if (oldDetail) {
        oldDetail.remove();
    }

    const detail =
    document.createElement(
        "section"
    );

    detail.id =
    "ministry-detail";

    detail.innerHTML =
    `
    <section class="page-header">

        <p class="eyebrow">
            MINISTERIO
        </p>

        <h1>
            ${ministry.name}
        </h1>

        <p>
            ${ministry.description || ""}
        </p>

    </section>

    <section class="ministry-detail-card">

        <div class="section-heading">

            <h2>
                Integrantes
            </h2>

        </div>

        <div
            id="ministry-members-container"
        >

            ${
                Array.isArray(members) &&
                members.length > 0

                    ? members
                        .map(
                            member => {

                                const firstName =
                                member.first_name || "";

                                const lastName =
                                member.last_name || "";

                                const role =
                                member.membership_role ===
                                "leader"
                                    ? "Líder"
                                    : "Servidor";

                                return `
                                <div class="ministry-member-item">

                                    <div class="ministry-member-info">

                                        <h3>
                                            ${firstName}
                                            ${lastName}
                                        </h3>

                                        <p>
                                            ${role}
                                        </p>

                                    </div>

                                </div>
                                `;

                            }
                        )
                        .join("")

                    : `
                        <div class="ministry-member-item">

                            <div class="ministry-member-info">

                                <h3>
                                    Sin integrantes
                                </h3>

                                <p>
                                    No hay integrantes para mostrar.
                                </p>

                            </div>

                        </div>
                        `
            }

        </div>

    </section>

    <section class="ministry-detail-actions">

        <button
            type="button"
            class="profile-option"
            id="back-to-ministries"
        >

            <span>
                Volver a ministerios
            </span>

            <span>
                ‹
            </span>

        </button>

    </section>
    `;

    ministeriosScreen.appendChild(
        detail
    );

    const ministryList =
    ministeriosScreen.querySelector(
        ".ministries-list"
    );

    if (ministryList) {

        ministryList.style.display =
        "none";
    }

    const backButton =
    document.getElementById(
        "back-to-ministries"
    );

    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                detail.remove();

                if (ministryList) {

                    ministryList.style.display =
                    "";
                }

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

/* =========================
CLIC EN TARJETAS
========================= */

document
    .querySelectorAll(
        ".ministry-card"
    )
    .forEach(
        card => {

            card.addEventListener(
                "click",
                () => {

                    const ministryName =
                    card.dataset
                        .ministryName;

                    if (!ministryName) {

                        console.error(
                            "La tarjeta no tiene data-ministry-name."
                        );

                        return;
                    }

                    openMinistry(
                        ministryName
                    );

                }
            );

        }
    );

/* =========================
PANEL PASTORAL
========================= */

function isPastor() {

    if (!window.currentUser) {
        return false;
    }

    const role =
    String(
        window.currentUser.role || ""
    )
        .trim()
        .toLowerCase();

    return role === "pastor";

}

/* =========================
ACCESO PANEL PASTORAL
========================= */

function updatePastoralAccess() {

    const pastoralScreen =
    document.getElementById(
        "pastoral"
    );

    if (!pastoralScreen) {
        return;
    }

    if (!isPastor()) {

        pastoralScreen.style.display =
        "none";

        pastoralScreen.classList.remove(
            "active-screen"
        );

        return;
    }

    pastoralScreen.style.display =
    "";

}

/* =========================
BOTÓN PANEL PASTORAL
========================= */

function updatePastoralButtonVisibility() {

    const button =
    document.getElementById(
        "open-pastoral-from-profile"
    );

    if (!button) {
        return;
    }

    if (isPastor()) {

        button.style.display =
        "";

    } else {

        button.style.display =
        "none";

    }

}

/* =========================
ABRIR PANTALLA
========================= */

function openScreen(
    screenId
) {

    showScreen(
        screenId
    );

}

/* =========================
ABRIR PANEL PASTORAL
========================= */

function openPastoralPanel() {

    console.log(
        "Abriendo Panel pastoral..."
    );

    if (!isPastor()) {

        console.warn(
            "Intento de acceso al Panel pastoral sin rol de pastor."
        );

        alert(
            "No tienes permiso para acceder al panel pastoral."
        );

        return;
    }

    const pastoralScreen =
    document.getElementById(
        "pastoral"
    );

    if (!pastoralScreen) {

        console.error(
            "No existe el elemento #pastoral."
        );

        return;
    }

    /*
    Primero hacemos visible la pantalla.
    Esto evita que una regla anterior de display:none
    impida mostrarla.
    */

    pastoralScreen.style.display =
    "";

    /*
    Abrimos directamente la pantalla pastoral.
    */

    showScreen(
        "pastoral"
    );

    /*
    Nos aseguramos de que la barra inferior
    permanezca visible.
    */

    if (bottomNav) {

        bottomNav.style.display =
        "flex";

    }

    const peopleSection =
    document.getElementById(
        "pastoral-personas-section"
    );

    const personForm =
    document.getElementById(
        "pastoral-persona-form"
    );

    if (peopleSection) {
        peopleSection.hidden = true;
    }

    if (personForm) {
        personForm.hidden = true;
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

/* =========================
VOLVER DEL PANEL
========================= */

function closePastoralPanel() {

    showScreen(
        "perfil"
    );

}

/* =========================
CARGAR PERSONAS
========================= */

async function loadPastoralPeople() {

    if (!isPastor()) {

        alert(
            "Solo los pastores pueden consultar las personas."
        );

        return;
    }

    const container =
    document.getElementById(
        "pastoral-personas-container"
    );

    if (!container) {
        return;
    }

    container.innerHTML =
    `
    <div class="service-list-item">

        <div>

            <strong>
                Cargando...
            </strong>

            <p>
                Consultando personas
            </p>

        </div>

    </div>
    `;

    try {

        const people =
        await supabaseRpc(
            "get_people_for_pastor"
        );

        console.log(
            "Personas obtenidas:",
            people
        );

        if (
            !Array.isArray(people) ||
            people.length === 0
        ) {

            container.innerHTML =
            `
            <div class="service-list-item">

                <div>

                    <strong>
                        No hay personas
                    </strong>

                    <p>
                        Todavía no hay personas registradas.
                    </p>

                </div>

            </div>
            `;

            return;
        }

        container.innerHTML =
        people
            .map(
                person => {

                    const role =
                    person.primary_role === "pastor"
                        ? "Pastor"
                        : person.primary_role === "leader"
                            ? "Líder"
                            : "Servidor";

                    return `
                    <div class="service-list-item">

                        <div>

                            <strong>
                                ${person.first_name}
                                ${person.last_name}
                            </strong>

                            <p>
                                ${role}
                            </p>

                        </div>

                    </div>
                    `;

                }
            )
            .join("");

    } catch (error) {

        console.error(
            "Error cargando personas:",
            error
        );

        container.innerHTML =
        `
        <div class="service-list-item">

            <div>

                <strong>
                    No se pudieron cargar las personas.
                </strong>

                <p>
                    ${error.message || "Intenta nuevamente."}
                </p>

            </div>

        </div>
        `;
    }

}

/* =========================
MOSTRAR PERSONAS
========================= */

function openPastoralPeople() {

    if (!isPastor()) {

        alert(
            "No tienes permiso para administrar personas."
        );

        return;
    }

    const peopleSection =
    document.getElementById(
        "pastoral-personas-section"
    );

    const personForm =
    document.getElementById(
        "pastoral-persona-form"
    );

    if (!peopleSection) {
        return;
    }

    peopleSection.hidden =
    false;

    if (personForm) {
        personForm.hidden =
        true;
    }

    loadPastoralPeople();

    peopleSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}

/* =========================
NUEVA PERSONA
========================= */

function openNewPersonForm() {

    if (!isPastor()) {

        alert(
            "Solo los pastores pueden crear personas."
        );

        return;
    }

    const peopleSection =
    document.getElementById(
        "pastoral-personas-section"
    );

    const personForm =
    document.getElementById(
        "pastoral-persona-form"
    );

    const firstName =
    document.getElementById(
        "pastoral-first-name"
    );

    const lastName =
    document.getElementById(
        "pastoral-last-name"
    );

    const role =
    document.getElementById(
        "pastoral-role"
    );

    const message =
    document.getElementById(
        "pastoral-persona-message"
    );

    if (peopleSection) {
        peopleSection.hidden =
        true;
    }

    if (personForm) {
        personForm.hidden =
        false;
    }

    if (firstName) {
        firstName.value =
        "";
    }

    if (lastName) {
        lastName.value =
        "";
    }

    if (role) {
        role.value =
        "server";
    }

    if (message) {

        message.textContent =
        "";

        message.className =
        "login-message";
    }

    if (personForm) {

        personForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}

/* =========================
CANCELAR NUEVA PERSONA
========================= */

function cancelNewPersonForm() {

    const peopleSection =
    document.getElementById(
        "pastoral-personas-section"
    );

    const personForm =
    document.getElementById(
        "pastoral-persona-form"
    );

    if (personForm) {
        personForm.hidden =
        true;
    }

    if (peopleSection) {
        peopleSection.hidden =
        false;
    }

    loadPastoralPeople();

}

/* =========================
CREAR PERSONA
========================= */

async function createPastoralPerson() {

    if (!isPastor()) {

        alert(
            "Solo los pastores pueden crear personas."
        );

        return;
    }

    const firstNameInput =
    document.getElementById(
        "pastoral-first-name"
    );

    const lastNameInput =
    document.getElementById(
        "pastoral-last-name"
    );

    const roleInput =
    document.getElementById(
        "pastoral-role"
    );

    const button =
    document.getElementById(
        "pastoral-guardar-persona-button"
    );

    const message =
    document.getElementById(
        "pastoral-persona-message"
    );

    const firstName =
    firstNameInput
        ? firstNameInput.value.trim()
        : "";

    const lastName =
    lastNameInput
        ? lastNameInput.value.trim()
        : "";

    const role =
    roleInput
        ? roleInput.value
        : "server";

    if (!firstName) {

        if (message) {

            message.textContent =
            "Escribe el nombre.";

            message.className =
            "login-message error";
        }

        return;
    }

    if (!lastName) {

        if (message) {

            message.textContent =
            "Escribe el apellido.";

            message.className =
            "login-message error";
        }

        return;
    }

    if (
        ![
            "pastor",
            "leader",
            "server"
        ].includes(role)
    ) {

        if (message) {

            message.textContent =
            "Selecciona un rol válido.";

            message.className =
            "login-message error";
        }

        return;
    }

    if (button) {

        button.disabled =
        true;

        button.textContent =
        "Creando...";
    }

    if (message) {

        message.textContent =
        "Guardando persona...";

        message.className =
        "login-message";
    }

    try {

        const person =
        await supabaseRpc(
            "create_person",
            {
                p_first_name:
                    firstName,

                p_last_name:
                    lastName,

                p_primary_role:
                    role
            }
        );

        console.log(
            "Persona creada:",
            person
        );

        if (message) {

            message.textContent =
            "Persona creada correctamente.";

            message.className =
            "login-message success";
        }

        if (firstNameInput) {
            firstNameInput.value =
            "";
        }

        if (lastNameInput) {
            lastNameInput.value =
            "";
        }

        if (roleInput) {
            roleInput.value =
            "server";
        }

        await loadPastoralPeople();

        const peopleSection =
        document.getElementById(
            "pastoral-personas-section"
        );

        const personForm =
        document.getElementById(
            "pastoral-persona-form"
        );

        if (personForm) {
            personForm.hidden =
            true;
        }

        if (peopleSection) {
            peopleSection.hidden =
            false;
        }

    } catch (error) {

        console.error(
            "Error creando persona:",
            error
        );

        if (message) {

            message.textContent =
            error.message ||
            "No se pudo crear la persona.";

            message.className =
            "login-message error";
        }

    } finally {

        if (button) {

            button.disabled =
            false;

            button.textContent =
            "Crear persona";
        }

    }

}

/* =========================
BOTONES DEL PANEL PASTORAL
========================= */

const pastoralPersonasButton =
document.getElementById(
    "pastoral-personas-button"
);

if (pastoralPersonasButton) {

    pastoralPersonasButton.addEventListener(
        "click",
        () => {

            openPastoralPeople();

        }
    );

}

const pastoralNuevaPersonaButton =
document.getElementById(
    "pastoral-nueva-persona-button"
);

if (pastoralNuevaPersonaButton) {

    pastoralNuevaPersonaButton.addEventListener(
        "click",
        () => {

            openNewPersonForm();

        }
    );

}

const pastoralGuardarPersonaButton =
document.getElementById(
    "pastoral-guardar-persona-button"
);

if (pastoralGuardarPersonaButton) {

    pastoralGuardarPersonaButton.addEventListener(
        "click",
        () => {

            createPastoralPerson();

        }
    );

}

const pastoralCancelarPersonaButton =
document.getElementById(
    "pastoral-cancelar-persona-button"
);

if (pastoralCancelarPersonaButton) {

    pastoralCancelarPersonaButton.addEventListener(
        "click",
        () => {

            cancelNewPersonForm();

        }
    );

}

/* =========================
ENTRADA DESDE PERFIL
========================= */

function attachPastoralProfileButton() {

    const profileSection =
    document.getElementById(
        "perfil"
    );

    if (!profileSection) {
        return;
    }

    let existingButton =
    document.getElementById(
        "open-pastoral-from-profile"
    );

    if (existingButton) {

        updatePastoralButtonVisibility();

        return;
    }

    const profileOptionsSection =
    profileSection.querySelector(
        ".profile-options"
    );

    if (!profileOptionsSection) {
        console.error(
            "No se encontró .profile-options dentro de #perfil."
        );

        return;
    }

    const button =
    document.createElement(
        "button"
    );

    button.id =
    "open-pastoral-from-profile";

    button.type =
    "button";

    button.className =
    "profile-option";

    button.innerHTML =
    `
    <span>
        Panel pastoral
    </span>

    <span>
        ›
    </span>
    `;

    /*
    CONEXIÓN DIRECTA DEL BOTÓN
    */

    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();
            event.stopPropagation();

            console.log(
                "Botón Panel pastoral presionado."
            );

            openPastoralPanel();

        }
    );

    profileOptionsSection.appendChild(
        button
    );

    existingButton =
    button;

    updatePastoralButtonVisibility();

}

/* =========================
RESPALDO GLOBAL DEL BOTÓN
========================= */

/*
Este controlador permite que el botón siga funcionando
aunque el contenido del perfil sea reconstruido dinámicamente.
*/

document.addEventListener(
    "click",
    function(event) {

        const button =
        event.target.closest(
            "#open-pastoral-from-profile"
        );

        if (!button) {
            return;
        }

        event.preventDefault();

        console.log(
            "Acceso global al Panel pastoral."
        );

        openPastoralPanel();

    }
);

/* =========================
BOTONES ADICIONALES DEL PANEL
========================= */

const pastoralCuentasButton =
document.getElementById(
    "pastoral-cuentas-button"
);

if (pastoralCuentasButton) {

    pastoralCuentasButton.addEventListener(
        "click",
        () => {

            if (!isPastor()) {

                alert(
                    "No tienes permiso para administrar cuentas."
                );

                return;
            }

            alert(
                "La administración de cuentas se conectará en el siguiente paso."
            );

        }
    );

}

const pastoralServiciosButton =
document.getElementById(
    "pastoral-servicios-button"
);

if (pastoralServiciosButton) {

    pastoralServiciosButton.addEventListener(
        "click",
        () => {

            if (!isPastor()) {

                alert(
                    "No tienes permiso para administrar servicios."
                );

                return;
            }

            showScreen(
                "servicios"
            );

        }
    );

}

const pastoralActividadButton =
document.getElementById(
    "pastoral-actividad-button"
);

if (pastoralActividadButton) {

    pastoralActividadButton.addEventListener(
        "click",
        () => {

            if (!isPastor()) {

                alert(
                    "No tienes permiso para ver esta sección."
                );

                return;
            }

            alert(
                "La actividad reciente se conectará más adelante."
            );

        }
    );

}

/* =========================
INICIALIZAR PANEL PASTORAL
========================= */

attachPastoralProfileButton();
updatePastoralAccess();
updatePastoralButtonVisibility();

/* =========================
INICIO
========================= */

showLogin();