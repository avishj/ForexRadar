/**
 * Chart Manager
 *
 * Configures and manages the ApexCharts multi-series line chart.
 *
 * Series:
 * - Visa Exchange Rate (Left Y-Axis, Emerald, Solid)
 * - Mastercard Exchange Rate (Left Y-Axis, Red, Solid)
 * - Visa Markup % (Right Y-Axis, Amber, Dotted)
 *
 * Supports toggling visibility of individual series via checkbox controls.
 *
 * @module chart-manager
 */

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').SeriesVisibility} SeriesVisibility */

/** @type {import('apexcharts') | null} */
let chartInstance = null;

/** @type {number|undefined} */
let minDataTimestamp = undefined;

/** @type {number|undefined} */
let maxDataTimestamp = undefined;

// Chart color constants
const VISA_RATE_COLOR = "#10b981"; // emerald-500
const MC_RATE_COLOR = "#ef4444"; // red-500
const ECB_RATE_COLOR = "#3b82f6"; // blue-500
const VISA_MARKUP_COLOR = "#f59e0b"; // amber-500

// Series indices for reference
const SERIES_VISA_RATE = 0;
const SERIES_MC_RATE = 1;
const SERIES_ECB_RATE = 2;
const SERIES_VISA_MARKUP = 3;

/**
 * Current visibility state
 * @type {SeriesVisibility}
 */
let currentVisibility = {
	visaRate: true,
	visaMarkup: true,
	mastercardRate: true,
	ecbRate: true
};

/**
 * Gets current series visibility state
 * @returns {SeriesVisibility}
 */
export function getSeriesVisibility() {
	return { ...currentVisibility };
}

/**
 * Sets series visibility and updates chart
 * @param {Partial<SeriesVisibility>} visibility - Visibility settings to update
 */
export function setSeriesVisibility(visibility) {
	currentVisibility = { ...currentVisibility, ...visibility };

	if (chartInstance) {
		// ApexCharts uses showSeries/hideSeries by series name
		if (visibility.visaRate !== undefined) {
			if (visibility.visaRate) {
				chartInstance.showSeries("Visa Rate");
			} else {
				chartInstance.hideSeries("Visa Rate");
			}
		}
		if (visibility.mastercardRate !== undefined) {
			if (visibility.mastercardRate) {
				chartInstance.showSeries("Mastercard Rate");
			} else {
				chartInstance.hideSeries("Mastercard Rate");
			}
		}
		if (visibility.visaMarkup !== undefined) {
			if (visibility.visaMarkup) {
				chartInstance.showSeries("Visa Markup (%)");
			} else {
				chartInstance.hideSeries("Visa Markup (%)");
			}
		}
		if (visibility.ecbRate !== undefined) {
			if (visibility.ecbRate) {
				chartInstance.showSeries("ECB Rate");
			} else {
				chartInstance.hideSeries("ECB Rate");
			}
		}
	}
}

/**
 * Checks if dark mode is active
 * @returns {boolean}
 */
function isDarkMode() {
	return document.documentElement.classList.contains("dark");
}

/**
 * @typedef {Object} ChartOptions
 * @property {Record<string, any>} chart
 * @property {Array<{ name: string, type: string, data: Array<{x: number, y: number}> }>} series
 * @property {Record<string, any>} xaxis
 * @property {Record<string, any>} [theme]
 * @property {Record<string, any>} [stroke]
 * @property {Record<string, any>} [yaxis]
 * @property {Record<string, any>} [grid]
 * @property {Record<string, any>} [legend]
 * @property {Record<string, any>} [tooltip]
 * @property {string[]} [colors]
 * @property {Record<string, any>} [markers]
 */

/**
 * Gets the base chart configuration
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {ChartOptions} ApexCharts options
 */
function getChartOptions(fromCurr, toCurr) {
	const dark = isDarkMode();
	const textColor = dark ? "#a1a1aa" : "#52525b"; // zinc-400/zinc-600
	const gridColor = dark ? "#27272a" : "#e4e4e7"; // zinc-800/zinc-200
	const bgColor = dark ? "#18181b" : "#ffffff"; // zinc-900/white
	const tooltipTheme = dark ? "dark" : "light";

	return {
		chart: {
			type: "line",
			height: 420,
			fontFamily: '"DM Sans", system-ui, sans-serif',
			background: bgColor,
			foreColor: textColor,
			offsetX: 0,
			offsetY: 0,
			toolbar: {
				show: true,
				offsetX: 0,
				offsetY: 0,
				tools: {
					download: true,
					selection: true,
					zoom: true,
					zoomin: true,
					zoomout: true,
					pan: true,
					reset: true
				},
				autoSelected: "zoom"
			},
			zoom: {
				enabled: true
			},
			animations: {
				enabled: true,
				easing: "easeinout",
				speed: 400
			}
		},

		theme: {
			mode: tooltipTheme
		},

		series: [
			{
				name: "Visa Rate",
				type: "line",
				data: []
			},
			{
				name: "Mastercard Rate",
				type: "line",
				data: []
			},
			{
				name: "ECB Rate",
				type: "line",
				data: []
			},
			{
				name: "Visa Markup (%)",
				type: "line",
				data: []
			}
		],

		stroke: {
			curve: "smooth",
			width: [2, 2, 2, 1.5],
			dashArray: [0, 0, 0, 4]
		},

		colors: [VISA_RATE_COLOR, MC_RATE_COLOR, ECB_RATE_COLOR, VISA_MARKUP_COLOR],

		xaxis: {
			type: "datetime",
			tickPlacement: "on",
			labels: {
				rotate: -45,
				rotateAlways: false,
				hideOverlappingLabels: true,
				trim: false,
				style: {
					colors: textColor
				},
				datetimeUTC: false,
				format: "yyyy-MM-dd",
				offsetX: 0,
				offsetY: 0,
				formatter: function (/** @type {string} */ value, /** @type {number|undefined} */ timestamp) {
					if (!timestamp) return "";

					// Hide labels beyond min/max data range
					if (minDataTimestamp !== undefined && timestamp < minDataTimestamp - 43200000) {
						return "";
					}
					if (maxDataTimestamp !== undefined && timestamp > maxDataTimestamp + 43200000) {
						return "";
					}

					// Format timestamp as yyyy-MM-dd
					const date = new Date(timestamp);
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, "0");
					const day = String(date.getDate()).padStart(2, "0");
					return `${year}-${month}-${day}`;
				}
			},
			axisBorder: {
				color: gridColor,
				offsetX: 0,
				offsetY: 0
			},
			axisTicks: {
				color: gridColor
			},
			crosshairs: {
				width: 1
			},
			tooltip: {
				enabled: false
			}
		},

		yaxis: [
			{
				// Shared Y-axis for Visa, Mastercard, and ECB rates (left)
				seriesName: ["Visa Rate", "Mastercard Rate", "ECB Rate"],
				title: {
					text: `Rate (${fromCurr} → ${toCurr})`,
					style: {
						color: textColor,
						fontWeight: 500,
						fontSize: "12px"
					}
				},
				labels: {
					style: {
						colors: textColor
					},
					formatter: (/** @type {number|null|undefined} */ value) => value?.toFixed(5) ?? ""
				},
				axisBorder: {
					show: true,
					color: gridColor
				}
			},
			{
				// Visa Markup on right Y-axis
				seriesName: "Visa Markup (%)",
				opposite: true,
				title: {
					text: "Visa Markup (%)",
					style: {
						color: VISA_MARKUP_COLOR,
						fontWeight: 500,
						fontSize: "12px"
					}
				},
				labels: {
					style: {
						colors: VISA_MARKUP_COLOR
					},
					formatter: (/** @type {number|null|undefined} */ value) => (value === null || value === undefined ? "" : `${value.toFixed(2)}%`)
				},
				axisBorder: {
					show: true,
					color: VISA_MARKUP_COLOR
				}
			}
		],

		tooltip: {
			shared: true,
			intersect: false,
			theme: dark ? "dark" : "light",
			x: {
				format: "MMM dd, yyyy"
			},
			custom: function (/** @type {{ series: number[][], seriesIndex: number, dataPointIndex: number, w: { globals: { seriesX: number[][] } } }} */ { series, seriesIndex: _seriesIndex, dataPointIndex, w }) {
				// Custom tooltip to ensure all series are displayed even when some have null values
				const date = new Date(w.globals.seriesX[0][dataPointIndex]);
				const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

				let tooltipHTML = `<div class="apexcharts-tooltip-title" style="font-family: DM Sans, sans-serif; font-size: 12px;">${dateStr}</div>`;

				// Series 0: Visa Rate
				const visaRate = series[0][dataPointIndex];
				if (visaRate !== null && visaRate !== undefined) {
					tooltipHTML += `
            <div class="apexcharts-tooltip-series-group apexcharts-active" style="order: 1; display: flex;">
              <span class="apexcharts-tooltip-marker" style="background-color: ${VISA_RATE_COLOR};"></span>
              <div class="apexcharts-tooltip-text" style="font-family: DM Sans, sans-serif; font-size: 12px;">
                <div class="apexcharts-tooltip-y-group">
                  <span class="apexcharts-tooltip-text-y-label">Visa Rate: </span>
                  <span class="apexcharts-tooltip-text-y-value">${visaRate.toFixed(5)}</span>
                </div>
              </div>
            </div>`;
				}

				// Series 1: Mastercard Rate
				const mcRate = series[1][dataPointIndex];
				if (mcRate !== null && mcRate !== undefined) {
					tooltipHTML += `
            <div class="apexcharts-tooltip-series-group apexcharts-active" style="order: 2; display: flex;">
              <span class="apexcharts-tooltip-marker" style="background-color: ${MC_RATE_COLOR};"></span>
              <div class="apexcharts-tooltip-text" style="font-family: DM Sans, sans-serif; font-size: 12px;">
                <div class="apexcharts-tooltip-y-group">
                  <span class="apexcharts-tooltip-text-y-label">Mastercard Rate: </span>
                  <span class="apexcharts-tooltip-text-y-value">${mcRate.toFixed(5)}</span>
                </div>
              </div>
            </div>`;
				}

				// Series 2: ECB Rate
				const ecbRate = series[2][dataPointIndex];
				if (ecbRate !== null && ecbRate !== undefined) {
					tooltipHTML += `
            <div class="apexcharts-tooltip-series-group apexcharts-active" style="order: 3; display: flex;">
              <span class="apexcharts-tooltip-marker" style="background-color: ${ECB_RATE_COLOR};"></span>
              <div class="apexcharts-tooltip-text" style="font-family: DM Sans, sans-serif; font-size: 12px;">
                <div class="apexcharts-tooltip-y-group">
                  <span class="apexcharts-tooltip-text-y-label">ECB Rate: </span>
                  <span class="apexcharts-tooltip-text-y-value">${ecbRate.toFixed(5)}</span>
                </div>
              </div>
            </div>`;
				}

				// Series 3: Visa Markup
				const visaMarkup = series[3][dataPointIndex];
				if (visaMarkup !== null && visaMarkup !== undefined) {
					tooltipHTML += `
            <div class="apexcharts-tooltip-series-group apexcharts-active" style="order: 4; display: flex;">
              <span class="apexcharts-tooltip-marker" style="background-color: ${VISA_MARKUP_COLOR};"></span>
              <div class="apexcharts-tooltip-text" style="font-family: DM Sans, sans-serif; font-size: 12px;">
                <div class="apexcharts-tooltip-y-group">
                  <span class="apexcharts-tooltip-text-y-label">Visa Markup (%): </span>
                  <span class="apexcharts-tooltip-text-y-value">${visaMarkup.toFixed(2)}%</span>
                </div>
              </div>
            </div>`;
				}

				return tooltipHTML;
			}
		},

		legend: {
			show: true,
			position: "bottom",
			horizontalAlign: "center",
			floating: false,
			fontSize: "12px",
			fontFamily: '"DM Sans", system-ui, sans-serif',
			fontWeight: 500,
			offsetY: 0,
			labels: {
				colors: textColor
			},
			markers: {
				width: 8,
				height: 8,
				radius: 4,
				offsetX: -4
			},
			itemMargin: {
				horizontal: 16,
				vertical: 8
			}
		},

		grid: {
			borderColor: gridColor,
			strokeDashArray: 3
		},

		markers: {
			size: 0,
			hover: {
				size: 6,
				sizeOffset: 3
			}
		}
	};
}

/**
 * Converts a YYYY-MM-DD date string to midnight UTC timestamp
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {number} Timestamp at midnight UTC
 */
function dateToMidnightUTC(dateStr) {
	const [year, month, day] = dateStr.split("-").map(Number);
	return Date.UTC(year, month - 1, day);
}

/**
 * Converts a timestamp to YYYY-MM-DD date string
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Date in YYYY-MM-DD format
 */
function timestampToDateStr(timestamp) {
	const d = new Date(timestamp);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Transforms rate records into chart series data
 * @param {RateRecord[]} visaRecords - Visa rate records
 * @param {RateRecord[]} mastercardRecords - Mastercard rate records
 * @param {RateRecord[]} ecbRecords - ECB rate records
 * @returns {{ visaRateSeries: Array<{x: number, y: number|null}>, mcRateSeries: Array<{x: number, y: number|null}>, ecbRateSeries: Array<{x: number, y: number|null}>, visaMarkupSeries: Array<{x: number, y: number|null}> }}
 */
function transformData(visaRecords, mastercardRecords, ecbRecords = []) {
	// Collect all unique dates across all providers
	const allDates = new Set();
	for (const record of visaRecords) allDates.add(record.date);
	for (const record of mastercardRecords) allDates.add(record.date);
	for (const record of ecbRecords) allDates.add(record.date);

	// Sort dates chronologically
	const sortedDates = [...allDates].sort();

	// Create lookup maps for each provider
	const visaMap = new Map();
	for (const record of visaRecords) {
		visaMap.set(record.date, record);
	}

	const mcMap = new Map();
	for (const record of mastercardRecords) {
		mcMap.set(record.date, record);
	}

	const ecbMap = new Map();
	for (const record of ecbRecords) {
		ecbMap.set(record.date, record);
	}

	// Build series with null for missing dates, using midnight UTC timestamps
	const visaRateSeries = [];
	const visaMarkupSeries = [];
	const mcRateSeries = [];
	const ecbRateSeries = [];

	for (const date of sortedDates) {
		const timestamp = dateToMidnightUTC(date);
		const visaRecord = visaMap.get(date);
		const mcRecord = mcMap.get(date);
		const ecbRecord = ecbMap.get(date);

		visaRateSeries.push({
			x: timestamp,
			y: visaRecord ? visaRecord.rate : null
		});

		visaMarkupSeries.push({
			x: timestamp,
			y: visaRecord ? visaRecord.markup : null
		});

		mcRateSeries.push({
			x: timestamp,
			y: mcRecord ? mcRecord.rate : null
		});

		ecbRateSeries.push({
			x: timestamp,
			y: ecbRecord ? ecbRecord.rate : null
		});
	}

	return { visaRateSeries, mcRateSeries, ecbRateSeries, visaMarkupSeries };
}

/**
 * Callback function for zoom/pan events
 * @type {Function|null}
 */
let onZoomCallback = null;

/**
 * Stores current records for Y-axis recalculation on zoom
 * @type {RateRecord[]}
 */
let currentVisaRecords = [];
/** @type {RateRecord[]} */
let currentMcRecords = [];
/** @type {RateRecord[]} */
let currentEcbRecords = [];

/**
 * Sets the zoom event callback
 * @param {Function} callback - Function to call on zoom/pan
 */
export function setZoomCallback(callback) {
	onZoomCallback = callback;
}

/**
 * Updates Y-axis limits based on visible data range
 * @param {number} minTimestamp - Minimum visible timestamp
 * @param {number} maxTimestamp - Maximum visible timestamp
 */
function updateYAxisLimits(minTimestamp, maxTimestamp) {
	if (!chartInstance) return;

	// Convert timestamps to date strings for filtering
	const minDate = timestampToDateStr(minTimestamp);
	const maxDate = timestampToDateStr(maxTimestamp);

	// Get visible records
	const visibleVisa = getVisibleRecords(currentVisaRecords, minDate, maxDate);
	const visibleMc = getVisibleRecords(currentMcRecords, minDate, maxDate);
	const visibleEcb = getVisibleRecords(currentEcbRecords, minDate, maxDate);

	// Calculate rate range (left Y-axis)
	const allRates = [...visibleVisa.map((r) => r.rate), ...visibleMc.map((r) => r.rate), ...visibleEcb.map((r) => r.rate)].filter((r) => r !== null && r !== undefined);

	// Calculate markup range (right Y-axis)
	const allMarkups = visibleVisa.map((r) => r.markup).filter((m) => m !== null && m !== undefined);

	if (allRates.length === 0) return;

	// Add padding (5% on each side)
	const rateMin = Math.min(...allRates);
	const rateMax = Math.max(...allRates);
	const ratePadding = (rateMax - rateMin) * 0.05 || 0.0001;

	let markupMin = 0;
	let markupMax = 1;
	if (allMarkups.length > 0) {
		markupMin = Math.min(...allMarkups);
		markupMax = Math.max(...allMarkups);
		const markupPadding = (markupMax - markupMin) * 0.05 || 0.01;
		markupMin = Math.max(0, markupMin - markupPadding);
		markupMax = markupMax + markupPadding;
	}

	const dark = isDarkMode();
	const textColor = dark ? "#a1a1aa" : "#52525b";
	const gridColor = dark ? "#27272a" : "#e4e4e7";

	// Update chart with new Y-axis limits
	chartInstance.updateOptions(
		{
			yaxis: [
				{
					seriesName: ["Visa Rate", "Mastercard Rate", "ECB Rate"],
					min: rateMin - ratePadding,
					max: rateMax + ratePadding,
					labels: {
						style: { colors: textColor },
						formatter: (/** @type {number|null|undefined} */ value) => value?.toFixed(5) ?? ""
					},
					axisBorder: { show: true, color: gridColor }
				},
				{
					seriesName: "Visa Markup (%)",
					opposite: true,
					min: markupMin,
					max: markupMax,
					labels: {
						style: { colors: VISA_MARKUP_COLOR },
						formatter: (/** @type {number|null|undefined} */ value) => (value === null || value === undefined ? "" : `${value.toFixed(2)}%`)
					},
					axisBorder: { show: true, color: VISA_MARKUP_COLOR }
				}
			]
		},
		false,
		false
	);
}

/**
 * Initializes the chart with data
 * @param {string} containerId - DOM element ID for the chart
 * @param {RateRecord[]} visaRecords - Array of Visa rate records
 * @param {RateRecord[]} mastercardRecords - Array of Mastercard rate records
 * @param {RateRecord[]} ecbRecords - Array of ECB rate records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export async function initChart(containerId, visaRecords, mastercardRecords, ecbRecords, fromCurr, toCurr) {
	// Destroy existing chart if any
	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}

	const container = document.getElementById(containerId);
	if (!container) {
		console.error(`Chart container #${containerId} not found`);
		return;
	}

	const { visaRateSeries, mcRateSeries, ecbRateSeries, visaMarkupSeries } = transformData(visaRecords, mastercardRecords, ecbRecords);

	// Store records for Y-axis recalculation on zoom
	currentVisaRecords = visaRecords;
	currentMcRecords = mastercardRecords;
	currentEcbRecords = ecbRecords;

	// Get all unique dates from data
	const allDates = [...visaRateSeries.map((p) => p.x), ...mcRateSeries.map((p) => p.x), ...ecbRateSeries.map((p) => p.x)].filter((d) => d !== null && d !== undefined);

	const uniqueDates = [...new Set(allDates)].sort();
	const minDate = uniqueDates.length > 0 ? uniqueDates[0] : undefined;
	const maxDate = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : undefined;

	console.log("initChart - Data Range:", {
		minDate,
		maxDate,
		dataPointCount: uniqueDates.length
	});

	const options = getChartOptions(fromCurr, toCurr);
	options.series[SERIES_VISA_RATE].data = visaRateSeries;
	options.series[SERIES_MC_RATE].data = mcRateSeries;
	options.series[SERIES_ECB_RATE].data = ecbRateSeries;
	options.series[SERIES_VISA_MARKUP].data = visaMarkupSeries;

	// Set xaxis min/max to clamp axis to data range
	if (uniqueDates.length > 0) {
		const minTimestamp = uniqueDates[0];
		const maxTimestamp = uniqueDates[uniqueDates.length - 1];

		// Store for label formatter
		minDataTimestamp = minTimestamp;
		maxDataTimestamp = maxTimestamp;

		options.xaxis.min = minTimestamp;
		options.xaxis.max = maxTimestamp;

		// Calculate appropriate tickAmount based on date range
		const dataRange = maxTimestamp - minTimestamp;
		const dayInMs = 24 * 60 * 60 * 1000;
		const daysInRange = dataRange / dayInMs;

		let tickCount;
		if (daysInRange <= 7) {
			tickCount = Math.ceil(daysInRange) + 1;
		} else if (daysInRange <= 31) {
			tickCount = 8;
		} else if (daysInRange <= 90) {
			tickCount = 10;
		} else if (daysInRange <= 180) {
			tickCount = 12;
		} else if (daysInRange <= 365) {
			tickCount = 13;
		} else {
			tickCount = Math.min(Math.ceil(daysInRange / 30), 20);
		}

		options.xaxis.tickAmount = tickCount;

		console.log("Chart data range:", {
			totalDates: uniqueDates.length,
			firstTimestamp: minTimestamp,
			lastTimestamp: maxTimestamp,
			daysInRange: daysInRange.toFixed(1),
			tickCount
		});
	}

	// Add zoom/pan event listeners
	options.chart.events = {
		zoomed: (/** @type {unknown} */ chartContext, /** @type {{ xaxis: { min: number, max: number } }} */ { xaxis }) => {
			// For datetime axis, min/max are timestamps
			const minTs = xaxis.min;
			const maxTs = xaxis.max;

			if (!minTs || !maxTs) return;

			// Update stored timestamps for label formatter
			minDataTimestamp = minTs;
			maxDataTimestamp = maxTs;

			// Update Y-axis limits for visible range
			updateYAxisLimits(minTs, maxTs);
			// Call external callback for stats update (convert to date strings)
			if (onZoomCallback) {
				const minDate = timestampToDateStr(minTs);
				const maxDate = timestampToDateStr(maxTs);
				onZoomCallback(minDate, maxDate);
			}
		},
		scrolled: (/** @type {unknown} */ chartContext, /** @type {{ xaxis: { min: number, max: number } }} */ { xaxis }) => {
			// For datetime axis, min/max are timestamps
			const minTs = xaxis.min;
			const maxTs = xaxis.max;

			if (!minTs || !maxTs) return;

			// Update stored timestamps for label formatter
			minDataTimestamp = minTs;
			maxDataTimestamp = maxTs;

			// Update Y-axis limits for visible range
			updateYAxisLimits(minTs, maxTs);
			// Call external callback for stats update (convert to date strings)
			if (onZoomCallback) {
				const minDate = timestampToDateStr(minTs);
				const maxDate = timestampToDateStr(maxTs);
				onZoomCallback(minDate, maxDate);
			}
		}
	};

	// Defer import until chart is visible (below the fold on initial load)
	await new Promise((resolve) => {
		let settled = false;
		const cleanup = () => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			clearTimeout(timeout);
			resolve();
		};
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) cleanup();
		}, { rootMargin: "200px" });
		const timeout = setTimeout(cleanup, 5_000);
		observer.observe(container);
	});

	const ApexCharts = (await import("apexcharts")).default;
	chartInstance = new ApexCharts(container, options);
	chartInstance.render();
}

/**
 * Updates the chart with new data
 * @param {RateRecord[]} visaRecords - Array of Visa rate records
 * @param {RateRecord[]} mastercardRecords - Array of Mastercard rate records
 * @param {RateRecord[]} ecbRecords - Array of ECB rate records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function updateChart(visaRecords, mastercardRecords, ecbRecords, fromCurr, toCurr) {
	if (!chartInstance) {
		console.error("Chart not initialized");
		return;
	}

	// Store records for Y-axis recalculation on zoom
	currentVisaRecords = visaRecords;
	currentMcRecords = mastercardRecords;
	currentEcbRecords = ecbRecords;

	const { visaRateSeries, mcRateSeries, ecbRateSeries, visaMarkupSeries } = transformData(visaRecords, mastercardRecords, ecbRecords);

	// Get all unique dates from data
	const allDates = [...visaRateSeries.map((p) => p.x), ...mcRateSeries.map((p) => p.x), ...ecbRateSeries.map((p) => p.x)].filter((d) => d !== null && d !== undefined);

	const uniqueDates = [...new Set(allDates)].sort((a, b) => a - b);
	const minTimestamp = uniqueDates.length > 0 ? uniqueDates[0] : undefined;
	const maxTimestamp = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : undefined;

	// Store for label formatter
	minDataTimestamp = minTimestamp;
	maxDataTimestamp = maxTimestamp;

	// Calculate tickAmount based on date range
	let tickCount = 10;
	if (minTimestamp !== undefined && maxTimestamp !== undefined) {
		const dataRange = maxTimestamp - minTimestamp;
		const dayInMs = 24 * 60 * 60 * 1000;
		const daysInRange = dataRange / dayInMs;

		if (daysInRange <= 7) {
			tickCount = Math.ceil(daysInRange) + 1;
		} else if (daysInRange <= 31) {
			tickCount = 8;
		} else if (daysInRange <= 90) {
			tickCount = 10;
		} else if (daysInRange <= 180) {
			tickCount = 12;
		} else if (daysInRange <= 365) {
			tickCount = 13;
		} else {
			tickCount = Math.min(Math.ceil(daysInRange / 30), 20);
		}
	}

	// Update series data
	chartInstance.updateSeries([
		{ name: "Visa Rate", data: visaRateSeries },
		{ name: "Mastercard Rate", data: mcRateSeries },
		{ name: "ECB Rate", data: ecbRateSeries },
		{ name: "Visa Markup (%)", data: visaMarkupSeries }
	]);

	const dark = isDarkMode();
	const textColor = dark ? "#a1a1aa" : "#52525b";
	const gridColor = dark ? "#27272a" : "#e4e4e7";

	// Update options including xaxis bounds
	const updateOptions = {
		xaxis: {
			min: minTimestamp,
			max: maxTimestamp,
			tickAmount: tickCount
		},
		yaxis: [
			{
				seriesName: ["Visa Rate", "Mastercard Rate", "ECB Rate"],
				title: {
					text: `Rate (${fromCurr} → ${toCurr})`,
					style: { color: textColor, fontWeight: 500, fontSize: "12px" }
				},
				labels: {
					style: { colors: textColor },
					formatter: (/** @type {number|null|undefined} */ value) => value?.toFixed(5) ?? ""
				},
				axisBorder: { show: true, color: gridColor }
			},
			{
				seriesName: "Visa Markup (%)",
				opposite: true,
				title: {
					text: "Visa Markup (%)",
					style: { color: VISA_MARKUP_COLOR, fontWeight: 500, fontSize: "12px" }
				},
				labels: {
					style: { colors: VISA_MARKUP_COLOR },
					formatter: (/** @type {number|null|undefined} */ value) => (value === null || value === undefined ? "" : `${value.toFixed(2)}%`)
				},
				axisBorder: { show: true, color: VISA_MARKUP_COLOR }
			}
		]
	};

	chartInstance.updateOptions(updateOptions, false, false);
}

/**
 * Destroys the chart instance
 */
export function destroyChart() {
	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}
}

/**
 * Checks if chart is initialized
 * @returns {boolean}
 */
export function isChartInitialized() {
	return chartInstance !== null;
}

/**
 * Exports chart as PNG and triggers download
 * @param {string} filename - Filename without extension
 * @returns {Promise<boolean>} - Whether export succeeded
 */
export async function exportChartAsPng(filename = "forex-chart") {
	if (!chartInstance) return false;

	try {
		const result = /** @type {{ imgURI: string }} */ (await chartInstance.dataURI({ scale: 2 }));
		const imgURI = result.imgURI;

		// Create download link
		const link = document.createElement("a");
		link.href = imgURI;
		link.download = `${filename}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		return true;
	} catch (err) {
		console.error("Failed to export chart:", err);
		return false;
	}
}

/**
 * Refreshes the chart theme (call on theme toggle)
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function refreshChartTheme(fromCurr, toCurr) {
	if (!chartInstance) return;

	const dark = isDarkMode();
	const textColor = dark ? "#a1a1aa" : "#52525b";
	const gridColor = dark ? "#27272a" : "#e4e4e7";
	const bgColor = dark ? "#18181b" : "#ffffff";
	const tooltipTheme = dark ? "dark" : "light";

	chartInstance.updateOptions(
		{
			chart: {
				background: bgColor,
				foreColor: textColor
			},
			theme: {
				mode: tooltipTheme
			},
			grid: {
				borderColor: gridColor
			},
			xaxis: {
				labels: {
					style: { colors: textColor }
				},
				axisBorder: { color: gridColor },
				axisTicks: { color: gridColor }
			},
			yaxis: [
				{
					seriesName: ["Visa Rate", "Mastercard Rate", "ECB Rate"],
					title: {
						text: `Rate (${fromCurr} → ${toCurr})`,
						style: { color: textColor, fontWeight: 500, fontSize: "12px" }
					},
					labels: {
						style: { colors: textColor },
						formatter: (/** @type {number|null|undefined} */ value) => value?.toFixed(5) ?? ""
					},
					axisBorder: { show: true, color: gridColor }
				},
				{
					seriesName: "Visa Markup (%)",
					opposite: true,
					title: {
						text: "Visa Markup (%)",
						style: { color: VISA_MARKUP_COLOR, fontWeight: 500, fontSize: "12px" }
					},
					labels: {
						style: { colors: VISA_MARKUP_COLOR },
						formatter: (/** @type {number|null|undefined} */ value) => (value === null || value === undefined ? "" : `${value.toFixed(2)}%`)
					},
					axisBorder: { show: true, color: VISA_MARKUP_COLOR }
				}
			],
			tooltip: {
				theme: tooltipTheme
			},
			legend: {
				labels: { colors: textColor }
			}
		},
		false,
		false
	);
}

/**
 * Filters records based on visible chart range
 * @param {RateRecord[]} records - All records
 * @param {string} minDate - Minimum date (YYYY-MM-DD)
 * @param {string} maxDate - Maximum date (YYYY-MM-DD)
 * @returns {RateRecord[]} Filtered records
 */
export function getVisibleRecords(records, minDate, maxDate) {
	return records.filter((record) => {
		return record.date >= minDate && record.date <= maxDate;
	});
}

/**
 * Filters records by provider and visible chart range
 * @param {RateRecord[]} visaRecords - All Visa records
 * @param {RateRecord[]} mastercardRecords - All Mastercard records
 * @param {RateRecord[]} ecbRecords - All ECB records
 * @param {string} minDate - Minimum date (YYYY-MM-DD)
 * @param {string} maxDate - Maximum date (YYYY-MM-DD)
 * @returns {{visaRecords: RateRecord[], mastercardRecords: RateRecord[], ecbRecords: RateRecord[]}} Filtered records by provider
 */
export function getVisibleRecordsByProvider(visaRecords, mastercardRecords, ecbRecords, minDate, maxDate) {
	return {
		visaRecords: getVisibleRecords(visaRecords, minDate, maxDate),
		mastercardRecords: getVisibleRecords(mastercardRecords, minDate, maxDate),
		ecbRecords: getVisibleRecords(ecbRecords, minDate, maxDate)
	};
}
