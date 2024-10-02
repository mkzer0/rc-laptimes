const { LapTimesTracker } = require('../public/laptimes');

describe('Table Sorting', () => {
  let tracker;
  let mockConfig;
  let mockTable;

  beforeEach(() => {
    document.body.innerHTML = `
      <table id="lapTable">
        <tbody></tbody>
      </table>
    `;

    mockConfig = { API_GATEWAY_URL: 'http://mock-api.com' };
    tracker = new LapTimesTracker(mockConfig);
    mockTable = document.getElementById('lapTable');

    const mockData = [
      { TrackName: 'Track B', DriverName: 'Driver 2', LapNumber: 2, LapTime: 6200, LapDateTime: '2023-05-01T10:01:00Z', RaceNotes: 'Note 2' },
      { TrackName: 'Track A', DriverName: 'Driver 1', LapNumber: 1, LapTime: 6100, LapDateTime: '2023-05-01T10:00:00Z', RaceNotes: 'Note 1' },
      { TrackName: 'Track C', DriverName: 'Driver 3', LapNumber: 3, LapTime: 6300, LapDateTime: '2023-05-01T10:02:00Z', RaceNotes: 'Note 3' },
    ];

    const tbody = mockTable.getElementsByTagName('tbody')[0];
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
    jest.restoreAllMocks();
  });

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
