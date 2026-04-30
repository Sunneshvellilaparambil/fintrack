import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'vehicles',
          columns: [
            { name: 'next_service_date', type: 'number', isOptional: true },
            { name: 'next_service_km', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'odometer_history',
          columns: [
            { name: 'vehicle_id', type: 'string', isIndexed: true },
            { name: 'odometer', type: 'number' },
            { name: 'date', type: 'number' },
          ],
        }),
        addColumns({
          table: 'service_logs',
          columns: [
            { name: 'service_name', type: 'string' },
            { name: 'is_recurring', type: 'boolean' },
            { name: 'recurring_by', type: 'string', isOptional: true },
            { name: 'next_service_km', type: 'number', isOptional: true },
            { name: 'next_service_date', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
