import React from 'react';
import { DashboardModule, DashboardModuleProps } from './DashboardModule';

export const EmployeePerformanceDashboard: React.FC<DashboardModuleProps> = (props) => {
  return <DashboardModule {...props} />;
};
