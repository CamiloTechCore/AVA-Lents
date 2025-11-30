# AVA-Lents
AVA Lents: Plataforma integral de gestión operativa para equipos multifuncionales. Optimiza la asignación de tareas, sincroniza agendas automáticamente con Google Calendar y visualiza el rendimiento mediante diagramas de Gantt y métricas de tiempo real. Construido con Google Apps Script.

# 🚀 AVA Lents: Sistema de Gestión Operativa y Optimización de Tiempos

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Stack](https://img.shields.io/badge/Built%20with-Google%20Apps%20Script-green.svg)
![Status](https://img.shields.io/badge/Status-Production-orange.svg)

**AVA Lents** es una solución web diseñada específicamente para **equipos operativos multifuncionales** que requieren una coordinación precisa y una reducción significativa en los tiempos de gestión administrativa.

El sistema centraliza la asignación de tareas, automatiza la agenda del equipo y proporciona herramientas visuales para el análisis de la productividad, eliminando la fricción entre la planificación y la ejecución real.

## 🎯 Objetivo del Proyecto

El núcleo de AVA Lents es la **eficiencia temporal**. A diferencia de los gestores de tareas tradicionales, este sistema:
1.  **Distingue entre Planificación y Ejecución:** Registra tiempos estimados vs. tiempos reales de gestión (`init` / `end`).
2.  **Automatiza la Agenda:** Elimina la necesidad de crear invitaciones manuales; al asignar una tarea, la agenda del responsable se bloquea automáticamente.
3.  **Centraliza la Comunicación:** Mantiene los comentarios y novedades atados al contexto de la tarea, evitando la dispersión de información en chats externos.

## 🛠️ Funcionalidades Clave

### I. Gestión y Acceso
* **Autenticación Segura:** Login validado contra base de datos de personal con registro de auditoría (Logs de acceso).
* **Perfil Dinámico:** Carga automática de datos del usuario, rol y unidad de negocio.

### II. Orquestación de Tareas
* **Asignación Multi-usuario:** Capacidad de asignar una misma actividad a múltiples responsables simultáneamente, generando registros individuales de seguimiento.
* **Sincronización con Google Calendar:** Creación automática de eventos y reuniones (Google Meet) en los calendarios corporativos al crear o reprogramar tareas.
* **Control de Flujo de Trabajo:**
    * ▶️ **Iniciar:** Registra el timestamp real de inicio.
    * ✅ **Completar:** Registra el cierre y calcula automáticamente el tiempo total de gestión (Float).
    * 🔃 **Reprogramar:** Permite mover fechas, registrando el motivo y actualizando el evento en el calendario sin perder la traza original.

### III. Visualización y Toma de Decisiones
* **Timeline Interactivo:** Vista cronológica del trabajo del día.
* **Diagrama de Gantt Personalizado:** Visualización de la carga de trabajo en un horizonte de 6:00 AM a 8:00 PM, filtrable por usuario, permitiendo identificar huecos y sobrecargas.
* **Panel de Métricas (KPIs):**
    * Barra de carga de **Tiempo de Gestión** acumulado por usuario.
    * Contadores de tareas pendientes, completadas y reprogramadas.

## 💻 Tecnologías Utilizadas

* **Backend:** Google Apps Script (`.gs`).
* **Frontend:** HTML5, CSS3 (Diseño Responsivo y Minimalista), JavaScript (Vanilla).
* **Base de Datos:** Google Sheets (Tablas relacionales: Users, Tasks, Logs, Comments).
* **Visualización:** Google Charts API (Corechart & Gantt).
* **Integraciones:** Google Calendar API, Google Drive API.

## 📂 Estructura del Proyecto

```text
├── Código.gs            # Lógica del servidor (API, BD, Calendar, Cálculos)
├── index.html           # Estructura del DOM y contenedores de vistas
├── styles.html          # Estilos CSS (Diseño visual, Modales, Grid)
└── script.html          # Lógica del cliente (DOM, Event Listeners, Async Calls)