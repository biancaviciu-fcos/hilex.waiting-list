const form = document.querySelector("#waitlistForm");
const status = form ? document.querySelector("#formStatus") : null;
const submitButton = form ? form.querySelector("button") : null;
const shell = document.querySelector(".page-shell");

function setStatus(message, type) {
  status.textContent = message;
  status.className = `form-status ${type || ""}`.trim();
}

if (form) {
  form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("", "");
  submitButton.disabled = true;
  submitButton.textContent = "Se trimite...";

  const formData = new FormData(form);
  const payload = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    marketingConsent: formData.get("marketingConsent") === "on"
  };

  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Inscrierea nu a putut fi salvata.");
    }

    setStatus(data.message, "success");
    sessionStorage.setItem("hilexWaitlistName", String(payload.firstName || ""));
    form.reset();
    window.location.href = "/thank-you.html";
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ma inscriu pe lista de asteptare";
  }
  });
}

const launchDate = new Date(shell.dataset.launchDate);
const fields = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds")
};

const thankYouName = document.querySelector("#thankYouName");
if (thankYouName) {
  const storedName = sessionStorage.getItem("hilexWaitlistName");
  if (storedName) {
    thankYouName.textContent = `, ${storedName}`;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function tickCountdown() {
  const diff = Math.max(0, launchDate.getTime() - Date.now());
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  fields.days.textContent = pad(days);
  fields.hours.textContent = pad(hours);
  fields.minutes.textContent = pad(minutes);
  fields.seconds.textContent = pad(remainder);
}

if (Object.values(fields).every(Boolean)) {
  tickCountdown();
  setInterval(tickCountdown, 1000);
}
