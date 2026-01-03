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

// Chart color constants
const VISA_RATE_COLOR = '#10b981';      // emerald-500
const MC_RATE_COLOR = '#ef4444';        // red-500
const VISA_MARKUP_COLOR = '#f59e0b';    // amber-500

// Series indices for reference
const SERIES_VISA_RATE = 0;
const SERIES_MC_RATE = 1;
const SERIES_VISA_MARKUP = 2;

/** 
 * Current visibility state
 * @type {SeriesVisibility}
 */
let currentVisibility = {
  visaRate: true,
  visaMarkup: true,
  mastercardRate: true
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
        name: 'Visa Markup (%)',
        type: 'line',
        data: []
      }
    ],
    
    stroke: {
      curve: 'smooth',
      width: [2, 2, 1.5],
      dashArray: [0, 0, 4]
    },
    
    colors: [VISA_RATE_COLOR, MC_RATE_COLOR, VISA_MARKUP_COLOR],
    
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'MMM dd',
        style: {
          colors: textColor
        }
      },
      axisBorder: {
        color: gridColor
      },
      axisTicks: {
        color: gridColor
      },
      tooltip: {
        enabled: false
      }
    },
    
    yaxis: [
      {
        // Shared Y-axis for both Visa and Mastercard rates (left)
        seriesName: ['Visa Rate', 'Mastercard Rate'],
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
          // Series 0 = Visa Rate, Series 1 = MC Rate, Series 2 = Visa Markup
          if (seriesIndex === 0 || seriesIndex === 1) {
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
function transformData(visaRecords, mastercardRecords) {
  const visaRateSeries = [];
  const visaMarkupSeries = [];
  const mcRateSeries = [];
  
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
  
  return { visaRateSeries, mcRateSeries, visaMarkupSeries };
}

/**
 * Callback function for zoom/pan events
 * @type {Function|null}
 */
let onZoomCallback = null;

/**
 * Sets the zoom event callback
 * @param {Function} callback - Function to call on zoom/pan
 */
export function setZoomCallback(callback) {
  onZoomCallback = callback;
}

/**
 * Initializes the chart with data
 * @param {string} containerId - DOM element ID for the chart
 * @param {RateRecord[]} visaRecords - Array of Visa rate records
 * @param {RateRecord[]} mastercardRecords - Array of Mastercard rate records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function initChart(containerId, visaRecords, mastercardRecords, fromCurr, toCurr) {
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
  
  const { visaRateSeries, mcRateSeries, visaMarkupSeries } = transformData(visaRecords, mastercardRecords);
  
  const options = getChartOptions(fromCurr, toCurr);
  options.series[SERIES_VISA_RATE].data = visaRateSeries;
  options.series[SERIES_MC_RATE].data = mcRateSeries;
  options.series[SERIES_VISA_MARKUP].data = visaMarkupSeries;
  
  // Add zoom/pan event listeners
  options.chart.events = {
    zoomed: (chartContext, { xaxis }) => {
      if (onZoomCallback) {
        onZoomCallback(xaxis.min, xaxis.max);
      }
    },
    scrolled: (chartContext, { xaxis }) => {
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
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function updateChart(visaRecords, mastercardRecords, fromCurr, toCurr) {
  if (!chartInstance) {
    console.error('Chart not initialized');
    return;
  }
  
  const { visaRateSeries, mcRateSeries, visaMarkupSeries } = transformData(visaRecords, mastercardRecords);
  
  // Update series data
  chartInstance.updateSeries([
    { name: 'Visa Rate', data: visaRateSeries },
    { name: 'Mastercard Rate', data: mcRateSeries },
    { name: 'Visa Markup (%)', data: visaMarkupSeries }
  ]);
  
  const dark = isDarkMode();
  const textColor = dark ? '#a1a1aa' : '#52525b';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  
  // Update Y-axis title
  chartInstance.updateOptions({
    yaxis: [
      {
        seriesName: ['Visa Rate', 'Mastercard Rate'],
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
  }, false, false);
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
        seriesName: ['Visa Rate', 'Mastercard Rate'],
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
 * @param {number} minTimestamp - Minimum timestamp (ms)
 * @param {number} maxTimestamp - Maximum timestamp (ms)
 * @returns {{visaRecords: RateRecord[], mastercardRecords: RateRecord[]}} Filtered records by provider
 */
export function getVisibleRecordsByProvider(visaRecords, mastercardRecords, minTimestamp, maxTimestamp) {
  return {
    visaRecords: getVisibleRecords(visaRecords, minTimestamp, maxTimestamp),
    mastercardRecords: getVisibleRecords(mastercardRecords, minTimestamp, maxTimestamp)
  };
}
