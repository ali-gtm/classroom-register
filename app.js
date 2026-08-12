(function () {
  "use strict";

  var STORAGE_KEY = "classroom-register-data";
  var PASS_THRESHOLD = 40;

  var state = loadState();

  var els = {
    newClassBtn: document.getElementById("newClassBtn"),
    newClassForm: document.getElementById("newClassForm"),
    newClassName: document.getElementById("newClassName"),
    saveClassBtn: document.getElementById("saveClassBtn"),
    cancelClassBtn: document.getElementById("cancelClassBtn"),
    classTabs: document.getElementById("classTabs"),
    emptyState: document.getElementById("emptyState"),
    classView: document.getElementById("classView"),
    deleteClassBtn: document.getElementById("deleteClassBtn"),
    newStudentName: document.getElementById("newStudentName"),
    addStudentBtn: document.getElementById("addStudentBtn"),
    studentCards: document.getElementById("studentCards"),
    resultsPanel: document.getElementById("resultsPanel"),
    attendancePanel: document.getElementById("attendancePanel"),
    attendanceDate: document.getElementById("attendanceDate"),
    attendanceBody: document.getElementById("attendanceBody"),
    studentCardTemplate: document.getElementById("studentCardTemplate"),
    toggleBtns: document.querySelectorAll(".toggle-btn")
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { classes: [], activeClassId: null, nextClassId: 1, nextStudentId: 1 };
      return JSON.parse(raw);
    } catch (e) {
      return { classes: [], activeClassId: null, nextClassId: 1, nextStudentId: 1 };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Could not save data", e);
    }
  }

  function getActiveClass() {
    return state.classes.find(function (c) { return c.id === state.activeClassId; }) || null;
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function gradeFor(pct) {
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    if (pct >= 50) return "D";
    if (pct >= PASS_THRESHOLD) return "E";
    return "F";
  }

  function computeStudentStats(student) {
    var obtained = 0, total = 0;
    (student.subjects || []).forEach(function (s) {
      obtained += Number(s.obtained) || 0;
      total += Number(s.total) || 0;
    });
    var pct = total > 0 ? (obtained / total) * 100 : 0;
    return {
      pct: Math.round(pct * 10) / 10,
      grade: total > 0 ? gradeFor(pct) : "-",
      pass: total > 0 ? pct >= PASS_THRESHOLD : null
    };
  }

  function computeAttendancePct(student) {
    var dates = Object.keys(student.attendance || {});
    if (dates.length === 0) return null;
    var present = dates.filter(function (d) { return student.attendance[d] === "present"; }).length;
    return Math.round((present / dates.length) * 1000) / 10;
  }

  /* ---------- rendering ---------- */

  function render() {
    renderClassTabs();
    var cls = getActiveClass();
    if (!cls) {
      els.emptyState.classList.remove("hidden");
      els.classView.classList.add("hidden");
      return;
    }
    els.emptyState.classList.add("hidden");
    els.classView.classList.remove("hidden");
    renderStudentCards(cls);
    renderAttendanceTable(cls);
  }

  function renderClassTabs() {
    els.classTabs.innerHTML = "";
    state.classes.forEach(function (cls) {
      var btn = document.createElement("button");
      btn.className = "class-tab" + (cls.id === state.activeClassId ? " active" : "");
      btn.textContent = cls.name;
      btn.addEventListener("click", function () {
        state.activeClassId = cls.id;
        saveState();
        render();
      });
      els.classTabs.appendChild(btn);
    });
  }

  function renderStudentCards(cls) {
    els.studentCards.innerHTML = "";
    cls.students.forEach(function (student) {
      var node = els.studentCardTemplate.content.cloneNode(true);
      var card = node.querySelector(".student-card");
      card.querySelector(".student-name").textContent = student.name;

      var stats = computeStudentStats(student);
      var pctEl = card.querySelector(".pct-value");
      animateCountUp(pctEl, stats.pct);
      card.querySelector(".grade-badge").textContent = "Grade " + stats.grade;

      var stamp = card.querySelector(".pass-stamp");
      if (stats.pass === null) {
        stamp.textContent = "No marks yet";
      } else {
        stamp.textContent = stats.pass ? "Pass" : "Fail";
        stamp.classList.add(stats.pass ? "pass" : "fail");
      }

      var subjectRows = card.querySelector(".subject-rows");
      (student.subjects || []).forEach(function (subj, idx) {
        var row = document.createElement("tr");
        row.innerHTML =
          "<td>" + escapeHtml(subj.name) + "</td>" +
          "<td>" + escapeHtml(subj.obtained) + "</td>" +
          "<td>" + escapeHtml(subj.total) + "</td>" +
          "<td><button class=\"del-subject\" aria-label=\"Remove subject\">&times;</button></td>";
        row.querySelector(".del-subject").addEventListener("click", function () {
          student.subjects.splice(idx, 1);
          saveState();
          render();
        });
        subjectRows.appendChild(row);
      });

      card.querySelector(".delete-student-btn").addEventListener("click", function () {
        cls.students = cls.students.filter(function (s) { return s.id !== student.id; });
        saveState();
        render();
      });

      var nameInput = card.querySelector(".subject-name-input");
      var obtainedInput = card.querySelector(".subject-obtained-input");
      var totalInput = card.querySelector(".subject-total-input");

      card.querySelector(".add-subject-btn").addEventListener("click", function () {
        var name = nameInput.value.trim();
        var obtained = obtainedInput.value;
        var total = totalInput.value;
        if (!name || obtained === "" || total === "") return;
        student.subjects = student.subjects || [];
        student.subjects.push({ name: name, obtained: Number(obtained), total: Number(total) });
        saveState();
        render();
      });

      els.studentCards.appendChild(node);
    });
  }

  function renderAttendanceTable(cls) {
    els.attendanceBody.innerHTML = "";
    var date = els.attendanceDate.value || todayISO();
    cls.students.forEach(function (student) {
      var row = document.createElement("tr");

      var nameTd = document.createElement("td");
      nameTd.textContent = student.name;
      row.appendChild(nameTd);

      var statusTd = document.createElement("td");
      var status = (student.attendance || {})[date];
      var toggle = document.createElement("button");
      toggle.className = "att-toggle" + (status ? " " + status : "");
      toggle.textContent = status ? (status === "present" ? "Present" : "Absent") : "Mark";
      toggle.addEventListener("click", function () {
        student.attendance = student.attendance || {};
        var current = student.attendance[date];
        var next = current === "present" ? "absent" : current === "absent" ? null : "present";
        if (next === null) {
          delete student.attendance[date];
        } else {
          student.attendance[date] = next;
        }
        saveState();
        renderAttendanceTable(cls);
      });
      statusTd.appendChild(toggle);
      row.appendChild(statusTd);

      var overallTd = document.createElement("td");
      var overall = computeAttendancePct(student);
      overallTd.textContent = overall === null ? "No records yet" : overall + "%";
      row.appendChild(overallTd);

      els.attendanceBody.appendChild(row);
    });
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  function animateCountUp(el, target) {
    var start = 0;
    var duration = 500;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var value = Math.round((start + (target - start) * progress) * 10) / 10;
      el.textContent = value + "%";
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- events ---------- */

  els.newClassBtn.addEventListener("click", function () {
    els.newClassForm.classList.remove("hidden");
    els.newClassName.focus();
  });

  els.cancelClassBtn.addEventListener("click", function () {
    els.newClassForm.classList.add("hidden");
    els.newClassName.value = "";
  });

  els.saveClassBtn.addEventListener("click", function () {
    var name = els.newClassName.value.trim();
    if (!name) return;
    var cls = { id: state.nextClassId++, name: name, students: [] };
    state.classes.push(cls);
    state.activeClassId = cls.id;
    els.newClassName.value = "";
    els.newClassForm.classList.add("hidden");
    saveState();
    render();
  });

  els.newClassName.addEventListener("keydown", function (e) {
    if (e.key === "Enter") els.saveClassBtn.click();
  });

  els.deleteClassBtn.addEventListener("click", function () {
    var cls = getActiveClass();
    if (!cls) return;
    if (!confirm("Delete \"" + cls.name + "\" and all its data? This can't be undone.")) return;
    state.classes = state.classes.filter(function (c) { return c.id !== cls.id; });
    state.activeClassId = state.classes.length ? state.classes[0].id : null;
    saveState();
    render();
  });

  els.addStudentBtn.addEventListener("click", function () {
    var cls = getActiveClass();
    if (!cls) return;
    var name = els.newStudentName.value.trim();
    if (!name) return;
    cls.students.push({ id: state.nextStudentId++, name: name, subjects: [], attendance: {} });
    els.newStudentName.value = "";
    saveState();
    render();
  });

  els.newStudentName.addEventListener("keydown", function (e) {
    if (e.key === "Enter") els.addStudentBtn.click();
  });

  els.toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      els.toggleBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var view = btn.getAttribute("data-view");
      els.resultsPanel.classList.toggle("hidden", view !== "results");
      els.attendancePanel.classList.toggle("hidden", view !== "attendance");
    });
  });

  els.attendanceDate.addEventListener("change", function () {
    var cls = getActiveClass();
    if (cls) renderAttendanceTable(cls);
  });

  /* ---------- init ---------- */

  els.attendanceDate.value = todayISO();
  if (!state.activeClassId && state.classes.length) {
    state.activeClassId = state.classes[0].id;
  }
  render();
})();
