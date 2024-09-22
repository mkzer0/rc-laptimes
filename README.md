# RC Lap Times Tracker

## Description
RC Lap Times Tracker is a web application designed to display and manage lap times for RC (Remote Control) car racing events. It provides a user-friendly interface to view, sort, and filter lap times from various races and drivers.

## Features
- Display lap times from multiple race events
- Sort lap times by various criteria (race name, driver, lap number, etc.)
- Filter lap times by driver or race name
- Responsive design with dark mode using Bootstrap

## Technologies Used
- Node.js
- Express.js
- HTML5
- CSS3 (Bootstrap 5)
- JavaScript (ES6+)

## Lap Time Recording Device
This project is designed to work with the LapMonitor GYFX system for recording lap times. LapMonitor is a multi-user RC lap counter for RC cars and motorbikes that offers:

- Spoken lap times and live race commentary
- Accurate and easy-to-use interface
- Quick race or training setup (less than 2 minutes)
- FREE Android and iOS applications
- Multi-language support (FR, DE, EN, IT, SP, PT)
- Ability to share and export results
- Wireless functionality with a range up to 80m
- Low power consumption (up to 150 hours race time with 2xAAA Batteries)
- Designed and made in France

For more information about the LapMonitor system, visit their [official website](https://lapmonitor.com/store/en/).

## Prerequisites
- Node.js (v14 or later recommended)
- npm (usually comes with Node.js)
- LapMonitor GYFX system for recording lap times

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/rc-laptimes-tracker.git
   cd rc-laptimes-tracker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your race data:
   - Place your JSON race data files (exported from LapMonitor) in the `data/` directory

## Running the Application Locally
1. Start the server:
   ```
   npm start
   ```

2. Open a web browser and navigate to `http://localhost:3000`

## Deployment
This application is configured for deployment on AWS Elastic Beanstalk. To deploy:

1. Install the EB CLI:
   ```
   pip install awsebcli
   ```

2. Initialize your EB application:
   ```
   eb init
   ```

3. Create an environment and deploy:
   ```
   eb create lap-times-tracker-env
   ```

4. For subsequent deployments, use:
   ```
   eb deploy
   ```

## Project Structure
```
rc-laptimes-tracker/
├── app.js
├── package.json
├── data/
│   └── (JSON race data files)
├── public/
│   └── index.html
└── .ebextensions/
    └── (EB configuration files)
```

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- Thanks to all contributors and users of this application
- Inspired by the RC racing community
- LapMonitor GYFX for providing an excellent lap timing system

## Support
If you encounter any problems or have any questions, please open an issue in the GitHub repository.

## Elastic Beanstalk Configuration

This repository includes basic Elastic Beanstalk configuration files (.elasticbeanstalk/*.cfg.yml and .elasticbeanstalk/*.global.yml) to help with deployment.

If you're forking or cloning this repository for your own use:

1. Review the included EB configuration files.
2. Update the configuration as needed for your own AWS environment.
3. Ensure any sensitive information (like API keys or database credentials) is stored securely using environment variables or AWS Parameter Store, not in these configuration files.
