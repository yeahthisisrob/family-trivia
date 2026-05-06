/**
 * Photos tab — admin/family-curated grid of photo albums.
 *
 * Anyone signed in can add an album. Each album knows who added it
 * and when. The creator (or any admin) can edit or delete it.
 *
 * Filters by family side using the same selector pattern the rest of
 * the app uses. We never embed Google Photos directly — clicking an
 * album opens it in a new tab.
 */

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo, useState, useCallback } from 'react';

import {
  getPhotoAlbums,
  addPhotoAlbum,
  updatePhotoAlbum,
  deletePhotoAlbum,
  type PhotoAlbum,
} from '../../api/modules/photoAlbums';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { getUserColor, getUserInitials } from '../../utils';
import { shouldIncludeInFamilySide } from '../../utils/familyUtils';
import { createLogger } from '../../utils/logger';
import ConfirmDialog from '../Admin/shared/ConfirmDialog';
import CommentsThread from '../common/CommentsThread';
import FamilySideSelector from '../TimelineBoard/selectors/FamilySideSelector';

const logger = createLogger('PhotosPage');

const ALBUM_GRADIENTS = [
  colors.gameMode.crossword.gradient,
  colors.gameMode.curling.gradient,
  colors.gameMode.snake.gradient,
  colors.gameMode.tetris.gradient,
  colors.gameMode.slotMachine.gradient,
] as const;

function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ALBUM_GRADIENTS[Math.abs(h) % ALBUM_GRADIENTS.length];
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PhotosPageProps {
  userId: string;
  isAdmin?: boolean;
}

interface AlbumForm {
  name: string;
  description: string;
  url: string;
}

const EMPTY_FORM: AlbumForm = { name: '', description: '', url: '' };

const PhotosPage: React.FC<PhotosPageProps> = ({ userId, isAdmin = false }) => {
  const { members } = useFamilyData();
  const [albums, setAlbums] = useState<PhotoAlbum[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AlbumForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const memberNameById = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach(m => { map[m.userId] = m.name; });
    return map;
  }, [members]);

  const load = useCallback(async () => {
    try {
      const res = await getPhotoAlbums();
      setAlbums(res.albums || []);
      setError(null);
    } catch (err) {
      logger.error('Failed to load photo albums', err);
      setError('Could not load albums.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredAlbums = useMemo(() => {
    if (!albums) return null;
    if (side === 'all') return albums;
    return albums.filter(a => shouldIncludeInFamilySide(a.createdBy, side));
  }, [albums, side]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (album: PhotoAlbum) => {
    setForm({
      name: album.name,
      description: album.description || '',
      url: album.url,
    });
    setEditId(album.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const trimmedUrl = form.url.trim();
    if (!trimmedName || !trimmedUrl) return;
    setSaving(true);
    try {
      if (editId) {
        await updatePhotoAlbum(userId, {
          id: editId,
          name: trimmedName,
          description: form.description.trim() || undefined,
          url: trimmedUrl,
        });
      } else {
        await addPhotoAlbum(userId, {
          name: trimmedName,
          description: form.description.trim() || undefined,
          url: trimmedUrl,
        });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      logger.error('Failed to save album', err);
      setError(editId ? 'Could not save changes.' : 'Could not add the album.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePhotoAlbum(userId, confirmDelete);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      logger.error('Failed to delete album', err);
      setError('Could not delete the album.');
    }
  };

  const isUrlValid = !form.url.trim() || /^https?:\/\/.+/i.test(form.url.trim());
  const canSave = !!form.name.trim() && !!form.url.trim() && isUrlValid && !saving;

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        mb: 1.5, gap: 2,
      }}>
        <Box>
          <Typography sx={{
            fontWeight: 800, fontSize: '1.4rem',
            color: colors.text.primary, mb: 0.5,
          }}>
            Family Photos
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: colors.text.secondary }}>
            Tap an album to open it in Google Photos.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={openAdd}
          startIcon={<AddIcon />}
          sx={{
            textTransform: 'none', fontWeight: 700,
            borderRadius: `${radii.md}px`,
            bgcolor: colors.brand.primary,
            '&:hover': { bgcolor: colors.brand.primaryDark },
            flexShrink: 0,
          }}
        >
          Add
        </Button>
      </Box>

      <FamilySideSelector value={side} onChange={setSide} />

      {error && (
        <Box sx={{
          mb: 2, p: 1.5, borderRadius: `${radii.md}px`,
          bgcolor: colors.result.incorrectBg,
          border: `1px solid ${alpha(colors.result.incorrect, 0.25)}`,
        }}>
          <Typography sx={{ fontSize: '0.85rem', color: colors.result.incorrect }}>
            {error}
          </Typography>
        </Box>
      )}

      {albums === null && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={200}
              sx={{ borderRadius: `${radii.lg}px` }} />
          ))}
        </Box>
      )}

      {filteredAlbums && filteredAlbums.length === 0 && !error && (
        <Box sx={{
          textAlign: 'center', py: 6, px: 2,
          borderRadius: `${radii.lg}px`,
          bgcolor: colors.surface.subtle,
          border: `1px dashed ${colors.border.light}`,
        }}>
          <PhotoLibraryRoundedIcon sx={{
            fontSize: 48, color: colors.text.disabled, mb: 1,
          }} />
          <Typography sx={{
            fontSize: '0.95rem', fontWeight: 700, color: colors.text.primary, mb: 0.5,
          }}>
            {albums && albums.length === 0 ? 'No albums yet' : 'No albums on this side'}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: colors.text.secondary }}>
            {albums && albums.length === 0
              ? 'Tap Add to share your first one.'
              : 'Try a different family side.'}
          </Typography>
        </Box>
      )}

      {filteredAlbums && filteredAlbums.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}>
          {filteredAlbums.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              creatorName={memberNameById[album.createdBy] || album.createdBy}
              canManage={album.createdBy === userId || isAdmin}
              currentUserId={userId}
              onEdit={() => openEdit(album)}
              onDelete={() => setConfirmDelete(album.id)}
            />
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>
          {editId ? 'Edit album' : 'Share an album'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField
            label="Album name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            fullWidth size="small" autoFocus
            placeholder="Summer 2025"
          />
          <TextField
            label="Description (optional)"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            fullWidth size="small"
            multiline minRows={2}
            placeholder="What's in this album?"
          />
          <TextField
            label="Shared album link"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            fullWidth size="small"
            placeholder="https://photos.app.goo.gl/..."
            error={!isUrlValid}
            helperText={isUrlValid
              ? 'In Google Photos: open the album → Share → Create link → paste here.'
              : 'Must start with http(s)://'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small" disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            size="small"
            disabled={!canSave}
            sx={{
              textTransform: 'none', fontWeight: 700,
              bgcolor: colors.brand.primary,
              '&:hover': { bgcolor: colors.brand.primaryDark },
            }}
          >
            {editId ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete album?"
        message="This removes it from the Photos tab. Your original Google Photos album is not affected."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};

interface AlbumCardProps {
  album: PhotoAlbum;
  creatorName: string;
  canManage: boolean;
  currentUserId: string;
  onEdit: () => void;
  onDelete: () => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({
  album, creatorName, canManage, currentUserId, onEdit, onDelete,
}) => {
  const gradient = gradientFor(album.id);

  const handleOpen = () => {
    window.open(album.url, '_blank', 'noopener,noreferrer');
  };

  // Stop the card click from firing when the user taps an inline icon button.
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  return (
    <Card sx={{
      borderRadius: `${radii.lg}px`,
      overflow: 'hidden',
      boxShadow: `0 4px 16px ${alpha('#000', 0.08)}`,
      border: `1px solid ${colors.border.light}`,
      transition: 'transform 0.15s, box-shadow 0.15s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 24px ${alpha('#000', 0.12)}`,
      },
    }}>
      <CardActionArea onClick={handleOpen} sx={{ display: 'block' }}>
        <Box sx={{
          height: 110,
          background: gradient,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PhotoLibraryRoundedIcon sx={{
            fontSize: 56, color: alpha('#fff', 0.92),
            filter: `drop-shadow(0 2px 6px ${alpha('#000', 0.25)})`,
          }} />
          <Box sx={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26, borderRadius: '50%',
            bgcolor: alpha('#000', 0.25),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <OpenInNewIcon sx={{ fontSize: 14, color: '#fff' }} />
          </Box>
        </Box>

        <Box sx={{ p: 1.75 }}>
          <Typography sx={{
            fontWeight: 700, fontSize: '1rem',
            color: colors.text.primary, mb: 0.25,
            lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {album.name}
          </Typography>
          {album.description && (
            <Typography sx={{
              fontSize: '0.78rem', color: colors.text.secondary,
              lineHeight: 1.4, mb: 0.75,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {album.description}
            </Typography>
          )}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 1, mt: album.description ? 0 : 0.5,
          }}>
            <Typography sx={{
              fontSize: '0.68rem', color: colors.text.disabled,
              lineHeight: 1.3,
            }}>
              Added by <Box component="span" sx={{ fontWeight: 700, color: colors.text.secondary }}>{creatorName}</Box>
              {' '}· {timeAgo(album.createdAt)}
            </Typography>
            {canManage && (
              <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }} onClick={stop}>
                <IconButton
                  size="small"
                  onClick={(e) => { stop(e); onEdit(); }}
                  aria-label="Edit album"
                  sx={{ p: 0.5, color: colors.text.disabled, '&:hover': { color: colors.brand.primary } }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => { stop(e); onDelete(); }}
                  aria-label="Delete album"
                  sx={{ p: 0.5, color: colors.text.disabled, '&:hover': { color: colors.result.incorrect } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )}
          </Box>
        </Box>
      </CardActionArea>

      {/* Comments — outside CardActionArea so tapping a comment
          doesn't open the Google Photos link. */}
      <Box sx={{ px: 1.75, pb: 1.5 }} onClick={stop}>
        <CommentsThread
          contentId={album.id}
          contentType="album"
          currentUserId={currentUserId}
          getUserColor={getUserColor}
          getUserInitials={getUserInitials}
          textOverrides={{ placeholderText: 'Say something about this album...' }}
        />
      </Box>
    </Card>
  );
};

export default PhotosPage;
