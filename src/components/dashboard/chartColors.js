// src/components/dashboard/chartColors.js
// Utility to get chart colors from CSS variables

export function getChartColors() {
  if (typeof window === 'undefined') return {};
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--color-primary-searchmind').trim() || '#1E2B2B',
    primaryLighter: styles.getPropertyValue('--color-primary-searchmind-lighter').trim() || '#406969',
    secondary: styles.getPropertyValue('--color-secondary-searchmind').trim() || '#D6CDB6',
    lime: styles.getPropertyValue('--color-lime').trim() || '#C6ED62',
    natural: styles.getPropertyValue('--color-natural').trim() || '#FEFBF2',
    lightGreen: styles.getPropertyValue('--color-light-green').trim() || '#6A8F4D',
    green: styles.getPropertyValue('--color-green').trim() || '#213834',
    black: styles.getPropertyValue('--color-black').trim() || '#131313',
  };
}
