(() => {
  "use strict";

  const ITEMS_KEY = "dentanueva_inventory_items";
  const MOVEMENTS_KEY = "dentanueva_inventory_movements";

  const MOVING_AVERAGE_WINDOW = 3;
  const MINIMUM_RECORDS_FOR_ML = 8;
  const TRAINING_RATIO = 0.8;
  const EPOCHS = 80;
  const BATCH_SIZE = 4;
  const LOOKBACK = 3;
  const DEMAND_FORECAST_PAGE_SIZE = 10;

  let demandForecastCurrentPage = 1;
  let demandForecastSearchTerm = "";
  let forecastChartInstance = null;
  let forecastChartResults = [];
  let forecastChartSelectedItemId = "";

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

  function getStockOutMovements(itemId) {
    return getMovements()
      .filter(
        (movement) =>
          movement.type === "stock-out" &&
          String(movement.itemId) === String(itemId),
      )
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

  function getDailyDemandSeries(itemId) {
    if (
      window.DentaNuevaMovingAverage &&
      typeof window.DentaNuevaMovingAverage.getDailyDemandSeries === "function"
    ) {
      return window.DentaNuevaMovingAverage.getDailyDemandSeries(itemId);
    }

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

  function getDemandSeries(itemId) {
    return getDailyDemandSeries(itemId);
  }

  function normalizeSeries(values) {
    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (!numericValues.length) {
      return {
        values: [],
        min: 0,
        max: 1,
      };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    if (min === max) {
      return {
        values: numericValues.map(() => 0.5),
        min,
        max: min + 1,
      };
    }

    return {
      values: numericValues.map((value) => (value - min) / (max - min)),
      min,
      max,
    };
  }

  function denormalizeValue(value, min, max) {
    return Number(value) * (max - min) + min;
  }

  function createTrainingSequences(values, lookback = LOOKBACK) {
    const sequences = [];
    const targets = [];

    const normalizedLookback = Math.max(1, Number(lookback) || LOOKBACK);

    for (let index = normalizedLookback; index < values.length; index++) {
      const input = values.slice(index - normalizedLookback, index);
      const target = values[index];

      sequences.push(input);
      targets.push(target);
    }

    return {
      sequences,
      targets,
    };
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

    const totalPercentageError = validPairs.reduce(
      (sum, pair) =>
        sum + Math.abs((pair.actual - pair.predicted) / pair.actual),
      0,
    );

    return (totalPercentageError / validPairs.length) * 100;
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

  function calculateMovingAveragePrediction(
    trainingValues,
    actualValues,
    windowSize = MOVING_AVERAGE_WINDOW,
  ) {
    if (
      !window.DentaNuevaMovingAverage ||
      !Array.isArray(trainingValues) ||
      !Array.isArray(actualValues)
    ) {
      return {
        predictions: [],
        mape: null,
        rmse: null,
      };
    }

    const history = [...trainingValues];
    const predictions = [];

    actualValues.forEach((actualValue) => {
      const prediction = window.DentaNuevaMovingAverage.forecastNextPeriod(
        history,
        windowSize,
      );

      if (prediction === null) {
        return;
      }

      predictions.push(prediction);
      history.push(Number(actualValue));
    });

    const alignedLength = Math.min(actualValues.length, predictions.length);
    const alignedActualValues = actualValues.slice(0, alignedLength);
    const alignedPredictions = predictions.slice(0, alignedLength);

    return {
      predictions: alignedPredictions,
      mape: calculateMAPE(alignedActualValues, alignedPredictions),
      rmse: calculateRMSE(alignedActualValues, alignedPredictions),
    };
  }

  function calculateSMABaseline(values) {
    if (!Array.isArray(values) || values.length < MOVING_AVERAGE_WINDOW + 1) {
      return {
        predictions: [],
        actual: [],
        mape: null,
        rmse: null,
      };
    }

    const trainingLength = Math.max(
      MOVING_AVERAGE_WINDOW,
      Math.floor(values.length * TRAINING_RATIO),
    );

    if (trainingLength >= values.length) {
      return {
        predictions: [],
        actual: [],
        mape: null,
        rmse: null,
      };
    }

    const trainingValues = values.slice(0, trainingLength);
    const actualValues = values.slice(trainingLength);

    const result = calculateMovingAveragePrediction(
      trainingValues,
      actualValues,
      MOVING_AVERAGE_WINDOW,
    );

    return {
      predictions: result.predictions,
      actual: actualValues.slice(0, result.predictions.length),
      mape: result.mape,
      rmse: result.rmse,
    };
  }

  async function trainMLModel(values) {
    if (typeof tf === "undefined") {
      throw new Error(
        "TensorFlow.js is not available. Load TensorFlow.js before demand_forecasting.js.",
      );
    }

    if (!Array.isArray(values) || values.length < MINIMUM_RECORDS_FOR_ML) {
      return null;
    }

    const normalized = normalizeSeries(values);

    const sequencesData = createTrainingSequences(normalized.values, LOOKBACK);

    if (
      sequencesData.sequences.length < 3 ||
      sequencesData.targets.length < 3
    ) {
      return null;
    }

    const splitIndex = Math.max(
      1,
      Math.floor(sequencesData.sequences.length * TRAINING_RATIO),
    );

    const trainingSequences = sequencesData.sequences.slice(0, splitIndex);
    const trainingTargets = sequencesData.targets.slice(0, splitIndex);
    const testingSequences = sequencesData.sequences.slice(splitIndex);

    if (
      trainingSequences.length < 3 ||
      trainingTargets.length < 3 ||
      testingSequences.length < 1
    ) {
      return null;
    }

    const xTrain = tf.tensor2d(trainingSequences);
    const yTrain = tf.tensor2d(trainingTargets.map((value) => [value]));

    const model = tf.sequential();

    model.add(
      tf.layers.dense({
        inputShape: [LOOKBACK],
        units: 16,
        activation: "relu",
      }),
    );

    model.add(
      tf.layers.dense({
        units: 8,
        activation: "relu",
      }),
    );

    model.add(
      tf.layers.dense({
        units: 1,
      }),
    );

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "meanSquaredError",
    });

    await model.fit(xTrain, yTrain, {
      epochs: EPOCHS,
      batchSize: BATCH_SIZE,
      shuffle: false,
      verbose: 0,
    });

    xTrain.dispose();
    yTrain.dispose();

    let testPredictions = [];

    if (testingSequences.length > 0) {
      const xTest = tf.tensor2d(testingSequences);
      const predictionTensor = model.predict(xTest);
      const predictionValues = Array.from(await predictionTensor.data());

      xTest.dispose();
      predictionTensor.dispose();

      testPredictions = predictionValues.map((value) =>
        Math.max(0, denormalizeValue(value, normalized.min, normalized.max)),
      );
    }

    const testStartIndex = LOOKBACK + trainingSequences.length;
    const actualTestValues = values.slice(testStartIndex);

    const alignedLength = Math.min(
      actualTestValues.length,
      testPredictions.length,
    );

    const alignedActualValues = actualTestValues.slice(0, alignedLength);
    const alignedPredictions = testPredictions.slice(0, alignedLength);

    const mape = calculateMAPE(alignedActualValues, alignedPredictions);
    const rmse = calculateRMSE(alignedActualValues, alignedPredictions);

    const recentValues = normalized.values.slice(-LOOKBACK);

    let nextForecast = null;

    if (recentValues.length === LOOKBACK) {
      const inputTensor = tf.tensor2d([recentValues]);
      const predictionTensor = model.predict(inputTensor);
      const predictionData = Array.from(await predictionTensor.data());

      inputTensor.dispose();
      predictionTensor.dispose();

      if (predictionData.length) {
        nextForecast = Math.max(
          0,
          denormalizeValue(predictionData[0], normalized.min, normalized.max),
        );
      }
    }

    model.dispose();

    return {
      nextForecast,
      testActual: alignedActualValues,
      testPredictions: alignedPredictions,
      trainingRecords: trainingSequences.length,
      testingRecords: testingSequences.length,
      testStartIndex,
      mape,
      rmse,
    };
  }

  async function forecastItem(itemId) {
    const demandSeries = getDemandSeries(itemId);
    const values = demandSeries.map((entry) => Number(entry.value));

    const movingAverage =
      window.DentaNuevaMovingAverage &&
      typeof window.DentaNuevaMovingAverage.buildMovingAverageResult ===
        "function"
        ? window.DentaNuevaMovingAverage.buildMovingAverageResult(
            values,
            MOVING_AVERAGE_WINDOW,
          )
        : null;

    const smaEvaluation = calculateSMABaseline(values);

    if (values.length < MINIMUM_RECORDS_FOR_ML) {
      return {
        ready: false,
        reason: "insufficient-data",
        itemId,
        records: values.length,
        requiredRecords: MINIMUM_RECORDS_FOR_ML,
        movingAverage,
        sma: smaEvaluation,
        ml: null,
        demandSeries,
      };
    }

    try {
      const mlResult = await trainMLModel(values);

      return {
        ready: Boolean(mlResult),
        reason: mlResult ? "ready" : "insufficient-data",
        itemId,
        records: values.length,
        requiredRecords: MINIMUM_RECORDS_FOR_ML,
        movingAverage,
        sma: smaEvaluation,
        ml: mlResult,
        demandSeries,
      };
    } catch (error) {
      console.error(`Unable to generate forecast for item ${itemId}:`, error);

      return {
        ready: false,
        reason: "model-error",
        itemId,
        records: values.length,
        requiredRecords: MINIMUM_RECORDS_FOR_ML,
        movingAverage,
        sma: smaEvaluation,
        ml: null,
        demandSeries,
        error: error.message,
      };
    }
  }

  async function forecastAllItems() {
    const items = getItems();
    const results = [];

    for (const item of items) {
      const result = await forecastItem(item.id);

      results.push({
        item,
        ...result,
      });
    }

    return results;
  }

  function formatMetric(value, decimals = 2) {
    if (!Number.isFinite(Number(value))) {
      return "—";
    }

    return Number(value).toFixed(decimals);
  }

  function formatForecast(value) {
    if (!Number.isFinite(Number(value))) {
      return "—";
    }

    return Math.max(0, Math.round(Number(value)));
  }

  function getStatus(result) {
    if (!result) {
      return "Insufficient Data";
    }

    if (result.ready) {
      return "Ready";
    }

    if (result.reason === "model-error") {
      return "Model Error";
    }

    return "Insufficient Data";
  }

  function getDemandForecastStatus(result) {
    if (!result) {
      return "Insufficient Data";
    }

    if (result.ready && result.ml) {
      return "Ready";
    }

    if (result.reason === "model-error") {
      return "Model Error";
    }

    return `${result.records}/${result.requiredRecords} Records`;
  }

  async function generateForecastReport() {
    const results = await forecastAllItems();

    const readyResults = results.filter((result) => result.ready && result.ml);

    const allActual = [];
    const allPredicted = [];
    const allSMAActual = [];
    const allSMAPredicted = [];

    readyResults.forEach((result) => {
      if (
        Array.isArray(result.ml.testActual) &&
        Array.isArray(result.ml.testPredictions)
      ) {
        allActual.push(...result.ml.testActual);
        allPredicted.push(...result.ml.testPredictions);
      }

      if (
        result.sma &&
        Array.isArray(result.sma.actual) &&
        Array.isArray(result.sma.predictions)
      ) {
        allSMAActual.push(...result.sma.actual);
        allSMAPredicted.push(...result.sma.predictions);
      }
    });

    const overallMLMAPE = calculateMAPE(allActual, allPredicted);
    const overallMLRMSE = calculateRMSE(allActual, allPredicted);
    const overallSMAMAPE = calculateMAPE(allSMAActual, allSMAPredicted);
    const overallSMARMSE = calculateRMSE(allSMAActual, allSMAPredicted);

    return {
      generatedAt: new Date().toISOString(),
      results,
      summary: {
        totalItems: results.length,
        readyItems: readyResults.length,
        insufficientItems: results.length - readyResults.length,
        overallSMAMAPE,
        overallSMARMSE,
        overallMLMAPE,
        overallMLRMSE,
      },
    };
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateDemandForecastPagination(totalItems) {
    const pagination = document.getElementById("demandForecastPagination");
    const summary = document.getElementById("demandForecastPaginationSummary");
    const pageInfo = document.getElementById(
      "demandForecastPaginationPageInfo",
    );
    const previousButton = document.getElementById("demandForecastPrevPageBtn");
    const nextButton = document.getElementById("demandForecastNextPageBtn");

    if (
      !pagination ||
      !summary ||
      !pageInfo ||
      !previousButton ||
      !nextButton
    ) {
      return;
    }

    const totalPages = Math.max(
      1,
      Math.ceil(totalItems / DEMAND_FORECAST_PAGE_SIZE),
    );

    demandForecastCurrentPage = Math.min(
      Math.max(1, demandForecastCurrentPage),
      totalPages,
    );

    if (totalItems <= DEMAND_FORECAST_PAGE_SIZE) {
      pagination.style.display = "none";
    } else {
      pagination.style.display = "flex";
    }

    const startItem =
      totalItems === 0
        ? 0
        : (demandForecastCurrentPage - 1) * DEMAND_FORECAST_PAGE_SIZE + 1;

    const endItem =
      totalItems === 0
        ? 0
        : Math.min(
            demandForecastCurrentPage * DEMAND_FORECAST_PAGE_SIZE,
            totalItems,
          );

    summary.textContent = `Showing ${startItem}–${endItem} of ${totalItems} items`;
    pageInfo.textContent = `Page ${demandForecastCurrentPage} of ${totalPages}`;

    previousButton.disabled = demandForecastCurrentPage <= 1;
    nextButton.disabled = demandForecastCurrentPage >= totalPages;
  }

  function updateForecastChartItems(results) {
    const select = document.getElementById("forecastChartItem");
    const section = document.getElementById("forecastChartSection");

    if (!select || !section) {
      return;
    }

    const chartResults = results.filter(
      (result) =>
        Array.isArray(result.demandSeries) && result.demandSeries.length > 0,
    );

    forecastChartResults = chartResults;

    select.innerHTML = "";

    if (!chartResults.length) {
      select.innerHTML = '<option value="">No data available</option>';
      section.hidden = true;
      destroyForecastChart();
      return;
    }

    chartResults.forEach((result) => {
      const option = document.createElement("option");
      option.value = String(result.item.id);
      option.textContent = result.item.name || "Unnamed Item";
      select.appendChild(option);
    });

    const selectedStillExists = chartResults.some(
      (result) =>
        String(result.item.id) === String(forecastChartSelectedItemId),
    );

    if (!selectedStillExists) {
      forecastChartSelectedItemId = String(chartResults[0].item.id);
    }

    select.value = forecastChartSelectedItemId;
    section.hidden = false;

    renderForecastChart(forecastChartSelectedItemId);
  }

  function getForecastChartData(result) {
    if (!result || !Array.isArray(result.demandSeries)) {
      return null;
    }

    const demandSeries = result.demandSeries;

    if (!demandSeries.length) {
      return null;
    }

    const labels = demandSeries.map((entry) => entry.date);

    const actualData = demandSeries.map((entry) => {
      const value = Number(entry.value);
      return Number.isFinite(value) ? value : 0;
    });

    const smaData = new Array(demandSeries.length).fill(null);

    if (
      result.sma &&
      Array.isArray(result.sma.predictions) &&
      result.sma.predictions.length
    ) {
      const smaStartIndex = Math.max(
        0,
        demandSeries.length - result.sma.predictions.length,
      );

      result.sma.predictions.forEach((prediction, index) => {
        const targetIndex = smaStartIndex + index;

        if (targetIndex < smaData.length) {
          const numericPrediction = Number(prediction);

          smaData[targetIndex] = Number.isFinite(numericPrediction)
            ? Number(numericPrediction.toFixed(2))
            : null;
        }
      });
    }

    const mlData = new Array(demandSeries.length).fill(null);

    if (
      result.ml &&
      Array.isArray(result.ml.testPredictions) &&
      result.ml.testPredictions.length
    ) {
      const mlStartIndex = Number.isInteger(result.ml.testStartIndex)
        ? result.ml.testStartIndex
        : Math.max(0, demandSeries.length - result.ml.testPredictions.length);

      result.ml.testPredictions.forEach((prediction, index) => {
        const targetIndex = mlStartIndex + index;

        if (targetIndex < mlData.length) {
          const numericPrediction = Number(prediction);

          mlData[targetIndex] = Number.isFinite(numericPrediction)
            ? Number(numericPrediction.toFixed(2))
            : null;
        }
      });
    }

    return {
      labels,
      actualData,
      smaData,
      mlData,
    };
  }

  function formatChartDate(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function destroyForecastChart() {
    if (forecastChartInstance) {
      forecastChartInstance.destroy();
      forecastChartInstance = null;
    }
  }

  function renderForecastChart(itemId) {
    const canvas = document.getElementById("forecastDemandChart");
    const chartSection = document.getElementById("forecastChartSection");
    const chartEmpty = document.getElementById("forecastChartEmpty");

    if (!canvas || !chartSection || !chartEmpty) {
      return;
    }

    if (typeof Chart === "undefined") {
      chartSection.hidden = false;
      chartEmpty.hidden = false;

      const heading = chartEmpty.querySelector("h3");
      const paragraph = chartEmpty.querySelector("p");

      if (heading) {
        heading.textContent = "Chart library unavailable";
      }

      if (paragraph) {
        paragraph.textContent =
          "The demand chart could not be loaded. Please check the Chart.js connection.";
      }

      destroyForecastChart();
      return;
    }

    const result = forecastChartResults.find(
      (entry) => String(entry.item.id) === String(itemId),
    );

    const chartData = getForecastChartData(result);

    if (!result || !chartData || !chartData.labels.length) {
      chartEmpty.hidden = false;
      destroyForecastChart();
      return;
    }

    chartEmpty.hidden = true;

    destroyForecastChart();

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    forecastChartInstance = new Chart(context, {
      type: "line",
      data: {
        labels: chartData.labels.map(formatChartDate),
        datasets: [
          {
            label: "Actual Demand",
            data: chartData.actualData,
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 2.5,
            pointHoverRadius: 4,
            spanGaps: true,
          },
          {
            label: "SMA Forecast",
            data: chartData.smaData,
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.25,
            pointRadius: 2,
            pointHoverRadius: 4,
            spanGaps: false,
          },
          {
            label: "ML Forecast",
            data: chartData.mlData,
            borderWidth: 2,
            borderDash: [3, 3],
            tension: 0.25,
            pointRadius: 2,
            pointHoverRadius: 4,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "start",
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 15,
              font: {
                family: "Poppins",
                size: 11,
                weight: "600",
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;

                if (value === null || typeof value === "undefined") {
                  return `${context.dataset.label}: —`;
                }

                return `${context.dataset.label}: ${Number(value).toFixed(2)} ${result.item.unit || ""}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10,
              font: {
                family: "Poppins",
                size: 9,
              },
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: `Quantity (${result.item.unit || "units"})`,
              font: {
                family: "Poppins",
                size: 10,
                weight: "600",
              },
            },
            ticks: {
              precision: 0,
              font: {
                family: "Poppins",
                size: 9,
              },
            },
          },
        },
      },
    });
  }

  function bindForecastChartSelect() {
    const select = document.getElementById("forecastChartItem");

    if (!select || select.dataset.bound === "true") {
      return;
    }

    select.dataset.bound = "true";

    select.addEventListener("change", () => {
      forecastChartSelectedItemId = select.value;
      renderForecastChart(forecastChartSelectedItemId);
    });
  }

  async function renderDemandForecastTable() {
    const tableBody = document.getElementById("demandForecastTableBody");
    const emptyState = document.getElementById("demandForecastEmpty");

    if (!tableBody) {
      return;
    }

    tableBody.innerHTML = "";

    const results = await forecastAllItems();

    updateForecastChartItems(results);

    const normalizedSearchTerm = demandForecastSearchTerm.trim().toLowerCase();

    const filteredResults = normalizedSearchTerm
      ? results.filter((result) =>
          String(result.item.name || "")
            .toLowerCase()
            .includes(normalizedSearchTerm),
        )
      : results;

    if (!results.length) {
      if (emptyState) {
        emptyState.hidden = false;
      }

      updateDemandForecastPagination(0);
      return;
    }

    if (!filteredResults.length) {
      if (emptyState) {
        emptyState.hidden = false;

        const heading = emptyState.querySelector("h3");
        const paragraph = emptyState.querySelector("p");

        if (heading) {
          heading.textContent = "No forecast items found";
        }

        if (paragraph) {
          paragraph.textContent =
            "Try changing your search to find a forecast item.";
        }
      }

      updateDemandForecastPagination(0);
      return;
    }

    if (emptyState) {
      emptyState.hidden = true;

      const heading = emptyState.querySelector("h3");
      const paragraph = emptyState.querySelector("p");

      if (heading) {
        heading.textContent = "No historical usage data";
      }

      if (paragraph) {
        paragraph.textContent =
          "Record stock-out movements to build historical usage data for demand forecasting.";
      }
    }

    const totalPages = Math.max(
      1,
      Math.ceil(filteredResults.length / DEMAND_FORECAST_PAGE_SIZE),
    );

    demandForecastCurrentPage = Math.min(
      Math.max(1, demandForecastCurrentPage),
      totalPages,
    );

    const startIndex =
      (demandForecastCurrentPage - 1) * DEMAND_FORECAST_PAGE_SIZE;

    const pageResults = filteredResults.slice(
      startIndex,
      startIndex + DEMAND_FORECAST_PAGE_SIZE,
    );

    pageResults.forEach((result) => {
      const item = result.item;

      const movingAverage =
        result.movingAverage &&
        Number.isFinite(Number(result.movingAverage.average))
          ? Number(result.movingAverage.average)
          : null;

      const smaMAPE =
        result.sma && Number.isFinite(Number(result.sma.mape))
          ? Number(result.sma.mape)
          : null;

      const smaRMSE =
        result.sma && Number.isFinite(Number(result.sma.rmse))
          ? Number(result.sma.rmse)
          : null;

      const mlForecast =
        result.ml && Number.isFinite(Number(result.ml.nextForecast))
          ? Number(result.ml.nextForecast)
          : null;

      const mlMAPE =
        result.ml && Number.isFinite(Number(result.ml.mape))
          ? Number(result.ml.mape)
          : null;

      const mlRMSE =
        result.ml && Number.isFinite(Number(result.ml.rmse))
          ? Number(result.ml.rmse)
          : null;

      const status = getDemandForecastStatus(result);

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
            ${movingAverage === null ? "—" : formatMetric(movingAverage)}
          </span>
          <span class="forecast-unit">
            ${escapeHTML(item.unit || "")}
          </span>
        </td>
        <td>
          <span class="forecast-number">
            ${smaMAPE === null ? "—" : `${formatMetric(smaMAPE)}%`}
          </span>
        </td>
        <td>
          <span class="forecast-number">
            ${formatMetric(smaRMSE)}
          </span>
        </td>
        <td>
          <span class="forecast-estimate">
            ${mlForecast === null ? "—" : formatForecast(mlForecast)}
          </span>
          <span class="forecast-unit">
            ${escapeHTML(item.unit || "")}
          </span>
        </td>
        <td>
          <span class="forecast-number">
            ${mlMAPE === null ? "—" : `${formatMetric(mlMAPE)}%`}
          </span>
        </td>
        <td>
          <span class="forecast-number">
            ${formatMetric(mlRMSE)}
          </span>
        </td>
        <td>
          <span class="forecast-number">
            ${escapeHTML(status)}
          </span>
        </td>
      `;

      tableBody.appendChild(row);
    });

    updateDemandForecastPagination(filteredResults.length);
  }

  async function refreshDemandForecast() {
    try {
      await renderDemandForecastTable();
    } catch (error) {
      console.error("Unable to refresh demand forecast:", error);
    }
  }

  function bindDemandForecastSearch() {
    const searchInput = document.getElementById("demandForecastSearch");

    if (!searchInput || searchInput.dataset.bound === "true") {
      return;
    }

    searchInput.dataset.bound = "true";

    searchInput.addEventListener("input", () => {
      demandForecastSearchTerm = searchInput.value;
      demandForecastCurrentPage = 1;
      refreshDemandForecast();
    });
  }

  function bindDemandForecastPagination() {
    const previousButton = document.getElementById("demandForecastPrevPageBtn");
    const nextButton = document.getElementById("demandForecastNextPageBtn");

    if (previousButton && previousButton.dataset.bound !== "true") {
      previousButton.dataset.bound = "true";

      previousButton.addEventListener("click", () => {
        if (demandForecastCurrentPage > 1) {
          demandForecastCurrentPage -= 1;
          refreshDemandForecast();
        }
      });
    }

    if (nextButton && nextButton.dataset.bound !== "true") {
      nextButton.dataset.bound = "true";

      nextButton.addEventListener("click", async () => {
        const results = await forecastAllItems();

        const normalizedSearchTerm = demandForecastSearchTerm
          .trim()
          .toLowerCase();

        const filteredResults = normalizedSearchTerm
          ? results.filter((result) =>
              String(result.item.name || "")
                .toLowerCase()
                .includes(normalizedSearchTerm),
            )
          : results;

        const totalPages = Math.max(
          1,
          Math.ceil(filteredResults.length / DEMAND_FORECAST_PAGE_SIZE),
        );

        if (demandForecastCurrentPage < totalPages) {
          demandForecastCurrentPage += 1;
          refreshDemandForecast();
        }
      });
    }
  }

  window.refreshDemandForecast = refreshDemandForecast;
  window.renderDemandForecastTable = renderDemandForecastTable;

  window.DentaNuevaDemandForecasting = {
    ITEMS_KEY,
    MOVEMENTS_KEY,
    MOVING_AVERAGE_WINDOW,
    MINIMUM_RECORDS_FOR_ML,
    TRAINING_RATIO,
    EPOCHS,
    BATCH_SIZE,
    LOOKBACK,
    DEMAND_FORECAST_PAGE_SIZE,
    getItems,
    getMovements,
    getStockOutMovements,
    getDailyDemandSeries,
    getDemandSeries,
    normalizeSeries,
    denormalizeValue,
    createTrainingSequences,
    calculateMAPE,
    calculateRMSE,
    calculateMovingAveragePrediction,
    calculateSMABaseline,
    trainMLModel,
    forecastItem,
    forecastAllItems,
    formatMetric,
    formatForecast,
    getStatus,
    getDemandForecastStatus,
    generateForecastReport,
    renderDemandForecastTable,
    refreshDemandForecast,
    renderForecastChart,
  };

  const initializeDemandForecast = () => {
    bindDemandForecastSearch();
    bindDemandForecastPagination();
    bindForecastChartSelect();
    refreshDemandForecast();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDemandForecast, {
      once: true,
    });
  } else {
    initializeDemandForecast();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === ITEMS_KEY || event.key === MOVEMENTS_KEY) {
      demandForecastCurrentPage = 1;
      refreshDemandForecast();
    }
  });
})();
