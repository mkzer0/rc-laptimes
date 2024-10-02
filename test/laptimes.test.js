const { JSDOM } = require('jsdom');

const { LapTimesTracker } = require('../public/laptimes');

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
jest.mock('chart.js', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn()
  }))
}));

// Mock DOM elements
document.body.innerHTML = `
  <div id="chartPanel"></div>
  <div id="tablePanel"></div>
  <select id="viewSwitch"></select>
  <table id="lapTable"><tbody></tbody></table>
  <table id="leaderboardTable"><tbody></tbody></table>
`;

// Mock Bootstrap Modal
global.bootstrap = {
  Modal: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn()
  }))
};

describe('LapTimesTracker', () => {
  let tracker;
  let mockConfig;
  let mockTable;

  beforeEach(() => {
    // Set up the DOM for all tests
    document.body.innerHTML = `
      <div id="chartPanel"></div>
      <div id="tablePanel"></div>
      <select id="viewSwitch"></select>
      <table id="leaderboardTable">
        <tbody></tbody>
      </table>
      <table id="lapTable">
        <tbody></tbody>
      </table>
      <input id="filterInput" />
      <select id="trackFilter"></select>
      <input id="dayFilter" />
      <select id="driverFilter"></select>
      <form id="uploadForm">
        <input type="file" name="file" />
        <input type="text" name="trackName" />
        <textarea name="notes"></textarea>
        <div id="uploadStatus"></div>
        <button type="submit">Upload</button>
      </form>
    `;

    mockConfig = { API_GATEWAY_URL: 'http://mock-api.com' };
    tracker = new LapTimesTracker(mockConfig);
    mockTable = document.getElementById('lapTable');

    // Mock global functions
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );
    global.alert = jest.fn();
    console.error = jest.fn();

    // Set up mock data for sorting tests
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

  // LapTimesTracker tests
  describe('LapTimesTracker', () => {
    test('constructor initializes with correct properties', () => {
      expect(tracker.apiGatewayUrl).toBe(mockConfig.API_GATEWAY_URL);
      expect(tracker.raceData).toEqual([]);
      expect(tracker.chart).toBeNull();
      expect(tracker.lastSortedColumn).toBeNull();
      expect(tracker.chartPanel).toBeTruthy();
      expect(tracker.tablePanel).toBeTruthy();
      expect(tracker.viewSwitch).toBeTruthy();
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
      // Mock the necessary DOM elements
      document.body.innerHTML = `
        <select id="trackFilter"></select>
        <select id="driverFilter"></select>
        <select id="dayFilter"></select>
      `;

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
        { TrackName: 'Track1', DriverName: 'Driver1', BestLapTime: 60000 },
        { TrackName: 'Track2', DriverName: 'Driver2', BestLapTime: 70000 }
      ];

      tracker.updateLeaderboard();

      const leaderboardBody = document.getElementById('leaderboardTable').getElementsByTagName('tbody')[0];
      expect(leaderboardBody.children.length).toBe(2);
    });

    test.skip('updateTableAndChart updates lap table and chart', () => {
      // Mock the necessary DOM elements, including filters
      document.body.innerHTML = `
        <select id="trackFilter"><option value="">All Tracks</option></select>
        <select id="driverFilter"><option value="">All Drivers</option></select>
        <select id="dayFilter"><option value="">All Days</option></select>
        <table id="lapTable"><tbody id="lapTableBody"></tbody></table>
        <canvas id="lapTimeChart"></canvas>
      `;

      // Set up mock data
      tracker.raceData = [
        { TrackName: 'Track1', DriverName: 'Driver1', LapTime: 60000, LapDateTime: '2023-05-01T12:00:00Z' },
      ];

      // Mock the chart creation to avoid errors related to Chart.js
      tracker.createLapChart = jest.fn();

      // Call the method we're testing
      tracker.updateTableAndChart();

      // Check if the table was updated
      const lapTableBody = document.getElementById('lapTableBody');
      expect(lapTableBody.children.length).toBe(1);

      // Check if createLapChart was called
      expect(tracker.createLapChart).toHaveBeenCalled();
    });

    test('handleFileUpload shows message when file or track name is missing', async () => {
      const uploadForm = document.getElementById('uploadForm');
      const uploadStatus = document.getElementById('uploadStatus');
      
      // Test missing file
      await tracker.handleFileUpload({ preventDefault: jest.fn(), target: uploadForm });
      expect(uploadStatus.textContent).toBe('Please select a file and enter a track name.');

      // Reset the upload status
      uploadStatus.textContent = '';

      // Test missing track name
      const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
      const fileInput = uploadForm.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [mockFile] });

      await tracker.handleFileUpload({ preventDefault: jest.fn(), target: uploadForm });
      expect(uploadStatus.textContent).toBe('Please select a file and enter a track name.');
    });

    test('handleFileUpload handles errors', async () => {
      const uploadForm = document.getElementById('uploadForm');
      const uploadStatus = document.getElementById('uploadStatus');
      const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const trackNameInput = uploadForm.querySelector('input[name="trackName"]');

      Object.defineProperty(fileInput, 'files', { value: [mockFile] });
      trackNameInput.value = 'Test Track';

      tracker.readFileContent = jest.fn().mockRejectedValue(new Error('Test error'));

      await tracker.handleFileUpload({ preventDefault: jest.fn(), target: uploadForm });

      expect(console.error).toHaveBeenCalled();
      expect(uploadStatus.textContent).toContain('Upload failed. Please try again.');
    });

    test('handleFileUpload processes and uploads file data', async () => {
      const uploadForm = document.getElementById('uploadForm');
      const mockFile = new File(['{}'], 'test.json', { type: 'application/json' });
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const trackNameInput = uploadForm.querySelector('input[name="trackName"]');
      
      Object.defineProperty(fileInput, 'files', { value: [mockFile] });
      trackNameInput.value = 'Test Track';

      tracker.readFileContent = jest.fn().mockResolvedValue(JSON.stringify({ testData: 'test' }));
      tracker.uploadRaceData = jest.fn().mockResolvedValue({ success: true });
      tracker.refreshData = jest.fn();

      await tracker.handleFileUpload({ preventDefault: jest.fn(), target: uploadForm });

      expect(tracker.readFileContent).toHaveBeenCalledWith(mockFile);
      expect(tracker.uploadRaceData).toHaveBeenCalled();
      expect(tracker.refreshData).toHaveBeenCalled();
    });

    test('readFileContent handles errors', async () => {
      const lapTimesTracker = new LapTimesTracker({});
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockError = new Error('File read error');

      const mockFileReader = {
        readAsText: jest.fn(),
        onload: null,
        onerror: null,
      };

      global.FileReader = jest.fn(() => mockFileReader);

      const readPromise = lapTimesTracker.readFileContent(mockFile);

      mockFileReader.onerror(mockError);

      await expect(readPromise).rejects.toThrow('File read error');
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

    test('setupEventListeners adds all expected event listeners', () => {
      const mockAddEventListener = jest.fn();
      document.getElementById = jest.fn().mockReturnValue({ addEventListener: mockAddEventListener });

      tracker.setupEventListeners();

      // Check if event listeners are added to the correct elements
      expect(mockAddEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
    });

    test.skip('setupEventListeners handles missing elements gracefully', () => {
      // Remove all elements to simulate missing DOM elements
      document.body.innerHTML = '<div></div>';

      // Reset the mock before the test
      mockAddEventListener.mockClear();

      // This should not throw an error
      expect(() => tracker.setupEventListeners()).not.toThrow();

      // Log the calls to addEventListener
      console.log('addEventListener calls:', mockAddEventListener.mock.calls);

      // Check if any event listeners were added
      if (mockAddEventListener.mock.calls.length > 0) {
        console.warn(`Unexpected event listener added: ${JSON.stringify(mockAddEventListener.mock.calls)}`);
      }

      // Expect no more than one call (for the viewSwitch, which might be created by the constructor)
      expect(mockAddEventListener.mock.calls.length).toBeLessThanOrEqual(1);

      // If there is a call, make sure it's for the viewSwitch
      if (mockAddEventListener.mock.calls.length === 1) {
        const [eventType, eventHandler] = mockAddEventListener.mock.calls[0];
        expect(eventType).toBe('change');
        expect(eventHandler.name).toBe('bound handleViewSwitch');
      }
    });
  });
});