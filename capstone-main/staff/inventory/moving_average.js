(() => {
  "use strict";

  const ITEMS_KEY = "dentanueva_inventory_items";
  const MOVEMENTS_KEY = "dentanueva_inventory_movements";

  const DEFAULT_WINDOW = 3;
  const MIN_REQUIRED_VALUES = 3;

  function getItems() {
    try {
      const raw = localStorage.getItem(ITEMS_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Unable to load inventory items:", error);
      return [];
    }
  }

  function getMovements() {
    try {
      const raw = localStorage.getItem(MOVEMENTS_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Unable to load inventory movements:", error);
      return [];
    }
  }

  function getStockOutMovements(itemId = null) {
    return getMovements()
      .filter((movement) => {
        if (movement.type !== "stock-out") {
          return false;
        }

        if (itemId === null) {
          return true;
        }

        return String(movement.itemId) === String(itemId);
      })
      .filter((movement) => {
        const quantity = Number(movement.quantity);

        return Number.isFinite(quantity) && quantity > 0;
      })
      .filter((movement) => {
        const date = new Date(movement.date || "");

        return !Number.isNaN(date.getTime());
      })
      .sort((a, b) => {
        const aTime = new Date(a.date || "").getTime();
        const bTime = new Date(b.date || "").getTime();

        return aTime - bTime;
      });
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function parseDateKey(dateKey) {
    const parts = String(dateKey).split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
  }

  function getDailyDemandSeries(itemId = null) {
    const movements = getStockOutMovements(itemId);

    if (!movements.length) {
      return [];
    }

    const dailyTotals = new Map();

    movements.forEach((movement) => {
      const date = new Date(movement.date);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      date.setHours(0, 0, 0, 0);

      const dateKey = formatDateKey(date);
      const quantity = Number(movement.quantity) || 0;

      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + quantity);
    });

    const dateKeys = [...dailyTotals.keys()].sort();

    if (!dateKeys.length) {
      return [];
    }

    const firstDate = parseDateKey(dateKeys[0]);
    const lastDate = parseDateKey(dateKeys[dateKeys.length - 1]);

    if (!firstDate || !lastDate) {
      return [];
    }

    const series = [];
    const currentDate = new Date(firstDate);

    while (currentDate <= lastDate) {
      const dateKey = formatDateKey(currentDate);

      series.push({
        value: Number(dailyTotals.get(dateKey) || 0),
        date: dateKey,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return series;
  }

  function getUsageValues(itemId = null) {
    return getDailyDemandSeries(itemId).map((entry) => Number(entry.value));
  }

  function calculateMovingAverage(values, windowSize = DEFAULT_WINDOW) {
    if (!Array.isArray(values)) {
      return null;
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const window = Math.max(1, Number(windowSize) || DEFAULT_WINDOW);

    if (numericValues.length < window) {
      return null;
    }

    const selectedValues = numericValues.slice(-window);

    if (!selectedValues.length) {
      return null;
    }

    const total = selectedValues.reduce((sum, value) => sum + value, 0);

    return total / selectedValues.length;
  }

  function calculateMovingAverageSeries(values, windowSize = DEFAULT_WINDOW) {
    if (!Array.isArray(values)) {
      return [];
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const window = Math.max(1, Number(windowSize) || DEFAULT_WINDOW);

    if (numericValues.length < window) {
      return [];
    }

    const series = [];

    for (let index = window; index <= numericValues.length; index++) {
      const windowValues = numericValues.slice(index - window, index);

      const total = windowValues.reduce((sum, value) => sum + value, 0);

      series.push(total / windowValues.length);
    }

    return series;
  }

  function forecastNextPeriod(values, windowSize = DEFAULT_WINDOW) {
    const average = calculateMovingAverage(values, windowSize);

    if (average === null) {
      return null;
    }

    return Math.max(0, average);
  }

  function calculateMAPE(actualValues, predictedValues) {
    if (
      !Array.isArray(actualValues) ||
      !Array.isArray(predictedValues) ||
      actualValues.length === 0 ||
      actualValues.length !== predictedValues.length
    ) {
      return null;
    }

    const validPairs = actualValues
      .map((actual, index) => ({
        actual: Number(actual),
        predicted: Number(predictedValues[index]),
      }))
      .filter(
        (pair) =>
          Number.isFinite(pair.actual) &&
          Number.isFinite(pair.predicted) &&
          pair.actual !== 0,
      );

    if (!validPairs.length) {
      return null;
    }

    return (
      (validPairs.reduce(
        (sum, pair) =>
          sum + Math.abs((pair.actual - pair.predicted) / pair.actual),
        0,
      ) /
        validPairs.length) *
      100
    );
  }

  function calculateRMSE(actualValues, predictedValues) {
    if (
      !Array.isArray(actualValues) ||
      !Array.isArray(predictedValues) ||
      actualValues.length === 0 ||
      actualValues.length !== predictedValues.length
    ) {
      return null;
    }

    const validPairs = actualValues
      .map((actual, index) => ({
        actual: Number(actual),
        predicted: Number(predictedValues[index]),
      }))
      .filter(
        (pair) =>
          Number.isFinite(pair.actual) && Number.isFinite(pair.predicted),
      );

    if (!validPairs.length) {
      return null;
    }

    const meanSquaredError =
      validPairs.reduce(
        (sum, pair) => sum + Math.pow(pair.actual - pair.predicted, 2),
        0,
      ) / validPairs.length;

    return Math.sqrt(meanSquaredError);
  }

  function evaluateMovingAverage(values, windowSize = DEFAULT_WINDOW) {
    if (!Array.isArray(values)) {
      return { actual: [], predictions: [], mape: null, rmse: null };
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const predictions = [];
    const actual = [];

    // Use an expanding warm-up window until the selected SMA window is reached.
    for (let index = 1; index < numericValues.length; index += 1) {
      const history = numericValues.slice(0, index);
      const prediction = forecastNextPeriod(
        history,
        Math.min(Number(windowSize) || DEFAULT_WINDOW, history.length),
      );

      if (prediction === null) {
        continue;
      }

      predictions.push(prediction);
      actual.push(numericValues[index]);
    }

    return {
      actual,
      predictions,
      mape: calculateMAPE(actual, predictions),
      rmse: calculateRMSE(actual, predictions),
    };
  }

  function roundForecast(value) {
    if (!Number.isFinite(Number(value))) {
      return null;
    }

    return Math.max(0, Math.round(Number(value)));
  }

  function buildMovingAverageResult(values, windowSize = DEFAULT_WINDOW) {
    if (!Array.isArray(values)) {
      return {
        available: false,
        windowSize,
        records: 0,
        totalUsed: 0,
        average: null,
        roundedForecast: null,
        series: [],
      };
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const normalizedWindow = Math.max(1, Number(windowSize) || DEFAULT_WINDOW);

    const totalUsed = numericValues.reduce((sum, value) => sum + value, 0);

    const hasEnoughData =
      numericValues.length >= Math.max(MIN_REQUIRED_VALUES, normalizedWindow);

    if (!hasEnoughData) {
      return {
        available: false,
        windowSize: normalizedWindow,
        records: numericValues.length,
        totalUsed,
        average: null,
        roundedForecast: null,
        series: [],
      };
    }

    const average = calculateMovingAverage(numericValues, normalizedWindow);

    const series = calculateMovingAverageSeries(
      numericValues,
      normalizedWindow,
    );

    return {
      available: average !== null,
      windowSize: normalizedWindow,
      records: numericValues.length,
      totalUsed,
      average,
      roundedForecast: roundForecast(average),
      series,
    };
  }

  function getItemMovingAverage(itemId, windowSize = DEFAULT_WINDOW) {
    const values = getUsageValues(itemId);

    return buildMovingAverageResult(values, windowSize);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMetric(value, decimals = 2) {
    if (!Number.isFinite(Number(value))) {
      return "—";
    }

    return Number(value).toFixed(decimals);
  }

  function renderForecastTable() {
    const tableBody = document.getElementById("forecastTableBody");

    const emptyState = document.getElementById("forecastEmpty");

    if (!tableBody) {
      return;
    }

    tableBody.innerHTML = "";

    const items = getItems();

    if (!items.length) {
      if (emptyState) {
        emptyState.hidden = false;
      }

      return;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }

    items.forEach((item) => {
      const demandSeries = getDailyDemandSeries(item.id);

      const values = demandSeries.map((entry) => Number(entry.value) || 0);

      const result = buildMovingAverageResult(values, DEFAULT_WINDOW);

      const status = result.available
        ? "Ready"
        : `${result.records}/${Math.max(
            MIN_REQUIRED_VALUES,
            DEFAULT_WINDOW,
          )} Records`;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>
          <div class="forecast-item-cell">
            <div class="forecast-item-icon">
              <i class="fa-solid fa-box"></i>
            </div>
            <div>
              <span class="forecast-item-name">
                ${escapeHTML(item.name)}
              </span>
            </div>
          </div>
        </td>
        <td>
          <span class="forecast-number">
            ${result.records}
          </span>
        </td>
        <td>
          <span class="forecast-average">
            ${result.average === null ? "—" : formatMetric(result.average)}
          </span>
          <span class="forecast-unit">
            ${escapeHTML(item.unit || "")}
          </span>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  function refreshInventoryForecast() {
    renderForecastTable();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === MOVEMENTS_KEY || event.key === ITEMS_KEY) {
      renderForecastTable();
    }
  });

  window.DentaNuevaMovingAverage = {
    ITEMS_KEY,
    MOVEMENTS_KEY,
    DEFAULT_WINDOW,
    MIN_REQUIRED_VALUES,
    getItems,
    getMovements,
    getStockOutMovements,
    getDailyDemandSeries,
    getUsageValues,
    calculateMovingAverage,
    calculateMovingAverageSeries,
    forecastNextPeriod,
    calculateMAPE,
    calculateRMSE,
    evaluateMovingAverage,
    roundForecast,
    buildMovingAverageResult,
    getItemMovingAverage,
    renderForecastTable,
    refreshInventoryForecast,
  };

  window.refreshInventoryForecast = refreshInventoryForecast;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshInventoryForecast, {
      once: true,
    });
  } else {
    refreshInventoryForecast();
  }
})();
