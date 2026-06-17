import { List, useTable } from '@refinedev/antd';
import { useNotification, useUpdate } from '@refinedev/core';
import { Table, InputNumber, Tag, Space, Button } from 'antd';
import { useState } from 'react';

/**
 * Menu Usage: atur creditCost per model AI. Edit inline langsung PATCH ke
 * /ai-providers/:id sehingga berefek runtime tanpa deploy.
 */
export const UsageList = () => {
  const { tableProps } = useTable({ resource: 'ai-providers', syncWithLocation: true });
  const { mutate, isLoading } = useUpdate();
  const { open } = useNotification();
  const [edits, setEdits] = useState<Record<string, number>>({});

  const save = (id: string) => {
    const value = edits[id];
    if (value === undefined) return;
    mutate(
      { resource: 'ai-providers', id, values: { creditCost: value } },
      { onSuccess: () => open?.({ type: 'success', message: 'Credit cost diperbarui' }) },
    );
  };

  return (
    <List title="Usage · Credit Cost per Model">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="key" title="Key" />
        <Table.Column dataIndex="modelName" title="Model" />
        <Table.Column dataIndex="kind" title="Kind" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column
          title="Credit Cost"
          render={(_, record: { id: string; creditCost: number }) => (
            <InputNumber
              min={0}
              defaultValue={record.creditCost}
              onChange={(v) => setEdits((e) => ({ ...e, [record.id]: Number(v) }))}
            />
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <Button size="small" type="primary" loading={isLoading} onClick={() => save(record.id)}>
                Save
              </Button>
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
