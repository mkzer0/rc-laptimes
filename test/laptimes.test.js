const { LapTimesTracker } = require('../public/laptimes');
// If using ES modules: import { LapTimesTracker } from '../public/laptimes';

// Mock the global fetch function
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ API_GATEWAY_URL: 'http://mock-api.com' }),
  })
);

// Mock D3.js
const mockD3 = {
  scaleOrdinal: jest.fn(() => jest.fn(x => x)),
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
};

jest.mock('d3', () => mockD3);

// Mock Chart.js
const mockChartInstance = {
  destroy: jest.fn(),
  update: jest.fn(),
};

const MockChart = jest.fn(() => mockChartInstance);

jest.mock('chart.js', () => ({
  Chart: MockChart,
}));

// Import your module after mocking
const laptimes = require('../public/laptimes');

describe('LapTimesTracker', () => {
  let tracker;
  let mockConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock DOM elements
    document.body.innerHTML = `
      <table id="leaderboardTable"><tbody></tbody></table>
      <select id="trackFilter"></select>
      <select id="driverFilter"></select>
      <input id="dayFilter" type="date">
      <div id="lapTableBody"></div>
      <canvas id="lapTimeChart"></canvas>
      <form id="uploadForm">
        <input type="file" id="fileInput">
        <input type="text" id="trackName">
        <textarea id="notes"></textarea>
      </form>
      <div id="uploadModal"></div>
    `;

    mockConfig = { API_GATEWAY_URL: 'http://mock-api.com' };
    tracker = new laptimes.LapTimesTracker(mockConfig);

    // Ensure the mocked d3 is used
    tracker.d3 = mockD3;

    // Mock the window object
    global.window = Object.create(window);
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost'
      },
      writable: true
    });

    // Mock bootstrap
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn().mockReturnValue({
          hide: jest.fn()
        })
      }
    };

    // Make sure Chart is available globally
    global.Chart = MockChart;
  });

  test('constructor initializes with correct properties', () => {
    expect(tracker.apiGatewayUrl).toBe(mockConfig.API_GATEWAY_URL);
    expect(tracker.raceData).toEqual([]);
    expect(tracker.chart).toBeNull();
  });

  test('fetchRaceData fetches and stores race data', async () => {
    const mockData = [{ id: 1, TrackName: 'Track1' }];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    await tracker.fetchRaceData();

    expect(global.fetch).toHaveBeenCalledWith(`${mockConfig.API_GATEWAY_URL}/api/data`);
    expect(tracker.raceData).toEqual(mockData);
  });

  test('updateFilters populates filter options', () => {
    tracker.raceData = [
      { TrackName: 'Track1', DriverName: 'Driver1', LapDateTime: '2023-05-01T12:00:00Z' },
      { TrackName: 'Track2', DriverName: 'Driver2', LapDateTime: '2023-05-02T12:00:00Z' },
    ];

    tracker.updateFilters();

    expect(document.getElementById('trackFilter').children.length).toBe(3); // Including the "All Tracks" option
    expect(document.getElementById('driverFilter').children.length).toBe(3);
    expect(document.getElementById('dayFilter').children.length).toBe(3);
  });

  test('updateLeaderboard creates leaderboard rows', () => {
    tracker.raceData = [
      { TrackName: 'Track1', DriverName: 'Driver1', LapTime: 60000, LapDateTime: '2023-05-01T12:00:00Z' },
      { TrackName: 'Track1', DriverName: 'Driver2', LapTime: 55000, LapDateTime: '2023-05-02T12:00:00Z' },
    ];

    tracker.updateLeaderboard();

    const leaderboardBody = document.getElementById('leaderboardTable').getElementsByTagName('tbody')[0];
    expect(leaderboardBody.children.length).toBe(1);
    expect(leaderboardBody.children[0].children[1].textContent).toBe('Driver2');
  });

  test('updateTableAndChart updates lap table and chart', () => {
    tracker.raceData = [
      { TrackName: 'Track1', DriverName: 'Driver1', LapTime: 60000, LapDateTime: '2023-05-01T12:00:00Z' },
    ];

    tracker.updateTableAndChart();

    const lapTableBody = document.getElementById('lapTableBody');
    expect(lapTableBody.children.length).toBe(1);
    expect(tracker.chart).not.toBeNull();
    expect(MockChart).toHaveBeenCalled();

    // Add expectations for D3.js calls
    expect(mockD3.scaleOrdinal).toHaveBeenCalledWith(mockD3.schemeCategory10);
    expect(mockD3.scaleOrdinal).toHaveBeenCalledWith(['circle', 'triangle', 'square', 'diamond', 'star']);
  });

  test('handleFileUpload shows alert when file or track name is missing', async () => {
    global.alert = jest.fn();
  
    // Test missing file
    await tracker.handleFileUpload({ preventDefault: jest.fn() });
    expect(global.alert).toHaveBeenCalledWith('Please select a file to upload');

    // Test missing track name
    const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', { value: [mockFile] });
  
    await tracker.handleFileUpload({ preventDefault: jest.fn() });
    expect(global.alert).toHaveBeenCalledWith('Please enter a track name');
  });

  test('handleFileUpload handles errors', async () => {
    const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', { value: [mockFile] });
    document.getElementById('trackName').value = 'TestTrack';

    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    console.error = jest.fn();
    global.alert = jest.fn();

    await tracker.handleFileUpload({ preventDefault: jest.fn() });

    expect(console.error).toHaveBeenCalled();
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading file'));
  });

  test('handleFileUpload processes and uploads file data', async () => {
    const mockFile = new File(['{"data": "test"}'], 'test.json', { type: 'application/json' });
    const mockEvent = { preventDefault: jest.fn() };

    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: true
    });

    document.getElementById('trackName').value = 'TestTrack';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ message: 'Success' }),
    });

    await tracker.handleFileUpload(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(`${mockConfig.API_GATEWAY_URL}/api/data`, expect.any(Object));
  });

  test('readFileContent handles errors', async () => {
    const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
    const mockError = new Error('File read error');
  
    let onErrorCallback;
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsText: jest.fn(),
      set onerror(callback) {
        onErrorCallback = callback;
      },
      error: mockError,
    }));

    const readPromise = tracker.readFileContent(mockFile);
  
    // Simulate the error event
    onErrorCallback({ error: mockError });

    await expect(readPromise).rejects.toEqual(mockError);
  });

  test('debounce delays function execution', done => {
    jest.useFakeTimers();
    const mockFn = jest.fn();
    const debouncedFn = tracker.debounce(mockFn, 1000);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    jest.runAllTimers();

    expect(mockFn).toHaveBeenCalledTimes(1);
    done();
  });
});

describe('Table Sorting', () => {
  let tracker;
  let mockTable;

  beforeEach(() => {
    // Set up our document body
    document.body.innerHTML = `
      <input id="filterInput" type="text">
      <select id="trackFilter"></select>
      <input id="dayFilter" type="date">
      <select id="driverFilter"></select>
      <div id="chartPanel"></div>
      <div id="tablePanel"></div>
      <input type="checkbox" id="viewSwitch">
      <table id="lapTable">
        <thead>
          <tr>
            <th>Track Name</th>
            <th>Driver Name</th>
            <th>Lap Number</th>
            <th>Lap Time</th>
            <th>Lap Date/Time</th>
            <th>Race Notes</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;

    mockTable = document.getElementById('lapTable');
    tracker = new laptimes.LapTimesTracker({ API_GATEWAY_URL: 'http://test-api.com' });
    
    // Mock data
    const mockData = [
      { TrackName: 'Track B', DriverName: 'Driver 2', LapNumber: 2, LapTime: 6200, LapDateTime: '2023-05-01T10:01:00Z', RaceNotes: 'Note 2' },
      { TrackName: 'Track A', DriverName: 'Driver 1', LapNumber: 1, LapTime: 6100, LapDateTime: '2023-05-01T10:00:00Z', RaceNotes: 'Note 1' },
      { TrackName: 'Track C', DriverName: 'Driver 3', LapNumber: 3, LapTime: 6300, LapDateTime: '2023-05-01T10:02:00Z', RaceNotes: 'Note 3' },
    ];

    const tbody = mockTable.querySelector('tbody');
    mockData.forEach(lap => {
      const row = document.createElement('tr');
      Object.values(lap).forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });

    tracker.setupEventListeners();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Right: Test if sorting works correctly for different columns
  test('sorts table by track name in ascending order', () => {
    tracker.sortTable(0);
    const rows = mockTable.querySelectorAll('tbody tr');
    expect(rows[0].cells[0].textContent).toBe('Track A');
    expect(rows[1].cells[0].textContent).toBe('Track B');
    expect(rows[2].cells[0].textContent).toBe('Track C');
  });

  test('sorts table by lap number in ascending order', () => {
    tracker.sortTable(2);
    const rows = mockTable.querySelectorAll('tbody tr');
    expect(rows[0].cells[2].textContent).toBe('1');
    expect(rows[1].cells[2].textContent).toBe('2');
    expect(rows[2].cells[2].textContent).toBe('3');
  });

  // Boundary: Test sorting with empty table and single row
  test('handles sorting an empty table', () => {
    mockTable.querySelector('tbody').innerHTML = '';
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    tracker.sortTable(0);
    expect(consoleSpy).toHaveBeenCalledWith('Table is empty, nothing to sort');
    consoleSpy.mockRestore();
  });

  test('handles sorting a table with a single row', () => {
    mockTable.querySelector('tbody').innerHTML = '<tr><td>Single</td><td>Row</td><td>1</td><td>6000</td><td>2023-05-01T10:00:00Z</td><td>Note</td></tr>';
    expect(() => tracker.sortTable(0)).not.toThrow();
  });

  // Inverse: Test descending order
  test('toggles sort direction when clicking the same column', () => {
    tracker.sortTable(0); // First click: ascending
    tracker.sortTable(0); // Second click: descending
    const rows = mockTable.querySelectorAll('tbody tr');
    expect(rows[0].cells[0].textContent).toBe('Track C');
    expect(rows[1].cells[0].textContent).toBe('Track B');
    expect(rows[2].cells[0].textContent).toBe('Track A');
  });

  // Cross-check: Verify sorting by comparing with a known sorted array
  test('sorts lap times correctly', () => {
    const tbody = mockTable.querySelector('tbody');
    tbody.innerHTML = `
      <tr><td>Track A</td><td>Driver 1</td><td>1</td><td>1:02.96</td><td>2023-05-01T10:00:00Z</td><td>Note 1</td></tr>
      <tr><td>Track B</td><td>Driver 2</td><td>2</td><td>0:59.99</td><td>2023-05-01T10:01:00Z</td><td>Note 2</td></tr>
      <tr><td>Track C</td><td>Driver 3</td><td>3</td><td>1:00.01</td><td>2023-05-01T10:02:00Z</td><td>Note 3</td></tr>
    `;

    tracker.sortTable(3); // Sort by lap time
    const rows = mockTable.querySelectorAll('tbody tr');
    const sortedLapTimes = Array.from(rows).map(row => row.cells[3].textContent);
    expect(sortedLapTimes).toEqual(['0:59.99', '1:00.01', '1:02.96']);
  });

  // Error conditions: Test with invalid column index
  test('handles invalid column index gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    tracker.sortTable(10);
    expect(consoleSpy).toHaveBeenCalledWith('Invalid column index: 10');
    consoleSpy.mockRestore();
  });

  // Performance: Test sorting performance with a large dataset
  test('sorts a large dataset within acceptable time', () => {
    const tbody = mockTable.querySelector('tbody');
    for (let i = 0; i < 1000; i++) {
      const row = document.createElement('tr');
      for (let j = 0; j < 6; j++) {
        const td = document.createElement('td');
        td.textContent = `Data ${i}-${j}`;
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }

    const startTime = performance.now();
    tracker.sortTable(0);
    const endTime = performance.now();
    const sortTime = endTime - startTime;

    expect(sortTime).toBeLessThan(100); // Assuming sorting should take less than 100ms
  });
});