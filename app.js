const ADS_CONFIG = {
  waitSeconds: 5,
  enabled: true,
};

const MODES = {
  focus: "focus",
  shortBreak: "shortBreak",
  longBreak: "longBreak",
};

const MODE_LABELS = {
  [MODES.focus]: "專注",
  [MODES.shortBreak]: "短休息",
  [MODES.longBreak]: "長休息",
};

const NEXT_LABELS = {
  [MODES.focus]: "準備專注",
  [MODES.shortBreak]: "準備短休息",
  [MODES.longBreak]: "準備長休息",
};

const state = {
  mode: MODES.focus,
  round: 1,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  running: false,
  timerId: null,
  adTimerId: null,
};

const elements = {
  timeDisplay: document.querySelector("#timeDisplay"),
  modeLabel: document.querySelector("#modeLabel"),
  roundLabel: document.querySelector("#roundLabel"),
  progressBar: document.querySelector("#progressBar"),
  startPauseButton: document.querySelector("#startPauseButton"),
  resetButton: document.querySelector("#resetButton"),
  skipButton: document.querySelector("#skipButton"),
  focusInput: document.querySelector("#focusInput"),
  shortBreakInput: document.querySelector("#shortBreakInput"),
  longBreakInput: document.querySelector("#longBreakInput"),
  longBreakEveryInput: document.querySelector("#longBreakEveryInput"),
  adDialog: document.querySelector("#adDialog"),
  adSlot: document.querySelector("#adSlot"),
  nextModeLabel: document.querySelector("#nextModeLabel"),
  adCountdown: document.querySelector("#adCountdown"),
  continueButton: document.querySelector("#continueButton"),
  adPlaceholder: document.querySelector("#adPlaceholder"),
};

function getSettings() {
  return {
    focus: readMinutes(elements.focusInput, 25),
    shortBreak: readMinutes(elements.shortBreakInput, 5),
    longBreak: readMinutes(elements.longBreakInput, 15),
    longBreakEvery: Math.max(2, Number.parseInt(elements.longBreakEveryInput.value, 10) || 4),
  };
}

function readMinutes(input, fallback) {
  const value = Number.parseInt(input.value, 10);
  const min = Number.parseInt(input.min, 10) || 1;
  const max = Number.parseInt(input.max, 10) || 180;
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

function secondsForMode(mode) {
  const settings = getSettings();

  if (mode === MODES.shortBreak) return settings.shortBreak * 60;
  if (mode === MODES.longBreak) return settings.longBreak * 60;
  return settings.focus * 60;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function render() {
  const elapsed = state.totalSeconds - state.remainingSeconds;
  const progress = state.totalSeconds > 0 ? (elapsed / state.totalSeconds) * 100 : 0;
  const resting = state.mode !== MODES.focus;

  elements.timeDisplay.textContent = formatTime(state.remainingSeconds);
  elements.modeLabel.textContent = MODE_LABELS[state.mode];
  elements.modeLabel.classList.toggle("resting", resting);
  elements.roundLabel.textContent = `第 ${state.round} 輪`;
  elements.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  elements.progressBar.classList.toggle("resting", resting);
  elements.startPauseButton.textContent = state.running ? "暫停" : "開始";
  document.title = `${formatTime(state.remainingSeconds)} | ${MODE_LABELS[state.mode]}`;
}

function start() {
  if (state.running) return;

  state.running = true;
  state.timerId = window.setInterval(tick, 1000);
  render();
}

function pause() {
  state.running = false;
  window.clearInterval(state.timerId);
  state.timerId = null;
  render();
}

function tick() {
  if (state.remainingSeconds <= 1) {
    state.remainingSeconds = 0;
    pause();
    completeCurrentMode();
    return;
  }

  state.remainingSeconds -= 1;
  render();
}

function resetCurrentMode() {
  pause();
  state.totalSeconds = secondsForMode(state.mode);
  state.remainingSeconds = state.totalSeconds;
  render();
}

function completeCurrentMode() {
  const nextMode = getNextMode();

  if (state.mode !== MODES.focus) {
    state.round += 1;
  }

  state.mode = nextMode;
  state.totalSeconds = secondsForMode(nextMode);
  state.remainingSeconds = state.totalSeconds;
  render();

  if (ADS_CONFIG.enabled) {
    showAdBeforeContinue(nextMode);
  }
}

function getNextMode() {
  if (state.mode !== MODES.focus) return MODES.focus;

  const settings = getSettings();
  return state.round % settings.longBreakEvery === 0 ? MODES.longBreak : MODES.shortBreak;
}

function showAdBeforeContinue(nextMode) {
  elements.nextModeLabel.textContent = NEXT_LABELS[nextMode];
  elements.continueButton.disabled = true;
  elements.adPlaceholder.hidden = false;

  let secondsLeft = ADS_CONFIG.waitSeconds;
  elements.adCountdown.textContent = `${secondsLeft} 秒後可繼續`;

  elements.adDialog.showModal();
  requestAd();

  window.clearInterval(state.adTimerId);
  state.adTimerId = window.setInterval(() => {
    secondsLeft -= 1;
    elements.adCountdown.textContent =
      secondsLeft > 0 ? `${secondsLeft} 秒後可繼續` : "可以繼續";

    if (secondsLeft <= 0) {
      window.clearInterval(state.adTimerId);
      state.adTimerId = null;
      elements.continueButton.disabled = false;
      elements.continueButton.focus();
    }
  }, 1000);
}

function requestAd() {
  const adUnit = document.createElement("ins");

  adUnit.className = "adsbygoogle";
  adUnit.style.display = "block";
  adUnit.dataset.adClient = "ca-pub-XXXXXXXXXXXXXXXX";
  adUnit.dataset.adSlot = "0000000000";
  adUnit.dataset.adFormat = "auto";
  adUnit.dataset.fullWidthResponsive = "true";

  elements.adSlot.querySelector(".adsbygoogle")?.remove();
  elements.adSlot.prepend(adUnit);

  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
    elements.adPlaceholder.hidden = true;
  } catch (error) {
    elements.adPlaceholder.hidden = false;
  }
}

function closeAdAndStartNextMode() {
  window.clearInterval(state.adTimerId);
  state.adTimerId = null;
  elements.adDialog.close();
  start();
}

function skip() {
  pause();
  completeCurrentMode();
}

function applySettingsToIdleTimer() {
  if (state.running) return;

  state.totalSeconds = secondsForMode(state.mode);
  state.remainingSeconds = Math.min(state.remainingSeconds, state.totalSeconds);

  if (state.remainingSeconds === 0 || state.remainingSeconds === state.totalSeconds) {
    state.remainingSeconds = state.totalSeconds;
  }

  render();
}

elements.startPauseButton.addEventListener("click", () => {
  if (state.running) {
    pause();
  } else {
    start();
  }
});

elements.resetButton.addEventListener("click", resetCurrentMode);
elements.skipButton.addEventListener("click", skip);
elements.continueButton.addEventListener("click", closeAdAndStartNextMode);

[
  elements.focusInput,
  elements.shortBreakInput,
  elements.longBreakInput,
  elements.longBreakEveryInput,
].forEach((input) => {
  input.addEventListener("change", () => {
    input.value = readMinutes(input, Number.parseInt(input.defaultValue, 10));
    applySettingsToIdleTimer();
  });
});

elements.adDialog.addEventListener("cancel", (event) => {
  if (elements.continueButton.disabled) {
    event.preventDefault();
  }
});

render();
