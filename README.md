# Geofence Web Application: Location-Based Notification System

![GitHub last commit](https://img.shields.io/github/last-commit/YOUR_USERNAME/YOUR_REPOSITORY?color=blue)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 📝 Overview

This project is a sophisticated web application designed to demonstrate a location-based geofencing system. It allows users to define a virtual geographic boundary (geofence) on a map and receive dynamic notifications when their current location enters or exits this predefined area. Beyond core geofencing, the application showcases various interactive notification patterns, user authentication simulations, and integration with external services like Google Maps and Telegram.

It serves as a comprehensive example for developers interested in building location-aware web applications with rich user feedback and external communication capabilities.

## ✨ Key Features

* **Precise Geofence Definition:**
    * Interactive map interface (powered by Google Maps) for users to precisely select a central point for their geofence.
    * Adjustable radius slider to customize the geofence size, providing flexibility for various use cases.
    * Visual representation of the geofence (circle) on the map for clear understanding.

* **Real-time Location Tracking:**
    * Utilizes the browser's Geolocation API (`navigator.geolocation.watchPosition`) for continuous, real-time monitoring of the user's current location.
    * Automatically updates the user's position on the map.

* **Dynamic Geofence Status Notifications:**
    * **In-App Alerts (SweetAlert2):** Displays visually appealing pop-up notifications directly within the web application when the user enters or exits the geofence.
    * **Browser Notifications:** Sends system-level notifications (supported on desktop browsers and Android) to alert the user of geofence status changes, even when the browser tab is in the background. Note: Only a "Downloading..." notification is shown at the start of a simulated download, without a "Download Complete" browser notification, to focus on the ongoing process.

* **Simulated Interactive Notifications:**
    * Demonstrates how to create browser notifications that, while not having native buttons, become interactive upon clicking.
    * Clicking these notifications brings the user back to the application's tab and triggers a rich, interactive SweetAlert2 modal (e.g., for accepting or declining a meeting invitation).

* **Download Progress Bar Simulation:**
    * Features a SweetAlert2 modal that acts as a progress bar for a simulated download.
    * Accompanied by a "Downloading..." browser notification that appears at the start and is automatically closed when the simulated download completes.

* **Basic User Authentication Demo:**
    * Includes a login form simulation using SweetAlert2, showcasing interactive input fields and validation.
    * A "Forgot Password" feature with email input to demonstrate more complex user interactions within a modal.

* **Google Maps Integration:**
    * Core mapping functionality, marker placement, and circle overlays for geofence visualization.
    * Utilizes the Google Maps JavaScript API for all map-related operations.

* **Telegram Notification Integration (Requires Backend Setup):**
    * The application is designed to send geofence entry/exit alerts to a specified Telegram bot.
    * This functionality relies on a backend Vercel Serverless Function to securely handle the Telegram API communication.

## 💻 Technologies Used

* **Frontend:**
    * **HTML5:** Standard markup language for structuring web content.
    * **CSS3 (Tailwind CSS):** A utility-first CSS framework for rapid and responsive UI styling.
    * **JavaScript (ES6+):** The primary scripting language for all client-side logic, interactivity, and API calls.
    * **Google Maps JavaScript API:** For rendering interactive maps, location services, and geospatial calculations.
    * **SweetAlert2 (`^11.x`):** A beautiful, responsive, customizable, and accessible replacement for JavaScript's popup boxes. Used extensively for in-app notifications and interactive modals.
    * **Font Awesome (`^6.x`):** A popular icon library used for various UI elements and button icons.
* **Backend (for Telegram Notifications - Optional):**
    * **Node.js:** Runtime environment for the serverless function.
    * **Vercel Serverless Functions:** Platform for deploying the backend logic to handle Telegram API requests.
    * `axios` (or `node-fetch`): HTTP client for making requests to the Telegram Bot API.

## 🚀 Getting Started

Follow these steps to set up and run the project on your local machine.

### Prerequisites

* A modern web browser (e.g., Chrome, Firefox, Edge).
* [Git](https://git-scm.com/downloads) installed on your system.
* A [Google Cloud Account](https://cloud.google.com/free) to obtain a Google Maps API Key.
* (Optional, for Telegram notifications) A [Vercel Account](https://vercel.com/) and a Telegram Bot Token.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git) # Replace with your actual repository URL
    cd geofence-web-app # Or the name of your cloned directory
    ```

2.  **Serve Locally:**
    Since this project uses client-side JavaScript features like `fetch` and potentially future Service Workers, it's recommended to serve it via a local web server rather than just opening `index.html` directly.
    * **Using VS Code Live Server Extension:** If you use VS Code, install the "Live Server" extension, then right-click `index.html` and select "Open with Live Server".
    * **Using Python's Simple HTTP Server:**
        ```bash
        python -m http.server
        ```
        Then, open your browser and navigate to `http://localhost:8000`.

3.  **Configure Google Maps API Key:**
    * Go to the [Google Cloud Console](https://console.cloud.google.com/) and navigate to your project.
    * Ensure the "Maps JavaScript API" is enabled for your project.
    * Go to "APIs & Services" > "Credentials" and create an API Key (if you don't have one).
    * **Open `index.html`** in your project folder.
    * Locate the script tag for Google Maps API, usually at the bottom of the `<body>`:
        ```html
        <script
          async
          defer
          src="[https://maps.googleapis.com/maps/api/js?key=YOUR_Maps_API_KEY&callback=initGoogleMaps](https://maps.googleapis.com/maps/api/js?key=YOUR_Maps_API_KEY&callback=initGoogleMaps)"
        ></script>
        ```
    * **Replace `YOUR_Maps_API_KEY`** with the actual API key you obtained from Google Cloud.

4.  **Set up Vercel Function for Telegram (Optional):**
    If you wish to enable Telegram notifications:
    * Create a new file in your project root called `api/geofence.js`.
    * Populate `api/geofence.js` with code similar to the following (you'll need to install `axios` or use `node-fetch` if you prefer):
        ```javascript
        // api/geofence.js (Example Vercel Serverless Function)
        import axios from 'axios'; // npm install axios

        export default async function handler(request, response) {
          if (request.method === 'POST') {
            const { message } = request.body;

            // Securely get your bot token and chat ID from Vercel Environment Variables
            const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
            const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

            if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
              return response.status(500).json({ error: 'Telegram bot token or chat ID not configured.' });
            }

            const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

            try {
              await axios.post(telegramApiUrl, {
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
              });
              return response.status(200).json({ success: true, message: 'Notification sent to Telegram.' });
            } catch (error) {
              console.error('Error sending Telegram message:', error.response ? error.response.data : error.message);
              return response.status(500).json({ error: 'Failed to send Telegram notification.' });
            }
          } else {
            return response.status(405).json({ error: 'Method Not Allowed' });
          }
        }
        ```
    * **Configure Environment Variables in Vercel:** In your Vercel project settings, add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as environment variables.
    * Deploy your project to Vercel. The `api/geofence.js` file will automatically become an accessible endpoint at `/api/geofence` relative to your deployed application's URL.

## 🚀 Usage Guide

Once the application is running locally:

1.  **Allow Location Access:** When prompted by your browser, grant permission for the site to access your geographical location. This is essential for geofence functionality.
2.  **Define Your Geofence:**
    * Click the **"Select Location"** button. A map modal will appear.
    * Click anywhere on the map to place a **marker**. This point will be the center of your geofence.
    * Use the **radius slider** to adjust the size (radius) of the geofence.
    * Click **"Save Location"** to confirm your geofence.
3.  **Observe Geofence Notifications:**
    * Move your device into or out of the defined geofence area.
    * You will receive **in-app pop-ups (SweetAlert)** indicating "You are INSIDE the geofence!" or "You are OUTSIDE the geofence!".
    * Simultaneously, you will receive **browser notifications** (on desktop and Android) for these status changes.
4.  **Test Other Notification Types:**
    * **"Show Download Progress" Button:** Click this to see a simulated download progress bar (SweetAlert) along with a "Downloading..." browser notification.
    * **"Show Interactive Notification" Button:** Click this to trigger a "Meeting Invitation" browser notification. Clicking this browser notification will then bring focus to your application and display an interactive SweetAlert modal where you can "Accept" or "Declined" the invitation.
    * **"Login" Button:** Test the simulated login form.
    * **"Forgot Password" Link:** Explore the email input for password recovery.

## 📂 Project Structure (Key Files)

├── index.html            # Main application HTML file
├── tes.js                # All core frontend JavaScript logic (geofence, notifications, UI interactions)
└── api/                  # (Optional) Directory for Vercel Serverless Functions
└── geofence.js       # Backend function for Telegram notification (if implemented)

## 🐛 Debugging

* **Browser Console:** Open your browser's developer tools (usually by pressing `F12`) and navigate to the "Console" tab. Look for any error messages or `console.log` outputs related to location, API calls, or notification permissions.
* **Notification Permissions:** Double-check your browser's site settings and your operating system's notification settings to ensure notifications are allowed for your site.

## 🗺️ Roadmap & Future Enhancements

* **Core Functionality:**
    * **Persistent Geofences:** Implement local storage or a backend database to save defined geofences across sessions.
    * **Multiple Geofences:** Allow users to define, save, and manage several geofence areas simultaneously.
    * **Geofence History:** Log entry/exit events with timestamps.
* **User Interface & Experience:**
    * More intuitive UI for managing saved geofences.
    * Customizable notification sounds and types.
    * Improved map interaction and controls.
* **Notifications:**
    * **True Push Notifications:** Implement a Service Worker for push notifications that can be received even when the browser is closed (requires server-side integration).
    * **Native Notification Actions:** With a Service Worker, enable direct "Accept" / "Decline" buttons on the browser notification itself.
* **User Management:**
    * Full user registration and profile management.
    * Secure authentication with real backend services.
* **Deployment:**
    * Integrate with CI/CD pipelines for automated deployment.

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or new features, feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note:** Remember to create a `LICENSE` file in your repository if you choose the MIT license. You'll also need to replace placeholder URLs and usernames/repository names with your actual details.