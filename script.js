
/* =========================================================
   🌍 JET LAG PLANNER — CLEAN FIXED BUILD
   PART 1/3 — CORE + AUTOCOMPLETE + TIME ENGINE
========================================================= */


/* -------------------------
   GLOBAL STATE
------------------------- */

let __isRunning = false;


/* -------------------------
   CITY DATABASE (USED FOR AUTOCOMPLETE)
------------------------- */

const CITY_DATA = [
    { name: "New York", tz: "America/New_York" },
    { name: "Los Angeles", tz: "America/Los_Angeles" },
    { name: "London", tz: "Europe/London" },
    { name: "Tokyo", tz: "Asia/Tokyo" },
    { name: "Hong Kong", tz: "Asia/Hong_Kong" },
    { name: "Sydney", tz: "Australia/Sydney" },
    { name: "Paris", tz: "Europe/Paris" },
    { name: "Dubai", tz: "Asia/Dubai" },
    { name: "Singapore", tz: "Asia/Singapore" }
];


/* -------------------------
   INPUT NORMALIZER
------------------------- */

function normalizeInput(input) {
    const raw = input.trim().toLowerCase();

    const aliases = {
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

    if (aliases[raw]) return aliases[raw];

    for (const city of CITY_DATA) {
        if (city.name.toLowerCase().includes(raw)) {
            return city.tz;
        }
    }

    return "UTC";
}


/* -------------------------
   TIMEZONE OFFSET (FIXED RELIABLE METHOD)
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

        return (local - utc) / 3600000;

    } catch (e) {
        console.warn("Timezone error:", timeZone);
        return 0;
    }
}


/* -------------------------
   TIME DIFFERENCE ENGINE
------------------------- */

function diffHours(fromTZ, toTZ) {
    return getOffsetHours(toTZ) - getOffsetHours(fromTZ);
}


/* -------------------------
   AUTOCOMPLETE SYSTEM
------------------------- */

function showDropdown(input, dropdown, list) {
    dropdown.innerHTML = "";

    if (!list.length) {
        dropdown.style.display = "none";
        return;
    }

    list.slice(0, 6).forEach(item => {
        const div = document.createElement("div");
        div.textContent = item.name;

        div.onclick = () => {
            input.value = item.name;
            dropdown.style.display = "none";
        };

        dropdown.appendChild(div);
    });

    dropdown.style.display = "block";
}


/* -------------------------
   AUTOCOMPLETE SETUP
------------------------- */

function setupAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) return;

    input.addEventListener("input", () => {
        const val = input.value.toLowerCase().trim();

        if (!val) {
            dropdown.style.display = "none";
            return;
        }

        const matches = CITY_DATA.filter(c =>
            c.name.toLowerCase().includes(val)
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

    let h = Math.floor(mins / 60);
    const m = mins % 60;

    const ampm = h >= 12 ? "PM" : "AM";

    h = h % 12;
    if (h === 0) h = 12;

    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* -------------------------
   ADAPTATION CURVE (SMOOTH PROGRESSION)
------------------------- */

function adaptationCurve(day, totalDays) {
    return Math.pow(day / totalDays, 1.3);
}


/* -------------------------
   INIT AUTOCOMPLETE
------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    setupAutocomplete("fromInput", "fromList");
    setupAutocomplete("toInput", "toList");
});

/* =========================================================
   🌍 JET LAG PLANNER — CLEAN FIXED BUILD
   PART 2/3 — CALCULATION ENGINE
========================================================= */


/* -------------------------
   FLIGHT IMPACT MODEL
------------------------- */

function flightFactor(hours) {
    return 1 + Math.log10(hours + 1) * 0.12;
}


/* -------------------------
   SLEEP PERSONALIZATION
------------------------- */

function sleepPreferenceFactor(userSleepMinutes) {
    const baseline = 1380; // 23:00

    const diff = (userSleepMinutes - baseline) / 240;

    return 1 + diff * 0.08;
}


/* -------------------------
   RECOVERY ESTIMATION
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

        /* ---------------- UI ELEMENTS ---------------- */

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

        /* ---------------- ADJUSTED DIFF ---------------- */

        const adjustedDiff =
            baseDiff *
            flightFactor(absDiff) *
            sleepPreferenceFactor(userSleepMinutes);

        /* ---------------- SUMMARY UI ---------------- */

        document.getElementById("timeDifference").innerText =
            Math.round(adjustedDiff) + " hrs";

        document.getElementById("risk").innerText =
            absDiff > 10 ? "Very High" :
            absDiff > 6 ? "High" :
            absDiff > 3 ? "Medium" : "Low";

        const rec = recoveryEstimate(baseDiff);

        document.getElementById("recovery").innerText =
            `${rec.min}–${rec.max} days`;

        /* ---------------- PREP SCORE ---------------- */

        const prep = clamp(100 - absDiff * 7, 5, 100);

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* ---------------- DAILY SLEEP PLAN ---------------- */

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
            <li>Use morning sunlight to reset body clock</li>
            <li>Avoid caffeine late in destination day</li>
            <li>Keep naps short (20–30 min max)</li>
        `;

    } catch (err) {
        console.error("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}

/* =========================================================
   🌍 JET LAG PLANNER — CLEAN FIXED BUILD
   PART 3/3 — ARRIVAL + POLISH + FINAL LOGIC
========================================================= */


/* -------------------------
   PREP SCORE MODEL (FINAL)
------------------------- */

function computePrepScore(absDiff, daysUntilFlight) {
    let score = 100 - absDiff * 6;

    // more time = better prep
    score += daysUntilFlight * 4;

    return clamp(score, 5, 100);
}


/* -------------------------
   ARRIVAL STRATEGY ENGINE
------------------------- */

function arrivalPlan(diffHours) {

    const eastward = diffHours > 0;
    const d = Math.abs(diffHours);

    if (d <= 3) {
        return [
            "Follow normal sleep schedule",
            "Get morning sunlight",
            "Avoid long naps"
        ];
    }

    if (eastward) {
        return [
            "Get strong morning sunlight immediately",
            "Stay awake until local night",
            "Avoid caffeine after midday",
            "Use short naps only (20–30 min)"
        ];
    }

    return [
        "Get afternoon sunlight exposure",
        "Stay active into evening",
        "Avoid sleeping too early",
        "Adjust bedtime gradually"
    ];
}


/* -------------------------
   MAIN CALCULATE (FINAL WRAPPER)
   - reuses Part 2 logic but adds final polish
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

        /* ---------------- SUMMARY UI ---------------- */

        document.getElementById("timeDifference").innerText =
            Math.round(adjustedDiff) + " hrs";

        document.getElementById("risk").innerText =
            absDiff > 10 ? "Very High" :
            absDiff > 6 ? "High" :
            absDiff > 3 ? "Medium" : "Low";

        const rec = recoveryEstimate(baseDiff);

        document.getElementById("recovery").innerText =
            `${rec.min}–${rec.max} days`;

        /* ---------------- PREP SCORE ---------------- */

        const prep = computePrepScore(absDiff, days);

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* ---------------- DAILY PLAN ---------------- */

        const scheduleEl = document.getElementById("schedule");
        scheduleEl.innerHTML = "";

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
            "Drink water regularly during flight";

        /* ---------------- ARRIVAL PLAN ---------------- */

        const arrival = arrivalPlan(baseDiff);

        document.getElementById("arrivalCard").innerHTML =
            arrival.map(a => `<p>• ${a}</p>`).join("");

        /* ---------------- TIPS ---------------- */

        document.getElementById("tips").innerHTML = `
            <li>Shift sleep gradually before travel</li>
            <li>Use light exposure to reset circadian rhythm</li>
            <li>Avoid caffeine late in destination daytime</li>
            <li>Keep naps short (20–30 minutes max)</li>
        `;

    } catch (err) {
        console.error("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}