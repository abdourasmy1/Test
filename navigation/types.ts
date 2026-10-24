export type RootStackParamList = {
  SetupKey: undefined;
  SetupBackup: undefined;
  Main: undefined;
  LicenseResult: { recordId: string };
  LicenseDetail: { recordId: string };
  CustomerDetail: { customerNumber: string };
  KeyBackup: undefined;
  KeyRestore: undefined;
  DbBackup: undefined;
  DbRestore: undefined;
  TestTool: undefined;
  Docs: { section?: string } | undefined;
  SelfTest: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  NewLicense: { prefill?: Prefill } | undefined;
  History: { filter?: string } | undefined;
  Verify: { code?: string } | undefined;
  More: undefined;
};

export interface Prefill {
  customerName?: string;
  customerNumber?: string;
  activationRequest?: string;
  licenseType?: 'permanent' | 'temporary';
  durationDays?: string;
  notes?: string;
  reissueOf?: string;
  reissueReason?: string;
}
