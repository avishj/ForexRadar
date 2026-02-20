/**
 * Global type declarations for CDN-loaded libraries
 */

// ApexCharts is loaded from CDN as a global
import type ApexCharts from 'apexcharts';

declare global {
  const ApexCharts: typeof ApexCharts;
}

export {};
