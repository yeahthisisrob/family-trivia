// File: src/components/Admin/SystemInfoTab.tsx
// Deployment info, health check, and stats for the admin panel.

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { Box, Card, Chip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('SystemInfoTab');

interface SystemInfo {
  deployment: {
    region: string;
    bucket: string;
    bedrockModel: string;
    nodeEnv: string;
  };
  health: {
    usersConfig: boolean;
    familyHierarchy: boolean;
    seasonsConfig: boolean;
    categories: boolean;
    allHealthy: boolean;
  };
  stats: {
    userCount: number;
    activeSeason: { name: string; startDate: string } | null;
    totalSeasons: number;
    triviaQuestionCount: number;
  };
}

const SystemInfoTab: React.FC = () => {
  const theme = useTheme();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.request<SystemInfo>('/admin/system-info', { method: 'GET' })
      .then(setInfo)
      .catch(err => {
        logger.error('Failed to load system info', err);
        setError('Failed to load system info');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingDots mt={2} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!info) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Deployment */}
      <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <InfoIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Deployment</Typography>
        </Box>
        {[
          ['Region', info.deployment.region],
          ['S3 Bucket', info.deployment.bucket],
          ['Bedrock Model', info.deployment.bedrockModel],
          ['Environment', info.deployment.nodeEnv],
        ].map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'monospace' }}>{value}</Typography>
          </Box>
        ))}
      </Card>

      {/* Health Check */}
      <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          {info.health.allHealthy
            ? <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
            : <ErrorIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
          }
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Health Check
          </Typography>
          <Chip
            label={info.health.allHealthy ? 'All Good' : 'Issues Found'}
            size="small"
            color={info.health.allHealthy ? 'success' : 'error'}
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        </Box>
        {[
          { ok: info.health.usersConfig, label: 'config/users.json' },
          { ok: info.health.familyHierarchy, label: 'family/hierarchy.json' },
          { ok: info.health.seasonsConfig, label: 'config/seasons.json' },
          { ok: info.health.categories, label: 'categories/categories.json' },
        ].map(({ ok, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
            {ok
              ? <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
              : <ErrorIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
            }
            <Typography sx={{ fontSize: '0.8rem', color: ok ? theme.palette.text.primary : theme.palette.error.main }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Card>

      {/* Stats */}
      <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1.5 }}>Stats</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            { label: 'Users', value: info.stats.userCount },
            { label: 'Seasons', value: info.stats.totalSeasons },
            { label: 'Trivia Bank', value: `${info.stats.triviaQuestionCount} files` },
          ].map(s => (
            <Box key={s.label} sx={{
              flex: 1, minWidth: 80, textAlign: 'center',
              py: 1, px: 1.5, borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 800 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        {info.stats.activeSeason && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
              Active Season: <strong>{info.stats.activeSeason.name}</strong> (started {info.stats.activeSeason.startDate})
            </Typography>
          </Box>
        )}
        {!info.stats.activeSeason && (
          <Typography sx={{ mt: 1, fontSize: '0.75rem', color: theme.palette.warning.main }}>
            No active season — create one in the Seasons tab
          </Typography>
        )}
      </Card>
    </Box>
  );
};

export default SystemInfoTab;
