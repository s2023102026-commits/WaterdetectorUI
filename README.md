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
| **Servo 1 (Left Gate)** | `GPIO 21` | Must be powered by the Buck Converter's 5V Output |
| **Servo 2 (Right Gate)**| `GPIO 22` | Must be powered by the Buck Converter's 5V Output |
| **Ground (GND)** | `GND` | The ESP32, Buck Converter, and Servos **must share a common ground** |

### Power Supply (18650 Battery, Buck Converter & Capacitor)
> **Power Constraints:** Servo motors draw too much current when they move. If they are powered directly from the ESP32's 5V pin, the board will crash and Bluetooth will disconnect.

To solve this, use an external power supply circuit:
1. **18650 Battery in a Battery Holder:** Provides the main power source.
2. **Buck Converter:** Connect the battery holder's output to the buck converter's input. Tune the buck converter to output **exactly 5V**.
3. **2200uF Capacitor:** Attach this capacitor across the **output** of the buck converter (Positive to 5V, Negative to Ground). This acts as a reservoir to control the fluctuation of power and smooth out voltage drops when the servos start moving.
4. **Wiring the Servos:** Connect the Servo VCC pins to the 5V output of the buck converter and their GND pins to the common ground.

---

## 2️⃣ Uploading the Firmware (ESP32)

1. Open the Arduino IDE.
2. Go to **Tools -> Manage Libraries** and ensure the `ESP32Servo` library by Kevin Harrington is installed.
3. Open the `esp32_firmware/esp32_firmware.ino` file.
4. Select your ESP32 board and COM Port.
5. Click **Upload**.

---

## 3️⃣ Accessing the React Dashboard via GitHub Pages

Your beautiful control interface is built with Vite and React and is hosted on **GitHub Pages** for easy access from anywhere.

1. Open your compatible browser (Google Chrome, Edge, or Opera). 
*(Note: Web Bluetooth requires browser support and does not work on Firefox or most iOS browsers. Android Chrome is fully supported).*
2. Navigate to the live application URL: 
   **`https://kurt-aldrin.github.io/WaterdetectorUI/`** *(Or your specific GitHub Pages link).*
3. Ensure your device has **Bluetooth enabled**. If you are on a mobile device, make sure location services are turned on (required for Bluetooth scanning).

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
