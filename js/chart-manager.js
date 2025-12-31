/**
 * Chart Manager
 * 
 * Configures and manages the ApexCharts dual-axis line chart.
 * - Y-Axis 1 (Left): Exchange Rate (Emerald)
 * - Y-Axis 2 (Right): Markup % (Amber, Dotted)
 * 
 * @module chart-manager
 */

import ApexCharts from 'apexcharts';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

/** @type {ApexCharts|null} */
let chartInstance = null;

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
        name: 'Exchange Rate',
        type: 'line',
        data: []
      },
      {
        name: 'Markup (%)',
        type: 'line',
        data: []
      }
    ],
    
    stroke: {
      curve: 'smooth',
      width: [2, 1.5],
      dashArray: [0, 4]
    },
    
    colors: ['#10b981', '#f59e0b'],  // emerald-500, amber-500
    
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
        title: {
          text: `Rate (${fromCurr} → ${toCurr})`,
          style: {
            color: '#10b981',  // emerald-500
            fontWeight: 500,
            fontSize: '12px'
          }
        },
        labels: {
          style: {
            colors: '#10b981'
          },
          formatter: (value) => value?.toFixed(0) ?? ''
        },
        axisBorder: {
          show: true,
          color: '#10b981'
        }
      },
      {
        opposite: true,
        title: {
          text: 'Markup (%)',
          style: {
            color: '#f59e0b',  // amber-500
            fontWeight: 500,
            fontSize: '12px'
          }
        },
        labels: {
          style: {
            colors: '#f59e0b'
          },
          formatter: (value) => value ? `${value.toFixed(2)}%` : ''
        },
        axisBorder: {
          show: true,
          color: '#f59e0b'
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
          if (seriesIndex === 0) {
            return value?.toFixed(2) ?? '-';
          } else {
            return value ? `${value.toFixed(2)}%` : '-';
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
 * @param {RateRecord[]} records - Array of rate records
 * @returns {Object} Object with rateSeries and markupSeries
 */
function transformData(records) {
  const rateSeries = [];
  const markupSeries = [];
  
  for (const record of records) {
    // Parse YYYY-MM-DD as local time (not UTC) to avoid timezone offset issues
    const [year, month, day] = record.date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    
    rateSeries.push({
      x: timestamp,
      y: record.rate
    });
    
    markupSeries.push({
      x: timestamp,
      y: record.markup
    });
  }
  
  return { rateSeries, markupSeries };
}

/**
 * Initializes the chart with data
 * @param {string} containerId - DOM element ID for the chart
 * @param {RateRecord[]} records - Array of rate records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function initChart(containerId, records, fromCurr, toCurr) {
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
  
  const { rateSeries, markupSeries } = transformData(records);
  
  const options = getChartOptions(fromCurr, toCurr);
  options.series[0].data = rateSeries;
  options.series[1].data = markupSeries;
  
  chartInstance = new ApexCharts(container, options);
  chartInstance.render();
}

/**
 * Updates the chart with new data
 * @param {RateRecord[]} records - Array of rate records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 */
export function updateChart(records, fromCurr, toCurr) {
  if (!chartInstance) {
    console.error('Chart not initialized');
    return;
  }
  
  const { rateSeries, markupSeries } = transformData(records);
  
  // Update series data
  chartInstance.updateSeries([
    { name: 'Exchange Rate', data: rateSeries },
    { name: 'Markup (%)', data: markupSeries }
  ]);
  
  // Update Y-axis title
  chartInstance.updateOptions({
    yaxis: [
      {
        title: {
          text: `Rate (${fromCurr} → ${toCurr})`,
          style: { color: '#3B82F6' }
        },
        labels: {
          style: { colors: '#3B82F6' },
          formatter: (value) => value?.toFixed(0) ?? ''
        },
        axisBorder: { show: true, color: '#3B82F6' }
      },
      {
        opposite: true,
        title: {
          text: 'Markup (%)',
          style: { color: '#EF4444' }
        },
        labels: {
          style: { colors: '#EF4444' },
          formatter: (value) => value ? `${(value).toFixed(2)}%` : ''
        },
        axisBorder: { show: true, color: '#EF4444' }
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
    tooltip: {
      theme: tooltipTheme
    },
    legend: {
      labels: { colors: textColor }
    }
  }, false, false);
}
