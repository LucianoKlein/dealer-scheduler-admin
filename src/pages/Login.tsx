import React, { useState } from 'react';
import { Button, Input, Card, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import client from '../api/client';

const Login: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { message.warning('Please enter username and password'); return; }
    setLoading(true);
    try {
      const res = await client.post('/auth/admin/login', { username, password });
      localStorage.setItem('adminToken', res.data.token);
      onSuccess();
    } catch {
      message.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Dealer Scheduler Admin</h2>
        <Input prefix={<UserOutlined />} placeholder="Username" value={username}
          onChange={e => setUsername(e.target.value)} onPressEnter={handleLogin}
          style={{ marginBottom: 12 }} />
        <Input.Password prefix={<LockOutlined />} placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} onPressEnter={handleLogin}
          style={{ marginBottom: 20 }} />
        <Button type="primary" block loading={loading} onClick={handleLogin}>Login</Button>
      </Card>
    </div>
  );
};

export default Login;
