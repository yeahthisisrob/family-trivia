// File: frontend/src/components/Admin/index.tsx
import { Box, Paper, Tab, Tabs, Typography, Alert, useTheme, alpha } from '@mui/material';
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import DailyQuestionsTab from './DailyQuestionsTab';
import DataTab from './DataTab';
import FamilyTreeTab from './FamilyTreeTab';
import GroupsTab from './GroupsTab';
import PlayersTab from './PlayersTab';
import SeasonsTab from './SeasonsTab';
import SystemInfoTab from './SystemInfoTab';
import TriviaBankTab from './TriviaBankTab';
import { AdminProvider, useAdmin } from '../../contexts/AdminContext';
import { LoadingDots } from '../ui/feedback';

/** Admin sub-route definitions — order matches visual tab order */
const ADMIN_TABS = [
  { label: 'Players', path: 'players' },
  { label: 'Groups', path: 'groups' },
  { label: 'Family Tree', path: 'tree' },
  { label: 'Seasons', path: 'seasons' },
  { label: 'Daily Qs', path: 'questions' },
  { label: 'Player Data', path: 'data' },
  { label: 'Trivia Bank', path: 'bank' },
  { label: 'System', path: 'system' },
] as const;

interface AdminPageInnerProps {
  userId: string;
}

const AdminPageInner: React.FC<AdminPageInnerProps> = () => {
  const admin = useAdmin();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab index from current URL
  const activeTabIndex = ADMIN_TABS.findIndex(
    t => location.pathname === `/admin/${t.path}`,
  );
  // Default to 0 (players) if path doesn't match any tab
  const tabValue = activeTabIndex >= 0 ? activeTabIndex : 0;

  useEffect(() => {
    admin.loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (admin.loading) {
    return <LoadingDots mt={3} />;
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Admin
      </Typography>

      {admin.error && (
        <Alert severity="error" sx={{ mb: 2 }}>{admin.error}</Alert>
      )}

      <Paper sx={{
        mb: 2, borderRadius: 3, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => navigate(`/admin/${ADMIN_TABS[v].path}`)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              minHeight: 44,
              px: 2,
            },
          }}
        >
          {ADMIN_TABS.map(({ label }) => <Tab key={label} label={label} />)}
        </Tabs>
      </Paper>

      <Box>
        <Routes>
          <Route path="/admin/players" element={<PlayersTab />} />
          <Route path="/admin/groups" element={<GroupsTab />} />
          <Route path="/admin/tree" element={<FamilyTreeTab />} />
          <Route path="/admin/seasons" element={<SeasonsTab />} />
          <Route path="/admin/questions" element={<DailyQuestionsTab />} />
          <Route path="/admin/data" element={<DataTab />} />
          <Route path="/admin/bank" element={<TriviaBankTab />} />
          <Route path="/admin/system" element={<SystemInfoTab />} />
          {/* Default: redirect /admin to /admin/players */}
          <Route path="*" element={<Navigate to="/admin/players" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

interface AdminPageProps {
  userId: string;
}

const AdminPage: React.FC<AdminPageProps> = ({ userId }) => {
  return (
    <AdminProvider adminUserId={userId}>
      <AdminPageInner userId={userId} />
    </AdminProvider>
  );
};

export default AdminPage;
