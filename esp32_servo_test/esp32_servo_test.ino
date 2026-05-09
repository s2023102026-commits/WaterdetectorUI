#include <ESP32Servo.h>

// Define the pins you are using for the servos
const int servo1Pin = 21;
const int servo2Pin = 22;

Servo gateServo1;
Servo gateServo2;

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Servo Motor Test...");

  // IMPORTANT: On ESP32, you must allocate timers for the servos. 
  // This solves many "buzzing but not moving" or jittering issues!
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Standard servos operate at 50Hz
  gateServo1.setPeriodHertz(50);
  gateServo2.setPeriodHertz(50);

  // Attach servos with specific minimum and maximum pulse widths.
  // 500 to 2400 microseconds is common for SG90 / MG996R servos.
  // If it still buzzes and doesn't move, try changing to 1000, 2000
  gateServo1.attach(servo1Pin, 500, 2400);
  gateServo2.attach(servo2Pin, 500, 2400);

  Serial.println("Servos attached. Moving to 0 degrees.");
  gateServo1.write(0);
  gateServo2.write(0);
  delay(2000); // Wait 2 seconds
}

void loop() {
  Serial.println("Jumping to exactly 0 degrees...");
  gateServo1.write(0);
  gateServo2.write(0);
  delay(3000); // Hold at 0 for 3 seconds
  
  Serial.println("Jumping to exactly 90 degrees...");
  gateServo1.write(90);
  gateServo2.write(90);
  delay(3000); // Hold at 90 for 3 seconds

  Serial.println("Jumping to exactly 180 degrees (Max Range)...");
  gateServo1.write(180);
  gateServo2.write(180);
  delay(3000); // Hold at 180 for 3 seconds
}
