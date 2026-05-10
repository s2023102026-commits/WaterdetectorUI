#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>

// BLE UUIDs
#define SERVICE_UUID               "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID_LEVEL  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHARACTERISTIC_UUID_THRESH "a81b6766-381c-43f9-ba2a-302a2cdbe150"
#define CHARACTERISTIC_UUID_TEST   "c4a45f94-9686-4e5a-9b48-18546b430c5e"

// Pins
const int trigPin = 5;
const int echoPin = 18;
const int buzzerPin = 19;
const int servo1Pin = 21;
const int servo2Pin = 22;

// Variables
float currentLevel = 0.0;
float maxLevelThreshold = 20.00; // Trigger threshold set to 20cm
bool deviceConnected = false;
bool gateOpen = false;
bool manualTestActive = false;

// --- SENSOR CALIBRATION ---
// If the app shows 28.7cm when you are exactly at 20cm, adjust these values!
float SENSOR_MOUNT_HEIGHT = 45.72; // The physical height of the sensor from the very bottom of the tank (0cm)
float DISTANCE_OFFSET = 0.0;       // Tweak this to add/subtract cm if the sensor raw distance is inherently off
// --------------------------

// Timers for non-blocking loop
unsigned long previousSensorMillis = 0;
unsigned long previousBuzzerMillis = 0;
bool buzzerState = false;

// Servos
Servo gateServo1;
Servo gateServo2;

BLEServer* pServer = NULL;
BLECharacteristic* pLevelCharacteristic = NULL;
BLECharacteristic* pThreshCharacteristic = NULL;
BLECharacteristic* pTestCharacteristic = NULL;

// Function Prototypes
void openGates();
void closeGates();

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      // Restart advertising
      pServer->getAdvertising()->start();
    }
};

class ThreshCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        float newThresh = rxValue.toFloat();
        if (newThresh > 0 && newThresh <= 45.72) {
          maxLevelThreshold = newThresh;
          Serial.print("New threshold set: ");
          Serial.println(maxLevelThreshold);
        }
      }
    }
};

class TestCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        int angle = rxValue.toInt();
        if (angle == -1) {
          manualTestActive = false;
          Serial.println("MANUAL TEST ENDED - RETURN TO AUTO");
          digitalWrite(buzzerPin, LOW); // Ensure buzzer off
          if (currentLevel >= maxLevelThreshold) {
            openGates();
            digitalWrite(buzzerPin, HIGH);
          } else {
            closeGates();
          }
        } else if (angle >= 0 && angle <= 180) {
          manualTestActive = true;
          gateServo1.write(angle);
          gateServo2.write(angle);
          Serial.print("MANUAL TEST ANGLE: ");
          Serial.println(angle);
          if (angle > 0) digitalWrite(buzzerPin, HIGH); 
          else digitalWrite(buzzerPin, LOW);
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Init Pins
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Init Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  gateServo1.setPeriodHertz(50);
  gateServo2.setPeriodHertz(50);
  gateServo1.attach(servo1Pin, 500, 2400);
  gateServo2.attach(servo2Pin, 500, 2400);
  closeGates();

  // BLE Setup
  BLEDevice::init("DamController_ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pLevelCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID_LEVEL,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pLevelCharacteristic->addDescriptor(new BLE2902());

  pThreshCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID_THRESH,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE
                    );
  pThreshCharacteristic->setCallbacks(new ThreshCallbacks());
  pThreshCharacteristic->setValue(String(maxLevelThreshold).c_str());

  pTestCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID_TEST,
                      BLECharacteristic::PROPERTY_WRITE
                    );
  pTestCharacteristic->setCallbacks(new TestCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("BLE Advertising started...");
}

void loop() {
  unsigned long currentMillis = millis();

  // Bimodal Alert Logic (Drought vs Overflow)
  if (!manualTestActive) {
    if (currentLevel >= 20.0) {
      digitalWrite(buzzerPin, HIGH); // Overflow RED
    } else if (currentLevel >= 17.0) {
      if (currentMillis - previousBuzzerMillis >= 125) { // Overflow ORANGE
        previousBuzzerMillis = currentMillis;
        buzzerState = !buzzerState;
        digitalWrite(buzzerPin, buzzerState ? HIGH : LOW);
      }
    } else if (currentLevel >= 15.0) {
      if (currentMillis - previousBuzzerMillis >= 500) { // Overflow YELLOW
        previousBuzzerMillis = currentMillis;
        buzzerState = !buzzerState;
        digitalWrite(buzzerPin, buzzerState ? HIGH : LOW);
      }
    } else if (currentLevel >= 9.0) {
      digitalWrite(buzzerPin, LOW); // GREEN (Normal/Optimal)
    } else if (currentLevel >= 7.0) {
      if (currentMillis - previousBuzzerMillis >= 500) { // Drought YELLOW
        previousBuzzerMillis = currentMillis;
        buzzerState = !buzzerState;
        digitalWrite(buzzerPin, buzzerState ? HIGH : LOW);
      }
    } else if (currentLevel >= 3.0) {
      if (currentMillis - previousBuzzerMillis >= 125) { // Drought ORANGE
        previousBuzzerMillis = currentMillis;
        buzzerState = !buzzerState;
        digitalWrite(buzzerPin, buzzerState ? HIGH : LOW);
      }
    } else {
      digitalWrite(buzzerPin, HIGH); // Drought RED
    }
  }

  // Sensor reading and BLE (every 1 second)
  if (currentMillis - previousSensorMillis >= 1000) {
    previousSensorMillis = currentMillis;

    // Read Distance
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Use a 30ms timeout to prevent hangs.
    long duration = pulseIn(echoPin, HIGH, 30000); 
    
    if (duration > 0) {
      float rawDistance = duration * 0.034 / 2;
      float distance = rawDistance + DISTANCE_OFFSET;
      
      // Calculate true water level (from bottom of the tank up)
      // distance is the distance from the sensor to the water surface
      currentLevel = SENSOR_MOUNT_HEIGHT - distance;
      
      if (currentLevel < 0) currentLevel = 0;

      Serial.print("Raw Distance: ");
      Serial.print(distance);
      Serial.print(" cm | Calculated Water Level: ");
      Serial.println(currentLevel);
    } else {
      Serial.println("Sensor timeout or missed echo. Ignoring false 0 reading...");
    }

    // Logic for gates
    if (!manualTestActive) {
      if (currentLevel >= maxLevelThreshold && !gateOpen) {
        openGates();
      } else if (currentLevel <= 15.0 && gateOpen) {
        closeGates();
      }
    }

    // Notify via BLE
    if (deviceConnected) {
      String levelStr = String(currentLevel, 2);
      pLevelCharacteristic->setValue(levelStr.c_str());
      pLevelCharacteristic->notify();
    }
  }
}

void openGates() {
  gateServo1.write(180); // Adjust angles based on mechanical setup
  gateServo2.write(180);
  gateOpen = true;
  Serial.println("Gates OPENED");
}

void closeGates() {
  gateServo1.write(0);
  gateServo2.write(0);
  gateOpen = false;
  Serial.println("Gates CLOSED");
}
