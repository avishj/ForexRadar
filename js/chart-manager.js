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

/* global ApexCharts */

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').SeriesVisibility} SeriesVisibility */

/** @type {ApexCharts|null} */
let chartInstance = null;

/** @type {number|undefined} */
let maxDataTimestamp = undefined;

/** @type {number|undefined} */
let minDataTimestamp = undefined;

// Chart color constants
const VISA_RATE_COLOR = '#10b981';      // emerald-500
const MC_RATE_COLOR = '#ef4444';        // red-500
const ECB_RATE_COLOR = '#3b82f6';       // blue-500
const VISA_MARKUP_COLOR = '#f59e0b';    // amber-500

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
        chartInstance.showSeries('Visa Rate');
      } else {
        chartInstance.hideSeries('Visa Rate');
      }
    }
    if (visibility.mastercardRate !== undefined) {
      if (visibility.mastercardRate) {
        chartInstance.showSeries('Mastercard Rate');
      } else {
        chartInstance.hideSeries('Mastercard Rate');
      }
    }
    if (visibility.visaMarkup !== undefined) {
      if (visibility.visaMarkup) {
        chartInstance.showSeries('Visa Markup (%)');
      } else {
        chartInstance.hideSeries('Visa Markup (%)');
      }
    }
    if (visibility.ecbRate !== undefined) {
      if (visibility.ecbRate) {
        chartInstance.showSeries('ECB Rate');
      } else {
        chartInstance.hideSeries('ECB Rate');
      }
    }
  }
}

/**
 * Checks if dark mode is active
 * @returns {boolean}
 */
function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

/**
 * Gets the base chart configuration
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Object} ApexCharts options
 */
function getChartOptions(fromCurr, toCurr) {
  const dark = isDarkMode();
  const textColor = dark ? '#a1a1aa' : '#52525b';  // zinc-400/zinc-600
  const gridColor = dark ? '#27272a' : '#e4e4e7';  // zinc-800/zinc-200
  const bgColor = dark ? '#18181b' : '#ffffff';    // zinc-900/white
  const tooltipTheme = dark ? 'dark' : 'light';
  
  return {
    chart: {
      type: 'line',
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
        autoSelected: 'zoom'
      },
      zoom: {
        enabled: true
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 400
      }
    },
    
    theme: {
      mode: tooltipTheme
    },
    
    series: [
      {
        name: 'Visa Rate',
        type: 'line',
        data: []
      },
      {
        name: 'Mastercard Rate',
        type: 'line',
        data: []
      },
      {
        name: 'ECB Rate',
        type: 'line',
        data: []
      },
      {
        name: 'Visa Markup (%)',
        type: 'line',
        data: []
      }
    ],
    
    stroke: {
      curve: 'smooth',
      width: [2, 2, 2, 1.5],
      dashArray: [0, 0, 0, 4]
    },
    
    colors: [VISA_RATE_COLOR, MC_RATE_COLOR, ECB_RATE_COLOR, VISA_MARKUP_COLOR],
    
    xaxis: {
      type: 'datetime',
      tickPlacement: 'on',
      labels: {
        datetimeUTC: false,
        format: 'yyyy-MM-dd',
        rotate: -45,
        rotateAlways: false,
        hideOverlappingLabels: true,
        trim: false,
        style: {
          colors: textColor
        },
        offsetX: 0,
        offsetY: 0,
        formatter: function(value, timestamp) {
          if (!timestamp) return value;
          
          // Always show min and max labels
          const isMinLabel = minDataTimestamp !== undefined && Math.abs(timestamp - minDataTimestamp) < 86400000; // Within 1 day
          const isMaxLabel = maxDataTimestamp !== undefined && Math.abs(timestamp - maxDataTimestamp) < 86400000; // Within 1 day
          
          // Hide labels beyond max
          if (maxDataTimestamp !== undefined && timestamp > maxDataTimestamp && !isMaxLabel) {
            return '';
          }
          
          // Format timestamp as yyyy-MM-dd
          const date = new Date(timestamp);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
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
        seriesName: ['Visa Rate', 'Mastercard Rate', 'ECB Rate'],
        title: {
          text: `Rate (${fromCurr} → ${toCurr})`,
          style: {
            color: textColor,
            fontWeight: 500,
            fontSize: '12px'
          }
        },
        labels: {
          style: {
            colors: textColor
          },
          formatter: (value) => value?.toFixed(5) ?? ''
        },
        axisBorder: {
          show: true,
          color: gridColor
        }
      },
      {
        // Visa Markup on right Y-axis
        seriesName: 'Visa Markup (%)',
        opposite: true,
        title: {
          text: 'Visa Markup (%)',
          style: {
            color: VISA_MARKUP_COLOR,
            fontWeight: 500,
            fontSize: '12px'
          }
        },
        labels: {
          style: {
            colors: VISA_MARKUP_COLOR
          },
          formatter: (value) => (value === null || value === undefined) ? '' : `${value.toFixed(2)}%`
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
      theme: dark ? 'dark' : 'light',
      x: {
        format: 'MMM dd, yyyy'
      },
      y: {
        formatter: function(value, { seriesIndex }) {
          if (value === null || value === undefined) return '-';
          // Series 0 = Visa Rate, Series 1 = MC Rate, Series 2 = ECB Rate, Series 3 = Visa Markup
          if (seriesIndex === 0 || seriesIndex === 1 || seriesIndex === 2) {
            return value.toFixed(5);
          } else {
            return `${value.toFixed(2)}%`;
          }
        }
      }
    },
    
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '12px',
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
 * Transforms rate records into chart series data
 * @param {RateRecord[]} visaRecords - Array of Visa rate records
 * @param {RateRecord[]} mastercardRecords - Array of Mastercard rate records
 * @returns {Object} Object with visaRateSeries, mcRateSeries, and visaMarkupSeries
 */
function transformData(visaRecords, mastercardRecords, ecbRecords = []) {
  const visaRateSeries = [];
  const visaMarkupSeries = [];
  const mcRateSeries = [];
  const ecbRateSeries = [];
  
  // Process Visa records
  for (const record of visaRecords) {
    // Parse YYYY-MM-DD as local time (not UTC) to avoid timezone offset issues
    const [year, month, day] = record.date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    
    visaRateSeries.push({
      x: timestamp,
      y: record.rate
    });
    
    visaMarkupSeries.push({
      x: timestamp,
      y: record.markup
    });
  }
  
  // Process Mastercard records
  for (const record of mastercardRecords) {
    const [year, month, day] = record.date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    
    mcRateSeries.push({
      x: timestamp,
      y: record.rate
    });
  }
  
  // Process ECB records
  for (const record of ecbRecords) {
    const [year, month, day] = record.date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    
    ecbRateSeries.push({
      x: timestamp,
      y: record.rate
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
 */
let currentVisaRecords = [];
let currentMcRecords = [];
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
  
  // Get visible records
  const visibleVisa = getVisibleRecords(currentVisaRecords, minTimestamp, maxTimestamp);
  const visibleMc = getVisibleRecords(currentMcRecords, minTimestamp, maxTimestamp);
  const visibleEcb = getVisibleRecords(currentEcbRecords, minTimestamp, maxTimestamp);
  
  // Calculate rate range (left Y-axis)
  const allRates = [
    ...visibleVisa.map(r => r.rate),
    ...visibleMc.map(r => r.rate),
    ...visibleEcb.map(r => r.rate)
  ].filter(r => r !== null && r !== undefined);
  
  // Calculate markup range (right Y-axis)
  const allMarkups = visibleVisa
    .map(r => r.markup)
    .filter(m => m !== null && m !== undefined);
  
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
  const textColor = dark ? '#a1a1aa' : '#52525b';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  
  // Update chart with new Y-axis limits
  chartInstance.updateOptions({
    yaxis: [
      {
        seriesName: ['Visa Rate', 'Mastercard Rate', 'ECB Rate'],
        min: rateMin - ratePadding,
        max: rateMax + ratePadding,
        labels: {
          style: { colors: textColor },
          formatter: (value) => value?.toFixed(5) ?? ''
        },
        axisBorder: { show: true, color: gridColor }
      },
      {
        seriesName: 'Visa Markup (%)',
        opposite: true,
        min: markupMin,
        max: markupMax,
        labels: {
          style: { colors: VISA_MARKUP_COLOR },
          formatter: (value) => (value === null || value === undefined) ? '' : `${value.toFixed(2)}%`
        },
        axisBorder: { show: true, color: VISA_MARKUP_COLOR }
      }
    ]
  }, false, false);
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
export function initChart(containerId, visaRecords, mastercardRecords, ecbRecords, fromCurr, toCurr) {
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
  
  // Calculate min/max timestamps from actual data
  const allTimestamps = [
    ...visaRateSeries.map(p => p.x),
    ...mcRateSeries.map(p => p.x),
    ...ecbRateSeries.map(p => p.x)
  ].filter(t => t !== null && t !== undefined);
  
  const minTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : undefined;
  const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : undefined;
  
  // Store timestamps for label formatter and annotations
  minDataTimestamp = minTimestamp;
  maxDataTimestamp = maxTimestamp;
  
  console.log('initChart - Data Range:', {
    minTimestamp,
    maxTimestamp,
    minDate: minTimestamp ? new Date(minTimestamp).toISOString() : 'N/A',
    maxDate: maxTimestamp ? new Date(maxTimestamp).toISOString() : 'N/A',
    dataPointCount: allTimestamps.length
  });
  
  const options = getChartOptions(fromCurr, toCurr);
  options.series[SERIES_VISA_RATE].data = visaRateSeries;
  options.series[SERIES_MC_RATE].data = mcRateSeries;
  options.series[SERIES_ECB_RATE].data = ecbRateSeries;
  options.series[SERIES_VISA_MARKUP].data = visaMarkupSeries;
  
  // Set explicit xaxis bounds to clip graph beyond data range
  if (minTimestamp !== undefined && maxTimestamp !== undefined) {
    options.xaxis.min = minTimestamp;
    options.xaxis.max = maxTimestamp;
    
    // Generate custom ticks to ensure min and max are included
    const dataRange = maxTimestamp - minTimestamp;
    const dayInMs = 24 * 60 * 60 * 1000;
    const daysInRange = dataRange / dayInMs;
    
    // Calculate appropriate number of ticks based on range
    let tickCount;
    if (daysInRange <= 7) {
      tickCount = Math.ceil(daysInRange) + 1; // Daily ticks
    } else if (daysInRange <= 31) {
      tickCount = 8; // ~Every 4 days
    } else if (daysInRange <= 90) {
      tickCount = 10; // ~Every 9 days
    } else if (daysInRange <= 180) {
      tickCount = 12; // ~Every 15 days
    } else if (daysInRange <= 365) {
      tickCount = 13; // ~Monthly
    } else {
      tickCount = Math.min(Math.ceil(daysInRange / 30), 20); // ~Monthly, max 20 ticks
    }
    
    // Generate tick values including min and max
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const tick = minTimestamp + (dataRange * i / tickCount);
      ticks.push(tick);
    }
    
    // Ensure exact min and max are in the ticks
    if (ticks[0] !== minTimestamp) ticks[0] = minTimestamp;
    if (ticks[ticks.length - 1] !== maxTimestamp) ticks[ticks.length - 1] = maxTimestamp;
    
    // Use custom tick values
    options.xaxis.tickAmount = tickCount;
    
    console.log('Setting xaxis bounds:', {
      min: minTimestamp,
      max: maxTimestamp,
      minDate: new Date(minTimestamp).toISOString(),
      maxDate: new Date(maxTimestamp).toISOString(),
      tickCount,
      daysInRange
    });
  }
  
  // Add zoom/pan event listeners
  options.chart.events = {
    zoomed: (chartContext, { xaxis }) => {
      // Update Y-axis limits for visible range
      updateYAxisLimits(xaxis.min, xaxis.max);
      // Call external callback for stats update
      if (onZoomCallback) {
        onZoomCallback(xaxis.min, xaxis.max);
      }
    },
    scrolled: (chartContext, { xaxis }) => {
      // Update Y-axis limits for visible range
      updateYAxisLimits(xaxis.min, xaxis.max);
      // Call external callback for stats update
      if (onZoomCallback) {
        onZoomCallback(xaxis.min, xaxis.max);
      }
    }
  };
  
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
    console.error('Chart not initialized');
    return;
  }
  
  // Store records for Y-axis recalculation on zoom
  currentVisaRecords = visaRecords;
  currentMcRecords = mastercardRecords;
  currentEcbRecords = ecbRecords;
  
  const { visaRateSeries, mcRateSeries, ecbRateSeries, visaMarkupSeries } = transformData(visaRecords, mastercardRecords, ecbRecords);
  
  // Calculate min/max timestamps from actual data
  const allTimestamps = [
    ...visaRateSeries.map(p => p.x),
    ...mcRateSeries.map(p => p.x),
    ...ecbRateSeries.map(p => p.x)
  ].filter(t => t !== null && t !== undefined);
  
  const minTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : undefined;
  const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : undefined;
  
  // Store max timestamp for label formatter
  maxDataTimestamp = maxTimestamp;
  
  // Update series data
  chartInstance.updateSeries([
    { name: 'Visa Rate', data: visaRateSeries },
    { name: 'Mastercard Rate', data: mcRateSeries },
    { name: 'ECB Rate', data: ecbRateSeries },
    { name: 'Visa Markup (%)', data: visaMarkupSeries }
  ]);
  
  const dark = isDarkMode();
  const textColor = dark ? '#a1a1aa' : '#52525b';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  
  // Update options including xaxis bounds
  const updateOptions = {
    yaxis: [
      {
        seriesName: ['Visa Rate', 'Mastercard Rate', 'ECB Rate'],
        title: {
          text: `Rate (${fromCurr} → ${toCurr})`,
          style: { color: textColor, fontWeight: 500, fontSize: '12px' }
        },
        labels: {
          style: { colors: textColor },
          formatter: (value) => value?.toFixed(5) ?? ''
        },
        axisBorder: { show: true, color: gridColor }
      },
      {
        seriesName: 'Visa Markup (%)',
        opposite: true,
        title: {
          text: 'Visa Markup (%)',
          style: { color: VISA_MARKUP_COLOR, fontWeight: 500, fontSize: '12px' }
        },
        labels: {
          style: { colors: VISA_MARKUP_COLOR },
          formatter: (value) => (value === null || value === undefined) ? '' : `${(value).toFixed(2)}%`
        },
        axisBorder: { show: true, color: VISA_MARKUP_COLOR }
      }
    ]
  };
  
  // Set explicit xaxis bounds to clip graph beyond data range
  if (minTimestamp !== undefined && maxTimestamp !== undefined) {
    updateOptions.xaxis = {
      min: minTimestamp,
      max: maxTimestamp
    };
  }
  
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
 * Refreshes the chart theme (call on theme toggle)
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function refreshChartTheme(fromCurr, toCurr) {
  if (!chartInstance) return;
  
  const dark = isDarkMode();
  const textColor = dark ? '#a1a1aa' : '#52525b';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  const bgColor = dark ? '#18181b' : '#ffffff';
  const tooltipTheme = dark ? 'dark' : 'light';
  
  chartInstance.updateOptions({
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
        seriesName: ['Visa Rate', 'Mastercard Rate', 'ECB Rate'],
        title: {
          text: `Rate (${fromCurr} → ${toCurr})`,
          style: { color: textColor, fontWeight: 500, fontSize: '12px' }
        },
        labels: {
          style: { colors: textColor },
          formatter: (value) => value?.toFixed(5) ?? ''
        },
        axisBorder: { show: true, color: gridColor }
      },
      {
        seriesName: 'Visa Markup (%)',
        opposite: true,
        title: {
          text: 'Visa Markup (%)',
          style: { color: VISA_MARKUP_COLOR, fontWeight: 500, fontSize: '12px' }
        },
        labels: {
          style: { colors: VISA_MARKUP_COLOR },
          formatter: (value) => (value === null || value === undefined) ? '' : `${value.toFixed(2)}%`
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
  }, false, false);
}

/**
 * Filters records based on visible chart range
 * @param {RateRecord[]} records - All records
 * @param {number} minTimestamp - Minimum timestamp (ms)
 * @param {number} maxTimestamp - Maximum timestamp (ms)
 * @returns {RateRecord[]} Filtered records
 */
export function getVisibleRecords(records, minTimestamp, maxTimestamp) {
  return records.filter(record => {
    const [year, month, day] = record.date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    return timestamp >= minTimestamp && timestamp <= maxTimestamp;
  });
}

/**
 * Filters records by provider and visible chart range
 * @param {RateRecord[]} visaRecords - All Visa records
 * @param {RateRecord[]} mastercardRecords - All Mastercard records
 * @param {RateRecord[]} ecbRecords - All ECB records
 * @param {number} minTimestamp - Minimum timestamp (ms)
 * @param {number} maxTimestamp - Maximum timestamp (ms)
 * @returns {{visaRecords: RateRecord[], mastercardRecords: RateRecord[], ecbRecords: RateRecord[]}} Filtered records by provider
 */
export function getVisibleRecordsByProvider(visaRecords, mastercardRecords, ecbRecords, minTimestamp, maxTimestamp) {
  return {
    visaRecords: getVisibleRecords(visaRecords, minTimestamp, maxTimestamp),
    mastercardRecords: getVisibleRecords(mastercardRecords, minTimestamp, maxTimestamp),
    ecbRecords: getVisibleRecords(ecbRecords, minTimestamp, maxTimestamp)
  };
}
