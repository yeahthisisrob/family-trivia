/**
 * Admin: one tab per part of the circle an admin looks after, each named in
 * the URL (/admin/<tab>). Each tab reads its own server data and shows its
 * own loading and errors (docs/decisions/0035).
 */
import { alpha, Box, Paper, Tab, Tabs, Typography, useTheme } from '@mui/material';
import type React from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DataTab } from '../../../features/admin-data';
import { FamilyTreeTab, GroupsTab, PlayersTab } from '../../../features/admin-people';
import { DailyQuestionsTab } from '../../../features/admin-questions';
import { SeasonsTab } from '../../../features/admin-seasons';
import { SystemInfoTab } from '../../../features/admin-system';
import { TriviaBankTab } from '../../../features/admin-trivia-bank';
import { FamilyEditor } from '../../../features/family-editor';
import { KnowledgeAdmin, StoryAdmin } from '../../../features/family-home';
import { SettingsPage } from '../../../features/settings';
import { CirclesTab } from './CirclesTab';

/** Admin sub-route definitions — order matches visual tab order */
const ADMIN_TABS = [
  { label: 'Family', path: 'family' },
  { label: 'Circles', path: 'circles' },
  { label: 'Settings', path: 'settings' },
  { label: 'Players', path: 'players' },
  { label: 'Groups', path: 'groups' },
  { label: 'Family Tree', path: 'tree' },
  { label: 'Seasons', path: 'seasons' },
  { label: 'Daily Qs', path: 'questions' },
  { label: 'Player Data', path: 'data' },
  { label: 'Trivia Bank', path: 'bank' },
  { label: 'System', path: 'system' },
] as const;

interface AdminPageProps {
  userId: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ userId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab index from current URL
  const activeTabIndex = ADMIN_TABS.findIndex((t) => location.pathname === `/admin/${t.path}`);
  // Default to the first tab (family) if the path doesn't match one
  const tabValue = activeTabIndex >= 0 ? activeTabIndex : 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Admin
      </Typography>

      <Paper
        sx={{
          mb: 2,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
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
          {ADMIN_TABS.map(({ label }) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>
      </Paper>

      <Box>
        <Routes>
          <Route
            path="/admin/family"
            element={
              <>
                <StoryAdmin />
                <KnowledgeAdmin />
                <FamilyEditor adminUserId={userId} />
              </>
            }
          />
          <Route path="/admin/circles" element={<CirclesTab />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/players" element={<PlayersTab />} />
          <Route path="/admin/groups" element={<GroupsTab />} />
          <Route path="/admin/tree" element={<FamilyTreeTab />} />
          <Route path="/admin/seasons" element={<SeasonsTab />} />
          <Route path="/admin/questions" element={<DailyQuestionsTab />} />
          <Route path="/admin/data" element={<DataTab />} />
          <Route path="/admin/bank" element={<TriviaBankTab />} />
          <Route path="/admin/system" element={<SystemInfoTab />} />
          {/* Default: the first tab */}
          <Route path="*" element={<Navigate to="/admin/family" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};
