// --- CONSTANTES GLOBALES ---
const SPREADSHEET_ID = 'ID Base de datos en sheets';
const SS = SpreadsheetApp.openById(SPREADSHEET_ID);
const SHEET_USERS = SS.getSheetByName('Users');
const SHEET_LOGS = SS.getSheetByName('Logs');
const SHEET_TASKS = SS.getSheetByName('tasks');
const SHEET_COMENTS = SS.getSheetByName('coments');

// --- MÓDULO 0: Funciones Base ---
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
      .setTitle('AVA Lents')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- MÓDULO I: Acceso y Usuarios ---
function checkLogin(username, password) {
  try {
    const data = SHEET_USERS.getDataRange().getValues();
    if (data.length < 2) { return { status: 'error', message: 'No hay datos de usuario.' }; }
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const userIndex = headers.indexOf('user'); 
    const passIndex = headers.indexOf('password');
    const nameIndex = headers.indexOf('name');
    const emailIndex = headers.indexOf('email');
    if (userIndex === -1 || passIndex === -1 || nameIndex === -1 || emailIndex === -1) {
      return { status: 'error', message: 'Error de configuración de la hoja Users.' };
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[userIndex] === "") continue; 
      if (row[userIndex].toString() === username && row[passIndex].toString() === password) {
        const userData = { user: row[userIndex], name: row[nameIndex], email: row[emailIndex] };
        _registerLog(userData);
        return { status: 'success', data: userData };
      }
    }
    return { status: 'error', message: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    Logger.log("Error en checkLogin:" + e);
    return { status: 'error', message: 'Error del servidor: ' + e.message };
  }
}

function _registerLog(userData) {
  try {
    const lastRow = SHEET_LOGS.getLastRow();
    const newId = 'LOG' + Utilities.formatString('%04d', lastRow); 
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy, HH:mm:ss');
    SHEET_LOGS.appendRow([ newId, userData.user, userData.email, timestamp ]);
  } catch (e) { Logger.log('Error al registrar log: ' + e.message); }
}

// --- MÓDULO II: Gestión de Tareas ---

function getUsersList() {
  try {
    const data = SHEET_USERS.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const userIndex = headers.indexOf('user');
    const nameIndex = headers.indexOf('name');
    if (userIndex === -1 || nameIndex === -1) { return []; }
    const users = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][userIndex] && data[i][userIndex] !== "") { 
        users.push({ user: data[i][userIndex], name: data[i][nameIndex] });
      }
    }
    return users;
  } catch (e) { Logger.log("Error en getUsersList: " + e); return []; }
}

function createTask(taskData, userRegister) {
  try {
    const usersData = SHEET_USERS.getDataRange().getValues();
    const headers = usersData[0].map(h => h.toString().trim().toLowerCase());
    const userIndex = headers.indexOf('user');
    const emailIndex = headers.indexOf('email');
    const roleIndex = headers.indexOf('role');
    const unitIndex = headers.indexOf('unit_bussiness');
    if (userIndex === -1 || emailIndex === -1) {
        return { status: 'error', message: 'Error de configuración: Faltan columnas user o email.' };
    }
    let responsableData = { email: '', role: '', unit: '' };
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][userIndex].toString() === taskData.responsable) {
        responsableData = { email: usersData[i][emailIndex], role: usersData[i][roleIndex], unit: usersData[i][unitIndex] };
        break;
      }
    }
    if (responsableData.email === '') {
      return { status: 'error', message: 'No se pudo encontrar el email del responsable. Verifique el user.' };
    }
    const lastRow = SHEET_TASKS.getLastRow();
    const newId = 'TARKS' + Utilities.formatString('%04d', lastRow);
    const startDate = new Date(taskData.fechaInicio);
    const endDate = new Date(taskData.fechaFin);
    const format = 'dd/MM/yyyy, HH:mm:ss';
    const startDateString = Utilities.formatDate(startDate, Session.getScriptTimeZone(), format);
    const endDateString = Utilities.formatDate(endDate, Session.getScriptTimeZone(), format);
    const taskHeaders = SHEET_TASKS.getRange(1, 1, 1, SHEET_TASKS.getLastColumn()).getValues()[0];
    if (taskHeaders.indexOf('init') === -1 || taskHeaders.indexOf('end') === -1) {
      return { status: 'error', message: 'Error de base de datos: Faltan las columnas "init" o "end".' };
    }
    const newRow = [
      newId, userRegister, taskData.responsable, responsableData.email, responsableData.role, 
      responsableData.unit, taskData.titulo, taskData.tag, taskData.color, 
      startDateString, endDateString, "No realizado", "", 0, "", "", 0, "", ""
    ];
    SHEET_TASKS.appendRow(newRow);
    _createCalendarEvent(responsableData.email, taskData.titulo, taskData.tag, startDate, endDate);
    return { status: 'success', message: 'Tarea creada con éxito.' };
  } catch (e) {
    Logger.log("Error en createTask: " + e);
    return { status: 'error', message: 'Error del servidor: ' + e.message };
  }
}

function rescheduleTask(taskId, newStartDateISO, newEndDateISO, reason, taskData) {
  try {
    const sheet = SHEET_TASKS;
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const idIndex = headers.indexOf('id_tarks');
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === taskId) { rowIndex = i; break; }
    }
    if (rowIndex === -1) { return { status: 'error', message: 'No se encontró la tarea.' }; }
    const statusIndex = headers.indexOf('task_status');
    const commentIndex = headers.indexOf('comment');
    const rescheduledIndex = headers.indexOf('rescheduled');
    const reschedStarIndex = headers.indexOf('rescheduled_time_star');
    const reschedEndIndex = headers.indexOf('rescheduled_time_end');
    const newStartDate = new Date(newStartDateISO);
    const newEndDate = new Date(newEndDateISO);
    const format = 'dd/MM/yyyy, HH:mm:ss';
    const startDateString = Utilities.formatDate(newStartDate, Session.getScriptTimeZone(), format);
    const endDateString = Utilities.formatDate(newEndDate, Session.getScriptTimeZone(), format);
    sheet.getRange(rowIndex + 1, statusIndex + 1).setValue('Reprogramada');
    sheet.getRange(rowIndex + 1, commentIndex + 1).setValue(reason);
    sheet.getRange(rowIndex + 1, rescheduledIndex + 1).setValue(1);
    sheet.getRange(rowIndex + 1, reschedStarIndex + 1).setValue(startDateString);
    sheet.getRange(rowIndex + 1, reschedEndIndex + 1).setValue(endDateString);
    const originalStartDate = new Date(taskData.originalStartDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
    const originalEndDate = new Date(taskData.originalEndDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
    _updateCalendarEvent(
      taskData.email, `[${taskData.tag}] ${taskData.title}`,
      originalStartDate, originalEndDate, newStartDate, newEndDate
    );
    return { status: 'success', message: 'Tarea reprogramada con éxito.' };
  } catch (e) {
    Logger.log("Error en rescheduleTask: " + e);
    return { status: 'error', message: 'Error del servidor: ' + e.message };
  }
}

function updateTaskStatus(taskId, newStatus) {
  try {
    const sheet = SHEET_TASKS;
    const data = sheet.getDataRange().getValues();
    const displayData = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const idIndex = headers.indexOf('id_tarks');
    const statusIndex = headers.indexOf('task_status');
    const initIndex = headers.indexOf('init');
    const endIndex = headers.indexOf('end');
    const timeRegIndex = headers.indexOf('time_register');
    if (idIndex === -1 || statusIndex === -1 || initIndex === -1 || endIndex === -1 || timeRegIndex === -1) {
      return { status: 'error', message: 'Error de configuración: Faltan columnas (init, end, time_register, etc.).' };
    }
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === taskId) { rowIndex = i; break; }
    }
    if (rowIndex === -1) { return { status: 'error', message: 'No se encontró la tarea para actualizar.' }; }
    const rowNum = rowIndex + 1;
    const timestamp = new Date();
    const timestampString = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy, HH:mm:ss');
    if (newStatus === 'Iniciado') {
      sheet.getRange(rowNum, statusIndex + 1).setValue('Iniciado');
      sheet.getRange(rowNum, initIndex + 1).setValue(timestampString);
    } else if (newStatus === 'Completado') {
      const startTimeString = displayData[rowIndex][initIndex];
      if (!startTimeString) {
        return { status: 'error', message: 'No se puede completar una tarea que no ha sido iniciada.' };
      }
      const startTime = _parseCustomDate(startTimeString);
      const endTime = timestamp;
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
      sheet.getRange(rowNum, statusIndex + 1).setValue('Completado');
      sheet.getRange(rowNum, endIndex + 1).setValue(timestampString);
      sheet.getRange(rowNum, timeRegIndex + 1).setValue(durationHours);
    }
    return { status: 'success', message: `Tarea actualizada a "${newStatus}".` };
  } catch (e) {
    Logger.log("Error en updateTaskStatus: " + e);
    return { status: 'error', message: 'Error del servidor al actualizar estado.' };
  }
}

function _createCalendarEvent(email, titulo, tag, startDate, endDate) {
  try {
    const calendar = CalendarApp.getCalendarById(email);
    if (calendar) {
      calendar.createEvent(`[${tag}] ${titulo}`, startDate, endDate, {
        description: 'Evento creado automáticamente por AVA Lents.'
      });
      Logger.log("Evento creado en el calendario de: " + email);
    } else { Logger.log("No se pudo acceder al calendario de: " + email); }
  } catch (e) { Logger.log("Error al crear evento de calendario: " + e); }
}

function _updateCalendarEvent(email, title, oldStartDate, oldEndDate, newStartDate, newEndDate) {
  try {
    const calendar = CalendarApp.getCalendarById(email);
    if (!calendar) { Logger.log("No se pudo acceder al calendario para actualizar: " + email); return; }
    const events = calendar.getEvents(oldStartDate, oldEndDate, { search: title });
    if (events.length > 0) {
      const event = events[0];
      event.setTime(newStartDate, newEndDate);
      event.setDescription("Evento reprogramado por AVA Lents.");
      Logger.log("Evento de calendario actualizado para: " + email);
    } else { Logger.log("No se encontró el evento de calendario original para actualizar."); }
  } catch (e) { Logger.log("Error al actualizar evento de calendario: " + e); }
}

// --- MÓDULO III: Visualización y Comentarios ---

function getTasks() {
  try {
    Logger.log("Leyendo TAREAS desde Google Sheet (Lento)");
    const data = SHEET_TASKS.getDataRange().getDisplayValues(); 
    if (data.length < 2) { return { status: 'success', data: [] }; }
    const tasks = _convertSheetDataToObjectArray(data);
    return { status: 'success', data: tasks };
  } catch (e) {
    Logger.log("Error en getTasks: " + e);
    return { status: 'error', message: 'No se pudieron cargar las tareas: ' + e.message };
  }
}

function getComments(taskId) {
  try {
    Logger.log("Leyendo COMENTARIOS desde Google Sheet (Lento)");
    const data = SHEET_COMENTS.getDataRange().getDisplayValues();
    if (data.length < 2) { return { status: 'success', data: [] }; }
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const idTaskIndex = headers.indexOf('id_tarks');
    const userIndex = headers.indexOf('user');
    const timestampIndex = headers.indexOf('timestamp');
    const commentIndex = headers.indexOf('comment_text');
    if (idTaskIndex === -1 || timestampIndex === -1) {
      return { status: 'error', message: "Error de configuración en la hoja 'coments'."};
    }
    const comments = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][idTaskIndex] === taskId) {
        comments.push({
          user: data[i][userIndex],
          timestamp: data[i][timestampIndex],
          comment_text: data[i][commentIndex]
        });
      }
    }
    comments.sort((a, b) => _parseCustomDate(b.timestamp) - _parseCustomDate(a.timestamp));
    return { status: 'success', data: comments };
  } catch (e) {
    Logger.log("Error en getComments: " + e);
    return { status: 'error', message: 'No se pudieron cargar los comentarios.' };
  }
}

/**
 * MODIFICADO: Calcula métricas específicas para el usuario objetivo.
 */
function getDashboardMetrics(targetUser) {
  try {
    Logger.log("Leyendo TAREAS (para Métricas) desde Google Sheet (Lento)");
    const data = SHEET_TASKS.getDataRange().getDisplayValues(); 
    if (data.length < 2) {
      return { status: 'success', data: { kpis: { sumTime: 0, pendientes: 0, completadas: 0, reprogramadas: 0, totalTasks: 0 } } };
    }
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    
    const statusIndex = headers.indexOf('task_status');
    const timeRegIndex = headers.indexOf('time_register');
    const reschedIndex = headers.indexOf('rescheduled');
    const userIndex = headers.indexOf('user'); // Necesitamos el usuario

    if (statusIndex === -1 || timeRegIndex === -1 || reschedIndex === -1 || userIndex === -1) {
      return { status: 'error', message: 'Faltan columnas de KPI (user, status, time_register, rescheduled) en la hoja Tasks.' };
    }
    
    let sumTime = 0, pendientes = 0, completadas = 0, reprogramadas = 0;
    let totalTasks = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Filtro global: Solo tareas del usuario logueado (si targetUser está definido)
      if (targetUser && row[userIndex] !== targetUser) {
        continue;
      }

      totalTasks++; // Contamos solo las tareas de este usuario

      const status = row[statusIndex].toLowerCase();
      const time = parseFloat(row[timeRegIndex]);
      
      if (!isNaN(time)) { sumTime += time; }
      if (status === 'no realizado' || status === '0') { pendientes++; }
      if (status === 'completado') { completadas++; }
      if (row[reschedIndex] == '1') { reprogramadas++; }
    }
    return { 
      status: 'success', 
      data: { kpis: { sumTime, pendientes, completadas, reprogramadas, totalTasks } } 
    };
  } catch (e) {
    Logger.log("Error en getDashboardMetrics: " + e);
    return { status: 'error', message: 'Error al calcular métricas.' };
  }
}

function getChartData() {
  try {
    Logger.log("Leyendo TAREAS (para Gráfica) desde Google Sheet (Lento)");
    const data = SHEET_TASKS.getDataRange().getDisplayValues(); 
    if (data.length < 2) {
      return { status: 'success', data: {} }; 
    }
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const statusIndex = headers.indexOf('task_status');
    const endIndex = headers.indexOf('end');
    if (statusIndex === -1 || endIndex === -1) {
      return { status: 'error', message: 'Faltan columnas "task_status" o "end" en la hoja Tasks.' };
    }
    let aggregatedData = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[statusIndex].toLowerCase();
      const endDateString = row[endIndex]; 
      if (status === 'completado' && endDateString !== "") {
        const datePart = endDateString.split(', ')[0];
        aggregatedData[datePart] = (aggregatedData[datePart] || 0) + 1;
      }
    }
    return { status: 'success', data: aggregatedData };
  } catch (e) {
    Logger.log("Error en getChartData: " + e);
    return { status: 'error', message: 'No se pudieron cargar los datos de la gráfica.' };
  }
}

function getTasksWithCommentCounts() {
  try {
    const tasksResult = getTasks();
    if (tasksResult.status === 'error') return tasksResult;
    const tasks = tasksResult.data;
    const commentsData = SHEET_COMENTS.getDataRange().getDisplayValues();
    const commentsHeaders = commentsData[0].map(h => h.toString().trim().toLowerCase());
    const idTarksIndex = commentsHeaders.indexOf('id_tarks');
    const commentCounts = new Map();
    if (idTarksIndex !== -1) {
      for (let i = 1; i < commentsData.length; i++) {
        const taskId = commentsData[i][idTarksIndex];
        if (taskId) {
          commentCounts.set(taskId, (commentCounts.get(taskId) || 0) + 1);
        }
      }
    }
    const tasksWithCounts = tasks.map(task => {
      task.commentCount = commentCounts.get(task.id_tarks) || 0;
      return task;
    });
    return { status: 'success', data: tasksWithCounts };
  } catch (e) {
    Logger.log("Error en getTasksWithCommentCounts: " + e);
    return { status: 'error', message: 'No se pudieron cargar las tareas y comentarios.' };
  }
}

function addNewComment(taskId, user, commentText) {
  try {
    const sheet = SHEET_COMENTS;
    const lastRow = sheet.getLastRow();
    const newId = 'COM' + Utilities.formatString('%04d', lastRow + 1);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy, HH:mm:ss');
    if (!commentText || commentText.trim() === "") {
      return { status: 'error', message: 'El comentario no puede estar vacío.' };
    }
    sheet.appendRow([ newId, taskId, user, timestamp, commentText, "" ]);
    return { status: 'success', message: 'Comentario añadido.' };
  } catch (e) {
    Logger.log("Error en addNewComment: " + e);
    return { status: 'error', message: 'Error del servidor al guardar el comentario.' };
  }
}

function getGanttData() {
  try {
    Logger.log("Leyendo TAREAS (para Gantt) desde Google Sheet (Lento)");
    const data = SHEET_TASKS.getDataRange().getDisplayValues(); 
    if (data.length < 2) {
      return { status: 'success', data: [] }; // No hay tareas
    }
    
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    
    const idIndex = headers.indexOf('id_tarks');
    const taskIndex = headers.indexOf('task');
    const userIndex = headers.indexOf('user');
    const statusIndex = headers.indexOf('task_status');
    const reschedIndex = headers.indexOf('rescheduled');
    const plannedStarIndex = headers.indexOf('timestamp_star');
    const plannedEndIndex = headers.indexOf('timestamp_end');
    const reschedStarIndex = headers.indexOf('rescheduled_time_star');
    const reschedEndIndex = headers.indexOf('rescheduled_time_end');
    const colorIndex = headers.indexOf('task_color'); 

    const ganttRows = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isRescheduled = row[reschedIndex] == '1';
      
      let startDateString = (isRescheduled && row[reschedStarIndex]) ? row[reschedStarIndex] : row[plannedStarIndex];
      let endDateString = (isRescheduled && row[reschedEndIndex]) ? row[reschedEndIndex] : row[plannedEndIndex];

      if (!startDateString || !endDateString) {
        continue; 
      }

      const status = row[statusIndex].toLowerCase();
      let percentComplete = 0;
      if (status === 'completado') {
        percentComplete = 100;
      } else if (status === 'iniciado') {
        percentComplete = 50; 
      }
      
      ganttRows.push({
        id: row[idIndex],
        name: row[taskIndex],
        user: row[userIndex],     
        start: startDateString, 
        end: endDateString,     
        color: row[colorIndex] || '#A3A9E8' 
      });
    }
    
    return { status: 'success', data: ganttRows };

  } catch (e) {
    Logger.log("Error en getGanttData: " + e);
    return { status: 'error', message: 'No se pudieron cargar los datos del Gantt.' };
  }
}


// --- Funciones de utilidad (usadas internamente) ---
function _parseCustomDate(dateString) {
  try {
    if (!dateString) return new Date(0);
    const parts = dateString.split(', ');
    if (parts.length < 2) return new Date(0);
    const [datePart, timePart] = parts;
    const [day, month, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    if (!year || !month || !day) return new Date(0);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  } catch (e) {
    Logger.log("Error parseando fecha: " + dateString);
    return new Date(0); 
  }
}

function _convertSheetDataToObjectArray(data) {
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}