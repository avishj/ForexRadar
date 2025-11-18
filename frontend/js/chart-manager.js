/**
 * Chart Manager
 * 
 * Configures and manages the ApexCharts dual-axis line chart.
 * - Y-Axis 1 (Left): Exchange Rate (Blue)
 * - Y-Axis 2 (Right): Markup % (Red, Dotted)
 * 
 * @module chart-manager
 */

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

/** @type {ApexCharts|null} */
let chartInstance = null;

/**
 * Gets the base chart configuration
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Object} ApexCharts options
 */
function getChartOptions(fromCurr, toCurr) {
  return {
    chart: {
      type: 'line',
      height: 400,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      zoom: {
        enabled: true
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 500
      }
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
      width: [2, 2],
      dashArray: [0, 5]  // Solid for rate, dotted for markup
    },
    
    colors: ['#3B82F6', '#EF4444'],  // Blue, Red
    
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'MMM dd'
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
            color: '#3B82F6'
          }
        },
        labels: {
          style: {
            colors: '#3B82F6'
          },
          formatter: (value) => value?.toFixed(4) ?? ''
        },
        axisBorder: {
          show: true,
          color: '#3B82F6'
        }
      },
      {
        opposite: true,
        title: {
          text: 'Markup (%)',
          style: {
            color: '#EF4444'
          }
        },
        labels: {
          style: {
            colors: '#EF4444'
          },
          formatter: (value) => value ? `${(value * 100).toFixed(3)}%` : ''
        },
        axisBorder: {
          show: true,
          color: '#EF4444'
        }
      }
    ],
    
    tooltip: {
      shared: true,
      intersect: false,
      x: {
        format: 'MMM dd, yyyy'
      },
      y: {
        formatter: function(value, { seriesIndex }) {
          if (seriesIndex === 0) {
            return value?.toFixed(6) ?? '-';
          } else {
            return value ? `${(value * 100).toFixed(4)}%` : '-';
          }
        }
      }
    },
    
    legend: {
      position: 'top',
      horizontalAlign: 'center'
    },
    
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 3
    },
    
    markers: {
      size: 0,
      hover: {
        size: 5
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
          formatter: (value) => value?.toFixed(4) ?? ''
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
          formatter: (value) => value ? `${(value * 100).toFixed(3)}%` : ''
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
