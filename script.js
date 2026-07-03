
/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — PART 1/3
   CORE + UNIVERSAL TIMEZONE ENGINE
========================================================= */


/* -------------------------
   GLOBAL STATE LOCK
------------------------- */

let __isRunning = false;


/* -------------------------
   UNIVERSAL TIMEZONE ENGINE (NO HARD CODED LISTS)
------------------------- */

function getUTCOffset(timeZone) {

    try {

        const now = new Date();

        // get current UTC time baseline
        const utc = now.getTime();

        // convert "now" into target timezone wall time
        const tzString = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }).format(now);

        // expected format: MM/DD/YYYY, HH:MM:SS
        const [datePart, timePart] = tzString.split(", ");

        const [month, day, year] = datePart.split("/").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);

        const tzTime = Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            second
        );

        return (tzTime - utc) / 3600000;

    } catch (e) {
        console.warn("Timezone parse error:", timeZone, e);
        return 0;
    }
}


/* -------------------------
   TIME DIFFERENCE (GLOBAL)
------------------------- */

function diffHours(from, to) {
    return getUTCOffset(to) - getUTCOffset(from);
}


/* -------------------------
   JET LAG CORE MODEL
------------------------- */

function flightFactor(h) {
    if (h < 3) return 0.85;
    if (h < 6) return 1;
    if (h < 10) return 1.2;
    return 1.4;
}

function chronotypeFactor(type) {
    if (type === "morning") return 0.9;
    if (type === "night") return 1.2;
    return 1;
}

function recovery(diff) {
    const abs = Math.abs(diff);
    const base = abs * 0.6;

    return {
        min: Math.max(1, Math.round(base * 0.7)),
        max: Math.round(base * 1.3)
    };
}

function curve(i, n) {
    const x = i / (n - 1 || 1);
    return 1 - Math.exp(-2.5 * x);
}


/* -------------------------
   TIME FORMATTER
------------------------- */

function format(mins) {

    mins = ((mins % 1440) + 1440) % 1440;

    let h = Math.floor(mins / 60);
    let m = mins % 60;

    let ampm = h >= 12 ? "PM" : "AM";

    h = h % 12 || 12;

    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — PART 2/3
   CALCULATION ENGINE (CORE BRAIN)
========================================================= */


/* -------------------------
   MAIN CALCULATE FUNCTION
------------------------- */

function calculate() {

    console.log("Generate clicked");

    if (__isRunning) return;
    __isRunning = true;

    try {

        /* -------------------------
           GET UI ELEMENTS
        ------------------------- */

        const schedule = document.getElementById("schedule");
        const tips = document.getElementById("tips");
        const timeline = document.getElementById("timeline");

        if (!schedule || !tips || !timeline) {
            alert("Missing UI containers");
            return;
        }

        schedule.innerHTML = "";
        tips.innerHTML = "";
        timeline.innerHTML = "";

        /* -------------------------
           INPUTS (SAFE)
        ------------------------- */

        const from = document.getElementById("fromInput")?.value;
        const to = document.getElementById("toInput")?.value;

        let days = Number(document.getElementById("days")?.value);
        if (!Number.isFinite(days) || days < 1) days = 3;
        if (days > 14) days = 14;

        const flightTime = document.getElementById("flightTime")?.value;

        const chronotype =
            document.getElementById("chronotype")?.value || "neutral";

        if (!from || !to) {
            alert("Please enter From and To");
            return;
        }

        /* -------------------------
           TIME DIFFERENCE (TRUTH)
        ------------------------- */

        const baseDiff = diffHours(from, to);

        const adjustedDiff =
            baseDiff *
            flightFactor(10) *
            chronotypeFactor(chronotype);

        const diff = Math.round(adjustedDiff);

        /* -------------------------
           OUTPUT METRICS
        ------------------------- */

        document.getElementById("timeDifference").innerText =
            diff + " hrs";

        const abs = Math.abs(diff);

        document.getElementById("risk").innerText =
            abs > 10 ? "Very High" :
            abs > 6 ? "High" :
            abs > 3 ? "Medium" : "Low";

        const rec = recovery(diff);

        document.getElementById("recovery").innerText =
            `${rec.min}–${rec.max} days`;

        /* -------------------------
           PREP SCORE
        ------------------------- */

        const prep = Math.min(100, Math.round((days / 7) * 100));

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* -------------------------
           SCHEDULE GENERATION
        ------------------------- */

        let baseSleep = 23 * 60;
        let baseWake = 7 * 60;

        for (let i = 0; i < days; i++) {

            const shift = diff * curve(i, days);

            let sleep = (baseSleep + shift * 60 + 1440) % 1440;
            let wake = (baseWake + shift * 60 + 1440) % 1440;

            schedule.innerHTML += `
                <div class="day-card">
                    <h3>Day ${i + 1}</h3>
                    <p>😴 Sleep: ${format(sleep)}</p>
                    <p>⏰ Wake: ${format(wake)}</p>
                    <p>☀️ Light: ${format(wake + 60)}</p>
                    <p>☕ No caffeine after ${format(sleep - 300)}</p>
                </div>
            `;
        }

        /* -------------------------
           FLIGHT GUIDANCE
        ------------------------- */

        document.getElementById("departureTime").innerText =
            flightTime || "--";

        document.getElementById("planeSleep").innerText =
            diff > 0 ? "Sleep early on plane" : "Sleep mid-flight";

        document.getElementById("flightCoffee").innerText =
            "No caffeine 6–8h before flight";

        document.getElementById("hydration").innerText =
            "Drink water hourly";

        /* -------------------------
           ARRIVAL PLAN
        ------------------------- */

        document.getElementById("arrivalCard").innerHTML = `
            <p>☀ Get sunlight immediately</p>
            <p>🚶 Walk 20–40 min</p>
            <p>😴 Stay awake until night</p>
            <p>🚫 Avoid long naps</p>
        `;

        /* -------------------------
           TIPS
        ------------------------- */

        tips.innerHTML = `
            <li>Shift sleep gradually (don’t jump hours)</li>
            <li>Use light exposure strategically</li>
            <li>Avoid caffeine late in day</li>
        `;

        /* -------------------------
           TIMELINE
        ------------------------- */

        ["Reset", "Shift", "Adapt", "Stable"].forEach(t => {
            timeline.innerHTML += `
                <div class="timeline-item">
                    <h4>${t}</h4>
                </div>
            `;
        });

    } catch (err) {
        console.warn("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}

/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — PART 3/3
   STABILITY + UI FIX LAYER (FINAL)
========================================================= */


/* -------------------------
   BUTTON SAFETY BINDING
   (prevents broken click wiring)
------------------------- */

window.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("generateBtn");

    if (btn && !btn.dataset.bound) {
        btn.addEventListener("click", calculate);
        btn.dataset.bound = "true";
    }
});


/* -------------------------
   ANIMATION RESTART FIX
   (fixes "only works once" visual issue)
------------------------- */

function restartAnimation(el) {
    if (!el) return;

    el.style.animation = "none";
    el.offsetHeight; // force reflow
    el.style.animation = "";
}


/* -------------------------
   SAFE UI RESET BEFORE EACH RUN
   (prevents DOM stacking bugs)
------------------------- */

function resetUI() {

    const schedule = document.getElementById("schedule");
    const tips = document.getElementById("tips");
    const timeline = document.getElementById("timeline");

    if (schedule) {
        schedule.innerHTML = "";
        restartAnimation(schedule);
    }

    if (tips) tips.innerHTML = "";
    if (timeline) timeline.innerHTML = "";
}


/* -------------------------
   SAFE INPUT RECOVERY
   (prevents NaN / broken reruns)
------------------------- */

function sanitizeInputs() {

    const daysEl = document.getElementById("days");

    if (daysEl) {
        let v = Number(daysEl.value);
        if (!Number.isFinite(v) || v < 1) v = 3;
        if (v > 14) v = 14;
        daysEl.value = v;
    }
}


/* -------------------------
   GLOBAL ERROR SAFETY
------------------------- */

window.addEventListener("error", (e) => {
    console.warn("JetLag JS Error:", e.message);
});


/* -------------------------
   FINAL PATCH WRAPPER (DO NOT REMOVE)
   ensures stability on repeated runs
------------------------- */

const __originalCalculate = calculate;

calculate = function () {

    console.log("Generate clicked (stable mode)");

    if (window.__lock) return;
    window.__lock = true;

    try {

        sanitizeInputs();
        resetUI();

        return __originalCalculate();

    } catch (err) {

        console.warn("Safe catch:", err);

    } finally {

        window.__lock = false;
    }
};