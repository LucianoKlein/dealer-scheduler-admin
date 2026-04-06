import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tag, Empty, Typography, Row, Col, Spin } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../api/client';

const { Title, Text } = Typography;

const MySchedule: React.FC = () => {
  const { dealerId } = useParams<{ dealerId: string }>();
  const [dealer, setDealer] = useState<{ firstName: string; lastName: string; type: string } | null>(null);
  const [entries, setEntries] = useState<{ date: string; shift: string }[]>([]);
  const [, setDaysOff] = useState<number[]>([]);
  const [timeOff, setTimeOff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState('');

  useEffect(() => {
    if (!dealerId) return;
    // Find next Friday
    let fri = dayjs();
    while (fri.day() !== 5) fri = fri.add(1, 'day');
    const ws = fri.format('YYYY-MM-DD');
    setWeekStart(ws);

    const load = async () => {
      setLoading(true);
      try {
        const dRes = await client.get(`/dealers/${dealerId}`);
        setDealer(dRes.data);
        const ee = dRes.data.eeNumber;
        if (ee) {
          const sRes = await client.get(`/dealers/ee/${ee}/schedule`, { params: { week_start: ws } });
          setEntries(sRes.data.entries || []);
          setDaysOff(sRes.data.daysOff || []);
          setTimeOff(sRes.data.timeOff || []);
        }
      } catch {
        setDealer(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dealerId]);

  const weekDates = weekStart ? Array.from({ length: 7 }, (_, i) => dayjs(weekStart).add(i, 'day')) : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Empty description="Dealer not found" />
          <Text type="secondary">Please check your dealer ID: {dealerId}</Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <CalendarOutlined style={{ marginRight: 8 }} />
            My Schedule
          </Title>
          <div style={{ marginTop: 12 }}>
            <Text strong>{dealer.firstName} {dealer.lastName}</Text>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <Text type="secondary">{dealerId}</Text>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <Tag color="blue">{dealer.type}</Tag>
          </div>
        </Card>

        <Card title={`Week of ${weekStart}`}>
          {entries.length === 0 ? (
            <Empty description="No schedule published yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Row gutter={[12, 12]}>
              {weekDates.map(date => {
                const dateStr = date.format('YYYY-MM-DD');
                const entry = entries.find(e => e.date === dateStr);
                const isTimeOff = timeOff.includes(dateStr);
                return (
                  <Col key={dateStr} span={24}>
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px',
                      borderRadius: 8,
                      background: isTimeOff ? '#fff1f0' : entry ? '#e6f7ff' : '#fff',
                      border: `1px solid ${isTimeOff ? '#ffa39e' : entry ? '#91d5ff' : '#f0f0f0'}`,
                    }}>
                      <div style={{ width: 80 }}>
                        <div style={{ fontWeight: 600 }}>{date.format('ddd')}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{date.format('MM/DD')}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        {isTimeOff ? (
                          <Tag color="red" style={{ fontSize: 14, padding: '4px 16px' }}>Time Off</Tag>
                        ) : entry ? (
                          <Tag color="blue" style={{ fontSize: 14, padding: '4px 16px' }}>{entry.shift}</Tag>
                        ) : (
                          <Text type="secondary">OFF</Text>
                        )}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>WSOP Dealer Scheduler</Text>
        </div>
      </div>
    </div>
  );
};

export default MySchedule;
