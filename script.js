/* =========================================================
   🌍 JET LAG PLANNER — FINAL CLEAN BUILD
   PART 1/3 — CORE ENGINE + AUTOCOMPLETE + TIME SYSTEM
========================================================= */


/* -------------------------
   GLOBAL STATE
------------------------- */

let __isRunning = false;


/* -------------------------
   CITY DATABASE
------------------------- */

const CITY_TIMEZONES = [
    { name: "New York", tz: "America/New_York" },
    { name: "Los Angeles", tz: "America/Los_Angeles" },
    { name: "London", tz: "Europe/London" },
    { name: "Tokyo", tz: "Asia/Tokyo" },
    { name: "Hong Kong", tz: "Asia/Hong_Kong" },
    { name: "Sydney", tz: "Australia/Sydney" },
    { name: "Dubai", tz: "Asia/Dubai" },
    { name: "Paris", tz: "Europe/Paris" },
    { name: "Singapore", tz: "Asia/Singapore" }
];


/* -------------------------
   INPUT NORMALIZATION
------------------------- */

function normalizeInput(input) {
    const raw = input.trim().toLowerCase();

    const alias = {
        "ny": "America/New_York",
        "new york": "America/New_York",
        "la": "America/Los_Angeles",
        "los angeles": "America/Los_Angeles",
        "london": "Europe/London",
        "tokyo": "Asia/Tokyo",
        "hong kong": "Asia/Hong_Kong",
        "hk": "Asia/Hong_Kong",
        "sydney": "Australia/Sydney"
    };

    if (alias[raw]) return alias[raw];

    for (const c of CITY_TIMEZONES) {
        if (c.name.toLowerCase().includes(raw)) return c.tz;
    }

    return "UTC";
}


/* -------------------------
   REAL TIMEZONE OFFSET (FIXED)
------------------------- */

function getOffsetHours(timeZone) {
    try {
        const now = new Date();

        const utc = new Date(
            now.toLocaleString("en-US", { timeZone: "UTC" })
        );

        const local = new Date(
            now.toLocaleString("en-US", { timeZone })
        );

        return (local - utc) / (1000 * 60 * 60);

    } catch (e) {
        console.warn("Timezone error:", timeZone);
        return 0;
    }
}


/* -------------------------
   TIME DIFFERENCE (DIRECTIONAL)
------------------------- */

function diffHours(fromTZ, toTZ) {
    return getOffsetHours(toTZ) - getOffsetHours(fromTZ);
}


/* -------------------------
   AUTOCOMPLETE ENGINE
------------------------- */

function showDropdown(inputEl, dropdownEl, items) {
    dropdownEl.innerHTML = "";

    if (!items.length) {
        dropdownEl.style.display = "none";
        return;
    }

    items.slice(0, 6).forEach(item => {
        const div = document.createElement("div");
        div.textContent = item.name;

        div.onclick = () => {
            inputEl.value = item.name;
            dropdownEl.style.display = "none";
        };

        dropdownEl.appendChild(div);
    });

    dropdownEl.style.display = "block";
}


/* -------------------------
   AUTOCOMPLETE SETUP
------------------------- */

function setupAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) return;

    input.addEventListener("input", () => {
        const value = input.value.toLowerCase().trim();

        if (!value) {
            dropdown.style.display = "none";
            return;
        }

        const matches = CITY_TIMEZONES.filter(c =>
            c.name.toLowerCase().includes(value)
        );

        showDropdown(input, dropdown, matches);
    });

    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
}


/* -------------------------
   UTILS
------------------------- */

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function formatMinutes(mins) {
    mins = Math.round(mins);
    mins = ((mins % 1440) + 1440) % 1440;

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


/* -------------------------
   ADAPTATION CURVE (REALISTIC BASE)
------------------------- */

function adaptationCurve(day, totalDays) {
    return Math.pow(day / totalDays, 1.25);
}


/* -------------------------
   INIT
------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    setupAutocomplete("fromInput", "fromList");
    setupAutocomplete("toInput", "toList");
});
/* =========================================================
   🌍 JET LAG PLANNER — FINAL CLEAN BUILD
   PART 2/3 — CALCULATION ENGINE
========================================================= */


/* -------------------------
   SIMPLE MODEL HELPERS
------------------------- */

function flightFactor(hours) {
    // mild fatigue increase (NOT linear exaggeration)
    return 1 + Math.log10(hours + 1) * 0.12;
}


/* -------------------------
   SLEEP PERSONALIZATION (REPLACES CHRONOTYPE)
------------------------- */

function sleepPreferenceFactor(userSleepMinutes) {
    // baseline = 23:00 (1380 min)
    const baseline = 1380;

    // normalize difference (-1 to +1 range approx)
    const diff = (userSleepMinutes - baseline) / 240;

    return 1 + diff * 0.08;
}


/* -------------------------
   RECOVERY MODEL (REALISTIC HEURISTIC)
------------------------- */

function recoveryEstimate(diffHours) {
    const d = Math.abs(diffHours);

    if (d <= 3) return { min: 1, max: 2 };
    if (d <= 6) return { min: 2, max: 4 };
    if (d <= 9) return { min: 3, max: 6 };
    return { min: 5, max: 8 };
}


/* -------------------------
   MAIN CALCULATE FUNCTION
------------------------- */

function calculate() {

    if (__isRunning) return;
    __isRunning = true;

    try {

        /* ---------------- UI ---------------- */

        const scheduleEl = document.getElementById("schedule");
        const tipsEl = document.getElementById("tips");

        if (!scheduleEl || !tipsEl) {
            alert("Missing UI elements");
            return;
        }

        scheduleEl.innerHTML = "";
        tipsEl.innerHTML = "";

        /* ---------------- INPUTS ---------------- */

        const fromRaw = document.getElementById("fromInput")?.value || "";
        const toRaw = document.getElementById("toInput")?.value || "";

        const days = clamp(
            Number(document.getElementById("days")?.value || 3),
            1,
            14
        );

        const flightTime = document.getElementById("flightTime")?.value;

        /* NEW: sleep input (replaces chronotype) */
        const sleepTime =
            document.getElementById("sleepTime")?.value || "23:00";

        const [h, m] = sleepTime.split(":").map(Number);
        const userSleepMinutes = h * 60 + m;

        if (!fromRaw || !toRaw) {
            alert("Please enter origin and destination");
            return;
        }

        /* ---------------- TIMEZONE ---------------- */

        const from = normalizeInput(fromRaw);
        const to = normalizeInput(toRaw);

        const baseDiff = diffHours(from, to); // directional
        const absDiff = Math.abs(baseDiff);

        /* ---------------- ADJUSTED MODEL ---------------- */

        const adjustedDiff =
            baseDiff *
            flightFactor(absDiff) *
            sleepPreferenceFactor(userSleepMinutes);

        /* ---------------- UI OUTPUTS ---------------- */

        document.getElementById("timeDifference").innerText =
            Math.round(adjustedDiff) + " hrs";

        document.getElementById("risk").innerText =
            absDiff > 10 ? "Very High" :
            absDiff > 6 ? "High" :
            absDiff > 3 ? "Medium" : "Low";

        const rec = recoveryEstimate(baseDiff);

        document.getElementById("recovery").innerText =
            `${rec.min}–${rec.max} days`;

        const prep = clamp(100 - absDiff * 7, 5, 100);

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* ---------------- SLEEP SCHEDULE ---------------- */

        const baseSleep = 23 * 60;
        const baseWake = 7 * 60;

        for (let i = 0; i < days; i++) {

            const progress = adaptationCurve(i, days);

            const shift = adjustedDiff * progress;

            const sleep = Math.round(baseSleep + shift * 60);
            const wake = Math.round(baseWake + shift * 60);

            scheduleEl.innerHTML += `
                <div class="day-card">
                    <h3>Day ${i + 1}</h3>
                    <p>😴 Sleep: ${formatMinutes(sleep)}</p>
                    <p>⏰ Wake: ${formatMinutes(wake)}</p>
                    <p>☀️ Light: ${formatMinutes(wake + 60)}</p>
                    <p>☕ No caffeine after ${formatMinutes(sleep - 300)}</p>
                </div>
            `;
        }

        /* ---------------- FLIGHT INFO ---------------- */

        document.getElementById("departureTime").innerText =
            flightTime || "--";

        document.getElementById("planeSleep").innerText =
            baseDiff > 0
                ? "Sleep earlier on flight (eastward)"
                : "Sleep mid-flight (westward)";

        document.getElementById("flightCoffee").innerText =
            "No caffeine 6–8h before flight";

        document.getElementById("hydration").innerText =
            "Drink water regularly";

        /* ---------------- TIPS ---------------- */

        tipsEl.innerHTML = `
            <li>Shift sleep gradually before travel</li>
            <li>Use morning light exposure to reset rhythm</li>
            <li>Avoid caffeine late in destination daytime</li>
        `;

    } catch (err) {
        console.error("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}
/* =========================================================
   🌍 JET LAG PLANNER — FINAL CLEAN BUILD
   PART 3/3 — UX POLISH + ARRIVAL + FINAL MODEL
========================================================= */


/* -------------------------
   PREP SCORE (IMPROVED MODEL)
------------------------- */

function computePrepScore(absDiff, daysUntilFlight) {

    // harder jet lag = lower prep
    let score = 100 - absDiff * 6;

    // more prep time = better readiness
    score += daysUntilFlight * 4;

    return clamp(score, 5, 100);
}


/* -------------------------
   ARRIVAL STRATEGY ENGINE
------------------------- */

function arrivalPlan(diffHours) {

    const eastward = diffHours > 0;

    if (Math.abs(diffHours) <= 3) {
        return [
            "Light exposure in morning",
            "Normal sleep schedule adjustment",
            "Avoid long naps"
        ];
    }

    if (eastward) {
        return [
            "Get strong morning sunlight",
            "Stay awake until local night",
            "Avoid caffeine after midday",
            "Use short naps only (20–30 min)"
        ];
    }

    return [
        "Get afternoon sunlight",
        "Sleep slightly later than usual",
        "Avoid early bedtime",
        "Stay active during evening"
    ];
}


/* -------------------------
   MAIN FUNCTION (EXTENSIONS ONLY)
   - this assumes Part 2 already ran logic
------------------------- */

function calculate() {

    if (__isRunning) return;
    __isRunning = true;

    try {

        /* ---------------- INPUTS ---------------- */

        const fromRaw = document.getElementById("fromInput")?.value || "";
        const toRaw = document.getElementById("toInput")?.value || "";

        const days = clamp(
            Number(document.getElementById("days")?.value || 3),
            1,
            14
        );

        const daysUntilFlight = days;

        const flightTime = document.getElementById("flightTime")?.value;

        const sleepTime =
            document.getElementById("sleepTime")?.value || "23:00";

        const [h, m] = sleepTime.split(":").map(Number);
        const userSleepMinutes = h * 60 + m;

        if (!fromRaw || !toRaw) {
            alert("Please enter origin and destination");
            return;
        }

        /* ---------------- TIMEZONE ---------------- */

        const from = normalizeInput(fromRaw);
        const to = normalizeInput(toRaw);

        const baseDiff = diffHours(from, to);
        const absDiff = Math.abs(baseDiff);

        const adjustedDiff =
            baseDiff *
            flightFactor(absDiff) *
            sleepPreferenceFactor(userSleepMinutes);

        /* ---------------- UI UPDATES ---------------- */

        document.getElementById("timeDifference").innerText =
            Math.round(adjustedDiff) + " hrs";

        document.getElementById("risk").innerText =
            absDiff > 10 ? "Very High" :
            absDiff > 6 ? "High" :
            absDiff > 3 ? "Medium" : "Low";

        const recovery = recoveryEstimate(baseDiff);

        document.getElementById("recovery").innerText =
            `${recovery.min}–${recovery.max} days`;

        /* ---------------- PREP SCORE ---------------- */

        const prep = computePrepScore(absDiff, daysUntilFlight);

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* ---------------- FLIGHT INFO ---------------- */

        document.getElementById("departureTime").innerText =
            flightTime || "--";

        document.getElementById("planeSleep").innerText =
            baseDiff > 0
                ? "Sleep earlier on flight (eastward)"
                : "Sleep mid-flight (westward)";

        document.getElementById("flightCoffee").innerText =
            "No caffeine 6–8h before flight";

        document.getElementById("hydration").innerText =
            "Drink water regularly during flight";

        /* ---------------- ARRIVAL PLAN ---------------- */

        const arrival = arrivalPlan(baseDiff);

        document.getElementById("arrivalCard").innerHTML =
            arrival.map(a => `<p>• ${a}</p>`).join("");

        /* ---------------- TIPS ---------------- */

        const tips = [
            "Shift sleep schedule gradually before travel",
            "Use light exposure strategically to reset circadian rhythm",
            "Avoid caffeine late in destination daytime",
            "Keep naps short (20–30 min max)"
        ];

        document.getElementById("tips").innerHTML =
            tips.map(t => `<li>${t}</li>`).join("");

    } catch (err) {
        console.error("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}