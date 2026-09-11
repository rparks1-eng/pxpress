export type VehicleRecordType = 'maintenance' | 'registration' | 'insurance' | 'expense_follow_up';
export type VehicleRecordState = 'open' | 'completed';

export type VehicleReminder = {
  id: string;
  type: VehicleRecordType;
  title: string;
  dueOn: string;
  state: VehicleRecordState;
  odometerMiles?: number;
  estimatedCost?: number;
  note?: string;
  createdAt: string;
};

export type VehicleDocumentMetadata = {
  id: string;
  kind: 'registration' | 'insurance' | 'maintenance_record' | 'receipt_reference' | 'other';
  label: string;
  documentReference?: string;
  fileNameNote?: string;
  effectiveOn?: string;
  expiresOn?: string;
  note?: string;
  source: 'manual_metadata';
  createdAt: string;
};

export type ReminderTiming = 'overdue' | 'due_soon' | 'scheduled' | 'completed';
