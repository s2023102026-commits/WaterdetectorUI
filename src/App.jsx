import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, 
  MessageSquare, 
  Settings, 
  ChevronLeft, 
  Play, 
  Activity,
  Cpu,
  Wifi,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import './App.css';

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID_LEVEL = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CHARACTERISTIC_UUID_THRESH = "a81b6766-381c-43f9-ba2a-302a2cdbe150";
const CHARACTERISTIC_UUID_TEST = "c4a45f94-9686-4e5a-9b48-18546b430c5e";

const MAX_SENSOR_HEIGHT = 45.72;

function App() {
  const [device, setDevice] = useState(null);
  const [levelCharacteristic, setLevelCharacteristic] = useState(null);
  const [threshCharacteristic, setThreshCharacteristic] = useState(null);
  const [testCharacteristic, setTestCharacteristic] = useState(null);
  
  const [connected, setConnected] = useState(false);
  const [waterLevel, setWaterLevel] = useState(0.0);
  const [maxThreshold, setMaxThreshold] = useState(20.00);
  const [gateOpen, setGateOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testAngle, setTestAngle] = useState(0);
  
  const [activeTab, setActiveTab] = useState('overview');

  const getAlertStatus = (level) => {
    if (level >= 20.0) return { text: 'CRITICAL OVERFLOW', sub: 'Red Alert', color: '#E74C3C', animation: 'blink-fast 0.4s infinite' };
    if (level >= 17.0) return { text: 'HIGH WATER', sub: 'Orange Alert', color: '#E67E22', animation: 'blink-fast 0.8s infinite' };
    if (level >= 15.0) return { text: 'ELEVATED LEVEL', sub: 'Yellow Alert', color: '#F1C40F', animation: 'blink-slow 1.5s infinite' };
    if (level >= 9.0) return { text: 'OPTIMAL LEVEL', sub: 'Safe Level', color: '#2E8B57', animation: 'none' };
    if (level >= 7.0) return { text: 'LOW WATER', sub: 'Yellow Alert', color: '#F1C40F', animation: 'blink-slow 1.5s infinite' };
    if (level >= 3.0) return { text: 'SEVERE DEPLETION', sub: 'Orange Alert', color: '#E67E22', animation: 'blink-fast 0.8s infinite' };
    return { text: 'DROUGHT CRITICAL', sub: 'Red Alert', color: '#E74C3C', animation: 'blink-fast 0.4s infinite' };
  };

  const getLevelColor = (level) => {
    return getAlertStatus(level).color;
  };

  // Real-time History tracking
  const [history, setHistory] = useState([
    { label: '-25s', value: 0 },
    { label: '-20s', value: 0 },
    { label: '-15s', value: 0 },
    { label: '-10s', value: 0 },
    { label: '-5s',  value: 0 },
    { label: 'NOW',  value: 0 },
  ]);

  // Reports / Logs
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), message: 'System initialized and ready', type: 'info' }
  ]);

  const addLog = (message, type) => {
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), message, type },
      ...prev
    ]);
  };

  // Push real data to history chart every 5 seconds
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setHistory(prev => {
        const newHistory = [...prev.slice(1), { label: 'NOW', value: waterLevel }];
        // Rename labels
        return newHistory.map((h, i) => {
          if (i === 5) return { ...h, label: 'NOW' };
          return { ...h, label: `-${(5 - i) * 5}s` };
        });
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [waterLevel, connected]);

  // Request notifications
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const lastAlertRef = useRef('OPTIMAL LEVEL');

  // Gate logic & Report Logging
  useEffect(() => {
    if (isTesting) return; // Skip auto logic if testing
    
    // Status Tracker for Logs
    const currentStatusObj = getAlertStatus(waterLevel);
    const currentStatus = currentStatusObj.text;

    if (currentStatus !== lastAlertRef.current && currentStatus !== 'OPTIMAL LEVEL') {
       addLog(`Condition changed: ${currentStatus} at ${waterLevel.toFixed(1)} cm.`, 'alert');
       
       if ((currentStatus === 'CRITICAL OVERFLOW' || currentStatus === 'DROUGHT CRITICAL') && "Notification" in window && Notification.permission === "granted") {
         new Notification(`EMERGENCY: ${currentStatus}`, { body: `Dam water level has reached ${waterLevel.toFixed(1)} cm!` });
       }
       lastAlertRef.current = currentStatus;
    } else if (currentStatus === 'OPTIMAL LEVEL' && lastAlertRef.current !== 'OPTIMAL LEVEL') {
       addLog(`Water level normalized to OPTIMAL (${waterLevel.toFixed(1)} cm).`, 'safe');
       lastAlertRef.current = currentStatus;
    }

    // Gate Automation Logic
    if (waterLevel >= 20.0 && !gateOpen) {
      setGateOpen(true);
      addLog(`OVERFLOW RISK: Motors automatically OPENING spillway gates.`, 'alert');
    } else if (waterLevel < 18.0 && gateOpen) {
      setGateOpen(false);
      addLog(`SAFE: Level receded below 18cm. Motors CLOSING spillway gates.`, 'safe');
    }
  }, [waterLevel, gateOpen, isTesting]);

  const handleLevelChange = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const levelStr = decoder.decode(value);
    const level = parseFloat(levelStr);
    if (!isNaN(level)) {
      setWaterLevel(level);
    }
  };

  const connectBluetooth = async () => {
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }]
      });

      dev.addEventListener('gattserverdisconnected', () => {
        setConnected(false);
        setDevice(null);
        setLevelCharacteristic(null);
        setThreshCharacteristic(null);
        addLog('Bluetooth disconnected', 'alert');
      });

      const server = await dev.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      const levelChar = await service.getCharacteristic(CHARACTERISTIC_UUID_LEVEL);
      await levelChar.startNotifications();
      levelChar.addEventListener('characteristicvaluechanged', handleLevelChange);
      
      const threshChar = await service.getCharacteristic(CHARACTERISTIC_UUID_THRESH);
      
      const threshValue = await threshChar.readValue();
      const decoder = new TextDecoder('utf-8');
      const threshStr = decoder.decode(threshValue);
      const thresh = parseFloat(threshStr);
      if (!isNaN(thresh)) {
        setMaxThreshold(thresh);
      }

      const testChar = await service.getCharacteristic(CHARACTERISTIC_UUID_TEST);

      setDevice(dev);
      setLevelCharacteristic(levelChar);
      setThreshCharacteristic(threshChar);
      setTestCharacteristic(testChar);
      setConnected(true);
      
      addLog('Connected to ESP32 via Web Bluetooth successfully', 'info');

    } catch (error) {
      console.error("Bluetooth Connection Error: ", error);
      addLog('Failed to connect Bluetooth', 'alert');
    }
  };

  const disconnectBluetooth = () => {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
  };

  const handleToggleTestMode = async (e) => {
    if (!testCharacteristic) return;
    try {
      const newMode = e.target.checked;
      setIsTesting(newMode);
      
      const encoder = new TextEncoder();
      if (!newMode) {
        await testCharacteristic.writeValue(encoder.encode("-1"));
        addLog('Manual Motor Test Ended. Returned to Auto Mode.', 'info');
        setGateOpen(waterLevel >= maxThreshold);
      } else {
        await testCharacteristic.writeValue(encoder.encode(testAngle.toString()));
        addLog(`Manual Motor Test Started at ${testAngle}°`, 'info');
        setGateOpen(testAngle > 0);
      }
    } catch (err) {
      console.error(err);
      addLog('Failed to toggle test mode', 'alert');
    }
  };

  const handleTestAngleChange = (e) => {
    const val = parseInt(e.target.value);
    setTestAngle(val);
  };

  const handleTestAngleCommit = async (e) => {
    const val = parseInt(e.target.value);
    if (isTesting && testCharacteristic) {
      try {
        const encoder = new TextEncoder();
        await testCharacteristic.writeValue(encoder.encode(val.toString()));
        setGateOpen(val > 0);
      } catch (err) {
        console.error("BLE Write Error: ", err);
      }
    }
  };

  const handleThresholdChange = (e) => {
    const val = parseFloat(e.target.value);
    setMaxThreshold(val);
  };

  const handleThresholdCommit = async (e) => {
    const val = parseFloat(e.target.value);
    if (threshCharacteristic) {
      try {
        const encoder = new TextEncoder();
        await threshCharacteristic.writeValue(encoder.encode(val.toString()));
        addLog(`Threshold changed to ${val.toFixed(2)} cm`, 'info');
      } catch (err) {
        console.error("BLE Write Error: ", err);
      }
    }
  };

  const getGaugeRotation = () => {
    if (isTesting) {
      return (testAngle / 180) * 180 - 45;
    }
    return gateOpen ? 135 : -45;
  };

  return (
    <div className="app-wrapper">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="logo-container">
          <div className="logo-dots">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '4px' }}>DamOps</span>
        </div>

        <div className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <div className="nav-icon-wrap"><Star size={20} /></div>
            OVERVIEW
          </button>
          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <div className="nav-icon-wrap"><MessageSquare size={20} /></div>
            REPORTS
          </button>
          <button className="nav-item">
            <div className="nav-icon-wrap"><Settings size={20} /></div>
            SETTINGS
          </button>
        </div>

        <div style={{ marginTop: 'auto' }}>
           {/* Removed user profile image as requested */}
        </div>
      </nav>

      {/* Main Area */}
      <main className="main-area">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-left">
            <button className="back-btn"><ChevronLeft size={16} /></button>
            <span>Back</span>
          </div>
          
          <div className="top-center">
            <span className="top-nav-item active">DASHBOARD</span>
            {/* Removed INSIGHTS and CHANNELS */}
          </div>
          
          <div className="top-right">
            {/* Removed the avatars */}
            <button 
              className={`connect-status-btn ${connected ? 'connected' : ''}`}
              onClick={connected ? disconnectBluetooth : connectBluetooth}
            >
              <Wifi size={16} />
              {connected ? 'ESP32 Connected' : 'Connect ESP32'}
            </button>
          </div>
        </header>

        {/* Inner Container */}
        <div className="inner-container">
          
          {activeTab === 'overview' && (
            <>
              {/* Top Cards */}
              <div className="top-cards">
                {/* Hero Card */}
                <div className="hero-card">
                  <div className="hero-title">Live Water Level</div>
                  <div className="hero-value" style={{ color: getLevelColor(waterLevel) }}>
                    {waterLevel.toFixed(1)}<span style={{ color: 'white' }}>cm</span>
                  </div>
                  
                  <div className="hero-stats">
                    <div className="hero-stat-item">
                      <div className="hero-stat-icon"><Star size={20} color="white" /></div>
                      <div className="hero-stat-info">
                        <div>Trigger Threshold</div>
                        <div>{maxThreshold.toFixed(1)} cm</div>
                      </div>
                    </div>
                    <div className="hero-stat-item">
                      <div className="hero-stat-icon"><Activity size={20} color="white" /></div>
                      <div className="hero-stat-info">
                        <div>Max Sensor Cap</div>
                        <div>45.72 cm</div>
                      </div>
                    </div>
                  </div>
                  
                  <button className="hero-btn" onClick={() => setActiveTab('reports')}>
                    VIEW FULL REPORTS <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>

                {/* Status Card */}
                <div className="status-card">
                  <div className="status-title">Spillway Gate Status</div>
                  <div className="status-row">
                    <div>
                      <div className="status-value" style={{ fontSize: gateOpen ? '3.5rem' : '4.5rem', marginTop: gateOpen ? '10px' : '0' }}>
                        {gateOpen ? 'OPENING' : 'SAFE'}
                      </div>
                      <div style={{ fontSize: '1rem', color: '#8A5B45', marginTop: '0.5rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.4)', display: 'inline-block', padding: '4px 12px', borderRadius: '8px' }}>
                        Angle Position: {isTesting ? `${testAngle}°` : (gateOpen ? '180°' : '0°')}
                      </div>
                    </div>
                    <div className="status-gauge">
                      <div className="gauge-arc" style={{ transform: `rotate(${getGaugeRotation()}deg)`, transition: 'transform 0.5s ease-out', borderTopColor: gateOpen ? 'var(--accent-red)' : 'var(--accent-orange)', borderRightColor: gateOpen ? 'var(--accent-red)' : 'var(--accent-orange)' }}></div>
                    </div>
                  </div>
                  
                  <div className="status-desc">
                    {gateOpen 
                      ? <strong>MOTORS RUNNING:</strong> 
                      : <strong>MOTORS IDLE:</strong>}
                    {gateOpen
                      ? (isTesting 
                          ? ` Servos are actively moving to ${testAngle} degrees due to manual test.` 
                          : " Servos are actively holding at 180 degrees due to emergency release.")
                      : " Servos are locked at 0 degrees. Water level is safe."}
                  </div>
                  
                  <div className="status-action" style={{ background: 'transparent', padding: '0', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.5)', padding: '10px 15px', borderRadius: '12px', width: '100%', gap: '20px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Manual Control</div>
                      <label className={`custom-toggle ${!connected ? 'disabled' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={isTesting} 
                          onChange={handleToggleTestMode} 
                          disabled={!connected} 
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    {isTesting && (
                      <div className="range-slider-wrap" style={{ position: 'relative', zIndex: 10, padding: '1rem', background: 'rgba(255,255,255,0.3)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Motor Angle Test</span>
                          <span>{testAngle}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="180" 
                          step="1" 
                          value={testAngle}
                          onChange={handleTestAngleChange}
                          onMouseUp={handleTestAngleCommit}
                          onTouchEnd={handleTestAngleCommit}
                          className="range-slider"
                          style={{ '--value': `${(testAngle/180)*100}%` }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span>0° (Closed)</span>
                          <span>180° (Open)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Cards */}
              <div className="bottom-cards">
                {/* History Chart */}
                <div className="chart-card">
                  <div className="bottom-card-title">Live Water Movements</div>
                  <div className="chart-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="chart-icon-box"><Activity size={20} /></div>
                      <div>
                        <div className="chart-value">{waterLevel.toFixed(1)}</div>
                        <div className="chart-subtitle">Current cm recorded</div>
                      </div>
                    </div>
                    
                    {/* Blinking Alert Status Indicator */}
                    <div style={{
                      padding: '0.5rem 1rem', 
                      borderRadius: '12px', 
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      border: `2px solid ${getLevelColor(waterLevel)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      animation: getAlertStatus(waterLevel).animation
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: getLevelColor(waterLevel), textTransform: 'uppercase' }}>
                        {getAlertStatus(waterLevel).text}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {getAlertStatus(waterLevel).sub}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bar-chart">
                    {history.map((item, idx) => (
                      <div className="bar-col" key={idx}>
                        <div className="bar" style={{ height: '80px' }}>
                          <div className="bar-fill" style={{ height: `${(item.value / MAX_SENSOR_HEIGHT) * 100}%`, backgroundColor: getLevelColor(item.value) }}></div>
                        </div>
                        <div className="bar-label">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Status List */}
                <div className="chart-card">
                  <div className="bottom-card-title">System Performers</div>
                  <div className="system-list">
                    <div className="system-item">
                      <div className="system-icon"><Cpu size={20} /></div>
                      <div className="system-info">
                        <div className="system-name">ESP32 & Web BLE</div>
                        <div className="system-status">
                          <div className={`status-dot ${connected ? 'active' : 'inactive'}`}></div>
                          {connected ? 'Transmitting Data' : 'Offline'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="system-item">
                      <div className="system-icon"><Activity size={20} /></div>
                      <div className="system-info">
                        <div className="system-name">Ultrasonic Sensor</div>
                        <div className="system-status">
                          <div className={`status-dot ${connected ? 'active' : 'inactive'}`}></div>
                          {connected ? 'Reading Live Data' : 'Standby'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="system-item">
                      <div className="system-icon"><Bell size={20} /></div>
                      <div className="system-info">
                        <div className="system-name">Servos & Buzzer</div>
                        <div className="system-status">
                          <div className={`status-dot ${gateOpen ? 'warning' : connected ? 'active' : 'inactive'}`}></div>
                          {gateOpen ? 'MOTORS RUNNING' : connected ? 'Idle / Ready' : 'Offline'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Threshold Control */}
                <div className="chart-card">
                  <div className="bottom-card-title">Targeting by threshold</div>
                  <div className="control-card-inner">
                    <div className="map-rings"></div>
                    
                    <div className="control-target-box">
                      <div className="target-icon"><AlertTriangle size={14} /></div>
                      <div>
                        <div className="target-value">Trigger Release At</div>
                        <div className="target-sub">{maxThreshold.toFixed(2)} cm</div>
                      </div>
                    </div>
                    
                    <div className="range-slider-wrap" style={{ position: 'relative', zIndex: 10 }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="45.72" 
                        step="0.01" 
                        value={maxThreshold}
                        onChange={handleThresholdChange}
                        onMouseUp={handleThresholdCommit}
                        onTouchEnd={handleThresholdCommit}
                        className="range-slider"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>0 cm</span>
                        <span>Max: 45.72 cm</span>
                      </div>
                    </div>
                    
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'reports' && (
            <div className="reports-container">
              <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>System Incident & Activity Reports</h2>
              {logs.map(log => (
                <div key={log.id} className="log-item">
                  <div className="log-time">{log.time}</div>
                  <div className={`log-icon ${log.type}`}>
                    {log.type === 'alert' && <AlertTriangle size={20} />}
                    {log.type === 'safe' && <CheckCircle2 size={20} />}
                    {log.type === 'info' && <Info size={20} />}
                  </div>
                  <div className="log-message">{log.message}</div>
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No recent activity logged.
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
