/** Dates as the family reads them: "June 2025", "June 2, 2025". */
export const monthName = (ym: string) =>
  new Date(`${ym.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

export const dayName = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
