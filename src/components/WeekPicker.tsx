import React from 'react';
import { DatePicker, Tag } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWeek } from '../contexts/WeekContext';

const WeekPicker: React.FC = () => {
  const { weekStart, setWeekStart, weekLabel } = useWeek();

  const dateRender = (current: dayjs.Dayjs | string | number) => {
    if (typeof current === 'string' || typeof current === 'number') return <div>{current}</div>;
    const fri = weekStart;
    const thu = fri.add(6, 'day');
    const isInWeek = !current.isBefore(fri, 'day') && !current.isAfter(thu, 'day');
    return (
      <div className="ant-picker-cell-inner" style={isInWeek ? { background: '#e6f4ff', borderRadius: 4 } : undefined}>
        {current.date()}
      </div>
    );
  };

  return (
    <>
      <CalendarOutlined style={{ fontSize: 16, color: '#1677ff' }} />
      <span style={{ fontWeight: 500 }}>Week of:</span>
      <DatePicker
        value={weekStart}
        onChange={(date) => { if (date) setWeekStart(date); }}
        style={{ width: 200 }}
        cellRender={dateRender}
      />
      <Tag color="geekblue" style={{ fontSize: 13, padding: '2px 10px' }}>
        {`Week ${weekLabel.week} of ${weekLabel.month}`} ({weekLabel.range})
      </Tag>
    </>
  );
};

export default WeekPicker;
