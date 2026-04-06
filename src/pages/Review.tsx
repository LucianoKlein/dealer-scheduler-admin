import React, { useState } from 'react';
import { Table, Tag, Button, Popconfirm, message, Empty } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { mockSubmissions } from '../mock/data';
import { AvailabilitySubmission, SubmissionStatus } from '../types';

const statusColor: Record<SubmissionStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const Review: React.FC = () => {
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>(mockSubmissions);

  const handleAction = (id: string, status: SubmissionStatus) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    message.success(status === 'approved' ? 'Submission approved' : 'Submission rejected');
  };

  const columns: ColumnsType<AvailabilitySubmission> = [
    {
      title: 'Dealer', width: 180,
      render: (_, r) => `${r.dealerName} (${r.dealerId})`,
      sorter: (a, b) => a.dealerName.localeCompare(b.dealerName),
    },
    {
      title: 'Available Dates', dataIndex: 'dates',
      render: (dates: string[]) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {dates.map(d => <Tag key={d}>{dayjs(d).format('MM/DD ddd')}</Tag>)}
        </div>
      ),
    },
    {
      title: 'Submitted', dataIndex: 'submittedAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => a.submittedAt.localeCompare(b.submittedAt),
    },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (s: SubmissionStatus) => <Tag color={statusColor[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>,
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Approved', value: 'approved' },
        { text: 'Rejected', value: 'rejected' },
      ],
      onFilter: (value, record) => record.status === value,
      defaultFilteredValue: ['pending'],
    },
    {
      title: 'Actions', width: 140,
      render: (_, record) => {
        if (record.status !== 'pending') return null;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Popconfirm title="Approve this submission?" onConfirm={() => handleAction(record.id, 'approved')}>
              <Button type="primary" size="small" icon={<CheckOutlined />}>Approve</Button>
            </Popconfirm>
            <Popconfirm title="Reject this submission?" onConfirm={() => handleAction(record.id, 'rejected')}>
              <Button size="small" danger icon={<CloseOutlined />}>Reject</Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Availability Review</h3>
        <span style={{ color: '#888' }}>{submissions.length} submissions</span>
      </div>

      {submissions.length === 0 ? (
        <Empty description="No pending submissions" />
      ) : (
        <Table
          columns={columns}
          dataSource={submissions}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], showTotal: t => `${t} records` }}
        />
      )}
    </div>
  );
};

export default Review;
