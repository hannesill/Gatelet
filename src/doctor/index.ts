export interface DoctorCheck {
  id: string;
  name: string;
  description: string;
  fixable: boolean;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorResult {
  check: DoctorCheck;
  status: CheckStatus;
  message: string;
  fixed?: boolean;
}

import { runChecks } from './checks.js';

export interface DoctorOptions {
  fix?: boolean;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult[]> {
  return runChecks(options);
}
