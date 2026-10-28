const STORAGE = {
  plan: "zebpomo-plan-v1",
  done: "zebpomo-done-v1",
  timer: "zebpomo-timer-v1",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const localDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDate = (date, options) => new Intl.DateTimeFormat(undefined, options).format(date);

const form = $("#planner-form");
const planOutput = $("#plan-output");
const toast = $("#toast");
let toastTimeout;

function announce(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function getWorkdays(count) {
  const schedules = {
    1: [3],
    2: [2, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return new Set(schedules[count] || schedules[5]);
}

function phaseFor(dayNumber, duration) {
  if (duration === 7) {
    if (dayNumber <= 2) return "Get clear & get ready";
    if (dayNumber <= 5) return "Build steady momentum";
    if (dayNumber === 6) return "Tie up a loose end";
    return "Review & choose what’s next";
  }
  if (dayNumber <= 7) return "Set your baseline";
  if (dayNumber <= 14) return "Build steady momentum";
  if (dayNumber <= 21) return "Tackle the hardest part";
  if (dayNumber <= 27) return "Finish the open loops";
  return "Review & choose what’s next";
}

function actionFor(goal, dayNumber, duration, workdayNumber, workdayCount) {
  const safeGoal = goal.trim();
  if (workdayNumber === 1) {
    return `Define what “done” looks like for ${safeGoal}, then choose the smallest useful first step.`;
  }
  if (dayNumber === duration || workdayNumber === workdayCount) {
    return `Review your progress on ${safeGoal}. Note what’s complete, what’s next, and one thing you learned.`;
  }
  if (duration > 7 && dayNumber === 8) {
    return `Check your notes on ${safeGoal}, pick the most important next piece, and begin there.`;
  }
  if (duration > 7 && dayNumber === 15) {
    return `Give ${safeGoal} a midpoint check-in. Adjust the plan and take on one meaningful stretch step.`;
  }
  if (duration > 7 && dayNumber === 22) {
    return `Close the biggest remaining gap in ${safeGoal}. Keep the finish line clear and realistic.`;
  }
  if (duration === 7 && dayNumber === 4) {
    return `Pause for a quick midpoint check on ${safeGoal}, then focus on the next most useful step.`;
  }
  return `Make progress on ${safeGoal}: pick one specific task, focus for 25 minutes, and note where to resume.`;
}

function makePlan({ goal, period, minutesPerDay, daysPerWeek, startDate }) {
  const duration = period === "month" ? 30 : 7;
  const workdays = getWorkdays(daysPerWeek);
  const sessionsPerDay = Math.max(1, Math.floor((minutesPerDay + 5) / 30));
  const dates = [];
  let workdayNumber = 0;

  for (let offset = 0; offset < duration; offset += 1) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
    const isWorkday = workdays.has(date.getDay());
    if (isWorkday) workdayNumber += 1;
    dates.push({
      date: localDateKey(date),
      dayNumber: offset + 1,
      dateLabel: formatDate(date, { weekday: "short", month: "short", day: "numeric" }),
      weekday: formatDate(date, { weekday: "long" }),
      weekNumber: Math.floor(offset / 7) + 1,
      phase: phaseFor(offset + 1, duration),
      isWorkday,
      sessions: isWorkday ? sessionsPerDay : 0,
      action: isWorkday ? actionFor(goal, offset + 1, duration, workdayNumber, Math.ceil((duration / 7) * daysPerWeek)) : "Rest, recharge, or use this as a gentle catch-up day.",
    });
  }

  const workdayCount = dates.filter((day) => day.isWorkday).length;
  const requiredWorkdays = Math.ceil((duration / 7) * daysPerWeek);
  let actualWorkdayNumber = 0;
  dates.forEach((day) => {
    if (!day.isWorkday) return;
    actualWorkdayNumber += 1;
    day.action = actionFor(goal, day.dayNumber, duration, actualWorkdayNumber, workdayCount);
  });

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    goal: goal.trim(),
    period,
    duration,
    minutesPerDay,
    daysPerWeek,
    sessionsPerDay,
    startDate: dates[0].date,
    endDate: dates[dates.length - 1].date,
    days: dates,
    generatedAt: new Date().toISOString(),
    plannedSessions: workdayCount * sessionsPerDay,
    plannedMinutes: workdayCount * sessionsPerDay * 25,
    requiredWorkdays,
  };
}

function readDoneDays(plan) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE.done) || "{}");
    return new Set(stored[plan.id] || []);
  } catch {
    return new Set();
  }
}

function saveDoneDays(plan, doneDays) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE.done) || "{}");
    stored[plan.id] = [...doneDays];
    localStorage.setItem(STORAGE.done, JSON.stringify(stored));
  } catch {
    announce("Couldn’t save check-ins on this device.");
  }
}

function renderPlan(plan, shouldScroll = false) {
  const doneDays = readDoneDays(plan);
  const weeks = new Map();
  plan.days.forEach((day) => {
    if (!weeks.has(day.weekNumber)) weeks.set(day.weekNumber, []);
    weeks.get(day.weekNumber).push(day);
  });

  const weeksHTML = [...weeks.entries()].map(([weekNumber, days]) => {
    const first = new Date(`${days[0].date}T12:00:00`);
    const last = new Date(`${days[days.length - 1].date}T12:00:00`);
    const weekDates = `${formatDate(first, { month: "short", day: "numeric" })}–${formatDate(last, { month: "short", day: "numeric" })}`;
    const dayHTML = days.map((day) => {
      const isDone = doneDays.has(day.date);
      const doneClass = isDone ? " is-done" : "";
      const restClass = day.isWorkday ? "" : " rest-day";
      const badge = day.isWorkday ? `${day.sessions} × 25 min` : "Rest day";
      const details = day.isWorkday
        ? `${day.sessions} focus ${day.sessions === 1 ? "session" : "sessions"}${day.sessions > 1 ? " · take a 5 min breather between sessions" : ""}`
        : "Recovery is part of the plan";
      return `<div class="plan-day${restClass}${doneClass}" data-date="${day.date}">
        <input class="plan-check" type="checkbox" aria-label="Mark ${escapeHTML(day.weekday)} ${escapeHTML(day.dateLabel)} complete" ${isDone ? "checked" : ""} />
        <div class="plan-day-date"><b>${escapeHTML(day.weekday.slice(0, 3))}</b>${escapeHTML(day.dateLabel.split(" ").slice(1).join(" "))}</div>
        <div class="plan-day-copy"><b>${escapeHTML(day.phase)}</b><small>${escapeHTML(day.action)}<br />${escapeHTML(details)}</small></div>
        <span class="plan-day-count">${badge}</span>
      </div>`;
    }).join("");
    return `<section class="plan-week"><div class="plan-week-head"><strong>Week ${weekNumber}</strong><span>${weekDates}</span></div>${dayHTML}</section>`;
  }).join("");

  const periodText = plan.period === "month" ? "30-day plan" : "7-day plan";
  const totalHours = (plan.plannedMinutes / 60).toFixed(plan.plannedMinutes % 60 ? 1 : 0);
  planOutput.innerHTML = `<div class="generated-plan">
    <div class="generated-plan-head"><div><span class="eyebrow"><span class="eyebrow-dot"></span> YOUR TIMETABLE IS READY</span><h3>${escapeHTML(plan.goal)}</h3><span class="plan-engine${plan.planMode === "ai" ? " ai" : ""}">${plan.planMode === "ai" ? "✦ AI-PERSONALIZED PLAN" : "QUICK PLAN"}</span><p class="plan-summary-text">${escapeHTML(plan.aiSummary || "Use the checkboxes to mark a day complete. Your plan saves on this device.")}</p></div><div class="plan-actions"><button class="small-button" type="button" data-action="copy">Copy plan</button><button class="small-button" type="button" data-action="print">Print / save PDF</button></div></div>
    <div class="plan-summary"><span>${periodText}</span><span>${plan.daysPerWeek} days / week</span><span>Up to ${plan.sessionsPerDay} focus ${plan.sessionsPerDay === 1 ? "session" : "sessions"} / workday</span><span>${totalHours} total focus hours</span></div>
    <div class="plan-weeks">${weeksHTML}</div>
    <p class="plan-note">This is a gentle starting framework based on the time you entered. Edit the steps to suit your challenge and leave room for real life.</p>
  </div>`;
  planOutput.hidden = false;
  planOutput.dataset.planId = plan.id;

  $$(".plan-check", planOutput).forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const row = event.currentTarget.closest(".plan-day");
      if (event.currentTarget.checked) doneDays.add(row.dataset.date);
      else doneDays.delete(row.dataset.date);
      row.classList.toggle("is-done", event.currentTarget.checked);
      saveDoneDays(plan, doneDays);
    });
  });
  $("[data-action='copy']", planOutput).addEventListener("click", () => copyPlan(plan));
  $("[data-action='print']", planOutput).addEventListener("click", () => window.print());

  if (shouldScroll) {
    planOutput.scrollIntoView({ behavior: "smooth", block: "start" });
    $(".generated-plan-head h3", planOutput).setAttribute("tabindex", "-1");
    $(".generated-plan-head h3", planOutput).focus({ preventScroll: true });
  }
}

function planAsText(plan) {
  const lines = [
    `zebpomo plan: ${plan.goal}`,
    `${plan.period === "month" ? "30-day" : "7-day"} plan · ${plan.daysPerWeek} days/week · up to ${plan.sessionsPerDay} focus sessions per workday`,
    ...(plan.aiSummary ? [plan.aiSummary] : []),
    "",
  ];
  plan.days.forEach((day) => {
    lines.push(`${day.dateLabel} — ${day.isWorkday ? day.phase : "Rest day"}`);
    lines.push(`  ${day.action}`);
    if (day.isWorkday) lines.push(`  ${day.sessions} × 25 min focus`);
  });
  lines.push("", "Make room for what matters. · zebpomo");
  return lines.join("\n");
}

async function copyPlan(plan) {
  try {
    await navigator.clipboard.writeText(planAsText(plan));
    announce("Your timetable was copied.");
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = planAsText(plan);
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
    announce("Your timetable was copied.");
  }
}

function getFormStartDate() {
  const input = $("#start-date");
  if (input.value) {
    const [year, month, day] = input.value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date();
}

function readPlannerInput() {
  return {
    goal: $("#goal").value.trim(),
    period: $("input[name='period']:checked").value,
    minutesPerDay: Math.max(25, Math.min(360, Number.parseInt($("#minutes-per-day").value, 10) || 100)),
    daysPerWeek: Number.parseInt($("#days-per-week").value, 10) || 5,
    startDate: getFormStartDate(),
  };
}

function saveAndRenderPlan(plan, message) {
  try { localStorage.setItem(STORAGE.plan, JSON.stringify(plan)); } catch { /* The plan still works for this visit. */ }
  renderPlan(plan, true);
  announce(message);
}

function setAiStatus(message, kind = "") {
  const status = $("#ai-status");
  status.textContent = message;
  status.classList.toggle("is-error", kind === "error");
  status.classList.toggle("is-success", kind === "success");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = readPlannerInput();
  if (!input.goal) {
    $("#goal").focus();
    return;
  }
  saveAndRenderPlan(makePlan(input), "Your quick plan is ready. Start with one small step.");
});

async function generateAiPlan() {
  if (!form.reportValidity()) return;
  const input = readPlannerInput();
  if (!input.goal) {
    $("#goal").focus();
    return;
  }
  const endpoint = String(window.ZEBPOMO_AI_ENDPOINT || "").trim();
  if (!endpoint) {
    setAiStatus("AI planning is not connected yet. Deploy the secure planner service and add its endpoint; the quick plan is ready in the meantime.", "error");
    announce("AI planner setup is still needed. You can use the quick plan below.");
    return;
  }

  const button = $("#generate-ai");
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "Planning your goal… <span aria-hidden=\"true\">✦</span>";
  setAiStatus("Building a plan around your goal, available time, and selected days…");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: input.goal,
        period: input.period,
        minutesPerDay: input.minutesPerDay,
        daysPerWeek: input.daysPerWeek,
        startDate: localDateKey(input.startDate),
      }),
    });
    let body;
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) throw new Error(body.error || "The AI planner couldn’t create a plan right now.");
    const ai = body.plan;
    const plan = makePlan(input);
    if (!ai || !Array.isArray(ai.days) || ai.days.length !== plan.duration) {
      throw new Error("The AI planner returned an incomplete timetable. Please try again.");
    }
    const aiDays = new Map(ai.days.map((day) => [Number(day.dayNumber), day]));
    if (plan.days.some((day) => !aiDays.has(day.dayNumber))) {
      throw new Error("The AI planner returned a timetable with missing days. Please try again.");
    }
    plan.planMode = "ai";
    plan.aiSummary = String(ai.summary || "A tailored plan built around your challenge and weekly rhythm.").trim().slice(0, 360);
    plan.days = plan.days.map((day) => {
      const generated = aiDays.get(day.dayNumber);
      const action = String(generated.action || day.action).trim().slice(0, 260);
      const phase = String(generated.milestone || day.phase).trim().slice(0, 80);
      if (!day.isWorkday) return { ...day, phase, action, sessions: 0 };
      const recommended = Number.parseInt(generated.focusSessions, 10);
      return {
        ...day,
        phase,
        action,
        sessions: Math.max(1, Math.min(day.sessions, Number.isFinite(recommended) ? recommended : day.sessions)),
      };
    });
    plan.plannedSessions = plan.days.reduce((total, day) => total + (day.isWorkday ? day.sessions : 0), 0);
    plan.plannedMinutes = plan.plannedSessions * 25;
    saveAndRenderPlan(plan, "Your AI-personalized plan is ready.");
    setAiStatus("AI plan ready. Edit the steps as you learn what works for you.", "success");
  } catch (error) {
    setAiStatus(error.message || "Couldn’t reach the AI planner. Please try again or use the quick plan.", "error");
    announce(error.message || "The AI planner could not be reached.");
  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
}

function initializePlanner() {
  const today = new Date();
  $("#start-date").value = localDateKey(today);
  if (!String(window.ZEBPOMO_AI_ENDPOINT || "").trim()) {
    setAiStatus("AI planner setup is still needed. Your quick plan works now; AI will be available after the secure service is connected.");
  } else {
    setAiStatus("AI planner connected. Your goal and schedule are sent to the planning service to create your plan.");
  }
  $("#generate-ai").addEventListener("click", generateAiPlan);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.plan) || "null");
    if (saved?.days?.length) renderPlan(saved);
  } catch { /* Ignore an outdated or unavailable saved plan. */ }
}

const TIMER_MODES = {
  focus: { seconds: 25 * 60, caption: "ONE THING AT A TIME", label: "Start focus", color: "#b9a0ff" },
  short: { seconds: 5 * 60, caption: "A LITTLE RESET", label: "Start break", color: "#75ead2" },
  long: { seconds: 15 * 60, caption: "REST & RECHARGE", label: "Start long break", color: "#ffb99e" },
};
let timerState = { mode: "focus", remaining: TIMER_MODES.focus.seconds, completed: 0, running: false };
let timerInterval = null;

function saveTimer() {
  try { localStorage.setItem(STORAGE.timer, JSON.stringify({ mode: timerState.mode, remaining: timerState.remaining, completed: timerState.completed })); } catch { /* Timer remains usable during this visit. */ }
}

function renderTimer() {
  const mode = TIMER_MODES[timerState.mode];
  const minutes = Math.floor(timerState.remaining / 60).toString().padStart(2, "0");
  const seconds = (timerState.remaining % 60).toString().padStart(2, "0");
  $("#timer-display").textContent = `${minutes}:${seconds}`;
  $("#timer-caption").textContent = timerState.running ? "YOU’RE RIGHT WHERE YOU NEED TO BE" : mode.caption;
  $("#timer-start").innerHTML = timerState.running ? "Pause timer <span aria-hidden=\"true\">Ⅱ</span>" : `${mode.label} <span aria-hidden="true">▶</span>`;
  $("#session-count").textContent = timerState.completed;
  const circumference = 2 * Math.PI * 112;
  const progress = timerState.remaining / mode.seconds;
  const ring = $("#timer-progress");
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference * (1 - progress);
  ring.style.stroke = mode.color;
  $$(".mode-button").forEach((button) => {
    const active = button.dataset.mode === timerState.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.title = timerState.running ? `${minutes}:${seconds} · zebpomo` : "zebpomo — Make time for what matters";
}

function pauseTimer() {
  timerState.running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  renderTimer();
  saveTimer();
}

function setTimerMode(mode) {
  pauseTimer();
  timerState.mode = mode;
  timerState.remaining = TIMER_MODES[mode].seconds;
  renderTimer();
  saveTimer();
}

function finishTimer() {
  pauseTimer();
  if (timerState.mode === "focus") {
    timerState.completed += 1;
    const nextMode = timerState.completed % 4 === 0 ? "long" : "short";
    timerState.mode = nextMode;
    timerState.remaining = TIMER_MODES[nextMode].seconds;
    announce(nextMode === "long" ? "Four focus sessions complete. Take a longer reset." : "Focus session complete. Take a short reset.");
  } else {
    timerState.mode = "focus";
    timerState.remaining = TIMER_MODES.focus.seconds;
    announce("Break complete. Ready for another small step?");
  }
  renderTimer();
  saveTimer();
}

function startTimer() {
  if (timerState.running) {
    pauseTimer();
    return;
  }
  timerState.running = true;
  renderTimer();
  timerInterval = setInterval(() => {
    timerState.remaining -= 1;
    if (timerState.remaining <= 0) {
      timerState.remaining = 0;
      finishTimer();
      return;
    }
    renderTimer();
    if (timerState.remaining % 10 === 0) saveTimer();
  }, 1000);
}

function initializeTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.timer) || "null");
    if (saved && TIMER_MODES[saved.mode]) {
      timerState.mode = saved.mode;
      timerState.remaining = Math.max(1, Math.min(TIMER_MODES[saved.mode].seconds, Number(saved.remaining) || TIMER_MODES[saved.mode].seconds));
      timerState.completed = Math.max(0, Number(saved.completed) || 0);
    }
  } catch { /* Use the default focus timer. */ }
  $("#timer-start").addEventListener("click", startTimer);
  $("#timer-reset").addEventListener("click", () => {
    pauseTimer();
    timerState.remaining = TIMER_MODES[timerState.mode].seconds;
    renderTimer();
    saveTimer();
    announce("Timer reset.");
  });
  $("#timer-skip").addEventListener("click", () => {
    setTimerMode(timerState.mode === "focus" ? (timerState.completed > 0 && timerState.completed % 4 === 0 ? "long" : "short") : "focus");
    announce(`Switched to ${timerState.mode === "focus" ? "focus time" : timerState.mode === "long" ? "a long break" : "a short break"}.`);
  });
  $$(".mode-button").forEach((button) => button.addEventListener("click", () => setTimerMode(button.dataset.mode)));
  renderTimer();
}

function initializeMenu() {
  const toggle = $(".menu-toggle");
  const nav = $(".main-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  $$(".main-nav a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
  }));
}

$("#year").textContent = new Date().getFullYear();
initializePlanner();
initializeTimer();
initializeMenu();
