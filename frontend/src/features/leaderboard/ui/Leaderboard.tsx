// File: src/features/leaderboard/ui/Leaderboard.tsx
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Tab,
  Tabs,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { type SeasonChoice, useResults } from '../../../entities/leaderboard';
import GroupRankings from './GroupRankings';
import LeaderboardError from './LeaderboardError';
import PlayerRankings from './PlayerRankings';

// Custom tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`leaderboard-tabpanel-${index}`}
      aria-labelledby={`leaderboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: { xs: 1, sm: 2 } }}>{children}</Box>}
    </div>
  );
}

interface LeaderboardProps {
  userId: string;
  onViewProfile?: (userId: string) => void;
}

/** The results, players and families, for the season picked (the current one at first). */
const Leaderboard: React.FC<LeaderboardProps> = ({ userId, onViewProfile }) => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [season, setSeason] = useState<SeasonChoice>('current');
  const results = useResults(season);

  const handleSeasonChange = (event: SelectChangeEvent<string>) => {
    const val = event.target.value;
    setSeason(val === '' ? 'all' : Number(val));
  };

  // Format season date range for display
  const formatSeasonLabel = (s: { name: string; startDate: string; endDate?: string | null }) => {
    const fmt = (d: string) => {
      const date = new Date(`${d}T00:00:00`);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const range = s.endDate
      ? `${fmt(s.startDate)} - ${fmt(s.endDate)}`
      : `${fmt(s.startDate)} - Present`;
    return `${s.name} (${range})`;
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const refresh = () => void results.refetch();

  if (results.isPending) {
    return <LoadingDots mt={6} />;
  }

  if (results.isError) {
    return (
      <LeaderboardError
        message={`Failed to load leaderboard: ${results.error.message}`}
        onRetry={refresh}
      />
    );
  }

  const { players, groups, userGroups, seasons, selectedSeason, maxQuestionsAsked } = results.data;

  // Nobody has results yet
  if (players.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
          gap: 2,
        }}
      >
        <RefreshIcon color="action" sx={{ fontSize: 40, opacity: 0.6 }} />
        <Button variant="contained" onClick={refresh} startIcon={<RefreshIcon />}>
          Load Leaderboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Season Selector */}
      {seasons.length > 0 && (
        <FormControl size="small" sx={{ mb: 1.5, minWidth: 200 }}>
          <Select
            value={selectedSeason != null ? String(selectedSeason) : ''}
            onChange={handleSeasonChange}
            displayEmpty
            sx={{
              bgcolor: theme.palette.background.paper,
              fontSize: '0.85rem',
              '& .MuiSelect-select': { py: 0.75 },
            }}
          >
            <MenuItem value="">All Time</MenuItem>
            {seasons
              .slice()
              .sort((a, b) => b.seasonNumber - a.seasonNumber)
              .map((s) => (
                <MenuItem key={s.seasonNumber} value={String(s.seasonNumber)}>
                  {formatSeasonLabel(s)}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      )}

      <Paper
        elevation={2}
        sx={{
          borderRadius: { xs: 2, sm: 3 },
          overflow: 'hidden',
          mb: { xs: 2, sm: 4 },
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: theme.palette.primary.main,
          }}
          slotProps={{
            indicator: {
              style: {
                backgroundColor: theme.palette.background.paper,
              },
            },
          }}
        >
          <Tab
            icon={<PersonIcon />}
            label="Players"
            id="leaderboard-tab-0"
            aria-controls="leaderboard-tabpanel-0"
            sx={{
              fontWeight: 'bold',
              py: { xs: 1.5, sm: 2 },
              color: theme.palette.common.white,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              minHeight: { xs: 48, sm: 72 },
              opacity: 1,
              '&.Mui-selected': {
                color: theme.palette.common.white,
                opacity: 1,
              },
            }}
          />
          <Tab
            icon={<GroupIcon />}
            label="Families"
            id="leaderboard-tab-1"
            aria-controls="leaderboard-tabpanel-1"
            sx={{
              fontWeight: 'bold',
              py: { xs: 1.5, sm: 2 },
              color: theme.palette.common.white,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              minHeight: { xs: 48, sm: 72 },
              opacity: 1,
              '&.Mui-selected': {
                color: theme.palette.common.white,
                opacity: 1,
              },
            }}
          />
        </Tabs>

        {/* Player Rankings Tab */}
        <TabPanel value={tabIndex} index={0}>
          <PlayerRankings
            players={players}
            currentUserId={userId}
            onViewProfile={onViewProfile}
            maxQuestionsAsked={maxQuestionsAsked}
          />
        </TabPanel>

        {/* Family Group Rankings Tab */}
        <TabPanel value={tabIndex} index={1}>
          <GroupRankings
            groups={groups}
            players={players}
            userGroups={userGroups}
            onViewProfile={onViewProfile}
          />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Leaderboard;
