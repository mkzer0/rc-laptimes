document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('uploadForm');
  const statusDiv = document.getElementById('uploadStatus');

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      statusDiv.textContent = `File uploaded successfully. URL: ${result.fileUrl}`;
      // Optionally, refresh the lap times data here
      if (typeof fetchRaceData === 'function') {
        fetchRaceData();
      }
    } catch (error) {
      statusDiv.textContent = `Upload failed: ${error.message}`;
    }
  });
});
