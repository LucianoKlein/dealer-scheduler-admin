import React, { useState, useEffect } from 'react';
import {
  Select, Button, InputNumber, message, Switch, Card, Tag, Table, Empty, Modal, Alert,
} from 'antd';
import {
  SaveOutlined, SettingOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  TeamOutlined, TrophyOutlined, ThunderboltOutlined,
  DownloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { WeeklyProjection, DailyProjection, TimeSlot, GameEvent } from '../types';
import { projectionApi } from '../api/projection';
import { scheduleApi } from '../api/schedule';
import { timeOffApi } from '../api/timeOff';
import gameData from '../assets/game.json';

dayjs.extend(customParseFormat);

const YEAR = 2026;

// Parse game.json dates into YYYY-MM-DD keyed map
const gameEventsByDate: Record<string, GameEvent[]> = {};
(gameData as GameEvent[]).forEach(evt => {
  const parsed = dayjs(`${evt.date} ${YEAR}`, 'MMM DD hh:mm A YYYY');
  if (!parsed.isValid()) return;
  const key = parsed.format('YYYY-MM-DD');
  if (!gameEventsByDate[key]) gameEventsByDate[key] = [];
  gameEventsByDate[key].push(evt);
});

const Projection: React.FC = () => {
  const { weekStart, weekStartStr } = useWeek();
  const navigate = useNavigate();
  const [projection, setProjection] = useState<WeeklyProjection>({ weekStart: '', days: [] });
  const [hideUnedited, setHideUnedited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastResult, setLastResult] = useState<{ totalAssignments: number; unfilledSlots: number; solverStatus: string; solveTimeMs: number } | null>(null);

  useEffect(() => {
    const loadProjection = async () => {
      try {
        const res = await projectionApi.get(weekStartStr);
        setProjection(res.data);
      } catch {
        // No projection yet, init empty
        const days: DailyProjection[] = [];
        for (let i = 0; i < 7; i++) {
          days.push({ date: weekStart.add(i, 'day').format('YYYY-MM-DD'), slots: [] });
        }
        setProjection({ weekStart: weekStartStr, days });
      }
    };
    loadProjection();
    setGenerated(false);
    setLastResult(null);
  }, [weekStartStr]);

  const addSlot = (dayIndex: number) => {
    setProjection(prev => {
      const days = [...prev.days];
      const slots = [...days[dayIndex].slots, { time: '12 PM', dealersNeeded: 0 }];
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setProjection(prev => {
      const days = [...prev.days];
      const slots = days[dayIndex].slots.filter((_, i) => i !== slotIndex);
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: keyof TimeSlot, value: any) => {
    if (value === null) return;
    setProjection(prev => {
      const days = [...prev.days];
      const slots = [...days[dayIndex].slots];
      slots[slotIndex] = { ...slots[slotIndex], [field]: value };
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const handleSave = async () => {
    try {
      await projectionApi.save(weekStartStr, { days: projection.days });
      setEditing(false);
      message.success('Projection saved');
    } catch {
      message.error('Failed to save projection');
    }
  };

  // Totals
  const totalDealers = projection.days.reduce((s, d) => s + d.slots.reduce((ss, sl) => ss + sl.dealersNeeded, 0), 0);
  const avgDealersPerDay = (totalDealers / 7).toFixed(1);

  // Pending time-off count
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  useEffect(() => {
    timeOffApi.list({ week_start: weekStartStr, status: 'pending' }).then(res => {
      setPendingTimeOffCount((res.data as any[]).length);
    }).catch(() => {});
  }, [weekStartStr]);

  const [resultModalOpen, setResultModalOpen] = useState(false);

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      const res = await scheduleApi.generate({ weekStart: weekStartStr, dealerType: 'tournament' });
      setLastResult(res.data);
      setConfirmOpen(false);
      setGenerated(true);
      setResultModalOpen(true);
    } catch {
      message.error('Failed to generate schedule');
    } finally {
      setGenerating(false);
    }
  };

  const exportExcel = async () => {
    setDownloading(true);
    try {
      const res = await scheduleApi.downloadExcel(weekStartStr, 'tournament');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_tournament_${weekStartStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to download Excel');
    } finally {
      setDownloading(false);
    }
  };

  // Filter days: hideUnedited only hides the events section, all days remain visible
  const visibleDays = projection.days;

  // Event table columns for expanded rows
  const eventColumns = [
    {
      title: 'Event #',
      dataIndex: 'eventNum',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Time',
      dataIndex: 'date',
      width: 140,
      render: (v: string) => {
        const m = v.match(/\d{1,2}:\d{2}\s*[AP]M/i);
        return m ? m[0] : v;
      },
    },
    {
      title: 'Title',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: 'Buy-in',
      dataIndex: 'buyIn',
      width: 100,
      render: (v: string) => <span style={{ color: '#389e0d', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Clock',
      dataIndex: 'clock',
      width: 80,
    },
    {
      title: 'Late Reg',
      dataIndex: 'lateReg',
      width: 100,
    },
    {
      title: 'Format',
      dataIndex: 'format',
      width: 200,
      ellipsis: true,
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <WeekPicker />

        <div style={{ flex: 1 }} />

        <SettingOutlined style={{ fontSize: 14, color: '#999' }} />
        <Switch
          checked={hideUnedited}
          onChange={setHideUnedited}
          checkedChildren="Hide unedited"
          unCheckedChildren="Hide unedited"
          style={{ minWidth: 140 }}
        />

        {editing ? (
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Save Projection
          </Button>
        ) : (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => setConfirmOpen(true)}
        >
          Generate Schedule
        </Button>
        {generated && (
          <Button icon={<DownloadOutlined />} loading={downloading} onClick={exportExcel}>
            {downloading ? 'Generating...' : 'Download Excel'}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Avg Dealers / Day</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{avgDealersPerDay}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Events (Total)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>
                {projection.days.reduce((s, d) => s + (gameEventsByDate[d.date]?.length || 0), 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleDays.length === 0 && (
          <Card><Empty description="No events" /></Card>
        )}
        {visibleDays.map((day) => {
          const realIndex = projection.days.findIndex(d => d.date === day.date);
          const events = gameEventsByDate[day.date] || [];
          const dateObj = dayjs(day.date);
          const isWeekend = dateObj.day() === 0 || dateObj.day() === 6;

          return (
            <Card
              key={day.date}
              size="small"
              style={{
                borderRadius: 8,
                border: isWeekend ? '1px solid #d9d9d9' : '1px solid #e8e8e8',
                background: isWeekend ? '#fafafa' : '#fff',
              }}
            >
              {/* Day header row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: (day.slots.length > 0 || events.length > 0) ? 12 : 0,
              }}>
                {/* Date badge */}
                <div style={{ minWidth: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: isWeekend ? '#fff7e6' : '#e6f4ff',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>
                    <span style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>
                      {dateObj.format('ddd').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: isWeekend ? '#fa8c16' : '#1677ff' }}>
                      {dateObj.format('DD')}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: '#666' }}>{dateObj.format('MM/DD')}</span>
                </div>

                {/* Day totals */}
                <Tag color="green">
                  Dealers Needed: {day.slots.reduce((s, sl) => s + sl.dealersNeeded, 0)}
                </Tag>

                <div style={{ flex: 1 }} />
                {events.length > 0 && (
                  <Tag icon={<TrophyOutlined />} color="gold">
                    {events.length} {events.length === 1 ? 'event' : 'events'}
                  </Tag>
                )}
                {editing && (
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => addSlot(realIndex)}
                  >
                    Add Time Slot
                  </Button>
                )}
              </div>

              {/* Time slots table */}
              {day.slots.length > 0 && (
                <div style={{ marginBottom: events.length > 0 ? 12 : 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                        <th style={{ padding: '6px 12px', width: 140, borderBottom: '1px solid #f0f0f0' }}>Time</th>
                        <th style={{ padding: '6px 12px', width: 160, borderBottom: '1px solid #f0f0f0' }}>Dealers Needed</th>
                        {editing && <th style={{ padding: '6px 12px', width: 60, borderBottom: '1px solid #f0f0f0' }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {day.slots.map((slot, si) => (
                        <tr key={si} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 12px' }}>
                            {editing ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <Select
                                  value={slot.time.match(/^(\d{1,2})/)?.[1] || '12'}
                                  size="small"
                                  style={{ width: 65 }}
                                  onChange={v => {
                                    const ampm = slot.time.match(/(AM|PM)$/i)?.[1] || 'PM';
                                    updateSlot(realIndex, si, 'time', `${v} ${ampm}`);
                                  }}
                                  options={Array.from({ length: 12 }, (_, i) => {
                                    const h = i === 0 ? 12 : i;
                                    return { label: `${h}`, value: `${h}` };
                                  })}
                                />
                                <Select
                                  value={slot.time.match(/(AM|PM)$/i)?.[1]?.toUpperCase() || 'PM'}
                                  size="small"
                                  style={{ width: 65 }}
                                  onChange={v => {
                                    const hour = slot.time.match(/^(\d{1,2})/)?.[1] || '12';
                                    updateSlot(realIndex, si, 'time', `${hour} ${v}`);
                                  }}
                                  options={[
                                    { label: 'AM', value: 'AM' },
                                    { label: 'PM', value: 'PM' },
                                  ]}
                                />
                              </div>
                            ) : (
                              <span style={{ fontWeight: 500 }}>{slot.time}</span>
                            )}
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            {editing ? (
                              <InputNumber min={0} value={slot.dealersNeeded} size="small" style={{ width: 80 }}
                                onChange={v => updateSlot(realIndex, si, 'dealersNeeded', v)} />
                            ) : (
                              <span style={{ color: '#52c41a', fontWeight: 600 }}>{slot.dealersNeeded}</span>
                            )}
                          </td>
                          {editing && (
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <Button type="link" danger size="small" icon={<DeleteOutlined />}
                                onClick={() => removeSlot(realIndex, si)} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Events table */}
              {events.length > 0 && !hideUnedited && (
                <Table
                  columns={eventColumns}
                  dataSource={events}
                  rowKey={(_, i) => String(i)}
                  size="small"
                  pagination={false}
                  style={{
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                />
              )}
            </Card>
          );
        })}
      </div>

      {/* Generate Schedule Confirmation Modal */}
      <Modal
        title="Generate Schedule Confirmation"
        open={confirmOpen}
        onCancel={() => { if (!generating) setConfirmOpen(false); }}
        onOk={generateSchedule}
        okText={generating ? 'Generating...' : 'Confirm & Generate'}
        okButtonProps={{ loading: generating }}
        cancelButtonProps={{ disabled: generating }}
        closable={!generating}
        maskClosable={!generating}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Projection Summary</h4>
          <Table
            size="small"
            pagination={false}
            dataSource={projection.days.filter(d => d.slots.length > 0)}
            rowKey="date"
            columns={[
              { title: 'Date', dataIndex: 'date', width: 120, render: (v: string) => dayjs(v).format('ddd MM/DD') },
              { title: 'Slots', width: 80, render: (_: any, d: DailyProjection) => d.slots.length },
              { title: 'Dealers Needed', render: (_: any, d: DailyProjection) => d.slots.reduce((s, sl) => s + sl.dealersNeeded, 0) },
            ]}
          />
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
            Total: {totalDealers} dealers needed (avg {avgDealersPerDay}/day)
          </div>
        </div>

        {pendingTimeOffCount > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message={`${pendingTimeOffCount} pending time-off requests this week`}
            description={
              <span>
                Please review and approve/reject them before generating.{' '}
                <a onClick={() => { setConfirmOpen(false); navigate('/requests'); }}>
                  Go to Requests
                </a>
              </span>
            }
          />
        )}
      </Modal>

      {/* Generate Result Modal */}
      <Modal
        title="Schedule Generated Successfully"
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} loading={downloading} onClick={exportExcel}>
            {downloading ? 'Generating...' : 'Download Excel'}
          </Button>,
          <Button key="view" type="primary" onClick={() => { setResultModalOpen(false); navigate('/schedule'); }}>
            View Schedule
          </Button>,
        ]}
        width={480}
      >
        {lastResult && (
          <div style={{ padding: '8px 0' }}>
            <Alert
              type="success"
              showIcon
              message="Schedule has been generated successfully."
              description="You can download the Excel file or navigate to the Schedule page to review and publish."
              style={{ marginBottom: 16 }}
            />
            {lastResult.unfilledSlots > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`${lastResult.unfilledSlots} unfilled slot(s) remain`}
                description="Some shifts could not be fully staffed. Please review the schedule and adjust manually if needed."
                style={{ marginBottom: 16 }}
              />
            )}
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>Total Assignments</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{lastResult.totalAssignments}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>Solver Status</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: lastResult.solverStatus === 'OPTIMAL' ? '#52c41a' : '#faad14' }}>
                  {lastResult.solverStatus}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              Solved in {lastResult.solveTimeMs}ms.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Projection;
