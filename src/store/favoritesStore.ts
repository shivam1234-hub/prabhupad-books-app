import { create } from 'zustand';
import { Favorite, Tag, Note } from '@/types';
import * as queries from '@/database/queries';

interface FavoritesState {
  favorites: Favorite[];
  favoriteIds: Set<string>;
  tags: Tag[];
  notes: Record<string, Note>;
  verseTags: Record<string, string[]>;
  loaded: boolean;
  load: () => Promise<void>;
  addFavorite: (fav: Omit<Favorite, 'id' | 'addedAt'>) => Promise<void>;
  removeFavorite: (verseId: string) => Promise<void>;
  isFavorite: (verseId: string) => boolean;
  updateNote: (verseId: string, content: string) => Promise<void>;
  deleteNote: (verseId: string) => Promise<void>;
  getNote: (verseId: string) => Note | undefined;
  createTag: (name: string, color: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;
  addVerseTag: (verseId: string, tagId: string) => Promise<void>;
  removeVerseTag: (verseId: string, tagId: string) => Promise<void>;
  loadVerseTagsFor: (verseId: string) => Promise<void>;
}

let idCounter = 0;
function uid() {
  return `${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2)}`;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  favoriteIds: new Set(),
  tags: [],
  notes: {},
  verseTags: {},
  loaded: false,

  load: async () => {
    const [favorites, tags] = await Promise.all([queries.getFavorites(), queries.getTags()]);
    // The Saved tab filters by tag, so every saved verse's tags are needed up front.
    const tagLists = await Promise.all(favorites.map((f) => queries.getVerseTagIds(f.verseId)));
    const verseTags: Record<string, string[]> = {};
    favorites.forEach((f, i) => { verseTags[f.verseId] = tagLists[i]; });
    set({
      favorites,
      favoriteIds: new Set(favorites.map((f) => f.verseId)),
      tags,
      verseTags,
      loaded: true,
    });
  },

  addFavorite: async (fav) => {
    const newFav: Favorite = { ...fav, id: uid(), addedAt: Date.now() };
    await queries.addFavorite(newFav);
    set((s) => ({
      favorites: [newFav, ...s.favorites],
      favoriteIds: new Set([...s.favoriteIds, newFav.verseId]),
    }));
  },

  removeFavorite: async (verseId) => {
    await queries.removeFavorite(verseId);
    // Tags only exist on saved verses, so unsaving drops them too.
    const tagIds = get().verseTags[verseId] ?? [];
    await Promise.all(tagIds.map((t) => queries.removeVerseTag(verseId, t)));
    set((s) => {
      const ids = new Set(s.favoriteIds);
      ids.delete(verseId);
      const verseTags = { ...s.verseTags };
      delete verseTags[verseId];
      return { favorites: s.favorites.filter((f) => f.verseId !== verseId), favoriteIds: ids, verseTags };
    });
  },

  isFavorite: (verseId) => get().favoriteIds.has(verseId),

  updateNote: async (verseId, content) => {
    const existing = get().notes[verseId];
    const note: Note = {
      id: existing?.id ?? uid(),
      verseId,
      content,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await queries.saveNote(note);
    set((s) => ({ notes: { ...s.notes, [verseId]: note } }));
  },

  deleteNote: async (verseId) => {
    await queries.deleteNote(verseId);
    set((s) => {
      const notes = { ...s.notes };
      delete notes[verseId];
      return { notes };
    });
  },

  getNote: (verseId) => get().notes[verseId],

  createTag: async (name, color) => {
    const tag: Tag = { id: uid(), name, color, createdAt: Date.now() };
    await queries.createTag(tag);
    set((s) => ({ tags: [tag, ...s.tags] }));
    return tag;
  },

  deleteTag: async (tagId) => {
    await queries.deleteTag(tagId);
    set((s) => {
      const verseTags = { ...s.verseTags };
      Object.keys(verseTags).forEach((vid) => {
        verseTags[vid] = verseTags[vid].filter((t) => t !== tagId);
      });
      return { tags: s.tags.filter((t) => t.id !== tagId), verseTags };
    });
  },

  addVerseTag: async (verseId, tagId) => {
    await queries.addVerseTag(verseId, tagId);
    set((s) => {
      const cur = s.verseTags[verseId] ?? [];
      if (cur.includes(tagId)) return s;
      return { verseTags: { ...s.verseTags, [verseId]: [...cur, tagId] } };
    });
  },

  removeVerseTag: async (verseId, tagId) => {
    await queries.removeVerseTag(verseId, tagId);
    set((s) => ({
      verseTags: { ...s.verseTags, [verseId]: (s.verseTags[verseId] ?? []).filter((t) => t !== tagId) },
    }));
  },

  loadVerseTagsFor: async (verseId) => {
    if (get().verseTags[verseId] !== undefined) return;
    const tagIds = await queries.getVerseTagIds(verseId);
    const note = await queries.getNote(verseId);
    set((s) => ({
      verseTags: { ...s.verseTags, [verseId]: tagIds },
      notes: note ? { ...s.notes, [verseId]: note } : s.notes,
    }));
  },
}));
