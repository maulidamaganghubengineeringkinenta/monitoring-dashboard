/* =========================================================
   GOOGLE SHEETS CONFIG
========================================================= */

const SHEET_ID =
    "1DtFGkVVCrOOSEgknMo7ywodKTJk7YvRg";

const SHEET_NAME =
    "Progress 2026";

const SHEET_GID =
    "628015953";


/* =========================================================
   PROCESS COLUMNS
========================================================= */

const PROCESS_COLUMNS = [
    { index: 12, name: "REPAIR" },
    { index: 13, name: "CUTTING / CRIMPING" },
    { index: 14, name: "JOINTING / MVVS" },
    { index: 15, name: "MIDDLE" },
    { index: 16, name: "HOUSING" },
    { index: 17, name: "ASSEMBLING" },
    { index: 18, name: "BUZZER / CHECKER" },
    { index: 19, name: "VISUAL" },
    { index: 20, name: "TE-TA FINISHING" },
    { index: 21, name: "PREDEL" },
    { index: 22, name: "RFG" }
];


/* =========================================================
   PROGRESS GLOBAL
========================================================= */

let allProgressRows = [];
let customerChart = null;
let statusChart = null;
let selectedProcessIndex = null;

let progressCurrentPage = 1;

const PROGRESS_PAGE_SIZE = 25;


/* =========================================================
   CSV PARSER
========================================================= */

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {
            value += '"';
            i++;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (
            char === "," &&
            !insideQuotes
        ) {
            row.push(value);
            value = "";
            continue;
        }

        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (
                char === "\r" &&
                next === "\n"
            ) {
                i++;
            }

            row.push(value);
            rows.push(row);
            row = [];
            value = "";
            continue;
        }

        value += char;
    }

    if (
        value !== "" ||
        row.length > 0
    ) {
        row.push(value);
        rows.push(row);
    }

    return rows;
}


/* =========================================================
   HELPERS
========================================================= */

function getCellValue(row, index) {
    if (
        !row ||
        row[index] === undefined
    ) {
        return "";
    }

    return String(row[index]).trim();
}


function getNumericValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/\s/g, "")
            .replace(/[^\d.-]/g, "");

    const number = Number(cleaned);

    return Number.isFinite(number)
        ? number
        : 0;
}


function getRowStatus(row) {
    return getCellValue(row, 23)
        .toUpperCase();
}


function getRowCustomer(row) {
    return getCellValue(row, 1);
}


function getProcessQty(row, processIndex) {
    if (
        processIndex === null ||
        processIndex === undefined
    ) {
        return 0;
    }

    return getNumericValue(
        getCellValue(row, processIndex)
    );
}


function getProcessName(processIndex) {
    const process =
        PROCESS_COLUMNS.find(
            item =>
                item.index === processIndex
        );

    return process
        ? process.name
        : "";
}


function getSelectedCustomer() {
    const filter =
        document.getElementById(
            "customerFilter"
        );

    return filter
        ? filter.value
        : "";
}


function getSelectedStatus() {
    const filter =
        document.getElementById(
            "statusFilter"
        );

    return filter
        ? filter.value
        : "";
}


/* =========================================================
   LOAD PROGRESS DATA
========================================================= */

async function loadProgressData() {
    try {
        const url =
            `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Gagal mengambil data Google Sheets"
            );
        }

        const csvText =
            await response.text();

        const rows =
            parseCSV(csvText);

        if (!rows.length) {
            throw new Error(
                "Data Google Sheets kosong"
            );
        }

        const dataRows =
            rows.slice(1);

        allProgressRows =
            dataRows.filter(row => {
                const no =
                    getCellValue(row, 0);

                return (
                    no !== "" &&
                    !isNaN(Number(no))
                );
            });

        createFilters();
        createProgressDatalists();
        bindProgressFilterInputs();
        applyFilters();

        console.log(
            "Data Progress berhasil dimuat:",
            allProgressRows.length
        );

    } catch (error) {
        console.error(error);

        const table =
            document.getElementById(
                "progressTable"
            );

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="15">
                        Gagal mengambil data
                        dari Google Sheets.
                    </td>
                </tr>
            `;
        }
    }
}


/* =========================================================
   DISPLAY PROGRESS TABLE
========================================================= */

function displayProgressData(rows) {
    const table =
        document.getElementById(
            "progressTable"
        );

    if (!table) return;

    if (!rows.length) {
        table.innerHTML = `
            <tr>
                <td colspan="15">
                    Tidak ada data yang sesuai
                    dengan filter.
                </td>
            </tr>
        `;

        updateProgressPagination(0);
        return;
    }

    const totalPages =
        Math.ceil(
            rows.length /
            PROGRESS_PAGE_SIZE
        );

    if (
        progressCurrentPage >
        totalPages
    ) {
        progressCurrentPage =
            totalPages;
    }

    if (
        progressCurrentPage < 1
    ) {
        progressCurrentPage = 1;
    }

    const start =
        (
            progressCurrentPage - 1
        ) *
        PROGRESS_PAGE_SIZE;

    const pageRows =
        rows.slice(
            start,
            start + PROGRESS_PAGE_SIZE
        );

    table.innerHTML =
        pageRows.map(row => {
            const status =
                getRowStatus(row);

            let statusClass = "";

            if (status === "OPEN") {
                statusClass =
                    "table-status-open";
            }

            if (status === "CLOSE") {
                statusClass =
                    "table-status-close";
            }

            return `
                <tr>
                    <td>${escapeHTML(getCellValue(row, 0))}</td>
                    <td>${escapeHTML(getCellValue(row, 1))}</td>
                    <td>${escapeHTML(getCellValue(row, 2))}</td>
                    <td>${escapeHTML(getCellValue(row, 3))}</td>
                    <td>${escapeHTML(getCellValue(row, 4))}</td>
                    <td>${escapeHTML(getCellValue(row, 5))}</td>
                    <td>${escapeHTML(getCellValue(row, 6))}</td>
                    <td>${escapeHTML(getCellValue(row, 7))}</td>
                    <td>${escapeHTML(getCellValue(row, 8))}</td>
                    <td>${escapeHTML(getCellValue(row, 9))}</td>
                    <td>${escapeHTML(getCellValue(row, 10))}</td>
                    <td>${escapeHTML(getCellValue(row, 11))}</td>
                    <td class="${statusClass}">
                        ${escapeHTML(status)}
                    </td>
                    <td>${escapeHTML(getCellValue(row, 24))}</td>
                    <td>${escapeHTML(getCellValue(row, 25))}</td>
                </tr>
            `;
        }).join("");

    updateProgressPagination(
        totalPages
    );
}


/* =========================================================
   PROGRESS PAGINATION
========================================================= */

function updateProgressPagination(
    totalPages
) {
    const container =
        document.getElementById(
            "progressPagination"
        );

    if (!container) {
        return;
    }

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = "";

    html += `
        <button
            type="button"
            onclick="changeProgressPage(-1)"
            ${progressCurrentPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {
        html += `
            <button
                type="button"
                class="${
                    page === progressCurrentPage
                        ? "active"
                        : ""
                }"
                onclick="goProgressPage(${page})"
            >
                ${page}
            </button>
        `;
    }

    html += `
        <button
            type="button"
            onclick="changeProgressPage(1)"
            ${
                progressCurrentPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            ›
        </button>
    `;

    container.innerHTML =
        html;
}


function goProgressPage(page) {

    const totalPages =
        Math.ceil(
            getFilteredRows().length /
            PROGRESS_PAGE_SIZE
        );

    if (totalPages <= 0) {
        progressCurrentPage = 1;
        displayProgressData(
            getFilteredRows()
        );
        return;
    }

    progressCurrentPage =
        Math.max(
            1,
            Math.min(
                page,
                totalPages
            )
        );

    displayProgressData(
        getFilteredRows()
    );
}


function changeProgressPage(
    direction
) {
    const totalPages =
        Math.ceil(
            getFilteredRows().length /
            PROGRESS_PAGE_SIZE
        );

    if (totalPages <= 0) {
        progressCurrentPage = 1;
        displayProgressData(
            getFilteredRows()
        );
        return;
    }

    progressCurrentPage +=
        direction;

    progressCurrentPage =
        Math.max(
            1,
            Math.min(
                progressCurrentPage,
                totalPages
            )
        );

    displayProgressData(
        getFilteredRows()
    );
}


/* =========================================================
   PROGRESS STATISTICS
========================================================= */

function updateStatistics(rows) {
    if (selectedProcessIndex === null) {
        const total = rows.length;

        const open =
            rows.filter(
                row =>
                    getRowStatus(row) === "OPEN"
            ).length;

        const close =
            rows.filter(
                row =>
                    getRowStatus(row) === "CLOSE"
            ).length;

        updateKPIValues(
            total,
            open,
            close,
            rows,
            false
        );

        return;
    }

    let processQty = 0;
    let openQty = 0;
    let closeQty = 0;

    rows.forEach(row => {
        const qty =
            getProcessQty(
                row,
                selectedProcessIndex
            );

        processQty += qty;

        if (
            getRowStatus(row) ===
            "OPEN"
        ) {
            openQty += qty;
        }

        if (
            getRowStatus(row) ===
            "CLOSE"
        ) {
            closeQty += qty;
        }
    });

    updateKPIValues(
        processQty,
        openQty,
        closeQty,
        rows,
        true
    );
}


/* =========================================================
   UPDATE PROGRESS KPI
========================================================= */

function updateKPIValues(
    total,
    open,
    close,
    rows,
    processMode
) {
    const customers =
        new Set(
            rows
                .map(row =>
                    getRowCustomer(row)
                )
                .filter(Boolean)
        );

    const totalData =
        document.getElementById(
            "totalData"
        );

    const totalOpen =
        document.getElementById(
            "totalOpen"
        );

    const totalClose =
        document.getElementById(
            "totalClose"
        );

    const totalCustomer =
        document.getElementById(
            "totalCustomer"
        );

    if (totalData) {
        totalData.textContent =
            total.toLocaleString("id-ID");
    }

    if (totalOpen) {
        totalOpen.textContent =
            open.toLocaleString("id-ID");
    }

    if (totalClose) {
        totalClose.textContent =
            close.toLocaleString("id-ID");
    }

    if (totalCustomer) {
        totalCustomer.textContent =
            customers.size.toLocaleString(
                "id-ID"
            );
    }

    const totalDataLabel =
        document.getElementById(
            "totalDataLabel"
        );

    const totalOpenLabel =
        document.getElementById(
            "totalOpenLabel"
        );

    const totalCloseLabel =
        document.getElementById(
            "totalCloseLabel"
        );

    const totalDataDescription =
        document.getElementById(
            "totalDataDescription"
        );

    const totalOpenDescription =
        document.getElementById(
            "totalOpenDescription"
        );

    const totalCloseDescription =
        document.getElementById(
            "totalCloseDescription"
        );

    if (processMode) {
        const processName =
            getProcessName(
                selectedProcessIndex
            );

        if (totalDataLabel) {
            totalDataLabel.textContent =
                `${processName} QTY`;
        }

        if (totalOpenLabel) {
            totalOpenLabel.textContent =
                `OPEN ${processName} QTY`;
        }

        if (totalCloseLabel) {
            totalCloseLabel.textContent =
                `CLOSE ${processName} QTY`;
        }

        if (totalDataDescription) {
            totalDataDescription.textContent =
                `Total QTY pada proses ${processName}`;
        }

        if (totalOpenDescription) {
            totalOpenDescription.textContent =
                `QTY ${processName} yang masih OPEN`;
        }

        if (totalCloseDescription) {
            totalCloseDescription.textContent =
                `QTY ${processName} yang CLOSE`;
        }

    } else {
        if (totalDataLabel) {
            totalDataLabel.textContent =
                "TOTAL ORDERS";
        }

        if (totalOpenLabel) {
            totalOpenLabel.textContent =
                "OPEN ORDERS";
        }

        if (totalCloseLabel) {
            totalCloseLabel.textContent =
                "CLOSE ORDERS";
        }

        if (totalDataDescription) {
            totalDataDescription.textContent =
                "Total seluruh order";
        }

        if (totalOpenDescription) {
            totalOpenDescription.textContent =
                "Order yang masih berjalan";
        }

        if (totalCloseDescription) {
            totalCloseDescription.textContent =
                "Order yang telah selesai";
        }
    }

    const chartOpenValue =
        document.getElementById(
            "chartOpenValue"
        );

    const chartCloseValue =
        document.getElementById(
            "chartCloseValue"
        );

    const chartOpenLabel =
        document.getElementById(
            "chartOpenLabel"
        );

    const chartCloseLabel =
        document.getElementById(
            "chartCloseLabel"
        );

    if (chartOpenValue) {
        chartOpenValue.textContent =
            open.toLocaleString("id-ID");
    }

    if (chartCloseValue) {
        chartCloseValue.textContent =
            close.toLocaleString("id-ID");
    }

    if (processMode) {
        const processName =
            getProcessName(
                selectedProcessIndex
            );

        if (chartOpenLabel) {
            chartOpenLabel.textContent =
                `Open ${processName} QTY`;
        }

        if (chartCloseLabel) {
            chartCloseLabel.textContent =
                `Close ${processName} QTY`;
        }

    } else {
        if (chartOpenLabel) {
            chartOpenLabel.textContent =
                "Open Orders";
        }

        if (chartCloseLabel) {
            chartCloseLabel.textContent =
                "Close Orders";
        }
    }
}


/* =========================================================
   PROGRESS FILTER CREATION
========================================================= */


function populateProgressDatalist(listId, values) {
    const list = document.getElementById(listId);
    if (!list) return;
    const unique = [...new Set(values.map(v => String(v ?? "").trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b, "id", {numeric:true, sensitivity:"base"}));
    list.innerHTML = unique.map(v => `<option value="${escapeHTML(v)}"></option>`).join("");
}

function createProgressDatalists() {
    populateProgressDatalist("progressAssyOptions", allProgressRows.map(r => getCellValue(r,2)));
    populateProgressDatalist("progressWpOptions", allProgressRows.map(r => getCellValue(r,3)));
    populateProgressDatalist("progressCctOptions", allProgressRows.map(r => getCellValue(r,4)));
    populateProgressDatalist("progressQtyOptions", allProgressRows.map(r => getCellValue(r,5)));
    populateProgressDatalist("progressTotalCctOptions", allProgressRows.map(r => getCellValue(r,6)));
    populateProgressDatalist("progressLeadTimeOptions", allProgressRows.map(r => getCellValue(r,11)));
}


function bindProgressFilterInputs() {
    const ids = [
        "progressAssyFilter","progressWpFilter","progressCctFilter",
        "progressQtyFilter","progressTotalCctFilter","progressEtdFilter",
        "progressRescheduleFilter","progressActualStartFilter",
        "progressActualFinishFilter","progressLeadTimeFilter"
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.progressBound === "1") return;
        el.dataset.progressBound = "1";
        el.addEventListener("input", () => applyFilters());
        el.addEventListener("change", () => applyFilters());
    });
}

function createFilters() {
    const customerFilter =
        document.getElementById(
            "customerFilter"
        );

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    if (
        !customerFilter ||
        !statusFilter
    ) {
        return;
    }

    const customers =
        [
            ...new Set(
                allProgressRows
                    .map(row =>
                        getRowCustomer(row)
                    )
                    .filter(Boolean)
            )
        ].sort();

    customerFilter.innerHTML = `
        <option value="">
            Semua Customer
        </option>

        ${customers.map(
            customer => `
                <option value="${escapeHTML(customer)}">
                    ${escapeHTML(customer)}
                </option>
            `
        ).join("")}
    `;

    statusFilter.innerHTML = `
        <option value="">
            Semua Status
        </option>

        <option value="OPEN">
            OPEN
        </option>

        <option value="CLOSE">
            CLOSE
        </option>
    `;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   GET FILTERED PROGRESS ROWS
========================================================= */

function getProgressFilterValue(id) {
    const element = document.getElementById(id);
    return element ? String(element.value || "").trim() : "";
}

function normalizeProgressText(value) {
    return String(value || "").trim().toUpperCase();
}

function progressTextMatches(rowValue, filterValue) {
    if (!filterValue) return true;
    return normalizeProgressText(rowValue).includes(
        normalizeProgressText(filterValue)
    );
}

function progressNumericMatches(rowValue, filterValue) {
    if (!filterValue) return true;
    const wanted = getNumericValue(filterValue);
    const actual = getNumericValue(rowValue);
    return String(filterValue).trim() !== "" && actual === wanted;
}

function progressDateMatches(rowValue, filterValue) {
    if (!filterValue) return true;
    const date = parseReadingDate(rowValue);
    if (!date) return false;

    const parts = String(filterValue).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return false;

    return (
        date.getFullYear() === parts[0] &&
        date.getMonth() === parts[1] - 1 &&
        date.getDate() === parts[2]
    );
}

function getFilteredRows() {
    const selectedCustomer = getProgressFilterValue("customerFilter");
    const selectedAssy = getProgressFilterValue("progressAssyFilter");
    const selectedWp = getProgressFilterValue("progressWpFilter");
    const selectedCct = getProgressFilterValue("progressCctFilter");
    const selectedQty = getProgressFilterValue("progressQtyFilter");
    const selectedTotalCct = getProgressFilterValue("progressTotalCctFilter");
    const selectedEtd = getProgressFilterValue("progressEtdFilter");
    const selectedReschedule = getProgressFilterValue("progressRescheduleFilter");
    const selectedActualStart = getProgressFilterValue("progressActualStartFilter");
    const selectedActualFinish = getProgressFilterValue("progressActualFinishFilter");
    const selectedLeadTime = getProgressFilterValue("progressLeadTimeFilter");
    const selectedStatus = getProgressFilterValue("statusFilter");

    let filteredRows = [...allProgressRows];

    if (selectedCustomer) {
        filteredRows = filteredRows.filter(
            row => getRowCustomer(row) === selectedCustomer
        );
    }

    if (selectedAssy) {
        filteredRows = filteredRows.filter(
            row => progressTextMatches(getCellValue(row, 2), selectedAssy)
        );
    }

    if (selectedWp) {
        filteredRows = filteredRows.filter(
            row => progressTextMatches(getCellValue(row, 3), selectedWp)
        );
    }

    if (selectedCct) {
        filteredRows = filteredRows.filter(
            row => progressNumericMatches(getCellValue(row, 4), selectedCct)
        );
    }

    if (selectedQty) {
        filteredRows = filteredRows.filter(
            row => progressNumericMatches(getCellValue(row, 5), selectedQty)
        );
    }

    if (selectedTotalCct) {
        filteredRows = filteredRows.filter(
            row => progressNumericMatches(getCellValue(row, 6), selectedTotalCct)
        );
    }

    if (selectedEtd) {
        filteredRows = filteredRows.filter(
            row => progressDateMatches(getCellValue(row, 7), selectedEtd)
        );
    }

    if (selectedReschedule) {
        filteredRows = filteredRows.filter(
            row => progressDateMatches(getCellValue(row, 8), selectedReschedule)
        );
    }

    if (selectedActualStart) {
        filteredRows = filteredRows.filter(
            row => progressDateMatches(getCellValue(row, 9), selectedActualStart)
        );
    }

    if (selectedActualFinish) {
        filteredRows = filteredRows.filter(
            row => progressDateMatches(getCellValue(row, 10), selectedActualFinish)
        );
    }

    if (selectedLeadTime) {
        filteredRows = filteredRows.filter(
            row => progressNumericMatches(getCellValue(row, 11), selectedLeadTime) ||
                   progressTextMatches(getCellValue(row, 11), selectedLeadTime)
        );
    }

    if (selectedStatus) {
        filteredRows = filteredRows.filter(
            row => getRowStatus(row) === selectedStatus
        );
    }

    if (selectedProcessIndex !== null) {
        filteredRows = filteredRows.filter(
            row => getProcessQty(row, selectedProcessIndex) > 0
        );
    }

    return filteredRows;
}


/* =========================================================
   PROGRESS ACTIVE FILTER CONTEXT
========================================================= */

function updateActiveFilterContext() {
    const context = document.getElementById("activeFilterContext");
    if (!context) return;

    const filters = [
        ["CUSTOMER", getProgressFilterValue("customerFilter")],
        ["ASSY NO", getProgressFilterValue("progressAssyFilter")],
        ["WP", getProgressFilterValue("progressWpFilter")],
        ["CCT", getProgressFilterValue("progressCctFilter")],
        ["QTY", getProgressFilterValue("progressQtyFilter")],
        ["TOTAL CCT", getProgressFilterValue("progressTotalCctFilter")],
        ["ETD", getProgressFilterValue("progressEtdFilter")],
        ["RESCHEDULE ETD", getProgressFilterValue("progressRescheduleFilter")],
        ["ACTUAL START", getProgressFilterValue("progressActualStartFilter")],
        ["ACTUAL FINISH", getProgressFilterValue("progressActualFinishFilter")],
        ["LEAD TIME", getProgressFilterValue("progressLeadTimeFilter")],
        ["STATUS", getProgressFilterValue("statusFilter")]
    ];

    const process = selectedProcessIndex !== null
        ? getProcessName(selectedProcessIndex)
        : "";

    const active = filters.filter(item => item[1]);
    if (process) active.push(["PROCESS", process]);

    const title = context.querySelector(".active-filter-content strong");
    const description = context.querySelector(".active-filter-content span");

    if (!active.length) {
        if (title) title.textContent = "Semua Data";
        if (description) description.textContent = "Dashboard menampilkan seluruh ORDER dan QTY proses";
        context.classList.remove("has-filter");
        return;
    }

    if (title) {
        title.textContent = active.map(([label, value]) => `${label}: ${value}`).join("  •  ");
    }

    if (description) {
        description.textContent = `Menampilkan ${getFilteredRows().length.toLocaleString("id-ID")} order sesuai filter aktif`;
    }

    context.classList.add("has-filter");
}


/* =========================================================
   APPLY PROGRESS FILTER
========================================================= */

function applyFilters() {
    const filteredRows =
        getFilteredRows();

    progressCurrentPage = 1;

    displayProgressData(
        filteredRows
    );

    updateStatistics(
        filteredRows
    );

    updateCharts(
        filteredRows
    );

    updateProcessOverview(
        filteredRows
    );

    updateSelectedProcessVisual();
    updateActiveFilterContext();
    updateTableDescription();
    updateProductionReading(filteredRows);
}




/* =========================================================
   AUTOMATIC PRODUCTION READING
========================================================= */

function readingNumber(value) {
    return getNumericValue(value) || 0;
}

function parseReadingDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const months = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    let m = text.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{2,4})$/);
    if (m) {
        const day = Number(m[1]);
        const month = months[m[2].slice(0, 3).toUpperCase()];
        let year = Number(m[3]);
        if (year < 100) year += 2000;
        if (month !== undefined) {
            const d = new Date(year, month, day);
            if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
        }
    }

    m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]) - 1;
        let year = Number(m[3]);
        if (year < 100) year += 2000;
        const d = new Date(year, month, day);
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
    }

    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function readingDateDiffDays(target, base) {
    const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const b = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    return Math.round((a - b) / 86400000);
}

function readingFormatNumber(value, decimals = 0) {
    return Number(value || 0).toLocaleString("id-ID", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function readingSet(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}


function productionReadingDrilldown(type, value = "") {
    let rows = getFilteredRows().filter(row => getRowStatus(row) === "OPEN");
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (type === "all") {
        // keep all current OPEN rows
    } else if (type === "etd3") {
        rows = rows.filter(row => {
            const etd = parseReadingDate(getCellValue(row, 7));
            if (!etd) return false;
            const diff = readingDateDiffDays(etd, startOfToday);
            return diff >= 0 && diff <= 3;
        });
    } else if (type === "overdue") {
        rows = rows.filter(row => {
            const etd = parseReadingDate(getCellValue(row, 7));
            return etd && readingDateDiffDays(etd, startOfToday) < 0;
        });
    } else if (type === "reschedule") {
        rows = rows.filter(row => {
            const etd = parseReadingDate(getCellValue(row, 7));
            const revised = parseReadingDate(getCellValue(row, 8));
            return etd && revised && etd.getTime() !== revised.getTime();
        });
    } else if (type === "notStarted") {
        rows = rows.filter(row => !String(getCellValue(row, 9) || "").trim());
    } else if (type === "wp") {
        rows = rows.filter(row => {
            const wp = String(getCellValue(row, 3) || "").trim() || "Tanpa WP";
            return wp === value;
        });
    } else if (type === "process") {
        const process = PROCESS_COLUMNS.find(item => item.name === value);
        if (process) {
            rows = rows.filter(row => getProcessQty(row, process.index) > 0);
        }
    } else if (type === "attention") {
        rows = rows.filter(row => {
            const etd = parseReadingDate(getCellValue(row, 7));
            const actualStart = String(getCellValue(row, 9) || "").trim();
            const diff = etd ? readingDateDiffDays(etd, startOfToday) : null;
            return (diff !== null && diff < 0) || !actualStart || (diff !== null && diff <= 3);
        });
    } else if (type === "assy") {
        rows = rows.filter(row => String(getCellValue(row, 2) || "").trim() === value);
    }

    // Jadikan filter Status OPEN dan tampilkan hasil drilldown di tabel utama.
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) statusFilter.value = "OPEN";

    selectedProcessIndex = null;
    progressCurrentPage = 1;
    displayProgressData(rows);
    updateStatistics(rows);
    updateCharts(rows);
    updateProcessOverview(rows);
    updateSelectedProcessVisual();
    updateActiveFilterContext();
    updateTableDescription();

    const table = document.querySelector(".panel");
    if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProductionReading(rows) {
    const section = document.getElementById("productionReadingSection");
    if (!section) return;

    // Production Reading KHUSUS ORDER OPEN.
    const openRows = rows.filter(row => getRowStatus(row) === "OPEN");

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let etd3 = 0;
    let overdue = 0;
    let reschedule = 0;
    let notStarted = 0;
    let totalCCT = 0;
    let totalQTY = 0;
    let openQTY = 0;
    const openOrders = openRows.length;
    let statusNotStarted = 0;
    let statusProgress = 0;
    let statusFinished = 0;

    const wp = {};
    const processTotals = {};
    PROCESS_COLUMNS.forEach(process => processTotals[process.name] = 0);
    const attention = [];

    openRows.forEach(row => {
        const etd = parseReadingDate(getCellValue(row, 7));
        const revisedETD = parseReadingDate(getCellValue(row, 8));
        const actualStart = String(getCellValue(row, 9) || "").trim();
        const actualFinish = String(getCellValue(row, 10) || "").trim();
        const qty = readingNumber(getCellValue(row, 5));
        const cct = readingNumber(getCellValue(row, 6));
        const rowOpenQty = readingNumber(getCellValue(row, 24));
        const wpName = String(getCellValue(row, 3) || "").trim() || "Tanpa WP";
        const assy = String(getCellValue(row, 2) || "").trim() || `NO ${getCellValue(row, 0)}`;

        totalCCT += cct;
        totalQTY += qty;
        openQTY += rowOpenQty;

        if (!actualStart) {
            notStarted++;
            statusNotStarted++;
        } else if (!actualFinish) {
            statusProgress++;
        } else {
            statusFinished++;
        }

        if (etd) {
            const diff = readingDateDiffDays(etd, startOfToday);
            if (diff >= 0 && diff <= 3) etd3++;
            if (diff < 0) overdue++;
        }

        if (etd && revisedETD && etd.getTime() !== revisedETD.getTime()) {
            reschedule++;
        }

        wp[wpName] = (wp[wpName] || 0) + (rowOpenQty || qty);

        PROCESS_COLUMNS.forEach(process => {
            const processQty = readingNumber(getCellValue(row, process.index));
            processTotals[process.name] += processQty;
        });

        if (etd && readingDateDiffDays(etd, startOfToday) < 0) {
            attention.push(`${assy} — overdue${rowOpenQty ? ` (${readingFormatNumber(rowOpenQty)} QTY)` : ""}`);
        } else if (!actualStart) {
            attention.push(`${assy} — belum mulai${rowOpenQty ? ` (${readingFormatNumber(rowOpenQty)} QTY)` : ""}`);
        } else if (etd && readingDateDiffDays(etd, startOfToday) <= 3) {
            attention.push(`${assy} — ETD dekat${rowOpenQty ? ` (${readingFormatNumber(rowOpenQty)} QTY)` : ""}`);
        }
    });

    readingSet("readingETD3", readingFormatNumber(etd3));
    readingSet("readingOverdue", readingFormatNumber(overdue));
    readingSet("readingReschedule", readingFormatNumber(reschedule));
    readingSet("readingNotStarted", readingFormatNumber(notStarted));
    readingSet("readingTotalCCT", readingFormatNumber(totalCCT));
    readingSet("readingTotalQTY", readingFormatNumber(totalQTY));
    readingSet("readingOpenQTY", readingFormatNumber(openQTY));
    readingSet("readingAvgCCT", readingFormatNumber(openRows.length ? totalCCT / openRows.length : 0, 1));
    readingSet("readingStatusNotStarted", readingFormatNumber(statusNotStarted));
    readingSet("readingStatusProgress", readingFormatNumber(statusProgress));
    readingSet("readingStatusFinished", readingFormatNumber(statusFinished));

    const wpList = document.getElementById("readingWPList");
    if (wpList) {
        const items = Object.entries(wp).sort((a, b) => b[1] - a[1]).slice(0, 8);
        wpList.innerHTML = items.length ? items.map(([name, value]) => `
            <div class="production-reading-clickable" onclick='productionReadingDrilldown("wp", ${JSON.stringify(name)})' title="Klik untuk melihat OPEN order WP ini">
                <span>${escapeHTML(name)}</span><strong>${readingFormatNumber(value)}</strong>
            </div>`).join("") : `<span style="color:#7a8a91;">Tidak ada data OPEN.</span>`;
    }

    const processList = document.getElementById("readingProcessList");
    if (processList) {
        const items = Object.entries(processTotals).sort((a, b) => b[1] - a[1]);
        processList.innerHTML = items.map(([name, value]) => `
            <div class="production-reading-clickable" onclick='productionReadingDrilldown("process", ${JSON.stringify(name)})' title="Klik untuk melihat OPEN order proses ini">
                <span>${escapeHTML(name)}</span><strong>${readingFormatNumber(value)}</strong>
            </div>`).join("");
    }

    const attentionList = document.getElementById("readingAttentionList");
    const uniqueAttention = [...new Set(attention)].slice(0, 8);
    if (attentionList) {
        attentionList.innerHTML = uniqueAttention.length
            ? uniqueAttention.map(item => {
                const assy = item.split(" — ")[0];
                return `<div class="production-reading-clickable attention-item" onclick='productionReadingDrilldown("assy", ${JSON.stringify(assy)})' title="Klik untuk melihat order ini">${escapeHTML(item)}</div>`;
            }).join("")
            : `<span style="color:#7a8a91;">Tidak ada order OPEN yang perlu perhatian.</span>`;
    }
    readingSet("readingAttentionCount", attention.length);

    const insight = document.getElementById("automaticProductionReading");
    if (insight) {
        if (!openRows.length) {
            insight.textContent = "Tidak ada order OPEN yang sesuai dengan filter Progress saat ini.";
        } else {
            const parts = [];
            if (overdue) parts.push(`${overdue} order OPEN sudah melewati ETD`);
            if (notStarted) parts.push(`${notStarted} order OPEN belum memiliki Actual Start`);
            if (etd3) parts.push(`${etd3} order OPEN memiliki ETD dalam 3 hari ke depan`);
            if (reschedule) parts.push(`${reschedule} order OPEN mengalami perubahan ETD`);
            if (!parts.length) parts.push("Tidak ada indikator deadline atau perubahan ETD yang menonjol pada order OPEN");
            insight.textContent = `Production Reading OPEN: ${parts.join(" • ")}. Total ${readingFormatNumber(totalQTY)} QTY OPEN, dengan ${readingFormatNumber(openQTY)} OPEN QTY dari ${readingFormatNumber(openOrders)} order OPEN.`;
        }
    }
}


/* =========================================================
   PROGRESS TABLE DESCRIPTION
========================================================= */

function updateTableDescription() {
    const description =
        document.getElementById(
            "tableDescription"
        );

    if (!description) return;

    const customer =
        getSelectedCustomer();

    const status =
        getSelectedStatus();

    const process =
        selectedProcessIndex !== null
            ? getProcessName(
                selectedProcessIndex
            )
            : "";

    const parts = [];

    if (customer) {
        parts.push(
            `Customer: ${customer}`
        );
    }

    if (status) {
        parts.push(
            `Status: ${status}`
        );
    }

    if (process) {
        parts.push(
            `Process: ${process}`
        );
    }

    if (!parts.length) {
        description.textContent =
            "Data progress prototype dari Google Sheets";
    } else {
        description.textContent =
            `Data sesuai filter — ${parts.join(" • ")}`;
    }
}


/* =========================================================
   RESET PROGRESS FILTER
========================================================= */

function resetFilters() {
    const ids = [
        "customerFilter",
        "progressAssyFilter",
        "progressWpFilter",
        "progressCctFilter",
        "progressQtyFilter",
        "progressTotalCctFilter",
        "progressEtdFilter",
        "progressRescheduleFilter",
        "progressActualStartFilter",
        "progressActualFinishFilter",
        "progressLeadTimeFilter",
        "statusFilter"
    ];

    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
    });

    selectedProcessIndex = null;
    applyFilters();
}


/* =========================================================
   PROGRESS STATUS FILTER
========================================================= */

function setStatusFilter(status) {
    selectedProcessIndex = null;

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    if (statusFilter) {
        statusFilter.value =
            status || "";
    }

    applyFilters();
}


/* =========================================================
   PROGRESS CUSTOMER CHART
========================================================= */

function updateCustomerChart(rows) {
    const canvas =
        document.getElementById(
            "customerChart"
        );

    if (!canvas) return;

    const customers = {};

    rows.forEach(row => {
        const customer =
            getRowCustomer(row);

        if (!customer) return;

        if (!customers[customer]) {
            customers[customer] = {
                OPEN: 0,
                CLOSE: 0
            };
        }

        const status =
            getRowStatus(row);

        if (
            selectedProcessIndex === null
        ) {
            if (status === "OPEN") {
                customers[customer].OPEN++;
            }

            if (status === "CLOSE") {
                customers[customer].CLOSE++;
            }

        } else {
            const qty =
                getProcessQty(
                    row,
                    selectedProcessIndex
                );

            if (status === "OPEN") {
                customers[customer].OPEN +=
                    qty;
            }

            if (status === "CLOSE") {
                customers[customer].CLOSE +=
                    qty;
            }
        }
    });

    const labels =
        Object.keys(customers);

    const openData =
        labels.map(
            customer =>
                customers[customer].OPEN
        );

    const closeData =
        labels.map(
            customer =>
                customers[customer].CLOSE
        );

    if (customerChart) {
        customerChart.destroy();
    }

    const title =
        document.getElementById(
            "customerChartTitle"
        );

    const description =
        document.getElementById(
            "customerChartDescription"
        );

    let openLabel =
        "OPEN ORDERS";

    let closeLabel =
        "CLOSE ORDERS";

    if (
        selectedProcessIndex !== null
    ) {
        const processName =
            getProcessName(
                selectedProcessIndex
            );

        openLabel =
            `OPEN ${processName} QTY`;

        closeLabel =
            `CLOSE ${processName} QTY`;

        if (title) {
            title.textContent =
                `${processName} QTY per Customer`;
        }

        if (description) {
            description.textContent =
                `Jumlah QTY ${processName} berdasarkan customer dan status`;
        }

    } else {
        if (title) {
            title.textContent =
                "Orders per Customer";
        }

        if (description) {
            description.textContent =
                "Jumlah ORDER OPEN dan CLOSE berdasarkan customer";
        }
    }

    customerChart =
        new Chart(
            canvas,
            {
                type: "bar",

                data: {
                    labels,

                    datasets: [
                        {
                            label: openLabel,
                            data: openData,
                            backgroundColor: "#F2B38F",
                            borderRadius: 7,
                            borderSkipped: false
                        },

                        {
                            label: closeLabel,
                            data: closeData,
                            backgroundColor: "#9ED0B0",
                            borderRadius: 7,
                            borderSkipped: false
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {
                        legend: {
                            labels: {
                                color: "#000000",
                                font: {
                                    weight: "700"
                                }
                            }
                        },

                        tooltip: {
                            callbacks: {
                                footer: function(
                                    tooltipItems
                                ) {
                                    let total = 0;

                                    tooltipItems.forEach(
                                        item => {
                                            total += Number(
                                                item.raw || 0
                                            );
                                        }
                                    );

                                    const unit =
                                        selectedProcessIndex !== null
                                            ? "QTY"
                                            : "ORDERS";

                                    return `Total: ${total.toLocaleString("id-ID")} ${unit}`;
                                }
                            }
                        }
                    },

                    scales: {
                        x: {
                            ticks: {
                                color: "#000000",
                                font: {
                                    weight: "600"
                                }
                            },

                            grid: {
                                display: false
                            }
                        },

                        y: {
                            beginAtZero: true,

                            ticks: {
                                color: "#000000",
                                precision: 0
                            },

                            grid: {
                                color: "#E2EDF2"
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        const customer =
                            labels[index];

                        const filter =
                            document.getElementById(
                                "customerFilter"
                            );

                        if (filter) {
                            filter.value =
                                customer;

                            applyFilters();
                        }
                    }
                }
            }
        );
}


/* =========================================================
   PROGRESS CUSTOMER DISTRIBUTION
========================================================= */

function updateStatusChart(rows) {
    const canvas =
        document.getElementById(
            "statusChart"
        );

    if (!canvas) return;

    const customerCounts = {};

    rows.forEach(row => {
        const customer =
            getRowCustomer(row);

        if (!customer) return;

        if (
            selectedProcessIndex === null
        ) {
            customerCounts[customer] =
                (
                    customerCounts[customer] ||
                    0
                ) + 1;

        } else {
            const qty =
                getProcessQty(
                    row,
                    selectedProcessIndex
                );

            customerCounts[customer] =
                (
                    customerCounts[customer] ||
                    0
                ) + qty;
        }
    });

    const labels =
        Object.keys(customerCounts);

    const data =
        labels.map(
            customer =>
                customerCounts[customer]
        );

    if (statusChart) {
        statusChart.destroy();
    }

    const title =
        document.getElementById(
            "distributionChartTitle"
        );

    const description =
        document.getElementById(
            "distributionChartDescription"
        );

    const processName =
        selectedProcessIndex !== null
            ? getProcessName(
                selectedProcessIndex
            )
            : "";

    if (processName) {
        if (title) {
            title.textContent =
                `${processName} QTY Distribution`;
        }

        if (description) {
            description.textContent =
                `Distribusi QTY ${processName} berdasarkan customer`;
        }

    } else {
        if (title) {
            title.textContent =
                "Customer Distribution";
        }

        if (description) {
            description.textContent =
                "Distribusi ORDER berdasarkan customer";
        }
    }

    statusChart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {
                    labels,

                    datasets: [
                        {
                            data,

                            backgroundColor: [
                                "#B9DDF2",
                                "#F5C8D8",
                                "#F6DFA6",
                                "#BFE3D0",
                                "#D4C4EC",
                                "#F4C9AF",
                                "#C7D5F0",
                                "#F3C4C4",
                                "#D8C4E8",
                                "#F5D8A7",
                                "#BBDDDC",
                                "#C9D8F0"
                            ],

                            borderColor:
                                "#FFFFFF",

                            borderWidth: 3
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "62%",

                    plugins: {
                        legend: {
                            position: "bottom",

                            labels: {
                                color: "#000000",

                                font: {
                                    weight: "600"
                                },

                                padding: 10
                            }
                        },

                        tooltip: {
                            callbacks: {
                                label: function(
                                    context
                                ) {
                                    const value =
                                        context.raw || 0;

                                    const unit =
                                        selectedProcessIndex !== null
                                            ? "QTY"
                                            : "ORDERS";

                                    return `${context.label}: ${Number(value).toLocaleString("id-ID")} ${unit}`;
                                }
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        const customer =
                            labels[index];

                        const filter =
                            document.getElementById(
                                "customerFilter"
                            );

                        if (filter) {
                            filter.value =
                                customer;

                            applyFilters();
                        }
                    }
                }
            }
        );
}


/* =========================================================
   UPDATE PROGRESS CHARTS
========================================================= */

function updateCharts(rows) {
    updateCustomerChart(rows);
    updateStatusChart(rows);
}


/* =========================================================
   PROCESS OVERVIEW
========================================================= */

function updateProcessOverview(rows) {
    const container =
        document.getElementById(
            "processOverview"
        );

    if (!container) return;

    const openRows =
        rows.filter(
            row =>
                getRowStatus(row) ===
                "OPEN"
        );

    container.innerHTML =
        PROCESS_COLUMNS
            .map(
                (process, index) => {
                    let total = 0;

                    openRows.forEach(row => {
                        total +=
                            getProcessQty(
                                row,
                                process.index
                            );
                    });

                    const isSelected =
                        selectedProcessIndex ===
                        process.index;

                    return `
                        <div
                            class="process-card ${
                                isSelected
                                    ? "selected-process"
                                    : ""
                            }"
                            data-process-index="${process.index}"
                            data-process-name="${escapeHTML(process.name)}"
                            onclick="filterProcess(${process.index})"
                        >

                            <div class="process-card-header">

                                <div class="process-name">
                                    ${escapeHTML(process.name)}
                                </div>

                                <div class="process-mini-icon">
                                    ${getProcessIcon(index)}
                                </div>

                            </div>

                            <div class="process-number">
                                ${total.toLocaleString("id-ID")}
                            </div>

                            <div class="process-label">
                                OPEN QTY
                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   PROCESS ICON
========================================================= */

function getProcessIcon(index) {
    const icons = [
        "🔧",
        "✂️",
        "🔗",
        "⚙️",
        "🏠",
        "🔩",
        "🔔",
        "👁️",
        "✨",
        "📦",
        "🎯"
    ];

    return icons[index] || "●";
}


/* =========================================================
   PROCESS FILTER
========================================================= */

function filterProcess(processIndex) {
    const process =
        PROCESS_COLUMNS.find(
            item =>
                item.index ===
                processIndex
        );

    if (!process) return;

    selectedProcessIndex =
        processIndex;

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    if (statusFilter) {
        statusFilter.value =
            "OPEN";
    }

    applyFilters();

    const table =
        document.querySelector(
            ".panel"
        );

    if (table) {
        table.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    console.log(
        `Process selected: ${process.name}`
    );
}


/* =========================================================
   SELECTED PROCESS VISUAL
========================================================= */

function updateSelectedProcessVisual() {
    const cards =
        document.querySelectorAll(
            ".process-card"
        );

    cards.forEach(card => {
        const index =
            Number(
                card.dataset.processIndex
            );

        if (
            selectedProcessIndex !== null &&
            index === selectedProcessIndex
        ) {
            card.classList.add(
                "selected-process"
            );
        } else {
            card.classList.remove(
                "selected-process"
            );
        }
    });
}


/* =========================================================
   CLEAR PROCESS ONLY
========================================================= */

function clearProcessFilter() {
    selectedProcessIndex = null;
    applyFilters();
}


/* =========================================================
   SHOW PAGE
========================================================= */

function showPage(pageName) {
    const pages =
        document.querySelectorAll(
            ".page"
        );

    pages.forEach(page => {
        page.classList.remove(
            "active-page"
        );
    });

    const target =
        document.getElementById(
            pageName
        );

    if (target) {
        target.classList.add(
            "active-page"
        );
    }

    const menus =
        document.querySelectorAll(
            ".sidebar .menu"
        );

    menus.forEach(menu => {
        menu.classList.remove(
            "active"
        );
    });

    const menuIndex =
        pageName === "progress"
            ? 0
            : pageName === "problem"
                ? 1
                : 2;

    if (menus[menuIndex]) {
        menus[menuIndex]
            .classList.add(
                "active"
            );
    }

    const title =
        document.getElementById(
            "pageTitle"
        );

    const breadcrumb =
        document.getElementById(
            "breadcrumbTitle"
        );

    if (
        pageName === "progress"
    ) {
        if (title) {
            title.textContent =
                "Progress 2026";
        }

        if (breadcrumb) {
            breadcrumb.textContent =
                "PROGRESS 2026";
        }
    }

    if (
        pageName === "problem"
    ) {
        if (title) {
            title.textContent =
                "Problem";
        }

        if (breadcrumb) {
            breadcrumb.textContent =
                "PROBLEM";
        }

        requestAnimationFrame(() => {
            resizeProblemCharts();
        });
    }

    if (
        pageName === "monitoring"
    ) {
        if (title) {
            title.textContent =
                "Monitoring Center";
        }

        if (breadcrumb) {
            breadcrumb.textContent =
                "MONITORING CENTER";
        }

        requestAnimationFrame(() => {
            refreshMonitoringCenter();
        });
    }
}


/* =========================================================
   DOM READY - PROGRESS
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {
        const filterIds = [
            "customerFilter",
            "progressAssyFilter",
            "progressWpFilter",
            "progressCctFilter",
            "progressQtyFilter",
            "progressTotalCctFilter",
            "progressEtdFilter",
            "progressRescheduleFilter",
            "progressActualStartFilter",
            "progressActualFinishFilter",
            "progressLeadTimeFilter",
            "statusFilter"
        ];

        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;

            const eventName = element.tagName === "SELECT" || element.type === "date"
                ? "change"
                : "input";

            element.addEventListener(eventName, function() {
                applyFilters();
            });

            if (eventName !== "change") {
                element.addEventListener("change", function() {
                    applyFilters();
                });
            }
        });

        loadProgressData();
    }
);


/* =========================================================
   PROBLEM DASHBOARD
   GOOGLE SHEETS
========================================================= */

const PROBLEM_SHEET_ID =
    "1DtFGkVVCrOOSEgknMo7ywodKTJk7YvRg";

const PROBLEM_SHEET_GID =
    "773726896";


/* =========================================================
   PROBLEM GLOBAL
========================================================= */

let allProblemRows = [];
let filteredProblemRows = [];

let problemCustomerChart = null;
let problemStatusChart = null;
let problemPartChart = null;
let problemPICChart = null;
let problemTrendChart = null;

let problemCurrentPage = 1;

let problemLoading = false;
let problemLoaded = false;

const PROBLEM_PAGE_SIZE = 20;


/* =========================================================
   PROBLEM COLUMN MAPPING
========================================================= */

const PROBLEM_COLUMNS = {
    NO: 0,
    DATE_PROBLEM: 1,
    ASSY_NO: 2,
    CUSTOMER: 3,
    WIP: 4,
    PART_NAME: 5,
    PART_NO_BEI: 6,
    PART_NO_BEE: 7,
    QTY_STD: 8,
    QTY_ACT: 9,
    MINUS: 10,
    SATUAN: 11,
    PIC: 12,
    DATE_RECEIVED: 13,
    STATUS: 14,
    KETERANGAN: 15,
    PROBLEM: 16
};


/* =========================================================
   NORMALIZE PROBLEM ROW
========================================================= */

function normalizeProblemRow(raw) {
    if (!raw) {
        return [];
    }

    return [
        getCellValue(raw, 1),
        getCellValue(raw, 2),
        getCellValue(raw, 3),
        getCellValue(raw, 4),
        getCellValue(raw, 5),
        getCellValue(raw, 6),
        getCellValue(raw, 7),
        getCellValue(raw, 8),
        getCellValue(raw, 9),
        getCellValue(raw, 10),
        getCellValue(raw, 11),
        getCellValue(raw, 12),
        getCellValue(raw, 21),
        getCellValue(raw, 22),
        getCellValue(raw, 23),
        getCellValue(raw, 24),
        getCellValue(raw, 25)
    ];
}


/* =========================================================
   PROBLEM VALUE
========================================================= */

function getProblemValue(row, column) {
    return getCellValue(
        row,
        column
    );
}


/* =========================================================
   PROBLEM STATUS
========================================================= */

function getProblemStatus(row) {
    return getProblemValue(
        row,
        PROBLEM_COLUMNS.STATUS
    ).toUpperCase();
}


/* =========================================================
   PROBLEM DATE
========================================================= */

function parseProblemDate(value) {
    if (!value) {
        return null;
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }

    /*
     * Sheet-nya memakai dua format berbeda tergantung
     * pemisahnya:
     *   - "DD-MM-YYYY" / "DD-MM-YY"  (pakai strip)
     *   - "MM/DD/YYYY" / "MM/DD/YY"  (pakai slash)
     *
     * Ini dikonfirmasi dari urutan kronologis data asli
     * (mis. 04/01/24 -> 04/03/24 -> 04/04/24 -> 16-04-24
     * semuanya berurutan sebagai 1, 3, 4, 16 April 2024).
     * Jadi dua delimiter itu TIDAK boleh diperlakukan sama.
     */

    const dashMatch =
        text.match(
            /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/
        );

    const slashMatch =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
        );

    let day = null;
    let month = null;
    let year = null;

    if (dashMatch) {
        // DD-MM-YYYY
        day = Number(dashMatch[1]);
        month = Number(dashMatch[2]) - 1;
        year = Number(dashMatch[3]);
    } else if (slashMatch) {
        // MM/DD/YYYY
        month = Number(slashMatch[1]) - 1;
        day = Number(slashMatch[2]);
        year = Number(slashMatch[3]);
    }

    if (day !== null) {
        if (year < 100) {
            year += 2000;
        }

        const date =
            new Date(
                year,
                month,
                day
            );

        if (
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        ) {
            return date;
        }
    }

    const fallback =
        new Date(text);

    return Number.isNaN(
        fallback.getTime()
    )
        ? null
        : fallback;
}


/* =========================================================
   PROBLEM VALIDATION
========================================================= */

function isValidProblemRow(row) {
    if (!row) {
        return false;
    }

    const no =
        getProblemValue(
            row,
            PROBLEM_COLUMNS.NO
        );

    const date =
        getProblemValue(
            row,
            PROBLEM_COLUMNS.DATE_PROBLEM
        );

    const assy =
        getProblemValue(
            row,
            PROBLEM_COLUMNS.ASSY_NO
        );

    const customer =
        getProblemValue(
            row,
            PROBLEM_COLUMNS.CUSTOMER
        );

    const problem =
        getProblemValue(
            row,
            PROBLEM_COLUMNS.PROBLEM
        );

    return Boolean(
        no ||
        date ||
        assy ||
        customer ||
        problem
    );
}


/* =========================================================
   LOAD PROBLEM DATA
========================================================= */

async function loadProblemData() {

    if (
        problemLoading ||
        problemLoaded
    ) {
        return;
    }

    problemLoading = true;

    try {
        updateProblemSourceStatus(
            "Loading..."
        );

        const url =
            `https://docs.google.com/spreadsheets/d/${PROBLEM_SHEET_ID}/export?format=csv&gid=${PROBLEM_SHEET_GID}`;

        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Gagal mengambil data Problem"
            );
        }

        const csvText =
            await response.text();

        const rawRows =
            parseCSV(csvText);

        if (!rawRows.length) {
            throw new Error(
                "Sheet Problem kosong"
            );
        }

        const dataRows =
            rawRows
                .slice(2)
                .map(normalizeProblemRow)
                .filter(isValidProblemRow);

        allProblemRows =
            dataRows;

        filteredProblemRows =
            [...allProblemRows];

        populateProblemFilters();
        applyProblemFilters();

        problemLoaded = true;

        updateProblemSourceStatus(
            `LIVE • ${allProblemRows.length.toLocaleString("id-ID")} data`
        );

        console.log(
            "Problem berhasil dimuat:",
            allProblemRows.length
        );

    } catch (error) {
        console.error(
            "Problem error:",
            error
        );

        problemLoaded = false;

        updateProblemSourceStatus(
            "ERROR"
        );

        const table =
            document.getElementById(
                "problemTable"
            );

        if (table) {
            table.innerHTML = `
                <tr>
                    <td
                        colspan="17"
                        style="
                            text-align:center;
                            padding:30px;
                            color:#b42318;
                        "
                    >
                        Gagal mengambil data
                        Problem dari Google Sheets.
                        <br><br>
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

    } finally {
        problemLoading = false;
    }
}


/* =========================================================
   SOURCE STATUS
========================================================= */

function updateProblemSourceStatus(text) {
    const element =
        document.getElementById(
            "problemSourceStatus"
        );

    if (element) {
        element.textContent =
            text;
    }
}


/* =========================================================
   UNIQUE PROBLEM VALUES
========================================================= */

function getUniqueProblemValues(column) {
    return [
        ...new Set(
            allProblemRows
                .map(row =>
                    getProblemValue(
                        row,
                        column
                    )
                )
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            String(a).localeCompare(
                String(b),
                "id"
            )
    );
}


/* =========================================================
   PROBLEM SEARCHABLE DROPDOWN
========================================================= */

const PROBLEM_DROPDOWN_CONFIG = [
    {
        filterId: "problemCustomerFilter",
        menuId: "problemCustomerDropdown",
        column: PROBLEM_COLUMNS.CUSTOMER,
        defaultText: "Ketik atau pilih customer...",
        allText: "Semua Customer"
    },

    {
        filterId: "problemStatusFilter",
        menuId: "problemStatusDropdown",
        column: PROBLEM_COLUMNS.STATUS,
        defaultText: "Ketik atau pilih status...",
        allText: "Semua Status"
    },

    {
        filterId: "problemPICFilter",
        menuId: "problemPICDropdown",
        column: PROBLEM_COLUMNS.PIC,
        defaultText: "Ketik atau pilih PIC...",
        allText: "Semua PIC"
    },

    {
        filterId: "problemPartFilter",
        menuId: "problemPartDropdown",
        column: PROBLEM_COLUMNS.PART_NAME,
        defaultText: "Ketik atau pilih part name...",
        allText: "Semua Part Name"
    },

    {
        filterId: "problemWipFilter",
        menuId: "problemWipDropdown",
        column: PROBLEM_COLUMNS.WIP,
        defaultText: "Ketik atau pilih WIP...",
        allText: "Semua WIP"
    }
];


/* =========================================================
   POPULATE PROBLEM FILTERS
========================================================= */

function populateProblemFilters() {

    PROBLEM_DROPDOWN_CONFIG.forEach(
        config => {

            const input =
                document.getElementById(
                    config.filterId
                );

            const menu =
                document.getElementById(
                    config.menuId
                );

            if (!input || !menu) {
                return;
            }

            const values =
                getUniqueProblemValues(
                    config.column
                );

            input.value = "";
            input.placeholder =
                config.defaultText;

            menu.innerHTML = "";

            /*
             * OPTION SEMUA
             */

            const allOption =
                document.createElement(
                    "div"
                );

            allOption.className =
                "searchable-option";

            allOption.dataset.value = "";

            allOption.setAttribute(
                "role",
                "option"
            );

            allOption.textContent =
                config.allText;

            menu.appendChild(
                allOption
            );

            /*
             * OPTION DATA
             */

            values.forEach(value => {

                const option =
                    document.createElement(
                        "div"
                    );

                option.className =
                    "searchable-option";

                option.dataset.value =
                    value;

                option.setAttribute(
                    "role",
                    "option"
                );

                option.textContent =
                    value;

                menu.appendChild(
                    option
                );
            });

            refreshProblemDropdownSelection(
                config.filterId
            );
        }
    );
}


/* =========================================================
   CLOSE ALL PROBLEM DROPDOWNS
========================================================= */

function closeAllProblemDropdowns(
    exceptFilterId = ""
) {
    document
        .querySelectorAll(
            ".searchable-dropdown"
        )
        .forEach(wrapper => {

            const input =
                wrapper.querySelector(
                    ".searchable-input"
                );

            if (
                input &&
                input.id === exceptFilterId
            ) {
                return;
            }

            wrapper.classList.remove(
                "open"
            );

            if (input) {
                input.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        });
}


/* =========================================================
   OPEN PROBLEM DROPDOWN
========================================================= */

function openProblemDropdown(
    filterId
) {
    const input =
        document.getElementById(
            filterId
        );

    if (!input) {
        return;
    }

    const wrapper =
        input.closest(
            ".searchable-dropdown"
        );

    if (!wrapper) {
        return;
    }

    closeAllProblemDropdowns(
        filterId
    );

    wrapper.classList.add(
        "open"
    );

    input.setAttribute(
        "aria-expanded",
        "true"
    );

    filterProblemDropdownOptions(
        filterId
    );
}


/* =========================================================
   FILTER DROPDOWN OPTIONS
========================================================= */

function filterProblemDropdownOptions(
    filterId
) {
    const input =
        document.getElementById(
            filterId
        );

    if (!input) {
        return;
    }

    const wrapper =
        input.closest(
            ".searchable-dropdown"
        );

    if (!wrapper) {
        return;
    }

    const menu =
        wrapper.querySelector(
            ".searchable-dropdown-menu"
        );

    if (!menu) {
        return;
    }

    const search =
        input.value
            .trim()
            .toLowerCase();

    const options =
        menu.querySelectorAll(
            ".searchable-option"
        );

    let visibleCount = 0;

    options.forEach(option => {

        const value =
            String(
                option.dataset.value || ""
            );

        const label =
            option.textContent
                .trim();

        const isAll =
            value === "";

        const matches =
            isAll ||
            label
                .toLowerCase()
                .includes(search);

        if (matches) {
            option.style.display =
                "flex";

            visibleCount++;
        } else {
            option.style.display =
                "none";
        }
    });

    let empty =
        menu.querySelector(
            ".searchable-empty"
        );

    if (!visibleCount) {

        if (!empty) {
            empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "searchable-empty";

            menu.appendChild(
                empty
            );
        }

        empty.textContent =
            "Tidak ada pilihan yang cocok.";

        empty.style.display =
            "block";

    } else if (empty) {
        empty.style.display =
            "none";
    }
}


/* =========================================================
   REFRESH SELECTED DROPDOWN
========================================================= */

function refreshProblemDropdownSelection(
    filterId
) {
    const input =
        document.getElementById(
            filterId
        );

    if (!input) {
        return;
    }

    const wrapper =
        input.closest(
            ".searchable-dropdown"
        );

    if (!wrapper) {
        return;
    }

    const menu =
        wrapper.querySelector(
            ".searchable-dropdown-menu"
        );

    if (!menu) {
        return;
    }

    const currentValue =
        input.value.trim();

    menu
        .querySelectorAll(
            ".searchable-option"
        )
        .forEach(option => {

            const optionValue =
                String(
                    option.dataset.value || ""
                );

            option.classList.toggle(
                "selected",
                optionValue ===
                    currentValue
            );
        });
}


/* =========================================================
   SET DROPDOWN VALUE
========================================================= */

function setProblemDropdownValue(
    filterId,
    value,
    apply = true
) {
    const input =
        document.getElementById(
            filterId
        );

    if (!input) {
        return;
    }

    input.value =
        value || "";

    refreshProblemDropdownSelection(
        filterId
    );

    filterProblemDropdownOptions(
        filterId
    );

    closeAllProblemDropdowns();

    if (apply) {
        applyProblemFilters();
    }
}


/* =========================================================
   INITIALIZE SEARCHABLE DROPDOWNS
========================================================= */

function initializeProblemDropdowns() {

    document
        .querySelectorAll(
            ".searchable-dropdown"
        )
        .forEach(wrapper => {

            const input =
                wrapper.querySelector(
                    ".searchable-input"
                );

            const menu =
                wrapper.querySelector(
                    ".searchable-dropdown-menu"
                );

            const arrow =
                wrapper.querySelector(
                    ".searchable-arrow"
                );

            if (!input || !menu) {
                return;
            }

            /*
             * Jangan pasang listener
             * dua kali.
             */

            if (
                wrapper.dataset.initialized ===
                "true"
            ) {
                return;
            }

            wrapper.dataset.initialized =
                "true";

            /*
             * CLICK / FOCUS INPUT
             */

            input.addEventListener(
                "focus",
                function() {
                    openProblemDropdown(
                        input.id
                    );
                }
            );

            input.addEventListener(
                "click",
                function() {
                    openProblemDropdown(
                        input.id
                    );
                }
            );

            /*
             * KETIK
             */

            input.addEventListener(
                "input",
                function() {
                    openProblemDropdown(
                        input.id
                    );

                    filterProblemDropdownOptions(
                        input.id
                    );

                    refreshProblemDropdownSelection(
                        input.id
                    );

                    applyProblemFilters();
                }
            );

            /*
             * KEYBOARD
             */

            input.addEventListener(
                "keydown",
                function(event) {

                    const options =
                        Array.from(
                            menu.querySelectorAll(
                                ".searchable-option"
                            )
                        ).filter(
                            option =>
                                option.style.display !==
                                "none"
                        );

                    if (
                        event.key ===
                        "ArrowDown"
                    ) {
                        event.preventDefault();

                        openProblemDropdown(
                            input.id
                        );

                        moveProblemDropdownActive(
                            menu,
                            1
                        );
                    }

                    if (
                        event.key ===
                        "ArrowUp"
                    ) {
                        event.preventDefault();

                        openProblemDropdown(
                            input.id
                        );

                        moveProblemDropdownActive(
                            menu,
                            -1
                        );
                    }

                    if (
                        event.key ===
                        "Enter"
                    ) {
                        const active =
                            menu.querySelector(
                                ".keyboard-active"
                            );

                        if (
                            active &&
                            options.includes(
                                active
                            )
                        ) {
                            event.preventDefault();

                            setProblemDropdownValue(
                                input.id,
                                active.dataset.value,
                                true
                            );
                        }
                    }

                    if (
                        event.key ===
                        "Escape"
                    ) {
                        closeAllProblemDropdowns();
                    }
                }
            );

            /*
             * CLICK OPTION
             */

            menu.addEventListener(
                "click",
                function(event) {

                    const option =
                        event.target.closest(
                            ".searchable-option"
                        );

                    if (!option) {
                        return;
                    }

                    setProblemDropdownValue(
                        input.id,
                        option.dataset.value,
                        true
                    );
                }
            );

            /*
             * ARROW BUTTON
             */

            if (arrow) {
                arrow.addEventListener(
                    "click",
                    function(event) {
                        event.preventDefault();
                        event.stopPropagation();

                        const isOpen =
                            wrapper.classList.contains(
                                "open"
                            );

                        if (isOpen) {
                            closeAllProblemDropdowns();
                        } else {
                            openProblemDropdown(
                                input.id
                            );

                            input.focus();
                        }
                    }
                );
            }
        });
}


/* =========================================================
   MOVE DROPDOWN ACTIVE OPTION
========================================================= */

function moveProblemDropdownActive(
    menu,
    direction
) {
    const options =
        Array.from(
            menu.querySelectorAll(
                ".searchable-option"
            )
        ).filter(
            option =>
                option.style.display !==
                "none"
        );

    if (!options.length) {
        return;
    }

    let currentIndex =
        options.findIndex(
            option =>
                option.classList.contains(
                    "keyboard-active"
                )
        );

    if (currentIndex === -1) {
        currentIndex =
            direction > 0
                ? 0
                : options.length - 1;
    } else {
        currentIndex += direction;

        if (
            currentIndex < 0
        ) {
            currentIndex =
                options.length - 1;
        }

        if (
            currentIndex >=
            options.length
        ) {
            currentIndex = 0;
        }
    }

    options.forEach(option => {
        option.classList.remove(
            "keyboard-active"
        );
    });

    const active =
        options[currentIndex];

    if (active) {
        active.classList.add(
            "keyboard-active"
        );

        active.scrollIntoView({
            block: "nearest"
        });
    }
}


/* =========================================================
   CLICK OUTSIDE DROPDOWN
========================================================= */

document.addEventListener(
    "click",
    function(event) {

        if (
            !event.target.closest(
                ".searchable-dropdown"
            )
        ) {
            closeAllProblemDropdowns();
        }
    }
);


/* =========================================================
   GET FILTERED PROBLEM
========================================================= */

function getFilteredProblemRows() {

    const customer =
        document.getElementById(
            "problemCustomerFilter"
        )?.value.trim() || "";

    const status =
        document.getElementById(
            "problemStatusFilter"
        )?.value.trim().toUpperCase() || "";

    const pic =
        document.getElementById(
            "problemPICFilter"
        )?.value.trim() || "";

    const part =
        document.getElementById(
            "problemPartFilter"
        )?.value.trim() || "";

    const wip =
        document.getElementById(
            "problemWipFilter"
        )?.value.trim() || "";

    const dateFrom =
        document.getElementById(
            "problemDateFrom"
        )?.value || "";

    const dateTo =
        document.getElementById(
            "problemDateTo"
        )?.value || "";

    let rows =
        [...allProblemRows];


    /* =====================================================
       CUSTOMER
    ===================================================== */

    if (customer) {
        const search =
            customer.toLowerCase();

        rows =
            rows.filter(row => {

                const value =
                    getProblemValue(
                        row,
                        PROBLEM_COLUMNS.CUSTOMER
                    ).toLowerCase();

                return value.includes(
                    search
                );
            });
    }


    /* =====================================================
       STATUS
    ===================================================== */

    if (status) {
        rows =
            rows.filter(row =>
                getProblemStatus(row) ===
                status
            );
    }


    /* =====================================================
       PIC
    ===================================================== */

    if (pic) {
        const search =
            pic.toLowerCase();

        rows =
            rows.filter(row => {

                const value =
                    getProblemValue(
                        row,
                        PROBLEM_COLUMNS.PIC
                    ).toLowerCase();

                return value.includes(
                    search
                );
            });
    }


    /* =====================================================
       PART NAME
    ===================================================== */

    if (part) {
        const search =
            part.toLowerCase();

        rows =
            rows.filter(row => {

                const value =
                    getProblemValue(
                        row,
                        PROBLEM_COLUMNS.PART_NAME
                    ).toLowerCase();

                return value.includes(
                    search
                );
            });
    }


    /* =====================================================
       WIP
    ===================================================== */

    if (wip) {
        const search =
            wip.toLowerCase();

        rows =
            rows.filter(row => {

                const value =
                    getProblemValue(
                        row,
                        PROBLEM_COLUMNS.WIP
                    ).toLowerCase();

                return value.includes(
                    search
                );
            });
    }


    /* =====================================================
       TANGGAL DARI
    ===================================================== */

    if (dateFrom) {
        const from =
            new Date(
                `${dateFrom}T00:00:00`
            );

        rows =
            rows.filter(row => {

                const date =
                    parseProblemDate(
                        getProblemValue(
                            row,
                            PROBLEM_COLUMNS.DATE_PROBLEM
                        )
                    );

                return (
                    date &&
                    date >= from
                );
            });
    }


    /* =====================================================
       TANGGAL SAMPAI
    ===================================================== */

    if (dateTo) {
        const to =
            new Date(
                `${dateTo}T23:59:59`
            );

        rows =
            rows.filter(row => {

                const date =
                    parseProblemDate(
                        getProblemValue(
                            row,
                            PROBLEM_COLUMNS.DATE_PROBLEM
                        )
                    );

                return (
                    date &&
                    date <= to
                );
            });
    }

    return rows;
}


/* =========================================================
   APPLY PROBLEM FILTER
========================================================= */

function applyProblemFilters() {

    filteredProblemRows =
        getFilteredProblemRows();

    problemCurrentPage = 1;

    updateProblemKPIs(
        filteredProblemRows
    );

    updateProblemCharts(
        filteredProblemRows
    );

    renderProblemTable(
        filteredProblemRows
    );

    updateProblemFilterContext(
        filteredProblemRows
    );
}


/* =========================================================
   PROBLEM KPI
========================================================= */

function updateProblemKPIs(rows) {

    const total =
        rows.length;

    const open =
        rows.filter(
            row =>
                getProblemStatus(row) ===
                "OPEN"
        ).length;

    const close =
        rows.filter(
            row =>
                getProblemStatus(row) ===
                "CLOSE"
        ).length;

    const customers =
        new Set(
            rows
                .map(row =>
                    getProblemValue(
                        row,
                        PROBLEM_COLUMNS.CUSTOMER
                    )
                )
                .filter(Boolean)
        ).size;

    const minus =
        rows.reduce(
            (sum, row) => {
                return (
                    sum +
                    getNumericValue(
                        getProblemValue(
                            row,
                            PROBLEM_COLUMNS.MINUS
                        )
                    )
                );
            },
            0
        );

    const totalElement =
        document.getElementById(
            "totalProblem"
        );

    const openElement =
        document.getElementById(
            "openProblem"
        );

    const closeElement =
        document.getElementById(
            "closeProblem"
        );

    const customerElement =
        document.getElementById(
            "problemCustomerCount"
        );

    const minusElement =
        document.getElementById(
            "problemMinusTotal"
        );

    if (totalElement) {
        totalElement.textContent =
            total.toLocaleString("id-ID");
    }

    if (openElement) {
        openElement.textContent =
            open.toLocaleString("id-ID");
    }

    if (closeElement) {
        closeElement.textContent =
            close.toLocaleString("id-ID");
    }

    if (customerElement) {
        customerElement.textContent =
            customers.toLocaleString(
                "id-ID"
            );
    }

    if (minusElement) {
        minusElement.textContent =
            minus.toLocaleString(
                "id-ID"
            );
    }
}


/* =========================================================
   PROBLEM FILTER CONTEXT
========================================================= */

function updateProblemFilterContext() {

    const context =
        document.getElementById(
            "problemActiveFilter"
        );

    if (!context) {
        return;
    }

    const values = [];

    const customer =
        document.getElementById(
            "problemCustomerFilter"
        )?.value || "";

    const status =
        document.getElementById(
            "problemStatusFilter"
        )?.value || "";

    const pic =
        document.getElementById(
            "problemPICFilter"
        )?.value || "";

    const part =
        document.getElementById(
            "problemPartFilter"
        )?.value || "";

    const wip =
        document.getElementById(
            "problemWipFilter"
        )?.value || "";

    const dateFrom =
        document.getElementById(
            "problemDateFrom"
        )?.value || "";

    const dateTo =
        document.getElementById(
            "problemDateTo"
        )?.value || "";

    if (customer) {
        values.push(customer);
    }

    if (status) {
        values.push(status);
    }

    if (pic) {
        values.push(
            `PIC: ${pic}`
        );
    }

    if (part) {
        values.push(
            `PART: ${part}`
        );
    }

    if (wip) {
        values.push(
            `WIP: ${wip}`
        );
    }

    if (dateFrom) {
        values.push(
            `DARI: ${dateFrom}`
        );
    }

    if (dateTo) {
        values.push(
            `SAMPAI: ${dateTo}`
        );
    }

    const title =
        context.querySelector(
            ".active-filter-content strong"
        );

    const description =
        context.querySelector(
            ".active-filter-content span"
        );

    const resultCount =
        document.getElementById(
            "problemResultCount"
        );

    const tableDescription =
        document.getElementById(
            "problemTableDescription"
        );

    if (resultCount) {
        resultCount.textContent =
            `${filteredProblemRows.length.toLocaleString("id-ID")} data`;
    }

    if (!values.length) {

        if (title) {
            title.textContent =
                "Semua Problem";
        }

        if (description) {
            description.textContent =
                "Dashboard menampilkan seluruh problem";
        }

        context.classList.remove(
            "has-filter"
        );

    } else {

        if (title) {
            title.textContent =
                values.join(" • ");
        }

        if (description) {
            description.textContent =
                "Problem sesuai filter yang dipilih";
        }

        context.classList.add(
            "has-filter"
        );
    }

    if (tableDescription) {
        tableDescription.textContent =
            values.length
                ? `Data Problem sesuai filter — ${values.join(" • ")}`
                : "Data problem dari Google Sheets";
    }
}


/* =========================================================
   PROBLEM CUSTOMER CHART
========================================================= */

function updateProblemCustomerChart(rows) {

    const canvas =
        document.getElementById(
            "problemCustomerChart"
        );

    if (!canvas) {
        return;
    }

    const counts = {};

    rows.forEach(row => {

        const customer =
            getProblemValue(
                row,
                PROBLEM_COLUMNS.CUSTOMER
            ) ||
            "TANPA CUSTOMER";

        counts[customer] =
            (
                counts[customer] ||
                0
            ) + 1;
    });

    const sorted =
        Object.entries(counts)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    const labels =
        sorted.map(
            item => item[0]
        );

    const data =
        sorted.map(
            item => item[1]
        );

    if (problemCustomerChart) {
        problemCustomerChart.destroy();
    }

    problemCustomerChart =
        new Chart(
            canvas,
            {
                type: "bar",

                data: {
                    labels,

                    datasets: [
                        {
                            label: "PROBLEM",
                            data,

                            backgroundColor:
                                "#B9DDF2",

                            borderRadius: 7,

                            borderSkipped:
                                false
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        x: {
                            ticks: {
                                color: "#000000"
                            },

                            grid: {
                                display: false
                            }
                        },

                        y: {
                            beginAtZero: true,

                            ticks: {
                                color: "#000000",
                                precision: 0
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        setProblemDropdownValue(
                            "problemCustomerFilter",
                            labels[index],
                            true
                        );
                    }
                }
            }
        );
}


/* =========================================================
   PROBLEM STATUS CHART
========================================================= */

function updateProblemStatusChart(rows) {

    const canvas =
        document.getElementById(
            "problemStatusChart"
        );

    if (!canvas) {
        return;
    }

    const open =
        rows.filter(
            row =>
                getProblemStatus(row) ===
                "OPEN"
        ).length;

    const close =
        rows.filter(
            row =>
                getProblemStatus(row) ===
                "CLOSE"
        ).length;

    if (problemStatusChart) {
        problemStatusChart.destroy();
    }

    problemStatusChart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {
                    labels: [
                        "OPEN",
                        "CLOSE"
                    ],

                    datasets: [
                        {
                            data: [
                                open,
                                close
                            ],

                            backgroundColor: [
                                "#F4C8AC",
                                "#B9DEC9"
                            ],

                            borderColor:
                                "#FFFFFF",

                            borderWidth: 3
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "62%",

                    plugins: {
                        legend: {
                            position: "bottom",

                            labels: {
                                color: "#000000",

                                font: {
                                    weight: "700"
                                }
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        const status =
                            index === 0
                                ? "OPEN"
                                : "CLOSE";

                        setProblemStatusFilter(
                            status
                        );
                    }
                }
            }
        );
}


/* =========================================================
   PROBLEM PART CHART
========================================================= */

function updateProblemPartChart(rows) {

    const canvas =
        document.getElementById(
            "problemPartChart"
        );

    if (!canvas) {
        return;
    }

    const counts = {};

    rows.forEach(row => {

        const part =
            getProblemValue(
                row,
                PROBLEM_COLUMNS.PART_NAME
            ) ||
            "TANPA PART NAME";

        counts[part] =
            (
                counts[part] ||
                0
            ) + 1;
    });

    const sorted =
        Object.entries(counts)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .slice(0, 10);

    const labels =
        sorted.map(
            item => item[0]
        );

    const data =
        sorted.map(
            item => item[1]
        );

    if (problemPartChart) {
        problemPartChart.destroy();
    }

    problemPartChart =
        new Chart(
            canvas,
            {
                type: "bar",

                data: {
                    labels,

                    datasets: [
                        {
                            label: "PROBLEM",
                            data,

                            backgroundColor:
                                "#D4C4EC",

                            borderRadius: 7,

                            borderSkipped:
                                false
                        }
                    ]
                },

                options: {
                    indexAxis: "y",

                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        x: {
                            beginAtZero: true,

                            ticks: {
                                precision: 0
                            }
                        },

                        y: {
                            ticks: {
                                color: "#000000"
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        setProblemDropdownValue(
                            "problemPartFilter",
                            labels[index],
                            true
                        );
                    }
                }
            }
        );
}


/* =========================================================
   PROBLEM PIC CHART
========================================================= */

function updateProblemPICChart(rows) {

    const canvas =
        document.getElementById(
            "problemPICChart"
        );

    if (!canvas) {
        return;
    }

    const counts = {};

    rows.forEach(row => {

        const pic =
            getProblemValue(
                row,
                PROBLEM_COLUMNS.PIC
            ) ||
            "TANPA PIC";

        counts[pic] =
            (
                counts[pic] ||
                0
            ) + 1;
    });

    const sorted =
        Object.entries(counts)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .slice(0, 12);

    const labels =
        sorted.map(
            item => item[0]
        );

    const data =
        sorted.map(
            item => item[1]
        );

    if (problemPICChart) {
        problemPICChart.destroy();
    }

    problemPICChart =
        new Chart(
            canvas,
            {
                type: "bar",

                data: {
                    labels,

                    datasets: [
                        {
                            label: "PROBLEM",
                            data,

                            backgroundColor:
                                "#BFE3D0",

                            borderRadius: 7,

                            borderSkipped:
                                false
                        }
                    ]
                },

                options: {
                    indexAxis: "y",

                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        x: {
                            beginAtZero: true,

                            ticks: {
                                precision: 0
                            }
                        },

                        y: {
                            ticks: {
                                color: "#000000"
                            }
                        }
                    },

                    onClick: function(
                        event,
                        elements
                    ) {
                        if (!elements.length) {
                            return;
                        }

                        const index =
                            elements[0].index;

                        setProblemDropdownValue(
                            "problemPICFilter",
                            labels[index],
                            true
                        );
                    }
                }
            }
        );
}


/* =========================================================
   PROBLEM TREND CHART
========================================================= */

function updateProblemTrendChart(rows) {

    const canvas =
        document.getElementById(
            "problemTrendChart"
        );

    if (!canvas) {
        return;
    }

    const months = {};

    rows.forEach(row => {

        const rawDate =
            getProblemValue(
                row,
                PROBLEM_COLUMNS.DATE_PROBLEM
            );

        const date =
            parseProblemDate(
                rawDate
            );

        if (!date) {
            return;
        }

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const key =
            `${year}-${month}`;

        months[key] =
            (
                months[key] ||
                0
            ) + 1;
    });

    const sortedKeys =
        Object.keys(months)
            .sort();

    const labels =
        sortedKeys.map(
            key => {

                const [
                    year,
                    month
                ] =
                    key.split("-");

                return new Date(
                    Number(year),
                    Number(month) - 1,
                    1
                ).toLocaleDateString(
                    "id-ID",
                    {
                        month: "short",
                        year: "numeric"
                    }
                );
            }
        );

    const data =
        sortedKeys.map(
            key =>
                months[key]
        );

    if (problemTrendChart) {
        problemTrendChart.destroy();
    }

    problemTrendChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels,

                    datasets: [
                        {
                            label: "PROBLEM",
                            data,

                            borderColor:
                                "#344E5D",

                            backgroundColor:
                                "rgba(52,78,93,0.12)",

                            fill: true,

                            tension: 0.3,

                            pointRadius: 4,

                            pointHoverRadius: 6
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        x: {
                            ticks: {
                                color: "#000000"
                            },

                            grid: {
                                display: false
                            }
                        },

                        y: {
                            beginAtZero: true,

                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            }
        );
}


/* =========================================================
   UPDATE ALL PROBLEM CHARTS
========================================================= */

function updateProblemCharts(rows) {

    updateProblemCustomerChart(
        rows
    );

    updateProblemStatusChart(
        rows
    );

    updateProblemPartChart(
        rows
    );

    updateProblemPICChart(
        rows
    );

    updateProblemTrendChart(
        rows
    );
}


/* =========================================================
   RENDER PROBLEM TABLE
========================================================= */

function renderProblemTable(rows) {

    const table =
        document.getElementById(
            "problemTable"
        );

    if (!table) {
        return;
    }

    if (!rows.length) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="17"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Tidak ada Problem
                    yang sesuai filter.
                </td>
            </tr>
        `;

        updateProblemPagination(0);

        return;
    }

    const totalPages =
        Math.ceil(
            rows.length /
            PROBLEM_PAGE_SIZE
        );

    if (
        problemCurrentPage >
        totalPages
    ) {
        problemCurrentPage =
            totalPages;
    }

    const start =
        (
            problemCurrentPage - 1
        ) *
        PROBLEM_PAGE_SIZE;

    const pageRows =
        rows.slice(
            start,
            start + PROBLEM_PAGE_SIZE
        );

    table.innerHTML =
        pageRows
            .map(row => {

                const originalIndex =
                    allProblemRows.indexOf(
                        row
                    );

                const status =
                    getProblemStatus(
                        row
                    );

                const statusClass =
                    status === "OPEN"
                        ? "problem-status-open"
                        : status === "CLOSE"
                            ? "problem-status-close"
                            : "";

                return `
                    <tr
                        class="problem-clickable"
                        onclick="openProblemDetail(${originalIndex})"
                    >

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.NO
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.DATE_PROBLEM
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.ASSY_NO
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.CUSTOMER
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.WIP
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.PART_NAME
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.PART_NO_BEI
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.PART_NO_BEE
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.QTY_STD
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.QTY_ACT
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.MINUS
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.SATUAN
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.PIC
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.DATE_RECEIVED
                                )
                            )}
                        </td>

                        <td>
                            ${
                                status
                                    ? `
                                        <span
                                            class="${statusClass}"
                                        >
                                            ${escapeHTML(status)}
                                        </span>
                                    `
                                    : "-"
                            }
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.KETERANGAN
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getProblemValue(
                                    row,
                                    PROBLEM_COLUMNS.PROBLEM
                                )
                            )}
                        </td>

                    </tr>
                `;
            })
            .join("");

    updateProblemPagination(
        totalPages
    );
}


/* =========================================================
   PROBLEM PAGINATION
========================================================= */

function updateProblemPagination(
    totalPages
) {
    const container =
        document.getElementById(
            "problemPagination"
        );

    if (!container) {
        return;
    }

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = "";

    html += `
        <button
            type="button"
            onclick="changeProblemPage(-1)"
            ${problemCurrentPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {
        html += `
            <button
                type="button"
                class="${
                    page === problemCurrentPage
                        ? "active"
                        : ""
                }"
                onclick="goProblemPage(${page})"
            >
                ${page}
            </button>
        `;
    }

    html += `
        <button
            type="button"
            onclick="changeProblemPage(1)"
            ${
                problemCurrentPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            ›
        </button>
    `;

    container.innerHTML =
        html;
}


function goProblemPage(page) {

    const totalPages =
        Math.ceil(
            filteredProblemRows.length /
            PROBLEM_PAGE_SIZE
        );

    if (
        totalPages <= 0
    ) {
        problemCurrentPage = 1;
        renderProblemTable(
            filteredProblemRows
        );
        return;
    }

    problemCurrentPage =
        Math.max(
            1,
            Math.min(
                page,
                totalPages
            )
        );

    renderProblemTable(
        filteredProblemRows
    );
}


function changeProblemPage(
    direction
) {
    const totalPages =
        Math.ceil(
            filteredProblemRows.length /
            PROBLEM_PAGE_SIZE
        );

    if (
        totalPages <= 0
    ) {
        problemCurrentPage = 1;
        renderProblemTable(
            filteredProblemRows
        );
        return;
    }

    problemCurrentPage +=
        direction;

    if (
        problemCurrentPage < 1
    ) {
        problemCurrentPage = 1;
    }

    if (
        problemCurrentPage >
        totalPages
    ) {
        problemCurrentPage =
            totalPages;
    }

    renderProblemTable(
        filteredProblemRows
    );
}


/* =========================================================
   RESET PROBLEM FILTER
========================================================= */

function resetProblemFilters() {

    const ids = [
        "problemCustomerFilter",
        "problemStatusFilter",
        "problemPICFilter",
        "problemPartFilter",
        "problemWipFilter",
        "problemDateFrom",
        "problemDateTo"
    ];

    ids.forEach(id => {

        const element =
            document.getElementById(
                id
            );

        if (element) {
            element.value = "";
        }
    });

    closeAllProblemDropdowns();

    PROBLEM_DROPDOWN_CONFIG.forEach(
        config => {

            refreshProblemDropdownSelection(
                config.filterId
            );

            filterProblemDropdownOptions(
                config.filterId
            );
        }
    );

    applyProblemFilters();
}


/* =========================================================
   PROBLEM STATUS FILTER
========================================================= */

function setProblemStatusFilter(
    status
) {
    setProblemDropdownValue(
        "problemStatusFilter",
        status || "",
        true
    );
}


/* =========================================================
   PROBLEM DETAIL
========================================================= */

function openProblemDetail(index) {

    const row =
        allProblemRows[index];

    if (!row) {
        return;
    }

    const fields = [
        [
            "NO",
            PROBLEM_COLUMNS.NO
        ],
        [
            "Tanggal Problem",
            PROBLEM_COLUMNS.DATE_PROBLEM
        ],
        [
            "ASSY NO",
            PROBLEM_COLUMNS.ASSY_NO
        ],
        [
            "CUSTOMER",
            PROBLEM_COLUMNS.CUSTOMER
        ],
        [
            "WIP",
            PROBLEM_COLUMNS.WIP
        ],
        [
            "PART NAME",
            PROBLEM_COLUMNS.PART_NAME
        ],
        [
            "PART NO BEI",
            PROBLEM_COLUMNS.PART_NO_BEI
        ],
        [
            "PART NO BEE BEE",
            PROBLEM_COLUMNS.PART_NO_BEE
        ],
        [
            "QTY STD",
            PROBLEM_COLUMNS.QTY_STD
        ],
        [
            "QTY ACT",
            PROBLEM_COLUMNS.QTY_ACT
        ],
        [
            "Minus",
            PROBLEM_COLUMNS.MINUS
        ],
        [
            "SATUAN",
            PROBLEM_COLUMNS.SATUAN
        ],
        [
            "PIC",
            PROBLEM_COLUMNS.PIC
        ],
        [
            "Tanggal Diterima",
            PROBLEM_COLUMNS.DATE_RECEIVED
        ],
        [
            "STATUS",
            PROBLEM_COLUMNS.STATUS
        ],
        [
            "Keterangan",
            PROBLEM_COLUMNS.KETERANGAN
        ],
        [
            "PROBLEM",
            PROBLEM_COLUMNS.PROBLEM
        ]
    ];

    const content =
        document.getElementById(
            "problemDetailContent"
        );

    if (!content) {
        return;
    }

    content.innerHTML =
        fields
            .map(field => {

                const value =
                    getProblemValue(
                        row,
                        field[1]
                    );

                const full =
                    field[1] ===
                    PROBLEM_COLUMNS.PROBLEM;

                return `
                    <div
                        class="
                            problem-detail-item
                            ${full ? "full" : ""}
                        "
                    >

                        <div class="problem-detail-label">
                            ${escapeHTML(
                                field[0]
                            )}
                        </div>

                        <div class="problem-detail-value">
                            ${escapeHTML(
                                value || "-"
                            )}
                        </div>

                    </div>
                `;
            })
            .join("");

    const modal =
        document.getElementById(
            "problemDetailModal"
        );

    if (modal) {
        modal.classList.add(
            "show"
        );

        document.body.style.overflow =
            "hidden";
    }
}


function closeProblemDetail() {

    const modal =
        document.getElementById(
            "problemDetailModal"
        );

    if (modal) {
        modal.classList.remove(
            "show"
        );
    }

    document.body.style.overflow =
        "";
}


/* =========================================================
   RESIZE PROBLEM CHARTS
========================================================= */

function resizeProblemCharts() {

    const charts = [
        problemCustomerChart,
        problemStatusChart,
        problemPartChart,
        problemPICChart,
        problemTrendChart
    ];

    charts.forEach(chart => {
        if (chart) {
            try {
                chart.resize();
            } catch (error) {
                console.warn(
                    "Chart resize error:",
                    error
                );
            }
        }
    });
}


/* =========================================================
   PROBLEM FILTER LISTENERS
========================================================= */

function initializeProblemDashboard() {

    /*
     * Searchable dropdown
     */

    initializeProblemDropdowns();

    /*
     * Date filters
     */

    const dateIds = [
        "problemDateFrom",
        "problemDateTo"
    ];

    dateIds.forEach(id => {

        const element =
            document.getElementById(
                id
            );

        if (!element) {
            return;
        }

        element.addEventListener(
            "input",
            applyProblemFilters
        );

        element.addEventListener(
            "change",
            applyProblemFilters
        );
    });

    loadProblemData();
}


/* =========================================================
   SHOW PAGE OVERRIDE
========================================================= */

const originalShowPage =
    showPage;

showPage =
    function(pageName) {

        originalShowPage(
            pageName
        );

        if (
            pageName === "problem"
        ) {

            if (
                !problemLoaded &&
                !problemLoading
            ) {
                loadProblemData();
            }

            requestAnimationFrame(() => {
                resizeProblemCharts();
            });
        }
    };


/* =========================================================
   INITIALIZE PROBLEM
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {
        initializeProblemDashboard();
    }
);


/* =========================================================
   PROBLEM ESC
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape"
        ) {
            closeProblemDetail();
            closeAllProblemDropdowns();
        }
    }
);

/* =========================================================
   MONITORING CENTER
========================================================= */

let monitoringMonth = new Date();

function monitoringOpenRows() {
    return (allProgressRows || []).filter(row => getRowStatus(row) === "OPEN");
}

function monitoringDateOnly(value) {
    if (typeof parseReadingDate === "function") return parseReadingDate(value);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function monitoringSameDate(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monitoringTodayStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monitoringMetrics() {
    const rows = monitoringOpenRows();
    const today = monitoringTodayStart();
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);

    let etd3 = 0, overdue = 0, reschedule = 0, notStarted = 0;
    const etd3Rows = [], overdueRows = [], rescheduleRows = [], notStartedRows = [];

    rows.forEach(row => {
        const etd = monitoringDateOnly(getCellValue(row, 7));
        const revised = monitoringDateOnly(getCellValue(row, 8));
        const actualStart = String(getCellValue(row, 9) || "").trim();

        if (etd) {
            if (etd < today) { overdue++; overdueRows.push(row); }
            else if (etd >= today && etd <= in3) { etd3++; etd3Rows.push(row); }
        }
        if (etd && revised && etd.getTime() !== revised.getTime()) { reschedule++; rescheduleRows.push(row); }
        if (!actualStart) { notStarted++; notStartedRows.push(row); }
    });

    return { rows, etd3, overdue, reschedule, notStarted, etd3Rows, overdueRows, rescheduleRows, notStartedRows };
}

function monitoringAssy(row) { return getCellValue(row, 2) || "-"; }
function monitoringWp(row) { return getCellValue(row, 3) || "-"; }
function monitoringCustomer(row) { return getCellValue(row, 1) || "-"; }

function monitoringRowLabel(row) {
    return `${monitoringAssy(row)} · WP ${monitoringWp(row)} · ${monitoringCustomer(row)}`;
}

function renderMonitoringAlerts() {
    const el = document.getElementById("monitorAlerts");
    if (!el) return;
    const m = monitoringMetrics();
    const alerts = [
        ["OVERDUE", m.overdue, "Order OPEN melewati ETD", "overdueRows"],
        ["ETD ≤ 3 HARI", m.etd3, "Order OPEN mendekati deadline", "etd3Rows"],
        ["RESCHEDULE", m.reschedule, "Order OPEN mengalami perubahan ETD", "rescheduleRows"],
        ["NOT STARTED", m.notStarted, "Order OPEN belum memiliki Actual Start", "notStartedRows"]
    ];
    const active = alerts.filter(a => a[1] > 0);
    if (!active.length) {
        el.innerHTML = `<div class="monitor-empty">Tidak ada alert pada order OPEN saat ini.</div>`;
        return;
    }
    el.innerHTML = active.map(a => `
        <div class="monitor-alert" onclick="monitorFilter('${a[3]}')">
            <div class="monitor-alert-main"><div class="monitor-alert-title">${escapeHTML(a[0])}</div><div class="monitor-alert-sub">${escapeHTML(a[2])}</div></div>
            <span class="monitor-badge">${a[1]}</span>
        </div>`).join("");
}

function renderMonitoringCenter() {
    const m = monitoringMetrics();
    const map = {
        monitorEtd3: m.etd3,
        monitorOverdue: m.overdue,
        monitorReschedule: m.reschedule,
        monitorNotStarted: m.notStarted
    };
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) el.textContent = map[id]; });
    renderMonitoringAlerts();
    renderMonitoringCalendar();
}

function refreshMonitoringCenter() {
    renderMonitoringCenter();
    const input = document.getElementById("monitorGlobalSearch");
    if (input && input.value.trim()) runGlobalSearch();
}

function monitorFilter(type) {
    const m = monitoringMetrics();
    const sets = {
        etd3: m.etd3Rows,
        overdue: m.overdueRows,
        reschedule: m.rescheduleRows,
        notstarted: m.notStartedRows,
        etd3Rows: m.etd3Rows,
        overdueRows: m.overdueRows,
        rescheduleRows: m.rescheduleRows,
        notStartedRows: m.notStartedRows
    };
    const rows = sets[type] || [];
    const detail = document.getElementById("monitorDayDetail");
    const title = document.getElementById("monitorDayTitle");
    const list = document.getElementById("monitorDayList");
    if (!detail || !title || !list) return;
    title.textContent = `Detail — ${String(type).toUpperCase()}`;
    list.innerHTML = rows.length ? rows.map(row => `
        <div class="monitor-alert" onclick="openProgressRowFromMonitoring(${allProgressRows.indexOf(row)})">
            <div class="monitor-alert-main"><div class="monitor-alert-title">${escapeHTML(monitoringRowLabel(row))}</div><div class="monitor-alert-sub">ETD: ${escapeHTML(getCellValue(row,7) || "-")} · QTY: ${escapeHTML(getCellValue(row,5) || "-")}</div></div>
            <span class="monitor-badge">OPEN</span>
        </div>`).join("") : `<div class="monitor-empty">Tidak ada data.</div>`;
    detail.style.display = "block";
    detail.scrollIntoView({behavior:"smooth", block:"nearest"});
}

function openProgressRowFromMonitoring(index) {
    showPage("progress");
    const row = allProgressRows[index];
    if (!row) return;
    const assy = getCellValue(row,2);
    const input = document.getElementById("progressAssyFilter");
    if (input) { input.value = assy; applyFilters(); }
}

function changeMonitoringMonth(delta) {
    monitoringMonth = new Date(monitoringMonth.getFullYear(), monitoringMonth.getMonth() + delta, 1);
    renderMonitoringCalendar();
}

function renderMonitoringCalendar() {
    const el = document.getElementById("monitorCalendar");
    const title = document.getElementById("monitorMonthTitle");
    if (!el || !title) return;
    const year = monitoringMonth.getFullYear();
    const month = monitoringMonth.getMonth();
    title.textContent = monitoringMonth.toLocaleDateString("id-ID", {month:"long", year:"numeric"});

    const weekdays = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    let html = weekdays.map(d => `<div class="monitor-weekday">${d}</div>`).join("");

    for (let i=0; i<42; i++) {
        const offset = i - startDay + 1;
        const dayDate = new Date(year, month, offset);
        const inMonth = offset >= 1 && offset <= daysInMonth;
        const dayNum = dayDate.getDate();
        const rows = monitoringOpenRows().filter(row => monitoringSameDate(monitoringDateOnly(getCellValue(row,7)), dayDate));
        const today = monitoringSameDate(dayDate, monitoringTodayStart());
        html += `<div class="monitor-day ${inMonth ? "" : "muted"} ${today ? "today" : ""}" onclick="showMonitoringDay(${dayDate.getFullYear()},${dayDate.getMonth()},${dayDate.getDate()})">
            <div class="monitor-day-num">${dayNum}</div>
            ${rows.slice(0,3).map(r => `<div class="monitor-event">${escapeHTML(monitoringAssy(r))}</div>`).join("")}
            ${rows.length > 3 ? `<div class="monitor-event">+${rows.length-3} lainnya</div>` : ""}
        </div>`;
        if (i >= 35 && dayDate.getMonth() !== month && dayDate.getDay() === 6) break;
    }
    el.innerHTML = html;
}

function showMonitoringDay(y,m,d) {
    const date = new Date(y,m,d);
    const rows = monitoringOpenRows().filter(row => monitoringSameDate(monitoringDateOnly(getCellValue(row,7)), date));
    const detail = document.getElementById("monitorDayDetail");
    const title = document.getElementById("monitorDayTitle");
    const list = document.getElementById("monitorDayList");
    if (!detail || !title || !list) return;
    title.textContent = `ETD ${date.toLocaleDateString("id-ID", {day:"2-digit", month:"long", year:"numeric"})} — ${rows.length} OPEN`;
    list.innerHTML = rows.length ? rows.map(row => `<div class="monitor-alert" onclick="openProgressRowFromMonitoring(${allProgressRows.indexOf(row)})"><div class="monitor-alert-main"><div class="monitor-alert-title">${escapeHTML(monitoringRowLabel(row))}</div><div class="monitor-alert-sub">QTY: ${escapeHTML(getCellValue(row,5)||"-")} · CCT: ${escapeHTML(getCellValue(row,4)||"-")}</div></div><span class="monitor-badge">OPEN</span></div>`).join("") : `<div class="monitor-empty">Tidak ada order OPEN dengan ETD pada tanggal ini.</div>`;
    detail.style.display = "block";
}

function runGlobalSearch() {
    const input = document.getElementById("monitorGlobalSearch");
    const out = document.getElementById("monitorSearchResults");
    if (!input || !out) return;
    const q = input.value.trim().toLowerCase();
    if (!q) { out.innerHTML = `<div class="monitor-empty">Ketik kata kunci untuk mencari ke Progress dan Problem.</div>`; return; }

    const progressHits = (allProgressRows || []).filter(row => row.join(" ").toLowerCase().includes(q)).slice(0,25);
    const problemHits = (allProblemRows || []).filter(row => row.join(" ").toLowerCase().includes(q)).slice(0,25);
    let html = "";
    progressHits.forEach(row => {
        html += `<div class="monitor-result" onclick="openProgressRowFromMonitoring(${allProgressRows.indexOf(row)})"><strong>📈 Progress · ${escapeHTML(monitoringAssy(row))}</strong><small>${escapeHTML(monitoringCustomer(row))} · WP ${escapeHTML(monitoringWp(row))} · Status ${escapeHTML(getRowStatus(row)||"-")}</small></div>`;
    });
    problemHits.forEach(row => {
        const values = row.slice(0,8).join(" · ");
        html += `<div class="monitor-result"><strong>⚠️ Problem · ${escapeHTML(values || "Data")}</strong><small>Hasil ditemukan di sheet Problem. Buka halaman Problem untuk filter/detail.</small></div>`;
    });
    if (!html) html = `<div class="monitor-empty">Tidak ditemukan data untuk “${escapeHTML(input.value)}”.</div>`;
    out.innerHTML = html;
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        const input = document.getElementById("monitorGlobalSearch");
        if (input) input.addEventListener("input", runGlobalSearch);
    });
}

