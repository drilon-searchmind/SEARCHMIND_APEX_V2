// src/data/dashboardCharts.js
// Dummy data for dashboard graphs

export const revenueData = {
  series: [{
    name: 'Revenue (inc VAT)',
    data: [12000, 15000, 14000, 17000, 16000, 18000, 20000, 21000, 19000, 22000, 23000, 25000],
  }],
  categories: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
};

export const spendAllocationData = {
  series: [
    {
      name: 'PPC',
      data: [4000, 4200, 4100, 4300, 4400, 4500, 4700, 4800, 4600, 4900, 5000, 5200],
    },
    {
      name: 'PS',
      data: [2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100],
    },
  ],
  categories: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
};

export const roasData = {
  series: [{
    name: 'ROAS',
    data: [3.2, 3.5, 3.1, 3.8, 3.6, 3.9, 4.0, 4.2, 4.1, 4.3, 4.4, 4.5],
  }],
  categories: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
};

export const aovData = {
  series: [{
    name: 'Average Order Value',
    data: [120, 130, 125, 140, 135, 145, 150, 155, 148, 160, 162, 170],
  }],
  categories: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
};
