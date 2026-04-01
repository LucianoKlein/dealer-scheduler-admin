import React, { useState } from 'react';
import {
  Card, Button, Space, Modal, Form, Select, Input, Popconfirm, message, Empty, Row, Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { mockCarpoolGroups, mockDealers } from '../mock/data';
import { CarpoolGroup, Dealer } from '../types';

const Carpool: React.FC = () => {
  const [groups, setGroups] = useState<CarpoolGroup[]>(mockCarpoolGroups);
  const [dealers] = useState<Dealer[]>(mockDealers);
  const [modalOpen, setModalOpen] = useState(false);
  const [addMemberModal, setAddMemberModal] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [memberForm] = Form.useForm();

  const getDealerName = (id: string) => {
    const d = dealers.find(d => d.id === id);
    return d ? `${d.name} (${d.id})` : id;
  };

  const assignedDealerIds = new Set(groups.flatMap(g => g.memberIds));

  const handleCreateGroup = () => {
    form.validateFields().then(values => {
      const newGroup: CarpoolGroup = {
        id: `CP${String(groups.length + 1).padStart(3, '0')}`,
        name: values.name,
        memberIds: values.memberIds || [],
      };
      setGroups(prev => [...prev, newGroup]);
      message.success('Group created');
      setModalOpen(false);
      form.resetFields();
    });
  };

  const handleDeleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    message.success('Group deleted');
  };

  const handleRemoveMember = (groupId: string, dealerId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, memberIds: g.memberIds.filter(m => m !== dealerId) } : g
    ));
  };

  const handleAddMember = () => {
    memberForm.validateFields().then(values => {
      if (!addMemberModal) return;
      setGroups(prev => prev.map(g =>
        g.id === addMemberModal
          ? { ...g, memberIds: [...g.memberIds, ...values.dealerIds] }
          : g
      ));
      message.success('Members added');
      setAddMemberModal(null);
      memberForm.resetFields();
    });
  };

  const availableDealers = dealers.filter(d => !assignedDealerIds.has(d.id));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#888' }}>{groups.length} groups, {assignedDealerIds.size} dealers assigned</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Empty description="No carpool groups yet" />
      ) : (
        <Row gutter={[16, 16]}>
          {groups.map(group => (
            <Col key={group.id} xs={24} sm={12} lg={8}>
              <Card
                title={group.name}
                extra={
                  <Space>
                    <Button size="small" onClick={() => setAddMemberModal(group.id)}>
                      Add Member
                    </Button>
                    <Popconfirm title="Delete this group?" onConfirm={() => handleDeleteGroup(group.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                }
                size="small"
              >
                {group.memberIds.length === 0 ? (
                  <Empty description="No members" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.memberIds.map(mid => (
                      <div key={mid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{getDealerName(mid)}</span>
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<UserDeleteOutlined />}
                          onClick={() => handleRemoveMember(group.id, mid)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Create Carpool Group"
        open={modalOpen}
        onOk={handleCreateGroup}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Create"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Group Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Team Alpha Carpool" />
          </Form.Item>
          <Form.Item name="memberIds" label="Initial Members">
            <Select
              mode="multiple"
              showSearch
              placeholder="Select dealers"
              optionFilterProp="label"
              options={availableDealers.map(d => ({ value: d.id, label: `${d.name} (${d.id})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Members"
        open={!!addMemberModal}
        onOk={handleAddMember}
        onCancel={() => { setAddMemberModal(null); memberForm.resetFields(); }}
        okText="Add"
      >
        <Form form={memberForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="dealerIds" label="Select Dealers" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              showSearch
              placeholder="Select dealers"
              optionFilterProp="label"
              options={availableDealers.map(d => ({ value: d.id, label: `${d.name} (${d.id})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Carpool;
