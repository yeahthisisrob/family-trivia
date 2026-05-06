// File: src/components/FamilyTree/FamilySplitView.tsx
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupsIcon from '@mui/icons-material/Groups';
import { Avatar, Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

import { FamilyHierarchy } from '../../api';
import { shadows } from '../../shared/design-system/tokens/shadows';

// ── Types ────────────────────────────────────────────────────────────

export interface FamilySplitViewProps {
  hierarchy: FamilyHierarchy;
  groupDescriptions: Record<string, string>;
  currentUserId: string;
  onMemberClick: (userId: string) => void;
}

interface SideColor {
  main: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function sc(color: string): SideColor {
  return { main: color };
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Connector: root → sides branch ───────────────────────────────────

/** Vertical trunk line from root down to the T-branch */
const VLine: React.FC<{ color: string; height?: number }> = ({ color, height = 20 }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
    <Box sx={{ width: 2, height, bgcolor: alpha(color, 0.25), borderRadius: 1 }} />
  </Box>
);

/** Horizontal T-branch splitting left and right to each side */
const TBranch: React.FC<{ colors: string[] }> = ({ colors }) => {
  const left = colors[0] || '#999';
  const right = colors[1] || colors[0] || '#999';
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mx: 2 }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: '100%', height: 2,
            background: `linear-gradient(to right, transparent 0%, ${alpha(left, 0.3)} 50%, ${alpha(left, 0.3)} 100%)`,
            borderRadius: 1,
          }}
        />
        <Box sx={{ width: 2, height: 14, bgcolor: alpha(left, 0.25), borderRadius: 1 }} />
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: '100%', height: 2,
            background: `linear-gradient(to left, transparent 0%, ${alpha(right, 0.3)} 50%, ${alpha(right, 0.3)} 100%)`,
            borderRadius: 1,
          }}
        />
        <Box sx={{ width: 2, height: 14, bgcolor: alpha(right, 0.25), borderRadius: 1 }} />
      </Box>
    </Box>
  );
};

// ── Sub-components ───────────────────────────────────────────────────

const PersonBadge: React.FC<{
  name: string;
  personId: string;
  isCurrentUser: boolean;
  color: SideColor;
  compact?: boolean;
  onClick: () => void;
}> = ({ name, isCurrentUser, color, compact, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      px: compact ? 0.75 : 1,
      py: compact ? 0.35 : 0.5,
      borderRadius: 2,
      cursor: 'pointer',
      bgcolor: isCurrentUser ? alpha(color.main, 0.1) : 'transparent',
      border: `1.5px solid ${isCurrentUser ? color.main : 'transparent'}`,
      transition: 'all 0.15s ease',
      '&:hover': {
        bgcolor: alpha(color.main, 0.08),
        transform: 'translateX(2px)',
      },
    }}
  >
    <Avatar
      sx={{
        width: compact ? 22 : 26,
        height: compact ? 22 : 26,
        fontSize: compact ? '0.5rem' : '0.6rem',
        fontWeight: 700,
        bgcolor: isCurrentUser ? color.main : alpha(color.main, 0.15),
        color: isCurrentUser ? '#fff' : color.main,
      }}
    >
      {initials(name)}
    </Avatar>
    <Typography
      sx={{
        fontSize: compact ? '0.7rem' : '0.78rem',
        fontWeight: isCurrentUser ? 700 : 400,
        color: isCurrentUser ? color.main : 'text.primary',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.2,
      }}
    >
      {name}
    </Typography>
    {isCurrentUser && (
      <Typography sx={{ fontSize: '0.5rem', color: color.main, fontWeight: 700, ml: 'auto', opacity: 0.6 }}>
        YOU
      </Typography>
    )}
  </Box>
);

const CoupleBadge: React.FC<{
  person1: { id: string; name: string };
  person2: { id: string; name: string };
  currentUserId: string;
  color: SideColor;
  compact?: boolean;
  onMemberClick: (id: string) => void;
}> = ({ person1, person2, currentUserId, color, compact, onMemberClick }) => (
  <Box
    sx={{
      position: 'relative',
      borderRadius: 2,
      border: `1px solid ${alpha(color.main, 0.12)}`,
      bgcolor: alpha(color.main, 0.02),
      p: 0.5,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.25,
    }}
  >
    <FavoriteIcon
      sx={{
        position: 'absolute',
        top: -5,
        right: 8,
        fontSize: 11,
        color: '#e91e63',
        bgcolor: 'background.paper',
        borderRadius: '50%',
        p: '1px',
      }}
    />
    {[person1, person2].map((p) => (
      <PersonBadge
        key={p.id}
        name={p.name}
        personId={p.id}
        isCurrentUser={p.id === currentUserId}
        color={color}
        compact={compact}
        onClick={() => onMemberClick(p.id)}
      />
    ))}
  </Box>
);

const GroupCard: React.FC<{
  group: any;
  description?: string;
  color: SideColor;
  couples: [string, string][];
  singles: string[];
  people: Record<string, any>;
  currentUserId: string;
  onMemberClick: (id: string) => void;
  compact?: boolean;
}> = ({ group, description, color, couples, singles, people, currentUserId, onMemberClick, compact }) => (
  <Box
    sx={{
      borderRadius: `${10}px`,
      border: `1px solid ${alpha(color.main, 0.12)}`,
      bgcolor: 'background.paper',
      boxShadow: shadows.sm,
      overflow: 'hidden',
    }}
  >
    {/* Header */}
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.6,
        background: `linear-gradient(135deg, ${alpha(color.main, 0.08)}, ${alpha(color.main, 0.02)})`,
        borderBottom: `1px solid ${alpha(color.main, 0.08)}`,
      }}
    >
      <GroupsIcon sx={{ color: color.main, fontSize: 14 }} />
      <Typography sx={{ fontWeight: 600, color: color.main, fontSize: compact ? '0.68rem' : '0.73rem', flex: 1 }}>
        {group.name}
      </Typography>
    </Box>

    {/* Description */}
    {description && (
      <Box sx={{ px: 1, pt: 0.5 }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.35 }}>
          &ldquo;{description}&rdquo;
        </Typography>
      </Box>
    )}

    {/* Members */}
    <Box sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      {couples.map(([id1, id2]) => (
        <CoupleBadge
          key={`${id1}-${id2}`}
          person1={{ id: id1, name: people[id1]?.name || id1 }}
          person2={{ id: id2, name: people[id2]?.name || id2 }}
          currentUserId={currentUserId}
          color={color}
          compact={compact}
          onMemberClick={onMemberClick}
        />
      ))}
      {singles.map((id) => (
        <PersonBadge
          key={id}
          name={people[id]?.name || id}
          personId={id}
          isCurrentUser={id === currentUserId}
          color={color}
          compact={compact}
          onClick={() => onMemberClick(id)}
        />
      ))}
    </Box>
  </Box>
);

// ── Root couple (special centered node at the top of the tree) ───────

const RootNode: React.FC<{
  couples: [string, string][];
  singles: string[];
  people: Record<string, any>;
  description?: string;
  groupName: string;
  currentUserId: string;
  onMemberClick: (id: string) => void;
  color: SideColor;
}> = ({ couples, singles, people, description, groupName, currentUserId, onMemberClick, color }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <Box
      sx={{
        borderRadius: 3,
        border: `2px solid ${alpha(color.main, 0.2)}`,
        bgcolor: 'background.paper',
        boxShadow: shadows.md,
        overflow: 'hidden',
        width: '80%',
        maxWidth: 280,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          textAlign: 'center',
          px: 1.5,
          py: 0.75,
          background: `linear-gradient(135deg, ${alpha(color.main, 0.1)}, ${alpha(color.main, 0.03)})`,
          borderBottom: `1px solid ${alpha(color.main, 0.1)}`,
        }}
      >
        <Typography sx={{ fontWeight: 700, color: color.main, fontSize: '0.78rem' }}>
          {groupName}
        </Typography>
        {description && (
          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontStyle: 'italic', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>

      {/* Members */}
      <Box sx={{ p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        {couples.map(([id1, id2]) => (
          <CoupleBadge
            key={`${id1}-${id2}`}
            person1={{ id: id1, name: people[id1]?.name || id1 }}
            person2={{ id: id2, name: people[id2]?.name || id2 }}
            currentUserId={currentUserId}
            color={color}
            onMemberClick={onMemberClick}
          />
        ))}
        {singles.map((id) => (
          <PersonBadge
            key={id}
            name={people[id]?.name || id}
            personId={id}
            isCurrentUser={id === currentUserId}
            color={color}
            onClick={() => onMemberClick(id)}
          />
        ))}
      </Box>
    </Box>
  </Box>
);

// ── Main component ───────────────────────────────────────────────────

const FamilySplitView: React.FC<FamilySplitViewProps> = ({
  hierarchy,
  groupDescriptions,
  currentUserId,
  onMemberClick,
}) => {
  const theme = useTheme();
  const sides = hierarchy?.family?.sides || {};
  const people = hierarchy?.family?.people || {};
  const groups = hierarchy?.family?.groups || {};
  const relationships = hierarchy?.family?.relationships || [];
  const sideEntries = Object.entries(sides);

  // groupId → sideId lookup
  const groupToSide: Record<string, string> = {};
  for (const [sideId, sideData] of sideEntries) {
    for (const gId of sideData.groups || []) groupToSide[gId] = sideId;
  }

  // Center group = root partners' shared group
  const rootPartnerIds = (hierarchy?.family?.root?.partners || []).map((p) => p.id);
  const centerGroupId = (() => {
    if (rootPartnerIds.length < 2) return null;
    const g1 = people[rootPartnerIds[0]]?.groupId;
    const g2 = people[rootPartnerIds[1]]?.groupId;
    return g1 && g1 === g2 ? g1 : null;
  })();

  const determineGroupSide = (groupId: string): string => {
    if (centerGroupId && groupId === centerGroupId) return 'center';
    if (groupToSide[groupId]) return groupToSide[groupId];
    const group = groups[groupId];
    if (group?.familySide) return group.familySide;
    for (const [sideId, sideData] of sideEntries) {
      if (sideData.groups?.includes(groupId)) return sideId;
    }
    if (group?.members) {
      for (const mId of group.members) {
        if (people[mId]?.familySide) return people[mId].familySide;
      }
    }
    return 'center';
  };

  const arePartners = (id1: string, id2: string): boolean =>
    relationships.some(
      (r) =>
        r.type === 'partners' &&
        ((r.partner1 === id1 && r.partner2 === id2) ||
          (r.partner1 === id2 && r.partner2 === id1)),
    );

  const getGroupMembers = (groupId: string) => {
    const group = groups[groupId];
    if (!group?.members) return { couples: [] as [string, string][], singles: [] as string[] };
    const couples: [string, string][] = [];
    const paired = new Set<string>();
    for (let i = 0; i < group.members.length; i++) {
      if (paired.has(group.members[i])) continue;
      for (let j = i + 1; j < group.members.length; j++) {
        if (paired.has(group.members[j])) continue;
        if (arePartners(group.members[i], group.members[j])) {
          couples.push([group.members[i], group.members[j]]);
          paired.add(group.members[i]);
          paired.add(group.members[j]);
          break;
        }
      }
    }
    return { couples, singles: group.members.filter((m) => !paired.has(m)) };
  };

  // Organize groups
  const centerGroups: string[] = [];
  const sideGroups: Record<string, string[]> = {};
  for (const sideId of Object.keys(sides)) sideGroups[sideId] = [];
  for (const groupId of Object.keys(groups)) {
    const side = determineGroupSide(groupId);
    if (side === 'center') centerGroups.push(groupId);
    else if (sideGroups[side]) sideGroups[side].push(groupId);
    else centerGroups.push(groupId);
  }

  const sideKeys = Object.keys(sides);
  const hasSides = sideKeys.length > 0;
  const sideColors = sideKeys.map((id) => sides[id]?.color || theme.palette.primary.main);
  const primaryColor = theme.palette.primary.main;

  return (
    <Box sx={{ pb: 6 }}>
      {/* ── Root node (center group at top of tree) ─────────── */}
      {centerGroups.map((groupId) => {
        const { couples, singles } = getGroupMembers(groupId);
        return (
          <RootNode
            key={groupId}
            couples={couples}
            singles={singles}
            people={people}
            description={groupDescriptions[groupId]}
            groupName={groups[groupId]?.name || ''}
            currentUserId={currentUserId}
            onMemberClick={onMemberClick}
            color={sc(primaryColor)}
          />
        );
      })}

      {/* ── Root → sides connector ─────────────────────────── */}
      {hasSides && centerGroups.length > 0 && (
        <>
          <VLine color={primaryColor} height={16} />
          <TBranch colors={sideColors} />
        </>
      )}

      {/* ── Side columns ────────────────────────────────────── */}
      {hasSides && (
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {sideKeys.map((sideId) => {
            const sideData = sides[sideId];
            const sideColor = sideData?.color || primaryColor;
            const sideName = sideData?.name || `${sideId}'s Side`;

            return (
              <Box key={sideId} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Side label pill */}
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.35,
                    borderRadius: 3,
                    bgcolor: alpha(sideColor, 0.08),
                    border: `1px solid ${alpha(sideColor, 0.2)}`,
                    mb: 1,
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: sideColor, fontSize: '0.68rem', letterSpacing: 0.3 }}>
                    {sideName}
                  </Typography>
                </Box>

                {/* Groups for this side */}
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {(sideGroups[sideId] || []).map((groupId) => {
                    const { couples, singles } = getGroupMembers(groupId);
                    const color = sc(sides[sideId]?.color || primaryColor);
                    return (
                      <GroupCard
                        key={groupId}
                        group={groups[groupId]}
                        description={groupDescriptions[groupId]}
                        color={color}
                        couples={couples}
                        singles={singles}
                        people={people}
                        currentUserId={currentUserId}
                        onMemberClick={onMemberClick}
                        compact
                      />
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Fallback: no sides, just center groups ──────────── */}
      {!hasSides &&
        centerGroups.length === 0 &&
        Object.keys(groups).map((groupId) => {
          const { couples, singles } = getGroupMembers(groupId);
          return (
            <GroupCard
              key={groupId}
              group={groups[groupId]}
              description={groupDescriptions[groupId]}
              color={sc(primaryColor)}
              couples={couples}
              singles={singles}
              people={people}
              currentUserId={currentUserId}
              onMemberClick={onMemberClick}
            />
          );
        })}
    </Box>
  );
};

export default FamilySplitView;
