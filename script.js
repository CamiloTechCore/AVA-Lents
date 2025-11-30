
// Espera a que todo el HTML esté cargado
document.addEventListener("DOMContentLoaded", function() {

  // --- Variables Globales ---
  let currentUserData = null; 
  let allTasks = []; 
  let selectedTaskId = null;
  let completedTasksData = {}; 
  let allGanttData = []; 
  let allUsersMap = new Map(); 

  // --- Cargar Google Charts ---
  google.charts.load('current', {'packages':['corechart', 'gantt']}); 

  // --- MÓDULO I: Lógica de Login y UI ---
  document.getElementById('btnLogin').addEventListener('click', handleLogin);
  function handleLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('password').value;
    const statusMsg = document.getElementById('statusMessage');
    if (!user || !pass) {
      statusMsg.innerText = 'Por favor, ingrese usuario y contraseña.';
      return;
    }
    statusMsg.innerText = 'Validando...';
    document.getElementById('btnLogin').disabled = true;
    google.script.run
      .withSuccessHandler(onLoginSuccess)
      .withFailureHandler(onLoginFailure)
      .checkLogin(user, pass);
  }
  function onLoginSuccess(response) {
    if (response.status === 'success') {
      currentUserData = response.data; 
      document.getElementById('loginView').style.display = 'none';
      document.body.style.display = 'block'; 
      document.body.style.justifyContent = 'flex-start'; 
      document.body.style.alignItems = 'flex-start';
      document.getElementById('dashboardView').style.display = 'grid';
      loadUserData(currentUserData);
      populateUsersDropdown();
      populateTimeDropdowns(); 
      loadTaskTimeline();
      loadDashboardMetrics(); 
      loadChartData(); 
      setupNavigation();
    } else {
      const statusMsg = document.getElementById('statusMessage');
      statusMsg.style.color = 'red';
      statusMsg.innerText = response.message;
      document.getElementById('btnLogin').disabled = false;
    }
  }
  function onLoginFailure(error) {
    document.getElementById('statusMessage').innerText = 'Error de conexión: ' + error.message;
    document.getElementById('btnLogin').disabled = false;
  }
  function loadUserData(userData) {
    document.getElementById('userName').innerText = userData.name;
    document.getElementById('userEmail').innerText = userData.email;
  }

  // --- Lógica de Navegación de Vistas ---
  function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu li');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const viewId = link.id.replace('nav-', '') + 'View'; // "nav-timeline" -> "timelineView"
        switchView(viewId);
      });
    });
  }
  function switchView(viewId) {
    const views = document.querySelectorAll('#viewsContainer > div');
    views.forEach(view => {
      view.style.display = 'none'; 
    });
    const activeView = document.getElementById(viewId);
    if (activeView) {
      activeView.style.display = 'block';
      if (viewId === 'commentsView') {
        loadCommentsView();
      }
      if (viewId === 'ganttView') {
        loadGanttChart(); 
      }
    }
  }

  // --- MÓDULO II: Lógica del Modal de Tareas (Creación) ---
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const taskStatusMsg = document.getElementById('taskStatusMessage');
  document.getElementById('btnOpenTaskModal').addEventListener('click', () => {
    taskModal.style.display = 'flex'; 
    taskStatusMsg.innerText = '';
    taskForm.reset(); 
    document.getElementById('taskInicioHora').value = '09:00';
    document.getElementById('taskFinHora').value = '10:00';
  });
  document.getElementById('btnCancelTask').addEventListener('click', () => {
    taskModal.style.display = 'none';
  });
  taskForm.addEventListener('submit', handleTaskSave);
  function handleTaskSave(e) {
    e.preventDefault(); 
    const fechaInicio = document.getElementById('taskInicioFecha').value;
    const horaInicio = document.getElementById('taskInicioHora').value;
    const fechaFin = document.getElementById('taskFinFecha').value;
    const horaFin = document.getElementById('taskFinHora').value;
    const fechaInicioISO = `${fechaInicio}T${horaInicio}`;
    const fechaFinISO = `${fechaFin}T${horaFin}`;
    const taskData = {
      titulo: document.getElementById('taskTitulo').value,
      tag: document.getElementById('taskTag').value,
      color: document.getElementById('taskColor').value,
      responsable: document.getElementById('taskResponsable').value,
      fechaInicio: fechaInicioISO,
      fechaFin: fechaFinISO
    };
    if (new Date(taskData.fechaFin) <= new Date(taskData.fechaInicio)) {
      taskStatusMsg.style.color = 'red';
      taskStatusMsg.innerText = 'La fecha de fin debe ser posterior a la fecha de inicio.';
      return;
    }
    if (!taskData.responsable) {
      taskStatusMsg.style.color = 'red';
      taskStatusMsg.innerText = 'Debe seleccionar un responsable.';
      return;
    }
    document.getElementById('btnSaveTask').disabled = true;
    taskStatusMsg.style.color = 'blue';
    taskStatusMsg.innerText = 'Guardando tarea...';
    google.script.run
      .withSuccessHandler(onTaskSaveSuccess)
      .withFailureHandler(onTaskSaveFailure)
      .createTask(taskData, currentUserData.user);
  }
  function onTaskSaveSuccess(response) {
    document.getElementById('btnSaveTask').disabled = false;
    if (response.status === 'success') {
      taskStatusMsg.style.color = 'green';
      taskStatusMsg.innerText = response.message;
      setTimeout(() => {
        taskModal.style.display = 'none';
      }, 2000);
      loadTaskTimeline(); 
      loadDashboardMetrics();
      loadChartData(); 
    } else {
      taskStatusMsg.style.color = 'red';
      taskStatusMsg.innerText = response.message; 
    }
  }
  function onTaskSaveFailure(error) {
    document.getElementById('btnSaveTask').disabled = false;
    taskStatusMsg.style.color = 'red';
    taskStatusMsg.innerText = 'Error de conexión: ' + error.message;
  }
  function populateTimeDropdowns() {
    const selects = [
      document.getElementById('taskInicioHora'),
      document.getElementById('taskFinHora'),
      document.getElementById('rescheduleInicioHora'), 
      document.getElementById('rescheduleFinHora')   
    ];
    selects.forEach(select => {
      select.innerHTML = '';
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
          const hour = h.toString().padStart(2, '0');
          const min = m.toString().padStart(2, '0');
          const time = `${hour}:${min}`;
          const option = document.createElement('option');
          option.value = time;
          option.innerText = time;
          select.appendChild(option);
        }
      }
    });
  }
  function populateUsersDropdown() {
    google.script.run
      .withSuccessHandler(onUsersListSuccess)
      .getUsersList();
  }
  function onUsersListSuccess(users) {
    const select = document.getElementById('taskResponsable');
    select.innerHTML = ''; 
    allUsersMap.clear();
    if (!users || users.length === 0) {
      select.innerHTML = '<option value="">No se encontraron usuarios</option>';
      return;
    }
    select.innerHTML = '<option value="">-- Seleccione un responsable --</option>';
    users.forEach(user => {
      allUsersMap.set(user.user, user.name); 
      const option = document.createElement('option');
      option.value = user.user;
      option.innerText = `${user.name} (${user.user})`; 
      select.appendChild(option);
    });
  }

  // --- MÓDULO III: Lógica de Visualización (Timeline) ---
  document.getElementById('taskTimeline').addEventListener('click', function(e) {
    const actionItem = e.target.closest('.task-actions-popover li');
    if (actionItem && !actionItem.classList.contains('disabled')) {
      e.stopPropagation(); 
      const action = actionItem.dataset.action;
      const taskId = actionItem.dataset.taskId;
      handleTaskAction(action, taskId);
      closeActionMenu();
      return;
    }
    const menuButton = e.target.closest('.task-action-menu');
    if (menuButton) {
      e.stopPropagation(); 
      const taskItem = menuButton.closest('.task-item');
      const taskId = taskItem.dataset.taskId;
      showActionMenu(taskId, menuButton);
      return;
    }
    const taskItem = e.target.closest('.task-item');
    if (taskItem) {
      const taskId = taskItem.dataset.taskId;
      highlightTask(taskId); 
      loadComments(taskId); 
      closeActionMenu(); 
      return;
    }
    closeActionMenu();
  });
  document.body.addEventListener('click', (e) => {
    if (!e.target.closest('#taskTimeline')) {
      closeActionMenu();
    }
  }, true); 
  function loadTaskTimeline() {
    document.getElementById('taskTimeline').innerHTML = '<h3>Today</h3><p>Cargando tareas...</p>'; 
    google.script.run
      .withSuccessHandler(onGetTasksSuccess)
      .withFailureHandler(onGetTasksFailure)
      .getTasks();
  }
  function onGetTasksSuccess(response) {
    const timeline = document.getElementById('taskTimeline');
    if (response.status === 'error') {
      timeline.innerHTML = `<h3>Error</h3><p>${response.message}</p>`;
      return;
    }
    allTasks = response.data; 
    if (allTasks.length === 0) {
      timeline.innerHTML = '<h3>Timeline</h3><p>No hay tareas registradas.</p>';
      return;
    }
    let htmlContent = '<h3>Today</h3>';
    allTasks.forEach(task => {
      let timeStart = (task.timestamp_star || '').split(', ')[1] || '00:00:00';
      let timeEnd = (task.timestamp_end || '').split(', ')[1] || '00:00:00';
      const simpleTimeStart = timeStart.substring(0, 5);
      const simpleTimeEnd = timeEnd.substring(0, 5);
      const statusClass = (task.task_status || 'Pendiente').toLowerCase().replace(/ /g, '-');
      let actionButtonHtml = '';
      const statusLower = (task.task_status || "").toLowerCase();
      if (statusLower !== 'completado' && statusLower !== 'reprogramada') {
          actionButtonHtml = `<button class="task-action-menu">...</button>`;
      }
      htmlContent += `
        <div class="task-item" data-task-id="${task.id_tarks}"> 
          <div class="task-color-dot" style="background-color: ${task.task_color || '#cccccc'};"></div>
          <div class="task-details">
            <p class="title">${task.id_tarks} - ${task.task}</p>
            <p class="time">${simpleTimeStart} - ${simpleTimeEnd} (Planificado)</p>
          </div>
          <div class="task-status status-${statusClass}">
            ${task.task_status}
          </div>
          ${actionButtonHtml}
        </div>
      `;
    });
    timeline.innerHTML = htmlContent;
  }
  function onGetTasksFailure(error) {
    document.getElementById('taskTimeline').innerHTML = 
      `<h3>Error</h3><p>Error de conexión al cargar tareas: ${error.message}</p>`;
  }
  
  // --- Lógica de Flujo de Tareas y Comentarios (Barra Lateral) ---
  function highlightTask(taskId) {
    document.querySelectorAll('.task-item.active').forEach(item => {
      item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }
  function loadComments(taskId) {
    selectedTaskId = taskId; 
    const container = document.getElementById('commentsContainer');
    container.innerHTML = '<p class="comments-placeholder">Cargando comentarios...</p>';
    document.querySelector('.new-comment-box').style.display = 'block';
    google.script.run
        .withSuccessHandler(onGetCommentsSuccess)
        .withFailureHandler(onGetCommentsFailure)
        .getComments(taskId);
  }
  function onGetCommentsSuccess(response) {
    const container = document.getElementById('commentsContainer');
    if (response.status === 'error') {
        container.innerHTML = `<p class="comments-placeholder">${response.message}</p>`;
        return;
    }
    const comments = response.data;
    if (comments.length === 0) {
        container.innerHTML = '<p class="comments-placeholder">No hay comentarios para esta tarea.</p>';
        return;
    }
    let htmlContent = '';
    comments.forEach(comment => {
        htmlContent += `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-user">${comment.user}</span>
                    <span class="comment-time">${comment.timestamp}</span>
                </div>
                <p class="comment-body">${comment.comment_text}</p>
            </div>
        `;
    });
    container.innerHTML = htmlContent;
  }
  function onGetCommentsFailure(error) {
    document.getElementById('commentsContainer').innerHTML = 
      `<p class="comments-placeholder">Error al cargar comentarios: ${error.message}</p>`;
  }
  document.getElementById('btnAddNewComment').addEventListener('click', handleAddNewComment);
  function handleAddNewComment() {
    const commentInput = document.getElementById('newCommentText');
    const commentText = commentInput.value;
    const button = document.getElementById('btnAddNewComment');
    if (!commentText || commentText.trim() === "") return;
    if (!selectedTaskId) return;
    button.disabled = true;
    button.innerText = "Enviando...";
    google.script.run
        .withSuccessHandler(onAddNewCommentSuccess)
        .withFailureHandler(onAddNewCommentFailure)
        .addNewComment(selectedTaskId, currentUserData.user, commentText);
  }
  function onAddNewCommentSuccess(response) {
    const button = document.getElementById('btnAddNewComment');
    button.disabled = false;
    button.innerText = "Enviar";
    if (response.status === 'success') {
        document.getElementById('newCommentText').value = '';
        loadComments(selectedTaskId); 
    } else {
        alert("Error: " + response.message);
    }
  }
  function onAddNewCommentFailure(error) {
    const button = document.getElementById('btnAddNewComment');
    button.disabled = false;
    button.innerText = "Enviar";
    alert("Error de conexión: " + error.message);
  }
  function showActionMenu(taskId, buttonElement) {
    closeActionMenu(); 
    const task = allTasks.find(t => t.id_tarks === taskId);
    if (!task) return;
    const popover = document.createElement('div');
    popover.className = 'task-actions-popover';
    popover.id = 'active-popover'; 
    let menuItems = '<ul>';
    const status = (task.task_status || "").toLowerCase();
    
    if (status === 'no realizado' || status === '0') {
        menuItems += `<li data-action="iniciar" data-task-id="${taskId}">▶️ Iniciar Tarea</li>`;
        menuItems += `<li data-action="reprogramar" data-task-id="${taskId}">🔃 Reprogramar Tarea</li>`;
    } else if (status === 'iniciado') {
        menuItems += `<li data-action="completar" data-task-id="${taskId}">✅ Completar Tarea</li>`;
        menuItems += `<li data-action="reprogramar" data-task-id="${taskId}">🔃 Reprogramar Tarea</li>`;
    } else {
        menuItems += `<li class="disabled">No hay acciones</li>`;
    }
    menuItems += '</ul>';
    popover.innerHTML = menuItems;
    buttonElement.closest('.task-item').appendChild(popover);
    popover.classList.add('show');
  }
  function closeActionMenu() {
    const popover = document.getElementById('active-popover');
    if (popover) {
        popover.remove();
    }
  }
  function handleTaskAction(action, taskId) {
    if (action === 'iniciar') {
        callUpdateStatus(taskId, 'Iniciado');
    } else if (action === 'completar') {
        callUpdateStatus(taskId, 'Completado');
    } else if (action === 'reprogramar') {
        openRescheduleModal(taskId); 
    }
  }
  function callUpdateStatus(taskId, newStatus) {
    google.script.run
        .withSuccessHandler(onUpdateStatusSuccess)
        .withFailureHandler(onUpdateStatusFailure)
        .updateTaskStatus(taskId, newStatus);
  }
  function onUpdateStatusSuccess(response) {
    if (response.status === 'success') {
        loadTaskTimeline(); 
        loadDashboardMetrics();
        loadChartData(); 
    } else {
        alert(response.message);
    }
  }
  function onUpdateStatusFailure(error) {
    alert('Error de conexión: ' + error.message);
  }

  // --- MÓDULO II (F5): Lógica del Modal de Reprogramación ---
  const rescheduleModal = document.getElementById('rescheduleModal');
  const rescheduleForm = document.getElementById('rescheduleForm');
  const rescheduleStatusMsg = document.getElementById('rescheduleStatusMessage');
  document.getElementById('btnCancelReschedule').addEventListener('click', () => {
    rescheduleModal.style.display = 'none';
  });
  function openRescheduleModal(taskId) {
    const task = allTasks.find(t => t.id_tarks === taskId);
    if (!task) {
      alert("Error: No se pudieron encontrar los datos de la tarea.");
      return;
    }
    document.getElementById('rescheduleTaskTitle').innerText = `${task.id_tarks} - ${task.task}`;
    document.getElementById('rescheduleTaskId').value = task.id_tarks;
    document.getElementById('rescheduleReason').value = '';
    rescheduleStatusMsg.innerText = '';
    rescheduleModal.style.display = 'flex';
  }
  rescheduleForm.addEventListener('submit', handleRescheduleSave);
  function handleRescheduleSave(e) {
    e.preventDefault();
    const taskId = document.getElementById('rescheduleTaskId').value;
    const reason = document.getElementById('rescheduleReason').value;
    const fechaInicio = document.getElementById('rescheduleInicioFecha').value;
    const horaInicio = document.getElementById('rescheduleInicioHora').value;
    const fechaFin = document.getElementById('rescheduleFinFecha').value;
    const horaFin = document.getElementById('rescheduleFinHora').value;
    const newStartDateISO = `${fechaInicio}T${horaInicio}`;
    const newEndDateISO = `${fechaFin}T${horaFin}`;
    if (new Date(newEndDateISO) <= new Date(newStartDateISO)) {
      rescheduleStatusMsg.innerText = 'La nueva fecha de fin debe ser posterior a la de inicio.';
      return;
    }
    const originalTask = allTasks.find(t => t.id_tarks === taskId);
    const taskDataForBackend = {
      email: originalTask.email,
      title: originalTask.task,
      tag: originalTask.tag_activity,
      originalStartDate: originalTask.timestamp_star,
      originalEndDate: originalTask.timestamp_end
    };
    document.getElementById('btnSaveReschedule').disabled = true;
    rescheduleStatusMsg.style.color = 'blue';
    rescheduleStatusMsg.innerText = 'Reprogramando...';
    google.script.run
      .withSuccessHandler(onRescheduleSuccess)
      .withFailureHandler(onRescheduleFailure)
      .rescheduleTask(taskId, newStartDateISO, newEndDateISO, reason, taskDataForBackend);
  }
  function onRescheduleSuccess(response) {
    document.getElementById('btnSaveReschedule').disabled = false;
    if (response.status === 'success') {
      rescheduleStatusMsg.style.color = 'green';
      rescheduleStatusMsg.innerText = response.message;
      setTimeout(() => {
        rescheduleModal.style.display = 'none';
      }, 2000);
      loadTaskTimeline(); 
      loadDashboardMetrics();
      loadChartData(); 
    } else {
      rescheduleStatusMsg.style.color = 'red';
      rescheduleStatusMsg.innerText = response.message;
    }
  }
  function onRescheduleFailure(error) {
    document.getElementById('btnSaveReschedule').disabled = false;
    rescheduleStatusMsg.style.color = 'red';
    rescheduleStatusMsg.innerText = 'Error de conexión: ' + error.message;
  }
  
  // --- Lógica del Panel de Métricas (F9) ---
  function loadDashboardMetrics() {
    google.script.run
      .withSuccessHandler(onGetMetricsSuccess)
      .withFailureHandler(onGetMetricsFailure)
      .getDashboardMetrics(currentUserData.user); // PASAMOS EL USUARIO
  }
  function onGetMetricsSuccess(response) {
    if (response.status === 'error') {
      console.error("Error al cargar métricas:", response.message);
      return;
    }
    const kpis = response.data.kpis;
    const totalTasks = kpis.totalTasks > 0 ? kpis.totalTasks : 1; 
    
    // KPI 1: Tiempo de Gestión (SUMA TOTAL)
    const timeSpent = kpis.sumTime.toFixed(2);
    
    // Barra visual: Referencia 8 horas para el 100% visual, pero sin límite real
    const visualGoal = 8; 
    let timePercent = (kpis.sumTime / visualGoal) * 100;
    if (timePercent > 100) timePercent = 100; 
    
    document.getElementById('kpi-time-value').innerText = `${timeSpent} h`; // Texto solo con el total
    document.getElementById('kpi-time-bar').style.width = timePercent + '%'; // Barra visual
    
    const pendingPercent = (kpis.pendientes / totalTasks) * 100;
    document.getElementById('kpi-pending-value').innerText = kpis.pendientes;
    document.getElementById('kpi-pending-bar').style.width = pendingPercent + '%';
    const completedPercent = (kpis.completadas / totalTasks) * 100;
    document.getElementById('kpi-completed-value').innerText = kpis.completadas;
    document.getElementById('kpi-completed-bar').style.width = completedPercent + '%';
    const rescheduledPercent = (kpis.reprogramadas / totalTasks) * 100;
    document.getElementById('kpi-rescheduled-value').innerText = kpis.reprogramadas;
    document.getElementById('kpi-rescheduled-bar').style.width = rescheduledPercent + '%';
  }
  function onGetMetricsFailure(error) {
    console.error("Error de conexión al cargar métricas:", error.message);
  }

  // --- Lógica de la Gráfica (F9) ---
  document.getElementById('monthFilter').addEventListener('change', (e) => {
    const selectedMonth = e.target.value;
    updateDateRangeLabel(selectedMonth);
    drawCompletedChart(selectedMonth);
  });
  function loadChartData() {
    google.script.run
      .withSuccessHandler(onGetChartDataSuccess)
      .withFailureHandler(onGetChartDataFailure)
      .getChartData();
  }
  function onGetChartDataSuccess(response) {
    if (response.status === 'error') {
      console.error("Error al cargar datos de gráfica:", response.message);
      return;
    }
    completedTasksData = response.data;
    populateMonthFilter(completedTasksData);
    const now = new Date();
    const currentMonthKey = (now.getMonth() + 1).toString().padStart(2, '0') + '/' + now.getFullYear();
    const filter = document.getElementById('monthFilter');
    if (Object.keys(completedTasksData).length === 0) {
        document.getElementById('completedTasksChart').innerHTML = "<p style='text-align:center; color:#888;'>No hay tareas completadas para graficar.</p>";
        document.getElementById('dateRangeLabel').innerText = "Mes Actual";
        filter.style.display = 'none';
        return;
    }
    filter.style.display = 'block';
    if ([...filter.options].some(option => option.value === currentMonthKey)) {
      filter.value = currentMonthKey;
    }
    updateDateRangeLabel(filter.value);
    google.charts.setOnLoadCallback(() => drawCompletedChart(filter.value));
  }
  function onGetChartDataFailure(error) {
    console.error("Error de conexión al cargar gráfica:", error.message);
  }
  function populateMonthFilter(data) {
    const filter = document.getElementById('monthFilter');
    const months = new Map(); 
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (const dateKey in data) { 
      const [day, month, year] = dateKey.split('/');
      const monthKey = `${month}/${year}`; 
      const dateObj = new Date(year, month - 1, 1);
      if (!months.has(monthKey)) {
        months.set(monthKey, { 
          date: dateObj, 
          label: `${monthNames[month - 1]} ${year}` 
        });
      }
    }
    const sortedMonths = [...months.entries()].sort((a, b) => b[1].date - a[1].date);
    filter.innerHTML = '';
    sortedMonths.forEach(([key, value]) => {
      const option = document.createElement('option');
      option.value = key; // "MM/yyyy"
      option.innerText = value.label; // "Nov 2025"
      filter.appendChild(option);
    });
  }
  function updateDateRangeLabel(monthKey) { 
    if(!monthKey) { 
        document.getElementById('dateRangeLabel').innerText = "Mes Actual";
        return;
    }
    const [month, year] = monthKey.split('/');
    const monthIndex = parseInt(month, 10) - 1;
    const monthNamesLong = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const label = `01 - ${lastDay} ${monthNamesLong[monthIndex]}, ${year}`;
    document.getElementById('dateRangeLabel').innerText = label;
  }
  function drawCompletedChart(monthKey) { 
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Día');
    dataTable.addColumn('number', 'Tareas');
    const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const chartRows = [];
    for (const dateKey in completedTasksData) { 
      const [day, month, year] = dateKey.split('/');
      const currentKey = `${month}/${year}`;
      if (currentKey === monthKey) {
        const label = `${day}/${monthNamesShort[parseInt(month, 10) - 1]}`;
        chartRows.push([label, completedTasksData[dateKey]]);
      }
    }
    if (chartRows.length === 0) {
        document.getElementById('completedTasksChart').innerHTML = "<p style='text-align:center; color:#888;'>Sin datos este mes.</p>";
        return;
    }
    chartRows.sort((a, b) => {
      const dayA = parseInt(a[0].split('/')[0], 10);
      const dayB = parseInt(b[0].split('/')[0], 10);
      return dayA - dayB;
    });
    dataTable.addRows(chartRows);
    const options = {
      legend: { position: 'none' },
      chartArea: { width: '90%', height: '75%' },
      bar: { groupWidth: '30%' },
      vAxis: { 
        gridlines: { color: 'transparent' }, 
        baselineColor: '#ddd',
        textStyle: { color: '#888' },
        minValue: 0
      },
      hAxis: { 
        textStyle: { color: '#888', fontSize: 11 } 
      },
      backgroundColor: 'transparent', 
      colors: ['rgb(143, 167, 255)']
    };
    const chart = new google.visualization.ColumnChart(document.getElementById('completedTasksChart'));
    chart.draw(dataTable, options);
  }

  // --- Lógica de la Vista "Coments" ---
  function loadCommentsView() {
    const container = document.getElementById('commentsTaskList');
    container.innerHTML = '<p>Cargando tareas...</p>';
    google.script.run
      .withSuccessHandler(onGetTasksWithCountsSuccess)
      .withFailureHandler(onGetTasksWithCountsFailure)
      .getTasksWithCommentCounts();
  }
  function onGetTasksWithCountsSuccess(response) {
    const container = document.getElementById('commentsTaskList');
    if (response.status === 'error') {
      container.innerHTML = `<p>${response.message}</p>`;
      return;
    }
    const tasks = response.data;
    const tasksWithComments = tasks.filter(task => task.commentCount > 0);
    if (tasksWithComments.length === 0) {
      container.innerHTML = '<p>Ninguna tarea tiene comentarios todavía.</p>';
      return;
    }
    let htmlContent = '';
    tasksWithComments.forEach(task => {
      htmlContent += `
        <div class="comment-task-item" data-task-id="${task.id_tarks}" data-task-title="${task.task}">
          <div class="task-details">
            <p class="title">${task.id_tarks} - ${task.task}</p>
            <p class="time">Responsable: ${task.user}</p>
          </div>
          <div class="comment-count-badge">
            ${task.commentCount}
          </div>
        </div>
      `;
    });
    container.innerHTML = htmlContent;
  }
  function onGetTasksWithCountsFailure(error) {
    document.getElementById('commentsTaskList').innerHTML = `<p>Error de conexión: ${error.message}</p>`;
  }
  document.getElementById('commentsTaskList').addEventListener('click', (e) => {
    const item = e.target.closest('.comment-task-item');
    if (item) {
      const taskId = item.dataset.taskId;
      const taskTitle = item.dataset.taskTitle;
      openCommentsModal(taskId, taskTitle);
    }
  });
  const commentsModal = document.getElementById('commentsModal');
  function openCommentsModal(taskId, taskTitle) {
    document.getElementById('commentsModalTitle').innerText = `Comentarios de: ${taskTitle}`;
    const list = document.getElementById('commentsModalList');
    list.innerHTML = '<p class="comments-placeholder">Cargando...</p>';
    commentsModal.style.display = 'flex';
    google.script.run
      .withSuccessHandler(onGetCommentsForModalSuccess)
      .withFailureHandler(onGetCommentsForModalFailure)
      .getComments(taskId);
  }
  function onGetCommentsForModalSuccess(response) {
    const container = document.getElementById('commentsModalList');
    if (response.status === 'error') {
        container.innerHTML = `<p class="comments-placeholder">${response.message}</p>`;
        return;
    }
    const comments = response.data;
    if (comments.length === 0) {
        container.innerHTML = '<p class="comments-placeholder">No se encontraron comentarios.</p>';
        return;
    }
    let htmlContent = '';
    comments.forEach(comment => {
        htmlContent += `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-user">${comment.user}</span>
                    <span class="comment-time">${comment.timestamp}</span>
                </div>
                <p class="comment-body">${comment.comment_text}</p>
            </div>
        `;
    });
    container.innerHTML = htmlContent;
  }
  function onGetCommentsForModalFailure(error) {
    document.getElementById('commentsModalList').innerHTML = 
      `<p class="comments-placeholder">Error al cargar comentarios: ${error.message}</p>`;
  }
  document.getElementById('btnCloseCommentsModal').addEventListener('click', () => {
    commentsModal.style.display = 'none';
  });
  
  // --- Lógica de la Vista "Gantt" (F8) ---
  
  document.getElementById('ganttUserFilter').addEventListener('change', (e) => {
    drawCustomGanttChart(e.target.value); 
  });
  
  function loadGanttChart() {
    const container = document.getElementById('ganttChartContainer');
    container.innerHTML = '<p>Cargando gráfica Gantt...</p>';
    
    google.script.run
      .withSuccessHandler(onGetGanttDataSuccess)
      .withFailureHandler(onGetGanttDataFailure)
      .getGanttData();
  }

  function onGetGanttDataSuccess(response) {
    if (response.status === 'error') {
      document.getElementById('ganttChartContainer').innerHTML = `<p>${response.message}</p>`;
      return;
    }
    allGanttData = response.data; 

    // --- Lógica de Filtro Mejorada ---
    const usersInTasks = [...new Set(allGanttData.map(row => row.user))]; 
    const select = document.getElementById('ganttUserFilter');
    select.innerHTML = '<option value="all">Todos los usuarios</option>';
    
    usersInTasks.forEach(userId => {
      const userName = allUsersMap.get(userId) || userId; 
      const option = document.createElement('option');
      option.value = userId;
      option.innerText = userName;
      select.appendChild(option);
    });
    
    drawCustomGanttChart('all');
  }
  
  function onGetGanttDataFailure(error) {
     document.getElementById('ganttChartContainer').innerHTML = `<p>Error de conexión: ${error.message}</p>`;
  }

  function drawCustomGanttChart(filterUser) {
    const container = document.getElementById('ganttChartContainer');
    
    let filteredData = allGanttData;
    if (filterUser !== 'all') {
      filteredData = allGanttData.filter(task => task.user === filterUser);
    }
    
    if (filteredData.length === 0) {
      container.innerHTML = '<p>No hay tareas para mostrar con este filtro.</p>';
      return;
    }

    const startHour = 6;
    const endHour = 19;
    const totalHours = endHour - startHour; 
    
    let headerHtml = '<div class="custom-gantt-timeline-wrapper"><div class="custom-gantt-timeline">';
    headerHtml = '<div style="display:flex; width:100%;">' + '<div class="custom-gantt-label" style="border-bottom:1px solid #eee;"></div>' + headerHtml;

    for (let h = startHour; h <= endHour; h++) {
        let hourText = (h > 12) ? (h - 12) + ' PM' : (h === 12 ? '12 PM' : h + ' AM');
        if (h === 0) hourText = '12 AM';
        headerHtml += `<div class="custom-gantt-hour">${hourText}</div>`;
    }
    headerHtml += '</div></div></div>'; 

    let rowsHtml = '';
    filteredData.forEach(task => {
        const startDate = parseDisplayDate(task.start);
        const endDate = parseDisplayDate(task.end);

        if (!startDate || !endDate) return; 

        const startDecimal = startDate.getHours() + (startDate.getMinutes() / 60);
        const endDecimal = endDate.getHours() + (endDate.getMinutes() / 60);

        const leftPercent = Math.max(0, (startDecimal - startHour) / totalHours) * 100;
        const widthPercent = Math.min((endDecimal - startDecimal) / totalHours * 100, 100 - leftPercent);

        if (endDecimal < startHour || startDecimal > endHour) return; 

        rowsHtml += `
          <div class="custom-gantt-row">
            <div class="custom-gantt-label" title="${task.name}">${task.name}</div>
            <div class="custom-gantt-track">
              <div class="custom-gantt-bar" style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${task.color};" title="${task.start} - ${task.end}"></div>
            </div>
          </div>
        `;
    });

    container.innerHTML = headerHtml + rowsHtml;
  }

  function parseDisplayDate(dateString) {
    try {
      if (!dateString) return null;
      const parts = dateString.split(', ');
      if (parts.length < 2) return null;
      const [datePart, timePart] = parts;
      const [day, month, year] = datePart.split('/');
      const [hours, minutes, seconds] = timePart.split(':');
      return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
    } catch (e) { return null; }
  }

}); // <-- FIN DE DOMContentLoaded
