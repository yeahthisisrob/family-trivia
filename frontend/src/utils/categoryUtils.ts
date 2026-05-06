// File: utils/categoryUtils.ts
// Utilities for working with categories

import { SystemCategory, CategoryResponse } from '../api/modules/trivia';
import { cacheService } from '../services/CacheService';

// Default color in case the category doesn't have one
const DEFAULT_CATEGORY_COLOR = '#607D8B'; // Blue Gray

// Default color for custom categories
const CUSTOM_CATEGORY_COLOR = '#9C27B0'; // Purple

/**
 * Check if a category name belongs to a custom category
 * Looks through all cached categories to check if the given name is a custom category.
 */
export function isCustomCategory(categoryName: string): boolean {
  // If no category name provided, not a custom category
  if (!categoryName) {
    return false;
  }

  // If the name is already 'Custom', it's already been identified
  if (categoryName === 'Custom') {
    return true;
  }

  // Well-known system categories
  const knownSystemCategories = [
    'History & Politics',
    'Science & Nature',
    'Geography & Travel',
    'Pop Culture',
    'Sports & Games',
    'Literature & Arts',
    'Fun Facts & Oddities',
  ];

  // Check against known system categories first (fast path)
  if (knownSystemCategories.includes(categoryName)) {
    return false;
  }

  // Heuristic for recognizing custom categories:
  // 1. If the category has a colon in the name, it's likely a custom category
  // 2. If the category name is long (>20 chars), it's likely a custom category
  if (categoryName.includes(':') || categoryName.length > 20) {
    // Validate it's not a system category before assuming it's custom
    const allSystemNames = getSystemCategoryNames();
    if (!allSystemNames.includes(categoryName)) {
      return true;
    }
  }

  // Try to find this category in the cache
  const allCacheKeys = Object.keys(cacheService['cache'] || {});
  const categoryKeys = allCacheKeys.filter((key) => key.startsWith('categories_'));

  // Check each categories cache entry
  for (const key of categoryKeys) {
    const categories = cacheService.get<CategoryResponse>(key);
    if (!categories) {
      continue;
    }

    // First check if it's a system category
    const isSystem = categories.systemCategories.some((c) => c.name === categoryName);
    if (isSystem) {
      return false; // It's a known system category
    }

    // Then check custom categories - compare lowercased titles
    const isCustom = categories.customCategories.some(
      (c) => c.title.toLowerCase() === categoryName.toLowerCase(),
    );
    if (isCustom) {
      return true; // It's a known custom category
    }

    // Also check for partial matches (if the category title contains the given name)
    const partialMatch = categories.customCategories.some(
      (c) =>
        c.title.toLowerCase().includes(categoryName.toLowerCase()) ||
        categoryName.toLowerCase().includes(c.title.toLowerCase()),
    );
    if (partialMatch) {
      return true;
    }
  }

  // If not found in any cache, try heuristic checks
  // Medical trivia categories are typically custom
  if (
    categoryName.toLowerCase().includes('medical') ||
    categoryName.toLowerCase().includes('neonatology') ||
    categoryName.toLowerCase().includes('health')
  ) {
    return true;
  }

  // If it contains "trivia" or "wonders" it's likely custom
  if (
    categoryName.toLowerCase().includes('trivia') ||
    categoryName.toLowerCase().includes('wonders')
  ) {
    return true;
  }

  return false;
}

/**
 * Get color for a category name from cached category data
 */
export function getCategoryColor(categoryName: string): string {
  // Handle custom categories with a fixed color
  if (categoryName === 'Custom' || isCustomCategory(categoryName)) {
    return CUSTOM_CATEGORY_COLOR;
  }

  // Try to get from cache - check all user caches
  const allCacheKeys = Object.keys(cacheService['cache'] || {});
  const categoryKeys = allCacheKeys.filter((key) => key.startsWith('categories_'));

  for (const key of categoryKeys) {
    const categories = cacheService.get<CategoryResponse>(key);
    if (!categories) continue;

    // Find the category with the matching name
    const category = categories.systemCategories.find(
      (c: SystemCategory) => c.name === categoryName,
    );

    if (category?.color) {
      return category.color;
    }
  }

  // If not found or no color, return default
  return DEFAULT_CATEGORY_COLOR;
}

/**
 * Get all system category names from cached data
 */
export function getSystemCategoryNames(): string[] {
  const result: string[] = [];

  // Check all cache entries
  const allCacheKeys = Object.keys(cacheService['cache'] || {});
  const categoryKeys = allCacheKeys.filter((key) => key.startsWith('categories_'));

  for (const key of categoryKeys) {
    const categories = cacheService.get<CategoryResponse>(key);
    if (!categories) continue;

    // Add all system category names that aren't already in the result
    const names = categories.systemCategories.map((c: SystemCategory) => c.name);
    for (const name of names) {
      if (!result.includes(name)) {
        result.push(name);
      }
    }
  }

  return result;
}

