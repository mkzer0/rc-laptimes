// At the top of the file
(function(window) {
  let Chart = window.Chart;

  class LapTimesTracker {
    constructor(config) {
      this.apiGatewayUrl = config.API_GATEWAY_URL;
      this.raceData = [];
      this.chart = null;  // Initialize chart as null
      this.lastSortedColumn = null;
      this.chartPanel = document.getElementById('chartPanel');
      this.tablePanel = document.getElementById('tablePanel');
      this.viewSwitch = document.getElementById('viewSwitch');
      this.setupModalEventListeners();
      this.setupEventListeners();
    }

    async initialize() {
      await this.fetchRaceData();
      this.updateFilters();
      this.updateLeaderboard();
      this.destroyChart();  // Add this line
      this.updateTableAndChart();
    }

    async fetchRaceData() {
      try {
        const response = await fetch(`${this.apiGatewayUrl}/api/data`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.raceData = await response.json();
      } catch (error) {
        console.error('Error fetching race data:', error);
      }
    }

    updateFilters() {
      const uniqueTracks = this.getUniqueValues('TrackName');
      const uniqueDrivers = this.getUniqueValues('DriverName');
      const uniqueDays = this.getUniqueDays();

      this.populateFilter('trackFilter', uniqueTracks);
      this.populateFilter('driverFilter', uniqueDrivers);
      this.populateFilter('dayFilter', uniqueDays);
    }

    getUniqueValues(key) {
      return [...new Set(this.raceData.map(item => item[key]))];
    }

    getUniqueDays() {
      return [...new Set(this.raceData.map(item => item.LapDateTime.split('T')[0]))];
    }

    populateFilter(filterId, options) {
      const filter = document.getElementById(filterId);
      filter.innerHTML = `<option value="">All ${filterId.replace('Filter', 's')}</option>`;
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        filter.appendChild(optionElement);
      });
    }

    updateLeaderboard(trackFilter = '') {
      const leaderboardBody = document.getElementById('leaderboardTable').getElementsByTagName('tbody')[0];
      leaderboardBody.innerHTML = '';

      const trackRecords = this.getTrackRecords(trackFilter);
      trackRecords.forEach(record => {
        const row = this.createLeaderboardRow(record);
        leaderboardBody.appendChild(row);
      });
    }

    getTrackRecords(trackFilter) {
      const filteredData = trackFilter ? this.raceData.filter(lap => lap.TrackName === trackFilter) : this.raceData;
      const trackRecords = {};

      filteredData.forEach(lap => {
        if (!trackRecords[lap.TrackName] || lap.LapTime < trackRecords[lap.TrackName].LapTime) {
          trackRecords[lap.TrackName] = lap;
        }
      });

      return Object.values(trackRecords);
    }

    createLeaderboardRow(record) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${record.TrackName}</td>
        <td>${record.DriverName}</td>
        <td>${this.formatLapTime(record.LapTime)}</td>
        <td>${new Date(record.LapDateTime).toLocaleDateString()}</td>
        <td>${this.calculateRecordAge(record.LapDateTime)}</td>
      `;
      return row;
    }

    formatLapTime(lapTime) {
      const minutes = Math.floor(lapTime / 6000);
      const seconds = Math.floor((lapTime % 6000) / 100);
      const hundredths = lapTime % 100;
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
    }

    calculateRecordAge(lapDateTime) {
      const lapDate = new Date(lapDateTime);
      const today = new Date();
      const diffTime = Math.abs(today - lapDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    }

    updateTableAndChart() {
      this.updateLapTable();
      this.updateLapChart();
    }

    updateLapTable() {
      const tableBody = document.getElementById('lapTableBody');
      tableBody.innerHTML = '';

      const filteredData = this.getFilteredData();
      if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No data matches the selected filters</td></tr>';
        return;
      }

      filteredData.forEach(lap => {
        const row = this.createLapTableRow(lap);
        tableBody.appendChild(row);
      });

      this.lastSortedColumn = null; // Reset the last sorted column
    }

    getFilteredData() {
      const trackFilter = document.getElementById('trackFilter').value;
      const driverFilter = document.getElementById('driverFilter').value;
      const dayFilter = document.getElementById('dayFilter').value;

      return this.raceData.filter(lap => 
        (!trackFilter || lap.TrackName === trackFilter) &&
        (!driverFilter || lap.DriverName === driverFilter) &&
        (!dayFilter || lap.LapDateTime.startsWith(dayFilter))
      );
    }

    createLapTableRow(lap) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${lap.TrackName}</td>
        <td>${lap.DriverName}</td>
        <td>${lap.LapNumber}</td>
        <td>${this.formatLapTime(lap.LapTime)}</td>
        <td>${new Date(lap.LapDateTime).toLocaleString()}</td>
        <td>${lap.RaceNotes || ''}</td>
      `;
      return row;
    }

    updateLapChart() {
      const chartCanvas = document.getElementById('lapTimeChart');
      const filteredData = this.getFilteredData();

      if (this.chart) {
        this.chart.destroy();
      }
      this.chart = new Chart(chartCanvas, {
        type: 'scatter',  // Change this from 'line' to 'scatter'
        data: this.prepareLapChartData(filteredData),
        options: this.getLapChartOptions()
      });
    }

    prepareLapChartData(filteredData) {
      const uniqueTracks = [...new Set(filteredData.map(lap => lap.TrackName))];
      const uniqueDrivers = [...new Set(filteredData.map(lap => lap.DriverName))];
      
      // Simple color generation function
      const getColor = (index) => {
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
        return colors[index % colors.length];
      };

      // Simple shape generation function
      const getShape = (index) => {
        const shapes = ['circle', 'triangle', 'rect', 'star', 'cross', 'dash'];
        return shapes[index % shapes.length];
      };

      return {
        datasets: uniqueDrivers.flatMap((driver, driverIndex) => 
          uniqueTracks.map((track, trackIndex) => ({
            label: `${driver} - ${track}`,
            data: filteredData
              .filter(lap => lap.DriverName === driver && lap.TrackName === track)
              .map(lap => ({
                x: new Date(lap.LapDateTime).getTime(), // Convert to timestamp
                y: lap.LapTime / 100
              })),
            backgroundColor: getColor(driverIndex),
            pointStyle: getShape(trackIndex),
            pointRadius: 5,
            pointHoverRadius: 8
          }))
        )
      };
    }

    getLapChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM D, YYYY'
              }
            },
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              callback: function(value, index, values) {
                return new Date(value).toLocaleDateString();
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Lap Time (seconds)'
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(2);
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                return new Date(context[0].parsed.x).toLocaleString();
              },
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} seconds`;
              }
            }
          }
        }
      };
    }

    setupEventListeners() {
      const addListenerIfExists = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener(event, handler.bind(this));
        }
      };

      addListenerIfExists('filterInput', 'input', this.handleFilterInput);
      addListenerIfExists('trackFilter', 'change', this.handleTrackFilterChange);
      addListenerIfExists('dayFilter', 'change', this.handleFilterChange);
      addListenerIfExists('driverFilter', 'change', this.handleFilterChange);

      const uploadForm = document.getElementById('uploadForm');
      if (uploadForm) {
        uploadForm.addEventListener('submit', this.handleFileUpload.bind(this));
      }

      // Add event listeners for table headers
      const headers = document.querySelectorAll('#lapTable th');
      headers.forEach((header, index) => {
        header.addEventListener('click', () => this.sortTable(index));
        header.style.cursor = 'pointer';
      });

      if (this.viewSwitch) {
        this.viewSwitch.addEventListener('change', this.handleViewSwitch.bind(this));
      }
    }

    handleFilterInput() {
      this.filterTable();
      this.updateLapChart();
    }

    handleTrackFilterChange() {
      const trackFilter = document.getElementById('trackFilter').value;
      this.updateLeaderboard(trackFilter);
      this.handleFilterChange();
    }

    handleFilterChange() {
      this.destroyChart();  // Add this line
      this.updateTableAndChart();
    }

    filterTable() {
      const filterValue = document.getElementById('filterInput').value.toLowerCase();
      const rows = document.getElementById('lapTableBody').getElementsByTagName('tr');

      Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filterValue) ? '' : 'none';
      });
    }

    async handleFileUpload(e) {
      e.preventDefault();
      
      const form = e.target || document.getElementById('uploadForm');
      if (!form) {
        console.error('Upload form not found');
        return;
      }

      const fileInput = form.querySelector('input[type="file"]');
      const trackNameInput = form.querySelector('input[name="trackName"]');
      const notesInput = form.querySelector('textarea[name="notes"]');
      const uploadStatus = document.getElementById('uploadStatus');
      const uploadButton = form.querySelector('button[type="submit"]');

      if (!fileInput || !trackNameInput) {
        console.error('Required form elements not found');
        return;
      }

      if (!fileInput.files[0] || !trackNameInput.value) {
        if (uploadStatus) uploadStatus.textContent = 'Please select a file and enter a track name.';
        return;
      }

      const file = fileInput.files[0];

      try {
        uploadStatus.textContent = 'Uploading...';
        uploadStatus.className = 'alert alert-info';
        uploadButton.disabled = true;

        // Read the file content
        const fileContent = await this.readFileContent(file);
        const raceData = JSON.parse(fileContent);

        // Add track name and notes to the race data
        raceData.trackName = trackNameInput.value;
        raceData.notes = notesInput.value;

        console.log('Uploading race data:', raceData);
        const response = await this.uploadRaceData(file.name, raceData);

        console.log('Upload response:', response);

        uploadStatus.textContent = 'Upload successful! You can now close this window.';
        uploadStatus.className = 'alert alert-success';
        
        // Refresh the data in the background
        this.refreshData();

      } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.textContent = 'Upload failed. Please try again.';
        uploadStatus.className = 'alert alert-danger';
      } finally {
        uploadButton.disabled = false;
      }
    }

    async uploadRaceData(fileName, raceData) {
      return fetch(`${this.apiGatewayUrl}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileName,
          fileContent: btoa(JSON.stringify(raceData))
        }),
      });
    }    

    // Helper method to read file content
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      });
    }

    refreshData() {
      // Refresh the data and update the UI
      this.fetchRaceData().then(() => {
        this.updateFilters();
        this.updateLeaderboard();
        this.updateTableAndChart();
      });
    }

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    destroyChart() {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
    }

    sortTable(columnIndex) {
      const table = document.querySelector('#lapTable');
      if (!table) return;  // Exit if table doesn't exist

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      
      // Check if the table is empty
      if (rows.length === 0) {
        console.warn('Table is empty, nothing to sort');
        return;
      }

      // Check if the columnIndex is valid
      if (columnIndex < 0 || columnIndex >= rows[0].cells.length) {
        console.warn(`Invalid column index: ${columnIndex}`);
        return;  // Exit the function if the column index is invalid
      }

      const isLapNumber = columnIndex === 2;
      const isLapTime = columnIndex === 3;
      const isDateTime = columnIndex === 4;

      rows.sort((a, b) => {
        let aValue = a.cells[columnIndex].textContent.trim();
        let bValue = b.cells[columnIndex].textContent.trim();

        if (isLapNumber) {
          return parseInt(aValue) - parseInt(bValue);
        } else if (isLapTime) {
          return this.convertLapTimeToMilliseconds(aValue) - this.convertLapTimeToMilliseconds(bValue);
        } else if (isDateTime) {
          return new Date(aValue) - new Date(bValue);
        } else {
          return aValue.localeCompare(bValue);
        }
      });

      // Toggle sort direction
      if (this.lastSortedColumn === columnIndex) {
        rows.reverse();
        this.lastSortedColumn = null;
      } else {
        this.lastSortedColumn = columnIndex;
      }

      // Re-append sorted rows
      tbody.innerHTML = '';
      rows.forEach(row => tbody.appendChild(row));

      // Update sort indicators
      const headers = document.querySelectorAll('#lapTable th');
      headers.forEach((header, index) => {
        if (index === columnIndex) {
          header.classList.toggle('sorted-asc', this.lastSortedColumn === null);
          header.classList.toggle('sorted-desc', this.lastSortedColumn !== null);
        } else {
          header.classList.remove('sorted-asc', 'sorted-desc');
        }
      });
    }

    convertLapTimeToMilliseconds(lapTime) {
      const [minutes, secondsAndHundredths] = lapTime.split(':');
      const [seconds, hundredths] = secondsAndHundredths.split('.');
      return parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(hundredths) * 10;
    }

    handleViewSwitch() {
      if (this.viewSwitch && this.chartPanel && this.tablePanel) {
        if (this.viewSwitch.checked) {
          this.chartPanel.classList.remove('active');
          this.tablePanel.classList.add('active');
        } else {
          this.chartPanel.classList.add('active');
          this.tablePanel.classList.remove('active');
        }
        // Trigger a resize event to ensure the chart redraws correctly if it's now visible
        window.dispatchEvent(new Event('resize'));
      }
    }

    setupModalEventListeners() {
      const uploadModal = document.getElementById('uploadModal');
      if (uploadModal) {
        uploadModal.addEventListener('hidden.bs.modal', this.handleModalHidden.bind(this));
      }
    }

    handleModalHidden() {
      const uploadStatus = document.getElementById('uploadStatus');
      if (uploadStatus) {
        uploadStatus.textContent = '';
        uploadStatus.className = '';
      }

      // Focus on the main page
      this.focusMainPage();
    }

    focusMainPage() {
      // Focus on an important element in the main page
      const mainElement = document.getElementById('mainContent') || document.body;
      mainElement.focus();
    }

    showLoadingIndicator() {
      // Show a loading indicator in the main UI
    }

    hideLoadingIndicator() {
      // Hide the loading indicator
    }

    showSuccessMessage(message) {
      // Show a success message in the main UI
    }

    showErrorMessage(message) {
      // Show an error message in the main UI
    }
  }

  // Separate initialization function
  async function initializeLapTimesTracker() {
    try {
      const response = await fetch('config.json');
      const config = await response.json();
      window.API_GATEWAY_URL = config.API_GATEWAY_URL;
      const app = new LapTimesTracker(config);
      await app.initialize();
      return app;
    } catch (error) {
      console.error('Error initializing LapTimesTracker:', error);
      throw error;
    }
  }

  // Expose the necessary functions and classes to the global scope
  window.LapTimesTracker = LapTimesTracker;
  window.initializeLapTimesTracker = initializeLapTimesTracker;

})(window);

// At the end of the file
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LapTimesTracker };
}