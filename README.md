# 🌊 Smart Dam Water Monitoring System - Operation Manual

Welcome to your Smart Dam control interface! This system uses an ESP32 microcontroller to physically monitor water levels and a sleek React Dashboard to visualize and control the system via Web Bluetooth.

---

## 1️⃣ Hardware Setup & Wiring

Ensure your components are wired exactly as follows to prevent PWM timer conflicts and power drops:

| Component | ESP32 Pin | Important Note |
| :--- | :--- | :--- |
| **Ultrasonic Trig Pin** | `GPIO 5` | |
| **Ultrasonic Echo Pin** | `GPIO 18` | |
| **Active Buzzer** | `GPIO 19` | Do NOT use a passive buzzer requiring PWM/Tone |
| **Servo 1 (Left Gate)** | `GPIO 21` | Must be powered by an external 5V source |
| **Servo 2 (Right Gate)**| `GPIO 22` | Must be powered by an external 5V source |
| **Ground (GND)** | `GND` | The ESP32 and external 5V source **must share a common ground** |

> **Power Constraints:** Servo motors draw too much current when they move. If they are powered directly from the ESP32's 5V pin, the board will crash and Bluetooth will disconnect. Always use an external power supply (like a 4x AA battery pack) for the servos.

---

## 2️⃣ Uploading the Firmware (ESP32)

1. Open the Arduino IDE.
2. Go to **Tools -> Manage Libraries** and ensure the `ESP32Servo` library by Kevin Harrington is installed.
3. Open the `esp32_firmware/esp32_firmware.ino` file.
4. Select your ESP32 board and COM Port.
5. Click **Upload**.

---

## 3️⃣ Launching the React Dashboard

Your beautiful control interface is built with Vite and React.

1. Open a terminal (Command Prompt or PowerShell).
2. Navigate to your project folder:
   ```bash
   cd Desktop\segs
   ```
3. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
4. Start the local server:
   ```bash
   npm run dev
   ```
5. Open your browser (Google Chrome or Edge) and go to `http://localhost:5173`. 
*(Note: Web Bluetooth only works on Chrome, Edge, and Opera. It does not work on Firefox).*

---

## 4️⃣ Connecting & Operating

1. Once the web dashboard is open, make sure your ESP32 is plugged in.
2. Click the **Connect System** button in the top right corner.
3. Your browser will open a popup. Select your device (it will be named `ESP32_Dam_Control`) and click **Pair**.
4. The dashboard will instantly sync!

### Understanding the Alerts (The Bimodal System)
Your system actively monitors for both **Floods** and **Droughts** using physical distances. *(Note: You are currently configured in 'Ruler Test Mode', meaning the app shows the direct distance of the object from the sensor).*

* **0 to 2.99 cm:** 🔴 `DROUGHT CRITICAL` (Continuous Alarm. Gates locked).
* **3 to 6.99 cm:** 🟠 `SEVERE DEPLETION` (Fast Warning Alarm).
* **7 to 8.99 cm:** 🟡 `LOW WATER` (Slow Warning Alarm).
* **9 to 14.99 cm:** 🟢 `OPTIMAL LEVEL` (Silent. Normal operations).
* **15 to 16.99 cm:** 🟡 `ELEVATED LEVEL` (Slow Warning Alarm).
* **17 to 19.99 cm:** 🟠 `HIGH WATER` (Fast Warning Alarm).
* **20.0+ cm:** 🔴 `CRITICAL OVERFLOW` (Continuous Alarm. **Gates Auto-Open!**)

### Manual Testing
If you want to manually test the servo gate mechanisms without triggering the water level thresholds:
1. Turn on the **Enable Manual Control** toggle switch on the dashboard.
2. A slider will appear.
3. Slide it between `0°` (Closed) and `180°` (Open). When you let go of the slider, the servos will physically move to match your input!
