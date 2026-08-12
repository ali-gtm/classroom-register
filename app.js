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
    toggleBtns: document.querySelectorAll(".toggle-btn"),
    toppersSection: document.getElementById("toppersSection"),
    topperCards: document.getElementById("topperCards"),
    scanBtn: document.getElementById("scanBtn"),
    scanModal: document.getElementById("scanModal"),
    scanCloseBtn: document.getElementById("scanCloseBtn"),
    scanSetupStep: document.getElementById("scanSetupStep"),
    scanReviewStep: document.getElementById("scanReviewStep"),
    scanSubjectName: document.getElementById("scanSubjectName"),
    scanTotalMarks: document.getElementById("scanTotalMarks"),
    scanFileInput: document.getElementById("scanFileInput"),
    scanRunBtn: document.getElementById("scanRunBtn"),
    scanStatus: document.getElementById("scanStatus"),
    scanReviewBody: document.getElementById("scanReviewBody"),
    scanReviewSummary: document.getElementById("scanReviewSummary"),
    scanBackBtn: document.getElementById("scanBackBtn"),
    scanApplyBtn: document.getElementById("scanApplyBtn")
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
    renderToppers(cls);
    renderStudentCards(cls);
    renderAttendanceTable(cls);
  }

  function renderToppers(cls) {
    els.topperCards.innerHTML = "";
    var ranked = cls.students
      .map(function (s) { return { student: s, stats: computeStudentStats(s) }; })
      .filter(function (r) { return r.stats.pass !== null; })
      .sort(function (a, b) { return b.stats.pct - a.stats.pct; })
      .slice(0, 3);

    els.toppersSection.classList.toggle("hidden", ranked.length === 0);

    var medals = ["gold", "silver", "bronze"];
    var labels = ["1st", "2nd", "3rd"];
    ranked.forEach(function (r, idx) {
      var card = document.createElement("div");
      card.className = "topper-card " + medals[idx];
      card.innerHTML =
        "<span class=\"topper-rank\">" + labels[idx] + "</span>" +
        "<span class=\"topper-name\">" + escapeHtml(r.student.name) + "</span>" +
        "<span class=\"topper-pct\">" + r.stats.pct + "%</span>" +
        "<span class=\"topper-grade\">Grade " + r.stats.grade + "</span>";
      els.topperCards.appendChild(card);
    });
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

  /* ---------- result sheet scanning (OCR) ---------- */

  var TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js";

  function ensureTesseract(callback) {
    if (window.Tesseract) { callback(); return; }
    var existing = document.getElementById("tesseractScript");
    if (existing) {
      existing.addEventListener("load", callback);
      return;
    }
    var script = document.createElement("script");
    script.id = "tesseractScript";
    script.src = TESSERACT_SRC;
    script.onload = function () { callback(); };
    script.onerror = function () {
      els.scanStatus.textContent = "Couldn't load the scanning library. Check your internet connection and try again.";
      els.scanRunBtn.disabled = false;
    };
    document.head.appendChild(script);
  }

  function normalizeName(name) {
    return String(name).toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  }

  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    var dp = [];
    var i, j;
    for (i = 0; i <= m; i++) { dp.push([i]); }
    for (j = 0; j <= n; j++) { dp[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[m][n];
  }

  function bestStudentMatch(cls, rawName) {
    var target = normalizeName(rawName);
    if (!target) return null;
    var best = null, bestDist = Infinity;
    cls.students.forEach(function (s) {
      var dist = levenshtein(target, normalizeName(s.name));
      if (dist < bestDist) { bestDist = dist; best = s; }
    });
    var threshold = Math.max(2, Math.floor(target.length * 0.3));
    return best && bestDist <= threshold ? best : null;
  }

  function parseResultText(text) {
    var lines = text.split(/\r?\n/);
    var rows = [];
    lines.forEach(function (line) {
      var cleaned = line.replace(/^\s*\d{1,3}[.)]\s*/, "").trim();
      if (!cleaned) return;
      if (!/[A-Za-z]{2,}/.test(cleaned)) return;

      var match = cleaned.match(/^(.*\D)\D*(\d{1,3})\s*\/\s*\d{1,3}\s*$/) ||
        cleaned.match(/^(.*\D)\D*(\d{1,3})\s*$/);

      if (match) {
        var name = match[1].replace(/[\s.\-–—:]+$/, "");
        var marks = Number(match[2]);
        if (name && name.length >= 2 && !isNaN(marks)) {
          rows.push({ name: name, obtained: marks, needsReview: false });
          return;
        }
      }

      rows.push({ name: cleaned, obtained: "", needsReview: true });
    });
    return rows;
  }

  function openScanModal() {
    var cls = getActiveClass();
    if (!cls) return;
    els.scanModal.classList.remove("hidden");
    els.scanSetupStep.classList.remove("hidden");
    els.scanReviewStep.classList.add("hidden");
    els.scanSubjectName.value = "";
    els.scanTotalMarks.value = "";
    els.scanFileInput.value = "";
    els.scanStatus.textContent = "";
    els.scanReviewSummary.textContent = "";
    els.scanRunBtn.disabled = true;
  }

  function closeScanModal() {
    els.scanModal.classList.add("hidden");
  }

  function updateScanRunEnabled() {
    els.scanRunBtn.disabled = !(
      els.scanSubjectName.value.trim() &&
      els.scanTotalMarks.value &&
      els.scanFileInput.files.length
    );
  }

  function openReviewStep(cls, rows) {
    els.scanSetupStep.classList.add("hidden");
    els.scanReviewStep.classList.remove("hidden");
    els.scanReviewBody.innerHTML = "";

    var unclear = 0;

    rows.forEach(function (row) {
      var match = bestStudentMatch(cls, row.name);
      var tr = document.createElement("tr");
      if (row.needsReview) { unclear++; tr.classList.add("scan-row-unclear"); }

      var rawTd = document.createElement("td");
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "scan-name-input";
      nameInput.value = row.name;
      rawTd.appendChild(nameInput);
      if (row.needsReview) {
        var note = document.createElement("div");
        note.className = "scan-row-note";
        note.textContent = "Couldn't auto-read this line — check the name and enter marks";
        rawTd.appendChild(note);
      }
      tr.appendChild(rawTd);

      var studentTd = document.createElement("td");
      var select = document.createElement("select");
      select.className = "scan-student-select";

      var newOpt = document.createElement("option");
      newOpt.value = "new";
      newOpt.textContent = "+ New student: \"" + row.name + "\"";
      select.appendChild(newOpt);

      var skipOpt = document.createElement("option");
      skipOpt.value = "skip";
      skipOpt.textContent = "Skip this row";
      select.appendChild(skipOpt);

      cls.students.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = String(s.id);
        opt.textContent = s.name;
        select.appendChild(opt);
      });
      select.value = match ? String(match.id) : "new";
      studentTd.appendChild(select);
      tr.appendChild(studentTd);

      var marksTd = document.createElement("td");
      var marksInput = document.createElement("input");
      marksInput.type = "number";
      marksInput.min = "0";
      marksInput.value = row.obtained;
      marksInput.className = "scan-marks-input";
      marksTd.appendChild(marksInput);
      tr.appendChild(marksTd);

      els.scanReviewBody.appendChild(tr);
    });

    var total = rows.length;
    var autoRead = total - unclear;
    els.scanReviewSummary.textContent = unclear
      ? "Found " + total + " line" + (total === 1 ? "" : "s") + " — " + autoRead + " read automatically, " + unclear + " need" + (unclear === 1 ? "s" : "") + " a manual check below (marked in red)."
      : "Found " + total + " line" + (total === 1 ? "" : "s") + " and read all of them automatically. Check names/marks before applying.";
  }

  els.scanBtn.addEventListener("click", openScanModal);
  els.scanCloseBtn.addEventListener("click", closeScanModal);
  els.scanBackBtn.addEventListener("click", function () {
    els.scanReviewStep.classList.add("hidden");
    els.scanSetupStep.classList.remove("hidden");
    els.scanRunBtn.disabled = false;
    els.scanStatus.textContent = "";
  });

  els.scanSubjectName.addEventListener("input", updateScanRunEnabled);
  els.scanTotalMarks.addEventListener("input", updateScanRunEnabled);
  els.scanFileInput.addEventListener("change", updateScanRunEnabled);

  els.scanRunBtn.addEventListener("click", function () {
    var cls = getActiveClass();
    var file = els.scanFileInput.files[0];
    if (!cls || !file) return;

    els.scanRunBtn.disabled = true;
    els.scanStatus.textContent = "Loading scanner…";

    ensureTesseract(function () {
      els.scanStatus.textContent = "Reading photo… this can take a moment.";
      Tesseract.recognize(file, "eng")
        .then(function (result) {
          var text = (result && result.data && result.data.text) || "";
          var rows = parseResultText(text);
          if (!rows.length) {
            els.scanStatus.textContent = "Couldn't find any name/marks pairs in that photo. Try a clearer, well-lit photo, or enter marks manually.";
            els.scanRunBtn.disabled = false;
            return;
          }
          els.scanStatus.textContent = "";
          openReviewStep(cls, rows);
        })
        .catch(function (err) {
          console.error(err);
          els.scanStatus.textContent = "Scanning failed. Try again with a clearer photo.";
          els.scanRunBtn.disabled = false;
        });
    });
  });

  els.scanApplyBtn.addEventListener("click", function () {
    var cls = getActiveClass();
    if (!cls) return;
    var subjectName = els.scanSubjectName.value.trim();
    var total = Number(els.scanTotalMarks.value);
    if (!subjectName || !total) return;

    var skippedForMarks = 0;
    var rows = els.scanReviewBody.querySelectorAll("tr");
    rows.forEach(function (tr) {
      var select = tr.querySelector(".scan-student-select");
      var marksInput = tr.querySelector(".scan-marks-input");
      var rawName = tr.querySelector(".scan-name-input").value.trim();
      if (select.value === "skip") return;
      if (marksInput.value.trim() === "" || !rawName) { skippedForMarks++; return; }
      var obtained = Number(marksInput.value);
      if (isNaN(obtained)) { skippedForMarks++; return; }

      var student;
      if (select.value === "new") {
        student = { id: state.nextStudentId++, name: rawName, subjects: [], attendance: {} };
        cls.students.push(student);
      } else {
        student = cls.students.find(function (s) { return String(s.id) === select.value; });
      }
      if (!student) return;

      student.subjects = student.subjects || [];
      var existing = student.subjects.find(function (s) {
        return s.name.toLowerCase() === subjectName.toLowerCase();
      });
      if (existing) {
        existing.obtained = obtained;
        existing.total = total;
      } else {
        student.subjects.push({ name: subjectName, obtained: obtained, total: total });
      }
    });

    saveState();
    render();
    closeScanModal();

    if (skippedForMarks > 0) {
      alert(
        skippedForMarks + " row" + (skippedForMarks === 1 ? " wasn't" : "s weren't") +
        " applied because the marks field was empty or a name was missing. " +
        "Those students weren't added — scan again or add them by hand from their student card."
      );
    }
  });

  /* ---------- init ---------- */

  els.attendanceDate.value = todayISO();
  if (!state.activeClassId && state.classes.length) {
    state.activeClassId = state.classes[0].id;
  }
  render();
})();
