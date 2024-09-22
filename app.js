const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get race data
app.get('/api/racedata', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

    const allRaceData = await Promise.all(jsonFiles.map(async (file) => {
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    }));

    res.json(allRaceData);
  } catch (error) {
    console.error('Error reading race data:', error);
    res.status(500).json({ error: 'Unable to retrieve race data' });
  }
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
