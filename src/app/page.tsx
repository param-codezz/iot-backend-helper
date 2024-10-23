"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowDownToLine } from "lucide-react";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import emailjs from "emailjs-com";

export default function Home() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ip, setIp] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [isSecondDialogOpen, setIsSecondDialogOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [ipError, setIpError] = useState("");
  const [ssidError, setSsidError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [alphanumericKey, setAlphanumericKey] = useState("");

  const sendEmail = (email: String, name: String, alphanumericKey: String) => {
    const templateParams = {
      name: name,
      email: email,
      message: `Dear ${name},\nThank you for joining the My Home system! This is your My Home ESP ID: ${alphanumericKey}\nRegards,\nMy Home Team`,
    };
  
    emailjs
      .send(
        "service_54tt0rs",
        "template_4q6g4e8",
        templateParams,
        "8-fk6ufCcaAaMncDP"
      )
      .then((response) => {
        console.log("Email sent successfully:", response.status, response.text);
      })
      .catch((error) => {
        console.error("Error sending email:", error);
      });
  };

  // Function to trigger the download of the .ino file
  const downloadInoFile = () => {
    const inoContent = `
    #include <WiFi.h>
    #include <WebSocketsClient.h>
    #include <ArduinoJson.h>
    #include <Adafruit_MPU6050.h>
    #include <Adafruit_Sensor.h>

    // WiFi credentials
    const char* ssid = "${ssid}";
    const char* password = "${password}";

    // WebSocket client object
    WebSocketsClient webSocket;

    // WebSocket server address and port
    const char* serverHost = "${ip}";
    const uint16_t serverPort = 8080;

    const char* device = "esp32";
    const char* secret = "esp32secret";
    const char* id = "${alphanumericKey}";
    const char* sensors = "PIR,Accelerometer";

    const int pirSensorPins[] = { 4, 14 };
    const int numSensors = sizeof(pirSensorPins) / sizeof(pirSensorPins[0]);

    unsigned long lastSentTime = 0;
    const unsigned long sendInterval = 60000;
    bool activityDetected = false;


    Adafruit_MPU6050 mpu;

    void connectToWiFi() {
      WiFi.begin(ssid, password);
      Serial.println("Connecting to WiFi...");
      while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
      }
      Serial.println("\nWiFi connected!");
    }

    void initializeSensors() {
      for (int i = 0; i < numSensors; i++) {
        pinMode(pirSensorPins[i], INPUT_PULLUP);
      }
    }

    void initializeMPU6050() {
      if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip");
      }
      Serial.println("MPU6050 Found!");

      // Configure the MPU6050 sensor
      mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
      mpu.setGyroRange(MPU6050_RANGE_250_DEG);
      mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    void initializeWebSocket() {
      webSocket.begin(serverHost, serverPort, "/");
      webSocket.onEvent(webSocketEvent);
      webSocket.setReconnectInterval(500);
    }

    void readAndSendSensorData() {
      // JSON document to store the data
      JsonDocument doc;
      doc["user"] = device;
      doc["esp_UID"] = id;
      doc["secret"] = secret;
      doc["event"] = "sensor_data";

      // Read PIR sensor states
      JsonObject data = doc["data"].to<JsonObject>();
      for (int i = 0; i < numSensors; i++) {
        int sensorState = pirSensorTriggered(pirSensorPins[i]);
        data[String("PIR_A_") + String(i)] = sensorState;
      }

      // Read MPU6050 data
      sensors_event_t accel, gyro, temp;
      mpu.getEvent(&accel, &gyro, &temp);

      JsonObject accData = data["accelerometer"].to<JsonObject>();

      accData["x"] = accel.acceleration.x;
      accData["y"] = accel.acceleration.y;
      accData["z"] = accel.acceleration.z;

      JsonObject gyroData = data["gyro"].to<JsonObject>();
      gyroData["x"] = gyro.gyro.x;
      gyroData["y"] = gyro.gyro.y;
      gyroData["z"] = gyro.gyro.z;

      data["temperature"] = temp.temperature;

      String output;

      doc.shrinkToFit();

      serializeJson(doc, output);

      webSocket.sendTXT(output);

      if (accel.acceleration.x == 0 && accel.acceleration.y == 0 && accel.acceleration.z == 0 && gyro.gyro.x == 0 && gyro.gyro.y == 0 && gyro.gyro.z == 0) {

        // Reinitialize MPU6050
        Serial.println("Zero readings detected, reinitializing MPU6050...");
        mpu.begin();
      }

      if (accel.acceleration.y > 0.15 || accel.acceleration.y < -0.15 || pirSensorTriggered(pirSensorPins[0]) || pirSensorTriggered(pirSensorPins[1])) {
        StaticJsonDocument<128> alertDoc;
        JsonArray arr = alertDoc.createNestedArray();
        if (accel.acceleration.y > 0.15 || accel.acceleration.y < -0.15) {
          arr.add("Door");
        }
        if (pirSensorTriggered(pirSensorPins[0])) {
          arr.add("PIR_A_0");
        }
        if (pirSensorTriggered(pirSensorPins[1])) {
          arr.add("PIR_A_1");
        }

        sendAlert(arr);
      }

      // Serialize JSON to string


      delay(100); 

    bool pirSensorTriggered(int pin) {
      int currentState = digitalRead(pin);
      delay(100);
      int newState = digitalRead(pin);
      return currentState == LOW && newState == LOW;
    }

    void sendAlert(JsonArray arr) {
      JsonDocument doc;

      doc["user"] = device;
      doc["esp_UID"] = id;
      doc["secret"] = secret;
      doc["event"] = "alert";

      JsonObject data = doc["data"].to<JsonObject>();
      JsonArray data_alert = data["alert_sensor"].to<JsonArray>();
      for (JsonVariant value : arr) {
        data_alert.add(value);
      }
      String output;
      Serial.println("alert!!");

      serializeJson(doc, output);
      webSocket.sendTXT(output);
    }

    void handshakeServer() {
      String json;
      JsonDocument doc;
      doc["user"] = device;
      doc["esp_UID"] = id;
      doc["secret"] = secret;
      doc["event"] = "initialise";

      doc.shrinkToFit();

      serializeJson(doc, json);

      webSocket.sendTXT(json);
    }

    // Callback function to handle WebSocket events
    void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
      switch (type) {
        case WStype_DISCONNECTED:
          Serial.println("Disconnected from WebSocket server");
          break;
        case WStype_CONNECTED:
          Serial.println("Connected to WebSocket server");
          handshakeServer();
          break;
        case WStype_TEXT:
          Serial.printf("Received text: %s\n", payload);
          handleCommand(payload, length);
          break;
        case WStype_BIN:
          Serial.println("Received binary data");
          break;
        default:
          break;
      }
    }

    void handleCommand(uint8_t* payload, size_t length) {
      String command = String((char*)payload).substring(0, length);
      Serial.printf("Command received: %s\n", command.c_str());
    }

    bool checkForActivity() {
      // Read sensor values (e.g., accelerometer and PIR sensors)
      int pir1State = digitalRead(pirSensorPins[0]);
      int pir2State = digitalRead(pirSensorPins[1]);

      sensors_event_t accel, gyro, temp;
      mpu.getEvent(&accel, &gyro, &temp);

      // Define thresholds for detecting activity
      bool doorMoved = (accel.acceleration.y > 0.15 || accel.acceleration.y < -0.15);
      bool motionDetected = (pir1State == HIGH || pir2State == HIGH);

      // Return true if any activity is detected
      return (doorMoved || motionDetected);
    }

    void setup() {
      // Initialize serial monitor
      Serial.begin(115200);

      connectToWiFi();
      initializeWebSocket();
      initializeMPU6050();
      initializeSensors();
    }

    void loop() {
      // Keep the WebSocket connection alive
      webSocket.loop();

      // Get the current time
      readAndSendSensorData();
    }
    `;
    const blob = new Blob([inoContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sketch.ino"; // The name of the downloaded file
    toast({
      title: "Downloading the file",
      description:
        "Downloading sketch.ino, load the file in the ESP32 after installing required modules",
    });
    a.click();
    // sendMail(
    //   email,
    //   "Welcome to My Home",
    //   `
    //   Dear ${name},\nThank you for joining the My Home system! We are excited to have you on board and look forward to helping you create a comfortable and efficient living environment. Keep an eye on your home from anywhere with real-time alerts and updates.\n\nThis is your My Home ESP ID:${alphanumericKey}\nThank you once again for choosing My Home. We're thrilled to have you with us!\nRegards,\nMy Home Team`
    // );
    sendEmail(email, name, alphanumericKey);
    URL.revokeObjectURL(url); // Clean up the URL object
  };

  const generateAlphanumericKey = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";

    // Generate 16 random characters
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Format the key as xxxx-xxxx-xxxx-xxxx
    const formattedKey = key.match(/.{1,4}/g).join("-"); // Splits the key into groups of four

    console.log(formattedKey);
    setAlphanumericKey(formattedKey); // Update your state with the formatted key
  };

  const handleDialogClick = () => {
    let hasError = false;

    // Reset errors before validating
    setNameError("");
    setEmailError("");

    if (!name) {
      setNameError("Please enter name");
      hasError = true;
    }
    if (!email) {
      setEmailError("Please enter email");
      hasError = true;
    }
    if (!ssid) {
      setSsidError("Please enter SSID");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Please enter password");
      hasError = true;
    }
    if (!hasError) {
      setIsSecondDialogOpen(true);
      generateAlphanumericKey();
    }
  };
  const handleDialogClose = (isOpen: boolean) => {
    setIsDialogOpen(isOpen);
    if (!isOpen) {
      setNameError("");
      setEmailError("");
      setSsidError("");
      setPasswordError("");
    }
  };

  return (
    <>
      <Toaster />
      <div className="m-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Welcome to My Home Security
        </h1>
        <p className="leading-7 [&:not(:first-child)]:mt-6">
          At My Home Security, we are dedicated to protecting what matters
          most—your home and family. Our innovative security solutions combine
          advanced technology with user-friendly features to offer comprehensive
          protection, ensuring peace of mind 24/7. From smart sensors and
          cameras to real-time alerts, we provide everything you need to monitor
          and safeguard your home, whether you're at home or away. Explore our
          range of customizable security systems designed to fit your unique
          needs and take the first step towards a safer, smarter home today.
        </p>
        <div className="mt-4">
          <Dialog onOpenChange={handleDialogClose} open={isDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                Register <ArrowRight />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register</DialogTitle>
                <DialogDescription>
                  Get started with My Home Safety
                </DialogDescription>
              </DialogHeader>
              <div className="gap-4 py-4">
                <div className="grid py-2">
                  <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label
                      htmlFor="name"
                      className={`text-right ${
                        nameError ? "text-red-500" : ""
                      }`}
                    >
                      Name
                    </Label>
                    <Input
                      autoComplete="off"
                      id="name"
                      placeholder="John Doe"
                      className="col-span-3 my-1"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    {nameError && (
                      <p className="col-start-2 col-span-2 text-red-500 text-sm">
                        {nameError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid py-2">
                  <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label
                      htmlFor="email"
                      className={`text-right ${
                        emailError ? "text-red-500" : ""
                      }`}
                    >
                      Email
                    </Label>
                    <Input
                      autoComplete="off"
                      id="email"
                      placeholder="someone@email.com"
                      className="col-span-3 my-1"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {emailError && (
                      <p className="col-start-2 col-span-2 text-red-500 text-sm">
                        {emailError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid py-2">
                  <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label
                      htmlFor="ip"
                      className={`text-right ${ipError ? "text-red-500" : ""}`}
                    >
                      Local IP
                    </Label>
                    <Input
                      autoComplete="off"
                      id="ip"
                      placeholder="192.168.125.175"
                      className="col-span-3 my-1"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                    />
                    {ipError && (
                      <p className="col-start-2 col-span-2 text-red-500 text-sm">
                        {ipError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid py-2">
                  <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label
                      htmlFor="ssid"
                      className={`text-right ${
                        ssidError ? "text-red-500" : ""
                      }`}
                    >
                      Wi-Fi SSID
                    </Label>
                    <Input
                      autoComplete="off"
                      id="ssid"
                      placeholder="ssid"
                      className="col-span-3 my-1"
                      value={ssid}
                      onChange={(e) => setSsid(e.target.value)}
                    />
                    {ssidError && (
                      <p className="col-start-2 col-span-2 text-red-500 text-sm">
                        {ssidError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid py-2">
                  <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label
                      htmlFor="password"
                      className={`text-right ${
                        passwordError ? "text-red-500" : ""
                      }`}
                    >
                      Wi-Fi Password
                    </Label>
                    <Input
                      autoComplete="off"
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="col-span-3 my-1"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {passwordError && (
                      <p className="col-start-2 col-span-2 text-red-500 text-sm">
                        {passwordError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Dialog
                  open={isSecondDialogOpen}
                  onOpenChange={setIsSecondDialogOpen}
                >
                  <Button onClick={handleDialogClick}>Continue</Button>
                  <DialogContent>
                    <DialogHeader>
                      <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                        Generated ESP UID
                      </h4>
                      <div>
                        {alphanumericKey &&
                          alphanumericKey.split("-").map((chunk, index) => (
                            <span key={index}>
                              <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                                {chunk}
                              </code>
                              {index < 3 ? "-" : ""}{" "}
                              {/* Add hyphen after each chunk except the last */}
                              {""}
                            </span>
                          ))}
                      </div>
                    </DialogHeader>
                    <DialogFooter>
                      <Button onClick={downloadInoFile}>
                        <ArrowDownToLine />
                        Download .ino file
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEmailError("");
                      setNameError("");
                    }}
                  >
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
