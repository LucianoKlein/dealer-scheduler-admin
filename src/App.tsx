import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { WeekProvider } from './contexts/WeekContext';
import { ScheduleProvider } from './contexts/ScheduleContext';
import MainLayout from './layouts/MainLayout';
import DealerList from './pages/DealerList';
import TimeOff from './pages/TimeOff';
import Projection from './pages/Projection';
import Schedule from './pages/Schedule';
import Review from './pages/Review';
import Requests from './pages/Requests';
import MySchedule from './pages/MySchedule';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('adminToken'));

  if (!authed) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
        <Login onSuccess={() => setAuthed(true)} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <WeekProvider>
      <ScheduleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/my-schedule/:dealerId" element={<MySchedule />} />
          <Route element={<MainLayout onLogout={() => { localStorage.removeItem('adminToken'); setAuthed(false); }} />}>
            <Route path="/" element={<Navigate to="/dealers" replace />} />
            <Route path="/dealers" element={<DealerList />} />
            <Route path="/time-off" element={<TimeOff />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/review" element={<Review />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ScheduleProvider>
      </WeekProvider>
    </ConfigProvider>
  );
}

export default App;
