/** Shared compact date input: MMDDYY typing, mm/dd/yy display, calendar picker. */

const COMPACT_DATE_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">` +
  `<rect x="3" y="4" width="18" height="18" rx="2"/>` +
  `<path d="M16 2v4M8 2v4M3 10h18"/>` +
  `</svg>`;

function normalizeCompactDateInputValue(value) {
  return parseDisplayDateToYmd(value) ?? "";
}

function updateCompactDateInputState(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, 6);
  const ymd = normalizeCompactDateInputValue(input.value);
  input.maxLength = /[./]/.test(input.value) ? getDateFormatDisplayMaxLength() : 6;
  input.classList.toggle("shipment-form-input--empty", digits.length === 0 && !ymd);
  input.classList.toggle("is-invalid", digits.length === 6 && !ymd);
  input.dataset.normalizedValue = ymd;
}

function commitCompactDateInputValue(input, onCommit) {
  const trimmed = String(input.value ?? "").trim();
  if (!trimmed) {
    input.value = "";
    input.maxLength = 6;
    input.classList.remove("is-invalid");
    input.dataset.normalizedValue = "";
    onCommit?.(null);
    return;
  }

  const ymd = normalizeCompactDateInputValue(trimmed);
  if (ymd) {
    input.value = formatDateForDisplay(ymd);
    input.maxLength = getDateFormatDisplayMaxLength();
    input.classList.remove("is-invalid");
    input.dataset.normalizedValue = ymd;
    onCommit?.(ymd);
    return;
  }

  const digits = trimmed.replace(/\D/g, "").slice(0, 6);
  if (digits.length === 6) {
    input.value = digits;
    input.maxLength = 6;
    input.classList.add("is-invalid");
    input.dataset.normalizedValue = "";
    onCommit?.(null);
    return;
  }

  if (digits.length > 0) {
    input.value = "";
    input.maxLength = 6;
    input.classList.remove("is-invalid");
    input.dataset.normalizedValue = "";
    onCommit?.(null);
    return;
  }

  updateCompactDateInputState(input);
}

function handleCompactDateInput(input, onCommit) {
  const digits = input.value.replace(/\D/g, "").slice(0, 6);
  if (!digits) {
    input.value = "";
    input.maxLength = 6;
    input.classList.remove("is-invalid");
    input.dataset.normalizedValue = "";
    onCommit?.(null);
    return;
  }
  if (digits.length === 6) {
    const ymd = parseCompactDateDigits(digits);
    if (ymd) {
      input.value = formatDateForDisplay(ymd);
      input.maxLength = getDateFormatDisplayMaxLength();
      input.classList.remove("is-invalid");
      input.dataset.normalizedValue = ymd;
      onCommit?.(ymd);
      return;
    }
    input.value = digits;
    input.maxLength = 6;
    input.classList.add("is-invalid");
    input.dataset.normalizedValue = "";
    onCommit?.(null);
    return;
  }
  input.value = digits;
  input.maxLength = 6;
  input.classList.remove("is-invalid");
  input.dataset.normalizedValue = "";
  onCommit?.(null);
}

function readCompactDateInputValue(input) {
  if (!input) return "";
  return input.dataset.normalizedValue ?? normalizeCompactDateInputValue(input.value) ?? "";
}

function isCompactDateInputCommitReady(input) {
  const digits = String(input?.value ?? "").replace(/\D/g, "");
  if (!digits) return true;
  return Boolean(readCompactDateInputValue(input));
}

function createCompactDateInput({
  initialYmd = "",
  readOnly = false,
  onCommit,
  inputClassName = "",
  placeholder = "MMDDYY",
  tabIndex,
  onNavigateWheel,
  onKeydown,
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "compact-date-input-wrap";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.className = ["compact-date-input", inputClassName].filter(Boolean).join(" ");
  input.value = initialYmd ? formatDateForDisplay(initialYmd) : "";
  updateCompactDateInputState(input);
  if (tabIndex != null) input.tabIndex = tabIndex;
  if (readOnly) input.readOnly = true;

  const picker = document.createElement("input");
  picker.type = "date";
  picker.className = "compact-date-picker-hidden";
  picker.tabIndex = -1;
  picker.setAttribute("aria-hidden", "true");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "compact-date-picker-btn";
  btn.innerHTML = COMPACT_DATE_ICON_SVG;
  btn.setAttribute("aria-label", "Open calendar");
  btn.hidden = readOnly;

  input.addEventListener("input", () => handleCompactDateInput(input, onCommit));
  input.addEventListener("blur", () => commitCompactDateInputValue(input, onCommit));

  btn.addEventListener("mousedown", e => e.preventDefault());

  btn.addEventListener("click", () => {
    const ymd = normalizeCompactDateInputValue(input.value);
    if (ymd) picker.value = ymd;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  });

  picker.addEventListener("change", () => {
    if (!picker.value) return;
    input.value = formatDateForDisplay(picker.value);
    updateCompactDateInputState(input);
    onCommit?.(picker.value);
  });

  input.addEventListener("keydown", e => {
    if (onNavigateWheel && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      onNavigateWheel(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    onKeydown?.(e, input);
  });

  wrap.appendChild(input);
  if (!readOnly) wrap.appendChild(btn);
  wrap.appendChild(picker);
  return { wrap, input, picker, btn };
}
